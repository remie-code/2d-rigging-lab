# Wave 26 Domain C Design / Development Compliance Review

> Target: Wave 26 Domain C, lane 1  
> Domain: `wave26-validator-report-hardening`  
> Role: Review-Sylph independent reviewer  
> Date: 2026-06-01  
> Latest review: fix loop 2 final re-review  
> Verdict: `pass`

## Scope Reviewed

Reviewed as an independent compliance pass. I did not edit source files. The only write is this report.

Basis documents reviewed:

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

Changed files inspected:

- `discussion/design/module-contracts/validator-contract.md`
- `packages/validator-core/src/rig-control-runtime-evidence.test.ts`
- `packages/validator-core/src/rig-control-semantic.test.ts`
- `packages/validator-core/src/validators/rig-control-keyform-evidence.ts`
- `packages/validator-core/src/validators/rig-control-runtime-evidence.ts`
- `packages/validator-core/src/validators/rig-control-semantic.ts`

## Findings

No material remaining findings.

The prior runtime-core angle mismatch finding is closed. `packages/validator-core/src/validators/rig-control-keyform-evidence.ts:282` now composes the expected world matrix from parent/local runtime evidence, and `packages/validator-core/src/validators/rig-control-keyform-evidence.ts:285` derives expected world angle from that matrix with `Math.atan2(matrix.b, matrix.a)`. This matches runtime-core's world angle construction at `packages/runtime-core/src/rig-control-evaluation.ts:232` and `packages/runtime-core/src/rig-control-evaluation.ts:380`.

The focused regression at `packages/validator-core/src/rig-control-runtime-evidence.test.ts:52` covers the previously risky case: a child rig control under a non-uniformly scaled parent, where simple parent-angle-plus-local-angle logic would be wrong. The test asserts the matrix-derived child world angle is not the local 45 degrees and still validates cleanly.

## Compliance Notes

- Scope containment: pass. The Domain C changes stay in validator-core, validator-focused tests, and the targeted validator contract doc. I saw no operation handler, runtime evaluator implementation, editor UI, broad report redesign, dependency/manifest/lockfile, file I/O, parser, image decode, or Cubism compatibility expansion in the reviewed files.
- Source organization: pass. `rig-control-semantic.ts` delegates runtime/keyform evidence into named validator files, and `packages/validator-core/src/index.ts` remains barrel-only. `check:source` passed.
- Dependency policy: pass. No manifest or lockfile diff in the reviewed manifests; `check:deps` passed. Imports remain existing workspace packages, Vitest in tests, and relative modules.
- Schema / check ID alignment: pass. `rigControl.runtimeEvidenceMissing` remains in the existing `rigControl_evaluation` phase, with deterministic machine-readable evidence strings and snapshot IDs.
- Compatibility: pass based on full validator-core coverage. Existing source/PSD/binary/dynamics/viewer validator tests passed in the full suite.

## Verification Performed

| Check | Result |
|---|---|
| `pnpm.cmd exec vitest run packages/validator-core/src/rig-control-semantic.test.ts packages/validator-core/src/rig-control-runtime-evidence.test.ts` | pass, 2 files / 16 tests |
| `pnpm.cmd exec vitest run packages/validator-core/src` | pass, 14 files / 77 tests |
| `pnpm.cmd typecheck` | pass |
| `pnpm.cmd run check:source` | pass |
| `pnpm.cmd run check:deps` | pass |
| `git diff -- package.json pnpm-lock.yaml pnpm-workspace.yaml apps/editor/package.json packages/validator-core/package.json packages/runtime-core/package.json packages/operation-core/package.json packages/authoring-core/package.json` | pass, no output |
| `git diff --check -- packages/validator-core/src discussion/design/module-contracts/validator-contract.md discussion/implementation/reviews/wave26/wave26-domain-c-design-development-review.md` | pass with LF/CRLF working-copy warnings only |

## User Decision Points

None.

## Residual Risks

- Validator-core still relies on supplied runtime snapshot evidence instead of independently recomputing the full rig-control hierarchy. That is appropriate for Domain C's boundary and avoids the forbidden runtime evaluator expansion.
- Full monorepo unit/e2e was not rerun in this review context; the design/development compliance gate is satisfied by focused validator tests, full validator-core tests, typecheck, source guard, dependency guard, and diff/dependency checks.
