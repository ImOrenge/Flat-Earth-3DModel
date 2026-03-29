import { clamp, euclideanModulo, normalizeDegrees, toRadians } from "./math";
import type {
  ComparisonBenchmarks,
  ComparisonEvidenceRow,
  ComparisonMetric,
  ComparisonSnapshot,
  ComparisonThresholds,
  EclipseEvent,
  RouteAirport,
  RouteDefinition,
} from "./types";

const DAY_MS = 86_400_000;
const SYNODIC_MONTH_DAYS = 29.530588853;
const SYNODIC_MONTH_MS = SYNODIC_MONTH_DAYS * DAY_MS;
const EARTH_RADIUS_KM = 6371;
const KTS_TO_KPH = 1.852;
const MOON_PHASE_EPOCH_MS = Date.parse("2000-01-06T18:14:00.000Z");

export const DEFAULT_COMPARISON_THRESHOLDS: ComparisonThresholds = {
  routeRelativeError: 0.18,
  eclipsePeakMinutes: 90,
  orbitDeclinationRmseDeg: 2.0,
  orbitDayLengthRmseMinutes: 35,
  rotationSpeedMpe: 0.15,
};

export const DEFAULT_COMPARISON_BENCHMARKS: ComparisonBenchmarks = {
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

export interface ComputeModelComparisonOptions {
  routes?: RouteDefinition[];
  airportsByIcao?: Record<string, RouteAirport>;
  solarEvents?: EclipseEvent[];
  lunarEvents?: EclipseEvent[];
  benchmarks?: ComparisonBenchmarks;
  thresholds?: Partial<ComparisonThresholds>;
}

function resolveDateInput(input: Date | number | string | undefined, fallbackMs: number): number {
  if (input instanceof Date) {
    return Number.isNaN(input.getTime()) ? fallbackMs : input.getTime();
  }
  if (typeof input === "number") {
    return Number.isFinite(input) ? input : fallbackMs;
  }
  if (typeof input === "string") {
    const parsed = Date.parse(input);
    return Number.isNaN(parsed) ? fallbackMs : parsed;
  }
  return fallbackMs;
}

function toFixed2(value: number): string {
  return Number.isFinite(value) ? value.toFixed(2) : "-";
}

function toFixed3(value: number): string {
  return Number.isFinite(value) ? value.toFixed(3) : "-";
}

function average(values: number[]): number {
  if (!values.length) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function rmse(values: number[]): number {
  if (!values.length) {
    return 0;
  }
  const meanSquare = values.reduce((sum, value) => sum + (value * value), 0) / values.length;
  return Math.sqrt(meanSquare);
}

function clampScore(score: number): number {
  return clamp(Number.isFinite(score) ? score : 0, 0, 100);
}

function shortestAngleDeg(a: number, b: number): number {
  return Math.abs(normalizeDegrees(a - b));
}

function haversineDistanceKm(
  lat1Deg: number,
  lon1Deg: number,
  lat2Deg: number,
  lon2Deg: number,
): number {
  const lat1 = toRadians(lat1Deg);
  const lat2 = toRadians(lat2Deg);
  const dLat = toRadians(lat2Deg - lat1Deg);
  const dLon = toRadians(lon2Deg - lon1Deg);
  const a = (
    (Math.sin(dLat / 2) ** 2) +
    (Math.cos(lat1) * Math.cos(lat2) * (Math.sin(dLon / 2) ** 2))
  );
  return EARTH_RADIUS_KM * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function flatProjectedDistanceKm(
  lat1Deg: number,
  lon1Deg: number,
  lat2Deg: number,
  lon2Deg: number,
): number {
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

function getSunDeclinationDeg(date: Date): number {
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

function getFlatSeasonDeclinationDeg(date: Date): number {
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

function getSphericalDayLengthHours(latitudeDeg: number, declinationDeg: number): number {
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

function getFlatDayLengthHours(latitudeDeg: number, declinationDeg: number): number {
  const sphericalHours = getSphericalDayLengthHours(latitudeDeg, declinationDeg);
  const latitudePenalty = 1 - (0.35 * (Math.abs(latitudeDeg) / 90));
  return 12 + ((sphericalHours - 12) * latitudePenalty);
}

function getSunEclipticLongitudeDeg(dateMs: number): number {
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

function getMoonEclipticModel(dateMs: number): { lonDeg: number; latDeg: number; phaseDeg: number } {
  const days = (dateMs / DAY_MS) + 2440587.5 - 2451545;
  const meanLongitude = 218.316 + (13.176396 * days);
  const meanAnomaly = 134.963 + (13.064993 * days);
  const argumentLatitude = 93.272 + (13.22935 * days);
  const lonDeg = normalizeDegrees(meanLongitude + (6.289 * Math.sin(toRadians(meanAnomaly))));
  const latDeg = 5.145 * Math.sin(toRadians(argumentLatitude));
  const phaseDeg = normalizeDegrees(lonDeg - getSunEclipticLongitudeDeg(dateMs));
  return { lonDeg, latDeg, phaseDeg };
}

function getFlatMoonPhaseDeg(dateMs: number): number {
  const phase = euclideanModulo((dateMs - MOON_PHASE_EPOCH_MS) / SYNODIC_MONTH_MS, 1);
  return normalizeDegrees(phase * 360);
}

function getFlatMoonLatitudeDeg(dateMs: number): number {
  const phase = euclideanModulo((dateMs - MOON_PHASE_EPOCH_MS) / SYNODIC_MONTH_MS, 1);
  return 12 * Math.sin((phase * Math.PI * 2) + 0.62);
}

function predictFlatPeakMs(anchorMs: number, kind: "solar" | "lunar"): number {
  const targetPhase = kind === "solar" ? 0 : 0.5;
  const cycle = (anchorMs - MOON_PHASE_EPOCH_MS) / SYNODIC_MONTH_MS;
  const rounded = Math.round(cycle - targetPhase) + targetPhase;
  return MOON_PHASE_EPOCH_MS + (rounded * SYNODIC_MONTH_MS);
}

function normalizeEclipseType(type: string, kind: "solar" | "lunar"): "partial" | "total" {
  if (kind === "lunar") {
    return type === "total" ? "total" : "partial";
  }
  return type === "total" ? "total" : "partial";
}

function predictSphericalEclipsePeak(
  event: EclipseEvent,
): { predictedPeakMs: number; predictedType: "partial" | "total" } {
  const windowStart = event.startMs - (4 * 3_600_000);
  const windowEnd = event.endMs + (4 * 3_600_000);
  let bestMs = event.peakMs;
  let bestMetric = Number.POSITIVE_INFINITY;
  let bestPhase = Number.POSITIVE_INFINITY;
  let bestLat = Number.POSITIVE_INFINITY;
  const targetPhase = event.kind === "solar" ? 0 : 180;

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

  const predictedType: "partial" | "total" = (
    bestPhase < 1.1 &&
    bestLat < (event.kind === "solar" ? 0.35 : 0.45)
  ) ? "total" : "partial";

  return { predictedPeakMs: bestMs, predictedType };
}

function predictFlatEclipsePeak(
  event: EclipseEvent,
): { predictedPeakMs: number; predictedType: "partial" | "total" } {
  const predictedPeakMs = predictFlatPeakMs(event.peakMs, event.kind);
  const targetPhase = event.kind === "solar" ? 0 : 180;
  const phaseErr = shortestAngleDeg(getFlatMoonPhaseDeg(predictedPeakMs), targetPhase);
  const latErr = Math.abs(getFlatMoonLatitudeDeg(predictedPeakMs));
  const predictedType: "partial" | "total" = (
    phaseErr < 5 &&
    latErr < (event.kind === "solar" ? 1.8 : 2.4)
  ) ? "total" : "partial";
  return { predictedPeakMs, predictedType };
}

function pickNearbyEvents(
  events: EclipseEvent[],
  observationMs: number,
  maxEvents = 24,
): EclipseEvent[] {
  return [...events]
    .sort((a, b) => Math.abs(a.peakMs - observationMs) - Math.abs(b.peakMs - observationMs))
    .slice(0, Math.max(1, maxEvents));
}

function buildRoutesMetric(
  routes: RouteDefinition[],
  airportsByIcao: Record<string, RouteAirport>,
  thresholds: ComparisonThresholds,
): ComparisonMetric {
  const relativeErrorFlat: number[] = [];
  const relativeErrorSpherical: number[] = [];
  const evidence: ComparisonEvidenceRow[] = [];

  for (const route of routes) {
    const origin = airportsByIcao[route.originIcao];
    const destination = airportsByIcao[route.destinationIcao];
    if (!origin || !destination) {
      continue;
    }
    const speedKph = Math.max(200, (route.cruiseSpeedKts || 0) * KTS_TO_KPH);
    const observedHours = Math.max(0.1, route.durationHours || 0);
    const sphericalDistance = haversineDistanceKm(
      origin.latitude,
      origin.longitude,
      destination.latitude,
      destination.longitude,
    );
    const flatDistance = flatProjectedDistanceKm(
      origin.latitude,
      origin.longitude,
      destination.latitude,
      destination.longitude,
    );
    const sphericalHours = sphericalDistance / speedKph;
    const flatHours = flatDistance / speedKph;
    const sphErr = Math.abs(sphericalHours - observedHours) / observedHours;
    const flatErr = Math.abs(flatHours - observedHours) / observedHours;
    relativeErrorSpherical.push(sphErr);
    relativeErrorFlat.push(flatErr);

    if (evidence.length < 8) {
      evidence.push({
        label: route.id,
        observed: toFixed2(observedHours),
        flat: toFixed2(flatHours),
        spherical: toFixed2(sphericalHours),
        unit: "hours",
      });
    }
  }

  const flatMeanError = average(relativeErrorFlat);
  const sphericalMeanError = average(relativeErrorSpherical);
  return {
    category: "routes",
    title: "Flight Routes",
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

function buildEclipseMetric(
  solarEvents: EclipseEvent[],
  lunarEvents: EclipseEvent[],
  observationMs: number,
  thresholds: ComparisonThresholds,
): ComparisonMetric {
  const events = pickNearbyEvents([...solarEvents, ...lunarEvents], observationMs, 28);
  const flatErrorMinutes: number[] = [];
  const sphericalErrorMinutes: number[] = [];
  let flatTypeMismatch = 0;
  let sphericalTypeMismatch = 0;
  const evidence: ComparisonEvidenceRow[] = [];

  for (const event of events) {
    const expectedType = normalizeEclipseType(event.type, event.kind);
    const sphericalPrediction = predictSphericalEclipsePeak(event);
    const flatPrediction = predictFlatEclipsePeak(event);
    const sphErr = Math.abs(sphericalPrediction.predictedPeakMs - event.peakMs) / 60_000;
    const flatErr = Math.abs(flatPrediction.predictedPeakMs - event.peakMs) / 60_000;
    sphericalErrorMinutes.push(sphErr);
    flatErrorMinutes.push(flatErr);
    if (sphericalPrediction.predictedType !== expectedType) {
      sphericalTypeMismatch += 1;
    }
    if (flatPrediction.predictedType !== expectedType) {
      flatTypeMismatch += 1;
    }

    if (evidence.length < 10) {
      evidence.push({
        label: event.sourceId || event.id,
        observed: toFixed2(event.peakMs / 60_000),
        flat: toFixed2(flatPrediction.predictedPeakMs / 60_000),
        spherical: toFixed2(sphericalPrediction.predictedPeakMs / 60_000),
        unit: "minutes-epoch",
      });
    }
  }

  const flatTimingError = average(flatErrorMinutes);
  const sphericalTimingError = average(sphericalErrorMinutes);
  const flatMismatchRatio = events.length ? flatTypeMismatch / events.length : 0;
  const sphericalMismatchRatio = events.length ? sphericalTypeMismatch / events.length : 0;
  const flatPenalty = (flatTimingError / thresholds.eclipsePeakMinutes) + (flatMismatchRatio * 0.9);
  const sphericalPenalty = (sphericalTimingError / thresholds.eclipsePeakMinutes) + (sphericalMismatchRatio * 0.9);

  return {
    category: "eclipses",
    title: "Solar/Lunar Eclipses",
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

function buildOrbitMetric(
  benchmarks: ComparisonBenchmarks,
  thresholds: ComparisonThresholds,
): ComparisonMetric {
  const sphericalDeclinationErrors: number[] = [];
  const flatDeclinationErrors: number[] = [];
  const sphericalDayLengthErrorsMinutes: number[] = [];
  const flatDayLengthErrorsMinutes: number[] = [];
  const evidence: ComparisonEvidenceRow[] = [];

  for (const sample of benchmarks.declination) {
    const date = new Date(sample.iso);
    const sphericalDeclination = getSunDeclinationDeg(date);
    const flatDeclination = getFlatSeasonDeclinationDeg(date);
    sphericalDeclinationErrors.push(sphericalDeclination - sample.expectedDeclinationDegrees);
    flatDeclinationErrors.push(flatDeclination - sample.expectedDeclinationDegrees);
    if (evidence.length < 4) {
      evidence.push({
        label: `${sample.iso} decl`,
        observed: toFixed2(sample.expectedDeclinationDegrees),
        flat: toFixed2(flatDeclination),
        spherical: toFixed2(sphericalDeclination),
        unit: "deg",
      });
    }
  }

  for (const sample of benchmarks.dayLength) {
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
        observed: toFixed2(sample.expectedHours),
        flat: toFixed2(flatHours),
        spherical: toFixed2(sphericalHours),
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
    title: "Orbit (Seasons / Declination / Day Length)",
    flatScore: clampScore(100 - (flatPenalty * 100)),
    sphericalScore: clampScore(100 - (sphericalPenalty * 100)),
    flatFlag: {
      contradiction: flatDeclRmse > thresholds.orbitDeclinationRmseDeg || flatDayRmseMinutes > thresholds.orbitDayLengthRmseMinutes,
      reason: "declination/day-length RMSE",
      observedValue: Math.max(flatDeclRmse, flatDayRmseMinutes),
      thresholdValue: Math.max(thresholds.orbitDeclinationRmseDeg, thresholds.orbitDayLengthRmseMinutes),
      unit: "mixed",
    },
    sphericalFlag: {
      contradiction: sphericalDeclRmse > thresholds.orbitDeclinationRmseDeg || sphericalDayRmseMinutes > thresholds.orbitDayLengthRmseMinutes,
      reason: "declination/day-length RMSE",
      observedValue: Math.max(sphericalDeclRmse, sphericalDayRmseMinutes),
      thresholdValue: Math.max(thresholds.orbitDeclinationRmseDeg, thresholds.orbitDayLengthRmseMinutes),
      unit: "mixed",
    },
    evidence,
  };
}

function buildRotationMetric(
  benchmarks: ComparisonBenchmarks,
  thresholds: ComparisonThresholds,
): ComparisonMetric {
  const sphericalPctErrors: number[] = [];
  const flatPctErrors: number[] = [];
  const evidence: ComparisonEvidenceRow[] = [];

  for (const sample of benchmarks.rotation) {
    const latitudeAbs = Math.abs(sample.latitudeDegrees);
    const sphericalSpeed = 1670 * Math.cos(toRadians(latitudeAbs));
    const flatSpeed = 1670 * ((90 - latitudeAbs) / 90);
    const denominator = Math.max(sample.expectedSpeedKph, 1e-6);
    sphericalPctErrors.push(Math.abs((sphericalSpeed - sample.expectedSpeedKph) / denominator));
    flatPctErrors.push(Math.abs((flatSpeed - sample.expectedSpeedKph) / denominator));
    evidence.push({
      label: `${sample.latitudeDegrees}deg`,
      observed: toFixed2(sample.expectedSpeedKph),
      flat: toFixed2(flatSpeed),
      spherical: toFixed2(sphericalSpeed),
      unit: "km/h",
    });
  }

  const flatMpe = average(flatPctErrors);
  const sphericalMpe = average(sphericalPctErrors);
  return {
    category: "rotation",
    title: "Rotation Speed",
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

export function computeModelComparison(
  observationTime: Date | number | string,
  options: ComputeModelComparisonOptions = {},
): ComparisonSnapshot {
  const nowMs = resolveDateInput(observationTime, Date.now());
  const observationDate = new Date(nowMs);
  const thresholds: ComparisonThresholds = {
    ...DEFAULT_COMPARISON_THRESHOLDS,
    ...(options.thresholds ?? {}),
  };
  const benchmarks: ComparisonBenchmarks = {
    declination: options.benchmarks?.declination?.length
      ? options.benchmarks.declination
      : DEFAULT_COMPARISON_BENCHMARKS.declination,
    dayLength: options.benchmarks?.dayLength?.length
      ? options.benchmarks.dayLength
      : DEFAULT_COMPARISON_BENCHMARKS.dayLength,
    rotation: options.benchmarks?.rotation?.length
      ? options.benchmarks.rotation
      : DEFAULT_COMPARISON_BENCHMARKS.rotation,
  };

  const routesMetric = buildRoutesMetric(
    options.routes ?? [],
    options.airportsByIcao ?? {},
    thresholds,
  );
  const eclipseMetric = buildEclipseMetric(
    options.solarEvents ?? [],
    options.lunarEvents ?? [],
    nowMs,
    thresholds,
  );
  const orbitMetric = buildOrbitMetric(benchmarks, thresholds);
  const rotationMetric = buildRotationMetric(benchmarks, thresholds);
  const metrics: ComparisonMetric[] = [routesMetric, eclipseMetric, orbitMetric, rotationMetric];

  return {
    timestampMs: nowMs,
    timestampIso: observationDate.toISOString(),
    thresholds,
    metrics,
    flatTotalScore: average(metrics.map((metric) => metric.flatScore)),
    sphericalTotalScore: average(metrics.map((metric) => metric.sphericalScore)),
  };
}
