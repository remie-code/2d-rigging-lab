# Domain J レビュー — 人が気づく出来事(設計 §13.5)

> Review-Sylph(読み取り専任)→ Orch-Sylph(2026-11-01)。対象: 未コミットの差分(ブランチ `ai-cohost/discord-mode`、HEAD `e983695c`)と Gnome 報告 `waves/discord-mode/domain-j-gnome.md`。
> 判定の根拠: 設計 §13.5(正)・§13 全体、計画 §8 J・§4。鍵(`.env*.local`)・実データは開いていない。操縦席は起動していない。ソースもテストも変えていない。

## 判定: **合格**(止める指摘 0)

## 1. 適合(設計 §13.5 / 計画 §8 J)

- 正本の行の種類: `speaker:"event"`(`EVENT_SPEAKER`)。you/soul/viewer とは別。`startMs/endMs=0`・名前と id の欄なし。知らない値は今まで通り `RangeError`。適合。
- 源と種類: チャッピー自身(入る・抜ける・パネルで移る・動かされる・キック〔4014〕・接続が切れた・戻った)と今いる VC の人(入ってきた・出ていった。Bot とほかの Bot・ほかのサーバー・ほかの VC は I の `handleVoiceState` が除く)。偽の Discord を通る本物の server のテストで全種類を確認。適合。
- ①②④に載る: `fire-injection.mjs`・`memory.mjs` の `labelOf` に `event`。④の直近の会話(`formatRecentConversation`)は元から speaker を絞らず `event: 本文` で載る。Discord の語の組 `CALL_WORDING.speakers` に説明を 1 項足した(71 字、80 字の見張り内)。`STREAM_WORDING` は不変。適合。
- 左の「会話」: `glanceWithTranscript` が `kind:"event"` の行を積み、`conversationRowsView` は時刻と本文のみ(話者名・札・遅延・きっかけなし)。ほかの行の形が変わらないことはテストと下の比較で確認。適合。
- 判定に渡さない・きっかけにしない(コードで追った):
  - 判定の入力の組み立て 4 本: `buildSpeakNowInput` は you/soul/欠落しか入れない(無変更で除かれる)。`buildCommentReactInput`・`composeRecallAvoidInput`(配信用・Discord 用の共通部)は 1 行で飛ばす。判定に渡る組み立ては `getEntries` 経由のこの 3 か所で全部(`recall-desk` の `avoidQuestions.buildInput`、speak-now、comment-react)。ほかに正本の行を判定に回す所は無い(`src` の `speaker` 参照を全件 grep)。
  - きっかけ: `openVenueTranscript` の `onAppend` が先頭で `isEventEntry` なら return(発火の予定の `handleTranscript` にも speak-now にも回らない)。正本の購読者はこの 1 本だけ(耳は外から渡された正本に `onAppend` を張らない)。`fire-scheduler` 側にも `speaker==="event"` の no-op(二重化)。barge-in は VAD のみで正本を見ない。発火の流れ(orchestrator・予定の分岐)は無変更。
  - 耳の口 `makeEarTranscriptMouth` には出来事の行は来ない(耳は自分が積んだ行だけを渡す)ので二重放送・遅延ログの混入なし。
- 場が閉じたあと・前の世代の遅れた合図: `appendVenueEventLine` は `closed`/`streamPhase` が `open`/`opening` 以外なら足さない。入口に渡す口は `venueVcEventMouth(streamGeneration)` に結び、世代違いは `control` にも正本にも書かない。体験側 `emitVc` も `x.closed` なら合図しない。閉じかけ・閉じたあと・次の場(配信)を開いたあとの 3 場面を本物の server のテストで確認。`venueControlContext` の非世代の `vcEvent` は prepare/abort/close にだけ渡り、体験は `x.venue`(開いた世代の口)にしか合図しないので漏れ道ではない。
- 失敗は try/catch で握り入口を止めない。出来事の行の追加では標準出力・ログに何も書かない。適合。

