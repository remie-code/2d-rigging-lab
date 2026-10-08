# Wave91 Domain B Test Adequacy Review

Verdict: `pass`

Review lane: Test Adequacy Review
Target: `wave91-editor-deformer-lifecycle-integration`
Reviewer: Review-Sylph
Date: 2026-06-20

## Findings

No blocking or required-change findings.

## Scope

Reviewed the current working-tree Domain B source and tests directly against:

- `discussion/implementation/orchestration/wave91-plan.md`
- `discussion/implementation/waves/wave91/wave91-domain-a-core-rig-lifecycle-operations-report.md`
- `discussion/implementation/reviews/wave91/wave91-domain-a-test-adequacy-review.md`
- `discussion/development_convention/operation-policy.md`

Source/test files inspected:

- `apps/editor/src/features/editor-session/model/editor-session-commands.ts`
- `apps/editor/src/features/editor-session/model/editor-session-commands.test.ts`
- `apps/editor/src/features/editor-session/model/mesh-apply-auto-refit.ts`
- `apps/editor/src/features/editor-session/model/mesh-apply-auto-refit.test.ts`
- `apps/editor/src/features/editor-session/editor-session-context.tsx`
- `apps/editor/src/features/editor-session/editor-session-context-history.test.ts`
- `apps/editor/src/workspace/panels/rig-tool-inspector.tsx`
- `apps/editor/src/workspace/panels/rig-tool-inspector.test.ts`

I did not edit source or test files.

## Required Coverage Check

| Required coverage | Adequacy | Evidence |
|---|---|---|
| Warp Inspector renders `Delete Deformer` and invokes delete callback. | Covered | `apps/editor/src/workspace/panels/rig-tool-inspector.test.ts:90` renders `CommittedWarpDeformerInspector`, clicks `Delete Deformer`, and asserts `onDelete` was called with `RIG_FACE_WARP` at `:106`-`:107`. Production wiring passes `deleteRigControl` into the Warp inspector at `apps/editor/src/workspace/panels/rig-tool-inspector.tsx:99`-`:104`, and the action is rendered at `:747` and `:1303`-`:1314`. |
| Rotation Inspector renders `Delete Deformer` and invokes delete callback. | Covered | `apps/editor/src/workspace/panels/rig-tool-inspector.test.ts:160` renders `CommittedRotationDeformerInspector`, clicks `Delete Deformer`, and asserts `onDelete` was called with `RIG_FACE_ROTATION` at `:176`-`:177`. Production wiring passes `deleteRigControl` into the Rotation inspector at `apps/editor/src/workspace/panels/rig-tool-inspector.tsx:110`-`:115`, and the action is rendered at `:1039` and `:1303`-`:1314`. |
| Editor delete clears selected deformer and is undoable/redoable. | Covered | Provider integration test `apps/editor/src/features/editor-session/editor-session-context-history.test.ts:1031` starts with selected `ROTATION_RIG_CONTROL_ID`, calls `deleteRigControl`, asserts selection is `null`, target rig is removed, and undo is available at `:1041`-`:1052`; undo restores the rig at `:1054`-`:1059`; redo removes it again and leaves selection `null` at `:1061`-`:1066`. Production delete callback clears selection/draft/feedback at `apps/editor/src/features/editor-session/editor-session-context.tsx:2084`-`:2096`. |
| Duplicate display-name create returns actual suffixed ID and selection lands on created rig control. | Covered | Model wrapper test `apps/editor/src/features/editor-session/model/editor-session-commands.test.ts:129` asserts duplicate rotation create returns `rig_repeat_rotation` then `rig_repeat_rotation_2` and that the suffixed rig exists with the requested display name at `:150`-`:159`. Provider test `apps/editor/src/features/editor-session/editor-session-context-history.test.ts:1072` asserts selection lands on `rig_twin_rotation_deformer` first, then `rig_twin_rotation_deformer_2`, and the created rig owns the intended Drawable at `:1078`-`:1101`. The wrapper extracts actual added rig IDs from Operation Core model diffs at `apps/editor/src/features/editor-session/model/editor-session-commands.ts:300`-`:326` and `:571`-`:578`, and provider create paths select that returned ID at `apps/editor/src/features/editor-session/editor-session-context.tsx:1843`-`:1853`, `:1871`-`:1881`, `:1900`-`:1910`, `:1930`-`:1938`, `:1956`-`:1964`, `:1981`-`:1990`, and `:2008`-`:2017`. |
| Mesh Apply after pre-created unkeyed Warp expands domain to include generated mesh vertices. | Covered | Model helper test `apps/editor/src/features/editor-session/model/mesh-apply-auto-refit.test.ts:35` asserts an unkeyed Warp expands and contains mesh vertices at `:52`-`:62`. Provider integration test `apps/editor/src/features/editor-session/editor-session-context-history.test.ts:1107` previews/applies a mesh draft with a pre-created Warp and asserts drafts are cleared, mesh was generated, and the Warp domain contains generated vertices at `:1124`-`:1134`; fixture creates the pre-existing small Warp at `:1797`-`:1824`. |
| Mesh Apply does not shrink an already larger Warp domain. | Covered | `apps/editor/src/features/editor-session/model/mesh-apply-auto-refit.test.ts:65` starts with a large domain, runs auto-refit, asserts no commit and unchanged domain at `:83`-`:86`. Production helper unions current and required bounds then skips same bounds at `apps/editor/src/features/editor-session/model/mesh-apply-auto-refit.ts:37`-`:45`. |
| Mesh Apply skips keyed Warp Deformer. | Covered | `apps/editor/src/features/editor-session/model/mesh-apply-auto-refit.test.ts:89` marks the Warp keyed and asserts no commit plus unchanged small domain at `:104`-`:110`. Production helper skips `hasRigControlKeyforms` at `apps/editor/src/features/editor-session/model/mesh-apply-auto-refit.ts:22`-`:25`. |
| Mesh Apply processes nested unkeyed Warp ancestors inner-to-outer. | Covered | `apps/editor/src/features/editor-session/model/mesh-apply-auto-refit.test.ts:113` creates parent/child Warp hierarchy and asserts both child and parent are expanded, with parent matching child after processing at `:135`-`:140`. Production candidate collection sorts deeper hierarchy first at `apps/editor/src/features/editor-session/model/mesh-apply-auto-refit.ts:95`-`:97`. |
| Mesh Apply shared parent Warp expands to include all children, not only committed Drawable. | Covered | `apps/editor/src/features/editor-session/model/mesh-apply-auto-refit.test.ts:143` commits only `DRAW_A` but asserts the shared parent domain contains both `MESH_A` and `MESH_B` vertices at `:165`-`:170`. Production helper computes required bounds from the candidate Warp's current `childDrawableIds` and `childRigControlIds`, not only committed IDs, at `apps/editor/src/features/editor-session/model/mesh-apply-auto-refit.ts:28`-`:32`. |
| Existing mesh draft apply behavior and draft cleanup remain intact. | Covered | Existing provider test `apps/editor/src/features/editor-session/editor-session-context-history.test.ts:972` previews batch mesh drafts, cancels and asserts drafts clear at `:1001`-`:1004`, re-previews, applies, asserts drafts clear, empty targets gain generated meshes, and an already-existing mesh is unchanged at `:1012`-`:1023`. New auto-refit provider test also asserts draft cleanup after apply at `:1124`-`:1129`. |
| Focused tests exercise both model-level helper and provider/context integration where needed. | Covered | Auto-refit behavior is tested at model helper level in `apps/editor/src/features/editor-session/model/mesh-apply-auto-refit.test.ts:35`, `:65`, `:89`, `:113`, and `:143`, and provider hook integration is tested in `apps/editor/src/features/editor-session/editor-session-context-history.test.ts:1107`. Delete and suffixed-ID UI/provider behavior are tested through `apps/editor/src/workspace/panels/rig-tool-inspector.test.ts:90` / `:160` and `apps/editor/src/features/editor-session/editor-session-context-history.test.ts:1031` / `:1072`. |

