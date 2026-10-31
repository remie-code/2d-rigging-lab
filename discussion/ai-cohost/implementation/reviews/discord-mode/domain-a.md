# Discord モード Domain A レビュー(Review-Sylph、2026-10-31)

> 対象: ブランチ `ai-cohost/discord-mode`、HEAD `6327a42b`、コミットしていないワークツリー(変更 14 ファイル + 新規 7 ファイル)。
> 根拠: 計画 [discord-mode-wave-plan.md](../../orchestration/discord-mode-wave-plan.md) §1 Domain A・§4、設計 [discord-mode.md](../../../architecture/discord-mode.md) §3.1〜§3.4・§10、棚卸し [discord-mode-inventory.md](../../orchestration/discord-mode-inventory.md) §0・§2.1・§2.9・§3.3、Gnome 報告 [domain-a-gnome.md](../../waves/discord-mode/domain-a-gnome.md)。
> 読み取り専任で見た。ソース・テストは直していない。鍵(`.env*.local`)・実データ(`cockpit-settings.local.json`・`memories/`・`roles/`)は開いていない。

- ループ: 1 回目
- 判定: **合格**(止める指摘 なし。Undine の判断待ちが 1 件 = §8 の②④の `you(名前)`。配信のふるまいには影響せず、直し方が決まれば 1 か所 + テスト 1 行なので、持ち越しとして Undine に上げる)

## 機械ゲート(自分で走らせた)

| ゲート | 結果 |
|---|---|
| `apps/soul/agent` で `node --test` | tests 1938 / **pass 1938** / fail 0 / cancelled 0 / skipped 0(`duration_ms` 91495)。Gnome 報告と同じ(土台 1884 から +54) |
| 根で `pnpm run check:soul-zone` | pass(1572 files scanned; no 器→魂 / 魂→器) |
| 依存・lockfile | `git status` に package.json / pnpm-lock の変更なし |

## 固定テストの照合(見ること 1)

手順:
1. `git archive HEAD:apps/soul/agent src skills | tar -x -C apps/soul/agent/tmp/pin-check-r1`(HEAD `6327a42b` の `src` と `skills`。`tmp/` は `.gitignore:19` で無視、`node_modules` は上の `apps/soul/agent/node_modules` に解決される)。`skills/` はワークツリーでも HEAD と差分なし(`git diff --quiet HEAD -- apps/soul/agent/skills`)。
2. そこへワークツリーの `stream-wording-pin.test.mjs` と `fixtures/stream-wording-pin-{input,calls,expected}.mjs` をそのままコピーし、`node --test src/mind/stream-wording-pin.test.mjs` を走らせた。
3. 結果: **36 件 pass / 0 fail**。つまり期待値は HEAD の(未変更のコードの)出力そのもの。入力に soul の行の `displayName`・`speakerId` を載せても HEAD の整形は見ないので、書き写しは HEAD の出力と一字も違わない。
4. 感度の確認: 同じ一時フォルダの HEAD の `memory.mjs` の「配信の相方」を 1 語変え、`speak-now.mjs` の「配信者」を「配信主」に替えると 6 件が落ちた(`writer.systemPrompt`・`judge.speakNow.*` 5 件)=テストが一字の差を捕まえる。
5. 一時フォルダ `apps/soul/agent/tmp/pin-check-r1` は削除済み(`tmp/` には元からある `discord-receive`・`restructure-backups` だけが残る)。ワークツリーの本物のファイルは動かしていない。

