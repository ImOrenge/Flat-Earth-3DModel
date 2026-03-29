import { getBuiltInEclipseCatalog } from "./eclipse-events-utils.js?v=20260325-eclipse-selector1";

const ROUTES_DATA_PATH = "./assets/data/routes.json";
const AIRPORTS_DATA_PATH = "./assets/data/airports.json";
const BENCHMARKS_DATA_PATH = "./assets/data/comparison-benchmarks.json";

const DAY_MS = 86_400_000;
const SYNODIC_MONTH_DAYS = 29.530588853;
const SYNODIC_MONTH_MS = SYNODIC_MONTH_DAYS * DAY_MS;
const EARTH_RADIUS_KM = 6371;
const KTS_TO_KPH = 1.852;
const MOON_PHASE_EPOCH_MS = Date.parse("2000-01-06T18:14:00.000Z");

const CATEGORY_ORDER = ["routes", "eclipses", "orbit", "rotation"];

const DEFAULT_BENCHMARKS = {
  declination: [
    { iso: "2026-03-20T12:00:00.000Z", expectedDeclinationDegrees: 0.0 },
    { iso: "2026-06-21T12:00:00.000Z", expectedDeclinationDegrees: 23.44 },
    { iso: "2026-09-22T12:00:00.000Z", expectedDeclinationDegrees: 0.0 },
    { iso: "2026-12-21T12:00:00.000Z", expectedDeclinationDegrees: -23.44 },
  ],
  dayLength: [
    { iso: "2026-06-21T12:00:00.000Z", latitudeDegrees: 0, expectedHours: 12 },
    { iso: "2026-06-21T12:00:00.000Z", latitudeDegrees: 37.5665, expectedHours: 14.6 },
    { iso: "2026-12-21T12:00:00.000Z", latitudeDegrees: 37.5665, expectedHours: 9.4 },
    { iso: "2026-06-21T12:00:00.000Z", latitudeDegrees: 60, expectedHours: 18.8 },
    { iso: "2026-12-21T12:00:00.000Z", latitudeDegrees: 60, expectedHours: 5.5 },
  ],
  rotation: [
    { latitudeDegrees: 0, expectedSpeedKph: 1670.0 },
    { latitudeDegrees: 30, expectedSpeedKph: 1446.4 },
    { latitudeDegrees: 60, expectedSpeedKph: 835.0 },
    { latitudeDegrees: 80, expectedSpeedKph: 290.0 },
    { latitudeDegrees: 90, expectedSpeedKph: 0.0 },
  ],
};

export const DEFAULT_COMPARISON_THRESHOLDS = {
  routeRelativeError: 0.18,
  eclipsePeakMinutes: 90,
  orbitDeclinationRmseDeg: 2.0,
  orbitDayLengthRmseMinutes: 35,
  rotationSpeedMpe: 0.15,
};

function normalizeDegrees(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  let out = value % 360;
  if (out > 180) {
    out -= 360;
  }
  if (out <= -180) {
    out += 360;
  }
  return out;
}

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function euclideanModulo(value, modulo) {
  if (!Number.isFinite(value) || !Number.isFinite(modulo) || modulo === 0) {
    return 0;
  }
  return ((value % modulo) + modulo) % modulo;
}

function toFixed(value, digits = 2) {
  return Number.isFinite(value) ? value.toFixed(digits) : "-";
}

function average(values) {
  if (!Array.isArray(values) || values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function rmse(values) {
  if (!Array.isArray(values) || values.length === 0) {
    return 0;
  }
  const meanSquare = values.reduce((sum, value) => sum + (value * value), 0) / values.length;
  return Math.sqrt(meanSquare);
}

function clampScore(value) {
  return clamp(Number.isFinite(value) ? value : 0, 0, 100);
}

function shortestAngleDeg(a, b) {
  return Math.abs(normalizeDegrees(a - b));
}

function haversineDistanceKm(lat1Deg, lon1Deg, lat2Deg, lon2Deg) {
  const lat1 = toRadians(lat1Deg);
  const lat2 = toRadians(lat2Deg);
  const dLat = toRadians(lat2Deg - lat1Deg);
  const dLon = toRadians(lon2Deg - lon1Deg);
  const h = (
    (Math.sin(dLat / 2) ** 2) +
    (Math.cos(lat1) * Math.cos(lat2) * (Math.sin(dLon / 2) ** 2))
  );
  return EARTH_RADIUS_KM * (2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)));
}

