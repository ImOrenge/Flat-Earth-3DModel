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
    targetKey: "off"
  };

  cameraState.lookTarget = cameraState.lookTarget ?? defaultLookTarget.clone();
  cameraState.targetLookTarget = cameraState.targetLookTarget ?? defaultLookTarget.clone();

  function resolveTargetKey(key) {
    return Object.prototype.hasOwnProperty.call(targets, key) ? key : "off";
  }

  function updateLookTarget({ immediate = false } = {}) {
    const config = targets[state.targetKey];

    if (state.targetKey === "off" || !config?.object) {
      tempWorldPosition.copy(defaultLookTarget);
    } else {
      config.object.getWorldPosition(tempWorldPosition);
    }

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
    updateLookTarget(options);
    syncUi();
  }

  function clearTracking(options = {}) {
    setTarget("off", options);
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
    getTargetKey() {
      return state.targetKey;
    },
    isTrackingActive() {
      return state.targetKey !== "off";
    },
    refreshLocalizedUi,
    setTarget,
    update
  };
}
