# Discord モード Domain B レビュー(Review-Sylph、2026-10-31)

> 対象: ブランチ `ai-cohost/discord-mode`、HEAD `cad2083a`、コミットしていないワークツリー(変更 2 ファイル + 新規ソース 1・テスト 3)。
> 根拠: 計画 [discord-mode-wave-plan.md](../../orchestration/discord-mode-wave-plan.md) §1 Domain B・Domain C の境界・§4、設計 [discord-mode.md](../../../architecture/discord-mode.md) §4.1〜§4.5・§5・§12.2・§12.3、Domain A の報告 §10 とレビューの持ち越し、棚卸し [discord-mode-inventory.md](../../orchestration/discord-mode-inventory.md) §2.2・§2.9-7・§9-4、Gnome 報告 [domain-b-gnome.md](../../waves/discord-mode/domain-b-gnome.md)。
> 読み取り専任で見た。ソース・テストは直していない。鍵(`.env*.local`)・実データ(`cockpit-settings.local.json`・`memories/`・`roles/`)は開いていない。操縦席は起動していない。確かめのために一時フォルダ `apps/soul/agent/tmp/rv-b-mut`(`tmp/` は `.gitignore` 済み)に `src`・`scripts`・`skills` を写して壊し方の実験をしたが、**削除済み**(`tmp/` には元からある `discord-receive`・`restructure-backups` だけが残る)。ワークツリーの本物のファイルは動かしていない。

- ループ: 1 回目
- 判定: **合格**(止める指摘 なし。Undine へ上げる質問が 1 件 = 設計 §4.3 の番号の書き直し。配信のふるまいにも合否にも影響しない)

## 機械ゲート(自分で走らせた)

| ゲート | 結果 |
|---|---|
| `apps/soul/agent` で `node --test` | tests 1966 / **pass 1966** / fail 0 / cancelled 0 / skipped 0(`duration_ms` 91508)。Gnome 報告と同じ(土台 1938 から +28 = 耳の束 6・サーバ 18・cockpit.mjs 4。新規ファイルの `test(` を数えて一致) |
| 根で `pnpm run check:soul-zone` | pass(1576 files scanned; no 器→魂 / 魂→器) |
| 依存・lockfile | `git status` は `scripts/cockpit.mjs`・`src/cockpit/cockpit-server.mjs` の 2 変更 + 新規 4(`ear-bundle.mjs`・`ear-bundle.test.mjs`・`cockpit-server-discord-b.test.mjs`・`cockpit-discord-b.test.mjs`)+ Gnome 報告だけ。package.json / lockfile の変更なし |

## 見ること 1〜11 の結果

### 1. 機械ゲート — 問題なし(上の表)

### 2. 既存テストの期待値 — 問題なし
- `git diff HEAD --stat` に出るのは `cockpit.mjs` と `cockpit-server.mjs` の 2 ファイルだけ。**既存のテストファイルの差分は 0**(期待値を変えた既存テスト 0・直した既存テスト 0)。
- `src/mind/`・`skills/` の差分 0(`git diff --stat HEAD -- src/mind skills` が空)。`stream-wording-pin.test.mjs` と `fixtures/stream-wording-pin-*.mjs` は status に出ず、全件の中で通る。
- 旧名のオプション(`currentRoleIdentity`・`streamHooks`・`onPrepareVoiceEngine`・`recallRunner`・`onEarsStarted`・`onEarsStopped`)は残し、`options.roles` が無いときは `legacyRole`(個別の口から束を 1 つ作る)で動く。`streamHooks` はコピーせず参照のまま渡すので、ゲッターで投げる既存テストの意味も保たれる。

