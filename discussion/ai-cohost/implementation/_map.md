# AI Cohost Implementation Map

> `ai-cohost/implementation/` の地図。実装フェーズの計画・実行成果物を保持する(runtime-player方式)。

| Path | Content | Status |
|---|---|---|
| [closed-problem-decomposition.md](closed-problem-decomposition.md) | 「AI経由でモデルを動かす機能」の閉問題分解(C1〜C7)、分解原則、除外事項、UX精緻化対象、進め方(§6: 一問題ずつ議論→実装→ゲート→完全閉鎖の直列。実装中は人間の休憩) | 初期分解=Accepted、進め方=ユーザー決定(2026-07-10)。問題設定は変更され得る(留保付き) |
| [screens/](screens/) | C1/C3/C4のUX定義(runtime-playerのscreens/流儀) | C1=Accepted(振る舞い・見せ方とも 2026-07-10)。§7.7 に C1 実装反映を追記。C3/C4未作成 |
| [orchestration/](orchestration/) | wave計画とplanning gate棚卸し | C1棚卸し完了+wave実装完了(Domain A/B/C。2026-07-10)。棚卸しに「実装後の確定注記」、wave計画に §13 申し送り / §14 上位判断待ちを追記 |
| [waves/c1/](waves/c1/) | C1 各ドメインの実装レポート | Domain A(スロット基盤)/ B(役割合成・身元表示)/ C(最終統合・検証・docs)完了(2026-07-10) |
| [reviews/c1/](reviews/c1/) | C1 各ドメインの 3 レーンレビュー | Domain A/B とも spec / design / test の 3 レーン PASS(blocking ゼロ。2026-07-10) |

実装報告・レビューは着手時に `waves/` / `reviews/` を切って収める(runtime-player方式)。

## 次の行動

1. **C1 = 実装完了(Domain A/B/C)、パッケージ版の手動ゲート待ち**([orchestration/c1-wave-plan.md](orchestration/c1-wave-plan.md) §8 Manual Check Notes、手順書は [waves/c1/domain-c-final-integration.md](waves/c1/domain-c-final-integration.md))。手動ゲート合格+ §14 上位判断の裁定で C1 完全閉鎖。
2. C3/C4のUX定義はそれぞれのwave直前にjust-in-timeで作成する(自律ホストの Control degraded ページ解消は C4)。
