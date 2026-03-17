const fs = require('fs');
const appJsPath = 'c:\\Users\\user\\Flat-Earth\\app.js';
const inputPath = 'c:\\Users\\user\\Flat-Earth\\modules\\input-handler.js';

let appLines = fs.readFileSync(appJsPath, 'utf8').split('\n');

const startIndex = appLines.findIndex(l => l.includes('let isDragging = false;'));
const bodyBandIndex = appLines.findIndex(l => l.includes('function getBodyBandProgressStep(body) {'));
const endIndex = bodyBandIndex;

const logicLines = appLines.slice(startIndex, endIndex);

appLines.splice(startIndex, endIndex - startIndex);

const fileContent = `export function setupInputHandlers(deps) {
  const {
    constants,
    canvas,
    cameraApi,
    walkerApi,
    celestialTrackingCameraApi,
    magneticFieldApi,
    routeSimulationApi,
    textureApi,
    astronomyApi,
    ui,
    renderState,
    walkerState,
    cameraState,
    movementState,
    simulationState,
    astronomyState,
    celestialControlState,
    skyTexture,
    scene,
    setControlTab,
    createSolarEclipseState,
    syncFullTrailVisibility,
    resetDarkSunStageState,
    showSolarEclipseToast,
    resetDarkSunOcclusionMotion,
    darkSunOcclusionState
  } = deps;

  const {
    WALKER_PITCH_MIN,
    WALKER_PITCH_MAX,
    CAMERA_TRACKING_MIN_DISTANCE,
    CAMERA_TRACKING_MAX_DISTANCE,
    CAMERA_TOPDOWN_MIN_RADIUS,
    CAMERA_TOPDOWN_MAX_RADIUS,
    FOG_DEFAULT_NEAR,
    FOG_DEFAULT_FAR
  } = constants;

${logicLines.join('\n').replace(/^/gm, '  ')}

}`;

fs.writeFileSync(inputPath, fileContent, 'utf8');

const newImport = `import { setupInputHandlers } from "./modules/input-handler.js";`;

const depsObject = `
  setupInputHandlers({
    constants, canvas, cameraApi, walkerApi, celestialTrackingCameraApi, magneticFieldApi,
    routeSimulationApi, textureApi, astronomyApi, ui, renderState, walkerState, cameraState,
    movementState, simulationState, astronomyState, celestialControlState, skyTexture, scene,
    setControlTab: () => {}, createSolarEclipseState, syncFullTrailVisibility: solarEclipseApi.syncFullTrailVisibility,
    resetDarkSunStageState: solarEclipseApi.resetDarkSunStageState, showSolarEclipseToast: solarEclipseApi.showSolarEclipseToast,
    resetDarkSunOcclusionMotion: solarEclipseApi.resetDarkSunOcclusionMotion, darkSunOcclusionState
  });
`;

appLines.splice(startIndex, 0, depsObject);
appLines.splice(23, 0, newImport);

fs.writeFileSync(appJsPath, appLines.join('\n'), 'utf8');
console.log('Input handler extracted.');