### 3. 場の段と体験の口(設計 §4.2 案 A・§4.3・§4.4) — 問題なし
- `openStream` / `closeStream` は 1 本のまま。`fail()`・try/finally・`endStreamForShutdown`(Ctrl+C)・サーバの `close()`・記憶の最後の保存(`runRoleHooksAll("saveFinal", transcript)` が `closeStream` の 2 か所 = 通常と想定外の例外の道)は 1 か所に残る。`startEars` / `stopEars` の本体は体験の口(配信)へ移し、`startEars` / `stopEars` という名前の関数は無くなった(呼び口は `openStream` と `foldStream` だけだったことを grep で確認)。
- **開く順**(設計 §4.3 の 10 段との照合): 1 一覧を固める ✓ → 2 場の記録(ロールごと)✓ → 3 KILL OFF・判定・予定・思い出しの係 ✓ → 4 正本 ✓ → 5 入口(下見 `prepareEntrance` → 声の engine の用意 → 開く `openEntrance`)→ 6 再生器 → 7 目 → 8 頭のセッション ✓ → 9 器 ✓ → 10 開いたあと(`afterOpen`)✓。**設計の番号と違う所が 2 つ**(下の「裁量 1・2」と「質問 1」)。どちらも配信の今の順を保つためで、HEAD の `startEars` を `git show` で読み、既存テストが固定していることを実験で確かめた(下)。
- **閉じる順**: 写し → `foldAfterOpen` → 判定・予定・思い出しの係 → 声を止める → 目 → 正本を手放す → 耳の束を畳む → 入口を閉じる → 頭のセッション → 器 → 最後の保存 → 閉じる。設計 §4.3 は「入口を閉じる → 目」だが、実装は「目 → 入口」。HEAD の `stopEars` は「撮る係を止める → 正本 → 耳」なのでそれを保った。
- Discord の口は `options.experiences.discord` で外から渡せる(`normalizeVenueExperience` が export され、口の形の約束は JSDoc にある)。`openEntrance` と `closeEntrance` が無ければ受け取らず 503 のまま(テストあり)。偽の Discord の口でも「開く → 人ごとの耳 2 本 → 1 行 1 回 → 閉じる」が通る(テストあり)。
- `close()` は 正本 → 耳の束 → 入口(`shutdown: true`)→ 閉じる → 目で、HEAD の `close()`(正本 → 耳 → `earsState`/`startedAtMs` → 閉じる → `onEarsStopped`)と同じ並び。`shutdown` のときは放送しない(HEAD と同じ)。

### 4. 声と目を場の共通の段へ(設計 §4.3 の 6・7・§12.3) — 問題なし
**どのテストが配信のふるまいを固定しているか**
- 既存: `cockpit-stream.test.mjs` の「配信を終える: 写し → 畳む(…声を止める・目・耳・頭のセッション・器)…」と「Ctrl+C」(`eyes.stop` → `ears.dispose` の順)、`cockpit-server.test.mjs` の声の選択 3 件(耳を開く前に用意する・用意できなければ耳を開かない・用意が投げても畳む)、Domain A の「耳が無くても正本はある」。
- 新規: `cockpit-server-discord-b`「配信の開く順」(`renewRecords → stt/tts 記憶 → voice.prepare → ears.create → ears.start → voice.resources → eyes.start(旧名)→ eyes.start → openSession → connectBody` を `deepEqual`)、「閉じる順」(`eyes.stop` 旧名・新名 → `ears.dispose` → closeSession → closeBody → saveFinal。耳を畳む時点で正本は 0 件・写しは畳む前)、声の用意の失敗・キー切れが先・耳が起きない・頭が作れない・`close()`。`scripts/cockpit-discord-b`「束を cockpit-server に渡す」は本物の `createStreamVenueHooks` + `createVenueRoleBundle` + 本物のサーバで並びを固める。
- **意味のある固定かを実験で確かめた**(`tmp/rv-b-mut` の写しで 1 か所ずつ壊し、関連 6 ファイル 281 件を走らせた):
  - M1「入口を閉じる → 目」に入れ替え → **既存の 2 件**(`配信を終える…`・`Ctrl+C…`)を含む 5 件が落ちる。つまり目 → 入口の順は既存テストが固定している(設計の文面どおりに替えると計画 §4 の理由 2 に当たる)。
  - M2「声の engine の用意を入口を開いたあとへ」→ 既存の声の選択 3 件・Domain A の「耳が無くても正本はある」を含む 11 件が落ちる。HEAD の「声の用意 → 耳」の順も既存テストが固定している。
  - M3「再生器と目の入れ替え」→ 落ちるのは**新規の 2 件だけ**(開く順のテストと cockpit.mjs 側の並びのテスト)。既存は固定していないが、新規が固定している。

