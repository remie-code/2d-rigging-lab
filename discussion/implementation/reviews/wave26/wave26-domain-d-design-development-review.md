# Wave 26 Domain D Design / Development Compliance Review

> Wave: Wave 26 `rig-control-keyform-viewer-hardening`  
> Domain: D `wave26-editor-rig-control-keyform-authoring-ux`  
> Lane: Design / Development Compliance Review  
> Date: 2026-06-01  
> Role: Review-Sylph, clean context  
> Verdict: `pass`

## Scope Reviewed

Reviewed the Domain D editor implementation against the Wave 26 plan, development policies, operation / validator contracts, Wave 25 closure basis, and Wave 26 Domain A/B/C completion reports.

Changed Domain D files reviewed:

- `apps/editor/src/editor-session/rig-control-command.ts`
- `apps/editor/src/editor-session/session-adapter.ts`
- `apps/editor/src/editor-session/session-adapter.test.ts`
- `apps/editor/src/editor-state/rig-control-keyform-state.ts`
- `apps/editor/src/editor-state/editor-semantic-state.ts`
- `apps/editor/src/editor-state/editor-state-projections.ts`
- `apps/editor/src/editor-state/editor-view-model.ts`
- `apps/editor/src/editor-state/editor-view-model.test.ts`
- `apps/editor/src/editor-state/editor-test-ids.ts`
- `apps/editor/src/editor-state/index.ts`
- `apps/editor/src/editor-workflow/rig-control-workflow.ts`
- `apps/editor/src/editor-workflow/workflow-state-projection.ts`
- `apps/editor/src/editor-workflow/workflow-controller.test.ts`
- `apps/editor/src/ui/rig-control-panel/rig-control-panel.ts`
- `apps/editor/src/ui/rig-control-panel/rig-control-panel.test.ts`

The shared worktree also contains Wave 26 A/B/C changes outside Domain D. Those were not reverted and are not treated as Domain D implementation.

## Findings

No blocking, high, medium, or low findings.

## Compliance Notes

- Allowed write scope is respected for the Domain D source diff. The reviewed implementation stays under `apps/editor/src/editor-state`, `apps/editor/src/editor-workflow`, `apps/editor/src/editor-session`, and `apps/editor/src/ui/rig-control-panel`.
- The UX is minimal and bounded to project-defined `rotation2d` rig-control `angleDegrees` keyforms. It does not add timeline editing, gizmos, canvas drag editing, file I/O, parser/decode/archive behavior, app-shell redesign, renderer/pixel oracle work, or Cubism compatibility claims.
- Mutation routes through the existing operation/session path. The panel creates a command, workflow dispatches the keyform branch, the session adapter builds an operation request, and the request is `operationType: "addKeyform"` with `target.kind: "rigControl"` and `targetProperty: "angleDegrees"` (`apps/editor/src/ui/rig-control-panel/rig-control-panel.ts:542`, `apps/editor/src/editor-workflow/rig-control-workflow.ts:60`, `apps/editor/src/editor-session/session-adapter.ts:273`, `apps/editor/src/editor-session/rig-control-command.ts:92`, `apps/editor/src/editor-session/rig-control-command.ts:110`).
- User-visible rejection messages are deterministic and truthful for the minimal form states: missing authored parameter, missing `rotation2d` control, empty selections, non-authored parameter, non-`rotation2d` rig control, and non-finite numeric fields (`apps/editor/src/ui/rig-control-panel/rig-control-panel.ts:598`).
- Save/load projection uses the existing workflow state projection and editor semantic state. Loaded and committed documents pass `model.keyforms.keyformSets` through the established projection flow (`apps/editor/src/editor-workflow/workflow-state-projection.ts:29`, `apps/editor/src/editor-workflow/workflow-state-projection.ts:74`, `apps/editor/src/editor-workflow/workflow-state-projection.ts:111`, `apps/editor/src/editor-state/editor-state-projections.ts:117`, `apps/editor/src/editor-state/editor-state-projections.ts:166`).
- The new keyform state projection has a narrow responsibility: extract linear 1D `rigControl:angleDegrees` keyforms and expose only the fields needed by editor UX (`apps/editor/src/editor-state/rig-control-keyform-state.ts:13`).
- UI labels are coherent enough for the next e2e lane: "Add angle keyform", "Input parameter", "Rotation control", "Key value", "Angle patch", and evidence/list labels match the project-defined rig-control scope (`apps/editor/src/ui/rig-control-panel/rig-control-panel.ts:175`, `apps/editor/src/ui/rig-control-panel/rig-control-panel.ts:279`, `apps/editor/src/ui/rig-control-panel/rig-control-panel.ts:349`).
- Machine-readable test IDs use dot-separated lower camelCase-style segments with no spaces (`apps/editor/src/editor-state/editor-test-ids.ts:63`).
- Source organization policy is respected. The only `index.ts` change is a barrel export (`apps/editor/src/editor-state/index.ts:23`). The new source file is focused; existing larger editor view-model and panel files receive bounded wiring and UI additions, and `check:source` passed.
- Dependency policy is respected. No root/workspace/editor/package manifest or lockfile diff was present, and `check:deps` passed.

