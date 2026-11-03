# Domain E レビュー — Discord の出口(Review-Sylph 2026-11-01)

> 対象: ブランチ `ai-cohost/discord-mode`(HEAD `1f1188a4`)の未コミットの作業ツリー(Gnome の Domain E)。根拠は wave 計画 §1 Domain E・§4・Status の D の追認 (2)(3)(4)、設計 §4.3・§5・§7・§10・§12.3、D 報告 §12・§15、Gnome 報告 [../../waves/discord-mode/domain-e-gnome.md](../../waves/discord-mode/domain-e-gnome.md)。
> 読み取り専任。ソース・テストは変えていない。鍵(`.env*.local`)は読まず、存在も確かめていない。操縦席は起動していない。実データには触れていない。

## 1. 判定

**pass**(止める指摘 0)。

## 2. 機械ゲート(自分で実行)

| ゲート | 結果 |
|---|---|
| `apps/soul/agent` で `node --test` | **2099 / 2099 pass**(fail 0・cancelled 0・skipped 0)。Gnome の報告と一致 |
| 根で `pnpm run check:soul-zone` | pass(1599 files) |
| `src/mind/stream-wording-pin.test.mjs` | 36 / 36 pass |
| 依存・lockfile | 差分 0(`git status` に package.json・lockfile なし) |

## 3. 止める指摘

**なし。**

## 4. 止めない指摘(持ち越し)

1. **一覧の読み込み(`POST /api/discord/catalog`)は、形の合わない `discordBotKeyFile` でも既定の鍵でログインする**(Gnome の質問 1)。`discord-experience.mjs:882` の `readToken(currentKeyFile())` が `roleDiscordBotKeyFile`(= 既定を返す)を使う。G で一覧の画面を作るときに直す。直し方: catalog の前にも `roleDiscordBotKeyFileRefused` を見て同じ文面で断る口を main の `createDiscordVenueExperience` 呼び出しに足す(D の結線テストの正規表現 3 行の期待値を 1 か所変えるので、Undine がその変更を仕様変更として追認すること)。
2. **場を閉じた直後に、進行中の Fire が `ensureVoiceResources` を通ると手元の再生器(常駐 PowerShell)が起きうる**。早戻りの条件が `venuePlayers.current() != null` で、出口を畳むと null に戻るため。閉じる順は「声を止める(Fire があれば kill)→ … → 入口を閉じる」なので通常は起きない極端な端。根拠のある再現が無いので止めない。
3. **main() の結線(手元の再生器を起こさない・`acceptedPlayer = activePlayer()`・`playerProxy`)はソースの並びの正規表現でしか固定できていない**。前例(B・C・D の main の結線テスト)と同じ流儀で、`createVenuePlayerSlot` と実 server を通す統合テストが中身を固定している。main の実走は人間ゲート 2 の項目 8 に回してある(§10)。
4. 小さな点: 再生器の `dispose()` は鳴っている発話に `stopped` を同期で出し、`stop()` は microtask で出す(時点が違うだけで運び手は両方を受けて世代を閉じる。テスト済み)。

## 5. 裁量の評価(Gnome §12 の 12 項目)

全項目、設計に反せず筋が通る。「裁量」として記録してよい。特記:

