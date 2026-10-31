# Domain C 完了報告 — 言葉の差し口と判定の差し口(Orch-Sylph 2026-10-31)

> 判定: **pass**(ループ 1 回・止めた指摘 0・Review-Sylph が合格)。
> 実装: Gnome(opus)→ [domain-c-gnome.md](domain-c-gnome.md)。レビュー: Review-Sylph(sonnet)→ [../../reviews/discord-mode/domain-c.md](../../reviews/discord-mode/domain-c.md)。
> コミットはしていない(ブランチ `ai-cohost/discord-mode`、HEAD `f7f368cb`)。鍵(`.env*.local`)・実データ(`cockpit-settings.local.json`・`memories/`・`roles/`)には誰も触れていない(レビューが mtime で確認)。`_conventions.md`・種のファイル・依存・lockfile の変更なし。操縦席は起動していない。

## 1. 機械ゲート

| ゲート | 結果 |
|---|---|
| `apps/soul/agent` で `node --test` | 2011 / 2011 pass(1966 から +45。Gnome とレビューの両方で確認) |
| 根で `pnpm run check:soul-zone` | pass |
| 固定テスト `src/mind/stream-wording-pin.test.mjs` | 36 / 36 pass。fixture 3 本(`-expected`・`-input`・`-calls`)とも HEAD との差分 0(呼び出しも変えずに済んだ) |

新規テスト: `src/mind/wording-discord-c.test.mjs`(29)、`src/cockpit/cockpit-server-discord-c.test.mjs`(8)、`scripts/cockpit-discord-c.test.mjs`(8)。

## 2. 変更ファイル

- 変更: `scripts/cockpit.mjs`、`skills/recall.md`、`src/cockpit/cockpit-server.mjs`、`src/mind/memory.mjs`、`src/mind/memory.test.mjs`(期待値 1 行)、`src/mind/recall-desk.mjs`、`src/mind/recall.mjs`、`src/mind/soul-skills.mjs`、`src/mind/speak-now.mjs`(すべて `apps/soul/agent/` の下)。
- 新規: `src/mind/venue-wording.mjs` と上の新規テスト 3 本。

## 3. 期待値を変えた既存テスト

- `src/mind/memory.test.mjs:67`: `"you: やあ"` → `"you(名前は付かない): やあ"`。設計 §3.2・計画 Status の A の追認 (1) による変更。
- recall 側に対になる期待値は無かった。呼び出し方だけ合わせた既存テストは 0。

## 4. 語の組(`src/mind/venue-wording.mjs`)

- 項目(並びも固定): `keeper` / `venue` / `transcriptKind` / `speakers` / `records` / `partner` / `conventionsNote`。
- 配信の値(既定): 「配信の相方 AI の記憶の置き場」「配信」「配信の文字起こし」「you = 配信者、soul = 相方の AI 自身、viewer = 視聴者のコメント。」「過去の配信の記録」「配信者」「」(空)。
- 見張り(設計 §3.4 a の推奨): `assertVenueWording` が「どの項目も 1 行以内・80 字以内、空にしてよいのは `conventionsNote` だけ」を確かめ、並びと形をテストで固定。
- F の「`_conventions.md` の『配信』は通話にも当てはめる」の 1 行は `conventionsNote` に入れる。②④の頼みの手順 1 の直後に出る(固定の指示には出ない)。
- `skills/recall.md` の印: `{{records}}` と `{{partner}}`。読み込むときに語の組で差す。
- 対象: ②④の固定の指示と頼み、`recall.md`、思い出しの結果を①に渡す文面。仮の語の組を差すと 14 の組み立てに「配信」が残らないこと、配信の語で差すと今の文面と一字も違わないことをテストで確認。
- 対象外は差分 0(`fire-orchestrator.mjs`・`comment-react.mjs`・`comment-guard.mjs`・`probe-decisions-*`・思い出しの「避けるか」の判定)。

## 5. ①の教えの口

