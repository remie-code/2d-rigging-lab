# Domain F 完了報告 — Discord の判定と言葉(Orch-Sylph 2026-11-01)

> 判定: **pass**(ループ 1 回・止めた指摘 0・Review-Sylph が合格)。
> 実装: Gnome(opus)→ [domain-f-gnome.md](domain-f-gnome.md)。レビュー: Review-Sylph(sonnet)→ [../../reviews/discord-mode/domain-f.md](../../reviews/discord-mode/domain-f.md)。
> コミットはしていない(ブランチ `ai-cohost/discord-mode`、HEAD `53ddb597`)。鍵(`.env*.local`)・実データ(`cockpit-settings.local.json`・`memories/`・`roles/`)には誰も触れていない(レビューが mtime で確認)。`_conventions.md`・種のファイル(`src/memory/` の差分 0)・依存・lockfile の変更なし。操縦席は起動していない。本物の Discord・LLM・外部 API は呼んでいない。

## 1. 機械ゲート

| ゲート | 結果 |
|---|---|
| `apps/soul/agent` で `node --test` | **2127 / 2127 pass**(2099 から +28。Gnome とレビューの両方で確認) |
| 根で `pnpm run check:soul-zone` | pass(Gnome とレビューの両方) |
| 固定テスト `src/mind/stream-wording-pin.test.mjs` と fixture 3 本 | 36 / 36 pass。HEAD との差分 0(Orch-Sylph も `git diff HEAD --stat` とテストの再実行で確認) |

新規テスト: `src/mind/wording-discord-f.test.mjs`(15)、`src/cockpit/cockpit-server-discord-f.test.mjs`(9)、`scripts/cockpit-discord-f.test.mjs`(4)。

## 2. 変更ファイル(`apps/soul/agent/` の下)

- 変更(実装): `src/mind/venue-wording.mjs`、`src/mind/speak-now.mjs`、`src/mind/recall.mjs`、`src/mind/recall-desk.mjs`、`src/cockpit/cockpit-server.mjs`、`src/discord/discord-experience.mjs`
- 新規(実装): `skills/venue-discord.md`
- 変更(既存テスト): `scripts/cockpit-discord-d.test.mjs`、`src/cockpit/cockpit-server-discord-c.test.mjs`、`src/mind/memory.test.mjs`(題名だけ)
- 新規(テスト): 上の 3 本

## 3. 期待値を変えた既存テスト(2 ファイル 5 行。配信の期待値は 0)

| 所 | 変更 | 理由 |
|---|---|---|
| `scripts/cockpit-discord-d.test.mjs:75-77` | Discord の口の `wording`/`teaching`/`judgeSet` が null → 通話の語・`venue-discord`・`speakNow`+`recallAvoid` がある | D は「F まで null」を固定していた。F で中身を置いた(計画 §1 F) |
| `src/cockpit/cockpit-server-discord-c.test.mjs:207` | `normalizeVenueWords({judgeSet:{}}).judgeSet` が `{speakNow:null}` → `{speakNow:null, recallAvoid:null}` | 判定の組に `recallAvoid` が増えた |
| `src/cockpit/cockpit-server-discord-c.test.mjs:214` | 「知らない項目は断る」の例を `recallAvoid` → `commentReact` | `recallAvoid` が知っている項目になった。テストの趣旨は不変 |

題名だけ直した(C の持ち越し・期待値は不変): `src/mind/memory.test.mjs:58`(名前のある行 = viewer と you に名前を付ける趣旨へ)。`src/mind/venue-wording.mjs` の頭のコメントのテストのファイル名も `wording-discord-c.test.mjs` に直した。

## 4. 通話の語の組(`CALL_WORDING`、`src/mind/venue-wording.mjs`)

| 項目 | 通話 | 配信(不変) |
|---|---|---|
| `keeper` | 相方の AI の記憶の置き場 | 配信の相方 AI の記憶の置き場 |
| `venue` | 通話 | 配信 |
| `transcriptKind` | Discord の通話の文字起こし | 配信の文字起こし |
| `speakers` | you = 通話で話す人（括弧の中はその人の名前）、soul = 相方の AI 自身。 | you = 配信者、soul = 相方の AI 自身、viewer = 視聴者のコメント。 |
| `records` | 過去の配信や通話の記録 | 過去の配信の記録 |
| `partner` | 通話の相手 | 配信者 |
| `conventionsNote` | 決まりの中の「配信」は、通話にも同じように当てはめて読む。 | (空) |

- `assertVenueWording` を通る(テストで固定)。viewer の説明は外した。
- `conventionsNote` は手順 1 の `。` の直後に空白も改行も入れずにつなぐ。②④の頼みの手順 1 は `` 1. `_conventions.md` を読む。決まりの中の「配信」は、通話にも同じように当てはめて読む。 `` になる(テストで固定)。②④の固定の指示には出ない。

## 5. Discord の判定の問い(要旨。全文は Gnome 報告 §5)

