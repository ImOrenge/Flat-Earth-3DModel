import * as THREE from "./vendor/three.module.js";
import {
  getGeoFromProjectedPosition,
  projectedRadiusFromLatitude
} from "./modules/geo-utils.js";
import { createAstronomyController } from "./modules/astronomy-controller.js";
import { createCameraController } from "./modules/camera-controller.js";
import { createTextureManager } from "./modules/texture-manager.js";
import { createWalkerController } from "./modules/walker-controller.js";

const DEFAULT_MAP_PATH = "./assets/flat-earth-map-square.svg";
const DEFAULT_MAP_LABEL = "assets/flat-earth-map-square.svg";
const DISC_RADIUS = 5;
const DISC_HEIGHT = 0.36;
const RIM_THICKNESS = 0.28;
const RIM_CLEARANCE = 0.08;
const RIM_OUTER_RADIUS = DISC_RADIUS + RIM_CLEARANCE;
const RIM_INNER_RADIUS = DISC_RADIUS - RIM_THICKNESS;
const RIM_HEIGHT = 0.62;
const RIM_CENTER_Y = 0.11;
const RIM_TOP_Y = RIM_CENTER_Y + (RIM_HEIGHT / 2);
const RIM_BOTTOM_Y = RIM_CENTER_Y - (RIM_HEIGHT / 2);
const DOME_RADIUS = RIM_INNER_RADIUS - 0.14;
const DOME_BASE_Y = 0.46;
const TROPIC_LATITUDE = 23.44;
const ORBIT_TRACK_HEIGHT = DOME_BASE_Y + 2.01;
const ORBIT_SUN_HEIGHT = ORBIT_TRACK_HEIGHT + 0.04;
const ORBIT_SUN_HEIGHT_NORTH = ORBIT_SUN_HEIGHT + 0.18;
const ORBIT_SUN_HEIGHT_SOUTH = ORBIT_SUN_HEIGHT - 0.2;
const ORBIT_SUN_SIZE = 0.18;
const ORBIT_SUN_SPEED = 0.011;
const ORBIT_SUN_SEASON_SPEED = 0.0026;
const ORBIT_MOON_BASE_HEIGHT = ORBIT_TRACK_HEIGHT + 0.28;
const ORBIT_MOON_HEIGHT_NORTH = ORBIT_MOON_BASE_HEIGHT + 0.16;
const ORBIT_MOON_HEIGHT_SOUTH = ORBIT_MOON_BASE_HEIGHT - 0.26;
const ORBIT_MOON_SIZE = 0.13;
const ORBIT_MOON_SPEED = 0.0048;
const ORBIT_MOON_DRIFT_SPEED = 0.0021;
const ORBIT_MOON_RADIUS_SWAY = 0.7;
const ORBIT_MOON_FREE_OFFSET = 0.42;
const ORBIT_SURFACE_LINE_WIDTH = 0.0045;
const SUN_TRAIL_MAX_POINTS = 720;
const MOON_TRAIL_MAX_POINTS = 600;
const REALITY_TRAIL_WINDOW_MS = 12 * 60 * 60 * 1000;
const REALITY_TRAIL_REFRESH_MS = 60 * 1000;
const DAY_NIGHT_TEXTURE_SIZE = 512;
const DAY_NIGHT_UPDATE_EPSILON = 0.18;
const CAMERA_DEFAULT_FOV = 42;
const CAMERA_WALKER_FOV = 68;
const SURFACE_Y = DISC_HEIGHT / 2;
const WALKER_SURFACE_OFFSET = 0.045;
const WALKER_EYE_HEIGHT = SURFACE_Y + 0.16;
const WALKER_BODY_HEIGHT = 0.12;
const WALKER_BODY_RADIUS = 0.045;
const WALKER_SPEED = 1.5;
const WALKER_LOOK_DISTANCE = 0.95;
const WALKER_START_LATITUDE = 37.57;
const WALKER_START_LONGITUDE = 126.98;
const WALKER_GUIDE_Y = SURFACE_Y + 0.02;
const WALKER_GUIDE_HALF_WIDTH = 0.28;
const WALKER_GUIDE_START = 0.3;
const WALKER_GUIDE_LENGTH = 3.7;
const WALKER_GUIDE_MARK_SIZE = 0.1;
const WALKER_GUIDE_MARK_GAP = 0.5;
const WALKER_HORIZON_SHIFT_PX = 240;

