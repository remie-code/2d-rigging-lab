# Domain E Gnome 報告 — Discord の出口(Gnome 2026-11-01)

> 計画: [../../orchestration/discord-mode-wave-plan.md](../../orchestration/discord-mode-wave-plan.md) §1 Domain E と Status の D の追認 (2)(3)(4)。設計: [../../../architecture/discord-mode.md](../../../architecture/discord-mode.md) §7(§4.3・§5・§10・§12.3)。
> ブランチ `ai-cohost/discord-mode`(HEAD `1f1188a4`)。**コミットしていない**。鍵(`.env*.local`)は読んでいない・出していない。実データ(`cockpit-settings.local.json`・`memories/`・`roles/`)には触れていない。本物の Bot はログインさせていない。操縦席は起動していない。依存と lockfile は変えていない。

## 1. 変更ファイル(`apps/soul/agent/` 起点)

- **新規の実装**
  - `src/discord/discord-stream-player.mjs` — Discord 向けの再生器 `createDiscordStreamPlayer`。
  - `src/discord/discord-pcm48.mjs` — 48kHz ステレオ s16le への変換 `createPcm48kStereoConverter`(状態を持つ)。
- **新規のテストの部品**
  - `src/test-support/fake-discord-audio.mjs` — 偽の `createAudioPlayer` / `createAudioResource` / `StreamType` / `AudioPlayerStatus` / `NoSubscriberBehavior`。本物の 0.19.2 の AudioPlayer の状態の動き(Buffering → Playing、AutoPaused、missedFrames → stop、無音の詰め物 5 フレーム → Idle、Idle を挟まない差し替え)を、20ms の周期を `step()` で進める形で写した。
- **新規のテスト(6 本・49 件)**
  - `src/discord/discord-pcm48-discord-e.test.mjs`(9)
  - `src/discord/discord-stream-player-discord-e.test.mjs`(15)
  - `src/discord/discord-streamer-watch-discord-e.test.mjs`(8)
  - `src/discord/discord-experience-discord-e.test.mjs`(6)
  - `src/roles/role-store-discord-e.test.mjs`(4)
  - `scripts/cockpit-discord-e.test.mjs`(7)
- **変更(4 本)**
  - `scripts/cockpit.mjs` — `createVenuePlayerSlot`(新しい export)・`createVenueRoleBundle` に 2 つの口・main の結線(再生器の作り分け)。
  - `src/discord/discord-experience.mjs` — 出口をロールの束から引く・出口を作れなければ断る・直し (a) の入口の断り・直し (b)。
  - `src/roles/role-store.mjs` — 形の合わない `discordBotKeyFile` の印と `roleDiscordBotKeyFileRefused`。
  - `src/test-support/fake-discord.mjs` — 足しただけ(voice の束に音の部品、偽の接続に `subscribe(player)`、返り値に `audio`)。D の口とふるまいは変えていない。

## 2. 機械ゲート

| ゲート | 結果 |
|---|---|
| `apps/soul/agent` で `node --test` | **2099 / 2099 pass**(2050 から +49) |
| 根で `pnpm run check:soul-zone` | pass(1599 files) |
| 固定テスト `src/mind/stream-wording-pin.test.mjs` と fixture | pass。`src/mind/`・`skills/` の差分は 0 |
| 既存のテストファイル | 差分 0(新しいテストは全部新規ファイル) |
| 依存・lockfile | 差分 0 |

## 3. 期待値を変えた既存テスト

- **0 件**。既存のテストファイルには触れていない。
- D のテストが固定していた形は全部そのまま通る:
  - `roleDiscordBotKeyFile` は形の合わない値でも既定を返す。
  - `normalizeRole` は形の合わない値を項目として持たない。
  - main の `createDiscordVenueExperience({ settings, currentKeyFile, write })` の 3 行。
  - `startVoiceResources: ensureVoiceResources,\n recallRunner,` の並び。
  - 静的 import の木に Discord の部品が入らないこと。
- (a) と出口は、これらの期待値を変えずに済む形を選んだ(§9・§12)。

## 4. 再生器の形・接続への結び方・配信の再生器との作り分け

### 4.1 再生器の形(`createDiscordStreamPlayer({ voice, connection, startedDelayMs?, maxMissedFrames?, nowImpl?, onTrace? })`)

