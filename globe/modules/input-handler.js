import * as THREE from "../../vendor/three.module.js";

export function setupInputHandlers(deps) {
  const {
    constants,
    canvas,
    cameraApi,
    walkerApi,
    celestialTrackingCameraApi,
    magneticFieldApi,
    routeSimulationApi,
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
    defaultCameraLookTarget,
    setControlTab,
    createSolarEclipseState,
    syncFullTrailVisibility,
    resetDarkSunStageState,
    showSolarEclipseToast,
    resetDarkSunOcclusionMotion,
    darkSunOcclusionState,
    controlTabButtons, cameraPresetButtons = [], cameraViewToggleEl = null, syncCameraViewToggleUi = () => {}, languageToggleEl, i18n, resetButton,
    exitFirstPersonMode, enterFirstPersonMode, walkerModeEl, resetWalkerButton,
    routeSelectEl, routeSpeedEl, celestialTrailLengthEl, celestialSpeedEl, celestialSpeedPresetButtons = [],
    celestialFullTrailEl, routePlaybackButton, routeResetButton, realitySyncEl,
    realityLiveEl, observationTimeEl, observationMinusHourButton, observationPlusHourButton,
    eclipseCatalogSourceEl, eclipseCatalogUploadEl, eclipseKindSelectEl, eclipseYearSelectEl,
    eclipseEventSelectEl, eclipseTimePointSelectEl, previewSelectedEclipseButton,
    observationMinusMinuteButton, observationPlusMinuteButton, applyObservationTimeButton, setCurrentTimeButton,
    dayNightOverlayEl, dayNightState, getGeoFromProjectedPosition, orbitSun,
    analemmaOverlayEl, analemmaState, magneticFieldOverlayEl, magneticFieldState,
    darkSunDebugEl, getCurrentUiSnapshot, syncDarkSunPresentation,
    stagePreEclipseButton, stagePreEclipseScene,
    stagePreLunarEclipseButton, stagePreLunarEclipseScene,
    skyAnalemmaOverlayEl, skyAnalemmaState, orbitModeButtons, cameraTrackButtons, seasonalYearEl,
    seasonalEventButtons
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
  let dragPointerId = null;
  let previousX = 0;
  let previousY = 0;
  let pinchDistance = null;
  const activePointers = new Map();
  let lastTapTime = 0;
  let lastTapX = 0;
  let lastTapY = 0;
  const DOUBLE_TAP_MAX_DELAY_MS = 280;
  const DOUBLE_TAP_MAX_DISTANCE_PX = 32;
  const TAP_MOVE_TOLERANCE_PX = 14;
  const PINCH_TO_WHEEL_FACTOR = 4;
  const TOUCH_DRAG_SENSITIVITY = 1.2;
  const TOUCH_PINCH_TO_WHEEL_FACTOR = 3.5;
  let touchFallbackActive = false;
  let touchDragActive = false;
  let touchPreviousX = 0;
  let touchPreviousY = 0;
  let touchPinchDistance = null;
  let touchStartX = 0;
  let touchStartY = 0;
  let touchStartTime = 0;

  function getResponsivePresetValues(preset = "top") {
    const viewportWidth = Math.max(canvas?.clientWidth || window.innerWidth || 0, 1);
    const viewportHeight = Math.max(canvas?.clientHeight || window.innerHeight || 0, 1);
    const isMobileViewport = viewportWidth <= 1080;
    const aspectRatio = viewportWidth / viewportHeight;
    const portraitTightness = isMobileViewport
      ? THREE.MathUtils.clamp((0.68 - aspectRatio) / 0.28, 0, 1)
      : 0;
    const isGlobeView = cameraState.earthModelView === "spherical";

    if (preset === "angle") {
      return {
        theta: constants.CAMERA_ANGLED_DEFAULT_THETA,
        phi: THREE.MathUtils.lerp(constants.CAMERA_ANGLED_DEFAULT_PHI, 1.02, portraitTightness),
        radius: (isGlobeView
          ? (constants.CAMERA_GLOBE_DEFAULT_RADIUS ?? constants.CAMERA_ANGLED_DEFAULT_RADIUS)
          : constants.CAMERA_ANGLED_DEFAULT_RADIUS) * THREE.MathUtils.lerp(1, 0.88, portraitTightness)
      };
    }

    if (isGlobeView) {
      return {
        theta: 0,
        phi: THREE.MathUtils.lerp(0.42, 0.34, portraitTightness),
        radius: (constants.CAMERA_GLOBE_DEFAULT_RADIUS ?? constants.CAMERA_TOPDOWN_FULL_RADIUS) * THREE.MathUtils.lerp(1.08, 0.94, portraitTightness)
      };
    }

    return {
      theta: constants.CAMERA_TOPDOWN_EXACT_THETA,
      phi: THREE.MathUtils.lerp(constants.CAMERA_TOPDOWN_EXACT_PHI, 0.022, portraitTightness),
      radius: constants.CAMERA_TOPDOWN_FULL_RADIUS * THREE.MathUtils.lerp(1, 0.82, portraitTightness)
    };
  }

  function applyCameraPreset(preset = "top") {
    if (walkerState.enabled || renderState.preparing) {
      exitFirstPersonMode();
    }

    const responsivePreset = getResponsivePresetValues(preset);

    celestialTrackingCameraApi.clearTracking();
    if (defaultCameraLookTarget) {
      cameraState.targetLookTarget.copy(defaultCameraLookTarget);
      cameraState.lookTarget.copy(defaultCameraLookTarget);
    }
    cameraState.targetTheta = responsivePreset.theta;
    cameraState.targetPhi = responsivePreset.phi;
    cameraState.targetRadius = responsivePreset.radius;
    cameraState.targetTrackingAzimuth = constants.CAMERA_TRACKING_DEFAULT_AZIMUTH;
    cameraState.targetTrackingElevation = constants.CAMERA_TRACKING_DEFAULT_ELEVATION;
    cameraState.targetTrackingDistance = constants.CAMERA_TRACKING_DEFAULT_DISTANCE;
    cameraApi.clampCamera();
    if (cameraViewToggleEl) {
      cameraViewToggleEl.checked = preset === "angle";
      syncCameraViewToggleUi();
    }
  }
  
  
  
  function getCurrentPinchDistance() {
    if (activePointers.size < 2) {
      return null;
    }

    const pointers = Array.from(activePointers.values());
    const first = pointers[0];
    const second = pointers[1];
    return Math.hypot(second.x - first.x, second.y - first.y);
  }

  function applyDragDelta(deltaX, deltaY, pointerType = "mouse") {
    const dragSensitivity = pointerType === "touch" ? TOUCH_DRAG_SENSITIVITY : 1;
    const adjustedDeltaX = deltaX * dragSensitivity;
    const adjustedDeltaY = deltaY * dragSensitivity;

    if (walkerState.enabled) {
      walkerState.heading -= adjustedDeltaX * 0.005;
      walkerState.pitch = THREE.MathUtils.clamp(
        walkerState.pitch - (adjustedDeltaY * 0.004),
        constants.WALKER_PITCH_MIN,
        constants.WALKER_PITCH_MAX
      );
      return;
    }

    if (cameraState.mode === "tracking") {
      cameraState.targetTrackingAzimuth -= adjustedDeltaX * 0.008;
      cameraState.targetTrackingElevation -= adjustedDeltaY * 0.006;
      cameraApi.clampCamera();
      return;
    }

    cameraState.targetTheta -= adjustedDeltaX * 0.008;
    cameraState.targetPhi += adjustedDeltaY * 0.006;
    cameraApi.clampCamera();
  }

  function applyZoomDelta(deltaY) {
    if (walkerState.enabled || renderState.preparing || isUiBlocking?.()) {
      return;
    }

    if (cameraState.mode === "tracking") {
      cameraState.targetTrackingDistance += deltaY * 0.01;
    } else {
      cameraState.targetRadius += deltaY * 0.01;
    }

    cameraApi.clampCamera();
  }

  function stopDraggingPointer(pointerId = null) {
    if (!isDragging) {
      return;
    }
    if (pointerId !== null && dragPointerId !== pointerId) {
      return;
    }
    isDragging = false;
    dragPointerId = null;
  }

  function releasePointerCaptureSafely(pointerId) {
    if (typeof canvas.releasePointerCapture !== "function") {
      return;
    }
    try {
      if (typeof canvas.hasPointerCapture !== "function" || canvas.hasPointerCapture(pointerId)) {
        canvas.releasePointerCapture(pointerId);
      }
    } catch {
      // noop
    }
  }

  function isTouchGestureBlockedTarget(target) {
    if (!(target instanceof Element)) {
      return false;
    }
    return Boolean(
      target.closest("button,a,input,select,textarea,label,[role='button'],[role='slider'],[contenteditable='true']")
    );
  }

  canvas.addEventListener("pointerdown", (event) => {
    if (touchFallbackActive && event.pointerType === "touch") {
      return;
    }

    if (renderState.preparing || isUiBlocking?.()) {
      return;
    }

    activePointers.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
      startX: event.clientX,
      startY: event.clientY,
      startTime: performance.now(),
      pointerType: event.pointerType
    });

    if (typeof canvas.setPointerCapture === "function") {
      try {
        canvas.setPointerCapture(event.pointerId);
      } catch {
        // noop
      }
    }

    if (event.pointerType === "touch") {
      event.preventDefault();
    }

    if (activePointers.size === 1) {
      isDragging = true;
      dragPointerId = event.pointerId;
      previousX = event.clientX;
      previousY = event.clientY;
      pinchDistance = null;
      return;
    }

    stopDraggingPointer();
    pinchDistance = getCurrentPinchDistance();
  });

  canvas.addEventListener("pointermove", (event) => {
    if (touchFallbackActive && event.pointerType === "touch") {
      return;
    }

    const pointer = activePointers.get(event.pointerId);
    if (!pointer) {
      return;
    }

    pointer.x = event.clientX;
    pointer.y = event.clientY;

    if (renderState.preparing || isUiBlocking?.()) {
      return;
    }

    if (activePointers.size >= 2) {
      const nextPinchDistance = getCurrentPinchDistance();
      if (nextPinchDistance !== null) {
        if (pinchDistance !== null) {
          const pinchDelta = nextPinchDistance - pinchDistance;
          if (Math.abs(pinchDelta) > 0.5) {
            applyZoomDelta(-pinchDelta * PINCH_TO_WHEEL_FACTOR);
          }
        }
        pinchDistance = nextPinchDistance;
      }
      event.preventDefault();
      return;
    }

    if (!isDragging || dragPointerId !== event.pointerId) {
      return;
    }

    const deltaX = event.clientX - previousX;
    const deltaY = event.clientY - previousY;
    applyDragDelta(deltaX, deltaY, event.pointerType);

    previousX = event.clientX;
    previousY = event.clientY;
  });

  function handlePointerEnd(event) {
    if (touchFallbackActive && event.pointerType === "touch") {
      return;
    }

    const pointer = activePointers.get(event.pointerId);
    const wasSingleTouch = activePointers.size === 1;

    if (
      pointer &&
      wasSingleTouch &&
      pointer.pointerType === "touch" &&
      event.type === "pointerup"
    ) {
      const elapsedMs = performance.now() - pointer.startTime;
      const movedDistance = Math.hypot(
        event.clientX - pointer.startX,
        event.clientY - pointer.startY
      );
      if (elapsedMs <= DOUBLE_TAP_MAX_DELAY_MS && movedDistance <= TAP_MOVE_TOLERANCE_PX) {
        const now = performance.now();
        const sinceLastTap = now - lastTapTime;
        const tapDistance = Math.hypot(event.clientX - lastTapX, event.clientY - lastTapY);
        if (sinceLastTap <= DOUBLE_TAP_MAX_DELAY_MS && tapDistance <= DOUBLE_TAP_MAX_DISTANCE_PX) {
          applyCameraPreset("top");
          lastTapTime = 0;
          lastTapX = 0;
          lastTapY = 0;
        } else {
          lastTapTime = now;
          lastTapX = event.clientX;
          lastTapY = event.clientY;
        }
      }
    }

    activePointers.delete(event.pointerId);
    stopDraggingPointer(event.pointerId);
    releasePointerCaptureSafely(event.pointerId);

    if (activePointers.size >= 2) {
      pinchDistance = getCurrentPinchDistance();
      return;
    }

    pinchDistance = null;

    if (activePointers.size === 1) {
      const [remainingPointerId, remainingPointer] = activePointers.entries().next().value;
      isDragging = true;
      dragPointerId = remainingPointerId;
      previousX = remainingPointer.x;
      previousY = remainingPointer.y;
    }
  }

  canvas.addEventListener("pointerup", handlePointerEnd);
  canvas.addEventListener("pointerleave", handlePointerEnd);
  canvas.addEventListener("pointercancel", handlePointerEnd);

  canvas.addEventListener("touchstart", (event) => {
    if (renderState.preparing || isUiBlocking?.() || isTouchGestureBlockedTarget(event.target)) {
      return;
    }

    touchFallbackActive = true;

    if (event.touches.length === 1) {
      const touch = event.touches[0];
      touchDragActive = true;
      touchPreviousX = touch.clientX;
      touchPreviousY = touch.clientY;
      touchStartX = touch.clientX;
      touchStartY = touch.clientY;
      touchStartTime = performance.now();
      touchPinchDistance = null;
      event.preventDefault();
      return;
    }

    touchDragActive = false;
    if (event.touches.length >= 2) {
      const first = event.touches[0];
      const second = event.touches[1];
      touchPinchDistance = Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY);
      event.preventDefault();
    }
  }, { passive: false });

  canvas.addEventListener("touchmove", (event) => {
    if (!touchFallbackActive || renderState.preparing || isUiBlocking?.()) {
      return;
    }

    if (event.touches.length >= 2) {
      const first = event.touches[0];
      const second = event.touches[1];
      const nextDistance = Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY);
      if (touchPinchDistance !== null) {
        const pinchDelta = nextDistance - touchPinchDistance;
        if (Math.abs(pinchDelta) > 0.5) {
          applyZoomDelta(-pinchDelta * TOUCH_PINCH_TO_WHEEL_FACTOR);
        }
      }
      touchPinchDistance = nextDistance;
      event.preventDefault();
      return;
    }

    if (!touchDragActive || event.touches.length !== 1) {
      return;
    }

    const touch = event.touches[0];
    const deltaX = touch.clientX - touchPreviousX;
    const deltaY = touch.clientY - touchPreviousY;
    applyDragDelta(deltaX, deltaY, "touch");
    touchPreviousX = touch.clientX;
    touchPreviousY = touch.clientY;
    event.preventDefault();
  }, { passive: false });

  canvas.addEventListener("touchend", (event) => {
    if (!touchFallbackActive) {
      return;
    }

    if (touchDragActive && event.touches.length === 0) {
      const elapsedMs = performance.now() - touchStartTime;
      const movedDistance = Math.hypot(
        touchPreviousX - touchStartX,
        touchPreviousY - touchStartY
      );
      if (elapsedMs <= DOUBLE_TAP_MAX_DELAY_MS && movedDistance <= TAP_MOVE_TOLERANCE_PX) {
        const now = performance.now();
        const sinceLastTap = now - lastTapTime;
        const tapDistance = Math.hypot(touchPreviousX - lastTapX, touchPreviousY - lastTapY);
        if (sinceLastTap <= DOUBLE_TAP_MAX_DELAY_MS && tapDistance <= DOUBLE_TAP_MAX_DISTANCE_PX) {
          applyCameraPreset("top");
          lastTapTime = 0;
          lastTapX = 0;
          lastTapY = 0;
        } else {
          lastTapTime = now;
          lastTapX = touchPreviousX;
          lastTapY = touchPreviousY;
        }
      }
    }

    if (event.touches.length === 1) {
      const touch = event.touches[0];
      touchDragActive = true;
      touchPreviousX = touch.clientX;
      touchPreviousY = touch.clientY;
      touchStartX = touch.clientX;
      touchStartY = touch.clientY;
      touchStartTime = performance.now();
      touchPinchDistance = null;
      event.preventDefault();
      return;
    }

    touchDragActive = false;
    if (event.touches.length >= 2) {
      const first = event.touches[0];
      const second = event.touches[1];
      touchPinchDistance = Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY);
      event.preventDefault();
      return;
    }

    touchPinchDistance = null;
    touchFallbackActive = false;
  }, { passive: false });

  canvas.addEventListener("touchcancel", () => {
    touchDragActive = false;
    touchPinchDistance = null;
    touchFallbackActive = false;
  }, { passive: false });

  canvas.addEventListener("wheel", (event) => {
    if (walkerState.enabled || renderState.preparing || isUiBlocking?.()) {
      return;
    }

    event.preventDefault();
    applyZoomDelta(event.deltaY);
  }, { passive: false });
  
  
  
  for (const button of controlTabButtons) {
  
    button.addEventListener("click", () => {
  
      setControlTab(button.dataset.controlTab);
  
    });
  
  }
  
  
  
  languageToggleEl.addEventListener("change", () => {
  
    i18n.setLanguage(languageToggleEl.checked ? "en" : "ko");
  
  });
  
  
  
  resetButton.addEventListener("click", () => {
  
    applyCameraPreset("top");
  
  });

  for (const button of cameraPresetButtons) {
  
    button.addEventListener("click", () => {
  
      applyCameraPreset(button.dataset.cameraPreset === "angle" ? "angle" : "top");
  
    });
  
  }

  if (cameraViewToggleEl) {
    cameraViewToggleEl.addEventListener("change", () => {
      applyCameraPreset(cameraViewToggleEl.checked ? "angle" : "top");
    });
  }
  
  
  
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
  
  
  
  function applyCelestialSpeedMultiplier(value) {
    const parsed = Number.parseFloat(value);
    if (!Number.isFinite(parsed)) {
      return;
    }
    const nextSpeed = THREE.MathUtils.clamp(
      parsed,
      constants.CELESTIAL_SPEED_MIN,
      constants.CELESTIAL_SPEED_MAX
    );
    celestialControlState.speedMultiplier = nextSpeed;
    if (celestialSpeedEl) {
      celestialSpeedEl.value = String(nextSpeed);
    }
    astronomyApi.rebaseAcceleratedTimeline();
    astronomyApi.syncAstronomyControls();
  }

  celestialSpeedEl.addEventListener("input", () => {
    applyCelestialSpeedMultiplier(celestialSpeedEl.value);
  });

  for (const button of celestialSpeedPresetButtons) {
    button.addEventListener("click", () => {
      applyCelestialSpeedMultiplier(button.dataset.celestialSpeedPreset);
    });
  }
  
  
  
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

  function getModeSwitchAnchorDate() {
    if (!astronomyState.enabled) {
      if (Number.isFinite(simulationState.simulatedDateMs)) {
        return new Date(simulationState.simulatedDateMs);
      }
      if (Number.isFinite(simulationState.demoPhaseDateMs)) {
        return new Date(simulationState.demoPhaseDateMs);
      }
    }

    if (
      astronomyState.selectedDate instanceof Date &&
      !Number.isNaN(astronomyState.selectedDate.getTime())
    ) {
      return new Date(astronomyState.selectedDate.getTime());
    }

    return getObservationBaseDate();
  }
  
  
  
  function applyObservationPreviewDate(nextDate) {
  
    const safeDate = (
      nextDate instanceof Date && !Number.isNaN(nextDate.getTime())
    )
      ? nextDate
      : new Date();
  
    realityLiveEl.checked = false;
  
    resetDarkSunStageState();
    if (realitySyncEl.checked) {
      astronomyApi.enableRealityMode({ live: false, date: safeDate });
      return;
    }
    astronomyApi.setAcceleratedTimelineAnchor(safeDate, { live: false });
  
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
    const live = Boolean(realityLiveEl.checked);
    const anchorDate = live ? new Date() : getModeSwitchAnchorDate();

    if (!live) {
      astronomyApi.setObservationInputValue(anchorDate);
    }

    if (realitySyncEl.checked) {
      resetDarkSunStageState();
      astronomyApi.enableRealityMode({
        live,
        date: anchorDate
      });
      return;
    }

    resetDarkSunStageState();
    astronomyApi.disableRealityMode({
      date: anchorDate,
      live
    });
  
  });
  
  
  
  realityLiveEl.addEventListener("change", () => {
  
    if (realityLiveEl.checked) {
      resetDarkSunStageState();
      if (realitySyncEl.checked) {
        astronomyApi.enableRealityMode({ live: true, date: new Date() });
      } else {
        astronomyApi.setAcceleratedTimelineAnchor(new Date(), { live: true });
      }
  
      return;
  
    }
  
    astronomyApi.setObservationInputValue(getModeSwitchAnchorDate());
    astronomyApi.applyObservationTimeSelection();
  
  });
  
  
  
  observationTimeEl.addEventListener("change", () => {
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
    realityLiveEl.checked = false;
  
    astronomyApi.applyObservationTimeSelection();
  
  });
  
  
  
  setCurrentTimeButton.addEventListener("click", () => {
    realityLiveEl.checked = true;
  
    resetDarkSunStageState();
    if (realitySyncEl.checked) {
      astronomyApi.enableRealityMode({ live: true, date: new Date() });
      return;
    }
    astronomyApi.setAcceleratedTimelineAnchor(new Date(), { live: true });
  
  });

  if (eclipseCatalogSourceEl) {
    eclipseCatalogSourceEl.addEventListener("change", () => {
      astronomyApi.setEclipseCatalogSource(eclipseCatalogSourceEl.value);
    });
  }

  if (eclipseCatalogUploadEl) {
    eclipseCatalogUploadEl.addEventListener("change", async (event) => {
      const file = event.target.files?.[0] ?? null;
      await astronomyApi.loadEclipseCsv(file);
      event.target.value = "";
    });
  }

  if (eclipseKindSelectEl) {
    eclipseKindSelectEl.addEventListener("change", () => {
      astronomyApi.setSelectedEclipseKind(eclipseKindSelectEl.value);
    });
  }

  if (eclipseYearSelectEl) {
    eclipseYearSelectEl.addEventListener("change", () => {
      astronomyApi.setSelectedEclipseYear(eclipseYearSelectEl.value);
    });
  }

  if (eclipseEventSelectEl) {
    eclipseEventSelectEl.addEventListener("change", () => {
      astronomyApi.setSelectedEclipseEvent(eclipseEventSelectEl.value);
    });
  }

  if (eclipseTimePointSelectEl) {
    eclipseTimePointSelectEl.addEventListener("change", () => {
      astronomyApi.setSelectedEclipseTimePoint(eclipseTimePointSelectEl.value);
    });
  }

  if (previewSelectedEclipseButton) {
    previewSelectedEclipseButton.addEventListener("click", () => {
      astronomyApi.previewSelectedEclipse();
    });
  }
  
  
  
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

    const demoDate = new Date(
      Number.isFinite(simulationState.simulatedDateMs)
        ? simulationState.simulatedDateMs
        : astronomyState.selectedDate.getTime()
    );
    const demoSnapshot = astronomyApi.getAstronomySnapshot(demoDate);
    astronomyApi.updateDayNightOverlayFromSun(
      demoSnapshot.sun.latitudeDegrees,
      demoSnapshot.sun.longitudeDegrees,
      true
    );

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

  return {
    applyCameraPreset,
    applyDragDelta,
    applyZoomDelta
  };
}