**Gnome が §11 で挙げた「今と順やふるまいが変わる所」3 つを HEAD と比べた結果**(`git show cad2083a:` の `startEars` と cockpit.mjs の `onEarsStarted` を読んだ)
1. 開く段の「再生器 → 目」(HEAD の `onEarsStarted` は `residentCapture.start()` が先、`ensureVoiceResources()` があと): **その通り入れ替わっている。配信で見える違いは無い**。2 つは互いに待たない独立の起動(常駐の撮る係と流し込みプレイヤー。`ensureVoiceResources` は `ensureSession` などに依らず、`player`・声の差し替え口を作るだけ)。どちらも sync で投げても握られる。副作用として、HEAD では `residentCapture.start()` が投げると再生器が起きなかったが、今は互いに独立になった(良くなる向き)。理由 2 には当たらない。
2. 閉じたときの「喋っている」の持ち越し(HEAD の `userSpeaking` はサーバ変数で場をまたいで残り、`getQuietGap` は `pipeline != null && userSpeaking`。喋っている途中で閉じて次を開くと、次の speechEnd まで「喋っている」が残りうる): **その通り**。新しい束は場ごとに作るので持ち越さない。差が出るのは `getQuietGap`(隙間で手動の圧縮の材料)だけで、通常の流れでは差が出ず、あっても良くなる向き。理由 2 には当たらない。
3. 開く途中の `close()` で耳を開かない: **その通り**。HEAD は正本の有無を見ず、`close()` のあとでも耳(自前の正本つき)を作って起こして `pipeline` に入れていた(畳み残し)。新しくは「会話の正本が無い(入口を開けない)」で開かず、`abortEntrance` → `fail()` で閉じた状態に戻る(テストあり)。通常の流れでは到達しないので理由 2 には当たらない(Domain A レビューの持ち越し「null のとき開かない形に」にも合う)。

**失敗のときの畳み方**(HEAD と比べて同じ): 文字起こしのキー・モデルが先に失敗 → 声は用意しない・耳の状態は `down` を残して stopped / 声の用意の失敗 → `earsState` stopped・stt unknown・tts down + 理由を 1 回放送 → `fail(理由, {})`(耳も目も畳まない・器だけ畳む)/ 耳の起動失敗 → 再生器も目も起こさず、耳は自分で畳む約束なのでサーバは畳まない。`prepareStreamEntrance` の前半(`setLastDevice`・`onSetSttEngine`・`onSetTtsEngine`・Starting の放送・キー・モデルの確かめ)は HEAD のコードがそのまま移っている。

### 5. 耳の束(棚卸し §9-4) — 問題なし
- サーバの `pipeline` の使い道(grep): `onSttStatus` の「別の Start の通知は無視」の比較(`pipeline !== ears`)、入口を開いたあとの代入、`foldVenueEars` の `dispose`、`close()`、`getQuietGap` の `userSpeaking()`。**寿命と `userSpeaking` だけ**で、HEAD で `pipeline.transcriptBuffer` を読んでいた所は Domain A で無くなっている。
- 束(`src/ears/ear-bundle.mjs`、114 行)は N 本で動く: `ear-bundle.test.mjs` 6 件(1 本の寿命と冪等な dispose / N 本の `userSpeaking` と VAD を key つきで場の口へ渡す / 1 本だけ外す(`remove` は畳まない・`drop` は畳む)・同じ key は二重に足せない / 起きない耳があれば起きた分と未起動の分を畳んで束を空にして投げ直す(起きなかった耳は畳まない)/ 1 本は畳まない / 同じ正本と同じ耳ごとの口なら N 本でも 1 行 1 回)。サーバ側にも「配信の耳は束の 1 本」「Discord の偽物で人ごとの耳 2 本」(1 行 1 回・耳ごとの遅延・誰か 1 人でも喋っていれば喋っている・id は放送に出ない)がある。
- 配信では耳 1 本がそのまま束の 1 本(key `"mic"`)。正本(`venue.transcriptBuffer`)と耳ごとの口(`venue.earTranscriptMouth({ engine })`)は各耳へ渡す形で、束が持たない(N 重にならない形が保たれている)。

### 6. ロールの一覧と束(設計 §5・§12.2) — 問題なし(質問 2 への見立ては下)
- 場が一覧を持つ: `openStream` の段 1 で `venueRoles = Object.freeze(configuredRoles())`、閉じる(`markVenueClosed`)まで固め、閉じている間は渡された一覧を読む。長さ 1。テスト「場の間は一覧ごと固める」(途中で一覧が替わっても閉じるまで始めたロールの口を呼ぶ・snapshot の名前も固めたロール・閉じたら今の一覧)。
- **設計 §5 の表との照合**(ロールごと / 共有):
  - 束から引いている: 名前(snapshot の `brain.identity`・whisper の手がかり・呼びかけの照合・判定に渡す名前・soul の行の id と名前)、場の口 6 つ、声の engine の用意と再生器、④思い出しの係。
  - 共有でサーバに 1 つ(設計の表でも共有): 会話の正本・耳(の束)・KILL・自発の ON/OFF・かぶり・場の状態と世代・目・YouTube。
  - 設計の表では「ロールごと」だがサーバに 1 つのまま(Gnome の質問 2): orchestrator(とその忙しさ)・名前以外の判定の部品・口数・声の方式の値(`ttsEngine`)・手動の「今日を記録」(`onMemoryRecord`)。
