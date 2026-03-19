import * as THREE from "./vendor/three.module.js";
import {
  getGeoFromProjectedPosition,
  projectedRadiusFromLatitude
} from "./modules/geo-utils.js";
import {
  createSolarEclipseState,
  getMoonPhase,
  getSolarAltitudeFactor,
} from "./modules/astronomy-utils.js?v=20260314-natural-eclipse2";
import { createAstronomyController } from "./modules/astronomy-controller.js?v=20260314-natural-eclipse4";
import { createCameraController } from "./modules/camera-controller.js?v=20260313-tracking-angle1";
import { createCelestialTrackingCameraController } from "./modules/celestial-tracking-camera-controller.js?v=20260319-tracking-angle2";
import { createFirstPersonWorldController } from "./modules/first-person-world-controller.js?v=20260312-darksun-eclipse1";
import { createI18n } from "./modules/i18n.js?v=20260319-constellation-tab1";
import { createMagneticFieldController } from "./modules/magnetic-field-controller.js?v=20260314-magnetic-pinecone3";
import { createRouteSimulationController } from "./modules/route-simulation-controller.js";
import { createTextureManager } from "./modules/texture-manager.js?v=20260311-gpu-daynight";
import { createWalkerController } from "./modules/walker-controller.js?v=20260312-darksun-eclipse1";

