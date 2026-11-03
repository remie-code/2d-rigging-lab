# Discord モード 全体の突き合わせ(Sylph、2026-11-01)

> 対象: ブランチ `ai-cohost/discord-mode`(HEAD `79b09fd5`)。基点は `git merge-base master HEAD` = `6327a42b`。`git diff 6327a42b...HEAD -- apps/soul/agent`(80 ファイル、+14575 / −591)。
> 見たもの: wave 計画(Status の追認 A〜G・§4・§5)、設計 `architecture/discord-mode.md`、scope §21〜§24、各ドメインの報告とレビューの持ち越し・裁量、差分のつなぎ目のコード。コードは直していない。試しは OS の一時フォルダ(セッションの scratchpad)だけで行い、消した。

## 1. 判定: **needs_fix**

- 止める指摘は **1 件だけ**(既知の隙間 3。Undine が直すと決めた「場が閉じている間に Connect した YouTube のコメントが Discord の場の正本に積まれる」)。再現できた。
- それ以外に新しい止める指摘は無い。つなぎ目(場の切り替え・記録の分離・正本と人ごとの耳・鍵・ログ)は、設計どおりに動くことをコードと試しで確かめた。
- 直しを入れたあと、`node --test` 全件と `check:soul-zone` が通れば合格でよい(2 回目の突き合わせは要らない。直しの所と、そのテストだけ見ればよい)。

## 2. 止める指摘

### 2-1. Discord の場で YouTube のコメントが会話の正本に積まれる(既知の隙間 3)

- **根拠**
  - 設計 §4.3 の表: Discord には「開いたあと: なし」。設計 §8: 「コメント反応は Discord では作らない」。
  - 通話の語の組 `CALL_WORDING.speakers`(`src/mind/venue-wording.mjs:73` 付近)は「you = 通話で話す人…、soul = 相方の AI 自身。」で、viewer の説明が無い(設計 §3.4 の表「Discord ではコメントが無いので viewer の説明は外す」)。
  - ①の教え `skills/venue-discord.md` は「配信ではないので、視聴者もコメントもありません。」と言う。
  - 計画 §5 は「同じ日の配信と通話の記録が混ざらないこと」を見ると定めている。
  - viewer の行が通話の正本に入ると、②(通話の記録)・④の直近の会話・speak-now の判定の入力・①への行のどれにも入る。教えとも、②の材料の説明とも食い違う。
- **再現**(scratch のテスト。`cockpit-server-discord-g.test.mjs` の `startServer` をそのまま使った)
  1. `POST /api/chat/connect`(場が閉じている間なので 200)
  2. `POST /api/stream/start { experience: "discord" }`(200)
  3. `server.ingestChatMessage({ text, displayName, messageId })`(器官の `onMessage` と同じ口)
  - 結果: `server.getTranscript()` が `[{speaker:"viewer", text:"通話に混ざるコメント"}]`、snapshot の `transcripts` も `["viewer"]`。弾く判定(`commentGuard`)も走る。
- **原因**
  - `ingestChatMessage`(`src/cockpit/cockpit-server.mjs:4457`)と `commitComment`(`:4560`)は、`venueTranscript` があるかしか見ていない。
  - Discord の口には `foldAfterOpen` が無い。そのため、場が閉じている間につないだ器官(`chatClient`)は Discord の場の間も生きていて、`onMessage → ingestChatMessage` が通る。
  - G の守り(`POST /api/chat/connect` の 409、`commentReact.isActive` の `!venueFixesSpeakNow()`)は、新しく Connect することと反応の判定は止めている。しかし、積むことは止めていない。
- **直し方の指針(案 a)**: §3 に書いた。
- **要るテスト**: §3 に書いた。

## 3. 既知の隙間 3 の直し方の指針

### 入れる所

