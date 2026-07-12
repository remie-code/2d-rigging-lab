# AI Cohost Map

> ユーザー×自律AIの共演配信構想(ai-cohost)に関する外部記憶の入口地図。

## 1. Scope

ユーザー(自作モデル+フェイストラッキング)と、完全自律のAI(別モデルを自律駆動)が、二人で一緒に配信し、人間とAIの間で自然な音声会話が成立する状態を目指す構想。

当初MVP(Private Authoring-to-Viewer Prototype)の全達成後(2026-07-10 ユーザー宣言)の次期構想であり、既存資産(runtime-player、決定論ランタイム、リップシンク、Fable制作モデル)の上に載る。

Editor本体のauthoring UX、モデル制作そのもの(model-authoring)、Runtime Playerの既存機能はこのトピックの責務ではない。

## 2. Directory Map

| Path | Role | Status |
|---|---|---|
| [concept/](concept/) | 目標像、成功基準、非目標、4トラック/MVP境界との関係 | Created |
| [premises/](premises/) | ユーザー合意済みの前提・制約 | Created |
| [research/](research/) | 調査事実(外部技術地形、先例、内部統合点、費用試算) | Created |
| [architecture/](architecture/) | 設計方向・設計判断(会話パイプライン、操縦チャネル、生理層、モデルホスト) | Created |
| [implementation/](implementation/) | 実装フェーズの計画・実行成果物(runtime-player方式) | Created(2026-07-10)。閉問題分解C1〜C7まで。**C1〜C7 全て完全閉鎖(C1=2026-07-10、C2〜C5=2026-07-11、C6/C7=2026-07-12)=器の完成**。S1 Domain A/B/C 実装中 |
| [soul/](soul/) | S系列(魂の実装)の前提討議3件(①知性のアクセス経路 ②会話パイプライン最終化 ③persona) | Created(2026-07-12)。**①②裁定済みクローズ(同日)**: 主経路=Max 20x+Agent SDK/パイプラインAccepted昇格。③personaはS8後 |
| [experiments/](experiments/) | 魂の実測(枠消費・レイテンシ・会話品質)。S系列の常設計器 | **Created(2026-07-12、S1 Domain C)**。初回=[experiments/s1-first-light.md](experiments/s1-first-light.md)(tools:[]無効実証・apiKeySource=none・常駐初期化≈1.9s・warm ask~3.2s・synthesis~1s) |

AIのキャラクター・声・身体の設計を始める段階で `persona/` を、ユーザー合意のうえ追加する。

## 3. Reading Routes

- なぜやるのか・何ができたら成功かを確認する場合は [concept/](concept/) を読む。
- 決定済みの前提(LLM品質要件、費用前提、決定性境界)を確認する場合は [premises/](premises/) を読む。
- 技術的な裏付け(先例、選定材料、統合点)を確認する場合は [research/](research/) を読む。
- 設計の現在の方向と未決の分岐を確認する場合は [architecture/](architecture/) を読む。

## 4. Current State Summary

