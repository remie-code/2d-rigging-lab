# Discord モード Domain B — Gnome の完了報告(場と体験の分離・ロールの一覧・声と目を場の共通の段へ・API と snapshot)

> 2026-10-31。ブランチ `ai-cohost/discord-mode`(HEAD `cad2083a`。コミットしていない)。根拠: 計画 [discord-mode-wave-plan.md](../../orchestration/discord-mode-wave-plan.md) §1 Domain B・§4、設計 [discord-mode.md](../../../architecture/discord-mode.md) §4.1〜§4.5・§5・§12.2・§12.3、棚卸し [discord-mode-inventory.md](../../orchestration/discord-mode-inventory.md) §2.2・§2.7・§2.9-7・§3・§9-1・§9-4、Domain A の報告 [domain-a-report.md](domain-a-report.md) §5・§8・§10 とレビューの持ち越し。
> 鍵(`.env*.local`)・実データ(`cockpit-settings.local.json`・`memories/`・`roles/`)は開いていない。操縦席は起動していない。依存・lockfile は変えていない。`src/mind/`・`skills/` は差分 0(`git diff --quiet HEAD -- apps/soul/agent/src/mind apps/soul/agent/skills` exit 0)。

## 判定

完了。配信の期待値を変えた既存テスト 0・既存テストの直し 0・`node --test` 1966/1966・soul-zone pass。質問は 2 つ(§13。どちらも止める理由ではなく、設計の書き方と実物の順が違う所の追認のお願い)。

## 1. 変更ファイル(`apps/soul/agent/` 起点)

変更(2 ファイル):

| ファイル | 規模 | 中身 |
|---|---|---|
| `src/cockpit/cockpit-server.mjs` | +749 / −244(2 ファイル計。大半はこのファイル。旧 `startEars` / `stopEars` の本体を体験の口へ移した分が削除+追加に見える) | 場の共通の段と体験の口の分離、ロールの一覧と束、声と目を共通の段へ、耳の束の受け取り、`experience`(API・snapshot・`streamStatus()`)、`close()` を共通の段の口で畳む |
| `scripts/cockpit.mjs` | (上の計に含む・約 +80 / −30) | `createVenueRoleBundle` を export、`main()` で束を 1 つ作って `roles: [venueRole]` で渡す。目は `onEyesStart` / `onEyesStop`。サーバへの個別のロールの口(`currentRoleIdentity`・`streamHooks`・`onPrepareVoiceEngine`・`onEarsStarted`・`onEarsStopped`・`recallRunner`)は渡さない。古いコメント 4 か所の言い直し |

新規(4 ファイル):

| ファイル | 行 | 中身 |
|---|---|---|
| `src/ears/ear-bundle.mjs` | 114 | `createEarBundle`(耳の束) |
| `src/ears/ear-bundle.test.mjs` | 163 | 耳の束の単体テスト 6 件 |
| `src/cockpit/cockpit-server-discord-b.test.mjs` | 771 | サーバ側 18 件 |
| `scripts/cockpit-discord-b.test.mjs` | 207 | cockpit.mjs 側 4 件 |

## 2. テスト結果

- `apps/soul/agent` で `node --test`: **1966 件 pass / 0 fail / 0 skipped / 0 cancelled**(`duration_ms 91523`)。着手前の土台は 1938(着手時に同じコマンドで 1938/1938 を確認)→ **+28**(耳の束 6・サーバ 18・cockpit.mjs 4)。
- リポジトリの根で `pnpm run check:soul-zone`: pass(`1576 source files scanned; no 器→魂 imports and no 魂→器 code imports.`)。
- `git status`: 変更は上の 2 ファイル + 新規 4 ファイルだけ。package.json / lockfile の変更なし。
- Domain A の固定テスト `src/mind/stream-wording-pin.test.mjs` と fixture 3 本は触らずに通る(上の全件に含む)。
- テストは本物の LLM・外部 API・Discord を呼ばない(偽の耳・偽の orchestrator・偽の体験の口・loopback の本物のサーバ)。ファイルは書かない(一時フォルダも使っていない)。

## 3. 既存テストの期待値

