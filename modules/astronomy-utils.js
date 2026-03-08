import * as THREE from "../vendor/three.module.js";
import {
  normalizeDegrees,
  projectedRadiusFromLatitude,
  toDegrees,
  toRadians
} from "./geo-utils.js";

const DAY_MS = 86_400_000;
const J2000 = 2451545;

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

export function getSunSubpoint(date) {
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

  return getSubpointFromEquatorial(rightAscension, declination, daysSinceJ2000);
}

export function getMoonSubpoint(date) {
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

  return getSubpointFromEquatorial(rightAscension, declination, daysSinceJ2000);
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

export function getAstronomySnapshot({
  date,
  discRadius,
  domeRadius,
  getSunOrbitHeight,
  getMoonBaseHeight
}) {
  const sun = getSunSubpoint(date);
  const moon = getMoonSubpoint(date);

  return {
    date,
    sun,
    moon,
    sunPosition: getBodyPositionFromGeo({
      latitudeDegrees: sun.latitudeDegrees,
      longitudeDegrees: sun.longitudeDegrees,
      getHeight: getSunOrbitHeight,
      discRadius,
      domeRadius
    }),
    moonPosition: getBodyPositionFromGeo({
      latitudeDegrees: moon.latitudeDegrees,
      longitudeDegrees: moon.longitudeDegrees,
      getHeight: getMoonBaseHeight,
      discRadius,
      domeRadius
    })
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
