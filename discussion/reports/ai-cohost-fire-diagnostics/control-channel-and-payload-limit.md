# AI Cohost Fire 診断台帳: Control Channel の 4096-byte 上限と payload

Status: 2026-08-30 時点の read-only 棚卸し。実装・テスト・マップは変更していない。

## 0. 結論

`4096` は WebSocket/RFC6455 が要求する値ではない。Browser Source で「クライアント入力が無制限」というレビュー指摘を解消するために導入された、保守的なアプリケーション境界であり、C4 Control Channel はその codec と定数を byte-identical に複製した。4096 という数値について、負荷計測・脅威モデル・メモリ予算から導いた記録は見つからず、履歴で証明できるのは「無制限入力を閉じる」「Browser Source と同じ境界を使う」までである。

Control Channel では、受信 WebSocket **frame payload** が 4096 byte を超えると JSON/意味論の検証に到達せず、server がソケットを閉じる。対して `intent.speech` の 512 は timeline **要素数**の意味論上限で、超過時は `invalidPayload` reply と接続維持を意図している。この二つは単位も失敗形も異なる。実際の `speak()` 生成物を同じ envelope に載せる実験では、110 モーラで 4164 byte、512 モーラで 19135 byte となった。したがって「長い reply → 4096 超 → server close → `Control Channel socket closed unexpectedly.`」はコード上かなり整合するが、事故時の失敗 payload と close code がないため、発生済み事象としては未証明である。

成功済み接続を `createLazyChannel` が cache した後の切断を自動回復しないことは、実装・テスト範囲・S3 follow-up の三者で確認できる。後続 Fire は死んだ channel に送信し、実装する WebSocket が send を黙って捨てる場合は reply を 4000 ms 待って timeout になる（send が CLOSED を即時 throw する実装なら timeout ではなく即時エラー）。

## 1. 調査範囲と実行した確認

対象は以下である。

- transport: `apps/runtime-player/src/main/control-channel/channel-websocket-frame.ts:1-148`、`channel-websocket-connection.ts:1-127`、`channel-server.ts:232-348`
- 意味論: `apps/runtime-player/src/main/control-channel/contract/channel-protocol-contract.ts:168-190`、`channel-intent-speech-payload-schema.json:4-18`、`channel-intent-validation.ts:395-440`
- 魂側送出: `apps/soul/agent/src/voice/speak.mjs:80-115`、`mora-timeline.mjs:34-41,185-197`、`channel-client.mjs:39-40,117-155`、`scripts/cockpit.mjs:155-208`
- Fire 失敗伝播: `apps/soul/agent/src/mind/fire-orchestrator.mjs:471-475,765-776`
- tests/reports/history: Browser Source の同型 transport test、Control Channel server tests、channel-client/cockpit tests、Wave9/C4/C6 の履歴と follow-up

実行した既存テスト:

```text
pnpm.cmd exec vitest run apps/runtime-player/src/main/broadcast-source/browser-source-server.test.ts apps/runtime-player/src/main/control-channel/channel-server.test.ts
→ 2 files passed / 26 tests passed
```

なお `node --test` を単独で魂側 3 ファイルに対して実行した試行は、テスト worker 起動時の環境側 `spawn EPERM` で開始できなかった。これは製品テストの失敗とは扱わない。

## 2. Repository facts（現コードで証明できること）

### 2.1 4096 が閉じるまでの経路

1. `channel-websocket-frame.ts:21` が `controlChannelMaxClientMessageBytes = 4096` を定義する。decoder は RFC6455 の client mask を要求し、126/127 の extended length と `Number.MAX_SAFE_INTEGER` を扱う（同:60-90）。つまり 4096 は frame length の表現限界ではない。
2. payload length が 4096 より大きい場合、decoder は `Control Channel WebSocket client frame is too large.` を throw する（同:85-91）。
3. connection wrapper は TCP data を `#buffer` に累積し、`controlChannelMaxClientMessageBytes + 14` を超えると close する（`channel-websocket-connection.ts:20,69-80`）。decode 中の throw も catch して close する（同:82-91）。非 final frame も close する（同:95-99）。この境界で `onTextMessage` は呼ばれない。
4. 正常な text frame だけが server の `#handleClientMessage` に入り、`dispatchControlChannelRequest` → `validateControlChannelIntentSpeech` → `overlayStore.setSpeech` → reply の順になる（`channel-server.ts:263-271,276-336`）。従って oversized frame は `invalidPayload` reply の経路ではない。
5. server 側 `encodeWebSocketFrame` は payload を 2/4/10-byte header で符号化し、4096 check を持たない（`channel-websocket-frame.ts:120-147`）。今回の上限は server response の上限ではなく、Control Channel の client input policy である。

