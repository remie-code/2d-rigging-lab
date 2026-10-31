# Discord モード Domain C レビュー(Review-Sylph、2026-10-31)

> 対象: ブランチ `ai-cohost/discord-mode`、HEAD `f7f368cb`、コミットしていないワークツリー(変更 9 ファイル + 新規ソース 1・テスト 3 + Gnome 報告)。
> 根拠: 計画 [discord-mode-wave-plan.md](../../orchestration/discord-mode-wave-plan.md) Status の A の追認 (1)(2)・B の追認 (3)、§1 Domain C(境界のため F も)、§4、設計 [discord-mode.md](../../../architecture/discord-mode.md) §3.2・§3.4・§4.3 の表・§8、棚卸し [discord-mode-inventory.md](../../orchestration/discord-mode-inventory.md)、A・B のレビューと報告の持ち越し、Gnome 報告 [domain-c-gnome.md](../../waves/discord-mode/domain-c-gnome.md)。
> 読み取り専任で見た。ソース・テスト・設計文書は直していない。鍵(`.env*.local`)・実データ(`cockpit-settings.local.json`・`memories/`・`roles/`)は開いていない(mtime だけ見た)。操縦席は起動していない。比較のために HEAD の版を `apps/soul/agent/tmp/rv-c-head`(`tmp/` は `.gitignore` 済み)に取り出して使ったが、**削除済み**(`tmp/` には元からある `discord-receive`・`restructure-backups` だけが残る)。比較スクリプトは scratchpad の下に置いた(リポジトリの外)。

- ループ: 1 回目
- 判定: **合格**(止める指摘 なし。Undine へ上げる質問なし。持ち越しは F・G 向けの小さな点だけ)

## 機械ゲート(自分で走らせた)

| ゲート | 結果 |
|---|---|
| `apps/soul/agent` で `node --test` | tests 2011 / **pass 2011** / fail 0 / cancelled 0 / skipped 0(`duration_ms` 91571)。Gnome 報告と同じ(土台 1966 + 新規 45 = `wording-discord-c` 29・`cockpit-server-discord-c` 8・`cockpit-discord-c` 8。新規ファイルの `test(` を数えて一致) |
| 根で `pnpm run check:soul-zone` | pass(1580 files scanned; no 器→魂 / 魂→器) |
| 依存・lockfile | `git status` の 14 行は始めと同じ(変更 9 + 新規 4 + Gnome 報告 1)。package.json・lockfile・`src/memory/`(種のファイル `conventions-seed.md` を含む)の差分なし |

注: 1 回目の `node --test` は比較用に HEAD を `apps/soul/agent/tmp/` に置いたまま走らせたため、`tmp` 下の複製も拾って 3744 件(12 fail = 複製側)になった。比較用の一時フォルダを消して 2 回目を走らせ直した結果が上の表(2011 件)。複製のテストは偽物だけで動くもので、実データに触れない(下の「守りの決まり」で mtime を確かめた)。

## 配信の文字列が変わっていないことの独立の確かめ(最優先)

### 固定テストの fixture と既存テスト
- `git diff HEAD --stat -- apps/soul/agent/src/mind/fixtures/` は空(`stream-wording-pin-expected.mjs`・`stream-wording-pin-input.mjs`・`stream-wording-pin-calls.mjs` とも HEAD と同一。`git status` にも出ない = untracked でない)。固定テスト 36 件は全件の中で通る。
- 既存テストの差分は `git diff HEAD --stat -- 'apps/soul/agent/**/*.test.mjs'` で **`memory.test.mjs` の 1 行(+1/-1)だけ**。中身は期待値の最後の要素 `"you: やあ"` → `"you(名前は付かない): やあ"`(入力が `speaker: "you", displayName: "名前は付かない"` の行)。設計 §3.2・Undine の追認 (1) で認められた変更そのもの。`recall.test.mjs`・`speak-now.test.mjs`・`comment-react.test.mjs`・`soul-skills.test.mjs`・`fire-injection.test.mjs`・`fire-orchestrator.test.mjs`・`scripts/cockpit.test.mjs`(`:3121`・`:3123` のソース照合を含む)の差分は 0。

