# Wave38 Domain F Final Unit Failure Fix Gnome Report

## Verdict

pass

## Context

This was a Gnome implementation/fix context delegated by Orch-Sylph for the Wave38 Domain F final unit verification failure. It was not a Review-Sylph review context.

## Root Cause Summary

The failure was not a production validator/runtime regression. Wave38 Domain C correctly strengthened deterministic mesh runtime/viewer evidence validation, including `mesh.runtimeEvidenceMismatch` and `mesh.orphanedVertex`.

The failing legacy tests and fixtures were stale in two ways:

- Several valid runtime/viewer fixtures constructed `NormalizedDrawable` values with vertices only, dropping package mesh `uvs`, `triangles`, and `vertexStableIds`. The validator then correctly reported runtime/package mesh evidence mismatch.
- Some expected fixture outputs predated the Wave38 mesh evidence shape fields `stableTriangleIdCount` and `hasStableTriangleIds`, or predated the new deterministic `mesh.orphanedVertex` diagnostic.

## Files Changed

- `packages/runtime-core/src/runtime-grid2d-keyform-fixture.test.ts`
- `packages/validator-core/src/dynamics-contract-evidence-fixture.test.ts`
- `packages/validator-core/src/rig-control-contract-evidence-fixture.test.ts`
- `packages/validator-core/src/viewer-evidence.test.ts`
- `fixtures/contracts/parent-child-rigControl-diagonal/runtime/runtime-graph.json`
- `fixtures/contracts/runtime-grid2d-keyform-evidence/expected/runtime-grid2d-keyform-evidence-summary.json`
- `fixtures/contracts/wave28-part-texture-layer-contract-fixtures/runtime/final-runtime-graph.json`
- `fixtures/contracts/wave29-mesh-edit-contract-fixtures/expected/runtime-viewer-evidence-summary.json`
- `fixtures/contracts/wave29-mesh-edit-contract-fixtures/expected/validation-report-summary.json`
- `fixtures/contracts/wave30-tutorial-mini-model-contract-fixtures/expected/runtime-viewer-evidence-summary.json`
- `discussion/implementation/waves/wave38/wave38-domain-f-final-unit-failure-fix-gnome-report.md`

## Verification Performed

- `pnpm.cmd exec vitest run packages\validator-core\src\dynamics-contract-evidence-fixture.test.ts packages\runtime-core\src\runtime-grid2d-keyform-fixture.test.ts packages\validator-core\src\wave29-mesh-edit-contract-fixtures.test.ts packages\validator-core\src\viewer-evidence.test.ts packages\validator-core\src\rig-control-contract-evidence-fixture.test.ts packages\runtime-core\src\wave30-tutorial-mini-model-contract-fixtures.test.ts packages\validator-core\src\wave28-part-texture-layer-contract-fixtures.test.ts`
  - Passed: 7 files, 12 tests.
- `pnpm.cmd exec vitest run packages\runtime-core\src\wave29-mesh-edit-contract-fixtures.test.ts`
  - Passed: 1 file, 1 test.
- `pnpm.cmd test:unit`
  - Passed: 193 files, 994 tests.
- `pnpm.cmd typecheck`
  - Passed.
- `git diff --check -- <touched files>`
  - Passed with CRLF normalization warnings only.
- `git diff --name-only -- package.json pnpm-lock.yaml pnpm-workspace.yaml packages\*\package.json apps\*\package.json`
  - No dependency manifest or lockfile diffs.

## Remaining Issues

None found for this narrow fix. Production source under `packages/validator-core/src/validators/mesh-semantics.ts` was not changed because the strengthened diagnostics are consistent with the Wave38 validator contract.

## User Decision Points

None.