const TROPIC_CANCER_RADIUS = projectedRadiusFromLatitude(TROPIC_LATITUDE, DISC_RADIUS);
const EQUATOR_RADIUS = projectedRadiusFromLatitude(0, DISC_RADIUS);
const TROPIC_CAPRICORN_RADIUS = projectedRadiusFromLatitude(-TROPIC_LATITUDE, DISC_RADIUS);
const ORBIT_RADIUS_MID = (TROPIC_CANCER_RADIUS + TROPIC_CAPRICORN_RADIUS) / 2;
const ORBIT_RADIUS_AMPLITUDE = (TROPIC_CAPRICORN_RADIUS - TROPIC_CANCER_RADIUS) / 2;
const ORBIT_MOON_RADIUS_BASE = ORBIT_RADIUS_MID + 0.35;

const canvas = document.getElementById("scene");
const firstPersonOverlayEl = document.getElementById("first-person-overlay");
const firstPersonHorizonEl = document.getElementById("first-person-horizon");
const statusEl = document.getElementById("status");
const uploadInput = document.getElementById("map-upload");
const resetButton = document.getElementById("reset-camera");
const orbitLabelEl = document.getElementById("orbit-label");
const orbitModeButtons = [...document.querySelectorAll("[data-orbit-mode]")];
const seasonLatitudeEl = document.getElementById("season-latitude");
const seasonSummaryEl = document.getElementById("season-summary");
const seasonDetailEl = document.getElementById("season-detail");
const realitySyncEl = document.getElementById("reality-sync");
const realityLiveEl = document.getElementById("reality-live");
const observationTimeEl = document.getElementById("observation-time");
const applyObservationTimeButton = document.getElementById("apply-observation-time");
const setCurrentTimeButton = document.getElementById("set-current-time");
const timeSummaryEl = document.getElementById("time-summary");
const sunCoordinatesEl = document.getElementById("sun-coordinates");
const moonCoordinatesEl = document.getElementById("moon-coordinates");
const dayNightOverlayEl = document.getElementById("day-night-overlay");
const dayNightSummaryEl = document.getElementById("day-night-summary");
const walkerModeEl = document.getElementById("walker-mode");
const walkerSummaryEl = document.getElementById("walker-summary");
const walkerCoordinatesEl = document.getElementById("walker-coordinates");
const walkerLightEl = document.getElementById("walker-light");
const resetWalkerButton = document.getElementById("reset-walker");

const orbitModes = {
  auto: {
    label: "?�동 모드: ?�양??북회귀?? ?�도, ?�회귀???�이�??�복?�니??"
  },
  north: {
    radius: TROPIC_CANCER_RADIUS,
    label: "북회귀??모드: ?�양??북회귀??궤도�??�라 공전?�니??"
  },
  equator: {
    radius: EQUATOR_RADIUS,
    label: "?�도 모드: ?�양???�도 궤도�??�라 공전?�니??"
  },
  south: {
    radius: TROPIC_CAPRICORN_RADIUS,
    label: "?�회귀??모드: ?�양???�회귀??궤도�??�라 공전?�니??"
  }
};

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: true
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x06101d, 14, 28);

const camera = new THREE.PerspectiveCamera(CAMERA_DEFAULT_FOV, 1, 0.1, 100);

const cameraState = {
  radius: 10.5,
  theta: -0.55,
  phi: 1.12,
  targetTheta: -0.55,
  targetPhi: 1.12,
  targetRadius: 10.5
};

const stage = new THREE.Group();
scene.add(stage);

const topMaterial = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  roughness: 0.9,
  metalness: 0.04
});

const sideMaterial = new THREE.MeshStandardMaterial({
  color: 0x202f3d,
  roughness: 0.82,
  metalness: 0.08
});

const bottomMaterial = new THREE.MeshStandardMaterial({
  color: 0x0c1624,
  roughness: 0.9,
  metalness: 0.04
});

const disc = new THREE.Mesh(
  new THREE.CylinderGeometry(DISC_RADIUS, DISC_RADIUS, DISC_HEIGHT, 128, 1, false),
  [sideMaterial, topMaterial, bottomMaterial]
);
stage.add(disc);

const transparentSurfaceMaterial = new THREE.MeshBasicMaterial({
  color: 0xffffff,
  transparent: true,
  opacity: 0,
  depthWrite: false,
  depthTest: false
});

