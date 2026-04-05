import * as THREE from "../../vendor/three.module.js";
import {
  formatGeoPair,
  formatLatitude,
  getGeoFromGlobePosition,
  getGlobeBasisFromGeo,
  getGeoFromProjectedPosition,
  projectedRadiusFromLatitude,
  toDatetimeLocalValue,
  latitudeFromProjectedRadius
} from "./geo-utils.js";
import {
  createSolarEclipseState,
  getAstronomySnapshot as buildAstronomySnapshot,
  getMoonEclipticLatitudeDegrees,
  getMoonPhase,
  getMoonSubpoint,
  getSunSubpoint,
  getSeasonalEventMoments,
  getSeasonalMoonAudit,
  getSeasonalSunAudit,
  getMoonHorizontalCoordinates,
  getSunHorizontalCoordinates,
  SEASONAL_EVENT_DEFINITIONS
} from "./astronomy-utils.js?v=20260324-moon-cycle28";
import {
  createEclipseCatalogFromCsvText,
  formatEclipseEventLabel,
  getBuiltInEclipseCatalog,
  getCatalogEventsForYear,
  getCatalogStats,
  getCatalogYears,
  getClosestCatalogYear,
  getEclipseAlignmentTarget,
  getEclipseEventTimeMs,
  getPreferredCatalogEvent
} from "./eclipse-events-utils.js?v=20260325-eclipse-selector1";

