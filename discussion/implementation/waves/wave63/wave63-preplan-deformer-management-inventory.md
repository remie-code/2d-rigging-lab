# Wave63 Pre-Plan Inventory: Deformer Management / Inspector Editing UX

## Status

- Status: pass
- Role: Sylph A factual inventory
- Scope: Deformer Tree / Drawable Pool / Deformer Creation / Insertion / Deformer Inspector editing の現状棚卸。
- Non-goals: 実装、修正、リファクタ、product decision、map更新。
- Worktree note: 読み取り時点で `discussion/design/**` に既存の未コミット変更がある。今回作成した成果物はこのreportのみ。

## Basis Read

- `discussion/_map.md`
- `discussion/design/screen-design/_map.md`
- `discussion/design/screen-design/components/rig-tool.md`
- `discussion/design/screen-design/components/parameter-keyform.md`
- `discussion/design/screen-design/components/canvas-preview.md`
- `discussion/design/screen-design/components/parts-tree.md`
- `discussion/implementation/orchestration/wave62-plan.md`
- `discussion/implementation/waves/wave62/wave62-domain-b-warp-deformer-package-foundation-report.md`
- `discussion/implementation/waves/wave62/wave62-domain-c-rig-tool-deformer-tree-editor-v0-report.md`
- `discussion/implementation/reviews/wave62/wave62-domain-c-rig-tool-deformer-tree-editor-v0-review.md`
- `discussion/implementation/reviews/wave62/wave62-final-clean-integration-review.md`

## Inventory Table

