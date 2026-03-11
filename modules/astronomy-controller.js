import * as THREE from "../vendor/three.module.js";
import {
  formatGeoPair,
  formatLatitude,
  getGeoFromProjectedPosition,
  projectedRadiusFromLatitude,
  toDatetimeLocalValue,
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
} from "./astronomy-utils.js?v=20260311-moon4";

export function createAstronomyController({
  constants,
  i18n,
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
  dayNightOverlayMaterial,
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
  southSeasonOverlay
}) {
  const scaleDimension = (value) => value * (constants.MODEL_SCALE ?? 1);
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

  function formatIllumination(fraction) {
    return `${Math.round(THREE.MathUtils.clamp(fraction ?? 0, 0, 1) * 100)}%`;
  }

  function formatObservationTime(date) {
    return i18n.formatDate(date, {
      dateStyle: "medium",
      timeStyle: "medium"
    });
  }

  function formatSeasonalEventTime(date) {
    return i18n.formatDate(date, {
      dateStyle: "medium",
      timeStyle: "short"
    });
  }

  function formatAnalemmaTime(date) {
    return i18n.formatDate(date, {
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  const seasonalEventFormatter = {
    format(date) {
      return formatSeasonalEventTime(date);
    }
  };

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
        return i18n.t("seasonalEventSpringEquinox");
      case "summerSolstice":
        return i18n.t("seasonalEventSummerSolstice");
      case "autumnEquinox":
        return i18n.t("seasonalEventAutumnEquinox");
      case "winterSolstice":
        return i18n.t("seasonalEventWinterSolstice");
      default:
        return key;
    }
  }

  function getAltitudeSummary(value) {
    if (value > 0.5) {
      return i18n.t("altitudeSummaryAbove");
    }
    if (value < -0.5) {
      return i18n.t("altitudeSummaryBelow");
    }
    return i18n.t("altitudeSummaryOn");
  }

  function getObserverGeo() {
    return getGeoFromProjectedPosition(walkerState.position, constants.DISC_RADIUS);
  }

  function getMoonPhaseLabel(moonPhase) {
    return i18n.t(moonPhase?.labelKey ?? "moonPhaseFull");
  }

  function getMoonDirectionLabel(moonPhase) {
    const phaseProgress = THREE.MathUtils.euclideanModulo(moonPhase?.phaseProgress ?? 0, 1);
    return i18n.t(phaseProgress < 0.5 ? "moonDirectionWaxing" : "moonDirectionWaning");
  }

  function syncMoonPhaseUi(snapshot) {
    if (!snapshot || !ui.moonPhasePointerEl) {
      return;
    }

    const moonPhase = snapshot.moonPhase ?? {};
    const phaseAngleDegrees = THREE.MathUtils.euclideanModulo(moonPhase.phaseAngleDegrees ?? 0, 360);
    const phaseStepNumber = moonPhase.phaseStepNumber ?? 1;
    const phaseStepCount = moonPhase.phaseStepCount ?? 16;

    ui.moonPhasePointerEl.style.setProperty("--moon-phase-angle", `${phaseAngleDegrees}deg`);
    ui.moonPhaseLabelEl.textContent = getMoonPhaseLabel(moonPhase);
    ui.moonPhaseDegreesEl.textContent = i18n.t("moonPhaseDegreesValue", {
      angle: phaseAngleDegrees.toFixed(1)
    });
    ui.moonPhaseStepEl.textContent = i18n.t("moonPhaseStepValue", {
      step: phaseStepNumber,
      total: phaseStepCount
    });
    ui.moonPhaseDirectionEl.textContent = getMoonDirectionLabel(moonPhase);
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

  function syncDayNightOverlayMaterial(sunLatitudeDegrees, sunLongitudeDegrees) {
    const sunLatitudeRadians = THREE.MathUtils.degToRad(sunLatitudeDegrees);
    dayNightOverlayMaterial.uniforms.sunLatitudeTrig.value.set(
      Math.sin(sunLatitudeRadians),
      Math.cos(sunLatitudeRadians)
    );
    dayNightOverlayMaterial.uniforms.sunLongitudeRadians.value = THREE.MathUtils.degToRad(sunLongitudeDegrees);
  }

  function syncDayNightOverlayUi() {
    ui.dayNightOverlayEl.checked = dayNightState.enabled;
    dayNightOverlay.visible = dayNightState.enabled;
    ui.dayNightSummaryEl.textContent = dayNightState.enabled
      ? i18n.t("dayNightSummaryActive")
      : i18n.t("dayNightSummaryHidden");
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

    syncDayNightOverlayMaterial(sunLatitudeDegrees, sunLongitudeDegrees);
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
    const seasonalLabel = getSeasonalEventLabel(audit.key);
    const phaseLabel = getMoonPhaseLabel(audit.moonPhase);
    ui.seasonalYearEl.value = String(seasonalMoonState.selectedYear);
    syncSeasonalEventButtons();
    ui.seasonalEventTimeEl.textContent =
      `${seasonalMoonState.selectedYear} ${definition.label} · ${seasonalEventFormatter.format(audit.date)}`;
    ui.seasonalMoonAnchorEl.textContent = formatGeoPair(audit.moon.latitudeDegrees, audit.moon.longitudeDegrees);
    ui.seasonalMoonDriftEl.textContent = i18n.t("seasonalMoonDrift", {
      latitudeDelta: formatSignedDegrees(audit.motion.netLatitudeDeltaDegrees),
      longitudeDelta: formatSignedDegrees(audit.motion.netLongitudeDeltaDegrees)
    });
    ui.seasonalMoonSummaryEl.textContent =
      `${definition.label} 기준 ±12시간 달 궤적: 위도 ${formatLatitude(audit.motion.latitudeMinDegrees)}~` +
      `${formatLatitude(audit.motion.latitudeMaxDegrees)}, 경도 누적 이동 ${audit.motion.longitudeSweepDegrees.toFixed(1)}deg.`;

    ui.seasonalEventTimeEl.textContent = i18n.t("seasonalEventTime", {
      year: seasonalMoonState.selectedYear,
      eventLabel: seasonalLabel,
      date: formatSeasonalEventTime(audit.date)
    });
    ui.seasonalMoonSummaryEl.textContent = i18n.t("seasonalMoonSummary", {
      eventLabel: seasonalLabel,
      illumination: formatIllumination(audit.moonPhase?.illuminationFraction),
      latitudeMin: formatLatitude(audit.motion.latitudeMinDegrees),
      latitudeMax: formatLatitude(audit.motion.latitudeMaxDegrees),
      longitudeSweep: audit.motion.longitudeSweepDegrees.toFixed(1),
      phaseLabel
    });

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
    if (!ui.seasonalSunGridEl || !ui.seasonalSunSummaryEl) {
      lastSeasonalSunKey = "";
      return;
    }

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
        <p class="seasonal-sun-meta">${formatSeasonalEventTime(audit.date)}</p>
        <div class="seasonal-sun-values">
          <div>
            <span class="seasonal-sun-label">${i18n.t("seasonalSunCardSolarLatitude")}</span>
            <strong class="seasonal-sun-value">${formatLatitude(audit.sun.latitudeDegrees)}</strong>
          </div>
          <div>
            <span class="seasonal-sun-label">${i18n.t("seasonalSunCardModelAltitude")}</span>
            <strong class="seasonal-sun-value">${formatAltitude(audit.horizontal.altitudeDegrees)}</strong>
          </div>
        </div>
        <p class="seasonal-sun-meta">${getAltitudeSummary(audit.horizontal.altitudeDegrees)}</p>
      </article>
    `).join("");

    ui.seasonalSunSummaryEl.textContent = i18n.t("seasonalSunSummary", {
      observerGeo: formatGeoPair(observerGeo.latitudeDegrees, observerGeo.longitudeDegrees),
      springLatitude: formatLatitude(auditsByKey.springEquinox.sun.latitudeDegrees),
      autumnLatitude: formatLatitude(auditsByKey.autumnEquinox.sun.latitudeDegrees),
      summerLatitude: formatLatitude(auditsByKey.summerSolstice.sun.latitudeDegrees),
      winterLatitude: formatLatitude(auditsByKey.winterSolstice.sun.latitudeDegrees),
      highestLabel: getSeasonalEventLabel(highestAudit.key),
      highestAltitude: formatAltitude(highestAudit.horizontal.altitudeDegrees),
      lowestLabel: getSeasonalEventLabel(lowestAudit.key),
      lowestAltitude: formatAltitude(lowestAudit.horizontal.altitudeDegrees)
    });

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
      ui.analemmaSummaryEl.textContent = i18n.t("analemmaSummaryHidden");
      return;
    }

    const projectionKey = getAnalemmaProjectionKey(date);
    if (force || analemmaState.lastProjectionKey !== projectionKey) {
      rebuildAnalemmaProjection(date);
    }

    ui.analemmaSummaryEl.textContent = i18n.t("analemmaSummary", {
      year: date.getFullYear(),
      time: formatAnalemmaTime(date)
    });
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
      ui.skyAnalemmaSummaryEl.textContent = i18n.t("skyAnalemmaSummaryHidden");
      return;
    }

    if (force || skyAnalemmaState.lastProjectionKey !== projectionKey) {
      rebuildSkyAnalemma(date);
    }

    const hiddenSamples = Math.max(0, skyAnalemmaState.lastTotalSamples - skyAnalemmaState.lastVisibleSamples);
    const hiddenCopy = hiddenSamples > 0
      ? i18n.t("skyAnalemmaHiddenSamples", { count: hiddenSamples })
      : "";
    ui.skyAnalemmaSummaryEl.textContent = i18n.t("skyAnalemmaSummary", {
      observerGeo: formatGeoPair(observerGeo.latitudeDegrees, observerGeo.longitudeDegrees),
      date: i18n.formatDate(date, { dateStyle: "medium" }),
      hiddenCopy
    });
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
    ui.timeSummaryEl.textContent = astronomyState.enabled
      ? (
        astronomyState.live
          ? i18n.t("timeSummaryLive", { date: formatObservationTime(snapshot.date) })
          : i18n.t("timeSummaryPreview", { date: formatObservationTime(snapshot.date) })
      )
      : i18n.t("demoOrbitModeActive");
    ui.sunCoordinatesEl.textContent = formatGeoPair(snapshot.sun.latitudeDegrees, snapshot.sun.longitudeDegrees);
    ui.moonCoordinatesEl.textContent = i18n.t("moonCoordinatesValue", {
      geo: formatGeoPair(snapshot.moon.latitudeDegrees, snapshot.moon.longitudeDegrees),
      illumination: formatIllumination(snapshot.moonPhase?.illuminationFraction),
      phaseLabel: getMoonPhaseLabel(snapshot.moonPhase)
    });
    syncMoonPhaseUi(snapshot);
    ui.orbitLabelEl.textContent = astronomyState.enabled
      ? i18n.t("orbitLabelRealitySync")
      : i18n.t(orbitModes[simulationState.orbitMode].labelKey);
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
      ui.seasonSummaryEl.textContent = i18n.t("seasonSummaryEquinox");
      ui.seasonDetailEl.textContent = i18n.t("seasonDetailEquinox");
      return;
    }

    if (latitude > 0) {
      ui.seasonSummaryEl.textContent = i18n.t("seasonSummaryNorth");
      ui.seasonDetailEl.textContent = i18n.t("seasonDetailNorth");
      return;
    }

    ui.seasonSummaryEl.textContent = i18n.t("seasonSummarySouth");
    ui.seasonDetailEl.textContent = i18n.t("seasonDetailSouth");
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
      ? i18n.t("orbitLabelRealitySync")
      : i18n.t(orbitModes[simulationState.orbitMode].labelKey);
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
      constants.TROPIC_CANCER_RADIUS - scaleDimension(0.15),
      constants.DOME_RADIUS - scaleDimension(0.24)
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
    ui.timeSummaryEl.textContent = i18n.t("demoOrbitModeActive");
    syncSeasonalSunUi(true);
    syncAnalemmaUi(astronomyState.selectedDate, true);
    syncSkyAnalemmaUi(astronomyState.selectedDate, true);
    updateOrbitModeUi();
  }

  function refreshLocalizedUi() {
    const activeDate = astronomyState.live ? new Date() : astronomyState.selectedDate;
    syncDayNightOverlayUi();
    syncAstronomyControls();
    syncSeasonalMoonUi();
    syncSeasonalSunUi(true);
    syncAnalemmaUi(activeDate, true);
    syncSkyAnalemmaUi(activeDate, true);

    if (astronomyState.enabled) {
      updateAstronomyUi(getAstronomySnapshot(activeDate));
      return;
    }

    updateSeasonPresentation(getCurrentOrbitRadius());
    ui.timeSummaryEl.textContent = i18n.t("demoOrbitModeActive");
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
    refreshLocalizedUi,
    resetMoonTrail,
    resetSunTrail,
    setObservationInputValue,
    updateAstronomyUi,
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
