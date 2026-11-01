# Domain D レビュー — Discord の入口(Review-Sylph 2026-11-01)

> 対象: ブランチ `ai-cohost/discord-mode`(HEAD `805dcfc1`、差分は未コミットのワークツリー)。Gnome 報告 [../../waves/discord-mode/domain-d-gnome.md](../../waves/discord-mode/domain-d-gnome.md)。
> 基準: 計画 [../../orchestration/discord-mode-wave-plan.md](../../orchestration/discord-mode-wave-plan.md) §1 Domain D・§4、設計 [../../../architecture/discord-mode.md](../../../architecture/discord-mode.md) §3.2・§4.3〜§4.5・§5・§6・§9・§10・§12.3、B の持ち越し [../../waves/discord-mode/domain-b-report.md](../../waves/discord-mode/domain-b-report.md) §12。
> 読み取り専任。ソース・テストは直していない。`.env*.local` は読んでいない・中身を確かめるコマンドも走らせていない。ブランチ操作・コミット・stash はしていない。

## 判定: **合格**(止める指摘 0)

ループ 1/1。止めない指摘(持ち越し)5、裁量の記録あり、質問 0。

## 1. 機械ゲート(自分で走らせた)

| ゲート | 結果 |
|---|---|
| `apps/soul/agent` で `node --test` | **2050 / 2050 pass**(fail 0・cancelled 0・skipped 0)。Gnome の数と一致 |
| 根で `pnpm run check:soul-zone` | pass(1590 files) |
| `src/mind/`・`skills/` の差分 | 0(`git diff --stat`) |
| 固定テスト `src/mind/stream-wording-pin.test.mjs` と fixture の差分 | 0(`git status` に出ない。上の全件に含まれて pass) |
| 既存テストファイルの差分 | 0(`M` は実装 5 本だけ: `cockpit-server.mjs`・`cockpit-settings-store.mjs`・`role-store.mjs`・`scripts/cockpit.mjs`・`scripts/probe-discord-receive.mjs`。新規テストは 5 本とも `??`) |
| 依存・lockfile | 差分 0(`package.json`・`pnpm-lock.yaml` とも `git diff --stat` が空) |
| `git status` の漏れ | 無し。Gnome の一覧と一致(`discussion/.../domain-d-gnome.md` 以外の新規は `src/discord/` 5 ファイル・`fake-discord.mjs`・テスト 4 本+`scripts/` 1 本) |
| `apps/soul/agent/tmp/` | 元からの `discord-receive`・`restructure-backups` の 2 つだけ |

## 2. 設計適合(計画 §1 Domain D の項目ごと)

