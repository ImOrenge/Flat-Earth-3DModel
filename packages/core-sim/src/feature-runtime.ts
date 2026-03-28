import { clamp, euclideanModulo } from "./math";
import type {
  ConstellationEntry,
  DetailAction,
  DetailSnapshot,
  DetailTab,
  EclipseEvent,
  FeatureAdvanceContext,
  FeatureRuntimeConfig,
  FeatureRuntimeState,
  RocketLaunchPhase,
  RocketSpaceport,
  RouteDefinition
} from "./types";

const DIR16 = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"] as const;
const ZODIAC = ["Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo", "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"] as const;

const DEFAULT_SPACEPORTS: RocketSpaceport[] = [
  { id: "cape-canaveral", name: "Cape Canaveral, USA (East)", latitude: 28.39, longitude: -80.6, headingDegrees: 90 },
  { id: "vandenberg", name: "Vandenberg, USA (Polar)", latitude: 34.74, longitude: -120.57, headingDegrees: 180 },
  { id: "naro", name: "Naro, South Korea (South-East)", latitude: 34.43, longitude: 127.53, headingDegrees: 150 },
  { id: "wenchang", name: "Wenchang, China (South-East)", latitude: 19.61, longitude: 110.95, headingDegrees: 120 },
  { id: "plesetsk", name: "Plesetsk, Russia (Polar/North)", latitude: 62.92, longitude: 40.57, headingDegrees: 0 },
  { id: "baikonur", name: "Baikonur, Russia (North-East)", latitude: 45.96, longitude: 63.3, headingDegrees: 60 },
  { id: "kourou", name: "Kourou, Guiana (East)", latitude: 5.23, longitude: -52.76, headingDegrees: 90 },
  { id: "andoya", name: "Andoya, Norway (Polar/North)", latitude: 69.29, longitude: 16.02, headingDegrees: 0 }
];

function normalizeEvents(events: EclipseEvent[] = [], fallbackKind: "solar" | "lunar"): EclipseEvent[] {
  return events
    .map((event, index) => {
      const startMs = Number(event.startMs);
      const peakMs = Number(event.peakMs);
      const endMs = Number(event.endMs);
      if (!Number.isFinite(startMs) || !Number.isFinite(peakMs) || !Number.isFinite(endMs)) {
        return null;
      }
      if (endMs < startMs || peakMs < startMs || peakMs > endMs) {
        return null;
      }
      return {
        ...event,
        id: event.id || `${fallbackKind}-${Math.round(peakMs)}-${index}`,
        kind: fallbackKind,
        year: Number.isFinite(event.year) ? event.year : new Date(peakMs).getUTCFullYear(),
        magnitude: Number.isFinite(event.magnitude) ? event.magnitude : null,
        gamma: Number.isFinite(event.gamma) ? event.gamma : null
      };
    })
    .filter((event): event is EclipseEvent => event !== null)
    .sort((a, b) => a.peakMs - b.peakMs);
}

function formatUtc(ms: number): string {
  return new Date(ms).toISOString().slice(0, 16).replace("T", " ");
}

function formatLocal(ms: number): string {
  return new Date(ms).toLocaleString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
}

function getEclipsePointMs(event: EclipseEvent, timePoint: "start" | "peak" | "end"): number {
  if (timePoint === "start") {
    return event.startMs;
  }
  if (timePoint === "end") {
    return event.endMs;
  }
  return event.peakMs;
}

function routeIds(routesById: Record<string, RouteDefinition>): string[] {
  return Object.keys(routesById).sort((a, b) => a.localeCompare(b));
}

function normalizeRoute(route: RouteDefinition, index: number): RouteDefinition {
  return {
    ...route,
    id: route.id || `route-${index + 1}`,
    originIcao: (route.originIcao || "").toUpperCase(),
    destinationIcao: (route.destinationIcao || "").toUpperCase(),
    aircraftTypeCode: (route.aircraftTypeCode || "").toUpperCase(),
    durationHours: Math.max(0.1, Number(route.durationHours) || 2)
  };
}

