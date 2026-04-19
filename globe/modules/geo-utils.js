import * as THREE from "../../vendor/three.module.js";

const DEFAULT_CENTER = { x: 0, y: 0, z: 0 };
const DEFAULT_IDENTITY_QUATERNION = { x: 0, y: 0, z: 0, w: 1 };
const DEFAULT_MODEL_RADIUS = 1;

const tempVector = new THREE.Vector3();
const tempQuaternion = new THREE.Quaternion();
const tempInverseQuaternion = new THREE.Quaternion();
const tempWorldPosition = new THREE.Vector3();
const tempWorldScale = new THREE.Vector3();
const tempWorldQuaternion = new THREE.Quaternion();

export function projectedRadiusFromLatitude(latitudeDegrees, discRadius) {
  return discRadius * ((90 - latitudeDegrees) / 180);
}

export function latitudeFromProjectedRadius(radius, discRadius) {
  return 90 - ((radius / discRadius) * 180);
}

export function toRadians(degrees) {
  return degrees * (Math.PI / 180);
}

export function toDegrees(radians) {
  return radians * (180 / Math.PI);
}

export function normalizeDegrees(angle) {
  return angle - (360 * Math.floor((angle + 180) / 360));
}

function isFiniteNumber(value) {
  return Number.isFinite(value);
}

function toVector3Like(value, fallback = DEFAULT_CENTER) {
  if (!value || typeof value !== "object") {
    return fallback;
  }

  const x = isFiniteNumber(value.x) ? value.x : fallback.x;
  const y = isFiniteNumber(value.y) ? value.y : fallback.y;
  const z = isFiniteNumber(value.z) ? value.z : fallback.z;
  return { x, y, z };
}

function toQuaternionLike(value, fallback = DEFAULT_IDENTITY_QUATERNION) {
  if (!value || typeof value !== "object") {
    return fallback;
  }

  const x = isFiniteNumber(value.x) ? value.x : fallback.x;
  const y = isFiniteNumber(value.y) ? value.y : fallback.y;
  const z = isFiniteNumber(value.z) ? value.z : fallback.z;
  const w = isFiniteNumber(value.w) ? value.w : fallback.w;
  return { x, y, z, w };
}

function getMaxScaleComponent(scale) {
  return Math.max(
    Math.abs(scale?.x ?? 1),
    Math.abs(scale?.y ?? 1),
    Math.abs(scale?.z ?? 1),
    0.0001
  );
}

function getGeometryRadius(globeSurface) {
  const geometry = globeSurface?.geometry;
  if (!geometry) {
    return DEFAULT_MODEL_RADIUS;
  }

  if (isFiniteNumber(geometry?.parameters?.radius)) {
    return geometry.parameters.radius;
  }

  if (typeof geometry.computeBoundingSphere === "function") {
    geometry.computeBoundingSphere();
  }

  const radius = geometry?.boundingSphere?.radius;
  return isFiniteNumber(radius) ? radius : DEFAULT_MODEL_RADIUS;
}

function normalizeQuaternion(quaternionLike) {
  tempQuaternion
    .set(
      quaternionLike.x,
      quaternionLike.y,
      quaternionLike.z,
      quaternionLike.w
    )
    .normalize();

  return {
    x: tempQuaternion.x,
    y: tempQuaternion.y,
    z: tempQuaternion.z,
    w: tempQuaternion.w
  };
}

function invertQuaternion(quaternionLike) {
  tempInverseQuaternion
    .set(
      quaternionLike.x,
      quaternionLike.y,
      quaternionLike.z,
      quaternionLike.w
    )
    .invert()
    .normalize();

  return {
    x: tempInverseQuaternion.x,
    y: tempInverseQuaternion.y,
    z: tempInverseQuaternion.z,
    w: tempInverseQuaternion.w
  };
}

function isFrameObject(value) {
  return Boolean(
    value &&
    typeof value === "object" &&
    value.center &&
    value.rotation &&
    value.inverseRotation
  );
}

function resolveCenterAndFrame(centerOrFrame, frameOverride) {
  const explicitFrame = isFrameObject(frameOverride) ? frameOverride : null;
  const frame = explicitFrame ?? (isFrameObject(centerOrFrame) ? centerOrFrame : null);
  const centerCandidate = frame
    ? (isFiniteNumber(centerOrFrame?.x) ? centerOrFrame : frame.center)
    : centerOrFrame;
  return {
    center: toVector3Like(centerCandidate, DEFAULT_CENTER),
    frame
  };
}

function applyQuaternionToVector(vector, quaternionLike) {
  if (!quaternionLike) {
    return vector;
  }

  tempQuaternion.set(
    quaternionLike.x,
    quaternionLike.y,
    quaternionLike.z,
    quaternionLike.w
  );

  tempVector
    .set(vector.x, vector.y, vector.z)
    .applyQuaternion(tempQuaternion);

  return {
    x: tempVector.x,
    y: tempVector.y,
    z: tempVector.z
  };
}