### HEAD との直接比較(固定テストが拾わない入力まで)
やり方: `git archive HEAD apps/soul/agent/src apps/soul/agent/skills apps/soul/agent/package.json` を `apps/soul/agent/tmp/rv-c-head` に取り出し、**同じ比較スクリプト**を HEAD の版と今のワークツリーの両方に走らせ、出力の JSON を `diff` した。配信の場面 = 語の組を渡さない・体験の口が null。結果は **111 項目すべて一字も違わない(IDENTICAL)**。

比べたもの(固定テストの入力とは別に、自分で作った転写 `T`: 窓の外の行・空白と改行を含む you・空白だけの名前の you・名前なしの you・soul(名前と speakerId つき)・名前つき viewer(空白入り)・名前なし viewer・空の本文・知らない speaker・数の名前、それと空の転写・null):
- ②: `WRITER_SYSTEM_PROMPT`、`formatTranscriptForDigest`(`T`・空・null の 3 通り)、`buildWriterRequest`(既存ファイル 0・1・2 件・空入力)、`writeStreamRecord` を偽の頭で 1 回走らせたときの `create` の引数(systemPrompt・sandbox・キー)と `ask` に渡る頼み。
- ④: `RECALL_SYSTEM_PROMPT`、`formatRecentConversation`(通常・広い窓・空・null)、`buildRecallRequest`(通常・空・山括弧と改行と鉤括弧を含む頼みごと・500 字の頼みごと)、結果の 7 関数(`buildRecallFoundInstruction`・`NotFoundInstruction`・`DeferredNote`・`NotFoundDeferredNote`・`SilentFoundNote`・`FailedInstruction`・`FailedDeferredNote`)を、要約あり・要約なしの両方、`runRecall` を偽の頭で走らせたときの `create` の引数と `ask` の頼み。
- ④の係 `createRecallDesk` を偽物一式で動かし、**①に渡る実際の文面**を 9 つの枝で比較(見つかった・見つからなかった・失敗の発火、KILL 中の見つかった/見つからなかった/失敗(黙って渡す)、自発 OFF の見つかった/見つからなかった、避けた(話題が移った)の黙って渡す)。`job` は `wording` を除いて比較(HEAD の job に `wording` は無い)。
- ①: `FIRE_SYSTEM_PROMPT`、体なし(`soulSkillNamesForBody(false)`)で作った固定の指示、`loadSoulSkills()`(既定・体あり・体なし・undefined)、`listSoulSkills()`(既定・`names:["recall"]`)。`skills/recall.md` を通した本文を含む。
- 判定: `buildSpeakNowInput`(転写 3 通り)・`buildSpeakNowInstructions`(quiet / normal / chatty / null / undefined / 知らない値)・`buildSpeakNowChoices`・`SPEAK_NOW_HOST_LABEL`・`SPEAK_NOW_BACKCHANNEL_INSTRUCTION`、`createSpeakNowController` を偽の判定で 1 回回したとき判定に渡る `{input, instructions, choices}` と onJudgment / onFire の中身、`buildRecallAvoidInput`(3 通り)、`recallAvoidQuestion`、`formatFireInjection` / `formatFireInjectionSince`(3 通り)。

意図した唯一の差(比較の対象外): 配信では起きない「名前のある you」の整形だけが `you(名前):` になる(設計 §3.2・追認 (1))。自分の転写 `T` では you に名前が付く行(数の名前を除く)を入れておらず、`memory.test.mjs` の期待値 1 行と `wording-discord-c.test.mjs` が固定している。配信の耳が you に `displayName` を入れる経路が無いことは、`ear-pipeline.mjs` の `append` 呼び出しに `displayName` が無いことと、`cockpit-server.mjs` の viewer の append だけが `displayName` を持つことで確かめた。

