import * as THREE from "../../vendor/three.module.js";
import {
  getLocalLightSummaryFromAltitude,
  getSunHorizontalCoordinates
} from "./astronomy-utils.js?v=20260324-moon-cycle28";
import {
  formatGeoPair,
  getGeoFromGlobePosition,
  getGlobeBasisFromGeo,
  getGlobePositionFromGeo
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
  const globeCenter = new THREE.Vector3();
  const tempWalkerDirection = new THREE.Vector3();
  const tempWalkerRight = new THREE.Vector3();
  const tempWalkerPosition = new THREE.Vector3();
  const tempGuideStart = new THREE.Vector3();
  const tempGuideEnd = new THREE.Vector3();
  const tempGuideOffset = new THREE.Vector3();
  const tempGuidePosition = new THREE.Vector3();
  const tempWalkerNorth = new THREE.Vector3();
  const tempWalkerEast = new THREE.Vector3();
  const tempWalkerUp = new THREE.Vector3();
  const tempWalkerEyePosition = new THREE.Vector3();
  const tempWalkerLookTarget = new THREE.Vector3();

  function getSurfaceRadius() {
    return Math.max(
      walkerState.surfaceRadius
        ?? ((constants.DISC_RADIUS * 0.82) + constants.WALKER_SURFACE_OFFSET),
      0.0001
    );
  }

  function getEyeHeightOffset() {
    return Math.max(
      walkerState.eyeHeightOffset
        ?? Math.max(constants.WALKER_EYE_HEIGHT - constants.SURFACE_Y, constants.WALKER_BODY_HEIGHT * 0.5),
      0.0001
    );
  }

  function getObserverGeo() {
    if (Number.isFinite(walkerState.latitudeDegrees) && Number.isFinite(walkerState.longitudeDegrees)) {
      return {
        latitudeDegrees: walkerState.latitudeDegrees,
        longitudeDegrees: walkerState.longitudeDegrees
      };
    }

    const observerGeo = getGeoFromGlobePosition(walkerState.position, globeCenter, getSurfaceRadius());
    walkerState.latitudeDegrees = observerGeo.latitudeDegrees;
    walkerState.longitudeDegrees = observerGeo.longitudeDegrees;
    return observerGeo;
  }

  function syncWalkerPositionFromGeo(latitudeDegrees, longitudeDegrees) {
    const position = getGlobePositionFromGeo(latitudeDegrees, longitudeDegrees, getSurfaceRadius(), globeCenter);
    walkerState.latitudeDegrees = latitudeDegrees;
    walkerState.longitudeDegrees = longitudeDegrees;
    walkerState.position.set(position.x, position.y, position.z);
    return walkerState.position;
  }

  function syncWalkerGeoFromPosition() {
    const observerGeo = getGeoFromGlobePosition(walkerState.position, globeCenter, getSurfaceRadius());
    walkerState.latitudeDegrees = observerGeo.latitudeDegrees;
    walkerState.longitudeDegrees = observerGeo.longitudeDegrees;
    return observerGeo;
  }

  function getWalkerBasis(observerGeo = getObserverGeo()) {
    const basis = getGlobeBasisFromGeo(observerGeo.latitudeDegrees, observerGeo.longitudeDegrees);
    tempWalkerNorth.set(basis.north.x, basis.north.y, basis.north.z).normalize();
    tempWalkerEast.set(basis.east.x, basis.east.y, basis.east.z).normalize();
    tempWalkerUp.set(basis.up.x, basis.up.y, basis.up.z).normalize();
    return observerGeo;
  }

  function getWalkerForward(observerGeo = getObserverGeo()) {
    getWalkerBasis(observerGeo);
    tempWalkerDirection
      .copy(tempWalkerNorth)
      .multiplyScalar(Math.cos(walkerState.heading))
      .addScaledVector(tempWalkerEast, Math.sin(walkerState.heading));

    if (tempWalkerDirection.lengthSq() > 0) {
      tempWalkerDirection.normalize();
    }
    return tempWalkerDirection;
  }

  function getWalkerLateral(observerGeo = getObserverGeo()) {
    getWalkerBasis(observerGeo);
    tempWalkerRight
      .copy(tempWalkerEast)
      .multiplyScalar(Math.cos(walkerState.heading))
      .addScaledVector(tempWalkerNorth, -Math.sin(walkerState.heading));

    if (tempWalkerRight.lengthSq() > 0) {
      tempWalkerRight.normalize();
    }
    return tempWalkerRight;
  }

  function getWalkerEyePosition(scale = 1, target = tempWalkerEyePosition, observerGeo = getObserverGeo()) {
    getWalkerBasis(observerGeo);
    target.copy(walkerState.position).addScaledVector(tempWalkerUp, getEyeHeightOffset());
    if (scale !== 1) {
      target.multiplyScalar(scale);
    }
    return target;
  }

  function resetWalkerPosition() {
    syncWalkerPositionFromGeo(constants.WALKER_START_LATITUDE, constants.WALKER_START_LONGITUDE);
    walkerState.velocity.set(0, 0, 0);
  }

  function getGuidePoint(target, alongDistance, lateralOffset, observerGeo = getObserverGeo()) {
    const surfaceRadius = getSurfaceRadius();
    const forward = getWalkerForward(observerGeo);
    const lateral = getWalkerLateral(observerGeo);

    tempGuidePosition.copy(walkerState.position).normalize().multiplyScalar(surfaceRadius);
    tempGuidePosition
      .addScaledVector(forward, alongDistance)
      .addScaledVector(lateral, lateralOffset)
      .normalize()
      .multiplyScalar(surfaceRadius);

    target.copy(tempGuidePosition).multiplyScalar(renderState.visualScale);
    return target;
  }

  function setWalkerGuideLine(line, lateralOffset) {
    const observerGeo = getObserverGeo();
    tempGuideOffset.set(lateralOffset, 0, 0);
    getGuidePoint(tempGuideStart, constants.WALKER_GUIDE_START, lateralOffset, observerGeo);
    getGuidePoint(tempGuideEnd, constants.WALKER_GUIDE_LENGTH, lateralOffset, observerGeo);
    line.geometry.setFromPoints([tempGuideStart, tempGuideEnd]);
  }

  function updateWalkerPerspectiveGuides() {
    if (!walkerState.enabled) {
      walkerGuideGroup.visible = false;
      return;
    }

    const observerGeo = getObserverGeo();
    setWalkerGuideLine(walkerGuideLeft, -constants.WALKER_GUIDE_HALF_WIDTH);
    setWalkerGuideLine(walkerGuideRight, constants.WALKER_GUIDE_HALF_WIDTH);

    const markPairs = [];
    for (
      let distance = constants.WALKER_GUIDE_START + 0.24;
      distance < constants.WALKER_GUIDE_LENGTH;
      distance += constants.WALKER_GUIDE_MARK_GAP
    ) {
      getGuidePoint(markPairs[markPairs.length] = new THREE.Vector3(), distance, 0, observerGeo);
      getGuidePoint(
        markPairs[markPairs.length] = new THREE.Vector3(),
        Math.min(distance + constants.WALKER_GUIDE_MARK_SIZE, constants.WALKER_GUIDE_LENGTH),
        0,
        observerGeo
      );
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
    const observerGeo = getObserverGeo();
    const displayScale = renderState.visualScale;
    const displayPosition = tempWalkerPosition.copy(walkerState.position).multiplyScalar(displayScale);
    const forward = getWalkerForward(observerGeo);

    walker.position.copy(displayPosition);
    walker.up.copy(tempWalkerUp);
    tempWalkerLookTarget
      .copy(walkerState.position)
      .addScaledVector(forward, Math.max(constants.WALKER_BODY_HEIGHT, 0.01))
      .multiplyScalar(displayScale);
    walker.lookAt(tempWalkerLookTarget);
    walker.visible = !walkerState.enabled;
  }

  function updateWalkerUi(snapshot) {
    const observerGeo = getObserverGeo();
    const sunHorizontal = getSunHorizontalCoordinates(
      snapshot.date,
      observerGeo.latitudeDegrees,
      observerGeo.longitudeDegrees
    );
    const solarAltitudeDegrees = sunHorizontal.altitudeDegrees;
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

    const observerGeo = getObserverGeo();
    const forward = getWalkerForward(observerGeo);
    const lateral = getWalkerLateral(observerGeo);

    walkerState.velocity
      .copy(forward)
      .multiplyScalar(forwardInput)
      .addScaledVector(lateral, strafeInput);

    if (walkerState.velocity.lengthSq() === 0) {
      return;
    }

    walkerState.velocity.normalize();
    const surfaceRadius = getSurfaceRadius();
    const surfaceDistance = constants.WALKER_SPEED * deltaSeconds;
    const surfaceAngle = Math.min(surfaceDistance / surfaceRadius, Math.PI * 0.25);

    tempWalkerPosition
      .copy(walkerState.position)
      .normalize()
      .multiplyScalar(Math.cos(surfaceAngle))
      .addScaledVector(walkerState.velocity, Math.sin(surfaceAngle))
      .normalize()
      .multiplyScalar(surfaceRadius);

    walkerState.position.copy(tempWalkerPosition);
    walkerState.velocity.multiplyScalar(surfaceDistance);
    syncWalkerGeoFromPosition();
  }

  function refreshLocalizedUi(snapshot) {
    walkerState.lastLightLabel = "";
    syncWalkerUi();
    if (snapshot) {
      updateWalkerUi(snapshot);
    }
  }

  return {
    getObserverGeo,
    getWalkerEyePosition,
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