- **期待値を変えた既存テスト: 0 件。**
- **期待値を変えない直しをした既存テスト: 0 件**(既存テストのファイルは 1 つも触っていない)。旧名のオプション(`onPrepareVoiceEngine`・`onEarsStarted`・`onEarsStopped`・`streamHooks`・`currentRoleIdentity`・`recallRunner`)は互換のため残し、束を渡さない呼び出しでは個別の口から束を 1 つ作る形にしたので、既存の偽物の受け取り方も変えずに済んだ。
- ソースの文字列を照合する既存テスト(`cockpit-stream.test.mjs:1260`・`cockpit.test.mjs:3011` の `streamHooks: streamVenue.hooks,`)は、`createVenueRoleBundle({ … streamHooks: streamVenue.hooks, … })` の 1 行で今も合う(期待値は変えていない)。

## 4. 場の段と体験の口の切り方

`openStream` / `closeStream` は 1 本のまま(設計 §4.2 案 A)。Ctrl+C の道(`endStreamForShutdown`)・`fail()`・try/finally・記憶の最後の保存(`saveFinal`)は今と同じ 1 か所。

**場の共通の段**(サーバ): ロールの一覧を固める・場の記録(ロールごと)・KILL / 判定 / 予定 / 思い出しの係・会話の正本・声の engine の用意と再生器(ロールごと)・目・頭のセッション(ロールごと)・器(ロールごと)・記憶の最後の保存(ロールごと)・正本を手放す・耳の束を畳む・場の状態と世代。

**体験の口**(項目名。配信の口 `streamExperience` はサーバの中、Discord の口は `options.experiences.discord` で外から):

| 項目 | 配信(`"stream"`) | 呼ぶ所 |
|---|---|---|
| `kind` | `"stream"` | snapshot の `stream.experience` |
| `prepareEntrance(request)` | 旧 `startEars` の前半(マイク・文字起こしと声の方式の選択と記憶・Starting の放送・ElevenLabs のキー / ローカルのモデルの確かめ)。`{ ok, voiceKind, plan }` | 始める 5 の前半 |
| `abortEntrance(prepared)` | 声の engine を用意できなかったとき耳の状態を Stopped に戻す(放送は場がまとめて 1 回) | 始める 6 の前半の失敗 |
| `openEntrance(plan, venue)` | マイクの耳 1 本を作り、耳の束に束ねて起こす。`{ ok, ears }` | 始める 5 の後半 |
| `closeEntrance({ hadEars, shutdown })` | 耳の状態を Stopped・健康を unknown に戻して放送(旧 `stopEars` の後半)。shutdown のときは放送しない(旧 `close()` と同じ) | 閉じる段・`close()` |
| `afterOpen()` | YouTube を後ろでつなぐ(`startChatForStream`) | 始める 10 |
| `foldAfterOpen()` | YouTube の器官を畳む(`foldChatClient`) | 閉じる段の最初 |
| `busyMessage(phase)` | 今の「配信を始めている途中」など 3 つの文面 | 409 の断り |
| `wording` / `teaching` / `judgeSet` | `null`(= 配信の既定) | 読まない(C の置き場・§10) |

`openEntrance` に渡す場の口 `venue`(`venueEntranceContext()`): `transcriptBuffer`(場の正本 = 積む口)、`earTranscriptMouth({ engine })`(耳ごとの口。旧 `startEars` の `onTranscript` をそのまま関数 `makeEarTranscriptMouth` にした)、`createEars()`(耳の束)、`onVadEvent`(場の VAD の口 `handleVenueVad`)、`onDiagnostic`、`roles`(固めた一覧)。外からの口は `normalizeVenueExperience`(export)で揃え、`openEntrance` と `closeEntrance` が無いものは受け取らない。

**開く順**(コードのコメントにも書いた。太字が体験の口):

1. ロールの一覧を固める(`venueRoles`)・体験を決める(`venueExperience`)
2. 場の記録(ロールごと `renewRecords`)
3. KILL を OFF・判定・予定・思い出しの係を作り直す
4. 会話の正本(`openVenueTranscript`)
5. **入口の下見**(`prepareEntrance`)
6. 前半: 声の engine の用意(ロールごと `voice.prepare`)
   - 正本が無ければここで開かない(§9)
