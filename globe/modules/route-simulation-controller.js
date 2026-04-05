import * as THREE from "../../vendor/three.module.js";
import {
  createGlobeModelFrame,
  formatGeoPair,
  getGlobeNormalFromGeo,
  getGlobePositionFromNormal,
  getGlobePositionFromGeo
} from "./geo-utils.js";
import { createRouteDataService } from "./route-data-service.js";

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

  const routeLibrary = {
    countries: [],
    countryCentroids: [],
    airports: [],
    aircraftTypes: [],
    countryByCode: new Map(),
    countryCentroidByCode: new Map(),
    airportByCode: new Map(),
    airportsByCountry: new Map(),
    aircraftTypeByCode: new Map()
  };

  const routeDataService = createRouteDataService();

  const routeState = {
    path: null,
    datasetStatusError: false,
    datasetStatusKey: "routeDatasetLoading",
    datasetStatusParams: {},
    libraryReady: false,
    loading: true,
    playing: true,
    progress: 0,
    selectedOriginCountryCode: "",
    selectedOriginAirportIcao: "",
    selectedDestinationCountryCode: "",
    selectedDestinationAirportIcao: "",
    selectedRoute: null,
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
    ui.routeOriginCountryEl.disabled = datasetDisabled;
    ui.routeOriginAirportEl.disabled = datasetDisabled;
    ui.routeDestinationCountryEl.disabled = datasetDisabled;
    ui.routeDestinationAirportEl.disabled = datasetDisabled;

    const routeDisabled = datasetDisabled || !routeState.selectedRoute;
    ui.routeSpeedEl.disabled = routeDisabled;
    ui.routePlaybackButton.disabled = routeDisabled;
    ui.routeResetButton.disabled = routeDisabled;
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

  function buildDynamicRoute(originAirport, destinationAirport) {
    const greatCircleDistanceKm = computeGreatCircleDistanceKm(originAirport, destinationAirport);
    const distanceProfile = resolveDistanceProfile(greatCircleDistanceKm);
    const durationHours = (
      greatCircleDistanceKm / (distanceProfile.cruiseSpeedKts * 1.852)
    ) + distanceProfile.blockBufferHours;

    return {
      id: `${originAirport.icao.toLowerCase()}-${destinationAirport.icao.toLowerCase()}`,
      origin: originAirport,
      destination: destinationAirport,
      originCountryName: resolveCountryName(originAirport.countryCode),
      destinationCountryName: resolveCountryName(destinationAirport.countryCode),
      originCountryCentroid: resolveCountryCentroid(originAirport.countryCode, originAirport),
      destinationCountryCentroid: resolveCountryCentroid(destinationAirport.countryCode, destinationAirport),
      aircraftTypeCode: distanceProfile.aircraftTypeCode,
      aircraftType: routeLibrary.aircraftTypeByCode.get(distanceProfile.aircraftTypeCode) ?? null,
      cruiseAltitudeFt: distanceProfile.cruiseAltitudeFt,
      cruiseSpeedKts: distanceProfile.cruiseSpeedKts,
      durationHours,
      greatCircleDistanceKm
    };
  }

  function createPathForRoute(route) {
    const startNormalData = getGlobeNormalFromGeo(route.origin.latitude, route.origin.longitude, routeFrame);
    const endNormalData = getGlobeNormalFromGeo(route.destination.latitude, route.destination.longitude, routeFrame);
    const startUnit = new THREE.Vector3(startNormalData.x, startNormalData.y, startNormalData.z).normalize();
    const endUnit = new THREE.Vector3(endNormalData.x, endNormalData.y, endNormalData.z).normalize();
    const centralAngle = startUnit.angleTo(endUnit);
    const greatCircleDistanceKm = route.greatCircleDistanceKm ?? (centralAngle * EARTH_RADIUS_KM);
    const cruiseAltitudeUnits = getCruiseAltitudeUnits(route);
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
      greatCircleDistanceKm
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
  }

  function syncAircraftPose() {
    if (!routeState.path || !routeState.selectedRoute) {
      aircraft.visible = false;
      routeLayer.visible = false;
      return;
    }

    const clampedProgress = THREE.MathUtils.clamp(routeState.progress, 0, 1);
    routeState.path.getPointAt(clampedProgress, tempPoint);
    routeState.path.getTangentAt(clampedProgress, tempTangent);
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

  function syncSelectionControls() {
    routeState.selectedOriginCountryCode = populateSelectOptions(
      ui.routeOriginCountryEl,
      routeLibrary.countries,
      (country) => country.alpha2,
      (country) => country.name,
      routeState.selectedOriginCountryCode
    );
    routeState.selectedDestinationCountryCode = populateSelectOptions(
      ui.routeDestinationCountryEl,
      routeLibrary.countries,
      (country) => country.alpha2,
      (country) => country.name,
      routeState.selectedDestinationCountryCode
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
    const { origin: selectedOrigin, destination: selectedDestination } = getSelectedAirports();
    const cycleSeconds = BASE_ROUTE_CYCLE_SECONDS / Math.max(routeState.speedMultiplier, 1);
    syncDatasetMetaUi();

    ui.routeSpeedValueEl.textContent = i18n.t("routeSpeedValue", {
      speed: routeState.speedMultiplier,
      cycle: cycleSeconds.toFixed(1)
    });
    ui.routePlaybackButton.textContent = routeState.playing
      ? i18n.t("routePauseButton")
      : i18n.t("routePlayButton");

    const originCountryName = selectedOrigin
      ? resolveCountryName(selectedOrigin.countryCode)
      : resolveCountryName(routeState.selectedOriginCountryCode);
    const destinationCountryName = selectedDestination
      ? resolveCountryName(selectedDestination.countryCode)
      : resolveCountryName(routeState.selectedDestinationCountryCode);

    ui.routeLegEl.textContent = selectedOrigin && selectedDestination
      ? `${selectedOrigin.iata} -> ${selectedDestination.iata}`
      : i18n.t("routeSelectPrompt");
    ui.routeOriginEl.textContent = selectedOrigin ? createAirportLabel(selectedOrigin) : "-";
    ui.routeDestinationEl.textContent = selectedDestination ? createAirportLabel(selectedDestination) : "-";
    ui.routeCountriesEl.textContent = originCountryName && destinationCountryName
      ? i18n.t("routeCountriesValue", {
        originCountry: originCountryName,
        destinationCountry: destinationCountryName
      })
      : "-";

    if (!route) {
      ui.routeSummaryEl.textContent = i18n.t(
        routeState.selectionErrorKey || "routeSummaryNone",
        routeState.selectionErrorParams
      );
      ui.routeAircraftEl.textContent = "-";
      ui.routeProgressEl.textContent = "-";
      ui.routeDurationEl.textContent = "-";

      if (selectedOrigin && selectedDestination) {
        ui.routeGeoSummaryEl.textContent = i18n.t("routeGeoSelectionValue", {
          originGeo: formatGeoPair(selectedOrigin.latitude, selectedOrigin.longitude),
          destinationGeo: formatGeoPair(selectedDestination.latitude, selectedDestination.longitude)
        });
      } else {
        ui.routeGeoSummaryEl.textContent = i18n.t("routeGeoSummaryPlaceholder");
      }
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
    const greatCircleLabel = formatDistanceKm(route.greatCircleDistanceKm);

    ui.routeSummaryEl.textContent = i18n.t("routeSummaryActiveText", {
      originCountry: route.originCountryName,
      originAirport: createAirportLabel(route.origin),
      destinationCountry: route.destinationCountryName,
      destinationAirport: createAirportLabel(route.destination),
      duration: formatDurationHours(route.durationHours, i18n),
      cruise: cruiseLabel,
      greatCircle: greatCircleLabel
    });
    ui.routeAircraftEl.textContent = aircraftLabel;
    ui.routeProgressEl.textContent = progressLabel;
    ui.routeDurationEl.textContent = formatDurationHours(route.durationHours, i18n);
    ui.routeGeoSummaryEl.textContent = i18n.t("routeGeoPathValue", {
      originGeo: formatGeoPair(route.origin.latitude, route.origin.longitude),
      destinationGeo: formatGeoPair(route.destination.latitude, route.destination.longitude),
      greatCircle: greatCircleLabel
    });
  }

  function applyLoadedStatus() {
    setDatasetStatus("routeDatasetLoaded", {
      ...routeState.libraryStatusParams,
      source: i18n.t(getSourceLabelKey(routeState.datasetSource))
    });
  }

  function applySelectionChange(resetProgress = true) {
    if (resetProgress) {
      routeState.progress = 0;
    }

    syncSelectionControls();

    const { origin, destination } = getSelectedAirports();
    if (!origin || !destination) {
      routeState.selectedRoute = null;
      clearSelectionError();
      clearRouteGeometry();
      syncControlAvailability();
      applyLoadedStatus();
      syncRouteUi();
      return;
    }

    if (origin.icao === destination.icao) {
      routeState.selectedRoute = null;
      setSelectionError("routeSelectionConflict");
      clearRouteGeometry();
      syncControlAvailability();
      setDatasetStatus("routeSelectionConflict", {}, true);
      syncRouteUi();
      return;
    }

    clearSelectionError();
    routeState.selectedRoute = buildDynamicRoute(origin, destination);
    applyLoadedStatus();
    syncRouteGeometry();
    syncControlAvailability();
    syncRouteUi();
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
    const previousOriginCountry = routeState.selectedOriginCountryCode;
    const previousDestinationCountry = routeState.selectedDestinationCountryCode;
    const previousOriginAirport = routeState.selectedOriginAirportIcao;
    const previousDestinationAirport = routeState.selectedDestinationAirportIcao;
    const previousSelectionKey = `${previousOriginAirport}|${previousDestinationAirport}`;

    routeLibrary.countries = [];
    routeLibrary.countryCentroids = Array.isArray(dataset.countryCentroids) ? dataset.countryCentroids : [];
    routeLibrary.airports = Array.isArray(dataset.airports) ? [...dataset.airports].sort((left, right) => (
      compareText(left.countryCode, right.countryCode)
      || compareText(left.city, right.city)
      || compareText(left.iata, right.iata)
    )) : [];
    routeLibrary.aircraftTypes = Array.isArray(dataset.aircraftTypes) ? dataset.aircraftTypes : [];
    routeLibrary.countryByCode = new Map();
    routeLibrary.countryCentroidByCode = new Map();
    routeLibrary.airportByCode = new Map();
    routeLibrary.airportsByCountry = new Map();
    routeLibrary.aircraftTypeByCode = new Map();

    for (const country of (Array.isArray(dataset.countries) ? dataset.countries : [])) {
      routeLibrary.countryByCode.set(country.alpha2, { ...country });
    }

    for (const centroid of routeLibrary.countryCentroids) {
      const existingCountry = routeLibrary.countryByCode.get(centroid.alpha2) ?? {};
      const mergedCountry = {
        ...existingCountry,
        alpha2: centroid.alpha2,
        name: centroid.name ?? existingCountry.name ?? centroid.alpha2,
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

    for (const airport of routeLibrary.airports) {
      routeLibrary.airportByCode.set(airport.icao, airport);
      if (!routeLibrary.airportsByCountry.has(airport.countryCode)) {
        routeLibrary.airportsByCountry.set(airport.countryCode, []);
      }
      routeLibrary.airportsByCountry.get(airport.countryCode).push(airport);

      if (!routeLibrary.countryByCode.has(airport.countryCode)) {
        routeLibrary.countryByCode.set(airport.countryCode, {
          alpha2: airport.countryCode,
          name: airport.countryCode
        });
      }
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
    const getAirportByCode = (airportIcao) => routeLibrary.airportByCode.get(airportIcao);

    routeState.selectedOriginCountryCode = preserveSelection && hasCountry(previousOriginCountry)
      ? previousOriginCountry
      : (routeLibrary.countries[0]?.alpha2 ?? "");

    const preferredDestinationCountry = preserveSelection && hasCountry(previousDestinationCountry)
      ? previousDestinationCountry
      : "";
    routeState.selectedDestinationCountryCode = preferredDestinationCountry
      || routeLibrary.countries.find((country) => country.alpha2 !== routeState.selectedOriginCountryCode)?.alpha2
      || routeState.selectedOriginCountryCode;

    const previousOriginAirportEntry = preserveSelection ? getAirportByCode(previousOriginAirport) : null;
    routeState.selectedOriginAirportIcao = previousOriginAirportEntry?.countryCode === routeState.selectedOriginCountryCode
      ? previousOriginAirport
      : getDefaultAirportIcao(
        routeState.selectedOriginCountryCode,
        routeState.selectedOriginCountryCode === routeState.selectedDestinationCountryCode
          ? previousDestinationAirport
          : ""
      );

    const previousDestinationAirportEntry = preserveSelection ? getAirportByCode(previousDestinationAirport) : null;
    routeState.selectedDestinationAirportIcao = previousDestinationAirportEntry?.countryCode === routeState.selectedDestinationCountryCode
      ? previousDestinationAirport
      : getDefaultAirportIcao(
        routeState.selectedDestinationCountryCode,
        routeState.selectedDestinationCountryCode === routeState.selectedOriginCountryCode
          ? routeState.selectedOriginAirportIcao
          : ""
      );

    const nextSelectionKey = `${routeState.selectedOriginAirportIcao}|${routeState.selectedDestinationAirportIcao}`;
    applySelectionChange(nextSelectionKey !== previousSelectionKey);
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
      const initialLoad = await routeDataService.loadInitialDataset();
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

  function refreshLocalizedUi() {
    setDatasetStatus(routeState.datasetStatusKey, routeState.datasetStatusParams, routeState.datasetStatusError);
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
    setDestinationAirport,
    setDestinationCountry,
    setOriginAirport,
    setOriginCountry,
    setSpeedMultiplier,
    syncRouteUi,
    togglePlayback,
    update
  };
}