| ID | Design expectation | Current implementation fact | Gap | Likely package/editor impact | Source refs |
|---|---|---|---|---|---|
| DMI-001 | Drawable選択時に `Create Rotation Deformer` と `Create Warp Deformer` の両方を出す。 | Editor Rig ToolはDrawable選択時に `Create Warp Deformer` だけを出す。operation/packageには `rotation2d` storageと `createRotation2dRigControl` operationが既にある。 | Rotation DeformerのEditor draft/Inspector/Canvas導線が未実装。 | 主にEditor。必要ならRotation draft state / command wrapper / overlay追加。package/operationのcreate基礎は既存利用可能。 | `apps/editor/src/workspace/panels/rig-tool-inspector.tsx:68`, `apps/editor/src/workspace/panels/rig-tool-inspector.tsx:108`, `packages/package-format/src/model-files.ts:199`, `packages/operation-core/src/payloads/rig-control.ts:11`, `packages/operation-core/src/operation-payload.ts:101` |
| DMI-002 | 既存Deformer配下のDrawableにCreateした場合、親DeformerとDrawableの間に新Deformerを挿入する。 | Draft作成は選択Drawableを `childDrawableIds` に入れるだけで、既存親Deformerを探索しない。`createWarpDeformer` は `parentRigControlId` を受けて新Deformerを親へbindできるが、既にどこかのRigControlにbind済みのDrawableはmutationで拒否される。 | 挿入operation/model mutationがない。現行createでは「親からDrawableを外す -> 新Deformerを親へbind -> Drawableを新Deformerへbind」を一貫実行できない。 | package/authoring-core/operation-coreにbinding moveまたはinsert operationが必要。Editor create flowも既存親探索と挿入payloadに対応が必要。 | `apps/editor/src/features/editor-session/model/rig-tool-state.ts:99`, `apps/editor/src/features/editor-session/model/rig-tool-state.ts:108`, `packages/operation-core/src/operations/create-warp-deformer.ts:135`, `packages/operation-core/src/operations/create-warp-deformer.ts:143`, `packages/authoring-core/src/rig-control-mutations.ts:334`, `packages/authoring-core/src/rig-control-mutations.ts:346` |
| DMI-003 | Deformer選択時Inspectorで、name / parent deformer / bound children / domain bounds / Transform divisions / Bezier divisions / opacity multiplier を後から編集できる。 | Package: `displayName`, `parentId`, `childDrawableIds`, `childRigControlIds`, `domainBounds`, `latticeColumns/Rows`, `warpDeformer.transformGrid`, `warpDeformer.bezierEditSurface` は持てる。静的なdeformer opacity multiplier fieldは見当たらない。Editor: draft中はname/parent/bounds/divisionsを編集できるが、committed Inspectorはsummary表示のみ。Operation: create/bindのみで、既存Deformer settings update operationは見当たらない。Validator: refs/cycle/domain/cardinality/Bezier cardinalityは検証するが、opacity multiplierは対象外。 | 後編集は未実装。特にopacity multiplierはpackage contract自体が未整備。bound children編集もsummaryのみで操作はない。 | package-formatにopacity multiplier field追加が必要な可能性。operation-coreにupdate/reparent/rebind系operation、validator-coreに新field/duplicate validation、editorにcommitted editing UIが必要。 | `packages/package-format/src/model-files.ts:214`, `packages/package-format/src/model-files.ts:219`, `packages/package-format/src/model-files.ts:223`, `packages/package-format/src/model-files.ts:228`, `apps/editor/src/workspace/panels/rig-tool-inspector.tsx:208`, `apps/editor/src/workspace/panels/rig-tool-inspector.tsx:360`, `apps/editor/src/workspace/panels/rig-tool-inspector.tsx:377`, `packages/operation-core/src/operation-payload.ts:101`, `packages/operation-core/src/operation-payload.ts:109`, `packages/operation-core/src/operation-payload.ts:112`, `packages/validator-core/src/validators/rig-control-semantic.ts:41`, `packages/validator-core/src/validators/warp-lattice-diagnostics.ts:135` |
| DMI-004 | Deformer Treeにcollapsed defaultの `Drawable Pool` / `Unbound Drawables` を追加する。 | Structure paneには `Parts` / `Deformers` toggleがある。Deformer Treeはdraft summary、empty、Warp Deformer row、bound Drawable reference rowだけを描画する。Pool row type、unbound drawable computation、collapsed default stateはない。 | Pool / Unbound Drawablesは未実装。 | Editor model projectionとUI state追加が中心。operationはPool表示だけなら不要。DnD/bindまで含めるならoperation command接続が必要。 | `apps/editor/src/workspace/panels/structure-tree-panel.tsx:60`, `apps/editor/src/workspace/panels/structure-tree-panel.tsx:83`, `apps/editor/src/workspace/panels/deformer-tree-view.tsx:14`, `apps/editor/src/workspace/panels/deformer-tree-view.tsx:32`, `apps/editor/src/workspace/panels/deformer-tree-view.tsx:40`, `apps/editor/src/features/editor-session/model/rig-tool-state.ts:74`, `apps/editor/src/features/editor-session/model/rig-tool-state.ts:219` |
| DMI-005 | PoolからDeformerへのDnDで、unbound DrawableをDeformerへbindする。 | `bindRigControlChild` operation/mutationは、unbound Drawableを既存RigControlへbindできる。Deformer TreeにはDnD handlerやEditor command wrapperがない。 | operation基礎は一部あるが、Editor UI/command/DnDは未実装。 | Editor: Deformer Tree DnD、drop validation、command wrapper。Operation: existing `bindRigControlChild` を使える可能性が高いが、UX用diagnostic mapping確認が必要。 | `packages/authoring-core/src/rig-control-mutations.ts:142`, `packages/authoring-core/src/rig-control-mutations.ts:158`, `packages/authoring-core/src/rig-control-mutations.ts:393`, `packages/operation-core/src/operations/bind-rig-control-child.ts:27`, `packages/operation-core/src/payloads/rig-control.ts:52`, `apps/editor/src/workspace/panels/deformer-tree-view.tsx:42` |
| DMI-006 | 既存bound Drawable referenceを別DeformerへDnDするとbinding先を変更する。 | Existing bindingを移動するoperationは見当たらない。`bindRigControlChild` はDrawableが既に同じ親にある場合no-op、別RigControlにある場合 `rig_control_child_already_parented` で拒否する。 | rebind/move operationがない。 | authoring-coreにunbind/move/rebind mutation、operation-coreにdry-run/commit/modelDiff、validator-coreにduplicate binding検出、editor DnDが必要。 | `packages/authoring-core/src/rig-control-mutations.ts:405`, `packages/authoring-core/src/rig-control-mutations.ts:412`, `packages/operation-core/src/operations/bind-rig-control-child.ts:281`, `packages/operation-core/src/operations/create-warp-deformer.ts:511` |
| DMI-007 | Deformer rowを別Deformer rowへDnDするとparent deformerを変更する。 | Modelは `parentId` と `childRigControlIds` を持つ。`bindRigControlChild` は未parented child rig controlを親へbindでき、cycleを拒否する。ただし既にparentを持つchild rig controlのparent変更は拒否される。Deformer Tree DnDはない。 | reparent/move operationとEditor DnDが未実装。 | authoring-core/operation-coreにset parentまたはmove child operationが必要。validatorのcycle/missing/mismatchは既存利用可能。 | `packages/package-format/src/model-files.ts:219`, `packages/package-format/src/model-files.ts:221`, `packages/authoring-core/src/rig-control-mutations.ts:423`, `packages/authoring-core/src/rig-control-mutations.ts:453`, `packages/authoring-core/src/rig-control-mutations.ts:467`, `packages/validator-core/src/validators/rig-control-semantic.ts:107`, `apps/editor/src/workspace/panels/deformer-tree-view.tsx:76` |
| DMI-008 | Deformer binding変更はParts Tree所属・draw orderを変えない。 | RigControl bindingは `model/rigControls` のchild lists / parent refsに保存され、Drawableの `partId` や draw orderとは別。`bindRigControlChild` modelDiffもRigControl child list中心。Parts Tree DnDは別に `moveStructureChild` / draw order syncを使う。 | binding move操作自体は不足。ただし既存分離は「Parts所属・draw orderを変えない」実装に向いている。 | 新規binding operationsは、既存Parts Tree operationsを呼ばず、RigControl graphのみ変更する設計が自然。 | `packages/package-format/src/model-files.ts:34`, `packages/package-format/src/model-files.ts:219`, `packages/package-format/src/model-files.ts:284`, `packages/operation-core/src/operations/bind-rig-control-child.ts:145`, `packages/operation-core/src/operations/bind-rig-control-child.ts:150`, `apps/editor/src/features/editor-session/model/editor-session-commands.ts:248` |
| DMI-009 | cycle prevention / duplicate binding / invalid target validationを持つ。 | Cycle: operation/mutationとvalidatorの両方にある。Missing parent/childとparent-child mismatchもvalidatorにある。Invalid target kindはoperationでrejectされる。Duplicate binding: operation/mutationはduplicate child IDや既存parentを拒否するが、validator側にduplicate `childDrawableIds` / drawableが複数RigControlにbindされる状態を検出する専用checkは見当たらない。 | package import/validation時のduplicate binding diagnosticが不足。operationから作る通常経路では多くを防げるが、直接packageを読んだ時の不整合検出が弱い。 | validator-coreにduplicate child / duplicate drawable binding checksを追加する余地。operation testsもrebind/insertion導入時に追加必要。 | `packages/authoring-core/src/rig-control-mutations.ts:316`, `packages/authoring-core/src/rig-control-mutations.ts:334`, `packages/authoring-core/src/rig-control-mutations.ts:384`, `packages/validator-core/src/validators/rig-control-semantic.ts:70`, `packages/validator-core/src/validators/rig-control-semantic.ts:107`, `packages/validator-core/src/validators/rig-control-semantic.ts:219`, `packages/operation-core/src/operations/bind-rig-control-child.ts:241`, `packages/contracts/src/target-ref.ts:3` |
| DMI-010 | Canvas overlayはdraft/committed Deformerを区別し、bounds/grid/Bezier guideを出す。Inspector編集時にも更新される。 | Wave62 v0でdraft/committed overlay projectionとrendererは存在する。draft state更新はCanvas projectionへ流れる。Bezierはguide表示で、manual edit/evaluationは未実装。 | overlay基礎はある。後編集やDnDでcommitted stateが変わる操作は未実装なので、編集結果反映テストも未整備。 | Editor/canvas tests追加。Bezier manual editやruntime evaluationをWave63に含めるならpackage/runtime impactが増える。 | `apps/editor/src/workspace/canvas/canvas-projection.ts:222`, `apps/editor/src/workspace/canvas/canvas-projection.ts:251`, `apps/editor/src/workspace/canvas/canvas-renderer.ts:129`, `apps/editor/src/workspace/canvas/canvas-renderer.ts:155`, `apps/editor/src/workspace/canvas/canvas-renderer.ts:161`, `apps/editor/src/workspace/panels/canvas-preview-panel.tsx:502` |

