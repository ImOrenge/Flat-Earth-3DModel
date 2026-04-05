import * as THREE from "../../vendor/three.module.js";
import {
  RIM_OUTER_RADIUS,
  RIM_TOP_Y,
  scaleDimension
} from "./constants.js";

const SEGMENT_COUNT = 12;
const FULL_CIRCLE_RADIANS = Math.PI * 2;
const SEGMENT_ARC = FULL_CIRCLE_RADIANS / SEGMENT_COUNT;
const SECTOR_START_OFFSET = Math.PI;
const SECTOR_GAP_RADIANS = SEGMENT_ARC * 0.015;

const WHEEL_INNER_RADIUS = RIM_OUTER_RADIUS + scaleDimension(0.18);
const WHEEL_OUTER_RADIUS = WHEEL_INNER_RADIUS + scaleDimension(0.74);
const WHEEL_MID_RADIUS = (WHEEL_INNER_RADIUS + WHEEL_OUTER_RADIUS) / 2;
const WHEEL_ELEVATION = RIM_TOP_Y + scaleDimension(0.028);

const LABEL_RADIUS = WHEEL_MID_RADIUS;
const LABEL_ELEVATION = scaleDimension(0.038);
const LABEL_WIDTH = scaleDimension(1.08);
const LABEL_HEIGHT = scaleDimension(0.62);

const MONTH_RING_INNER_RADIUS = WHEEL_OUTER_RADIUS + scaleDimension(0.12);
const MONTH_RING_OUTER_RADIUS = MONTH_RING_INNER_RADIUS + scaleDimension(0.44);
const MONTH_LABEL_RADIUS = (MONTH_RING_INNER_RADIUS + MONTH_RING_OUTER_RADIUS) / 2;
const MONTH_LABEL_ELEVATION = scaleDimension(0.042);
const MONTH_LABEL_WIDTH = scaleDimension(0.68);
const MONTH_LABEL_HEIGHT = scaleDimension(0.29);

const AGE_MARKER_LINE_INNER_RADIUS = MONTH_RING_INNER_RADIUS - scaleDimension(0.02);
const AGE_MARKER_LINE_OUTER_RADIUS = MONTH_RING_OUTER_RADIUS + scaleDimension(0.08);
const AGE_MARKER_DOT_RADIUS = scaleDimension(0.056);
const AGE_LABEL_RADIUS = MONTH_RING_OUTER_RADIUS + scaleDimension(0.34);
const AGE_LABEL_ELEVATION = scaleDimension(0.046);
const AGE_LABEL_WIDTH = scaleDimension(0.94);
const AGE_LABEL_HEIGHT = scaleDimension(0.30);

export const ZODIAC_SIGNS = [
  { glyph: "\u2648", key: "aries", nameKey: "zodiacAries", color: 0xff9a6a },
  { glyph: "\u2649", key: "taurus", nameKey: "zodiacTaurus", color: 0xf3c96e },
  { glyph: "\u264A", key: "gemini", nameKey: "zodiacGemini", color: 0xf3ea85 },
  { glyph: "\u264B", key: "cancer", nameKey: "zodiacCancer", color: 0x8fd6ff },
  { glyph: "\u264C", key: "leo", nameKey: "zodiacLeo", color: 0xffbe63 },
  { glyph: "\u264D", key: "virgo", nameKey: "zodiacVirgo", color: 0x9fd49b },
  { glyph: "\u264E", key: "libra", nameKey: "zodiacLibra", color: 0xa9beff },
  { glyph: "\u264F", key: "scorpio", nameKey: "zodiacScorpio", color: 0xcf87ff },
  { glyph: "\u2650", key: "sagittarius", nameKey: "zodiacSagittarius", color: 0xffa767 },
  { glyph: "\u2651", key: "capricorn", nameKey: "zodiacCapricorn", color: 0xb4d1f7 },
  { glyph: "\u2652", key: "aquarius", nameKey: "zodiacAquarius", color: 0x7de1ef },
  { glyph: "\u2653", key: "pisces", nameKey: "zodiacPisces", color: 0x79d3bb }
];

export const CALENDAR_MONTH_SEQUENCE = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 0, 1];

