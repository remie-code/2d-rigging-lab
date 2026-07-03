# Closed Problems Map

> 閉問題の一覧と状態。1 問題 = 1 ディレクトリ、番号付き。アプローチの定義は [../premises/closed-problem-approach.md](../premises/closed-problem-approach.md)。

## 問題ディレクトリの標準構成

- `problem-definition.md` — スコープ（操作列）、判断の所在、除外事項、成功基準
- `api-requirements.md` — A: この問題が要求する最小 API 面（調査後に作成）
- `results.md` — B: 実行記録とユーザー満足判定（実験後に作成）

## 問題列

| Path | 内容 | Status |
|---|---|---|
| [01-eyeball-x/](01-eyeball-x/) | 眼球メッシュ生成〜Eyeball_X 移動 rigging〜クリッピング | **通過（2026-07-03、ユーザー判定 100/100）**。[results.md](01-eyeball-x/results.md) / [実験ログ](01-eyeball-x/experiment/experiment-log.md)。craft/ へ蒸留済み（レシピ 00-03） |
| [02-eye-open-close/](02-eye-open-close/) | 目の開閉（状態デフォーマ3基×両眼、変形+opacity切替）| **通過（2026-07-03、ユーザー判定 100/100「文句のつけようもない」）**。[results.md](02-eye-open-close/results.md) / [実装記録](02-eye-open-close/build-log.md)。craft/05 へ蒸留済み |

| [03-face-angle-x/](03-face-angle-x/) | Face Angle X 最小核（鼻・顔輪郭・左目）| **二重通過（2026-07-03）**: 答え移植版 100点 + **盲目再構成版も満点**（craft のみのクリーン Fable、ゲイン=1 世界線を正典採用）。[results.md](03-face-angle-x/results.md)。発見「field = 構造 × ゲイン」をレシピ06へ恒久化 |

## 次の行動

1. 04 の問題定義（ユーザーの次の工程提示を待つ。候補: FaceX 残り12要素の展開（craft 適用の機械的反復、閉問題ではない可能性）/ Face Angle Y / 口の開閉等）

## 未決事項

- 04 以降の問題列（ユーザーの実工程順に従う）
