# Domain H Gnome 報告 — 判定と発火の記録・途中保存のタイマー（設計 §13.6・§13.7）（Gnome 2026-11-01）

> 計画: [../../orchestration/discord-mode-wave-plan.md](../../orchestration/discord-mode-wave-plan.md) §8 Domain H。設計 [../../../architecture/discord-mode.md](../../../architecture/discord-mode.md) §13.6・§13.7。
> ブランチ `ai-cohost/discord-mode`（HEAD `cc36a33a`）。**コミットしていない**。ブランチも切り替えていない。
> 鍵（`.env*.local`）は読んでいない。実データ（`cockpit-settings.local.json`・`memories/`・`roles/`・`session-usage/`・`fire-diagnostics/`）には触れていない（読み書きなし）。操縦席を起動していない。本物の Discord・LLM・外部 API は呼んでいない。依存・lockfile の変更なし。②④の配信の文面・`_conventions.md`・種のファイル・`src/mind/fixtures/` は変えていない。

## 1. 変更・追加したファイル（`apps/soul/agent/` 起点）

### 実装

| ファイル | 中身 |
|---|---|
| `src/mind/session-usage-log.mjs` | 純関数 `judgmentUsageRecord`・`fireRefusedUsageRecord`・`controlUsageRecord` と、一覧 `JUDGMENT_CHOICES`・`JUDGMENT_ERROR_KINDS`・`USAGE_CONTROL_KINDS` を足した（既存の関数・ファイルの作り・残す数は不変） |
| `src/mind/speak-now-decisions.mjs` | `SpeakNowJudgeError` に 3 つ目の引数 `{ kind, status }` を足し、`this.kind`・`this.status` を持たせた。throw する 7 か所に種類を付けた（`message` は一字も変えない） |
| `src/mind/speak-now.mjs` | 判定の失敗の `onError` に、失敗が種類を持つときだけ `errorKind`・`errorStatus` を足す（持たなければ今の形のまま） |
| `src/cockpit/cockpit-server.mjs` | `options.onFireRefused`・`options.onControl` と、包む `reportFireRefused`・`reportControl`（失敗寛容）。呼ぶ所: `requestSelfFire` の stream-not-open・`refuseManualFireOutsideStream`（引数に `{ vision }`）・orchestrator の `onFire` の `accepted:false`・`POST /api/self-fire`・`/api/barge-in`・`/api/kill`。判定の失敗の `reportSpeakNow` に `errorKind`・`errorStatus`（持っていれば） |
| `scripts/cockpit.mjs` | `MEMORY_CHECKPOINT_TICK_MS`（1 分）・`isMemoryCheckpointDue`（純関数）を export。`createStreamVenueHooks` に起点 3 つ（場の始まり・前の保存・前に頼んだ時刻）と `deps.checkpointIntervalMs`。main のタイマーを 1 分ごとに。`recordSessionUsage`（今の場の記録へ 1 行・null は書かない）。`onSpeakNowJudgment` は今の 1 行のまま記録にも 1 行、`onFireRefused`・`onControl` を server に渡す |

### テスト

| ファイル | 中身 |
|---|---|
| `src/mind/session-usage-log.test.mjs` | +5 件（判定の成功・失敗、断り、つまみ、同じファイルに type を分けて足す） |
| `src/mind/speak-now-decisions.test.mjs` | +1 件（失敗の種類 6 つ・status・既存の作り方は null） |
| `src/mind/speak-now.test.mjs` | +1 件（onError に errorKind・errorStatus が足される） |
| `src/cockpit/cockpit-server-discord-h.test.mjs`（新規） | 6 件（自発の stream-not-open・手動の stream-not-open・orchestrator の受理しない・つまみ・口の失敗で止めない・判定の失敗の種類） |
| `scripts/cockpit-stream.test.mjs` | +7 件（midwrite の再現・場の始まりから 20 分・手動で起点が戻る・失敗し続けても毎分頼まない・増えていなければ頼まない・配信と Discord の場で同じ・main の結線）。既存 2 件の期待値を変えた（§6）。`makeVenue` に `advance(ms)` |
| `scripts/cockpit.test.mjs` | +3 件（記録の結線・`isMemoryCheckpointDue`・`MEMORY_CHECKPOINT_TICK_MS`） |

## 2. 各 type の欄の形（そのまま）

どの行も `createSessionUsageLog().append` を通るので、頭に `schema: "soul-session-usage-v1"`・`wallTimeMs`（append の時刻）が自動で付く。ファイルは場ごと（`renewRecords` で作り直す今の作り）。頭の種類に関係なく書く。

