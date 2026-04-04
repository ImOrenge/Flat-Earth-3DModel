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

export function getGlobeNormalFromGeo(latitudeDegrees, longitudeDegrees) {
  const latitudeRadians = toRadians(latitudeDegrees);
  const longitudeRadians = toRadians(longitudeDegrees);
  const cosLatitude = Math.cos(latitudeRadians);

  return {
    x: cosLatitude * Math.cos(longitudeRadians),
    y: Math.sin(latitudeRadians),
    z: cosLatitude * Math.sin(longitudeRadians)
  };
}

export function getGlobeEastVectorFromGeo(latitudeDegrees, longitudeDegrees) {
  const longitudeRadians = toRadians(longitudeDegrees);
  return {
    x: -Math.sin(longitudeRadians),
    y: 0,
    z: Math.cos(longitudeRadians)
  };
}

export function getGlobeNorthVectorFromGeo(latitudeDegrees, longitudeDegrees) {
  const up = getGlobeNormalFromGeo(latitudeDegrees, longitudeDegrees);
  const east = getGlobeEastVectorFromGeo(latitudeDegrees, longitudeDegrees);

  return {
    x: (east.y * up.z) - (east.z * up.y),
    y: (east.z * up.x) - (east.x * up.z),
    z: (east.x * up.y) - (east.y * up.x)
  };
}

export function getGlobeBasisFromGeo(latitudeDegrees, longitudeDegrees) {
  return {
    east: getGlobeEastVectorFromGeo(latitudeDegrees, longitudeDegrees),
    north: getGlobeNorthVectorFromGeo(latitudeDegrees, longitudeDegrees),
    up: getGlobeNormalFromGeo(latitudeDegrees, longitudeDegrees)
  };
}

export function getGlobePositionFromGeo(latitudeDegrees, longitudeDegrees, globeRadius, center = { x: 0, y: 0, z: 0 }) {
  const normal = getGlobeNormalFromGeo(latitudeDegrees, longitudeDegrees);
  return {
    x: center.x + (normal.x * globeRadius),
    y: center.y + (normal.y * globeRadius),
    z: center.z + (normal.z * globeRadius)
  };
}

export function getGeoFromGlobePosition(position, globeCenter = { x: 0, y: 0, z: 0 }, globeRadius = 1) {
  const radius = Math.max(globeRadius, 0.0001);
  const normalizedX = (position.x - globeCenter.x) / radius;
  const normalizedY = (position.y - globeCenter.y) / radius;
  const normalizedZ = (position.z - globeCenter.z) / radius;
  const clampedY = Math.min(1, Math.max(-1, normalizedY));

  return {
    latitudeDegrees: toDegrees(Math.asin(clampedY)),
    longitudeDegrees: normalizeDegrees(toDegrees(Math.atan2(normalizedZ, normalizedX)))
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

