import * as THREE from "./vendor/three.module.js";
import {
  getGeoFromProjectedPosition,
  projectedRadiusFromLatitude
} from "./modules/geo-utils.js";
import {
  createSolarEclipseState,
  getMoonPhase,
  getSeasonalEclipticPhase,
  getSeasonalEclipticAngle,
  getZodiacAgeOffsetRadians,
  getSolarAltitudeFactor,
} from "./modules/astronomy-utils.js?v=20260326-seasonal-ecliptic1";
import { createAstronomyController } from "./modules/astronomy-controller.js?v=20260325-eclipse-selector1";
import { createCameraController } from "./modules/camera-controller.js?v=20260406-globecam1";
import { createCelestialTrackingCameraController } from "./modules/celestial-tracking-camera-controller.js?v=20260320-constellation-precession1";
import { createFirstPersonWorldController } from "./modules/first-person-world-controller.js?v=20260312-darksun-eclipse1";
import { createI18n } from "./modules/i18n.js?v=20260327-mobilehud1";
import { createMagneticFieldController } from "./modules/magnetic-field-controller.js?v=20260314-magnetic-pinecone3";
import { createRouteSimulationController } from "./modules/route-simulation-controller.js?v=20260406-mainremote5";
import { createTextureManager } from "./modules/texture-manager.js?v=20260311-gpu-daynight";
import { createWalkerController } from "./modules/walker-controller.js?v=20260324-moon-cycle28";

import * as constants from "./modules/constants.js";
import { createEclipseController } from "./modules/eclipse-controller.js?v=20260320-reality-eclipse-sync2";
import { createCelestialVisualsController } from "./modules/celestial-visuals-controller.js?v=20260321-sunset5";
import { createConstellationTabController } from "./modules/constellation-tab-controller.js?v=20260320-constellation-precession1";
import { setupInputHandlers } from "./modules/input-handler.js?v=20260405-mainroutes1";
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

const APP_MODE = window.__APP_MODE__ === true
  || new URLSearchParams(window?.location?.search || "").get("app") === "1";

if (APP_MODE) {
  const viewportMeta = document.querySelector('meta[name="viewport"]');
  if (viewportMeta) {
    viewportMeta.setAttribute(
      "content",
      "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
    );
  }
}

const appShellEl = document.querySelector(".app-shell");
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
const resetButton = document.getElementById("reset-camera");
const summaryUtilitySlotEl = document.getElementById("summary-utility-slot");
const languageToggleRowEl = document.getElementById("language-toggle-row");
const summaryButtonRowEl = document.getElementById("summary-button-row");
const cameraPresetRowEl = document.getElementById("camera-preset-row");
const cameraViewToggleEl = document.getElementById("camera-view-toggle");
const cameraViewModeTopEl = document.getElementById("camera-view-mode-top");
const cameraViewModeAngleEl = document.getElementById("camera-view-mode-angle");
const topbarStatusHomeEl = document.getElementById("topbar-status-home");
const topbarStatusEl = document.getElementById("topbar-status");
const topbarNavSlotEl = document.getElementById("topbar-nav-slot");
const topbarQuickSlotEl = document.getElementById("topbar-quick-slot");
const topbarUtilitySlotEl = document.getElementById("topbar-utility-slot");
const topbarLayoutHomeEl = document.getElementById("topbar-layout-home");
const topbarHelpHomeEl = document.getElementById("topbar-help-home");
const topbarBrandSettingsSlotEl = document.getElementById("topbar-brand-settings-slot");
const topbarBrandNavSlotEl = document.getElementById("topbar-brand-nav-slot");
const topbarSettingsHomeEl = document.getElementById("topbar-settings-home");
const settingsAnchorEl = document.getElementById("settings-anchor");
const settingsToggleButtonEl = document.getElementById("settings-toggle");
const settingsPopoverEl = document.getElementById("settings-popover");
const settingsBackdropEl = document.getElementById("settings-backdrop");
const privacyChoicesButtonEl = document.getElementById("privacy-choices-button");
const settingsPrivacyGroupEl = document.getElementById("settings-privacy-group");
const settingsPrimarySlotEl = document.getElementById("settings-primary-slot");
const settingsStatusSlotEl = document.getElementById("settings-status-slot");
const detailTabsHomeEl = document.getElementById("detail-tabs-home");
const detailTabsEl = document.getElementById("detail-tabs");
const detailPanelEl = document.querySelector(".detail-panel");
const detailPanelShellEl = document.querySelector(".detail-panel-shell");
const helpOpenButtonEl = document.getElementById("help-open");
const helpModalLayerEl = document.getElementById("help-modal-layer");
const helpModalBackdropEl = document.getElementById("help-modal-backdrop");
const helpModalEl = document.getElementById("help-modal");
const helpCloseButtonEl = document.getElementById("help-close");
const layoutSwitchEl = document.getElementById("layout-switch");
const layoutModeButtons = [...document.querySelectorAll("[data-layout-mode-switch]")];
const hudSeasonLatitudeChipEl = document.getElementById("hud-season-latitude-chip");
const hudSeasonStateChipEl = document.getElementById("hud-season-state-chip");
const hudTimeChipEl = document.getElementById("hud-time-chip");
const hudSystemChipEl = document.getElementById("hud-system-chip");
const hudSideRailEl = document.getElementById("hud-side-rail");
const hudSideCardEl = document.getElementById("hud-side-card");
const hudSideCardTitleEl = document.getElementById("hud-side-card-title");
const hudSideCardSlotEl = document.getElementById("hud-side-card-slot");
const rocketSpaceportSelect = document.getElementById("rocket-spaceport-select");
const rocketMissionProfileSelect = document.getElementById("rocket-mission-profile-select");
const rocketTypeSelect      = document.getElementById("rocket-type-select");
const rocketStandbyBtn      = document.getElementById("rocket-standby-btn");
const rocketLaunchBtn       = document.getElementById("rocket-launch-btn");
const rocketCameraSummaryEl = document.getElementById("rocket-camera-summary");
const controlTabButtons = [...document.querySelectorAll("[data-control-tab]")];
const cameraPresetButtons = [...document.querySelectorAll("[data-camera-preset]")];
const controlTabPanels = [...document.querySelectorAll("[data-control-panel]")];
const hudSubtabButtons = [...document.querySelectorAll("[data-hud-panel-tab]")];
const translatableTextEls = [...document.querySelectorAll("[data-i18n]")];
const translatableHtmlEls = [...document.querySelectorAll("[data-i18n-html]")];
const orbitLabelEl = document.getElementById("orbit-label");
const celestialTrailLengthEl = document.getElementById("celestial-trail-length");
const celestialTrailLengthValueEl = document.getElementById("celestial-trail-length-value");
const celestialSpeedEl = document.getElementById("celestial-speed");
const celestialSpeedPresetButtons = [...document.querySelectorAll("[data-celestial-speed-preset]")];
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
const realitySyncToggleTextEl = document.getElementById("reality-sync-toggle-text");
const realityLiveEl = document.getElementById("reality-live");
const observationTimeEl = document.getElementById("observation-time");
const observationMinusHourButton = document.getElementById("observation-minus-hour");
const observationPlusHourButton = document.getElementById("observation-plus-hour");
const observationMinusMinuteButton = document.getElementById("observation-minus-minute");
const observationPlusMinuteButton = document.getElementById("observation-plus-minute");
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
const moonPhasePanelHomeEl = document.getElementById("moon-phase-panel-home");
const moonPhasePanelEl = document.getElementById("moon-phase-panel");
const solarEclipsePanelHomeEl = document.getElementById("solar-eclipse-panel-home");
const solarEclipsePanelSlotEl = document.getElementById("solar-eclipse-panel-slot");
const solarEclipsePanelEl = document.getElementById("solar-eclipse-panel");
const eclipseCatalogSourceEl = document.getElementById("eclipse-catalog-source");
const eclipseUploadFieldEl = document.getElementById("eclipse-upload-field");
const eclipseCatalogUploadEl = document.getElementById("eclipse-catalog-upload");
const eclipseCatalogStatusEl = document.getElementById("eclipse-catalog-status");
const eclipseKindSelectEl = document.getElementById("eclipse-kind-select");
const eclipseYearSelectEl = document.getElementById("eclipse-year-select");
const eclipseEventSelectEl = document.getElementById("eclipse-event-select");
const eclipseTimePointSelectEl = document.getElementById("eclipse-timepoint-select");
const selectedEclipseKindEl = document.getElementById("selected-eclipse-kind");
const selectedEclipseTypeEl = document.getElementById("selected-eclipse-type");
const selectedEclipseLocalEl = document.getElementById("selected-eclipse-local");
const selectedEclipseUtcEl = document.getElementById("selected-eclipse-utc");
const selectedEclipseMagnitudeEl = document.getElementById("selected-eclipse-magnitude");
const selectedEclipseSourceEl = document.getElementById("selected-eclipse-source");
const selectedEclipseSummaryEl = document.getElementById("selected-eclipse-summary");
const previewSelectedEclipseButton = document.getElementById("preview-selected-eclipse");
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
const routeModeSelectEl = document.getElementById("route-mode-select");
const routeRecommendedPanelEl = document.getElementById("route-recommended-panel");
const routeAdvancedPanelEl = document.getElementById("route-advanced-panel");
const routeOriginContinentEl = document.getElementById("route-origin-continent");
const routeDestinationContinentEl = document.getElementById("route-destination-continent");
const routeRecommendedRouteEl = document.getElementById("route-recommended-route");
const routeOriginCountryEl = document.getElementById("route-origin-country");
const routeOriginAirportEl = document.getElementById("route-origin-airport");
const routeDestinationCountryEl = document.getElementById("route-destination-country");
const routeDestinationAirportEl = document.getElementById("route-destination-airport");
const routeDirectOriginCodeEl = document.getElementById("route-direct-origin-code");
const routeDirectDestinationCodeEl = document.getElementById("route-direct-destination-code");
const routeDirectAddLayoverButtonEl = document.getElementById("route-direct-add-layover");
const routeDirectLayoverRowEls = [...document.querySelectorAll("[data-route-direct-layover-row]")];
const routeDirectLayoverInputEls = [...document.querySelectorAll("[data-route-direct-layover-input]")];
const routeDirectRemoveLayoverButtons = [...document.querySelectorAll("[data-route-direct-remove-layover]")];
const routeSpeedEl = document.getElementById("route-speed");
const routeSpeedValueEl = document.getElementById("route-speed-value");
const routePlaybackButton = document.getElementById("route-playback");
const routeResetButton = document.getElementById("route-reset");
const routeTrackCameraButtonEl = document.getElementById("route-track-camera");
const routeSummaryEl = document.getElementById("route-summary");
const routeLegEl = document.getElementById("route-leg");
const routeAircraftEl = document.getElementById("route-aircraft");
const routeOriginEl = document.getElementById("route-origin");
const routeDestinationEl = document.getElementById("route-destination");
const routeCountriesEl = document.getElementById("route-countries");
const routeLayoversEl = document.getElementById("route-layovers");
const routeDurationEl = document.getElementById("route-duration");
const routeProgressEl = document.getElementById("route-progress");
const routeGeoSummaryEl = document.getElementById("route-geo-summary");
const constellationVisibilityToggleEl = document.getElementById("constellation-visibility-toggle");
const constellationVisibilityTextEl = document.getElementById("constellation-visibility-text");
const constellationLineVisibilityToggleEl = document.getElementById("constellation-line-visibility-toggle");
const constellationLineVisibilityTextEl = document.getElementById("constellation-line-visibility-text");
const zodiacWheelToggleEl = document.getElementById("zodiac-wheel-toggle");
const zodiacWheelTextEl = document.getElementById("zodiac-wheel-text");
const constellationSelectEl = document.getElementById("constellation-select");
const constellationMapHomeEl = document.getElementById("constellation-map-home");
const constellationMapWrapEl = document.getElementById("constellation-map-wrap");
const constellationMapEl = document.getElementById("constellation-map");
const constellationDirectionEl = document.getElementById("constellation-direction");
const constellationRaEl = document.getElementById("constellation-ra");
const constellationDecEl = document.getElementById("constellation-dec");
const constellationHemisphereEl = document.getElementById("constellation-hemisphere");
const constellationSegmentsEl = document.getElementById("constellation-segments");
const constellationStarsEl = document.getElementById("constellation-stars");
const zodiacAgeHomeEl = document.getElementById("zodiac-age-home");
const zodiacAgeViewWrapEl = document.getElementById("zodiac-age-view-wrap");
const zodiacAgeViewEl = document.getElementById("zodiac-age-view");
const zodiacAgeSummaryEl = document.getElementById("zodiac-age-summary");
const zodiacCurrentAgeEl = document.getElementById("zodiac-current-age");
const zodiacCurrentTropicalEl = document.getElementById("zodiac-current-tropical");
const zodiacAgeOffsetEl = document.getElementById("zodiac-sidereal-offset");
const zodiacAgeCycleEl = document.getElementById("zodiac-age-cycle");
const zodiacObservationDateEl = document.getElementById("zodiac-observation-date");
const i18n = createI18n();
const LAYOUT_STORAGE_KEY = "flat-earth-layout-mode";
const MOBILE_LAYOUT_BREAKPOINT = 1080;
const TAB_SWIPE_THRESHOLD_X = 48;
const TAB_SWIPE_MAX_DRIFT_Y = 24;
const TAB_ORDER_FALLBACK = ["astronomy", "routes", "constellations", "rockets"];
const HUD_PANEL_SECTION_DEFAULTS = {
  astronomy: "time",
  routes: "playback",
  constellations: "controls",
  rockets: "launch"
};
const HUD_SIDE_CARD_CONFIG = {
  astronomy: {
    home: moonPhasePanelHomeEl,
    node: moonPhasePanelEl,
    titleKey: "moonPhasePanelTitle"
  },
  constellations: {
    home: constellationMapHomeEl,
    node: constellationMapWrapEl,
    titleKey: "constellationMapTitle",
    sections: {
      zodiac: {
        home: zodiacAgeHomeEl,
        node: zodiacAgeViewWrapEl,
        titleKey: "zodiacAgeViewTitle"
      }
    }
  }
};
const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])"
].join(", ");

