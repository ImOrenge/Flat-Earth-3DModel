const fs = require('fs');
const appJs = fs.readFileSync('c:\\Users\\user\\Flat-Earth\\app.js', 'utf8');
const constMatch = appJs.match(/const \{\n([\s\S]+?)\} = constants;/);
if (!constMatch) {
  console.log('No match found in app.js');
  process.exit(1);
}
const sceneSetupPath = 'c:\\Users\\user\\Flat-Earth\\modules\\scene-setup.js';
let sceneSetup = fs.readFileSync(sceneSetupPath, 'utf8');
sceneSetup = sceneSetup.replace(/const \{\n\$\{exportLines[\s\S]+?\} = constants;/, 'const {\n' + constMatch[1] + '} = constants;');
fs.writeFileSync(sceneSetupPath, sceneSetup);
console.log('Fixed scene-setup.js constants import');
