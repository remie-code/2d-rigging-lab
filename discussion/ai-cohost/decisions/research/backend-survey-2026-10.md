# 判定バックエンドの候補調査(2026-10-16)

> 3体のサブエージェント(Sylph)による Web 調査の統合。【公式】【第三者】【自社主張】【まとめ】【推測】を分ける。うちら自身の実測は OpenAI Decisions API のみ([gaze-target/experiments/](../gaze-target/experiments/))。
>
> 動機(ユーザー 2026-10-16): Decisions API は「Codex のクレジットが流用できる」誤解から選んだ。前提が崩れたので、機能と費用で選び直したい。毎秒1回呼ぶと 1時間 3600回、3時間配信を月16回で判定1種あたり月 ≈$20 になり、無視できない。

## 1. 全体像

- 2026-09-15 の TypeSafe Jev 公開以降、同型の「判定特化 API」(入力 → 型付きの問い → 確率だけを返す。出力トークン無料)が9〜10月に集中リリース。Jev 互換 `/v1/systemone` と OpenAI 互換 `/v1/decisions` の2系統。
- 第三者の横並び評価として Artificial Analysis(AA)Decision Index(v1.0、2026-10-13)、akitaonrails のベンチ(テキストのみ、計測地不明)、jev-bench(Celeris 社が実施)がある。**画像付き・日本語・日本からの条件で計測された値は、どの候補にも見つからなかった。**
- まとめサイト(systemonemodels.org、benchlm.ai 等)は数値の食い違いが多い。【まとめ】の値は確度を下げて扱う。

## 2. 画像入力に対応したホスト型の判定 API

試算は 1回 1,200 入力トークン × 毎秒1回 × 1時間。実際の画像トークン数は各社の換算規則で前後する。

| 候補 | 状態 | 画像枚数 | 選択肢上限 | 入力 $/1M | $/時(試算) | レイテンシ | 日本語 | ベンチ |
|---|---|---|---|---|---|---|---|---|
| OpenAI Decisions(gpt-6-luna) | public beta | 上限未記載 | 未記載(144択は通過) | 0.10 | 0.43(実測トークンで計算) | **うちらの実測: 日本から 300〜650ms**。第三者 222ms(テキスト) | うちらの実験で機能 | akitaonrails 90.5%、jev-bench 69.0 |
| TypeSafe Jev 1.13 / 1.14 | 1.14 は preview。**画像は "Danger Zone" ヘッダ付きで本番非推奨**【公式】 | サイズで制限 | 255 | 0.042 | 0.18 | 公称 70〜500ms。AA 130ms。**日本から 160〜440ms(テキスト)**【第三者】 | 英語が最良、CJK は劣る【公式】 | AA Decision Index 58(10/13 時点、判定モデル中1位)、akitaonrails 97.6% |
| Celeris-1 Decision | 公開(10/08)、クローズド | 8 | 512 | 0.04 | 0.17 | 自社 67ms、AA 60ms(最速) | 記載なし | jev-bench 80.0【自社】 |
| Liquid d1 / d1-ultra | 公開(ultra は 10/15) | 8。**問いごとに全画像を課金** | 未記載 | 0.04 / 0.042 | 0.17〜(問い数に比例) | d1: AA 299ms | ultra「44言語」(日本語か未確認) | d1-ultra は AA 65 で1位と主張【自社】、d1 は AA 50.3 |
| Inception Mercury Decide | 公開 | 16 | 255 | 0.02 | 0.09 | AA 500ms | 記載なし | 較正誤差が最悪の 0.211【まとめ】 |
| Cloudflare Clef-flash(9B) | 状態の記載なし。**重み公開(Apache 2.0)** | 4 | 未記載 | 0.038 | 0.16 | 自社 38.8ms(H200)、第三者 394ms | 未確認 | akitaonrails 87.5% |
| Cloudflare Clef(27B) | 同上 | 4 | 未記載 | 0.24 | 1.04 | 自社 209ms、第三者 302ms | 未確認 | akitaonrails 95.8% |
| Cloudflare Clef-omni(30B-A3B) | 同上(10/09) | 4。**音声4本・動画2本(各60秒)も可** | 未記載 | 0.15 | 0.65 | 未確認 | 未確認 | — |
| Perplexity pplx-decider v1.1(27B) | 公開(10/06)。重み公開 | 上限未記載 | 255 | 0.02 | 0.09 | **公式で「小入力でも2秒未満」** | 記載なし | ローカル版 akitaonrails 99.4%。10/13 に「確率がほぼ一様になる」不具合報告 |

## 3. テキストのみの判定 API(文字起こしだけで判定する用途向け)

Microsoft-Decision-1($0.042、AA 207ms、英語向け)、Upstage Solar Decide(choice 最大26)、Fastino GLiDE、meraGPT Decider 1(choice 最大10)、Hanzo Kai、Together Tev1-4B など。大半は【まとめ】経由で、公式は未確認。

## 4. 汎用 LLM に確率を出させる方式

