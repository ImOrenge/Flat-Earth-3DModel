import { getLocalizedConstellationName } from "./constellation-name-locales.js";
import {
  CALENDAR_MONTH_SEQUENCE,
  ZODIAC_SIGNS,
  getAgeSignIndexFromAgeOffset
} from "./zodiac-wheel.js?v=20260326-seasonal-ecliptic1";

const DIRECTION_KEYS_16 = [
  "constellationDirectionN",
  "constellationDirectionNNE",
  "constellationDirectionNE",
  "constellationDirectionENE",
  "constellationDirectionE",
  "constellationDirectionESE",
  "constellationDirectionSE",
  "constellationDirectionSSE",
  "constellationDirectionS",
  "constellationDirectionSSW",
  "constellationDirectionSW",
  "constellationDirectionWSW",
  "constellationDirectionW",
  "constellationDirectionWNW",
  "constellationDirectionNW",
  "constellationDirectionNNW",
];

const MAP_SIZE = 100;
const MAP_CENTER = MAP_SIZE / 2;
const MAP_RADIUS = 46;
const FULL_CIRCLE_RADIANS = Math.PI * 2;
const ZODIAC_RENDER_THRESHOLD_RAD = Math.PI / 360;
const ZODIAC_VIEW_SIZE = 100;
const ZODIAC_VIEW_CENTER = ZODIAC_VIEW_SIZE / 2;
const ZODIAC_MONTH_INNER_RADIUS = 39;
const ZODIAC_MONTH_OUTER_RADIUS = 46;
const ZODIAC_SIGN_INNER_RADIUS = 19;
const ZODIAC_SIGN_OUTER_RADIUS = 37;
const ZODIAC_SIGN_LABEL_RADIUS = 28;
const ZODIAC_MONTH_LABEL_RADIUS = 42.5;
const ZODIAC_MARKER_INNER_RADIUS = 15;
const ZODIAC_MARKER_OUTER_RADIUS = 48;
const ZODIAC_SEGMENT_ARC = FULL_CIRCLE_RADIANS / ZODIAC_SIGNS.length;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function formatHours(hours) {
  return `${hours.toFixed(2)}h`;
}

function formatSignedDegrees(degrees) {
  const sign = degrees > 0 ? "+" : "";
  return `${sign}${degrees.toFixed(2)}\u00B0`;
}

function formatUnsignedDegrees(degrees) {
  return `${degrees.toFixed(2)}\u00B0`;
}

function getHemisphereKey(entry) {
  if (entry.minDecDeg < 0 && entry.maxDecDeg > 0) {
    return "constellationHemisphereCrossing";
  }
  return entry.centroidDecDeg >= 0
    ? "constellationHemisphereNorth"
    : "constellationHemisphereSouth";
}

function getDirectionIndex(centroidMapPoint) {
  const dx = centroidMapPoint.x;
  const dy = centroidMapPoint.y;
  if (Math.hypot(dx, dy) < 1e-6) {
    return 0;
  }
  const angleDegrees = ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360;
  return Math.round(angleDegrees / 22.5) % 16;
}

function toSvgPoint(point) {
  return {
    x: MAP_CENTER + (point.x * MAP_RADIUS),
    y: MAP_CENTER + (point.y * MAP_RADIUS),
  };
}

function normalizeAngle(angleRadians) {
  return ((angleRadians % FULL_CIRCLE_RADIANS) + FULL_CIRCLE_RADIANS) % FULL_CIRCLE_RADIANS;
}

function getWheelSvgPoint(radius, angleRadians) {
  return {
    x: ZODIAC_VIEW_CENTER + (radius * Math.sin(angleRadians)),
    y: ZODIAC_VIEW_CENTER - (radius * Math.cos(angleRadians)),
  };
}

