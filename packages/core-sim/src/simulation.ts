import {
  CAMERA_DEFAULT_STATE,
  CAMERA_ELEVATION_MAX,
  CAMERA_ELEVATION_MIN,
  CAMERA_RADIUS_MAX,
  CAMERA_RADIUS_MIN,
  DEFAULT_SIMULATION_CONFIG,
  SYNODIC_MONTH_DAYS,
  ZODIAC_AGE_FULL_CYCLE_YEARS,
  ZODIAC_AGE_REFERENCE_DATE_MS,
  ZODIAC_AGE_REFERENCE_OFFSET_DEGREES
} from "./constants";
import { clamp, euclideanModulo, normalizeDegrees, toDegrees, toPhase, toRadians } from "./math";
import type {
  AdvanceContext,
  CameraGestureInput,
  ComputeCelestialParams,
  HudState,
  SimulationConfig,
  SimulationState
} from "./types";

const DAY_MS = 86_400_000;
const YEAR_MS = DAY_MS * 365.2422;
const FULL_CIRCLE_RADIANS = Math.PI * 2;
const MOON_EPOCH_MS = Date.UTC(2000, 0, 6, 18, 14, 0, 0);

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

function getSunDeclinationRadians(date: Date): number {
  const startOfYearUtcMs = Date.UTC(date.getUTCFullYear(), 0, 1, 0, 0, 0, 0);
  const dayFraction = (date.getTime() - startOfYearUtcMs) / DAY_MS;
  const gamma = (FULL_CIRCLE_RADIANS / 365) * (dayFraction - 1);
  return (
    0.006918 -
    (0.399912 * Math.cos(gamma)) +
    (0.070257 * Math.sin(gamma)) -
    (0.006758 * Math.cos(2 * gamma)) +
    (0.000907 * Math.sin(2 * gamma)) -
    (0.002697 * Math.cos(3 * gamma)) +
    (0.00148 * Math.sin(3 * gamma))
  );
}

function getSunLongitudeDegrees(date: Date): number {
  const utcHours = date.getUTCHours() + (date.getUTCMinutes() / 60) + (date.getUTCSeconds() / 3600);
  return normalizeDegrees((12 - utcHours) * 15);
}

function getSeasonalEclipticAngleRadians(date: Date): number {
  const year = date.getUTCFullYear();
  const anchorMs = Date.UTC(year, 2, 20, 0, 0, 0, 0);
  const phase = euclideanModulo((date.getTime() - anchorMs) / YEAR_MS, 1);
  return -phase * FULL_CIRCLE_RADIANS;
}

function getZodiacAgeOffsetRadians(date: Date): number {
  const elapsedMs = date.getTime() - ZODIAC_AGE_REFERENCE_DATE_MS;
  const offsetDegrees = ZODIAC_AGE_REFERENCE_OFFSET_DEGREES + (
    elapsedMs * ((360 / ZODIAC_AGE_FULL_CYCLE_YEARS) / (365.2422 * DAY_MS))
  );
  return euclideanModulo(toRadians(offsetDegrees), FULL_CIRCLE_RADIANS);
}

function computeMoonPhase(date: Date): number {
  const elapsedDays = (date.getTime() - MOON_EPOCH_MS) / DAY_MS;
  return euclideanModulo(elapsedDays / SYNODIC_MONTH_DAYS, 1);
}

function formatLatitude(latitudeDegrees: number): string {
  const absolute = Math.abs(latitudeDegrees).toFixed(1);
  if (Math.abs(latitudeDegrees) < 0.05) {
    return `${absolute}deg`;
  }
  return `${absolute}deg${latitudeDegrees >= 0 ? "N" : "S"}`;
}

export function computeCelestialPositions(
  time: Date | number | string,
  params: ComputeCelestialParams = {}
) {
  const timestampMs = resolveDateInput(time, Date.now());
  const date = new Date(timestampMs);
  const observerLatitudeDegrees = params.observerLatitudeDegrees ?? DEFAULT_SIMULATION_CONFIG.observerLatitudeDegrees;
  const observerLongitudeDegrees = params.observerLongitudeDegrees ?? DEFAULT_SIMULATION_CONFIG.observerLongitudeDegrees;

  const sunDeclinationRadians = getSunDeclinationRadians(date);
  const sunLatitudeDegrees = clamp(toDegrees(sunDeclinationRadians), -23.44, 23.44);
  const sunLongitudeDegrees = getSunLongitudeDegrees(date);

  const moonPhase = computeMoonPhase(date);
  const moonOrbitRadians = moonPhase * FULL_CIRCLE_RADIANS;
  const moonLongitudeDegrees = normalizeDegrees(sunLongitudeDegrees + (moonPhase * 360));
  const moonLatitudeDegrees = 5.14 * Math.sin(moonOrbitRadians + 0.62);

  const solarAltitudeFactor =
    (Math.sin(toRadians(observerLatitudeDegrees)) * Math.sin(toRadians(sunLatitudeDegrees))) +
    (
      Math.cos(toRadians(observerLatitudeDegrees)) *
      Math.cos(toRadians(sunLatitudeDegrees)) *
      Math.cos(toRadians(observerLongitudeDegrees - sunLongitudeDegrees))
    );

  return {
    timestampMs,
    timestampIso: date.toISOString(),
    sun: {
      latitudeDegrees: sunLatitudeDegrees,
      longitudeDegrees: sunLongitudeDegrees,
      altitudeFactor: 1,
      orbitRadians: toRadians(sunLongitudeDegrees)
    },
    moon: {
      latitudeDegrees: moonLatitudeDegrees,
      longitudeDegrees: moonLongitudeDegrees,
      altitudeFactor: 1,
      orbitRadians: toRadians(moonLongitudeDegrees),
      phaseProgress: toPhase(moonOrbitRadians)
    },
    seasonalEclipticAngleRadians: getSeasonalEclipticAngleRadians(date),
    zodiacAgeOffsetRadians: getZodiacAgeOffsetRadians(date),
    solarAltitudeFactor: clamp(solarAltitudeFactor, -1, 1)
  };
}

