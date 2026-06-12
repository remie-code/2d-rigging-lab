# Wave63 Domain C Report: Deformer Tree / Inspector Editor UX

## Status / Verdict Candidate

- Status: final pass.
- Verdict: pass. All independent Review-Sylph lanes passed after fix loop 2.
- Domain: `wave63-deformer-tree-inspector-editor-ux`.
- Scope: Editor UX integration over Domain A operation contracts. No package foundation redesign was performed.

## Review Pass Summary

- Spec Compliance: pass (`discussion/implementation/reviews/wave63/wave63-domain-c-spec-compliance-review.md`)
- Design / Development: pass (`discussion/implementation/reviews/wave63/wave63-domain-c-design-development-review.md`)
- Test Adequacy: pass (`discussion/implementation/reviews/wave63/wave63-domain-c-test-adequacy-review.md`)

## Fix Loop 1 Summary

- Added selected-Deformer parent creation actions: `Create Parent Rotation Deformer` and `Create Parent Warp Deformer`.
- Routed parent creation through Domain A create contracts. Root selected Deformers become children of the new root parent; parented selected Deformers use `parentRigControlId + insertBeforeChild.kind === "rigControl"`.
- Added minimal committed Rotation Deformer Canvas overlay projection/rendering for bounds, pivot, and rest angle.
- Routed `applyRigDraft` rejections through shared rig operation feedback and rendered feedback in the Warp draft Inspector.
- Conservatively locked draft parent selection for insertion drafts so stale `insertBeforeChild` is not created by ordinary Inspector edits.

## Fix Loop 2 Summary

- Added E2E coverage for committed Inspector `Parent deformer` select -> `Apply Deformer Edits`, including hierarchy order change and unchanged Parts drawable row order.
- Added component-level test coverage that keyformed committed Warp Deformers disable `Transform columns control points`, `Transform rows control points`, `Bezier columns`, and `Bezier rows`.
- Added payload omission coverage for disabled division edits so transform/bezier division fields are not sent when keyforms lock divisions.
- Added command-wrapper rejection coverage for already-bound Drawable bind and root no-op reparent; both assert diagnostics and unchanged original session/model.
- Applied a minimal test-uncovered stability fix in the Inspector parent `<select>` handlers by capturing `event.currentTarget.value` before state callbacks.

## Basis Coverage Self-Report

| Basis item | Coverage |
|---|---|
| Drawable inspector shows Rotation and Warp create actions | Implemented for selected Drawable. Rotation commits with default pivot; Warp continues through draft + Apply. |
| Insertion when selected Drawable is already bound | Implemented in Editor payload generation for both `createWarpDeformer` and `createRotation2dRigControl` via `parentRigControlId + insertBeforeChild`. |
| Parent Deformer creation for selected Deformer | Implemented for Rotation and Warp committed Deformers. Existing parent insertion uses `insertBeforeChild.kind === "rigControl"`; root insertion creates a new root parent containing the selected Deformer. |
| Deformer selected inspector committed edits | Implemented for name, parent, bound children summary, domain bounds, transform control point counts, Bezier divisions, readonly Bezier/evaluation fields, and opacity multiplier. |
| Division edits with keyforms | Implemented safe-side UI disable when the selected rig control has keyforms; component test verifies the four division inputs are disabled and disabled division edits are omitted from update payloads. Operation rejection is surfaced through rig feedback. |
| Parts / Deformers switch | Preserved existing left hierarchy switch. |
| Drawable Pool | Implemented inside Deformer view, collapsed by default, computed as drawables not bound to any rig control. |
| DnD operation routing | Implemented Pool Drawable -> Deformer bind, bound Drawable ref -> Deformer rebind, Deformer -> Deformer reparent. Invalid UI drops do not call mutation; operation rejections surface unobtrusive feedback. |
| Parts/draw order isolation | Editor DnD and Inspector parent changes call only rig-control operations. Focused command tests assert Parts membership and draw order remain unchanged; E2E asserts Parts drawable row order remains unchanged after committed Inspector reparent. |
| Canvas committed overlay / projection update | Implemented for committed Warp and committed Rotation selections. Warp updates reflect committed division edits; Rotation overlay exposes bounds, pivot, and rest angle. Canvas projection applies static deformer opacity multiplier to descendant drawable opacity. |

## Intentionally Deferred Basis Items

