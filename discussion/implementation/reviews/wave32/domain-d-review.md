# Wave32 Domain D Review

Target: `wave32-editor-warp-lattice-workflow-draft`
Reviewer: Clean Review-Sylph
Date: 2026-06-02
Verdict: `needs_fix`

## Scope Reviewed

- `apps/editor/src/editor-state/**` Domain D changes, including the new untracked warp lattice draft/keyform state files.
- `apps/editor/src/ui/rig-control-panel/**` Domain D changes and focused UI tests.
- `discussion/implementation/waves/wave32/domain-d-gnome-implementation-report.md`.
- Relevant basis documents: Wave32 plan, source file organization policy, dependency policy, schema/id policy, operation contracts, Wave25/Wave26 final reports, and orchestration/context hygiene instructions.

The implementation report was read, but the verdict is based on source, tests, diff/status inspection, and focused verification.

## Findings

### Medium: Synthetic warp draft parent cannot bind a sole existing child rig control

Reference:

- `apps/editor/src/editor-state/editor-view-model.ts:669`
- `apps/editor/src/editor-state/editor-view-model.ts:681`
- `apps/editor/src/editor-state/editor-view-model.ts:743`
- `apps/editor/src/ui/rig-control-panel/rig-control-panel.test.ts:202`

The view model reuses the existing rotation bind child-option rule:

- `childRigControlOptions` is empty unless there are at least two unparented existing rig controls.
- `hasBindableChild` is derived from that same option set.
- `canDraftWarpLattice2dBindChild` then uses `hasBindableChild`.

That rule is correct for an existing package parent because one of the unparented controls may be the parent itself. It is not correct for the synthetic `draft` warp parent, which is not part of `state.rigControls`. With one existing unparented rig control and no unbound drawable, the draft workflow disables "Draft warp child binding" even though binding that existing rig control to the new warp draft is a valid draft command shape.

The current test at `rig-control-panel.test.ts:202` covers only an existing package warp target with two rig controls, so this case is not caught.

Practical fix direction:

- Compute warp-lattice draft child options separately from the existing package bind options.
- When a `draft` warp target is available, allow existing unparented rig controls as child options even if there is only one.
- Keep self-binding rejection for package parents, and add an explicit test for `draft:<id>` parent + one existing rig-control child with no drawable.

### Low: Warp lattice draft validators lack negative UI coverage

Reference:

- `apps/editor/src/ui/rig-control-panel/rig-control-panel.ts:1089`
- `apps/editor/src/ui/rig-control-panel/rig-control-panel.ts:1174`
- `apps/editor/src/ui/rig-control-panel/rig-control-panel.ts:1211`
- `apps/editor/src/ui/rig-control-panel/rig-control-panel.test.ts:152`
- `apps/editor/src/ui/rig-control-panel/rig-control-panel.test.ts:245`

Domain D adds new user-visible validation branches for create draft, bind draft, and `controlPointOffsets` keyform draft, but the tests cover happy-path submissions and display evidence only. There is no negative coverage for invalid domain bounds, missing/invalid warp target, missing authored parameter, malformed offsets, or the disabled-state case described above.

Practical fix direction:

- Add focused panel tests for at least one invalid create-draft input, one invalid keyform offset input, and the draft-parent/single-child rig-control availability case.
- Keep these tests local to `rig-control-panel.test.ts`; no e2e is required for Domain D.

## Verification Performed

- Read changed Domain D files and untracked new files explicitly.
- Read relevant basis documents and Gnome implementation report.
- `git status --short -uall` confirmed shared worktree changes outside Domain D under `packages/**` and orchestration/backlog files; those were not reviewed as Domain D implementation.
- `git diff --name-only -- apps/editor/src/editor-session apps/editor/src/editor-workflow` produced no output.
- Manifest/lockfile status check for root/editor/package manifests and `pnpm-lock.yaml` produced no output.
- Forbidden/non-goal scan over Domain D source/report found no Domain D Cubism compatibility, renderer, pixel oracle, PSD/image/archive, File System Access, or dependency claims. Hits were either the Domain D report's explicit non-claims or pre-existing unrelated source-intake/tutorial guard text.
- `pnpm.cmd exec vitest run apps/editor/src/editor-state/editor-view-model.test.ts apps/editor/src/ui/rig-control-panel/rig-control-panel.test.ts`: pass, 2 files / 21 tests.
- `pnpm.cmd typecheck`: pass.
- `pnpm.cmd run check:source`: pass.
- `git diff --check -- apps/editor/src/editor-state apps/editor/src/ui/rig-control-panel discussion/implementation/waves/wave32/domain-d-gnome-implementation-report.md`: pass with LF-to-CRLF working-copy warnings only.

## Compliance Notes

- `apps/editor/src/editor-state/index.ts` remains barrel-only.
- New source files have clear responsibilities:
  - `rig-control-warp-lattice-draft-state.ts`: 2x2 draft defaults/rest points.
  - `rig-control-warp-lattice-keyform-state.ts`: local projection of 2x2 `controlPointOffsets` keyforms.
- No external dependency, manifest, lockfile, package, editor-session, or editor-workflow changes were found in Domain D scope.
- Production app wiring does not pass the optional warp draft callbacks, so commit/session path remains Domain E scope.
- UI copy is draft/future-scope oriented and does not claim Cubism compatibility, pixel correctness, renderer correctness, or a full lattice gizmo.

## Remaining Issues / User-Decision Points

- No user decision is required. The medium finding is a local Domain D view-model/test fix.

## Context Separation

From this reviewer context, Gnome and Review-Sylph were separated: I received the implementation report as evidence, but independently inspected source, tests, diffs, untracked files, forbidden-scope status, and verification commands before returning this verdict.
