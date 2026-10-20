# 各サービスの残量を割合で取る手段(2026-10-17)

> 操縦席に「意図せずチャッピーが止まる原因」の残量ゲージを置くための調査(Sylph)。【公式】【実機確認】【推測】を分ける。詳細な出典は調査報告に基づく。

| サービス | 取得手段 | 必要なキー・権限 | 割合の出し方 | 頻度の目安 | 取れない場合 |
|---|---|---|---|---|---|
| Codex(ChatGPT サブスク) | 同梱 CLI 0.163.0 の app-server `account/rateLimits/read` と `account/rateLimits/updated` 通知【実機確認】 | 今の ChatGPT ログインのまま | `100 − primary.usedPercent`(週の窓 10080 分)、`resetsAt`、止まっているかは `ordinaryUsageAllowed` / `rateLimitReachedType` | 起動時に 1 回 + 通知でマージ + 数分おき(推測) | turn のエラー |
| Claude(サブスク) | Agent SDK の `rate_limit_event`(ask のたび)、実験 API `usage_EXPERIMENTAL…()`【公式】 | claude.ai ログインで `user:profile` スコープ | `utilization`(0-100、5 時間・7 日の窓) | イベントは受け身、実験 API は数分おき(推測) | `status`(allowed_warning / rejected)、`api_retry` の `error`。soul の実環境での値は未確認 |
| OpenAI API(Decisions、前払い) | **残高を返す API は無い**【公式・実機確認】。Costs API は Admin キー(`api.usage.read`)が必要で、project キーは 403 | Admin キー(組織全体の権限) | `1 − 累計コスト ÷ 入金額`(入金額は手で設定)、または各応答の usage を単価で積算して入金額から引く(推測) | 日次集計なので 30〜60 分おき | 429 `credit_balance_exhausted` を検知 |
| ElevenLabs | `GET /v1/user/subscription`【公式】 | **`user_read` 権限**(今の STT 限定キーは 401)【実機確認】 | `character_count ÷ character_limit`、`next_character_count_reset_unix` | 5〜15 分おき(推測) | 今のキーで読める `/v1/usage/character-stats`(非推奨)の合計 ÷ 手で設定したプラン枠 |

## 実機で分かった数字

- Codex: `planType: "plus"`、週の使用率 1%(2026-10-17 時点)。
- ElevenLabs: 直近 30 日の STT 消費 4,444 クレジット(約 65 分)。Free の月 1 万クレジットの約 44%。
- Claude: 調査環境(デスクトップアプリの子セッション)では資格情報の形が違い、`rate_limits_available: false`。soul を動かす環境では未確認。

## 決定(ユーザー 2026-10-17)

- Codex と ElevenLabs は操縦席のゲージにする。Claude は今は Opus を使う予定がないので後回し。
- OpenAI API(Decisions)の残高は、配信前にユーザーが自分で確認する。ゲージは作らない(残高切れのエラー 429 `credit_balance_exhausted` は警告として出す)。
- ElevenLabs のキーを `user_read`(+ テキスト読み上げ)付きで作り直した。`GET /v1/user/subscription` で読めることを確認(2026-10-17: free、10,000 中 4,444 使用 = 44.4%、リセット 2026-11-15)。