- Full Rotation draft editor and pivot editing are deferred. Wave63 Domain C implements selected-Drawable `Create Rotation Deformer` using deterministic default pivot and now renders a committed Rotation overlay.
- Direct bound-child editing inside Inspector is deferred; Inspector shows summary and Deformer Tree / Drawable Pool owns add/move operations.
- Parameter / Keyform authoring, subtree opacity keyforms, Bezier control point manual editing, semantic auto-rig, and Cubism compatibility remain out of scope.
- E2E covers create, pool bind, bound-ref rebind during stale-draft setup, committed inspector edit, committed Inspector parent reparent, Rotation create, and parent Warp create. Deformer drag reparent is covered by focused command tests rather than a browser drag path.
- Illegal root-state N/A rationale for Domain C wrapper testing: the Editor wrapper exposes only valid `reparentRigControl(child, parent|null)` inputs and does not construct corrupted root-list/parent mismatches. Fix loop 2 covers the closest meaningful root-state rejection reachable through the wrapper: reparenting an already-root Deformer to `null`, which returns `operation.reparentRigControl.noOp` with no mutation.

## User Workflow Trace

1. User selects a Drawable in Rig Tool: Inspector shows `Create Rotation Deformer` and `Create Warp Deformer`.
2. User creates Warp for a bound Drawable: Editor payload includes Domain A insertion fields, so the new deformer is inserted between parent deformer and drawable.
3. User opens Deformer view: hierarchy remains primary, `Drawable Pool` is collapsed by default, and unbound drawables can be expanded.
4. User drags Pool Drawable to a Deformer: Editor calls `bindRigControlChild`.
5. User drags bound Drawable reference to another Deformer: Editor calls `moveDrawableRigControlBinding`.
6. User drags Deformer row to another Deformer: Editor calls `reparentRigControl`.
7. User selects a committed Deformer: Inspector edits are applied with `updateRigControl` and parent changes with `reparentRigControl`; Canvas projection updates after commit.
8. User selects a committed Deformer and creates a parent Deformer: Editor creates a root parent or inserts between the selected Deformer and its current parent.
9. User applies a stale insertion Warp draft: Domain A rejection is shown in the Inspector feedback surface and the session is not mutated.
10. User changes a committed Deformer's parent in Inspector and applies: Deformer hierarchy changes, while Parts membership/order remains unchanged.

## Must-not Compliance Evidence

- Mesh algorithm implementation was not edited.
- Mesh Tool UX changes already present in the shared worktree were preserved; Domain C did not edit Mesh Tool UX during fix loop 1.
- Domain A operation/package foundation was not redesigned; Editor used the handoff operations.
- DnD routes do not call `moveStructureChild`, `setDrawablePart`, or `setDrawOrder`.
- No Parameter / Keyform authoring UI, subtree opacity keyforms, Bezier manual control editing, Cubism compatibility claim, or semantic auto-rig was added.
- No new dependencies or broad source organization exceptions were introduced.

## Residual Risk Classification

- Residual risk: medium.
- Reason: browser E2E now covers Pool bind, bound Drawable rebind during stale-draft setup, committed Inspector parent reparent, Rotation create, and parent Warp creation. Deformer drag reparent and parent Rotation insertion are covered by focused command/model tests rather than browser drag paths. Rotation creation remains direct-commit rather than full draft/pivot editor. Independent Review-Sylph lanes passed after fix loop 2.

## Changed Files List

- `apps/editor/src/features/editor-session/model/rig-tool-state.ts`
- `apps/editor/src/features/editor-session/model/rig-tool-state.test.ts`
- `apps/editor/src/features/editor-session/model/editor-session-commands.ts`
- `apps/editor/src/features/editor-session/model/editor-session-commands.test.ts`
- `apps/editor/src/features/editor-session/editor-session-context.tsx`
- `apps/editor/src/workspace/panels/rig-tool-inspector.tsx`
- `apps/editor/src/workspace/panels/rig-tool-inspector.test.ts`
- `apps/editor/src/workspace/panels/deformer-tree-view.tsx`
- `apps/editor/src/workspace/canvas/canvas-projection.ts`
- `apps/editor/src/workspace/canvas/canvas-projection.test.ts`
- `apps/editor/src/workspace/canvas/canvas-renderer.ts`
- `apps/editor/src/workspace/panels/canvas-preview-panel.tsx`
- `apps/editor/e2e/psd-import.e2e.spec.ts`
- `discussion/implementation/waves/wave63/wave63-domain-c-report.md`

## Verification Performed