`+14` は client frame の最大 wire overhead（2-byte base header + 8-byte length + 4-byte mask）を見積もった accumulation guard と読める。ただし通常の 4096 payload は 126 length 経路なので、payload policy と raw TCP accumulation policy は別の境界である。

### 2.2 512 timeline と 4096 byte は別物

`channel-protocol-contract.ts:168-176` は 512 を「最初の variable-length payload の per-tick scan に対する DoS bound」と明記し、超過は `invalidPayload`・clamp なしと定める。schema も `timeline` の `minItems:1, maxItems:512`（`channel-intent-speech-payload-schema.json:10-14`）。実装は empty または 512 超を null とし、frame が意味論 parser に届いた場合に reply rejection へ進む（`channel-intent-validation.ts:402-413`）。

魂側 `buildSpeechTimeline` も 512 超を送出前に throw する（`mora-timeline.mjs:34-41,185-195`; `speak.mjs:90-103`）。よって timeline が 513 以上なら、通常は TTS の client-side throw が先であり、server socket close とは別の失敗である。

ただし 512 は要素数であって byte 数ではない。最小に近い valid envelope（`timeMs:0..n-1`, `vowel:"a"`, `s:0`, id は `a`）でも、計測上 120 要素で 3914 byte、128 要素で 4178 byte となった。実際の timeline は小数の `s`、時刻、`req-1` などを含むため、交差点はさらに早くなり得る。つまり現 transport では「valid な 512 element speech」を wire で運べる保証はなく、実効上限はおおむね 100 台前半になる。

## 3. Git-history facts（4096 の由来）

### 3.1 Browser Source が最初の導入点

`git blame -L 1,32 -- apps/runtime-player/src/main/control-channel/channel-websocket-frame.ts` では、定数・codec の全行が `140fb634cc5c53f23aa11c11b823cd5f4f190f8a`（2026-07-11、C4）である。C4 の frame ファイル先頭コメント（同:1-7）は Browser Source codec の byte-identical duplicate であることを明記する。

元の Browser Source は `39e566b154dc6ae23180c5cabbb26e4193a72832`（2026-06-23、Wave9）で導入された。Wave9 review は初期 finding を `Medium: WebSocket client input was unbounded.` と記録し、fix status を「Browser Source client WebSocket message payloads are limited to 4096 bytes; oversized input closes the connection」としている（`discussion/runtime-player/implementation/reviews/wave9/runtime-player-wave9-domain-a-browser-source-server-transport-review.md:29-39`）。Wave9 report も 4096 を「conservative maximum」と表現し、oversized/incomplete-overflow で close と記録する（`discussion/runtime-player/implementation/waves/wave9/runtime-player-wave9-domain-a-browser-source-server-transport-report.md:11-15`）。

したがって履歴で proven なのは次の三点である。

- 無制限 client input はレビュー上の中程度の resource/security concern だった。
- その解消策として 4096 と oversized close が採用された。
- C4 は独自の数値設計ではなく Browser Source と同じ値・挙動を複製した。

### 3.2 proven でないこと

4096 の exact numeric rationale（例えば「一発話の p99 がこの値」「JSON.parse の heap 予算がこの値」「認証済み loopback だからこの値で十分」）は、review、C4 design、commit message、blame のいずれにもない。C4 review は「4096、Browser Source と同値」と確認するのみである（`discussion/ai-cohost/implementation/reviews/c4/domain-a-lane2-design.md:16-17`）。従って「保守的な DoS/resource boundary」という説明は履歴に基づくが、具体的な容量計算は推論である。

C6 の 512 実装 commit `bc8e04eedd4400bc77b7bb5908208b806918c8dd`（2026-07-12）は speech validation/contract/evaluator を追加したが、frame/connection codec は変更していない。byte cap が speech cap より先に存在し、両者の調整をした commit は見当たらない。

S1 follow-up は「512 モーラ上限なら 16-bit length 経路に収まるので 64-bit 経路は未踏」と記録する（`discussion/ai-cohost/implementation/waves/s1/s1-followup.md:10-12`）。これは `<=65535` の frame encoding 経路についての記述であり、`<=4096` の保証ではない。

## 4. 実 payload/frame の比較

### 4.1 E1: production builder + production envelope の byte 計測