function flatProjectedDistanceKm(lat1Deg, lon1Deg, lat2Deg, lon2Deg) {
  const lat1 = toRadians(lat1Deg);
  const lat2 = toRadians(lat2Deg);
  const lon1 = toRadians(lon1Deg);
  const lon2 = toRadians(lon2Deg);
  const r1 = EARTH_RADIUS_KM * ((Math.PI / 2) - lat1);
  const r2 = EARTH_RADIUS_KM * ((Math.PI / 2) - lat2);
  const x1 = r1 * Math.sin(lon1);
  const y1 = -r1 * Math.cos(lon1);
  const x2 = r2 * Math.sin(lon2);
  const y2 = -r2 * Math.cos(lon2);
  return Math.hypot(x2 - x1, y2 - y1);
}

function getSunDeclinationDeg(date) {
  const startOfYearUtcMs = Date.UTC(date.getUTCFullYear(), 0, 1, 0, 0, 0, 0);
  const dayFraction = (date.getTime() - startOfYearUtcMs) / DAY_MS;
  const gamma = ((Math.PI * 2) / 365) * (dayFraction - 1);
  const declinationRad = (
    0.006918 -
    (0.399912 * Math.cos(gamma)) +
    (0.070257 * Math.sin(gamma)) -
    (0.006758 * Math.cos(2 * gamma)) +
    (0.000907 * Math.sin(2 * gamma)) -
    (0.002697 * Math.cos(3 * gamma)) +
    (0.00148 * Math.sin(3 * gamma))
  );
  return (declinationRad * 180) / Math.PI;
}

function getFlatSeasonDeclinationDeg(date) {
  const yearStartMs = Date.UTC(date.getUTCFullYear(), 0, 1, 0, 0, 0, 0);
  const phase = euclideanModulo((date.getTime() - yearStartMs) / (365.2422 * DAY_MS), 1);
  if (phase < 0.25) {
    return (phase / 0.25) * 23.44;
  }
  if (phase < 0.5) {
    return 23.44 - (((phase - 0.25) / 0.25) * 23.44);
  }
  if (phase < 0.75) {
    return -(((phase - 0.5) / 0.25) * 23.44);
  }
  return -23.44 + (((phase - 0.75) / 0.25) * 23.44);
}

function getSphericalDayLengthHours(latitudeDeg, declinationDeg) {
  const latitudeRad = toRadians(latitudeDeg);
  const declinationRad = toRadians(declinationDeg);
  const x = -Math.tan(latitudeRad) * Math.tan(declinationRad);
  if (x <= -1) {
    return 24;
  }
  if (x >= 1) {
    return 0;
  }
  return (24 / Math.PI) * Math.acos(x);
}

function getFlatDayLengthHours(latitudeDeg, declinationDeg) {
  const sphericalHours = getSphericalDayLengthHours(latitudeDeg, declinationDeg);
  const latitudePenalty = 1 - (0.35 * (Math.abs(latitudeDeg) / 90));
  return 12 + ((sphericalHours - 12) * latitudePenalty);
}

function getSunEclipticLongitudeDeg(dateMs) {
  const days = (dateMs / DAY_MS) + 2440587.5 - 2451545;
  const meanAnomaly = toRadians(357.5291 + (0.98560028 * days));
  const equationCenter = (
    (1.9148 * Math.sin(meanAnomaly)) +
    (0.02 * Math.sin(2 * meanAnomaly)) +
    (0.0003 * Math.sin(3 * meanAnomaly))
  );
  const longitude = 102.9372 + ((meanAnomaly * 180) / Math.PI) + equationCenter + 180;
  return normalizeDegrees(longitude);
}

function getMoonEclipticModel(dateMs) {
  const days = (dateMs / DAY_MS) + 2440587.5 - 2451545;
  const meanLongitude = 218.316 + (13.176396 * days);
  const meanAnomaly = 134.963 + (13.064993 * days);
  const argumentLatitude = 93.272 + (13.22935 * days);
  const lonDeg = normalizeDegrees(meanLongitude + (6.289 * Math.sin(toRadians(meanAnomaly))));
  const latDeg = 5.145 * Math.sin(toRadians(argumentLatitude));
  const phaseDeg = normalizeDegrees(lonDeg - getSunEclipticLongitudeDeg(dateMs));
  return { lonDeg, latDeg, phaseDeg };
}

function getFlatMoonPhaseDeg(dateMs) {
  const phase = euclideanModulo((dateMs - MOON_PHASE_EPOCH_MS) / SYNODIC_MONTH_MS, 1);
  return normalizeDegrees(phase * 360);
}

