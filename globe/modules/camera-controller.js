import * as THREE from "../../vendor/three.module.js";
import { getGlobeBasisFromGeo, getGeoFromGlobePosition } from "./geo-utils.js";

export function createCameraController({
  camera,
  cameraState,
  walkerState,
  renderState,
  renderer,
  constants,
  defaultLookTarget = null,
  trackingCenter = null
}) {
  const modelScale = constants.MODEL_SCALE ?? 1;
  const tempCameraLookTarget = new THREE.Vector3();
  const resolvedDefaultLookTarget = defaultLookTarget?.clone?.()
    ?? new THREE.Vector3(0, constants.SURFACE_Y * (5 / 6), 0);
  const trackingDiscCenter = trackingCenter?.clone?.()
    ?? new THREE.Vector3(0, constants.SURFACE_Y, 0);
  const tempTrackingRadial = new THREE.Vector3();
  const tempTrackingTangent = new THREE.Vector3();
  const tempTrackingOffset = new THREE.Vector3();
  const tempWalkerNorth = new THREE.Vector3();
  const tempWalkerEast = new THREE.Vector3();
  const tempWalkerUp = new THREE.Vector3();

  function getWalkerGeo() {
    if (Number.isFinite(walkerState.latitudeDegrees) && Number.isFinite(walkerState.longitudeDegrees)) {
      return {
        latitudeDegrees: walkerState.latitudeDegrees,
        longitudeDegrees: walkerState.longitudeDegrees
      };
    }

    return getGeoFromGlobePosition(
      walkerState.position,
      new THREE.Vector3(),
      Math.max(walkerState.surfaceRadius ?? 1, 0.0001)
    );
  }

  function getWalkerBasis() {
    const basis = getGlobeBasisFromGeo(
      getWalkerGeo().latitudeDegrees,
      getWalkerGeo().longitudeDegrees
    );
    tempWalkerNorth.set(basis.north.x, basis.north.y, basis.north.z).normalize();
    tempWalkerEast.set(basis.east.x, basis.east.y, basis.east.z).normalize();
    tempWalkerUp.set(basis.up.x, basis.up.y, basis.up.z).normalize();
  }

  cameraState.mode = cameraState.mode ?? "free";
  cameraState.lookTarget = cameraState.lookTarget ?? resolvedDefaultLookTarget.clone();
  cameraState.targetLookTarget = cameraState.targetLookTarget ?? resolvedDefaultLookTarget.clone();
  cameraState.trackingAzimuth = cameraState.trackingAzimuth ?? constants.CAMERA_TRACKING_DEFAULT_AZIMUTH;
  cameraState.trackingElevation = cameraState.trackingElevation ?? constants.CAMERA_TRACKING_DEFAULT_ELEVATION;
  cameraState.trackingDistance = cameraState.trackingDistance ?? constants.CAMERA_TRACKING_DEFAULT_DISTANCE;
  cameraState.targetTrackingAzimuth = cameraState.targetTrackingAzimuth ?? constants.CAMERA_TRACKING_DEFAULT_AZIMUTH;
  cameraState.targetTrackingElevation = cameraState.targetTrackingElevation ?? constants.CAMERA_TRACKING_DEFAULT_ELEVATION;
  cameraState.targetTrackingDistance = cameraState.targetTrackingDistance ?? constants.CAMERA_TRACKING_DEFAULT_DISTANCE;

  function getResponsivePixelRatio() {
    const maxRatio = window.innerWidth <= 1080 ? 1.5 : 2;
    return Math.min(window.devicePixelRatio || 1, maxRatio);
  }

  function clampCamera() {
    const isGlobeView = cameraState.earthModelView === "spherical";
    const minPhi = isGlobeView
      ? (constants.CAMERA_GLOBE_FREE_MIN_PHI ?? constants.CAMERA_FREE_MIN_PHI)
      : constants.CAMERA_FREE_MIN_PHI;
    const maxPhi = isGlobeView
      ? (constants.CAMERA_GLOBE_FREE_MAX_PHI ?? constants.CAMERA_FREE_MAX_PHI)
      : constants.CAMERA_FREE_MAX_PHI;
    const minRadius = isGlobeView
      ? (constants.CAMERA_GLOBE_MIN_RADIUS ?? constants.CAMERA_TOPDOWN_MIN_RADIUS)
      : constants.CAMERA_TOPDOWN_MIN_RADIUS;
    const maxRadius = isGlobeView
      ? (constants.CAMERA_GLOBE_MAX_RADIUS ?? constants.CAMERA_TOPDOWN_MAX_RADIUS)
      : constants.CAMERA_TOPDOWN_MAX_RADIUS;
    cameraState.targetPhi = Math.min(
      Math.max(cameraState.targetPhi, minPhi),
      maxPhi
    );
    cameraState.targetRadius = Math.min(
      Math.max(cameraState.targetRadius, minRadius),
      maxRadius
    );
    cameraState.targetTrackingElevation = Math.min(
      Math.max(cameraState.targetTrackingElevation, constants.CAMERA_TRACKING_MIN_ELEVATION),
      constants.CAMERA_TRACKING_MAX_ELEVATION
    );
    cameraState.targetTrackingDistance = Math.min(
      Math.max(cameraState.targetTrackingDistance, constants.CAMERA_TRACKING_MIN_DISTANCE),
      constants.CAMERA_TRACKING_MAX_DISTANCE
    );
  }

  function updateTrackingCamera() {
    cameraState.trackingAzimuth += (cameraState.targetTrackingAzimuth - cameraState.trackingAzimuth) * 0.08;
    cameraState.trackingElevation += (cameraState.targetTrackingElevation - cameraState.trackingElevation) * 0.08;
    cameraState.trackingDistance += (cameraState.targetTrackingDistance - cameraState.trackingDistance) * 0.08;
    cameraState.lookTarget.lerp(cameraState.targetLookTarget, 0.16);

    tempTrackingRadial.copy(cameraState.lookTarget).sub(trackingDiscCenter);
    tempTrackingRadial.y = 0;
    if (tempTrackingRadial.lengthSq() < 0.0001) {
      tempTrackingRadial.set(0, 0, 1);
    } else {
      tempTrackingRadial.normalize();
    }

    tempTrackingTangent.set(-tempTrackingRadial.z, 0, tempTrackingRadial.x);

    const horizontalDistance = Math.max(
      cameraState.trackingDistance * Math.cos(cameraState.trackingElevation),
      0.01
    );
    const verticalDistance = cameraState.trackingDistance * Math.sin(cameraState.trackingElevation);

    tempTrackingOffset.copy(tempTrackingRadial).multiplyScalar(
      Math.cos(cameraState.trackingAzimuth) * horizontalDistance
    );
    tempTrackingOffset.addScaledVector(
      tempTrackingTangent,
      Math.sin(cameraState.trackingAzimuth) * horizontalDistance
    );
    tempTrackingOffset.y += verticalDistance;

    camera.position.copy(cameraState.lookTarget).add(tempTrackingOffset);
    camera.lookAt(cameraState.lookTarget);
  }

  function updateCamera() {
    const targetFov = walkerState.enabled ? constants.CAMERA_WALKER_FOV : constants.CAMERA_DEFAULT_FOV;
    const targetNear = walkerState.enabled ? 0.05 : 0.1;
    const targetFar = (walkerState.enabled ? 140 : 100) * modelScale;

    if (Math.abs(camera.fov - targetFov) > 0.05) {
      camera.fov += (targetFov - camera.fov) * 0.12;
      camera.updateProjectionMatrix();
    }

    if (Math.abs(camera.near - targetNear) > 0.005 || Math.abs(camera.far - targetFar) > 0.5) {
      camera.near += (targetNear - camera.near) * 0.2;
      camera.far += (targetFar - camera.far) * 0.2;
      camera.updateProjectionMatrix();
    }

    if (walkerState.enabled) {
      const visualScale = renderState.visualScale;
      const eyeHeightOffset = Math.max(
        walkerState.eyeHeightOffset ?? Math.max(constants.WALKER_EYE_HEIGHT - constants.SURFACE_Y, 0.001),
        0.001
      );
      getWalkerBasis();
      camera.position
        .copy(walkerState.position)
        .addScaledVector(tempWalkerUp, eyeHeightOffset)
        .multiplyScalar(visualScale);

      const horizontalDistance = Math.cos(walkerState.pitch) * constants.WALKER_LOOK_DISTANCE;
      tempCameraLookTarget.copy(camera.position)
        .addScaledVector(tempWalkerNorth, Math.cos(walkerState.heading) * horizontalDistance)
        .addScaledVector(tempWalkerEast, Math.sin(walkerState.heading) * horizontalDistance)
        .addScaledVector(tempWalkerUp, Math.sin(walkerState.pitch) * constants.WALKER_LOOK_DISTANCE);
      camera.up.copy(tempWalkerUp);
      camera.lookAt(tempCameraLookTarget);
      return;
    }

    if (cameraState.mode === "tracking") {
      updateTrackingCamera();
      return;
    }

    cameraState.theta += (cameraState.targetTheta - cameraState.theta) * 0.08;
    cameraState.phi += (cameraState.targetPhi - cameraState.phi) * 0.08;
    cameraState.radius += (cameraState.targetRadius - cameraState.radius) * 0.08;
    cameraState.lookTarget.lerp(cameraState.targetLookTarget, 0.12);

    const sinPhi = Math.sin(cameraState.phi);
    camera.position.set(
      cameraState.lookTarget.x + (cameraState.radius * sinPhi * Math.sin(cameraState.theta)),
      cameraState.lookTarget.y + (cameraState.radius * Math.cos(cameraState.phi)),
      cameraState.lookTarget.z + (cameraState.radius * sinPhi * Math.cos(cameraState.theta))
    );
    camera.lookAt(cameraState.lookTarget);
  }

  function resize() {
    const canvas = renderer.domElement;
    const width = Math.max(Math.round(canvas?.clientWidth || window.innerWidth), 1);
    const height = Math.max(Math.round(canvas?.clientHeight || window.innerHeight), 1);
    renderer.setPixelRatio(getResponsivePixelRatio());
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  return {
    clampCamera,
    resize,
    updateCamera
  };
}