import * as constants from "./modules/constants.js";
import { createEclipseController } from "./modules/eclipse-controller.js?v=20260314-natural-eclipse2";
import { createCelestialVisualsController } from "./modules/celestial-visuals-controller.js";
import { createConstellationTabController } from "./modules/constellation-tab-controller.js?v=20260319-constellation-tab2";
import { setupInputHandlers } from "./modules/input-handler.js";
import { createRocketController, SPACEPORTS } from "./modules/rocket-controller.js?v=20260319-parabola";
const {
  DEFAULT_MAP_PATH,
  DEFAULT_MAP_LABEL,
  MODEL_SCALE,
  scaleDimension,
  CELESTIAL_SIZE_SCALE,
  DISC_RADIUS,
  DISC_HEIGHT,
  CELESTIAL_ALTITUDE_SCALE,
  CELESTIAL_ALTITUDE_BASE_Y,
  scaleCelestialAltitude,
  RIM_THICKNESS,
  RIM_CLEARANCE,
  RIM_OUTER_RADIUS,
  RIM_INNER_RADIUS,
  RIM_HEIGHT,
  RIM_CENTER_Y,
  RIM_TOP_Y,
  RIM_BOTTOM_Y,
  DOME_RADIUS,
  DOME_BASE_Y,
  DOME_VERTICAL_SCALE,
  CELESTIAL_HEIGHT_DROP,
  CELESTIAL_ALTITUDE_DROP_DEGREES,
  CELESTIAL_ORBIT_Y_SPREAD_SCALE,
  POLARIS_ALTITUDE_OFFSET,
  POLARIS_CORE_RADIUS,
  POLARIS_GLOW_SIZE,
  POLARIS_HALO_SIZE,
  POLARIS_CORE_OPACITY,
  POLARIS_GLOW_OPACITY,
  POLARIS_HALO_OPACITY,
  TROPIC_LATITUDE,
  SUN_ORBIT_ALTITUDE_CONTRAST,
  MOON_ORBIT_ALTITUDE_CONTRAST,
  spreadOrbitHeight,
  RAW_ORBIT_TRACK_HEIGHT,
  RAW_ORBIT_SUN_BASE_OFFSET,
  RAW_ORBIT_SUN_NORTH_OFFSET,
  RAW_ORBIT_SUN_SOUTH_OFFSET,
  RAW_ORBIT_SUN_HEIGHT,
  RAW_ORBIT_SUN_HEIGHT_NORTH,
  RAW_ORBIT_SUN_HEIGHT_SOUTH,
  ORBIT_TRACK_HEIGHT,
  ORBIT_SUN_HEIGHT,
  ORBIT_SUN_HEIGHT_NORTH,
  ORBIT_SUN_HEIGHT_SOUTH,
  CELESTIAL_BODY_SIZE,
  ORBIT_SUN_SIZE,
  ORBIT_SUN_SPEED,
  ORBIT_DARK_SUN_SPEED,
  ORBIT_DARK_SUN_BAND_SPEED_FACTOR,
  ORBIT_DARK_SUN_SIZE,
  ORBIT_DARK_SUN_BODY_COLOR,
  ORBIT_DARK_SUN_DEBUG_COLOR,
  ORBIT_DARK_SUN_RIM_COLOR,
  ORBIT_SUN_HALO_SCALE,
  ORBIT_DARK_SUN_HALO_SCALE,
  ORBIT_DARK_SUN_DEBUG_RIM_COLOR,
  ORBIT_DARK_SUN_DEBUG_OPACITY,
  ORBIT_DARK_SUN_DEBUG_RIM_OPACITY,
  ORBIT_DARK_SUN_OCCLUSION_OPACITY,
  ORBIT_DARK_SUN_RIM_OPACITY,
  DARK_SUN_ATTRACTION_START_FACTOR,
  DARK_SUN_ATTRACTION_END_FACTOR,
  DARK_SUN_CAPTURE_RESPONSE,
  DARK_SUN_RELEASE_RESPONSE,
  DARK_SUN_TRANSIT_PERPENDICULAR_COMPRESSION,
  DARK_SUN_TRANSIT_ALONG_COMPRESSION,
  DARK_SUN_HOLD_DAMPING,
  DARK_SUN_CENTER_HOLD_FACTOR,
  DARK_SUN_ECLIPSE_TRANSIT_SLOW_FACTOR,
  DARK_SUN_ECLIPSE_RESPONSE_SLOW_FACTOR,
  DARK_SUN_ALTITUDE_LOCK_START,
  DARK_SUN_ALTITUDE_ALIGNMENT_TOLERANCE_FACTOR,
  DARK_SUN_STAGE_PRE_ECLIPSE_DISTANCE_FACTOR,
  STAGE_PRE_ECLIPSE_TARGET_VISIBLE_COVERAGE,
  STAGE_PRE_ECLIPSE_MAX_START_COVERAGE,
  DARK_SUN_STAGE_START_OFFSET_RADIANS,
  SOLAR_ECLIPSE_TRIGGER_MARGIN_PX,
  SOLAR_ECLIPSE_TRIGGER_MARGIN_FACTOR,
  SOLAR_ECLIPSE_APPROACH_DISTANCE_FACTOR,
  SOLAR_ECLIPSE_TOAST_DISTANCE_FACTOR,
  SOLAR_ECLIPSE_IDLE_DISTANCE_FACTOR,
  SOLAR_ECLIPSE_MIN_COVERAGE,
  SOLAR_ECLIPSE_TOTAL_COVERAGE,
  SOLAR_ECLIPSE_DIRECTION_EPSILON,
  SOLAR_ECLIPSE_CONTACT_START_PX,
  SOLAR_ECLIPSE_VISIBLE_CONTACT_PX,
  SOLAR_ECLIPSE_TIER_NONE,
  SOLAR_ECLIPSE_TIER_TOTAL,
  SOLAR_ECLIPSE_TIER_PARTIAL_2,
  SOLAR_ECLIPSE_TIER_PARTIAL_3,
  SOLAR_ECLIPSE_PARTIAL_LANE_2_CAP,
  SOLAR_ECLIPSE_PARTIAL_LANE_3_CAP,
  SOLAR_ECLIPSE_APPROACH_MIN_MS,
  SOLAR_ECLIPSE_PARTIAL_STAGE_MIN_MS,
  SOLAR_ECLIPSE_TOTALITY_MIN_MS,
  SOLAR_ECLIPSE_COMPLETE_FADE_MS,
  SOLAR_ECLIPSE_SLOW_LOOKAHEAD_FRAMES,
  SOLAR_ECLIPSE_TOAST_DURATION_MS,
  SOLAR_ECLIPSE_APPROACH_SLOW_FACTOR,
  SOLAR_ECLIPSE_TOTALITY_SLOW_FACTOR,
  SOLAR_ECLIPSE_COMPLETE_SLOW_FACTOR,
  SOLAR_ECLIPSE_ANIMATION_SLOW_RESPONSE,
  SOLAR_ECLIPSE_PRESENTATION_COVERAGE_RATE,
  SOLAR_ECLIPSE_COMPLETE_HOLD_FRAMES,
  STAGE_PRE_ECLIPSE_SEARCH_MAX_FRAMES,
  STAGE_PRE_ECLIPSE_REFINEMENT_FRAMES,
  DARK_SUN_STAGE_DURATION_SECONDS,
  DARK_SUN_STAGE_CONTACT_OFFSET_RADIANS,
  DARK_SUN_STAGE_CONTACT_MARGIN_RADIANS,
  DARK_SUN_STAGE_APPROACH_SHARE,
  DARK_SUN_STAGE_INGRESS_SHARE,
  DARK_SUN_STAGE_TOTALITY_SHARE,
  DARK_SUN_STAGE_EGRESS_SHARE,
  DARK_SUN_STAGE_COMPLETE_SHARE,
  ORBIT_SUN_SEASON_SPEED,
  ORBIT_MOON_BAND_SPEED_FACTOR,
  CELESTIAL_TRAIL_LENGTH_DEFAULT_PERCENT,
  CELESTIAL_SPEED_DEFAULT,
  ORBIT_SUN_HALO_OPACITY,
  ORBIT_SUN_LIGHT_INTENSITY,
  ORBIT_SUN_BODY_EMISSIVE_INTENSITY,
  ORBIT_SUN_CORONA_SCALE,
  ORBIT_SUN_AUREOLE_SCALE,
  ORBIT_SUN_CORONA_OPACITY,
  ORBIT_SUN_AUREOLE_OPACITY,
  ORBIT_SUN_PULSE_SPEED,
  SUN_COIL_TURNS,
  SUN_COIL_AMPLITUDE,
  SUN_COIL_PITCH,
  ORBIT_TRACK_TUBE_RADIUS,
  SUN_COIL_BASE_CLEARANCE,
  SUN_COIL_DOME_CLEARANCE,
  ORBIT_HEIGHT_GUIDE_RADIUS,
  ORBIT_HEIGHT_GUIDE_MARKER_SIZE,
  ORBIT_HEIGHT_GUIDE_ANGLES,
  RAW_ORBIT_MOON_BASE_OFFSET,
  RAW_ORBIT_MOON_NORTH_OFFSET,
  RAW_ORBIT_MOON_SOUTH_OFFSET,
  RAW_ORBIT_MOON_BASE_HEIGHT,
  RAW_ORBIT_MOON_HEIGHT_NORTH,
  RAW_ORBIT_MOON_HEIGHT_SOUTH,
  ORBIT_MOON_BASE_HEIGHT,
  ORBIT_MOON_HEIGHT_NORTH,
  ORBIT_MOON_HEIGHT_SOUTH,
  ORBIT_MOON_SIZE,
  ORBIT_MOON_HALO_OPACITY,
  ORBIT_MOON_LIGHT_INTENSITY,
  ORBIT_MOON_BODY_EMISSIVE_INTENSITY,
  ORBIT_MOON_SPEED,
  ORBIT_MOON_CORONA_SCALE,
  ORBIT_MOON_AUREOLE_SCALE,
  ORBIT_MOON_WARM_FRINGE_SCALE,
  ORBIT_MOON_CORONA_OPACITY,
  ORBIT_MOON_AUREOLE_OPACITY,
  ORBIT_MOON_WARM_FRINGE_OPACITY,
  ORBIT_MOON_PULSE_SPEED,
  ORBIT_MOON_LIGHT_COLOR_DAY,
  ORBIT_MOON_LIGHT_COLOR_NIGHT,
  ORBIT_MOON_HALO_COLOR_DAY,
  ORBIT_MOON_HALO_COLOR_NIGHT,
  ORBIT_MOON_EMISSIVE_COLOR_DAY,
  ORBIT_MOON_EMISSIVE_COLOR_NIGHT,
  ORBIT_MOON_COOL_GLOW_COLOR,
  ORBIT_MOON_COOL_GLOW_SCALE,
  ORBIT_SURFACE_LINE_WIDTH,
  SUN_TRAIL_MAX_POINTS,
  MOON_TRAIL_MAX_POINTS,
  REALITY_TRAIL_WINDOW_MS,
  REALITY_TRAIL_REFRESH_MS,
  DAY_NIGHT_TEXTURE_SIZE,
  DAY_NIGHT_UPDATE_EPSILON,
  ANALEMMA_SURFACE_OFFSET,
  SKY_ANALEMMA_RADIUS,
  MAP_TEXTURE_SIZE,
  CAMERA_DEFAULT_FOV,
  CAMERA_WALKER_FOV,
  CAMERA_TOPDOWN_DEFAULT_RADIUS,
  CAMERA_TOPDOWN_MIN_RADIUS,
  CAMERA_TOPDOWN_MAX_RADIUS,
  CAMERA_TRACKING_DEFAULT_DISTANCE,
  CAMERA_TRACKING_MIN_DISTANCE,
  CAMERA_TRACKING_MAX_DISTANCE,
  CAMERA_TRACKING_DEFAULT_AZIMUTH,
  CAMERA_TRACKING_DEFAULT_ELEVATION,
  CAMERA_TRACKING_MIN_ELEVATION,
  CAMERA_TRACKING_MAX_ELEVATION,
  TOPDOWN_STAGE_SCALE,
  FOG_DEFAULT_NEAR,
  FOG_DEFAULT_FAR,
  FOG_WALKER_NEAR,
  FOG_WALKER_FAR,
  FIRST_PERSON_STAGE_SCALE,
  FIRST_PERSON_WORLD_RADIUS,
  FIRST_PERSON_HORIZON_RADIUS,
  FIRST_PERSON_SKY_RADIUS,
  FIRST_PERSON_PREP_DURATION_MS,
  FIRST_PERSON_RETURN_DURATION_MS,
  FIRST_PERSON_CELESTIAL_NEAR_RADIUS,
  FIRST_PERSON_CELESTIAL_FAR_RADIUS,
  FIRST_PERSON_CELESTIAL_FADE_RANGE,
  FIRST_PERSON_HORIZON_OCCLUSION_RANGE,
  FIRST_PERSON_HORIZON_SINK,
  FIRST_PERSON_CELESTIAL_SCALE,
  FIRST_PERSON_SUN_SCALE,
  FIRST_PERSON_MOON_SCALE,
  FIRST_PERSON_SUN_RAY_LENGTH,
  FIRST_PERSON_SUN_RAY_WIDTH,
  FIRST_PERSON_SUN_RAY_SHORT_LENGTH,
  FIRST_PERSON_SUN_RAY_SHORT_WIDTH,
  FIRST_PERSON_SUN_RAY_ALIGNMENT_START,
  FIRST_PERSON_SUN_RAY_ALIGNMENT_END,
  SURFACE_Y,
  WALKER_SURFACE_OFFSET,
  WALKER_EYE_HEIGHT,
  WALKER_BODY_HEIGHT,
  WALKER_BODY_RADIUS,
  WALKER_SPEED,
  WALKER_LOOK_DISTANCE,
  WALKER_START_LATITUDE,
  WALKER_START_LONGITUDE,
  WALKER_PITCH_MAX,
  WALKER_PITCH_MIN,
  WALKER_GUIDE_Y,
  WALKER_GUIDE_HALF_WIDTH,
  WALKER_GUIDE_START,
  WALKER_GUIDE_LENGTH,
  WALKER_GUIDE_MARK_SIZE,
  WALKER_GUIDE_MARK_GAP,
  WALKER_HORIZON_SHIFT_PX,
  POLARIS_HEIGHT,
  TROPIC_CANCER_RADIUS,
  EQUATOR_RADIUS,
  TROPIC_CAPRICORN_RADIUS,
  ORBIT_RADIUS_MID,
  ORBIT_RADIUS_AMPLITUDE
} = constants;

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
const rocketSpaceportSelect = document.getElementById("rocket-spaceport-select");
const rocketTypeSelect      = document.getElementById("rocket-type-select");
const rocketLaunchBtn       = document.getElementById("rocket-launch-btn");
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
const stagePreLunarEclipseButton = document.getElementById("stage-pre-lunar-eclipse");
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
const constellationSelectEl = document.getElementById("constellation-select");
const constellationMapEl = document.getElementById("constellation-map");
const constellationDirectionEl = document.getElementById("constellation-direction");
const constellationRaEl = document.getElementById("constellation-ra");
const constellationDecEl = document.getElementById("constellation-dec");
const constellationHemisphereEl = document.getElementById("constellation-hemisphere");
const constellationSegmentsEl = document.getElementById("constellation-segments");
const constellationStarsEl = document.getElementById("constellation-stars");
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

