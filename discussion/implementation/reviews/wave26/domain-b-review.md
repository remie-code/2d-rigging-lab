# Wave 26 Domain B Review: Runtime Rig-Control Keyform Evidence Hardening

> Target: `wave26-runtime-rig-control-keyform-evidence-hardening`  
> Wave: Wave 26 `rig-control-keyform-viewer-hardening`  
> Role: Review-Sylph independent review  
> Verdict: `pass`

## Scope Reviewed

Reviewed changed files:

- `packages/runtime-core/src/snapshot-comparison.ts`
- `packages/runtime-core/src/rig-control-keyform-evidence.test.ts`

Reviewed basis:

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave26-plan.md`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/remaining-work-backlog.md`
- `discussion/implementation/waves/wave25/wave25-final-report.md`
- `discussion/implementation/reviews/wave25/wave25-clean-integration-review.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`
- `discussion/design/mvp-authoring-runtime/03-runtime-evaluation-semantics.md`

This reviewer did not edit source, tests, fixtures, package manifests, lockfiles, or implementation maps. The only write is this review artifact.

## Findings

No blocking, high, medium, or low findings for Domain B.

## Lane 1: Design / Development Compliance

Result: `pass`.

- The Wave26 plan assigns Domain B to runtime-core hardening: deterministic `rotation2d` keyform runtime evidence, local/world transform evidence, affected drawable evidence, runtime diff traceability, invalid patch diagnostics, and truthful `warpLattice2d` unsupported/no-op evidence (`discussion/implementation/orchestration/wave26-plan.md:167-196`).
- `snapshot-comparison.ts` keeps the change inside the existing runtime snapshot comparison path. Rig-control field changes are already appended to `RuntimeDiffDto.parameterChanges`; this diff adds world transform `angleDegrees`, `translation`, and `scale` paths beside the existing world matrix path (`packages/runtime-core/src/snapshot-comparison.ts:175-208`, `packages/runtime-core/src/snapshot-comparison.ts:284-314`). No schema compatibility change is introduced.
- The runtime semantics basis supports this direction: keyform sampling precedes rig-control evaluation, `rotation2d` propagates local affine state to children, snapshots can include full rig-control state, and unsupported future/runtime features should be recorded truthfully rather than evaluated (`discussion/design/mvp-authoring-runtime/03-runtime-evaluation-semantics.md:45-53`, `discussion/design/mvp-authoring-runtime/03-runtime-evaluation-semantics.md:139-163`, `discussion/design/mvp-authoring-runtime/03-runtime-evaluation-semantics.md:202-210`, `discussion/design/mvp-authoring-runtime/03-runtime-evaluation-semantics.md:290-302`).
- The changed scope stays within Domain B's allowed runtime-core area. I found no operation handler implementation, validator rewrite, editor UI implementation, full renderer/pixel oracle, direct physics, warp lattice evaluator, file picker/parser/archive/image decode, Cubism compatibility claim, or external dependency/package manifest/lockfile change in the Domain B diff.
- Source organization is acceptable. No `index.ts` implementation logic or catch-all production file is added. The new test file is long at 436 lines, but it is a focused runtime evidence integration test for one Domain B responsibility; `check:source` also passed in Orch-Sylph verification.
- Diagnostic/check IDs asserted by the new test use dot-separated lower camelCase and contain no spaces. A scan did not find the new runtime-only IDs such as `rigControl.invalidPatchShape` and `rigControl.warpLatticeUnsupported` in the validator check catalog; this is not a Domain B source blocker because the runtime diagnostics already exist in runtime-core and Domain C owns validator/report hardening. If these IDs become formal acceptance/validator checks, Domain C or final integration should record their catalog/contract status.

## Lane 2: Test Adequacy

Result: `pass`.

- The new runtime test directly covers the Domain B pass evidence: same input deterministic output, deterministic runtime diff, sampled `rigControl:rig_parent.angleDegrees` keyform metadata, local/world angle changes, child world transform propagation, affected drawable IDs, changed bounds/vertices, traceable `/rigControls/.../worldTransform/angleDegrees` runtime diff paths, and non-equivalent runtime evidence (`packages/runtime-core/src/rig-control-keyform-evidence.test.ts:20-91`).
- Invalid runtime keyform patches are covered with deterministic diagnostics for invalid patch shape, unsupported composition mode, and unsupported target property, and the test confirms invalid patches do not move the rig control or drawable (`packages/runtime-core/src/rig-control-keyform-evidence.test.ts:94-194`).
- `warpLattice2d` future-scope behavior is covered as unsupported/no-op evidence: keyform sample is retained, warning diagnostic is emitted, drawable vertices/bounds remain unchanged, and `runtimeDiff.drawableChanges` stays empty (`packages/runtime-core/src/rig-control-keyform-evidence.test.ts:202-258`).
- Existing related coverage remains compatible per provided verification: focused Domain B/runtime/viewer/keyform tests passed, and the full `packages/runtime-core/src` suite passed.
- Non-blocking coverage note: the new source diff also emits worldTransform `translation` and `scale` field changes, but the new angle-focused fixture does not force those fields to change independently. This is acceptable for the current Domain B objective because Wave26 explicitly centers the pass condition on `rotation2d:angleDegrees`; add direct translation/scale cases if those properties later become pass criteria.

## Verification Reviewed

Provided by Orch-Sylph and reviewed:

- `pnpm.cmd exec vitest run packages/runtime-core/src/rig-control-keyform-evidence.test.ts packages/runtime-core/src/rig-control-hierarchy-evidence.test.ts packages/runtime-core/src/viewer-evaluation.test.ts packages/runtime-core/src/runtime-keyform-snapshot-integration.test.ts`: pass, 4 files / 16 tests.
- `pnpm.cmd exec vitest run packages/runtime-core/src`: pass, 25 files / 76 tests.
- `pnpm.cmd run check:source`: pass.
- `pnpm.cmd run check:deps`: pass.
- `git diff --check -- packages/runtime-core/src discussion/implementation/waves/wave26 discussion/implementation/reviews/wave26`: pass, LF/CRLF warning only.
- `pnpm.cmd typecheck`: fail in shared worktree due validator-core `keyform` possibly undefined errors outside Domain B write scope.

Additional review checks performed here:

- Read the Domain B diff and new test directly.
- Read relevant Wave26 plan, Wave25 closure/review, capability/backlog, runtime semantics, source organization, dependency, and schema/ID convention passages.
- Inspected `snapshot-comparison.ts` rig-control diff generation around the changed paths.
- Inspected runtime rig-control evaluation/keyform-state code paths to verify the test is exercising existing runtime behavior rather than a forbidden evaluator rewrite.
- Ran read-only status, diff-name, line-count, diagnostic ID, forbidden-scope, and validator-core risk scans. I did not rerun Vitest or `typecheck` in this Review-Sylph context.

## External Integration Risk

The `pnpm.cmd typecheck` failure is external to Domain B. The implicated validator-core files are outside the Domain B allowed write scope and are part of Wave26 Domain C / shared worktree changes, not the reviewed runtime-core diff. It does not change the Domain B verdict, but it blocks final Wave26 integration until Domain C or final integration fixes and reruns typecheck.

## Remaining Issues / User Decision Points

- No Domain B source fix is required.
- No user decision is required for Domain B as long as Wave26 remains limited to `rotation2d:angleDegrees` semantic runtime evidence and `warpLattice2d` unsupported/no-op evidence.
- Final Wave26 integration must resolve the external validator-core typecheck failure before the whole wave can pass.
