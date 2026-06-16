# Wave76 Domain E Report: Rig Batch Create for Unbound Drawables

- Verdict: pass
- Domain: `wave76-rig-batch-create-unbound-drawables`
- Date: 2026-06-16
- Implementer: Gnome

## Basis Coverage Self-Report

Reviewed before editing:

- `discussion/implementation/orchestration/wave76-plan.md`, especially sections 3.5, 7.5, 13, 15, 17, 18, and 19.
- `discussion/implementation/waves/wave76/wave76-domain-b-rigcontrol-partid-legacy-optional-decoupling-report.md`
- `discussion/implementation/waves/wave76/wave76-domain-c-drawable-multiselect-parts-tree-select-inspector-report.md`
- `discussion/implementation/waves/wave76/wave76-domain-d-mesh-target-simplification-multi-preview-apply-report.md`
- Domain B/C/D review lane reports under `discussion/implementation/reviews/wave76/`.
- `discussion/implementation/orchestration/wave75-plan.md`
- `discussion/implementation/waves/wave75/wave75-final-integration-report.md`
- `discussion/implementation/reviews/wave75/wave75-final-clean-integration-review.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/ux-backed-package-logic-authority.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/operation-policy.md`

Implemented Domain E requirements:

- Rig Tool renders a Drawable-set target section listing all selected Drawable names.
- Drawables already present in any `rigControl.childDrawableIds` are marked bound, excluded from create payloads, and shown in a warning.
- Eligible Drawable means selected and not currently a child of any RigControl.
- Batch `Create Rotation Deformer` and `Create Warp Deformer` are disabled when zero eligible selected Drawables remain.
- Batch Rotation create commits one root Rotation Deformer with all eligible `childDrawableIds`, a pivot from eligible union bounds, and no `partId`.
- Batch Warp create commits one root Warp Deformer with all eligible `childDrawableIds`, union warp domain bounds, default grid metadata, and no `partId`.
- Existing single Drawable create paths remain usable, including the already-bound single Drawable insertion/wrap path that existed before Domain E.

## Deferred Basis Items

- No bound Drawable wrap behavior was implemented for multi-select batch mode.
- No multiple-parent wrap behavior, mixed child RigControl + Drawable wrap, Deformer Tree multi-select, or Canvas modifier multi-select was added.
- No operation-layer changes were needed because Domain B already made no-`partId` create payloads valid.
- Mesh batch behavior was not changed beyond keeping the shared context type-compatible.

## Files Changed

- `apps/editor/src/features/editor-session/model/rig-tool-state.ts`
- `apps/editor/src/features/editor-session/model/rig-tool-state.test.ts`
- `apps/editor/src/workspace/panels/rig-tool-inspector.tsx`
- `apps/editor/src/workspace/panels/rig-tool-inspector.test.ts`
- `apps/editor/src/features/editor-session/editor-session-context.tsx`
- `apps/editor/e2e/psd-import.e2e.spec.ts`
- `discussion/implementation/waves/wave76/_map.md`
- `discussion/implementation/waves/wave76/wave76-domain-e-rig-batch-create-unbound-drawables-report.md`

## Implementation Summary

- Added Rig batch model helpers in `rig-tool-state.ts`:
  - `createRigBatchDrawableTargets` centralizes selected Drawable projection and bound/eligible status.
  - `createRotationDeformerPayloadForUnboundDrawables` creates a root Rotation payload from eligible selected Drawables only.
  - `createWarpDeformerPayloadForUnboundDrawables` creates a root Warp payload from eligible selected Drawables only.
- Added editor context actions for batch Rotation/Warp create. Both route through the existing Operation Core commit helpers and select the created RigControl on success.
- Added a batch Rig Tool target section for `selection.kind === "drawableSet"` with selected names, bound warnings, and disabled create buttons when all selected Drawables are bound.
- Kept the existing single Drawable Rig create UI and helper behavior intact.
- Extended the existing PSD-import multi-select E2E path to enter Rig Tool, create a batch Rotation Deformer, then reselect the now-bound Drawables and assert warning/disabled/no-wrap UI.

## Data / Operation Contract Trace

