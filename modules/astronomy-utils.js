import * as THREE from "../vendor/three.module.js";
import {
  normalizeDegrees,
  projectedRadiusFromLatitude,
  toDegrees,
  toRadians
} from "./geo-utils.js";

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
const J2000 = 2451545;
const FULL_CIRCLE_RADIANS = Math.PI * 2;
const FULL_CIRCLE_DEGREES = 360;
const SYNODIC_MONTH_DAYS = 29.530588853;
const REFERENCE_NEW_MOON_JULIAN_DATE = 2451550.1;
const MOON_PHASE_STEP_COUNT = 16;
const MOON_PHASE_STEP_DEGREES = FULL_CIRCLE_DEGREES / MOON_PHASE_STEP_COUNT;
export const LOCAL_LIGHT_HORIZON_OFFSET_DEGREES = 22;
const MOON_PHASE_LABEL_KEYS = [
  "moonPhaseNew",
  "moonPhaseEarlyWaxingCrescent",
  "moonPhaseWaxingCrescent",
  "moonPhaseLateWaxingCrescent",
  "moonPhaseFirstQuarter",
  "moonPhaseEarlyWaxingGibbous",
  "moonPhaseWaxingGibbous",
  "moonPhaseLateWaxingGibbous",
  "moonPhaseFull",
  "moonPhaseEarlyWaningGibbous",
  "moonPhaseWaningGibbous",
  "moonPhaseLateWaningGibbous",
  "moonPhaseLastQuarter",
  "moonPhaseEarlyWaningCrescent",
  "moonPhaseWaningCrescent",
  "moonPhaseLateWaningCrescent"
];

export const SEASONAL_EVENT_DEFINITIONS = [
  {
    key: "springEquinox",
    label: "춘분",
    fallbackMonth: 2,
    fallbackDay: 20
  },
  {
    key: "summerSolstice",
    label: "하지",
    fallbackMonth: 5,
    fallbackDay: 21
  },
  {
    key: "autumnEquinox",
    label: "추분",
    fallbackMonth: 8,
    fallbackDay: 22
  },
  {
    key: "winterSolstice",
    label: "동지",
    fallbackMonth: 11,
    fallbackDay: 21
  }
];

function getJulianDate(date) {
  return (date.getTime() / DAY_MS) + 2440587.5;
}

function getDaysSinceJ2000(date) {
  return getJulianDate(date) - J2000;
}

function getObliquity(daysSinceJ2000) {
  return toRadians(23.4397 - (0.00000036 * daysSinceJ2000));
}

function getGreenwichSiderealAngle(daysSinceJ2000) {
  return toRadians(280.16 + (360.9856235 * daysSinceJ2000));
}

function getSubpointFromEquatorial(rightAscension, declination, daysSinceJ2000) {
  return {
    latitudeDegrees: toDegrees(declination),
    longitudeDegrees: normalizeDegrees(toDegrees(rightAscension - getGreenwichSiderealAngle(daysSinceJ2000)))
  };
}

function getSunEquatorialPosition(date) {
  const daysSinceJ2000 = getDaysSinceJ2000(date);
  const meanAnomaly = toRadians(357.5291 + (0.98560028 * daysSinceJ2000));
  const equationOfCenter =
    toRadians(1.9148) * Math.sin(meanAnomaly) +
    toRadians(0.02) * Math.sin(meanAnomaly * 2) +
    toRadians(0.0003) * Math.sin(meanAnomaly * 3);
  const perihelion = toRadians(102.9372);
  const eclipticLongitude = meanAnomaly + equationOfCenter + perihelion + Math.PI;
  const obliquity = getObliquity(daysSinceJ2000);
  const rightAscension = Math.atan2(
    Math.sin(eclipticLongitude) * Math.cos(obliquity),
    Math.cos(eclipticLongitude)
  );
  const declination = Math.asin(Math.sin(obliquity) * Math.sin(eclipticLongitude));

  return {
    daysSinceJ2000,
    declination,
    eclipticLongitude,
    rightAscension
  };
}

