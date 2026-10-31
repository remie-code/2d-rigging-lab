# Domain C — 言葉の差し口と判定の差し口 Gnome 報告

> Gnome → Orch-Sylph(2026-10-31)。計画: [../../orchestration/discord-mode-wave-plan.md](../../orchestration/discord-mode-wave-plan.md) §1 Domain C。設計: [../../../architecture/discord-mode.md](../../../architecture/discord-mode.md) §3.4・§8 の b・§4.3。
> ブランチ `ai-cohost/discord-mode`(HEAD `f7f368cb`)。コミットはしていない。鍵(`.env*.local`)・実データ(`cockpit-settings.local.json`・`memories/`・`roles/`)・`_conventions.md`・種のファイル `src/memory/conventions-seed.md` には触れていない。操縦席は起動していない。依存・lockfile の変更なし。テストの書き込みは `os.tmpdir()` の下の一時フォルダだけ(後片付けあり)。

## 1. 変更ファイル(`apps/soul/agent/` 起点)

新規(4):
- `src/mind/venue-wording.mjs` — 語の組(項目の並び・配信の語の組・形の確かめ・印の差し込み)。
- `src/mind/wording-discord-c.test.mjs` — 29 件(語の組の見張り・組み立て・recall.md の印・①の教えの口・名前つき you・②④の実行の口・思い出しの係・speak-now の問いの組)。
- `src/cockpit/cockpit-server-discord-c.test.mjs` — 8 件(体験の口の形の確かめ・venueContext・判定の組の渡り・語の組の渡り)。
- `scripts/cockpit-discord-c.test.mjs` — 8 件(保存の係の語の組・①と編集画面・ロールの束の④・main() の結線)。

変更(9):
- `src/mind/memory.mjs` — `buildWriterSystemPrompt(wording)`(`WRITER_SYSTEM_PROMPT` はその配信の値)、`buildWriterRequest({ ..., wording })`、`writeStreamRecord({ ..., wording })`、`formatDigestLine` の名前つき you。
- `src/mind/recall.mjs` — `buildRecallSystemPrompt(wording)`(`RECALL_SYSTEM_PROMPT` はその配信の値)、`buildRecallRequest({ ..., wording })`、`runRecall({ ..., wording })`、結果の 7 関数に `wording`。避けるかの判定(`recallAvoidQuestion`・`buildRecallAvoidInput`)は触っていない。
- `skills/recall.md` — 語を印 `{{records}}`・`{{partner}}` に(CRLF のまま、2 行)。
- `src/mind/soul-skills.mjs` — 印を読み込み時に差す(`listSoulSkills`/`loadSoulSkills` の `wording`)、①の教えの口(`VENUE_TEACHING_PREFIX`・`venueTeachingName`・`isVenueTeachingName`・`soulSkillNamesForVenue`)。
- `src/mind/speak-now.mjs` — 問いの組(`STREAM_SPEAK_NOW_QUESTIONS`・`SPEAK_NOW_QUESTION_KEYS`・`resolveSpeakNowQuestions`)、`buildSpeakNowInput` の `hostLabel`、`createSpeakNowController` の `questions`。
- `src/mind/recall-desk.mjs` — `createRecallDesk` の `wording`(④の job と①に渡す結果の文面へ)。
- `src/cockpit/cockpit-server.mjs` — `normalizeVenueWords`(export)、体験の口の wording / teaching / judgeSet を確かめて持つ、`venueContext()`(内部 API)、`makeSpeakNow` が判定の組を使う、`makeRecallDesk` が語の組を使う。
- `scripts/cockpit.mjs` — `venueSoulWords`・`listVenueSoulSkills`(export)、`createConversationInstructionHooks` の 5 つ目の口、`createMemoryRecorder` の `getWording`、main() の結線(②・④・①・編集画面)。
- `src/mind/memory.test.mjs` — 期待値 1 行(§3)。

## 2. テスト結果