function colorToRgbaString(colorValue, alpha) {
  const color = new THREE.Color(colorValue);
  const red = Math.round(color.r * 255);
  const green = Math.round(color.g * 255);
  const blue = Math.round(color.b * 255);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function drawRoundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function getWheelPoint(radius, angleRadians) {
  const theta = angleRadians + SECTOR_START_OFFSET;
  return new THREE.Vector3(
    Math.cos(theta) * radius,
    0,
    -Math.sin(theta) * radius
  );
}

function getCardRotation(angleRadians) {
  let rotation = angleRadians - (Math.PI / 2);
  const normalized = THREE.MathUtils.euclideanModulo(rotation + Math.PI, FULL_CIRCLE_RADIANS) - Math.PI;
  if (normalized > (Math.PI / 2) || normalized < (-Math.PI / 2)) {
    rotation += Math.PI;
  }
  return rotation;
}

function createCircleLine(radius, material) {
  const positions = [];
  const stepCount = 256;

  for (let index = 0; index < stepCount; index += 1) {
    const point = getWheelPoint(radius, (index / stepCount) * FULL_CIRCLE_RADIANS);
    positions.push(point.x, point.y, point.z);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  return new THREE.LineLoop(geometry, material);
}

function createRadialLineGroup({ angles, innerRadius, outerRadius, material }) {
  const positions = [];

  for (const angle of angles) {
    const innerPoint = getWheelPoint(innerRadius, angle);
    const outerPoint = getWheelPoint(outerRadius, angle);
    positions.push(
      innerPoint.x, innerPoint.y, innerPoint.z,
      outerPoint.x, outerPoint.y, outerPoint.z
    );
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  return new THREE.LineSegments(geometry, material);
}

function createCanvasLabel({
  planeWidth,
  planeHeight,
  radius,
  angleRadians,
  elevation,
  textureWidth,
  textureHeight,
  renderOrder
}) {
  const canvas = document.createElement("canvas");
  canvas.width = textureWidth;
  canvas.height = textureHeight;
  const ctx = canvas.getContext("2d");
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;

  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    side: THREE.DoubleSide,
    toneMapped: false
  });

  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(planeWidth, planeHeight),
    material
  );
  const point = getWheelPoint(radius, angleRadians);
  mesh.position.set(point.x, elevation, point.z);
  mesh.rotation.set(-Math.PI / 2, 0, getCardRotation(angleRadians));
  mesh.renderOrder = renderOrder;

  return {
    canvas,
    ctx,
    mesh,
    texture
  };
}

function getLabelFontFamily(i18n) {
  return i18n.getLanguage() === "ko"
    ? '"Malgun Gothic", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif'
    : '"Segoe UI", "Noto Sans", sans-serif';
}

function getMonthLabel(monthIndex, i18n) {
  return i18n.formatDate(
    new Date(Date.UTC(2026, monthIndex, 1)),
    { month: i18n.getLanguage() === "ko" ? "long" : "short", timeZone: "UTC" }
  );
}

export function getAgeSignIndexFromAgeOffset(ageOffsetRadians) {
  const normalized = THREE.MathUtils.euclideanModulo(-ageOffsetRadians, FULL_CIRCLE_RADIANS);
  return Math.floor(normalized / SEGMENT_ARC) % SEGMENT_COUNT;
}

export function getAgeSignIndexFromSiderealOffset(siderealOffsetRadians) {
  // Deprecated alias for compatibility.
  return getAgeSignIndexFromAgeOffset(siderealOffsetRadians);
}

function drawLabelTexture({ canvas, ctx, sign, i18n }) {
  const { width, height } = canvas;
  ctx.clearRect(0, 0, width, height);

  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, colorToRgbaString(sign.color, 0.48));
  gradient.addColorStop(0.35, "rgba(7, 12, 24, 0.96)");
  gradient.addColorStop(1, colorToRgbaString(sign.color, 0.32));

  drawRoundedRect(ctx, 10, 10, width - 20, height - 20, 30);
  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = colorToRgbaString(sign.color, 0.96);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(30, 96);
  ctx.lineTo(width - 30, 96);
  ctx.strokeStyle = colorToRgbaString(sign.color, 0.42);
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(247, 251, 255, 0.99)";
  ctx.shadowColor = colorToRgbaString(sign.color, 0.95);
  ctx.shadowBlur = 28;
  ctx.lineJoin = "round";
  ctx.miterLimit = 2;
  ctx.font = '700 108px "Segoe UI Symbol", "Noto Sans Symbols 2", "Segoe UI", sans-serif';
  ctx.strokeStyle = "rgba(7, 12, 24, 0.92)";
  ctx.lineWidth = 10;
  ctx.strokeText(sign.glyph, width / 2, 62);
  ctx.fillText(sign.glyph, width / 2, 62);

  ctx.shadowBlur = 8;
  ctx.font = `700 40px ${getLabelFontFamily(i18n)}`;
  ctx.strokeStyle = "rgba(6, 10, 20, 0.82)";
  ctx.lineWidth = 6;
  ctx.strokeText(i18n.t(sign.nameKey), width / 2, 150);
  ctx.fillText(i18n.t(sign.nameKey), width / 2, 150);
  ctx.shadowBlur = 0;
}

