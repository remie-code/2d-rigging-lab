# Wave29 Domain E Mesh Edit Contract Fixtures Review

Date: 2026-06-02
Reviewer: Review-Sylph
Target: `wave29-mesh-edit-contract-fixtures`
Verdict: `pass`

## Scope Reviewed

- `fixtures/contracts/wave29-mesh-edit-contract-fixtures/**`
- `packages/operation-core/src/wave29-mesh-edit-contract-fixtures.test.ts`
- `packages/runtime-core/src/wave29-mesh-edit-contract-fixtures.test.ts`
- `packages/validator-core/src/wave29-mesh-edit-contract-fixtures.test.ts`
- `discussion/implementation/waves/wave29/wave29-domain-e-mesh-edit-contract-fixtures-gnome-report.md`

Supporting basis documents inspected included the Wave29 plan, source-file organization policy, dependency policy, schema/ID conventions, package/operation/validator/runtime fixture contract sections, fixture manifest, traceability matrix, and Wave29 Domain A/B/C reports and reviews.

## Findings

No blocking, high, medium, or low-severity findings.

## Review Lane: Design / Development Compliance

Pass.

- Domain E changes are contained to fixture JSON, focused fixture tests, and the Domain E report. No Editor UI implementation, broad runtime/validator implementation, package manifest, lockfile, parser, image decode, file picker, archive, external dependency, real asset byte, topology editor, UV editor, renderer, or pixel oracle implementation was introduced.
- Dependency manifest check produced no diff for `package.json`, `pnpm-lock.yaml`, or `pnpm-workspace.yaml`.
- `packages/operation-core/src/index.ts`, `packages/runtime-core/src/index.ts`, and `packages/validator-core/src/index.ts` were inspected and remain barrel-only export surfaces.
- Fixture IDs and check IDs are machine-readable and space-free. The fixture manifest uses `wave29-mesh-edit-contract-fixtures` and expected topology diagnostics `mesh.vertexStableIdsLengthMismatch`, `mesh.uvCountMismatch`, `mesh.triangleIndexOutOfRange`, and `mesh.degenerateTriangle` at `fixtures/contracts/wave29-mesh-edit-contract-fixtures/fixture-manifest.json:3` and `fixtures/contracts/wave29-mesh-edit-contract-fixtures/fixture-manifest.json:60`.
- Rights/provenance posture is clean for this domain: the fixture declares text-only generated geometry and `realAssetBytes=false`, `imageDecode=false`, `externalDependency=false` at `fixtures/contracts/wave29-mesh-edit-contract-fixtures/fixture-manifest.json:67`.
- The runtime/viewer fixture explicitly pins semantic evidence only and no renderer/pixel oracle boundary at `packages/runtime-core/src/wave29-mesh-edit-contract-fixtures.test.ts:26`, `packages/runtime-core/src/wave29-mesh-edit-contract-fixtures.test.ts:111`, and `fixtures/contracts/wave29-mesh-edit-contract-fixtures/expected/runtime-viewer-evidence-summary.json:130`.
- Editor-only selection evidence is deterministic and does not claim runtime rendering semantics at `packages/operation-core/src/wave29-mesh-edit-contract-fixtures.test.ts:177` and `fixtures/contracts/wave29-mesh-edit-contract-fixtures/expected/editor-selection-evidence-summary.json:4`.

## Review Lane: Test Adequacy

Pass.

- The operation fixture test runs the request chain through `operation-core` commit logic, then compares deterministic expected JSON for operation chain, package materialization, and editor-only selection evidence. The fixed oracle comparisons are at `packages/operation-core/src/wave29-mesh-edit-contract-fixtures.test.ts:59`, `packages/operation-core/src/wave29-mesh-edit-contract-fixtures.test.ts:62`, and `packages/operation-core/src/wave29-mesh-edit-contract-fixtures.test.ts:65`.
- The operation chain covers `createDrawable`, `generateMesh`, and multi-vertex `moveMeshVertex`; the multi-vertex deltas are pinned in `fixtures/contracts/wave29-mesh-edit-contract-fixtures/request/move-mesh-vertices-commit.request.json:12`.
- The runtime/viewer fixture builds baseline/final runtime graphs, calls `buildRuntimeEvidence` and `evaluateViewerRuntimeSnapshot`, and compares a deterministic expected summary at `packages/runtime-core/src/wave29-mesh-edit-contract-fixtures.test.ts:27`, `packages/runtime-core/src/wave29-mesh-edit-contract-fixtures.test.ts:29`, `packages/runtime-core/src/wave29-mesh-edit-contract-fixtures.test.ts:52`, and `packages/runtime-core/src/wave29-mesh-edit-contract-fixtures.test.ts:64`.
- The validator fixture validates the final package with viewer evidence and an invalid topology package, then compares a deterministic expected validation report at `packages/validator-core/src/wave29-mesh-edit-contract-fixtures.test.ts:49`, `packages/validator-core/src/wave29-mesh-edit-contract-fixtures.test.ts:59`, and `packages/validator-core/src/wave29-mesh-edit-contract-fixtures.test.ts:71`.
- Invalid topology coverage includes stable ID count mismatch, UV count mismatch, triangle index out of range, and degenerate triangle construction at `packages/validator-core/src/wave29-mesh-edit-contract-fixtures.test.ts:219` and `packages/validator-core/src/wave29-mesh-edit-contract-fixtures.test.ts:230`.
- These tests are not smoke-only: every lane asserts against checked-in expected fixture JSON.