- 目標像・成功基準(「AIの間も含めてキャラの演出」)はユーザー合意済み(2026-07-10)。
- 実現可能性は調査で確認済み: 先例(Neuro-sama等)が商業水準で成立。会話LLMはOpus 4.8以上をユーザー決定、費用試算は月16配信で約$55〜110。
- **MVP境界の改定(案A)をAccepted(2026-07-10)、改定二号=特区憲章をAccepted(2026-07-11)**: 魂はリポジトリ内特区 `apps/<魂>` に住む(憲章6条: LLM・知覚は特区のみ/魂は契約のみimport/器は魂をimportしない=check:deps検証/決定論規律は特区非適用/秘密非コミット/特区のツールチェーンは自由)。特区外のLLM統合・知覚は引き続き禁止 → [concept/mvp-boundary-amendment.md](concept/mvp-boundary-amendment.md) §6。
- **振る舞いモデル(存在の解剖学)をAccepted(2026-07-10)**: 三層(生理/情動/知性)+一知覚、梯子(質感/単語/文)、演出エンベロープのパッケージ帰属 → [concept/behavior-model.md](concept/behavior-model.md)。
- **Runtime Player=モデルホスト、案(c)役割つき起動をAccepted(2026-07-10)**: 二役割(トラッキングホスト/自律ホスト)、起動UX(三つの扉)、生理自動/チャネル手動 → [architecture/runtime-player-model-host-roles.md](architecture/runtime-player-model-host-roles.md)。
- **会話パイプラインはAccepted(2026-07-12、S前提討議②)**: テキストパイプライン+二層設計「AIは全部聞くが全部では考えない」+知性のアクセスと文脈の器(Max 20x+Agent SDK・転写バッファが正)。出力側はC4〜C6契約へ接地済み。
- **C1 完全閉鎖(2026-07-10)**: 二役割の合成骨格(スロット基盤 / 役割合成 / 身元表示)を実装、3レーンレビュー PASS、回帰ゼロ、**パッケージ版手動ゲート全項目合格(ユーザー実施。二体同居・profile非混在・片方kill耐性・引数なしスタブ含む)**、上位判断7件裁定済み。既知制限: dev引数なし起動([implementation/orchestration/c1-wave-plan.md](implementation/orchestration/c1-wave-plan.md) Status)。
- **C2「身体が呼吸する(まばたき)」完全閉鎖(2026-07-11)**: 頭無しリゾルバの非破壊抽出(トラッキング経路も同一リゾルバ・等価性 golden)/ physiology 生成器骨格(Electron import ゼロ純関数・決定論 fixture)/ フレーム心臓(main 60Hz・autonomousHost composer 差し替え・実行時 role 分岐ゼロ)。機械ゲート green、3レーンレビュー全 PASS、**手動美的ゲート合格(ユーザー実施: 瞬きに違和感なし・OBS Browser Source 確認・トラッキングとの二体非干渉確認)**。普遍既定値の賭け(第一段の質感)は初戦勝利。
- **C3「視線と頭が生きる」完全閉鎖(2026-07-11)**: 決定論ノイズ/バネ基盤+ツマミ即時反映 config seam+blink 載せ替え(golden 不変)/ gaze・head・posture 振る舞い3種+結合3(目先頭後・大サッカード瞬き同期・体は頭の親)/ Physiology ページ+質感語スライダー(常時表示キャプション付き)+プロファイル永続化 / Stage Presence(姿勢連動、既定 Off、2乗ゲイン)。**手動ゲート全項目合格(ユーザー実施。追撃F=キャプション+知覚性ゲイン拡大を経て「完璧だ」)**。これで**器の生理層(C2+C3)は完成**——魂ゼロで、瞬き・視線・頭・姿勢が生き、ツマミで質感を調整できる。
- **C4「外から動かせる(操縦チャネルv0)」完全閉鎖(2026-07-11)**: 契約の家(純JSON schema+やり取り例+TS型)/ loopback WS+token の操縦チャネル(手動開閉・hello・request/reply・拒否列挙6件)/ 心臓tickへの粗いオーバーレイprovider(TTL失効・切断→生理基底復帰、physiology純度不変)/ Channelページ+自律版Overview+degraded 6面解消 / **魂の特区 `apps/soul` の最初の住人=依存ゼロ参照ドライバ** + 持続駆動テスト(RTT p95≈1.5〜2ms)/ **特区方向ルール検査2ルール**(違反fixtureで赤を実証、composite `check` に連結)。レビュー全PASS(blocking 2件=Header degradedテスト欠落・方向検査の多行import検出漏れ、いずれもwave内充足)、**人間の一目確認合格(ユーザー実施)**。持ち越し: **Stage Presence×チャネル結合の裁定(C5冒頭議題)**+v0繰延5件([implementation/waves/c4/c4-followup.md](implementation/waves/c4/c4-followup.md))。
- **C5「合成が正しい」完全閉鎖(2026-07-11)**: スロット曲線状態機械(set/envelope統合・set既定ease-in 100ms)・実効値フィードバック・動く基底へのrelease(400ms)・Stage Presence実効値追従。人間ゲート合格(第一回不合格→診断→追撃G→再ゲート「滑らかに動く」)。教訓: 証人シナリオは知覚のために設計する。
- **C6「口が話せる」完全閉鎖(2026-07-12)**: 口グループ・タイムライン評価器(凸恒等の構造保証)・intent.speech(モーラ列)・時間仮説+再調音ディップ→Articulationスライダー(四層のプロファイル補正層へ昇格)。比較ゲート合格(「完璧だ」)。教訓: 配線の存在≠疎通。
- **C7「配信に乗る」完全閉鎖(2026-07-12)**: **waveなし・実装ゼロの検証のみで閉鎖**。OBS二体並走ゲート合格(ユーザー側=フェイストラッキング、AI側=生理。C4〜C6駆動もOBS目視済み)。既知制限=二体同時起動の負荷(未計測、[render-performance/player-survey](../render-performance/player-survey.md)の未解決質問への初データ。性能改善はスコープ外裁定)→ [implementation/orchestration/c7-closure-record.md](implementation/orchestration/c7-closure-record.md)。**これでC1〜C7全閉鎖=器の完成**。

