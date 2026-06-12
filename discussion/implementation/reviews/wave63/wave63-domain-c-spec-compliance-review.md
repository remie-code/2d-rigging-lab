# Wave63 Domain C Spec Compliance Review

## Verdict

`pass`

## Scope

- Review lane: Spec Compliance Review
- Review pass: fix loop 2 final rerun after previous `needs_fix` and fix loop 1 `pass`.
- Reviewed basis:
  - `discussion/implementation/orchestration/wave63-plan.md`
  - `discussion/implementation/waves/wave63/wave63-domain-a-report.md`
  - `discussion/implementation/waves/wave63/wave63-domain-b-report.md`
  - `discussion/implementation/waves/wave63/wave63-preplan-deformer-management-inventory.md`
  - `discussion/design/screen-design/components/rig-tool.md`
  - `discussion/design/screen-design/screens/authoring-workspace.md`
  - `discussion/implementation/waves/wave63/wave63-domain-c-report.md`
- Reviewed requested Domain C source/test targets. Also reviewed `apps/editor/src/workspace/canvas/canvas-renderer.ts` and `apps/editor/src/workspace/panels/canvas-preview-panel.tsx` because fix loop 1 implemented Rotation overlay rendering/data attributes there.
- Source implementation was not changed by this review.

## Previous Findings Rerun

### C-SPEC-001: Selected Deformer parent creation

Status: resolved.

- Parent payload generation now exists for selected Deformers:
  - Root selected Deformer: new parent payload contains `childRigControlIds: [childRigControlId]`.
  - Parented selected Deformer: payload uses `parentRigControlId + insertBeforeChild.kind === "rigControl"`.
  - Evidence: `apps/editor/src/features/editor-session/model/rig-tool-state.ts:221-253`, `apps/editor/src/features/editor-session/model/rig-tool-state.ts:256-287`.
- Editor context routes both parent creation commands through Domain A create operations and selects the created parent on success: `apps/editor/src/features/editor-session/editor-session-context.tsx:494-540`.
- Committed Warp and Rotation inspectors expose `Create Parent Rotation Deformer` and `Create Parent Warp Deformer`: `apps/editor/src/workspace/panels/rig-tool-inspector.tsx:551-554`, `apps/editor/src/workspace/panels/rig-tool-inspector.tsx:792-795`, `apps/editor/src/workspace/panels/rig-tool-inspector.tsx:1030-1059`.
- Tests cover payload and operation behavior for root and parented cases: `apps/editor/src/features/editor-session/model/rig-tool-state.test.ts:164-207`, `apps/editor/src/features/editor-session/model/editor-session-commands.test.ts:336-395`.
- E2E covers UI visibility and parent Warp creation above a Rotation Deformer: `apps/editor/e2e/psd-import.e2e.spec.ts:387-425`.

### C-SPEC-002: Rotation Deformer committed Canvas overlay

Status: resolved.

- Canvas overlay projection now has `kind: "warp" | "rotation"` and Rotation-specific `pivot` / `restAngleDegrees`: `apps/editor/src/workspace/canvas/canvas-projection.ts:68-81`.
- Selected Rotation rig controls now project a committed overlay with bounds, pivot, rest angle, and child refs: `apps/editor/src/workspace/canvas/canvas-projection.ts:289-310`.
- Canvas renderer draws Rotation overlays instead of filtering them out: `apps/editor/src/workspace/canvas/canvas-renderer.ts:143-145`, `apps/editor/src/workspace/canvas/canvas-renderer.ts:170-214`.
- Canvas panel exposes overlay kind, pivot, and rest-angle test attributes: `apps/editor/src/workspace/panels/canvas-preview-panel.tsx:513-536`.
- Tests cover Rotation projection and E2E visible state: `apps/editor/src/workspace/canvas/canvas-projection.test.ts:335-359`, `apps/editor/e2e/psd-import.e2e.spec.ts:402-409`.

## Fix Loop 2 Spec Rerun

