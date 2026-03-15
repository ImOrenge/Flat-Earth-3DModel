import * as THREE from "../vendor/three.module.js";

const MAGNETIC_FIELD_RADIAL_GUIDE_STEP = Math.PI / 12;
const MAGNETIC_FIELD_MERIDIAN_LOOP_COUNT = Math.round((Math.PI * 2) / MAGNETIC_FIELD_RADIAL_GUIDE_STEP);
const MAGNETIC_FIELD_CARDINAL_MERIDIAN_INTERVAL = MAGNETIC_FIELD_MERIDIAN_LOOP_COUNT / 4;
const MAGNETIC_FIELD_RING_GUIDE_FACTORS = [0.176, 0.284, 0.392, 0.5, 0.608, 0.716, 0.824];
const MAGNETIC_FIELD_RING_LOOP_COUNT = MAGNETIC_FIELD_RING_GUIDE_FACTORS.length * 2;
const MAGNETIC_FIELD_SPIRAL_LOOP_COUNT = 16;
const MAGNETIC_FIELD_SPIRAL_TURNS = 2;
const MAGNETIC_FIELD_SPIRAL_PRIMARY_WAVE_FREQUENCY = 6;
const MAGNETIC_FIELD_SPIRAL_PRIMARY_WAVE_AMPLITUDE = 0.18;
const MAGNETIC_FIELD_SPIRAL_SECONDARY_WAVE_FREQUENCY = 3;
const MAGNETIC_FIELD_SPIRAL_SECONDARY_WAVE_AMPLITUDE = 0.08;
const MAGNETIC_FIELD_SEGMENTS = 96;
const MAGNETIC_FIELD_CYCLE_SECONDS = 2.4;
const MAGNETIC_SECONDARY_COIL_TURNS = 32;
const MOON_SECONDARY_COIL_TURNS = 24;
const ARCTIC_CIRCLE_LATITUDE = 66.56;

