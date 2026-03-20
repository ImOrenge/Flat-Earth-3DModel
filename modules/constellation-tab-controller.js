import { getLocalizedConstellationName } from "./constellation-name-locales.js";

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
const PRECESSION_RENDER_THRESHOLD_RAD = Math.PI / 360;

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

export function createConstellationTabController({ i18n, ui, constellationApi, onSelectionChange }) {
  const initialCatalog = constellationApi
    .getConstellationCatalog()
    .sort((a, b) => a.name.localeCompare(b.name));
  const staticCatalogByName = new Map(initialCatalog.map((entry) => [entry.name, entry]));
  const sortedNames = initialCatalog.map((entry) => entry.name);

  const state = {
    isVisible: true,
    isPanelActive: false,
    lastRenderedAngle: null,
    selectedName: null,
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

  function syncVisibilityUi() {
    if (ui.constellationVisibilityToggleEl) {
      ui.constellationVisibilityToggleEl.checked = state.isVisible;
    }
    if (ui.constellationVisibilityTextEl) {
      ui.constellationVisibilityTextEl.textContent = getVisibilityLabel();
    }
    ui.constellationSelectEl.disabled = !state.isVisible;
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

        parts.push(
          `<g stroke="#ffffff" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity="${segmentOpacity.toFixed(3)}" stroke-width="${segmentWidth.toFixed(2)}">`
        );
        for (const segment of entry.mapSegments) {
          parts.push(buildSegmentSvg(segment));
        }
        parts.push("</g>");

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
    renderMap();
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
    const currentAngle = constellationApi.getSeasonalPrecessionAngle?.() ?? 0;
    if (!force && !state.isPanelActive) {
      state.lastRenderedAngle = currentAngle;
      return;
    }

    if (
      !force &&
      state.lastRenderedAngle !== null &&
      getWrappedAngleDeltaMagnitude(currentAngle, state.lastRenderedAngle) < PRECESSION_RENDER_THRESHOLD_RAD
    ) {
      return;
    }

    syncInfoCard();
    renderMap();
    state.lastRenderedAngle = currentAngle;
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
    ui.constellationMapEl.setAttribute("aria-label", i18n.t("constellationMapAria"));
    syncInfoCard();
    renderMap();
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
    setSelectedConstellation(state.selectedName);
    setConstellationsVisible(state.isVisible);
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
    setPanelActive,
    setSelectedConstellation,
  };
}
