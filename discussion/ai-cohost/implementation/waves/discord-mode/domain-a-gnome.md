# Discord モード Domain A — Gnome の完了報告(会話の正本を場へ・話者の形)

> 2026-10-31。ブランチ `ai-cohost/discord-mode`(HEAD `6327a42b`。コミットしていない)。根拠: 計画 [discord-mode-wave-plan.md](../../orchestration/discord-mode-wave-plan.md) §1 Domain A・§4、設計 [discord-mode.md](../../../architecture/discord-mode.md) §3.1〜§3.4・§10・§12.3、棚卸し [discord-mode-inventory.md](../../orchestration/discord-mode-inventory.md) §2.1・§2.9・§3.3。

## 1. 着手時と採取時のワークツリー・固定テスト

着手時(コードに触る前):

```
$ git status --short
(出力なし)
$ git diff --quiet HEAD -- apps/soul/agent; echo exit=$?
exit=0
$ git rev-parse HEAD
6327a42b710e3ea123ec877c725648804a101691
$ git diff --stat
(出力なし)
```

採取(期待値の書き写し)の直前と直後。新しく置いたのは入力と呼び出しの 2 本(追跡外の新規)だけで、追跡しているコードの差分は 0:

```
== before capture: git diff --stat ==
(出力なし)
?? apps/soul/agent/src/mind/fixtures/stream-wording-pin-calls.mjs
?? apps/soul/agent/src/mind/fixtures/stream-wording-pin-input.mjs
== tracked code diff in apps/soul/agent ==
exit=0
cases 35
== after capture: git diff --stat ==
(出力なし)
?? apps/soul/agent/src/mind/fixtures/stream-wording-pin-calls.mjs
?? apps/soul/agent/src/mind/fixtures/stream-wording-pin-expected.mjs
?? apps/soul/agent/src/mind/fixtures/stream-wording-pin-input.mjs
```

採取はスクラッチに置いた一時のスクリプト(呼び出しの一覧を読み、各ケースの出力を `JSON.stringify` で文字列のリテラルにして expected に書く)で行い、終わってから消した。

固定テストの置き場:

| ファイル | 中身 |
|---|---|
| `apps/soul/agent/src/mind/stream-wording-pin.test.mjs` | テスト本体。ケースごとに `assert.strictEqual(produce(), expected)`。ケースの一覧と期待値の鍵が一致することも確かめる(36 件) |
| `apps/soul/agent/src/mind/fixtures/stream-wording-pin-expected.mjs` | 期待値(HEAD の出力を書き写した文字列 35 本)。**ブランチの最後まで変えない** |
| `apps/soul/agent/src/mind/fixtures/stream-wording-pin-calls.mjs` | 呼び出し(各ケースの文字列を今のコードで作る関数)。組み立てが替わったら**ここだけ**を合わせる |
| `apps/soul/agent/src/mind/fixtures/stream-wording-pin-input.mjs` | 入力の転写 1 つ(you / soul / 名前つき viewer `"  山田  太郎 "` / 名前の無い viewer / 空白の名前の viewer `"   "` / どの窓の外の行 seq 0)。soul の行にはロールの名前と id を載せた(HEAD の整形は見ないので、そのまま写せる。「ロールが 1 つの間は `soul: 本文`」を固定する)。④の頼みごと・要約(括弧・改行・CRLF 入り)、②の既存ファイル、コメント 2 件 |

対象の関数と固定したケース:

- ①: `formatFireInjection`(窓・文字数上限 60 の text と数)、`formatFireInjectionSince`(afterSeq 3 / null / 7 = 新しい行なし)。
- ②: `WRITER_SYSTEM_PROMPT`、`formatTranscriptForDigest`、`buildWriterRequest`(本体なし / 本体あり)。
- ④: `RECALL_SYSTEM_PROMPT`、`formatRecentConversation`(1 分・窓を広げて全行)、`buildRecallRequest`(会話あり / 空)、結果の 7 関数(`buildRecallFoundInstruction`・`buildRecallNotFoundInstruction`・`buildRecallDeferredNote`・`buildRecallNotFoundDeferredNote`・`buildRecallSilentFoundNote`・`buildRecallFailedInstruction`・`buildRecallFailedDeferredNote`)。
- `skills/recall.md`: **読み込み口 `loadSoulSkills({ names: ["recall"] })`(`src/mind/soul-skills.mjs`)を通した本文**(見出し欄を落とした、①に渡る教えの本文)。生のファイルのバイトではない。Domain C で印を配信の語で差す口に替わったら、calls の 1 行をその口に合わせる。
- 判定の入力: `buildSpeakNowInput`、`buildSpeakNowInstructions`(normal / quiet / chatty)、`buildSpeakNowChoices`(value とタブ区切りで 1 本の文字列に)、`buildCommentReactInput`(空白の名前のコメント / 名前つきのコメント)、`buildRecallAvoidInput`(1 分・窓を広げて全行)。

