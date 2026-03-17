const fs = require('fs');

const appJsPath = 'c:\\Users\\user\\Flat-Earth\\app.js';
const constantsPath = 'c:\\Users\\user\\Flat-Earth\\modules\\constants.js';

const appLines = fs.readFileSync(appJsPath, 'utf8').split('\n');
const startLineContent = 'const DEFAULT_MAP_PATH = "./assets/flat-earth-map-square.svg";';
const endLineContent = 'const ORBIT_RADIUS_AMPLITUDE = (TROPIC_CAPRICORN_RADIUS - TROPIC_CANCER_RADIUS) / 2;';

const startIndex = appLines.findIndex(l => l.includes(startLineContent));
const endIndex = appLines.findIndex(l => l.includes(endLineContent));

const constantLines = appLines.slice(startIndex, endIndex + 1);
const exportLines = constantLines.map(line => {
  if (line.startsWith('const ')) {
    return 'export ' + line;
  }
  return line;
});

const fileContent = `import { projectedRadiusFromLatitude } from "./geo-utils.js";

${exportLines.join('\n')}
`;

fs.writeFileSync(constantsPath, fileContent, 'utf8');

// Also update app.js to remove constants and add import
const updatedAppLines = [
  ...appLines.slice(0, startIndex),
  ...appLines.slice(endIndex + 1)
];

const newImport = `import * as constants from "./modules/constants.js";
const {
${exportLines.filter(l => l.startsWith('export const ')).map(l => '  ' + l.replace('export const ', '').split(' =')[0]).join(',\n')}
} = constants;`;

// insert import 
// let's just insert it at the start index
updatedAppLines.splice(startIndex, 0, newImport);

fs.writeFileSync(appJsPath, updatedAppLines.join('\n'), 'utf8');

console.log('Constants extracted successfully');