- 名前の決まり: 教えの名前は `venue-<体験の種類>`、ファイルは `skills/venue-<体験の種類>.md`(`venueTeachingName` が名前を作る)。
- `soulSkillNamesForVenue({ body, teaching })` が、思い出すの教えのあと(最後)に足す。teaching が null(配信)なら今と同じ名前の並びになり、`FIRE_SYSTEM_PROMPT` は一字も変わらない。
- 教えのファイルは作っていない(F)。一時フォルダの仮の教えでテストした。ファイルが無いと、警告を 1 回出して教えを足さない。

## 6. 判定の差し口

- speak-now の問いの組 `{ hostLabel, buildInstructions, buildChoices, buildInput, backchannelInstruction }` を `createSpeakNowController({ questions })` に渡す。渡さなければ `STREAM_SPEAK_NOW_QUESTIONS`(今の問い)。
- 忙しい間の数え・あとからの判定・並行の判定・相槌の歯止めは共有のまま。
- 思い出しの「避けるか」の差し口は作っていない(F。`normalizeVenueWords` は今は `judgeSet.speakNow` だけを受け付ける)。

## 7. 体験の口からの渡り方

- 体験の口の `wording` / `teaching` / `judgeSet` は `normalizeVenueWords` で形を確かめる。崩れていればサーバを作るときに投げる。null は今の配信の文面。
- 判定の組: 開く段 3 の `makeSpeakNow` で渡る(相槌の発火の内部指示もここから)。
- ④と結果の文面: 開く段 3 の `makeRecallDesk` に語の組が渡り、`job.wording` を経て cockpit.mjs の `runRecall` へ。
- ②: 保存の係が、保存を頼んだ時点で `server.venueContext()` から語の組を取る(`getWording`)。20 分ごと・手動・最後の保存のすべてに効く。最後の保存(`saveFinal`)は `markVenueClosed()` より前なので、その場の語で書かれる。
- ①と会話指示の編集画面: `venueContext()` から読む。場が閉じているか配信なら、今の呼び出しのまま通る(下の質問 2)。

## 8. 名前つき you

- ②(`formatTranscriptForDigest`)と④(`formatRecentConversation`)の整形で、名前があれば `you(名前): 本文`、無ければ `you: 本文`。配信では you に名前が入らないので、配信の文字列は変わらない。
- `buildRecallAvoidInput` には付けていない(追認 (2))。

## 9. 配信の文字列が変わっていないことの確かめ方

1. 固定テスト 36 件が pass し、fixture 3 本とも HEAD との差分 0(Orch-Sylph も `git diff HEAD --stat` で確認)。
2. 既存テストの差分は `memory.test.mjs` の 1 行だけ(Orch-Sylph も確認)。
3. Review-Sylph の独立の比較: `git archive` で取り出した HEAD と今のワークツリーで同じ比較スクリプトを走らせ、出力を `diff` した。配信の場面(語の組なし・体験の口は null)の 111 項目がすべて一致。比べたのは次のとおり。
   - ②④の指示と頼み(偽の頭に渡る引数まで)
   - `recall.md` を通した①の教えと `FIRE_SYSTEM_PROMPT`
   - 結果の 7 関数と、思い出しの係の 9 つの枝で①に渡る文面
   - speak-now の問い・選択肢・入力
   - 固定テストに無い入力も足した: 空白の名前の you・空の転写・null・数の名前・山括弧や改行など
   - 一時フォルダは削除済み

## 10. 人間ゲート 1 で見てもらうとよい所(テストで確かめきれない所)

- 配信を開いて閉じるまでの一連(開く順・閉じる順・KILL)がいつも通りか。判定の組と思い出しの係は、開く段で作り直す所から語の組と問いを受け取る形に替わった。
- speak-now の判定と相槌がいつも通り出るか。問いの組を外から渡す形に替わった(配信の既定は今の問い)。
- 「思い出して」と頼んだときの思い出しと、①への返り(「過去の配信の記録から読んだ内容」など)がいつも通りか。
- 20 分ごとの保存と最後の保存で書かれる記憶が、いつも通り「配信」の記録になるか。語の組を取る時点が「保存を頼んだ時点」に替わった。
- 会話指示の編集画面で、思い出すの教え(`recall.md`)の本文が `{{records}}` などの印のままでなく、今まで通りの文で見えるか。場が開いている間と閉じている間の両方で見る。