for (let i = 0; i < SPACEPORTS.length; i++) {
  const option = document.createElement("option");
  option.value = i;
  option.textContent = SPACEPORTS[i].name;
  rocketSpaceportSelect.appendChild(option);
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

import { setupScene } from "./modules/scene-setup.js";
import { createConstellations } from "./modules/constellation-setup.js?v=20260319-constellation-tab1";
const {
  renderer,
  scene,
  firstPersonScene,
  camera,
  defaultCameraLookTarget,
  cameraState,
  stage,
  scalableStage,
  topMaterial,
  sideMaterial,
  bottomMaterial,
  disc,
  transparentSurfaceMaterial,
  dayNightOverlayMaterial,
  dayNightOverlay,
  northSeasonOverlay,
  southSeasonOverlay,
  analemmaProjectionGeometry,
  analemmaProjectionMaterial,
  analemmaProjection,
  analemmaProjectionPointsGeometry,
  analemmaProjectionPointsMaterial,
  analemmaProjectionPoints,
  skyAnalemmaGeometry,
  skyAnalemmaMaterial,
  skyAnalemma,
  skyAnalemmaPointsGeometry,
  skyAnalemmaPointsMaterial,
  skyAnalemmaPoints,
  iceOuterMaterial,
  iceInnerMaterial,
  iceCapMaterial,
  iceWallOuter,
  iceWallInner,
  iceTopCap,
  iceBottomCap,
  iceCrown,
  dome,
  domeRing,
  polarisTextureCanvas,
  polarisTextureCtx,
  polarisGlowGradient,
  polarisGlowTexture,
  polaris,
  polarisCore,
  polarisGlow,
  polarisHalo,
  glow,
  walker,
  walkerBody,
  walkerHeading,
  walkerRing,
  walkerGuideGroup,
  walkerGuideLeft,
  walkerGuideRight,
  walkerGuideCenter,
  ambient,
  keyLight,
  rimLight,
  firstPersonAmbient,
  firstPersonKeyLight,
  firstPersonRimLight,
  orbitSun,
  orbitSunBody,
  orbitSunHalo,
  orbitSunLight,
  observerSun,
  observerSunBody,
  observerSunHalo,
  observerSunLight,
  orbitDarkSun,
  orbitDarkSunBody,
  orbitDarkSunRim,
  observerDarkSun,
  observerDarkSunBody,
  observerDarkSunRim,
  sunAuraTexture,
  orbitSunCorona,
  orbitSunAureole,
  sunRayTexture,
  firstPersonSunRayGroup,
  firstPersonSunRayMeshes,
  orbitMoon,
  orbitMoonBody,
  orbitMoonHalo,
  orbitMoonLight,
  orbitMoonCoolGlow,
  orbitMoonCorona,
  orbitMoonAureole,
  orbitMoonWarmFringe,
  observerMoon,
  observerMoonBody,
  observerMoonHalo,
  observerMoonLight,
  observerMoonCoolGlow,
  observerMoonCorona,
  observerMoonAureole,
  observerMoonWarmFringe,
  sunFullTrailGeometry,
  sunFullTrailMaterial,
  sunFullTrail,
  sunFullTrailPointsGeometry,
  sunFullTrailPointsMaterial,
  sunFullTrailPointsCloud,
  sunTrailGeometry,
  sunTrailMaterial,
  sunTrail,
  sunTrailPointsGeometry,
  sunTrailPointsMaterial,
  sunTrailPointsCloud,
  moonFullTrailGeometry,
  moonFullTrailMaterial,
  moonFullTrail,
  moonFullTrailPointsGeometry,
  moonFullTrailPointsMaterial,
  moonFullTrailPointsCloud,
  moonTrailGeometry,
  moonTrailMaterial,
  moonTrail,
  moonTrailPointsGeometry,
  moonTrailPointsMaterial,
  moonTrailPointsCloud,
  darkSunFullTrailGeometry,
  darkSunFullTrailMaterial,
  darkSunFullTrail,
  darkSunFullTrailPointsGeometry,
  darkSunFullTrailPointsMaterial,
  darkSunFullTrailPointsCloud,
  darkSunTrailGeometry,
  darkSunTrailMaterial,
  darkSunTrail,
  darkSunTrailPointsGeometry,
  darkSunTrailPointsMaterial,
  darkSunTrailPointsCloud,
  enhanceDomeMaterialWithSunGlow,
  enhanceMoonMaterialWithPhase,
  setMoonMaterialPhase,
  createSunAuraTexture,
  createWalkerGuideLine,
  createDarkSunGroup,
  enhanceDarkSunMaterialWithSunMask,
  enhanceSunMaterialWithEclipseMask,
  createSunAuraSprite,
  createMoonAuraSprite,
  createSunRayTexture,
  createSunRayMesh,
  createOrbitTrack
} = setupScene({ canvas });

// Add constellations
const constellationApi = createConstellations();
scalableStage.add(constellationApi.group);

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
  moonBandDirection: 1,
  moonBandProgress: 0.12,
  moonSunOrbitOffsetRadians: Math.PI * 0.35,
  darkSunOrbitPhaseOffsetRadians: Math.PI,
  orbitDarkSunAngle: Math.PI,
  orbitMoonAngle: Math.PI * 0.35,
  orbitMode: "auto",
  orbitSeasonPhase: -Math.PI / 2,
  orbitSunAngle: 0,
  sunBandDirection: 1,
  sunBandProgress: 0.12
};