- **出口をロールの束(`voice.openOutlet`)から引く(1)**: 設計 §5「再生器はロールごと・Bot の接続ごと」に沿う。D の main の 3 行固定テストを動かさずに済む。`deps.outletFactory` を優先する形も D の置き場(D 報告 §12)のまま。
- **出口を作れなければ場を開かない(2)**: D は「ログだけ出して続ける」だったが、続けると声が手元のスピーカーから出る(Discord の場の約束に反する)。設計 §4.3 の「入れなければ場を開かずに理由を出す」と同じ扱いで妥当。入口を自分で畳むことも `experience-discord-e.test` で固定済み。
- **Buffering・AutoPaused では `stop(true)`(4)**: 設計 §7.1 は `player.stop()` と書くが、本物 0.19.2 の `stop(false)` は Buffering で `silenceRemaining` を立てるだけで `_stepPrepare` が走らず Idle にならない(`node_modules/@discordjs/voice/dist/index.js` の `stop()`・`_stepPrepare` を読んで確認)。固まらないための妥当な判断で、鳴っているときは設計どおり余韻つき。
- **音の無い発話は鳴らさず `ended` だけ(5)**: 手元の再生器と同じ(STARTED なし)。
- **20ms の倍数まで無音で埋める(6)・整数分の 1 は繰り返し、それ以外は線形補間(7)**: 設計 §7.2 の案の範囲内。
- **形の合わない鍵のファイル名は「印だけ持つ・書き戻しは `""`・元の値は消す」(9)**: 画面の編集・写しを経ても黙って既定の鍵に戻らない。値(パスや鍵を含みうる)を残さないのも §10 に沿う。`null` を「書いていない」と同じにしたのも妥当。
- **snapshot の項目を足さない(12)**: G は D の項目と `stream.error` の理由で足りる見込み。

## 6. 計画 §1 Domain E の各項目の充足

| 項目 | 実装 | テスト | 評価 |
|---|---|---|---|
| 再生器の口 `{open, write, end, stop, onEvent}` + `isAlive/dispose` | `discord-stream-player.mjs` | `discord-stream-player-discord-e.test.mjs`(15 件)。偽の手元の再生器と口が同じことも確認 | 満たす |
| D の `outletFactory`/接続への結び方 | `roleOutletFactory`・`openEntrance` の出口の段・teardown の順(耳の束 → 出口 → VC → ログアウト) | `discord-experience-discord-e.test.mjs`(group のロールを選ぶ・先頭に落ちる・dispose の順・二重に畳まない)と、実 server を通す `cockpit-discord-e.test.mjs`(閉じる順を固定) | 満たす |
| Discord の場では手元のスピーカーから出さない | `createVenuePlayerSlot`・`ensureVoiceResources` の早戻り・`playerProxy`・`acquireAcceptedFireResources` | slot のテスト・実 server で「再生器を起こす段では Discord の再生器がもうある」・main のソース並び | 満たす(main の実走はゲート 2) |
| 48k ステレオ s16le への変換 | `discord-pcm48.mjs`(copy / repeat / linear・状態を持つ) | `discord-pcm48-discord-e.test.mjs`(9 件・5 つの形で乱数のチャンク割りが一括変換とバイト一致・正弦波の長さと誤差) | 満たす |
| `maxMissedFrames` | 既定 75(1.5 秒・5〜500) | 1.2 秒の途切れで Idle にならない・1.5 秒超は end 前の Idle = error・既定 5 のままなら 100ms で Idle(落とし穴の対照) | 満たす |
| 割り込み: `started` + 決まった遅れ(§7.4 の a) | 既定 100ms(0〜2000 に丸め) | 本物の運び手で Playing の 500ms 後に割り込み、`computeSpokenPrefix` が遅れなし 5 文字・あり 4 文字(少なめ側) | 満たす(設定の口は §8 の質問 3) |
| ENDED/STARTED の見張りとの関係(偽物の範囲) | 運び手・orchestrator は無変更 | `discord-streamer-watch-discord-e.test.mjs`(8 件・本物の運び手 + 偽の時計 + 20ms ずつの偽の AudioPlayer) | 満たす |
| 確かめられない所を人間ゲート 2 に回す | Gnome 報告 §14(12 項目) | — | 満たす(§11 に過不足) |

追加の自前確認: 本物の `@discordjs/voice` の `createAudioResource(PassThrough, { inputType: Raw })` に、44.1kHz モノラル 300ms を `createPcm48kStereoConverter` で変えて書き、`resource.read()` で読んだところ、実音 15 フレーム(= 20ms × 15 = 300ms)+ 無音の詰め物 5 フレーム = 20 パケットで、本物の opusscript のエンコードが通り、`ended` になった(一時の確認のみ・ファイルは残していない)。偽物の状態の動き(Buffering → Playing・missedFrames → `stop()` → 詰め物 → Idle)も、本物の `AudioPlayer.stop()`・`_stepPrepare`・`AudioResource.readable` の読みと一致する。

