# Domain D — Discord の入口 Gnome 報告(2026-11-01)

> Gnome(実装)→ Orch-Sylph。計画 [../../orchestration/discord-mode-wave-plan.md](../../orchestration/discord-mode-wave-plan.md) §1 Domain D、設計 [../../../architecture/discord-mode.md](../../../architecture/discord-mode.md) §4.3(実物の順)・§5・§6・§9・§10。
> ブランチ `ai-cohost/discord-mode`(HEAD `805dcfc1`)のまま。コミットしていない。鍵(`.env*.local`)は読んでいない・中身を確かめるコマンドも走らせていない。実データ(`cockpit-settings.local.json`・`memories/`・`roles/`)に触れていない。操縦席は起動していない。本物の Bot はログインさせていない。依存・lockfile は変えていない。`apps/soul/agent/tmp/` は元からの 2 つ(`discord-receive`・`restructure-backups`)だけ。

## 1. 変更ファイル(`apps/soul/agent/` 起点)

新規(実装 4):
- `src/discord/discord-token.mjs` — 鍵の読み方(試しの `loadDiscordBotToken` を移した)。
- `src/discord/discord-libraries.mjs` — discord.js / @discordjs/voice / opusscript を**動的 import** する唯一の口。
- `src/discord/discord-audio.mjs` — 3 バイトの無音フレームの判定・16kHz モノラルのデコーダ・耳の音の入口(`captureFactory` 互換)・無音。
- `src/discord/discord-experience.mjs` — Discord の体験の口(`createDiscordExperience`)。

新規(テスト・偽物 6):
- `src/test-support/fake-discord.mjs` — 偽の Discord。
- `src/discord/discord-token-discord-d.test.mjs`(8)・`src/roles/role-store-discord-d.test.mjs`(4)・`src/cockpit/cockpit-settings-store-discord-d.test.mjs`(3)・`src/cockpit/cockpit-server-discord-d.test.mjs`(17)・`scripts/cockpit-discord-d.test.mjs`(7)。

変更(5):
- `src/cockpit/cockpit-server.mjs` — 体験の口の約束を足す(場の口 control・人ごとの耳の口・接続の状態・想定外の文面・準備と一覧の API・snapshot)。耳の組み立てを配信の入口から出して共有。
- `src/cockpit/cockpit-settings-store.mjs` — `getDiscordPrep` / `setDiscordPrep`。
- `src/roles/role-store.mjs` — `discordBotKeyFile` と `roleDiscordBotKeyFile`。
- `scripts/cockpit.mjs` — `createDiscordVenueExperience`(export)・ロールの束に鍵のファイル名の口・`main()` の結線。
- `scripts/probe-discord-receive.mjs` — 鍵の読み方を移した物を import(期待値は変えていない)。

## 2. テスト結果

| ゲート | 結果 |
|---|---|
| `apps/soul/agent` で `node --test` | **2050 / 2050 pass**(2011 → +39: 鍵と音 8・ロール 4・設定 3・サーバ 17・cockpit.mjs 7) |
| 根で `pnpm run check:soul-zone` | pass(1590 files) |
| 固定テスト `src/mind/stream-wording-pin.test.mjs` | pass。`src/mind/`・`skills/`・fixture の差分 0 |
| 本物の Discord・LLM・外部 API | 呼ばない(偽の Discord・偽の耳 / VAD / whisper-server / 転写。opusscript だけ本物) |

## 3. 期待値を変えた既存テスト

- **0 件**。既存のテストファイルは 1 つも触っていない(`git status` で新規 6 本のほかは実装 5 本だけ)。
- 期待値を変えない直しも **0 件**。試しのスクリプトは中身を移しただけで、`probe-discord-receive.test.mjs` は手を入れずに 23/23 通る(理由の文面も同じ)。

## 4. 鍵の読み方とロールの指し先