- `DISCORD_SPEAK_NOW_QUESTIONS`(`src/mind/speak-now.mjs`)。C の差し口の 5 項目を全部持つ。
- 問い: 「Discord のボイスチャンネルの通話にいる相方の AI「{名前}」として、参加者の発言をここまで聞いた今、どう反応するのが自然か？ 参加者の話がまだ途中なら待ち、話し終えていればどう反応するかを選ぶ。」(性格の 1 文は配信と共有)
- 入力の you の行のラベルは「参加者」(`参加者(たろう): …`、名前が無ければ `参加者: …`)。整形の関数は配信と共有。
- 選択肢は配信と同じ 5 つ(待つ・相槌・応答・自発・画面を見る)。「配信者」の入る待つ・応答の説明だけ替え、待つに「参加者どうしのやりとり」を足した。相槌・自発・画面を見るは配信の文のまま。
- 相槌の内部指示: 「今は通話の相手の話に相槌を打つタイミング。」
- 名前を呼ばれたかで器が判定を飛ばす道は無い(名前の照合は発火の予定の中にしか無く、Discord では予定を作らない)。「名前を呼ばれても判定が待つなら発火しない」を部品とサーバの両方でテスト。コメント反応の問いは作っていない。

## 6. 思い出しの「避けるか」の差し口

- 形: `judgeSet.recallAvoid = { buildInstructions(name), buildInput(entries, { request, summary, nowMs, soulName, windowMs? }) }`。`resolveRecallAvoidQuestions` は speak-now と同じ決まり(null は配信の組、欠けた項目は配信で埋める、型の違い・知らない項目は TypeError)。predicate の形・しきい値・答えの読み方は共有。
- 渡り方: 体験の口 → `normalizeVenueWords`(`recallAvoid` を受け付けて確かめる)→ サーバの `makeRecallDesk`(始める 3)→ `createRecallDesk({ recallAvoid })`。
- Discord の文面: 「Discord のボイスチャンネルの通話にいる相方の AI「{名前}」が、少し前に自分で頼んで、過去の配信や通話の記録から思い出した内容がある。」+ 配信と共有の後半。入力は you に名前を付ける(`参加者(名前): …`)。
- 配信の文面は不変(HEAD の文を書き写して比べるテストも足した)。配信の入力は名前を付けないまま(A の追認 (2))。

## 7. `skills/venue-discord.md` の全文

```
---
name: venue-discord
description: 今は Discord のボイスチャンネルの通話にいること（Discord の場でだけ、魂が会話のセッションの固定の指示の最後に足す）
---
今は配信ではなく、Discord のボイスチャンネルで通話をしています。
- 話す相手は、通話に入っている人です。会話の `you(名前)` の名前が、その発言をした人の名前です。
- 配信ではないので、視聴者もコメントもありません。
```

- Discord の口の `teaching: venueTeachingName("discord")` で選ばれ、①の固定の部分の最後に足される。ファイルがあること・本文の全文・警告なしで読めること・最後に足されること・配信では足さないことをテストで固定。配信の `FIRE_SYSTEM_PROMPT` は不変。

## 8. speak-now の固定と G が使う snapshot

- 仕組み: サーバの `venueFixesSpeakNow()`(開いている場の体験が `"discord"` か。開きかけ・閉じかけを含む)と `effectiveSpeakStartMode()`。speak-now の `isActive` はこれを見る。ロールの方式 `speakStartMode` は読まず、書き換えない(閉じればロールの方式に戻る)。配信は今まで通り。
- Discord の場の間の `POST /api/speak-start`: **409** で断り、何も変えない(ロールの保存値を書かない)。文面 `DISCORD_SPEAK_START_FIXED_MESSAGE` = 「Discord の通話では話し始めは speak-now に固定（替えられない）」(export 済み)。
- **snapshot(G 用)**:

| 項目 | 配信の場・閉じている間 | Discord の場 | 発火の予定が無い |
|---|---|---|---|
| `speakStart`(既存) | ロールの方式 `"classic"` / `"speak-now"`(今まで通り) | `"speak-now"` | null |
| `speakStartFixed`(新規) | `false` | `true` | null |

## 9. 自発の予定を作らないことの確かめ方

- 仕組み: 開く段 3 で、配信は `renewFireScheduler()`、Discord は `parkFireScheduler()`(畳んだまま)。畳んだ予定はタイマを張らず、ON/OFF と口数の置き場としてだけ働く。自発のつまみは speak-now の `isActive` が読むので「判定で話し始めるか」の ON/OFF になる。
- テスト(`cockpit-server-discord-f.test.mjs`、本物の `createFireScheduler` + 偽の時計): Discord(ロールの方式は従来)で開いても予定を作り直さず、2 人の VAD・転写(名前の呼びかけ入り)・自発の OFF→ON・30 分進めても、タイマ 0 本・予定からの発火の頼み 0。配信(従来・speak-now の両方)は今まで通り予定を作り沈黙のタイマが張られて発火を頼む。自発 OFF の間は判定しない。Gnome は直しを外すと 9 件中 5 件が落ちることを確かめた。

## 10. 同じ日の配信と通話のファイル名