let helpModalOpen = false;
let settingsPanelOpen = false;
let preferredLayoutMode = getInitialLayoutMode();
let currentLayoutMode = "hud";
let currentControlTab = controlTabButtons.find((button) => button.classList.contains("active"))?.dataset.controlTab ?? "astronomy";
let lastFocusedBeforeHelpModal = null;
let lastFocusedBeforeSettingsPanel = null;
const hudPanelSectionState = { ...HUD_PANEL_SECTION_DEFAULTS };

function getInitialLayoutMode() {
  try {
    const storedLayoutMode = window.localStorage.getItem(LAYOUT_STORAGE_KEY);
    if (storedLayoutMode === "hud" || storedLayoutMode === "classic") {
      return storedLayoutMode;
    }
  } catch {}

  return "hud";
}

function moveNodeToSlot(node, slot) {
  if (!node || !slot || node.parentElement === slot) {
    return;
  }

  slot.appendChild(node);
}

function isMobileViewport() {
  if (typeof window.matchMedia === "function") {
    return window.matchMedia(`(max-width: ${MOBILE_LAYOUT_BREAKPOINT}px)`).matches;
  }

  return window.innerWidth <= MOBILE_LAYOUT_BREAKPOINT;
}

function syncSummaryUtilitySlotVisibility() {
  if (!summaryUtilitySlotEl) {
    return;
  }

  summaryUtilitySlotEl.hidden = summaryUtilitySlotEl.childElementCount === 0;
}

function syncLayoutAnchors(layoutMode) {
  const utilitySlotTarget = layoutMode === "hud" ? topbarUtilitySlotEl : summaryUtilitySlotEl;
  const cameraSlotTarget = layoutMode === "hud" ? topbarQuickSlotEl : summaryUtilitySlotEl;
  moveNodeToSlot(languageToggleRowEl, utilitySlotTarget);
  moveNodeToSlot(summaryButtonRowEl, utilitySlotTarget);
  moveNodeToSlot(cameraPresetRowEl, cameraSlotTarget);

  if (layoutMode === "hud") {
    moveNodeToSlot(detailTabsEl, topbarNavSlotEl);
    syncSummaryUtilitySlotVisibility();
    return;
  }

  moveNodeToSlot(detailTabsEl, detailTabsHomeEl);
  syncSummaryUtilitySlotVisibility();
}

function syncResponsiveTopbarAnchors() {
  const useMobileSettingsLayout = isMobileViewport();

  if (useMobileSettingsLayout) {
    moveNodeToSlot(layoutSwitchEl, settingsPrimarySlotEl);
    moveNodeToSlot(helpOpenButtonEl, settingsPrimarySlotEl);
    moveNodeToSlot(topbarStatusEl, settingsStatusSlotEl);
    moveNodeToSlot(settingsAnchorEl, topbarBrandSettingsSlotEl);
    moveNodeToSlot(detailTabsEl, topbarBrandNavSlotEl || topbarNavSlotEl);
    moveNodeToSlot(settingsPopoverEl, appShellEl);
    return;
  }

  moveNodeToSlot(layoutSwitchEl, topbarLayoutHomeEl);
  moveNodeToSlot(helpOpenButtonEl, topbarHelpHomeEl);
  moveNodeToSlot(topbarStatusEl, topbarStatusHomeEl);
  moveNodeToSlot(settingsAnchorEl, topbarSettingsHomeEl);
  moveNodeToSlot(detailTabsEl, currentLayoutMode === "hud" ? topbarNavSlotEl : detailTabsHomeEl);
  moveNodeToSlot(settingsPopoverEl, settingsAnchorEl);
}

function syncHudMovablePanels() {
  const eclipseTargetSlot = currentLayoutMode === "hud"
    ? solarEclipsePanelSlotEl
    : solarEclipsePanelHomeEl;

  moveNodeToSlot(solarEclipsePanelEl, eclipseTargetSlot);
}

function syncHudDetailPanelVerticalClearance() {
  const rootStyle = document.documentElement?.style;
  if (!rootStyle) {
    return;
  }

  if (!isMobileViewport() || currentLayoutMode !== "hud" || !detailPanelShellEl || !cameraPresetRowEl) {
    rootStyle.setProperty("--hud-compact-mobile-detail-max-height-dynamic", "9999px");
    return;
  }

  const viewportHeight = Math.max(window.innerHeight || 0, 1);
  const cameraRowRect = cameraPresetRowEl.getBoundingClientRect();
  const shellStyle = window.getComputedStyle(detailPanelShellEl);
  const shellBottom = Math.max(Number.parseFloat(shellStyle.bottom) || 0, 0);
  const topSafetyGap = 12;
  const topBoundary = cameraRowRect.bottom + topSafetyGap;
  const availableHeight = Math.max(viewportHeight - shellBottom - topBoundary, 180);
  rootStyle.setProperty(
    "--hud-compact-mobile-detail-max-height-dynamic",
    `${Math.floor(availableHeight)}px`
  );
}

function syncHudSideCard() {
  const allCardConfigs = [];
  for (const config of Object.values(HUD_SIDE_CARD_CONFIG)) {
    allCardConfigs.push(config);
    for (const sectionConfig of Object.values(config.sections ?? {})) {
      allCardConfigs.push(sectionConfig);
    }
  }

  for (const config of allCardConfigs) {
    moveNodeToSlot(config.node, config.home);
  }

  const isDesktopHud = currentLayoutMode === "hud" && window.innerWidth > 1080;
  const baseCardConfig = isDesktopHud ? HUD_SIDE_CARD_CONFIG[currentControlTab] : null;
  const activeSectionKey = hudPanelSectionState[currentControlTab];
  const activeCardConfig = baseCardConfig?.sections?.[activeSectionKey] ?? baseCardConfig ?? null;

  if (!hudSideRailEl || !hudSideCardEl || !hudSideCardSlotEl || !hudSideCardTitleEl || !activeCardConfig) {
    if (hudSideCardEl) {
      hudSideCardEl.hidden = true;
    }
    if (hudSideRailEl) {
      hudSideRailEl.hidden = true;
    }
    return;
  }

  hudSideRailEl.hidden = false;
  hudSideCardEl.hidden = false;
  hudSideCardTitleEl.textContent = i18n.t(activeCardConfig.titleKey);
  moveNodeToSlot(activeCardConfig.node, hudSideCardSlotEl);
}

function syncHudPanelSections() {
  const isHudLayout = currentLayoutMode === "hud";

  for (const panel of controlTabPanels) {
    const panelKey = panel.dataset.controlPanel;
    const buttons = [...panel.querySelectorAll("[data-hud-panel-tab]")];
    const sections = [...panel.querySelectorAll("[data-hud-panel-section]")];
    const activeSection = hudPanelSectionState[panelKey] ?? buttons[0]?.dataset.hudPanelTab;

    for (const button of buttons) {
      const isActive = button.dataset.hudPanelTab === activeSection;
      button.classList.toggle("active", isActive);
      button.setAttribute("aria-pressed", String(isActive));
    }

    for (const section of sections) {
      const isHudOnlySection = section.hasAttribute("data-hud-only-section");
      const isActive = isHudLayout
        ? section.dataset.hudPanelSection === activeSection
        : !isHudOnlySection;
      section.hidden = !isActive;
      section.classList.toggle("active", isActive);
    }
  }

  syncHudSideCard();
}

function setHudPanelSection(panelKey, sectionKey) {
  if (!panelKey || !sectionKey) {
    return;
  }

  hudPanelSectionState[panelKey] = sectionKey;
  syncHudPanelSections();
}

function setChip(el, value) {
  el.textContent = value;
  el.title = value;
}

function syncHudStatusChips() {
  setChip(hudSeasonLatitudeChipEl, seasonLatitudeEl.textContent?.trim() || "--");
  setChip(hudSeasonStateChipEl, seasonSummaryEl.textContent?.trim() || "--");
  setChip(hudTimeChipEl, timeSummaryEl.textContent?.trim() || "--");
  setChip(hudSystemChipEl, statusEl.textContent?.trim() || "--");
}

function getEffectiveLayoutMode() {
  return isMobileViewport() ? "hud" : preferredLayoutMode;
}

function syncLayoutSwitchUi() {
  const useMobileSettingsLayout = isMobileViewport();
  layoutSwitchEl.classList.toggle("single-mode", useMobileSettingsLayout);

  for (const button of layoutModeButtons) {
    const layoutMode = button.dataset.layoutModeSwitch;
    const isClassicButton = layoutMode === "classic";
    const hideClassic = useMobileSettingsLayout && isClassicButton;
    button.hidden = hideClassic;
    button.disabled = hideClassic;
    const isActive = useMobileSettingsLayout
      ? layoutMode === "hud"
      : layoutMode === preferredLayoutMode;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  }
}

