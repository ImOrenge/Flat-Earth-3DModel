import * as THREE from "../vendor/three.module.js";
import {
  formatGeoPair,
  formatLatitude,
  getGeoFromProjectedPosition,
  projectedRadiusFromLatitude,
  toDatetimeLocalValue,
  toDegrees,
  normalizeDegrees,
  latitudeFromProjectedRadius
} from "./geo-utils.js";
import {
  getAstronomySnapshot as buildAstronomySnapshot,
  getSeasonalEventMoments,
  getSeasonalMoonAudit,
  getSeasonalSunAudit,
  getMoonHorizontalCoordinates,
  getSunHorizontalCoordinates,
  SEASONAL_EVENT_DEFINITIONS
} from "./astronomy-utils.js";

export function createAstronomyController({
  constants,
  ui,
  astronomyState,
  seasonalMoonState,
  analemmaState,
  skyAnalemmaState,
  dayNightState,
  simulationState,
  walkerState,
  orbitModes,
  orbitModeButtons,
  seasonalEventButtons,
  dayNightCanvas,
  dayNightCtx,
  dayNightTexture,
  dayNightOverlay,
  analemmaProjectionGeometry,
  analemmaProjectionPointsGeometry,
  skyAnalemmaGeometry,
  skyAnalemmaPointsGeometry,
  orbitSun,
  orbitMoon,
  sunTrailGeometry,
  sunTrailPointsGeometry,
  moonTrailGeometry,
  moonTrailPointsGeometry,
  northSeasonOverlay,
  southSeasonOverlay,
  getNightLightsData
}) {
  const observationTimeFormatter = new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "medium"
  });
  const seasonalEventFormatter = new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  });
  const analemmaTimeFormatter = new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit"
  });
  const seasonalEventMap = new Map(
    SEASONAL_EVENT_DEFINITIONS.map((definition) => [definition.key, definition])
  );
  const sunTrailPoints = [];
  const moonTrailPoints = [];
  const analemmaPoints = [];
  const skyAnalemmaPoints = [];
  const skyAnalemmaSegments = [];
  const tempNorthAxis = new THREE.Vector3();
  const tempEastAxis = new THREE.Vector3();
  const tempUpAxis = new THREE.Vector3(0, 1, 0);
  const tempSkyPoint = new THREE.Vector3();
  const tempSkyOrigin = new THREE.Vector3();
  let lastSeasonalSunKey = "";

  function sanitizeSeasonalYear(value) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) {
      return astronomyState.selectedDate.getFullYear();
    }
    return THREE.MathUtils.clamp(parsed, 1900, 2100);
  }

  function formatSignedDegrees(value) {
    const prefix = value > 0 ? "+" : "";
    return `${prefix}${value.toFixed(1)}deg`;
  }

  function formatAltitude(value) {
    const prefix = value > 0 ? "+" : "";
    return `${prefix}${value.toFixed(1)}deg`;
  }

  function applyCelestialAltitudeOffset(horizontal) {
    const altitudeDegrees = THREE.MathUtils.clamp(
      horizontal.altitudeDegrees - constants.CELESTIAL_ALTITUDE_DROP_DEGREES,
      -89.9,
      89.9
    );

    return {
      ...horizontal,
      altitudeDegrees,
      altitudeRadians: THREE.MathUtils.degToRad(altitudeDegrees)
    };
  }

  function getSeasonalEventLabel(key) {
    switch (key) {
      case "springEquinox":
        return "Spring Equinox";
      case "summerSolstice":
        return "Summer Solstice";
      case "autumnEquinox":
        return "Autumn Equinox";
      case "winterSolstice":
        return "Winter Solstice";
      default:
        return key;
    }
  }

  function getAltitudeSummary(value) {
    if (value > 0.5) {
      return "Above horizon";
    }
    if (value < -0.5) {
      return "Below horizon";
    }
    return "On horizon";
  }

  function getObserverGeo() {
    return getGeoFromProjectedPosition(walkerState.position, constants.DISC_RADIUS);
  }

  function getOrbitLatitudeRatio(radius) {
    return THREE.MathUtils.clamp(latitudeFromProjectedRadius(radius, constants.DISC_RADIUS) / constants.TROPIC_LATITUDE, -1, 1);
  }

  function getSunOrbitHeight(radius) {
    const ratio = getOrbitLatitudeRatio(radius);
    return THREE.MathUtils.mapLinear(ratio, -1, 1, constants.ORBIT_SUN_HEIGHT_SOUTH, constants.ORBIT_SUN_HEIGHT_NORTH);
  }

  function getMoonBaseHeight(radius) {
    const ratio = getOrbitLatitudeRatio(radius);
    return THREE.MathUtils.mapLinear(ratio, -1, 1, constants.ORBIT_MOON_HEIGHT_SOUTH, constants.ORBIT_MOON_HEIGHT_NORTH);
  }

  function getAstronomySnapshot(date) {
    return buildAstronomySnapshot({
      date,
      discRadius: constants.DISC_RADIUS,
      domeRadius: constants.DOME_RADIUS,
      getSunOrbitHeight,
      getMoonBaseHeight
    });
  }

  function drawDayNightOverlay(sunLatitudeDegrees, sunLongitudeDegrees) {
    const { width, height } = dayNightCanvas;
    const image = dayNightCtx.createImageData(width, height);
    const { data } = image;
    const nightLights = typeof getNightLightsData === "function" ? getNightLightsData() : null;
    const hasNightLights = Boolean(nightLights && nightLights.length === (width * height));

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const u = x / (width - 1);
        const v = y / (height - 1);
        const worldZ = (u - 0.5) * constants.DISC_RADIUS * 2;
        const worldX = (v - 0.5) * constants.DISC_RADIUS * 2;
        const projectedRadius = Math.hypot(worldX, worldZ);
        const index = (y * width + x) * 4;

        if (projectedRadius > constants.DISC_RADIUS) {
          data[index + 3] = 0;
          continue;
        }

        const latitudeDegrees = latitudeFromProjectedRadius(projectedRadius, constants.DISC_RADIUS);
        const longitudeDegrees = normalizeDegrees(toDegrees(Math.atan2(worldZ, -worldX)));
        const solarFactor = (
          (Math.sin(latitudeDegrees * Math.PI / 180) * Math.sin(sunLatitudeDegrees * Math.PI / 180)) +
          (Math.cos(latitudeDegrees * Math.PI / 180) * Math.cos(sunLatitudeDegrees * Math.PI / 180) *
            Math.cos((longitudeDegrees - sunLongitudeDegrees) * Math.PI / 180))
        );
        const nightStrength = THREE.MathUtils.clamp((-solarFactor + 0.02) / 0.18, 0, 1);
        const twilightStrength = 1 - THREE.MathUtils.clamp(Math.abs(solarFactor) / 0.06, 0, 1);
        const twilightMix = THREE.MathUtils.clamp(twilightStrength * (1 - (nightStrength * 0.35)), 0, 1);
        const deepNight = THREE.MathUtils.clamp((nightStrength - 0.14) / 0.86, 0, 1);
        const baseRed = THREE.MathUtils.lerp(12, 96, twilightMix);
        const baseGreen = THREE.MathUtils.lerp(20, 128, twilightMix);
        const baseBlue = THREE.MathUtils.lerp(34, 196, twilightMix);
        const lightSampleIndex = ((height - 1 - y) * width) + x;
        const lightStrength = hasNightLights ? (nightLights[lightSampleIndex] * deepNight) : 0;
        const lightBoost = lightStrength * (0.82 + (deepNight * 0.68));
        const red = baseRed + (lightBoost * 255);
        const green = baseGreen + (lightBoost * 208);
        const blue = baseBlue + (lightBoost * 108);
        const alpha = Math.round((nightStrength * 172) + (twilightMix * 52) + (lightBoost * 42));

        data[index] = THREE.MathUtils.clamp(Math.round(red), 0, 255);
        data[index + 1] = THREE.MathUtils.clamp(Math.round(green), 0, 255);
        data[index + 2] = THREE.MathUtils.clamp(Math.round(blue), 0, 255);
        data[index + 3] = THREE.MathUtils.clamp(alpha, 0, 232);
      }
    }

    dayNightCtx.putImageData(image, 0, 0);
    dayNightTexture.needsUpdate = true;
  }

  function syncDayNightOverlayUi() {
    ui.dayNightOverlayEl.checked = dayNightState.enabled;
    dayNightOverlay.visible = dayNightState.enabled;
    ui.dayNightSummaryEl.textContent = dayNightState.enabled
      ? "Night side overlay is active."
      : "Night side overlay is hidden.";
  }

  function updateDayNightOverlayFromSun(sunLatitudeDegrees, sunLongitudeDegrees, force = false) {
    const latitudeDelta = Math.abs((dayNightState.lastLatitudeDegrees ?? sunLatitudeDegrees) - sunLatitudeDegrees);
    const longitudeDelta = Math.abs((dayNightState.lastLongitudeDegrees ?? sunLongitudeDegrees) - sunLongitudeDegrees);

    if (!dayNightState.enabled) {
      dayNightOverlay.visible = false;
      return;
    }

    if (!force && latitudeDelta < constants.DAY_NIGHT_UPDATE_EPSILON && longitudeDelta < constants.DAY_NIGHT_UPDATE_EPSILON) {
      dayNightOverlay.visible = true;
      return;
    }

    drawDayNightOverlay(sunLatitudeDegrees, sunLongitudeDegrees);
    dayNightState.lastLatitudeDegrees = sunLatitudeDegrees;
    dayNightState.lastLongitudeDegrees = sunLongitudeDegrees;
    dayNightOverlay.visible = true;
  }

  function setObservationInputValue(date) {
    ui.observationTimeEl.value = toDatetimeLocalValue(date);
  }

  function syncAstronomyControls() {
    ui.realitySyncEl.checked = astronomyState.enabled;
    ui.realityLiveEl.checked = astronomyState.live;
    ui.realityLiveEl.disabled = !astronomyState.enabled;
    ui.observationTimeEl.disabled = !astronomyState.enabled || astronomyState.live;
    ui.applyObservationTimeButton.disabled = !astronomyState.enabled || astronomyState.live;

    for (const button of orbitModeButtons) {
      button.disabled = astronomyState.enabled;
    }
  }

  function syncSeasonalEventButtons() {
    for (const button of seasonalEventButtons) {
      button.classList.toggle("active", button.dataset.seasonalEvent === seasonalMoonState.selectedEventKey);
    }
  }

  function getNearestSeasonalEventKey(year, date) {
    const seasonalEvents = getSeasonalEventMoments(year);
    let nearestKey = SEASONAL_EVENT_DEFINITIONS[0].key;
    let nearestDelta = Number.POSITIVE_INFINITY;

    for (const definition of SEASONAL_EVENT_DEFINITIONS) {
      const eventDate = seasonalEvents[definition.key];
      const delta = Math.abs(eventDate.getTime() - date.getTime());
      if (delta < nearestDelta) {
        nearestDelta = delta;
        nearestKey = definition.key;
      }
    }

    return nearestKey;
  }

  function getSelectedSeasonalAudit() {
    const year = sanitizeSeasonalYear(seasonalMoonState.selectedYear);
    seasonalMoonState.selectedYear = year;

    if (!seasonalEventMap.has(seasonalMoonState.selectedEventKey)) {
      seasonalMoonState.selectedEventKey = getNearestSeasonalEventKey(year, astronomyState.selectedDate);
    }

    return getSeasonalMoonAudit(seasonalMoonState.selectedEventKey, year);
  }

  function syncSeasonalMoonUi() {
    const audit = getSelectedSeasonalAudit();
    const definition = seasonalEventMap.get(audit.key);
    ui.seasonalYearEl.value = String(seasonalMoonState.selectedYear);
    syncSeasonalEventButtons();
    ui.seasonalEventTimeEl.textContent =
      `${seasonalMoonState.selectedYear} ${definition.label} · ${seasonalEventFormatter.format(audit.date)}`;
    ui.seasonalMoonAnchorEl.textContent = formatGeoPair(audit.moon.latitudeDegrees, audit.moon.longitudeDegrees);
    ui.seasonalMoonDriftEl.textContent =
      `dLat ${formatSignedDegrees(audit.motion.netLatitudeDeltaDegrees)} / ` +
      `dLon ${formatSignedDegrees(audit.motion.netLongitudeDeltaDegrees)}`;
    ui.seasonalMoonSummaryEl.textContent =
      `${definition.label} 기준 ±12시간 달 궤적: 위도 ${formatLatitude(audit.motion.latitudeMinDegrees)}~` +
      `${formatLatitude(audit.motion.latitudeMaxDegrees)}, 경도 누적 이동 ${audit.motion.longitudeSweepDegrees.toFixed(1)}deg.`;

    const seasonalLabel = getSeasonalEventLabel(audit.key);
    ui.seasonalEventTimeEl.textContent =
      `Shared seasonal anchor: ${seasonalMoonState.selectedYear} ${seasonalLabel} ` +
      `at ${seasonalEventFormatter.format(audit.date)}`;
    ui.seasonalMoonSummaryEl.textContent =
      `${seasonalLabel} anchor with a 24-hour moon swing from ` +
      `${formatLatitude(audit.motion.latitudeMinDegrees)} to ${formatLatitude(audit.motion.latitudeMaxDegrees)} ` +
      `and a ${audit.motion.longitudeSweepDegrees.toFixed(1)}deg longitude sweep.`;

    return audit;
  }

  function getSeasonalSunUiKey(year, observerGeo) {
    return [
      year,
      observerGeo.latitudeDegrees.toFixed(2),
      observerGeo.longitudeDegrees.toFixed(2)
    ].join(":");
  }

  function syncSeasonalSunUi(force = false) {
    const year = sanitizeSeasonalYear(seasonalMoonState.selectedYear);
    const observerGeo = getObserverGeo();
    const uiKey = getSeasonalSunUiKey(year, observerGeo);

    if (!force && lastSeasonalSunKey === uiKey) {
      return;
    }

    seasonalMoonState.selectedYear = year;
    ui.seasonalYearEl.value = String(year);

    const audits = getSeasonalSunAudit(year, observerGeo.latitudeDegrees, observerGeo.longitudeDegrees)
      .map((audit) => ({
        ...audit,
        horizontal: applyCelestialAltitudeOffset(audit.horizontal)
      }));
    const auditsByKey = Object.fromEntries(audits.map((audit) => [audit.key, audit]));
    const highestAudit = audits.reduce((best, audit) => (
      audit.horizontal.altitudeDegrees > best.horizontal.altitudeDegrees ? audit : best
    ), audits[0]);
    const lowestAudit = audits.reduce((best, audit) => (
      audit.horizontal.altitudeDegrees < best.horizontal.altitudeDegrees ? audit : best
    ), audits[0]);

    ui.seasonalSunGridEl.innerHTML = audits.map((audit) => `
      <article class="seasonal-sun-card">
        <p class="seasonal-sun-heading">${getSeasonalEventLabel(audit.key)}</p>
        <p class="seasonal-sun-meta">${seasonalEventFormatter.format(audit.date)}</p>
        <div class="seasonal-sun-values">
          <div>
            <span class="seasonal-sun-label">Solar latitude</span>
            <strong class="seasonal-sun-value">${formatLatitude(audit.sun.latitudeDegrees)}</strong>
          </div>
          <div>
            <span class="seasonal-sun-label">Model altitude</span>
            <strong class="seasonal-sun-value">${formatAltitude(audit.horizontal.altitudeDegrees)}</strong>
          </div>
        </div>
        <p class="seasonal-sun-meta">${getAltitudeSummary(audit.horizontal.altitudeDegrees)}</p>
      </article>
    `).join("");

    ui.seasonalSunSummaryEl.textContent =
      `Observer ${formatGeoPair(observerGeo.latitudeDegrees, observerGeo.longitudeDegrees)}. ` +
      `Equinoxes stay near ${formatLatitude(auditsByKey.springEquinox.sun.latitudeDegrees)} and ` +
      `${formatLatitude(auditsByKey.autumnEquinox.sun.latitudeDegrees)}, while solstices reach ` +
      `${formatLatitude(auditsByKey.summerSolstice.sun.latitudeDegrees)} and ` +
      `${formatLatitude(auditsByKey.winterSolstice.sun.latitudeDegrees)}. ` +
      `Highest modeled altitude here: ${getSeasonalEventLabel(highestAudit.key)} ` +
      `${formatAltitude(highestAudit.horizontal.altitudeDegrees)}. Lowest: ` +
      `${getSeasonalEventLabel(lowestAudit.key)} ${formatAltitude(lowestAudit.horizontal.altitudeDegrees)}.`;

    lastSeasonalSunKey = uiKey;
  }

  function setTrailPoints(target, lineGeometry, pointsGeometry, points) {
    target.length = 0;
    target.push(...points);
    lineGeometry.setFromPoints(target);
    pointsGeometry.setFromPoints(target);
  }

  function clearAnalemmaProjection() {
    analemmaPoints.length = 0;
    analemmaProjectionGeometry.setFromPoints(analemmaPoints);
    analemmaProjectionPointsGeometry.setFromPoints(analemmaPoints);
    analemmaState.lastProjectionKey = "";
  }

  function getAnalemmaProjectionKey(date) {
    return [
      date.getFullYear(),
      date.getHours(),
      date.getMinutes()
    ].join(":");
  }

  function getAnalemmaPointFromSun(date) {
    const sun = getAstronomySnapshot(date).sun;
    const projectedRadius = THREE.MathUtils.clamp(
      projectedRadiusFromLatitude(sun.latitudeDegrees, constants.DISC_RADIUS),
      0,
      constants.DISC_RADIUS
    );
    const longitudeRadians = sun.longitudeDegrees * Math.PI / 180;

    return new THREE.Vector3(
      -Math.cos(longitudeRadians) * projectedRadius,
      constants.SURFACE_Y + constants.ANALEMMA_SURFACE_OFFSET,
      Math.sin(longitudeRadians) * projectedRadius
    );
  }

  function rebuildAnalemmaProjection(date) {
    const samplePoints = [];
    const year = date.getFullYear();
    const sampleHours = date.getHours();
    const sampleMinutes = date.getMinutes();

    for (let dayIndex = 0; dayIndex < 367; dayIndex += 1) {
      const sampleDate = new Date(year, 0, 1 + dayIndex, sampleHours, sampleMinutes, 0, 0);
      if (sampleDate.getFullYear() !== year) {
        break;
      }
      samplePoints.push(getAnalemmaPointFromSun(sampleDate));
    }

    setTrailPoints(analemmaPoints, analemmaProjectionGeometry, analemmaProjectionPointsGeometry, samplePoints);
    analemmaState.lastProjectionKey = getAnalemmaProjectionKey(date);
  }

  function syncAnalemmaUi(date = astronomyState.selectedDate, force = false) {
    ui.analemmaOverlayEl.checked = analemmaState.enabled;

    if (!analemmaState.enabled) {
      clearAnalemmaProjection();
      ui.analemmaSummaryEl.textContent = "Ground analemma is hidden.";
      return;
    }

    const projectionKey = getAnalemmaProjectionKey(date);
    if (force || analemmaState.lastProjectionKey !== projectionKey) {
      rebuildAnalemmaProjection(date);
    }

    ui.analemmaSummaryEl.textContent =
      `Ground projection for ${date.getFullYear()} at ${analemmaTimeFormatter.format(date)} local time. ` +
      "One solar subpoint is sampled per day on the disc surface.";
  }

  function clearSkyAnalemma() {
    skyAnalemmaPoints.length = 0;
    skyAnalemmaSegments.length = 0;
    skyAnalemmaGeometry.setFromPoints(skyAnalemmaSegments);
    skyAnalemmaPointsGeometry.setFromPoints(skyAnalemmaPoints);
    skyAnalemmaState.lastProjectionKey = "";
    skyAnalemmaState.lastVisibleSamples = 0;
    skyAnalemmaState.lastTotalSamples = 0;
  }

  function getSkyAnalemmaProjectionKey(date, observerGeo) {
    return [
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      date.getHours(),
      date.getMinutes(),
      observerGeo.latitudeDegrees.toFixed(2),
      observerGeo.longitudeDegrees.toFixed(2)
    ].join(":");
  }

  function getObserverSkyAxes(observerPosition, observerLongitudeDegrees) {
    const planarLength = Math.hypot(observerPosition.x, observerPosition.z);

    if (planarLength > 0.0001) {
      tempNorthAxis.set(-observerPosition.x / planarLength, 0, -observerPosition.z / planarLength);
      tempEastAxis.set(-tempNorthAxis.z, 0, tempNorthAxis.x);
      return;
    }

    const longitudeRadians = observerLongitudeDegrees * Math.PI / 180;
    tempNorthAxis.set(Math.cos(longitudeRadians), 0, -Math.sin(longitudeRadians));
    tempEastAxis.set(Math.sin(longitudeRadians), 0, Math.cos(longitudeRadians));
  }

  function getSkyAnalemmaPoint(horizontal, observerPosition, observerLongitudeDegrees) {
    const altitude = horizontal.altitudeRadians;
    const azimuth = horizontal.azimuthRadians;
    const horizontalRadius = Math.cos(altitude) * constants.SKY_ANALEMMA_RADIUS;

    getObserverSkyAxes(observerPosition, observerLongitudeDegrees);
    tempSkyOrigin.set(observerPosition.x, constants.WALKER_EYE_HEIGHT, observerPosition.z);
    tempSkyPoint.copy(tempSkyOrigin)
      .addScaledVector(tempNorthAxis, horizontalRadius * Math.cos(azimuth))
      .addScaledVector(tempEastAxis, horizontalRadius * Math.sin(azimuth))
      .addScaledVector(tempUpAxis, Math.sin(altitude) * constants.SKY_ANALEMMA_RADIUS);

    return tempSkyPoint.clone();
  }

  function rebuildSkyAnalemma(date) {
    const samplePoints = [];
    const segmentPoints = [];
    const observerGeo = getGeoFromProjectedPosition(walkerState.position, constants.DISC_RADIUS);
    const orbitDate = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      0,
      0,
      0,
      0
    );
    const sampleStepMinutes = 10;
    const totalSteps = Math.floor((24 * 60) / sampleStepMinutes);
    const pathDefinitions = [
      {
        getHorizontal(sampleDate) {
          return getSunHorizontalCoordinates(
            sampleDate,
            observerGeo.latitudeDegrees,
            observerGeo.longitudeDegrees
          );
        }
      },
      {
        getHorizontal(sampleDate) {
          return getMoonHorizontalCoordinates(
            sampleDate,
            observerGeo.latitudeDegrees,
            observerGeo.longitudeDegrees
          );
        }
      }
    ];
    let visibleSamples = 0;
    let totalSamples = 0;

    for (const pathDefinition of pathDefinitions) {
      let previousPoint = null;

      for (let stepIndex = 0; stepIndex <= totalSteps; stepIndex += 1) {
        const sampleDate = new Date(orbitDate.getTime() + (stepIndex * sampleStepMinutes * 60_000));
        totalSamples += 1;

        const horizontal = applyCelestialAltitudeOffset(pathDefinition.getHorizontal(sampleDate));
        if (horizontal.altitudeDegrees <= 0) {
          previousPoint = null;
          continue;
        }

        const point = getSkyAnalemmaPoint(horizontal, walkerState.position, observerGeo.longitudeDegrees);
        samplePoints.push(point);
        visibleSamples += 1;

        if (previousPoint) {
          segmentPoints.push(previousPoint.clone(), point.clone());
        }

        previousPoint = point;
      }
    }

    setTrailPoints(skyAnalemmaPoints, skyAnalemmaGeometry, skyAnalemmaPointsGeometry, samplePoints);
    skyAnalemmaGeometry.setFromPoints(segmentPoints);
    skyAnalemmaSegments.length = 0;
    skyAnalemmaSegments.push(...segmentPoints);
    skyAnalemmaState.lastProjectionKey = getSkyAnalemmaProjectionKey(date, observerGeo);
    skyAnalemmaState.lastVisibleSamples = visibleSamples;
    skyAnalemmaState.lastTotalSamples = totalSamples;
  }

  function syncSkyAnalemmaUi(date = astronomyState.selectedDate, force = false) {
    const observerGeo = getGeoFromProjectedPosition(walkerState.position, constants.DISC_RADIUS);
    const projectionKey = getSkyAnalemmaProjectionKey(date, observerGeo);
    ui.skyAnalemmaOverlayEl.checked = skyAnalemmaState.enabled;

    if (!skyAnalemmaState.enabled) {
      clearSkyAnalemma();
      ui.skyAnalemmaSummaryEl.textContent = "Observer sky orbit is hidden.";
      return;
    }

    if (force || skyAnalemmaState.lastProjectionKey !== projectionKey) {
      rebuildSkyAnalemma(date);
    }

    const hiddenSamples = Math.max(0, skyAnalemmaState.lastTotalSamples - skyAnalemmaState.lastVisibleSamples);
    const hiddenCopy = hiddenSamples > 0
      ? ` ${hiddenSamples} daily samples are below the horizon and omitted.`
      : "";
    ui.skyAnalemmaSummaryEl.textContent =
      `Observer sky orbit from ${formatGeoPair(observerGeo.latitudeDegrees, observerGeo.longitudeDegrees)} ` +
      `on ${date.toLocaleDateString()} shows the selected day's solar and lunar arcs above the horizon.${hiddenCopy}`;
  }

  function rebuildAstronomyTrails(snapshot) {
    const sunSamples = [];
    const moonSamples = [];
    for (let index = 0; index < constants.SUN_TRAIL_MAX_POINTS; index += 1) {
      const progress = index / (constants.SUN_TRAIL_MAX_POINTS - 1);
      const sampleTime = snapshot.date.getTime() - constants.REALITY_TRAIL_WINDOW_MS + (progress * constants.REALITY_TRAIL_WINDOW_MS * 2);
      const sample = getAstronomySnapshot(new Date(sampleTime));
      sunSamples.push(sample.sunPosition);
    }
    for (let index = 0; index < constants.MOON_TRAIL_MAX_POINTS; index += 1) {
      const progress = index / (constants.MOON_TRAIL_MAX_POINTS - 1);
      const sampleTime = snapshot.date.getTime() - constants.REALITY_TRAIL_WINDOW_MS + (progress * constants.REALITY_TRAIL_WINDOW_MS * 2);
      const sample = getAstronomySnapshot(new Date(sampleTime));
      moonSamples.push(sample.moonPosition);
    }
    setTrailPoints(sunTrailPoints, sunTrailGeometry, sunTrailPointsGeometry, sunSamples);
    setTrailPoints(moonTrailPoints, moonTrailGeometry, moonTrailPointsGeometry, moonSamples);
    astronomyState.lastTrailRebuildMs = snapshot.date.getTime();
  }

  function updateAstronomyUi(snapshot) {
    ui.timeSummaryEl.textContent = astronomyState.live
      ? `Live sync: ${observationTimeFormatter.format(snapshot.date)}`
      : `Preview time: ${observationTimeFormatter.format(snapshot.date)}`;
    ui.sunCoordinatesEl.textContent = formatGeoPair(snapshot.sun.latitudeDegrees, snapshot.sun.longitudeDegrees);
    ui.moonCoordinatesEl.textContent = formatGeoPair(snapshot.moon.latitudeDegrees, snapshot.moon.longitudeDegrees);
    ui.orbitLabelEl.textContent = astronomyState.enabled
      ? "Reality sync is active. Demo orbit buttons are paused."
      : orbitModes[simulationState.orbitMode].label;
  }

  function updateSeasonPresentation(radius) {
    const latitude = latitudeFromProjectedRadius(radius, constants.DISC_RADIUS);
    const ratio = THREE.MathUtils.clamp(latitude / constants.TROPIC_LATITUDE, -1, 1);
    const northWarmth = THREE.MathUtils.clamp((ratio + 1) / 2, 0, 1);
    const southWarmth = 1 - northWarmth;

    northSeasonOverlay.material.color.setRGB(
      THREE.MathUtils.lerp(0.48, 1.0, northWarmth),
      THREE.MathUtils.lerp(0.73, 0.83, northWarmth),
      THREE.MathUtils.lerp(1.0, 0.49, northWarmth)
    );
    northSeasonOverlay.material.opacity = THREE.MathUtils.lerp(0.05, 0.18, Math.abs(ratio));

    southSeasonOverlay.material.color.setRGB(
      THREE.MathUtils.lerp(0.48, 1.0, southWarmth),
      THREE.MathUtils.lerp(0.73, 0.83, southWarmth),
      THREE.MathUtils.lerp(1.0, 0.49, southWarmth)
    );
    southSeasonOverlay.material.opacity = THREE.MathUtils.lerp(0.05, 0.18, Math.abs(ratio));

    ui.seasonLatitudeEl.textContent = formatLatitude(latitude);

    if (Math.abs(latitude) < 1.2) {
      ui.seasonSummaryEl.textContent = "Both hemispheres / equinox crossing";
      ui.seasonDetailEl.textContent = "The sun is near the equatorial ring, so the model balances illumination between north and south.";
      return;
    }

    if (latitude > 0) {
      ui.seasonSummaryEl.textContent = "Northern summer / Southern winter";
      ui.seasonDetailEl.textContent = "The sun is closer to the northern tropic, so the north receives more direct illumination in this model.";
      return;
    }

    ui.seasonSummaryEl.textContent = "Northern winter / Southern summer";
    ui.seasonDetailEl.textContent = "The sun is closer to the southern tropic, so the south receives more direct illumination in this model.";
  }

  function applyAstronomySnapshot(snapshot) {
    orbitSun.position.copy(snapshot.sunPosition);
    orbitMoon.position.copy(snapshot.moonPosition);
    updateSeasonPresentation(projectedRadiusFromLatitude(snapshot.sun.latitudeDegrees, constants.DISC_RADIUS));
    updateAstronomyUi(snapshot);
    syncSeasonalSunUi();
    updateDayNightOverlayFromSun(snapshot.sun.latitudeDegrees, snapshot.sun.longitudeDegrees);
    syncAnalemmaUi(snapshot.date);

    if (
      Math.abs(snapshot.date.getTime() - astronomyState.lastTrailRebuildMs) >= constants.REALITY_TRAIL_REFRESH_MS
    ) {
      rebuildAstronomyTrails(snapshot);
    }
  }

  function resetSunTrail() {
    sunTrailPoints.length = 0;
    sunTrailGeometry.setFromPoints(sunTrailPoints);
    sunTrailPointsGeometry.setFromPoints(sunTrailPoints);
  }

  function updateSunTrail() {
    sunTrailPoints.push(orbitSun.position.clone());
    if (sunTrailPoints.length > constants.SUN_TRAIL_MAX_POINTS) {
      sunTrailPoints.shift();
    }
    sunTrailGeometry.setFromPoints(sunTrailPoints);
    sunTrailPointsGeometry.setFromPoints(sunTrailPoints);
  }

  function updateMoonTrail() {
    moonTrailPoints.push(orbitMoon.position.clone());
    if (moonTrailPoints.length > constants.MOON_TRAIL_MAX_POINTS) {
      moonTrailPoints.shift();
    }
    moonTrailGeometry.setFromPoints(moonTrailPoints);
    moonTrailPointsGeometry.setFromPoints(moonTrailPoints);
  }

  function resetMoonTrail() {
    moonTrailPoints.length = 0;
    moonTrailGeometry.setFromPoints(moonTrailPoints);
    moonTrailPointsGeometry.setFromPoints(moonTrailPoints);
  }

  function updateOrbitModeUi() {
    for (const button of orbitModeButtons) {
      button.classList.toggle("active", button.dataset.orbitMode === simulationState.orbitMode);
    }
    syncAstronomyControls();
    ui.orbitLabelEl.textContent = astronomyState.enabled
      ? "Reality sync is active. Demo orbit buttons are paused."
      : orbitModes[simulationState.orbitMode].label;
  }

  function getCurrentOrbitRadius() {
    if (simulationState.orbitMode === "auto") {
      return constants.ORBIT_RADIUS_MID + Math.sin(simulationState.orbitSeasonPhase) * constants.ORBIT_RADIUS_AMPLITUDE;
    }
    return orbitModes[simulationState.orbitMode].radius;
  }

  function updateMoonOrbit(seasonRadius) {
    const orbitRadius = THREE.MathUtils.clamp(
      seasonRadius,
      constants.TROPIC_CANCER_RADIUS - 0.15,
      constants.DOME_RADIUS - 0.24
    );
    const height = getMoonBaseHeight(seasonRadius);
    const safeDomeRadius = constants.DOME_RADIUS - (constants.ORBIT_MOON_SIZE * 1.6);
    const domeHeightOffset = THREE.MathUtils.clamp(height - constants.DOME_BASE_Y, 0, safeDomeRadius);
    const maxPlanarRadius = Math.sqrt(Math.max(0, (safeDomeRadius ** 2) - (domeHeightOffset ** 2)));
    let moonX = Math.cos(simulationState.orbitMoonAngle) * orbitRadius;
    let moonZ = Math.sin(simulationState.orbitMoonAngle) * orbitRadius;
    const planarDistance = Math.hypot(moonX, moonZ);

    if (planarDistance > maxPlanarRadius && planarDistance > 0) {
      const clampScale = maxPlanarRadius / planarDistance;
      moonX *= clampScale;
      moonZ *= clampScale;
    }

    orbitMoon.position.set(
      moonX,
      height,
      moonZ
    );
  }

  function setAstronomyDate(date) {
    astronomyState.selectedDate = date;
    setObservationInputValue(date);
  }

  function refreshAstronomyView(date = astronomyState.selectedDate) {
    setAstronomyDate(date);
    applyAstronomySnapshot(getAstronomySnapshot(astronomyState.selectedDate));
    updateOrbitModeUi();
  }

  function enableRealityMode({ live, date = new Date() }) {
    astronomyState.enabled = true;
    astronomyState.live = live;
    astronomyState.lastTrailRebuildMs = 0;
    resetSunTrail();
    resetMoonTrail();
    refreshAstronomyView(date);
  }

  function disableRealityMode() {
    astronomyState.enabled = false;
    astronomyState.live = false;
    resetSunTrail();
    resetMoonTrail();
    ui.timeSummaryEl.textContent = "Demo orbit mode is active.";
    syncSeasonalSunUi(true);
    syncAnalemmaUi(astronomyState.selectedDate, true);
    syncSkyAnalemmaUi(astronomyState.selectedDate, true);
    updateOrbitModeUi();
  }

  function syncLiveObservationInput(date) {
    if ((date.getTime() - astronomyState.lastInputSyncMs) < 1000) {
      return;
    }
    astronomyState.lastInputSyncMs = date.getTime();
    setObservationInputValue(date);
  }

  function applyObservationTimeSelection() {
    const nextDate = new Date(ui.observationTimeEl.value);
    if (Number.isNaN(nextDate.getTime())) {
      return;
    }
    enableRealityMode({ live: false, date: nextDate });
  }

  function previewSeasonalMoonAudit(nextEventKey = seasonalMoonState.selectedEventKey, nextYear = seasonalMoonState.selectedYear) {
    seasonalMoonState.selectedYear = sanitizeSeasonalYear(nextYear);
    if (seasonalEventMap.has(nextEventKey)) {
      seasonalMoonState.selectedEventKey = nextEventKey;
    }
    const audit = syncSeasonalMoonUi();
    enableRealityMode({ live: false, date: audit.date });
  }

  return {
    applyAstronomySnapshot,
    applyObservationTimeSelection,
    disableRealityMode,
    enableRealityMode,
    getAstronomySnapshot,
    getCurrentOrbitRadius,
    getMoonBaseHeight,
    getSunOrbitHeight,
    rebuildAstronomyTrails,
    resetMoonTrail,
    resetSunTrail,
    setObservationInputValue,
    syncAstronomyControls,
    syncAnalemmaUi,
    syncSkyAnalemmaUi,
    syncDayNightOverlayUi,
    syncSeasonalMoonUi,
    syncSeasonalSunUi,
    syncLiveObservationInput,
    updateDayNightOverlayFromSun,
    updateMoonOrbit,
    updateMoonTrail,
    updateOrbitModeUi,
    updateSeasonPresentation,
    updateSunTrail,
    previewSeasonalMoonAudit
  };
}