### 対象外に触っていない
`git diff HEAD --stat -- fire-orchestrator.mjs comment-react.mjs comment-guard.mjs scripts/probe-decisions-*` は空。「未配信」・「あなたは配信の相方です」・コメント系・probe は HEAD のまま。「避けるか」の判定(`recallAvoidQuestion`・`buildRecallAvoidInput`)も差分に出ない(`recall.mjs` の差分はコメントと ②④ 側と結果の関数だけ)。

## 各約束の確かめ

1. **②④・`recall.md`・結果の文面が「共通部分 + 語の組」の 1 本** — 確か。
   - 組み立ては `memory.mjs`(`buildWriterSystemPrompt`・`buildWriterRequest`)、`recall.mjs`(`buildRecallSystemPrompt`・`buildRecallRequest`・結果の 7 関数)、`skills/recall.md`(印 `{{records}}`・`{{partner}}` の 2 か所)に 1 か所ずつ。語の組は `venue-wording.mjs` の 7 項目。手順・答えの形・書きっぷりの指示(「従いません」「済み」とだけ答える等)は組み立て側にしか無く、語の組に入っているのは語・句だけ。配信の語の組は今の文面から抜き出した語そのもの(上の 111 項目の比較で一致)。
   - 語の組の見張り(設計 §3.4 a【推奨】): `assertVenueWording` が項目の集合・文字列・改行なし・80 字以内・空は `conventionsNote` だけ、を確かめる。テスト「項目の並びを固定」「1 行以内」「形の崩れた語の組は断る」。仮の語の組(配信の語と重ならない印)を差すと「配信」が ②④・recall.md・結果の文面に 1 つも残らず、配信の語に戻すと配信の文面と一字も違わない(14 の組み立てで確認するテスト)。
   - `recall.md` の読み込み: `listSoulSkills` が `applyVenueWording`、語の組の形が崩れていれば教えを落とさず投げる(読めない教えの警告にしない)。`skills/` のどの教えも知らない印を持たないテストあり。
2. **配信が既定** — 確か。渡さない・`null`・配信の語の組・その写し、の 4 通りが同じ文字列になるテスト。
3. **①に体験ごとの教えを足す口、配信では何も足さない** — 確か。`soulSkillNamesForVenue({ body, teaching })`(teaching が null なら `soulSkillNamesForBody` と同じ配列を返す・足すなら最後に 1 つ)、名前の決まり `venue-<体験の種類>`(`venueTeachingName`・形は `/^venue-[a-z][a-z0-9-]*$/` でパスの区切りと `..` を通さない)、ファイルは `skills/venue-<種類>.md`。C ではファイルを作っていない(`skills/` の差分は `recall.md` だけ)。一時フォルダの仮の教えが最後に足されて印も体験の語で差されるテスト、配信(教え無し)では足さず `FIRE_SYSTEM_PROMPT` と一致するテスト、教えのファイルが無いときは今の決まり(警告 1 回・ほかは残す)のテストあり。
4. **判定の差し口** — 確か。`createSpeakNowController({ questions })`(問い・選択肢・入力の整形・`hostLabel`・相槌の内部指示)。渡さなければ配信の問い(`STREAM_SPEAK_NOW_QUESTIONS` は今の関数・定数そのもの。テストと上の比較で確認)。欠けた項目は配信の項目で埋め、型が違えば投げる。忙しい間の数え・あとから・並行・相槌の歯止めは部品が持ったまま(問いの組を替えても同じに動くテストあり)。
5. **体験の口の `wording` / `teaching` / `judgeSet` がつながっている** — 確か。
   - 形の確かめ: `normalizeVenueWords`(崩れていれば `createCockpitServer` を作るときに投げる)。配信の口は 3 つとも null のまま。
   - 判定の組: `makeSpeakNow` が `resolveSpeakNowQuestions(venueJudgeSet()?.speakNow ?? null)` を作るときに 1 回解決し、相槌の発火の `instruction` も同じ組から引く。部品は始める 3 で作り直されるので、その場の体験の問いになる。閉じている間に作る部品は null = 配信の問い。
   - ④: `makeRecallDesk` が `wording: venueExperience ? venueExperience.wording ?? null : null` → `job.wording` → ロールの束の `recall.run(job)`(そのまま渡す)→ `recallRunner` → `runRecall({ wording })`。①に渡す結果の文面は係が同じ語の組で組む。
   - ②: `createMemoryRecorder({ getWording })` が保存を頼んだ時点で `server?.venueContext()?.wording ?? null` を取り、`writeImpl(entries, place, wording)` → `writeStreamRecord({ wording })`。
   - ①と編集画面: `venueSoulWords(server?.venueContext() ?? null)` が null(配信・場の外)なら今の呼び出し `loadSoulSkills({ names: soulSkillNamesForBody(...) })` / `listSoulSkills({ names: ... })` をそのまま通る。それ以外は `listVenueSoulSkills`(中で `listSoulSkills` を呼ぶ)。`loadSoulSkills` と同じ `"\n\n"` の結合であることを確かめた。
   - サーバの内部 API `venueContext()` は additive(`streamStatus` の形・snapshot は変わらない)。
