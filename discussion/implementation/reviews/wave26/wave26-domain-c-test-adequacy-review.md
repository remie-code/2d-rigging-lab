# Wave 26 Domain C Test Adequacy Review

Verdict: `pass`

Reviewer: Review-Sylph, Wave 26 Domain C, lane 2

Re-review: fix loop 1

## Scope Reviewed

- `packages/validator-core/src/validators/rig-control-semantic.ts`
- `packages/validator-core/src/validators/rig-control-runtime-evidence.ts`
- `packages/validator-core/src/validators/rig-control-keyform-evidence.ts`
- `packages/validator-core/src/rig-control-semantic.test.ts`
- `packages/validator-core/src/rig-control-runtime-evidence.test.ts`
- `discussion/design/module-contracts/validator-contract.md`

Basis documents used:

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
- `discussion/design/module-contracts/validator-contract.md`
- `discussion/design/mvp-authoring-runtime/04-validator-acceptance-runner-design.md`

## Fix Loop 1 Findings

No remaining blocking or needs-fix findings in this lane.

Earlier finding 1 resolved: keyform-driven world transform mismatch is now covered. The source compares present `worldTransform.angleDegrees` and matrix evidence against the supplied local transform, composing with parent world transform when a parent exists. The new regression test asserts a present-but-wrong world transform fails with exact `expectedWorldAngleDegrees`, `runtimeWorldAngleDegrees`, `expectedWorldMatrix`, and `runtimeWorldMatrix` evidence.

Evidence:

- `packages/validator-core/src/validators/rig-control-keyform-evidence.ts:188` calls world-transform mismatch validation when both local and world transforms are present.
- `packages/validator-core/src/validators/rig-control-keyform-evidence.ts:261` computes expected world angle and matrix evidence.
- `packages/validator-core/src/rig-control-runtime-evidence.test.ts:162` adds the world-transform mismatch regression.
- `packages/validator-core/src/rig-control-runtime-evidence.test.ts:189` asserts the exact runtime-evidence check set for that case.

Earlier finding 2 resolved: stale and mismatch negative tests now assert exact relevant runtime-evidence check sets, order, status, severity, snapshot IDs, and evidence fields instead of only finding one check.

Evidence:

- `packages/validator-core/src/rig-control-runtime-evidence.test.ts:120` asserts the exact stale runtime-evidence summaries.
- `packages/validator-core/src/rig-control-runtime-evidence.test.ts:251` asserts the exact mismatch runtime-evidence summaries.
- `packages/validator-core/src/rig-control-runtime-evidence.test.ts:360` includes status, severity, snapshot IDs, and evidence in the summary helper.

Coverage remains adequate for Domain C pass evidence:

- Valid keyform-driven package with runtime evidence passes with no checks.
- Missing runtime evidence reports formal `rigControl.runtimeEvidenceMissing` diagnostics with required keyform refs.
- Stale runtime snapshot identity reports deterministic snapshot/package mismatch evidence.
- Mismatched keyform target metadata, composition, local/world transform, and affected target evidence are asserted through check IDs and evidence fields.
- Wave 25 cycle, missing parent/child, parent-child mismatch, invalid child target kind, and unsupported warp behavior remain covered.
- Full validator-core tests cover existing source/PSD/binary/dynamics/viewer validator compatibility.

## Verification Performed

Commands run:

- `pnpm.cmd exec vitest run packages/validator-core/src/rig-control-semantic.test.ts packages/validator-core/src/rig-control-runtime-evidence.test.ts`
  - Result: pass, 2 files / 15 tests.
- `pnpm.cmd exec vitest run packages/validator-core/src`
  - Result: pass, 14 files / 76 tests.
- `pnpm.cmd typecheck`
  - Result: pass.
- `pnpm.cmd run check:source`
  - Result: pass.
- `git diff --check -- packages/validator-core/src discussion/design/module-contracts/validator-contract.md`
  - Result: pass with LF/CRLF warnings only.

The sandboxed shell previously failed before PowerShell startup with `windows sandbox: spawn setup refresh`, so verification commands were run with approved escalation. The command strings above are the reproducible commands.

## Remaining Risks and Decision Points

- No user decision is required.
- Nonblocking residual risk: the parent-world composition branch was source-inspected, but there is not a separate child-keyform test that independently exercises a non-root rig control's parent-world composition. The current Domain C pass evidence is still adequate because the fix-loop regression proves present world transform mismatch detection for the keyform-driven rotation2d path and the source composes parent evidence in the shared comparison helper.
- I did not edit source files.