function applyLayoutMode() {
  const effectiveLayoutMode = getEffectiveLayoutMode();
  currentLayoutMode = effectiveLayoutMode;

  document.body.dataset.layoutMode = effectiveLayoutMode;
  if (appShellEl) {
    appShellEl.dataset.layoutMode = effectiveLayoutMode;
  }

  syncLayoutAnchors(effectiveLayoutMode);
  syncResponsiveTopbarAnchors();
  syncHudMovablePanels();
  syncLayoutSwitchUi();
  syncHudStatusChips();
  syncHudPanelSections();
  syncHudDetailPanelVerticalClearance();
  window.requestAnimationFrame(() => {
    syncHudDetailPanelVerticalClearance();
  });
}

function setLayoutMode(layoutMode, { persist = true } = {}) {
  preferredLayoutMode = layoutMode === "classic" ? "classic" : "hud";

  if (persist) {
    try {
      window.localStorage.setItem(LAYOUT_STORAGE_KEY, preferredLayoutMode);
    } catch {}
  }

  applyLayoutMode();
}

function getFocusableElements(root) {
  return [...root.querySelectorAll(FOCUSABLE_SELECTOR)]
    .filter((element) => !element.hasAttribute("hidden") && element.getAttribute("aria-hidden") !== "true");
}

function trapFocus(event) {
  if (!helpModalOpen) {
    return;
  }

  const focusableElements = getFocusableElements(helpModalEl);
  if (focusableElements.length === 0) {
    event.preventDefault();
    helpModalEl.focus();
    return;
  }

  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];
  const activeElement = document.activeElement;

  if (event.shiftKey && activeElement === firstElement) {
    event.preventDefault();
    lastElement.focus();
  } else if (!event.shiftKey && activeElement === lastElement) {
    event.preventDefault();
    firstElement.focus();
  }
}

function resetMovementInputs() {
  if (typeof movementState === "undefined") {
    return;
  }

  movementState.forward = false;
  movementState.backward = false;
  movementState.left = false;
  movementState.right = false;
}

function openGooglePrivacyChoices() {
  if (APP_MODE) {
    return;
  }
  const googlefc = window.googlefc;
  const usStatesOptOutApi = googlefc?.usstatesoptout;

  if (typeof usStatesOptOutApi?.openConfirmationDialog === "function") {
    usStatesOptOutApi.openConfirmationDialog();
    return;
  }

  if (typeof googlefc?.showRevocationMessage === "function") {
    googlefc.showRevocationMessage();
    return;
  }

  if (typeof googlefc?.showManageOptions === "function") {
    googlefc.showManageOptions();
    return;
  }

  console.warn("[Privacy] Consent choices UI is not available in this region/session.");
}

function openSettingsPanel(trigger = settingsToggleButtonEl) {
  if (!settingsToggleButtonEl || !settingsPopoverEl || settingsPanelOpen) {
    return;
  }

  settingsPanelOpen = true;
  lastFocusedBeforeSettingsPanel = trigger instanceof HTMLElement ? trigger : document.activeElement;
  settingsPopoverEl.hidden = false;
  settingsPopoverEl.scrollTop = 0;
  settingsPopoverEl.classList.add("active");
  settingsPopoverEl.setAttribute("aria-hidden", "false");
  if (settingsBackdropEl) {
    settingsBackdropEl.hidden = false;
    settingsBackdropEl.classList.add("active");
    settingsBackdropEl.setAttribute("aria-hidden", "false");
  }
  settingsToggleButtonEl.setAttribute("aria-expanded", "true");
  document.body.classList.add("settings-panel-open");
  resetMovementInputs();
}

function closeSettingsPanel({ restoreFocus = true } = {}) {
  if (!settingsToggleButtonEl || !settingsPopoverEl || !settingsPanelOpen) {
    return;
  }

  settingsPanelOpen = false;
  settingsPopoverEl.classList.remove("active");
  settingsPopoverEl.hidden = true;
  settingsPopoverEl.setAttribute("aria-hidden", "true");
  if (settingsBackdropEl) {
    settingsBackdropEl.classList.remove("active");
    settingsBackdropEl.hidden = true;
    settingsBackdropEl.setAttribute("aria-hidden", "true");
  }
  settingsToggleButtonEl.setAttribute("aria-expanded", "false");
  document.body.classList.remove("settings-panel-open");
  resetMovementInputs();

  if (restoreFocus && lastFocusedBeforeSettingsPanel instanceof HTMLElement) {
    lastFocusedBeforeSettingsPanel.focus();
  }
}

function toggleSettingsPanel() {
  if (settingsPanelOpen) {
    closeSettingsPanel({ restoreFocus: false });
    return;
  }

  openSettingsPanel(settingsToggleButtonEl);
}

function openHelpModal(trigger = helpOpenButtonEl) {
  if (helpModalOpen) {
    return;
  }

  closeSettingsPanel({ restoreFocus: false });
  helpModalOpen = true;
  lastFocusedBeforeHelpModal = trigger instanceof HTMLElement ? trigger : document.activeElement;
  helpModalLayerEl.hidden = false;
  helpModalLayerEl.classList.add("active");
  helpModalLayerEl.setAttribute("aria-hidden", "false");
  helpOpenButtonEl.setAttribute("aria-expanded", "true");
  document.body.classList.add("help-modal-open");
  resetMovementInputs();
  window.requestAnimationFrame(() => {
    helpCloseButtonEl.focus();
  });
}

function closeHelpModal({ restoreFocus = true } = {}) {
  if (!helpModalOpen) {
    return;
  }

  helpModalOpen = false;
  helpModalLayerEl.classList.remove("active");
  helpModalLayerEl.hidden = true;
  helpModalLayerEl.setAttribute("aria-hidden", "true");
  helpOpenButtonEl.setAttribute("aria-expanded", "false");
  document.body.classList.remove("help-modal-open");
  resetMovementInputs();

  if (restoreFocus && lastFocusedBeforeHelpModal instanceof HTMLElement) {
    lastFocusedBeforeHelpModal.focus();
  }
}

function handleOverlayKeydown(event) {
  if (helpModalOpen) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeHelpModal();
      return;
    }

    if (event.key === "Tab") {
      trapFocus(event);
    }

    return;
  }

  if (settingsPanelOpen && event.key === "Escape") {
    event.preventDefault();
    closeSettingsPanel();
  }
}

function isUiBlocking() {
  return helpModalOpen || settingsPanelOpen;
}

function syncCameraPresetAccessibility() {
  const topLabel = i18n.t("cameraPresetTop");
  const angleLabel = i18n.t("cameraPresetAngle");

  for (const button of cameraPresetButtons) {
    const labelKey = button.dataset.cameraLabelKey;
    if (!labelKey) {
      continue;
    }
    const label = i18n.t(labelKey);
    button.setAttribute("aria-label", label);
    button.setAttribute("title", label);
  }

  if (cameraViewToggleEl) {
    cameraViewToggleEl.setAttribute("aria-label", `${topLabel} / ${angleLabel}`);
    cameraViewToggleEl.setAttribute("title", `${topLabel} / ${angleLabel}`);
  }
}

function syncCameraViewToggleUi() {
  const isAngle = Boolean(cameraViewToggleEl?.checked);
  cameraViewModeTopEl?.classList.toggle("active", !isAngle);
  cameraViewModeAngleEl?.classList.toggle("active", isAngle);
}