```js
// type:"judgment"（onSpeakNowJudgment の info から）
{ type: "judgment",
  ok: boolean,
  trigger: string | null,        // "transcript" / "after-busy"（英小文字・数字・- の 40 字までの語だけ。ほかは null）
  triggerSeq: number | null,     // 転写の seq（成功のときだけ届く）
  choice: "wait" | "backchannel" | "respond" | "initiate" | "look" | null,
  p: number | null,              // 選んだものの確率
  probs: { wait, backchannel, respond, initiate, look } | null,  // 各 number | null。ほかのキーは拾わない
  action: string | null,         // "fire" / "none" / "drop-busy" / "drop-inactive" / "skip-interval"
  latencyMs: number | null,
  errorKind: null | "no-key" | "network" | "auth" | "http" | "timeout" | "shape" | "unknown",
  errorStatus: number | null }   // auth・http のときの HTTP の状態の数

// type:"fire-refused"（server の onFireRefused の info から）
{ type: "fire-refused",
  cause: string | null,          // きっかけの種類: speak-now / manual / recall / silence / call / turn-end / interjection / comment / comment-call / comment-react …
  reason: string | null,         // stream-not-open / busy / killed / ears-not-running / empty-window / vision-no-target（I は not-in-vc を足せる）
  vision: boolean }

// type:"control"（server の onControl の info から。許す一覧に無い名前は null を返し、書かない）
{ type: "control",
  control: "self-fire" | "barge-in" | "kill" | "vc-join" | "vc-leave" | "vc-move" | "vc-disconnect",
  from: boolean | null,          // 前の値（つまみだけ。VC の出来事は null）
  to: boolean | null }
```

- 判定の失敗のエラー文（`info.error`）は書かない。種類は `SpeakNowJudgeError.kind`（文の照合ではない）。種類を持たない失敗（判定エンジンの外の throw）は `"unknown"`。
- きっかけ（`cause`）のほかの欄（確率・コメントの id・転写の seq・`found`）は server が渡さず、記録の純関数も受ける欄を持たない。
- 語の欄（trigger・action・cause・reason）は `/^[a-z][a-z0-9-]{0,39}$/` に合わなければ null（文・名前・id が紛れても書かない保険）。

## 3. 途中保存の判定の式と定数

- 定数: `MEMORY_CHECKPOINT_INTERVAL_MS = 20 分`（値は不変・意味を「起点からの経過」に）、`MEMORY_CHECKPOINT_TICK_MS = 1 分`（新規・main の `setInterval` の間隔）。
- `checkpoint()` が頼むのは、次のすべてが成り立つときだけ（上から順に見る）:
  1. 場が `open`（今と同じ）
  2. 転写の件数が前の保存（`lastRecordedSeq`）と違う（今と同じ）
  3. `isMemoryCheckpointDue(now, since)`: `now − max(場の始まり, 前の保存, 前に途中保存を頼んだ時刻) ≥ 20 分`（null は数えない。3 つとも null なら false）
- 頼んだら「前に頼んだ時刻」を now にする。3 つの起点は `renewRecords` で戻す（場の始まり = その時刻、ほかは null）。
- 「前の保存」= `noteSaved` が今の場の保存として数えたとき（途中・手動「今日を記録」・最後のどれでも）に、場の時計 `nowImpl()` で取った時刻。
- 時計はどれも `deps.nowImpl`（既にあった口。既定 `Date.now`）。
- 張る所は main の起動時の 1 か所のまま（`unref()`・止める所なし）。体験の種類は見ないので配信の場にも同じく効く。

## 4. 確かめ（機械ゲート）

- `apps/soul/agent` で `node --test`: **2199 / 2199 pass**（土台 2176 → +23 件。fail 0）。
- リポジトリの根で `pnpm run check:soul-zone`: **pass**（`Soul zone boundary guard passed: 1612 source files scanned`）。
- `src/mind/fixtures/` の差分 0（`git status` に出ない）。`stream-wording-pin.test.mjs` は全体の中で pass。
- session-usage を読む既存のもの: `grep -rn "session-usage\|sessionUsage"` をリポジトリ全体でかけて、読むコードは無い（書くのは `cockpit.mjs` だけ・ほかはテストと本体のモジュール）。知らない type で壊れるものが無い。新しい行を同じファイルに既存の行と混ぜて書けることはテストした。

