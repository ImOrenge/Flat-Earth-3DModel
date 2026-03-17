const fs = require('fs');
const appJsPath = 'c:\\Users\\user\\Flat-Earth\\app.js';
const visualsPath = 'c:\\Users\\user\\Flat-Earth\\modules\\celestial-visuals-controller.js';

let appLines = fs.readFileSync(appJsPath, 'utf8').split('\n');

const startIndex = appLines.findIndex(l => l.includes('function updateSunVisualEffects(snapshot) {'));
const endIndex = appLines.findIndex(l => l.includes('let isDragging = false;'));
const logicLines = appLines.slice(startIndex, endIndex);

// Remove logic lines from app.js
appLines.splice(startIndex, endIndex - startIndex);

const exportedFuncs = [];
for (const line of logicLines) {
  const matchFunc = line.match(/^async function ([a-zA-Z0-9_]+)\(/) || line.match(/^function ([a-zA-Z0-9_]+)\(/);
  if (matchFunc) exportedFuncs.push(matchFunc[1]);
}

const fileContent = `import * as THREE from "../vendor/three.module.js";
import { getSolarEclipsePhaseKey, getSolarEclipseVisualProfile, easeEclipseLightValue, createSolarEclipseState } from "./astronomy-utils.js?v=20260314-natural-eclipse2";

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
    stopDrag
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
    WALKER_EYE_HEIGHT
  } = constants;

${logicLines.map(l => '  ' + l).join('\n')}

  return {
${exportedFuncs.map(f => '    ' + f).join(',\n')}
  };
}
`;

fs.writeFileSync(visualsPath, fileContent, 'utf8');

const newImport = `import { createCelestialVisualsController } from "./modules/celestial-visuals-controller.js";`;

const depsObject = `
  const celestialVisualsApi = createCelestialVisualsController({
    constants, i18n, ui, orbitSun, orbitDarkSun, observerSun, observerDarkSun, orbitSunBody,
    orbitDarkSunRim, orbitDarkSunBody, orbitSunHalo, orbitSunAureole, orbitSunCorona, orbitMoonBody,
    orbitMoonHalo, orbitMoonCoolGlow, orbitMoonCorona, orbitMoonAureole, orbitMoonWarmFringe,
    orbitMoonLight, observerMoonBody, scene, firstPersonScene, camera, stage, scalableStage, dome,
    dayNightOverlayMaterial, firstPersonSunRayGroup, firstPersonSunRayMeshes, simulationState,
    astronomyState, renderState, walkerState, movementState, astronomyApi, walkerApi,
    ambient: firstPersonAmbient, keyLight: firstPersonKeyLight, rimLight: firstPersonRimLight,
    renderer, firstPersonPrepEl, firstPersonPrepTitleEl, firstPersonPrepCopyEl, firstPersonPrepBarFillEl,
    firstPersonPrepProgressEl, resetDarkSunOcclusionMotion: solarEclipseApi.resetDarkSunOcclusionMotion,
    darkSunOcclusionState, getSolarAltitudeFactor, setMoonMaterialPhase, tempPreparationLookTarget, stopDrag: () => {}
  });
  const {
${exportedFuncs.map(f => '    ' + f).join(',\n')}
  } = celestialVisualsApi;
`;

appLines.splice(startIndex, 0, depsObject);
appLines.splice(22, 0, newImport);

fs.writeFileSync(appJsPath, appLines.join('\n'), 'utf8');
console.log('Celestial visuals extracted.');