口は今の手元の再生器と同じ: `open / write / end / stop / onEvent` + `isAlive / dispose / whenReady / current`。

| 呼ばれ方 | すること |
|---|---|
| 作るとき | `voice.createAudioPlayer({ behaviors: { noSubscriber: Pause, maxMissedFrames: 75 } })` を作り、`connection.subscribe(player)`。'error' は必ず聞く(聞かないと EventEmitter が投げる) |
| `open(id, { sampleRate, channels })` | 発話ごとに `PassThrough` 1 本と `createAudioResource(input, { inputType: StreamType.Raw })` を作り `player.play(resource)`。前の発話は置き換える(事象は出さない・Idle を挟まない)。形の確かめは手元の再生器と同じ(RangeError) |
| `write(id, pcm)` | 48kHz ステレオに変えて流す。今の発話でない id・end の後は false |
| `end(id)` | 変換の残りと 20ms の端数の無音を流して流れを閉じる。Idle で `ended`。音の無い発話は鳴らさず `ended` だけ(STARTED なし・手元と同じ)。二度目は false |
| `stop()` | 鳴っている(Playing)ときは `player.stop()`(無音 100ms の余韻)。Buffering・AutoPaused のときは `stop(true)`。`stopped`(止めた id・無ければ null)を出す |
| `onEvent` | `started`(その resource で Playing になった時刻 + 遅れ)・`ended`・`stopped`・`error`。形は `{ type, id, atMs }`(error は `message` 付き・決まった文面) |
| `dispose()` | 鳴っている発話があれば `stopped` を出してから、`stop(true)` して接続から外す。以後は事象なし。後の `open/write/end` は投げる(手元と同じ)。`stop()` は投げない(§12) |

- end の前に Idle になったとき(途切れが上限を超えた・流れが失敗した)は、その発話を `error` にする。運び手が世代を閉じる。
- 運び手(`speech-streamer.mjs`)と orchestrator は**変えていない**。

### 4.2 接続への結び方

- D の置き場(`openEntrance` の中、VC が Ready になった直後)で出口を作る。引き方の順:
  1. `deps.outletFactory` があればそれ。
  2. 無ければ、その場のロールの束の `voice.openOutlet`(`roleOutletFactory`)。`group` と同じ id のロールを選び、見つからなければ先頭。
- `openOutlet({ connection, voice, groupId })` には、そのロールの Bot の接続と、`discord-libraries.mjs` が動的 import した @discordjs/voice の束が渡る。
- 閉じるときは、`closeEntrance` の teardown が返り値の `dispose()` を呼ぶ。順は耳の束の後、`connection.destroy()` の前。
- 出口を作れなかったとき(投げた)は、場を開かずに決まった理由 `DISCORD_REASONS.outlet` を出す。入口は自分で畳む。

### 4.3 配信の再生器との作り分け(`scripts/cockpit.mjs`)

設計 §4.3「再生器を作る(ロールごと)」・§5「Discord では Bot の接続ごと」に沿わせた。

- `createVenuePlayerSlot()`: その場の再生器の差し口。
  - 配信では空(null)のまま。
  - Discord では、ロールの束の `openVoiceOutlet` → `venuePlayers.open(info)` が Discord 向けの再生器を作って置く。返り値の `dispose` で畳んで空に戻す。
- main の変更:
  - `activePlayer() = venuePlayers.current() ?? player`
  - `ensureVoiceResources`: 差し口に再生器があれば、声の engine だけ用意して手元の再生器(常駐 PowerShell)を**起こさない**。手元のスピーカーからは出さない。
  - `acquireAcceptedFireResources`: `acceptedPlayer = activePlayer()`。進行中の Fire はその再生器を最後まで使う。
  - `playerProxy` の 5 つの口も `activePlayer()` へ。
- 場の開く順は「入口を開く(ここで出口)→ 再生器を起こす段(`startVoiceResources`)」なので、再生器を起こす段では Discord の再生器がもう差してある。テストで確認した。
- 閉じた後は差し口が空。次の配信の場では今までどおり手元の再生器を作って使う。
- 配信の場では差し口が常に空なので、`activePlayer()` は今の `player` そのもの。`ensureVoiceResources` も今の道だけを通る。

### 4.4 閉じる順(設計 §4.3 の実物の順)

テスト `scripts/cockpit-discord-e.test.mjs` で、本物の server・体験の口・偽の Discord を使って固定した。