function getFlatMoonLatitudeDeg(dateMs) {
  const phase = euclideanModulo((dateMs - MOON_PHASE_EPOCH_MS) / SYNODIC_MONTH_MS, 1);
  return 12 * Math.sin((phase * Math.PI * 2) + 0.62);
}

function normalizeEclipseType(type, kind) {
  if (kind === "lunar") {
    return type === "total" ? "total" : "partial";
  }
  return type === "total" ? "total" : "partial";
}

function predictFlatPeakMsFreeMode(anchorMs, kind) {
  const targetPhase = kind === "solar" ? 0 : 0.5;
  const cycle = (anchorMs - MOON_PHASE_EPOCH_MS) / SYNODIC_MONTH_MS;
  const rounded = Math.round(cycle - targetPhase) + targetPhase;
  return MOON_PHASE_EPOCH_MS + (rounded * SYNODIC_MONTH_MS);
}

function predictSphericalEclipsePeak(event) {
  const windowStart = event.startMs - (4 * 3_600_000);
  const windowEnd = event.endMs + (4 * 3_600_000);
  const targetPhase = event.kind === "solar" ? 0 : 180;
  let bestMs = event.peakMs;
  let bestPhase = Number.POSITIVE_INFINITY;
  let bestLat = Number.POSITIVE_INFINITY;
  let bestMetric = Number.POSITIVE_INFINITY;

  for (let ms = windowStart; ms <= windowEnd; ms += 20 * 60_000) {
    const moon = getMoonEclipticModel(ms);
    const phaseErr = shortestAngleDeg(moon.phaseDeg, targetPhase);
    const latErr = Math.abs(moon.latDeg);
    const metric = phaseErr + (latErr * 3);
    if (metric < bestMetric) {
      bestMetric = metric;
      bestMs = ms;
      bestPhase = phaseErr;
      bestLat = latErr;
    }
  }

  const predictedType = (
    bestPhase < 1.1 &&
    bestLat < (event.kind === "solar" ? 0.35 : 0.45)
  ) ? "total" : "partial";

  return { predictedPeakMs: bestMs, predictedType };
}

function predictFlatEclipsePeak(event) {
  const predictedPeakMs = predictFlatPeakMsFreeMode(event.peakMs, event.kind);
  const targetPhase = event.kind === "solar" ? 0 : 180;
  const phaseErr = shortestAngleDeg(getFlatMoonPhaseDeg(predictedPeakMs), targetPhase);
  const latErr = Math.abs(getFlatMoonLatitudeDeg(predictedPeakMs));
  const predictedType = (
    phaseErr < 5 &&
    latErr < (event.kind === "solar" ? 1.8 : 2.4)
  ) ? "total" : "partial";
  return { predictedPeakMs, predictedType };
}

function toAirportMap(airports) {
  const map = {};
  for (const airport of airports ?? []) {
    if (!airport?.icao) {
      continue;
    }
    map[airport.icao] = airport;
  }
  return map;
}

function pickNearbyEvents(events, observationMs, maxEvents = 24) {
  return [...(events ?? [])]
    .sort((a, b) => Math.abs(a.peakMs - observationMs) - Math.abs(b.peakMs - observationMs))
    .slice(0, Math.max(1, maxEvents));
}

function buildRoutesMetric(routes, airportsByIcao, thresholds) {
  const flatErrors = [];
  const sphericalErrors = [];
  const evidence = [];

  for (const route of routes ?? []) {
    const origin = airportsByIcao[route.originIcao];
    const destination = airportsByIcao[route.destinationIcao];
    if (!origin || !destination) {
      continue;
    }
    const speedKph = Math.max(200, (route.cruiseSpeedKts || 0) * KTS_TO_KPH);
    const observedHours = Math.max(0.1, route.durationHours || 0);
    const sphericalHours = haversineDistanceKm(
      origin.latitude,
      origin.longitude,
      destination.latitude,
      destination.longitude,
    ) / speedKph;
    const flatHours = flatProjectedDistanceKm(
      origin.latitude,
      origin.longitude,
      destination.latitude,
      destination.longitude,
    ) / speedKph;
    const flatErr = Math.abs(flatHours - observedHours) / observedHours;
    const sphErr = Math.abs(sphericalHours - observedHours) / observedHours;
    flatErrors.push(flatErr);
    sphericalErrors.push(sphErr);

    if (evidence.length < 8) {
      evidence.push({
        label: route.id,
        observed: toFixed(observedHours),
        flat: toFixed(flatHours),
        spherical: toFixed(sphericalHours),
        unit: "hours",
      });
    }
  }

  const flatMeanError = average(flatErrors);
  const sphericalMeanError = average(sphericalErrors);
  return {
    category: "routes",
    flatScore: clampScore(100 - (flatMeanError * 100)),
    sphericalScore: clampScore(100 - (sphericalMeanError * 100)),
    flatFlag: {
      contradiction: flatMeanError > thresholds.routeRelativeError,
      reason: "mean relative duration error",
      observedValue: flatMeanError,
      thresholdValue: thresholds.routeRelativeError,
      unit: "ratio",
    },
    sphericalFlag: {
      contradiction: sphericalMeanError > thresholds.routeRelativeError,
      reason: "mean relative duration error",
      observedValue: sphericalMeanError,
      thresholdValue: thresholds.routeRelativeError,
      unit: "ratio",
    },
    evidence,
  };
}