function drawMonthTexture({ canvas, ctx, color, i18n, monthIndex }) {
  const { width, height } = canvas;
  ctx.clearRect(0, 0, width, height);

  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, colorToRgbaString(color, 0.34));
  gradient.addColorStop(0.45, "rgba(8, 14, 28, 0.92)");
  gradient.addColorStop(1, "rgba(10, 18, 32, 0.82)");

  drawRoundedRect(ctx, 8, 8, width - 16, height - 16, 22);
  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.strokeStyle = colorToRgbaString(color, 0.78);
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.fillStyle = "rgba(246, 251, 255, 0.98)";
  ctx.shadowColor = colorToRgbaString(color, 0.84);
  ctx.shadowBlur = 12;
  ctx.strokeStyle = "rgba(6, 10, 20, 0.9)";
  ctx.lineWidth = 5;
  ctx.font = `700 ${i18n.getLanguage() === "ko" ? 54 : 50}px ${getLabelFontFamily(i18n)}`;
  const label = getMonthLabel(monthIndex, i18n);
  ctx.strokeText(label, width / 2, height / 2);
  ctx.fillText(label, width / 2, height / 2);
  ctx.shadowBlur = 0;
}

function drawAgeTexture({ canvas, ctx, sign, i18n }) {
  const { width, height } = canvas;
  ctx.clearRect(0, 0, width, height);

  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, colorToRgbaString(sign.color, 0.54));
  gradient.addColorStop(0.42, "rgba(8, 13, 26, 0.96)");
  gradient.addColorStop(1, colorToRgbaString(sign.color, 0.22));

  drawRoundedRect(ctx, 8, 8, width - 16, height - 16, 24);
  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.strokeStyle = colorToRgbaString(sign.color, 0.94);
  ctx.lineWidth = 4;
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.lineJoin = "round";
  ctx.fillStyle = "rgba(247, 251, 255, 0.99)";

  ctx.font = `700 24px ${getLabelFontFamily(i18n)}`;
  ctx.textBaseline = "middle";
  ctx.shadowColor = colorToRgbaString(sign.color, 0.86);
  ctx.shadowBlur = 8;
  ctx.strokeStyle = "rgba(6, 10, 20, 0.84)";
  ctx.lineWidth = 5;
  ctx.strokeText(i18n.t("zodiacAgeMarkerTitle"), width / 2, 42);
  ctx.fillText(i18n.t("zodiacAgeMarkerTitle"), width / 2, 42);

  ctx.font = `700 ${i18n.getLanguage() === "ko" ? 44 : 42}px ${getLabelFontFamily(i18n)}`;
  const label = `${sign.glyph} ${i18n.t(sign.nameKey)}`;
  ctx.strokeText(label, width / 2, 96);
  ctx.fillText(label, width / 2, 96);
  ctx.shadowBlur = 0;
}

