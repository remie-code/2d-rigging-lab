# Wave 13 Domain C Completion: Runtime Evidence Diff Projection Hardening

> Wave: `runtime-diff-and-grid2d-evidence-hardening`
> Domain: `wave13-runtime-evidence-diff-projection-hardening`
> Verdict: `pass`

## Scope Changed

- Added runtime evidence artifact regression coverage for Domain A's enriched runtime diff fields.
- Kept the implementation tests-only.
- No production runtime evidence source was changed.

## Basis Documents Used

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave13-plan.md`
- `discussion/implementation/waves/wave13/wave13-runtime-diff-contract-and-comparison-semantics-completion.md`
- `discussion/implementation/reviews/wave13/wave13-runtime-diff-contract-and-comparison-semantics-review.md`
- `discussion/implementation/waves/wave13/wave13-keyform-diagnostic-regression-hardening-completion.md`
- `discussion/implementation/waves/wave12/wave12-final-report.md`
- `discussion/design/module-contracts/runtime-core-contract.md`
- `discussion/development_convention/source-file-organization-policy.md`

## Implementation Summary

Gnome implementation was delegated and returned `done`.

The implementation updates `packages/runtime-core/src/runtime-evidence-artifacts.test.ts` to assert that:

- mesh deformation runtime evidence keeps `drawableRuntimeStateChanges` and `drawListChanges` empty when only mesh geometry changes;
- runtime evidence diff projection preserves `drawableRuntimeStateChanges` for opacity, visibility, base draw order, and evaluated draw order changes;
- runtime evidence diff projection preserves `drawListChanges` for membership and retained-order changes;
- `runtimeDiff.beforeSnapshotId` and `runtimeDiff.afterSnapshotId` resolve to materialized runtime snapshot artifact paths;
- legacy `/drawList` `parameterChanges` compatibility remains present.

`runtime-evidence.ts` and `runtime-evidence-artifacts.ts` already carry `runtimeComparison.diff` without narrowing it, so no production source fix was required.

## Orchestration Summary

- Orch-Sylph inspected the Wave 13 plan, Domain A/B completion artifacts, runtime-core contract, source organization policy, and runtime evidence source path.
- Gnome owned the bounded implementation in `packages/runtime-core/src/runtime-evidence-artifacts.test.ts`.
- Orch-Sylph reran focused, runtime-core, typecheck, and diff whitespace verification.
- Clean Review-Sylph performed a read-only review with separate Design / Development Compliance and Test Adequacy lanes.
- Review-Sylph verdict: `pass`.

## Review Findings And Resolution

Design / Development Compliance: `pass`.

- The Domain C diff is tests-only and stays within allowed write scope.
- No fixture, editor, AI host, keyform diagnostic, runtime-diff contract, or production evidence source files were edited.
- `index.ts` remains barrel-only.
- The reviewed test aligns with Domain A's `runtime-diff-v1` defaulted-field compatibility.

Test Adequacy: `pass`.

- The new regression observes dedicated runtime diff fields through runtime evidence artifact paths.
- Coverage includes drawable opacity, visibility, base draw order, evaluated draw order, drawList membership change, drawList order change, and legacy `/drawList` compatibility.
- Non-blocking note: the new evidence fixture combines drawList membership and order changes in one case. This is acceptable because Domain A owns isolated comparison semantics coverage; Domain C only needs projection through runtime evidence artifact paths.

No review findings required code changes.

## Files Changed

- `packages/runtime-core/src/runtime-evidence-artifacts.test.ts`
- `discussion/implementation/waves/wave13/wave13-runtime-evidence-diff-projection-hardening-completion.md`
- `discussion/implementation/reviews/wave13/wave13-runtime-evidence-diff-projection-hardening-review.md`

## Verification Performed

| Command | Outcome |
| --- | --- |
| `pnpm.cmd exec vitest run packages/runtime-core/src/runtime-evidence-artifacts.test.ts` | Sandbox run failed with `EPERM` opening `node_modules/.../vitest.mjs`; escalated rerun passed, 1 file / 4 tests. |
| `pnpm.cmd exec vitest run packages/runtime-core/src` | Sandbox run failed with `EPERM` opening `node_modules/.../vitest.mjs`; escalated rerun passed, 16 files / 50 tests. |
| `pnpm.cmd typecheck` | Sandbox run failed with `EPERM` opening `node_modules/.../typescript/.../tsc`; escalated rerun passed. |
| `git diff --check -- packages/runtime-core/src/runtime-evidence-artifacts.test.ts` | Passed with LF/CRLF working-copy warning only. |

Report whitespace verification:

```powershell
git diff --check -- packages/runtime-core/src/runtime-evidence-artifacts.test.ts discussion/implementation/waves/wave13/wave13-runtime-evidence-diff-projection-hardening-completion.md discussion/implementation/reviews/wave13/wave13-runtime-evidence-diff-projection-hardening-review.md
```

Outcome: passed with LF/CRLF working-copy warning only on `packages/runtime-core/src/runtime-evidence-artifacts.test.ts`.

## Remaining Issues

- None blocking for Domain C.
- Non-blocking: order-only drawList evidence projection is not isolated in Domain C. Existing Domain A comparison tests cover order-only semantics directly.

## User-Decision Points

- None.

## Provisional Assumptions

- Non-target modified files in the worktree belong to other Wave 13 domains or integration work.
- Runtime evidence is expected to expose `runtimeDiff` on the evidence result, not as a separate materialized runtime diff artifact file.