形の確認:
- 期待値(`stream-wording-pin-expected.mjs`、19 KB)は `JSON.stringify` 相当の文字列リテラルで、テストは `assert.strictEqual(produce(), expected)`。今の関数で期待値を組み直していない。ケース一覧と期待値の鍵の一致も 1 件で確かめる(合計 36 件)。呼び出し(`-calls.mjs`)と期待値が別ファイルなので、Domain C で組み立てが替わっても呼び出しだけを合わせられる(設計の「組み立てを直しても気づける」を満たす)。
- 対象が計画 §1 の列挙と揃っている: ①2 関数(`formatFireInjection` 窓/文字数上限/`formatFireInjectionSince` afterSeq 3・null・7)、②3 つ(`WRITER_SYSTEM_PROMPT`・`formatTranscriptForDigest`・`buildWriterRequest` 本体なし/あり)、④3 つ + 結果の関数 7 つ(`RECALL_SYSTEM_PROMPT`・`formatRecentConversation` 1 分/広げた窓・`buildRecallRequest` 会話あり/空 + 結果 7)、`skills/recall.md` の本文(`loadSoulSkills({names:["recall"]})` の出力=①に渡る教えの本文。生バイトではなく読み込み口の結果。Domain C で印を差す口に替わったら呼び出し 1 行を合わせる、と Gnome が明記)、判定の入力 5 関数(`buildSpeakNowInput`・`Instructions` 3 段・`Choices`・`buildCommentReactInput` 2 件・`buildRecallAvoidInput` 2 件)。
- 入力の転写: you(seq 0, 3, 7)・soul(seq 1, 6)・名前つき viewer(`"  山田  太郎 "`)・名前の無い viewer・空白の名前の viewer(`"   "`)・窓の外の行(seq 0 は全窓の外、seq 1〜3 は 1 分窓の外)を含む。コメント反応の判定には空白の名前と名前つきの 2 件。
- 配信では you に名前が入らないので入力の you は `displayName: undefined`(HEAD の配信の場面と同じ)。名前つき you の固定は入っていない=Domain A の「配信の文字列は同じ」を守るために正しい(名前つき you の新しい形は `speaker-shape-discord-a.test.mjs` が別に確かめる)。

## 見ること 2〜8 の結果

### 2. 既存テストの期待値 — 問題なし
- `git diff` の既存テスト 5 ファイル(`cockpit-server.test.mjs`・`cockpit-server-domain-e.test.mjs`・`scripts/cockpit.test.mjs`・`scripts/cockpit-stream.test.mjs`・`scripts/cockpit-role-edit.test.mjs`)の変更は 7 か所で、**どれも偽の耳の factory が `options?.transcriptBuffer ?? <従来の自前の正本>` を使う 1 行(+ factory が `options` を受ける引数)だけ**。assert の値・件数・文字列・テストの削除・skip は無い。ほかの既存テスト(`memory.test.mjs`・`recall.test.mjs`・`speak-now.test.mjs`・`comment-react.test.mjs`・`soul-skills.test.mjs`・`fire-injection.test.mjs` など)は変更なし(`git diff --stat` に出ない)。
- `chatBufferAbsent`(`cockpit-server.test.mjs:1903`)は**変わらずに通る**。ワークツリーのこのテストは場を開かずに `ingestChatMessage` を呼ぶので、正本の寿命が「場が開いている間」である今の実装では正本が無く診断が出る。計画が認めた「1 件の変更」は不要になった(Gnome 裁量 2 の結果。下の裁量欄)。変更した期待値は 0 件で、計画の許容(1 件まで)の範囲内。