function applyStaticTranslations() {
  document.documentElement.lang = i18n.getLanguage();
  document.title = i18n.t("documentTitle");
  detailTabsEl.setAttribute("aria-label", i18n.t("detailTabsAria"));
  layoutSwitchEl.setAttribute("aria-label", i18n.t("layoutSwitchAria"));
  languageToggleEl.checked = i18n.getLanguage() === "en";
  languageToggleEl.setAttribute("aria-label", i18n.t("languageToggleAria"));
  languageToggleTextEl.textContent = i18n.getLanguage() === "en"
    ? i18n.t("languageNameEn")
    : i18n.t("languageNameKo");
  moonPhaseChartImageEl.alt = i18n.t("moonPhaseChartAlt");
  helpOpenButtonEl.setAttribute("aria-controls", "help-modal");
  helpOpenButtonEl.setAttribute("aria-haspopup", "dialog");
  helpOpenButtonEl.setAttribute("aria-expanded", String(helpModalOpen));
  settingsToggleButtonEl.setAttribute("aria-controls", "settings-popover");
  settingsToggleButtonEl.setAttribute("aria-haspopup", "dialog");
  settingsToggleButtonEl.setAttribute("aria-expanded", String(settingsPanelOpen));
  settingsToggleButtonEl.setAttribute("aria-label", i18n.t("settingsButtonLabel"));
  settingsPopoverEl.setAttribute("aria-hidden", String(!settingsPanelOpen));

  for (const element of translatableTextEls) {
    element.textContent = i18n.t(element.dataset.i18n);
  }

  for (const element of translatableHtmlEls) {
    element.innerHTML = i18n.t(element.dataset.i18nHtml);
  }

  syncCameraPresetAccessibility();
  syncCameraViewToggleUi();
  syncHudPanelSections();
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
syncHudStatusChips();
applyLayoutMode();

const hudStatusObserver = new MutationObserver(() => {
  syncHudStatusChips();
});

for (const sourceElement of [seasonLatitudeEl, seasonSummaryEl, timeSummaryEl, statusEl]) {
  hudStatusObserver.observe(sourceElement, {
    childList: true,
    characterData: true,
    subtree: true
  });
}

for (const button of layoutModeButtons) {
  button.addEventListener("click", () => {
    setLayoutMode(button.dataset.layoutModeSwitch);
  });
}

for (const button of hudSubtabButtons) {
  button.addEventListener("click", () => {
    const panel = button.closest("[data-control-panel]");
    const panelKey = panel?.dataset.controlPanel;
    const sectionKey = button.dataset.hudPanelTab;
    setHudPanelSection(panelKey, sectionKey);
  });
}

if (cameraViewToggleEl) {
  cameraViewToggleEl.addEventListener("change", () => {
    syncCameraViewToggleUi();
  });
}

settingsToggleButtonEl.addEventListener("click", () => {
  toggleSettingsPanel();
});

if (settingsBackdropEl) {
  settingsBackdropEl.addEventListener("click", () => {
    closeSettingsPanel({ restoreFocus: false });
  });
}

if (privacyChoicesButtonEl) {
  privacyChoicesButtonEl.addEventListener("click", () => {
    openGooglePrivacyChoices();
  });
}

if (APP_MODE && settingsPrivacyGroupEl) {
  settingsPrivacyGroupEl.hidden = true;
}

helpOpenButtonEl.addEventListener("click", () => {
  openHelpModal(helpOpenButtonEl);
});

helpCloseButtonEl.addEventListener("click", () => {
  closeHelpModal();
});

helpModalBackdropEl.addEventListener("click", () => {
  closeHelpModal();
});

document.addEventListener("pointerdown", (event) => {
  if (!settingsPanelOpen || !settingsAnchorEl || !(event.target instanceof Node)) {
    return;
  }

  if (!settingsAnchorEl.contains(event.target) && !settingsPopoverEl?.contains(event.target)) {
    closeSettingsPanel({ restoreFocus: false });
  }
}, true);

document.addEventListener("keydown", handleOverlayKeydown, true);
document.addEventListener("focusin", (event) => {
  if (helpModalOpen) {
    if (helpModalEl.contains(event.target)) {
      return;
    }

    helpCloseButtonEl.focus();
    return;
  }

  if (!settingsPanelOpen || !settingsAnchorEl || !(event.target instanceof Node)) {
    return;
  }

  if (!settingsAnchorEl.contains(event.target) && !settingsPopoverEl?.contains(event.target)) {
    closeSettingsPanel({ restoreFocus: false });
  }
});
window.addEventListener("resize", () => {
  applyLayoutMode();
});

function getControlTabOrder() {
  const tabs = controlTabButtons
    .map((button) => button.dataset.controlTab)
    .filter(Boolean);
  return tabs.length > 0 ? tabs : TAB_ORDER_FALLBACK;
}

function scrollActiveControlTabIntoView() {
  if (!isMobileViewport() || currentLayoutMode !== "hud") {
    return;
  }
  const activeButton = controlTabButtons.find((button) => button.dataset.controlTab === currentControlTab);
  activeButton?.scrollIntoView({
    behavior: "smooth",
    block: "nearest",
    inline: "center"
  });
}

function shiftControlTab(direction) {
  const tabOrder = getControlTabOrder();
  if (tabOrder.length === 0) {
    return;
  }
  const currentIndex = tabOrder.indexOf(currentControlTab);
  const safeIndex = currentIndex >= 0 ? currentIndex : 0;
  const offset = direction >= 0 ? 1 : -1;
  const nextIndex = (safeIndex + offset + tabOrder.length) % tabOrder.length;
  setControlTab(tabOrder[nextIndex]);
}

let constellationTabApi;

for (let i = 0; i < SPACEPORTS.length; i++) {
  const option = document.createElement("option");
  option.value = i;
  option.textContent = SPACEPORTS[i].name;
  rocketSpaceportSelect.appendChild(option);
}

function setControlTab(tabKey) {
  currentControlTab = tabKey;

  for (const button of controlTabButtons) {
    button.classList.toggle("active", button.dataset.controlTab === tabKey);
  }

  for (const panel of controlTabPanels) {
    const isActive = panel.dataset.controlPanel === tabKey;
    panel.classList.toggle("active", isActive);
    panel.hidden = !isActive;
  }

  syncHudPanelSections();
  constellationTabApi?.setPanelActive(tabKey === "constellations");
  scrollActiveControlTabIntoView();
}

function isSwipeNavigationEnabled() {
  return isMobileViewport()
    && currentLayoutMode === "hud"
    && !settingsPanelOpen
    && !helpModalOpen;
}

function isSwipeBlockedTarget(target, { blockButtons = true } = {}) {
  if (!(target instanceof Element)) {
    return false;
  }

  const blockingSelector = blockButtons
    ? "button,a,input,select,textarea,label,[role='button'],[role='slider'],[contenteditable='true']"
    : "a,input,select,textarea,[role='slider'],[contenteditable='true']";

  return Boolean(target.closest(blockingSelector));
}

function bindTabSwipeNavigation(container, options = {}) {
  if (!container) {
    return;
  }

  const { blockButtons = true } = options;
  let pointerId = null;
  let startX = 0;
  let startY = 0;

  container.addEventListener("pointerdown", (event) => {
    if (!isSwipeNavigationEnabled()) {
      return;
    }
    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }
    if (isSwipeBlockedTarget(event.target, { blockButtons })) {
      return;
    }

    pointerId = event.pointerId;
    startX = event.clientX;
    startY = event.clientY;
  });

  container.addEventListener("pointerup", (event) => {
    if (pointerId !== event.pointerId) {
      return;
    }

    const deltaX = event.clientX - startX;
    const deltaY = Math.abs(event.clientY - startY);
    pointerId = null;

    if (!isSwipeNavigationEnabled()) {
      return;
    }
    if (Math.abs(deltaX) < TAB_SWIPE_THRESHOLD_X || deltaY > TAB_SWIPE_MAX_DRIFT_Y) {
      return;
    }

    shiftControlTab(deltaX < 0 ? 1 : -1);
  });

  container.addEventListener("pointercancel", () => {
    pointerId = null;
  });
}

bindTabSwipeNavigation(detailPanelEl, { blockButtons: true });
bindTabSwipeNavigation(topbarNavSlotEl, { blockButtons: false });

import { setupScene } from "./modules/scene-setup.js?v=20260328-mobileratio2";
import { createConstellations } from "./modules/constellation-setup.js?v=20260326-seasonal-ecliptic1";
import { createZodiacWheel } from "./modules/zodiac-wheel.js?v=20260326-seasonal-ecliptic1";
const {
  renderer,
  scene,
  firstPersonScene,
  camera,
  defaultCameraLookTarget,
  cameraState,
  stage,
  scalableStage,
  globeStage,
  globeSurface,
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
  createOrbitTrack,
  orbitGuideGroups,
  domeWaterApi,
  setEarthModelView
} = setupScene({ canvas });

// Add constellations
const constellationApi = createConstellations();
scalableStage.add(constellationApi.group);
const zodiacWheelApi = createZodiacWheel({ i18n });
scalableStage.add(zodiacWheelApi.group);

const initialTimelineDateMs = Date.now();
const initialTimelineNowMs = performance.now();
const simulationState = {
  darkSunBandDirection: -1,
  darkSunBandProgress: 0.88,
  darkSunDebugVisible: false,
  darkSunStageAltitudeLock: false,
  darkSunStageHasEclipsed: false,
  darkSunStageOffsetRadians: 0,
  darkSunStageTotalityHoldMs: 0,
  darkSunStageTransit: 0,
  demoAnchorRealMs: initialTimelineNowMs,
  demoAnchorSimMs: initialTimelineDateMs,
  demoPhaseDateMs: initialTimelineDateMs,
  moonBandDirection: 1,
  moonBandProgress: 0.12,
  moonSunOrbitOffsetRadians: Math.PI * 0.35,
  darkSunOrbitPhaseOffsetRadians: Math.PI,
  orbitDarkSunAngle: Math.PI,
  orbitMoonAngle: Math.PI * 0.35,
  orbitMode: "auto",
  orbitSeasonPhase: -Math.PI / 2,
  orbitSunAngle: 0,
  simulatedDateMs: initialTimelineDateMs,
  sunBandDirection: 1,
  sunBandProgress: 0.12,
  timelineAnchorDateMs: initialTimelineDateMs,
  timelineAnchorNowMs: initialTimelineNowMs,
  useRealityTimelineInDemo: true
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
const eclipseSelectionState = {
  sourceMode: "builtin",
  kind: "solar",
  year: astronomyState.selectedDate.getUTCFullYear(),
  eventId: "",
  timePoint: "peak",
  uploadedCatalog: null,
  uploadStatus: {
    tone: "default",
    key: "eclipseCatalogStatusAwaitingUpload",
    params: {}
  },
  selectedEventMeta: null
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
  enabled: false
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
  celestialSpeedPresetButtons,
  celestialSpeedValueEl,
  celestialTrailLengthEl,
  celestialTrailLengthValueEl,
  dayNightOverlayEl,
  dayNightSummaryEl,
  darkSunDebugEl,
  darkSunDebugSummaryEl,
  eclipseCatalogSourceEl,
  eclipseCatalogStatusEl,
  eclipseCatalogUploadEl,
  eclipseEventSelectEl,
  eclipseKindSelectEl,
  eclipseTimePointSelectEl,
  eclipseUploadFieldEl,
  eclipseYearSelectEl,
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
  realitySyncToggleTextEl,
  seasonalEventTimeEl,
  seasonDetailEl,
  seasonLatitudeEl,
  seasonSummaryEl,
  seasonalMoonAnchorEl,
  seasonalMoonDriftEl,
  seasonalMoonSummaryEl,
  selectedEclipseKindEl,
  selectedEclipseLocalEl,
  selectedEclipseMagnitudeEl,
  selectedEclipseSourceEl,
  selectedEclipseSummaryEl,
  selectedEclipseTypeEl,
  selectedEclipseUtcEl,
  stagePreEclipseBtn: document.getElementById("stage-pre-eclipse"),
  stagePreLunarEclipseBtn: document.getElementById("stage-pre-lunar-eclipse"),
  seasonalSunGridEl,
  seasonalSunSummaryEl,
  seasonalYearEl,
  previewSelectedEclipseButton,
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
  rocketMissionProfileSelect,
  rocketTypeSelect,
  rocketStandbyBtn,
  rocketCameraSummaryEl,
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
  eclipseSelectionState,
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
  topDownBackground: skyTexture,
  orbitSun
});

const routeSimulationApi = createRouteSimulationController({
  cameraState,
  constants,
  globeStage,
  globeSurface,
  i18n,
  scalableStage,
  ui: {
    routeAircraftEl,
    routeAdvancedPanelEl,
    routeCountriesEl,
    routeDatasetStatusEl,
    routeDirectAddLayoverButtonEl,
    routeDirectDestinationCodeEl,
    routeDirectLayoverInputEls,
    routeDirectLayoverRowEls,
    routeDirectOriginCodeEl,
    routeDirectRemoveLayoverButtons,
    routeDestinationAirportEl,
    routeDestinationContinentEl,
    routeDestinationCountryEl,
    routeDestinationEl,
    routeDurationEl,
    routeGeoSummaryEl,
    routeLegEl,
    routeLayoversEl,
    routeModeSelectEl,
    routeOriginEl,
    routeOriginAirportEl,
    routeOriginContinentEl,
    routeOriginCountryEl,
    routePlaybackButton,
    routeProgressEl,
    routeRecommendedPanelEl,
    routeRecommendedRouteEl,
    routeResetButton,
    routeSpeedEl,
    routeSpeedValueEl,
    routeSummaryEl
  }
});

const routeCameraTrackingState = {
  enabled: false,
  applied: false
};
const ROUTE_CAMERA_TRACKING_COPY = {
  en: {
    start: "Track Aircraft",
    stop: "Stop Tracking",
    summary: "Tracking the aircraft along the selected route."
  },
  ko: {
    start: "항공기 추적",
    stop: "추적 중지",
    summary: "선택한 항로를 따라 항공기를 추적 중입니다."
  }
};
const routeCameraTrackingTarget = new THREE.Vector3();
const routeCameraTrackingTangent = new THREE.Vector3();
const routeCameraTrackingLocalTangent = new THREE.Vector3();
const routeCameraTrackingGlobeWorldQuaternion = new THREE.Quaternion();
const routeCameraTrackingGlobeWorldQuaternionInverse = new THREE.Quaternion();
const ROUTE_CAMERA_TRACKING_GLOBE_ROTATION_LERP = 0.2;
const ROUTE_CAMERA_TRACKING_GLOBE_RESET_LERP = 0.12;

let celestialTrackingCameraApi;