## 2. 変更ファイル

```
$ git diff --stat
 apps/soul/agent/scripts/cockpit-role-edit.test.mjs |   5 +-
 apps/soul/agent/scripts/cockpit-stream.test.mjs    |   3 +-
 apps/soul/agent/scripts/cockpit.test.mjs           |  10 +-
 .../src/cockpit/cockpit-server-domain-e.test.mjs   |   5 +-
 apps/soul/agent/src/cockpit/cockpit-server.mjs     | 183 +++++++++++++--------
 .../soul/agent/src/cockpit/cockpit-server.test.mjs |   6 +-
 apps/soul/agent/src/ears/ear-pipeline.mjs          |  43 ++++-
 apps/soul/agent/src/ears/transcript-buffer.mjs     |  39 ++++-
 apps/soul/agent/src/mind/comment-react.mjs         |   4 +-
 apps/soul/agent/src/mind/fire-injection.mjs        |   9 +-
 apps/soul/agent/src/mind/fire-orchestrator.mjs     |  37 ++++-
 apps/soul/agent/src/mind/memory.mjs                |   3 +
 apps/soul/agent/src/mind/recall.mjs                |   6 +-
 apps/soul/agent/src/mind/speak-now.mjs             |  19 ++-
 14 files changed, 264 insertions(+), 108 deletions(-)
```

新規(追跡外): `src/mind/stream-wording-pin.test.mjs`、`src/mind/fixtures/stream-wording-pin-{input,calls,expected}.mjs`、`src/mind/speaker-shape-discord-a.test.mjs`、`src/ears/ear-pipeline-discord-a.test.mjs`、`src/cockpit/cockpit-server-discord-a.test.mjs`(すべて `apps/soul/agent/` の下)。

中身の要点:

- `transcript-buffer.mjs`: 名前(`displayName`)をどの話者にも許す。任意の `speakerId`(文字列。型が違えば throw)を足し、エントリに `speakerId`(省略時 undefined)を持つ。
- `ear-pipeline.mjs`: `options.transcriptBuffer`(積む口)。渡されたらそれに積み、onAppend は張らない。そのとき `onTranscript` は**この耳が積んだ行だけ**に、遅延と audioCtx を添えて直に呼ぶ(投げたら listenerError の診断)。渡されなければ従来どおり自分で作って onAppend を張る。
- `cockpit-server.mjs`: 場の正本 `venueTranscript`。`openStream` の 4(耳の前)で `openVenueTranscript()` が作り、購読を 2 本(追記 → 発火の予定と speak-now、破棄 → discard の放送)張る。`stopEars` の中・`openStream` の失敗の `fail()`・`close()` で `releaseVenueTranscript()`。正本を読む 13 か所 + 耳の中の 2 か所(discard 購読と、その中の stats)を場の正本へ。耳に `transcriptBuffer: venueTranscript` を渡し、耳の `onTranscript` は耳ごとの口(soul / viewer 除外・遅延のログ・遅延の材料・you の放送)だけに。`toWireEntry` は soul の名前を載せない(`displayName: null`)。orchestrator へ `getSoulSpeaker`(今のロールの id と canonicalName)を渡す。
- `fire-orchestrator.mjs`: 任意の `getSoulSpeaker`。`speaker: "soul"` を書く 6 か所に `...soulSpeakerFields()`(`displayName` = ロールの名前、`speakerId` = ロールの id。口が無い・投げるときは何も足さない)。
- 整形: `fire-injection.mjs` は名前のある you を `you(名前): 本文`(名前は trim)。`speak-now.mjs`・`comment-react.mjs` の判定の入力は名前のある you を `配信者(名前): 本文`。soul はどこもロールの名前を見ない(①②④は `soul:`、判定は頭の名前 `soulName`)。`speakerId` はどの整形も読まない。`memory.mjs`(②・④の会話)は名前のある you を**まだ付けていない**(§9 質問 1)。`recall.mjs` はコメントだけ。

## 3. テスト結果

