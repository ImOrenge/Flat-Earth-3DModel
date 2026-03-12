# Assets

Bundled default assets:

- `flat-earth-map-square.svg`: default web preview map
- `flat-earth-map-square.png`: square PNG used by the model material
- `flat-earth-map.png`: user-replaceable source map kept for script compatibility

`flat-earth-disc.obj` and `models/flat-earth-disc.mtl` continue to use the square PNG texture path.

If you want to replace the model source map, overwrite:

- `flat-earth-map.png`

Then rerun `scripts/generate-flat-earth-obj.ps1` to regenerate the square texture and model files.
