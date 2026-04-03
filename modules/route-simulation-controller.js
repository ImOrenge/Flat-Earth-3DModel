import * as THREE from "../vendor/three.module.js";
import {
  formatGeoPair,
  getProjectedPositionFromGeo
} from "./geo-utils.js";

const DATASET_PATHS = {
  countries: "./assets/data/countries.json",
  airports: "./assets/data/airports.json",
  aircraftTypes: "./assets/data/aircraft-types.json",
  routes: "./assets/data/routes.json"
};

const BASE_ROUTE_CYCLE_SECONDS = 120;
const ROUTE_SURFACE_OFFSET = 0.045;
const ROUTE_ALTITUDE_BASE = 0.2;
const ROUTE_ALTITUDE_SCALE = 0.55;
const ROUTE_SEGMENTS = 96;

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

function createRouteNodeLabel(node) {
  if (!node) {
    return "-";
  }

  if (node.label) {
    return node.label;
  }

  const codes = [node.iata, node.icao].filter(Boolean).join(" / ");
  if (codes && node.city) {
    return `${codes} | ${node.city}`;
  }
  if (codes) {
    return codes;
  }
  if (node.name && node.city) {
    return `${node.name} | ${node.city}`;
  }
  return node.name ?? node.city ?? "-";
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

export function createRouteSimulationController({ constants, i18n, scalableStage, ui }) {
  const scaleDimension = (value) => value * (constants.MODEL_SCALE ?? 1);
  const routeSurfaceOffset = scaleDimension(ROUTE_SURFACE_OFFSET);
  const routeAltitudeBase = scaleDimension(ROUTE_ALTITUDE_BASE);
  const routeAltitudeScale = scaleDimension(ROUTE_ALTITUDE_SCALE);
  const routeLayer = new THREE.Group();
  routeLayer.visible = false;
  scalableStage.add(routeLayer);

  const routePath = new THREE.Line(
    new THREE.BufferGeometry(),
    new THREE.LineBasicMaterial({
      color: 0x8dd5ff,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      depthTest: false
    })
  );
  routePath.renderOrder = 18;
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
      depthTest: false
    })
  );
  routePathPoints.renderOrder = 19;
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
    curve: null,
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

  function resolveCountryName(countryCode, fallbackName = null) {
    return routeLibrary.countryByCode.get(countryCode)?.name ?? fallbackName ?? countryCode ?? "-";
  }

  function resolveRoute(route) {
    if (!route) {
      return null;
    }

    const origin = route.origin ?? routeLibrary.airportByCode.get(route.originIcao);
    const destination = route.destination ?? routeLibrary.airportByCode.get(route.destinationIcao);
    const aircraftType = routeLibrary.aircraftTypeByCode.get(route.aircraftTypeCode);

    if (!origin || !destination) {
      return null;
    }

    return {
      ...route,
      aircraftType,
      destination,
      destinationCountryName: resolveCountryName(destination.countryCode, destination.countryName ?? destination.city),
      origin,
      originCountryName: resolveCountryName(origin.countryCode, origin.countryName ?? origin.city)
    };
  }

  function createCurvePoint(node) {
    const altitudeOffset = Number.isFinite(node?.altitude)
      ? scaleDimension(node.altitude)
      : routeAltitudeBase + (routeAltitudeScale * Math.max(0, Number(node?.altitudeFactor) || 0));
    const point = getProjectedPositionFromGeo(
      node.latitude,
      node.longitude,
      constants.DISC_RADIUS,
      constants.SURFACE_Y + routeSurfaceOffset + altitudeOffset
    );

    return new THREE.Vector3(point.x, point.y, point.z);
  }

  function createCurveForRoute(route) {
    if (Array.isArray(route.waypoints) && route.waypoints.length > 0) {
      const pathNodes = [route.origin, ...route.waypoints, route.destination]
        .filter((node) => Number.isFinite(node?.latitude) && Number.isFinite(node?.longitude))
        .map((node) => createCurvePoint(node));

      if (pathNodes.length >= 3) {
        return new THREE.CatmullRomCurve3(pathNodes, false, "centripetal", 0.42);
      }
    }

    const startData = getProjectedPositionFromGeo(
      route.origin.latitude,
      route.origin.longitude,
      constants.DISC_RADIUS,
      constants.SURFACE_Y + routeSurfaceOffset
    );
    const endData = getProjectedPositionFromGeo(
      route.destination.latitude,
      route.destination.longitude,
      constants.DISC_RADIUS,
      constants.SURFACE_Y + routeSurfaceOffset
    );

    const start = new THREE.Vector3(startData.x, startData.y, startData.z);
    const end = new THREE.Vector3(endData.x, endData.y, endData.z);
    const control = start.clone().lerp(end, 0.5);
    const distance = start.distanceTo(end);
    control.y += routeAltitudeBase + Math.min(distance * 0.14, routeAltitudeScale);

    return new THREE.QuadraticBezierCurve3(start, control, end);
  }

  function syncAircraftPose() {
    if (!routeState.curve || !routeState.selectedRoute) {
      routeLayer.visible = false;
      return;
    }

    const clampedProgress = THREE.MathUtils.clamp(routeState.progress, 0, 1);
    routeState.curve.getPointAt(clampedProgress, tempPoint);
    routeState.curve.getTangentAt(clampedProgress, tempTangent);
    tempTarget.copy(tempPoint).add(tempTangent);

    aircraft.position.copy(tempPoint);
    aircraft.lookAt(tempTarget);
    routeLayer.visible = true;
  }

  function syncRouteGeometry() {
    if (!routeState.selectedRoute) {
      routeLayer.visible = false;
      routeState.curve = null;
      routePath.geometry.setFromPoints([]);
      routePathPoints.geometry.setFromPoints([]);
      return;
    }

    routeState.curve = createCurveForRoute(routeState.selectedRoute);
    const sampledPoints = routeState.curve.getPoints(ROUTE_SEGMENTS);
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
    const aircraftLabel = route.vehicleLabel ?? (
      route.aircraftType
        ? `${route.aircraftType.name} (${route.aircraftType.icaoCode})`
        : (route.aircraftTypeCode ?? "-")
    );
    const originLabel = createRouteNodeLabel(route.origin);
    const destinationLabel = createRouteNodeLabel(route.destination);
    const originCode = route.origin.iata ?? route.origin.icao ?? route.origin.code ?? route.origin.name ?? "?";
    const destinationCode = route.destination.iata ?? route.destination.icao ?? route.destination.code ?? route.destination.name ?? "?";

    ui.routeSummaryEl.textContent = i18n.t("routeSummaryActiveText", {
      origin: originLabel,
      destination: destinationLabel,
      duration: formatDurationHours(route.durationHours, i18n)
    });
    ui.routeLegEl.textContent = `${originCode} -> ${destinationCode}`;
    ui.routeOriginEl.textContent = originLabel;
    ui.routeDestinationEl.textContent = destinationLabel;
    ui.routeCountriesEl.textContent = i18n.t("routeCountriesValue", {
      originCountry: route.originCountryName,
      destinationCountry: route.destinationCountryName
    });
    ui.routeAircraftEl.textContent = aircraftLabel;
    ui.routeProgressEl.textContent = progressLabel;
    ui.routeDurationEl.textContent = formatDurationHours(route.durationHours, i18n);
    ui.routeGeoSummaryEl.textContent = i18n.t("routeGeoPathValue", {
      originGeo: formatGeoPair(route.origin.latitude, route.origin.longitude),
      destinationGeo: formatGeoPair(route.destination.latitude, route.destination.longitude)
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
      option.textContent = route.optionLabel ?? `${resolvedRoute.origin.iata ?? resolvedRoute.origin.code ?? resolvedRoute.origin.name}-${resolvedRoute.destination.iata ?? resolvedRoute.destination.code ?? resolvedRoute.destination.name} | ${route.vehicleLabel ?? route.aircraftTypeCode ?? route.id}`;
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