const dayNightCanvas = document.createElement("canvas");
dayNightCanvas.width = DAY_NIGHT_TEXTURE_SIZE;
dayNightCanvas.height = DAY_NIGHT_TEXTURE_SIZE;
const dayNightCtx = dayNightCanvas.getContext("2d");
const dayNightTexture = new THREE.CanvasTexture(dayNightCanvas);
dayNightTexture.colorSpace = THREE.SRGBColorSpace;
dayNightTexture.wrapS = THREE.ClampToEdgeWrapping;
dayNightTexture.wrapT = THREE.ClampToEdgeWrapping;
dayNightTexture.flipY = false;
const dayNightOverlayMaterial = new THREE.MeshBasicMaterial({
  map: dayNightTexture,
  transparent: true,
  opacity: 0.88,
  depthWrite: false,
  depthTest: false,
  side: THREE.DoubleSide
});
const dayNightOverlay = new THREE.Mesh(
  new THREE.CylinderGeometry(DISC_RADIUS, DISC_RADIUS, 0.008, 128, 1, false),
  [transparentSurfaceMaterial, dayNightOverlayMaterial, transparentSurfaceMaterial]
);
dayNightOverlay.position.y = (DISC_HEIGHT / 2) + 0.03;
dayNightOverlay.renderOrder = 12;
stage.add(dayNightOverlay);

const northSeasonOverlay = new THREE.Mesh(
  new THREE.CircleGeometry(EQUATOR_RADIUS, 128),
  new THREE.MeshBasicMaterial({
    color: 0xffd77c,
    transparent: true,
    opacity: 0.1,
    depthWrite: false
  })
);
northSeasonOverlay.rotation.x = -Math.PI / 2;
northSeasonOverlay.position.y = (DISC_HEIGHT / 2) + 0.012;
northSeasonOverlay.renderOrder = 8;
stage.add(northSeasonOverlay);

const southSeasonOverlay = new THREE.Mesh(
  new THREE.RingGeometry(EQUATOR_RADIUS, DISC_RADIUS, 128),
  new THREE.MeshBasicMaterial({
    color: 0x7ed3ff,
    transparent: true,
    opacity: 0.08,
    depthWrite: false
  })
);
southSeasonOverlay.rotation.x = -Math.PI / 2;
southSeasonOverlay.position.y = (DISC_HEIGHT / 2) + 0.011;
southSeasonOverlay.renderOrder = 7;
stage.add(southSeasonOverlay);

const iceOuterMaterial = new THREE.MeshStandardMaterial({
  color: 0xf3f7ff,
  roughness: 0.72,
  metalness: 0.02
});

const iceInnerMaterial = new THREE.MeshStandardMaterial({
  color: 0xe4f0ff,
  roughness: 0.66,
  metalness: 0.02,
  side: THREE.BackSide
});

const iceCapMaterial = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  roughness: 0.62,
  metalness: 0.02,
  side: THREE.DoubleSide
});

const iceWallOuter = new THREE.Mesh(
  new THREE.CylinderGeometry(RIM_OUTER_RADIUS, RIM_OUTER_RADIUS, RIM_HEIGHT, 128, 1, true),
  iceOuterMaterial
);
iceWallOuter.position.y = RIM_CENTER_Y;
stage.add(iceWallOuter);

const iceWallInner = new THREE.Mesh(
  new THREE.CylinderGeometry(RIM_INNER_RADIUS, RIM_INNER_RADIUS, RIM_HEIGHT, 128, 1, true),
  iceInnerMaterial
);
iceWallInner.position.y = RIM_CENTER_Y;
stage.add(iceWallInner);

const iceTopCap = new THREE.Mesh(
  new THREE.RingGeometry(RIM_INNER_RADIUS, RIM_OUTER_RADIUS, 128),
  iceCapMaterial
);
iceTopCap.rotation.x = -Math.PI / 2;
iceTopCap.position.y = RIM_TOP_Y;
stage.add(iceTopCap);

const iceBottomCap = new THREE.Mesh(
  new THREE.RingGeometry(RIM_INNER_RADIUS, RIM_OUTER_RADIUS, 128),
  new THREE.MeshStandardMaterial({
    color: 0xdfe9f7,
    roughness: 0.74,
    metalness: 0.02,
    side: THREE.DoubleSide
  })
);
iceBottomCap.rotation.x = -Math.PI / 2;
iceBottomCap.position.y = RIM_BOTTOM_Y;
stage.add(iceBottomCap);

const iceCrown = new THREE.Mesh(
  new THREE.TorusGeometry((RIM_OUTER_RADIUS + RIM_INNER_RADIUS) / 2, 0.05, 12, 128),
  new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0x3a546f,
    emissiveIntensity: 0.18,
    roughness: 0.52,
    metalness: 0.03
  })
);
iceCrown.rotation.x = Math.PI / 2;
iceCrown.position.y = RIM_TOP_Y + 0.01;
stage.add(iceCrown);