function focusCameraOnConstellation(entry) {
  if (walkerState.enabled) {
    return;
  }

  if (!entry) {
    celestialTrackingCameraApi?.clearTracking();
    cameraState.targetLookTarget.set(0, constants.SURFACE_Y * (5 / 6), 0);
    cameraState.targetTheta = constants.CAMERA_TOPDOWN_EXACT_THETA;
    cameraState.theta = cameraState.targetTheta;
    cameraState.targetPhi = constants.CAMERA_TOPDOWN_EXACT_PHI;
    cameraState.phi = cameraState.targetPhi;
    cameraState.targetRadius = constants.CAMERA_TOPDOWN_FULL_RADIUS;
    cameraState.radius = cameraState.targetRadius;
    cameraApi.clampCamera();
    return;
  }

  const resolveFocus = () => (
    constellationApi.getConstellationState(entry.name)?.centroidWorldPoint ??
    entry.centroidWorldPoint ??
    { x: 0, y: constants.SURFACE_Y * (5 / 6), z: 0 }
  );
  const focus = resolveFocus();
  const polarisAngle = THREE.MathUtils.euclideanModulo(Math.atan2(focus.x, -focus.z), Math.PI * 2);
  const frontTheta = Math.PI - polarisAngle;

  if (celestialTrackingCameraApi?.setCustomLookTargetResolver) {
    celestialTrackingCameraApi.setCustomLookTargetResolver(resolveFocus, { immediate: true });
  } else if (celestialTrackingCameraApi?.setCustomLookTarget) {
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

constellationTabApi = createConstellationTabController({
  i18n,
  constellationApi,
  getObservationDate: () => astronomyState.selectedDate,
  onSelectionChange: focusCameraOnConstellation,
  zodiacWheelApi,
  ui: {
    constellationLineVisibilityTextEl,
    constellationLineVisibilityToggleEl,
    constellationVisibilityToggleEl,
    constellationVisibilityTextEl,
    zodiacWheelTextEl,
    zodiacWheelToggleEl,
    constellationSelectEl,
    constellationMapEl,
    constellationDirectionEl,
    constellationRaEl,
    constellationDecEl,
    constellationHemisphereEl,
    constellationSegmentsEl,
    constellationStarsEl,
    zodiacAgeViewEl,
    zodiacAgeSummaryEl,
    zodiacCurrentAgeEl,
    zodiacCurrentTropicalEl,
    zodiacAgeOffsetEl,
    zodiacAgeCycleEl,
    zodiacObservationDateEl,
  },
});

i18n.subscribe(() => {
  constellationTabApi.refreshLocalizedUi();
  syncHudSideCard();
  syncRouteCameraTrackingUi();
});

constellationTabApi.initialize();
setDemoSeasonPhaseFromDate(astronomyState.selectedDate.getTime());
const initialSeasonalAngle = getSeasonalEclipticAngle(astronomyState.selectedDate);
const initialAgeOffset = getZodiacAgeOffsetRadians(astronomyState.selectedDate);
constellationApi.setSeasonalEclipticAngle(initialSeasonalAngle);
zodiacWheelApi.setSeasonalAngle(initialSeasonalAngle);
zodiacWheelApi.setAgeOffset(initialAgeOffset);
constellationTabApi.refreshDynamicState({ force: true });

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
  constants,
  domeWaterApi
});

const rocketCameraUiState = {
  activeProfileKey: "",
  engaged: false,
  lastEndedLaunchpadName: ""
};
const rocketCameraTempRadial = new THREE.Vector3();
const rocketCameraTempTangent = new THREE.Vector3();
const rocketCameraTempHeading = new THREE.Vector3();
const rocketCameraLockedPosition = new THREE.Vector3();
const ROCKET_FRONT_VIEW_TRANSITION_SECONDS = 1.15;
const ROCKET_FIXED_CAMERA_HEIGHT = SURFACE_Y + scaleDimension(0.18);
const ROCKET_CAMERA_COPY = {
  en: {
    idle: "Choose a launchpad and stage a rocket to preview the pad camera.",
    standby: "Standby camera is locked on {launchpad}. Launch when ready.",
    standbyButton: "Stage Standby",
    states: {
      FALL: "Fall",
      IGNITION: "Engine Ignition",
      LAUNCH: "Launch",
      PITCHOVER: "Pitchover",
      SCRAPE: "Dome Scrape",
      SEPARATION: "Stage Separation",
      STAGE1: "Stage 1 Burn",
      STAGE2: "Stage 2 Burn",
      STANDBY: "Standby"
    },
    tracking: "Tracking the {launchpad} launch through {stage}. Drag and zoom stay enabled.",
    ended: "Tracking finished for the {launchpad} launch. Stage another rocket to preview a pad again."
  },
  ko: {
    idle: "발사대를 선택하고 로켓을 스탠바이로 배치하면 발사대 카메라 미리보기가 시작됩니다.",
    standby: "{launchpad} 스탠바이 카메라가 고정되었습니다. 준비되면 발사하세요.",
    standbyButton: "스탠바이 배치",
    states: {
      FALL: "낙하",
      IGNITION: "\uc810\ud654 \uc608\uc5f4",
      LAUNCH: "발사",
      PITCHOVER: "자세 전환",
      SCRAPE: "궁창 접촉",
      SEPARATION: "단 분리",
      STAGE1: "1단 연소",
      STAGE2: "2단 연소",
      STANDBY: "스탠바이"
    },
    tracking: "{launchpad} 발사를 {stage} 단계까지 추적 중입니다. 드래그와 줌은 계속 사용할 수 있습니다.",
    ended: "{launchpad} 발사 추적이 종료되었습니다. 다음 발사를 미리 보려면 다시 스탠바이를 배치하세요."
  }
};

function getRocketCameraCopy() {
  return ROCKET_CAMERA_COPY[i18n.getLanguage()] ?? ROCKET_CAMERA_COPY.en;
}

function getRocketStateLabelKey(state) {
  return getRocketCameraCopy().states[state] ?? state;
}

function getRocketStateLabel(state) {
  return getRocketStateLabelKey(state);
}

