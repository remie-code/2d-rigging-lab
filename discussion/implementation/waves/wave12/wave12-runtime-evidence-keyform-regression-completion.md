# Wave 12 Domain E Completion: Runtime Evidence Keyform Regression

> Wave: `runtime-keyform-evaluation-foundation`
> Domain: `wave12-runtime-evidence-keyform-regression`
> Orchestrator: Orch-Sylph
> Verdict: `pass`

## Scope Changed

- Runtime evidence artifact regression coverage for runtime-visible mesh keyform effects.
- Editor session persistence/evidence regression coverage for committed `addKeyform`.
- AI `addKeyform` regression coverage for runtime-visible evidence through existing response and persistence paths.
- Persistent Domain E review and completion reports.

No production source was changed.

## Basis Documents Used

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave12-plan.md`
- `discussion/implementation/waves/wave12/wave12-runtime-snapshot-keyform-integration-completion.md`
- `discussion/design/module-contracts/runtime-core-contract.md`
- `discussion/development_convention/source-file-organization-policy.md`

## Implementation Summary

- Added a runtime-core evidence artifact regression where baseline and candidate are evaluated at the same key value, but only the candidate graph contains a mesh keyform.
- Asserted the candidate runtime snapshot artifact contains `keyformSamples`, sampled coordinates, exact sampling status, state patch, updated drawable bounds, and updated vertex hash.
- Asserted runtime evidence `runtimeDiff.drawableChanges` captures the keyform-driven mesh deformation without relying on parameter changes.
- Extended editor session `addKeyform` regression to parse the generated candidate runtime snapshot from the committed `packageFileSet` and verify the keyform sample plus runtime-visible drawable effect.
- Extended AI `addKeyform` regression to verify runtime diff drawable changes, generated snapshot refs, AI evidence refs, persisted candidate snapshot `keyformSamples`, drawable bounds, and vertex hash.

## Orchestration

- Implementation was delegated to Gnome with a bounded, tests-only write scope.
- Clean review was delegated to Review-Sylph with explicit basis documents, changed files, and Design / Development Compliance plus Test Adequacy rubric.
- Review-Sylph returned `pass`.

## Review Findings and Resolution

| Finding | Resolution |
|---|---|
| No blocking or non-blocking findings. | No fixes required. |

Persistent review report:

- `discussion/implementation/reviews/wave12/wave12-runtime-evidence-keyform-regression-review.md`

## Files Changed

- `packages/runtime-core/src/runtime-evidence-artifacts.test.ts`
- `apps/editor/src/editor-session/session-adapter.test.ts`
- `apps/editor/src/ai-command-host/editor-ai-keyform-command-host.test.ts`
- `discussion/implementation/reviews/wave12/wave12-runtime-evidence-keyform-regression-review.md`
- `discussion/implementation/waves/wave12/wave12-runtime-evidence-keyform-regression-completion.md`

## Verification Performed

| Command | Outcome |
|---|---|
| `pnpm.cmd exec vitest run packages/runtime-core/src/runtime-evidence-artifacts.test.ts apps/editor/src/editor-session/session-adapter.test.ts apps/editor/src/ai-command-host/editor-ai-keyform-command-host.test.ts` | Initial sandbox run failed with `EPERM` opening `node_modules/.../vitest.mjs`; escalated rerun passed, 3 files / 8 tests |
| `pnpm.cmd exec vitest run apps/editor/src` | Escalated affected editor test run passed, 11 files / 47 tests |
| `pnpm.cmd typecheck` | Initial sandbox run failed with `EPERM` opening `node_modules/.../typescript/bin/tsc`; escalated rerun passed |
| `git diff --check -- packages/runtime-core/src/runtime-evidence-artifacts.test.ts apps/editor/src/editor-session/session-adapter.test.ts apps/editor/src/ai-command-host/editor-ai-keyform-command-host.test.ts discussion/implementation/reviews/wave12/wave12-runtime-evidence-keyform-regression-review.md discussion/implementation/waves/wave12/wave12-runtime-evidence-keyform-regression-completion.md` | Passed; emitted only CRLF working-copy warnings |

## Remaining Issues

- None for Domain E.
- `addKeyformGrid2d` AI runtime evidence expansion remains outside this domain's required pass evidence and was not added.
- Pre-existing upstream Wave 12 and parallel-domain worktree changes were present and were not reverted.

## User-Decision Points

- None.

## Provisional Assumptions

- Verifying AI runtime-visible evidence through the existing AI response and `latestSessionPersistenceResult` path is acceptable because it does not introduce new transport or UI scope.
- Exact keyform sample, bounds, and vertex hash assertions are appropriate for this focused regression because Wave 12 Domain D already established runtime snapshot keyform evaluation.
- Runtime diff contract expansion for richer drawable metadata remains deferred; Domain E uses the existing `drawableChanges` evidence path.
