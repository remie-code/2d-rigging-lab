# AI Cohost Implementation Map

> `ai-cohost/implementation/` の地図。実装フェーズの計画・実行成果物を保持する(runtime-player方式)。

| Path | Content | Status |
|---|---|---|
| [closed-problem-decomposition.md](closed-problem-decomposition.md) | 「AI経由でモデルを動かす機能」の閉問題分解(C1〜C7)、分解原則、除外事項、UX精緻化対象、進め方(§6: 一問題ずつ議論→実装→ゲート→完全閉鎖の直列。実装中は人間の休憩) | 初期分解=Accepted、進め方=ユーザー決定(2026-07-10)。問題設定は変更され得る(留保付き) |
| [screens/](screens/) | C1/C3/C4のUX定義(runtime-playerのscreens/流儀) | C1=Accepted(振る舞い・見せ方とも 2026-07-10)。§7.7 に C1 実装反映を追記。C3=[screens/c3-physiology-profile.md](screens/c3-physiology-profile.md) 作成済み(Accepted、Physiologyページ UX。C3 実装の source of truth)。C4=[screens/c4-channel-diagnostics.md](screens/c4-channel-diagnostics.md)(Accepted、Channelページ・自律Overview・degraded解消。C4 実装の source of truth。§3 に degraded data源の構成不変条件を追記) |
| [orchestration/](orchestration/) | wave計画とplanning gate棚卸し | **C1完全閉鎖(2026-07-10)**: 手動ゲート全項目合格+§14裁定済み。既知制限=dev引数なし起動(wave計画Status)。**C2完全閉鎖(2026-07-11)**: 手動美的ゲート合格。**C3完全閉鎖(2026-07-11)**: Domain A→E+追撃F 完了、手動ゲート合格。**C4 実装完了・3レーンレビュー全PASS・機械ゲート緑(2026-07-11)**: Domain A→B→C→D→E 完了、手動確認待ち([orchestration/c4-wave-plan.md](orchestration/c4-wave-plan.md) Status に結果・既知baseline反映) |
| [waves/c1/](waves/c1/) | C1 各ドメインの実装レポート | Domain A(スロット基盤)/ B(役割合成・身元表示)/ C(最終統合・検証・docs)完了(2026-07-10) |
| [reviews/c1/](reviews/c1/) | C1 各ドメインの 3 レーンレビュー | Domain A/B とも spec / design / test の 3 レーン PASS(blocking ゼロ。2026-07-10) |
| [waves/c2/](waves/c2/) | C2 各ドメインの実装レポート | Domain A(頭無しリゾルバ抽出)/ B(生成器骨格・まばたき)/ C(フレーム心臓・役割合成)/ D(最終統合・検証・docs・手動ゲート手順)完了(2026-07-10) |
| [reviews/c2/](reviews/c2/) | C2 各ドメインの 3 レーンレビュー | Domain A/B/C とも spec / design / test の 3 レーン PASS(blocking ゼロ。2026-07-10) |
| [waves/c3/](waves/c3/) | C3 各ドメインの実装レポート | Domain A(ノイズ/バネ基盤+config seam+blink載せ替え)/ B(gaze/head/posture+結合3+fixture)/ C(Physiologyページ+プロファイル+bridge、F1修正込み)/ D(Stage Presence 駆動)/ E(最終統合・検証・docs・手動ゲート手順)完了(2026-07-11) |
| [reviews/c3/](reviews/c3/) | C3 各ドメインの 3 レーンレビュー | Domain A/B/D は spec/design/test 3レーン PASS。Domain C は lane2 が Strength スライダーバグで一旦「要修正」→ F1修正で再レビュー合格。**全12レーン最終 PASS、blocking ゼロ(2026-07-11)** |
| [waves/c4/](waves/c4/) | C4 各ドメインの実装レポート + follow-up | Domain A(契約の家・チャネルWSサーバ・拒否列挙6件・port/token採番)/ B(粗いオーバーレイprovider・心臓tick統合・TTL・切断→基底復帰)/ C(Channelページ・bridge・自律版Overview・degraded 6面・合成根配線)/ D(特区 apps/soul・依存ゼロ参照ドライバ・持続駆動テスト・方向ルール検査2ルール)/ E(最終統合・モノレポ検証・docs更新・fixture整合)完了(2026-07-11)。[c4-followup.md](waves/c4/c4-followup.md) に v0 繰延6件を記録 |
| [reviews/c4/](reviews/c4/) | C4 各ドメインの 3 レーンレビュー | Domain A/B/C/D とも spec/design/test の 3 レーン PASS(blocking ゼロ。non-blocking は Domain E で回収 or follow-up 記録。2026-07-11) |

実装報告・レビューは着手時に `waves/` / `reviews/` を切って収める(runtime-player方式)。

## 次の行動

1. **C1 = 完全閉鎖(2026-07-10)**: パッケージ版手動ゲート全項目合格(ユーザー実施)+§14裁定済み。
2. **C2「身体が呼吸する(まばたき)」= 完全閉鎖(2026-07-11)**: 実装+3レーンレビュー全PASS+手動美的ゲート合格(瞬きに違和感なし・OBS Browser Source確認・トラッキングとの二体非干渉確認)。
3. **C3「視線と頭が生きる」= 完全閉鎖(2026-07-11)**: Domain A→B→C→D→E+追撃F(キャプション・Stage Presence知覚性)完了、レビュー全PASS、手動ゲート合格(30秒判定・ツマミ即時反映・プロファイル復元・トラッキング退行なし・OBS parity・キャプション・Stage Presence on/off差)。
4. **C4「外から動かせる(操縦チャネルv0)」= 完全閉鎖(2026-07-11)**: 実装+レビュー全PASS+一目確認合格。特区 `apps/soul` 稼働(参照ドライバ+方向ルール検査)。持ち越し: Stage Presence×チャネル結合の裁定([waves/c4/c4-followup.md](waves/c4/c4-followup.md) ⚠)+v0繰延5件。
5. **次の閉問題 = C5「合成が正しい」**。設計討議Accepted([../architecture/c5-composition-and-envelopes.md](../architecture/c5-composition-and-envelopes.md)、2026-07-11。裁定3件: Stage Presence=実効body信号追従/変調繰延/器側エンベロープ+派生2原則: 連続性・解放も曲線)。C5にUX定義は不要(新画面なし。Channelページのイベント表示は既存)。次は**context-check → 棚卸し → wave計画**。ゲート: 人間判定はC4参照ドライバの実駆動プロファイル。