function getMoonEquatorialPosition(date) {
  const daysSinceJ2000 = getDaysSinceJ2000(date);
  const obliquity = getObliquity(daysSinceJ2000);
  const meanLongitude = toRadians(218.316 + (13.176396 * daysSinceJ2000));
  const meanAnomaly = toRadians(134.963 + (13.064993 * daysSinceJ2000));
  const argumentOfLatitude = toRadians(93.272 + (13.22935 * daysSinceJ2000));
  const eclipticLongitude = meanLongitude + (toRadians(6.289) * Math.sin(meanAnomaly));
  const eclipticLatitude = toRadians(5.128) * Math.sin(argumentOfLatitude);
  const rightAscension = Math.atan2(
    (Math.sin(eclipticLongitude) * Math.cos(obliquity)) -
      (Math.tan(eclipticLatitude) * Math.sin(obliquity)),
    Math.cos(eclipticLongitude)
  );
  const declination = Math.asin(
    (Math.sin(eclipticLatitude) * Math.cos(obliquity)) +
      (Math.cos(eclipticLatitude) * Math.sin(obliquity) * Math.sin(eclipticLongitude))
  );

  return {
    daysSinceJ2000,
    declination,
    eclipticLatitude,
    eclipticLongitude,
    rightAscension
  };
}

export function getMoonPhaseFromProgress(phaseProgressValue) {
  const phaseProgress = THREE.MathUtils.euclideanModulo(phaseProgressValue, 1);
  const phaseAngleRadians = phaseProgress * FULL_CIRCLE_RADIANS;
  const phaseAngleDegrees = phaseProgress * FULL_CIRCLE_DEGREES;
  const illuminationFraction = (1 - Math.cos(phaseAngleRadians)) / 2;
  const phaseStepIndex = Math.floor((phaseProgress * MOON_PHASE_STEP_COUNT) + 0.5) % MOON_PHASE_STEP_COUNT;

  return {
    illuminationFraction,
    labelKey: MOON_PHASE_LABEL_KEYS[phaseStepIndex],
    phaseAngleDegrees,
    phaseAngleRadians,
    phaseProgress,
    phaseStepCount: MOON_PHASE_STEP_COUNT,
    phaseStepDegrees: MOON_PHASE_STEP_DEGREES,
    phaseStepIndex,
    phaseStepNumber: phaseStepIndex + 1,
    waxing: phaseProgress > 0 && phaseProgress < 0.5
  };
}

export function getMoonPhase(date) {
  const julianDate = getJulianDate(date);
  const phaseProgress = (julianDate - REFERENCE_NEW_MOON_JULIAN_DATE) / SYNODIC_MONTH_DAYS;
  return getMoonPhaseFromProgress(phaseProgress);
}

export function getSunSubpoint(date) {
  const {
    daysSinceJ2000,
    declination,
    rightAscension
  } = getSunEquatorialPosition(date);

  return getSubpointFromEquatorial(rightAscension, declination, daysSinceJ2000);
}

function getSunDeclinationDegrees(date) {
  return getSunSubpoint(date).latitudeDegrees;
}

export function getMoonSubpoint(date) {
  const {
    daysSinceJ2000,
    declination,
    rightAscension
  } = getMoonEquatorialPosition(date);

  return getSubpointFromEquatorial(rightAscension, declination, daysSinceJ2000);
}

function getClosestDeclinationMatch(startDate, endDate, targetDegrees) {
  let bestDate = startDate;
  let bestDelta = Number.POSITIVE_INFINITY;

  for (let time = startDate.getTime(); time <= endDate.getTime(); time += 15 * 60_000) {
    const sampleDate = new Date(time);
    const delta = Math.abs(getSunDeclinationDegrees(sampleDate) - targetDegrees);
    if (delta < bestDelta) {
      bestDate = sampleDate;
      bestDelta = delta;
    }
  }

  return bestDate;
}

