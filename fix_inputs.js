const fs = require('fs');

const inputHandlerPath = 'modules/input-handler.js';
let inputContent = fs.readFileSync(inputHandlerPath, 'utf8');

if (!inputContent.includes('import * as THREE')) {
  inputContent = 'import * as THREE from "../vendor/three.module.js";\n' + inputContent;
}

const missingDeps = \`
    controlTabButtons,
    languageToggleEl,
    i18n,
    uploadInput,
    resetButton,
    exitFirstPersonMode,
    enterFirstPersonMode,
    walkerModeEl,
    resetWalkerButton,
    routeSelectEl,
    routeSpeedEl,
    celestialTrailLengthEl,
    celestialSpeedEl,
    celestialFullTrailEl,
    routePlaybackButton,
    routeResetButton,
    realitySyncEl,
    realityLiveEl,
    observationTimeEl,
    applyObservationTimeButton,
    setCurrentTimeButton,
    dayNightOverlayEl,
    dayNightState,
    getGeoFromProjectedPosition,
    orbitSun,
    analemmaOverlayEl,
    analemmaState,
    magneticFieldOverlayEl,
    magneticFieldState,
    darkSunDebugEl,
    getCurrentUiSnapshot,
    syncDarkSunPresentation,
    stagePreEclipseButton,
    stagePreEclipseScene,
    skyAnalemmaOverlayEl,
    skyAnalemmaState,
    orbitModeButtons,
    cameraTrackButtons,
    seasonalYearEl,
    seasonalEventButtons,
    setDemoMoonOrbitOffsetFromPhase,
    syncDemoMoonOrbitToSun,
\`;

// Insert into setupInputHandlers deps destructuring
inputContent = inputContent.replace(
  'darkSunOcclusionState\n  } = deps;',
  \`darkSunOcclusionState,
\${missingDeps}
  } = deps;\`
);

fs.writeFileSync(inputHandlerPath, inputContent, 'utf8');

const appJsPath = 'app.js';
let appContent = fs.readFileSync(appJsPath, 'utf8');

const additionalDeps = \`
    controlTabButtons, languageToggleEl, i18n, uploadInput, resetButton,
    exitFirstPersonMode, enterFirstPersonMode, walkerModeEl, resetWalkerButton,
    routeSelectEl, routeSpeedEl, celestialTrailLengthEl, celestialSpeedEl,
    celestialFullTrailEl, routePlaybackButton, routeResetButton, realitySyncEl,
    realityLiveEl, observationTimeEl, applyObservationTimeButton, setCurrentTimeButton,
    dayNightOverlayEl, dayNightState, getGeoFromProjectedPosition, orbitSun,
    analemmaOverlayEl, analemmaState, magneticFieldOverlayEl, magneticFieldState,
    darkSunDebugEl, getCurrentUiSnapshot: solarEclipseApi.getCurrentUiSnapshot,
    syncDarkSunPresentation: solarEclipseApi.syncDarkSunPresentation,
    stagePreEclipseButton, stagePreEclipseScene: solarEclipseApi.stagePreEclipseScene,
    skyAnalemmaOverlayEl, skyAnalemmaState, orbitModeButtons, cameraTrackButtons,
    seasonalYearEl, seasonalEventButtons, setDemoMoonOrbitOffsetFromPhase,
    syncDemoMoonOrbitToSun,
\`;

appContent = appContent.replace(
  'darkSunOcclusionState\n  });',
  \`darkSunOcclusionState,
\${additionalDeps}
  });\`
);

fs.writeFileSync(appJsPath, appContent, 'utf8');
console.log('Fixed deps');
