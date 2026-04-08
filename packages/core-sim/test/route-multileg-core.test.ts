import { describe, expect, it } from "vitest";
import {
  DEFAULT_DISTANCE_PROFILE_TUNING,
  LAYOVER_DWELL_HOURS,
  buildRecommendedRoutesForPair,
  buildRouteFromWaypoints,
  resolveDistanceProfile,
} from "../../../modules/route-multileg-core.js";

type TestAirport = {
  icao: string;
  iata: string;
  name: string;
  city: string;
  countryCode: string;
  latitude: number;
  longitude: number;
};

function createAirport(
  icao: string,
  iata: string,
  countryCode: string,
  latitude: number,
  longitude: number,
): TestAirport {
  return {
    icao,
    iata,
    name: iata,
    city: iata,
    countryCode,
    latitude,
    longitude,
  };
}

describe("route-multileg-core heuristics", () => {
  it("applies distance profile tuning overrides deterministically", () => {
    const baseline = resolveDistanceProfile(5000);
    expect(baseline.aircraftTypeCode).toBe("B789");
    expect(baseline.blockBufferHours).toBe(DEFAULT_DISTANCE_PROFILE_TUNING.mediumBufferHours);

    const tunedShort = resolveDistanceProfile(5000, {
      shortDistanceKm: 6000,
      shortBufferHours: 1.25,
    });
    expect(tunedShort.aircraftTypeCode).toBe("A21N");
    expect(tunedShort.blockBufferHours).toBe(1.25);

    const tunedLong = resolveDistanceProfile(12000, {
      mediumDistanceKm: 11000,
      longBufferHours: 1.4,
    });
    expect(tunedLong.aircraftTypeCode).toBe("B77W");
    expect(tunedLong.blockBufferHours).toBe(1.4);
  });

  it("keeps layover dwell timing stable while using tuned leg buffers", () => {
    const lax = createAirport("KLAX", "LAX", "US", 33.9425, -118.4081);
    const sfo = createAirport("KSFO", "SFO", "US", 37.6213, -122.3790);
    const sea = createAirport("KSEA", "SEA", "US", 47.4502, -122.3088);

    const route = buildRouteFromWaypoints([lax, sfo, sea], {
      distanceProfileTuning: {
        shortBufferHours: 1.1,
        mediumBufferHours: 1.1,
        longBufferHours: 1.1,
      },
    });
    expect(route).not.toBeNull();
    expect(route?.totals.layoverCount).toBe(1);
    expect(route?.totals.layoverDurationHours).toBeCloseTo(LAYOVER_DWELL_HOURS, 8);
    expect(route?.legs.every((leg) => leg.durationHours > 1.09)).toBe(true);
  });

  it("retains flagship route preference for Americas-Oceania pair", () => {
    const scl = createAirport("SCEL", "SCL", "CL", -33.3930, -70.7858);
    const lax = createAirport("KLAX", "LAX", "US", 33.9425, -118.4081);
    const jfk = createAirport("KJFK", "JFK", "US", 40.6413, -73.7781);
    const syd = createAirport("YSSY", "SYD", "AU", -33.9461, 151.1772);

    const continentByCountry: Record<string, string> = {
      CL: "AMERICAS",
      US: "AMERICAS",
      AU: "OCEANIA",
    };

    const airportsByContinent: Record<string, TestAirport[]> = {
      AMERICAS: [scl, lax, jfk],
      OCEANIA: [syd],
    };

    const airportByIata = new Map<string, TestAirport>([
      [scl.iata, scl],
      [lax.iata, lax],
      [jfk.iata, jfk],
      [syd.iata, syd],
    ]);

    const routes = buildRecommendedRoutesForPair({
      originContinentCode: "AMERICAS",
      destinationContinentCode: "OCEANIA",
      getPreferredAirportsForContinent: (continent: string) => airportsByContinent[continent] ?? [],
      getHubAirportsForContinent: (continent: string) => airportsByContinent[continent] ?? [],
      getAirportContinentCode: (airport: TestAirport) => continentByCountry[airport.countryCode] ?? "",
      airportByIata,
      resolveCountryName: (countryCode: string) => countryCode,
      resolveCountryCentroid: () => null,
      routeLimit: 6,
      maxLayovers: 3,
      minFinalLegDistanceKm: 1000,
    });

    expect(routes.length).toBeGreaterThan(0);
    expect(routes[0]?.waypoints.map((airport) => airport.iata).join("-")).toBe("SCL-LAX-SYD");
    expect(Number.isFinite(routes[0]?.recommendationScore ?? Number.NaN)).toBe(true);
  });
});