| モデル | 入力/出力 $/1M | 確率(logprobs) | 思考を切れるか | TTFT(AA) | 備考 |
|---|---|---|---|---|---|
| gpt-6-luna(Chat Completions) | 0.10 / 0.50 | ○(`reasoning_effort: none` のときのみ。画像と併用できるかは未確認) | ○ | 0.72〜0.93s | 日本の推論リージョンなし |
| Claude Haiku 5.5 | 0.10 / 0.50 | **×(API になし)** | ○ | low 6.33s | temperature は 1 固定 |
| Gemini 3.5 / 3.1 Flash-Lite | 0.30 / 2.50 等 | **調査間で食い違い**(フォーラム「3.X では返らない」/ Vertex ブログ「enum と併用可」) | minimal(完全には切れない) | 7.06s(思考込み) | Vertex に東京リージョンあり |
| qwen3.8-flash | 0.113 / 0.382(東京) | 未確認 | 未確認 | 2.05s | 東京リージョンあり |
| deepseek-flash | 0.15 / 0.60(オフピーク) | 引数あり | ○ | 1.15s | enum 制約なし。日本リージョンなし |

- 判定特化 API と比べると、どれも遅いか(秒単位)、確率が取れないか、出力課金が乗る。

## 5. ローカル実行(配信 PC)

- **判定モデルの重み公開**: Clef-flash 9B / Clef 27B / pplx-decider 27B(いずれも Apache 2.0)。ホスト版とローカル版でラベルが食い違う報告あり(Clef、504件中19件)。
- **小型の画像対応モデル**(4bit の VRAM 目安): Qwen3.5-2B(4.2GB) / 4B(5.9GB、KV キャッシュで膨らむ) / 9B、Gemma 4 E2B(4GB) / E4B(6GB) / 12B(7〜8GB)、LFM2.5-VL-3B(約3GB、日本語を含む16言語、推論しないモデル)、LLM-jp-4-VL-9B(日本語特化)。
- **確率の取り出し**: llama.cpp(llama-server)と Ollama(v0.12.11 以降)は logprobs と JSON スキーマ制約に公式対応し、Windows でネイティブに動く。vLLM は WSL2 が前提。
- **空白**: RTX 系 GPU で「画像1枚+短文 → 数トークン」のレイテンシ実測、ゲームと同居したときの影響は、公開情報に見つからなかった。VRAM が足りないと共有メモリへ逃げて大幅に遅くなる(Windows の NVIDIA ドライバ設定)という注意あり。
- 費用は API 0(電気代のみ)。

## 6. 月額の目安(判定1種、3時間配信×月16回=48時間、毎秒1回)【推測】

Decisions ≈$20.6 / Jev ≈$8.6 / Celeris ≈$8.2 / Clef-flash ≈$7.7 / Mercury・pplx-decider ≈$4.3 / ローカル $0。複数画像を渡す判定(反応判定)は枚数に比例して増える。

## 7. 訂正

- 「Decisions API の公称 ≈150ms」は報道由来で、OpenAI の公式ガイドでは確認できない([openai-decisions-api.md](openai-decisions-api.md) §2 で既に報道扱い)。

## 8. 未確認

- 画像付き・日本語・日本からの各候補の遅延と精度(自前で計測するしかない)。
- 各社の画像トークン換算式(Jev は「近日公開」)。
- OpenRouter 等のゲートウェイ経由で画像入力が通るか。
- ローカル実行時の遅延とゲームへの影響(配信 PC の GPU 次第)。

## 主な出典

- 判定 API: https://docs.typesafe.ai/models 、https://typesafe.ai/blog/jev-1-14 、https://docs.typesafe.ai/go/images 、https://celeris.ai/celeris-1-decision 、https://docs.celeris.ai/decisions 、https://docs.liquid.ai/lfm/models/d1 、https://www.liquid.ai/blog/d1-ultra 、https://docs.inceptionlabs.ai/capabilities/decisions 、https://developers.cloudflare.com/workers-ai/models/clef-flash/ 、https://developers.cloudflare.com/workers-ai/models/clef-omni/ 、https://docs.perplexity.ai/docs/decisions/quickstart
- 第三者計測: https://artificialanalysis.ai/articles/artificial-analysis-decision-index 、https://akitaonrails.com/en/2026/10/10/which-jev-like-ai-decision-classifier-model-is-best/ 、https://agi-labo.com/articles/n746a127b4074 、https://zenn.dev/acrosstudioblog/articles/a62c066d5d9938
- 汎用 LLM: https://developers.openai.com/api/docs/guides/latest-model 、https://platform.claude.com/docs/en/build-with-claude/vision 、https://ai.google.dev/gemini-api/docs/gemini-3 、https://discuss.ai.google.dev/t/missing-logprobs-support-in-the-newest-gemini-models-3-1-pro-3-6-flash-on-vertex-ai-and-ai-studio/176557 、https://developers.googleblog.com/unlock-gemini-reasoning-with-logprobs-on-vertex-ai/ 、https://artificialanalysis.ai/leaderboards/models
- ローカル: https://huggingface.co/Qwen/Qwen3.5-4B 、https://huggingface.co/google/gemma-4-E4B-it 、https://huggingface.co/LiquidAI/LFM2.5-VL-3B 、https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md 、https://docs.ollama.com/api/chat
