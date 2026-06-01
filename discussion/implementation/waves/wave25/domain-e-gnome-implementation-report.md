# Wave25 Domain E Gnome Implementation Report

## Status

implemented

## Changed files

- `apps/editor/src/app/editor-app.ts`
- `apps/editor/src/editor-session/evidence-provider.ts`
- `apps/editor/src/editor-session/index.ts`
- `apps/editor/src/editor-session/rig-control-command.ts`
- `apps/editor/src/editor-session/session-adapter.ts`
- `apps/editor/src/editor-state/editor-semantic-state.ts`
- `apps/editor/src/editor-state/editor-state-projections.ts`
- `apps/editor/src/editor-state/editor-test-ids.ts`
- `apps/editor/src/editor-state/editor-view-model.ts`
- `apps/editor/src/editor-state/editor-view-model.test.ts`
- `apps/editor/src/editor-state/index.ts`
- `apps/editor/src/editor-state/rig-control-authoring-state.ts`
- `apps/editor/src/editor-workflow/dynamics-preview-workflow.ts`
- `apps/editor/src/editor-workflow/index.ts`
- `apps/editor/src/editor-workflow/rig-control-workflow.ts`
- `apps/editor/src/editor-workflow/viewer-runtime-workflow.ts`
- `apps/editor/src/editor-workflow/workflow-controller.ts`
- `apps/editor/src/editor-workflow/workflow-controller.test.ts`
- `apps/editor/src/editor-workflow/workflow-state-projection.ts`
- `apps/editor/src/ui/app-shell/app-shell.ts`
- `apps/editor/src/ui/app-shell/app-shell.test.ts`
- `apps/editor/src/ui/rig-control-panel/index.ts`
- `apps/editor/src/ui/rig-control-panel/rig-control-panel.ts`
- `apps/editor/src/ui/rig-control-panel/rig-control-panel.test.ts`
- `apps/editor/src/ui/viewer-runtime/viewer-runtime-summary.ts`

## Implemented behavior

- Added editor semantic/view-model projection for project-defined `rotation2d` rig controls using Domain A package DTOs.
- Added editor workflow/session commands for `createRotation2dRigControl` and `bindRigControlChild`; IDs stay in `rigControl` form through operation-core contracts.
- Added editor-session evidence collection support for rig-control create/bind operations, using existing runtime evidence and validation report materialization.
- Added a minimal Project-defined Rig Controls panel in the app shell:
  - create a rotation2d rig control by form;
  - bind a child drawable or child rig control when available;
  - block invalid self-binding locally with a deterministic user-visible diagnostic;
  - show authored control list, Preview affected-target summary, Viewer runtime evidence, and operation diagnostics.
- Extended Viewer / Runtime summary projection to show rig-control count, evaluation state, hierarchy order, transform labels, and affected targets from Domain B runtime snapshots.
- Persisted and restored rig-control authoring state through the existing save/load workflow projection.

## Verification

- `pnpm.cmd exec vitest run apps/editor/src/editor-state/editor-view-model.test.ts apps/editor/src/editor-workflow/workflow-controller.test.ts apps/editor/src/ui/rig-control-panel/rig-control-panel.test.ts apps/editor/src/ui/app-shell/app-shell.test.ts apps/editor/src/editor-preview/preview-projection.test.ts apps/editor/src/editor-workflow/viewer-runtime-workflow.test.ts apps/editor/src/editor-preview/texture-preview-resolution.test.ts` - pass, 7 files / 68 tests.
- `pnpm.cmd typecheck` - pass.
- `pnpm.cmd run check:source` - pass.
- `pnpm.cmd run check:deps` - pass.
- `pnpm.cmd test:e2e` - pass; desktop and mobile smoke passed.

## Residual risks

- The existing e2e smoke does not submit the new rig-control forms; focused unit tests cover create/bind workflow and panel form behavior.
- Preview evidence is an affected-target summary in the Rig Control panel, not a new `editor-preview` DTO field. Viewer / Runtime uses runtime snapshot evidence.
- No canvas drag/gizmo/timeline UI was added.

## User-decision points

- None.

## Forbidden-scope / dependency / manifest confirmation

- No broad runtime evaluator implementation was added.
- No broad validator implementation was added.
- No file picker, asset I/O, parser, image decode, Cubism SDK/Core, Cubism Viewer compatibility, or Cubism Physics compatibility claim was added.
- No package manifest, lockfile, external dependency, fixture manifest, or contract fixture was changed by Domain E.
- Public `index.ts` changes are barrel exports only.
- Domain E depends on Domain A/B/C/D operation, runtime snapshot, validator, and fixture contracts; it does not reimplement rig-control semantics in UI.