function buildEclipseMetric(solarEvents, lunarEvents, observationMs, thresholds) {
  const events = pickNearbyEvents([...(solarEvents ?? []), ...(lunarEvents ?? [])], observationMs, 28);
  const flatTimingErrors = [];
  const sphericalTimingErrors = [];
  let flatTypeMismatch = 0;
  let sphericalTypeMismatch = 0;
  const evidence = [];

  for (const event of events) {
    const expectedType = normalizeEclipseType(event.type, event.kind);
    const sphericalPrediction = predictSphericalEclipsePeak(event);
    const flatPrediction = predictFlatEclipsePeak(event);
    const sphErr = Math.abs(sphericalPrediction.predictedPeakMs - event.peakMs) / 60_000;
    const flatErr = Math.abs(flatPrediction.predictedPeakMs - event.peakMs) / 60_000;
    sphericalTimingErrors.push(sphErr);
    flatTimingErrors.push(flatErr);
    if (sphericalPrediction.predictedType !== expectedType) {
      sphericalTypeMismatch += 1;
    }
    if (flatPrediction.predictedType !== expectedType) {
      flatTypeMismatch += 1;
    }

    if (evidence.length < 10) {
      evidence.push({
        label: event.sourceId || event.id,
        observed: new Date(event.peakMs).toISOString().slice(11, 16),
        flat: new Date(flatPrediction.predictedPeakMs).toISOString().slice(11, 16),
        spherical: new Date(sphericalPrediction.predictedPeakMs).toISOString().slice(11, 16),
        unit: "UTC",
      });
    }
  }

  const flatTimingError = average(flatTimingErrors);
  const sphericalTimingError = average(sphericalTimingErrors);
  const flatMismatchRatio = events.length ? flatTypeMismatch / events.length : 0;
  const sphericalMismatchRatio = events.length ? sphericalTypeMismatch / events.length : 0;
  const flatPenalty = (flatTimingError / thresholds.eclipsePeakMinutes) + (flatMismatchRatio * 0.9);
  const sphericalPenalty = (sphericalTimingError / thresholds.eclipsePeakMinutes) + (sphericalMismatchRatio * 0.9);

  return {
    category: "eclipses",
    flatScore: clampScore(100 - (flatPenalty * 100)),
    sphericalScore: clampScore(100 - (sphericalPenalty * 100)),
    flatFlag: {
      contradiction: flatTimingError > thresholds.eclipsePeakMinutes || flatTypeMismatch > 0,
      reason: "peak time error or type mismatch",
      observedValue: Math.max(flatTimingError, flatMismatchRatio),
      thresholdValue: thresholds.eclipsePeakMinutes,
      unit: "minutes",
    },
    sphericalFlag: {
      contradiction: sphericalTimingError > thresholds.eclipsePeakMinutes || sphericalTypeMismatch > 0,
      reason: "peak time error or type mismatch",
      observedValue: Math.max(sphericalTimingError, sphericalMismatchRatio),
      thresholdValue: thresholds.eclipsePeakMinutes,
      unit: "minutes",
    },
    evidence,
  };
}