// Expose state for E2E testing
if (typeof window !== "undefined") {
  window.__simulationState = simulationState;
}

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
  stagePreEclipseBtn: document.getElementById("stage-pre-eclipse"),
  stagePreLunarEclipseBtn: document.getElementById("stage-pre-lunar-eclipse"),
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
  walkerSummaryEl,
  rocketSpaceportSelect,
  rocketTypeSelect,
  rocketLaunchBtn
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
  darkSunFullTrailGeometry,
  darkSunFullTrailPointsGeometry,
  darkSunTrailGeometry,
  darkSunTrailPointsGeometry,
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

let celestialTrackingCameraApi;

function focusCameraOnConstellation(entry) {
  if (walkerState.enabled) {
    return;
  }

  if (!entry) {
    celestialTrackingCameraApi?.clearTracking();
    cameraState.targetLookTarget.set(0, constants.SURFACE_Y * (5 / 6), 0);
    cameraState.targetTheta = -0.55;
    cameraState.theta = cameraState.targetTheta;
    cameraState.targetPhi = 1.12;
    cameraState.phi = cameraState.targetPhi;
    cameraState.targetRadius = constants.CAMERA_TOPDOWN_DEFAULT_RADIUS;
    cameraState.radius = cameraState.targetRadius;
    cameraApi.clampCamera();
    return;
  }

  const focus = entry.centroidWorldPoint ?? { x: 0, y: constants.SURFACE_Y * (5 / 6), z: 0 };
  const polarisAngle = THREE.MathUtils.euclideanModulo(Math.atan2(focus.x, -focus.z), Math.PI * 2);
  const frontTheta = Math.PI - polarisAngle;

  if (celestialTrackingCameraApi?.setCustomLookTarget) {
    celestialTrackingCameraApi.setCustomLookTarget(focus, { immediate: true });
  } else {
    cameraState.targetLookTarget.set(focus.x, focus.y, focus.z);
  }

  cameraState.targetTheta = frontTheta;
  cameraState.theta = cameraState.targetTheta;
  cameraState.targetPhi = 1.02;
  cameraState.phi = cameraState.targetPhi;
  cameraState.targetRadius = Math.min(
    constants.CAMERA_TOPDOWN_DEFAULT_RADIUS * 0.74,
    constants.CAMERA_TOPDOWN_MAX_RADIUS
  );
  cameraState.radius = cameraState.targetRadius;
  cameraApi.clampCamera();
}