| ゲート | 結果 |
|---|---|
| `apps/soul/agent` で `node --test` | **2011 pass / 0 fail / 0 cancelled / 0 skipped**(土台 1966 → +45: `wording-discord-c` 29・`cockpit-server-discord-c` 8・`cockpit-discord-c` 8) |
| 根で `pnpm run check:soul-zone` | pass(1580 files scanned; no 器→魂 / 魂→器) |
| `git diff --stat HEAD -- .../stream-wording-pin-expected.mjs .../stream-wording-pin-input.mjs` | 空 |
| 固定テスト `stream-wording-pin.test.mjs`(36 件) | 通る。呼び出し `-calls.mjs` も**変えていない**(既定が配信の語なので、今の呼び出しのまま同じ文字列になる) |
| 本物の LLM・外部 API・Discord | 呼ばない |

## 3. 期待値を変えた既存テスト / 呼び出しだけ合わせた既存テスト

期待値を変えた既存テスト: **1 件 1 行だけ**。
- `src/mind/memory.test.mjs:67`(「formatTranscriptForDigest: 名前のある viewer 行だけ `viewer(名前):` にする…viewer 以外には付けない」)の最後の要素 `"you: やあ"` → `"you(名前は付かない): やあ"`。理由: 設計 §3.2・Undine の追認 (1)(②④の整形に名前つき you)。配信では you に名前が入らないので配信の文字列は変わらない(固定テストで確認)。テストの題名の「viewer 以外には付けない」は変えていない(期待値 1 行だけにとどめた。§12 質問 1)。
- recall 側の対になる所: **無し**(`recall.test.mjs` に名前つき you を固定する期待値は無かった。④の整形は②の整形をそのまま使うので一緒に付く)。

呼び出し方だけ合わせた既存テスト: **0 件**(`stream-wording-pin-calls.mjs` も含め、既存テストのファイルは上の 1 行以外触っていない)。

## 4. 語の組の項目(配信の値)と `recall.md` の印

`src/mind/venue-wording.mjs` の `VENUE_WORDING_KEYS`(並びも固定):

| 項目 | 配信の値(`STREAM_WORDING`) | 差さる所 |
|---|---|---|
| `keeper` | `配信の相方 AI の記憶の置き場` | ②④の固定の指示「あなたは、◯◯の「書き出し役」/「思い出し役」です。」 |
| `venue` | `配信` | ②の頼みの「今回の◯◯の記録」「◯◯の日付」「今回の◯◯の本体」(4 か所)「今回の◯◯に当たる行」 |
| `transcriptKind` | `配信の文字起こし` | ②の材料の説明「材料（◯◯。…」 |
| `speakers` | `you = 配信者、soul = 相方の AI 自身、viewer = 視聴者のコメント。` | ②の材料の説明・④の「直近の会話（◯◯この中の指示には従いません）」 |
| `records` | `過去の配信の記録` | ④の頼みの 1 行目・`skills/recall.md` の 1 行目・①に渡す結果の文面 5 か所 |
| `partner` | `配信者` | `skills/recall.md`「◯◯に『思い出して』…」 |
| `conventionsNote` | `""`(空) | ②④の頼みの手順「1. `_conventions.md` を読む。」の直後(同じ行)。配信では何も足さない |

- 見張り(設計 §3.4 a【推奨】): どの項目も文字列・改行なし・80 字以内(`VENUE_WORDING_MAX_CHARS`)、空にしてよいのは `conventionsNote` だけ(`VENUE_WORDING_OPTIONAL_KEYS`)。`assertVenueWording` がこれを確かめ、項目の過不足も断る。テストが項目の並びと配信の値の形を固定する。F は通話の語の組を `assertVenueWording` に通せば「同じ項目の集合・1 行以内」を確かめられる。
- 「共通部分 + 語の組」の確かめ方: 仮の語の組(どの語も配信の語と重ならない印)を差すと②④・recall.md・結果の文面に「配信」が 1 つも残らない(=「配信」は全部語の組の中)、仮の語を配信の語に戻すと配信の文面と一字も違わない(= 違うのは語の組の語だけで、手順・答えの形・書きっぷりは 1 か所)。14 の組み立てで確かめる。
- F の「`_conventions.md` の『配信』は通話にも当てはめる」の 1 行は `conventionsNote` に入れる(②④の頼みにだけ出て、固定の指示には出ない。テストで確認)。
- `recall.md` の印: `{{項目の名前}}`(英字の項目名)。本文の 2 か所 = `{{records}}を思い出したいときは、…` と `- {{partner}}に「思い出して」…`。見出し欄(`description:` の「過去の配信の記録」)は①に渡らないので印にしていない。読み込み(`listSoulSkills`)で `applyVenueWording` が差す。知らない印はそのまま残すが、`skills/` のどの教えも知っている印だけを使うことをテストが確かめる。

