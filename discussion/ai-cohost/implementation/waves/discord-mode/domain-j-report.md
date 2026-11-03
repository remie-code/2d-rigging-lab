# Domain J 完了報告 — 人が気づく出来事(Orch-Sylph 2026-11-01)

> 判定: **pass**(ループ 1 回・止めた指摘 0・Review-Sylph が合格)。ただし製品判断の質問 1 つ(§8 の 1。出来事の行だけの通話でも記憶の保存が走る)を Undine に上げる。直すなら小さい(H の範囲の数え方)。
> 計画: [../../orchestration/discord-mode-wave-plan.md](../../orchestration/discord-mode-wave-plan.md) §8 Domain J。設計: [../../../architecture/discord-mode.md](../../../architecture/discord-mode.md) §13.5。
> 実装: Gnome(opus)→ [domain-j-gnome.md](domain-j-gnome.md)(期待値の行・裁量 10 件の詳細はこちら)。レビュー: Review-Sylph(sonnet)→ [../../reviews/discord-mode/domain-j.md](../../reviews/discord-mode/domain-j.md)。
> コミットはしていない(ブランチ `ai-cohost/discord-mode`、HEAD `e983695c`)。鍵(`.env*.local`)は誰も読んでいない。実データ(`cockpit-settings.local.json`・`memories/`・`roles/`・`session-usage/`・`fire-diagnostics/`)には触れていない。操縦席の起動・本物の Discord / LLM / 外部 API の呼び出しなし。依存・lockfile・`skills/`・`_conventions.md`・②④の配信の文面の変更なし(Orch が `git diff HEAD --stat` で fixtures・固定テスト・skills・package.json・lockfile の差分 0 を確認)。

## 1. 機械ゲート

| ゲート | 結果 |
|---|---|
| `apps/soul/agent` で `node --test` | **2246 / 2246 pass**(2229 から +17)。Gnome とレビューの両方で実行。新しい 2 本と期待値を変えた 2 本を Gnome が 5 回続けて回し毎回 pass |
| 根で `pnpm run check:soul-zone` | pass(1618 files) |
| 固定テスト `stream-wording-pin` と `src/mind/fixtures/` | pass・差分 0 |
| HEAD との比較(レビュー) | `git archive HEAD` の src を scratchpad に展開し、配信の正本の疑似乱数 600 本と発火の予定 300 本を HEAD 版と今の版に通した。①の窓・②の材料と頼み・④の直近の会話と頼み・判定の入力 4 本・左の会話の欄・ログのタブ・転写バッファ・`STREAM_WORDING`・発火の予定の **11111 件で不一致 0**(発火要求 509 件も一致)。対照として `CALL_WORDING` だけが違う |

## 2. 変更ファイル(`apps/soul/agent/` 起点)

- 新規: `src/mind/venue-events.mjs`(出来事の文を作る `venueEventLineText`)、`src/mind/venue-events-discord-j.test.mjs`(11)、`src/cockpit/cockpit-server-discord-j.test.mjs`(6)。
- 実装: `src/ears/transcript-buffer.mjs`(話者の値に `"event"`・`EVENT_SPEAKER`・`isEventEntry`)、`src/cockpit/cockpit-server.mjs`(`noteVenueVcEvent` で正本に足して放送。開いた世代に結んだ `vcEvent` の口)、`src/discord/discord-experience.mjs`(`x.closed` のあとは合図しない)、`src/mind/fire-injection.mjs`・`memory.mjs`・`recall.mjs`(`event: 本文` の 1 行)、`src/mind/comment-react.mjs`・`fire-scheduler.mjs`(出来事の行を飛ばす・no-op)、`src/mind/venue-wording.mjs`(通話の語の組の説明)、`src/cockpit/view-logic/glance-timeline.mjs`・`ui/conversation.mjs`・`ui/styles.mjs`(左の欄の薄い 1 行)。
- 既存テスト: `cockpit-server-discord-d.test.mjs`・`cockpit-server-discord-i.test.mjs`・`wording-discord-f.test.mjs`(§4)。

## 3. 作ったもの(要点)