- **これが止める理由に当たるか**: 当たらない。根拠: (a) 設計 §5 の「最初の的で作るもの」は「サーバは、ロールに依る値を一覧の要素(束)からだけ引く形にする(今の『今のロール 1 つ』の口を直に読まない)。`main()` の中の結び合った変数を『束を作る工場』に切り出すのは 2 つ目のロールのとき」、§12.2 は「備えの深さ: サーバが束からだけ引く形まで」。サーバが直に読んでいた「今のロール 1 つの口」(`currentRoleIdentity`・`streamHooks`・`onPrepareVoiceEngine`・`recallRunner`)は全部束経由になり、旧名は束を渡さない呼び出しの互換だけに残った。(b) orchestrator は `fireOrchestratorFactory` を cockpit.mjs が持つ工場の切り出しとセットで、2 つ目のロールのときに決める事(設計 §5 の「判定を誰の目線で何回呼ぶか」など)に依る。移すと HEAD の「ロールの切り替えをまたいで KILL の状態が生きる」が変わりうる(計画 §4 の理由 2 に近づく)。よって**裁量・持ち越しで足りる**と見る。2 つ目のロールのとき、どのドメインで束へ移すかは Undine の判断(下の質問 2)。
- 束を作る関数: `createVenueRoleBundle(deps)` が `scripts/cockpit.mjs` から export され、`scripts/cockpit-discord-b.test.mjs` で個別にテストされている(束の口が呼んだ時点の今のロールを読む・場の口は同じ参照・声と④は素通し・再生器が起きなくても投げず警告 1 行(文面は HEAD の `voice resources failed to start: …` と同じ)・④が無ければ `recall: null`・`Object.isFrozen`)。`main()` の結線はソース照合のテスト 1 件で固定。`main()` の宣言順(TDZ)も確かめた: `getCurrentRoleIdentity` :2327・`ensureVoiceResources` :2533・`streamVenue` :2825・`recallRunner` :2869 は束を作る :2996 より前。

### 7. `experience`(設計 §4.5) — 問題なし
- body の既定 `"stream"`(省略・null)、`"discord"` は口が無ければ **503**(`DISCORD_EXPERIENCE_UNAVAILABLE_MESSAGE`・場を開かない・`stream.error` に残さない・どの口も呼ばない)、`"voice"`・`"Discord"`・数・真偽・オブジェクトは **400 `invalid experience`**(`sttEngine` と同じ流儀)。内部 `startStream` も同じ。snapshot `stream.experience`(閉じていれば null)・`streamStatus().experience`。`/api/stream/*` と別名 `/api/ears/*` の道の名前は変わっていない(両方の道でテスト)。場が開いている間の始めるは 409(配信の文面のまま)。
- 画面(`src/cockpit/ui/*`)は触っていない(差分に無い)。

### 8. Domain A の持ち越し — 問題なし
- **正本の寿命**: 作るのは `openVenueTranscript`(段 4)、手放すのは場の共通の段(`closeVenueEntrance` の最初・`fail()`・`close()`)で、体験の `closeEntrance` ではない。束から 1 本抜ける(`drop`/`remove`)ことは正本に触れない(束は正本を持たない)。配信では手放す時点は HEAD と同じ(目の直後・耳を畳む前)なので、閉じた後・記録中は正本が無い。
- **null の防御**: 開かない形(場の段で入口を開く直前に確かめ、配信の入口自身も `venue.transcriptBuffer` が無ければ開かない)。テスト「正本の防御」(声の用意を待たせている間に `close()` → 耳を作らず「会話の正本が無い(入口を開けない)」で開かない)。なお配信の入口自身の防御(2 層目)は到達しないのでテストが無い(持ち越し)。
- **`chatBufferAbsent` の文面** `ears not running; viewer comment cannot merge into transcript buffer (no fire).` は 2 か所(:3927・:4026)とも変えていない(差分に出ない)。`cockpit-server.test.mjs` のそのテストは期待値そのままで通る。