const constellationTabApi = createConstellationTabController({
  i18n,
  constellationApi,
  onSelectionChange: focusCameraOnConstellation,
  ui: {
    constellationSelectEl,
    constellationMapEl,
    constellationDirectionEl,
    constellationRaEl,
    constellationDecEl,
    constellationHemisphereEl,
    constellationSegmentsEl,
    constellationStarsEl,
  },
});

i18n.subscribe(() => {
  constellationTabApi.refreshLocalizedUi();
});

constellationTabApi.initialize();

celestialTrackingCameraApi = createCelestialTrackingCameraController({
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

const rocketApi = createRocketController({
  scalableStage,
  constants
});


  const eclipseApi = createEclipseController({
    constants, i18n, ui, orbitSun, orbitDarkSun, observerSun, observerDarkSun, orbitSunBody,
    orbitDarkSunRim, orbitDarkSunBody, orbitSunHalo, scene, camera, stage, scalableStage, dome,
    dayNightOverlayMaterial, firstPersonSunRayGroup, firstPersonSunRayMeshes, simulationState,
    astronomyState, renderState, walkerState, cameraState, astronomyApi,
    cameraApi, celestialTrackingCameraApi, celestialControlState,
    getGeoFromProjectedPosition, orbitMoon, orbitMoonBody, observerMoon, observerMoonBody,
    getMoonPhase, solarEclipseToastTitleEl, solarEclipseToastCopyEl, solarEclipseToastEl, getBodyBandProgressStep, sunFullTrail, sunFullTrailPointsCloud, moonFullTrail, moonFullTrailPointsCloud, darkSunFullTrail, darkSunFullTrailPointsCloud, applyStaticTranslations, syncSeasonalEventButtonLabels, textureApi, magneticFieldApi, walkerApi, routeSimulationApi, syncPreparationPresentation: (...args) => celestialVisualsApi.syncPreparationPresentation(...args), observerSunBody, observerDarkSunBody, renderer, observerDarkSunRim, exitFirstPersonMode: () => celestialVisualsApi.exitFirstPersonMode(), realitySyncEl, realityLiveEl, setDemoMoonOrbitOffsetFromPhase, syncDemoMoonOrbitToSun, updateSunVisualEffects: (...args) => celestialVisualsApi.updateSunVisualEffects(...args)
  });
  const {
    createSolarEclipseWindowSolverState,
    getCurrentDarkSunRenderStateSnapshot,
    getDarkSunStageContactOffsetRadians,
    getProjectedDarkSunStageMetricsForOffsetRadians,
    getProjectedDarkSunStageMetricsForMirroredPhaseOffsetRadians,
    findDarkSunStagePreContactOffsetRadians,
    findMirroredDarkSunStageStartCandidate,
    getDarkSunStageRelativeOrbitOffsetRadians,
    updateDarkSunStageOrbit,
    updateDarkSunLunarStageOrbit,
    resetLunarStageState,
    getSolarEclipseToastStateLabelKey,
    syncSolarEclipseToastContent,
    setSolarEclipseToastVisibility,
    showSolarEclipseToast,
    predictUpcomingSolarEclipseWindowStartFrameCount,
    getSolarEclipseAnimationTargetFactor,
    updateSolarEclipseAnimationPacing,
    updateSolarEclipseEventFeedback,
    updateLunarEclipseEventFeedback,
    updateDarkSunMaskUniforms,
    solveSolarEclipseEventWindow,
    evaluateSolarEclipse,
    evaluateLunarEclipse,
    getSolarEclipseVisualProfile,
    getSolarEclipseDirection,
    getSolarEclipseEligibility,
    createSolarEclipseTriggerSunDisc,
    getSolarEclipseTriggerSunDisc,
    syncFullTrailVisibility,
    resetDarkSunStageState,
    stagePreEclipseScene,
    stagePreLunarEclipseScene,
    createDarkSunOcclusionMotionState,
    resetDarkSunOcclusionMotion,
    getWorldBodyRadius,
    getProjectedDisc,
    getExpandedProjectedDisc,
    usesSolarEclipsePresentationMask,
    getCircleOverlapCoverage,
    getCircleDistanceForCoverage,
    setGroupWorldPositionFromNdc,
    syncDarkSunGroupToPresentationDisc,
    updateSolarEclipsePresentationMaskState,
    getCircleOverlapArea,
    applyDarkSunOcclusionAlignment,
    applyDarkSunStageTransitPosition,
    getSolarEclipseLightScale,
    getSolarEclipsePhaseKey,
    getSolarEclipseStageLabelKey,
    getSolarEclipseStageProgress,
    stepValueToward,
    easeEclipseLightValue,
    getProjectedSolarEclipseMetrics,
    getSolarEclipseLaneCount,
    getSolarEclipseTierCap,
    syncDarkSunPresentation,
    getProjectedSolarEclipseMetricsFromStates,
    getNaturalPreEclipseCandidateScore,
    getNaturalPreEclipseVisibleOverlapScore,
    getWrappedAngularDistance,
    getNaturalPreEclipseOrbitAlignmentScore,
    getAdvancedBandState,
    inferStageSunBandDirection,
    findNaturalPreEclipseState,
    findNaturalPreEclipseAngleState,
    findNaturalPreEclipseAngleStateLegacy,
    solarEclipseWindowSolverState,
    solarEclipseEventState,
    solarEclipsePresentationMaskState,
    tempPreparationLookTarget,
    tempObserverNorthAxis,
    tempObserverEastAxis,
    tempObserverSkyOrigin,
    tempObserverSkyPoint,
    tempObserverRelative,
    tempDemoSunSourceWorld,
    tempDemoMoonSourceWorld,
    tempDemoDarkSunSourceWorld,
    tempDomeSunLocalPosition,
    tempSunWorldPosition,
    tempDarkSunWorldPosition,
    tempSunViewDirection,
    tempCameraForward,
    tempCameraRight,
    tempProjectedCenter,
    tempProjectedEdge,
    tempProjectedOffset,
    tempBodyWorldScale,
    tempProjectedSunNdc,
    tempProjectedDarkSunNdc,
    tempDarkSunPhaseOrigin,
    tempSunPhaseDirection,
    tempDarkSunPhaseDirection,
    tempProjectedTargetWorld,
    tempDarkSunLocalPosition,
    tempDarkSunRawOffsetNdc,
    tempDarkSunDesiredOffsetNdc,
    tempDarkSunMaskViewport,
    tempSolarEclipseViewport,
    tempSolarEclipseMaskCenterNdc,
    tempSolarEclipseDirectionNdc,
    darkSunOcclusionState
  } = eclipseApi;


  const celestialVisualsApi = createCelestialVisualsController({
    constants, i18n, ui, orbitSun, orbitDarkSun, observerSun, observerDarkSun, orbitSunBody,
    orbitDarkSunRim, orbitDarkSunBody, orbitSunHalo, orbitSunAureole, orbitSunCorona, orbitMoonBody,
    orbitMoonHalo, orbitMoonCoolGlow, orbitMoonCorona, orbitMoonAureole, orbitMoonWarmFringe,
    orbitMoonLight, observerMoonBody, scene, firstPersonScene, camera, stage, scalableStage, dome,
    dayNightOverlayMaterial, firstPersonSunRayGroup, firstPersonSunRayMeshes, simulationState,
    astronomyState, renderState, walkerState, movementState, astronomyApi, walkerApi,
    ambient: firstPersonAmbient, keyLight: firstPersonKeyLight, rimLight: firstPersonRimLight,
    renderer, firstPersonPrepEl, firstPersonPrepTitleEl, firstPersonPrepCopyEl, firstPersonPrepBarFillEl,
    firstPersonPrepProgressEl, resetDarkSunOcclusionMotion: eclipseApi.resetDarkSunOcclusionMotion,
    darkSunOcclusionState, getSolarAltitudeFactor, setMoonMaterialPhase, tempPreparationLookTarget, stopDrag: () => {},
    easeEclipseLightValue: eclipseApi.easeEclipseLightValue,
    getSolarEclipsePhaseKey: eclipseApi.getSolarEclipsePhaseKey,
    getSolarEclipseVisualProfile: eclipseApi.getSolarEclipseVisualProfile,
    getSolarEclipseLightScale: eclipseApi.getSolarEclipseLightScale, observerSunBody, observerSunHalo, observerSunLight, orbitSunLight, tempSunWorldPosition, tempDomeSunLocalPosition, tempObserverNorthAxis, tempObserverEastAxis, tempObserverSkyOrigin, tempObserverSkyPoint, tempObserverRelative, observerMoonHalo, observerMoonCoolGlow, observerMoonCorona, observerMoonAureole, observerMoonWarmFringe, observerMoonLight, sunFullTrail, celestialControlState, sunFullTrailPointsCloud, sunTrail, sunTrailPointsCloud, moonFullTrail, moonFullTrailPointsCloud, moonTrail, moonTrailPointsCloud, getGeoFromProjectedPosition, tempDemoSunSourceWorld, tempDemoDarkSunSourceWorld, tempDemoMoonSourceWorld, observerDarkSunBody, observerDarkSunRim, tempSunViewDirection, tempCameraForward, observerMoon, orbitMoon
  });
  const {
    updateSunVisualEffects,
    syncPreparationPresentation,
    updateRenderState,
    getObserverSkyAxes,
    getObserverSkyDistance,
    applyCelestialAltitudeOffset,
    positionBodyInObserverSky,
    getHorizontalFromWorldPosition,
    getMoonRenderState,
    syncMoonMaterialPresentation,
    syncMoonLightPresentation,
    updateObserverCelestialPerspective,
    configurePreparationCamera,
    resetMovementState,
    exitFirstPersonMode,
    enterFirstPersonMode
  } = celestialVisualsApi;


  setupInputHandlers({
    constants, canvas, cameraApi, walkerApi, celestialTrackingCameraApi, magneticFieldApi,
    routeSimulationApi, textureApi, astronomyApi, rocketApi, ui, renderState, walkerState, cameraState,
    movementState, simulationState, astronomyState, celestialControlState, skyTexture, scene,
    setControlTab, createSolarEclipseState: eclipseApi.createSolarEclipseState, syncFullTrailVisibility: eclipseApi.syncFullTrailVisibility,
    resetDarkSunStageState: eclipseApi.resetDarkSunStageState, showSolarEclipseToast: eclipseApi.showSolarEclipseToast,
    resetDarkSunOcclusionMotion: eclipseApi.resetDarkSunOcclusionMotion, darkSunOcclusionState,
    controlTabButtons, languageToggleEl, i18n, uploadInput, resetButton,
    exitFirstPersonMode, enterFirstPersonMode, walkerModeEl, resetWalkerButton,
    routeSelectEl, routeSpeedEl, celestialTrailLengthEl, celestialSpeedEl,
    celestialFullTrailEl, routePlaybackButton, routeResetButton, realitySyncEl,
    realityLiveEl, observationTimeEl, applyObservationTimeButton, setCurrentTimeButton,
    dayNightOverlayEl, dayNightState, getGeoFromProjectedPosition: astronomyApi.getGeoFromProjectedPosition, orbitSun,
    analemmaOverlayEl, analemmaState, magneticFieldOverlayEl, magneticFieldState,
    darkSunDebugEl, getCurrentUiSnapshot: eclipseApi.getCurrentUiSnapshot,
    syncDarkSunPresentation: eclipseApi.syncDarkSunPresentation,
    stagePreEclipseButton, stagePreEclipseScene: eclipseApi.stagePreEclipseScene,
    stagePreLunarEclipseButton, stagePreLunarEclipseScene: eclipseApi.stagePreLunarEclipseScene,
    skyAnalemmaOverlayEl, skyAnalemmaState, orbitModeButtons, cameraTrackButtons,
    seasonalYearEl, seasonalEventButtons, setDemoMoonOrbitOffsetFromPhase
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

function setDemoMoonOrbitOffsetFromPhase(dateMs = simulationState.demoPhaseDateMs) {
  const moonPhase = getMoonPhase(new Date(dateMs));
  if (!Number.isFinite(moonPhase?.phaseAngleRadians)) {
    return;
  }
  simulationState.moonSunOrbitOffsetRadians = moonPhase.phaseAngleRadians;
}

function syncDemoMoonOrbitToSun() {
  simulationState.orbitMoonAngle =
    simulationState.orbitSunAngle + (simulationState.moonSunOrbitOffsetRadians ?? 0);

  // Derive the 4-season altitude (band progress) from its own angle
  // so the moon mathematically rides its own unique 12-turn coil!
  const moonTurns = Math.max(magneticFieldApi.getCoilOrbitProfile("moon").turns ?? 12, 1);
  const totalCoilRadians = moonTurns * 2 * Math.PI;
  const absoluteAngle = Math.abs(simulationState.orbitMoonAngle);
  const phaseInCycle = absoluteAngle % (2 * totalCoilRadians);
  
  if (phaseInCycle <= totalCoilRadians) {
    simulationState.moonBandProgress = phaseInCycle / totalCoilRadians;
    simulationState.moonBandDirection = simulationState.orbitMoonAngle >= 0 ? 1 : -1;
  } else {
    simulationState.moonBandProgress = 2.0 - (phaseInCycle / totalCoilRadians);
    simulationState.moonBandDirection = simulationState.orbitMoonAngle >= 0 ? -1 : 1;
  }
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
    const isSolarStagingActive = simulationState.darkSunStageAltitudeLock;
    const isLunarStagingActive = simulationState.darkSunLunarStageLock;
    let stageSpeedFactor = 1;
    if (isSolarStagingActive && !astronomyState.enabled) {
      stageSpeedFactor = updateDarkSunStageOrbit(deltaSeconds);
    } else if (isLunarStagingActive && !astronomyState.enabled) {
      stageSpeedFactor = updateDarkSunLunarStageOrbit(deltaSeconds);
    }
    const eclipseStageActive = stageSpeedFactor !== false;
    let activeSpeedFactor = eclipseStageActive ? stageSpeedFactor : eclipseAnimationSpeedFactor;

    // Lunar eclipse natural slowdown effect
    // Slow down heavily when moon and dark sun approach each other so the
    // blood-moon tint has enough frames to visually register.
    if (!astronomyState.enabled && !eclipseStageActive) {
      const moonAngle = simulationState.orbitMoonAngle;
      const darkSunAngle = simulationState.orbitDarkSunAngle;
      if (Number.isFinite(moonAngle) && Number.isFinite(darkSunAngle)) {
        const offsetRadians = eclipseApi.getWrappedAngularDistance(darkSunAngle, moonAngle);
        const distance = Math.abs(offsetRadians);
        if (distance < 0.35) {
          const lunarSlowdown = THREE.MathUtils.lerp(
            constants.DARK_SUN_ECLIPSE_TRANSIT_SLOW_FACTOR * 0.25,
            1.0,
            THREE.MathUtils.clamp(distance / 0.35, 0, 1)
          );
          activeSpeedFactor = Math.min(activeSpeedFactor, lunarSlowdown);
        }
      }
    }

    const speedMultiplier = celestialControlState.speedMultiplier * activeSpeedFactor;
    simulationState.orbitSunAngle += ORBIT_SUN_SPEED * speedMultiplier;
    simulationState.orbitMoonAngle += ORBIT_MOON_SPEED * speedMultiplier;
    // Decoupled dark sun: advances directly opposite the sun
    // Skip natural angle update when lunar stage is driving the dark sun's position
    if (!isLunarStagingActive) {
      simulationState.orbitDarkSunAngle -= ORBIT_DARK_SUN_SPEED * speedMultiplier;
    }

    if (simulationState.orbitMode === "auto") {
      advanceBandProgress("sunBandProgress", "sunBandDirection", getBodyBandProgressStep("sun") * speedMultiplier);
      // Advance moon band progress using its own coil geometry, scaled strictly by the moon's angular speed ratio.
      // This guarantees the moon perfectly traces its own 12-turn coil spiral.
      const moonRatio = ORBIT_MOON_SPEED / ORBIT_SUN_SPEED;
      advanceBandProgress("moonBandProgress", "moonBandDirection", getBodyBandProgressStep("moon") * moonRatio * speedMultiplier);
      
      // Update dark sun band progress symmetrically to sun
      const darkSunRatio = ORBIT_DARK_SUN_SPEED / ORBIT_SUN_SPEED;
      advanceBandProgress("darkSunBandProgress", "darkSunBandDirection", getBodyBandProgressStep("sun") * darkSunRatio * speedMultiplier);
    }
    // 1 full sun rotation (2?) = 1 day (86,400,000 ms)
    const demoDaysPerFrame = (ORBIT_SUN_SPEED * speedMultiplier) / (2 * Math.PI);
    simulationState.demoPhaseDateMs += demoDaysPerFrame * 86_400_000;
    projectionDate = new Date(simulationState.demoPhaseDateMs);

    const sunRenderState = astronomyApi.getSunRenderState({
      orbitAngleRadians: simulationState.orbitSunAngle,
      orbitMode: simulationState.orbitMode,
      progress: simulationState.sunBandProgress,
      source: "demo"
    });
    orbitSun.position.copy(sunRenderState.position);

    const darkSunRenderState = astronomyApi.getDarkSunRenderState({
      direction: simulationState.darkSunBandDirection,
      orbitAngleRadians: simulationState.orbitDarkSunAngle,
      orbitMode: simulationState.orbitMode,
      progress: simulationState.darkSunBandProgress,
      source: "demo",
      useExplicitOrbit: true
    });

    if (simulationState.darkSunStageAltitudeLock) {
      applyDarkSunStageTransitPosition({
        sunBody: orbitSunBody,
        sunGroup: orbitSun,
        sunRadius: ORBIT_SUN_SIZE,
        darkSunBody: orbitDarkSunBody,
        darkSunGroup: orbitDarkSun,
        darkSunRadius: ORBIT_DARK_SUN_SIZE
      });
    } else {
      orbitDarkSun.position.copy(darkSunRenderState.position);
    }

    astronomyApi.updateSunTrail();
    astronomyApi.updateDarkSunTrail();
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
  rocketApi.update(deltaSeconds);
  // ── 로켓 텔레메트리 UI 업데이트 ──
  (function updateRocketTelemetry() {
    const panel = document.getElementById('rocket-telemetry-panel');
    if (!panel) return;
    const tel = rocketApi.getTelemetry();
    if (!tel) { panel.style.display = 'none'; return; }
    panel.style.display = '';
    const STATE_KO = {
      STAGE1: '1단 연소', PITCHOVER: '자세 제어', SEPARATION: '단 분리',
      STAGE2: '2단 점화', SCRAPE: '궁창 접촉', FALL: '낙하', LAUNCH: '발사'
    };
    document.getElementById('tel-state').textContent    = STATE_KO[tel.state] ?? tel.state;
    document.getElementById('tel-alt').textContent      = tel.altitude + '%';
    document.getElementById('tel-speed').textContent    = tel.speed + ' u/s';
    document.getElementById('tel-stage-t').textContent  = tel.stageTimer + 's';
    document.getElementById('tel-scrape-t').textContent = tel.state === 'SCRAPE' ? tel.scrapeTimer + 's' : '—';
    document.getElementById('tel-debris').textContent   = tel.debrisCount + '개';
  })();
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
    evaluateLunarEclipse(snapshot);
    updateObserverCelestialPerspective(snapshot);
    
    // Global trap for playwright
    window.__E2E_SNAPSHOT = { 
        moonPos: snapshot.moonPosition, 
        darkSunPos: snapshot.darkSunRenderPosition 
    };

    evaluateSolarEclipse(snapshot, deltaSeconds);
    
    // Automatically engage the 5-stage eclipse control during natural orbit
    if (
      !astronomyState.enabled && 
      !simulationState.darkSunStageAltitudeLock &&
      snapshot.solarEclipse?.stageKey === "approach"
    ) {
      const sunAngle = simulationState.orbitSunAngle;
      const darkSunAngle = simulationState.orbitDarkSunAngle;
      const offsetRadians = eclipseApi.getWrappedAngularDistance(
        darkSunAngle, 
        sunAngle
      );
      
      const currentSunRenderState = astronomyApi?.getSunRenderState({
        orbitAngleRadians: simulationState.orbitSunAngle,
        orbitMode: simulationState.orbitMode,
        progress: simulationState.sunBandProgress,
        source: "demo"
      }) ?? null;
      
      const contactOffsetRadians = eclipseApi.getDarkSunStageContactOffsetRadians(currentSunRenderState);
      const transit = eclipseApi.getDarkSunStageTransitForOffsetRadians(offsetRadians, contactOffsetRadians);
      
      simulationState.darkSunStageTransit = transit;
      // Do not force altitude lock in natural orbit as requested by user
      simulationState.darkSunStageAltitudeLock = false;
      simulationState.darkSunStageHasEclipsed = false;
    }

    if (window.__E2E_MOCK_SOLAR_ECLIPSE) {
      snapshot.solarEclipse = Object.assign(createSolarEclipseState(), window.__E2E_MOCK_SOLAR_ECLIPSE);
      astronomyApi.syncSolarEclipseUi(snapshot.solarEclipse);
      eclipseApi.syncDarkSunPresentation?.(snapshot.solarEclipse);
    }

    updateDarkSunMaskUniforms(snapshot.solarEclipse);
    updateSolarEclipseEventFeedback(snapshot.solarEclipse, performance.now());
    updateLunarEclipseEventFeedback(snapshot, performance.now());
    firstPersonWorldApi.update(snapshot);
  } else {
    updateDarkSunMaskUniforms(createSolarEclipseState());
    updateSolarEclipseEventFeedback(createSolarEclipseState());
    updateLunarEclipseEventFeedback(null);
    firstPersonWorldApi.update(snapshot);
  }

  if (snapshot) {
    const sunRadius = Math.hypot(orbitSun.position.x, orbitSun.position.z);
    const sunRadiusRatio = THREE.MathUtils.clamp(
      (sunRadius - constants.TROPIC_CANCER_RADIUS) / 
      (constants.TROPIC_CAPRICORN_RADIUS - constants.TROPIC_CANCER_RADIUS),
      0, 1
    );
    const sunScale = THREE.MathUtils.lerp(constants.CELESTIAL_PERSPECTIVE_SCALE_MIN, constants.CELESTIAL_PERSPECTIVE_SCALE_MAX, sunRadiusRatio);
    orbitSun.scale.setScalar(sunScale);

    const darkSunRadius = Math.hypot(orbitDarkSun.position.x, orbitDarkSun.position.z);
    const darkSunRadiusRatio = THREE.MathUtils.clamp(
      (darkSunRadius - constants.TROPIC_CANCER_RADIUS) / 
      (constants.TROPIC_CAPRICORN_RADIUS - constants.TROPIC_CANCER_RADIUS),
      0, 1
    );
    const darkSunScale = THREE.MathUtils.lerp(constants.CELESTIAL_PERSPECTIVE_SCALE_MIN, constants.CELESTIAL_PERSPECTIVE_SCALE_MAX, darkSunRadiusRatio);
    orbitDarkSun.scale.setScalar(darkSunScale);

    const moonRadius = Math.hypot(orbitMoon.position.x, orbitMoon.position.z);
    const moonRadiusRatio = THREE.MathUtils.clamp(
      (moonRadius - constants.TROPIC_CANCER_RADIUS) / 
      (constants.TROPIC_CAPRICORN_RADIUS - constants.TROPIC_CANCER_RADIUS),
      0, 1
    );
    const moonScale = THREE.MathUtils.lerp(constants.CELESTIAL_PERSPECTIVE_SCALE_MIN, constants.CELESTIAL_PERSPECTIVE_SCALE_MAX, moonRadiusRatio);
    orbitMoon.scale.setScalar(moonScale);
  }

  updateSunVisualEffects(snapshot);
  magneticFieldApi.update(performance.now());
  
  if (walkerState.enabled) {
    renderer.autoClear = false;
    renderer.clear();
    renderer.render(scene, camera);
    renderer.clearDepth();
    renderer.render(firstPersonScene, camera);
  } else {
    renderer.autoClear = true;
    renderer.render(scene, camera);
  }
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

