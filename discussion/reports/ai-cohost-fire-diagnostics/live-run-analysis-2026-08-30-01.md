# Passive Fire Diagnostics — real Cockpit run analysis (2026-08-30-01)

## 結論（先に）

今回保持された Soul の最新5 Fire は、`#7` が成功し、`#8` が最初の失敗、その後の `#9`〜`#11` がすべて同じ閉じた Control Channel を再利用して `reply_timeout` になった系列である。`#8` の `intent.speech` は **4,180 UTF-8 bytes**（4096-byte 境界を84 bytes超過）だったので、最初の close は oversize 仮説と強く整合する。ただし、今回の Runtime 実 trace が見つからず、Runtime 自身の `oversize` 記録による直接証明ではない。

`#7` は `speechChars=90`、`rawMoraCount=110`、`timelineCount=93`、WAV 15.792154 s / 1,392,912 bytes、serialized speech 3,506 bytesで、accepted→child `STARTED` は **16,881.5 ms**。`#8` はより長い `speechChars=97`、`rawMoraCount=118`、`timelineCount=111`、WAV 17.197007 s / 1,516,820 bytesだが、送信直後に close して再生には到達しなかった。したがって「今回のほうが長く話してから壊れた」は、実測上は LLM/TTS がより長い発話を生成・合成したことと、そこで payload 境界を初めて超えたことの組合せで説明できる。

## 1. 調査対象とパスの確定

### リポジトリ／実行ファクト

- Soul の実 run は `apps/soul/agent/fire-diagnostics/fire-*.jsonl` にあり、今回確認した最新5ファイルは次の通り。checked-in fixture（`apps/soul/agent/src/mind/fixtures/`）とは別物である。
  - `fire-2026-08-30T00-38-13-608Z-7.jsonl`
  - `fire-2026-08-30T00-39-11-327Z-8.jsonl`
  - `fire-2026-08-30T00-39-54-224Z-9.jsonl`
  - `fire-2026-08-30T00-40-27-744Z-10.jsonl`
  - `fire-2026-08-30T00-40-57-252Z-11.jsonl`
- Fire ID は `soul-...-7` から `soul-...-11`、Channel request ID は `req-17` から `req-31` と連続しており、同じ Soul 実行系列の最新5 Fire とみなせる。各 Fire は個別 JSONL である。
- `apps/soul/agent/cockpit-settings.local.json` は token を表示せずに検査し、保存済み Channel が autonomous default のポートに対応することを確認した。
- Runtime の実装では `apps/runtime-player/src/main/runtime-player-main.ts:113-117,150-153` が default `app.getPath("userData")` を取得し、role launch 時に slot userData へ redirect する。`apps/runtime-player/src/main/profile-slots/slot-paths.ts` は `<default>/slots/<slotName>` を導出し、`apps/runtime-player/src/main/profile-slots/host-role.ts` は autonomous default を `autonomous-default`、その固定 Channel port を 17310 と定義する。
- ファイルシステム上の default root は `C:\Users\remie\AppData\Roaming\@private-2d-rigging-lab\runtime-player`。従って今回の autonomous slot の期待 trace は次である。

  `C:\Users\remie\AppData\Roaming\@private-2d-rigging-lab\runtime-player\slots\autonomous-default\ai-cohost-fire-diagnostics\runtime-player\control-channel.jsonl`

- 上記 slot path、unslotted root、tracking slot、通常の Electron/Runtime Player 候補を `Test-Path` / `rg --files` で確認したが、今回の wall-time（00:38–00:41 UTC）に対応する Runtime trace は存在しなかった。`control-channel.jsonl` として見つかったものは `AppData\Local\Temp\runtime-player-fire-diagnostics-*` 配下の空ファイルのみで、Vitest 用一時ディレクトリであり、今回の実 run ではない。
- source には `apps/runtime-player/src/main/control-channel/fire-diagnostics.ts` がある一方、`apps/runtime-player/out/main/main.js` は 2026-08-08 UTC の生成物で、`control-channel.jsonl` / `ai-cohost-fire-diagnostics` の文字列を含まない。したがって、今回の Runtime が古い build/package から起動されていた可能性はあるが、起動コマンド自体は現時点で観測できず断定しない。