function buildAnnularSectorPath(innerRadius, outerRadius, startAngle, endAngle) {
  const normalizedEndAngle = endAngle < startAngle ? endAngle + FULL_CIRCLE_RADIANS : endAngle;
  const span = normalizedEndAngle - startAngle;
  const largeArc = span > Math.PI ? 1 : 0;
  const outerStart = getWheelSvgPoint(outerRadius, startAngle);
  const outerEnd = getWheelSvgPoint(outerRadius, normalizedEndAngle);
  const innerEnd = getWheelSvgPoint(innerRadius, normalizedEndAngle);
  const innerStart = getWheelSvgPoint(innerRadius, startAngle);
  return [
    `M ${outerStart.x.toFixed(2)} ${outerStart.y.toFixed(2)}`,
    `A ${outerRadius.toFixed(2)} ${outerRadius.toFixed(2)} 0 ${largeArc} 1 ${outerEnd.x.toFixed(2)} ${outerEnd.y.toFixed(2)}`,
    `L ${innerEnd.x.toFixed(2)} ${innerEnd.y.toFixed(2)}`,
    `A ${innerRadius.toFixed(2)} ${innerRadius.toFixed(2)} 0 ${largeArc} 0 ${innerStart.x.toFixed(2)} ${innerStart.y.toFixed(2)}`,
    "Z",
  ].join(" ");
}

function colorValueToHex(colorValue) {
  return `#${colorValue.toString(16).padStart(6, "0")}`;
}

function getMonthLabel(monthIndex, i18n) {
  return i18n.formatDate(
    new Date(Date.UTC(2026, monthIndex, 1)),
    { month: i18n.getLanguage() === "ko" ? "numeric" : "short", timeZone: "UTC" }
  );
}

function getWheelLabelFontFamily(i18n) {
  return i18n.getLanguage() === "ko"
    ? '"Malgun Gothic", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif'
    : '"Segoe UI", "Noto Sans", sans-serif';
}

function getTropicalSignIndex(seasonalAngleRadians) {
  return Math.floor(normalizeAngle(-seasonalAngleRadians) / ZODIAC_SEGMENT_ARC) % ZODIAC_SIGNS.length;
}

function buildSegmentSvg(segmentPoints) {
  if (segmentPoints.length <= 2) {
    const first = toSvgPoint(segmentPoints[0]);
    const second = toSvgPoint(segmentPoints[segmentPoints.length - 1]);
    return `<line x1="${first.x.toFixed(2)}" y1="${first.y.toFixed(2)}" x2="${second.x.toFixed(2)}" y2="${second.y.toFixed(2)}" />`;
  }
  const path = segmentPoints
    .map((point, index) => {
      const svgPoint = toSvgPoint(point);
      return `${index === 0 ? "M" : "L"} ${svgPoint.x.toFixed(2)} ${svgPoint.y.toFixed(2)}`;
    })
    .join(" ");
  return `<path d="${path}" />`;
}

function buildGridSvg() {
  const circles = [0.18, 0.38, 0.58, 0.78, 1].map((ratio) => (
    `<circle cx="${MAP_CENTER}" cy="${MAP_CENTER}" r="${(MAP_RADIUS * ratio).toFixed(2)}" />`
  ));

  const spokes = [];
  for (let step = 0; step < 16; step += 2) {
    const theta = (step / 16) * Math.PI * 2;
    const x = MAP_CENTER + (MAP_RADIUS * Math.sin(theta));
    const y = MAP_CENTER - (MAP_RADIUS * Math.cos(theta));
    spokes.push(
      `<line x1="${MAP_CENTER}" y1="${MAP_CENTER}" x2="${x.toFixed(2)}" y2="${y.toFixed(2)}" />`
    );
  }

  return `
    <g class="constellation-map-grid" stroke="#90a5c4" stroke-width="0.24" opacity="0.34" fill="none">
      ${circles.join("\n")}
      ${spokes.join("\n")}
    </g>
  `;
}