function buildOrbitMetric(benchmarks, thresholds) {
  const sphericalDeclinationErrors = [];
  const flatDeclinationErrors = [];
  const sphericalDayLengthErrorsMinutes = [];
  const flatDayLengthErrorsMinutes = [];
  const evidence = [];

  for (const sample of benchmarks.declination ?? []) {
    const date = new Date(sample.iso);
    const sphericalDeclination = getSunDeclinationDeg(date);
    const flatDeclination = getFlatSeasonDeclinationDeg(date);
    sphericalDeclinationErrors.push(sphericalDeclination - sample.expectedDeclinationDegrees);
    flatDeclinationErrors.push(flatDeclination - sample.expectedDeclinationDegrees);

    if (evidence.length < 4) {
      evidence.push({
        label: `${sample.iso.slice(0, 10)} dec`,
        observed: toFixed(sample.expectedDeclinationDegrees),
        flat: toFixed(flatDeclination),
        spherical: toFixed(sphericalDeclination),
        unit: "deg",
      });
    }
  }

  for (const sample of benchmarks.dayLength ?? []) {
    const date = new Date(sample.iso);
    const sphericalDeclination = getSunDeclinationDeg(date);
    const flatDeclination = getFlatSeasonDeclinationDeg(date);
    const sphericalHours = getSphericalDayLengthHours(sample.latitudeDegrees, sphericalDeclination);
    const flatHours = getFlatDayLengthHours(sample.latitudeDegrees, flatDeclination);
    sphericalDayLengthErrorsMinutes.push((sphericalHours - sample.expectedHours) * 60);
    flatDayLengthErrorsMinutes.push((flatHours - sample.expectedHours) * 60);

    if (evidence.length < 10) {
      evidence.push({
        label: `${sample.latitudeDegrees}deg ${sample.iso.slice(0, 10)}`,
        observed: toFixed(sample.expectedHours),
        flat: toFixed(flatHours),
        spherical: toFixed(sphericalHours),
        unit: "hours",
      });
    }
  }

  const flatDeclRmse = rmse(flatDeclinationErrors);
  const sphericalDeclRmse = rmse(sphericalDeclinationErrors);
  const flatDayRmseMinutes = rmse(flatDayLengthErrorsMinutes);
  const sphericalDayRmseMinutes = rmse(sphericalDayLengthErrorsMinutes);
  const flatPenalty = (
    (flatDeclRmse / thresholds.orbitDeclinationRmseDeg) * 0.5 +
    (flatDayRmseMinutes / thresholds.orbitDayLengthRmseMinutes) * 0.5
  );
  const sphericalPenalty = (
    (sphericalDeclRmse / thresholds.orbitDeclinationRmseDeg) * 0.5 +
    (sphericalDayRmseMinutes / thresholds.orbitDayLengthRmseMinutes) * 0.5
  );

  return {
    category: "orbit",
    flatScore: clampScore(100 - (flatPenalty * 100)),
    sphericalScore: clampScore(100 - (sphericalPenalty * 100)),
    flatFlag: {
      contradiction: (
        flatDeclRmse > thresholds.orbitDeclinationRmseDeg ||
        flatDayRmseMinutes > thresholds.orbitDayLengthRmseMinutes
      ),
      reason: "declination/day-length RMSE",
      observedValue: Math.max(flatDeclRmse, flatDayRmseMinutes),
      thresholdValue: Math.max(thresholds.orbitDeclinationRmseDeg, thresholds.orbitDayLengthRmseMinutes),
      unit: "mixed",
    },
    sphericalFlag: {
      contradiction: (
        sphericalDeclRmse > thresholds.orbitDeclinationRmseDeg ||
        sphericalDayRmseMinutes > thresholds.orbitDayLengthRmseMinutes
      ),
      reason: "declination/day-length RMSE",
      observedValue: Math.max(sphericalDeclRmse, sphericalDayRmseMinutes),
      thresholdValue: Math.max(thresholds.orbitDeclinationRmseDeg, thresholds.orbitDayLengthRmseMinutes),
      unit: "mixed",
    },
    evidence,
  };
}