## 2. 観測された事実（Soul 側）

時刻は各 JSONL の `wallTimeMs` を UTC ISO に変換したもの。duration は Soul Node の process-local monotonic clock であり、別プロセスの時計との直接減算はしていない。

| Fire / JSONL | accepted | 結果 | 出力数量 | TTS / timeline / envelope | 最終 stage/code |
|---|---|---|---|---|---|
| `#7` / `00-38-13-608Z-7` | 00:38:13.608 | 成功、child `STARTED` 00:38:30.489 | modelOutputChars 95 / speechChars 90; raw mora 110; timeline 93 | WAV 15.792154 s / 1,392,912 B; speech 3,506 B; `req-18`, gen 1 | `fire.completed` 00:38:46.285 |
| `#8` / `00-39-11-327Z-8` | 00:39:11.327 | speech send 後 close、再生なし | 102 / 97; raw mora 118; timeline 111 | WAV 17.197007 s / 1,516,820 B; speech 4,180 B; `req-20`, gen 1 | `control_channel.close / channel_closed` 00:39:32.996 |
| `#9` / `00-39-54-224Z-9` | 00:39:54.224 | expression 4件と speech が timeout、再生なし | 105 / 98; raw mora 122; timeline 104 | WAV 17.359546 s / 1,531,156 B; speech 3,916 B; `req-25`, gen 1 | `control_channel.reply_timeout / reply_timeout` 00:40:14.739 |
| `#10` / `00-40-27-744Z-10` | 00:40:27.744 | expression 3件と speech が timeout、再生なし | 78 / 67; raw mora 85; timeline 73 | WAV 11.241066 s / 991,506 B; speech 2,747 B; `req-29`, gen 1 | `control_channel.reply_timeout / reply_timeout` 00:40:46.990 |
| `#11` / `00-40-57-252Z-11` | 00:40:57.252 | expression 1件と speech が timeout、再生なし | 79 / 74; raw mora 93; timeline 80 | WAV 13.400499 s / 1,181,968 B; speech 3,019 B; `req-31`, gen 1 | `control_channel.reply_timeout / reply_timeout` 00:41:21.333 |

`outputChars` という名前のフィールドは今回の production JSONL には存在しない。対応する記録は `modelOutputChars` であり、上表ではその値を明示した。本文・プロンプト・音声/WAV body は記録されていない。

### #7 — 最後の成功した長い発話

`fire-2026-08-30T00-38-13-608Z-7.jsonl` の順序は次である。

1. `fire.accepted` / `fire.accepted.context` — 00:38:13.608、vision=true、preferred=true。
2. `vision.capture.completed` — 00:38:14.428、820 ms。
3. `llm.ask.completed` — 00:38:25.049、10,620.2928 ms、modelOutputChars=95。
4. `llm.response.parsed` — speechChars=90、expressionCount=1。
5. `tts.audio_query.request_completed` — 27.1539 ms、`tts.audio_query.completed` で rawMoraCount=110。
6. `tts.synthesis.request_completed` — 5,405.2486 ms、WAV 1,392,912 bytes。
7. `speech.timeline.build_completed` — 0.0866 ms、timelineCount=93。
8. `channel.request.send` — `req-18`, `kind=intent.speech`, generation=1, serializedUtf8Bytes=3,506、00:38:30.484。
9. `channel.request.reply` — `req-18`, accepted、RTT=1.1628 ms、00:38:30.485。
10. `player.play.enqueued` → `player.child(marker=STARTED)` — 00:38:30.485 → 00:38:30.489、enqueue→child=3.911 ms、accepted→child=16,881.5115 ms。
11. `fire.completed` — 00:38:46.285。child STARTED 後の約15.8 sは WAV 尺と整合する再生占有であり、Fire-to-audio latency に加算しない。

### #8 — 最初の失敗

`fire-2026-08-30T00-39-11-327Z-8.jsonl` は vision capture 919 ms、LLM 14,977.8514 ms、audio_query 52.1939 ms、synthesis 5,715.1343 msを経て、00:39:32.994 に `req-20` / `intent.speech` / generation=1 / serializedUtf8Bytes=4,180 を送信した。約1.9 ms後の 00:39:32.996 に `channel.close` が記録され、同時刻に `channel.request.failed(req-20)` が `channel_closed` / `control_channel.close`、続いて `speech.channel.failed`、`fire.diagnostic(type=fireError)`、`fire.failed` となった。

