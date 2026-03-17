const fs = require('fs');
const { execSync } = require('child_process');

console.log('Extracting constants...');
execSync('node extract_constants.js', { stdio: 'inherit' });

console.log('Extracting scene...');
execSync('node extract_scene.js', { stdio: 'inherit' });

console.log('Fixing scene...');
execSync('node fix_scene.js', { stdio: 'inherit' });

console.log('Applying app.js hotfix...');
let lines = fs.readFileSync('app.js', 'utf8').split('\n');
if (lines[709] && lines[709].includes('const constants = {')) {
  lines.splice(709, 83);
}
fs.writeFileSync('app.js', lines.join('\n'));

console.log('Applying constants.js hotfix...');
let consts = fs.readFileSync('modules/constants.js', 'utf8');
if (!consts.includes('THREE from')) {
  fs.writeFileSync('modules/constants.js', 'import * as THREE from "../vendor/three.module.js";\n' + consts);
}

console.log('Extracting eclipse...');
execSync('node extract_eclipse.js', { stdio: 'inherit' });

console.log('Done!');