## Tests Found / Missing Tests

### Tests found

- Editor E2E has the Warp Deformer v0 user path: import PSD, select Drawable, `Create Warp Deformer`, draft Inspector/default division checks, draft overlay attributes, Apply, committed overlay, Deformer Tree row and bound Drawable reference.
  - `apps/editor/e2e/psd-import.e2e.spec.ts:253`
  - `apps/editor/e2e/psd-import.e2e.spec.ts:269`
  - `apps/editor/e2e/psd-import.e2e.spec.ts:273`
  - `apps/editor/e2e/psd-import.e2e.spec.ts:283`
  - `apps/editor/e2e/psd-import.e2e.spec.ts:293`
  - `apps/editor/e2e/psd-import.e2e.spec.ts:299`
- Editor unit tests cover Warp Deformer draft creation, payload creation, committed Deformer Tree projection, package operation wrapper, and Canvas draft/committed overlay projection.
  - `apps/editor/src/features/editor-session/model/rig-tool-state.test.ts:29`
  - `apps/editor/src/features/editor-session/model/editor-session-commands.test.ts:64`
  - `apps/editor/src/workspace/canvas/canvas-projection.test.ts:258`
- Operation/authoring tests cover `createRotation2dRigControl`, `createWarpDeformer`, `bindRigControlChild`, unparented child rig-control binding, and cycle rejection.
  - `packages/operation-core/src/operations/rig-control.test.ts:21`
  - `packages/operation-core/src/operations/rig-control.test.ts:148`
  - `packages/operation-core/src/operations/rig-control.test.ts:253`
  - `packages/operation-core/src/operations/rig-control.test.ts:283`
  - `packages/authoring-core/src/rig-control-mutations.test.ts:57`
  - `packages/authoring-core/src/rig-control-mutations.test.ts:118`
  - `packages/authoring-core/src/rig-control-mutations.test.ts:150`