export function createMagneticFieldController({
  constants,
  i18n,
  ui,
  magneticFieldState,
  orbitSun,
  scalableStage,
  walkerState
}) {
  void orbitSun;

  const scaleDimension = (value) => value * (constants.MODEL_SCALE ?? 1);
  const surfaceHeight = constants.SURFACE_Y + constants.ANALEMMA_SURFACE_OFFSET + scaleDimension(0.028);
  const domeClearance = scaleDimension(0.1);
  const outerMargin = scaleDimension(0.18);
  const maxPlanarRadius = constants.RIM_INNER_RADIUS - outerMargin;
  const torusHoleRadius = constants.DISC_RADIUS * ((90 - ARCTIC_CIRCLE_LATITUDE) / 180);
  const torusOuterRadius = constants.DISC_RADIUS * 1.12;
  const torusCenterRadius = (torusHoleRadius + torusOuterRadius) * 0.5;
  const torusMinorRadius = (torusOuterRadius - torusHoleRadius) * 0.53;
  const torusVerticalRadius = torusMinorRadius * 1.3;
  const torusCenterY = scaleDimension(0.38);
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
  const magneticFieldLineCount = (
    MAGNETIC_FIELD_MERIDIAN_LOOP_COUNT +
    MAGNETIC_FIELD_RING_LOOP_COUNT +
    MAGNETIC_FIELD_SPIRAL_LOOP_COUNT
  );

  const magneticFieldGroup = new THREE.Group();
  const magneticAxisGroup = new THREE.Group();
  const lineMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPulseCycleSeconds: { value: MAGNETIC_FIELD_CYCLE_SECONDS },
      uMeridianInnerColor: { value: new THREE.Color(0xe5fbff) },
      uMeridianOuterColor: { value: new THREE.Color(0x46a5ff) },
      uRingInnerColor: { value: new THREE.Color(0xffefb4) },
      uRingOuterColor: { value: new THREE.Color(0xff8d36) }
    },
    vertexShader: `
      attribute float progress;
      attribute float phase;
      attribute float lineAngle;
      attribute float lineFamily;
      attribute float lineParity;
      attribute float lineEmphasis;
      varying float vProgress;
      varying float vPhase;
      varying float vLineAngle;
      varying float vLineFamily;
      varying float vLineParity;
      varying float vLineEmphasis;

      void main() {
        vProgress = progress;
        vPhase = phase;
        vLineAngle = lineAngle;
        vLineFamily = lineFamily;
        vLineParity = lineParity;
        vLineEmphasis = lineEmphasis;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uPulseCycleSeconds;
      uniform vec3 uMeridianInnerColor;
      uniform vec3 uMeridianOuterColor;
      uniform vec3 uRingInnerColor;
      uniform vec3 uRingOuterColor;
      varying float vProgress;
      varying float vPhase;
      varying float vLineAngle;
      varying float vLineFamily;
      varying float vLineParity;
      varying float vLineEmphasis;

      void main() {
        float circulationHead = fract((uTime / (uPulseCycleSeconds * 1.45)) + vPhase);
        float circulationDistance = abs(vProgress - circulationHead);
        circulationDistance = min(circulationDistance, 1.0 - circulationDistance);
        float circulationCore = 1.0 - smoothstep(0.0, 0.12, circulationDistance);
        float circulationHalo = 1.0 - smoothstep(0.02, 0.32, circulationDistance);
        float circulationWave = 0.5 + (0.5 * sin((vProgress * 6.28318530718 * 2.0) - ((uTime / uPulseCycleSeconds) * 1.4) + (vPhase * 6.28318530718)));
        float rotationFocus = smoothstep(0.18, 0.995, cos(vLineAngle));
        vec3 innerColor = mix(uMeridianInnerColor, uRingInnerColor, vLineFamily);
        vec3 outerColor = mix(uMeridianOuterColor, uRingOuterColor, vLineFamily);
        float parityBrightness = mix(0.82, 1.2, vLineParity);
        float familyBrightness = mix(1.12, 0.96, vLineFamily);
        float emphasisBoost = mix(1.0, 1.18, vLineEmphasis);
        vec3 baseColor = mix(outerColor, innerColor, pow(1.0 - vProgress, 0.74));
        vec3 pulseColor = mix(outerColor, innerColor, max(circulationCore, rotationFocus));
        vec3 circulationTint = mix(outerColor, innerColor, circulationWave);
        vec3 color = (
          (baseColor * parityBrightness * familyBrightness) +
          (pulseColor * circulationCore * 0.78) +
          (circulationTint * circulationHalo * 0.2)
        ) * emphasisBoost;
        float alpha = mix(0.05, 0.19, 1.0 - vProgress) + (circulationHalo * 0.1) + (circulationCore * 0.24);
        alpha *= mix(0.74, 1.0, rotationFocus);
        alpha *= mix(1.08, 0.94, vLineFamily);
        alpha *= parityBrightness;
        alpha *= mix(0.9, 1.24, vLineEmphasis);

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

  function createToroidalPoint(angleRadians, profileRadians) {
    const clampedProfile = THREE.MathUtils.euclideanModulo(profileRadians, Math.PI * 2);
    const radius = torusCenterRadius + (torusMinorRadius * Math.cos(clampedProfile));
    return new THREE.Vector3(
      -Math.cos(angleRadians) * radius,
      torusCenterY + (torusVerticalRadius * Math.sin(clampedProfile)),
      Math.sin(angleRadians) * radius
    );
  }

  function getLineAngle(point, fallbackAngle) {
    const planarRadius = Math.hypot(point.x, point.z);
    if (planarRadius <= 0.000001) {
      return fallbackAngle;
    }
    return Math.atan2(point.z, -point.x);
  }

  function getToroidalProfileFromPlanarRadius(targetRadius, upperHalf) {
    const minimumRadius = Math.max(0.0001, torusCenterRadius - torusMinorRadius + scaleDimension(0.02));
    const maximumRadius = torusCenterRadius + torusMinorRadius - scaleDimension(0.02);
    const clampedRadius = THREE.MathUtils.clamp(targetRadius, minimumRadius, maximumRadius);
    const cosProfile = THREE.MathUtils.clamp((clampedRadius - torusCenterRadius) / torusMinorRadius, -1, 1);
    const baseProfile = Math.acos(cosProfile);
    return upperHalf ? baseProfile : ((Math.PI * 2) - baseProfile);
  }

  function getPineconeSpiralProfile(angleRadians, phaseOffset) {
    const primaryWave = Math.sin((angleRadians * MAGNETIC_FIELD_SPIRAL_PRIMARY_WAVE_FREQUENCY) + phaseOffset);
    const secondaryWave = Math.sin(
      (angleRadians * MAGNETIC_FIELD_SPIRAL_SECONDARY_WAVE_FREQUENCY) - (phaseOffset * 0.5)
    );
    return (
      phaseOffset +
      (angleRadians * MAGNETIC_FIELD_SPIRAL_TURNS) +
      (primaryWave * MAGNETIC_FIELD_SPIRAL_PRIMARY_WAVE_AMPLITUDE) +
      (secondaryWave * MAGNETIC_FIELD_SPIRAL_SECONDARY_WAVE_AMPLITUDE)
    );
  }

  function addFieldLine({
    lineIndex,
    lineFamilyValue,
    lineParityValue,
    lineEmphasisValue,
    renderOrderValue = 18,
    pointFactory
  }) {
    const points = [];
    const progress = new Float32Array(MAGNETIC_FIELD_SEGMENTS + 1);
    const phase = new Float32Array(MAGNETIC_FIELD_SEGMENTS + 1);
    const lineAngle = new Float32Array(MAGNETIC_FIELD_SEGMENTS + 1);
    const lineFamily = new Float32Array(MAGNETIC_FIELD_SEGMENTS + 1);
    const lineParity = new Float32Array(MAGNETIC_FIELD_SEGMENTS + 1);
    const lineEmphasis = new Float32Array(MAGNETIC_FIELD_SEGMENTS + 1);
    const phaseValue = lineIndex / Math.max(magneticFieldLineCount, 1);

    for (let segmentIndex = 0; segmentIndex <= MAGNETIC_FIELD_SEGMENTS; segmentIndex += 1) {
      const segmentProgress = segmentIndex / MAGNETIC_FIELD_SEGMENTS;
      const { point, fallbackAngle } = pointFactory(segmentProgress, segmentIndex);
      points.push(point);
      progress[segmentIndex] = segmentProgress;
      phase[segmentIndex] = phaseValue;
      lineAngle[segmentIndex] = getLineAngle(point, fallbackAngle);
      lineFamily[segmentIndex] = lineFamilyValue;
      lineParity[segmentIndex] = lineParityValue;
      lineEmphasis[segmentIndex] = lineEmphasisValue;
    }

    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    geometry.setAttribute("progress", new THREE.BufferAttribute(progress, 1));
    geometry.setAttribute("phase", new THREE.BufferAttribute(phase, 1));
    geometry.setAttribute("lineAngle", new THREE.BufferAttribute(lineAngle, 1));
    geometry.setAttribute("lineFamily", new THREE.BufferAttribute(lineFamily, 1));
    geometry.setAttribute("lineParity", new THREE.BufferAttribute(lineParity, 1));
    geometry.setAttribute("lineEmphasis", new THREE.BufferAttribute(lineEmphasis, 1));

    const line = new THREE.Line(geometry, lineMaterial);
    line.renderOrder = renderOrderValue;
    magneticFieldGroup.add(line);
  }

  function buildToroidalFieldLines() {
    let lineIndex = 0;

    for (let meridianIndex = 0; meridianIndex < MAGNETIC_FIELD_MERIDIAN_LOOP_COUNT; meridianIndex += 1) {
      const angleRadians = meridianIndex * MAGNETIC_FIELD_RADIAL_GUIDE_STEP;
      const lineEmphasisValue = (meridianIndex % MAGNETIC_FIELD_CARDINAL_MERIDIAN_INTERVAL) === 0 ? 1 : 0.52;
      addFieldLine({
        lineIndex,
        lineFamilyValue: 0,
        lineParityValue: meridianIndex % 2,
        lineEmphasisValue,
        pointFactory(segmentProgress, segmentIndex) {
          if (segmentIndex === MAGNETIC_FIELD_SEGMENTS) {
            return {
              point: createToroidalPoint(angleRadians, 0),
              fallbackAngle: angleRadians
            };
          }
          return {
            point: createToroidalPoint(angleRadians, segmentProgress * Math.PI * 2),
            fallbackAngle: angleRadians
          };
        }
      });
      lineIndex += 1;
    }

    MAGNETIC_FIELD_RING_GUIDE_FACTORS.forEach((ringFactor, guideIndex) => {
      const targetRadius = constants.DISC_RADIUS * ringFactor;
      const ringProfiles = [
        getToroidalProfileFromPlanarRadius(targetRadius, true),
        getToroidalProfileFromPlanarRadius(targetRadius, false)
      ];
      const lineEmphasisValue = Math.abs(ringFactor - 0.5) < 0.02 ? 0.54 : 0.28;

      ringProfiles.forEach((profileRadians, profileIndex) => {
        addFieldLine({
          lineIndex,
          lineFamilyValue: 1,
          lineParityValue: (guideIndex + profileIndex) % 2,
          lineEmphasisValue,
          pointFactory(segmentProgress, segmentIndex) {
            const angleRadians = segmentProgress * Math.PI * 2;
            if (segmentIndex === MAGNETIC_FIELD_SEGMENTS) {
              return {
                point: createToroidalPoint(0, profileRadians),
                fallbackAngle: 0
              };
            }
            return {
              point: createToroidalPoint(angleRadians, profileRadians),
              fallbackAngle: angleRadians
            };
          }
        });
        lineIndex += 1;
      });
    });

    return lineIndex;
  }

  function buildSpiralOverlayLines(startingLineIndex = 0) {
    let lineIndex = startingLineIndex;

    for (let spiralIndex = 0; spiralIndex < MAGNETIC_FIELD_SPIRAL_LOOP_COUNT; spiralIndex += 1) {
      const phaseOffset = (spiralIndex / MAGNETIC_FIELD_SPIRAL_LOOP_COUNT) * Math.PI * 2;
      const lineEmphasisValue = (spiralIndex % 4) === 0 ? 0.96 : 0.76;

      addFieldLine({
        lineIndex,
        lineFamilyValue: spiralIndex % 2,
        lineParityValue: spiralIndex % 2,
        lineEmphasisValue,
        renderOrderValue: 19,
        pointFactory(segmentProgress, segmentIndex) {
          const angleRadians = segmentProgress * Math.PI * 2;
          if (segmentIndex === MAGNETIC_FIELD_SEGMENTS) {
            return {
              point: createToroidalPoint(0, getPineconeSpiralProfile(0, phaseOffset)),
              fallbackAngle: 0
            };
          }
          return {
            point: createToroidalPoint(
              angleRadians,
              getPineconeSpiralProfile(angleRadians, phaseOffset)
            ),
            fallbackAngle: angleRadians
          };
        }
      });
      lineIndex += 1;
    }
  }

  function getCoilOrbitProfile(body = "sun") {
    const normalizedBody = body === "darkSun" ? "sun" : body;
    const profile = coilOrbitProfiles[normalizedBody] ?? coilOrbitProfiles.sun;
    return { ...profile };
  }

  function sampleCoilOrbitProfile(body = "sun", progressValue = 0) {
    const normalizedBody = body === "darkSun" ? "sun" : body;
    const profile = coilOrbitProfiles[normalizedBody] ?? coilOrbitProfiles.sun;
    const clampedProgress = THREE.MathUtils.clamp(progressValue, 0, 1);
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
    syncVisibility();
  }

  const spiralLineIndex = buildToroidalFieldLines();
  buildSpiralOverlayLines(spiralLineIndex);
  scalableStage.add(magneticFieldGroup);
  scalableStage.add(magneticAxisGroup);
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
