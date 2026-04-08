import * as THREE from "../../vendor/three.module.js";
import * as geoUtils from "./geo-utils.js?v=20260406-globeposfix1";
import { buildRecommendedRoutesForPair as buildRecommendedRoutesForPairCore } from "../../modules/route-multileg-core.js?v=20260406-legrelax1";
import { createRouteDataService } from "./route-data-service.js?v=20260406-remotesync1";

const {
  createGlobeModelFrame,
  formatGeoPair,
  getGlobeNormalFromGeo,
  getGlobePositionFromGeo
} = geoUtils;

const tempFallbackNormal = new THREE.Vector3();
const tempFallbackQuaternion = new THREE.Quaternion();

function resolveFrameAndCenter(centerOrFrame, frameOverride) {
  const isFrameObject = (value) => Boolean(
    value &&
    typeof value === "object" &&
    value.center &&
    value.rotation
  );
  const frame = isFrameObject(frameOverride)
    ? frameOverride
    : (isFrameObject(centerOrFrame) ? centerOrFrame : null);
  const centerCandidate = frame
    ? (
      Number.isFinite(centerOrFrame?.x) &&
      Number.isFinite(centerOrFrame?.y) &&
      Number.isFinite(centerOrFrame?.z)
        ? centerOrFrame
        : frame.center
    )
    : centerOrFrame;
  return {
    center: {
      x: Number.isFinite(centerCandidate?.x) ? centerCandidate.x : 0,
      y: Number.isFinite(centerCandidate?.y) ? centerCandidate.y : 0,
      z: Number.isFinite(centerCandidate?.z) ? centerCandidate.z : 0
    },
    frame
  };
}

const getGlobePositionFromNormal = typeof geoUtils.getGlobePositionFromNormal === "function"
  ? geoUtils.getGlobePositionFromNormal
  : function getGlobePositionFromNormalFallback(
    normal,
    globeRadius,
    centerOrFrame,
    frameOverride = null
  ) {
    const { center, frame } = resolveFrameAndCenter(centerOrFrame, frameOverride);
    const radius = Number.isFinite(globeRadius)
      ? Math.max(globeRadius, 0.0001)
      : Math.max(frame?.radius ?? 1, 0.0001);

    tempFallbackNormal.set(
      Number.isFinite(normal?.x) ? normal.x : 0,
      Number.isFinite(normal?.y) ? normal.y : 1,
      Number.isFinite(normal?.z) ? normal.z : 0
    );
    if (tempFallbackNormal.lengthSq() < 1e-12) {
      tempFallbackNormal.set(0, 1, 0);
    }
    tempFallbackNormal.normalize();

    if (frame?.rotation && typeof frame.rotation === "object") {
      tempFallbackQuaternion.set(
        Number.isFinite(frame.rotation.x) ? frame.rotation.x : 0,
        Number.isFinite(frame.rotation.y) ? frame.rotation.y : 0,
        Number.isFinite(frame.rotation.z) ? frame.rotation.z : 0,
        Number.isFinite(frame.rotation.w) ? frame.rotation.w : 1
      ).normalize();
      tempFallbackNormal.applyQuaternion(tempFallbackQuaternion);
    }

    return {
      x: center.x + (tempFallbackNormal.x * radius),
      y: center.y + (tempFallbackNormal.y * radius),
      z: center.z + (tempFallbackNormal.z * radius)
    };
  };

const BASE_ROUTE_CYCLE_SECONDS = 120;
const EARTH_RADIUS_KM = 6371;
const ROUTE_SEGMENTS = 128;
const ROUTE_MARKER_STEP = 8;
const ROUTE_ALTITUDE_VISUAL_BOOST = 8;
const ROUTE_ALTITUDE_MIN_RATIO = 0.006;
const ROUTE_ALTITUDE_MAX_RATIO = 0.12;
const ROUTE_MARKER_SURFACE_RATIO = 0.005;
const COUNTRY_MARKER_SURFACE_RATIO = 0.0026;
const GREAT_CIRCLE_EPSILON = 1e-6;
const GREAT_CIRCLE_ANTIPODAL_THRESHOLD = -0.9995;
const DISTANCE_PROFILE_SHORT_KM = 3500;
const DISTANCE_PROFILE_MEDIUM_KM = 9000;
const COUNTRY_MARKER_BASE_NORMAL = new THREE.Vector3(0, 0, 1);
const DATA_SOURCE_BUNDLED = "bundled";
const DATA_SOURCE_CACHED = "cached";
const DATA_SOURCE_LIVE_API = "live_api";
const ROUTE_MODE_RECOMMENDED = "recommended";
const ROUTE_MODE_ADVANCED = "advanced";
const MAX_LAYOVERS = 3;
const LAYOVER_DWELL_SECONDS = 3;
const LAYOVER_DWELL_HOURS = LAYOVER_DWELL_SECONDS / 3600;
const MIN_FINAL_LEG_DISTANCE_KM = 1000;
const RECOMMENDED_ROUTE_LIMIT = 12;
const CONTINENT_CODES = Object.freeze(["AMERICAS", "EUROPE", "AFRICA", "ASIA", "OCEANIA"]);
const REGION_TO_CONTINENT = Object.freeze({
  Americas: "AMERICAS",
  Europe: "EUROPE",
  Africa: "AFRICA",
  Asia: "ASIA",
  Oceania: "OCEANIA"
});
const CONTINENT_ANCHOR_IATA = Object.freeze({
  AMERICAS: ["SCL", "LAX", "JFK", "DFW", "MIA", "GRU", "LIM"],
  EUROPE: ["LHR", "CDG", "FRA", "AMS", "MAD", "IST"],
  AFRICA: ["JNB", "CAI", "ADD", "NBO", "CMN"],
  ASIA: ["DXB", "DOH", "SIN", "HKG", "ICN", "NRT"],
  OCEANIA: ["SYD", "MEL", "BNE", "PER", "AKL"]
});
const CONTINENT_HUB_PRIORITY = Object.freeze({
  AMERICAS: ["LAX", "JFK", "DFW", "MIA", "ORD", "ATL", "SCL", "LIM", "GRU"],
  EUROPE: ["LHR", "CDG", "FRA", "AMS", "MAD", "IST"],
  AFRICA: ["JNB", "CAI", "ADD", "NBO", "CMN"],
  ASIA: ["DXB", "DOH", "SIN", "HKG", "ICN", "NRT"],
  OCEANIA: ["SYD", "MEL", "BNE", "PER", "AKL"]
});
const SOUTH_AMERICA_COUNTRY_CODES = Object.freeze(new Set([
  "AR", "BO", "BR", "CL", "CO", "EC", "FK", "GF", "GY", "PE", "PY", "SR", "UY", "VE"
]));
const NORTH_AMERICA_COUNTRY_CODES = Object.freeze(new Set([
  "AG", "AI", "AW", "BB", "BL", "BM", "BQ", "BS", "BZ", "CA", "CR", "CU", "CW", "DM",
  "DO", "GD", "GL", "GP", "GT", "HN", "HT", "JM", "KN", "KY", "LC", "MF", "MQ", "MS",
  "MX", "NI", "PA", "PM", "PR", "SV", "SX", "TC", "TT", "US", "VC", "VG", "VI"
]));
const GLOBAL_HUB_PRIORITY = Object.freeze([
  "LAX", "JFK", "DFW", "MIA",
  "LHR", "CDG", "FRA", "AMS",
  "DXB", "DOH", "SIN", "HKG", "ICN", "NRT",
  "SYD", "MEL", "BNE",
  "JNB", "CAI", "ADD"
]);
const FLAGSHIP_ROUTE_CONSTRAINTS = Object.freeze([
  {
    originContinent: "AMERICAS",
    destinationContinent: "OCEANIA",
    originIata: "SCL",
    hubIataChain: ["NRT"],
    destinationIata: "SYD"
  },
  {
    originContinent: "OCEANIA",
    destinationContinent: "AMERICAS",
    originIata: "SYD",
    hubIataChain: ["NRT"],
    destinationIata: "SCL"
  },
  {
    originContinent: "AMERICAS",
    destinationContinent: "ASIA",
    originIata: "LAX",
    hubIataChain: ["AMS"],
    destinationIata: "ICN"
  },
  {
    originContinent: "ASIA",
    destinationContinent: "AMERICAS",
    originIata: "ICN",
    hubIataChain: ["AMS"],
    destinationIata: "LAX"
  },
  {
    originContinent: "EUROPE",
    destinationContinent: "OCEANIA",
    originIata: "LHR",
    hubIataChain: ["SIN"],
    destinationIata: "SYD"
  },
  {
    originContinent: "OCEANIA",
    destinationContinent: "EUROPE",
    originIata: "SYD",
    hubIataChain: ["SIN"],
    destinationIata: "LHR"
  },
  {
    originContinent: "EUROPE",
    destinationContinent: "AFRICA",
    originIata: "CDG",
    hubIataChain: ["DXB"],
    destinationIata: "JNB"
  },
  {
    originContinent: "AFRICA",
    destinationContinent: "EUROPE",
    originIata: "JNB",
    hubIataChain: ["DXB"],
    destinationIata: "CDG"
  },
  {
    originContinent: "ASIA",
    destinationContinent: "OCEANIA",
    originIata: "ICN",
    hubIataChain: ["LAX"],
    destinationIata: "SYD"
  },
  {
    originContinent: "OCEANIA",
    destinationContinent: "ASIA",
    originIata: "SYD",
    hubIataChain: ["LAX"],
    destinationIata: "ICN"
  }
]);