## 5. Next Actions

1. 実装は閉問題分解([implementation/closed-problem-decomposition.md](implementation/closed-problem-decomposition.md)、C1〜C7)に従う。進め方は一問題ずつ議論→実装→人間ゲート→完全閉鎖の直列(同§6)。**C1〜C4 は完全閉鎖(C1=2026-07-10、C2/C3/C4=2026-07-11)**。**C5「合成が正しい」も完全閉鎖(2026-07-11)**: スロット曲線状態機械(set/envelope統合+ease-in)・実効値フィードバック・動く基底へのrelease・Stage実効値追従。人間ゲート合格(「滑らかに動く」)。**C6「口が話せる」も完全閉鎖(2026-07-12)**: 口グループ・タイムライン評価器(凸恒等の構造保証)・intent.speech・時間仮説+再調音ディップ(Articulationスライダーでプロファイル補正層へ昇格)、比較ゲート合格([implementation/orchestration/c6-wave-plan.md](implementation/orchestration/c6-wave-plan.md))。**C7「配信に乗る」も完全閉鎖(2026-07-12、waveなし検証のみ)**: OBS二体並走ゲート合格([implementation/orchestration/c7-closure-record.md](implementation/orchestration/c7-closure-record.md))。**C1〜C7全閉鎖=器の完成**。魂の前提討議①②はクローズ、**S系列分解はAccepted(2026-07-12、[implementation/s-series-decomposition.md](implementation/s-series-decomposition.md)。S1〜S9・視覚=S5新設・留保付き)**。次の一手は **S1「一文が縦に貫通する」の議論→context-check**(着手と同時に `experiments/` 開設)。
2. persona/(存在の人格)を切る段階で、AIの身体のリグ要件を提示しmodel-authoringの既存手順で制作する。**「誰が作るか」は本トピックの設計事項ではない**(器はモデルの作者を知らない。ユーザー確認 2026-07-10)。

## 6. Unresolved Questions

| 項目 | 状態 |
|---|---|
| 成功基準「AIの間も演出」 | **Accepted(2026-07-10)** |
| MVP境界の明示変更 | **Accepted(案A、2026-07-10)** |
| 魂(オーケストレータ)の居場所(D1) | **改定: リポジトリ内特区 `apps/<魂>`(特区憲章6条、2026-07-11)**([concept/mvp-boundary-amendment.md](concept/mvp-boundary-amendment.md) §6。当初=別リポジトリ 案A) |
| アプリの形 | **解決: 案(c)役割つき起動(2026-07-10)** |
| プラットフォーム(D4) | **解決: YouTube(2026-07-10)** |
| 宛先判定の初手(D6) | **解決: キー操作から、実機ゲートを経て段階的自動化(2026-07-10)** |
| Variant切替のAI制御面包含(D7) | **解決: 当面対象外(2026-07-10)** |
| AIの身体(モデル)の制作者 | **本トピックの設計事項ではないと確認(2026-07-10)**。persona確定後にリグ要件を添えてmodel-authoring手順へ |
| 知覚の段階の具体化 / 情動層の状態語彙 / 第二段のFable検証方法 | 未決([concept/behavior-model.md](concept/behavior-model.md) §8。情動語彙は変調payloadの前提でもある) |
| **魂の知性のアクセス経路**(API従量 vs Max枠/Agent SDK) | 未決(魂の実装着手時に裁定)。Max枠なら費用前提P3が根底から変わるが、①常駐配信エージェントへのサブスク枠利用の規約適合 ②会話レイテンシ の検証が要る([architecture/c4-control-channel-v0.md](architecture/c4-control-channel-v0.md) §9) |
| 役割別userData分離・ポート割当の具体方式 | **解決: プロファイルスロット方式+スロットごと自動採番(2026-07-10)**([implementation/orchestration/c1-wave-plan.md](implementation/orchestration/c1-wave-plan.md) Status) |
| **監視条件(常設)**: S2S級応答+カスタムキャラ声+外部アバター同期面の三点が揃った製品の出現でS2S再評価 | 監視中([research/gpt-live-impact-2026-07.md](research/gpt-live-impact-2026-07.md) §4。GPT-Live/Gemini Liveは三点未達で採用転換なし) |