## 7. D からの直し 2 つ

- **(a) 形の合わない `discordBotKeyFile` を入口で断る**: `role-store-discord-e.test.mjs`(9 種の形の合わない値で印が付く・書き戻し/編集/写し/読み直しを通しても断るまま・元の値を書き戻さない・手で直せば通る)と、実 server の `cockpit-discord-e.test.mjs`(断ったとき `tokenFiles` が空 = 鍵を読みに行かない・`logins` が空・理由に `C:/keys` が出ない・phase は closed。項目が無ければ既定の鍵で入る)で固定されている。断りの文面 `DISCORD_REASONS.keyFileName` は値を含まない。断りの判定は鍵を読む前(`discord-experience.mjs:628-637`)で、範囲は計画 Status の (2)「入口で断る」を満たす。**充足**。
- **(b) ログイン中の `closeEntrance` で Bot を destroy**: テストは login を門で止めた偽の Client で、ログイン中に `closeEntrance` → 門を開ける → 理由は `closed`・`destroyedClients = 1`・VC に入らない、を確かめる。これは D のレビューが再現した形(`destroyedClients = 0`)そのもので、直しの 1 行(`await destroyClient(s.client)`)が無ければ `1` を期待するアサーションが落ちる(`teardown` は `closed` を見て何もしないので、destroy を担う箇所は他に無い)。対照のテスト(部品の読み込み中に閉じたらログインしない・VC に入る途中で閉じたら接続とログインを畳む)もある。ソースを書き換える確認は禁止のため、テストの内容と呼び出しの経路を読んで確かめた。**充足**。

## 8. Gnome の質問 3 つへの見立て

1. **catalog が形の合わない鍵のファイル名でも既定の鍵でログインする → 持ち越し(止めない)**。根拠: 計画 Status の D の追認 (2) は「E で**入口で**断る形に直す」で、これは満たされている。catalog は読むだけで場を開かない別の道。設計 §9 は catalog を「ロールの鍵でログインして一覧を取る」と書くので、本来は断る側が望ましいが、1 ロール・読むだけの今は害が小さい。直すには D の結線テストの正規表現(`createDiscordVenueExperience({ settings, currentKeyFile, write })` の 3 行)の期待値を変えることになり、E の「期待値を変えた既存テスト 0」を保つ側に倒した Gnome の判断は妥当。**G の最初に直す**(§4-1)。止める理由 4 つのどれにも根拠を立てられない。
2. **途切れの合計が約 700ms を超えると ENDED の見張りで打ち切られる → 持ち越し(止めない)。人間ゲート 2 で見る**。根拠:
   - 設計 §7.3 の文言は「実装で試し、**起きるなら**再生器の側で溜めてから鳴らすか、余裕を注入できるようにする」。計画 §1 Domain E は「偽物で確かめられる範囲で確かめ、確かめられない所はゲート 2 の確認に回す」と明記している。偽物で限界値(約 700ms)まで測れており、実機で TTS の途切れがそこまで出るかは偽物では決められない。
   - 見張りの式(`speech-streamer.mjs` の `armCompletionTimer`: `durationMs + 750 − elapsed`)は運び手に共通で、手元の再生器でも同じ形の限界がある。Discord で新たに生まれた種類の失敗ではない。started の遅れ 100ms と無音の詰め物 100ms が打ち消し合うので、Discord 側が手元より不利になってもいない。
   - 手当て(溜めてから鳴らす・余裕の注入)は、遅れの増加または orchestrator への手入れを伴う。実機で `player_end_timeout` が出てから選ぶのが、計画の「配信のふるまいは変えない」「運び手・orchestrator は変えない見込み」と整合する。
   - ゲート 2 の確認項目(Gnome §14 の 4)に診断名(`speech.playback.completion_timeout` / `player_end_timeout`)つきで入っている。
