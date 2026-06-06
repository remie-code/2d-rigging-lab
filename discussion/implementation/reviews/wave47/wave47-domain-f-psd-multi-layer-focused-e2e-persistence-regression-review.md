# Wave47 Domain F Review: PSD Multi-Layer Focused E2E Persistence Regression

> Target: `wave47-psd-multi-layer-focused-e2e-persistence-regression`
> Role: Review-Sylph independent reviewer
> Verdict: `pass`

## Verdict

`pass`

Blocking findings: none.

No design/development-compliance or test-adequacy issue was found for the Domain F scope. The reviewed changes add a standalone focused e2e and narrow registry/docs registration only; they do not add product/package implementation, dependencies, public demo asset claims, broad aggregate e2e expansion, File System Access/drag-drop/archive paths, all-layer/recursive import, renderer/pixel oracle, Cubism runtime/export, or AI repair inference.

The wider worktree contains product/package source changes from accepted Wave47 Domains A-E. I did not treat those as Domain F changes; the Domain F target set I reviewed is limited to the files listed below.

## Scope Reviewed

- `apps/editor/e2e/psd-multi-layer-batch-focused-smoke.mjs`
- `apps/editor/e2e/test-ids.mjs`
- `scripts/wave42-focused-e2e-boundary.mjs`
- `scripts/focused-e2e-registry.mjs`
- `discussion/tests/fixtures/fixture-manifest.md`
- `discussion/tests/traceability/test-traceability-matrix.md`
- `discussion/implementation/waves/wave47/wave47-domain-f-psd-multi-layer-focused-e2e-persistence-regression-report.md`

## Design / Development Compliance

- Pass: Domain F edits stay in the allowed e2e, focused registry/guard, fixture/traceability, and report paths. `git status --short -uall` for the reviewed target paths shows only the new e2e plus the narrow test-id, script, and docs updates; package manifests and lockfiles have no diff.
- Pass: No product implementation or package source file is changed by the Domain F target set. Existing A-E source changes remain outside this review attribution.
- Pass: The new focused registry entry is standalone direct verification, not aggregate expansion. `scripts/focused-e2e-registry.mjs:115` registers `psdMultiLayerBatchFocused` with `aggregateInclusion: standaloneDirectVerification` at `scripts/focused-e2e-registry.mjs:119`; `scripts/wave42-focused-e2e-boundary.mjs:102` adds the matching boundary entry.
- Pass: Parser import boundary remains guarded. The e2e expects parser metadata from the existing browser adapter surface (`apps/editor/e2e/psd-multi-layer-batch-focused-smoke.mjs:252`) and the guard run confirmed direct parser import/resolve sites remain limited to the approved adapter and Wave44 scripts.
- Pass: Persistence/public-asset boundaries are represented truthfully. The e2e checks raw PSD bytes are not persisted by the parser bridge (`apps/editor/e2e/psd-multi-layer-batch-focused-smoke.mjs:250`), parser objects and PSD bytes are not project persistence capabilities (`apps/editor/e2e/psd-multi-layer-batch-focused-smoke.mjs:258`, `:261`), committed provenance remains private/local with `publicDemoAsset=false` (`apps/editor/e2e/psd-multi-layer-batch-focused-smoke.mjs:380`), and saved payloads do not contain raw parser/source/raw byte claims (`apps/editor/e2e/psd-multi-layer-batch-focused-smoke.mjs:647`).
- Pass: Forbidden capability claims are actively checked in the e2e panel for public demo asset wording, raw/visual byte persistence, Cubism compatibility, archive import, drag-drop, all-layer import, and recursive group import (`apps/editor/e2e/psd-multi-layer-batch-focused-smoke.mjs:840`).

## Test Adequacy

