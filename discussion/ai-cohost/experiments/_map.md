# AI Cohost Experiments Map

- 資産の配置・Git管理: [モデルと演技の構成管理規約](../../model-authoring/asset-versioning-policy.md)（2026-11-14合意。再現できる動画・フレーム列等は追跡しない）。

> AI Cohostの実サービス・実器・会話経路を用いた観測記録の入口。各ファイルの事実、推論、未確認事項を混同しない。

| Path | Scope | Status |
|---|---|---|
| [surprise-nuances-astra-62/README.md](surprise-nuances-astra-62/README.md) | 実発話に合わせて、目を留める・追う・引く・寄る・笑うの五面比較と個別演技を作成 | 新作4本も採用・登録。ゲーム画面・視聴者向けの驚きは計5種 |
| [motion-library-astra-62/README.md](motion-library-astra-62/README.md) | 登録済みの全28本を同一モデル・台詞でGPT-6 Astraと6.2 Astraの左右比較にまとめる | 全28本を本人採用。配布定義・現用スロットに配置済み |
| [smile-astra-62/README.md](smile-astra-62/README.md) | 相方向けの「嬉しさが弾む」「照れながら笑う」で、GPT-6 Astraと6.2 Astraを同じ代表発話で左右比較 | 全28本の比較後に採用・配置済み |
| [game-curiosity-astra-62/README.md](game-curiosity-astra-62/README.md) | 丸い仕掛けを見つける発話でGPT-6 Astraの登録版と6.2 Astraの新作を同期比較 | 全28本の比較後に採用・配置済み |
| [speech-motion-wry-nuances-v1/README.md](speech-motion-wry-nuances-v1/README.md) | 既存の苦笑表情で、登録済み「やれやれ」を基準に同調・報われなさ・茶化し・自分への苦笑・柔らかな限界説明を6面比較。原発話・再現定義を保存 | 2026-11-16本人採用。①を保持し②〜⑥を正面のgame/viewers共用で[登録・配置済み](../implementation/waves/wry-nuances-registration/completion.md)。相方版未制作、実会話未確認 |
| [speech-motion-shy-aversion-v2/README.md](speech-motion-shy-aversion-v2/README.md) | 照れ笑い原案と「相手から一度顔をそらして戻る」改訂の左右比較。既存表情・瞳固定のまま研究を参考に順序を変更 | 2026-11-16本人が改訂を採用。相方向け笑み5案の一つとして[登録済み](../implementation/waves/smile-nuances-registration/completion.md)、実会話未確認 |
| [speech-motion-smile-nuances-v1/README.md](speech-motion-smile-nuances-v1/README.md) | 既存笑顔で「柔らかい微笑み・弾む喜び・照れ・得意・息を抜いてから微笑む」の5案を同期比較。相方向き統一・Stage固定、再現定義を保存 | 2026-11-16本人採用。照れだけ改訂v2に差し替え、相方向け5案を[登録済み](../implementation/waves/smile-nuances-registration/completion.md)。原試作を保持 |
| [speech-motion-search-nuances-v1/README.md](speech-motion-search-nuances-v1/README.md) | 「探す・確かめる」6ニュアンスの試作。画面向け、Stageなし、同じモデルで3×2同期比較と個別動画。再現定義・手順を保存 | 本人が六案を採用。11月16日、ゲーム画面向けに[登録・配布済み](../implementation/waves/search-nuances-registration/completion.md)。次回起動から有効、実会話は未確認 |
| [speech-motion-nod-comparison-v1/README.md](speech-motion-nod-comparison-v1/README.md) | 登録済み「受け取る」と「腑に落ちる」試作を同じモデル・縮尺で左右比較。定義時刻を揃え、受領の接続用lead-inのみ除外 | 2026-11-15比較提示。動きと間の本人評価待ち、製品変更なし |
| [speech-motion-understanding-nod-v1/README.md](speech-motion-understanding-nod-v1/README.md) | ゲーム画面を正面に見て、理解の間から一度うなずく演技。Stageなし、大小表示の無音動画と再現手順 | 2026-11-15本人採用。外部資産の `understanding-nod × game` に登録し、現用スロットに配置済み。次回Player起動から有効、実会話は未確認 |
| [speech-motion-game-curiosity-stage-comparison-v1/README.md](speech-motion-game-curiosity-stage-comparison-v1/README.md) | 好奇心試作のStageだけをなし・25%・50%・元の強さで同期比較。再現定義を保存、動画/PNGはtmp | 2026-11-15本人がB（25%）を採用。外部資産の `interest × game` に登録し、現用スロットに配置済み。次回Player起動から有効、実会話は未確認 |
| [speech-motion-game-curiosity-v1/README.md](speech-motion-game-curiosity-v1/README.md) | 正面の対象へ少し寄り、小さく首を傾けて見る間を置く好奇心の試作。定義・再現手順を保存、動画/PNGはtmp | 元のStage強度の試作を保存。2026-11-15に強度比較のBを採用 |
| [game-interest-classification-2026-11-14.md](game-interest-classification-2026-11-14.md) | 今回のinterest×game未制作112件を、元意図・発話から8つの働きへ手動分類。全ID/hashを併記 | 好奇心20、納得18、確認16など。分類は仮説、最初の一本は相談中。Decision変更・カバー率推定ではない |
| [speech-motion-wry-headshake-v1/README.md](speech-motion-wry-headshake-v1/README.md) | 採用済み苦笑r843で小さく首を振る。正面の画面/視聴者共通版 | 2026-11-13本人採用。外部資産として登録・現用r844と通常版/portableへ配布済み。試作原本を保持、11/14本人が笑み・困り顔の実運用動作を確認 |
| [speech-motion-startled-recoil-v1/README.md](speech-motion-startled-recoil-v1/README.md) | 正面へ驚いて思わず身を引く。元パーツの表情と頭の反応・Stage奥行きの時間差 | 2026-11-13本人採用・r840登録配布済み。画面/視聴者共用。試作Stage実出力を製品へ接続、実会話確認待ち |
| [speech-motion-coverage-2026-11-12.md](speech-motion-coverage-2026-11-12.md) | 元の未対応228区間を現行5演技・9組へ照合。記録別判定、主15系統、次の制作候補 | 分析見積もり（2026-11-12）：十分に合う10、近接込み16、既存再候補込み22。Decision再判定・実配信の対応率ではない |
| [speech-motion-shared-laughter-partner-v1.md](speech-motion-shared-laughter-partner-v1.md) | 画面左の相方へ向きながら一緒に笑う。瞳固定と二拍の弾み | 本人採用・r825製品登録済み（2026-11-12）。配布確認合格、実会話待ち |
| [speech-motion-shared-laughter-v1.md](speech-motion-shared-laughter-v1.md) | r824の閉眼笑顔で一緒に笑う。二拍の弾みと収まり、瞳固定v2へのリンク | v2本人採用、視聴者・画面向け共用でr825へ製品登録済み（2026-11-12）。実会話待ち |
| [speech-motion-brief-relief-variants-v1.md](speech-motion-brief-relief-variants-v1.md) | Astra制作の「短く息を抜く」3案。ゲーム＝正面、相方＝画面左、視聴者＝上。正面開始・滑らかなStage Y復帰 | 3案ユーザー採用、保存再現済み。製品接続のcontext-check完了(2026-11-12)、本番未登録 |
| [speech-motion-relief-v1.md](speech-motion-relief-v1.md) | 笑みを追加せず、頭・上体の緩みとステージ上下あり／なしで安堵を比較 | 上下ありを基本採用(2026-11-11)。終盤復帰と初期向きに修正要望。演技×注意対象の議論へ戻り、本番未登録 |
| [speech-motion-interest-v1.md](speech-motion-interest-v1.md) | 眉を使わず、視線→顔・体の向き直りと保持で「ここに関心がある」を試作 | 試作(2026-11-10)。相手を正面とする仮配置、ユーザー評価・音声同期は未確認 |
| [speech-motion-received-v1.md](speech-motion-received-v1.md) | astra-chan実モデルで「受け取った」の小さなうなずきをGIF化。実験の意図・確認範囲 | ユーザー高評価・保存依頼(2026-11-10)。音声同期・製品導入は未実施 |
| [speech-motion-received-v1/](speech-motion-received-v1/_map.md) | 評価済みGIF、独立した動作定義、生成スクリプト、モデル識別情報と再現手順 | Saved(2026-11-10)。モデル本体は外部参照 |
| [s1-first-light.md](s1-first-light.md) | LLM→AivisSpeech→timelineの初回実測 | Completed |
| [s2-ears.md](s2-ears.md) | 耳・転写経路の実測 | Completed |
| [s3-summon.md](s3-summon.md) | Fire→音声応答の初期実測 | Completed |
| [s4-expressions.md](s4-expressions.md) | 表情タグ・演出経路の実測 | Completed |
| [s5-vision.md](s5-vision.md) | vision captureと画像付きLLMの実測 | Completed |
| [s6-conversation.md](s6-conversation.md) | 会話継続・発火の実測 | Completed |
| [name-prompt.md](name-prompt.md) | 呼び名promptの実測 | Completed |
| [brain-swap-terra.md](brain-swap-terra.md) | Codex Terraのbrain切替・速度・reasoning実測 | Completed |
| [codex-streaming-sentence-probe.md](codex-streaming-sentence-probe.md) | GPT-5.6 Sol + visionで`item.updated`から安全な文chunkを早期取得できるかのbounded probe | Completed — observed SDK pathでは早期textなし (2026-08-30) |
| [codex-app-server-streaming-probe.md](codex-app-server-streaming-probe.md) | 同梱Codex App Server + Sol + vision + effort `low`でagent text deltaと安全な第一文の先行時間を実測 | Completed — lossless Run 2で450 delta、第一文9.109秒先行 (2026-08-30) |
| [discord-receive-probe.md](discord-receive-probe.md) | Discord の Bot が VC で 1 人の声を受け取れるかを数だけで確かめた試し(discord-vc の第一歩) | Completed — 合格。入った直後の最初の発言だけ頭が欠ける。#11653 は起きず (2026-10-31) |

## Current Result

- SDK 0.144.5 / GPT-5.6 Sol / effort `none` / vision付き1ターンでは、`agent_message`は`item.completed`の1件だけだった。
- 最初の安全な日本語文境界も`item.completed`と同時であり、先行時間は0 msだった。
- 同じ同梱CLI 0.144.5のApp Server経路では、Sol / effort `low` / vision付きRunで450件の`item/agentMessage/delta`をlossless収集し、連結結果はcompleted textと完全一致した。
- App Server Run 2の最初の安全な日本語文境界は`item/completed`より9.109秒先行したため、LLM完了前に文chunk queueを開始できる実測証拠が得られた。
- 実アカウントのApp Server `model/list`ではSolの`none`は非対応で、`low`が最小だった。1サンプルのため一般的な性能差は未確定。
