# Wave76 Domain E Spec Compliance Review

- Review lane: Spec Compliance
- Domain: `wave76-rig-batch-create-unbound-drawables`
- Date: 2026-06-16
- Reviewer: Review-Sylph
- Verdict: `pass`

## Basis Reviewed

- `discussion/implementation/orchestration/wave76-plan.md`
  - Rig batch acceptance: lines 91-98.
  - Domain E requirements and must-not list: lines 286-307.
  - Domain E implementation/evidence scope: lines 464-488.
  - Verification matrix: lines 536-554.
  - Orchestration and out-of-scope policy: lines 621-656 and 669-692.
- `discussion/implementation/waves/wave76/wave76-domain-e-rig-batch-create-unbound-drawables-report.md`.
- Dependency reports and reviews for Domains B/C/D:
  - Domain B report and spec review for no-`partId` create readiness.
  - Domain C report and spec review for `drawableSet` selection readiness.
  - Domain D report and spec review for sequenced context compatibility.
- Directly inspected Domain E source/tests:
  - `apps/editor/src/features/editor-session/model/rig-tool-state.ts`
  - `apps/editor/src/features/editor-session/model/rig-tool-state.test.ts`
  - `apps/editor/src/workspace/panels/rig-tool-inspector.tsx`
  - `apps/editor/src/workspace/panels/rig-tool-inspector.test.ts`
  - `apps/editor/src/features/editor-session/editor-session-context.tsx`
  - `apps/editor/e2e/psd-import.e2e.spec.ts`

## Findings

No blocking findings.

No needs-change findings.

## Spec Coverage

| Requirement | Review result | Evidence |
|---|---|---|
| Rig Tool multi-select target section shows selected Drawable names. | Implemented. | `getSelectedDrawableIds` returns the `drawableSet.ids` list at `apps/editor/src/features/editor-session/model/editor-selection.ts:36-47`. `RigToolInspector` handles `selection.kind === "drawableSet"` and passes batch targets at `apps/editor/src/workspace/panels/rig-tool-inspector.tsx:121-127`. `RigBatchTargetStart` renders each target display name under `data-testid="rig-tool-target-name"` at `rig-tool-inspector.tsx:210-234`. Component and E2E assertions cover the names at `rig-tool-inspector.test.ts:155-157` and `psd-import.e2e.spec.ts:213-217`. |
| Already-bound selected Drawables are excluded from create actions and warned. | Implemented. | `createRigBatchDrawableTargets` marks a target `alreadyBound` when `findDrawableRigControlParentId` finds any RigControl containing the Drawable id at `rig-tool-state.ts:254-260`; the lookup checks `childDrawableIds` at `rig-tool-state.ts:1017-1023`. Batch payload helpers filter to `status === "eligible"` at `rig-tool-state.ts:271-278` and `:297-305`. Warning UI lists excluded names at `rig-tool-inspector.tsx:237-244`; tests cover mixed eligible/bound behavior at `rig-tool-state.test.ts:210-260`, `rig-tool-inspector.test.ts:132-162`, and `psd-import.e2e.spec.ts:224-235`. |
| Eligible = selected Drawable not child of any RigControl. | Implemented. | Eligibility is exactly `boundRigControlId === undefined` in `createRigBatchDrawableTargets` at `rig-tool-state.ts:254-260`, where bound means included by a RigControl's `childDrawableIds` at `rig-tool-state.ts:1017-1023`. |
| Zero eligible disables `Create Rotation Deformer` and `Create Warp Deformer`. | Implemented. | `RigBatchTargetStart` derives `canCreate` from `eligibleTargets.length > 0` at `rig-tool-inspector.tsx:196-198` and binds it to both buttons' `disabled` attributes at `:254` and `:268`. Component and E2E assertions cover all-bound selection at `rig-tool-inspector.test.ts:165-184` and `psd-import.e2e.spec.ts:228-235`. Context callbacks also return feedback without committing when payload creation returns `undefined` at `editor-session-context.tsx:1101-1107` and `:1130-1136`. |
| Rotation batch creates one root Rotation Deformer with all eligible `childDrawableIds`. | Implemented. | `createRotationDeformerPayloadForUnboundDrawables` returns all eligible ids as `childDrawableIds`, empty `childRigControlIds`, and no parent/insert fields at `rig-tool-state.ts:267-290`. Tests assert mixed selection keeps only the eligible id at `rig-tool-state.test.ts:242-253`, two-unbound selection commits one root Rotation RigControl at `:263-296`, and E2E observes a committed rotation overlay with child count 2 at `psd-import.e2e.spec.ts:219-222`. |
| Warp batch creates one root Warp Deformer with all eligible `childDrawableIds`. | Implemented. | `createWarpDeformerPayloadForUnboundDrawables` filters eligible targets and passes all eligible ids into the Warp payload at `rig-tool-state.ts:293-321`. Tests assert two-unbound selection commits one root Warp RigControl at `rig-tool-state.test.ts:298-333`. |
| Rotation pivot and Warp domain bounds are from eligible Drawable union bounds. | Implemented with existing Warp-domain semantics. | Rotation uses `unionRects` over eligible target bounds and sets pivot to the union center at `rig-tool-state.ts:278-288`; tests expect pivot `{ x: 45, y: 40 }` for Face+Hair at `rig-tool-state.test.ts:270-276`. Warp uses `unionRects` over `resolveDrawableWarpDomainBounds` for eligible ids at `rig-tool-state.ts:304-309`; that resolver uses mesh vertex bounds or mesh bounds with the established margin before falling back to Drawable bounds at `rig-tool-state.ts:911-925` and `:1107-1113`. The batch Warp test expects the union domain `{ x: 9, y: 19, width: 72, height: 42 }` at `rig-tool-state.test.ts:305-330`. |
| Created Deformers do not require or write `partId`. | Implemented. | Batch payload helpers do not include `partId`, `parentRigControlId`, or `insertBeforeChild` at `rig-tool-state.ts:280-290` and `:311-321`. Tests assert no `partId` on batch payloads and committed RigControls at `rig-tool-state.test.ts:251-253`, `:278-295`, and `:316-332`. Domain B review records the operation payload/handler readiness for no-`partId` creates. |
| Existing single Drawable Rig create remains usable. | Implemented. | Single Drawable selection still routes to `WarpDeformerSingleTargetStart` at `rig-tool-inspector.tsx:111-117`; context still exposes `createRotationDeformerForDrawable` at `editor-session-context.tsx:1073-1087` and single Warp draft apply at `:1058-1070`. Existing tests cover single Warp draft creation at `rig-tool-state.test.ts:46-64`, already-bound single Drawable insertion payloads at `:163-208`, context single-Rotation feedback at `editor-session-context-history.test.ts:328-340`, and E2E single Rotation create at `psd-import.e2e.spec.ts:596-625`. |