- Pass: The e2e uses private/local `test_data/sample_model.psd` through explicit browser file selection. The sample path is fixed at `apps/editor/e2e/psd-multi-layer-batch-focused-smoke.mjs:16`, and the test drives the file input plus import submit at `apps/editor/e2e/psd-multi-layer-batch-focused-smoke.mjs:108`.
- Pass: It selects exactly Domain A's three target leaf refs: `headwear`, `eyewear`, and `tie / tie`, with the accepted byte lengths and digests recorded at `apps/editor/e2e/psd-multi-layer-batch-focused-smoke.mjs:36`. Selection goes through the existing leaf checkbox controls and throws if any requested ref is missing or disabled (`apps/editor/e2e/psd-multi-layer-batch-focused-smoke.mjs:286`).
- Pass: It executes batch materialize/add-to-project with destination parent `part_root`: `destinationParentPartId` is fixed at `apps/editor/e2e/psd-multi-layer-batch-focused-smoke.mjs:34`, set through the batch form at `apps/editor/e2e/psd-multi-layer-batch-focused-smoke.mjs:121`, and submitted at `apps/editor/e2e/psd-multi-layer-batch-focused-smoke.mjs:124`.
- Pass: Batch summary assertions cover requested/success/failure counts, materialization counts, destination parent, destination kind, total materialized byte length, private/local provenance, and `publicDemoAsset=false` at `apps/editor/e2e/psd-multi-layer-batch-focused-smoke.mjs:373`.
- Pass: Per-layer success assertions cover source refs/paths, generated part/drawable/texture/mesh IDs, byte lengths, public demo flag, and commit diagnostics at `apps/editor/e2e/psd-multi-layer-batch-focused-smoke.mjs:386`.
- Pass: Saved project assertions inspect the serialized local project, package file set, operation log, source manifest, graph, drawables, meshes, and texture atlas. They confirm source PSD bytes are not persisted (`apps/editor/e2e/psd-multi-layer-batch-focused-smoke.mjs:547`), texture binary refs carry digest/byteLength/media type/storage status (`apps/editor/e2e/psd-multi-layer-batch-focused-smoke.mjs:553`), batch evidence has success counts/destination/persistence boundary (`apps/editor/e2e/psd-multi-layer-batch-focused-smoke.mjs:593`), and raw parser/source/raw byte claims are absent (`apps/editor/e2e/psd-multi-layer-batch-focused-smoke.mjs:647`).
- Pass: Load/reinspect assertions verify the explicit PSD import session evidence is cleared after reload (`apps/editor/e2e/psd-multi-layer-batch-focused-smoke.mjs:703`) while project graph/source/texture references remain restored through same-origin browser-local persistent bytes (`apps/editor/e2e/psd-multi-layer-batch-focused-smoke.mjs:721`).
- Pass: Fixture and traceability registration is narrow and controlled. The e2e self-check requires the Wave47 fixture and traceability tokens (`apps/editor/e2e/psd-multi-layer-batch-focused-smoke.mjs:914`); the docs add one warning-gated fixture row and one traceability row for `TC-WAVE47-PSD-MULTI-LAYER-BATCH-E2E-001`.

## Verification Performed

Passed:

- `node scripts/run-focused-e2e.mjs --id psdMultiLayerBatchFocused`
  - Result: desktop passed, source byteLength `22406225`, materializedBytes `810360`, layers `headwear,eyewear,tie/tie`, batch `batch_src_explicit_psd_sample_model_22406225_3`, screenshot PNG base64 length `101448`.
- `node scripts/check-psd-parser-import-boundary.mjs`
  - Result: passed; `5` direct import/resolve sites limited to approved adapter and Wave44 scripts.
- `node scripts/check-focused-e2e-registry.mjs`
  - Result: passed; `21` entries, `14` aggregate-discoverable, `7` standalone direct.
- `pnpm.cmd typecheck`
  - Result: passed root `tsc --noEmit` and editor typecheck.
- `pnpm.cmd run check:source`
  - Result: source organization guard passed.
- `pnpm.cmd run check:deps`
  - Result: dependency guard passed.
- `git diff --check -- apps/editor/e2e/psd-multi-layer-batch-focused-smoke.mjs apps/editor/e2e/test-ids.mjs scripts/wave42-focused-e2e-boundary.mjs scripts/focused-e2e-registry.mjs discussion/tests/fixtures/fixture-manifest.md discussion/tests/traceability/test-traceability-matrix.md`
  - Result: no whitespace findings; Git emitted LF-to-CRLF normalization warnings for existing working-copy files.
- `node --check apps/editor/e2e/psd-multi-layer-batch-focused-smoke.mjs`
  - Result: passed.

## Files Changed By This Review

- `discussion/implementation/reviews/wave47/wave47-domain-f-psd-multi-layer-focused-e2e-persistence-regression-review.md`

## Remaining Issues

None for Domain F.

## User-Decision Points

None.
