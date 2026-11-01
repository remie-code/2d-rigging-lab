# Domain D 完了報告 — Discord の入口(Orch-Sylph 2026-11-01)

> 判定: **pass**(ループ 1 回・止めた指摘 0・Review-Sylph が合格)。
> 計画: [../../orchestration/discord-mode-wave-plan.md](../../orchestration/discord-mode-wave-plan.md) §1 Domain D。
> 実装: Gnome(opus)→ [domain-d-gnome.md](domain-d-gnome.md)。レビュー: Review-Sylph(sonnet)→ [../../reviews/discord-mode/domain-d.md](../../reviews/discord-mode/domain-d.md)。
> コミットはしていない(ブランチ `ai-cohost/discord-mode`、HEAD `805dcfc1`)。鍵(`.env*.local`)は誰も読んでいない。実データ(`cockpit-settings.local.json`・`memories/`・`roles/`)には触れていない(レビューが mtime で確認)。本物の Bot はログインさせていない。操縦席は起動していない。依存・lockfile の変更なし。`apps/soul/agent/tmp/` には元からの 2 つしか無い。

## 1. 機械ゲート

| ゲート | 結果 |
|---|---|
| `apps/soul/agent` で `node --test` | **2050 / 2050 pass**(2011 から +39)。Gnome とレビューの両方で実行した |
| 根で `pnpm run check:soul-zone` | pass(1590 files) |
| 固定テスト `stream-wording-pin` と fixture | pass。`src/mind/`・`skills/` の差分は 0 |
| 既存テストファイル | 差分 0 |
| 依存・lockfile | 差分 0 |
| 本物の Discord・LLM・外部 API | 呼ばない |

## 2. 変更ファイル(`apps/soul/agent/` 起点)

- **変更(5 本)**
  - `src/cockpit/cockpit-server.mjs`
  - `src/cockpit/cockpit-settings-store.mjs`
  - `src/roles/role-store.mjs`
  - `scripts/cockpit.mjs`
  - `scripts/probe-discord-receive.mjs`(移した鍵の読み方を import する形にしただけ。そのテストは 23/23 のまま)
- **新規の実装**
  - `src/discord/discord-token.mjs`
  - `src/discord/discord-libraries.mjs`(discord.js などを動的 import する唯一の口)
  - `src/discord/discord-audio.mjs`
  - `src/discord/discord-experience.mjs`
- **新規のテストと偽物**
  - `src/test-support/fake-discord.mjs`
  - `src/discord/discord-token-discord-d.test.mjs`
  - `src/roles/role-store-discord-d.test.mjs`
  - `src/cockpit/cockpit-settings-store-discord-d.test.mjs`
  - `src/cockpit/cockpit-server-discord-d.test.mjs`
  - `scripts/cockpit-discord-d.test.mjs`

## 3. 期待値を変えた既存テスト

- **0 件**。期待値を変えない直しも 0 件(既存テストのファイルには触れていない)。

## 4. 鍵の読み方とロールの指し先

- **鍵を読む関数**: `src/discord/discord-token.mjs` の `loadDiscordBotToken({ fileName, dir, readFileImpl })`。
  - 返り値は `{ ok:true, token }` か `{ ok:false, reason }`。
  - ファイルはコードの中で読み、`process.env` には入れない。
  - 理由の文面に入るのはファイル名だけ。
