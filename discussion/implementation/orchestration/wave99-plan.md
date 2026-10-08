# Wave 99 Plan: Editor Variant Manager v0

> Wave99は、既存Workspaceに後付けできるVariant / Expression Manager v0をEditor側に導入する。目的は、表情差分・衣装差分・アクセサリ差分をVariant Group単位で定義し、既存モデルを壊さず、Canvas上でpreviewでき、Workspace Save / Portable JSON / Runtime Exportへ失わずに保存できるようにすることである。

## 1. Status

- Status: Planned / ready for orchestration
- Target wave: Wave99
- Wave name: `editor-variant-manager-v0`
- Primary objective:
  - Variant Group / Variant / membership / default active selection をProject stateに追加する。
  - 既存Workspace / Portable JSON / Runtime ExportがVariantなしでも従来通り読める互換性を維持する。
  - `model/variants.json` 相当のoptional model fileをpackage-formatに追加する。
  - Variant Manager専用画面をEditorに追加する。
  - Add Drawables pickerをParts Tree風に実装し、runtime graph bound DrawableだけをVariant対象にする。
  - Preview active selectionをEditor session-localに保持し、Canvas previewへ `variantVisibilityPredicate` としてAND合成する。
  - Runtime ExportにVariant metadataとdefault active selectionを落とさない。
  - Runtime Player側の差分切り替えUI / hotkey / Control Window変更は対象外にする。

## 2. Planning Gate Result

Planning Gate result: `Inventory first`, then plan.

Why planning is now safe:

- Read-only Sylph AがEditor state / package persistence / Workspace Save / Portable JSON / operation/history境界を調査済み。
- Read-only Sylph BがCanvas / Viewer visibility、Texture Atlas target selection、Runtime Export materialization、Runtime Player互換境界を調査済み。
- Read-only Sylph Cが現行Variants route、既存Manager screen pattern、Parts Tree picker再利用可能性、UI test候補を調査済み。
- Variant UXは [../../design/screen-design/screens/variant-expression-manager.md](../../design/screen-design/screens/variant-expression-manager.md) に記録済み。
- ユーザーは次の方針を採用済み:
  - 次の開発スコープはEditor側。
  - Runtime Player側のVariant操作UI / hotkeyは後続scope。
  - Variantは既存モデルに後付けできるbackward-compatible extensionにする。
  - `Default active selection` はProject stateに保存する。
  - `Preview active selection` はsession-localで保存しない。
  - Authoring Workspaceに常設Variant switcherを置かない。
  - Variant Manager中はParameter Barを隠す。
  - Variant membership変更だけではTexture Atlas staleにしない。
  - Add Drawables pickerは既存 `StructureTreePanel` 直利用ではなく専用projectionを作る。

Uncertainty:

- factual: medium. 主要挿入点は調査済みだが、operation payload / package file-set / Editor session commandの具体差分は実装時に確認が必要。
- decision: low. UX方針とスコープ境界は合意済み。
- cost of wrong plan: high. Variantはpackage format、save/load、Canvas visibility、Runtime Exportに横断するため、互換性破壊をreview gateで強く見る。

## 3. Accepted Decisions / Oracles

### 3.1 Variant Semantics

Variantは既存visibilityを上書きしない。既存visibilityに追加でかかるpredicateとして扱う。

Conceptual rule:

```text
finalVisible =
  existingVisibilityPredicates
  AND variantVisibilityPredicate
```

Required:

- VariantなしWorkspaceでは、すべてのDrawableがVariant条件では通過する。
- Variant Groupに所属していないDrawableはvariant-neutralである。
- Variant Groupに所属するDrawableだけが、active selectionによる追加制御を受ける。
- Variant falseは、keyform / runtime visibility がtrueでも最終表示をfalseにできる。
- Variant trueは、keyform / parts hidden / runtime visibility / opacity / clippingなどの既存条件を上書きしない。

Forbidden:

- Variantを `runtimeVisibility` へ直接書き込む。
- VariantをParts Tree visibilityやDrawable Inspector visibilityの別名にする。
- Keyform visibility / opacity semanticsを置き換える。
- Variantなし既存モデルの表示結果を変える。

### 3.2 Variant Model

Required model concepts:

- Variant Group:
  - id
  - name
  - mode: `singleSelect` | `multiToggle`
  - variants
  - target drawable ids / membership
  - default active selection
- Variant:
  - id
  - name