- Batch eligibility uses current authoring graph state only: a Drawable is bound if any RigControl lists it in `childDrawableIds`.
- Batch creates are root creates by construction. The new batch payload helpers do not set `parentRigControlId` or `insertBeforeChild`.
- New batch payloads do not include `partId`; tests assert the payloads and committed RigControls omit it.
- Rotation pivot uses the union of eligible Drawable bounds.
- Warp domain bounds use the union of eligible Drawable warp-domain bounds, including the existing mesh-vertex domain margin behavior.

## Validation Commands / Results

| Command | Result |
|---|---|
| `pnpm.cmd exec vitest run apps/editor/src/features/editor-session/model/rig-tool-state.test.ts apps/editor/src/workspace/panels/rig-tool-inspector.test.ts` | First sandbox attempt failed before tests with Vite/esbuild `spawn EPERM`; escalated rerun passed, 2 files / 14 tests. |
| `pnpm.cmd exec vitest run apps/editor/src/features/editor-session/editor-session-context-history.test.ts` | Passed after escalation, 1 file / 10 tests. |
| `pnpm.cmd typecheck` | Passed. |
| `pnpm.cmd --dir apps/editor run test:e2e:psd-import -- e2e/psd-import.e2e.spec.ts --grep "multi-selects Drawable rows"` | Passed after escalation. Existing script argument behavior ran the full PSD import spec: 11 Playwright tests. |
| `node scripts/check-source-organization.mjs` | Passed. |
| `node scripts/check-dependencies.mjs` | Passed. |
| `git diff --check -- apps/editor/src/features/editor-session/model/rig-tool-state.ts apps/editor/src/features/editor-session/model/rig-tool-state.test.ts apps/editor/src/workspace/panels/rig-tool-inspector.tsx apps/editor/src/workspace/panels/rig-tool-inspector.test.ts apps/editor/src/features/editor-session/editor-session-context.tsx apps/editor/e2e/psd-import.e2e.spec.ts discussion/implementation/waves/wave76` | Passed; Git emitted LF-to-CRLF working-copy warnings only. |

## Negative-Scope Proof

- Batch helpers return `undefined` when every selected Drawable is already bound, and mixed eligible/bound selections create payloads only for eligible Drawables.
- Batch payload tests assert no `parentRigControlId` and no `insertBeforeChild`, proving no root batch wrap of already-bound selected children is encoded.
- Inspector tests assert no `Wrap` control appears in the batch start UI.
- E2E asserts already-bound selected Drawables show the warning, both create buttons are disabled, and no wrap button is present.
- Single selected already-bound Drawable insertion behavior remains covered by the existing model test for `createWarpDeformerDraftForDrawable` and `createRotationDeformerPayloadForDrawable`.
- No Deformer Tree multi-select, Canvas Shift/Ctrl multi-select, fake/common Parts Container ownership, or new dependency was added.

## Review Gate

| Review | Result | Artifact |
|---|---|---|
| Spec Compliance | pass | [../../reviews/wave76/wave76-domain-e-spec-compliance-review.md](../../reviews/wave76/wave76-domain-e-spec-compliance-review.md) |
| Design / Development Compliance | pass | [../../reviews/wave76/wave76-domain-e-design-development-review.md](../../reviews/wave76/wave76-domain-e-design-development-review.md) |
| Test Adequacy | pass | [../../reviews/wave76/wave76-domain-e-test-adequacy-review.md](../../reviews/wave76/wave76-domain-e-test-adequacy-review.md) |

Review outcome: no blocking or needs-change findings. No fix loop was required.

## Residual Risks

- The focused E2E covers batch Rotation create and zero-eligible bound warning/disabled UI. Batch Warp create is covered by model/operation commit tests, not a separate browser assertion.
- Batch Warp create commits directly with default grid settings instead of opening the single-Drawing draft editor. This matches the batch create AC, while the single Drawable Warp path still opens the editable draft.
- Warning UI lists bound Drawable names but not their parent Deformer names; the plan requires a warning, not parent attribution.
- The shared worktree remains dirty from Wave76 Domains A/B/C/D and map/review artifacts. This report only claims the files listed above.

## User Decision Points

None.

## Blockers

None.