export function createSimulationState(config: SimulationConfig = {}): SimulationState {
  const nowMs = Date.now();
  const manualObservationTimeMs = resolveDateInput(config.manualObservationTime, nowMs);
  const merged = {
    ...DEFAULT_SIMULATION_CONFIG,
    ...config
  };
  const currentObservationTimeMs = merged.timeMode === "live" ? nowMs : manualObservationTimeMs;
  const celestial = computeCelestialPositions(currentObservationTimeMs, {
    observerLatitudeDegrees: merged.observerLatitudeDegrees,
    observerLongitudeDegrees: merged.observerLongitudeDegrees
  });

  return {
    config: {
      timeMode: merged.timeMode,
      qualityLevel: merged.qualityLevel,
      gestureSensitivity: clamp(merged.gestureSensitivity, 0.25, 2.5),
      observerLatitudeDegrees: merged.observerLatitudeDegrees,
      observerLongitudeDegrees: merged.observerLongitudeDegrees
    },
    camera: {
      ...CAMERA_DEFAULT_STATE
    },
    manualObservationTimeMs,
    currentObservationTimeMs,
    appActive: true,
    celestial
  };
}

export function applyCameraGesture(state: SimulationState, input: CameraGestureInput): SimulationState {
  const next = {
    ...state,
    camera: {
      ...state.camera
    }
  };
  const sensitivity = next.config.gestureSensitivity;

  if (input.type === "reset") {
    next.camera = { ...CAMERA_DEFAULT_STATE };
    return next;
  }

  if (input.type === "rotate") {
    const deltaX = input.deltaX ?? 0;
    const deltaY = input.deltaY ?? 0;
    next.camera.azimuthRadians -= deltaX * 0.004 * sensitivity;
    next.camera.elevationRadians = clamp(
      next.camera.elevationRadians + (deltaY * 0.004 * sensitivity),
      CAMERA_ELEVATION_MIN,
      CAMERA_ELEVATION_MAX
    );
    return next;
  }

  if (input.type === "pinch") {
    const scale = input.scale ?? 1;
    next.camera.radius = clamp(next.camera.radius / Math.max(scale, 0.001), CAMERA_RADIUS_MIN, CAMERA_RADIUS_MAX);
    return next;
  }

  return next;
}

export function advanceSimulation(state: SimulationState, dtSeconds: number, context: AdvanceContext = {}): SimulationState {
  const nowMs = context.nowMs ?? Date.now();
  const appActive = context.appActive ?? state.appActive;
  const next = {
    ...state,
    appActive
  };

  if (context.observationTime !== undefined) {
    next.manualObservationTimeMs = resolveDateInput(context.observationTime, next.manualObservationTimeMs);
    next.config = {
      ...next.config,
      timeMode: "manual"
    };
  }

  if (next.config.timeMode === "live") {
    next.currentObservationTimeMs = nowMs;
  } else if (appActive) {
    const stepMs = Math.max(0, dtSeconds) * 1000;
    next.currentObservationTimeMs = next.manualObservationTimeMs + stepMs;
    next.manualObservationTimeMs = next.currentObservationTimeMs;
  }

  next.celestial = computeCelestialPositions(next.currentObservationTimeMs, {
    observerLatitudeDegrees: next.config.observerLatitudeDegrees,
    observerLongitudeDegrees: next.config.observerLongitudeDegrees
  });
  return next;
}

export function getHudState(state: SimulationState): HudState {
  const observation = new Date(state.currentObservationTimeMs);
  return {
    timeLabel: observation.toISOString().replace("T", " ").slice(0, 16),
    solarLatitudeLabel: formatLatitude(state.celestial.sun.latitudeDegrees),
    systemLabel: state.appActive ? "Simulation running" : "Paused in background",
    timeMode: state.config.timeMode,
    qualityLevel: state.config.qualityLevel
  };
}