function normalizeVector(vector, fallback = { x: 0, y: 1, z: 0 }) {
  tempVector.set(vector.x, vector.y, vector.z);
  if (tempVector.lengthSq() < 1e-12) {
    return { ...fallback };
  }
  tempVector.normalize();
  return {
    x: tempVector.x,
    y: tempVector.y,
    z: tempVector.z
  };
}

function getLocalNormalFromGeo(latitudeDegrees, longitudeDegrees) {
  const latitudeRadians = toRadians(latitudeDegrees);
  const longitudeRadians = toRadians(longitudeDegrees);
  const cosLatitude = Math.cos(latitudeRadians);

  // Match Three.js SphereGeometry UV convention (equirectangular texture on +X seam with east toward -Z).
  return {
    x: cosLatitude * Math.cos(longitudeRadians),
    y: Math.sin(latitudeRadians),
    z: -cosLatitude * Math.sin(longitudeRadians)
  };
}

function getLocalEastFromGeo(longitudeDegrees) {
  const longitudeRadians = toRadians(longitudeDegrees);
  return {
    x: -Math.sin(longitudeRadians),
    y: 0,
    z: -Math.cos(longitudeRadians)
  };
}

function getLocalNorthFromGeo(latitudeDegrees, longitudeDegrees) {
  const latitudeRadians = toRadians(latitudeDegrees);
  const longitudeRadians = toRadians(longitudeDegrees);
  const sinLatitude = Math.sin(latitudeRadians);
  const cosLatitude = Math.cos(latitudeRadians);
  return {
    x: -sinLatitude * Math.cos(longitudeRadians),
    y: cosLatitude,
    z: sinLatitude * Math.sin(longitudeRadians)
  };
}

export function createGlobeModelFrame(globeSurface, { space = "parent" } = {}) {
  const geometryRadius = getGeometryRadius(globeSurface);

  if (!globeSurface) {
    const rotation = { ...DEFAULT_IDENTITY_QUATERNION };
    return {
      center: { ...DEFAULT_CENTER },
      rotation,
      inverseRotation: invertQuaternion(rotation),
      radius: geometryRadius
    };
  }

  if (space === "self") {
    const rotation = { ...DEFAULT_IDENTITY_QUATERNION };
    return {
      center: { ...DEFAULT_CENTER },
      rotation,
      inverseRotation: invertQuaternion(rotation),
      radius: geometryRadius
    };
  }

  if (space === "world") {
    globeSurface.updateMatrixWorld?.(true);

    globeSurface.getWorldPosition?.(tempWorldPosition);
    globeSurface.getWorldQuaternion?.(tempWorldQuaternion);
    globeSurface.getWorldScale?.(tempWorldScale);

    const rotation = normalizeQuaternion(tempWorldQuaternion);
    return {
      center: {
        x: tempWorldPosition.x,
        y: tempWorldPosition.y,
        z: tempWorldPosition.z
      },
      rotation,
      inverseRotation: invertQuaternion(rotation),
      radius: geometryRadius * getMaxScaleComponent(tempWorldScale)
    };
  }

  const localScale = globeSurface.scale ?? { x: 1, y: 1, z: 1 };
  const localRotation = normalizeQuaternion(toQuaternionLike(globeSurface.quaternion, DEFAULT_IDENTITY_QUATERNION));
  return {
    center: toVector3Like(globeSurface.position, DEFAULT_CENTER),
    rotation: localRotation,
    inverseRotation: invertQuaternion(localRotation),
    radius: geometryRadius * getMaxScaleComponent(localScale)
  };
}

export function getGeoFromProjectedPosition(position, discRadius) {
  const projectedRadius = Math.hypot(position.x, position.z);
  return {
    latitudeDegrees: latitudeFromProjectedRadius(projectedRadius, discRadius),
    longitudeDegrees: normalizeDegrees(toDegrees(Math.atan2(position.z, -position.x)))
  };
}

export function getProjectedPositionFromGeo(latitudeDegrees, longitudeDegrees, discRadius, y = 0) {
  const projectedRadius = projectedRadiusFromLatitude(latitudeDegrees, discRadius);
  const longitudeRadians = toRadians(longitudeDegrees);
  return {
    x: -Math.cos(longitudeRadians) * projectedRadius,
    y,
    z: Math.sin(longitudeRadians) * projectedRadius
  };
}

export function getGlobeNormalFromGeo(latitudeDegrees, longitudeDegrees, frame = null) {
  const localNormal = getLocalNormalFromGeo(latitudeDegrees, longitudeDegrees);
  if (!isFrameObject(frame)) {
    return localNormal;
  }

  return normalizeVector(applyQuaternionToVector(localNormal, frame.rotation));
}