6. **名前つき you** — 確か。②(`formatDigestLine`)は名前のある you に `you(名前):`(空白を詰めて trim・空白だけ/無しは `you:`・soul は名前を持っていても `soul:`・speakerId は出ない)、④(`formatRecentConversation`)は②の整形をそのまま使うので同じ。`buildRecallAvoidInput` には付けない(追認 (2)・テストあり)。
7. **各約束にテストが付いている** — 付いている(計画 §4 の理由 3 に当たる欠けは無い)。上の 1〜6 の各項に対応するテストの題名を新規 3 ファイルで確認した(`grep "^test("` で 45 件)。足りない約束は無い。

## 守りの決まり(計画 §4 の理由 4) — 違反なし
- 鍵: 新規・変更に `process.env`・`.env`・`homedir`・`console.*` が無い(grep)。差分の追加行にも無い。ログに文字起こしの本文・名前・Discord の id を出す所は増えていない。
- 実データ: `cockpit-settings.local.json`(最終更新 19:52)・`memories/`(最終更新 20:46)・`roles/` は、ワークの開始(コミット 22:33)より前の時刻のままで、C の作業ファイル(22:42〜22:57)より新しいものは 0。`memories/chappy/_conventions.md`・`src/memory/conventions-seed.md` は差分なし(`memories/` は `.gitignore` 済みで追跡外・mtime で確認)。
- 依存・lockfile: 変更なし。
- テスト: 偽の頭・偽の判定・偽の発火・偽の体験の口だけ。書くのは `os.tmpdir()` の一時フォルダ(`mkdtempSync`)だけで、`writeStreamRecord` の試験も `commitImpl` を差し替える。cockpit-server 側のテストは loopback のサーバ(`settingsStore` を渡さない in-memory)で、既存テストと同じ作り。本物の LLM・外部 API・Discord・`DEFAULT_ROLES_DIR` / `DEFAULT_MEMORY_DIR` は使わない。`cockpit-discord-c.test.mjs` が読むのは `cockpit.mjs` のソース(コード)だけ。
- ②④の配信の文面・`_conventions.md`・種のファイル: 変わっていない(上の 111 項目の比較)。

## 止める指摘

なし。

## Gnome の質問 1〜3 の見立て