1. 声を止める(Fire があれば kill)
2. 目
3. 正本・耳の束
4. 入口を閉じる。中の順は「出口を畳む(このとき `destroyCount=0`)→ VC を抜ける → ログアウト」
5. 頭のセッション

- 鳴っている発話が残っていれば、出口を畳む所で `stopped` が出る。運び手は見張りの時間切れを待たずに世代を閉じる。

## 5. 変換の方法(`discord-pcm48.mjs`)

- 変換は `open` の `{ sampleRate, channels }` に従う。
  - **48kHz**: そのまま。モノラルは左右に同じ値。
  - **48kHz の整数分の 1**(24k・16k・12k・8k): 各サンプルを整数倍の回数だけ繰り返し、左右同値。24kHz なら 2 回。
  - **それ以外**(44.1kHz など): 線形の補間。出力 n の位置は `n × 入力のレート / 48000`。
- **状態を持つ**ので、チャンクの境目で途切れ・ずれが出ない。
  - 1 フレームに満たない端数のバイト(奇数バイトを含む)は次へ持ち越す。
  - 線形の補間は、入力と出力の通し番号を整数で持つ(位置を浮動小数で足していかないので誤差が積もらない)。直前のチャンクの最後のフレームを覚えて、境目の補間に使う。
  - テストで確かめたこと: 5 つの形(44.1k モノ・22.05k ステレオ・24k・32k・48k ステレオ)で、乱数で切ったチャンク(空・奇数バイトを含む)の出力が、全部を 1 度に変えた出力と 1 バイトも違わない。
- `flush`(end)でしていること:
  - 補間の残りを最後のフレームで埋めて出す。
  - 出力の合計を 20ms(3840 バイト)の倍数まで無音で埋める。prism-media の Encoder は 1 フレーム未満の端数を捨てるので、尻切れを防ぐため。
- 1kHz の正弦波の確かめ: 44.1k → 48k で長さが変わらない(0.2 秒 = 9600 フレーム)。形の誤差は振幅の 3% 未満。
- 新しい依存は足していない。

## 6. Idle の落とし穴への手当て(§7.3)

- 発話ごとに 1 resource。
- `behaviors.maxMissedFrames = 75`(1.5 秒)。`maxMissedFrames` で替えられ、範囲は 5〜500。
- 終わりは `end()` で明示する(流れを閉じる → 詰め物 5 フレーム → Idle → `ended`)。
- テストで確かめたこと(偽の AudioPlayer):
  - 1.2 秒の途切れでは Idle にならず、続きを鳴らして `ended` になる。
  - 1.5 秒を超える途切れは end の前の Idle になり、`error` になる。
  - 対照として、上限が既定の 5 のままだと 100ms の途切れで Idle になる(落とし穴の確かめ)。

## 7. 割り込みの計算(§7.4 の a)

- `started` の `atMs` = Playing になった時刻 + `startedDelayMs`。
- 遅れの既定は **100ms**(`DEFAULT_DISCORD_STARTED_DELAY_MS`)。
- **替え方**: 再生器の `startedDelayMs` オプション。0〜2000 に丸め、数でなければ既定。
  - main からは `createVenuePlayerSlot({ startedDelayMs })` で渡せる。今の main は渡していない(既定を使う)。設定・CLI の口は作っていない(質問 3)。
- 運び手と orchestrator の計算(`elapsed = 割り込みの時刻 − startedAtMs`、`computeSpokenPrefix`)は変えていない。
- テストで確かめたこと: 本物の運び手で、Playing の 500ms 後に割り込んだ。
  - `stoppedActive.startedAtMs` は Playing + 100 だった。
  - `computeSpokenPrefix` の結果は、遅れなしなら 5 文字、遅れありなら 4 文字。少なめに数える側に寄る。

## 8. ENDED・STARTED の見張りとの関係

`src/discord/discord-streamer-watch-discord-e.test.mjs` で、本物の運び手(見張りの値は変えていない: STARTED 5 秒、ENDED は started + 長さ + 750ms)、Discord 向けの再生器、偽の時計、20ms ずつ進める偽の AudioPlayer を組んで確かめた。

