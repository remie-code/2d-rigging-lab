# Wave28 Domain E Gnome Report: Part / Texture / Layer Contract Fixtures

## Verdict

pass

## Scope

- Target: `wave28-part-texture-layer-contract-fixtures`
- Implemented only contract fixtures, focused operation/runtime/validator fixture tests, and this report.
- No Editor UI implementation, renderer oracle, image decode, real asset bytes, dependency manifest, lockfile, or public `index.ts` implementation changes.

## Files Changed

Fixtures:

- `fixtures/contracts/wave28-part-texture-layer-contract-fixtures/fixture-manifest.json`
- `fixtures/contracts/wave28-part-texture-layer-contract-fixtures/baseline-package.json`
- `fixtures/contracts/wave28-part-texture-layer-contract-fixtures/request/create-part-commit.request.json`
- `fixtures/contracts/wave28-part-texture-layer-contract-fixtures/request/update-part-commit.request.json`
- `fixtures/contracts/wave28-part-texture-layer-contract-fixtures/request/set-drawable-part-commit.request.json`
- `fixtures/contracts/wave28-part-texture-layer-contract-fixtures/request/set-drawable-texture-commit.request.json`
- `fixtures/contracts/wave28-part-texture-layer-contract-fixtures/runtime/baseline-runtime-graph.json`
- `fixtures/contracts/wave28-part-texture-layer-contract-fixtures/runtime/final-runtime-graph.json`
- `fixtures/contracts/wave28-part-texture-layer-contract-fixtures/expected/operation-chain-summary.json`
- `fixtures/contracts/wave28-part-texture-layer-contract-fixtures/expected/package-materialization-summary.json`
- `fixtures/contracts/wave28-part-texture-layer-contract-fixtures/expected/runtime-viewer-evidence-summary.json`
- `fixtures/contracts/wave28-part-texture-layer-contract-fixtures/expected/validation-report-summary.json`
- `fixtures/contracts/wave28-part-texture-layer-contract-fixtures/expected/editor-layer-state-evidence-summary.json`

Focused tests:

- `packages/operation-core/src/wave28-part-texture-layer-contract-fixtures.test.ts`
- `packages/runtime-core/src/wave28-part-texture-layer-contract-fixtures.test.ts`
- `packages/validator-core/src/wave28-part-texture-layer-contract-fixtures.test.ts`

Report:

- `discussion/implementation/waves/wave28/domain-e-part-texture-layer-contract-fixtures-gnome-report.md`

## Fixture Evidence

- Fixture ID: `wave28-part-texture-layer-contract-fixtures`
- Operation chain: `createPart` -> `updatePart` -> `setDrawablePart` -> `setDrawableTexture`
- Package materialization: final package revision `4`, `part_face` parented under `part_root`, `draw_eye` reassigned to `part_face`, `draw_eye` assigned to existing atlas entry `tex_eye_alt`.
- Runtime/viewer evidence: semantic part hierarchy, drawable part membership, texture status, runtime diff paths, and viewer evidence are pinned in `expected/runtime-viewer-evidence-summary.json`.
- Validator evidence: valid final package passes viewer validation; invalid part and texture cases pin `ref.drawablePartMissing` and `ref.drawableTextureMissing`.
- Editor-only evidence: `selection`, `lockedIds`, and `editorHiddenIds` are pinned as `model/editor-state.json` evidence with `runtimeRenderingSemanticsClaim: "none"`.

## Rights / Oracle Boundary

- Fixture data is text-only generated geometry and metadata.
- Texture and preview assets are package-local references with hashes; no asset bytes are committed.
- No PSD parser, image decode, pixel renderer oracle, external runtime oracle, Cubism SDK/Core, or external dependency was used.

## Verification

Passed:

- `pnpm.cmd exec vitest run packages/operation-core/src/wave28-part-texture-layer-contract-fixtures.test.ts packages/runtime-core/src/wave28-part-texture-layer-contract-fixtures.test.ts packages/validator-core/src/wave28-part-texture-layer-contract-fixtures.test.ts`
  - 3 files / 4 tests passed.
- `pnpm.cmd exec vitest run packages/operation-core/src/wave28-part-texture-layer-contract-fixtures.test.ts packages/runtime-core/src/wave28-part-texture-layer-contract-fixtures.test.ts packages/validator-core/src/wave28-part-texture-layer-contract-fixtures.test.ts packages/operation-core/src/operations/part-operations.test.ts packages/operation-core/src/operations/drawable-part-texture-operations.test.ts packages/runtime-core/src/layer-tree-evidence.test.ts packages/validator-core/src/part-texture-layer-diagnostics.test.ts`
  - 7 files / 22 tests passed.
- `pnpm.cmd typecheck`
  - Root and editor typecheck passed.
- `git diff --check -- fixtures/contracts/wave28-part-texture-layer-contract-fixtures packages/operation-core/src/wave28-part-texture-layer-contract-fixtures.test.ts packages/runtime-core/src/wave28-part-texture-layer-contract-fixtures.test.ts packages/validator-core/src/wave28-part-texture-layer-contract-fixtures.test.ts discussion/implementation/waves/wave28/domain-e-part-texture-layer-contract-fixtures-gnome-report.md`
  - Passed with exit code 0.

## Remaining Issues

- None for Domain E.
- The fixture intentionally does not cover full Editor workflow wiring, app-shell UI, e2e persistence, image decoding, or pixel rendering. Those are later Wave28 domains or explicit non-goals.

## User Decision Points

- None.
