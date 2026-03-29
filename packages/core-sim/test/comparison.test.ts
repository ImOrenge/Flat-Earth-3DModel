import { describe, expect, it } from "vitest";
import {
  computeModelComparison,
  DEFAULT_COMPARISON_THRESHOLDS,
  type EclipseEvent,
  type RouteAirport,
  type RouteDefinition,
} from "../src";

const EARTH_RADIUS_KM = 6371;
const KTS_TO_KPH = 1.852;
const DAY_MS = 86_400_000;
const MOON_PHASE_EPOCH_MS = Date.parse("2000-01-06T18:14:00.000Z");
const SYNODIC_MONTH_DAYS = 29.530588853;

function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const lat1Rad = toRadians(lat1);
  const lat2Rad = toRadians(lat2);
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a = (
    (Math.sin(dLat / 2) ** 2) +
    (Math.cos(lat1Rad) * Math.cos(lat2Rad) * (Math.sin(dLon / 2) ** 2))
  );
  return EARTH_RADIUS_KM * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function getMetric(snapshot: ReturnType<typeof computeModelComparison>, category: string) {
  const metric = snapshot.metrics.find((entry) => entry.category === category);
  expect(metric).toBeDefined();
  return metric!;
}

describe("computeModelComparison", () => {
  it("keeps spherical route error low on a known great-circle baseline and flags flat", () => {
    const airports: Record<string, RouteAirport> = {
      TESTA: {
        icao: "TESTA",
        iata: "TA",
        name: "Test A",
        city: "A",
        countryCode: "US",
        latitude: 0,
        longitude: 0,
      },
      TESTB: {
        icao: "TESTB",
        iata: "TB",
        name: "Test B",
        city: "B",
        countryCode: "US",
        latitude: 0,
        longitude: 90,
      },
    };
    const cruiseSpeedKts = 485;
    const speedKph = cruiseSpeedKts * KTS_TO_KPH;
    const sphericalDistanceKm = haversineDistanceKm(0, 0, 0, 90);
    const route: RouteDefinition = {
      id: "great-circle-baseline",
      originIcao: "TESTA",
      destinationIcao: "TESTB",
      aircraftTypeCode: "TEST",
      callsign: "T001",
      durationHours: sphericalDistanceKm / speedKph,
      cruiseSpeedKts,
      cruiseAltitudeFt: 36000,
    };

    const snapshot = computeModelComparison("2026-08-12T11:00:00.000Z", {
      routes: [route],
      airportsByIcao: airports,
      solarEvents: [],
      lunarEvents: [],
    });
    const routesMetric = getMetric(snapshot, "routes");

    expect(routesMetric.sphericalFlag.contradiction).toBe(false);
    expect(routesMetric.flatFlag.contradiction).toBe(true);
    expect(routesMetric.sphericalScore).toBeGreaterThan(routesMetric.flatScore);
    expect(routesMetric.evidence.length).toBeGreaterThan(0);
  });

  it("treats eclipse type mismatch as contradiction even with very loose timing threshold", () => {
    const quarterPhasePeakMs = MOON_PHASE_EPOCH_MS + (SYNODIC_MONTH_DAYS * DAY_MS * 0.25);
    const syntheticSolarEvent: EclipseEvent = {
      id: "synthetic-mismatch",
      kind: "solar",
      type: "total",
      startMs: quarterPhasePeakMs - (30 * 60_000),
      peakMs: quarterPhasePeakMs,
      endMs: quarterPhasePeakMs + (30 * 60_000),
      magnitude: 1.01,
      gamma: null,
      sourceId: "synthetic",
      year: new Date(quarterPhasePeakMs).getUTCFullYear(),
    };

    const snapshot = computeModelComparison(quarterPhasePeakMs, {
      routes: [],
      airportsByIcao: {},
      solarEvents: [syntheticSolarEvent],
      lunarEvents: [],
      thresholds: {
        eclipsePeakMinutes: 1_000_000,
      },
    });
    const eclipseMetric = getMetric(snapshot, "eclipses");

    expect(eclipseMetric.flatFlag.contradiction).toBe(true);
    expect(eclipseMetric.sphericalFlag.contradiction).toBe(true);
    expect(eclipseMetric.flatFlag.observedValue).toBeGreaterThanOrEqual(0);
    expect(eclipseMetric.sphericalFlag.observedValue).toBeGreaterThanOrEqual(0);
  });

  it("applies orbit and rotation threshold overrides deterministically", () => {
    const strictSnapshot = computeModelComparison("2026-06-21T12:00:00.000Z", {
      routes: [],
      airportsByIcao: {},
      solarEvents: [],
      lunarEvents: [],
      thresholds: {
        orbitDeclinationRmseDeg: 0.001,
        orbitDayLengthRmseMinutes: 0.001,
        rotationSpeedMpe: 0.01,
      },
    });
    const strictOrbit = getMetric(strictSnapshot, "orbit");
    const strictRotation = getMetric(strictSnapshot, "rotation");

    expect(strictOrbit.flatFlag.contradiction).toBe(true);
    expect(strictOrbit.sphericalFlag.contradiction).toBe(true);
    expect(strictRotation.flatFlag.contradiction).toBe(true);

    const looseSnapshot = computeModelComparison("2026-06-21T12:00:00.000Z", {
      routes: [],
      airportsByIcao: {},
      solarEvents: [],
      lunarEvents: [],
      thresholds: {
        orbitDeclinationRmseDeg: 9999,
        orbitDayLengthRmseMinutes: 9999,
        rotationSpeedMpe: 1,
      },
    });
    const looseOrbit = getMetric(looseSnapshot, "orbit");
    const looseRotation = getMetric(looseSnapshot, "rotation");

    expect(looseOrbit.flatFlag.contradiction).toBe(false);
    expect(looseOrbit.sphericalFlag.contradiction).toBe(false);
    expect(looseRotation.flatFlag.contradiction).toBe(false);
    expect(looseRotation.sphericalFlag.contradiction).toBe(false);
  });

  it("returns stable schema and category ordering for identical observations", () => {
    const airports: Record<string, RouteAirport> = {
      RKSI: {
        icao: "RKSI",
        iata: "ICN",
        name: "Incheon",
        city: "Seoul",
        countryCode: "KR",
        latitude: 37.46,
        longitude: 126.44,
      },
      KLAX: {
        icao: "KLAX",
        iata: "LAX",
        name: "Los Angeles",
        city: "Los Angeles",
        countryCode: "US",
        latitude: 33.94,
        longitude: -118.4,
      },
    };
    const routes: RouteDefinition[] = [
      {
        id: "r-icn-lax",
        originIcao: "RKSI",
        destinationIcao: "KLAX",
        aircraftTypeCode: "B789",
        callsign: "KE017",
        durationHours: 10.8,
        cruiseSpeedKts: 480,
        cruiseAltitudeFt: 36000,
      },
    ];
    const solarEvents: EclipseEvent[] = [
      {
        id: "solar-2026",
        kind: "solar",
        type: "total",
        startMs: Date.parse("2026-08-12T10:00:00.000Z"),
        peakMs: Date.parse("2026-08-12T11:00:00.000Z"),
        endMs: Date.parse("2026-08-12T12:00:00.000Z"),
        magnitude: 1.01,
        gamma: null,
        sourceId: "t1",
        year: 2026,
      },
    ];
    const lunarEvents: EclipseEvent[] = [
      {
        id: "lunar-2026",
        kind: "lunar",
        type: "partial",
        startMs: Date.parse("2026-09-07T18:00:00.000Z"),
        peakMs: Date.parse("2026-09-07T19:00:00.000Z"),
        endMs: Date.parse("2026-09-07T20:00:00.000Z"),
        magnitude: 0.62,
        gamma: null,
        sourceId: "l1",
        year: 2026,
      },
    ];

    const snapshot = computeModelComparison("2026-08-12T11:00:00.000Z", {
      routes,
      airportsByIcao: airports,
      solarEvents,
      lunarEvents,
    });

    expect(snapshot.metrics.map((metric) => metric.category)).toEqual([
      "routes",
      "eclipses",
      "orbit",
      "rotation",
    ]);
    expect(snapshot.thresholds.routeRelativeError).toBe(DEFAULT_COMPARISON_THRESHOLDS.routeRelativeError);
    expect(snapshot.timestampIso).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(snapshot.flatTotalScore).toBeGreaterThanOrEqual(0);
    expect(snapshot.flatTotalScore).toBeLessThanOrEqual(100);
    expect(snapshot.sphericalTotalScore).toBeGreaterThanOrEqual(0);
    expect(snapshot.sphericalTotalScore).toBeLessThanOrEqual(100);

    for (const metric of snapshot.metrics) {
      expect(metric.flatScore).toBeGreaterThanOrEqual(0);
      expect(metric.flatScore).toBeLessThanOrEqual(100);
      expect(metric.sphericalScore).toBeGreaterThanOrEqual(0);
      expect(metric.sphericalScore).toBeLessThanOrEqual(100);
      expect(Array.isArray(metric.evidence)).toBe(true);
      expect(typeof metric.flatFlag.reason).toBe("string");
      expect(typeof metric.sphericalFlag.reason).toBe("string");
    }
  });
});
