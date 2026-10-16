# ElevenLabs TTS の制御要素(2026-10-12 時点)

> サブエージェント(Sylph)が公式ドキュメント(docs の .md 版、API reference、changelog、料金ページ)を一次出典として調査した結果の要約。【公式】【コミュ】【推測】を分ける。実機での確認はしていない。

## 1. モデル【公式】

| model_id | 位置づけ | 日本語 | レイテンシ(推論のみ) | 使える経路 |
|---|---|---|---|---|
| `eleven_v4` | 最高品質・最も表情豊か(2026-09-28) | あり | 記載なし | Text to Dialogue HTTP、TTS HTTP |
| `eleven_v4_turbo` | v4 のリアルタイム版 | あり | 中央値 ≈100ms | Text to Dialogue WebSocket(1接続1 voice) |
| `eleven_v3` | 前世代 | あり | 記載なし | TTS HTTP、TTD HTTP |
| `eleven_v3_conversational` | v3 の低遅延版 | あり | ≈280ms | TTD WebSocket、Agents |
| `eleven_multilingual_v2` | 長尺で最も安定 | あり | 記載なし | TTS HTTP / WebSocket |
| `eleven_flash_v2_5` | 最速・安価 | あり | ≈75ms(北東アジアの WS TTFB 150〜200ms) | TTS HTTP / WebSocket |

- 2026-10-05: Agents の既定 TTS が `eleven_v4_turbo` に変更。
- ドキュメント間の食い違い(要実機確認): v4 を TTS convert で使えるか、`eleven_v4_turbo` を HTTP で使えるか、TTD WebSocket の対応モデル。

## 2. リクエスト単位のパラメータ【公式】

| voice_settings | 既定 | 値域 | 意味 | v4 |
|---|---|---|---|---|
| `stability` | 0.5 | 0〜1 | 低いほど感情の幅が広く、生成ごとのばらつきも増える | 可 |
| `similarity_boost` / `similarity` | 0.75 | 0〜1 | 元の声への忠実度 | 可 |
| `style` | 0 | 上限未確認 | 元話者のスタイルを誇張。「常に0推奨」 | 不可 |
| `speed` | 1.0 | 0.7〜1.2 | 話速 | 不可(v3 も) |
| `use_speaker_boost` | true | bool | 類似度を上げる | v3 不可 |

- そのほか: `language_code`、`seed`(決定性は保証されない)、`previous_text` / `next_text`(TTD は `previous_text` / `future_text` 各100文字)、発音辞書(最大3)、`apply_language_text_normalization`(日本語専用。遅延が大きく増える)。
- **TTD WebSocket(v4 Turbo)では voice_settings を最初のメッセージでしか送れない**。発話ごとに自由に変えられるのは実質テキスト側(タグ・句読点)。

## 3. テキスト内の制御【公式】

- 音声タグ(v4 / v4 Turbo / v3 / v3 Conversational): 角括弧で台詞の前後に置く。**固定の列挙ではなく自由記述**。複合記述や組み合わせも可。
  - 公式の分類と例: 感情 `[curious]` `[excited]` `[sad]` `[angry]` `[surprised]`、話し方 `[whispers]` `[shouts]`、非言語反応 `[laughs]` `[sighs]` `[clears throat]` `[chuckles]`、間 `[short pause]` `[long pause]`、効果音 `[applause]` `[explosion]` など。
  - 注意: v4 はタグを効果音として解釈することがある。声以外のタグ(`[standing]` 等)は禁止例。Agents の文脈では「タグはおおむね次の4〜5語に効く」。
- SSML `<break>`(最大3秒)は v2 / Flash のみ。v3 / v4 は句読点(`...`、ダッシュ)とタグで間を作る。
- ベストプラクティス: タグは声のキャラクターに合わせる。前後の文脈から感情を推定するため文脈づくりが鍵。Agents では system prompt にトーン規則を書き LLM にタグを出させる方式を推奨。

## 4. 日本語

- 【公式】日本語文中で英語タグが効くか、日本語でタグを書けるかの記載はない。
- 【推測】タグは自然言語の指示として解釈されるため英語タグ+日本語本文でも動く可能性はあるが、タグを読み上げてしまう、効果音と誤解釈される等のリスクは実機確認が要る。

## 5. 料金【公式】

- 1K 文字あたり: v4 $0.08(10/12 まで $0.022)、v4 Turbo $0.04(同 $0.011)、v3 $0.08、v3 Conversational $0.04、Multilingual v2 $0.08、Flash $0.04。
- プラン(月額): Free / Starter $6 / Creator $22 / Pro $99 / Scale $299 / Business $990 ほか。

## 6. Decisions API に対応付ける素材(設計判断ではない)

- 離散: model_id、音声タグ(種類・付けるか・位置・組み合わせ)、間の手段、`language_code`、voice_id、TTD の `new_turn`。
- 連続: `stability`、`similarity`(v4 で使えるのはこの2つ。WebSocket では接続時のみ)。
- 現時点の見立て(ユーザー同意 2026-10-12): Decisions API で決める対象は音声タグが本命。タグ語彙は自由記述なので、こちらで決め打ちしてよい。

## 7. 未確認

`eleven_v4_turbo` の HTTP 利用可否 / TTD WebSocket の対応モデル / v4 で `style`・`speed` を送ったときの扱い / v3 の stability の現行値域 / `style` の上限 / 日本語文中のタグの効き / Director's Mode の詳細 / v4 同梱文字数の割引後の値。

主な出典: <https://elevenlabs.io/docs/overview/models>、<https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices>、<https://elevenlabs.io/docs/api-reference/text-to-speech/convert>、<https://elevenlabs.io/docs/api-reference/text-to-dialogue/ttd-websocket>、<https://elevenlabs.io/docs/changelog/2026/9/28>、<https://elevenlabs.io/pricing/api>