function normalizeConstellationEntries(entries: ConstellationEntry[] | undefined): FeatureRuntimeState["data"]["constellations"] {
  const safeEntries = (entries ?? []) as FeatureRuntimeState["data"]["constellations"];
  return safeEntries
    .map((entry) => {
      let sumRa = 0;
      let sumDec = 0;
      let points = 0;
      let minDec = Number.POSITIVE_INFINITY;
      let maxDec = Number.NEGATIVE_INFINITY;
      const uniqueStars = new Set<string>();

      for (const segment of entry.segments ?? []) {
        for (const point of segment ?? []) {
          const ra = Number(point?.[0]);
          const dec = Number(point?.[1]);
          if (!Number.isFinite(ra) || !Number.isFinite(dec)) {
            continue;
          }
          sumRa += ra;
          sumDec += dec;
          points += 1;
          minDec = Math.min(minDec, dec);
          maxDec = Math.max(maxDec, dec);
          uniqueStars.add(`${ra.toFixed(6)}:${dec.toFixed(6)}`);
        }
      }
      if (points === 0) {
        return null;
      }
      return {
        ...entry,
        segmentCount: entry.segmentCount || entry.segments.length,
        uniqueStarCount: entry.uniqueStarCount || uniqueStars.size,
        centroidRAHours: Number.isFinite(entry.centroidRAHours) ? entry.centroidRAHours : (sumRa / points),
        centroidDecDeg: Number.isFinite(entry.centroidDecDeg) ? entry.centroidDecDeg : (sumDec / points),
        minDecDeg: Number.isFinite(entry.minDecDeg) ? entry.minDecDeg : minDec,
        maxDecDeg: Number.isFinite(entry.maxDecDeg) ? entry.maxDecDeg : maxDec
      };
    })
    .filter((entry): entry is FeatureRuntimeState["data"]["constellations"][number] => entry !== null)
    .sort((a, b) => a.name.localeCompare(b.name));
}

function stageLabel(phase: RocketLaunchPhase): string {
  if (phase === "stage1") return "Stage 1 burn";
  if (phase === "separation") return "Stage separation";
  if (phase === "stage2") return "Stage 2 burn";
  if (phase === "coast") return "Coasting";
  if (phase === "complete") return "Mission complete";
  return "Ready";
}

