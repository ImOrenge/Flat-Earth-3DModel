import * as THREE from "../vendor/three.module.js";

export function setupInputHandlers(deps) {
  const {
    constants,
    canvas,
    cameraApi,
    walkerApi,
    celestialTrackingCameraApi,
    magneticFieldApi,
    routeSimulationApi,
    textureApi,
    astronomyApi,
    rocketApi,
    ui,
    renderState,
    walkerState,
    cameraState,
    movementState,
    simulationState,
    astronomyState,
    celestialControlState,
    isUiBlocking,
    skyTexture,
    scene,
    setControlTab,
    createSolarEclipseState,
    syncFullTrailVisibility,
    resetDarkSunStageState,
    showSolarEclipseToast,
    resetDarkSunOcclusionMotion,
    darkSunOcclusionState,
    controlTabButtons, languageToggleEl, i18n, uploadInput, resetButton,
    exitFirstPersonMode, enterFirstPersonMode, walkerModeEl, resetWalkerButton,
    routeSelectEl, routeSpeedEl, celestialTrailLengthEl, celestialSpeedEl,
    celestialFullTrailEl, routePlaybackButton, routeResetButton, realitySyncEl,
    realityLiveEl, observationTimeEl, observationMinusHourButton, observationPlusHourButton,
    observationMinusMinuteButton, observationPlusMinuteButton, applyObservationTimeButton, setCurrentTimeButton,
    dayNightOverlayEl, dayNightState, getGeoFromProjectedPosition, orbitSun,
    analemmaOverlayEl, analemmaState, magneticFieldOverlayEl, magneticFieldState,
    darkSunDebugEl, getCurrentUiSnapshot, syncDarkSunPresentation,
    stagePreEclipseButton, stagePreEclipseScene,
    stagePreLunarEclipseButton, stagePreLunarEclipseScene,
    skyAnalemmaOverlayEl, skyAnalemmaState, orbitModeButtons, cameraTrackButtons, seasonalYearEl,
    seasonalEventButtons, setDemoMoonOrbitOffsetFromPhase, setDemoSeasonPhaseFromDate
  } = deps;

  const { rocketSpaceportSelect, rocketTypeSelect, rocketLaunchBtn } = ui;

  const {
    WALKER_PITCH_MIN,
    WALKER_PITCH_MAX,
    CAMERA_TRACKING_MIN_DISTANCE,
    CAMERA_TRACKING_MAX_DISTANCE,
    CAMERA_TOPDOWN_MIN_RADIUS,
    CAMERA_TOPDOWN_MAX_RADIUS,
    FOG_DEFAULT_NEAR,
    FOG_DEFAULT_FAR,
    DISC_RADIUS
  } = constants;

  let isDragging = false;
  
  let previousX = 0;
  
  let previousY = 0;
  
  
  
  canvas.addEventListener("pointerdown", (event) => {
  
    if (renderState.preparing || isUiBlocking?.()) {
  
      return;
  
    }
  
    isDragging = true;
  
    previousX = event.clientX;
  
    previousY = event.clientY;
  
    canvas.setPointerCapture(event.pointerId);
  
  });
  
  
  
  canvas.addEventListener("pointermove", (event) => {
  
    if (!isDragging || renderState.preparing || isUiBlocking?.()) {
  
      return;
  
    }
  
  
  
    const deltaX = event.clientX - previousX;
  
    const deltaY = event.clientY - previousY;
  
  
  
    if (walkerState.enabled) {
  
      walkerState.heading -= deltaX * 0.005;
  
      walkerState.pitch = THREE.MathUtils.clamp(
  
        walkerState.pitch - (deltaY * 0.004),
  
        constants.WALKER_PITCH_MIN,
  
        constants.WALKER_PITCH_MAX
  
      );
  
    } else if (cameraState.mode === "tracking") {
  
      cameraState.targetTrackingAzimuth -= deltaX * 0.008;
  
      cameraState.targetTrackingElevation -= deltaY * 0.006;
  
      cameraApi.clampCamera();
  
    } else {
  
      cameraState.targetTheta -= deltaX * 0.008;
  
      cameraState.targetPhi += deltaY * 0.006;
  
      cameraApi.clampCamera();
  
    }
  
  
  
    previousX = event.clientX;
  
    previousY = event.clientY;
  
  });
  
  
  
  function stopDrag(event) {
  
    if (!isDragging) {
  
      return;
  
    }
  
    isDragging = false;
  
    if (event) {
  
      canvas.releasePointerCapture(event.pointerId);
  
    }
  
  }
  
  
  
  canvas.addEventListener("pointerup", stopDrag);
  
  canvas.addEventListener("pointerleave", stopDrag);
  
  canvas.addEventListener("pointercancel", stopDrag);
  
  
  
  canvas.addEventListener("wheel", (event) => {
  
    if (walkerState.enabled || renderState.preparing || isUiBlocking?.()) {
  
      return;
  
    }
  
    event.preventDefault();
  
    if (cameraState.mode === "tracking") {
  
      cameraState.targetTrackingDistance += event.deltaY * 0.01;
  
    } else {
  
      cameraState.targetRadius += event.deltaY * 0.01;
  
    }
  
    cameraApi.clampCamera();
  
  }, { passive: false });
  
  
  
  for (const button of controlTabButtons) {
  
    button.addEventListener("click", () => {
  
      setControlTab(button.dataset.controlTab);
  
    });
  
  }
  
  
  
  languageToggleEl.addEventListener("change", () => {
  
    i18n.setLanguage(languageToggleEl.checked ? "en" : "ko");
  
  });
  
  
  
  uploadInput.addEventListener("change", (event) => {
  
    const file = event.target.files[0];
  
    textureApi.loadUserTexture(file);
  
  });
  
  
  
  resetButton.addEventListener("click", () => {
  
    if (walkerState.enabled || renderState.preparing) {
  
      exitFirstPersonMode();
  
    }
  
    celestialTrackingCameraApi.clearTracking();
  
    cameraState.targetTheta = -0.55;
  
    cameraState.targetPhi = 1.12;
  
    cameraState.targetRadius = constants.CAMERA_TOPDOWN_DEFAULT_RADIUS;
  
    cameraState.targetTrackingAzimuth = constants.CAMERA_TRACKING_DEFAULT_AZIMUTH;
  
    cameraState.targetTrackingElevation = constants.CAMERA_TRACKING_DEFAULT_ELEVATION;
  
    cameraState.targetTrackingDistance = constants.CAMERA_TRACKING_DEFAULT_DISTANCE;
  
    cameraApi.clampCamera();
  
  });
  
  
  
  walkerModeEl.addEventListener("change", () => {
  
    if (walkerModeEl.checked) {
  
      enterFirstPersonMode();
  
      return;
  
    }
  
  
  
    exitFirstPersonMode();
  
  });
  
  
  
  resetWalkerButton.addEventListener("click", () => {
  
    if (renderState.preparing) {
  
      return;
  
    }
  
    walkerApi.resetWalkerPosition();
  
    walkerState.heading = Math.PI * 0.1;
  
    walkerState.pitch = -0.08;
  
    walkerApi.updateWalkerAvatar();
  
  });
  
  
  
  routeSelectEl.addEventListener("change", () => {
  
    routeSimulationApi.selectRoute(routeSelectEl.value);
  
  });
  
  
  
  routeSpeedEl.addEventListener("input", () => {
  
    routeSimulationApi.setSpeedMultiplier(routeSpeedEl.value);
  
  });
  
  
  
  celestialTrailLengthEl.addEventListener("input", () => {
  
    celestialControlState.trailLengthFactor = THREE.MathUtils.clamp(
  
      Number.parseFloat(celestialTrailLengthEl.value) / 100,
  
      0,
  
      1
  
    );
  
    astronomyApi.syncAstronomyControls();
  
    astronomyApi.refreshTrailsForCurrentMode();
  
  });
  
  
  
  celestialSpeedEl.addEventListener("input", () => {
  
    celestialControlState.speedMultiplier = THREE.MathUtils.clamp(
  
      Number.parseFloat(celestialSpeedEl.value),
  
      0,
  
      5
  
    );
  
    astronomyApi.syncAstronomyControls();
  
  });
  
  
  
  celestialFullTrailEl.addEventListener("change", () => {
  
    celestialControlState.showFullTrail = celestialFullTrailEl.checked;
  
    astronomyApi.syncAstronomyControls();
  
    syncFullTrailVisibility();
  
  });
  
  
  
  routePlaybackButton.addEventListener("click", () => {
  
    routeSimulationApi.togglePlayback();
  
  });
  
  
  
  routeResetButton.addEventListener("click", () => {
  
    routeSimulationApi.resetProgress();
  
  });
  
  
  
  function getObservationBaseDate() {
  
    const inputDate = new Date(observationTimeEl.value);
  
    if (!Number.isNaN(inputDate.getTime())) {
  
      return inputDate;
  
    }
  
    if (astronomyState.selectedDate instanceof Date && !Number.isNaN(astronomyState.selectedDate.getTime())) {
  
      return new Date(astronomyState.selectedDate.getTime());
  
    }
  
    return new Date();
  
  }
  
  
  
  function applyObservationPreviewDate(nextDate) {
  
    const safeDate = (
      nextDate instanceof Date && !Number.isNaN(nextDate.getTime())
    )
      ? nextDate
      : new Date();
  
    realitySyncEl.checked = true;
  
    realityLiveEl.checked = false;
  
    resetDarkSunStageState();
  
    astronomyApi.enableRealityMode({ live: false, date: safeDate });
  
  }
  
  
  
  function shiftObservationTimeByMinutes(minuteDelta = 0) {
  
    if (!Number.isFinite(minuteDelta) || minuteDelta === 0) {
  
      return;
  
    }
  
    const baseDate = getObservationBaseDate();
  
    const nextDate = new Date(baseDate.getTime() + (minuteDelta * 60_000));
  
    astronomyApi.setObservationInputValue(nextDate);
  
    applyObservationPreviewDate(nextDate);
  
  }
  
  
  
  realitySyncEl.addEventListener("change", () => {
  
    if (realitySyncEl.checked) {
  
      resetDarkSunStageState();
  
      const nextDate = realityLiveEl.checked ? new Date() : new Date(observationTimeEl.value);
  
      astronomyApi.enableRealityMode({
  
        live: realityLiveEl.checked,
  
        date: Number.isNaN(nextDate.getTime()) ? new Date() : nextDate
  
      });
  
      return;
  
    }
  
    simulationState.demoPhaseDateMs = astronomyState.selectedDate.getTime();
  
    setDemoMoonOrbitOffsetFromPhase(simulationState.demoPhaseDateMs);
    setDemoSeasonPhaseFromDate(simulationState.demoPhaseDateMs);
  

  
    astronomyApi.disableRealityMode();
  
  });
  
  
  
  realityLiveEl.addEventListener("change", () => {
  
    if (!realitySyncEl.checked) {
  
      realityLiveEl.checked = false;
  
      return;
  
    }
  
    if (realityLiveEl.checked) {
  
      resetDarkSunStageState();
  
      astronomyApi.enableRealityMode({ live: true, date: new Date() });
  
      return;
  
    }
  
    astronomyApi.applyObservationTimeSelection();
  
  });
  
  
  
  observationTimeEl.addEventListener("change", () => {
  
    if (!realitySyncEl.checked) {
  
      realitySyncEl.checked = true;
  
    }
  
    realityLiveEl.checked = false;
  
    astronomyApi.applyObservationTimeSelection();
  
  });
  
  
  
  if (observationMinusHourButton) {
  
    observationMinusHourButton.addEventListener("click", () => {
  
      shiftObservationTimeByMinutes(-60);
  
    });
  
  }
  
  
  
  if (observationPlusHourButton) {
  
    observationPlusHourButton.addEventListener("click", () => {
  
      shiftObservationTimeByMinutes(60);
  
    });
  
  }
  
  
  
  if (observationMinusMinuteButton) {
  
    observationMinusMinuteButton.addEventListener("click", () => {
  
      shiftObservationTimeByMinutes(-10);
  
    });
  
  }
  
  
  
  if (observationPlusMinuteButton) {
  
    observationPlusMinuteButton.addEventListener("click", () => {
  
      shiftObservationTimeByMinutes(10);
  
    });
  
  }
  
  
  
  applyObservationTimeButton.addEventListener("click", () => {
  
    if (!realitySyncEl.checked) {
  
      realitySyncEl.checked = true;
  
    }
  
    realityLiveEl.checked = false;
  
    astronomyApi.applyObservationTimeSelection();
  
  });
  
  
  
  setCurrentTimeButton.addEventListener("click", () => {
  
    realitySyncEl.checked = true;
  
    realityLiveEl.checked = true;
  
    resetDarkSunStageState();
  
    astronomyApi.enableRealityMode({ live: true, date: new Date() });
  
  });
  
  
  
  dayNightOverlayEl.addEventListener("change", () => {
  
    dayNightState.enabled = dayNightOverlayEl.checked;
  
    dayNightState.lastLatitudeDegrees = null;
  
    dayNightState.lastLongitudeDegrees = null;
  
    astronomyApi.syncDayNightOverlayUi();
  
  
  
    if (astronomyState.enabled) {
  
      const observationDate = astronomyState.live ? new Date() : astronomyState.selectedDate;
  
      const snapshot = astronomyApi.getAstronomySnapshot(observationDate);
  
      astronomyApi.updateDayNightOverlayFromSun(snapshot.sun.latitudeDegrees, snapshot.sun.longitudeDegrees, true);
  
      return;
  
    }
  
  
  
    const demoSunGeo = getGeoFromProjectedPosition(orbitSun.position, DISC_RADIUS);
  
    astronomyApi.updateDayNightOverlayFromSun(demoSunGeo.latitudeDegrees, demoSunGeo.longitudeDegrees, true);
  
  });
  
  
  
  analemmaOverlayEl.addEventListener("change", () => {
  
    analemmaState.enabled = analemmaOverlayEl.checked;
  
    const projectionDate = astronomyState.live ? new Date() : astronomyState.selectedDate;
  
    astronomyApi.syncAnalemmaUi(projectionDate, true);
  
  });
  
  
  
  if (magneticFieldOverlayEl) {
  
    magneticFieldOverlayEl.addEventListener("change", () => {
  
      magneticFieldState.enabled = magneticFieldOverlayEl.checked;
  
      magneticFieldApi.syncUi();
  
    });
  
  }
  if (darkSunDebugEl) {
    darkSunDebugEl.addEventListener("change", () => {
      simulationState.darkSunDebugVisible = darkSunDebugEl.checked;
      const snapshot = getCurrentUiSnapshot();
      astronomyApi.updateAstronomyUi(snapshot);
      syncDarkSunPresentation(snapshot.solarEclipse ?? createSolarEclipseState());
    });
  }

  if (stagePreEclipseButton) {
    stagePreEclipseButton.addEventListener("click", () => {
      stagePreEclipseScene();
    });
  }

  if (stagePreLunarEclipseButton) {
    stagePreLunarEclipseButton.addEventListener("click", () => {
      stagePreLunarEclipseScene();
    });
  }

  skyAnalemmaOverlayEl.addEventListener("change", () => {
    skyAnalemmaState.enabled = skyAnalemmaOverlayEl.checked;
    const projectionDate = astronomyState.live ? new Date() : astronomyState.selectedDate;
    astronomyApi.syncSkyAnalemmaUi(projectionDate, true);
  });

  for (const button of orbitModeButtons) {
    button.addEventListener("click", () => {
      simulationState.orbitMode = button.dataset.orbitMode;
      astronomyApi.updateOrbitModeUi();
      astronomyApi.refreshTrailsForCurrentMode();
    });
  }

  for (const button of cameraTrackButtons) {
    button.addEventListener("click", () => {
      celestialTrackingCameraApi.setTarget(button.dataset.cameraTrack);
    });
  }

  seasonalYearEl.addEventListener("change", () => {
  
    astronomyApi.previewSeasonalMoonAudit(undefined, seasonalYearEl.value);
  
  });
  
  
  
  for (const button of seasonalEventButtons) {
  
    button.addEventListener("click", () => {
  
      astronomyApi.previewSeasonalMoonAudit(button.dataset.seasonalEvent, seasonalYearEl.value);
  
    });
  
  }
  
  
  
  window.addEventListener("resize", () => {
  
    cameraApi.resize();
  
  });
  
  
  
  window.addEventListener("keydown", (event) => {
  
    if (event.repeat || renderState.preparing || isUiBlocking?.()) {
  
      return;
  
    }
  
  
  
    switch (event.code) {
  
      case "KeyW":
  
      case "ArrowUp":
  
        movementState.forward = true;
  
        event.preventDefault();
  
        break;
  
      case "KeyS":
  
      case "ArrowDown":
  
        movementState.backward = true;
  
        event.preventDefault();
  
        break;
  
      case "KeyA":
  
      case "ArrowLeft":
  
        movementState.left = true;
  
        event.preventDefault();
  
        break;
  
      case "KeyD":
  
      case "ArrowRight":
  
        movementState.right = true;
  
        event.preventDefault();
  
        break;
  
      default:
  
        break;
  
    }
  
  });
  
  
  
  window.addEventListener("keyup", (event) => {
  
    if (isUiBlocking?.()) {
  
      return;
  
    }
  
    switch (event.code) {
  
      case "KeyW":
  
      case "ArrowUp":
  
        movementState.forward = false;
  
        break;
  
      case "KeyS":
  
      case "ArrowDown":
  
        movementState.backward = false;
  
        break;
  
      case "KeyA":
  
      case "ArrowLeft":
  
        movementState.left = false;
  
        break;
  
      case "KeyD":
  
      case "ArrowRight":
  
        movementState.right = false;
  
        break;
  
      default:
        break;
    }
  });

  if (rocketLaunchBtn && rocketSpaceportSelect) {
    rocketLaunchBtn.addEventListener("click", () => {
      const index     = parseInt(rocketSpaceportSelect.value, 10);
      const rocketType = rocketTypeSelect ? rocketTypeSelect.value : "two-stage";
      if (!isNaN(index)) {
        rocketApi.launchRocket(index, rocketType);
      }
    });
  }
}
