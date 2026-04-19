import * as THREE from "../vendor/three.module.js";
import { getProjectedPositionFromGeo } from "./geo-utils.js";

const DEFAULT_MISSION_PROFILE_ID = "default";
const ARTEMIS_II_MISSION_PROFILE_ID = "artemis-ii";
const ARTEMIS_II_SPACEPORT = {
  name: "LC-39B / Kennedy Space Center",
  lat: 28.608,
  lon: -80.604,
  heading: 90
};

export const ROCKET_MISSION_PROFILES = [
  { id: DEFAULT_MISSION_PROFILE_ID, label: "Default Launch" },
  { id: ARTEMIS_II_MISSION_PROFILE_ID, label: "Artemis II" }
];

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
  constants,
  domeWaterApi = null
}) {
  const rockets  = [];
  const debris   = [];   // falling stage-1 bodies after separation
  const wakes    = [];
  const smokes   = [];
  let standbyRocket = null;
  let lastCompletedLaunchpadName = "";

  const S = v => constants.scaleDimension(v);
  function getRocketLaunchDisplayName(record) {
    if (!record) {
      return "";
    }

    return record.missionLabel
      ? `${record.missionLabel} · ${record.launchpadName ?? ""}`
      : (record.launchpadName ?? "");
  }

  function getRocketVelocity(r) {
    if (r.rigidBody) {
      const velocity = r.rigidBody.linvel();
      tempSnapshotVelocity.set(velocity.x, velocity.y, velocity.z);
      return tempSnapshotVelocity;
    }

    tempSnapshotVelocity.copy(r.velocity ?? tempSnapshotVelocity.set(0, 0, 0));
    return tempSnapshotVelocity;
  }

  function buildRocketSnapshot(record, stateOverride = null) {
    if (!record) {
      return null;
    }

    const snapshotState = stateOverride ?? record.state;
    const velocity = getRocketVelocity(record);
    const speed = velocity.length();
    tempSnapshotUp.copy(_UP).applyQuaternion(record.mesh.quaternion).normalize();
    if (speed > 0.0001) {
      tempSnapshotForward.copy(velocity).normalize();
    } else if (snapshotState === "STANDBY") {
      tempHeadingUp.set(record.targetFlightDir.x, 0.12, record.targetFlightDir.z).normalize();
      tempSnapshotForward.copy(tempHeadingUp);
    } else if (record.thrustDir?.lengthSq?.() > 0) {
      tempSnapshotForward.copy(record.thrustDir).normalize();
    } else {
      tempSnapshotForward.copy(tempSnapshotUp);
    }

    tempSnapshotLookTarget.copy(getRocketDisplayPosition(record, snapshotState));
    if (snapshotState === "STANDBY") {
      tempSnapshotLookTarget.addScaledVector(tempSnapshotUp, S(0.07));
    } else if (snapshotState === "SCRAPE" || snapshotState === "FALL") {
      tempSnapshotLookTarget.addScaledVector(_UP, S(0.055));
      tempSnapshotLookTarget.addScaledVector(tempSnapshotForward, S(0.02));
    } else {
      tempSnapshotLookTarget.addScaledVector(_UP, S(0.03));
      tempSnapshotLookTarget.addScaledVector(tempSnapshotForward, S(0.045));
    }

    return {
      forward: tempSnapshotForward.clone(),
      headingDirection: record.targetFlightDir.clone(),
      ignitionProgress: THREE.MathUtils.clamp(
        (record.ignitionTimer ?? 0) / Math.max(record.ignitionDuration ?? 1, 0.0001),
        0,
        1
      ),
      launchpadName: record.launchpadName,
      lookTarget: tempSnapshotLookTarget.clone(),
      missionLabel: record.missionLabel ?? "",
      missionProfile: record.missionProfile ?? DEFAULT_MISSION_PROFILE_ID,
      engineHeat: record.engineHeat ?? 0,
      position: tempRocketAnchor.clone(),
      rocketType: record.rocketType,
      scrapeTimer: record.scrapeTimer ?? 0,
      spaceportIndex: record.spaceportIndex,
      stageTimer: record.stageTimer ?? 0,
      state: snapshotState,
      trackingEligible: Boolean(record.trackingEligible),
      up: tempSnapshotUp.clone(),
      vehicleLabel: record.vehicleLabel ?? "",
      velocity: velocity.clone()
    };
  }

  function getStandbySnapshot() {
    return buildRocketSnapshot(standbyRocket, "STANDBY");
  }

  function getActiveRocketSnapshot() {
    if (rockets.length === 0) {
      return null;
    }
    return buildRocketSnapshot(rockets[rockets.length - 1]);
  }

  function handleRocketRemoval(r, arrayIndex, body = null) {
    if (body && physics) {
      physics.world.removeRigidBody(body);
    }
    removeLaunchTower(r);
    scalableStage.remove(r.mesh);
    rockets.splice(arrayIndex, 1);
    if (rockets.length === 0 && !standbyRocket) {
      lastCompletedLaunchpadName = getRocketLaunchDisplayName(r);
    }
    return true;
  }
  const tempHeadingUp = new THREE.Vector3();
  const tempHorizontalDir = new THREE.Vector3();
  const tempImpactVelocity = new THREE.Vector3();
  const tempProjectedScrapeDir = new THREE.Vector3();
  const tempSnapshotUp = new THREE.Vector3();
  const tempSnapshotForward = new THREE.Vector3();
  const tempSnapshotVelocity = new THREE.Vector3();
  const tempSnapshotLookTarget = new THREE.Vector3();
  const tempSurfaceNormal = new THREE.Vector3();
  const tempDesiredFlightDir = new THREE.Vector3();
  const tempFlightBlendDir = new THREE.Vector3();
  const tempVelocityDirection = new THREE.Vector3();
  const tempStageEntryDirection = new THREE.Vector3();
  const tempScrapeTrailDirection = new THREE.Vector3();
  const tempScrapeTrailAnchor = new THREE.Vector3();
  const tempMembraneWorldPosition = new THREE.Vector3();
  const tempScrapeFallbackAnchor = new THREE.Vector3();
  const STAGE1_TURN_RATE = 2.8;
  const STAGE2_TURN_RATE = 1.9;
  const LAUNCH_TURN_RATE = 2.4;
  const LAUNCH_TOWER_RELEASE_DURATION = 0.9;

  // ── Physics constants ──
  const WAKE_DURATION     = 1.0;
  const SMOKE_DURATION    = 1.2;
  const IGNITION_STEAM_INTERVAL_SCALE = 0.68;
  const IGNITION_EXHAUST_INTERVAL_SCALE = 0.5;
  const ASCENT_EXHAUST_INTERVAL_SCALE = 0.55;
  const FALL_SMOKE_INTERVAL_SCALE = 0.7;
  const ASCENT_EXHAUST_BURST_MULTIPLIER = 2.8;
  const GRAVITY           = S(4.5);
  const AIR_DRAG          = 3.5;
  // Legacy (single-stage / SCRAPE / FALL)
  const ROCKET_SPEED      = S(0.7);   // 1단 상승 속도 (감속)
  const SCRAPE_SPEED      = S(1.4);   // 궁창 긁기 초기 속도
  const SCRAPE_RESIDUAL_THRUST = S(5.0);  // 궁창 긁기 잔여 추진력 (2단 연료 잔존)
  const DOME_FLUID_DRAG   = 4.0;          // 궁창 유체 저항 계수 (이차)
  const DOME_VISCOUS_DRAG = 0.8;          // 궁창 점성 저항 계수 (선형)
  const LAUNCH_DRAG_FACTOR = 0.12;
  const DOME_WATER_ENTRY_DRAG = constants.DOME_WATER_ENTRY_DRAG ?? 0.58;
  const DOME_WATER_PLANING_DURATION = constants.DOME_WATER_PLANING_DURATION ?? 1.5;
  const DOME_WATER_PLANING_DRAG_MULTIPLIER = constants.DOME_WATER_PLANING_DRAG_MULTIPLIER ?? 0.42;
  const DOME_WATER_PLANING_VISCOUS_MULTIPLIER = constants.DOME_WATER_PLANING_VISCOUS_MULTIPLIER ?? 0.58;
  const DOME_WATER_PLANING_MIN_SPEED = constants.DOME_WATER_PLANING_MIN_SPEED ?? S(0.44);
  const DOME_WATER_STOP_SPEED = constants.DOME_WATER_STOP_SPEED ?? S(0.012);
  const DOME_WATER_SPRAY_LIFETIME = constants.DOME_WATER_SPRAY_LIFETIME ?? 0.78;
  const DOME_WATER_RIPPLE_BURST_DURATION = constants.DOME_WATER_RIPPLE_BURST_DURATION ?? 0.72;
  const DOME_WATER_TRAIL_EMIT_INTERVAL = (constants.DOME_WATER_TRAIL_EMIT_INTERVAL ?? 0.05)
    * (constants.DOME_WATER_TRAIL_EMIT_SCALE ?? 1.35)
    * 1.1;
  const DOME_WATER_TRAIL_WIDTH = constants.DOME_WATER_TRAIL_WIDTH ?? 0.048;
  const DOME_WATER_TRAIL_LENGTH = constants.DOME_WATER_TRAIL_LENGTH ?? 0.3;
  const DOME_WATER_TRAIL_WIDTH_SPEED_FACTOR = constants.DOME_WATER_TRAIL_WIDTH_SPEED_FACTOR ?? 0.05;
  const DOME_WATER_TRAIL_LENGTH_SPEED_FACTOR = constants.DOME_WATER_TRAIL_LENGTH_SPEED_FACTOR ?? 0.18;
  const DOME_WATER_TRAIL_END_FADE_DURATION = constants.DOME_WATER_TRAIL_END_FADE_DURATION ?? 0.52;
  const DOME_WATER_TRAIL_END_FADE_SPEED = constants.DOME_WATER_TRAIL_END_FADE_SPEED ?? S(0.11);
  const ROCKET_SCRAPE_TRAIL_NOSE_OFFSET = constants.ROCKET_SCRAPE_TRAIL_NOSE_OFFSET ?? S(0.07);
  const ROCKET_SCRAPE_TRAIL_LENGTH_MIN_SCALE = constants.ROCKET_SCRAPE_TRAIL_LENGTH_MIN_SCALE ?? 1.45;
  const ROCKET_SCRAPE_TRAIL_LENGTH_VISIBILITY_FLOOR = constants.ROCKET_SCRAPE_TRAIL_LENGTH_VISIBILITY_FLOOR ?? 0.82;
  const ROCKET_SCRAPE_TRAIL_HEAD_EXPANSION_BIAS = constants.ROCKET_SCRAPE_TRAIL_HEAD_EXPANSION_BIAS ?? 1.22;
  const ROCKET_SCRAPE_TRAIL_HEAD_GROWTH_MAX = constants.ROCKET_SCRAPE_TRAIL_HEAD_GROWTH_MAX ?? 1.42;
  const ROCKET_SCRAPE_TRAIL_TAIL_GROWTH_MAX = constants.ROCKET_SCRAPE_TRAIL_TAIL_GROWTH_MAX ?? 2.35;
  const ROCKET_SCRAPE_TRAIL_GROWTH_EASE = constants.ROCKET_SCRAPE_TRAIL_GROWTH_EASE ?? 1.22;
  // 2-stage maneuvering
  const STAGE2_SPEED      = S(1.8);   // 2단 추력 속도 (setLinvel)
  const STAGE1_DURATION   = 5.0;      // 1단 연소 최대 시간 (안전 fallback)
  const SEP_DURATION      = 0.35;     // 분리 연출 시간 (짧게 — 속도 유지로 자연스럽게)
  const STAGE2_DURATION   = 3.5;      // 2단 연소 최대 시간 (안전장치)
  const SCRAPE_FUEL_DURATION = 6.0;   // 궁창 긁기 지속 시간(초)
  const IGNITION_DURATION_DEFAULT = 4.0;
  const IGNITION_DURATION_SINGLE_STAGE = 3.2;
  const IGNITION_DURATION_SLS = 4.8;
  const STANDBY_VISUAL_LIFT_FADE_DURATION = 0.38;
  const PITCHOVER_ANGLE     = Math.PI / 2 * 0.80; // 최대 기울기: 72° (수직에서)
  const PITCHOVER_SEP_ANGLE = Math.PI / 6;        // 분리 각도: 30°
  const STAGE1_ALT_TRIGGER  = 0.80;               // 1단 분리 고도 비율 (80%)

  // ── Shared particle materials ──
  const sharedWakeGeo = new THREE.IcosahedronGeometry(S(0.012), 0);
  const sharedWakeMat = new THREE.MeshBasicMaterial({
    color: 0x88eeff, transparent: true, opacity: 0.6,
    depthWrite: false, blending: THREE.AdditiveBlending
  });
  const sharedSmokeGeo = new THREE.IcosahedronGeometry(S(0.015), 0);
  const sharedSmokeMat = new THREE.MeshBasicMaterial({
    color: 0xaaaaaa, transparent: true, opacity: 0.6, depthWrite: false
  });
  const sharedSteamMat = new THREE.MeshBasicMaterial({
    color: 0xf8fbff, transparent: true, opacity: 0.78, depthWrite: false
  });
  const sharedExhaustSmokeMat = new THREE.MeshBasicMaterial({
    color: 0xd8ddd8, transparent: true, opacity: 0.68, depthWrite: false
  });
  const sharedSprayMat = new THREE.MeshBasicMaterial({
    color: 0xbfeeff, transparent: true, opacity: 0.82,
    depthWrite: false, blending: THREE.AdditiveBlending
  });
  const sharedSepGeo = new THREE.IcosahedronGeometry(S(0.009), 0);
  const sharedSepMat = new THREE.MeshBasicMaterial({
    color: 0xffdd44, transparent: true, opacity: 1.0,
    depthWrite: false, blending: THREE.AdditiveBlending
  });

  // ─── Rapier world ───
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
    // 돔 트라이메시 콜라이더 제거: 돔 접촉은 domeYAt() 위치 검사로 코드 제어.
    // 물리 충돌 반응(튕김) 방지.
    world.createCollider(
      RAPIER.ColliderDesc
        .halfSpace(new RAPIER.Vector3(0, 1, 0))
        .setTranslation(0, constants.SURFACE_Y, 0)
        .setRestitution(0.0).setFriction(1.0)
    );
    physics = { world };
  }

  initPhysicsWorld();

  // ─── Helpers ───
  function domeYAt(x, z) {
    const R   = constants.DOME_RADIUS;
    const rSq = x * x + z * z;
    return constants.DOME_BASE_Y + constants.DOME_VERTICAL_SCALE * Math.sqrt(Math.max(0, R * R - rSq));
  }

  function getDomeSurfaceNormalAt(x, z, target = tempSurfaceNormal) {
    const y = domeYAt(x, z);
    const R  = constants.DOME_RADIUS;
    const b  = constants.DOME_VERTICAL_SCALE;
    // 타원체 implicit form: (x²+z²)/R² + (y-base)²/b² = 1 의 기울기 ∝ (x/R², (y-base)/b², z/R²)
    target.set(
      x / (R * R),
      (y - constants.DOME_BASE_Y) / (b * b),
      z / (R * R)
    );
    if (target.lengthSq() < 0.000001) {
      target.set(0, 1, 0);
    } else {
      target.normalize();
    }
    return target;
  }

  function getScrapeDirectionAt(x, z, incomingVelocity, fallbackDirection, target = tempProjectedScrapeDir) {
    target.copy(incomingVelocity ?? _UP);
    const surfaceNormal = getDomeSurfaceNormalAt(x, z);
    target.addScaledVector(surfaceNormal, -target.dot(surfaceNormal));

    tempHorizontalDir.set(target.x, 0, target.z);
    if (tempHorizontalDir.lengthSq() < 0.000001) {
      tempHorizontalDir.set(
        fallbackDirection?.x ?? 0,
        0,
        fallbackDirection?.z ?? 1
      );
    }

    if (tempHorizontalDir.lengthSq() < 0.000001) {
      tempHorizontalDir.set(0, 0, 1);
    } else {
      tempHorizontalDir.normalize();
    }

    target.set(tempHorizontalDir.x, 0, tempHorizontalDir.z);
    return target;
  }

  function computePitchProgramDirection(horizontalDir, pitchAngle, target = tempDesiredFlightDir) {
    target.set(
      horizontalDir.x * Math.sin(pitchAngle),
      Math.cos(pitchAngle),
      horizontalDir.z * Math.sin(pitchAngle)
    );

    if (target.lengthSq() < 0.000001) {
      target.copy(_UP);
    } else {
      target.normalize();
    }

    return target;
  }

  function initializeFlightDirection(record, fallbackDirection = _UP) {
    const currentVelocity = getRocketVelocity(record);
    if (currentVelocity.lengthSq() > 0.000001) {
      record.flightDir.copy(currentVelocity).normalize();
    } else if (record.flightDir.lengthSq() > 0.000001) {
      record.flightDir.normalize();
    } else if (fallbackDirection.lengthSq() > 0.000001) {
      record.flightDir.copy(fallbackDirection).normalize();
    } else {
      record.flightDir.copy(_UP);
    }

    return record.flightDir;
  }

  function steerFlightDirection(record, desiredDirection, deltaSeconds, turnRate) {
    record.desiredFlightDir.copy(desiredDirection);
    initializeFlightDirection(record, desiredDirection);

    const blend = 1 - Math.exp(-Math.max(0, turnRate) * deltaSeconds);
    tempFlightBlendDir.copy(record.flightDir).lerp(record.desiredFlightDir, blend);
    if (tempFlightBlendDir.lengthSq() < 0.000001) {
      tempFlightBlendDir.copy(record.desiredFlightDir);
    }

    record.flightDir.copy(tempFlightBlendDir.normalize());
    return record.flightDir;
  }

  function applyFlightVelocity(record, direction, speed, body = null) {
    record.velocity.copy(direction).multiplyScalar(speed);
    if (body) {
      body.setLinvel({
        x: record.velocity.x,
        y: record.velocity.y,
        z: record.velocity.z
      }, true);
    }

    return record.velocity;
  }

  function getRocketFlightProfile(record) {
    return record?.flightProfile ?? {};
  }

  function getRocketStage1AltTrigger(record) {
    return getRocketFlightProfile(record).stage1AltTrigger ?? STAGE1_ALT_TRIGGER;
  }

  function getRocketPitchoverSeparationAngle(record) {
    return getRocketFlightProfile(record).pitchoverSeparationAngle ?? PITCHOVER_SEP_ANGLE;
  }

  function getRocketMaxPitchAngle(record) {
    return getRocketFlightProfile(record).maxPitchAngle ?? PITCHOVER_ANGLE;
  }

  function getRocketStage1TurnRate(record) {
    return getRocketFlightProfile(record).stage1TurnRate ?? STAGE1_TURN_RATE;
  }

  function getRocketStage2TurnRate(record) {
    return getRocketFlightProfile(record).stage2TurnRate ?? STAGE2_TURN_RATE;
  }

  function getRocketStage1Speed(record) {
    return ROCKET_SPEED * (getRocketFlightProfile(record).stage1SpeedMultiplier ?? 1);
  }

  function getRocketStage2Speed(record) {
    return STAGE2_SPEED * (getRocketFlightProfile(record).stage2SpeedMultiplier ?? 1);
  }

  function createIgnitionOffsets(offsets) {
    return offsets.map(([x, y, z]) => new THREE.Vector3(S(x), S(y), S(z)));
  }

  function computeStandbyVisualLift(group, ignoredMeshes = []) {
    const ignoredSet = new Set(ignoredMeshes.filter(Boolean));
    const localBounds = new THREE.Box3();
    const meshBounds = new THREE.Box3();
    const hasBounds = { value: false };
    const anchorY = group.position.y;

    group.updateMatrixWorld(true);
    group.traverse((child) => {
      if (!child.isMesh || ignoredSet.has(child) || !child.geometry) {
        return;
      }

      if (!child.geometry.boundingBox) {
        child.geometry.computeBoundingBox();
      }
      if (!child.geometry.boundingBox) {
        return;
      }

      meshBounds.copy(child.geometry.boundingBox).applyMatrix4(child.matrixWorld);
      if (!hasBounds.value) {
        localBounds.copy(meshBounds);
        hasBounds.value = true;
      } else {
        localBounds.union(meshBounds);
      }
    });

    if (!hasBounds.value || localBounds.min.y >= anchorY) {
      return 0;
    }
    return (anchorY - localBounds.min.y) + S(0.003);
  }

  function getRocketVisualLift(record, stateOverride = null) {
    const state = stateOverride ?? record?.state;
    const baseLift = record?.standbyVisualLift ?? 0;
    if (baseLift <= 0) {
      return 0;
    }
    if (state === "STANDBY" || state === "IGNITION") {
      return baseLift;
    }
    if ((state === "STAGE1" || state === "LAUNCH") && (record?.stageTimer ?? 0) < STANDBY_VISUAL_LIFT_FADE_DURATION) {
      const fade = 1 - THREE.MathUtils.smootherstep(
        record.stageTimer ?? 0,
        0,
        STANDBY_VISUAL_LIFT_FADE_DURATION
      );
      return baseLift * fade;
    }
    return 0;
  }

  function getRocketDisplayPosition(record, stateOverride = null) {
    tempRocketAnchor.copy(record.position);
    const lift = getRocketVisualLift(record, stateOverride);
    if (lift > 0) {
      tempRocketAnchor.y += lift;
    }
    return tempRocketAnchor;
  }

  function syncRocketVisualPosition(record) {
    record.mesh.position.copy(getRocketDisplayPosition(record));
  }

  function getRocketExhaustWorldPosition(record, flame = null) {
    syncRocketVisualPosition(record);
    scalableStage.updateMatrixWorld(true);
    record.mesh.updateMatrixWorld(true);
    if (flame) {
      flame.getWorldPosition(tempRocketExhaustPosition);
      scalableStage.worldToLocal(tempRocketExhaustPosition);
      return tempRocketExhaustPosition;
    }
    return getRocketDisplayPosition(record);
  }

  function getRocketIgnitionProfile(rocketType = "two-stage") {
    if (rocketType === "sls") {
      return {
        duration: IGNITION_DURATION_SLS,
        exhaustInterval: 0.045,
        exhaustOffsets: createIgnitionOffsets([
          [0, -0.11, 0],
          [-0.018, -0.09, 0],
          [0.018, -0.09, 0]
        ]),
        flameScale: 1.22,
        steamInterval: 0.065,
        steamOffsets: createIgnitionOffsets([
          [0, -0.11, 0],
          [-0.024, -0.085, 0],
          [0.024, -0.085, 0],
          [-0.012, -0.1, 0.018],
          [0.012, -0.1, -0.018]
        ]),
        steamSpread: 1.15,
        steamVelocity: S(0.19),
        towerReleaseProgress: 0.74
      };
    }

    if (rocketType === "single") {
      return {
        duration: IGNITION_DURATION_SINGLE_STAGE,
        exhaustInterval: 0.05,
        exhaustOffsets: createIgnitionOffsets([[0, -0.065, 0]]),
        flameScale: 0.92,
        steamInterval: 0.075,
        steamOffsets: createIgnitionOffsets([
          [0, -0.065, 0],
          [0.012, -0.06, 0],
          [-0.012, -0.06, 0]
        ]),
        steamSpread: 0.82,
        steamVelocity: S(0.13),
        towerReleaseProgress: 0.68
      };
    }

    return {
      duration: IGNITION_DURATION_DEFAULT,
      exhaustInterval: 0.048,
      exhaustOffsets: createIgnitionOffsets([
        [0, -0.11, 0],
        [0.012, -0.102, 0],
        [-0.012, -0.102, 0]
      ]),
      flameScale: 1.04,
      steamInterval: 0.07,
      steamOffsets: createIgnitionOffsets([
        [0, -0.11, 0],
        [0.02, -0.095, 0],
        [-0.02, -0.095, 0]
      ]),
      steamSpread: 0.96,
      steamVelocity: S(0.16),
      towerReleaseProgress: 0.7
    };
  }

  function setFlameHeat(flame, heat = 0, lengthScale = 1) {
    if (!flame?.material) {
      return;
    }

    const clampedHeat = THREE.MathUtils.clamp(heat, 0, 1);
    flame.visible = clampedHeat > 0.015;
    flame.material.transparent = true;
    flame.material.opacity = THREE.MathUtils.lerp(0.12, 0.98, clampedHeat);
    tempIgnitionColor.lerpColors(ignitionFlameCoolColor, ignitionFlameHotColor, clampedHeat);
    flame.material.color.copy(tempIgnitionColor);
    flame.scale.set(
      THREE.MathUtils.lerp(0.42, 1.0, clampedHeat),
      THREE.MathUtils.lerp(0.3, lengthScale, clampedHeat),
      THREE.MathUtils.lerp(0.42, 1.0, clampedHeat)
    );
  }

  function emitLocalSmoke(record, localOffset, localDirection, options = {}) {
    tempIgnitionWorldPosition.copy(localOffset);
    syncRocketVisualPosition(record);
    scalableStage.updateMatrixWorld(true);
    record.mesh.updateMatrixWorld(true);
    record.mesh.localToWorld(tempIgnitionWorldPosition);
    scalableStage.worldToLocal(tempIgnitionWorldPosition);
    tempIgnitionWorldDirection.copy(localDirection).applyQuaternion(record.mesh.quaternion);
    spawnSmoke(tempIgnitionWorldPosition, {
      ...options,
      velocity: tempIgnitionWorldDirection.multiplyScalar(options.speed ?? 1)
    });
  }

  function updateIgnitionVisuals(record, ignitionProgress) {
    const heat = THREE.MathUtils.smootherstep(ignitionProgress, 0.02, 0.92);
    record.engineHeat = heat;
    setFlameHeat(
      record.flame1,
      THREE.MathUtils.clamp((heat - 0.12) / 0.88, 0, 1),
      (record.ignitionProfile?.flameScale ?? 1) * THREE.MathUtils.lerp(0.38, 1.0, heat)
    );
    setFlameHeat(record.flame2, 0);
    if (record.membraneMesh) {
      record.membraneMesh.visible = false;
    }
  }

  function emitIgnitionEffects(record, deltaSeconds) {
    const profile = record.ignitionProfile ?? getRocketIgnitionProfile(record.rocketType);
    const progress = THREE.MathUtils.clamp(
      record.ignitionTimer / Math.max(record.ignitionDuration, 0.0001),
      0,
      1
    );
    const heat = THREE.MathUtils.smootherstep(progress, 0.02, 0.92);
    const steamWeight = 1.0 - THREE.MathUtils.smoothstep(progress, 0.58, 1.0);
    const exhaustWeight = THREE.MathUtils.smootherstep(progress, 0.08, 0.94);

    record.prelaunchSteamTimer += deltaSeconds;
    const steamInterval = THREE.MathUtils.lerp(
      profile.steamInterval * 1.24,
      profile.steamInterval * 0.82,
      heat
    ) * IGNITION_STEAM_INTERVAL_SCALE;
    while (record.prelaunchSteamTimer >= steamInterval) {
      record.prelaunchSteamTimer -= steamInterval;
      const steamSpeed = profile.steamVelocity * THREE.MathUtils.lerp(0.72, 1.22, heat);
      for (const offset of profile.steamOffsets) {
        const sideBias = Math.sign(offset.x);
        const steamBurstCount = Math.max(2, Math.round(2 + (steamWeight * 2.2)));
        for (let burstIndex = 0; burstIndex < steamBurstCount; burstIndex += 1) {
          tempIgnitionLocalOffset.copy(offset);
          emitLocalSmoke(
            record,
            tempIgnitionLocalOffset,
            new THREE.Vector3(
              sideBias * (0.45 + (Math.random() * 0.38 * profile.steamSpread)),
              -0.92 + (Math.random() * 0.24),
              (Math.random() - 0.5) * 0.42 * profile.steamSpread
            ).normalize(),
            {
              jitter: S(0.018),
              material: "steam",
              maxAge: THREE.MathUtils.lerp(2.2, 1.35, heat),
              scaleGrowth: THREE.MathUtils.lerp(8.4, 5.6, heat),
              speed: steamSpeed * THREE.MathUtils.lerp(0.92, 1.16, Math.random()),
              velocityDamping: 0.72,
              velocityGravity: 0.16,
              opacityFactor: THREE.MathUtils.lerp(1.08, 0.72, heat),
              initialScale: THREE.MathUtils.lerp(1.36, 0.96, heat) * (0.9 + (steamWeight * 0.52))
            }
          );
        }
      }
    }

    record.prelaunchPulseTimer += deltaSeconds;
    const exhaustInterval = THREE.MathUtils.lerp(
      profile.exhaustInterval * 1.4,
      profile.exhaustInterval,
      exhaustWeight
    ) * IGNITION_EXHAUST_INTERVAL_SCALE;
    while (record.prelaunchPulseTimer >= exhaustInterval) {
      record.prelaunchPulseTimer -= exhaustInterval;
      for (const offset of profile.exhaustOffsets) {
        const exhaustBurstCount = Math.max(2, Math.round(2 + (exhaustWeight * 3.2)));
        for (let burstIndex = 0; burstIndex < exhaustBurstCount; burstIndex += 1) {
          emitLocalSmoke(
            record,
            offset,
            new THREE.Vector3(
              (Math.random() - 0.5) * 0.18,
              -1,
              (Math.random() - 0.5) * 0.18
            ).normalize(),
            {
              jitter: S(0.012),
              material: "exhaust",
              maxAge: THREE.MathUtils.lerp(1.08, 1.35, exhaustWeight),
              scaleGrowth: THREE.MathUtils.lerp(3.8, 5.6, exhaustWeight),
              speed: S(0.14 + (0.24 * exhaustWeight)) * THREE.MathUtils.lerp(0.92, 1.18, Math.random()),
              velocityDamping: 0.8,
              velocityGravity: 0.1,
              opacityFactor: THREE.MathUtils.lerp(0.56, 0.9, exhaustWeight),
              initialScale: THREE.MathUtils.lerp(0.84, 1.18, exhaustWeight)
            }
          );
        }
      }
    }
  }

  function updateIgnitionState(record, deltaSeconds, body = null) {
    record.ignitionTimer = Math.min(record.ignitionTimer + deltaSeconds, record.ignitionDuration);
    record.position.copy(record.startPos);
    record.velocity.set(0, 0, 0);
    record.stageTimer = 0;
    orientRocketForStandby(record.mesh, record.headingRad);
    if (body) {
      body.setTranslation({
        x: record.startPos.x,
        y: record.startPos.y,
        z: record.startPos.z
      }, true);
      body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    }

    const ignitionProgress = THREE.MathUtils.clamp(
      record.ignitionTimer / Math.max(record.ignitionDuration, 0.0001),
      0,
      1
    );
    updateIgnitionVisuals(record, ignitionProgress);
    syncRocketVisualPosition(record);
    emitIgnitionEffects(record, deltaSeconds);

    if (ignitionProgress >= (record.ignitionProfile?.towerReleaseProgress ?? 0.7)) {
      startLaunchTowerRelease(record);
    }

    if (ignitionProgress >= 1) {
      record.engineHeat = 1;
      record.state = record.liftoffState ?? (record.isTwoStage ? "STAGE1" : "LAUNCH");
      record.stageTimer = 0;
      record.smokeTimer = 0;
      setRocketLaunchVisuals(record);
    }
    return false;
  }

  function captureFlightDirectionFromVelocity(record, velocityLike, fallbackDirection = record.targetFlightDir) {
    tempVelocityDirection.set(
      velocityLike?.x ?? 0,
      velocityLike?.y ?? 0,
      velocityLike?.z ?? 0
    );

    if (tempVelocityDirection.lengthSq() > 0.000001) {
      tempVelocityDirection.normalize();
    } else if (fallbackDirection?.lengthSq?.() > 0.000001) {
      tempVelocityDirection.copy(fallbackDirection).normalize();
    } else {
      tempVelocityDirection.copy(_UP);
    }

    record.flightDir.copy(tempVelocityDirection);
    record.thrustDir.copy(tempVelocityDirection);
    return tempVelocityDirection;
  }

  function createRapierRocketBody(pos) {
    const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(pos.x, pos.y, pos.z)
      .setLinearDamping(0.0)
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
      .setAngularDamping(0.15); // 낮을수록 오래 회전
    const body = physics.world.createRigidBody(bodyDesc);
    physics.world.createCollider(
      RAPIER.ColliderDesc.ball(S(0.014))
        .setMass(0.4).setRestitution(0.05).setFriction(0.3),
      body
    );
    if (initVel) body.setLinvel(initVel, true);
    return body;
  }

  function getMissionProfileConfig(missionProfile = DEFAULT_MISSION_PROFILE_ID) {
    if (missionProfile === ARTEMIS_II_MISSION_PROFILE_ID) {
      return {
        id: ARTEMIS_II_MISSION_PROFILE_ID,
        launchpadName: ARTEMIS_II_SPACEPORT.name,
        maxFlightDistance: S(2.25),
        maxPitchAngle: Math.PI / 2 * 0.9,
        missionLabel: "Artemis II",
        pitchoverSeparationAngle: Math.PI / 180 * 24,
        rocketType: "sls",
        spaceport: ARTEMIS_II_SPACEPORT,
        stage1AltTrigger: 0.9,
        stage1SpeedMultiplier: 0.96,
        stage1TurnRate: 2.1,
        stage2SpeedMultiplier: 1.12,
        stage2TurnRate: 1.55,
        vehicleLabel: "SLS / Orion"
      };
    }

    return {
      id: DEFAULT_MISSION_PROFILE_ID,
      launchpadName: null,
      maxFlightDistance: S(1.5),
      maxPitchAngle: PITCHOVER_ANGLE,
      missionLabel: "",
      pitchoverSeparationAngle: PITCHOVER_SEP_ANGLE,
      rocketType: null,
      spaceport: null,
      stage1AltTrigger: STAGE1_ALT_TRIGGER,
      stage1SpeedMultiplier: 1,
      stage1TurnRate: STAGE1_TURN_RATE,
      stage2SpeedMultiplier: 1,
      stage2TurnRate: STAGE2_TURN_RATE,
      vehicleLabel: ""
    };
  }

  function getLaunchProfile(spaceportIndex, rocketType = "two-stage", missionProfile = DEFAULT_MISSION_PROFILE_ID) {
    const mission = getMissionProfileConfig(missionProfile);
    const missionSpaceport = mission.spaceport;
    if (!missionSpaceport && (spaceportIndex < 0 || spaceportIndex >= SPACEPORTS.length)) {
      return null;
    }

    const spaceport = missionSpaceport ?? SPACEPORTS[spaceportIndex];
    const startPosGeo = getProjectedPositionFromGeo(
      spaceport.lat,
      spaceport.lon,
      constants.DISC_RADIUS,
      constants.SURFACE_Y
    );
    const startPos = new THREE.Vector3(startPosGeo.x, startPosGeo.y, startPosGeo.z);
    const localNorthDir = new THREE.Vector3(-startPos.x, 0, -startPos.z).normalize();
    const localEastDir = new THREE.Vector3(startPos.z, 0, -startPos.x).normalize();
    const headingRad = THREE.MathUtils.degToRad(spaceport.heading);
    const targetFlightDir = new THREE.Vector3()
      .addScaledVector(localNorthDir, Math.cos(headingRad))
      .addScaledVector(localEastDir, Math.sin(headingRad))
      .normalize();
    const maxFlightDistance = mission.maxFlightDistance;
    const targetDropOffProjected = startPos.clone().addScaledVector(targetFlightDir, maxFlightDistance);

    return {
      effectiveRocketType: mission.rocketType ?? rocketType,
      flightProfile: {
        maxPitchAngle: mission.maxPitchAngle,
        pitchoverSeparationAngle: mission.pitchoverSeparationAngle,
        stage1AltTrigger: mission.stage1AltTrigger,
        stage1SpeedMultiplier: mission.stage1SpeedMultiplier,
        stage1TurnRate: mission.stage1TurnRate,
        stage2SpeedMultiplier: mission.stage2SpeedMultiplier,
        stage2TurnRate: mission.stage2TurnRate
      },
      headingRad,
      maxFlightDistance,
      missionLabel: mission.missionLabel,
      missionProfile: mission.id,
      spaceport,
      spaceportIndex,
      startPos,
      targetDropOffProjected,
      targetFlightDir,
      vehicleLabel: mission.vehicleLabel || (rocketType === "single" ? "Single Stage" : "2-Stage Rocket")
    };
  }

  function orientRocketForStandby(mesh, headingRad) {
    mesh.quaternion.setFromAxisAngle(_UP, headingRad);
  }

  // ─── Mesh builders ───
  // All meshes are oriented along +Y (nose at +Y, exhaust at -Y).
  // Orientation is done via quaternion.setFromUnitVectors(UP, dir) where UP=(0,1,0).

  function getLaunchTowerDimensions(rocketType) {
    if (rocketType === "two-stage" || rocketType === "sls") {
      return {
        armHeight: S(-0.01),
        armLength: S(0.034),
        armThickness: S(0.006),
        armTravel: S(0.026),
        baseHeight: S(0.012),
        columnRadius: S(0.05),
        columnSize: S(0.008),
        padRadius: S(0.06),
        padTopY: S(-0.096),
        towerTopY: S(0.115)
      };
    }

    return {
      armHeight: S(0.0),
      armLength: S(0.024),
      armThickness: S(0.005),
      armTravel: S(0.02),
      baseHeight: S(0.01),
      columnRadius: S(0.038),
      columnSize: S(0.007),
      padRadius: S(0.046),
      padTopY: S(-0.048),
      towerTopY: S(0.09)
    };
  }

  function buildLaunchTower(profile, rocketType) {
    const dims = getLaunchTowerDimensions(rocketType);
    const tower = new THREE.Group();
    tower.name = "rocket-launch-tower";
    const movingArms = [];
    const metallicMat = new THREE.MeshBasicMaterial({ color: 0x8794a1 });
    const frameMat = new THREE.MeshBasicMaterial({ color: 0x5d6978 });
    const accentMat = new THREE.MeshBasicMaterial({ color: 0xff8a3d });
    const padCenterY = dims.padTopY - dims.baseHeight * 0.5;

    tower.position.copy(profile.startPos);
    orientRocketForStandby(tower, profile.headingRad);

    const pad = new THREE.Mesh(
      new THREE.CylinderGeometry(dims.padRadius, dims.padRadius * 1.08, dims.baseHeight, 12),
      frameMat
    );
    pad.position.y = padCenterY;
    tower.add(pad);

    const serviceDeck = new THREE.Mesh(
      new THREE.CylinderGeometry(dims.padRadius * 0.72, dims.padRadius * 0.76, S(0.006), 12),
      metallicMat
    );
    serviceDeck.position.y = dims.padTopY + S(0.004);
    tower.add(serviceDeck);

    const columnHeight = dims.towerTopY - dims.padTopY;
    const columnCenterY = dims.padTopY + columnHeight * 0.5;
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const column = new THREE.Mesh(
        new THREE.BoxGeometry(dims.columnSize, columnHeight, dims.columnSize),
        metallicMat
      );
      column.position.set(
        Math.cos(angle) * dims.columnRadius,
        columnCenterY,
        Math.sin(angle) * dims.columnRadius
      );
      tower.add(column);
    }

    const topRing = new THREE.Mesh(
      new THREE.CylinderGeometry(dims.columnRadius * 1.08, dims.columnRadius * 1.12, S(0.008), 12),
      frameMat
    );
    topRing.position.y = dims.towerTopY;
    tower.add(topRing);

    const umbilical = new THREE.Mesh(
      new THREE.BoxGeometry(S(0.02), S(0.012), S(0.02)),
      accentMat
    );
    umbilical.position.set(dims.columnRadius * 0.55, dims.armHeight + S(0.028), 0);
    tower.add(umbilical);

    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      const pivot = new THREE.Group();
      pivot.position.set(
        Math.cos(angle) * dims.columnRadius,
        dims.armHeight,
        Math.sin(angle) * dims.columnRadius
      );
      pivot.rotation.y = angle;

      const arm = new THREE.Mesh(
        new THREE.BoxGeometry(dims.armLength, dims.armThickness, dims.armThickness * 1.2),
        metallicMat
      );
      arm.position.x = -dims.armLength * 0.5;
      pivot.add(arm);

      const clamp = new THREE.Mesh(
        new THREE.BoxGeometry(dims.armThickness * 0.9, dims.armThickness * 1.8, dims.armThickness * 1.8),
        accentMat
      );
      clamp.position.x = -dims.armLength + dims.armThickness * 0.5;
      pivot.add(clamp);

      tower.add(pivot);
      movingArms.push({
        basePosition: pivot.position.clone(),
        liftAngle: Math.PI * 0.35,
        pivot,
        travel: dims.armTravel
      });
    }

    return {
      launchTower: tower,
      towerPieces: { movingArms },
      towerAnimationState: {
        active: false,
        duration: LAUNCH_TOWER_RELEASE_DURATION,
        elapsed: 0
      }
    };
  }

  function removeLaunchTower(record) {
    if (!record?.launchTower) {
      return;
    }

    scalableStage.remove(record.launchTower);
    record.launchTower = null;
    record.towerPieces = null;
    record.towerAnimationState = null;
  }

  function startLaunchTowerRelease(record) {
    if (!record?.launchTower || record.towerReleased || record.towerAnimationState?.active) {
      return;
    }

    record.towerReleased = false;
    record.towerAnimationState = {
      active: true,
      duration: LAUNCH_TOWER_RELEASE_DURATION,
      elapsed: 0
    };
  }

  function updateLaunchTower(record, deltaSeconds) {
    if (!record?.launchTower || !record.towerAnimationState?.active) {
      return;
    }

    const animation = record.towerAnimationState;
    animation.elapsed += deltaSeconds;
    const progress = Math.min(1, animation.elapsed / Math.max(0.001, animation.duration));
    const eased = 1 - Math.pow(1 - progress, 3);

    for (const arm of record.towerPieces?.movingArms ?? []) {
      arm.pivot.position.set(
        arm.basePosition.x * (1 + eased * 0.16),
        arm.basePosition.y + S(0.012) * eased,
        arm.basePosition.z * (1 + eased * 0.16)
      );
      arm.pivot.rotation.z = arm.liftAngle * eased;
      arm.pivot.translateX(arm.travel * eased);
    }

    if (progress >= 1) {
      record.towerReleased = true;
      removeLaunchTower(record);
    }
  }

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

    return {
      group,
      membraneMesh,
      flame1,
      flame2: null,
      interstage: null,
      stage1Group: null,
      stage2Group: group
    };
  }

  function buildTwoStageRocket() {
    const group = new THREE.Group();

    // ── 2단 (상단, +Y 방향) ──────────────────────────────
    const stage2Group = new THREE.Group();
    const s2H = S(0.048), s2R = S(0.0065);

    // 페어링(노즈콘)
    const noseMesh = new THREE.Mesh(
      new THREE.ConeGeometry(s2R, S(0.026), 8),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    noseMesh.position.y = s2H / 2 + S(0.026) / 2;
    stage2Group.add(noseMesh);

    // 2단 연료탱크
    const tank2 = new THREE.Mesh(
      new THREE.CylinderGeometry(s2R, s2R, s2H, 8),
      new THREE.MeshBasicMaterial({ color: 0xdddddd })
    );
    stage2Group.add(tank2);

    // 2단 엔진벨
    const bell2 = new THREE.Mesh(
      new THREE.CylinderGeometry(s2R * 0.75, s2R * 1.5, S(0.014), 8),
      new THREE.MeshBasicMaterial({ color: 0x888888 })
    );
    bell2.position.y = -(s2H / 2 + S(0.014) / 2);
    stage2Group.add(bell2);

    // 2단 화염 (파란색 — 초기 숨김)
    const flame2 = new THREE.Mesh(
      new THREE.ConeGeometry(S(0.007), S(0.038), 8),
      new THREE.MeshBasicMaterial({ color: 0x66ccff })
    );
    flame2.rotation.z = Math.PI;
    flame2.position.y = -(s2H / 2 + S(0.014) + S(0.038) / 2);
    flame2.visible = false;
    stage2Group.add(flame2);

    // 충격파 막 (Membrane — SCRAPE 시 표시)
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

    // ── 인터스테이지 링 ──────────────────────────────────
    const interstageH = S(0.013);
    const interstage  = new THREE.Mesh(
      new THREE.CylinderGeometry(s2R * 1.6, S(0.0105), interstageH, 8),
      new THREE.MeshBasicMaterial({ color: 0x888888 })
    );

    // ── 1단 (하단, -Y 방향) ──────────────────────────────
    const stage1Group = new THREE.Group();
    const s1H = S(0.082), s1RTop = S(0.0105), s1RBot = S(0.015);

    // 1단 연료탱크
    const tank1 = new THREE.Mesh(
      new THREE.CylinderGeometry(s1RTop, s1RBot, s1H, 8),
      new THREE.MeshBasicMaterial({ color: 0xff4422 })
    );
    stage1Group.add(tank1);

    // 핀(안정판) ×4
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

    // 1단 엔진벨
    const nozzle1 = new THREE.Mesh(
      new THREE.CylinderGeometry(s1RBot * 0.7, s1RBot * 1.9, S(0.028), 8),
      new THREE.MeshBasicMaterial({ color: 0x666666 })
    );
    nozzle1.position.y = -(s1H / 2 + S(0.028) / 2);
    stage1Group.add(nozzle1);

    // 1단 화염 (주황색, 크고 밝음)
    const flame1 = new THREE.Mesh(
      new THREE.ConeGeometry(S(0.016), S(0.060), 8),
      new THREE.MeshBasicMaterial({ color: 0xff8800 })
    );
    flame1.rotation.z = Math.PI;
    flame1.position.y = -(s1H / 2 + S(0.028) + S(0.060) / 2);
    stage1Group.add(flame1);

    // ── 조립 ─────────────────────────────────────────────
    // stage2Group 위치: 인터스테이지 위
    stage2Group.position.y = interstageH + s2H / 2;
    group.add(stage2Group);

    // interstage: stage1 탱크 상단에 위치
    interstage.position.y = interstageH / 2;
    group.add(interstage);

    // stage1Group: 인터스테이지 아래
    stage1Group.position.y = -(s1H / 2);
    group.add(stage1Group);

    return { group, membraneMesh, flame1, flame2, stage1Group, stage2Group, interstage };
  }

  function buildSlsRocket() {
    const group = new THREE.Group();
    const orangeMat = new THREE.MeshBasicMaterial({ color: 0xc86e2d });
    const darkOrangeMat = new THREE.MeshBasicMaterial({ color: 0x8c4f24 });
    const whiteMat = new THREE.MeshBasicMaterial({ color: 0xf0f2f8 });
    const grayMat = new THREE.MeshBasicMaterial({ color: 0x8a9098 });
    const blackMat = new THREE.MeshBasicMaterial({ color: 0x1e2127 });

    const stage1Group = new THREE.Group();
    const stage2Group = new THREE.Group();
    const coreHeight = S(0.098);
    const coreRadius = S(0.0125);
    const boosterHeight = S(0.104);
    const boosterRadius = S(0.0055);
    const upperStageHeight = S(0.052);
    const upperStageRadius = S(0.0075);

    const coreStage = new THREE.Mesh(
      new THREE.CylinderGeometry(coreRadius, coreRadius * 1.08, coreHeight, 12),
      orangeMat
    );
    stage1Group.add(coreStage);

    const engineSection = new THREE.Mesh(
      new THREE.CylinderGeometry(coreRadius * 1.02, coreRadius * 1.18, S(0.016), 12),
      darkOrangeMat
    );
    engineSection.position.y = -(coreHeight / 2 + S(0.008));
    stage1Group.add(engineSection);

    for (const side of [-1, 1]) {
      const booster = new THREE.Mesh(
        new THREE.CylinderGeometry(boosterRadius, boosterRadius * 1.04, boosterHeight, 10),
        whiteMat
      );
      booster.position.set(side * S(0.016), S(0.002), 0);
      stage1Group.add(booster);

      const boosterNose = new THREE.Mesh(
        new THREE.ConeGeometry(boosterRadius * 0.94, S(0.018), 10),
        blackMat
      );
      boosterNose.position.set(side * S(0.016), boosterHeight / 2 + S(0.009), 0);
      stage1Group.add(boosterNose);

      const boosterNozzle = new THREE.Mesh(
        new THREE.CylinderGeometry(boosterRadius * 0.78, boosterRadius * 1.18, S(0.014), 10),
        grayMat
      );
      boosterNozzle.position.set(side * S(0.016), -(boosterHeight / 2 + S(0.007)), 0);
      stage1Group.add(boosterNozzle);
    }

    const flame1 = new THREE.Mesh(
      new THREE.ConeGeometry(S(0.02), S(0.07), 12),
      new THREE.MeshBasicMaterial({ color: 0xffa033 })
    );
    flame1.rotation.z = Math.PI;
    flame1.position.y = -(coreHeight / 2 + S(0.055));
    stage1Group.add(flame1);

    const interstage = new THREE.Mesh(
      new THREE.CylinderGeometry(coreRadius * 0.92, coreRadius * 1.08, S(0.018), 12),
      grayMat
    );
    interstage.position.y = S(0.01);

    const upperStage = new THREE.Mesh(
      new THREE.CylinderGeometry(upperStageRadius, upperStageRadius * 0.96, upperStageHeight, 10),
      whiteMat
    );
    stage2Group.add(upperStage);

    const orionAdapter = new THREE.Mesh(
      new THREE.CylinderGeometry(upperStageRadius * 0.72, upperStageRadius * 0.94, S(0.016), 10),
      grayMat
    );
    orionAdapter.position.y = upperStageHeight / 2 + S(0.008);
    stage2Group.add(orionAdapter);

    const orionCapsule = new THREE.Mesh(
      new THREE.ConeGeometry(upperStageRadius * 1.08, S(0.03), 10),
      whiteMat
    );
    orionCapsule.position.y = upperStageHeight / 2 + S(0.028);
    stage2Group.add(orionCapsule);

    const serviceModule = new THREE.Mesh(
      new THREE.CylinderGeometry(upperStageRadius * 0.82, upperStageRadius * 0.82, S(0.02), 10),
      darkOrangeMat
    );
    serviceModule.position.y = upperStageHeight / 2 - S(0.008);
    stage2Group.add(serviceModule);

    const flame2 = new THREE.Mesh(
      new THREE.ConeGeometry(S(0.008), S(0.04), 10),
      new THREE.MeshBasicMaterial({ color: 0x7dc8ff })
    );
    flame2.rotation.z = Math.PI;
    flame2.position.y = -(upperStageHeight / 2 + S(0.03));
    flame2.visible = false;
    stage2Group.add(flame2);

    const membraneMesh = new THREE.Mesh(
      new THREE.ConeGeometry(S(0.024), S(0.11), 16, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0x88ccff, transparent: true, opacity: 0.5,
        side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false
      })
    );
    membraneMesh.position.y = upperStageHeight / 2 + S(0.07);
    membraneMesh.visible = false;
    stage2Group.add(membraneMesh);

    stage2Group.position.y = S(0.076);
    stage1Group.position.y = -S(0.018);
    group.add(stage2Group);
    group.add(interstage);
    group.add(stage1Group);

    return { group, membraneMesh, flame1, flame2, stage1Group, stage2Group, interstage };
  }

  // ─── 1단 분리 (두동강) ───
  function startStageSeparation(r) {
    if (!r.stage1Group) return;
    const separationRootPos = r.position.clone();

    // scalableStage가 XZ 스케일을 가지므로 getWorldPosition() 사용 불가.
    // r.position은 Rapier 좌표 = scalableStage 로컬 좌표와 동일하므로 이를 기준으로 계산.
    // stage1Group의 로컬 오프셋을 로켓 회전으로 변환해 더함.
    const stage1Offset = r.stage1Group.position.clone();
    stage1Offset.applyQuaternion(r.mesh.quaternion);
    const physicsPos = separationRootPos.clone().add(stage1Offset);
    const stage2Offset = r.stage2Group?.position?.clone?.() ?? new THREE.Vector3();
    stage2Offset.applyQuaternion(r.mesh.quaternion);
    const stage2WorldPos = separationRootPos.clone().add(stage2Offset);

    // 회전: getWorldQuaternion은 스케일 영향 없으므로 그대로 사용
    const worldQuat = new THREE.Quaternion();
    r.stage1Group.getWorldQuaternion(worldQuat);

    r.mesh.remove(r.stage1Group);
    if (r.interstage) r.mesh.remove(r.interstage);
    if (r.stage2Group) {
      r.stage2Group.position.set(0, 0, 0);
    }
    r.position.copy(stage2WorldPos);
    r.mesh.position.copy(stage2WorldPos);
    if (r.rigidBody) {
      r.rigidBody.setTranslation({
        x: stage2WorldPos.x,
        y: stage2WorldPos.y,
        z: stage2WorldPos.z
      }, true);
    }

    // ── 두동강: 상단(탱크 동체)과 하단(엔진부+핀) 분리 ──
    const pieceTop = new THREE.Group();
    const pieceBot = new THREE.Group();

    for (const child of r.stage1Group.children) {
      (child.position.y >= -S(0.005) ? pieceTop : pieceBot).add(child.clone());
    }

    // physicsPos = Rapier 좌표 = scalableStage 로컬 좌표 → 메시와 물리 모두 동일 기준
    pieceTop.position.copy(physicsPos);
    pieceTop.quaternion.copy(worldQuat);
    pieceBot.position.copy(physicsPos);
    pieceBot.quaternion.copy(worldQuat);
    scalableStage.add(pieceTop);
    scalableStage.add(pieceBot);

    const vel = r.rigidBody ? r.rigidBody.linvel() : r.velocity;

    // 상단 조각: 살짝 위로 튀며 느린 텀블링
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

    // 하단 조각: 아래로 분리되며 빠른 회전
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

    setFlameHeat(r.flame1, 0);
    r.engineHeat = 0;
    for (let i = 0; i < 10; i++) spawnSepParticle(separationRootPos.clone());
  }

  function setRocketStandbyVisuals(record) {
    setFlameHeat(record.flame1, 0);
    setFlameHeat(record.flame2, 0);
    if (record.membraneMesh) {
      record.membraneMesh.visible = false;
    }
    record.engineHeat = 0;
  }

  function setRocketLaunchVisuals(record) {
    setFlameHeat(record.flame1, 1, record.ignitionProfile?.flameScale ?? 1);
    setFlameHeat(record.flame2, 0);
    if (record.membraneMesh) {
      record.membraneMesh.visible = false;
    }
    record.engineHeat = 1;
  }

  function createRocketRecord(profile, rocketType = "two-stage", parts = null) {
    const isTwoStage = rocketType === "two-stage" || rocketType === "sls";
    const {
      group,
      membraneMesh,
      flame1,
      flame2,
      stage1Group,
      stage2Group,
      interstage
    } = parts ?? (
      rocketType === "sls"
        ? buildSlsRocket()
        : (isTwoStage ? buildTwoStageRocket() : buildSingleStageRocket())
    );

    group.position.copy(profile.startPos);
    orientRocketForStandby(group, profile.headingRad);
    const tower = buildLaunchTower(profile, rocketType);
    const ignitionProfile = getRocketIgnitionProfile(profile.effectiveRocketType ?? rocketType);
    const standbyVisualLift = computeStandbyVisualLift(group, [flame1, flame2, membraneMesh]);

    return {
      flame1,
      flame2,
      flightProfile: { ...profile.flightProfile },
      headingRad: profile.headingRad,
      interstage,
      isTwoStage,
      launchpadName: profile.spaceport.name,
      maxFlightDistance: profile.maxFlightDistance,
      membraneMesh,
      mesh: group,
      missionLabel: profile.missionLabel ?? "",
      missionProfile: profile.missionProfile ?? DEFAULT_MISSION_PROFILE_ID,
      ignitionDuration: ignitionProfile.duration,
      ignitionProfile,
      ignitionTimer: 0,
      engineHeat: 0,
      position: profile.startPos.clone(),
      rocketType: profile.effectiveRocketType ?? rocketType,
      standbyVisualLift,
      launchTower: tower.launchTower,
      towerAnimationState: tower.towerAnimationState,
      towerPieces: tower.towerPieces,
      towerReleased: false,
      desiredFlightDir: new THREE.Vector3(0, 1, 0),
      flightDir: new THREE.Vector3(0, 1, 0),
      scrapeTimer: 0,
      smokeTimer: 0,
      spaceportIndex: profile.spaceportIndex,
      stage1ExitDir: null,
      stage1Group,
      stage2EntryDir: null,
      stage2Group,
      stageTimer: 0,
      startPos: profile.startPos.clone(),
      state: "STANDBY",
      scrapeDir: profile.targetFlightDir.clone(),
      targetDropOffProjected: profile.targetDropOffProjected.clone(),
      targetFlightDir: profile.targetFlightDir.clone(),
      thrustDir: new THREE.Vector3(0, 1, 0),
      trackingEligible: false,
      vehicleLabel: profile.vehicleLabel ?? "",
      velocity: new THREE.Vector3(),
      prelaunchPulseTimer: 0,
      prelaunchSteamTimer: 0,
      waterEntryTimer: 0,
      lastImpactStrength: 0,
      lastRippleEmitAt: 0,
      lastTrailSpeed: 0,
      lastTrailEmitAt: 0,
      wakeTimer: 0
    };
  }

  function promoteRecordToActive(record) {
    const activeRecord = {
      ...record,
      distanceTravelled: 0,
      engineHeat: 0,
      ignitionDuration: record.ignitionDuration,
      ignitionProfile: record.ignitionProfile,
      ignitionTimer: 0,
      liftoffState: record.isTwoStage ? "STAGE1" : "LAUNCH",
      pitchoverDir: null,
      rigidBody: null,
      prelaunchPulseTimer: 0,
      prelaunchSteamTimer: 0,
      scrapeTimer: 0,
      sepVel: null,
      smokeTimer: 0,
      stage1ExitDir: record.stage1ExitDir?.clone?.() ?? null,
      stage2EntryDir: record.stage2EntryDir?.clone?.() ?? null,
      stageTimer: 0,
      state: "IGNITION",
      scrapeDir: record.scrapeDir?.clone?.() ?? record.targetFlightDir.clone(),
      desiredFlightDir: record.desiredFlightDir?.clone?.() ?? new THREE.Vector3(0, 1, 0),
      flightDir: record.flightDir?.clone?.() ?? new THREE.Vector3(0, 1, 0),
      flightProfile: { ...(record.flightProfile ?? {}) },
      thrustDir: record.thrustDir?.clone?.() ?? new THREE.Vector3(0, 1, 0),
      trackingEligible: true,
      vehicleLabel: record.vehicleLabel ?? "",
      velocity: new THREE.Vector3(0, 0, 0),
      waterEntryTimer: 0,
      lastImpactStrength: 0,
      lastRippleEmitAt: 0,
      lastTrailSpeed: 0,
      lastTrailEmitAt: 0,
      wakeTimer: 0
    };

    if (physics && RAPIER) {
      activeRecord.rigidBody = createRapierRocketBody(activeRecord.startPos);
    }

    setRocketStandbyVisuals(activeRecord);
    rockets.push(activeRecord);
    lastCompletedLaunchpadName = "";
    return activeRecord;
  }

  function removeStandbyMesh() {
    if (!standbyRocket) {
      return;
    }
    removeLaunchTower(standbyRocket);
    scalableStage.remove(standbyRocket.mesh);
    standbyRocket = null;
  }

  function enterStandby(spaceportIndex, rocketType = "two-stage", missionProfile = DEFAULT_MISSION_PROFILE_ID) {
    const profile = getLaunchProfile(spaceportIndex, rocketType, missionProfile);
    if (!profile) {
      return null;
    }

    removeStandbyMesh();
    standbyRocket = createRocketRecord(profile, profile.effectiveRocketType ?? rocketType);
    setRocketStandbyVisuals(standbyRocket);
    syncRocketVisualPosition(standbyRocket);
    scalableStage.add(standbyRocket.launchTower);
    scalableStage.add(standbyRocket.mesh);
    return getStandbySnapshot();
  }

  function launchStandby() {
    if (!standbyRocket) {
      return null;
    }

    const record = standbyRocket;
    standbyRocket = null;
    promoteRecordToActive(record);
    return getActiveRocketSnapshot();
  }

  function clearStandby() {
    removeStandbyMesh();
  }

  function launchRocketWithStandby(spaceportIndex, rocketType = "two-stage", missionProfile = DEFAULT_MISSION_PROFILE_ID) {
    const activeRocket = rockets[rockets.length - 1];
    if (activeRocket?.state === "IGNITION") {
      return getActiveRocketSnapshot();
    }

    const nextRocketType = getMissionProfileConfig(missionProfile).rocketType ?? rocketType;
    const shouldRestage = !standbyRocket
      || standbyRocket.spaceportIndex !== spaceportIndex
      || standbyRocket.rocketType !== nextRocketType
      || standbyRocket.missionProfile !== missionProfile;

    if (shouldRestage) {
      enterStandby(spaceportIndex, rocketType, missionProfile);
    }

    return launchStandby();
  }

  // ─── Particles ───
  function spawnWake(position, moveDir) {
    const mesh = new THREE.Mesh(sharedWakeGeo, sharedWakeMat.clone());
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

  function spawnSmoke(position, options = {}) {
    const {
      initialScale = 1,
      jitter = S(0.01),
      material = "flight",
      maxAge = SMOKE_DURATION,
      opacityFactor = 1,
      scaleGrowth = 4.0,
      speed = null,
      velocity = null,
      velocityDamping = 0.9,
      velocityGravity = 0.08
    } = options;
    const baseMaterial = material === "steam"
      ? sharedSteamMat
      : (material === "exhaust" ? sharedExhaustSmokeMat : sharedSmokeMat);
    const mesh = new THREE.Mesh(sharedSmokeGeo, baseMaterial.clone());
    mesh.position.copy(position);
    mesh.position.x += (Math.random() - 0.5) * jitter;
    mesh.position.y += (Math.random() - 0.5) * jitter;
    mesh.position.z += (Math.random() - 0.5) * jitter;
    mesh.scale.setScalar(initialScale);
    if (mesh.material?.opacity !== undefined) {
      mesh.material.opacity *= opacityFactor;
    }
    scalableStage.add(mesh);
    if (velocity) {
      smokes.push({
        mesh,
        age: 0,
        maxAge,
        scaleGrowth,
        velocity: velocity.clone(),
        velocityDamping,
        velocityGravity
      });
      return;
    }

    smokes.push({
      mesh,
      age: 0,
      driftY: speed ?? S(0.028),
      maxAge,
      scaleGrowth
    });
  }

  function spawnSpray(position, direction, strength = 1) {
    const mesh = new THREE.Mesh(sharedSmokeGeo, sharedSprayMat.clone());
    mesh.position.copy(position);
    mesh.position.x += (Math.random() - 0.5) * S(0.014);
    mesh.position.y += (Math.random() - 0.5) * S(0.014);
    mesh.position.z += (Math.random() - 0.5) * S(0.014);
    scalableStage.add(mesh);
    const velocity = direction.clone();
    if (velocity.lengthSq() < 0.0001) {
      velocity.set(0, 1, 0);
    } else {
      velocity.normalize();
    }
    velocity.multiplyScalar(S(0.12 + (Math.random() * 0.1) + (strength * 0.05)));
    velocity.y += S(0.08 + (strength * 0.03));
    smokes.push({
      mesh,
      age: 0,
      velocity,
      maxAge: DOME_WATER_SPRAY_LIFETIME * THREE.MathUtils.lerp(0.85, 1.25, Math.random()),
      scaleGrowth: 3.4 + (strength * 1.8)
    });
  }

  function spawnSprayBurst(position, direction, strength = 1) {
    const burstCount = Math.max(3, Math.round(2 + (strength * 4)));
    for (let index = 0; index < burstCount; index += 1) {
      tempHorizontalDir.copy(direction);
      tempHorizontalDir.x += (Math.random() - 0.5) * 0.85;
      tempHorizontalDir.y += Math.random() * 0.85;
      tempHorizontalDir.z += (Math.random() - 0.5) * 0.85;
      spawnSpray(position, tempHorizontalDir, strength);
    }
  }

  function spawnAscentExhaust(position, stageTimer, intensity = 1) {
    const hotLaunchPhase = THREE.MathUtils.clamp(1 - ((stageTimer ?? 0) / 0.75), 0, 1);
    const burstCount = Math.max(2, Math.round(ASCENT_EXHAUST_BURST_MULTIPLIER + (intensity * 1.8) + (hotLaunchPhase * 2.4)));
    if (hotLaunchPhase > 0.001) {
      for (let burstIndex = 0; burstIndex < burstCount; burstIndex += 1) {
        spawnSmoke(position, {
          jitter: S(0.018),
          material: "exhaust",
          maxAge: THREE.MathUtils.lerp(1.25, 0.9, hotLaunchPhase) * THREE.MathUtils.lerp(0.92, 1.18, Math.random()),
          scaleGrowth: THREE.MathUtils.lerp(6.2, 4.4, hotLaunchPhase) * intensity,
          speed: S(0.024 + (0.024 * hotLaunchPhase * intensity)) * THREE.MathUtils.lerp(0.9, 1.16, Math.random()),
          opacityFactor: THREE.MathUtils.lerp(0.96, 0.68, hotLaunchPhase),
          initialScale: THREE.MathUtils.lerp(1.2, 0.88, hotLaunchPhase) * THREE.MathUtils.lerp(0.9, 1.18, Math.random())
        });
      }
      return;
    }

    for (let burstIndex = 0; burstIndex < Math.max(2, burstCount - 1); burstIndex += 1) {
      spawnSmoke(position, {
        jitter: S(0.02),
        maxAge: SMOKE_DURATION * THREE.MathUtils.lerp(1.05, 1.45, Math.random()),
        scaleGrowth: 5.2 * intensity * THREE.MathUtils.lerp(0.92, 1.18, Math.random()),
        speed: S(0.032 + (0.012 * Math.random())),
        opacityFactor: 0.86,
        initialScale: THREE.MathUtils.lerp(0.96, 1.28, Math.random())
      });
    }
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

  // ─── Update ───
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
      if (!removed) {
        syncRocketVisualPosition(r);
      }
    }

    // ── Debris (1단 잔해) ──────────────────────────────
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
        // 폴백 수동 물리
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

    // ── Wake particles ──────────────────────────────────
    for (let i = wakes.length - 1; i >= 0; i--) {
      const w   = wakes[i];
      const maxAge = w.maxAge ?? WAKE_DURATION;
      w.age += deltaSeconds;
      if (w.age > maxAge) {
        w.mesh.material?.dispose?.();
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

    // ── Smoke particles ─────────────────────────────────
    for (let i = smokes.length - 1; i >= 0; i--) {
      const s = smokes[i];
      s.age += deltaSeconds;
      const maxAge = s.maxAge ?? SMOKE_DURATION;
      if (s.age > maxAge) {
        s.mesh.material?.dispose?.();
        scalableStage.remove(s.mesh);
        smokes.splice(i, 1);
      } else {
        if (s.velocity) {
          s.velocity.y -= GRAVITY * (s.velocityGravity ?? 0.08) * deltaSeconds;
          s.velocity.multiplyScalar(Math.max(0.92, 1.0 - (deltaSeconds * (s.velocityDamping ?? 0.9))));
          s.mesh.position.addScaledVector(s.velocity, deltaSeconds);
        } else if (s.driftY) {
          s.mesh.position.y += s.driftY * deltaSeconds;
        }
        const scale = 1.0 + (s.age / maxAge) * (s.scaleGrowth ?? 4.0);
        s.mesh.scale.set(scale, scale, scale);
        if (s.mesh.material?.opacity !== undefined) {
          s.mesh.material.opacity = Math.max(0, 1.0 - (s.age / maxAge));
        }
      }
    }
  }

  // ─────────────────────────────────────────────────────
  //  Rapier 물리 경로
  // ─────────────────────────────────────────────────────
  const _UP = new THREE.Vector3(0, 1, 0);
  const tempIgnitionWorldPosition = new THREE.Vector3();
  const tempIgnitionWorldDirection = new THREE.Vector3();
  const tempIgnitionLocalOffset = new THREE.Vector3();
  const tempIgnitionColor = new THREE.Color();
  const tempRocketAnchor = new THREE.Vector3();
  const tempRocketExhaustPosition = new THREE.Vector3();
  const ignitionFlameCoolColor = new THREE.Color(0xff7a2f);
  const ignitionFlameHotColor = new THREE.Color(0xfff1a6);

  function getWaterDragCoefficients(timer) {
    const dragBlend = THREE.MathUtils.clamp(
      timer / Math.max(DOME_WATER_PLANING_DURATION, 0.0001),
      0,
      1
    );
    return {
      fluid: THREE.MathUtils.lerp(
        DOME_FLUID_DRAG * DOME_WATER_PLANING_DRAG_MULTIPLIER,
        DOME_FLUID_DRAG,
        dragBlend
      ),
      viscous: THREE.MathUtils.lerp(
        DOME_VISCOUS_DRAG * DOME_WATER_PLANING_VISCOUS_MULTIPLIER,
        DOME_VISCOUS_DRAG * 1.18,
        dragBlend
      )
    };
  }

  function computeImpactStrength(speed, surfaceAlignment) {
    const normalizedSpeed = THREE.MathUtils.clamp(speed / Math.max(STAGE2_SPEED, 0.0001), 0.15, 1.35);
    return THREE.MathUtils.clamp(normalizedSpeed * THREE.MathUtils.lerp(1.05, 1.7, surfaceAlignment), 0.5, 2.2);
  }

  function enterWaterScrapeState(r, incomingVelocity, fallbackDirection, body = null) {
    const surfaceY = domeYAt(r.position.x, r.position.z);
    r.position.y = surfaceY;
    if (body) {
      body.setTranslation({ x: r.position.x, y: surfaceY, z: r.position.z }, true);
    }

    tempImpactVelocity.set(
      incomingVelocity?.x ?? 0,
      incomingVelocity?.y ?? 0,
      incomingVelocity?.z ?? 0
    );
    const incomingSpeed = tempImpactVelocity.length();
    const surfaceNormal = getDomeSurfaceNormalAt(r.position.x, r.position.z);
    const normalSpeed = Math.abs(tempImpactVelocity.dot(surfaceNormal));
    tempDesiredFlightDir
      .copy(tempImpactVelocity)
      .addScaledVector(surfaceNormal, -tempImpactVelocity.dot(surfaceNormal));

    if (tempDesiredFlightDir.lengthSq() < 0.000001) {
      tempDesiredFlightDir.copy(
        getScrapeDirectionAt(r.position.x, r.position.z, tempImpactVelocity, fallbackDirection)
      );
    } else {
      tempDesiredFlightDir.normalize();
    }

    const entryAlignment = incomingSpeed > 0.0001
      ? THREE.MathUtils.clamp(normalSpeed / incomingSpeed, 0, 1)
      : 0.5;
    const tangentialSpeed = Math.max(0, Math.sqrt(Math.max(0, (incomingSpeed * incomingSpeed) - (normalSpeed * normalSpeed))));
    const retention = THREE.MathUtils.clamp(
      1 - (DOME_WATER_ENTRY_DRAG * THREE.MathUtils.lerp(0.62, 1.04, entryAlignment)),
      0.18,
      0.76
    );
    const planingSpeed = Math.max(
      DOME_WATER_PLANING_MIN_SPEED,
      tangentialSpeed * retention,
      SCRAPE_SPEED * 0.38
    );
    const impactStrength = computeImpactStrength(incomingSpeed, entryAlignment);

    r.state = "SCRAPE";
    r.scrapeTimer = 0;
    r.waterEntryTimer = 0;
    r.lastTrailEmitAt = 0;
    r.lastRippleEmitAt = 0;
    r.lastImpactStrength = impactStrength;
    r.lastTrailSpeed = planingSpeed;
    r.scrapeDir.copy(tempDesiredFlightDir);
    r.velocity.set(r.scrapeDir.x * planingSpeed, 0, r.scrapeDir.z * planingSpeed);

    if (r.membraneMesh) {
      r.membraneMesh.visible = true;
    }

    domeWaterApi?.registerImpact({
      position: r.position,
      velocity: tempImpactVelocity,
      strength: impactStrength
    });
    spawnSprayBurst(r.position, surfaceNormal, impactStrength);

    if (body) {
      body.setLinvel({
        x: r.velocity.x,
        y: 0,
        z: r.velocity.z
      }, true);
    }
  }

  function resolveScrapeTrailDirection(r, moveDir, target) {
    if (moveDir?.lengthSq?.() > 0.000001) {
      target.copy(moveDir).normalize();
      return target;
    }
    if (r.scrapeDir?.lengthSq?.() > 0.000001) {
      target.copy(r.scrapeDir).normalize();
      return target;
    }
    target.set(0, 0, 1);
    return target;
  }

  function resolveScrapeTrailAnchorPosition(r, moveDir, target) {
    const trailDirection = resolveScrapeTrailDirection(r, moveDir, tempScrapeTrailDirection);
    tempScrapeFallbackAnchor.copy(r.position).addScaledVector(trailDirection, ROCKET_SCRAPE_TRAIL_NOSE_OFFSET);
    if (r.membraneMesh) {
      r.mesh.position.copy(r.position);
      r.mesh.updateMatrixWorld(true);
      r.membraneMesh.getWorldPosition(tempMembraneWorldPosition);
      if (
        Number.isFinite(tempMembraneWorldPosition.x)
        && Number.isFinite(tempMembraneWorldPosition.y)
        && Number.isFinite(tempMembraneWorldPosition.z)
      ) {
        const membraneAhead =
          ((tempMembraneWorldPosition.x - r.position.x) * trailDirection.x)
          + ((tempMembraneWorldPosition.y - r.position.y) * trailDirection.y)
          + ((tempMembraneWorldPosition.z - r.position.z) * trailDirection.z);
        const fallbackAhead =
          ((tempScrapeFallbackAnchor.x - r.position.x) * trailDirection.x)
          + ((tempScrapeFallbackAnchor.y - r.position.y) * trailDirection.y)
          + ((tempScrapeFallbackAnchor.z - r.position.z) * trailDirection.z);
        return target.copy(membraneAhead >= fallbackAhead ? tempMembraneWorldPosition : tempScrapeFallbackAnchor);
      }
    }
    return target.copy(tempScrapeFallbackAnchor);
  }

  function emitScrapeWaterEffects(r, moveDir, deltaSeconds) {
    const trailDirection = resolveScrapeTrailDirection(r, moveDir, tempScrapeTrailDirection);
    const trailAnchor = resolveScrapeTrailAnchorPosition(r, trailDirection, tempScrapeTrailAnchor);
    const horizontalSpeed = Math.hypot(
      trailDirection.x,
      trailDirection.z
    );
    r.lastTrailSpeed = horizontalSpeed;
    r.lastRippleEmitAt += deltaSeconds;
    r.lastTrailEmitAt += deltaSeconds;
    if (r.waterEntryTimer <= DOME_WATER_RIPPLE_BURST_DURATION && r.lastRippleEmitAt >= 0.34) {
      domeWaterApi?.registerImpact({
        position: r.position,
        velocity: trailDirection,
        strength: THREE.MathUtils.clamp(0.24 + (r.lastImpactStrength * 0.18), 0.24, 0.6)
      });
      r.lastRippleEmitAt = 0;
    }
    if (r.lastTrailEmitAt >= DOME_WATER_TRAIL_EMIT_INTERVAL) {
      const remainingScrapeTime = Math.max(0, SCRAPE_FUEL_DURATION - r.scrapeTimer);
      const scrapeProgress = THREE.MathUtils.clamp(
        r.scrapeTimer / Math.max(SCRAPE_FUEL_DURATION, 0.0001),
        0,
        1
      );
      const growth = 1 - Math.pow(
        1 - scrapeProgress,
        Math.max(0.01, ROCKET_SCRAPE_TRAIL_GROWTH_EASE)
      );
      const timeFade = THREE.MathUtils.clamp(
        remainingScrapeTime / Math.max(DOME_WATER_TRAIL_END_FADE_DURATION, 0.0001),
        0,
        1
      );
      const speedFade = THREE.MathUtils.clamp(
        (horizontalSpeed - DOME_WATER_STOP_SPEED) / Math.max(DOME_WATER_TRAIL_END_FADE_SPEED, 0.0001),
        0,
        1
      );
      const trailVisibility = Math.min(timeFade, speedFade);
      if (trailVisibility <= 0.16) {
        r.lastTrailEmitAt = 0;
        return;
      }
      const speedFactor = THREE.MathUtils.clamp(horizontalSpeed / Math.max(STAGE2_SPEED, 0.0001), 0, 1.25);
      const headGrowth = Math.pow(
        THREE.MathUtils.clamp(growth, 0, 1),
        1 / Math.max(0.01, ROCKET_SCRAPE_TRAIL_HEAD_EXPANSION_BIAS)
      );
      const headScale = THREE.MathUtils.lerp(
        1.0,
        ROCKET_SCRAPE_TRAIL_HEAD_GROWTH_MAX,
        headGrowth
      );
      const tailScale = THREE.MathUtils.lerp(1.25, ROCKET_SCRAPE_TRAIL_TAIL_GROWTH_MAX, growth);
      const bodyScale = THREE.MathUtils.lerp(1.0, 1.24, headGrowth);
      const lengthVisibility = THREE.MathUtils.lerp(
        ROCKET_SCRAPE_TRAIL_LENGTH_VISIBILITY_FLOOR,
        1.0,
        trailVisibility
      );
      const width = THREE.MathUtils.lerp(
        DOME_WATER_TRAIL_WIDTH * 0.84,
        DOME_WATER_TRAIL_WIDTH * 0.48,
        speedFactor
      ) * THREE.MathUtils.lerp(0.9, 1.03, trailVisibility) * bodyScale;
      const length = THREE.MathUtils.lerp(
        DOME_WATER_TRAIL_LENGTH * ROCKET_SCRAPE_TRAIL_LENGTH_MIN_SCALE,
        DOME_WATER_TRAIL_LENGTH * 3.9,
        speedFactor
      ) * lengthVisibility * tailScale;
      domeWaterApi?.registerTrail({
        position: trailAnchor,
        direction: trailDirection,
        strength: THREE.MathUtils.clamp((0.34 + (r.lastImpactStrength * 0.4)) * trailVisibility, 0.18, 1.05),
        speed: horizontalSpeed,
        width,
        length,
        headScale
      });
      r.lastTrailEmitAt = 0;
    }
  }

  function updateRocketPhysics(r, deltaSeconds, arrayIndex) {
    const body = r.rigidBody;
    updateLaunchTower(r, deltaSeconds);

    if (r.state === "IGNITION") {
      return updateIgnitionState(r, deltaSeconds, body);
    }

    // ── STAGE1: 1단 연소 — 연속 중력 선회 (포물선 궤도) ──────
    if (r.state === "STAGE1") {
      r.stageTimer += deltaSeconds;

      const domeY1   = domeYAt(r.position.x, r.position.z);
      const altFrac1 = Math.min(1, Math.max(0,
        (r.position.y - r.startPos.y) / Math.max(0.001, domeY1 - r.startPos.y)
      ));

      // 연속 중력 선회: 고도에 따라 0° → 30° 포물선 기울기
      const turnProgress = Math.min(1, altFrac1 / getRocketStage1AltTrigger(r));
      const pitchAngle = turnProgress * turnProgress * getRocketPitchoverSeparationAngle(r);
      const desiredDir = computePitchProgramDirection(r.targetFlightDir, pitchAngle);
      const steeredDir = steerFlightDirection(r, desiredDir, deltaSeconds, getRocketStage1TurnRate(r));
      r.thrustDir.copy(steeredDir);

      const climbSpeed = getRocketStage1Speed(r) * (1.0 - LAUNCH_DRAG_FACTOR * altFrac1);
      applyFlightVelocity(r, steeredDir, climbSpeed, body);

      const pos1 = body.translation();
      r.position.set(pos1.x, pos1.y, pos1.z);

      // 로켓 자세를 thrustDir로 정렬 (포물선 궤적 따라)
      const tq1 = new THREE.Quaternion().setFromUnitVectors(_UP, r.thrustDir);
      r.mesh.quaternion.slerp(tq1, 5.0 * deltaSeconds);

      r.smokeTimer += deltaSeconds;
      if (r.smokeTimer > (0.04 * ASCENT_EXHAUST_INTERVAL_SCALE)) {
        const exhaustOrigin = getRocketExhaustWorldPosition(r, r.flame1);
        spawnAscentExhaust(
          exhaustOrigin.clone().addScaledVector(r.thrustDir.clone().negate(), S(0.012)),
          r.stageTimer,
          1.05
        );
        r.smokeTimer = 0;
      }

      // 돔 관통 방지
      if (r.position.y >= domeY1) {
        r.position.y = domeY1;
        body.setTranslation({ x: r.position.x, y: domeY1, z: r.position.z }, true);
        const cv = body.linvel();
        body.setLinvel({ x: cv.x, y: 0, z: cv.z }, true);
        captureFlightDirectionFromVelocity(r, { x: cv.x, y: 0, z: cv.z }, r.thrustDir);
        r.stage1ExitDir = r.flightDir.clone();
        r.pitchoverDir = r.flightDir.clone();
        r.sepVel = { x: cv.x, y: 0, z: cv.z };
        r.state = "SEPARATION"; r.stageTimer = 0;
        startStageSeparation(r);
      } else {
        // 80% 고도(30° 기울기) 도달 → 분리
        const domeFrac1 = altFrac1;
        if (domeFrac1 >= getRocketStage1AltTrigger(r) || r.stageTimer >= STAGE1_DURATION) {
          const cv = body.linvel();
          captureFlightDirectionFromVelocity(r, cv, r.thrustDir);
          r.stage1ExitDir = r.flightDir.clone();
          r.pitchoverDir = r.flightDir.clone();
          r.sepVel = { x: cv.x, y: cv.y, z: cv.z };
          r.state = "SEPARATION"; r.stageTimer = 0;
          startStageSeparation(r);
        }
      }

    // ── SEPARATION: 1단 분리 ──────────────────────────────
    } else if (r.state === "SEPARATION") {
      r.stageTimer += deltaSeconds;

      // 분리 중 관성 유지: 저장된 속도 그대로 유지 (중력에 의한 감속 방지)
      if (r.sepVel) {
        body.setLinvel(r.sepVel, true);
        captureFlightDirectionFromVelocity(r, r.sepVel, r.stage1ExitDir ?? r.targetFlightDir);
        r.velocity.set(r.sepVel.x, r.sepVel.y, r.sepVel.z);
      }

      const pos = body.translation();
      r.position.set(pos.x, pos.y, pos.z);

      // 분리 파티클
      if (r.stageTimer < SEP_DURATION * 0.7) {
        r.smokeTimer += deltaSeconds;
        if (r.smokeTimer > 0.025) {
          spawnSepParticle(r.position.clone());
          r.smokeTimer = 0;
        }
      }

      // 분리 완료 → 2단 점화
      if (r.stageTimer >= SEP_DURATION) {
        const exitVelocity = body.linvel();
        tempStageEntryDirection.copy(r.stage1ExitDir ?? r.targetFlightDir);
        captureFlightDirectionFromVelocity(r, exitVelocity, tempStageEntryDirection);
        r.stage2EntryDir = r.flightDir.clone();
        r.state          = "STAGE2";
        r.stageTimer     = 0;
        r.stage2StartPos = r.position.clone();
        setFlameHeat(r.flame2, 1, 1);
        r.engineHeat = 1;
      }

    // ── STAGE2: 2단 점화 — 궁창까지 상승 (연속 중력 선회) ────
    } else if (r.state === "STAGE2") {
      r.stageTimer += deltaSeconds;

      // 연속 중력 선회: 분리 완료 위치에서 돔까지 0→1로 매핑, 30°→72°까지 부드럽게 증가
      const domeY2       = domeYAt(r.position.x, r.position.z);
      const s2Base       = r.stage2StartPos ?? r.startPos;
      const stage2Progress = Math.min(1, Math.max(0,
        (r.position.y - s2Base.y) / Math.max(0.001, domeY2 - s2Base.y)
      ));
      const stage2Angle = getRocketPitchoverSeparationAngle(r)
        + stage2Progress * stage2Progress * (getRocketMaxPitchAngle(r) - getRocketPitchoverSeparationAngle(r));
      const desiredDir = computePitchProgramDirection(r.targetFlightDir, stage2Angle);

      if (r.stageTimer <= deltaSeconds) {
        tempStageEntryDirection.copy(r.stage2EntryDir ?? r.stage1ExitDir ?? desiredDir);
        initializeFlightDirection(r, tempStageEntryDirection);
        r.thrustDir.copy(r.flightDir);
      }

      const steeredDir = steerFlightDirection(r, desiredDir, deltaSeconds, getRocketStage2TurnRate(r));
      r.thrustDir.copy(steeredDir);

      // 점진적 가속: 분리 속도 → STAGE2_SPEED (0.8초에 걸쳐 ramp up)
      const rampT = Math.min(1.0, r.stageTimer / 0.8);
      const entrySpd = r.sepVel
        ? Math.hypot(r.sepVel.x, r.sepVel.y, r.sepVel.z)
        : getRocketStage1Speed(r);
      const rampSpeed = entrySpd + (getRocketStage2Speed(r) - entrySpd) * rampT;

      applyFlightVelocity(r, steeredDir, rampSpeed, body);

      const pos2 = body.translation();
      r.position.set(pos2.x, pos2.y, pos2.z);

      // 로켓 방향: 2단 추력 방향으로 기울기
      const tq2 = new THREE.Quaternion().setFromUnitVectors(_UP, steeredDir);
      r.mesh.quaternion.slerp(tq2, 6.0 * deltaSeconds);

      // 2단 배기 연기
      r.smokeTimer += deltaSeconds;
        if (r.smokeTimer > (0.035 * ASCENT_EXHAUST_INTERVAL_SCALE)) {
        const exhaustOrigin = getRocketExhaustWorldPosition(r, r.flame2 ?? r.flame1);
        spawnAscentExhaust(
          exhaustOrigin.clone().addScaledVector(steeredDir.clone().negate(), S(0.01)),
          r.stageTimer,
          0.95
        );
        r.smokeTimer = 0;
      }

      // 궁창 접촉(Y 클램프) 또는 연소 시간 초과 → SCRAPE
      if (r.position.y >= domeY2 || r.stageTimer >= STAGE2_DURATION) {
        // 관통 방지: Y를 돔 면에 고정
        const curVel = body.linvel();
        captureFlightDirectionFromVelocity(r, curVel, r.thrustDir);
        enterWaterScrapeState(r, curVel, r.targetFlightDir, body);
      }

    // ── LAUNCH: 단일 단계 수직 상승 ──────────────────────
    } else if (r.state === "LAUNCH") {
      const domeTopY = domeYAt(r.position.x, r.position.z);
      const altFrac  = Math.min(1.0, Math.max(0,
        (r.position.y - r.startPos.y) / Math.max(0.001, domeTopY - r.startPos.y)
      ));
      const turnProgress = Math.min(1, altFrac / getRocketStage1AltTrigger(r));
      const pitchAngle = turnProgress * turnProgress * getRocketPitchoverSeparationAngle(r);
      const desiredDir = computePitchProgramDirection(r.targetFlightDir, pitchAngle);
      const steeredDir = steerFlightDirection(r, desiredDir, deltaSeconds, getRocketStage1TurnRate(r));
      r.thrustDir.copy(steeredDir);

      const launchSpeed = getRocketStage1Speed(r) * (1.0 - LAUNCH_DRAG_FACTOR * altFrac);
      applyFlightVelocity(r, steeredDir, launchSpeed, body);

      const pos = body.translation();
      r.position.set(pos.x, pos.y, pos.z);

      r.mesh.quaternion.slerp(
        new THREE.Quaternion().setFromUnitVectors(_UP, steeredDir),
        5.0 * deltaSeconds
      );

      r.smokeTimer += deltaSeconds;
      if (r.smokeTimer > (0.05 * ASCENT_EXHAUST_INTERVAL_SCALE)) {
        const exhaustOrigin = getRocketExhaustWorldPosition(r, r.flame1);
        spawnAscentExhaust(
          exhaustOrigin.clone().addScaledVector(steeredDir.clone().negate(), S(0.01)),
          r.stageTimer,
          0.88
        );
        r.smokeTimer = 0;
      }

      const domeY = domeYAt(r.position.x, r.position.z);
      if (r.position.y >= domeY - S(0.04)) {
        const launchVel = body.linvel();
        captureFlightDirectionFromVelocity(r, launchVel, steeredDir);
        enterWaterScrapeState(r, launchVel, steeredDir, body);
      }

    // ── SCRAPE: 돔 표면 슬라이딩 (잔여추진력 + 유체저항) ──
    } else if (r.state === "SCRAPE") {
      // 잔여 추진력: 2단 연료 소진 전까지 헤딩 방향으로 계속 밀기
      const fuelLeft = Math.max(0, 1.0 - r.scrapeTimer / SCRAPE_FUEL_DURATION);
      r.waterEntryTimer += deltaSeconds;
      body.applyForce({
        x: r.scrapeDir.x * SCRAPE_RESIDUAL_THRUST * fuelLeft,
        y: 0,
        z: r.scrapeDir.z * SCRAPE_RESIDUAL_THRUST * fuelLeft
      }, true);

      // 궁창 유체저항: 이차(속도²) + 선형(점성)
      const velPre = body.linvel();
      const hSpeed = Math.hypot(velPre.x, velPre.z);
      if (hSpeed > 0.0001) {
        const { fluid, viscous } = getWaterDragCoefficients(r.waterEntryTimer);
        const fluidForce = fluid * hSpeed * hSpeed
                         + viscous * hSpeed;
        body.applyForce({
          x: -(velPre.x / hSpeed) * fluidForce,
          y: 0,
          z: -(velPre.z / hSpeed) * fluidForce
        }, true);
      }

      const pos = body.translation();
      r.position.set(pos.x, pos.y, pos.z);

      // 돔 표면에 Y 고정 (트라이메시 없이 코드로 제어)
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

      emitScrapeWaterEffects(r, moveDir.lengthSq() > 0 ? moveDir : r.scrapeDir, deltaSeconds);

      r.scrapeTimer += deltaSeconds;

      // 돔 경계 이탈 (안전장치)
      const outsideDome = (r.position.x * r.position.x + r.position.z * r.position.z)
        >= constants.DOME_RADIUS * constants.DOME_RADIUS * 0.97;

      // 유체저항으로 감속 → 정지 또는 돔 이탈 → 낙하
      const finalVel = body.linvel();
      const finalHSpeed = Math.hypot(finalVel.x, finalVel.z);
      const stoppedByFluid = finalHSpeed < DOME_WATER_STOP_SPEED;
      if (stoppedByFluid || r.scrapeTimer >= SCRAPE_FUEL_DURATION || outsideDome) {
        r.state = "FALL";
        if (r.membraneMesh) r.membraneMesh.visible = false;
      }

    // ── FALL: 낙하 ───────────────────────────────────────
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
      if (r.smokeTimer > (0.05 * FALL_SMOKE_INTERVAL_SCALE)) {
        const fallOrigin = getRocketDisplayPosition(r).clone();
        const tailDir = r.velocity.clone().negate().normalize();
        spawnSmoke(fallOrigin.addScaledVector(tailDir, S(0.04)));
        r.smokeTimer = 0;
      }

      if (r.position.y <= constants.SURFACE_Y) {
        return handleRocketRemoval(r, arrayIndex, body);
      }
    }

    return false;
  }

  // ─────────────────────────────────────────────────────
  //  Fallback 물리 (Rapier 미로드 시)
  // ─────────────────────────────────────────────────────
  function updateRocketFallback(r, deltaSeconds, arrayIndex) {
    const domeRadius   = constants.DOME_RADIUS;
    const domeBaseY    = constants.DOME_BASE_Y;
    const domeVertScale = constants.DOME_VERTICAL_SCALE;
    updateLaunchTower(r, deltaSeconds);

    if (r.state === "IGNITION") {
      return updateIgnitionState(r, deltaSeconds);
    }

    function fbDomeYAt(x, z) {
      const rSq = x * x + z * z;
      return domeBaseY + domeVertScale * Math.sqrt(Math.max(0, domeRadius * domeRadius - rSq));
    }

    // ── STAGE1 폴백 — 연속 중력 선회 (포물선 궤도) ──────────
    if (r.state === "STAGE1") {
      r.stageTimer += deltaSeconds;

      const fbDomeH1 = fbDomeYAt(r.position.x, r.position.z);
      const fbAlt1   = Math.min(1, Math.max(0,
        (r.position.y - r.startPos.y) / Math.max(0.001, fbDomeH1 - r.startPos.y)
      ));

      // 연속 중력 선회: 고도에 따라 0° → 30° 포물선 기울기
      const fbTurnP = Math.min(1, fbAlt1 / getRocketStage1AltTrigger(r));
      const fbPitchA = fbTurnP * fbTurnP * getRocketPitchoverSeparationAngle(r);
      const desiredDir = computePitchProgramDirection(r.targetFlightDir, fbPitchA);
      const steeredDir = steerFlightDirection(r, desiredDir, deltaSeconds, getRocketStage1TurnRate(r));
      r.thrustDir.copy(steeredDir);

      const fbClimb = getRocketStage1Speed(r) * (1.0 - LAUNCH_DRAG_FACTOR * fbAlt1);
      applyFlightVelocity(r, steeredDir, fbClimb);
      r.position.addScaledVector(r.velocity, deltaSeconds);

      const fbTq1 = new THREE.Quaternion().setFromUnitVectors(_UP, r.thrustDir);
      r.mesh.quaternion.slerp(fbTq1, 5.0 * deltaSeconds);

      r.smokeTimer += deltaSeconds;
      if (r.smokeTimer > (0.05 * ASCENT_EXHAUST_INTERVAL_SCALE)) {
        const exhaustOrigin = getRocketExhaustWorldPosition(r, r.flame1);
        spawnAscentExhaust(
          exhaustOrigin.clone().addScaledVector(r.thrustDir.clone().negate(), S(0.012)),
          r.stageTimer,
          1.05
        );
        r.smokeTimer = 0;
      }

      // 돔 관통 방지
      if (r.position.y >= fbDomeH1) {
        r.position.y = fbDomeH1;
        captureFlightDirectionFromVelocity(r, { x: r.velocity.x, y: 0, z: r.velocity.z }, r.thrustDir);
        r.stage1ExitDir = r.flightDir.clone();
        r.pitchoverDir = r.flightDir.clone();
        r.sepVel = { x: r.velocity.x, y: 0, z: r.velocity.z };
        r.state = "SEPARATION"; r.stageTimer = 0;
        startStageSeparation(r);
      } else {
        const fbDomeFrac = fbAlt1;
        if (fbDomeFrac >= getRocketStage1AltTrigger(r) || r.stageTimer >= STAGE1_DURATION) {
          captureFlightDirectionFromVelocity(r, r.velocity, r.thrustDir);
          r.stage1ExitDir = r.flightDir.clone();
          r.pitchoverDir = r.flightDir.clone();
          r.sepVel = { x: r.velocity.x, y: r.velocity.y, z: r.velocity.z };
          r.state = "SEPARATION"; r.stageTimer = 0;
          startStageSeparation(r);
        }
      }

    // ── SEPARATION 폴백 ──────────────────────────────────
    } else if (r.state === "SEPARATION") {
      r.stageTimer += deltaSeconds;
      // 분리 중 속도 유지 (관성 코스팅)
      if (r.sepVel) {
        r.velocity.set(r.sepVel.x, r.sepVel.y, r.sepVel.z);
        captureFlightDirectionFromVelocity(r, r.sepVel, r.stage1ExitDir ?? r.targetFlightDir);
        r.position.addScaledVector(r.velocity, deltaSeconds);
      }
      if (r.stageTimer >= SEP_DURATION) {
        tempStageEntryDirection.copy(r.stage1ExitDir ?? r.targetFlightDir);
        captureFlightDirectionFromVelocity(r, r.velocity, tempStageEntryDirection);
        r.stage2EntryDir = r.flightDir.clone();
        r.state          = "STAGE2";
        r.stageTimer     = 0;
        r.stage2StartPos = r.position.clone();
        setFlameHeat(r.flame2, 1, 1);
        r.engineHeat = 1;
      }

    // ── STAGE2 폴백 — 궁창까지 상승 (연속 중력 선회) ──────
    } else if (r.state === "STAGE2") {
      r.stageTimer += deltaSeconds;
      // 연속 중력 선회: 분리 완료 위치에서 돔까지 0→1로 매핑, 30°→72° 부드럽게 증가
      const fbDomeH2   = fbDomeYAt(r.position.x, r.position.z);
      const fbS2Base   = r.stage2StartPos ?? r.startPos;
      const fbS2Progress = Math.min(1, Math.max(0,
        (r.position.y - fbS2Base.y) / Math.max(0.001, fbDomeH2 - fbS2Base.y)
      ));
      const fbS2Angle = getRocketPitchoverSeparationAngle(r)
        + fbS2Progress * fbS2Progress * (getRocketMaxPitchAngle(r) - getRocketPitchoverSeparationAngle(r));
      const desiredDir = computePitchProgramDirection(r.targetFlightDir, fbS2Angle);

      if (r.stageTimer <= deltaSeconds) {
        tempStageEntryDirection.copy(r.stage2EntryDir ?? r.stage1ExitDir ?? desiredDir);
        initializeFlightDirection(r, tempStageEntryDirection);
        r.thrustDir.copy(r.flightDir);
      }

      const steeredDir = steerFlightDirection(r, desiredDir, deltaSeconds, getRocketStage2TurnRate(r));
      r.thrustDir.copy(steeredDir);

      const fbRampT = Math.min(1.0, r.stageTimer / 0.8);
      const fbEntrySpd = r.sepVel
        ? Math.hypot(r.sepVel.x, r.sepVel.y, r.sepVel.z)
        : getRocketStage1Speed(r);
      const fbRampSpeed = fbEntrySpd + (getRocketStage2Speed(r) - fbEntrySpd) * fbRampT;
      applyFlightVelocity(r, steeredDir, fbRampSpeed);
      r.position.addScaledVector(r.velocity, deltaSeconds);

      const tq2 = new THREE.Quaternion().setFromUnitVectors(_UP, steeredDir);
      r.mesh.quaternion.slerp(tq2, 6.0 * deltaSeconds);

      r.smokeTimer += deltaSeconds;
      if (r.smokeTimer > (0.035 * ASCENT_EXHAUST_INTERVAL_SCALE)) {
        const exhaustOrigin = getRocketExhaustWorldPosition(r, r.flame2 ?? r.flame1);
        spawnAscentExhaust(
          exhaustOrigin.clone().addScaledVector(steeredDir.clone().negate(), S(0.01)),
          r.stageTimer,
          0.95
        );
        r.smokeTimer = 0;
      }

      if (r.position.y >= fbDomeH2 || r.stageTimer >= STAGE2_DURATION) {
        r.position.y = Math.min(r.position.y, fbDomeH2);
        captureFlightDirectionFromVelocity(r, r.velocity, r.thrustDir);
        enterWaterScrapeState(r, r.velocity, r.targetFlightDir);
      }

    // ── LAUNCH 폴백 ──────────────────────────────────────
    } else if (r.state === "LAUNCH") {
      const fbDomeH  = fbDomeYAt(r.position.x, r.position.z);
      const fbAltFrac = Math.min(1.0, Math.max(0,
        (r.position.y - r.startPos.y) / Math.max(0.001, fbDomeH - r.startPos.y)
      ));
      const fbTurnP = Math.min(1, fbAltFrac / getRocketStage1AltTrigger(r));
      const fbPitchA = fbTurnP * fbTurnP * getRocketPitchoverSeparationAngle(r);
      const desiredDir = computePitchProgramDirection(r.targetFlightDir, fbPitchA);
      const steeredDir = steerFlightDirection(r, desiredDir, deltaSeconds, getRocketStage1TurnRate(r));
      r.thrustDir.copy(steeredDir);

      const fbSpeed = getRocketStage1Speed(r) * (1.0 - LAUNCH_DRAG_FACTOR * fbAltFrac);
      applyFlightVelocity(r, steeredDir, fbSpeed);
      r.position.addScaledVector(r.velocity, deltaSeconds);
      r.mesh.quaternion.slerp(
        new THREE.Quaternion().setFromUnitVectors(_UP, steeredDir),
        5.0 * deltaSeconds
      );

      r.smokeTimer += deltaSeconds;
      if (r.smokeTimer > (0.05 * ASCENT_EXHAUST_INTERVAL_SCALE)) {
        const exhaustOrigin = getRocketExhaustWorldPosition(r, r.flame1);
        spawnAscentExhaust(
          exhaustOrigin.clone().addScaledVector(steeredDir.clone().negate(), S(0.01)),
          r.stageTimer,
          0.88
        );
        r.smokeTimer = 0;
      }

      if (r.position.y >= fbDomeH) {
        r.position.y = fbDomeH;
        captureFlightDirectionFromVelocity(r, r.velocity, steeredDir);
        enterWaterScrapeState(r, r.velocity, steeredDir);
      } else if (r.position.y < constants.SURFACE_Y) {
        return handleRocketRemoval(r, arrayIndex);
      }

    // ── SCRAPE 폴백 (잔여추진력 + 유체저항) ─────────────
    } else if (r.state === "SCRAPE") {
      // 잔여 추진력
      const fbFuelLeft = Math.max(0, 1.0 - r.scrapeTimer / SCRAPE_FUEL_DURATION);
      r.waterEntryTimer += deltaSeconds;
      r.velocity.x += r.scrapeDir.x * SCRAPE_RESIDUAL_THRUST * fbFuelLeft * deltaSeconds;
      r.velocity.z += r.scrapeDir.z * SCRAPE_RESIDUAL_THRUST * fbFuelLeft * deltaSeconds;

      // 유체저항으로 감속
      const fbHSpd = Math.hypot(r.velocity.x, r.velocity.z);
      if (fbHSpd > 0.0001) {
        const { fluid, viscous } = getWaterDragCoefficients(r.waterEntryTimer);
        const fbForce = fluid * fbHSpd * fbHSpd
                      + viscous * fbHSpd;
        const fbDecel = fbForce * deltaSeconds; // a*dt 방식
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

      emitScrapeWaterEffects(r, moveDir, deltaSeconds);

      r.scrapeTimer += deltaSeconds;

      const fbOutsideDome = (r.position.x * r.position.x + r.position.z * r.position.z)
        >= domeRadius * domeRadius * 0.97;

      const fbFinalHSpd = Math.hypot(r.velocity.x, r.velocity.z);
      const fbStopped = fbFinalHSpd < DOME_WATER_STOP_SPEED;
      if (fbStopped || r.scrapeTimer >= SCRAPE_FUEL_DURATION || fbOutsideDome) {
        r.state = "FALL";
        if (r.membraneMesh) r.membraneMesh.visible = false;
        r.velocity.copy(actualVelocity);
      }

    // ── FALL 폴백 ─────────────────────────────────────────
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
      if (r.smokeTimer > (0.05 * FALL_SMOKE_INTERVAL_SCALE)) {
        const fallOrigin = getRocketDisplayPosition(r).clone();
        spawnSmoke(fallOrigin.addScaledVector(r.velocity.clone().negate().normalize(), S(0.04)));
        r.smokeTimer = 0;
      }
      if (r.position.y <= constants.SURFACE_Y) {
        return handleRocketRemoval(r, arrayIndex);
      }
    }

    return false;
  }

  function getTelemetry() {
    if (rockets.length === 0) return null;
    const r = rockets[rockets.length - 1]; // 가장 최근 로켓
    const velocity = getRocketVelocity(r);
    const speed = Math.hypot(velocity.x, velocity.y, velocity.z);
    const domeY = domeYAt(r.position.x, r.position.z);
    const altPct = Math.max(0, Math.min(100,
      ((r.position.y - (r.startPos?.y ?? 0)) / Math.max(0.001, domeY - (r.startPos?.y ?? 0))) * 100
    ));
    return {
      debrisCount: debris.length,
      engineHeat: r.engineHeat ?? 0,
      ignitionProgress: THREE.MathUtils.clamp(
        (r.ignitionTimer ?? 0) / Math.max(r.ignitionDuration ?? 1, 0.0001),
        0,
        1
      ),
      launchpadName: r.launchpadName ?? "",
      missionLabel: r.missionLabel ?? "",
      missionProfile: r.missionProfile ?? DEFAULT_MISSION_PROFILE_ID,
      state:     r.state,
      isTwoStage: r.isTwoStage,
      altitude:  altPct.toFixed(1),          // % of dome height
      speed:     (speed * 1000).toFixed(1),  // scaled for readability
      stageTimer: ((r.state === "IGNITION" ? r.ignitionTimer : r.stageTimer) ?? 0).toFixed(1),
      scrapeTimer: (r.scrapeTimer ?? 0).toFixed(1),
      vehicleLabel: r.vehicleLabel ?? ""
    };
  }

  return {
    clearStandby,
    enterStandby,
    getActiveRocketSnapshot,
    getLastCompletedLaunchpadName() {
      return lastCompletedLaunchpadName;
    },
    getStandbySnapshot,
    getTelemetry,
    launchRocket: launchRocketWithStandby,
    launchStandby,
    update
  };
}