## 5. 判定・発火のふるまいを変えていないこと

- server の追加は記録の口を呼ぶだけ（戻り値・409 の本文・SSE・snapshot・ゴースト行は不変）。口の throw は握る（テスト「口の失敗で止めない」）。
- `speak-now.mjs` の追加は `onError` に渡す値に欄を足すだけ（種類を持たない失敗は今と同じ形。既存テスト `speak-now.test.mjs` の「判定の失敗は onError」・`cockpit-server.test.mjs:4952` の deepEqual は期待値を変えずに pass）。
- `speak-now-decisions.mjs` は `message`・`latencyMs` を変えていない（既存の文面のテストは期待値を変えずに pass）。
- 判定・発火の既存テストの期待値は 0 変更。

## 6. 期待値を変えた既存テスト（仕様変更 = 途中保存は経過時間で頼む）

| ファイル:行（今の行） | 前 → 後 | 理由 |
|---|---|---|
| `scripts/cockpit-stream.test.mjs:881-884`（テスト「場が閉じている間: 「今日を記録」は断る…開いている間は動く」） | 「二言目」を足してすぐ `checkpoint() === true` → すぐは `false`（「前の保存（手動）から 20 分たっていない」）を足し、`v.advance(MEMORY_CHECKPOINT_INTERVAL_MS)` のあとで `true` | 手動の保存で起点が戻るため。開いてすぐは頼まない |
| `scripts/cockpit-stream.test.mjs:1170-1172`（テスト「2 つ目の場: 前の場の lastRecordedSeq で新しい場の保存が飛ばされない」） | B1〜B3 を足してすぐ `checkpoint() === true` → `v.advance(MEMORY_CHECKPOINT_INTERVAL_MS)` を挟んでから `true`（アサーションの文と期待値 `true` はそのまま） | 新しい場の始まりから 20 分たってから頼むため |
| `scripts/cockpit-stream.test.mjs:21-22`・`:272-278` | `MEMORY_CHECKPOINT_INTERVAL_MS` の import と `makeVenue` の `advance(ms)` を足した（期待値ではない・上の 2 件のため） | 時計を進める口 |

- 変えなかったもの: `scripts/cockpit-stream.test.mjs` の main の結線のテスト（今の `:1279` の `streamVenue\.checkpoint\(\);` と `renewUsageLog` の正規表現はそのまま通る）、`scripts/cockpit.test.mjs:1085-1100`（閉じた後は動かない・そのまま通る）・`:1141-1143`（20 分の定数・値は不変なのでそのまま通る）。どれも削ったアサーションは無い（差分は挿入だけ）。

## 7. 裁量（設計に書いていない小さな分岐を、筋の通る形で決めたもの）

1. **起点に「この場で最後に途中保存を頼んだ時刻」を含めた**。保存が失敗し続けても 1 分ごとに頼み直さず、今の 20 分おきの頻度を超えない（テスト「保存が成り立たなくても、毎分は頼み直さない」で 20・40・60 分）。手動の保存は「成り立った時刻」でだけ起点を戻す（手動の頼みが失敗したら起点は戻らない）。
2. **`noteSaved` の `atMs` は「保存が終わった時刻」**（`createMemoryRecorder` の `runOnce` で `writeImpl` が返って `written` のときの `nowImpl()`。頼んだ時刻ではない）。起点には `info.atMs` を使わず、`noteSaved` を受けた時点の場の時計 `nowImpl()` を使った。`onSaved` は終わった直後に同期で呼ばれるので本番では同じ時刻。保存の係と場で時計を別々に差し替えたテスト（`makeVenue` は保存の係が本物の `Date.now`、場が偽の時計）でも起点がずれないため。snapshot の `lastRecordAtMs` は今までどおり `info.atMs`。
3. 判定の記録に `triggerSeq`（転写の seq の数）を載せた（中身・id ではなく、きっかけの行を結ぶ数）。失敗の行は今の `onSpeakNowJudgment` の info に seq が無いので null（足すと `cockpit-server.test.mjs:4952` の deepEqual が変わるため足していない）。
4. `errorStatus`（auth・http の HTTP の状態の数）も載せた。429 と 500 を見分けるため。数だけで、相手の文・エラーの code（`credit_balance_exhausted` など）は書かない。
5. つまみの行は、受け付けた API の呼び出しごとに 1 行（前後が同じ値でも書く）。400・503 で受け付けなかったものは書かない。
6. 場が閉じている間の手動の Fire の断り・つまみの切り替えは、今の `sessionUsageLog`（直前の場のファイル、場をまだ開いていなければ起動時刻のファイル）に入る。場ごとのファイルの今の作りのまま（起動時刻のファイルは書くものがあったときだけできる）。開きかけの断りは、`renewRecords` が先に走るので新しい場のファイルに入る。
7. fire-refused の `vision` は `vision: true` の発火（silence・Fire+視覚）だけ true。`"preferred"`（自発の画面つき）は false。
8. 断りの記録の置き場を server に 1 本化した。orchestrator の `accepted:false` は `cockpit.mjs` の `onFire` の包み（`:3155` 付近）ではなく、それが呼ぶ server の `onFire`（`hooks.onFire`）で拾う。cockpit.mjs の `onFire` の包みは変えていない。これで 3 つの断りが同じ口 `onFireRefused` を通り、2 重にならない（自発の道で orchestrator が断ったときも 1 回だけ。テストで確かめた）。
9. 種類の語は英小文字・数字・- の 40 字までに限った（`token`）。`USAGE_CONTROL_KINDS` に I〜K の VC の 4 語を先に置いた。
10. `createStreamVenueHooks` の `deps.checkpointIntervalMs`（既定 20 分）を足した（本番は渡さない・差し替えの口だけ）。