function createBaseState(config: FeatureRuntimeConfig): FeatureRuntimeState {
  const solarEvents = normalizeEvents(config.eclipse?.solarEvents, "solar");
  const lunarEvents = normalizeEvents(config.eclipse?.lunarEvents, "lunar");
  const entries = normalizeConstellationEntries(config.constellations?.entries);
  const countriesByCode = Object.fromEntries((config.routes?.countries ?? []).map((c) => [(c.alpha2 || "").toUpperCase(), c]));
  const airportsByIcao = Object.fromEntries((config.routes?.airports ?? []).map((a) => [String(a.icao || "").toUpperCase(), { ...a, icao: String(a.icao || "").toUpperCase() }]));
  const aircraftByCode = Object.fromEntries((config.routes?.aircraftTypes ?? []).map((a) => [String(a.icaoCode || "").toUpperCase(), { ...a, icaoCode: String(a.icaoCode || "").toUpperCase() }]));
  const routesById = Object.fromEntries((config.routes?.routes ?? []).map((route, index) => {
    const next = normalizeRoute(route, index);
    return [next.id, next];
  }));
  const spaceports = config.rockets?.spaceports?.length ? config.rockets.spaceports : DEFAULT_SPACEPORTS;
  const nowMs = Date.now();
  const firstSpaceport = spaceports[0];

  return {
    activeTab: "astronomy",
    observationTimeMs: nowMs,
    pendingObservationTimeMs: null,
    appActive: true,
    eclipse: {
      sourceLabel: config.eclipse?.sourceLabel ?? "Bundled eclipse catalog",
      kind: "solar",
      selectedYear: null,
      selectedEventId: null,
      selectedEventIndex: -1,
      timePoint: "peak",
      availableYears: [],
      eventOptions: [],
      stageLabel: "Waiting",
      coveragePercent: 0,
      lightPercent: 100,
      summary: "No eclipse data.",
      selectedEventLabel: "None",
      selectedEventLocalTimeLabel: "-",
      selectedEventUtcTimeLabel: "-",
      selectedEventMagnitudeLabel: "-",
      previewTimeMs: null
    },
    constellations: {
      visible: true,
      linesVisible: true,
      options: [],
      selectedIndex: -1,
      selectedName: "",
      selectedCode: "",
      directionLabel: "-",
      centerRaLabel: "-",
      centerDecLabel: "-",
      hemisphereLabel: "-",
      segmentCount: 0,
      starCount: 0,
      zodiacSignLabel: "-"
    },
    routes: {
      ready: false,
      playing: false,
      speedMultiplier: 8,
      selectedRouteId: "",
      selectedRouteIndex: -1,
      routeOptions: [],
      progressRatio: 0,
      progressPercent: 0,
      legLabel: "-",
      aircraftLabel: "-",
      originLabel: "-",
      destinationLabel: "-",
      countriesLabel: "-",
      durationLabel: "-",
      routeProgressLabel: "-",
      geoSummaryLabel: "-",
      summary: "Route dataset unavailable.",
      renderData: null
    },
    rockets: {
      backend: config.rockets?.backend ?? "fallback",
      selectedSpaceportId: firstSpaceport?.id ?? "",
      selectedSpaceportIndex: firstSpaceport ? 0 : -1,
      spaceportOptions: spaceports,
      rocketType: "two-stage",
      phase: "idle",
      missionElapsedSeconds: 0,
      phaseElapsedSeconds: 0,
      canLaunch: true,
      telemetry: {
        phase: "idle",
        elapsedSeconds: 0,
        altitudeKm: 0,
        speedKps: 0,
        downrangeKm: 0,
        statusLabel: "Ready"
      },
      renderData: {
        latitudeDegrees: firstSpaceport?.latitude ?? 0,
        longitudeDegrees: firstSpaceport?.longitude ?? 0,
        altitudeKm: 0
      }
    },
    data: {
      eclipseSolarEvents: solarEvents,
      eclipseLunarEvents: lunarEvents,
      constellations: entries as FeatureRuntimeState["data"]["constellations"],
      countriesByCode: countriesByCode as FeatureRuntimeState["data"]["countriesByCode"],
      airportsByIcao: airportsByIcao as FeatureRuntimeState["data"]["airportsByIcao"],
      aircraftByCode: aircraftByCode as FeatureRuntimeState["data"]["aircraftByCode"],
      routesById: routesById as FeatureRuntimeState["data"]["routesById"]
    }
  };
}