- **行の種類**: 正本の `speaker` に 4 つ目の値 `"event"`(you/soul/viewer とは別。名前と id の欄を持たない)。別の欄にしなかったのは、その欄を見ない既存の読み手が you の行として扱うため。
- **正本に足す条件**: 場が `opening` / `open` の間、かつ合図がその場の世代のもの、かつ体験が閉じていない(3 重)。閉じたあと・前の場の遅れた合図は行にも `control` にも書かれない。
- **載る所**: ①の会話の窓・②の材料・④の直近の会話に `event: 本文`。通話の語の組の材料の説明は `…、soul = 相方の AI 自身、event = 通話の中の出来事（入った・抜けたなど）。` を足した。配信の語の組は不変。
- **判定に渡さない・きっかけにしない**: 正本の購読者は場の `onAppend` 1 本で、先頭で出来事の行なら return(発火の予定にも speak-now にも回らない)。`fire-scheduler` も no-op(二重)。判定の入力はコメント反応と「避けるか」の共通部で飛ばす。speak-now の入力はもとから入らない形。barge-in は VAD だけを見る(レビューがコードで追って確認)。
- **左の「会話」の欄**: `kind: "event"` の時刻つきの薄い 1 行(時刻と本文だけ)。ログのタブは `event` のラベルの行で CSS で薄く。ほかの行の形は不変。
- **人の出入りの源**: I の `handleVoiceState` に既にあった(偽物の拡張は不要)。
- **ログ・記録**: 出来事で標準出力に何も書かない。session-usage は種類だけ(人の出入りと `vc-reconnect` は書かない)。本物の `controlUsageRecord`・`createSessionUsageLog` で一時フォルダに書き、名前・VC 名・id・文が載らないことをテスト。fire-diagnostics は頭への文をそのまま書く所が無い(数と種類だけ)。出来事の行は本文つきで放送と snapshot に載る(設計の「snapshot の外の記録には載せない」に合う。id は載らない)。

## 4. 期待値を変えた既存テスト(全部 Discord 側。配信の期待値の変更 0。削った assert 0。レビューが diff の `-` 行を全部洗って一致を確認)

| ファイル:行 | 変更 | 理由 |
|---|---|---|
| `src/cockpit/cockpit-server-discord-d.test.mjs:415-416・421・424-425` | 正本と放送の並びに「入った」の行 | 出来事の行が正本・放送に載る |
| 同 `:470-475` | 入った・人が出ていったの行 | 同上 |
| 同 `:549-550` | `saveFinal:0` → `saveFinal:1` | 開いた時の「入った」1 行で正本の件数が 0 でなくなり、最後の保存が走る(§8 の質問 1) |
| 同 `:879-886`(足しただけ)・`:953-954`・`:962`・`:989` | 本物の耳のテスト 2 本で、比べる対象を出来事の行を除いた `heardLines` に | 数と中身は不変 |
| `src/cockpit/cockpit-server-discord-i.test.mjs:322-327・343-350` | 正本に入った・抜けたの行 | 出来事の行が正本に載る |
| 同 `:550-552` | saveFinal の材料に出来事の行 | ②に載る |
| `src/mind/wording-discord-f.test.mjs:90・122・140` | 通話の語の組の speakers の全文 | 材料の説明に `event` を足した |

## 5. 出来事の行の文(全文)

| kind | 文 |
|---|---|
| `vc-join`(open・panel 共通) | `チャッピーが VC「〈VC〉」に入った` |
| `vc-leave` | `チャッピーが VC「〈VC〉」から抜けた` |
| `vc-move` | `チャッピーが VC「〈前〉」から「〈VC〉」に移った` |
| `vc-moved` | `チャッピーが VC「〈前〉」から「〈VC〉」に動かされた` |
| `vc-kicked` | `チャッピーが VC「〈VC〉」から外された` |
| `vc-disconnect` | `チャッピーの VC「〈VC〉」への接続が切れた` |
| `vc-reconnect` | `チャッピーの VC「〈VC〉」への接続が戻った`(切れたと知らせたときだけ。短い途切れでは出ない) |
| `person-join` | `〈名前〉が入ってきた` |
| `person-leave` | `〈名前〉が出ていった` |