## 8. 持ち越し（止めない・今回の範囲の外）

1. 判定を呼ばない道（自発オフ・KILL・忙しい間に数えただけ・相槌の後の `skipAfterBusy` の捨て・窓が空）は記録しない（silence 調査 §4 の 2。判定が走らないので judgment の行が無い）。数を残すなら speak-now の中に口が要る（ふるまいは変えずに足せる）。
2. コメント反応の判定（`onCommentJudgment`）は記録していない（Discord では作らない・計画の範囲は speak-now）。`createDecisionsQuestionsJudge` の失敗も `kind` を持つようになったので、足すときは同じ形で書ける。
3. `requestSelfFire` の `.catch` の `reason:"error"`（orchestrator の `fire()` が reject したとき）は「断り」ではなく失敗なので fire-refused にしていない。orchestrator の資源の用意の失敗（`fire-orchestrator.mjs:1598-1604`・`onFire` を出さない）も同じく記録の外。
4. 判定の窓の形（行の数・文字数・指紋など・judge-wait 調査 §5）は載せていない（設計 §13.7 に無い）。
5. 発火の終わりの理由（barge-in・失敗）を fire の行に足すのは範囲の外（silence 調査 §4 の 6）。

## 9. 質問

- なし（判定・発火のふるまいを変える分岐は出なかった）。裁量 1（前に頼んだ時刻も起点に含める）と裁量 6（場の外の断り・つまみは直前の場のファイルに入る）は、見直しで違うと言われたら直しやすい所に閉じてある。

## 10. I〜K への申し送り（`control` / `fire-refused` の口の使い方）

- **server の中から**（VC の API・Discord の体験の口の知らせを受ける所）: `reportControl({ control: "vc-join" })` / `"vc-leave"` / `"vc-move"` / `"vc-disconnect"` を呼ぶだけ。`from`・`to` は省く（null になる）。VC の名前・Discord の id は渡さない（渡しても記録の純関数が拾わない）。`reportControl` は `createCockpitServer` の中の関数で、失敗寛容。
- **cockpit.mjs の側から**（`createDiscordVenueExperience` の知らせなど、server を通らない所）: main の `recordSessionUsage(controlUsageRecord({ control: "vc-disconnect" }))`。
- 新しい名前が要るとき（例: 動かされた・4014 を分けたい）: `src/mind/session-usage-log.mjs` の `USAGE_CONTROL_KINDS` に足し、`session-usage-log.test.mjs` の一覧の deepEqual を直す（一覧に無い名前は書かれない）。
- **I の `not-in-vc`**: `requestSelfFire` と `refuseManualFireOutsideStream` の近くで断るときに `reportFireRefused({ cause: <きっかけの種類>, reason: "not-in-vc", vision })` を呼ぶ（記録の純関数は `not-in-vc` をそのまま通す・テスト済み）。stream-not-open の断りと同じ書き方。orchestrator まで届いて断られた分は server の `onFire` で自動で拾われるので、同じ断りを 2 度呼ばないこと。
- 途中保存（§3）は体験の持ちもの（場の始まり = `renewRecords`）。VC の入る・抜ける・移るでは起点を戻さない（`renewRecords` を呼ばないこと）。