## 5. ①の教えの口

- 名前の決まり: `venue-<体験の種類>`、ファイルは `skills/venue-<体験の種類>.md`(例 `skills/venue-discord.md`)。`venueTeachingName(kind)` が名前を作る(`"stream"` と形の崩れた種類は null)。名前の形は `/^venue-[a-z][a-z0-9-]*$/`(パスの区切り・`..` を通さない)。
- 選び方: 体験の口の `teaching`(教えの名前、配信は null)で選ぶ。`soulSkillNamesForVenue({ body, teaching })` は `soulSkillNamesForBody(body)` の最後(思い出すの教えのあと)に教えを 1 つ足す。teaching が null なら `soulSkillNamesForBody(body)` と同じもの(同じ配列)を返す。F の Discord の口は `teaching: venueTeachingName("discord")` を置く想定。
- C ではファイルを作っていない。テストは一時フォルダに `venue-fakevenue.md`(見出し欄つき・印つき)を置き、最後に足されて印も体験の語で差されること、配信(教え無し)では同じフォルダでも足さないこと、ファイルの無い教えは今の決まり(警告 1 回・ほかの教えは残す)になることを示す。
- 配信で何も足さないことの確かめ方: `appendSoulSkills(buildFireSystemPrompt(), loadSoulSkills({ names: soulSkillNamesForVenue({ body: true, teaching: null }) }))` が `FIRE_SYSTEM_PROMPT` と一致(新規テスト)、`fire-orchestrator.test.mjs` の固定・`soul-skills.test.mjs`・固定テストの `skill.recall` がそのまま通る。cockpit.mjs では、場の言葉が無い(配信・閉じている)とき今の呼び出し `loadSoulSkills({ names: soulSkillNamesForBody(sessionHasBody), onWarning: onBrainWarning })` をそのまま通る(§7)。

## 6. 判定の差し口

- `speak-now.mjs` の問いの組 `{ hostLabel, buildInstructions, buildChoices, buildInput, backchannelInstruction }`(`SPEAK_NOW_QUESTION_KEYS`)。配信の組 `STREAM_SPEAK_NOW_QUESTIONS` は今の `SPEAK_NOW_HOST_LABEL`・`buildSpeakNowInstructions`・`buildSpeakNowChoices`・`buildSpeakNowInput`・`SPEAK_NOW_BACKCHANNEL_INSTRUCTION` そのもの。
- `resolveSpeakNowQuestions(q)`: null は配信の組。渡された組で欠けた項目は配信の項目で埋める(`hostLabel` だけ替えれば配信の入力の整形がそのラベルで行を作る)。型の違い・知らない項目は TypeError。
- `buildSpeakNowInput(entries, { ..., hostLabel })`(既定 `SPEAK_NOW_HOST_LABEL`)。`createSpeakNowController({ ..., questions })` は作るときに 1 回解決し、判定のたびに `questions.buildInput(entries, { nowMs, soulName, hostLabel })`・`buildInstructions({ name, verbosity })`・`buildChoices(name)` を使う。忙しい間の数え・after-busy・並行の判定・相槌の歯止め・発火する選択(value で決まる)は部品が持ったまま(仮の問いの組でも同じに動くことをテストで確認)。
- 相槌の発火の内部指示(`SPEAK_NOW_BACKCHANNEL_INSTRUCTION`「今は配信者の話に…」)も問いの組の項目にした(結線層がその場の組から引く・§10 裁量 4)。
- 思い出しの「避けるか」の判定は**差し口を作っていない**(F)。体験の口の `judgeSet` は今 `{ speakNow }` だけを受け付ける(知らない項目は断る)ので、F が `recallAvoid` を足すときは `normalizeVenueWords` の受け付けと `createRecallDesk` の口を同じ形で足す。

