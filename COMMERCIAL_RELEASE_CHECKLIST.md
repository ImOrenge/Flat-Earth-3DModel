# Commercial Release Checklist

Last updated: 2026-03-29 (Asia/Seoul)
Scope: Flat Earth web + mobile wrapper project

## 0) Release Decision Rule

- [ ] DO NOT release until all `BLOCKER` items below are completed.
- [ ] Keep evidence links (docs, screenshots, logs) for each completed item.

## 1) BLOCKER - Rights and Licensing

- [ ] Add root repository license file (`LICENSE`) and align with intended distribution model.
- [ ] Add `license` field in [package.json](./package.json) to match root license.
- [ ] Create `THIRD_PARTY_NOTICES.md` with runtime dependencies and license attributions.
- [ ] Create `assets/ATTRIBUTION.md` documenting for each bundled asset:
  - filename
  - original source URL
  - license type
  - commercial-use permission status
  - required attribution text (if any)
  - modification notes
- [ ] Confirm ownership/permission for bundled map files:
  - `assets/flat-earth-map.png`
  - `assets/flat-earth-map-square.png`
  - `assets/flat-earth-map-square.svg`
- [ ] Confirm ownership/permission for social/share assets:
  - `assets/social-preview.png`
  - `assets/social-preview-scene.png`

## 2) BLOCKER - Ads and Privacy Compliance

- [ ] Verify AdSense account and domain ownership configuration for `flatearth-model.com`.
- [ ] Verify CMP behavior for EEA/UK/Switzerland traffic paths.
- [ ] Verify consent revocation flow from in-app settings UI:
  - web: privacy choices button
  - app wrapper mode: expected visibility behavior
- [ ] Ensure privacy policy reflects actual code behavior and deployed endpoints.
- [ ] Ensure `ads.txt` publisher ID matches active AdSense account and production domain.
- [ ] Capture compliance evidence:
  - consent prompt screenshot (EEA)
  - consent revocation screenshot
  - policy page screenshot with last updated date

## 3) Data and Source Attribution

- [ ] Verify eclipse catalog source references remain accurate and reachable.
- [ ] Keep source provenance note for generated eclipse dataset:
  - `modules/eclipse-events-data.js`
- [ ] Add disclaimer in user-facing docs that source catalogs are externally maintained and may change.

## 4) Mobile Store Readiness

- [ ] Confirm privacy labels (iOS) and data safety disclosure (Android) align with runtime behavior.
- [ ] Re-check third-party cookie behavior in mobile WebView and policy disclosure consistency.
- [ ] Confirm app metadata does not imply scientific endorsement by external agencies.
- [ ] Confirm app copy avoids store-policy risk language (misleading certainty claims).

## 5) Technical Release Gates

- [ ] Run web smoke test (desktop + mobile viewport).
- [ ] Run e2e test suite and store result artifact.
- [ ] Validate production build serves:
  - `index.html`
  - `privacy.html`
  - `ads.txt`
  - `robots.txt`
  - `sitemap.xml`
- [ ] Validate no broken links from settings -> privacy/consent actions.
- [ ] Validate no console errors on first load in production mode.

## 6) Suggested Evidence Folder

- [ ] Create `/output/release-evidence/2026-03-29/` (or current release date) and store:
  - compliance screenshots
  - test logs
  - final dependency license snapshot
  - final asset attribution snapshot

## 7) Final Go/No-Go

- [ ] Product owner sign-off
- [ ] Legal/compliance sign-off (or documented self-review with rationale)
- [ ] Engineering release sign-off
- [ ] Marketing copy sign-off
- [ ] Tag release and archive this checklist with outcome (`GO` or `NO-GO`)

