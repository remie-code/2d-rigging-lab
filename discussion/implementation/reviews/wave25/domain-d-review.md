# Wave25 Domain D Review: Rig Control Fixtures And Contract Evidence

> Target: `wave25-rig-control-fixtures-contract-evidence`  
> Date: 2026-06-01  
> Role: Review-Sylph independent review  
> Implementer: `019e8030-6cd4-7282-b3b3-af9889e3b61b` / Gnome the 51st  
> Verdict: `pass`

## Scope Reviewed

This review did not edit source, tests, or fixtures. The only write is this review artifact.

Reviewed basis:

- `.agents/skills/implementation-orchestration/SKILL.md`
- `discussion/implementation/orchestration/wave25-plan.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/waves/wave24/wave24-final-report.md`
- `discussion/implementation/reviews/wave24/wave24-clean-integration-review.md`
- `discussion/implementation/waves/wave25/domain-a-completion-report.md`
- `discussion/implementation/reviews/wave25/domain-a-review.md`
- `discussion/tests/traceability/test-traceability-matrix.md`
- `discussion/tests/fixtures/fixture-manifest.md`
- Gnome report: `discussion/implementation/waves/wave25/domain-d-gnome-implementation-report.md`

Reviewed Domain D files:

- `fixtures/contracts/parent-child-rigControl-diagonal/**`
- `fixtures/contracts/invalid-rigControl-cycle/**`
- `packages/operation-core/src/rig-control-contract-evidence-fixture.test.ts`
- `packages/runtime-core/src/rig-control-contract-evidence-fixture.test.ts`
- `packages/validator-core/src/rig-control-contract-evidence-fixture.test.ts`
- `packages/validator-core/src/validators/rig-control-semantic.ts`

Also inspected related shared Wave25 B/C runtime and validator files because the Domain D tests directly exercise the runtime hierarchy/evidence and validator semantic APIs.

## Findings

No blocking or needs-fix findings for Domain D.

## Design / Development Compliance Review

Result: `pass`.

- `parent-child-rigControl-diagonal` is a deterministic semantic JSON fixture. It pins operation requests, operation result evidence, runtime hierarchy evidence, runtime diff evidence, validation report summary, and viewer-facing evidence summary.
- The valid fixture proves the intended chain at fixture level:
  - operation requests create `rig_body_rotation`, create `rig_arm_rotation`, bind child rig control, and bind `draw_arm`;
  - operation expected evidence pins dry-run immutability, committed operation order, final rig-control graph, and generated runtime/validation refs;
  - runtime expected evidence pins parent-before-child order, parent local/world angle `30`, child local angle `15`, child world angle `45`, affected drawable summary, transformed bounds, transformed vertices, and vertex hash;
  - validator expected evidence pins a passing report with runtime snapshot evidence and operation log evidence;
  - viewer-facing summary stays semantic and references snapshot/order/bounds/hash evidence, not pixels.
- `invalid-rigControl-cycle` pins a deterministic two-node cycle with formal `rigControl.cycle`, `blocking` severity, no runtime snapshot refs, and a runtime-blocking summary.
- Expected outputs are deterministic JSON contract evidence. I found no pixel/render oracle, image bytes, PSD/image decode, parser, file picker, archive, actual upload, external dependency, Cubism SDK/Core, Cubism Viewer compatibility, or Cubism Physics compatibility implementation in the reviewed scope.
- The fixture source assets are text-only generated fixture metadata with internal-test rights/provenance. No real asset bytes are introduced.
- Public `index.ts` changes in reviewed related scope remain barrel-only exports.
- Machine-readable fixture IDs, check IDs, operation IDs, package IDs, snapshot IDs, report IDs, target kinds, and target IDs obey the no-space convention in the reviewed fixture/test/source scope.
- No package manifest, workspace manifest, or lockfile changes were present.

Shared-worktree dependency note:

- Domain D fixture tests depend on parallel Domain B runtime files for `buildRuntimeEvidence`, rig-control hierarchy evaluation, snapshot projection, and runtime diff fields.
- Domain D fixture tests also depend on parallel Domain C validator files for `validatePackageRuntime` and formal rig-control diagnostics.
- This dependency is acceptable under the Wave25 batch model because B/C/D are parallel after Domain A, and Domain D's purpose is to fix contract evidence across operation/runtime/validator. This Domain D `pass` does not replace Domain B or Domain C review gates. At Domain D review time, Orch-Sylph still needed to close the Domain C loop separately before integration.