function findZeroCrossing(startDate, endDate) {
  let previousDate = startDate;
  let previousValue = getSunDeclinationDegrees(previousDate);

  for (let time = startDate.getTime() + HOUR_MS; time <= endDate.getTime(); time += HOUR_MS) {
    const currentDate = new Date(time);
    const currentValue = getSunDeclinationDegrees(currentDate);

    if (previousValue === 0) {
      return previousDate;
    }
    if (currentValue === 0 || (previousValue < 0 && currentValue > 0) || (previousValue > 0 && currentValue < 0)) {
      let left = previousDate.getTime();
      let right = currentDate.getTime();
      let leftValue = previousValue;

      for (let iteration = 0; iteration < 32; iteration += 1) {
        const midpoint = (left + right) / 2;
        const midpointValue = getSunDeclinationDegrees(new Date(midpoint));

        if (Math.abs(midpointValue) < 0.0001) {
          return new Date(midpoint);
        }

        if ((leftValue < 0 && midpointValue > 0) || (leftValue > 0 && midpointValue < 0)) {
          right = midpoint;
          continue;
        }

        left = midpoint;
        leftValue = midpointValue;
      }

      return new Date((left + right) / 2);
    }

    previousDate = currentDate;
    previousValue = currentValue;
  }

  return getClosestDeclinationMatch(startDate, endDate, 0);
}

function findDeclinationExtremum(startDate, endDate, type) {
  let left = startDate.getTime();
  let right = endDate.getTime();
  const maximize = type === "max";

  for (let iteration = 0; iteration < 40; iteration += 1) {
    const leftThird = left + ((right - left) / 3);
    const rightThird = right - ((right - left) / 3);
    const leftValue = getSunDeclinationDegrees(new Date(leftThird));
    const rightValue = getSunDeclinationDegrees(new Date(rightThird));

    if ((maximize && leftValue < rightValue) || (!maximize && leftValue > rightValue)) {
      left = leftThird;
      continue;
    }

    right = rightThird;
  }

  return new Date((left + right) / 2);
}

export function getSeasonalEventMoments(year) {
  return {
    springEquinox: findZeroCrossing(
      new Date(year, 2, 18, 0, 0, 0, 0),
      new Date(year, 2, 22, 23, 59, 59, 999)
    ),
    summerSolstice: findDeclinationExtremum(
      new Date(year, 5, 19, 0, 0, 0, 0),
      new Date(year, 5, 23, 23, 59, 59, 999),
      "max"
    ),
    autumnEquinox: findZeroCrossing(
      new Date(year, 8, 20, 0, 0, 0, 0),
      new Date(year, 8, 24, 23, 59, 59, 999)
    ),
    winterSolstice: findDeclinationExtremum(
      new Date(year, 11, 19, 0, 0, 0, 0),
      new Date(year, 11, 23, 23, 59, 59, 999),
      "min"
    )
  };
}

function getMoonMotionWindow(date) {
  const windowStartMs = date.getTime() - (DAY_MS / 2);
  const windowEndMs = date.getTime() + (DAY_MS / 2);
  const sampleCount = 96;
  let previousSample = getMoonSubpoint(new Date(windowStartMs));
  let latitudeMinDegrees = previousSample.latitudeDegrees;
  let latitudeMaxDegrees = previousSample.latitudeDegrees;
  let longitudeSweepDegrees = 0;

  for (let index = 1; index <= sampleCount; index += 1) {
    const progress = index / sampleCount;
    const sampleDate = new Date(windowStartMs + ((windowEndMs - windowStartMs) * progress));
    const sample = getMoonSubpoint(sampleDate);
    latitudeMinDegrees = Math.min(latitudeMinDegrees, sample.latitudeDegrees);
    latitudeMaxDegrees = Math.max(latitudeMaxDegrees, sample.latitudeDegrees);
    longitudeSweepDegrees += Math.abs(normalizeDegrees(sample.longitudeDegrees - previousSample.longitudeDegrees));
    previousSample = sample;
  }

  const start = getMoonSubpoint(new Date(windowStartMs));
  const end = getMoonSubpoint(new Date(windowEndMs));

  return {
    start,
    end,
    latitudeMinDegrees,
    latitudeMaxDegrees,
    latitudeSpanDegrees: latitudeMaxDegrees - latitudeMinDegrees,
    longitudeSweepDegrees,
    netLatitudeDeltaDegrees: end.latitudeDegrees - start.latitudeDegrees,
    netLongitudeDeltaDegrees: normalizeDegrees(end.longitudeDegrees - start.longitudeDegrees)
  };
}