- Membership:
  - target drawable id -> variant id set / boolean membership

Rules:

- Drawableは高々1つのVariant Groupにだけ所属できる。
- 同一Group内では、1つのDrawableが複数Variantに所属してよい。
- `singleSelect` Groupは最後のVariant削除をblockする。
- Group削除はDrawable自体を削除せず、そのDrawableをvariant-neutralへ戻す。
- Variant削除は列とmembershipだけを削除する。

### 3.3 Persistence / Backward Compatibility

Required:

- `AuthoringSession.graph` / `AuthoringGraph` にVariant collectionを追加する。
- 既存PackageDocumentにVariant情報がない場合は空Variant collectionとして読む。
- Package formatにはoptional `model/variants.json` 相当を追加する。
- `editorState` へVariantを入れない。VariantはUI状態ではなくRuntime semanticsである。
- Workspace Save / OpenでVariantが保存復元される。
- Portable JSON export/importでVariantが保存復元される。
- Existing workspace / portable JSON without variants must continue to parse and behave unchanged.

Forbidden:

- variants fileをrequiredにする。
- migration layerなしで既存strict parseを壊す。
- Preview active selectionをProject stateへ保存する。

### 3.4 Default Active vs Preview Active

Required:

- Default active selection:
  - Project stateに保存する。
  - Runtime Exportへ含める。
  - Runtime PlayerがVariant UIを持たない場合の初期表示になる。
- Preview active selection:
  - Editor session-localに保持する。
  - Canvas previewに反映する。
  - Workspace Save / Portable JSON / Runtime Exportへ保存しない。

Forbidden:

- Preview active selectionをdirty/save対象にする。
- Authoring Workspaceに常設Variant切り替えUIを置く。

### 3.5 Add Drawables Picker

Required:

- `+ Add Drawables` はParts Tree風pickerにする。
- Parts Containerは表示するが選択対象ではない。
- Containerはデフォルト折りたたみ。
- Container行に `eligible N / total M` のような件数を出す。
- Drawable行だけを選択可能にする。
- Runtime graphにboundされていないDrawableは選択不可にする。
- 既に別Variant Groupに所属しているDrawableは選択不可にする。
- 既に同じGroupに追加済みのDrawableはchecked disabledまたは表示除外にする。

Accepted:

- `StructureTreePanel` は直利用せず、Parts Tree row projection / visual pattern / collapse helperを参考に新規picker projectionを作る。
- bound判定はrigControl `childDrawableIds` ベースとする。

Forbidden:

- Drawable Pool上の未所属DrawableをVariant対象にする。
- Parts Container自体をVariant targetにする。
- 自動分類 / smart grouping / capture-from-current-stateを追加する。

### 3.6 Atlas / Runtime Export

Texture Atlas:

- Variant membership変更だけではTexture Atlas staleにしない。
- Atlas対象は従来通りruntime graph bound / packable Drawable基準にする。
- inactive/default-hidden Variant Drawableでも、boundされていれば既にAtlas対象に含まれる。
- Variant membershipをAtlas対象判定の代替にしない。

Runtime Export:

- Variant Group / Variant / membership / default active selectionを落とさない。
- Runtime Player側のVariant switching UIが未実装でも、default active selectionで自然に再生できるようにする。
- Variant情報がない既存Runtime Exportは従来通り再生できる。

Accepted:

- Runtime Export `drawables[].visible` はdefault active selectionを反映したinitial effective visibilityにする方針を許容する。
- 将来のPlayer切り替え用に、metadataとしてVariant modelを保持する。

Forbidden:

- Runtime Player Control Window / hotkey / Browser Source protocolをWave99で実装する。
- Runtime ExportをWorkspace SaveやPortable JSONへ寄せる。

## 4. Primary Basis

Design basis:

- [../../design/screen-design/screens/variant-expression-manager.md](../../design/screen-design/screens/variant-expression-manager.md)
- [../../design/screen-design/_map.md](../../design/screen-design/_map.md)
- [../../design/screen-design/screens/workspace-save-and-navigation.md](../../design/screen-design/screens/workspace-save-and-navigation.md)
- [../../design/screen-design/screens/texture-atlas-task.md](../../design/screen-design/screens/texture-atlas-task.md)
- [../../design/screen-design/screens/runtime-export-task.md](../../design/screen-design/screens/runtime-export-task.md)
- [../../design/screen-design/screens/viewer-runtime-view.md](../../design/screen-design/screens/viewer-runtime-view.md)

