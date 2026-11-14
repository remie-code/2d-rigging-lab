# AI Cohost Experiments Map

> AI Cohostの実サービス・実器・会話経路を用いた観測記録の入口。各ファイルの事実、推論、未確認事項を混同しない。

| Path | Scope | Status |
|---|---|---|
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
