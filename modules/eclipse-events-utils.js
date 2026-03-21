import * as THREE from "../vendor/three.module.js";
import { LUNAR_ECLIPSE_EVENTS, SOLAR_ECLIPSE_EVENTS } from "./eclipse-events-data.js?v=20260320-reality-eclipse-events1";

const EVENT_SOURCE_BY_KIND = {
  lunar: LUNAR_ECLIPSE_EVENTS,
  solar: SOLAR_ECLIPSE_EVENTS,
};

const DEFAULT_MODE_RESULT = {
  mode: "none",
  blendFactor: 0,
  targetOrbitAngleRadians: 0,
  targetProgress: 0.5,
  direction: 1,
  eventMeta: null,
};

function getEventsByKind(kind) {
  return EVENT_SOURCE_BY_KIND[kind] ?? [];
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

export function getActiveEclipseEvent(dateMs, kind = null) {
  if (!Number.isFinite(dateMs)) {
    return null;
  }
  if (kind === "solar" || kind === "lunar") {
    return findActiveEventInSeries(getEventsByKind(kind), dateMs);
  }

  const solar = findActiveEventInSeries(SOLAR_ECLIPSE_EVENTS, dateMs);
  const lunar = findActiveEventInSeries(LUNAR_ECLIPSE_EVENTS, dateMs);
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
} = {}) {
  const event = getActiveEclipseEvent(dateMs);
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
      return event.type === "penumbral" ? 0.42 : 1;
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