## Repository Facts

- Editor command wrappers route package mutation through Operation Core via `commitOperationInPlace`: `apps/editor/src/features/editor-session/model/editor-session-commands.ts:526`-`:555`.
- `commitCreateWarpDeformer` and `commitCreateRotationDeformer` return the actual committed rig control ID extracted from `operationResult.modelDiff.added`, not a predicted display-name-derived ID: `apps/editor/src/features/editor-session/model/editor-session-commands.ts:300`-`:326` and `:571`-`:578`.
- `commitDeleteRigControl` routes deletion through the Domain A `deleteRigControl` operation: `apps/editor/src/features/editor-session/model/editor-session-commands.ts:384`-`:391`.
- `applyMeshDraft` commits all eligible mesh drafts first, then invokes `commitMeshApplyAutoRefit` once with the collected committed Drawable IDs: `apps/editor/src/features/editor-session/editor-session-context.tsx:1699`-`:1753`. It then clears drafts/diagnostics on commit at `:1757`-`:1767`.
- `commitMeshApplyAutoRefit` dedupes affected Warp ancestors from committed Drawables, processes deeper ancestors first, skips keyed Warps, computes required bounds from all current children, and commits only union-expansion domain changes: `apps/editor/src/features/editor-session/model/mesh-apply-auto-refit.ts:13`-`:58` and `:60`-`:97`.

## Residual Risks

- Provider duplicate-suffix selection is directly asserted for single Drawable Rotation creation. Other provider create paths use the same returned-ID extraction and selection pattern, and Domain A covers suffixing across rotation, warp lattice, and warp deformer creation, so residual risk is low.
- No provider-level test repeats no-shrink, keyed-skip, nested, or shared-parent auto-refit cases. Those are covered at the model helper level, while provider integration covers the hook placement and draft cleanup. This split is adequate for the current change size.

## Verification Performed

Commands run:

- `Get-Content -Encoding UTF8 ...` on the basis documents and all listed Domain B source/test files.
- `rg -n "..." ...` to locate Domain B implementation and test evidence.
- `git status --short -uall`
- `git diff --stat -- apps/editor/src/features/editor-session/model/editor-session-commands.ts apps/editor/src/features/editor-session/model/editor-session-commands.test.ts apps/editor/src/features/editor-session/model/mesh-apply-auto-refit.ts apps/editor/src/features/editor-session/model/mesh-apply-auto-refit.test.ts apps/editor/src/features/editor-session/editor-session-context.tsx apps/editor/src/features/editor-session/editor-session-context-history.test.ts apps/editor/src/workspace/panels/rig-tool-inspector.tsx apps/editor/src/workspace/panels/rig-tool-inspector.test.ts discussion/implementation/reviews/wave91`

I did not rerun Vitest in this review. This verdict is based on read-only source/test inspection and concrete assertion mapping.