この Fire は timeline/WAV 準備まで成功し、`player.play.enqueued` / `player.child` は存在しない。accepted→final は 21,669.171 ms、accepted→speech send は約21,666.9 ms。

### #9–#11 — 後続 Fire / timeout chain

- `#9`: response parse 直後に expression `req-21`〜`req-24` を並行送信（00:40:04.847）。4件は 00:40:08.858–08.859 に `reply_timeout`。TTS synthesis はその間も継続し、speech `req-25` は 00:40:10.723 に送信、00:40:14.738 に timeout。speech bytes は3,916で4096以下。
- `#10`: expression `req-26`〜`req-28` を 00:40:39.491 に送信、00:40:43.498–43.499 に全件 timeout。speech `req-29` は 00:40:42.976 に送信、00:40:46.989 に timeout。speech bytes は2,747。
- `#11`: expression `req-30` を 00:41:13.497 に送信、00:41:17.507 に timeout。speech `req-31` は 00:41:17.319 に送信、00:41:21.333 に timeout。speech bytes は3,019。

後続3 Fire の全 request は `connectionGeneration=1` のままで、新しい接続の `connect/open/hello` に相当する Fire trace はない。#8 の close（00:39:32.996）後、#9 の最初の send（00:40:04.847）まで約31.85 s空いているが generation は変わらない。

## 3. Cross-log 相関

### 確実に相関できるもの

- Soul 内では Fire ID、request ID、generation、wall-time、event order が整合する。
- #7 の `req-18` は send→accepted reply→play enqueue→child STARTED と一続きである。
- #8 の `req-20` は send→`channel.close`→`channel.request.failed(channel_closed)` の順で、同一 Fire/generation/request である。
- #9〜#11 は #8 と同じ generation=1 を再利用し、reply が一件もないまま各 request の4秒 timeoutへ進む。

### Runtime traceについて

今回の実 Runtime traceは前節の期待 pathに存在せず、wall-time近傍・request identity・generation・event orderを満たす Runtime-side recordはない。従って、checked-in fixture `apps/runtime-player/src/main/control-channel/fixtures/fire-diagnostics-runtime-sample.jsonl` の次の記録を今回の run に結び付けない。

- fixture の `transport.close-requested` は `closeReason=oversize`, `framePayloadBytes=4097`。
- 直後の `connection.disconnected` は `closeReason=oversize`, `terminalEvent=socket-end`, `connectionDurationMs=4`。

これは実 Runtime の現在 run を示すものではなく、Runtime decoder が oversize 時に採る close branch の独立 fixture 証拠である（source `apps/runtime-player/src/main/control-channel/channel-websocket-connection.ts:121-135,198-210`）。

## 4. 導出タイミングと支配段階

accepted→child playback proxy（child `STARTED`）は #7 のみ **16,881.5 ms**。#8〜#11は playback proxy未到達である。Fire全体の accepted→final は #7の completedまで32,676.9 ms、#8=21,669.2 ms、#9=20,515.1 ms、#10=19,245.7 ms、#11=24,081.2 msだが、成功後の再生占有は latency と別に扱う。

明示された stage で最大なのは全5 Fireとも LLM ask（#7 10.620 s、#8 14.978 s、#9 10.028 s、#10 10.812 s、#11 15.408 s）。次に大きいのは TTS synthesis（5.405 / 5.715 / 5.840 / 3.467 / 3.808 s）。capture、audio_query、timeline はこれらより小さい。#9〜#11では expression send と TTS が重なっており、expression timeout 4 s と speech timeout 4 sを単純合算して「処理時間」としてはいけない。#8では closeは speech send直後であり、支配的な経過時間は close処理ではなく、accepted後のLLMとsynthesisである。

## 5. 推論（factsと分離）

### 強く支持される推論

