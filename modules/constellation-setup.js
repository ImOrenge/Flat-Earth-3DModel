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
const SURFACE_PROJECTED_CONSTELLATIONS = new Set(["Octans"]);

const STAR_BASE_OPACITY = 0.96;
const LINE_BASE_OPACITY = 0.82;
const STAR_DIM_OPACITY = 0.28;
const LINE_DIM_OPACITY = 0.22;
const STAR_HIGHLIGHT_OPACITY = 1.0;
const LINE_HIGHLIGHT_OPACITY = 0.98;

export const CONSTELLATION_STAR_SIZE = scaleDimension(0.16);
export const CONSTELLATION_STAR_COLOR = 0xffffff;
export const CONSTELLATION_LINE_COLOR = 0xffffff;
export const CONSTELLATION_LINE_OPACITY = LINE_BASE_OPACITY;
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

function liftFootprintSegmentToDome(startPoint, endPoint) {
  const footprintLength = Math.hypot(endPoint.x - startPoint.x, endPoint.z - startPoint.z);
  const sampleCount = Math.max(6, Math.ceil(footprintLength / Math.max(DOME_RADIUS * 0.08, 1e-6)));
  const points = [];

  for (let index = 0; index <= sampleCount; index += 1) {
    if (index === 0) {
      points.push(startPoint.clone());
      continue;
    }
    if (index === sampleCount) {
      points.push(endPoint.clone());
      continue;
    }

    const t = index / sampleCount;
    const x = THREE.MathUtils.lerp(startPoint.x, endPoint.x, t);
    const z = THREE.MathUtils.lerp(startPoint.z, endPoint.z, t);
    const planarRadius = Math.hypot(x, z);
    const domeRise = Math.sqrt(Math.max(0, (DOME_RADIUS * DOME_RADIUS) - (planarRadius * planarRadius)));
    const y = DOME_BASE_Y + (domeRise * DOME_INSET * DOME_VERTICAL_SCALE);
    points.push(new THREE.Vector3(x, y, z));
  }

  return points;
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

function circularMeanHours(values) {
  if (!values.length) {
    return 0;
  }
  let sinSum = 0;
  let cosSum = 0;
  for (const value of values) {
    const angle = (value / 24) * Math.PI * 2;
    sinSum += Math.sin(angle);
    cosSum += Math.cos(angle);
  }
  const angle = THREE.MathUtils.euclideanModulo(Math.atan2(sinSum, cosSum), Math.PI * 2);
  return (angle / (Math.PI * 2)) * 24;
}

function toMapPoint(point) {
  const mapScale = DOME_RADIUS * DOME_INSET;
  return {
    x: point.x / mapScale,
    y: point.z / mapScale,
  };
}

function rotateWorldPoint(point, cosAngle, sinAngle) {
  return {
    x: (point.x * cosAngle) + (point.z * sinAngle),
    y: point.y,
    z: (point.z * cosAngle) - (point.x * sinAngle),
  };
}

function rotateMapPoint(point, cosAngle, sinAngle) {
  return {
    x: (point.x * cosAngle) + (point.y * sinAngle),
    y: (point.y * cosAngle) - (point.x * sinAngle),
  };
}

function cloneConstellationEntry(entry, cosAngle = 1, sinAngle = 0) {
  return {
    ...entry,
    centroidWorldPoint: rotateWorldPoint(entry.centroidWorldPoint, cosAngle, sinAngle),
    centroidMapPoint: rotateMapPoint(entry.centroidMapPoint, cosAngle, sinAngle),
    mapSegments: entry.mapSegments.map((segment) => (
      segment.map((point) => rotateMapPoint(point, cosAngle, sinAngle))
    )),
    mapStars: entry.mapStars.map((point) => ({
      ...rotateMapPoint(point, cosAngle, sinAngle),
      brightness: point.brightness,
    })),
  };
}

function createConstellationCatalogEntry(constellation, entryData) {
  const centroidRAHours = circularMeanHours(entryData.raSamples);
  const centroidDecDeg = entryData.decSamples.length > 0
    ? (entryData.decSamples.reduce((sum, value) => sum + value, 0) / entryData.decSamples.length)
    : 0;
  const centroidPoint = projectToFlatEarthDome(centroidRAHours, centroidDecDeg);
  const centroidMapPoint = toMapPoint(centroidPoint);

  return {
    name: constellation.name,
    code: constellation.code,
    segmentCount: constellation.segments.length,
    uniqueStarCount: entryData.starCount,
    centroidRAHours,
    centroidDecDeg,
    minDecDeg: entryData.minDecDeg,
    maxDecDeg: entryData.maxDecDeg,
    centroidWorldPoint: {
      x: centroidPoint.x,
      y: centroidPoint.y,
      z: centroidPoint.z,
    },
    centroidMapPoint,
    mapSegments: entryData.mapSegments,
    mapStars: entryData.mapStars,
  };
}

function createConstellationVisual({
  constellation,
  starTexture,
  lineMaterialOptions,
  starMaterialOptions,
  globalStarKeys,
}) {
  const group = new THREE.Group();
  const lineMaterial = new THREE.LineBasicMaterial(lineMaterialOptions);
  const starMaterial = new THREE.PointsMaterial({
    ...starMaterialOptions,
    map: starTexture,
  });

  const linePositions = [];
  const starPositions = [];
  const starColors = [];
  const lineObjects = [];
  const localStarKeys = new Set();
  const mapSegments = [];
  const mapStars = [];
  const raSamples = [];
  const decSamples = [];
  let minDecDeg = Infinity;
  let maxDecDeg = -Infinity;

  for (const segment of constellation.segments) {
    const [[raA, decA], [raB, decB]] = segment;
    const start = projectToFlatEarthDome(raA, decA);
    const end = projectToFlatEarthDome(raB, decB);

    if (SURFACE_PROJECTED_CONSTELLATIONS.has(constellation.name)) {
      const sampledPoints = liftFootprintSegmentToDome(start, end);
      const lineGeometry = new THREE.BufferGeometry().setFromPoints(sampledPoints);
      const line = new THREE.Line(lineGeometry, lineMaterial);
      line.renderOrder = 22;
      lineObjects.push(line);
      group.add(line);
      mapSegments.push(sampledPoints.map(toMapPoint));
    } else {
      linePositions.push(start.x, start.y, start.z);
      linePositions.push(end.x, end.y, end.z);
      mapSegments.push([toMapPoint(start), toMapPoint(end)]);
    }

    for (const [raHours, decDeg, point] of [
      [raA, decA, start],
      [raB, decB, end],
    ]) {
      const key = starKey(raHours, decDeg);
      globalStarKeys.add(key);
      if (localStarKeys.has(key)) {
        continue;
      }
      localStarKeys.add(key);
      minDecDeg = Math.min(minDecDeg, decDeg);
      maxDecDeg = Math.max(maxDecDeg, decDeg);
      raSamples.push(raHours);
      decSamples.push(decDeg);
      starPositions.push(point.x, point.y, point.z);
      const brightness = 0.62 + (pseudoRandom01((raHours * 17.3) + (decDeg * 0.37)) * 0.34);
      starColors.push(brightness, brightness * 0.985, brightness * 0.96);
      mapStars.push({
        ...toMapPoint(point),
        brightness,
      });
    }
  }

  if (linePositions.length > 0) {
    const lineGeometry = new THREE.BufferGeometry();
    lineGeometry.setAttribute("position", new THREE.Float32BufferAttribute(linePositions, 3));
    const lines = new THREE.LineSegments(lineGeometry, lineMaterial);
    lines.renderOrder = 22;
    lineObjects.push(lines);
    group.add(lines);
  }

  if (starPositions.length > 0) {
    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute("position", new THREE.Float32BufferAttribute(starPositions, 3));
    starGeometry.setAttribute("color", new THREE.Float32BufferAttribute(starColors, 3));
    const stars = new THREE.Points(starGeometry, starMaterial);
    stars.renderOrder = 23;
    group.add(stars);
  }

  return {
    name: constellation.name,
    code: constellation.code,
    group,
    lineObjects,
    lineMaterial,
    starMaterial,
    catalogEntry: createConstellationCatalogEntry(constellation, {
      decSamples,
      mapSegments,
      mapStars,
      maxDecDeg: Number.isFinite(maxDecDeg) ? maxDecDeg : 0,
      minDecDeg: Number.isFinite(minDecDeg) ? minDecDeg : 0,
      raSamples,
      starCount: localStarKeys.size,
    }),
  };
}

export function createConstellations() {
  const group = new THREE.Group();
  group.name = "flat-earth-dome-constellations";

  const starTexture = createStarTexture();
  const baseLineMaterialOptions = {
    color: CONSTELLATION_LINE_COLOR,
    transparent: true,
    opacity: LINE_BASE_OPACITY,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: false,
  };
  const baseStarMaterialOptions = {
    color: CONSTELLATION_STAR_COLOR,
    size: CONSTELLATION_STAR_SIZE,
    sizeAttenuation: true,
    transparent: true,
    opacity: STAR_BASE_OPACITY,
    blending: THREE.AdditiveBlending,
    vertexColors: true,
    depthWrite: false,
    depthTest: false,
  };

  const globalStarKeys = new Set();
  const constellationVisuals = [];
  const baseCatalog = [];
  for (const constellation of constellationData) {
    const visual = createConstellationVisual({
      constellation,
      globalStarKeys,
      lineMaterialOptions: baseLineMaterialOptions,
      starMaterialOptions: baseStarMaterialOptions,
      starTexture,
    });
    visual.group.renderOrder = 22;
    constellationVisuals.push(visual);
    baseCatalog.push(visual.catalogEntry);
    group.add(visual.group);
  }

  const gridGroup = createGridGroup();
  group.add(gridGroup);

  let highlightedConstellation = null;
  let areConstellationsVisible = true;
  let areConstellationLinesVisible = false;
  let seasonalPrecessionAngle = 0;
  let cosPrecessionAngle = 1;
  let sinPrecessionAngle = 0;
  const baseCatalogByName = new Map(baseCatalog.map((entry) => [entry.name, entry]));

  function applyHighlightState() {
    const hasSelection = typeof highlightedConstellation === "string" && highlightedConstellation.length > 0;
    for (const visual of constellationVisuals) {
      const isSelected = hasSelection && visual.name === highlightedConstellation;

      if (!hasSelection) {
        visual.lineMaterial.opacity = LINE_BASE_OPACITY;
        visual.starMaterial.opacity = STAR_BASE_OPACITY;
        continue;
      }

      visual.lineMaterial.opacity = isSelected ? LINE_HIGHLIGHT_OPACITY : LINE_DIM_OPACITY;
      visual.starMaterial.opacity = isSelected ? STAR_HIGHLIGHT_OPACITY : STAR_DIM_OPACITY;
    }
  }

  function applyLineVisibilityState() {
    gridGroup.visible = areConstellationLinesVisible;
    for (const visual of constellationVisuals) {
      for (const lineObject of visual.lineObjects) {
        lineObject.visible = areConstellationLinesVisible;
      }
    }
  }

  function setHighlightedConstellation(nameOrNull) {
    const nextName = typeof nameOrNull === "string" && nameOrNull.length > 0
      ? nameOrNull
      : null;
    highlightedConstellation = nextName;
    applyHighlightState();
  }

  function setConstellationsVisible(visible) {
    areConstellationsVisible = Boolean(visible);
    group.visible = areConstellationsVisible;
  }

  function setConstellationLinesVisible(visible) {
    areConstellationLinesVisible = Boolean(visible);
    applyLineVisibilityState();
  }

  function getConstellationLinesVisible() {
    return areConstellationLinesVisible;
  }

  function setSeasonalPrecessionAngle(angleRadians = 0) {
    if (!Number.isFinite(angleRadians)) {
      return;
    }

    seasonalPrecessionAngle = angleRadians;
    cosPrecessionAngle = Math.cos(seasonalPrecessionAngle);
    sinPrecessionAngle = Math.sin(seasonalPrecessionAngle);
    group.rotation.y = seasonalPrecessionAngle;
  }

  function getSeasonalPrecessionAngle() {
    return seasonalPrecessionAngle;
  }

  function getConstellationState(name) {
    if (!name) {
      return null;
    }

    const entry = baseCatalogByName.get(name);
    if (!entry) {
      return null;
    }

    return cloneConstellationEntry(entry, cosPrecessionAngle, sinPrecessionAngle);
  }

  function getConstellationCatalog() {
    return baseCatalog.map((entry) => cloneConstellationEntry(entry, cosPrecessionAngle, sinPrecessionAngle));
  }

  applyHighlightState();
  applyLineVisibilityState();
  setConstellationsVisible(true);
  setSeasonalPrecessionAngle(0);

  console.log(
    `Flat-earth dome constellations: ${constellationData.length} constellations, ${globalStarKeys.size} stars.`
  );

  return {
    group,
    getConstellationState,
    getConstellationLinesVisible,
    setConstellationsVisible,
    setConstellationLinesVisible,
    setSeasonalPrecessionAngle,
    setHighlightedConstellation,
    getConstellationCatalog,
    getSeasonalPrecessionAngle,
  };
}
