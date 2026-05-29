# Wave 7 Domain D Completion: editor workflow persistence controller

> Wave: `editor-project-persistence-and-e2e-hardening`
> Domain: `wave7-editor-workflow-persistence-controller`
> Verdict: `pass`

## 1. Changed Files

- `apps/editor/src/editor-workflow/index.ts`
- `apps/editor/src/editor-workflow/workflow-controller.ts`
- `apps/editor/src/editor-workflow/workflow-state-projection.ts`
- `apps/editor/src/editor-workflow/workflow-controller.test.ts`
- `apps/editor/src/editor-session/session-adapter.ts`
- `apps/editor/src/app/editor-app.ts`

## 2. Summary

Domain D introduced a workflow controller that coordinates editor session state with project persistence. It exposes `commitCreateParameter`, `saveProject`, `loadProject`, and `resetToSamplePackage`, while keeping app rendering outside the workflow core.

Loading a persisted project rehydrates the package file set, operation log entries, and generated artifact paths, then supports subsequent operation commits.

## 3. Verification

| Command | Result |
|---|---|
| `pnpm exec vitest run apps/editor/src/editor-workflow apps/editor/src/editor-session` | pass |
| `pnpm --filter @private-2d-rigging-lab/editor typecheck` | pass |
| `pnpm check:source` | pass |

## 4. Review Notes

- Workflow orchestration is isolated under `editor-workflow`.
- `editor-session` owns persistence snapshots and initial hydration options.
- UI and browser storage internals remain separated from operation-core.

## 5. Remaining Issues

- After load, generated evidence state is restored, but the package file set panel's generated-path highlighting still depends on the latest session persistence result. This is UI polish and not a Wave 7 blocker.
