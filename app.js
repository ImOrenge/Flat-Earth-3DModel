import * as THREE from "./vendor/three.module.js";
import {
  getGeoFromProjectedPosition,
  projectedRadiusFromLatitude
} from "./modules/geo-utils.js";
import {
  createSolarEclipseState,
  getMoonPhase,
  getSolarAltitudeFactor,
} from "./modules/astronomy-utils.js?v=20260313-natural-eclipse1";
import { createAstronomyController } from "./modules/astronomy-controller.js?v=20260314-natural-eclipse2";
import { createCameraController } from "./modules/camera-controller.js?v=20260313-tracking-angle1";
import { createCelestialTrackingCameraController } from "./modules/celestial-tracking-camera-controller.js?v=20260313-tracking-angle1";
import { createFirstPersonWorldController } from "./modules/first-person-world-controller.js?v=20260312-darksun-eclipse1";
import { createI18n } from "./modules/i18n.js?v=20260314-magnetic-diamond1";
import { createMagneticFieldController } from "./modules/magnetic-field-controller.js?v=20260314-magnetic-circulation1";
import { createRouteSimulationController } from "./modules/route-simulation-controller.js";
import { createTextureManager } from "./modules/texture-manager.js?v=20260311-gpu-daynight";
import { createWalkerController } from "./modules/walker-controller.js?v=20260312-darksun-eclipse1";

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
const SUN_ORBIT_ALTITUDE_CONTRAST = 2.35;
const MOON_ORBIT_ALTITUDE_CONTRAST = 1.85;
const RAW_ORBIT_TRACK_HEIGHT = DOME_BASE_Y + scaleDimension(2.01) - CELESTIAL_HEIGHT_DROP;
const RAW_ORBIT_SUN_HEIGHT = RAW_ORBIT_TRACK_HEIGHT + scaleDimension(0.12);
const RAW_ORBIT_SUN_HEIGHT_NORTH = RAW_ORBIT_SUN_HEIGHT + (scaleDimension(0.52) * SUN_ORBIT_ALTITUDE_CONTRAST);
const RAW_ORBIT_SUN_HEIGHT_SOUTH = RAW_ORBIT_SUN_HEIGHT - (scaleDimension(0.56) * SUN_ORBIT_ALTITUDE_CONTRAST);
const ORBIT_TRACK_HEIGHT = scaleCelestialAltitude(RAW_ORBIT_TRACK_HEIGHT);
const ORBIT_SUN_HEIGHT = scaleCelestialAltitude(RAW_ORBIT_SUN_HEIGHT);
const ORBIT_SUN_HEIGHT_NORTH = scaleCelestialAltitude(RAW_ORBIT_SUN_HEIGHT_NORTH);
const ORBIT_SUN_HEIGHT_SOUTH = scaleCelestialAltitude(RAW_ORBIT_SUN_HEIGHT_SOUTH);
const CELESTIAL_BODY_SIZE = scaleDimension(0.13) * CELESTIAL_SIZE_SCALE;
const ORBIT_SUN_SIZE = CELESTIAL_BODY_SIZE;
const ORBIT_SUN_SPEED = 0.011;
const ORBIT_DARK_SUN_SPEED = ORBIT_SUN_SPEED * 0.72;
const ORBIT_DARK_SUN_BAND_SPEED_FACTOR = 1.08;
const ORBIT_DARK_SUN_SIZE = ORBIT_SUN_SIZE * 1.04;
const ORBIT_DARK_SUN_BODY_COLOR = 0x03060d;
const ORBIT_DARK_SUN_DEBUG_COLOR = 0x183244;
const ORBIT_DARK_SUN_RIM_COLOR = 0x4b6f95;
const ORBIT_DARK_SUN_DEBUG_RIM_COLOR = 0x9ad7ff;
const ORBIT_DARK_SUN_DEBUG_OPACITY = 0.92;
const ORBIT_DARK_SUN_DEBUG_RIM_OPACITY = 0.42;
const ORBIT_DARK_SUN_OCCLUSION_OPACITY = 0.98;
const ORBIT_DARK_SUN_RIM_OPACITY = 0.16;
const DARK_SUN_ATTRACTION_START_FACTOR = 2.9;
const DARK_SUN_ATTRACTION_END_FACTOR = 0.14;
const DARK_SUN_CAPTURE_RESPONSE = 0.042;
const DARK_SUN_RELEASE_RESPONSE = 0.12;
const DARK_SUN_TRANSIT_PERPENDICULAR_COMPRESSION = 0.03;
const DARK_SUN_TRANSIT_ALONG_COMPRESSION = 0.62;
const DARK_SUN_HOLD_DAMPING = 0.976;
const DARK_SUN_CENTER_HOLD_FACTOR = 0.82;
const DARK_SUN_ECLIPSE_TRANSIT_SLOW_FACTOR = 0.22;
const DARK_SUN_ECLIPSE_RESPONSE_SLOW_FACTOR = 0.34;
const DARK_SUN_ALTITUDE_LOCK_START = 0.72;
const DARK_SUN_ALTITUDE_ALIGNMENT_TOLERANCE_FACTOR = 0.032;
const DARK_SUN_STAGE_PRE_ECLIPSE_DISTANCE_FACTOR = 1.4;
const DARK_SUN_STAGE_START_OFFSET_RADIANS = Math.PI / 2;
const SOLAR_ECLIPSE_TRIGGER_MARGIN_PX = 24;
const SOLAR_ECLIPSE_TRIGGER_MARGIN_FACTOR = 0.32;
const SOLAR_ECLIPSE_APPROACH_DISTANCE_FACTOR = 1.8;
const SOLAR_ECLIPSE_TOAST_DISTANCE_FACTOR = 2.15;
const SOLAR_ECLIPSE_IDLE_DISTANCE_FACTOR = 2.1;
const SOLAR_ECLIPSE_MIN_COVERAGE = 0.002;
const SOLAR_ECLIPSE_TOTAL_COVERAGE = 0.98;
const SOLAR_ECLIPSE_DIRECTION_EPSILON = 0.003;
const SOLAR_ECLIPSE_CONTACT_START_PX = -1.25;
const SOLAR_ECLIPSE_VISIBLE_CONTACT_PX = 0.2;
const SOLAR_ECLIPSE_TIER_NONE = "none";
const SOLAR_ECLIPSE_TIER_TOTAL = "total-eligible";
const SOLAR_ECLIPSE_TIER_PARTIAL_2 = "partial-eligible-2";
const SOLAR_ECLIPSE_TIER_PARTIAL_3 = "partial-eligible-3";
const SOLAR_ECLIPSE_PARTIAL_LANE_2_CAP = 0.72;
const SOLAR_ECLIPSE_PARTIAL_LANE_3_CAP = 0.42;
const SOLAR_ECLIPSE_APPROACH_MIN_MS = 3200;
const SOLAR_ECLIPSE_PARTIAL_STAGE_MIN_MS = 2600;
const SOLAR_ECLIPSE_TOTALITY_MIN_MS = 1800;
const SOLAR_ECLIPSE_COMPLETE_FADE_MS = 1200;
const SOLAR_ECLIPSE_SLOW_LOOKAHEAD_FRAMES = 420;
const SOLAR_ECLIPSE_TOAST_DURATION_MS = 3200;
const SOLAR_ECLIPSE_APPROACH_SLOW_FACTOR = 0.18;
const SOLAR_ECLIPSE_TOTALITY_SLOW_FACTOR = 0.025;
const SOLAR_ECLIPSE_COMPLETE_SLOW_FACTOR = 0.22;
const SOLAR_ECLIPSE_ANIMATION_SLOW_RESPONSE = 9.5;
const SOLAR_ECLIPSE_PRESENTATION_COVERAGE_RATE = 0.08;
const SOLAR_ECLIPSE_COMPLETE_HOLD_FRAMES = 72;
const STAGE_PRE_ECLIPSE_SEARCH_MAX_FRAMES = 40000;
const STAGE_PRE_ECLIPSE_REFINEMENT_FRAMES = 2400;
const DARK_SUN_STAGE_DURATION_SECONDS = 32;
const DARK_SUN_STAGE_CONTACT_OFFSET_RADIANS = 0.34;
const DARK_SUN_STAGE_CONTACT_MARGIN_RADIANS = 0.028;
const DARK_SUN_STAGE_APPROACH_SHARE = 0.34;
const DARK_SUN_STAGE_INGRESS_SHARE = 0.26;
const DARK_SUN_STAGE_TOTALITY_SHARE = 0.16;
const DARK_SUN_STAGE_EGRESS_SHARE = 0.18;
const DARK_SUN_STAGE_COMPLETE_SHARE = 0.06;
const ORBIT_SUN_SEASON_SPEED = 0.0026;
const ORBIT_MOON_BAND_SPEED_FACTOR = 0.86;
const CELESTIAL_TRAIL_LENGTH_DEFAULT_PERCENT = 100;
const CELESTIAL_SPEED_DEFAULT = 0.5;
const ORBIT_SUN_HALO_OPACITY = 0.2;
const ORBIT_SUN_LIGHT_INTENSITY = 32;
const ORBIT_SUN_BODY_EMISSIVE_INTENSITY = 5.4;
const ORBIT_SUN_CORONA_SCALE = ORBIT_SUN_SIZE * 13.5;
const ORBIT_SUN_AUREOLE_SCALE = ORBIT_SUN_SIZE * 18.5;
const ORBIT_SUN_CORONA_OPACITY = 0.52;
const ORBIT_SUN_AUREOLE_OPACITY = 0.24;
const ORBIT_SUN_PULSE_SPEED = 0.0031;
const SUN_COIL_TURNS = 10;
const SUN_COIL_AMPLITUDE = scaleDimension(0.05);
const SUN_COIL_PITCH = scaleDimension(0.075);
const ORBIT_TRACK_TUBE_RADIUS = scaleDimension(0.045);
const SUN_COIL_BASE_CLEARANCE = ORBIT_TRACK_TUBE_RADIUS + (ORBIT_SUN_SIZE * 1.12);
const SUN_COIL_DOME_CLEARANCE = ORBIT_SUN_SIZE * 1.55;
const ORBIT_HEIGHT_GUIDE_RADIUS = scaleDimension(0.018);
const ORBIT_HEIGHT_GUIDE_MARKER_SIZE = scaleDimension(0.05);
const ORBIT_HEIGHT_GUIDE_ANGLES = [-0.82, 1.34, 2.58];
const RAW_ORBIT_MOON_BASE_HEIGHT = RAW_ORBIT_TRACK_HEIGHT + scaleDimension(0.28);
const RAW_ORBIT_MOON_HEIGHT_NORTH = RAW_ORBIT_MOON_BASE_HEIGHT + (scaleDimension(0.16) * MOON_ORBIT_ALTITUDE_CONTRAST);
const RAW_ORBIT_MOON_HEIGHT_SOUTH = RAW_ORBIT_MOON_BASE_HEIGHT - (scaleDimension(0.26) * MOON_ORBIT_ALTITUDE_CONTRAST);
const ORBIT_MOON_BASE_HEIGHT = scaleCelestialAltitude(RAW_ORBIT_MOON_BASE_HEIGHT);
const ORBIT_MOON_HEIGHT_NORTH = scaleCelestialAltitude(RAW_ORBIT_MOON_HEIGHT_NORTH);
const ORBIT_MOON_HEIGHT_SOUTH = scaleCelestialAltitude(RAW_ORBIT_MOON_HEIGHT_SOUTH);
const ORBIT_MOON_SIZE = CELESTIAL_BODY_SIZE;
const ORBIT_MOON_HALO_OPACITY = 0.24;
const ORBIT_MOON_LIGHT_INTENSITY = 8.4;
const ORBIT_MOON_BODY_EMISSIVE_INTENSITY = 1.8;
const ORBIT_MOON_SPEED = 0.0058;
const DEMO_MOON_PHASE_DAYS_PER_SECOND = 3;
const DEMO_MOON_PHASE_MS_PER_SECOND = DEMO_MOON_PHASE_DAYS_PER_SECOND * 86_400_000;
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
const CAMERA_TRACKING_DEFAULT_DISTANCE = scaleDimension(3.8);
const CAMERA_TRACKING_MIN_DISTANCE = scaleDimension(2.4);
const CAMERA_TRACKING_MAX_DISTANCE = scaleDimension(6.8);
const CAMERA_TRACKING_DEFAULT_AZIMUTH = -0.72;
const CAMERA_TRACKING_DEFAULT_ELEVATION = 0.66;
const CAMERA_TRACKING_MIN_ELEVATION = 0.22;
const CAMERA_TRACKING_MAX_ELEVATION = 1.18;
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
const solarEclipseToastEl = document.getElementById("solar-eclipse-toast");
const solarEclipseToastTitleEl = document.getElementById("solar-eclipse-toast-title");
const solarEclipseToastCopyEl = document.getElementById("solar-eclipse-toast-copy");
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
const celestialTrailLengthEl = document.getElementById("celestial-trail-length");
const celestialTrailLengthValueEl = document.getElementById("celestial-trail-length-value");
const celestialSpeedEl = document.getElementById("celestial-speed");
const celestialSpeedValueEl = document.getElementById("celestial-speed-value");
const celestialFullTrailEl = document.getElementById("celestial-full-trail");
const celestialMotionSummaryEl = document.getElementById("celestial-motion-summary");
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
const magneticFieldOverlayEl = document.getElementById("magnetic-field-overlay");
const magneticFieldSummaryEl = document.getElementById("magnetic-field-summary");
const solarEclipseStateEl = document.getElementById("solar-eclipse-state");
const solarEclipseStageEl = document.getElementById("solar-eclipse-stage");
const solarEclipseCoverageEl = document.getElementById("solar-eclipse-coverage");
const solarEclipseLightEl = document.getElementById("solar-eclipse-light");
const solarEclipseSummaryEl = document.getElementById("solar-eclipse-summary");
const stagePreEclipseButton = document.getElementById("stage-pre-eclipse");
const darkSunDebugEl = document.getElementById("dark-sun-debug");
const darkSunDebugSummaryEl = document.getElementById("dark-sun-debug-summary");
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
  mode: "free",
  radius: CAMERA_TOPDOWN_DEFAULT_RADIUS,
  theta: -0.55,
  phi: 1.12,
  targetLookTarget: defaultCameraLookTarget.clone(),
  targetTheta: -0.55,
  targetPhi: 1.12,
  targetRadius: CAMERA_TOPDOWN_DEFAULT_RADIUS,
  trackingAzimuth: CAMERA_TRACKING_DEFAULT_AZIMUTH,
  trackingDistance: CAMERA_TRACKING_DEFAULT_DISTANCE,
  trackingElevation: CAMERA_TRACKING_DEFAULT_ELEVATION,
  targetTrackingAzimuth: CAMERA_TRACKING_DEFAULT_AZIMUTH,
  targetTrackingDistance: CAMERA_TRACKING_DEFAULT_DISTANCE,
  targetTrackingElevation: CAMERA_TRACKING_DEFAULT_ELEVATION
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

const dayNightOverlayMaterial = new THREE.ShaderMaterial({
  uniforms: {
    discRadius: { value: DISC_RADIUS },
    overlayOpacity: { value: 0.88 },
    sunLatitudeTrig: { value: new THREE.Vector2(0, 1) },
    sunLongitudeRadians: { value: 0 },
    nightLightsMap: { value: null }
  },
  vertexShader: `
    varying vec2 vUv;

    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform float discRadius;
    uniform float overlayOpacity;
    uniform vec2 sunLatitudeTrig;
    uniform float sunLongitudeRadians;
    uniform sampler2D nightLightsMap;
    varying vec2 vUv;

    void main() {
      float worldZ = (vUv.x - 0.5) * discRadius * 2.0;
      float worldX = (vUv.y - 0.5) * discRadius * 2.0;
      float projectedRadius = length(vec2(worldX, worldZ));

      if (projectedRadius > discRadius) {
        discard;
      }

      float latitudeRadians = radians(90.0 - ((projectedRadius / discRadius) * 180.0));
      float longitudeRadians = atan(worldZ, -worldX);
      float solarFactor = (
        (sin(latitudeRadians) * sunLatitudeTrig.x) +
        (cos(latitudeRadians) * sunLatitudeTrig.y * cos(longitudeRadians - sunLongitudeRadians))
      );
      float nightStrength = clamp((-solarFactor + 0.02) / 0.18, 0.0, 1.0);
      float twilightStrength = 1.0 - clamp(abs(solarFactor) / 0.06, 0.0, 1.0);
      float twilightMix = clamp(twilightStrength * (1.0 - (nightStrength * 0.35)), 0.0, 1.0);
      float deepNight = clamp((nightStrength - 0.14) / 0.86, 0.0, 1.0);
      float nightLightStrength = texture2D(nightLightsMap, vec2(vUv.x, 1.0 - vUv.y)).r * deepNight;
      float lightBoost = nightLightStrength * (0.82 + (deepNight * 0.68));
      vec3 baseColor = vec3(
        mix(12.0, 96.0, twilightMix),
        mix(20.0, 128.0, twilightMix),
        mix(34.0, 196.0, twilightMix)
      ) / 255.0;
      vec3 finalColor = clamp(baseColor + vec3(
        lightBoost,
        lightBoost * (208.0 / 255.0),
        lightBoost * (108.0 / 255.0)
      ), 0.0, 1.0);
      float alpha = clamp(
        ((nightStrength * 172.0) + (twilightMix * 52.0) + (lightBoost * 42.0)) / 255.0,
        0.0,
        232.0 / 255.0
      );

      gl_FragColor = vec4(finalColor, alpha * overlayOpacity);
      #include <colorspace_fragment>
    }
  `,
  transparent: true,
  depthWrite: false,
  depthTest: false,
  side: THREE.DoubleSide,
  toneMapped: false
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
orbitSunBody.renderOrder = 24;
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
orbitSunHalo.renderOrder = 23;
orbitSun.add(orbitSunHalo);

const orbitSunLight = new THREE.PointLight(0xffcf75, ORBIT_SUN_LIGHT_INTENSITY, scaleDimension(9.5), 1.4);
orbitSun.add(orbitSunLight);
scalableStage.add(orbitSun);

const observerSun = orbitSun.clone(true);
const observerSunBody = observerSun.children[0];
observerSunBody.material = observerSunBody.material.clone();
observerSunBody.renderOrder = orbitSunBody.renderOrder;
const observerSunHalo = observerSun.children[1];
observerSunHalo.material = observerSunHalo.material.clone();
observerSunHalo.renderOrder = orbitSunHalo.renderOrder;
const observerSunLight = observerSun.children[2];
observerSun.visible = false;
firstPersonScene.add(observerSun);
enhanceSunMaterialWithEclipseMask(orbitSunBody.material);
enhanceSunMaterialWithEclipseMask(observerSunBody.material);

function createDarkSunGroup() {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.SphereGeometry(ORBIT_DARK_SUN_SIZE, 32, 24),
    new THREE.MeshBasicMaterial({
      color: ORBIT_DARK_SUN_BODY_COLOR,
      transparent: true,
      opacity: ORBIT_DARK_SUN_DEBUG_OPACITY,
      depthTest: false,
      depthWrite: false
    })
  );
  body.renderOrder = 31;
  group.add(body);

  const rim = new THREE.Mesh(
    new THREE.SphereGeometry(ORBIT_DARK_SUN_SIZE * 1.08, 24, 16),
    new THREE.MeshBasicMaterial({
      color: ORBIT_DARK_SUN_RIM_COLOR,
      transparent: true,
      opacity: ORBIT_DARK_SUN_RIM_OPACITY,
      side: THREE.BackSide,
      depthTest: false,
      depthWrite: false
    })
  );
  rim.renderOrder = 30;
  group.add(rim);

  group.visible = false;
  return group;
}

function enhanceDarkSunMaterialWithSunMask(material) {
  material.userData.darkSunMaskState = {
    active: 0,
    centerNdc: new THREE.Vector2(),
    radius: 0,
    viewport: new THREE.Vector2(1, 1)
  };

  material.onBeforeCompile = (shader) => {
    const { darkSunMaskState } = material.userData;
    shader.uniforms.darkSunMaskActive = { value: darkSunMaskState.active };
    shader.uniforms.darkSunMaskCenterNdc = { value: darkSunMaskState.centerNdc };
    shader.uniforms.darkSunMaskRadius = { value: darkSunMaskState.radius };
    shader.uniforms.darkSunMaskViewport = { value: darkSunMaskState.viewport };
    material.userData.darkSunMaskShader = shader;
    const darkSunMaskFragment = `if (darkSunMaskActive > 0.5) {
vec2 darkSunMaskNdc = vec2(
  ((gl_FragCoord.x / max(darkSunMaskViewport.x, 1.0)) * 2.0) - 1.0,
  ((gl_FragCoord.y / max(darkSunMaskViewport.y, 1.0)) * 2.0) - 1.0
);
if (distance(darkSunMaskNdc, darkSunMaskCenterNdc) > darkSunMaskRadius) {
  discard;
}
}`;

    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
uniform float darkSunMaskActive;
uniform vec2 darkSunMaskCenterNdc;
uniform float darkSunMaskRadius;
uniform vec2 darkSunMaskViewport;`
      )
    if (shader.fragmentShader.includes("#include <opaque_fragment>")) {
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <opaque_fragment>",
        `${darkSunMaskFragment}
#include <opaque_fragment>`
      );
    } else {
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <output_fragment>",
        `${darkSunMaskFragment}
#include <output_fragment>`
      );
    }
  };
  material.customProgramCacheKey = () => "dark-sun-mask-v1";
}