Implementation baseline:

- [wave90-plan.md](wave90-plan.md)
- [wave92-plan.md](wave92-plan.md)
- [wave98-plan.md](wave98-plan.md)
- [../waves/wave90/wave90-final-integration-report.md](../waves/wave90/wave90-final-integration-report.md)
- [../waves/wave92/wave92-final-integration-report.md](../waves/wave92/wave92-final-integration-report.md)
- [../waves/wave98/wave98-final-integration-report.md](../waves/wave98/wave98-final-integration-report.md)

Required conventions:

- [../../development_convention/source-file-organization-policy.md](../../development_convention/source-file-organization-policy.md)
- [../../development_convention/dependency-policy.md](../../development_convention/dependency-policy.md)
- [../../development_convention/operation-policy.md](../../development_convention/operation-policy.md)

Known source facts:

- `packages/authoring-core/src/authoring-session.ts`: `AuthoringSession` contains canonical `graph`.
- `packages/authoring-core/src/authoring-graph.ts`: `AuthoringGraph` contains current model state; Variant is absent.
- `packages/package-format/src/package-document.ts`: PackageDocument model files; Variant is absent.
- `packages/package-format/src/model-files.ts`: model file schemas.
- `packages/package-format/src/package-file-set.ts`: model file set parse/serialize.
- `packages/package-format/src/workspace-file-set.ts`: workspace wrapper.
- `packages/package-format/src/portable-package-bundle*.ts`: Portable JSON contract and import/export.
- `packages/operation-core/src/operation-type.ts`: operation type registry.
- `packages/operation-core/src/operation-payload.ts`: operation payload schemas.
- `packages/operation-core/src/operation-registry.ts`: operation handlers.
- `apps/editor/src/workspace/authoring-workspace.tsx`: `variants` currently falls through to normal workspace.
- `apps/editor/src/workspace/workspace-data.ts`: `variants` Toolbox entry exists.
- `apps/editor/src/state/editor-ui-store.ts`: `WorkspaceEntryId` includes `variants`; no Variant-specific state.
- `apps/editor/src/features/editor-session/model/session-tree.ts`: Parts Tree row projection precedent.
- `apps/editor/src/features/editor-session/model/part-tree-collapse-state.ts`: initial collapsed Part Container precedent.
- `apps/editor/src/features/editor-session/model/rig-tool-state.ts`: Drawable Pool / bound set precedent.
- `packages/authoring-core/src/texture-atlas-targets.ts`: bound Drawable target selection.
- `apps/editor/src/workspace/canvas/canvas-evaluation.ts`: Canvas visible predicate insertion point.
- `packages/authoring-core/src/runtime-export-materialization.ts`: Runtime Export model materialization.

## 5. Wave Strategy

Wave99 should run in ordered batches.

```text
Batch 1:
  Domain A: Variant Model / Package Format / Operations

Batch 2:
  Domain B: Variant Evaluation / Runtime Export Compatibility

Batch 3:
  Domain C: Variant Manager Editor UI / Canvas Preview

Batch 4:
  Domain D: Final Integration / Clean Review / Map Closeout
```

Dependency rationale:

- Domain A establishes source-of-truth model, persistence, and mutation operations.
- Domain B depends on Domain A model helpers and owns non-UI semantic application to Canvas-compatible predicate helpers and Runtime Export metadata/default behavior.
- Domain C depends on A/B because UI commands and Canvas preview must use the real model/predicate semantics.
- Domain B and C are not parallelized because preview semantics and operation result shape should be settled before UI wiring.
- Domain D integrates after A/B/C pass or explicit escalation.

## 5.1 Domain Design

| Batch | Domain | Dependency | Parallelism | Purpose |
|---|---|---|---|---|
| 1 | A. Variant Model / Package Format / Operations | Wave92 final pass and accepted Variant design | First / blocking | Add optional package model file, AuthoringGraph variant state, operations, save/load/portable compatibility |
| 2 | B. Variant Evaluation / Runtime Export Compatibility | Domain A pass | After A; not parallel with C | Add pure predicate helpers, Runtime Export metadata/default effective visibility, and variant-free compatibility tests |
| 3 | C. Variant Manager Editor UI / Canvas Preview | Domain A+B pass | After B | Add dedicated Variants route, Manager UI, Add Drawables picker, preview active selection, Canvas predicate integration |
| 4 | D. Final Integration / Clean Review / Map Closeout | Domain A+B+C pass or explicit escalation | Final only | Validate end-to-end Editor Variant v0, persistence, preview, export compatibility, reports/reviews/maps |

