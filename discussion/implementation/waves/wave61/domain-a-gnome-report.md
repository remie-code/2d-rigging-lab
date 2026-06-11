# Wave61 Domain A Gnome Report

verdict: done

## 変更サマリ

- `packages/package-format`: `ModelPartDto.children?: ModelPartChildEntry[]` を追加。entry は `{ kind: "part", partId }` または `{ kind: "drawable", drawableId }`。
- `packages/authoring-core`: mixed ordered children helper、構造move mutation、PSD source-order再配置 helper、draw order flatten/sync、runtime draw order projectionを追加/更新。
- `packages/operation-core`: `moveStructureChild` payload/handler/registry/schema testを追加。既存の create/update/reparent/import 系operation diffへ `children` mirrorを含めた。`setDrawOrder` はPart Container block境界を跨ぐpayloadを拒否する。
- `packages/validator-core`: `children` があるpartについて duplicate/missing/membership mismatch を診断するcatalog/check/testを追加。
- `apps/editor`: Parts Tree projectionをmixed順に変更し、before/after/inside DnD intent、drop feedback、operation commit、Canvas projection/hit-test/part subtree selectionを同一order authorityへ接続。invalid hover/drop feedbackの残留をクリアするよう修正。
- `packages/ai-interface`: Codex proposal operation catalogへ `moveStructureChild` を追加。
- focused tests/contract fixtures: mixed order、flatten draw order、invalid drop、operation diff、legacy contract期待値、Wave30 recipeの旧`setDrawOrder`前提を更新。

作業開始時点で既にdirtyだった `discussion/design/**` と `discussion/implementation/orchestration/wave61-plan.md` は本Gnomeの実装変更として扱っていない。

## Order Authority / Data Contract

- Durable authorityは親Partごとの `part.children`。同じ親配下のPart Container/Drawableを1つのordered listとして保持する。
- `childPartIds` と `drawableIds` は互換用membership mirrorとして維持し、authoring mutations/operationsで同期する。
- `children` が無い旧データは、直接Drawableの旧`drawOrder`と、子Part blockのdescendant最小`drawOrder`からmixed順を復元する。旧データがPart Container blockを跨ぐ完全なDrawable interleaveを持っていた場合、その意図までは復元不能で、最小descendant orderをblock代表値にする互換制約が残る。
- root ModelPart直下のDrawableは既存schema/create/setDrawablePart/validator契約に合わせて合法。違法なのはmissing parent、仮想rootへのbefore/after、root Part自体の移動。
- Treeの上が前面。`flattenDrawableIdsByPartOrder()` は root part stable orderから再帰し、Drawableをその場でemit、Part Containerを配下Drawable群のblockとしてemitする。未訪問Drawableは旧drawOrderで最後にfallback appendする。
- `setDrawOrder` は同一構造内の直接Drawable slot順の同期API。Part Container block境界を跨ぐpayloadは `draw_order_structure_conflict` / `operation.setDrawOrder.structureConflict` で拒否し、構造変更は `moveStructureChild` を使う。

## DnD Semantics

- before/after: Drawable/Part Containerどちらのrowにもdrop可能。同じ親内reorderと別親reparentを同じoperationで処理する。
- inside: Part Container rowの中央領域でdrop可能。現状はdestination containerの先頭、つまり最前面位置へ挿入する。
- UI feedback: rowに `data-drop-placement` を出し、before/after/insideでborder/shadowを切り替える。
- implemented combinations: Drawable before/after Drawable、Drawable before/after Part Container、Drawable inside Part Container、Part Container before/after Drawable、Part Container before/after Part Container、Part Container inside Part Container。
- blocked states: root part move、root rowへのbefore/after、self drop、partを自分/descendantへ入れるcycle、missing target/parent、Drawable no-op structure moveを拒否。root ModelPartへのDrawable insideは許可。

## Canvas / Runtime Projection

- Parts Tree、Canvas `frontOrder`、runtime graph `drawOrder` は `createStructureDrawOrderIndex()` / `flattenDrawableIdsByPartOrder()` を共有する。
- Canvasは背面から描画するため、flatten indexが小さいDrawableほどTree上で前面、hit-testでも上位になる。
- Part subtree selectionは `getPartOrderedChildren()` を再帰し、mixed children内のDrawable/Part Container双方を辿る。

