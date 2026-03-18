import * as THREE from "../vendor/three.module.js";
import { getProjectedPositionFromGeo } from "./geo-utils.js";

export const SPACEPORTS = [
  { name: "Cape Canaveral, USA (East)", lat: 28.39, lon: -80.60, heading: 90 },
  { name: "Vandenberg, USA (Polar)", lat: 34.74, lon: -120.57, heading: 180 },
  { name: "Naro, South Korea (South-East)", lat: 34.43, lon: 127.53, heading: 150 },
  { name: "Wenchang, China (South-East)", lat: 19.61, lon: 110.95, heading: 120 },
  { name: "Plesetsk, Russia (Polar/North)", lat: 62.92, lon: 40.57, heading: 0 },
  { name: "Baikonur, Russia (North-East)", lat: 45.96, lon: 63.30, heading: 60 },
  { name: "Kourou, Guiana (East)", lat: 5.23, lon: -52.76, heading: 90 },
  { name: "Andøya, Norway (Polar/North)", lat: 69.29, lon: 16.02, heading: 0 }
];

// ─── Rapier async load ───
let RAPIER = null;
const rapierReadyPromise = (async () => {
  try {
    const mod = await import("../vendor/rapier-physics.js");
    await mod.init();
    RAPIER = mod;
    console.log("[Rocket] Rapier physics loaded successfully");
  } catch (err) {
    console.warn("[Rocket] Rapier load failed, using fallback physics:", err);
  }
})();

