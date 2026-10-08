# editor-render-performance レポート マップ

> Status: Recorded(2026-07-07) / 調査担当 Sylph（委任元 Undine）。**Pre-Perf Wave 2 の historical baseline**。現行の処方・受入・Runtime Player 状態は [../../render-performance/_map.md](../../render-performance/_map.md) を正とする。

Editor / Editor内Viewer のパラメータ操作時レンダリング性能に関する現状把握調査の格納先。

## ファイル

| ファイル | 内容 |
|---------|------|
| `current-state-survey.md` | 現状把握調査本体。7項目（ホットパス / 評価層 / 描画層 / Viewer経路 / 既存計測 / ボトルネック仮説順位 / 計画への含意）+ 質問。リポジトリ事実を主とし推測は明示分離 |

## 一行結論

パラメータ変更のたびに `canvas-evaluation.ts` が全 drawable・全 keyformSet を全量再評価し、頂点を `Vec2Dto` オブジェクトで多重クローン + `toFixed` 正規化する（dirty tracking / メモ化なし）のが最有力ボトルネック仮説。Editor Canvas と Editor 内 Viewer はこの評価パスを共有する。

## 主要参照 file:line（本体より）

- `apps/editor/src/workspace/canvas/canvas-evaluation.ts` L207-354, L718-741, L1159-1165 — 全量評価・頂点クローン・toFixed 正規化
- `apps/editor/src/features/editor-session/model/parameter-keyform-state.ts` L473-586 — 全 keyformSet 再サンプリング
- `apps/editor/src/workspace/canvas/canvas-projection.ts` L164-256 — projection 全量再構築
- `apps/editor/src/workspace/panels/canvas-preview-panel.tsx` L156-188, L287-309 — 評価/描画トリガ
- `apps/editor/src/workspace/controls/raf-coalesced-number.ts` L54-68 — rAF コアレシング（スロットリング）
- `apps/editor/src/workspace/viewer/viewer-clean-stage.ts` L61 — Editor内Viewer が canvas-evaluation を共有
- `packages/render-webgl2/src/webgl2-renderer.ts` L50-91, L262-271 — Editor 実描画（WebGL2）
- `packages/runtime-core/src/runtime-profiling.ts` — 計測 interface

## 状態

- 診断（現状把握）は完了。処方は未確定（意図的）。
- 未解決の質問4件を本体末尾に記載（症状主対象 / モデル規模実値 / 決定性制約優先度 / 実測の要否）。
- この map の一行結論と file:line は 2026-07-07 時点の調査スナップショット。Perf Wave 2 後の current source（display 数値 snap 等）や Runtime Player Waves13–19 の実装状態を表すものではない。

## 現行への導線

- Editor Perf Wave 2 は実装・レビュー・ユーザー受け入れ済み（Editor の動作として十分）。
- Runtime Player は Waves13–19 で fast-path / diagnostics / cadence を実装済み。C7 二体負荷は optional / unmeasured gate、product deep profiler は再公開しない。
- 現行の測定値・受入境界・再開条件は [../../render-performance/_map.md](../../render-performance/_map.md) とその `measurements/`、implementation wave reports を参照する。