export function createConstellationTabController({
  i18n,
  ui,
  constellationApi,
  onSelectionChange,
  zodiacWheelApi,
  getObservationDate
}) {
  const initialCatalog = constellationApi
    .getConstellationCatalog()
    .sort((a, b) => a.name.localeCompare(b.name));
  const staticCatalogByName = new Map(initialCatalog.map((entry) => [entry.name, entry]));
  const sortedNames = initialCatalog.map((entry) => entry.name);

  const state = {
    areLinesVisible: constellationApi.getConstellationLinesVisible?.() ?? false,
    isVisible: true,
    isPanelActive: false,
    lastRenderedAngle: null,
    lastRenderedAgeOffset: null,
    selectedName: null,
    zodiacVisible: zodiacWheelApi?.getVisible?.() ?? true,
  };

  function getCurrentCatalogMap() {
    return new Map(constellationApi.getConstellationCatalog().map((entry) => [entry.name, entry]));
  }

  function getCurrentCatalog() {
    const catalogByName = getCurrentCatalogMap();
    return sortedNames
      .map((name) => catalogByName.get(name))
      .filter(Boolean);
  }

  function getSelectedEntry() {
    if (!state.selectedName) {
      return null;
    }
    return constellationApi.getConstellationState(state.selectedName);
  }

  function getConstellationOptionLabel(entry) {
    const localizedName = getLocalizedConstellationName(entry.name, i18n.getLanguage());
    return `${localizedName} (${entry.code})`;
  }

  function getVisibilityLabel() {
    return state.isVisible
      ? i18n.t("constellationVisibilityOn")
      : i18n.t("constellationVisibilityOff");
  }

  function getLineVisibilityLabel() {
    return state.areLinesVisible
      ? i18n.t("constellationLinesOn")
      : i18n.t("constellationLinesOff");
  }

  function getZodiacVisibilityLabel() {
    return state.zodiacVisible
      ? i18n.t("zodiacWheelVisibilityOn")
      : i18n.t("zodiacWheelVisibilityOff");
  }

  function getZodiacViewState() {
    const seasonalAngleRadians = zodiacWheelApi?.getSeasonalAngle?.() ?? 0;
    const ageOffsetRadians = zodiacWheelApi?.getAgeOffset?.() ?? 0;
    const tropicalSignIndex = getTropicalSignIndex(seasonalAngleRadians);
    const ageSignIndex = zodiacWheelApi?.getAgeSignIndex?.() ?? getAgeSignIndexFromAgeOffset(ageOffsetRadians);
    return {
      ageSign: ZODIAC_SIGNS[ageSignIndex],
      seasonalAngleRadians,
      ageOffsetRadians,
      tropicalSign: ZODIAC_SIGNS[tropicalSignIndex],
    };
  }

  function syncVisibilityUi() {
    if (ui.constellationVisibilityToggleEl) {
      ui.constellationVisibilityToggleEl.checked = state.isVisible;
    }
    if (ui.constellationVisibilityTextEl) {
      ui.constellationVisibilityTextEl.textContent = getVisibilityLabel();
    }
    ui.constellationSelectEl.disabled = !state.isVisible;
  }

  function syncLineVisibilityUi() {
    if (ui.constellationLineVisibilityToggleEl) {
      ui.constellationLineVisibilityToggleEl.checked = state.areLinesVisible;
      ui.constellationLineVisibilityToggleEl.disabled = !state.isVisible;
    }
    if (ui.constellationLineVisibilityTextEl) {
      ui.constellationLineVisibilityTextEl.textContent = getLineVisibilityLabel();
    }
  }

  function syncZodiacVisibilityUi() {
    if (ui.zodiacWheelToggleEl) {
      ui.zodiacWheelToggleEl.checked = state.zodiacVisible;
    }
    if (ui.zodiacWheelTextEl) {
      ui.zodiacWheelTextEl.textContent = getZodiacVisibilityLabel();
    }
  }

  function syncInfoCard() {
    const entry = getSelectedEntry();
    if (!entry) {
      ui.constellationDirectionEl.textContent = "-";
      ui.constellationRaEl.textContent = "-";
      ui.constellationDecEl.textContent = "-";
      ui.constellationHemisphereEl.textContent = "-";
      ui.constellationSegmentsEl.textContent = "-";
      ui.constellationStarsEl.textContent = "-";
      return;
    }

    const directionIndex = getDirectionIndex(entry.centroidMapPoint);
    ui.constellationDirectionEl.textContent = i18n.t(DIRECTION_KEYS_16[directionIndex]);
    ui.constellationRaEl.textContent = formatHours(entry.centroidRAHours);
    ui.constellationDecEl.textContent = formatSignedDegrees(entry.centroidDecDeg);
    ui.constellationHemisphereEl.textContent = i18n.t(getHemisphereKey(entry));
    ui.constellationSegmentsEl.textContent = String(entry.segmentCount);
    ui.constellationStarsEl.textContent = String(entry.uniqueStarCount);
  }

  function renderMap() {
    const catalog = getCurrentCatalog();
    const hasSelection = Boolean(state.selectedName);
    const selectedName = state.selectedName;
    const parts = [];
    parts.push(
      `<svg class="constellation-map-svg" xmlns="http://www.w3.org/2000/svg" width="${MAP_SIZE}" height="${MAP_SIZE}" viewBox="0 0 ${MAP_SIZE} ${MAP_SIZE}" aria-hidden="true">`
    );
    parts.push("<defs>");
    parts.push(`<clipPath id="constellation-map-clip"><circle cx="${MAP_CENTER}" cy="${MAP_CENTER}" r="${MAP_RADIUS}" /></clipPath>`);
    parts.push("</defs>");
    parts.push(`<rect x="0" y="0" width="${MAP_SIZE}" height="${MAP_SIZE}" fill="#07111f" />`);
    parts.push(`<circle cx="${MAP_CENTER}" cy="${MAP_CENTER}" r="${MAP_RADIUS}" fill="#0b1730" opacity="0.42" />`);
    parts.push(buildGridSvg());
    parts.push(`<g clip-path="url(#constellation-map-clip)">`);

    if (state.isVisible) {
      for (const entry of catalog) {
        const isSelected = hasSelection && entry.name === selectedName;
        const segmentOpacity = hasSelection ? (isSelected ? 0.96 : 0.18) : 0.72;
        const segmentWidth = hasSelection ? (isSelected ? 0.70 : 0.30) : 0.44;
        const starOpacity = hasSelection ? (isSelected ? 0.94 : 0.22) : 0.56;
        const starRadius = hasSelection ? (isSelected ? 0.34 : 0.22) : 0.26;

        if (state.areLinesVisible) {
          parts.push(
            `<g stroke="#ffffff" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity="${segmentOpacity.toFixed(3)}" stroke-width="${segmentWidth.toFixed(2)}">`
          );
          for (const segment of entry.mapSegments) {
            parts.push(buildSegmentSvg(segment));
          }
          parts.push("</g>");
        }

        parts.push(
          `<g fill="#f7fbff" opacity="${starOpacity.toFixed(3)}">`
        );
        for (const point of entry.mapStars) {
          const svgPoint = toSvgPoint(point);
          const adjustedRadius = starRadius + (point.brightness * 0.05);
          parts.push(
            `<circle cx="${svgPoint.x.toFixed(2)}" cy="${svgPoint.y.toFixed(2)}" r="${clamp(adjustedRadius, 0.16, 0.45).toFixed(2)}" />`
          );
        }
        parts.push("</g>");
      }
    }

    parts.push(
      `<circle cx="${MAP_CENTER}" cy="${MAP_CENTER}" r="1.45" fill="#fff1c2" opacity="1" />`
    );
    parts.push(
      `<circle cx="${MAP_CENTER}" cy="${MAP_CENTER}" r="2.45" fill="none" stroke="#fff1c2" stroke-width="0.42" opacity="0.48" />`
    );

    parts.push("</g>");
    parts.push(
      `<circle cx="${MAP_CENTER}" cy="${MAP_CENTER}" r="${MAP_RADIUS}" fill="none" stroke="#90a5c4" stroke-width="0.28" opacity="0.75" />`
    );
    parts.push("</svg>");

    ui.constellationMapEl.innerHTML = parts.join("\n");
  }

  function renderZodiacAgeView() {
    if (!ui.zodiacAgeViewEl) {
      return;
    }

    const {
      ageSign,
      seasonalAngleRadians,
      ageOffsetRadians,
      tropicalSign,
    } = getZodiacViewState();
    const ageSignIndex = ZODIAC_SIGNS.findIndex((sign) => sign.key === ageSign.key);
    const tropicalSignIndex = ZODIAC_SIGNS.findIndex((sign) => sign.key === tropicalSign.key);
    const observationDate = getObservationDate?.() ?? null;
    const fontFamily = getWheelLabelFontFamily(i18n);
    const markerAngle = seasonalAngleRadians;
    const parts = [];

    parts.push(
      `<svg class="zodiac-age-svg" xmlns="http://www.w3.org/2000/svg" width="${ZODIAC_VIEW_SIZE}" height="${ZODIAC_VIEW_SIZE}" viewBox="0 0 ${ZODIAC_VIEW_SIZE} ${ZODIAC_VIEW_SIZE}" aria-hidden="true">`
    );
    parts.push("<defs>");
    parts.push(`<radialGradient id="zodiac-age-core" cx="50%" cy="50%" r="50%">`);
    parts.push(`<stop offset="0%" stop-color="rgba(255, 232, 178, 0.92)" />`);
    parts.push(`<stop offset="100%" stop-color="rgba(255, 232, 178, 0)" />`);
    parts.push("</radialGradient>");
    parts.push("</defs>");
    parts.push(`<rect x="0" y="0" width="${ZODIAC_VIEW_SIZE}" height="${ZODIAC_VIEW_SIZE}" fill="#07111f" />`);
    parts.push(`<circle cx="${ZODIAC_VIEW_CENTER}" cy="${ZODIAC_VIEW_CENTER}" r="${ZODIAC_MONTH_OUTER_RADIUS}" fill="#091528" opacity="0.84" />`);

    for (let index = 0; index < ZODIAC_SIGNS.length; index += 1) {
      const sign = ZODIAC_SIGNS[index];
      const startAngle = seasonalAngleRadians + ageOffsetRadians + (index * ZODIAC_SEGMENT_ARC);
      const endAngle = startAngle + ZODIAC_SEGMENT_ARC;
      const centerAngle = startAngle + (ZODIAC_SEGMENT_ARC / 2);
      const labelPoint = getWheelSvgPoint(ZODIAC_SIGN_LABEL_RADIUS, centerAngle);
      const isAgeSign = index === ageSignIndex;
      const fillOpacity = isAgeSign ? 0.82 : 0.28;
      const strokeOpacity = isAgeSign ? 0.96 : 0.34;

      parts.push(
        `<path d="${buildAnnularSectorPath(ZODIAC_SIGN_INNER_RADIUS, ZODIAC_SIGN_OUTER_RADIUS, startAngle, endAngle)}" fill="${colorValueToHex(sign.color)}" fill-opacity="${fillOpacity.toFixed(2)}" stroke="${colorValueToHex(sign.color)}" stroke-opacity="${strokeOpacity.toFixed(2)}" stroke-width="${isAgeSign ? "0.85" : "0.35"}" />`
      );
      parts.push(
        `<text x="${labelPoint.x.toFixed(2)}" y="${labelPoint.y.toFixed(2)}" fill="#f7fbff" font-family="${fontFamily}" font-size="5.8" font-weight="700" text-anchor="middle" dominant-baseline="central">${sign.glyph}</text>`
      );
    }

    parts.push(
      `<circle cx="${ZODIAC_VIEW_CENTER}" cy="${ZODIAC_VIEW_CENTER}" r="${ZODIAC_SIGN_INNER_RADIUS - 2.8}" fill="#08111f" stroke="rgba(255,255,255,0.12)" stroke-width="0.45" />`
    );
    parts.push(
      `<circle cx="${ZODIAC_VIEW_CENTER}" cy="${ZODIAC_VIEW_CENTER}" r="${ZODIAC_SIGN_OUTER_RADIUS}" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="0.5" />`
    );

    for (let index = 0; index < CALENDAR_MONTH_SEQUENCE.length; index += 1) {
      const monthIndex = CALENDAR_MONTH_SEQUENCE[index];
      const monthAngle = seasonalAngleRadians + (index * ZODIAC_SEGMENT_ARC) + (ZODIAC_SEGMENT_ARC / 2);
      const monthPoint = getWheelSvgPoint(ZODIAC_MONTH_LABEL_RADIUS, monthAngle);
      const isTropicalSign = index === tropicalSignIndex;
      parts.push(
        `<path d="${buildAnnularSectorPath(ZODIAC_MONTH_INNER_RADIUS, ZODIAC_MONTH_OUTER_RADIUS, seasonalAngleRadians + (index * ZODIAC_SEGMENT_ARC), seasonalAngleRadians + ((index + 1) * ZODIAC_SEGMENT_ARC))}" fill="${isTropicalSign ? "rgba(255, 226, 146, 0.30)" : "rgba(158, 205, 255, 0.08)"}" stroke="rgba(255,255,255,0.14)" stroke-width="0.28" />`
      );
      parts.push(
        `<text x="${monthPoint.x.toFixed(2)}" y="${monthPoint.y.toFixed(2)}" fill="${isTropicalSign ? "#fff2bc" : "#b8cae9"}" font-family="${fontFamily}" font-size="${i18n.getLanguage() === "ko" ? "4.2" : "4.4"}" font-weight="700" text-anchor="middle" dominant-baseline="central">${getMonthLabel(monthIndex, i18n)}</text>`
      );
    }

    const markerInnerPoint = getWheelSvgPoint(ZODIAC_MARKER_INNER_RADIUS, markerAngle);
    const markerOuterPoint = getWheelSvgPoint(ZODIAC_MARKER_OUTER_RADIUS, markerAngle);
    parts.push(
      `<line x1="${markerInnerPoint.x.toFixed(2)}" y1="${markerInnerPoint.y.toFixed(2)}" x2="${markerOuterPoint.x.toFixed(2)}" y2="${markerOuterPoint.y.toFixed(2)}" stroke="#ffe8a4" stroke-width="1.1" stroke-linecap="round" />`
    );
    parts.push(
      `<circle cx="${markerOuterPoint.x.toFixed(2)}" cy="${markerOuterPoint.y.toFixed(2)}" r="1.75" fill="#ffe8a4" />`
    );
    parts.push(
      `<circle cx="${ZODIAC_VIEW_CENTER}" cy="${ZODIAC_VIEW_CENTER}" r="6.5" fill="url(#zodiac-age-core)" />`
    );
    parts.push(
      `<circle cx="${ZODIAC_VIEW_CENTER}" cy="${ZODIAC_VIEW_CENTER}" r="1.4" fill="#fff1c2" />`
    );
    parts.push("</svg>");

    ui.zodiacAgeViewEl.innerHTML = parts.join("\n");
    ui.zodiacAgeViewEl.setAttribute("aria-label", i18n.t("zodiacAgeViewAria"));
    ui.zodiacCurrentAgeEl.textContent = `${ageSign.glyph} ${i18n.t(ageSign.nameKey)}`;
    ui.zodiacCurrentTropicalEl.textContent = `${tropicalSign.glyph} ${i18n.t(tropicalSign.nameKey)}`;
    ui.zodiacAgeOffsetEl.textContent = formatUnsignedDegrees((ageOffsetRadians * 180) / Math.PI);
    if (ui.zodiacAgeCycleEl) {
      ui.zodiacAgeCycleEl.textContent = i18n.t("zodiacAgeCycleValue");
    }
    ui.zodiacObservationDateEl.textContent = observationDate instanceof Date
      ? i18n.formatDate(observationDate, { dateStyle: "medium" })
      : "-";

    if (ui.zodiacAgeSummaryEl) {
      ui.zodiacAgeSummaryEl.textContent = i18n.t("zodiacAgeSummary", {
        ageSign: i18n.t(ageSign.nameKey),
        offset: formatUnsignedDegrees((ageOffsetRadians * 180) / Math.PI),
        tropicalSign: i18n.t(tropicalSign.nameKey),
      });
    }
  }

  function setSelectedConstellation(name) {
    if (!name) {
      state.selectedName = null;
      constellationApi.setHighlightedConstellation(null);
      onSelectionChange?.(null);
      syncInfoCard();
      renderMap();
      return;
    }

    if (!staticCatalogByName.has(name)) {
      return;
    }
    state.selectedName = name;
    constellationApi.setHighlightedConstellation(name);
    onSelectionChange?.(getSelectedEntry());
    syncInfoCard();
    renderMap();
  }

  function setConstellationsVisible(visible) {
    state.isVisible = Boolean(visible);
    constellationApi.setConstellationsVisible(state.isVisible);
    syncVisibilityUi();
    syncLineVisibilityUi();
    renderMap();
  }

  function setConstellationLinesVisible(visible) {
    state.areLinesVisible = Boolean(visible);
    constellationApi.setConstellationLinesVisible(state.areLinesVisible);
    syncLineVisibilityUi();
    renderMap();
  }

  function setZodiacWheelVisible(visible) {
    state.zodiacVisible = Boolean(visible);
    zodiacWheelApi?.setVisible?.(state.zodiacVisible);
    syncZodiacVisibilityUi();
  }

  function populateSelect() {
    ui.constellationSelectEl.replaceChildren();
    const allOption = document.createElement("option");
    allOption.value = "";
    allOption.textContent = i18n.t("constellationSelectAll");
    ui.constellationSelectEl.appendChild(allOption);

    for (const name of sortedNames) {
      const entry = staticCatalogByName.get(name);
      if (!entry) {
        continue;
      }
      const option = document.createElement("option");
      option.value = entry.name;
      option.textContent = getConstellationOptionLabel(entry);
      ui.constellationSelectEl.appendChild(option);
    }
  }

  function getWrappedAngleDeltaMagnitude(nextAngle, previousAngle) {
    const delta = nextAngle - previousAngle;
    return Math.abs(Math.atan2(Math.sin(delta), Math.cos(delta)));
  }

  function refreshDynamicState({ force = false } = {}) {
    const currentAngle = constellationApi.getSeasonalEclipticAngle?.() ?? 0;
    const currentAgeOffset = zodiacWheelApi?.getAgeOffset?.() ?? 0;
    if (!force && !state.isPanelActive) {
      state.lastRenderedAngle = currentAngle;
      state.lastRenderedAgeOffset = currentAgeOffset;
      return;
    }

    if (
      !force &&
      state.lastRenderedAngle !== null &&
      state.lastRenderedAgeOffset !== null &&
      getWrappedAngleDeltaMagnitude(currentAgeOffset, state.lastRenderedAgeOffset) < ZODIAC_RENDER_THRESHOLD_RAD &&
      getWrappedAngleDeltaMagnitude(currentAngle, state.lastRenderedAngle) < ZODIAC_RENDER_THRESHOLD_RAD
    ) {
      return;
    }

    syncInfoCard();
    renderMap();
    renderZodiacAgeView();
    state.lastRenderedAngle = currentAngle;
    state.lastRenderedAgeOffset = currentAgeOffset;
  }

  function setPanelActive(active) {
    state.isPanelActive = Boolean(active);
    if (state.isPanelActive) {
      refreshDynamicState({ force: true });
    }
  }

  function refreshLocalizedUi() {
    const selectedValue = state.selectedName ?? "";
    populateSelect();
    ui.constellationSelectEl.value = selectedValue;
    syncVisibilityUi();
    syncLineVisibilityUi();
    syncZodiacVisibilityUi();
    zodiacWheelApi?.refreshLocalizedUi?.();
    ui.constellationMapEl.setAttribute("aria-label", i18n.t("constellationMapAria"));
    syncInfoCard();
    renderMap();
    renderZodiacAgeView();
  }

  function initialize() {
    populateSelect();
    ui.constellationSelectEl.value = state.selectedName ?? "";
    ui.constellationSelectEl.addEventListener("change", () => {
      setSelectedConstellation(ui.constellationSelectEl.value || null);
    });
    ui.constellationVisibilityToggleEl?.addEventListener("change", () => {
      setConstellationsVisible(ui.constellationVisibilityToggleEl.checked);
    });
    ui.constellationLineVisibilityToggleEl?.addEventListener("change", () => {
      setConstellationLinesVisible(ui.constellationLineVisibilityToggleEl.checked);
    });
    ui.zodiacWheelToggleEl?.addEventListener("change", () => {
      setZodiacWheelVisible(ui.zodiacWheelToggleEl.checked);
    });
    setSelectedConstellation(state.selectedName);
    setConstellationsVisible(state.isVisible);
    setConstellationLinesVisible(state.areLinesVisible);
    setZodiacWheelVisible(state.zodiacVisible);
    refreshLocalizedUi();
  }

  return {
    getSelectedConstellationName() {
      return state.selectedName;
    },
    initialize,
    refreshDynamicState,
    refreshLocalizedUi,
    setConstellationsVisible,
    setConstellationLinesVisible,
    setPanelActive,
    setSelectedConstellation,
    setZodiacWheelVisible,
  };
}
