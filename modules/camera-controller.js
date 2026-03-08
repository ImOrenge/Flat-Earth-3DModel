import * as THREE from "../vendor/three.module.js";

export function createCameraController({
  camera,
  cameraState,
  walkerState,
  renderer,
  constants
}) {
  const tempCameraLookTarget = new THREE.Vector3();

  function clampCamera() {
    cameraState.targetPhi = Math.min(Math.max(cameraState.targetPhi, 0.3), 1.48);
    cameraState.targetRadius = Math.min(Math.max(cameraState.targetRadius, 7.2), 16);
  }

  function updateCamera() {
    const targetFov = walkerState.enabled ? constants.CAMERA_WALKER_FOV : constants.CAMERA_DEFAULT_FOV;
    if (Math.abs(camera.fov - targetFov) > 0.05) {
      camera.fov += (targetFov - camera.fov) * 0.12;
      camera.updateProjectionMatrix();
    }

    if (walkerState.enabled) {
      camera.position.set(
        walkerState.position.x,
        constants.WALKER_EYE_HEIGHT,
        walkerState.position.z
      );

      const horizontalDistance = Math.cos(walkerState.pitch) * constants.WALKER_LOOK_DISTANCE;
      tempCameraLookTarget.set(
        walkerState.position.x + (Math.sin(walkerState.heading) * horizontalDistance),
        constants.WALKER_EYE_HEIGHT + (Math.sin(walkerState.pitch) * constants.WALKER_LOOK_DISTANCE),
        walkerState.position.z + (Math.cos(walkerState.heading) * horizontalDistance)
      );
      camera.lookAt(tempCameraLookTarget);
      return;
    }

    cameraState.theta += (cameraState.targetTheta - cameraState.theta) * 0.08;
    cameraState.phi += (cameraState.targetPhi - cameraState.phi) * 0.08;
    cameraState.radius += (cameraState.targetRadius - cameraState.radius) * 0.08;

    const sinPhi = Math.sin(cameraState.phi);
    camera.position.set(
      cameraState.radius * sinPhi * Math.sin(cameraState.theta),
      cameraState.radius * Math.cos(cameraState.phi),
      cameraState.radius * sinPhi * Math.cos(cameraState.theta)
    );
    camera.lookAt(0, 0.15, 0);
  }

  function resize() {
    const width = window.innerWidth;
    const height = window.innerWidth <= 820 ? Math.round(window.innerHeight * 0.66) : window.innerHeight;
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
