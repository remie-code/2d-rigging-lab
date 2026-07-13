# S6 Domain B: barge-in（会話が続く・相手が話し始めたら声が止まる）

> Status: 実装完了・機械ゲート緑（2026-07-13）。人間ゲート（実配信での barge-in 体感・実マイクでの
> speechStart 反応・口閉じの見え方）は後続 Domain C/D と人間ゲートに持ち越し。**実マイク・実器・実 SDK・
> 実 TTS は一切引いていない（全 fake・無音）**。
> 担当: Gnome（Orch-Sylph 委任）。対象パッケージ: `apps/soul/agent`（独立 npm・workspace glob 外＝lockfile 不変）。
> 契約の正: [../../orchestration/s6-wave-plan.md](../../orchestration/s6-wave-plan.md) §2・§3 Domain B・§4 /
> [../../orchestration/s6-planning-inventory.md](../../orchestration/s6-planning-inventory.md) §2・§3-3・§4-1・§5 /
> 消費した Domain A 成果物: [domain-a.md](domain-a.md)（speak が `playbackStartedAtMs` を返す・player に
> `stop()`/`isPlaying()`・状態応答 STARTED/ENDED/STOPPED/ERROR）。

## 0. パイプライン（この Domain が敷いた線）

```
barge-in 経路（全 fake で縦検証済み）:

  耳（ear-pipeline）── onVadEvent(speechStart/End/Cancel) ──▶ 結線層（cockpit-server startEars）
                                                              │  ① 従来どおり SSE "vad" 放送
                                                              └─▶ ② barge-in gate（機械弁・純部品）
                                                                    speechStart → Nms 待つ
                                                                    speechCancel が来たら取消（瞬間スパイクでは譲らない）
                                                                    Nms 生存 → onConfirm
                                                                       │
                                                                       ▼
                                        fireOrchestrator.interrupt()（speaking 中なら効く・でなければ no-op）
                                           ① player.stop()                      （声を止める）
                                           ② channel.sendSet(mouth-open,0,ttl)   （口を閉じる=強制 release）
                                           ③ computeSpokenPrefix(timeline×経過)  （切断点算出・過大評価しない）
                                           ④ buffer.append(接頭辞+中断注記,soul)  （append-only・1 回）→ onSoulTranscript
                                           ⑤ onDiagnostic({type:"bargeIn",...})  （切断点・声に出た文字数）

再生実区間の追跡（fire-orchestrator・processAskedReply の hasSpeech 経路）:
  ask → speak(口+声) → 【speaking のまま再生実区間を追跡】
      ├─ 自然完了（wavDurationSec 経過タイマ）→ buffer.append(全文,soul) → onSoulTranscript → idle
      └─ interrupt() が来た        → interrupt が接頭辞+注記を append 済み → 二重 append しない → idle
```

- **核心ロジック（機械弁・切断点・interrupt）は純部品/orchestrator 側に置き、全 fake で決定論テスト**（blocking
  基準 4）。cockpit-server の結線は「onVadEvent を SSE 放送**と並んで** gate へ回す」だけの薄い additive 層。
- Domain A の `player.stop()`/`playbackStartedAtMs`・`speak()` の戻り（timeline/wavDurationSec）をそのまま消費
  （Domain A のコード・契約は 1 バイトも変更していない）。

## 1. 実装/変更ファイル一覧（すべて `apps/soul/agent/`・scope 内）

