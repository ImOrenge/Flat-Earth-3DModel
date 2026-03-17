const fs = require('fs');

const appJsPath = 'c:\\Users\\user\\Flat-Earth\\_legacy_app_utf8.js';
const sceneSetupPath = 'c:\\Users\\user\\Flat-Earth\\modules\\scene-setup.js';

const appLines = fs.readFileSync(appJsPath, 'utf8').split('\n');
const startLineContent = 'const renderer = new THREE.WebGLRenderer({';
const endLineContent = 'scalableStage.add(createOrbitTrack(TROPIC_CAPRICORN_RADIUS, 0xff93b6, 0.88, ORBIT_SUN_HEIGHT_SOUTH));';

const startIndex = appLines.findIndex(l => l.includes(startLineContent));
const endIndex = appLines.findIndex(l => l.includes(endLineContent));

const sceneLines = appLines.slice(startIndex, endIndex + 1);

// I need to identify all top-level consts created in this block to return them.
const exportedVars = [];
const regex = /^(?:export )?const ([a-zA-Z0-9_]+) = /;
for (const line of sceneLines) {
  const match = line.match(regex);
  if (match) {
    // some vars might not be needed outside, but exporting all consts declared at top level
    // wait, `function` declarations like `enhanceDomeMaterialWithSunGlow` will also be in this block.
    // they don't necessarily need to be exported, but some might. Better to just export them too or keep in module.
    exportedVars.push(match[1]);
  }
}
const letRegex = /^(?:export )?let ([a-zA-Z0-9_]+) = /;
for (const line of sceneLines) {
  const match = line.match(letRegex);
  if (match) {
    exportedVars.push(match[1]);
  }
}

// Special case for functions
// Actually, functions are fine to just stay inside the scope or be returned. No wait, `enhanceDomeMaterialWithSunGlow` is internal mostly. Wait, `updateDarkSunMaskUniforms` is called from app.js!
const funcRegex = /^function ([a-zA-Z0-9_]+)\(/;
for (const line of sceneLines) {
  const match = line.match(funcRegex);
  if (match) {
    exportedVars.push(match[1]);
  }
}

const fileContent = `import * as THREE from "../vendor/three.module.js";
import * as constants from "./constants.js";

const {
${fs.readFileSync('c:\\Users\\user\\Flat-Earth\\extract_constants.js', 'utf8').match(/const \{\n([\s\S]+?)\} = constants;/)[1]}
} = constants;

export function setupScene({ canvas }) {
${sceneLines.map(l => '  ' + l).join('\n')}

  return {
${exportedVars.map(v => '    ' + v).join(',\n')}
  };
}
`;

fs.writeFileSync(sceneSetupPath, fileContent, 'utf8');

// Also update app.js
const updatedAppLines = [
  ...appLines.slice(0, startIndex),
  ...appLines.slice(endIndex + 1)
];

const newImport = `import { setupScene } from "./modules/scene-setup.js";
const {
${exportedVars.map(v => '  ' + v).join(',\n')}
} = setupScene({ canvas });`;

updatedAppLines.splice(startIndex, 0, newImport);

fs.writeFileSync(appJsPath, updatedAppLines.join('\n'), 'utf8');

console.log('Scene setup extracted successfully');
