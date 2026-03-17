const fs = require('fs');
const js = fs.readFileSync('app.js', 'utf8');

const definedVars = new Set();
const varRegex = /(?:const|let|var)\s+([\w$]+)\s*=/g;
let m;
while ((m = varRegex.exec(js))) {
  definedVars.add(m[1]);
}
const funcRegex = /function\s+([\w$]+)/g;
while ((m = funcRegex.exec(js))) {
  definedVars.add(m[1]);
}

const destructMatch = /(?:const|let|var)\s+\{\s*([^}]+)\s*\}/g;
while ((m = destructMatch.exec(js))) {
  m[1].split(',').forEach(x => {
    definedVars.add(x.split('=')[0].split(':')[0].trim());
  });
}

const setups = [
  'setupInputHandlers', 
  'createAstronomyController', 
  'createSolarEclipseController', 
  'createCelestialVisualsController'
];

setups.forEach(setup => {
  const startIndex = js.indexOf(setup + '({');
  if (startIndex === -1) return;
  const braceStart = js.indexOf('{', startIndex);
  const braceEnd = js.indexOf('}', braceStart);
  
  const argsText = js.slice(braceStart + 1, braceEnd);
  const args = argsText.split(',').map(s => {
    let t = s.trim();
    if(t.includes(':')) {
        return t.split(':')[0].trim();
    }
    return t.split('(')[0].trim();
  }).filter(t => t && !t.startsWith('...'));
  
  const globals = new Set(['Math', 'document', 'window', 'THREE', 'console', 'performance', 'requestAnimationFrame', 'constants', 'i18n', 'textureApi', 'astronomyApi', 'RouteSimulationController', 'FirstPersonWorldController']);
  
  args.forEach(arg => {
    if (!definedVars.has(arg) && !globals.has(arg)) {
      console.log(`POTENTIAL REFERENCE ERROR in ${setup}: "${arg}" is passed but not declared in app.js.`);
    }
  });
});