### 3. 正本を場へ — 問題なし
- 場が開くとき: `openStream` の 4 の頭で `openVenueTranscript()` が `createTranscriptBuffer({ nowImpl })` を作って購読を張り、`startEars` が `transcriptBuffer: venueTranscript` を耳に渡す(`startEars` は `openStream` からしか呼ばれないことを grep で確認。`venueTranscript` が null のとき耳に渡さない分岐は到達しない)。耳は `options.transcriptBuffer ?? createTranscriptBuffer(...)` で、渡されなければ従来どおり自分で作り onAppend を張る(`ear-pipeline-discord-a.test.mjs` の「渡されなければ自分で作る」「渡された正本には onAppend を張らない」)。
- 読む所: `grep` で `cockpit-server.mjs` に `pipeline.transcriptBuffer` / `p.transcriptBuffer` は残っていない(残りは cockpit.mjs 等のコメントだけ)。13 か所 + 耳の中の 2 か所(discard 購読と stats)が `venueTranscript` を読む。`fireOrchestratorFactory` の `getBuffer`・`getTranscript`・snapshot・speak-now・コメント反応・思い出しの係・取り込み・commitComment・closeStream の写し、すべて場の正本。
- `onAppend`: 場が正本に 1 回だけ張る(追記 → `fireScheduler.handleTranscript` と `speakNow.handleTranscript`、破棄 → discard の放送)。耳が渡された正本には張らない。実測のテストあり(`ear-pipeline-discord-a`「耳 2 本」、`cockpit-server-discord-a`「耳 2 本」=発火の予定・speak-now・放送が 1 行 1 回、遅延が耳ごとに 100 / 200)。コードの `onAppend` 購読者は `cockpit-server.mjs:1594`(場)と `ear-pipeline.mjs:250`(自前の正本のときだけ)の 2 つだけ。
- 耳ごとの情報: 耳が自分で積めた行だけ `onTranscript(entry, { latencyMs, audioCtx })` を直に呼ぶ(`notifyOwnAppend`)。`currentMeta` は append の前に決まるので値は従来と同じ。whisper 経路・ElevenLabs 経路の両方に入っており、throw は `listenerError` の診断に落とす(自前の正本のときの振る舞いと同じ。テストあり)。順序は 発火の予定 → speak-now → 遅延のログ → 遅延の材料 → 放送(従来と同じ。onAppend の購読者がほかに無いため)。
- 配信のふるまい: soul / viewer を耳の口で放送しない除外は残り、you の放送は `latencyMs` / `audioCtx` つきで 1 回、discard の放送は場の購読 1 本。既存テスト全件と固定テストが期待値そのままで通る。
- 場を閉じる・失敗: 手放すのは `stopEars` の中(耳を畳むのと同じ時)・`openStream` の `fail()`・サーバの `close()`。いずれも冪等(購読の解除は try/catch、null に戻す)。`close()` の二重呼びも `releaseVenueTranscript` が冪等。`fail()` の経路(耳が開かなかった場合)も解放される(`cockpit-server-discord-a`の最初のテストで終えた後は null)。

### 4. 話者の形 — 問題なし
- 案 A: `transcript-buffer` が `displayName` をどの話者にも許し、任意の `speakerId`(型が違えば throw、省略時 undefined)を持つ。soul は案 a: `fire-orchestrator.mjs` の `speaker: "soul"` の 6 か所(:777・:1100・:1166・:1290・:1321・:1400)すべてに `...soulSpeakerFields()`(名前 = `canonicalName`、id = ロールの id)。`grep` で他に soul を積む本番コードは無い(`scripts/observe-vision.mjs` は観測用の台本で対象外)。`getSoulSpeaker` は `createCockpitServer` が `fireOrchestratorFactory` の hooks に載せ、`scripts/cockpit.mjs` の factory は `...hooks` を展開して `createFireOrchestrator` に渡す(配線を確認)。口が無い・投げるときは従来の行の形(テストあり)。
- 出ない所のテスト: `speaker-shape-discord-a.test.mjs`(①: 名前つき you は `you(名前):`・soul は `soul:` のまま・id と soul の名前は出ない。②④: id と soul の名前が材料・頼み・会話・避けるかの入力に出ない。判定 2 件。orchestrator: 次の①に `soul:` のまま)と `cockpit-server-discord-a`(放送の全イベントと `/api/state` に id も `speakerId` も無い、soul の `displayName` は null、ログ(`onSttLatency` ほか)に id・名前・本文が無い、判定の入力に id が無い)。`toWireEntry` が `speakerId` を拾わない。
- 配信の文字列: 配信では you に名前が入らず、soul は HEAD と同じく整形も放送も名前を見ない → 固定テスト 36 件が HEAD で通るので変わっていない。

