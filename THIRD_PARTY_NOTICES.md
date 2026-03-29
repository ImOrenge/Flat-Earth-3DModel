# Third-Party Notices

Last updated: 2026-03-29 (Asia/Seoul)
Project: Flat Earth Disc

This file summarizes third-party software, bundled vendor artifacts, and external services/data referenced by this repository.

## 1) Direct Dependency Notices (from lockfiles)

| Scope | Package | Version | License |
|---|---|---:|---|
| root | `@vercel/analytics` | `^2.0.1` | MIT |
| root | `playwright` | `^1.58.2` | Apache-2.0 |
| root dev | `@dimforge/rapier3d-compat` | `^0.19.3` | Apache-2.0 |
| mobile | `expo` | `55.0.10-canary-20260327-0789fbc` | MIT |
| mobile | `expo-status-bar` | `55.0.5-canary-20260327-0789fbc` | MIT |
| mobile | `react` | `19.2.0` | MIT |
| mobile | `react-native` | `0.83.4` | MIT |
| mobile | `react-native-webview` | `^13.16.0` | MIT |
| mobile dev | `@types/react` | `~19.2.2` | MIT |
| mobile dev | `typescript` | `~5.9.2` | Apache-2.0 |
| core-sim dev | `typescript` | `^5.9.2` | Apache-2.0 |
| core-sim dev | `vitest` | `^3.2.4` | MIT |

Notes:
- Versions above are package-manifest ranges/locked values as present in repo.
- Full transitive dependency notices should be archived per-release (recommended: `/output/release-evidence/<date>/licenses/`).

## 2) Bundled Vendor Artifacts in Repository

### 2.1 Three.js

- Files:
  - `vendor/three.module.js`
  - `vendor/three-package.json`
- Identified version: `0.162.0`
- License: MIT
- Evidence:
  - SPDX header in `vendor/three.module.js`
  - `license` field in `vendor/three-package.json`

### 2.2 Rapier (WASM/JS bundle)

- Files:
  - `vendor/rapier.mjs`
  - `vendor/rapier-physics.js`
  - `vendor/rapier_wasm3d.js`
  - `vendor/rapier_wasm3d_bg.wasm`
- Source package used in workspace: `@dimforge/rapier3d-compat` `^0.19.3`
- License (package): Apache-2.0
- TODO:
  - Include upstream NOTICE/license text in release artifacts when distributing vendor bundles.

## 3) External Services and Data Sources

### 3.1 Google AdSense / Privacy & Messaging

- Usage in code:
  - Dynamic load of AdSense script in `index.html`
  - Privacy-choice callbacks in `app.js`
- Publisher ID reference:
  - `ads.txt` includes `pub-4006284492158024`
- Compliance reminder:
  - Verify CMP/consent handling for EEA/UK/Switzerland traffic before release.

### 3.2 Google Fonts

- Font loaded by site:
  - `Space Grotesk` via `fonts.googleapis.com`
- Known upstream license:
  - SIL Open Font License 1.1 (OFL-1.1)
- TODO:
  - Keep final font license text/reference in release evidence if self-hosting fonts later.

### 3.3 NASA Eclipse Catalog Data

- Usage in code:
  - `modules/eclipse-events-data.js` contains generated eclipse dataset and source comments.
- Source comments reference:
  - `https://eclipse.gsfc.nasa.gov/SEdecade/SEdecadeYYYY.html`
  - `https://eclipse.gsfc.nasa.gov/LEcat5/LE1901-2000.html`
  - `https://eclipse.gsfc.nasa.gov/LEcat5/LE2001-2100.html`
- Compliance reminder:
  - Do not imply NASA endorsement; follow NASA media usage guidance when marketing.

### 3.4 NASA Blue Marble Earth Texture

- Asset file:
  - `assets/nasa-blue-marble-5400x2700.jpg`
- Source URL:
  - `https://assets.science.nasa.gov/content/dam/science/esd/eo/images/bmng/bmng-base/january/world.200401.3x5400x2700.jpg`
- Source program/page family:
  - NASA Earth Observatory / Blue Marble Next Generation
- Licensing and usage note:
  - NASA imagery is generally not copyrighted (U.S. Government work), but use is subject to NASA media usage guidelines and endorsement restrictions.
- Compliance reminder:
  - Keep the source URL and attribution in release notes.
  - Do not use NASA insignia/logos in ways prohibited by NASA branding rules.

## 4) Items Requiring Manual Verification Before Commercial Release

- [ ] Root repository `LICENSE` file added and consistent with intended business model.
- [ ] `package.json` includes a matching `license` field.
- [ ] Vendor notices packaged with shipped artifacts.
- [ ] Ad consent behavior validated in target legal regions.
- [ ] Asset-level rights verified in `assets/ATTRIBUTION.md`.