- Package/validator tests cover Warp Deformer metadata, transform mismatch, Bezier surface cardinality, rig-control hierarchy cycle/missing/mismatch, and warp lattice diagnostics.
  - `packages/package-format/src/warp-lattice2d-contract.test.ts:52`
  - `packages/package-format/src/warp-lattice2d-contract.test.ts:111`
  - `packages/validator-core/src/rig-control-semantic.test.ts:40`
  - `packages/validator-core/src/rig-control-semantic.test.ts:84`
  - `packages/validator-core/src/rig-control-semantic.test.ts:141`
  - `packages/validator-core/src/rig-control-semantic.test.ts:206`
  - `packages/validator-core/src/warp-lattice-diagnostics.test.ts:52`
  - `packages/validator-core/src/warp-lattice-diagnostics.test.ts:193`

### Missing tests / not found in focused search

- Drawable選択時にRotation DeformerとWarp Deformerの両方が出るEditor test / E2E。
- 既存Deformer配下のDrawableにCreateした時の insertion behavior test。
- `Drawable Pool` / `Unbound Drawables` の表示、collapsed default、unbound computation tests。
- Pool -> Deformer DnD test。
- Bound Drawable reference -> another Deformer rebind test。
- Deformer parent変更DnD / reparent operation test。
- Committed Deformer Inspector editing tests for name / parent / bound children / domain bounds / Transform divisions / Bezier divisions / opacity multiplier。
- Static deformer opacity multiplier package/runtime/validator/editor tests。
- Package-level duplicate binding validator test for duplicate child references or one Drawable bound under multiple RigControls.

## Risks

- Existing mutation rules intentionally reject already-bound Drawables and already-parented RigControls. The design-required insertion/rebind flows will fail unless operation semantics are expanded first.
- Static deformer opacity multiplier is not just an Inspector gap; it appears to be a package/runtime/validator/editor contract gap.
- Transform division changes after keyforms can break `controlPointOffsets` cardinality. Current validator already flags malformed cardinality; Wave63 should decide disabled/confirm behavior before implementing committed division edits.
- Editor mirrors Warp Deformer read projection locally. Expanding the read model increases duplication unless dependency boundary is revisited.
- Deformer Tree DnD without package-level duplicate binding validation could make direct package corruption harder to diagnose outside the normal operation path.

## Undine Decision Needed

- Whether Wave63 must include Rotation Deformer Editor parity, or focus only on Warp Deformer management/editing.
- Operation granularity for insertion/rebind/reparent:
  - one high-level `insertWarpDeformerForDrawable`,
  - separate `setDrawableDeformerBinding` / `setDeformerParent`,
  - or lower-level unbind + bind operations.
- Whether static deformer opacity multiplier is in Wave63 scope. If yes, package/runtime/validator impact should be planned explicitly.
- Whether initial `Drawable Pool` should be read-only/collapsed display first, or include Pool -> Deformer DnD in the same slice.
- Whether committed Transform/Bezier division edits should be disabled when keyforms exist, require confirmation, or migrate keyforms.

## Recommended Wave63 Slices

Recommendations only; not product decisions.

1. Package/operation binding management foundation.
   - Add focused mutation/operation coverage for moving Drawable binding, moving Deformer parent, and insertion-safe create.
   - Include dry-run/commit modelDiff and validator duplicate binding checks.

2. Deformer Tree `Drawable Pool` read model and collapsed UI.
   - Compute unbound Drawables without changing Parts membership or draw order.
   - Add collapsed default state and focused UI tests.

3. Deformer Tree DnD v0.
   - Pool Drawable -> Deformer bind.
   - Bound Drawable reference -> another Deformer rebind.
   - Deformer row -> Deformer parent move.
   - Add invalid drop feedback for cycles, duplicate binding, missing target.

4. Committed Deformer Inspector editing v0.
   - Start with name, parent, domain bounds, Transform/Bezier divisions if operations exist.
   - Keep bound children edits in Deformer Tree DnD unless Undine chooses direct Inspector controls.

5. Static opacity multiplier contract slice.
   - Only if in scope: add package field, operation update, runtime/canvas application, validator bounds, and Inspector UI.

6. Rotation Deformer creation parity.
   - Add Drawable-selected `Create Rotation Deformer` path and tests.
   - Reuse existing package/operation foundation where possible; insertion semantics should match Warp Deformer once binding management exists.
