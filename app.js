import * as THREE from "./vendor/three.module.js";
import {
  getGeoFromProjectedPosition,
  projectedRadiusFromLatitude
} from "./modules/geo-utils.js";
import {
  getMoonPhase,
  getSolarAltitudeFactor,
} from "./modules/astronomy-utils.js?v=20260311-moon4";
import { createAstronomyController } from "./modules/astronomy-controller.js?v=20260311-moon4";
import { createCameraController } from "./modules/camera-controller.js";
import { createCelestialTrackingCameraController } from "./modules/celestial-tracking-camera-controller.js";
import { createFirstPersonWorldController } from "./modules/first-person-world-controller.js";
import { createI18n } from "./modules/i18n.js?v=20260311-moon4";
import { createRouteSimulationController } from "./modules/route-simulation-controller.js";
import { createTextureManager } from "./modules/texture-manager.js";
import { createWalkerController } from "./modules/walker-controller.js";

const DEFAULT_MAP_PATH = "./assets/flat-earth-map-square.svg";
const DEFAULT_MAP_LABEL = "assets/flat-earth-map-square.svg";
const MODEL_SCALE = 2;
const scaleDimension = (value) => value * MODEL_SCALE;
const CELESTIAL_SIZE_SCALE = 0.6;
const DISC_RADIUS = scaleDimension(5);
const DISC_HEIGHT = scaleDimension(0.36);
const CELESTIAL_ALTITUDE_SCALE = 0.5;
const CELESTIAL_ALTITUDE_BASE_Y = DISC_HEIGHT / 2;
const scaleCelestialAltitude = (value) =>
  CELESTIAL_ALTITUDE_BASE_Y + ((value - CELESTIAL_ALTITUDE_BASE_Y) * CELESTIAL_ALTITUDE_SCALE);
