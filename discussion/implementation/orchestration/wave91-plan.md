# Wave 91 Plan: Deformer Lifecycle Cleanup

> Wave91は、作成済みDeformerを安全に削除できるようにし、同名/同数選択Deformer作成時の内部ID衝突を防ぎ、Mesh Apply後に未編集Warp Deformerを自動拡張する。目的は「先にDeformerを作ってしまった」「作り直したい」「Undoで戻すしかない」というRig authoringの詰まりを取り除くことである。

## 1. Status

- Status: Planned / ready for orchestration
- Target wave: Wave91
- Wave name: `deformer-lifecycle-cleanup`
- Primary objective:
  - Deformer削除UXを実装する。
  - 削除時に子Drawable / 子Deformerを失わず、親子関係を安全に昇格する。
  - 削除対象Deformer自身のkeyform/bindingだけを削除し、子Deformerのkeyformは保持する。
  - Deformer作成時の内部rig control ID衝突をsuffixで回避する。
  - Mesh Apply後、未keyform Warp Deformerのdomain boundsを必要範囲まで自動拡張する。
  - 編集済み/keyform済みWarp Deformerの自動refitは対象外にする。

## 2. Planning Gate Result

Planning Gate result: `Inventory first`, then plan.

Why planning is now safe:

- Read-only Sylph AがDeformer削除に必要なrig hierarchy、root/parent invariant、keyform cleanup、operation/editor接続点を調査済み。
- Read-only Sylph BがMesh Apply後auto-refitのhook、既存fit-to-meshロジック、未編集判定、nested/shared parent扱いを調査済み。
- Read-only Sylph Cがrig control ID生成の衝突原因、対象operation paths、helper配置、Editor result propagation riskを調査済み。
- ユーザーは次の方針を採用済み:
  - Deformer削除はcascade deleteではなく昇格。
  - 削除後選択はクリア。
  - suffix policyは最初に空いている番号。
  - auto-refitはWarp Deformerのみ、未keyformのみ、拡張のみ。

Uncertainty:

- factual: low. 主要state fields、mutation/operation/editor hookは調査済み。
- decision: low. 残未決はUndine推奨で固定済み。
- cost of wrong plan: medium. Rig hierarchyとkeyform参照を壊すと後続編集に影響するため、core operationとEditor integrationを分けてreviewする。

## 3. Accepted Decisions / Oracles

### 3.1 Deformer Delete Semantics

Deformer削除は、削除対象だけを取り除き、子を保存する。

Required:

- 削除対象のrig controlを `graph.rigControls` から削除する。
- 削除対象IDをstable order / root / parent child refsから削除する。
- 削除対象をtargetにするkeyform setsを削除する。
- 子Deformerは削除しない。
- 子Drawable、Drawable mesh、part、draw order、texture、Dynamicsは削除しない。
- 子Deformerのkeyform setsは保持する。
- 削除操作はUndo/Redo可能にする。

Parented Deformer削除:

- 親Deformerの `childRigControlIds` 内で、削除対象IDを削除対象の `childRigControlIds` に置き換える。
- 削除対象の `childDrawableIds` は親Deformerの `childDrawableIds` へ昇格する。
- 昇格した子Deformerの `parentId` は親Deformer IDにする。

Root Deformer削除:

- 削除対象IDを `rigControlRootIds` から除く。
- 削除対象の子Deformerをrootへ昇格する。
- 昇格した子Deformerの `parentId` は `null` / root扱いにする。
- 削除対象の子Drawableは未所属に戻す。既存Drawable Pool計算によりPoolへ出る。

Forbidden:

- 削除対象の子Deformerをcascade deleteする。
- 削除対象の子Drawableやmeshを削除する。
- 削除対象の親子関係をbest-effortで黙って修復し、既存invariant違反を隠す。
- 子Deformerのkeyformを削除する。

### 3.2 Deformer Delete UI

最初の導線はInspector内の明示ボタンにする。

Required:

- 選択中のWarp Deformer Inspectorに `Delete Deformer` を追加する。
- 選択中のRotation Deformer Inspectorに `Delete Deformer` を追加する。
- 削除成功後はEditor selectionをクリアする。
- Undoで削除前に戻れる。

Accepted non-goal:

- Deformer Tree row action / context menu / Deleteキー対応はWave91対象外。
- 削除確認ダイアログはWave91対象外。Undo可能であることを優先する。

### 3.3 Rig Control ID Suffix

内部rig control IDは表示名から作るが、既存IDと衝突してはならない。

Required:

- Base IDが空いていれば従来通り使う。
- Base IDが既存なら `_2`, `_3`, ... の最初に空いているIDを採用する。
- 表示名は変更しない。
- 対象:
  - `createRotation2dRigControl`
  - `createWarpLattice2dRigControl`
  - `createWarpDeformer`
- Editor command result / selectionは、予測IDではなく実際にcommitされたsuffixed IDを使う。

Forbidden:

- 表示名へsuffixを付ける。
- authoring-coreのduplicate ID guardを削除する。
- operation ID重複問題までWave91へ広げる。

### 3.4 Mesh Apply Auto-Refit

Mesh Apply後、未編集Warp Deformerだけを安全に救済する。

Required:

- HookはMesh Apply成功後、draft batch全体のcommitが終わった後に置く。
- 対象Drawableから祖先Warp Deformerを収集する。
- 対象は `kind === "warpLattice2d"` のみ。
- 内側から外側へ処理する。
- `hasRigControlKeyforms(session, rigControlId)` 相当がtrueならskipする。
- 必要boundsは現在の子全体から計算する。
- 新boundsは `current domainBounds` と `required child bounds` のunionにする。
- 拡張のみ行い、縮小しない。
- 共有parent Warpは全childrenを含むrequired boundsで計算する。

Forbidden:

- Rotation Deformerをauto-refit対象にする。
- keyform済みWarp Deformerを自動変更する。
- 既存domainを縮める。
- skipped keyed Warpを補償するために別のancestorを過剰に変更する。

Accepted limitation:

- Manual setup editと未編集状態を区別する専用flagはない。Wave91では「keyform targetがない」を未編集判定とする。
- Keyed skip時のUI warningはWave91対象外。Validate/Diagnostics拡張が必要なら後続waveで扱う。

## 4. Primary Basis

Implementation baseline:

- [wave90-plan.md](wave90-plan.md)
- [../waves/wave90/wave90-final-integration-report.md](../waves/wave90/wave90-final-integration-report.md)
- [../reviews/wave90/wave90-final-integration-review.md](../reviews/wave90/wave90-final-integration-review.md)
- [wave77-plan.md](wave77-plan.md)
- [wave78-plan.md](wave78-plan.md)
- [wave85-plan.md](wave85-plan.md)

Required conventions:

- [../../development_convention/source-file-organization-policy.md](../../development_convention/source-file-organization-policy.md)
- [../../development_convention/dependency-policy.md](../../development_convention/dependency-policy.md)
- [../../development_convention/operation-policy.md](../../development_convention/operation-policy.md)

Known source facts:

- `packages/package-format/src/model-files.ts`: rig control hierarchy fields and keyform target shape.
- `packages/package-format/src/model-graph.ts`: `rigControlRootIds`.
- `packages/authoring-core/src/rig-control-mutations.ts`: create/bind/reparent/insert/wrap/update mutations and parent/root invariants; no delete mutation yet.
- `packages/authoring-core/src/keyform-mutations.ts`: keyform target validation.
- `packages/operation-core/src/operation-ids.ts`: display-name-derived rig control IDs.
- `packages/operation-core/src/operations/create-rotation2d-rig-control.ts`: rotation create path.
- `packages/operation-core/src/operations/create-warp-lattice2d-rig-control.ts`: warp lattice create path.
- `packages/operation-core/src/operations/create-warp-deformer.ts`: warp deformer create/wrap path.
- `apps/editor/src/features/editor-session/model/deformer-tree-wrap-selection.ts`: generic `N Selected Warp Deformer` display name path.
- `apps/editor/src/features/editor-session/model/editor-session-commands.ts`: operation commit and rig create command result propagation.
- `apps/editor/src/features/editor-session/editor-session-context.tsx`: Mesh Apply and rig callback wiring.
- `apps/editor/src/features/editor-session/model/rig-tool-state.ts`: existing fit-to-mesh bounds logic, Drawable Pool computation, keyform detection helper.
- `apps/editor/src/workspace/panels/rig-tool-inspector.tsx`: selected Deformer Inspector UI.
- `apps/editor/src/workspace/canvas/canvas-evaluation.ts`: vertices outside Warp domain pass through unchanged.

## 5. Wave Strategy

Wave91 should run in ordered batches.

```text
Batch 1:
  Domain A: Core Rig Lifecycle Operations

Batch 2:
  Domain B: Editor Deformer Lifecycle Integration

Batch 3:
  Domain C: Final Integration / Clean Review / Map Closeout
```

Dependency rationale:

- Domain A establishes source-of-truth mutations/operations for deletion and ID suffixing.
- Domain B depends on Domain A for delete operation and actual committed rig IDs, and owns Editor UI plus Mesh Apply auto-refit hook.
- Mesh Apply auto-refit is kept with Editor integration because it lives in editor session/apply paths and would otherwise collide with the same context files.
- ID suffix and delete are not split into separate domains because both touch rig operation-core paths and review cost would exceed parallelism benefit.
- Domain C integrates after Domain A+B pass or explicit escalation.

## 5.1 Domain Design

| Batch | Domain | Dependency | Parallelism | Purpose |
|---|---|---|---|---|
| 1 | A. Core Rig Lifecycle Operations | Wave90 final pass and Wave91 accepted decisions | First / blocking | Add collision-aware rig ID generation, delete rig-control authoring mutation, delete operation payload/registry, and core tests |
| 2 | B. Editor Deformer Lifecycle Integration | Domain A pass | After A; not parallel with A | Add Delete Deformer Inspector UX, editor command/context wiring, selection cleanup, Mesh Apply auto-refit for unkeyed Warp ancestors, and focused editor tests |
| 3 | C. Final Integration / Clean Review / Map Closeout | Domain A+B pass or explicit escalation | Final only | Validate combined deformer lifecycle behavior, record reports/reviews/maps, and run final checks |

## 6. Domain A: Core Rig Lifecycle Operations

Domain id: `wave91-core-rig-lifecycle-operations`

Purpose:

- Add collision-aware rig control ID generation in operation-core.
- Add authoritative delete rig-control mutation in authoring-core.
- Expose delete as operation-core operation.
- Preserve graph invariants and keyform cleanup semantics.

Allowed write scope:

- `packages/authoring-core/src/**`
- `packages/authoring-core/src/**/*.test.ts`
- `packages/operation-core/src/**`
- `packages/operation-core/src/**/*.test.ts`
- `packages/contracts/src/**` only if an existing type export requires a narrow update; avoid if possible.
- Domain A report/review files under `discussion/implementation/waves/wave91/` and `discussion/implementation/reviews/wave91/`

Forbidden write scope:

- `apps/editor/src/**`
- `packages/runtime-core/src/**`
- `packages/render-core/src/**`
- `packages/render-webgl2/src/**`
- package dependencies / lockfile
- mesh algorithm files
- Texture Atlas / Dynamics unrelated code

Required implementation:

- Add collision-aware helper in `packages/operation-core/src/operation-ids.ts`.
- Update rig create operations:
  - rotation2d
  - warpLattice2d
  - warp deformer / wrap-selected path
- Preserve display names while returning actual suffixed IDs.
- Add authoring-core mutation, e.g. `deleteRigControl(session, { rigControlId })`.
- Delete target rig control and remove its stable-order/root/parent refs.
- Promote child Deformers and child Drawables according to accepted semantics.
- Remove keyform sets whose target is the deleted rig control.
- Preserve child Deformer keyforms.
- Reject missing target and incoherent parent/root state.
- Add operation-core payload/type/registry entry for delete rig control.
- Add dry-run and commit support with reversible diff evidence consistent with existing operations.

Out of scope:

- Editor UI button.
- Mesh Apply auto-refit.
- Delete confirmation UX.
- Deformer Tree context menu.
- Delete key shortcut.
- Operation ID uniqueness changes.

Required tests:

- Creating duplicate display-name rotation rig controls yields base then `_2` / `_3` IDs.
- Creating duplicate display-name warp lattice rig controls yields suffixed IDs.
- Creating duplicate display-name warp deformers / wrap-selected generic names yields suffixed IDs.
- Dry-run chooses the same suffixed ID as commit without mutating the original session.
- Delete parented Deformer promotes child Deformers/Drawables to parent.
- Delete root Deformer promotes child Deformers to root and returns child Drawables to pool/unbound state.
- Delete removes target keyform sets.
- Delete preserves child Deformer keyform sets.
- Delete leaves drawables, meshes, parts, textures, and draw order unchanged.
- Delete rejects missing target.
- Delete rejects or fails clearly on incoherent existing graph state.

Escalate if:

- Existing graph invariant helpers make promotion ambiguous.
- Keyform target cleanup cannot be scoped to only the deleted rig control.
- Operation-core cannot expose the actual committed suffixed ID without changing public operation result contracts broadly.

## 7. Domain B: Editor Deformer Lifecycle Integration

Domain id: `wave91-editor-deformer-lifecycle-integration`

Dependencies:

- Domain A `pass`.

Purpose:

- Connect Domain A deletion and suffixed creation IDs to the Editor.
- Add user-visible Deformer delete action.
- Auto-refit unkeyed Warp Deformers after Mesh Apply expands Drawable mesh bounds.

Allowed write scope:

- `apps/editor/src/features/editor-session/**`
- `apps/editor/src/workspace/panels/**`
- `apps/editor/src/workspace/**rig**`
- `apps/editor/src/workspace/**deformer**`
- `apps/editor/src/workspace/**mesh**`
- focused app tests
- Domain B report/review files under `discussion/implementation/waves/wave91/` and `discussion/implementation/reviews/wave91/`

Forbidden write scope:

- `packages/authoring-core/src/**`, except importing Domain A exposed APIs if needed.
- `packages/operation-core/src/**`, except importing Domain A exposed operation types if needed.
- mesh generation algorithm files.
- runtime-core evaluator behavior.
- Texture Atlas / Dynamics / Workspace Save unrelated code.
- package dependencies / lockfile.

Required implementation:

- Add `commitDeleteRigControl` or equivalent editor command wrapping Domain A operation.
- Wire delete action through `EditorSessionProvider`.
- Add `Delete Deformer` to committed Warp Deformer Inspector.
- Add `Delete Deformer` to committed Rotation Deformer Inspector.
- On successful delete, clear selected rig/deformer selection and transient drafts/feedback that point to the deleted rig control.
- Ensure Undo/Redo restores delete state through existing history.
- Update rig creation command result propagation so UI selects/uses actual suffixed rig ID returned by operation-core.
- Add Mesh Apply post-commit refit:
  - collect committed Drawable IDs from successful mesh draft apply.
  - dedupe affected Warp ancestors.
  - process inner-to-outer.
  - skip keyed/keyformed Warps using existing keyform detection.
  - compute required bounds from all current children.
  - union with current domain bounds.
  - call existing rig update command only when expanded bounds differ.
  - preserve mesh draft clearing and existing Mesh Apply UX.

Out of scope:

- Delete confirmation dialog.
- Deformer Tree row action / context menu / keyboard shortcut.
- Manual `Fit to children` button.
- Validate warning for keyed Warp skip.
- Auto-refit for Rotation Deformer.
- Auto-refit for keyed Warp Deformer.
- Domain shrink / normalization.

Required tests:

- Warp Inspector renders `Delete Deformer` and invokes delete callback.
- Rotation Inspector renders `Delete Deformer` and invokes delete callback.
- Editor delete clears selected deformer and is undoable/redoable.
- Duplicate display-name create returns actual suffixed ID and selection lands on the created rig control.
- Mesh Apply after pre-created unkeyed Warp expands domain to include generated mesh vertices.
- Mesh Apply does not shrink an already larger Warp domain.
- Mesh Apply skips keyed Warp Deformer.
- Mesh Apply processes nested unkeyed Warp ancestors inner-to-outer.
- Mesh Apply shared parent Warp expands to include all children, not only the committed Drawable.
- Existing mesh draft apply behavior and draft cleanup remain intact.

Escalate if:

- Editor cannot distinguish keyed vs unkeyed Warp without broad new state.
- Mesh Apply auto-refit requires changing runtime evaluator behavior.
- Delete selection cleanup conflicts with existing multi-select state in a way that needs UX decision.

## 8. Domain C: Final Integration / Clean Review

Domain id: `wave91-final-integration-clean-review`

Dependencies:

- Domain A `pass`
- Domain B `pass`

Purpose:

- Verify combined Deformer lifecycle cleanup behavior.
- Confirm no regression in rig hierarchy, keyforms, Mesh Apply, Undo/Redo, Workspace Save, or Viewer behavior.
- Record final wave reports/reviews/maps.

Allowed write scope:

- `discussion/implementation/waves/wave91/**`
- `discussion/implementation/reviews/wave91/**`
- orchestration/review/wave maps if status updates are required

Required checks:

- Domain reports and all review lanes present.
- Focused package tests for authoring-core and operation-core.
- Focused editor tests for delete UI/history, suffixed selection, and Mesh Apply auto-refit.
- `pnpm typecheck`.
- source organization check.
- dependency check.
- `git diff --check`.
- Optional browser smoke only if already cheap and stable; not required for pass.

## 9. Review Policy

Each implemented domain requires independent review lanes:

1. Spec Compliance Review
2. Design / Development Compliance Review
3. Test Adequacy Review

Spec Compliance Review must explicitly check:

- Delete does not remove Drawables, Meshes, child Deformers, or child Deformer keyforms.
- Delete removes only the target rig control and its target keyform sets.
- Root and parented delete promotion semantics match the plan.
- Delete is undoable.
- ID suffix applies to all three create paths and preserves display names.
- Mesh Apply auto-refit applies only to unkeyed Warp Deformers.
- Auto-refit expands only and skips keyed Warps.

Design / Development Review must explicitly check:

- Rig graph invariants remain coherent.
- Keyform references cannot point at deleted rig controls.
- authoring-core keeps invariant enforcement; operation-core owns operation result/dry-run behavior; editor owns UI/history/hook.
- No runtime evaluator behavior is changed for auto-refit.
- No unrelated mesh algorithm, Texture Atlas, Dynamics, Workspace Save, or dependency changes.
- No catch-all source file growth or source organization policy violation.

Test Adequacy Review must explicitly check:

- Delete parented/root cases.
- Keyform cleanup/preservation split.
- Duplicate ID suffix in rotation / warp lattice / warp deformer.
- Editor actual suffixed ID propagation.
- Mesh Apply auto-refit expand/no-shrink/keyed-skip/nested/shared cases.
- Undo/Redo coverage for delete.

## 10. Expected Persistent Artifacts

Wave reports:

- `discussion/implementation/waves/wave91/wave91-domain-a-core-rig-lifecycle-operations-report.md`
- `discussion/implementation/waves/wave91/wave91-domain-b-editor-deformer-lifecycle-integration-report.md`
- `discussion/implementation/waves/wave91/wave91-final-integration-report.md`
- `discussion/implementation/waves/wave91/_map.md`

Review reports:

- `discussion/implementation/reviews/wave91/wave91-domain-a-spec-compliance-review.md`
- `discussion/implementation/reviews/wave91/wave91-domain-a-design-development-review.md`
- `discussion/implementation/reviews/wave91/wave91-domain-a-test-adequacy-review.md`
- `discussion/implementation/reviews/wave91/wave91-domain-b-spec-compliance-review.md`
- `discussion/implementation/reviews/wave91/wave91-domain-b-design-development-review.md`
- `discussion/implementation/reviews/wave91/wave91-domain-b-test-adequacy-review.md`
- `discussion/implementation/reviews/wave91/wave91-final-clean-integration-review.md`
- `discussion/implementation/reviews/wave91/_map.md`

## 11. Subagent Contract

Orch-Sylph instructions must include:

- Use this active wave plan as source of truth.
- Start with bounded current-state confirmation for assigned domain.
- Delegate implementation to Gnome.
- Delegate independent reviews to Review-Sylphs.
- Wait for all started children.
- Treat `wait_agent` timeout as polling timeout.
- Do not close or interrupt running children.
- Close completed child sessions before final domain report.
- Report `pass`, `needs_fix`, `blocked`, or `escalate`.

Gnome instructions must include:

- You are not alone in the codebase.
- Do not revert unrelated changes.
- Work only in allowed scope.
- Do not run `pnpm install`.
- Do not add dependencies.
- Preserve Workspace Save / Portable JSON behavior from Wave90.
- Preserve Viewer / Dynamics / Texture Atlas behavior unless directly impacted by focused tests.
- Include Basis Coverage Self-Report and Deferred Basis Items.

Review-Sylph instructions must include:

- Review source and tests, not only Gnome summary.
- Report `pass`, `needs_changes`, or `escalate`.
- Remain read-only unless explicitly delegated a narrow fix.
- Treat forbidden scope as blocking unless explicitly escalated.

## 12. Orchestration Policy

Root / Undine:

- Owns wave plan, user questions, dependency graph, and final report.
- Must not implement Wave91 source changes.
- Must wait for every started subagent.
- Must treat wait timeouts as polling.
- Must not close running children.

Orch-Sylph:

- Owns one domain loop.
- Must start with bounded current-state confirmation.
- Must delegate implementation and review.
- Must wait for Gnome and all Review-Sylphs.
- Must close completed children.
- Must report domain verdict and evidence.

No parent may pass the wave gate while a child is incomplete, running, or unresolved.

## 13. Out of Scope

- Manual `Fit to children` command.
- Auto-refit for keyed/keyformed Warp Deformers.
- Auto-refit for Rotation Deformers.
- Delete confirmation dialog.
- Deformer Tree context menu / row action / keyboard delete.
- Validate warning for keyed auto-refit skip.
- Mesh generation algorithm changes.
- Runtime evaluator behavior changes.
- Texture Atlas changes.
- Dynamics changes.
- Workspace Save format changes.
- Viewer feature expansion.
- New dependencies.
- Cubism SDK / `.moc3` / `.model3.json` / `.physics3.json` compatibility.
