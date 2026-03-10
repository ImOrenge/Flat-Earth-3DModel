import * as THREE from "./vendor/three.module.js";
import {
  getGeoFromProjectedPosition,
  projectedRadiusFromLatitude
} from "./modules/geo-utils.js";
import {
  getMoonHorizontalCoordinates,
  getSolarAltitudeFactor,
  getSunHorizontalCoordinates
} from "./modules/astronomy-utils.js";
import { createAstronomyController } from "./modules/astronomy-controller.js";
import { createCameraController } from "./modules/camera-controller.js";
import { createFirstPersonWorldController } from "./modules/first-person-world-controller.js";
import { createRouteSimulationController } from "./modules/route-simulation-controller.js";
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
const DOME_VERTICAL_SCALE = 0.78;
const CELESTIAL_HEIGHT_DROP = 0.42;
const CELESTIAL_ALTITUDE_DROP_DEGREES = 6;
const POLARIS_ALTITUDE_OFFSET = 0.08;
const POLARIS_CORE_RADIUS = 0.07;
const POLARIS_GLOW_SIZE = 0.42;
const POLARIS_HALO_SIZE = 0.78;
const POLARIS_CORE_OPACITY = 1;
const POLARIS_GLOW_OPACITY = 1;
const POLARIS_HALO_OPACITY = 0.48;
const TROPIC_LATITUDE = 23.44;
const ORBIT_TRACK_HEIGHT = DOME_BASE_Y + 2.01 - CELESTIAL_HEIGHT_DROP;
const ORBIT_SUN_HEIGHT = ORBIT_TRACK_HEIGHT + 0.12;
const ORBIT_SUN_HEIGHT_NORTH = ORBIT_SUN_HEIGHT + 0.52;
const ORBIT_SUN_HEIGHT_SOUTH = ORBIT_SUN_HEIGHT - 0.56;
const CELESTIAL_BODY_SIZE = 0.13;
const ORBIT_SUN_SIZE = CELESTIAL_BODY_SIZE;
const ORBIT_SUN_SPEED = 0.011;
const ORBIT_SUN_SEASON_SPEED = 0.0026;
const ORBIT_SUN_HALO_OPACITY = 0.2;
const ORBIT_SUN_LIGHT_INTENSITY = 32;
const ORBIT_SUN_BODY_EMISSIVE_INTENSITY = 5.4;
const ORBIT_TRACK_TUBE_RADIUS = 0.045;
const ORBIT_HEIGHT_GUIDE_RADIUS = 0.018;
const ORBIT_HEIGHT_GUIDE_MARKER_SIZE = 0.05;
const ORBIT_HEIGHT_GUIDE_ANGLES = [-0.82, 1.34, 2.58];
const ORBIT_MOON_BASE_HEIGHT = ORBIT_TRACK_HEIGHT + 0.28;
const ORBIT_MOON_HEIGHT_NORTH = ORBIT_MOON_BASE_HEIGHT + 0.16;
const ORBIT_MOON_HEIGHT_SOUTH = ORBIT_MOON_BASE_HEIGHT - 0.26;
const ORBIT_MOON_SIZE = CELESTIAL_BODY_SIZE;
const ORBIT_MOON_HALO_OPACITY = 0.24;
const ORBIT_MOON_LIGHT_INTENSITY = 8.4;
const ORBIT_MOON_BODY_EMISSIVE_INTENSITY = 1.8;
const ORBIT_MOON_SPEED = 0.0048;
const ORBIT_SURFACE_LINE_WIDTH = 0.0045;
const SUN_TRAIL_MAX_POINTS = 720;
const MOON_TRAIL_MAX_POINTS = 600;
const REALITY_TRAIL_WINDOW_MS = 12 * 60 * 60 * 1000;
const REALITY_TRAIL_REFRESH_MS = 60 * 1000;
const DAY_NIGHT_TEXTURE_SIZE = 512;
const DAY_NIGHT_UPDATE_EPSILON = 0.18;
const ANALEMMA_SURFACE_OFFSET = 0.046;
const SKY_ANALEMMA_RADIUS = 2.4;
const MAP_TEXTURE_SIZE = 8192;
const CAMERA_DEFAULT_FOV = 42;
const CAMERA_WALKER_FOV = 54;
const CAMERA_TOPDOWN_DEFAULT_RADIUS = 8.2;
const CAMERA_TOPDOWN_MIN_RADIUS = 5.9;
const CAMERA_TOPDOWN_MAX_RADIUS = 18.5;
const TOPDOWN_STAGE_SCALE = 1.32;
const FOG_DEFAULT_NEAR = 14;
const FOG_DEFAULT_FAR = 28;
const FOG_WALKER_NEAR = 36;
const FOG_WALKER_FAR = 180;
const FIRST_PERSON_STAGE_SCALE = 10;
const FIRST_PERSON_WORLD_RADIUS = 240;
const FIRST_PERSON_HORIZON_RADIUS = 228;
const FIRST_PERSON_SKY_RADIUS = 300;
const FIRST_PERSON_PREP_DURATION_MS = 1250;
const FIRST_PERSON_RETURN_DURATION_MS = 420;
const FIRST_PERSON_CELESTIAL_NEAR_RADIUS = 32;
const FIRST_PERSON_CELESTIAL_FAR_RADIUS = 74;
const FIRST_PERSON_CELESTIAL_FADE_RANGE = 5;
const FIRST_PERSON_HORIZON_OCCLUSION_RANGE = 8;
const FIRST_PERSON_HORIZON_SINK = 2.6;
const FIRST_PERSON_CELESTIAL_SCALE = 4.4;
const FIRST_PERSON_SUN_SCALE = FIRST_PERSON_CELESTIAL_SCALE;
const FIRST_PERSON_MOON_SCALE = FIRST_PERSON_CELESTIAL_SCALE;
const FIRST_PERSON_SUN_RAY_LENGTH = 13;
const FIRST_PERSON_SUN_RAY_WIDTH = 1.5;
const FIRST_PERSON_SUN_RAY_SHORT_LENGTH = 7.4;
const FIRST_PERSON_SUN_RAY_SHORT_WIDTH = 0.72;
const FIRST_PERSON_SUN_RAY_ALIGNMENT_START = 0.72;
const FIRST_PERSON_SUN_RAY_ALIGNMENT_END = 0.96;
const SURFACE_Y = DISC_HEIGHT / 2;
const WALKER_SURFACE_OFFSET = 0.045;
const WALKER_EYE_HEIGHT = SURFACE_Y + 0.07;
const WALKER_BODY_HEIGHT = 0.12;
const WALKER_BODY_RADIUS = 0.045;
const WALKER_SPEED = 0.82;
const WALKER_LOOK_DISTANCE = 0.95;
const WALKER_START_LATITUDE = 37.57;
const WALKER_START_LONGITUDE = 126.98;
const WALKER_PITCH_MAX = 0.72;
const WALKER_PITCH_MIN = -1.08;
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

