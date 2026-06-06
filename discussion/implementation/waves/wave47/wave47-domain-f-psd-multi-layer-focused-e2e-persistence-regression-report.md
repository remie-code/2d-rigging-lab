# Wave47 Domain F Report: PSD Multi-Layer Focused E2E Persistence Regression

> Target: `wave47-psd-multi-layer-focused-e2e-persistence-regression`
> Role: Gnome implementation agent
> Verdict candidate: `pass`

## Verdict Candidate

`pass`

Domain F added a focused standalone browser e2e proving explicit multi-layer PSD batch intake from private/local `test_data/sample_model.psd` works end-to-end through Editor UI selection, generated part scaffold batch commit, save/load persistence, and parser/public-asset boundary checks.

The e2e does not add product behavior, dependencies, public demo asset claims, all-layer import, recursive group import, drag-drop/archive/filesystem access, Photoshop compositing, renderer/pixel oracle checks, Cubism runtime/export, or repo-side AI inference/repair.

## Selected Layer Targets

All Domain A targets were selected through existing UI leaf-layer checkbox controls. No fallback was used.

- `headwear`: `psd:root/layer[0]`, digest `671e6a363745b1ce2e8d29c1a63438170fe9511c8884ea42298cf9b8886e5c1a`, byteLength `460800`
- `eyewear`: `psd:root/layer[3]`, digest `a5558168cbf75f7817a139131c764e317a77056138d6be0e591077b3e373e708`, byteLength `116600`
- `tie / tie`: `psd:root/group[6]/layer[0]`, digest `46ba1a95659ac420d37ca89b0ab919ca6ad2022280bb268313937fcd2cd69673`, byteLength `232960`

Destination parent part: `part_root`.

## Implementation Summary

- Added focused e2e script `apps/editor/e2e/psd-multi-layer-batch-focused-smoke.mjs`.
- Registered focused e2e id `psdMultiLayerBatchFocused` as standalone direct verification.
- Added e2e helper test ids for batch result, entries, diagnostics, form, submit, and selected refs.
- Added narrow fixture/traceability registration for `wave47-psd-multi-layer-focused-e2e-persistence-regression`.

The e2e verifies:

- explicit browser PSD file selection of `test_data/sample_model.psd`
- UI checkbox selection for `headwear`, `eyewear`, and `tie / tie`
- batch summary requested/success/failure counts `3 / 3 / 0`
- generated `part_*`, `draw_*`, `tex_*`, and `mesh_*` per-layer scaffold evidence
- batch id `batch_src_explicit_psd_sample_model_22406225_3`
- total materialized byte length `810360`
- destination kind `generatedPartScaffold` and parent `part_root`
- private/local provenance and `publicDemoAsset=false`
- persisted package texture binary refs without raw parser object, source PSD bytes, or inline raw RGBA payload persistence
- save/load reinspection with `Persistent bytes: 3 restored / 3 checked`
- parser import boundary guard remains enforced

## Files Changed

- `apps/editor/e2e/psd-multi-layer-batch-focused-smoke.mjs`
- `apps/editor/e2e/test-ids.mjs`
- `scripts/wave42-focused-e2e-boundary.mjs`
- `scripts/focused-e2e-registry.mjs`
- `discussion/tests/fixtures/fixture-manifest.md`
- `discussion/tests/traceability/test-traceability-matrix.md`
- `discussion/implementation/waves/wave47/wave47-domain-f-psd-multi-layer-focused-e2e-persistence-regression-report.md`

No product source files or package source files were edited by Domain F.

## Focused E2E

- id: `psdMultiLayerBatchFocused`
- command: `node scripts/run-focused-e2e.mjs --id psdMultiLayerBatchFocused`
- script: `apps/editor/e2e/psd-multi-layer-batch-focused-smoke.mjs`

Final e2e output:

- `desktop passed byteLength=22406225 materializedBytes=810360 layers=headwear,eyewear,tie/tie batch=batch_src_explicit_psd_sample_model_22406225_3`
- screenshot captured as PNG, base64 length `101448`
- smoke passed

## Verification Performed

Passed:

- `node scripts/run-focused-e2e.mjs --id psdMultiLayerBatchFocused`
- `node scripts/check-psd-parser-import-boundary.mjs`
- `node scripts/check-focused-e2e-registry.mjs`
- `pnpm.cmd typecheck`
- `pnpm.cmd run check:source`
- `pnpm.cmd run check:deps`
- `git diff --check -- apps/editor/e2e/psd-multi-layer-batch-focused-smoke.mjs apps/editor/e2e/test-ids.mjs scripts/wave42-focused-e2e-boundary.mjs scripts/focused-e2e-registry.mjs discussion/tests/fixtures/fixture-manifest.md discussion/tests/traceability/test-traceability-matrix.md`
- `node --check apps/editor/e2e/psd-multi-layer-batch-focused-smoke.mjs`

`git diff --check` reported CRLF normalization warnings only; no whitespace findings.

## Remaining Issues

None for the assigned Domain F scope.

The e2e verifies persisted batch evidence and save/load boundaries directly. It does not add Product Preflight UI wiring for batch evidence, because that would require product-source changes outside the allowed Domain F write scope.

## User-Decision Points

None.