- 主語「チャッピー」はロールの名前から取る(無ければ「相方の AI」)。VC 名が無ければ「VC に入った」の形。人の名前が無ければ「誰か」。知らない種類は行にしない。①②④では頭に `event: ` が付く。

## 6. 裁量(Gnome。レビューはどれも設計に反しないと評価)

- 行の種類を `speaker` の値にした(上記の理由)。主語はロールの名前。①のラベルは `event:`。
- `vc-moved` は「動かされた」(設計の例は「移った」。文言だけの違い)。
- `vc-disconnect` / `vc-reconnect` も行にした(`vc-disconnect` は設計の「外から切られた」に当たる)。
- 開いた世代の結びは `control` にも効く(前の場の遅れた合図は `control` にも書かれなくなった。I の持ち越しの解消)。
- 出来事の行だけでも①の窓が空でなくなるので、手動の Fire は ask する(設計の「出来事に反応させたいときは手動の Fire で足りる」に合う)。
- 入ったときにもういる人は行にしない(設計は出入りだけを挙げる)。

## 7. 持ち越し(止めない)

- 出来事の行が途中保存の「転写が増えた」に数えられる。snapshot の `appended` の件数にも数えられる(害は小さい)。§8 の質問 1 と同じ根。
- ①の教え(`skills/venue-discord.md`)に `event:` の説明が無い(②④は語の組にある)。頭が読み違えないかは人間ゲート 3 で。
- I の質問 1(抜けた瞬間の「（遮られた）」の注記)が「抜けた」の行と並んで見える。見え方は人間ゲート 3。
- 本物の Discord での合図の順と左の欄の見え方は人間ゲート 3 / K。

## 8. 質問(Undine へ)

1. **【製品判断】出来事の行だけの通話でも、最後の保存と途中保存を走らせてよいか。** 保存の要否を正本の件数で見ている(`scripts/cockpit.mjs` の `shouldSkipMemoryCheckpoint`)ので、入って誰も話さず抜けただけの通話でも②の LLM が 1 回走り、「入っただけ」の記憶ができうる(D の `saveFinal:0→1`)。配信は不変。直すなら保存と途中保存の数え方を出来事の行を除いた件数にする(小さい。H の範囲)。Orch は止めずに pass として上げる(設計に書いていない分岐で、どちらでも設計に反しないため)。
2. `vc-moved` の語は「動かされた」のままか、設計の例どおり「移った」に揃えるか(揃えるなら 1 か所 + テストの全文 2 か所)。
3. ①の教え `skills/venue-discord.md` に `event:` の行の説明を 1 行足すか(委任の決まりで変えていない)。
4. VC に入ったときにもういる人を出来事の行にするか。

## 9. K への申し送り(左の欄の出来事の行の見せ方)

- 左の「会話」の欄: `view-logic/glance-timeline.mjs` が出来事の行を `kind: "event"` の項目にし、`ui/conversation.mjs` が時刻と本文だけの薄い 1 行で描く(話者のラベル・名前の欄なし。CSS は `ui/styles.mjs`)。推論の範囲(`cohost` の範囲)に入る。ログのタブ(`rows.mjs`)は `event` のラベルの行で薄い。
- K は左の欄の形を変えない(計画 §8 K)。パネルの「入る / 抜ける / 移る」で出来事の行が正本に出る(`via: "panel"` も文は `vc-join` と同じ)ので、パネルの操作とこの行が並んで見えることを K の確かめと人間ゲート 3 で見るとよい。
- 出来事の行は snapshot と放送に本文つきで載る(id なし)。

## 10. 子エージェントの閉域

| 役 | agentId | 状態 |
|---|---|---|
| Gnome(opus) | `aafbd103f23c99b77` | 完了(SubagentHandback で報告・成果物 `domain-j-gnome.md`) |
| Review-Sylph(sonnet) | `a8a50d1fcd4661e67` | 完了(SubagentHandback で報告・成果物 `reviews/discord-mode/domain-j.md`。scratchpad の比較用ファイルのみ、worktree なし) |