const dome = new THREE.Mesh(
  new THREE.SphereGeometry(DOME_RADIUS, 96, 48, 0, Math.PI * 2, 0, Math.PI / 2),
  new THREE.MeshPhysicalMaterial({
    color: 0x9fd8ff,
    roughness: 0.08,
    metalness: 0,
    transmission: 0.72,
    transparent: true,
    opacity: 0.24,
    thickness: 0.18,
    ior: 1.22,
    side: THREE.DoubleSide
  })
);
dome.position.y = DOME_BASE_Y;
stage.add(dome);

const domeRing = new THREE.Mesh(
  new THREE.TorusGeometry(DOME_RADIUS, 0.045, 12, 96),
  new THREE.MeshStandardMaterial({
    color: 0xdff3ff,
    emissive: 0x23445e,
    emissiveIntensity: 0.35,
    roughness: 0.3,
    metalness: 0.06
  })
);
domeRing.rotation.x = Math.PI / 2;
domeRing.position.y = DOME_BASE_Y;
stage.add(domeRing);

const glow = new THREE.Mesh(
  new THREE.CircleGeometry(6.7, 96),
  new THREE.MeshBasicMaterial({
    color: 0x123a67,
    transparent: true,
    opacity: 0.18
  })
);
glow.rotation.x = -Math.PI / 2;
glow.position.y = -0.7;
stage.add(glow);

const walker = new THREE.Group();
const walkerBody = new THREE.Mesh(
  new THREE.CapsuleGeometry(WALKER_BODY_RADIUS, WALKER_BODY_HEIGHT, 6, 12),
  new THREE.MeshStandardMaterial({
    color: 0xf6fbff,
    emissive: 0x69b7ff,
    emissiveIntensity: 0.55,
    roughness: 0.42,
    metalness: 0.08
  })
);
walkerBody.position.y = WALKER_SURFACE_OFFSET + 0.09;
walker.add(walkerBody);

const walkerHeading = new THREE.Mesh(
  new THREE.ConeGeometry(0.045, 0.14, 18),
  new THREE.MeshStandardMaterial({
    color: 0xffd06e,
    emissive: 0xffb84d,
    emissiveIntensity: 0.75,
    roughness: 0.24,
    metalness: 0.05
  })
);
walkerHeading.rotation.x = Math.PI / 2;
walkerHeading.position.set(0, WALKER_SURFACE_OFFSET + 0.1, 0.13);
walker.add(walkerHeading);

const walkerRing = new THREE.Mesh(
  new THREE.RingGeometry(0.09, 0.11, 32),
  new THREE.MeshBasicMaterial({
    color: 0xb5e8ff,
    transparent: true,
    opacity: 0.7,
    side: THREE.DoubleSide,
    depthWrite: false
  })
);
walkerRing.rotation.x = -Math.PI / 2;
walkerRing.position.y = WALKER_SURFACE_OFFSET;
walker.add(walkerRing);
stage.add(walker);

function createWalkerGuideLine(color, opacity) {
  return new THREE.Line(
    new THREE.BufferGeometry(),
    new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity,
      depthWrite: false
    })
  );
}

const walkerGuideGroup = new THREE.Group();
const walkerGuideLeft = createWalkerGuideLine(0xa5ddff, 0.5);
const walkerGuideRight = createWalkerGuideLine(0xa5ddff, 0.5);
const walkerGuideCenter = new THREE.LineSegments(
  new THREE.BufferGeometry(),
  new THREE.LineBasicMaterial({
    color: 0xf3fbff,
    transparent: true,
    opacity: 0.6,
    depthWrite: false
  })
);
walkerGuideGroup.add(walkerGuideLeft, walkerGuideRight, walkerGuideCenter);
walkerGuideGroup.visible = false;
stage.add(walkerGuideGroup);

const ambient = new THREE.AmbientLight(0xc5d7ff, 0.9);
scene.add(ambient);

const keyLight = new THREE.DirectionalLight(0xeaf4ff, 1.35);
keyLight.position.set(5, 7, 6);
scene.add(keyLight);

const rimLight = new THREE.DirectionalLight(0x8fd9ff, 0.42);
rimLight.position.set(-7, 4, -5);
scene.add(rimLight);

const orbitSun = new THREE.Group();
const orbitSunBody = new THREE.Mesh(
  new THREE.SphereGeometry(ORBIT_SUN_SIZE, 32, 24),
  new THREE.MeshStandardMaterial({
    color: 0xffd56f,
    emissive: 0xffb42f,
    emissiveIntensity: 3.8,
    roughness: 0.16,
    metalness: 0.02
  })
);
orbitSun.add(orbitSunBody);

const orbitSunHalo = new THREE.Mesh(
  new THREE.SphereGeometry(ORBIT_SUN_SIZE * 2.2, 24, 16),
  new THREE.MeshBasicMaterial({
    color: 0xffd781,
    transparent: true,
    opacity: 0.28,
    side: THREE.DoubleSide
  })
);
orbitSun.add(orbitSunHalo);