const RIM_THICKNESS = scaleDimension(0.28);
const RIM_CLEARANCE = scaleDimension(0.08);
const RIM_OUTER_RADIUS = DISC_RADIUS + RIM_CLEARANCE;
const RIM_INNER_RADIUS = DISC_RADIUS - RIM_THICKNESS;
const RIM_HEIGHT = scaleDimension(0.62);
const RIM_CENTER_Y = scaleDimension(0.11);
const RIM_TOP_Y = RIM_CENTER_Y + (RIM_HEIGHT / 2);
const RIM_BOTTOM_Y = RIM_CENTER_Y - (RIM_HEIGHT / 2);
const DOME_RADIUS = RIM_INNER_RADIUS - scaleDimension(0.14);
const DOME_BASE_Y = scaleDimension(0.46);
const DOME_VERTICAL_SCALE = 0.78;
const CELESTIAL_HEIGHT_DROP = scaleDimension(0.42);
const CELESTIAL_ALTITUDE_DROP_DEGREES = 6;
const POLARIS_ALTITUDE_OFFSET = 0;
const POLARIS_CORE_RADIUS = scaleDimension(0.07);
const POLARIS_GLOW_SIZE = scaleDimension(0.42);
const POLARIS_HALO_SIZE = scaleDimension(0.78);
const POLARIS_CORE_OPACITY = 1;
const POLARIS_GLOW_OPACITY = 1;
const POLARIS_HALO_OPACITY = 0.48;
const TROPIC_LATITUDE = 23.44;
const RAW_ORBIT_TRACK_HEIGHT = DOME_BASE_Y + scaleDimension(2.01) - CELESTIAL_HEIGHT_DROP;
const RAW_ORBIT_SUN_HEIGHT = RAW_ORBIT_TRACK_HEIGHT + scaleDimension(0.12);
const RAW_ORBIT_SUN_HEIGHT_NORTH = RAW_ORBIT_SUN_HEIGHT + scaleDimension(0.52);
const RAW_ORBIT_SUN_HEIGHT_SOUTH = RAW_ORBIT_SUN_HEIGHT - scaleDimension(0.56);
const ORBIT_TRACK_HEIGHT = scaleCelestialAltitude(RAW_ORBIT_TRACK_HEIGHT);
const ORBIT_SUN_HEIGHT = scaleCelestialAltitude(RAW_ORBIT_SUN_HEIGHT);
const ORBIT_SUN_HEIGHT_NORTH = scaleCelestialAltitude(RAW_ORBIT_SUN_HEIGHT_NORTH);
const ORBIT_SUN_HEIGHT_SOUTH = scaleCelestialAltitude(RAW_ORBIT_SUN_HEIGHT_SOUTH);
const CELESTIAL_BODY_SIZE = scaleDimension(0.13) * CELESTIAL_SIZE_SCALE;
const ORBIT_SUN_SIZE = CELESTIAL_BODY_SIZE;
const ORBIT_SUN_SPEED = 0.011;
const ORBIT_SUN_SEASON_SPEED = 0.0026;
const ORBIT_SUN_HALO_OPACITY = 0.2;
const ORBIT_SUN_LIGHT_INTENSITY = 32;
const ORBIT_SUN_BODY_EMISSIVE_INTENSITY = 5.4;
const ORBIT_SUN_CORONA_SCALE = ORBIT_SUN_SIZE * 13.5;
const ORBIT_SUN_AUREOLE_SCALE = ORBIT_SUN_SIZE * 18.5;
const ORBIT_SUN_CORONA_OPACITY = 0.52;
const ORBIT_SUN_AUREOLE_OPACITY = 0.24;
const ORBIT_SUN_PULSE_SPEED = 0.0031;
const ORBIT_TRACK_TUBE_RADIUS = scaleDimension(0.045);
const ORBIT_HEIGHT_GUIDE_RADIUS = scaleDimension(0.018);
const ORBIT_HEIGHT_GUIDE_MARKER_SIZE = scaleDimension(0.05);
const ORBIT_HEIGHT_GUIDE_ANGLES = [-0.82, 1.34, 2.58];
const RAW_ORBIT_MOON_BASE_HEIGHT = RAW_ORBIT_TRACK_HEIGHT + scaleDimension(0.28);
const RAW_ORBIT_MOON_HEIGHT_NORTH = RAW_ORBIT_MOON_BASE_HEIGHT + scaleDimension(0.16);
const RAW_ORBIT_MOON_HEIGHT_SOUTH = RAW_ORBIT_MOON_BASE_HEIGHT - scaleDimension(0.26);
const ORBIT_MOON_BASE_HEIGHT = scaleCelestialAltitude(RAW_ORBIT_MOON_BASE_HEIGHT);
const ORBIT_MOON_HEIGHT_NORTH = scaleCelestialAltitude(RAW_ORBIT_MOON_HEIGHT_NORTH);
const ORBIT_MOON_HEIGHT_SOUTH = scaleCelestialAltitude(RAW_ORBIT_MOON_HEIGHT_SOUTH);
const ORBIT_MOON_SIZE = CELESTIAL_BODY_SIZE;
const ORBIT_MOON_HALO_OPACITY = 0.24;
const ORBIT_MOON_LIGHT_INTENSITY = 8.4;
const ORBIT_MOON_BODY_EMISSIVE_INTENSITY = 1.8;
const ORBIT_MOON_SPEED = 0.0048;
const ORBIT_MOON_CORONA_SCALE = ORBIT_MOON_SIZE * 7.2;
const ORBIT_MOON_AUREOLE_SCALE = ORBIT_MOON_SIZE * 10.4;
const ORBIT_MOON_WARM_FRINGE_SCALE = ORBIT_MOON_SIZE * 5.4;
const ORBIT_MOON_CORONA_OPACITY = 0.12;
const ORBIT_MOON_AUREOLE_OPACITY = 0.08;
const ORBIT_MOON_WARM_FRINGE_OPACITY = 0.06;
const ORBIT_MOON_PULSE_SPEED = 0.0015;
const ORBIT_MOON_LIGHT_COLOR_DAY = new THREE.Color(0xffffff);
const ORBIT_MOON_LIGHT_COLOR_NIGHT = new THREE.Color(0xffdf93);
const ORBIT_MOON_HALO_COLOR_DAY = new THREE.Color(0xffffff);
const ORBIT_MOON_HALO_COLOR_NIGHT = new THREE.Color(0xffd27a);
const ORBIT_MOON_EMISSIVE_COLOR_DAY = new THREE.Color(0xf3f3f0);
const ORBIT_MOON_EMISSIVE_COLOR_NIGHT = new THREE.Color(0xffca70);
const ORBIT_MOON_COOL_GLOW_COLOR = new THREE.Color(0x8fcbff);
const ORBIT_MOON_COOL_GLOW_SCALE = ORBIT_MOON_SIZE * 3.35;
const ORBIT_SURFACE_LINE_WIDTH = scaleDimension(0.0045);
const SUN_TRAIL_MAX_POINTS = 720;
const MOON_TRAIL_MAX_POINTS = 600;
const REALITY_TRAIL_WINDOW_MS = 12 * 60 * 60 * 1000;
const REALITY_TRAIL_REFRESH_MS = 60 * 1000;
const DAY_NIGHT_TEXTURE_SIZE = 512;
const DAY_NIGHT_UPDATE_EPSILON = 0.18;
const ANALEMMA_SURFACE_OFFSET = scaleDimension(0.046);
const SKY_ANALEMMA_RADIUS = scaleDimension(2.4);
const MAP_TEXTURE_SIZE = 8192;
const CAMERA_DEFAULT_FOV = 42;
const CAMERA_WALKER_FOV = 54;
const CAMERA_TOPDOWN_DEFAULT_RADIUS = scaleDimension(8.2);
const CAMERA_TOPDOWN_MIN_RADIUS = scaleDimension(5.9);
const CAMERA_TOPDOWN_MAX_RADIUS = scaleDimension(18.5);
const TOPDOWN_STAGE_SCALE = 1.32;
const FOG_DEFAULT_NEAR = scaleDimension(14);
const FOG_DEFAULT_FAR = scaleDimension(28);
const FOG_WALKER_NEAR = scaleDimension(36);
const FOG_WALKER_FAR = scaleDimension(180);
const FIRST_PERSON_STAGE_SCALE = 10;
const FIRST_PERSON_WORLD_RADIUS = scaleDimension(240);
const FIRST_PERSON_HORIZON_RADIUS = scaleDimension(228);
const FIRST_PERSON_SKY_RADIUS = scaleDimension(300);
const FIRST_PERSON_PREP_DURATION_MS = 1250;
const FIRST_PERSON_RETURN_DURATION_MS = 420;
const FIRST_PERSON_CELESTIAL_NEAR_RADIUS = scaleDimension(32);
const FIRST_PERSON_CELESTIAL_FAR_RADIUS = scaleDimension(74);
const FIRST_PERSON_CELESTIAL_FADE_RANGE = 5;
const FIRST_PERSON_HORIZON_OCCLUSION_RANGE = 8;
const FIRST_PERSON_HORIZON_SINK = scaleDimension(2.6);
const FIRST_PERSON_CELESTIAL_SCALE = scaleDimension(4.4) * CELESTIAL_SIZE_SCALE;
const FIRST_PERSON_SUN_SCALE = FIRST_PERSON_CELESTIAL_SCALE;
const FIRST_PERSON_MOON_SCALE = FIRST_PERSON_CELESTIAL_SCALE;
const FIRST_PERSON_SUN_RAY_LENGTH = scaleDimension(13);
const FIRST_PERSON_SUN_RAY_WIDTH = scaleDimension(1.5);
const FIRST_PERSON_SUN_RAY_SHORT_LENGTH = scaleDimension(7.4);
const FIRST_PERSON_SUN_RAY_SHORT_WIDTH = scaleDimension(0.72);
const FIRST_PERSON_SUN_RAY_ALIGNMENT_START = 0.72;
const FIRST_PERSON_SUN_RAY_ALIGNMENT_END = 0.96;
const SURFACE_Y = DISC_HEIGHT / 2;
const WALKER_SURFACE_OFFSET = scaleDimension(0.045);
const WALKER_EYE_HEIGHT = SURFACE_Y + scaleDimension(0.07);
const WALKER_BODY_HEIGHT = scaleDimension(0.12);
const WALKER_BODY_RADIUS = scaleDimension(0.045);
const WALKER_SPEED = scaleDimension(0.82);
const WALKER_LOOK_DISTANCE = scaleDimension(0.95);
const WALKER_START_LATITUDE = 37.57;
const WALKER_START_LONGITUDE = 126.98;
const WALKER_PITCH_MAX = 0.72;
const WALKER_PITCH_MIN = -1.08;
const WALKER_GUIDE_Y = SURFACE_Y + scaleDimension(0.02);
const WALKER_GUIDE_HALF_WIDTH = scaleDimension(0.28);
const WALKER_GUIDE_START = scaleDimension(0.3);
const WALKER_GUIDE_LENGTH = scaleDimension(3.7);
const WALKER_GUIDE_MARK_SIZE = scaleDimension(0.1);
const WALKER_GUIDE_MARK_GAP = scaleDimension(0.5);
const WALKER_HORIZON_SHIFT_PX = 240;
const POLARIS_HEIGHT = DOME_BASE_Y + (DOME_RADIUS * DOME_VERTICAL_SCALE) + POLARIS_ALTITUDE_OFFSET;

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
const languageToggleEl = document.getElementById("language-toggle");
const languageToggleTextEl = document.getElementById("language-toggle-text");
const uploadInput = document.getElementById("map-upload");
const resetButton = document.getElementById("reset-camera");
const detailTabsEl = document.getElementById("detail-tabs");
const controlTabButtons = [...document.querySelectorAll("[data-control-tab]")];
const controlTabPanels = [...document.querySelectorAll("[data-control-panel]")];
const translatableTextEls = [...document.querySelectorAll("[data-i18n]")];
const translatableHtmlEls = [...document.querySelectorAll("[data-i18n-html]")];
const orbitLabelEl = document.getElementById("orbit-label");
const orbitModeButtons = [...document.querySelectorAll("[data-orbit-mode]")];
const cameraTrackButtons = [...document.querySelectorAll("[data-camera-track]")];
const cameraTrackSummaryEl = document.getElementById("camera-track-summary");
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
const moonPhaseChartImageEl = document.getElementById("moon-phase-chart-image");
const moonPhasePointerEl = document.getElementById("moon-phase-pointer");
const moonPhaseLabelEl = document.getElementById("moon-phase-label");
const moonPhaseDegreesEl = document.getElementById("moon-phase-degrees");
const moonPhaseStepEl = document.getElementById("moon-phase-step");
const moonPhaseDirectionEl = document.getElementById("moon-phase-direction");
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
const i18n = createI18n();