### 5. `startMs` — 確認した(Gnome の結論と同じ)
- 自分で grep: `src/mind`・`src/cockpit/ui`・`src/cockpit/view-logic`・`scripts/cockpit.mjs` に転写の `startMs` / `endMs` を**読む**所は無い(`fire-orchestrator.mjs` の `startMs: 0, endMs: 0` の書き込み 6 か所と `fire-injection.mjs` のコメントだけ)。`cockpit-server.mjs` は `toWireEntry`・診断・VAD・discard の素通し(値を載せるだけ、比べない)。`src/voice/engines/elevenlabs-timeline.mjs` は声の文字の時刻で別物。`transcriptBuffer.inRange` を呼ぶ本番コードは無い。窓・並びは `appendedAtMs`(壁時計)か `seq`。耳をまたいで比べる所は無い。

### 6. 約束のテスト — 足りている
計画 §1 Domain A の本文に対応するテストを確認した: 固定テスト(`stream-wording-pin.test.mjs`)、場が正本を作り耳に渡す / 耳は渡されなければ自分で作る(`cockpit-server-discord-a`・`ear-pipeline-discord-a`)、15 か所が場の正本を読む(耳の返す別の正本を置く偽の耳で、snapshot・getTranscript・頭・speak-now・コメント・soul / you / discard の放送・終えるときの写しを確かめ、耳が無くても積めることも別に確かめる)、`onAppend` が N 重にならない(本物の耳 2 本と、サーバ側の耳 2 本)、soul の行にロールの id と名前が載る(orchestrator 経由のテスト 1 本 + 口の確認。6 か所のうち自然完了だけ経路を通すが、6 か所とも同じ `...soulSpeakerFields()` で、コードの目視でも揃っている)、id が出ない(上の 4)、`startMs`(報告 + 上の 5)。**足りない約束は無い**(例外は §8 の②④の名前つき you = 実装もテストも無い。これは判断待ちの件)。

### 7. 守りの決まり — 違反なし
- 新規 6 本 + 差分に `.env`・`process.env`・`readFile`/`writeFile`/`node:fs`・`cockpit-settings`・`memories`・`roles/`・`homedir`・`.codex`・一時フォルダの作成が無い(grep)。新しいテストは偽の耳・偽の orchestrator・偽の判定・本物の server の loopback だけで、実データにも外部にも触れない。鍵を読む・出す・環境変数に入れるコードは無い。
- 差分に新しい `console.*`・`process.stdout.write`・ログ出力は無い。遅延のログ(`onSttLatency`)は従来どおり数字と方式だけで、名前・id・本文を足していない(テストで確かめている)。
- 依存・lockfile の変更なし。

## 見ること 8: 既知の論点(判定に含めるが、決めるのは Undine)

### 8-1. ②④に名前つき you の `you(名前):` が無い(`memory.mjs` の `formatDigestLine`)

事実:
- `memory.test.mjs:58-65` の 4 番目のエントリは `{ speaker: "you", displayName: "名前は付かない", text: "やあ" }` → `you: やあ` を固定し、テスト名も「viewer 以外には付けない」。`formatTranscriptForDigest` は `formatRecentConversation`(④)も使うので、1 か所の整形で②と④の会話が決まる。
- 設計 §3.2 は名前つきの行の形を「①には `you(名前): 本文`」と書き、案 A の手間に「整形の所(fire-injection・memory・recall・speak-now・comment-react)に『名前があれば付ける』を足す」とある。計画 §1 Domain A も「整形は『名前があれば `you(名前): 本文`』」。一方、同 §1 は「期待値の変更を 1 件だけ認める」で `chatBufferAbsent` を指名しており(これは実装で 0 件に)、`memory.test.mjs` のこの assert は指名されていない。同 §4 の機械ゲートは「`node --test` 全件 pass」。
- よって、設計 §3.2 / 計画 §1 の文言どおり(②④にも付ける)にすると `memory.test.mjs:58-65` の期待値を変える必要があり、計画の「期待値 1 件まで」と衝突する。Gnome は計画の拘束を取り、②④には付けず、報告で質問に上げた。