const orbitSunLight = new THREE.PointLight(0xffcf75, 22, 9.5, 1.4);
orbitSun.add(orbitSunLight);
stage.add(orbitSun);

const orbitMoon = new THREE.Group();
const orbitMoonBody = new THREE.Mesh(
  new THREE.SphereGeometry(ORBIT_MOON_SIZE, 32, 24),
  new THREE.MeshStandardMaterial({
    color: 0xd8deea,
    emissive: 0xa8b6d4,
    emissiveIntensity: 1.2,
    roughness: 0.42,
    metalness: 0.82
  })
);
orbitMoon.add(orbitMoonBody);

const orbitMoonHalo = new THREE.Mesh(
  new THREE.SphereGeometry(ORBIT_MOON_SIZE * 2.4, 24, 16),
  new THREE.MeshBasicMaterial({
    color: 0xcfd8f7,
    transparent: true,
    opacity: 0.15,
    side: THREE.DoubleSide
  })
);
orbitMoon.add(orbitMoonHalo);

const orbitMoonLight = new THREE.PointLight(0xdbe4ff, 5.6, 5.5, 1.9);
orbitMoon.add(orbitMoonLight);
stage.add(orbitMoon);

const sunTrailGeometry = new THREE.BufferGeometry();
const sunTrailMaterial = new THREE.LineBasicMaterial({
  color: 0xffdc85,
  transparent: true,
  opacity: 0.95,
  depthWrite: false,
  depthTest: false
});
const sunTrail = new THREE.Line(sunTrailGeometry, sunTrailMaterial);
stage.add(sunTrail);

const sunTrailPointsGeometry = new THREE.BufferGeometry();
const sunTrailPointsMaterial = new THREE.PointsMaterial({
  color: 0xffef9a,
  size: 0.09,
  sizeAttenuation: true,
  transparent: true,
  opacity: 0.95,
  depthWrite: false,
  depthTest: false
});
const sunTrailPointsCloud = new THREE.Points(sunTrailPointsGeometry, sunTrailPointsMaterial);
stage.add(sunTrailPointsCloud);

const moonTrailGeometry = new THREE.BufferGeometry();
const moonTrailMaterial = new THREE.LineBasicMaterial({
  color: 0xd7def2,
  transparent: true,
  opacity: 0.72,
  depthWrite: false,
  depthTest: false
});
const moonTrail = new THREE.Line(moonTrailGeometry, moonTrailMaterial);
stage.add(moonTrail);

const moonTrailPointsGeometry = new THREE.BufferGeometry();
const moonTrailPointsMaterial = new THREE.PointsMaterial({
  color: 0xf4f7ff,
  size: 0.07,
  sizeAttenuation: true,
  transparent: true,
  opacity: 0.78,
  depthWrite: false,
  depthTest: false
});
const moonTrailPointsCloud = new THREE.Points(moonTrailPointsGeometry, moonTrailPointsMaterial);
stage.add(moonTrailPointsCloud);

function createOrbitTrack(radius, color, opacity) {
  const track = new THREE.Mesh(
    new THREE.TorusGeometry(radius, 0.04, 16, 192),
    new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.95,
      transparent: true,
      opacity,
      roughness: 0.18,
      metalness: 0.06
    })
  );
  track.rotation.x = Math.PI / 2;
  track.position.y = ORBIT_TRACK_HEIGHT;
  return track;
}

stage.add(createOrbitTrack(TROPIC_CANCER_RADIUS, 0xffc96c, 0.82));
stage.add(createOrbitTrack(EQUATOR_RADIUS, 0x7fd8ff, 0.78));
stage.add(createOrbitTrack(TROPIC_CAPRICORN_RADIUS, 0xff93b6, 0.82));

const simulationState = {
  orbitMoonAngle: Math.PI * 0.35,
  orbitMoonDriftPhase: Math.PI * 0.18,
  orbitMode: "auto",
  orbitSeasonPhase: -Math.PI / 2,
  orbitSunAngle: 0
};
const astronomyState = {
  enabled: true,
  live: true,
  selectedDate: new Date(),
  lastTrailRebuildMs: 0,
  lastInputSyncMs: 0
};
const dayNightState = {
  enabled: true,
  lastLatitudeDegrees: null,
  lastLongitudeDegrees: null
};
const walkerState = {
  enabled: false,
  heading: Math.PI * 0.1,
  pitch: -0.08,
  position: new THREE.Vector3(),
  velocity: new THREE.Vector3(),
  lastLightLabel: "",
  lastCoordinatesLabel: ""
};
const movementState = {
  forward: false,
  backward: false,
  left: false,
  right: false
};