export function createZodiacWheel({ i18n }) {
  const group = new THREE.Group();
  group.name = "zodiac-wheel";
  group.position.y = WHEEL_ELEVATION;

  const tropicalLayer = new THREE.Group();
  tropicalLayer.name = "zodiac-wheel-tropical-layer";
  const ageLayer = new THREE.Group();
  ageLayer.name = "zodiac-wheel-age-layer";
  group.add(tropicalLayer);
  group.add(ageLayer);

  let visible = true;
  let suppressed = false;
  let ageOffset = 0;
  let seasonalAngle = 0;

  const sectorMaterialOptions = {
    transparent: true,
    opacity: 0.16,
    side: THREE.DoubleSide,
    depthWrite: false
  };

  for (let index = 0; index < SEGMENT_COUNT; index += 1) {
    const sign = ZODIAC_SIGNS[index];
    const sector = new THREE.Mesh(
      new THREE.RingGeometry(
        WHEEL_INNER_RADIUS,
        WHEEL_OUTER_RADIUS,
        32,
        1,
        SECTOR_START_OFFSET + (index * SEGMENT_ARC) + SECTOR_GAP_RADIANS,
        SEGMENT_ARC - (SECTOR_GAP_RADIANS * 2)
      ),
      new THREE.MeshBasicMaterial({
        ...sectorMaterialOptions,
        color: sign.color
      })
    );
    sector.rotation.x = -Math.PI / 2;
    sector.renderOrder = 9;
    ageLayer.add(sector);
  }

  const ringMaterial = new THREE.LineBasicMaterial({
    color: 0xf2f6ff,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    depthTest: false
  });
  const spokeMaterial = new THREE.LineBasicMaterial({
    color: 0xd8e6ff,
    transparent: true,
    opacity: 0.38,
    depthWrite: false,
    depthTest: false
  });
  const guideMaterial = new THREE.LineBasicMaterial({
    color: 0xb9d7ff,
    transparent: true,
    opacity: 0.18,
    depthWrite: false,
    depthTest: false
  });
  const monthRingMaterial = new THREE.LineBasicMaterial({
    color: 0xcfe2ff,
    transparent: true,
    opacity: 0.3,
    depthWrite: false,
    depthTest: false
  });
  const monthTickMaterial = new THREE.LineBasicMaterial({
    color: 0xe2efff,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
    depthTest: false
  });

  const innerLoop = createCircleLine(WHEEL_INNER_RADIUS, ringMaterial);
  innerLoop.renderOrder = 11;
  ageLayer.add(innerLoop);

  const outerLoop = createCircleLine(WHEEL_OUTER_RADIUS, ringMaterial);
  outerLoop.renderOrder = 11;
  ageLayer.add(outerLoop);

  const boundaryAngles = [];
  const guideAngles = [];
  for (let index = 0; index < SEGMENT_COUNT; index += 1) {
    boundaryAngles.push(index * SEGMENT_ARC);
    guideAngles.push((index * SEGMENT_ARC) + (SEGMENT_ARC / 2));
  }

  const boundaryLines = createRadialLineGroup({
    angles: boundaryAngles,
    innerRadius: WHEEL_INNER_RADIUS,
    outerRadius: WHEEL_OUTER_RADIUS,
    material: spokeMaterial
  });
  boundaryLines.renderOrder = 11;
  ageLayer.add(boundaryLines);

  const centerGuides = createRadialLineGroup({
    angles: guideAngles,
    innerRadius: WHEEL_INNER_RADIUS + scaleDimension(0.08),
    outerRadius: WHEEL_OUTER_RADIUS - scaleDimension(0.08),
    material: guideMaterial
  });
  centerGuides.renderOrder = 10;
  ageLayer.add(centerGuides);

  const monthInnerLoop = createCircleLine(MONTH_RING_INNER_RADIUS, monthRingMaterial);
  monthInnerLoop.renderOrder = 11;
  tropicalLayer.add(monthInnerLoop);

  const monthOuterLoop = createCircleLine(MONTH_RING_OUTER_RADIUS, monthRingMaterial);
  monthOuterLoop.renderOrder = 11;
  tropicalLayer.add(monthOuterLoop);

  const monthTicks = createRadialLineGroup({
    angles: boundaryAngles,
    innerRadius: WHEEL_OUTER_RADIUS + scaleDimension(0.02),
    outerRadius: MONTH_RING_INNER_RADIUS + scaleDimension(0.04),
    material: monthTickMaterial
  });
  monthTicks.renderOrder = 11;
  tropicalLayer.add(monthTicks);

  const labelEntries = ZODIAC_SIGNS.map((sign, index) => {
    const centerAngle = (index * SEGMENT_ARC) + (SEGMENT_ARC / 2);
    const entry = createCanvasLabel({
      angleRadians: centerAngle,
      elevation: LABEL_ELEVATION,
      planeHeight: LABEL_HEIGHT,
      planeWidth: LABEL_WIDTH,
      radius: LABEL_RADIUS,
      renderOrder: 13,
      textureHeight: 320,
      textureWidth: 512
    });
    ageLayer.add(entry.mesh);

    return {
      ...entry,
      sign
    };
  });

  const monthEntries = CALENDAR_MONTH_SEQUENCE.map((monthIndex, index) => {
    const entry = createCanvasLabel({
      angleRadians: (index * SEGMENT_ARC) + (SEGMENT_ARC / 2),
      elevation: MONTH_LABEL_ELEVATION,
      planeHeight: MONTH_LABEL_HEIGHT,
      planeWidth: MONTH_LABEL_WIDTH,
      radius: MONTH_LABEL_RADIUS,
      renderOrder: 12,
      textureHeight: 144,
      textureWidth: 320
    });
    tropicalLayer.add(entry.mesh);

    return {
      ...entry,
      color: ZODIAC_SIGNS[index].color,
      monthIndex
    };
  });

  const ageLineMaterial = new THREE.LineBasicMaterial({
    color: ZODIAC_SIGNS[0].color,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    depthTest: false
  });
  const ageLine = createRadialLineGroup({
    angles: [0],
    innerRadius: AGE_MARKER_LINE_INNER_RADIUS,
    outerRadius: AGE_MARKER_LINE_OUTER_RADIUS,
    material: ageLineMaterial
  });
  ageLine.renderOrder = 12;
  tropicalLayer.add(ageLine);

  const ageDotPoint = getWheelPoint(AGE_MARKER_LINE_OUTER_RADIUS, 0);
  const ageDot = new THREE.Mesh(
    new THREE.CircleGeometry(AGE_MARKER_DOT_RADIUS, 24),
    new THREE.MeshBasicMaterial({
      color: ZODIAC_SIGNS[0].color,
      transparent: true,
      opacity: 0.96,
      depthWrite: false,
      depthTest: false
    })
  );
  ageDot.position.set(ageDotPoint.x, AGE_LABEL_ELEVATION, ageDotPoint.z);
  ageDot.rotation.x = -Math.PI / 2;
  ageDot.renderOrder = 13;
  tropicalLayer.add(ageDot);

  const ageLabelEntry = createCanvasLabel({
    angleRadians: 0,
    elevation: AGE_LABEL_ELEVATION,
    planeHeight: AGE_LABEL_HEIGHT,
    planeWidth: AGE_LABEL_WIDTH,
    radius: AGE_LABEL_RADIUS,
    renderOrder: 14,
    textureHeight: 144,
    textureWidth: 416
  });
  tropicalLayer.add(ageLabelEntry.mesh);

  function syncVisibility() {
    group.visible = visible && !suppressed;
  }

  function refreshLocalizedUi() {
    for (const entry of labelEntries) {
      drawLabelTexture({
        canvas: entry.canvas,
        ctx: entry.ctx,
        i18n,
        sign: entry.sign
      });
      entry.texture.needsUpdate = true;
    }

    for (const entry of monthEntries) {
      drawMonthTexture({
        canvas: entry.canvas,
        ctx: entry.ctx,
        color: entry.color,
        i18n,
        monthIndex: entry.monthIndex
      });
      entry.texture.needsUpdate = true;
    }

    syncAgeMarker();
  }

  function syncAgeMarker() {
    const ageSign = ZODIAC_SIGNS[getAgeSignIndexFromAgeOffset(ageOffset)];
    ageLineMaterial.color.setHex(ageSign.color);
    ageDot.material.color.setHex(ageSign.color);
    drawAgeTexture({
      canvas: ageLabelEntry.canvas,
      ctx: ageLabelEntry.ctx,
      i18n,
      sign: ageSign
    });
    ageLabelEntry.texture.needsUpdate = true;
  }

  refreshLocalizedUi();
  syncVisibility();

  return {
    getVisible() {
      return visible;
    },
    group,
    getAgeSignIndex() {
      return getAgeSignIndexFromAgeOffset(ageOffset);
    },
    getSeasonalAngle() {
      return seasonalAngle;
    },
    getAgeOffset() {
      return ageOffset;
    },
    getSiderealOffset() {
      // Deprecated alias for compatibility.
      return this.getAgeOffset();
    },
    refreshLocalizedUi,
    setSeasonalAngle(angleRadians = 0) {
      seasonalAngle = angleRadians;
      group.rotation.y = angleRadians;
    },
    setAgeOffset(angleRadians = 0) {
      ageOffset = THREE.MathUtils.euclideanModulo(angleRadians, FULL_CIRCLE_RADIANS);
      ageLayer.rotation.y = ageOffset;
      syncAgeMarker();
    },
    setSiderealOffset(angleRadians = 0) {
      // Deprecated alias for compatibility.
      this.setAgeOffset(angleRadians);
    },
    setSuppressed(nextSuppressed) {
      suppressed = Boolean(nextSuppressed);
      syncVisibility();
    },
    setVisible(nextVisible) {
      visible = Boolean(nextVisible);
      syncVisibility();
    }
  };
}