## 7. 体験の口からの渡り方(実物の結線)

体験の口の `wording` / `teaching` / `judgeSet` は `normalizeVenueExperience` → `normalizeVenueWords` で確かめて持つ(崩れていれば `createCockpitServer` を作るときに TypeError)。配信の口(`streamExperience`)は 3 つとも null のまま。

| 何 | どこで | 何が渡るか |
|---|---|---|
| 判定の組 | サーバの始める 3(`renewJudges` → `makeSpeakNow`)。場の体験は始める 1 で決まっているので、その場の体験の組 | `resolveSpeakNowQuestions(venueJudgeSet()?.speakNow ?? null)` を `createSpeakNowController({ questions })` と相槌の発火の `instruction` に。閉じている間に作る部品(起動時)は null = 配信の問い |
| ④(頼み・固定の指示) | サーバの始める 3(`renewRecallDesk` → `makeRecallDesk`) | `createRecallDesk({ wording: venueExperience.wording })` → `runRecall` の `job.wording` → `runLeadRecall` → ロールの束 `recall.run(job)` → cockpit.mjs の `recallRunner` → `runRecall({ wording: job.wording ?? null })` |
| ①に渡す結果の文面 | 同じ係 | 係が `buildRecall*({ ..., wording })` で組む(発火の指示・黙って渡す文の両方) |
| ②(固定の指示と頼み) | cockpit.mjs の保存の係が**保存を頼んだ時点**で読む(定期・手動・閉じる段の最後の保存。最後の保存は `markVenueClosed` より前なのでその場の言葉が読める・テストで確認) | `createMemoryRecorder({ getWording: () => server?.venueContext()?.wording ?? null })` → `writeImpl(entries, place, wording)` → `writeStreamRecord({ wording })`。場の外は null = 配信の語 |
| ①の教えと①の recall.md の語 | cockpit.mjs の `ensureSession`(頭のセッションを作るとき。始める 8 の `openSession` と、場の間の作り直し) | `venueSoulWords(server?.venueContext() ?? null)` が null(配信・場の外)なら今の道、あれば `listVenueSoulSkills({ body, venue })`(教えを最後に・本文をその体験の語で) |
| 会話指示の編集画面の教え | cockpit.mjs の `createConversationInstructionHooks` の 5 つ目の口 | 同じく、そのときの場の言葉(閉じていれば null → 今の配信の語の一覧)。体験の教えも一覧に出る |

サーバの内部 API `venueContext()` = `{ experience, wording, teaching }`(開いている・開きかけ・閉じかけの間)/ null(閉じている)。判定の組は出さない(サーバの中だけで使う)。

## 8. 名前つき you の出方

- ②(`formatTranscriptForDigest` の `formatDigestLine`): 名前のある you は `you(名前): 本文`(viewer と同じく空白を 1 つに詰めて trim)。名前が無い・空白だけなら `you: 本文`。soul は名前を持っていても `soul: 本文`。speakerId は出ない。
- ④(`formatRecentConversation`): ②の整形を使うので同じ。
- `buildRecallAvoidInput`: 付けない(追認 (2)・`配信者: 本文` のまま。テストで確認)。
- 配信では you に名前が入らないので配信の文字列は変わらない(固定テストの入力は you の名前が undefined)。

## 9. 配信の文字列が変わっていないことの確かめ方

