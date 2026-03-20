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
    mode: "free",
    targetKey: "off",
    customLookTarget: null,
    customLookTargetResolver: null
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

  function updateLookTarget({ immediate = false } = {}) {
    const config = targets[state.targetKey];
    const hasTrackableTarget = state.targetKey !== "off" && Boolean(config?.object);

    if (!hasTrackableTarget) {
      if (state.customLookTargetResolver) {
        const resolvedTarget = state.customLookTargetResolver();
        if (resolvedTarget) {
          tempWorldPosition.set(
            resolvedTarget.x ?? 0,
            resolvedTarget.y ?? 0,
            resolvedTarget.z ?? 0
          );
        } else if (state.customLookTarget) {
          tempWorldPosition.copy(state.customLookTarget);
        } else {
          tempWorldPosition.copy(defaultLookTarget);
        }
      } else if (state.customLookTarget) {
        tempWorldPosition.copy(state.customLookTarget);
      } else {
        tempWorldPosition.copy(defaultLookTarget);
      }
    } else {
      config.object.getWorldPosition(tempWorldPosition);
    }

    syncMode(hasTrackableTarget);
    cameraState.targetLookTarget.copy(tempWorldPosition);

    if (immediate) {
      cameraState.lookTarget.copy(tempWorldPosition);
    }
  }

  function syncUi() {
    for (const button of buttons) {
      button.classList.toggle("active", button.dataset.cameraTrack === state.targetKey);
    }

    if (summaryEl) {
      summaryEl.textContent = i18n.t(targets[state.targetKey].summaryKey);
    }
  }

  function setTarget(nextTargetKey, options = {}) {
    state.targetKey = resolveTargetKey(nextTargetKey);
    if (state.targetKey !== "off") {
      state.customLookTarget = null;
      state.customLookTargetResolver = null;
    }
    updateLookTarget(options);
    syncUi();
  }

  function clearTracking(options = {}) {
    state.customLookTarget = null;
    state.customLookTargetResolver = null;
    setTarget("off", options);
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
    state.targetKey = "off";
    updateLookTarget(options);
    syncUi();
  }

  function refreshLocalizedUi() {
    syncUi();
  }

  function update() {
    updateLookTarget();
  }

  updateLookTarget({ immediate: true });
  syncUi();

  return {
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
    update
  };
}
