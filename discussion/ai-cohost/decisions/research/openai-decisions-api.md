# OpenAI Decisions API — 公式事実と未確認事項

> 調査日: 2026-10-12。主出典は公式ガイド <https://developers.openai.com/api/docs/guides/decisions>。報道は補助。

## 1. 公式事実

- `POST /v1/decisions`。モデルは `gpt-6-luna` のみ。2026-09-29 DevDay で限定プレビュー、2026-10-06 public beta。
- リクエスト: `model` / `input`(文字列、または `input_text`・`input_image` を含む user メッセージ配列) / `questions`。
- 問いの型(各問いに `name` と `instructions` が必須):
  - `predicate` — 命題が真である確率 `probability`。
  - `choice` — `choices: [{value, description}]` から1つ。応答は `choice`・`confidence`・`probabilities[{value, probability}]`。
  - `score` — 低→高の順序段階。確率加重平均の `score`・`confidence`・段階ごとの確率。
- 応答は `answers` 配列。拒否時は `{"type":"refusal","name":...}`。
- 画像は inline base64 data URL のみ(HTTP(S) URL・`file_id` 不可)。
- 独立な複数の問いは1リクエストで共有入力に対して評価できる。依存する判断は逐次リクエスト。
- 料金: 入力 $0.10 / 1M tokens。出力・キャッシュの課金なし。ZDR/HIPAA 対応(対象顧客)。
- 非対応: function calling 統合、構造化 JSON 生成(Structured Outputs の領分)。

## 2. 報道ベース(OpenAI 自己申告、第三者計測なし)

- 1判断 ≈150ms。同じ判断を通常の Luna 呼び出しで行うと ≈1.6s(約10倍)。
- 競合として TypeSafe Jev が先行している。

## 3. 課金境界(2026-10-12 確認)

- ChatGPT サブスクと API は別製品・別課金。Codex の ChatGPT サインインはサブスク枠で Codex を使えるが、一般の API エンドポイントへのアクセスは明記されていない。
- 2026-09-29 拡張の「Sign in with ChatGPT」は提携16社ツール向けで、自作スクリプトからサブスク枠で API を叩く経路ではない。Decisions API が対象かも不明。
- → 本トピックの実験は API キーによる従量課金が前提。

## 4. 未確認(公式ガイドに記載なし)

- choice の選択肢数上限、問い数上限、画像枚数・解像度・detail 指定、コンテキスト長、レート制限。
- 決定性(同一入力での答えの再現性)。→ 実験で観測する。
