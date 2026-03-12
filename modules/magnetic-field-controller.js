import * as THREE from "../vendor/three.module.js";

const MAGNETIC_FIELD_LINE_COUNT = 24;
const MAGNETIC_FIELD_SEGMENTS = 64;
const MAGNETIC_FIELD_CYCLE_SECONDS = 2.4;
const MAGNETIC_SECONDARY_COIL_SEGMENTS = 960;
const MAGNETIC_SECONDARY_COIL_TURNS = 32;
const MOON_SECONDARY_COIL_TURNS = 24;

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
  const secondaryCoilBottomRadius = scaleDimension(0.08);
  const secondaryCoilTopRadius = scaleDimension(0.34);
  const coilStartY = surfaceHeight + scaleDimension(0.04);
  const axisTopHeight = getAxisTopHeight();
  const secondaryCoilTopY = axisTopHeight - scaleDimension(0.24);
  const coilOrbitProfiles = {
    sun: {
      turns: MAGNETIC_SECONDARY_COIL_TURNS,
      radiusCurveExponent: 1.65,
      radiusStart: secondaryCoilBottomRadius,
      radiusEnd: secondaryCoilTopRadius,
      yStart: coilStartY,
      yEnd: secondaryCoilTopY
    },
    moon: {
      turns: MOON_SECONDARY_COIL_TURNS,
      radiusCurveExponent: 1.42,
      radiusStart: secondaryCoilBottomRadius * 0.84,
      radiusEnd: secondaryCoilTopRadius * 0.72,
      yStart: coilStartY + scaleDimension(0.02),
      yEnd: secondaryCoilTopY - scaleDimension(0.18)
    }
  };

  const magneticFieldGroup = new THREE.Group();
  const magneticAxisGroup = new THREE.Group();
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
        float alpha = mix(0.018, 0.11, 1.0 - vProgress) + (trail * 0.08) + (pulse * 0.26);
        alpha *= mix(0.52, 0.88, rotationFocus);

        gl_FragColor = vec4(color, min(alpha, 1.0));
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.NormalBlending,
    toneMapped: false
  });
  const secondaryCoilMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPulseCycleSeconds: { value: MAGNETIC_FIELD_CYCLE_SECONDS * 0.6 },
      uCoreColor: { value: new THREE.Color(0xdff8ff) },
      uPulseColor: { value: new THREE.Color(0x9be0ff) }
    },
    vertexShader: `
      attribute float progress;
      varying float vProgress;

      void main() {
        vProgress = progress;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uPulseCycleSeconds;
      uniform vec3 uCoreColor;
      uniform vec3 uPulseColor;
      varying float vProgress;

      void main() {
        float pulseHead = fract((uTime / uPulseCycleSeconds) + 0.08);
        float pulseDistance = abs(vProgress - pulseHead);
        float pulse = 1.0 - smoothstep(0.0, 0.12, pulseDistance);
        float trail = 1.0 - smoothstep(0.02, 0.24, pulseDistance);
        vec3 color = mix(uCoreColor, uPulseColor, pulse);
        float alpha = 0.12 + (trail * 0.08) + (pulse * 0.22);

        gl_FragColor = vec4(color, min(alpha, 1.0));
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.NormalBlending,
    toneMapped: false
  });
  const axisMaterial = new THREE.LineBasicMaterial({
    color: 0xe8fbff,
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
    depthTest: false,
    blending: THREE.NormalBlending
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

  function getAxisTopHeight() {
    return getDomeAlignedHeight(0) - scaleDimension(0.06);
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

  function buildHelixLine({
    radiusStart,
    radiusEnd,
    yStart,
    yEnd,
    turns,
    segments,
    material,
    radiusCurveExponent,
    renderOrder
  }) {
    const points = [];
    const progress = new Float32Array(segments + 1);

    for (let segmentIndex = 0; segmentIndex <= segments; segmentIndex += 1) {
      const segmentProgress = segmentIndex / segments;
      const angle = segmentProgress * Math.PI * 2 * turns;
      const radiusProgress = segmentProgress ** radiusCurveExponent;
      const radius = THREE.MathUtils.lerp(radiusStart, radiusEnd, radiusProgress);
      const y = THREE.MathUtils.lerp(yStart, yEnd, segmentProgress);
      points.push(new THREE.Vector3(
        Math.cos(angle) * radius,
        y,
        Math.sin(angle) * radius
      ));
      progress[segmentIndex] = segmentProgress;
    }

    const coilGeometry = new THREE.BufferGeometry().setFromPoints(points);
    coilGeometry.setAttribute("progress", new THREE.BufferAttribute(progress, 1));
    const coilLine = new THREE.Line(coilGeometry, material);
    coilLine.renderOrder = renderOrder;
    magneticAxisGroup.add(coilLine);
  }

  function buildAxisCoil() {
    buildHelixLine({
      radiusStart: secondaryCoilBottomRadius,
      radiusEnd: secondaryCoilTopRadius,
      yStart: coilStartY,
      yEnd: secondaryCoilTopY,
      turns: MAGNETIC_SECONDARY_COIL_TURNS,
      segments: MAGNETIC_SECONDARY_COIL_SEGMENTS,
      material: secondaryCoilMaterial,
      radiusCurveExponent: 1.65,
      renderOrder: 20
    });

    const axisGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, surfaceHeight, 0),
      new THREE.Vector3(0, axisTopHeight, 0)
    ]);
    const axisLine = new THREE.Line(axisGeometry, axisMaterial);
    axisLine.renderOrder = 18;
    magneticAxisGroup.add(axisLine);
  }

  function getCoilOrbitProfile(body = "sun") {
    const profile = coilOrbitProfiles[body] ?? coilOrbitProfiles.sun;
    return { ...profile };
  }

  function sampleCoilOrbitProfile(body = "sun", progress = 0) {
    const profile = coilOrbitProfiles[body] ?? coilOrbitProfiles.sun;
    const clampedProgress = THREE.MathUtils.clamp(progress, 0, 1);
    const radiusProgress = clampedProgress ** profile.radiusCurveExponent;
    const radius = THREE.MathUtils.lerp(profile.radiusStart, profile.radiusEnd, radiusProgress);
    const y = THREE.MathUtils.lerp(profile.yStart, profile.yEnd, clampedProgress);
    const radiusSpan = Math.max(profile.radiusEnd - profile.radiusStart, 0.0001);
    const ySpan = Math.max(profile.yEnd - profile.yStart, 0.0001);

    return {
      progress: clampedProgress,
      radius,
      radiusRatio: THREE.MathUtils.clamp((radius - profile.radiusStart) / radiusSpan, 0, 1),
      y,
      yRatio: THREE.MathUtils.clamp((y - profile.yStart) / ySpan, 0, 1)
    };
  }

  function syncRotationFromSun() {
    const rotationY = Math.atan2(orbitSun.position.z, -orbitSun.position.x);
    magneticFieldGroup.rotation.y = rotationY;
    magneticAxisGroup.rotation.y = rotationY;
  }

  function syncVisibility() {
    const visible = magneticFieldState.enabled && !walkerState.enabled;
    magneticFieldGroup.visible = visible;
    magneticAxisGroup.visible = visible;
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
    secondaryCoilMaterial.uniforms.uTime.value = timeMs * 0.001;
    syncRotationFromSun();
    syncVisibility();
  }

  buildFieldLines();
  buildAxisCoil();
  scalableStage.add(magneticFieldGroup);
  scalableStage.add(magneticAxisGroup);
  syncRotationFromSun();
  syncUi();

  return {
    getAxisMetrics() {
      return {
        axisTopHeight,
        secondaryCoilRadius: secondaryCoilTopRadius,
        secondaryCoilBottomRadius,
        secondaryCoilTopRadius,
        secondaryCoilTopY,
        surfaceHeight
      };
    },
    getCoilOrbitProfile,
    refreshLocalizedUi,
    sampleCoilOrbitProfile,
    syncUi,
    update
  };
}