5. 後半: **入口を開く**(`openEntrance`)
6. 後半: 再生器(ロールごと `voice.startResources`)
7. 目(`onEarsStarted` → `onEyesStart`)
8. 頭のセッション(ロールごと `openSession`)
9. 器(ロールごと `connectBody`)
10. **開いたあと**(`afterOpen`)

**閉じる順**: 写し → **開いたあとの片付け**(`foldAfterOpen`)→ 判定・予定・思い出しの係 → 声を止める(orchestrator.kill)→ 目(`onEarsStopped` → `onEyesStop`)→ 正本を手放す → 耳の束を畳む → **入口を閉じる**(`closeEntrance`)→ 頭のセッション(ロールごと)→ 器(ロールごと)→ 記憶の最後の保存(ロールごと・同じ写し)→ 閉じる(一覧と体験も手放す `markVenueClosed`)。`close()` は 正本 → 耳の束 → 入口(shutdown)→ 閉じる → 目 で、旧 `close()` と同じ並び。

設計 §4.3 の番号と違う所が 2 つある(どちらも配信の今の順を保つため。§11 裁量 1・2、§13 質問 1)。

## 5. 声と目を移しても配信のふるまいが変わらないことの確かめ方

実物で読んだ旧 `startEars` の順: 方式の記憶 → Starting の放送 → 文字起こしのキー / モデルの確かめ(失敗なら声は用意しない)→ **声の engine の用意(耳を作る前)** → 耳を作って起こす → `onEarsStarted`(撮る係 → 再生器)。声の用意の失敗時は「耳を Stopped・stt を unknown・tts を down にして 1 回放送 → 場の `fail(理由, {})`(耳も目も畳まない・器だけ畳む)」。耳の起動の失敗時は `onEarsStarted` も `onEarsStopped` も呼ばない。これをそのまま保った。

固定するテスト:

| テスト(`src/cockpit/cockpit-server-discord-b.test.mjs`) | 何を固定するか |
|---|---|
| 「配信の開く順」 | `renewRecords → stt 記憶 → tts 記憶 → voice.prepare → 耳を作る → 耳を起こす → 再生器 → 目(旧名 → 新しい名)→ openSession → connectBody`、`stream.experience` が `"stream"` |
| 「配信の閉じる順」 | `目(旧名 → 新しい名)→ 耳の dispose → closeSession → closeBody → saveFinal`、耳を畳む時点で正本は手放し済み(0 件)、写しは畳む前、閉じたら `experience` は null |
| 「声の engine を用意できなければ…」 | 耳を作らない・再生器 / 目を起こさない・目の停止も呼ばない・器だけ畳む・tts down と理由・stt unknown・stream.error・正本を手放す |
| 「文字起こしのキー切れが先なら…」 | 声の engine は用意しない |
| 「耳が起きなければ…」 | 再生器・目を起こさない・目の停止も耳の dispose も呼ばない |
| 「頭のセッションを作れなければ…」 | 目 → 耳 → 頭 → 器の順で畳む |
| 「close()」 | 耳 → 目(旧名・新しい名)・正本は耳の前に手放す・保存は頼まない・`streamStatus()` の形 |
| `scripts/cockpit-discord-b.test.mjs`「束を cockpit-server に渡す」 | 本物の `createStreamVenueHooks` + `createVenueRoleBundle` + 本物のサーバで、始める `usageLog.renew → memory.prepare → voice.prepare → ears.start → voice.resources → eyes.start → session.open → channel.getUrl → channel.connect`、終える `eyes.stop → ears.dispose → session.close → channel.close → memory.record`、close() で目を止める |

加えて、旧名で順を固定している既存テスト(`cockpit-stream.test.mjs` の始める / 終える / Ctrl+C の並び、`cockpit-server.test.mjs` の声の選択 6 件と撮る係の口 2 件、`cockpit-server-domain-e.test.mjs` の想定外の例外 2 件、Domain A の「耳が無くても正本はある」)が期待値そのままで通る。

## 6. 耳の束の形とテスト

