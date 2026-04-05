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
const ROUTE_MARKER_STEP = 8;
const GLOBE_RADIUS_FALLBACK_SCALE = 0.82;

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
      depthTest,
      depthWrite: false
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
      metalness: 0.06,
      depthTest,
      depthWrite: false
    })
  );
  routeLayer.add(destinationMarker);

  const aircraft = createAircraftModel(scaleDimension);
  routeLayer.add(aircraft);

  return {
    aircraft,
    destinationMarker,
    originMarker,
    routeLayer,
    routePath,
    routePathPoints
  };
}

async function loadJson(path) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to load ${path}`);
  }
  return response.json();
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
    routes: [],
    countryByCode: new Map(),
    airportByCode: new Map(),
    aircraftTypeByCode: new Map(),
    routeById: new Map()
  };

  const routeState = {
    datasetStatusError: false,
    datasetStatusKey: "routeDatasetLoading",
    datasetStatusParams: {},
    flatCurve: null,
    globeCurve: null,
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
  const tempGlobeCenter = new THREE.Vector3();
  const tempGreatCircleStart = new THREE.Vector3();
  const tempGreatCircleEnd = new THREE.Vector3();
  const tempGreatCircleSample = new THREE.Vector3();
  const tempGreatCircleAxis = new THREE.Vector3();
  const tempGreatCircleStartScaled = new THREE.Vector3();
  const tempGreatCircleEndScaled = new THREE.Vector3();
  const tempGreatCirclePoint = new THREE.Vector3();

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

  function syncRouteLayerVisibility() {
    const hasRoute = Boolean(routeState.selectedRoute && routeState.flatCurve && routeState.globeCurve);
    const spherical = isSphericalView();
    flatLayer.routeLayer.visible = hasRoute && !spherical;
    globeLayer.routeLayer.visible = hasRoute && spherical;
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

  function createFlatCurveForRoute(route) {
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

  function sampleGreatCircle(startUnit, endUnit, t, target) {
    const dot = THREE.MathUtils.clamp(startUnit.dot(endUnit), -1, 1);
    if (dot > 0.9999) {
      return target.copy(startUnit).lerp(endUnit, t).normalize();
    }

    if (dot < -0.9995) {
      tempGreatCircleAxis.copy(startUnit).cross(WORLD_UP);
      if (tempGreatCircleAxis.lengthSq() < 1e-8) {
        tempGreatCircleAxis.copy(startUnit).cross(WORLD_RIGHT);
      }
      tempGreatCircleAxis.normalize();
      return target.copy(startUnit).applyAxisAngle(tempGreatCircleAxis, Math.PI * t).normalize();
    }

    const theta = Math.acos(dot);
    const sinTheta = Math.sin(theta);
    if (sinTheta < 1e-8) {
      return target.copy(startUnit).lerp(endUnit, t).normalize();
    }
    const weightStart = Math.sin((1 - t) * theta) / sinTheta;
    const weightEnd = Math.sin(t * theta) / sinTheta;
    return target
      .copy(startUnit)
      .multiplyScalar(weightStart)
      .addScaledVector(endUnit, weightEnd)
      .normalize();
  }

  function createGlobeCurveForRoute(route) {
    geoToUnitVector(route.origin.latitude, route.origin.longitude, tempGreatCircleStart);
    geoToUnitVector(route.destination.latitude, route.destination.longitude, tempGreatCircleEnd);

    const baseRadius = getGlobeRadius() + routeSurfaceOffset;
    tempGreatCircleStartScaled.copy(tempGreatCircleStart).multiplyScalar(baseRadius);
    tempGreatCircleEndScaled.copy(tempGreatCircleEnd).multiplyScalar(baseRadius);
    const distance = tempGreatCircleStartScaled.distanceTo(tempGreatCircleEndScaled);
    const peakArc = routeAltitudeBase + Math.min(distance * 0.14, routeAltitudeScale);

    const sampledPoints = [];
    for (let index = 0; index <= ROUTE_SEGMENTS; index += 1) {
      const t = index / ROUTE_SEGMENTS;
      sampleGreatCircle(tempGreatCircleStart, tempGreatCircleEnd, t, tempGreatCircleSample);
      const radius = baseRadius + (Math.sin(Math.PI * t) * peakArc);
      tempGreatCirclePoint.copy(tempGreatCircleSample).multiplyScalar(radius).add(getGlobeCenter());
      sampledPoints.push(tempGreatCirclePoint.clone());
    }

    return {
      curve: new THREE.CatmullRomCurve3(sampledPoints, false, "centripetal", 0.5),
      sampledPoints
    };
  }

  function clearLayerGeometry(layer) {
    layer.routePath.geometry.setFromPoints([]);
    layer.routePathPoints.geometry.setFromPoints([]);
  }

  function applyLayerGeometry(layer, sampledPoints) {
    if (!sampledPoints.length) {
      clearLayerGeometry(layer);
      return;
    }

    const markerPoints = sampledPoints.filter(
      (_, index) => index % ROUTE_MARKER_STEP === 0 || index === sampledPoints.length - 1
    );

    layer.routePath.geometry.setFromPoints(sampledPoints);
    layer.routePathPoints.geometry.setFromPoints(markerPoints);
    layer.originMarker.position.copy(sampledPoints[0]);
    layer.destinationMarker.position.copy(sampledPoints[sampledPoints.length - 1]);
  }

  function syncAircraftPose() {
    if (!routeState.selectedRoute) {
      flatLayer.routeLayer.visible = false;
      globeLayer.routeLayer.visible = false;
      return;
    }

    const spherical = isSphericalView();
    const activeCurve = spherical ? routeState.globeCurve : routeState.flatCurve;
    const activeLayer = spherical ? globeLayer : flatLayer;
    const inactiveLayer = spherical ? flatLayer : globeLayer;
    inactiveLayer.aircraft.visible = false;

    if (!activeCurve) {
      syncRouteLayerVisibility();
      return;
    }

    const clampedProgress = THREE.MathUtils.clamp(routeState.progress, 0, 1);
    activeCurve.getPointAt(clampedProgress, tempPoint);
    activeCurve.getTangentAt(clampedProgress, tempTangent);
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
      routeState.flatCurve = null;
      routeState.globeCurve = null;
      clearLayerGeometry(flatLayer);
      clearLayerGeometry(globeLayer);
      syncRouteLayerVisibility();
      return;
    }

    routeState.flatCurve = createFlatCurveForRoute(routeState.selectedRoute);
    const flatPoints = routeState.flatCurve.getPoints(ROUTE_SEGMENTS);
    applyLayerGeometry(flatLayer, flatPoints);

    const globeRoute = createGlobeCurveForRoute(routeState.selectedRoute);
    routeState.globeCurve = globeRoute.curve;
    applyLayerGeometry(globeLayer, globeRoute.sampledPoints);

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

    ui.routeSummaryEl.textContent = i18n.t("routeSummaryActiveText", {
      origin: createAirportLabel(route.origin),
      destination: createAirportLabel(route.destination),
      duration: formatDurationHours(route.durationHours, i18n)
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
    if (!routeState.ready || !routeState.selectedRoute) {
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
    syncRouteUi();
  }

  syncRouteUi();
  syncRouteLayerVisibility();

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