| ファイル | 種別 | 役割 |
|---|---|---|
| `src/mind/barge-in.mjs` | 新規 | barge-in の純部品。`computeSpokenPrefix`（切断点算出・純関数）・`createBargeInGate`（機械弁・注入 timer）・定数 `BARGE_IN_MIN_SPEECH_MS`/`BARGE_IN_NOTE`/`MOUTH_CLOSE_SLOT_ID`/`MOUTH_CLOSE_TTL_MS`。依存ゼロ・I/O ゼロ。 |
| `src/mind/barge-in.test.mjs` | 新規 | 上記の決定論テスト 17 本（切断点の境界・過大評価しない・機械弁の確定/取消/境界）。fake timer 注入。 |
| `src/mind/fire-orchestrator.mjs` | 変更 | ①再生実区間の追跡（speak 戻りで speaking を保つ）②公開口 `interrupt(atMs?)` 新設 ③soul 追記タイミングを **speak 直後 → 発話完了時/中断時** へ変更 ④`setTimeoutImpl`/`clearTimeoutImpl` 注入口。通常 Fire・視覚発火の外形（署名・診断・戻り値）は不変。 |
| `src/mind/fire-orchestrator.test.mjs` | 変更 | barge-in の縦検証 7 本追加（中断・自然完了のタイミング固定・冪等/no-op・口閉じ rejected 握り・dispose 中断・gate 結線縦検証・スパイク取消）。既存 32 本は無変更。 |
| `src/channel/channel-client.mjs` | 変更 | `sendSet(intent)` を参照ドライバ `sendIntent` から写経（payload `{slotId,value,ttlMs?}`・replyTo 相関）。**既定 requiredKinds は不変**（口閉じは best-effort）。 |
| `src/channel/channel-client.test.mjs` | 変更 | sendSet の縦検証 3 本追加（accepted+payload 形・ttlMs 省略・rejected 握り）。既存 11 本は無変更。 |
| `src/test-support/ws-double.mjs` | 変更 | `intent.set` の返答判断 `onSet`（既定 accepted）を additive に追加（従来は未知 kind 扱いで拒否していた）。unknownKind 拒否経路は無退行。 |
| `src/cockpit/cockpit-server.mjs` | 変更（結線・薄い） | barge-in gate を生成（orchestrator が `interrupt` を持つときだけ）し、`onVadEvent` から `gate.handle` を回す。close() で gate.dispose。SSE "vad" 放送は不変。 |
| `scripts/cockpit.mjs` | 変更（結線・薄い） | `createLazyChannel` に `sendSet`、playerProxy に `stop` を追加（orchestrator の interrupt が本番 channel/player へ届くよう配線）。既存の遅延生成・URL 記憶は不変。 |

**器コード（`apps/runtime-player/**`・`packages/**`）・契約 JSON・`pnpm-lock.yaml`・`apps/soul/agent/package.json`
は完全不変**（§7 の `git diff --stat` で確認・新規依存ゼロ・Node 組み込みのみ）。`.tmp/facex-*`（別セッション領分）・
`src/eyes/**`・`src/voice/**`（Domain A の成果物）は一切触っていない。

## 2. 純部品/公開口の契約（引数・戻り値・失敗の扱い）

### 2-1. `computeSpokenPrefix({ speechText, timeline, elapsedMs })` — 切断点算出（純関数）

```
computeSpokenPrefix({
  speechText: string;                          // 声に出そうとした全文
  timeline: Array<{ timeMs?: number }>;        // speak() が返す母音タイムライン（timeMs = WAV 実時間軸のオンセット）
  elapsedMs: number;                           // 再生経過ms（= 中断時刻 − playbackStartedAtMs）
}) => { prefix: string; charsSpoken: number; fraction: number; startedMoras: number; totalMoras: number }
```

- **失敗の扱い**: speechText 非文字列 / timeline 非配列 / elapsedMs 非有限数 は同期 `TypeError`（呼び出し側の
  バグを黙殺しない）。orchestrator は必ず妥当な値を渡す。
- 詳細な写像規則と「過大評価しない」根拠は §3。

### 2-2. `createBargeInGate({ onConfirm, minSpeechMs?, setTimeoutImpl?, clearTimeoutImpl? })` — 機械弁

```
createBargeInGate({
  onConfirm: (event) => void;                  // 確定時に呼ぶ（結線層が orchestrator.interrupt を呼ぶ）
  minSpeechMs?: number = BARGE_IN_MIN_SPEECH_MS(=200);
  setTimeoutImpl?, clearTimeoutImpl?;          // 注入（決定論テスト）
}) => { handle(event): void; isPending(): boolean; dispose(): void }
```

- `handle(speechStart)` → `minSpeechMs` の待機タイマを張る。その間に `handle(speechCancel)` が来たら取り消す
  （瞬間スパイクでは声を止めない）。タイマ生存 → `onConfirm(event)`。`speechEnd` は無関係（無視）。
- 連続 `speechStart` は待機を張り替える（新オンセット優先・二重確定しない）。`dispose()` で待機を畳む
  （event loop に残さない）。時計は持たず timer 制御のみ。

### 2-3. `fireOrchestrator.interrupt(atMs?)` — barge-in の公開口

```
interrupt(atMs?: number) => Promise<{ interrupted: boolean; reason?: string; elapsedMs?: number; charsSpoken?: number; prefix?: string }>
```

