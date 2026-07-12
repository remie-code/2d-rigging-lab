# PSD Import Fidelity — Map

> `reports/psd-import-fidelity/` の入口地図。PSD インポート時のパーツ位置・見た目の忠実度に関する調査を保持する。

## 位置付け

`apps/editor` の PSD インポートで、Photoshop（等価ツール）表示に対しパーツ単位で位置・見た目がズレる問題の原因調査トピック。private 素材を扱うため、抽出画像・PSD はリポジトリへ追加せず scratchpad 参照に留める。

## 直下のファイル

| Path | Role | Status |
|------|------|--------|
| [import-position-mismatch-investigation.md](import-position-mismatch-investigation.md) | インポート直後のパーツ位置ズレ（目・襟）の原因調査。H1〜H4 判定 | Recorded(2026-07-12)。根本原因 H1 確定 |

## 要点

- 根本原因(確定): **H1** — ライブキャンバスが padded ラスタを content UV 0..1 のまま描画し `contentInset` 未適用。パーツは自中心へ約 `P`(=5〜17px, レイヤー長辺依存) 縮み、隣接パーツ間で相対ズレ。
- H2(マスク未適用)/H3(可視性)/H4(グループ移動) はいずれも棄却。座標は正しく、描画側(UV/inset)が誤り。
- 修正候補: `canvas-projection.ts` / `canvas-render-scene-adapter.ts` で contentInset を UV へ remap（アトラス側 `texture-atlas-packing.ts:544-587` と同型）。スコープ判断は Undine 領域。

## 次の作業候補

1. 設計 §5.5「atlasRuntime が canonical preview」前提と、現行ライブキャンバス（original 経路のみ）の食い違いを Undine が整理。
2. 修正着手時は画素差分（埋め込み合成 vs 再構成 vs remap 適用）で確定確認。
3. 大 P レイヤー（衣類・髪, P=12〜17）を優先的に検証。

## 未決事項

| 項目 | 状態 |
|------|------|
| 編集キャンバスを正とするか、atlasRuntime プレビューを導入するか | 設計判断待ち |
| 縁 inset の許容量（P=5 は軽微 / P=17 は視認可能） | 修正方針で決定 |
