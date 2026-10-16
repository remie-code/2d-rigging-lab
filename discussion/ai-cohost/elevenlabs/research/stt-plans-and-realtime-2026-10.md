# ElevenLabs STT — プラン差とリアルタイム経路(2026-10-16)

> サブエージェント(Sylph)の Web 調査と、ウンディーネによる公式 docs(`.md`)の直接確認の統合。【公式】【第三者】【推測】を分ける。うちら自身の実測はまだない。

## 1. モデルと経路【公式】

- リアルタイム: `scribe_v2_realtime`(リアルタイムの model_id はこれ1つ)。WebSocket `wss://api.elevenlabs.io/v1/speech-to-text/realtime`。入力は base64 の pcm(8k〜48k、推奨 16k)か ulaw_8000、**モノラルのみ**。
- バッチ: `scribe_v2`(`POST /v1/speech-to-text`)。`scribe_v1` は非推奨。
- 受信イベント: `partial_transcript`(進行中区間の暫定。後の partial が前を置き換える)、`committed_transcript`(区間の確定)、タイムスタンプ付き版ほか。
- 日本語: 対応。言語別表で「Excellent(WER 5%以下)」。発表時の公称 WER 4.2%(条件不明)。
- 出典: https://elevenlabs.io/docs/overview/models.md 、https://elevenlabs.io/docs/eleven-api/guides/how-to/speech-to-text/realtime/event-reference.md 、https://elevenlabs.io/docs/capabilities/speech-to-text.md

## 2. コミット(確定)の制御【公式】

- 方式: `manual`(既定)/ `vad` / `turn_prediction`(2026-10-12 changelog で追加。対応モデルは未確認)。
- VAD 既定値: 無音しきい値 1.5 秒(0.3〜3.0)、`vadThreshold` 0.4、最小発話・最小無音とも 100ms。
- manual: 「20〜30秒ごとのコミットはレイテンシ改善によい」。コミットしなくても約36秒たまると自動コミット。短い間隔での連続手動コミットは性能を落とす(`commit_throttled`)。
- **「転写処理は最初の2秒分の音声が送られてから始まる」**。
- 公称レイテンシ: partial ≈150ms(アプリ・ネットワーク除く。別の公式ブログでは 30〜80ms と食い違う)。**commit までの公称値は記載なし**。
- 出典: https://elevenlabs.io/docs/eleven-api/guides/how-to/speech-to-text/realtime/transcripts-and-commit-strategies.md

## 3. 接続の維持・課金・再接続【公式】

- 課金は**送った音声の長さ**で決まる。
- 接続を保つには音声を送り続ける必要がある(無音フレームでよい)。**音声を止めると、クライアントから何も届かない状態が 15 秒続いた時点でサーバーが切る(変更不可)**。
- `keepalive_interval_ms`(500〜10000)はサーバーからの keepalive 通知の設定であり、音声送信の代わりにはならない。「送っている音声以外の課金影響はない」。
- 再接続は新しいセッションになる。最初のチャンクと一緒に `previous_text`(50文字未満推奨、最初のチャンクでのみ可)を送ると文脈を引き継げる。公式もネットワークエラー後の再接続を用途に挙げている。
- セッションの最長時間は存在する(`session_time_limit_exceeded`、「新しいセッションを始めるかプランを上げる」)が、**値は記載なし**。

## 4. プラン差【公式】

| 項目 | Free | Starter | Creator | Pro |
|---|---|---|---|---|
| 月額 | $0 | $6 | $22 | $99 |
| STT API(バッチ/リアルタイム) | 可 / 可 | 可 | 可 | 可 |
| リアルタイム同梱時間(月、STT のみに使った場合) | 約2.5時間 | 約15時間 | 約56時間 | 約254時間 |
| リアルタイム同時接続 | 6 | 9 | 15 | 30 |
| キュー優先度(大きいほど優先) | 3 | 4 | 5 | 5 |
| 商用利用 | 不可(帰属表示が必要) | 可 | 可 | 可 |

- モデル・機能・時間単価(リアルタイム $0.39/時、バッチ $0.22/時)は全プラン共通。プランによる精度・モデルの差を示す公式記述は見当たらない。
- クレジットは TTS を含む全製品で共有。
- 同時接続の上限を超えた場合はキューに入り、「通常約50ms 増える程度」。
- Free は VPN・共有 IP で不正検知により止まることがある。学習利用は既定で有効(オプトアウト可)。
- 出典: https://elevenlabs.io/pricing/api 、https://elevenlabs.io/docs/overview/models.md(Concurrency and priority)、https://elevenlabs.io/docs/help-center/legal/can-i-publish-the-content-i-generate-on-the-platform.md
- ドキュメント間の食い違い: UI 比較表では Free の STT 同梱が「12分」とあり、API 料金表の約2.5時間と合わない。

## 5. 第三者の計測【第三者】(いずれも英語中心、プラン不明)

- Coval(米国、2026-10-15): 確定区間まで p50 114ms / p95 190ms、最初のトークンまで平均 2155ms、WER 4.3%。https://benchmarks.coval.ai/models/scribe_v2_realtime
- Pipecat stt-benchmark(発話終了から確定区間まで、ネットワーク込み): 中央値 281ms。https://github.com/pipecat-ai/stt-benchmark
- 日本語・リアルタイムの第三者実測は見つからなかった。ユーザーの知人の実測(STT 確定 491ms 表示)は [../_map.md](../_map.md) §3。

## 6. 推測

- VAD を既定のまま使うと、確定まで「1.5 秒 + 処理 0.1〜0.3 秒」程度になり、現行 whisper(≈1.9 秒)と大差ない。速さは確定の仕方の設計で決まる。
- 喋っていない間も接続を保つなら無音を送り続けることになり、その時間も同梱時間を消費する。Free の約2.5時間は配信本番には足りないが、初期の計測には足りる。
- 喋っている間だけ送る場合、15 秒で切れて再接続ごとに最初の約2秒のバッファが乗る可能性がある。過去の音声(無音)を先に流し込めばこれを避けられるかは未確認。

## 7. 実機で確認した事実(2026-10-16、Free プラン)

- `xi-api-key` ヘッダでの WebSocket 認証は Node 24 の標準 `WebSocket`(undici)で通る。
- `session_started` の config 例: `vad_commit_strategy: true`、`vad_silence_threshold_secs: 1.5`、`vad_threshold: 0.4`、`timestamps_granularity: "word"`。
- **`commit_strategy=turn_prediction` は拒否される**: `invalid_request` 「commit_strategy 'turn_prediction' is not supported by model_id 'scribe_v2_realtime'」(close 1008)。changelog(2026-10-12)は「ターンを予測するモデルの既定」とし、そうしたモデルの partial には `turn_probability` が付くとするが、API の model_id は `scribe_v2_realtime` のみ。**ターン予測モデルは API に未公開**と読める。

- **VAD 無音しきい値の実効下限は 0.5 秒**: 受け付ける範囲は 0.3〜3.0(範囲外は `invalid_request`)だが、0.3 を送ると `session_started` の config は 0.5 になる。0.8 を送ると 0.8(2026-10-16、実験ログと Gnome の実機確認)。

## 8. 未確認

- commit までの実時間(日本語、日本から)。確定方式(VAD 既定・短縮 VAD・手動)ごとの差。
- ターン予測モデルの公開時期・名前。
- セッションの最長時間。WebSocket が接続中ずっと同時接続を1つ占有するか。
- 課金の端数の扱い(秒単位か)。
