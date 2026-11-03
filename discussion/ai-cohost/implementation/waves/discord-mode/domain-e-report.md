# Domain E 完了報告 — Discord の出口(Orch-Sylph 2026-11-01)

> 判定: **pass**(ループ 1 回・止めた指摘 0・Review-Sylph が合格)。
> 計画: [../../orchestration/discord-mode-wave-plan.md](../../orchestration/discord-mode-wave-plan.md) §1 Domain E。
> 実装: Gnome(opus)→ [domain-e-gnome.md](domain-e-gnome.md)。レビュー: Review-Sylph(sonnet)→ [../../reviews/discord-mode/domain-e.md](../../reviews/discord-mode/domain-e.md)。
> コミットはしていない(ブランチ `ai-cohost/discord-mode`、HEAD `1f1188a4`)。鍵(`.env*.local`)は誰も読んでいない。実データには触れていない(レビューが mtime で確認)。本物の Bot はログインさせていない。操縦席は起動していない。依存・lockfile の変更なし。`apps/soul/agent/tmp/` は元からの 2 つだけ。

## 1. 機械ゲート

| ゲート | 結果 |
|---|---|
| `apps/soul/agent` で `node --test` | **2099 / 2099 pass**(2050 から +49)。Gnome とレビューの両方で実行 |
| 根で `pnpm run check:soul-zone` | pass(1599 files) |
| 固定テスト `stream-wording-pin` | 36/36 pass。fixture・`src/mind/`・`skills/`・`src/voice/` の差分 0 |
| 既存テストファイル | 差分 0(期待値の変更 0) |
| 依存・lockfile | 差分 0 |
| 本物の Discord・LLM・外部 API | 呼ばない |

## 2. 変更ファイル(`apps/soul/agent/` 起点)

- 変更(4 本): `scripts/cockpit.mjs`、`src/discord/discord-experience.mjs`、`src/roles/role-store.mjs`、`src/test-support/fake-discord.mjs`(足しただけ)
- 新規の実装: `src/discord/discord-stream-player.mjs`(`createDiscordStreamPlayer`)、`src/discord/discord-pcm48.mjs`(48k ステレオへの変換)
- 新規のテスト部品: `src/test-support/fake-discord-audio.mjs`(本物 0.19.2 の AudioPlayer の状態の動きを 20ms ずつ写した偽物)
- 新規のテスト(6 本): `src/discord/discord-pcm48-discord-e.test.mjs`、`src/discord/discord-stream-player-discord-e.test.mjs`、`src/discord/discord-streamer-watch-discord-e.test.mjs`、`src/discord/discord-experience-discord-e.test.mjs`、`src/roles/role-store-discord-e.test.mjs`、`scripts/cockpit-discord-e.test.mjs`

## 3. 期待値を変えた既存テスト

- **0 件**。既存テストのファイルには触れていない。

## 4. 再生器の形と接続への結び方

- 口は手元の再生器と同じ `open / write / end / stop / onEvent` + `isAlive / dispose / whenReady / current`。事象は `{ type, id, atMs }`。
- 作るとき `createAudioPlayer({ behaviors: { noSubscriber: Pause, maxMissedFrames: 75 } })` → `connection.subscribe(player)`。発話ごとに `PassThrough` 1 本と `StreamType.Raw` の resource 1 つ。@discordjs/voice は引数の束で受け取る(再生器自身は import しない。D の import の木のテストはそのまま通る)。
- `stop()`: Playing は `player.stop()`(余韻 100ms)、Buffering・AutoPaused は `stop(true)`(本物の `stop(false)` は Buffering で固まることをレビューが本物のソースで確認)。
- 結び方: VC が Ready になった直後(D の置き場)に出口を作る。`deps.outletFactory` があれば優先、無ければその場のロールの束の `voice.openOutlet`(`group` と同じ id のロール)。閉じるときは耳の束の後・`connection.destroy()` の前に `dispose()`。
- 配信との作り分け(cockpit.mjs): 差し口 `createVenuePlayerSlot()`。`activePlayer() = venuePlayers.current() ?? player`。Discord の場では `ensureVoiceResources` が手元の再生器(常駐 PowerShell)を起こさず、`acceptedPlayer` と `playerProxy` は Discord の再生器を使う。閉じれば差し口は空に戻り、次の配信は手元の再生器で鳴る。
- 閉じる順(テストで固定): 声を止める → 目 → 正本・耳の束 → 入口を閉じる(出口を畳む → VC を抜ける → ログアウト)→ 頭のセッション。鳴っている発話は畳む所で `stopped` が出て、運び手は見張りの時間切れを待たない。

## 5. 変換の方法(設計 §7.2)

- 48k はそのまま(モノラルは左右同値)。48k の整数分の 1(24k・16k・12k・8k)はサンプルの繰り返し。それ以外(44.1k など)は線形補間。
- 状態を持つ変換。端数のバイトを持ち越し、入出力の通し番号を整数で持つ。乱数で切ったチャンク(空・奇数バイト含む)の出力が一括変換と 1 バイトも違わないことをテストで確認。
- end で 20ms(3840 バイト)の倍数まで無音で埋める(prism-media の Encoder が端数を捨てるため)。
- 新しい依存なし(prism-media・opusscript は既存)。レビューは本物の @discordjs/voice + opusscript で 300ms の音をエンコードできることを確かめた。