- `apps/soul/agent` で `node --test`: **1938 件 pass / 0 fail / 0 skipped / 0 cancelled**(`duration_ms 91530`)。土台 1884 から **+54**(固定テスト 36・耳 5・話者の形 8・サーバ 5)。
- リポジトリの根で `pnpm run check:soul-zone`: pass(`1572 source files scanned; no 器→魂 imports and no 魂→器 code imports.`)。
- テストは本物の LLM・外部 API・Discord を呼ばない(偽の耳・偽の WebSocket・偽の判定・偽の orchestrator)。書くのは無し(一時フォルダも使っていない)。

新しいテストと、計画 §1 Domain A の約束の対応:

| 約束 | テスト |
|---|---|
| 固定テスト | `stream-wording-pin.test.mjs` |
| 場が正本を作って耳に渡す / 耳は渡されなければ自分で作る | `cockpit-server-discord-a`「配信を始めると場が正本を作って耳に渡す…」、`ear-pipeline-discord-a`「渡された正本に積む」「正本が渡されなければ今まで通り自分で作り…」 |
| 15 か所が場の正本を読む(耳が無くても正本がある) | `cockpit-server-discord-a`「サーバは耳の返す正本ではなく場の正本を読む」(耳が自前の正本を返す偽物で、snapshot の件数と転写・getTranscript・getBuffer・speak-now の判定の入力・コメントの取り込み・soul の放送・discard の放送・you の放送の数・終えるときの写しを確かめる)、「耳が無くても正本はある(配信を始める途中・耳を開く前に届いたコメントも積める)」 |
| `onAppend` が N 重にならない | `ear-pipeline-discord-a`「耳 2 本で同じ正本に積んでも、持ち主の購読は 1 行 1 回・耳ごとの口は自分の行だけ」(本物の耳 2 本)、「渡された正本には onAppend を張らない」、`cockpit-server-discord-a`「耳 2 本で同じ正本に積んでも、発火の予定・speak-now・放送は 1 行 1 回」 |
| 名前つき you の整形 | `speaker-shape-discord-a`「整形(①)」「整形(判定): speak-now」「整形(判定): コメント反応」、`cockpit-server-discord-a`(判定の入力に `配信者(たろう): やあ`) |
| id が①②④・判定・放送・ログに出ない | `speaker-shape-discord-a`「整形(①)」「整形(②④)」「整形(判定)…」、`cockpit-server-discord-a`「id は放送・状態・ログ・判定の入力に出ない…」(SSE の全イベントと `/api/state` に id も `speakerId` の欄も無い。`onSttLatency`・`onSpeakNowJudgment` のログに id・名前・本文が無い) |
| soul の行にロールの id と名前が載る | `speaker-shape-discord-a`「orchestrator は soul の行にロールの id と名前を載せ、次の①では `soul:` のまま渡す」「getSoulSpeaker が無い・投げるときは従来の形」、`cockpit-server-discord-a`(`getSoulSpeaker()` が `{ id: "chappy", name: チャッピー }`・soul の放送の `displayName` は null) |
| 配信のふるまい(放送・除外・speak-now・遅延ログ)が変わらない | 既存テスト全件が期待値そのままで通る + `cockpit-server-discord-a`「耳 2 本…」(you の放送 1 回・soul / viewer を耳の口で放送しない・speak-now 1 行 1 回・遅延のログは数字だけ)+ 固定テスト |

## 4. 期待値を変えた既存テスト・偽の耳の直し

**期待値を変えた既存テスト: 0 件。** 許されていた `chatBufferAbsent`(`cockpit-server.test.mjs:1901` 付近「耳未起動(バッファ無し)は chatBufferAbsent 診断のみ」)も**変えずに通る**。正本は場が開くときに作り閉じるときに手放すので、場が閉じている(=耳も無い)このテストの場面では今も正本が無く、診断だけが出る(§7 裁量 2)。

偽の耳の直し(どれも「渡された正本を受け取る。渡されなければ従来どおり自分で作る」の 1 か所だけ。期待値・件数・文字列は触っていない):