const starCanvas = document.createElement("canvas");
starCanvas.width = 1024;
starCanvas.height = 1024;
const starCtx = starCanvas.getContext("2d");
starCtx.fillStyle = "#040912";
starCtx.fillRect(0, 0, starCanvas.width, starCanvas.height);
for (let i = 0; i < 500; i += 1) {
  const x = Math.random() * starCanvas.width;
  const y = Math.random() * starCanvas.height;
  const size = Math.random() * 2.2;
  const alpha = 0.18 + Math.random() * 0.82;
  starCtx.fillStyle = `rgba(240,245,255,${alpha})`;
  starCtx.beginPath();
  starCtx.arc(x, y, size, 0, Math.PI * 2);
  starCtx.fill();
}

const skyTexture = new THREE.CanvasTexture(starCanvas);
skyTexture.colorSpace = THREE.SRGBColorSpace;
scene.background = skyTexture;
const clock = new THREE.Clock();

const constants = {
  CAMERA_DEFAULT_FOV,
  CAMERA_WALKER_FOV,
  DAY_NIGHT_UPDATE_EPSILON,
  DEFAULT_MAP_LABEL,
  DEFAULT_MAP_PATH,
  DISC_RADIUS,
  DOME_BASE_Y,
  DOME_RADIUS,
  EQUATOR_RADIUS,
  MOON_TRAIL_MAX_POINTS,
  ORBIT_MOON_BASE_HEIGHT,
  ORBIT_MOON_FREE_OFFSET,
  ORBIT_MOON_HEIGHT_NORTH,
  ORBIT_MOON_HEIGHT_SOUTH,
  ORBIT_MOON_RADIUS_BASE,
  ORBIT_MOON_RADIUS_SWAY,
  ORBIT_MOON_SIZE,
  ORBIT_RADIUS_AMPLITUDE,
  ORBIT_RADIUS_MID,
  ORBIT_SUN_HEIGHT_NORTH,
  ORBIT_SUN_HEIGHT_SOUTH,
  ORBIT_SURFACE_LINE_WIDTH,
  REALITY_TRAIL_REFRESH_MS,
  REALITY_TRAIL_WINDOW_MS,
  SUN_TRAIL_MAX_POINTS,
  TROPIC_CANCER_RADIUS,
  TROPIC_CAPRICORN_RADIUS,
  TROPIC_LATITUDE,
  WALKER_EYE_HEIGHT,
  WALKER_GUIDE_HALF_WIDTH,
  WALKER_GUIDE_LENGTH,
  WALKER_GUIDE_MARK_GAP,
  WALKER_GUIDE_MARK_SIZE,
  WALKER_GUIDE_START,
  WALKER_GUIDE_Y,
  WALKER_HORIZON_SHIFT_PX,
  WALKER_LOOK_DISTANCE,
  WALKER_SPEED,
  WALKER_START_LATITUDE,
  WALKER_START_LONGITUDE,
  WALKER_SURFACE_OFFSET
};

const ui = {
  applyObservationTimeButton,
  dayNightOverlayEl,
  dayNightSummaryEl,
  firstPersonHorizonEl,
  firstPersonOverlayEl,
  moonCoordinatesEl,
  observationTimeEl,
  orbitLabelEl,
  realityLiveEl,
  realitySyncEl,
  seasonDetailEl,
  seasonLatitudeEl,
  seasonSummaryEl,
  statusEl,
  sunCoordinatesEl,
  timeSummaryEl,
  walkerCoordinatesEl,
  walkerLightEl,
  walkerModeEl,
  walkerSummaryEl
};

const textureApi = createTextureManager({
  constants,
  renderer,
  topMaterial,
  statusEl
});

const cameraApi = createCameraController({
  camera,
  cameraState,
  constants,
  renderer,
  walkerState
});

const astronomyApi = createAstronomyController({
  constants,
  ui,
  astronomyState,
  dayNightState,
  simulationState,
  orbitModes,
  orbitModeButtons,
  dayNightCanvas,
  dayNightCtx,
  dayNightTexture,
  dayNightOverlay,
  orbitMoon,
  orbitSun,
  moonTrailGeometry,
  moonTrailPointsGeometry,
  northSeasonOverlay,
  southSeasonOverlay,
  sunTrailGeometry,
  sunTrailPointsGeometry
});

const walkerApi = createWalkerController({
  constants,
  walkerState,
  movementState,
  ui,
  walker,
  walkerGuideGroup,
  walkerGuideLeft,
  walkerGuideRight,
  walkerGuideCenter,
  ambient,
  keyLight,
  rimLight
});

