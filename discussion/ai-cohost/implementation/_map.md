# AI Cohost Implementation Map

> `ai-cohost/implementation/` の地図。実装フェーズの計画・実行成果物を保持する(runtime-player方式)。

| Path | Content | Status |
|---|---|---|
| [closed-problem-decomposition.md](closed-problem-decomposition.md) | 「AI経由でモデルを動かす機能」の閉問題分解(C1〜C7)、分解原則、除外事項、UX精緻化対象、進め方(§6: 一問題ずつ議論→実装→ゲート→完全閉鎖の直列。実装中は人間の休憩) | 初期分解=Accepted、進め方=ユーザー決定(2026-07-10)。**C1〜C7全閉鎖(2026-07-12)=器の完成** |
| [s-series-decomposition.md](s-series-decomposition.md) | 魂(apps/soul)の閉問題分解(S1〜S9): 歩くスケルトン→耳→呼べば応える→表情→**目が開く(視覚)**→会話継続→視聴者→配信リハ→相槌(persona後)。S5視覚の設計方針、除外事項、進め方はC系列規律を継承 | 初期分解=Accepted(2026-07-12)。切る基準=ユーザーのゲート認知負荷。**問題設定は視座の変化で変更され得る(留保付き)**。S1着手と同時に `experiments/` 開設 |
| [screens/](screens/) | C1/C3/C4/S2.5のUX定義(runtime-playerのscreens/流儀) | C1=Accepted(振る舞い・見せ方とも 2026-07-10)。§7.7 に C1 実装反映を追記。C3=[screens/c3-physiology-profile.md](screens/c3-physiology-profile.md) 作成済み(Accepted、Physiologyページ UX。C3 実装の source of truth)。C4=[screens/c4-channel-diagnostics.md](screens/c4-channel-diagnostics.md)(Accepted、Channelページ・自律Overview・degraded解消。C4 実装の source of truth。§3 に degraded data源の構成不変条件を追記)。**S2.5=[screens/soul-cockpit.md](screens/soul-cockpit.md)(Draft 2026-07-12、魂のローカルWebコクピット。形の原則+v0画面+拡張予約)** |
| [orchestration/](orchestration/) | wave計画とplanning gate棚卸し | **C1完全閉鎖(2026-07-10)**: 手動ゲート全項目合格+§14裁定済み。既知制限=dev引数なし起動(wave計画Status)。**C2完全閉鎖(2026-07-11)**: 手動美的ゲート合格。**C3完全閉鎖(2026-07-11)**: Domain A→E+追撃F 完了、手動ゲート合格。**C4 実装完了・3レーンレビュー全PASS・機械ゲート緑(2026-07-11)**: Domain A→B→C→D→E 完了、手動確認待ち([orchestration/c4-wave-plan.md](orchestration/c4-wave-plan.md) Status に結果・既知baseline反映) |
| [waves/c1/](waves/c1/) | C1 各ドメインの実装レポート | Domain A(スロット基盤)/ B(役割合成・身元表示)/ C(最終統合・検証・docs)完了(2026-07-10) |
| [reviews/c1/](reviews/c1/) | C1 各ドメインの 3 レーンレビュー | Domain A/B とも spec / design / test の 3 レーン PASS(blocking ゼロ。2026-07-10) |
| [waves/c2/](waves/c2/) | C2 各ドメインの実装レポート | Domain A(頭無しリゾルバ抽出)/ B(生成器骨格・まばたき)/ C(フレーム心臓・役割合成)/ D(最終統合・検証・docs・手動ゲート手順)完了(2026-07-10) |
| [reviews/c2/](reviews/c2/) | C2 各ドメインの 3 レーンレビュー | Domain A/B/C とも spec / design / test の 3 レーン PASS(blocking ゼロ。2026-07-10) |
| [waves/c3/](waves/c3/) | C3 各ドメインの実装レポート | Domain A(ノイズ/バネ基盤+config seam+blink載せ替え)/ B(gaze/head/posture+結合3+fixture)/ C(Physiologyページ+プロファイル+bridge、F1修正込み)/ D(Stage Presence 駆動)/ E(最終統合・検証・docs・手動ゲート手順)完了(2026-07-11) |
| [reviews/c3/](reviews/c3/) | C3 各ドメインの 3 レーンレビュー | Domain A/B/D は spec/design/test 3レーン PASS。Domain C は lane2 が Strength スライダーバグで一旦「要修正」→ F1修正で再レビュー合格。**全12レーン最終 PASS、blocking ゼロ(2026-07-11)** |
| [waves/c4/](waves/c4/) | C4 各ドメインの実装レポート + follow-up | Domain A(契約の家・チャネルWSサーバ・拒否列挙6件・port/token採番)/ B(粗いオーバーレイprovider・心臓tick統合・TTL・切断→基底復帰)/ C(Channelページ・bridge・自律版Overview・degraded 6面・合成根配線)/ D(特区 apps/soul・依存ゼロ参照ドライバ・持続駆動テスト・方向ルール検査2ルール)/ E(最終統合・モノレポ検証・docs更新・fixture整合)完了(2026-07-11)。[c4-followup.md](waves/c4/c4-followup.md) に v0 繰延6件を記録 |
| [reviews/c4/](reviews/c4/) | C4 各ドメインの 3 レーンレビュー | Domain A/B/C/D とも spec/design/test の 3 レーン PASS(blocking ゼロ。non-blocking は Domain E で回収 or follow-up 記録。2026-07-11) |
| [waves/c5/](waves/c5/) | C5 各ドメインの実装レポート + follow-up | Domain A(スロット曲線状態機械・実効値フィードバック案B・release一般化400ms、loop2で連続性性質テスト網羅)/ B(契約 `intent.envelope` additive・dispatch・参照ドライバ拡張・持続駆動11相)/ C(Stage Presence 入力を合成後 `resolvedActivations` へ差し替え)/ D(最終統合・モノレポ検証・無変更確認・docs整合・人間ゲート手順)完了(2026-07-11)。[c5-followup.md](waves/c5/c5-followup.md) に持ち越し4件を記録。**実装完了・機械ゲート緑・人間ゲート待ち**(CLOSURE 判定は人間ゲート後に L0) |
| [reviews/c5/](reviews/c5/) | C5 各ドメインの 3 レーンレビュー | Domain A(loop2 test-adequacy 追補込み)/ B / C とも spec/design/test の 3 レーン合格(blocking ゼロ。2026-07-11) |