## 11. 裁量(レビューが筋が通ると認めたもの)

1. 語の組の 7 項目の切り方と見張りの決まり(1 行以内・80 字以内・空は `conventionsNote` だけ)。
2. `recall.md` の印 `{{records}}`・`{{partner}}`。
3. 教えの名前の決まり `venue-<種類>`。教えのファイルが無いときは警告 1 回で足さない。
4. ②の語の組を「保存を頼んだ時点」で取る。計画 §1 の「②の保存は場を閉じる段」は、場の間の 20 分ごと・手動の保存を含めて同じ場の語にする趣旨と読んだ。閉じる段だけで渡すと、通話の記録に配信の語が混ざる。
5. ①と編集画面は「配信の道(今の呼び出しそのまま)」と「体験の道」の 2 本。教えを読む関数は 1 つで、本文は 2 つに分かれていない。既存のソース照合テスト(`scripts/cockpit.test.mjs:3121`・`:3123`)の期待値を変えないため。
6. 思い出しの「避けるか」の差し口は F に回した(計画 §1 C は speak-now だけを挙げ、棚卸し §5.1 は避けるかの判定の Discord の文面を F(棚卸しでは E)に置く)。

## 12. 持ち越し

- **F**:
  - 通話の語の組 7 項目を作り、`assertVenueWording` に通す。`conventionsNote` は手順 1 の `。` の直後に区切りなしでつながるので、文頭の空白は F で決める。
  - `skills/venue-discord.md` を作る。ファイルが無いと警告だけで黙って足されないので、F のテストでファイルがあることも固定するとよい。
  - Discord の口に `wording`・`teaching: venueTeachingName("discord")`・`judgeSet.speakNow` を置く。
  - 「避けるか」の差し口(`judgeSet.recallAvoid`)を足し、`normalizeVenueWords` にも足す。
  - 判定の「配信者(名前)」の語を Discord の問いの組で差す。
- **G**:
  - Discord の場の間は、編集画面に体験の教えも一覧に出る。その出方でよいかを見る。
  - ①・編集画面の 2 本の道を 1 本にまとめるなら、既存の照合テストの期待値の変更として扱う。
- **小さな点(止めない)**:
  - `memory.test.mjs:58` 付近のテストの題名(「viewer 以外には付けない」の趣旨)が、期待値を変えたあとの中身と合わない。期待値ではない。
  - `venue-wording.mjs` の頭のコメントが、テストのファイル名を `venue-wording-discord-c.test.mjs` と書いている(実物は `wording-discord-c.test.mjs`)。
  - `apps/soul/agent` の `node --test` は `tmp/` の下も拾う。比較用の複製を `tmp/` に置いたまま全件を走らせると、件数が倍になる。

## 13. 質問(Undine へ)

1. `memory.test.mjs:58` 付近のテストの題名を直すか。期待値ではないので、コミットのときに題名だけ直すか、そのまま残すかの判断を。直すなら「名前のある行(viewer と you)に名前を付ける」の趣旨。`venue-wording.mjs` のコメントのファイル名も同じ扱い。
2. ①と編集画面の 2 本の道(裁量 5)をこのままでよいか。1 本にすると、`scripts/cockpit.test.mjs:3121`・`:3123` の正規表現の期待値を変えることになる。レビューの見立ては「今の形でよい。設計 §3.4『①の側』を満たしている」。
3. ②の語の組を「保存を頼んだ時点」で取る(裁量 4)。これが計画の意図と合うか。

## 14. 起動した子

| 役 | agentId | 状態 |
|---|---|---|
| Gnome(opus、実装) | `aeff2a4181e542ecb` | 完了(報告を回収済み) |
| Review-Sylph(sonnet、レビュー 1 回目) | `a5adc0db70b8efc6e` | 完了(報告を回収済み) |
