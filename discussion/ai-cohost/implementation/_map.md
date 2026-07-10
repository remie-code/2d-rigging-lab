# AI Cohost Implementation Map

> `ai-cohost/implementation/` の地図。実装フェーズの計画・実行成果物を保持する(runtime-player方式)。

| Path | Content | Status |
|---|---|---|
| [closed-problem-decomposition.md](closed-problem-decomposition.md) | 「AI経由でモデルを動かす機能」の閉問題分解(C1〜C7)、分解原則、除外事項、UX精緻化対象、進め方(§6: 一問題ずつ議論→実装→ゲート→完全閉鎖の直列。実装中は人間の休憩) | 初期分解=Accepted、進め方=ユーザー決定(2026-07-10)。問題設定は変更され得る(留保付き) |
| [screens/](screens/) | C1/C3/C4のUX定義(runtime-playerのscreens/流儀) | C1=Accepted(振る舞い・見せ方とも 2026-07-10)。§7.7 に C1 実装反映を追記。C3/C4未作成 |
| [orchestration/](orchestration/) | wave計画とplanning gate棚卸し | **C1完全閉鎖(2026-07-10)**: 手動ゲート全項目合格+§14裁定済み。既知制限=dev引数なし起動(wave計画Status)。**C2 wave 実装完了(2026-07-10)**: Domain A→B→C→D 完了、機械ゲート green、手動美的ゲート待ち([orchestration/c2-wave-plan.md](orchestration/c2-wave-plan.md)) |
| [waves/c1/](waves/c1/) | C1 各ドメインの実装レポート | Domain A(スロット基盤)/ B(役割合成・身元表示)/ C(最終統合・検証・docs)完了(2026-07-10) |
| [reviews/c1/](reviews/c1/) | C1 各ドメインの 3 レーンレビュー | Domain A/B とも spec / design / test の 3 レーン PASS(blocking ゼロ。2026-07-10) |
| [waves/c2/](waves/c2/) | C2 各ドメインの実装レポート | Domain A(頭無しリゾルバ抽出)/ B(生成器骨格・まばたき)/ C(フレーム心臓・役割合成)/ D(最終統合・検証・docs・手動ゲート手順)完了(2026-07-10) |
| [reviews/c2/](reviews/c2/) | C2 各ドメインの 3 レーンレビュー | Domain A/B/C とも spec / design / test の 3 レーン PASS(blocking ゼロ。2026-07-10) |

実装報告・レビューは着手時に `waves/` / `reviews/` を切って収める(runtime-player方式)。

## 次の行動

1. **C1 = 完全閉鎖(2026-07-10)**: パッケージ版手動ゲート全項目合格(ユーザー実施)+§14裁定済み。
2. **C2「身体が呼吸する」= wave 実装完了(2026-07-10)**: Domain A→B→C→D 完了、3レーンレビュー全 PASS、機械ゲート green(等価性golden・fixture・typecheck・アプリ回帰606pass/既知baseline2fail・root typecheck・packages 1492pass)、Editor/package-format/schema/lockfile 無変更・`pnpm install` 不実施・実行時role分岐ゼロを確認。**残: ユーザー手動美的ゲート**(自律ホストで瞬き開始/30秒「死体・機械ループでないか」/OBS Browser Source/トラッキングホスト退行なし/二体並走の非干渉)——手順は [waves/c2/domain-d-final-integration.md](waves/c2/domain-d-final-integration.md) に記載。合格すれば C2 完全閉鎖。
3. C3/C4のUX定義はそれぞれのwave直前にjust-in-timeで作成する(自律ホストの Control degraded ページ解消は C4)。