function applyStaticTranslations() {
  document.documentElement.lang = i18n.getLanguage();
  document.title = i18n.t("documentTitle");
  detailTabsEl.setAttribute("aria-label", i18n.t("detailTabsAria"));
  languageToggleEl.checked = i18n.getLanguage() === "en";
  languageToggleEl.setAttribute("aria-label", i18n.t("languageToggleAria"));
  languageToggleTextEl.textContent = i18n.getLanguage() === "en"
    ? i18n.t("languageNameEn")
    : i18n.t("languageNameKo");
  moonPhaseChartImageEl.alt = i18n.t("moonPhaseChartAlt");

  for (const element of translatableTextEls) {
    element.textContent = i18n.t(element.dataset.i18n);
  }

  for (const element of translatableHtmlEls) {
    element.innerHTML = i18n.t(element.dataset.i18nHtml);
  }
}

const orbitModes = {
  auto: {
    labelKey: "orbitLabelAuto"
  },
  north: {
    radius: TROPIC_CANCER_RADIUS,
    labelKey: "orbitLabelNorth"
  },
  equator: {
    radius: EQUATOR_RADIUS,
    labelKey: "orbitLabelEquator"
  },
  south: {
    radius: TROPIC_CAPRICORN_RADIUS,
    labelKey: "orbitLabelSouth"
  }
};

const seasonalEventButtonLabelKeys = {
  springEquinox: "seasonalEventSpringEquinox",
  summerSolstice: "seasonalEventSummerSolstice",
  autumnEquinox: "seasonalEventAutumnEquinox",
  winterSolstice: "seasonalEventWinterSolstice"
};

function syncSeasonalEventButtonLabels() {
  for (const button of seasonalEventButtons) {
    const translationKey = seasonalEventButtonLabelKeys[button.dataset.seasonalEvent];
    if (translationKey) {
      button.textContent = i18n.t(translationKey);
    }
  }
}

applyStaticTranslations();
syncSeasonalEventButtonLabels();

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
const firstPersonScene = new THREE.Scene();
firstPersonScene.fog = new THREE.Fog(0x06101d, FOG_WALKER_NEAR, FOG_WALKER_FAR);

const camera = new THREE.PerspectiveCamera(CAMERA_DEFAULT_FOV, 1, 0.1, scaleDimension(100));
const defaultCameraLookTarget = new THREE.Vector3(0, SURFACE_Y * (5 / 6), 0);

const cameraState = {
  lookTarget: defaultCameraLookTarget.clone(),
  radius: CAMERA_TOPDOWN_DEFAULT_RADIUS,
  theta: -0.55,
  phi: 1.12,
  targetLookTarget: defaultCameraLookTarget.clone(),
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
  new THREE.CylinderGeometry(DISC_RADIUS, DISC_RADIUS, scaleDimension(0.008), 128, 1, false),
  [transparentSurfaceMaterial, dayNightOverlayMaterial, transparentSurfaceMaterial]
);
dayNightOverlay.position.y = (DISC_HEIGHT / 2) + scaleDimension(0.03);
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
northSeasonOverlay.position.y = (DISC_HEIGHT / 2) + scaleDimension(0.012);
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
southSeasonOverlay.position.y = (DISC_HEIGHT / 2) + scaleDimension(0.011);
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
  size: scaleDimension(0.048),
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
  size: scaleDimension(0.052),
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
  new THREE.TorusGeometry((RIM_OUTER_RADIUS + RIM_INNER_RADIUS) / 2, scaleDimension(0.05), 12, 128),
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

function enhanceDomeMaterialWithSunGlow(material) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.sunLocalPosition = {
      value: new THREE.Vector3(0, DOME_RADIUS, 0)
    };
    shader.uniforms.sunPulse = { value: 0.5 };
    material.userData.shader = shader;

    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
varying vec3 vDomeLocalPosition;`
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
vDomeLocalPosition = position;`
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
varying vec3 vDomeLocalPosition;
uniform vec3 sunLocalPosition;
uniform float sunPulse;`
      )
      .replace(
        "#include <opaque_fragment>",
        `vec3 domeSurfaceDirection = normalize(vDomeLocalPosition);
vec3 sunDirection = normalize(sunLocalPosition);
float sunArcDistance = distance(domeSurfaceDirection, sunDirection);
float sunHaze = 1.0 - smoothstep(0.34, 1.14, sunArcDistance);
float sunBloom = 1.0 - smoothstep(0.18, 0.94, sunArcDistance);
float sunCore = 1.0 - smoothstep(0.06, 0.24, sunArcDistance);
float upperDome = smoothstep(-0.04, 0.72, domeSurfaceDirection.y);
float pulse = 0.92 + (sunPulse * 0.08);
vec3 atmosphericBlue = mix(vec3(0.46, 0.76, 1.0), vec3(0.9, 0.97, 1.0), sunCore);
outgoingLight += atmosphericBlue * ((sunHaze * 0.26) + (sunBloom * 0.44) + (sunCore * 0.38)) * upperDome * pulse;
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.64, 0.84, 1.0), ((sunHaze * 0.22) + (sunBloom * 0.18)) * upperDome);
diffuseColor.a = min(0.82, diffuseColor.a + (sunHaze * 0.06) + (sunBloom * 0.12) + (sunCore * 0.2));
#include <opaque_fragment>`
      );
  };
  material.customProgramCacheKey = () => "dome-sun-atmosphere-v1";
}

