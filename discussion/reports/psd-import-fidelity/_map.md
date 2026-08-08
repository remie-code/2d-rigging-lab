# PSD Import Fidelity — Map

> `reports/psd-import-fidelity/` の入口地図。PSD インポート時のパーツ位置・見た目の忠実度に関する調査を保持する。

## 位置付け

`apps/editor` の PSD インポートで、Photoshop（等価ツール）表示に対しパーツ単位で位置・見た目がズレる問題の原因調査トピック。private 素材を扱うため、抽出画像・PSD はリポジトリへ追加せず scratchpad 参照に留める。

## 直下のファイル

| Path | Role | Status |
|------|------|--------|
| [import-position-mismatch-investigation.md](import-position-mismatch-investigation.md) | インポート直後のパーツ位置ズレ（目・襟）の原因調査。H1〜H4 判定 | Recorded(2026-07-12)。根本原因 H1 確定、`8640d12` の remap 実装後状態を参照 |

## 要点

- 根本原因(確定): **H1** — ライブキャンバスが padded ラスタを content UV 0..1 のまま描画し `contentInset` 未適用。パーツは自中心へ約 `P`(=5〜17px, レイヤー長辺依存) 縮み、隣接パーツ間で相対ズレ。
- H2(マスク未適用)/H3(可視性)/H4(グループ移動) はいずれも棄却。座標は正しく、描画側(UV/inset)が誤り。
- 修正済み（commit `8640d12218297908af5d7d03a8be4e8af8826b6e`）: [`canvas-projection.ts`](../../../apps/editor/src/workspace/canvas/canvas-projection.ts) が `contentInset` / `rasterDimensions` を運び、[`canvas-render-scene-adapter.ts`](../../../apps/editor/src/workspace/canvas/canvas-render-scene-adapter.ts) が UV remap を適用する。アトラス側 `texture-atlas-packing.ts:544-587` と同型。現行の設計・契約判断は [module-contracts map](../../design/module-contracts/_map.md) を正とする。

## 現行正本への導線

- 実装の正: [`canvas-render-scene-adapter.ts`](../../../apps/editor/src/workspace/canvas/canvas-render-scene-adapter.ts)、[`canvas-projection.ts`](../../../apps/editor/src/workspace/canvas/canvas-projection.ts)
- PSD/package 境界の正: [package-file-format-contract.md](../../design/module-contracts/package-file-format-contract.md)
- 公開・Cubism 非互換の権利境界: [rights-risk-cleanup map](../rights-risk-cleanup/_map.md)

## 次の作業候補

1. `8640d12` の UV remap と既存 regression evidence を現行実装の正として扱う。
2. 再発時のみ画素差分（埋め込み合成 vs 再構成 vs remap 適用）で確認し、設計判断を再オープンしない。
3. 大 P レイヤー（衣類・髪, P=12〜17）の可視性を確認する場合は、現行 canvas/atlas contract の検証として記録する。

## 未決事項

| 項目 | 状態 |
|------|------|
| 編集キャンバスを正とするか、atlasRuntime プレビューを導入するか | 過去の設計判断待ち。現行コードは `8640d12` の remap 経路を実装済みとして扱う |
| 縁 inset の許容量（P=5 は軽微 / P=17 は視認可能） | 過去の検証候補。再発時の画素確認で扱い、現行未完了タスクとはしない |