function recomputeDerived(state: FeatureRuntimeState, seasonalEclipticAngleRadians = 0): FeatureRuntimeState {
  const eclipseEvents = state.eclipse.kind === "lunar" ? state.data.eclipseLunarEvents : state.data.eclipseSolarEvents;
  const years = [...new Set(eclipseEvents.map((event) => event.year))].sort((a, b) => a - b);
  const preferredYear = state.eclipse.selectedYear ?? years[0] ?? null;
  const selectedYear = years.includes(preferredYear as number) ? preferredYear : years[0] ?? null;
  const eventsInYear = selectedYear === null ? [] : eclipseEvents.filter((event) => event.year === selectedYear);
  const selectedEvent = eventsInYear.find((event) => event.id === state.eclipse.selectedEventId) ?? eventsInYear[0] ?? null;
  const selectedEventIndex = selectedEvent ? eventsInYear.findIndex((event) => event.id === selectedEvent.id) : -1;
  const eventOptions = eventsInYear.map((event) => ({
    id: event.id,
    label: `${formatUtc(event.peakMs)} | ${event.type}`,
    type: event.type,
    peakMs: event.peakMs,
    magnitude: event.magnitude
  }));

  let coveragePercent = 0;
  let lightPercent = 100;
  let stage = "Waiting";
  let selectedEventLabel = "None";
  let selectedEventLocalTimeLabel = "-";
  let selectedEventUtcTimeLabel = "-";
  let selectedEventMagnitudeLabel = "-";
  let summary = years.length ? "Select an eclipse event." : "No eclipse data.";
  if (selectedEvent) {
    const span = Math.max(1, selectedEvent.endMs - selectedEvent.startMs);
    const progress = clamp((state.observationTimeMs - selectedEvent.startMs) / span, 0, 1);
    const maxCoverage = selectedEvent.type === "total" ? 100 : selectedEvent.type === "partial" ? 70 : 94;
    if (progress > 0.2 && progress < 0.8) {
      if (progress < 0.4) coveragePercent = Math.round(maxCoverage * ((progress - 0.2) / 0.2));
      else if (progress < 0.6) coveragePercent = maxCoverage;
      else coveragePercent = Math.round(maxCoverage * (1 - ((progress - 0.6) / 0.2)));
    }
    lightPercent = Math.round(clamp(100 - (coveragePercent * 0.92), 3, 100));
    if (progress === 0) stage = "Waiting";
    else if (progress < 0.2) stage = "Approach";
    else if (progress < 0.4) stage = "Partial ingress";
    else if (progress < 0.6) stage = "Peak";
    else if (progress < 0.8) stage = "Partial egress";
    else if (progress < 1) stage = "Approach";
    else stage = "Complete";
    const timeMs = getEclipsePointMs(selectedEvent, state.eclipse.timePoint);
    selectedEventLabel = `${selectedEvent.type.toUpperCase()} | ${new Date(selectedEvent.peakMs).toISOString().slice(0, 10)}`;
    selectedEventLocalTimeLabel = formatLocal(timeMs);
    selectedEventUtcTimeLabel = formatUtc(timeMs);
    selectedEventMagnitudeLabel = Number.isFinite(selectedEvent.magnitude) ? selectedEvent.magnitude!.toFixed(3) : "N/A";
    summary = `${selectedEvent.type} eclipse ${selectedEvent.year} | ${stage}`;
  }

  const constOptions = state.data.constellations.map((entry) => ({ name: entry.name, code: entry.code }));
  const constIndex = constOptions.length
    ? clamp(state.constellations.selectedIndex < 0 ? 0 : state.constellations.selectedIndex, 0, constOptions.length - 1)
    : -1;
  const constEntry = constIndex >= 0 ? state.data.constellations[constIndex] : null;
  const zodiacIndex = Math.floor(euclideanModulo(-seasonalEclipticAngleRadians / (Math.PI * 2), 1) * 12) % 12;
  const directionIndex = constEntry ? Math.round((euclideanModulo((constEntry.centroidRAHours / 24) * 360, 360) / 22.5)) % 16 : 0;
  const constellationState = {
    ...state.constellations,
    options: constOptions,
    selectedIndex: constIndex,
    selectedName: constEntry?.name ?? "",
    selectedCode: constEntry?.code ?? "",
    directionLabel: constEntry ? DIR16[directionIndex] : "-",
    centerRaLabel: constEntry ? `${constEntry.centroidRAHours.toFixed(2)}h` : "-",
    centerDecLabel: constEntry ? `${constEntry.centroidDecDeg >= 0 ? "+" : "-"}${Math.abs(constEntry.centroidDecDeg).toFixed(2)}deg` : "-",
    hemisphereLabel: constEntry ? (constEntry.minDecDeg < 0 && constEntry.maxDecDeg > 0 ? "Cross-equatorial" : constEntry.centroidDecDeg >= 0 ? "Northern" : "Southern") : "-",
    segmentCount: constEntry?.segmentCount ?? 0,
    starCount: constEntry?.uniqueStarCount ?? 0,
    zodiacSignLabel: ZODIAC[zodiacIndex]
  };

  const ids = routeIds(state.data.routesById);
  const selectedRouteId = ids.includes(state.routes.selectedRouteId) ? state.routes.selectedRouteId : ids[0] ?? "";
  const selectedRouteIndex = ids.indexOf(selectedRouteId);
  const selectedRoute = selectedRouteId ? state.data.routesById[selectedRouteId] : null;
  const origin = selectedRoute ? state.data.airportsByIcao[selectedRoute.originIcao] : null;
  const destination = selectedRoute ? state.data.airportsByIcao[selectedRoute.destinationIcao] : null;
  const aircraftType = selectedRoute ? state.data.aircraftByCode[selectedRoute.aircraftTypeCode] : null;
  const progressRatio = clamp(state.routes.progressRatio, 0, 1);
  const durationHours = selectedRoute?.durationHours ?? 0;
  const elapsedHours = durationHours * progressRatio;
  const remainingHours = Math.max(durationHours - elapsedHours, 0);
  const routesState = {
    ...state.routes,
    ready: Boolean(selectedRoute && origin && destination),
    selectedRouteId,
    selectedRouteIndex,
    routeOptions: ids.map((id) => {
      const route = state.data.routesById[id];
      const left = state.data.airportsByIcao[route.originIcao]?.iata || route.originIcao;
      const right = state.data.airportsByIcao[route.destinationIcao]?.iata || route.destinationIcao;
      return { id, label: `${left}-${right} | ${route.aircraftTypeCode}` };
    }),
    progressPercent: Math.round(progressRatio * 100),
    legLabel: origin && destination ? `${origin.iata} -> ${destination.iata}` : "-",
    aircraftLabel: aircraftType ? `${aircraftType.name} (${aircraftType.icaoCode})` : selectedRoute?.aircraftTypeCode ?? "-",
    originLabel: origin ? `${origin.iata} / ${origin.icao} | ${origin.city}` : "-",
    destinationLabel: destination ? `${destination.iata} / ${destination.icao} | ${destination.city}` : "-",
    countriesLabel: origin && destination ? `${state.data.countriesByCode[origin.countryCode]?.name ?? origin.countryCode} -> ${state.data.countriesByCode[destination.countryCode]?.name ?? destination.countryCode}` : "-",
    durationLabel: durationHours ? `${Math.round(durationHours * 60)}m` : "-",
    routeProgressLabel: durationHours ? `${Math.round(progressRatio * 100)}% | elapsed ${Math.round(elapsedHours * 60)}m | remaining ${Math.round(remainingHours * 60)}m` : "-",
    geoSummaryLabel: origin && destination ? `${origin.latitude.toFixed(2)}, ${origin.longitude.toFixed(2)} -> ${destination.latitude.toFixed(2)}, ${destination.longitude.toFixed(2)}` : "-",
    summary: origin && destination ? `${origin.name} to ${destination.name}` : "Route dataset unavailable.",
    renderData: origin && destination
      ? {
        originLatitude: origin.latitude,
        originLongitude: origin.longitude,
        destinationLatitude: destination.latitude,
        destinationLongitude: destination.longitude
      }
      : null
  };

  const spaceport = state.rockets.spaceportOptions[state.rockets.selectedSpaceportIndex];
  const mission = Math.max(0, state.rockets.missionElapsedSeconds);
  let phase = state.rockets.phase;
  let altitudeKm = 0;
  let speedKps = 0;
  if (phase !== "idle") {
    if (state.rockets.rocketType === "single") {
      if (mission < 4.5) {
        phase = "stage1";
        altitudeKm = 55 * (mission / 4.5);
        speedKps = 2.7 * (mission / 4.5);
      } else if (mission < 8) {
        phase = "coast";
        altitudeKm = 55 + (75 * ((mission - 4.5) / 3.5));
        speedKps = 2.7 - (0.5 * ((mission - 4.5) / 3.5));
      } else {
        phase = "complete";
        altitudeKm = 130;
        speedKps = 0;
      }
    } else if (mission < 6) {
      phase = "stage1";
      altitudeKm = 62 * (mission / 6);
      speedKps = 2.8 * (mission / 6);
    } else if (mission < 7.2) {
      phase = "separation";
      altitudeKm = 62 + (6 * ((mission - 6) / 1.2));
      speedKps = 2.8 - (0.7 * ((mission - 6) / 1.2));
    } else if (mission < 12.2) {
      phase = "stage2";
      altitudeKm = 68 + (162 * ((mission - 7.2) / 5));
      speedKps = 2.1 + (5.4 * ((mission - 7.2) / 5));
    } else if (mission < 16.2) {
      phase = "coast";
      altitudeKm = 230 + (90 * ((mission - 12.2) / 4));
      speedKps = 7.5 - (0.4 * ((mission - 12.2) / 4));
    } else {
      phase = "complete";
      altitudeKm = 320;
      speedKps = 0;
    }
  }
  const downrangeKm = mission * speedKps * 0.7;
  const headingRad = ((spaceport?.headingDegrees ?? 0) * Math.PI) / 180;
  const latShift = (Math.cos(headingRad) * downrangeKm) / 111;
  const lonShift = (Math.sin(headingRad) * downrangeKm) / Math.max(15, Math.cos(((spaceport?.latitude ?? 0) * Math.PI) / 180) * 111);
  const rocketsState = {
    ...state.rockets,
    phase,
    canLaunch: phase === "idle" || phase === "complete",
    telemetry: {
      phase,
      elapsedSeconds: mission,
      altitudeKm,
      speedKps,
      downrangeKm,
      statusLabel: stageLabel(phase)
    },
    renderData: {
      latitudeDegrees: clamp((spaceport?.latitude ?? 0) + latShift, -85, 85),
      longitudeDegrees: ((spaceport?.longitude ?? 0) + lonShift + 540) % 360 - 180,
      altitudeKm
    }
  };

  return {
    ...state,
    eclipse: {
      ...state.eclipse,
      selectedYear,
      selectedEventId: selectedEvent?.id ?? null,
      selectedEventIndex,
      availableYears: years,
      eventOptions,
      stageLabel: stage,
      coveragePercent,
      lightPercent,
      summary,
      selectedEventLabel,
      selectedEventLocalTimeLabel,
      selectedEventUtcTimeLabel,
      selectedEventMagnitudeLabel
    },
    constellations: constellationState,
    routes: routesState,
    rockets: rocketsState
  };
}

