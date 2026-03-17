const fs = require('fs');
const missing = JSON.parse(fs.readFileSync('missing_vars.json', 'utf8'));

const constFile = fs.readFileSync('modules/constants.js', 'utf8');
const constantsSet = new Set();
constFile.match(/export (?:const|function) ([A-Za-z0-9_]+)/g).forEach(m => {
  constantsSet.add(m.match(/export (?:const|function) ([A-Za-z0-9_]+)/)[1]);
});

function processModule(filePath, missingVars) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  const constMatch = content.match(/const\s*\{\s*([\s\S]*?)\s*\}\s*=\s*constants;/);
  const depsMatch = content.match(/const\s*\{\s*([\s\S]*?)\s*\}\s*=\s*deps;/);
  
  let existingConsts = new Set(constMatch ? constMatch[1].split(/,\s*/).map(s=>s.trim()).filter(Boolean) : []);
  let existingDeps = new Set(depsMatch ? depsMatch[1].split(/,\s*/).map(s=>s.trim()).filter(Boolean) : []);
  
  missingVars.forEach(v => {
    if (constantsSet.has(v)) {
      existingConsts.add(v);
    } else {
      existingDeps.add(v);
    }
  });

  if (constMatch) {
    const replacement = "const {\\n    " + Array.from(existingConsts).join(',\\n    ') + "\\n  } = constants;";
    content = content.replace(constMatch[0], replacement);
  }
  if (depsMatch) {
    const replacement = "const {\\n    " + Array.from(existingDeps).join(',\\n    ') + "\\n  } = deps;";
    content = content.replace(depsMatch[0], replacement);
  }
  
  fs.writeFileSync(filePath, content, 'utf8');
  
  return Array.from(existingDeps).filter(x => !depsMatch || !depsMatch[1].includes(x));
}

const newlyAddedToSolar = processModule('modules/solar-eclipse-controller.js', missing['modules/solar-eclipse-controller.js'] || []);
const newlyAddedToCelestial = processModule('modules/celestial-visuals-controller.js', missing['modules/celestial-visuals-controller.js'] || []);

let appContent = fs.readFileSync('app.js', 'utf8');

let solarInject = [];
newlyAddedToSolar.forEach(v => {
  if (['updateSunVisualEffects', 'syncPreparationPresentation'].includes(v)) {
    solarInject.push(v + ": (...args) => celestialVisualsApi." + v + "(...args)");
  } else {
    solarInject.push(v);
  }
});

let celestialInject = [];
newlyAddedToCelestial.forEach(v => {
  if (['getSolarEclipseLightScale'].includes(v)) {
    celestialInject.push(v + ": solarEclipseApi." + v);
  } else {
    celestialInject.push(v);
  }
});

// App replace solar
if (solarInject.length > 0) {
  const replacement = "cameraApi, celestialTrackingCameraApi, celestialControlState,\\n    " + solarInject.join(', ') + "\\n  });";
  appContent = appContent.replace(
    /cameraApi,\s*celestialTrackingCameraApi,\s*celestialControlState\r?\n\s*}\);/,
    replacement
  );
}

// App replace celestial
if (celestialInject.length > 0) {
  const replacement = "getSolarEclipseVisualProfile: solarEclipseApi.getSolarEclipseVisualProfile,\\n    " + celestialInject.join(', ') + "\\n  });";
  appContent = appContent.replace(
    /getSolarEclipseVisualProfile:\s*solarEclipseApi\.getSolarEclipseVisualProfile\r?\n\s*}\);/,
    replacement
  );
}

fs.writeFileSync('app.js', appContent, 'utf8');
console.log('Done injecting');