const canvas = document.getElementById("scene");
const firstPersonOverlayEl = document.getElementById("first-person-overlay");
const firstPersonHorizonEl = document.getElementById("first-person-horizon");
const firstPersonPrepEl = document.getElementById("first-person-prep");
const firstPersonPrepTitleEl = document.getElementById("first-person-prep-title");
const firstPersonPrepCopyEl = document.getElementById("first-person-prep-copy");
const firstPersonPrepBarFillEl = document.getElementById("first-person-prep-bar-fill");
const firstPersonPrepProgressEl = document.getElementById("first-person-prep-progress");
const statusEl = document.getElementById("status");
const uploadInput = document.getElementById("map-upload");
const resetButton = document.getElementById("reset-camera");
const controlTabButtons = [...document.querySelectorAll("[data-control-tab]")];
const controlTabPanels = [...document.querySelectorAll("[data-control-panel]")];
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
const analemmaOverlayEl = document.getElementById("analemma-overlay");
const analemmaSummaryEl = document.getElementById("analemma-summary");
const skyAnalemmaOverlayEl = document.getElementById("sky-analemma-overlay");
const skyAnalemmaSummaryEl = document.getElementById("sky-analemma-summary");
const seasonalYearEl = document.getElementById("seasonal-year");
const seasonalEventTimeEl = document.getElementById("seasonal-event-time");
const seasonalMoonAnchorEl = document.getElementById("seasonal-moon-anchor");
const seasonalMoonDriftEl = document.getElementById("seasonal-moon-drift");
const seasonalMoonSummaryEl = document.getElementById("seasonal-moon-summary");
const seasonalSunSummaryEl = document.getElementById("seasonal-sun-summary");
const seasonalSunGridEl = document.getElementById("seasonal-sun-grid");
const seasonalEventButtons = [...document.querySelectorAll("[data-seasonal-event]")];
const walkerModeEl = document.getElementById("walker-mode");
const walkerSummaryEl = document.getElementById("walker-summary");
const walkerCoordinatesEl = document.getElementById("walker-coordinates");
const walkerLightEl = document.getElementById("walker-light");
const resetWalkerButton = document.getElementById("reset-walker");
const routeDatasetStatusEl = document.getElementById("route-dataset-status");
const routeSelectEl = document.getElementById("route-select");
const routeSpeedEl = document.getElementById("route-speed");
const routeSpeedValueEl = document.getElementById("route-speed-value");
const routePlaybackButton = document.getElementById("route-playback");
const routeResetButton = document.getElementById("route-reset");
const routeSummaryEl = document.getElementById("route-summary");
const routeLegEl = document.getElementById("route-leg");
const routeAircraftEl = document.getElementById("route-aircraft");
const routeOriginEl = document.getElementById("route-origin");
const routeDestinationEl = document.getElementById("route-destination");
const routeCountriesEl = document.getElementById("route-countries");
const routeDurationEl = document.getElementById("route-duration");
const routeProgressEl = document.getElementById("route-progress");
const routeGeoSummaryEl = document.getElementById("route-geo-summary");

const orbitModes = {
  auto: {
    label: "Auto mode: the sun sweeps between the northern tropic, equator, and southern tropic."
  },
  north: {
    radius: TROPIC_CANCER_RADIUS,
    label: "North tropic mode: the sun follows only the northern tropic ring."
  },
  equator: {
    radius: EQUATOR_RADIUS,
    label: "Equator mode: the sun follows only the equatorial ring."
  },
  south: {
    radius: TROPIC_CAPRICORN_RADIUS,
    label: "South tropic mode: the sun follows only the southern tropic ring."
  }
};

const seasonalEventButtonLabels = {
  springEquinox: "Spring Equinox",
  summerSolstice: "Summer Solstice",
  autumnEquinox: "Autumn Equinox",
  winterSolstice: "Winter Solstice"
};

for (const button of seasonalEventButtons) {
  button.textContent = seasonalEventButtonLabels[button.dataset.seasonalEvent] ?? button.textContent;
}

function setControlTab(tabKey) {
  for (const button of controlTabButtons) {
    button.classList.toggle("active", button.dataset.controlTab === tabKey);
  }

  for (const panel of controlTabPanels) {
    const isActive = panel.dataset.controlPanel === tabKey;
    panel.classList.toggle("active", isActive);
    panel.hidden = !isActive;
  }
}

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: true
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x06101d, FOG_DEFAULT_NEAR, FOG_DEFAULT_FAR);

const camera = new THREE.PerspectiveCamera(CAMERA_DEFAULT_FOV, 1, 0.1, 100);

const cameraState = {
  radius: CAMERA_TOPDOWN_DEFAULT_RADIUS,
  theta: -0.55,
  phi: 1.12,
  targetTheta: -0.55,
  targetPhi: 1.12,
  targetRadius: CAMERA_TOPDOWN_DEFAULT_RADIUS
};

const stage = new THREE.Group();
scene.add(stage);
const scalableStage = new THREE.Group();
stage.add(scalableStage);

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
scalableStage.add(disc);

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
scalableStage.add(dayNightOverlay);

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
scalableStage.add(northSeasonOverlay);

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
scalableStage.add(southSeasonOverlay);

const analemmaProjectionGeometry = new THREE.BufferGeometry();
const analemmaProjectionMaterial = new THREE.LineBasicMaterial({
  color: 0xffb25d,
  transparent: true,
  opacity: 0.94,
  depthWrite: false,
  depthTest: false
});
const analemmaProjection = new THREE.Line(analemmaProjectionGeometry, analemmaProjectionMaterial);
analemmaProjection.renderOrder = 14;
scalableStage.add(analemmaProjection);

const analemmaProjectionPointsGeometry = new THREE.BufferGeometry();
const analemmaProjectionPointsMaterial = new THREE.PointsMaterial({
  color: 0xfff1be,
  size: 0.048,
  sizeAttenuation: true,
  transparent: true,
  opacity: 0.92,
  depthWrite: false,
  depthTest: false
});
const analemmaProjectionPoints = new THREE.Points(
  analemmaProjectionPointsGeometry,
  analemmaProjectionPointsMaterial
);
analemmaProjectionPoints.renderOrder = 15;
scalableStage.add(analemmaProjectionPoints);

const skyAnalemmaGeometry = new THREE.BufferGeometry();
const skyAnalemmaMaterial = new THREE.LineBasicMaterial({
  color: 0x9ed9ff,
  transparent: true,
  opacity: 0.96,
  depthWrite: false,
  depthTest: false
});
const skyAnalemma = new THREE.LineSegments(skyAnalemmaGeometry, skyAnalemmaMaterial);
skyAnalemma.renderOrder = 16;
scalableStage.add(skyAnalemma);

const skyAnalemmaPointsGeometry = new THREE.BufferGeometry();
const skyAnalemmaPointsMaterial = new THREE.PointsMaterial({
  color: 0xe9f7ff,
  size: 0.052,
  sizeAttenuation: true,
  transparent: true,
  opacity: 0.94,
  depthWrite: false,
  depthTest: false
});
const skyAnalemmaPoints = new THREE.Points(skyAnalemmaPointsGeometry, skyAnalemmaPointsMaterial);
skyAnalemmaPoints.renderOrder = 17;
scalableStage.add(skyAnalemmaPoints);

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
scalableStage.add(iceWallOuter);

const iceWallInner = new THREE.Mesh(
  new THREE.CylinderGeometry(RIM_INNER_RADIUS, RIM_INNER_RADIUS, RIM_HEIGHT, 128, 1, true),
  iceInnerMaterial
);
iceWallInner.position.y = RIM_CENTER_Y;
scalableStage.add(iceWallInner);

const iceTopCap = new THREE.Mesh(
  new THREE.RingGeometry(RIM_INNER_RADIUS, RIM_OUTER_RADIUS, 128),
  iceCapMaterial
);
iceTopCap.rotation.x = -Math.PI / 2;
iceTopCap.position.y = RIM_TOP_Y;
scalableStage.add(iceTopCap);

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
scalableStage.add(iceBottomCap);

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
scalableStage.add(iceCrown);

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
dome.scale.y = DOME_VERTICAL_SCALE;
dome.position.y = DOME_BASE_Y;
scalableStage.add(dome);

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
scalableStage.add(domeRing);