function buildRotationMetric(benchmarks, thresholds) {
  const sphericalPctErrors = [];
  const flatPctErrors = [];
  const evidence = [];

  for (const sample of benchmarks.rotation ?? []) {
    const latitudeAbs = Math.abs(sample.latitudeDegrees);
    const sphericalSpeed = 1670 * Math.cos(toRadians(latitudeAbs));
    const flatSpeed = 1670 * ((90 - latitudeAbs) / 90);
    const denominator = Math.max(sample.expectedSpeedKph, 1e-6);
    sphericalPctErrors.push(Math.abs((sphericalSpeed - sample.expectedSpeedKph) / denominator));
    flatPctErrors.push(Math.abs((flatSpeed - sample.expectedSpeedKph) / denominator));

    evidence.push({
      label: `${sample.latitudeDegrees}deg`,
      observed: toFixed(sample.expectedSpeedKph),
      flat: toFixed(flatSpeed),
      spherical: toFixed(sphericalSpeed),
      unit: "km/h",
    });
  }

  const flatMpe = average(flatPctErrors);
  const sphericalMpe = average(sphericalPctErrors);
  return {
    category: "rotation",
    flatScore: clampScore(100 - (flatMpe * 100)),
    sphericalScore: clampScore(100 - (sphericalMpe * 100)),
    flatFlag: {
      contradiction: flatMpe > thresholds.rotationSpeedMpe,
      reason: "mean percentage error",
      observedValue: flatMpe,
      thresholdValue: thresholds.rotationSpeedMpe,
      unit: "ratio",
    },
    sphericalFlag: {
      contradiction: sphericalMpe > thresholds.rotationSpeedMpe,
      reason: "mean percentage error",
      observedValue: sphericalMpe,
      thresholdValue: thresholds.rotationSpeedMpe,
      unit: "ratio",
    },
    evidence,
  };
}

function computeModelComparison(observationTime, data, thresholds) {
  const observationMs = (
    observationTime instanceof Date
      ? observationTime.getTime()
      : (typeof observationTime === "number" ? observationTime : Date.parse(observationTime))
  );
  const timestampMs = Number.isFinite(observationMs) ? observationMs : Date.now();
  const resolvedThresholds = {
    ...DEFAULT_COMPARISON_THRESHOLDS,
    ...(thresholds ?? {}),
  };
  const resolvedBenchmarks = {
    declination: data.benchmarks?.declination?.length ? data.benchmarks.declination : DEFAULT_BENCHMARKS.declination,
    dayLength: data.benchmarks?.dayLength?.length ? data.benchmarks.dayLength : DEFAULT_BENCHMARKS.dayLength,
    rotation: data.benchmarks?.rotation?.length ? data.benchmarks.rotation : DEFAULT_BENCHMARKS.rotation,
  };

  const routesMetric = buildRoutesMetric(data.routes ?? [], data.airportsByIcao ?? {}, resolvedThresholds);
  const eclipsesMetric = buildEclipseMetric(data.solarEvents ?? [], data.lunarEvents ?? [], timestampMs, resolvedThresholds);
  const orbitMetric = buildOrbitMetric(resolvedBenchmarks, resolvedThresholds);
  const rotationMetric = buildRotationMetric(resolvedBenchmarks, resolvedThresholds);
  const metrics = [routesMetric, eclipsesMetric, orbitMetric, rotationMetric];

  return {
    timestampMs,
    timestampIso: new Date(timestampMs).toISOString(),
    thresholds: resolvedThresholds,
    metrics,
    flatTotalScore: average(metrics.map((metric) => metric.flatScore)),
    sphericalTotalScore: average(metrics.map((metric) => metric.sphericalScore)),
  };
}

