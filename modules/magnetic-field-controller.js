import * as THREE from "../vendor/three.module.js";

const MAGNETIC_FIELD_LINE_COUNT = 24;
const MAGNETIC_FIELD_SEGMENTS = 64;
const MAGNETIC_FIELD_CYCLE_SECONDS = 2.4;

export function createMagneticFieldController({
  constants,
  i18n,
  ui,
  magneticFieldState,
  orbitSun,
  scalableStage,
  walkerState
}) {
  const scaleDimension = (value) => value * (constants.MODEL_SCALE ?? 1);
  const surfaceHeight = constants.SURFACE_Y + constants.ANALEMMA_SURFACE_OFFSET + scaleDimension(0.028);
  const endRadius = THREE.MathUtils.clamp(
    constants.DOME_RADIUS - scaleDimension(0.06),
    scaleDimension(2.4),
    constants.RIM_INNER_RADIUS
  );
  const domeClearance = scaleDimension(0.1);
  const risePortion = 0.18;
  const apexRadius = scaleDimension(0.12);

  const magneticFieldGroup = new THREE.Group();
  const lineMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPulseCycleSeconds: { value: MAGNETIC_FIELD_CYCLE_SECONDS },
      uInnerColor: { value: new THREE.Color(0xbef4ff) },
      uOuterColor: { value: new THREE.Color(0x2f7dff) }
    },
    vertexShader: `
      attribute float progress;
      attribute float phase;
      attribute float lineAngle;
      varying float vProgress;
      varying float vPhase;
      varying float vLineAngle;

      void main() {
        vProgress = progress;
        vPhase = phase;
        vLineAngle = lineAngle;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uPulseCycleSeconds;
      uniform vec3 uInnerColor;
      uniform vec3 uOuterColor;
      varying float vProgress;
      varying float vPhase;
      varying float vLineAngle;

      void main() {
        float pulseHead = fract((uTime / uPulseCycleSeconds) + vPhase);
        float pulseDistance = abs(vProgress - pulseHead);
        float pulse = 1.0 - smoothstep(0.0, 0.16, pulseDistance);
        float trail = 1.0 - smoothstep(0.04, 0.28, pulseDistance);
        float rotationFocus = smoothstep(0.18, 0.995, cos(vLineAngle));
        vec3 baseColor = mix(uOuterColor, uInnerColor, pow(1.0 - vProgress, 0.78));
        vec3 pulseColor = mix(uOuterColor, uInnerColor, max(pulse, rotationFocus));
        vec3 color = baseColor + (pulseColor * pulse * 0.85);
        float alpha = mix(0.08, 0.34, 1.0 - vProgress) + (trail * 0.16) + (pulse * 0.62);
        alpha *= mix(0.28, 1.12, rotationFocus);

        gl_FragColor = vec4(color, min(alpha, 1.0));
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false
  });

  function getArcPoint(radius, angleRadians, y) {
    return new THREE.Vector3(
      -Math.cos(angleRadians) * radius,
      y,
      Math.sin(angleRadians) * radius
    );
  }

  function getDomeSurfaceHeight(radius) {
    const clampedRadius = THREE.MathUtils.clamp(radius, 0, constants.DOME_RADIUS);
    const domeRise = Math.sqrt(Math.max(0, (constants.DOME_RADIUS ** 2) - (clampedRadius ** 2)));
    return constants.DOME_BASE_Y + (domeRise * constants.DOME_VERTICAL_SCALE);
  }

  function getDomeAlignedHeight(radius) {
    return Math.max(surfaceHeight, getDomeSurfaceHeight(radius) - domeClearance);
  }

  function easeOutCubic(value) {
    return 1 - ((1 - value) ** 3);
  }

  function easeInOutSine(value) {
    return -(Math.cos(Math.PI * value) - 1) / 2;
  }

  function buildFieldLinePoints(angleRadians) {
    const points = [];
    const apexHeight = getDomeAlignedHeight(apexRadius);

    for (let pointIndex = 0; pointIndex <= MAGNETIC_FIELD_SEGMENTS; pointIndex += 1) {
      const progress = pointIndex / MAGNETIC_FIELD_SEGMENTS;
      let radius;
      let y;

      if (progress <= risePortion) {
        const riseProgress = progress / risePortion;
        radius = THREE.MathUtils.lerp(0, apexRadius, easeInOutSine(riseProgress));
        y = THREE.MathUtils.lerp(surfaceHeight, apexHeight, easeInOutSine(riseProgress));
      } else {
        const radiateProgress = (progress - risePortion) / (1 - risePortion);
        radius = THREE.MathUtils.lerp(apexRadius, endRadius, easeOutCubic(radiateProgress));
        y = getDomeAlignedHeight(radius);
      }

      points.push(getArcPoint(radius, angleRadians, y));
    }

    return points;
  }

  function buildFieldLines() {
    for (let lineIndex = 0; lineIndex < MAGNETIC_FIELD_LINE_COUNT; lineIndex += 1) {
      const angleRadians = (lineIndex / MAGNETIC_FIELD_LINE_COUNT) * Math.PI * 2;
      const phaseValue = lineIndex / MAGNETIC_FIELD_LINE_COUNT;
      const points = buildFieldLinePoints(angleRadians);
      const progress = new Float32Array(points.length);
      const phase = new Float32Array(points.length);
      const lineAngle = new Float32Array(points.length);

      for (let pointIndex = 0; pointIndex < points.length; pointIndex += 1) {
        progress[pointIndex] = pointIndex / (points.length - 1);
        phase[pointIndex] = phaseValue;
        lineAngle[pointIndex] = angleRadians;
      }

      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      geometry.setAttribute("progress", new THREE.BufferAttribute(progress, 1));
      geometry.setAttribute("phase", new THREE.BufferAttribute(phase, 1));
      geometry.setAttribute("lineAngle", new THREE.BufferAttribute(lineAngle, 1));

      const line = new THREE.Line(geometry, lineMaterial);
      line.renderOrder = 18;
      magneticFieldGroup.add(line);
    }
  }

  function syncRotationFromSun() {
    magneticFieldGroup.rotation.y = Math.atan2(orbitSun.position.z, -orbitSun.position.x);
  }

  function syncVisibility() {
    magneticFieldGroup.visible = magneticFieldState.enabled && !walkerState.enabled;
  }

  function syncUi() {
    if (ui.magneticFieldOverlayEl) {
      ui.magneticFieldOverlayEl.checked = magneticFieldState.enabled;
    }
    if (ui.magneticFieldSummaryEl) {
      ui.magneticFieldSummaryEl.textContent = magneticFieldState.enabled
        ? i18n.t("magneticFieldSummaryActive")
        : i18n.t("magneticFieldSummaryHidden");
    }
    syncVisibility();
  }

  function refreshLocalizedUi() {
    syncUi();
  }

  function update(timeMs) {
    lineMaterial.uniforms.uTime.value = timeMs * 0.001;
    syncRotationFromSun();
    syncVisibility();
  }

  buildFieldLines();
  scalableStage.add(magneticFieldGroup);
  syncRotationFromSun();
  syncUi();

  return {
    refreshLocalizedUi,
    syncUi,
    update
  };
}
