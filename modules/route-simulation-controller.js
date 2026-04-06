import * as THREE from "../vendor/three.module.js";
import {
  formatGeoPair,
  getProjectedPositionFromGeo
} from "./geo-utils.js";
import {
  CONTINENT_ANCHOR_IATA,
  CONTINENT_CODES,
  CONTINENT_HUB_PRIORITY,
  LAYOVER_DWELL_SECONDS,
  ROUTE_MODE_ADVANCED,
  ROUTE_MODE_RECOMMENDED,
  buildRecommendedRoutesForPair,
  buildRouteFromWaypoints,
  compareText,
  getContinentLabelKey,
  inferContinentCode,
  uniqueByIcao
} from "./route-multileg-core.js?v=20260405-endpointfilter1";

const DATASET_BASE_PATHS = ["./assets/data", "../assets/data", "/assets/data"];
const DATASET_FILENAMES = {
  countries: ["countries.json"],
  airports: ["airports.json"],
  aircraftTypes: ["aircraft-types.json"]
};

const BASE_ROUTE_CYCLE_SECONDS = 120;
const ROUTE_SURFACE_OFFSET = 0.045;
const ROUTE_ALTITUDE_BASE = 0.2;
const ROUTE_ALTITUDE_SCALE = 0.55;
const ROUTE_SEGMENTS = 96;
const ROUTE_MARKER_STEP = 8;
const GLOBE_RADIUS_FALLBACK_SCALE = 0.82;
const GREAT_CIRCLE_EPSILON = 1e-6;
const GREAT_CIRCLE_ANTIPODAL_THRESHOLD = -0.9995;

const WORLD_UP = new THREE.Vector3(0, 1, 0);
const WORLD_RIGHT = new THREE.Vector3(1, 0, 0);

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
    metalness: 0.18
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

function createRouteLayer({
  scaleDimension,
  parent,
  depthTest = true,
  pathRenderOrder = null,
  pointsRenderOrder = null
}) {
  const routeLayer = new THREE.Group();
  routeLayer.visible = false;
  parent.add(routeLayer);

  const routePath = new THREE.Line(
    new THREE.BufferGeometry(),
    new THREE.LineBasicMaterial({
      color: 0x8dd5ff,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      depthTest
    })
  );
  if (Number.isFinite(pathRenderOrder)) {
    routePath.renderOrder = pathRenderOrder;
  }
  routeLayer.add(routePath);

  const routePathPoints = new THREE.Points(
    new THREE.BufferGeometry(),
    new THREE.PointsMaterial({
      color: 0xeefaff,
      size: scaleDimension(0.05),
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.82,
      depthWrite: false,
      depthTest
    })
  );
  if (Number.isFinite(pointsRenderOrder)) {
    routePathPoints.renderOrder = pointsRenderOrder;
  }
  routeLayer.add(routePathPoints);

  const originMarker = new THREE.Mesh(
    new THREE.SphereGeometry(scaleDimension(0.055), 20, 16),
    new THREE.MeshStandardMaterial({
      color: 0x8dffbc,
      emissive: 0x4fcf84,
      emissiveIntensity: 0.8,
      roughness: 0.25,
      metalness: 0.06,
      depthWrite: false,
      depthTest
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
      depthWrite: false,
      depthTest
    })
  );
  destinationMarker.visible = false;
  routeLayer.add(destinationMarker);

  const layoverMarkers = Array.from({ length: 3 }, (_, index) => {
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(scaleDimension(0.037), 18, 14),
      new THREE.MeshStandardMaterial({
        color: 0x9fd4ff,
        emissive: 0x5faeff,
        emissiveIntensity: 0.7 - (index * 0.12),
        roughness: 0.24,
        metalness: 0.06,
        depthWrite: false,
        depthTest
      })
    );
    marker.visible = false;
    routeLayer.add(marker);
    return marker;
  });

  const aircraft = createAircraftModel(scaleDimension);
  aircraft.visible = false;
  routeLayer.add(aircraft);

  return {
    aircraft,
    destinationMarker,
    layoverMarkers,
    originMarker,
    routeLayer,
    routePath,
    routePathPoints
  };
}