function enhanceSunMaterialWithEclipseMask(material) {
  material.userData.sunEclipseMaskState = {
    active: 0,
    centerNdc: new THREE.Vector2(),
    radius: 0,
    softnessPx: 1,
    strength: 0,
    viewport: new THREE.Vector2(1, 1)
  };

  material.onBeforeCompile = (shader) => {
    const { sunEclipseMaskState } = material.userData;
    shader.uniforms.sunEclipseMaskActive = { value: sunEclipseMaskState.active };
    shader.uniforms.sunEclipseMaskCenterNdc = { value: sunEclipseMaskState.centerNdc };
    shader.uniforms.sunEclipseMaskRadius = { value: sunEclipseMaskState.radius };
    shader.uniforms.sunEclipseMaskSoftnessPx = { value: sunEclipseMaskState.softnessPx };
    shader.uniforms.sunEclipseMaskStrength = { value: sunEclipseMaskState.strength };
    shader.uniforms.sunEclipseMaskViewport = { value: sunEclipseMaskState.viewport };
    material.userData.sunEclipseMaskShader = shader;

    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
uniform float sunEclipseMaskActive;
uniform vec2 sunEclipseMaskCenterNdc;
uniform float sunEclipseMaskRadius;
uniform float sunEclipseMaskSoftnessPx;
uniform float sunEclipseMaskStrength;
uniform vec2 sunEclipseMaskViewport;`
      )
      .replace(
        "#include <opaque_fragment>",
        `float sunEclipseMask = 0.0;
if (sunEclipseMaskActive > 0.5 && sunEclipseMaskStrength > 0.5) {
  vec2 sunEclipseFragNdc = vec2(
    ((gl_FragCoord.x / max(sunEclipseMaskViewport.x, 1.0)) * 2.0) - 1.0,
    ((gl_FragCoord.y / max(sunEclipseMaskViewport.y, 1.0)) * 2.0) - 1.0
  );
  vec2 sunEclipseDeltaPx = vec2(
    (sunEclipseFragNdc.x - sunEclipseMaskCenterNdc.x) * max(sunEclipseMaskViewport.x, 1.0) * 0.5,
    (sunEclipseFragNdc.y - sunEclipseMaskCenterNdc.y) * max(sunEclipseMaskViewport.y, 1.0) * 0.5
  );
  float sunEclipseDistancePx = length(sunEclipseDeltaPx);
  float sunEclipseRadiusPx = sunEclipseMaskRadius * max(sunEclipseMaskViewport.x, 1.0) * 0.5;
  sunEclipseMask = 1.0 - smoothstep(
    sunEclipseRadiusPx - sunEclipseMaskSoftnessPx,
    sunEclipseRadiusPx + sunEclipseMaskSoftnessPx,
    sunEclipseDistancePx
  );
}
outgoingLight *= (1.0 - sunEclipseMask);
#include <opaque_fragment>`
      );
  };

  material.customProgramCacheKey = () => "sun-eclipse-mask-v1";
}

const orbitDarkSun = createDarkSunGroup();
scalableStage.add(orbitDarkSun);
const orbitDarkSunBody = orbitDarkSun.children[0];
const orbitDarkSunRim = orbitDarkSun.children[1];
enhanceDarkSunMaterialWithSunMask(orbitDarkSunBody.material);
enhanceDarkSunMaterialWithSunMask(orbitDarkSunRim.material);

const observerDarkSun = orbitDarkSun.clone(true);
const observerDarkSunBody = observerDarkSun.children[0];
observerDarkSunBody.material = observerDarkSunBody.material.clone();
observerDarkSunBody.renderOrder = orbitDarkSunBody.renderOrder;
enhanceDarkSunMaterialWithSunMask(observerDarkSunBody.material);
const observerDarkSunRim = observerDarkSun.children[1];
observerDarkSunRim.material = observerDarkSunRim.material.clone();
observerDarkSunRim.renderOrder = orbitDarkSunRim.renderOrder;
enhanceDarkSunMaterialWithSunMask(observerDarkSunRim.material);
observerDarkSun.visible = false;
firstPersonScene.add(observerDarkSun);

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

const sunFullTrailGeometry = new THREE.BufferGeometry();
const sunFullTrailMaterial = new THREE.LineBasicMaterial({
  color: 0xffdc85,
  transparent: true,
  opacity: 0.26,
  depthWrite: false,
  depthTest: false
});
const sunFullTrail = new THREE.Line(sunFullTrailGeometry, sunFullTrailMaterial);
scalableStage.add(sunFullTrail);

const sunFullTrailPointsGeometry = new THREE.BufferGeometry();
const sunFullTrailPointsMaterial = new THREE.PointsMaterial({
  color: 0xffef9a,
  size: scaleDimension(0.05),
  sizeAttenuation: true,
  transparent: true,
  opacity: 0.22,
  depthWrite: false,
  depthTest: false
});
const sunFullTrailPointsCloud = new THREE.Points(sunFullTrailPointsGeometry, sunFullTrailPointsMaterial);
scalableStage.add(sunFullTrailPointsCloud);

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

const moonFullTrailGeometry = new THREE.BufferGeometry();
const moonFullTrailMaterial = new THREE.LineBasicMaterial({
  color: 0xd7def2,
  transparent: true,
  opacity: 0.24,
  depthWrite: false,
  depthTest: false
});
const moonFullTrail = new THREE.Line(moonFullTrailGeometry, moonFullTrailMaterial);
scalableStage.add(moonFullTrail);