- `src/ears/ear-bundle.mjs` の `createEarBundle({ onVadEvent })`(export)。口: `add(key, ear)`・`remove(key)`(畳まない)・`drop(key)`(畳む)・`has`・`keys`・`size`・`vadMouth(key)`(耳ごとに喋っているかを覚えてから、場の VAD の口へ `(event, key)` で渡す)・`userSpeaking()`(どれか 1 本でも)・`start()`(順に起こす。起きない耳があれば起きた分と未起動の分を畳み、束を空にして投げ直す。起きなかった耳は耳の側が自分を畳む約束なので畳まない)・`dispose()`(冪等・1 本が投げても残りを畳む)・`isDisposed`。
- サーバの `pipeline` は今は耳の束。サーバが使うのは寿命(`dispose`)と `userSpeaking` だけであることを実物で確かめた(`pipeline` を読む所: 旧 `startEars` の guard と `onSttStatus` の「別の Start の通知は無視」の比較、`stopEars` / `close()` の dispose、`getQuietGap` の `pipeline != null && userSpeaking`。正本は A で場に出ている)。`userSpeaking` のサーバ変数は無くし、束が持つ。喋り終わりの時刻(`lastSpeechEndAtMs`)は場が持つ。
- 配信ではマイクの耳 1 本がそのまま束の 1 本(key `"mic"`)。耳には同じ正本と同じ耳ごとの口を渡す形のまま(N 重にならない)。
- テスト: `src/ears/ear-bundle.test.mjs` 6 件(1 本の寿命・N 本の userSpeaking と VAD の渡し方・1 本だけ外す・起きない耳の扱い(N 本 / 1 本)・同じ正本と耳ごとの口なら 1 行 1 回)。サーバ側は `cockpit-server-discord-b`「耳の束: 配信のマイクの耳は束の 1 本」(VAD が束を通って SSE と getQuietGap に届く)と「体験の口(Discord の偽物)」(人ごとの耳 2 本の束で 1 行 1 回・耳ごとの遅延・誰か 1 人でも喋っていれば喋っている)。

## 7. ロールの一覧と束の形

- サーバ: `options.roles`(配列か、配列を返す関数)。要素 = ロールごとの束 `{ id?, identity?, hooks?, voice?: { prepare?, startResources? }, recall?: { run } }`。場が開くとき(始める 1)に一覧ごと固め(`venueRoles`、`Object.freeze`)、閉じるまで同じ一覧を使う。閉じている間は渡された一覧を読む。
- サーバがロールに依る値を引く所(すべて束から): 名前(snapshot の `brain.identity`・whisper の手がかり・呼びかけの照合 `nameVariantsProvider` / `commentNameVariantsProvider`・判定に渡す名前 `currentSoulName`・soul の行の `getSoulSpeaker`)、場の口 6 つ(`runRoleHooks` = 開く口・順に・最初の失敗で止める、`runRoleHooksAll` = 畳む口と最後の保存・全部呼ぶ。口を引くこと自体が投げたら今と同じく想定外の例外として投げる)、声の engine の用意(`prepareVenueVoices`)と再生器(`startVenueVoiceResources`)、④(`runLeadRecall`・思い出しの係を作るかも束で決める)。
- 束を渡さない呼び出し(今のテスト)は、個別の口(`currentRoleIdentity`・`streamHooks`・`onPrepareVoiceEngine`・`recallRunner`)から束を 1 つ作る(`legacyRole`)。`streamHooks` はコピーせずそのまま渡す(ゲッターで投げるテストの意味を保つ)。
- 場で共有するもの(サーバに 1 つ): 会話の正本・耳(の束)・KILL・自発の ON/OFF・かぶり・場の状態と世代・目・YouTube。**orchestrator・判定の部品・声の方式の値(`ttsEngine`)・口数は今もサーバに 1 つ**(§11 裁量 5・§12)。
- cockpit.mjs: `createVenueRoleBundle(deps)`(export・`scripts/cockpit.mjs`)。`deps` = `currentId`・`identity`・`streamHooks`・`prepareVoice`・`startVoiceResources`・`recallRunner`・`onWarning`。束の口はどれも呼んだ時点の今のロールを読む(ロールの切り替えで作り直さない)。再生器が起きなくても投げず、警告の 1 行(旧と同じ文面 `voice resources failed to start: …`)。`main()` の工場の切り出しはしていない(設計 §5・§12.2 のとおり 2 つ目のロールのとき)。
- テスト: `scripts/cockpit-discord-b.test.mjs`(束の口が今のロールを読む・場の口は同じもの・声と④の素通し・再生器の失敗を握る・本物のサーバに渡したときの並び・`main()` の結線をソースで固定)。`cockpit-server-discord-b`(名前を束から引く・場の間は一覧ごと固める(途中で一覧が替わっても閉じるまで始めたロールの口を呼び、snapshot の名前も固めたロール)・長さ 2 で場の口と声がロールごとに順に呼ばれ、最後の保存は同じ写しで両方・片方が開けなければ両方畳む・④は先頭のロールの `recall.run`)。