- speaking 中（再生実区間を追跡中）なら中断する。それ以外（idle/thinking・既に中断済み・dispose 後）は
  **no-op**（`{ interrupted:false, reason:"not-speaking"|"already-interrupted" }`）。冪等。
- 中断手順: ① `player.stop()`（無ければスキップ）② `channel.sendSet({slotId:"mouth-open", value:0, ttlMs:400})`
  ③ `computeSpokenPrefix` で切断点算出（`elapsedMs = (atMs ?? nowImpl()) − playbackStartedAtMs`）
  ④ `buffer.append({text: 接頭辞+BARGE_IN_NOTE, speaker:"soul"})`（1 回）→ `onSoulTranscript`
  ⑤ `onDiagnostic({ type:"bargeIn", elapsedMs, charsSpoken, totalChars, prefix })`。
- **失敗の握り**（envelope 経路の作法に倣う・**中断を止めない**）: `player.stop()` の throw →
  `bargeInStopError` 診断。sendSet の rejected → `bargeInMouthCloseRejected` 診断。sendSet の throw /
  channel が sendSet を持たない → `bargeInMouthCloseError` 診断。いずれの場合も切断点算出・soul 追記・
  bargeIn 診断は続行する（口が閉じ切らなくても「遮られた事実」は記録する）。

### 2-4. `channel.sendSet({ slotId, value, ttlMs? })` — 口閉じ送出路（channel-client）

```
sendSet({ slotId: string; value: number; ttlMs?: number }) => Promise<{ result; error; rttMs }>
```

- ワイヤは `{ v:1, id, kind:"intent.set", payload:{slotId, value, ttlMs?} }`（reference-driver の sendIntent と同一形）。
  `ttlMs` は指定時のみ payload に載せる（省略 = 器既定窓）。replyTo 相関で accepted/rejected を受ける。
- barge-in 用途は `slotId:"mouth-open", value:0`（mouth-open の域は 0..1・0=閉口）。**器コード/契約 JSON は不変**
  （器は C5 から intent.set を広告済み＝送出路を魂側に足すだけ）。**既定 requiredKinds は変えない**（intent.set
  非広告の相手でも接続は張れる＝口閉じは best-effort・S1〜S5 の接続契約に無影響）。

## 3. 切断点の写像規則と「過大評価しない」根拠（正直性の設計・blocking 基準 4）

`timeline` は voiced 母音のオンセット時刻（timeMs・WAV 実時間軸）のみで、脱落モーラ（っ/ー/ん など）は要素を
持たず時間スロットだけ消費する。`speechText` は文字列。両者の直接アラインメントは持たないため、次の規則を採る:

```
startedMoras = timeMs < elapsedMs を満たすタイムライン要素数   （オンセットを厳密に過ぎたモーラ）
fraction     = startedMoras / totalMoras
charsSpoken  = floor(fraction × speechText.length)            （文字位置へ比例写像・端数切り捨て）
prefix       = speechText.slice(0, charsSpoken)
```

**「声に出とらん文字を出たことにしない」ための 3 つの保守化**:
1. **厳密不等号 `<`**: モーラはオンセット時刻を厳密に過ぎて初めて「発声が始まった」と数える。`elapsedMs=0` なら
   `timeMs<0` を満たす要素は無く 0 文字（経過0 = 何も出ていない）。オンセット丁度（`elapsedMs = timeMs`）でも
   数えない（その母音は今まさに立ち上がる瞬間でまだ音になっていない）。**最後の母音オンセット丁度でも全文にはせず**、
   厳密に過ぎて初めて全文になる（経過≥全長 = 全文）。
2. **floor**: 比例写像の端数は必ず切り捨てる（四捨五入や切り上げをしない = 多めに言わない）。
3. **オンセット基準の按分**: 脱落文字（timeline に出ない文字）は voiced モーラ間に散在するため、「始まった voiced
   モーラの割合」を全文長へ比例させることでそれらも按分される。曖昧な端は 1・2 が保守側へ倒す。

境界の決定論テスト（`barge-in.test.mjs`）: 経過0=空 / 経過負=空 / 最初のオンセット丁度=0 / 途中=接頭辞 /
最後のオンセット丁度=まだ全文でない / 厳密に過ぎたら全文 / 文字数>モーラ数でも単調非減少かつ過大にならない /
空 timeline・空文字=0 / timeMs 非数の要素は数えない / 不正入力 throw。

## 4. soul 追記タイミング変更の内容と、更新した既存テスト