## 6. Idle の落とし穴への手当て(§7.3)

- 発話ごとに 1 resource、`maxMissedFrames = 75`(1.5 秒、5〜500 で替えられる)、終わりは `end()` で明示。
- テスト: 1.2 秒の途切れは Idle にならず完了。1.5 秒超は end 前の Idle → `error`。対照として上限 5 のままでは 100ms で Idle になる。

## 7. 割り込みの計算(§7.4 の a)

- `started.atMs` = Playing になった時刻 + `startedDelayMs`(既定 **100ms**、0〜2000 に丸める)。替え方は再生器のオプション(main からは `createVenuePlayerSlot({ startedDelayMs })`。今は既定)。設定・画面の口は無し(質問 3)。
- 運び手・orchestrator の計算(`computeSpokenPrefix`)は変えていない。本物の運び手のテストで、遅れありは「少なめに数える」側に寄ることを確認(5 文字 → 4 文字)。

## 8. ENDED / STARTED の見張りとの関係

本物の運び手(STARTED 5 秒・ENDED は started + 長さ + 750ms のまま)+ Discord の再生器 + 偽の時計 + 偽の AudioPlayer で確認:

| 場面 | 結果 |
|---|---|
| 途切れなし | 完了 |
| 合成の遅れで 500ms 途切れ | 無音が流れ Idle にならず完了 |
| 1 秒途切れ | **ENDED の見張り(`player_end_timeout`)で打ち切り**。限界は合計およそ 700ms |
| 相手が Ready でない(AutoPaused)まま | started は出る(STARTED の見張りには掛からない)。戻らなければ ENDED の見張りで打ち切り |
| 300ms だけ Ready でない | 戻って完了 |
| 場を閉じた | `stopped` ですぐ世代を閉じる。タイマーは残らない |

- 限界の式は手元の再生器と共通(Discord で新たに生まれた失敗ではない)。実機で途切れが出るかはゲート 2 で見る(質問 2)。

## 9. D からの直し 2 つ

- **(a) 形の合わない `discordBotKeyFile` を入口で断る**: role-store は値を持たず印 `discordBotKeyFileInvalid` だけを持つ。`roleDiscordBotKeyFileRefused(role)` を足し、`roleDiscordBotKeyFile` は今どおり既定を返す(D の期待値のまま)。入口(`prepareEntrance`)は鍵を読む前に印を見て、`DISCORD_REASONS.keyFileName` で断る(ログインしない・場を開かない)。文面に値は出さない(パス・鍵を含みうるため)。項目が無い・null は既定 `.env.discord.local`。本物の server のテストで「鍵を読まない・ログインしない・理由に値が出ない」を固定。
  - 書き戻し(`roleToJson`・`writeRole`)では印を `"discordBotKeyFile": ""` として書く。編集・写し・読み直しを経ても断るまま、元の値は書き戻さない(裁量。下の §12 の確認 1)。
- **(b) ログイン中の `closeEntrance`**: ログイン直後に `if (s.closed) { await destroyClient(s.client); return refuse(closed); }`。門で止めた偽の Client のテストで `destroyedClients = 1`。Gnome は直しの 1 行を一時的に外すと同じテストが `0` で落ちることを確かめて戻した。レビューはテストが D のレビューの再現の形そのままであることを読んで確認。

## 10. 配信が変わっていないことの確かめ方

- 既存 2050 件がそのまま通る(既存テストファイルの差分 0)。`src/voice/`(手元の再生器・運び手)・`src/mind/`・`skills/` の差分 0。固定テスト 36/36。
- レビューが cockpit.mjs の差分を読み、配信では差し口が空なので `activePlayer()` は元の `player`、`ensureVoiceResources` の早戻りは差し口に再生器があるときだけ、`playerProxy`・`acquireAcceptedFireResources` は元と同じ道を通ることを確認。ソースの並びのテストでも固定。

## 11. 守りの決まりの確かめ方

- Gnome とレビューが独立に確認: `process.env` への代入なし、鍵を読む新しい道なし(テストは `loadToken` の差し替え)、新規ファイル・追加行に 15 桁以上の数字なし(テストの ID は `guild-fake-1` など)、声を書く所(`writeFile`・`createWriteStream`)なし、ログは事象の種類と固定文(`outlet ready` / `outlet failed`、診断は `player.discord` の marker だけ)、テストは OS の一時フォルダだけ、実データの mtime は作業前のまま、依存・lockfile 差分 0、外部を呼ばない。

## 12. 裁量(レビューは設計に反しないと評価。全項目は gnome §12)