tracked source を変更せず、Node の one-liner で `buildSpeechTimeline()` の実体を使い、client が送る形そのものを `JSON.stringify({v:1,id:"req-1",kind:"intent.speech",payload:{timeline}})` して `Buffer.byteLength(... )` を測った。mora は valid vowel 列、WAV 実長は 30 秒、pre/post は各 0.2 秒という合成入力である。

```text
node --input-type=module -e "import {buildSpeechTimeline} from './apps/soul/agent/src/voice/mora-timeline.mjs'; ..."
```

結果（全て timeline length は 生成後の要素数）:

| 要素数 | envelope JSON bytes | 4096 判定 |
|---:|---:|---|
| 100 | 3791 | 下 |
| 110 | 4164 | 上 |
| 111 | 4202 | 上 |
| 112 | 4237 | 上 |
| 120 | 4536 | 上 |
| 256 | 9602 | 上 |
| 512 | 19135 | 上 |

これは事故時の payload ではなく、構造とサイズの再現である。`channel-client.mjs:147-155` の envelope と一致するため、「112 前後」という事前仮説を支持するが、実運用の `id`、時刻、s 設定、実 TTS 出力を確定するものではない。

参考として channel-client の既存 test は 200 モーラ fixture を「16bit length 経路」として送る（`apps/soul/agent/src/channel/channel-client.test.mjs:219-238`）。同じ envelope の実 byte 数は 7157 byte だった。しかしこの test の `ws-double` は payload 上限を持たず、単に frame を decode して JSON.parse する（`apps/soul/agent/src/test-support/ws-double.mjs:104-140,271-343`）。よってこの test は本番 Control server で 4096 を越えても通ることの証拠にはならず、既存 test の blind spot である。

### 4.2 E2: 同型 transport test

実行した 26 test は Control Channel の通常 lifecycle/dispatch と Browser Source の oversized input を含む。Browser Source には 4097-byte text を送り、connected count が 0、client が CLOSED になる直接 test がある（`apps/runtime-player/src/main/broadcast-source/browser-source-server.test.ts:487-500`）。Control Channel server test には未知 kind を reject reply し接続を維持する test（`channel-server.test.ts:220-257`）はあるが、Control 専用の oversized input test はない。C4 codec の byte-identical claim と Browser Source test から強い類推はできるが、Control server での直接 wire regression は未固定である。

### 4.3 RFC/frame 境界との関係

- `JSON.stringify` された envelope の byte 数を server decoder が比較する。JavaScript の文字数ではなく UTF-8 payload bytes である（`encodeControlChannelWebSocketTextFrame`, `channel-websocket-frame.ts:30-32`）。なお model の日本語本文自体は wire に送られず、TTS 後の timeline だけが送られる。
- client mask 4 bytes と frame header は 4096 payload に加わるが、4096 check は payloadLength に対して行われる（同:60-91）。
- codec は 126/127 length を実装し、server encoder も 65535 超の 127 path を実装する（同:65-82,120-147）。従って RFC の wire limit を理由に 4096 が必須、という証拠はない。
- continuation/non-final frame を server が許さないため、WebSocket implementation の fragmentation 挙動は観測項目に残る（`channel-websocket-connection.ts:95-99`）。今回の 4 KiB 程度で fragment されるかは本コードからは決められない。

## 5. 仮説 chain の検証

| 段階 | 根拠 | 判定 |
|---|---|---|
| 長い model reply が長い speech になる | `fire-orchestrator` は reply を `speechText` にし `speak(speechText)` へ渡す（`fire-orchestrator.mjs:423-472`）。現行 checked-in default はまだ「短く…一言」（同:149-155）だが、per-brain instruction は `buildBrainSessionSystemPrompt`/Cockpit API で差し替え可能（`cockpit.mjs:103-106,808-824`）。 | 長文化は可能。ただし現在の default だけからは incident を証明しない。effective instruction を実測すべき。 |
| speech timeline が 4096 を越える | E1 で production builder/envelope が 110 で 4164、512 で 19135。 | 可能性は高い。実 payload 不在のため発生済みとは断定不可。 |
| server が close する | decoder の `payloadLength > 4096` throw → connection catch → `close()`（`channel-websocket-frame.ts:85-91`, `channel-websocket-connection.ts:74-90`）。`onTextMessage`/dispatch より前。 | コード上直接成立。 |
| client が exact message を出す | close event handler が pending を同じ `closedError` で reject（`channel-client.mjs:117-124`）。応答前切断 test も `/closed unexpectedly/` を固定する（`channel-client.test.mjs:268-286`）。 | 成立。文言は close 原因そのもの（oversize、process restart 等）を区別しない。 |
| Fire が後続処理を止めず diagnostics に落とす | `speak` throw は normal Fire の catch で `fireError`、`{fired:false,reason:"error"}`、finally idle（`fire-orchestrator.mjs:765-776`）。 | 成立。 |
| 後続 Fire が 4000 ms timeout へ進む | lazy channel は成功 promise を cache し、delegate send failure の catch で cache を null に戻さない（`cockpit.mjs:170-183,186-208`）。channel-client の `sendSpeech` は readyState preflight/reconnect なしで `socket.send` 後 reply を 4000 ms 待つ（`channel-client.mjs:39-40,147-155`）。 | 「send が no-op/送信不能だが throw しない」実装では成立。WebSocket implementation が即時 throw なら timeout でなく即時 error。 |