1. **#8 の close は oversize と整合する。** serialized `intent.speech` は4,180 bytesで、既知の4096-byte boundaryを超え、send直後にclose-before-replyとなった。#7の3,506 bytesは成功し、#9〜#11も4096以下だが、これらはすでに閉じた接続を使ったため別のtimeoutになった。
2. **今回の「長く話した」は発話規模の増加で説明できる。** #7は15.792 s WAV / timeline93、#8は17.197 s WAV / timeline111で、#8のspeechChars/rawMora/timeline/serialized bytesが#7を上回る。より長いTTS成果物がpayload境界超過へ寄与した。
3. **後続timeoutは閉じた connection の再利用と整合する。** `createLazyChannel`（`apps/soul/agent/scripts/cockpit.mjs:157-189`）は resolved channel promise を保持し、`connectChannel` の socket close は pending request をrejectするが、既に解決済みの lazy promise 自体を無効化しない。実ログでも #9〜#11 の generation は1のままで、新規接続の痕跡がない。

### 断定できない推論

- Runtime traceがないため、#8の実 frame payload bytes、Runtime `oversize` event、close branch（oversizeか、別の process/peer closeか）は直接確認できない。4,180 bytesとclose時系列から oversize を最有力とするが、元の「first-close = oversize」仮説を完全には証明しない。
- `modelOutputChars` は応答全体の文字数、`speechChars` は読み上げ対象の文字数であり、発話本文自体は記録されない。長さ増加の因果は数量上支持されるが、モデル出力の内容や生成理由は判定しない。

## 6. Unknowns / logging gaps

- 今回の実 Runtime `control-channel.jsonl` は見つからず、Runtime側の `connection.connected`、受信 frame、`request.observed`、`transport.close-requested`、`connection.disconnected` が欠落している。
- Soulログには Runtimeの `connectionId`、サーバPID、frame payload bytes、OS/TCP close reason、physical speaker onsetはない。
- `player.child=STARTED` は child process proxyであり、物理的な発音開始を意味しない。#8〜#11はchild markerなし。
- Soul diagnostics は best-effort 非同期 writer（保持5、queue上限128）であり、欠落イベントを production stage の未実行の証拠にはできない。ただし今回の各JSONLは主要な Fire failure boundary まで連続している。
- wall clock は process間相関用、duration は process-local monotonic。Runtime traceがないため cross-process timestamp差や Runtime acceptance anchor は計算不能。
- UIの「話した」「expression表示された」時刻、SSE受信、DOM paint、実音声の終了は今回のログからは出せない。

## 7. 簡潔な判定

- Fire数: **5**（#7〜#11）。成功 **1**、失敗 **4**。
- 最初の失敗: **#8 / req-20 / generation 1 / 4,180 UTF-8 bytes / `channel.close`→`channel_closed`**。4096超過は事実、Runtime oversize自体は今回未観測。
- 後続失敗: **#9〜#11**。全て generation 1、再接続せず、expression/speechとも `reply_timeout`。閉じた connection の再利用をSoulログと現行lazy-channel実装が支持する。
- 元の first-close 仮説: **最有力だが Runtime独立証拠欠落のため未証明**。
- 今回長く話せた理由: #7の成功で15.79 sの音声再生まで到達し、次の#8は17.20 s相当のより長いspeechを合成した後にpayload境界を超えたため、失敗までの見かけの経過が長くなった。

## 8. 実施した読み取り・クエリ

- `Get-Content -Raw -Encoding UTF8` で指定された4基礎資料と `discussion/_conventions.md`, `discussion/_map.md` を先に確認。
- `Get-ChildItem apps/soul/agent/fire-diagnostics -Filter 'fire-*.jsonl' | Sort-Object LastWriteTimeUtc` で保持中の実 run を特定。
- PowerShell `ConvertFrom-Json` で各JSONLを event、Fire/request ID、wall/monotonic時刻、stage/code、数量だけ抽出し、UTC ISOと accepted相対時間を導出。本文・URL・token・binary bodyは出力しなかった。
- `rg --files ... -g 'control-channel.jsonl'` と候補 userData roots の `Test-Path` で Runtime traceを探索。
- `rg -n` で `RuntimePlayerControlChannelDiagnosticLog`、`app.getPath("userData")`、slot path/port、`ai-cohost-fire-diagnostics`、`createLazyChannel` の実装境界を確認。