Status: pass maintained.

- The committed Inspector `Parent deformer` select handlers now capture `event.currentTarget.value` before entering state callbacks, avoiding the null-deref exposed by E2E while preserving the existing parent-edit semantics:
  - Draft handler: `apps/editor/src/workspace/panels/rig-tool-inspector.tsx:267-274`
  - Committed Warp handler: `apps/editor/src/workspace/panels/rig-tool-inspector.tsx:514-520`
  - Committed Rotation handler: `apps/editor/src/workspace/panels/rig-tool-inspector.tsx:755-761`
- Committed Inspector parent edit is now covered in E2E, including hierarchy order change and unchanged Parts drawable row order: `apps/editor/e2e/psd-import.e2e.spec.ts:387-438`.
- Keyformed committed Warp Deformers now have component-level coverage that the four division inputs are disabled, and `createWarpUpdatePayload` omits disabled division edits: `apps/editor/src/workspace/panels/rig-tool-inspector.test.ts:24-63`.
- Additional command-wrapper rejection tests cover already-bound Drawable bind and root no-op reparent without mutating the original session/model: `apps/editor/src/features/editor-session/model/editor-session-commands.test.ts:241-294`.

## Spec Compliance Coverage Matrix

| Required Domain C capability | Status | Evidence / notes |
|---|---|---|
| Drawable inspector shows `Create Rotation Deformer` and `Create Warp Deformer` | implemented | Drawable start panel renders both actions (`apps/editor/src/workspace/panels/rig-tool-inspector.tsx:94-100`, `apps/editor/src/workspace/panels/rig-tool-inspector.tsx:138-153`); E2E asserts both (`apps/editor/e2e/psd-import.e2e.spec.ts:273-275`). |
| Bound Drawable create inserts between parent Deformer and Drawable | implemented | Drawable create payloads discover current Drawable deformer parent and emit `insertBeforeChild.kind === "drawable"` for Warp and Rotation (`apps/editor/src/features/editor-session/model/rig-tool-state.ts:161-174`, `apps/editor/src/features/editor-session/model/rig-tool-state.ts:196-217`); unit coverage (`apps/editor/src/features/editor-session/model/rig-tool-state.test.ts:80-126`). |
| User can create a new parent Deformer above selected Deformer | implemented | Fixed in loop 1. Parent Rotation/Warp payloads support root and parented insertion (`apps/editor/src/features/editor-session/model/rig-tool-state.ts:221-287`); Inspector actions present for committed Warp/Rotation (`apps/editor/src/workspace/panels/rig-tool-inspector.tsx:551-554`, `apps/editor/src/workspace/panels/rig-tool-inspector.tsx:792-795`, `apps/editor/src/workspace/panels/rig-tool-inspector.tsx:1030-1059`); command/E2E tests cover the flow. |
| Deformer Inspector committed edits: name, parent, children summary, domain bounds, transform count, Bezier divisions, opacity multiplier, readonly/fixed Bezier type/evaluation | implemented | Warp committed inspector covers name/parent/summary/evaluation/keyform lock (`apps/editor/src/workspace/panels/rig-tool-inspector.tsx:509-545`), bounds fit/reset (`apps/editor/src/workspace/panels/rig-tool-inspector.tsx:557-605`), transform/Bezier/readonly type (`apps/editor/src/workspace/panels/rig-tool-inspector.tsx:608-656`), opacity/apply (`apps/editor/src/workspace/panels/rig-tool-inspector.tsx:659-680`). Rotation inspector covers applicable committed fields and summaries (`apps/editor/src/workspace/panels/rig-tool-inspector.tsx:749-816`). Inspector parent edit E2E now covers committed reparent and unchanged Parts order (`apps/editor/e2e/psd-import.e2e.spec.ts:387-438`). |
| Division edits disabled/rejected with keyforms/cardinality conflict | implemented | UI disables Warp division fields when `hasKeyforms` (`apps/editor/src/workspace/panels/rig-tool-inspector.tsx:608-649`); component test verifies disabled inputs and payload omission (`apps/editor/src/workspace/panels/rig-tool-inspector.test.ts:24-63`); command tests cover cardinality rejection (`apps/editor/src/features/editor-session/model/editor-session-commands.test.ts:361-388`). |
| Parts / Deformers switch preserved | implemented | Structure panel still exposes the switch (`apps/editor/src/workspace/panels/structure-tree-panel.tsx:60-79`). |
| Drawable Pool collapsed default; unbound means not bound to Deformer | implemented | Pool state defaults collapsed (`apps/editor/src/workspace/panels/deformer-tree-view.tsx:47`, `apps/editor/src/workspace/panels/deformer-tree-view.tsx:223-255`); pool computation excludes only rig-bound drawables, not Parts membership (`apps/editor/src/features/editor-session/model/rig-tool-state.ts:441-452`); unit coverage (`apps/editor/src/features/editor-session/model/rig-tool-state.test.ts:128-160`). |
| DnD bind/rebind/reparent and invalid drops feedback/no mutation | implemented | Deformer Tree routes pool bind, bound drawable rebind, and deformer reparent to rig-control commands (`apps/editor/src/workspace/panels/deformer-tree-view.tsx:55-80`); local invalid drop feedback exists (`apps/editor/src/workspace/panels/deformer-tree-view.tsx:65-67`, `apps/editor/src/workspace/panels/deformer-tree-view.tsx:301-308`); command tests cover mutation/rejection (`apps/editor/src/features/editor-session/model/editor-session-commands.test.ts:118-239`, `apps/editor/src/features/editor-session/model/editor-session-commands.test.ts:397-439`). |
| No Parts membership / draw order mutation | implemented | Deformer Tree calls rig operations only; unit test asserts Parts and draw order unchanged after bind/rebind/reparent (`apps/editor/src/features/editor-session/model/editor-session-commands.test.ts:146-196`). Inspector parent edit E2E also asserts Parts drawable row order is unchanged (`apps/editor/e2e/psd-import.e2e.spec.ts:432-437`). |
| Selected Deformer committed overlay; projection updates after commit | implemented | Warp committed overlay/update remains covered (`apps/editor/src/workspace/canvas/canvas-projection.test.ts:291-329`); Rotation committed overlay fixed and covered (`apps/editor/src/workspace/canvas/canvas-projection.ts:289-310`, `apps/editor/src/workspace/canvas/canvas-projection.test.ts:335-359`, `apps/editor/e2e/psd-import.e2e.spec.ts:402-409`). |
| Warp draft Apply rejection feedback shown in Inspector | implemented | `applyRigDraft` now uses shared rig feedback path (`apps/editor/src/features/editor-session/editor-session-context.tsx:451-467`); draft inspector renders operation feedback (`apps/editor/src/workspace/panels/rig-tool-inspector.tsx:217-227`, `apps/editor/src/workspace/panels/rig-tool-inspector.tsx:395`, `apps/editor/src/workspace/panels/rig-tool-inspector.tsx:1018-1027`); E2E covers stale insertion rejection feedback (`apps/editor/e2e/psd-import.e2e.spec.ts:337-385`). |