## 2. 止める指摘

なし。

## 3. 止めない指摘(持ち越し)

1. 【記憶の保存を空回しにしうる】誰も話さず出来事の行だけの通話でも、記憶の最後の保存(`cockpit.mjs` の `saveFinal` は `shouldSkipMemoryCheckpoint(transcript.length, lastRecordedSeq)` の件数比較)は、開いた時の「入った」1 行のせいで走るようになった(従来は 0 行でスキップ=`writeStreamRecord` が空で `written:false`)。②の LLM が「入っただけ」の材料で 1 回走り、通話の記録が 1 つできうる。途中保存も同様(出来事だけで 20 分後に 1 回)。設計 §13.5 は出来事を「記憶の書き出しに載る」とするが、出来事だけの通話で書くかは書いていない。製品判断なので「質問」に回す。止める根拠(§4 の 4 種)には当たらない。直すなら `saveFinal`・`checkpoint` の件数を「you/soul/viewer の行だけ」にする(H の範囲)。
2. ① の `event:` ラベルには教え(`skills/venue-discord.md`)に説明が無い(②④は語の組に説明がある)。Gnome の質問 1。`skills/` は変更禁止だったので正しい扱い。実機(人間ゲート 3)で頭が `event:` の行を読み違えないか見るのがよい。
3. 出来事の行は SSE の `transcript` と snapshot の `transcripts` に本文(VC の名前・人の名前)つきで載る。設計 §13.5「ログ・snapshot の外の記録には載せない」の「snapshot の外」に合う(snapshot には載せてよい)。id は載らない(テストで確認)。
4. `bufStats.appended`(snapshot の件数)に出来事の行が数えられる。Discord のみ・画面の数字の意味が少し変わるだけで害は無い。
5. 左の欄の見え方(薄さ・狭い画面)と実際の Discord での合図の順・名前の取れ方は人間ゲート 3 / K。

## 4. 守りの決まり(§4-4)

- 鍵・環境変数: 触れていない。`discordBotKeyFile: () => ".env.discord-chappy.local"` はファイル名の文字列だけ(既存の D テストと同じ書き方、読み込みは偽の `loadToken`)。
- 実データ・id: 新しい差分に長い数字の列(id らしきもの)・`process.env` は無い。テストの id は `*-fake-*`。
- ログ・session-usage・fire-diagnostics: server は出来事の行でログを書かない。`control` は種類だけ(I のまま)。テストは本物の `controlUsageRecord` と `createSessionUsageLog` で一時フォルダに書き、ファイルと体験のログの行に名前・VC 名・id・出来事の文が無いことを確認(人の入る・出る・移る・抜ける・キックを通す)。`fire-diagnostics.mjs` は本文・名前の欄を持たない(grep 確認)。
- `_conventions.md`・種のファイル・`skills/`・②④の配信の文面・`package.json`・lockfile: 差分 0。声の保存なし。
- 変更ファイルは `apps/soul/agent/src` と Gnome 報告のみ。

## 5. 配信が壊れない(機械ゲートと HEAD との比較)

