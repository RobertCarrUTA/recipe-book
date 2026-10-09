# Redesign security and attribution review

Reviewed 2026-10-08 on `codex/173-release-integration`, including working-tree changes. Review began at `74bfa01ba7507fc7707e1b7093438dea0b184fe9` and checked the attribution correction at `b2e51af17301ce833c7fc222cabcb61126370510` plus uncommitted changes. This is a focused source/dependency review, **not final release signoff**. No browser or performance run, dependency installation, production change or whole-history secret audit was performed.

## Finding and correction

The supplemental `react-remove-scroll-bar@2.3.8` license was an empty tracked file. The installed package omits its license file, so `generate-notices.mjs` accepted that empty fallback and emitted only the package name and declared license. This dependency supplies Radix's scroll handling; its complete notice must accompany distribution.

The integration source now contains the full MIT copyright, grant and disclaimer, with upstream provenance in `vendor/licenses/README.md`. The corrected Git blob is `7c08c3990396ecefd90f99ff5d9a34f26f5b5616`. `readNotice` now rejects empty or whitespace-only installed and supplemental notices before writing attribution. `tests/license_notices.test.mjs` protects both failures and the supplemental copyright/grant. These source changes were inspected; regeneration and verification of the final distributed notice remain a release gate.

No additional concrete security defect was reproduced in the reviewed boundaries below. This does not establish absence of vulnerabilities.

## Reviewed boundaries

| Boundary | Evidence and conclusion |
| --- | --- |
| Production entry and CSP | `frontend/index.html` uses local entry/theme/assets, self-only network/worker sources, no base URI or objects, and no-referrer. Scripts permit self plus one generated recovery-script SHA-256 hash; there is no script `unsafe-inline` or `unsafe-eval`. Styles allow inline values for UI primitives. |
| Formatted CSP meta fix | `scripts/build-contract.mjs:addRecoveryBootstrap` now finds a multiline/reordered meta tag and preserves its attributes. In-memory checks against the actual formatted index verified the exact hash and one marked module; policies adding script `unsafe-inline`, `unsafe-eval` or external sources were rejected. This is controlled build-template handling, not a general HTML sanitizer. |
| Recovery bootstrap | `legacy-upgrade-bootstrap.js` checks the matching registration scope and reacts only to the marked entry-module failure. Its fallback UI uses `textContent`. `legacy-cache-recovery.js` considers only recognized legacy shell names, exact scope/index entries and expected legacy/new document markers; it does not import personal state or clear storage. Cached content and other applications on the same origin are not separate trust boundaries. |
| Release integrity | The worker receives canonical HTML and verifies each shell response against the generated SHA-256 inventory before accepting installation. Recipe responses have independent structural validation. `verify-build.mjs` checks artifact inventory, script hash, startup paths and release provenance. These hashes detect incomplete/mismatched output; they are not a signature against compromise of the publishing origin. |
| Recipe and manual text | React renders recipe titles, notes, instructions, nutrition and grocery text as values; no application `dangerouslySetInnerHTML`, HTML insertion, eval or dynamic code construction was found. `robustness.spec.ts` includes hostile markup and a JavaScript source link. The shared normalizer allows only HTTP(S) source links. |
| Links and downloads | External source links use `noopener noreferrer`; grocery queries are URL-encoded on a fixed Google search origin and suppress the referrer. Clean recipe routes require bounded slug IDs. Download text is placed in a Blob and object URLs are revoked. These explicit outbound actions are distinct from startup dependencies. |
| Backup input | The Settings file handler checks size before reading; storage validates bounded JSON structure and unsafe prototype-related keys before confirmation and durable replacement. The v7 snapshot/version fence and failed-read safeguards remain the data boundary; see [migration and recovery](redesign-migration.md). |
| Remote services and credentials | Startup uses local assets, system fonts and same-origin recipe requests. Application source contains no analytics client, remote font/CDN requirement or API credential configuration. A targeted current-tree scan found no common private-key, GitHub token, OpenAI token or AWS access-key signatures. It was not an exhaustive secret-history or dependency-malware scan. |

## Dependency and notice checks

Read-only traversal found 29 installed runtime dependency identities from the four direct dependencies. Their declarations are MIT, ISC or 0BSD; all identities appear in the generated notice inventory. Runtime React/React DOM peers are direct dependencies. Full Lucide ISC and Feather-derived MIT text is retained, and the supplemental scroll-bar notice was the only empty/missing full text found. The generator includes transitive dependency notices; the staging allowlist includes `THIRD_PARTY_NOTICES.txt`, the project license and `NOTICE`. Project license text is not substituted for third-party terms. Recipe rights were not re-audited; authored data was outside this change.

The lockfile uses registry HTTPS URLs and integrity values for all resolved packages. Its only `hasInstallScript` entry is optional development dependency `fsevents`; this metadata check is not an audit of every dependency's executable behavior. Development tooling is distinct from the distributed runtime graph.

Node `24.16.0` and npm `8.15.1` were available locally. The root agent ran fresh npm audits; the review inspected both `test-results/dependency-audit.json` and `production-dependency-audit.json`: zero reported vulnerabilities at every severity. npm reported 162 total dependency records, 33 production and 130 development in both reports; these are its emitted counts, distinct from the runtime traversal above. This is a registry advisory result for the reviewed lockfile, not proof against unknown vulnerabilities. Exact-release checks remain necessary; no dependency network request was made by this reviewer.

## Provenance and remaining release checks

The existing `dist` passed the read-only artifact verifier (14 files), but its provenance was an older dirty build: source `48e1c3df5ebb87e4b85e0c1012e1eb21b74a8cce`, release `ac79138fe282eaa15c102199`. It does not prove the corrected attribution or current integration was shipped. Rebuild from committed source, verify the complete notice in staged output, and run the final CSP/offline/browser gates against that exact release.

Key reviewed working-tree bytes (SHA-256) distinguish uncommitted changes from the base commits:

| File | SHA-256 |
| --- | --- |
| `scripts/build-contract.mjs` | `3e45528c5451b130daa27297ac0e8304359ae78b721331c2a7cb73118692070f` |
| `scripts/legacy-cache-recovery.js` | `031c083c0cfef22d743f1bfb278fe15c70b8536a865cc453757b4e2ff02a05b2` |
| `scripts/legacy-upgrade-bootstrap.js` | `6fcdb9bfcf6606d8c445fea58debad0b15f7c803697963182a4ec999f6dc6ed8` |
| `scripts/generate-notices.mjs` | `4081a83959b4286adcba121e85f5c99f61f245244084688dc09fc374119289a0` |
| `package-lock.json` | `2f1917154c797b74eb4442fab4d0b0a734c49a561184ce51fd92b69e8660d427` |
