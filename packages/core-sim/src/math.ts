const FULL_CIRCLE_DEGREES = 360;
const FULL_CIRCLE_RADIANS = Math.PI * 2;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function euclideanModulo(value: number, modulus: number): number {
  return ((value % modulus) + modulus) % modulus;
}

export function normalizeDegrees(angle: number): number {
  return angle - (FULL_CIRCLE_DEGREES * Math.floor((angle + 180) / FULL_CIRCLE_DEGREES));
}

export function projectedRadiusFromLatitude(latitudeDegrees: number, discRadius: number): number {
  return discRadius * ((90 - latitudeDegrees) / 180);
}

export function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

export function toDegrees(radians: number): number {
  return radians * (180 / Math.PI);
}

export function toPhase(angleRadians: number): number {
  return euclideanModulo(angleRadians, FULL_CIRCLE_RADIANS) / FULL_CIRCLE_RADIANS;
}

export function fromPhase(phase: number): number {
  return euclideanModulo(phase, 1) * FULL_CIRCLE_RADIANS;
}