### 4-1. 変更の内容（裁定済みの意図変更・wave 計画 §2・§3）

従来（S3〜S5）: `processAskedReply` は `speakImpl` が resolve した直後に `buffer.append(全文, soul)` していた。
`player.play()` は非ブロッキング送出なので、**実際の音声再生中にはもう soul を積んで idle へ向かっていた**
（inventory §3-3）＝barge-in が効く窓が存在しなかった。

S6 では、speak() の戻り（`timeline`・`wavDurationSec`・`playbackStartedAtMs`）で **再生実区間を追跡**し、その間
`speaking` 状態を保つ（`wavDurationSec` の完了タイマ or `interrupt()` のどちらかで window を閉じる）。soul 追記は
**発話完了時（全文）または barge-in 中断時（接頭辞 + 中断注記）の 1 回だけ**行う。

- **転写バッファの append-only 維持**: 1 発話につき soul append は依然 1 回（全文 or 接頭辞+注記のどちらか）。
  上書き・削除はしない。「遮られた事実」は上書きではなく **接頭辞 + `BARGE_IN_NOTE("…（遮られた）")`** の追記で表現する。
- **busy 状態機械の意味の変化**: `speaking` が実再生区間を覆うようになった＝再生中の 2 発目 fire は busy で無視される
  （従来は再生中でも idle に戻っていた）。`interrupt()` はこの `speaking` window に効く。

### 4-2. 既存テストへの影響（無退行）と更新方針

**既存の機械テストは 1 本も期待値を変えずに緑のまま**である。理由: 既存テストの fake speak は全て
`wavDurationSec: 0` を返すため、完了タイマは 0ms で発火し、`await orch.fire()` がその完了（= 全文 append）まで
自然に覆う＝**観測上は従来と同一**（thinking→speaking→idle・soul に全文・onSoulTranscript 1 回）。したがって
「追記タイミングの変更」はコード上の意図的差分だが、0 尺 fake の既存テストでは観測差が出ず、他の挙動退行も混ざらない。

**タイミング変更を新規テストで明示的に固定**した（`fire-orchestrator.test.mjs`）:
- 「interrupt なし: 自然完了で全文を soul 追記」: `wavDurationSec:2` の fake で **speaking に到達した時点では soul
  未追記（`buffer.all().length===1`）**、完了タイマを 2000ms 進めて初めて全文が積まれることを固定＝タイミング変更の証拠。
- 「interrupt: 再生中の barge-in …」: 再生中に `interrupt` → 接頭辞+注記が 1 回積まれ、stop/口閉じ/bargeIn 診断が
  出ること、二度目の interrupt が no-op（追記が増えない）ことを固定。

**S3/S5 無退行の担保**: 手動 Fire・視覚発火（`fire({vision:true})`）・soul broadcast 経路（onSoulTranscript）・
usage 計器・演出 envelope の外形は不変（`processAskedReply` の分岐・診断発行順序・戻り値の形は hasSpeech 経路の
末尾だけを差し替え・他は据え置き）。既存 32 本 + 視覚/演出/usage 系は全通過。cockpit-server の実 orchestrator 縦貫通
テスト（fake session/speak・実バッファ）も無変更で緑。

## 5. 結線層（cockpit-server / cockpit.mjs）の薄さと additive 性

- `cockpit-server.mjs`: `onVadEvent` は従来どおり SSE "vad" を放送し、**その直後に `bargeInGate.handle(e)` を呼ぶ
  だけ**（gate が無ければ何もしない）。gate は **orchestrator が `interrupt` を持つときだけ生成**する（fake
  orchestrator を注入する既存テストは `interrupt` を持たない＝gate 未生成＝無影響）。close() で gate.dispose。
- `cockpit.mjs`: 本番 channel（`createLazyChannel`）に `sendSet`、playerProxy に `stop` を足しただけ（遅延生成・
  URL 記憶・接続キャッシュのロジックは不変）。orchestrator の `interrupt` が本番の channel/player へ届く配線。
- **手動 Fire・視覚発火の経路は不変**。barge-in の核心ロジックは純部品/orchestrator 側に閉じ、結線層は「VAD →
  gate → interrupt」の糸を張るだけ（blocking 基準 4 の「全 fake 縦検証」は `fire-orchestrator.test.mjs` の
  「結線: createBargeInGate 確定 → interrupt」「窓内 speechCancel は interrupt を呼ばず自然完了」で担保）。