const moonFullTrailPointsGeometry = new THREE.BufferGeometry();
const moonFullTrailPointsMaterial = new THREE.PointsMaterial({
  color: 0xf4f7ff,
  size: scaleDimension(0.04),
  sizeAttenuation: true,
  transparent: true,
  opacity: 0.2,
  depthWrite: false,
  depthTest: false
});
const moonFullTrailPointsCloud = new THREE.Points(moonFullTrailPointsGeometry, moonFullTrailPointsMaterial);
scalableStage.add(moonFullTrailPointsCloud);

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
  darkSunBandDirection: -1,
  darkSunBandProgress: 0.88,
  darkSunDebugVisible: false,
  darkSunStageAltitudeLock: false,
  darkSunStageHasEclipsed: false,
  darkSunStageOffsetRadians: 0,
  darkSunStageTotalityHoldMs: 0,
  darkSunStageTransit: 0,
  demoPhaseDateMs: Date.now(),
  moonBandDirection: -1,
  moonBandProgress: 0.62,
  darkSunOrbitPhaseOffsetRadians: Math.PI,
  orbitDarkSunAngle: Math.PI,
  orbitMoonAngle: Math.PI * 0.35,
  orbitMode: "auto",
  orbitSeasonPhase: -Math.PI / 2,
  orbitSunAngle: 0,
  sunBandDirection: 1,
  sunBandProgress: 0.12
};
const astronomyState = {
  enabled: true,
  live: true,
  selectedDate: new Date(),
  lastTrailRebuildMs: 0,
  lastInputSyncMs: 0
};
const celestialControlState = {
  trailLengthFactor: CELESTIAL_TRAIL_LENGTH_DEFAULT_PERCENT / 100,
  speedMultiplier: CELESTIAL_SPEED_DEFAULT,
  showFullTrail: true
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
const magneticFieldState = {
  enabled: true
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
const solarEclipseTrackingState = {
  displayCoverage: 0,
  displayStageElapsedMs: 0,
  displayStageKey: "idle",
  hasEnteredVisibleOverlap: false,
  previousCoverage: 0,
  previousStageKey: "idle",
  recentActiveFrames: 0
};
const solarEclipseEventState = {
  animationSpeedFactor: 1,
  currentState: createSolarEclipseState(),
  framesUntilEclipseStart: Number.POSITIVE_INFINITY,
  slowWindowActive: false,
  toastActive: false,
  toastDismissAtMs: 0,
  toastShownForCurrentEvent: false,
  toastStateLabelKey: "solarEclipseStatePartial"
};
const solarEclipsePresentationMaskState = {
  maskCenterNdc: new THREE.Vector2(),
  maskRadius: 0,
  lastDirectionNdc: new THREE.Vector2(1, 0),
  observerBaseScale: new THREE.Vector3(1, 1, 1),
  orbitBaseScale: new THREE.Vector3(1, 1, 1),
  valid: false
};
solarEclipsePresentationMaskState.orbitBaseScale.copy(orbitDarkSun.scale);
solarEclipsePresentationMaskState.observerBaseScale.copy(observerDarkSun.scale);

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
  CAMERA_TRACKING_DEFAULT_AZIMUTH,
  CAMERA_TRACKING_DEFAULT_DISTANCE,
  CAMERA_TRACKING_DEFAULT_ELEVATION,
  CAMERA_TRACKING_MAX_DISTANCE,
  CAMERA_TRACKING_MAX_ELEVATION,
  CAMERA_TRACKING_MIN_DISTANCE,
  CAMERA_TRACKING_MIN_ELEVATION,
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
  DOME_VERTICAL_SCALE,
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
  ORBIT_MOON_BAND_SPEED_FACTOR,
  ORBIT_MOON_HEIGHT_NORTH,
  ORBIT_MOON_HEIGHT_SOUTH,
  ORBIT_MOON_SIZE,
  ORBIT_MOON_SPEED,
  ORBIT_TRACK_TUBE_RADIUS,
  ORBIT_RADIUS_AMPLITUDE,
  ORBIT_RADIUS_MID,
  ORBIT_SUN_SEASON_SPEED,
  ORBIT_SUN_SPEED,
  ORBIT_SUN_SIZE,
  RIM_INNER_RADIUS,
  SURFACE_Y,
  SUN_COIL_AMPLITUDE,
  SUN_COIL_BASE_CLEARANCE,
  SUN_COIL_DOME_CLEARANCE,
  SUN_COIL_PITCH,
  SUN_COIL_TURNS,
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
  celestialFullTrailEl,
  celestialMotionSummaryEl,
  celestialSpeedEl,
  celestialSpeedValueEl,
  celestialTrailLengthEl,
  celestialTrailLengthValueEl,
  dayNightOverlayEl,
  dayNightSummaryEl,
  darkSunDebugEl,
  darkSunDebugSummaryEl,
  firstPersonHorizonEl,
  firstPersonOverlayEl,
  magneticFieldOverlayEl,
  magneticFieldSummaryEl,
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
  solarEclipseCoverageEl,
  solarEclipseLightEl,
  solarEclipseStageEl,
  solarEclipseStateEl,
  solarEclipseSummaryEl,
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
const magneticFieldApi = createMagneticFieldController({
  constants,
  i18n,
  ui,
  magneticFieldState,
  orbitSun,
  scalableStage,
  walkerState
});
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
dayNightOverlayMaterial.uniforms.nightLightsMap.value = textureApi.getNightLightsTexture();

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
  magneticFieldApi,
  astronomyState,
  celestialControlState,
  seasonalMoonState,
  analemmaState,
  skyAnalemmaState,
  dayNightState,
  simulationState,
  walkerState,
  orbitModes,
  orbitModeButtons,
  seasonalEventButtons,
  dayNightOverlayMaterial,
  dayNightOverlay,
  analemmaProjectionGeometry,
  analemmaProjectionPointsGeometry,
  skyAnalemmaGeometry,
  skyAnalemmaPointsGeometry,
  orbitSun,
  orbitDarkSun,
  orbitMoon,
  sunFullTrailGeometry,
  sunFullTrailPointsGeometry,
  sunTrailGeometry,
  sunTrailPointsGeometry,
  moonFullTrailGeometry,
  moonFullTrailPointsGeometry,
  moonTrailGeometry,
  moonTrailPointsGeometry,
  northSeasonOverlay,
  southSeasonOverlay
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

function getCurrentDarkSunRenderStateSnapshot() {
  if (!astronomyApi) {
    return null;
  }

  const naturalDarkSunRenderState = astronomyApi.getDarkSunRenderState({
    orbitMode: simulationState.orbitMode,
    source: "demo",
    sunDirection: simulationState.sunBandDirection,
    sunOrbitAngleRadians: simulationState.orbitSunAngle,
    sunProgress: simulationState.sunBandProgress
  });

  if (!simulationState.darkSunStageAltitudeLock) {
    return naturalDarkSunRenderState;
  }

  return astronomyApi.getDarkSunRenderState({
    direction: simulationState.sunBandDirection ?? naturalDarkSunRenderState.direction,
    orbitAngleRadians: naturalDarkSunRenderState.orbitAngleRadians,
    orbitMode: simulationState.orbitMode,
    progress: simulationState.sunBandProgress,
    source: "demo",
    useExplicitOrbit: true
  });
}

function getDarkSunStageContactOffsetRadians(currentSunRenderState = null) {
  const bodyRadiusSum = (
    getWorldBodyRadius(orbitSunBody, ORBIT_SUN_SIZE) +
    getWorldBodyRadius(orbitDarkSunBody, ORBIT_DARK_SUN_SIZE)
  );
  const centerRadius = Math.max(
    currentSunRenderState?.centerRadius ?? Math.hypot(
      currentSunRenderState?.position?.x ?? 0,
      currentSunRenderState?.position?.z ?? 0
    ),
    bodyRadiusSum * 0.5,
    0.0001
  );
  const contactRatio = THREE.MathUtils.clamp(
    bodyRadiusSum / Math.max(centerRadius * 2, 0.0001),
    0,
    0.9999
  );
  const naturalContactOffset = 2 * Math.asin(contactRatio);
  return THREE.MathUtils.clamp(
    naturalContactOffset + DARK_SUN_STAGE_CONTACT_MARGIN_RADIANS,
    DARK_SUN_STAGE_CONTACT_MARGIN_RADIANS * 2,
    DARK_SUN_STAGE_CONTACT_OFFSET_RADIANS
  );
}

function getProjectedDarkSunStageMetricsForOffsetRadians({
  offsetRadians = 0,
  sunRenderState = null,
  sunDirection = simulationState.sunBandDirection ?? 1,
  sunProgress = simulationState.sunBandProgress ?? 0.5,
  trackCandidateSun = false
} = {}) {
  if (!astronomyApi || !sunRenderState) {
    return null;
  }

  const candidateDarkSunRenderState = astronomyApi.getDarkSunRenderState({
    direction: sunDirection,
    orbitAngleRadians: (sunRenderState.orbitAngleRadians ?? 0) + offsetRadians,
    orbitMode: simulationState.orbitMode,
    progress: sunProgress,
    source: "demo",
    useExplicitOrbit: true
  });
  const eclipseMetrics = getProjectedSolarEclipseMetricsFromStates(
    sunRenderState,
    candidateDarkSunRenderState,
    {
      trackCandidateSun
    }
  );

  return {
    darkSunRenderState: candidateDarkSunRenderState,
    eclipseMetrics,
    offsetRadians
  };
}

function findDarkSunStagePreContactOffsetRadians({
  sunRenderState = null,
  sunDirection = simulationState.sunBandDirection ?? 1,
  sunProgress = simulationState.sunBandProgress ?? 0.5,
  trackCandidateSun = false
} = {}) {
  if (!astronomyApi || !sunRenderState) {
    return null;
  }

  const fallbackContactOffset = getDarkSunStageContactOffsetRadians(sunRenderState);
  const minOffsetRadians = 0.0005;
  const maxOffsetRadians = Math.max(
    minOffsetRadians + 0.0005,
    Math.min(Math.PI * 0.35, Math.max(fallbackContactOffset * 1.75, 0.42))
  );
  const targetPreContactDepthPx = -18;
  let bestVisibleOverlapCandidate = null;
  let searchStart = minOffsetRadians;
  let searchEnd = maxOffsetRadians;
  let bestCandidate = null;

  for (let passIndex = 0; passIndex < 3; passIndex += 1) {
    const sampleCount = passIndex === 0 ? 180 : 120;
    let bestCandidateInPass = null;

    for (let sampleIndex = 0; sampleIndex <= sampleCount; sampleIndex += 1) {
      const sampleProgress = sampleIndex / Math.max(sampleCount, 1);
      const offsetRadians = THREE.MathUtils.lerp(searchStart, searchEnd, sampleProgress);
      const candidateMetrics = getProjectedDarkSunStageMetricsForOffsetRadians({
        offsetRadians,
        sunDirection,
        sunProgress,
        sunRenderState,
        trackCandidateSun
      });
      const eclipseMetrics = candidateMetrics?.eclipseMetrics;

      if (!eclipseMetrics?.visibleInView) {
        continue;
      }

      if (eclipseMetrics.hasVisibleOverlap) {
        const visibleScore = (
          Math.abs((eclipseMetrics.contactDepthPx ?? SOLAR_ECLIPSE_VISIBLE_CONTACT_PX) - SOLAR_ECLIPSE_VISIBLE_CONTACT_PX) +
          ((eclipseMetrics.coverage ?? 0) * 200) +
          (offsetRadians * 24)
        );
        if (!bestVisibleOverlapCandidate || visibleScore < bestVisibleOverlapCandidate.score) {
          bestVisibleOverlapCandidate = {
            ...candidateMetrics,
            score: visibleScore
          };
        }
      }

      const isPreContact = !eclipseMetrics.hasContact && !eclipseMetrics.hasVisibleOverlap;
      const approachPenalty = eclipseMetrics.hasApproachWindow ? 0 : 100;
      const totalScore = isPreContact
        ? (
          approachPenalty +
          Math.abs((eclipseMetrics.contactDepthPx ?? targetPreContactDepthPx) - targetPreContactDepthPx) +
          Math.abs((eclipseMetrics.normalizedDistance ?? 1) - 1) +
          (offsetRadians * 24)
        )
        : (
          10000 +
          Math.abs(eclipseMetrics.contactDepthPx ?? 0)
        );

      if (!bestCandidateInPass || totalScore < bestCandidateInPass.score) {
        bestCandidateInPass = {
          ...candidateMetrics,
          score: totalScore
        };
      }
    }

    if (!bestCandidateInPass) {
      break;
    }

    bestCandidate = bestCandidateInPass;
    const refinementSpan = Math.max(
      (searchEnd - searchStart) / Math.max(sampleCount, 1),
      0.0005
    );
    searchStart = Math.max(minOffsetRadians, bestCandidate.offsetRadians - (refinementSpan * 2));
    searchEnd = Math.min(maxOffsetRadians, bestCandidate.offsetRadians + (refinementSpan * 2));
  }

  if (bestCandidate && bestCandidate.offsetRadians <= Math.max(fallbackContactOffset * 0.6, 0.08)) {
    return bestCandidate;
  }

  if (bestVisibleOverlapCandidate) {
    return bestVisibleOverlapCandidate;
  }

  return bestCandidate;
}

function getDarkSunStageRelativeOrbitOffsetRadians(
  transit = 0,
  contactOffsetRadians = DARK_SUN_STAGE_CONTACT_OFFSET_RADIANS
) {
  const clampedTransit = THREE.MathUtils.clamp(transit, 0, 1);
  const approachEnd = DARK_SUN_STAGE_APPROACH_SHARE;
  const ingressEnd = approachEnd + DARK_SUN_STAGE_INGRESS_SHARE;
  const totalityEnd = ingressEnd + DARK_SUN_STAGE_TOTALITY_SHARE;
  const egressEnd = totalityEnd + DARK_SUN_STAGE_EGRESS_SHARE;
  const easeOutSine = (value) => Math.sin((THREE.MathUtils.clamp(value, 0, 1) * Math.PI) / 2);
  const easeInOutCubic = (value) => {
    const clampedValue = THREE.MathUtils.clamp(value, 0, 1);
    return clampedValue < 0.5
      ? 4 * clampedValue * clampedValue * clampedValue
      : 1 - (Math.pow((-2 * clampedValue) + 2, 3) / 2);
  };

  if (clampedTransit <= approachEnd) {
    return THREE.MathUtils.lerp(
      Math.PI,
      contactOffsetRadians,
      easeOutSine(clampedTransit / Math.max(approachEnd, 0.0001))
    );
  }

  if (clampedTransit <= ingressEnd) {
    const ingressProgress = THREE.MathUtils.clamp(
      (clampedTransit - approachEnd) / Math.max(DARK_SUN_STAGE_INGRESS_SHARE, 0.0001),
      0,
      1
    );
    return THREE.MathUtils.lerp(
      contactOffsetRadians,
      0,
      ingressProgress
    );
  }

  if (clampedTransit <= totalityEnd) {
    return 0;
  }

  if (clampedTransit <= egressEnd) {
    const egressProgress = THREE.MathUtils.clamp(
      (clampedTransit - totalityEnd) / Math.max(DARK_SUN_STAGE_EGRESS_SHARE, 0.0001),
      0,
      1
    );
    return THREE.MathUtils.lerp(
      0,
      -contactOffsetRadians,
      egressProgress
    );
  }

  return THREE.MathUtils.lerp(
    -contactOffsetRadians,
    -Math.PI,
    easeOutSine((clampedTransit - egressEnd) / Math.max(DARK_SUN_STAGE_COMPLETE_SHARE, 0.0001))
  );
}

function updateDarkSunStageOrbit(deltaSeconds = 0) {
  if (!simulationState.darkSunStageAltitudeLock) {
    return false;
  }

  simulationState.darkSunStageTransit = THREE.MathUtils.clamp(
    (simulationState.darkSunStageTransit ?? 0) + (Math.max(deltaSeconds, 0) / DARK_SUN_STAGE_DURATION_SECONDS),
    0,
    1
  );
  const stageTransit = simulationState.darkSunStageTransit ?? 0;
  const currentSunRenderState = astronomyApi?.getSunRenderState({
    orbitAngleRadians: simulationState.orbitSunAngle,
    orbitMode: simulationState.orbitMode,
    progress: simulationState.sunBandProgress,
    source: "demo"
  }) ?? null;
  const contactOffsetRadians = getDarkSunStageContactOffsetRadians(currentSunRenderState);
  const nextOffsetRadians = getDarkSunStageRelativeOrbitOffsetRadians(stageTransit, contactOffsetRadians);
  simulationState.darkSunStageOffsetRadians = nextOffsetRadians;
  simulationState.orbitDarkSunAngle = simulationState.orbitSunAngle + nextOffsetRadians;

  if (stageTransit >= 1) {
    astronomyApi.syncDarkSunMirrorPhaseOffset({
      sunOrbitAngleRadians: simulationState.orbitSunAngle,
      darkSunOrbitAngleRadians: simulationState.orbitDarkSunAngle
    });
    resetDarkSunStageState();
  }

  return true;
}

function getCurrentUiSnapshot() {
  if (astronomyState.enabled) {
    const observationDate = astronomyState.live ? new Date() : astronomyState.selectedDate;
    return astronomyApi.getAstronomySnapshot(observationDate);
  }

  const demoPhaseDate = new Date(simulationState.demoPhaseDateMs);
  const sunRenderState = astronomyApi.getSunRenderState({
    orbitAngleRadians: simulationState.orbitSunAngle,
    orbitMode: simulationState.orbitMode,
    progress: simulationState.sunBandProgress,
    source: "demo"
  });
  const darkSunRenderState = getCurrentDarkSunRenderStateSnapshot();

  return {
    date: demoPhaseDate,
    sun: getGeoFromProjectedPosition(orbitSun.position, DISC_RADIUS),
    moon: getGeoFromProjectedPosition(orbitMoon.position, DISC_RADIUS),
    darkSunRenderState,
    moonPhase: getMoonPhase(demoPhaseDate),
    darkSunRenderPosition: orbitDarkSun.position.clone(),
    solarEclipse: createSolarEclipseState(),
    sunPosition: orbitSun.position.clone(),
    sunRenderState,
    sunRenderPosition: orbitSun.position.clone(),
    sunDisplayHorizontal: astronomyApi?.getSunDisplayHorizontalFromPosition?.(orbitSun.position),
    moonPosition: orbitMoon.position.clone(),
    moonRenderPosition: orbitMoon.position.clone()
  };
}

function getSolarEclipseToastStateLabelKey(solarEclipse = createSolarEclipseState()) {
  return solarEclipse.eclipseTier === SOLAR_ECLIPSE_TIER_TOTAL
    ? "solarEclipseStateTotal"
    : "solarEclipseStatePartial";
}

function syncSolarEclipseToastContent() {
  if (!solarEclipseToastTitleEl || !solarEclipseToastCopyEl) {
    return;
  }

  solarEclipseToastTitleEl.textContent = i18n.t("solarEclipseToastImminentTitle");
  solarEclipseToastCopyEl.textContent = i18n.t("solarEclipseToastImminentBody", {
    state: i18n.t(solarEclipseEventState.toastStateLabelKey)
  });
}

function setSolarEclipseToastVisibility(visible) {
  if (!solarEclipseToastEl) {
    return;
  }

  solarEclipseToastEl.hidden = !visible;
  solarEclipseToastEl.classList.toggle("active", visible);
}

function hideSolarEclipseToast() {
  solarEclipseEventState.toastActive = false;
  solarEclipseEventState.toastDismissAtMs = 0;
  setSolarEclipseToastVisibility(false);
}

function showSolarEclipseToast(solarEclipse = createSolarEclipseState()) {
  solarEclipseEventState.toastStateLabelKey = getSolarEclipseToastStateLabelKey(solarEclipse);
  solarEclipseEventState.toastActive = true;
  solarEclipseEventState.toastDismissAtMs = performance.now() + SOLAR_ECLIPSE_TOAST_DURATION_MS;
  solarEclipseEventState.toastShownForCurrentEvent = true;
  syncSolarEclipseToastContent();
  setSolarEclipseToastVisibility(true);
}

function predictUpcomingSolarEclipseStartFrameCount(frameCount = SOLAR_ECLIPSE_SLOW_LOOKAHEAD_FRAMES) {
  if (astronomyState.enabled || !astronomyApi) {
    return Number.POSITIVE_INFINITY;
  }

  const orbitMode = simulationState.orbitMode ?? "auto";
  const baseSpeedMultiplier = Math.max(celestialControlState.speedMultiplier ?? 1, 0);
  if (baseSpeedMultiplier <= 0) {
    return Number.POSITIVE_INFINITY;
  }

  let predictedSunAngle = simulationState.orbitSunAngle ?? 0;
  let predictedSunProgress = simulationState.sunBandProgress ?? 0.5;
  let predictedSunDirection = simulationState.sunBandDirection ?? 1;
  const predictedSunAngleStep = ORBIT_SUN_SPEED * baseSpeedMultiplier;
  const predictedSunBandStep = getBodyBandProgressStep("sun") * baseSpeedMultiplier;

  for (let frameIndex = 1; frameIndex <= frameCount; frameIndex += 1) {
    predictedSunAngle += predictedSunAngleStep;
    if (orbitMode === "auto") {
      const nextBandState = getAdvancedBandState(
        predictedSunProgress,
        predictedSunDirection,
        predictedSunBandStep
      );
      predictedSunProgress = nextBandState.progress;
      predictedSunDirection = nextBandState.direction;
    }

    const predictedSunRenderState = astronomyApi.getSunRenderState({
      orbitAngleRadians: predictedSunAngle,
      orbitMode,
      progress: predictedSunProgress,
      source: "demo"
    });
    const predictedDarkSunRenderState = astronomyApi.getDarkSunRenderState({
      orbitMode,
      source: "demo",
      sunDirection: predictedSunDirection,
      sunOrbitAngleRadians: predictedSunAngle,
      sunProgress: predictedSunProgress
    });
    const predictedMetrics = getProjectedSolarEclipseMetricsFromStates(
      predictedSunRenderState,
      predictedDarkSunRenderState
    );

    if (predictedMetrics.hasContact || predictedMetrics.hasVisibleOverlap) {
      return frameIndex;
    }
  }

  return Number.POSITIVE_INFINITY;
}

function getSolarEclipseAnimationTargetFactor(solarEclipse = createSolarEclipseState()) {
  const phaseKey = getSolarEclipsePhaseKey(solarEclipse);
  const coverage = THREE.MathUtils.clamp(solarEclipse.coverage ?? 0, 0, 1);
  const sunlightScale = THREE.MathUtils.clamp(solarEclipse.sunlightScale ?? 1, 0, 1);
  const darkness = THREE.MathUtils.clamp(1 - sunlightScale, 0, 1);
  const eclipseStrength = Math.max(coverage, darkness);
  const contactStrength = solarEclipse.hasContact
    ? Math.max(eclipseStrength, 0.35)
    : eclipseStrength;
  const framesUntilStart = solarEclipseEventState.framesUntilEclipseStart ?? Number.POSITIVE_INFINITY;
  const hasUpcomingSlowWindow = (
    !solarEclipse.active &&
    !solarEclipse.hasContact &&
    Number.isFinite(framesUntilStart) &&
    framesUntilStart <= SOLAR_ECLIPSE_SLOW_LOOKAHEAD_FRAMES
  );
  const slowLookaheadProgress = hasUpcomingSlowWindow
    ? THREE.MathUtils.clamp(
      1 - (framesUntilStart / Math.max(SOLAR_ECLIPSE_SLOW_LOOKAHEAD_FRAMES, 1)),
      0,
      1
    )
    : 0;
  const approachSlowFactor = THREE.MathUtils.lerp(
    1,
    SOLAR_ECLIPSE_APPROACH_SLOW_FACTOR,
    slowLookaheadProgress
  );
  const ingressSlowProgress = Math.pow(contactStrength, 0.54);
  const egressRecoveryProgress = Math.pow(1 - contactStrength, 3.1);

  switch (phaseKey) {
    case "approach":
      return hasUpcomingSlowWindow ? approachSlowFactor : 1;
    case "partialIngress":
      return THREE.MathUtils.lerp(
        SOLAR_ECLIPSE_APPROACH_SLOW_FACTOR,
        SOLAR_ECLIPSE_TOTALITY_SLOW_FACTOR,
        ingressSlowProgress
      );
    case "totality":
      return SOLAR_ECLIPSE_TOTALITY_SLOW_FACTOR;
    case "partialEgress":
      return THREE.MathUtils.lerp(
        SOLAR_ECLIPSE_TOTALITY_SLOW_FACTOR,
        SOLAR_ECLIPSE_COMPLETE_SLOW_FACTOR,
        egressRecoveryProgress
      );
    case "complete":
      return SOLAR_ECLIPSE_COMPLETE_SLOW_FACTOR;
    default:
      if (solarEclipse.hasContact) {
        return THREE.MathUtils.lerp(
          SOLAR_ECLIPSE_APPROACH_SLOW_FACTOR,
          SOLAR_ECLIPSE_TOTALITY_SLOW_FACTOR,
          0.35
        );
      }
      if (hasUpcomingSlowWindow) {
        return approachSlowFactor;
      }
      return 1;
  }
}

function updateSolarEclipseAnimationPacing(deltaSeconds = 0) {
  const targetFactor = astronomyState.enabled
    ? 1
    : getSolarEclipseAnimationTargetFactor(solarEclipseEventState.currentState);
  const blend = THREE.MathUtils.clamp(
    Math.max(deltaSeconds, 0) * SOLAR_ECLIPSE_ANIMATION_SLOW_RESPONSE,
    0,
    1
  );
  solarEclipseEventState.animationSpeedFactor = blend > 0
    ? THREE.MathUtils.lerp(
      solarEclipseEventState.animationSpeedFactor ?? 1,
      targetFactor,
      blend
    )
    : targetFactor;
  return solarEclipseEventState.animationSpeedFactor;
}

function updateSolarEclipseEventFeedback(solarEclipse = createSolarEclipseState(), nowMs = performance.now()) {
  const nextSolarEclipse = createSolarEclipseState(solarEclipse);
  solarEclipseEventState.currentState = nextSolarEclipse;
  solarEclipseEventState.framesUntilEclipseStart = (
    nextSolarEclipse.hasContact || nextSolarEclipse.hasVisibleOverlap
  )
    ? 0
    : (
      !astronomyState.enabled &&
      nextSolarEclipse.eclipseTier !== SOLAR_ECLIPSE_TIER_NONE
        ? predictUpcomingSolarEclipseStartFrameCount(SOLAR_ECLIPSE_SLOW_LOOKAHEAD_FRAMES)
        : Number.POSITIVE_INFINITY
    );
  solarEclipseEventState.slowWindowActive = (
    Number.isFinite(solarEclipseEventState.framesUntilEclipseStart) &&
    solarEclipseEventState.framesUntilEclipseStart <= SOLAR_ECLIPSE_SLOW_LOOKAHEAD_FRAMES
  );
  const toastDistance = Number.isFinite(nextSolarEclipse.normalizedDistance)
    ? nextSolarEclipse.normalizedDistance
    : Number.POSITIVE_INFINITY;
  const shouldShowEarlyToast = (
    nextSolarEclipse.eclipseTier !== SOLAR_ECLIPSE_TIER_NONE &&
    nextSolarEclipse.visibleInView &&
    !nextSolarEclipse.hasVisibleOverlap &&
    toastDistance <= SOLAR_ECLIPSE_TOAST_DISTANCE_FACTOR
  );

  if (
    shouldShowEarlyToast &&
    !solarEclipseEventState.toastShownForCurrentEvent
  ) {
    showSolarEclipseToast(nextSolarEclipse);
  }

  if (
    nextSolarEclipse.eclipseTier === SOLAR_ECLIPSE_TIER_NONE ||
    !nextSolarEclipse.visibleInView ||
    toastDistance > SOLAR_ECLIPSE_IDLE_DISTANCE_FACTOR
  ) {
    solarEclipseEventState.toastShownForCurrentEvent = false;
  }

  if (solarEclipseEventState.toastActive && nowMs >= solarEclipseEventState.toastDismissAtMs) {
    hideSolarEclipseToast();
  }
}

function syncFullTrailVisibility() {
  const visible = celestialControlState.showFullTrail && !walkerState.enabled;
  sunFullTrail.visible = visible;
  sunFullTrailPointsCloud.visible = visible;
  moonFullTrail.visible = visible;
  moonFullTrailPointsCloud.visible = visible;
}

i18n.subscribe(() => {
  applyStaticTranslations();
  syncSolarEclipseToastContent();
  syncSeasonalEventButtonLabels();
  celestialTrackingCameraApi.refreshLocalizedUi?.();
  textureApi.refreshLocalizedUi?.();
  astronomyApi.refreshLocalizedUi?.();
  magneticFieldApi.refreshLocalizedUi?.();
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
const tempDemoDarkSunSourceWorld = new THREE.Vector3();
const tempDomeSunLocalPosition = new THREE.Vector3();
const tempSunWorldPosition = new THREE.Vector3();
const tempDarkSunWorldPosition = new THREE.Vector3();
const tempSunViewDirection = new THREE.Vector3();
const tempCameraForward = new THREE.Vector3();
const tempCameraRight = new THREE.Vector3();
const tempProjectedCenter = new THREE.Vector3();
const tempProjectedEdge = new THREE.Vector3();
const tempProjectedOffset = new THREE.Vector3();
const tempBodyWorldScale = new THREE.Vector3();
const tempProjectedSunNdc = new THREE.Vector3();
const tempProjectedDarkSunNdc = new THREE.Vector3();
const tempDarkSunPhaseOrigin = new THREE.Vector3();
const tempSunPhaseDirection = new THREE.Vector3();
const tempDarkSunPhaseDirection = new THREE.Vector3();
const tempProjectedTargetWorld = new THREE.Vector3();
const tempDarkSunLocalPosition = new THREE.Vector3();
const tempDarkSunRawOffsetNdc = new THREE.Vector2();
const tempDarkSunDesiredOffsetNdc = new THREE.Vector2();
const tempDarkSunMaskViewport = new THREE.Vector2(1, 1);
const tempSolarEclipseViewport = new THREE.Vector2(1, 1);
const tempSolarEclipseMaskCenterNdc = new THREE.Vector2();
const tempSolarEclipseDirectionNdc = new THREE.Vector2();

function createDarkSunOcclusionMotionState() {
  return {
    initialized: false,
    lastDirection: new THREE.Vector2(1, 0),
    offsetNdc: new THREE.Vector2()
  };
}

const darkSunOcclusionState = {
  observer: createDarkSunOcclusionMotionState(),
  orbit: createDarkSunOcclusionMotionState()
};

function resetDarkSunOcclusionMotion(motionState) {
  motionState.initialized = false;
  motionState.lastDirection.set(1, 0);
  motionState.offsetNdc.set(0, 0);
}

function getWorldBodyRadius(body, baseRadius) {
  body.getWorldScale(tempBodyWorldScale);
  return baseRadius * Math.max(tempBodyWorldScale.x, tempBodyWorldScale.y, tempBodyWorldScale.z);
}

function getProjectedDisc(worldPosition, worldRadius) {
  tempProjectedCenter.copy(worldPosition).project(camera);
  tempProjectedOffset.copy(worldPosition).applyMatrix4(camera.matrixWorldInverse);
  if (!Number.isFinite(tempProjectedCenter.x) || tempProjectedOffset.z >= -0.0001) {
    return {
      centerX: tempProjectedCenter.x,
      centerY: tempProjectedCenter.y,
      radius: 0,
      visible: false
    };
  }

  camera.matrixWorld.extractBasis(tempCameraRight, tempProjectedOffset, tempCameraForward);
  tempCameraRight.normalize();
  tempProjectedEdge.copy(worldPosition)
    .addScaledVector(tempCameraRight, worldRadius)
    .project(camera);

  const radius = Math.hypot(
    tempProjectedEdge.x - tempProjectedCenter.x,
    tempProjectedEdge.y - tempProjectedCenter.y
  );
  const visible = (
    radius > 0.00001 &&
    tempProjectedCenter.z >= -1.1 &&
    tempProjectedCenter.z <= 1.1 &&
    Math.abs(tempProjectedCenter.x) <= 1.25 &&
    Math.abs(tempProjectedCenter.y) <= 1.25
  );

  return {
    centerX: tempProjectedCenter.x,
    centerY: tempProjectedCenter.y,
    radius,
    visible
  };
}

function getExpandedProjectedDisc(disc, marginPx = 0, viewportWidth = 1) {
  if (!disc) {
    return {
      centerX: 0,
      centerY: 0,
      radius: 0,
      visible: false
    };
  }

  const safeViewportWidth = Math.max(viewportWidth, 1);
  const expandedRadius = Math.max(
    0,
    disc.radius + ((Math.max(marginPx, 0) / safeViewportWidth) * 2)
  );

  return {
    centerX: disc.centerX,
    centerY: disc.centerY,
    radius: expandedRadius,
    visible: disc.visible
  };
}

function getSolarEclipseTriggerSunDisc(sunDisc, viewportWidth = 1) {
  const safeViewportWidth = Math.max(viewportWidth, 1);
  const sunRadiusPx = Math.max((sunDisc?.radius ?? 0) * safeViewportWidth * 0.5, 0);
  const triggerMarginPx = Math.max(
    SOLAR_ECLIPSE_TRIGGER_MARGIN_PX,
    sunRadiusPx * SOLAR_ECLIPSE_TRIGGER_MARGIN_FACTOR
  );
  return getExpandedProjectedDisc(sunDisc, triggerMarginPx, safeViewportWidth);
}

function usesSolarEclipsePresentationMask(stageKey = "idle") {
  return ["partialIngress", "partialEgress", "totality"].includes(stageKey);
}

function getCircleOverlapCoverage(radiusA, radiusB, distance) {
  if (radiusA <= 0) {
    return 0;
  }

  return THREE.MathUtils.clamp(
    getCircleOverlapArea(radiusA, radiusB, distance) / (Math.PI * radiusA * radiusA),
    0,
    1
  );
}

function getCircleDistanceForCoverage(radiusA, radiusB, targetCoverage) {
  const normalizedCoverage = THREE.MathUtils.clamp(targetCoverage, 0, 1);
  const fullCoverageDistance = Math.max(radiusB - radiusA, 0);
  const contactDistance = Math.max(radiusA + radiusB, 0);

  if (normalizedCoverage <= 0.000001) {
    return contactDistance;
  }

  if (normalizedCoverage >= 0.999999) {
    return 0;
  }

  const maxFullCoverage = getCircleOverlapCoverage(radiusA, radiusB, fullCoverageDistance);
  if (normalizedCoverage >= (maxFullCoverage - 0.000001)) {
    return fullCoverageDistance;
  }

  let nearDistance = fullCoverageDistance;
  let farDistance = contactDistance;

  for (let iteration = 0; iteration < 28; iteration += 1) {
    const candidateDistance = (nearDistance + farDistance) * 0.5;
    const candidateCoverage = getCircleOverlapCoverage(radiusA, radiusB, candidateDistance);

    if (candidateCoverage >= normalizedCoverage) {
      nearDistance = candidateDistance;
    } else {
      farDistance = candidateDistance;
    }
  }

  return (nearDistance + farDistance) * 0.5;
}

function setGroupWorldPositionFromNdc(group, centerNdc, depthNdc) {
  tempProjectedTargetWorld.set(centerNdc.x, centerNdc.y, depthNdc).unproject(camera);

  if (group.parent) {
    tempDarkSunLocalPosition.copy(tempProjectedTargetWorld);
    group.parent.worldToLocal(tempDarkSunLocalPosition);
    group.position.copy(tempDarkSunLocalPosition);
    return;
  }

  group.position.copy(tempProjectedTargetWorld);
}

function syncDarkSunGroupToPresentationDisc({
  baseScale,
  darkSunBody,
  darkSunGroup,
  targetCenterNdc,
  targetRadius
}) {
  darkSunGroup.scale.copy(baseScale);
  setGroupWorldPositionFromNdc(darkSunGroup, targetCenterNdc, tempProjectedSunNdc.z);
  scene.updateMatrixWorld(true);
  darkSunGroup.getWorldPosition(tempDarkSunWorldPosition);
  const currentDisc = getProjectedDisc(
    tempDarkSunWorldPosition,
    getWorldBodyRadius(darkSunBody, ORBIT_DARK_SUN_SIZE)
  );

  if (currentDisc.visible && currentDisc.radius > 0.00001 && targetRadius > 0.00001) {
    darkSunGroup.scale.copy(baseScale).multiplyScalar(targetRadius / currentDisc.radius);
    scene.updateMatrixWorld(true);
  }
}

function updateSolarEclipsePresentationMaskState(
  solarEclipse,
  sunDisc,
  rawDarkSunDisc
) {
  solarEclipsePresentationMaskState.valid = false;

  if (
    simulationState.darkSunDebugVisible ||
    !solarEclipse ||
    !usesSolarEclipsePresentationMask(solarEclipse.stageKey) ||
    (solarEclipse.coverage ?? 0) <= 0.000001 ||
    !sunDisc?.visible ||
    !rawDarkSunDisc?.visible ||
    sunDisc.radius <= 0.00001 ||
    rawDarkSunDisc.radius <= 0.00001
  ) {
    return solarEclipsePresentationMaskState;
  }

  tempSolarEclipseDirectionNdc.set(
    rawDarkSunDisc.centerX - sunDisc.centerX,
    rawDarkSunDisc.centerY - sunDisc.centerY
  );

  if (tempSolarEclipseDirectionNdc.lengthSq() > 0.0000001) {
    tempSolarEclipseDirectionNdc.normalize();
    solarEclipsePresentationMaskState.lastDirectionNdc.copy(tempSolarEclipseDirectionNdc);
  } else if (solarEclipsePresentationMaskState.lastDirectionNdc.lengthSq() <= 0.0000001) {
    solarEclipsePresentationMaskState.lastDirectionNdc.set(
      solarEclipse.direction === "egress" ? 1 : -1,
      0
    );
  }

  const targetCenterDistance = getCircleDistanceForCoverage(
    sunDisc.radius,
    rawDarkSunDisc.radius,
    solarEclipse.coverage ?? 0
  );

  solarEclipsePresentationMaskState.maskCenterNdc.set(
    sunDisc.centerX + (solarEclipsePresentationMaskState.lastDirectionNdc.x * targetCenterDistance),
    sunDisc.centerY + (solarEclipsePresentationMaskState.lastDirectionNdc.y * targetCenterDistance)
  );
  solarEclipsePresentationMaskState.maskRadius = rawDarkSunDisc.radius;
  solarEclipsePresentationMaskState.valid = true;
  return solarEclipsePresentationMaskState;
}

function updateDarkSunMaskUniforms(solarEclipse = createSolarEclipseState()) {
  const sunGroup = walkerState.enabled ? observerSun : orbitSun;
  const darkSunGroup = walkerState.enabled ? observerDarkSun : orbitDarkSun;
  const sunBody = walkerState.enabled ? observerSunBody : orbitSunBody;
  const darkSunBody = walkerState.enabled ? observerDarkSunBody : orbitDarkSunBody;
  const baseScale = walkerState.enabled
    ? solarEclipsePresentationMaskState.observerBaseScale
    : solarEclipsePresentationMaskState.orbitBaseScale;
  darkSunGroup.scale.copy(baseScale);
  scene.updateMatrixWorld(true);
  sunGroup.getWorldPosition(tempSunWorldPosition);
  darkSunGroup.getWorldPosition(tempDarkSunWorldPosition);
  const sunDisc = getProjectedDisc(
    tempSunWorldPosition,
    getWorldBodyRadius(sunBody, ORBIT_SUN_SIZE)
  );
  const darkSunDisc = getProjectedDisc(
    tempDarkSunWorldPosition,
    getWorldBodyRadius(darkSunBody, ORBIT_DARK_SUN_SIZE)
  );
  tempProjectedSunNdc.copy(tempSunWorldPosition).project(camera);
  renderer.getDrawingBufferSize(tempDarkSunMaskViewport);
  const visibleDarkSunDisc = darkSunDisc;
  const active = (
    sunDisc.visible &&
    sunDisc.radius > 0.00001 &&
    tempDarkSunMaskViewport.x > 0 &&
    tempDarkSunMaskViewport.y > 0
  ) ? 1 : 0;
  const darkSunMaskActive = simulationState.darkSunDebugVisible ? 0 : active;
  const materials = [
    orbitDarkSunBody.material,
    orbitDarkSunRim.material,
    observerDarkSunBody.material,
    observerDarkSunRim.material
  ];

  for (const material of materials) {
    const { darkSunMaskState, darkSunMaskShader } = material.userData;
    if (!darkSunMaskState) {
      continue;
    }

    darkSunMaskState.active = darkSunMaskActive;
    darkSunMaskState.centerNdc.set(sunDisc.centerX, sunDisc.centerY);
    darkSunMaskState.radius = sunDisc.radius;
    darkSunMaskState.viewport.copy(tempDarkSunMaskViewport);

    if (darkSunMaskShader) {
      darkSunMaskShader.uniforms.darkSunMaskActive.value = darkSunMaskState.active;
      darkSunMaskShader.uniforms.darkSunMaskCenterNdc.value.copy(darkSunMaskState.centerNdc);
      darkSunMaskShader.uniforms.darkSunMaskRadius.value = darkSunMaskState.radius;
      darkSunMaskShader.uniforms.darkSunMaskViewport.value.copy(darkSunMaskState.viewport);
    }
  }

  const eclipseMaskActive = (
    visibleDarkSunDisc.visible &&
    visibleDarkSunDisc.radius > 0.00001 &&
    tempDarkSunMaskViewport.x > 0 &&
    tempDarkSunMaskViewport.y > 0
  ) ? 1 : 0;
  const sunMaterials = [
    orbitSunBody.material,
    observerSunBody.material
  ];

  for (const material of sunMaterials) {
    const { sunEclipseMaskState, sunEclipseMaskShader } = material.userData;
    if (!sunEclipseMaskState) {
      continue;
    }

    sunEclipseMaskState.active = eclipseMaskActive;
    sunEclipseMaskState.centerNdc.set(visibleDarkSunDisc.centerX, visibleDarkSunDisc.centerY);
    sunEclipseMaskState.radius = visibleDarkSunDisc.radius;
    sunEclipseMaskState.viewport.copy(tempDarkSunMaskViewport);

    if (sunEclipseMaskShader) {
      sunEclipseMaskShader.uniforms.sunEclipseMaskActive.value = sunEclipseMaskState.active;
      sunEclipseMaskShader.uniforms.sunEclipseMaskCenterNdc.value.copy(sunEclipseMaskState.centerNdc);
      sunEclipseMaskShader.uniforms.sunEclipseMaskRadius.value = sunEclipseMaskState.radius;
      sunEclipseMaskShader.uniforms.sunEclipseMaskViewport.value.copy(sunEclipseMaskState.viewport);
    }
  }
}

function getCircleOverlapArea(radiusA, radiusB, distance) {
  if (distance >= (radiusA + radiusB)) {
    return 0;
  }

  if (distance <= Math.abs(radiusA - radiusB)) {
    const minRadius = Math.min(radiusA, radiusB);
    return Math.PI * minRadius * minRadius;
  }

  const radiusASquared = radiusA * radiusA;
  const radiusBSquared = radiusB * radiusB;
  const alpha = Math.acos(
    THREE.MathUtils.clamp(
      ((distance * distance) + radiusASquared - radiusBSquared) / (2 * distance * radiusA),
      -1,
      1
    )
  );
  const beta = Math.acos(
    THREE.MathUtils.clamp(
      ((distance * distance) + radiusBSquared - radiusASquared) / (2 * distance * radiusB),
      -1,
      1
    )
  );
  const overlapCore = 0.5 * Math.sqrt(
    Math.max(
      0,
      (-distance + radiusA + radiusB) *
      (distance + radiusA - radiusB) *
      (distance - radiusA + radiusB) *
      (distance + radiusA + radiusB)
    )
  );

  return (radiusASquared * alpha) + (radiusBSquared * beta) - overlapCore;
}

function applyDarkSunOcclusionAlignment({
  motionState,
  sunBody,
  sunGroup,
  sunRadius,
  darkSunBody,
  darkSunGroup,
  darkSunRadius
}) {
  sunGroup.getWorldPosition(tempSunWorldPosition);
  darkSunGroup.getWorldPosition(tempDarkSunWorldPosition);
  const sunWorldRadius = getWorldBodyRadius(sunBody, sunRadius);
  const darkSunWorldRadius = getWorldBodyRadius(darkSunBody, darkSunRadius);

  const sunDisc = getProjectedDisc(
    tempSunWorldPosition,
    sunWorldRadius
  );
  const darkSunDisc = getProjectedDisc(
    tempDarkSunWorldPosition,
    darkSunWorldRadius
  );

  if (!sunDisc.visible || !darkSunDisc.visible || sunDisc.radius <= 0.00001 || darkSunDisc.radius <= 0.00001) {
    resetDarkSunOcclusionMotion(motionState);
    return null;
  }

  tempProjectedSunNdc.copy(tempSunWorldPosition).project(camera);
  tempProjectedDarkSunNdc.copy(tempDarkSunWorldPosition).project(camera);
  tempDarkSunRawOffsetNdc.set(
    tempProjectedDarkSunNdc.x - tempProjectedSunNdc.x,
    tempProjectedDarkSunNdc.y - tempProjectedSunNdc.y
  );

  const combinedRadius = sunDisc.radius + darkSunDisc.radius;
  tempDarkSunPhaseOrigin.set(0, 0, 0);
  if (walkerState.enabled) {
    tempDarkSunPhaseOrigin.copy(camera.position);
  }
  tempSunPhaseDirection.copy(tempSunWorldPosition).sub(tempDarkSunPhaseOrigin);
  tempDarkSunPhaseDirection.copy(tempDarkSunWorldPosition).sub(tempDarkSunPhaseOrigin);
  const sunPhaseDistance = Math.max(tempSunPhaseDirection.length(), 0.0001);
  const darkSunPhaseDistance = Math.max(tempDarkSunPhaseDirection.length(), 0.0001);
  tempSunPhaseDirection.y = 0;
  tempDarkSunPhaseDirection.y = 0;
  let targetPhaseOffsetX = tempDarkSunRawOffsetNdc.x;
  const sunPlanarLength = tempSunPhaseDirection.length();
  const darkSunPlanarLength = tempDarkSunPhaseDirection.length();
  if (sunPlanarLength > 0.0001 && darkSunPlanarLength > 0.0001) {
    tempSunPhaseDirection.divideScalar(sunPlanarLength);
    tempDarkSunPhaseDirection.divideScalar(darkSunPlanarLength);
    const signedAngleDelta = Math.atan2(
      (tempSunPhaseDirection.x * tempDarkSunPhaseDirection.z) -
        (tempSunPhaseDirection.z * tempDarkSunPhaseDirection.x),
      (tempSunPhaseDirection.x * tempDarkSunPhaseDirection.x) +
        (tempSunPhaseDirection.z * tempDarkSunPhaseDirection.z)
    );
    const contactAngle = Math.max(
      (sunWorldRadius + darkSunWorldRadius) / Math.max((sunPhaseDistance + darkSunPhaseDistance) * 0.5, 0.0001),
      0.00001
    );
    targetPhaseOffsetX = THREE.MathUtils.clamp(
      signedAngleDelta / contactAngle,
      -4,
      4
    ) * combinedRadius;
  }

  const phaseDistance = Math.abs(targetPhaseOffsetX);
  if (!motionState.initialized) {
    motionState.initialized = true;
    motionState.offsetNdc.set(targetPhaseOffsetX, 0);
  }

  if (phaseDistance > 0.000001) {
    motionState.lastDirection.set(Math.sign(targetPhaseOffsetX) || 1, 0);
  }

  const attractionStart = combinedRadius * DARK_SUN_ATTRACTION_START_FACTOR;
  const attractionEnd = combinedRadius * DARK_SUN_ATTRACTION_END_FACTOR;
  const attraction = THREE.MathUtils.clamp(
    1 - ((phaseDistance - attractionEnd) / Math.max(attractionStart - attractionEnd, 0.000001)),
    0,
    1
  );
  const eclipseTransit = THREE.MathUtils.clamp(
    1 - (phaseDistance / Math.max(combinedRadius, 0.000001)),
    0,
    1
  );
  const centerHold = THREE.MathUtils.clamp(
    1 - (phaseDistance / Math.max(combinedRadius * DARK_SUN_CENTER_HOLD_FACTOR, 0.000001)),
    0,
    1
  );
  const transitCompression = THREE.MathUtils.lerp(
    1,
    DARK_SUN_TRANSIT_ALONG_COMPRESSION,
    Math.max(attraction * 0.72, centerHold * 0.58)
  );
  const captureCompression = THREE.MathUtils.lerp(
    1,
    DARK_SUN_TRANSIT_PERPENDICULAR_COMPRESSION,
    Math.pow(attraction, 0.84)
  );
  const centerCompression = THREE.MathUtils.lerp(1, 0.42, centerHold);
  tempDarkSunDesiredOffsetNdc.set(targetPhaseOffsetX, 0).multiplyScalar(
    transitCompression *
    THREE.MathUtils.lerp(1, DARK_SUN_ECLIPSE_TRANSIT_SLOW_FACTOR, eclipseTransit) *
    captureCompression *
    centerCompression
  );

  const followResponse = attraction > 0.001
    ? (
      THREE.MathUtils.lerp(0.36, 0.18, centerHold) *
      THREE.MathUtils.lerp(1, DARK_SUN_ECLIPSE_RESPONSE_SLOW_FACTOR, eclipseTransit)
    )
    : DARK_SUN_RELEASE_RESPONSE;
  motionState.offsetNdc.lerp(
    tempDarkSunDesiredOffsetNdc,
    followResponse
  );
  motionState.offsetNdc.y = 0;

  if (attraction > 0.9) {
    motionState.offsetNdc.multiplyScalar(
      THREE.MathUtils.lerp(1, DARK_SUN_HOLD_DAMPING, Math.max(centerHold, attraction))
    );
  }

  tempProjectedTargetWorld.set(
    tempProjectedSunNdc.x + motionState.offsetNdc.x,
    tempProjectedSunNdc.y + motionState.offsetNdc.y,
    tempProjectedSunNdc.z
  ).unproject(camera);

  if (darkSunGroup.parent) {
    tempDarkSunLocalPosition.copy(tempProjectedTargetWorld);
    darkSunGroup.parent.worldToLocal(tempDarkSunLocalPosition);
    darkSunGroup.position.copy(tempDarkSunLocalPosition);
  } else {
    darkSunGroup.position.copy(tempProjectedTargetWorld);
  }

  return {
    attraction
  };
}

function applyDarkSunStageTransitPosition({
  sunBody,
  sunGroup,
  sunRadius,
  darkSunBody,
  darkSunGroup,
  darkSunRadius
}) {
  sunGroup.getWorldPosition(tempSunWorldPosition);
  darkSunGroup.getWorldPosition(tempDarkSunWorldPosition);
  const sunWorldRadius = getWorldBodyRadius(sunBody, sunRadius);
  const darkSunWorldRadius = getWorldBodyRadius(darkSunBody, darkSunRadius);
  const sunDisc = getProjectedDisc(
    tempSunWorldPosition,
    sunWorldRadius
  );
  const darkSunDisc = getProjectedDisc(
    tempDarkSunWorldPosition,
    darkSunWorldRadius
  );

  if (!sunDisc.visible || sunDisc.radius <= 0.00001 || darkSunDisc.radius <= 0.00001) {
    return false;
  }

  tempProjectedSunNdc.copy(tempSunWorldPosition).project(camera);
  const transit = THREE.MathUtils.clamp(simulationState.darkSunStageTransit ?? 0, 0, 1);
  const combinedRadius = sunDisc.radius + darkSunDisc.radius;
  renderer.getDrawingBufferSize(tempSolarEclipseViewport);
  const pixelNdcX = 2 / Math.max(tempSolarEclipseViewport.x, 1);
  const approachStartOffsetX = combinedRadius + (pixelNdcX * 6);
  const approachEndOffsetX = combinedRadius + (pixelNdcX * 0.4);
  const egressStartOffsetX = -(combinedRadius + (pixelNdcX * 0.4));
  const completeEndOffsetX = -(combinedRadius + (pixelNdcX * 6));
  const approachEnd = DARK_SUN_STAGE_APPROACH_SHARE;
  const ingressEnd = approachEnd + DARK_SUN_STAGE_INGRESS_SHARE;
  const totalityEnd = ingressEnd + DARK_SUN_STAGE_TOTALITY_SHARE;
  const egressEnd = totalityEnd + DARK_SUN_STAGE_EGRESS_SHARE;
  const easeOutSine = (value) => Math.sin((THREE.MathUtils.clamp(value, 0, 1) * Math.PI) / 2);
  const easeInOutCubic = (value) => {
    const clampedValue = THREE.MathUtils.clamp(value, 0, 1);
    return clampedValue < 0.5
      ? 4 * clampedValue * clampedValue * clampedValue
      : 1 - (Math.pow((-2 * clampedValue) + 2, 3) / 2);
  };
  let targetOffsetX = completeEndOffsetX;

  if (transit <= approachEnd) {
    targetOffsetX = THREE.MathUtils.lerp(
      approachStartOffsetX,
      approachEndOffsetX,
      easeOutSine(transit / Math.max(approachEnd, 0.0001))
    );
  } else if (transit <= ingressEnd) {
    targetOffsetX = THREE.MathUtils.lerp(
      approachEndOffsetX,
      0,
      easeInOutCubic((transit - approachEnd) / Math.max(DARK_SUN_STAGE_INGRESS_SHARE, 0.0001))
    );
  } else if (transit <= totalityEnd) {
    targetOffsetX = 0;
  } else if (transit <= egressEnd) {
    targetOffsetX = THREE.MathUtils.lerp(
      0,
      egressStartOffsetX,
      easeInOutCubic((transit - totalityEnd) / Math.max(DARK_SUN_STAGE_EGRESS_SHARE, 0.0001))
    );
  } else {
    targetOffsetX = THREE.MathUtils.lerp(
      egressStartOffsetX,
      completeEndOffsetX,
      easeOutSine((transit - egressEnd) / Math.max(DARK_SUN_STAGE_COMPLETE_SHARE, 0.0001))
    );
  }

  tempProjectedTargetWorld.set(
    tempProjectedSunNdc.x + targetOffsetX,
    tempProjectedSunNdc.y,
    tempProjectedSunNdc.z
  ).unproject(camera);

  if (darkSunGroup.parent) {
    tempDarkSunLocalPosition.copy(tempProjectedTargetWorld);
    darkSunGroup.parent.worldToLocal(tempDarkSunLocalPosition);
    darkSunGroup.position.copy(tempDarkSunLocalPosition);
  } else {
    darkSunGroup.position.copy(tempProjectedTargetWorld);
  }

  return true;
}

function getSolarEclipseLightScale(solarEclipse = createSolarEclipseState()) {
  return getSolarEclipseVisualProfile(solarEclipse).sunLightScale;
}

function getSolarEclipsePhaseKey(solarEclipse = createSolarEclipseState()) {
  if (solarEclipse.total) {
    return "totality";
  }

  if (solarEclipse.active) {
    return solarEclipse.direction === "egress"
      ? "partialEgress"
      : "partialIngress";
  }

  if (
    solarEclipse.eclipseTier !== SOLAR_ECLIPSE_TIER_NONE &&
    solarEclipse.visibleInView &&
    !solarEclipse.hasVisibleOverlap &&
    Number.isFinite(solarEclipse.normalizedDistance) &&
    solarEclipse.normalizedDistance <= SOLAR_ECLIPSE_APPROACH_DISTANCE_FACTOR
  ) {
    return "approach";
  }

  return "idle";
}

function getSolarEclipseDirection(previousStageKey, coverageDelta) {
  if (coverageDelta > SOLAR_ECLIPSE_DIRECTION_EPSILON) {
    return "ingress";
  }
  if (coverageDelta < -SOLAR_ECLIPSE_DIRECTION_EPSILON) {
    return "egress";
  }

  switch (previousStageKey) {
    case "approach":
    case "partialIngress":
    case "totality":
      return "ingress";
    case "partialEgress":
    case "complete":
      return "egress";
    default:
      return "idle";
  }
}

function getSolarEclipseStageLabelKey(stageKey) {
  switch (stageKey) {
    case "approach":
      return "solarEclipseStageApproach";
    case "partialIngress":
      return "solarEclipseStagePartialIngress";
    case "totality":
      return "solarEclipseStageTotality";
    case "partialEgress":
      return "solarEclipseStagePartialEgress";
    case "complete":
      return "solarEclipseStageComplete";
    default:
      return "solarEclipseStageIdle";
  }
}

function getSolarEclipseStageProgress({
  coverage,
  normalizedDistance,
  stageElapsedMs,
  stageKey
}) {
  switch (stageKey) {
    case "approach":
      return THREE.MathUtils.clamp(
        Math.max(
          stageElapsedMs / Math.max(SOLAR_ECLIPSE_APPROACH_MIN_MS, 1),
          (SOLAR_ECLIPSE_APPROACH_DISTANCE_FACTOR - normalizedDistance) /
            Math.max(SOLAR_ECLIPSE_APPROACH_DISTANCE_FACTOR - 1, 0.0001)
        ),
        0,
        1
      );
    case "partialIngress":
    case "partialEgress":
      return THREE.MathUtils.clamp(
        coverage / Math.max(SOLAR_ECLIPSE_TOTAL_COVERAGE, 0.0001),
        0,
        1
      );
    case "totality":
      return THREE.MathUtils.clamp(
        Math.max(
          stageElapsedMs / Math.max(SOLAR_ECLIPSE_TOTALITY_MIN_MS, 1),
          (coverage - SOLAR_ECLIPSE_TOTAL_COVERAGE) /
            Math.max(1 - SOLAR_ECLIPSE_TOTAL_COVERAGE, 0.0001)
        ),
        0,
        1
      );
    case "complete":
      return THREE.MathUtils.clamp(
        1 - (stageElapsedMs / Math.max(SOLAR_ECLIPSE_COMPLETE_FADE_MS, 1)),
        0,
        1
      );
    default:
      return 0;
  }
}

function stepValueToward(currentValue, targetValue, maxDelta) {
  if (maxDelta <= 0) {
    return currentValue;
  }

  return currentValue + THREE.MathUtils.clamp(
    targetValue - currentValue,
    -maxDelta,
    maxDelta
  );
}

function easeEclipseLightValue(
  currentValue,
  targetValue,
  stageKey,
  {
    riseBlend = 0.12,
    eclipseRiseBlend = 0.035,
    totalityRiseBlend = 0.008,
    fallBlend = 0.18
  } = {}
) {
  const current = Number.isFinite(currentValue) ? currentValue : 0;
  const target = Number.isFinite(targetValue) ? targetValue : 0;
  const blend = target > current
    ? (
      stageKey === "partialEgress"
        ? eclipseRiseBlend
        : stageKey === "totality"
          ? totalityRiseBlend
          : riseBlend
    )
    : fallBlend;

  return current + ((target - current) * THREE.MathUtils.clamp(blend, 0, 1));
}

function getProjectedSolarEclipseMetrics({
  altitudeAligned,
  darkSunDisc,
  sunDisc,
  triggerSunDisc = sunDisc
}) {
  renderer.getDrawingBufferSize(tempSolarEclipseViewport);
  const viewportWidth = Math.max(tempSolarEclipseViewport.x, 1);
  const viewportHeight = Math.max(tempSolarEclipseViewport.y, 1);
  const deltaX = sunDisc.centerX - darkSunDisc.centerX;
  const deltaY = sunDisc.centerY - darkSunDisc.centerY;
  const centerDistance = Math.hypot(deltaX, deltaY);
  const triggerContactDistance = Math.max(triggerSunDisc.radius + darkSunDisc.radius, 0.0001);
  const normalizedDistance = centerDistance / triggerContactDistance;
  const centerDistancePx = Math.hypot(
    deltaX * viewportWidth * 0.5,
    deltaY * viewportHeight * 0.5
  );
  const sunRadiusPx = sunDisc.radius * viewportWidth * 0.5;
  const triggerSunRadiusPx = triggerSunDisc.radius * viewportWidth * 0.5;
  const darkSunRadiusPx = darkSunDisc.radius * viewportWidth * 0.5;
  const contactDistancePx = Math.max(triggerSunRadiusPx + darkSunRadiusPx, 0.0001);
  const contactDepthPx = contactDistancePx - centerDistancePx;
  const visibleContactDistancePx = Math.max(sunRadiusPx + darkSunRadiusPx, 0.0001);
  const visibleContactDepthPx = visibleContactDistancePx - centerDistancePx;
  const overlapArea = altitudeAligned
    ? getCircleOverlapArea(sunDisc.radius, darkSunDisc.radius, centerDistance)
    : 0;
  const coverage = (
    altitudeAligned && sunDisc.radius > 0
      ? THREE.MathUtils.clamp(overlapArea / (Math.PI * sunDisc.radius * sunDisc.radius), 0, 1)
      : 0
  );

  return {
    contactDepthPx,
    coverage,
    normalizedDistance,
    visibleContactDepthPx
  };
}

function getSolarEclipseLaneCount() {
  return Math.max(magneticFieldApi.getCoilOrbitProfile("sun").turns, 1);
}

function getSolarEclipseTierCap(eclipseTier = SOLAR_ECLIPSE_TIER_NONE) {
  switch (eclipseTier) {
    case SOLAR_ECLIPSE_TIER_TOTAL:
      return 1;
    case SOLAR_ECLIPSE_TIER_PARTIAL_2:
      return SOLAR_ECLIPSE_PARTIAL_LANE_2_CAP;
    case SOLAR_ECLIPSE_TIER_PARTIAL_3:
      return SOLAR_ECLIPSE_PARTIAL_LANE_3_CAP;
    default:
      return 0;
  }
}

function getSolarEclipseEligibility(sunRenderState, darkSunRenderState) {
  const sunBandIndex = Number.isFinite(sunRenderState?.bandIndex) ? sunRenderState.bandIndex : null;
  const darkSunBandIndex = Number.isFinite(darkSunRenderState?.bandIndex) ? darkSunRenderState.bandIndex : null;
  const sunLaneIndex = Number.isFinite(sunRenderState?.laneIndex) ? sunRenderState.laneIndex : null;
  const darkSunLaneIndex = Number.isFinite(darkSunRenderState?.laneIndex) ? darkSunRenderState.laneIndex : null;
  const bandDelta = (sunBandIndex === null || darkSunBandIndex === null)
    ? Number.POSITIVE_INFINITY
    : Math.abs(sunBandIndex - darkSunBandIndex);
  const laneDelta = (sunLaneIndex === null || darkSunLaneIndex === null)
    ? Number.POSITIVE_INFINITY
    : Math.abs(sunLaneIndex - darkSunLaneIndex);
  let eclipseTier = SOLAR_ECLIPSE_TIER_NONE;

  if (bandDelta === 0) {
    if (laneDelta <= 1) {
      eclipseTier = SOLAR_ECLIPSE_TIER_TOTAL;
    } else if (laneDelta === 2) {
      eclipseTier = SOLAR_ECLIPSE_TIER_PARTIAL_2;
    } else if (laneDelta === 3) {
      eclipseTier = SOLAR_ECLIPSE_TIER_PARTIAL_3;
    }
  }

  return {
    bandIndex: darkSunBandIndex ?? sunBandIndex ?? 1,
    bandDelta,
    eclipseTier,
    laneCount: getSolarEclipseLaneCount(),
    laneDelta,
    laneIndex: darkSunLaneIndex ?? sunLaneIndex ?? 0,
    tierCap: getSolarEclipseTierCap(eclipseTier)
  };
}

function advanceSolarEclipsePresentation(rawSolarEclipse, deltaSeconds = 0) {
  const deltaMs = Math.max(deltaSeconds, 0) * 1000;
  const coverageStep = SOLAR_ECLIPSE_PRESENTATION_COVERAGE_RATE * Math.max(deltaSeconds, 0);
  let displayCoverage = THREE.MathUtils.clamp(solarEclipseTrackingState.displayCoverage ?? 0, 0, 1);
  let displayStageElapsedMs = (
    solarEclipseTrackingState.displayStageKey === "idle"
      ? 0
      : Math.max(solarEclipseTrackingState.displayStageElapsedMs ?? 0, 0) + deltaMs
  );
  let displayStageKey = solarEclipseTrackingState.displayStageKey ?? "idle";
  let hasEnteredVisibleOverlap = Boolean(solarEclipseTrackingState.hasEnteredVisibleOverlap);

  if (rawSolarEclipse.hasVisibleOverlap) {
    hasEnteredVisibleOverlap = true;
  }

  const setStage = (nextStageKey) => {
    if (displayStageKey !== nextStageKey) {
      displayStageKey = nextStageKey;
      displayStageElapsedMs = 0;
    }
  };

  if (!rawSolarEclipse.visibleInView || rawSolarEclipse.normalizedDistance > SOLAR_ECLIPSE_IDLE_DISTANCE_FACTOR) {
    if (
      hasEnteredVisibleOverlap &&
      !["idle", "complete"].includes(displayStageKey)
    ) {
      setStage("complete");
      displayCoverage = 0;
    } else if (displayStageKey === "complete" && displayStageElapsedMs < SOLAR_ECLIPSE_COMPLETE_FADE_MS) {
      displayCoverage = 0;
    } else {
      setStage("idle");
      displayCoverage = 0;
      hasEnteredVisibleOverlap = false;
    }
  } else {
    switch (displayStageKey) {
      case "idle":
        displayCoverage = 0;
        if (rawSolarEclipse.stageKey === "approach") {
          setStage("approach");
        } else if (
          rawSolarEclipse.hasVisibleOverlap ||
          ["partialIngress", "partialEgress", "totality"].includes(rawSolarEclipse.stageKey)
        ) {
          setStage("approach");
        } else if (rawSolarEclipse.stageKey === "complete" && hasEnteredVisibleOverlap) {
          setStage("complete");
        }
        break;
      case "approach":
        displayCoverage = 0;
        if (rawSolarEclipse.stageKey === "idle") {
          setStage("idle");
          hasEnteredVisibleOverlap = false;
        } else if (
          rawSolarEclipse.hasVisibleOverlap &&
          displayStageElapsedMs >= SOLAR_ECLIPSE_APPROACH_MIN_MS
        ) {
          setStage("partialIngress");
        }
        break;
      case "partialIngress":
        displayCoverage = stepValueToward(
          displayCoverage,
          Math.max(rawSolarEclipse.rawCoverage, displayCoverage),
          coverageStep
        );
        if (!rawSolarEclipse.hasVisibleOverlap && hasEnteredVisibleOverlap) {
          if (displayStageElapsedMs >= SOLAR_ECLIPSE_PARTIAL_STAGE_MIN_MS) {
            setStage("partialEgress");
          }
        } else if (
          rawSolarEclipse.stageKey === "partialEgress" &&
          rawSolarEclipse.rawCoverage <= displayCoverage &&
          displayStageElapsedMs >= SOLAR_ECLIPSE_PARTIAL_STAGE_MIN_MS
        ) {
          setStage("partialEgress");
        } else if (
          rawSolarEclipse.stageKey === "totality" &&
          displayCoverage >= (SOLAR_ECLIPSE_TOTAL_COVERAGE - 0.01) &&
          displayStageElapsedMs >= SOLAR_ECLIPSE_PARTIAL_STAGE_MIN_MS
        ) {
          setStage("totality");
        }
        break;
      case "totality":
        displayCoverage = stepValueToward(
          displayCoverage,
          Math.max(rawSolarEclipse.rawCoverage, SOLAR_ECLIPSE_TOTAL_COVERAGE),
          Math.max(coverageStep, 0.015)
        );
        if (
          displayStageElapsedMs >= SOLAR_ECLIPSE_TOTALITY_MIN_MS &&
          ["partialEgress", "complete", "idle"].includes(rawSolarEclipse.stageKey)
        ) {
          setStage("partialEgress");
        }
        break;
      case "partialEgress":
        displayCoverage = stepValueToward(
          displayCoverage,
          rawSolarEclipse.rawCoverage,
          coverageStep
        );
        if (
          rawSolarEclipse.stageKey === "partialIngress" &&
          rawSolarEclipse.rawCoverage > (displayCoverage + 0.001)
        ) {
          setStage("partialIngress");
        } else if (
          !rawSolarEclipse.hasVisibleOverlap &&
          displayCoverage <= 0.0005 &&
          displayStageElapsedMs >= SOLAR_ECLIPSE_PARTIAL_STAGE_MIN_MS
        ) {
          setStage("complete");
        }
        break;
      case "complete":
        displayCoverage = 0;
        if (displayStageElapsedMs >= SOLAR_ECLIPSE_COMPLETE_FADE_MS) {
          setStage("idle");
          hasEnteredVisibleOverlap = false;
        }
        break;
      default:
        setStage("idle");
        displayCoverage = 0;
        hasEnteredVisibleOverlap = false;
        break;
    }
  }

  if (displayStageKey === "idle") {
    displayCoverage = 0;
    displayStageElapsedMs = 0;
  }

  solarEclipseTrackingState.displayCoverage = displayCoverage;
  solarEclipseTrackingState.displayStageElapsedMs = displayStageElapsedMs;
  solarEclipseTrackingState.displayStageKey = displayStageKey;
  solarEclipseTrackingState.hasEnteredVisibleOverlap = hasEnteredVisibleOverlap;

  const stageProgress = getSolarEclipseStageProgress({
    coverage: displayCoverage,
    normalizedDistance: rawSolarEclipse.normalizedDistance,
    stageElapsedMs: displayStageElapsedMs,
    stageKey: displayStageKey
  });
  const total = displayStageKey === "totality";
  const active = ["partialIngress", "partialEgress", "totality"].includes(displayStageKey);
  const lightReduction = active
    ? THREE.MathUtils.clamp(
      total ? Math.max(displayCoverage, 0.82) : displayCoverage,
      0,
      1
    )
    : 0;
  const presentationSolarEclipse = createSolarEclipseState({
    active,
    total,
    bandDelta: rawSolarEclipse.bandDelta,
    bandIndex: rawSolarEclipse.bandIndex,
    coverage: displayCoverage,
    eclipseTier: rawSolarEclipse.eclipseTier,
    rawCoverage: rawSolarEclipse.rawCoverage,
    direction: rawSolarEclipse.direction,
    hasContact: rawSolarEclipse.hasContact,
    hasVisibleOverlap: rawSolarEclipse.hasVisibleOverlap,
    contactDepthPx: rawSolarEclipse.contactDepthPx,
    laneDelta: rawSolarEclipse.laneDelta,
    laneIndex: rawSolarEclipse.laneIndex,
    lightReduction,
    normalizedDistance: rawSolarEclipse.normalizedDistance,
    projectionCoverage: rawSolarEclipse.projectionCoverage,
    recentlyActive: displayStageKey !== "idle",
    rawStageKey: rawSolarEclipse.stageKey,
    stageKey: displayStageKey,
    stageLabelKey: getSolarEclipseStageLabelKey(displayStageKey),
    stageProgress,
    visibleInView: rawSolarEclipse.visibleInView
  });
  const sunlightScale = THREE.MathUtils.clamp(
    getSolarEclipseVisualProfile(presentationSolarEclipse).sunLightScale ?? 1,
    0,
    1
  );

  return createSolarEclipseState({
    ...presentationSolarEclipse,
    sunlightScale,
    sunlightPercent: Math.round(sunlightScale * 100)
  });
}

function getSolarEclipseVisualProfile(solarEclipse = createSolarEclipseState()) {
  const phaseKey = getSolarEclipsePhaseKey(solarEclipse);
  const coverage = THREE.MathUtils.clamp(solarEclipse.coverage ?? 0, 0, 1);
  const partialStrength = THREE.MathUtils.clamp(
    coverage / Math.max(SOLAR_ECLIPSE_TOTAL_COVERAGE, 0.0001),
    0,
    1
  );
  const partialVisualStrength = partialStrength;
  const profile = {
    aureoleOpacityScale: 1,
    aureoleScaleFactor: 1,
    coronaOpacityScale: 1,
    coronaScaleFactor: 1,
    darkSunBodyOpacity: 0,
    darkSunRimOpacity: 0,
    environmentLightScale: 1,
    pulseSuppression: 0,
    sunBodyScale: 1,
    sunEclipseMaskStrength: 0,
    sunHaloScale: 1,
    sunLightScale: 1,
    sunRayScale: 1
  };

  if (phaseKey === "partialIngress") {
    profile.darkSunBodyOpacity = ORBIT_DARK_SUN_OCCLUSION_OPACITY;
    profile.darkSunRimOpacity = THREE.MathUtils.lerp(
      ORBIT_DARK_SUN_RIM_OPACITY * 0.9,
      ORBIT_DARK_SUN_RIM_OPACITY * 0.32,
      partialVisualStrength
    );
    profile.environmentLightScale = THREE.MathUtils.lerp(0.72, 0.42, partialVisualStrength);
    profile.pulseSuppression = THREE.MathUtils.lerp(0.45, 0.96, partialVisualStrength);
    profile.sunBodyScale = 1;
    profile.sunEclipseMaskStrength = 1;
    profile.sunHaloScale = THREE.MathUtils.lerp(0.08, 0.004, partialVisualStrength);
    profile.sunLightScale = THREE.MathUtils.lerp(0.24, 0.025, partialVisualStrength);
    profile.coronaOpacityScale = THREE.MathUtils.lerp(0.34, 1.1, partialVisualStrength);
    profile.aureoleOpacityScale = THREE.MathUtils.lerp(0.12, 0.48, partialVisualStrength);
    profile.coronaScaleFactor = THREE.MathUtils.lerp(0.98, 1.08, partialVisualStrength);
    profile.aureoleScaleFactor = THREE.MathUtils.lerp(0.92, 1.02, partialVisualStrength);
    profile.sunRayScale = THREE.MathUtils.lerp(0.06, 0, partialVisualStrength);
    return profile;
  }

  if (phaseKey === "partialEgress") {
    const recoveryProgress = THREE.MathUtils.clamp(1 - partialStrength, 0, 1);
    const environmentRecoveryStrength = Math.pow(recoveryProgress, 1.9);
    const recoveryStrength = Math.pow(recoveryProgress, 3.4);
    const lateRecoveryStrength = Math.pow(recoveryProgress, 4.1);
    profile.darkSunBodyOpacity = ORBIT_DARK_SUN_OCCLUSION_OPACITY;
    profile.darkSunRimOpacity = THREE.MathUtils.lerp(
      ORBIT_DARK_SUN_RIM_OPACITY * 0.06,
      ORBIT_DARK_SUN_RIM_OPACITY * 0.9,
      recoveryStrength
    );
    profile.environmentLightScale = THREE.MathUtils.lerp(0.26, 1, environmentRecoveryStrength);
    profile.pulseSuppression = THREE.MathUtils.lerp(1, 0, Math.pow(recoveryProgress, 2.25));
    profile.sunBodyScale = 1;
    profile.sunEclipseMaskStrength = 1;
    profile.sunHaloScale = THREE.MathUtils.lerp(0.003, 0.92, lateRecoveryStrength);
    profile.sunLightScale = THREE.MathUtils.lerp(0.012, 1, Math.pow(recoveryProgress, 2.95));
    profile.coronaOpacityScale = THREE.MathUtils.lerp(1.1, 0.4, Math.pow(recoveryProgress, 2.2));
    profile.aureoleOpacityScale = THREE.MathUtils.lerp(0.48, 0.18, Math.pow(recoveryProgress, 2.4));
    profile.coronaScaleFactor = THREE.MathUtils.lerp(1.08, 1, Math.pow(recoveryProgress, 2.4));
    profile.aureoleScaleFactor = THREE.MathUtils.lerp(1.02, 0.94, Math.pow(recoveryProgress, 2.6));
    profile.sunRayScale = THREE.MathUtils.lerp(0, 0.14, Math.pow(recoveryProgress, 4.5));
    return profile;
  }

  if (phaseKey === "totality") {
    profile.darkSunBodyOpacity = ORBIT_DARK_SUN_OCCLUSION_OPACITY;
    profile.darkSunRimOpacity = ORBIT_DARK_SUN_RIM_OPACITY * 0.08;
    profile.environmentLightScale = 0.26;
    profile.pulseSuppression = 1;
    profile.sunBodyScale = 1;
    profile.sunEclipseMaskStrength = 1;
    profile.sunHaloScale = 0.003;
    profile.sunLightScale = 0.012;
    profile.coronaOpacityScale = 1.32;
    profile.aureoleOpacityScale = 0.76;
    profile.coronaScaleFactor = 1.08;
    profile.aureoleScaleFactor = 1.02;
    profile.sunRayScale = 0;
    return profile;
  }

  return profile;
}

function syncDarkSunPresentation(solarEclipse = createSolarEclipseState()) {
  const visualProfile = getSolarEclipseVisualProfile(solarEclipse);
  const debugVisible = Boolean(simulationState.darkSunDebugVisible);
  const eclipseVisible = Boolean(
    solarEclipse.visibleInView &&
    solarEclipse.active
  );
  const showDarkSun = debugVisible || eclipseVisible;
  const bodyOpacity = debugVisible
    ? ORBIT_DARK_SUN_DEBUG_OPACITY
    : (eclipseVisible ? visualProfile.darkSunBodyOpacity : 0);
  const rimOpacity = debugVisible
    ? ORBIT_DARK_SUN_DEBUG_RIM_OPACITY
    : (eclipseVisible ? visualProfile.darkSunRimOpacity : 0);

  orbitDarkSun.visible = !walkerState.enabled && showDarkSun;
  observerDarkSun.visible = walkerState.enabled && showDarkSun;
  orbitDarkSunBody.material.color.setHex(debugVisible ? ORBIT_DARK_SUN_DEBUG_COLOR : ORBIT_DARK_SUN_BODY_COLOR);
  observerDarkSunBody.material.color.setHex(debugVisible ? ORBIT_DARK_SUN_DEBUG_COLOR : ORBIT_DARK_SUN_BODY_COLOR);
  orbitDarkSunRim.material.color.setHex(debugVisible ? ORBIT_DARK_SUN_DEBUG_RIM_COLOR : ORBIT_DARK_SUN_RIM_COLOR);
  observerDarkSunRim.material.color.setHex(debugVisible ? ORBIT_DARK_SUN_DEBUG_RIM_COLOR : ORBIT_DARK_SUN_RIM_COLOR);
  orbitDarkSunBody.material.opacity = bodyOpacity;
  observerDarkSunBody.material.opacity = bodyOpacity;
  orbitDarkSunRim.material.opacity = rimOpacity;
  observerDarkSunRim.material.opacity = rimOpacity;

  const eclipseMaskStrength = (
    !debugVisible &&
    solarEclipse.visibleInView &&
    solarEclipse.active
  ) ? 1 : 0;
  const sunMaterials = [
    orbitSunBody.material,
    observerSunBody.material
  ];

  for (const material of sunMaterials) {
    const { sunEclipseMaskState, sunEclipseMaskShader } = material.userData;
    if (!sunEclipseMaskState) {
      continue;
    }

    sunEclipseMaskState.strength = eclipseMaskStrength;

    if (sunEclipseMaskShader) {
      sunEclipseMaskShader.uniforms.sunEclipseMaskStrength.value = sunEclipseMaskState.strength;
    }
  }
}

function evaluateSolarEclipse(snapshot, deltaSeconds = 0) {
  if (!snapshot) {
    return createSolarEclipseState();
  }

  const sunGroup = walkerState.enabled ? observerSun : orbitSun;
  const darkSunGroup = walkerState.enabled ? observerDarkSun : orbitDarkSun;
  const sunBody = walkerState.enabled ? observerSunBody : orbitSunBody;
  const darkSunBody = walkerState.enabled ? observerDarkSunBody : orbitDarkSunBody;
  const sunSceneVisible = walkerState.enabled ? observerSun.visible : true;
  const sunRenderState = snapshot.sunRenderState ?? null;
  const darkSunRenderState = snapshot.darkSunRenderState ?? null;

  sunGroup.getWorldPosition(tempSunWorldPosition);
  darkSunGroup.getWorldPosition(tempDarkSunWorldPosition);

  const sunDisc = getProjectedDisc(
    tempSunWorldPosition,
    getWorldBodyRadius(sunBody, ORBIT_SUN_SIZE)
  );
  const darkSunDisc = getProjectedDisc(
    tempDarkSunWorldPosition,
    getWorldBodyRadius(darkSunBody, ORBIT_DARK_SUN_SIZE)
  );
  renderer.getDrawingBufferSize(tempSolarEclipseViewport);
  const triggerSunDisc = getSolarEclipseTriggerSunDisc(
    sunDisc,
    Math.max(tempSolarEclipseViewport.x, 1)
  );
  const visibleInView = sunSceneVisible && sunDisc.visible && darkSunDisc.visible;
  const altitudeDelta = Math.abs(sunDisc.centerY - darkSunDisc.centerY);
  const altitudeTolerance = Math.max(
    0.0005,
    triggerSunDisc.radius * DARK_SUN_ALTITUDE_ALIGNMENT_TOLERANCE_FACTOR
  );
  const altitudeAligned = visibleInView && altitudeDelta <= altitudeTolerance;
  const eligibility = getSolarEclipseEligibility(sunRenderState, darkSunRenderState);
  const eligibleForEclipse = eligibility.eclipseTier !== SOLAR_ECLIPSE_TIER_NONE;
  const approachAligned = eligibleForEclipse && visibleInView && altitudeDelta <= (altitudeTolerance * 1.75);
  const eclipseMetrics = getProjectedSolarEclipseMetrics({
    altitudeAligned,
    darkSunDisc,
    sunDisc,
    triggerSunDisc
  });
  const projectionCoverage = eclipseMetrics.coverage;
  const effectiveCoverage = eligibleForEclipse
    ? Math.min(projectionCoverage, eligibility.tierCap)
    : 0;
  const { contactDepthPx, normalizedDistance, visibleContactDepthPx } = eclipseMetrics;
  const coverageDelta = effectiveCoverage - solarEclipseTrackingState.previousCoverage;
  const previousStageKey = solarEclipseTrackingState.previousStageKey;
  const direction = getSolarEclipseDirection(previousStageKey, coverageDelta);
  const hasContact = (
    eligibleForEclipse &&
    altitudeAligned &&
    visibleInView &&
    contactDepthPx >= SOLAR_ECLIPSE_CONTACT_START_PX
  );
  const hasVisibleOverlap = (
    eligibleForEclipse &&
    altitudeAligned &&
    visibleContactDepthPx >= SOLAR_ECLIPSE_VISIBLE_CONTACT_PX &&
    effectiveCoverage >= SOLAR_ECLIPSE_MIN_COVERAGE
  );
  const active = hasVisibleOverlap;
  const total = (
    active &&
    eligibility.eclipseTier === SOLAR_ECLIPSE_TIER_TOTAL &&
    effectiveCoverage >= SOLAR_ECLIPSE_TOTAL_COVERAGE &&
    darkSunDisc.radius >= sunDisc.radius
  );
  let rawStageKey = "idle";

  if (!visibleInView || normalizedDistance > SOLAR_ECLIPSE_IDLE_DISTANCE_FACTOR) {
  } else if (total) {
    rawStageKey = "totality";
  } else if (active) {
    rawStageKey = direction === "egress" ? "partialEgress" : "partialIngress";
  } else if (
    approachAligned &&
    !hasVisibleOverlap &&
    normalizedDistance <= SOLAR_ECLIPSE_APPROACH_DISTANCE_FACTOR
  ) {
    rawStageKey = "approach";
  }

  const sunlightScale = THREE.MathUtils.clamp(
    getSolarEclipseVisualProfile({
      active,
      coverage: effectiveCoverage,
      direction,
      eclipseTier: eligibility.eclipseTier,
      hasVisibleOverlap,
      normalizedDistance,
      total,
      visibleInView
    }).sunLightScale ?? 1,
    0,
    1
  );
  const rawSolarEclipse = createSolarEclipseState({
    active,
    total,
    bandDelta: eligibility.bandDelta,
    bandIndex: eligibility.bandIndex,
    coverage: effectiveCoverage,
    eclipseTier: eligibility.eclipseTier,
    projectionCoverage,
    rawCoverage: effectiveCoverage,
    direction,
    hasContact,
    hasVisibleOverlap,
    contactDepthPx,
    laneDelta: eligibility.laneDelta,
    laneIndex: eligibility.laneIndex,
    lightReduction: THREE.MathUtils.clamp(1 - sunlightScale, 0, 1),
    normalizedDistance,
    rawStageKey,
    stageKey: rawStageKey,
    stageLabelKey: getSolarEclipseStageLabelKey(rawStageKey),
    stageProgress: active ? effectiveCoverage : 0,
    sunlightScale,
    sunlightPercent: Math.round(sunlightScale * 100),
    visibleInView,
    recentlyActive: rawStageKey !== "idle"
  });
  if (simulationState.darkSunStageAltitudeLock) {
    if (active) {
      simulationState.darkSunStageHasEclipsed = true;
    } else if (
      simulationState.darkSunStageHasEclipsed &&
      normalizedDistance > SOLAR_ECLIPSE_IDLE_DISTANCE_FACTOR
    ) {
      simulationState.darkSunStageAltitudeLock = false;
      simulationState.darkSunStageHasEclipsed = false;
    }
  }
  snapshot.solarEclipse = rawSolarEclipse;
  solarEclipseTrackingState.previousCoverage = effectiveCoverage;
  solarEclipseTrackingState.previousStageKey = rawStageKey;
  astronomyApi.syncSolarEclipseUi(snapshot.solarEclipse);
  syncDarkSunPresentation(snapshot.solarEclipse);
  return snapshot.solarEclipse;
}

function getProjectedSolarEclipseMetricsFromStates(
  sunRenderState,
  darkSunRenderState,
  {
    trackCandidateSun = false
  } = {}
) {
  const previousSunPosition = orbitSun.position.clone();
  const previousDarkSunPosition = orbitDarkSun.position.clone();

  orbitSun.position.copy(sunRenderState.position);
  orbitDarkSun.position.copy(darkSunRenderState.position);
  scene.updateMatrixWorld(true);
  if (trackCandidateSun) {
    celestialTrackingCameraApi.update();
    cameraApi.updateCamera();
  }
  orbitSun.getWorldPosition(tempSunWorldPosition);
  orbitDarkSun.getWorldPosition(tempDarkSunWorldPosition);

  const sunDisc = getProjectedDisc(
    tempSunWorldPosition,
    getWorldBodyRadius(orbitSunBody, ORBIT_SUN_SIZE)
  );
  const darkSunDisc = getProjectedDisc(
    tempDarkSunWorldPosition,
    getWorldBodyRadius(orbitDarkSunBody, ORBIT_DARK_SUN_SIZE)
  );
  renderer.getDrawingBufferSize(tempSolarEclipseViewport);
  const triggerSunDisc = getSolarEclipseTriggerSunDisc(
    sunDisc,
    Math.max(tempSolarEclipseViewport.x, 1)
  );
  const visibleInView = sunDisc.visible && darkSunDisc.visible;
  const altitudeDelta = Math.abs(sunDisc.centerY - darkSunDisc.centerY);
  const altitudeTolerance = Math.max(
    0.0005,
    triggerSunDisc.radius * DARK_SUN_ALTITUDE_ALIGNMENT_TOLERANCE_FACTOR
  );
  const altitudeAligned = visibleInView && altitudeDelta <= altitudeTolerance;
  const eligibility = getSolarEclipseEligibility(sunRenderState, darkSunRenderState);
  const metrics = getProjectedSolarEclipseMetrics({
    altitudeAligned,
    darkSunDisc,
    sunDisc,
    triggerSunDisc
  });
  const effectiveCoverage = eligibility.eclipseTier === SOLAR_ECLIPSE_TIER_NONE
    ? 0
    : Math.min(metrics.coverage, eligibility.tierCap);
  const eligibleForEclipse = eligibility.eclipseTier !== SOLAR_ECLIPSE_TIER_NONE;
  const approachAligned = eligibleForEclipse && visibleInView && altitudeDelta <= (altitudeTolerance * 1.75);
  const hasContact = (
    eligibleForEclipse &&
    altitudeAligned &&
    visibleInView &&
    metrics.contactDepthPx >= SOLAR_ECLIPSE_CONTACT_START_PX
  );
  const hasApproachWindow = (
    approachAligned &&
    !hasContact &&
    metrics.normalizedDistance <= SOLAR_ECLIPSE_APPROACH_DISTANCE_FACTOR
  );

  orbitSun.position.copy(previousSunPosition);
  orbitDarkSun.position.copy(previousDarkSunPosition);
  scene.updateMatrixWorld(true);
  if (trackCandidateSun) {
    celestialTrackingCameraApi.update();
    cameraApi.updateCamera();
  }
  return {
    approachAligned,
    contactDepthPx: metrics.contactDepthPx,
    coverage: effectiveCoverage,
    eclipseTier: eligibility.eclipseTier,
    hasApproachWindow,
    hasContact,
    hasVisibleOverlap: (
      eligibleForEclipse &&
      altitudeAligned &&
      metrics.visibleContactDepthPx >= SOLAR_ECLIPSE_VISIBLE_CONTACT_PX &&
      effectiveCoverage >= SOLAR_ECLIPSE_MIN_COVERAGE
    ),
    laneDelta: eligibility.laneDelta,
    normalizedDistance: metrics.normalizedDistance,
    projectionCoverage: metrics.coverage,
    tierCap: eligibility.tierCap,
    visibleInView
  };
}

function getNaturalPreEclipseCandidateScore(eclipseMetrics) {
  if (!eclipseMetrics) {
    return Number.POSITIVE_INFINITY;
  }

  if (eclipseMetrics.hasApproachWindow) {
    return Math.abs(
      (eclipseMetrics.normalizedDistance ?? SOLAR_ECLIPSE_APPROACH_DISTANCE_FACTOR) -
      DARK_SUN_STAGE_PRE_ECLIPSE_DISTANCE_FACTOR
    );
  }

  const preContactPenalty = eclipseMetrics.hasVisibleOverlap ? 2 : (eclipseMetrics.hasContact ? 1 : 0);
  return (preContactPenalty * 1000) + Math.abs(SOLAR_ECLIPSE_VISIBLE_CONTACT_PX - eclipseMetrics.contactDepthPx);
}

function getWrappedAngularDistance(angleA = 0, angleB = 0) {
  return Math.abs(Math.atan2(
    Math.sin(angleA - angleB),
    Math.cos(angleA - angleB)
  ));
}

function getNaturalPreEclipseOrbitAlignmentScore(sunRenderState, darkSunRenderState) {
  return getWrappedAngularDistance(
    darkSunRenderState?.orbitAngleRadians ?? 0,
    sunRenderState?.orbitAngleRadians ?? 0
  );
}

function getAdvancedBandState(progress, direction, step) {
  const nextState = {
    direction: direction ?? 1,
    progress: progress ?? 0.5
  };
  let nextProgress = nextState.progress + (step * nextState.direction);

  if (nextProgress >= 1) {
    nextProgress = 1;
    nextState.direction = -1;
  } else if (nextProgress <= 0) {
    nextProgress = 0;
    nextState.direction = 1;
  }

  nextState.progress = nextProgress;
  return nextState;
}

function inferStageSunBandDirection(sourceDate, currentSunRenderState) {
  if (!astronomyState.enabled || !sourceDate || !astronomyApi) {
    return simulationState.sunBandDirection ?? 1;
  }

  const sampleSnapshot = astronomyApi.getAstronomySnapshot(
    new Date(sourceDate.getTime() + (12 * 60 * 60 * 1000))
  );
  const currentProgress = currentSunRenderState?.corridorProgress ?? currentSunRenderState?.macroProgress ?? 0.5;
  const sampleProgress = sampleSnapshot?.sunRenderState?.corridorProgress ?? currentProgress;

  if (Math.abs(sampleProgress - currentProgress) <= 0.0001) {
    return 1;
  }

  return sampleProgress >= currentProgress ? 1 : -1;
}

function findNaturalPreEclipseState({
  phaseOffsetRadians,
  sunAngleRadians,
  sunDirection,
  sunProgress
}) {
  const bandStep = getBodyBandProgressStep("sun");
  const tierPriority = [
    SOLAR_ECLIPSE_TIER_TOTAL,
    SOLAR_ECLIPSE_TIER_PARTIAL_2,
    SOLAR_ECLIPSE_TIER_PARTIAL_3
  ];

  for (const desiredTier of tierPriority) {
    let searchSunAngle = sunAngleRadians;
    let searchSunDirection = sunDirection;
    let searchSunProgress = sunProgress;
    let bestApproachCandidate = null;
    let bestPreContact = null;
    let bestTierCandidate = null;

    for (let frameIndex = 1; frameIndex <= STAGE_PRE_ECLIPSE_SEARCH_MAX_FRAMES; frameIndex += 1) {
      searchSunAngle += ORBIT_SUN_SPEED;
      const nextBandState = getAdvancedBandState(searchSunProgress, searchSunDirection, bandStep);
      searchSunProgress = nextBandState.progress;
      searchSunDirection = nextBandState.direction;

      const nextSunRenderState = astronomyApi.getSunRenderState({
        orbitAngleRadians: searchSunAngle,
        orbitMode: "auto",
        progress: searchSunProgress,
        source: "demo"
      });
      const nextDarkSunRenderState = astronomyApi.getDarkSunRenderState({
        orbitMode: "auto",
        phaseOffsetRadians,
        source: "demo",
        sunDirection: searchSunDirection,
        sunOrbitAngleRadians: searchSunAngle,
        sunProgress: searchSunProgress
      });
      const eclipseMetrics = getProjectedSolarEclipseMetricsFromStates(
        nextSunRenderState,
        nextDarkSunRenderState
      );

      if (eclipseMetrics.eclipseTier !== desiredTier || !eclipseMetrics.visibleInView) {
        if (eclipseMetrics.eclipseTier === desiredTier) {
          const score = getNaturalPreEclipseOrbitAlignmentScore(
            nextSunRenderState,
            nextDarkSunRenderState
          );
          if (!bestTierCandidate || score < bestTierCandidate.score) {
            bestTierCandidate = {
              darkSunRenderState: nextDarkSunRenderState,
              eclipseMetrics,
              score,
              sunAngleRadians: searchSunAngle,
              sunDirection: searchSunDirection,
              sunProgress: searchSunProgress,
              sunRenderState: nextSunRenderState
            };
          }
        }
        continue;
      }

      if (eclipseMetrics.hasApproachWindow) {
        const score = getNaturalPreEclipseCandidateScore(eclipseMetrics);
        if (!bestApproachCandidate || score < bestApproachCandidate.score) {
          bestApproachCandidate = {
            darkSunRenderState: nextDarkSunRenderState,
            eclipseMetrics,
            score,
            sunAngleRadians: searchSunAngle,
            sunDirection: searchSunDirection,
            sunProgress: searchSunProgress,
            sunRenderState: nextSunRenderState
          };
        }
        continue;
      }

      if (!eclipseMetrics.hasVisibleOverlap) {
        const score = getNaturalPreEclipseCandidateScore(eclipseMetrics);
        if (!bestPreContact || score < bestPreContact.score) {
          bestPreContact = {
            darkSunRenderState: nextDarkSunRenderState,
            eclipseMetrics,
            score,
            sunAngleRadians: searchSunAngle,
            sunDirection: searchSunDirection,
            sunProgress: searchSunProgress,
            sunRenderState: nextSunRenderState
          };
        }
        continue;
      }

      if (bestApproachCandidate) {
        return bestApproachCandidate;
      }

      if (bestPreContact) {
        return bestPreContact;
      }

      return {
        darkSunRenderState: nextDarkSunRenderState,
        eclipseMetrics,
        score: 0,
        sunAngleRadians: searchSunAngle,
        sunDirection: searchSunDirection,
        sunProgress: searchSunProgress,
        sunRenderState: nextSunRenderState
      };
    }

    if (bestApproachCandidate) {
      return bestApproachCandidate;
    }

    if (bestPreContact) {
      return bestPreContact;
    }

    if (bestTierCandidate) {
      return bestTierCandidate;
    }
  }

  return null;
}

function findNaturalPreEclipseAngleState({
  eclipseTier,
  phaseOffsetRadians,
  seedSunAngleRadians,
  sunDirection,
  sunProgress
}) {
  const bandStep = getBodyBandProgressStep("sun");
  let bestApproachCandidate = null;
  let bestPreContactCandidate = null;
  let candidateSunAngle = seedSunAngleRadians;
  let candidateSunDirection = sunDirection;
  let candidateSunProgress = sunProgress;

  for (let frameIndex = 0; frameIndex <= STAGE_PRE_ECLIPSE_REFINEMENT_FRAMES; frameIndex += 1) {
    if (frameIndex > 0) {
      candidateSunAngle += ORBIT_SUN_SPEED;
      const nextBandState = getAdvancedBandState(candidateSunProgress, candidateSunDirection, bandStep);
      candidateSunProgress = nextBandState.progress;
      candidateSunDirection = nextBandState.direction;
    }

    const candidateSunRenderState = astronomyApi.getSunRenderState({
      orbitAngleRadians: candidateSunAngle,
      orbitMode: "auto",
      progress: candidateSunProgress,
      source: "demo"
    });
    const candidateDarkSunRenderState = astronomyApi.getDarkSunRenderState({
      orbitMode: "auto",
      phaseOffsetRadians,
      source: "demo",
      sunDirection: candidateSunDirection,
      sunOrbitAngleRadians: candidateSunAngle,
      sunProgress: candidateSunProgress
    });
    const eclipseMetrics = getProjectedSolarEclipseMetricsFromStates(
      candidateSunRenderState,
      candidateDarkSunRenderState,
      {
        trackCandidateSun: true
      }
    );

    if (eclipseMetrics.eclipseTier !== eclipseTier || !eclipseMetrics.visibleInView) {
      continue;
    }

    if (eclipseMetrics.hasApproachWindow) {
      const score = getNaturalPreEclipseCandidateScore(eclipseMetrics);
      if (!bestApproachCandidate || score < bestApproachCandidate.score) {
        bestApproachCandidate = {
          darkSunRenderState: candidateDarkSunRenderState,
          eclipseMetrics,
          score,
          sunAngleRadians: candidateSunAngle,
          sunDirection: candidateSunDirection,
          sunProgress: candidateSunProgress,
          sunRenderState: candidateSunRenderState
        };
      }
      continue;
    }

    if (!eclipseMetrics.hasVisibleOverlap) {
      const score = getNaturalPreEclipseCandidateScore(eclipseMetrics);
      if (!bestPreContactCandidate || score < bestPreContactCandidate.score) {
        bestPreContactCandidate = {
          darkSunRenderState: candidateDarkSunRenderState,
          eclipseMetrics,
          score,
          sunAngleRadians: candidateSunAngle,
          sunDirection: candidateSunDirection,
          sunProgress: candidateSunProgress,
          sunRenderState: candidateSunRenderState
        };
      }
      continue;
    }

    if (bestApproachCandidate) {
      return bestApproachCandidate;
    }

    if (bestPreContactCandidate) {
      return bestPreContactCandidate;
    }

    return {
      darkSunRenderState: candidateDarkSunRenderState,
      eclipseMetrics,
      score: 0,
      sunAngleRadians: candidateSunAngle,
      sunDirection: candidateSunDirection,
      sunProgress: candidateSunProgress,
      sunRenderState: candidateSunRenderState
    };
  }

  if (bestApproachCandidate) {
    return bestApproachCandidate;
  }

  if (bestPreContactCandidate) {
    return bestPreContactCandidate;
  }

  return null;
}

function findNaturalPreEclipseAngleStateLegacy({
  eclipseTier,
  phaseOffsetRadians,
  seedSunAngleRadians,
  sunDirection,
  sunProgress
}) {
  let bestCandidate = null;

  for (let stepIndex = 0; stepIndex < 180; stepIndex += 1) {
    const localProgress = stepIndex / 179;
    const candidateSunAngle = THREE.MathUtils.lerp(
      seedSunAngleRadians - 0.18,
      seedSunAngleRadians + 0.18,
      localProgress
    );
    const candidateSunRenderState = astronomyApi.getSunRenderState({
      orbitAngleRadians: candidateSunAngle,
      orbitMode: "auto",
      progress: sunProgress,
      source: "demo"
    });
    const candidateDarkSunRenderState = astronomyApi.getDarkSunRenderState({
      orbitMode: "auto",
      phaseOffsetRadians,
      source: "demo",
      sunDirection,
      sunOrbitAngleRadians: candidateSunAngle,
      sunProgress
    });
    const eclipseMetrics = getProjectedSolarEclipseMetricsFromStates(
      candidateSunRenderState,
      candidateDarkSunRenderState,
      {
        trackCandidateSun: true
      }
    );

    if (eclipseMetrics.eclipseTier !== eclipseTier || !eclipseMetrics.visibleInView) {
      continue;
    }

    const score = getNaturalPreEclipseCandidateScore(eclipseMetrics);
    if (!bestCandidate || score < bestCandidate.score) {
      bestCandidate = {
        darkSunRenderState: candidateDarkSunRenderState,
        eclipseMetrics,
        score,
        sunAngleRadians: candidateSunAngle,
        sunDirection,
        sunProgress,
        sunRenderState: candidateSunRenderState
      };
    }
  }

  return bestCandidate;
}

function resetDarkSunStageState() {
  simulationState.darkSunStageAltitudeLock = false;
  simulationState.darkSunStageHasEclipsed = false;
  simulationState.darkSunStageOffsetRadians = 0;
  simulationState.darkSunStageTotalityHoldMs = 0;
  simulationState.darkSunStageTransit = 0;
  solarEclipseTrackingState.displayCoverage = 0;
  solarEclipseTrackingState.displayStageElapsedMs = 0;
  solarEclipseTrackingState.displayStageKey = "idle";
  solarEclipseTrackingState.hasEnteredVisibleOverlap = false;
  solarEclipseTrackingState.previousCoverage = 0;
  solarEclipseTrackingState.previousStageKey = "idle";
  solarEclipseTrackingState.recentActiveFrames = 0;
  solarEclipsePresentationMaskState.valid = false;
  solarEclipsePresentationMaskState.maskCenterNdc.set(0, 0);
  solarEclipsePresentationMaskState.maskRadius = 0;
  solarEclipsePresentationMaskState.lastDirectionNdc.set(1, 0);
  solarEclipseEventState.animationSpeedFactor = 1;
  solarEclipseEventState.currentState = createSolarEclipseState();
  solarEclipseEventState.framesUntilEclipseStart = Number.POSITIVE_INFINITY;
  solarEclipseEventState.slowWindowActive = false;
  solarEclipseEventState.toastShownForCurrentEvent = false;
  hideSolarEclipseToast();
}

function stagePreEclipseScene() {
  if (walkerState.enabled || renderState.preparing) {
    exitFirstPersonMode();
  }

  if (astronomyState.enabled) {
    realitySyncEl.checked = false;
    realityLiveEl.checked = false;
    astronomyApi.disableRealityMode();
  }

  celestialTrackingCameraApi.setTarget("sun");
  cameraApi.updateCamera();

  const activeSnapshot = getCurrentUiSnapshot();
  const sourceDate = activeSnapshot?.date ?? new Date();
  const activeSunRenderState = activeSnapshot?.sunRenderState ?? null;
  const activeDarkSunRenderState = activeSnapshot?.darkSunRenderState ?? null;
  const sunAngleRadians = activeSunRenderState?.orbitAngleRadians ?? Math.atan2(orbitSun.position.z, -orbitSun.position.x);
  const sunProgress = activeSunRenderState?.corridorProgress ?? activeSunRenderState?.macroProgress ?? simulationState.sunBandProgress ?? 0.5;
  const sunDirection = astronomyState.enabled
    ? inferStageSunBandDirection(sourceDate, activeSunRenderState)
    : (simulationState.sunBandDirection ?? 1);
  const phaseOffsetRadians = Number.isFinite(activeDarkSunRenderState?.orbitAngleRadians)
    ? (
      activeDarkSunRenderState.orbitAngleRadians +
      (sunAngleRadians * (ORBIT_DARK_SUN_SPEED / Math.max(ORBIT_SUN_SPEED, 0.0001)))
    )
    : (simulationState.darkSunOrbitPhaseOffsetRadians ?? Math.PI);
  const naturalCandidate = findNaturalPreEclipseState({
    phaseOffsetRadians,
    sunAngleRadians,
    sunDirection,
    sunProgress
  });
  const refinedCandidate = naturalCandidate
    ? findNaturalPreEclipseAngleState({
      eclipseTier: naturalCandidate.eclipseMetrics?.eclipseTier ?? SOLAR_ECLIPSE_TIER_TOTAL,
      phaseOffsetRadians,
      seedSunAngleRadians: naturalCandidate.sunAngleRadians,
      sunDirection: naturalCandidate.sunDirection ?? sunDirection,
      sunProgress: naturalCandidate.sunProgress ?? sunProgress
    })
    : null;
  const preEclipseCandidate = refinedCandidate ?? naturalCandidate;

  if (!preEclipseCandidate?.sunRenderState) {
    return;
  }

  const targetSunAngleRadians = preEclipseCandidate.sunAngleRadians ?? sunAngleRadians;
  const targetSunProgress = preEclipseCandidate.sunProgress ?? sunProgress;
  const targetSunDirection = preEclipseCandidate.sunDirection ?? sunDirection;
  const alignedSunRenderState = astronomyApi.getSunRenderState({
    orbitAngleRadians: targetSunAngleRadians,
    orbitMode: "auto",
    progress: targetSunProgress,
    source: "demo"
  });
  const preEclipseOffsetRadians = DARK_SUN_STAGE_START_OFFSET_RADIANS;
  const preContactDarkSunAngle = targetSunAngleRadians + preEclipseOffsetRadians;

  simulationState.demoPhaseDateMs = sourceDate.getTime();
  simulationState.orbitMode = "auto";
  resetDarkSunStageState();
  simulationState.darkSunStageHasEclipsed = false;
  simulationState.orbitSunAngle = targetSunAngleRadians;
  simulationState.sunBandProgress = targetSunProgress;
  simulationState.sunBandDirection = targetSunDirection;
  astronomyApi.syncDarkSunMirrorPhaseOffset({
    sunOrbitAngleRadians: targetSunAngleRadians,
    darkSunOrbitAngleRadians: preContactDarkSunAngle
  });
  const preContactDarkSunRenderState = getCurrentDarkSunRenderStateSnapshot() ?? astronomyApi.getDarkSunRenderState({
    orbitMode: simulationState.orbitMode,
    source: "demo",
    sunDirection: simulationState.sunBandDirection,
    sunOrbitAngleRadians: simulationState.orbitSunAngle,
    sunProgress: simulationState.sunBandProgress
  });
  simulationState.orbitDarkSunAngle = preContactDarkSunRenderState.orbitAngleRadians;
  simulationState.darkSunBandProgress = (
    preContactDarkSunRenderState.corridorProgress ??
    preContactDarkSunRenderState.macroProgress ??
    simulationState.darkSunBandProgress
  );
  simulationState.darkSunBandDirection = (
    preContactDarkSunRenderState.direction ??
    simulationState.darkSunBandDirection
  );
  astronomyApi.updateMoonOrbit({
    orbitMode: simulationState.orbitMode,
    progress: simulationState.moonBandProgress
  });
  astronomyApi.updateSeasonPresentation(alignedSunRenderState.centerRadius);
  astronomyApi.updateOrbitModeUi();
  astronomyApi.refreshTrailsForCurrentMode();
  celestialTrackingCameraApi.setTarget("sun");
  orbitSun.position.copy(alignedSunRenderState.position);
  orbitDarkSun.position.copy(preContactDarkSunRenderState.position);
  scene.updateMatrixWorld(true);
  celestialTrackingCameraApi.update();
  cameraApi.updateCamera();
  resetDarkSunOcclusionMotion(darkSunOcclusionState.orbit);

  const stagedSnapshot = getCurrentUiSnapshot();
  stagedSnapshot.sunRenderState = alignedSunRenderState;
  stagedSnapshot.darkSunRenderState = preContactDarkSunRenderState;
  stagedSnapshot.darkSunRenderPosition = orbitDarkSun.position.clone();
  astronomyApi.updateAstronomyUi(stagedSnapshot);
  evaluateSolarEclipse(stagedSnapshot, 0);
  updateDarkSunMaskUniforms(stagedSnapshot.solarEclipse);
  updateSolarEclipseEventFeedback(stagedSnapshot.solarEclipse);
  updateSolarEclipseAnimationPacing(0);
  updateSunVisualEffects(stagedSnapshot);
}

function updateSunVisualEffects(snapshot) {
  const pulse = 0.5 + (Math.sin(performance.now() * ORBIT_SUN_PULSE_SPEED) * 0.5);
  const solarEclipse = snapshot?.solarEclipse ?? createSolarEclipseState();
  const phaseKey = getSolarEclipsePhaseKey(solarEclipse);
  const visualProfile = getSolarEclipseVisualProfile(solarEclipse);
  const sunlightScale = THREE.MathUtils.clamp(
    solarEclipse.sunlightScale ?? visualProfile.sunLightScale ?? 1,
    0,
    1
  );
  const pulseSuppression = THREE.MathUtils.clamp(visualProfile.pulseSuppression ?? 0, 0, 1);
  const sunlightPulseResponse = Math.pow(sunlightScale, 0.6);
  const combinedPulseSuppression = THREE.MathUtils.clamp(
    Math.max(pulseSuppression, 1 - sunlightPulseResponse),
    0,
    1
  );
  const coronaLightResponse = Math.pow(sunlightScale, 0.72);
  const aureoleLightResponse = Math.pow(sunlightScale, 0.82);
  const coronaOpacityLightScale = THREE.MathUtils.lerp(0.03, 1, coronaLightResponse);
  const aureoleOpacityLightScale = THREE.MathUtils.lerp(0.05, 1, aureoleLightResponse);
  const coronaScaleLightScale = THREE.MathUtils.lerp(0.74, 1, Math.pow(sunlightScale, 0.92));
  const aureoleScaleLightScale = THREE.MathUtils.lerp(0.78, 1, Math.pow(sunlightScale, 0.96));
  const bodyScale = THREE.MathUtils.lerp(
    THREE.MathUtils.lerp(0.96, 1.2, pulse),
    1,
    combinedPulseSuppression
  );
  const haloScale = THREE.MathUtils.lerp(
    THREE.MathUtils.lerp(0.84, 1.34, pulse),
    1,
    combinedPulseSuppression
  );
  const lightScale = THREE.MathUtils.lerp(
    THREE.MathUtils.lerp(0.94, 1.14, pulse),
    1,
    combinedPulseSuppression
  );
  const coronaOpacityPulseScale = THREE.MathUtils.lerp(
    THREE.MathUtils.lerp(0.88, 1.18, pulse),
    1,
    combinedPulseSuppression
  );
  const aureoleOpacityPulseScale = THREE.MathUtils.lerp(
    THREE.MathUtils.lerp(0.82, 1.24, pulse),
    1,
    combinedPulseSuppression
  );
  const coronaScalePulseScale = THREE.MathUtils.lerp(
    THREE.MathUtils.lerp(0.94, 1.08, pulse),
    1,
    combinedPulseSuppression
  );
  const aureoleScalePulseScale = THREE.MathUtils.lerp(
    THREE.MathUtils.lerp(0.96, 1.12, pulse),
    1,
    combinedPulseSuppression
  );
  const domePulse = THREE.MathUtils.lerp(pulse, 0.5, combinedPulseSuppression);
  const eclipseLightScale = getSolarEclipseLightScale(solarEclipse);
  const topDownLightScale = visualProfile.environmentLightScale;

  if (walkerState.enabled) {
    observerSunBody.material.emissiveIntensity *= bodyScale * visualProfile.sunBodyScale;
    observerSunHalo.material.opacity *= haloScale * visualProfile.sunHaloScale;
    observerSunLight.intensity *= lightScale * eclipseLightScale;
  } else {
    const orbitSunBodyTarget = ORBIT_SUN_BODY_EMISSIVE_INTENSITY * bodyScale * visualProfile.sunBodyScale;
    const orbitSunHaloTarget = ORBIT_SUN_HALO_OPACITY * haloScale * visualProfile.sunHaloScale;
    const orbitSunLightTarget = ORBIT_SUN_LIGHT_INTENSITY * lightScale * eclipseLightScale;
    const orbitSunCoronaTarget = ORBIT_SUN_CORONA_OPACITY *
      coronaOpacityPulseScale *
      visualProfile.coronaOpacityScale *
      coronaOpacityLightScale;
    const orbitSunAureoleTarget = ORBIT_SUN_AUREOLE_OPACITY *
      aureoleOpacityPulseScale *
      visualProfile.aureoleOpacityScale *
      aureoleOpacityLightScale;
    orbitSunBody.material.emissiveIntensity = easeEclipseLightValue(
      orbitSunBody.material.emissiveIntensity,
      orbitSunBodyTarget,
      phaseKey,
      { riseBlend: 0.16, eclipseRiseBlend: 0.06, totalityRiseBlend: 0.01, fallBlend: 0.24 }
    );
    orbitSunHalo.material.opacity = easeEclipseLightValue(
      orbitSunHalo.material.opacity,
      orbitSunHaloTarget,
      phaseKey,
      { riseBlend: 0.14, eclipseRiseBlend: 0.028, totalityRiseBlend: 0.006, fallBlend: 0.22 }
    );
    orbitSunLight.intensity = easeEclipseLightValue(
      orbitSunLight.intensity,
      orbitSunLightTarget,
      phaseKey,
      { riseBlend: 0.16, eclipseRiseBlend: 0.024, totalityRiseBlend: 0.004, fallBlend: 0.24 }
    );
    orbitSunCorona.material.opacity = easeEclipseLightValue(
      orbitSunCorona.material.opacity,
      orbitSunCoronaTarget,
      phaseKey,
      { riseBlend: 0.12, eclipseRiseBlend: 0.03, totalityRiseBlend: 0.008, fallBlend: 0.18 }
    );
    orbitSunAureole.material.opacity = easeEclipseLightValue(
      orbitSunAureole.material.opacity,
      orbitSunAureoleTarget,
      phaseKey,
      { riseBlend: 0.12, eclipseRiseBlend: 0.03, totalityRiseBlend: 0.008, fallBlend: 0.18 }
    );
    orbitSunCorona.scale.setScalar(
      ORBIT_SUN_CORONA_SCALE *
      coronaScalePulseScale *
      visualProfile.coronaScaleFactor *
      coronaScaleLightScale
    );
    orbitSunAureole.scale.setScalar(
      ORBIT_SUN_AUREOLE_SCALE *
      aureoleScalePulseScale *
      visualProfile.aureoleScaleFactor *
      aureoleScaleLightScale
    );
    orbitSunAureole.material.rotation += 0.0016;
  }

  ambient.intensity = easeEclipseLightValue(
    ambient.intensity,
    0.9 * topDownLightScale,
    phaseKey,
    { riseBlend: 0.12, eclipseRiseBlend: 0.026, totalityRiseBlend: 0.006, fallBlend: 0.16 }
  );
  keyLight.intensity = easeEclipseLightValue(
    keyLight.intensity,
    1.35 * topDownLightScale,
    phaseKey,
    { riseBlend: 0.12, eclipseRiseBlend: 0.024, totalityRiseBlend: 0.006, fallBlend: 0.16 }
  );
  rimLight.intensity = easeEclipseLightValue(
    rimLight.intensity,
    0.42 * topDownLightScale,
    phaseKey,
    { riseBlend: 0.12, eclipseRiseBlend: 0.024, totalityRiseBlend: 0.006, fallBlend: 0.16 }
  );

  if (walkerState.enabled && firstPersonSunRayGroup.visible) {
    if (visualProfile.sunRayScale <= 0.05) {
      firstPersonSunRayGroup.visible = false;
      for (const rayMesh of firstPersonSunRayMeshes) {
        rayMesh.material.opacity = 0;
      }
    } else {
      for (const rayMesh of firstPersonSunRayMeshes) {
        rayMesh.material.opacity *= visualProfile.sunRayScale;
      }
    }
  }

  orbitSun.getWorldPosition(tempSunWorldPosition);
  tempDomeSunLocalPosition.copy(tempSunWorldPosition);
  dome.worldToLocal(tempDomeSunLocalPosition);
  if (dome.material.userData.shader) {
    dome.material.userData.shader.uniforms.sunLocalPosition.value.copy(tempDomeSunLocalPosition);
    dome.material.userData.shader.uniforms.sunPulse.value = domePulse;
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
    resetDarkSunOcclusionMotion(darkSunOcclusionState.observer);
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
    observerDarkSun.visible = false;
    observerMoon.visible = false;
    firstPersonSunRayGroup.visible = false;
    orbitSun.visible = true;
    orbitSun.renderOrder = 20;
    sunFullTrail.visible = celestialControlState.showFullTrail;
    sunFullTrailPointsCloud.visible = celestialControlState.showFullTrail;
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
    moonFullTrail.visible = celestialControlState.showFullTrail;
    moonFullTrailPointsCloud.visible = celestialControlState.showFullTrail;
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
  const darkSunHorizontal = getHorizontalFromWorldPosition(
    orbitDarkSun.getWorldPosition(tempDemoDarkSunSourceWorld),
    observerGeo
  );
  const moonHorizontal = getHorizontalFromWorldPosition(
    orbitMoon.getWorldPosition(tempDemoMoonSourceWorld),
    observerGeo
  );
  const adjustedSunHorizontal = applyCelestialAltitudeOffset(sunHorizontal);
  const adjustedDarkSunHorizontal = applyCelestialAltitudeOffset(darkSunHorizontal);
  const adjustedMoonHorizontal = applyCelestialAltitudeOffset(moonHorizontal);
  const sunTargetVisibility = THREE.MathUtils.clamp(
    (adjustedSunHorizontal.altitudeDegrees + FIRST_PERSON_CELESTIAL_FADE_RANGE) / (FIRST_PERSON_CELESTIAL_FADE_RANGE * 2),
    0,
    1
  );
  const darkSunTargetVisibility = THREE.MathUtils.clamp(
    (adjustedDarkSunHorizontal.altitudeDegrees + FIRST_PERSON_CELESTIAL_FADE_RANGE) / (FIRST_PERSON_CELESTIAL_FADE_RANGE * 2),
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
  const darkSunHorizonLift = THREE.MathUtils.clamp(
    adjustedDarkSunHorizontal.altitudeDegrees / constants.FIRST_PERSON_HORIZON_OCCLUSION_RANGE,
    0,
    1
  );
  const moonHorizonLift = THREE.MathUtils.clamp(
    adjustedMoonHorizontal.altitudeDegrees / constants.FIRST_PERSON_HORIZON_OCCLUSION_RANGE,
    0,
    1
  );
  const sunOcclusionVisibility = sunTargetVisibility * sunHorizonLift;
  const darkSunOcclusionVisibility = darkSunTargetVisibility * darkSunHorizonLift;
  const moonOcclusionVisibility = moonTargetVisibility * moonHorizonLift;

  positionBodyInObserverSky(observerSun, adjustedSunHorizontal, observerGeo);
  positionBodyInObserverSky(observerDarkSun, adjustedDarkSunHorizontal, observerGeo);
  positionBodyInObserverSky(observerMoon, adjustedMoonHorizontal, observerGeo);
  observerSun.position.y -= (1 - sunHorizonLift) * constants.FIRST_PERSON_HORIZON_SINK;
  observerDarkSun.position.y -= (1 - darkSunHorizonLift) * constants.FIRST_PERSON_HORIZON_SINK;
  observerMoon.position.y -= (1 - moonHorizonLift) * (constants.FIRST_PERSON_HORIZON_SINK * 0.65);
  observerSun.scale.setScalar(FIRST_PERSON_SUN_SCALE);
  observerDarkSun.scale.setScalar(FIRST_PERSON_SUN_SCALE * (ORBIT_DARK_SUN_SIZE / ORBIT_SUN_SIZE));
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
  sunFullTrail.visible = false;
  sunFullTrailPointsCloud.visible = false;
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
  observerDarkSun.renderOrder = 26;
  const debugDarkSunBodyOpacity = simulationState.darkSunDebugVisible
    ? ORBIT_DARK_SUN_DEBUG_OPACITY
    : darkSunOcclusionVisibility;
  const debugDarkSunRimOpacity = simulationState.darkSunDebugVisible
    ? ORBIT_DARK_SUN_DEBUG_RIM_OPACITY
    : (ORBIT_DARK_SUN_RIM_OPACITY * darkSunOcclusionVisibility);
  observerDarkSunBody.material.opacity += (
    debugDarkSunBodyOpacity - observerDarkSunBody.material.opacity
  ) * 0.18;
  observerDarkSunRim.material.opacity += (
    debugDarkSunRimOpacity - observerDarkSunRim.material.opacity
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
  moonFullTrail.visible = false;
  moonFullTrailPointsCloud.visible = false;
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
  } else if (cameraState.mode === "tracking") {
    cameraState.targetTrackingAzimuth -= deltaX * 0.008;
    cameraState.targetTrackingElevation -= deltaY * 0.006;
    cameraApi.clampCamera();
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
  if (cameraState.mode === "tracking") {
    cameraState.targetTrackingDistance += event.deltaY * 0.01;
  } else {
    cameraState.targetRadius += event.deltaY * 0.01;
  }
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
  cameraState.targetTrackingAzimuth = constants.CAMERA_TRACKING_DEFAULT_AZIMUTH;
  cameraState.targetTrackingElevation = constants.CAMERA_TRACKING_DEFAULT_ELEVATION;
  cameraState.targetTrackingDistance = constants.CAMERA_TRACKING_DEFAULT_DISTANCE;
  cameraApi.clampCamera();
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

celestialTrailLengthEl.addEventListener("input", () => {
  celestialControlState.trailLengthFactor = THREE.MathUtils.clamp(
    Number.parseFloat(celestialTrailLengthEl.value) / 100,
    0,
    1
  );
  astronomyApi.syncAstronomyControls();
  astronomyApi.refreshTrailsForCurrentMode();
});

celestialSpeedEl.addEventListener("input", () => {
  celestialControlState.speedMultiplier = THREE.MathUtils.clamp(
    Number.parseFloat(celestialSpeedEl.value),
    0,
    5
  );
  astronomyApi.syncAstronomyControls();
});

celestialFullTrailEl.addEventListener("change", () => {
  celestialControlState.showFullTrail = celestialFullTrailEl.checked;
  astronomyApi.syncAstronomyControls();
  syncFullTrailVisibility();
});

routePlaybackButton.addEventListener("click", () => {
  routeSimulationApi.togglePlayback();
});

routeResetButton.addEventListener("click", () => {
  routeSimulationApi.resetProgress();
});

realitySyncEl.addEventListener("change", () => {
  if (realitySyncEl.checked) {
    resetDarkSunStageState();
    const nextDate = realityLiveEl.checked ? new Date() : new Date(observationTimeEl.value);
    astronomyApi.enableRealityMode({
      live: realityLiveEl.checked,
      date: Number.isNaN(nextDate.getTime()) ? new Date() : nextDate
    });
    return;
  }
  astronomyApi.disableRealityMode();
  simulationState.demoPhaseDateMs = astronomyState.selectedDate.getTime();
});

realityLiveEl.addEventListener("change", () => {
  if (!realitySyncEl.checked) {
    realityLiveEl.checked = false;
    return;
  }
  if (realityLiveEl.checked) {
    resetDarkSunStageState();
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
  resetDarkSunStageState();
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

if (magneticFieldOverlayEl) {
  magneticFieldOverlayEl.addEventListener("change", () => {
    magneticFieldState.enabled = magneticFieldOverlayEl.checked;
    magneticFieldApi.syncUi();
  });
}

if (darkSunDebugEl) {
  darkSunDebugEl.addEventListener("change", () => {
    simulationState.darkSunDebugVisible = darkSunDebugEl.checked;
    const snapshot = getCurrentUiSnapshot();
    astronomyApi.updateAstronomyUi(snapshot);
    syncDarkSunPresentation(snapshot.solarEclipse ?? createSolarEclipseState());
  });
}

if (stagePreEclipseButton) {
  stagePreEclipseButton.addEventListener("click", () => {
    stagePreEclipseScene();
  });
}

skyAnalemmaOverlayEl.addEventListener("change", () => {
  skyAnalemmaState.enabled = skyAnalemmaOverlayEl.checked;
  const projectionDate = astronomyState.live ? new Date() : astronomyState.selectedDate;
  astronomyApi.syncSkyAnalemmaUi(projectionDate, true);
});

for (const button of orbitModeButtons) {
  button.addEventListener("click", () => {
    simulationState.orbitMode = button.dataset.orbitMode;
    astronomyApi.updateOrbitModeUi();
    astronomyApi.refreshTrailsForCurrentMode();
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

function getBodyBandProgressStep(body) {
  const normalizedBody = body === "darkSun" ? "sun" : body;
  const turns = Math.max(magneticFieldApi.getCoilOrbitProfile(normalizedBody).turns, 1);
  let baseSpeed = ORBIT_SUN_SEASON_SPEED;

  if (body === "moon") {
    baseSpeed *= ORBIT_MOON_BAND_SPEED_FACTOR;
  } else if (body === "darkSun") {
    baseSpeed *= ORBIT_DARK_SUN_BAND_SPEED_FACTOR;
  }

  return baseSpeed / turns;
}

function advanceBandProgress(progressKey, directionKey, step) {
  const nextState = getAdvancedBandState(
    simulationState[progressKey] ?? 0.5,
    simulationState[directionKey] ?? 1,
    step
  );
  simulationState[progressKey] = nextState.progress;
  simulationState[directionKey] = nextState.direction;
}

function animate() {
  requestAnimationFrame(animate);
  const deltaSeconds = Math.min(clock.getDelta(), 0.05);
  const eclipseAnimationSpeedFactor = updateSolarEclipseAnimationPacing(deltaSeconds);
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
    const speedMultiplier = celestialControlState.speedMultiplier * eclipseAnimationSpeedFactor;
    simulationState.orbitSunAngle += ORBIT_SUN_SPEED * speedMultiplier;
    if (simulationState.orbitMode === "auto") {
      advanceBandProgress("sunBandProgress", "sunBandDirection", getBodyBandProgressStep("sun") * speedMultiplier);
      advanceBandProgress("moonBandProgress", "moonBandDirection", getBodyBandProgressStep("moon") * speedMultiplier);
    }
    simulationState.orbitMoonAngle += ORBIT_MOON_SPEED * speedMultiplier;
    simulationState.demoPhaseDateMs += deltaSeconds * DEMO_MOON_PHASE_MS_PER_SECOND * speedMultiplier;
    projectionDate = new Date(simulationState.demoPhaseDateMs);
    const sunRenderState = astronomyApi.getSunRenderState({
      orbitAngleRadians: simulationState.orbitSunAngle,
      orbitMode: simulationState.orbitMode,
      progress: simulationState.sunBandProgress,
      source: "demo"
    });
    orbitSun.position.copy(sunRenderState.position);
    const darkSunRenderState = getCurrentDarkSunRenderStateSnapshot();
    simulationState.orbitDarkSunAngle = darkSunRenderState.orbitAngleRadians;
    simulationState.darkSunBandProgress = darkSunRenderState.corridorProgress ?? darkSunRenderState.macroProgress;
    simulationState.darkSunBandDirection = darkSunRenderState.direction;
    orbitDarkSun.position.copy(darkSunRenderState.position);
    astronomyApi.updateSunTrail();
    astronomyApi.updateMoonOrbit({
      orbitMode: simulationState.orbitMode,
      progress: simulationState.moonBandProgress
    });
    astronomyApi.updateMoonTrail();
    astronomyApi.updateSeasonPresentation(sunRenderState.centerRadius);
    const demoSunGeo = getGeoFromProjectedPosition(orbitSun.position, DISC_RADIUS);
    const demoMoonGeo = getGeoFromProjectedPosition(orbitMoon.position, DISC_RADIUS);
    astronomyApi.updateDayNightOverlayFromSun(demoSunGeo.latitudeDegrees, demoSunGeo.longitudeDegrees);
    snapshot = {
      date: projectionDate,
      sun: demoSunGeo,
      moon: demoMoonGeo,
      moonPhase: getMoonPhase(projectionDate),
      darkSunRenderState,
      darkSunRenderPosition: orbitDarkSun.position.clone(),
      solarEclipse: createSolarEclipseState(),
      sunPosition: orbitSun.position.clone(),
      sunRenderState,
      sunRenderPosition: orbitSun.position.clone(),
      sunDisplayHorizontal: astronomyApi.getSunDisplayHorizontalFromPosition(orbitSun.position),
      moonPosition: orbitMoon.position.clone(),
      moonRenderPosition: orbitMoon.position.clone()
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
  if (snapshot) {
    if (!walkerState.enabled) {
      resetDarkSunOcclusionMotion(darkSunOcclusionState.orbit);
      snapshot.darkSunRenderPosition = orbitDarkSun.position.clone();
    } else {
      resetDarkSunOcclusionMotion(darkSunOcclusionState.orbit);
    }
    updateObserverCelestialPerspective(snapshot);
    evaluateSolarEclipse(snapshot, deltaSeconds);
    updateDarkSunMaskUniforms(snapshot.solarEclipse);
    updateSolarEclipseEventFeedback(snapshot.solarEclipse);
    firstPersonWorldApi.update(snapshot);
  } else {
    updateDarkSunMaskUniforms(createSolarEclipseState());
    updateSolarEclipseEventFeedback(createSolarEclipseState());
    firstPersonWorldApi.update(snapshot);
  }
  updateSunVisualEffects(snapshot);
  magneticFieldApi.update(performance.now());
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
magneticFieldApi.syncUi();
astronomyApi.syncSeasonalMoonUi();
astronomyApi.syncSeasonalSunUi(true);
astronomyApi.syncSolarEclipseUi(createSolarEclipseState());
walkerApi.syncWalkerUi();
routeSimulationApi.initialize();
syncFullTrailVisibility();
resetDarkSunStageState();
astronomyApi.enableRealityMode({ live: true, date: astronomyState.selectedDate });
animate();

