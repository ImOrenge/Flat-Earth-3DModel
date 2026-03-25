import * as THREE from "../vendor/three.module.js";
import { LUNAR_ECLIPSE_EVENTS, SOLAR_ECLIPSE_EVENTS } from "./eclipse-events-data.js?v=20260320-reality-eclipse-events1";

const DEFAULT_MODE_RESULT = {
  mode: "none",
  blendFactor: 0,
  targetOrbitAngleRadians: 0,
  targetProgress: 0.5,
  direction: 1,
  eventMeta: null,
};

function sanitizeKind(kind) {
  return kind === "lunar" ? "lunar" : (kind === "solar" ? "solar" : null);
}

function toFiniteNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function parseUtcMs(value) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed || !/[zZ]$/.test(trimmed)) {
    return null;
  }
  const parsed = Date.parse(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeEvent(rawEvent, kind, index = 0) {
  const normalizedKind = sanitizeKind(rawEvent?.kind) ?? sanitizeKind(kind);
  if (!normalizedKind) {
    return null;
  }

  const type = typeof rawEvent?.type === "string" && rawEvent.type.trim()
    ? rawEvent.type.trim().toLowerCase()
    : null;
  const startMs = toFiniteNumber(rawEvent?.startMs);
  const peakMs = toFiniteNumber(rawEvent?.peakMs);
  const endMs = toFiniteNumber(rawEvent?.endMs);
  if (!type || !Number.isFinite(startMs) || !Number.isFinite(peakMs) || !Number.isFinite(endMs)) {
    return null;
  }
  if (endMs < startMs || peakMs < startMs || peakMs > endMs) {
    return null;
  }

  const sourceId = typeof rawEvent?.sourceId === "string" && rawEvent.sourceId.trim()
    ? rawEvent.sourceId.trim()
    : null;
  const label = typeof rawEvent?.label === "string" && rawEvent.label.trim()
    ? rawEvent.label.trim()
    : null;
  const id = sourceId ?? `${normalizedKind}-${Math.round(peakMs)}-${index}`;
  const magnitude = toFiniteNumber(rawEvent?.magnitude);
  const gamma = toFiniteNumber(rawEvent?.gamma);

  return {
    id,
    kind: normalizedKind,
    type,
    startMs,
    peakMs,
    endMs,
    magnitude,
    gamma,
    label,
    sourceId,
    year: new Date(peakMs).getUTCFullYear(),
  };
}

function buildCatalogKind(events = [], kind) {
  return events
    .map((event, index) => normalizeEvent(event, kind, index))
    .filter(Boolean)
    .sort((left, right) => left.peakMs - right.peakMs);
}

export function createEclipseCatalog({
  solarEvents = [],
  lunarEvents = [],
  sourceLabel = "Built-in NASA catalog",
  sourceMode = "builtin",
} = {}) {
  const eventsByKind = {
    solar: buildCatalogKind(solarEvents, "solar"),
    lunar: buildCatalogKind(lunarEvents, "lunar"),
  };
  return {
    sourceLabel,
    sourceMode,
    eventsByKind,
    totalEvents: eventsByKind.solar.length + eventsByKind.lunar.length,
  };
}

export const BUILTIN_ECLIPSE_CATALOG = createEclipseCatalog({
  solarEvents: SOLAR_ECLIPSE_EVENTS,
  lunarEvents: LUNAR_ECLIPSE_EVENTS,
  sourceLabel: "Built-in NASA catalog",
  sourceMode: "builtin",
});

export function getBuiltInEclipseCatalog() {
  return BUILTIN_ECLIPSE_CATALOG;
}

export function getCatalogEventsByKind(kind, catalog = BUILTIN_ECLIPSE_CATALOG) {
  const normalizedKind = sanitizeKind(kind);
  if (!normalizedKind) {
    return [];
  }
  return catalog?.eventsByKind?.[normalizedKind] ?? [];
}

export function getCatalogYears(catalog = BUILTIN_ECLIPSE_CATALOG, kind = "solar") {
  const years = new Set();
  for (const event of getCatalogEventsByKind(kind, catalog)) {
    years.add(event.year);
  }
  return [...years].sort((left, right) => left - right);
}

export function getClosestCatalogYear(catalog = BUILTIN_ECLIPSE_CATALOG, kind = "solar", preferredYear = null) {
  const years = getCatalogYears(catalog, kind);
  if (years.length === 0) {
    return null;
  }
  const numericYear = Number.parseInt(preferredYear, 10);
  if (!Number.isFinite(numericYear)) {
    return years[0];
  }
  if (years.includes(numericYear)) {
    return numericYear;
  }
  return years.reduce((bestYear, candidateYear) => (
    Math.abs(candidateYear - numericYear) < Math.abs(bestYear - numericYear)
      ? candidateYear
      : bestYear
  ), years[0]);
}

export function getCatalogEventsForYear(catalog = BUILTIN_ECLIPSE_CATALOG, kind = "solar", year = null) {
  const selectedYear = Number.parseInt(year, 10);
  if (!Number.isFinite(selectedYear)) {
    return [];
  }
  return getCatalogEventsByKind(kind, catalog).filter((event) => event.year === selectedYear);
}

export function findCatalogEventById(catalog = BUILTIN_ECLIPSE_CATALOG, kind = "solar", eventId = "") {
  if (!eventId) {
    return null;
  }
  return getCatalogEventsByKind(kind, catalog).find((event) => event.id === eventId) ?? null;
}

export function getPreferredCatalogEvent(events = [], preferredEventId = "") {
  if (!Array.isArray(events) || events.length === 0) {
    return null;
  }
  return events.find((event) => event.id === preferredEventId) ?? events[0];
}

export function getEclipseEventTimeMs(event, timePoint = "peak") {
  if (!event) {
    return null;
  }
  switch (timePoint) {
    case "start":
      return event.startMs;
    case "end":
      return event.endMs;
    case "peak":
    default:
      return event.peakMs;
  }
}

function formatMagnitudeLabel(event) {
  return Number.isFinite(event?.magnitude) ? `mag ${event.magnitude.toFixed(3)}` : "";
}

export function formatEclipseEventLabel(event, {
  locale = "en-US",
  timeZone,
  includeKind = true,
  kindLabels = {},
  typeLabels = {},
} = {}) {
  if (!event) {
    return "";
  }
  const formatOptions = {
    dateStyle: "medium",
    timeStyle: "short",
  };
  if (timeZone) {
    formatOptions.timeZone = timeZone;
  }

  const segments = [];
  const peakLabel = new Intl.DateTimeFormat(locale, formatOptions).format(new Date(event.peakMs));
  segments.push(peakLabel);
  if (includeKind) {
    segments.push(kindLabels[event.kind] ?? event.kind);
  }
  segments.push(typeLabels[event.type] ?? event.type);
  const magnitudeLabel = formatMagnitudeLabel(event);
  if (magnitudeLabel) {
    segments.push(magnitudeLabel);
  }
  return segments.join(" | ");
}

function parseCsvRows(csvText = "") {
  const text = String(csvText ?? "").replace(/^\uFEFF/, "");
  const rows = [];
  let currentCell = "";
  let currentRow = [];
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === "\"") {
      const nextChar = text[index + 1];
      if (inQuotes && nextChar === "\"") {
        currentCell += "\"";
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && char === ",") {
      currentRow.push(currentCell);
      currentCell = "";
      continue;
    }

    if (!inQuotes && (char === "\n" || char === "\r")) {
      if (char === "\r" && text[index + 1] === "\n") {
        index += 1;
      }
      currentRow.push(currentCell);
      currentCell = "";
      if (currentRow.some((cell) => cell.trim() !== "")) {
        rows.push(currentRow);
      }
      currentRow = [];
      continue;
    }

    currentCell += char;
  }

  currentRow.push(currentCell);
  if (currentRow.some((cell) => cell.trim() !== "")) {
    rows.push(currentRow);
  }
  return rows;
}