Integration update: Domain C is now recorded as `pass` in `discussion/implementation/reviews/wave25/domain-c-review.md` and `discussion/implementation/waves/wave25/domain-c-completion-report.md`.

## Test Adequacy Review

Result: `pass`.

- Operation fixture coverage parses all request JSON through operation-core DTOs, checks create dry-run immutability, commits the create/bind sequence, checks final rig-control graph shape, and verifies runtime/validator evidence refs on the final operation result.
- Runtime fixture coverage rebuilds runtime evidence from `runtime/runtime-graph.json` and exact-compares hierarchy and runtime diff summaries. It also checks viewer-facing semantic evidence against the actual candidate snapshot.
- Validator fixture coverage validates the parent-child fixture with runtime hierarchy evidence and validates the invalid cycle fixture with formal `rigControl.cycle`, expected diagnostics, and no generated runtime snapshot IDs.
- Focused supporting tests cover the underlying runtime hierarchy behavior and validator rig-control semantics. In the current worktree, `packages/validator-core/src/rig-control-semantic.test.ts` has 9 tests, including parentId-only cycles, parent/child mismatch, runtime mismatch, runtime missing evidence, and catalog registration.
- Existing Wave24 preview-vs-viewer equivalence remains compatible by focused rerun.
- Full unit verification passed after the focused checks, giving compatibility coverage for existing operation/runtime/validator/editor paths.

Residual test hardening that is not blocking for Domain D:

- The parent-child fixture chain is proven by focused operation/runtime/validator tests plus reviewed cross-file fixture consistency. It is not a single end-to-end runner that materializes runtime and validation artifacts directly from the committed operation session.
- The invalid fixture's runtime-blocking summary is asserted as contract evidence and the validator report proves `runtimeSnapshotIds: []`; it does not invoke a runtime evaluator on the invalid graph. This is acceptable because the blocking validator diagnostic is the intended gate for this fixture.

## Verification Performed

Initial sandboxed PowerShell commands failed with `windows sandbox: spawn setup refresh`, so required reads and verification commands were rerun with escalation.

| Check | Result |
|---|---|
| `git status --short -uall` | Reviewed shared Wave25 dirty worktree; Domain A plus parallel B/C/D files are present. |
| Focused rig-control run: `pnpm.cmd exec vitest run packages/runtime-core/src/rig-control-hierarchy-evidence.test.ts packages/runtime-core/src/rig-control-contract-evidence-fixture.test.ts packages/operation-core/src/rig-control-contract-evidence-fixture.test.ts packages/validator-core/src/rig-control-semantic.test.ts packages/validator-core/src/rig-control-contract-evidence-fixture.test.ts` | pass; 5 files / 19 tests |
| `pnpm.cmd exec vitest run packages/runtime-core/src/preview-viewer-equivalence-fixture.test.ts` | pass; 1 file / 1 test |
| `pnpm.cmd typecheck` | pass |
| `pnpm.cmd run check:source` | pass; source organization guard passed |
| `pnpm.cmd run check:deps` | pass; dependency guard passed |
| `git diff --check -- fixtures/contracts packages/operation-core packages/runtime-core packages/validator-core discussion/implementation/waves/wave25 discussion/implementation/reviews/wave25` | pass; LF/CRLF working-copy warnings only |
| `pnpm.cmd test:unit` | pass; 122 files / 616 tests |
| Manifest/lockfile dirty-status check | pass; no relevant package manifest or lockfile output |
| Targeted forbidden-scope scan over Domain D fixture/test/source files | pass; only benign hits such as "without a pixel oracle" test wording and `createOperationCore` identifier text |
| Machine-readable ID spacing scan over reviewed fixture/test/source files | pass; no output |

## Residual Risks

- Verification ran in a shared uncommitted workspace, not a fresh checkout replay.
- Domain D intentionally relies on the current parallel Domain B/C runtime and validator implementations. Final Wave25 integration must still require B and C to close their own review loops.
- Domain D does not provide browser/e2e UI proof. Editor workflow and persistence smoke remain later Wave25 domains.
- Runtime diff uses the existing `RuntimeDiffDto.parameterChanges` field-change channel for `/rigControls/...` evidence. This is schema-compatible and currently covered by tests, but the field name remains historically broader than just parameters.

## User Decision Points

None.

## Required Gnome Fix

None.