## 8. `experience` の出る所

- **API の body**: `POST /api/stream/start`(と別名 `/api/ears/start`)の `experience`。無い / null → `"stream"`。`"stream"` → 配信。`"discord"` → Discord の口(`options.experiences.discord`)があればその口で開き、**無ければ 503・`error` = `DISCORD_EXPERIENCE_UNAVAILABLE_MESSAGE`(「Discord の体験はまだ使えない(この操縦席には Discord の入口が無い)」・export)・場は開かない・`stream.error` に残さない・どの口も呼ばない**。それ以外(`"voice"`・大文字・数・真偽・オブジェクト)→ 400 `invalid experience`(`sttEngine` と同じ流儀・場は開かない)。B の cockpit.mjs は Discord の口を渡さないので、本番では `"discord"` は常に 503。
- 内部 API `startStream({ experience })` も同じ(503 / 400 を返す)。
- 場が開いている間の始めるは、今と同じく 409(文面は開いている場の体験の口の文面。配信なら今の「配信の途中…」)。
- **snapshot**: `stream.experience` = 開いている(開きかけ・閉じかけを含む)場の体験の種類。**閉じている間は null**。`streamStatus()`(内部 JS API)にも同じ `experience`。
- 語彙は `VENUE_EXPERIENCES = ["stream", "discord"]`(export)。`/api/stream/*` の道の名前は替えていない。画面(`src/cockpit/ui/*`)は触っていない。

## 9. Domain A の持ち越しの扱い

- **切れ目**: 正本を作る所(`openVenueTranscript`)・手放す所(`releaseVenueTranscript`)は場の共通の段にあり、体験の入口には `venue.transcriptBuffer`(積む口)と `venue.earTranscriptMouth({ engine })`(耳ごとの口。旧 `startEars` の `onTranscript` を関数 `makeEarTranscriptMouth(engine)` に出した)を渡す。
- **正本の寿命**: 手放すのは場の共通の段(閉じる段の「入口を閉じる」の直前 `closeVenueEntrance`・`fail()`・`close()`)に寄せた。耳を畳むこと(耳の束から 1 本抜けること)では手放さないので、Discord で人が抜けても場の正本は続く。手放す時点は配信では今と同じ(目を止めた直後・耳を畳む前)にしたので、閉じた後・記録中は今と同じく正本が無く、`chatBufferAbsent`(`cockpit-server.test.mjs:1903`)も A の裁量 2(閉じている間は正本が無い)も変えずに通る。
- **null の防御**: 開かない形にした。場の段が入口を開く直前に正本を確かめ、無ければ入口の `abortEntrance` を呼んで「会話の正本が無い(入口を開けない)」で開かない。配信の入口(`openStreamEntrance`)自身も `venue.transcriptBuffer` が無ければ開かない(耳に自前の正本を持たせて隠さない)。到達するのは「開く途中で `close()` された」ときなど。テスト `cockpit-server-discord-b`「正本の防御」(声の用意を待たせている間に `close()` → 耳を作らずに開かない)。旧コードはこの場合に耳が自前の正本で開いていた(§11 裁量 7)。
- **`chatBufferAbsent` の文面** `ears not running; viewer comment cannot merge into transcript buffer (no fire).`(2 か所)は**変えていない**。持ち越し(§12)。