let isDragging = false;
let previousX = 0;
let previousY = 0;

canvas.addEventListener("pointerdown", (event) => {
  isDragging = true;
  previousX = event.clientX;
  previousY = event.clientY;
  canvas.setPointerCapture(event.pointerId);
});

canvas.addEventListener("pointermove", (event) => {
  if (!isDragging) {
    return;
  }

  const deltaX = event.clientX - previousX;
  const deltaY = event.clientY - previousY;

  if (walkerState.enabled) {
    walkerState.heading -= deltaX * 0.005;
    walkerState.pitch = THREE.MathUtils.clamp(walkerState.pitch - (deltaY * 0.004), -0.42, 0.35);
  } else {
    cameraState.targetTheta -= deltaX * 0.008;
    cameraState.targetPhi += deltaY * 0.006;
    cameraApi.clampCamera();
  }

  previousX = event.clientX;
  previousY = event.clientY;
});

function stopDrag(event) {
  if (!isDragging) {
    return;
  }
  isDragging = false;
  if (event) {
    canvas.releasePointerCapture(event.pointerId);
  }
}

canvas.addEventListener("pointerup", stopDrag);
canvas.addEventListener("pointerleave", stopDrag);
canvas.addEventListener("pointercancel", stopDrag);

canvas.addEventListener("wheel", (event) => {
  if (walkerState.enabled) {
    return;
  }
  event.preventDefault();
  cameraState.targetRadius += event.deltaY * 0.01;
  cameraApi.clampCamera();
}, { passive: false });

uploadInput.addEventListener("change", (event) => {
  const file = event.target.files[0];
  textureApi.loadUserTexture(file);
});

resetButton.addEventListener("click", () => {
  if (walkerState.enabled) {
    walkerState.enabled = false;
    walkerApi.syncWalkerUi();
    walkerApi.updateWalkerAvatar();
  }
  cameraState.targetTheta = -0.55;
  cameraState.targetPhi = 1.12;
  cameraState.targetRadius = 10.5;
});

walkerModeEl.addEventListener("change", () => {
  walkerState.enabled = walkerModeEl.checked;
  walkerApi.syncWalkerUi();
  walkerApi.updateWalkerAvatar();
});

resetWalkerButton.addEventListener("click", () => {
  walkerApi.resetWalkerPosition();
  walkerState.heading = Math.PI * 0.1;
  walkerState.pitch = -0.08;
  walkerApi.updateWalkerAvatar();
});

realitySyncEl.addEventListener("change", () => {
  if (realitySyncEl.checked) {
    const nextDate = realityLiveEl.checked ? new Date() : new Date(observationTimeEl.value);
    astronomyApi.enableRealityMode({
      live: realityLiveEl.checked,
      date: Number.isNaN(nextDate.getTime()) ? new Date() : nextDate
    });
    return;
  }
  astronomyApi.disableRealityMode();
});

realityLiveEl.addEventListener("change", () => {
  if (!realitySyncEl.checked) {
    realityLiveEl.checked = false;
    return;
  }
  if (realityLiveEl.checked) {
    astronomyApi.enableRealityMode({ live: true, date: new Date() });
    return;
  }
  astronomyApi.applyObservationTimeSelection();
});

observationTimeEl.addEventListener("change", () => {
  if (!realitySyncEl.checked) {
    realitySyncEl.checked = true;
  }
  realityLiveEl.checked = false;
  astronomyApi.applyObservationTimeSelection();
});

applyObservationTimeButton.addEventListener("click", () => {
  if (!realitySyncEl.checked) {
    realitySyncEl.checked = true;
  }
  realityLiveEl.checked = false;
  astronomyApi.applyObservationTimeSelection();
});

setCurrentTimeButton.addEventListener("click", () => {
  realitySyncEl.checked = true;
  realityLiveEl.checked = true;
  astronomyApi.enableRealityMode({ live: true, date: new Date() });
});

dayNightOverlayEl.addEventListener("change", () => {
  dayNightState.enabled = dayNightOverlayEl.checked;
  dayNightState.lastLatitudeDegrees = null;
  dayNightState.lastLongitudeDegrees = null;
  astronomyApi.syncDayNightOverlayUi();

  if (astronomyState.enabled) {
    const observationDate = astronomyState.live ? new Date() : astronomyState.selectedDate;
    const snapshot = astronomyApi.getAstronomySnapshot(observationDate);
    astronomyApi.updateDayNightOverlayFromSun(snapshot.sun.latitudeDegrees, snapshot.sun.longitudeDegrees, true);
    return;
  }

  const demoSunGeo = getGeoFromProjectedPosition(orbitSun.position, DISC_RADIUS);
  astronomyApi.updateDayNightOverlayFromSun(demoSunGeo.latitudeDegrees, demoSunGeo.longitudeDegrees, true);
});