- `apps/soul/agent` で `node --test`: **2246 / 2246 pass**(fail 0・skip 0)。
- 根で `pnpm run check:soul-zone`: pass(1618 files)。
- `git diff HEAD --stat` で `src/mind/stream-wording-pin.test.mjs`・`src/mind/fixtures/`・`skills/`・`package.json`・`pnpm-lock.yaml`: 差分 0。
- **HEAD との一字比較**: worktree は作らず `git archive HEAD apps/soul/agent/src` を scratchpad に展開し(リポジトリ外・作業フォルダ、ブランチは触らない。片付けるものは無い)、HEAD 版と今の版の同じモジュールを動的 import して同じ入力を通した。
  - 入力: 疑似乱数(固定種)の配信の正本 600 本(0〜29 行、you/soul/viewer/speaker 欠落、名前の有無・空白・絵文字・改行、前後空白・改行・空・長文・`you:`/`event:` で始まる本文、appendedAtMs の有無・窓外、speakerId の有無)。各本で下を比べ、**11111 件すべて一致、不一致 0**。
    - ①の窓と増えた分(`formatFireInjection`/`Since`: maxChars・windowMs・afterSeq を振る、本文とメタ)
    - ②の材料(`formatTranscriptForDigest`)、④の直近の会話(`formatRecentConversation`)
    - 判定の入力: `buildSpeakNowInput`・`buildCommentReactInput`・`buildRecallAvoidInput`・`buildDiscordRecallAvoidInput`
    - 左の会話の欄: `glanceWithTranscript` の畳み込み後の状態、`conversationRowsView`(体験 null/stream/discord)、`glanceFromHistory`、`commentRowsView`、ログのタブの `speakerLabel`/`speakerRowClass`
    - 転写バッファ: `append` の結果・`all()`・`stats()`(例外の文言も同じ入力で一致=配信の話者では例外が出ない)
    - `STREAM_WORDING`・`resolveVenueWording`(未指定/配信)・②の書き出しの system と request・④の system と request(語の組 未指定/配信)
    - 発火の予定: 300 本(speak-now の ON/OFF 半々)の you/soul/viewer・VAD・チャット・時間の経過の列を同じ時計と乱数で通し、発火要求(509 件)と各手のあとのタイマ数・要求数が HEAD と一致
  - 対照: `CALL_WORDING` は HEAD と今で違う(期待どおり=Discord の語の組だけが変わった)。
- 配信の server 経路(`cockpit-server`)は、`venueEntranceContext` に足した `vcEvent` を配信の体験が使わないこと、`appendVenueEventLine` が配信では呼ばれないこと(配信に出来事の合図は無い)をコードで確認。配信の server のテストはすべて 2246 の中で pass。

## 6. 約束のテスト(計画 §8 J「確かめ」)

| 確かめ | テスト |
|---|---|
| 窓に載る | `venue-events-discord-j` ①(窓・増えた分)、server の「①②④に載る」 |
| ②④に載る(Discord の語の組) | 同 ②④、server の「①②④に載る」(`saveFinal` の材料 + `CALL_WORDING` で組んだ頼み) |
| 判定の入力に載らない | 純関数 5 本(speak-now 配信/Discord・コメント反応・避けるか 配信/Discord)で「出来事を抜いた入力と一字同じ」、server の判定入力 `参加者(たろう): こんばんは` |
| 判定が走らない・予定が動かない | server(出来事だけで判定 0・発火 0・予定への出来事の行 0)、`fire-scheduler` の呼びかけ/区切り/沈黙タイマ |
| 左の欄で 1 行 | glance の行・範囲・ほかの行が同じ・履歴から作っても同じ、描画と CSS、ログのタブ |
| 名前・id がログ・session-usage に出ない | server「守り」(本物の記録関数と書き手、一時フォルダ) |
| 配信の固定テスト差分 0 | `stream-wording-pin` pass・fixtures 差分 0、配信の場の server テスト |
| 遅れた合図 | 閉じかけ・閉じたあと・次の場の 3 場面 |

足りない約束は無い。テストは偽の Discord と本物の server/記録関数を通しており、外部 API・本物の鍵に触れない。Gnome の感度確認(守りを 1 つ外すと落ちる)の報告も整合する。

## 7. 期待値を変えた既存テスト(`-` 行を全件確認)

Gnome 報告 §6 の列挙と**一致**。すべて Discord の場の期待値で、配信の期待値の変更は 0。削った assert・skip は無い。

