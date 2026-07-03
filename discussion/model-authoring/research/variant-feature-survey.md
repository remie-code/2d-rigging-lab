# Variant Feature Survey

> Variant（差分管理）機能の調査。2026-07-03 Sylph 調査（opus）の L0 統合。wave105（知覚経路への Variant ゲート組み込み）の直接根拠。

## 概念モデル（`packages/package-format/src/model-variants.ts`）

- **Variant Group**（`vgrp_*`）: 差分の集合。`mode` = `singleSelect`（ラジオ的）| `multiToggle`（独立トグル）。**1 drawable は高々 1 グループにしか属せない**（所有権制約、refine で強制）→ グループ間の AND/OR 合成は発生しない。
- **targetDrawableIds**: グループがゲートする対象。**載っていない drawable はゲート対象外（常に通過）**。
- **memberships** `{drawableId, variantIds[]}`: どの variant が選ばれたらこの drawable が表示されるか。1 drawable が複数 variant に属せる（共有パーツ）。
- **defaultActive**: パッケージ永続の初期選択。
- **最終可視性 = base visible AND variant predicate**（合成は呼び出し側の責務。predicate: 対象外→true / membership ∩ active ≠ ∅ → true）。

## 再利用点

- **純粋ロジックが authoring-core に実在**: `variant-evaluation.ts` の `createVariantVisibilityPredicate({variantGroups?, activeSelections?})`（**空/undefined → 恒等 `()=>true`**、selections 省略→ defaultActive 自動導出）、`resolveDefaultVariantActiveSelections`。依存は contracts + package-format のみ。authoring-host から直接 import 可能。
- **runtime-core は variant を全く知らない**（grep ヒット 0。`toRuntimeGraph` は base visible のみ設定）→ ゲートは知覚アダプタ層で適用する（runtime-core は変えない・変えるべきでない）。
- **参照実装 = Runtime Export materialization**（`runtime-export-materialization.ts:93-102,146,154-155`）: `baseVisible AND predicate(defaultActive)` の二層をそのまま実装済み。知覚経路はこのロジックだけを移植する（Export 経由はしない）。

## Editor での適用実態

- Canvas / Viewer とも `createVariantVisibilityPredicate` を生成し評価 options に注入（`canvas-evaluation.ts:242,321-323` で `base && !hiddenByPart && predicate` の AND 合成）。
- アクティブ selection = **defaultActive を初期値とする editor セッションローカル state**（ユーザーがセッション中に切り替え可能、永続はされない）。

## ref の実データ（`ref/model/variants.json`）

- グループ 1（`vgrp_expression` "Ware"、singleSelect）× variants 3: Default / Rodos / Endoministorator。defaultActive = Default。
- targets 15 / memberships 15。Default で通過するのは 6 drawable（bottomwear は Endoministorator と共有）。
- **ゲート無しの現行知覚描画では約 9 drawable が余分に描かれる**（Rodos 5 + Endoministorator 4。topwear 3 枚が重畳）。wave104 の ref-render-gate PNG はこの状態で撮られている。

## 空ケース（モデリング最初期）

- variantGroups 無し → predicate は恒等、`resolveDefaultVariantActiveSelections(undefined)` は `[]`。**ゲートを足しても差分ゼロのパッケージでは挙動不変が保証される**。

## 設計上の急所（調査の気づき）

1. **適用点は 2 候補**: (a) snapshot レベル（evaluation-adapter）→ 測量・bounds・drawableFocus にも波及して**目と巻尺が同じ世界を見る** / (b) RenderScene 構築時のみ → 測量が base visible ベースのまま残る不整合。
2. サイドカーには適用中の selection を記録すべき（「どの衣装で撮った写真か」の証明。stale 防止の延長）。

## L0 裁定（wave105 計画に反映）

1. **適用点は (a) snapshot レベル**。目（render）・巻尺（測量）・フレーミング（drawableFocus の bbox）が同一の可視性世界を共有することは三位一体設計の前提であり、(b) は不整合を構造化してしまう。
2. **payload に optional `variantSelections` を追加**（省略時 = defaultActive）。空ケースでは無意味・無害（恒等）。サイドカー / 測量結果に解決済み selection を記録する。
