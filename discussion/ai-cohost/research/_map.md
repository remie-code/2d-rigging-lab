# AI Cohost Research Map

> `ai-cohost/research/` の地図。調査事実(出典付き)を保持する。仮説・設計判断は architecture/ に分離する。

| Path | Content | Status |
|---|---|---|
| [gpt-6-astra-cli-compatibility-probe.md](gpt-6-astra-cli-compatibility-probe.md) | 隔離CLI 0.153.4でAstra low画像入力・同thread継続・deltaを実測 | Recorded(2026-09-08)。2ターン完了、最小対応版や意味的記憶品質の証明ではない。製品導入はimplementation計画へ |
| [gpt-6-astra-reasoning-inventory.md](gpt-6-astra-reasoning-inventory.md) | Astraの公式reasoning最小値low・画像入力、現行Codex App Server経路の確認範囲 | Recorded(2026-09-08)。実経路の追試は次項integration inventoryを参照 |
| [gpt-6-astra-integration-inventory.md](gpt-6-astra-integration-inventory.md) | Astra追加箇所・既存設定継承、同梱App Serverでの一覧照会と直接指定turnの実測 | Recorded(2026-09-08)。CLI 0.144.5は直接turnを新しいCodex版が必要として400拒否。対応版とvision/delta成功は未確認 |
| [aituber-landscape-2026-07.md](aituber-landscape-2026-07.md) | 外部技術地形(2026-07): 標準パイプライン、TTS/感情駆動/チャット取得の選択肢、運用の落とし穴 | Recorded(2026-07-10) |
| [human-ai-cohost-precedents.md](human-ai-cohost-precedents.md) | 人間×自律AI共演配信の先例と成立性、ASR選択肢、音声ルーティング、共演特有の落とし穴 | Recorded(2026-07-10) |
| [runtime-player-input-integration.md](runtime-player-input-integration.md) | リポジトリ事実: runtime-player入力パイプラインの構造とAI入力の統合点 | Recorded(2026-07-10) |
| [llm-cost-estimate.md](llm-cost-estimate.md) | 会話ループのLLM費用試算(料金は2026-07時点) | Recorded(2026-07-10) |
| [gpt-live-impact-2026-07.md](gpt-live-impact-2026-07.md) | GPT-Live(OpenAI 2026-07-08発表)の調査とS2S不採用理由への影響判定(覆らない)、コモディティ化への戦略判断と監視条件 | Recorded+戦略判断Accepted(2026-07-10) |
| [stage-motion-for-autonomous-idle.md](stage-motion-for-autonomous-idle.md) | リポジトリ事実: Stage Motionの3層構造(純計算器はhead-less)、自律ホストでの不活性状態、生理駆動の継ぎ目候補比較(候補c推奨)とリスク | Recorded(2026-07-11)。裁定は [../architecture/c3-gaze-head-posture.md](../architecture/c3-gaze-head-posture.md) §5 |
| [codex-text-streaming-official-options-2026-08.md](codex-text-streaming-official-options-2026-08.md) | OpenAI公式資料: Codex SDK/App Server、Responses、Agents、Realtimeのtext delta・vision・会話継続・Sol・認証の比較 | Recorded(2026-08-30)。App Server実経路は [experiment](../experiments/codex-app-server-streaming-probe.md) で成立確認済み |
| [app-server-transport-integration-inventory.md](app-server-transport-integration-inventory.md) | リポジトリ事実: Codex SDK→App Server transport差し替え境界、session/settings/vision/cleanup/effort-low/test影響 | Recorded(2026-08-30)。設計判断前inventory |
| [streaming-speech-pipeline-inventory.md](streaming-speech-pipeline-inventory.md) | リポジトリ事実: Fire→TTS→timeline→audioの現行確定点、chunk queue seam、割り込み・部分成功・診断・test影響 | Recorded(2026-08-30)。partial-success意味論はuser decision待ち |

## 注意

- 外部調査の内容は2026-07-10時点のスナップショットである。TTS/ASR/API料金は変動が速いため、実装着手時に主要な選定根拠(AivisSpeechの状況、料金)を再確認すること。