function enhanceMoonMaterialWithPhase(material) {
  material.userData.moonPhaseState = {
    coolGlowStrength: 0,
    glowStrength: 1,
    illuminationFraction: 1,
    shadowAlpha: 0.08,
    waxing: 1
  };

  material.onBeforeCompile = (shader) => {
    const { moonPhaseState } = material.userData;
    shader.uniforms.moonCoolGlowStrength = { value: moonPhaseState.coolGlowStrength };
    shader.uniforms.moonGlowStrength = { value: moonPhaseState.glowStrength };
    shader.uniforms.moonIlluminationFraction = { value: moonPhaseState.illuminationFraction };
    shader.uniforms.moonShadowAlpha = { value: moonPhaseState.shadowAlpha };
    shader.uniforms.moonWaxing = { value: moonPhaseState.waxing };
    material.userData.phaseShader = shader;

    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
varying vec3 vMoonViewNormal;`
      )
      .replace(
        "#include <defaultnormal_vertex>",
        `#include <defaultnormal_vertex>
vMoonViewNormal = normalize(transformedNormal);`
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
varying vec3 vMoonViewNormal;
uniform float moonCoolGlowStrength;
uniform float moonGlowStrength;
uniform float moonIlluminationFraction;
uniform float moonShadowAlpha;
uniform float moonWaxing;`
      )
      .replace(
        "#include <opaque_fragment>",
        `vec3 moonViewNormal = normalize(vMoonViewNormal);
float phaseCos = clamp((moonIlluminationFraction * 2.0) - 1.0, -1.0, 1.0);
float phaseSin = sqrt(max(0.0, 1.0 - (phaseCos * phaseCos)));
float phaseDirection = mix(-1.0, 1.0, moonWaxing);
vec3 phaseLightDirection = normalize(vec3(phaseDirection * phaseSin, 0.0, phaseCos));
float phaseDot = dot(moonViewNormal, phaseLightDirection);
float phaseMask = smoothstep(-0.004, 0.02, phaseDot);
phaseMask = mix(phaseMask, 1.0, max(phaseCos, 0.0));
float shadowShade = mix(0.0, 0.05, moonGlowStrength);
float litShade = mix(1.04, 1.22, pow(max(moonViewNormal.z, 0.0), 0.35));
float phaseShade = mix(shadowShade, litShade, phaseMask);
float phaseShadow = pow(max(1.0 - phaseMask, 0.0), 1.05);
float shadowAlpha = mix(1.0, moonShadowAlpha, phaseShadow);
float terminatorBand = (1.0 - smoothstep(0.0, 0.42, abs(phaseDot))) * moonCoolGlowStrength;
float coolScatter = pow(max(1.0 - phaseMask, 0.0), 1.35) * pow(max(moonViewNormal.z, 0.0), 0.8) * moonCoolGlowStrength;
float earthshine = pow(max(1.0 - phaseMask, 0.0), 1.2) * (0.02 + (moonCoolGlowStrength * 0.05));
float selfGlow = mix(0.14, 0.42, moonGlowStrength);
vec3 moonSurfaceLight = diffuseColor.rgb * phaseShade;
vec3 moonSelfGlow = totalEmissiveRadiance * selfGlow;
outgoingLight = moonSurfaceLight + moonSelfGlow;
outgoingLight += vec3(0.02, 0.03, 0.05) * earthshine;
outgoingLight += vec3(0.28, 0.46, 0.88) * ((coolScatter * 0.24) + (terminatorBand * 0.12));
diffuseColor.a *= shadowAlpha;
#include <opaque_fragment>`
      );
  };

  material.customProgramCacheKey = () => "moon-phase-v3";
}

function setMoonMaterialPhase(material, {
  coolGlowStrength = 0,
  illuminationFraction = 1,
  shadowAlpha = 0.08,
  waxing = true,
  glowStrength = 1
}) {
  const phaseState = material.userData.moonPhaseState ?? {
    coolGlowStrength: 0,
    glowStrength: 1,
    illuminationFraction: 1,
    shadowAlpha: 0.08,
    waxing: 1
  };

  phaseState.coolGlowStrength = THREE.MathUtils.clamp(coolGlowStrength, 0, 1);
  phaseState.glowStrength = THREE.MathUtils.clamp(glowStrength, 0, 1);
  phaseState.illuminationFraction = THREE.MathUtils.clamp(illuminationFraction, 0, 1);
  phaseState.shadowAlpha = THREE.MathUtils.clamp(shadowAlpha, 0.01, 1);
  phaseState.waxing = waxing ? 1 : 0;
  material.userData.moonPhaseState = phaseState;

  if (material.userData.phaseShader) {
    material.userData.phaseShader.uniforms.moonCoolGlowStrength.value = phaseState.coolGlowStrength;
    material.userData.phaseShader.uniforms.moonGlowStrength.value = phaseState.glowStrength;
    material.userData.phaseShader.uniforms.moonIlluminationFraction.value = phaseState.illuminationFraction;
    material.userData.phaseShader.uniforms.moonShadowAlpha.value = phaseState.shadowAlpha;
    material.userData.phaseShader.uniforms.moonWaxing.value = phaseState.waxing;
  }
}