export function getSeasonalMoonAudit(key, year) {
  const seasonalEvents = getSeasonalEventMoments(year);
  const fallbackDefinition = SEASONAL_EVENT_DEFINITIONS.find((definition) => definition.key === key) ??
    SEASONAL_EVENT_DEFINITIONS[0];
  const eventDate = seasonalEvents[key] ??
    new Date(year, fallbackDefinition.fallbackMonth, fallbackDefinition.fallbackDay, 12, 0, 0, 0);

  return {
    key,
    date: eventDate,
    moonPhase: getMoonPhase(eventDate),
    sun: getSunSubpoint(eventDate),
    moon: getMoonSubpoint(eventDate),
    motion: getMoonMotionWindow(eventDate)
  };
}

export function getSeasonalSunAudit(year, observerLatitudeDegrees, observerLongitudeDegrees) {
  const seasonalEvents = getSeasonalEventMoments(year);

  return SEASONAL_EVENT_DEFINITIONS.map((definition) => {
    const date = seasonalEvents[definition.key] ??
      new Date(year, definition.fallbackMonth, definition.fallbackDay, 12, 0, 0, 0);

    return {
      key: definition.key,
      date,
      sun: getSunSubpoint(date),
      horizontal: getSunHorizontalCoordinates(date, observerLatitudeDegrees, observerLongitudeDegrees)
    };
  });
}

export function getBodyPositionFromGeo({
  latitudeDegrees,
  longitudeDegrees,
  getHeight,
  discRadius,
  domeRadius
}) {
  const projectedRadius = THREE.MathUtils.clamp(
    projectedRadiusFromLatitude(latitudeDegrees, discRadius),
    0,
    domeRadius - 0.2
  );
  const longitude = toRadians(longitudeDegrees);

  return new THREE.Vector3(
    -Math.cos(longitude) * projectedRadius,
    getHeight(projectedRadius),
    Math.sin(longitude) * projectedRadius
  );
}

export function createSolarEclipseState(overrides = {}) {
  return {
    active: false,
    total: false,
    coverage: 0,
    projectionCoverage: 0,
    rawCoverage: 0,
    direction: "idle",
    lightReduction: 0,
    sunlightScale: 1,
    sunlightPercent: 100,
    normalizedDistance: Number.POSITIVE_INFINITY,
    recentlyActive: false,
    bandIndex: 1,
    bandDelta: Number.POSITIVE_INFINITY,
    hasContact: false,
    hasVisibleOverlap: false,
    contactDepthPx: 0,
    laneIndex: 0,
    laneDelta: Number.POSITIVE_INFINITY,
    eclipseTier: "none",
    rawStageKey: "idle",
    stageKey: "idle",
    stageLabelKey: "solarEclipseStageIdle",
    stageProgress: 0,
    eventWindowActive: false,
    eventWindowJustOpened: false,
    eventWindowJustClosed: false,
    visibleInView: false,
    ...overrides
  };
}