const polarisTextureCanvas = document.createElement("canvas");
polarisTextureCanvas.width = 256;
polarisTextureCanvas.height = 256;
const polarisTextureCtx = polarisTextureCanvas.getContext("2d");
const polarisGlowGradient = polarisTextureCtx.createRadialGradient(128, 128, 0, 128, 128, 128);
polarisGlowGradient.addColorStop(0, "rgba(255,255,255,1)");
polarisGlowGradient.addColorStop(0.18, "rgba(214,238,255,0.98)");
polarisGlowGradient.addColorStop(0.42, "rgba(120,184,255,0.42)");
polarisGlowGradient.addColorStop(1, "rgba(120,184,255,0)");
polarisTextureCtx.fillStyle = polarisGlowGradient;
polarisTextureCtx.fillRect(0, 0, polarisTextureCanvas.width, polarisTextureCanvas.height);
const polarisGlowTexture = new THREE.CanvasTexture(polarisTextureCanvas);
polarisGlowTexture.colorSpace = THREE.SRGBColorSpace;

const polaris = new THREE.Group();
const polarisCore = new THREE.Mesh(
  new THREE.SphereGeometry(POLARIS_CORE_RADIUS, 24, 24),
  new THREE.MeshBasicMaterial({
    color: 0xf5fbff,
    transparent: true,
    opacity: POLARIS_CORE_OPACITY,
    depthTest: false,
    depthWrite: false
  })
);
polarisCore.renderOrder = 26;
polaris.add(polarisCore);

const polarisGlow = new THREE.Sprite(
  new THREE.SpriteMaterial({
    map: polarisGlowTexture,
    color: 0xbfe0ff,
    transparent: true,
    opacity: POLARIS_GLOW_OPACITY,
    blending: THREE.AdditiveBlending,
    depthTest: false,
    depthWrite: false
  })
);
polarisGlow.scale.setScalar(POLARIS_GLOW_SIZE);
polarisGlow.renderOrder = 25;
polaris.add(polarisGlow);

const polarisHalo = new THREE.Sprite(
  new THREE.SpriteMaterial({
    map: polarisGlowTexture,
    color: 0x7ec6ff,
    transparent: true,
    opacity: POLARIS_HALO_OPACITY,
    blending: THREE.AdditiveBlending,
    depthTest: false,
    depthWrite: false
  })
);
polarisHalo.scale.setScalar(POLARIS_HALO_SIZE);
polarisHalo.renderOrder = 24;
polaris.add(polarisHalo);

polaris.position.set(
  0,
  DOME_BASE_Y + (DOME_RADIUS * DOME_VERTICAL_SCALE) + POLARIS_ALTITUDE_OFFSET - CELESTIAL_HEIGHT_DROP,
  0
);
scalableStage.add(polaris);

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
scalableStage.add(glow);

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
scalableStage.add(walkerGuideGroup);

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
    emissiveIntensity: ORBIT_SUN_BODY_EMISSIVE_INTENSITY,
    roughness: 0.16,
    metalness: 0.02,
    transparent: true,
    opacity: 1
  })
);
orbitSun.add(orbitSunBody);

const orbitSunHalo = new THREE.Mesh(
  new THREE.SphereGeometry(ORBIT_SUN_SIZE * 1.7, 24, 16),
  new THREE.MeshBasicMaterial({
    color: 0xffd781,
    transparent: true,
    opacity: ORBIT_SUN_HALO_OPACITY,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  })
);
orbitSun.add(orbitSunHalo);

const orbitSunLight = new THREE.PointLight(0xffcf75, ORBIT_SUN_LIGHT_INTENSITY, 9.5, 1.4);
orbitSun.add(orbitSunLight);
scalableStage.add(orbitSun);

const observerSun = orbitSun.clone(true);
const observerSunBody = observerSun.children[0];
observerSunBody.material = observerSunBody.material.clone();
const observerSunHalo = observerSun.children[1];
observerSunHalo.material = observerSunHalo.material.clone();
const observerSunLight = observerSun.children[2];
observerSun.visible = false;
scene.add(observerSun);

