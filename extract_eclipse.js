const fs = require('fs');
const appJsPath = 'c:\\Users\\user\\Flat-Earth\\app.js';
const eclipsePath = 'c:\\Users\\user\\Flat-Earth\\modules\\solar-eclipse-controller.js';

let appLines = fs.readFileSync(appJsPath, 'utf8').split('\n');

// 1. Extract state lines 652 to 685 (0-indexed 651 to 684)
const stateStartIndex = appLines.findIndex(l => l.includes('function createSolarEclipseWindowSolverState(overrides = {}) {'));
// find the end of the state block
const stateEndIndex = appLines.findIndex(l => l.includes('solarEclipsePresentationMaskState.observerBaseScale.copy(observerDarkSun.scale);'));
const stateLines = appLines.slice(stateStartIndex, stateEndIndex + 1);

// Remove state lines from app.js
appLines.splice(stateStartIndex, stateEndIndex - stateStartIndex + 1);

// 2. Extract logic lines 
const logicStartIndex = appLines.findIndex(l => l.includes('function getCurrentDarkSunRenderStateSnapshot() {'));
const logicEndIndex = appLines.findIndex(l => l.includes('function updateSunVisualEffects(snapshot) {'));
const logicLines = appLines.slice(logicStartIndex, logicEndIndex);

// Remove logic lines from app.js
appLines.splice(logicStartIndex, logicEndIndex - logicStartIndex);

const eclipseLines = [...stateLines, ...logicLines];

// Identify exported functions and consts
const exportedFuncs = [];
const exportedConsts = [];
for (const line of eclipseLines) {
  const matchFunc = line.match(/^function ([a-zA-Z0-9_]+)\(/);
  if (matchFunc) exportedFuncs.push(matchFunc[1]);
  
  const matchConst = line.match(/^(?:export )?const ([a-zA-Z0-9_]+) = /);
  if (matchConst) exportedConsts.push(matchConst[1]);

  const matchLet = line.match(/^(?:export )?let ([a-zA-Z0-9_]+) = /);
  if (matchLet) exportedConsts.push(matchLet[1]);
}

const fileContent = `import * as THREE from "../vendor/three.module.js";
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
    celestialTrackingCameraApi
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
    ORBIT_DARK_SUN_SIZE
  } = constants;

${eclipseLines.map(l => '  ' + l).join('\n')}

  return {
${exportedFuncs.map(f => '    ' + f).join(',\n')},
${exportedConsts.map(c => '    ' + c).join(',\n')}
  };
}
`;

fs.writeFileSync(eclipsePath, fileContent, 'utf8');

const newImport = `import { createSolarEclipseController } from "./modules/solar-eclipse-controller.js";`;

const depsObject = `
  const solarEclipseApi = createSolarEclipseController({
    constants, i18n, ui, orbitSun, orbitDarkSun, observerSun, observerDarkSun, orbitSunBody,
    orbitDarkSunRim, orbitDarkSunBody, orbitSunHalo, scene, camera, stage, scalableStage, dome,
    dayNightOverlayMaterial, firstPersonSunRayGroup, firstPersonSunRayMeshes, simulationState,
    astronomyState, renderState, walkerState, cameraState, astronomyApi,
    cameraApi, celestialTrackingCameraApi
  });
  const {
${exportedFuncs.map(f => '    ' + f).join(',\n')},
${exportedConsts.map(c => '    ' + c).join(',\n')}
  } = solarEclipseApi;
`;

// Insert the depsObject right where the logic used to be (logicStartIndex)
appLines.splice(logicStartIndex, 0, depsObject);
appLines.splice(21, 0, newImport);

fs.writeFileSync(appJsPath, appLines.join('\n'), 'utf8');
console.log('Eclipse logic extracted properly');