## 6. Domain A: Variant Model / Package Format / Operations

Domain id: `wave99-variant-model-package-format-operations`

Purpose:

- Add Variant as project/runtime semantics in the canonical authoring graph.
- Persist Variant through workspace save/open and Portable JSON without breaking existing projects.
- Add operation-core mutation paths needed by Variant Manager.

Allowed write scope:

- `packages/package-format/src/**`
- `packages/package-format/src/**/*.test.ts`
- `packages/authoring-core/src/**`
- `packages/authoring-core/src/**/*.test.ts`
- `packages/operation-core/src/**`
- `packages/operation-core/src/**/*.test.ts`
- Domain A report/review files under `discussion/implementation/waves/wave99/` and `discussion/implementation/reviews/wave99/`

Forbidden write scope:

- `apps/editor/src/**`
- `apps/runtime-player/src/**`
- `packages/runtime-core/src/**`
- `packages/render-core/src/**`
- `packages/render-webgl2/src/**`
- Texture Atlas packing algorithm files.
- Runtime Export materialization behavior beyond type imports needed for tests.
- package dependencies / lockfile.

Required implementation:

- Add Variant DTO/schema in package-format:
  - Group id/name/mode.
  - Variants id/name.
  - target drawable membership.
  - default active selection.
- Add optional `model/variants.json` model file contract.
- Add optional manifest/file-set path handling for variants.
- Add AuthoringGraph `variantGroups` or equivalent.
- Default missing variants to empty collection when loading existing PackageDocument.
- Serialize variants into PackageDocument/file-set/workspace save.
- Portable JSON export/import carries variants by virtue of PackageDocument.
- Add authoring-core mutations:
  - create group.
  - rename/update group.
  - delete group.
  - create variant.
  - rename/update variant.
  - delete variant with last-variant guard for single-select groups.
  - add target drawable to group.
  - remove target drawable from group.
  - set/unset membership.
  - set default active selection.
- Enforce invariants:
  - target drawable exists.
  - target drawable belongs to at most one group.
  - group/variant IDs are unique.
  - membership references existing target drawable and variant.
  - default active references existing variant(s).
- Add operation-core payloads/types/registry entries for the supported mutations.
- Ensure operations produce normal authoring revision/dirty/history behavior.

Out of scope:

- Editor UI.
- Canvas preview active selection.
- Runtime Player switching.
- Texture Atlas stale logic change.
- Runtime Export materialization.

Required tests:

- Existing package without variants parses and produces empty variants.
- Valid package with variants serializes/parses via package file set.
- Optional `model/variants.json` is not required for old workspaces.
- Portable JSON bundle round-trips variants.
- Workspace save/open round-trips variants through PackageDocument.
- Create/delete/rename group operation works and is undo-compatible at graph level.
- Add/remove target drawable enforces single group ownership.
- Add/delete/rename variant works.
- Last variant delete in single-select group is rejected.
- Membership updates preserve unrelated drawables/groups.
- Default active selection validates references.
- Preview active selection is not represented in PackageDocument.

Escalate if:

- Current package-format strict schemas cannot add optional model files without broad migration infrastructure.
- operation-core cannot express the needed mutations without a new generic patch operation.
- Workspace Save and Portable JSON diverge in a way that needs a user decision.

## 7. Domain B: Variant Evaluation / Runtime Export Compatibility

Domain id: `wave99-variant-evaluation-runtime-export-compatibility`

Dependencies:

- Domain A `pass`.

Purpose:

- Add pure Variant visibility predicate semantics.
- Keep variant-free Canvas / Viewer / Atlas / Runtime Export behavior unchanged.
- Include Variant metadata and default active selection in Runtime Export without adding Runtime Player UI.

Allowed write scope:

- `packages/authoring-core/src/**`
- `packages/authoring-core/src/**/*.test.ts`
- `packages/package-format/src/**` only for narrow runtime export schema optional field additions if Domain A did not already cover them.
- `packages/package-format/src/**/*.test.ts` for focused runtime export schema tests.
- Domain B report/review files under `discussion/implementation/waves/wave99/` and `discussion/implementation/reviews/wave99/`

Conditional write scope, requiring explicit report justification:

- `packages/runtime-core/src/**` only if a pure helper/type is needed for future runtime predicate composition. Avoid source edits if possible.

Forbidden write scope:

- `apps/editor/src/**`
- `apps/runtime-player/src/**`
- `packages/render-core/src/**`
- `packages/render-webgl2/src/**`
- Texture Atlas packing algorithm files.
- Workspace Save unrelated behavior.
- package dependencies / lockfile.

Required implementation:

- Add pure helper to resolve Variant predicate from:
  - variant groups.
  - active selection.
  - drawable id.
- Missing/empty variants must resolve `true` for all drawables.
- Unassigned drawable must resolve `true`.
- Assigned drawable must resolve according to active selection.
- Support `singleSelect` and `multiToggle`.
- Add default active selection resolver.
- Add Runtime Export schema/materialization support:
  - include Variant metadata in exported runtime model or adjacent model section.
  - include default active selection.
  - ensure existing exports without variants still parse.
  - reflect default active selection in initial effective drawable visibility if that is the safest current-player compatibility path.
- Ensure Texture Atlas target selection remains bound Drawable based.
- Ensure Variant membership change alone is not treated as atlas source stale.

Out of scope:

- Editor Manager UI.
- Canvas integration.
- Runtime Player UI / hotkeys.
- Browser Source protocol.
- Capture From Current State.

Required tests:

- Predicate helper returns true for missing/empty variants.
- Predicate helper returns true for variant-neutral drawables.
- Predicate helper handles single-select groups.
- Predicate helper handles multi-toggle groups.
- Predicate helper blocks assigned drawable when active selection does not include it.
- Runtime Export with no variants remains byte/shape-compatible enough for existing tests.
- Runtime Export with variants includes metadata/default active selection.
- Default active selection affects initial effective exported visibility where implemented.
- Atlas target selection includes bound inactive/default-hidden variant drawables.
- Atlas source signature does not become stale solely from membership/default active changes, per accepted Wave99 policy.

Escalate if:

- Runtime Export schema rejects optional extensions in a way that would break Runtime Player load.
- Initial effective visibility cannot represent default active without losing base visibility needed for future Player switching.
- Atlas signature policy conflicts with existing source signature implementation.

## 8. Domain C: Variant Manager Editor UI / Canvas Preview

Domain id: `wave99-variant-manager-editor-ui-canvas-preview`

Dependencies:

- Domain A `pass`.
- Domain B `pass`.

Purpose:

- Add user-facing Variant Manager screen and session-local preview behavior.
- Let users create groups/variants, add drawables, edit membership/defaults, delete created entities, and see Canvas preview without touching Runtime Player.

Allowed write scope:

- `apps/editor/src/features/editor-session/**`
- `apps/editor/src/features/variants/**`
- `apps/editor/src/workspace/**`
- `apps/editor/src/state/**`
- focused app tests under `apps/editor/src/**`
- Domain C report/review files under `discussion/implementation/waves/wave99/` and `discussion/implementation/reviews/wave99/`

Forbidden write scope:

- `packages/package-format/src/**`, except importing Domain A/B APIs.
- `packages/authoring-core/src/**`, except importing Domain A/B APIs.
- `packages/operation-core/src/**`, except importing Domain A APIs.
- `apps/runtime-player/src/**`
- Runtime Export schema/materialization changes.
- Texture Atlas algorithm changes.
- Workspace Save format changes outside importing Domain A behavior.
- package dependencies / lockfile.

Required implementation:

- Add explicit `activeEntry === "variants"` route in `authoring-workspace.tsx`.
- Add `VariantManagerScreen`.
- Hide Parameter Bar for Variant Manager route.
- Back returns to neutral Authoring Workspace.
- Group list:
  - empty state.
  - create group.
  - rename/update group.
  - delete group.
  - mode display/edit where safe.
- Variant list/columns:
  - create variant.
  - rename variant.
  - delete variant with last-variant blocked for single-select.
- Target Drawables:
  - Add Drawables picker with Parts Tree-like hierarchy.
  - containers default collapsed.
  - container eligible/total count.
  - drawable eligibility states: eligible, not bound, already in other group, already in this group.
  - remove target drawable from group.
- Membership matrix:
  - checkbox/toggle cells.
  - supports same drawable in multiple variants of same group.
  - forbids cross-group ownership via disabled picker and operation validation.
- Default active selection editor:
  - one active variant for single-select.
  - ON/OFF map for multi-toggle.