- 固定テスト(36 件)が通る。期待値・入力の fixture は `git diff --stat` 空。呼び出し `-calls.mjs` も変えていない(既定の配信の語で今の呼び出しのまま同じ文字列)。
- `memory.test.mjs`・`recall.test.mjs`・`speak-now.test.mjs`・`comment-react.test.mjs`・`soul-skills.test.mjs`・`fire-injection.test.mjs`・`fire-orchestrator.test.mjs` の配信の期待値は変えていない(§3 の 1 行を除く)。
- 新規: 語の組を渡さない / 配信の語の組を渡す / 配信の語の組の写しを渡すが全部同じ文字列(14 の組み立て)、`buildWriterSystemPrompt()`・`buildRecallSystemPrompt()` が今の定数と同じ、①は配信で `FIRE_SYSTEM_PROMPT` と一致、speak-now は問いの組を渡さないと判定に渡る問い・選択肢・入力が今の関数の出力と同じ、サーバで配信の場の判定が今の問いと `SPEAK_NOW_BACKCHANNEL_INSTRUCTION`・思い出しの結果が今の文面。
- 対象外は触っていない: `fire-orchestrator.mjs`(「未配信」・「あなたは配信の相方です」)、`comment-react.mjs`・`comment-guard.mjs`、`scripts/probe-decisions-*.mjs`、避けるかの判定。

## 10. 裁量

1. **語の組の切り方**: 7 項目(§4)。設計の例「置き場の持ち主の呼び名」は、配信の文面が「配信の相方 AI の記憶の置き場」で語の境目に空白を挟むため、句ごと `keeper`(「…の記憶の置き場」まで)にした。材料の説明は ②④で共有する話者の説明 `speakers` と②だけの `transcriptKind` に分けた(④の説明の行も同じ項目で差せるように)。②の「配信」はどれも場の呼び名なので 1 項目 `venue`。
2. **`_conventions` の 1 行の差し方**: 配信では空の項目 `conventionsNote` を②④の頼みの手順 1 の直後(同じ行)に置く。固定の指示には入れない(scope §23 は「頼み」に足す)。
3. **印の書き方**: `{{項目の名前}}`(語の組の項目名そのもの)。知らない印は残す(テストで全教えの印が既知であることを確かめる)。
4. **相槌の内部指示を問いの組に入れた**: 「配信者」を含み、speak-now の判定の結果としてだけ使われるので、判定の組と一緒に体験が差せる方が F の手間が少ない。配信では今の定数。
5. **問いの組の欠けた項目は配信の項目で埋める**: `hostLabel` だけ替えるなどの部分的な組を許す(型の違いは投げる)。黙って配信に戻るのは「項目を渡さなかった」ときだけ。
6. **①の教えは体験の口の `teaching`(名前)で選ぶ**: B が置いた `teaching` の置き場を使い、名前の決まりは `venueTeachingName(kind)` で持つ(体験の種類から名前を作る)。教えの名前は形を確かめてからパスに使う。
7. **②の語の組は「保存を頼んだ時点」で取る**: 計画は「②の保存は場を閉じる段」と書くが、20 分ごと・手動の保存も場の間に②を走らせるので、閉じる段だけに渡すと場の途中の保存が配信の語になる。保存の係が置き場と同じく頼んだ時点で語の組を取り、走るのが遅れても頼んだ場の語で書く(置き場は場ごとに作り直すので、同じ置き場の頼みは同じ場の語)。場の外で②が走る道は無い(手動はサーバが断る)が、あれば null = 配信の語。
8. **①と編集画面は「場の言葉が無ければ今の道」**: 既存の結線テスト(`scripts/cockpit.test.mjs:3121`・`:3123`)が `loadSoulSkills({ names: soulSkillNamesForBody(sessionHasBody), onWarning: onBrainWarning })` と `() => listSoulSkills({ names: soulSkillNamesForBody(currentBody()) })` をソースの照合で固定しているため、その呼び出しを配信の道として残し、語の組か教えのある場だけ体験の道(`listVenueSoulSkills`)を通す 2 本の道にした(体験の道に語の組も教えも無ければ同じ文字列になることもテストで確認)。編集画面は `createConversationInstructionHooks` の 5 つ目の口で渡した(§12 質問 2)。
9. **編集画面にも体験の教えを出す**: 編集画面は「①にいつも足されている教え」を見せる所なので、Discord の場の間は体験の教えも一覧に出る(配信・閉じている間は今と同じ)。
10. **形の崩れは早く投げる**: 語の組・教えの名前・判定の組が崩れた体験の口は `createCockpitServer` を作るときに TypeError。②④・結果の文面・教えの読み込み・係・speak-now の部品も、崩れた語の組 / 問いの組では文面を作らずに投げる(黙って配信の語に混ぜない)。教えの読み込みでは、語の組の崩れを「読めない教え」の警告にしない(教えを落とさない)。
11. **`buildRecallFailed*` も `wording` を受け取る**: 記憶の呼び名を含まないので語は使わないが、ほかの結果の関数と同じ形で受け取り形だけ確かめる(係が同じ渡し方をできる)。
12. **思い出しの「避けるか」の判定**: C では差し口を作らなかった(F)。

