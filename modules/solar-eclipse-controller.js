import * as THREE from "../vendor/three.module.js";
import { createSolarEclipseState } from "./astronomy-utils.js?v=20260314-natural-eclipse2";

export function createSolarEclipseController(deps) {
  const {
    constants,
    i18n,
    ui,
    orbitSun,
    orbitDarkSun,
    observerSun,
    observerDarkSun,
    orbitSunBody,
    orbitDarkSunRim,
    orbitDarkSunBody,
    orbitSunHalo,
    scene,
    camera,
    stage,
    scalableStage,
    dome,
    dayNightOverlayMaterial,
    firstPersonSunRayGroup,
    firstPersonSunRayMeshes,
    simulationState,
    astronomyState,
    renderState,
    walkerState,
    cameraState,
    astronomyApi,
    cameraApi,
    celestialTrackingCameraApi,
    celestialControlState,
    getGeoFromProjectedPosition,
    orbitMoon,
    getMoonPhase,
    solarEclipseToastTitleEl,
    solarEclipseToastCopyEl,
    solarEclipseToastEl,
    getBodyBandProgressStep,
    sunFullTrail,
    sunFullTrailPointsCloud,
    moonFullTrail,
    moonFullTrailPointsCloud,
    applyStaticTranslations,
    syncSeasonalEventButtonLabels,
    textureApi,
    magneticFieldApi,
    walkerApi,
    routeSimulationApi,
    syncPreparationPresentation,
    observerSunBody,
    observerDarkSunBody,
    renderer,
    observerDarkSunRim,
    exitFirstPersonMode,
    realitySyncEl,
    realityLiveEl,
    setDemoMoonOrbitOffsetFromPhase,
    syncDemoMoonOrbitToSun,
    updateSunVisualEffects
  } = deps;

  const {
    DARK_SUN_ALTITUDE_ALIGNMENT_TOLERANCE_FACTOR,
    DARK_SUN_ALTITUDE_LOCK_START,
    DARK_SUN_ATTRACTION_END_FACTOR,
    DARK_SUN_ATTRACTION_START_FACTOR,
    DARK_SUN_CAPTURE_RESPONSE,
    DARK_SUN_CENTER_HOLD_FACTOR,
    DARK_SUN_ECLIPSE_RESPONSE_SLOW_FACTOR,
    DARK_SUN_ECLIPSE_TRANSIT_SLOW_FACTOR,
    DARK_SUN_HOLD_DAMPING,
    DARK_SUN_RELEASE_RESPONSE,
    DARK_SUN_STAGE_APPROACH_SHARE,
    DARK_SUN_STAGE_COMPLETE_SHARE,
    DARK_SUN_STAGE_CONTACT_MARGIN_RADIANS,
    DARK_SUN_STAGE_CONTACT_OFFSET_RADIANS,
    DARK_SUN_STAGE_DURATION_SECONDS,
    DARK_SUN_STAGE_EGRESS_SHARE,
    DARK_SUN_STAGE_INGRESS_SHARE,
    DARK_SUN_STAGE_PRE_ECLIPSE_DISTANCE_FACTOR,
    DARK_SUN_STAGE_START_OFFSET_RADIANS,
    DARK_SUN_STAGE_TOTALITY_SHARE,
    DARK_SUN_TRANSIT_ALONG_COMPRESSION,
    DARK_SUN_TRANSIT_PERPENDICULAR_COMPRESSION,
    ORBIT_DARK_SUN_OCCLUSION_OPACITY,
    SOLAR_ECLIPSE_ANIMATION_SLOW_RESPONSE,
    SOLAR_ECLIPSE_APPROACH_DISTANCE_FACTOR,
    SOLAR_ECLIPSE_APPROACH_MIN_MS,
    SOLAR_ECLIPSE_APPROACH_SLOW_FACTOR,
    SOLAR_ECLIPSE_COMPLETE_FADE_MS,
    SOLAR_ECLIPSE_COMPLETE_HOLD_FRAMES,
    SOLAR_ECLIPSE_COMPLETE_SLOW_FACTOR,
    SOLAR_ECLIPSE_CONTACT_START_PX,
    SOLAR_ECLIPSE_DIRECTION_EPSILON,
    SOLAR_ECLIPSE_IDLE_DISTANCE_FACTOR,
    SOLAR_ECLIPSE_MIN_COVERAGE,
    SOLAR_ECLIPSE_PARTIAL_LANE_2_CAP,
    SOLAR_ECLIPSE_PARTIAL_LANE_3_CAP,
    SOLAR_ECLIPSE_PARTIAL_STAGE_MIN_MS,
    SOLAR_ECLIPSE_PRESENTATION_COVERAGE_RATE,
    SOLAR_ECLIPSE_SLOW_LOOKAHEAD_FRAMES,
    SOLAR_ECLIPSE_TIER_NONE,
    SOLAR_ECLIPSE_TIER_PARTIAL_2,
    SOLAR_ECLIPSE_TIER_PARTIAL_3,
    SOLAR_ECLIPSE_TIER_TOTAL,
    SOLAR_ECLIPSE_TOAST_DISTANCE_FACTOR,
    SOLAR_ECLIPSE_TOAST_DURATION_MS,
    SOLAR_ECLIPSE_TOTALITY_MIN_MS,
    SOLAR_ECLIPSE_TOTALITY_SLOW_FACTOR,
    SOLAR_ECLIPSE_TOTAL_COVERAGE,
    SOLAR_ECLIPSE_TRIGGER_MARGIN_FACTOR,
    SOLAR_ECLIPSE_TRIGGER_MARGIN_PX,
    SOLAR_ECLIPSE_VISIBLE_CONTACT_PX,
    STAGE_PRE_ECLIPSE_MAX_START_COVERAGE,
    STAGE_PRE_ECLIPSE_REFINEMENT_FRAMES,
    STAGE_PRE_ECLIPSE_SEARCH_MAX_FRAMES,
    STAGE_PRE_ECLIPSE_TARGET_VISIBLE_COVERAGE,
    ORBIT_SUN_SIZE,
    ORBIT_DARK_SUN_SIZE,
    DISC_RADIUS,
    ORBIT_SUN_SPEED,
    ORBIT_DARK_SUN_RIM_OPACITY,
    ORBIT_DARK_SUN_DEBUG_OPACITY,
    ORBIT_DARK_SUN_DEBUG_RIM_OPACITY,
    ORBIT_DARK_SUN_DEBUG_COLOR,
    ORBIT_DARK_SUN_BODY_COLOR,
    ORBIT_DARK_SUN_DEBUG_RIM_COLOR,
    ORBIT_DARK_SUN_RIM_COLOR,
    ORBIT_DARK_SUN_SPEED
  } = constants;

  function createSolarEclipseWindowSolverState(overrides = {}) {
    return {
      displayCoverage: 0,
      eventWindowActive: false,
      hasEnteredVisibleOverlap: false,
      previousRawCoverage: 0,
      previousRawStageKey: "idle",
      stageElapsedMs: 0,
      stageKey: "idle",
      ...overrides
    };
  }
  
  const solarEclipseWindowSolverState = createSolarEclipseWindowSolverState();
  const solarEclipseEventState = {
    animationSpeedFactor: 1,
    currentState: createSolarEclipseState(),
    framesUntilWindowStart: Number.POSITIVE_INFINITY,
    slowWindowActive: false,
    toastActive: false,
    toastDismissAtMs: 0,
    toastShownForCurrentEvent: false,
    toastStateLabelKey: "solarEclipseStatePartial"
  };
  const solarEclipsePresentationMaskState = {
    maskCenterNdc: new THREE.Vector2(),
    maskRadius: 0,
    lastDirectionNdc: new THREE.Vector2(1, 0),
    observerBaseScale: new THREE.Vector3(1, 1, 1),
    orbitBaseScale: new THREE.Vector3(1, 1, 1),
    valid: false
  };
  solarEclipsePresentationMaskState.orbitBaseScale.copy(orbitDarkSun.scale);
  solarEclipsePresentationMaskState.observerBaseScale.copy(observerDarkSun.scale);
  function getCurrentDarkSunRenderStateSnapshot() {
    if (!astronomyApi) {
      return null;
    }
  
    const naturalDarkSunRenderState = astronomyApi.getDarkSunRenderState({
      orbitMode: simulationState.orbitMode,
      source: "demo",
      sunDirection: simulationState.sunBandDirection,
      sunOrbitAngleRadians: simulationState.orbitSunAngle,
      sunProgress: simulationState.sunBandProgress
    });
  
    if (!simulationState.darkSunStageAltitudeLock) {
      return naturalDarkSunRenderState;
    }
  
    return astronomyApi.getDarkSunRenderState({
      direction: simulationState.sunBandDirection ?? naturalDarkSunRenderState.direction,
      orbitAngleRadians: naturalDarkSunRenderState.orbitAngleRadians,
      orbitMode: simulationState.orbitMode,
      progress: simulationState.sunBandProgress,
      source: "demo",
      useExplicitOrbit: true
    });
  }
  
  function getDarkSunStageContactOffsetRadians(currentSunRenderState = null) {
    const bodyRadiusSum = (
      getWorldBodyRadius(orbitSunBody, ORBIT_SUN_SIZE) +
      getWorldBodyRadius(orbitDarkSunBody, ORBIT_DARK_SUN_SIZE)
    );
    const centerRadius = Math.max(
      currentSunRenderState?.centerRadius ?? Math.hypot(
        currentSunRenderState?.position?.x ?? 0,
        currentSunRenderState?.position?.z ?? 0
      ),
      bodyRadiusSum * 0.5,
      0.0001
    );
    const contactRatio = THREE.MathUtils.clamp(
      bodyRadiusSum / Math.max(centerRadius * 2, 0.0001),
      0,
      0.9999
    );
    const naturalContactOffset = 2 * Math.asin(contactRatio);
    return THREE.MathUtils.clamp(
      naturalContactOffset + DARK_SUN_STAGE_CONTACT_MARGIN_RADIANS,
      DARK_SUN_STAGE_CONTACT_MARGIN_RADIANS * 2,
      DARK_SUN_STAGE_CONTACT_OFFSET_RADIANS
    );
  }
  
  function getProjectedDarkSunStageMetricsForOffsetRadians({
    offsetRadians = 0,
    sunRenderState = null,
    sunDirection = simulationState.sunBandDirection ?? 1,
    sunProgress = simulationState.sunBandProgress ?? 0.5,
    trackCandidateSun = false
  } = {}) {
    if (!astronomyApi || !sunRenderState) {
      return null;
    }
  
    const candidateDarkSunRenderState = astronomyApi.getDarkSunRenderState({
      direction: sunDirection,
      orbitAngleRadians: (sunRenderState.orbitAngleRadians ?? 0) + offsetRadians,
      orbitMode: simulationState.orbitMode,
      progress: sunProgress,
      source: "demo",
      useExplicitOrbit: true
    });
    const eclipseMetrics = getProjectedSolarEclipseMetricsFromStates(
      sunRenderState,
      candidateDarkSunRenderState,
      {
        trackCandidateSun
      }
    );
  
    return {
      darkSunRenderState: candidateDarkSunRenderState,
      eclipseMetrics,
      offsetRadians
    };
  }
  
  function getProjectedDarkSunStageMetricsForMirroredPhaseOffsetRadians({
    phaseOffsetRadians = simulationState.darkSunOrbitPhaseOffsetRadians ?? Math.PI,
    sunRenderState = null,
    sunDirection = simulationState.sunBandDirection ?? 1,
    sunProgress = simulationState.sunBandProgress ?? 0.5,
    trackCandidateSun = false
  } = {}) {
    if (!astronomyApi || !sunRenderState) {
      return null;
    }
  
    const candidateDarkSunRenderState = astronomyApi.getDarkSunRenderState({
      orbitMode: "auto",
      phaseOffsetRadians,
      source: "demo",
      sunDirection,
      sunOrbitAngleRadians: sunRenderState.orbitAngleRadians ?? 0,
      sunProgress
    });
    const eclipseMetrics = getProjectedSolarEclipseMetricsFromStates(
      sunRenderState,
      candidateDarkSunRenderState,
      {
        trackCandidateSun
      }
    );
  
    return {
      darkSunRenderState: candidateDarkSunRenderState,
      eclipseMetrics,
      phaseOffsetRadians
    };
  }
  
  function findDarkSunStagePreContactOffsetRadians({
    sunRenderState = null,
    sunDirection = simulationState.sunBandDirection ?? 1,
    sunProgress = simulationState.sunBandProgress ?? 0.5,
    preferVisibleOverlap = false,
    targetVisibleCoverage = STAGE_PRE_ECLIPSE_TARGET_VISIBLE_COVERAGE,
    trackCandidateSun = false
  } = {}) {
    if (!astronomyApi || !sunRenderState) {
      return null;
    }
  
    const fallbackContactOffset = getDarkSunStageContactOffsetRadians(sunRenderState);
    const minOffsetRadians = 0.0005;
    const maxOffsetRadians = Math.max(
      minOffsetRadians + 0.0005,
      Math.min(Math.PI * 0.35, Math.max(fallbackContactOffset * 1.75, 0.42))
    );
    const targetPreContactDepthPx = -18;
    let bestVisibleOverlapCandidate = null;
    let searchStart = minOffsetRadians;
    let searchEnd = maxOffsetRadians;
    let bestCandidate = null;
  
    for (let passIndex = 0; passIndex < 3; passIndex += 1) {
      const sampleCount = passIndex === 0 ? 180 : 120;
      let bestCandidateInPass = null;
  
      for (let sampleIndex = 0; sampleIndex <= sampleCount; sampleIndex += 1) {
        const sampleProgress = sampleIndex / Math.max(sampleCount, 1);
        const offsetRadians = THREE.MathUtils.lerp(searchStart, searchEnd, sampleProgress);
        const candidateMetrics = getProjectedDarkSunStageMetricsForOffsetRadians({
          offsetRadians,
          sunDirection,
          sunProgress,
          sunRenderState,
          trackCandidateSun
        });
        const eclipseMetrics = candidateMetrics?.eclipseMetrics;
  
        if (!eclipseMetrics?.visibleInView) {
          continue;
        }
  
        if (eclipseMetrics.hasVisibleOverlap) {
          const visibleCoverage = THREE.MathUtils.clamp(
            eclipseMetrics.coverage ?? 0,
            0,
            1
          );
          const visibleCoverageError = Math.abs(visibleCoverage - targetVisibleCoverage);
          const overshootPenalty = Math.max(0, visibleCoverage - targetVisibleCoverage);
          const visibleScore = (
            (visibleCoverageError * 2400) +
            (overshootPenalty * 3600) +
            (
              Math.abs(
                (eclipseMetrics.contactDepthPx ?? SOLAR_ECLIPSE_VISIBLE_CONTACT_PX) -
                SOLAR_ECLIPSE_VISIBLE_CONTACT_PX
              ) * 20
            ) +
            (offsetRadians * 24)
          );
          if (!bestVisibleOverlapCandidate || visibleScore < bestVisibleOverlapCandidate.score) {
            bestVisibleOverlapCandidate = {
              ...candidateMetrics,
              score: visibleScore
            };
          }
        }
  
        const isPreContact = !eclipseMetrics.hasContact && !eclipseMetrics.hasVisibleOverlap;
        const approachPenalty = eclipseMetrics.hasApproachWindow ? 0 : 100;
        const totalScore = isPreContact
          ? (
            approachPenalty +
            Math.abs((eclipseMetrics.contactDepthPx ?? targetPreContactDepthPx) - targetPreContactDepthPx) +
            Math.abs((eclipseMetrics.normalizedDistance ?? 1) - 1) +
            (offsetRadians * 24)
          )
          : (
            10000 +
            Math.abs(eclipseMetrics.contactDepthPx ?? 0)
          );
  
        if (!bestCandidateInPass || totalScore < bestCandidateInPass.score) {
          bestCandidateInPass = {
            ...candidateMetrics,
            score: totalScore
          };
        }
      }
  
      if (!bestCandidateInPass) {
        break;
      }
  
      bestCandidate = bestCandidateInPass;
      const refinementSpan = Math.max(
        (searchEnd - searchStart) / Math.max(sampleCount, 1),
        0.0005
      );
      searchStart = Math.max(minOffsetRadians, bestCandidate.offsetRadians - (refinementSpan * 2));
      searchEnd = Math.min(maxOffsetRadians, bestCandidate.offsetRadians + (refinementSpan * 2));
    }
  
    if (bestCandidate && bestCandidate.offsetRadians <= Math.max(fallbackContactOffset * 0.6, 0.08)) {
      if (preferVisibleOverlap && bestVisibleOverlapCandidate) {
        return bestVisibleOverlapCandidate;
      }
      return bestCandidate;
    }
  
    if (bestVisibleOverlapCandidate) {
      return bestVisibleOverlapCandidate;
    }
  
    return bestCandidate;
  }
  
  function findMirroredDarkSunStageStartCandidate({
    phaseOffsetRadians = simulationState.darkSunOrbitPhaseOffsetRadians ?? Math.PI,
    sunRenderState = null,
    sunDirection = simulationState.sunBandDirection ?? 1,
    sunProgress = simulationState.sunBandProgress ?? 0.5,
    targetVisibleCoverage = STAGE_PRE_ECLIPSE_TARGET_VISIBLE_COVERAGE,
    trackCandidateSun = false
  } = {}) {
    if (!astronomyApi || !sunRenderState) {
      return null;
    }
  
    let bestVisibleOverlapCandidate = null;
    let bestPreContactCandidate = null;
    let searchStart = phaseOffsetRadians - Math.PI;
    let searchEnd = phaseOffsetRadians + Math.PI;
  
    for (let passIndex = 0; passIndex < 3; passIndex += 1) {
      const sampleCount = passIndex === 0 ? 360 : 180;
      let refinementPivot = null;
  
      for (let sampleIndex = 0; sampleIndex <= sampleCount; sampleIndex += 1) {
        const sampleProgress = sampleIndex / Math.max(sampleCount, 1);
        const candidatePhaseOffsetRadians = THREE.MathUtils.lerp(
          searchStart,
          searchEnd,
          sampleProgress
        );
        const candidateMetrics = getProjectedDarkSunStageMetricsForMirroredPhaseOffsetRadians({
          phaseOffsetRadians: candidatePhaseOffsetRadians,
          sunDirection,
          sunProgress,
          sunRenderState,
          trackCandidateSun
        });
        const eclipseMetrics = candidateMetrics?.eclipseMetrics;
  
        if (!eclipseMetrics?.visibleInView) {
          continue;
        }
  
        if (eclipseMetrics.hasVisibleOverlap) {
          const coverage = THREE.MathUtils.clamp(eclipseMetrics.coverage ?? 0, 0, 1);
          const coverageError = Math.abs(coverage - targetVisibleCoverage);
          const overshootPenalty = Math.max(0, coverage - targetVisibleCoverage);
          const score = (
            (coverageError * 3200) +
            (overshootPenalty * 4800) +
            (
              Math.abs(
                (eclipseMetrics.contactDepthPx ?? SOLAR_ECLIPSE_VISIBLE_CONTACT_PX) -
                SOLAR_ECLIPSE_VISIBLE_CONTACT_PX
              ) * 16
            )
          );
          if (!bestVisibleOverlapCandidate || score < bestVisibleOverlapCandidate.score) {
            bestVisibleOverlapCandidate = {
              ...candidateMetrics,
              score
            };
          }
          refinementPivot = bestVisibleOverlapCandidate;
          continue;
        }
  
        if (!eclipseMetrics.hasApproachWindow && !eclipseMetrics.hasContact) {
          continue;
        }
  
        const score = (
          Math.abs(
            (eclipseMetrics.contactDepthPx ?? SOLAR_ECLIPSE_VISIBLE_CONTACT_PX) -
            SOLAR_ECLIPSE_VISIBLE_CONTACT_PX
          ) +
          (eclipseMetrics.hasApproachWindow ? 0 : 25)
        );
        if (!bestPreContactCandidate || score < bestPreContactCandidate.score) {
          bestPreContactCandidate = {
            ...candidateMetrics,
            score
          };
        }
        if (!refinementPivot) {
          refinementPivot = bestPreContactCandidate;
        }
      }
  
      const nextPivot = bestVisibleOverlapCandidate ?? refinementPivot ?? bestPreContactCandidate;
      if (!nextPivot) {
        break;
      }
  
      const refinementSpan = Math.max(
        (searchEnd - searchStart) / Math.max(sampleCount, 1),
        0.0005
      );
      searchStart = nextPivot.phaseOffsetRadians - (refinementSpan * 4);
      searchEnd = nextPivot.phaseOffsetRadians + (refinementSpan * 4);
    }
  
    return bestVisibleOverlapCandidate ?? bestPreContactCandidate;
  }
  
  function getDarkSunStageRelativeOrbitOffsetRadians(
    transit = 0,
    contactOffsetRadians = DARK_SUN_STAGE_CONTACT_OFFSET_RADIANS
  ) {
    const clampedTransit = THREE.MathUtils.clamp(transit, 0, 1);
    const approachEnd = DARK_SUN_STAGE_APPROACH_SHARE;
    const ingressEnd = approachEnd + DARK_SUN_STAGE_INGRESS_SHARE;
    const totalityEnd = ingressEnd + DARK_SUN_STAGE_TOTALITY_SHARE;
    const egressEnd = totalityEnd + DARK_SUN_STAGE_EGRESS_SHARE;
    const easeOutSine = (value) => Math.sin((THREE.MathUtils.clamp(value, 0, 1) * Math.PI) / 2);
    const easeInOutCubic = (value) => {
      const clampedValue = THREE.MathUtils.clamp(value, 0, 1);
      return clampedValue < 0.5
        ? 4 * clampedValue * clampedValue * clampedValue
        : 1 - (Math.pow((-2 * clampedValue) + 2, 3) / 2);
    };
  
    if (clampedTransit <= approachEnd) {
      return THREE.MathUtils.lerp(
        Math.PI,
        contactOffsetRadians,
        easeOutSine(clampedTransit / Math.max(approachEnd, 0.0001))
      );
    }
  
    if (clampedTransit <= ingressEnd) {
      const ingressProgress = THREE.MathUtils.clamp(
        (clampedTransit - approachEnd) / Math.max(DARK_SUN_STAGE_INGRESS_SHARE, 0.0001),
        0,
        1
      );
      return THREE.MathUtils.lerp(
        contactOffsetRadians,
        0,
        ingressProgress
      );
    }
  
    if (clampedTransit <= totalityEnd) {
      return 0;
    }
  
    if (clampedTransit <= egressEnd) {
      const egressProgress = THREE.MathUtils.clamp(
        (clampedTransit - totalityEnd) / Math.max(DARK_SUN_STAGE_EGRESS_SHARE, 0.0001),
        0,
        1
      );
      return THREE.MathUtils.lerp(
        0,
        -contactOffsetRadians,
        egressProgress
      );
    }
  
    return THREE.MathUtils.lerp(
      -contactOffsetRadians,
      -Math.PI,
      easeOutSine((clampedTransit - egressEnd) / Math.max(DARK_SUN_STAGE_COMPLETE_SHARE, 0.0001))
    );
  }
  
  function updateDarkSunStageOrbit(deltaSeconds = 0) {
    if (!simulationState.darkSunStageAltitudeLock) {
      return false;
    }
  
    simulationState.darkSunStageTransit = THREE.MathUtils.clamp(
      (simulationState.darkSunStageTransit ?? 0) + (Math.max(deltaSeconds, 0) / DARK_SUN_STAGE_DURATION_SECONDS),
      0,
      1
    );
    const stageTransit = simulationState.darkSunStageTransit ?? 0;
    const currentSunRenderState = astronomyApi?.getSunRenderState({
      orbitAngleRadians: simulationState.orbitSunAngle,
      orbitMode: simulationState.orbitMode,
      progress: simulationState.sunBandProgress,
      source: "demo"
    }) ?? null;
    const contactOffsetRadians = getDarkSunStageContactOffsetRadians(currentSunRenderState);
    const nextOffsetRadians = getDarkSunStageRelativeOrbitOffsetRadians(stageTransit, contactOffsetRadians);
    simulationState.darkSunStageOffsetRadians = nextOffsetRadians;
    simulationState.orbitDarkSunAngle = simulationState.orbitSunAngle + nextOffsetRadians;
  
    if (stageTransit >= 1) {
      astronomyApi.syncDarkSunMirrorPhaseOffset({
        sunOrbitAngleRadians: simulationState.orbitSunAngle,
        darkSunOrbitAngleRadians: simulationState.orbitDarkSunAngle
      });
      resetDarkSunStageState();
    }
  
    const approachEnd = DARK_SUN_STAGE_APPROACH_SHARE;
    const ingressEnd = approachEnd + DARK_SUN_STAGE_INGRESS_SHARE;
    const totalityEnd = ingressEnd + DARK_SUN_STAGE_TOTALITY_SHARE;
    const egressEnd = totalityEnd + DARK_SUN_STAGE_EGRESS_SHARE;
  
    let stageSpeedFactor;
    if (stageTransit <= approachEnd) {
      stageSpeedFactor = SOLAR_ECLIPSE_APPROACH_SLOW_FACTOR;
    } else if (stageTransit <= ingressEnd) {
      const t = (stageTransit - approachEnd) / DARK_SUN_STAGE_INGRESS_SHARE;
      stageSpeedFactor = THREE.MathUtils.lerp(
        SOLAR_ECLIPSE_APPROACH_SLOW_FACTOR,
        SOLAR_ECLIPSE_TOTALITY_SLOW_FACTOR,
        t * t * (3 - 2 * t)
      );
    } else if (stageTransit <= totalityEnd) {
      stageSpeedFactor = SOLAR_ECLIPSE_TOTALITY_SLOW_FACTOR;
    } else if (stageTransit <= egressEnd) {
      const t = (stageTransit - totalityEnd) / DARK_SUN_STAGE_EGRESS_SHARE;
      stageSpeedFactor = THREE.MathUtils.lerp(
        SOLAR_ECLIPSE_TOTALITY_SLOW_FACTOR,
        SOLAR_ECLIPSE_COMPLETE_SLOW_FACTOR,
        t * t * (3 - 2 * t)
      );
    } else {
      stageSpeedFactor = SOLAR_ECLIPSE_COMPLETE_SLOW_FACTOR;
    }
    return stageSpeedFactor;
  }
  
  function getCurrentUiSnapshot() {
    if (astronomyState.enabled) {
      const observationDate = astronomyState.live ? new Date() : astronomyState.selectedDate;
      return astronomyApi.getAstronomySnapshot(observationDate);
    }
  
    const demoPhaseDate = new Date(simulationState.demoPhaseDateMs);
    const sunRenderState = astronomyApi.getSunRenderState({
      orbitAngleRadians: simulationState.orbitSunAngle,
      orbitMode: simulationState.orbitMode,
      progress: simulationState.sunBandProgress,
      source: "demo"
    });
    const darkSunRenderState = getCurrentDarkSunRenderStateSnapshot();
  
    return {
      date: demoPhaseDate,
      sun: getGeoFromProjectedPosition(orbitSun.position, DISC_RADIUS),
      moon: getGeoFromProjectedPosition(orbitMoon.position, DISC_RADIUS),
      darkSunRenderState,
      moonPhase: getMoonPhase(demoPhaseDate),
      darkSunRenderPosition: orbitDarkSun.position.clone(),
      solarEclipse: createSolarEclipseState(),
      sunPosition: orbitSun.position.clone(),
      sunRenderState,
      sunRenderPosition: orbitSun.position.clone(),
      sunDisplayHorizontal: astronomyApi?.getSunDisplayHorizontalFromPosition?.(orbitSun.position),
      moonPosition: orbitMoon.position.clone(),
      moonRenderPosition: orbitMoon.position.clone()
    };
  }
  
  function getSolarEclipseToastStateLabelKey(solarEclipse = createSolarEclipseState()) {
    return solarEclipse.eclipseTier === SOLAR_ECLIPSE_TIER_TOTAL
      ? "solarEclipseStateTotal"
      : "solarEclipseStatePartial";
  }
  
  function syncSolarEclipseToastContent() {
    if (!solarEclipseToastTitleEl || !solarEclipseToastCopyEl) {
      return;
    }
  
    solarEclipseToastTitleEl.textContent = i18n.t("solarEclipseToastImminentTitle");
    solarEclipseToastCopyEl.textContent = i18n.t("solarEclipseToastImminentBody", {
      state: i18n.t(solarEclipseEventState.toastStateLabelKey)
    });
  }
  
  function setSolarEclipseToastVisibility(visible) {
    if (!solarEclipseToastEl) {
      return;
    }
  
    solarEclipseToastEl.hidden = !visible;
    solarEclipseToastEl.classList.toggle("active", visible);
  }
  
  function hideSolarEclipseToast() {
    solarEclipseEventState.toastActive = false;
    solarEclipseEventState.toastDismissAtMs = 0;
    setSolarEclipseToastVisibility(false);
  }
  
  function showSolarEclipseToast(solarEclipse = createSolarEclipseState()) {
    solarEclipseEventState.toastStateLabelKey = getSolarEclipseToastStateLabelKey(solarEclipse);
    solarEclipseEventState.toastActive = true;
    solarEclipseEventState.toastDismissAtMs = performance.now() + SOLAR_ECLIPSE_TOAST_DURATION_MS;
    solarEclipseEventState.toastShownForCurrentEvent = true;
    syncSolarEclipseToastContent();
    setSolarEclipseToastVisibility(true);
  }
  
  function predictUpcomingSolarEclipseWindowStartFrameCount(frameCount = SOLAR_ECLIPSE_SLOW_LOOKAHEAD_FRAMES) {
    if (astronomyState.enabled || !astronomyApi) {
      return Number.POSITIVE_INFINITY;
    }
  
    const orbitMode = simulationState.orbitMode ?? "auto";
    const baseSpeedMultiplier = Math.max(celestialControlState.speedMultiplier ?? 1, 0);
    if (baseSpeedMultiplier <= 0) {
      return Number.POSITIVE_INFINITY;
    }
  
    let predictedSunAngle = simulationState.orbitSunAngle ?? 0;
    let predictedSunProgress = simulationState.sunBandProgress ?? 0.5;
    let predictedSunDirection = simulationState.sunBandDirection ?? 1;

    // Use a capped step size to prevent skipping the narrow natural eclipse window at high simulation speeds.
    const maxStepMultiplier = 1.5;
    const testStepMultiplier = Math.min(baseSpeedMultiplier, maxStepMultiplier);
    const testIterations = Math.ceil((frameCount * baseSpeedMultiplier) / testStepMultiplier);
    
    const predictedSunAngleStep = ORBIT_SUN_SPEED * testStepMultiplier;
    const predictedSunBandStep = getBodyBandProgressStep("sun") * testStepMultiplier;
    const expectedBaseDarkPhase = simulationState.darkSunOrbitPhaseOffsetRadians ?? Math.PI;
    const darkSunSpeedRatio = ORBIT_DARK_SUN_SPEED / Math.max(ORBIT_SUN_SPEED, 0.0001);
  
    for (let testIndex = 1; testIndex <= testIterations; testIndex += 1) {
      predictedSunAngle += predictedSunAngleStep;
      if (orbitMode === "auto") {
        const nextBandState = getAdvancedBandState(
          predictedSunProgress,
          predictedSunDirection,
          predictedSunBandStep
        );
        predictedSunProgress = nextBandState.progress;
        predictedSunDirection = nextBandState.direction;
      }
  
      // Fast mathematical culling: don't allocate or compute full metrics if they are nowhere near each other horizontally.
      const predictedDarkSunAngle = expectedBaseDarkPhase - (predictedSunAngle * darkSunSpeedRatio);
      const angularDistance = getWrappedAngularDistance(predictedSunAngle, predictedDarkSunAngle);
      if (angularDistance > 0.4) {
        continue;
      }

      const predictedSunRenderState = astronomyApi.getSunRenderState({
        orbitAngleRadians: predictedSunAngle,
        orbitMode,
        progress: predictedSunProgress,
        source: "demo"
      });
      const predictedDarkSunRenderState = astronomyApi.getDarkSunRenderState({
        orbitMode,
        source: "demo",
        sunDirection: predictedSunDirection,
        sunOrbitAngleRadians: predictedSunAngle,
        sunProgress: predictedSunProgress
      });
      const predictedMetrics = getProjectedSolarEclipseMetricsFromStates(
        predictedSunRenderState,
        predictedDarkSunRenderState
      );
  
      if (
        predictedMetrics.hasApproachWindow ||
        predictedMetrics.hasContact ||
        predictedMetrics.hasVisibleOverlap
      ) {
        return (testIndex * testStepMultiplier) / baseSpeedMultiplier;
      }
    }
  
    return Number.POSITIVE_INFINITY;
  }
  
  function getSolarEclipseAnimationTargetFactor(solarEclipse = createSolarEclipseState()) {
    const phaseKey = getSolarEclipsePhaseKey(solarEclipse);
    const coverage = THREE.MathUtils.clamp(solarEclipse.coverage ?? 0, 0, 1);
    const sunlightScale = THREE.MathUtils.clamp(solarEclipse.sunlightScale ?? 1, 0, 1);
    const darkness = THREE.MathUtils.clamp(1 - sunlightScale, 0, 1);
    const eclipseStrength = Math.max(coverage, darkness);
    const contactStrength = solarEclipse.hasContact
      ? Math.max(eclipseStrength, 0.35)
      : eclipseStrength;
    const framesUntilWindowStart = solarEclipseEventState.framesUntilWindowStart ?? Number.POSITIVE_INFINITY;
    const hasUpcomingSlowWindow = (
      !solarEclipse.eventWindowActive &&
      Number.isFinite(framesUntilWindowStart) &&
      framesUntilWindowStart <= SOLAR_ECLIPSE_SLOW_LOOKAHEAD_FRAMES
    );
    const slowLookaheadProgress = hasUpcomingSlowWindow
      ? THREE.MathUtils.clamp(
        1 - (framesUntilWindowStart / Math.max(SOLAR_ECLIPSE_SLOW_LOOKAHEAD_FRAMES, 1)),
        0,
        1
      )
      : 0;
    const approachStageProgress = solarEclipse.stageKey === "approach"
      ? THREE.MathUtils.clamp(solarEclipse.stageProgress ?? 0, 0, 1)
      : 0;
    const approachSlowProgress = solarEclipse.stageKey === "approach"
      ? Math.max(approachStageProgress, slowLookaheadProgress)
      : slowLookaheadProgress;
    const approachSlowFactor = THREE.MathUtils.lerp(
      1,
      SOLAR_ECLIPSE_APPROACH_SLOW_FACTOR,
      approachSlowProgress
    );
    const ingressSlowProgress = Math.pow(contactStrength, 0.54);
    const egressRecoveryProgress = Math.pow(1 - contactStrength, 3.1);
  
    switch (phaseKey) {
      case "approach":
        return solarEclipse.eventWindowActive || hasUpcomingSlowWindow ? approachSlowFactor : 1;
      case "partialIngress":
        return THREE.MathUtils.lerp(
          SOLAR_ECLIPSE_APPROACH_SLOW_FACTOR,
          SOLAR_ECLIPSE_TOTALITY_SLOW_FACTOR,
          ingressSlowProgress
        );
      case "totality":
        return SOLAR_ECLIPSE_TOTALITY_SLOW_FACTOR;
      case "partialEgress":
        return THREE.MathUtils.lerp(
          SOLAR_ECLIPSE_TOTALITY_SLOW_FACTOR,
          SOLAR_ECLIPSE_COMPLETE_SLOW_FACTOR,
          egressRecoveryProgress
        );
      case "complete":
        return SOLAR_ECLIPSE_COMPLETE_SLOW_FACTOR;
      default:
        if (solarEclipse.hasContact) {
          return THREE.MathUtils.lerp(
            SOLAR_ECLIPSE_APPROACH_SLOW_FACTOR,
            SOLAR_ECLIPSE_TOTALITY_SLOW_FACTOR,
            0.35
          );
        }
        if (hasUpcomingSlowWindow) {
          return approachSlowFactor;
        }
        return 1;
    }
  }
  
  function updateSolarEclipseAnimationPacing(deltaSeconds = 0) {
    const targetFactor = astronomyState.enabled
      ? 1
      : getSolarEclipseAnimationTargetFactor(solarEclipseEventState.currentState);
    const blend = THREE.MathUtils.clamp(
      Math.max(deltaSeconds, 0) * SOLAR_ECLIPSE_ANIMATION_SLOW_RESPONSE,
      0,
      1
    );
    solarEclipseEventState.animationSpeedFactor = blend > 0
      ? THREE.MathUtils.lerp(
        solarEclipseEventState.animationSpeedFactor ?? 1,
        targetFactor,
        blend
      )
      : targetFactor;
    return solarEclipseEventState.animationSpeedFactor;
  }
  
  function updateSolarEclipseEventFeedback(solarEclipse = createSolarEclipseState(), nowMs = performance.now()) {
    const nextSolarEclipse = createSolarEclipseState(solarEclipse);
    solarEclipseEventState.currentState = nextSolarEclipse;
    solarEclipseEventState.framesUntilWindowStart = (
      nextSolarEclipse.eventWindowActive
    )
      ? 0
      : (
        !astronomyState.enabled &&
        nextSolarEclipse.eclipseTier !== SOLAR_ECLIPSE_TIER_NONE
          ? predictUpcomingSolarEclipseWindowStartFrameCount(SOLAR_ECLIPSE_SLOW_LOOKAHEAD_FRAMES)
          : Number.POSITIVE_INFINITY
      );
    solarEclipseEventState.slowWindowActive = (
      nextSolarEclipse.stageKey === "approach" || (
        Number.isFinite(solarEclipseEventState.framesUntilWindowStart) &&
        solarEclipseEventState.framesUntilWindowStart <= SOLAR_ECLIPSE_SLOW_LOOKAHEAD_FRAMES
      )
    );
    const toastDistance = Number.isFinite(nextSolarEclipse.normalizedDistance)
      ? nextSolarEclipse.normalizedDistance
      : Number.POSITIVE_INFINITY;
    const shouldShowEarlyToast = (
      nextSolarEclipse.eclipseTier !== SOLAR_ECLIPSE_TIER_NONE &&
      nextSolarEclipse.visibleInView &&
      !nextSolarEclipse.eventWindowActive &&
      toastDistance <= SOLAR_ECLIPSE_TOAST_DISTANCE_FACTOR
    );
  
    if (
      shouldShowEarlyToast &&
      !solarEclipseEventState.toastShownForCurrentEvent
    ) {
      showSolarEclipseToast(nextSolarEclipse);
    }
  
    if (
      nextSolarEclipse.eventWindowJustClosed ||
      nextSolarEclipse.eclipseTier === SOLAR_ECLIPSE_TIER_NONE ||
      !nextSolarEclipse.visibleInView ||
      (
        !nextSolarEclipse.eventWindowActive &&
        toastDistance > SOLAR_ECLIPSE_TOAST_DISTANCE_FACTOR
      )
    ) {
      solarEclipseEventState.toastShownForCurrentEvent = false;
    }
  
    if (solarEclipseEventState.toastActive && nowMs >= solarEclipseEventState.toastDismissAtMs) {
      hideSolarEclipseToast();
    }
  }
  
  function syncFullTrailVisibility() {
    const visible = celestialControlState.showFullTrail && !walkerState.enabled;
    sunFullTrail.visible = visible;
    sunFullTrailPointsCloud.visible = visible;
    moonFullTrail.visible = visible;
    moonFullTrailPointsCloud.visible = visible;
  }
  
  i18n.subscribe(() => {
    applyStaticTranslations();
    syncSolarEclipseToastContent();
    syncSeasonalEventButtonLabels();
    celestialTrackingCameraApi.refreshLocalizedUi?.();
    textureApi.refreshLocalizedUi?.();
    astronomyApi.refreshLocalizedUi?.();
    magneticFieldApi.refreshLocalizedUi?.();
    walkerApi.refreshLocalizedUi?.(getCurrentUiSnapshot());
    routeSimulationApi.refreshLocalizedUi?.();
    syncPreparationPresentation();
  });
  
  const tempPreparationLookTarget = new THREE.Vector3();
  const tempObserverNorthAxis = new THREE.Vector3();
  const tempObserverEastAxis = new THREE.Vector3();
  const tempObserverSkyOrigin = new THREE.Vector3();
  const tempObserverSkyPoint = new THREE.Vector3();
  const tempObserverRelative = new THREE.Vector3();
  const tempDemoSunSourceWorld = new THREE.Vector3();
  const tempDemoMoonSourceWorld = new THREE.Vector3();
  const tempDemoDarkSunSourceWorld = new THREE.Vector3();
  const tempDomeSunLocalPosition = new THREE.Vector3();
  const tempSunWorldPosition = new THREE.Vector3();
  const tempDarkSunWorldPosition = new THREE.Vector3();
  const tempSunViewDirection = new THREE.Vector3();
  const tempCameraForward = new THREE.Vector3();
  const tempCameraRight = new THREE.Vector3();
  const tempProjectedCenter = new THREE.Vector3();
  const tempProjectedEdge = new THREE.Vector3();
  const tempProjectedOffset = new THREE.Vector3();
  const tempBodyWorldScale = new THREE.Vector3();
  const tempProjectedSunNdc = new THREE.Vector3();
  const tempProjectedDarkSunNdc = new THREE.Vector3();
  const tempDarkSunPhaseOrigin = new THREE.Vector3();
  const tempSunPhaseDirection = new THREE.Vector3();
  const tempDarkSunPhaseDirection = new THREE.Vector3();
  const tempProjectedTargetWorld = new THREE.Vector3();
  const tempDarkSunLocalPosition = new THREE.Vector3();
  const tempDarkSunRawOffsetNdc = new THREE.Vector2();
  const tempDarkSunDesiredOffsetNdc = new THREE.Vector2();
  const tempDarkSunMaskViewport = new THREE.Vector2(1, 1);
  const tempSolarEclipseViewport = new THREE.Vector2(1, 1);
  const tempSolarEclipseMaskCenterNdc = new THREE.Vector2();
  const tempSolarEclipseDirectionNdc = new THREE.Vector2();
  
  function createDarkSunOcclusionMotionState() {
    return {
      initialized: false,
      lastDirection: new THREE.Vector2(1, 0),
      offsetNdc: new THREE.Vector2()
    };
  }
  
  const darkSunOcclusionState = {
    observer: createDarkSunOcclusionMotionState(),
    orbit: createDarkSunOcclusionMotionState()
  };
  
  function resetDarkSunOcclusionMotion(motionState) {
    motionState.initialized = false;
    motionState.lastDirection.set(1, 0);
    motionState.offsetNdc.set(0, 0);
  }
  
  function getWorldBodyRadius(body, baseRadius) {
    body.getWorldScale(tempBodyWorldScale);
    return baseRadius * Math.max(tempBodyWorldScale.x, tempBodyWorldScale.y, tempBodyWorldScale.z);
  }
  
  function getProjectedDisc(worldPosition, worldRadius) {
    tempProjectedCenter.copy(worldPosition).project(camera);
    tempProjectedOffset.copy(worldPosition).applyMatrix4(camera.matrixWorldInverse);
    if (!Number.isFinite(tempProjectedCenter.x) || tempProjectedOffset.z >= -0.0001) {
      return {
        centerX: tempProjectedCenter.x,
        centerY: tempProjectedCenter.y,
        radius: 0,
        visible: false
      };
    }
  
    camera.matrixWorld.extractBasis(tempCameraRight, tempProjectedOffset, tempCameraForward);
    tempCameraRight.normalize();
    tempProjectedEdge.copy(worldPosition)
      .addScaledVector(tempCameraRight, worldRadius)
      .project(camera);
  
    const radius = Math.hypot(
      tempProjectedEdge.x - tempProjectedCenter.x,
      tempProjectedEdge.y - tempProjectedCenter.y
    );
    const visible = (
      radius > 0.00001 &&
      tempProjectedCenter.z >= -1.1 &&
      tempProjectedCenter.z <= 1.1 &&
      Math.abs(tempProjectedCenter.x) <= 1.25 &&
      Math.abs(tempProjectedCenter.y) <= 1.25
    );
  
    return {
      centerX: tempProjectedCenter.x,
      centerY: tempProjectedCenter.y,
      radius,
      visible
    };
  }
  
  function getExpandedProjectedDisc(disc, marginPx = 0, viewportWidth = 1) {
    if (!disc) {
      return {
        centerX: 0,
        centerY: 0,
        radius: 0,
        visible: false
      };
    }
  
    const safeViewportWidth = Math.max(viewportWidth, 1);
    const expandedRadius = Math.max(
      0,
      disc.radius + ((Math.max(marginPx, 0) / safeViewportWidth) * 2)
    );
  
    return {
      centerX: disc.centerX,
      centerY: disc.centerY,
      radius: expandedRadius,
      visible: disc.visible
    };
  }
  
  function getSolarEclipseTriggerSunDisc(sunDisc, viewportWidth = 1) {
    const safeViewportWidth = Math.max(viewportWidth, 1);
    const sunRadiusPx = Math.max((sunDisc?.radius ?? 0) * safeViewportWidth * 0.5, 0);
    const triggerMarginPx = Math.max(
      SOLAR_ECLIPSE_TRIGGER_MARGIN_PX,
      sunRadiusPx * SOLAR_ECLIPSE_TRIGGER_MARGIN_FACTOR
    );
    return getExpandedProjectedDisc(sunDisc, triggerMarginPx, safeViewportWidth);
  }
  
  function usesSolarEclipsePresentationMask(stageKey = "idle") {
    return ["partialIngress", "partialEgress", "totality"].includes(stageKey);
  }
  
  function getCircleOverlapCoverage(radiusA, radiusB, distance) {
    if (radiusA <= 0) {
      return 0;
    }
  
    return THREE.MathUtils.clamp(
      getCircleOverlapArea(radiusA, radiusB, distance) / (Math.PI * radiusA * radiusA),
      0,
      1
    );
  }
  
  function getCircleDistanceForCoverage(radiusA, radiusB, targetCoverage) {
    const normalizedCoverage = THREE.MathUtils.clamp(targetCoverage, 0, 1);
    const fullCoverageDistance = Math.max(radiusB - radiusA, 0);
    const contactDistance = Math.max(radiusA + radiusB, 0);
  
    if (normalizedCoverage <= 0.000001) {
      return contactDistance;
    }
  
    if (normalizedCoverage >= 0.999999) {
      return 0;
    }
  
    const maxFullCoverage = getCircleOverlapCoverage(radiusA, radiusB, fullCoverageDistance);
    if (normalizedCoverage >= (maxFullCoverage - 0.000001)) {
      return fullCoverageDistance;
    }
  
    let nearDistance = fullCoverageDistance;
    let farDistance = contactDistance;
  
    for (let iteration = 0; iteration < 28; iteration += 1) {
      const candidateDistance = (nearDistance + farDistance) * 0.5;
      const candidateCoverage = getCircleOverlapCoverage(radiusA, radiusB, candidateDistance);
  
      if (candidateCoverage >= normalizedCoverage) {
        nearDistance = candidateDistance;
      } else {
        farDistance = candidateDistance;
      }
    }
  
    return (nearDistance + farDistance) * 0.5;
  }
  
  function setGroupWorldPositionFromNdc(group, centerNdc, depthNdc) {
    tempProjectedTargetWorld.set(centerNdc.x, centerNdc.y, depthNdc).unproject(camera);
  
    if (group.parent) {
      tempDarkSunLocalPosition.copy(tempProjectedTargetWorld);
      group.parent.worldToLocal(tempDarkSunLocalPosition);
      group.position.copy(tempDarkSunLocalPosition);
      return;
    }
  
    group.position.copy(tempProjectedTargetWorld);
  }
  
  function syncDarkSunGroupToPresentationDisc({
    baseScale,
    darkSunBody,
    darkSunGroup,
    targetCenterNdc,
    targetRadius
  }) {
    darkSunGroup.scale.copy(baseScale);
    setGroupWorldPositionFromNdc(darkSunGroup, targetCenterNdc, tempProjectedSunNdc.z);
    scene.updateMatrixWorld(true);
    darkSunGroup.getWorldPosition(tempDarkSunWorldPosition);
    const currentDisc = getProjectedDisc(
      tempDarkSunWorldPosition,
      getWorldBodyRadius(darkSunBody, ORBIT_DARK_SUN_SIZE)
    );
  
    if (currentDisc.visible && currentDisc.radius > 0.00001 && targetRadius > 0.00001) {
      darkSunGroup.scale.copy(baseScale).multiplyScalar(targetRadius / currentDisc.radius);
      scene.updateMatrixWorld(true);
    }
  }
  
  function updateSolarEclipsePresentationMaskState(
    solarEclipse,
    sunDisc,
    rawDarkSunDisc
  ) {
    solarEclipsePresentationMaskState.valid = false;
  
    if (
      simulationState.darkSunDebugVisible ||
      !solarEclipse ||
      !usesSolarEclipsePresentationMask(solarEclipse.stageKey) ||
      (solarEclipse.coverage ?? 0) <= 0.000001 ||
      !sunDisc?.visible ||
      !rawDarkSunDisc?.visible ||
      sunDisc.radius <= 0.00001 ||
      rawDarkSunDisc.radius <= 0.00001
    ) {
      return solarEclipsePresentationMaskState;
    }
  
    tempSolarEclipseDirectionNdc.set(
      rawDarkSunDisc.centerX - sunDisc.centerX,
      rawDarkSunDisc.centerY - sunDisc.centerY
    );
  
    if (tempSolarEclipseDirectionNdc.lengthSq() > 0.0000001) {
      tempSolarEclipseDirectionNdc.normalize();
      solarEclipsePresentationMaskState.lastDirectionNdc.copy(tempSolarEclipseDirectionNdc);
    } else if (solarEclipsePresentationMaskState.lastDirectionNdc.lengthSq() <= 0.0000001) {
      solarEclipsePresentationMaskState.lastDirectionNdc.set(
        solarEclipse.direction === "egress" ? 1 : -1,
        0
      );
    }
  
    const targetCenterDistance = getCircleDistanceForCoverage(
      sunDisc.radius,
      rawDarkSunDisc.radius,
      solarEclipse.coverage ?? 0
    );
  
    solarEclipsePresentationMaskState.maskCenterNdc.set(
      sunDisc.centerX + (solarEclipsePresentationMaskState.lastDirectionNdc.x * targetCenterDistance),
      sunDisc.centerY + (solarEclipsePresentationMaskState.lastDirectionNdc.y * targetCenterDistance)
    );
    solarEclipsePresentationMaskState.maskRadius = rawDarkSunDisc.radius;
    solarEclipsePresentationMaskState.valid = true;
    return solarEclipsePresentationMaskState;
  }
  
  function updateDarkSunMaskUniforms(solarEclipse = createSolarEclipseState()) {
    const sunGroup = walkerState.enabled ? observerSun : orbitSun;
    const darkSunGroup = walkerState.enabled ? observerDarkSun : orbitDarkSun;
    const sunBody = walkerState.enabled ? observerSunBody : orbitSunBody;
    const darkSunBody = walkerState.enabled ? observerDarkSunBody : orbitDarkSunBody;
    const baseScale = walkerState.enabled
      ? solarEclipsePresentationMaskState.observerBaseScale
      : solarEclipsePresentationMaskState.orbitBaseScale;
    darkSunGroup.scale.copy(baseScale);
    scene.updateMatrixWorld(true);
    sunGroup.getWorldPosition(tempSunWorldPosition);
    darkSunGroup.getWorldPosition(tempDarkSunWorldPosition);
    const sunDisc = getProjectedDisc(
      tempSunWorldPosition,
      getWorldBodyRadius(sunBody, ORBIT_SUN_SIZE)
    );
    const darkSunDisc = getProjectedDisc(
      tempDarkSunWorldPosition,
      getWorldBodyRadius(darkSunBody, ORBIT_DARK_SUN_SIZE)
    );
    tempProjectedSunNdc.copy(tempSunWorldPosition).project(camera);
    renderer.getDrawingBufferSize(tempDarkSunMaskViewport);
    const visibleDarkSunDisc = darkSunDisc;
    const active = (
      sunDisc.visible &&
      sunDisc.radius > 0.00001 &&
      tempDarkSunMaskViewport.x > 0 &&
      tempDarkSunMaskViewport.y > 0
    ) ? 1 : 0;
    const darkSunMaskActive = simulationState.darkSunDebugVisible ? 0 : active;
    const materials = [
      orbitDarkSunBody.material,
      orbitDarkSunRim.material,
      observerDarkSunBody.material,
      observerDarkSunRim.material
    ];
  
    for (const material of materials) {
      const { darkSunMaskState, darkSunMaskShader } = material.userData;
      if (!darkSunMaskState) {
        continue;
      }
  
      darkSunMaskState.active = darkSunMaskActive;
      darkSunMaskState.centerNdc.set(sunDisc.centerX, sunDisc.centerY);
      darkSunMaskState.radius = sunDisc.radius;
      darkSunMaskState.viewport.copy(tempDarkSunMaskViewport);
  
      if (darkSunMaskShader) {
        darkSunMaskShader.uniforms.darkSunMaskActive.value = darkSunMaskState.active;
        darkSunMaskShader.uniforms.darkSunMaskCenterNdc.value.copy(darkSunMaskState.centerNdc);
        darkSunMaskShader.uniforms.darkSunMaskRadius.value = darkSunMaskState.radius;
        darkSunMaskShader.uniforms.darkSunMaskViewport.value.copy(darkSunMaskState.viewport);
      }
    }
  
    const eclipseMaskActive = (
      visibleDarkSunDisc.visible &&
      visibleDarkSunDisc.radius > 0.00001 &&
      tempDarkSunMaskViewport.x > 0 &&
      tempDarkSunMaskViewport.y > 0
    ) ? 1 : 0;
    const sunMaterials = [
      orbitSunBody.material,
      observerSunBody.material
    ];
  
    for (const material of sunMaterials) {
      const { sunEclipseMaskState, sunEclipseMaskShader } = material.userData;
      if (!sunEclipseMaskState) {
        continue;
      }
  
      sunEclipseMaskState.active = eclipseMaskActive;
      sunEclipseMaskState.centerNdc.set(visibleDarkSunDisc.centerX, visibleDarkSunDisc.centerY);
      sunEclipseMaskState.radius = visibleDarkSunDisc.radius;
      sunEclipseMaskState.viewport.copy(tempDarkSunMaskViewport);
  
      if (sunEclipseMaskShader) {
        sunEclipseMaskShader.uniforms.sunEclipseMaskActive.value = sunEclipseMaskState.active;
        sunEclipseMaskShader.uniforms.sunEclipseMaskCenterNdc.value.copy(sunEclipseMaskState.centerNdc);
        sunEclipseMaskShader.uniforms.sunEclipseMaskRadius.value = sunEclipseMaskState.radius;
        sunEclipseMaskShader.uniforms.sunEclipseMaskViewport.value.copy(sunEclipseMaskState.viewport);
      }
    }
  }
  
  function getCircleOverlapArea(radiusA, radiusB, distance) {
    if (distance >= (radiusA + radiusB)) {
      return 0;
    }
  
    if (distance <= Math.abs(radiusA - radiusB)) {
      const minRadius = Math.min(radiusA, radiusB);
      return Math.PI * minRadius * minRadius;
    }
  
    const radiusASquared = radiusA * radiusA;
    const radiusBSquared = radiusB * radiusB;
    const alpha = Math.acos(
      THREE.MathUtils.clamp(
        ((distance * distance) + radiusASquared - radiusBSquared) / (2 * distance * radiusA),
        -1,
        1
      )
    );
    const beta = Math.acos(
      THREE.MathUtils.clamp(
        ((distance * distance) + radiusBSquared - radiusASquared) / (2 * distance * radiusB),
        -1,
        1
      )
    );
    const overlapCore = 0.5 * Math.sqrt(
      Math.max(
        0,
        (-distance + radiusA + radiusB) *
        (distance + radiusA - radiusB) *
        (distance - radiusA + radiusB) *
        (distance + radiusA + radiusB)
      )
    );
  
    return (radiusASquared * alpha) + (radiusBSquared * beta) - overlapCore;
  }
  
  function applyDarkSunOcclusionAlignment({
    motionState,
    sunBody,
    sunGroup,
    sunRadius,
    darkSunBody,
    darkSunGroup,
    darkSunRadius
  }) {
    sunGroup.getWorldPosition(tempSunWorldPosition);
    darkSunGroup.getWorldPosition(tempDarkSunWorldPosition);
    const sunWorldRadius = getWorldBodyRadius(sunBody, sunRadius);
    const darkSunWorldRadius = getWorldBodyRadius(darkSunBody, darkSunRadius);
  
    const sunDisc = getProjectedDisc(
      tempSunWorldPosition,
      sunWorldRadius
    );
    const darkSunDisc = getProjectedDisc(
      tempDarkSunWorldPosition,
      darkSunWorldRadius
    );
  
    if (!sunDisc.visible || !darkSunDisc.visible || sunDisc.radius <= 0.00001 || darkSunDisc.radius <= 0.00001) {
      resetDarkSunOcclusionMotion(motionState);
      return null;
    }
  
    tempProjectedSunNdc.copy(tempSunWorldPosition).project(camera);
    tempProjectedDarkSunNdc.copy(tempDarkSunWorldPosition).project(camera);
    tempDarkSunRawOffsetNdc.set(
      tempProjectedDarkSunNdc.x - tempProjectedSunNdc.x,
      tempProjectedDarkSunNdc.y - tempProjectedSunNdc.y
    );
  
    const combinedRadius = sunDisc.radius + darkSunDisc.radius;
    tempDarkSunPhaseOrigin.set(0, 0, 0);
    if (walkerState.enabled) {
      tempDarkSunPhaseOrigin.copy(camera.position);
    }
    tempSunPhaseDirection.copy(tempSunWorldPosition).sub(tempDarkSunPhaseOrigin);
    tempDarkSunPhaseDirection.copy(tempDarkSunWorldPosition).sub(tempDarkSunPhaseOrigin);
    const sunPhaseDistance = Math.max(tempSunPhaseDirection.length(), 0.0001);
    const darkSunPhaseDistance = Math.max(tempDarkSunPhaseDirection.length(), 0.0001);
    tempSunPhaseDirection.y = 0;
    tempDarkSunPhaseDirection.y = 0;
    let targetPhaseOffsetX = tempDarkSunRawOffsetNdc.x;
    const sunPlanarLength = tempSunPhaseDirection.length();
    const darkSunPlanarLength = tempDarkSunPhaseDirection.length();
    if (sunPlanarLength > 0.0001 && darkSunPlanarLength > 0.0001) {
      tempSunPhaseDirection.divideScalar(sunPlanarLength);
      tempDarkSunPhaseDirection.divideScalar(darkSunPlanarLength);
      const signedAngleDelta = Math.atan2(
        (tempSunPhaseDirection.x * tempDarkSunPhaseDirection.z) -
          (tempSunPhaseDirection.z * tempDarkSunPhaseDirection.x),
        (tempSunPhaseDirection.x * tempDarkSunPhaseDirection.x) +
          (tempSunPhaseDirection.z * tempDarkSunPhaseDirection.z)
      );
      const contactAngle = Math.max(
        (sunWorldRadius + darkSunWorldRadius) / Math.max((sunPhaseDistance + darkSunPhaseDistance) * 0.5, 0.0001),
        0.00001
      );
      targetPhaseOffsetX = THREE.MathUtils.clamp(
        signedAngleDelta / contactAngle,
        -4,
        4
      ) * combinedRadius;
    }
  
    const phaseDistance = Math.abs(targetPhaseOffsetX);
    if (!motionState.initialized) {
      motionState.initialized = true;
      motionState.offsetNdc.set(targetPhaseOffsetX, 0);
    }
  
    if (phaseDistance > 0.000001) {
      motionState.lastDirection.set(Math.sign(targetPhaseOffsetX) || 1, 0);
    }
  
    const attractionStart = combinedRadius * DARK_SUN_ATTRACTION_START_FACTOR;
    const attractionEnd = combinedRadius * DARK_SUN_ATTRACTION_END_FACTOR;
    const attraction = THREE.MathUtils.clamp(
      1 - ((phaseDistance - attractionEnd) / Math.max(attractionStart - attractionEnd, 0.000001)),
      0,
      1
    );
    const eclipseTransit = THREE.MathUtils.clamp(
      1 - (phaseDistance / Math.max(combinedRadius, 0.000001)),
      0,
      1
    );
    const centerHold = THREE.MathUtils.clamp(
      1 - (phaseDistance / Math.max(combinedRadius * DARK_SUN_CENTER_HOLD_FACTOR, 0.000001)),
      0,
      1
    );
    const transitCompression = THREE.MathUtils.lerp(
      1,
      DARK_SUN_TRANSIT_ALONG_COMPRESSION,
      Math.max(attraction * 0.72, centerHold * 0.58)
    );
    const captureCompression = THREE.MathUtils.lerp(
      1,
      DARK_SUN_TRANSIT_PERPENDICULAR_COMPRESSION,
      Math.pow(attraction, 0.84)
    );
    const centerCompression = THREE.MathUtils.lerp(1, 0.42, centerHold);
    tempDarkSunDesiredOffsetNdc.set(targetPhaseOffsetX, 0).multiplyScalar(
      transitCompression *
      THREE.MathUtils.lerp(1, DARK_SUN_ECLIPSE_TRANSIT_SLOW_FACTOR, eclipseTransit) *
      captureCompression *
      centerCompression
    );
  
    const followResponse = attraction > 0.001
      ? (
        THREE.MathUtils.lerp(0.36, 0.18, centerHold) *
        THREE.MathUtils.lerp(1, DARK_SUN_ECLIPSE_RESPONSE_SLOW_FACTOR, eclipseTransit)
      )
      : DARK_SUN_RELEASE_RESPONSE;
    motionState.offsetNdc.lerp(
      tempDarkSunDesiredOffsetNdc,
      followResponse
    );
    motionState.offsetNdc.y = 0;
  
    if (attraction > 0.9) {
      motionState.offsetNdc.multiplyScalar(
        THREE.MathUtils.lerp(1, DARK_SUN_HOLD_DAMPING, Math.max(centerHold, attraction))
      );
    }
  
    tempProjectedTargetWorld.set(
      tempProjectedSunNdc.x + motionState.offsetNdc.x,
      tempProjectedSunNdc.y + motionState.offsetNdc.y,
      tempProjectedSunNdc.z
    ).unproject(camera);
  
    if (darkSunGroup.parent) {
      tempDarkSunLocalPosition.copy(tempProjectedTargetWorld);
      darkSunGroup.parent.worldToLocal(tempDarkSunLocalPosition);
      darkSunGroup.position.copy(tempDarkSunLocalPosition);
    } else {
      darkSunGroup.position.copy(tempProjectedTargetWorld);
    }
  
    return {
      attraction
    };
  }
  
  function applyDarkSunStageTransitPosition({
    sunBody,
    sunGroup,
    sunRadius,
    darkSunBody,
    darkSunGroup,
    darkSunRadius
  }) {
    sunGroup.getWorldPosition(tempSunWorldPosition);
    darkSunGroup.getWorldPosition(tempDarkSunWorldPosition);
    const sunWorldRadius = getWorldBodyRadius(sunBody, sunRadius);
    const darkSunWorldRadius = getWorldBodyRadius(darkSunBody, darkSunRadius);
    const sunDisc = getProjectedDisc(
      tempSunWorldPosition,
      sunWorldRadius
    );
    const darkSunDisc = getProjectedDisc(
      tempDarkSunWorldPosition,
      darkSunWorldRadius
    );
  
    if (!sunDisc.visible || sunDisc.radius <= 0.00001 || darkSunDisc.radius <= 0.00001) {
      return false;
    }
  
    tempProjectedSunNdc.copy(tempSunWorldPosition).project(camera);
    const transit = THREE.MathUtils.clamp(simulationState.darkSunStageTransit ?? 0, 0, 1);
    const combinedRadius = sunDisc.radius + darkSunDisc.radius;
    renderer.getDrawingBufferSize(tempSolarEclipseViewport);
    const pixelNdcX = 2 / Math.max(tempSolarEclipseViewport.x, 1);
    const approachStartOffsetX = combinedRadius + (pixelNdcX * 6);
    const approachEndOffsetX = combinedRadius + (pixelNdcX * 0.4);
    const egressStartOffsetX = -(combinedRadius + (pixelNdcX * 0.4));
    const completeEndOffsetX = -(combinedRadius + (pixelNdcX * 6));
    const approachEnd = DARK_SUN_STAGE_APPROACH_SHARE;
    const ingressEnd = approachEnd + DARK_SUN_STAGE_INGRESS_SHARE;
    const totalityEnd = ingressEnd + DARK_SUN_STAGE_TOTALITY_SHARE;
    const egressEnd = totalityEnd + DARK_SUN_STAGE_EGRESS_SHARE;
    const easeOutSine = (value) => Math.sin((THREE.MathUtils.clamp(value, 0, 1) * Math.PI) / 2);
    const easeInOutCubic = (value) => {
      const clampedValue = THREE.MathUtils.clamp(value, 0, 1);
      return clampedValue < 0.5
        ? 4 * clampedValue * clampedValue * clampedValue
        : 1 - (Math.pow((-2 * clampedValue) + 2, 3) / 2);
    };
    let targetOffsetX = completeEndOffsetX;
  
    if (transit <= approachEnd) {
      targetOffsetX = THREE.MathUtils.lerp(
        approachStartOffsetX,
        approachEndOffsetX,
        easeOutSine(transit / Math.max(approachEnd, 0.0001))
      );
    } else if (transit <= ingressEnd) {
      targetOffsetX = THREE.MathUtils.lerp(
        approachEndOffsetX,
        0,
        easeInOutCubic((transit - approachEnd) / Math.max(DARK_SUN_STAGE_INGRESS_SHARE, 0.0001))
      );
    } else if (transit <= totalityEnd) {
      targetOffsetX = 0;
    } else if (transit <= egressEnd) {
      targetOffsetX = THREE.MathUtils.lerp(
        0,
        egressStartOffsetX,
        easeInOutCubic((transit - totalityEnd) / Math.max(DARK_SUN_STAGE_EGRESS_SHARE, 0.0001))
      );
    } else {
      targetOffsetX = THREE.MathUtils.lerp(
        egressStartOffsetX,
        completeEndOffsetX,
        easeOutSine((transit - egressEnd) / Math.max(DARK_SUN_STAGE_COMPLETE_SHARE, 0.0001))
      );
    }
  
    tempProjectedTargetWorld.set(
      tempProjectedSunNdc.x + targetOffsetX,
      tempProjectedSunNdc.y,
      tempProjectedSunNdc.z
    ).unproject(camera);
  
    if (darkSunGroup.parent) {
      tempDarkSunLocalPosition.copy(tempProjectedTargetWorld);
      darkSunGroup.parent.worldToLocal(tempDarkSunLocalPosition);
      darkSunGroup.position.copy(tempDarkSunLocalPosition);
    } else {
      darkSunGroup.position.copy(tempProjectedTargetWorld);
    }
  
    return true;
  }
  
  function getSolarEclipseLightScale(solarEclipse = createSolarEclipseState()) {
    return getSolarEclipseVisualProfile(solarEclipse).sunLightScale;
  }
  
  function getSolarEclipsePhaseKey(solarEclipse = createSolarEclipseState()) {
    if (["approach", "partialIngress", "totality", "partialEgress", "complete"].includes(solarEclipse.stageKey)) {
      return solarEclipse.stageKey;
    }
  
    if (solarEclipse.total) {
      return "totality";
    }
  
    if (solarEclipse.active) {
      return solarEclipse.direction === "egress"
        ? "partialEgress"
        : "partialIngress";
    }
  
    if (
      solarEclipse.eclipseTier !== SOLAR_ECLIPSE_TIER_NONE &&
      solarEclipse.visibleInView &&
      !solarEclipse.hasVisibleOverlap &&
      Number.isFinite(solarEclipse.normalizedDistance) &&
      solarEclipse.normalizedDistance <= SOLAR_ECLIPSE_APPROACH_DISTANCE_FACTOR
    ) {
      return "approach";
    }
  
    return "idle";
  }
  
  function getSolarEclipseDirection(previousStageKey, coverageDelta) {
    if (coverageDelta > SOLAR_ECLIPSE_DIRECTION_EPSILON) {
      return "ingress";
    }
    if (coverageDelta < -SOLAR_ECLIPSE_DIRECTION_EPSILON) {
      return "egress";
    }
  
    switch (previousStageKey) {
      case "approach":
      case "partialIngress":
      case "totality":
        return "ingress";
      case "partialEgress":
      case "complete":
        return "egress";
      default:
        return "idle";
    }
  }
  
  function getSolarEclipseStageLabelKey(stageKey) {
    switch (stageKey) {
      case "approach":
        return "solarEclipseStageApproach";
      case "partialIngress":
        return "solarEclipseStagePartialIngress";
      case "totality":
        return "solarEclipseStageTotality";
      case "partialEgress":
        return "solarEclipseStagePartialEgress";
      case "complete":
        return "solarEclipseStageComplete";
      default:
        return "solarEclipseStageIdle";
    }
  }
  
  function getSolarEclipseStageProgress({
    coverage,
    normalizedDistance,
    stageElapsedMs,
    stageKey
  }) {
    switch (stageKey) {
      case "approach":
        return THREE.MathUtils.clamp(
          Math.max(
            stageElapsedMs / Math.max(SOLAR_ECLIPSE_APPROACH_MIN_MS, 1),
            (SOLAR_ECLIPSE_APPROACH_DISTANCE_FACTOR - normalizedDistance) /
              Math.max(SOLAR_ECLIPSE_APPROACH_DISTANCE_FACTOR - 1, 0.0001)
          ),
          0,
          1
        );
      case "partialIngress":
      case "partialEgress":
        return THREE.MathUtils.clamp(
          coverage / Math.max(SOLAR_ECLIPSE_TOTAL_COVERAGE, 0.0001),
          0,
          1
        );
      case "totality":
        return THREE.MathUtils.clamp(
          Math.max(
            stageElapsedMs / Math.max(SOLAR_ECLIPSE_TOTALITY_MIN_MS, 1),
            (coverage - SOLAR_ECLIPSE_TOTAL_COVERAGE) /
              Math.max(1 - SOLAR_ECLIPSE_TOTAL_COVERAGE, 0.0001)
          ),
          0,
          1
        );
      case "complete":
        return THREE.MathUtils.clamp(
          1 - (stageElapsedMs / Math.max(SOLAR_ECLIPSE_COMPLETE_FADE_MS, 1)),
          0,
          1
        );
      default:
        return 0;
    }
  }
  
  function stepValueToward(currentValue, targetValue, maxDelta) {
    if (maxDelta <= 0) {
      return currentValue;
    }
  
    return currentValue + THREE.MathUtils.clamp(
      targetValue - currentValue,
      -maxDelta,
      maxDelta
    );
  }
  
  function easeEclipseLightValue(
    currentValue,
    targetValue,
    stageKey,
    {
      riseBlend = 0.12,
      eclipseRiseBlend = 0.035,
      totalityRiseBlend = 0.008,
      fallBlend = 0.18
    } = {}
  ) {
    const current = Number.isFinite(currentValue) ? currentValue : 0;
    const target = Number.isFinite(targetValue) ? targetValue : 0;
    const blend = target > current
      ? (
        stageKey === "partialEgress"
          ? eclipseRiseBlend
          : stageKey === "totality"
            ? totalityRiseBlend
            : riseBlend
      )
      : fallBlend;
  
    return current + ((target - current) * THREE.MathUtils.clamp(blend, 0, 1));
  }
  
  function getProjectedSolarEclipseMetrics({
    altitudeAligned,
    darkSunDisc,
    sunDisc,
    triggerSunDisc = sunDisc
  }) {
    renderer.getDrawingBufferSize(tempSolarEclipseViewport);
    const viewportWidth = Math.max(tempSolarEclipseViewport.x, 1);
    const viewportHeight = Math.max(tempSolarEclipseViewport.y, 1);
    const deltaX = sunDisc.centerX - darkSunDisc.centerX;
    const deltaY = sunDisc.centerY - darkSunDisc.centerY;
    const centerDistance = Math.hypot(deltaX, deltaY);
    const triggerContactDistance = Math.max(triggerSunDisc.radius + darkSunDisc.radius, 0.0001);
    const normalizedDistance = centerDistance / triggerContactDistance;
    const centerDistancePx = Math.hypot(
      deltaX * viewportWidth * 0.5,
      deltaY * viewportHeight * 0.5
    );
    const sunRadiusPx = sunDisc.radius * viewportWidth * 0.5;
    const triggerSunRadiusPx = triggerSunDisc.radius * viewportWidth * 0.5;
    const darkSunRadiusPx = darkSunDisc.radius * viewportWidth * 0.5;
    const contactDistancePx = Math.max(triggerSunRadiusPx + darkSunRadiusPx, 0.0001);
    const contactDepthPx = contactDistancePx - centerDistancePx;
    const visibleContactDistancePx = Math.max(sunRadiusPx + darkSunRadiusPx, 0.0001);
    const visibleContactDepthPx = visibleContactDistancePx - centerDistancePx;
    const overlapArea = altitudeAligned
      ? getCircleOverlapArea(sunDisc.radius, darkSunDisc.radius, centerDistance)
      : 0;
    const coverage = (
      altitudeAligned && sunDisc.radius > 0
        ? THREE.MathUtils.clamp(overlapArea / (Math.PI * sunDisc.radius * sunDisc.radius), 0, 1)
        : 0
    );
  
    return {
      contactDepthPx,
      coverage,
      normalizedDistance,
      visibleContactDepthPx
    };
  }
  
  function getSolarEclipseLaneCount() {
    return Math.max(magneticFieldApi.getCoilOrbitProfile("sun").turns, 1);
  }
  
  function getSolarEclipseTierCap(eclipseTier = SOLAR_ECLIPSE_TIER_NONE) {
    switch (eclipseTier) {
      case SOLAR_ECLIPSE_TIER_TOTAL:
        return 1;
      case SOLAR_ECLIPSE_TIER_PARTIAL_2:
        return SOLAR_ECLIPSE_PARTIAL_LANE_2_CAP;
      case SOLAR_ECLIPSE_TIER_PARTIAL_3:
        return SOLAR_ECLIPSE_PARTIAL_LANE_3_CAP;
      default:
        return 0;
    }
  }
  
  function getSolarEclipseEligibility(sunRenderState, darkSunRenderState) {
    const sunBandIndex = Number.isFinite(sunRenderState?.bandIndex) ? sunRenderState.bandIndex : null;
    const darkSunBandIndex = Number.isFinite(darkSunRenderState?.bandIndex) ? darkSunRenderState.bandIndex : null;
    const sunLaneIndex = Number.isFinite(sunRenderState?.laneIndex) ? sunRenderState.laneIndex : null;
    const darkSunLaneIndex = Number.isFinite(darkSunRenderState?.laneIndex) ? darkSunRenderState.laneIndex : null;
    const bandDelta = (sunBandIndex === null || darkSunBandIndex === null)
      ? Number.POSITIVE_INFINITY
      : Math.abs(sunBandIndex - darkSunBandIndex);
    const laneDelta = (sunLaneIndex === null || darkSunLaneIndex === null)
      ? Number.POSITIVE_INFINITY
      : Math.abs(sunLaneIndex - darkSunLaneIndex);
    let eclipseTier = SOLAR_ECLIPSE_TIER_NONE;
  
    if (bandDelta === 0) {
      if (laneDelta <= 1) {
        eclipseTier = SOLAR_ECLIPSE_TIER_TOTAL;
      } else if (laneDelta === 2) {
        eclipseTier = SOLAR_ECLIPSE_TIER_PARTIAL_2;
      } else if (laneDelta === 3) {
        eclipseTier = SOLAR_ECLIPSE_TIER_PARTIAL_3;
      }
    }
  
    return {
      bandIndex: darkSunBandIndex ?? sunBandIndex ?? 1,
      bandDelta,
      eclipseTier,
      laneCount: getSolarEclipseLaneCount(),
      laneDelta,
      laneIndex: darkSunLaneIndex ?? sunLaneIndex ?? 0,
      tierCap: getSolarEclipseTierCap(eclipseTier)
    };
  }
  
  function solveSolarEclipseEventWindow(
    rawSolarEclipse = createSolarEclipseState(),
    previousSolverState = createSolarEclipseWindowSolverState(),
    deltaSeconds = 0
  ) {
    const nextRawSolarEclipse = createSolarEclipseState(rawSolarEclipse);
    const deltaMs = Math.max(deltaSeconds, 0) * 1000;
    const coverageStep = SOLAR_ECLIPSE_PRESENTATION_COVERAGE_RATE * Math.max(deltaSeconds, 0);
    let displayCoverage = THREE.MathUtils.clamp(previousSolverState.displayCoverage ?? 0, 0, 1);
    let displayStageElapsedMs = (
      previousSolverState.stageKey === "idle"
        ? 0
        : Math.max(previousSolverState.stageElapsedMs ?? 0, 0) + deltaMs
    );
    let displayStageKey = previousSolverState.stageKey ?? "idle";
    let hasEnteredVisibleOverlap = Boolean(previousSolverState.hasEnteredVisibleOverlap);
    const previousEventWindowActive = Boolean(previousSolverState.eventWindowActive);
  
    if (nextRawSolarEclipse.hasVisibleOverlap) {
      hasEnteredVisibleOverlap = true;
    }
  
    const setStage = (nextStageKey) => {
      if (displayStageKey !== nextStageKey) {
        displayStageKey = nextStageKey;
        displayStageElapsedMs = 0;
      }
    };
    const enterVisibleStage = (nextStageKey) => {
      setStage(nextStageKey);
      displayCoverage = THREE.MathUtils.clamp(
        Math.max(
          nextRawSolarEclipse.rawCoverage,
          nextStageKey === "totality"
            ? SOLAR_ECLIPSE_TOTAL_COVERAGE
            : SOLAR_ECLIPSE_MIN_COVERAGE
        ),
        0,
        1
      );
      hasEnteredVisibleOverlap = true;
    };
  
    if (
      !nextRawSolarEclipse.visibleInView ||
      nextRawSolarEclipse.normalizedDistance > SOLAR_ECLIPSE_IDLE_DISTANCE_FACTOR
    ) {
      if (
        hasEnteredVisibleOverlap &&
        !["idle", "complete"].includes(displayStageKey)
      ) {
        setStage("complete");
        displayCoverage = 0;
      } else if (displayStageKey === "complete" && displayStageElapsedMs < SOLAR_ECLIPSE_COMPLETE_FADE_MS) {
        displayCoverage = 0;
      } else {
        setStage("idle");
        displayCoverage = 0;
        hasEnteredVisibleOverlap = false;
      }
    } else {
      switch (displayStageKey) {
        case "idle":
          displayCoverage = 0;
          if (nextRawSolarEclipse.rawStageKey === "approach") {
            setStage("approach");
          } else if (nextRawSolarEclipse.rawStageKey === "totality") {
            enterVisibleStage("totality");
          } else if (
            nextRawSolarEclipse.hasVisibleOverlap ||
            ["partialIngress", "partialEgress"].includes(nextRawSolarEclipse.rawStageKey)
          ) {
            enterVisibleStage(
              nextRawSolarEclipse.rawStageKey === "partialEgress"
                ? "partialEgress"
                : "partialIngress"
            );
          } else if (nextRawSolarEclipse.rawStageKey === "complete" && hasEnteredVisibleOverlap) {
            setStage("complete");
          }
          break;
        case "approach":
          displayCoverage = 0;
          if (nextRawSolarEclipse.rawStageKey === "idle") {
            setStage("idle");
            hasEnteredVisibleOverlap = false;
          } else if (nextRawSolarEclipse.rawStageKey === "totality") {
            enterVisibleStage("totality");
          } else if (nextRawSolarEclipse.hasVisibleOverlap) {
            enterVisibleStage(
              nextRawSolarEclipse.rawStageKey === "partialEgress"
                ? "partialEgress"
                : "partialIngress"
            );
          }
          break;
        case "partialIngress":
          displayCoverage = stepValueToward(
            displayCoverage,
            Math.max(nextRawSolarEclipse.rawCoverage, displayCoverage),
            coverageStep
          );
          if (!nextRawSolarEclipse.hasVisibleOverlap && hasEnteredVisibleOverlap) {
            if (displayStageElapsedMs >= SOLAR_ECLIPSE_PARTIAL_STAGE_MIN_MS) {
              setStage("partialEgress");
            }
          } else if (
            nextRawSolarEclipse.rawStageKey === "partialEgress" &&
            nextRawSolarEclipse.rawCoverage <= displayCoverage &&
            displayStageElapsedMs >= SOLAR_ECLIPSE_PARTIAL_STAGE_MIN_MS
          ) {
            setStage("partialEgress");
          } else if (
            nextRawSolarEclipse.rawStageKey === "totality" &&
            displayCoverage >= (SOLAR_ECLIPSE_TOTAL_COVERAGE - 0.01) &&
            displayStageElapsedMs >= SOLAR_ECLIPSE_PARTIAL_STAGE_MIN_MS
          ) {
            setStage("totality");
          }
          break;
        case "totality":
          displayCoverage = stepValueToward(
            displayCoverage,
            Math.max(nextRawSolarEclipse.rawCoverage, SOLAR_ECLIPSE_TOTAL_COVERAGE),
            Math.max(coverageStep, 0.015)
          );
          if (
            displayStageElapsedMs >= SOLAR_ECLIPSE_TOTALITY_MIN_MS &&
            ["partialEgress", "complete", "idle"].includes(nextRawSolarEclipse.rawStageKey)
          ) {
            setStage("partialEgress");
          }
          break;
        case "partialEgress":
          displayCoverage = stepValueToward(
            displayCoverage,
            nextRawSolarEclipse.rawCoverage,
            coverageStep
          );
          if (
            nextRawSolarEclipse.rawStageKey === "partialIngress" &&
            nextRawSolarEclipse.rawCoverage > (displayCoverage + 0.001)
          ) {
            setStage("partialIngress");
          } else if (
            !nextRawSolarEclipse.hasVisibleOverlap &&
            displayCoverage <= 0.0005 &&
            displayStageElapsedMs >= SOLAR_ECLIPSE_PARTIAL_STAGE_MIN_MS
          ) {
            setStage("complete");
          }
          break;
        case "complete":
          displayCoverage = 0;
          if (displayStageElapsedMs >= SOLAR_ECLIPSE_COMPLETE_FADE_MS) {
            setStage("idle");
            hasEnteredVisibleOverlap = false;
          }
          break;
        default:
          setStage("idle");
          displayCoverage = 0;
          hasEnteredVisibleOverlap = false;
          break;
      }
    }
  
    if (displayStageKey === "idle") {
      displayCoverage = 0;
      displayStageElapsedMs = 0;
    }
  
    const stageProgress = getSolarEclipseStageProgress({
      coverage: displayCoverage,
      normalizedDistance: nextRawSolarEclipse.normalizedDistance,
      stageElapsedMs: displayStageElapsedMs,
      stageKey: displayStageKey
    });
    const total = displayStageKey === "totality";
    const active = ["partialIngress", "partialEgress", "totality"].includes(displayStageKey);
    const eventWindowActive = displayStageKey !== "idle";
    const eventWindowJustOpened = eventWindowActive && !previousEventWindowActive;
    const eventWindowJustClosed = !eventWindowActive && previousEventWindowActive;
    const lightReduction = active
      ? THREE.MathUtils.clamp(
        total ? Math.max(displayCoverage, 0.82) : displayCoverage,
        0,
        1
      )
      : 0;
    const presentationSolarEclipse = createSolarEclipseState({
      ...nextRawSolarEclipse,
      active,
      total,
      coverage: displayCoverage,
      eventWindowActive,
      eventWindowJustOpened,
      eventWindowJustClosed,
      lightReduction,
      recentlyActive: eventWindowActive,
      stageKey: displayStageKey,
      stageLabelKey: getSolarEclipseStageLabelKey(displayStageKey),
      stageProgress
    });
    const sunlightScale = THREE.MathUtils.clamp(
      getSolarEclipseVisualProfile(presentationSolarEclipse).sunLightScale ?? 1,
      0,
      1
    );
  
    return {
      solarEclipse: createSolarEclipseState({
        ...presentationSolarEclipse,
        lightReduction,
        sunlightScale,
        sunlightPercent: Math.round(sunlightScale * 100)
      }),
      solverState: createSolarEclipseWindowSolverState({
        displayCoverage,
        eventWindowActive,
        hasEnteredVisibleOverlap,
        previousRawCoverage: nextRawSolarEclipse.rawCoverage,
        previousRawStageKey: nextRawSolarEclipse.rawStageKey,
        stageElapsedMs: displayStageElapsedMs,
        stageKey: displayStageKey
      })
    };
  }
  
  function getSolarEclipseVisualProfile(solarEclipse = createSolarEclipseState()) {
    const phaseKey = getSolarEclipsePhaseKey(solarEclipse);
    const coverage = THREE.MathUtils.clamp(solarEclipse.coverage ?? 0, 0, 1);
    const partialStrength = THREE.MathUtils.clamp(
      coverage / Math.max(SOLAR_ECLIPSE_TOTAL_COVERAGE, 0.0001),
      0,
      1
    );
    const partialVisualStrength = partialStrength;
    const profile = {
      aureoleOpacityScale: 1,
      aureoleScaleFactor: 1,
      coronaOpacityScale: 1,
      coronaScaleFactor: 1,
      darkSunBodyOpacity: 0,
      darkSunRimOpacity: 0,
      environmentLightScale: 1,
      pulseSuppression: 0,
      sunBodyScale: 1,
      sunEclipseMaskStrength: 0,
      sunHaloScale: 1,
      sunLightScale: 1,
      sunRayScale: 1
    };
  
    if (phaseKey === "partialIngress") {
      profile.darkSunBodyOpacity = ORBIT_DARK_SUN_OCCLUSION_OPACITY;
      profile.darkSunRimOpacity = THREE.MathUtils.lerp(
        ORBIT_DARK_SUN_RIM_OPACITY * 0.9,
        ORBIT_DARK_SUN_RIM_OPACITY * 0.32,
        partialVisualStrength
      );
      profile.environmentLightScale = THREE.MathUtils.lerp(0.72, 0.42, partialVisualStrength);
      profile.pulseSuppression = THREE.MathUtils.lerp(0.45, 0.96, partialVisualStrength);
      profile.sunBodyScale = 1;
      profile.sunEclipseMaskStrength = 1;
      profile.sunHaloScale = THREE.MathUtils.lerp(0.08, 0.004, partialVisualStrength);
      profile.sunLightScale = THREE.MathUtils.lerp(0.24, 0.025, partialVisualStrength);
      profile.coronaOpacityScale = THREE.MathUtils.lerp(0.34, 1.1, partialVisualStrength);
      profile.aureoleOpacityScale = THREE.MathUtils.lerp(0.12, 0.48, partialVisualStrength);
      profile.coronaScaleFactor = THREE.MathUtils.lerp(0.98, 1.08, partialVisualStrength);
      profile.aureoleScaleFactor = THREE.MathUtils.lerp(0.92, 1.02, partialVisualStrength);
      profile.sunRayScale = THREE.MathUtils.lerp(0.06, 0, partialVisualStrength);
      return profile;
    }
  
    if (phaseKey === "partialEgress") {
      const recoveryProgress = THREE.MathUtils.clamp(1 - partialStrength, 0, 1);
      const environmentRecoveryStrength = Math.pow(recoveryProgress, 1.9);
      const recoveryStrength = Math.pow(recoveryProgress, 3.4);
      const lateRecoveryStrength = Math.pow(recoveryProgress, 4.1);
      profile.darkSunBodyOpacity = ORBIT_DARK_SUN_OCCLUSION_OPACITY;
      profile.darkSunRimOpacity = THREE.MathUtils.lerp(
        ORBIT_DARK_SUN_RIM_OPACITY * 0.06,
        ORBIT_DARK_SUN_RIM_OPACITY * 0.9,
        recoveryStrength
      );
      profile.environmentLightScale = THREE.MathUtils.lerp(0.26, 1, environmentRecoveryStrength);
      profile.pulseSuppression = THREE.MathUtils.lerp(1, 0, Math.pow(recoveryProgress, 2.25));
      profile.sunBodyScale = 1;
      profile.sunEclipseMaskStrength = 1;
      profile.sunHaloScale = THREE.MathUtils.lerp(0.003, 0.92, lateRecoveryStrength);
      profile.sunLightScale = THREE.MathUtils.lerp(0.012, 1, Math.pow(recoveryProgress, 2.95));
      profile.coronaOpacityScale = THREE.MathUtils.lerp(1.1, 0.4, Math.pow(recoveryProgress, 2.2));
      profile.aureoleOpacityScale = THREE.MathUtils.lerp(0.48, 0.18, Math.pow(recoveryProgress, 2.4));
      profile.coronaScaleFactor = THREE.MathUtils.lerp(1.08, 1, Math.pow(recoveryProgress, 2.4));
      profile.aureoleScaleFactor = THREE.MathUtils.lerp(1.02, 0.94, Math.pow(recoveryProgress, 2.6));
      profile.sunRayScale = THREE.MathUtils.lerp(0, 0.14, Math.pow(recoveryProgress, 4.5));
      return profile;
    }
  
    if (phaseKey === "totality") {
      profile.darkSunBodyOpacity = ORBIT_DARK_SUN_OCCLUSION_OPACITY;
      profile.darkSunRimOpacity = ORBIT_DARK_SUN_RIM_OPACITY * 0.08;
      profile.environmentLightScale = 0.26;
      profile.pulseSuppression = 1;
      profile.sunBodyScale = 1;
      profile.sunEclipseMaskStrength = 1;
      profile.sunHaloScale = 0.003;
      profile.sunLightScale = 0.012;
      profile.coronaOpacityScale = 1.32;
      profile.aureoleOpacityScale = 0.76;
      profile.coronaScaleFactor = 1.08;
      profile.aureoleScaleFactor = 1.02;
      profile.sunRayScale = 0;
      return profile;
    }
  
    return profile;
  }
  
  function syncDarkSunPresentation(solarEclipse = createSolarEclipseState()) {
    const visualProfile = getSolarEclipseVisualProfile(solarEclipse);
    const debugVisible = Boolean(simulationState.darkSunDebugVisible);
    const eclipseVisible = Boolean(
      solarEclipse.visibleInView &&
      solarEclipse.active
    );
    const showDarkSun = debugVisible || eclipseVisible;
    const bodyOpacity = debugVisible
      ? ORBIT_DARK_SUN_DEBUG_OPACITY
      : (eclipseVisible ? visualProfile.darkSunBodyOpacity : 0);
    const rimOpacity = debugVisible
      ? ORBIT_DARK_SUN_DEBUG_RIM_OPACITY
      : (eclipseVisible ? visualProfile.darkSunRimOpacity : 0);
  
    orbitDarkSun.visible = !walkerState.enabled && showDarkSun;
    observerDarkSun.visible = walkerState.enabled && showDarkSun;
    orbitDarkSunBody.material.color.setHex(debugVisible ? ORBIT_DARK_SUN_DEBUG_COLOR : ORBIT_DARK_SUN_BODY_COLOR);
    observerDarkSunBody.material.color.setHex(debugVisible ? ORBIT_DARK_SUN_DEBUG_COLOR : ORBIT_DARK_SUN_BODY_COLOR);
    orbitDarkSunRim.material.color.setHex(debugVisible ? ORBIT_DARK_SUN_DEBUG_RIM_COLOR : ORBIT_DARK_SUN_RIM_COLOR);
    observerDarkSunRim.material.color.setHex(debugVisible ? ORBIT_DARK_SUN_DEBUG_RIM_COLOR : ORBIT_DARK_SUN_RIM_COLOR);
    orbitDarkSunBody.material.opacity = bodyOpacity;
    observerDarkSunBody.material.opacity = bodyOpacity;
    orbitDarkSunRim.material.opacity = rimOpacity;
    observerDarkSunRim.material.opacity = rimOpacity;
  
    const eclipseMaskStrength = (
      !debugVisible &&
      solarEclipse.visibleInView &&
      solarEclipse.active
    ) ? 1 : 0;
    const sunMaterials = [
      orbitSunBody.material,
      observerSunBody.material
    ];
  
    for (const material of sunMaterials) {
      const { sunEclipseMaskState, sunEclipseMaskShader } = material.userData;
      if (!sunEclipseMaskState) {
        continue;
      }
  
      sunEclipseMaskState.strength = eclipseMaskStrength;
  
      if (sunEclipseMaskShader) {
        sunEclipseMaskShader.uniforms.sunEclipseMaskStrength.value = sunEclipseMaskState.strength;
      }
    }
  }
  
  function evaluateSolarEclipse(snapshot, deltaSeconds = 0) {
    if (!snapshot) {
      return createSolarEclipseState();
    }
  
    const sunGroup = walkerState.enabled ? observerSun : orbitSun;
    const darkSunGroup = walkerState.enabled ? observerDarkSun : orbitDarkSun;
    const sunBody = walkerState.enabled ? observerSunBody : orbitSunBody;
    const darkSunBody = walkerState.enabled ? observerDarkSunBody : orbitDarkSunBody;
    const sunSceneVisible = walkerState.enabled ? observerSun.visible : true;
    const sunRenderState = snapshot.sunRenderState ?? null;
    const darkSunRenderState = snapshot.darkSunRenderState ?? null;
  
    sunGroup.getWorldPosition(tempSunWorldPosition);
    darkSunGroup.getWorldPosition(tempDarkSunWorldPosition);
  
    const sunDisc = getProjectedDisc(
      tempSunWorldPosition,
      getWorldBodyRadius(sunBody, ORBIT_SUN_SIZE)
    );
    const darkSunDisc = getProjectedDisc(
      tempDarkSunWorldPosition,
      getWorldBodyRadius(darkSunBody, ORBIT_DARK_SUN_SIZE)
    );
    renderer.getDrawingBufferSize(tempSolarEclipseViewport);
    const triggerSunDisc = getSolarEclipseTriggerSunDisc(
      sunDisc,
      Math.max(tempSolarEclipseViewport.x, 1)
    );
    const visibleInView = sunSceneVisible && sunDisc.visible && darkSunDisc.visible;
    const altitudeDelta = Math.abs(sunDisc.centerY - darkSunDisc.centerY);
    const altitudeTolerance = Math.max(
      0.0005,
      triggerSunDisc.radius * DARK_SUN_ALTITUDE_ALIGNMENT_TOLERANCE_FACTOR
    );
    const altitudeAligned = visibleInView && altitudeDelta <= altitudeTolerance;
    const eligibility = getSolarEclipseEligibility(sunRenderState, darkSunRenderState);
    const eligibleForEclipse = eligibility.eclipseTier !== SOLAR_ECLIPSE_TIER_NONE;
    const approachAligned = eligibleForEclipse && visibleInView && altitudeDelta <= (altitudeTolerance * 1.75);
    const eclipseMetrics = getProjectedSolarEclipseMetrics({
      altitudeAligned,
      darkSunDisc,
      sunDisc,
      triggerSunDisc
    });
    const projectionCoverage = eclipseMetrics.coverage;
    const effectiveCoverage = eligibleForEclipse
      ? Math.min(projectionCoverage, eligibility.tierCap)
      : 0;
    const { contactDepthPx, normalizedDistance, visibleContactDepthPx } = eclipseMetrics;
    const previousRawCoverage = solarEclipseWindowSolverState.previousRawCoverage ?? 0;
    const previousRawStageKey = solarEclipseWindowSolverState.previousRawStageKey ?? "idle";
    const coverageDelta = effectiveCoverage - previousRawCoverage;
    const direction = getSolarEclipseDirection(previousRawStageKey, coverageDelta);
    const hasContact = (
      eligibleForEclipse &&
      altitudeAligned &&
      visibleInView &&
      contactDepthPx >= SOLAR_ECLIPSE_CONTACT_START_PX
    );
    const hasVisibleOverlap = (
      eligibleForEclipse &&
      altitudeAligned &&
      visibleContactDepthPx >= SOLAR_ECLIPSE_VISIBLE_CONTACT_PX &&
      effectiveCoverage >= SOLAR_ECLIPSE_MIN_COVERAGE
    );
    const active = hasVisibleOverlap;
    const total = (
      active &&
      eligibility.eclipseTier === SOLAR_ECLIPSE_TIER_TOTAL &&
      effectiveCoverage >= SOLAR_ECLIPSE_TOTAL_COVERAGE &&
      darkSunDisc.radius >= sunDisc.radius
    );
    let rawStageKey = "idle";
  
    if (!visibleInView || normalizedDistance > SOLAR_ECLIPSE_IDLE_DISTANCE_FACTOR) {
    } else if (total) {
      rawStageKey = "totality";
    } else if (active) {
      rawStageKey = direction === "egress" ? "partialEgress" : "partialIngress";
    } else if (
      approachAligned &&
      !hasVisibleOverlap &&
      normalizedDistance <= SOLAR_ECLIPSE_APPROACH_DISTANCE_FACTOR
    ) {
      rawStageKey = "approach";
    }
  
    const sunlightScale = THREE.MathUtils.clamp(
      getSolarEclipseVisualProfile({
        active,
        coverage: effectiveCoverage,
        direction,
        eclipseTier: eligibility.eclipseTier,
        hasVisibleOverlap,
        normalizedDistance,
        total,
        visibleInView
      }).sunLightScale ?? 1,
      0,
      1
    );
    const rawSolarEclipse = createSolarEclipseState({
      active,
      total,
      bandDelta: eligibility.bandDelta,
      bandIndex: eligibility.bandIndex,
      coverage: effectiveCoverage,
      eclipseTier: eligibility.eclipseTier,
      projectionCoverage,
      rawCoverage: effectiveCoverage,
      direction,
      hasContact,
      hasVisibleOverlap,
      contactDepthPx,
      laneDelta: eligibility.laneDelta,
      laneIndex: eligibility.laneIndex,
      lightReduction: THREE.MathUtils.clamp(1 - sunlightScale, 0, 1),
      normalizedDistance,
      rawStageKey,
      stageKey: rawStageKey,
      stageLabelKey: getSolarEclipseStageLabelKey(rawStageKey),
      stageProgress: active ? effectiveCoverage : 0,
      sunlightScale,
      sunlightPercent: Math.round(sunlightScale * 100),
      visibleInView,
      recentlyActive: rawStageKey !== "idle"
    });
    const solvedSolarEclipse = solveSolarEclipseEventWindow(
      rawSolarEclipse,
      solarEclipseWindowSolverState,
      deltaSeconds
    );
  
    Object.assign(solarEclipseWindowSolverState, solvedSolarEclipse.solverState);
  
    if (simulationState.darkSunStageAltitudeLock) {
      if (solvedSolarEclipse.solarEclipse.active) {
        simulationState.darkSunStageHasEclipsed = true;
      } else if (
        simulationState.darkSunStageHasEclipsed &&
        normalizedDistance > SOLAR_ECLIPSE_IDLE_DISTANCE_FACTOR
      ) {
        simulationState.darkSunStageAltitudeLock = false;
        simulationState.darkSunStageHasEclipsed = false;
      }
    }
    snapshot.solarEclipse = solvedSolarEclipse.solarEclipse;
    astronomyApi.syncSolarEclipseUi(snapshot.solarEclipse);
    syncDarkSunPresentation(snapshot.solarEclipse);
    return snapshot.solarEclipse;
  }
  
  function getProjectedSolarEclipseMetricsFromStates(
    sunRenderState,
    darkSunRenderState,
    {
      trackCandidateSun = false
    } = {}
  ) {
    const previousSunPosition = orbitSun.position.clone();
    const previousDarkSunPosition = orbitDarkSun.position.clone();
  
    orbitSun.position.copy(sunRenderState.position);
    orbitDarkSun.position.copy(darkSunRenderState.position);
    scene.updateMatrixWorld(true);
    if (trackCandidateSun) {
      celestialTrackingCameraApi.update();
      cameraApi.updateCamera();
    }
    orbitSun.getWorldPosition(tempSunWorldPosition);
    orbitDarkSun.getWorldPosition(tempDarkSunWorldPosition);
  
    const sunDisc = getProjectedDisc(
      tempSunWorldPosition,
      getWorldBodyRadius(orbitSunBody, ORBIT_SUN_SIZE)
    );
    const darkSunDisc = getProjectedDisc(
      tempDarkSunWorldPosition,
      getWorldBodyRadius(orbitDarkSunBody, ORBIT_DARK_SUN_SIZE)
    );
    renderer.getDrawingBufferSize(tempSolarEclipseViewport);
    const triggerSunDisc = getSolarEclipseTriggerSunDisc(
      sunDisc,
      Math.max(tempSolarEclipseViewport.x, 1)
    );
    const visibleInView = sunDisc.visible && darkSunDisc.visible;
    const altitudeDelta = Math.abs(sunDisc.centerY - darkSunDisc.centerY);
    const altitudeTolerance = Math.max(
      0.0005,
      triggerSunDisc.radius * DARK_SUN_ALTITUDE_ALIGNMENT_TOLERANCE_FACTOR
    );
    const altitudeAligned = visibleInView && altitudeDelta <= altitudeTolerance;
    const eligibility = getSolarEclipseEligibility(sunRenderState, darkSunRenderState);
    const metrics = getProjectedSolarEclipseMetrics({
      altitudeAligned,
      darkSunDisc,
      sunDisc,
      triggerSunDisc
    });
    const effectiveCoverage = eligibility.eclipseTier === SOLAR_ECLIPSE_TIER_NONE
      ? 0
      : Math.min(metrics.coverage, eligibility.tierCap);
    const eligibleForEclipse = eligibility.eclipseTier !== SOLAR_ECLIPSE_TIER_NONE;
    const approachAligned = eligibleForEclipse && visibleInView && altitudeDelta <= (altitudeTolerance * 1.75);
    const hasContact = (
      eligibleForEclipse &&
      altitudeAligned &&
      visibleInView &&
      metrics.contactDepthPx >= SOLAR_ECLIPSE_CONTACT_START_PX
    );
    const hasApproachWindow = (
      approachAligned &&
      !hasContact &&
      metrics.normalizedDistance <= SOLAR_ECLIPSE_APPROACH_DISTANCE_FACTOR
    );
  
    orbitSun.position.copy(previousSunPosition);
    orbitDarkSun.position.copy(previousDarkSunPosition);
    scene.updateMatrixWorld(true);
    if (trackCandidateSun) {
      celestialTrackingCameraApi.update();
      cameraApi.updateCamera();
    }
    return {
      approachAligned,
      contactDepthPx: metrics.contactDepthPx,
      coverage: effectiveCoverage,
      eclipseTier: eligibility.eclipseTier,
      hasApproachWindow,
      hasContact,
      hasVisibleOverlap: (
        eligibleForEclipse &&
        altitudeAligned &&
        metrics.visibleContactDepthPx >= SOLAR_ECLIPSE_VISIBLE_CONTACT_PX &&
        effectiveCoverage >= SOLAR_ECLIPSE_MIN_COVERAGE
      ),
      laneDelta: eligibility.laneDelta,
      normalizedDistance: metrics.normalizedDistance,
      projectionCoverage: metrics.coverage,
      tierCap: eligibility.tierCap,
      visibleInView
    };
  }
  
  function getNaturalPreEclipseCandidateScore(eclipseMetrics) {
    if (!eclipseMetrics) {
      return Number.POSITIVE_INFINITY;
    }
  
    if (eclipseMetrics.hasApproachWindow) {
      return Math.abs(
        (eclipseMetrics.normalizedDistance ?? SOLAR_ECLIPSE_APPROACH_DISTANCE_FACTOR) -
        DARK_SUN_STAGE_PRE_ECLIPSE_DISTANCE_FACTOR
      );
    }
  
    const preContactPenalty = eclipseMetrics.hasVisibleOverlap ? 2 : (eclipseMetrics.hasContact ? 1 : 0);
    return (preContactPenalty * 1000) + Math.abs(SOLAR_ECLIPSE_VISIBLE_CONTACT_PX - eclipseMetrics.contactDepthPx);
  }
  
  function getNaturalPreEclipseVisibleOverlapScore(eclipseMetrics, frameIndex = 0) {
    if (!eclipseMetrics?.hasVisibleOverlap) {
      return Number.POSITIVE_INFINITY;
    }
  
    const coverage = THREE.MathUtils.clamp(eclipseMetrics.coverage ?? 0, 0, 1);
    const coverageError = Math.abs(coverage - STAGE_PRE_ECLIPSE_TARGET_VISIBLE_COVERAGE);
    const overshootPenalty = Math.max(0, coverage - STAGE_PRE_ECLIPSE_TARGET_VISIBLE_COVERAGE);
    const contactDepthError = Math.abs(
      (eclipseMetrics.contactDepthPx ?? SOLAR_ECLIPSE_VISIBLE_CONTACT_PX) -
      SOLAR_ECLIPSE_VISIBLE_CONTACT_PX
    );
  
    return (
      (coverageError * 3200) +
      (overshootPenalty * 4800) +
      (contactDepthError * 16) +
      (frameIndex * 0.01)
    );
  }
  
  function getWrappedAngularDistance(angleA = 0, angleB = 0) {
    return Math.abs(Math.atan2(
      Math.sin(angleA - angleB),
      Math.cos(angleA - angleB)
    ));
  }
  
  function getNaturalPreEclipseOrbitAlignmentScore(sunRenderState, darkSunRenderState) {
    return getWrappedAngularDistance(
      darkSunRenderState?.orbitAngleRadians ?? 0,
      sunRenderState?.orbitAngleRadians ?? 0
    );
  }
  
  function getAdvancedBandState(progress, direction, step) {
    const nextState = {
      direction: direction ?? 1,
      progress: progress ?? 0.5
    };
    let nextProgress = nextState.progress + (step * nextState.direction);
  
    if (nextProgress >= 1) {
      nextProgress = 1;
      nextState.direction = -1;
    } else if (nextProgress <= 0) {
      nextProgress = 0;
      nextState.direction = 1;
    }
  
    nextState.progress = nextProgress;
    return nextState;
  }
  
  function inferStageSunBandDirection(sourceDate, currentSunRenderState) {
    if (!astronomyState.enabled || !sourceDate || !astronomyApi) {
      return simulationState.sunBandDirection ?? 1;
    }
  
    const sampleSnapshot = astronomyApi.getAstronomySnapshot(
      new Date(sourceDate.getTime() + (12 * 60 * 60 * 1000))
    );
    const currentProgress = currentSunRenderState?.corridorProgress ?? currentSunRenderState?.macroProgress ?? 0.5;
    const sampleProgress = sampleSnapshot?.sunRenderState?.corridorProgress ?? currentProgress;
  
    if (Math.abs(sampleProgress - currentProgress) <= 0.0001) {
      return 1;
    }
  
    return sampleProgress >= currentProgress ? 1 : -1;
  }
  
  function findNaturalPreEclipseState({
    phaseOffsetRadians,
    sunAngleRadians,
    sunDirection,
    sunProgress
  }) {
    const bandStep = getBodyBandProgressStep("sun");
    const tierPriority = [
      SOLAR_ECLIPSE_TIER_TOTAL,
      SOLAR_ECLIPSE_TIER_PARTIAL_2,
      SOLAR_ECLIPSE_TIER_PARTIAL_3
    ];
  
    for (const desiredTier of tierPriority) {
      let searchSunAngle = sunAngleRadians;
      let searchSunDirection = sunDirection;
      let searchSunProgress = sunProgress;
      let bestApproachCandidate = null;
      let bestPreContact = null;
      let bestVisibleOverlapCandidate = null;
      let bestTierCandidate = null;
  
      for (let frameIndex = 1; frameIndex <= STAGE_PRE_ECLIPSE_SEARCH_MAX_FRAMES; frameIndex += 1) {
        searchSunAngle += ORBIT_SUN_SPEED;
        const nextBandState = getAdvancedBandState(searchSunProgress, searchSunDirection, bandStep);
        searchSunProgress = nextBandState.progress;
        searchSunDirection = nextBandState.direction;
  
        const nextSunRenderState = astronomyApi.getSunRenderState({
          orbitAngleRadians: searchSunAngle,
          orbitMode: "auto",
          progress: searchSunProgress,
          source: "demo"
        });
        const nextDarkSunRenderState = astronomyApi.getDarkSunRenderState({
          orbitMode: "auto",
          phaseOffsetRadians,
          source: "demo",
          sunDirection: searchSunDirection,
          sunOrbitAngleRadians: searchSunAngle,
          sunProgress: searchSunProgress
        });
        const eclipseMetrics = getProjectedSolarEclipseMetricsFromStates(
          nextSunRenderState,
          nextDarkSunRenderState,
          {
            trackCandidateSun: true
          }
        );
  
        if (eclipseMetrics.eclipseTier !== desiredTier || !eclipseMetrics.visibleInView) {
          if (eclipseMetrics.eclipseTier === desiredTier) {
            const score = getNaturalPreEclipseOrbitAlignmentScore(
              nextSunRenderState,
              nextDarkSunRenderState
            );
            if (!bestTierCandidate || score < bestTierCandidate.score) {
              bestTierCandidate = {
                darkSunRenderState: nextDarkSunRenderState,
                eclipseMetrics,
                score,
                sunAngleRadians: searchSunAngle,
                sunDirection: searchSunDirection,
                sunProgress: searchSunProgress,
                sunRenderState: nextSunRenderState
              };
            }
          }
          continue;
        }
  
        if (eclipseMetrics.hasApproachWindow) {
          const score = getNaturalPreEclipseCandidateScore(eclipseMetrics);
          if (!bestApproachCandidate || score < bestApproachCandidate.score) {
            bestApproachCandidate = {
              darkSunRenderState: nextDarkSunRenderState,
              eclipseMetrics,
              score,
              sunAngleRadians: searchSunAngle,
              sunDirection: searchSunDirection,
              sunProgress: searchSunProgress,
              sunRenderState: nextSunRenderState
            };
          }
          continue;
        }
  
        if (!eclipseMetrics.hasVisibleOverlap) {
          const score = getNaturalPreEclipseCandidateScore(eclipseMetrics);
          if (!bestPreContact || score < bestPreContact.score) {
            bestPreContact = {
              darkSunRenderState: nextDarkSunRenderState,
              eclipseMetrics,
              score,
              sunAngleRadians: searchSunAngle,
              sunDirection: searchSunDirection,
              sunProgress: searchSunProgress,
              sunRenderState: nextSunRenderState
            };
          }
          continue;
        }
  
        const score = getNaturalPreEclipseVisibleOverlapScore(eclipseMetrics, frameIndex);
        if (!bestVisibleOverlapCandidate || score < bestVisibleOverlapCandidate.score) {
          bestVisibleOverlapCandidate = {
            darkSunRenderState: nextDarkSunRenderState,
            eclipseMetrics,
            score,
            sunAngleRadians: searchSunAngle,
            sunDirection: searchSunDirection,
            sunProgress: searchSunProgress,
            sunRenderState: nextSunRenderState
          };
        }
  
        if ((eclipseMetrics.coverage ?? 0) >= STAGE_PRE_ECLIPSE_MAX_START_COVERAGE) {
          return bestVisibleOverlapCandidate;
        }
      }
  
      if (bestVisibleOverlapCandidate) {
        return bestVisibleOverlapCandidate;
      }
  
      if (bestPreContact) {
        return bestPreContact;
      }
  
      if (bestApproachCandidate) {
        return bestApproachCandidate;
      }
  
      if (bestTierCandidate) {
        return bestTierCandidate;
      }
    }
  
    return null;
  }
  
  function findNaturalPreEclipseAngleState({
    eclipseTier,
    phaseOffsetRadians,
    seedSunAngleRadians,
    sunDirection,
    sunProgress
  }) {
    const searchRangeRadians = Math.max(
      ORBIT_SUN_SPEED * STAGE_PRE_ECLIPSE_REFINEMENT_FRAMES,
      0.12
    );
    let bestApproachCandidate = null;
    let bestPreContactCandidate = null;
    let bestVisibleOverlapCandidate = null;
    let searchStart = seedSunAngleRadians - searchRangeRadians;
    let searchEnd = seedSunAngleRadians + searchRangeRadians;
  
    for (let passIndex = 0; passIndex < 3; passIndex += 1) {
      const sampleCount = passIndex === 0 ? 36 : 24;
      let refinementPivot = null;
  
      for (let sampleIndex = 0; sampleIndex <= sampleCount; sampleIndex += 1) {
        const sampleProgress = sampleIndex / Math.max(sampleCount, 1);
        const candidateSunAngle = THREE.MathUtils.lerp(
          searchStart,
          searchEnd,
          sampleProgress
        );
        const candidateSunRenderState = astronomyApi.getSunRenderState({
          orbitAngleRadians: candidateSunAngle,
          orbitMode: "auto",
          progress: sunProgress,
          source: "demo"
        });
        const mirroredCandidate = findMirroredDarkSunStageStartCandidate({
          phaseOffsetRadians,
          sunDirection,
          sunProgress,
          sunRenderState: candidateSunRenderState,
          targetVisibleCoverage: STAGE_PRE_ECLIPSE_TARGET_VISIBLE_COVERAGE,
          trackCandidateSun: true
        });
        const eclipseMetrics = mirroredCandidate?.eclipseMetrics;
  
        if (eclipseMetrics?.eclipseTier !== eclipseTier || !eclipseMetrics?.visibleInView) {
          continue;
        }
  
        const anglePenalty = getWrappedAngularDistance(candidateSunAngle, seedSunAngleRadians) * 24;
        const candidateBase = {
          darkSunRenderState: mirroredCandidate.darkSunRenderState,
          eclipseMetrics,
          sunAngleRadians: candidateSunAngle,
          sunDirection,
          sunProgress,
          sunRenderState: candidateSunRenderState
        };
  
        if (eclipseMetrics.hasVisibleOverlap) {
          const score = getNaturalPreEclipseVisibleOverlapScore(eclipseMetrics, 0) + anglePenalty;
          if (!bestVisibleOverlapCandidate || score < bestVisibleOverlapCandidate.score) {
            bestVisibleOverlapCandidate = {
              ...candidateBase,
              score
            };
          }
          refinementPivot = bestVisibleOverlapCandidate;
          continue;
        }
  
        if (eclipseMetrics.hasApproachWindow) {
          const score = getNaturalPreEclipseCandidateScore(eclipseMetrics) + anglePenalty;
          if (!bestApproachCandidate || score < bestApproachCandidate.score) {
            bestApproachCandidate = {
              ...candidateBase,
              score
            };
          }
          if (!refinementPivot) {
            refinementPivot = bestApproachCandidate;
          }
          continue;
        }
  
        const score = getNaturalPreEclipseCandidateScore(eclipseMetrics) + anglePenalty;
        if (!bestPreContactCandidate || score < bestPreContactCandidate.score) {
          bestPreContactCandidate = {
            ...candidateBase,
            score
          };
        }
        if (!refinementPivot) {
          refinementPivot = bestPreContactCandidate;
        }
      }
  
      const nextPivot = bestVisibleOverlapCandidate ?? refinementPivot ?? bestPreContactCandidate ?? bestApproachCandidate;
      if (!nextPivot) {
        break;
      }
  
      const refinementSpan = Math.max(
        (searchEnd - searchStart) / Math.max(sampleCount, 1),
        ORBIT_SUN_SPEED * 24
      );
      searchStart = nextPivot.sunAngleRadians - (refinementSpan * 3);
      searchEnd = nextPivot.sunAngleRadians + (refinementSpan * 3);
    }
  
    return bestVisibleOverlapCandidate ?? bestPreContactCandidate ?? bestApproachCandidate ?? null;
  }
  
  function findNaturalPreEclipseAngleStateLegacy({
    eclipseTier,
    phaseOffsetRadians,
    seedSunAngleRadians,
    sunDirection,
    sunProgress
  }) {
    let bestCandidate = null;
  
    for (let stepIndex = 0; stepIndex < 180; stepIndex += 1) {
      const localProgress = stepIndex / 179;
      const candidateSunAngle = THREE.MathUtils.lerp(
        seedSunAngleRadians - 0.18,
        seedSunAngleRadians + 0.18,
        localProgress
      );
      const candidateSunRenderState = astronomyApi.getSunRenderState({
        orbitAngleRadians: candidateSunAngle,
        orbitMode: "auto",
        progress: sunProgress,
        source: "demo"
      });
      const candidateDarkSunRenderState = astronomyApi.getDarkSunRenderState({
        orbitMode: "auto",
        phaseOffsetRadians,
        source: "demo",
        sunDirection,
        sunOrbitAngleRadians: candidateSunAngle,
        sunProgress
      });
      const eclipseMetrics = getProjectedSolarEclipseMetricsFromStates(
        candidateSunRenderState,
        candidateDarkSunRenderState,
        {
          trackCandidateSun: true
        }
      );
  
      if (eclipseMetrics.eclipseTier !== eclipseTier || !eclipseMetrics.visibleInView) {
        continue;
      }
  
      const score = getNaturalPreEclipseCandidateScore(eclipseMetrics);
      if (!bestCandidate || score < bestCandidate.score) {
        bestCandidate = {
          darkSunRenderState: candidateDarkSunRenderState,
          eclipseMetrics,
          score,
          sunAngleRadians: candidateSunAngle,
          sunDirection,
          sunProgress,
          sunRenderState: candidateSunRenderState
        };
      }
    }
  
    return bestCandidate;
  }
  
  function resetDarkSunStageState() {
    simulationState.darkSunStageAltitudeLock = false;
    simulationState.darkSunStageHasEclipsed = false;
    simulationState.darkSunStageOffsetRadians = 0;
    simulationState.darkSunStageTotalityHoldMs = 0;
    simulationState.darkSunStageTransit = 0;
    Object.assign(solarEclipseWindowSolverState, createSolarEclipseWindowSolverState());
    solarEclipsePresentationMaskState.valid = false;
    solarEclipsePresentationMaskState.maskCenterNdc.set(0, 0);
    solarEclipsePresentationMaskState.maskRadius = 0;
    solarEclipsePresentationMaskState.lastDirectionNdc.set(1, 0);
    solarEclipseEventState.animationSpeedFactor = 1;
    solarEclipseEventState.currentState = createSolarEclipseState();
    solarEclipseEventState.framesUntilWindowStart = Number.POSITIVE_INFINITY;
    solarEclipseEventState.slowWindowActive = false;
    solarEclipseEventState.toastShownForCurrentEvent = false;
    hideSolarEclipseToast();
  }
  
  function stagePreEclipseScene() {
    if (walkerState.enabled || renderState.preparing) {
      exitFirstPersonMode();
    }
  
    if (astronomyState.enabled) {
      realitySyncEl.checked = false;
      realityLiveEl.checked = false;
      astronomyApi.disableRealityMode();
    }
  
    celestialTrackingCameraApi.setTarget("sun");
    cameraApi.updateCamera();
  
    const activeSnapshot = getCurrentUiSnapshot();
    const sourceDate = activeSnapshot?.date ?? new Date();
    const activeSunRenderState = activeSnapshot?.sunRenderState ?? null;
    const activeDarkSunRenderState = activeSnapshot?.darkSunRenderState ?? null;
    const sunAngleRadians = activeSunRenderState?.orbitAngleRadians ?? Math.atan2(orbitSun.position.z, -orbitSun.position.x);
    const sunProgress = activeSunRenderState?.corridorProgress ?? activeSunRenderState?.macroProgress ?? simulationState.sunBandProgress ?? 0.5;
    const sunDirection = astronomyState.enabled
      ? inferStageSunBandDirection(sourceDate, activeSunRenderState)
      : (simulationState.sunBandDirection ?? 1);
    const phaseOffsetRadians = Number.isFinite(activeDarkSunRenderState?.orbitAngleRadians)
      ? (
        activeDarkSunRenderState.orbitAngleRadians +
        (sunAngleRadians * (ORBIT_DARK_SUN_SPEED / Math.max(ORBIT_SUN_SPEED, 0.0001)))
      )
      : (simulationState.darkSunOrbitPhaseOffsetRadians ?? Math.PI);
    const naturalCandidate = findNaturalPreEclipseState({
      phaseOffsetRadians,
      sunAngleRadians,
      sunDirection,
      sunProgress
    });
    const refinedCandidate = naturalCandidate
      ? findNaturalPreEclipseAngleState({
        eclipseTier: naturalCandidate.eclipseMetrics?.eclipseTier ?? SOLAR_ECLIPSE_TIER_TOTAL,
        phaseOffsetRadians,
        seedSunAngleRadians: naturalCandidate.sunAngleRadians,
        sunDirection: naturalCandidate.sunDirection ?? sunDirection,
        sunProgress: naturalCandidate.sunProgress ?? sunProgress
      })
      : null;
    const preEclipseCandidate = refinedCandidate ?? naturalCandidate;
  
    if (!preEclipseCandidate?.sunRenderState) {
      return;
  return {
    createSolarEclipseWindowSolverState,
    getCurrentDarkSunRenderStateSnapshot,
    getDarkSunStageContactOffsetRadians,
    getProjectedDarkSunStageMetricsForOffsetRadians,
    getProjectedDarkSunStageMetricsForMirroredPhaseOffsetRadians,
    findDarkSunStagePreContactOffsetRadians,
    findMirroredDarkSunStageStartCandidate,
    getDarkSunStageRelativeOrbitOffsetRadians,
    updateDarkSunStageOrbit,
    getCurrentUiSnapshot,
    getSolarEclipseToastStateLabelKey,
    syncSolarEclipseToastContent,
    setSolarEclipseToastVisibility,
    hideSolarEclipseToast,
    showSolarEclipseToast,
    predictUpcomingSolarEclipseWindowStartFrameCount,
    getSolarEclipseAnimationTargetFactor,
    updateSolarEclipseAnimationPacing,
    updateSolarEclipseEventFeedback,
    syncFullTrailVisibility,
    createDarkSunOcclusionMotionState,
    resetDarkSunOcclusionMotion,
    getWorldBodyRadius,
    getProjectedDisc,
    getExpandedProjectedDisc,
    getSolarEclipseTriggerSunDisc,
    usesSolarEclipsePresentationMask,
    getCircleOverlapCoverage,
    getCircleDistanceForCoverage,
    setGroupWorldPositionFromNdc,
    syncDarkSunGroupToPresentationDisc,
    updateSolarEclipsePresentationMaskState,
    updateDarkSunMaskUniforms,
    getCircleOverlapArea,
    applyDarkSunOcclusionAlignment,
    applyDarkSunStageTransitPosition,
    getSolarEclipseLightScale,
    getSolarEclipsePhaseKey,
    getSolarEclipseDirection,
    getSolarEclipseStageLabelKey,
    getSolarEclipseStageProgress,
    stepValueToward,
    easeEclipseLightValue,
    getProjectedSolarEclipseMetrics,
    getSolarEclipseLaneCount,
    getSolarEclipseTierCap,
    getSolarEclipseEligibility,
    solveSolarEclipseEventWindow,
    getSolarEclipseVisualProfile,
    syncDarkSunPresentation,
    evaluateSolarEclipse,
    getProjectedSolarEclipseMetricsFromStates,
    getNaturalPreEclipseCandidateScore,
    getNaturalPreEclipseVisibleOverlapScore,
    getWrappedAngularDistance,
    getNaturalPreEclipseOrbitAlignmentScore,
    getAdvancedBandState,
    inferStageSunBandDirection,
    findNaturalPreEclipseState,
    findNaturalPreEclipseAngleState,
    findNaturalPreEclipseAngleStateLegacy,
    resetDarkSunStageState,
    stagePreEclipseScene,
    solarEclipseWindowSolverState,
    solarEclipseEventState,
    solarEclipsePresentationMaskState,
    tempPreparationLookTarget,
    tempObserverNorthAxis,
    tempObserverEastAxis,
    tempObserverSkyOrigin,
    tempObserverSkyPoint,
    tempObserverRelative,
    tempDemoSunSourceWorld,
    tempDemoMoonSourceWorld,
    tempDemoDarkSunSourceWorld,
    tempDomeSunLocalPosition,
    tempSunWorldPosition,
    tempDarkSunWorldPosition,
    tempSunViewDirection,
    tempCameraForward,
    tempCameraRight,
    tempProjectedCenter,
    tempProjectedEdge,
    tempProjectedOffset,
    tempBodyWorldScale,
    tempProjectedSunNdc,
    tempProjectedDarkSunNdc,
    tempDarkSunPhaseOrigin,
    tempSunPhaseDirection,
    tempDarkSunPhaseDirection,
    tempProjectedTargetWorld,
    tempDarkSunLocalPosition,
    tempDarkSunRawOffsetNdc,
    tempDarkSunDesiredOffsetNdc,
    tempDarkSunMaskViewport,
    tempSolarEclipseViewport,
    tempSolarEclipseMaskCenterNdc,
    tempSolarEclipseDirectionNdc,
    darkSunOcclusionState
  };
}