function createSunRayTexture() {
  const width = 256;
  const height = 1024;
  const rayCanvas = document.createElement("canvas");
  rayCanvas.width = width;
  rayCanvas.height = height;
  const rayCtx = rayCanvas.getContext("2d");
  const rayImage = rayCtx.createImageData(width, height);
  const { data } = rayImage;

  for (let y = 0; y < height; y += 1) {
    const progress = y / (height - 1);
    const verticalFade = (1 - progress) ** 1.8;
    const beamHalfWidth = (width * 0.08) + ((1 - progress) * width * 0.16);

    for (let x = 0; x < width; x += 1) {
      const index = ((y * width) + x) * 4;
      const centeredX = Math.abs(x - (width / 2));
      const horizontalFade = Math.exp(-((centeredX / beamHalfWidth) ** 2) * 2.6);
      const glowBoost = Math.exp(-((centeredX / (width * 0.12)) ** 2) * 4.2);
      const alpha = THREE.MathUtils.clamp(
        (verticalFade * horizontalFade * 255) + (glowBoost * verticalFade * 56),
        0,
        255
      );

      data[index] = 255;
      data[index + 1] = 245;
      data[index + 2] = 214;
      data[index + 3] = alpha;
    }
  }

  rayCtx.putImageData(rayImage, 0, 0);
  const texture = new THREE.CanvasTexture(rayCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

const sunRayTexture = createSunRayTexture();
const firstPersonSunRayGroup = new THREE.Group();
firstPersonSunRayGroup.visible = false;
scene.add(firstPersonSunRayGroup);

function createSunRayMesh(width, length, rotationZ, opacity, pulseOffset) {
  const geometry = new THREE.PlaneGeometry(width, length);
  geometry.translate(0, -(length * 0.5), 0);
  const material = new THREE.MeshBasicMaterial({
    map: sunRayTexture,
    color: 0xffe8ad,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    depthTest: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.z = rotationZ;
  mesh.renderOrder = 26;
  mesh.userData.baseOpacity = opacity;
  mesh.userData.pulseOffset = pulseOffset;
  return mesh;
}

const firstPersonSunRayMeshes = [
  createSunRayMesh(FIRST_PERSON_SUN_RAY_WIDTH, FIRST_PERSON_SUN_RAY_LENGTH, 0, 0.18, 0),
  createSunRayMesh(FIRST_PERSON_SUN_RAY_WIDTH, FIRST_PERSON_SUN_RAY_LENGTH, Math.PI / 3, 0.14, 0.8),
  createSunRayMesh(FIRST_PERSON_SUN_RAY_WIDTH, FIRST_PERSON_SUN_RAY_LENGTH, (Math.PI * 2) / 3, 0.14, 1.6),
  createSunRayMesh(FIRST_PERSON_SUN_RAY_SHORT_WIDTH, FIRST_PERSON_SUN_RAY_SHORT_LENGTH, Math.PI / 6, 0.2, 0.35),
  createSunRayMesh(FIRST_PERSON_SUN_RAY_SHORT_WIDTH, FIRST_PERSON_SUN_RAY_SHORT_LENGTH, Math.PI / 2, 0.17, 1.15),
  createSunRayMesh(FIRST_PERSON_SUN_RAY_SHORT_WIDTH, FIRST_PERSON_SUN_RAY_SHORT_LENGTH, (Math.PI * 5) / 6, 0.17, 1.95)
];
firstPersonSunRayGroup.add(...firstPersonSunRayMeshes);

const orbitMoon = new THREE.Group();
const orbitMoonBody = new THREE.Mesh(
  new THREE.SphereGeometry(ORBIT_MOON_SIZE, 32, 24),
  new THREE.MeshStandardMaterial({
    color: 0xd8deea,
    emissive: 0xa8b6d4,
    emissiveIntensity: ORBIT_MOON_BODY_EMISSIVE_INTENSITY,
    roughness: 0.42,
    metalness: 0.82,
    transparent: true,
    opacity: 1
  })
);
orbitMoon.add(orbitMoonBody);

const orbitMoonHalo = new THREE.Mesh(
  new THREE.SphereGeometry(ORBIT_MOON_SIZE * 2.4, 24, 16),
  new THREE.MeshBasicMaterial({
    color: 0xcfd8f7,
    transparent: true,
    opacity: ORBIT_MOON_HALO_OPACITY,
    side: THREE.DoubleSide
  })
);
orbitMoon.add(orbitMoonHalo);

const orbitMoonLight = new THREE.PointLight(0xdbe4ff, ORBIT_MOON_LIGHT_INTENSITY, 5.5, 1.9);
orbitMoon.add(orbitMoonLight);
scalableStage.add(orbitMoon);

const observerMoon = orbitMoon.clone(true);
const observerMoonBody = observerMoon.children[0];
observerMoonBody.material = observerMoonBody.material.clone();
const observerMoonHalo = observerMoon.children[1];
observerMoonHalo.material = observerMoonHalo.material.clone();
const observerMoonLight = observerMoon.children[2];
observerMoon.visible = false;
scene.add(observerMoon);

const sunTrailGeometry = new THREE.BufferGeometry();
const sunTrailMaterial = new THREE.LineBasicMaterial({
  color: 0xffdc85,
  transparent: true,
  opacity: 0.95,
  depthWrite: false,
  depthTest: false
});
const sunTrail = new THREE.Line(sunTrailGeometry, sunTrailMaterial);
scalableStage.add(sunTrail);

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
scalableStage.add(sunTrailPointsCloud);

const moonTrailGeometry = new THREE.BufferGeometry();
const moonTrailMaterial = new THREE.LineBasicMaterial({
  color: 0xd7def2,
  transparent: true,
  opacity: 0.72,
  depthWrite: false,
  depthTest: false
});
const moonTrail = new THREE.Line(moonTrailGeometry, moonTrailMaterial);
scalableStage.add(moonTrail);

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
scalableStage.add(moonTrailPointsCloud);

function createOrbitTrack(radius, color, opacity, height = ORBIT_TRACK_HEIGHT) {
  const trackGroup = new THREE.Group();
  const track = new THREE.Mesh(
    new THREE.TorusGeometry(radius, ORBIT_TRACK_TUBE_RADIUS, 16, 192),
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
  track.position.y = height;
  trackGroup.add(track);

  if (Math.abs(height - ORBIT_TRACK_HEIGHT) > 0.02) {
    for (const angle of ORBIT_HEIGHT_GUIDE_ANGLES) {
      const guideHeight = Math.abs(height - ORBIT_TRACK_HEIGHT);
      const guide = new THREE.Mesh(
        new THREE.CylinderGeometry(ORBIT_HEIGHT_GUIDE_RADIUS, ORBIT_HEIGHT_GUIDE_RADIUS, guideHeight, 12, 1, false),
        new THREE.MeshStandardMaterial({
          color,
          emissive: color,
          emissiveIntensity: 0.65,
          transparent: true,
          opacity: opacity * 0.9,
          roughness: 0.24,
          metalness: 0.08
        })
      );
      const marker = new THREE.Mesh(
        new THREE.SphereGeometry(ORBIT_HEIGHT_GUIDE_MARKER_SIZE, 18, 14),
        new THREE.MeshStandardMaterial({
          color,
          emissive: color,
          emissiveIntensity: 1.1,
          transparent: true,
          opacity,
          roughness: 0.18,
          metalness: 0.05
        })
      );
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      guide.position.set(x, (height + ORBIT_TRACK_HEIGHT) / 2, z);
      marker.position.set(x, height, z);
      trackGroup.add(guide);
      trackGroup.add(marker);
    }
  }

  return trackGroup;
}

scalableStage.add(createOrbitTrack(TROPIC_CANCER_RADIUS, 0xffc96c, 0.88, ORBIT_SUN_HEIGHT_NORTH));
scalableStage.add(createOrbitTrack(EQUATOR_RADIUS, 0x7fd8ff, 0.78, ORBIT_SUN_HEIGHT));
scalableStage.add(createOrbitTrack(TROPIC_CAPRICORN_RADIUS, 0xff93b6, 0.88, ORBIT_SUN_HEIGHT_SOUTH));

const simulationState = {
  orbitMoonAngle: Math.PI * 0.35,
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
const analemmaState = {
  enabled: true,
  lastProjectionKey: ""
};
const seasonalMoonState = {
  selectedEventKey: null,
  selectedYear: astronomyState.selectedDate.getFullYear()
};
const skyAnalemmaState = {
  enabled: false,
  lastProjectionKey: "",
  lastVisibleSamples: 0,
  lastTotalSamples: 0
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
const renderState = {
  compiledFirstPerson: false,
  compileReady: false,
  prepStartedAtMs: 0,
  preparing: false,
  progress: 0,
  stageScale: TOPDOWN_STAGE_SCALE,
  targetFogFar: FOG_DEFAULT_FAR,
  targetFogNear: FOG_DEFAULT_NEAR,
  targetStageScale: TOPDOWN_STAGE_SCALE,
  targetVisualScale: 1,
  transitionDurationMs: FIRST_PERSON_RETURN_DURATION_MS,
  transitionToken: 0,
  visualScale: 1
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
  CAMERA_TOPDOWN_DEFAULT_RADIUS,
  CAMERA_TOPDOWN_MAX_RADIUS,
  CAMERA_TOPDOWN_MIN_RADIUS,
  CAMERA_WALKER_FOV,
  DAY_NIGHT_TEXTURE_SIZE,
  DAY_NIGHT_UPDATE_EPSILON,
  ANALEMMA_SURFACE_OFFSET,
  SKY_ANALEMMA_RADIUS,
  MAP_TEXTURE_SIZE,
  DEFAULT_MAP_LABEL,
  DEFAULT_MAP_PATH,
  DISC_RADIUS,
  DOME_BASE_Y,
  DOME_RADIUS,
  EQUATOR_RADIUS,
  FIRST_PERSON_STAGE_SCALE,
  MOON_TRAIL_MAX_POINTS,
  FOG_DEFAULT_FAR,
  FOG_DEFAULT_NEAR,
  FOG_WALKER_FAR,
  FOG_WALKER_NEAR,
  FIRST_PERSON_HORIZON_RADIUS,
  FIRST_PERSON_HORIZON_OCCLUSION_RANGE,
  FIRST_PERSON_HORIZON_SINK,
  FIRST_PERSON_SKY_RADIUS,
  FIRST_PERSON_WORLD_RADIUS,
  ORBIT_MOON_BASE_HEIGHT,
  ORBIT_MOON_HEIGHT_NORTH,
  ORBIT_MOON_HEIGHT_SOUTH,
  ORBIT_MOON_SIZE,
  ORBIT_RADIUS_AMPLITUDE,
  ORBIT_RADIUS_MID,
  SURFACE_Y,
  ORBIT_SUN_HEIGHT,
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
  WALKER_PITCH_MAX,
  WALKER_PITCH_MIN,
  WALKER_SPEED,
  WALKER_START_LATITUDE,
  WALKER_START_LONGITUDE,
  WALKER_SURFACE_OFFSET,
  CELESTIAL_ALTITUDE_DROP_DEGREES
};

const ui = {
  applyObservationTimeButton,
  analemmaOverlayEl,
  analemmaSummaryEl,
  dayNightOverlayEl,
  dayNightSummaryEl,
  firstPersonHorizonEl,
  firstPersonOverlayEl,
  moonCoordinatesEl,
  observationTimeEl,
  orbitLabelEl,
  realityLiveEl,
  realitySyncEl,
  seasonalEventTimeEl,
  seasonDetailEl,
  seasonLatitudeEl,
  seasonSummaryEl,
  seasonalMoonAnchorEl,
  seasonalMoonDriftEl,
  seasonalMoonSummaryEl,
  seasonalSunGridEl,
  seasonalSunSummaryEl,
  seasonalYearEl,
  skyAnalemmaOverlayEl,
  skyAnalemmaSummaryEl,
  statusEl,
  sunCoordinatesEl,
  timeSummaryEl,
  walkerCoordinatesEl,
  walkerLightEl,
  walkerModeEl,
  walkerSummaryEl
};

let astronomyApi;
const textureApi = createTextureManager({
  constants,
  renderer,
  topMaterial,
  statusEl,
  onTextureUpdated() {
    dayNightState.lastLatitudeDegrees = null;
    dayNightState.lastLongitudeDegrees = null;

    if (!astronomyApi) {
      return;
    }

    if (astronomyState.enabled) {
      const observationDate = astronomyState.live ? new Date() : astronomyState.selectedDate;
      const snapshot = astronomyApi.getAstronomySnapshot(observationDate);
      astronomyApi.updateDayNightOverlayFromSun(snapshot.sun.latitudeDegrees, snapshot.sun.longitudeDegrees, true);
      return;
    }

    const demoSunGeo = getGeoFromProjectedPosition(orbitSun.position, DISC_RADIUS);
    astronomyApi.updateDayNightOverlayFromSun(demoSunGeo.latitudeDegrees, demoSunGeo.longitudeDegrees, true);
  }
});

const cameraApi = createCameraController({
  camera,
  cameraState,
  constants,
  renderState,
  renderer,
  walkerState
});

astronomyApi = createAstronomyController({
  constants,
  ui,
  astronomyState,
  seasonalMoonState,
  analemmaState,
  skyAnalemmaState,
  dayNightState,
  simulationState,
  walkerState,
  orbitModes,
  orbitModeButtons,
  seasonalEventButtons,
  dayNightCanvas,
  dayNightCtx,
  dayNightTexture,
  dayNightOverlay,
  analemmaProjectionGeometry,
  analemmaProjectionPointsGeometry,
  skyAnalemmaGeometry,
  skyAnalemmaPointsGeometry,
  orbitSun,
  orbitMoon,
  sunTrailGeometry,
  sunTrailPointsGeometry,
  moonTrailGeometry,
  moonTrailPointsGeometry,
  northSeasonOverlay,
  southSeasonOverlay,
  getNightLightsData: textureApi.getNightLightsData
});

const walkerApi = createWalkerController({
  constants,
  renderState,
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

const firstPersonWorldApi = createFirstPersonWorldController({
  scene,
  constants,
  walkerState,
  renderState,
  ambient,
  keyLight,
  rimLight,
  topDownBackground: skyTexture
});

const routeSimulationApi = createRouteSimulationController({
  constants,
  scalableStage,
  ui: {
    routeAircraftEl,
    routeCountriesEl,
    routeDatasetStatusEl,
    routeDestinationEl,
    routeDurationEl,
    routeGeoSummaryEl,
    routeLegEl,
    routeOriginEl,
    routePlaybackButton,
    routeProgressEl,
    routeResetButton,
    routeSelectEl,
    routeSpeedEl,
    routeSpeedValueEl,
    routeSummaryEl
  }
});

const tempPreparationLookTarget = new THREE.Vector3();
const tempObserverNorthAxis = new THREE.Vector3();
const tempObserverEastAxis = new THREE.Vector3();
const tempObserverSkyOrigin = new THREE.Vector3();
const tempObserverSkyPoint = new THREE.Vector3();
const tempObserverRelative = new THREE.Vector3();
const tempDemoSunSourceWorld = new THREE.Vector3();
const tempDemoMoonSourceWorld = new THREE.Vector3();
const tempSunWorldPosition = new THREE.Vector3();
const tempSunViewDirection = new THREE.Vector3();
const tempCameraForward = new THREE.Vector3();

function syncPreparationPresentation() {
  if (!renderState.preparing) {
    firstPersonPrepEl.classList.remove("active");
    firstPersonPrepEl.setAttribute("aria-hidden", "true");
    firstPersonPrepBarFillEl.style.width = "0%";
    firstPersonPrepProgressEl.textContent = "";
    return;
  }

  const elapsedMs = performance.now() - renderState.prepStartedAtMs;
  const timelineProgress = THREE.MathUtils.clamp(elapsedMs / renderState.transitionDurationMs, 0, 1);
  const displayProgress = renderState.compileReady
    ? timelineProgress
    : Math.min(timelineProgress, 0.88);
  let title = "Preparing observer render";
  let copy = "Scaling the disc and extending the horizon for first-person mode.";

  if (displayProgress >= 0.72 && !renderState.compileReady) {
    title = "Compiling first-person shaders";
    copy = "Warming the render path so the observer camera can enter without a hitch.";
  } else if (displayProgress >= 0.42) {
    title = "Shifting atmosphere and horizon";
    copy = "Applying the first-person fog range and long-distance scale pass.";
  }

  if (renderState.compileReady && displayProgress >= 0.92) {
    title = "Locking observer camera";
    copy = "Finalizing the horizon alignment before the first-person view opens.";
  }

  renderState.progress = displayProgress;
  firstPersonPrepEl.classList.add("active");
  firstPersonPrepEl.setAttribute("aria-hidden", "false");
  firstPersonPrepTitleEl.textContent = title;
  firstPersonPrepCopyEl.textContent = copy;
  firstPersonPrepBarFillEl.style.width = `${Math.round(displayProgress * 100)}%`;
  firstPersonPrepProgressEl.textContent = `${Math.round(displayProgress * 100)}%`;
}

function updateRenderState() {
  renderState.stageScale += (renderState.targetStageScale - renderState.stageScale) * 0.08;
  renderState.visualScale += (renderState.targetVisualScale - renderState.visualScale) * 0.08;
  scene.fog.near += (renderState.targetFogNear - scene.fog.near) * 0.08;
  scene.fog.far += (renderState.targetFogFar - scene.fog.far) * 0.08;
  stage.scale.setScalar(renderState.stageScale);
  scalableStage.scale.set(renderState.visualScale, 1, renderState.visualScale);
}

function getObserverSkyAxes(observerPosition, observerLongitudeDegrees) {
  const planarLength = Math.hypot(observerPosition.x, observerPosition.z);

  if (planarLength > 0.0001) {
    tempObserverNorthAxis.set(-observerPosition.x / planarLength, 0, -observerPosition.z / planarLength);
    tempObserverEastAxis.set(-tempObserverNorthAxis.z, 0, tempObserverNorthAxis.x);
    return;
  }

  const longitudeRadians = observerLongitudeDegrees * Math.PI / 180;
  tempObserverNorthAxis.set(Math.cos(longitudeRadians), 0, -Math.sin(longitudeRadians));
  tempObserverEastAxis.set(Math.sin(longitudeRadians), 0, Math.cos(longitudeRadians));
}

function getObserverSkyDistance(altitudeDegrees) {
  const altitudeFactor = THREE.MathUtils.clamp((altitudeDegrees + 2) / 92, 0, 1);
  return THREE.MathUtils.lerp(
    FIRST_PERSON_CELESTIAL_FAR_RADIUS,
    FIRST_PERSON_CELESTIAL_NEAR_RADIUS,
    altitudeFactor
  );
}

function applyCelestialAltitudeOffset(horizontal) {
  const altitudeDegrees = THREE.MathUtils.clamp(
    horizontal.altitudeDegrees - CELESTIAL_ALTITUDE_DROP_DEGREES,
    -89.9,
    89.9
  );

  return {
    ...horizontal,
    altitudeDegrees,
    altitudeRadians: THREE.MathUtils.degToRad(altitudeDegrees)
  };
}

function positionBodyInObserverSky(body, horizontal, observerGeo) {
  const skyDistance = getObserverSkyDistance(horizontal.altitudeDegrees);
  const horizontalRadius = Math.cos(horizontal.altitudeRadians) * skyDistance;

  getObserverSkyAxes(walkerState.position, observerGeo.longitudeDegrees);
  tempObserverSkyOrigin.set(
    walkerState.position.x * renderState.visualScale,
    constants.WALKER_EYE_HEIGHT,
    walkerState.position.z * renderState.visualScale
  );
  tempObserverSkyPoint.copy(tempObserverSkyOrigin)
    .addScaledVector(tempObserverNorthAxis, horizontalRadius * Math.cos(horizontal.azimuthRadians))
    .addScaledVector(tempObserverEastAxis, horizontalRadius * Math.sin(horizontal.azimuthRadians))
    .addScaledVector(THREE.Object3D.DEFAULT_UP, Math.sin(horizontal.altitudeRadians) * skyDistance);

  body.position.copy(tempObserverSkyPoint);
}

function getHorizontalFromWorldPosition(sourceWorldPosition, observerGeo) {
  getObserverSkyAxes(walkerState.position, observerGeo.longitudeDegrees);
  tempObserverSkyOrigin.set(
    walkerState.position.x * renderState.visualScale,
    constants.WALKER_EYE_HEIGHT,
    walkerState.position.z * renderState.visualScale
  );
  tempObserverRelative.copy(sourceWorldPosition).sub(tempObserverSkyOrigin);

  const northComponent = tempObserverRelative.dot(tempObserverNorthAxis);
  const eastComponent = tempObserverRelative.dot(tempObserverEastAxis);
  const upComponent = tempObserverRelative.y;
  const planarDistance = Math.hypot(northComponent, eastComponent);
  const altitudeRadians = Math.atan2(upComponent, Math.max(planarDistance, 0.0001));
  const azimuthRadians = Math.atan2(eastComponent, northComponent);

  return {
    altitudeDegrees: THREE.MathUtils.radToDeg(altitudeRadians),
    azimuthDegrees: THREE.MathUtils.euclideanModulo(THREE.MathUtils.radToDeg(azimuthRadians), 360),
    altitudeRadians,
    azimuthRadians
  };
}

function updateObserverCelestialPerspective(snapshot) {
  if (!walkerState.enabled || !snapshot) {
    observerSun.visible = false;
    observerMoon.visible = false;
    firstPersonSunRayGroup.visible = false;
    orbitSun.visible = true;
    orbitSun.renderOrder = 20;
    sunTrail.visible = true;
    sunTrailPointsCloud.visible = true;
    orbitSunBody.material.opacity = 1;
    orbitSunBody.material.emissiveIntensity = ORBIT_SUN_BODY_EMISSIVE_INTENSITY;
    orbitSunBody.material.depthTest = false;
    orbitSunBody.material.depthWrite = false;
    orbitSunHalo.material.opacity = ORBIT_SUN_HALO_OPACITY;
    orbitSunHalo.material.depthTest = true;
    orbitSunHalo.material.depthWrite = false;
    orbitSunLight.intensity = ORBIT_SUN_LIGHT_INTENSITY;
    orbitMoon.visible = true;
    orbitMoon.renderOrder = 18;
    moonTrail.visible = true;
    moonTrailPointsCloud.visible = true;
    orbitMoonBody.material.opacity = 1;
    orbitMoonBody.material.emissiveIntensity = ORBIT_MOON_BODY_EMISSIVE_INTENSITY;
    orbitMoonBody.material.depthTest = false;
    orbitMoonBody.material.depthWrite = false;
    orbitMoonHalo.material.opacity = ORBIT_MOON_HALO_OPACITY;
    orbitMoonHalo.material.depthTest = true;
    orbitMoonHalo.material.depthWrite = false;
    orbitMoonLight.intensity = ORBIT_MOON_LIGHT_INTENSITY;
    return;
  }

  const observerGeo = getGeoFromProjectedPosition(walkerState.position, constants.DISC_RADIUS);
  const sunHorizontal = astronomyState.enabled
    ? getSunHorizontalCoordinates(
      snapshot.date,
      observerGeo.latitudeDegrees,
      observerGeo.longitudeDegrees
    )
    : getHorizontalFromWorldPosition(orbitSun.getWorldPosition(tempDemoSunSourceWorld), observerGeo);
  const moonHorizontal = astronomyState.enabled
    ? getMoonHorizontalCoordinates(
      snapshot.date,
      observerGeo.latitudeDegrees,
      observerGeo.longitudeDegrees
    )
    : getHorizontalFromWorldPosition(orbitMoon.getWorldPosition(tempDemoMoonSourceWorld), observerGeo);
  const adjustedSunHorizontal = astronomyState.enabled
    ? applyCelestialAltitudeOffset(sunHorizontal)
    : sunHorizontal;
  const adjustedMoonHorizontal = astronomyState.enabled
    ? applyCelestialAltitudeOffset(moonHorizontal)
    : moonHorizontal;
  const solarFactor = getSolarAltitudeFactor(
    observerGeo.latitudeDegrees,
    observerGeo.longitudeDegrees,
    snapshot.sun.latitudeDegrees,
    snapshot.sun.longitudeDegrees
  );
  const sunTargetVisibility = THREE.MathUtils.clamp(
    (adjustedSunHorizontal.altitudeDegrees + FIRST_PERSON_CELESTIAL_FADE_RANGE) / (FIRST_PERSON_CELESTIAL_FADE_RANGE * 2),
    0,
    1
  );
  const moonTargetVisibility = THREE.MathUtils.clamp(
    (adjustedMoonHorizontal.altitudeDegrees + FIRST_PERSON_CELESTIAL_FADE_RANGE) / (FIRST_PERSON_CELESTIAL_FADE_RANGE * 2),
    0,
    1
  );
  const sunHorizonLift = THREE.MathUtils.clamp(
    adjustedSunHorizontal.altitudeDegrees / constants.FIRST_PERSON_HORIZON_OCCLUSION_RANGE,
    0,
    1
  );
  const moonHorizonLift = THREE.MathUtils.clamp(
    adjustedMoonHorizontal.altitudeDegrees / constants.FIRST_PERSON_HORIZON_OCCLUSION_RANGE,
    0,
    1
  );
  const sunOcclusionVisibility = sunTargetVisibility * sunHorizonLift;
  const moonOcclusionVisibility = moonTargetVisibility * moonHorizonLift;

  positionBodyInObserverSky(observerSun, adjustedSunHorizontal, observerGeo);
  positionBodyInObserverSky(observerMoon, adjustedMoonHorizontal, observerGeo);
  observerSun.position.y -= (1 - sunHorizonLift) * constants.FIRST_PERSON_HORIZON_SINK;
  observerMoon.position.y -= (1 - moonHorizonLift) * (constants.FIRST_PERSON_HORIZON_SINK * 0.65);
  observerSun.scale.setScalar(FIRST_PERSON_SUN_SCALE);
  observerMoon.scale.setScalar(FIRST_PERSON_MOON_SCALE);

  orbitSun.visible = false;
  sunTrail.visible = false;
  sunTrailPointsCloud.visible = false;
  observerSun.renderOrder = 24;
  observerSun.visible = sunOcclusionVisibility > 0.01;
  observerSunBody.material.depthTest = false;
  observerSunBody.material.depthWrite = false;
  observerSunBody.material.opacity += (sunOcclusionVisibility - observerSunBody.material.opacity) * 0.18;
  observerSunBody.material.emissiveIntensity += (
    (ORBIT_SUN_BODY_EMISSIVE_INTENSITY * sunOcclusionVisibility) - observerSunBody.material.emissiveIntensity
  ) * 0.18;
  observerSunHalo.material.depthTest = false;
  observerSunHalo.material.depthWrite = false;
  observerSunHalo.material.opacity += (
    (ORBIT_SUN_HALO_OPACITY * sunOcclusionVisibility) - observerSunHalo.material.opacity
  ) * 0.18;
  observerSunLight.intensity += (
    (ORBIT_SUN_LIGHT_INTENSITY * sunOcclusionVisibility) - observerSunLight.intensity
  ) * 0.18;
  tempSunWorldPosition.copy(observerSun.position);
  tempSunViewDirection.copy(observerSun.position).sub(camera.position);
  const sunDistance = Math.max(tempSunViewDirection.length(), 0.0001);
  tempSunViewDirection.divideScalar(sunDistance);
  camera.getWorldDirection(tempCameraForward);
  const lookAlignment = THREE.MathUtils.clamp(
    (tempCameraForward.dot(tempSunViewDirection) - FIRST_PERSON_SUN_RAY_ALIGNMENT_START) /
      (FIRST_PERSON_SUN_RAY_ALIGNMENT_END - FIRST_PERSON_SUN_RAY_ALIGNMENT_START),
    0,
    1
  );
  const lowSunBoost = THREE.MathUtils.lerp(
    1.18,
    0.62,
    THREE.MathUtils.clamp(adjustedSunHorizontal.altitudeDegrees / 65, 0, 1)
  );
  const rayStrength = sunOcclusionVisibility * lookAlignment * lowSunBoost;

  firstPersonSunRayGroup.visible = rayStrength > 0.015;
  if (firstPersonSunRayGroup.visible) {
    const pulseTime = performance.now() * 0.0018;
    const rayScale = THREE.MathUtils.lerp(0.9, 1.55, rayStrength);
    firstPersonSunRayGroup.position.copy(tempSunWorldPosition);
    firstPersonSunRayGroup.quaternion.copy(camera.quaternion);
    firstPersonSunRayGroup.scale.setScalar(rayScale);

    for (const rayMesh of firstPersonSunRayMeshes) {
      const shimmer = 0.82 + (Math.sin(pulseTime + rayMesh.userData.pulseOffset) * 0.18);
      rayMesh.material.opacity = rayMesh.userData.baseOpacity * rayStrength * shimmer;
    }
  }

  orbitMoon.renderOrder = 23;
  orbitMoon.visible = false;
  moonTrail.visible = false;
  moonTrailPointsCloud.visible = false;
  observerMoon.renderOrder = 23;
  observerMoon.visible = moonOcclusionVisibility > 0.01;
  observerMoonBody.material.depthTest = false;
  observerMoonBody.material.depthWrite = false;
  observerMoonBody.material.opacity += (moonOcclusionVisibility - observerMoonBody.material.opacity) * 0.18;
  observerMoonBody.material.emissiveIntensity += (
    (
      (ORBIT_MOON_BODY_EMISSIVE_INTENSITY + (solarFactor * 0.18) + (moonOcclusionVisibility * 0.9)) -
      observerMoonBody.material.emissiveIntensity
    )
  ) * 0.12;
  observerMoonHalo.material.depthTest = false;
  observerMoonHalo.material.depthWrite = false;
  observerMoonHalo.material.opacity += (
    (ORBIT_MOON_HALO_OPACITY * moonOcclusionVisibility) - observerMoonHalo.material.opacity
  ) * 0.18;
  observerMoonLight.intensity += (
    (ORBIT_MOON_LIGHT_INTENSITY * moonOcclusionVisibility) - observerMoonLight.intensity
  ) * 0.18;
}

function configurePreparationCamera(targetCamera) {
  const visualScale = constants.FIRST_PERSON_STAGE_SCALE;
  const horizontalDistance = Math.cos(walkerState.pitch) * constants.WALKER_LOOK_DISTANCE;

  targetCamera.fov = constants.CAMERA_WALKER_FOV;
  targetCamera.aspect = camera.aspect;
  targetCamera.near = 0.05;
  targetCamera.far = 140;
  targetCamera.position.set(
    walkerState.position.x * visualScale,
    constants.WALKER_EYE_HEIGHT,
    walkerState.position.z * visualScale
  );
  tempPreparationLookTarget.set(
    targetCamera.position.x + (Math.sin(walkerState.heading) * horizontalDistance),
    constants.WALKER_EYE_HEIGHT + (Math.sin(walkerState.pitch) * constants.WALKER_LOOK_DISTANCE),
    targetCamera.position.z + (Math.cos(walkerState.heading) * horizontalDistance)
  );
  targetCamera.lookAt(tempPreparationLookTarget);
  targetCamera.updateProjectionMatrix();
  return targetCamera;
}

function resetMovementState() {
  movementState.forward = false;
  movementState.backward = false;
  movementState.left = false;
  movementState.right = false;
}

function exitFirstPersonMode() {
  renderState.transitionToken += 1;
  renderState.preparing = false;
  renderState.compileReady = false;
  renderState.progress = 0;
  renderState.transitionDurationMs = FIRST_PERSON_RETURN_DURATION_MS;
  renderState.targetStageScale = TOPDOWN_STAGE_SCALE;
  renderState.targetVisualScale = 1;
  renderState.targetFogNear = constants.FOG_DEFAULT_NEAR;
  renderState.targetFogFar = constants.FOG_DEFAULT_FAR;
  walkerState.enabled = false;
  resetMovementState();
  stopDrag();
  walkerApi.syncWalkerUi();
  walkerApi.updateWalkerAvatar();
  syncPreparationPresentation();
}

async function enterFirstPersonMode() {
  if (renderState.preparing || walkerState.enabled) {
    return;
  }

  const transitionToken = renderState.transitionToken + 1;
  renderState.transitionToken = transitionToken;
  renderState.preparing = true;
  renderState.compileReady = renderState.compiledFirstPerson;
  renderState.prepStartedAtMs = performance.now();
  renderState.progress = 0;
  renderState.transitionDurationMs = renderState.compiledFirstPerson
    ? FIRST_PERSON_RETURN_DURATION_MS
    : FIRST_PERSON_PREP_DURATION_MS;
  renderState.targetStageScale = 1;
  renderState.targetVisualScale = constants.FIRST_PERSON_STAGE_SCALE;
  renderState.targetFogNear = constants.FOG_WALKER_NEAR;
  renderState.targetFogFar = constants.FOG_WALKER_FAR;
  walkerApi.syncWalkerUi();
  syncPreparationPresentation();

  const compilePromise = renderState.compiledFirstPerson
    ? Promise.resolve()
    : renderer.compileAsync(scene, configurePreparationCamera(camera.clone())).catch(() => null);

  compilePromise.then(() => {
    if (renderState.transitionToken !== transitionToken) {
      return;
    }
    renderState.compileReady = true;
    renderState.compiledFirstPerson = true;
  });

  await Promise.all([
    compilePromise,
    new Promise((resolve) => window.setTimeout(resolve, renderState.transitionDurationMs))
  ]);

  if (renderState.transitionToken !== transitionToken) {
    return;
  }

  renderState.preparing = false;
  renderState.progress = 1;
  walkerState.enabled = true;
  walkerApi.syncWalkerUi();
  walkerApi.updateWalkerAvatar();
  syncPreparationPresentation();
}

let isDragging = false;
let previousX = 0;
let previousY = 0;

canvas.addEventListener("pointerdown", (event) => {
  if (renderState.preparing) {
    return;
  }
  isDragging = true;
  previousX = event.clientX;
  previousY = event.clientY;
  canvas.setPointerCapture(event.pointerId);
});

canvas.addEventListener("pointermove", (event) => {
  if (!isDragging || renderState.preparing) {
    return;
  }

  const deltaX = event.clientX - previousX;
  const deltaY = event.clientY - previousY;

  if (walkerState.enabled) {
    walkerState.heading -= deltaX * 0.005;
    walkerState.pitch = THREE.MathUtils.clamp(
      walkerState.pitch - (deltaY * 0.004),
      constants.WALKER_PITCH_MIN,
      constants.WALKER_PITCH_MAX
    );
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
  if (walkerState.enabled || renderState.preparing) {
    return;
  }
  event.preventDefault();
  cameraState.targetRadius += event.deltaY * 0.01;
  cameraApi.clampCamera();
}, { passive: false });

for (const button of controlTabButtons) {
  button.addEventListener("click", () => {
    setControlTab(button.dataset.controlTab);
  });
}

uploadInput.addEventListener("change", (event) => {
  const file = event.target.files[0];
  textureApi.loadUserTexture(file);
});

resetButton.addEventListener("click", () => {
  if (walkerState.enabled || renderState.preparing) {
    exitFirstPersonMode();
  }
  cameraState.targetTheta = -0.55;
  cameraState.targetPhi = 1.12;
  cameraState.targetRadius = constants.CAMERA_TOPDOWN_DEFAULT_RADIUS;
});

walkerModeEl.addEventListener("change", () => {
  if (walkerModeEl.checked) {
    enterFirstPersonMode();
    return;
  }

  exitFirstPersonMode();
});

resetWalkerButton.addEventListener("click", () => {
  if (renderState.preparing) {
    return;
  }
  walkerApi.resetWalkerPosition();
  walkerState.heading = Math.PI * 0.1;
  walkerState.pitch = -0.08;
  walkerApi.updateWalkerAvatar();
});

routeSelectEl.addEventListener("change", () => {
  routeSimulationApi.selectRoute(routeSelectEl.value);
});

routeSpeedEl.addEventListener("input", () => {
  routeSimulationApi.setSpeedMultiplier(routeSpeedEl.value);
});

routePlaybackButton.addEventListener("click", () => {
  routeSimulationApi.togglePlayback();
});

routeResetButton.addEventListener("click", () => {
  routeSimulationApi.resetProgress();
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

analemmaOverlayEl.addEventListener("change", () => {
  analemmaState.enabled = analemmaOverlayEl.checked;
  const projectionDate = astronomyState.live ? new Date() : astronomyState.selectedDate;
  astronomyApi.syncAnalemmaUi(projectionDate, true);
});

skyAnalemmaOverlayEl.addEventListener("change", () => {
  skyAnalemmaState.enabled = skyAnalemmaOverlayEl.checked;
  const projectionDate = astronomyState.live ? new Date() : astronomyState.selectedDate;
  astronomyApi.syncSkyAnalemmaUi(projectionDate, true);
});

for (const button of orbitModeButtons) {
  button.addEventListener("click", () => {
    simulationState.orbitMode = button.dataset.orbitMode;
    astronomyApi.updateOrbitModeUi();
    astronomyApi.resetSunTrail();
    astronomyApi.resetMoonTrail();
  });
}

seasonalYearEl.addEventListener("change", () => {
  astronomyApi.previewSeasonalMoonAudit(undefined, seasonalYearEl.value);
});

for (const button of seasonalEventButtons) {
  button.addEventListener("click", () => {
    astronomyApi.previewSeasonalMoonAudit(button.dataset.seasonalEvent, seasonalYearEl.value);
  });
}

window.addEventListener("resize", () => {
  cameraApi.resize();
});

window.addEventListener("keydown", (event) => {
  if (event.repeat || renderState.preparing) {
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
  let projectionDate = astronomyState.selectedDate;
  stage.rotation.y = 0;
  const polarisPulse = 0.5 + (Math.sin(performance.now() * 0.0032) * 0.5);
  polarisCore.material.opacity = THREE.MathUtils.lerp(0.9, POLARIS_CORE_OPACITY, polarisPulse);
  polarisGlow.material.opacity = THREE.MathUtils.lerp(0.82, POLARIS_GLOW_OPACITY, polarisPulse);
  polarisHalo.material.opacity = THREE.MathUtils.lerp(0.28, POLARIS_HALO_OPACITY, polarisPulse);

  if (astronomyState.enabled) {
    const observationDate = astronomyState.live ? new Date() : astronomyState.selectedDate;
    projectionDate = observationDate;
    if (astronomyState.live) {
      astronomyState.selectedDate = observationDate;
      astronomyApi.syncLiveObservationInput(observationDate);
    }
    snapshot = astronomyApi.getAstronomySnapshot(observationDate);
    astronomyApi.applyAstronomySnapshot(snapshot);
  } else {
    simulationState.orbitSunAngle += ORBIT_SUN_SPEED;
    if (simulationState.orbitMode === "auto") {
      simulationState.orbitSeasonPhase += ORBIT_SUN_SEASON_SPEED;
    }
    simulationState.orbitMoonAngle += ORBIT_MOON_SPEED;
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
      date: projectionDate,
      sun: demoSunGeo,
      moon: getGeoFromProjectedPosition(orbitMoon.position, DISC_RADIUS)
    };
  }

  walkerApi.updateWalkerMovement(deltaSeconds);
  walkerApi.updateWalkerAvatar();
  walkerApi.updateWalkerPerspectiveGuides();
  walkerApi.updateFirstPersonOverlay();
  routeSimulationApi.update(deltaSeconds);
  astronomyApi.syncSeasonalSunUi();
  if (snapshot) {
    walkerApi.updateWalkerUi(snapshot);
  }
  updateRenderState();
  syncPreparationPresentation();
  cameraApi.updateCamera();
  firstPersonWorldApi.update(snapshot);
  if (snapshot) {
    updateObserverCelestialPerspective(snapshot);
  }
  renderer.render(scene, camera);
}

cameraApi.resize();
textureApi.loadDefaultTexture();
walkerApi.resetWalkerPosition();
walkerApi.updateWalkerAvatar();
setControlTab("astronomy");
astronomyApi.setObservationInputValue(astronomyState.selectedDate);
astronomyApi.syncDayNightOverlayUi();
astronomyApi.syncAnalemmaUi(astronomyState.selectedDate, true);
astronomyApi.syncSeasonalMoonUi();
astronomyApi.syncSeasonalSunUi(true);
walkerApi.syncWalkerUi();
routeSimulationApi.initialize();
astronomyApi.enableRealityMode({ live: true, date: astronomyState.selectedDate });
animate();