- `cockpit-server-discord-d.test.mjs`: 開いた時の「入った」が正本・放送の先頭に入る(行数 2→3 の待ち)、人が出ていった時の正本、`saveFinal:0 → 1`、本物の耳の 2 本は `heardLines`(出来事を除く)に読み替え(期待値の数・中身は不変)。
- `cockpit-server-discord-i.test.mjs`: 抜けた・入り直し後の正本、最後の保存の材料に出来事の行。
- `wording-discord-f.test.mjs`: `speakers` の全文に出来事の説明を足した 3 か所(通話の語の組)。
- どれも §13.5 の仕様変更として筋が通る。
- **`saveFinal:0 → 1`(`discord-d.test.mjs:549`)の評価**: 「誰も話さず、出来事の行だけの通話でも最後の保存が走る」というふるまいの変化に**当たる**(§3-1 参照)。理由は、保存の頼みの要否を行の件数で見ているため、開いた時の出来事の 1 行で件数が 0 でなくなる。配信は出来事が無いので不変。意図した変更ではなく副作用と見る(Gnome の報告には「材料に載る」とだけあり、保存が走るようになる点を持ち越しにも書いていなかった。途中保存は持ち越し 1 に書いてある)。止める根拠は無い。製品判断として質問に上げる。

## 8. Gnome の裁量の評価

1. **「動かされた」の語(`vc-moved`)**: 設計の例は「〈VC 名〉に移った」(動かされた場合も)。語だけ分けたもので、意味・載せる場所・判定との分離に影響しない。人にとって「誰かに動かされた」と分かる方が自然。設計に反しない(§4「筋の通る裁量」)。語を設計どおりに揃えるなら `venue-events.mjs` 1 か所とテスト 2 か所。**問題なし(質問に載せる)**。
2. **`vc-disconnect`/`vc-reconnect` を行にした**: 設計「外から切られた・キックされたときも 1 行」に `vc-disconnect`(猶予のあいだ戻らなかったとき 1 回だけ)は当たる。`vc-reconnect` は `disconnectNoticed` のときだけなので「切れた」と対で出て、短い途切れでは行が増えない(コードで確認)。設計に反しない。
3. **出来事だけで途中保存に数えられる**: §3-1 のとおり。設計に反しないが副作用あり。持ち越し妥当。
4. **出来事だけで手動の Fire が ask する**: 設計「出来事に反応させたいときは手動の Fire で足りる」に合う。
5. **入ったときにいる人を行にしない**: 設計は出入りだけを挙げており、反しない。質問 3 として Undine に上げたのは妥当。
6. そのほか(行の主語を `currentSoulName()` にする、人の名前が取れなければ「誰か」、100 字で切る、`event:` ラベル、左の行に時刻を付ける、開いた世代に結ぶ)も設計に反さず、むしろ「閉じたあと・前の場の合図で行を足さない」の確かな手当て。

## 9. 質問(Undine へ)

1. 出来事の行だけの通話(誰も話さない)でも最後の保存・途中保存を走らせてよいか。走らせない形にするなら、`scripts/cockpit.mjs` の `saveFinal`・`checkpoint` の件数(`shouldSkipMemoryCheckpoint` の入力)を「出来事を除いた行数」にする(H の範囲に触る)。現状のままだと、入って出ただけの通話に「入っただけ」の記憶が 1 件できうる。
2. `vc-moved` の語を設計どおり「移った」に揃えるか、「動かされた」を残すか。
3. ①の教え(`skills/venue-discord.md`)に `event:` の 1 行の説明を足すか(Gnome 質問 1。実機で読み違えが見えたら)。
4. 入ったときにもういる人を行にするか(Gnome 質問 3)。

## 10. 触れたもの / 触れていないもの

- 読んだ: 設計 §13・計画 §4・§8 J・Gnome 報告、差分のソース・テスト全件、`cockpit-server.mjs`・`discord-experience.mjs`・`scripts/cockpit.mjs`(保存の件数)の関連箇所。
- 作ったもの(リポジトリの外): scratchpad の比較用スクリプト `compare.mjs`・HEAD の `src` の展開(`git archive`、worktree なし)。リポジトリ内には、このレビューファイル以外を作っていない。