export function createRocketController({
  scalableStage,
  constants
}) {
  const rockets = [];
  const wakes = [];
  const smokes = [];

  const WAKE_DURATION = 1.0;
  const SMOKE_DURATION = 1.2;
  const ROCKET_SPEED = constants.scaleDimension(1.5);
  const SCRAPE_SPEED = constants.scaleDimension(1.2);
  // Gravity magnitude for the Rapier world (downward)
  const GRAVITY = constants.scaleDimension(4.5);
  // Horizontal thrust applied during SCRAPE to push rocket along heading
  const SCRAPE_THRUST = constants.scaleDimension(8.0);
  // Quadratic air drag coefficient — F_drag = -AIR_DRAG * |v| * v
  // Terminal velocity ≈ sqrt(GRAVITY / AIR_DRAG) when in freefall
  const AIR_DRAG = 3.5;
  // Fraction of ROCKET_SPEED lost to drag at dome altitude (LAUNCH attenuation)
  const LAUNCH_DRAG_FACTOR = 0.15;

  // Shared geometries/materials
  const sharedWakeGeo = new THREE.IcosahedronGeometry(constants.scaleDimension(0.012), 0);
  const sharedWakeMat = new THREE.MeshBasicMaterial({
    color: 0x88eeff,
    transparent: true,
    opacity: 0.6,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });

  const sharedSmokeGeo = new THREE.IcosahedronGeometry(constants.scaleDimension(0.015), 0);
  const sharedSmokeMat = new THREE.MeshBasicMaterial({
    color: 0xaaaaaa,
    transparent: true,
    opacity: 0.6,
    depthWrite: false
  });

  // ─── Rapier world ───
  let physics = null;

  function buildDomeMesh() {
    const R = constants.DOME_RADIUS;
    const baseY = constants.DOME_BASE_Y;
    const vertScale = constants.DOME_VERTICAL_SCALE;
    const N_R = 20;  // radial rings
    const N_T = 32;  // angular segments

    const vertices = [];
    const indices = [];

    // Apex vertex (top center of dome)
    vertices.push(0, baseY + vertScale * R, 0);

    // Ring vertices (r=1..N_R)
    for (let ri = 1; ri <= N_R; ri++) {
      const rWorld = (ri / N_R) * R;
      const yHeight = baseY + vertScale * Math.sqrt(Math.max(0, R * R - rWorld * rWorld));
      for (let ti = 0; ti < N_T; ti++) {
        const theta = (ti / N_T) * Math.PI * 2;
        vertices.push(
          rWorld * Math.cos(theta),
          yHeight,
          rWorld * Math.sin(theta)
        );
      }
    }

    // Apex fan triangles
    for (let ti = 0; ti < N_T; ti++) {
      indices.push(0, 1 + ti, 1 + (ti + 1) % N_T);
    }

    // Ring quad triangles
    for (let ri = 0; ri < N_R - 1; ri++) {
      const base = 1 + ri * N_T;
      for (let ti = 0; ti < N_T; ti++) {
        const i0 = base + ti;
        const i1 = base + (ti + 1) % N_T;
        const i2 = base + N_T + ti;
        const i3 = base + N_T + (ti + 1) % N_T;
        indices.push(i0, i2, i1);
        indices.push(i1, i2, i3);
      }
    }

    return { vertices, indices };
  }

  async function initPhysicsWorld() {
    await rapierReadyPromise;
    if (!RAPIER) return;

    const world = new RAPIER.World({ x: 0, y: -GRAVITY, z: 0 });

    // Dome trimesh (static ceiling)
    const { vertices, indices } = buildDomeMesh();
    const domeBodyDesc = RAPIER.RigidBodyDesc.fixed();
    const domeBody = world.createRigidBody(domeBodyDesc);
    world.createCollider(
      RAPIER.ColliderDesc
        .trimesh(new Float32Array(vertices), new Uint32Array(indices))
        .setRestitution(0.0)
        .setFriction(0.7),
      domeBody
    );

    // Ground half-space (infinite floor)
    world.createCollider(
      RAPIER.ColliderDesc
        .halfSpace(new RAPIER.Vector3(0, 1, 0))
        .setTranslation(0, constants.SURFACE_Y, 0)
        .setRestitution(0.0)
        .setFriction(1.0)
    );

    physics = { world };
  }

  initPhysicsWorld();

  // ─── Helpers ───
  function domeYAt(x, z) {
    const R = constants.DOME_RADIUS;
    const rSq = x * x + z * z;
    return constants.DOME_BASE_Y + constants.DOME_VERTICAL_SCALE * Math.sqrt(Math.max(0, R * R - rSq));
  }

  function createRapierRocketBody(pos) {
    const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(pos.x, pos.y, pos.z)
      .setLinearDamping(0.05)
      .setAngularDamping(10.0)
      .lockRotations();  // visuals handle orientation; prevent physics tumble
    const body = physics.world.createRigidBody(bodyDesc);
    physics.world.createCollider(
      RAPIER.ColliderDesc
        .ball(constants.scaleDimension(0.018))
        .setMass(1.0)
        .setRestitution(0.0)
        .setFriction(0.7),
      body
    );
    return body;
  }

  // ─── Launch ───
  function launchRocket(spaceportIndex) {
    if (spaceportIndex < 0 || spaceportIndex >= SPACEPORTS.length) return;
    const spaceport = SPACEPORTS[spaceportIndex];
    if (!constants) { console.error("Rocket launch failed: constants not defined."); return; }

    const rocketGeometryLocal = new THREE.CylinderGeometry(
      constants.scaleDimension(0.005),
      constants.scaleDimension(0.015),
      constants.scaleDimension(0.08),
      8
    );
    rocketGeometryLocal.rotateX(Math.PI / 2);
    const rocketMaterialLocal = new THREE.MeshBasicMaterial({ color: 0xff3333 });

    const startPosGeo = getProjectedPositionFromGeo(
      spaceport.lat,
      spaceport.lon,
      constants.DISC_RADIUS,
      constants.SURFACE_Y
    );
    const startPos = new THREE.Vector3(startPosGeo.x, startPosGeo.y, startPosGeo.z);

    const mesh = new THREE.Mesh(rocketGeometryLocal, rocketMaterialLocal);
    mesh.position.copy(startPos);

    const flameGeo = new THREE.ConeGeometry(
      constants.scaleDimension(0.01),
      constants.scaleDimension(0.04),
      8
    );
    flameGeo.rotateX(-Math.PI / 2);
    flameGeo.translate(0, 0, -constants.scaleDimension(0.04));
    const flameMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
    const flameMesh = new THREE.Mesh(flameGeo, flameMat);
    mesh.add(flameMesh);

    const membraneGeo = new THREE.ConeGeometry(
      constants.scaleDimension(0.025),
      constants.scaleDimension(0.12),
      16, 1, true
    );
    membraneGeo.rotateX(Math.PI / 2);
    membraneGeo.translate(0, 0, constants.scaleDimension(0.02));
    const membraneMat = new THREE.MeshBasicMaterial({
      color: 0x88ccff,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const membraneMesh = new THREE.Mesh(membraneGeo, membraneMat);
    membraneMesh.visible = false;
    mesh.add(membraneMesh);

    scalableStage.add(mesh);

    const localNorthDir = new THREE.Vector3(-startPos.x, 0, -startPos.z).normalize();
    const localEastDir = new THREE.Vector3(startPos.z, 0, -startPos.x).normalize();
    const headingRad = THREE.MathUtils.degToRad(spaceport.heading);
    const targetFlightDir = new THREE.Vector3()
      .addScaledVector(localNorthDir, Math.cos(headingRad))
      .addScaledVector(localEastDir, Math.sin(headingRad))
      .normalize();

    const maxFlightDistance = constants.scaleDimension(1.5);
    const targetDropOffProjected = startPos.clone().addScaledVector(targetFlightDir, maxFlightDistance);

    // Create Rapier rigid body if physics is ready
    let rigidBody = null;
    if (physics && RAPIER) {
      rigidBody = createRapierRocketBody(startPos);
    }

    rockets.push({
      mesh,
      membraneMesh,
      state: "LAUNCH",
      position: startPos.clone(),
      velocity: new THREE.Vector3(0, ROCKET_SPEED, 0),
      targetFlightDir,
      targetDropOffProjected,
      startPos: startPos.clone(),
      distanceTravelled: 0,
      maxFlightDistance,
      wakeTimer: 0,
      smokeTimer: 0,
      rigidBody
    });
  }

  // ─── Particle effects ───
  function spawnWake(position, moveDir) {
    const mesh = new THREE.Mesh(sharedWakeGeo, sharedWakeMat);
    mesh.position.copy(position);
    mesh.position.x += (Math.random() - 0.5) * constants.scaleDimension(0.015);
    mesh.position.y += (Math.random() - 0.5) * constants.scaleDimension(0.015);
    mesh.position.z += (Math.random() - 0.5) * constants.scaleDimension(0.015);
    scalableStage.add(mesh);

    const driftDir = moveDir.clone().negate();
    driftDir.x += (Math.random() - 0.5) * 0.4;
    driftDir.y += (Math.random() - 0.5) * 0.4;
    driftDir.z += (Math.random() - 0.5) * 0.4;
    driftDir.normalize();
    wakes.push({ mesh, age: 0, velocity: driftDir.multiplyScalar(constants.scaleDimension(0.08)) });
  }

  function spawnSmoke(position) {
    const mesh = new THREE.Mesh(sharedSmokeGeo, sharedSmokeMat);
    mesh.position.copy(position);
    mesh.position.x += (Math.random() - 0.5) * constants.scaleDimension(0.01);
    mesh.position.y += (Math.random() - 0.5) * constants.scaleDimension(0.01);
    mesh.position.z += (Math.random() - 0.5) * constants.scaleDimension(0.01);
    scalableStage.add(mesh);
    smokes.push({ mesh, age: 0 });
  }

  // ─── Update ───
  function update(deltaSeconds) {
    // Step Rapier world once per frame with variable timestep
    if (physics) {
      physics.world.integrationParameters.dt = Math.min(deltaSeconds, 1 / 30);
      physics.world.step();
    }

    for (let i = rockets.length - 1; i >= 0; i--) {
      const r = rockets[i];
      let removed = false;

      if (physics && RAPIER && r.rigidBody) {
        removed = updateRocketPhysics(r, deltaSeconds, i);
      } else {
        removed = updateRocketFallback(r, deltaSeconds, i);
      }

      if (!removed) {
        r.mesh.position.copy(r.position);
      }
    }

    // Wake particles
    for (let i = wakes.length - 1; i >= 0; i--) {
      const w = wakes[i];
      w.age += deltaSeconds;
      if (w.age > WAKE_DURATION) {
        scalableStage.remove(w.mesh);
        wakes.splice(i, 1);
      } else {
        w.mesh.position.addScaledVector(w.velocity, deltaSeconds);
        const scale = 1.0 + (w.age / WAKE_DURATION) * 3.0;
        w.mesh.scale.set(scale, scale, scale);
      }
    }

    // Smoke particles
    for (let i = smokes.length - 1; i >= 0; i--) {
      const s = smokes[i];
      s.age += deltaSeconds;
      if (s.age > SMOKE_DURATION) {
        scalableStage.remove(s.mesh);
        smokes.splice(i, 1);
      } else {
        const scale = 1.0 + (s.age / SMOKE_DURATION) * 4.0;
        s.mesh.scale.set(scale, scale, scale);
      }
    }
  }

  // ─── Physics-driven rocket update (Rapier) ───
  function updateRocketPhysics(r, deltaSeconds, arrayIndex) {
    const body = r.rigidBody;

    if (r.state === "LAUNCH") {
      // Drive velocity upward — attenuate with altitude to simulate air drag on ascent
      const domeTopY = domeYAt(r.position.x, r.position.z);
      const altFrac = Math.min(1.0, Math.max(0, (r.position.y - r.startPos.y) / Math.max(0.001, domeTopY - r.startPos.y)));
      const launchSpeed = ROCKET_SPEED * (1.0 - LAUNCH_DRAG_FACTOR * altFrac);
      body.setLinvel({ x: 0, y: launchSpeed, z: 0 }, true);

      const pos = body.translation();
      r.position.set(pos.x, pos.y, pos.z);

      r.mesh.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 0, 1),
        new THREE.Vector3(0, 1, 0)
      );

      r.smokeTimer += deltaSeconds;
      if (r.smokeTimer > 0.05) {
        spawnSmoke(r.position.clone().addScaledVector(new THREE.Vector3(0, -1, 0), constants.scaleDimension(0.04)));
        r.smokeTimer = 0;
      }

      // Detect dome contact via position check
      const domeY = domeYAt(r.position.x, r.position.z);
      if (r.position.y >= domeY - constants.scaleDimension(0.04)) {
        r.state = "SCRAPE";
        r.membraneMesh.visible = true;
        // Initial horizontal velocity in heading direction
        body.setLinvel({
          x: r.targetFlightDir.x * SCRAPE_SPEED,
          y: 0,
          z: r.targetFlightDir.z * SCRAPE_SPEED
        }, true);
      }

    } else if (r.state === "SCRAPE") {
      // Apply horizontal thrust; Rapier + dome trimesh handles surface sliding naturally
      body.applyImpulse({
        x: r.targetFlightDir.x * SCRAPE_THRUST * deltaSeconds,
        y: 0,
        z: r.targetFlightDir.z * SCRAPE_THRUST * deltaSeconds
      }, true);

      // Quadratic air drag opposing horizontal velocity during scrape
      const velPre = body.linvel();
      const hSpeed = Math.hypot(velPre.x, velPre.z);
      if (hSpeed > 0.0001) {
        const dragMag = AIR_DRAG * hSpeed * hSpeed * deltaSeconds;
        body.applyImpulse({
          x: -(velPre.x / hSpeed) * dragMag,
          y: 0,
          z: -(velPre.z / hSpeed) * dragMag
        }, true);
      }

      const pos = body.translation();
      r.position.set(pos.x, pos.y, pos.z);

      const vel = body.linvel();
      r.velocity.set(vel.x, vel.y, vel.z);

      const moveDir = new THREE.Vector3(vel.x, vel.y, vel.z);
      if (moveDir.lengthSq() > 0.001) {
        moveDir.normalize();
        r.mesh.quaternion.slerp(
          new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), moveDir),
          8.0 * deltaSeconds
        );
      }

      r.wakeTimer += deltaSeconds;
      if (r.wakeTimer > 0.01) {
        spawnWake(r.position, moveDir.lengthSq() > 0 ? moveDir : r.targetFlightDir);
        r.wakeTimer = 0;
      }

      r.smokeTimer += deltaSeconds;
      if (r.smokeTimer > 0.05) {
        const tailDir = moveDir.clone().negate().normalize();
        spawnSmoke(r.position.clone().addScaledVector(tailDir, constants.scaleDimension(0.04)));
        r.smokeTimer = 0;
      }

      r.distanceTravelled += new THREE.Vector3(vel.x, 0, vel.z).length() * deltaSeconds;

      const distToTarget = new THREE.Vector2(
        r.position.x - r.targetDropOffProjected.x,
        r.position.z - r.targetDropOffProjected.z
      ).length();
      const outsideDome = (r.position.x * r.position.x + r.position.z * r.position.z) >= constants.DOME_RADIUS * constants.DOME_RADIUS * 0.97;

      if (distToTarget < constants.scaleDimension(0.1) || r.distanceTravelled > r.maxFlightDistance || outsideDome) {
        r.state = "FALL";
        r.membraneMesh.visible = false;
        // Release: let Rapier gravity take over from current velocity
      }

    } else if (r.state === "FALL") {
      // Rapier gravity + quadratic air drag → terminal velocity
      const vel = body.linvel();
      const speed = Math.hypot(vel.x, vel.y, vel.z);
      if (speed > 0.0001) {
        body.applyForce({
          x: -(vel.x / speed) * AIR_DRAG * speed * speed,
          y: -(vel.y / speed) * AIR_DRAG * speed * speed,
          z: -(vel.z / speed) * AIR_DRAG * speed * speed
        }, true);
      }

      const pos = body.translation();
      r.position.set(pos.x, pos.y, pos.z);

      r.velocity.set(vel.x, vel.y, vel.z);

      if (r.velocity.lengthSq() > 0.0001) {
        r.mesh.quaternion.setFromUnitVectors(
          new THREE.Vector3(0, 0, 1),
          r.velocity.clone().normalize()
        );
      }

      r.smokeTimer += deltaSeconds;
      if (r.smokeTimer > 0.05) {
        const tailDir = r.velocity.clone().negate().normalize();
        spawnSmoke(r.position.clone().addScaledVector(tailDir, constants.scaleDimension(0.04)));
        r.smokeTimer = 0;
      }

      if (r.position.y <= constants.SURFACE_Y) {
        physics.world.removeRigidBody(body);
        scalableStage.remove(r.mesh);
        rockets.splice(arrayIndex, 1);
        return true; // removed
      }
    }

    return false;
  }

  // ─── Fallback: original hand-coded physics (used before Rapier is ready) ───
  function updateRocketFallback(r, deltaSeconds, arrayIndex) {
    const domeRadius = constants.DOME_RADIUS;
    const domeBaseY = constants.DOME_BASE_Y;
    const domeVertScale = constants.DOME_VERTICAL_SCALE;

    if (r.state === "LAUNCH") {
      const fbDomeH = domeBaseY + domeVertScale * Math.sqrt(Math.max(0, domeRadius * domeRadius - r.position.x * r.position.x - r.position.z * r.position.z));
      const fbAltFrac = Math.min(1.0, Math.max(0, (r.position.y - r.startPos.y) / Math.max(0.001, fbDomeH - r.startPos.y)));
      const fbLaunchSpeed = ROCKET_SPEED * (1.0 - LAUNCH_DRAG_FACTOR * fbAltFrac);
      r.velocity.set(0, fbLaunchSpeed, 0);
      r.position.addScaledVector(r.velocity, deltaSeconds);
      r.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 1, 0));

      r.smokeTimer += deltaSeconds;
      if (r.smokeTimer > 0.05) {
        spawnSmoke(r.position.clone().addScaledVector(new THREE.Vector3(0, -1, 0), constants.scaleDimension(0.04)));
        r.smokeTimer = 0;
      }

      const xSq = r.position.x * r.position.x;
      const zSq = r.position.z * r.position.z;
      const rSq = domeRadius * domeRadius;
      const domeHeightAtPos = domeBaseY + domeVertScale * Math.sqrt(Math.max(0, rSq - xSq - zSq));

      if (r.position.y >= domeHeightAtPos) {
        r.position.y = domeHeightAtPos;
        r.state = "SCRAPE";
        r.velocity.set(0, 0, 0);
        r.mesh.position.copy(r.position);
        r.membraneMesh.visible = true;
      } else if (r.position.y < constants.SURFACE_Y) {
        scalableStage.remove(r.mesh);
        rockets.splice(arrayIndex, 1);
        return true;
      }
    } else if (r.state === "SCRAPE") {
      const oldPos = r.position.clone();
      r.position.x += r.targetFlightDir.x * SCRAPE_SPEED * deltaSeconds;
      r.position.z += r.targetFlightDir.z * SCRAPE_SPEED * deltaSeconds;
      r.distanceTravelled += SCRAPE_SPEED * deltaSeconds;

      const xSq = r.position.x * r.position.x;
      const zSq = r.position.z * r.position.z;
      const rSq = domeRadius * domeRadius;
      r.position.y = (xSq + zSq <= rSq)
        ? domeBaseY + domeVertScale * Math.sqrt(rSq - xSq - zSq)
        : domeBaseY;

      const moveDelta = r.position.clone().sub(oldPos);
      const actualVelocity = moveDelta.clone().divideScalar(Math.max(0.0001, deltaSeconds));
      const moveDir = moveDelta.clone();

      if (moveDir.lengthSq() > 0.0001) {
        moveDir.normalize();
        r.mesh.quaternion.slerp(
          new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), moveDir),
          8.0 * deltaSeconds
        );
      }

      r.wakeTimer += deltaSeconds;
      if (r.wakeTimer > 0.01) {
        spawnWake(r.position, moveDir);
        r.wakeTimer = 0;
      }

      r.smokeTimer += deltaSeconds;
      if (r.smokeTimer > 0.05) {
        spawnSmoke(r.position.clone().addScaledVector(moveDir.clone().negate(), constants.scaleDimension(0.04)));
        r.smokeTimer = 0;
      }

      const distToTarget = new THREE.Vector2(
        r.position.x - r.targetDropOffProjected.x,
        r.position.z - r.targetDropOffProjected.z
      ).length();

      if (distToTarget < constants.scaleDimension(0.1) || r.distanceTravelled > r.maxFlightDistance || r.position.y <= constants.SURFACE_Y + constants.scaleDimension(0.1)) {
        r.state = "FALL";
        r.membraneMesh.visible = false;
        r.velocity.copy(actualVelocity);
      }
    } else if (r.state === "FALL") {
      // Apply gravity
      r.velocity.y -= GRAVITY * deltaSeconds;
      // Apply quadratic air drag opposing velocity
      const speed = r.velocity.length();
      if (speed > 0.0001) {
        const dragDecel = AIR_DRAG * speed * speed * deltaSeconds;
        r.velocity.addScaledVector(r.velocity.clone().normalize(), -Math.min(dragDecel, speed));
      }
      r.position.addScaledVector(r.velocity, deltaSeconds);

      if (r.velocity.lengthSq() > 0.0001) {
        r.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), r.velocity.clone().normalize());
      }

      r.smokeTimer += deltaSeconds;
      if (r.smokeTimer > 0.05) {
        spawnSmoke(r.position.clone().addScaledVector(r.velocity.clone().negate().normalize(), constants.scaleDimension(0.04)));
        r.smokeTimer = 0;
      }

      if (r.position.y <= constants.SURFACE_Y) {
        scalableStage.remove(r.mesh);
        rockets.splice(arrayIndex, 1);
        return true;
      }
    }

    return false;
  }

  return { update, launchRocket };
}
