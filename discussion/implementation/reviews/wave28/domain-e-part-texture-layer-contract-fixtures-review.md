# Wave28 Domain E Review: Part / Texture / Layer Contract Fixtures

## Verdict

pass

## Findings

No blocking or warning findings.

## Scope Reviewed

- Target: `wave28-part-texture-layer-contract-fixtures`
- Changed files reviewed: fixture JSON under `fixtures/contracts/wave28-part-texture-layer-contract-fixtures/**`, focused fixture tests in `packages/operation-core`, `packages/runtime-core`, and `packages/validator-core`, plus the Domain E Gnome report.
- Review mode: clean-context read-only review of source/fixtures. Only this review report was written.

## Design / Development Compliance

- Domain E scope matches the Wave28 plan: fixture contracts and focused tests are the allowed write scope, with Editor UI, broad runtime/validator implementation, pixel renderer oracles, real asset bytes, PSD parsing, image decode, external dependencies, and manifest changes forbidden (`discussion/implementation/orchestration/wave28-plan.md:294`, `discussion/implementation/orchestration/wave28-plan.md:301`, `discussion/implementation/orchestration/wave28-plan.md:308`).
- The fixture manifest declares the expected contract inputs/outputs and invalid part/texture cases (`fixtures/contracts/wave28-part-texture-layer-contract-fixtures/fixture-manifest.json:22`, `fixtures/contracts/wave28-part-texture-layer-contract-fixtures/fixture-manifest.json:31`, `fixtures/contracts/wave28-part-texture-layer-contract-fixtures/fixture-manifest.json:58`).
- Rights/oracle boundaries are explicit: no real asset bytes, no image decode, and semantic runtime/viewer evidence only (`fixtures/contracts/wave28-part-texture-layer-contract-fixtures/fixture-manifest.json:74`, `fixtures/contracts/wave28-part-texture-layer-contract-fixtures/fixture-manifest.json:75`, `fixtures/contracts/wave28-part-texture-layer-contract-fixtures/fixture-manifest.json:78`).
- A file type scan found only JSON files under the fixture directory. Package-local `.png` paths are metadata references in JSON, not committed asset bytes.
- No dependency manifest or lockfile changes were present in the reviewed scope. `git status --short -uall package.json pnpm-lock.yaml pnpm-workspace.yaml packages/operation-core/package.json packages/runtime-core/package.json packages/validator-core/package.json` returned no changes.
- Public `index.ts` files remain export-only barrels, consistent with the source organization policy (`packages/operation-core/src/index.ts:1`, `packages/runtime-core/src/index.ts:1`, `packages/validator-core/src/index.ts:1`; policy basis at `discussion/development_convention/source-file-organization-policy.md:26` and `discussion/development_convention/source-file-organization-policy.md:44`).
- Forbidden/non-goal term scan found only explicit negative oracle flags such as `imageDecode: false`, `pixelOracle: false`, and `rendererOracle: false`; no Cubism/Core/proprietary parser dependency or real decode/render path was introduced.

## Test Adequacy

- The operation fixture test parses request DTOs, commits the create/update/reassign/texture operation chain, materializes the package, and compares generated summaries to expected JSON (`packages/operation-core/src/wave28-part-texture-layer-contract-fixtures.test.ts:76`, `packages/operation-core/src/wave28-part-texture-layer-contract-fixtures.test.ts:79`, `packages/operation-core/src/wave28-part-texture-layer-contract-fixtures.test.ts:83`, `packages/operation-core/src/wave28-part-texture-layer-contract-fixtures.test.ts:86`, `packages/operation-core/src/wave28-part-texture-layer-contract-fixtures.test.ts:89`, `packages/operation-core/src/wave28-part-texture-layer-contract-fixtures.test.ts:178`).
- The expected operation chain pins the full sequence and final log length: `createPart`, `updatePart`, `setDrawablePart`, `setDrawableTexture`, and `finalOperationLogLength: 4` (`fixtures/contracts/wave28-part-texture-layer-contract-fixtures/expected/operation-chain-summary.json:5`, `:29`, `:55`, `:84`, `:107`).
- Package materialization pins `part_face`, `draw_eye` reassignment to that part, `tex_eye_alt`, and rights-clean flags (`fixtures/contracts/wave28-part-texture-layer-contract-fixtures/expected/package-materialization-summary.json:19`, `:37`, `:38`, `:46`).
- Runtime/viewer evidence is generated through runtime-core APIs and compared to fixture expectations (`packages/runtime-core/src/wave28-part-texture-layer-contract-fixtures.test.ts:33`, `packages/runtime-core/src/wave28-part-texture-layer-contract-fixtures.test.ts:44`, `packages/runtime-core/src/wave28-part-texture-layer-contract-fixtures.test.ts:52`). Expected evidence pins part hierarchy, drawable texture assignment, viewer equivalence, and non-renderer oracle flags (`fixtures/contracts/wave28-part-texture-layer-contract-fixtures/expected/runtime-viewer-evidence-summary.json:16`, `:51`, `:150`, `:162`).
- Validator coverage generates the valid viewer report plus invalid missing-part and missing-texture reports, then compares the summarized result to expected JSON (`packages/validator-core/src/wave28-part-texture-layer-contract-fixtures.test.ts:45`, `packages/validator-core/src/wave28-part-texture-layer-contract-fixtures.test.ts:55`, `packages/validator-core/src/wave28-part-texture-layer-contract-fixtures.test.ts:63`, `packages/validator-core/src/wave28-part-texture-layer-contract-fixtures.test.ts:76`). Expected diagnostics include `ref.drawablePartMissing` and `ref.drawableTextureMissing` (`fixtures/contracts/wave28-part-texture-layer-contract-fixtures/expected/validation-report-summary.json:34`, `fixtures/contracts/wave28-part-texture-layer-contract-fixtures/expected/validation-report-summary.json:60`).
- Editor-only layer evidence is deterministic and does not claim runtime rendering semantics: `runtimeRenderingSemanticsClaim` is `none`, while runtime visibility remains separate from editor hide (`fixtures/contracts/wave28-part-texture-layer-contract-fixtures/expected/editor-layer-state-evidence-summary.json:4`, `:15`, `:19`).
- The tests compare generated/evaluated summaries to expected outputs; they are not limited to JSON parsing.

## Verification Run

Executed:

- `git status --short -uall <Domain E paths>`: reviewed files were untracked Domain E files before this report was written.
- `pnpm.cmd exec vitest run packages/operation-core/src/wave28-part-texture-layer-contract-fixtures.test.ts packages/runtime-core/src/wave28-part-texture-layer-contract-fixtures.test.ts packages/validator-core/src/wave28-part-texture-layer-contract-fixtures.test.ts`: passed, 3 files / 4 tests.
- `git diff --check -- fixtures/contracts/wave28-part-texture-layer-contract-fixtures packages/operation-core/src/wave28-part-texture-layer-contract-fixtures.test.ts packages/runtime-core/src/wave28-part-texture-layer-contract-fixtures.test.ts packages/validator-core/src/wave28-part-texture-layer-contract-fixtures.test.ts discussion/implementation/waves/wave28/domain-e-part-texture-layer-contract-fixtures-gnome-report.md`: passed.
- `pnpm.cmd typecheck`: passed root and editor typecheck.

Not rerun:

- Expanded A/B/C dependency focused run. I reviewed the relevant Domain E fixture/tests directly and reran the Domain E focused tests plus typecheck; the broader dependency run remains covered by the Gnome verification summary.

## Remaining Issues

- None for Domain E.

## User Decision Points

- None.