export function createLunarEclipseState(overrides = {}) {
  return {
    active: false,
    total: false,
    coverage: 0,
    projectionCoverage: 0,
    rawCoverage: 0,
    direction: "idle",
    lightReduction: 0,
    normalizedDistance: Number.POSITIVE_INFINITY,
    recentlyActive: false,
    bandIndex: 1,
    bandDelta: Number.POSITIVE_INFINITY,
    hasContact: false,
    hasVisibleOverlap: false,
    contactDepthPx: 0,
    laneIndex: 0,
    laneDelta: Number.POSITIVE_INFINITY,
    eclipseTier: "none",
    rawStageKey: "idle",
    stageKey: "idle",
    stageLabelKey: "lunarEclipseStageIdle",
    stageProgress: 0,
    eventWindowActive: false,
    eventWindowJustOpened: false,
    eventWindowJustClosed: false,
    visibleInView: false,
    ...overrides
  };
}

export function getAstronomySnapshot({
  date,
  discRadius,
  domeRadius,
  getDarkSunRenderState,
  getSunRenderState,
  getMoonBaseHeight,
  getMoonRenderState
}) {
  const sun = getSunSubpoint(date);
  const moon = getMoonSubpoint(date);
  const sunProjectedRadius = THREE.MathUtils.clamp(
    projectedRadiusFromLatitude(sun.latitudeDegrees, discRadius),
    0,
    domeRadius - 0.2
  );
  const sunRenderState = getSunRenderState({
    date,
    longitudeDegrees: sun.longitudeDegrees,
    projectedRadius: sunProjectedRadius,
    source: "reality"
  });
  const sunRenderPosition = sunRenderState.position.clone();
  const moonProjectedRadius = THREE.MathUtils.clamp(
    projectedRadiusFromLatitude(moon.latitudeDegrees, discRadius),
    0,
    domeRadius - 0.2
  );
  const moonRenderState = getMoonRenderState
    ? getMoonRenderState({
      date,
      longitudeDegrees: moon.longitudeDegrees,
      projectedRadius: moonProjectedRadius,
      source: "reality"
    })
    : null;
  const moonRenderPosition = moonRenderState?.position?.clone() ?? getBodyPositionFromGeo({
    latitudeDegrees: moon.latitudeDegrees,
    longitudeDegrees: moon.longitudeDegrees,
    getHeight: getMoonBaseHeight,
    discRadius,
    domeRadius
  });
  const darkSunRenderState = getDarkSunRenderState
    ? getDarkSunRenderState({
      date,
      source: "reality"
    })
    : null;
  const darkSunRenderPosition = darkSunRenderState?.position?.clone() ?? null;

  return {
    date,
    sun,
    moon,
    moonPhase: getMoonPhase(date),
    sunPosition: sunRenderPosition.clone(),
    sunRenderPosition,
    sunRenderState,
    darkSunRenderPosition,
    darkSunRenderState,
    moonPosition: moonRenderPosition.clone(),
    moonRenderPosition,
    moonRenderState,
    solarEclipse: createSolarEclipseState()
  };
}

export function getSolarAltitudeFactor(
  latitudeDegrees,
  longitudeDegrees,
  sunLatitudeDegrees,
  sunLongitudeDegrees
) {
  const latitude = toRadians(latitudeDegrees);
  const longitudeDelta = toRadians(longitudeDegrees - sunLongitudeDegrees);
  const sunLatitude = toRadians(sunLatitudeDegrees);
  return (
    (Math.sin(latitude) * Math.sin(sunLatitude)) +
    (Math.cos(latitude) * Math.cos(sunLatitude) * Math.cos(longitudeDelta))
  );
}

export function getDisplayAwareSolarFactor(solarFactor, displayAltitudeDegrees) {
  if (!Number.isFinite(displayAltitudeDegrees)) {
    return solarFactor;
  }

  const displayFactor = Math.sin(toRadians(displayAltitudeDegrees));
  const displayWeight = THREE.MathUtils.clamp((displayAltitudeDegrees + 10) / 52, 0.2, 0.72);
  return THREE.MathUtils.clamp(
    THREE.MathUtils.lerp(solarFactor, displayFactor, displayWeight),
    -1,
    1
  );
}