### 9. C の範囲に踏み込んでいないか — 問題なし
- `wording` / `teaching` / `judgeSet` は体験の口に置き場を予約しただけ(配信は `null`、外からの口は渡された値を持つ)。サーバは読まない(grep で読む所が無い)。`src/mind/`・`skills/` の差分 0、判定・言葉の差し口は作っていない。

### 10. 約束のテスト(計画 §4 の理由 3) — 足りている
計画 §1 Domain B の各項目: 共通の段と体験の口の分離・配信のふるまい不変(上の 4)、声・再生器・目の移設(4)、耳の束(5)、ロールの一覧・束・束を作る関数の export とテスト(6)、`experience` の API と snapshot と道の名前(7)、A の固定テスト(通る)。足りない約束は無い。細かい欠け(持ち越し 5)は約束の外。

### 11. 守りの決まり(計画 §4 の理由 4) — 違反なし
- 新規・変更に `process.env`・`.env`・`readFile`/`writeFile`(`cockpit-discord-b.test.mjs` が**コード**である `cockpit.mjs` を読んで結線を照合するだけで、データではない)・`homedir`・一時フォルダ作成・`console.*` が無い(grep)。鍵を読む・出す・環境変数に入れるコードは無い。
- 差分で増えた出力は、旧 `onEarsStarted` の中の警告 `[cockpit] WARN: voice resources failed to start: …` が束の `onWarning` に移っただけ(文面同じ・本文・名前・id を含まない)。新しいログへ文字起こしの本文・名前・id を出す所は無い。
- 新規テストは偽の耳・偽の orchestrator・偽の発火の予定・偽の体験の口・loopback の本物のサーバだけ。`settingsStore` を渡さないサーバは in-memory の実体。判定・Decisions API のキーの読み(`loadDecisionsApiKey`)は判定が走るときだけで、既定の方式 `classic` ではテストで走らない(`speakStartModeInitial` を指定しない)。実データ・本物の LLM・外部 API・Discord には触れない。

## 止める指摘

なし。

## 裁量(筋が通ると認めたもの)

1. **声の engine の用意は入口を開く前**(入口を「下見」と「開く」に分け、その間に共通の段の声の用意を置いた)。設計 §4.3 の番号(5 入口 → 6 声の engine)とは違うが、設計自身が「配信では今の順を保つ」と書き、HEAD の実物は「耳の下見 → 声の engine → 耳を起こす → 再生器・目」。既存テストが固定している(M2 の実験で 11 件が落ちる)。Discord でも「声を用意できなければ VC に入らない」になり筋が通る。
2. **閉じる段で目は入口より先**。設計 §4.3 は「入口を閉じる → 目」だが、HEAD の `stopEars` は目が先で、既存テストが固定している(M1 の実験で既存 2 件を含む 5 件が落ちる)。計画 §1 の「配信の期待値を変えた既存テスト 0」と衝突するので、既存を取った判断は妥当。
3. 開く段の中は「再生器 → 目」(HEAD は目 → 再生器)。上の 4 の 1 のとおり見える違いは無い。
4. 目の口を新しい名 `onEyesStart` / `onEyesStop` にし、旧名は残して同じ時に呼ぶ(旧名が先)。cockpit.mjs は新しい名だけ。
5. 束の深さ(orchestrator・判定の部品・声の方式の値・口数・手動記録をサーバに 1 つのまま)。上の 6。
6. 長さ 2 以上の一覧の呼び方(備え): 開く口は順に・最初の失敗で止める、畳む口と最後の保存は全部呼ぶ(同じ写し)。名前・④は先頭のロール。テストあり。
7. 正本の null は開かない形。HEAD は開く途中の `close()` のあとに耳を自前の正本で開いていたので、この場合だけふるまいが変わる(良くなる向き)。
8. 体験の口の約束(`openEntrance`・`closeEntrance` 必須、他は任意、`{ ok:false, reason }` だけを失敗とみなす、`afterOpen` が投げても場は開いたまま、外からの口に `busyMessage` が無ければ中立の文面)。
9. `experience` の値と断り方(閉じている間は null、Discord の口が無ければ 503、知らない値は 400)。「体験の入口が無い」を 500 と分けたのは筋が通る。
10. 耳の束の `userSpeaking` は場ごと(持ち越さない)。上の 4 の 2。
11. 耳の束の置き場 `src/ears/`(D からも使える所)。

