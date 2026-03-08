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