## 10. C の置き場

体験の口に 3 つの項目を予約した(配信の口は `null` = 配信の既定。サーバはまだ読まない。外からの口は渡された値をそのまま持つ):

- `wording`: ②④の固定の指示と頼み・`skills/recall.md`・思い出しの結果を①に渡す文面の語の組(設計 §3.4 a)。
- `teaching`: ①に足す体験の教え(配信は足さない = null)。
- `judgeSet`: 判定の問いの組み立て(speak-now の問い・選択肢・入力の整形。設計 §8 b)。

C はこの 3 つに配信の既定を置くか、null のときに今の配信の文面を使う形で差し口をつなげる想定。`src/mind/` の文面・`skills/` は触っていない。

## 11. 裁量(決めたことと理由)

1. **声の engine の用意は今も入口を開く前**(入口を「下見」と「開く」に分け、その間に共通の段の声の用意を置いた)。設計 §4.3 は「5 入口を開く → 6 声の engine」と番号を振り、「配信では今の順(耳 → 声の engine → 再生器・目)を保つ」と書くが、実物の順は「耳の下見(方式の記憶・キー / モデル)→ 声の engine → 耳を起こす → 撮る係・再生器」で、既存テスト(`cockpit-server.test.mjs` の「耳を開く前に用意する口を呼ぶ」「用意できなければ耳の pipeline は作らない」「文字起こしのキー切れが先なら声は用意しない」、Domain A の「耳が無くても正本はある」)がこの順を固定している。今のふるまいを保つ側を取った。Discord でも「声を用意できなければ VC に入らない」になり筋が通る(§13 質問 1)。
2. **閉じる段で目は入口より先**(設計 §4.3 の閉じる順は「入口を閉じる → 目」)。実物の旧 `stopEars` は「撮る係を止める → 正本 → 耳」で、既存テスト(`cockpit-stream.test.mjs:941`・`:1028` の `"eyes.stop", "ears.dispose"`)が固定している。今の順を保った(§13 質問 1)。
3. **開く順の 6・7 の中は「再生器 → 目」**(旧 `onEarsStarted` の中は「撮る係 → 再生器」)。設計 §4.3 の番号(6 再生器 → 7 目)に合わせた。2 つは互いに待たない独立の起動(常駐 PowerShell と流し込みプレイヤー)で、どちらも失敗しても場を止めないので、配信のふるまいは変わらない見込み(`main()` はテストで通せないので、`scripts/cockpit-discord-b.test.mjs` の並びとソースの照合で固定)。
4. **目の口の名前**: 旧名 `onEarsStarted` / `onEarsStopped` は残し(既存テストが固定)、新しい名 `onEyesStart` / `onEyesStop` を足した。両方を同じ時に呼ぶ(旧名が先)。cockpit.mjs は新しい名だけを使う。声の engine の用意の旧名 `onPrepareVoiceEngine` も残し、束を渡さないときの束の `voice.prepare` にした。
5. **束の深さ**: サーバが束から引くのは「名前・場の口 6 つ・声の engine の用意と再生器・④」まで。orchestrator・判定の部品(speak-now・コメント反応)・声の方式の値(`ttsEngine`)・口数はサーバに 1 つのまま。orchestrator は今「ロールの切り替えをまたいで生きる」(KILL の状態を持ち越す)ので、束へ移すとそのふるまいが変わるため。判定の部品の名前は束から引いている。2 つ目のロールのときに束へ移す(§12)。
6. **ロールの一覧が長さ 2 以上のときの呼び方**(備え): 開く口は順に呼んで最初の失敗で止め、畳む口と最後の保存は全部呼ぶ(同じ写し)。声の用意は順に・最初の失敗で止める。名前・④は先頭のロール。「2 ロールが同時に話し出さない順番」などは設計 §5 のとおり今は決めない。
7. **正本の null の防御は開かない形**(§9)。旧コードでは開く途中で `close()` されると耳が自前の正本で開いていたので、この場合だけふるまいが変わる(配信の通常の流れでは到達しない)。
8. **体験の口の約束**(外から渡す口): `openEntrance` と `closeEntrance` は必須、他は任意。結果は `{ ok:false, reason }` だけを失敗とみなす。`afterOpen` が投げても場は開いたまま(配信の YouTube と同じ「つながらなくても開く」)。外からの口の `busyMessage` が無ければ中立の文面(「場を開いている途中…」など。配信では使われない)。Discord の耳の状態(snapshot の `ears`・health)をどう見せるかは D で決める(B の外からの口は `earsState` に触れない)。
9. **`experience` の値**: 閉じている間は null(最後の値は残さない)。`"discord"` で口が無いときは 503(このサーバの「口が無ければ 503」の流儀。体験の入口が開けない = 500 とは分けた)、`stream.error` には残さない(始めようとしていないため)。知らない値は 400。
10. **耳の束の `userSpeaking` は束ごと**: 束は場ごとに新しく作るので、前の場で喋っている途中に閉じた「喋っている」は次の場に持ち越さない(旧サーバ変数は場をまたいで残っていた)。隙間で手動の圧縮の材料(`getQuietGap`)だけに効き、配信の通常の流れでは差が出ない。
11. 耳の束の置き場は `src/ears/`(耳の部品)。サーバの中に置かず、Discord の部品(D)からも使える所にした。