function wrapTrackingAngle(angle) {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

function lerpTrackingAngle(fromAngle, toAngle, alpha) {
  const delta = wrapTrackingAngle(toAngle - fromAngle);
  return wrapTrackingAngle(fromAngle + delta * alpha);
}

function getRocketFrontViewAzimuth(snapshot) {
  rocketCameraTempRadial.set(snapshot?.position?.x ?? 0, 0, snapshot?.position?.z ?? 0);
  if (rocketCameraTempRadial.lengthSq() < 0.0001) {
    rocketCameraTempRadial.set(0, 0, 1);
  } else {
    rocketCameraTempRadial.normalize();
  }

  rocketCameraTempTangent.set(-rocketCameraTempRadial.z, 0, rocketCameraTempRadial.x);
  const headingSource = snapshot?.headingDirection?.lengthSq?.() > 0.0001
    ? snapshot.headingDirection
    : snapshot?.forward;
  rocketCameraTempHeading.set(headingSource?.x ?? 0, 0, headingSource?.z ?? 0);

  if (rocketCameraTempHeading.lengthSq() < 0.0001) {
    return -0.38;
  }

  rocketCameraTempHeading.normalize();
  return Math.atan2(
    rocketCameraTempHeading.dot(rocketCameraTempTangent),
    rocketCameraTempHeading.dot(rocketCameraTempRadial)
  );
}

function blendRocketTrackingProfile(fromProfile, toProfile, alpha) {
  return {
    azimuth: lerpTrackingAngle(fromProfile.azimuth, toProfile.azimuth, alpha),
    distance: THREE.MathUtils.lerp(fromProfile.distance, toProfile.distance, alpha),
    elevation: THREE.MathUtils.lerp(fromProfile.elevation, toProfile.elevation, alpha)
  };
}

function shouldContinuouslyUpdateRocketProfile(snapshot) {
  return Boolean(
    snapshot
    && (snapshot.state === "STAGE1" || snapshot.state === "LAUNCH")
    && (snapshot.stageTimer ?? 0) < ROCKET_FRONT_VIEW_TRANSITION_SECONDS
  );
}

function getRocketTrackingSummary(snapshot) {
  const copy = getRocketCameraCopy();
  if (!snapshot) {
    return copy.idle;
  }

  const launchLabel = snapshot.missionLabel
    ? `${snapshot.missionLabel} · ${snapshot.launchpadName ?? ""}`
    : (snapshot.launchpadName ?? "");

  if (snapshot.state === "STANDBY") {
    return copy.standby.replace("{launchpad}", launchLabel);
  }

  return copy.tracking
    .replace("{launchpad}", launchLabel)
    .replace("{stage}", getRocketStateLabel(snapshot.state));
}

function getRocketTrackingProfile(snapshot) {
  switch (snapshot?.state) {
    case "STANDBY": {
      return {
        azimuth: getRocketFrontViewAzimuth(snapshot),
        distance: constants.CAMERA_TRACKING_MIN_DISTANCE * 1.12,
        elevation: 0.16
      };
    }
    case "IGNITION":
      return {
        azimuth: getRocketFrontViewAzimuth(snapshot),
        distance: constants.CAMERA_TRACKING_MIN_DISTANCE * 1.04,
        elevation: 0.14
      };
    case "STAGE1":
    case "LAUNCH": {
      const frontProfile = {
        azimuth: getRocketFrontViewAzimuth(snapshot),
        distance: constants.CAMERA_TRACKING_MIN_DISTANCE * 1.18,
        elevation: 0.18
      };
      const followProfile = {
        azimuth: -0.9,
        distance: constants.CAMERA_TRACKING_DEFAULT_DISTANCE * 0.96,
        elevation: 0.5
      };
      const rawProgress = THREE.MathUtils.clamp(
        (snapshot.stageTimer ?? 0) / ROCKET_FRONT_VIEW_TRANSITION_SECONDS,
        0,
        1
      );
      const progress = THREE.MathUtils.smootherstep(rawProgress, 0, 1);
      return blendRocketTrackingProfile(frontProfile, followProfile, progress);
    }
    case "SEPARATION":
      return {
        azimuth: -0.64,
        distance: constants.CAMERA_TRACKING_DEFAULT_DISTANCE * 1.18,
        elevation: 0.74
      };
    case "STAGE2":
      return {
        azimuth: -0.52,
        distance: constants.CAMERA_TRACKING_DEFAULT_DISTANCE * 0.88,
        elevation: 0.68
      };
    case "SCRAPE":
    case "FALL":
      return {
        azimuth: -0.44,
        distance: constants.CAMERA_TRACKING_DEFAULT_DISTANCE * 1.3,
        elevation: 0.82
      };
    default:
      return {
        azimuth: constants.CAMERA_TRACKING_DEFAULT_AZIMUTH,
        distance: constants.CAMERA_TRACKING_DEFAULT_DISTANCE,
        elevation: constants.CAMERA_TRACKING_DEFAULT_ELEVATION
      };
  }
}

function syncRocketCameraAndUi() {
  const activeSnapshot = rocketApi.getActiveRocketSnapshot();
  const standbySnapshot = activeSnapshot ? null : rocketApi.getStandbySnapshot();
  const snapshot = activeSnapshot ?? standbySnapshot;
  const completedLaunchpadName = rocketApi.getLastCompletedLaunchpadName();
  const copy = getRocketCameraCopy();
  const shouldHideOrbitGuides = Boolean(activeSnapshot);

  if (orbitGuideGroups) {
    orbitGuideGroups.north.visible = !shouldHideOrbitGuides;
    orbitGuideGroups.equator.visible = !shouldHideOrbitGuides;
    orbitGuideGroups.south.visible = !shouldHideOrbitGuides;
  }

  if (rocketStandbyBtn) {
    rocketStandbyBtn.textContent = copy.standbyButton;
    rocketStandbyBtn.disabled = activeSnapshot?.state === "IGNITION";
  }

  if (rocketLaunchBtn) {
    rocketLaunchBtn.disabled = activeSnapshot?.state === "IGNITION";
  }

  if (snapshot) {
    const summaryText = getRocketTrackingSummary(snapshot);
    const profileKey = `${snapshot.state}:${snapshot.spaceportIndex ?? "none"}:${snapshot.rocketType ?? "default"}:${snapshot.missionProfile ?? "default"}`;
    celestialTrackingCameraApi.setTrackedCustomTargetResolver(
      () => {
        const latestActive = rocketApi.getActiveRocketSnapshot();
        const latestStandby = latestActive ? null : rocketApi.getStandbySnapshot();
        return latestActive?.lookTarget ?? latestStandby?.lookTarget ?? null;
      },
      summaryText,
      { immediate: !rocketCameraUiState.engaged || rocketCameraUiState.activeProfileKey !== profileKey }
    );

    const profile = getRocketTrackingProfile(snapshot);
    if (shouldContinuouslyUpdateRocketProfile(snapshot) || rocketCameraUiState.activeProfileKey !== profileKey) {
      cameraState.targetTrackingAzimuth = profile.azimuth;
      cameraState.targetTrackingElevation = profile.elevation;
      cameraState.targetTrackingDistance = profile.distance;
      cameraState.targetTrackingGroundLocked = true;
      cameraState.targetTrackingGroundHeight = ROCKET_FIXED_CAMERA_HEIGHT;
      cameraApi.clampCamera();
      rocketCameraUiState.activeProfileKey = profileKey;
    }

    if (activeSnapshot) {
      if (!cameraState.targetTrackingPositionLocked) {
        rocketCameraLockedPosition.copy(camera.position);
        rocketCameraLockedPosition.y = Math.max(rocketCameraLockedPosition.y, ROCKET_FIXED_CAMERA_HEIGHT);
        cameraState.targetTrackingLockedPosition.copy(rocketCameraLockedPosition);
      }
      cameraState.targetTrackingPositionLocked = true;
    } else {
      cameraState.targetTrackingPositionLocked = false;
    }

    rocketCameraUiState.engaged = true;
    rocketCameraUiState.lastEndedLaunchpadName = "";
    if (rocketCameraSummaryEl) {
      rocketCameraSummaryEl.textContent = summaryText;
    }
    return;
  }

  if (completedLaunchpadName) {
    rocketCameraUiState.lastEndedLaunchpadName = completedLaunchpadName;
  }

  if (rocketCameraUiState.engaged) {
    celestialTrackingCameraApi.clearCustomTracking({ immediate: false });
    rocketCameraUiState.engaged = false;
    rocketCameraUiState.activeProfileKey = "";
  }
  cameraState.targetTrackingGroundLocked = false;
  cameraState.trackingGroundLocked = false;
  cameraState.targetTrackingGroundHeight = ROCKET_FIXED_CAMERA_HEIGHT;
  cameraState.targetTrackingPositionLocked = false;
  cameraState.trackingPositionLocked = false;

  if (!rocketCameraSummaryEl) {
    return;
  }

  rocketCameraSummaryEl.textContent = rocketCameraUiState.lastEndedLaunchpadName
    ? copy.ended.replace("{launchpad}", rocketCameraUiState.lastEndedLaunchpadName)
    : copy.idle;
}

function getRouteCameraTrackingCopy() {
  return ROUTE_CAMERA_TRACKING_COPY[i18n.getLanguage()] ?? ROUTE_CAMERA_TRACKING_COPY.en;
}

function getRouteTrackingPose() {
  const pose = routeSimulationApi.getAircraftTrackingPose?.(
    routeCameraTrackingTarget,
    routeCameraTrackingTangent
  );
  if (pose?.position) {
    return pose;
  }

  const target = routeSimulationApi.getAircraftTrackingTarget?.(routeCameraTrackingTarget);
  if (!target) {
    return null;
  }

  return {
    position: target,
    tangent: null
  };
}

function syncRouteTrackingGlobeRotation(pose = null, { resetOnly = false } = {}) {
  if (!globeStage) {
    return;
  }

  const spherical = cameraState.earthModelView === "spherical";
  if (!spherical || resetOnly || !pose?.tangent) {
    globeStage.rotation.y = lerpTrackingAngle(
      globeStage.rotation.y,
      0,
      ROUTE_CAMERA_TRACKING_GLOBE_RESET_LERP
    );
    return;
  }

  routeCameraTrackingLocalTangent.copy(pose.tangent);
  globeStage.getWorldQuaternion(routeCameraTrackingGlobeWorldQuaternion);
  routeCameraTrackingGlobeWorldQuaternionInverse
    .copy(routeCameraTrackingGlobeWorldQuaternion)
    .invert();
  routeCameraTrackingLocalTangent
    .applyQuaternion(routeCameraTrackingGlobeWorldQuaternionInverse);
  routeCameraTrackingLocalTangent.y = 0;

  if (routeCameraTrackingLocalTangent.lengthSq() < 1e-8) {
    return;
  }

  routeCameraTrackingLocalTangent.normalize();
  const headingRadians = Math.atan2(
    routeCameraTrackingLocalTangent.x,
    routeCameraTrackingLocalTangent.z
  );
  const desiredRotation = wrapTrackingAngle(-headingRadians);
  globeStage.rotation.y = lerpTrackingAngle(
    globeStage.rotation.y,
    desiredRotation,
    ROUTE_CAMERA_TRACKING_GLOBE_ROTATION_LERP
  );
}

function syncRouteCameraTrackingUi() {
  if (!routeTrackCameraButtonEl) {
    return;
  }

  const pose = getRouteTrackingPose();
  const copy = getRouteCameraTrackingCopy();
  const canTrack = Boolean(pose?.position);

  if (!canTrack && routeCameraTrackingState.enabled) {
    routeCameraTrackingState.enabled = false;
  }

  routeTrackCameraButtonEl.disabled = !canTrack;
  routeTrackCameraButtonEl.textContent = routeCameraTrackingState.enabled ? copy.stop : copy.start;
  routeTrackCameraButtonEl.classList.toggle("active", routeCameraTrackingState.enabled);
}

function setRouteCameraTrackingEnabled(enabled) {
  const nextEnabled = Boolean(enabled);
  if (routeCameraTrackingState.enabled === nextEnabled) {
    syncRouteCameraTrackingUi();
    return;
  }

  routeCameraTrackingState.enabled = nextEnabled;
  if (!nextEnabled && routeCameraTrackingState.applied && !rocketCameraUiState.engaged) {
    celestialTrackingCameraApi.clearCustomTracking({ immediate: false });
    routeCameraTrackingState.applied = false;
  }
  if (!nextEnabled) {
    syncRouteTrackingGlobeRotation(null, { resetOnly: true });
  }

  if (nextEnabled) {
    cameraState.targetTrackingAzimuth = constants.CAMERA_TRACKING_DEFAULT_AZIMUTH;
    cameraState.targetTrackingElevation = THREE.MathUtils.clamp(
      constants.CAMERA_TRACKING_DEFAULT_ELEVATION * 0.9,
      constants.CAMERA_TRACKING_MIN_ELEVATION,
      constants.CAMERA_TRACKING_MAX_ELEVATION
    );
    cameraState.targetTrackingDistance = THREE.MathUtils.clamp(
      constants.CAMERA_TRACKING_DEFAULT_DISTANCE * 0.92,
      constants.CAMERA_TRACKING_MIN_DISTANCE,
      constants.CAMERA_TRACKING_MAX_DISTANCE
    );
    cameraState.targetTrackingGroundLocked = false;
    cameraState.targetTrackingPositionLocked = false;
    cameraApi.clampCamera();
  }

  syncRouteCameraTrackingUi();
}

function syncRouteCameraTracking() {
  if (!routeCameraTrackingState.enabled) {
    if (routeCameraTrackingState.applied && !rocketCameraUiState.engaged) {
      celestialTrackingCameraApi.clearCustomTracking({ immediate: false });
      routeCameraTrackingState.applied = false;
    }
    syncRouteTrackingGlobeRotation(null, { resetOnly: true });
    syncRouteCameraTrackingUi();
    return;
  }

  const pose = getRouteTrackingPose();
  if (!pose?.position) {
    routeCameraTrackingState.enabled = false;
    if (routeCameraTrackingState.applied && !rocketCameraUiState.engaged) {
      celestialTrackingCameraApi.clearCustomTracking({ immediate: false });
      routeCameraTrackingState.applied = false;
    }
    syncRouteTrackingGlobeRotation(null, { resetOnly: true });
    syncRouteCameraTrackingUi();
    return;
  }

  if (rocketCameraUiState.engaged) {
    routeCameraTrackingState.applied = false;
    syncRouteTrackingGlobeRotation(null, { resetOnly: true });
    syncRouteCameraTrackingUi();
    return;
  }

  syncRouteTrackingGlobeRotation(pose);
  const copy = getRouteCameraTrackingCopy();
  celestialTrackingCameraApi.setTrackedCustomTargetResolver(
    () => getRouteTrackingPose()?.position ?? null,
    copy.summary,
    { immediate: !routeCameraTrackingState.applied }
  );
  routeCameraTrackingState.applied = true;
  syncRouteCameraTrackingUi();
}

if (routeTrackCameraButtonEl) {
  routeTrackCameraButtonEl.addEventListener("click", () => {
    setRouteCameraTrackingEnabled(!routeCameraTrackingState.enabled);
  });
}


  const eclipseApi = createEclipseController({
    constants, i18n, ui, orbitSun, orbitDarkSun, observerSun, observerDarkSun, orbitSunBody,
    orbitDarkSunRim, orbitDarkSunBody, orbitSunHalo, scene, camera, stage, scalableStage, dome,
    dayNightOverlayMaterial, firstPersonSunRayGroup, firstPersonSunRayMeshes, simulationState,
    astronomyState, renderState, walkerState, cameraState, astronomyApi,
    cameraApi, celestialTrackingCameraApi, celestialControlState,
    getGeoFromProjectedPosition, orbitMoon, orbitMoonBody, observerMoon, observerMoonBody,
    getMoonPhase, solarEclipseToastTitleEl, solarEclipseToastCopyEl, solarEclipseToastEl, getBodyBandProgressStep, sunFullTrail, sunFullTrailPointsCloud, moonFullTrail, moonFullTrailPointsCloud, darkSunFullTrail, darkSunFullTrailPointsCloud, applyStaticTranslations, syncSeasonalEventButtonLabels, textureApi, magneticFieldApi, walkerApi, routeSimulationApi, syncPreparationPresentation: (...args) => celestialVisualsApi.syncPreparationPresentation(...args), observerSunBody, observerDarkSunBody, renderer, observerDarkSunRim, exitFirstPersonMode: () => celestialVisualsApi.exitFirstPersonMode(), updateSunVisualEffects: (...args) => celestialVisualsApi.updateSunVisualEffects(...args)
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


  const inputHandlersApi = setupInputHandlers({
    constants, canvas, cameraApi, walkerApi, celestialTrackingCameraApi, magneticFieldApi,
    routeSimulationApi, astronomyApi, rocketApi, ui, renderState, walkerState, cameraState,
    movementState, simulationState, astronomyState, celestialControlState, isUiBlocking, skyTexture, scene,
    setControlTab, createSolarEclipseState: eclipseApi.createSolarEclipseState, syncFullTrailVisibility: eclipseApi.syncFullTrailVisibility,
    resetDarkSunStageState: eclipseApi.resetDarkSunStageState, showSolarEclipseToast: eclipseApi.showSolarEclipseToast,
    resetDarkSunOcclusionMotion: eclipseApi.resetDarkSunOcclusionMotion, darkSunOcclusionState,
    controlTabButtons, cameraPresetButtons, cameraViewToggleEl, syncCameraViewToggleUi, languageToggleEl, i18n, resetButton,
    exitFirstPersonMode, enterFirstPersonMode, walkerModeEl, resetWalkerButton,
    routeModeSelectEl, routeOriginContinentEl, routeDestinationContinentEl, routeRecommendedRouteEl,
    routeOriginCountryEl, routeOriginAirportEl, routeDestinationCountryEl, routeDestinationAirportEl,
    routeDirectOriginCodeEl, routeDirectDestinationCodeEl, routeDirectLayoverRowEls,
    routeDirectLayoverInputEls, routeDirectRemoveLayoverButtons, routeDirectAddLayoverButtonEl,
    routeSpeedEl, celestialTrailLengthEl, celestialSpeedEl,
    celestialSpeedPresetButtons,
    celestialFullTrailEl, routePlaybackButton, routeResetButton, realitySyncEl,
    realityLiveEl, observationTimeEl, observationMinusHourButton, observationPlusHourButton,
    eclipseCatalogSourceEl, eclipseCatalogUploadEl, eclipseKindSelectEl, eclipseYearSelectEl,
    eclipseEventSelectEl, eclipseTimePointSelectEl, previewSelectedEclipseButton,
    observationMinusMinuteButton, observationPlusMinuteButton, applyObservationTimeButton, setCurrentTimeButton,
    dayNightOverlayEl, dayNightState, getGeoFromProjectedPosition: astronomyApi.getGeoFromProjectedPosition, orbitSun,
    analemmaOverlayEl, analemmaState, magneticFieldOverlayEl, magneticFieldState,
    darkSunDebugEl, getCurrentUiSnapshot: eclipseApi.getCurrentUiSnapshot,
    syncDarkSunPresentation: eclipseApi.syncDarkSunPresentation,
    stagePreEclipseButton, stagePreEclipseScene: eclipseApi.stagePreEclipseScene,
    stagePreLunarEclipseButton, stagePreLunarEclipseScene: eclipseApi.stagePreLunarEclipseScene,
    skyAnalemmaOverlayEl, skyAnalemmaState, orbitModeButtons, cameraTrackButtons,
    seasonalYearEl, seasonalEventButtons
  });

  function shouldBlockAppCameraBridgeInput() {
    return renderState.preparing
      || walkerState.enabled
      || settingsPanelOpen
      || helpModalOpen
      || isUiBlocking?.();
  }

  function clampFiniteNumber(value, fallback = 0) {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : fallback;
  }

  if (APP_MODE && typeof window !== "undefined") {
    window.__APP_CAMERA_BRIDGE__ = {
      rotateBy(deltaX = 0, deltaY = 0) {
        if (!inputHandlersApi?.applyDragDelta || shouldBlockAppCameraBridgeInput()) {
          return false;
        }

        const safeDeltaX = THREE.MathUtils.clamp(clampFiniteNumber(deltaX), -64, 64);
        const safeDeltaY = THREE.MathUtils.clamp(clampFiniteNumber(deltaY), -64, 64);
        inputHandlersApi.applyDragDelta(safeDeltaX, safeDeltaY, "touch");
        return true;
      },
      zoomBy(delta = 0) {
        if (!inputHandlersApi?.applyZoomDelta || shouldBlockAppCameraBridgeInput()) {
          return false;
        }

        const safeDelta = THREE.MathUtils.clamp(clampFiniteNumber(delta), -180, 180);
        inputHandlersApi.applyZoomDelta(safeDelta);
        return true;
      },
      setPreset(mode = "top") {
        if (!inputHandlersApi?.applyCameraPreset || shouldBlockAppCameraBridgeInput()) {
          return false;
        }

        inputHandlersApi.applyCameraPreset(mode === "angle" ? "angle" : "top");
        return true;
      }
    };
  }

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

function setDemoMoonOrbitOffsetFromPhase(dateMs = simulationState.simulatedDateMs ?? simulationState.demoPhaseDateMs) {
  const moonPhase = getMoonPhase(new Date(dateMs));
  if (!Number.isFinite(moonPhase?.phaseAngleRadians)) {
    return;
  }
  simulationState.moonSunOrbitOffsetRadians = moonPhase.phaseAngleRadians;
}

function setDemoSeasonPhaseFromDate(dateMs = simulationState.simulatedDateMs ?? simulationState.demoPhaseDateMs) {
  const date = new Date(dateMs);
  if (Number.isNaN(date.getTime())) {
    return;
  }

  simulationState.orbitSeasonPhase = getSeasonalEclipticPhase(date) * Math.PI * 2;
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
    if (simulationState.darkSunStageAltitudeLock) {
      updateDarkSunStageOrbit(deltaSeconds);
      applyDarkSunStageTransitPosition({
        sunBody: orbitSunBody,
        sunGroup: orbitSun,
        sunRadius: ORBIT_SUN_SIZE,
        darkSunBody: orbitDarkSunBody,
        darkSunGroup: orbitDarkSun,
        darkSunRadius: ORBIT_DARK_SUN_SIZE
      });
      snapshot.darkSunRenderPosition = orbitDarkSun.position.clone();
      snapshot.darkSunRenderState = astronomyApi.getDarkSunRenderState({
        direction: simulationState.darkSunBandDirection,
        orbitAngleRadians: simulationState.orbitDarkSunAngle,
        orbitMode: simulationState.orbitMode,
        progress: simulationState.darkSunBandProgress,
        source: "demo",
        useExplicitOrbit: true
      });
      astronomyApi.updateAstronomyUi(snapshot);
    } else if (simulationState.darkSunLunarStageLock) {
      updateDarkSunLunarStageOrbit(deltaSeconds);
      const stagedDarkSunRenderState = astronomyApi.getDarkSunRenderState({
        direction: simulationState.darkSunBandDirection,
        orbitAngleRadians: simulationState.orbitDarkSunAngle,
        orbitMode: simulationState.orbitMode,
        progress: simulationState.darkSunBandProgress,
        source: "demo",
        useExplicitOrbit: true
      });
      orbitDarkSun.position.copy(stagedDarkSunRenderState.position);
      snapshot.darkSunRenderPosition = orbitDarkSun.position.clone();
      snapshot.darkSunRenderState = stagedDarkSunRenderState;
      astronomyApi.updateAstronomyUi(snapshot);
    }
  } else {
    const isSolarStagingActive = simulationState.darkSunStageAltitudeLock;
    const isLunarStagingActive = simulationState.darkSunLunarStageLock;
    const isAcceleratedRealityMode = astronomyApi.isAcceleratedRealityMode();
    let stageSpeedFactor = false;
    if (isSolarStagingActive) {
      stageSpeedFactor = updateDarkSunStageOrbit(deltaSeconds);
    } else if (isLunarStagingActive) {
      stageSpeedFactor = updateDarkSunLunarStageOrbit(deltaSeconds);
    }
    const eclipseStageActive = stageSpeedFactor !== false;
    let activeSpeedFactor = (isAcceleratedRealityMode && !eclipseStageActive)
      ? 1
      : (
        eclipseStageActive
          ? stageSpeedFactor
          : eclipseAnimationSpeedFactor
      );

    // Lunar eclipse natural slowdown effect
    // Slow down heavily when moon and dark sun approach each other so the
    // blood-moon tint has enough frames to visually register.
    if (!eclipseStageActive && !isAcceleratedRealityMode) {
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
    projectionDate = astronomyApi.getAcceleratedSimulationDate({
      nowMs: performance.now(),
      speedMultiplier
    });
    const baseSnapshot = astronomyApi.getAstronomySnapshot(projectionDate);

    const previousSunProgress = simulationState.sunBandProgress ?? 0.5;
    const sunRealityProgress = THREE.MathUtils.clamp(
      baseSnapshot.sunRenderState?.corridorProgress ?? baseSnapshot.sunRenderState?.macroProgress ?? 0.5,
      0,
      1
    );
    const lockedRealityProgress = sunRealityProgress;

    simulationState.orbitSunAngle = baseSnapshot.sunRenderState?.orbitAngleRadians ?? simulationState.orbitSunAngle;
    simulationState.orbitMoonAngle = baseSnapshot.moonRenderState?.orbitAngleRadians ?? simulationState.orbitMoonAngle;
    simulationState.orbitSeasonPhase = getSeasonalEclipticPhase(projectionDate) * Math.PI * 2;
    simulationState.sunBandProgress = lockedRealityProgress;
    simulationState.moonBandProgress = lockedRealityProgress;
    simulationState.darkSunBandProgress = lockedRealityProgress;
    if (Math.abs(lockedRealityProgress - previousSunProgress) > 0.0001) {
      simulationState.sunBandDirection = lockedRealityProgress > previousSunProgress ? 1 : -1;
    }
    simulationState.moonBandDirection = simulationState.sunBandDirection;

    if (!isSolarStagingActive && !isLunarStagingActive) {
      simulationState.orbitDarkSunAngle = baseSnapshot.darkSunRenderState?.orbitAngleRadians ?? simulationState.orbitDarkSunAngle;
      if (Number.isFinite(baseSnapshot.darkSunRenderState?.direction)) {
        simulationState.darkSunBandDirection = baseSnapshot.darkSunRenderState.direction >= 0 ? 1 : -1;
      }
    } else if (isSolarStagingActive) {
      updateDarkSunStageOrbit(0);
    } else if (isLunarStagingActive) {
      updateDarkSunLunarStageOrbit(0);
    }

    const sunRenderState = baseSnapshot.sunRenderState;
    const moonRenderState = baseSnapshot.moonRenderState;
    orbitSun.position.copy(baseSnapshot.sunRenderPosition ?? baseSnapshot.sunPosition);
    orbitMoon.position.copy(baseSnapshot.moonRenderPosition ?? baseSnapshot.moonPosition);

    let darkSunRenderState = baseSnapshot.darkSunRenderState;

    if (simulationState.darkSunStageAltitudeLock) {
      applyDarkSunStageTransitPosition({
        sunBody: orbitSunBody,
        sunGroup: orbitSun,
        sunRadius: ORBIT_SUN_SIZE,
        darkSunBody: orbitDarkSunBody,
        darkSunGroup: orbitDarkSun,
        darkSunRadius: ORBIT_DARK_SUN_SIZE
      });
      darkSunRenderState = astronomyApi.getDarkSunRenderState({
        direction: simulationState.darkSunBandDirection,
        orbitAngleRadians: simulationState.orbitDarkSunAngle,
        orbitMode: simulationState.orbitMode,
        progress: simulationState.darkSunBandProgress,
        source: "demo",
        useExplicitOrbit: true
      });
    } else {
      orbitDarkSun.position.copy(baseSnapshot.darkSunRenderPosition ?? darkSunRenderState?.position ?? orbitDarkSun.position);
    }

    astronomyApi.updateSunTrail();
    astronomyApi.updateDarkSunTrail();
    astronomyApi.updateMoonTrail();
    astronomyApi.updateSeasonPresentation(
      projectedRadiusFromLatitude(baseSnapshot.sun.latitudeDegrees, DISC_RADIUS)
    );
    astronomyApi.updateDayNightOverlayFromSun(
      baseSnapshot.sun.latitudeDegrees,
      baseSnapshot.sun.longitudeDegrees
    );
    
    snapshot = {
      date: projectionDate,
      sun: baseSnapshot.sun,
      moon: baseSnapshot.moon,
      moonPhase: baseSnapshot.moonPhase ?? getMoonPhase(projectionDate),
      darkSunRenderState,
      darkSunRenderPosition: orbitDarkSun.position.clone(),
      solarEclipse: baseSnapshot.solarEclipse ?? createSolarEclipseState(),
      sunPosition: orbitSun.position.clone(),
      sunRenderState,
      sunRenderPosition: orbitSun.position.clone(),
      sunDisplayHorizontal: baseSnapshot.sunDisplayHorizontal ?? astronomyApi.getSunDisplayHorizontalFromPosition(orbitSun.position),
      moonPosition: orbitMoon.position.clone(),
      moonRenderPosition: orbitMoon.position.clone(),
      moonRenderState
    };
    astronomyApi.updateAstronomyUi(snapshot);
  }

  const constellationSeasonalAngle = (
    astronomyState.enabled || simulationState.useRealityTimelineInDemo !== false
  )
    ? getSeasonalEclipticAngle(projectionDate)
    : -simulationState.orbitSeasonPhase;
  const zodiacAgeOffset = getZodiacAgeOffsetRadians(projectionDate);
  constellationApi.setSeasonalEclipticAngle(constellationSeasonalAngle);
  zodiacWheelApi.setSeasonalAngle(constellationSeasonalAngle);
  zodiacWheelApi.setAgeOffset(zodiacAgeOffset);
  zodiacWheelApi.setSuppressed(walkerState.enabled);
  constellationTabApi.refreshDynamicState();

  dome.visible = true;
  domeRing.visible = true;

  walkerApi.updateWalkerMovement(deltaSeconds);
  walkerApi.updateWalkerAvatar();
  walkerApi.updateWalkerPerspectiveGuides();
  walkerApi.updateFirstPersonOverlay();
  routeSimulationApi.update(deltaSeconds);
  syncRouteCameraTracking();
  rocketApi.update(deltaSeconds);
  (function updateRocketTelemetry() {
    const panel = document.getElementById("rocket-telemetry-panel");
    if (!panel) return;
    const tel = rocketApi.getTelemetry();
    if (!tel) { panel.style.display = "none"; return; }
    panel.style.display = "";
    document.getElementById("tel-mission").textContent = tel.missionLabel ?? "-";
    document.getElementById("tel-vehicle").textContent = tel.vehicleLabel ?? "-";
    document.getElementById("tel-state").textContent = getRocketStateLabel(tel.state);
    document.getElementById("tel-alt").textContent = `${tel.altitude}%`;
    document.getElementById("tel-speed").textContent = `${tel.speed} u/s`;
    document.getElementById("tel-stage-t").textContent = `${tel.stageTimer}s`;
    document.getElementById("tel-scrape-t").textContent = tel.state === "SCRAPE" ? `${tel.scrapeTimer}s` : "-";
    document.getElementById("tel-debris").textContent = `${tel.debrisCount}`;
  })();
  syncRocketCameraAndUi();
  astronomyApi.syncSeasonalSunUi();
  if (snapshot) {
    walkerApi.updateWalkerUi(snapshot);
  }
  updateRenderState();
  syncPreparationPresentation();
  celestialTrackingCameraApi.update();
  cameraApi.updateCamera();
  domeWaterApi.update(deltaSeconds, camera.position);
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
        constellationPrecessionAngle: constellationSeasonalAngle,
        constellationSeasonalAngle,
        dateIso: snapshot.date?.toISOString?.() ?? null,
        simulationDateIso: projectionDate?.toISOString?.() ?? null,
        accelerationRate: celestialControlState.speedMultiplier ?? null,
        zodiacAgeOffset,
        sunPos: snapshot.sunPosition,
        sunAngle: simulationState.orbitSunAngle,
        moonAngle: simulationState.orbitMoonAngle,
        darkSunAngle: simulationState.orbitDarkSunAngle,
        sunBandProgress: simulationState.sunBandProgress,
        moonBandProgress: simulationState.moonBandProgress,
        darkSunBandProgress: simulationState.darkSunBandProgress,
        moonSunBandDelta: (simulationState.moonBandProgress ?? 0) - (simulationState.sunBandProgress ?? 0),
        darkSunSunBandDelta: (simulationState.darkSunBandProgress ?? 0) - (simulationState.sunBandProgress ?? 0),
        moonPos: snapshot.moonPosition, 
        darkSunPos: snapshot.darkSunRenderPosition,
        activeLunarEclipseData: snapshot.activeLunarEclipseData ?? null
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

const ONBOARDING_STORAGE_KEY = "flat-earth-onboarding-v1";

function runOnboarding() {
  try {
    if (window.localStorage.getItem(ONBOARDING_STORAGE_KEY)) return;
  } catch { return; }

  if (currentLayoutMode !== "hud") return;

  const calloutEl = document.getElementById("onboarding-callout");
  const textEl = document.getElementById("onboarding-callout-text");
  const skipEl = document.getElementById("onboarding-skip");
  if (!calloutEl || !textEl) return;

  const STEPS = [
    { tab: "astronomy",      key: "onboardingAstronomy" },
    { tab: "routes",         key: "onboardingRoutes" },
    { tab: "constellations", key: "onboardingConstellations" },
    { tab: "rockets",        key: "onboardingRockets" },
  ];

  let step = 0;
  let timer = null;
  let done = false;

  function finish() {
    if (done) return;
    done = true;
    clearTimeout(timer);
    calloutEl.classList.remove("visible");
    for (const btn of controlTabButtons) btn.classList.remove("onboarding-active");
    try { window.localStorage.setItem(ONBOARDING_STORAGE_KEY, "1"); } catch {}
    document.removeEventListener("pointerdown", onSkip, true);
  }

  function onSkip() { finish(); }

  function showStep(index) {
    if (done || index >= STEPS.length) { finish(); return; }
    const { tab, key } = STEPS[index];

    for (const btn of controlTabButtons) btn.classList.remove("onboarding-active");
    const activeBtn = controlTabButtons.find(b => b.dataset.controlTab === tab);
    if (activeBtn) {
      activeBtn.classList.add("onboarding-active");
      const rect = activeBtn.getBoundingClientRect();
      const midX = rect.left + rect.width / 2;
      calloutEl.style.top = (rect.bottom + 10) + "px";
      calloutEl.style.left = midX + "px";
      calloutEl.style.transform = "translateX(-50%)";
    }

    textEl.textContent = i18n.t(key);
    if (skipEl) skipEl.textContent = i18n.t("onboardingSkip");
    calloutEl.classList.add("visible");

    timer = setTimeout(() => showStep(index + 1), 1900);
  }

  document.addEventListener("pointerdown", onSkip, true);
  if (skipEl) skipEl.addEventListener("click", (e) => { e.stopPropagation(); finish(); });

  setTimeout(() => showStep(0), 1000);
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
runOnboarding();

// ?? ?섎떒 ?⑤꼸 ?묎린 ??????????????????????????
(function initDetailPanelCollapse() {
  const btn = document.getElementById('detail-panel-collapse');
  const shell = btn && btn.closest('.detail-panel-shell');
  if (!btn || !shell) return;

  const STORAGE_KEY = 'flat-earth-detail-collapsed';
  const collapsed = localStorage.getItem(STORAGE_KEY) === '1';
  if (collapsed) shell.classList.add('detail-panel-shell--collapsed');

  btn.addEventListener('click', () => {
    const isCollapsed = shell.classList.toggle('detail-panel-shell--collapsed');
    try { localStorage.setItem(STORAGE_KEY, isCollapsed ? '1' : '0'); } catch {}
    btn.title = isCollapsed ? "Expand details" : "Collapse details";
    btn.setAttribute("aria-label", isCollapsed ? "Expand details" : "Collapse details");
  });
})();

// Sunset/Sunrise timelapse
(function initSunsetTimelapse() {
  const btn = document.getElementById('watch-sunset-btn');
  if (!btn) return;

  const STEP_MS = 60 * 1000;
  const AIM_LERP = 0.06;
  let active = false;
  let targetEvent = 'sunset';
  let aimHeading = null;

  function getSunAltitudeDeg() {
    const sunPos = orbitSun.position;
    const wx = walkerState.position.x;
    const wz = walkerState.position.z;
    const eyeH = constants.WALKER_EYE_HEIGHT || 0;
    const dx = sunPos.x - wx;
    const dz = sunPos.z - wz;
    const dy = Math.max(sunPos.y - eyeH, 0.0001);
    const planar = Math.hypot(dx, dz);
    const raw = THREE.MathUtils.radToDeg(Math.atan2(dy, planar));
    return raw - (constants.LOCAL_LIGHT_HORIZON_OFFSET_DEGREES || 22);
  }

  function getSunHeading() {
    const sunPos = orbitSun.position;
    return Math.atan2(sunPos.x - walkerState.position.x, sunPos.z - walkerState.position.z);
  }

  function updateLabel() {
    if (active) {
      btn.textContent = i18n.t('stopTimelapse');
    } else if (getSunAltitudeDeg() > 5) {
      btn.textContent = i18n.t('watchSunsetButton');
    } else {
      btn.textContent = i18n.t('watchSunriseButton');
    }
  }

  function stop() {
    active = false;
    aimHeading = null;
    updateLabel();
  }

  function tick() {
    if (!active) return;
    if (renderState.preparing) { requestAnimationFrame(tick); return; }
    if (!walkerState.enabled) { stop(); return; }

    const alt = getSunAltitudeDeg();
    const done = targetEvent === 'sunset' ? alt < -1.5 : alt > 4;
    if (done) { stop(); return; }

    astronomyState.live = false;
    astronomyState.selectedDate = new Date(astronomyState.selectedDate.getTime() + STEP_MS);
    if (astronomyApi.syncLiveObservationInput) {
      astronomyApi.syncLiveObservationInput(astronomyState.selectedDate);
    }

    const target = getSunHeading();
    if (aimHeading === null) aimHeading = target;
    let delta = target - aimHeading;
    if (delta > Math.PI) delta -= Math.PI * 2;
    if (delta < -Math.PI) delta += Math.PI * 2;
    aimHeading += delta * AIM_LERP;
    walkerState.heading = aimHeading;
    walkerState.pitch = THREE.MathUtils.clamp(
      THREE.MathUtils.degToRad(getSunAltitudeDeg() * 0.6),
      -1.08, 0.72
    );

    requestAnimationFrame(tick);
  }

  btn.addEventListener('click', () => {
    if (active) { stop(); return; }
    if (!walkerState.enabled) {
      enterFirstPersonMode();
    }
    const alt = getSunAltitudeDeg();
    targetEvent = alt > 5 ? 'sunset' : 'sunrise';
    active = true;
    aimHeading = null;
    updateLabel();
    requestAnimationFrame(tick);
  });

  updateLabel();
  document.addEventListener('i18n-updated', () => { if (!active) updateLabel(); });
})();
