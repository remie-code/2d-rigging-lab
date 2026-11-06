# AI Cohost Research Map

> `ai-cohost/research/` の地図。調査事実(出典付き)を保持する。仮説・設計判断は architecture/ に分離する。

## 咳払いが文字起こしに出る対処を辿る

「調査した」で止めず、次の順で読む(2026-11-06 確認)。

1. [音の分類の調査 §9](cough-filter-audio-tagging-2026-11.md): 1 人・1 回の実測。咳/咳払いのラベル確率は弱く、本物の「うーん」の Speech も低く出る。候補と測定の限界を確認する。
2. [段階 2 の計画 §1/§7](../implementation/orchestration/cough-filter-stage2-plan.md): 採用したのは「空白を除き 4 文字以下、Speech < 0.1」。Zipformer/Parakeet のローカル・Discord の耳が対象。A/B 合格・人のゲート合格・master マージ済み。ユーザーは本物の「うん」が入り、咳払いは弾かれ、札が出て体感遅延もないと報告した。ゲート結果は会場別・全チェック項目別には記録されていない。
3. 実装根拠は計画から [Domain A 報告](../implementation/waves/cough-filter-stage2/domain-a-report.md) / [レビュー](../implementation/reviews/cough-filter-stage2/domain-a.md)、[Domain B 報告](../implementation/waves/cough-filter-stage2/domain-b-report.md) / [レビュー](../implementation/reviews/cough-filter-stage2/domain-b.md) へ。札の消え方は時計の刻みで 8〜9 秒。すべての短い発話の無損失を確認した記録ではない。

## 調査記録

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
| [ears-capture-buffer-2026-10.md](ears-capture-buffer-2026-10.md) | 実測+リポジトリ事実: 耳の dshow 取り込みが既定で 500ms ずつ届き、speechStart/End が 0〜500ms 遅れる。50ms で解消 | Recorded(2026-10-16)。既定 50ms への修正は ElevenLabs 調査の一段落後に別セッションで |
| [quota-sources-2026-10.md](quota-sources-2026-10.md) | 各サービス(Codex / Claude / OpenAI API / ElevenLabs)の残量を割合で取る手段。OpenAI は残高 API なし、ElevenLabs は user_read が要る | Recorded(2026-10-17) |
| [vision-capture-latency-2026-10.md](vision-capture-latency-2026-10.md) | 画面キャプチャ約 0.6 秒の内訳(PowerShell 起動 330ms + 毎回のコンパイル 110ms)、代替方式。OBS 窓タイトルの完全一致で撮影が全部失敗していた疑い | Recorded(2026-10-17) |
| [context-growth-2026-10.md](context-growth-2026-10.md) | 長い配信で応答が遅くなる件: 会話の窓の重複・画像の残留・圧縮手段(Codex thread/compact/start、Claude /compact)・ユーザーの方針・Codex の fast と実配信の使用量(§10–§11) | Recorded(2026-10-28) |
| [codex-429-stall-2026-11-03.md](codex-429-stall-2026-11-03.md) | 2026-11-03 の配信で頭が 8 分前後止まり続けた件: OpenAI の 429 を Codex が次の 10 分の区切りまで黙って待っていた(Codex のログで確定)。11:27 から 10 分に約 5 回の枠。書き出し役も待たされ、最後の保存は入っていない見込み。KILL は効く。直しの候補 5 つ | Recorded(2026-11-03)。直しは見送り(ユーザー判断) |
| [codex-429-conditions-2026-11.md](codex-429-conditions-2026-11.md) | Codex が 429 を返す条件の調査(公式・ソース・報告)。5 時間・週の上限とは別物。10/20 以降 Plus・Pro で同じ形の報告多数(`turn_rate_limit_exceeded`)。条件の公式記述は無し。App Server は最初のやり直しを知らせない(待ち検知はクライアント側で)。§7: 10/14 以降 5〜7 日おきに報告が固まって出る(週 5〜6 件・横ばい・11/02 に山)。公式の認知なし | Recorded(2026-11-03) |
| [cough-filter-audio-tagging-2026-11.md](cough-filter-audio-tagging-2026-11.md) | 咳払いが「うん」などに化ける件の調査と §9 の実測。最初の咳ラベル案から Speech の低さに着目するまで | Recorded。後続は上の導線へ(段階 2 は実装・人のゲート合格・マージ済み 2026-11-06) |
| [cough-filter-stage2-inventory-2026-11.md](cough-filter-stage2-inventory-2026-11.md) | 本番の耳へ落としを入れる前の経路・境界・テストの棚卸し | 実装前の観測。現在の実装結果は段階 2 計画へ |
| [cough-drop-indicator-ui-2026-11.md](cough-drop-indicator-ui-2026-11.md) | 落としたことを知らせる札の置き場の候補 | 採用は候補 A。実装・人のゲート結果は段階 2 計画へ |
| [stt-candidates-2026-10.md](stt-candidates-2026-10.md) | 耳(STT)の候補の洗い出し。ローカル化が動機(ElevenLabs の消費のほぼ全部が文字起こし)。本命は Parakeet-ja(sherpa-onnx-node・CPU)、比較に ReazonSpeech K2。「いろどり」は TTS(Irodori-TTS)だった。Zipformer を採用し、実配信で合格(§7) | Recorded(2026-10-28) |

## 注意

- 外部調査の内容は2026-07-10時点のスナップショットである。TTS/ASR/API料金は変動が速いため、実装着手時に主要な選定根拠(AivisSpeechの状況、料金)を再確認すること。