## 6. 定数（v0 コード内定数・ツマミは作らない・wave 計画 §2 裁定 8）

| 定数 | 値 | 意味・調整方針 |
|---|---|---|
| `BARGE_IN_MIN_SPEECH_MS` | 200 | 機械弁の待機。短いほど barge-in は速いが瞬間スパイクを拾いやすい（誤爆は免罪符）。人間ゲートの体感で直す。 |
| `BARGE_IN_NOTE` | `"…（遮られた）"` | 中断注記。接頭辞末尾に付けて「遮られた事実」を会話の記憶に残す（次の発火の注入で読める）。 |
| `MOUTH_CLOSE_SLOT_ID` | `"mouth-open"` | 口を閉じる intent.set の宛先（value=0 で speech タイムライン強制 release・inventory §2）。 |
| `MOUTH_CLOSE_TTL_MS` | 400 | 口閉じ intent.set の ttl（器既定 release 窓と同尺）。基底 0=閉口なので満了後も閉じたまま。 |

## 7. 器不変・依存ゼロ・チェック無退行の確認

```
git diff --stat -- apps/runtime-player packages                              → 出力なし（器コード不変）
git diff --stat -- apps/runtime-player/src/main/control-channel/contract/*.json → 出力なし（契約 JSON 不変）
git diff --stat -- pnpm-lock.yaml apps/soul/agent/package.json               → 出力なし（lockfile・依存不変＝新規依存ゼロ）

本 Domain の変更ファイル（git status --porcelain・.tmp / Domain A の voice 成果物を除く）:
   M apps/soul/agent/scripts/cockpit.mjs                    (+16 −0)
   M apps/soul/agent/src/channel/channel-client.mjs         (+31 −1)
   M apps/soul/agent/src/channel/channel-client.test.mjs
   M apps/soul/agent/src/cockpit/cockpit-server.mjs         (+33 −1)
   M apps/soul/agent/src/mind/fire-orchestrator.mjs         (+220 −7)
   M apps/soul/agent/src/mind/fire-orchestrator.test.mjs
   M apps/soul/agent/src/test-support/ws-double.mjs         (+11 −2)
  ?? apps/soul/agent/src/mind/barge-in.mjs
  ?? apps/soul/agent/src/mind/barge-in.test.mjs
```

- `audio-player.*`・`speak.*`・`fake-media-player.mjs`・`preflight-voice.mjs` の変更は **Domain A の未コミット成果物**
  であり本 Domain では 1 バイトも触っていない（読んで契約を消費しただけ）。
- 構造チェック 3 種（このセッション実行・リポジトリ root）:
  - `check:deps`: **passed**（Dependency guard passed）。
  - `check:soul-zone`: **passed**（1339 files・器↔魂 越境 import なし。barge-in.mjs は同一魂ゾーン内）。
  - `check:source`: 唯一の違反は `apps/runtime-player/src/main/physiology/index.ts`（器コード・**本 Domain で不変＝
    `git diff --stat` 空**）。私のスコープ（soul/agent）には違反ゼロ。この違反はブランチ既存（器側 pre-existing・
    Domain A §7-4 で申し送り済み）＝無退行。
- `.tmp/facex-*`（別セッション領分）は一切触っていない。実 SDK・実 PowerShell・実マイク・実 TTS はいずれも
  呼んでいない（player/channel/segmenter イベント/clock/timer すべて fake・無音）。

## 8. §質問（Orch / Domain C・D への申し送り・迷った裁定点）

1. **`fire()` が再生実区間を await するようになった（HTTP レイテンシの意味変化）**: Design 判断として `fire()` は
   speak() 後、**自然完了 or barge-in 中断まで await する**（その間 speaking 状態）。従来は play() 送出直後に
   resolve していた（≒即時）。よって POST /api/fire の HTTP 応答は「発話が終わる or 遮られる」まで返らなくなる
   （barge-in で早期に返る）。実配信では発話 1 本の尺（数秒）だけ応答が遅れる。これで良いか、あるいは `fire()` を
   早期 resolve させ再生追跡を裏で回す形（Design Y）にすべきか、Domain D の操縦席 UX（発火ボタンの応答体感・
   measure-fire の意味）と合わせて裁定してほしい。**機械テストは全 fake が `wavDurationSec:0` のため無退行**。
