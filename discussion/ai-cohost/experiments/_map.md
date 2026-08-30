# AI Cohost Experiments Map

> AI Cohostの実サービス・実器・会話経路を用いた観測記録の入口。各ファイルの事実、推論、未確認事項を混同しない。

| Path | Scope | Status |
|---|---|---|
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

## Current Result

- SDK 0.144.5 / GPT-5.6 Sol / effort `none` / vision付き1ターンでは、`agent_message`は`item.completed`の1件だけだった。
- 最初の安全な日本語文境界も`item.completed`と同時であり、先行時間は0 msだった。
- 同じ同梱CLI 0.144.5のApp Server経路では、Sol / effort `low` / vision付きRunで450件の`item/agentMessage/delta`をlossless収集し、連結結果はcompleted textと完全一致した。
- App Server Run 2の最初の安全な日本語文境界は`item/completed`より9.109秒先行したため、LLM完了前に文chunk queueを開始できる実測証拠が得られた。
- 実アカウントのApp Server `model/list`ではSolの`none`は非対応で、`low`が最小だった。1サンプルのため一般的な性能差は未確定。
