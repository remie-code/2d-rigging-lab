# Wave 1 の実装根拠

[2 Wave計画](../../orchestration/reference-image-overlay-wave-plan.md) の §1–4 と §6–7、[笑みの議論 §8](../../../ai-cohost/concept/shared-laughter-expression.md#8-参照表示を先に整える判断2026-11-12) に基づく。対象は共通状態、保存、Authoring Host での比較描画。

## 既存の実装

- `packages/authoring-core/src/package-document-editor-state.ts` は `model/editor-state.json` に制作中の表示状態を保存する前例。具体的に書き出される値は `editorHiddenIds` などの生成関数を確認する。
- `apps/authoring-host/src/run-authoring-host-command.ts` は `renderView` を知覚コマンドとして扱う。通常の CLI は保存済み workspace を読むため、保存から別プロセスでの読み込みまでを実証する。
- `packages/render-software/src/view/view-transform.ts` はモデル座標（stage Y-down）を viewport と出力寸法で画素へ写す。Editor 側はモデル座標から Canvas の pan/zoom を適用する。

## 受入条件

- 画像の配置はモデル座標の平行移動・一様スケール・回転で表す。pivot 再指定前後で画像は同じ位置を保つ。スケール・回転の更新で pivot のモデル座標を保つ。
- 表示はモデルのみ、参照のみ、重ね合わせの三通り。参照 opacity は 0–1 で設定し、モデルのみの表示でも値を保持する。元 PNG の alpha に参照 opacity を適用する。
- 制作資料として画像を取り込み、元の外部パスに依存せずに保存復帰できる。一枚を登録・差替え・除去でき、不正入力で既存の参照が失われない。旧 workspace を開けて Runtime Export の drawable/atlas に影響しない。
- 実 CLI の登録から保存再開、非中心 pivot、複数 viewport、モデル編集後の再描画まで確認する。出力には使用したモデル、パラメータ、viewport、参照状態の追跡に必要な情報を残す。
- 実画像は `discussion/ai-cohost/concept/shared-laughter-expression/laugh-relaxed-v2.png`。外部 r815 workspace と現用 Export は読取専用で、編集を伴う確認はリポジトリ内の検証用コピーで行う。

## 実装とレビューの担当

- Gnome は共有契約、保存、Host API/CLI と比較描画、関連テスト・Host 利用手順を担当する。
- Review-Sylph は独立にコード、テスト、実 CLI の証拠と描画結果を照合する。
- Wave 2 は Editor の操作・保存再開と制作での比較を確認する。ユーザーの作業感と造形の判断は計画 §2 の合格条件による。

## 採用した保存方式

- workspace の `authoring/` に制作補助ファイルを追加する。参照 JSON と元 PNG の組で保持し、画像名を内容の SHA-256 にする。画像を書き終えてから JSON を切り替える。保存済みモデル・source/atlas の索引を更新する必要がなく、参照操作だけで model revision と digest は進まない。
- JSON の `reference` が有効な一件を指定し、`null` で除去を表す。切替直前の参照を読んでいる処理を壊さないよう、以前の画像は残す。workspace に保存済みの画像を再利用するため、登録元ファイルを移動しても読み込める。
- 初期位置はモデル原点、基準点は画像中心、倍率は 1、回転角は 0°、表示は重ね合わせ、opacity は 0.5。Canvas が画像選択時に決める初期配置は Wave 2 の接続で確認する。

## 実装前の検査結果

`codex/intent-motion` の先行差分込みで `npm run typecheck:root`、`npm run test:unit`（250 ファイル、1,552 テスト）、`npm run check:deps`、`npm run check:soul-zone` が成功した。`npm run check:source` は `apps/runtime-player/src/main/physiology/index.ts` の barrel 規約違反を報告した。
