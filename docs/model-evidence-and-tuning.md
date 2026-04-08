# Model Evidence and Tuning Inputs

## 1) Celestial Calibration
- Baseline constant:
  - `CELESTIAL_AZIMUTH_OFFSET_DEGREES = 31.646`
- Runtime tuning input:
  - URL query param: `azimuthOffsetDeg`
  - Example: `http://localhost:8000/?azimuthOffsetDeg=30.9`
- Runtime provenance signal:
  - `CELESTIAL_AZIMUTH_OFFSET_SOURCE` returns `baseline` or `query`.

## 2) Route Heuristics
- Shared core file:
  - `modules/route-multileg-core.js`
- Distance profile tuning input (code-level):
  - `distanceProfileTuning.shortDistanceKm`
  - `distanceProfileTuning.mediumDistanceKm`
  - `distanceProfileTuning.shortBufferHours`
  - `distanceProfileTuning.mediumBufferHours`
  - `distanceProfileTuning.longBufferHours`
- Recommendation tuning input (code-level):
  - `buildRecommendedRoutesForPair(..., { routeLimit, maxLayovers, minFinalLegDistanceKm, distanceProfileTuning })`

## 3) Route Data Reproducibility Policy
- Policy version:
  - `2026-04-08`
- Pinned remote refs:
  - `mwgg/Airports@72834e4bdcc2866a1422fe7e986211173e933da1`
  - `mledoze/countries@eb8ea804b1d2a08821126ce7c552a1435265ef77`
- Cache policy:
  - TTL: 24h
  - Cached payload stores `dataPolicy` metadata (`policyVersion`, `source`, `fetchedAt`, pinned refs).

## 4) Reproduction Steps
1. Install dependencies and run tests:
```bash
npm run core-sim:test
```
2. Run web locally:
```bash
npm run web:serve
```
3. Validate celestial tuning path:
  - Open with and without `?azimuthOffsetDeg=...` and compare `CELESTIAL_AZIMUTH_OFFSET_SOURCE`.
4. Validate route data source pinning/fallback:
  - Trigger remote load path and inspect returned `dataPolicy`.
  - Simulate remote failure and confirm cached/bundled fallback still retains `dataPolicy`.
5. Validate route heuristic tuning:
  - Execute route generation with custom `distanceProfileTuning` and compare leg buffer effects.

