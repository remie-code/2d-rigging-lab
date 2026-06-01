# Wave25 Domain D Completion Report

> Target: `wave25-rig-control-fixtures-contract-evidence`  
> Date: 2026-06-01  
> Orch-Sylph: current context  
> Gnome implementation: `019e8030-6cd4-7282-b3b3-af9889e3b61b` / Gnome the 51st  
> Review-Sylph: `019e804f-7069-7511-baff-38412b99cb69` / Sylph the 53rd  
> Status: `pass`

## Summary

Domain D is `pass`.

Gnome added deterministic rig-control contract evidence for the `parent-child-rigControl-diagonal` and `invalid-rigControl-cycle` fixture families. Review-Sylph independently reviewed the basis documents, changed fixture/source/test files, actual diff/status, Gnome implementation report, and verification results, and returned `pass` with no blocking or needs-fix findings.

This domain does not implement editor UI, pixel/render oracles, real asset bytes, PSD/image decode/parser behavior, file picker/archive/upload behavior, external dependencies, package manifest or lockfile changes, or Cubism SDK/Core, Cubism Viewer, or Cubism Physics compatibility claims.

## Changed Files

Fixture artifacts:

- `fixtures/contracts/parent-child-rigControl-diagonal/fixture-manifest.json`
- `fixtures/contracts/parent-child-rigControl-diagonal/baseline-package.json`
- `fixtures/contracts/parent-child-rigControl-diagonal/request/create-parent-dry-run.request.json`
- `fixtures/contracts/parent-child-rigControl-diagonal/request/create-parent-commit.request.json`
- `fixtures/contracts/parent-child-rigControl-diagonal/request/create-child-commit.request.json`
- `fixtures/contracts/parent-child-rigControl-diagonal/request/bind-child-rig-commit.request.json`
- `fixtures/contracts/parent-child-rigControl-diagonal/request/bind-child-drawable-commit.request.json`
- `fixtures/contracts/parent-child-rigControl-diagonal/runtime/runtime-graph.json`
- `fixtures/contracts/parent-child-rigControl-diagonal/expected/operation-result-evidence-summary.json`
- `fixtures/contracts/parent-child-rigControl-diagonal/expected/runtime-hierarchy-evidence-summary.json`
- `fixtures/contracts/parent-child-rigControl-diagonal/expected/runtime-diff-summary.json`
- `fixtures/contracts/parent-child-rigControl-diagonal/expected/validation-report-summary.json`
- `fixtures/contracts/parent-child-rigControl-diagonal/expected/viewer-facing-evidence-summary.json`
- `fixtures/contracts/invalid-rigControl-cycle/fixture-manifest.json`
- `fixtures/contracts/invalid-rigControl-cycle/package.json`
- `fixtures/contracts/invalid-rigControl-cycle/expected/expected-diagnostics.json`
- `fixtures/contracts/invalid-rigControl-cycle/expected/runtime-blocking-summary.json`
- `fixtures/contracts/invalid-rigControl-cycle/expected/validation-report-summary.json`

Focused tests and fixture-facing source:

- `packages/operation-core/src/rig-control-contract-evidence-fixture.test.ts`
- `packages/runtime-core/src/rig-control-contract-evidence-fixture.test.ts`
- `packages/validator-core/src/rig-control-contract-evidence-fixture.test.ts`
- `packages/validator-core/src/validators/rig-control-semantic.ts`

Reports:

- `discussion/implementation/waves/wave25/domain-d-gnome-implementation-report.md`
- `discussion/implementation/reviews/wave25/domain-d-review.md`
- `discussion/implementation/waves/wave25/domain-d-completion-report.md`

Shared worktree note:

- The workspace also contains Domain A and apparent parallel Domain B/C dirty files. Domain D did not revert those changes. Review-Sylph noted that Domain D fixtures intentionally rely on the current parallel Domain B runtime and Domain C validator implementations; B/C still require their own review closure.

## Implemented Evidence

`parent-child-rigControl-diagonal` now pins:

- operation requests for parent rotation rig creation, child rotation rig creation, child rig binding, and child drawable binding;
- operation-result evidence for dry-run immutability, committed operation order, final rig-control graph, and runtime/validation evidence refs;
- runtime hierarchy evidence with parent-before-child order, parent local/world angle `30`, child local angle `15`, and child world angle `45`;
- runtime diff evidence for affected drawable bounds, transformed vertices, and vertex hash;
- validation report evidence for the valid package/runtime evidence path;
- viewer-facing semantic evidence that stays contract-level and does not use pixels.

`invalid-rigControl-cycle` now pins:

- a two-node rig-control cycle package;
- expected blocking `rigControl.cycle` diagnostic evidence;
- validation report summary with no runtime snapshot refs;
- runtime-blocking summary proving no successful topological evaluation is expected.

## Verification

Review-Sylph reported the following verification as passing:

| Check | Result |
|---|---|
| `pnpm.cmd exec vitest run packages/runtime-core/src/rig-control-hierarchy-evidence.test.ts packages/runtime-core/src/rig-control-contract-evidence-fixture.test.ts packages/operation-core/src/rig-control-contract-evidence-fixture.test.ts packages/validator-core/src/rig-control-semantic.test.ts packages/validator-core/src/rig-control-contract-evidence-fixture.test.ts` | pass; 5 files / 19 tests |
| `pnpm.cmd exec vitest run packages/runtime-core/src/preview-viewer-equivalence-fixture.test.ts` | pass; 1 file / 1 test |
| `pnpm.cmd typecheck` | pass |
| `pnpm.cmd run check:source` | pass |
| `pnpm.cmd run check:deps` | pass |
| `git diff --check -- fixtures/contracts packages/operation-core packages/runtime-core packages/validator-core discussion/implementation/waves/wave25 discussion/implementation/reviews/wave25` | pass; LF/CRLF working-copy warnings only |
| `pnpm.cmd test:unit` | pass; 122 files / 616 tests |
| Manifest/lockfile dirty-status check | pass; no relevant package manifest or lockfile output |
| Targeted forbidden-scope scan over Domain D fixture/test/source files | pass; benign hits only |
| Machine-readable ID spacing scan over reviewed fixture/test/source files | pass |

Gnome also reported the same focused fixture, Wave24 equivalence, typecheck, source guard, dependency guard, and diff-check results before review.

## Review Result

Review artifact: `discussion/implementation/reviews/wave25/domain-d-review.md`.

Verdict: `pass`.

Findings:

- No blocking findings.
- No needs-fix findings.

Review-Sylph confirmed that the fixtures are deterministic JSON contract evidence, avoid forbidden renderer/asset/dependency/Cubism scopes, keep public `index.ts` changes barrel-only in the reviewed related scope, satisfy machine-readable ID conventions, and provide adequate operation/runtime/validator focused coverage for Domain D.

## Residual Risks

- Verification ran in a shared uncommitted workspace, not a fresh checkout replay.
- Domain D intentionally relies on the current parallel Domain B runtime and Domain C validator implementations. Final Wave25 integration must still require B and C to close their own review loops.
- Domain D does not provide browser/e2e UI proof. Editor workflow and persistence smoke remain later Wave25 domains.
- The parent-child fixture chain is proven through focused operation/runtime/validator tests and cross-file fixture consistency, not through a single end-to-end artifact materializer.
- Runtime diff uses the existing `RuntimeDiffDto.parameterChanges` field-change channel for `/rigControls/...` evidence; this is schema-compatible and covered by tests, but the field name remains historically broader than rig controls.

## User Decision Points

None.

No source-document conflict, dependency approval need, forbidden scope need, or unclear module boundary was found for Domain D.