function getCsvHeaderIndex(headerRow = []) {
  return Object.fromEntries(
    headerRow.map((cell, index) => [cell.trim().toLowerCase(), index])
  );
}

function getCsvValue(row, headerIndex, name) {
  const index = headerIndex[name];
  if (!Number.isInteger(index)) {
    return "";
  }
  return row[index] ?? "";
}

function getRowTimeValue(row, headerIndex, msField, utcField) {
  const msValue = toFiniteNumber(getCsvValue(row, headerIndex, msField));
  if (Number.isFinite(msValue)) {
    return msValue;
  }
  return parseUtcMs(getCsvValue(row, headerIndex, utcField));
}

function normalizeCsvRow(row, headerIndex, rowIndex) {
  const kind = sanitizeKind(getCsvValue(row, headerIndex, "kind").trim().toLowerCase());
  const type = getCsvValue(row, headerIndex, "type").trim().toLowerCase();
  const startMs = getRowTimeValue(row, headerIndex, "startms", "startutc");
  const peakMs = getRowTimeValue(row, headerIndex, "peakms", "peakutc");
  const endMs = getRowTimeValue(row, headerIndex, "endms", "endutc");

  return normalizeEvent({
    kind,
    type,
    startMs,
    peakMs,
    endMs,
    magnitude: getCsvValue(row, headerIndex, "magnitude"),
    gamma: getCsvValue(row, headerIndex, "gamma"),
    label: getCsvValue(row, headerIndex, "label"),
    sourceId: getCsvValue(row, headerIndex, "sourceid") || getCsvValue(row, headerIndex, "id"),
  }, kind, rowIndex);
}