function createSunAuraTexture() {
  const size = 512;
  const canvasEl = document.createElement("canvas");
  canvasEl.width = size;
  canvasEl.height = size;
  const ctx = canvasEl.getContext("2d");
  const center = size / 2;
  const radius = size / 2;

  const baseGradient = ctx.createRadialGradient(center, center, 0, center, center, radius);
  baseGradient.addColorStop(0, "rgba(255,255,255,1)");
  baseGradient.addColorStop(0.08, "rgba(255,249,225,0.98)");
  baseGradient.addColorStop(0.22, "rgba(255,223,138,0.82)");
  baseGradient.addColorStop(0.42, "rgba(255,184,92,0.34)");
  baseGradient.addColorStop(0.68, "rgba(136,212,255,0.18)");
  baseGradient.addColorStop(1, "rgba(136,212,255,0)");
  ctx.fillStyle = baseGradient;
  ctx.fillRect(0, 0, size, size);

  ctx.globalCompositeOperation = "lighter";

  for (let i = 0; i < 16; i += 1) {
    const angle = (i / 16) * Math.PI * 2;
    const innerRadius = size * 0.1;
    const outerRadius = size * (0.32 + ((i % 4) * 0.035));
    const x0 = center + (Math.cos(angle) * innerRadius);
    const y0 = center + (Math.sin(angle) * innerRadius);
    const x1 = center + (Math.cos(angle) * outerRadius);
    const y1 = center + (Math.sin(angle) * outerRadius);
    const beamGradient = ctx.createLinearGradient(x0, y0, x1, y1);
    beamGradient.addColorStop(0, "rgba(255,246,210,0.3)");
    beamGradient.addColorStop(0.45, "rgba(255,208,118,0.16)");
    beamGradient.addColorStop(1, "rgba(145,214,255,0)");
    ctx.strokeStyle = beamGradient;
    ctx.lineWidth = 5 + ((i % 3) * 1.8);
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }

  for (let i = 0; i < 4; i += 1) {
    ctx.strokeStyle = `rgba(154,220,255,${0.1 - (i * 0.018)})`;
    ctx.lineWidth = 10 - (i * 2);
    ctx.beginPath();
    ctx.arc(center, center, size * (0.17 + (i * 0.07)), 0, Math.PI * 2);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvasEl);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

const dome = new THREE.Mesh(
  new THREE.SphereGeometry(DOME_RADIUS, 96, 48, 0, Math.PI * 2, 0, Math.PI / 2),
  new THREE.MeshPhysicalMaterial({
    color: 0x9fd8ff,
    roughness: 0.08,
    metalness: 0,
    transmission: 0.72,
    transparent: true,
    opacity: 0.24,
    thickness: scaleDimension(0.18),
    ior: 1.22,
    side: THREE.DoubleSide
  })
);
enhanceDomeMaterialWithSunGlow(dome.material);
dome.scale.y = DOME_VERTICAL_SCALE;
dome.position.y = DOME_BASE_Y;
scalableStage.add(dome);

const domeRing = new THREE.Mesh(
  new THREE.TorusGeometry(DOME_RADIUS, scaleDimension(0.045), 12, 96),
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
  POLARIS_HEIGHT,
  0
);
scalableStage.add(polaris);

const glow = new THREE.Mesh(
  new THREE.CircleGeometry(scaleDimension(6.7), 96),
  new THREE.MeshBasicMaterial({
    color: 0x123a67,
    transparent: true,
    opacity: 0.18
  })
);
glow.rotation.x = -Math.PI / 2;
glow.position.y = scaleDimension(-0.7);
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
walkerBody.position.y = WALKER_SURFACE_OFFSET + scaleDimension(0.09);
walker.add(walkerBody);

const walkerHeading = new THREE.Mesh(
  new THREE.ConeGeometry(scaleDimension(0.045), scaleDimension(0.14), 18),
  new THREE.MeshStandardMaterial({
    color: 0xffd06e,
    emissive: 0xffb84d,
    emissiveIntensity: 0.75,
    roughness: 0.24,
    metalness: 0.05
  })
);
walkerHeading.rotation.x = Math.PI / 2;
walkerHeading.position.set(0, WALKER_SURFACE_OFFSET + scaleDimension(0.1), scaleDimension(0.13));
walker.add(walkerHeading);

const walkerRing = new THREE.Mesh(
  new THREE.RingGeometry(scaleDimension(0.09), scaleDimension(0.11), 32),
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

const firstPersonAmbient = new THREE.AmbientLight(0xc5d7ff, 0.9);
firstPersonScene.add(firstPersonAmbient);

const firstPersonKeyLight = new THREE.DirectionalLight(0xeaf4ff, 1.35);
firstPersonKeyLight.position.set(5, 7, 6);
firstPersonScene.add(firstPersonKeyLight);

const firstPersonRimLight = new THREE.DirectionalLight(0x8fd9ff, 0.42);
firstPersonRimLight.position.set(-7, 4, -5);
firstPersonScene.add(firstPersonRimLight);

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

const orbitSunLight = new THREE.PointLight(0xffcf75, ORBIT_SUN_LIGHT_INTENSITY, scaleDimension(9.5), 1.4);
orbitSun.add(orbitSunLight);
scalableStage.add(orbitSun);

const observerSun = orbitSun.clone(true);
const observerSunBody = observerSun.children[0];
observerSunBody.material = observerSunBody.material.clone();
const observerSunHalo = observerSun.children[1];
observerSunHalo.material = observerSunHalo.material.clone();
const observerSunLight = observerSun.children[2];
observerSun.visible = false;
firstPersonScene.add(observerSun);

const sunAuraTexture = createSunAuraTexture();

function createSunAuraSprite(scale, color, opacity, rotation = 0) {
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: sunAuraTexture,
      color,
      transparent: true,
      opacity,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false
    })
  );
  sprite.material.rotation = rotation;
  sprite.scale.setScalar(scale);
  sprite.renderOrder = 22;
  return sprite;
}

function createMoonAuraSprite(scale, color, opacity, rotation = 0) {
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: sunAuraTexture,
      color,
      transparent: true,
      opacity,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false
    })
  );
  sprite.material.rotation = rotation;
  sprite.scale.setScalar(scale);
  sprite.renderOrder = 21;
  return sprite;
}