見立て:
- 計画 §4 の止めてよい理由に当てるなら、**1(設計 §3.2・計画 §1 Domain A との食い違い)** と **3(約束 = 名前つき you の整形が②④に無く、テストも無い)** に当たりうる。ただし Gnome の側に落ち度が無く、設計・計画のどちらを取るかが決まっていない「設計に書いていない判断の分岐」(§4 のループの決まり)に当たるので、止める指摘には**しない**。Undine が決める事項として上げる。
- 配信のふるまいへの影響: **なし**。配信では you に名前が入らず、②④の出力は固定テスト(`writer.transcript`・`recall.recent` 等)と一字違わない。影響が出るのは Discord(名前つき you が入る)のときの②の材料と④の会話だけ=Domain D 以降。つまり決めるのはこのドメインの合否の前でも後でもよい。
- 選択肢への見立て(Gnome の質問 1 の (a)(b)(c)):
  - (a) `formatDigestLine` に `label === "you"` を足し、`memory.test.mjs` の該当 assert を `you(名前は付かない): やあ` に直す。直しは 1 関数 + テスト 1 行 + `speaker-shape-discord-a` の②④の確認 1 本。設計と計画の本文に最も合うが、「期待値の変更 1 件」の枠を 2 件にする(設計 §3.2 による変更として一覧に載せる、`chatBufferAbsent` と同じ扱い)。配信の文字列(固定テスト)は影響を受けない(配信の you に名前が無いため)。
  - (b) Domain C(②④を「共通部分 + 語の組」に組み替える)で一緒に入れる。`memory.mjs`・`recall.mjs` はそこで触るので手は同じ。ただし期待値の変更は同じ 1 行で、C の「`memory.test.mjs` の配信の期待値を変えない」とぶつかり直すだけ。
  - (c) 付けない(設計の変更)。Discord で②が「you」とだけ書くことになり、複数人の通話で誰の発言か分からない(scope の「名前は残してよい」とも合わない)。
  - 見立て: (a) を A で入れる(または (b) で C に入れる)のが、設計 §3.2 に最も素直。どちらでも配信の固定テストは守られる。決めるのは Undine。

### 8-2. `buildRecallAvoidInput` に名前を付けていない(Gnome の質問 2 / 裁量 7)
- 事実: この関数は元から視聴者の名前を落とし(`視聴者: 「…」`)、you は `配信者: ` の固定ラベル。入力の型にも `displayName` が無い。設計 §3.2 は整形の所に recall を含めるが、実際は「思い出しの『避けるか』の判定」(設計 §3.4 末尾・§8)の入力で、判定は「今の会話の話題が、思い出した内容と重なるか」を見る。
- 見立て: **付けなくてよい(持ち越し・裁量)**。判定が話題を見るもので名前は材料にならない(視聴者名を落とす既存の設計とも揃う)。止める理由(§4 の 1〜4)には当たらない。Discord の問い・語(「配信者」)をどうするかは Domain F の判定の差し口で決めるので、そのときに名前を足す必要が出たら足せばよい(`displayName` を読むだけの小さい変更)。配信のふるまいへの影響なし。

## 止める指摘

なし。

## 裁量(筋が通ると認めたもの)