export function createEclipseCatalogFromCsvText(csvText, {
  sourceLabel = "Uploaded CSV",
} = {}) {
  const rows = parseCsvRows(csvText);
  if (rows.length < 2) {
    return {
      catalog: null,
      diagnostics: {
        invalidRows: rows.length === 0 ? 0 : rows.length - 1,
        totalRows: Math.max(rows.length - 1, 0),
        validRows: 0,
      },
    };
  }

  const headerIndex = getCsvHeaderIndex(rows[0]);
  const normalizedEvents = [];
  let invalidRows = 0;

  for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
    const normalizedEvent = normalizeCsvRow(rows[rowIndex], headerIndex, rowIndex - 1);
    if (!normalizedEvent) {
      invalidRows += 1;
      continue;
    }
    normalizedEvents.push(normalizedEvent);
  }

  if (normalizedEvents.length === 0) {
    return {
      catalog: null,
      diagnostics: {
        invalidRows,
        totalRows: rows.length - 1,
        validRows: 0,
      },
    };
  }

  const catalog = createEclipseCatalog({
    solarEvents: normalizedEvents.filter((event) => event.kind === "solar"),
    lunarEvents: normalizedEvents.filter((event) => event.kind === "lunar"),
    sourceLabel,
    sourceMode: "upload",
  });
  return {
    catalog,
    diagnostics: {
      invalidRows,
      totalRows: rows.length - 1,
      validRows: normalizedEvents.length,
    },
  };
}

export function getCatalogStats(catalog = BUILTIN_ECLIPSE_CATALOG) {
  const solarCount = getCatalogEventsByKind("solar", catalog).length;
  const lunarCount = getCatalogEventsByKind("lunar", catalog).length;
  return {
    solarCount,
    lunarCount,
    totalCount: solarCount + lunarCount,
  };
}

function getEventHalfWindowMs(event) {
  return Math.max((event.endMs - event.startMs) * 0.5, 1);
}