1. **主の入口(必須)**: `ingestChatMessage`(`src/cockpit/cockpit-server.mjs:4457-4495`)の先頭、`if (closed) return;`(:4458)の直後に足す。
   ```js
   // Discord の場（開きかけ・開いている・閉じかけ）にはコメントが無い（discord-mode.md §4.3）。閉じている間に Connect した
   // 器官のコメントは、弾く判定にも正本にも回さずに捨てる（ユーザーの Connect は切らない・器官は畳まない）。
   if (discordVenueActive()) return;
   ```
   - 弾く判定より前に置く。後ろに置くと、LLM の判定(費用)とターミナルの判定の 1 行(`reportComment`)が無駄に走る。
   - `discordVenueActive()`(:2311)は `venueExperience.kind === "discord"` を見る。開きかけ(段 1 で `venueExperience` を入れたあと、段 4 で正本ができる前後)と閉じかけも含むので、開く途中・閉じる途中に届いたコメントも捨てられる。
   - 捨てるたびの診断(`chatBufferAbsent` のようなゴースト行)は出さない方がよい。今の `chatBufferAbsent` は `reason` に視聴者の名前を載せる。Discord の場のログのタブに、関係の無い行を 1 コメントごとに出す理由も無い。出すなら、名前も本文も無い数だけの 1 回きりにする(Gnome の裁量)。
2. **守りの 2 層目(任意・推奨)**: `commitComment` の `const buffer = venueTranscript;`(:4562)の前に、同じ `if (discordVenueActive()) return;` を置く。
   - 今の作りでは届かない: 弾く判定の待ち行列 `guardQueue` は、場を開く段 3(`renewJudges → parkJudges → discardJudgments`)と、閉じる段(`foldStream → parkJudges`)で空になる。そのため、配信の場で受けたコメントが Discord の場で積まれる道は無い。
   - それでも 1 行で済み、将来の組み替えへの守りになる。
- 変えない所: `chatClient` は畳まない(案 a)。`POST /api/chat/disconnect` は今どおり。配信の場に戻れば、同じ器官のコメントは今どおり積まれる(`startChatForStream` は器官があれば `"kept"`)。

### 要るテスト

置き場は `src/cockpit/cockpit-server-discord-g.test.mjs` に足すか、新規ファイル(例 `cockpit-server-discord-final.test.mjs`)。今の `makeChat()` は `onMessage` の手を捨てているので、手を覚えて流せる形に直す。直接 `ingestChatMessage` を呼ぶのでもよいが、器官の道を通す方がよい。

1. **閉じている間に Connect → Discord の場 → コメントが届く → 何にも入らない**
   - 正本(`getTranscript()` と snapshot の `transcripts`)に viewer の行が無い。
   - SSE の `transcript` に `speaker:"viewer"` が出ない。
   - 弾く判定(`commentGuard`)が呼ばれない(数える)。
   - 反応の判定(`reactCalls`)が 0。
   - 閉じたときの `saveFinal` に渡る転写に viewer の行が無い(ロールの束の `saveFinal` で転写を受け取る)。
   - 器官は畳まれていない(`stop` が呼ばれていない・`chat.record.sources` は増えない)。
2. **同じ器官のまま、Discord を閉じて配信を始める → 今どおり積まれる**: viewer の行が積まれ、放送され、弾く判定を通る(案 a が配信を壊さないこと・Connect が持ち越されること)。
3. (任意)**Discord の開きかけに届いたコメントも捨てる**: 偽の Discord のログインを門で止めて、`phase === "opening"` の間に流す。
4. 直しの 1 行を外すと 1 が落ちることを Gnome が確かめる(前例の流儀)。
- 既存テストへの影響: Discord の場でコメントを流す既存テストは `cockpit-server-discord-g.test.mjs:401`(反応の判定 0 を見るだけ)で、直しのあとも通る見込み。`cockpit-server-discord-a.test.mjs` のコメントの流し込みは配信の場なので影響しない。

### ほかに同じ型の隙間(配信のための入口が Discord の場に漏れる所)が無いか

API の道 32 本と、場の段・判定・予定・保存の係を見た。止める必要があるのは上のコメントの入口だけだった。

