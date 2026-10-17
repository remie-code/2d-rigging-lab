# 操縦席の作り直し: 画面が受け取るデータの形(1 回目の成果)

> Status: 1 回目(データの通り道)を Gnome が実装済み(2026-10-17、`node --test` 1307/1307、check:soul-zone 通過)。2 回目(画面)はこの形を使う。合意は [cockpit-glance-redesign.md](cockpit-glance-redesign.md) §9。

## 1. 新しい SSE(4 本。2 回目で `ui/app.mjs` の `SSE_EVENT_NAMES` に足し、本数を固定しているテスト 3 か所を直す)

1. `fireAsk`(ask の直前、全経路): `{ fireId, windowFirstSeq, windowLastSeq, includedCount, vision, atMs }` — 推論に使った範囲。
2. `latency`(1 返事 1 回、声が鳴り始めた時点。鳴らなかった返事は発火の終わりに `spoken:false`): `{ fireId, cause, spoken, segments: { transcribeMs, judgeMs, screenMs, llmFirstMs, firstSentenceMs, ttsMs, voiceMs }, otherMs, totalMs, level: "ok"|"warn"|"alert"|null, vision, brain }`(時間は整数 ms か null)。
3. `quota`(値が変わったとき): `{ codex: CodexQuota|null, elevenlabs: ElevenLabsQuota|null }`。
4. `warnings`(一覧が変わったとき、一覧ごと): `{ warnings: CockpitWarning[] }`。

## 2. snapshot(GET /api/state と SSE `state`)に足したキー

- `quota`(上と同じ形、監視が無ければ null)、`warnings`、`latencyThresholds: { warnSec, alertSec }`(既定 4 / 6、`cockpit-settings.local.json` の `latencyWarnSec` / `latencyAlertSec`)。

## 3. 既存の SSE への追加

- `fire`(受理): `fireId`、`cause`(棄却でも cause を渡した発火なら付く)。
- `transcript`(speaker "soul"): `fireId`。
- `selfFire` の `kind:"speak-now-judgment"`: 成功時 `action`("fire"|"drop-busy"|"drop-inactive"|"skip-interval")、`trigger`("transcript"|"after-busy")、`triggerSeq`。エラー時 `trigger`・`triggerSeq`。
- `selfFire` の `kind:"comment-judgment"`: 成功時 `action`("fire"|"hold-busy"|"drop-busy"|"drop-inactive")、`trigger`("comment"|"after-busy")。
- `selfFire` の発火結果の行: 受理されたときだけ `fireId`。`POST /api/fire`・`/api/vision-fire` のレスポンスも同じ。

## 4. cause(きっかけ)

- 手動 `{ type:"manual", vision }`
- スケジューラ `{ type:"silence"|"call"|"turn-end"|"interjection"|"comment"|"comment-call" }`
- speak-now `{ type:"speak-now", choice:"respond"|"initiate"|"backchannel", probability, trigger, triggerSeq, judgeLatencyMs }`
- コメント反応 `{ type:"comment-react", commentIds, commentSeqs, probabilities, judgeLatencyMs }`

結び付け: 発火ごとの情報は `fireId`(受理 → fireAsk → soul 行 → latency → 発火結果)。判定の行と発火は、speak-now なら `triggerSeq`、コメント反応なら `cause.commentIds`。fireId はプロセス内の連番(再起動で 1 に戻る)。

## 5. 残量と警告

- CodexQuota `{ remainingPercent, usedPercent, resetsAtMs, windowMins, limited, reachedType, limitId, updatedAtMs }`(頭が Codex のときだけ、5 分おき + 通知 + 発火のたび。読めなければ null)。
- ElevenLabsQuota `{ remainingPercent, used, limit, resetsAtMs, updatedAtMs }`(10 分おき)。割合は小数第 1 位。20% / 5% の区分は画面側で判断。
- CockpitWarning `{ id, kind, lifetime:"state"|"event", severity:"warn"|"alert", message, detail, source, sinceMs, lastAtMs, count, expiresAtMs }`。並びは alert が先。
  - 状態: `stt-down`(alert)・`stt-reconnecting`・`mic-down`(alert)・`chat-disconnected`・`chat-reconnecting`・`quota-low`(5% 未満は alert)・`codex-limited`(alert)。
  - 出来事(60 秒): `judge-error`(speak-now / comment-react / comment-guard)・`brain-error`(alert)・`openai-credit`(alert、429 credit_balance_exhausted)。

## 6. 区間の定義と取れない値

- 合計 = 文字起こし + 判定 + 「fire() が呼ばれてから声が鳴り始めるまで」。名前の付いた区間に入らない残りは `otherMs`(Claude では最初の文字以降の生成時間がここに入る)。after-busy の判定で待った時間は含まない。
- TTS と声は最初の文で測る(Codex)。Claude は返事全体を一括で読む。LLM 最初の文字は Codex が ask 開始 → 最初の delta、Claude が llm-session の ttftMs。
- 「最初の文」は Claude に無い。「文字起こし」は speak-now がきっかけのときだけ(従来方式の呼びかけ・区切りやコメント反応では null)。コメント反応の「判定」は反応する判定だけ(弾く判定の時間は含まない)。snapshot の転写履歴には fireId が無い(範囲を復元しない合意どおり)。

## 7. 実 API 確認(2026-10-17)

- ElevenLabs: free、10,000 中 5,224 使用 → 残り 47.8%、リセット 2026-11-15。
- Codex: byLimitId は codex だけ、primary 週の窓で使用率 2%(残り 98%)、リセット 2026-10-23。