| 場面 | 結果 |
|---|---|
| 合成が実時間より速い(途切れなし) | すぐ started。鳴り終わって ended。見張りに引っかからず完了 |
| 合成が遅れて 500ms 途切れた | 途切れの間は無音(Idle にならない)。完了 |
| 合成が遅れて 1 秒途切れた | **ENDED の見張り(`player_end_timeout`)で打ち切られる**(限界の確かめ) |
| 相手が Ready でない(AutoPaused)まま | started は出る(STARTED の見張りには引っかからない)。戻らなければ ENDED の見張りで打ち切られる |
| 相手が 300ms だけ Ready でなかった | 戻れば続きを鳴らして完了 |
| 再生器を畳んだ(場を閉じた) | 進行中の発話は `stopped` ですぐ世代を閉じる。見張りのタイマーは残らない |

- **started の遅れ 100ms と、無音の詰め物 100ms は打ち消し合う**。ENDED は「Playing + 長さ + 詰め物 100ms + 1〜2 周期」に来て、見張りは「Playing + 100 + 長さ + 750」に鳴る。
- そのため、合成の遅れによる途切れの合計が**およそ 700ms 以内**なら間に合う。これを超えると打ち切られる。
- これは手元の再生器でも同じ形の限界(運び手の見張りの式は共通)。Discord で途切れが出やすいか(ElevenLabs の届き方)は実機で見る(§14)。

## 9. D からの直し 2 つ

### (a) 形の合わない `discordBotKeyFile` は入口で断る(設計 §5)

- **`role-store.mjs`**
  - 書いてあるのに形が合わない値(`undefined` と `null` 以外)について:
    - 値は持たない。
    - 印 `discordBotKeyFileInvalid: true` だけを持つ。
  - `roleDiscordBotKeyFileRefused(role)` を足した。印があり、形の合う名前が無ければ true。
  - `roleDiscordBotKeyFile` は今どおり既定を返す(D の期待値のまま)。
  - 書き戻し(`roleToJson`・`writeRole`)では、印を `"discordBotKeyFile": ""`(形の合わない値)として書く。
    - そのため、画面での編集(`applyRolePatch`)・写し(`copyRoleAs`)・読み直しを経ても断るまま。黙って既定の鍵に戻らない。
    - 元の値は書き戻さない(パスや鍵を含みうるため)。
  - 印の無いロールの形と書き戻しは今と同じ。
- **入口**
  - `createVenueRoleBundle` に `discordBotKeyFileRefused()` を足し、main から `roleDiscordBotKeyFileRefused(roleHooks.current())` を渡す。
  - `prepareEntrance` は、鍵を読む前に印を見る。印があれば `DISCORD_REASONS.keyFileName` で断る(ログインしない・場を開かない)。
  - 文面: 「ロールの role.json の discordBotKeyFile が使えない(apps/soul/agent/ 直下の .env.discord*.local の名前だけ・項目を消せば既定 .env.discord.local)」。**値はそのまま出さない**(§12)。
- `role.json` に項目が無いとき(と `null`)は、今どおり既定 `.env.discord.local`。テストで確かめた。
- **テスト**
  - role-store: 9 種の形の合わない値で、印が付き断ること。書き戻し・編集・写し・読み直しを通して断るまま。元の値がファイルに残らない。手で直せば通る。
  - 本物の server: 断ったときは鍵を読みに行かない・ログインしない・理由に `C:/keys` が出ない。項目が無ければ既定の鍵で入る。
- **残り**: 一覧の読み込み(`catalog`)は今も既定の鍵で読む(質問 1)。

### (b) ログイン中に `closeEntrance` されたら Bot を destroy

- ログインの直後に `if (s.closed) { await destroyClient(s.client); return refuse(closed); }`。
- テスト: login を門で止めた偽の Client で、ログイン中に `closeEntrance` → 門を開ける。結果、理由は「閉じた」、`destroyedClients = 1`、VC には入らない。
- **直しを外すと同じテストが `destroyedClients = 0` で落ちる**ことを、一時的にその 1 行を外して確かめ、元に戻した。
- 対照のテスト: 部品の読み込み中に閉じたらログインしない。VC に入る途中で閉じたら接続とログインを畳み、待ちが止まらないことはない。

## 10. 配信が変わっていないことの確かめ方

