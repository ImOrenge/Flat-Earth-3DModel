import type { QualityLevel, TimeMode } from "./types";

export const DISC_RADIUS = 10;
export const SUN_ALTITUDE = 4.6;
export const MOON_ALTITUDE = 4.1;
export const CAMERA_RADIUS_MIN = 7;
export const CAMERA_RADIUS_MAX = 26;
export const CAMERA_ELEVATION_MIN = 0.2;
export const CAMERA_ELEVATION_MAX = 1.35;
export const CAMERA_DEFAULT_STATE = {
  azimuthRadians: -0.55,
  elevationRadians: 0.98,
  radius: 14
};

export const DEFAULT_SIMULATION_CONFIG: {
  timeMode: TimeMode;
  qualityLevel: QualityLevel;
  gestureSensitivity: number;
  observerLatitudeDegrees: number;
  observerLongitudeDegrees: number;
} = {
  timeMode: "live",
  qualityLevel: "auto",
  gestureSensitivity: 1,
  observerLatitudeDegrees: 37.5665,
  observerLongitudeDegrees: 126.978
};

export const SYNODIC_MONTH_DAYS = 29.530588853;
export const ZODIAC_AGE_REFERENCE_DATE_MS = Date.parse("2026-03-21T00:00:00Z");
export const ZODIAC_AGE_REFERENCE_OFFSET_DEGREES = 24.125;
export const ZODIAC_AGE_FULL_CYCLE_YEARS = 24720;