| 入口 | Discord の場での扱い | 判定 |
|---|---|---|
| `POST /api/chat/connect` | 409(G) | 済み |
| 器官の `onMessage → ingestChatMessage` | **積まれる** | **上の直し** |
| 器官の `onStatus` → `refreshStateWarnings` の「チャットが切れている / 繋ぎ直し中」 | 閉じている間に Connect した器官があれば、上の帯に出る | 止めない(Connect を切らない案 a と矛盾しない、正しい警告。§4 の 3) |
| `startChatForStream`(開いたあとの YouTube) | 配信の口の `afterOpen` だけ。Discord は呼ばない | 漏れなし |
| 配信の場で後ろでつないでいる YouTube | 閉じる段で `foldChatClient`。世代が替われば `stillMine` で捨てる | 漏れなし |
| 発火の予定(沈黙・区切り・合いの手・コメントの呼びかけ) | 段 3 で `parkFireScheduler`、`handleChatMessage` も無視 | 漏れなし(F のテスト) |
| コメント反応 | `isActive` に `!venueFixesSpeakNow()` | 漏れなし(G のテスト) |
| `POST /api/speak-start` | 409(F) | 済み |
| `POST /api/self-fire`・`/api/verbosity` | 畳んだ予定の値の置き場だけを替える | 漏れなし(F のテスト) |
| `POST /api/fire`・`/api/vision-fire`(手動・AHK) | 通る。見る窓は `createVenueVisionTarget` で Discord の窓 | 操作者の操作なので可(設計に断る定めなし) |
| `POST /api/vision-target`・`/api/audio-device`(配信の準備) | 通るが、Discord の場の目・声には効かない(`ensureVoiceResources` は差し口に再生器があれば手元の再生器を起こさない) | 漏れなし |
| `POST /api/stream/start` の `device`・`sttEngine`・`ttsEngine` | Discord の下見は読まない(`resolveLastDevice()` を読むだけ) | 漏れなし |
| ②の保存(20 分ごと・手動・最後) | 頼んだ時点の語の組と置き場 | 漏れなし(§5 の 2) |

## 4. 止めない指摘(持ち越し)

1. **whisper の人ごとの口の番号の使い回し**【推測】
   - 抜けた人の席(`slot`)はすぐ空く。抜けた人の耳の畳み(`void s.ears.drop(key)`)は待たない。そのため、入り直してすぐ話すと、同じ口の番号(8178 + slot)で whisper-server を起こし直すことがありうる。
   - 起きなければ `failPerson` で、その人は「その場の間は聞かない」になる。もう一度抜けて入り直すまで聞かれない。
   - 偽物では確かめられない。人間ゲート 2 で「抜けて入り直してすぐ話す(whisper)」を見る(§6 の 10)。起きるなら、席を空けるのを `drop` の完了後にする、という小さな直しで済む。
2. **人が話している途中に抜けたときの VAD**【推測】
   - 束から外すと `userSpeaking` は正しく下がる。ただ、割り込みの機械弁と `lastSpeechEndAtMs` に `speechEnd` が届くかは、耳の dispose 次第になる。
   - 最初の的は 1 人なので害は小さい。仲間を入れる区切りで見る。
3. **閉じている間に Connect した器官の警告**: Discord の場の上の帯に「チャットが切れている」などが出うる。Connect を切らない案 a の筋に合う正しい表示なので、そのままでよい。気になるなら人間ゲート 2 で見る。
4. **E の持ち越し(既知)**: 場を閉じた直後に進行中の Fire が `ensureVoiceResources` を通ると、手元の再生器が起きうる端の場合。D の質問 1(ElevenLabs の短い発話)、E の質問 2・3(ENDED の見張りの限界・`startedDelayMs`)は、計画どおり人間ゲート 2 のあと。
5. **`chatBufferAbsent` の `reason` に視聴者の名前**(配信の既存の仕様、ログのタブ): 今回の範囲外。直しの §3 で、Discord の場ではこの診断を出さない形にすれば、Discord には関わらない。

## 5. 見る所 1〜8 の結果

### 1. 配信と Discord の場の切り替え — 問題なし(隙間 3 を除く)

