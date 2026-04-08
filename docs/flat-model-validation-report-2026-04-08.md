# Flat Model Validation Report (2026-04-08)

## Scope
- Validation mode: balanced (`reality-alignment` + `internal-consistency`)
- Targets: web (`modules`, `globe/modules`) + `packages/core-sim`
- Out of scope: comparison panel UI changes (explicitly excluded)

## Classification Rule
- `Pass`: current implementation and evidence are sufficient for repeatable verification.
- `Needs Evidence`: behavior is acceptable but explicit rationale/source link is still required.
- `Fails`: reproducibility or consistency gap blocks reliable validation.

## Astronomy
- Result: `Needs Evidence`
- Reality alignment:
  - `CELESTIAL_AZIMUTH_OFFSET_DEGREES` baseline remains `31.646`, now with explicit source flag (`baseline` vs `query`) and query override (`azimuthOffsetDeg`).
  - Seasonal/orbit comparison logic is numerically stable at equinox/year boundaries and near-polar latitudes (`core-sim` tests extended).
- Internal consistency:
  - Flat and globe constants now share the same azimuth override mechanics.
- Remaining evidence gap:
  - Baseline `31.646` requires an external calibration note (observational dataset provenance) beyond code comments.

## Routes
- Result: `Needs Evidence`
- Reality alignment:
  - Route dataset sources are pinned to immutable Git commit refs (airports/countries), reducing drift from moving `master` branches.
  - Distance profile heuristics now support explicit tuning inputs (`distanceProfileTuning`) and are golden-tested.
  - Flagship recommendation constraints remain deterministic and are golden-tested.
- Internal consistency:
  - Shared route core (`modules/route-multileg-core.js`) is used by both web/globe route flows.
- Remaining evidence gap:
  - Hub/flagship policy intent is now reproducible, but still needs domain-level justification (why those exact hub chains).

## Comparison Engine
- Result: `Pass`
- Reality alignment:
  - `core-sim` comparison thresholds and benchmark overrides are deterministic; boundary/extreme-latitude cases covered by tests.
- Internal consistency:
  - Core comparison metric output schema and category ordering remain stable across identical inputs.
- Note:
  - Comparison panel UI is intentionally not part of this implementation.

## Reproducibility
- Result: `Pass`
- Reality alignment:
  - Remote route datasets use commit-pinned URLs and carry policy metadata (`policyVersion`, pinned refs, TTL, source).
  - Cache payload now preserves data policy metadata to support auditability of fallback paths.
- Internal consistency:
  - Both `modules/route-data-service.js` and `globe/modules/route-data-service.js` expose aligned policy metadata fields.

## Open Items
- `Needs Evidence` closure criteria:
  - Add external source/citation for azimuth baseline (`31.646`) and include derivation procedure.
  - Document rationale for flagship hub chains in route heuristics with source or explicit modeling decision note.