| ファイル | 関数(行) | 直し |
|---|---|---|
| `src/cockpit/cockpit-server.test.mjs` | `makeFakePipeline`(:161 付近、factory の中) | `const buffer = options?.transcriptBuffer ?? createTranscriptBuffer(...)` |
| `src/cockpit/cockpit-server.test.mjs` | `makeOnAppendPipeline`(:1328 付近) | 同上(自前の onAppend → `options.onTranscript` の購読は残した。耳ごとの口が soul / viewer を除くので二重にならない) |
| `src/cockpit/cockpit-server-domain-e.test.mjs` | `makeEars`(:32 付近) | factory が `options` を受け、同上 |
| `scripts/cockpit-role-edit.test.mjs` | `makeEars`(:220 付近) | 同上 |
| `scripts/cockpit-stream.test.mjs` | 偽の耳の factory(:46 付近) | 同上(自前の onAppend の購読は残した) |
| `scripts/cockpit.test.mjs` | 「配信を終えると保存される」の `pipelineFactory`(:1049 付近) | 同上(`buffer = options?.transcriptBuffer ?? makeBuffer(...)`) |
| `scripts/cockpit.test.mjs` | 声の選択の `pipelineFactory`(:2748 付近) | 同上 |

既存テストの削除・skip はしていない。

## 5. `onAppend` の持ち主と耳ごとの情報の渡し方

- **持ち主は場**。`openVenueTranscript()` が正本に 1 回だけ張る: 追記 → `fireScheduler.handleTranscript` と `speakNow.handleTranscript`(どの話者の行も。従来の耳の `onTranscript` の前半)、破棄 → `discard` の放送。耳が何本でも 1 行 1 回。
- **耳ごとの情報は「耳ごとの口から引く」**を選んだ。外から正本を渡された耳は onAppend を張らず、自分が積めた行だけで `onTranscript(entry, { latencyMs, audioCtx })` を直に呼ぶ。サーバの耳ごとの口(`startEars` の `onTranscript`)が、soul / viewer の除外 → 遅延のログ(`onSttLatency`。方式 `engine` はその耳の Start の値)→ 遅延の材料(`sttLatencyBySeq`)→ you の放送(`latencyMs`・`audioCtx` つき)を担う。
- 選んだ理由: 「行に添えて渡す」(正本の append に一時の情報を足して listener に渡す)は正本の口の形を変えるうえ、既存テストの偽の耳(onAppend で `options.onTranscript` を全行に呼ぶ型と、テストが `options.onTranscript` を直に呼ぶ型)と二重になる。耳ごとの口に分けると、偽の耳を「正本の受け取り方」の 1 行だけ直せば、どちらの型の既存テストも期待値そのままで通る。
- 順序は従来と同じ(発火の予定 → speak-now → 遅延のログ → 遅延の材料 → 放送)。正本の購読が積む最中に走り、耳ごとの口は積んだ直後に走るため。

## 6. `startMs` の確かめ(設計 §3.1・§12.3)

見た範囲: 変更後の `apps/soul/agent/src/`・`apps/soul/agent/scripts/` の `.mjs`(テストを除く)。`\.(startMs|endMs)\b`・`inRange(`・`startMs` で検索。

出現:
- 耳の中(`ear-pipeline.mjs`・`speech-segmenter.mjs`・`pcm-ring-buffer.mjs`・`transcript-buffer.mjs` の `inRange` の定義)— 1 本の耳の中のストリーム時刻。
- `cockpit-server.mjs` の素通し(`toWireEntry`・診断・VAD・discard の放送の `startMs` / `endMs`)— 値を載せるだけで比べない。
- `fire-orchestrator.mjs` の soul の行の `startMs: 0, endMs: 0` の書き込み(6 か所)、`fire-injection.mjs` は説明のコメントだけ。
- `src/cli/ears-cli.mjs`・`scripts/preflight-*.mjs`・`scripts/probe-*.mjs`・`scripts/measure-fire.mjs`・`scripts/observe-*.mjs` — 1 本の耳の表示・ログ、または偽の発話の書き込み。`elevenlabs-timeline.mjs` は声の文字の時刻で転写とは別物。
- `transcriptBuffer.inRange` を呼ぶ所は無い(`glance-timeline.mjs` の `inRange` は推論の範囲の seq の印で別物)。`src/mind/`・`src/cockpit/ui/`・`src/cockpit/view-logic/` に転写の `startMs` / `endMs` を読む所は無い。

結論: **`startMs` / `endMs` を耳をまたいで比べている所は無い**。窓・並びはどこも `appendedAtMs`(壁時計)か `seq` を使う。棚卸し §2.1 末尾の結論と同じ。

## 7. 裁量(設計に無いことを決めた所)

