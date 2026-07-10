# AI Cohost Implementation Map

> `ai-cohost/implementation/` の地図。実装フェーズの計画・実行成果物を保持する(runtime-player方式)。

| Path | Content | Status |
|---|---|---|
| [closed-problem-decomposition.md](closed-problem-decomposition.md) | 「AI経由でモデルを動かす機能」の閉問題分解(C1〜C7)、分解原則、除外事項、UX精緻化対象、進め方(§6: 一問題ずつ議論→実装→ゲート→完全閉鎖の直列。実装中は人間の休憩) | 初期分解=Accepted、進め方=ユーザー決定(2026-07-10)。問題設定は変更され得る(留保付き) |
| [screens/](screens/) | C1/C3/C4のUX定義(runtime-playerのscreens/流儀) | C1=Accepted(振る舞い・見せ方とも 2026-07-10)。C3/C4未作成 |

wave計画・実装報告・レビューは着手時に `orchestration/` / `waves/` / `reviews/` を切って収める(runtime-player方式)。

## 次の行動

1. C1のwave計画を起こす([screens/c1-role-skeleton.md](screens/c1-role-skeleton.md) は振る舞い・見せ方ともAccepted済み)。
2. C3/C4のUX定義はそれぞれのwave直前にjust-in-timeで作成する。
