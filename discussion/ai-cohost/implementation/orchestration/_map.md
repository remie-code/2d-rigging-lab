# AI Cohost Orchestration Map

> ai-cohost実装waveの計画とplanning gate成果物。

| Path | Status | Content |
|---|---|---|
| [c1-planning-inventory.md](c1-planning-inventory.md) | 完了(2026-07-10)。Verdict needs_design → ユーザー裁定で解消 | C1のコード接地棚卸し(合成ルート、userData DI、port/token、UDP、ライフサイクル、テスト流儀) |
| [c1-wave-plan.md](c1-wave-plan.md) | **完全閉鎖(2026-07-10)**: 実装+3レーンレビューPASS+パッケージ版手動ゲート全項目合格+§14裁定済み | C1「二体が同居できる」wave計画: スロット基盤(Domain A)→役割合成と身元表示(Domain B)→最終統合(Domain C)。既知制限: dev引数なし起動(Status参照) |
| [c2-planning-inventory.md](c2-planning-inventory.md) | 完了(2026-07-10)。Verdict needs_design → ユーザー裁定5件で解消 | C2のコード接地棚卸し(頭無し写像の可否、素の既定の挙動、意味スロット受け口の構造ギャップ、フレーム心臓の空白、決定論流儀) |
| [c2-wave-plan.md](c2-wave-plan.md) | **完全閉鎖(2026-07-11)**: 実装+3レーンレビュー全PASS+手動美的ゲート合格(瞬きに違和感なし・OBS確認・二体非干渉) | C2「身体が呼吸する(まばたき)」wave計画: 頭無しリゾルバ(A)→生成器骨格(B)→フレーム心臓と統合(C)→最終統合(D)。単一Orch-Sylph順次。実装報告 [../waves/c2/](../waves/c2/)、レビュー [../reviews/c2/](../reviews/c2/) |
| [c3-planning-inventory.md](c3-planning-inventory.md) | 完了(2026-07-11)。Verdict needs_design → ユーザー裁定8件で解消 | C3のコード接地棚卸し(生成器拡張適合性、連続系スロット既定、body平滑交差、永続化テンプレ、ツマミ即時反映の口の不在=主コスト、quick toggle実体、fixture配分) |
| [c3-wave-plan.md](c3-wave-plan.md) | **完全閉鎖(2026-07-11)**: 実装+レビュー全PASS+追撃(§12 Domain F)+手動再ゲート合格(キャプション・Stage Presence知覚性) | C3「視線と頭が生きる」wave計画: ノイズ/バネ基盤+即時反映seam(A)→振る舞いクラス3種+結合(B)→Physiologyページ+プロファイル(C)→Stage Presence(D)→最終統合(E)→追撃(F)。実装報告 [../waves/c3/](../waves/c3/)、レビュー [../reviews/c3/](../reviews/c3/)。既知baseline fail=Wave21 browser-source(C3対象外) |
| [c4-planning-inventory.md](c4-planning-inventory.md) | 完了(2026-07-11)。Verdict needs_design → ユーザー裁定9件で解消 | C4のコード接地棚卸し(WSサーバ複製、オーバーレイ挿入点、第二ポート、診断bridge、特区の物理コスト=lockfile問題、拒否列挙土台、degraded対象)。**check:depsのDAG検証は存在しないという事実誤認を発見**(憲章§6訂正の契機) |
| [c4-wave-plan.md](c4-wave-plan.md) | **完全閉鎖(2026-07-11)**: 実装+レビュー全PASS(blocking 2件はwave内充足)+一目確認合格。持ち越しのStage結合裁定はC5設計討議で解消済み | C4「外から動かせる」wave計画: 契約の家+チャネルサーバ(A)→オーバーレイprovider(B)→Channelページ+degraded解消(C)→特区+参照ドライバ+方向ルール検査(D)→最終統合(E)。RTT実測 p95≈1.5〜2ms |
| [c5-planning-inventory.md](c5-planning-inventory.md) | 完了(2026-07-11)。Verdict needs_design → ユーザー裁定4件で解消(設計討議§7) | C5のコード接地棚卸し(オーバーレイstoreの曲線化=主コスト、実効値経路、release一般化、Stage差し替え、契約追加、fixture形。曲線数学=C3 blinkの写経、新サブシステム無し) |
| [c5-wave-plan.md](c5-wave-plan.md) | **完全閉鎖(2026-07-11)**: 実装+レビュー全合格+人間ゲート合格(第一回不合格→診断→追撃G=set ease-in+知覚シナリオ→再ゲート4点全クリア「滑らかに動く」) | C5「合成が正しい」wave計画: 曲線状態機械(A)→契約+ドライバ(B)→Stage実効値化(C)→統合(D)→追撃(G)。教訓: 人間ゲートの証人シナリオは知覚のために設計する(§12) |
| [c5-choppiness-investigation.md](c5-choppiness-investigation.md) | 完了(2026-07-11) | 人間ゲート第一回不合格の診断: 曲線機械シロ(実波形計測)、原因=setの即ステップ(設計の自己矛盾)+証人シナリオのテスト用圧縮値 |
| [c6-planning-inventory.md](c6-planning-inventory.md) | 完了(2026-07-11)。Verdict needs_design → ユーザー裁定7件で解消(設計討議§7) | C6のコード接地棚卸し(C5前方互換は外周のみ真、新規=口グループ・タイムライン評価器、母音経路はC5開通済み、生理は口を産まない、初の可変長payload=上限観点) |
| [c6-wave-plan.md](c6-wave-plan.md) | **完全閉鎖(2026-07-12)**: 本編A/B/C+統合追撃E改(re-attack+Articulationスライダー)+ホットフィックスF、比較ゲート合格(「完璧だ」) | C6「口が話せる」wave計画: 口グループ・タイムライン評価器→契約intent.speech→統合→追撃(§12〜§13補遺に三代不成立インシデントと統合の経緯)。教訓: 証人シナリオは知覚のために/配線の存在≠疎通 |
| [c7-closure-record.md](c7-closure-record.md) | **完全閉鎖(2026-07-12)**: wave なし・実装ゼロの検証のみで閉鎖(唯一) | C7「配信に乗る」閉鎖記録: OBS二体並走ゲート合格(トラッキング+生理の本来姿・C4〜C6駆動もOBS目視済み)。既知制限=二体同時起動の負荷(未計測、render-performance/player-survey の未解決質問への初データ。性能改善はスコープ外裁定)。**C1〜C7全閉鎖=器の完成** |
| [s1-planning-inventory.md](s1-planning-inventory.md) | 完了(2026-07-12)。Verdict needs_design → ユーザー裁定2件で解消 | S1のコード接地+実機+外部一次情報の棚卸し(intent.speech意味論のt=0=受理時点、**AivisSpeech実機のモーラ長全零の発見=調査記録訂正**、Agent SDKサブスク認証の優先順位・常駐必須12秒問題、特区の依存の物理、再生手段) |
| [s1-wave-plan.md](s1-wave-plan.md) | **完全閉鎖(2026-07-12)**: 全ドメイン+レビュー9レーンPASS(blockingゼロ)+機械ゲート(soul 84/84・器925/925・packages 1492/1492・lockfile不変)+人間ゲート合格(「完璧だ、声が答え、口が合っている」) | S1「一文が縦に貫通する」wave計画: 特区パッケージ`apps/soul/agent/`(独立npm・.mjs+node:test)+モーラ写像純関数(A)→TTS+常駐再生+チャネル+同期(B)→SDK常駐統合+CLI+計測+experiments/開設(C)。獲得事実: 合成尺は非決定論/maxTurns:1×常駐両立/apiKeySource=none実証。follow-up 10項目([../waves/s1/s1-followup.md](../waves/s1/s1-followup.md)) |
| [s2-planning-inventory.md](s2-planning-inventory.md) | 完了(2026-07-12)。Verdict needs_design → ユーザー裁定4件で解消 | S2の外部実態+実機棚卸し(whisper.cpp v1.9.1公式zip=SDL2同梱・cli/serverはSilero VAD統合/streamは簡易のみ、kotoba公式ggml q5_0 538MB Apache2.0、実機=RTX 4070 SUPER・ffmpeg無し。裁定: 本命形(b)=ffmpeg→魂内VAD→whisper-server、sherpa不採用、比較ステップなし、診断はCLI) |
| [s2-wave-plan.md](s2-wave-plan.md) | **完全閉鎖(2026-07-12)**: 全ドメイン+レビュー9レーンPASS(blockingゼロ)+機械ゲート(196/196・縦貫通1.5s・3実行者独立再現)+人間ゲート合格(「完璧だ」・OBS同時キャプチャ問題なし) | S2「耳が生える」wave計画: 取り込み+VAD+セグメンタ(A)→whisper-serverクライアント+転写バッファ正本(B)→常時結線+CLI診断+有界チューニング(C)。獲得事実: Silero v5=576入力(致命バグを縦貫通で発見回収)/動的audio_ctxでwarm 6.7s→1.5s/転写は完璧でない(S3前提)。follow-up台帳([../waves/s2/s2-followup.md](../waves/s2/s2-followup.md)) |
| [s2-5-wave-plan.md](s2-5-wave-plan.md) | **完全閉鎖(2026-07-12)**: A/B+追撃F全PASS・231/231緑・人間ゲート合格(「完璧だ」・長尺再ゲート込み) | S2.5「操縦席がある」wave計画: cockpitサーバ+結線(A・SSE採用)→ページ本体(B)→追撃F(長尺転写消失: -nfa既定+ゴースト行。flash-attn犯人説は非再現=機構未確定を正直に記録)。教訓: 計測音源は本番経路と同形で |
| [s3-wave-plan.md](s3-wave-plan.md) | **計画確定(2026-07-12)・発進待ち**。棚卸しなし(Plan directly)。裁定5件(発火=Fireボタン+/api/fire+AHK同梱・注入=直近X分の会話ログ・魂発話の記録・最小仮面・busy時無視) | S3「呼べば応える」wave計画: 会話ログ+発火オーケストレーション(A)→操縦席拡張+AHK+計測(B)。人間ゲート=初の全器官同時稼働 |
