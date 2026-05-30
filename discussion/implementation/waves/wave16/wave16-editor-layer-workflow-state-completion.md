# Wave 16 Domain C Completion: Editor Layer Workflow State

> Wave: `drawable-layer-controls-and-visibility-authoring`
> Domain: `wave16-editor-layer-workflow-state`
> Date: 2026-05-30

## Verdict

`pass`

Domain C added UI-independent editor session, workflow, semantic state, and view-model support for drawable runtime visibility and draw order layer actions. The focused editor verification passed, and the independent Review-Sylph review found no blocking or medium issues.

## Files Changed

Editor session:

- `apps/editor/src/editor-session/drawable-layer-command.ts`
- `apps/editor/src/editor-session/evidence-provider.ts`
- `apps/editor/src/editor-session/index.ts`
- `apps/editor/src/editor-session/session-adapter.ts`
- `apps/editor/src/editor-session/session-adapter.test.ts`

Editor workflow:

- `apps/editor/src/editor-workflow/workflow-controller.ts`
- `apps/editor/src/editor-workflow/workflow-controller.test.ts`
- `apps/editor/src/editor-workflow/workflow-state-projection.ts`

Editor state / view model:

- `apps/editor/src/editor-state/drawable-list-state.ts`
- `apps/editor/src/editor-state/editor-state-projections.ts`
- `apps/editor/src/editor-state/editor-view-model.ts`
- `apps/editor/src/editor-state/editor-view-model.test.ts`

Reports:

- `discussion/implementation/waves/wave16/wave16-editor-layer-workflow-state-completion.md`
- `discussion/implementation/reviews/wave16/wave16-editor-layer-workflow-state-review.md`

## Implementation Summary

- Added editor-session command builders for `setRuntimeVisibility` and `setDrawOrder`.
- Added session adapter commit helpers for drawable runtime visibility and draw order operations.
- Extended editor operation evidence collection so committed layer operations produce runtime / validation evidence artifacts and remain compatible with the existing operation log and package file set path.
- Added workflow controller actions:
  - `setDrawableRuntimeVisibility(drawableId, runtimeVisibility)`;
  - `toggleDrawableRuntimeVisibility(drawableId)`;
  - `moveDrawableLayer(drawableId, "up" | "down")`.
- Implemented deterministic move up/down reorder by swapping the selected drawable in the ordered layer list and committing a full numeric `baseDrawOrder` sequence.
- Projected drawable state from persisted `drawOrder.entries` when available, with fallback to drawable `baseDrawOrder`.
- Added semantic/view-model fields for Domain D:
  - ordered drawable layer list;
  - visibility labels/state;
  - move up/down enabled state;
  - layer count labels;
  - last layer operation label.
- Kept preview compatibility runtime-backed through the existing `toRuntimeGraph` + runtime snapshot projection path. Hidden drawables remain in preview drawable projection and leave the runtime `drawList`.

## Tests Run

| Command | Result | Notes |
|---|---|---|
| `pnpm.cmd exec vitest run apps/editor/src/editor-session/session-adapter.test.ts apps/editor/src/editor-workflow/workflow-controller.test.ts apps/editor/src/editor-state/editor-view-model.test.ts` | initial sandbox failure | Sandbox blocked Vitest read from `node_modules` with `EPERM`. |
| `pnpm.cmd exec vitest run apps/editor/src/editor-session/session-adapter.test.ts apps/editor/src/editor-workflow/workflow-controller.test.ts apps/editor/src/editor-state/editor-view-model.test.ts` | failed once after escalation, then pass | First escalated run exposed an incorrect preview test expectation that hidden drawables remain in `drawList`; test was corrected to assert runtime truth. Final run passed 3 files / 30 tests. |
| `pnpm.cmd --filter @private-2d-rigging-lab/editor typecheck` | initial sandbox failure, then pass after escalation | Sandbox blocked TypeScript read from `node_modules`; escalated editor package typecheck passed. |
| `pnpm.cmd typecheck` | failed after escalation | Fails before editor package because of out-of-scope `packages/operation-core/src/drawable-layer-runtime-evidence.test.ts` tuple typing errors in Domain B/package scope. Domain C did not edit forbidden package files. |
| `git diff --check -- apps/editor/src/editor-session apps/editor/src/editor-workflow apps/editor/src/editor-state` | pass with LF/CRLF warnings only | No whitespace errors. |

## Review Findings And Fixes Applied

Independent Review-Sylph verdict: `pass`.

Findings:

- No blocking or medium findings.

Fixes applied during implementation before review:

- Corrected workflow preview assertions to match runtime behavior: hidden drawables are projected as `visible: false` but are omitted from runtime `drawList`.
- Relaxed editor-session draw order command input to accept UI/workflow string IDs and rely on `OperationRequestSchema` validation, while preserving typed payload output.

## Remaining Issues

- Root `pnpm.cmd typecheck` is currently blocked by an out-of-scope package test type error in `packages/operation-core/src/drawable-layer-runtime-evidence.test.ts`.
- Domain D must align UI row direction with the workflow meaning used here: `moveDrawableLayer(..., "up")` moves the drawable toward higher/front layer position in the ordered layer list.

## User-Decision Points

- None.

## Provisional Assumptions

- Domain A's accepted semantics are used: requested `baseDrawOrder` values are the sortable layer intent and stable order is normalized by the operation foundation.
- Domain D will use `toggleDrawableRuntimeVisibility` and `moveDrawableLayer` as primary UI actions.
- `drawOrder.entries` is the preferred layer ordering source when present; drawable `baseDrawOrder` is only a fallback for malformed or older projections.