以上から、最初の failed Fire がこの chain だったという判定は **plausible / not proven** とする。

## 6. 競合する説明と未確定点

### 6.1 同じ観測を生み得るもの

- **512 超を送る前に TTS 側で throw**: `buildSpeechTimeline` が送出前に 513+ を拒否する。これは socket close ではなく `timeline has ... exceeding ...` 系の Fire error になるはずだが、実ログがなければ取り違え得る。
- **TTS/audio_query/synthesis/WAV の失敗**: `speak.mjs:80-100` の各段階が先に throw し得る。timeline bytes は観測されない。
- **意味論 rejection**: 4096 未満なら malformed/unknown vowel/non-monotonic/s range/slot writability は `invalidPayload` 等の reply で接続維持（`channel-request-dispatch.ts:87-128,200-227`）。これは exact close 文言とは競合するが、単独の Fire failure の原因にはなる。
- **通常の transport/lifecycle close**: runtime-player 再起動、意図的 Channel close、TCP/error、token/URL 問題、非 final/incomplete-overflow frame。client は原則同じ `closedError` を使い、close code/reason を診断へ渡さない。
- **send の実装差**: CLOSED socket に `socket.send()` が throw するか黙って queue/no-op になるかは、`globalThis.WebSocket` の外部実装契約であり、この repo の client code からは確定しない。
- **ASR 側の長音/認識不調**: S2.5 の long-utterance diagnosis は Whisper/flash-attn 等の別問題を記録している。これは reply の内容・長さを変える間接要因にはなり得るが、Control close の直接証拠ではない。

### 6.2 この棚卸しだけでは分からないこと

事故時の exact serialized envelope bytes、timeline 要素数、effective brain/instruction、WebSocket close code/reason、server の decoder 分岐、process restart の有無、`socket.send` の return/throw、同一接続での前後 Fire の時系列が欠落している。従って 4096 の first failure か、512/TTS/transport の別 failure かは未確定である。

## 7. Post-close recovery の独立確認

### Repository fact

`createLazyChannel` の `ensure()` は `channelPromise == null` のときだけ connect し、成功時は `connState="connected"` のまま promise を cache する。catch が promise を null に戻すのは connect 自体が reject した場合だけ（`apps/soul/agent/scripts/cockpit.mjs:163-184`）。返却後の `sendSpeech`/`sendEnvelope`/`sendSet` は channel へ直接委譲し、delegate が reject しても lazy 側に cache invalidation がない（同:186-208）。

`channel-client` の close handler は現在の hello/pending waiter を reject し pending map を clear するが、再接続処理は持たない（`apps/soul/agent/src/channel/channel-client.mjs:117-130`）。sendSpeech は `socket.send(...)` 直後に `withTimeout(settled, replyTimeoutMs, "speech reply")` し、既定 `replyTimeoutMs` は 4000 ms（同:39-40,147-155,224-247）。したがって以下が起きる。

1. oversize close 中に待っていた Fire は close event で exact `closedError` に即時 reject される。
2. lazy cache は closed channel を指したまま残る。
3. 後続 Fire は新規 connect せず、その closed channel の sendSpeech を呼ぶ。
4. WebSocket が send を拒否して throw すれば即時 Fire error、throw せず reply が来なければ `speech reply` の 4000 ms timeout。

この設計上の gap は S3 follow-up に明記されている。「接続成功後の切断は自動回復しない」「次の Fire は sendSpeech の reply timeout 等に落ち続ける」「運用回避は cockpit 再起動」と記録されている（`discussion/ai-cohost/implementation/waves/s3/s3-followup.md:30-38`）。既存 cockpit tests は初回 connect failure の非 cache retry（`cockpit.test.mjs:122-140`）、成功接続の reuse（同:69-92）、明示 close（同:142-161）、URL change（同:201-228）を固定するが、成功後の remote close → 次回自動 reconnect はテストしていない。従って 4000 ms は「失敗後の実測待ち時間」ではなく、hello/reply が来ない場合の hang guard である。