function buildDatasetPathCandidates(filenames) {
  const candidateFilenames = Array.isArray(filenames) ? filenames : [filenames];
  const paths = [];

  for (const filename of candidateFilenames) {
    for (const basePath of DATASET_BASE_PATHS) {
      paths.push(`${basePath}/${filename}`);
    }
  }

  return paths;
}

async function loadJson(pathCandidates, label) {
  const attempted = [];
  let lastError = null;

  for (const path of pathCandidates) {
    try {
      const response = await fetch(path, { cache: "no-store" });
      if (!response.ok) {
        attempted.push(`${path} [${response.status}]`);
        continue;
      }
      return response.json();
    } catch (error) {
      lastError = error;
      attempted.push(`${path} [network-error]`);
    }
  }

  const details = attempted.join(", ");
  const lastErrorMessage = lastError instanceof Error ? ` (${lastError.message})` : "";
  throw new Error(`Failed to load ${label}. Tried: ${details}${lastErrorMessage}`);
}

function geoToUnitVector(latitudeDegrees, longitudeDegrees, target) {
  const latitudeRadians = THREE.MathUtils.degToRad(latitudeDegrees);
  const longitudeRadians = THREE.MathUtils.degToRad(longitudeDegrees);
  const cosLatitude = Math.cos(latitudeRadians);
  target.set(
    cosLatitude * Math.cos(longitudeRadians),
    Math.sin(latitudeRadians),
    cosLatitude * Math.sin(longitudeRadians)
  );
  return target.normalize();
}

function sampleGreatCircle(startUnit, endUnit, t, target, tempOrtho, tempAxis) {
  const dot = THREE.MathUtils.clamp(startUnit.dot(endUnit), -1, 1);

  if (dot > 1 - GREAT_CIRCLE_EPSILON) {
    return target.copy(startUnit);
  }

  if (dot < GREAT_CIRCLE_ANTIPODAL_THRESHOLD) {
    tempAxis.copy(startUnit).cross(WORLD_UP);
    if (tempAxis.lengthSq() < 1e-8) {
      tempAxis.copy(startUnit).cross(WORLD_RIGHT);
    }
    tempAxis.normalize();
    return target.copy(startUnit).applyAxisAngle(tempAxis, Math.PI * t).normalize();
  }

  const omega = Math.acos(dot);
  const sinOmega = Math.sin(omega);
  if (Math.abs(sinOmega) < GREAT_CIRCLE_EPSILON) {
    return target.copy(startUnit);
  }

  const startWeight = Math.sin((1 - t) * omega) / sinOmega;
  const endWeight = Math.sin(t * omega) / sinOmega;

  tempOrtho
    .copy(startUnit)
    .multiplyScalar(startWeight)
    .addScaledVector(endUnit, endWeight);
  return target.copy(tempOrtho).normalize();
}

