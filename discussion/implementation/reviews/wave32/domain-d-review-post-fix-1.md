# Wave32 Domain D Review Post-Fix 1

Target: `wave32-editor-warp-lattice-workflow-draft`
Reviewer: Clean Review-Sylph
Date: 2026-06-02
Verdict: `needs_fix`

## Scope Reviewed

- Domain D source files under `apps/editor/src/editor-state/**`.
- Domain D Rig Controls panel source and tests under `apps/editor/src/ui/rig-control-panel/**`.
- Untracked Domain D files:
  - `apps/editor/src/editor-state/rig-control-warp-lattice-draft-state.ts`
  - `apps/editor/src/editor-state/rig-control-warp-lattice-keyform-state.ts`
- Review basis documents listed in the subagent call, including Wave32 plan, operation contracts, source organization, dependency, schema/id conventions, prior Wave25/Wave26 reports by reference, Gnome report, and the prior Domain D review.

The Gnome report was read, but this verdict is based on direct source/test inspection and focused verification.

## Prior Findings

1. Medium: synthetic warp draft parent could not bind a single existing child rig control.
   - Status: **not resolved end-to-end**.
   - The view-model side was fixed: `warpLatticeChildOptions` is computed separately from existing package-parent `childOptions`, and `canDraftWarpLattice2dBindChild` uses the warp-specific option set.
   - The UI form still wires the option sets backwards, so the actual panel workflow remains broken for the single-child case.

2. Low: warp lattice draft invalid/disabled negative validation coverage was insufficient.
   - Status: **partially resolved**.
   - Added coverage exists for invalid domain bounds, malformed `controlPointOffsets`, no authored parameter disabled state, and synthetic draft parent submission via direct field injection.
   - The new tests do not verify the rendered `<select>` options, which is the path where the remaining medium bug hides.

## Findings

### Medium: Draft bind and existing bind forms use each other's child option source

References:

- `apps/editor/src/editor-state/editor-view-model.ts:670`
- `apps/editor/src/editor-state/editor-view-model.ts:678`
- `apps/editor/src/editor-state/editor-view-model.ts:730`
- `apps/editor/src/editor-state/editor-view-model.ts:751`
- `apps/editor/src/ui/rig-control-panel/rig-control-panel.ts:297`
- `apps/editor/src/ui/rig-control-panel/rig-control-panel.ts:349`
- `apps/editor/src/ui/rig-control-panel/rig-control-panel.test.ts:293`
- `apps/editor/src/ui/rig-control-panel/rig-control-panel.test.ts:756`
- `apps/editor/src/ui/rig-control-panel/rig-control-panel.test.ts:783`

Why it matters:

The post-fix view-model correctly separates existing package-parent binding from synthetic draft-parent binding:

- existing bind child options are exposed as `childOptions`;
- synthetic warp draft child options are exposed as `warpLatticeChildOptions`;
- `warpLatticeChildOptions` allows a single existing unparented rig control because the synthetic draft parent is not one of `state.rigControls`.

The Rig Controls panel renders them in the opposite forms:

- the existing `Bind child` form maps `options.viewModel.rigControls.warpLatticeChildOptions`;
- the `Draft warp child binding` form maps `options.viewModel.rigControls.childOptions`.

With one existing unparented rig control and no unbound drawable, the view-model correctly enables `canDraftWarpLattice2dBindChild`, but `childOptions` is empty, so the real draft bind select has no `rigControl:rig_single_child` option. The current UI test still passes because `setNamedFieldValue` assigns arbitrary values directly and `readFormFieldValue` returns directly-set select values without proving that the value was rendered as an option.

This also risks polluting the existing package-parent bind form with the warp-specific child set, including options that the existing bind workflow intentionally excluded.

Practical fix direction:

- In `createBindRigControlChildForm`, use `options.viewModel.rigControls.childOptions`.
- In `createWarpLattice2dBindDraftForm`, use `options.viewModel.rigControls.warpLatticeChildOptions`.
- Add UI tests that inspect the rendered select option values for both forms. The synthetic draft/single-child test should prove the `childTarget` select actually contains `rigControl:rig_single_child`; a normal existing bind test should prove a single existing rig control is not exposed by `childOptions` unless the existing bind eligibility rule allows it.
- Prefer a test helper that validates select option membership before setting a select value, or a dedicated `expectSelectOptionValues` helper, so future option-source mistakes are caught.

## Verification

Performed:

```text
pnpm.cmd exec vitest run apps/editor/src/editor-state/editor-view-model.test.ts apps/editor/src/ui/rig-control-panel/rig-control-panel.test.ts
```

Result:

```text
2 test files passed, 26 tests passed.
```

Accepted from Gnome report, not rerun in this review:

- `pnpm.cmd typecheck` passed.
- `pnpm.cmd run check:source` passed.
- `git diff --check -- apps/editor/src/editor-state apps/editor/src/ui/rig-control-panel discussion/implementation/waves/wave32/domain-d-gnome-implementation-report.md` passed with LF/CRLF warnings only.

Additional source inspection notes:

- `apps/editor/src/editor-state/index.ts` remains barrel-only.
- New editor-state files have focused responsibilities: 2x2 draft defaults/rest points and 2x2 `controlPointOffsets` keyform projection.
- `git status --short -uall` showed unrelated parallel Wave32 changes under `packages/**` and orchestration/backlog files; those were not treated as Domain D implementation.
- No editor-session/editor-workflow/operation commit wiring was found in the inspected Domain D source path.

## Remaining Issues / User-Decision Points

No user decision is required. This is a local Domain D UI/test fix.

## Context Separation

From this reviewer context, Gnome and Review-Sylph remained separated. I read the Gnome report as one input, then independently inspected the changed source files, untracked Domain D files, tests, relevant review basis, and focused test output before returning this verdict.
