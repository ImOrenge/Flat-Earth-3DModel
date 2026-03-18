const fs = require('fs');

let content = fs.readFileSync('modules/astronomy-controller.js', 'utf8');

const startIdx = content.indexOf('  function getMirroredDarkSunState');
const endIdx = content.indexOf('  function getAstronomySnapshot');

if (startIdx !== -1 && endIdx !== -1) {
  const newLogic = `
  function getRealityDarkSunState(date) {
    const referenceSun = getSunSubpoint(new Date(DARK_SUN_REFERENCE_TIME_MS));
    const currentSun = getSunSubpoint(date);
    const currentProjectedRadius = projectedRadiusFromLatitude(
      currentSun.latitudeDegrees,
      constants.DISC_RADIUS
    );
    const elapsedFrames = (date.getTime() - DARK_SUN_REFERENCE_TIME_MS) / (1000 / 60);
    const sunProgress = getBodyProgressFromProjectedRadius("sun", currentProjectedRadius);
    const sunDirection = inferRealitySunBandDirection(date);

    return {
      direction: sunDirection >= 0 ? -1 : 1,
      orbitAngleRadians: THREE.MathUtils.degToRad(referenceSun.longitudeDegrees + 180) - (elapsedFrames * constants.ORBIT_SUN_SPEED * DARK_SUN_ORBIT_SPEED_FACTOR),
      orbitMode: getMirroredOrbitMode("auto"),
      progress: THREE.MathUtils.clamp(1 - sunProgress, 0, 1)
    };
  }

  function getDarkSunRenderState({
    date = astronomyState.selectedDate,
    direction = simulationState.darkSunBandDirection ?? DARK_SUN_START_DIRECTION,
    orbitAngleRadians = simulationState.orbitDarkSunAngle ?? DARK_SUN_START_ANGLE,
    progress = simulationState.darkSunBandProgress ?? DARK_SUN_START_PROGRESS,
    source = "reality",
    orbitMode = source === "demo" ? simulationState.orbitMode : "auto"
  } = {}) {
    // Treat Dark Sun natively in its own orbit, similar to sun/moon
    const darkSunState = source === "demo"
      ? {
          direction,
          orbitAngleRadians,
          orbitMode,
          progress
        }
      : getRealityDarkSunState(date);
      
    // The dark sun rides the identical physical sun band corridor.
    const renderState = getBodyCoilRenderState({
      body: "sun", // Important: physically uses the sun's corridor limits
      orbitAngleRadians: darkSunState.orbitAngleRadians,
      orbitMode: darkSunState.orbitMode,
      progress: darkSunState.progress,
      source: "demo"
    });
    
    return {
      ...renderState,
      direction: darkSunState.direction,
      orbitAngleRadians: darkSunState.orbitAngleRadians,
      orbitMode: darkSunState.orbitMode
    };
  }

`;
  content = content.substring(0, startIdx) + newLogic + content.substring(endIdx);
  fs.writeFileSync('modules/astronomy-controller.js', content, 'utf8');
  console.log("Successfully replaced getDarkSunRenderState logic.");
} else {
  console.log("Pattern not found");
}