1. 耳ごとの情報は「耳ごとの口から引く」(外から正本を渡された耳は onAppend を張らず、自分が積めた行だけ `onTranscript(entry, { latencyMs, audioCtx })` を直に呼ぶ)。計画 §1 が「行に添えるか耳ごとの口から引くか」を Gnome の裁量にしており、選んだ形で偽の耳 2 型(onAppend で `options.onTranscript` を全行に呼ぶ型 / 直に呼ぶ型)の既存テストが期待値そのままで通る。
2. 正本の寿命 = 場が開いている間(`openStream` の 4 で作り、`stopEars`・`fail()`・`close()` で手放す)。計画は `chatBufferAbsent` の変更を許したが、場が閉じている間も正本を残すと閉じた後の画面の転写や診断が変わり配信のふるまいが変わるので、「閉じたら手放す」にして 0 件にした。設計 §3.1(耳が無くても正本はある)は、場が開いている間は耳の有無によらず満たす(開く途中・耳を開く前に届いたコメントも積めるテストあり)。
3. soul の名前は放送に載せない(`toWireEntry` が soul で `displayName: null`)。配信で出ていなかったロールの名前を新たに出さないため(設計 §10 の趣旨、配信の文面を変えない)。
4. 判定の入力の名前つき you は `配信者(名前)`(コメント反応の `視聴者(名前)` と同じ形)。語の差し替えは Domain C / F。
5. 正本の時計 = サーバの `nowImpl`(本番はどちらも `Date.now`)。
6. 固定テストの切り方(数の所は JSON、選択肢は value + タブ区切りで 1 文字列、`skills/recall.md` は読み込み口を通した本文、呼び出しと期待値を別ファイル)。

## 持ち越し(止めない指摘)

- **Undine へ**: 8-1(②④の `you(名前)`)。決めたら Domain A の直しとして入れるか、C で入れる。
- Domain B:
  - `openVenueTranscript` / `releaseVenueTranscript` と、耳ごとの口(`startEars` の `onTranscript`)は場の段 / 体験の口に分ける切れ目。Discord の群では正本の寿命を「耳を畳むとき」ではなく「場を閉じるとき」に寄せるかを決める(今は `stopEars` の中。Gnome の持ち越しと同じ)。人ごとの耳の束を「1 つの耳」に見せるとき、`startEars` の `onTranscript` を束の側で持つか(耳ごとの口は耳 N 本でも同じ関数を渡せる)。
  - 防御: `startEars` は `venueTranscript` が null のとき(今は到達しない)に耳へ正本を渡さず、耳が自前の正本を持つがサーバは null を読む。B で `startEars` の呼び口が増えるときは、null のとき開かない形(または必ず作る形)にする。
  - `chatBufferAbsent` の診断の文面は `ears not running` のまま(テスト `cockpit-server.test.mjs:1917` が固定)。今は「場が閉じている」の意味。文面を直すなら B/G で期待値の変更として扱う。
- Domain C: `stream-wording-pin-calls.mjs` の呼び出し(②④の共通部分 + 語の組、`skills/recall.md` の差し込み口)だけを合わせる。期待値・入力は触らない。
- Domain F / G: 判定の語「配信者」の差し替え(`SPEAK_NOW_HOST_LABEL` と `hostLabel`、コメント反応の `配信者`)、`buildRecallAvoidInput` に名前が要るかの再確認、画面の you の行の名前(放送の you の `displayName` は既に載る)。
- 2 つ目のロールのとき: soul の整形にロールの名前を足す(正本には既にロールの id と名前がある)。

## 質問(Undine へ。Orch-Sylph が上げる)

1. ②④の整形に名前つき you の `you(名前):` を入れるか。入れるなら (a) A の直しで(`memory.test.mjs:58-65` の 1 assert を設計 §3.2 による変更として認める)か、(b) C でか。入れないなら (c)(設計 §3.2 の変更)。上の 8-1 の見立てのとおり、配信の固定テストは守られる。
2. `buildRecallAvoidInput` に名前を付けない(裁量 7)でよいか。見立てでは付けなくてよい(上の 8-2)。
