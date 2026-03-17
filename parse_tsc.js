const fs = require('fs');
const lines = fs.readFileSync('tsc_errors.txt', 'utf8').split('\n');
const missing = {};
const regex = /(modules\/[a-zA-Z0-9_-]+\.js|app\.js)\(\d+,\d+\):.*Cannot find name '([^']+)'/;
lines.forEach(l => {
  const match = l.match(regex);
  if(match) {
    const file = match[1];
    const name = match[2];
    if(!missing[file]) missing[file] = new Set();
    missing[file].add(name);
  }
});
for(const f in missing) {
  console.log(f + ': ' + Array.from(missing[f]).join(', '));
}