export function getLocalSolarAltitudeRadiansFromModel(
  surfaceX,
  surfaceZ,
  sunX,
  sunZ,
  sunHeightAboveSurface
) {
  const planarDistance = Math.hypot(sunX - surfaceX, sunZ - surfaceZ);
  return Math.atan2(sunHeightAboveSurface, Math.max(planarDistance, 0.0001));
}

export function getLocalSolarAltitudeDegreesFromModel(
  surfaceX,
  surfaceZ,
  sunX,
  sunZ,
  sunHeightAboveSurface
) {
  return toDegrees(getLocalSolarAltitudeRadiansFromModel(
    surfaceX,
    surfaceZ,
    sunX,
    sunZ,
    sunHeightAboveSurface
  ));
}

export function getDisplayLocalSolarAltitudeDegreesFromModel(
  surfaceX,
  surfaceZ,
  sunX,
  sunZ,
  sunHeightAboveSurface,
  horizonOffsetDegrees = LOCAL_LIGHT_HORIZON_OFFSET_DEGREES
) {
  return getLocalSolarAltitudeDegreesFromModel(
    surfaceX,
    surfaceZ,
    sunX,
    sunZ,
    sunHeightAboveSurface
  ) - horizonOffsetDegrees;
}

export function getLocalLightSummaryFromAltitude(altitudeDegrees) {
  if (altitudeDegrees >= 8) {
    return "Day";
  }
  if (altitudeDegrees >= 0) {
    return "Low Sun";
  }
  if (altitudeDegrees >= -6) {
    return "Twilight";
  }
  return "Night";
}

export function getSunHorizontalCoordinates(date, observerLatitudeDegrees, observerLongitudeDegrees) {
  const {
    daysSinceJ2000,
    declination,
    rightAscension
  } = getSunEquatorialPosition(date);

  return getHorizontalCoordinates({
    daysSinceJ2000,
    declination,
    observerLatitudeDegrees,
    observerLongitudeDegrees,
    rightAscension
  });
}

export function getMoonHorizontalCoordinates(date, observerLatitudeDegrees, observerLongitudeDegrees) {
  const {
    daysSinceJ2000,
    declination,
    rightAscension
  } = getMoonEquatorialPosition(date);

  return getHorizontalCoordinates({
    daysSinceJ2000,
    declination,
    observerLatitudeDegrees,
    observerLongitudeDegrees,
    rightAscension
  });
}

function getHorizontalCoordinates({
  daysSinceJ2000,
  declination,
  observerLatitudeDegrees,
  observerLongitudeDegrees,
  rightAscension
}) {
  const {
    observerLatitude,
    observerLongitude
  } = {
    observerLatitude: toRadians(observerLatitudeDegrees),
    observerLongitude: toRadians(observerLongitudeDegrees)
  };
  const localSiderealAngle = getGreenwichSiderealAngle(daysSinceJ2000) + observerLongitude;
  const hourAngle = localSiderealAngle - rightAscension;
  const sinAltitude =
    (Math.sin(observerLatitude) * Math.sin(declination)) +
    (Math.cos(observerLatitude) * Math.cos(declination) * Math.cos(hourAngle));
  const altitude = Math.asin(THREE.MathUtils.clamp(sinAltitude, -1, 1));
  const azimuth = Math.atan2(
    -Math.sin(hourAngle),
    (Math.tan(declination) * Math.cos(observerLatitude)) -
      (Math.sin(observerLatitude) * Math.cos(hourAngle))
  );

  return {
    altitudeDegrees: toDegrees(altitude),
    azimuthDegrees: normalizeDegrees(toDegrees(azimuth)),
    altitudeRadians: altitude,
    azimuthRadians: azimuth
  };
}

export function getLocalLightSummary(solarFactor) {
  if (solarFactor > 0.18) {
    return "Day";
  }
  if (solarFactor > 0.02) {
    return "Low Sun";
  }
  if (solarFactor > -0.08) {
    return "Twilight";
  }
  return "Night";
}