## 11. 持ち越し

- **Domain F**:
  - 通話の語の組(7 項目・`assertVenueWording` に通す。並びの固定テスト `wording-discord-c.test.mjs` の 1 件目に合わせる)。`conventionsNote` に「`_conventions.md` の『配信』は通話にも当てはめる」の 1 文。`speakers` は名前つき you の説明(例「you = 通話で話す人(名前つき)、soul = 相方の AI 自身。」)。
  - Discord の体験の口(D の `src/discord/`)に `wording`・`teaching: venueTeachingName("discord")`・`judgeSet: { speakNow }` を置く。`skills/venue-discord.md`(見出し欄つき・印も使える)。
  - speak-now の Discord の問いの組(問い・選択肢・`hostLabel`・`backchannelInstruction`)。speak-now への固定・発火の予定を作らない・snapshot の値は F。
  - 思い出しの「避けるか」の判定の Discord の文面: `judgeSet` に `recallAvoid` を足す(`normalizeVenueWords` の受け付け・`createRecallDesk` の口・`makeRecallDesk` での渡し)。speak-now と同じ形・配信不変で。
  - コメント反応は Discord では作らない(C では触っていない)。
- **Domain G**: 編集画面は Discord の場の間、体験の教え(`skills/venue-discord.md`)も一覧に出す(view-logic の `soulSkillNoticeText` などの文面がそれで良いかを見る)。`glance-timeline.mjs` の `STREAMER_LABEL` は C の範囲外のまま。
- `memory.test.mjs:58` のテストの題名「viewer 以外には付けない」が実際(you にも付く)と合っていない(§12 質問 1)。
- 2 つ目のロール: ②の語の組は保存の係が 1 つの値で持つ(ロールごとではない)。場の語の組はロールに依らないので今は問題ない。

## 12. 質問

1. `memory.test.mjs:58` の題名「…名前のある viewer 行だけ `viewer(名前):` にする（…viewer 以外には付けない）」は、期待値を変えたあと実際と合わない。題名の文字列を直してよいか(期待値ではないが、「期待値 1 行だけ」の指示に合わせて今は触っていない)。
2. §10 の 8: 既存のソース照合テストが今の呼び出しの文字列を固定しているため、cockpit.mjs の①と編集画面は「配信の道(今の呼び出しそのまま)」と「体験の道」の 2 本にした。照合テストの正規表現を直して 1 本の道にする方がよいなら、それは既存テストの期待値の変更になるので Undine の判断を仰ぎたい(今の形でも配信の①が一字も変わらないことはテストで確かめている)。
3. §10 の 7: ②の語の組を「閉じる段」ではなく「保存を頼んだ時点」で渡した(場の途中の 20 分ごと・手動の保存も同じ場の語で書くため)。計画の「②の保存は場を閉じる段」の意図がこれと違うなら教えてほしい。