## Domain B/C Contract

- PSD source-order挿入: group/leaf生成後に `reorderChildrenBySourceOrder(session, entries)` を呼ぶ。entryは `parentPartId`, `child: createPartChildEntry(...) | createDrawableChildEntry(...)`, `sourceOrder`, `stableId`。
- 単発挿入/移動: `insertPartOrderedChild()`, `appendPartOrderedChild()`, `removePartOrderedChild()`, `setPartOrderedChildren()` を使い、最後に `syncDrawOrderToPartOrder()` を呼ぶ。
- UI/AI/operationからの移動: `moveStructureChild` operationを使う。payloadは `moved` と `drop` (`inside parentPartId` または `before/after target`)。
- 読み取り: Tree/Canvas/commandsは `getPartOrderedChildren()`, `flattenDrawableIdsByPartOrder()`, `createStructureDrawOrderIndex()` を使う。`childPartIds` then `drawableIds` の直読順序へ戻さないこと。
- Drawableだけの旧reorder UIは互換APIとして残るが、mixed row DnDは `moveStructureChild` を呼ぶこと。Part Container blockを跨ぐ順序調整を `setDrawOrder` で表現しないこと。

## Verification

- `pnpm.cmd --dir apps/editor typecheck`: pass。
- `pnpm.cmd --dir apps/editor build`: sandboxではVite/esbuild `spawn EPERM`、権限付き再実行で pass。2098 modules transformed。chunk size warningのみ。
- `pnpm.cmd run typecheck`: pass。
- focused unit: `pnpm.cmd exec vitest run packages/authoring-core/src/structure-order-mutations.test.ts packages/operation-core/src/operations/move-structure-child.test.ts packages/operation-core/src/operations/set-draw-order.test.ts apps/editor/src/features/editor-session/model/session-tree.test.ts apps/editor/src/features/editor-session/model/editor-session-commands.test.ts apps/editor/src/workspace/canvas/canvas-projection.test.ts packages/validator-core/src/part-texture-layer-diagnostics.test.ts`: 7 files / 58 tests pass。
- repair focused: `pnpm.cmd exec vitest run packages/operation-core/src/drawable-layer-runtime-evidence.test.ts packages/operation-core/src/wave30-tutorial-mini-model-recipe.test.ts packages/operation-core/src/wave30-tutorial-mini-model-contract-fixtures.test.ts packages/runtime-core/src/wave30-tutorial-mini-model-contract-fixtures.test.ts packages/validator-core/src/wave30-tutorial-mini-model-contract-fixtures.test.ts packages/authoring-core/src/draw-order-mutations.test.ts`: 6 files / 11 tests pass。
- `pnpm.cmd run test:unit`: pass。188 files / 974 tests pass。
- `pnpm.cmd run check`: pass。typecheck pass、unit 188 files / 974 tests pass、Dependency guard passed、Source organization guard passed。
- E2E: `pnpm.cmd --dir apps/editor test:e2e:psd-import`: pass。3 tests passed (`imports fixture PSD`, `edits imported parts/drawables`, `reorders drawable rows with Parts Tree drag and drop`)。
- `git diff --check -- apps packages scripts package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json discussion`: exit 0。CRLF replacement warningsのみ。
- `git diff --check -- apps packages scripts package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json discussion fixtures`: exit 0。CRLF replacement warningsのみ。

## Remaining Constraints

- mixed before/after/insideの全組み合わせ専用Playwright E2Eは追加していない。unit/operationで全組み合わせ、cycle/root/no-op/membership invalid、Canvas nested block flattenを固定し、既存PSD import/Parts Tree DnD E2Eを回した。UIのピクセル/スクリーンショットoracleはDomain A禁止範囲のため未追加。
- `inside` dropのdefaultは先頭/前面挿入。任意index付きinsideが必要なら、Domain B/Cで追加UX判断が必要。
- schema version migration fileは追加していない。`children` はoptionalで、旧packageはfallback互換。
- runtime/export part visibility semantics、mesh generation、PSD Import Previewは触っていない。

## User Decision Points

- なし。