export function createFeatureRuntime(config: FeatureRuntimeConfig = {}): FeatureRuntimeState {
  return recomputeDerived(createBaseState(config), 0);
}

export function reduceDetailAction(state: FeatureRuntimeState, action: DetailAction): FeatureRuntimeState {
  switch (action.type) {
    case "set_active_tab":
      return { ...state, activeTab: action.tab };
    case "eclipse_set_kind":
      return recomputeDerived({ ...state, eclipse: { ...state.eclipse, kind: action.kind, selectedYear: null, selectedEventId: null } });
    case "eclipse_set_year":
      return recomputeDerived({ ...state, eclipse: { ...state.eclipse, selectedYear: action.year, selectedEventId: null } });
    case "eclipse_set_event":
      return recomputeDerived({ ...state, eclipse: { ...state.eclipse, selectedEventId: action.eventId } });
    case "eclipse_set_timepoint":
      return recomputeDerived({ ...state, eclipse: { ...state.eclipse, timePoint: action.timePoint } });
    case "eclipse_preview_selected": {
      const eventList = state.eclipse.kind === "lunar" ? state.data.eclipseLunarEvents : state.data.eclipseSolarEvents;
      const event = eventList.find((item) => item.id === state.eclipse.selectedEventId);
      if (!event) return state;
      const preview = getEclipsePointMs(event, state.eclipse.timePoint);
      return recomputeDerived({
        ...state,
        observationTimeMs: preview,
        pendingObservationTimeMs: preview,
        eclipse: { ...state.eclipse, previewTimeMs: preview }
      });
    }
    case "constellation_toggle_visibility":
      return recomputeDerived({ ...state, constellations: { ...state.constellations, visible: action.visible } });
    case "constellation_toggle_lines":
      return recomputeDerived({ ...state, constellations: { ...state.constellations, linesVisible: action.visible } });
    case "constellation_select": {
      const index = state.data.constellations.findIndex((entry) => entry.name === action.name);
      if (index < 0) return state;
      return recomputeDerived({ ...state, constellations: { ...state.constellations, selectedIndex: index } });
    }
    case "routes_select":
      return recomputeDerived({ ...state, routes: { ...state.routes, selectedRouteId: action.routeId, progressRatio: 0 } });
    case "routes_set_speed":
      return recomputeDerived({ ...state, routes: { ...state.routes, speedMultiplier: clamp(action.speedMultiplier, 1, 24) } });
    case "routes_toggle_playback":
      return recomputeDerived({ ...state, routes: { ...state.routes, playing: action.playing ?? !state.routes.playing } });
    case "routes_reset":
      return recomputeDerived({ ...state, routes: { ...state.routes, progressRatio: 0 } });
    case "rockets_select_spaceport": {
      const index = state.rockets.spaceportOptions.findIndex((item) => item.id === action.spaceportId);
      if (index < 0) return state;
      return recomputeDerived({
        ...state,
        rockets: {
          ...state.rockets,
          selectedSpaceportId: action.spaceportId,
          selectedSpaceportIndex: index,
          phase: "idle",
          missionElapsedSeconds: 0,
          phaseElapsedSeconds: 0
        }
      });
    }
    case "rockets_select_type":
      return recomputeDerived({ ...state, rockets: { ...state.rockets, rocketType: action.rocketType, phase: "idle", missionElapsedSeconds: 0, phaseElapsedSeconds: 0 } });
    case "rockets_launch":
      if (!state.rockets.canLaunch) return state;
      return recomputeDerived({ ...state, rockets: { ...state.rockets, phase: "stage1", missionElapsedSeconds: 0, phaseElapsedSeconds: 0 } });
    case "rockets_reset":
      return recomputeDerived({ ...state, rockets: { ...state.rockets, phase: "idle", missionElapsedSeconds: 0, phaseElapsedSeconds: 0 } });
    default:
      return state;
  }
}