3. **`startedDelayMs` に設定の口が無い → 持ち越し(止めない)**。根拠: 計画 §1 Domain E は「`started` の時刻 + **決まった遅れ**」で、固定の既定値と読める(計画が正)。設計 §7.4 の a の「設定で替えられる」は、再生器のオプションと `createVenuePlayerSlot({ startedDelayMs })` までは満たされている。ゲート 2 で言い直しの重なりを見て調整するのは、コードの値を 1 か所替えれば済む。設定の置き場(`cockpit-settings.local.json` か画面か)は §9 の分岐として Undine に上げる。

## 9. Undine に上げる分岐

設計に書いていない判断の分岐は**止める性質のものは無い**。急がないものを 2 つ記録する。

1. **`startedDelayMs` を設定で替えられるようにするか、置くならどこか**(設計 §7.4 の a「設定で替えられる」の「設定」の置き場)。選択肢: (i) コードの定数のまま、ゲート 2 の結果で値を替える(推奨・今の形) / (ii) `cockpit-settings.local.json` の Discord の準備に項目を足す(G の画面に出すかも含む) / (iii) 画面に出さず設定ファイルだけ。製品の判断というより運用の都合なので、ゲート 2 で調整が要ると分かってからでよい。
2. **catalog の断り(§4-1)を D の結線テストの期待値の 1 か所変更で認めるか**。G の作業の一部として、仕様変更の一覧に載せる。

## 10. 配信が変わっていないことの確かめ方と結果

| 確かめ | 方法 | 結果 |
|---|---|---|
| 配信の再生器・運び手・`src/mind/`・`skills/` の差分 | `git status --short -- src/mind src/voice skills` | 差分 0 |
| 変更されたファイルの範囲 | `git diff --name-only` | 4 本のみ(`scripts/cockpit.mjs`・`src/discord/discord-experience.mjs`・`src/roles/role-store.mjs`・`src/test-support/fake-discord.mjs`)。`src/voice/`・`src/mind/`・`skills/` は含まれない |
| 既存テストファイルの差分(期待値の変更) | `git diff HEAD --stat -- '*.test.mjs'`(出力なし)と `git status` | 既存の `*.test.mjs` の差分 0。新しいテストは全部新規ファイル(6 本)。`fake-discord.mjs` はテスト部品で、足しただけ(D の口とふるまいは変えず、D のテストは全部通る) |
| 固定テスト `stream-wording-pin.test.mjs` と fixture | 単独で実行 | 36 / 36 pass・差分 0 |
| 既存 2050 件 | `node --test` 全体 | 2099 中、既存分は全部 pass(新規 49) |
| `cockpit.mjs` の配信の道(差分を読んだ) | 下記 | 変わらない |

`cockpit.mjs` の差分の読み:

- `ensureVoiceResources`: 追加は先頭の `if (venuePlayers.current() != null) { voiceEngines.ensure(desiredTtsEngine); return; }` だけ。配信の場では差し口が常に空なので通らず、以降は元のコードそのまま。
- `playerProxy` の 5 つの口: `player` → `activePlayer()`(= `venuePlayers.current() ?? player`)。配信では `player` そのもの。`write/end/stop` は元の `player != null ? … : false` と同じ分岐を `p` に変えただけ。
- `acquireAcceptedFireResources`: `acceptedPlayer = activePlayer()`。配信では `player` と同じ(`ensureFireResources()` の後で評価される順序も同じ)。
- `createVenuePlayerSlot` と `venuePlayers.open` を呼ぶのは Discord の入口(`voice.openOutlet`)だけ。配信の入口は触らない。
- `createDiscordStreamPlayer` の静的 import は `node:stream` と `discord-pcm48.mjs` だけを引き、`@discordjs/voice` などを静的に読まない(D の「静的 import の木に Discord の部品が入らない」テストが通る)。
- 場を閉じると差し口が空に戻る(`cockpit-discord-e.test` が「閉じたら空・もう一度入れば新しい再生器」を固定)。次の配信は元の手元の再生器の道を通る。