## Forbidden-Scope Checks

| Must not | Result | Evidence |
|---|---|---|
| Include already-bound Drawables in batch create. | Pass. | Batch payload helpers filter to eligible targets only at `rig-tool-state.ts:271-278` and `:297-305`; mixed-selection test asserts only `DRAW_HAIR` is included at `rig-tool-state.test.ts:242-253`. |
| Wrap already-bound selected Drawable children or mix bound/unbound into one wrapper operation. | Pass. | Batch helpers return root payloads without `parentRigControlId` or `insertBeforeChild`; tests assert those fields are absent at `rig-tool-state.test.ts:251-253`, `:278-280`, and `:316-318`. Batch UI and E2E assert no `Wrap` control at `rig-tool-inspector.test.ts:162`, `:184`, and `psd-import.e2e.spec.ts:236`. |
| Create fake/common Parts ownership or write `partId`. | Pass. | Batch payloads and committed controls omit `partId`; the remaining `partId` references in inspected tests are Drawable/Part fixture data, not batch Rig ownership. Domain B review map marks `partId` decoupling ready for Domain E at `discussion/implementation/reviews/wave76/_map.md:20` and `:39`. |
| Add Deformer Tree multi-select. | Pass. | Deformer Tree Drawable rows still call `selectDrawable(...)` without modifier/range options at `apps/editor/src/workspace/panels/deformer-tree-view.tsx:140` and `:289`. |
| Add Canvas Shift/Ctrl multi-select. | Pass. | Canvas hit selection still calls `selectDrawable(hitDrawableId)` without event modifier options at `apps/editor/src/workspace/panels/canvas-preview-panel.tsx:499-503`. Modifier multi-select remains localized to Parts Tree rows at `apps/editor/src/workspace/panels/structure-tree-panel.tsx:51-60`. |

## Verification Reviewed

Domain E implementation report records the following as passed after the noted sandbox escalation where applicable:

- Focused Vitest for `rig-tool-state.test.ts` and `rig-tool-inspector.test.ts`: 2 files / 14 tests.
- `editor-session-context-history.test.ts`: 1 file / 10 tests.
- `pnpm.cmd typecheck`.
- PSD import Playwright path; existing script argument behavior ran the full spec: 11 tests.
- Source organization, dependency guard, and `git diff --check` for Domain E files.

I did not rerun Vitest, Playwright, typecheck, or guard scripts in this review lane. This verdict is based on direct source/test/E2E inspection plus the recorded validation in the Domain E report.

## Residual Risks

- Batch Warp create is covered by model/operation commit tests, not by a separate browser assertion. The browser path covers batch Rotation create and all-bound warning/disabled/no-wrap behavior.
- The Warp batch domain is the union of eligible Drawable warp-domain bounds, which include the pre-existing mesh-vertex/mesh-bounds margin semantics. This is consistent with existing single Warp behavior, but it is not a raw layer-bounds-only union.
- The shared worktree is dirty from Wave76 Domains A/B/C/D/E and review artifacts. This review did not attribute unrelated dirty files to Domain E and did not modify source.

## User-Decision Points

None.

## Final Verdict

`pass`