## Verification Performed

Passed:

- `pnpm.cmd exec vitest run packages/operation-core/src/wave29-mesh-edit-contract-fixtures.test.ts packages/runtime-core/src/wave29-mesh-edit-contract-fixtures.test.ts packages/validator-core/src/wave29-mesh-edit-contract-fixtures.test.ts`
  - 3 files passed, 3 tests passed.
- `pnpm.cmd typecheck`
  - root `tsc --noEmit` and editor `tsc --noEmit -p tsconfig.json` passed.
- `git diff --check -- fixtures/contracts/wave29-mesh-edit-contract-fixtures packages/operation-core/src/wave29-mesh-edit-contract-fixtures.test.ts packages/runtime-core/src/wave29-mesh-edit-contract-fixtures.test.ts packages/validator-core/src/wave29-mesh-edit-contract-fixtures.test.ts discussion/implementation/waves/wave29/wave29-domain-e-mesh-edit-contract-fixtures-gnome-report.md`
  - produced no output. Domain E files are currently untracked, so this was supplemented with a direct scan.
- `rg -n '[ \t]+$' fixtures/contracts/wave29-mesh-edit-contract-fixtures packages/operation-core/src/wave29-mesh-edit-contract-fixtures.test.ts packages/runtime-core/src/wave29-mesh-edit-contract-fixtures.test.ts packages/validator-core/src/wave29-mesh-edit-contract-fixtures.test.ts discussion/implementation/waves/wave29/wave29-domain-e-mesh-edit-contract-fixtures-gnome-report.md discussion/implementation/reviews/wave29/wave29-domain-e-mesh-edit-contract-fixtures-review.md`
  - no trailing whitespace hits.
- `git diff -- package.json pnpm-lock.yaml pnpm-workspace.yaml`
  - no dependency manifest or lockfile diff.
- Focused forbidden-scope scans over Domain E fixtures/tests found only negative boundary assertions such as `pixelOracle=false`, `rendererOracle=false`, `imageDecode=false`, and package-name `Core` text. No forbidden asset/parser/dependency implementation path was found.
- `index.ts` files for operation-core, runtime-core, and validator-core were manually inspected and remain barrel-only.

## Skipped Verification

- Full `pnpm test:unit`, `pnpm test:e2e`, accessibility, and browser workflow tests were not run. Domain E is fixture-facing and does not implement Editor UI or browser workflow behavior.
- `pnpm run check:source` and `pnpm run check:deps` were not run; narrower source/dependency scans and manifest diff checks were run instead.

## Remaining Risks

- `discussion/tests/fixtures/fixture-manifest.md` and `discussion/tests/traceability/test-traceability-matrix.md` do not yet register `wave29-mesh-edit-contract-fixtures`. Existing mesh rows still point at `tutorial-like-authoring` and `invalid-mesh-triangle` at `discussion/tests/traceability/test-traceability-matrix.md:57` and `discussion/tests/traceability/test-traceability-matrix.md:58`. This is not blocking for Domain E because those paths are outside the Domain E allowed write scope and are explicitly suitable for Domain H integration registration.
- The operation, runtime, and validator fixture tests share checked-in fixture artifacts rather than passing the exact in-memory operation output across package test boundaries. This matches the existing Wave28 contract fixture pattern and is acceptable here because the checked-in expected summaries pin IDs, coordinates, hashes, diagnostics, and semantic boundaries deterministically.

## User-Decision Points

None.

## Source / Fixture Compliance Notes

- The fixture proves the requested generated mesh -> multi-vertex translate -> package materialization -> runtime/viewer semantic evidence -> validator report chain through deterministic artifacts.
- The fixture covers invalid topology diagnostics with at least one invalid case and actually pins four topology diagnostics.
- Editor-only selection evidence is deterministic and explicitly carries no runtime rendering semantics claim.
- Expected outputs are checked-in semantic JSON and rights-clean text geometry, not screenshots, renderer output, real image bytes, external model assets, or parser-derived data.