async function loadJson(path) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to load ${path}: ${response.status}`);
  }
  return response.json();
}

function formatFlagValue(flag) {
  if (!flag) {
    return "-";
  }
  switch (flag.unit) {
    case "ratio":
      return `${toFixed(flag.observedValue * 100, 1)}% / ${toFixed(flag.thresholdValue * 100, 1)}%`;
    case "minutes":
      return `${toFixed(flag.observedValue, 1)}m / ${toFixed(flag.thresholdValue, 1)}m`;
    case "mixed":
      return `${toFixed(flag.observedValue, 2)} / ${toFixed(flag.thresholdValue, 2)}`;
    default:
      return `${toFixed(flag.observedValue, 2)} / ${toFixed(flag.thresholdValue, 2)}`;
  }
}

function getCategoryTitleKey(category) {
  const map = {
    routes: "comparisonCategoryRoutes",
    eclipses: "comparisonCategoryEclipses",
    orbit: "comparisonCategoryOrbit",
    rotation: "comparisonCategoryRotation",
  };
  return map[category] ?? "comparisonCategoryRoutes";
}

function getSectionElement(panelEl, category) {
  return panelEl?.querySelector(`[data-comparison-category="${category}"]`) ?? null;
}

function renderMetricSection(i18n, sectionEl, metric) {
  if (!sectionEl) {
    return;
  }
  if (!metric) {
    sectionEl.innerHTML = `<p class="sync-copy subtle">${i18n.t("comparisonNoData")}</p>`;
    return;
  }

  const flatBadgeKey = metric.flatFlag?.contradiction ? "comparisonBadgeContradiction" : "comparisonBadgeConsistent";
  const sphericalBadgeKey = metric.sphericalFlag?.contradiction ? "comparisonBadgeContradiction" : "comparisonBadgeConsistent";
  const evidenceRows = (metric.evidence ?? []).map((row) => `
    <tr>
      <td>${row.label ?? "-"}</td>
      <td>${row.observed ?? "-"}</td>
      <td>${row.flat ?? "-"}</td>
      <td>${row.spherical ?? "-"}</td>
      <td>${row.unit ?? "-"}</td>
    </tr>
  `).join("");

  sectionEl.innerHTML = `
    <div class="comparison-score-grid">
      <article class="comparison-score-card comparison-score-card-flat">
        <p class="comparison-score-title">${i18n.t("comparisonModelFlat")}</p>
        <strong class="comparison-score-value">${toFixed(metric.flatScore, 1)}</strong>
        <span class="comparison-badge ${metric.flatFlag?.contradiction ? "contradiction" : "ok"}">${i18n.t(flatBadgeKey)}</span>
        <p class="comparison-flag-value">${formatFlagValue(metric.flatFlag)}</p>
      </article>
      <article class="comparison-score-card comparison-score-card-spherical">
        <p class="comparison-score-title">${i18n.t("comparisonModelSpherical")}</p>
        <strong class="comparison-score-value">${toFixed(metric.sphericalScore, 1)}</strong>
        <span class="comparison-badge ${metric.sphericalFlag?.contradiction ? "contradiction" : "ok"}">${i18n.t(sphericalBadgeKey)}</span>
        <p class="comparison-flag-value">${formatFlagValue(metric.sphericalFlag)}</p>
      </article>
    </div>
    <div class="comparison-evidence-wrap">
      <p class="comparison-evidence-title">${i18n.t("comparisonEvidenceTitle")}</p>
      <div class="comparison-table-wrap">
        <table class="comparison-table">
          <thead>
            <tr>
              <th>${i18n.t("comparisonTableLabel")}</th>
              <th>${i18n.t("comparisonTableObserved")}</th>
              <th>${i18n.t("comparisonTableFlat")}</th>
              <th>${i18n.t("comparisonTableSpherical")}</th>
              <th>${i18n.t("comparisonTableUnit")}</th>
            </tr>
          </thead>
          <tbody>
            ${evidenceRows || `<tr><td colspan="5">${i18n.t("comparisonNoData")}</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

export function createModelComparisonController({
  i18n,
  constants,
  panelEl,
  cameraState,
  cameraApi,
  setEarthModelView,
}) {
  if (!panelEl) {
    return {
      applyTranslations() {},
      initialize() {},
      refresh() {},
      setPanelActive() {},
    };
  }

  const state = {
    ready: false,
    panelActive: false,
    sceneModel: "flat",
    lastMinuteBucket: null,
    snapshot: null,
    error: null,
    data: {
      routes: [],
      airportsByIcao: {},
      solarEvents: [],
      lunarEvents: [],
      benchmarks: DEFAULT_BENCHMARKS,
    },
  };

  const sceneModelButtons = [...panelEl.querySelectorAll("[data-comparison-scene-model]")];
  const summaryFlatEl = panelEl.querySelector("[data-comparison-total='flat']");
  const summarySphericalEl = panelEl.querySelector("[data-comparison-total='spherical']");
  const summaryTimeEl = panelEl.querySelector("[data-comparison-timestamp]");
  const summaryErrorEl = panelEl.querySelector("[data-comparison-error]");

  function syncSceneModelButtons() {
    for (const button of sceneModelButtons) {
      const active = button.dataset.comparisonSceneModel === state.sceneModel;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    }
  }

  function applySceneModel() {
    if (!state.panelActive) {
      setEarthModelView?.("flat");
      return;
    }
    setEarthModelView?.(state.sceneModel);

    if (state.sceneModel === "spherical") {
      cameraState.targetRadius = constants.CAMERA_GLOBE_DEFAULT_RADIUS ?? cameraState.targetRadius;
      cameraState.targetPhi = Math.max(cameraState.targetPhi, constants.CAMERA_TOPDOWN_EXACT_PHI ?? 0.05);
      cameraApi?.clampCamera?.();
    } else {
      cameraApi?.clampCamera?.();
    }
  }

  function renderSummary() {
    if (summaryErrorEl) {
      summaryErrorEl.hidden = !state.error;
      summaryErrorEl.textContent = state.error ? i18n.t("comparisonLoadFailed") : "";
    }

    if (!state.snapshot) {
      if (summaryFlatEl) {
        summaryFlatEl.textContent = "-";
      }
      if (summarySphericalEl) {
        summarySphericalEl.textContent = "-";
      }
      if (summaryTimeEl) {
        summaryTimeEl.textContent = state.ready
          ? i18n.t("comparisonNoData")
          : i18n.t("comparisonLoading");
      }
      return;
    }

    if (summaryFlatEl) {
      summaryFlatEl.textContent = toFixed(state.snapshot.flatTotalScore, 1);
    }
    if (summarySphericalEl) {
      summarySphericalEl.textContent = toFixed(state.snapshot.sphericalTotalScore, 1);
    }
    if (summaryTimeEl) {
      summaryTimeEl.textContent = i18n.formatDate(new Date(state.snapshot.timestampMs), {
        dateStyle: "medium",
        timeStyle: "short",
      });
    }
  }

  function renderMetrics() {
    renderSummary();
    const metricsByCategory = new Map((state.snapshot?.metrics ?? []).map((metric) => [metric.category, metric]));
    for (const category of CATEGORY_ORDER) {
      const container = getSectionElement(panelEl, category);
      const metric = metricsByCategory.get(category);
      renderMetricSection(i18n, container, metric);
    }
  }

  async function loadData() {
    const [routes, airports, benchmarks] = await Promise.all([
      loadJson(ROUTES_DATA_PATH),
      loadJson(AIRPORTS_DATA_PATH),
      loadJson(BENCHMARKS_DATA_PATH).catch(() => DEFAULT_BENCHMARKS),
    ]);
    const catalog = getBuiltInEclipseCatalog();
    state.data = {
      routes: Array.isArray(routes) ? routes : [],
      airportsByIcao: toAirportMap(Array.isArray(airports) ? airports : []),
      solarEvents: catalog?.eventsByKind?.solar ?? [],
      lunarEvents: catalog?.eventsByKind?.lunar ?? [],
      benchmarks: benchmarks && typeof benchmarks === "object" ? benchmarks : DEFAULT_BENCHMARKS,
    };
  }

  function refresh(observationTime = new Date()) {
    if (!state.ready || !state.panelActive) {
      return;
    }
    const ms = observationTime instanceof Date
      ? observationTime.getTime()
      : (typeof observationTime === "number" ? observationTime : Date.parse(observationTime));
    const safeMs = Number.isFinite(ms) ? ms : Date.now();
    const minuteBucket = Math.floor(safeMs / 60_000);
    if (minuteBucket === state.lastMinuteBucket && state.snapshot) {
      return;
    }
    state.lastMinuteBucket = minuteBucket;
    state.snapshot = computeModelComparison(safeMs, state.data, DEFAULT_COMPARISON_THRESHOLDS);
    renderMetrics();
  }

  function applyTranslations() {
    syncSceneModelButtons();
    if (state.snapshot) {
      renderMetrics();
    } else {
      renderSummary();
      for (const category of CATEGORY_ORDER) {
        const sectionEl = getSectionElement(panelEl, category);
        if (sectionEl && !sectionEl.innerHTML.trim()) {
          sectionEl.innerHTML = `<p class="sync-copy subtle">${i18n.t("comparisonLoading")}</p>`;
        }
      }
    }

    for (const category of CATEGORY_ORDER) {
      const titleEl = panelEl.querySelector(`[data-comparison-title='${category}']`);
      if (titleEl) {
        titleEl.textContent = i18n.t(getCategoryTitleKey(category));
      }
    }
  }

  function setPanelActive(isActive) {
    state.panelActive = Boolean(isActive);
    applySceneModel();
    if (state.panelActive) {
      state.lastMinuteBucket = null;
      refresh(new Date());
    }
  }

  function initialize() {
    syncSceneModelButtons();
    for (const button of sceneModelButtons) {
      button.addEventListener("click", () => {
        const nextModel = button.dataset.comparisonSceneModel === "spherical" ? "spherical" : "flat";
        state.sceneModel = nextModel;
        syncSceneModelButtons();
        applySceneModel();
      });
    }

    applyTranslations();
    loadData()
      .then(() => {
        state.ready = true;
        state.error = null;
        state.lastMinuteBucket = null;
        renderMetrics();
      })
      .catch(() => {
        state.ready = false;
        state.error = "load_failed";
        renderSummary();
      });
  }

  return {
    applyTranslations,
    initialize,
    refresh,
    setPanelActive,
  };
}