function formatDurationHours(hours, i18n) {
  const totalMinutes = Math.max(0, Math.round(hours * 60));
  const wholeHours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (wholeHours === 0) {
    return i18n.t("durationMinutesOnly", { minutes });
  }
  if (minutes === 0) {
    return i18n.t("durationHoursOnly", { hours: wholeHours });
  }
  return i18n.t("durationHoursMinutes", { hours: wholeHours, minutes });
}

function formatDistanceKm(distanceKm) {
  return `${Math.round(distanceKm).toLocaleString()} km`;
}

function createAirportLabel(airport) {
  return `${airport.iata} / ${airport.icao} | ${airport.city}`;
}

function createAircraftModel(scaleDimension) {
  const aircraft = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({
    color: 0xf4fbff,
    emissive: 0x67c3ff,
    emissiveIntensity: 0.35,
    roughness: 0.32,
    metalness: 0.18,
    depthWrite: false
  });

  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(scaleDimension(0.028), scaleDimension(0.15), 4, 10),
    material
  );
  body.rotation.x = -Math.PI / 2;
  aircraft.add(body);

  const nose = new THREE.Mesh(
    new THREE.ConeGeometry(scaleDimension(0.03), scaleDimension(0.085), 18),
    material
  );
  nose.rotation.x = -Math.PI / 2;
  nose.position.z = scaleDimension(-0.11);
  aircraft.add(nose);

  const wing = new THREE.Mesh(
    new THREE.BoxGeometry(scaleDimension(0.19), scaleDimension(0.01), scaleDimension(0.042)),
    material
  );
  wing.position.z = scaleDimension(-0.005);
  aircraft.add(wing);

  const tailWing = new THREE.Mesh(
    new THREE.BoxGeometry(scaleDimension(0.08), scaleDimension(0.008), scaleDimension(0.025)),
    material
  );
  tailWing.position.set(0, scaleDimension(0.028), scaleDimension(0.08));
  aircraft.add(tailWing);

  const trailGlow = new THREE.Mesh(
    new THREE.SphereGeometry(scaleDimension(0.06), 18, 14),
    new THREE.MeshBasicMaterial({
      color: 0x86d6ff,
      transparent: true,
      opacity: 0.22,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  );
  aircraft.add(trailGlow);

  return aircraft;
}

function createCountryHalo(scaleDimension, { color, innerRadius, outerRadius, coreRadius }) {
  const marker = new THREE.Group();

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(scaleDimension(innerRadius), scaleDimension(outerRadius), 48),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide,
      depthTest: true,
      depthWrite: false
    })
  );
  marker.add(ring);

  const glow = new THREE.Mesh(
    new THREE.CircleGeometry(scaleDimension(innerRadius * 0.72), 36),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.12,
      side: THREE.DoubleSide,
      depthTest: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  );
  marker.add(glow);

  const core = new THREE.Mesh(
    new THREE.SphereGeometry(scaleDimension(coreRadius), 18, 14),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.95,
      depthTest: true,
      depthWrite: false
    })
  );
  core.position.z = scaleDimension(0.0025);
  marker.add(core);

  marker.visible = false;
  return marker;
}

function createSampledPath(points) {
  const safePoints = points.map((point) => point.clone());
  const tempDelta = new THREE.Vector3();

  function getSegmentPositionAt(t) {
    if (safePoints.length === 0) {
      return { index: 0, alpha: 0 };
    }

    const scaled = THREE.MathUtils.clamp(t, 0, 1) * Math.max(safePoints.length - 1, 0);
    const index = Math.min(Math.floor(scaled), Math.max(safePoints.length - 2, 0));
    return {
      index,
      alpha: scaled - index
    };
  }

  return {
    points: safePoints,
    getPointAt(t, target = new THREE.Vector3()) {
      if (safePoints.length === 0) {
        return target.set(0, 0, 0);
      }
      if (safePoints.length === 1) {
        return target.copy(safePoints[0]);
      }

      const { index, alpha } = getSegmentPositionAt(t);
      return target.copy(safePoints[index]).lerp(safePoints[index + 1], alpha);
    },
    getTangentAt(t, target = new THREE.Vector3()) {
      if (safePoints.length < 2) {
        return target.set(0, 1, 0);
      }

      const { index } = getSegmentPositionAt(t);
      tempDelta.copy(safePoints[Math.min(index + 1, safePoints.length - 1)]).sub(safePoints[Math.max(index, 0)]);
      if (tempDelta.lengthSq() < 1e-8) {
        return target.set(0, 1, 0);
      }
      return target.copy(tempDelta).normalize();
    }
  };
}

function compareText(a, b) {
  return String(a ?? "").localeCompare(String(b ?? ""), undefined, { sensitivity: "base" });
}

function getSourceLabelKey(source) {
  if (source === DATA_SOURCE_LIVE_API) {
    return "routeDataSourceLiveApi";
  }
  if (source === DATA_SOURCE_CACHED) {
    return "routeDataSourceCached";
  }
  return "routeDataSourceBundled";
}