- 試し(scratch、本物の server + 本物の Discord の口 + 偽の Discord)で、配信 → 閉じる → Discord → 閉じる → 配信の順に開け閉めした。
  - 配信: `experience:"stream"`・`connection:null`・`stt:whisper`・`speakStartFixed:false`・`speakStart:"classic"`
  - Discord: `"discord"`・`"joined"`・`elevenlabs`(Discord の準備)・`true`・`"speak-now"`
  - 閉じたあと: `null`・`null`・`whisper` に戻る・`false`・`"classic"`
  - 2 回目の配信: 1 回目と同じ形。正本は場ごとに空から始まる。
  - 目は場ごとに start / stop が対になる。ログインは 1 回、destroy も 1 回。
- コードで確かめた、場ごとに替わる物:
  - **再生器**: `venuePlayers` の差し口。出口の `dispose` で空に戻る。
  - **目**: `startVenueEyes`(体験の口の `eyesWanted`)と `stopVenueEyes`。止める方は冪等。
  - **耳の束**: `pipeline = opened.ears`。閉じる段の `foldVenueEars` と、入口の `teardown` で畳む。
  - **正本**: `openVenueTranscript` / `releaseVenueTranscript`。
  - **判定の組**: `makeSpeakNow` と `makeRecallDesk` は段 3 で作り直す。そのとき `venueExperience` はもう段 1 で入っている。
  - **語の組と教え**: ②は頼んだ時点、①は段 8 のセッションを作る時点、④は係を作る時点で取る。
  - **speak-now の固定**: `venueFixesSpeakNow` は `venueExperience` を見る。閉じれば `null` になって外れる。
  - **自発の予定**: Discord は `parkFireScheduler`、配信は `renewFireScheduler`。自発の ON/OFF・口数は畳んだ予定から引き継ぐ。
  - **場の間だけの方式**: `markVenueClosed` で `venueSttEngine` と `venueExperience` を手放す。
- 開く途中の失敗: Discord の頭のセッションを作れない場合を試した。応答は 500 で、`phase:"closed"`・`connection:null`・`ears:"stopped"`・`stt` は配信の選択に戻り・`speakStartFixed:false`。VC は抜けてログアウト済み(destroy 1)。続けて配信が開ける。下見の失敗、声の engine の失敗(`abortEntrance → stopEars`)、入口の失敗(`refuse → teardown → stopEars`)もコードで追った。
- Ctrl+C: Discord の場で `endStream()`(cockpit.mjs の shutdown と同じ道)を呼ぶと、`closeStream` を通って閉じ、ログアウトする。最後の保存は `markVenueClosed` の前に頼むので、Discord の語で書く(C のテスト `cockpit-server-discord-c.test.mjs:255` が固定)。開きかけ・閉じかけなら、終わるのを待つ。サーバの `close()` も同じ口(`closeEntrance({shutdown:true})`)で畳む。ログイン中に閉じたときのログアウトは E が直した。

### 2. 同じ日の配信と通話の記録が混ざらない — 問題なし(隙間 3 を除く)

- **本体のファイル名**: `renewRecords` → `memoryPlaces.beginStream` で、置き場(`streamRecord`)を場ごとに作り直す。F のテスト(`scripts/cockpit-discord-f.test.mjs:51`・`:84`)が `-2`・`-3` を固定している。
- **②の語の組**: `createMemoryRecorder.record()` が、頼んだ時点で `getWording()` と `placeNow()` を同期で取る。待っている 1 件を差し替えるのは同じ置き場のときだけで、置き場は場ごとに別の物なので、配信と通話の頼みはまとまらない。
- **20 分ごとの保存**: `isStreamOpen` は phase が `"open"` のときだけ。Discord の場の間は Discord の語・Discord の置き場で書く。
- **最後の保存**: `closeStream` の段 3 は `markVenueClosed` の前なので、Discord の語で書く。待ちが時間切れになって先に閉じても、走っている保存は頼んだときの語・置き場のまま。そのあと配信を始めても、新しい置き場に書く。
- 混ざりうるのは、正本に viewer の行が入る §2-1 だけ。