- 既存の 2050 件が全部そのまま通る(既存テストのファイルの差分は 0)。配信の server・cockpit・運び手・手元の再生器・orchestrator のテストを含む。
- 固定テスト `stream-wording-pin` と fixture の差分は 0。`src/mind/`・`skills/`・`src/voice/` の差分も 0(運び手と手元の再生器は変えていない)。
- main の作り分けは、差し口が空なら今の道そのもの:
  - `activePlayer()` は `player`。
  - `ensureVoiceResources` の早い戻りは差し口がある時だけ。
  - `playerProxy` の返り値も同じ。
- ソースの並びのテスト(`scripts/cockpit-discord-e.test.mjs`)で、早い戻りの条件と `acceptedPlayer = activePlayer()` を固定した。
- B・C・D の main の結線の固定テストも全部通る。

## 11. 守りの決まりの確かめ方

- **鍵**: `.env*.local` を読む・存在を確かめるコマンドは走らせていない。テストの鍵は `loadToken` の差し替え(偽の値)。新しいコードに `process.env` への代入は無い。
- **id**: 新規ファイルと追加行に 15 桁以上の数字は無い(grep で確認)。テストの ID は `guild-fake-1`・`channel-fake-1`・`user-fake-a` などの明らかな偽の値。
- **ログと理由**: 再生器の診断(`onTrace` → main では `fireDiagnostics.record("player.discord", { marker })`)は事象の種類だけ。Discord の id・名前・本文は入らない。体験の口に足したログは `outlet ready` / `outlet failed` だけ。理由の文面は決まった日本語で、値・生のエラー文を入れない。テストでは、投げた文面に入れた偽の鍵がログに出ないことを確かめた。
- **声**: ファイルに保存しない。再生器は流れに書くだけ。新しい実装に `writeFile` / `createWriteStream` は無い。偽物は受け取ったバイトをメモリに数えるだけ。
- **実データ**: テストの設定・ロールは全部 OS の一時フォルダ(`mkdtempSync(tmpdir())`)で、終わったら消す。
  - 実データの mtime は私の作業より前(`cockpit-settings.local.json` 08:24、`memories/`・`roles/` は 10-31)。中身は読んでいない。
  - `apps/soul/agent/tmp/` は元の 2 つだけ。
- **Discord の部品**: `discord-stream-player.mjs` は @discordjs/voice を import しない(束を引数で受け取る)。D の静的・実行時の import の木のテストがそのまま通る。
- **外部**: 本物の Discord・LLM・外部 API は呼ばない。`~/.codex/sessions` には触れていない。

## 12. 裁量

1. **出口はロールの束(`voice.openOutlet`)から引く**。
   - D の main のテストが `createDiscordVenueExperience({ settings, currentKeyFile, write })` の 3 行を固定しているので、`outletFactory` をそこへ足さなかった。
   - 設計 §5「再生器はロールごと・Bot の接続ごと」にも沿う。`deps.outletFactory` は今も優先して効く。
2. **出口を作れなければ場を開かない**(`DISCORD_REASONS.outlet`)。D は「ログだけ出して続ける」だったが、そのままだと声が黙って手元のスピーカーから出るため。
3. **`dispose` で、鳴っている発話に `stopped` を出す**。手元の再生器は dispose で事象を出さないが、場の閉じで運び手を最大 5 秒待たせないため。`stop()` は dispose の後も投げない(キル・割り込みの声止めを落とさない)。
4. **stop の強さ**: Playing は余韻つき(公式の止め方)。Buffering と AutoPaused はすぐ Idle(余韻を送れない状態で固まらないため)。
5. **音の無い発話**は鳴らさずに `ended` だけ(本物は空の流れでも Playing を経るので、STARTED を出さないために自前で扱う)。
6. **end で 20ms の倍数まで無音で埋める**(Encoder の端数の捨てを防ぐ)。
7. **変換の方式**: 整数分の 1 は繰り返し(設計の 24k の指定を一般化)、それ以外は線形の補間。
8. **数値**: `maxMissedFrames` は 75(1.5 秒)、`startedDelayMs` は 100ms(0〜2000 に丸める)。
9. **形の合わない鍵のファイル名の扱い**:
   - 印だけを持ち、値は持たない。`null` は「書いていない」と同じ。
   - 書き戻しは `""`。元の値は消える(ユーザーは理由を見て `role.json` を直す)。写しも断るまま。
   - 理由の文面にはファイル名の値を出さない(パス・鍵を含みうるため)。