function findNearestPeakIndex(events, dateMs) {
  let left = 0;
  let right = events.length - 1;
  while (left <= right) {
    const mid = (left + right) >> 1;
    const value = events[mid].peakMs;
    if (value === dateMs) {
      return mid;
    }
    if (value < dateMs) {
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }
  return Math.max(Math.min(left, events.length - 1), 0);
}

function getTypeScore(type = "partial") {
  switch (type) {
    case "total":
      return 1;
    case "annular":
      return 0.9;
    case "hybrid":
      return 0.88;
    case "partial":
      return 0.72;
    case "penumbral":
      return 0.38;
    default:
      return 0.62;
  }
}

function getMagnitudeScore(type = "partial", magnitude = null) {
  if (!Number.isFinite(magnitude)) {
    return type === "penumbral" ? 0.28 : 0.6;
  }
  if (type === "penumbral") {
    return THREE.MathUtils.clamp(magnitude, 0, 1);
  }
  return THREE.MathUtils.clamp(magnitude, 0, 1.2) / 1.2;
}

function getEventScore(event, dateMs) {
  const halfWindowMs = getEventHalfWindowMs(event);
  const peakDistance = Math.abs(dateMs - event.peakMs);
  const proximity = THREE.MathUtils.clamp(1 - (peakDistance / halfWindowMs), 0, 1);
  const magnitudeScore = getMagnitudeScore(event.type, event.magnitude);
  const typeScore = getTypeScore(event.type);
  return proximity * THREE.MathUtils.lerp(0.35, 1, magnitudeScore) * typeScore;
}

function findActiveEventInSeries(events, dateMs) {
  if (!Number.isFinite(dateMs) || events.length === 0) {
    return null;
  }

  const index = findNearestPeakIndex(events, dateMs);
  let best = null;
  const scanWindow = 6;
  for (let offset = -scanWindow; offset <= scanWindow; offset += 1) {
    const candidate = events[index + offset];
    if (!candidate) {
      continue;
    }
    if (dateMs < candidate.startMs || dateMs > candidate.endMs) {
      continue;
    }
    const score = getEventScore(candidate, dateMs);
    if (!best || score > best.score) {
      best = { event: candidate, score };
    }
  }
  return best?.event ?? null;
}

export function getActiveEclipseEvent(dateMs, kind = null, catalog = BUILTIN_ECLIPSE_CATALOG) {
  if (!Number.isFinite(dateMs)) {
    return null;
  }
  if (kind === "solar" || kind === "lunar") {
    return findActiveEventInSeries(getCatalogEventsByKind(kind, catalog), dateMs);
  }

  const solar = findActiveEventInSeries(getCatalogEventsByKind("solar", catalog), dateMs);
  const lunar = findActiveEventInSeries(getCatalogEventsByKind("lunar", catalog), dateMs);
  if (!solar) {
    return lunar;
  }
  if (!lunar) {
    return solar;
  }
  return getEventScore(solar, dateMs) >= getEventScore(lunar, dateMs) ? solar : lunar;
}

function getEventNormalizedProgress(dateMs, event) {
  if (!Number.isFinite(dateMs) || !event) {
    return 0.5;
  }
  const span = Math.max(event.endMs - event.startMs, 1);
  return THREE.MathUtils.clamp((dateMs - event.startMs) / span, 0, 1);
}

function getDefaultOffsetLimitRadians(event) {
  if (event.kind === "solar") {
    switch (event.type) {
      case "partial":
        return 0.18;
      case "annular":
        return 0.13;
      case "hybrid":
        return 0.12;
      case "total":
        return 0.11;
      default:
        return 0.16;
    }
  }
  switch (event.type) {
    case "penumbral":
      return 0.22;
    case "partial":
      return 0.08;
    case "total":
      return 0.05;
    default:
      return 0.14;
  }
}

export function getEclipseAlignmentTarget({
  dateMs,
  sunRenderState = null,
  moonRenderState = null,
  baselineState = null,
  catalog = BUILTIN_ECLIPSE_CATALOG,
} = {}) {
  const event = getActiveEclipseEvent(dateMs, null, catalog);
  if (!event) {
    return {
      ...DEFAULT_MODE_RESULT,
      targetOrbitAngleRadians: baselineState?.orbitAngleRadians ?? 0,
      targetProgress: baselineState?.progress ?? 0.5,
      direction: baselineState?.direction ?? 1,
    };
  }

  const anchorState = event.kind === "solar" ? sunRenderState : moonRenderState;
  const anchorOrbitAngle = anchorState?.orbitAngleRadians ?? baselineState?.orbitAngleRadians ?? 0;
  const anchorProgress = (
    anchorState?.corridorProgress ??
    anchorState?.macroProgress ??
    baselineState?.progress ??
    0.5
  );

  const normalizedProgress = getEventNormalizedProgress(dateMs, event);
  const centeredProgress = (normalizedProgress * 2) - 1;
  const proximity = 1 - Math.abs(centeredProgress);
  const typeScore = getTypeScore(event.type);
  const magnitudeScore = getMagnitudeScore(event.type, event.magnitude);
  const computedBlend = THREE.MathUtils.clamp(
    proximity * THREE.MathUtils.lerp(0.55, 1, magnitudeScore) * typeScore,
    0,
    1
  );
  const blendFloor = (() => {
    if (event.kind === "lunar") {
      return event.type === "penumbral" ? 0.42 : proximity;
    }
    if (event.kind === "solar") {
      return event.type === "partial" ? 0.8 : 0.88;
    }
    return 0;
  })();
  const blendFactor = THREE.MathUtils.clamp(
    Math.max(computedBlend, blendFloor),
    0,
    1
  );
  const offsetLimitRadians = getDefaultOffsetLimitRadians(event);
  const angularOffset = centeredProgress * offsetLimitRadians;

  return {
    mode: event.kind,
    blendFactor,
    targetOrbitAngleRadians: anchorOrbitAngle + angularOffset,
    targetProgress: anchorProgress,
    direction: centeredProgress >= 0 ? 1 : -1,
    eventMeta: {
      ...event,
      centeredProgress,
      normalizedProgress,
      offsetLimitRadians,
      proximity,
    },
  };
}