`scripts/cockpit-discord-f.test.mjs`(一時フォルダ、本物の `resolveStreamRecordBaseName` 経由)で、**場ごとに別になる**ことを確認。配信が先なら 配信 `2026-11-01`・通話 `2026-11-01-2`・次の場 `2026-11-01-3`。通話が先でも 通話 `2026-11-01`・配信 `2026-11-01-2`。

## 11. 配信の文字列が変わっていないことの確かめ方

1. 固定テスト 36 件 pass、テストと fixture 3 本は HEAD との差分 0(Orch-Sylph も再確認)。
2. 既存テストの配信の期待値の変更は 0(§3 の 5 行はどれも Discord の口・判定の組の形)。
3. Review-Sylph の独立の比較: `git archive HEAD` をスクラッチに取り出し、同じスクリプトを HEAD と作業ツリーで走らせて `cmp`。**69 項目が一字も違わない**(固定テストの全ケース、speak-now の判定の要求 3 名前 × 4 口数、思い出しの判定の問いと入力・結果の文面、`FIRE_SYSTEM_PROMPT` と既定の教え、②④の指示と頼み)。一時フォルダは削除済み、`apps/soul/agent/tmp/` には置いていない。Gnome も別に 38 項目で同じ比較をして一致。

## 12. 人間ゲート 2 で見る所

1. 通話の語の言い回し(§4)。通話のあとの記録が「通話」の記録として読め、`_conventions.md` の決まりに沿って書かれるか。
2. 同じ日に配信と通話をしたとき、通話の本体が `<日付>-2.md` など別のファイルになるか。
3. Discord の判定の文面と「参加者」のラベル: 話しかけたら返すか、参加者どうしの会話に出しゃばりすぎないか、名前を呼んだら判定が返事を選ぶか。
4. 沈黙が続いてもチャッピーから話し出さないこと(設計どおり)が物足りないか。自発のつまみ OFF で判定でも話さなくなること。
5. ①の Discord の教えが性格の指示「あなたは配信の相方です」に勝ってふるまうか(視聴者への呼びかけをしないか)。
6. 「思い出して」の①への返り(「過去の配信や通話の記録から読んだ内容」)と「避けるか」の効き。
7. (G のあと)Discord の場の間に話し始めの方式が選べない見え方。

## 13. 裁量(レビューが 8 つとも妥当と評価)

1. 固定を体験の口の項目ではなく、体験の種類 `"discord"` で決めた(口の書き忘れで Discord が配信の予定で動く道を残さない。2 つ目の体験が増えたら口の項目に移す余地あり)。
2. 予定は「畳んだまま」を ON/OFF・口数の置き場にする。
3. Discord の場の間の方式の切り替えは 409・何も保存しない。
4. snapshot は既存の `speakStart` を `"speak-now"` に + 新しい `speakStartFixed`。
5. コメント反応を Discord の場で判定しない守り(`isActive` に `!venueFixesSpeakNow()`)。設計 §8「コメント反応は Discord では作らない」に合わせたもの。**この行にはテストが無い**(手でチャットをつなぐ口が場の間も通るための守り。配信のふるまいは不変をレビューが確認)。
6. 「避けるか」の Discord の入力には名前を付ける(通話は複数人。speak-now の Discord の入力と揃える)。
7. 判定のラベルは「参加者」、①向けの相槌の指示は「通話の相手」。
8. 選択肢は配信と同じ 5 つ。共有できる説明は配信の文のまま。「避けるか」の組の形は `{ buildInstructions, buildInput }`。

## 14. 持ち越し

- **G(画面)**:
  - `src/cockpit/view-logic/glance-meters.mjs:270` の「話し始め」のメーターは `role.speakStartMode` を `speakStart` より先に読むので、このままでは Discord の場の間も「従来」と出る。G で `speakStartFixed` を見て直す。
  - `speakStartFixed === true` のとき方式を選ばせない。断りの文面 `DISCORD_SPEAK_START_FIXED_MESSAGE`。
  - Discord の場の間も `POST /api/chat/connect` が通る。画面で出さないか断るかは G で決める。
  - E の追認 (1)(4) の catalog の断り・書き戻しの直し、D からの `STREAMER_LABEL`・`chatBufferAbsent` の文面などは計画どおり G。
- **ゲート 2 のあと**: 通話の語・判定の文面・教えの言い回しの調整。
- **小さな点(止めない)**: コメント反応の守り(裁量 5)にテストが無い。付けるなら G でチャットの口の扱いを決めるときに。

## 15. 質問(Undine へ)

1. 裁量 1(固定を体験の種類で決める)をこのままでよいか。レビュー・私とも可の見立て。
2. 裁量 5(コメント反応の守り)にテストを付けないまま進めてよいか。G で `POST /api/chat/connect` の扱いを決めるときに合わせてテストを付けるのを推奨。

## 16. 起動した子

| 役 | agentId | 状態 |
|---|---|---|
| Gnome(opus、実装) | `a481a6c728ce907ed` | 完了(報告を回収済み) |
| Review-Sylph(sonnet、レビュー 1 回目) | `a669232f5e7100786` | 完了(報告を回収済み) |