1. **`memory.test.mjs:58` の題名**: 題名は期待値ではないので、直しても「期待値を変えた既存テスト 1 件」の数は増えない。現状は題名の「(…viewer 以外には付けない)」と中身(you にも付く・soul には付かない)が食い違うが、テストの合否も配信の文字列も動かない。止める理由 1〜4 のどれにも当たらない(設計・配信・テストの欠け・守りのどれでもない)→ **止めない**。直すなら Orch-Sylph が題名だけの狭い修正として委任してよい(たとえば「名前のある viewer / you の行だけ `viewer(名前):` / `you(名前):` にする(soul には付けない)」。期待値には触れない)。直さなくても次へ進んでよい。
2. **①と編集画面の「配信の道」と「体験の道」の 2 本**: **設計とのずれではない**。根拠: (a) 設計 §3.4「①の側」の `skills/recall.md` a は「会話指示の編集画面には、印のままではなく、そのとき選べる体験の語で差したもの(場が閉じていれば配信の語)を見せる」。実装は、場が閉じている・配信なら今の道(配信の語)、体験が語の組か教えを持つ場の間だけ体験の語で差した一覧、で満たしている。(b) 「手順・答えの形・書きっぷりの指示は 1 か所」の決まりは ②④の組み立てと `skills/recall.md` の本文の話で、読み込みの関数は 1 つ(`listVenueSoulSkills` は中で `listSoulSkills` を呼び、`loadSoulSkills` も同じ読み込みを使う)。2 本あるのは呼び出しの入口だけで、本文が 2 つあるわけではない。(c) 配信の①・編集画面は上の比較(`FIRE_SYSTEM_PROMPT`・体なし・`listSoulSkills`)で一字も変わらない。(d) 既存のソース照合テスト(`scripts/cockpit.test.mjs:3121`・`:3123`)の正規表現を直して 1 本にすると既存テストの期待値の変更になり、計画 §1 C の「期待値を変えない」に反する。今の形でよい。Domain G が編集画面の見せ方を見直すとき(持ち越し)に 1 本にまとめてよい。
3. **②の語の組を「保存を頼んだ時点」で取る**: **ずれではなく、筋の通る裁量**。根拠: 設計 §3.4 の決定は「Discord のときは②④は配信と別の文面」で、取る時点は指定していない。計画 §1 C の「②の保存は場を閉じる段」は「体験の種類が渡る場所」の要約で、字義どおり閉じる段だけで渡すと、場の間に走る 20 分ごとの保存と手動の保存が配信の語で書かれ、通話の記録に「配信」が混ざる(設計の決定に反する)。頼んだ時点で取るなら、場の間のどの保存も同じ場の語になる。確かめ: 閉じる段の最後の保存(`saveFinal`)は `markVenueClosed()` より前(`cockpit-server.mjs` の `runRoleHooksAll("saveFinal", …)` が `:2536`・`:2556`、`markVenueClosed()` がその後)で、その時点では `venueContext()` がまだ読めるテストがある。待っている保存を差し替えるときは新しい方の語の組にする(同じ置き場 = 同じ場なので同じ値)テストもある。

## 裁量(筋が通ると認めたもの)

1. 語の組の切り方 7 項目(`keeper` は「…の記憶の置き場」まで句ごと・`speakers` を ②④で共有し `transcriptKind` は ②だけ・`venue` を 1 項目・`records`・`partner`・`conventionsNote`)。設計の例(場の呼び名・材料の説明の 1 行・置き場の持ち主の呼び名)に沿い、配信の文面が語の境目に空白を挟む所をこの切り方で一字も変えずに出せる。
2. `conventionsNote` を ②④の頼みの手順 1 のすぐ後ろ(同じ行)に置き、固定の指示には入れない(scope §23 は「頼み」に足す)。配信は空。
3. 印は `{{項目の名前}}`(語の組の項目名そのもの)。知らない印は残し、`skills/` のどの教えも知っている印だけを使うことをテストが確かめる。
4. 相槌の内部指示(`SPEAK_NOW_BACKCHANNEL_INSTRUCTION`)を問いの組の項目に入れた。「配信者」の語を含み、判定の結果としてだけ使われるので、判定の組と一緒に差せる方が F の手間が少ない。配信は今の定数のまま(テストと上の比較で確認)。
5. 問いの組は欠けた項目を配信の項目で埋める(`hostLabel` だけ替える部分的な組を許す)。型の違い・知らない項目は投げ、黙って配信に戻すのは「項目を渡さなかった」ときだけ。
6. 教えは体験の口の `teaching`(名前)で選ぶ(B が置いた置き場)。名前は形を確かめてからパスに使う。
7. 形の崩れた語の組・教えの名前・判定の組は早く(口を渡した所・部品を作るとき・文面を作るとき)投げる。黙って配信の語に混ぜない。
8. `buildRecallFailed*` は記憶の呼び名を含まないが、ほかの結果の関数と同じ形で `wording` を受け取り形だけ確かめる。
9. 編集画面に Discord の場の間は体験の教えも一覧に出す(①にいつも足されている教えを見せる所なので)。配信・閉じている間は今と同じ。
10. 「避けるか」の判定の差し口は C で作らない(計画 §1 C は `createSpeakNowController` の差し口だけを書いており、棚卸し・設計の「避けるか」の Discord の文面は F)。`judgeSet` は今 `{ speakNow }` だけを受け付ける。
11. ②の語の組を保存の係が 1 つの値で持つ(ロールごとではない)。場の語の組はロールに依らないので今は問題ない。