## Plan-vs-Basis Delta

- Previous blocking deltas are closed.
- Broad Rig Tool design still includes a full Rotation draft editor, pivot editing, and richer Rotation guide workflow. Domain C implements selected-Drawable Rotation creation by deterministic direct commit and committed Rotation overlay. This remains an explicit deferred item in the Domain C report, and is not required by Wave63 Domain C Required UX beyond the create action and selected-Deformer committed overlay.
- Direct bound-child editing inside Inspector remains deferred by design: bound children are summary-only, with add/move owned by Deformer Tree / Drawable Pool.
- Browser E2E now covers pool bind, stale-draft rebind/rejection feedback, committed Inspector parent reparent, Rotation create, and parent Warp create. Deformer drag reparent and parent Rotation creation are covered by focused command/model tests rather than browser drag E2E.

## Inspector / Panel Field Coverage

- Drawable Rig start panel: target summary plus Rotation/Warp create actions.
- Warp draft panel: target binding, parent selection locked for insertion drafts, draft domain bounds, transform control point counts, Bezier divisions, readonly Bezier edit type, fit/reset/apply, and rejection feedback.
- Committed Warp inspector: name, parent, bound children summary, parent creation actions, domain bounds edit/fit/reset, transform counts, Bezier divisions, readonly Bezier/evaluation display, keyform lock, opacity multiplier, and Apply.
- Committed Rotation inspector: name, parent, bound children summary, pivot/rest-angle summary, parent creation actions, keyform state summary, opacity multiplier, and Apply.
- Deformer Tree panel: hierarchy rows, bound drawable reference rows, collapsed Drawable Pool, pool item rows, DnD handlers, and feedback banner.
- Canvas / Preview panel: committed Warp and Rotation overlay attributes and renderer paths.

