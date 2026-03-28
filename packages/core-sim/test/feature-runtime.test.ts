import { describe, expect, it } from "vitest";
import {
  advanceFeatureRuntime,
  createFeatureRuntime,
  getDetailSnapshot,
  reduceDetailAction,
  type EclipseEvent,
  type FeatureRuntimeConfig
} from "../src";

const SOLAR_EVENTS: EclipseEvent[] = [
  {
    id: "solar-2026-1",
    kind: "solar",
    type: "total",
    startMs: Date.parse("2026-08-12T10:00:00.000Z"),
    peakMs: Date.parse("2026-08-12T11:00:00.000Z"),
    endMs: Date.parse("2026-08-12T12:00:00.000Z"),
    magnitude: 1.01,
    gamma: null,
    sourceId: "x1",
    year: 2026
  }
];

const LUNAR_EVENTS: EclipseEvent[] = [
  {
    id: "lunar-2027-1",
    kind: "lunar",
    type: "partial",
    startMs: Date.parse("2027-02-18T06:00:00.000Z"),
    peakMs: Date.parse("2027-02-18T07:00:00.000Z"),
    endMs: Date.parse("2027-02-18T08:00:00.000Z"),
    magnitude: 0.6,
    gamma: null,
    sourceId: "l1",
    year: 2027
  }
];

const CONFIG: FeatureRuntimeConfig = {
  eclipse: {
    sourceLabel: "Test",
    solarEvents: SOLAR_EVENTS,
    lunarEvents: LUNAR_EVENTS
  },
  constellations: {
    entries: [
      {
        name: "Orion",
        code: "Ori",
        segmentCount: 0,
        uniqueStarCount: 0,
        centroidRAHours: 0,
        centroidDecDeg: 0,
        minDecDeg: 0,
        maxDecDeg: 0,
        segments: [
          [[5.5, 4], [5.6, 5]],
          [[5.6, 5], [5.7, 6]]
        ]
      },
      {
        name: "Lyra",
        code: "Lyr",
        segmentCount: 0,
        uniqueStarCount: 0,
        centroidRAHours: 0,
        centroidDecDeg: 0,
        minDecDeg: 0,
        maxDecDeg: 0,
        segments: [
          [[18.7, 35], [18.8, 36]]
        ]
      }
    ]
  },
  routes: {
    countries: [
      { alpha2: "KR", alpha3: "KOR", numeric: "410", name: "Korea", region: "Asia" },
      { alpha2: "US", alpha3: "USA", numeric: "840", name: "United States", region: "Americas" }
    ],
    airports: [
      { icao: "RKSI", iata: "ICN", name: "Incheon", city: "Seoul", countryCode: "KR", latitude: 37.46, longitude: 126.44 },
      { icao: "KLAX", iata: "LAX", name: "Los Angeles", city: "Los Angeles", countryCode: "US", latitude: 33.94, longitude: -118.4 }
    ],
    aircraftTypes: [
      { icaoCode: "B789", iataCode: "789", name: "Boeing 787-9", category: "Widebody" }
    ],
    routes: [
      {
        id: "r1",
        originIcao: "RKSI",
        destinationIcao: "KLAX",
        aircraftTypeCode: "B789",
        callsign: "KE017",
        durationHours: 10.8,
        cruiseSpeedKts: 480,
        cruiseAltitudeFt: 36000
      }
    ]
  }
};

describe("feature runtime - eclipse", () => {
  it("handles kind/year/event/timepoint transitions and preview jump", () => {
    let state = createFeatureRuntime(CONFIG);
    state = reduceDetailAction(state, { type: "eclipse_set_kind", kind: "lunar" });
    expect(state.eclipse.kind).toBe("lunar");
    expect(state.eclipse.availableYears).toContain(2027);

    state = reduceDetailAction(state, { type: "eclipse_set_year", year: 2027 });
    expect(state.eclipse.selectedYear).toBe(2027);
    expect(state.eclipse.eventOptions.length).toBeGreaterThan(0);

    state = reduceDetailAction(state, { type: "eclipse_set_timepoint", timePoint: "end" });
    state = reduceDetailAction(state, { type: "eclipse_preview_selected" });
    expect(state.pendingObservationTimeMs).toBeTypeOf("number");
    expect(state.eclipse.selectedEventUtcTimeLabel).toContain("2027-02-18");
  });
});

describe("feature runtime - constellations/routes/rockets", () => {
  it("updates constellation selection and zodiac label", () => {
    let state = createFeatureRuntime(CONFIG);
    state = reduceDetailAction(state, { type: "constellation_select", name: "Lyra" });
    state = advanceFeatureRuntime(state, 0, {
      observationTimeMs: Date.parse("2026-03-21T00:00:00.000Z"),
      seasonalEclipticAngleRadians: 0
    });
    expect(state.constellations.selectedName).toBe("Lyra");
    expect(state.constellations.zodiacSignLabel.length).toBeGreaterThan(2);
  });

  it("advances route playback with speed and keeps progress in range", () => {
    let state = createFeatureRuntime(CONFIG);
    state = reduceDetailAction(state, { type: "routes_set_speed", speedMultiplier: 12 });
    state = reduceDetailAction(state, { type: "routes_toggle_playback", playing: true });
    state = advanceFeatureRuntime(state, 3, {
      observationTimeMs: Date.parse("2026-03-21T00:00:00.000Z"),
      appActive: true
    });
    expect(state.routes.progressRatio).toBeGreaterThan(0);
    expect(state.routes.progressRatio).toBeLessThanOrEqual(1);
    expect(state.routes.routeProgressLabel).toContain("%");
  });

  it("keeps rocket telemetry schema for both backend configurations", () => {
    const fallbackState = reduceDetailAction(createFeatureRuntime({
      ...CONFIG,
      rockets: { backend: "fallback" }
    }), { type: "rockets_launch" });
    const rapierState = reduceDetailAction(createFeatureRuntime({
      ...CONFIG,
      rockets: { backend: "rapier" }
    }), { type: "rockets_launch" });

    const nextFallback = advanceFeatureRuntime(fallbackState, 2, { observationTimeMs: Date.now(), appActive: true });
    const nextRapier = advanceFeatureRuntime(rapierState, 2, { observationTimeMs: Date.now(), appActive: true });

    expect(typeof nextFallback.rockets.telemetry.altitudeKm).toBe("number");
    expect(typeof nextRapier.rockets.telemetry.altitudeKm).toBe("number");
    expect(Object.keys(nextFallback.rockets.telemetry).sort()).toEqual(Object.keys(nextRapier.rockets.telemetry).sort());
    const snapshot = getDetailSnapshot(nextFallback, "rockets");
    expect(snapshot.rockets.telemetry.statusLabel.length).toBeGreaterThan(0);
  });
});