10. **AutoPaused でも、Playing になった時点で `started`** を出す(設計の表のまま。§14)。
11. **偽の Discord の拡張は新しいファイル**(`fake-discord-audio.mjs`)に置き、`fake-discord.mjs` には足すだけ。
12. **G が使う snapshot の項目は足していない**。出口の状態は snapshot に載せず、`stream.connection` と `stream.error`(`outlet`・`keyFileName` の理由)で足りる見込み。

## 13. 質問(Orch-Sylph / Undine へ。どれも止める理由ではない)

1. **一覧の読み込み(`POST /api/discord/catalog`)は、形の合わない `discordBotKeyFile` でも既定の鍵でログインする**。
   - 入口は断るようにしたが、一覧の読み込みは `createDiscordVenueExperience` の `currentKeyFile`(`roleDiscordBotKeyFile` = 既定)を使う。
   - 直すには、main のその呼び出しに 4 つ目の口(例 `currentKeyFileRefused`)を足す必要がある。D の結線のテストの正規表現(3 行を固定)の期待値を 1 か所変えることになるので、今回はしなかった。
   - 一覧は読むだけだが、別の Bot のサーバーが並ぶ。G で画面の一覧を作るときに直す(テストの 1 行の変更を認める)か、今のままにするか。
2. **ENDED の見張りの限界**(§8): 合成の遅れによる途切れの合計がおよそ 700ms を超えると、その文は打ち切られる。
   - 手当ての案:
     - (i) 再生器の側で、鳴らし始める前に少し溜める(遅れが増える)。
     - (ii) 運び手の `playbackCompletionMarginMs` を Discord のときだけ大きくする(orchestrator が運び手へ渡す口が要る = orchestrator に手が入る)。
   - 推奨: 人間ゲート 2 で打ち切り(`player_end_timeout` の診断)が出るかを見てから決める。
3. **`startedDelayMs` の替え方**: 今はコードのオプションだけ(main の `createVenuePlayerSlot({ startedDelayMs })`)。人間ゲート 2 で言い直しの重なりを見て調整するなら、そのときにコードの値を替えるので足りるか、設定の口(G の画面・`cockpit-settings.local.json`)が要るか。

## 14. 人間ゲート 2 で見る所(偽物で確かめきれない所)

1. **VC でチャッピーの声が聞こえ、手元のスピーカーからは出ない**こと。
   - 声の速さと高さが正しいか(ElevenLabs 24k、AivisSpeech 44.1k などの WAV のレート)。
   - 音量。
   - Discord の「話している」の表示。
2. **44.1k → 48k の線形の補間の音質**(こもり・ざらつき)。気になれば別の変換を考える。
3. **AutoPaused と見張り**: 接続が Ready でない間(つなぎ直しの途中など)に話し始めると、started は出るが鳴らない。戻らなければ ENDED の見張りで打ち切られる。そうなる場面があるか。
4. **ElevenLabs の届き方で途切れが出るか**: 長い文で、途中の無音の間や打ち切り(ターミナルの診断 `speech.playback.completion_timeout` / `player_end_timeout`)が出ないか(質問 2)。
5. **割り込み**: 止まるまでの速さ(余韻 100ms)。言い直しの重なりが気になるか(遅れ 100ms で足りるか・質問 3)。
6. **KILL** で声が止まる。
7. **VC から抜けたあと配信を始めると、手元のスピーカーから今までどおり鳴る**こと(差し口が空に戻る)。
8. **Discord の場の間に手元の再生器の常駐(PowerShell)が新しく起きない**こと(main の作り分けはソースの並びでしか固定できていない)。
9. **opusscript でのエンコードの重さ**(メインスレッドで同期に走る)。声が詰まらないか。
10. **形の合わない `discordBotKeyFile` の断りの文面**の見え方(G の画面)。一覧の読み込みの扱い(質問 1)。
11. 出口を作れなかったときの文面(`outlet`。ふつうは出ない)。
12. ターミナルの `[cockpit] discord:` の行(`outlet ready` が増えた)に名前や id が出ていないか。

## 15. G が使う snapshot の項目

- **足していない**。G は D の §11 の項目(`stream.experience`・`stream.connection`・`discord`)と、`stream.error` の理由の文面(`DISCORD_REASONS.keyFileName`・`DISCORD_REASONS.outlet` が増えた)を使う。