## Negative Compliance Check

- No Parts membership / draw order mutation from Deformer Tree operations: pass.
- No semantic auto-rig / semantic role inference found in reviewed Domain C source: pass.
- No parameter/keyform authoring UI, subtree opacity keyforms, or opacity keyform authoring added in reviewed Domain C source: pass.
- No manual Bezier control point editing or runtime Bezier evaluation claim added: pass.
- No Mesh algorithm changes found in Domain C fix-loop source. Shared Mesh Tool v2 behavior remains Domain B scope: pass.
- No Cubism compatibility/import/export claim found in reviewed Domain C source: pass.
- No new dependency or package operation redesign found in Domain C fix-loop source: pass.

## Verification Performed

- Read basis docs, Domain A/B/C reports, requested source/test targets, and fix-loop overlay files.
- Focused unit tests:
  - Initial sandbox run failed with `spawn EPERM` while loading Vitest/Vite config.
  - Approved rerun passed: `pnpm.cmd exec vitest run apps/editor/src/features/editor-session/model/rig-tool-state.test.ts apps/editor/src/features/editor-session/model/editor-session-commands.test.ts apps/editor/src/workspace/canvas/canvas-projection.test.ts`
  - Result: 3 files passed, 23 tests passed.
- Focused E2E:
  - Initial sandbox run failed with `spawn EPERM`.
  - Approved rerun passed: `pnpm.cmd --filter @private-2d-rigging-lab/editor exec playwright test -c playwright.config.ts e2e/psd-import.e2e.spec.ts -g 'creates a Warp Deformer draft|shows Inspector feedback|creates a Rotation Deformer' --workers=1 --reporter=line`
  - Result: 3 tests passed.
- Fix loop 2 focused unit/component tests:
  - Initial sandbox run failed with `spawn EPERM` while loading Vitest/Vite config.
  - Approved rerun passed: `pnpm.cmd exec vitest run apps/editor/src/features/editor-session/model/editor-session-commands.test.ts apps/editor/src/workspace/panels/rig-tool-inspector.test.ts`
  - Result: 2 files passed, 12 tests passed.
- Fix loop 2 focused E2E:
  - Initial sandbox run failed with `spawn EPERM`.
  - Approved rerun passed: `pnpm.cmd --filter @private-2d-rigging-lab/editor exec playwright test -c playwright.config.ts e2e/psd-import.e2e.spec.ts -g "reparents a committed Deformer" --workers=1 --reporter=line`
  - Result: 1 test passed.

## Residual Risk Classification

Residual risk: medium.

Reason:

- Deformer drag reparent and parent Rotation creation are not covered by browser E2E, though model/command tests cover the operation semantics.
- Rotation creation remains a direct-commit path with deterministic default pivot, not a full draft/pivot editor.
- The broader Rig Tool design contains future Rotation editing/detail work outside this Wave63 required UX slice.