主なもの:
1. 出口は main の `createDiscordVenueExperience` の 3 行(D のテストが固定)に足さず、ロールの束 `voice.openOutlet` から引く(設計 §5「Bot の接続ごと」にも沿う)。
2. 出口を作れなければ場を開かない(新しい理由 `DISCORD_REASONS.outlet`)。黙って手元のスピーカーから鳴る道を残さないため。
3. `dispose` で鳴っている発話に `stopped` を出す(場の閉じで運び手を 5 秒待たせない)。
4. 数値: `maxMissedFrames` 75(1.5 秒)、`startedDelayMs` 100ms。
5. 形の合わない鍵のファイル名の書き戻しは `""`(元の値は消える)。

**Undine に確認してほしい裁量 1 つ**: 上の 5。ユーザーが role.json に書いた形の合わない値は、操縦席がそのロールを書き戻した時点(画面でのロール編集・写し)で `""` に置き換わる。読むだけでは role.json は変わらない。安全側の判断で設計にも反しないが、ユーザーの手書きの値を消す挙動なので念のため。

## 13. G が使う snapshot の項目

- **足していない**。G は D の §11 の項目(`stream.experience`・`stream.connection`・`discord`)と、`stream.error` に増えた理由 2 つ(`DISCORD_REASONS.keyFileName`・`DISCORD_REASONS.outlet`)を使う。

## 14. 人間ゲート 2 で見る所(偽物で確かめきれない所)

1. VC でチャッピーの声が聞こえ、手元のスピーカーからは出ないこと。声の速さ・高さ(ElevenLabs 24k・AivisSpeech 44.1k)・音量・Discord の「話している」表示。
2. 44.1k → 48k の線形補間の音質、24k → 48k の繰り返しの音質。
3. AutoPaused と見張り: つなぎ直しの途中に話し始めたとき、打ち切りが出る場面があるか。接続が切れて戻る途中の発話。
4. ElevenLabs の届き方で途切れ・打ち切り(`player_end_timeout` / `speech.playback.completion_timeout` の診断)が出ないか(質問 2)。
5. 割り込みの止まる速さ(余韻 100ms)と言い直しの重なり(遅れ 100ms で足りるか・質問 3)。割り込み直後に次の発話が始まるときの重なり。
6. KILL で声が止まる。
7. VC から抜けたあと配信を始めると手元のスピーカーから今までどおり鳴る。
8. Discord の場の間に手元の再生器の常駐(PowerShell)が新しく起きない(main の作り分けはソースの並びでしか固定できていない)。
9. opusscript のエンコードの重さ(メインスレッドで同期)。声が詰まらないか。
10. 形の合わない `discordBotKeyFile` の断りの文面の見え方、出口を作れなかったときの文面。
11. ターミナルの `[cockpit] discord:` の行(`outlet ready` が増えた)に名前や id が出ていないか。

## 15. 持ち越し

- **G**: 一覧の読み込み(catalog)は、形の合わない鍵のファイル名でも既定の鍵でログインする(質問 1)。入口は断るので計画の追認 (2) は満たす。断りの文面の見せ方。
- **ゲート 2 のあと**: ENDED の見張りの限界への手当て(質問 2)、`startedDelayMs` の置き場(質問 3)。
- 小さな点(止めない): 場を閉じた直後に進行中の Fire が `ensureVoiceResources` を通ると手元の再生器が起きうる端の場合(レビュー指摘)。`main()` の結線はソースの並びの正規表現でしか固定できていない(前例と同じ流儀)。

## 16. 質問(Undine へ。どれも止める理由ではない)

1. **catalog の断り**: 一覧の読み込みも形の合わない鍵のファイル名で断るなら、main の `createDiscordVenueExperience` に口を 1 つ足し、D の結線テストの正規表現(3 行固定)の期待値を 1 か所変えることになる。G の最初で仕様変更として認めるか、今のままにするか。Gnome・レビュー・私とも「G で直す」を推奨。
2. **ENDED の見張りの限界(途切れ合計約 700ms)**: 手当ての案は (i) 再生器で鳴らし始める前に少し溜める(遅れが増える)、(ii) Discord のときだけ運び手の余裕を大きくする(orchestrator に手が入る)。設計 §7.3 は「起きるなら」と条件付きで、レビューも持ち越しでよいと評価。推奨はゲート 2 で打ち切りが出るか見てから決める。
3. **`startedDelayMs` の置き場**: 今はコードのオプションだけ。設計 §7.4 の a の「設定で替えられる」を、コードの値を替えることで足りるとみるか、設定ファイル・画面の口を作るか。推奨はゲート 2 で調整が要ると分かってから。
4. §12 の裁量 5(形の合わない値を書き戻しで `""` にする)を認めるか。

## 17. 起動した子

| 役 | モデル | agentId | 状態 |
|---|---|---|---|
| Gnome(実装) | opus | `ae041179068bd0a21` | 完了(domain-e-gnome.md と hand-back を受け取った) |
| Review-Sylph(レビュー 1 回目) | sonnet | `a024cc0b7ef8d27c2` | 完了(reviews/discord-mode/domain-e.md と hand-back を受け取った) |

生き残りの子は無い(どちらも SubagentHandback で終了済み)。