### 3. 既知の隙間 — §2-1・§3

### 4. 正本と人ごとの耳 — 問題なし

- **人が抜けた・入り直した**
  - 抜けると `handleVoiceState` が束から `drop` する。購読・デコーダ・音の入口も畳む。正本は続く。
  - 入り直すと、新しい key(`discord-<通し番号>`)で新しい耳ができる。D のテスト(`cockpit-server-discord-d.test.mjs:452`)が固定している。
  - 耳が起きなかった人は、抜けるまでその場の間は聞かない(D の裁量)。束の `userSpeaking` は外した耳を数えない。
- **speakerId の出口**
  - 正本 `transcript-buffer.mjs` にだけある。
  - 放送と snapshot は `toWireEntry`(`cockpit-server.mjs:1444`)で拾わない。
  - ①②④・判定の整形(`fire-injection`・`memory`・`recall`・`speak-now`)は読まない。
  - ログは数と状態だけ。UI(`ui/`・`view-logic/`)にも出てこない。
  - 正本を JSON にしてファイルや外へ出す所は無い。

### 5. 鍵の扱い — 問題なし

- **鍵を読む道**: 鍵を読むのは `src/discord/discord-token.mjs` の `loadDiscordBotToken` だけ(入口の `prepareEntrance` と一覧の `catalog` は `readToken` を通る)。受信の試し `scripts/probe-discord-receive.mjs` も同じモジュールの `readDiscordBotTokenFile` を使う。
- **process.env**: 差分の追加行に、`process.env` への代入も `--env-file` も無い。
- **エラーの文面**: 理由の文面に入るのはファイル名だけ(検証済みの名前)。Discord の入口が出す理由は `DISCORD_REASONS` の決まった文だけ。想定外の例外の文面も、Discord では生のエラー文を入れない。
- **形の合わない鍵のファイル名**
  - 入口: `prepareEntrance` が鍵を読む前に断る(E)。
  - 一覧の読み込み: `catalog` が鍵を読まずに断る(G)。
  - 書き戻し: 元の値をそのまま残す(G・`role-store.mjs` の列挙されない symbol)。snapshot・理由の文面には出ない。
  - main の結線は、`discordBotKeyFileRefused` と `currentKeyFileRefused` の両方を渡している(`scripts/cockpit.mjs:3264`・`:3275`)。
- `.env*.local` と `cockpit-settings.local.json` は gitignore 済み(`apps/soul/agent/.gitignore:50`・`:30`)。どちらも git の管理に入っていない。

### 6. ログ・声・ID — 問題なし

- **ターミナル**: `[cockpit] discord:` の行は決まった文と数だけ(`logging in` / `joined` / `speaker ear started (speakers N)` / `speaker left (speakers N)` / `connection <状態>` / `left (utterances…)` / `could not join (<決まった理由>)` / `catalog loaded (guilds N, channels M)` / `outlet ready` など)。サーバー名・チャンネル名は API の応答(画面の select)にだけ出る。
- **画面のログ**: 再生器の診断は marker だけ。
- **声**: 差分の実装の追加行に `writeFile`・`createWriteStream`・`appendFile` は無い(テストの一時フォルダだけ)。
- **ID**: 差分の追加行(discussion を含む全部)に 15 桁以上の数字は無い。

### 7. 配信の文字列 — 問題なし

- **固定テストと fixture**
  - `src/mind/stream-wording-pin.test.mjs` と fixture 3 本は、作った Domain A のコミット `cad2083a` から HEAD まで差分 0。
  - master(`6327a42b`)の `src`・`skills` を一時フォルダに取り出し、HEAD の固定テストと fixture を置いて走らせると 36/36 が通る。master の出力と一字も違わない。