| 項目 | 結果 | 根拠(実装の場所) |
|---|---|---|
| 鍵のモジュール | 適合 | `src/discord/discord-token.mjs`。ファイルを `readFileSync` + `parseEnv` で直に読み `process.env` に入れない。理由は固定文+ファイル名のみ(読み込みの生のエラー・parseEnv の例外は捨てる) |
| ロールの指し先 | 適合 | `role-store.mjs`: `discordBotKeyFile` は `.env.discord*.local` に合うときだけ項目を持つ(無ければ項目ごと持たない=今のロールの形は変わらない)。`roleToJson`・書き戻し・`applyRolePatch`・`copyRoleAs` で落とさない。`roleDiscordBotKeyFile` の既定 `.env.discord.local` |
| 画面での編集を作らない | 適合 | `applyRolePatch` の許可項目は無変更(差分に出ない)。`src/cockpit/ui/` も無変更 |
| ログインと一覧の部品と API | 適合 | `catalog()`(ログイン → `guilds.fetch()` → 各 `channels.fetch()` → `client.destroy()`・同時 2 回でもログイン 1 回)、`GET/POST /api/discord/prep`・`POST /api/discord/catalog`(503 / 409 / 502 の断り) |
| 入る / 抜けるは操作者だけ | 適合 | Bot 側から `connection.destroy()` を呼ぶのは `teardown`(開く失敗時と `closeEntrance`)だけ。`voiceStateUpdate` は耳を束から外すだけで、全員が抜けても Bot は抜けない(テスト 450) |
| `group` = ロールの id | 適合 | `joinVoiceChannel({ ..., group: plan.groupId })`。`groupId` は `role.id()`。テスト 290 で確認 |
| Intent | 適合 | `Guilds` と `GuildVoiceStates` だけ。テスト 290 が `Client` の options を確認 |
| 人ごとの 16kHz モノラルのデコードと人ごとの耳 | 適合 | `createOpusDecoder16k`(`new OpusScript(16000, 1, AUDIO)`)、人ごとに `createSpeakerAudioSource` + `venue.createEar`。本物の opusscript と本物の耳のテスト(916・951) |
| 束 | 適合 | `venue.createEars()` の束に `discord-<通し番号>` で `add`(Discord の id を束の名前に入れない)。人が抜ければ `drop`。VAD は `ears.vadMouth(key)` |
| 話者 you + 名前 + id | 適合 | `speakerTranscriptMouth` が積む口を包んで `speaker:"you"`・`displayName`・`speakerId` を載せる。`ear-pipeline.mjs` は無変更。名前は `guild.members.fetch` を 1 人 1 回 |
| 無音の除き方 3 段 | 適合 | 1: `isOpusSilenceFrame`(デコード前)、2: 耳の Silero VAD(無変更)、3: `segmenter.minSpeechMs = 400`(Discord の耳だけ)。購読の終わりに 800ms の無音を足す(足す・足さないの両方をテスト 916・951 で確認) |
| 方式は配信と別 | 適合 | 設定キー `discordGuildId`・`discordChannelId`・`discordSttEngine`。場の間だけ `venueSttEngine`(`activeSttEngine()`)。POST の body の `sttEngine` は Discord では読まない |
| 入れなければ場を開かず理由 | 適合 | 下見(準備・方式・鍵・文字起こしのキー / モデル)と開く(部品・ログイン・サーバー・チャンネル・VC)の各段で `{ ok:false, reason }`。理由の表 `DISCORD_REASONS` は固定の短い日本語。テスト 595・641 |
| 切れたら場を閉じず「切れた」 | 適合 | `handleConnectionStatus`: Ready 以外 → `"disconnected"`、Ready に戻れば `"joined"`。最初の Ready までは `"joining"` のまま。場は閉じない(テスト 482) |
| 準備の保存 | 適合 | `getDiscordPrep` / `setDiscordPrep`(渡したキーだけ書く・null で消す・read-modify-write)。id の形・方式の確かめは `checkDiscordPrepPatch`(サーバーを替えてチャンネルを渡さなければチャンネルも消す) |
| 体験の口への差し方と開閉の順 | 適合 | 設計 §4.3「実物の順」どおり: 下見 → 声の engine → 入口を開く → 再生器 → 目 → … / 閉じるは声 → 目 → 正本・耳の束 → 入口を閉じる。テスト 290 が順を固定 |
| discord.js の動的 import | 適合 | 部品を読み込むのは `discord-libraries.mjs`(動的 import)だけ。`cockpit.mjs` の静的 import の木に入らないことを静的・ソース全体・実行時(解決 hook)の 3 通りでテスト(`scripts/cockpit-discord-d.test.mjs` 164・187・212) |

## 3. テスト適合(約束にテストが付いているか)

新規 39 本(2011 → 2050)。上の表の各項目に 1 本以上が対応する。

- 鍵: 一時フォルダの偽ファイルで読める / 合わない名前・区切り・`..`・ドライブは読まずに断る / ファイル無し・キー無し・空・形不正は短い理由 / `process.env` が前後で同じ(`discord-token-discord-d.test.mjs` 4 本)。
- ロール: 既定・書き戻し・編集・写しで落とさない・合わない値は持たない・鍵らしい値を読み書きしない(4 本)。
- 準備の保存: 未記憶 null・別キー・失敗寛容(3 本)。
- サーバ(17 本)・`cockpit.mjs`(7 本): 開く順・Intent・`group`・購読と耳・離脱・切れた・耳が起きない・閉じる冪等・入れない 2 系統・openEntrance の後の段で止まったとき・開く途中にサーバを閉じる・想定外の文面・準備 API・一覧 API・409/503・本物の opusscript と本物の耳。
- 偽の Discord: `fake-discord.mjs` が `discord.js` / `@discordjs/voice` / `OpusScript` の口を束で差し替える。テストが呼ぶ外部は無し(本物は opusscript のデコードだけ)。ネット・LLM・Discord を呼ぶ箇所は grep でも無い。
- 偽の Discord の形は本物の API と整合している(`receiver.subscriptions` は `Map`、`client.guilds.fetch()` は Collection で `.fetch()` を持つ、`Events.ClientReady`、`channel.type === GuildVoice`、`entersState` の reject で時間切れ、`connection.on("stateChange", (old, new))`)。