## 11. 守りの決まりの確かめ方と結果

| 確かめ | 方法 | 結果 |
|---|---|---|
| `process.env` への代入 | 新規 9 ファイルと `git diff` の追加行を grep | なし(`process.env` の出現自体が 0) |
| 鍵ファイル(`.env*.local`)を読む新しい道 | `readFile*`・`.env` を grep | なし。`readFileSync` は `cockpit.mjs` のソースを読むテスト 1 か所と、一時フォルダの `role.json` を読むテストだけ。テストの鍵は `loadToken` の差し替え(偽の値 `fake.discord-token_…`) |
| 本物らしい ID(15 桁以上の数字) | 新規ファイルと追加行を grep | なし。ID は `guild-fake-1`・`channel-fake-1`・`user-fake-a` の偽物 |
| 声をファイルに書く所 | `writeFile`・`createWriteStream`・`appendFile` を grep | 実装には 0。`writeFileSync` はテスト 1 本(`role-store-discord-e`)が一時フォルダの `role.json` を作る所だけ。偽物は受け取ったバイトをメモリで数えるだけ |
| ログに本文・名前・id | 追加のログ・診断を読む | `say("outlet ready")` / `say("outlet failed")` は固定文。再生器の `onTrace` は事象の種類だけで、main の受け口 `(event) => fireDiagnostics.record("player.discord", { marker: event })` は `fields` を捨てる。事象の `message` と理由は決まった文面(生のエラー文を入れない)。テストで、投げた文面に偽の鍵を入れても出ないことを確認している |
| 実データに触れない | テストの置き場を読む・実行の前後で mtime を比べる | テストの設定とロールは `mkdtempSync(tmpdir())` だけ。cockpit-server の設定は既定のメモリ内(`createInMemorySettingsStore`)。`cockpit-settings.local.json`・`memories/`・`roles/` の最終更新は `node --test` の前後で同一、`tmp/` は元の 2 つだけ |
| 依存・lockfile | `git status` | 差分 0 |
| 本物の Discord・LLM・外部 API | 偽の Discord(`fake-discord.mjs` + `fake-discord-audio.mjs`)だけを使うことを読んで確認。ネットワークの呼び出し無し | なし |
| 鍵の読み取り | 私は `.env*.local` を読まず、存在確認もしていない | — |

## 12. 人間ゲート 2 で見る所の過不足

Gnome 報告 §14 の 12 項目は、偽物で確かめきれない所をほぼ網羅している。足りないと思う点を 3 つ(どれも止める理由ではない):

1. **24kHz(ElevenLabs)の「繰り返し」の音質**。項目 2 は 44.1k → 48k の線形補間だけを挙げているが、24k → 48k の繰り返し(階段状)も同じ観点(こもり・折り返しの雑音)で聞くとよい。
2. **VC の接続が切れて戻る(つなぎ直し)途中の発話**。項目 3 は AutoPaused を書いているが、「切れた」が画面に出ている間に Fire が走ったときの見え方(発話が打ち切られて場は閉じない)と、戻ったあとに次の発話が正常に鳴るかも見るとよい。
3. **割り込みの直後に次の発話が始まるとき**(`stop()` の余韻 100ms の無音と、次の `open()` の差し替えが重なる)。項目 5 の「言い直しの重なり」に含めて見る。

また、項目 8(手元の再生器の常駐が起きないこと)は main の結線がソースの並びでしか固定できていないため、ゲート 2 では実際に Discord の場の間にタスクマネージャー等で PowerShell の常駐が増えないことを確認するとよい(§4-3)。

## 13. 質問(Orch-Sylph へ)

なし。判断に迷う点は §8・§9 に書いた。止める指摘が 0 なので、次の見直しのループは不要。
