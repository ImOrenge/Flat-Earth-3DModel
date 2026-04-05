import * as THREE from "../../vendor/three.module.js";
import {
  formatGeoPair,
  getGlobeNormalFromGeo,
  getGlobePositionFromGeo
} from "./geo-utils.js";

const DATASET_PATHS = {
  countries: "../assets/data/countries.json",
  airports: "../assets/data/airports.json",
  aircraftTypes: "../assets/data/aircraft-types.json",
  routes: "../assets/data/routes.json"
};

const BASE_ROUTE_CYCLE_SECONDS = 120;
const EARTH_RADIUS_KM = 6371;
const ROUTE_SEGMENTS = 128;
const ROUTE_ALTITUDE_VISUAL_BOOST = 8;
const ROUTE_ALTITUDE_MIN_RATIO = 0.006;
const ROUTE_ALTITUDE_MAX_RATIO = 0.12;
const ROUTE_MARKER_SURFACE_RATIO = 0.005;

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

async function loadJson(path) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to load ${path}`);
  }
  return response.json();
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
  const markerSurfaceOffset = Math.max(scaleDimension(0.018), globeRadius * ROUTE_MARKER_SURFACE_RATIO);
  const routeLayer = new THREE.Group();
  routeLayer.visible = false;
  routeStage.add(routeLayer);

  const routePath = new THREE.Line(
    new THREE.BufferGeometry(),
    new THREE.LineBasicMaterial({
      color: 0x8dd5ff,
      transparent: true,
      opacity: 0.95
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
      depthWrite: false
    })
  );
  routeLayer.add(routePathPoints);

  const originMarker = new THREE.Mesh(
    new THREE.SphereGeometry(scaleDimension(0.055), 20, 16),
    new THREE.MeshStandardMaterial({
      color: 0x8dffbc,
      emissive: 0x4fcf84,
      emissiveIntensity: 0.8,
      roughness: 0.25,
      metalness: 0.06
    })
  );
  routeLayer.add(originMarker);

  const destinationMarker = new THREE.Mesh(
    new THREE.SphereGeometry(scaleDimension(0.055), 20, 16),
    new THREE.MeshStandardMaterial({
      color: 0xffc882,
      emissive: 0xffa44d,
      emissiveIntensity: 0.85,
      roughness: 0.24,
      metalness: 0.06
    })
  );
  routeLayer.add(destinationMarker);

  const aircraft = createAircraftModel(scaleDimension);
  routeLayer.add(aircraft);

  const routeLibrary = {
    countries: [],
    airports: [],
    aircraftTypes: [],
    routes: [],
    countryByCode: new Map(),
    airportByCode: new Map(),
    aircraftTypeByCode: new Map(),
    routeById: new Map()
  };

  const routeState = {
    path: null,
    datasetStatusError: false,
    datasetStatusKey: "routeDatasetLoading",
    datasetStatusParams: {},
    loading: true,
    playing: true,
    progress: 0,
    ready: false,
    selectedRoute: null,
    selectedRouteId: "",
    speedMultiplier: Number(ui.routeSpeedEl?.value ?? 8)
  };

  const tempPoint = new THREE.Vector3();
  const tempTangent = new THREE.Vector3();
  const tempTarget = new THREE.Vector3();
  const tempUp = new THREE.Vector3();
  const tempUnit = new THREE.Vector3();
  const globeLocalCenter = new THREE.Vector3();
  void globeCenter;

  function setDatasetStatus(key, params = {}, error = false) {
    routeState.datasetStatusKey = key;
    routeState.datasetStatusParams = params;
    routeState.datasetStatusError = error;
    ui.routeDatasetStatusEl.textContent = i18n.t(key, params);
    ui.routeDatasetStatusEl.classList.toggle("error", error);
  }

  function syncControlAvailability() {
    const disabled = !routeState.ready;
    ui.routeSelectEl.disabled = disabled;
    ui.routeSpeedEl.disabled = disabled;
    ui.routePlaybackButton.disabled = disabled;
    ui.routeResetButton.disabled = disabled;
  }

  function resolveCountryName(countryCode) {
    return routeLibrary.countryByCode.get(countryCode)?.name ?? countryCode;
  }

  function resolveRoute(route) {
    if (!route) {
      return null;
    }

    const origin = routeLibrary.airportByCode.get(route.originIcao);
    const destination = routeLibrary.airportByCode.get(route.destinationIcao);
    const aircraftType = routeLibrary.aircraftTypeByCode.get(route.aircraftTypeCode);

    if (!origin || !destination) {
      return null;
    }

    return {
      ...route,
      aircraftType,
      destination,
      destinationCountryName: resolveCountryName(destination.countryCode),
      origin,
      originCountryName: resolveCountryName(origin.countryCode)
    };
  }

  function getCruiseAltitudeUnits(route) {
    const altitudeKm = Math.max(0, Number(route.cruiseAltitudeFt) || 0) * 0.0003048;
    const altitudeUnitsRaw = globeRadius * (altitudeKm / EARTH_RADIUS_KM);
    const minAltitude = globeRadius * ROUTE_ALTITUDE_MIN_RATIO;
    const maxAltitude = globeRadius * ROUTE_ALTITUDE_MAX_RATIO;
    return THREE.MathUtils.clamp(
      altitudeUnitsRaw * ROUTE_ALTITUDE_VISUAL_BOOST,
      minAltitude,
      maxAltitude
    );
  }

  function createPathForRoute(route) {
    const startNormalData = getGlobeNormalFromGeo(route.origin.latitude, route.origin.longitude);
    const endNormalData = getGlobeNormalFromGeo(route.destination.latitude, route.destination.longitude);
    const startUnit = new THREE.Vector3(startNormalData.x, startNormalData.y, startNormalData.z).normalize();
    const endUnit = new THREE.Vector3(endNormalData.x, endNormalData.y, endNormalData.z).normalize();
    const centralAngle = startUnit.angleTo(endUnit);
    const greatCircleDistanceKm = centralAngle * EARTH_RADIUS_KM;
    const cruiseAltitudeUnits = getCruiseAltitudeUnits(route);
    const sampledPoints = [];

    for (let index = 0; index <= ROUTE_SEGMENTS; index += 1) {
      const t = index / ROUTE_SEGMENTS;

      if (centralAngle < 1e-6) {
        tempUnit.copy(startUnit);
      } else {
        tempUnit.slerpVectors(startUnit, endUnit, t).normalize();
      }

      const altitudeOffset = cruiseAltitudeUnits * Math.sin(Math.PI * t);
      const position = getGlobePositionFromGeo(
        THREE.MathUtils.radToDeg(Math.asin(tempUnit.y)),
        THREE.MathUtils.radToDeg(Math.atan2(tempUnit.z, tempUnit.x)),
        globeRadius + markerSurfaceOffset + altitudeOffset,
        globeLocalCenter
      );
      sampledPoints.push(new THREE.Vector3(position.x, position.y, position.z));
    }

    return {
      ...createSampledPath(sampledPoints),
      centralAngle,
      cruiseAltitudeUnits,
      greatCircleDistanceKm
    };
  }

  function syncAircraftPose() {
    if (!routeState.path || !routeState.selectedRoute) {
      routeLayer.visible = false;
      return;
    }

    const clampedProgress = THREE.MathUtils.clamp(routeState.progress, 0, 1);
    routeState.path.getPointAt(clampedProgress, tempPoint);
    routeState.path.getTangentAt(clampedProgress, tempTangent);
    tempUp.copy(tempPoint).normalize();
    tempTarget.copy(tempPoint).add(tempTangent);

    aircraft.position.copy(tempPoint);
    aircraft.up.copy(tempUp);
    aircraft.lookAt(tempTarget);
    routeLayer.visible = true;
  }

  function syncRouteGeometry() {
    if (!routeState.selectedRoute) {
      routeLayer.visible = false;
      routeState.path = null;
      routePath.geometry.setFromPoints([]);
      routePathPoints.geometry.setFromPoints([]);
      return;
    }

    routeState.path = createPathForRoute(routeState.selectedRoute);
    const sampledPoints = routeState.path.points;
    const markerPoints = sampledPoints.filter((_, index) => index % 8 === 0);

    routePath.geometry.setFromPoints(sampledPoints);
    routePathPoints.geometry.setFromPoints(markerPoints);
    originMarker.position.copy(sampledPoints[0]);
    destinationMarker.position.copy(sampledPoints[sampledPoints.length - 1]);
    syncAircraftPose();
  }

  function syncRouteUi() {
    const route = routeState.selectedRoute;
    const cycleSeconds = BASE_ROUTE_CYCLE_SECONDS / Math.max(routeState.speedMultiplier, 1);
    ui.routeSpeedValueEl.textContent = i18n.t("routeSpeedValue", {
      speed: routeState.speedMultiplier,
      cycle: cycleSeconds.toFixed(1)
    });
    ui.routePlaybackButton.textContent = routeState.playing
      ? i18n.t("routePauseButton")
      : i18n.t("routePlayButton");

    if (!route) {
      ui.routeSummaryEl.textContent = i18n.t("routeSummaryNone");
      ui.routeLegEl.textContent = i18n.t("routeSelectPrompt");
      ui.routeOriginEl.textContent = "-";
      ui.routeDestinationEl.textContent = "-";
      ui.routeCountriesEl.textContent = "-";
      ui.routeAircraftEl.textContent = "-";
      ui.routeProgressEl.textContent = "-";
      ui.routeDurationEl.textContent = "-";
      ui.routeGeoSummaryEl.textContent = i18n.t("routeGeoSummaryPlaceholder");
      return;
    }

    const elapsedHours = route.durationHours * routeState.progress;
    const remainingHours = Math.max(route.durationHours - elapsedHours, 0);
    const progressLabel = i18n.t("routeProgressSummary", {
      percent: Math.round(routeState.progress * 100),
      elapsed: formatDurationHours(elapsedHours, i18n),
      remaining: formatDurationHours(remainingHours, i18n)
    });
    const aircraftLabel = route.aircraftType
      ? `${route.aircraftType.name} (${route.aircraftType.icaoCode})`
      : route.aircraftTypeCode;
    const cruiseLabel = `${Math.round((route.cruiseAltitudeFt ?? 0) / 100) * 100} ft`;
    const greatCircleLabel = `${Math.round(routeState.path?.greatCircleDistanceKm ?? 0).toLocaleString()} km`;

    ui.routeSummaryEl.textContent = i18n.t("routeSummaryActiveText", {
      origin: createAirportLabel(route.origin),
      destination: createAirportLabel(route.destination),
      duration: formatDurationHours(route.durationHours, i18n),
      cruise: cruiseLabel,
      greatCircle: greatCircleLabel
    });
    ui.routeLegEl.textContent = `${route.origin.iata} -> ${route.destination.iata}`;
    ui.routeOriginEl.textContent = createAirportLabel(route.origin);
    ui.routeDestinationEl.textContent = createAirportLabel(route.destination);
    ui.routeCountriesEl.textContent = i18n.t("routeCountriesValue", {
      originCountry: route.originCountryName,
      destinationCountry: route.destinationCountryName
    });
    ui.routeAircraftEl.textContent = aircraftLabel;
    ui.routeProgressEl.textContent = progressLabel;
    ui.routeDurationEl.textContent = formatDurationHours(route.durationHours, i18n);
    ui.routeGeoSummaryEl.textContent = i18n.t("routeGeoPathValue", {
      originGeo: formatGeoPair(route.origin.latitude, route.origin.longitude),
      destinationGeo: formatGeoPair(route.destination.latitude, route.destination.longitude),
      cruise: cruiseLabel,
      greatCircle: greatCircleLabel
    });
  }

  function populateRouteOptions() {
    ui.routeSelectEl.replaceChildren();

    for (const route of routeLibrary.routes) {
      const resolvedRoute = resolveRoute(route);
      if (!resolvedRoute) {
        continue;
      }

      const option = document.createElement("option");
      option.value = route.id;
      option.textContent = `${resolvedRoute.origin.iata}-${resolvedRoute.destination.iata} | ${route.aircraftTypeCode}`;
      ui.routeSelectEl.append(option);
    }
  }

  async function initialize() {
    setDatasetStatus("routeDatasetLoading");
    syncControlAvailability();

    try {
      const [countries, airports, aircraftTypes, routes] = await Promise.all([
        loadJson(DATASET_PATHS.countries),
        loadJson(DATASET_PATHS.airports),
        loadJson(DATASET_PATHS.aircraftTypes),
        loadJson(DATASET_PATHS.routes)
      ]);

      routeLibrary.countries = countries;
      routeLibrary.airports = airports;
      routeLibrary.aircraftTypes = aircraftTypes;
      routeLibrary.routes = routes;
      routeLibrary.countryByCode = new Map(countries.map((country) => [country.alpha2, country]));
      routeLibrary.airportByCode = new Map();
      routeLibrary.aircraftTypeByCode = new Map();
      routeLibrary.routeById = new Map(routes.map((route) => [route.id, route]));

      for (const airport of airports) {
        routeLibrary.airportByCode.set(airport.icao, airport);
      }

      for (const aircraftType of aircraftTypes) {
        routeLibrary.aircraftTypeByCode.set(aircraftType.icaoCode, aircraftType);
      }

      populateRouteOptions();
      routeState.ready = ui.routeSelectEl.options.length > 0;
      routeState.loading = false;
      syncControlAvailability();

      if (!routeState.ready) {
        setDatasetStatus("routeDatasetNoRoutes", {}, true);
        syncRouteUi();
        return;
      }

      setDatasetStatus("routeDatasetLoaded", {
        routes: routes.length,
        airports: airports.length,
        aircraftTypes: aircraftTypes.length
      });
      selectRoute(ui.routeSelectEl.value || routes[0].id);
    } catch (error) {
      routeState.loading = false;
      routeState.ready = false;
      routeState.playing = false;
      syncControlAvailability();
      setDatasetStatus("routeDatasetFailed", {}, true);
      syncRouteUi();
    }
  }

  function selectRoute(routeId) {
    if (!routeState.ready) {
      return;
    }

    const route = resolveRoute(routeLibrary.routeById.get(routeId));
    if (!route) {
      setDatasetStatus("routeMissingMetadata", { routeId }, true);
      return;
    }

    routeState.selectedRouteId = routeId;
    routeState.selectedRoute = route;
    routeState.progress = 0;
    ui.routeSelectEl.value = routeId;
    syncRouteGeometry();
    syncRouteUi();
  }

  function setSpeedMultiplier(value) {
    routeState.speedMultiplier = Math.max(1, Number(value) || 1);
    syncRouteUi();
  }

  function togglePlayback() {
    if (!routeState.ready) {
      return;
    }
    routeState.playing = !routeState.playing;
    syncRouteUi();
  }

  function resetProgress() {
    routeState.progress = 0;
    syncAircraftPose();
    syncRouteUi();
  }

  function update(deltaSeconds) {
    if (!routeState.ready || !routeState.playing || !routeState.selectedRoute) {
      return;
    }

    routeState.progress += (deltaSeconds * routeState.speedMultiplier) / BASE_ROUTE_CYCLE_SECONDS;
    if (routeState.progress >= 1) {
      routeState.progress %= 1;
    }

    syncAircraftPose();
    syncRouteUi();
  }

  function refreshLocalizedUi() {
    setDatasetStatus(routeState.datasetStatusKey, routeState.datasetStatusParams, routeState.datasetStatusError);
    syncRouteUi();
  }

  globeSurface.updateMatrixWorld?.(true);
  syncRouteUi();

  return {
    initialize,
    refreshLocalizedUi,
    resetProgress,
    selectRoute,
    setSpeedMultiplier,
    syncRouteUi,
    togglePlayback,
    update
  };
}