- **ファイル名の検証**(`isDiscordBotKeyFileName`): 次をすべて満たす名前だけ受け付ける。合わなければファイルを読みに行かずに断る。
  - `/^\.env\.discord[A-Za-z0-9._-]*\.local$/` に合う。
  - 1〜64 字。
  - `/`・`\`・`:`・`..` を含まない。
- **ロールの指し先**
  - `role.json` の `discordBotKeyFile` は、形が合うときだけ `normalizeRole` が項目として持つ。今のロールの形は変わらないので、既存の deepEqual は通る。
  - `roleDiscordBotKeyFile(role)` は、指していなければ既定の `.env.discord.local` を返す。
  - 画面での編集は作っていない(`applyRolePatch` は受け付けない)。
  - ロールの束 `createVenueRoleBundle` に `discordBotKeyFile()` の口を足した。

## 5. 接続・一覧・入る / 抜けるの API

| 道 | body | 応答 |
|---|---|---|
| `POST /api/stream/start` | `{ experience: "discord" }`(Discord の中身は保存した準備から読む) | 200 snapshot / 500 `{ error }`(入れない理由)/ 503(入口が無い) |
| `POST /api/stream/stop` | — | 200(VC を抜けてログアウト済み) |
| `GET /api/discord/prep` | — | 200 `{ prep: { guildId, channelId, sttEngine } }` / 503 |
| `POST /api/discord/prep` | `{ guildId?, channelId?, sttEngine? }`(null か "" で消す) | 200 / 400 / 409(Discord の場の間)/ 503 |
| `POST /api/discord/catalog` | — | 200 `{ guilds: [{ id, name, channels: [{ id, name }] }] }` / 502(決まった文面)/ 409 / 503 |

- **一覧の読み込み**: ロールの鍵でログイン → サーバーとボイスチャンネルを取る → ログアウト。
  - 同時に呼ばれてもログインは 1 回。
  - ボイスチャンネルは `GuildVoice` だけ(ステージは外す)。
- **入る**: `openEntrance` の中で次の順に進む。
  1. ログインする(Intent は `Guilds` と `GuildVoiceStates` だけ)。
  2. `joinVoiceChannel` を呼ぶ(`group` はロールの id、`selfDeaf` と `selfMute` は false)。
  3. `entersState(Ready)` を待つ。
- **抜ける**: 操作者が場を閉じたときだけ。`closeEntrance` が `connection.destroy()` と `client.destroy()` を呼ぶ。Bot は自分では抜けない(全員が抜けても、接続が切れても残る)。

## 6. 人ごとの耳と束の形

- **購読**: 人が話し始めたら(`receiver.speaking` の start)、その人を購読する(`AfterSilence` 500ms)。
- **人ごとに 1 組**: Opus のデコーダ(`new OpusScript(16000, 1)` で直に 16kHz モノラル)と耳 1 本。耳を作るのは、その人が最初に話し始めたとき。
  - 耳が起きるまでの音は、音の入口が溜める(上限 10 秒)。
- **耳の作り方**: 場の口 `venue.createEar` を使う。中身はサーバの `buildEarPipeline` で、配信の入口から出して共有にした組み立て。Discord の耳だけが足すものは 3 つ。
  - `captureFactory`(人ごとの音を流す口)
  - `segmenter.minSpeechMs = 400`
  - whisper-server の口の番号のずらし(2 人目から +1)
- **束**: key は `discord-<通し番号>`(Discord の id を入れない)。`venue.createEars()` の束に `add` する。人が VC から抜けたら `drop` する。正本は続く。
- **話者の載せ方**: 積む口を包む(`speakerTranscriptMouth`)。行は `speaker:"you"`・`displayName: Discord の名前`・`speakerId: ユーザー id`。
  - `ear-pipeline.mjs` は変えていない。
  - 名前は `members.fetch` で 1 人 1 回だけ取る。取れなければ名前なしの you。
- **人の耳が起きないとき**: その場の間、その人は聞かない。`stt` は down。場は閉じない。

## 7. ほぼ無音の発言の除き方(設計 §6.4)

1. 3 バイトの無音フレーム `F8 FF FE` を、デコードの前に捨てる(`isOpusSilenceFrame`)。
2. そのあとは耳の Silero VAD に任せる(人ごとに別の VAD)。
3. Discord の耳だけ、区切りの `minSpeechMs` を 400 にする。本物の耳と本物の opusscript のテストで、200ms の発話は転写に回らないことを確かめた。

- 購読が終わったら 800ms の無音を足す。本物の耳のテストで、足せば区切りが閉じ、足さなければ閉じないことを確かめた。
- 頭欠けは受け入れる(印は付けない)。

## 8. Discord の準備の保存の形

- **保存先**: `cockpit-settings.local.json`。キーは `discordGuildId`・`discordChannelId`・`discordSttEngine` で、配信の `sttEngine` とは別に持つ。
- **読み書き**: `getDiscordPrep()` / `setDiscordPrep(patch)`。渡したキーだけ書き、null で消す。
- **形の確かめ**
  - id は `/^[A-Za-z0-9_-]{1,64}$/` に合うこと。
  - 文字起こしの方式は `STT_ENGINES` のどれか。選んでいなければ whisper。知らない方式が保存されていれば断る。
- テストは一時フォルダの設定ファイルだけを使う。
- 見る窓(目)の Discord ごとの選択は作っていない(G へ持ち越し)。

## 9. 入れない・切れたの扱い

- **入れないとき**: `{ ok:false, reason }` を返し、場は開かない。応答は 500 `{ error }` で、`stream.error` にも同じ文面が出る。VC に入る前の段で止まったときは、入口が自分で畳む。
- **理由の文面**(`DISCORD_REASONS`、詳細は gnome §9): 決まった短い日本語だけで、鍵・id・名前・discord.js の生のエラー文は入れない。
  - ロールが無い
  - 準備が無い
  - 文字起こしの方式が使えない
  - 鍵が無い(文面に入るのはファイル名だけ)
  - ElevenLabs のキー切れ・ローカルのモデルの欠け(配信と同じ文面)
  - 部品を読み込めない
  - ログインできない
  - サーバーやチャンネルが見つからない
  - VC に入れない
  - 開く途中で場を閉じた
  - 一覧が読めない
  - 人の耳を起こせない
  - 想定外のエラー
- **途中で切れたとき**: 場は閉じない。`stream.connection = "disconnected"` を出し、つなぎ直しはライブラリに任せる。Ready に戻れば `"joined"`。

## 10. B の持ち越しの扱い

1. **`openEntrance` が失敗したとき**: 入口が自分で畳む。購読・デコーダ・`createEars()` の束・接続・ログインの全部が対象。場は B の約束どおり `closeEntrance` を呼ばない。入口が開いたあとの段で止まったときは、場が `closeEntrance` を呼ぶ。どちらもテストで固定した。
2. **`closeEntrance`**: 冪等。開いていなくても、二重に呼ばれても投げない。
3. **声の方式**: `voiceKind` は返さない。共有の `ttsEngine` のまま(出口は E)。
4. **耳と接続の状態**: snapshot の項目として §11 のとおり決めた。
5. **想定外の例外の文面**: 配信は今の文面のまま。外から渡された体験の文面は、口の `unexpectedErrorMessage(phase)` が決める。Discord は決まった文面で、生のエラー文を入れない。口が文面を持たないときは中立の「場を開けない…」になる。

## 11. G が使う snapshot の項目名と値

- `stream.experience`: `"discord"` / `"stream"` / null。
- `stream.connection`(新規・`VENUE_CONNECTION_STATES`): `"joining"`(ログインから Ready まで)/ `"joined"` / `"disconnected"`(場は開いたまま)/ null(配信・閉じている・入れなかった)。
- `discord`(新規): `{ available: true }`(入口が渡されている)/ null。準備の id は snapshot に載せない(`GET /api/discord/prep` で読む)。
- `ears`: `"starting"` → `"listening"`(VC に入った)→ `"stopped"`。
- `stt.engine`: Discord の場の間は Discord の準備の方式。閉じたら配信の選択に戻る。
- `health.ffmpeg`: Discord の場では `"unknown"`。
- `transcripts` と SSE の `transcript`: you の行に Discord の名前(`displayName`)が載る。`speakerId` は載らない。
- 断りの文面(`busyMessage`): 「VC に入っている途中」「VC から抜けている途中」「VC に入っている」。

## 12. E が出口を差す置き場

- `createDiscordExperience({ outletFactory })`(cockpit.mjs では `createDiscordVenueExperience`)。
  - VC が Ready になった直後に `outletFactory({ connection, voice, groupId })` を呼ぶ。
  - 閉じるときに、その返り値の `dispose()` を呼ぶ。
- 口の `voiceConnection()`: 入っていれば今の接続、いなければ null。ロールの束の `voice.startResources` から引ける。
  - 場の段の順は「入口を開く → 再生器」なので、再生器を作る時点で接続はある。
- **D の間の声**: VC には出ない。チャッピーの声は手元の再生器(PC のスピーカー)から出る。

## 13. 守りの決まりの確かめ方

- **Gnome のテスト**
  - 鍵: 一時フォルダの偽ファイルで読む。合わない名前は読みに行かない。理由に値が出ない。`process.env` は前後で同じ。
  - ロールと設定: role.json に鍵らしい値を置いても読まない・書かない。開いたあとの設定ファイルと放送に鍵が無い。
  - ログ: Discord のログの口・遅延のログ・画面のログ(SSE `diagnostic`)を集め、名前・ユーザー id・サーバーとチャンネルの id・鍵・本文が無いことを確かめた。
  - 放送: SSE の全部に Discord の id が無い。
  - import の木: discord.js などが操縦席の起動の import の木に入らないことを 3 通りで確かめた(静的に辿る・ソース全体を探す・子プロセスで実行時の解決を見る)。
- **Review-Sylph が差分から独立に確かめたこと**
  - `process.env` への代入が無い。
  - 新規ファイルと追加行に 15 桁以上の数字が無い(本物らしい id が無い)。
  - 声をファイルに書く所が無い(`writeFile` / `createWriteStream`)。
  - 理由・ログ・放送に鍵・id・名前・生のエラー文が出ない。
  - テストの設定・ロール・鍵は全部 OS の一時フォルダにある。
  - 実データの mtime がテスト実行より前。
  - 配信の耳の options を HEAD の `openStreamEntrance` と突き合わせ、順も値も同じ。
- **偽の Discord**(`src/test-support/fake-discord.mjs`): `createFakeDiscord({ guilds, loginFails, neverReady, joinFails, catalogFails, OpusScript })`。
  - discord.js の束: `Client` は EventEmitter(`login` / `guilds.fetch` / `destroy`)、ほかに `Events`・`GatewayIntentBits`・`ChannelType`。
  - @discordjs/voice の束: `joinVoiceChannel`(偽の接続)・`entersState`・`VoiceConnectionStatus`・`EndBehaviorType`。偽の接続の `receiver.speaking` は EventEmitter、`receiver.subscribe` は PassThrough。
  - OpusScript: 既定は偽物。本物も渡せる。
  - 呼ばれた記録: `record` に clients / logins / destroyedClients / joins / subscribes など。

## 14. 裁量(レビューは設計に反しないと確認した。全 18 項目は gnome §15)

主なもの:

- 耳の組み立てを配信と共有した(`buildEarPipeline`・`beginEarsStarting`・`checkEarEngine`)。
- 外から渡された体験に、場の口を 2 つ目の引数 `control` で渡す。
- Discord の場の間だけの文字起こしの方式を `venueSttEngine` に持つ。
- 耳は最初に話し始めたときに作る。
- 人の耳が起きなければ、その場の間はその人を聞かない。
- whisper の口の番号を人ごとにずらす。
- `AfterSilence` は 500ms、購読の終わりの無音は 800ms。
- 準備の書き換えと一覧の読み込みは、Discord の場の間だけ 409 で断る。
- 合わない `discordBotKeyFile` は項目ごと捨て、既定のファイルで読む(下の質問 2)。

## 15. 持ち越し

- **E(出口)**
  - 出口は §12 の置き場に差す。
  - **ログイン中に `closeEntrance` が呼ばれると、ログインした Bot が `destroy` されない**。レビューが偽の Discord で再現した(`destroyedClients = 0`)。
    - 原因: `teardown` が `closed` を見て何もしない。
    - 起きるのはサーバを閉じる(Ctrl+C)ときだけ。プロセスが終われば接続も切れるので、実害は小さい。止めない指摘。
    - 直し方: ログインの直後に `if (s.closed) await destroyClient(client)`。E の Gnome が Discord の口に触るついでに直すとよい。
  - 声の方式は、Discord で替えるなら下見で `voiceKind` を返す。
- **F**: Discord の口の `wording` / `teaching` / `judgeSet` は null(配信の言葉で動く)。差すのは `createDiscordExperience` の返り値。
- **G(画面)**
  - snapshot の項目は §11、API は §5、理由の文面は `DISCORD_REASONS` を使う。
  - 見る窓(目)の Discord ごとの選択は作っていない。
  - `STREAMER_LABEL` を体験で替える。名前は放送の `displayName` に載っている。
  - `chatBufferAbsent` の文面(B からの持ち越し)。
- **小さな点(止めない)**
  - `"disconnected"` の間も `ears` は `"listening"` のまま。
  - Signalling / Connecting のつなぎ直しも「切れた」と出る。
  - 接続の状態の語彙が、口の `DISCORD_CONNECTION_STATES` とサーバの `VENUE_CONNECTION_STATES` の 2 か所で定義されている。
  - ElevenLabs では、1 人がつなぎ直すと `stt` 全体が reconnecting になる。
- **2 つ目のロールのとき**: 合わない鍵のファイル名を入口で断る(質問 2)。`copyRoleAs` が鍵のファイル名を引き継ぐ点も見直す。

## 16. 人間ゲート 2 で見る所(偽物で確かめきれない所。gnome §17)

1. opusscript で直に 16kHz モノラルにデコードしたときの、実際の声の音質(文字起こしの精度)。
2. Silero がほぼ無音の発言を弾くか。
3. `AfterSilence` 500ms と無音 800ms で区切りが閉じるか。返事までの遅れが気にならないか。
4. 最初の発話の頭が欠けないか(耳が起きるまでの間)。
5. 2 人以上のときの話者の分かれ方。
6. whisper の 2 人目の口(8179)が起きるか。メモリは足りるか。
7. ElevenLabs の人ごとの接続と課金。短すぎる発話が拾われるか(質問 1)。
8. 名前が取れるか(`members.fetch`)。
9. 切れたときの表示とつなぎ直し。全員が抜けても Bot が残るか。
10. 本物の Bot で一覧を読み込めるか(権限の無いチャンネルを含めて)。
11. D の間は、チャッピーの声が VC で聞こえない(手元のスピーカーから出る。E で直る)。
12. ターミナルの `[cockpit] discord:` の行に名前や id が出ていないか、目で見る。

## 17. 質問(Undine へ。どちらも止める理由ではない)

1. **ElevenLabs の耳では、400ms 未満の発話が転写に回りうる**。
   - 理由: ElevenLabs は耳の区切りと別に自分で区切るので、`minSpeechMs` が効かない。
   - 手当ての案: Discord の側に「最初の 400ms を溜め、届かなければ捨てる」関所を足す。ただし、どの方式でも話し始めと割り込みが最大 400ms 遅れる。
   - 推奨: 今は足さない。人間ゲート 2 で咳などが拾われるかを見てから決める。Gnome・レビュー・Orch-Sylph とも同じ見立て(設計 §6.4 も「仲間を入れる区切りで」と書いている)。
2. **`role.json` の `discordBotKeyFile` が合わない値のとき、今は既定の鍵で入る**。
   - 設計 §5 は「断る」と書く。読むファイルは検証済みなので、ほかのファイルを読ませる穴は無い。
   - 気になる所: 2 つ目のロールの鍵のファイル名を書き損じると、黙って 1 つ目の Bot でログインする。
   - 推奨: 2 つ目のロールを扱うドメインの最初に「入口で断る」へ直す。レビューも同じ見立て。

## 18. 起動した子

| 役 | モデル | agentId | 状態 |
|---|---|---|---|
| Gnome(実装) | opus | `a837b9be26e338327` | 完了(domain-d-gnome.md と hand-back を受け取った) |
| Review-Sylph(レビュー 1 回目) | sonnet | `ac76dc3cade9144fa` | 完了(reviews/discord-mode/domain-d.md と hand-back を受け取った) |

生き残りの子は無い(どちらも SubagentHandback で終了済み)。
