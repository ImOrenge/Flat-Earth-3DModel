import * as THREE from "../vendor/three.module.js";
import { createSolarEclipseState } from "./astronomy-utils.js?v=20260320-reality-eclipse-sync1";

export function createCelestialVisualsController(deps) {
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
    orbitSunAureole,
    orbitSunCorona,
    orbitMoonBody,
    orbitMoonHalo,
    orbitMoonCoolGlow,
    orbitMoonCorona,
    orbitMoonAureole,
    orbitMoonWarmFringe,
    orbitMoonLight,
    observerMoonBody,
    scene,
    firstPersonScene,
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
    movementState,
    astronomyApi,
    walkerApi,
    ambient,
    keyLight,
    rimLight,
    renderer,
    firstPersonPrepEl,
    firstPersonPrepTitleEl,
    firstPersonPrepCopyEl,
    firstPersonPrepBarFillEl,
    firstPersonPrepProgressEl,
    resetDarkSunOcclusionMotion,
    darkSunOcclusionState,
    getSolarAltitudeFactor,
    setMoonMaterialPhase,
    tempPreparationLookTarget,
    stopDrag,
    easeEclipseLightValue,
    getSolarEclipsePhaseKey,
    getSolarEclipseVisualProfile,
    getSolarEclipseLightScale,
    observerSunHalo,
    observerSunLight,
    orbitSunLight,
    tempSunWorldPosition,
    tempDomeSunLocalPosition,
    tempObserverNorthAxis,
    tempObserverEastAxis,
    tempObserverSkyOrigin,
    tempObserverSkyPoint,
    tempObserverRelative,
    sunFullTrail,
    celestialControlState,
    sunFullTrailPointsCloud,
    sunTrail,
    sunTrailPointsCloud,
    moonFullTrail,
    moonFullTrailPointsCloud,
    moonTrail,
    moonTrailPointsCloud,
    getGeoFromProjectedPosition,
    tempDemoSunSourceWorld,
    tempDemoDarkSunSourceWorld,
    tempDemoMoonSourceWorld,
    tempSunViewDirection,
    tempCameraForward,
    observerSunBody,
    observerMoonHalo,
    observerMoonCoolGlow,
    observerMoonCorona,
    observerMoonAureole,
    observerMoonWarmFringe,
    observerMoonLight,
    observerMoon,
    orbitMoon,
    observerDarkSunBody,
    observerDarkSunRim
  } = deps;

  const {
    FOG_DEFAULT_FAR,
    FOG_DEFAULT_NEAR,
    FOG_WALKER_FAR,
    FOG_WALKER_NEAR,
    FIRST_PERSON_PREP_DURATION_MS,
    FIRST_PERSON_RETURN_DURATION_MS,
    FIRST_PERSON_STAGE_SCALE,
    TOPDOWN_STAGE_SCALE,
    ORBIT_SUN_PULSE_SPEED,
    ORBIT_SUN_CORONA_SCALE,
    ORBIT_SUN_AUREOLE_SCALE,
    ORBIT_MOON_PULSE_SPEED,
    ORBIT_MOON_AUREOLE_OPACITY,
    ORBIT_MOON_AUREOLE_SCALE,
    ORBIT_MOON_BODY_EMISSIVE_INTENSITY,
    ORBIT_MOON_CORONA_OPACITY,
    ORBIT_MOON_CORONA_SCALE,
    ORBIT_MOON_HALO_OPACITY,
    ORBIT_MOON_LIGHT_INTENSITY,
    ORBIT_MOON_WARM_FRINGE_OPACITY,
    ORBIT_MOON_WARM_FRINGE_SCALE,
    ORBIT_MOON_EMISSIVE_COLOR_DAY,
    ORBIT_MOON_EMISSIVE_COLOR_NIGHT,
    ORBIT_MOON_HALO_COLOR_DAY,
    ORBIT_MOON_HALO_COLOR_NIGHT,
    ORBIT_MOON_LIGHT_COLOR_DAY,
    ORBIT_MOON_LIGHT_COLOR_NIGHT,
    ORBIT_MOON_COOL_GLOW_COLOR,
    FIRST_PERSON_CELESTIAL_FAR_RADIUS,
    FIRST_PERSON_CELESTIAL_NEAR_RADIUS,
    CELESTIAL_ALTITUDE_DROP_DEGREES,
    WALKER_EYE_HEIGHT,
    ORBIT_SUN_BODY_EMISSIVE_INTENSITY,
    ORBIT_SUN_HALO_OPACITY,
    ORBIT_SUN_LIGHT_INTENSITY,
    ORBIT_SUN_CORONA_OPACITY,
    ORBIT_SUN_AUREOLE_OPACITY,
    FIRST_PERSON_CELESTIAL_FADE_RANGE,
    FIRST_PERSON_SUN_SCALE,
    ORBIT_DARK_SUN_SIZE,
    ORBIT_SUN_SIZE,
    FIRST_PERSON_MOON_SCALE,
    ORBIT_DARK_SUN_DEBUG_OPACITY,
    ORBIT_DARK_SUN_DEBUG_RIM_OPACITY,
    ORBIT_DARK_SUN_RIM_OPACITY,
    FIRST_PERSON_SUN_RAY_ALIGNMENT_START,
    FIRST_PERSON_SUN_RAY_ALIGNMENT_END,
    MOON_TEXTURE_FLIP_LATITUDE_RANGE,
    scaleDimension
  } = constants;

  function updateSunVisualEffects(snapshot) {
    const pulse = 0.5 + (Math.sin(performance.now() * ORBIT_SUN_PULSE_SPEED) * 0.5);
    const solarEclipse = snapshot?.solarEclipse ?? createSolarEclipseState();
    const phaseKey = getSolarEclipsePhaseKey(solarEclipse);
    const visualProfile = getSolarEclipseVisualProfile(solarEclipse);
    const sunlightScale = THREE.MathUtils.clamp(
      solarEclipse.sunlightScale ?? visualProfile.sunLightScale ?? 1,
      0,
      1
    );
    const pulseSuppression = THREE.MathUtils.clamp(visualProfile.pulseSuppression ?? 0, 0, 1);
    const sunlightPulseResponse = Math.pow(sunlightScale, 0.6);
    const combinedPulseSuppression = THREE.MathUtils.clamp(
      Math.max(pulseSuppression, 1 - sunlightPulseResponse),
      0,
      1
    );
    const coronaLightResponse = Math.pow(sunlightScale, 0.72);
    const aureoleLightResponse = Math.pow(sunlightScale, 0.82);
    const coronaOpacityLightScale = THREE.MathUtils.lerp(0.03, 1, coronaLightResponse);
    const aureoleOpacityLightScale = THREE.MathUtils.lerp(0.05, 1, aureoleLightResponse);
    const coronaScaleLightScale = THREE.MathUtils.lerp(0.74, 1, Math.pow(sunlightScale, 0.92));
    const aureoleScaleLightScale = THREE.MathUtils.lerp(0.78, 1, Math.pow(sunlightScale, 0.96));
    const bodyScale = THREE.MathUtils.lerp(
      THREE.MathUtils.lerp(0.96, 1.2, pulse),
      1,
      combinedPulseSuppression
    );
    const haloScale = THREE.MathUtils.lerp(
      THREE.MathUtils.lerp(0.84, 1.34, pulse),
      1,
      combinedPulseSuppression
    );
    const lightScale = THREE.MathUtils.lerp(
      THREE.MathUtils.lerp(0.94, 1.14, pulse),
      1,
      combinedPulseSuppression
    );
    const coronaOpacityPulseScale = THREE.MathUtils.lerp(
      THREE.MathUtils.lerp(0.88, 1.18, pulse),
      1,
      combinedPulseSuppression
    );
    const aureoleOpacityPulseScale = THREE.MathUtils.lerp(
      THREE.MathUtils.lerp(0.82, 1.24, pulse),
      1,
      combinedPulseSuppression
    );
    const coronaScalePulseScale = THREE.MathUtils.lerp(
      THREE.MathUtils.lerp(0.94, 1.08, pulse),
      1,
      combinedPulseSuppression
    );
    const aureoleScalePulseScale = THREE.MathUtils.lerp(
      THREE.MathUtils.lerp(0.96, 1.12, pulse),
      1,
      combinedPulseSuppression
    );
    const domePulse = THREE.MathUtils.lerp(pulse, 0.5, combinedPulseSuppression);
    const eclipseLightScale = getSolarEclipseLightScale(solarEclipse);
    const topDownLightScale = visualProfile.environmentLightScale;
  
    if (walkerState.enabled) {
      observerSunBody.material.emissiveIntensity *= bodyScale * visualProfile.sunBodyScale;
      observerSunHalo.material.opacity *= haloScale * visualProfile.sunHaloScale;
      observerSunLight.intensity *= lightScale * eclipseLightScale;
    } else {
      const orbitSunBodyTarget = ORBIT_SUN_BODY_EMISSIVE_INTENSITY * bodyScale * visualProfile.sunBodyScale;
      const orbitSunHaloTarget = ORBIT_SUN_HALO_OPACITY * haloScale * visualProfile.sunHaloScale;
      const orbitSunLightTarget = ORBIT_SUN_LIGHT_INTENSITY * lightScale * eclipseLightScale;
      const orbitSunCoronaTarget = ORBIT_SUN_CORONA_OPACITY *
        coronaOpacityPulseScale *
        visualProfile.coronaOpacityScale *
        coronaOpacityLightScale;
      const orbitSunAureoleTarget = ORBIT_SUN_AUREOLE_OPACITY *
        aureoleOpacityPulseScale *
        visualProfile.aureoleOpacityScale *
        aureoleOpacityLightScale;
      orbitSunBody.material.emissiveIntensity = easeEclipseLightValue(
        orbitSunBody.material.emissiveIntensity,
        orbitSunBodyTarget,
        phaseKey,
        { riseBlend: 0.16, eclipseRiseBlend: 0.06, totalityRiseBlend: 0.01, fallBlend: 0.24 }
      );
      orbitSunHalo.material.opacity = easeEclipseLightValue(
        orbitSunHalo.material.opacity,
        orbitSunHaloTarget,
        phaseKey,
        { riseBlend: 0.14, eclipseRiseBlend: 0.028, totalityRiseBlend: 0.006, fallBlend: 0.22 }
      );
      orbitSunLight.intensity = easeEclipseLightValue(
        orbitSunLight.intensity,
        orbitSunLightTarget,
        phaseKey,
        { riseBlend: 0.16, eclipseRiseBlend: 0.024, totalityRiseBlend: 0.004, fallBlend: 0.24 }
      );
      orbitSunCorona.material.opacity = easeEclipseLightValue(
        orbitSunCorona.material.opacity,
        orbitSunCoronaTarget,
        phaseKey,
        { riseBlend: 0.12, eclipseRiseBlend: 0.03, totalityRiseBlend: 0.008, fallBlend: 0.18 }
      );
      orbitSunAureole.material.opacity = easeEclipseLightValue(
        orbitSunAureole.material.opacity,
        orbitSunAureoleTarget,
        phaseKey,
        { riseBlend: 0.12, eclipseRiseBlend: 0.03, totalityRiseBlend: 0.008, fallBlend: 0.18 }
      );
      orbitSunCorona.scale.setScalar(
        ORBIT_SUN_CORONA_SCALE *
        coronaScalePulseScale *
        visualProfile.coronaScaleFactor *
        coronaScaleLightScale
      );
      orbitSunAureole.scale.setScalar(
        ORBIT_SUN_AUREOLE_SCALE *
        aureoleScalePulseScale *
        visualProfile.aureoleScaleFactor *
        aureoleScaleLightScale
      );
      orbitSunAureole.material.rotation += 0.0016;
    }
  
    ambient.intensity = easeEclipseLightValue(
      ambient.intensity,
      0.9 * topDownLightScale,
      phaseKey,
      { riseBlend: 0.12, eclipseRiseBlend: 0.026, totalityRiseBlend: 0.006, fallBlend: 0.16 }
    );
    keyLight.intensity = easeEclipseLightValue(
      keyLight.intensity,
      1.35 * topDownLightScale,
      phaseKey,
      { riseBlend: 0.12, eclipseRiseBlend: 0.024, totalityRiseBlend: 0.006, fallBlend: 0.16 }
    );
    rimLight.intensity = easeEclipseLightValue(
      rimLight.intensity,
      0.42 * topDownLightScale,
      phaseKey,
      { riseBlend: 0.12, eclipseRiseBlend: 0.024, totalityRiseBlend: 0.006, fallBlend: 0.16 }
    );
  
    if (walkerState.enabled && firstPersonSunRayGroup.visible) {
      if (visualProfile.sunRayScale <= 0.05) {
        firstPersonSunRayGroup.visible = false;
        for (const rayMesh of firstPersonSunRayMeshes) {
          rayMesh.material.opacity = 0;
        }
      } else {
        for (const rayMesh of firstPersonSunRayMeshes) {
          rayMesh.material.opacity *= visualProfile.sunRayScale;
        }
      }
    }
  
    orbitSun.getWorldPosition(tempSunWorldPosition);
    tempDomeSunLocalPosition.copy(tempSunWorldPosition);
    dome.worldToLocal(tempDomeSunLocalPosition);
    if (dome.material.userData.shader) {
      dome.material.userData.shader.uniforms.sunLocalPosition.value.copy(tempDomeSunLocalPosition);
      dome.material.userData.shader.uniforms.sunPulse.value = domePulse;
    }
  }
  
  function syncPreparationPresentation() {
    if (!renderState.preparing) {
      firstPersonPrepEl.classList.remove("active");
      firstPersonPrepEl.setAttribute("aria-hidden", "true");
      firstPersonPrepBarFillEl.style.width = "0%";
      firstPersonPrepProgressEl.textContent = "";
      return;
    }
  
    const elapsedMs = performance.now() - renderState.prepStartedAtMs;
    const timelineProgress = THREE.MathUtils.clamp(elapsedMs / renderState.transitionDurationMs, 0, 1);
    const displayProgress = renderState.compileReady
      ? timelineProgress
      : Math.min(timelineProgress, 0.88);
    let title = i18n.t("prepTitlePreparingObserver");
    let copy = i18n.t("prepCopyPreparingObserver");
  
    if (displayProgress >= 0.72 && !renderState.compileReady) {
      title = i18n.t("prepTitleCompilingShaders");
      copy = i18n.t("prepCopyCompilingShaders");
    } else if (displayProgress >= 0.42) {
      title = i18n.t("prepTitleShiftingAtmosphere");
      copy = i18n.t("prepCopyShiftingAtmosphere");
    }
  
    if (renderState.compileReady && displayProgress >= 0.92) {
      title = i18n.t("prepTitleLockingCamera");
      copy = i18n.t("prepCopyLockingCamera");
    }
  
    renderState.progress = displayProgress;
    firstPersonPrepEl.classList.add("active");
    firstPersonPrepEl.setAttribute("aria-hidden", "false");
    firstPersonPrepTitleEl.textContent = title;
    firstPersonPrepCopyEl.textContent = copy;
    firstPersonPrepBarFillEl.style.width = `${Math.round(displayProgress * 100)}%`;
    firstPersonPrepProgressEl.textContent = `${Math.round(displayProgress * 100)}%`;
  }
  
  function updateRenderState() {
    renderState.stageScale += (renderState.targetStageScale - renderState.stageScale) * 0.08;
    renderState.visualScale += (renderState.targetVisualScale - renderState.visualScale) * 0.08;
    firstPersonScene.fog.near += (renderState.targetFogNear - firstPersonScene.fog.near) * 0.08;
    firstPersonScene.fog.far += (renderState.targetFogFar - firstPersonScene.fog.far) * 0.08;
    stage.scale.setScalar(renderState.stageScale);
    scalableStage.scale.setScalar(renderState.visualScale);
  }
  
  function getObserverSkyAxes(observerPosition, observerLongitudeDegrees) {
    const planarLength = Math.hypot(observerPosition.x, observerPosition.z);
  
    if (planarLength > 0.0001) {
      tempObserverNorthAxis.set(-observerPosition.x / planarLength, 0, -observerPosition.z / planarLength);
      tempObserverEastAxis.set(-tempObserverNorthAxis.z, 0, tempObserverNorthAxis.x);
      return;
    }
  
    const longitudeRadians = observerLongitudeDegrees * Math.PI / 180;
    tempObserverNorthAxis.set(Math.cos(longitudeRadians), 0, -Math.sin(longitudeRadians));
    tempObserverEastAxis.set(Math.sin(longitudeRadians), 0, Math.cos(longitudeRadians));
  }
  
  function getObserverSkyDistance(altitudeDegrees) {
    const altitudeFactor = THREE.MathUtils.clamp((altitudeDegrees + 2) / 92, 0, 1);
    return THREE.MathUtils.lerp(
      FIRST_PERSON_CELESTIAL_FAR_RADIUS,
      FIRST_PERSON_CELESTIAL_NEAR_RADIUS,
      altitudeFactor
    );
  }
  
  function applyCelestialAltitudeOffset(horizontal) {
    const altitudeDegrees = THREE.MathUtils.clamp(
      horizontal.altitudeDegrees - CELESTIAL_ALTITUDE_DROP_DEGREES,
      -89.9,
      89.9
    );
  
    return {
      ...horizontal,
      altitudeDegrees,
      altitudeRadians: THREE.MathUtils.degToRad(altitudeDegrees)
    };
  }
  
  function positionBodyInObserverSky(body, horizontal, observerGeo) {
    const skyDistance = getObserverSkyDistance(horizontal.altitudeDegrees);
    const horizontalRadius = Math.cos(horizontal.altitudeRadians) * skyDistance;
  
    getObserverSkyAxes(walkerState.position, observerGeo.longitudeDegrees);
    tempObserverSkyOrigin.set(
      walkerState.position.x * renderState.visualScale,
      constants.WALKER_EYE_HEIGHT,
      walkerState.position.z * renderState.visualScale
    );
    tempObserverSkyPoint.copy(tempObserverSkyOrigin)
      .addScaledVector(tempObserverNorthAxis, horizontalRadius * Math.cos(horizontal.azimuthRadians))
      .addScaledVector(tempObserverEastAxis, horizontalRadius * Math.sin(horizontal.azimuthRadians))
      .addScaledVector(THREE.Object3D.DEFAULT_UP, Math.sin(horizontal.altitudeRadians) * skyDistance);
  
    body.position.copy(tempObserverSkyPoint);
  }
  
  function getHorizontalFromWorldPosition(sourceWorldPosition, observerGeo) {
    getObserverSkyAxes(walkerState.position, observerGeo.longitudeDegrees);
    tempObserverSkyOrigin.set(
      walkerState.position.x * renderState.visualScale,
      constants.WALKER_EYE_HEIGHT,
      walkerState.position.z * renderState.visualScale
    );
    tempObserverRelative.copy(sourceWorldPosition).sub(tempObserverSkyOrigin);
  
    const northComponent = tempObserverRelative.dot(tempObserverNorthAxis);
    const eastComponent = tempObserverRelative.dot(tempObserverEastAxis);
    const upComponent = tempObserverRelative.y;
    const planarDistance = Math.hypot(northComponent, eastComponent);
    const altitudeRadians = Math.atan2(upComponent, Math.max(planarDistance, 0.0001));
    const azimuthRadians = Math.atan2(eastComponent, northComponent);
  
    return {
      altitudeDegrees: THREE.MathUtils.radToDeg(altitudeRadians),
      azimuthDegrees: THREE.MathUtils.euclideanModulo(THREE.MathUtils.radToDeg(azimuthRadians), 360),
      altitudeRadians,
      azimuthRadians
    };
  }
  
  function getMoonRenderState(snapshot) {
    const moonPhase = snapshot?.moonPhase ?? {
      illuminationFraction: 1,
      waxing: true
    };
    const illuminationFraction = THREE.MathUtils.clamp(moonPhase.illuminationFraction ?? 1, 0, 1);
    const moonSolarFactor = snapshot
      ? getSolarAltitudeFactor(
        snapshot.moon.latitudeDegrees,
        snapshot.moon.longitudeDegrees,
        snapshot.sun.latitudeDegrees,
        snapshot.sun.longitudeDegrees
      )
      : -1;
    const nightGlow = snapshot
      ? THREE.MathUtils.clamp((-moonSolarFactor + 0.04) / 0.3, 0, 1)
      : 1;
    const phaseGlow = Math.pow(illuminationFraction, 0.72);
    const shadowCoverage = Math.pow(1 - illuminationFraction, 0.78);
    const terminatorPresence = Math.pow(Math.max(0, 1 - Math.abs((illuminationFraction * 2) - 1)), 0.58);
    const coolGlowStrength = nightGlow * terminatorPresence;
    const pulseTime = performance.now();
    const pulse = 0.5 + (Math.sin(pulseTime * ORBIT_MOON_PULSE_SPEED) * 0.5);
    const auraStrength = nightGlow * THREE.MathUtils.lerp(0.24, 1, phaseGlow);
    const lunarEclipseTint = THREE.MathUtils.clamp(snapshot?.lunarEclipseTint ?? 0, 0, 1);
    const lunarEclipseShadowStrength = THREE.MathUtils.clamp(snapshot?.lunarEclipseShadowStrength ?? 0, 0, 1);
    const eclipseWarmth = THREE.MathUtils.clamp(
      Math.max(lunarEclipseTint, lunarEclipseShadowStrength * 0.45),
      0,
      1
    );
    const lunarEclipseMaskCenterNdc = snapshot?.lunarEclipseMaskCenterNdc ?? null;
    const lunarEclipseMaskRadius = snapshot?.lunarEclipseMaskRadius ?? 0;
    const lunarEclipseMaskSoftnessPx = snapshot?.lunarEclipseMaskSoftnessPx ?? 32;
    const lunarEclipseMaskViewport = snapshot?.lunarEclipseMaskViewport ?? null;
    const moonLatitudeDegrees = snapshot?.moon?.latitudeDegrees ?? 0;
    const flipLatitudeRange = Math.max(MOON_TEXTURE_FLIP_LATITUDE_RANGE, 0.0001);
    const southBandThreshold = -(flipLatitudeRange / 3);
    const surfaceTextureRotationRadians = moonLatitudeDegrees <= southBandThreshold ? Math.PI : 0;
  
    return {
      aureoleOpacity: (
        ORBIT_MOON_AUREOLE_OPACITY *
        auraStrength *
        THREE.MathUtils.lerp(0.42, 1, terminatorPresence) *
        THREE.MathUtils.lerp(0.86, 1.16, pulse)
      ),
      aureoleRotation: (Math.PI / 7) + (pulseTime * 0.00008),
      aureoleScale: ORBIT_MOON_AUREOLE_SCALE * THREE.MathUtils.lerp(0.96, 1.1, pulse),
      bodyEmissiveIntensity: (
        THREE.MathUtils.lerp(0.12, ORBIT_MOON_BODY_EMISSIVE_INTENSITY, nightGlow) *
        THREE.MathUtils.lerp(0.18, 1, phaseGlow)
      ),
      coolGlowOpacity: 0.18 * coolGlowStrength,
      coolGlowStrength,
      coronaOpacity: ORBIT_MOON_CORONA_OPACITY * auraStrength * THREE.MathUtils.lerp(0.84, 1.12, pulse),
      coronaRotation: pulseTime * 0.00005,
      coronaScale: ORBIT_MOON_CORONA_SCALE * THREE.MathUtils.lerp(0.92, 1.08, pulse),
      glowStrength: THREE.MathUtils.lerp(0.08, 1, nightGlow),
      haloOpacity: ORBIT_MOON_HALO_OPACITY * nightGlow * THREE.MathUtils.lerp(0.18, 1, phaseGlow),
      illuminationFraction,
      lightIntensity: ORBIT_MOON_LIGHT_INTENSITY * nightGlow * THREE.MathUtils.lerp(0.14, 1, phaseGlow),
      lunarEclipseTint,
      lunarEclipseShadowStrength,
      lunarEclipseMaskCenterNdc,
      lunarEclipseMaskRadius,
      lunarEclipseMaskSoftnessPx,
      lunarEclipseMaskViewport,
      eclipseWarmth,
      surfaceTextureRotationRadians,
      shadowAlpha: THREE.MathUtils.lerp(0.12, 0.012, Math.max(shadowCoverage, terminatorPresence)),
      warmFringeOpacity: (
        ORBIT_MOON_WARM_FRINGE_OPACITY *
        auraStrength *
        eclipseWarmth *
        THREE.MathUtils.lerp(0.88, 1.18, 1 - pulse)
      ),
      warmFringeRotation: (Math.PI / 3) - (pulseTime * 0.00012),
      warmFringeScale: ORBIT_MOON_WARM_FRINGE_SCALE * THREE.MathUtils.lerp(0.94, 1.12, 1 - pulse),
      waxing: moonPhase.waxing !== false
    };
  }
  
  function syncMoonMaterialPresentation(material, moonRenderState) {
    setMoonMaterialPhase(material, {
      coolGlowStrength: moonRenderState.coolGlowStrength,
      illuminationFraction: moonRenderState.illuminationFraction,
      lunarEclipseTint: moonRenderState.lunarEclipseTint ?? 0,
      lunarEclipseShadowStrength: moonRenderState.lunarEclipseShadowStrength ?? 0,
      shadowAlpha: moonRenderState.shadowAlpha,
      waxing: moonRenderState.waxing,
      glowStrength: moonRenderState.glowStrength,
      eclipseMaskCenterNdc: moonRenderState.lunarEclipseMaskCenterNdc,
      eclipseMaskRadius: moonRenderState.lunarEclipseMaskRadius,
      eclipseMaskSoftnessPx: moonRenderState.lunarEclipseMaskSoftnessPx,
      eclipseMaskViewport: moonRenderState.lunarEclipseMaskViewport,
      surfaceTextureRotationRadians: moonRenderState.surfaceTextureRotationRadians
    });
  }
  
  function syncMoonLightPresentation(
    bodyMaterial,
    haloMaterial,
    coolGlowMaterial,
    coronaSprite,
    aureoleSprite,
    warmFringeSprite,
    pointLight,
    moonRenderState
  ) {
    const coronaMaterial = coronaSprite.material;
    const aureoleMaterial = aureoleSprite.material;
    const warmFringeMaterial = warmFringeSprite.material;
    const eclipseWarmth = THREE.MathUtils.clamp(moonRenderState.eclipseWarmth ?? 0, 0, 1);
  
    bodyMaterial.emissive.copy(ORBIT_MOON_EMISSIVE_COLOR_DAY).lerp(
      ORBIT_MOON_EMISSIVE_COLOR_NIGHT,
      eclipseWarmth
    );
    haloMaterial.color.copy(ORBIT_MOON_HALO_COLOR_DAY).lerp(
      ORBIT_MOON_HALO_COLOR_NIGHT,
      eclipseWarmth
    );
    pointLight.color.copy(ORBIT_MOON_LIGHT_COLOR_DAY).lerp(
      ORBIT_MOON_LIGHT_COLOR_NIGHT,
      eclipseWarmth
    );
    coolGlowMaterial.color.copy(ORBIT_MOON_COOL_GLOW_COLOR);
    coolGlowMaterial.opacity = moonRenderState.coolGlowOpacity;
    coronaMaterial.color.copy(ORBIT_MOON_LIGHT_COLOR_DAY).lerp(
      ORBIT_MOON_LIGHT_COLOR_NIGHT,
      eclipseWarmth * 0.42
    );
    coronaMaterial.opacity = moonRenderState.coronaOpacity;
    coronaMaterial.rotation = moonRenderState.coronaRotation;
    coronaSprite.scale.setScalar(moonRenderState.coronaScale);
    aureoleMaterial.color.copy(ORBIT_MOON_COOL_GLOW_COLOR).lerp(ORBIT_MOON_LIGHT_COLOR_DAY, 0.22);
    aureoleMaterial.opacity = moonRenderState.aureoleOpacity;
    aureoleMaterial.rotation = moonRenderState.aureoleRotation;
    aureoleSprite.scale.setScalar(moonRenderState.aureoleScale);
    warmFringeMaterial.color.copy(ORBIT_MOON_LIGHT_COLOR_DAY).lerp(
      ORBIT_MOON_HALO_COLOR_NIGHT,
      eclipseWarmth
    );
    warmFringeMaterial.opacity = moonRenderState.warmFringeOpacity;
    warmFringeMaterial.rotation = moonRenderState.warmFringeRotation;
    warmFringeSprite.scale.setScalar(moonRenderState.warmFringeScale);
  }
  
  function updateObserverCelestialPerspective(snapshot) {
    if (!walkerState.enabled || !snapshot) {
      resetDarkSunOcclusionMotion(darkSunOcclusionState.observer);
      const moonRenderState = getMoonRenderState(snapshot);
      syncMoonMaterialPresentation(orbitMoonBody.material, moonRenderState);
      syncMoonMaterialPresentation(observerMoonBody.material, moonRenderState);
      syncMoonLightPresentation(
        orbitMoonBody.material,
        orbitMoonHalo.material,
        orbitMoonCoolGlow.material,
        orbitMoonCorona,
        orbitMoonAureole,
        orbitMoonWarmFringe,
        orbitMoonLight,
        moonRenderState
      );
      syncMoonLightPresentation(
        observerMoonBody.material,
        observerMoonHalo.material,
        observerMoonCoolGlow.material,
        observerMoonCorona,
        observerMoonAureole,
        observerMoonWarmFringe,
        observerMoonLight,
        moonRenderState
      );
      observerSun.visible = false;
      observerDarkSun.visible = false;
      observerMoon.visible = false;
      firstPersonSunRayGroup.visible = false;
      orbitSun.visible = true;
      orbitSun.renderOrder = 20;
      sunFullTrail.visible = celestialControlState.showFullTrail;
      sunFullTrailPointsCloud.visible = celestialControlState.showFullTrail;
      sunTrail.visible = true;
      sunTrailPointsCloud.visible = true;
      orbitSunBody.material.opacity = 1;
      orbitSunBody.material.emissiveIntensity = ORBIT_SUN_BODY_EMISSIVE_INTENSITY;
      orbitSunBody.material.depthTest = false;
      orbitSunBody.material.depthWrite = false;
      orbitSunHalo.material.opacity = ORBIT_SUN_HALO_OPACITY;
      orbitSunHalo.material.depthTest = true;
      orbitSunHalo.material.depthWrite = false;
      orbitSunLight.intensity = ORBIT_SUN_LIGHT_INTENSITY;
      orbitMoon.visible = true;
      orbitMoon.renderOrder = 18;
      moonFullTrail.visible = celestialControlState.showFullTrail;
      moonFullTrailPointsCloud.visible = celestialControlState.showFullTrail;
      moonTrail.visible = true;
      moonTrailPointsCloud.visible = true;
      orbitMoonBody.material.opacity = 1;
      orbitMoonBody.material.emissiveIntensity = moonRenderState.bodyEmissiveIntensity;
      orbitMoonBody.material.depthTest = false;
      orbitMoonBody.material.depthWrite = false;
      orbitMoonHalo.material.opacity = moonRenderState.haloOpacity;
      orbitMoonHalo.material.depthTest = true;
      orbitMoonHalo.material.depthWrite = false;
      orbitMoonLight.intensity = moonRenderState.lightIntensity;
      return;
    }
  
    const observerGeo = getGeoFromProjectedPosition(walkerState.position, constants.DISC_RADIUS);
    const moonRenderState = getMoonRenderState(snapshot);
    const sunHorizontal = getHorizontalFromWorldPosition(
      orbitSun.getWorldPosition(tempDemoSunSourceWorld),
      observerGeo
    );
    const darkSunHorizontal = getHorizontalFromWorldPosition(
      orbitDarkSun.getWorldPosition(tempDemoDarkSunSourceWorld),
      observerGeo
    );
    const moonHorizontal = getHorizontalFromWorldPosition(
      orbitMoon.getWorldPosition(tempDemoMoonSourceWorld),
      observerGeo
    );
    const adjustedSunHorizontal = applyCelestialAltitudeOffset(sunHorizontal);
    const adjustedDarkSunHorizontal = applyCelestialAltitudeOffset(darkSunHorizontal);
    const adjustedMoonHorizontal = applyCelestialAltitudeOffset(moonHorizontal);
    const sunTargetVisibility = THREE.MathUtils.clamp(
      (adjustedSunHorizontal.altitudeDegrees + FIRST_PERSON_CELESTIAL_FADE_RANGE) / (FIRST_PERSON_CELESTIAL_FADE_RANGE * 2),
      0,
      1
    );
    const darkSunTargetVisibility = THREE.MathUtils.clamp(
      (adjustedDarkSunHorizontal.altitudeDegrees + FIRST_PERSON_CELESTIAL_FADE_RANGE) / (FIRST_PERSON_CELESTIAL_FADE_RANGE * 2),
      0,
      1
    );
    const moonTargetVisibility = THREE.MathUtils.clamp(
      (adjustedMoonHorizontal.altitudeDegrees + FIRST_PERSON_CELESTIAL_FADE_RANGE) / (FIRST_PERSON_CELESTIAL_FADE_RANGE * 2),
      0,
      1
    );
    const sunHorizonLift = THREE.MathUtils.clamp(
      adjustedSunHorizontal.altitudeDegrees / constants.FIRST_PERSON_HORIZON_OCCLUSION_RANGE,
      0,
      1
    );
    const darkSunHorizonLift = THREE.MathUtils.clamp(
      adjustedDarkSunHorizontal.altitudeDegrees / constants.FIRST_PERSON_HORIZON_OCCLUSION_RANGE,
      0,
      1
    );
    const moonHorizonLift = THREE.MathUtils.clamp(
      adjustedMoonHorizontal.altitudeDegrees / constants.FIRST_PERSON_HORIZON_OCCLUSION_RANGE,
      0,
      1
    );
    const sunOcclusionVisibility = sunTargetVisibility * sunHorizonLift;
    const darkSunOcclusionVisibility = darkSunTargetVisibility * darkSunHorizonLift;
    const moonOcclusionVisibility = moonTargetVisibility * moonHorizonLift;
  
    positionBodyInObserverSky(observerSun, adjustedSunHorizontal, observerGeo);
    positionBodyInObserverSky(observerDarkSun, adjustedDarkSunHorizontal, observerGeo);
    positionBodyInObserverSky(observerMoon, adjustedMoonHorizontal, observerGeo);
    observerSun.position.y -= (1 - sunHorizonLift) * constants.FIRST_PERSON_HORIZON_SINK;
    observerDarkSun.position.y -= (1 - darkSunHorizonLift) * constants.FIRST_PERSON_HORIZON_SINK;
    observerMoon.position.y -= (1 - moonHorizonLift) * (constants.FIRST_PERSON_HORIZON_SINK * 0.65);
    observerSun.scale.setScalar(FIRST_PERSON_SUN_SCALE);
    observerDarkSun.scale.setScalar(FIRST_PERSON_SUN_SCALE * (ORBIT_DARK_SUN_SIZE / ORBIT_SUN_SIZE));
    observerMoon.scale.setScalar(FIRST_PERSON_MOON_SCALE);
    syncMoonMaterialPresentation(orbitMoonBody.material, moonRenderState);
    syncMoonMaterialPresentation(observerMoonBody.material, moonRenderState);
    syncMoonLightPresentation(
      orbitMoonBody.material,
      orbitMoonHalo.material,
      orbitMoonCoolGlow.material,
      orbitMoonCorona,
      orbitMoonAureole,
      orbitMoonWarmFringe,
      orbitMoonLight,
      moonRenderState
    );
    syncMoonLightPresentation(
      observerMoonBody.material,
      observerMoonHalo.material,
      observerMoonCoolGlow.material,
      observerMoonCorona,
      observerMoonAureole,
      observerMoonWarmFringe,
      observerMoonLight,
      moonRenderState
    );
  
    orbitSun.visible = true;
    sunFullTrail.visible = celestialControlState.showFullTrail;
    sunFullTrailPointsCloud.visible = celestialControlState.showFullTrail;
    sunTrail.visible = true;
    sunTrailPointsCloud.visible = true;
    observerSun.renderOrder = 24;
    observerSun.visible = false;
    observerSunBody.material.depthTest = false;
    observerSunBody.material.depthWrite = false;
    observerSunBody.material.opacity += (sunOcclusionVisibility - observerSunBody.material.opacity) * 0.18;
    observerSunBody.material.emissiveIntensity += (
      (ORBIT_SUN_BODY_EMISSIVE_INTENSITY * sunOcclusionVisibility) - observerSunBody.material.emissiveIntensity
    ) * 0.18;
    observerSunHalo.material.depthTest = false;
    observerSunHalo.material.depthWrite = false;
    observerSunHalo.material.opacity += (
      (ORBIT_SUN_HALO_OPACITY * sunOcclusionVisibility) - observerSunHalo.material.opacity
    ) * 0.18;
    observerSunLight.intensity += (
      (ORBIT_SUN_LIGHT_INTENSITY * sunOcclusionVisibility) - observerSunLight.intensity
    ) * 0.18;
    observerDarkSun.renderOrder = 26;
    const debugDarkSunBodyOpacity = simulationState.darkSunDebugVisible
      ? ORBIT_DARK_SUN_DEBUG_OPACITY
      : darkSunOcclusionVisibility;
    const debugDarkSunRimOpacity = simulationState.darkSunDebugVisible
      ? ORBIT_DARK_SUN_DEBUG_RIM_OPACITY
      : (ORBIT_DARK_SUN_RIM_OPACITY * darkSunOcclusionVisibility);
    observerDarkSunBody.material.opacity += (
      debugDarkSunBodyOpacity - observerDarkSunBody.material.opacity
    ) * 0.18;
    observerDarkSunRim.material.opacity += (
      debugDarkSunRimOpacity - observerDarkSunRim.material.opacity
    ) * 0.18;
    tempSunWorldPosition.copy(observerSun.position);
    tempSunViewDirection.copy(observerSun.position).sub(camera.position);
    const sunDistance = Math.max(tempSunViewDirection.length(), 0.0001);
    tempSunViewDirection.divideScalar(sunDistance);
    camera.getWorldDirection(tempCameraForward);
    const lookAlignment = THREE.MathUtils.clamp(
      (tempCameraForward.dot(tempSunViewDirection) - FIRST_PERSON_SUN_RAY_ALIGNMENT_START) /
        (FIRST_PERSON_SUN_RAY_ALIGNMENT_END - FIRST_PERSON_SUN_RAY_ALIGNMENT_START),
      0,
      1
    );
    const lowSunBoost = THREE.MathUtils.lerp(
      1.18,
      0.62,
      THREE.MathUtils.clamp(adjustedSunHorizontal.altitudeDegrees / 65, 0, 1)
    );
    const rayStrength = sunOcclusionVisibility * lookAlignment * lowSunBoost;
  
    firstPersonSunRayGroup.visible = rayStrength > 0.015;
    if (firstPersonSunRayGroup.visible) {
      const pulseTime = performance.now() * 0.0018;
      const rayScale = THREE.MathUtils.lerp(0.9, 1.55, rayStrength);
      firstPersonSunRayGroup.position.copy(tempSunWorldPosition);
      firstPersonSunRayGroup.quaternion.copy(camera.quaternion);
      firstPersonSunRayGroup.scale.setScalar(rayScale);
  
      for (const rayMesh of firstPersonSunRayMeshes) {
        const shimmer = 0.82 + (Math.sin(pulseTime + rayMesh.userData.pulseOffset) * 0.18);
        rayMesh.material.opacity = rayMesh.userData.baseOpacity * rayStrength * shimmer;
      }
    }
  
    orbitMoon.renderOrder = 23;
    orbitMoon.visible = true;
    moonFullTrail.visible = celestialControlState.showFullTrail;
    moonFullTrailPointsCloud.visible = celestialControlState.showFullTrail;
    moonTrail.visible = true;
    moonTrailPointsCloud.visible = true;
    observerMoon.renderOrder = 23;
    observerMoon.visible = false;
    observerMoonBody.material.depthTest = false;
    observerMoonBody.material.depthWrite = false;
    observerMoonBody.material.opacity += (moonOcclusionVisibility - observerMoonBody.material.opacity) * 0.18;
    observerMoonBody.material.emissiveIntensity += (
      ((moonRenderState.bodyEmissiveIntensity * moonOcclusionVisibility) - observerMoonBody.material.emissiveIntensity)
    ) * 0.12;
    observerMoonHalo.material.depthTest = false;
    observerMoonHalo.material.depthWrite = false;
    observerMoonHalo.material.opacity += (
      (moonRenderState.haloOpacity * moonOcclusionVisibility) - observerMoonHalo.material.opacity
    ) * 0.18;
    observerMoonLight.intensity += (
      (moonRenderState.lightIntensity * moonOcclusionVisibility) - observerMoonLight.intensity
    ) * 0.18;
  }
  
  function configurePreparationCamera(targetCamera) {
    const visualScale = constants.FIRST_PERSON_STAGE_SCALE;
    const horizontalDistance = Math.cos(walkerState.pitch) * constants.WALKER_LOOK_DISTANCE;
  
    targetCamera.fov = constants.CAMERA_WALKER_FOV;
    targetCamera.aspect = camera.aspect;
    targetCamera.near = 0.05;
    targetCamera.far = scaleDimension(140);
    targetCamera.position.set(
      walkerState.position.x * visualScale,
      constants.WALKER_EYE_HEIGHT,
      walkerState.position.z * visualScale
    );
    tempPreparationLookTarget.set(
      targetCamera.position.x + (Math.sin(walkerState.heading) * horizontalDistance),
      constants.WALKER_EYE_HEIGHT + (Math.sin(walkerState.pitch) * constants.WALKER_LOOK_DISTANCE),
      targetCamera.position.z + (Math.cos(walkerState.heading) * horizontalDistance)
    );
    targetCamera.lookAt(tempPreparationLookTarget);
    targetCamera.updateProjectionMatrix();
    return targetCamera;
  }
  
  function resetMovementState() {
    movementState.forward = false;
    movementState.backward = false;
    movementState.left = false;
    movementState.right = false;
  }
  
  function exitFirstPersonMode() {
    renderState.transitionToken += 1;
    renderState.preparing = false;
    renderState.compileReady = false;
    renderState.progress = 0;
    renderState.transitionDurationMs = FIRST_PERSON_RETURN_DURATION_MS;
    renderState.targetStageScale = TOPDOWN_STAGE_SCALE;
    renderState.targetVisualScale = 1;
    renderState.targetFogNear = constants.FOG_DEFAULT_NEAR;
    renderState.targetFogFar = constants.FOG_DEFAULT_FAR;
    walkerState.enabled = false;
    resetMovementState();
    stopDrag();
    walkerApi.syncWalkerUi();
    walkerApi.updateWalkerAvatar();
    syncPreparationPresentation();
  }
  
  async function enterFirstPersonMode() {
    if (renderState.preparing || walkerState.enabled) {
      return;
    }
  
    const transitionToken = renderState.transitionToken + 1;
    renderState.transitionToken = transitionToken;
    renderState.preparing = true;
    renderState.compileReady = renderState.compiledFirstPerson;
    renderState.prepStartedAtMs = performance.now();
    renderState.progress = 0;
    renderState.transitionDurationMs = renderState.compiledFirstPerson
      ? FIRST_PERSON_RETURN_DURATION_MS
      : FIRST_PERSON_PREP_DURATION_MS;
    renderState.targetStageScale = 1;
    renderState.targetVisualScale = constants.FIRST_PERSON_STAGE_SCALE;
    renderState.targetFogNear = constants.FOG_WALKER_NEAR;
    renderState.targetFogFar = constants.FOG_WALKER_FAR;
    walkerApi.syncWalkerUi();
    syncPreparationPresentation();
  
    const compilePromise = renderState.compiledFirstPerson
      ? Promise.resolve()
      : renderer.compileAsync(firstPersonScene, configurePreparationCamera(camera.clone())).catch(() => null);
  
    compilePromise.then(() => {
      if (renderState.transitionToken !== transitionToken) {
        return;
      }
      renderState.compileReady = true;
      renderState.compiledFirstPerson = true;
    });
  
    await Promise.all([
      compilePromise,
      new Promise((resolve) => window.setTimeout(resolve, renderState.transitionDurationMs))
    ]);
  
    if (renderState.transitionToken !== transitionToken) {
      return;
    }
  
    renderState.preparing = false;
    renderState.progress = 1;
    walkerState.enabled = true;
    walkerApi.syncWalkerUi();
    walkerApi.updateWalkerAvatar();
    syncPreparationPresentation();
  }
  

  return {
    updateSunVisualEffects,
    syncPreparationPresentation,
    updateRenderState,
    getObserverSkyAxes,
    getObserverSkyDistance,
    applyCelestialAltitudeOffset,
    positionBodyInObserverSky,
    getHorizontalFromWorldPosition,
    getMoonRenderState,
    syncMoonMaterialPresentation,
    syncMoonLightPresentation,
    updateObserverCelestialPerspective,
    configurePreparationCamera,
    resetMovementState,
    exitFirstPersonMode,
    enterFirstPersonMode
  };
}