実装報告・レビューは着手時に `waves/` / `reviews/` を切って収める(runtime-player方式)。

## 次の行動

1. **C1 = 完全閉鎖(2026-07-10)**: パッケージ版手動ゲート全項目合格(ユーザー実施)+§14裁定済み。
2. **C2「身体が呼吸する(まばたき)」= 完全閉鎖(2026-07-11)**: 実装+3レーンレビュー全PASS+手動美的ゲート合格(瞬きに違和感なし・OBS Browser Source確認・トラッキングとの二体非干渉確認)。
3. **C3「視線と頭が生きる」= 完全閉鎖(2026-07-11)**: Domain A→B→C→D→E+追撃F(キャプション・Stage Presence知覚性)完了、レビュー全PASS、手動ゲート合格(30秒判定・ツマミ即時反映・プロファイル復元・トラッキング退行なし・OBS parity・キャプション・Stage Presence on/off差)。
4. **C4「外から動かせる(操縦チャネルv0)」= 完全閉鎖(2026-07-11)**: 実装+レビュー全PASS+一目確認合格。特区 `apps/soul` 稼働(参照ドライバ+方向ルール検査)。持ち越し: Stage Presence×チャネル結合の裁定([waves/c4/c4-followup.md](waves/c4/c4-followup.md) ⚠)+v0繰延5件。
5. **C5「合成が正しい」= 完全閉鎖(2026-07-11)**: Domain A→B→C→D+追撃G(set既定ease-in 100ms+知覚シナリオ)完了、レビュー全合格、**人間ゲート合格**(再ゲートで「滑らかに動く」——立ち上がり・符号反転re-attack・魂殺し・dip再観察の4点全クリア)。decay意味論は現状維持で確定。教訓: 人間ゲートの証人シナリオは機械テストの圧縮シナリオと別に知覚のために設計する。
6. **C6「口が話せる」= 完全閉鎖(2026-07-12)**: 本編+統合追撃(Articulationスライダー=四層のプロファイル補正層へ昇格)+ホットフィックス、比較ゲート合格(「完璧だ」)。教訓は[orchestration/c6-wave-plan.md](orchestration/c6-wave-plan.md) Status。
7'. **C7「配信に乗る」= 完全閉鎖(2026-07-12)**: wave なし・実装ゼロの検証のみで閉鎖(C2〜C6でparityをblocking基準にし続けた投資の回収)。OBS二体並走ゲート合格(ユーザー側=フェイストラッキング、AI側=生理。C4〜C6駆動もOBS目視済み)。既知制限=二体同時起動の負荷(未計測・性能改善はスコープ外裁定)→ [orchestration/c7-closure-record.md](orchestration/c7-closure-record.md)。**これでC1〜C7全閉鎖=器の完成**。
7. **前提討議①②クローズ+S系列分解Accepted(2026-07-12)**: ①主経路=Max 20x+Agent SDK([../soul/llm-access-path.md](../soul/llm-access-path.md)) ②会話パイプラインAccepted昇格。分解は [s-series-decomposition.md](s-series-decomposition.md)(S1〜S9、視覚=S5を新設、persona はS8後→S9相槌)。
8. **S1「一文が縦に貫通する」= 完全閉鎖(2026-07-12)**: 魂の初代 `apps/soul/agent/`(独立npm・lockfile不変)。モーラ写像(均等割り・実長追従)→TTS→常駐再生→チャネル→SDK常駐(サブスクOAuth実証・APIキーガード)。レビュー9レーン全PASS・機械ゲート全緑・**人間ゲート合格(「完璧だ、声が答え、口が合っている」)**。`experiments/` 開設(初回計測: 常駐初期化≈1.9s・warm ask≈3.2s・synthesis≈1.1s)。獲得事実: 合成尺は非決定論。9. **S2「耳が生える」= 完全閉鎖(2026-07-12)**: ffmpeg→Silero VAD(魂内・イベント一級市民)→whisper-server(kotoba q5_0・CPU)→転写バッファ正本+ears-cli。レビュー9レーン全PASS・196/196緑・**人間ゲート合格(「完璧だ」・OBS同時キャプチャ問題なし)**。縦貫通レイテンシ1.5〜1.8s(有界チューニングで6.7sから)。獲得事実: Silero v5=576入力の致命バグ回収・転写は完璧でない(S3品質前提)。**S2.5「操縦席がある」= 完全閉鎖(2026-07-12)**: 魂のローカルWebコクピット(SSE・127.0.0.1限定・新規依存ゼロ)。CLIレス運転+ゴースト行の観測性。追撃F(長尺転写消失: -nfa既定・機構未確定は正直に記録・再発時の集中wave条件を残置)込みで人間ゲート合格(「完璧だ」)。
10. **魂の器官構造化 = 完了(2026-07-12)**: `src/{ears,voice,mind,channel,cockpit,cli,test-support}/` へ51ファイルをgit mv(import書き換え20+深さ補正7)、**231/231無退行**・preflight PASS・lockfile不変。注: 委任先Orch2代が環境異常(子のツール実行が中断される)で停止したため、ユーザー承認の上**L0が直接実施**した例外(記録と環境異常の申し送り: [waves/s2.5/organ-restructure.md](waves/s2.5/organ-restructure.md))。**次の一手 = S3「呼べば応える」の議論→context-check**(論点予約: 発火キーの経路=グローバルホットキー問題、soul-cockpit.md §1)。