- **期待値を変えた既存テスト**: `git diff` で全部洗い出し、各報告の一覧と照らした。過不足なく一致した。
  - master にあった既存テスト
    - `memory.test.mjs:58`(題名、F)・`:67`(期待値、C、追認 A-(1))
    - `cockpit-server.test.mjs:1919`(`venue not open`、G)
    - `ghost.test.mjs:46`(G)
    - `cockpit-ui.test.mjs`(タブ 6、G)
    - 偽の耳の直し 7 か所(A、期待値は不変)
  - このブランチで足したテストを、あとのドメインで変えたもの
    - `scripts/cockpit-discord-d.test.mjs:75-77`(F)・`:139`(G)
    - `cockpit-server-discord-c.test.mjs:207`・`:214`(F)
    - `role-store-discord-e.test.mjs`(G、追認 E-(4))
    - `cockpit-server-discord-d.test.mjs:207-208`・`scripts/cockpit-discord-e.test.mjs:159-160`(G、下準備)
  - 一覧に無い変更は無い。

### 8. 機械ゲート — pass

| ゲート | 結果 |
|---|---|
| `apps/soul/agent` で `node --test` | **2173 / 2173 pass**(fail 0・skip 0、約 92 秒) |
| リポジトリの根で `pnpm run check:soul-zone` | **pass**(1610 ファイル) |
| 依存・lockfile | 差分 0(`apps/soul/agent` と `discussion` の外の差分は無い。`package.json`・`pnpm-lock.yaml` も変わっていない) |
| 作業ツリー | `git status` はきれい(この突き合わせで書いたのはこの `final.md` だけ) |

## 6. 人間ゲート 2 の手順に入れるとよい確かめ(案)

各ドメインの「人間ゲート 2 で見る所」(D 12・E 11・F 7・G 11)を、重複を除いてユーザーが試す順に並べ直した。`[D3]` などは出どころの報告と番号。★は私が足した物。

**0. 下準備**

- `apps/soul/agent/.env.discord.local` をユーザーが置く。ロールの `discordBotKeyFile` は書かない(既定)。
- 試しのサーバーで、ユーザーが先に VC に入っておく。声の方式は、まず手元で慣れた方にする。

**1. Discord の準備(場が閉じている)**

1. 準備・設定 → 「Discord の準備」タブ → 「読み込む」。サーバーとボイスチャンネルの名前が並ぶか。ステージや権限の無いチャンネルが出ないか。[G1・D10]
2. サーバー・チャンネル・見る窓・文字起こしを選ぶ。選ぶとその場で保存されるか。

**2. VC に入る**

3. メイン画面の「Discord の VC に入る」。「VC に入っています…」から上の帯の「VC に入っている」へ移るか。チャッピーがメンバーに現れるか。[G2]
4. ターミナルの `[cockpit] discord:` の行に、名前・id・本文が出ていないか(以降もずっと見る)。[D12・E11]

**3. 話す・聞く**

5. 話しかける。返事が VC から聞こえ、手元のスピーカーからは出ないか。手元の再生器(PowerShell)が新しく起きていないか。[E1・E8・D11]
6. 声の速さ・高さ・音量・「話している」表示。AivisSpeech と ElevenLabs の両方で(44.1k / 24k → 48k の音質)。声が詰まらないか(opusscript の重さ)。[E1・E2・E9]
7. 文字起こしの質(16kHz 直のデコード)。会話の行のあなたの名前が Discord の名前で出るか(取れなければ「参加者」)。[D1・D8・G3]
8. 区切りと返事までの遅れ(`AfterSilence` 500ms・無音 800ms)。入った直後の最初の発話の頭が欠けないか。ほぼ無音・咳・短い声が拾われないか(ElevenLabs では 400ms 未満も転写に回りうる)。[D2・D3・D4・D7]

**4. 判定・言葉**

9. 話しかけたら返すか。名前で呼んだら返すか。沈黙が続いてもチャッピーから話し出さないこと(設計どおり)が物足りないか。自発のつまみを OFF にすると判定でも話さなくなるか。[F3・F4]
10. 下の帯とロールのタブで、話し始めが「speak-now(固定)」になって選べないか。断りの文面の見え方。[F7・G5]
11. 「今どこにいる?」などで、通話にいると分かっているか(性格の指示の「配信の相方」に勝つか・視聴者に呼びかけないか)。会話指示の編集画面に体験の教えが出る見え方。[F5・G11]
12. 「思い出して」の返り(「過去の配信や通話の記録から…」)と、「避けるか」の効き。[F6]
13. 見る窓を選んだときと「使わない」のときの、発火の違い(画像なしの返事)。[G4]

