# Asset Attribution Register

Last updated: 2026-03-29 (Asia/Seoul)
Directory scope: `assets/`

Purpose:
- Track provenance and commercial-use rights of bundled visual assets.
- Block release for any asset with unknown source/license.

## Status Legend

- `VERIFIED`: Source and license confirmed; commercial use permitted within terms.
- `PENDING`: Evidence partially collected; not yet release-safe.
- `BLOCKED`: Source/license unknown or incompatible for commercial release.

## Asset Table

| File | Current status | Original source URL | Author/Owner | License | Commercial use | Attribution required | Notes |
|---|---|---|---|---|---|---|---|
| `flat-earth-map.png` | BLOCKED | Internal VCS record: added in commit `69b0c641b67b71f533fb094f7a8a858cb81bf656` (2026-03-08) | `mingi <jmgi1024@gmail.com>` (repository contributor) | Not declared for this asset | Not approved (upstream source/license unknown) | TBD | Bundled base map. No authoritative external origin URL or license record found in repo. |
| `flat-earth-map-square.png` | BLOCKED | Internal VCS record: added in commit `69b0c641b67b71f533fb094f7a8a858cb81bf656` (2026-03-08) | `mingi <jmgi1024@gmail.com>` (repository contributor) | Not declared for this asset | Not approved (inherits `flat-earth-map.png` uncertainty) | TBD | Square-map texture; treated as derivative of base map unless proven otherwise. |
| `flat-earth-map-square.svg` | BLOCKED | Internal VCS record: added in commit `f703da836a729fdb74a34e9af94f3737573f4329` (2026-03-08) | `mingi <jmgi1024@gmail.com>` (repository contributor) | Not declared for this asset | Not approved (embedded raster origin unverified) | TBD | SVG embeds image data; rights chain must be documented from original source. |
| `moon-phases-360-ko.png` | PENDING | Internal VCS record: added in commit `79e92e01a8a5653ff82fe66df65c8e9af5799b58` (2026-03-11), updated in `f5ffa27f91f846c876e3f918362ad80831b72762` (2026-03-25) | `mingi <jmgi1024@gmail.com>` (repository contributor) | Not declared for this asset | Pending contributor confirmation and license declaration | TBD | Likely project-authored chart image, but no explicit rights/license statement in repository docs. |
| `social-preview.png` | BLOCKED | Internal VCS record: added in commit `73a4c7513741a77af60ae93b33cf245aa57c015a` (2026-03-19) | `mingi <jmgi1024@gmail.com>` (repository contributor) | Not declared for this asset | Not approved until embedded/derived components are fully verified | TBD | Social card artifact. Potentially derivative of in-app render path that may include blocked map texture. |
| `social-preview-scene.png` | BLOCKED | Internal VCS record: added in commit `73a4c7513741a77af60ae93b33cf245aa57c015a` (2026-03-19) | `mingi <jmgi1024@gmail.com>` (repository contributor) | Not declared for this asset | Not approved until source scene components are fully verified | TBD | Scene preview image used by `og-preview.html`; treat as derivative pending map-rights clearance. |
| `nasa-blue-marble-5400x2700.jpg` | VERIFIED | https://assets.science.nasa.gov/content/dam/science/esd/eo/images/bmng/bmng-base/january/world.200401.3x5400x2700.jpg | NASA Earth Observatory / Blue Marble Next Generation | NASA imagery usage policy (generally public-domain U.S. Government work; endorsement restrictions apply) | Allowed with policy compliance | Recommended | Used as spherical earth base texture in 3D globe stage. Do not imply NASA endorsement and do not use restricted NASA insignia. |

## Release Gate

Do not commercially release until all assets above are `VERIFIED` or removed from distribution.

## Evidence Checklist Per Asset

- [ ] Source URL recorded
- [ ] License text or authoritative reference captured
- [ ] Commercial-use allowance confirmed
- [ ] Attribution string documented (if required)
- [ ] Modifications documented (if applicable)
- [ ] Evidence file stored under `/output/release-evidence/<release-date>/assets/`
