import * as THREE from "../../vendor/three.module.js";
import { getProjectedPositionFromGeo } from "./geo-utils.js";

export const SPACEPORTS = [
  { name: "Cape Canaveral, USA (East)", lat: 28.39, lon: -80.60, heading: 90 },
  { name: "Vandenberg, USA (Polar)", lat: 34.74, lon: -120.57, heading: 180 },
  { name: "Naro, South Korea (South-East)", lat: 34.43, lon: 127.53, heading: 150 },
  { name: "Wenchang, China (South-East)", lat: 19.61, lon: 110.95, heading: 120 },
  { name: "Plesetsk, Russia (Polar/North)", lat: 62.92, lon: 40.57, heading: 0 },
  { name: "Baikonur, Russia (North-East)", lat: 45.96, lon: 63.30, heading: 60 },
  { name: "Kourou, Guiana (East)", lat: 5.23, lon: -52.76, heading: 90 },
  { name: "And첩ya, Norway (Polar/North)", lat: 69.29, lon: 16.02, heading: 0 }
];

// ??? Rapier async load ???
let RAPIER = null;
const rapierReadyPromise = (async () => {
  try {
    const mod = await import("../../vendor/rapier-physics.js");
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
  const rockets  = [];
  const debris   = [];   // falling stage-1 bodies after separation
  const wakes    = [];
  const smokes   = [];

  const S = v => constants.scaleDimension(v);

  // ?? Physics constants ??
  const WAKE_DURATION     = 1.0;
  const SMOKE_DURATION    = 1.2;
  const GRAVITY           = S(4.5);
  const AIR_DRAG          = 3.5;
  // Legacy (single-stage / SCRAPE / FALL)
  const ROCKET_SPEED      = S(0.7);   // 1???곸듅 ?띾룄 (媛먯냽)
  const SCRAPE_SPEED      = S(1.4);   // 沅곸갹 湲곴린 珥덇린 ?띾룄
  const SCRAPE_RESIDUAL_THRUST = S(5.0);  // 沅곸갹 湲곴린 ?붿뿬 異붿쭊??(2???곕즺 ?붿〈)
  const DOME_FLUID_DRAG   = 4.0;          // 沅곸갹 ?좎껜 ???怨꾩닔 (?댁감)
  const DOME_VISCOUS_DRAG = 0.8;          // 沅곸갹 ?먯꽦 ???怨꾩닔 (?좏삎)
  const LAUNCH_DRAG_FACTOR = 0.12;
  // 2-stage maneuvering
  const STAGE1_THRUST     = S(5.0);
  const STAGE2_SPEED      = S(1.8);   // 2??異붾젰 ?띾룄 (setLinvel)
  const STAGE1_DURATION   = 5.0;      // 1???곗냼 理쒕? ?쒓컙 (?덉쟾 fallback)
  const SEP_DURATION      = 0.35;     // 遺꾨━ ?곗텧 ?쒓컙 (吏㏐쾶 ???띾룄 ?좎?濡??먯뿰?ㅻ읇寃?
  const STAGE2_DURATION   = 3.5;      // 2???곗냼 理쒕? ?쒓컙 (?덉쟾?μ튂)
  const SCRAPE_FUEL_DURATION = 6.0;   // 沅곸갹 湲곴린 吏???쒓컙(珥?
  const PITCHOVER_DURATION  = 0.8;               // ?먯꽭 ?쒖뼱 吏???쒓컙 (30째源뚯? 鍮좊Ⅴ寃?
  const PITCHOVER_ANGLE     = Math.PI / 2 * 0.80; // 理쒕? 湲곗슱湲? 72째 (?섏쭅?먯꽌)
  const PITCHOVER_SEP_ANGLE = Math.PI / 6;        // 遺꾨━ 媛곷룄: 30째
  const STAGE1_ALT_TRIGGER  = 0.80;               // ?쇱튂?ㅻ쾭 ?쒖옉 怨좊룄 鍮꾩쑉 (80%)

  // ?? Shared particle materials ??
  const sharedWakeGeo = new THREE.IcosahedronGeometry(S(0.012), 0);
  const sharedWakeMat = new THREE.MeshBasicMaterial({
    color: 0x88eeff, transparent: true, opacity: 0.6,
    depthWrite: false, blending: THREE.AdditiveBlending
  });
  const sharedSmokeGeo = new THREE.IcosahedronGeometry(S(0.015), 0);
  const sharedSmokeMat = new THREE.MeshBasicMaterial({
    color: 0xaaaaaa, transparent: true, opacity: 0.6, depthWrite: false
  });
  const sharedSepGeo = new THREE.IcosahedronGeometry(S(0.009), 0);
  const sharedSepMat = new THREE.MeshBasicMaterial({
    color: 0xffdd44, transparent: true, opacity: 1.0,
    depthWrite: false, blending: THREE.AdditiveBlending
  });

  // ??? Rapier world ???
  let physics = null;

  function buildDomeMesh() {
    const R        = constants.DOME_RADIUS;
    const baseY    = constants.DOME_BASE_Y;
    const vertScale = constants.DOME_VERTICAL_SCALE;
    const N_R = 20, N_T = 32;

    const vertices = [], indices = [];
    vertices.push(0, baseY + vertScale * R, 0);
    for (let ri = 1; ri <= N_R; ri++) {
      const rWorld  = (ri / N_R) * R;
      const yHeight = baseY + vertScale * Math.sqrt(Math.max(0, R * R - rWorld * rWorld));
      for (let ti = 0; ti < N_T; ti++) {
        const theta = (ti / N_T) * Math.PI * 2;
        vertices.push(rWorld * Math.cos(theta), yHeight, rWorld * Math.sin(theta));
      }
    }
    for (let ti = 0; ti < N_T; ti++) indices.push(0, 1 + ti, 1 + (ti + 1) % N_T);
    for (let ri = 0; ri < N_R - 1; ri++) {
      const base = 1 + ri * N_T;
      for (let ti = 0; ti < N_T; ti++) {
        const i0 = base + ti, i1 = base + (ti + 1) % N_T;
        const i2 = base + N_T + ti, i3 = base + N_T + (ti + 1) % N_T;
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

    const { vertices, indices } = buildDomeMesh();
    // ???몃씪?대찓??肄쒕씪?대뜑 ?쒓굅: ???묒큺? domeYAt() ?꾩튂 寃?щ줈 肄붾뱶 ?쒖뼱.
    // 臾쇰━ 異⑸룎 諛섏쓳(?뺢?) 諛⑹?.
    const halfSpaceFactory =
      (typeof RAPIER.ColliderDesc.halfSpace === "function")
        ? RAPIER.ColliderDesc.halfSpace
        : RAPIER.ColliderDesc.halfspace;
    if (typeof halfSpaceFactory === "function") {
      world.createCollider(
        halfSpaceFactory(new RAPIER.Vector3(0, 1, 0))
          .setTranslation(0, constants.SURFACE_Y, 0)
          .setRestitution(0.0)
          .setFriction(1.0)
      );
    } else {
      world.createCollider(
        RAPIER.ColliderDesc.cuboid(constants.DISC_RADIUS * 2, 0.01, constants.DISC_RADIUS * 2)
          .setTranslation(0, constants.SURFACE_Y - 0.01, 0)
          .setRestitution(0.0)
          .setFriction(1.0)
      );
    }
    physics = { world };
  }

  initPhysicsWorld();

  // ??? Helpers ???
  function domeYAt(x, z) {
    const R   = constants.DOME_RADIUS;
    const rSq = x * x + z * z;
    return constants.DOME_BASE_Y + constants.DOME_VERTICAL_SCALE * Math.sqrt(Math.max(0, R * R - rSq));
  }

  function createRapierRocketBody(pos) {
    const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(pos.x, pos.y, pos.z)
      .setLinearDamping(0.05)
      .setAngularDamping(10.0)
      .lockRotations();
    const body = physics.world.createRigidBody(bodyDesc);
    physics.world.createCollider(
      RAPIER.ColliderDesc.ball(S(0.018))
        .setMass(1.0).setRestitution(0.0).setFriction(0.7),
      body
    );
    return body;
  }

  function createRapierDebrisBody(pos, initVel, linDamping = 0.10) {
    if (!physics || !RAPIER) return null;
    const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(pos.x, pos.y, pos.z)
      .setLinearDamping(linDamping)
      .setAngularDamping(0.15); // ??쓣?섎줉 ?ㅻ옒 ?뚯쟾
    const body = physics.world.createRigidBody(bodyDesc);
    physics.world.createCollider(
      RAPIER.ColliderDesc.ball(S(0.014))
        .setMass(0.4).setRestitution(0.05).setFriction(0.3),
      body
    );
    if (initVel) body.setLinvel(initVel, true);
    return body;
  }

  // ??? Mesh builders ???
  // All meshes are oriented along +Y (nose at +Y, exhaust at -Y).
  // Orientation is done via quaternion.setFromUnitVectors(UP, dir) where UP=(0,1,0).

  function buildSingleStageRocket() {
    const group = new THREE.Group();

    const fuselageGeo = new THREE.CylinderGeometry(S(0.005), S(0.012), S(0.08), 8);
    const fuselage    = new THREE.Mesh(fuselageGeo, new THREE.MeshBasicMaterial({ color: 0xff3333 }));
    group.add(fuselage);

    const flameGeo  = new THREE.ConeGeometry(S(0.01), S(0.04), 8);
    const flame1    = new THREE.Mesh(flameGeo, new THREE.MeshBasicMaterial({ color: 0xffaa00 }));
    flame1.rotation.z = Math.PI; // flip: wide end down
    flame1.position.y = -(S(0.08) / 2 + S(0.04) / 2);
    group.add(flame1);

    const membraneGeo = new THREE.ConeGeometry(S(0.025), S(0.12), 16, 1, true);
    const membraneMesh = new THREE.Mesh(membraneGeo, new THREE.MeshBasicMaterial({
      color: 0x88ccff, transparent: true, opacity: 0.5,
      side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false
    }));
    membraneMesh.position.y = S(0.08) / 2 + S(0.12) / 2;
    membraneMesh.visible = false;
    group.add(membraneMesh);

    return { group, membraneMesh, flame1, flame2: null, stage1Group: null, interstage: null };
  }

  function buildTwoStageRocket() {
    const group = new THREE.Group();

    // ?? 2??(?곷떒, +Y 諛⑺뼢) ??????????????????????????????
    const stage2Group = new THREE.Group();
    const s2H = S(0.048), s2R = S(0.0065);

    // ?섏뼱留??몄쫰肄?
    const noseMesh = new THREE.Mesh(
      new THREE.ConeGeometry(s2R, S(0.026), 8),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    noseMesh.position.y = s2H / 2 + S(0.026) / 2;
    stage2Group.add(noseMesh);

    // 2???곕즺?깊겕
    const tank2 = new THREE.Mesh(
      new THREE.CylinderGeometry(s2R, s2R, s2H, 8),
      new THREE.MeshBasicMaterial({ color: 0xdddddd })
    );
    stage2Group.add(tank2);

    // 2???붿쭊踰?
    const bell2 = new THREE.Mesh(
      new THREE.CylinderGeometry(s2R * 0.75, s2R * 1.5, S(0.014), 8),
      new THREE.MeshBasicMaterial({ color: 0x888888 })
    );
    bell2.position.y = -(s2H / 2 + S(0.014) / 2);
    stage2Group.add(bell2);

    // 2???붿뿼 (?뚮?????珥덇린 ?④?)
    const flame2 = new THREE.Mesh(
      new THREE.ConeGeometry(S(0.007), S(0.038), 8),
      new THREE.MeshBasicMaterial({ color: 0x66ccff })
    );
    flame2.rotation.z = Math.PI;
    flame2.position.y = -(s2H / 2 + S(0.014) + S(0.038) / 2);
    flame2.visible = false;
    stage2Group.add(flame2);

    // 異⑷꺽??留?(Membrane ??SCRAPE ???쒖떆)
    const membraneMesh = new THREE.Mesh(
      new THREE.ConeGeometry(S(0.022), S(0.10), 16, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0x88ccff, transparent: true, opacity: 0.5,
        side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false
      })
    );
    membraneMesh.position.y = s2H / 2 + S(0.026) + S(0.10) / 2;
    membraneMesh.visible = false;
    stage2Group.add(membraneMesh);

    // ?? ?명꽣?ㅽ뀒?댁? 留???????????????????????????????????
    const interstageH = S(0.013);
    const interstage  = new THREE.Mesh(
      new THREE.CylinderGeometry(s2R * 1.6, S(0.0105), interstageH, 8),
      new THREE.MeshBasicMaterial({ color: 0x888888 })
    );

    // ?? 1??(?섎떒, -Y 諛⑺뼢) ??????????????????????????????
    const stage1Group = new THREE.Group();
    const s1H = S(0.082), s1RTop = S(0.0105), s1RBot = S(0.015);

    // 1???곕즺?깊겕
    const tank1 = new THREE.Mesh(
      new THREE.CylinderGeometry(s1RTop, s1RBot, s1H, 8),
      new THREE.MeshBasicMaterial({ color: 0xff4422 })
    );
    stage1Group.add(tank1);

    // ?(?덉젙?? 횞4
    for (let fi = 0; fi < 4; fi++) {
      const angle  = (fi / 4) * Math.PI * 2;
      const finGeo = new THREE.BoxGeometry(S(0.005), S(0.025), S(0.02));
      const fin    = new THREE.Mesh(finGeo, new THREE.MeshBasicMaterial({ color: 0xcc2200 }));
      fin.position.set(
        Math.cos(angle) * (s1RBot + S(0.01)),
        -(s1H / 2 - S(0.0125)),
        Math.sin(angle) * (s1RBot + S(0.01))
      );
      stage1Group.add(fin);
    }

    // 1???붿쭊踰?
    const nozzle1 = new THREE.Mesh(
      new THREE.CylinderGeometry(s1RBot * 0.7, s1RBot * 1.9, S(0.028), 8),
      new THREE.MeshBasicMaterial({ color: 0x666666 })
    );
    nozzle1.position.y = -(s1H / 2 + S(0.028) / 2);
    stage1Group.add(nozzle1);

    // 1???붿뿼 (二쇳솴?? ?ш퀬 諛앹쓬)
    const flame1 = new THREE.Mesh(
      new THREE.ConeGeometry(S(0.016), S(0.060), 8),
      new THREE.MeshBasicMaterial({ color: 0xff8800 })
    );
    flame1.rotation.z = Math.PI;
    flame1.position.y = -(s1H / 2 + S(0.028) + S(0.060) / 2);
    stage1Group.add(flame1);

    // ?? 議곕┰ ?????????????????????????????????????????????
    // stage2Group ?꾩튂: ?명꽣?ㅽ뀒?댁? ??
    stage2Group.position.y = interstageH + s2H / 2;
    group.add(stage2Group);

    // interstage: stage1 ?깊겕 ?곷떒???꾩튂
    interstage.position.y = interstageH / 2;
    group.add(interstage);

    // stage1Group: ?명꽣?ㅽ뀒?댁? ?꾨옒
    stage1Group.position.y = -(s1H / 2);
    group.add(stage1Group);

    return { group, membraneMesh, flame1, flame2, stage1Group, interstage };
  }

  // ??? 1??遺꾨━ (?먮룞媛? ???
  function startStageSeparation(r) {
    if (!r.stage1Group) return;

    // scalableStage媛 XZ ?ㅼ??쇱쓣 媛吏誘濡?getWorldPosition() ?ъ슜 遺덇?.
    // r.position? Rapier 醫뚰몴 = scalableStage 濡쒖뺄 醫뚰몴? ?숈씪?섎?濡??대? 湲곗??쇰줈 怨꾩궛.
    // stage1Group??濡쒖뺄 ?ㅽ봽?뗭쓣 濡쒖폆 ?뚯쟾?쇰줈 蹂?섑빐 ?뷀븿.
    const stage1Offset = r.stage1Group.position.clone();
    stage1Offset.applyQuaternion(r.mesh.quaternion);
    const physicsPos = r.position.clone().add(stage1Offset);

    // ?뚯쟾: getWorldQuaternion? ?ㅼ????곹뼢 ?놁쑝誘濡?洹몃?濡??ъ슜
    const worldQuat = new THREE.Quaternion();
    r.stage1Group.getWorldQuaternion(worldQuat);

    r.mesh.remove(r.stage1Group);
    if (r.interstage) r.mesh.remove(r.interstage);

    // ?? ?먮룞媛? ?곷떒(?깊겕 ?숈껜)怨??섎떒(?붿쭊遺+?) 遺꾨━ ??
    const pieceTop = new THREE.Group();
    const pieceBot = new THREE.Group();

    for (const child of r.stage1Group.children) {
      (child.position.y >= -S(0.005) ? pieceTop : pieceBot).add(child.clone());
    }

    // physicsPos = Rapier 醫뚰몴 = scalableStage 濡쒖뺄 醫뚰몴 ??硫붿떆? 臾쇰━ 紐⑤몢 ?숈씪 湲곗?
    pieceTop.position.copy(physicsPos);
    pieceTop.quaternion.copy(worldQuat);
    pieceBot.position.copy(physicsPos);
    pieceBot.quaternion.copy(worldQuat);
    scalableStage.add(pieceTop);
    scalableStage.add(pieceBot);

    const vel = r.rigidBody ? r.rigidBody.linvel() : r.velocity;

    // ?곷떒 議곌컖: ?댁쭩 ?꾨줈 ?硫??먮┛ ?釉붾쭅
    const topBody = createRapierDebrisBody(physicsPos, {
      x: (vel.x || 0) * 0.05 + (Math.random() - 0.5) * S(0.04),
      y: S(0.06),
      z: (vel.z || 0) * 0.05 + (Math.random() - 0.5) * S(0.04)
    }, 0.10);
    if (topBody) {
      topBody.applyTorqueImpulse({
        x: (Math.random() - 0.5) * 0.05,
        y: (Math.random() - 0.5) * 0.01,
        z: (Math.random() - 0.5) * 0.05
      }, true);
      debris.push({ mesh: pieceTop, rigidBody: topBody });
    } else {
      debris.push({ mesh: pieceTop, rigidBody: null,
        velocity: new THREE.Vector3(0, S(0.06), 0) });
    }

    // ?섎떒 議곌컖: ?꾨옒濡?遺꾨━?섎ŉ 鍮좊Ⅸ ?뚯쟾
    const botPos = physicsPos.clone().addScaledVector(new THREE.Vector3(0, -1, 0), S(0.02));
    const botBody = createRapierDebrisBody(botPos, {
      x: (vel.x || 0) * 0.08 + (Math.random() - 0.5) * S(0.05),
      y: -S(0.1),
      z: (vel.z || 0) * 0.08 + (Math.random() - 0.5) * S(0.05)
    }, 0.07);
    if (botBody) {
      botBody.applyTorqueImpulse({
        x: (Math.random() - 0.5) * 0.10,
        y: (Math.random() - 0.5) * 0.03,
        z: (Math.random() - 0.5) * 0.10
      }, true);
      debris.push({ mesh: pieceBot, rigidBody: botBody });
    } else {
      debris.push({ mesh: pieceBot, rigidBody: null,
        velocity: new THREE.Vector3(
          (vel.x || 0) * 0.08, -S(0.1), (vel.z || 0) * 0.08
        ) });
    }

    if (r.flame1) r.flame1.visible = false;
    for (let i = 0; i < 10; i++) spawnSepParticle(r.position.clone());
  }

  // ??? Launch ???
  function launchRocket(spaceportIndex, rocketType = "two-stage") {
    if (spaceportIndex < 0 || spaceportIndex >= SPACEPORTS.length) return;
    const spaceport = SPACEPORTS[spaceportIndex];

    const startPosGeo = getProjectedPositionFromGeo(
      spaceport.lat, spaceport.lon,
      constants.DISC_RADIUS, constants.SURFACE_Y
    );
    const startPos = new THREE.Vector3(startPosGeo.x, startPosGeo.y, startPosGeo.z);

    const isTwoStage = rocketType === "two-stage";
    const { group, membraneMesh, flame1, flame2, stage1Group, interstage } =
      isTwoStage ? buildTwoStageRocket() : buildSingleStageRocket();

    group.position.copy(startPos);
    scalableStage.add(group);

    // 諛쒖궗 諛⑺뼢 怨꾩궛
    const localNorthDir = new THREE.Vector3(-startPos.x, 0, -startPos.z).normalize();
    const localEastDir  = new THREE.Vector3(startPos.z, 0, -startPos.x).normalize();
    const headingRad    = THREE.MathUtils.degToRad(spaceport.heading);
    const targetFlightDir = new THREE.Vector3()
      .addScaledVector(localNorthDir, Math.cos(headingRad))
      .addScaledVector(localEastDir,  Math.sin(headingRad))
      .normalize();

    const maxFlightDistance      = S(1.5);
    const targetDropOffProjected = startPos.clone().addScaledVector(targetFlightDir, maxFlightDistance);

    let rigidBody = null;
    if (physics && RAPIER) {
      rigidBody = createRapierRocketBody(startPos);
    }

    rockets.push({
      mesh: group,
      membraneMesh,
      flame1,
      flame2,
      stage1Group,
      interstage,
      isTwoStage,
      state: isTwoStage ? "STAGE1" : "LAUNCH",
      position: startPos.clone(),
      velocity: new THREE.Vector3(0, 0, 0),
      thrustDir: new THREE.Vector3(0, 1, 0),
      targetFlightDir,
      targetDropOffProjected,
      startPos: startPos.clone(),
      distanceTravelled: 0,
      maxFlightDistance,
      stageTimer: 0,
      scrapeTimer: 0,
      wakeTimer: 0,
      smokeTimer: 0,
      pitchoverDir: null,
      rigidBody
    });
  }

  // ??? Particles ???
  function spawnWake(position, moveDir) {
    const mesh = new THREE.Mesh(sharedWakeGeo, sharedWakeMat);
    mesh.position.copy(position);
    mesh.position.x += (Math.random() - 0.5) * S(0.015);
    mesh.position.y += (Math.random() - 0.5) * S(0.015);
    mesh.position.z += (Math.random() - 0.5) * S(0.015);
    scalableStage.add(mesh);
    const drift = moveDir.clone().negate();
    drift.x += (Math.random() - 0.5) * 0.4;
    drift.y += (Math.random() - 0.5) * 0.4;
    drift.z += (Math.random() - 0.5) * 0.4;
    drift.normalize();
    wakes.push({ mesh, age: 0, velocity: drift.multiplyScalar(S(0.08)) });
  }

  function spawnSmoke(position) {
    const mesh = new THREE.Mesh(sharedSmokeGeo, sharedSmokeMat);
    mesh.position.copy(position);
    mesh.position.x += (Math.random() - 0.5) * S(0.01);
    mesh.position.y += (Math.random() - 0.5) * S(0.01);
    mesh.position.z += (Math.random() - 0.5) * S(0.01);
    scalableStage.add(mesh);
    smokes.push({ mesh, age: 0 });
  }

  function spawnSepParticle(position) {
    const mesh = new THREE.Mesh(sharedSepGeo, sharedSepMat.clone());
    mesh.position.copy(position);
    mesh.position.x += (Math.random() - 0.5) * S(0.01);
    mesh.position.z += (Math.random() - 0.5) * S(0.01);
    scalableStage.add(mesh);
    const speed = S(0.10) + Math.random() * S(0.15);
    const theta = Math.random() * Math.PI * 2;
    const vel = new THREE.Vector3(
      Math.cos(theta) * speed,
      (Math.random() * 0.3) * speed,
      Math.sin(theta) * speed
    );
    wakes.push({ mesh, age: 0, velocity: vel, maxAge: 0.6 });
  }

  // ??? Update ???
  function update(deltaSeconds) {
    if (physics) {
      physics.world.integrationParameters.dt = Math.min(deltaSeconds, 1 / 30);
      physics.world.step();
    }

    for (let i = rockets.length - 1; i >= 0; i--) {
      const r       = rockets[i];
      let removed   = false;
      if (physics && RAPIER && r.rigidBody) {
        removed = updateRocketPhysics(r, deltaSeconds, i);
      } else {
        removed = updateRocketFallback(r, deltaSeconds, i);
      }
      if (!removed) r.mesh.position.copy(r.position);
    }

    // ?? Debris (1???뷀빐) ??????????????????????????????
    for (let i = debris.length - 1; i >= 0; i--) {
      const d = debris[i];
      if (d.rigidBody) {
        const pos = d.rigidBody.translation();
        const rot = d.rigidBody.rotation();
        d.mesh.position.set(pos.x, pos.y, pos.z);
        d.mesh.quaternion.set(rot.x, rot.y, rot.z, rot.w);
        if (pos.y <= constants.SURFACE_Y) {
          physics.world.removeRigidBody(d.rigidBody);
          scalableStage.remove(d.mesh);
          debris.splice(i, 1);
        }
      } else {
        // ?대갚 ?섎룞 臾쇰━
        d.velocity = d.velocity || new THREE.Vector3(0, 0, 0);
        d.velocity.y -= GRAVITY * deltaSeconds;
        d.mesh.position.addScaledVector(d.velocity, deltaSeconds);
        d.mesh.rotation.x += 1.8 * deltaSeconds;
        d.mesh.rotation.z += 2.5 * deltaSeconds;
        if (d.mesh.position.y <= constants.SURFACE_Y) {
          scalableStage.remove(d.mesh);
          debris.splice(i, 1);
        }
      }
    }

    // ?? Wake particles ??????????????????????????????????
    for (let i = wakes.length - 1; i >= 0; i--) {
      const w   = wakes[i];
      const maxAge = w.maxAge ?? WAKE_DURATION;
      w.age += deltaSeconds;
      if (w.age > maxAge) {
        scalableStage.remove(w.mesh);
        wakes.splice(i, 1);
      } else {
        w.mesh.position.addScaledVector(w.velocity, deltaSeconds);
        const scale = 1.0 + (w.age / maxAge) * 3.0;
        w.mesh.scale.set(scale, scale, scale);
        if (w.mesh.material.opacity !== undefined) {
          w.mesh.material.opacity = Math.max(0, 1.0 - w.age / maxAge);
        }
      }
    }

    // ?? Smoke particles ?????????????????????????????????
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

  // ?????????????????????????????????????????????????????
  //  Rapier 臾쇰━ 寃쎈줈
  // ?????????????????????????????????????????????????????
  const _UP = new THREE.Vector3(0, 1, 0);

  function updateRocketPhysics(r, deltaSeconds, arrayIndex) {
    const body = r.rigidBody;

    // ?? STAGE1: 1???곗냼 ???곗냽 以묐젰 ?좏쉶 (?щЪ??沅ㅻ룄) ??????
    if (r.state === "STAGE1") {
      r.stageTimer += deltaSeconds;

      const domeY1   = domeYAt(r.position.x, r.position.z);
      const altFrac1 = Math.min(1, Math.max(0,
        (r.position.y - r.startPos.y) / Math.max(0.001, domeY1 - r.startPos.y)
      ));

      // ?곗냽 以묐젰 ?좏쉶: 怨좊룄???곕씪 0째 ??30째 ?щЪ??湲곗슱湲?
      const turnProgress = Math.min(1, altFrac1 / STAGE1_ALT_TRIGGER);
      const pitchAngle = turnProgress * turnProgress * PITCHOVER_SEP_ANGLE;
      r.thrustDir.set(
        r.targetFlightDir.x * Math.sin(pitchAngle),
        Math.cos(pitchAngle),
        r.targetFlightDir.z * Math.sin(pitchAngle)
      ).normalize();

      const climbSpeed = ROCKET_SPEED * (1.0 - LAUNCH_DRAG_FACTOR * altFrac1);
      body.setLinvel({
        x: r.thrustDir.x * climbSpeed,
        y: r.thrustDir.y * climbSpeed,
        z: r.thrustDir.z * climbSpeed
      }, true);

      const pos1 = body.translation();
      r.position.set(pos1.x, pos1.y, pos1.z);

      // 濡쒖폆 ?먯꽭瑜?thrustDir濡??뺣젹 (?щЪ??沅ㅼ쟻 ?곕씪)
      const tq1 = new THREE.Quaternion().setFromUnitVectors(_UP, r.thrustDir);
      r.mesh.quaternion.slerp(tq1, 5.0 * deltaSeconds);

      r.smokeTimer += deltaSeconds;
      if (r.smokeTimer > 0.04) {
        spawnSmoke(r.position.clone().addScaledVector(r.thrustDir.clone().negate(), S(0.07)));
        r.smokeTimer = 0;
      }

      // ??愿??諛⑹?
      if (r.position.y >= domeY1) {
        r.position.y = domeY1;
        body.setTranslation({ x: r.position.x, y: domeY1, z: r.position.z }, true);
        const cv = body.linvel();
        body.setLinvel({ x: cv.x, y: 0, z: cv.z }, true);
        r.pitchoverDir = r.thrustDir.clone();
        r.sepVel = { x: cv.x, y: 0, z: cv.z };
        r.state = "SEPARATION"; r.stageTimer = 0;
        startStageSeparation(r);
      } else {
        // 80% 怨좊룄(30째 湲곗슱湲? ?꾨떖 ??遺꾨━
        const domeFrac1 = altFrac1;
        if (domeFrac1 >= STAGE1_ALT_TRIGGER || r.stageTimer >= STAGE1_DURATION) {
          r.pitchoverDir = r.thrustDir.clone();
          const cv = body.linvel();
          r.sepVel = { x: cv.x, y: cv.y, z: cv.z };
          r.state = "SEPARATION"; r.stageTimer = 0;
          startStageSeparation(r);
        }
      }

    // ?? PITCHOVER: ?먯꽭 ?쒖뼱 ???섏쭅 ???섑룊 湲곗슱湲???????????
    } else if (r.state === "PITCHOVER") {
      r.stageTimer += deltaSeconds;

      const pitchFrac  = Math.min(1.0, r.stageTimer / PITCHOVER_DURATION);
      const pitchAngle = pitchFrac * PITCHOVER_ANGLE;
      r.thrustDir.set(
        r.targetFlightDir.x * Math.sin(pitchAngle),
        Math.cos(pitchAngle),
        r.targetFlightDir.z * Math.sin(pitchAngle)
      ).normalize();

      // ?쇱튂?ㅻ쾭 以? ?섑룊?쇰줈留??대룞, Y=0 怨좊룄 ?좎? (30째 ?꾩뿉 ???꾨떖 諛⑹?)
      const pitchSpeed = ROCKET_SPEED * (1.0 - LAUNCH_DRAG_FACTOR);
      body.setLinvel({
        x: r.thrustDir.x * pitchSpeed,
        y: 0,
        z: r.thrustDir.z * pitchSpeed
      }, true);

      const posPitch = body.translation();
      r.position.set(posPitch.x, posPitch.y, posPitch.z);

      // ??愿??諛⑹?: ?쇱튂?ㅻ쾭 以???硫??꾨떖 ??利됱떆 遺꾨━
      const pitchDomeY = domeYAt(r.position.x, r.position.z);
      if (r.position.y >= pitchDomeY) {
        r.position.y = pitchDomeY;
        body.setTranslation({ x: r.position.x, y: pitchDomeY, z: r.position.z }, true);
        const pitchVel = body.linvel();
        body.setLinvel({ x: pitchVel.x, y: 0, z: pitchVel.z }, true);
        r.pitchoverDir = r.thrustDir.clone();
        r.sepVel = { x: pitchVel.x, y: 0, z: pitchVel.z };
        r.state      = "SEPARATION";
        r.stageTimer = 0;
        startStageSeparation(r);
      } else {
        // 濡쒖폆 ?먯꽭瑜?thrustDir濡?鍮좊Ⅴ寃??뺣젹
        const tqPitch = new THREE.Quaternion().setFromUnitVectors(_UP, r.thrustDir);
        r.mesh.quaternion.slerp(tqPitch, 8.0 * deltaSeconds);

        r.smokeTimer += deltaSeconds;
        if (r.smokeTimer > 0.04) {
          spawnSmoke(r.position.clone().addScaledVector(r.thrustDir.clone().negate(), S(0.07)));
          r.smokeTimer = 0;
        }

        // 30째 ?꾨떖 ??遺꾨━ (?먮뒗 理쒕? ?쒓컙 珥덇낵)
        if (pitchAngle >= PITCHOVER_SEP_ANGLE || r.stageTimer >= PITCHOVER_DURATION) {
          r.pitchoverDir = r.thrustDir.clone();
          const cv = body.linvel();
          r.sepVel = { x: cv.x, y: cv.y, z: cv.z };
          r.state      = "SEPARATION";
          r.stageTimer = 0;
          startStageSeparation(r);
        }
      }

    // ?? SEPARATION: 1??遺꾨━ ??????????????????????????????
    } else if (r.state === "SEPARATION") {
      r.stageTimer += deltaSeconds;

      // 遺꾨━ 以?愿???좎?: ??λ맂 ?띾룄 洹몃?濡??좎? (以묐젰???섑븳 媛먯냽 諛⑹?)
      if (r.sepVel) body.setLinvel(r.sepVel, true);

      const pos = body.translation();
      r.position.set(pos.x, pos.y, pos.z);

      // 遺꾨━ ?뚰떚??
      if (r.stageTimer < SEP_DURATION * 0.7) {
        r.smokeTimer += deltaSeconds;
        if (r.smokeTimer > 0.025) {
          spawnSepParticle(r.position.clone());
          r.smokeTimer = 0;
        }
      }

      // 遺꾨━ ?꾨즺 ??2???먰솕
      if (r.stageTimer >= SEP_DURATION) {
        r.state      = "STAGE2";
        r.stageTimer = 0;
        if (r.flame2) r.flame2.visible = true;
      }

    // ?? STAGE2: 2???먰솕 ??沅곸갹源뚯? ?곸듅 (?곗냽 以묐젰 ?좏쉶) ????
    } else if (r.state === "STAGE2") {
      r.stageTimer += deltaSeconds;

      // ?곗냽 以묐젰 ?좏쉶: 遺꾨━ ??媛곷룄(30째)?먯꽌 ???묎렐源뚯? 遺?쒕읇寃?湲곗슱湲?利앷?
      const domeY2 = domeYAt(r.position.x, r.position.z);
      const altFrac2 = Math.min(1, Math.max(0,
        (r.position.y - r.startPos.y) / Math.max(0.001, domeY2 - r.startPos.y)
      ));
      // 80%??00% 援ш컙??0??濡?留ㅽ븨, 30째??2째源뚯? 遺?쒕읇寃?利앷?
      const stage2Progress = Math.min(1, (altFrac2 - STAGE1_ALT_TRIGGER) / (1.0 - STAGE1_ALT_TRIGGER));
      const stage2Angle = PITCHOVER_SEP_ANGLE + stage2Progress * stage2Progress * (PITCHOVER_ANGLE - PITCHOVER_SEP_ANGLE);
      const stage2Dir = new THREE.Vector3(
        r.targetFlightDir.x * Math.sin(stage2Angle),
        Math.cos(stage2Angle),
        r.targetFlightDir.z * Math.sin(stage2Angle)
      ).normalize();

      // ?먯쭊??媛?? 遺꾨━ ?띾룄 ??STAGE2_SPEED (0.8珥덉뿉 嫄몄퀜 ramp up)
      const rampT = Math.min(1.0, r.stageTimer / 0.8);
      const entrySpd = r.sepVel
        ? Math.hypot(r.sepVel.x, r.sepVel.y, r.sepVel.z)
        : ROCKET_SPEED;
      const rampSpeed = entrySpd + (STAGE2_SPEED - entrySpd) * rampT;

      body.setLinvel({
        x: stage2Dir.x * rampSpeed,
        y: stage2Dir.y * rampSpeed,
        z: stage2Dir.z * rampSpeed
      }, true);

      const pos2 = body.translation();
      r.position.set(pos2.x, pos2.y, pos2.z);

      // 濡쒖폆 諛⑺뼢: 2??異붾젰 諛⑺뼢?쇰줈 湲곗슱湲?
      const tq2 = new THREE.Quaternion().setFromUnitVectors(_UP, stage2Dir);
      r.mesh.quaternion.slerp(tq2, 6.0 * deltaSeconds);

      // 2??諛곌린 ?곌린
      r.smokeTimer += deltaSeconds;
      if (r.smokeTimer > 0.035) {
        spawnSmoke(r.position.clone().addScaledVector(stage2Dir.clone().negate(), S(0.05)));
        r.smokeTimer = 0;
      }

      // 沅곸갹 ?묒큺(Y ?대옩?? ?먮뒗 ?곗냼 ?쒓컙 珥덇낵 ??SCRAPE
      if (r.position.y >= domeY2 || r.stageTimer >= STAGE2_DURATION) {
        // 愿??諛⑹?: Y瑜???硫댁뿉 怨좎젙
        r.position.y = Math.min(r.position.y, domeY2);
        body.setTranslation({ x: r.position.x, y: r.position.y, z: r.position.z }, true);
        r.state = "SCRAPE";
        r.scrapeTimer = 0;
        if (r.membraneMesh) r.membraneMesh.visible = true;
        // ?꾩옱 ?섑룊 ?띾룄 洹몃?濡??좎? (?띾룄 ?먰봽 ?놁씠 ?먯뿰?ㅻ읇寃?SCRAPE 吏꾩엯)
        const curVel = body.linvel();
        const hSpd = Math.hypot(curVel.x, curVel.z);
        const sDir = hSpd > 0.01
          ? new THREE.Vector3(curVel.x / hSpd, 0, curVel.z / hSpd)
          : r.targetFlightDir.clone();
        const scrapeEntrySpd = Math.max(hSpd, SCRAPE_SPEED * 0.4);
        body.setLinvel({
          x: sDir.x * scrapeEntrySpd,
          y: 0,
          z: sDir.z * scrapeEntrySpd
        }, true);
      }

    // ?? LAUNCH: ?⑥씪 ?④퀎 ?섏쭅 ?곸듅 ??????????????????????
    } else if (r.state === "LAUNCH") {
      const domeTopY = domeYAt(r.position.x, r.position.z);
      const altFrac  = Math.min(1.0, Math.max(0,
        (r.position.y - r.startPos.y) / Math.max(0.001, domeTopY - r.startPos.y)
      ));
      const launchSpeed = ROCKET_SPEED * (1.0 - LAUNCH_DRAG_FACTOR * altFrac);
      body.setLinvel({ x: 0, y: launchSpeed, z: 0 }, true);

      const pos = body.translation();
      r.position.set(pos.x, pos.y, pos.z);

      r.mesh.quaternion.setFromUnitVectors(_UP, new THREE.Vector3(0, 1, 0));

      r.smokeTimer += deltaSeconds;
      if (r.smokeTimer > 0.05) {
        spawnSmoke(r.position.clone().addScaledVector(new THREE.Vector3(0, -1, 0), S(0.04)));
        r.smokeTimer = 0;
      }

      const domeY = domeYAt(r.position.x, r.position.z);
      if (r.position.y >= domeY - S(0.04)) {
        r.state = "SCRAPE";
        r.scrapeTimer = 0;
        if (r.membraneMesh) r.membraneMesh.visible = true;
        body.setLinvel({
          x: r.targetFlightDir.x * SCRAPE_SPEED,
          y: 0,
          z: r.targetFlightDir.z * SCRAPE_SPEED
        }, true);
      }

    // ?? SCRAPE: ???쒕㈃ ?щ씪?대뵫 (?붿뿬異붿쭊??+ ?좎껜??? ??
    } else if (r.state === "SCRAPE") {
      // ?붿뿬 異붿쭊?? 2???곕즺 ?뚯쭊 ?꾧퉴吏 ?ㅻ뵫 諛⑺뼢?쇰줈 怨꾩냽 諛湲?
      const fuelLeft = Math.max(0, 1.0 - r.scrapeTimer / SCRAPE_FUEL_DURATION);
      body.applyForce({
        x: r.targetFlightDir.x * SCRAPE_RESIDUAL_THRUST * fuelLeft,
        y: 0,
        z: r.targetFlightDir.z * SCRAPE_RESIDUAL_THRUST * fuelLeft
      }, true);

      // 沅곸갹 ?좎껜??? ?댁감(?띾룄짼) + ?좏삎(?먯꽦)
      const velPre = body.linvel();
      const hSpeed = Math.hypot(velPre.x, velPre.z);
      if (hSpeed > 0.0001) {
        const fluidForce = DOME_FLUID_DRAG * hSpeed * hSpeed
                         + DOME_VISCOUS_DRAG * hSpeed;
        body.applyForce({
          x: -(velPre.x / hSpeed) * fluidForce,
          y: 0,
          z: -(velPre.z / hSpeed) * fluidForce
        }, true);
      }

      const pos = body.translation();
      r.position.set(pos.x, pos.y, pos.z);

      // ???쒕㈃??Y 怨좎젙 (?몃씪?대찓???놁씠 肄붾뱶濡??쒖뼱)
      const scrDomeY = domeYAt(r.position.x, r.position.z);
      if (r.position.y !== scrDomeY) {
        r.position.y = scrDomeY;
        body.setTranslation({ x: r.position.x, y: scrDomeY, z: r.position.z }, true);
        const vSnap = body.linvel();
        body.setLinvel({ x: vSnap.x, y: 0, z: vSnap.z }, true);
      }

      const vel = body.linvel();
      r.velocity.set(vel.x, vel.y, vel.z);

      const moveDir = new THREE.Vector3(vel.x, vel.y, vel.z);
      if (moveDir.lengthSq() > 0.001) {
        moveDir.normalize();
        r.mesh.quaternion.slerp(
          new THREE.Quaternion().setFromUnitVectors(_UP, moveDir),
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
        spawnSmoke(r.position.clone().addScaledVector(tailDir, S(0.04)));
        r.smokeTimer = 0;
      }

      r.scrapeTimer += deltaSeconds;

      // ??寃쎄퀎 ?댄깉 (?덉쟾?μ튂)
      const outsideDome = (r.position.x * r.position.x + r.position.z * r.position.z)
        >= constants.DOME_RADIUS * constants.DOME_RADIUS * 0.97;

      // ?좎껜???쑝濡?媛먯냽 ???뺤? ?먮뒗 ???댄깉 ???숉븯
      const finalVel = body.linvel();
      const finalHSpeed = Math.hypot(finalVel.x, finalVel.z);
      const stoppedByFluid = finalHSpeed < S(0.01);
      if (stoppedByFluid || r.scrapeTimer >= SCRAPE_FUEL_DURATION || outsideDome) {
        r.state = "FALL";
        if (r.membraneMesh) r.membraneMesh.visible = false;
      }

    // ?? FALL: ?숉븯 ???????????????????????????????????????
    } else if (r.state === "FALL") {
      const vel  = body.linvel();
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
        r.mesh.quaternion.setFromUnitVectors(_UP, r.velocity.clone().normalize());
      }

      r.smokeTimer += deltaSeconds;
      if (r.smokeTimer > 0.05) {
        const tailDir = r.velocity.clone().negate().normalize();
        spawnSmoke(r.position.clone().addScaledVector(tailDir, S(0.04)));
        r.smokeTimer = 0;
      }

      if (r.position.y <= constants.SURFACE_Y) {
        physics.world.removeRigidBody(body);
        scalableStage.remove(r.mesh);
        rockets.splice(arrayIndex, 1);
        return true;
      }
    }

    return false;
  }

  // ?????????????????????????????????????????????????????
  //  Fallback 臾쇰━ (Rapier 誘몃줈????
  // ?????????????????????????????????????????????????????
  function updateRocketFallback(r, deltaSeconds, arrayIndex) {
    const domeRadius   = constants.DOME_RADIUS;
    const domeBaseY    = constants.DOME_BASE_Y;
    const domeVertScale = constants.DOME_VERTICAL_SCALE;

    function fbDomeYAt(x, z) {
      const rSq = x * x + z * z;
      return domeBaseY + domeVertScale * Math.sqrt(Math.max(0, domeRadius * domeRadius - rSq));
    }

    // ?? STAGE1 ?대갚 ???곗냽 以묐젰 ?좏쉶 (?щЪ??沅ㅻ룄) ??????????
    if (r.state === "STAGE1") {
      r.stageTimer += deltaSeconds;

      const fbDomeH1 = fbDomeYAt(r.position.x, r.position.z);
      const fbAlt1   = Math.min(1, Math.max(0,
        (r.position.y - r.startPos.y) / Math.max(0.001, fbDomeH1 - r.startPos.y)
      ));

      // ?곗냽 以묐젰 ?좏쉶: 怨좊룄???곕씪 0째 ??30째 ?щЪ??湲곗슱湲?
      const fbTurnP = Math.min(1, fbAlt1 / STAGE1_ALT_TRIGGER);
      const fbPitchA = fbTurnP * fbTurnP * PITCHOVER_SEP_ANGLE;
      r.thrustDir.set(
        r.targetFlightDir.x * Math.sin(fbPitchA),
        Math.cos(fbPitchA),
        r.targetFlightDir.z * Math.sin(fbPitchA)
      ).normalize();

      const fbClimb = ROCKET_SPEED * (1.0 - LAUNCH_DRAG_FACTOR * fbAlt1);
      r.velocity.set(
        r.thrustDir.x * fbClimb,
        r.thrustDir.y * fbClimb,
        r.thrustDir.z * fbClimb
      );
      r.position.addScaledVector(r.velocity, deltaSeconds);

      const fbTq1 = new THREE.Quaternion().setFromUnitVectors(_UP, r.thrustDir);
      r.mesh.quaternion.slerp(fbTq1, 5.0 * deltaSeconds);

      r.smokeTimer += deltaSeconds;
      if (r.smokeTimer > 0.05) {
        spawnSmoke(r.position.clone().addScaledVector(r.thrustDir.clone().negate(), S(0.06)));
        r.smokeTimer = 0;
      }

      // ??愿??諛⑹?
      if (r.position.y >= fbDomeH1) {
        r.position.y = fbDomeH1;
        r.pitchoverDir = r.thrustDir.clone();
        r.sepVel = { x: r.velocity.x, y: 0, z: r.velocity.z };
        r.state = "SEPARATION"; r.stageTimer = 0;
        startStageSeparation(r);
      } else {
        const fbDomeFrac = fbAlt1;
        if (fbDomeFrac >= STAGE1_ALT_TRIGGER || r.stageTimer >= STAGE1_DURATION) {
          r.pitchoverDir = r.thrustDir.clone();
          r.sepVel = { x: r.velocity.x, y: r.velocity.y, z: r.velocity.z };
          r.state = "SEPARATION"; r.stageTimer = 0;
          startStageSeparation(r);
        }
      }

    // ?? PITCHOVER ?대갚: ?먯꽭 ?쒖뼱 ???????????????????????????
    } else if (r.state === "PITCHOVER") {
      r.stageTimer += deltaSeconds;

      const fbPitchFrac  = Math.min(1.0, r.stageTimer / PITCHOVER_DURATION);
      const fbPitchAngle = fbPitchFrac * PITCHOVER_ANGLE;
      r.thrustDir.set(
        r.targetFlightDir.x * Math.sin(fbPitchAngle),
        Math.cos(fbPitchAngle),
        r.targetFlightDir.z * Math.sin(fbPitchAngle)
      ).normalize();

      const fbPitchSpeed = ROCKET_SPEED * (1.0 - LAUNCH_DRAG_FACTOR);
      r.velocity.set(
        r.thrustDir.x * fbPitchSpeed,
        0,
        r.thrustDir.z * fbPitchSpeed
      );
      r.position.addScaledVector(r.velocity, deltaSeconds);

      // ??愿??諛⑹?: ?쇱튂?ㅻ쾭 以???硫??꾨떖 ??利됱떆 遺꾨━
      const fbPitchDomeY = fbDomeYAt(r.position.x, r.position.z);
      if (r.position.y >= fbPitchDomeY) {
        r.position.y = fbPitchDomeY;
        r.pitchoverDir = r.thrustDir.clone();
        r.sepVel = { x: r.velocity.x, y: 0, z: r.velocity.z };
        r.velocity.set(r.velocity.x, 0, r.velocity.z);
        r.state      = "SEPARATION";
        r.stageTimer = 0;
        startStageSeparation(r);
      } else {
        const tqPitch = new THREE.Quaternion().setFromUnitVectors(_UP, r.thrustDir);
        r.mesh.quaternion.slerp(tqPitch, 8.0 * deltaSeconds);

        r.smokeTimer += deltaSeconds;
        if (r.smokeTimer > 0.05) {
          spawnSmoke(r.position.clone().addScaledVector(r.thrustDir.clone().negate(), S(0.06)));
          r.smokeTimer = 0;
        }

        if (fbPitchAngle >= PITCHOVER_SEP_ANGLE || r.stageTimer >= PITCHOVER_DURATION) {
          r.pitchoverDir = r.thrustDir.clone();
          r.sepVel = { x: r.velocity.x, y: r.velocity.y, z: r.velocity.z };
          r.state      = "SEPARATION";
          r.stageTimer = 0;
          startStageSeparation(r);
        }
      }

    // ?? SEPARATION ?대갚 ??????????????????????????????????
    } else if (r.state === "SEPARATION") {
      r.stageTimer += deltaSeconds;
      // 遺꾨━ 以??띾룄 ?좎? (愿??肄붿뒪??
      if (r.sepVel) {
        r.velocity.set(r.sepVel.x, r.sepVel.y, r.sepVel.z);
        r.position.addScaledVector(r.velocity, deltaSeconds);
      }
      if (r.stageTimer >= SEP_DURATION) {
        r.state      = "STAGE2";
        r.stageTimer = 0;
        if (r.flame2) r.flame2.visible = true;
      }

    // ?? STAGE2 ?대갚 ??沅곸갹源뚯? ?곸듅 (?곗냽 以묐젰 ?좏쉶) ??????
    } else if (r.state === "STAGE2") {
      r.stageTimer += deltaSeconds;
      // ?곗냽 以묐젰 ?좏쉶: 怨좊룄 湲곕컲?쇰줈 30째??2째 遺?쒕읇寃?利앷?
      const fbDomeH2 = fbDomeYAt(r.position.x, r.position.z);
      const fbAltFrac2 = Math.min(1, Math.max(0,
        (r.position.y - r.startPos.y) / Math.max(0.001, fbDomeH2 - r.startPos.y)
      ));
      const fbS2Progress = Math.min(1, (fbAltFrac2 - STAGE1_ALT_TRIGGER) / (1.0 - STAGE1_ALT_TRIGGER));
      const fbS2Angle = PITCHOVER_SEP_ANGLE + fbS2Progress * fbS2Progress * (PITCHOVER_ANGLE - PITCHOVER_SEP_ANGLE);
      const stage2Dir = new THREE.Vector3(
        r.targetFlightDir.x * Math.sin(fbS2Angle),
        Math.cos(fbS2Angle),
        r.targetFlightDir.z * Math.sin(fbS2Angle)
      ).normalize();

      const fbRampT = Math.min(1.0, r.stageTimer / 0.8);
      const fbEntrySpd = r.sepVel
        ? Math.hypot(r.sepVel.x, r.sepVel.y, r.sepVel.z)
        : ROCKET_SPEED;
      const fbRampSpeed = fbEntrySpd + (STAGE2_SPEED - fbEntrySpd) * fbRampT;
      r.velocity.set(
        stage2Dir.x * fbRampSpeed,
        stage2Dir.y * fbRampSpeed,
        stage2Dir.z * fbRampSpeed
      );
      r.position.addScaledVector(r.velocity, deltaSeconds);

      const tq2 = new THREE.Quaternion().setFromUnitVectors(_UP, stage2Dir);
      r.mesh.quaternion.slerp(tq2, 6.0 * deltaSeconds);

      r.smokeTimer += deltaSeconds;
      if (r.smokeTimer > 0.035) {
        spawnSmoke(r.position.clone().addScaledVector(stage2Dir.clone().negate(), S(0.05)));
        r.smokeTimer = 0;
      }

      if (r.position.y >= fbDomeH2 || r.stageTimer >= STAGE2_DURATION) {
        r.position.y = Math.min(r.position.y, fbDomeH2);
        r.state = "SCRAPE";
        r.scrapeTimer = 0;
        if (r.membraneMesh) r.membraneMesh.visible = true;
        const fbHSpd = Math.hypot(r.velocity.x, r.velocity.z);
        const fbSDir = fbHSpd > 0.01
          ? new THREE.Vector3(r.velocity.x / fbHSpd, 0, r.velocity.z / fbHSpd)
          : r.targetFlightDir.clone();
        const fbScrapeEntrySpd = Math.max(fbHSpd, SCRAPE_SPEED * 0.4);
        r.velocity.set(
          fbSDir.x * fbScrapeEntrySpd, 0,
          fbSDir.z * fbScrapeEntrySpd
        );
      }

    // ?? LAUNCH ?대갚 ??????????????????????????????????????
    } else if (r.state === "LAUNCH") {
      const fbDomeH  = fbDomeYAt(r.position.x, r.position.z);
      const fbAltFrac = Math.min(1.0, Math.max(0,
        (r.position.y - r.startPos.y) / Math.max(0.001, fbDomeH - r.startPos.y)
      ));
      const fbSpeed = ROCKET_SPEED * (1.0 - LAUNCH_DRAG_FACTOR * fbAltFrac);
      r.velocity.set(0, fbSpeed, 0);
      r.position.addScaledVector(r.velocity, deltaSeconds);
      r.mesh.quaternion.setFromUnitVectors(_UP, new THREE.Vector3(0, 1, 0));

      r.smokeTimer += deltaSeconds;
      if (r.smokeTimer > 0.05) {
        spawnSmoke(r.position.clone().addScaledVector(new THREE.Vector3(0, -1, 0), S(0.04)));
        r.smokeTimer = 0;
      }

      if (r.position.y >= fbDomeH) {
        r.position.y = fbDomeH;
        r.state = "SCRAPE";
        r.scrapeTimer = 0;
        r.velocity.set(0, 0, 0);
        if (r.membraneMesh) r.membraneMesh.visible = true;
      } else if (r.position.y < constants.SURFACE_Y) {
        scalableStage.remove(r.mesh);
        rockets.splice(arrayIndex, 1);
        return true;
      }

    // ?? SCRAPE ?대갚 (?붿뿬異붿쭊??+ ?좎껜??? ?????????????
    } else if (r.state === "SCRAPE") {
      // ?붿뿬 異붿쭊??
      const fbFuelLeft = Math.max(0, 1.0 - r.scrapeTimer / SCRAPE_FUEL_DURATION);
      r.velocity.x += r.targetFlightDir.x * SCRAPE_RESIDUAL_THRUST * fbFuelLeft * deltaSeconds;
      r.velocity.z += r.targetFlightDir.z * SCRAPE_RESIDUAL_THRUST * fbFuelLeft * deltaSeconds;

      // ?좎껜???쑝濡?媛먯냽
      const fbHSpd = Math.hypot(r.velocity.x, r.velocity.z);
      if (fbHSpd > 0.0001) {
        const fbForce = DOME_FLUID_DRAG * fbHSpd * fbHSpd
                      + DOME_VISCOUS_DRAG * fbHSpd;
        const fbDecel = fbForce * deltaSeconds; // a*dt 諛⑹떇
        const fbClamp = Math.min(fbDecel, fbHSpd * 0.95);
        r.velocity.x -= (r.velocity.x / fbHSpd) * fbClamp;
        r.velocity.z -= (r.velocity.z / fbHSpd) * fbClamp;
      }

      const oldPos = r.position.clone();
      r.position.x += r.velocity.x * deltaSeconds;
      r.position.z += r.velocity.z * deltaSeconds;

      const xSq = r.position.x * r.position.x, zSq = r.position.z * r.position.z;
      const rSq = domeRadius * domeRadius;
      r.position.y = (xSq + zSq <= rSq)
        ? domeBaseY + domeVertScale * Math.sqrt(rSq - xSq - zSq)
        : domeBaseY;

      const moveDelta    = r.position.clone().sub(oldPos);
      const actualVelocity = moveDelta.clone().divideScalar(Math.max(0.0001, deltaSeconds));
      const moveDir      = moveDelta.clone();
      if (moveDir.lengthSq() > 0.0001) {
        moveDir.normalize();
        r.mesh.quaternion.slerp(
          new THREE.Quaternion().setFromUnitVectors(_UP, moveDir), 8.0 * deltaSeconds
        );
      }

      r.wakeTimer += deltaSeconds;
      if (r.wakeTimer > 0.01) { spawnWake(r.position, moveDir); r.wakeTimer = 0; }
      r.smokeTimer += deltaSeconds;
      if (r.smokeTimer > 0.05) {
        spawnSmoke(r.position.clone().addScaledVector(moveDir.clone().negate(), S(0.04)));
        r.smokeTimer = 0;
      }

      r.scrapeTimer += deltaSeconds;

      const fbOutsideDome = (r.position.x * r.position.x + r.position.z * r.position.z)
        >= domeRadius * domeRadius * 0.97;

      const fbFinalHSpd = Math.hypot(r.velocity.x, r.velocity.z);
      const fbStopped = fbFinalHSpd < S(0.01);
      if (fbStopped || r.scrapeTimer >= SCRAPE_FUEL_DURATION || fbOutsideDome) {
        r.state = "FALL";
        if (r.membraneMesh) r.membraneMesh.visible = false;
        r.velocity.copy(actualVelocity);
      }

    // ?? FALL ?대갚 ?????????????????????????????????????????
    } else if (r.state === "FALL") {
      r.velocity.y -= GRAVITY * deltaSeconds;
      const speed = r.velocity.length();
      if (speed > 0.0001) {
        const dragDecel = AIR_DRAG * speed * speed * deltaSeconds;
        r.velocity.addScaledVector(r.velocity.clone().normalize(), -Math.min(dragDecel, speed));
      }
      r.position.addScaledVector(r.velocity, deltaSeconds);
      if (r.velocity.lengthSq() > 0.0001) {
        r.mesh.quaternion.setFromUnitVectors(_UP, r.velocity.clone().normalize());
      }
      r.smokeTimer += deltaSeconds;
      if (r.smokeTimer > 0.05) {
        spawnSmoke(r.position.clone().addScaledVector(r.velocity.clone().negate().normalize(), S(0.04)));
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

  function getTelemetry() {
    if (rockets.length === 0) return null;
    const r = rockets[rockets.length - 1]; // 媛??理쒓렐 濡쒖폆
    const speed = r.velocity
      ? Math.hypot(r.velocity.x, r.velocity.y, r.velocity.z)
      : (r.rigidBody ? (() => { const v = r.rigidBody.linvel(); return Math.hypot(v.x, v.y, v.z); })() : 0);
    const domeY = domeYAt(r.position.x, r.position.z);
    const altPct = Math.max(0, Math.min(100,
      ((r.position.y - (r.startPos?.y ?? 0)) / Math.max(0.001, domeY - (r.startPos?.y ?? 0))) * 100
    ));
    return {
      state:     r.state,
      isTwoStage: r.isTwoStage,
      altitude:  altPct.toFixed(1),          // % of dome height
      speed:     (speed * 1000).toFixed(1),  // scaled for readability
      stageTimer: (r.stageTimer ?? 0).toFixed(1),
      scrapeTimer: (r.scrapeTimer ?? 0).toFixed(1),
      debrisCount: debris.length,
    };
  }

  return { update, launchRocket, getTelemetry };
}