**5. 止める**

14. 話している途中に割り込むと止まるか。止まる速さ(余韻 100ms)と言い直しの重なり(遅れ 100ms で足りるか)。割り込み直後に次の発話が始まるときの重なり。[E5]
15. 黙らせる(KILL)で声が止まるか。[E6]

**6. 揺さぶる**

16. ★ VC を抜けて入り直し、すぐ話す。耳が起き直して聞こえるか(とくに whisper。§4 の 1)。全員が抜けても Bot が残るか。[D9 + ★]
17. 接続が切れたときの「VC から切れた(つなぎ直しを待っている)」の表示と、戻ったときの「VC に入っている」。つなぎ直しの途中に話し始めたときの打ち切り。ElevenLabs の途切れで `player_end_timeout` / `speech.playback.completion_timeout` が出ないか。[G2・D9・E3・E4]
18. (仲間がいれば任意)2 人以上の話者の分かれ方。whisper の 2 人目の口(8179)が起きるか、メモリは足りるか。ElevenLabs の人ごとの接続。[D5・D6・D7]

**7. 抜ける・記憶**

19. 「VC から抜ける」を 2 回押す。「VC から抜けています…」「記録中…」から、最初の画面へ戻るか。[G10]
20. チャッピーの記憶のフォルダに、通話の本体が「通話」の記録として書かれ、`_conventions.md` の決まりに沿っているか。同じ日に配信があったなら、`<日付>-2.md` など別のファイルになっているか。[F1・F2]

**8. そのあと配信**

21. 配信を始める。手元のスピーカーから今までどおり鳴るか。配信の画面が元に戻るか(タブの並びとボタン以外は今まで通り)。通話のことを思い出せるか(任意)。[E7・G6・計画 §6]
22. ★ 隙間 3 の直しの確かめ(コメントを用意できれば。人間ゲート 1 で飛ばした「YouTube のコメントへの反応」もここでまとめて見る)
    - 場が閉じている間に YouTube を Connect してから VC に入り、コメントが Discord の会話の行・記録に入らないか。
    - 抜けたあと配信を始めると、同じ Connect のまま、コメントが今まで通り入って反応するか。[G10 の質問 1 + 人間ゲート 1 の持ち越し]

**9. 断りの確かめ(最後に。role.json を手で直すので)**

23. `role.json` に形の合わない `discordBotKeyFile`(例 `../x`)を書く。「読み込む」も「VC に入る」も、鍵を読まずに断りの文面が出るか。ロールのタブで別の項目を編集したあとも、`role.json` に手で書いた値が残るか。終わったら元に戻す。[G8・G9・E10]
24. 狭い画面幅での崩れ。[G7]

## 7. 質問(Undine へ)

1. **捨てるときの診断**: §3 の直しで、Discord の場で捨てたコメントについて何も出さない(推奨)か、名前・本文の無い 1 回きりの診断を出すか。製品の判断ではないので、Gnome の裁量に任せてよいか。
2. **守りの 2 層目**: `commitComment` の 1 行(§3 の 2)を入れるか(推奨は入れる。今の作りでは届かないので、テストは 1 の入口の分だけで足りる)。
3. **人間ゲート 2 の ★ 16**(入り直してすぐ話す): 手順に入れるか。最初の的は 1 人なので、抜けて入り直すのはまれな操作だが、起きたときは「その場の間は聞かれない」と症状が重い。

## 8. 一時フォルダ

- 試しは、セッションの scratchpad の下に作った `repro/`(隙間 3 の再現・場の行き来・開く途中の失敗と Ctrl+C)と `pin-master/`(master の取り出しで固定テスト)だけで行い、両方とも消した。
- `apps/soul/agent/tmp/` には何も置いていない。実データ・鍵・本物の Discord / LLM / 外部 API には触れていない。