2. **機械弁窓（200ms）と耳セグメンタの speechCancel タイミングの相互作用**: セグメンタの spike 棄却
   （speechCancel）は「発話長 < minSpeech(既定 250ms) の無音確定後」に来るため、機械弁窓（200ms）より遅れて
   届き得る＝一部の短スパイクでは機械弁が先に確定して声を止める（起きてよい失敗＝免罪符・裁定 2）。窓の値は
   人間ゲートの体感調整用（v0 定数）。ear-pipeline の `minSpeechMs`/`minSilenceMs` と機械弁窓を連動させる設計が
   要ると分かったら、その時に根拠付きで足す（現状は独立定数）。
3. **切断点算出は「時間比 × 全文長」ではなく「始まった voiced モーラの割合 × 全文長」を採った**: 母音オンセットが
   実発声イベントの最も真な信号だから（時間比は WAV の pre/post 無音を按分に含めてしまう）。文字とモーラの厳密な
   アラインメントは持たないため近似だが、§3 の 3 保守化で過大評価しない側に倒している。実人声での体感（遮られた
   位置と記録位置のズレ）は人間ゲートで観測してほしい。ズレが実害なら Domain A に POSITION 応答を足して実 Position
   で算出する余地がある（Domain A §7-1 の申し送りの回収先）。
4. **中断注記は接頭辞 0 文字でも付く**: barge-in が発話ごく直後（`charsSpoken=0`）に来た場合、soul 行は
   `"…（遮られた）"`（注記のみ）になる（transcript-buffer は非空なので積む）。「魂が喋り出す前に遮られた」事実を
   会話の記憶に残す設計だが、次の注入で注記のみ行が出るのが煩いと判断されたら「0 文字なら追記しない」へ倒す余地が
   ある（現状は「遮られた事実は常に残す」側）。
5. **口閉じの見え方（人間ゲートへ）**: mouth-open へ value=0・ttl 400ms を送ると器は speech タイムラインを
   releaseMs(既定 400ms) かけて基底へ強制 release する（inventory §2・実機未検証の既存意味論）。**実際の口の
   閉じ方（release が自然か・声停止と口閉じの体感ズレ）は実器での目視が要る**（wave 計画 §1 ①・§6-2）。この Domain
   は全 fake ゆえ「sendSet が正しい payload で 1 回飛ぶ」までしか検証していない。
6. **cockpit-server の barge-in 結線に専用機械テストは置いていない**: 核心（機械弁・切断点・interrupt）は純部品/
   orchestrator 側で全 fake 縦検証済み（`fire-orchestrator.test.mjs` の gate 結線テストが VAD イベント → gate →
   interrupt の縦串を固定）。cockpit-server の結線は「onVadEvent → gate.handle」の薄い糸で、既存 cockpit-server
   テスト（実 orchestrator 縦貫通含む）が全緑であることで無退行を担保した。実マイク経由の speechStart → 実 barge-in
   の end-to-end は人間ゲート/実 SDK 確認（Domain D）の領分。

## 9. 機械ゲート生数字

`cd apps/soul/agent && node --test`（全テスト・新規込み総数・タイムアウト 300s 付きで実行）:

```
# tests 452
# pass  452
# fail  0
# cancelled 0
# skipped 0
# todo 0
```

**S6 Domain A 後ベースライン 425 → 452（+27）**。内訳:
- `src/mind/barge-in.test.mjs`: **+17**（新規）。切断点算出 10 本 + 機械弁 6 本 + 定数 1 本。
- `src/channel/channel-client.test.mjs`: 11 → 14（**+3**）。sendSet accepted（payload 形・replyTo）/ ttlMs 省略 /
  rejected 握り。既存 11 本は無変更。
- `src/mind/fire-orchestrator.test.mjs`: 32 → 39（**+7**）。中断縦検証 / 自然完了タイミング固定 / no-op 冪等 /
  口閉じ rejected 握り / dispose 中断 / gate 結線縦検証 / スパイク取消。既存 32 本は無変更＝無退行。
- 他ファイル（cockpit-server・cockpit・cli・speak・audio-player 等の既存テスト）は**期待値変更ゼロで全通過**
  （soul 追記タイミング変更は 0 尺 fake で観測差が出ないため無退行・§4-2）。

実 SDK・実 PowerShell・実マイク・実 TTS はいずれも呼んでいない（全 fake・無音・SDK 実消費ゼロ）。
```
git diff --stat -- apps/runtime-player packages pnpm-lock.yaml apps/soul/agent/package.json → 出力なし
```