export function advanceFeatureRuntime(state: FeatureRuntimeState, dtSeconds: number, context: FeatureAdvanceContext): FeatureRuntimeState {
  const routeStep = state.routes.playing && state.routes.ready && (context.appActive ?? state.appActive)
    ? (Math.max(0, dtSeconds) * Math.max(1, state.routes.speedMultiplier)) / 120
    : 0;
  const rocketStep = state.rockets.phase === "idle" || state.rockets.phase === "complete" || !(context.appActive ?? state.appActive)
    ? 0
    : Math.max(0, dtSeconds);
  return recomputeDerived({
    ...state,
    appActive: context.appActive ?? state.appActive,
    observationTimeMs: context.observationTimeMs,
    routes: {
      ...state.routes,
      progressRatio: euclideanModulo(state.routes.progressRatio + routeStep, 1)
    },
    rockets: {
      ...state.rockets,
      missionElapsedSeconds: state.rockets.missionElapsedSeconds + rocketStep,
      phaseElapsedSeconds: state.rockets.phaseElapsedSeconds + rocketStep
    }
  }, context.seasonalEclipticAngleRadians ?? 0);
}

export function getDetailSnapshot(state: FeatureRuntimeState, tab?: DetailTab): DetailSnapshot {
  return {
    activeTab: tab ?? state.activeTab,
    astronomy: {
      eclipse: {
        ...state.eclipse,
        availableYears: [...state.eclipse.availableYears],
        eventOptions: state.eclipse.eventOptions.map((option) => ({ ...option }))
      }
    },
    constellations: {
      ...state.constellations,
      options: state.constellations.options.map((option) => ({ ...option }))
    },
    routes: {
      ...state.routes,
      routeOptions: state.routes.routeOptions.map((option) => ({ ...option })),
      renderData: state.routes.renderData ? { ...state.routes.renderData } : null
    },
    rockets: {
      ...state.rockets,
      spaceportOptions: state.rockets.spaceportOptions.map((item) => ({ ...item })),
      telemetry: { ...state.rockets.telemetry },
      renderData: { ...state.rockets.renderData }
    }
  };
}