- `src/discord/discord-token.mjs`
  - `loadDiscordBotToken({ fileName = ".env.discord.local", dir = apps/soul/agent, readFileImpl })` → `{ ok:true, token } | { ok:false, reason }`。ファイルをコードの中で読み、`process.env` に入れない。
  - `isDiscordBotKeyFileName(value)`: 文字列・1〜64 字・`/` `\` `:` を含まない・`..` を含まない・`/^\.env\.discord[A-Za-z0-9._-]*\.local$/`。合わなければ**読みに行かずに**断る(`DISCORD_KEY_FILE_NAME_REFUSED`、値は理由に入れない)。
  - `readDiscordBotTokenFile({ path, label, readFileImpl })`: パス指定の読み(試しのスクリプトが使う)。理由は「Discord の鍵のファイルが読めない(…)」「…読めない形になっている(…)」「Discord の鍵が見つからない(… の DISCORD_BOT_TOKEN)」。括弧の中はファイル名だけ。
  - 変数名 `DISCORD_BOT_TOKEN_NAME = "DISCORD_BOT_TOKEN"`、既定 `DEFAULT_DISCORD_BOT_KEY_FILE = ".env.discord.local"`、置き場 `DISCORD_BOT_KEY_DIR`(`apps/soul/agent/`)。
- `src/roles/role-store.mjs`
  - `normalizeRole`: `role.json` の `discordBotKeyFile` が上の規則に合うときだけ**項目を持つ**(無い・合わないときは項目ごと持たない)。今のロールの形は変わらないので、既存の deepEqual は通る。
  - `roleToJson`・`writeRole` の書き戻し・`applyRolePatch`(画面の編集)・`copyRoleAs` で落とさない。
  - `roleDiscordBotKeyFile(role)` → 指していれば その名前、無ければ `.env.discord.local`。
  - 画面での編集は作っていない(`applyRolePatch` は `discordBotKeyFile` を受け付けない=今のまま)。
- ロールの束(`scripts/cockpit.mjs` の `createVenueRoleBundle`)に `discordBotKeyFile()` の口を足した(渡さなければ null)。`main()` は `() => roleDiscordBotKeyFile(roleHooks.current())`。

## 5. 接続・一覧・入る / 抜けるの API の形

| 道 | body | 応答 |
|---|---|---|
| `POST /api/stream/start`(と別名 `/api/ears/start`) | `{ experience: "discord" }`(Discord の中身は保存した準備から読む。body の `sttEngine` は配信のものなので Discord では読まない) | 200 = snapshot / 500 `{ error, state }`(入れない理由)/ 503(Discord の入口が無い) |
| `POST /api/stream/stop`(と `/api/ears/stop`) | なし | 200 = snapshot(VC を抜けてログアウト済み) |
| `GET /api/discord/prep` | — | 200 `{ prep: { guildId, channelId, sttEngine } }`(どれも string \| null)/ 503 `{ error }` |
| `POST /api/discord/prep` | `{ guildId?, channelId?, sttEngine? }`(null / "" で消す。サーバーを替えてチャンネルを渡さなければチャンネルも消す) | 200 `{ prep }` / 400 `{ error }`(形が違う)/ 409 `{ error }`(Discord の場が開きかけ・開いている・閉じかけ)/ 503 |
| `POST /api/discord/catalog` | なし | 200 `{ guilds: [{ id, name, channels: [{ id, name }] }] }`(声のチャンネルだけ・並び順)/ 502 `{ error }`(決まった文面)/ 409(Discord の場の間)/ 503 |

- 一覧: 今のロールの鍵でログイン → `client.guilds.fetch()` → 各サーバーの `channels.fetch()` → ログアウト(`client.destroy()`)。同時に 2 回呼ばれてもログインは 1 回(読み込み中の結果を待つ)。VC には入らない。
- 入る: `openEntrance` でログイン(Intent は `Guilds` と `GuildVoiceStates` だけ)→ サーバー → ボイスチャンネル(`GuildVoice` だけ・ステージは外す)→ `joinVoiceChannel({ channelId, guildId, adapterCreator, selfDeaf:false, selfMute:false, group: <ロールの id> })` → `entersState(Ready)`。
- 抜ける: 場を閉じる(操作者の操作)と `closeEntrance` で `connection.destroy()` と `client.destroy()`。全員が抜けても・接続が切れても Bot は自分では抜けない。

## 6. 人ごとの耳と束の形

- `receiver.speaking` の start → その人の購読が無ければ `receiver.subscribe(userId, { end: { behavior: AfterSilence, duration: 500 } })`。
- 人ごとに Opus のデコーダ 1 つ(`new OpusScript(16000, 1, AUDIO)`・直に 16kHz モノラル)と耳 1 本。耳は**最初に話し始めたときに**作る。
- 耳の作り方: 場の口 `venue.createEar(spec)`(サーバの `buildEarPipeline`)。配信のマイクの耳と同じ組み立て(whisper / ElevenLabs / ローカルの選び分け・whisper の名前の手がかり・ElevenLabs の状態を stt の死活へ)を二重に書かない。Discord の耳だけが足すもの:
  - `captureFactory`(ffmpeg の代わりに人ごとの音を流す口)
  - 区切りの上書き `segmenter.minSpeechMs = 400`
  - whisper-server の口の番号のずらし(2 人目から +1, +2…)
- 束: `venue.createEars()` の束に key `discord-<n>`(場の中の通し番号。束の名前に Discord の id を入れない)で `add`。VAD は `ears.vadMouth(key)`(サーバの `buildEarPipeline` が渡す)。耳ごとの口は `makeEarTranscriptMouth(engine)`。
- 話者の載せ方: **積む口を包む**(`speakerTranscriptMouth(buffer, person)`)。耳が積む行に `speaker: "you"`・`displayName: <Discord の名前>`(取れていれば)・`speakerId: <ユーザー id>` を足して場の正本に積む。名前は `guild.members.fetch(userId).displayName` を 1 人 1 回だけ取る。取れなければ名前なしの you。`ear-pipeline.mjs` は変えていない。
- 耳が起きるまで(whisper のモデル読み込み・ElevenLabs の接続)の音は音の入口が溜める(上限 10 秒・古い方から捨てる)。
- 人が VC から抜けたら(`voiceStateUpdate`)購読・デコーダを畳み、耳を束から `drop`。正本は続く。戻って話せば新しい耳。
- 人の耳が起きなかったら、その人はこの場の間は聞かない(束から外す・`stt` は down・理由は決まった文面)。場は閉じない。

## 7. ほぼ無音の発言の除き方の 3 段(設計 §6.4)

1. 3 バイトの無音フレーム `F8 FF FE` をデコードの前に捨てる: `src/discord/discord-experience.mjs` の `handleSpeakingStart` の `data`(`isOpusSilenceFrame`、`src/discord/discord-audio.mjs`)。
2. 耳の Silero VAD に任せる: `ear-pipeline.mjs`(変更なし。人ごとに VAD のセッションが別)。
3. 短すぎる発話を捨てる: Discord の耳だけ区切りの `minSpeechMs = 400`(`DISCORD_MIN_SPEECH_MS`。`createVenueEar` → `buildEarPipeline` の `segmenter`)。本物の耳 + 本物の opusscript のテストで、200ms は転写に回らないことを確かめた。
- 購読の終わり(黙った)で 800ms の無音(`DISCORD_TAIL_SILENCE_MS`)を足す: 同じ `handleSpeakingStart` の `close`。本物の耳のテストで「足すと区切りが閉じて 1 行」「足さないと閉じない」の両方を確かめた。
- 頭欠けは受け入れる(印は付けない)。

## 8. Discord の準備の保存の形

- 設定のキー(`cockpit-settings.local.json`・配信の `sttEngine` とは別): `discordGuildId`・`discordChannelId`・`discordSttEngine`。
- `createFileSettingsStore` に `getDiscordPrep()` → `{ guildId, channelId, sttEngine }`(各 string \| null・`asStringOrNull`)と `setDiscordPrep(patch)`(渡したキーだけ書く・null で消す・read-modify-write)。
- 形の確かめは Discord の口(`normalizeDiscordPrep`・`checkDiscordPrepPatch`): id は `/^[A-Za-z0-9_-]{1,64}$/`、方式は `STT_ENGINES`(whisper / elevenlabs / parakeet / zipformer)。
- 文字起こしの方式を選んでいなければ既定 `whisper`(`DEFAULT_DISCORD_STT_ENGINE`)。選んだ値が知らない方式なら断る(黙って既定に替えない)。
- API は §5。
- 見る窓(目)の Discord ごとの選択は作っていない(今の目の扱いのまま)。

## 9. 入れない・切れたの扱い

場を開かずに `{ ok:false, reason }` → 500 `{ error }`・`stream.error` に同じ文面。どれも VC に入る前の段で止まったときは、入口が自分で畳む(ログアウト・接続の破棄・耳の束)。理由の文面(`DISCORD_REASONS`):

| 場面 | 段 | 文面 |
|---|---|---|
| ロールが無い | 下見 | VC に入れるロールが無い |
| 準備が無い | 下見 | Discord の準備でサーバーとボイスチャンネルを選んでいない |
| 方式が使えない | 下見 | Discord の準備の文字起こしの方式が使えない |
| 鍵が無い | 下見 | `discord-token.mjs` の文面(ファイル名だけを含む) |
| ElevenLabs のキー切れ・ローカルのモデルの欠け | 下見 | 配信と同じ文面(`checkEarEngine`) |
| 場の口が無い | 下見 / 開く | Discord の入口を開けない(場の口が無い) |
| 部品が無い | 開く | Discord の部品を読み込めない(apps/soul/agent で依存を入れる) |
| ログインできない・時間切れ | 開く | Discord にログインできない(鍵が正しいか・ネットにつながるか) |
| サーバーが無い | 開く | 選んだサーバーが見つからない(Bot がそのサーバーに入っているか) |
| チャンネルが無い・声のチャンネルでない | 開く | 選んだボイスチャンネルが見つからない |
| VC に入れない | 開く | VC に入れない(時間切れ・権限・満員など) |
| 開く途中で場を閉じた | 開く | VC に入る途中で場を閉じた |
| 一覧が読めない | 一覧 | サーバーとボイスチャンネルの一覧を読めない |
| 人の耳が起きない | 場の間 | Discord の人の耳を起こせない(文字起こしの部品が起きない) |
| 想定外の例外(開く / 閉じる) | 場 | Discord の VC に入れない(想定外のエラー)/ Discord の VC から抜ける途中で想定外のエラー |

- 途中で切れた(接続の状態が Ready 以外へ): 場は閉じない。`stream.connection = "disconnected"`、ライブラリのつなぎ直しに任せ、Ready に戻れば `"joined"`。Destroyed(外から壊された)も `"disconnected"` のまま。

## 10. B の持ち越し 5 つの扱い

1. **`openEntrance` が失敗したとき**: 入口が自分で畳む。購読・デコーダ・`createEars()` の束・接続・ログインの全部を畳む。場は今のまま `closeEntrance` を呼ばない(B の約束どおり)。JSDoc に明記した。入口が開いたあとの段(頭のセッションなど)で止まったときは、場が `closeEntrance` を呼び、入口がそこで畳む。どちらもテストで固定した。
2. **`closeEntrance` の冪等**: 開いていなくても・二重でも投げず、もう一度は畳まない。開く途中にサーバを閉じたときも、入口はログインせずに止まる。
3. **`voiceKind`**: Discord の口は返さない(共有の `ttsEngine` = ロールの声の方式)。D では共有のまま。声の出口は E。
4. **Discord の耳の状態と接続の状態**: §14 のとおり。
5. **想定外の例外の文面**: 配信は今の文面のまま(`配信を始められない(想定外のエラー: …)`・`配信を終える途中で想定外のエラー(…)`)。外から渡された体験は口の `unexpectedErrorMessage(phase)` の文面。Discord は生のエラー文を入れない(上の表)。口が文面を持たないときは中立の `場を開けない(想定外のエラー: …)` / `場を閉じる途中で想定外のエラー(…)`。

## 11. 守りの決まりの確かめ方

| 決まり | 確かめたテスト |
|---|---|
| 鍵を読む・伏せる | `discord-token-discord-d`: 一時フォルダの偽ファイルで読める。合わない名前は読みに行かない。理由に値が出ない |
| `process.env` を変えない | `discord-token-discord-d`: 前後の `process.env` が同じ |
| 鍵がロールにも設定にも入らない | `role-store-discord-d`: role.json の鍵らしい値を読まない・書かない。`cockpit-server-discord-d`(最初のテスト)・`cockpit-discord-d`: 開いたあとの設定ファイルと放送に鍵が無い |
| ID をソース・テストに書かない | テストの id は `guild-fake-1`・`user-fake-a` など明らかな偽物だけ |
| ログに本文・名前・Discord の id・鍵が出ない | `cockpit-server-discord-d`: Discord のログの口・遅延のログ(`onSttLatency`)・画面のログ(SSE の `diagnostic`)を集め、名前・ユーザー id・サーバー / チャンネルの id・鍵・本文が無いこと。入れないときの理由とログ、耳が起きないときのログも同じ。`cockpit-discord-d`: `[cockpit] discord:` の行 |
| 放送に speakerId が出ない | `cockpit-server-discord-d`: SSE の全部に Discord の id が無い。transcript の行は名前つき・`speakerId` なし |
| 声を保存しない | 音は耳までのメモリの中だけ(ファイルに書く所が無い) |
| discord.js を配信の起動の import の木に入れない | `cockpit-discord-d`: (静的)`scripts/cockpit.mjs` から辿れる静的 import に discord.js / @discordjs/* / opusscript / prism-media / @snazzah/davey が無い。(ソース全体)これらを読み込むのは `src/discord/discord-libraries.mjs` と試しのスクリプトの動的 import だけ。(実行時)子プロセスで解決の hook を掛け、操縦席のモジュールを読み込み Discord の口を作って準備を読んでも解決が 0 件(対照あり) |
| 実データに触れない | 設定・ロールは OS の一時フォルダだけ(終わったら消す) |

- 今ある共有のログ(耳の遅延・speak-now・思い出し・返事の遅延・撮影)は、`scripts/cockpit.mjs` の書き方を読んだ限り、方式・数字・状態だけで本文を出していない。Discord の場でも名前・id は渡らない。耳の診断(`asrFailure` など)の `message` は whisper などの文面で、話者を含まない。

## 12. 偽の Discord の形(`src/test-support/fake-discord.mjs`)

- `createFakeDiscord({ guilds, botUserId, loginFails, neverReady, joinFails, catalogFails, OpusScript })` → `{ libraries: { discord, voice, OpusScript }, loadLibraries, record, connection(), client(), speak(userId), send(userId, packet), endSpeech(userId), voiceState({ userId, guildId, from, to }), setConnectionStatus(status) }`。
- `discord`: `Client`(EventEmitter。`login` / `guilds.fetch(id?)` / `destroy`。作られたときの options を持つ)・`Events`・`GatewayIntentBits`・`ChannelType`。`loginFails` の投げる文面には鍵が入るので、理由に出ないことを確かめられる。
- `voice`: `joinVoiceChannel`(偽の接続 = EventEmitter・`receiver.speaking` も EventEmitter・`receiver.subscribe` は objectMode の PassThrough)・`entersState`・`VoiceConnectionStatus`・`EndBehaviorType`。
- `OpusScript`: 既定は `FakeOpusScript`(20ms・16kHz・モノラルの PCM を返す)。本物の opusscript も渡せる(本物の耳のテストで使用)。
- `record`: `clients`・`logins`・`destroyedClients`・`joins`(config)・`connections`(`destroyCount`)・`subscribes`・`memberFetches`・`loadCount`。

## 13. E が出口を差す置き場

- `createDiscordExperience({ outletFactory })`(cockpit.mjs からは `createDiscordVenueExperience({ options: { outletFactory } })`)。VC に入って Ready になった直後に `outletFactory({ connection, voice, groupId })` を呼び、返り値の `dispose()` を閉じるときに呼ぶ。
- 口の `voiceConnection()`: VC に入っていれば今の `VoiceConnection`、無ければ null。cockpit.mjs は口の生のオブジェクト(`discordExperience`)を持っているので、ロールの束の `voice.startResources`(場の段の「再生器」)から引ける。
- 場の段の順は「入口を開く(VC Ready)→ 再生器」なので、再生器を作る時点で接続はある。
- **D の間の声**: Discord の場でも、ロールの束の `voice.startResources` が今の手元の再生器(流し込みプレイヤー)を起こす。チャッピーの声は VC ではなく操縦席の PC のスピーカーから出る。

## 14. G が使う snapshot の項目名と値

- `stream.experience`: `"discord"`(開きかけ・開いている・閉じかけ)/ `"stream"` / null(閉じている)。
- `stream.connection`(新しい項目・`VENUE_CONNECTION_STATES`):
  - `"joining"` = VC に入っている途中(下見のあとログイン〜Ready まで)
  - `"joined"` = 入っている
  - `"disconnected"` = 途中で切れた(場は開いたまま・つながり直せば `"joined"`)
  - `null` = 配信の場・閉じている・入れなかった
- `stream.phase` / `stream.error`: 今のまま。入れない理由は `stream.error`(§9 の文面)。
- `discord`(新しい項目): `{ available: true }`(Discord の入口が渡されている)/ `null`。準備の中身(id)は snapshot に載せない。`GET /api/discord/prep` で読む。
- `ears`: `"starting"`(下見で文字起こしを確かめてから VC に入るまで)→ `"listening"`(VC に入った)→ `"stopped"`。
- `stt`: `{ engine: <Discord の準備の方式(Discord の場の間)>, status, reason }`。status は入った時点で `"up"`。ElevenLabs は耳ごとの接続の状態、人の耳が起きなければ `"down"`(理由 = §9)。閉じたら配信の選択に戻る。
- `health.whisper.status`: whisper の人の耳が起きたら `"up"`・落ちたら `"down"`。`health.ffmpeg.status`: Discord の場では `"unknown"`(マイクが無い)。
- `uptimeMs`: VC に入ってからの時間。
- `transcripts` と SSE `transcript`: you の行に Discord の名前(`displayName`)。`speakerId` は載らない。

## 15. 裁量(設計に無いが決めたこと)

1. 鍵のファイル名が合わない `role.json` の値は、`normalizeRole` の流儀(1 項目の書き損じはその項目だけ既定)に合わせて項目ごと捨てる(= 既定 `.env.discord.local` で読む)。→ 質問 2。
2. 文字起こしの方式を選んでいなければ `whisper`(配信の既定と同じ)。知らない値が保存されていれば断る。
3. 耳の組み立てを共有するため、サーバに `buildEarPipeline`(配信の入口から出した)・`beginEarsStarting` / `checkEarEngine`(配信の下見から出した)を作った。配信の耳に渡る options の形・下見の順と放送は今のまま(既存テストで確認)。
4. 外から渡された体験への場の口は 2 つ目の引数 `control` で渡す。耳の状態を替える口(`prepareEars` / `stopEars` / `earsListening` / `earStarted` / `earFailed` / `changed`)と `createEar`。B の約束の `info` の形は変えていない(B のテストが JSON で固定)。
5. Discord の場の間だけの文字起こしの方式は `venueSttEngine` に持ち、`activeSttEngine()` で snapshot・警告・whisper の死の扱い・返事の遅延の `stt` に使う。配信の場では常に null なので今の値と同じ。場を閉じたら手放す。
6. 下見で文字起こしのキー / モデルが無くて断ったとき、Discord は耳の状態を Stopped・`stt` unknown に戻す(配信の文字起こしの警告として残さない)。理由は `stream.error` に出る。配信は今のまま down を残す。
7. 耳は最初に話し始めたときに作る(入室時には作らない)。最初の発話は、耳が起きるまで音の入口が溜める(上限 10 秒)。
8. 人の耳が起きなかったら、その場の間はその人を聞かない(作り直しの嵐を避ける)。抜けて入り直せば作り直す。
9. whisper の人ごとの耳は、whisper-server の口の番号を空いている席の番号だけずらす(既定 8178 → 2 人目 8179)。同じ口の取り合いを避ける。
10. AfterSilence は 500ms(試しは 1000ms)、購読の終わりの無音は 800ms(耳の区切り 400ms + VAD の数フレーム)。返事の遅れを短くする向き。→ 人間ゲート 2。
11. 短すぎる発話の 3 段目は耳の区切りの `minSpeechMs = 400`。Discord の側で最初の 400ms を溜める関所は作らなかった(割り込みと区切りが最大 400ms 遅れるため)。→ 質問 1。
12. ボイスチャンネルは `GuildVoice` だけ(ステージは外す)。一覧も入るときも同じ。
13. 準備の書き換えと一覧の読み込みは、Discord の場の間(開きかけ・開いている・閉じかけ)だけ 409 で断る。配信の場の間はしてよい。
14. 一覧の読み込みは同時に 1 回(読み込み中なら同じ結果を待つ)。
15. 束の key は `discord-<通し番号>`(id を入れない)。
16. 鍵は `plan` でログインに 1 回渡すだけ。開いている間の入口の記録には写さない。
17. snapshot の `discord: { available: true } | null`(G がボタンを出すかの材料)。準備の id は snapshot に載せず、API で読む。
18. 試しのスクリプトの鍵の読み方は、移した `readDiscordBotTokenFile` を呼ぶ薄い口にした。`DISCORD_BOT_TOKEN_NAME` は移した物を再 export。

## 16. 質問

1. **ElevenLabs の Discord の耳では、短すぎる発話(400ms 未満)が転写に回りうる**。ElevenLabs は耳の区切りと別に自分の区切りで commit するため、`minSpeechMs` は VAD の出来事(割り込み・予定)にしか効かない(配信の耳と同じ性質。設計 §6.4 の注と同じ穴)。Discord の側に「購読ごとに最初の 400ms を溜め、届かなければ捨てる」関所を足すか。足すと、どの方式でも話し始め(VAD・割り込み)が最大 400ms 遅れる。今は足していない。人間ゲート 2 で咳などが拾われるかを見てから決める案を推す。
2. **`role.json` の `discordBotKeyFile` が合わない値のとき**、今は既定 `.env.discord.local` で読む(裁量 1)。2 つ目のロール(2 つ目の Bot)を手で書き損じると、黙って 1 つ目の Bot でログインすることになる。「指しているのに合わない」ときは入口で断る方がよいか(最初の的は 1 ロールなので急がない)。

## 17. 人間ゲート 2 で見る所(偽物で確かめきれない所)

1. opusscript の直の 16kHz モノラルのデコードの、実際の声の音質(文字起こしの精度)。
2. Silero VAD が、ほぼ無音の発言(RMS 0.0002〜0.002)を弾くか(ログの `left (utterances …)` と転写の行の数を見比べる)。
3. 購読の終わり(AfterSilence 500ms)+ 無音 800ms で、本物の Silero の区切りが閉じるか。返事までの遅れが気にならないか。
4. 話し始めの頭が欠けないか(耳が起きるまで溜める・最初の発話。whisper のモデル読み込み・ElevenLabs の接続の間)。
5. 2 人以上の分かれ方(試しの持ち越し・仲間を入れる区切り)。
6. whisper の人ごとの耳: 2 人目の whisper-server(口の番号 8179)が起きるか・メモリ。
7. ElevenLabs の人ごとの接続と課金、短すぎる発話が拾われるか(質問 1)。
8. 名前が取れるか(`members.fetch`)。行・画面の名前が Discord の名前になるか。
9. 接続が切れたときの表示(`stream.connection`)とつなぎ直し。全員が抜けても Bot が残るか。
10. 一覧の読み込み(本物の Bot・本物のサーバー・権限の無いチャンネル)。
11. 声は D の間は VC に出ない(手元のスピーカー)。E の出口が入るまでは、VC でチャッピーの声は聞こえない。
12. ログ(ターミナル)の `[cockpit] discord:` の行に名前・id が出ていないか、目で見る。

## 18. 持ち越し

- **E(出口)**:
  - 出口の置き場は `outletFactory({ connection, voice, groupId })` か口の `voiceConnection()`(§13)。
  - 再生器(ロールの束の `voice.startResources`)を体験で作り分ける。サーバの `venueContext().experience` で体験の種類が読める。
  - 声の方式は今は共有の `ttsEngine`(`voiceKind` を返さない)。Discord で替えるなら口の下見で `voiceKind` を返す。
  - 割り込みのきっかけは人ごとの耳の VAD。耳の束から場の VAD の口へ回っているので、そのまま `bargeInGate` に届く。
- **F(判定と言葉)**: Discord の口の `wording` / `teaching` / `judgeSet` は null(配信の言葉で動く)。`createDiscordExperience` の返り値に差す。speak-now の固定は F。
- **G(画面)**:
  - snapshot の項目は §14、API は §5。理由の文面は `DISCORD_REASONS`(§9)。断りの文面は `busyMessage`(「VC に入っている途中」「VC から抜けている途中」「VC に入っている」)。
  - 見る窓(目)の Discord ごとの選択は未実装(今は配信と同じ目の対象)。
  - `glance-timeline.mjs` の `STREAMER_LABEL` を体験で替える(行の `displayName` は放送に載っている)。
  - `chatBufferAbsent` の文面 `ears not running`(B からの持ち越しのまま)。
- **小さな点**:
  - `stream.connection` が `"disconnected"` の間、耳の状態(`ears`)は `"listening"` のまま(耳は場のもの・接続とは別に持つ)。
