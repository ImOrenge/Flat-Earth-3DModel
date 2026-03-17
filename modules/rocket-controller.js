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

  // Shared geometries/materials for performance
  const sharedWakeGeo = new THREE.IcosahedronGeometry(constants.scaleDimension(0.012), 0);
  const sharedWakeMat = new THREE.MeshBasicMaterial({
    color: 0x88eeff, // bright cyan-white
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

  function launchRocket(spaceportIndex) {
    if (spaceportIndex < 0 || spaceportIndex >= SPACEPORTS.length) return;
    const spaceport = SPACEPORTS[spaceportIndex];
    if (!constants) { console.error("Rocket launch failed: constants not defined."); return; }
    
    // Defer material and geometry definition cleanly to avoid ReferenceError if init failed
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
    
    // Add flame to the rocket tail
    const flameGeo = new THREE.ConeGeometry(
      constants.scaleDimension(0.01),
      constants.scaleDimension(0.04),
      8
    );
    flameGeo.rotateX(-Math.PI / 2); // point opposite to rocket direction
    flameGeo.translate(0, 0, -constants.scaleDimension(0.04)); // push down to tail
    const flameMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
    const flameMesh = new THREE.Mesh(flameGeo, flameMat);
    mesh.add(flameMesh);

    // Add membrane shockwave (visible only during scrape)
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

    // Initial velocity: purely upwards first. The curve will happen during update
    const vel = new THREE.Vector3(0, ROCKET_SPEED, 0);

    // Calculate local North and East vectors for the launch position
    const localNorthDir = new THREE.Vector3(-startPos.x, 0, -startPos.z).normalize();
    const localEastDir = new THREE.Vector3(startPos.z, 0, -startPos.x).normalize();

    const headingRad = THREE.MathUtils.degToRad(spaceport.heading);
    
    // Mix North and East vectors based on the azimuth heading angle (0 = North, 90 = East)
    const targetFlightDir = new THREE.Vector3()
      .addScaledVector(localNorthDir, Math.cos(headingRad))
      .addScaledVector(localEastDir, Math.sin(headingRad))
      .normalize();

    // The length of the flight before falling (simulated distance across dome)
    const maxFlightDistance = constants.scaleDimension(1.5);
    const targetDropOffProjected = startPos.clone().addScaledVector(targetFlightDir, maxFlightDistance);

    rockets.push({
      mesh,
      membraneMesh,
      state: "LAUNCH",
      position: startPos.clone(),
      velocity: vel,
      targetFlightDir,
      targetDropOffProjected,
      startPos: startPos.clone(),
      distanceTravelled: 0,
      maxFlightDistance,
      wakeTimer: 0,
      smokeTimer: 0
    });
  }

  function spawnWake(position, moveDir, domeNormal) {
    // Comet tail effect: spawn glowing 3D particles that trail behind
    const mesh = new THREE.Mesh(sharedWakeGeo, sharedWakeMat);
    
    // Slight random offset for voluminous tail
    mesh.position.copy(position);
    mesh.position.x += (Math.random() - 0.5) * constants.scaleDimension(0.015);
    mesh.position.y += (Math.random() - 0.5) * constants.scaleDimension(0.015);
    mesh.position.z += (Math.random() - 0.5) * constants.scaleDimension(0.015);
    
    scalableStage.add(mesh);
    
    // Velocity drifting backwards (opposite to moveDir) and slowly expanding outward
    const driftDir = moveDir.clone().negate();
    driftDir.x += (Math.random() - 0.5) * 0.4;
    driftDir.y += (Math.random() - 0.5) * 0.4;
    driftDir.z += (Math.random() - 0.5) * 0.4;
    driftDir.normalize();

    const velocity = driftDir.multiplyScalar(constants.scaleDimension(0.08));
    wakes.push({ mesh, age: 0, velocity });
  }

  function spawnSmoke(position) {
    const mesh = new THREE.Mesh(sharedSmokeGeo, sharedSmokeMat);
    mesh.position.copy(position);
    
    // Slight random offset to make Trail look fuller
    mesh.position.x += (Math.random() - 0.5) * constants.scaleDimension(0.01);
    mesh.position.y += (Math.random() - 0.5) * constants.scaleDimension(0.01);
    mesh.position.z += (Math.random() - 0.5) * constants.scaleDimension(0.01);

    scalableStage.add(mesh);
    smokes.push({ mesh, age: 0 });
  }

  function update(deltaSeconds) {
    const domeRadius = constants.DOME_RADIUS;
    const domeBaseY = constants.DOME_BASE_Y;
    const domeVertScale = constants.DOME_VERTICAL_SCALE;

    for (let i = rockets.length - 1; i >= 0; i--) {
      const r = rockets[i];

      if (r.state === "LAUNCH") {
        r.velocity.set(0, ROCKET_SPEED, 0);
        r.position.addScaledVector(r.velocity, deltaSeconds);
        r.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 1, 0));

        r.smokeTimer += deltaSeconds;
        if (r.smokeTimer > 0.05) {
          // Spawn smoke slightly behind the rocket
          const tailPos = r.position.clone().addScaledVector(new THREE.Vector3(0, -1, 0), constants.scaleDimension(0.04));
          spawnSmoke(tailPos);
          r.smokeTimer = 0;
        }

        // Exact Y height of the dome at the rocket's current (X, Z) coordinate
        const xSq = r.position.x * r.position.x;
        const zSq = r.position.z * r.position.z;
        const rSq = domeRadius * domeRadius;
        
        const domeHeightAtPos = domeBaseY + domeVertScale * Math.sqrt(Math.max(0, rSq - xSq - zSq));

        if (r.position.y >= domeHeightAtPos) {
          r.position.y = domeHeightAtPos; // lock exactly onto the firmament
          r.state = "SCRAPE";
          r.velocity.set(0, 0, 0);
          r.mesh.position.copy(r.position); // sync mesh before doing difference rotation
          r.membraneMesh.visible = true; // turn on the wrapping effect
        } else if (r.position.y < constants.SURFACE_Y) {
          scalableStage.remove(r.mesh);
          rockets.splice(i, 1);
          continue;
        }
      } else if (r.state === "SCRAPE") {
        // Move along the targetFlightDir horizontally
        const oldPos = r.position.clone();
        r.position.x += r.targetFlightDir.x * SCRAPE_SPEED * deltaSeconds;
        r.position.z += r.targetFlightDir.z * SCRAPE_SPEED * deltaSeconds;
        r.distanceTravelled += SCRAPE_SPEED * deltaSeconds;

        // Snap the new X,Z to the exact Y altitude of the dome at this new location
        const xSq = r.position.x * r.position.x;
        const zSq = r.position.z * r.position.z;
        const rSq = domeRadius * domeRadius;
        
        let domeHeightAtPos = domeBaseY;
        if (xSq + zSq <= rSq) {
          domeHeightAtPos = domeBaseY + domeVertScale * Math.sqrt(rSq - xSq - zSq);
        }
        r.position.y = domeHeightAtPos;

        const dy = (r.position.y - domeBaseY);
        const domeNormal = new THREE.Vector3(r.position.x, dy / (domeVertScale * domeVertScale), r.position.z).normalize();
        
        // Orient rocket smoothly along its movement path
        const moveDelta = r.position.clone().sub(oldPos);
        const actualVelocity = moveDelta.clone().divideScalar(Math.max(0.0001, deltaSeconds));
        const moveDir = moveDelta.clone();

        if (moveDir.lengthSq() > 0.0001) {
          moveDir.normalize();
          const targetQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), moveDir);
          // Apply a fast slerp to softly round off the 90 degree sharp turn upon dome launch hit
          r.mesh.quaternion.slerp(targetQuat, 8.0 * deltaSeconds);
        }

        r.wakeTimer += deltaSeconds;
        // spawn very frequently for a dense, glowing comet tail
        if (r.wakeTimer > 0.01) {
          spawnWake(r.position, moveDir, domeNormal);
          r.wakeTimer = 0;
        }

        r.smokeTimer += deltaSeconds;
        if (r.smokeTimer > 0.05) {
          const tailDir = moveDir.clone().negate().normalize();
          const tailPos = r.position.clone().addScaledVector(tailDir, constants.scaleDimension(0.04));
          spawnSmoke(tailPos);
          r.smokeTimer = 0;
        }

        const distToTarget = new THREE.Vector2(r.position.x - r.targetDropOffProjected.x, r.position.z - r.targetDropOffProjected.z).length();
        if (distToTarget < constants.scaleDimension(0.1) || r.distanceTravelled > r.maxFlightDistance || r.position.y <= constants.SURFACE_Y + constants.scaleDimension(0.1)) {
          r.state = "FALL";
          r.membraneMesh.visible = false; // turn off the wrapping effect
          // Preserve exact 3D velocity from the scrape slope so it doesn't "jump" trajectory
          // The velocity inherently points downwards due to sliding along the ellipse dome.
          r.velocity.copy(actualVelocity);
        }
      } else if (r.state === "FALL") {
        // Simple gravity acceleration
        r.velocity.y -= ROCKET_SPEED * 0.8 * deltaSeconds;
        r.position.addScaledVector(r.velocity, deltaSeconds);
        
        // Orient the rocket to face the direction it's falling (parabolic tangent)
        if (r.velocity.lengthSq() > 0.0001) {
          r.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), r.velocity.clone().normalize());
        }

        r.smokeTimer += deltaSeconds;
        if (r.smokeTimer > 0.05) {
          const tailDir = r.velocity.clone().negate().normalize();
          const tailPos = r.position.clone().addScaledVector(tailDir, constants.scaleDimension(0.04));
          spawnSmoke(tailPos);
          r.smokeTimer = 0;
        }

        if (r.position.y <= constants.SURFACE_Y) {
          scalableStage.remove(r.mesh);
          rockets.splice(i, 1);
          continue;
        }
      }

      r.mesh.position.copy(r.position);
    }

    for (let i = wakes.length - 1; i >= 0; i--) {
      const w = wakes[i];
      w.age += deltaSeconds;
      if (w.age > WAKE_DURATION) {
        scalableStage.remove(w.mesh);
        wakes.splice(i, 1);
      } else {
        // Move outwards slowly
        w.mesh.position.addScaledVector(w.velocity, deltaSeconds);
        const progress = w.age / WAKE_DURATION;
        const scale = 1.0 + progress * 3.0; // scale up to form the wide part of the comet tail
        w.mesh.scale.set(scale, scale, scale); // Scale uniformly in 3D
        // We only modify the opacity in the material, which affects all instances, 
        // so to avoid global opacity change, we just let geometry overlap provide the density 
        // But since material is shared, changing opacity here would leak to new particles.
        // For accurate particle systems, each needs its own material or instanced mesh.
        // Given we are not using InstancedMesh, we'll keep the constant opacity and rely on overlap & culling.
      }
    }

    for (let i = smokes.length - 1; i >= 0; i--) {
      const s = smokes[i];
      s.age += deltaSeconds;
      if (s.age > SMOKE_DURATION) {
        scalableStage.remove(s.mesh);
        smokes.splice(i, 1);
      } else {
        const progress = s.age / SMOKE_DURATION;
        const scale = 1.0 + progress * 4.0; // Smoke billows outwards
        s.mesh.scale.set(scale, scale, scale);
      }
    }
  }

  return { update, launchRocket };
}