function getContinentLabelKey(continentCode) {
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

function inferContinentCode(region) {
  return REGION_TO_CONTINENT[String(region ?? "").trim()] ?? "";
}

function uniqueByIcao(airports) {
  const seen = new Set();
  const result = [];
  for (const airport of airports) {
    if (!airport || seen.has(airport.icao)) {
      continue;
    }
    seen.add(airport.icao);
    result.push(airport);
  }
  return result;
}

export function createRouteSimulationController({
  constants,
  globeCenter,
  globeSurface,
  globeRadius,
  i18n,
  routeStage,
  ui
}) {
  const scaleDimension = (value) => value * (constants.MODEL_SCALE ?? 1);
  const routeFrame = createGlobeModelFrame(globeSurface, { space: "self" });
  const routeCenter = new THREE.Vector3(routeFrame.center.x, routeFrame.center.y, routeFrame.center.z);
  const routeModelRadius = Number.isFinite(globeRadius) ? globeRadius : routeFrame.radius;
  const airportSurfaceOffset = Math.max(scaleDimension(0.018), routeModelRadius * ROUTE_MARKER_SURFACE_RATIO);
  const countrySurfaceOffset = Math.max(scaleDimension(0.01), routeModelRadius * COUNTRY_MARKER_SURFACE_RATIO);

  const routeLayer = new THREE.Group();
  routeLayer.visible = false;
  routeStage.add(routeLayer);

  const routePath = new THREE.Line(
    new THREE.BufferGeometry(),
    new THREE.LineBasicMaterial({
      color: 0x8dd5ff,
      transparent: true,
      opacity: 0.95,
      depthTest: true,
      depthWrite: false
    })
  );
  routeLayer.add(routePath);

  const routePathPoints = new THREE.Points(
    new THREE.BufferGeometry(),
    new THREE.PointsMaterial({
      color: 0xeefaff,
      size: scaleDimension(0.05),
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.82,
      depthTest: true,
      depthWrite: false
    })
  );
  routeLayer.add(routePathPoints);

  const originCountryMarker = createCountryHalo(scaleDimension, {
    color: 0x8dffbc,
    innerRadius: 0.085,
    outerRadius: 0.118,
    coreRadius: 0.016
  });
  routeLayer.add(originCountryMarker);

  const destinationCountryMarker = createCountryHalo(scaleDimension, {
    color: 0xffc882,
    innerRadius: 0.118,
    outerRadius: 0.154,
    coreRadius: 0.018
  });
  routeLayer.add(destinationCountryMarker);

  const originMarker = new THREE.Mesh(
    new THREE.SphereGeometry(scaleDimension(0.055), 20, 16),
    new THREE.MeshStandardMaterial({
      color: 0x8dffbc,
      emissive: 0x4fcf84,
      emissiveIntensity: 0.8,
      roughness: 0.25,
      metalness: 0.06,
      depthWrite: false
    })
  );
  originMarker.visible = false;
  routeLayer.add(originMarker);

  const destinationMarker = new THREE.Mesh(
    new THREE.SphereGeometry(scaleDimension(0.055), 20, 16),
    new THREE.MeshStandardMaterial({
      color: 0xffc882,
      emissive: 0xffa44d,
      emissiveIntensity: 0.85,
      roughness: 0.24,
      metalness: 0.06,
      depthWrite: false
    })
  );
  destinationMarker.visible = false;
  routeLayer.add(destinationMarker);

  const aircraft = createAircraftModel(scaleDimension);
  aircraft.visible = false;
  routeLayer.add(aircraft);

  const layoverMarkers = Array.from({ length: MAX_LAYOVERS }, (_, index) => {
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(scaleDimension(0.037), 18, 14),
      new THREE.MeshStandardMaterial({
        color: 0x9fd4ff,
        emissive: 0x5faeff,
        emissiveIntensity: 0.7 - (index * 0.12),
        roughness: 0.24,
        metalness: 0.06,
        depthWrite: false
      })
    );
    marker.visible = false;
    routeLayer.add(marker);
    return marker;
  });

  const routeLibrary = {
    countries: [],
    countryCentroids: [],
    airports: [],
    aircraftTypes: [],
    countryByCode: new Map(),
    countryCentroidByCode: new Map(),
    airportByCode: new Map(),
    airportByIata: new Map(),
    airportsByCountry: new Map(),
    airportsByContinent: new Map(),
    countryContinentByCode: new Map(),
    aircraftTypeByCode: new Map(),
    continentsWithAirports: [],
    recommendedRoutesByPair: new Map()
  };

  const routeDataService = createRouteDataService({ sourceMode: "remote" });

  const routeState = {
    path: null,
    datasetStatusError: false,
    datasetStatusKey: "routeDatasetLoading",
    datasetStatusParams: {},
    libraryReady: false,
    loading: true,
    playing: true,
    progress: 0,
    routeMode: ROUTE_MODE_RECOMMENDED,
    selectedOriginContinentCode: "",
    selectedDestinationContinentCode: "",
    selectedRecommendedRouteId: "",
    selectedOriginCountryCode: "",
    selectedOriginAirportIcao: "",
    selectedDestinationCountryCode: "",
    selectedDestinationAirportIcao: "",
    selectedRoute: null,
    recommendedRoutes: [],
    recommendedRouteById: new Map(),
    selectionErrorKey: "",
    selectionErrorParams: {},
    speedMultiplier: Number(ui.routeSpeedEl?.value ?? 8),
    libraryStatusParams: {},
    refreshing: false,
    datasetSource: DATA_SOURCE_BUNDLED,
    lastSyncedAt: null
  };

  const tempPoint = new THREE.Vector3();
  const tempTangent = new THREE.Vector3();
  const tempTarget = new THREE.Vector3();
  const tempUp = new THREE.Vector3();
  const tempAircraftWorldPosition = new THREE.Vector3();
  const tempAircraftWorldTangent = new THREE.Vector3();
  const tempUnit = new THREE.Vector3();
  const tempGreatCircleOrtho = new THREE.Vector3();
  const tempGreatCircleFallbackAxis = new THREE.Vector3();
  const tempMarkerNormal = new THREE.Vector3();
  const tempRouteStartUnit = new THREE.Vector3();
  const tempRouteEndUnit = new THREE.Vector3();
  void globeCenter;

  function setDatasetStatus(key, params = {}, error = false) {
    routeState.datasetStatusKey = key;
    routeState.datasetStatusParams = params;
    routeState.datasetStatusError = error;
    ui.routeDatasetStatusEl.textContent = i18n.t(key, params);
    ui.routeDatasetStatusEl.classList.toggle("error", error);
  }

  function syncDatasetMetaUi() {
    if (ui.routeDataSourceEl) {
      ui.routeDataSourceEl.textContent = i18n.t(getSourceLabelKey(routeState.datasetSource));
    }

    if (!ui.routeLastSyncEl) {
      return;
    }

    if (!Number.isFinite(routeState.lastSyncedAt) || routeState.lastSyncedAt <= 0) {
      ui.routeLastSyncEl.textContent = i18n.t("routeLastSyncUnknown");
      return;
    }

    const formatted = i18n.formatDate(new Date(routeState.lastSyncedAt), {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
    ui.routeLastSyncEl.textContent = i18n.t("routeLastSyncValue", { time: formatted });
  }

  function setSelectionError(key, params = {}) {
    routeState.selectionErrorKey = key;
    routeState.selectionErrorParams = params;
  }

  function clearSelectionError() {
    routeState.selectionErrorKey = "";
    routeState.selectionErrorParams = {};
  }

  function syncControlAvailability() {
    const datasetDisabled = !routeState.libraryReady;
    const recommendedMode = routeState.routeMode === ROUTE_MODE_RECOMMENDED;
    const hasRecommendedMode = routeLibrary.continentsWithAirports.length >= 2;

    if (ui.routeModeSelectEl) {
      ui.routeModeSelectEl.disabled = datasetDisabled || !hasRecommendedMode;
    }

    if (ui.routeOriginContinentEl) {
      ui.routeOriginContinentEl.disabled = datasetDisabled || !recommendedMode;
    }
    if (ui.routeDestinationContinentEl) {
      ui.routeDestinationContinentEl.disabled = datasetDisabled || !recommendedMode;
    }
    if (ui.routeRecommendedRouteEl) {
      ui.routeRecommendedRouteEl.disabled = datasetDisabled
        || !recommendedMode
        || routeState.recommendedRoutes.length === 0;
    }

    if (ui.routeOriginCountryEl) {
      ui.routeOriginCountryEl.disabled = datasetDisabled || recommendedMode;
    }
    if (ui.routeOriginAirportEl) {
      ui.routeOriginAirportEl.disabled = datasetDisabled || recommendedMode;
    }
    if (ui.routeDestinationCountryEl) {
      ui.routeDestinationCountryEl.disabled = datasetDisabled || recommendedMode;
    }
    if (ui.routeDestinationAirportEl) {
      ui.routeDestinationAirportEl.disabled = datasetDisabled || recommendedMode;
    }

    const routeDisabled = datasetDisabled || !routeState.selectedRoute;
    if (ui.routeSpeedEl) {
      ui.routeSpeedEl.disabled = routeDisabled;
    }
    if (ui.routePlaybackButton) {
      ui.routePlaybackButton.disabled = routeDisabled;
    }
    if (ui.routeResetButton) {
      ui.routeResetButton.disabled = routeDisabled;
    }
    if (ui.routeRefreshButton) {
      ui.routeRefreshButton.disabled = routeState.loading || routeState.refreshing;
    }
  }

  function resolveCountryName(countryCode) {
    return routeLibrary.countryByCode.get(countryCode)?.name
      ?? routeLibrary.countryCentroidByCode.get(countryCode)?.name
      ?? countryCode;
  }

  function resolveCountryCentroid(countryCode, fallbackAirport = null) {
    const centroid = routeLibrary.countryCentroidByCode.get(countryCode);
    if (centroid) {
      return centroid;
    }
    if (!fallbackAirport) {
      return null;
    }
    return {
      alpha2: countryCode,
      name: resolveCountryName(countryCode),
      latitude: fallbackAirport.latitude,
      longitude: fallbackAirport.longitude
    };
  }

  function getAirportsForCountry(countryCode) {
    return routeLibrary.airportsByCountry.get(countryCode) ?? [];
  }

  function getDefaultAirportIcao(countryCode, excludedIcao = "") {
    const airports = getAirportsForCountry(countryCode);
    return airports.find((airport) => airport.icao !== excludedIcao)?.icao ?? airports[0]?.icao ?? "";
  }

  function getSelectedAirports() {
    return {
      origin: routeLibrary.airportByCode.get(routeState.selectedOriginAirportIcao) ?? null,
      destination: routeLibrary.airportByCode.get(routeState.selectedDestinationAirportIcao) ?? null
    };
  }

  function getAirportContinentCode(airport) {
    if (!airport) {
      return "";
    }
    return routeLibrary.countryContinentByCode.get(airport.countryCode) ?? "";
  }

  function getAirportsForContinent(continentCode) {
    return routeLibrary.airportsByContinent.get(continentCode) ?? [];
  }

  function getPreferredAirportsForContinent(continentCode, limit = 6) {
    const anchors = CONTINENT_ANCHOR_IATA[continentCode] ?? [];
    const seeded = [];

    for (const iata of anchors) {
      const airport = routeLibrary.airportByIata.get(iata);
      if (!airport || getAirportContinentCode(airport) !== continentCode) {
        continue;
      }
      seeded.push(airport);
    }

    const merged = uniqueByIcao([...seeded, ...getAirportsForContinent(continentCode)]);
    return merged.slice(0, Math.max(limit, 1));
  }

  function getHubAirportsForContinent(continentCode, limit = 8) {
    const priorities = CONTINENT_HUB_PRIORITY[continentCode] ?? [];
    const seeded = [];

    for (const iata of priorities) {
      const airport = routeLibrary.airportByIata.get(iata);
      if (!airport || getAirportContinentCode(airport) !== continentCode) {
        continue;
      }
      seeded.push(airport);
    }

    const merged = uniqueByIcao([...seeded, ...getPreferredAirportsForContinent(continentCode, limit)]);
    return merged.slice(0, Math.max(limit, 1));
  }

  function sampleGreatCircleUnit(startUnit, endUnit, t, target) {
    const dot = THREE.MathUtils.clamp(startUnit.dot(endUnit), -1, 1);

    if (dot > 1 - GREAT_CIRCLE_EPSILON) {
      return target.copy(startUnit);
    }

    if (dot < GREAT_CIRCLE_ANTIPODAL_THRESHOLD) {
      tempGreatCircleFallbackAxis.set(0, 1, 0);
      if (Math.abs(startUnit.dot(tempGreatCircleFallbackAxis)) > 0.9) {
        tempGreatCircleFallbackAxis.set(1, 0, 0);
      }

      tempGreatCircleOrtho
        .copy(tempGreatCircleFallbackAxis)
        .cross(startUnit)
        .normalize();

      const angle = Math.PI * t;
      return target
        .copy(startUnit)
        .multiplyScalar(Math.cos(angle))
        .addScaledVector(tempGreatCircleOrtho, Math.sin(angle))
        .normalize();
    }

    const omega = Math.acos(dot);
    const sinOmega = Math.sin(omega);
    if (Math.abs(sinOmega) < GREAT_CIRCLE_EPSILON) {
      return target.copy(startUnit);
    }

    const startWeight = Math.sin((1 - t) * omega) / sinOmega;
    const endWeight = Math.sin(t * omega) / sinOmega;

    return target
      .copy(startUnit)
      .multiplyScalar(startWeight)
      .addScaledVector(endUnit, endWeight)
      .normalize();
  }

  function getCruiseAltitudeUnits(route) {
    const altitudeKm = Math.max(0, Number(route.cruiseAltitudeFt) || 0) * 0.0003048;
    const altitudeUnitsRaw = routeModelRadius * (altitudeKm / EARTH_RADIUS_KM);
    const minAltitude = routeModelRadius * ROUTE_ALTITUDE_MIN_RATIO;
    const maxAltitude = routeModelRadius * ROUTE_ALTITUDE_MAX_RATIO;
    return THREE.MathUtils.clamp(
      altitudeUnitsRaw * ROUTE_ALTITUDE_VISUAL_BOOST,
      minAltitude,
      maxAltitude
    );
  }

  function computeGreatCircleDistanceKm(originAirport, destinationAirport) {
    const originNormal = getGlobeNormalFromGeo(originAirport.latitude, originAirport.longitude, routeFrame);
    const destinationNormal = getGlobeNormalFromGeo(destinationAirport.latitude, destinationAirport.longitude, routeFrame);

    tempRouteStartUnit.set(originNormal.x, originNormal.y, originNormal.z).normalize();
    tempRouteEndUnit.set(destinationNormal.x, destinationNormal.y, destinationNormal.z).normalize();

    return tempRouteStartUnit.angleTo(tempRouteEndUnit) * EARTH_RADIUS_KM;
  }

  function resolveDistanceProfile(greatCircleDistanceKm) {
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

  function createLeg(originAirport, destinationAirport, index) {
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
      aircraftType: routeLibrary.aircraftTypeByCode.get(distanceProfile.aircraftTypeCode) ?? null,
      cruiseAltitudeFt: distanceProfile.cruiseAltitudeFt,
      cruiseSpeedKts: distanceProfile.cruiseSpeedKts,
      durationHours,
      greatCircleDistanceKm
    };
  }

  function buildRouteFromWaypoints(waypoints, { idPrefix = "route", routeMode = ROUTE_MODE_ADVANCED } = {}) {
    const resolvedWaypoints = waypoints.filter(Boolean);
    if (resolvedWaypoints.length < 2) {
      return null;
    }

    const legs = [];
    let totalDistanceKm = 0;
    let totalFlightHours = 0;

    for (let index = 0; index < resolvedWaypoints.length - 1; index += 1) {
      const leg = createLeg(resolvedWaypoints[index], resolvedWaypoints[index + 1], index);
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

  function buildDynamicRoute(originAirport, destinationAirport) {
    return buildRouteFromWaypoints([originAirport, destinationAirport], {
      idPrefix: "advanced",
      routeMode: ROUTE_MODE_ADVANCED
    });
  }

  function createPathForLeg(leg) {
    const startNormalData = getGlobeNormalFromGeo(leg.origin.latitude, leg.origin.longitude, routeFrame);
    const endNormalData = getGlobeNormalFromGeo(leg.destination.latitude, leg.destination.longitude, routeFrame);
    const startUnit = new THREE.Vector3(startNormalData.x, startNormalData.y, startNormalData.z).normalize();
    const endUnit = new THREE.Vector3(endNormalData.x, endNormalData.y, endNormalData.z).normalize();
    const centralAngle = startUnit.angleTo(endUnit);
    const cruiseAltitudeUnits = getCruiseAltitudeUnits(leg);
    const sampledPoints = [];

    for (let index = 0; index <= ROUTE_SEGMENTS; index += 1) {
      const t = index / ROUTE_SEGMENTS;

      if (centralAngle < GREAT_CIRCLE_EPSILON) {
        tempUnit.copy(startUnit);
      } else {
        sampleGreatCircleUnit(startUnit, endUnit, t, tempUnit);
      }

      const altitudeOffset = cruiseAltitudeUnits * Math.sin(Math.PI * t);
      const position = getGlobePositionFromNormal(
        tempUnit,
        routeModelRadius + airportSurfaceOffset + altitudeOffset,
        routeFrame
      );
      sampledPoints.push(new THREE.Vector3(position.x, position.y, position.z));
    }

    return {
      ...createSampledPath(sampledPoints),
      centralAngle,
      cruiseAltitudeUnits,
      greatCircleDistanceKm: leg.greatCircleDistanceKm
    };
  }

  function createPathForRoute(route) {
    const legPaths = route.legs.map((leg) => createPathForLeg(leg));
    const sampledPoints = [];

    for (let index = 0; index < legPaths.length; index += 1) {
      const points = legPaths[index].points;
      if (index === 0) {
        sampledPoints.push(...points.map((point) => point.clone()));
      } else {
        for (let pointIndex = 1; pointIndex < points.length; pointIndex += 1) {
          sampledPoints.push(points[pointIndex].clone());
        }
      }
    }

    const waypointSurfacePoints = route.waypoints.map((airport) => {
      const position = getGlobePositionFromGeo(
        airport.latitude,
        airport.longitude,
        routeModelRadius + airportSurfaceOffset,
        routeFrame
      );
      return new THREE.Vector3(position.x, position.y, position.z);
    });

    const layoverCount = route.totals.layoverCount;
    const totalFlightHours = route.totals.flightDurationHours;
    const layoverSecondsTotal = layoverCount * LAYOVER_DWELL_SECONDS;
    const flightSecondsBudget = Math.max(
      BASE_ROUTE_CYCLE_SECONDS - layoverSecondsTotal,
      Math.max(route.legs.length, 1) * 4
    );

    const timelineSegments = [];
    let normalizedCursor = 0;

    for (let legIndex = 0; legIndex < route.legs.length; legIndex += 1) {
      const leg = route.legs[legIndex];
      const proportionalSeconds = totalFlightHours > 0
        ? flightSecondsBudget * (leg.durationHours / totalFlightHours)
        : flightSecondsBudget / route.legs.length;
      const legShare = proportionalSeconds / BASE_ROUTE_CYCLE_SECONDS;
      const legStart = normalizedCursor;
      const legEnd = legIndex === route.legs.length - 1 && layoverCount === 0
        ? 1
        : Math.min(1, legStart + legShare);

      timelineSegments.push({
        type: "flight",
        legIndex,
        start: legStart,
        end: legEnd
      });
      normalizedCursor = legEnd;

      const hasLayoverAfterLeg = legIndex < route.legs.length - 1;
      if (hasLayoverAfterLeg) {
        const layoverStart = normalizedCursor;
        const layoverShare = LAYOVER_DWELL_SECONDS / BASE_ROUTE_CYCLE_SECONDS;
        const layoverEnd = Math.min(1, layoverStart + layoverShare);

        timelineSegments.push({
          type: "layover",
          waypointIndex: legIndex + 1,
          start: layoverStart,
          end: layoverEnd
        });
        normalizedCursor = layoverEnd;
      }
    }

    if (timelineSegments.length > 0) {
      timelineSegments[timelineSegments.length - 1].end = 1;
    }

    function getSegmentAt(progress) {
      if (timelineSegments.length === 0) {
        return null;
      }

      const clamped = THREE.MathUtils.clamp(progress, 0, 1);
      const wrapped = clamped >= 1 ? 1 - Number.EPSILON : clamped;

      for (const segment of timelineSegments) {
        if (wrapped >= segment.start && wrapped < segment.end) {
          return segment;
        }
      }
      return timelineSegments[timelineSegments.length - 1];
    }

    function getPoseAt(progress, pointTarget = new THREE.Vector3(), tangentTarget = new THREE.Vector3()) {
      const segment = getSegmentAt(progress);
      if (!segment) {
        return null;
      }

      if (segment.type === "flight") {
        const legPath = legPaths[segment.legIndex];
        const segmentRange = Math.max(segment.end - segment.start, 1e-6);
        const localT = THREE.MathUtils.clamp((progress - segment.start) / segmentRange, 0, 1);
        legPath.getPointAt(localT, pointTarget);
        legPath.getTangentAt(localT, tangentTarget);
        return {
          type: "flight",
          legIndex: segment.legIndex,
          localT
        };
      }

      const waypointIndex = segment.waypointIndex;
      pointTarget.copy(waypointSurfacePoints[waypointIndex]);

      const nextLegPath = legPaths[waypointIndex];
      const previousLegPath = legPaths[Math.max(waypointIndex - 1, 0)];
      if (nextLegPath) {
        nextLegPath.getTangentAt(0.02, tangentTarget);
      } else if (previousLegPath) {
        previousLegPath.getTangentAt(0.98, tangentTarget);
      } else {
        tangentTarget.set(0, 1, 0);
      }

      if (tangentTarget.lengthSq() < 1e-8) {
        tangentTarget.set(0, 1, 0);
      } else {
        tangentTarget.normalize();
      }

      return {
        type: "layover",
        waypointIndex
      };
    }

    return {
      ...createSampledPath(sampledPoints),
      legPaths,
      timelineSegments,
      waypointSurfacePoints,
      getPoseAt,
      getPhaseAt(progress) {
        return getSegmentAt(progress);
      }
    };
  }

  function positionMarkerAtGeo(marker, latitude, longitude, radius, orientToSurface = false) {
    const position = getGlobePositionFromGeo(latitude, longitude, radius, routeFrame);
    marker.position.set(position.x, position.y, position.z);

    if (orientToSurface) {
      const normal = getGlobeNormalFromGeo(latitude, longitude, routeFrame);
      tempMarkerNormal.set(normal.x, normal.y, normal.z).normalize();
      marker.quaternion.setFromUnitVectors(COUNTRY_MARKER_BASE_NORMAL, tempMarkerNormal);
    }
  }

  function clearRouteGeometry() {
    routeState.path = null;
    routeLayer.visible = false;
    routePath.geometry.setFromPoints([]);
    routePathPoints.geometry.setFromPoints([]);
    originMarker.visible = false;
    destinationMarker.visible = false;
    originCountryMarker.visible = false;
    destinationCountryMarker.visible = false;
    aircraft.visible = false;
    for (const marker of layoverMarkers) {
      marker.visible = false;
    }
  }

  function syncAircraftPose() {
    if (!routeState.path || !routeState.selectedRoute) {
      aircraft.visible = false;
      routeLayer.visible = false;
      return;
    }

    const clampedProgress = THREE.MathUtils.clamp(routeState.progress, 0, 1);
    routeState.path.getPoseAt(clampedProgress, tempPoint, tempTangent);

    if (tempTangent.lengthSq() < 1e-8) {
      tempTangent.set(0, 1, 0);
    }

    tempUp.copy(tempPoint).sub(routeCenter).normalize();
    tempTarget.copy(tempPoint).add(tempTangent);

    aircraft.position.copy(tempPoint);
    aircraft.up.copy(tempUp);
    aircraft.lookAt(tempTarget);
    aircraft.visible = true;
    routeLayer.visible = true;
  }

  function syncCountryMarkers(route) {
    if (!route?.originCountryCentroid || !route?.destinationCountryCentroid) {
      originCountryMarker.visible = false;
      destinationCountryMarker.visible = false;
      return;
    }

    positionMarkerAtGeo(
      originCountryMarker,
      route.originCountryCentroid.latitude,
      route.originCountryCentroid.longitude,
      routeModelRadius + countrySurfaceOffset,
      true
    );
    positionMarkerAtGeo(
      destinationCountryMarker,
      route.destinationCountryCentroid.latitude,
      route.destinationCountryCentroid.longitude,
      routeModelRadius + countrySurfaceOffset,
      true
    );
    originCountryMarker.visible = true;
    destinationCountryMarker.visible = true;
  }

  function syncLayoverMarkers(route) {
    const layovers = route?.layovers ?? [];
    for (let index = 0; index < layoverMarkers.length; index += 1) {
      const marker = layoverMarkers[index];
      const layover = layovers[index];

      if (!layover) {
        marker.visible = false;
        continue;
      }

      positionMarkerAtGeo(
        marker,
        layover.latitude,
        layover.longitude,
        routeModelRadius + airportSurfaceOffset
      );
      marker.visible = true;
    }
  }

  function syncRouteGeometry() {
    if (!routeState.selectedRoute) {
      clearRouteGeometry();
      return;
    }

    routeState.path = createPathForRoute(routeState.selectedRoute);
    const sampledPoints = routeState.path.points;
    const markerPoints = sampledPoints.filter((_, index) => index % ROUTE_MARKER_STEP === 0);

    routePath.geometry.setFromPoints(sampledPoints);
    routePathPoints.geometry.setFromPoints(markerPoints);
    originMarker.position.copy(sampledPoints[0]);
    destinationMarker.position.copy(sampledPoints[sampledPoints.length - 1]);
    originMarker.visible = true;
    destinationMarker.visible = true;
    syncCountryMarkers(routeState.selectedRoute);
    syncLayoverMarkers(routeState.selectedRoute);
    syncAircraftPose();
  }

  function populateSelectOptions(selectEl, items, getValue, getLabel, selectedValue) {
    if (!selectEl) {
      return selectedValue;
    }

    selectEl.replaceChildren();
    for (const item of items) {
      const option = document.createElement("option");
      option.value = getValue(item);
      option.textContent = getLabel(item);
      selectEl.append(option);
    }

    const optionValues = new Set(items.map((item) => getValue(item)));
    const resolvedValue = optionValues.has(selectedValue)
      ? selectedValue
      : items[0] ? getValue(items[0]) : "";
    selectEl.value = resolvedValue;
    return resolvedValue;
  }

  function getPriorityIndex(priorityList, code, fallback = 40) {
    const index = priorityList.indexOf(code);
    return index === -1 ? fallback : index;
  }

  function computeHubPenalty(route, originContinentCode, destinationContinentCode) {
    let penalty = 0;
    for (const layover of route.layovers) {
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

  function isLayoverTooCloseToDestination(route) {
    const layoverCount = route?.totals?.layoverCount ?? 0;
    if (layoverCount <= 0) {
      return false;
    }

    const legs = Array.isArray(route?.legs) ? route.legs : [];
    if (legs.length === 0) {
      return false;
    }

    const firstLegDistanceKm = legs[0]?.greatCircleDistanceKm ?? 0;
    const finalLeg = legs[legs.length - 1];
    const finalLegDistanceKm = finalLeg?.greatCircleDistanceKm ?? 0;
    return firstLegDistanceKm <= MIN_FINAL_LEG_DISTANCE_KM
      || finalLegDistanceKm <= MIN_FINAL_LEG_DISTANCE_KM;
  }

  function hasLayover(route) {
    return (route?.totals?.layoverCount ?? 0) >= 1;
  }

  function isIntercontinentalLeg(leg) {
    if (!leg) {
      return false;
    }

    const originContinentCode = getAirportContinentCode(leg.origin);
    const destinationContinentCode = getAirportContinentCode(leg.destination);
    const originIntercontinentalBucket = getIntercontinentalBucket(leg.origin, originContinentCode);
    const destinationIntercontinentalBucket = getIntercontinentalBucket(leg.destination, destinationContinentCode);
    return Boolean(
      originIntercontinentalBucket
      && destinationIntercontinentalBucket
      && originIntercontinentalBucket !== destinationIntercontinentalBucket
    );
  }

  function getIntercontinentalBucket(airport, continentCode) {
    if (continentCode !== "AMERICAS") {
      return continentCode;
    }

    const countryCode = String(airport?.countryCode ?? "").trim().toUpperCase();
    if (SOUTH_AMERICA_COUNTRY_CODES.has(countryCode)) {
      return "AMERICAS_SOUTH";
    }
    if (NORTH_AMERICA_COUNTRY_CODES.has(countryCode)) {
      return "AMERICAS_NORTH";
    }

    const latitude = Number(airport?.latitude);
    if (Number.isFinite(latitude) && latitude < 0) {
      return "AMERICAS_SOUTH";
    }
    return "AMERICAS_NORTH";
  }

  function hasOnlyIntercontinentalLegs(route) {
    const legs = Array.isArray(route?.legs) ? route.legs : [];
    if (legs.length === 0) {
      return false;
    }
    return legs.every((leg) => isIntercontinentalLeg(leg));
  }

  function isStrictRecommendedCandidate(route) {
    return (
      hasLayover(route)
      && hasOnlyIntercontinentalLegs(route)
      && !isLayoverTooCloseToDestination(route)
    );
  }

  function buildRecommendedRoutesForPair(originContinentCode, destinationContinentCode) {
    if (!originContinentCode || !destinationContinentCode || originContinentCode === destinationContinentCode) {
      return [];
    }

    const pairKey = `${originContinentCode}|${destinationContinentCode}`;
    const cached = routeLibrary.recommendedRoutesByPair.get(pairKey);
    if (cached) {
      return cached;
    }

    const recommendedRoutes = buildRecommendedRoutesForPairCore({
      originContinentCode,
      destinationContinentCode,
      getPreferredAirportsForContinent,
      getHubAirportsForContinent,
      getAirportContinentCode,
      airportByIata: routeLibrary.airportByIata,
      resolveCountryName,
      resolveCountryCentroid,
      aircraftTypeByCode: routeLibrary.aircraftTypeByCode,
      routeLimit: RECOMMENDED_ROUTE_LIMIT,
      maxLayovers: MAX_LAYOVERS,
      minFinalLegDistanceKm: MIN_FINAL_LEG_DISTANCE_KM
    });

    routeLibrary.recommendedRoutesByPair.set(pairKey, recommendedRoutes);
    return recommendedRoutes;
  }

  function refreshRecommendedRoutePool() {
    const routes = buildRecommendedRoutesForPair(
      routeState.selectedOriginContinentCode,
      routeState.selectedDestinationContinentCode
    );

    routeState.recommendedRoutes = routes;
    routeState.recommendedRouteById = new Map(routes.map((route) => [route.id, route]));
  }

  function formatRecommendedRouteLabel(route) {
    const chain = route.waypoints.map((airport) => airport.iata).join(" -> ");
    const distanceLabel = formatDistanceKm(route.totals.greatCircleDistanceKm);
    const durationLabel = formatDurationHours(route.totals.durationHours, i18n);
    return `${chain} | ${distanceLabel} | ${durationLabel}`;
  }

  function syncSelectionControls() {
    const hasRecommendedMode = routeLibrary.continentsWithAirports.length >= 2;
    if (!hasRecommendedMode) {
      routeState.routeMode = ROUTE_MODE_ADVANCED;
    }

    if (ui.routeModeSelectEl) {
      ui.routeModeSelectEl.value = routeState.routeMode;
    }

    if (ui.routeRecommendedPanelEl) {
      ui.routeRecommendedPanelEl.hidden = routeState.routeMode !== ROUTE_MODE_RECOMMENDED;
    }
    if (ui.routeAdvancedPanelEl) {
      ui.routeAdvancedPanelEl.hidden = routeState.routeMode !== ROUTE_MODE_ADVANCED;
    }

    routeState.selectedOriginContinentCode = populateSelectOptions(
      ui.routeOriginContinentEl,
      routeLibrary.continentsWithAirports,
      (continentCode) => continentCode,
      (continentCode) => i18n.t(getContinentLabelKey(continentCode)),
      routeState.selectedOriginContinentCode
    );

    const destinationContinentOptions = routeLibrary.continentsWithAirports.length > 1
      ? routeLibrary.continentsWithAirports.filter((continentCode) => (
        continentCode !== routeState.selectedOriginContinentCode
      ))
      : routeLibrary.continentsWithAirports;

    const preferredDestinationContinent = (
      routeState.selectedDestinationContinentCode
      && destinationContinentOptions.includes(routeState.selectedDestinationContinentCode)
    )
      ? routeState.selectedDestinationContinentCode
      : (destinationContinentOptions[0] ?? routeState.selectedOriginContinentCode);

    routeState.selectedDestinationContinentCode = populateSelectOptions(
      ui.routeDestinationContinentEl,
      destinationContinentOptions,
      (continentCode) => continentCode,
      (continentCode) => i18n.t(getContinentLabelKey(continentCode)),
      preferredDestinationContinent
    );

    refreshRecommendedRoutePool();
    routeState.selectedRecommendedRouteId = populateSelectOptions(
      ui.routeRecommendedRouteEl,
      routeState.recommendedRoutes,
      (route) => route.id,
      (route) => formatRecommendedRouteLabel(route),
      routeState.selectedRecommendedRouteId
    );

    routeState.selectedOriginCountryCode = populateSelectOptions(
      ui.routeOriginCountryEl,
      routeLibrary.countries,
      (country) => country.alpha2,
      (country) => country.name,
      routeState.selectedOriginCountryCode
    );

    const preferredDestinationCountry = (
      routeState.selectedDestinationCountryCode
      && routeLibrary.countries.some((country) => country.alpha2 === routeState.selectedDestinationCountryCode)
    )
      ? routeState.selectedDestinationCountryCode
      : (routeLibrary.countries.find((country) => (
        country.alpha2 !== routeState.selectedOriginCountryCode
      ))?.alpha2 ?? routeState.selectedOriginCountryCode);

    routeState.selectedDestinationCountryCode = populateSelectOptions(
      ui.routeDestinationCountryEl,
      routeLibrary.countries,
      (country) => country.alpha2,
      (country) => country.name,
      preferredDestinationCountry
    );

    routeState.selectedOriginAirportIcao = populateSelectOptions(
      ui.routeOriginAirportEl,
      getAirportsForCountry(routeState.selectedOriginCountryCode),
      (airport) => airport.icao,
      createAirportLabel,
      routeState.selectedOriginAirportIcao
    );
    routeState.selectedDestinationAirportIcao = populateSelectOptions(
      ui.routeDestinationAirportEl,
      getAirportsForCountry(routeState.selectedDestinationCountryCode),
      (airport) => airport.icao,
      createAirportLabel,
      routeState.selectedDestinationAirportIcao
    );
  }

  function syncRouteUi() {
    const route = routeState.selectedRoute;
    const cycleSeconds = BASE_ROUTE_CYCLE_SECONDS / Math.max(routeState.speedMultiplier, 1);
    syncDatasetMetaUi();

    if (ui.routeSpeedValueEl) {
      ui.routeSpeedValueEl.textContent = i18n.t("routeSpeedValue", {
        speed: routeState.speedMultiplier,
        cycle: cycleSeconds.toFixed(1)
      });
    }
    if (ui.routePlaybackButton) {
      ui.routePlaybackButton.textContent = routeState.playing
        ? i18n.t("routePauseButton")
        : i18n.t("routePlayButton");
    }

    if (!route) {
      const fallbackSummary = routeState.selectionErrorKey
        ? i18n.t(routeState.selectionErrorKey, routeState.selectionErrorParams)
        : i18n.t("routeSummaryNone");

      if (ui.routeSummaryEl) {
        ui.routeSummaryEl.textContent = fallbackSummary;
      }
      if (ui.routeLegEl) {
        ui.routeLegEl.textContent = i18n.t(
          routeState.routeMode === ROUTE_MODE_RECOMMENDED
            ? "routeRecommendedPrompt"
            : "routeSelectPrompt"
        );
      }
      if (ui.routeAircraftEl) {
        ui.routeAircraftEl.textContent = "-";
      }
      if (ui.routeOriginEl) {
        ui.routeOriginEl.textContent = "-";
      }
      if (ui.routeDestinationEl) {
        ui.routeDestinationEl.textContent = "-";
      }
      if (ui.routeCountriesEl) {
        ui.routeCountriesEl.textContent = "-";
      }
      if (ui.routeLayoversEl) {
        ui.routeLayoversEl.textContent = "-";
      }
      if (ui.routeProgressEl) {
        ui.routeProgressEl.textContent = "-";
      }
      if (ui.routeDurationEl) {
        ui.routeDurationEl.textContent = "-";
      }
      if (ui.routeGeoSummaryEl) {
        ui.routeGeoSummaryEl.textContent = i18n.t("routeGeoSummaryPlaceholder");
      }
      return;
    }

    const layovers = route.layovers;
    const layoverList = layovers.map((airport) => airport.iata).join(" -> ");
    const layoverLabel = layovers.length > 0
      ? i18n.t("routeLayoversValue", {
        count: layovers.length,
        layovers: layoverList,
        seconds: LAYOVER_DWELL_SECONDS
      })
      : i18n.t("routeLayoversNone");

    const routeChainLabel = route.waypoints.map((airport) => airport.iata).join(" -> ");
    const aircraftByLeg = route.legs.map((leg) => {
      const aircraftCode = leg.aircraftType?.icaoCode ?? leg.aircraftTypeCode;
      return `${leg.origin.iata}-${leg.destination.iata} ${aircraftCode}`;
    }).join(", ");

    const elapsedHours = route.totals.durationHours * routeState.progress;
    const remainingHours = Math.max(route.totals.durationHours - elapsedHours, 0);
    const progressCore = i18n.t("routeProgressSummary", {
      percent: Math.round(routeState.progress * 100),
      elapsed: formatDurationHours(elapsedHours, i18n),
      remaining: formatDurationHours(remainingHours, i18n)
    });
    const phase = routeState.path?.getPhaseAt(routeState.progress) ?? null;
    const progressTail = phase?.type === "layover"
      ? i18n.t("routeProgressLayover", {
        airport: route.waypoints[phase.waypointIndex]?.iata ?? "-",
        seconds: LAYOVER_DWELL_SECONDS
      })
      : "";
    const progressLabel = progressTail ? `${progressCore} | ${progressTail}` : progressCore;
    const greatCircleLabel = formatDistanceKm(route.totals.greatCircleDistanceKm);

    if (ui.routeSummaryEl) {
      ui.routeSummaryEl.textContent = i18n.t("routeSummaryActiveText", {
        originCountry: route.originCountryName,
        originAirport: createAirportLabel(route.origin),
        destinationCountry: route.destinationCountryName,
        destinationAirport: createAirportLabel(route.destination),
        layovers: layoverLabel,
        duration: formatDurationHours(route.totals.durationHours, i18n),
        cruise: `${Math.round((route.cruiseAltitudeFt ?? 0) / 100) * 100} ft`,
        greatCircle: greatCircleLabel,
        aircraftByLeg
      });
    }
    if (ui.routeLegEl) {
      ui.routeLegEl.textContent = routeChainLabel;
    }
    if (ui.routeAircraftEl) {
      ui.routeAircraftEl.textContent = aircraftByLeg;
    }
    if (ui.routeOriginEl) {
      ui.routeOriginEl.textContent = createAirportLabel(route.origin);
    }
    if (ui.routeDestinationEl) {
      ui.routeDestinationEl.textContent = createAirportLabel(route.destination);
    }
    if (ui.routeCountriesEl) {
      ui.routeCountriesEl.textContent = i18n.t("routeCountriesValue", {
        originCountry: route.originCountryName,
        destinationCountry: route.destinationCountryName
      });
    }
    if (ui.routeLayoversEl) {
      ui.routeLayoversEl.textContent = layoverLabel;
    }
    if (ui.routeProgressEl) {
      ui.routeProgressEl.textContent = progressLabel;
    }
    if (ui.routeDurationEl) {
      ui.routeDurationEl.textContent = formatDurationHours(route.totals.durationHours, i18n);
    }

    const waypointGeo = route.waypoints
      .map((airport) => `${airport.iata} ${formatGeoPair(airport.latitude, airport.longitude)}`)
      .join(" -> ");
    if (ui.routeGeoSummaryEl) {
      ui.routeGeoSummaryEl.textContent = i18n.t("routeGeoPathValue", {
        waypointGeo,
        originGeo: formatGeoPair(route.origin.latitude, route.origin.longitude),
        destinationGeo: formatGeoPair(route.destination.latitude, route.destination.longitude),
        greatCircle: greatCircleLabel
      });
    }
  }

  function applyLoadedStatus() {
    setDatasetStatus("routeDatasetLoaded", {
      ...routeState.libraryStatusParams,
      source: i18n.t(getSourceLabelKey(routeState.datasetSource))
    });
  }

  function resolveRecommendedSelection() {
    if (!routeState.selectedOriginContinentCode || !routeState.selectedDestinationContinentCode) {
      return { route: null, errorKey: "routeSummaryNone", errorParams: {} };
    }

    if (routeState.selectedOriginContinentCode === routeState.selectedDestinationContinentCode) {
      return {
        route: null,
        errorKey: "routeContinentConflict",
        errorParams: {}
      };
    }

    if (routeState.recommendedRoutes.length === 0) {
      return {
        route: null,
        errorKey: "routeRecommendedNone",
        errorParams: {
          originContinent: i18n.t(getContinentLabelKey(routeState.selectedOriginContinentCode)),
          destinationContinent: i18n.t(getContinentLabelKey(routeState.selectedDestinationContinentCode))
        }
      };
    }

    if (!routeState.recommendedRouteById.has(routeState.selectedRecommendedRouteId)) {
      routeState.selectedRecommendedRouteId = routeState.recommendedRoutes[0]?.id ?? "";
      if (ui.routeRecommendedRouteEl) {
        ui.routeRecommendedRouteEl.value = routeState.selectedRecommendedRouteId;
      }
    }

    const route = routeState.recommendedRouteById.get(routeState.selectedRecommendedRouteId) ?? null;
    if (!route) {
      return {
        route: null,
        errorKey: "routeRecommendedNone",
        errorParams: {
          originContinent: i18n.t(getContinentLabelKey(routeState.selectedOriginContinentCode)),
          destinationContinent: i18n.t(getContinentLabelKey(routeState.selectedDestinationContinentCode))
        }
      };
    }

    return { route, errorKey: "", errorParams: {} };
  }

  function resolveAdvancedSelection() {
    const { origin, destination } = getSelectedAirports();
    if (!origin || !destination) {
      return { route: null, errorKey: "", errorParams: {} };
    }

    if (origin.icao === destination.icao) {
      return {
        route: null,
        errorKey: "routeSelectionConflict",
        errorParams: {}
      };
    }

    return {
      route: buildDynamicRoute(origin, destination),
      errorKey: "",
      errorParams: {}
    };
  }

  function applySelectionChange(resetProgress = true) {
    if (resetProgress) {
      routeState.progress = 0;
    }

    syncSelectionControls();

    const resolution = routeState.routeMode === ROUTE_MODE_RECOMMENDED
      ? resolveRecommendedSelection()
      : resolveAdvancedSelection();
    routeState.selectedRoute = resolution.route;

    if (!resolution.route) {
      if (resolution.errorKey && resolution.errorKey !== "routeSummaryNone") {
        setSelectionError(resolution.errorKey, resolution.errorParams ?? {});
      } else {
        clearSelectionError();
      }

      clearRouteGeometry();
      syncControlAvailability();
      if (resolution.errorKey && resolution.errorKey !== "routeSummaryNone") {
        setDatasetStatus(resolution.errorKey, resolution.errorParams ?? {}, true);
      } else {
        applyLoadedStatus();
      }
      syncRouteUi();
      return;
    }

    clearSelectionError();
    applyLoadedStatus();
    syncRouteGeometry();
    syncControlAvailability();
    syncRouteUi();
  }

  function setRouteMode(mode) {
    if (!routeState.libraryReady) {
      return;
    }

    const normalized = mode === ROUTE_MODE_ADVANCED ? ROUTE_MODE_ADVANCED : ROUTE_MODE_RECOMMENDED;
    const hasRecommendedMode = routeLibrary.continentsWithAirports.length >= 2;
    routeState.routeMode = (!hasRecommendedMode && normalized === ROUTE_MODE_RECOMMENDED)
      ? ROUTE_MODE_ADVANCED
      : normalized;
    applySelectionChange(true);
  }

  function setOriginContinent(continentCode) {
    if (!routeState.libraryReady) {
      return;
    }

    routeState.selectedOriginContinentCode = continentCode;
    applySelectionChange(true);
  }

  function setDestinationContinent(continentCode) {
    if (!routeState.libraryReady) {
      return;
    }

    routeState.selectedDestinationContinentCode = continentCode;
    applySelectionChange(true);
  }

  function setRecommendedRoute(routeId) {
    if (!routeState.libraryReady) {
      return;
    }

    routeState.selectedRecommendedRouteId = routeId;
    applySelectionChange(true);
  }

  function setOriginCountry(countryCode) {
    if (!routeState.libraryReady) {
      return;
    }

    routeState.selectedOriginCountryCode = countryCode;
    const excludedIcao = routeState.selectedOriginCountryCode === routeState.selectedDestinationCountryCode
      ? routeState.selectedDestinationAirportIcao
      : "";
    routeState.selectedOriginAirportIcao = getDefaultAirportIcao(routeState.selectedOriginCountryCode, excludedIcao);
    applySelectionChange(true);
  }

  function setOriginAirport(airportIcao) {
    if (!routeState.libraryReady) {
      return;
    }

    routeState.selectedOriginAirportIcao = airportIcao;
    applySelectionChange(true);
  }

  function setDestinationCountry(countryCode) {
    if (!routeState.libraryReady) {
      return;
    }

    routeState.selectedDestinationCountryCode = countryCode;
    const excludedIcao = routeState.selectedDestinationCountryCode === routeState.selectedOriginCountryCode
      ? routeState.selectedOriginAirportIcao
      : "";
    routeState.selectedDestinationAirportIcao = getDefaultAirportIcao(routeState.selectedDestinationCountryCode, excludedIcao);
    applySelectionChange(true);
  }

  function setDestinationAirport(airportIcao) {
    if (!routeState.libraryReady) {
      return;
    }

    routeState.selectedDestinationAirportIcao = airportIcao;
    applySelectionChange(true);
  }

  function applyLibraryDataset(dataset, { preserveSelection = true, source = DATA_SOURCE_BUNDLED, fetchedAt = null } = {}) {
    const previousState = {
      routeMode: routeState.routeMode,
      originContinentCode: routeState.selectedOriginContinentCode,
      destinationContinentCode: routeState.selectedDestinationContinentCode,
      recommendedRouteId: routeState.selectedRecommendedRouteId,
      originCountryCode: routeState.selectedOriginCountryCode,
      destinationCountryCode: routeState.selectedDestinationCountryCode,
      originAirportIcao: routeState.selectedOriginAirportIcao,
      destinationAirportIcao: routeState.selectedDestinationAirportIcao
    };

    routeLibrary.countries = [];
    routeLibrary.countryCentroids = Array.isArray(dataset.countryCentroids) ? dataset.countryCentroids : [];
    routeLibrary.airports = Array.isArray(dataset.airports) ? [...dataset.airports].sort((left, right) => (
      compareText(left.countryCode, right.countryCode)
      || compareText(left.city, right.city)
      || compareText(left.iata, right.iata)
      || compareText(left.icao, right.icao)
    )) : [];
    routeLibrary.aircraftTypes = Array.isArray(dataset.aircraftTypes) ? dataset.aircraftTypes : [];
    routeLibrary.countryByCode = new Map();
    routeLibrary.countryCentroidByCode = new Map();
    routeLibrary.airportByCode = new Map();
    routeLibrary.airportByIata = new Map();
    routeLibrary.airportsByCountry = new Map();
    routeLibrary.airportsByContinent = new Map();
    routeLibrary.countryContinentByCode = new Map();
    routeLibrary.aircraftTypeByCode = new Map();
    routeLibrary.recommendedRoutesByPair = new Map();

    for (const country of (Array.isArray(dataset.countries) ? dataset.countries : [])) {
      routeLibrary.countryByCode.set(country.alpha2, { ...country });
    }

    for (const centroid of routeLibrary.countryCentroids) {
      const existingCountry = routeLibrary.countryByCode.get(centroid.alpha2) ?? {};
      const mergedCountry = {
        ...existingCountry,
        alpha2: centroid.alpha2,
        name: centroid.name ?? existingCountry.name ?? centroid.alpha2,
        region: String(existingCountry.region ?? "").trim(),
        latitude: centroid.latitude,
        longitude: centroid.longitude
      };
      routeLibrary.countryByCode.set(centroid.alpha2, mergedCountry);
      routeLibrary.countryCentroidByCode.set(centroid.alpha2, {
        alpha2: centroid.alpha2,
        name: mergedCountry.name,
        latitude: centroid.latitude,
        longitude: centroid.longitude
      });
    }

    for (const [countryCode, country] of routeLibrary.countryByCode.entries()) {
      const continentCode = inferContinentCode(country.region);
      if (continentCode) {
        routeLibrary.countryContinentByCode.set(countryCode, continentCode);
      }
    }

    for (const airport of routeLibrary.airports) {
      routeLibrary.airportByCode.set(airport.icao, airport);
      if (!routeLibrary.airportByIata.has(airport.iata)) {
        routeLibrary.airportByIata.set(airport.iata, airport);
      }

      if (!routeLibrary.airportsByCountry.has(airport.countryCode)) {
        routeLibrary.airportsByCountry.set(airport.countryCode, []);
      }
      routeLibrary.airportsByCountry.get(airport.countryCode).push(airport);

      if (!routeLibrary.countryByCode.has(airport.countryCode)) {
        routeLibrary.countryByCode.set(airport.countryCode, {
          alpha2: airport.countryCode,
          name: airport.countryCode,
          region: ""
        });
      }

      const continentCode = routeLibrary.countryContinentByCode.get(airport.countryCode)
        ?? inferContinentCode(routeLibrary.countryByCode.get(airport.countryCode)?.region);
      if (continentCode) {
        routeLibrary.countryContinentByCode.set(airport.countryCode, continentCode);
        if (!routeLibrary.airportsByContinent.has(continentCode)) {
          routeLibrary.airportsByContinent.set(continentCode, []);
        }
        routeLibrary.airportsByContinent.get(continentCode).push(airport);
      }
    }

    for (const airports of routeLibrary.airportsByCountry.values()) {
      airports.sort((left, right) => (
        compareText(left.city, right.city)
        || compareText(left.iata, right.iata)
        || compareText(left.icao, right.icao)
      ));
    }

    for (const airports of routeLibrary.airportsByContinent.values()) {
      airports.sort((left, right) => (
        compareText(left.city, right.city)
        || compareText(left.iata, right.iata)
        || compareText(left.icao, right.icao)
      ));
    }

    for (const aircraftType of routeLibrary.aircraftTypes) {
      routeLibrary.aircraftTypeByCode.set(aircraftType.icaoCode, aircraftType);
    }

    routeLibrary.countries = Array.from(routeLibrary.airportsByCountry.keys())
      .map((countryCode) => ({
        alpha2: countryCode,
        name: resolveCountryName(countryCode)
      }))
      .sort((left, right) => compareText(left.name, right.name));
    routeLibrary.continentsWithAirports = CONTINENT_CODES.filter((continentCode) => (
      (routeLibrary.airportsByContinent.get(continentCode)?.length ?? 0) > 0
    ));

    routeState.libraryReady = routeLibrary.airports.length >= 2 && routeLibrary.countries.length >= 1;
    routeState.datasetSource = source;
    routeState.lastSyncedAt = Number.isFinite(fetchedAt) ? fetchedAt : null;
    routeState.libraryStatusParams = {
      countries: routeLibrary.countries.length,
      airports: routeLibrary.airports.length,
      centroids: routeLibrary.countryCentroids.length,
      aircraftTypes: routeLibrary.aircraftTypes.length
    };

    if (!routeState.libraryReady) {
      routeState.selectedRoute = null;
      routeState.playing = false;
      clearRouteGeometry();
      syncControlAvailability();
      syncRouteUi();
      return false;
    }

    const hasCountry = (countryCode) => routeLibrary.countries.some((country) => country.alpha2 === countryCode);
    const hasContinent = (continentCode) => routeLibrary.continentsWithAirports.includes(continentCode);
    const getAirportByCode = (airportIcao) => routeLibrary.airportByCode.get(airportIcao);

    const hasRecommendedMode = routeLibrary.continentsWithAirports.length >= 2;
    const preferredRouteMode = preserveSelection ? previousState.routeMode : ROUTE_MODE_RECOMMENDED;
    routeState.routeMode = preferredRouteMode === ROUTE_MODE_ADVANCED
      ? ROUTE_MODE_ADVANCED
      : ROUTE_MODE_RECOMMENDED;
    if (!hasRecommendedMode) {
      routeState.routeMode = ROUTE_MODE_ADVANCED;
    }

    routeState.selectedOriginContinentCode = preserveSelection && hasContinent(previousState.originContinentCode)
      ? previousState.originContinentCode
      : (routeLibrary.continentsWithAirports[0] ?? "");
    routeState.selectedDestinationContinentCode = preserveSelection
      && hasContinent(previousState.destinationContinentCode)
      && previousState.destinationContinentCode !== routeState.selectedOriginContinentCode
      ? previousState.destinationContinentCode
      : (routeLibrary.continentsWithAirports.find((continentCode) => (
        continentCode !== routeState.selectedOriginContinentCode
      )) ?? routeState.selectedOriginContinentCode);
    routeState.selectedRecommendedRouteId = preserveSelection ? previousState.recommendedRouteId : "";

    routeState.selectedOriginCountryCode = preserveSelection && hasCountry(previousState.originCountryCode)
      ? previousState.originCountryCode
      : (routeLibrary.countries[0]?.alpha2 ?? "");

    routeState.selectedDestinationCountryCode = preserveSelection
      && hasCountry(previousState.destinationCountryCode)
      && previousState.destinationCountryCode !== routeState.selectedOriginCountryCode
      ? previousState.destinationCountryCode
      : (routeLibrary.countries.find((country) => (
        country.alpha2 !== routeState.selectedOriginCountryCode
      ))?.alpha2 ?? routeState.selectedOriginCountryCode);

    const previousOriginAirportEntry = preserveSelection ? getAirportByCode(previousState.originAirportIcao) : null;
    routeState.selectedOriginAirportIcao = previousOriginAirportEntry?.countryCode === routeState.selectedOriginCountryCode
      ? previousState.originAirportIcao
      : getDefaultAirportIcao(
        routeState.selectedOriginCountryCode,
        routeState.selectedOriginCountryCode === routeState.selectedDestinationCountryCode
          ? previousState.destinationAirportIcao
          : ""
      );

    const previousDestinationAirportEntry = preserveSelection ? getAirportByCode(previousState.destinationAirportIcao) : null;
    routeState.selectedDestinationAirportIcao = previousDestinationAirportEntry?.countryCode === routeState.selectedDestinationCountryCode
      ? previousState.destinationAirportIcao
      : getDefaultAirportIcao(
        routeState.selectedDestinationCountryCode,
        routeState.selectedDestinationCountryCode === routeState.selectedOriginCountryCode
          ? routeState.selectedOriginAirportIcao
          : ""
      );

    const previousFingerprint = `${previousState.routeMode}|${previousState.originContinentCode}|${previousState.destinationContinentCode}|${previousState.recommendedRouteId}|${previousState.originAirportIcao}|${previousState.destinationAirportIcao}`;
    const nextFingerprint = `${routeState.routeMode}|${routeState.selectedOriginContinentCode}|${routeState.selectedDestinationContinentCode}|${routeState.selectedRecommendedRouteId}|${routeState.selectedOriginAirportIcao}|${routeState.selectedDestinationAirportIcao}`;
    applySelectionChange(!preserveSelection || previousFingerprint !== nextFingerprint);
    return true;
  }

  async function refreshDataset({ forceRemote = false } = {}) {
    if (routeState.refreshing || routeState.loading) {
      return false;
    }

    routeState.refreshing = true;
    setDatasetStatus("routeDatasetRefreshing");
    syncControlAvailability();
    syncRouteUi();

    try {
      const refreshed = await routeDataService.refreshRemote({ language: i18n.getLanguage(), forceRemote });
      const dataset = {
        ...refreshed.dataset,
        aircraftTypes: routeLibrary.aircraftTypes
      };
      const applied = applyLibraryDataset(dataset, {
        preserveSelection: true,
        source: refreshed.source ?? DATA_SOURCE_LIVE_API,
        fetchedAt: refreshed.fetchedAt ?? Date.now()
      });

      if (!applied) {
        setDatasetStatus("routeDatasetNoRoutes", {}, true);
      } else if (!routeState.selectionErrorKey) {
        const warningKey = (refreshed.warnings ?? []).includes("geonames_unavailable")
          ? "routeDatasetRefreshPartial"
          : "routeDatasetRefreshSuccess";
        setDatasetStatus(warningKey, {
          source: i18n.t(getSourceLabelKey(routeState.datasetSource))
        }, warningKey === "routeDatasetRefreshPartial");
      }

      syncRouteUi();
      return true;
    } catch (error) {
      console.error("[globe routes] remote dataset refresh failed", error);
      if (routeState.selectionErrorKey) {
        setDatasetStatus(routeState.selectionErrorKey, routeState.selectionErrorParams, true);
      } else {
        setDatasetStatus("routeDatasetRefreshFailed", {
          source: i18n.t(getSourceLabelKey(routeState.datasetSource))
        }, true);
      }
      syncRouteUi();
      return false;
    } finally {
      routeState.refreshing = false;
      syncControlAvailability();
    }
  }

  async function initialize() {
    routeState.loading = true;
    setDatasetStatus("routeDatasetLoading");
    syncControlAvailability();

    try {
      const initialLoad = await routeDataService.loadInitialDataset({ language: i18n.getLanguage() });
      routeState.loading = false;

      const applied = applyLibraryDataset(initialLoad.dataset, {
        preserveSelection: false,
        source: initialLoad.source ?? DATA_SOURCE_BUNDLED,
        fetchedAt: initialLoad.fetchedAt
      });

      if (!applied) {
        setDatasetStatus("routeDatasetNoRoutes", {}, true);
        syncRouteUi();
        return;
      }

      syncControlAvailability();
      syncRouteUi();

      if (initialLoad.shouldAutoRefresh) {
        void refreshDataset({ forceRemote: false });
      }
    } catch (error) {
      console.error("[globe routes] offline dataset load failed", error);
      routeState.loading = false;
      routeState.libraryReady = false;
      routeState.playing = false;
      clearRouteGeometry();
      syncControlAvailability();
      setDatasetStatus("routeDatasetFailed", {}, true);
      syncRouteUi();
    }
  }

  function setSpeedMultiplier(value) {
    routeState.speedMultiplier = Math.max(1, Number(value) || 1);
    syncRouteUi();
  }

  function togglePlayback() {
    if (!routeState.selectedRoute) {
      return;
    }
    routeState.playing = !routeState.playing;
    syncRouteUi();
  }

  function resetProgress() {
    if (!routeState.selectedRoute) {
      return;
    }
    routeState.progress = 0;
    syncAircraftPose();
    syncRouteUi();
  }

  function update(deltaSeconds) {
    if (!routeState.selectedRoute) {
      return;
    }

    if (routeState.playing) {
      routeState.progress += (deltaSeconds * routeState.speedMultiplier) / BASE_ROUTE_CYCLE_SECONDS;
      if (routeState.progress >= 1) {
        routeState.progress %= 1;
      }
      syncRouteUi();
    }

    syncAircraftPose();
  }

  function getAircraftTrackingPose(
    positionTarget = tempAircraftWorldPosition,
    tangentTarget = tempAircraftWorldTangent
  ) {
    if (!routeState.selectedRoute || !aircraft.visible) {
      return null;
    }

    aircraft.getWorldPosition(positionTarget);
    aircraft.getWorldDirection(tangentTarget);
    if (tangentTarget.lengthSq() < 1e-8) {
      tangentTarget.set(0, 0, 1);
    } else {
      tangentTarget.normalize();
    }

    return {
      position: positionTarget,
      tangent: tangentTarget
    };
  }

  function getAircraftTrackingTarget(target = tempAircraftWorldPosition) {
    const pose = getAircraftTrackingPose(target, tempAircraftWorldTangent);
    return pose ? pose.position : null;
  }

  function refreshLocalizedUi() {
    setDatasetStatus(routeState.datasetStatusKey, routeState.datasetStatusParams, routeState.datasetStatusError);
    if (routeState.libraryReady) {
      syncSelectionControls();
      syncControlAvailability();
    }
    syncRouteUi();
  }

  globeSurface.updateMatrixWorld?.(true);
  clearRouteGeometry();
  syncControlAvailability();
  syncRouteUi();

  return {
    initialize,
    refreshDataset,
    refreshLocalizedUi,
    resetProgress,
    setRouteMode,
    setOriginContinent,
    setDestinationContinent,
    setRecommendedRoute,
    setDestinationAirport,
    setDestinationCountry,
    setOriginAirport,
    setOriginCountry,
    setSpeedMultiplier,
    syncRouteUi,
    getAircraftTrackingPose,
    getAircraftTrackingTarget,
    togglePlayback,
    update
  };
}
