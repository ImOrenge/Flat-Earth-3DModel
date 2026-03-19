import * as THREE from "../vendor/three.module.js";
import { scaleDimension, DOME_BASE_Y, DOME_RADIUS, DOME_VERTICAL_SCALE } from "./constants.js";

// Full 88-constellation asterism set derived from Stellarium's western sky culture.
const response = await fetch("./modules/constellation-data-flat-earth.json");
const constellationData = await response.json();

const POLARIS_RA_HOURS = 2.52975;
const POLARIS_DEC_DEG = 89.264109;
const POLARIS_TOLERANCE = 0.02;
const DOME_INSET = 0.985;
const OUTER_EASING_START = 0.70;
const OUTER_EASING_SPAN = 0.30;
const OUTER_EASING_AMOUNT = 0.06;

export const CONSTELLATION_STAR_SIZE = scaleDimension(0.16);
export const CONSTELLATION_STAR_COLOR = 0xffffff;
export const CONSTELLATION_LINE_COLOR = 0xffffff;
export const CONSTELLATION_LINE_OPACITY = 0.82;
export const GRID_LINE_COLOR = 0x90a5c4;
export const GRID_LINE_OPACITY = 0.14;

function createStarTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext("2d");

  const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.18, "rgba(244,247,255,0.96)");
  gradient.addColorStop(0.5, "rgba(220,232,255,0.34)");
  gradient.addColorStop(1, "rgba(220,232,255,0)");

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 32, 32);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function isPolaris(raHours, decDeg) {
  return (
    Math.abs(raHours - POLARIS_RA_HOURS) <= POLARIS_TOLERANCE &&
    Math.abs(decDeg - POLARIS_DEC_DEG) <= POLARIS_TOLERANCE
  );
}

function starKey(raHours, decDeg) {
  return `${raHours.toFixed(6)},${decDeg.toFixed(6)}`;
}

function warpDeclinationRadius(decDeg) {
  if (decDeg >= 0) {
    return 0.62 * (((90 - decDeg) / 90) ** 0.75);
  }
  return 0.62 + (0.38 * ((Math.abs(decDeg) / 90) ** 0.9));
}

function applyOuterShellEasing(radiusNorm) {
  if (radiusNorm <= OUTER_EASING_START) {
    return radiusNorm;
  }
  const t = (radiusNorm - OUTER_EASING_START) / OUTER_EASING_SPAN;
  const s = t * t * (3 - (2 * t));
  return radiusNorm - (OUTER_EASING_AMOUNT * s);
}

function projectToFlatEarthDome(raHours, decDeg) {
  const theta = (raHours / 24) * Math.PI * 2;
  const rawRadius = isPolaris(raHours, decDeg) ? 0 : warpDeclinationRadius(decDeg);
  const radiusNorm = THREE.MathUtils.clamp(applyOuterShellEasing(rawRadius), 0, 1);
  const planarRadius = DOME_RADIUS * DOME_INSET * radiusNorm;
  const domeRise = Math.sqrt(Math.max(0, (DOME_RADIUS * DOME_RADIUS) - (planarRadius * planarRadius)));

  return new THREE.Vector3(
    Math.sin(theta) * planarRadius,
    DOME_BASE_Y + (domeRise * DOME_INSET * DOME_VERTICAL_SCALE),
    -Math.cos(theta) * planarRadius
  );
}

function pseudoRandom01(seed) {
  const raw = Math.sin(seed * 12.9898) * 43758.5453123;
  return raw - Math.floor(raw);
}

function createGridGroup() {
  const gridGroup = new THREE.Group();
  const gridMaterial = new THREE.LineBasicMaterial({
    color: GRID_LINE_COLOR,
    transparent: true,
    opacity: GRID_LINE_OPACITY,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: false,
  });

  const ringDeclinations = [60, 30, 0, -30, -60];
  for (const dec of ringDeclinations) {
    const points = [];
    for (let i = 0; i <= 128; i += 1) {
      const ra = (i / 128) * 24;
      const point = projectToFlatEarthDome(ra, dec);
      points.push(point.x, point.y, point.z);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
    const ring = new THREE.Line(geometry, gridMaterial);
    ring.renderOrder = 21;
    gridGroup.add(ring);
  }

  const spokePositions = [];
  for (let hour = 0; hour < 24; hour += 2) {
    const outer = projectToFlatEarthDome(hour, -90);
    spokePositions.push(0, DOME_BASE_Y + (DOME_RADIUS * DOME_INSET * DOME_VERTICAL_SCALE), 0);
    spokePositions.push(outer.x, outer.y, outer.z);
  }
  const spokeGeometry = new THREE.BufferGeometry();
  spokeGeometry.setAttribute("position", new THREE.Float32BufferAttribute(spokePositions, 3));
  const spokes = new THREE.LineSegments(spokeGeometry, gridMaterial);
  spokes.renderOrder = 21;
  gridGroup.add(spokes);

  return gridGroup;
}

export function createConstellations() {
  const group = new THREE.Group();
  group.name = "flat-earth-dome-constellations";

  const starGeometry = new THREE.BufferGeometry();
  const starMaterial = new THREE.PointsMaterial({
    color: CONSTELLATION_STAR_COLOR,
    size: CONSTELLATION_STAR_SIZE,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.96,
    map: createStarTexture(),
    blending: THREE.AdditiveBlending,
    vertexColors: true,
    depthWrite: false,
    depthTest: false,
  });

  const lineMaterial = new THREE.LineBasicMaterial({
    color: CONSTELLATION_LINE_COLOR,
    transparent: true,
    opacity: CONSTELLATION_LINE_OPACITY,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: false,
  });

  const starPositions = [];
  const starColors = [];
  const seenStars = new Set();
  const linePositions = [];

  for (const constellation of constellationData) {
    for (const segment of constellation.segments) {
      const [[raA, decA], [raB, decB]] = segment;
      const start = projectToFlatEarthDome(raA, decA);
      const end = projectToFlatEarthDome(raB, decB);
      linePositions.push(start.x, start.y, start.z);
      linePositions.push(end.x, end.y, end.z);

      for (const [raHours, decDeg, point] of [
        [raA, decA, start],
        [raB, decB, end],
      ]) {
        const key = starKey(raHours, decDeg);
        if (seenStars.has(key)) {
          continue;
        }
        seenStars.add(key);
        starPositions.push(point.x, point.y, point.z);
        const brightness = 0.62 + (pseudoRandom01((raHours * 17.3) + (decDeg * 0.37)) * 0.34);
        starColors.push(brightness, brightness * 0.985, brightness * 0.96);
      }
    }
  }

  if (linePositions.length > 0) {
    const lineGeometry = new THREE.BufferGeometry();
    lineGeometry.setAttribute("position", new THREE.Float32BufferAttribute(linePositions, 3));
    const lines = new THREE.LineSegments(lineGeometry, lineMaterial);
    lines.renderOrder = 22;
    group.add(lines);
  }

  if (starPositions.length > 0) {
    starGeometry.setAttribute("position", new THREE.Float32BufferAttribute(starPositions, 3));
    starGeometry.setAttribute("color", new THREE.Float32BufferAttribute(starColors, 3));
    const stars = new THREE.Points(starGeometry, starMaterial);
    stars.renderOrder = 23;
    group.add(stars);
  }

  group.add(createGridGroup());
  console.log(`Flat-earth dome constellations: ${constellationData.length} constellations, ${starPositions.length / 3} stars.`);
  return group;
}