## Verification Performed

Commands run in this review:

| Check | Result |
|---|---|
| `git status --short -uall` | reviewed; shared Wave 26 dirty worktree present |
| `git diff --name-status -- apps/editor/src/editor-state apps/editor/src/editor-workflow apps/editor/src/editor-session apps/editor/src/ui/rig-control-panel` | reviewed Domain D changed file set |
| `git diff --stat -- apps/editor/src/editor-state apps/editor/src/editor-workflow apps/editor/src/editor-session apps/editor/src/ui/rig-control-panel` | reviewed scoped diff size |
| `git diff -- apps/editor/src/editor-session/rig-control-command.ts apps/editor/src/editor-session/session-adapter.ts apps/editor/src/editor-state/rig-control-keyform-state.ts apps/editor/src/editor-state/editor-semantic-state.ts apps/editor/src/editor-state/editor-state-projections.ts apps/editor/src/editor-state/editor-view-model.ts apps/editor/src/editor-state/editor-test-ids.ts apps/editor/src/editor-state/index.ts` | reviewed |
| `git diff -- apps/editor/src/editor-workflow/rig-control-workflow.ts apps/editor/src/editor-workflow/workflow-state-projection.ts apps/editor/src/ui/rig-control-panel/rig-control-panel.ts` | reviewed |
| `git diff -- apps/editor/src/editor-session/session-adapter.test.ts apps/editor/src/editor-state/editor-view-model.test.ts apps/editor/src/editor-workflow/workflow-controller.test.ts apps/editor/src/ui/rig-control-panel/rig-control-panel.test.ts` | reviewed |
| `pnpm.cmd exec vitest run apps/editor/src/editor-session/session-adapter.test.ts apps/editor/src/editor-state/editor-view-model.test.ts apps/editor/src/editor-workflow/workflow-controller.test.ts apps/editor/src/ui/rig-control-panel/rig-control-panel.test.ts` | pass; 4 files / 58 tests |
| `pnpm.cmd typecheck` | pass |
| `pnpm.cmd run check:source` | pass |
| `pnpm.cmd run check:deps` | pass |
| `git diff --check -- apps/editor/src/editor-state apps/editor/src/editor-workflow apps/editor/src/editor-session apps/editor/src/ui/rig-control-panel` | pass; LF/CRLF warnings only |
| `git diff -- package.json pnpm-lock.yaml pnpm-workspace.yaml apps/editor/package.json packages/authoring-core/package.json packages/operation-core/package.json packages/runtime-core/package.json packages/validator-core/package.json` | pass; no output |

Gnome's provided verification summary for the same focused editor tests, typecheck, `check:source`, and scoped diff check was consistent with the rerun results above.

## Residual Risks / Domain E Notes

- This lane did not run browser e2e or mobile layout smoke. Domain E still needs to verify the real browser flow, viewport behavior, save/load, and Viewer / Runtime reinspection.
- The UI intentionally exposes semantic evidence and labels, not pixel rendering or exact matrix math. Runtime and validator domains own those deeper oracles.
- Existing editor `editor-view-model.ts` and `rig-control-panel.ts` are sizeable. This Domain D change adds a focused keyform state file and keeps `index.ts` barrel-only, but future editor waves should keep splitting new behavior into named responsibility files.

## Required Fix

None.

## Remaining Issues

No Domain D design/development compliance issues remain.

## User Decision Points

None.
