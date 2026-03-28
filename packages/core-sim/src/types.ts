export type TimeMode = "live" | "manual";
export type QualityLevel = "auto" | "high" | "medium" | "low";

export interface SimulationConfig {
  timeMode?: TimeMode;
  qualityLevel?: QualityLevel;
  gestureSensitivity?: number;
  observerLatitudeDegrees?: number;
  observerLongitudeDegrees?: number;
  manualObservationTime?: Date | number | string;
}

export interface CameraState {
  azimuthRadians: number;
  elevationRadians: number;
  radius: number;
}

export interface CameraGestureInput {
  type: "rotate" | "pinch" | "reset";
  deltaX?: number;
  deltaY?: number;
  scale?: number;
}

export interface CelestialBodySnapshot {
  latitudeDegrees: number;
  longitudeDegrees: number;
  altitudeFactor: number;
  orbitRadians: number;
  phaseProgress?: number;
}

export interface CelestialSnapshot {
  timestampMs: number;
  timestampIso: string;
  sun: CelestialBodySnapshot;
  moon: CelestialBodySnapshot;
  seasonalEclipticAngleRadians: number;
  solarAltitudeFactor: number;
}

export interface SimulationState {
  config: {
    timeMode: TimeMode;
    qualityLevel: QualityLevel;
    gestureSensitivity: number;
    observerLatitudeDegrees: number;
    observerLongitudeDegrees: number;
  };
  camera: CameraState;
  manualObservationTimeMs: number;
  currentObservationTimeMs: number;
  appActive: boolean;
  celestial: CelestialSnapshot;
}

export interface AdvanceContext {
  observationTime?: Date | number | string;
  appActive?: boolean;
  nowMs?: number;
}

export interface HudState {
  timeLabel: string;
  solarLatitudeLabel: string;
  systemLabel: string;
  timeMode: TimeMode;
  qualityLevel: QualityLevel;
}

export interface ComputeCelestialParams {
  observerLatitudeDegrees?: number;
  observerLongitudeDegrees?: number;
}
