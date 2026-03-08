import * as THREE from "../vendor/three.module.js";
import {
  formatGeoPair,
  formatLatitude,
  projectedRadiusFromLatitude,
  toDatetimeLocalValue,
  toDegrees,
  normalizeDegrees,
  latitudeFromProjectedRadius
} from "./geo-utils.js";
import { getAstronomySnapshot as buildAstronomySnapshot } from "./astronomy-utils.js";

export function createAstronomyController({
  constants,
  ui,
  astronomyState,
  dayNightState,
  simulationState,
  orbitModes,
  orbitModeButtons,
  dayNightCanvas,
  dayNightCtx,
  dayNightTexture,
  dayNightOverlay,
  orbitSun,
  orbitMoon,
  sunTrailGeometry,
  sunTrailPointsGeometry,
  moonTrailGeometry,
  moonTrailPointsGeometry,
  northSeasonOverlay,
  southSeasonOverlay
}) {
  const observationTimeFormatter = new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "medium"
  });
  const sunTrailPoints = [];
  const moonTrailPoints = [];

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
        const red = THREE.MathUtils.lerp(12, 96, twilightMix);
        const green = THREE.MathUtils.lerp(20, 128, twilightMix);
        const blue = THREE.MathUtils.lerp(34, 196, twilightMix);
        const alpha = Math.round((nightStrength * 172) + (twilightMix * 52));

        data[index] = Math.round(red);
        data[index + 1] = Math.round(green);
        data[index + 2] = Math.round(blue);
        data[index + 3] = THREE.MathUtils.clamp(alpha, 0, 210);
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

  function setTrailPoints(target, lineGeometry, pointsGeometry, points) {
    target.length = 0;
    target.push(...points);
    lineGeometry.setFromPoints(target);
    pointsGeometry.setFromPoints(target);
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
    updateDayNightOverlayFromSun(snapshot.sun.latitudeDegrees, snapshot.sun.longitudeDegrees);

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
    const radialPulse =
      Math.sin(simulationState.orbitMoonDriftPhase * 1.37) * constants.ORBIT_MOON_RADIUS_SWAY +
      Math.cos(simulationState.orbitMoonDriftPhase * 0.61) * 0.26;
    const driftX = Math.cos(simulationState.orbitMoonDriftPhase * 0.73) * constants.ORBIT_MOON_FREE_OFFSET;
    const driftZ = Math.sin(simulationState.orbitMoonDriftPhase * 1.12) * constants.ORBIT_MOON_FREE_OFFSET * 0.82;
    const orbitRadius = THREE.MathUtils.clamp(
      constants.ORBIT_MOON_RADIUS_BASE + radialPulse,
      constants.TROPIC_CANCER_RADIUS - 0.15,
      constants.DOME_RADIUS - 0.24
    );
    const height =
      getMoonBaseHeight(seasonRadius) +
      Math.sin(simulationState.orbitMoonDriftPhase * 1.84) * 0.2 +
      Math.cos(simulationState.orbitMoonAngle * 0.58) * 0.08;
    const safeDomeRadius = constants.DOME_RADIUS - (constants.ORBIT_MOON_SIZE * 1.6);
    const domeHeightOffset = THREE.MathUtils.clamp(height - constants.DOME_BASE_Y, 0, safeDomeRadius);
    const maxPlanarRadius = Math.sqrt(Math.max(0, (safeDomeRadius ** 2) - (domeHeightOffset ** 2)));
    let moonX = Math.cos(simulationState.orbitMoonAngle) * orbitRadius + driftX;
    let moonZ = Math.sin(simulationState.orbitMoonAngle) * orbitRadius + driftZ;
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
    syncDayNightOverlayUi,
    syncLiveObservationInput,
    updateDayNightOverlayFromSun,
    updateMoonOrbit,
    updateMoonTrail,
    updateOrbitModeUi,
    updateSeasonPresentation,
    updateSunTrail
  };
}