const orbitSunCorona = createSunAuraSprite(ORBIT_SUN_CORONA_SCALE, 0xffdc8d, ORBIT_SUN_CORONA_OPACITY);
const orbitSunAureole = createSunAuraSprite(ORBIT_SUN_AUREOLE_SCALE, 0x8fddff, ORBIT_SUN_AUREOLE_OPACITY, Math.PI / 6);
orbitSun.add(orbitSunCorona);
orbitSun.add(orbitSunAureole);

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
    const ripple = 0.84 + (Math.sin((progress * 17.5) + 0.35) * 0.16);

    for (let x = 0; x < width; x += 1) {
      const index = ((y * width) + x) * 4;
      const centeredX = Math.abs(x - (width / 2));
      const horizontalFade = Math.exp(-((centeredX / beamHalfWidth) ** 2) * 2.6);
      const glowBoost = Math.exp(-((centeredX / (width * 0.12)) ** 2) * 4.2);
      const edgeFactor = Math.min(Math.max((centeredX / beamHalfWidth) - 0.38, 0), 1);
      const coreFactor = Math.exp(-((centeredX / (width * 0.09)) ** 2) * 5.6);
      const alpha = THREE.MathUtils.clamp(
        (((verticalFade * horizontalFade * 255) + (glowBoost * verticalFade * 56)) * ripple),
        0,
        255
      );

      data[index] = Math.round((255 * (1 - (edgeFactor * 0.08))) + (242 * coreFactor * 0.08));
      data[index + 1] = Math.round((239 * (1 - (edgeFactor * 0.22))) + (252 * coreFactor * 0.18));
      data[index + 2] = Math.round((204 * (1 - (edgeFactor * 0.36))) + (255 * edgeFactor * 0.36));
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
firstPersonScene.add(firstPersonSunRayGroup);

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
    color: 0xffffff,
    emissive: 0xf3f3f0,
    emissiveIntensity: ORBIT_MOON_BODY_EMISSIVE_INTENSITY,
    roughness: 0.68,
    metalness: 0.08,
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
orbitMoonHalo.visible = false;
orbitMoon.add(orbitMoonHalo);

const orbitMoonLight = new THREE.PointLight(0xdbe4ff, ORBIT_MOON_LIGHT_INTENSITY, scaleDimension(5.5), 1.9);
orbitMoon.add(orbitMoonLight);
const orbitMoonCoolGlow = new THREE.Mesh(
  new THREE.SphereGeometry(ORBIT_MOON_COOL_GLOW_SCALE, 24, 18),
  new THREE.MeshBasicMaterial({
    color: ORBIT_MOON_COOL_GLOW_COLOR,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending
  })
);
orbitMoonCoolGlow.renderOrder = 22;
orbitMoonCoolGlow.visible = false;
orbitMoon.add(orbitMoonCoolGlow);
const orbitMoonCorona = createMoonAuraSprite(ORBIT_MOON_CORONA_SCALE, 0xf6f8ff, ORBIT_MOON_CORONA_OPACITY);
const orbitMoonAureole = createMoonAuraSprite(
  ORBIT_MOON_AUREOLE_SCALE,
  ORBIT_MOON_COOL_GLOW_COLOR,
  ORBIT_MOON_AUREOLE_OPACITY,
  Math.PI / 7
);
orbitMoonAureole.visible = false;
const orbitMoonWarmFringe = createMoonAuraSprite(
  ORBIT_MOON_WARM_FRINGE_SCALE,
  0xffefc5,
  ORBIT_MOON_WARM_FRINGE_OPACITY,
  Math.PI / 3
);
orbitMoon.add(orbitMoonCorona);
orbitMoon.add(orbitMoonAureole);
orbitMoon.add(orbitMoonWarmFringe);
scalableStage.add(orbitMoon);

const observerMoon = orbitMoon.clone(true);
const observerMoonBody = observerMoon.children[0];
observerMoonBody.material = observerMoonBody.material.clone();
const observerMoonHalo = observerMoon.children[1];
observerMoonHalo.material = observerMoonHalo.material.clone();
observerMoonHalo.visible = false;
const observerMoonLight = observerMoon.children[2];
const observerMoonCoolGlow = observerMoon.children[3];
observerMoonCoolGlow.material = observerMoonCoolGlow.material.clone();
observerMoonCoolGlow.visible = false;
const observerMoonCorona = observerMoon.children[4];
observerMoonCorona.material = observerMoonCorona.material.clone();
const observerMoonAureole = observerMoon.children[5];
observerMoonAureole.material = observerMoonAureole.material.clone();
observerMoonAureole.visible = false;
const observerMoonWarmFringe = observerMoon.children[6];
observerMoonWarmFringe.material = observerMoonWarmFringe.material.clone();
enhanceMoonMaterialWithPhase(orbitMoonBody.material);
enhanceMoonMaterialWithPhase(observerMoonBody.material);
observerMoon.visible = false;
firstPersonScene.add(observerMoon);

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
  size: scaleDimension(0.09),
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
  size: scaleDimension(0.07),
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

  if (Math.abs(height - ORBIT_TRACK_HEIGHT) > scaleDimension(0.02)) {
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
firstPersonScene.background = null;
const clock = new THREE.Clock();

const constants = {
  MODEL_SCALE,
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
  moonPhaseDegreesEl,
  moonPhaseDirectionEl,
  moonPhaseLabelEl,
  moonPhasePointerEl,
  moonPhaseStepEl,
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
  i18n,
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
  i18n,
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
  i18n,
  renderState,
  walkerState,
  movementState,
  ui,
  walker,
  walkerGuideGroup,
  walkerGuideLeft,
  walkerGuideRight,
  walkerGuideCenter,
  ambient: firstPersonAmbient,
  keyLight: firstPersonKeyLight,
  rimLight: firstPersonRimLight
});

const firstPersonWorldApi = createFirstPersonWorldController({
  scene: firstPersonScene,
  constants,
  walkerState,
  renderState,
  ambient: firstPersonAmbient,
  keyLight: firstPersonKeyLight,
  rimLight: firstPersonRimLight,
  topDownBackground: skyTexture
});

const routeSimulationApi = createRouteSimulationController({
  constants,
  i18n,
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

const celestialTrackingCameraApi = createCelestialTrackingCameraController({
  buttons: cameraTrackButtons,
  cameraState,
  constants,
  i18n,
  summaryEl: cameraTrackSummaryEl,
  trackables: {
    moon: orbitMoon,
    sun: orbitSun
  }
});

function getCurrentUiSnapshot() {
  if (astronomyState.enabled) {
    const observationDate = astronomyState.live ? new Date() : astronomyState.selectedDate;
    return astronomyApi.getAstronomySnapshot(observationDate);
  }

  return {
    date: astronomyState.selectedDate,
    sun: getGeoFromProjectedPosition(orbitSun.position, DISC_RADIUS),
    moon: getGeoFromProjectedPosition(orbitMoon.position, DISC_RADIUS),
    moonPhase: getMoonPhase(astronomyState.selectedDate)
  };
}

i18n.subscribe(() => {
  applyStaticTranslations();
  syncSeasonalEventButtonLabels();
  celestialTrackingCameraApi.refreshLocalizedUi?.();
  textureApi.refreshLocalizedUi?.();
  astronomyApi.refreshLocalizedUi?.();
  walkerApi.refreshLocalizedUi?.(getCurrentUiSnapshot());
  routeSimulationApi.refreshLocalizedUi?.();
  syncPreparationPresentation();
});

const tempPreparationLookTarget = new THREE.Vector3();
const tempObserverNorthAxis = new THREE.Vector3();
const tempObserverEastAxis = new THREE.Vector3();
const tempObserverSkyOrigin = new THREE.Vector3();
const tempObserverSkyPoint = new THREE.Vector3();
const tempObserverRelative = new THREE.Vector3();
const tempDemoSunSourceWorld = new THREE.Vector3();
const tempDemoMoonSourceWorld = new THREE.Vector3();
const tempDomeSunLocalPosition = new THREE.Vector3();
const tempSunWorldPosition = new THREE.Vector3();
const tempSunViewDirection = new THREE.Vector3();
const tempCameraForward = new THREE.Vector3();

function updateSunVisualEffects() {
  const pulse = 0.5 + (Math.sin(performance.now() * ORBIT_SUN_PULSE_SPEED) * 0.5);
  const bodyScale = THREE.MathUtils.lerp(0.96, 1.2, pulse);
  const haloScale = THREE.MathUtils.lerp(0.84, 1.34, pulse);
  const lightScale = THREE.MathUtils.lerp(0.94, 1.14, pulse);

  if (walkerState.enabled) {
    observerSunBody.material.emissiveIntensity *= bodyScale;
    observerSunHalo.material.opacity *= haloScale;
    observerSunLight.intensity *= lightScale;
  } else {
    orbitSunBody.material.emissiveIntensity = ORBIT_SUN_BODY_EMISSIVE_INTENSITY * bodyScale;
    orbitSunHalo.material.opacity = ORBIT_SUN_HALO_OPACITY * haloScale;
    orbitSunLight.intensity = ORBIT_SUN_LIGHT_INTENSITY * lightScale;
    orbitSunCorona.material.opacity = ORBIT_SUN_CORONA_OPACITY * THREE.MathUtils.lerp(0.88, 1.18, pulse);
    orbitSunAureole.material.opacity = ORBIT_SUN_AUREOLE_OPACITY * THREE.MathUtils.lerp(0.82, 1.24, pulse);
    orbitSunCorona.scale.setScalar(ORBIT_SUN_CORONA_SCALE * THREE.MathUtils.lerp(0.94, 1.08, pulse));
    orbitSunAureole.scale.setScalar(ORBIT_SUN_AUREOLE_SCALE * THREE.MathUtils.lerp(0.96, 1.12, pulse));
    orbitSunAureole.material.rotation += 0.0016;
  }

  orbitSun.getWorldPosition(tempSunWorldPosition);
  tempDomeSunLocalPosition.copy(tempSunWorldPosition);
  dome.worldToLocal(tempDomeSunLocalPosition);
  if (dome.material.userData.shader) {
    dome.material.userData.shader.uniforms.sunLocalPosition.value.copy(tempDomeSunLocalPosition);
    dome.material.userData.shader.uniforms.sunPulse.value = pulse;
  }
}

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
  let title = i18n.t("prepTitlePreparingObserver");
  let copy = i18n.t("prepCopyPreparingObserver");

  if (displayProgress >= 0.72 && !renderState.compileReady) {
    title = i18n.t("prepTitleCompilingShaders");
    copy = i18n.t("prepCopyCompilingShaders");
  } else if (displayProgress >= 0.42) {
    title = i18n.t("prepTitleShiftingAtmosphere");
    copy = i18n.t("prepCopyShiftingAtmosphere");
  }

  if (renderState.compileReady && displayProgress >= 0.92) {
    title = i18n.t("prepTitleLockingCamera");
    copy = i18n.t("prepCopyLockingCamera");
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
  firstPersonScene.fog.near += (renderState.targetFogNear - firstPersonScene.fog.near) * 0.08;
  firstPersonScene.fog.far += (renderState.targetFogFar - firstPersonScene.fog.far) * 0.08;
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

function getMoonRenderState(snapshot) {
  const moonPhase = snapshot?.moonPhase ?? {
    illuminationFraction: 1,
    waxing: true
  };
  const illuminationFraction = THREE.MathUtils.clamp(moonPhase.illuminationFraction ?? 1, 0, 1);
  const moonSolarFactor = snapshot
    ? getSolarAltitudeFactor(
      snapshot.moon.latitudeDegrees,
      snapshot.moon.longitudeDegrees,
      snapshot.sun.latitudeDegrees,
      snapshot.sun.longitudeDegrees
    )
    : -1;
  const nightGlow = snapshot
    ? THREE.MathUtils.clamp((-moonSolarFactor + 0.04) / 0.3, 0, 1)
    : 1;
  const nightWarmthBase = THREE.MathUtils.clamp((nightGlow - 0.56) / 0.34, 0, 1);
  const nightWarmth = nightWarmthBase * nightWarmthBase * (3 - (2 * nightWarmthBase));
  const phaseGlow = Math.pow(illuminationFraction, 0.72);
  const shadowCoverage = Math.pow(1 - illuminationFraction, 0.78);
  const terminatorPresence = Math.pow(Math.max(0, 1 - Math.abs((illuminationFraction * 2) - 1)), 0.58);
  const coolGlowStrength = nightGlow * terminatorPresence;
  const pulseTime = performance.now();
  const pulse = 0.5 + (Math.sin(pulseTime * ORBIT_MOON_PULSE_SPEED) * 0.5);
  const auraStrength = nightGlow * THREE.MathUtils.lerp(0.24, 1, phaseGlow);

  return {
    aureoleOpacity: (
      ORBIT_MOON_AUREOLE_OPACITY *
      auraStrength *
      THREE.MathUtils.lerp(0.42, 1, terminatorPresence) *
      THREE.MathUtils.lerp(0.86, 1.16, pulse)
    ),
    aureoleRotation: (Math.PI / 7) + (pulseTime * 0.00008),
    aureoleScale: ORBIT_MOON_AUREOLE_SCALE * THREE.MathUtils.lerp(0.96, 1.1, pulse),
    bodyEmissiveIntensity: (
      THREE.MathUtils.lerp(0.12, ORBIT_MOON_BODY_EMISSIVE_INTENSITY, nightGlow) *
      THREE.MathUtils.lerp(0.18, 1, phaseGlow)
    ),
    coolGlowOpacity: 0.18 * coolGlowStrength,
    coolGlowStrength,
    coronaOpacity: ORBIT_MOON_CORONA_OPACITY * auraStrength * THREE.MathUtils.lerp(0.84, 1.12, pulse),
    coronaRotation: pulseTime * 0.00005,
    coronaScale: ORBIT_MOON_CORONA_SCALE * THREE.MathUtils.lerp(0.92, 1.08, pulse),
    glowStrength: THREE.MathUtils.lerp(0.08, 1, nightGlow),
    haloOpacity: ORBIT_MOON_HALO_OPACITY * nightGlow * THREE.MathUtils.lerp(0.18, 1, phaseGlow),
    illuminationFraction,
    lightIntensity: ORBIT_MOON_LIGHT_INTENSITY * nightGlow * THREE.MathUtils.lerp(0.14, 1, phaseGlow),
    nightWarmth,
    shadowAlpha: THREE.MathUtils.lerp(0.12, 0.012, Math.max(shadowCoverage, terminatorPresence)),
    warmFringeOpacity: (
      ORBIT_MOON_WARM_FRINGE_OPACITY *
      auraStrength *
      THREE.MathUtils.lerp(0.1, 1, nightWarmth) *
      THREE.MathUtils.lerp(0.88, 1.18, 1 - pulse)
    ),
    warmFringeRotation: (Math.PI / 3) - (pulseTime * 0.00012),
    warmFringeScale: ORBIT_MOON_WARM_FRINGE_SCALE * THREE.MathUtils.lerp(0.94, 1.12, 1 - pulse),
    waxing: moonPhase.waxing !== false
  };
}

function syncMoonMaterialPresentation(material, moonRenderState) {
  setMoonMaterialPhase(material, {
    coolGlowStrength: moonRenderState.coolGlowStrength,
    illuminationFraction: moonRenderState.illuminationFraction,
    shadowAlpha: moonRenderState.shadowAlpha,
    waxing: moonRenderState.waxing,
    glowStrength: moonRenderState.glowStrength
  });
}

function syncMoonLightPresentation(
  bodyMaterial,
  haloMaterial,
  coolGlowMaterial,
  coronaSprite,
  aureoleSprite,
  warmFringeSprite,
  pointLight,
  moonRenderState
) {
  const coronaMaterial = coronaSprite.material;
  const aureoleMaterial = aureoleSprite.material;
  const warmFringeMaterial = warmFringeSprite.material;

  bodyMaterial.emissive.copy(ORBIT_MOON_EMISSIVE_COLOR_DAY).lerp(
    ORBIT_MOON_EMISSIVE_COLOR_NIGHT,
    moonRenderState.nightWarmth
  );
  haloMaterial.color.copy(ORBIT_MOON_HALO_COLOR_DAY).lerp(
    ORBIT_MOON_HALO_COLOR_NIGHT,
    moonRenderState.nightWarmth
  );
  pointLight.color.copy(ORBIT_MOON_LIGHT_COLOR_DAY).lerp(
    ORBIT_MOON_LIGHT_COLOR_NIGHT,
    moonRenderState.nightWarmth
  );
  coolGlowMaterial.color.copy(ORBIT_MOON_COOL_GLOW_COLOR);
  coolGlowMaterial.opacity = moonRenderState.coolGlowOpacity;
  coronaMaterial.color.copy(ORBIT_MOON_LIGHT_COLOR_DAY).lerp(
    ORBIT_MOON_LIGHT_COLOR_NIGHT,
    moonRenderState.nightWarmth * 0.42
  );
  coronaMaterial.opacity = moonRenderState.coronaOpacity;
  coronaMaterial.rotation = moonRenderState.coronaRotation;
  coronaSprite.scale.setScalar(moonRenderState.coronaScale);
  aureoleMaterial.color.copy(ORBIT_MOON_COOL_GLOW_COLOR).lerp(ORBIT_MOON_LIGHT_COLOR_DAY, 0.22);
  aureoleMaterial.opacity = moonRenderState.aureoleOpacity;
  aureoleMaterial.rotation = moonRenderState.aureoleRotation;
  aureoleSprite.scale.setScalar(moonRenderState.aureoleScale);
  warmFringeMaterial.color.copy(ORBIT_MOON_LIGHT_COLOR_DAY).lerp(
    ORBIT_MOON_HALO_COLOR_NIGHT,
    moonRenderState.nightWarmth
  );
  warmFringeMaterial.opacity = moonRenderState.warmFringeOpacity;
  warmFringeMaterial.rotation = moonRenderState.warmFringeRotation;
  warmFringeSprite.scale.setScalar(moonRenderState.warmFringeScale);
}

function updateObserverCelestialPerspective(snapshot) {
  if (!walkerState.enabled || !snapshot) {
    const moonRenderState = getMoonRenderState(snapshot);
    syncMoonMaterialPresentation(orbitMoonBody.material, moonRenderState);
    syncMoonMaterialPresentation(observerMoonBody.material, moonRenderState);
    syncMoonLightPresentation(
      orbitMoonBody.material,
      orbitMoonHalo.material,
      orbitMoonCoolGlow.material,
      orbitMoonCorona,
      orbitMoonAureole,
      orbitMoonWarmFringe,
      orbitMoonLight,
      moonRenderState
    );
    syncMoonLightPresentation(
      observerMoonBody.material,
      observerMoonHalo.material,
      observerMoonCoolGlow.material,
      observerMoonCorona,
      observerMoonAureole,
      observerMoonWarmFringe,
      observerMoonLight,
      moonRenderState
    );
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
    orbitMoonBody.material.emissiveIntensity = moonRenderState.bodyEmissiveIntensity;
    orbitMoonBody.material.depthTest = false;
    orbitMoonBody.material.depthWrite = false;
    orbitMoonHalo.material.opacity = moonRenderState.haloOpacity;
    orbitMoonHalo.material.depthTest = true;
    orbitMoonHalo.material.depthWrite = false;
    orbitMoonLight.intensity = moonRenderState.lightIntensity;
    return;
  }

  const observerGeo = getGeoFromProjectedPosition(walkerState.position, constants.DISC_RADIUS);
  const moonRenderState = getMoonRenderState(snapshot);
  const sunHorizontal = getHorizontalFromWorldPosition(
    orbitSun.getWorldPosition(tempDemoSunSourceWorld),
    observerGeo
  );
  const moonHorizontal = getHorizontalFromWorldPosition(
    orbitMoon.getWorldPosition(tempDemoMoonSourceWorld),
    observerGeo
  );
  const adjustedSunHorizontal = applyCelestialAltitudeOffset(sunHorizontal);
  const adjustedMoonHorizontal = applyCelestialAltitudeOffset(moonHorizontal);
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
  syncMoonMaterialPresentation(orbitMoonBody.material, moonRenderState);
  syncMoonMaterialPresentation(observerMoonBody.material, moonRenderState);
  syncMoonLightPresentation(
    orbitMoonBody.material,
    orbitMoonHalo.material,
    orbitMoonCoolGlow.material,
    orbitMoonCorona,
    orbitMoonAureole,
    orbitMoonWarmFringe,
    orbitMoonLight,
    moonRenderState
  );
  syncMoonLightPresentation(
    observerMoonBody.material,
    observerMoonHalo.material,
    observerMoonCoolGlow.material,
    observerMoonCorona,
    observerMoonAureole,
    observerMoonWarmFringe,
    observerMoonLight,
    moonRenderState
  );

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
    ((moonRenderState.bodyEmissiveIntensity * moonOcclusionVisibility) - observerMoonBody.material.emissiveIntensity)
  ) * 0.12;
  observerMoonHalo.material.depthTest = false;
  observerMoonHalo.material.depthWrite = false;
  observerMoonHalo.material.opacity += (
    (moonRenderState.haloOpacity * moonOcclusionVisibility) - observerMoonHalo.material.opacity
  ) * 0.18;
  observerMoonLight.intensity += (
    (moonRenderState.lightIntensity * moonOcclusionVisibility) - observerMoonLight.intensity
  ) * 0.18;
}

function configurePreparationCamera(targetCamera) {
  const visualScale = constants.FIRST_PERSON_STAGE_SCALE;
  const horizontalDistance = Math.cos(walkerState.pitch) * constants.WALKER_LOOK_DISTANCE;

  targetCamera.fov = constants.CAMERA_WALKER_FOV;
  targetCamera.aspect = camera.aspect;
  targetCamera.near = 0.05;
  targetCamera.far = scaleDimension(140);
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
    : renderer.compileAsync(firstPersonScene, configurePreparationCamera(camera.clone())).catch(() => null);

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

languageToggleEl.addEventListener("change", () => {
  i18n.setLanguage(languageToggleEl.checked ? "en" : "ko");
});

uploadInput.addEventListener("change", (event) => {
  const file = event.target.files[0];
  textureApi.loadUserTexture(file);
});

resetButton.addEventListener("click", () => {
  if (walkerState.enabled || renderState.preparing) {
    exitFirstPersonMode();
  }
  celestialTrackingCameraApi.clearTracking();
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

for (const button of cameraTrackButtons) {
  button.addEventListener("click", () => {
    celestialTrackingCameraApi.setTarget(button.dataset.cameraTrack);
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
    const demoMoonGeo = getGeoFromProjectedPosition(orbitMoon.position, DISC_RADIUS);
    astronomyApi.updateDayNightOverlayFromSun(demoSunGeo.latitudeDegrees, demoSunGeo.longitudeDegrees);
    snapshot = {
      date: projectionDate,
      sun: demoSunGeo,
      moon: demoMoonGeo,
      moonPhase: getMoonPhase(projectionDate)
    };
    astronomyApi.updateAstronomyUi(snapshot);
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
  celestialTrackingCameraApi.update();
  cameraApi.updateCamera();
  firstPersonWorldApi.update(snapshot);
  if (snapshot) {
    updateObserverCelestialPerspective(snapshot);
  }
  updateSunVisualEffects();
  renderer.render(walkerState.enabled ? firstPersonScene : scene, camera);
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

