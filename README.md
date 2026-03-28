# Flat Earth 3D Model

Three.js preview and OBJ/MTL generation flow for a flat-earth disc map.

## Bundled default assets

- Web preview default map: `assets/flat-earth-map-square.svg`
- Model texture reference: `assets/flat-earth-map-square.png`
- User-replaceable source map: `assets/flat-earth-map.png`

The preview loads the bundled SVG by default. The model toolchain keeps the PNG path so existing OBJ/MTL references continue to work.

## Main files

- `index.html`: preview shell and controls
- `app.js`: scene setup and default asset wiring
- `modules/texture-manager.js`: runtime texture loading and map updates
- `scripts/generate-flat-earth-obj.ps1`: OBJ/MTL generation script
- `models/flat-earth-disc.obj`: generated mesh
- `models/flat-earth-disc.mtl`: material file referencing the square PNG texture
- `apps/mobile`: Expo 독립형 iOS/Android 앱
- `packages/core-sim`: 모바일/웹 공용 시뮬레이션 코어

## Use

1. Start the preview server:

```powershell
py -m http.server 8000
```

2. Open `http://127.0.0.1:8000/index.html`.
3. The bundled default map loads from `assets/flat-earth-map-square.svg`.
4. To replace the model source map, overwrite `assets/flat-earth-map.png`.
5. Regenerate the square PNG and OBJ/MTL files when needed:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\generate-flat-earth-obj.ps1
```

## Mobile App (Expo)

1. Install dependencies:

```powershell
cd .\apps\mobile
npm install
```

2. Start the native app:

```powershell
npm run start
```

3. For Android/iOS local run:

```powershell
npm run android
npm run ios
```

## Notes

- The preview accepts SVG uploads for immediate inspection without replacing bundled assets.
- The generated OBJ/MTL path continues to reference `assets/flat-earth-map-square.png`.
- Keeping the original filenames preserves existing code paths and external references.
