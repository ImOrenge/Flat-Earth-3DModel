const EARTH_RADIUS_KM = 6371;
const DISTANCE_PROFILE_SHORT_KM = 3500;
const DISTANCE_PROFILE_MEDIUM_KM = 9000;

export const ROUTE_MODE_RECOMMENDED = "recommended";
export const ROUTE_MODE_ADVANCED = "advanced";
export const MAX_LAYOVERS = 3;
export const LAYOVER_DWELL_SECONDS = 3;
export const LAYOVER_DWELL_HOURS = LAYOVER_DWELL_SECONDS / 3600;
export const MIN_FINAL_LEG_DISTANCE_KM = 1000;
export const RECOMMENDED_ROUTE_LIMIT = 12;
export const CONTINENT_CODES = Object.freeze(["AMERICAS", "EUROPE", "AFRICA", "ASIA", "OCEANIA"]);
export const REGION_TO_CONTINENT = Object.freeze({
  Americas: "AMERICAS",
  Europe: "EUROPE",
  Africa: "AFRICA",
  Asia: "ASIA",
  Oceania: "OCEANIA"
});
export const CONTINENT_ANCHOR_IATA = Object.freeze({
  AMERICAS: ["SCL", "LAX", "JFK", "DFW", "MIA", "GRU", "LIM"],
  EUROPE: ["LHR", "CDG", "FRA", "AMS", "MAD", "IST"],
  AFRICA: ["JNB", "CAI", "ADD", "NBO", "CMN"],
  ASIA: ["DXB", "DOH", "SIN", "HKG", "ICN", "NRT"],
  OCEANIA: ["SYD", "MEL", "BNE", "PER", "AKL"]
});
export const CONTINENT_HUB_PRIORITY = Object.freeze({
  AMERICAS: ["LAX", "JFK", "DFW", "MIA", "ORD", "ATL", "SCL", "LIM", "GRU"],
  EUROPE: ["LHR", "CDG", "FRA", "AMS", "MAD", "IST"],
  AFRICA: ["JNB", "CAI", "ADD", "NBO", "CMN"],
  ASIA: ["DXB", "DOH", "SIN", "HKG", "ICN", "NRT"],
  OCEANIA: ["SYD", "MEL", "BNE", "PER", "AKL"]
});
export const GLOBAL_HUB_PRIORITY = Object.freeze([
  "LAX", "JFK", "DFW", "MIA",
  "LHR", "CDG", "FRA", "AMS",
  "DXB", "DOH", "SIN", "HKG", "ICN", "NRT",
  "SYD", "MEL", "BNE",
  "JNB", "CAI", "ADD"
]);
export const FLAGSHIP_ROUTE_CONSTRAINTS = Object.freeze([
  {
    originContinent: "AMERICAS",
    destinationContinent: "OCEANIA",
    originIata: "SCL",
    hubIataChain: ["LAX"],
    destinationIata: "SYD"
  },
  {
    originContinent: "OCEANIA",
    destinationContinent: "AMERICAS",
    originIata: "SYD",
    hubIataChain: ["LAX"],
    destinationIata: "SCL"
  }
]);

function toRadians(value) {
  return (Number(value) || 0) * (Math.PI / 180);
}

export function compareText(a, b) {
  return String(a ?? "").localeCompare(String(b ?? ""), undefined, { sensitivity: "base" });
}

export function getContinentLabelKey(continentCode) {
  switch (continentCode) {
    case "AMERICAS":
      return "routeContinentAmericas";
    case "EUROPE":
      return "routeContinentEurope";
    case "AFRICA":
      return "routeContinentAfrica";
    case "ASIA":
      return "routeContinentAsia";
    case "OCEANIA":
      return "routeContinentOceania";
    default:
      return "routeContinentUnknown";
  }
}

export function inferContinentCode(region) {
  return REGION_TO_CONTINENT[String(region ?? "").trim()] ?? "";
}