## 12. 持ち越し(次のドメインへ)

- **Domain C**: 体験の口の `wording` / `teaching` / `judgeSet`(§10)に差し口をつなぐ。体験の種類は `venueExperience.kind`(サーバ内)と snapshot の `stream.experience` で読める。
- **Domain D**: Discord の体験の口を `src/discord/` の部品で作り、cockpit.mjs から `experiences: { discord }` で渡す(約束は `createCockpitServer` の `options.experiences` の JSDoc と §4・§11 裁量 8)。人ごとの耳は `venue.createEars()` の束に `add` / `drop` し、各耳に `venue.transcriptBuffer` と `venue.earTranscriptMouth({ engine })` を渡す。Discord の耳の状態の見せ方(snapshot の `ears`・health・`stt.engine`)、途中で切れたときの「切れた」の出し方(設計 §4.3・§6.1)、`stream.experience` と並べる接続の状態(設計 §4.5)は D で決める。開く途中の想定外の例外の文面「配信を始められない(想定外のエラー…)」は配信の語のまま(体験の口の文面にするなら D/F)。
- **2 つ目のロールのとき**: orchestrator・判定の部品・声の方式の値・口数・手動「今日を記録」(`onMemoryRecord`)を束へ。`main()` の結び合った変数の工場の切り出し(設計 §5・§12.2)。
- **画面(G)**: `chatBufferAbsent` の診断の文面 `ears not running` は今「場が閉じている」の意味(変えると期待値の変更)。snapshot の `stream.experience` を使う。
- 設計 §4.3 の番号(開く順の 5 と 6、閉じる順の入口と目)を実物の順に直すかは Undine の判断(§13 質問 1)。

## 13. 質問

1. **設計 §4.3 の順の書き方の追認**: 実物と既存テストに合わせて、(a) 声の engine の用意は「入口の下見」と「入口を開く」の間(設計の番号では 6 が 5 の途中に入る)、(b) 閉じる段で目は入口より先、にした(§11 裁量 1・2)。どちらも配信の今のふるまいそのもので、設計自身の「配信では今の順を保つ」に沿うと読んだ。Discord もこの共通の段を通るので、Discord でも「声を用意できなければ VC に入らない」「目を止めてから VC を抜ける」になる。設計の §4.3 の番号をこの順に直してよいか(止める理由ではないので、合格の判断とは独立に決めてもらえばよい)。
2. **束の深さ(§11 裁量 5)**: orchestrator・判定の部品・声の方式の値・口数をサーバに 1 つのまま残した(orchestrator はロールの切り替えをまたいで KILL の状態を持ち越す今のふるまいがあるため)。設計 §5 の「サーバはロールに依る値を束からだけ引く」をこの深さで満たしたとみなしてよいか。2 つ目のロールの前に束へ移すべきなら、どのドメインで扱うか。