- PASS: `pnpm.cmd typecheck`
- Initial sandbox failure: `pnpm.cmd exec vitest run apps/editor/src/features/editor-session/model/rig-tool-state.test.ts apps/editor/src/features/editor-session/model/editor-session-commands.test.ts apps/editor/src/workspace/canvas/canvas-projection.test.ts` failed with `spawn EPERM`.
- PASS after approved escalation: same focused vitest command, 3 files / 23 tests passed.
- Initial sandbox failure: `pnpm.cmd --filter @private-2d-rigging-lab/editor exec playwright test -c playwright.config.ts e2e/psd-import.e2e.spec.ts -g "creates a Warp Deformer draft|creates a Rotation Deformer" --workers=1 --reporter=line` failed with `spawn EPERM`.
- Test-fix attempt: same focused Playwright command after escalation ran 2 tests, with 1 expected-path test failure caused by using a clamped draft value that committed instead of rejecting.
- PASS after E2E correction and approved escalation: `pnpm.cmd --filter @private-2d-rigging-lab/editor exec playwright test -c playwright.config.ts e2e/psd-import.e2e.spec.ts -g "creates a Warp Deformer draft|shows Inspector feedback|creates a Rotation Deformer" --workers=1 --reporter=line`, 3 tests passed.
- PASS: `node scripts/check-source-organization.mjs`
- PASS: `git diff --check -- apps/editor discussion/implementation/waves/wave63/wave63-domain-c-report.md` with LF/CRLF conversion warnings only.
- Fix loop 2 initial sandbox failure: `pnpm.cmd exec vitest run apps/editor/src/features/editor-session/model/editor-session-commands.test.ts apps/editor/src/workspace/panels/rig-tool-inspector.test.tsx` failed with `spawn EPERM`; after escalation the `.tsx` file was not matched by root Vitest include, so the test was moved to `.test.ts`.
- PASS after approved escalation: `pnpm.cmd exec vitest run apps/editor/src/features/editor-session/model/editor-session-commands.test.ts apps/editor/src/workspace/panels/rig-tool-inspector.test.ts`, 2 files / 12 tests passed.
- Fix loop 2 initial sandbox failure: `pnpm.cmd --filter @private-2d-rigging-lab/editor exec playwright test -c playwright.config.ts e2e/psd-import.e2e.spec.ts -g "reparents a committed Deformer" --workers=1 --reporter=line` failed with `spawn EPERM`.
- Fix loop 2 E2E exposed a parent `<select>` handler `currentTarget` null dereference; fixed by capturing the value before state callbacks.
- PASS after approved escalation and fix: `pnpm.cmd --filter @private-2d-rigging-lab/editor exec playwright test -c playwright.config.ts e2e/psd-import.e2e.spec.ts -g "reparents a committed Deformer" --workers=1 --reporter=line`, 1 test passed.
- PASS after fix loop 2 source change: `pnpm.cmd typecheck`.
- PASS after fix loop 2: `node scripts/check-source-organization.mjs`.
- PASS after fix loop 2: `git diff --check -- apps/editor discussion/implementation/waves/wave63/wave63-domain-c-report.md` with LF/CRLF conversion warnings only.

## A Handoff Usage Points

- `createWarpDeformer`: Editor now sends `parentRigControlId` and `insertBeforeChild` for bound Drawable insertion.
- `createRotation2dRigControl`: Editor uses the extended insertion fields and `opacityMultiplier`.
- `createWarpDeformer` / `createRotation2dRigControl`: selected-Deformer parent creation uses `childRigControlIds` for root-parent creation and `insertBeforeChild.kind === "rigControl"` for parented insertion.
- `bindRigControlChild`: used for Drawable Pool item -> Deformer binding.
- `moveDrawableRigControlBinding`: used for bound Drawable reference -> another Deformer.
- `reparentRigControl`: used for Deformer row -> another Deformer and committed parent inspector edits.
- `updateRigControl`: used for committed name/domain/divisions/opacity edits.
- Rejections from Domain A operations are retained as diagnostics and shown as rig/deformer feedback instead of mutating UI state.

## B Changes Conflict Avoidance

- Preexisting Domain B dirty changes in shared Editor files were preserved.
- Domain C did not edit `apps/editor/src/workspace/panels/mesh-tool-inspector.tsx` or mesh generation algorithm files during fix loop 1.
- Existing Mesh Tool `auto-outline-v2` command/default behavior in shared context/tests was left intact while adding Rig/Deformer routing.
