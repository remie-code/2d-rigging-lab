# AI Cohost Fire Diagnostics Map

> AI Cohost の長発話時 Control Channel 切断と、Cockpit の `fired` 表示から音声再生開始までの遅延を扱う read-only inventory の入口。

## Reports

| Path | Scope | Status |
|---|---|---|
| [control-channel-and-payload-limit.md](control-channel-and-payload-limit.md) | 4096-byte 上限の由来・必要性、speech 契約との不整合、初回切断仮説、切断後の再接続不全 | Completed (2026-08-30) |
| [fire-to-audio-latency.md](fire-to-audio-latency.md) | `fired` 表示から playback-start proxy までの実経路、既存観測点、相関断点、最小観測項目 | Completed (2026-08-30) |
| [live-run-analysis-2026-08-30-01.md](live-run-analysis-2026-08-30-01.md) | D1導入後の実Cockpit再現5 Fireを解析。最後の成功、4180-byte close、閉接続再利用による3連続timeoutを時系列化 | Completed / user interpretation pending (2026-08-30) |

## Current State

- `4096` は WebSocket の技術上限ではなく、過去の unbounded client input 指摘に対する保守的な application boundary である。正確な数値根拠は未確認。
- valid な speech timeline が 4096 bytes を超える不整合は再現済み。ただしユーザー観測時の最初の切断原因は、失敗 payload と close metadata がないため未証明。
- 成功後に閉じた lazy Control Channel が自動回復しない実装上の gap は確認済み。
- Fire 全体を結ぶ共通 ID がなく、LLM・TTS・Channel・Player の既存計測点を一つの発話として相関できない。
- D1実ログではSoul側の最新5 Fireを相関でき、#7成功、#8の4180-byte送信直後close、#9〜#11のgeneration 1再利用timeoutを確認した。今回のRuntime実traceは欠落しているため、#8のRuntime-side `oversize`は未証明。

## Next Candidate

- 上限変更前の baseline と Fire-to-audio の区間計測を同一 Fire ID で残せる、最小観測方式を検討する。
- baseline 保持後にのみ、明示的な有限上限への引き上げを比較観測する。無制限化は inventory の推奨外。

## Unresolved

- ユーザー観測時の最初の socket close が 4096-byte 超過だったか。
- 十数秒の体感遅延を支配する区間が LLM 全文待ち、初期化、vision、TTS、Channel、Player のどれか。
- transport 上限の新しい具体値と、close ではなく診断可能な失敗形をどう定めるか。