export function createRouteSimulationController({
  cameraState,
  constants,
  globeStage,
  globeSurface,
  i18n,
  scalableStage,
  ui
}) {
  const scaleDimension = (value) => value * (constants.MODEL_SCALE ?? 1);
  const routeSurfaceOffset = scaleDimension(ROUTE_SURFACE_OFFSET);
  const routeAltitudeBase = scaleDimension(ROUTE_ALTITUDE_BASE);
  const routeAltitudeScale = scaleDimension(ROUTE_ALTITUDE_SCALE);

  const flatLayer = createRouteLayer({
    scaleDimension,
    parent: scalableStage,
    depthTest: false,
    pathRenderOrder: 18,
    pointsRenderOrder: 19
  });

  const globeParent = globeStage ?? scalableStage;
  const globeLayer = createRouteLayer({
    scaleDimension,
    parent: globeParent,
    depthTest: true
  });

  const routeLibrary = {
    countries: [],
    airports: [],
    aircraftTypes: [],
    countryByCode: new Map(),
    airportByCode: new Map(),
    airportByIata: new Map(),
    airportsByCountry: new Map(),
    airportsByContinent: new Map(),
    countryContinentByCode: new Map(),
    aircraftTypeByCode: new Map(),
    continentsWithAirports: [],
    recommendedRoutesByPair: new Map()
  };

  const routeState = {
    flatPath: null,
    globePath: null,
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
    speedMultiplier: Math.max(1, Number(ui.routeSpeedEl?.value ?? 8) || 8),
    libraryStatusParams: {}
  };

  const tempPoint = new THREE.Vector3();
  const tempTangent = new THREE.Vector3();
  const tempTarget = new THREE.Vector3();
  const tempUp = new THREE.Vector3();
  const tempGlobeCenter = new THREE.Vector3();
  const tempGreatCircleSample = new THREE.Vector3();
  const tempGreatCircleOrtho = new THREE.Vector3();
  const tempGreatCircleAxis = new THREE.Vector3();

  function isSphericalView() {
    return cameraState?.earthModelView === "spherical";
  }

  function getGlobeCenter(target = tempGlobeCenter) {
    if (globeSurface?.position) {
      return target.copy(globeSurface.position);
    }
    return target.set(0, constants.SURFACE_Y * 0.2, 0);
  }

  function getGlobeRadius() {
    const radius = globeSurface?.geometry?.parameters?.radius;
    if (Number.isFinite(radius) && radius > 0) {
      return radius;
    }
    return constants.DISC_RADIUS * GLOBE_RADIUS_FALLBACK_SCALE;
  }

  function setDatasetStatus(key, params = {}, error = false) {
    routeState.datasetStatusKey = key;
    routeState.datasetStatusParams = params;
    routeState.datasetStatusError = error;
    if (ui.routeDatasetStatusEl) {
      ui.routeDatasetStatusEl.textContent = i18n.t(key, params);
      ui.routeDatasetStatusEl.classList.toggle("error", error);
    }
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
  }

  function syncRouteLayerVisibility() {
    const hasRoute = Boolean(routeState.selectedRoute && routeState.flatPath && routeState.globePath);
    const spherical = isSphericalView();
    flatLayer.routeLayer.visible = hasRoute && !spherical;
    globeLayer.routeLayer.visible = hasRoute && spherical;
  }

  function resolveCountryName(countryCode) {
    return routeLibrary.countryByCode.get(countryCode)?.name ?? countryCode;
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

  function buildDynamicRoute(originAirport, destinationAirport) {
    return buildRouteFromWaypoints([originAirport, destinationAirport], {
      idPrefix: "advanced",
      routeMode: ROUTE_MODE_ADVANCED,
      aircraftTypeByCode: routeLibrary.aircraftTypeByCode,
      resolveCountryName
    });
  }

  function createFlatPathForLeg(leg) {
    const startData = getProjectedPositionFromGeo(
      leg.origin.latitude,
      leg.origin.longitude,
      constants.DISC_RADIUS,
      constants.SURFACE_Y + routeSurfaceOffset
    );
    const endData = getProjectedPositionFromGeo(
      leg.destination.latitude,
      leg.destination.longitude,
      constants.DISC_RADIUS,
      constants.SURFACE_Y + routeSurfaceOffset
    );

    const start = new THREE.Vector3(startData.x, startData.y, startData.z);
    const end = new THREE.Vector3(endData.x, endData.y, endData.z);
    const control = start.clone().lerp(end, 0.5);
    const distance = start.distanceTo(end);
    const altitudeFromCruise = scaleDimension(
      Math.min(0.5, Math.max(0, Number(leg.cruiseAltitudeFt) || 0) / 100000) * 0.08
    );
    control.y += routeAltitudeBase + Math.min(distance * 0.14, routeAltitudeScale) + altitudeFromCruise;

    const curve = new THREE.QuadraticBezierCurve3(start, control, end);
    const points = curve.getPoints(ROUTE_SEGMENTS);
    return {
      ...createSampledPath(points),
      points
    };
  }

  function createGlobePathForLeg(leg) {
    const startUnit = new THREE.Vector3();
    const endUnit = new THREE.Vector3();
    geoToUnitVector(leg.origin.latitude, leg.origin.longitude, startUnit);
    geoToUnitVector(leg.destination.latitude, leg.destination.longitude, endUnit);

    const center = getGlobeCenter(new THREE.Vector3());
    const baseRadius = getGlobeRadius() + routeSurfaceOffset;
    const chordDistance = startUnit.clone().multiplyScalar(baseRadius).distanceTo(
      endUnit.clone().multiplyScalar(baseRadius)
    );
    const altitudeFromCruise = scaleDimension(
      Math.min(0.5, Math.max(0, Number(leg.cruiseAltitudeFt) || 0) / 100000) * 0.08
    );
    const peakArc = routeAltitudeBase + Math.min(chordDistance * 0.14, routeAltitudeScale) + altitudeFromCruise;

    const points = [];
    for (let index = 0; index <= ROUTE_SEGMENTS; index += 1) {
      const t = index / ROUTE_SEGMENTS;
      sampleGreatCircle(
        startUnit,
        endUnit,
        t,
        tempGreatCircleSample,
        tempGreatCircleOrtho,
        tempGreatCircleAxis
      );
      const radius = baseRadius + (Math.sin(Math.PI * t) * peakArc);
      const point = tempGreatCircleSample.clone().multiplyScalar(radius).add(center);
      points.push(point);
    }

    return {
      ...createSampledPath(points),
      points
    };
  }

  function createPathForRoute(route, createLegPath, createWaypointSurfacePoint) {
    const legPaths = route.legs.map((leg) => createLegPath(leg));
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

    const waypointSurfacePoints = route.waypoints.map((airport) => createWaypointSurfacePoint(airport));
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

      if (legIndex < route.legs.length - 1) {
        const layoverStart = normalizedCursor;
        const layoverShare = LAYOVER_DWELL_SECONDS / BASE_ROUTE_CYCLE_SECONDS;
        const layoverEnd = legIndex === route.legs.length - 2
          ? 1
          : Math.min(1, layoverStart + layoverShare);

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

  function createFlatPathForRoute(route) {
    return createPathForRoute(
      route,
      createFlatPathForLeg,
      (airport) => {
        const projected = getProjectedPositionFromGeo(
          airport.latitude,
          airport.longitude,
          constants.DISC_RADIUS,
          constants.SURFACE_Y + routeSurfaceOffset
        );
        return new THREE.Vector3(projected.x, projected.y, projected.z);
      }
    );
  }

  function createGlobePathForRoute(route) {
    return createPathForRoute(
      route,
      createGlobePathForLeg,
      (airport) => {
        const center = getGlobeCenter(new THREE.Vector3());
        const baseRadius = getGlobeRadius() + routeSurfaceOffset;
        const unit = new THREE.Vector3();
        geoToUnitVector(airport.latitude, airport.longitude, unit);
        return unit.multiplyScalar(baseRadius).add(center);
      }
    );
  }

  function clearLayerGeometry(layer) {
    layer.routePath.geometry.setFromPoints([]);
    layer.routePathPoints.geometry.setFromPoints([]);
    layer.originMarker.visible = false;
    layer.destinationMarker.visible = false;
    layer.aircraft.visible = false;
    for (const marker of layer.layoverMarkers) {
      marker.visible = false;
    }
  }

  function applyLayerGeometry(layer, path) {
    if (!path || path.points.length === 0) {
      clearLayerGeometry(layer);
      return;
    }

    const sampledPoints = path.points;
    const markerPoints = sampledPoints.filter(
      (_, index) => index % ROUTE_MARKER_STEP === 0 || index === sampledPoints.length - 1
    );
    layer.routePath.geometry.setFromPoints(sampledPoints);
    layer.routePathPoints.geometry.setFromPoints(markerPoints);

    layer.originMarker.position.copy(sampledPoints[0]);
    layer.destinationMarker.position.copy(sampledPoints[sampledPoints.length - 1]);
    layer.originMarker.visible = true;
    layer.destinationMarker.visible = true;

    const layovers = path.waypointSurfacePoints.slice(1, -1);
    for (let index = 0; index < layer.layoverMarkers.length; index += 1) {
      const marker = layer.layoverMarkers[index];
      const layoverPoint = layovers[index];
      if (!layoverPoint) {
        marker.visible = false;
        continue;
      }
      marker.position.copy(layoverPoint);
      marker.visible = true;
    }
  }

  function clearRouteGeometry() {
    routeState.flatPath = null;
    routeState.globePath = null;
    clearLayerGeometry(flatLayer);
    clearLayerGeometry(globeLayer);
    syncRouteLayerVisibility();
  }

  function syncAircraftPose() {
    if (!routeState.selectedRoute) {
      clearLayerGeometry(flatLayer);
      clearLayerGeometry(globeLayer);
      syncRouteLayerVisibility();
      return;
    }

    const spherical = isSphericalView();
    const activePath = spherical ? routeState.globePath : routeState.flatPath;
    const activeLayer = spherical ? globeLayer : flatLayer;
    const inactiveLayer = spherical ? flatLayer : globeLayer;

    inactiveLayer.aircraft.visible = false;
    if (!activePath) {
      syncRouteLayerVisibility();
      return;
    }

    const clampedProgress = THREE.MathUtils.clamp(routeState.progress, 0, 1);
    activePath.getPoseAt(clampedProgress, tempPoint, tempTangent);
    if (tempTangent.lengthSq() < 1e-8) {
      tempTangent.set(0, 1, 0);
    }
    tempTarget.copy(tempPoint).add(tempTangent);

    activeLayer.aircraft.position.copy(tempPoint);
    if (spherical) {
      tempUp.copy(tempPoint).sub(getGlobeCenter());
      if (tempUp.lengthSq() > 1e-8) {
        activeLayer.aircraft.up.copy(tempUp.normalize());
      } else {
        activeLayer.aircraft.up.copy(WORLD_UP);
      }
    } else {
      activeLayer.aircraft.up.copy(WORLD_UP);
    }
    activeLayer.aircraft.lookAt(tempTarget);
    activeLayer.aircraft.visible = true;

    syncRouteLayerVisibility();
  }

  function syncRouteGeometry() {
    if (!routeState.selectedRoute) {
      clearRouteGeometry();
      return;
    }

    routeState.flatPath = createFlatPathForRoute(routeState.selectedRoute);
    routeState.globePath = createGlobePathForRoute(routeState.selectedRoute);
    applyLayerGeometry(flatLayer, routeState.flatPath);
    applyLayerGeometry(globeLayer, routeState.globePath);
    syncAircraftPose();
  }

  function populateSelectOptions(selectEl, items, getValue, getLabel, selectedValue) {
    const safeItems = Array.isArray(items) ? items : [];
    if (!selectEl) {
      return selectedValue ?? "";
    }

    selectEl.replaceChildren();
    for (const item of safeItems) {
      const option = document.createElement("option");
      option.value = getValue(item);
      option.textContent = getLabel(item);
      selectEl.append(option);
    }

    const optionValues = new Set(safeItems.map((item) => getValue(item)));
    const resolvedValue = optionValues.has(selectedValue)
      ? selectedValue
      : safeItems[0] ? getValue(safeItems[0]) : "";
    selectEl.value = resolvedValue;
    return resolvedValue;
  }

  function refreshRecommendedRoutePool() {
    const pairKey = `${routeState.selectedOriginContinentCode}|${routeState.selectedDestinationContinentCode}`;
    const cached = routeLibrary.recommendedRoutesByPair.get(pairKey);
    const routes = cached ?? buildRecommendedRoutesForPair({
      originContinentCode: routeState.selectedOriginContinentCode,
      destinationContinentCode: routeState.selectedDestinationContinentCode,
      getPreferredAirportsForContinent,
      getHubAirportsForContinent,
      getAirportContinentCode,
      airportByIata: routeLibrary.airportByIata,
      aircraftTypeByCode: routeLibrary.aircraftTypeByCode,
      resolveCountryName,
      resolveCountryCentroid: () => null
    });

    routeLibrary.recommendedRoutesByPair.set(pairKey, routes);
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

    const preferredDestinationContinent = (
      routeState.selectedDestinationContinentCode
      && routeLibrary.continentsWithAirports.includes(routeState.selectedDestinationContinentCode)
      && routeState.selectedDestinationContinentCode !== routeState.selectedOriginContinentCode
    )
      ? routeState.selectedDestinationContinentCode
      : (routeLibrary.continentsWithAirports.find((continentCode) => (
        continentCode !== routeState.selectedOriginContinentCode
      )) ?? routeState.selectedOriginContinentCode);

    routeState.selectedDestinationContinentCode = populateSelectOptions(
      ui.routeDestinationContinentEl,
      routeLibrary.continentsWithAirports,
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
      && routeState.selectedDestinationCountryCode !== routeState.selectedOriginCountryCode
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

    if (
      routeState.selectedOriginAirportIcao
      && routeState.selectedOriginAirportIcao === routeState.selectedDestinationAirportIcao
    ) {
      routeState.selectedDestinationAirportIcao = getDefaultAirportIcao(
        routeState.selectedDestinationCountryCode,
        routeState.selectedOriginAirportIcao
      );
      if (ui.routeDestinationAirportEl) {
        ui.routeDestinationAirportEl.value = routeState.selectedDestinationAirportIcao;
      }
    }
  }

  function syncRouteUi() {
    const route = routeState.selectedRoute;
    const cycleSeconds = BASE_ROUTE_CYCLE_SECONDS / Math.max(routeState.speedMultiplier, 1);
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
    const activePath = isSphericalView() ? routeState.globePath : routeState.flatPath;
    const phase = activePath?.getPhaseAt(routeState.progress) ?? null;
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
    setDatasetStatus("routeDatasetLoaded", routeState.libraryStatusParams);
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

  function selectRoute(routeId) {
    setRouteMode(ROUTE_MODE_RECOMMENDED);
    setRecommendedRoute(routeId);
  }

  function applyLibraryDataset(dataset, { preserveSelection = true } = {}) {
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

    const rawCountries = Array.isArray(dataset.countries) ? dataset.countries : [];
    const rawAirports = Array.isArray(dataset.airports) ? dataset.airports : [];
    const rawAircraftTypes = Array.isArray(dataset.aircraftTypes) ? dataset.aircraftTypes : [];

    routeLibrary.countryByCode = new Map();
    routeLibrary.airportByCode = new Map();
    routeLibrary.airportByIata = new Map();
    routeLibrary.airportsByCountry = new Map();
    routeLibrary.airportsByContinent = new Map();
    routeLibrary.countryContinentByCode = new Map();
    routeLibrary.aircraftTypeByCode = new Map();
    routeLibrary.recommendedRoutesByPair = new Map();

    for (const country of rawCountries) {
      const alpha2 = String(country?.alpha2 ?? "").trim().toUpperCase();
      if (!alpha2) {
        continue;
      }
      const safeCountry = {
        ...country,
        alpha2,
        name: String(country?.name ?? alpha2),
        region: String(country?.region ?? "").trim()
      };
      routeLibrary.countryByCode.set(alpha2, safeCountry);
      const continentCode = inferContinentCode(safeCountry.region);
      if (continentCode) {
        routeLibrary.countryContinentByCode.set(alpha2, continentCode);
      }
    }

    routeLibrary.airports = rawAirports
      .filter((airport) => {
        const icao = String(airport?.icao ?? "").trim().toUpperCase();
        const iata = String(airport?.iata ?? "").trim().toUpperCase();
        const countryCode = String(airport?.countryCode ?? "").trim().toUpperCase();
        const latitude = Number(airport?.latitude);
        const longitude = Number(airport?.longitude);
        return Boolean(
          icao
          && iata
          && countryCode.length === 2
          && Number.isFinite(latitude)
          && Number.isFinite(longitude)
        );
      })
      .map((airport) => ({
        ...airport,
        icao: String(airport.icao).trim().toUpperCase(),
        iata: String(airport.iata).trim().toUpperCase(),
        city: String(airport.city ?? airport.iata ?? airport.icao),
        name: String(airport.name ?? airport.city ?? airport.iata ?? airport.icao),
        countryCode: String(airport.countryCode).trim().toUpperCase(),
        latitude: Number(airport.latitude),
        longitude: Number(airport.longitude)
      }))
      .sort((left, right) => (
        compareText(left.countryCode, right.countryCode)
        || compareText(left.city, right.city)
        || compareText(left.iata, right.iata)
        || compareText(left.icao, right.icao)
      ));

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

    routeLibrary.aircraftTypes = rawAircraftTypes;
    for (const aircraftType of rawAircraftTypes) {
      const code = String(aircraftType?.icaoCode ?? "").trim().toUpperCase();
      if (!code) {
        continue;
      }
      routeLibrary.aircraftTypeByCode.set(code, {
        ...aircraftType,
        icaoCode: code
      });
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
    routeState.libraryStatusParams = {
      countries: routeLibrary.countries.length,
      airports: routeLibrary.airports.length,
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
    routeState.routeMode = preserveSelection && previousState.routeMode === ROUTE_MODE_ADVANCED
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

  async function initialize() {
    routeState.loading = true;
    setDatasetStatus("routeDatasetLoading");
    syncControlAvailability();

    try {
      const [countries, airports, aircraftTypes] = await Promise.all([
        loadJson(buildDatasetPathCandidates(DATASET_FILENAMES.countries), "countries"),
        loadJson(buildDatasetPathCandidates(DATASET_FILENAMES.airports), "airports"),
        loadJson(buildDatasetPathCandidates(DATASET_FILENAMES.aircraftTypes), "aircraftTypes")
      ]);

      routeState.loading = false;
      const applied = applyLibraryDataset(
        { countries, airports, aircraftTypes },
        { preserveSelection: false }
      );

      if (!applied) {
        setDatasetStatus("routeDatasetNoRoutes", {}, true);
      }
      syncControlAvailability();
      syncRouteUi();
    } catch (error) {
      console.error("[routes] offline dataset load failed", error);
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
      syncRouteLayerVisibility();
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

  function refreshLocalizedUi() {
    setDatasetStatus(routeState.datasetStatusKey, routeState.datasetStatusParams, routeState.datasetStatusError);
    if (routeState.libraryReady) {
      syncSelectionControls();
      syncControlAvailability();
    }
    syncRouteUi();
  }

  clearRouteGeometry();
  syncControlAvailability();
  syncRouteUi();

  return {
    initialize,
    refreshLocalizedUi,
    resetProgress,
    selectRoute,
    setRouteMode,
    setOriginContinent,
    setDestinationContinent,
    setRecommendedRoute,
    setOriginCountry,
    setOriginAirport,
    setDestinationCountry,
    setDestinationAirport,
    setSpeedMultiplier,
    syncRouteUi,
    togglePlayback,
    update
  };
}