export function uniqueByIcao(airports) {
  const seen = new Set();
  const result = [];
  for (const airport of (Array.isArray(airports) ? airports : [])) {
    const icao = String(airport?.icao ?? "");
    if (!icao || seen.has(icao)) {
      continue;
    }
    seen.add(icao);
    result.push(airport);
  }
  return result;
}

export function computeGreatCircleDistanceKm(originAirport, destinationAirport) {
  const lat1 = toRadians(originAirport?.latitude);
  const lon1 = toRadians(originAirport?.longitude);
  const lat2 = toRadians(destinationAirport?.latitude);
  const lon2 = toRadians(destinationAirport?.longitude);
  const dLat = lat2 - lat1;
  const dLon = lon2 - lon1;
  const a = (
    (Math.sin(dLat / 2) ** 2)
    + (Math.cos(lat1) * Math.cos(lat2) * (Math.sin(dLon / 2) ** 2))
  );
  return EARTH_RADIUS_KM * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export function resolveDistanceProfile(greatCircleDistanceKm) {
  if (greatCircleDistanceKm <= DISTANCE_PROFILE_SHORT_KM) {
    return {
      aircraftTypeCode: "A21N",
      cruiseSpeedKts: 450,
      cruiseAltitudeFt: 36000,
      blockBufferHours: 0.35
    };
  }

  if (greatCircleDistanceKm <= DISTANCE_PROFILE_MEDIUM_KM) {
    return {
      aircraftTypeCode: "B789",
      cruiseSpeedKts: 485,
      cruiseAltitudeFt: 38000,
      blockBufferHours: 0.55
    };
  }

  return {
    aircraftTypeCode: "B77W",
    cruiseSpeedKts: 490,
    cruiseAltitudeFt: 39000,
    blockBufferHours: 0.85
  };
}

export function createLeg(originAirport, destinationAirport, index, { aircraftTypeByCode } = {}) {
  const greatCircleDistanceKm = computeGreatCircleDistanceKm(originAirport, destinationAirport);
  const distanceProfile = resolveDistanceProfile(greatCircleDistanceKm);
  const durationHours = (
    greatCircleDistanceKm / (distanceProfile.cruiseSpeedKts * 1.852)
  ) + distanceProfile.blockBufferHours;

  return {
    id: `${originAirport.icao.toLowerCase()}-${destinationAirport.icao.toLowerCase()}-${index + 1}`,
    index,
    origin: originAirport,
    destination: destinationAirport,
    aircraftTypeCode: distanceProfile.aircraftTypeCode,
    aircraftType: aircraftTypeByCode?.get(distanceProfile.aircraftTypeCode) ?? null,
    cruiseAltitudeFt: distanceProfile.cruiseAltitudeFt,
    cruiseSpeedKts: distanceProfile.cruiseSpeedKts,
    durationHours,
    greatCircleDistanceKm
  };
}

export function buildRouteFromWaypoints(
  waypoints,
  {
    idPrefix = "route",
    routeMode = ROUTE_MODE_ADVANCED,
    aircraftTypeByCode = new Map(),
    resolveCountryName = (countryCode) => countryCode,
    resolveCountryCentroid = () => null
  } = {}
) {
  const resolvedWaypoints = (Array.isArray(waypoints) ? waypoints : []).filter(Boolean);
  if (resolvedWaypoints.length < 2) {
    return null;
  }

  const legs = [];
  let totalDistanceKm = 0;
  let totalFlightHours = 0;

  for (let index = 0; index < resolvedWaypoints.length - 1; index += 1) {
    const leg = createLeg(resolvedWaypoints[index], resolvedWaypoints[index + 1], index, { aircraftTypeByCode });
    legs.push(leg);
    totalDistanceKm += leg.greatCircleDistanceKm;
    totalFlightHours += leg.durationHours;
  }

  if (legs.length === 0) {
    return null;
  }

  const layoverCount = Math.max(resolvedWaypoints.length - 2, 0);
  const layoverDurationHours = layoverCount * LAYOVER_DWELL_HOURS;
  const totalDurationHours = totalFlightHours + layoverDurationHours;
  const primaryLeg = legs.reduce((best, leg) => (
    !best || leg.greatCircleDistanceKm > best.greatCircleDistanceKm ? leg : best
  ), null);

  const origin = resolvedWaypoints[0];
  const destination = resolvedWaypoints[resolvedWaypoints.length - 1];
  const waypointCodeChain = resolvedWaypoints.map((airport) => airport.iata.toLowerCase()).join("-");

  return {
    id: `${idPrefix}-${waypointCodeChain}`,
    routeMode,
    origin,
    destination,
    waypoints: resolvedWaypoints,
    legs,
    layovers: resolvedWaypoints.slice(1, -1),
    totals: {
      greatCircleDistanceKm: totalDistanceKm,
      flightDurationHours: totalFlightHours,
      layoverDurationHours,
      durationHours: totalDurationHours,
      layoverCount
    },
    aircraftTypeCode: primaryLeg?.aircraftTypeCode ?? "",
    aircraftType: primaryLeg?.aircraftType ?? null,
    cruiseAltitudeFt: primaryLeg?.cruiseAltitudeFt ?? 0,
    cruiseSpeedKts: primaryLeg?.cruiseSpeedKts ?? 0,
    durationHours: totalDurationHours,
    greatCircleDistanceKm: totalDistanceKm,
    originCountryName: resolveCountryName(origin.countryCode),
    destinationCountryName: resolveCountryName(destination.countryCode),
    originCountryCentroid: resolveCountryCentroid(origin.countryCode, origin),
    destinationCountryCentroid: resolveCountryCentroid(destination.countryCode, destination)
  };
}

function getPriorityIndex(priorityList, code, fallback = 40) {
  const index = (Array.isArray(priorityList) ? priorityList : []).indexOf(code);
  return index === -1 ? fallback : index;
}

export function computeHubPenalty(
  route,
  {
    originContinentCode,
    destinationContinentCode,
    getAirportContinentCode
  }
) {
  let penalty = 0;
  for (const layover of (route?.layovers ?? [])) {
    const iata = layover.iata;
    const layoverContinent = getAirportContinentCode(layover);
    penalty += getPriorityIndex(GLOBAL_HUB_PRIORITY, iata, 18) * 22;

    if (layoverContinent === originContinentCode) {
      penalty += getPriorityIndex(CONTINENT_HUB_PRIORITY[originContinentCode] ?? [], iata, 12) * 16;
    } else if (layoverContinent === destinationContinentCode) {
      penalty += getPriorityIndex(CONTINENT_HUB_PRIORITY[destinationContinentCode] ?? [], iata, 12) * 16;
    } else {
      penalty += getPriorityIndex(CONTINENT_HUB_PRIORITY[layoverContinent] ?? [], iata, 12) * 10;
    }
  }
  return penalty;
}

export function isLayoverTooCloseToDestination(route, minFinalLegDistanceKm = MIN_FINAL_LEG_DISTANCE_KM) {
  const layoverCount = route?.totals?.layoverCount ?? 0;
  if (layoverCount <= 0) {
    return false;
  }
  const legs = Array.isArray(route?.legs) ? route.legs : [];
  if (legs.length === 0) {
    return false;
  }
  const finalLegDistanceKm = legs[legs.length - 1]?.greatCircleDistanceKm ?? 0;
  return finalLegDistanceKm <= minFinalLegDistanceKm;
}

export function isLayoverTooCloseToOrigin(route, minFirstLegDistanceKm = MIN_FINAL_LEG_DISTANCE_KM) {
  const layoverCount = route?.totals?.layoverCount ?? 0;
  if (layoverCount <= 0) {
    return false;
  }
  const legs = Array.isArray(route?.legs) ? route.legs : [];
  if (legs.length === 0) {
    return false;
  }
  const firstLegDistanceKm = legs[0]?.greatCircleDistanceKm ?? 0;
  return firstLegDistanceKm <= minFirstLegDistanceKm;
}

export function isLayoverTooCloseToEndpoints(route, minLegDistanceKm = MIN_FINAL_LEG_DISTANCE_KM) {
  return isLayoverTooCloseToOrigin(route, minLegDistanceKm)
    || isLayoverTooCloseToDestination(route, minLegDistanceKm);
}

export function buildRecommendedRoutesForPair({
  originContinentCode,
  destinationContinentCode,
  getPreferredAirportsForContinent,
  getHubAirportsForContinent,
  getAirportContinentCode,
  airportByIata,
  resolveCountryName,
  resolveCountryCentroid,
  aircraftTypeByCode,
  routeLimit = RECOMMENDED_ROUTE_LIMIT,
  maxLayovers = MAX_LAYOVERS,
  minFinalLegDistanceKm = MIN_FINAL_LEG_DISTANCE_KM
} = {}) {
  if (!originContinentCode || !destinationContinentCode || originContinentCode === destinationContinentCode) {
    return [];
  }

  const originCandidates = (getPreferredAirportsForContinent?.(originContinentCode, 4) ?? []).filter(Boolean);
  const destinationCandidates = (getPreferredAirportsForContinent?.(destinationContinentCode, 4) ?? []).filter(Boolean);
  if (originCandidates.length === 0 || destinationCandidates.length === 0) {
    return [];
  }

  const oneStopHubs = uniqueByIcao([
    ...(getHubAirportsForContinent?.(originContinentCode, 8) ?? []),
    ...(getHubAirportsForContinent?.(destinationContinentCode, 8) ?? []),
    ...GLOBAL_HUB_PRIORITY.map((iata) => airportByIata?.get(iata)).filter(Boolean)
  ]);

  const originHubs = (getHubAirportsForContinent?.(originContinentCode, 4) ?? []).filter(Boolean);
  const destinationHubs = (getHubAirportsForContinent?.(destinationContinentCode, 4) ?? []).filter(Boolean);
  const middleHubs = uniqueByIcao(
    GLOBAL_HUB_PRIORITY.map((iata) => airportByIata?.get(iata)).filter(Boolean)
  ).slice(0, 4);

  const candidates = new Map();

  function addCandidate(waypoints, scoreBias = 0) {
    if (!Array.isArray(waypoints) || waypoints.length < 2) {
      return;
    }

    const routeWaypoints = waypoints.filter(Boolean);
    if (routeWaypoints.length < 2 || routeWaypoints.length - 2 > maxLayovers) {
      return;
    }

    for (let index = 1; index < routeWaypoints.length; index += 1) {
      if (routeWaypoints[index - 1].icao === routeWaypoints[index].icao) {
        return;
      }
    }

    const builtRoute = buildRouteFromWaypoints(routeWaypoints, {
      idPrefix: `recommended-${originContinentCode.toLowerCase()}-${destinationContinentCode.toLowerCase()}`,
      routeMode: ROUTE_MODE_RECOMMENDED,
      aircraftTypeByCode,
      resolveCountryName,
      resolveCountryCentroid
    });
    if (!builtRoute || isLayoverTooCloseToEndpoints(builtRoute, minFinalLegDistanceKm)) {
      return;
    }

    const hubPenalty = computeHubPenalty(builtRoute, {
      originContinentCode,
      destinationContinentCode,
      getAirportContinentCode
    });
    const legStretchPenalty = builtRoute.legs.reduce(
      (sum, leg) => sum + Math.max(0, leg.greatCircleDistanceKm - 12000) * 0.08,
      0
    );
    const score = builtRoute.totals.greatCircleDistanceKm
      + (builtRoute.totals.layoverCount * 900)
      + hubPenalty
      + legStretchPenalty
      + scoreBias;

    const signature = routeWaypoints.map((airport) => airport.iata).join("-");
    const previous = candidates.get(signature);
    if (!previous || score < previous.score) {
      candidates.set(signature, { route: builtRoute, score });
    }
  }

  for (const constraint of FLAGSHIP_ROUTE_CONSTRAINTS) {
    if (
      constraint.originContinent !== originContinentCode
      || constraint.destinationContinent !== destinationContinentCode
    ) {
      continue;
    }
    const airports = [
      airportByIata?.get(constraint.originIata),
      ...(constraint.hubIataChain ?? []).map((iata) => airportByIata?.get(iata)),
      airportByIata?.get(constraint.destinationIata)
    ];
    if (airports.every(Boolean)) {
      addCandidate(airports, -6000);
    }
  }

  for (const originAirport of originCandidates.slice(0, 3)) {
    for (const destinationAirport of destinationCandidates.slice(0, 3)) {
      addCandidate([originAirport, destinationAirport], 2200);

      for (const hubAirport of oneStopHubs.slice(0, 12)) {
        addCandidate([originAirport, hubAirport, destinationAirport], 360);
      }

      for (const firstHub of originHubs.slice(0, 3)) {
        for (const secondHub of destinationHubs.slice(0, 3)) {
          if (firstHub.icao === secondHub.icao) {
            continue;
          }
          addCandidate([originAirport, firstHub, secondHub, destinationAirport], 80);
        }
      }

      for (const firstHub of originHubs.slice(0, 2)) {
        for (const middleHub of middleHubs.slice(0, 3)) {
          for (const secondHub of destinationHubs.slice(0, 2)) {
            if (
              firstHub.icao === middleHub.icao
              || secondHub.icao === middleHub.icao
              || firstHub.icao === secondHub.icao
            ) {
              continue;
            }
            addCandidate([originAirport, firstHub, middleHub, secondHub, destinationAirport], 120);
          }
        }
      }
    }
  }

  const recommendedRoutes = Array.from(candidates.values())
    .sort((left, right) => (
      left.score - right.score
      || left.route.totals.layoverCount - right.route.totals.layoverCount
      || left.route.totals.greatCircleDistanceKm - right.route.totals.greatCircleDistanceKm
    ))
    .slice(0, routeLimit)
    .map((entry, index) => ({
      ...entry.route,
      id: `recommended-${originContinentCode.toLowerCase()}-${destinationContinentCode.toLowerCase()}-${String(index + 1).padStart(2, "0")}-${entry.route.waypoints.map((airport) => airport.iata.toLowerCase()).join("-")}`,
      recommendationScore: entry.score
    }));

  for (const constraint of FLAGSHIP_ROUTE_CONSTRAINTS) {
    if (
      constraint.originContinent !== originContinentCode
      || constraint.destinationContinent !== destinationContinentCode
    ) {
      continue;
    }

    const flagshipIataChain = [
      constraint.originIata,
      ...(constraint.hubIataChain ?? []),
      constraint.destinationIata
    ];
    const flagshipSignature = flagshipIataChain.map((iata) => iata.toLowerCase()).join("-");
    const alreadyIncluded = recommendedRoutes.some((route) => (
      route.waypoints.map((airport) => airport.iata.toLowerCase()).join("-") === flagshipSignature
    ));
    if (alreadyIncluded) {
      continue;
    }

    const flagshipAirports = flagshipIataChain.map((iata) => airportByIata?.get(iata)).filter(Boolean);
    if (flagshipAirports.length !== flagshipIataChain.length) {
      continue;
    }

    const flagshipRoute = buildRouteFromWaypoints(flagshipAirports, {
      idPrefix: `recommended-${originContinentCode.toLowerCase()}-${destinationContinentCode.toLowerCase()}-flagship`,
      routeMode: ROUTE_MODE_RECOMMENDED,
      aircraftTypeByCode,
      resolveCountryName,
      resolveCountryCentroid
    });
    if (!flagshipRoute || isLayoverTooCloseToEndpoints(flagshipRoute, minFinalLegDistanceKm)) {
      continue;
    }

    recommendedRoutes.unshift({
      ...flagshipRoute,
      id: `recommended-${originContinentCode.toLowerCase()}-${destinationContinentCode.toLowerCase()}-00-${flagshipSignature}`,
      recommendationScore: Number.NEGATIVE_INFINITY
    });
    if (recommendedRoutes.length > routeLimit) {
      recommendedRoutes.length = routeLimit;
    }
  }

  return recommendedRoutes;
}