1. **耳ごとの情報は耳ごとの口から引く**(§5)。
2. **正本の寿命**: 作るのは `openStream` の 4 の頭(耳の Start の直前)。手放すのは `stopEars` の中(耳の `onEarsStopped` を呼んだ直後、耳を手放すのと同じ時)・`openStream` の `fail()`・サーバの `close()`。配信では場が開いている間は耳が止まらないので、正本が読める間は従来と同じ(閉じた後・記録中に getTranscript / snapshot が空なのも従来どおり)。従来との違いは、配信を始める途中で耳の Start の前(声の engine の用意を待つ間など)にも正本があること(その間に届いたコメントは積める。設計 §3.1「耳が無くても正本はある」)。「場が閉じている間も正本を残す」にはしなかった(閉じた後の画面の転写や `chatBufferAbsent` が変わり、配信のふるまいが変わるため)。
3. **正本の時計**はサーバの `nowImpl`(本番はどちらも `Date.now` で、耳が自前で作っていたときと同じ)。
4. **soul の名前**は `normalizeModelIdentity(currentRoleIdentity()).canonicalName`(判定に渡す名前 `currentSoulName()` と同じ)。id は `identity.id`(ロールの id)。ロールの口(`currentRoleIdentity`)が無ければ載せない。
5. **放送の `displayName`**: soul の行は常に null(配信で出ていなかったロールの名前を新たに出さない)。you の行は名前があれば載る(配信では you に名前が無いので null のまま。Domain G が使える)。`speakerId` は `toWireEntry` が拾わないので放送・snapshot に出ない。
6. **判定の入力の名前つき you** は `配信者(名前): 本文`(コメント反応の `視聴者(名前)` と同じ形)。「配信者」の語の差し替えは Domain C / F。
7. **思い出しの「避けるか」の判定の入力**(`buildRecallAvoidInput`)には名前を付けない(もともと視聴者名を落とす判定で、話題が変わったかを見るのに名前は要らない)。§9 質問 2 で確かめたい。
8. 固定テストのケースの切り方(数の所は JSON・選択肢は value とタブ区切り)と、入力に含めた追加(文字数上限 60・窓を広げた④と避けるか・括弧と改行入りの頼みごと)。
9. `transcript-buffer` のエントリは `speakerId` の欄を常に持つ(省略時 undefined。`displayName` と同じ形)。

## 8. 持ち越し

- **②④の名前つき you**(`memory.mjs` の `formatDigestLine` → `formatTranscriptForDigest`・`formatRecentConversation`)は未実装(§9 質問 1)。決まれば `formatDigestLine` の 1 か所で済む(①と同じく `label === "you"` を足す)。
- Domain B: `openVenueTranscript` / `releaseVenueTranscript` と、耳ごとの口(`startEars` の `onTranscript`)は、場の段 / 体験の口に移すときの切れ目。Discord の人ごとの耳は、同じ正本と耳ごとの口を受け取れば N 重にならない(耳側は `ear-pipeline-discord-a` で確かめ済み)。Discord では正本の寿命を「耳を畳むとき」ではなく「場を閉じるとき」に寄せるかを決める(今は `stopEars` の中で手放す)。
- Domain C: 固定テストの呼び出し(`stream-wording-pin-calls.mjs`)を、②④の「共通部分 + 語の組」と `skills/recall.md` の差し込み口に合わせる(期待値は触らない)。
- Domain F / G: 判定の「配信者(名前)」の語、画面の名前の表示(放送の you の `displayName` は既に載る)。
- 2 つ目のロールのときに soul の整形へ名前を足す(正本には既にロールの id と名前がある)。

## 9. 質問

1. **`memory.test.mjs:58`「formatTranscriptForDigest: 名前のある viewer 行だけ `viewer(名前):` にする(…viewer 以外には付けない)」が、設計 §3.2・計画 §1 の「名前があれば `you(名前): 本文`(memory・recall も)」とぶつかる。** このテストは `{ text: "やあ", speaker: "you", displayName: "名前は付かない" }` → `you: やあ` を固定している(配信の場面ではない。配信では you に名前を入れない)。期待値を変えてよい既存テストは `chatBufferAbsent` の 1 件だけなので、②④の整形には名前を付けず(この 1 件の期待値を守る)、判断を返す。選択肢: (a) このテストの期待値の変更を認めて②④にも名前を付ける(`formatDigestLine` の 1 か所 + このテストの最後の行を `you(名前は付かない): やあ` に)、(b) ②④の名前は Discord の語の組と一緒に Domain C / F で入れる、(c) ②④には付けない(設計の変更)。
2. 思い出しの「避けるか」の判定の入力に名前のある you を付けない(裁量 7)でよいか。付けるなら `配信者(名前)` にする。
