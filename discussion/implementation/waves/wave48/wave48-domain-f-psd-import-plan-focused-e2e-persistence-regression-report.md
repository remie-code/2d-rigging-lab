# Wave48 Domain F Report: PSD Import Plan Focused E2E / Persistence Regression

> Target: `wave48-psd-import-plan-focused-e2e-persistence-regression`
> Role: Gnome implementation agent
> Verdict candidate: `pass`

## Verdict

verdict: `pass`

Wave48 Domain F is implemented within the focused e2e / registry / traceability scope. The new focused browser regression proves the accepted Domain A `psd:root` sample target, explicit approval of only `headwear`, `eyewear`, and `tie / tie`, approved-leaf-only batch execution, save/load persistence, portable JSON bundle boundary, and parser import containment.

The change does not edit product source hooks, package/validator source, dependency manifests, lockfiles, parser implementation, public demo assets, raw fixture bytes, or unrelated files.

## Implementation Summary

- Added focused e2e id `psdImportPlanFocused` through a post-Wave42 overlay in `scripts/focused-e2e-registry.mjs`, without editing `scripts/wave42-focused-e2e-boundary.mjs`.
- Added `apps/editor/e2e/psd-import-plan-focused-smoke.mjs`.
- Synced e2e test-id mirror entries for the Domain D import-plan panel test IDs.
- The new e2e uses `test_data/sample_model.psd`, parses it in the existing browser PSD adapter path, generates an import-plan preview for `psd:root`, and explicitly approves only:
  - `headwear` / `psd:root/layer[0]`
  - `eyewear` / `psd:root/layer[3]`
  - `tie / tie` / `psd:root/group[6]/layer[0]`
- The e2e verifies root preview facts: `126` candidates, `121` eligible candidates, `3` approved candidates, `123` not-approved candidates, `5` hidden/unsupported blocked candidates, source digest, private/local provenance, parser identity, and no unsupported UI claims.
- The e2e executes approved import-plan leaves through the approved batch action and verifies only the approved leaves become generated parts/textures/drawables/meshes.
- The e2e inspects browser-local saved project state and operation log JSON to verify parser-free `psd-import-plan-approval-bridge-evidence-v1`, candidate plan digest, approval evidence, approved-only boundary, not-approved/blocked candidate separation, source PSD metadata-only boundary, raw parser object `notPersisted`, `publicDemoAsset=false`, and no source PSD bytes/raw parser objects/raw visual bytes inline in package/session capability.
- The e2e verifies save/load clears session-only PSD parser/import-plan UI evidence while restoring the generated project assets from same-origin persistent bytes.
- The e2e verifies portable JSON export/import contains only the three approved materialized private/local texture payloads and does not include source PSD bytes or session import-plan bridge evidence as portable package capability.
- Updated fixture manifest and traceability matrix for `wave48-psd-import-plan-focused-e2e-persistence-regression` / `TC-WAVE48-PSD-IMPORT-PLAN-E2E-001`.

## Files Changed

- `apps/editor/e2e/psd-import-plan-focused-smoke.mjs`
- `apps/editor/e2e/test-ids.mjs`
- `scripts/focused-e2e-registry.mjs`
- `discussion/tests/fixtures/fixture-manifest.md`
- `discussion/tests/traceability/test-traceability-matrix.md`
- `discussion/implementation/waves/wave48/wave48-domain-f-psd-import-plan-focused-e2e-persistence-regression-report.md`

## Verification Performed

| Command / check | Result | Notes |
|---|---|---|
| `node --check apps/editor/e2e/psd-import-plan-focused-smoke.mjs` | pass | No syntax output. |
| `node scripts/run-focused-e2e.mjs --id psdImportPlanFocused` | pass | Initial sandboxed attempt failed at Vite/esbuild config load with `spawn EPERM`; approved escalated reruns were used. Final result: desktop passed, `byteLength=22406225`, `root=psd:root`, `candidates=126`, approved leaves `headwear,eyewear,tie/tie`, `materializedBytes=810360`, portable bundle bytes `1357158`, screenshot PNG captured. |
| `node scripts/run-focused-e2e.mjs --id psdMultiLayerBatchFocused` | pass | Approved escalated run. Desktop passed, `materializedBytes=810360`, layers `headwear,eyewear,tie/tie`. |
| `node scripts/run-focused-e2e.mjs --id psdImportFocused` | pass | Approved escalated run. Desktop passed, selected `headwear`, `materializedBytes=460800`, drawable `draw_headwear`, texture `tex_headwear`. |
| `node scripts/check-psd-parser-import-boundary.mjs` | pass | 5 direct import/resolve sites remain limited to approved adapter and Wave44 scripts. |
| `node scripts/check-focused-e2e-registry.mjs` | pass | 22 entries, 14 aggregate-discoverable, 8 standalone direct. |
| `git diff --check -- apps/editor/e2e scripts discussion/tests/fixtures/fixture-manifest.md discussion/tests/traceability/test-traceability-matrix.md` | pass | LF-to-CRLF working-copy warnings only. |

## Remaining Issues / Risks

- The focused e2e is desktop-only, matching the existing PSD focused smoke style.
- Product source behavior was not changed by Domain F. If later review requires portable bundles to persist parser-free import-plan bridge evidence, that would be a product/contract decision for a source domain; the current e2e records the observed boundary that portable bundle exports package document plus approved materialized texture payloads only.
- Existing Wave48 Domain A-E dirty worktree changes remain outside Domain F ownership and were not reverted or rewritten.

## User-Decision Points

None required for Domain F pass.