export function getGlobeEastVectorFromGeo(latitudeDegrees, longitudeDegrees, frame = null) {
  void latitudeDegrees;
  const localEast = getLocalEastFromGeo(longitudeDegrees);
  if (!isFrameObject(frame)) {
    return localEast;
  }
  return normalizeVector(applyQuaternionToVector(localEast, frame.rotation));
}

export function getGlobeNorthVectorFromGeo(latitudeDegrees, longitudeDegrees, frame = null) {
  const localNorth = getLocalNorthFromGeo(latitudeDegrees, longitudeDegrees);
  if (!isFrameObject(frame)) {
    return localNorth;
  }
  return normalizeVector(applyQuaternionToVector(localNorth, frame.rotation));
}

export function getGlobeBasisFromGeo(latitudeDegrees, longitudeDegrees, frame = null) {
  return {
    east: getGlobeEastVectorFromGeo(latitudeDegrees, longitudeDegrees, frame),
    north: getGlobeNorthVectorFromGeo(latitudeDegrees, longitudeDegrees, frame),
    up: getGlobeNormalFromGeo(latitudeDegrees, longitudeDegrees, frame)
  };
}

export function getGlobePositionFromNormal(
  normal,
  globeRadius,
  centerOrFrame = DEFAULT_CENTER,
  frameOverride = null
) {
  const { center, frame } = resolveCenterAndFrame(centerOrFrame, frameOverride);
  const radius = isFiniteNumber(globeRadius)
    ? Math.max(globeRadius, 0.0001)
    : Math.max(frame?.radius ?? DEFAULT_MODEL_RADIUS, 0.0001);
  const normalizedLocal = normalizeVector(normal, { x: 0, y: 1, z: 0 });
  const orientedNormal = frame
    ? normalizeVector(applyQuaternionToVector(normalizedLocal, frame.rotation))
    : normalizedLocal;

  return {
    x: center.x + (orientedNormal.x * radius),
    y: center.y + (orientedNormal.y * radius),
    z: center.z + (orientedNormal.z * radius)
  };
}

export function getGlobePositionFromGeo(
  latitudeDegrees,
  longitudeDegrees,
  globeRadius,
  centerOrFrame = DEFAULT_CENTER,
  frameOverride = null
) {
  const localNormal = getLocalNormalFromGeo(latitudeDegrees, longitudeDegrees);
  return getGlobePositionFromNormal(localNormal, globeRadius, centerOrFrame, frameOverride);
}

export function getGeoFromGlobePosition(
  position,
  globeCenterOrFrame = DEFAULT_CENTER,
  globeRadius = DEFAULT_MODEL_RADIUS,
  frameOverride = null
) {
  const { center, frame } = resolveCenterAndFrame(globeCenterOrFrame, frameOverride);
  const radius = isFiniteNumber(globeRadius)
    ? Math.max(globeRadius, 0.0001)
    : Math.max(frame?.radius ?? DEFAULT_MODEL_RADIUS, 0.0001);
  const offset = {
    x: (position.x - center.x) / radius,
    y: (position.y - center.y) / radius,
    z: (position.z - center.z) / radius
  };
  const localUnit = frame
    ? normalizeVector(applyQuaternionToVector(offset, frame.inverseRotation), { x: 1, y: 0, z: 0 })
    : normalizeVector(offset, { x: 1, y: 0, z: 0 });
  const clampedY = Math.min(1, Math.max(-1, localUnit.y));

  return {
    latitudeDegrees: toDegrees(Math.asin(clampedY)),
    longitudeDegrees: normalizeDegrees(toDegrees(Math.atan2(-localUnit.z, localUnit.x)))
  };
}

function formatDirection(value, positive, negative) {
  if (Math.abs(value) < 0.005) {
    return "";
  }
  return value >= 0 ? positive : negative;
}

function formatGeoCoordinate(value, positive, negative) {
  return `${Math.abs(value).toFixed(2)}deg${formatDirection(value, positive, negative)}`;
}

export function formatGeoPair(latitudeDegrees, longitudeDegrees) {
  return `${formatGeoCoordinate(latitudeDegrees, "N", "S")} / ${formatGeoCoordinate(longitudeDegrees, "E", "W")}`;
}

export function formatLatitude(latitude) {
  const absolute = Math.abs(latitude).toFixed(1);
  if (Math.abs(latitude) < 0.05) {
    return `${absolute}deg`;
  }
  return `${absolute}deg${latitude >= 0 ? "N" : "S"}`;
}

export function toDatetimeLocalValue(date) {
  const localDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60_000));
  return localDate.toISOString().slice(0, 16);
}