## 4. 守りの決まり(差分から独立に確かめた。最重要)

| 決まり | 確かめ方 | 結果 |
|---|---|---|
| 鍵を `process.env` に入れない | `git diff -U0` の追加行と `src/discord/`・`fake-discord.mjs` を `process\.env` で grep | 代入無し。出るのはコメントと「前後で同じ」を確かめるテストの読みだけ |
| 鍵がエラー・理由・ログに出ない | `discord-token.mjs`・`discord-experience.mjs` を通読。`say()` に渡る文字列を全部見た。`loginClient` / `catch {}` はすべて値を捨てて固定理由に倒す | 出ない。ログの行は `logging in`・`joined`・`client error`・`connection error`・`could not join (<固定の理由>)`・`speaker ear started (speakers N)`・`speaker left (speakers N)`・`left (utterances …)`・`catalog loaded (guilds N, channels M)` など数と状態だけ |
| ファイル名の検証 | `isDiscordBotKeyFileName`: 文字列・1〜64 字・`/` `\` `:` 無し・`..` 無し・`^\.env\.discord[A-Za-z0-9._-]*\.local$`。合わなければ読みに行かない | 適合。テスト 65 が `../`・`C:/`・`sub\`・`.env.local` 等を断る |
| テストは一時フォルダの偽ファイル | `mkdtemp` / `tmpdir()` の使用を grep | 鍵・設定・ロールとも `os.tmpdir()` の下。`createFileSettingsStore` は必ず `{ path }` 付き(path 無しの呼び出しは新規テストに無い) |
| 本物らしい id が無い | 新規ファイル全体と `git diff -U0` の追加行と Gnome 報告を `[0-9]{15,}` で grep | 0 件。id はすべて `guild-fake-1`・`user-fake-a`・`bot-fake-1` の類 |
| ログ・画面のログ・放送に本文・名前・Discord の id が出ない | サーバの `toWireEntry` を読む(`speakerId` を拾わない・soul は名前も null)。`speakerId` を `src/` 全体で grep(正本・整形の読まない旨のコメントと Discord の積む口だけ)。`onSttLatency` は `{ engine, latencyMs }` だけ。テスト 290・367 がログの口・遅延ログ・SSE の `diagnostic`・SSE 全体に名前・ユーザー id・サーバー / チャンネルの id・鍵・本文が無いことを確認 | 出ない。会話の行の `displayName`(Discord の名前)は設計 §9 の範囲で可。`speakerId` は放送・snapshot に出ない |
| 理由に discord.js の生のエラー文・名前・id が入らない | `discord-experience.mjs` の `catch` はどれもエラー値を使わない。`loginFails` の偽の文面に鍵を混ぜたテスト(641)で理由に出ないことを確認 | 出ない |
| 声をファイルに書かない | `src/discord/` と `fake-discord.mjs` を `writeFile|createWriteStream|appendFile|writeSync|openSync` で grep | 実装側に 0 件(出るのは鍵の偽ファイルを書くテストだけ)。音は耳に渡るまでのメモリ上の上限 10 秒のバッファだけ |
| 実データに触れない | 新規テストの設定・ロール・鍵のパスを全部確認(全部 `tmpdir()` 下) | 触れない。参考: `cockpit-settings.local.json` の mtime は 08:24(私のテスト実行より前。新規テストの書き先は一時フォルダなので、テストが書いたものではない)。`memories/`・`roles/` に直近 40 分の更新ファイル無し |
| 依存・lockfile | `git diff --stat` | 差分 0 |
| `_conventions.md`・種のファイル・②④の配信の文面 | `src/mind/`・`skills/`・`memories/` の差分 | 0 |

## 5. 配信が変わっていないことの確かめ方

1. 全件(2050)と固定テストが pass。既存テストの差分は 0 なので、期待値を変えて通した形ではない。
2. `cockpit-server.mjs` の差分を通読し、HEAD の `openStreamEntrance`(`git show HEAD:…` の 1840〜1975 行)と `buildEarPipeline` + 新しい `openStreamEntrance` を突き合わせた。耳の options は、`...baseOptions` → `whisper` → `stt`(ElevenLabs / ローカル) → `onSttStatus` → `capture` → `onVadEvent` → `transcriptBuffer` → `onTranscript` → `onDiagnostic` の順と値が同一。Discord だけが足す `segmenter`・`captureFactory`・`whisperPortOffset` は、配信では `spec` に無いので何も加わらない(`...(spec.segmenter ? … : {})`、`typeof spec.whisperPortOffset === "number" && > 0`)。`onSttStatus` の `pipeline !== ears` の判定も同じで、Discord でも場の段が `pipeline = opened.ears` を入れるため効く。
3. 下見の分割(`beginEarsStarting` / `checkEarEngine`)は呼ぶ順(Starting を放送 → キー・モデル確認)も戻り値(`voiceKind` + `plan`)も同じ。
4. `activeSttEngine()` は `venueSttEngine ?? sttEngine`。`venueSttEngine` は Discord の下見が立てて `markVenueClosed` が手放すので、配信の場では常に `sttEngine` と同じ。
5. 想定外の例外の文面: 配信は `experience === streamExperience` のとき従来の文字列のまま(`unexpectedVenueErrorMessage`)。
6. `cockpit.mjs` の追加は `createDiscordVenueExperience`(export)・束の `discordBotKeyFile` の口(渡さなければ null)・`main()` の結線だけ。`discord.js` は静的に入らない。`experiences` に渡すのは `discord` だけで、配信の口は変更なし。

## 6. B の持ち越し(domain-b-report §12)

| 持ち越し | 扱い | 確認 |
|---|---|---|
| `openEntrance` 失敗時の束の後片付け | 入口が自分で畳む(`refuse` → `teardown`: 購読・デコーダ・耳の束・出口・接続・ログイン)。入口が開いたあとの段で止まったときは場が `closeEntrance` を呼び、入口がそこで畳む | 筋が通る。テスト 641(開く失敗 5 系統で接続とログインが畳まれる)・667(後の段で止まる)。JSDoc に明記 |
| `closeEntrance` の冪等 | `session` が無ければ何も畳まない。開いていなくても・二重でも投げない。`teardown` は `closed` で早期 return | テスト 529 が二重・開いていない場合を固定 |
| `voiceKind` 無し | Discord の口は返さない=共有の `ttsEngine`(ロールの声の方式)。声の出口は E | 筋が通る。E への持ち越しに記載 |
| 耳と接続の状態 | `ears`: starting → listening → stopped。`stt`: 入った時点で up、人の耳が起きなければ down。接続は別項目 `stream.connection` | 適合(下の §7) |
| 想定外の例外の文面 | 口の `unexpectedErrorMessage(phase)` の固定文面。配信は従来の文字列 | テスト 738 |

## 7. G / E が使う項目

- `stream.connection`: `"joining"` / `"joined"` / `"disconnected"` / `null`(`VENUE_CONNECTION_STATES`)。実装(`setConnection` / `handleConnectionStatus`)とテスト 290・482 が一致。`discord`: `{ available: true }` か `null`(テスト 340・839)。準備の id は snapshot に出ない。
- E の置き場: `createDiscordExperience({ outletFactory })`(VC が Ready になった直後に `{ connection, voice, groupId }` で呼び、`dispose()` を閉じるときに呼ぶ)と口の `voiceConnection()`(Ready を一度過ぎた接続か null)が実在する。`cockpit.mjs` は口の生のオブジェクトを持つので、ロールの束の `voice.startResources` から引ける。

## 8. 止める指摘

**なし**(§4 の 4 つの理由のいずれにも当たらない)。

## 9. 止めない指摘(持ち越し。根拠を出せない好みを含む)

1. **ログイン中に `closeEntrance` が呼ばれると、ログインした Bot が `destroy` されない**。再現(OS 一時フォルダ外のスクラッチ・ソース無変更): 偽の Discord の `login` を止めた状態で `openEntrance` → `closeEntrance({shutdown:true})` → ログイン完了、で `destroyedClients = 0`。原因: `s.client` が未代入のうちに `teardown(s)` が `closed = true` にし、その後の `refuse` の `teardown` は `closed` で no-op になる。サーバーのログイン中に起きるのはサーバを閉じる(Ctrl+C)ときだけ(通常の終えるは開く途中は断られる)で、プロセスごと消えるので実害は小さい。サーバー取得・VC 参加後に閉じたときは畳まれる(同スクリプトの guilds 段で確認)。今の B の約束の「`openEntrance` 失敗時に漏れない」の範囲(入口自身の失敗)は満たす。直すなら `refuse` / ログイン直後に `if (s.closed) await destroyClient(client)`。
2. **ElevenLabs の耳では 400ms 未満の発話が転写に回りうる**(Gnome 質問 1)。見立ては §10。
3. **`role.json` の鍵のファイル名が合わない値のとき、黙って既定の鍵で入る**(Gnome 質問 2)。見立ては §10。`copyRoleAs` が鍵のファイル名を引き継ぐため、写したロールが元ロールと同じ Bot を指す点も、2 つ目のロールのときに見直す。
4. 接続が `"disconnected"` の間、`ears` は `"listening"` のまま(Gnome も記載)。G が接続の状態を別に読めば足りる。
5. 小さな点: 接続の状態 `Signalling` / `Connecting` のつなぎ直しも `"disconnected"` と表示する(設計 §6.1 の「切れた」の範囲)。`DISCORD_CONNECTION_STATES`(口)と `VENUE_CONNECTION_STATES`(サーバ)の二重定義。ElevenLabs は 1 人が再接続中でも `stt` 全体が reconnecting になる(人ごとの耳が 1 つの `stt` に写る裁量の副作用)。

## 10. Gnome の質問への見立て

1. **ElevenLabs の耳で 400ms 未満が残る件**: 設計 §6.4 は「ElevenLabs は取り込んだ音をそのまま送る・気になる量なら Discord では VAD を通った区間だけ送る形を、仲間を入れる区切りで考える」と既に書いている。最初の的は 1 人なので、関所(購読ごとに最初の 400ms を溜める)は今は足さない案に賛成。足すと、どの方式でも話し始め(VAD・割り込み)が最大 400ms 遅れて、設計 §7.4 の割り込みの質に響く。人間ゲート 2 の確認項目 7 で咳・息が拾われるかを見て決める。
2. **合わない `discordBotKeyFile` を既定で読む件**: 設計 §5 の置き場の規則は「合う名前だけ受け付ける(パスの区切りを含む値は断る)」。読み出し側(`loadDiscordBotToken`)は断る実装なので、他のファイルを読ませる穴は無い(安全側)。ただ `normalizeRole` が合わない値を捨てて既定に倒すので、指しているのに合わないとき(2 つ目のロールの書き損じ)に黙って 1 つ目の Bot で入る。設計の「断る」により忠実なのは、入口で理由つきで断る形(`DISCORD_KEY_FILE_NAME_REFUSED` はすでにある)。今は最初の的が 1 ロールで、設計に明示された順序の定めも無いので止める理由にはしない。2 つ目のロールを扱うときの最初に直すことを推す。

## 11. 裁量(筋が通ると認めたもの)

Gnome 報告 §15 の 18 項目をすべて確認し、設計に反するものは無かった。特に記録する:
- 耳を最初に話し始めたときに作り、起きるまでの音を上限 10 秒で溜める(7)。起きなかった人はその場の間は聞かない(8。作り直しの嵐を避ける。抜けて入り直せば作り直す)。
- 方式を選んでいなければ `whisper`、知らない値なら断る(2)。
- 準備の書き換えと一覧の読み込みは Discord の場の間だけ 409(13)。
- 鍵は `plan` でログインに 1 回渡すだけで、開いている間の入口の記録には写さない(16)。
- 耳の組み立ての共有(`buildEarPipeline`・`beginEarsStarting`・`checkEarEngine`)で、配信の options の形・下見の順を保った(3。§5 で確認)。

## 12. 質問

なし。

## 13. 付記(確かめた範囲の限界)

- 本物の Discord・本物の声は使っていない。opusscript の直の 16kHz デコードの音質、Silero VAD が RMS 0.0002〜0.002 の発言を弾くか、2 人以上の分かれ方、`stream` の `close` が購読の終わりで本物の discord.js から上がるかは、偽物では確かめきれず、人間ゲート 2 の確認(Gnome 報告 §17)のままでよい。
- レビュー用の再現スクリプトは OS の一時フォルダの下のスクラッチだけに置き、リポジトリには何も足していない。
