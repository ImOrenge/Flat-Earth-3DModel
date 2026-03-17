const fs = require('fs');
let lines = fs.readFileSync('modules/input-handler.js', 'utf8').split(/\r?\n/);
lines.splice(538, 6, 
`  if (darkSunDebugEl) {
    darkSunDebugEl.addEventListener("change", () => {
      simulationState.darkSunDebugVisible = darkSunDebugEl.checked;
      const snapshot = getCurrentUiSnapshot();
      astronomyApi.updateAstronomyUi(snapshot);
      syncDarkSunPresentation(snapshot.solarEclipse ?? createSolarEclipseState());
    });
  }

  if (stagePreEclipseButton) {
    stagePreEclipseButton.addEventListener("click", () => {
      stagePreEclipseScene();
    });
  }

  if (stagePreLunarEclipseButton) {
    stagePreLunarEclipseButton.addEventListener("click", () => {
      stagePreLunarEclipseScene();
    });
  }

  skyAnalemmaOverlayEl.addEventListener("change", () => {
    skyAnalemmaState.enabled = skyAnalemmaOverlayEl.checked;
    const projectionDate = astronomyState.live ? new Date() : astronomyState.selectedDate;
    astronomyApi.syncSkyAnalemmaUi(projectionDate, true);
  });

  for (const button of orbitModeButtons) {
    button.addEventListener("click", () => {
      simulationState.orbitMode = button.dataset.orbitMode;
      astronomyApi.updateOrbitModeUi();
      astronomyApi.refreshTrailsForCurrentMode();
    });
  }

  for (const button of cameraTrackButtons) {
    button.addEventListener("click", () => {
      celestialTrackingCameraApi.setTarget(button.dataset.cameraTrack);
    });
  }`
);

fs.writeFileSync('modules/input-handler.js', lines.join('\n'), 'utf8');