## 持ち越し(止めない指摘)

- **Undine へ**: 質問 1(設計 §4.3 の番号)と質問 2(2 つ目のロールのときの束の深さ)。
- Domain D(Discord の入口):
  - 場の段は、`openEntrance` が投げたり `{ ok:false }` を返したりしたとき、`venue.createEars()` で作った束を知らない(`pipeline` に入るのは成功して `ears` が返ったときだけ)。配信は入口自身が `pipeline` を入れて失敗時に空にするので問題ないが、Discord の入口が「束を作って耳を足したあと、別の所で失敗する」場合は、入口自身が自分の束を畳む必要がある(または場の段が最後に作った束を覚えておく)。D の入口の約束に書くか、段の側で覚えるかを D で決める。
  - 想定外の例外・`openSession`/`connectBody` の失敗で `foldStream` が呼ぶ `closeEntrance` は、`openEntrance` が呼ばれていなくても呼ばれうる(HEAD の `stopEars` と同じ性格)。Discord の `closeEntrance` は「開いていない」「二重」に耐える(冪等)作りにする。
  - `prepareEntrance` が `voiceKind` を返さないと、声の engine の用意は共有の `ttsEngine`(配信の準備の選択)を使う。Discord の声の方式の持ち方は D/E で決める。
  - Discord の `earsState`・snapshot の `ears`・health・`stt.engine` の見せ方、「切れた」の出し方(Gnome 報告 §12 の D)。開く途中の想定外の例外の文面「配信を始められない(想定外のエラー…)」は配信の語のまま。
- Domain C: 予約した `wording`/`teaching`/`judgeSet` に差し口をつなぐ。体験の種類は `venueExperience.kind` と snapshot の `stream.experience`。`stream-wording-pin-calls.mjs` の呼び出しだけを合わせる(Domain A の持ち越しのまま)。
- 2 つ目のロールのとき: orchestrator・判定の部品・声の方式の値・口数・手動の「今日を記録」(`onMemoryRecord`)を束へ。`main()` の工場の切り出し。
- Domain G: `chatBufferAbsent` の診断の文面 `ears not running` は今「場が閉じている」の意味(直すなら期待値の変更)。画面は `stream.experience` を使う。
- 小さな点(止めない): `streamStatus:() =>` の空白の欠け(書式)。`stream.experience` が開きかけ・閉じかけの間も入っていることのテストが無い(コードはそうなっている)。「束から 1 本抜けても正本が続く」の直接のテストが無い(束が正本を持たない作りなので構造上は成り立つ)。配信の入口自身の正本の防御(2 層目)のテストが無い(到達しない)。cockpit.mjs の `main()` の結線テストはソース照合(正規表現)で、整形が変わると落ちる(結線の意味は別に束の単体テストと本物のサーバのテストが固定している)。

## 質問(Undine へ。Orch-Sylph が上げる)

1. **設計 §4.3 の番号を実物の順に直してよいか**(Gnome 質問 1)。見立て: 直してよい。実物と既存テストが固定する配信の今の順は、開くが「下見 → 声の engine → 入口を開く → 再生器 → 目」、閉じるが「声を止める → 目 → 正本・耳の束 → 入口を閉じる」。設計 §4.3 の本文自体が「配信では今の順(耳 → 声の engine → 再生器・目)を保つ」と書き、番号の表と食い違っている。番号を直さないと、D 以降が設計の番号どおりに「声の用意を入口のあと」「入口を閉じてから目」と読んで順を逆にしかねない(逆にすると配信の既存テストが落ちる。上の M1・M2)。止める理由ではないので、合格とは独立に決めてよい。
2. **束の深さ**(Gnome 質問 2): orchestrator・判定の部品・声の方式の値・口数・手動記録をサーバに 1 つのまま残した深さで、設計 §5・§12.2(「サーバが束からだけ引く形まで」)を満たしたとみなしてよいか。見立て: 満たしている(サーバが直に読んでいた「今のロール 1 つの口」は全部束経由。残りは cockpit.mjs の工場の切り出しとセットで、2 つ目のロールの決めごとに依る)。2 つ目のロールの前に束へ移すなら、E/F ではなく「2 つ目のロール」を扱うドメインの最初に置くのがよいと見る(Discord の群の D〜G は 1 ロール前提)。
