import * as THREE from "../vendor/three.module.js";

export function createCelestialTrackingCameraController({
  cameraState,
  constants,
  i18n,
  buttons = [],
  summaryEl,
  trackables
}) {
  const defaultLookTarget = new THREE.Vector3(0, constants.SURFACE_Y * (5 / 6), 0);
  const tempWorldPosition = new THREE.Vector3();
  const targets = {
    off: {
      summaryKey: "trackCameraSummaryOff"
    },
    sun: {
      object: trackables.sun,
      summaryKey: "trackCameraSummarySun"
    },
    moon: {
      object: trackables.moon,
      summaryKey: "trackCameraSummaryMoon"
    }
  };
  const state = {
    customLookTarget: null,
    customLookTargetResolver: null,
    customTrackingLookTarget: null,
    customTrackingResolver: null,
    customTrackingSummaryKey: null,
    customTrackingSummaryText: "",
    mode: "free",
    targetKey: "off"
  };

  cameraState.mode = cameraState.mode ?? "free";
  cameraState.lookTarget = cameraState.lookTarget ?? defaultLookTarget.clone();
  cameraState.targetLookTarget = cameraState.targetLookTarget ?? defaultLookTarget.clone();

  function resolveTargetKey(key) {
    return Object.prototype.hasOwnProperty.call(targets, key) ? key : "off";
  }

  function syncMode(hasTrackableTarget) {
    state.mode = hasTrackableTarget ? "tracking" : "free";
    cameraState.mode = state.mode;
  }

  function resolveTrackedCustomTarget() {
    if (state.customTrackingResolver) {
      return state.customTrackingResolver();
    }
    return state.customTrackingLookTarget;
  }

  function resolveFreeCustomTarget() {
    if (state.customLookTargetResolver) {
      return state.customLookTargetResolver();
    }
    return state.customLookTarget;
  }

  function setTempPositionFromValue(value, fallbackValue = defaultLookTarget) {
    const source = value ?? fallbackValue;
    tempWorldPosition.set(
      source?.x ?? 0,
      source?.y ?? 0,
      source?.z ?? 0
    );
  }

  function updateLookTarget({ immediate = false } = {}) {
    const config = targets[state.targetKey];
    const hasNamedTrackableTarget = state.targetKey !== "off" && Boolean(config?.object);
    const trackedCustomTarget = hasNamedTrackableTarget ? null : resolveTrackedCustomTarget();
    const hasTrackableTarget = hasNamedTrackableTarget || Boolean(trackedCustomTarget);

    if (hasNamedTrackableTarget) {
      config.object.getWorldPosition(tempWorldPosition);
    } else if (trackedCustomTarget) {
      setTempPositionFromValue(trackedCustomTarget);
    } else {
      const freeCustomTarget = resolveFreeCustomTarget();
      if (freeCustomTarget) {
        setTempPositionFromValue(freeCustomTarget);
      } else {
        tempWorldPosition.copy(defaultLookTarget);
      }
    }

    syncMode(hasTrackableTarget);
    cameraState.targetLookTarget.copy(tempWorldPosition);

    if (immediate) {
      cameraState.lookTarget.copy(tempWorldPosition);
    }
  }

  function getSummaryText() {
    if (state.customTrackingSummaryText) {
      return state.customTrackingSummaryText;
    }
    if (state.customTrackingSummaryKey) {
      return i18n.t(state.customTrackingSummaryKey);
    }
    return i18n.t(targets[state.targetKey].summaryKey);
  }

  function syncUi() {
    for (const button of buttons) {
      button.classList.toggle("active", button.dataset.cameraTrack === state.targetKey);
    }

    if (summaryEl) {
      summaryEl.textContent = getSummaryText();
    }
  }

  function clearCustomTrackingState() {
    state.customTrackingLookTarget = null;
    state.customTrackingResolver = null;
    state.customTrackingSummaryKey = null;
    state.customTrackingSummaryText = "";
  }

  function clearFreeCustomTargetState() {
    state.customLookTarget = null;
    state.customLookTargetResolver = null;
  }

  function setTarget(nextTargetKey, options = {}) {
    state.targetKey = resolveTargetKey(nextTargetKey);
    if (state.targetKey !== "off") {
      clearFreeCustomTargetState();
      clearCustomTrackingState();
    }
    updateLookTarget(options);
    syncUi();
  }

  function clearTracking(options = {}) {
    clearFreeCustomTargetState();
    clearCustomTrackingState();
    setTarget("off", options);
  }

  function clearCustomTracking(options = {}) {
    clearCustomTrackingState();
    if (state.targetKey !== "off") {
      updateLookTarget(options);
      syncUi();
      return;
    }
    updateLookTarget(options);
    syncUi();
  }

  function setCustomLookTarget(nextTarget, options = {}) {
    if (!nextTarget) {
      clearTracking(options);
      return;
    }

    if (!state.customLookTarget) {
      state.customLookTarget = new THREE.Vector3();
    }

    state.customLookTargetResolver = null;
    state.customLookTarget.set(nextTarget.x ?? 0, nextTarget.y ?? 0, nextTarget.z ?? 0);
    clearCustomTrackingState();
    state.targetKey = "off";
    updateLookTarget(options);
    syncUi();
  }

  function setCustomLookTargetResolver(resolver, options = {}) {
    if (typeof resolver !== "function") {
      clearTracking(options);
      return;
    }

    state.customLookTargetResolver = resolver;
    clearCustomTrackingState();
    state.targetKey = "off";
    updateLookTarget(options);
    syncUi();
  }

  function setTrackedCustomTarget(nextTarget, summaryKeyOrText = null, options = {}) {
    if (!nextTarget) {
      clearCustomTracking(options);
      return;
    }

    if (!state.customTrackingLookTarget) {
      state.customTrackingLookTarget = new THREE.Vector3();
    }

    state.customTrackingLookTarget.set(nextTarget.x ?? 0, nextTarget.y ?? 0, nextTarget.z ?? 0);
    state.customTrackingResolver = null;
    state.customTrackingSummaryKey = null;
    state.customTrackingSummaryText = "";
    if (summaryKeyOrText) {
      if (typeof summaryKeyOrText === "string" && Object.prototype.hasOwnProperty.call(targets, summaryKeyOrText)) {
        state.customTrackingSummaryKey = summaryKeyOrText;
      } else if (typeof summaryKeyOrText === "string" && summaryKeyOrText.startsWith("track")) {
        state.customTrackingSummaryKey = summaryKeyOrText;
      } else if (typeof summaryKeyOrText === "string") {
        state.customTrackingSummaryText = summaryKeyOrText;
      }
    }
    clearFreeCustomTargetState();
    state.targetKey = "off";
    updateLookTarget(options);
    syncUi();
  }

  function setTrackedCustomTargetResolver(resolver, summaryKeyOrText = null, options = {}) {
    if (typeof resolver !== "function") {
      clearCustomTracking(options);
      return;
    }

    state.customTrackingResolver = resolver;
    state.customTrackingSummaryKey = null;
    state.customTrackingSummaryText = "";
    if (typeof summaryKeyOrText === "string") {
      if (summaryKeyOrText.startsWith("track") || summaryKeyOrText.startsWith("rocket")) {
        state.customTrackingSummaryKey = summaryKeyOrText;
      } else {
        state.customTrackingSummaryText = summaryKeyOrText;
      }
    }
    clearFreeCustomTargetState();
    state.targetKey = "off";
    updateLookTarget(options);
    syncUi();
  }

  function refreshLocalizedUi() {
    syncUi();
  }

  function update() {
    updateLookTarget();
    syncUi();
  }

  updateLookTarget({ immediate: true });
  syncUi();

  return {
    clearCustomTracking,
    clearTracking,
    getMode() {
      return state.mode;
    },
    getTargetKey() {
      return state.targetKey;
    },
    isTrackingActive() {
      return state.mode === "tracking";
    },
    refreshLocalizedUi,
    setCustomLookTarget,
    setCustomLookTargetResolver,
    setTarget,
    setTrackedCustomTarget,
    setTrackedCustomTargetResolver,
    update
  };
}