export function createAstronomyController({
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
}) {
  const scaleDimension = (value) => value * (constants.MODEL_SCALE ?? 1);
  const seasonalEventMap = new Map(
    SEASONAL_EVENT_DEFINITIONS.map((definition) => [definition.key, definition])
  );
  const sunFullTrailPoints = [];
  const sunTrailPoints = [];
  const moonFullTrailPoints = [];
  const moonTrailPoints = [];
  const darkSunFullTrailPoints = [];
  const darkSunTrailPoints = [];
  const analemmaPoints = [];
  const skyAnalemmaPoints = [];
  const skyAnalemmaSegments = [];
  const tempNorthAxis = new THREE.Vector3();
  const tempEastAxis = new THREE.Vector3();
  const tempUpAxis = new THREE.Vector3(0, 1, 0);
  const tempSkyPoint = new THREE.Vector3();
  const tempSkyOrigin = new THREE.Vector3();
  const tempHorizontalRelative = new THREE.Vector3();
  const tempRadialAxis = new THREE.Vector3();
  const WALKER_EYE_OFFSET = Math.max(
    constants.WALKER_EYE_HEIGHT - constants.SURFACE_Y,
    scaleDimension(0.05)
  );
  const DARK_SUN_REFERENCE_TIME_MS = Date.parse("2026-01-01T00:00:00Z");
  const DARK_SUN_START_ANGLE = Math.PI;
  const DARK_SUN_START_PROGRESS = 0.88;
  const DARK_SUN_START_DIRECTION = -1;
  const DARK_SUN_ORBIT_SPEED_FACTOR = 0.72;
  const DARK_SUN_BAND_SPEED_FACTOR = 1.08;
  const DARK_SUN_MS_PER_ORBIT_FRAME = (
    (24 * 3600 * 1000) * constants.ORBIT_SUN_SPEED / (2 * Math.PI)
  );
  let lastSeasonalSunKey = "";
  let lastSolarEclipseState = createSolarEclipseState();
  const bandCenterProgressByMode = {
    north: 0.5,
    equator: 0.5,
    south: 0.5
  };
  const ECLIPSE_TIME_POINT_VALUES = ["start", "peak", "end"];

  if (!Number.isFinite(simulationState.demoPhaseDateMs)) {
    simulationState.demoPhaseDateMs = astronomyState.selectedDate.getTime();
  }
  if (simulationState.useRealityTimelineInDemo === undefined) {
    simulationState.useRealityTimelineInDemo = true;
  }
  if (!Number.isFinite(simulationState.demoAnchorSimMs)) {
    simulationState.demoAnchorSimMs = simulationState.demoPhaseDateMs;
  }
  if (!Number.isFinite(simulationState.demoAnchorRealMs)) {
    simulationState.demoAnchorRealMs = performance.now();
  }
  if (!Number.isFinite(simulationState.simulatedDateMs)) {
    simulationState.simulatedDateMs = simulationState.demoPhaseDateMs;
  }
  if (!Number.isFinite(simulationState.timelineAnchorDateMs)) {
    simulationState.timelineAnchorDateMs = simulationState.demoAnchorSimMs;
  }
  if (!Number.isFinite(simulationState.timelineAnchorNowMs)) {
    simulationState.timelineAnchorNowMs = simulationState.demoAnchorRealMs;
  }

  function getEclipseTypeLabel(type = "") {
    switch (type) {
      case "annular":
        return i18n.t("eclipseTypeAnnular");
      case "hybrid":
        return i18n.t("eclipseTypeHybrid");
      case "partial":
        return i18n.t("eclipseTypePartial");
      case "penumbral":
        return i18n.t("eclipseTypePenumbral");
      case "total":
        return i18n.t("eclipseTypeTotal");
      default:
        return type || "-";
    }
  }

  function getEclipseKindLabel(kind = "solar") {
    return i18n.t(kind === "lunar" ? "eclipseKindLunar" : "eclipseKindSolar");
  }

  function getEclipseTimePointLabel(timePoint = "peak") {
    switch (timePoint) {
      case "start":
        return i18n.t("eclipseTimePointStart");
      case "end":
        return i18n.t("eclipseTimePointEnd");
      case "peak":
      default:
        return i18n.t("eclipseTimePointPeak");
    }
  }

  function sanitizeSeasonalYear(value) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) {
      return astronomyState.selectedDate.getFullYear();
    }
    return THREE.MathUtils.clamp(parsed, 1900, 2100);
  }

  function formatSignedDegrees(value) {
    const prefix = value > 0 ? "+" : "";
    return `${prefix}${value.toFixed(1)}deg`;
  }

  function formatAltitude(value) {
    const prefix = value > 0 ? "+" : "";
    return `${prefix}${value.toFixed(1)}deg`;
  }

  function formatAngleDegrees(value) {
    const normalizedDegrees = THREE.MathUtils.radToDeg(
      THREE.MathUtils.euclideanModulo(value ?? 0, Math.PI * 2)
    );
    return `${normalizedDegrees.toFixed(1)}deg`;
  }

  function formatModelHeight(value) {
    const prefix = value > 0 ? "+" : "";
    return `${prefix}${(value ?? 0).toFixed(2)}`;
  }

  function formatIllumination(fraction) {
    return `${Math.round(THREE.MathUtils.clamp(fraction ?? 0, 0, 1) * 100)}%`;
  }

  function getTrailLengthFactor() {
    return THREE.MathUtils.clamp(celestialControlState?.trailLengthFactor ?? 1, 0, 1);
  }

  function getSpeedMultiplier() {
    return THREE.MathUtils.clamp(
      celestialControlState?.speedMultiplier ?? constants.CELESTIAL_SPEED_DEFAULT,
      constants.CELESTIAL_SPEED_MIN,
      constants.CELESTIAL_SPEED_MAX
    );
  }

  function formatSpeedMultiplier(value = getSpeedMultiplier()) {
    const clamped = THREE.MathUtils.clamp(
      value,
      constants.CELESTIAL_SPEED_MIN,
      constants.CELESTIAL_SPEED_MAX
    );
    if (clamped >= 10) {
      return String(Math.round(clamped));
    }
    return clamped.toFixed(1).replace(/\.0$/, "");
  }

  function isAcceleratedRealityMode() {
    return !astronomyState.enabled && simulationState.useRealityTimelineInDemo !== false;
  }

  function getSafeDate(date = new Date()) {
    if (date instanceof Date && !Number.isNaN(date.getTime())) {
      return new Date(date.getTime());
    }
    return new Date();
  }

  function setAcceleratedTimelineAnchor(date = astronomyState.selectedDate, {
    live = astronomyState.live,
    nowMs = performance.now(),
    refreshControls = true,
    syncInput = true
  } = {}) {
    const safeDate = getSafeDate(date);
    const safeDateMs = safeDate.getTime();
    const safeNowMs = Number.isFinite(nowMs) ? nowMs : performance.now();

    astronomyState.live = Boolean(live);
    astronomyState.selectedDate = safeDate;
    simulationState.simulatedDateMs = safeDateMs;
    simulationState.timelineAnchorDateMs = safeDateMs;
    simulationState.timelineAnchorNowMs = safeNowMs;
    simulationState.demoPhaseDateMs = safeDateMs;
    simulationState.demoAnchorSimMs = safeDateMs;
    simulationState.demoAnchorRealMs = safeNowMs;
    simulationState.useRealityTimelineInDemo = true;

    if (syncInput) {
      setObservationInputValue(safeDate);
    }
    if (refreshControls) {
      syncAstronomyControls();
    }
    return safeDate;
  }

  function rebaseAcceleratedTimeline(nowMs = performance.now()) {
    const anchorDate = Number.isFinite(simulationState.simulatedDateMs)
      ? new Date(simulationState.simulatedDateMs)
      : astronomyState.selectedDate;
    setAcceleratedTimelineAnchor(anchorDate, {
      live: astronomyState.live,
      nowMs,
      refreshControls: false,
      syncInput: false
    });
  }

  function getAcceleratedSimulationDate({
    nowMs = performance.now(),
    speedMultiplier = getSpeedMultiplier()
  } = {}) {
    const safeNowMs = Number.isFinite(nowMs) ? nowMs : performance.now();
    const effectiveSpeed = THREE.MathUtils.clamp(
      speedMultiplier,
      constants.CELESTIAL_SPEED_MIN,
      constants.CELESTIAL_SPEED_MAX
    );
    if (
      !Number.isFinite(simulationState.timelineAnchorNowMs) ||
      !Number.isFinite(simulationState.timelineAnchorDateMs)
    ) {
      setAcceleratedTimelineAnchor(astronomyState.selectedDate, {
        live: astronomyState.live,
        nowMs: safeNowMs,
        refreshControls: false,
        syncInput: false
      });
    }

    const elapsedMs = safeNowMs - simulationState.timelineAnchorNowMs;
    const simulatedMs = simulationState.timelineAnchorDateMs + (elapsedMs * effectiveSpeed * 1000);
    const simulatedDate = new Date(simulatedMs);
    simulationState.simulatedDateMs = simulatedMs;
    simulationState.demoPhaseDateMs = simulatedMs;
    simulationState.demoAnchorSimMs = simulationState.timelineAnchorDateMs;
    simulationState.demoAnchorRealMs = simulationState.timelineAnchorNowMs;
    astronomyState.selectedDate = simulatedDate;
    syncLiveObservationInput(simulatedDate);
    return simulatedDate;
  }

  function getCurrentTrailPointLimit(baseCount) {
    const factor = getTrailLengthFactor();
    if (factor <= 0) {
      return 0;
    }
    return Math.max(2, Math.round(baseCount * factor));
  }

  function getRealityCurrentTrailWindowMs() {
    return constants.REALITY_TRAIL_WINDOW_MS * getTrailLengthFactor();
  }

  function getRealityCurrentTrailSampleCount(baseCount) {
    const factor = getTrailLengthFactor();
    if (factor <= 0) {
      return 0;
    }
    return Math.max(2, Math.round(baseCount * factor));
  }

  function formatObservationTime(date) {
    return i18n.formatDate(date, {
      dateStyle: "medium",
      timeStyle: "medium"
    });
  }

  function formatSeasonalEventTime(date) {
    return i18n.formatDate(date, {
      dateStyle: "medium",
      timeStyle: "short"
    });
  }

  function formatAnalemmaTime(date) {
    return i18n.formatDate(date, {
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  const seasonalEventFormatter = {
    format(date) {
      return formatSeasonalEventTime(date);
    }
  };

  function applyCelestialAltitudeOffset(horizontal) {
    const altitudeDegrees = THREE.MathUtils.clamp(
      horizontal.altitudeDegrees - constants.CELESTIAL_ALTITUDE_DROP_DEGREES,
      -89.9,
      89.9
    );

    return {
      ...horizontal,
      altitudeDegrees,
      altitudeRadians: THREE.MathUtils.degToRad(altitudeDegrees)
    };
  }

  function getSeasonalEventLabel(key) {
    switch (key) {
      case "springEquinox":
        return i18n.t("seasonalEventSpringEquinox");
      case "summerSolstice":
        return i18n.t("seasonalEventSummerSolstice");
      case "autumnEquinox":
        return i18n.t("seasonalEventAutumnEquinox");
      case "winterSolstice":
        return i18n.t("seasonalEventWinterSolstice");
      default:
        return key;
    }
  }

  function getAltitudeSummary(value) {
    if (value > 0.5) {
      return i18n.t("altitudeSummaryAbove");
    }
    if (value < -0.5) {
      return i18n.t("altitudeSummaryBelow");
    }
    return i18n.t("altitudeSummaryOn");
  }

  function getObserverGeo() {
    if (Number.isFinite(walkerState.latitudeDegrees) && Number.isFinite(walkerState.longitudeDegrees)) {
      return {
        latitudeDegrees: walkerState.latitudeDegrees,
        longitudeDegrees: walkerState.longitudeDegrees
      };
    }

    return getGeoFromGlobePosition(
      walkerState.position,
      { x: 0, y: 0, z: 0 },
      Math.max(walkerState.surfaceRadius ?? 1, 0.0001)
    );
  }

  function getMoonPhaseLabel(moonPhase) {
    return i18n.t(moonPhase?.labelKey ?? "moonPhaseFull");
  }

  function getMoonDirectionLabel(moonPhase) {
    const phaseProgress = THREE.MathUtils.euclideanModulo(moonPhase?.phaseProgress ?? 0, 1);
    return i18n.t(phaseProgress < 0.5 ? "moonDirectionWaxing" : "moonDirectionWaning");
  }

  function getSolarEclipseStageLabel(solarEclipse) {
    return i18n.t(solarEclipse?.stageLabelKey ?? "solarEclipseStageIdle");
  }

  function getSolarEclipseSummaryKey(solarEclipse) {
    switch (solarEclipse?.stageKey) {
      case "approach":
        return "solarEclipseSummaryApproach";
      case "partialIngress":
        return "solarEclipseSummaryPartialIngress";
      case "totality":
        return "solarEclipseSummaryTotality";
      case "partialEgress":
        return "solarEclipseSummaryPartialEgress";
      case "complete":
        return "solarEclipseSummaryComplete";
      case "idle":
        return solarEclipse?.visibleInView ? "solarEclipseSummaryIdle" : "solarEclipseSummaryHidden";
      default:
        return solarEclipse?.active
          ? "solarEclipseSummaryActive"
          : "solarEclipseSummaryHidden";
    }
  }

  function getDarkSunDebugBandLabel(orbitMode = "auto") {
    switch (orbitMode) {
      case "north":
        return i18n.t("darkSunDebugBandNorth");
      case "equator":
        return i18n.t("darkSunDebugBandEquator");
      case "south":
        return i18n.t("darkSunDebugBandSouth");
      default:
        return i18n.t("darkSunDebugBandAuto");
    }
  }

  function getDarkSunDebugBandLabelFromIndex(bandIndex = 1) {
    switch (bandIndex) {
      case 0:
        return i18n.t("darkSunDebugBandNorth");
      case 2:
        return i18n.t("darkSunDebugBandSouth");
      default:
        return i18n.t("darkSunDebugBandEquator");
    }
  }

  function getSolarEclipseTierFromRenderStates(sunRenderState, darkSunRenderState) {
    const sunBandIndex = Number.isFinite(sunRenderState?.bandIndex) ? sunRenderState.bandIndex : null;
    const darkBandIndex = Number.isFinite(darkSunRenderState?.bandIndex) ? darkSunRenderState.bandIndex : null;
    const sunLaneIndex = Number.isFinite(sunRenderState?.laneIndex) ? sunRenderState.laneIndex : null;
    const darkLaneIndex = Number.isFinite(darkSunRenderState?.laneIndex) ? darkSunRenderState.laneIndex : null;
    const bandDelta = (sunBandIndex === null || darkBandIndex === null)
      ? Number.POSITIVE_INFINITY
      : Math.abs(sunBandIndex - darkBandIndex);
    const laneDelta = (sunLaneIndex === null || darkLaneIndex === null)
      ? Number.POSITIVE_INFINITY
      : Math.abs(sunLaneIndex - darkLaneIndex);
    let eclipseTier = "none";

    if (bandDelta === 0) {
      if (laneDelta <= 1) {
        eclipseTier = "total-eligible";
      } else if (laneDelta === 2) {
        eclipseTier = "partial-eligible-2";
      } else if (laneDelta === 3) {
        eclipseTier = "partial-eligible-3";
      }
    }

    return {
      bandDelta,
      eclipseTier,
      laneDelta
    };
  }

  function syncDarkSunDebugUi(snapshot) {
    if (!ui.darkSunDebugSummaryEl) {
      return;
    }

    const debugVisible = Boolean(simulationState.darkSunDebugVisible);
    ui.darkSunDebugSummaryEl.hidden = !debugVisible;

    if (!debugVisible) {
      ui.darkSunDebugSummaryEl.textContent = "";
      return;
    }

    const darkSunPosition = snapshot?.darkSunRenderPosition ?? orbitDarkSun?.position;
    if (!darkSunPosition) {
      ui.darkSunDebugSummaryEl.textContent = i18n.t("darkSunDebugUnavailable");
      return;
    }

    const darkSunRenderState = snapshot?.darkSunRenderState ?? null;
    const sunRenderState = snapshot?.sunRenderState ?? null;
    const darkSunGeo = getGeoFromProjectedPosition(darkSunPosition, constants.DISC_RADIUS);
    const orbitAngleRadians = darkSunRenderState?.orbitAngleRadians ?? simulationState.orbitDarkSunAngle;
    const phaseOffsetRadians = simulationState.darkSunOrbitPhaseOffsetRadians ?? DARK_SUN_START_ANGLE;
    const bandMode = darkSunRenderState?.orbitMode ?? getMirroredOrbitMode(simulationState.orbitMode);
    const bandLabel = getDarkSunDebugBandLabel(bandMode);
    const bandProgress = THREE.MathUtils.clamp(
      darkSunRenderState?.corridorProgress ?? darkSunRenderState?.macroProgress ?? simulationState.darkSunBandProgress ?? 0.5,
      0,
      1
    );
    const sunBandLabel = getDarkSunDebugBandLabelFromIndex(sunRenderState?.bandIndex);
    const darkBandLabel = getDarkSunDebugBandLabelFromIndex(darkSunRenderState?.bandIndex);
    const sunLaneIndex = Number.isFinite(sunRenderState?.laneIndex) ? (sunRenderState.laneIndex + 1) : null;
    const darkLaneIndex = Number.isFinite(darkSunRenderState?.laneIndex) ? (darkSunRenderState.laneIndex + 1) : null;
    const eclipseEligibility = getSolarEclipseTierFromRenderStates(sunRenderState, darkSunRenderState);
    const sourceLabel = (astronomyState.enabled || isAcceleratedRealityMode())
      ? i18n.t("darkSunDebugSourceReality")
      : i18n.t("darkSunDebugSourceDemo");
    const lockLabel = simulationState.darkSunStageAltitudeLock
      ? i18n.t("darkSunDebugLockStage")
      : i18n.t("darkSunDebugLockMirrored");

    ui.darkSunDebugSummaryEl.textContent = [
      `Geo ${formatGeoPair(darkSunGeo.latitudeDegrees, darkSunGeo.longitudeDegrees)}`,
      `Y ${formatModelHeight(darkSunPosition.y)}`,
      `orbit ${formatAngleDegrees(orbitAngleRadians)}`,
      `phase ${formatAngleDegrees(phaseOffsetRadians)}`,
      `band ${bandLabel} ${Math.round(bandProgress * 100)}%`,
      `corridor ${sunBandLabel}/${darkBandLabel}`,
      `lane ${(sunLaneIndex ?? "--")}/${(darkLaneIndex ?? "--")}`,
      `lane-delta ${Number.isFinite(eclipseEligibility.laneDelta) ? eclipseEligibility.laneDelta : "--"}`,
      `tier ${eclipseEligibility.eclipseTier}`,
      `${sourceLabel} / ${lockLabel}`
    ].join(" | ");
  }

  function syncMoonPhaseUi(snapshot) {
    if (!snapshot || !ui.moonPhasePointerEl) {
      return;
    }

    const moonPhase = snapshot.moonPhase ?? {};
    const phaseAngleDegrees = THREE.MathUtils.euclideanModulo(moonPhase.phaseAngleDegrees ?? 0, 360);
    const phaseStepNumber = moonPhase.phaseStepNumber ?? 1;
    const phaseStepCount = moonPhase.phaseStepCount ?? 16;

    ui.moonPhasePointerEl.style.setProperty("--moon-phase-angle", `${phaseAngleDegrees}deg`);
    ui.moonPhaseLabelEl.textContent = getMoonPhaseLabel(moonPhase);
    ui.moonPhaseDegreesEl.textContent = i18n.t("moonPhaseDegreesValue", {
      angle: phaseAngleDegrees.toFixed(1)
    });
    ui.moonPhaseStepEl.textContent = i18n.t("moonPhaseStepValue", {
      step: phaseStepNumber,
      total: phaseStepCount
    });
    ui.moonPhaseDirectionEl.textContent = getMoonDirectionLabel(moonPhase);
  }

  function getOrbitLatitudeRatio(radius) {
    return THREE.MathUtils.clamp(latitudeFromProjectedRadius(radius, constants.DISC_RADIUS) / constants.TROPIC_LATITUDE, -1, 1);
  }

  function getSunOrbitHeight(radius) {
    const ratio = getOrbitLatitudeRatio(radius);
    return THREE.MathUtils.mapLinear(ratio, -1, 1, constants.ORBIT_SUN_HEIGHT_SOUTH, constants.ORBIT_SUN_HEIGHT_NORTH);
  }

  function getDomeMaxHeight(radius, clearance) {
    const clampedRadius = THREE.MathUtils.clamp(radius, 0, constants.DOME_RADIUS);
    const domeRise = Math.sqrt(Math.max(0, (constants.DOME_RADIUS ** 2) - (clampedRadius ** 2)));
    return (
      constants.DOME_BASE_Y +
      (domeRise * constants.DOME_VERTICAL_SCALE) -
      clearance
    );
  }

  function getHorizontalFromModelPosition(position, observerPosition = walkerState.position, observerGeo = getObserverGeo()) {
    getObserverSkyAxes(observerPosition, observerGeo);
    tempSkyOrigin.copy(observerPosition).addScaledVector(tempUpAxis, WALKER_EYE_OFFSET);
    tempHorizontalRelative.copy(position).sub(tempSkyOrigin);

    const northComponent = tempHorizontalRelative.dot(tempNorthAxis);
    const eastComponent = tempHorizontalRelative.dot(tempEastAxis);
    const upComponent = tempHorizontalRelative.dot(tempUpAxis);
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

  function getSunDisplayHorizontalFromPosition(position, observerPosition = walkerState.position, observerGeo = getObserverGeo()) {
    return applyCelestialAltitudeOffset(getHorizontalFromModelPosition(position, observerPosition, observerGeo));
  }

  function getMoonBaseHeight(radius) {
    const ratio = getOrbitLatitudeRatio(radius);
    return THREE.MathUtils.mapLinear(ratio, -1, 1, constants.ORBIT_MOON_HEIGHT_SOUTH, constants.ORBIT_MOON_HEIGHT_NORTH);
  }

  function getBodyCoilConfig(body) {
    if (body === "moon") {
      return {
        baseClearance: constants.ORBIT_TRACK_TUBE_RADIUS + (constants.ORBIT_MOON_SIZE * 1.08),
        bodyClearance: constants.ORBIT_MOON_SIZE * 1.08,
        domeClearance: constants.ORBIT_MOON_SIZE * 0.96,
        localRadiusMax: scaleDimension(0.15),
        localRadiusMin: scaleDimension(0.036),
        riseRange: scaleDimension(1.12),
        tangentialScale: 0.74
      };
    }

    return {
      baseClearance: constants.SUN_COIL_BASE_CLEARANCE,
      bodyClearance: constants.ORBIT_SUN_SIZE * 1.12,
      domeClearance: constants.SUN_COIL_DOME_CLEARANCE * 0.62,
      localRadiusMax: scaleDimension(0.18),
      localRadiusMin: scaleDimension(0.042),
      riseRange: scaleDimension(1.48),
      tangentialScale: 0.82
    };
  }

  function getCoilOrbitProfile(body = "sun") {
    return magneticFieldApi?.getCoilOrbitProfile?.(body) ?? {
      turns: body === "moon" ? 24 : 32,
      radiusCurveExponent: body === "moon" ? 1.42 : 1.65,
      radiusStart: scaleDimension(0.08),
      radiusEnd: scaleDimension(body === "moon" ? 0.24 : 0.34),
      yStart: constants.SURFACE_Y,
      yEnd: constants.DOME_BASE_Y + scaleDimension(body === "moon" ? 1.6 : 2)
    };
  }

  function sampleCoilOrbitProfile(body = "sun", progress = 0) {
    return magneticFieldApi?.sampleCoilOrbitProfile?.(body, progress) ?? (() => {
      const profile = getCoilOrbitProfile(body);
      const clampedProgress = THREE.MathUtils.clamp(progress, 0, 1);
      const radiusProgress = clampedProgress ** profile.radiusCurveExponent;
      const radius = THREE.MathUtils.lerp(profile.radiusStart, profile.radiusEnd, radiusProgress);
      const radiusSpan = Math.max(profile.radiusEnd - profile.radiusStart, 0.0001);
      const y = THREE.MathUtils.lerp(profile.yStart, profile.yEnd, clampedProgress);
      const ySpan = Math.max(profile.yEnd - profile.yStart, 0.0001);

      return {
        progress: clampedProgress,
        radius,
        radiusRatio: THREE.MathUtils.clamp((radius - profile.radiusStart) / radiusSpan, 0, 1),
        y,
        yRatio: THREE.MathUtils.clamp((y - profile.yStart) / ySpan, 0, 1)
      };
    })();
  }

  function getBodyCorridorRange(body) {
    const min = constants.TROPIC_CANCER_RADIUS;
    const max = constants.TROPIC_CAPRICORN_RADIUS;
    return {
      max: Math.max(max, min + 0.0001),
      min
    };
  }

  function getBodyBandRadiusRange(body, orbitMode = "auto") {
    const corridor = getBodyCorridorRange(body);
    if (orbitMode === "auto") {
      return corridor;
    }

    const span = corridor.max - corridor.min;
    const bandSpan = span / 3;

    if (orbitMode === "north") {
      return {
        min: corridor.min,
        max: corridor.min + bandSpan
      };
    }

    if (orbitMode === "south") {
      return {
        min: corridor.max - bandSpan,
        max: corridor.max
      };
    }

    return {
      min: corridor.min + bandSpan,
      max: corridor.max - bandSpan
    };
  }

  function getBodyModeProgress(body, orbitMode = "auto", progress = 0.5) {
    if (orbitMode === "auto") {
      return THREE.MathUtils.clamp(progress, 0, 1);
    }
    return bandCenterProgressByMode[orbitMode] ?? 0.5;
  }

  function getBodyProgressFromProjectedRadius(body, projectedRadius) {
    const corridor = getBodyCorridorRange(body);
    const clampedRadius = THREE.MathUtils.clamp(projectedRadius, corridor.min, corridor.max);
    return THREE.MathUtils.clamp(
      THREE.MathUtils.inverseLerp(corridor.min, corridor.max, clampedRadius),
      0,
      1
    );
  }

  function getBodyCorridorProgress(body, centerRadius) {
    const corridor = getBodyCorridorRange(body);
    return THREE.MathUtils.clamp(
      THREE.MathUtils.inverseLerp(corridor.min, corridor.max, centerRadius),
      0,
      1
    );
  }

  function getBodyBandIndex(body, centerRadius) {
    return Math.min(2, Math.floor(getBodyCorridorProgress(body, centerRadius) * 3));
  }

  function getBodyLaneCount(body) {
    const normalizedBody = body === "darkSun" ? "sun" : body;
    return Math.max(magneticFieldApi.getCoilOrbitProfile(normalizedBody).turns, 1);
  }

  function getBodyLaneIndex(body, corridorProgress) {
    const laneCount = getBodyLaneCount(body);
    return Math.min(
      laneCount - 1,
      Math.floor(THREE.MathUtils.clamp(corridorProgress, 0, 1) * laneCount)
    );
  }

  function getBodyBaseHeight(body, radius) {
    return body === "moon"
      ? getMoonBaseHeight(radius)
      : getSunOrbitHeight(radius);
  }

  function getMirroredOrbitMode(orbitMode = "auto") {
    if (orbitMode === "north") {
      return "south";
    }
    if (orbitMode === "south") {
      return "north";
    }
    if (orbitMode === "equator") {
      return "equator";
    }
    return "auto";
  }

  function getMirroredDarkSunDirection(sunDirection = simulationState.sunBandDirection ?? 1) {
    return (sunDirection ?? 1) >= 0 ? -1 : 1;
  }

  function getMirroredDarkSunProgress(sunProgress = simulationState.sunBandProgress ?? 0.5) {
    return THREE.MathUtils.clamp(1 - (sunProgress ?? 0.5), 0, 1);
  }

  function getMirroredDarkSunOrbitAngleRadians({
    sunOrbitAngleRadians = simulationState.orbitSunAngle ?? 0,
    phaseOffsetRadians = simulationState.darkSunOrbitPhaseOffsetRadians ?? DARK_SUN_START_ANGLE
  } = {}) {
    return phaseOffsetRadians - (sunOrbitAngleRadians * DARK_SUN_ORBIT_SPEED_FACTOR);
  }

  function inferRealitySunBandDirection(date) {
    const sampleWindowMs = 12 * 60 * 60 * 1000;
    const currentSun = getSunSubpoint(date);
    const sampleSun = getSunSubpoint(new Date(date.getTime() + sampleWindowMs));
    const currentProjectedRadius = projectedRadiusFromLatitude(
      currentSun.latitudeDegrees,
      constants.DISC_RADIUS
    );
    const sampleProjectedRadius = projectedRadiusFromLatitude(
      sampleSun.latitudeDegrees,
      constants.DISC_RADIUS
    );
    const currentProgress = getBodyProgressFromProjectedRadius("sun", currentProjectedRadius);
    const sampleProgress = getBodyProgressFromProjectedRadius("sun", sampleProjectedRadius);

    if (Math.abs(sampleProgress - currentProgress) <= 0.0001) {
      return 1;
    }

    return sampleProgress >= currentProgress ? 1 : -1;
  }

  function getMirroredDarkSunState({
    orbitMode = simulationState.orbitMode ?? "auto",
    phaseOffsetRadians = simulationState.darkSunOrbitPhaseOffsetRadians ?? DARK_SUN_START_ANGLE,
    sunDirection = simulationState.sunBandDirection ?? 1,
    sunOrbitAngleRadians = simulationState.orbitSunAngle ?? 0,
    sunProgress = simulationState.sunBandProgress ?? 0.5
  } = {}) {
    return {
      direction: getMirroredDarkSunDirection(sunDirection),
      orbitAngleRadians: getMirroredDarkSunOrbitAngleRadians({
        phaseOffsetRadians,
        sunOrbitAngleRadians
      }),
      orbitMode: getMirroredOrbitMode(orbitMode),
      progress: getMirroredDarkSunProgress(sunProgress)
    };
  }

  function getBodyCoilRenderState({
    body,
    longitudeDegrees = 0,
    orbitAngleRadians = 0,
    projectedRadius = constants.EQUATOR_RADIUS,
    progress = 0.5,
    source = "reality",
    orbitMode = source === "demo" ? simulationState.orbitMode : "auto"
  }) {
    const bandRange = getBodyBandRadiusRange(body, orbitMode);
    const clampedProjectedRadius = THREE.MathUtils.clamp(
      projectedRadius,
      constants.TROPIC_CANCER_RADIUS,
      constants.TROPIC_CAPRICORN_RADIUS
    );
    const bodyProgress = source === "reality"
      ? getBodyProgressFromProjectedRadius(body, clampedProjectedRadius)
      : getBodyModeProgress(body, orbitMode, progress);
    const config = getBodyCoilConfig(body);
    const centerRadius = source === "reality"
      ? clampedProjectedRadius
      : THREE.MathUtils.lerp(bandRange.min, bandRange.max, bodyProgress);
    const corridorProgress = getBodyCorridorProgress(body, centerRadius);
    const macroAngle = source === "demo"
      ? orbitAngleRadians
      : THREE.MathUtils.degToRad(longitudeDegrees);
    const baseHeight = getBodyBaseHeight(body, centerRadius);

    tempRadialAxis.set(-Math.cos(macroAngle), 0, Math.sin(macroAngle));
    const planarX = tempRadialAxis.x * centerRadius;
    const planarZ = tempRadialAxis.z * centerRadius;
    const planarRadius = centerRadius;
    const targetHeight = baseHeight + config.baseClearance;
    const coilHeight = THREE.MathUtils.clamp(
      targetHeight,
      targetHeight,
      Math.max(targetHeight, getDomeMaxHeight(planarRadius, config.domeClearance))
    );

    return {
      baseHeight,
      bandIndex: getBodyBandIndex(body, centerRadius),
      centerRadius,
      coilHeight,
      corridorProgress,
      laneCount: getBodyLaneCount(body),
      laneIndex: getBodyLaneIndex(body, corridorProgress),
      localCoilRadius: 0,
      macroProgress: bodyProgress,
      orbitAngleRadians: macroAngle,
      orbitMode,
      position: new THREE.Vector3(
        planarX,
        coilHeight,
        planarZ
      )
    };
  }

  function getSunBandLockProgress({
    sunRenderState = null,
    sunProgress = null,
    fallbackProgress = simulationState.sunBandProgress ?? 0.5
  } = {}) {
    return THREE.MathUtils.clamp(
      sunRenderState?.corridorProgress ?? sunRenderState?.macroProgress ?? sunProgress ?? fallbackProgress ?? 0.5,
      0,
      1
    );
  }

  function getShortestAngleDeltaRadians(fromAngle = 0, toAngle = 0) {
    return Math.atan2(
      Math.sin(toAngle - fromAngle),
      Math.cos(toAngle - fromAngle)
    );
  }

  function lerpAngleRadians(fromAngle = 0, toAngle = 0, alpha = 0) {
    return fromAngle + (
      getShortestAngleDeltaRadians(fromAngle, toAngle) * THREE.MathUtils.clamp(alpha, 0, 1)
    );
  }

  function getRealitySunRenderStateAtDate(date) {
    const sun = getSunSubpoint(date);
    const projectedRadius = THREE.MathUtils.clamp(
      projectedRadiusFromLatitude(sun.latitudeDegrees, constants.DISC_RADIUS),
      0,
      constants.DOME_RADIUS - 0.2
    );

    return getSunRenderState({
      longitudeDegrees: sun.longitudeDegrees,
      projectedRadius,
      source: "reality"
    });
  }

  function getRealityMoonRenderStateAtDate(date, { sunRenderState = null } = {}) {
    const moon = getMoonSubpoint(date);
    const projectedRadius = THREE.MathUtils.clamp(
      projectedRadiusFromLatitude(moon.latitudeDegrees, constants.DISC_RADIUS),
      0,
      constants.DOME_RADIUS - 0.2
    );

    return getMoonRenderState({
      longitudeDegrees: moon.longitudeDegrees,
      orbitAngleRadians: THREE.MathUtils.degToRad(moon.longitudeDegrees),
      projectedRadius,
      sunRenderState,
      source: "reality"
    });
  }

  // ?щ줈??沅ㅻ룄: 援먯젏 洹쇱젒??횞 ?꾩긽 媛以묒튂濡??쒖뼇/??臾쇰━ ?꾩튂瑜?吏곸젒 蹂닿컙.
  // progress 留ㅽ븨??嫄곗튂吏 ?딆쑝誘濡?corridor쨌height 遺덉씪移섍? ?먯쿇 李⑤떒??
  function getDarkSunSarosOrbit(date, { sunRenderState = null, moonRenderState = null } = {}) {
    const sun = getSunSubpoint(date);
    const moonPhase = getMoonPhase(date);
    const sunAngleRadians = THREE.MathUtils.degToRad(sun.longitudeDegrees);
    const orbitAngleRadians = sunAngleRadians + moonPhase.phaseAngleRadians;

    // 援먯젏 洹쇱젒??(?⑹쐞??0째 = 1.0, 5.145째 = 0.0)
    const nodeLatDeg = getMoonEclipticLatitudeDegrees(date);
    const nodeProximity = 1 - Math.abs(THREE.MathUtils.clamp(nodeLatDeg / 5.145, -1, 1));
    const direction = nodeLatDeg >= 0 ? 1 : -1;

    // ?꾩긽 媛以묒튂: ???좎썡) = solarWeight, 留?蹂대쫫) = lunarWeight
    const cosPhase = Math.cos(moonPhase.phaseAngleRadians);
    const solarWeight = nodeProximity * Math.pow(Math.max(0, cosPhase), 2);
    const lunarWeight = nodeProximity * Math.pow(Math.max(0, -cosPhase), 2);
    const totalWeight = solarWeight + lunarWeight;

    // 以묐┰ ?꾩튂: ?쒖뼇 corridor 以묎컙, ?쒖뼇 ?믪씠
    const darkSunCorridor = getBodyCorridorRange("darkSun");
    const neutralRadius = THREE.MathUtils.lerp(darkSunCorridor.min, darkSunCorridor.max, 0.5);
    const neutralHeight = getSunOrbitHeight(neutralRadius);

    if (totalWeight <= 0.0001) {
      return { direction, orbitAngleRadians, centerRadius: neutralRadius, coilHeight: neutralHeight };
    }

    // ?쒖뼇/??render state?먯꽌 臾쇰━ ?꾩튂 吏곸젒 李몄“
    const resolvedSunState = sunRenderState ?? getRealitySunRenderStateAtDate(date);
    const resolvedMoonState = moonRenderState ?? getRealityMoonRenderStateAtDate(date, {
      sunRenderState: resolvedSunState
    });

    const solarRadius = resolvedSunState?.centerRadius ?? neutralRadius;
    const lunarRadius = resolvedMoonState?.centerRadius ?? neutralRadius;
    const solarHeight = resolvedSunState?.coilHeight ?? neutralHeight;
    const lunarHeight = resolvedMoonState?.coilHeight ?? neutralHeight;

    // 媛以??됯퇏 ??以묐┰?먯꽌 釉붾젋??
    const blendedRadius = (solarWeight * solarRadius + lunarWeight * lunarRadius) / totalWeight;
    const blendedHeight = (solarWeight * solarHeight + lunarWeight * lunarHeight) / totalWeight;
    const blendFactor = THREE.MathUtils.clamp(totalWeight / 0.25, 0, 1);

    return {
      direction,
      orbitAngleRadians,
      centerRadius: THREE.MathUtils.lerp(neutralRadius, blendedRadius, blendFactor),
      coilHeight: THREE.MathUtils.lerp(neutralHeight, blendedHeight, blendFactor)
    };
  }

  function getDarkSunEventContactOffsetRadians(mode = "solar", anchorRenderState = null) {
    const centerRadius = Math.max(anchorRenderState?.centerRadius ?? constants.EQUATOR_RADIUS, 0.0001);
    const anchorBodyRadius = mode === "solar"
      ? constants.ORBIT_SUN_SIZE
      : constants.ORBIT_MOON_SIZE;
    const contactSpan = (anchorBodyRadius + constants.ORBIT_DARK_SUN_SIZE) * 1.04;
    const contactRatio = THREE.MathUtils.clamp(contactSpan / centerRadius, 0, 0.98);
    return Math.max(2 * Math.asin(contactRatio), 0.0005);
  }

  // 移댄깉濡쒓렇 ?대깽???듭빱留? sarosOrbit ?꾩뿉 NASA ?대깽????대컢??釉붾젋??
  function getEventAnchoredDarkSunOrbit(date, {
    sarosOrbit,
    moonRenderState = null,
    sunRenderState = null
  } = {}) {
    const alignment = getEclipseAlignmentTarget({
      baselineState: {
        orbitAngleRadians: sarosOrbit.orbitAngleRadians,
        progress: getBodyCorridorProgress("darkSun", sarosOrbit.centerRadius)
      },
      catalog: getRuntimeEclipseCatalog(),
      dateMs: date.getTime(),
      moonRenderState,
      sunRenderState
    });

    if (alignment.mode === "none") {
      return null;
    }

    const targetAnchorState = alignment.mode === "solar" ? sunRenderState : moonRenderState;
    let targetOrbitAngle = alignment.targetOrbitAngleRadians ?? sarosOrbit.orbitAngleRadians;
    const eventType = alignment.eventMeta?.type ?? "";

    // partial/total: ?묒큺 媛곷룄 ?대옩??
    if (targetAnchorState && (eventType === "partial" || eventType === "total")) {
      const anchorOrbitAngle = targetAnchorState.orbitAngleRadians ?? sarosOrbit.orbitAngleRadians;
      const maxContactOffset = getDarkSunEventContactOffsetRadians(alignment.mode, targetAnchorState);
      const rawOffset = getShortestAngleDeltaRadians(anchorOrbitAngle, targetOrbitAngle);
      const overlapScale = (eventType === "total" && alignment.mode === "lunar") ? 0 : 0.35;
      const overlapLimit = maxContactOffset * (eventType === "total" ? overlapScale : 0.78);
      targetOrbitAngle = anchorOrbitAngle + THREE.MathUtils.clamp(rawOffset, -overlapLimit, overlapLimit);
    }

    const blendFactor = THREE.MathUtils.clamp(alignment.blendFactor ?? 0, 0, 1);
    const targetRadius = targetAnchorState?.centerRadius ?? sarosOrbit.centerRadius;
    const targetHeight = targetAnchorState?.coilHeight ?? sarosOrbit.coilHeight;

    return {
      direction: alignment.direction ?? sarosOrbit.direction,
      eventMeta: alignment.eventMeta ?? null,
      orbitAngleRadians: lerpAngleRadians(sarosOrbit.orbitAngleRadians, targetOrbitAngle, blendFactor),
      centerRadius: THREE.MathUtils.lerp(sarosOrbit.centerRadius, targetRadius, blendFactor),
      coilHeight: THREE.MathUtils.lerp(sarosOrbit.coilHeight, targetHeight, blendFactor)
    };
  }

  function getRealityDarkSunOrbit(date, { sunRenderState = null, moonRenderState = null } = {}) {
    const sarosOrbit = getDarkSunSarosOrbit(date, { sunRenderState, moonRenderState });
    return getEventAnchoredDarkSunOrbit(date, {
      sarosOrbit,
      moonRenderState,
      sunRenderState
    }) ?? sarosOrbit;
  }

  function getDarkSunRenderState({
    date = astronomyState.selectedDate,
    direction = simulationState.darkSunBandDirection ?? DARK_SUN_START_DIRECTION,
    orbitAngleRadians = simulationState.orbitDarkSunAngle ?? DARK_SUN_START_ANGLE,
    phaseOffsetRadians = simulationState.darkSunOrbitPhaseOffsetRadians ?? DARK_SUN_START_ANGLE,
    moonRenderState = null,
    progress = simulationState.darkSunBandProgress ?? DARK_SUN_START_PROGRESS,
    source = "reality",
    sunDirection = simulationState.sunBandDirection ?? 1,
    sunRenderState = null,
    sunOrbitAngleRadians = simulationState.orbitSunAngle ?? 0,
    sunProgress = simulationState.sunBandProgress ?? 0.5,
    useExplicitOrbit = true,
    orbitMode = source === "demo" ? simulationState.orbitMode : "auto"
  } = {}) {
    const lockedProgress = getSunBandLockProgress({
      sunRenderState,
      sunProgress,
      fallbackProgress: progress
    });
    const lockedProjectedRadius = Number.isFinite(sunRenderState?.centerRadius)
      ? sunRenderState.centerRadius
      : undefined;

    if (source === "demo") {
      // Demo: explicit independent orbit
      const renderState = getBodyCoilRenderState({
        body: "sun",
        orbitAngleRadians,
        orbitMode,
        progress: lockedProgress,
        source: "demo"
      });
      return { ...renderState, direction, orbitAngleRadians, orbitMode };
    }

    // Reality keeps dark-sun orbital angle/direction, but locks band radius/height to sun.
    const orbit = getRealityDarkSunOrbit(date, { moonRenderState, sunRenderState });
    const renderState = getBodyCoilRenderState({
      body: "sun",
      orbitAngleRadians: orbit.orbitAngleRadians,
      orbitMode: "auto",
      progress: lockedProgress,
      projectedRadius: lockedProjectedRadius,
      source: "demo"
    });

    return {
      ...renderState,
      direction: orbit.direction,
      orbitAngleRadians: orbit.orbitAngleRadians,
      orbitMode: "auto"
    };
  }

  function getSunRenderState({
    longitudeDegrees = 0,
    orbitAngleRadians = 0,
    projectedRadius = constants.EQUATOR_RADIUS,
    progress = simulationState.sunBandProgress ?? 0.5,
    source = "reality",
    orbitMode = source === "demo" ? simulationState.orbitMode : "auto"
  }) {
    return getBodyCoilRenderState({
      body: "sun",
      longitudeDegrees,
      orbitAngleRadians,
      orbitMode,
      progress,
      projectedRadius,
      source
    });
  }

  function getMoonRenderState({
    longitudeDegrees = 0,
    orbitAngleRadians = 0,
    projectedRadius = constants.EQUATOR_RADIUS,
    progress = simulationState.moonBandProgress ?? 0.5,
    sunProgress = simulationState.sunBandProgress ?? 0.5,
    sunRenderState = null,
    source = "reality",
    orbitMode = source === "demo" ? simulationState.orbitMode : "auto"
  }) {
    const lockedProgress = getSunBandLockProgress({
      sunRenderState,
      sunProgress,
      fallbackProgress: progress
    });
    const lockedProjectedRadius = Number.isFinite(sunRenderState?.centerRadius)
      ? sunRenderState.centerRadius
      : projectedRadius;

    return getBodyCoilRenderState({
      body: "sun",
      longitudeDegrees,
      orbitAngleRadians,
      orbitMode,
      progress: lockedProgress,
      projectedRadius: lockedProjectedRadius,
      source
    });
  }

  function getAstronomySnapshot(date) {
    const snapshot = buildAstronomySnapshot({
      date,
      discRadius: constants.DISC_RADIUS,
      domeRadius: constants.DOME_RADIUS,
      getDarkSunRenderState,
      getSunRenderState,
      getMoonBaseHeight,
      getMoonRenderState
    });
    snapshot.sunDisplayHorizontal = getSunDisplayHorizontalFromPosition(
      snapshot.sunRenderPosition ?? snapshot.sunPosition
    );
    return snapshot;
  }

  function syncDayNightOverlayMaterial(sunLatitudeDegrees, sunLongitudeDegrees) {
    const sunLatitudeRadians = THREE.MathUtils.degToRad(sunLatitudeDegrees);
    dayNightOverlayMaterial.uniforms.sunLatitudeTrig.value.set(
      Math.sin(sunLatitudeRadians),
      Math.cos(sunLatitudeRadians)
    );
    dayNightOverlayMaterial.uniforms.sunLongitudeRadians.value = THREE.MathUtils.degToRad(sunLongitudeDegrees);
  }

  function syncDayNightOverlayUi() {
    ui.dayNightOverlayEl.checked = dayNightState.enabled;
    dayNightOverlay.visible = dayNightState.enabled;
    ui.dayNightSummaryEl.textContent = dayNightState.enabled
      ? i18n.t("dayNightSummaryActive")
      : i18n.t("dayNightSummaryHidden");
  }

  function updateDayNightOverlayFromSun(sunLatitudeDegrees, sunLongitudeDegrees, force = false) {
    const latitudeDelta = Math.abs((dayNightState.lastLatitudeDegrees ?? sunLatitudeDegrees) - sunLatitudeDegrees);
    const longitudeDelta = Math.abs((dayNightState.lastLongitudeDegrees ?? sunLongitudeDegrees) - sunLongitudeDegrees);

    if (!dayNightState.enabled) {
      dayNightOverlay.visible = false;
      return;
    }

    if (!force && latitudeDelta < constants.DAY_NIGHT_UPDATE_EPSILON && longitudeDelta < constants.DAY_NIGHT_UPDATE_EPSILON) {
      dayNightOverlay.visible = true;
      return;
    }

    syncDayNightOverlayMaterial(sunLatitudeDegrees, sunLongitudeDegrees);
    dayNightState.lastLatitudeDegrees = sunLatitudeDegrees;
    dayNightState.lastLongitudeDegrees = sunLongitudeDegrees;
    dayNightOverlay.visible = true;
  }

  function updateDayNightOverlayFromSunPosition(sunRenderPosition, force = false) {
    if (!sunRenderPosition) {
      dayNightOverlay.visible = false;
      return;
    }

    const sunGeo = getGeoFromProjectedPosition(sunRenderPosition, constants.DISC_RADIUS);
    updateDayNightOverlayFromSun(sunGeo.latitudeDegrees, sunGeo.longitudeDegrees, force);
  }

  function setObservationInputValue(date) {
    ui.observationTimeEl.value = toDatetimeLocalValue(date);
  }

  function setSelectOptions(selectEl, options = [], selectedValue = "") {
    if (!selectEl) {
      return;
    }

    const nextOptions = options.map(({ value, label, disabled = false }) => {
      const option = document.createElement("option");
      option.value = String(value);
      option.textContent = label;
      option.disabled = disabled;
      return option;
    });

    selectEl.replaceChildren(...nextOptions);
    if (nextOptions.length === 0) {
      selectEl.value = "";
      return;
    }

    const resolvedValue = String(selectedValue ?? "");
    if (nextOptions.some((option) => option.value === resolvedValue)) {
      selectEl.value = resolvedValue;
      return;
    }

    selectEl.value = nextOptions[0].value;
  }

  function setUploadStatus(tone = "default", key = "eclipseCatalogStatusAwaitingUpload", params = {}) {
    eclipseSelectionState.uploadStatus = {
      tone,
      key,
      params
    };
  }

  function getSelectableEclipseCatalog() {
    if (eclipseSelectionState.sourceMode === "upload") {
      return eclipseSelectionState.uploadedCatalog;
    }
    return getBuiltInEclipseCatalog();
  }

  function getRuntimeEclipseCatalog() {
    if (eclipseSelectionState.sourceMode === "upload" && eclipseSelectionState.uploadedCatalog) {
      return eclipseSelectionState.uploadedCatalog;
    }
    return getBuiltInEclipseCatalog();
  }

  function getSelectedEclipseMeta() {
    return reconcileEclipseSelectionState();
  }

  function reconcileEclipseSelectionState() {
    const catalog = getSelectableEclipseCatalog();
    if (!catalog) {
      eclipseSelectionState.year = "";
      eclipseSelectionState.eventId = "";
      eclipseSelectionState.selectedEventMeta = null;
      return null;
    }

    const kind = eclipseSelectionState.kind === "lunar" ? "lunar" : "solar";
    const years = getCatalogYears(catalog, kind);
    eclipseSelectionState.kind = kind;

    if (years.length === 0) {
      eclipseSelectionState.year = "";
      eclipseSelectionState.eventId = "";
      eclipseSelectionState.selectedEventMeta = null;
      return null;
    }

    const year = getClosestCatalogYear(
      catalog,
      kind,
      eclipseSelectionState.year ?? astronomyState.selectedDate.getUTCFullYear()
    );
    if (!Number.isFinite(year)) {
      eclipseSelectionState.year = "";
      eclipseSelectionState.eventId = "";
      eclipseSelectionState.selectedEventMeta = null;
      return null;
    }

    eclipseSelectionState.year = year;
    const events = getCatalogEventsForYear(catalog, kind, year);
    const selectedEvent = getPreferredCatalogEvent(events, eclipseSelectionState.eventId);
    if (!selectedEvent) {
      eclipseSelectionState.eventId = "";
      eclipseSelectionState.selectedEventMeta = null;
      return null;
    }

    eclipseSelectionState.eventId = selectedEvent.id;
    eclipseSelectionState.timePoint = ECLIPSE_TIME_POINT_VALUES.includes(eclipseSelectionState.timePoint)
      ? eclipseSelectionState.timePoint
      : "peak";

    const previewMs = getEclipseEventTimeMs(selectedEvent, eclipseSelectionState.timePoint);
    eclipseSelectionState.selectedEventMeta = Number.isFinite(previewMs)
      ? {
        catalog,
        event: selectedEvent,
        previewMs,
        timePoint: eclipseSelectionState.timePoint
      }
      : null;
    return eclipseSelectionState.selectedEventMeta;
  }

  function syncEclipseCatalogStatusUi() {
    if (!ui.eclipseCatalogStatusEl) {
      return;
    }

    let tone = "default";
    let messageKey = "eclipseCatalogStatusBuiltIn";
    let params = {};

    if (eclipseSelectionState.sourceMode === "upload") {
      tone = eclipseSelectionState.uploadStatus?.tone ?? "default";
      messageKey = eclipseSelectionState.uploadStatus?.key ?? "eclipseCatalogStatusAwaitingUpload";
      params = { ...(eclipseSelectionState.uploadStatus?.params ?? {}) };
      if (params.reasonKey) {
        params.reason = i18n.t(params.reasonKey);
        delete params.reasonKey;
      }
    } else {
      params = getCatalogStats(getBuiltInEclipseCatalog());
    }

    ui.eclipseCatalogStatusEl.textContent = i18n.t(messageKey, params);
    ui.eclipseCatalogStatusEl.classList.toggle("error", tone === "error");
  }

  function syncSelectedEclipseDetailUi(selectedMeta = eclipseSelectionState.selectedEventMeta) {
    const selectedEvent = selectedMeta?.event ?? null;
    const previewDate = Number.isFinite(selectedMeta?.previewMs)
      ? new Date(selectedMeta.previewMs)
      : null;
    const localTime = previewDate
      ? i18n.formatDate(previewDate, { dateStyle: "medium", timeStyle: "medium" })
      : "-";
    const utcTime = previewDate
      ? i18n.formatDate(previewDate, { dateStyle: "medium", timeStyle: "medium", timeZone: "UTC" })
      : "-";
    const magnitudeParts = [];
    if (Number.isFinite(selectedEvent?.magnitude)) {
      magnitudeParts.push(`mag ${selectedEvent.magnitude.toFixed(3)}`);
    }
    if (Number.isFinite(selectedEvent?.gamma)) {
      magnitudeParts.push(`gamma ${selectedEvent.gamma.toFixed(4)}`);
    }

    if (ui.selectedEclipseKindEl) {
      ui.selectedEclipseKindEl.textContent = selectedEvent ? getEclipseKindLabel(selectedEvent.kind) : "-";
    }
    if (ui.selectedEclipseTypeEl) {
      ui.selectedEclipseTypeEl.textContent = selectedEvent ? getEclipseTypeLabel(selectedEvent.type) : "-";
    }
    if (ui.selectedEclipseLocalEl) {
      ui.selectedEclipseLocalEl.textContent = localTime;
    }
    if (ui.selectedEclipseUtcEl) {
      ui.selectedEclipseUtcEl.textContent = utcTime;
    }
    if (ui.selectedEclipseMagnitudeEl) {
      ui.selectedEclipseMagnitudeEl.textContent = magnitudeParts.join(" ??") || "-";
    }
    if (ui.selectedEclipseSourceEl) {
      if (ui.selectedEclipseMagnitudeEl) {
        ui.selectedEclipseMagnitudeEl.textContent = magnitudeParts.join(" / ") || "-";
      }
      ui.selectedEclipseSourceEl.textContent = selectedEvent?.sourceId ?? selectedMeta?.catalog?.sourceLabel ?? "-";
    }
    if (ui.selectedEclipseSummaryEl) {
      ui.selectedEclipseSummaryEl.textContent = selectedEvent
        ? i18n.t("selectedEclipseSummary", {
          kind: getEclipseKindLabel(selectedEvent.kind),
          type: getEclipseTypeLabel(selectedEvent.type),
          timePoint: getEclipseTimePointLabel(selectedMeta.timePoint),
          localTime,
          sourceId: selectedEvent.sourceId ?? selectedMeta.catalog?.sourceLabel ?? "-"
        })
        : i18n.t("selectedEclipseSummaryEmpty");
    }
    if (ui.previewSelectedEclipseButton) {
      ui.previewSelectedEclipseButton.disabled = !Number.isFinite(selectedMeta?.previewMs);
    }
  }

  function syncEclipseSelectorUi() {
    const selectableCatalog = getSelectableEclipseCatalog();
    const selectedMeta = reconcileEclipseSelectionState();
    const years = selectableCatalog
      ? getCatalogYears(selectableCatalog, eclipseSelectionState.kind)
      : [];
    const events = selectableCatalog
      ? getCatalogEventsForYear(selectableCatalog, eclipseSelectionState.kind, eclipseSelectionState.year)
      : [];
    const locale = i18n.getLocale?.() ?? "en-US";

    setSelectOptions(ui.eclipseCatalogSourceEl, [
      { value: "builtin", label: i18n.t("eclipseDataSourceBuiltIn") },
      { value: "upload", label: i18n.t("eclipseDataSourceUpload") }
    ], eclipseSelectionState.sourceMode);

    setSelectOptions(ui.eclipseKindSelectEl, [
      { value: "solar", label: i18n.t("eclipseKindSolar") },
      { value: "lunar", label: i18n.t("eclipseKindLunar") }
    ], eclipseSelectionState.kind);

    setSelectOptions(
      ui.eclipseYearSelectEl,
      years.map((year) => ({ value: String(year), label: String(year) })),
      String(eclipseSelectionState.year ?? "")
    );

    setSelectOptions(
      ui.eclipseEventSelectEl,
      events.map((event) => ({
        value: event.id,
        label: formatEclipseEventLabel(event, {
          locale,
          kindLabels: {
            solar: i18n.t("eclipseKindSolar"),
            lunar: i18n.t("eclipseKindLunar")
          },
          typeLabels: {
            annular: i18n.t("eclipseTypeAnnular"),
            hybrid: i18n.t("eclipseTypeHybrid"),
            partial: i18n.t("eclipseTypePartial"),
            penumbral: i18n.t("eclipseTypePenumbral"),
            total: i18n.t("eclipseTypeTotal")
          }
        })
      })),
      eclipseSelectionState.eventId
    );

    setSelectOptions(ui.eclipseTimePointSelectEl, ECLIPSE_TIME_POINT_VALUES.map((timePoint) => ({
      value: timePoint,
      label: getEclipseTimePointLabel(timePoint)
    })), eclipseSelectionState.timePoint);

    if (ui.eclipseUploadFieldEl) {
      ui.eclipseUploadFieldEl.hidden = eclipseSelectionState.sourceMode !== "upload";
    }
    if (ui.eclipseCatalogUploadEl) {
      ui.eclipseCatalogUploadEl.disabled = eclipseSelectionState.sourceMode !== "upload";
    }
    if (ui.eclipseYearSelectEl) {
      ui.eclipseYearSelectEl.disabled = years.length === 0;
    }
    if (ui.eclipseEventSelectEl) {
      ui.eclipseEventSelectEl.disabled = events.length === 0;
    }
    if (ui.eclipseTimePointSelectEl) {
      ui.eclipseTimePointSelectEl.disabled = !selectedMeta;
    }

    syncEclipseCatalogStatusUi();
    syncSelectedEclipseDetailUi(selectedMeta);
  }

  function previewSelectedEclipse() {
    const selectedMeta = reconcileEclipseSelectionState();
    if (!Number.isFinite(selectedMeta?.previewMs)) {
      syncEclipseSelectorUi();
      return false;
    }

    const nextDate = new Date(selectedMeta.previewMs);
    setObservationInputValue(nextDate);
    enableRealityMode({ live: false, date: nextDate });
    syncAstronomyControls();
    syncEclipseSelectorUi();
    return true;
  }

  function setEclipseCatalogSource(nextSourceMode = "builtin") {
    eclipseSelectionState.sourceMode = nextSourceMode === "upload" ? "upload" : "builtin";
    syncEclipseSelectorUi();
    if (eclipseSelectionState.selectedEventMeta) {
      previewSelectedEclipse();
    }
  }

  function setSelectedEclipseKind(nextKind = "solar") {
    eclipseSelectionState.kind = nextKind === "lunar" ? "lunar" : "solar";
    eclipseSelectionState.eventId = "";
    syncEclipseSelectorUi();
    if (eclipseSelectionState.selectedEventMeta) {
      previewSelectedEclipse();
    }
  }

  function setSelectedEclipseYear(nextYear) {
    eclipseSelectionState.year = Number.parseInt(nextYear, 10);
    eclipseSelectionState.eventId = "";
    syncEclipseSelectorUi();
    if (eclipseSelectionState.selectedEventMeta) {
      previewSelectedEclipse();
    }
  }

  function setSelectedEclipseEvent(nextEventId = "") {
    eclipseSelectionState.eventId = nextEventId;
    syncEclipseSelectorUi();
    if (eclipseSelectionState.selectedEventMeta) {
      previewSelectedEclipse();
    }
  }

  function setSelectedEclipseTimePoint(nextTimePoint = "peak") {
    eclipseSelectionState.timePoint = ECLIPSE_TIME_POINT_VALUES.includes(nextTimePoint) ? nextTimePoint : "peak";
    syncEclipseSelectorUi();
    if (eclipseSelectionState.selectedEventMeta) {
      previewSelectedEclipse();
    }
  }

  async function loadEclipseCsv(file) {
    if (!file) {
      return false;
    }

    try {
      const csvText = await file.text();
      const { catalog, diagnostics } = createEclipseCatalogFromCsvText(csvText, {
        sourceLabel: file.name || i18n.t("eclipseDataSourceUpload")
      });
      if (!catalog) {
        setUploadStatus("error", "eclipseCatalogStatusUploadFailed", {
          fileName: file.name || "upload.csv",
          reasonKey: diagnostics.totalRows > 0
            ? "eclipseCsvErrorNoValidRows"
            : "eclipseCsvErrorEmpty"
        });
        syncEclipseSelectorUi();
        return false;
      }

      eclipseSelectionState.uploadedCatalog = catalog;
      eclipseSelectionState.sourceMode = "upload";
      eclipseSelectionState.year = astronomyState.selectedDate.getUTCFullYear();
      eclipseSelectionState.eventId = "";
      setUploadStatus("default", "eclipseCatalogStatusUploadLoaded", {
        fileName: file.name || "upload.csv",
        ...getCatalogStats(catalog)
      });
      syncEclipseSelectorUi();
      previewSelectedEclipse();
      return true;
    } catch {
      setUploadStatus("error", "eclipseCatalogStatusUploadFailed", {
        fileName: file?.name || "upload.csv",
        reasonKey: "eclipseCsvErrorRead"
      });
      syncEclipseSelectorUi();
      return false;
    }
  }

  function syncCelestialMotionUi() {
    const trailPercent = Math.round(getTrailLengthFactor() * 100);
    const speedMultiplier = getSpeedMultiplier();
    const speedValue = formatSpeedMultiplier(speedMultiplier);

    if (ui.celestialTrailLengthEl) {
      ui.celestialTrailLengthEl.value = String(trailPercent);
    }
    if (ui.celestialTrailLengthValueEl) {
      ui.celestialTrailLengthValueEl.textContent = i18n.t("celestialTrailLengthValue", {
        percent: trailPercent
      });
    }
    if (ui.celestialSpeedEl) {
      ui.celestialSpeedEl.value = String(speedMultiplier);
      ui.celestialSpeedEl.disabled = astronomyState.enabled;
    }
    if (Array.isArray(ui.celestialSpeedPresetButtons)) {
      for (const button of ui.celestialSpeedPresetButtons) {
        const presetValue = Number.parseFloat(button.dataset.celestialSpeedPreset);
        const isActive = Number.isFinite(presetValue) && Math.abs(presetValue - speedMultiplier) < 0.0001;
        button.classList.toggle("active", isActive);
        button.disabled = astronomyState.enabled;
      }
    }
    if (ui.celestialSpeedValueEl) {
      ui.celestialSpeedValueEl.textContent = i18n.t("celestialSpeedValue", {
        speed: speedValue
      });
    }
    if (ui.celestialFullTrailEl) {
      ui.celestialFullTrailEl.checked = Boolean(celestialControlState?.showFullTrail);
    }
    if (ui.celestialMotionSummaryEl) {
      ui.celestialMotionSummaryEl.textContent = astronomyState.enabled
        ? i18n.t("celestialMotionSummaryReality")
        : i18n.t("celestialMotionSummaryDemo");
    }
  }

  function syncAstronomyControls() {
    ui.realitySyncEl.checked = astronomyState.enabled;
    ui.realityLiveEl.checked = astronomyState.live;
    ui.realityLiveEl.disabled = false;
    if (ui.realitySyncToggleTextEl) {
      ui.realitySyncToggleTextEl.textContent = astronomyState.enabled
        ? i18n.t("toggleSync")
        : i18n.t("toggleAccelerated");
    }
    ui.observationTimeEl.disabled = astronomyState.live;
    ui.applyObservationTimeButton.disabled = astronomyState.live;
    if (ui.darkSunDebugEl) {
      ui.darkSunDebugEl.checked = Boolean(simulationState.darkSunDebugVisible);
    }
    if (ui.darkSunDebugSummaryEl) {
      ui.darkSunDebugSummaryEl.hidden = !simulationState.darkSunDebugVisible;
    }
    syncCelestialMotionUi();

    for (const button of orbitModeButtons) {
      button.disabled = astronomyState.enabled || isAcceleratedRealityMode();
    }
  }

  function syncSeasonalEventButtons() {
    for (const button of seasonalEventButtons) {
      button.classList.toggle("active", button.dataset.seasonalEvent === seasonalMoonState.selectedEventKey);
    }
  }

  function getNearestSeasonalEventKey(year, date) {
    const seasonalEvents = getSeasonalEventMoments(year);
    let nearestKey = SEASONAL_EVENT_DEFINITIONS[0].key;
    let nearestDelta = Number.POSITIVE_INFINITY;

    for (const definition of SEASONAL_EVENT_DEFINITIONS) {
      const eventDate = seasonalEvents[definition.key];
      const delta = Math.abs(eventDate.getTime() - date.getTime());
      if (delta < nearestDelta) {
        nearestDelta = delta;
        nearestKey = definition.key;
      }
    }

    return nearestKey;
  }

  function getSelectedSeasonalAudit() {
    const year = sanitizeSeasonalYear(seasonalMoonState.selectedYear);
    seasonalMoonState.selectedYear = year;

    if (!seasonalEventMap.has(seasonalMoonState.selectedEventKey)) {
      seasonalMoonState.selectedEventKey = getNearestSeasonalEventKey(year, astronomyState.selectedDate);
    }

    return getSeasonalMoonAudit(seasonalMoonState.selectedEventKey, year);
  }

  function syncSeasonalMoonUi() {
    const audit = getSelectedSeasonalAudit();
    const definition = seasonalEventMap.get(audit.key);
    const seasonalLabel = getSeasonalEventLabel(audit.key);
    const phaseLabel = getMoonPhaseLabel(audit.moonPhase);
    ui.seasonalYearEl.value = String(seasonalMoonState.selectedYear);
    syncSeasonalEventButtons();
    ui.seasonalEventTimeEl.textContent =
      `${seasonalMoonState.selectedYear} ${definition.label} 쨌 ${seasonalEventFormatter.format(audit.date)}`;
    ui.seasonalMoonAnchorEl.textContent = formatGeoPair(audit.moon.latitudeDegrees, audit.moon.longitudeDegrees);
    ui.seasonalMoonDriftEl.textContent = i18n.t("seasonalMoonDrift", {
      latitudeDelta: formatSignedDegrees(audit.motion.netLatitudeDeltaDegrees),
      longitudeDelta: formatSignedDegrees(audit.motion.netLongitudeDeltaDegrees)
    });
    ui.seasonalMoonSummaryEl.textContent =
      `${definition.label} 湲곤옙? 짹12?占쎄컙 ??沅ㅼ쟻: ?占쎈룄 ${formatLatitude(audit.motion.latitudeMinDegrees)}~` +
      `${formatLatitude(audit.motion.latitudeMaxDegrees)}, 寃쎈룄 ?占쎌쟻 ?占쎈룞 ${audit.motion.longitudeSweepDegrees.toFixed(1)}deg.`;

    ui.seasonalEventTimeEl.textContent = i18n.t("seasonalEventTime", {
      year: seasonalMoonState.selectedYear,
      eventLabel: seasonalLabel,
      date: formatSeasonalEventTime(audit.date)
    });
    ui.seasonalMoonSummaryEl.textContent = i18n.t("seasonalMoonSummary", {
      eventLabel: seasonalLabel,
      illumination: formatIllumination(audit.moonPhase?.illuminationFraction),
      latitudeMin: formatLatitude(audit.motion.latitudeMinDegrees),
      latitudeMax: formatLatitude(audit.motion.latitudeMaxDegrees),
      longitudeSweep: audit.motion.longitudeSweepDegrees.toFixed(1),
      phaseLabel
    });

    return audit;
  }

  function getSeasonalSunUiKey(year, observerGeo) {
    return [
      year,
      observerGeo.latitudeDegrees.toFixed(2),
      observerGeo.longitudeDegrees.toFixed(2)
    ].join(":");
  }

  function syncSeasonalSunUi(force = false) {
    if (!ui.seasonalSunGridEl || !ui.seasonalSunSummaryEl) {
      lastSeasonalSunKey = "";
      return;
    }

    const year = sanitizeSeasonalYear(seasonalMoonState.selectedYear);
    const observerGeo = getObserverGeo();
    const uiKey = getSeasonalSunUiKey(year, observerGeo);

    if (!force && lastSeasonalSunKey === uiKey) {
      return;
    }

    seasonalMoonState.selectedYear = year;
    ui.seasonalYearEl.value = String(year);

    const audits = getSeasonalSunAudit(year, observerGeo.latitudeDegrees, observerGeo.longitudeDegrees)
      .map((audit) => {
        const snapshot = getAstronomySnapshot(audit.date);
        return {
          ...audit,
          horizontal: snapshot.sunDisplayHorizontal
        };
      });
    const auditsByKey = Object.fromEntries(audits.map((audit) => [audit.key, audit]));
    const highestAudit = audits.reduce((best, audit) => (
      audit.horizontal.altitudeDegrees > best.horizontal.altitudeDegrees ? audit : best
    ), audits[0]);
    const lowestAudit = audits.reduce((best, audit) => (
      audit.horizontal.altitudeDegrees < best.horizontal.altitudeDegrees ? audit : best
    ), audits[0]);

    ui.seasonalSunGridEl.innerHTML = audits.map((audit) => `
      <article class="seasonal-sun-card">
        <p class="seasonal-sun-heading">${getSeasonalEventLabel(audit.key)}</p>
        <p class="seasonal-sun-meta">${formatSeasonalEventTime(audit.date)}</p>
        <div class="seasonal-sun-values">
          <div>
            <span class="seasonal-sun-label">${i18n.t("seasonalSunCardSolarLatitude")}</span>
            <strong class="seasonal-sun-value">${formatLatitude(audit.sun.latitudeDegrees)}</strong>
          </div>
          <div>
            <span class="seasonal-sun-label">${i18n.t("seasonalSunCardModelAltitude")}</span>
            <strong class="seasonal-sun-value">${formatAltitude(audit.horizontal.altitudeDegrees)}</strong>
          </div>
        </div>
        <p class="seasonal-sun-meta">${getAltitudeSummary(audit.horizontal.altitudeDegrees)}</p>
      </article>
    `).join("");

    ui.seasonalSunSummaryEl.textContent = i18n.t("seasonalSunSummary", {
      observerGeo: formatGeoPair(observerGeo.latitudeDegrees, observerGeo.longitudeDegrees),
      springLatitude: formatLatitude(auditsByKey.springEquinox.sun.latitudeDegrees),
      autumnLatitude: formatLatitude(auditsByKey.autumnEquinox.sun.latitudeDegrees),
      summerLatitude: formatLatitude(auditsByKey.summerSolstice.sun.latitudeDegrees),
      winterLatitude: formatLatitude(auditsByKey.winterSolstice.sun.latitudeDegrees),
      highestLabel: getSeasonalEventLabel(highestAudit.key),
      highestAltitude: formatAltitude(highestAudit.horizontal.altitudeDegrees),
      lowestLabel: getSeasonalEventLabel(lowestAudit.key),
      lowestAltitude: formatAltitude(lowestAudit.horizontal.altitudeDegrees)
    });

    lastSeasonalSunKey = uiKey;
  }

  function getBodyBandProgressStep(body) {
    const normalizedBody = body === "darkSun" ? "sun" : body;
    const turns = Math.max(magneticFieldApi?.getCoilOrbitProfile?.(normalizedBody)?.turns ?? 1, 1);
    let baseSpeed = constants.ORBIT_SUN_SEASON_SPEED;

    if (body === "moon") {
      baseSpeed *= constants.ORBIT_MOON_BAND_SPEED_FACTOR;
    } else if (body === "darkSun") {
      baseSpeed *= DARK_SUN_BAND_SPEED_FACTOR;
    }

    return baseSpeed / turns;
  }

  function advanceOscillatingProgress(progress, direction, delta) {
    let nextProgress = THREE.MathUtils.clamp(progress ?? 0.5, 0, 1);
    let nextDirection = direction >= 0 ? 1 : -1;
    let remaining = Math.max(delta, 0);

    while (remaining > 0.000001) {
      const distanceToEdge = nextDirection > 0 ? 1 - nextProgress : nextProgress;
      if (distanceToEdge <= 0.000001) {
        nextDirection *= -1;
        continue;
      }

      if (remaining <= distanceToEdge) {
        nextProgress += nextDirection * remaining;
        remaining = 0;
        break;
      }

      nextProgress = nextDirection > 0 ? 1 : 0;
      remaining -= distanceToEdge;
      nextDirection *= -1;
    }

    return {
      progress: THREE.MathUtils.clamp(nextProgress, 0, 1),
      direction: nextDirection
    };
  }

  function setTrailPoints(target, lineGeometry, pointsGeometry, points) {
    target.length = 0;
    target.push(...points);
    lineGeometry.setFromPoints(target);
    pointsGeometry.setFromPoints(target);
  }

  function clearAnalemmaProjection() {
    analemmaPoints.length = 0;
    analemmaProjectionGeometry.setFromPoints(analemmaPoints);
    analemmaProjectionPointsGeometry.setFromPoints(analemmaPoints);
    analemmaState.lastProjectionKey = "";
  }

  function getAnalemmaProjectionKey(date) {
    return [
      date.getFullYear(),
      date.getHours(),
      date.getMinutes()
    ].join(":");
  }

  function getAnalemmaPointFromSun(date) {
    const sun = getAstronomySnapshot(date).sun;
    const projectedRadius = THREE.MathUtils.clamp(
      projectedRadiusFromLatitude(sun.latitudeDegrees, constants.DISC_RADIUS),
      0,
      constants.DISC_RADIUS
    );
    const longitudeRadians = sun.longitudeDegrees * Math.PI / 180;

    return new THREE.Vector3(
      -Math.cos(longitudeRadians) * projectedRadius,
      constants.SURFACE_Y + constants.ANALEMMA_SURFACE_OFFSET,
      Math.sin(longitudeRadians) * projectedRadius
    );
  }

  function rebuildAnalemmaProjection(date) {
    const samplePoints = [];
    const year = date.getFullYear();
    const sampleHours = date.getHours();
    const sampleMinutes = date.getMinutes();

    for (let dayIndex = 0; dayIndex < 367; dayIndex += 1) {
      const sampleDate = new Date(year, 0, 1 + dayIndex, sampleHours, sampleMinutes, 0, 0);
      if (sampleDate.getFullYear() !== year) {
        break;
      }
      samplePoints.push(getAnalemmaPointFromSun(sampleDate));
    }

    setTrailPoints(analemmaPoints, analemmaProjectionGeometry, analemmaProjectionPointsGeometry, samplePoints);
    analemmaState.lastProjectionKey = getAnalemmaProjectionKey(date);
  }

  function syncAnalemmaUi(date = astronomyState.selectedDate, force = false) {
    ui.analemmaOverlayEl.checked = analemmaState.enabled;

    if (!analemmaState.enabled) {
      clearAnalemmaProjection();
      ui.analemmaSummaryEl.textContent = i18n.t("analemmaSummaryHidden");
      return;
    }

    const projectionKey = getAnalemmaProjectionKey(date);
    if (force || analemmaState.lastProjectionKey !== projectionKey) {
      rebuildAnalemmaProjection(date);
    }

    ui.analemmaSummaryEl.textContent = i18n.t("analemmaSummary", {
      year: date.getFullYear(),
      time: formatAnalemmaTime(date)
    });
  }

  function clearSkyAnalemma() {
    skyAnalemmaPoints.length = 0;
    skyAnalemmaSegments.length = 0;
    skyAnalemmaGeometry.setFromPoints(skyAnalemmaSegments);
    skyAnalemmaPointsGeometry.setFromPoints(skyAnalemmaPoints);
    skyAnalemmaState.lastProjectionKey = "";
    skyAnalemmaState.lastVisibleSamples = 0;
    skyAnalemmaState.lastTotalSamples = 0;
  }

  function getSkyAnalemmaProjectionKey(date, observerGeo) {
    return [
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      date.getHours(),
      date.getMinutes(),
      observerGeo.latitudeDegrees.toFixed(2),
      observerGeo.longitudeDegrees.toFixed(2)
    ].join(":");
  }

  function getObserverSkyAxes(observerPosition, observerGeo = getObserverGeo()) {
    const basis = getGlobeBasisFromGeo(
      observerGeo.latitudeDegrees,
      observerGeo.longitudeDegrees
    );
    tempNorthAxis.set(basis.north.x, basis.north.y, basis.north.z).normalize();
    tempEastAxis.set(basis.east.x, basis.east.y, basis.east.z).normalize();
    tempUpAxis.set(basis.up.x, basis.up.y, basis.up.z).normalize();
  }

  function getSkyAnalemmaPoint(horizontal, observerPosition, observerGeo = getObserverGeo()) {
    const altitude = horizontal.altitudeRadians;
    const azimuth = horizontal.azimuthRadians;
    const horizontalRadius = Math.cos(altitude) * constants.SKY_ANALEMMA_RADIUS;

    getObserverSkyAxes(observerPosition, observerGeo);
    tempSkyOrigin.copy(observerPosition).addScaledVector(tempUpAxis, WALKER_EYE_OFFSET);
    tempSkyPoint.copy(tempSkyOrigin)
      .addScaledVector(tempNorthAxis, horizontalRadius * Math.cos(azimuth))
      .addScaledVector(tempEastAxis, horizontalRadius * Math.sin(azimuth))
      .addScaledVector(tempUpAxis, Math.sin(altitude) * constants.SKY_ANALEMMA_RADIUS);

    return tempSkyPoint.clone();
  }

  function rebuildSkyAnalemma(date) {
    const samplePoints = [];
    const segmentPoints = [];
    const observerGeo = getObserverGeo();
    const orbitDate = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      0,
      0,
      0,
      0
    );
    const sampleStepMinutes = 10;
    const totalSteps = Math.floor((24 * 60) / sampleStepMinutes);
    const pathDefinitions = [
      {
        getHorizontal(sampleDate) {
          return getSunHorizontalCoordinates(
            sampleDate,
            observerGeo.latitudeDegrees,
            observerGeo.longitudeDegrees
          );
        }
      },
      {
        getHorizontal(sampleDate) {
          return getMoonHorizontalCoordinates(
            sampleDate,
            observerGeo.latitudeDegrees,
            observerGeo.longitudeDegrees
          );
        }
      }
    ];
    let visibleSamples = 0;
    let totalSamples = 0;

    for (const pathDefinition of pathDefinitions) {
      let previousPoint = null;

      for (let stepIndex = 0; stepIndex <= totalSteps; stepIndex += 1) {
        const sampleDate = new Date(orbitDate.getTime() + (stepIndex * sampleStepMinutes * 60_000));
        totalSamples += 1;

        const horizontal = applyCelestialAltitudeOffset(pathDefinition.getHorizontal(sampleDate));
        if (horizontal.altitudeDegrees <= 0) {
          previousPoint = null;
          continue;
        }

        const point = getSkyAnalemmaPoint(horizontal, walkerState.position, observerGeo);
        samplePoints.push(point);
        visibleSamples += 1;

        if (previousPoint) {
          segmentPoints.push(previousPoint.clone(), point.clone());
        }

        previousPoint = point;
      }
    }

    setTrailPoints(skyAnalemmaPoints, skyAnalemmaGeometry, skyAnalemmaPointsGeometry, samplePoints);
    skyAnalemmaGeometry.setFromPoints(segmentPoints);
    skyAnalemmaSegments.length = 0;
    skyAnalemmaSegments.push(...segmentPoints);
    skyAnalemmaState.lastProjectionKey = getSkyAnalemmaProjectionKey(date, observerGeo);
    skyAnalemmaState.lastVisibleSamples = visibleSamples;
    skyAnalemmaState.lastTotalSamples = totalSamples;
  }

  function syncSkyAnalemmaUi(date = astronomyState.selectedDate, force = false) {
    const observerGeo = getObserverGeo();
    const projectionKey = getSkyAnalemmaProjectionKey(date, observerGeo);
    ui.skyAnalemmaOverlayEl.checked = skyAnalemmaState.enabled;

    if (!skyAnalemmaState.enabled) {
      clearSkyAnalemma();
      ui.skyAnalemmaSummaryEl.textContent = i18n.t("skyAnalemmaSummaryHidden");
      return;
    }

    if (force || skyAnalemmaState.lastProjectionKey !== projectionKey) {
      rebuildSkyAnalemma(date);
    }

    const hiddenSamples = Math.max(0, skyAnalemmaState.lastTotalSamples - skyAnalemmaState.lastVisibleSamples);
    const hiddenCopy = hiddenSamples > 0
      ? i18n.t("skyAnalemmaHiddenSamples", { count: hiddenSamples })
      : "";
    ui.skyAnalemmaSummaryEl.textContent = i18n.t("skyAnalemmaSummary", {
      observerGeo: formatGeoPair(observerGeo.latitudeDegrees, observerGeo.longitudeDegrees),
      date: i18n.formatDate(date, { dateStyle: "medium" }),
      hiddenCopy
    });
  }

  function buildRealityTrailSamples(snapshot, baseCount, windowMs) {
    if (baseCount <= 0 || windowMs <= 0) {
      return [];
    }

    const samples = [];
    for (let index = 0; index < baseCount; index += 1) {
      const progress = baseCount === 1 ? 0.5 : index / (baseCount - 1);
      const sampleTime = snapshot.date.getTime() - windowMs + (progress * windowMs * 2);
      const sample = getAstronomySnapshot(new Date(sampleTime));
      samples.push(sample);
    }
    return samples;
  }

  function buildDemoFullTrailPoints(body, sampleCount) {
    if (sampleCount <= 1) {
      return [];
    }

    const orbitSpeed = body === "moon" ? constants.ORBIT_MOON_SPEED : constants.ORBIT_SUN_SPEED;
    const orbitMode = simulationState.orbitMode;
    const orbitFrames = (Math.PI * 2) / Math.max(orbitSpeed, 0.000001);
    
    // Use sun's band step for the shape, but if it's the moon, scale it down by the speed ratio 
    // to maintain the identical parametric spiral.
    const baseStep = getBodyBandProgressStep("sun");
    const bandStep = body === "moon"
      ? baseStep * (constants.ORBIT_MOON_SPEED / constants.ORBIT_SUN_SPEED)
      : baseStep;

    const totalFrames = orbitMode === "auto"
      ? Math.max(orbitFrames, 2 / Math.max(bandStep, 0.000001))
      : orbitFrames;
    const normalizedSampleCount = orbitMode === "auto"
      ? Math.min(8192, Math.max(sampleCount * 3, Math.ceil(totalFrames / 6)))
      : sampleCount;
    const frameAdvance = totalFrames / Math.max(normalizedSampleCount - 1, 1);
    let orbitAngle = body === "moon"
      ? simulationState.orbitMoonAngle
      : (body === "darkSun" ? simulationState.orbitDarkSunAngle : simulationState.orbitSunAngle);
    let progress = body === "moon"
      ? (simulationState.moonBandProgress ?? 0.5)
      : (body === "darkSun" ? (simulationState.darkSunBandProgress ?? 0.5) : (simulationState.sunBandProgress ?? 0.5));
    let direction = body === "moon"
      ? (simulationState.moonBandDirection ?? 1)
      : (body === "darkSun" ? (simulationState.darkSunBandDirection ?? -1) : (simulationState.sunBandDirection ?? 1));
    const progressStep = bandStep * frameAdvance;
    const points = [];

    for (let index = 0; index < normalizedSampleCount; index += 1) {
      const renderState = body === "moon"
        ? getMoonRenderState({
          orbitAngleRadians: orbitAngle,
          orbitMode,
          progress,
          source: "demo"
        })
        : (body === "darkSun"
          ? getDarkSunRenderState({
            orbitAngleRadians: orbitAngle,
            direction,
            orbitMode,
            progress,
            source: "demo",
            useExplicitOrbit: true
          })
          : getSunRenderState({
            orbitAngleRadians: orbitAngle,
            orbitMode,
            progress,
            source: "demo"
          }));
      points.push(renderState.position.clone());

      if (index === normalizedSampleCount - 1) {
        continue;
      }

      orbitAngle += orbitSpeed * frameAdvance;
      if (orbitMode === "auto") {
        const nextState = advanceOscillatingProgress(progress, direction, progressStep);
        progress = nextState.progress;
        direction = nextState.direction;
      }
    }

    return points;
  }

  function rebuildFullRealityTrails(snapshot) {
    const sunSamples = buildRealityTrailSamples(snapshot, constants.SUN_TRAIL_MAX_POINTS, constants.REALITY_TRAIL_WINDOW_MS)
      .map((sample) => sample.sunRenderPosition ?? sample.sunPosition);
    const moonSamples = buildRealityTrailSamples(snapshot, constants.MOON_TRAIL_MAX_POINTS, constants.REALITY_TRAIL_WINDOW_MS)
      .map((sample) => sample.moonRenderPosition ?? sample.moonPosition);
    setTrailPoints(sunFullTrailPoints, sunFullTrailGeometry, sunFullTrailPointsGeometry, sunSamples);
    setTrailPoints(moonFullTrailPoints, moonFullTrailGeometry, moonFullTrailPointsGeometry, moonSamples);
  }

  function rebuildFullDemoTrails() {
    setTrailPoints(
      sunFullTrailPoints,
      sunFullTrailGeometry,
      sunFullTrailPointsGeometry,
      buildDemoFullTrailPoints("sun", constants.SUN_TRAIL_MAX_POINTS)
    );
    setTrailPoints(
      moonFullTrailPoints,
      moonFullTrailGeometry,
      moonFullTrailPointsGeometry,
      buildDemoFullTrailPoints("moon", constants.MOON_TRAIL_MAX_POINTS)
    );
    setTrailPoints(
      darkSunFullTrailPoints,
      darkSunFullTrailGeometry,
      darkSunFullTrailPointsGeometry,
      buildDemoFullTrailPoints("darkSun", constants.SUN_TRAIL_MAX_POINTS)
    );
  }

  function rebuildAstronomyTrails(snapshot) {
    const currentWindowMs = getRealityCurrentTrailWindowMs();
    const sunSampleCount = getRealityCurrentTrailSampleCount(constants.SUN_TRAIL_MAX_POINTS);
    const moonSampleCount = getRealityCurrentTrailSampleCount(constants.MOON_TRAIL_MAX_POINTS);

    if (sunSampleCount > 0 && currentWindowMs > 0) {
      const sunSamples = buildRealityTrailSamples(snapshot, sunSampleCount, currentWindowMs)
        .map((sample) => sample.sunRenderPosition ?? sample.sunPosition);
      setTrailPoints(sunTrailPoints, sunTrailGeometry, sunTrailPointsGeometry, sunSamples);
    } else {
      resetSunTrail();
    }

    if (moonSampleCount > 0 && currentWindowMs > 0) {
      const moonSamples = buildRealityTrailSamples(snapshot, moonSampleCount, currentWindowMs)
        .map((sample) => sample.moonRenderPosition ?? sample.moonPosition);
      setTrailPoints(moonTrailPoints, moonTrailGeometry, moonTrailPointsGeometry, moonSamples);
    } else {
      resetMoonTrail();
    }

    rebuildFullRealityTrails(snapshot);
    astronomyState.lastTrailRebuildMs = snapshot.date.getTime();
  }

  function updateAstronomyUi(snapshot) {
    ui.timeSummaryEl.textContent = astronomyState.enabled
      ? (
        astronomyState.live
          ? i18n.t("timeSummaryLive", { date: formatObservationTime(snapshot.date) })
          : i18n.t("timeSummaryPreview", { date: formatObservationTime(snapshot.date) })
      )
      : i18n.t("timeSummaryAccelerated", {
        anchor: i18n.t(astronomyState.live ? "timeAnchorCurrent" : "timeAnchorSelected"),
        date: formatObservationTime(snapshot.date),
        speed: formatSpeedMultiplier()
      });
    ui.sunCoordinatesEl.textContent = formatGeoPair(snapshot.sun.latitudeDegrees, snapshot.sun.longitudeDegrees);
    ui.moonCoordinatesEl.textContent = i18n.t("moonCoordinatesValue", {
      geo: formatGeoPair(snapshot.moon.latitudeDegrees, snapshot.moon.longitudeDegrees),
      illumination: formatIllumination(snapshot.moonPhase?.illuminationFraction),
      phaseLabel: getMoonPhaseLabel(snapshot.moonPhase)
    });
    syncMoonPhaseUi(snapshot);
    syncDarkSunDebugUi(snapshot);
    ui.orbitLabelEl.textContent = (astronomyState.enabled || isAcceleratedRealityMode())
      ? i18n.t("orbitLabelRealitySync")
      : i18n.t(orbitModes[simulationState.orbitMode].labelKey);
  }

  function syncSolarEclipseUi(solarEclipse = lastSolarEclipseState) {
    const nextState = createSolarEclipseState(solarEclipse);
    const stateKey = nextState.total
      ? "solarEclipseStateTotal"
      : (
        nextState.eventWindowActive ||
        nextState.active ||
        nextState.eclipseTier !== "none"
          ? "solarEclipseStatePartial"
          : "solarEclipseStateNone"
      );
    const stateLabel = i18n.t(stateKey);
    const coverageLabel = `${Math.round(THREE.MathUtils.clamp(nextState.coverage, 0, 1) * 100)}%`;
    const sunlightLabel = `${Math.round(THREE.MathUtils.clamp(nextState.sunlightPercent ?? 100, 0, 100))}%`;

    lastSolarEclipseState = nextState;
    if (ui.solarEclipseStateEl) {
      ui.solarEclipseStateEl.textContent = stateLabel;
    }
    if (ui.solarEclipseCoverageEl) {
      ui.solarEclipseCoverageEl.textContent = coverageLabel;
    }
    if (ui.solarEclipseLightEl) {
      ui.solarEclipseLightEl.textContent = sunlightLabel;
    }
    if (ui.solarEclipseSummaryEl) {
      ui.solarEclipseSummaryEl.textContent = i18n.t(getSolarEclipseSummaryKey(nextState), {
        coverage: coverageLabel,
        light: sunlightLabel,
        state: stateLabel
      });
    }
  }

  function updateSeasonPresentation(radius) {
    const latitude = latitudeFromProjectedRadius(radius, constants.DISC_RADIUS);
    const ratio = THREE.MathUtils.clamp(latitude / constants.TROPIC_LATITUDE, -1, 1);
    const northWarmth = THREE.MathUtils.clamp((ratio + 1) / 2, 0, 1);
    const southWarmth = 1 - northWarmth;

    northSeasonOverlay.material.color.setRGB(
      THREE.MathUtils.lerp(0.48, 1.0, northWarmth),
      THREE.MathUtils.lerp(0.73, 0.83, northWarmth),
      THREE.MathUtils.lerp(1.0, 0.49, northWarmth)
    );
    northSeasonOverlay.material.opacity = THREE.MathUtils.lerp(0.05, 0.18, Math.abs(ratio));

    southSeasonOverlay.material.color.setRGB(
      THREE.MathUtils.lerp(0.48, 1.0, southWarmth),
      THREE.MathUtils.lerp(0.73, 0.83, southWarmth),
      THREE.MathUtils.lerp(1.0, 0.49, southWarmth)
    );
    southSeasonOverlay.material.opacity = THREE.MathUtils.lerp(0.05, 0.18, Math.abs(ratio));

    ui.seasonLatitudeEl.textContent = formatLatitude(latitude);

    if (Math.abs(latitude) < 1.2) {
      ui.seasonSummaryEl.textContent = i18n.t("seasonSummaryEquinox");
      ui.seasonDetailEl.textContent = i18n.t("seasonDetailEquinox");
      return;
    }

    if (latitude > 0) {
      ui.seasonSummaryEl.textContent = i18n.t("seasonSummaryNorth");
      ui.seasonDetailEl.textContent = i18n.t("seasonDetailNorth");
      return;
    }

    ui.seasonSummaryEl.textContent = i18n.t("seasonSummarySouth");
    ui.seasonDetailEl.textContent = i18n.t("seasonDetailSouth");
  }

  function syncBandProgressFromSnapshot(progressKey, directionKey, value) {
    if (!Number.isFinite(value)) {
      return;
    }
    const nextProgress = THREE.MathUtils.clamp(value, 0, 1);
    const previousProgress = simulationState[progressKey];
    if (
      Number.isFinite(previousProgress) &&
      Math.abs(nextProgress - previousProgress) > 0.0001
    ) {
      simulationState[directionKey] = nextProgress > previousProgress ? 1 : -1;
    }
    simulationState[progressKey] = nextProgress;
  }

  function normalizeOrbitAngleRadians(angleRadians) {
    if (!Number.isFinite(angleRadians)) {
      return angleRadians;
    }
    return THREE.MathUtils.euclideanModulo(angleRadians, Math.PI * 2);
  }

  function syncSimulationStateFromAstronomySnapshot(snapshot) {
    if (Number.isFinite(snapshot.sunRenderState?.orbitAngleRadians)) {
      simulationState.orbitSunAngle = normalizeOrbitAngleRadians(snapshot.sunRenderState.orbitAngleRadians);
    }
    if (Number.isFinite(snapshot.moonRenderState?.orbitAngleRadians)) {
      simulationState.orbitMoonAngle = normalizeOrbitAngleRadians(snapshot.moonRenderState.orbitAngleRadians);
    }
    if (Number.isFinite(snapshot.darkSunRenderState?.orbitAngleRadians)) {
      simulationState.orbitDarkSunAngle = normalizeOrbitAngleRadians(snapshot.darkSunRenderState.orbitAngleRadians);
    }
    if (Number.isFinite(snapshot.darkSunRenderState?.direction)) {
      simulationState.darkSunBandDirection = snapshot.darkSunRenderState.direction >= 0 ? 1 : -1;
    }
    syncBandProgressFromSnapshot(
      "sunBandProgress",
      "sunBandDirection",
      snapshot.sunRenderState?.corridorProgress ?? snapshot.sunRenderState?.macroProgress
    );
    const lockedProgress = THREE.MathUtils.clamp(simulationState.sunBandProgress ?? 0.5, 0, 1);
    simulationState.moonBandProgress = lockedProgress;
    simulationState.darkSunBandProgress = lockedProgress;
    simulationState.moonBandDirection = simulationState.sunBandDirection ?? simulationState.moonBandDirection ?? 1;
  }

  function applyAstronomySnapshot(snapshot) {
    orbitSun.position.copy(snapshot.sunRenderPosition ?? snapshot.sunPosition);
    if (snapshot.darkSunRenderPosition) {
      orbitDarkSun.position.copy(snapshot.darkSunRenderPosition);
    }
    orbitMoon.position.copy(snapshot.moonRenderPosition ?? snapshot.moonPosition);
    syncSimulationStateFromAstronomySnapshot(snapshot);
    updateSeasonPresentation(projectedRadiusFromLatitude(snapshot.sun.latitudeDegrees, constants.DISC_RADIUS));
    updateAstronomyUi(snapshot);
    syncSeasonalSunUi();
    updateDayNightOverlayFromSun(snapshot.sun.latitudeDegrees, snapshot.sun.longitudeDegrees);
    syncAnalemmaUi(snapshot.date);

    if (
      Math.abs(snapshot.date.getTime() - astronomyState.lastTrailRebuildMs) >= constants.REALITY_TRAIL_REFRESH_MS
    ) {
      rebuildAstronomyTrails(snapshot);
    }
  }

  function resetSunTrail() {
    setTrailPoints(sunTrailPoints, sunTrailGeometry, sunTrailPointsGeometry, []);
  }

  function updateSunTrail() {
    const pointLimit = getCurrentTrailPointLimit(constants.SUN_TRAIL_MAX_POINTS);
    if (pointLimit <= 0) {
      resetSunTrail();
      return;
    }
    sunTrailPoints.push(orbitSun.position.clone());
    while (sunTrailPoints.length > pointLimit) {
      sunTrailPoints.shift();
    }
    sunTrailGeometry.setFromPoints(sunTrailPoints);
    sunTrailPointsGeometry.setFromPoints(sunTrailPoints);
  }

  function updateMoonTrail() {
    const pointLimit = getCurrentTrailPointLimit(constants.MOON_TRAIL_MAX_POINTS);
    if (pointLimit <= 0) {
      resetMoonTrail();
      return;
    }
    moonTrailPoints.push(orbitMoon.position.clone());
    while (moonTrailPoints.length > pointLimit) {
      moonTrailPoints.shift();
    }
    moonTrailGeometry.setFromPoints(moonTrailPoints);
    moonTrailPointsGeometry.setFromPoints(moonTrailPoints);
  }

  function resetMoonTrail() {
    setTrailPoints(moonTrailPoints, moonTrailGeometry, moonTrailPointsGeometry, []);
  }

  function updateDarkSunTrail() {
    const pointLimit = getCurrentTrailPointLimit(constants.SUN_TRAIL_MAX_POINTS);
    if (pointLimit <= 0) {
      resetDarkSunTrail();
      return;
    }
    darkSunTrailPoints.push(orbitDarkSun.position.clone());
    while (darkSunTrailPoints.length > pointLimit) {
      darkSunTrailPoints.shift();
    }
    darkSunTrailGeometry.setFromPoints(darkSunTrailPoints);
    darkSunTrailPointsGeometry.setFromPoints(darkSunTrailPoints);
  }

  function resetDarkSunTrail() {
    setTrailPoints(darkSunTrailPoints, darkSunTrailGeometry, darkSunTrailPointsGeometry, []);
  }

  function refreshTrailsForCurrentMode() {
    if (astronomyState.enabled) {
      const activeDate = astronomyState.live ? new Date() : astronomyState.selectedDate;
      const snapshot = getAstronomySnapshot(activeDate);
      rebuildAstronomyTrails(snapshot);
      return;
    }

    astronomyState.lastTrailRebuildMs = 0;
    resetSunTrail();
    resetMoonTrail();
    resetDarkSunTrail();
    rebuildFullDemoTrails();
  }

  function updateOrbitModeUi() {
    for (const button of orbitModeButtons) {
      button.classList.toggle("active", button.dataset.orbitMode === simulationState.orbitMode);
    }
    syncAstronomyControls();
    ui.orbitLabelEl.textContent = (astronomyState.enabled || isAcceleratedRealityMode())
      ? i18n.t("orbitLabelRealitySync")
      : i18n.t(orbitModes[simulationState.orbitMode].labelKey);
  }

  function getCurrentOrbitRadius() {
    const orbitMode = simulationState.orbitMode;
    const bandRange = getBodyBandRadiusRange("sun", orbitMode);
    const bandProgress = orbitMode === "auto"
      ? THREE.MathUtils.clamp(simulationState.sunBandProgress ?? 0.5, 0, 1)
      : 0.5;
    return THREE.MathUtils.lerp(bandRange.min, bandRange.max, bandProgress);
  }

  function updateMoonOrbit({
    orbitMode = simulationState.orbitMode,
    progress = simulationState.moonBandProgress ?? 0.5
  } = {}) {
    const moonRenderState = getMoonRenderState({
      orbitAngleRadians: simulationState.orbitMoonAngle,
      orbitMode,
      progress,
      source: "demo"
    });
    orbitMoon.position.copy(moonRenderState.position);
    return moonRenderState;
  }

  function setAstronomyDate(date) {
    astronomyState.selectedDate = date;
    setObservationInputValue(date);
  }

  function refreshAstronomyView(date = astronomyState.selectedDate) {
    setAstronomyDate(date);
    applyAstronomySnapshot(getAstronomySnapshot(astronomyState.selectedDate));
    updateOrbitModeUi();
  }

  function enableRealityMode({ live, date = new Date() }) {
    const safeDate = getSafeDate(date);
    astronomyState.enabled = true;
    astronomyState.live = live;
    simulationState.useRealityTimelineInDemo = true;
    astronomyState.lastTrailRebuildMs = 0;
    resetSunTrail();
    resetMoonTrail();
    setAcceleratedTimelineAnchor(safeDate, {
      live,
      refreshControls: false,
      syncInput: false
    });
    refreshAstronomyView(safeDate);
    syncAstronomyControls();
  }

  function disableRealityMode({ live = astronomyState.live, date = astronomyState.selectedDate } = {}) {
    const safeDate = getSafeDate(date);
    astronomyState.enabled = false;
    astronomyState.live = Boolean(live);
    simulationState.useRealityTimelineInDemo = true;
    astronomyState.lastTrailRebuildMs = 0;
    resetSunTrail();
    resetMoonTrail();
    rebuildFullDemoTrails();
    setAcceleratedTimelineAnchor(safeDate, {
      live: astronomyState.live,
      refreshControls: false
    });
    ui.timeSummaryEl.textContent = i18n.t("timeSummaryAccelerated", {
      anchor: i18n.t(astronomyState.live ? "timeAnchorCurrent" : "timeAnchorSelected"),
      date: formatObservationTime(astronomyState.selectedDate),
      speed: formatSpeedMultiplier()
    });
    syncSeasonalSunUi(true);
    syncAnalemmaUi(astronomyState.selectedDate, true);
    syncSkyAnalemmaUi(astronomyState.selectedDate, true);
    updateOrbitModeUi();
    syncAstronomyControls();
  }

  function refreshLocalizedUi() {
    const activeDate = astronomyState.enabled
      ? (astronomyState.live ? new Date() : astronomyState.selectedDate)
      : astronomyState.selectedDate;
    syncDayNightOverlayUi();
    syncAstronomyControls();
    syncSolarEclipseUi(lastSolarEclipseState);
    syncEclipseSelectorUi();
    syncSeasonalMoonUi();
    syncSeasonalSunUi(true);
    syncAnalemmaUi(activeDate, true);
    syncSkyAnalemmaUi(activeDate, true);

    if (astronomyState.enabled) {
      updateAstronomyUi(getAstronomySnapshot(activeDate));
      return;
    }

    rebuildFullDemoTrails();
    updateSeasonPresentation(getCurrentOrbitRadius());
    ui.timeSummaryEl.textContent = i18n.t("timeSummaryAccelerated", {
      anchor: i18n.t(astronomyState.live ? "timeAnchorCurrent" : "timeAnchorSelected"),
      date: formatObservationTime(activeDate),
      speed: formatSpeedMultiplier()
    });
    updateOrbitModeUi();
  }

  function syncLiveObservationInput(date) {
    if ((date.getTime() - astronomyState.lastInputSyncMs) < 1000) {
      return;
    }
    astronomyState.lastInputSyncMs = date.getTime();
    setObservationInputValue(date);
  }

  function applyObservationTimeSelection() {
    const nextDate = new Date(ui.observationTimeEl.value);
    if (Number.isNaN(nextDate.getTime())) {
      return;
    }
    if (astronomyState.enabled) {
      enableRealityMode({ live: false, date: nextDate });
      return;
    }
    setAcceleratedTimelineAnchor(nextDate, {
      live: false
    });
  }

  function previewSeasonalMoonAudit(nextEventKey = seasonalMoonState.selectedEventKey, nextYear = seasonalMoonState.selectedYear) {
    seasonalMoonState.selectedYear = sanitizeSeasonalYear(nextYear);
    if (seasonalEventMap.has(nextEventKey)) {
      seasonalMoonState.selectedEventKey = nextEventKey;
    }
    const audit = syncSeasonalMoonUi();
    enableRealityMode({ live: false, date: audit.date });
  }

  syncEclipseSelectorUi();

  return {
    applyAstronomySnapshot,
    applyObservationTimeSelection,
    disableRealityMode,
    enableRealityMode,

    getAstronomySnapshot,
    getBodyCoilRenderState,
    getCurrentOrbitRadius,
    getDarkSunRenderState,
    getGeoFromProjectedPosition,
    getRuntimeEclipseCatalog,
    getSelectedEclipseMeta,
    getMoonBaseHeight,
    getMoonRenderState,
    getSunDisplayHorizontalFromPosition,
    getSunRenderState,
    getSunOrbitHeight,
    rebuildAstronomyTrails,
    refreshLocalizedUi,
    refreshTrailsForCurrentMode,
    resetMoonTrail,
    resetSunTrail,
    loadEclipseCsv,
    previewSelectedEclipse,
    setObservationInputValue,
    setEclipseCatalogSource,
    setSelectedEclipseEvent,
    setSelectedEclipseKind,
    setSelectedEclipseTimePoint,
    setSelectedEclipseYear,
    updateAstronomyUi,
    syncAstronomyControls,
    syncAnalemmaUi,
    syncSkyAnalemmaUi,
    syncDayNightOverlayUi,
    syncEclipseSelectorUi,
    syncSolarEclipseUi,
    syncSeasonalMoonUi,
    syncSeasonalSunUi,
    syncLiveObservationInput,
    updateDayNightOverlayFromSun,
    updateDayNightOverlayFromSunPosition,
    updateMoonOrbit,
    updateMoonTrail,
    updateDarkSunTrail,
    updateOrbitModeUi,
    updateSeasonPresentation,
    updateSunTrail,
    previewSeasonalMoonAudit,
    getAcceleratedSimulationDate,
    isAcceleratedRealityMode,
    rebaseAcceleratedTimeline,
    setAcceleratedTimelineAnchor
  };
}


