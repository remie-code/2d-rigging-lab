# 閉問題 02: 目の開閉（Eye Open rigging）

> 2026-07-03 ユーザー提示（ref の実構造スクリーンショット + 口頭仕様）。前哨戦（半目セットの眼球X rigging + 表示切替足場）は完了・gate 通過済み。

## 最終構造（ユーザー仕様）

片目につき状態デフォーマ 3 基。パラメータ `param_eye_left_open` / `param_eye_right_open`（preset、1.0=開 / 0.0=閉）に対し**「変形で形を繋ぎ、切替の瞬間だけ opacity で消す」**:

```
Eye_L_Open:  子 = [rig_eyeball_l_warp, eyelash-l, eyewhite-l]
  形状: 1.0(開形) → 0.5(半目形に一致)  / opacity: 1@0.6 → 0@0.5
Eye_L_Half:  子 = [rig_eyeball_l_half_warp, eyelash-l 2, eyewhite-l 2]
  形状: 0.5(rest) → 0.0(閉じ目形に一致) / opacity: 1@0.05 → 0@0.0
Eye_L_Close: 子 = [eyelash-l 3]
  形状: なし                            / opacity: 1@0.0 → 0@0.07
```

- **Half に出現側 opacity キーは打たない**（ユーザー裁定）: param≥0.5 では Open が半目領域を完全に覆っており、描画順（通常モード）が出現を只で処理する。ほとんどのケースに当てはまる一般則
- Close だけは、まつげ線が横に長く Open/Half の描画領域外へ出るため opacity で消す必要がある
- 0.05〜0.07 に Half/Close の短いクロスフェード窓（意図された仕様）
- 実際の瞬き速度では opacity 中間値の時間は知覚できない → 自然な瞬き

## 判断の所在

- 機械的（レシピ化可能）: 状態デフォーマ作成（childRigControlIds + childDrawableIds 直接指定）、opacity キー（`addCurrent` ×2/セット）、eyelash-l/r 3 のメッシュ生成
- ★視覚判断（本問題の核心）: **形状キーの authoring**。Open@0.5 の変形結果を「半目セットの rest 姿」に、Half@0.0 を「閉じ目まつげ線」に近づける。**形状オラクルがディスク上に実在する変形問題**（A/B レンダ比較で回せる）
- 【ユーザー gate】: Editor スライダーで瞬きの自然さを判定

## A（必要 API）: 全て存在確認済み（2026-07-03 調査）

- `createWarpDeformer` の `childRigControlIds`（既存デフォーマの子化）+ `childDrawableIds` 直接指定（`payloads/rig-control.ts:66-82`）
- `editKeyformKey action:"addCurrent"` の `keyValue` による任意値キー（`payloads/model-edit.ts:459-489`）
- rigControl `opacityMultiplier` キーフォーム（両 kind 対応、値域 0..1、確認済み）
- preset `param_eye_left_open` / `param_eye_right_open`（weight 型、default 1）

## 成功基準

1. rest（両パラメータ 1.0）で従来の開き目と同一に見える
2. sweep で 開 → 半目 → 閉 の状態遷移が意図の param 区間で起きる
3. 形状遷移が「ポップ」ではなく連続変形に見える（0.5 と 0.0 での形一致が鍵）
4. `param_eyeball_x` との合成が壊れない（0.75 × ±1 で眼球移動が生きている）
5. ユーザーの瞬き満足判定

## スコープ外

- 右目と左目の独立ウィンク調整（構造は独立なので自然に可能なはず、審美調整はしない）
- 眉・口・他表情セット
