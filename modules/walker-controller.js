import * as THREE from "../vendor/three.module.js";
import {
  getDisplayLocalSolarAltitudeDegreesFromModel,
  getLocalLightSummaryFromAltitude,
} from "./astronomy-utils.js?v=20260324-moon-cycle28";
import {
  formatGeoPair,
  getGeoFromProjectedPosition,
  projectedRadiusFromLatitude,
  toRadians
} from "./geo-utils.js";

export function createWalkerController({
  constants,
  i18n,
  walkerState,
  renderState,
  movementState,
  ui,
  walker,
  walkerGuideGroup,
  walkerGuideLeft,
  walkerGuideRight,
  walkerGuideCenter,
  ambient,
  keyLight,
  rimLight
}) {
  const tempWalkerDirection = new THREE.Vector3();
  const tempWalkerRight = new THREE.Vector3();
  const tempWalkerPosition = new THREE.Vector3();
  const tempGuideStart = new THREE.Vector3();
  const tempGuideEnd = new THREE.Vector3();
  const tempGuideOffset = new THREE.Vector3();

  function getSurfacePositionFromGeo(latitudeDegrees, longitudeDegrees, y = constants.WALKER_SURFACE_OFFSET) {
    const projectedRadius = THREE.MathUtils.clamp(
      projectedRadiusFromLatitude(latitudeDegrees, constants.DISC_RADIUS),
      0,
      constants.DISC_RADIUS - 0.02
    );
    const longitude = toRadians(longitudeDegrees);
    return new THREE.Vector3(
      -Math.cos(longitude) * projectedRadius,
      y,
      Math.sin(longitude) * projectedRadius
    );
  }

  function resetWalkerPosition() {
    walkerState.position.copy(getSurfacePositionFromGeo(constants.WALKER_START_LATITUDE, constants.WALKER_START_LONGITUDE));
    walkerState.velocity.set(0, 0, 0);
  }

  function clampSurfacePoint(point, maxRadius = constants.DISC_RADIUS - 0.08) {
    const projectedRadius = Math.hypot(point.x, point.z);
    if (projectedRadius > maxRadius) {
      point.multiplyScalar(maxRadius / projectedRadius);
    }
    point.y = constants.WALKER_GUIDE_Y;
    return point;
  }

  function setWalkerGuideLine(line, lateralOffset) {
    tempGuideOffset.copy(tempWalkerRight).multiplyScalar(lateralOffset);
    tempGuideStart.copy(walkerState.position)
      .addScaledVector(tempWalkerDirection, constants.WALKER_GUIDE_START)
      .add(tempGuideOffset);
    tempGuideEnd.copy(walkerState.position)
      .addScaledVector(tempWalkerDirection, constants.WALKER_GUIDE_LENGTH)
      .add(tempGuideOffset);

    clampSurfacePoint(tempGuideStart);
    clampSurfacePoint(tempGuideEnd);
    line.geometry.setFromPoints([tempGuideStart, tempGuideEnd]);
  }

  function updateWalkerPerspectiveGuides() {
    if (!walkerState.enabled) {
      walkerGuideGroup.visible = false;
      return;
    }

    tempWalkerDirection.set(Math.sin(walkerState.heading), 0, Math.cos(walkerState.heading));
    tempWalkerRight.set(tempWalkerDirection.z, 0, -tempWalkerDirection.x);
    setWalkerGuideLine(walkerGuideLeft, -constants.WALKER_GUIDE_HALF_WIDTH);
    setWalkerGuideLine(walkerGuideRight, constants.WALKER_GUIDE_HALF_WIDTH);

    const markPairs = [];
    for (
      let distance = constants.WALKER_GUIDE_START + 0.24;
      distance < constants.WALKER_GUIDE_LENGTH;
      distance += constants.WALKER_GUIDE_MARK_GAP
    ) {
      const markStart = walkerState.position.clone().addScaledVector(tempWalkerDirection, distance);
      const markEnd = walkerState.position.clone().addScaledVector(
        tempWalkerDirection,
        Math.min(distance + constants.WALKER_GUIDE_MARK_SIZE, constants.WALKER_GUIDE_LENGTH)
      );
      clampSurfacePoint(markStart);
      clampSurfacePoint(markEnd);
      markPairs.push(markStart, markEnd);
    }

    walkerGuideCenter.geometry.setFromPoints(markPairs);
    walkerGuideGroup.visible = true;
  }

  function updateFirstPersonOverlay() {
    const horizonOffset = Math.round(walkerState.pitch * constants.WALKER_HORIZON_SHIFT_PX);
    ui.firstPersonOverlayEl.classList.toggle("active", walkerState.enabled);
    ui.firstPersonOverlayEl.style.setProperty("--horizon-offset", `${horizonOffset}px`);
    ui.firstPersonHorizonEl.style.opacity = walkerState.enabled ? "1" : "0";
  }

  function syncWalkerUi() {
    ui.walkerModeEl.checked = walkerState.enabled || renderState.preparing;
    ui.walkerModeEl.disabled = renderState.preparing;
    ui.walkerSummaryEl.textContent = renderState.preparing
      ? i18n.t("walkerSummaryPreparing")
      : walkerState.enabled
        ? i18n.t("walkerSummaryActive")
        : i18n.t("walkerSummaryInactive");
    updateFirstPersonOverlay();
  }

  function updateWalkerAvatar() {
    walker.position.set(
      walkerState.position.x * renderState.visualScale,
      walkerState.position.y,
      walkerState.position.z * renderState.visualScale
    );
    walker.rotation.y = walkerState.heading;
    walker.visible = !walkerState.enabled;
  }

  function updateWalkerUi(snapshot) {
    const observerGeo = getGeoFromProjectedPosition(walkerState.position, constants.DISC_RADIUS);
    const sunRenderPosition = snapshot.sunRenderPosition ?? snapshot.sunPosition;
    const solarAltitudeDegrees = getDisplayLocalSolarAltitudeDegreesFromModel(
      walkerState.position.x,
      walkerState.position.z,
      sunRenderPosition.x,
      sunRenderPosition.z,
      Math.max(sunRenderPosition.y - constants.WALKER_EYE_HEIGHT, 0.0001)
    );
    const coordinatesLabel = formatGeoPair(observerGeo.latitudeDegrees, observerGeo.longitudeDegrees);
    const lightSummary = getLocalLightSummaryFromAltitude(solarAltitudeDegrees);
    const lightLabel = lightSummary === "Day"
      ? i18n.t("lightDay")
      : lightSummary === "Low Sun"
        ? i18n.t("lightLowSun")
        : lightSummary === "Twilight"
          ? i18n.t("lightTwilight")
          : i18n.t("lightNight");

    if (walkerState.lastCoordinatesLabel !== coordinatesLabel) {
      ui.walkerCoordinatesEl.textContent = coordinatesLabel;
      walkerState.lastCoordinatesLabel = coordinatesLabel;
    }

    if (walkerState.lastLightLabel !== lightLabel) {
      ui.walkerLightEl.textContent = lightLabel;
      walkerState.lastLightLabel = lightLabel;
    }

    const ambientIntensity = walkerState.enabled
      ? THREE.MathUtils.lerp(0.22, 1.1, THREE.MathUtils.clamp(
        THREE.MathUtils.inverseLerp(-10, 30, solarAltitudeDegrees),
        0,
        1
      ))
      : 0.9;
    const keyIntensity = walkerState.enabled
      ? THREE.MathUtils.lerp(0.3, 1.55, THREE.MathUtils.clamp(
        THREE.MathUtils.inverseLerp(-8, 30, solarAltitudeDegrees),
        0,
        1
      ))
      : 1.35;
    const rimIntensity = walkerState.enabled
      ? THREE.MathUtils.lerp(0.12, 0.48, THREE.MathUtils.clamp(
        THREE.MathUtils.inverseLerp(-6, 24, solarAltitudeDegrees),
        0,
        1
      ))
      : 0.42;

    ambient.intensity += (ambientIntensity - ambient.intensity) * 0.08;
    keyLight.intensity += (keyIntensity - keyLight.intensity) * 0.08;
    rimLight.intensity += (rimIntensity - rimLight.intensity) * 0.08;
  }

  function updateWalkerMovement(deltaSeconds) {
    if (!walkerState.enabled) {
      walkerState.velocity.set(0, 0, 0);
      return;
    }

    const forwardInput = Number(movementState.forward) - Number(movementState.backward);
    const strafeInput = Number(movementState.right) - Number(movementState.left);

    if (forwardInput === 0 && strafeInput === 0) {
      walkerState.velocity.set(0, 0, 0);
      return;
    }

    tempWalkerDirection.set(Math.sin(walkerState.heading), 0, Math.cos(walkerState.heading));
    tempWalkerRight.set(tempWalkerDirection.z, 0, -tempWalkerDirection.x);

    walkerState.velocity
      .copy(tempWalkerDirection)
      .multiplyScalar(forwardInput)
      .addScaledVector(tempWalkerRight, strafeInput);

    if (walkerState.velocity.lengthSq() === 0) {
      return;
    }

    walkerState.velocity.normalize().multiplyScalar(constants.WALKER_SPEED * deltaSeconds);
    tempWalkerPosition.copy(walkerState.position).add(walkerState.velocity);

    const projectedRadius = Math.hypot(tempWalkerPosition.x, tempWalkerPosition.z);
    const maxRadius = constants.DISC_RADIUS - 0.18;
    if (projectedRadius > maxRadius) {
      tempWalkerPosition.multiplyScalar(maxRadius / projectedRadius);
    }

    tempWalkerPosition.y = constants.WALKER_SURFACE_OFFSET;
    walkerState.position.copy(tempWalkerPosition);
  }

  function refreshLocalizedUi(snapshot) {
    walkerState.lastLightLabel = "";
    syncWalkerUi();
    if (snapshot) {
      updateWalkerUi(snapshot);
    }
  }

  return {
    refreshLocalizedUi,
    resetWalkerPosition,
    syncWalkerUi,
    updateFirstPersonOverlay,
    updateWalkerAvatar,
    updateWalkerMovement,
    updateWalkerPerspectiveGuides,
    updateWalkerUi
  };
}