- Preview active selection:
  - session-local state in Editor session/provider, not project state.
  - controls Canvas preview predicate.
  - does not set dirty or affect save.
- Canvas integration:
  - pass resolved `variantVisibilityPredicate` into `createCanvasEvaluatedScene` path.
  - if no preview active selection is present, use default active selection for Manager preview or documented neutral fallback; prefer Manager preview to reflect selected preview state.
  - neutral drawables remain unaffected.
- Feedback:
  - show validation/check strip for no groups, invalid refs, or duplicate ownership if loaded from old/bad data.

Out of scope:

- Runtime Player UI.
- hotkeys.
- Authoring Workspace permanent Variant switcher.
- Viewer Runtime View Variant switcher, unless already trivial and does not expand scope.
- Capture From Current State.
- smart grouping / automatic classification.
- clipping/mask warning implementation unless already cheap and deterministic.

Required tests:

- `Variants` Toolbox entry opens `VariantManagerScreen` instead of falling through to normal workspace.
- Back returns to neutral workspace.
- Parameter Bar is hidden in Variant Manager.
- Existing workspace without variants opens empty Variant Manager.
- Create group initializes expected mode/default variant.
- Delete group removes group and does not delete drawables.
- Create/delete/rename variant works.
- Last variant delete is blocked for single-select.
- Add Drawables picker renders Parts Container hierarchy collapsed by default.
- Picker shows eligible/total counts.
- Picker disables unbound drawables.
- Picker disables drawables already in other group.
- Picker handles already-in-this-group state.
- Membership checkbox updates model.
- Same drawable can be checked for multiple variants in same group.
- Default active selection saves through project state.
- Preview active selection affects Canvas preview and does not mark project dirty/save.
- Variant-neutral drawable remains visible according to existing visibility.
- Variant false hides assigned drawable while preserving existing visibility semantics for others.

Escalate if:

- Existing Editor session command layer cannot safely expose the required operation results.
- Canvas preview requires broad rewrite of projection/render pipeline.
- Parts Tree picker cannot be implemented without dragging in DnD/mutation behavior from `StructureTreePanel`.

## 9. Domain D: Final Integration / Clean Review

Domain id: `wave99-final-integration-clean-review`

Dependencies:

- Domain A `pass`
- Domain B `pass`
- Domain C `pass`

Purpose:

- Verify end-to-end Editor Variant Manager v0.
- Confirm existing projects, save/load, atlas, runtime export, and player-compatible default behavior are not broken.
- Record reports/reviews/maps.

Allowed write scope:

- `discussion/implementation/waves/wave99/**`
- `discussion/implementation/reviews/wave99/**`
- orchestration/review/wave maps if status updates are required.

Required checks:

- Domain reports and all review lanes present.
- Focused package-format tests for optional variants model file and old package compatibility.
- Focused authoring-core/operation-core tests for variant mutations and invariants.
- Focused runtime export tests for variants metadata/default compatibility.
- Focused editor tests for Variant Manager route/UI/picker/matrix/preview.
- Workspace Save / Open tests covering variants.
- Portable JSON tests covering variants.
- `pnpm typecheck`, or explicit known unrelated failure classification.
- `node scripts/check-source-organization.mjs`.
- `node scripts/check-dependencies.mjs`.
- `git diff --check`.
- Forbidden-scope diff check:
  - no Runtime Player UI/hotkey/protocol changes.
  - no Texture Atlas packing algorithm changes.
  - no Variant membership-only atlas stale behavior.
  - no package dependency/lockfile changes.
  - no Capture From Current State / smart grouping.

## 10. Review Policy

Each implemented domain requires independent review lanes:

1. Spec Compliance Review
2. Design / Development Compliance Review
3. Test Adequacy Review

Spec Compliance Review must explicitly check:

- Variant is backward-compatible for existing workspaces and portable JSON.
- Variantなしの場合はneutral predicateで既存表示が変わらない。
- Default active selection is persisted.
- Preview active selection is not persisted and does not dirty project state.
- Drawable belongs to at most one group.
- Same-group multi-variant membership is allowed.
- Add Drawables picker excludes unbound/Drawable Pool targets.
- Authoring Workspace has no permanent Variant switcher.
- Runtime Player UI / hotkeys are not implemented in Wave99.

Design / Development Review must explicitly check:

- `package-format` owns serializable DTO/schema.
- `authoring-core` owns graph state/mutations/pure predicate.
- `operation-core` owns operations.
- `apps/editor` owns Manager UI and preview state.
- Variant is not stored in `editorState`.
- Variant is not written into `runtimeVisibility`.
- Canvas and Runtime Export semantics use shared/consistent predicate logic.
- `StructureTreePanel` is not reused in a way that imports DnD/visibility mutation into picker.
- no catch-all file growth or source organization violation.
- no new dependencies.

Test Adequacy Review must explicitly check:

- old package/workspace/portable JSON compatibility.
- model/variants file parse/serialize.
- all core mutations and invalid references.
- default vs preview active split.
- Canvas predicate AND behavior.
- picker eligibility.
- Runtime Export metadata and default behavior.
- UI route/back/Parameter Bar hidden.

## 11. Expected Persistent Artifacts

Wave reports:

- `discussion/implementation/waves/wave99/wave99-domain-a-variant-model-package-format-operations-report.md`
- `discussion/implementation/waves/wave99/wave99-domain-b-variant-evaluation-runtime-export-compatibility-report.md`
- `discussion/implementation/waves/wave99/wave99-domain-c-variant-manager-editor-ui-canvas-preview-report.md`
- `discussion/implementation/waves/wave99/wave99-final-integration-report.md`
- `discussion/implementation/waves/wave99/_map.md`

Review reports:

- `discussion/implementation/reviews/wave99/wave99-domain-a-spec-compliance-review.md`
- `discussion/implementation/reviews/wave99/wave99-domain-a-design-development-review.md`
- `discussion/implementation/reviews/wave99/wave99-domain-a-test-adequacy-review.md`
- `discussion/implementation/reviews/wave99/wave99-domain-b-spec-compliance-review.md`
- `discussion/implementation/reviews/wave99/wave99-domain-b-design-development-review.md`
- `discussion/implementation/reviews/wave99/wave99-domain-b-test-adequacy-review.md`
- `discussion/implementation/reviews/wave99/wave99-domain-c-spec-compliance-review.md`
- `discussion/implementation/reviews/wave99/wave99-domain-c-design-development-review.md`
- `discussion/implementation/reviews/wave99/wave99-domain-c-test-adequacy-review.md`
- `discussion/implementation/reviews/wave99/wave99-final-clean-integration-review.md`
- `discussion/implementation/reviews/wave99/_map.md`

## 12. Subagent Contract

Orch-Sylph instructions must include:

- Use this active wave plan as source of truth.
- Start with bounded current-state confirmation for assigned domain.
- Orch-Sylph自身は実装担当ではない。source implementation は必ず別コンテキストの Gnome に委譲し、レビューは必ず別コンテキストの Review-Sylph に委譲すること。これを分離できない場合は実装せず escalate / blocked として報告すること。
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
- Preserve Workspace Save / Portable JSON compatibility.
- Preserve Runtime Export existing behavior for variant-free models.
- Preserve Texture Atlas target selection and do not make membership-only changes stale.
- Do not implement Runtime Player UI / hotkeys.
- Include Basis Coverage Self-Report and Deferred Basis Items.

Review-Sylph instructions must include:

- Review source and tests, not only Gnome summary.
- Report `pass`, `needs_changes`, or `escalate`.
- Remain read-only unless explicitly delegated a narrow fix.
- Treat existing workspace/portable JSON parse breakage as blocking.
- Treat persisted preview active selection as blocking.
- Treat Runtime Player UI/hotkey changes as out-of-scope.
- Treat dependency/lockfile changes as blocking unless explicitly escalated.

## 13. Orchestration Policy

Root / Undine:

- Owns wave plan, user questions, dependency graph, and final report.
- Must not implement Wave99 source changes.
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

## 14. Out of Scope

- Runtime Player Control Window Variant UI.
- Runtime Player hotkeys.
- Browser Source protocol changes.
- OBS / capture interaction changes.
- Authoring Workspace permanent Variant switcher.
- Capture From Current State.
- smart grouping / automatic classification.
- Variant-based Texture Atlas target expansion.
- membership-only Texture Atlas stale behavior.
- Texture Atlas packing algorithm changes.
- Mesh generation changes.
- Dynamics changes.
- Runtime Export directory write UX redesign.
- Workspace Save format redesign beyond optional variants model file.
- New dependencies.
- Cubism SDK / `.moc3` / `.model3.json` / `.physics3.json` compatibility.