for (const button of orbitModeButtons) {
  button.addEventListener("click", () => {
    simulationState.orbitMode = button.dataset.orbitMode;
    astronomyApi.updateOrbitModeUi();
    astronomyApi.resetSunTrail();
    astronomyApi.resetMoonTrail();
  });
}

window.addEventListener("resize", () => {
  cameraApi.resize();
});

window.addEventListener("keydown", (event) => {
  if (event.repeat) {
    return;
  }

  switch (event.code) {
    case "KeyW":
    case "ArrowUp":
      movementState.forward = true;
      event.preventDefault();
      break;
    case "KeyS":
    case "ArrowDown":
      movementState.backward = true;
      event.preventDefault();
      break;
    case "KeyA":
    case "ArrowLeft":
      movementState.left = true;
      event.preventDefault();
      break;
    case "KeyD":
    case "ArrowRight":
      movementState.right = true;
      event.preventDefault();
      break;
    default:
      break;
  }
});

window.addEventListener("keyup", (event) => {
  switch (event.code) {
    case "KeyW":
    case "ArrowUp":
      movementState.forward = false;
      break;
    case "KeyS":
    case "ArrowDown":
      movementState.backward = false;
      break;
    case "KeyA":
    case "ArrowLeft":
      movementState.left = false;
      break;
    case "KeyD":
    case "ArrowRight":
      movementState.right = false;
      break;
    default:
      break;
  }
});

function animate() {
  requestAnimationFrame(animate);
  const deltaSeconds = Math.min(clock.getDelta(), 0.05);
  let snapshot;

  if (astronomyState.enabled) {
    const observationDate = astronomyState.live ? new Date() : astronomyState.selectedDate;
    if (astronomyState.live) {
      astronomyState.selectedDate = observationDate;
      astronomyApi.syncLiveObservationInput(observationDate);
    }
    stage.rotation.y += (0 - stage.rotation.y) * 0.08;
    snapshot = astronomyApi.getAstronomySnapshot(observationDate);
    astronomyApi.applyAstronomySnapshot(snapshot);
  } else {
    if (walkerState.enabled) {
      stage.rotation.y += (0 - stage.rotation.y) * 0.08;
    } else {
      stage.rotation.y += 0.0017;
    }
    simulationState.orbitSunAngle += ORBIT_SUN_SPEED;
    if (simulationState.orbitMode === "auto") {
      simulationState.orbitSeasonPhase += ORBIT_SUN_SEASON_SPEED;
    }
    simulationState.orbitMoonAngle += ORBIT_MOON_SPEED;
    simulationState.orbitMoonDriftPhase += ORBIT_MOON_DRIFT_SPEED;
    const orbitRadius = astronomyApi.getCurrentOrbitRadius();
    orbitSun.position.set(
      Math.cos(simulationState.orbitSunAngle) * orbitRadius,
      astronomyApi.getSunOrbitHeight(orbitRadius),
      Math.sin(simulationState.orbitSunAngle) * orbitRadius
    );
    astronomyApi.updateSunTrail();
    astronomyApi.updateMoonOrbit(orbitRadius);
    astronomyApi.updateMoonTrail();
    astronomyApi.updateSeasonPresentation(orbitRadius);
    const demoSunGeo = getGeoFromProjectedPosition(orbitSun.position, DISC_RADIUS);
    astronomyApi.updateDayNightOverlayFromSun(demoSunGeo.latitudeDegrees, demoSunGeo.longitudeDegrees);
    snapshot = {
      sun: demoSunGeo,
      moon: getGeoFromProjectedPosition(orbitMoon.position, DISC_RADIUS)
    };
  }

  walkerApi.updateWalkerMovement(deltaSeconds);
  walkerApi.updateWalkerAvatar();
  walkerApi.updateWalkerPerspectiveGuides();
  walkerApi.updateFirstPersonOverlay();
  if (snapshot) {
    walkerApi.updateWalkerUi(snapshot);
  }
  cameraApi.updateCamera();
  renderer.render(scene, camera);
}

cameraApi.resize();
textureApi.loadDefaultTexture();
walkerApi.resetWalkerPosition();
walkerApi.updateWalkerAvatar();
astronomyApi.setObservationInputValue(astronomyState.selectedDate);
astronomyApi.syncDayNightOverlayUi();
walkerApi.syncWalkerUi();
astronomyApi.enableRealityMode({ live: true, date: astronomyState.selectedDate });
animate();

