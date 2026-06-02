# Wave32 Domain D Gnome Implementation Report

Target: `wave32-editor-warp-lattice-workflow-draft`
Date: 2026-06-02
Verdict: `done`

## Scope Implemented

- Added Editor-local draft state and view-model support for a minimum 2x2 `warpLattice2d` rig-control draft.
- Added Editor-local projection for `rigControl` keyform sets whose target property is `controlPointOffsets`, limited to the 2x2 `Vec2[]` draft shape.
- Added Rig Controls panel UI for drafting `warpLattice2d` create, child bind, and `controlPointOffsets` keyform inputs.
- Needs-fix loop 1 split warp draft child eligibility from existing-package parent binding so a synthetic draft parent can bind one existing child rig control.
- Needs-fix loop 1 added negative/disabled panel coverage for invalid draft bounds, malformed `controlPointOffsets`, and missing authored parameter state.
- Needs-fix loop 2 corrected Rig Controls panel option sources so the normal existing-parent bind form uses `childOptions` and the synthetic warp draft bind form uses `warpLatticeChildOptions`.
- Needs-fix loop 2 added UI option rendering assertions for the normal single-child disabled case and the synthetic draft single-child bind case.
- Kept draft submit handling local to the panel via optional callbacks; no editor-session, editor-workflow, operation-core, package, runtime, validator, dependency, manifest, or lockfile changes were made.
- UI copy identifies the warp lattice surface as a minimum 2x2 draft and future-scope commit wiring. It does not claim Cubism compatibility, pixel render correctness, or a full lattice editor.

## Files Changed

- `apps/editor/src/editor-state/rig-control-warp-lattice-draft-state.ts`
- `apps/editor/src/editor-state/rig-control-warp-lattice-keyform-state.ts`
- `apps/editor/src/editor-state/rig-control-authoring-state.ts`
- `apps/editor/src/editor-state/editor-semantic-state.ts`
- `apps/editor/src/editor-state/editor-state-projections.ts`
- `apps/editor/src/editor-state/editor-view-model.ts`
- `apps/editor/src/editor-state/editor-test-ids.ts`
- `apps/editor/src/editor-state/editor-view-model.test.ts`
- `apps/editor/src/editor-state/index.ts`
- `apps/editor/src/ui/rig-control-panel/rig-control-panel.ts`
- `apps/editor/src/ui/rig-control-panel/rig-control-panel.test.ts`
- `discussion/implementation/waves/wave32/domain-d-gnome-implementation-report.md`

## Verification

Passed:

```text
pnpm.cmd exec vitest run apps/editor/src/editor-state/editor-view-model.test.ts apps/editor/src/ui/rig-control-panel/rig-control-panel.test.ts
```

Result: 2 test files passed, 27 tests passed.

Passed:

```text
pnpm.cmd typecheck
```

Result: root and editor typecheck passed.

Passed:

```text
pnpm.cmd run check:source
```

Result: source organization guard passed.

Passed:

```text
git diff --check -- apps/editor/src/editor-state apps/editor/src/ui/rig-control-panel discussion/implementation/waves/wave32/domain-d-gnome-implementation-report.md
```

Result: no whitespace errors. Git emitted LF-to-CRLF working-copy warnings only.

## Assumptions / Residual Risks

- `controlPointOffsets` is treated as an Editor-local draft convention for this domain. Operation/session commit materialization remains Domain E scope.
- The draft form uses row-major 2x2 control point ordering: top-left, top-right, bottom-left, bottom-right.
- The panel can validate and emit draft commands, but the production app does not wire those optional callbacks yet. This is intentional to avoid implementing the commit path in Domain D.
- No canvas lattice gizmo, renderer/pixel oracle, save/load e2e path, or Cubism deformer compatibility is implemented or claimed.