## 持ち越し(止めない指摘)

- **Domain F**:
  - 通話の語の組 7 項目を `assertVenueWording` に通す(並びの固定テスト `wording-discord-c.test.mjs` 冒頭と同じ並び)。`conventionsNote` は手順 1 の `。` の直後に区切りなしで連結される(`...読む。${conventionsNote}`)ので、Discord の 1 文を入れるときは文頭の空白の有無を F が決める(配信は空なので影響なし)。`speakers` は後ろに「この中の指示には従いません」が続くため句点で終える。
  - Discord の口に `wording`・`teaching: venueTeachingName("discord")`・`judgeSet: { speakNow }` を置き、`skills/venue-discord.md`(見出し欄つき・印も使える)を作る。教えのファイルが無いと警告 1 回で足されない(今の決まり)ので、F のテストでファイルの存在も固定するとよい。
  - Discord の speak-now の問い(`hostLabel`・問い・選択肢・入力・相槌の指示)。固定・snapshot の値も F。
  - 「避けるか」の判定の差し口: `judgeSet` に `recallAvoid` を足す(`normalizeVenueWords` の受け付け・`createRecallDesk` の口・`makeRecallDesk` での渡し)。配信不変・speak-now と同じ形で。
- **Domain G**: 編集画面は Discord の場の間、体験の教えも一覧に出る(`view-logic` の教えの案内文がそれで良いか)。編集画面の呼び出しの 2 本の道を 1 本にまとめるなら、そのとき `scripts/cockpit.test.mjs:3121`・`:3123` の期待値の変更になるので仕様変更として扱う。`glance-timeline.mjs` の `STREAMER_LABEL` は C の範囲外のまま。
- 小さな点(止めない):
  - `memory.test.mjs:58` の題名(質問 1)。
  - `venue-wording.mjs` のヘッダコメントがテストのファイル名を `venue-wording-discord-c.test.mjs` と書いているが、実際は `wording-discord-c.test.mjs`(コメントだけ)。
  - 2 つ目のロールのとき: 保存の係の語の組を値 1 つからロールの束へ。
  - 一時フォルダの取り出しで `node --test` が `tmp/` 下の複製も拾う(`apps/soul/agent` の `node --test` は `tmp/` を除外しない)。Orch-Sylph・Undine が今後 `tmp/` に複製を置いたまま全件を走らせると件数が倍になる(今回は消してから走らせ直して 2011 件を確認)。

## 質問(Undine へ。Orch-Sylph が上げる)

なし。設計に書いていない判断の分岐(語の組の切り方・印の書き方・相槌の指示の扱い・取る時点)は、どれも設計の意図の範囲で Gnome が筋の通る形で決めたもので、上の「裁量」に記録した。

## 一時フォルダ
`apps/soul/agent/tmp/rv-c-head`(HEAD の `src`・`skills`・`package.json` の取り出し)は削除済み。`apps/soul/agent/tmp/` には元からある `discord-receive`・`restructure-backups` だけが残る。比較スクリプトと出力は scratchpad の下(リポジトリの外)にあり、リポジトリには書いていない。書いたファイルはこのレビュー 1 つだけ。