## 8. 技術的必要性、リスク、選択肢（bounded recommendation）

### 8.1 必要性の判定

4096 **そのもの**は技術的必須ではない。codec はそれより大きい frame の header/length を表現できるし、WebSocket 規格の上限でもない。一方、何らかの input boundary は必要である。理由は、超巨大/悪意ある frame が JSON parse、allocation、timeline validation、heart の per-tick scan を一接続で消費し得るためである。512 cap は accepted timeline の scan 負荷を抑えるが、transport が JSON.parse するまでの raw byte/resource を制限しない。

### 8.2 選択肢とリスク

| 選択肢 | 期待効果 | 残るリスク/必要な追加検証 |
|---|---|---|
| 4096 維持 + client preflight | server close を先に起こさず、送れない payload を明示診断できる | 長い speech は依然送れない。UTF-8 byte count、id/数値差を正しく測る必要 |
| 明示値へ引き上げ（例: 8/16/32 KiB） | 110 前後またはそれ以上の timeline を運べる | boundary を超える入力の close test、JSON/heap/CPU、複数 client、raw buffer/in-flight 上限が必要。512 が 19 KiB 程度でも全 valid 形状を保証しない |
| chunking/protocol 分割 | 一発話の wire payload を小さくできる | sequence/再構成/再接続/t=0 semantics が新設計。単なる定数変更ではない |
| 上限を除去 | 任意サイズを一発送信できる | semantic 512 だけでは parse 前の raw input DoS を防がず、現時点では推奨しない |

数字を引き上げる場合も、値は「4096 を消す」ではなく、観測した serialized bytes の最大値 + 明示 margin として定義し、per-connection accumulation/in-flight も別に境界付ける必要がある。

## 9. 次の observation run で先に捕るもの

上限を変更する前に、次の baseline を同じ build/config で保存する。本文・token・API key は保存せず、必要なら長さ/hash と redacted fixture にする。

1. Fire id、開始/終了時刻、effective brain、instruction revision（effective prompt の全文は不要）、model/provider。
2. `speechText.length` と TTS `audio_query` の mora 数、生成後 `timeline.length`、`wavDurationSec`、最初/最後の `timeMs`。
3. client が実際に送る envelope の `Buffer.byteLength(JSON.stringify(...), "utf8")`、frame payload length、id 長。失敗 payload が取れない場合でもこの byte 数と deterministic な redacted fixture を残す。
4. client socket の readyState、open/hello/send/reply/close/error の時刻、close code/reason、send の throw/return、reply RTT、timeout 種別。
5. runtime-player 側の connected count、受信 frame payload length、mask/length decode 分岐、oversize/incomplete/non-final close の理由、accepted/rejected/disconnected events。server process の PID/restart も同じ時系列に置く。
6. lazy channel の `connState` と cache の世代（同一接続を再利用したか）、後続 Fire の再接続有無。
7. `buildSpeechTimeline` throw、server semantic rejection、transport close を別の診断コード/段階として記録する。

baseline を保持した後なら、loopback/token-gated の限定観測で、captured maximum に余裕を足した明示的な上限を一時的に試す余地はある。その場合も 512 semantic cap、mask/length validation、raw accumulation guard、同時接続/in-flight guard は残し、新しい上限の直前/直後・malformed・close・再接続ケースを測る。メモリ/CPU/latency の悪化または close chain の消失だけで成功とせず、baseline と比較してから rollback 可能な形で判断する。4096 を無制限へ変更すること、または今回の事故を確認する前に chunking semantics を決めることは、この棚卸しの範囲外である。

## 10. 判定一覧

- 4096 の由来: **Browser Source の unbounded input レビュー指摘を解消した conservative app boundary。C4 は同値複製。**（proven）
- 4096 の数値根拠: **具体的負荷計算は見つからない。**（unknown）
- 4096 の RFC 必須性: **なし。codec は 126/127 length を扱う。**（proven）
- speech 512 と byte cap の関係: **別軸。valid timeline は 4096 を超え得、E1 では 110 で超えた。**（proven by code + bounded experiment）
- 最初の failure chain: **plausible / not proven without the failed payload and close metadata。**
- post-close lazy recovery: **successful connection close is not auto-recovered; 4000 ms later timeout is a plausible consequence.**（proven by code/design; exact send behavior remains implementation-dependent）
- 次の手順: **cap 変更前に byte/length/close/cache の baseline を保存し、その後にのみ bounded raise を比較観測する。**
