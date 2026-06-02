# Wave32 Domain C Clean Context Review

Target: `wave32-validator-warp-lattice-diagnostics`
Reviewer: Review-Sylph clean-context reviewer
Date: 2026-06-02
Verdict: `pass`

## Scope Reviewed

Reviewed the Domain C validator changes and relevant contracts without using the implementation report as the sole evidence.

- `packages/validator-core/src/validators/warp-lattice-diagnostics.ts`
- `packages/validator-core/src/validators/warp-lattice-schema-issues.ts`
- `packages/validator-core/src/warp-lattice-diagnostics.test.ts`
- `packages/validator-core/src/check-catalog.ts`
- `packages/validator-core/src/rig-control-runtime-evidence.test.ts`
- `packages/validator-core/src/validators/package-schema.ts`
- `packages/validator-core/src/validators/rig-control-keyform-evidence.ts`
- `packages/validator-core/src/validators/rig-control-semantic.ts`
- `discussion/design/module-contracts/validator-contract.md`
- `discussion/implementation/waves/wave32/domain-c-gnome-implementation-report.md` as secondary context only

## Basis Documents Used

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave32-plan.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`
- `discussion/design/module-contracts/validator-contract.md`
- `discussion/design/module-contracts/package-file-format-contract.md`
- `discussion/tests/traceability/test-traceability-matrix.md`
- `discussion/implementation/waves/wave25/wave25-final-report.md`
- `discussion/implementation/waves/wave26/wave26-final-report.md`

## Findings

No blocking, needs-fix, or escalation findings.

Non-blocking maintainability note: `packages/validator-core/src/validators/warp-lattice-diagnostics.ts` is 619 lines and `packages/validator-core/src/warp-lattice-diagnostics.test.ts` is 660 lines. They are still cohesive, named responsibility files rather than `index.ts` logic or catch-all validator files, but future warp lattice validator additions should split static shape, keyform patch, and runtime evidence concerns before the file grows further.

## Evidence

- Validator contract consistency: the updated contract registers the six formal warp lattice diagnostics at `discussion/design/module-contracts/validator-contract.md:113` through `discussion/design/module-contracts/validator-contract.md:118`, with firing rules at `discussion/design/module-contracts/validator-contract.md:175` through `discussion/design/module-contracts/validator-contract.md:180`.
- Check catalog consistency: `packages/validator-core/src/check-catalog.ts:524` through `packages/validator-core/src/check-catalog.ts:569` registers the same deterministic check IDs with validator-owned phases and error severity.
- Validator wiring: `packages/validator-core/src/validators/rig-control-semantic.ts:47` through `packages/validator-core/src/validators/rig-control-semantic.ts:66` adds warp lattice diagnostics alongside existing reference, cycle, and runtime evidence checks without bypassing the existing runtime evidence validator.
- Schema issue mapping: `packages/validator-core/src/validators/package-schema.ts:53` through `packages/validator-core/src/validators/package-schema.ts:56` routes package-format Zod issues into warp lattice diagnostics, and `packages/validator-core/src/validators/warp-lattice-schema-issues.ts:53` through `packages/validator-core/src/validators/warp-lattice-schema-issues.ts:144` maps domain bounds, cardinality, and malformed control-point patch schema failures.
- Diagnostic coverage in source: `packages/validator-core/src/validators/warp-lattice-diagnostics.ts:68` through `packages/validator-core/src/validators/warp-lattice-diagnostics.ts:128` covers lattice cardinality, `domainBounds`, and `restControlPoints`; `packages/validator-core/src/validators/warp-lattice-diagnostics.ts:130` through `packages/validator-core/src/validators/warp-lattice-diagnostics.ts:201` covers unsupported keyform property and malformed patch; `packages/validator-core/src/validators/warp-lattice-diagnostics.ts:203` through `packages/validator-core/src/validators/warp-lattice-diagnostics.ts:337` covers present-but-mismatched runtime evidence.
- Runtime evidence boundary: `packages/validator-core/src/validators/rig-control-runtime-evidence.ts:41` through `packages/validator-core/src/validators/rig-control-runtime-evidence.ts:75` still owns missing and stale runtime snapshot evidence, matching the Domain C test expectations at `packages/validator-core/src/warp-lattice-diagnostics.test.ts:191` through `packages/validator-core/src/warp-lattice-diagnostics.test.ts:233`.
- Viewer evidence: existing viewer evidence validation remains the path for malformed/stale Viewer runtime evidence, wired at `packages/validator-core/src/validators/package-runtime.ts:59` through `packages/validator-core/src/validators/package-runtime.ts:66` and covered by `packages/validator-core/src/warp-lattice-diagnostics.test.ts:235` through `packages/validator-core/src/warp-lattice-diagnostics.test.ts:267`.
- Regression behavior: `packages/validator-core/src/rig-control-runtime-evidence.test.ts:359` through `packages/validator-core/src/rig-control-runtime-evidence.test.ts:438` updates the prior unsupported/no-op warp lattice expectation so Wave32 now fails unsupported property and unsupported runtime evidence deterministically.
- Source organization and dependency scope: Domain C source changes stay under `packages/validator-core/src/**` plus the allowed validator contract update. No `index.ts` implementation logic was added. `git diff -- package.json pnpm-lock.yaml packages/*/package.json apps/*/package.json` was empty, so no dependency manifest or lockfile drift was observed.

## Verification

- `pnpm.cmd exec vitest run packages/validator-core/src/warp-lattice-diagnostics.test.ts packages/validator-core/src/rig-control-runtime-evidence.test.ts`
  - Result: passed, 2 test files, 16 tests.
- `pnpm.cmd typecheck`
  - Result: passed.
- `git diff --check -- <Domain C files>`
  - Result: exit 0. Git reported LF-to-CRLF working-copy warnings only; no whitespace errors.

Environment note: initial default sandbox shell attempts failed with `windows sandbox: spawn setup refresh`; review reads and verification commands were rerun with escalation.

## Remaining Risks

- Validator-core validates supplied semantic runtime and Viewer evidence; it does not recompute warp deformation geometry. This matches Wave26's recorded boundary that validator-core is not an independent runtime evaluator.
- Runtime keyform sample malformed-patch evidence and missing affected-drawable evidence are covered by source inspection in `warp-lattice-diagnostics.ts`, but they are not isolated as separate negative tests. Current focused tests still cover the main Domain C risk classes: valid pass, schema cardinality/domain failures, rest control point mismatch, unsupported property, malformed package patch, missing/stale runtime evidence, Viewer evidence failure, and unsupported/no-op runtime mismatch.

## User Decision Points

None.
