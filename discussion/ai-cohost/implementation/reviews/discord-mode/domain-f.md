# Domain F レビュー — Discord の判定と言葉(Review-Sylph 2026-11-01)

> 対象: ブランチ `ai-cohost/discord-mode`(HEAD `53ddb597`)の未コミットの作業ツリー(Gnome の Domain F)。根拠は wave 計画 §1 Domain F・§4・Status の C の追認、C 報告 §11・§12、D 報告、設計 [discord-mode.md](../../../architecture/discord-mode.md) §3.4・§4.3・§8・§12.3、決定 [scope.md](../../../discord-vc/scope.md) §22・§23、Gnome 報告 [../../waves/discord-mode/domain-f-gnome.md](../../waves/discord-mode/domain-f-gnome.md)。
> 読み取り専任。ソース・テストは変えていない。鍵(`.env*.local`)は開いていない(存在と mtime だけ)。操縦席は起動していない。実データ(`cockpit-settings.local.json`・`memories/`・`roles/`)の中身は読んでいない。

## 1. 判定

**pass**(止める指摘 0)。

## 2. 機械ゲート(自分で実行)

| ゲート | 結果 |
|---|---|
| `apps/soul/agent` で `node --test` | **2127 / 2127 pass**(fail 0・cancelled 0・skipped 0)。Gnome の数と一致 |
| 根で `pnpm run check:soul-zone` | pass(1602 files scanned; no 器→魂 / 魂→器) |
| `git diff HEAD --stat` の固定テスト・fixture 3 本 | `src/mind/stream-wording-pin.test.mjs` と `src/mind/fixtures/` は差分 0・未追跡でもない |
| 依存・lockfile・`src/memory/`(`_conventions.md` の種) | 差分 0(`package.json`・`pnpm-lock.yaml`・`apps/soul/agent/package.json` も 0) |
| 新規ファイルの数 | 実装 1(`skills/venue-discord.md`)・テスト 3(15 + 9 + 4 = 28 件。2099 → 2127 の増分と一致) |

## 3. 止める指摘

**0 件**。

## 4. 止めない指摘(持ち越し)

1. **「話し始め」のメーターがロールの方式を先に読む(G で直す)**。`src/cockpit/view-logic/glance-meters.mjs:270` は `role.speakStartMode` を `s.speakStart` より先に読むので、Discord の場の間もロールの方式(例「従来」)を出す。Gnome 自身が気づいて報告 §14 に書いている。計画 §1 G の範囲(「Discord の場では話し始めの方式を選ばせない」)なので F では止めない。G の最初に `speakStartFixed === true` を見て直す。
2. **コメント反応を Discord の場で判定しない守りにテストが無い**(`cockpit-server.mjs` の commentReact の `isActive` に足した `!venueFixesSpeakNow()`)。計画 F の約束の外(設計 §8「コメント反応は Discord では作らない」の守りとして Gnome が足した裁量)。差分を読んで、配信ではこの項が常に true なので配信が変わらないことは確かめた。偽のチャット器官を組むテストは G か人間ゲート 2 のあとで足してよい。止めない。
3. **Discord の場でも手でチャットをつなぐ口(`POST /api/chat/connect`)が通る**。Gnome 報告 §14。画面で出さない / 断るかは G。
4. **言い回しの調整は人間ゲート 2 で**(通話の語・Discord の判定の文面・`venue-discord.md`)。計画どおり。
5. **`venueFixesSpeakNow()` は `discordVenueActive()` の別名**。今は体験が 1 つ(Discord)だけ固定なのでそれで足りる。Gnome が 2 つ目の体験が増えたら口の項目へ移す余地を書いている。好みの範囲で、直す指摘にはしない。

## 5. 裁量の評価

| 項目 | 評価 |
|---|---|
| 固定を体験の口の項目でなく体験の種類 `"discord"` で決めた(§13-1) | **妥当**。設計・計画が「Discord では」と書いている。口の書き忘れで Discord の場が配信の予定で動く道が残らない。体験が 1 つ増えるときに口の項目へ移せる。 |
| Discord の場でコメント反応を判定しない守り(§13-5) | **妥当**。配信では常に true なので配信は変わらない。テストが無い点は上の 4-2。 |
| `POST /api/speak-start` を Discord の場の間は 409 で断る(§13-3) | **妥当**。設計 §8「『従来』は Discord では選べない」に合う。ロールの保存値を書かない(`onSetSpeakStartMode` を呼ばない)ことをテストで固定している。配信の場の間の 409(配信の文面)・閉じている間の切り替えは前のまま。断りの文面が Discord 用で、固定だと分かる。 |
| snapshot の `speakStartFixed`(§8) | **妥当**。既存の `speakStart` を Discord の場で `"speak-now"` にし、新しい `speakStartFixed` で固定を示す。配信の既存の項目・値は変わらず(`speakStartFixed: false` が足されるだけ)。scheduler 未注入は null で `speakStart` と同型。 |
| 予定を「畳んだまま」にする(§13-2) | **妥当**。fire-scheduler の `dispose` の契約(タイマを張らない・以後のイベントは無視)で自発の ON/OFF・口数の置き場として使える。`setEnabled` / `setVerbosity` は `armSilence` の `disposed` の守りで畳んだままタイマを張らないことをコードで確かめた。閉じて配信を開けば `renewFireScheduler` が畳んだ予定から値を引き継ぐ。 |
| 「避けるか」の Discord の入力に名前を付けた(§13-6) | **妥当**。speak-now の Discord の入力と揃えた。配信は付けないまま(C の追認 (2) どおり)。 |
| 選択肢は配信と同じ 5 つで、待つ・応答の説明だけ通話の語(§13-8) | **妥当**。共有できる説明は配信の文をそのまま使い、書きっぷりを 1 か所に保つ。 |
| 「避けるか」の組を `{ buildInstructions, buildInput }` にし、predicate の名前・しきい値・答えの読み方は組の外に固定(§13-10) | **妥当**。`decideRecallAvoid` が名前 `avoid` で読むので、組が名前を替えて判定が壊れる道を閉じる。 |

## 6. 計画 §1 Domain F の各項目の充足

| 約束 | 結果 |
|---|---|
| C の判定の差し口に Discord の問い(誰かが話したあと、今しゃべるか)・you の名前つき行の語を Discord の語に | 満たす。`DISCORD_SPEAK_NOW_QUESTIONS`(`speak-now.mjs`)・ラベル「参加者」(名前つきで「参加者(名前)」)。テスト `wording-discord-f.test.mjs`(問い・選択肢・入力・相槌の指示の全文) |
| Discord では speak-now に固定(ロールの方式を読まない・「従来」は選べない)。配信は両方選べる | 満たす。`effectiveSpeakStartMode()`、`isActive` が使う。テスト: ロールが「従来」でも Discord の場で Discord の問いで判定する・配信に戻ると「従来」のまま判定しない・409(`cockpit-server-discord-f.test.mjs`) |
| Discord では自発の発火の予定(沈黙・turn-end・合いの手・call)を作らない。自発のつまみは判定の ON/OFF として残る | 満たす。段 3 で `parkFireScheduler()`。本物の `createFireScheduler` と偽の時計でテスト(2 人の VAD・転写・名前の呼びかけ・自発の OFF/ON・30 分進めても、タイマ 0 本・予定からの発火の頼み 0・発火 0)。配信は予定を作り直し、沈黙のタイマが張られることも対でテスト |
| 名前を呼ばれたかで器が判定を飛ばす道が無い | 満たす。名前の照合は fire-scheduler の call の中にしかなく、Discord では畳んでいる。判定が「待つ」なら名前を呼ばれても発火しないことを部品とサーバの両方でテスト(`wording-discord-f.test.mjs`・サーバのテスト) |
| 思い出しの「避けるか」の差し口 `judgeSet.recallAvoid` と `normalizeVenueWords` の対応・Discord の文面。配信の文面は不変 | 満たす。`resolveRecallAvoidQuestions` は speak-now と同じ決まり(欠けは配信で埋める・型違い・知らない項目は TypeError)。`createRecallDesk({ recallAvoid })`、サーバが `venueJudgeSet()?.recallAvoid` を渡す。テスト: HEAD の文を書き写して一字ずつ比べる・形の確かめ・係が Discord の組で判定する |
| 通話の語の組 7 項目(`assertVenueWording` を通る)・`conventionsNote` の 1 行。`_conventions.md` と種は不変 | 満たす。`CALL_WORDING`(凍っている)。②④の頼みの手順 1 の 1 行を固定。「配信」が出るのは決まりの 1 文と記録の呼び名だけで、viewer の説明は無い。`_conventions.md`・`src/memory/` は差分 0 |
| `skills/venue-discord.md` があり Discord の場で①に足される。配信では足されない。ファイルがあることもテストで固定 | 満たす。`existsSync`・見出し欄・全文・最後に足される・`listVenueSoulSkills` 経由・配信の①に「Discord」が入らない、をテスト(`wording-discord-f.test.mjs`・`scripts/cockpit-discord-f.test.mjs`)。`SOUL_SKILL_NAMES` には入っておらず、配信の `FIRE_SYSTEM_PROMPT` は不変 |
| Discord の体験の口に `wording`・`teaching`・`judgeSet` | 満たす。`createDiscordExperience` の戻り値。`scripts/cockpit-discord-f.test.mjs` と更新した `cockpit-discord-d.test.mjs` で本物の `createDiscordVenueExperience` から確かめている |
| snapshot で Discord の場の方式の固定が読める(項目名・値が報告にある) | 満たす。報告 §8 に表がある。実物は `speakStart` と `speakStartFixed`。サーバのテストで 3 状態(配信・閉じている・Discord)を確かめている |
| 同じ日の配信と通話で本体のファイル名が別になる | 満たす。`scripts/cockpit-discord-f.test.mjs`(本物の `createRoleMemoryPlaces` → `resolveStreamRecordBaseName`、記憶の根は `os.tmpdir()`)。配信が先: `2026-11-01` → `-2` → `-3`、通話が先: `2026-11-01` → `-2` |
| C の持ち越し: `memory.test.mjs` の題名と `venue-wording.mjs` の頭のコメントのファイル名 | 満たす。題名だけ変え、期待値(中身)は変えていない(差分 1 行)。コメントのファイル名を `wording-discord-c.test.mjs` に直した |

## 7. 期待値・呼び出しを変えた既存テスト

差分で確かめた。**配信の期待値を変えたものは 0 件**。仕様変更として筋が通る 5 行:

| 所 | 変更 | 判断 |
|---|---|---|
| `scripts/cockpit-discord-d.test.mjs:75-77` | Discord の口の `wording` / `teaching` / `judgeSet` が null → 通話の語・`venue-discord`・判定の組 | D は「言葉と判定の組は F」として null を固定していた。F の約束そのもの。**妥当** |
| `src/cockpit/cockpit-server-discord-c.test.mjs:207` | `normalizeVenueWords({ judgeSet: {} }).judgeSet` が `{ speakNow: null }` → `{ speakNow: null, recallAvoid: null }` | 判定の組の形に `recallAvoid` が増えたため。**妥当** |
| 同 `:214` | 「知らない項目」の例を `recallAvoid` → `commentReact` | `recallAvoid` が知っている項目になったので。テストの趣旨(知らない項目は投げる)は変えていない。**妥当** |
| `src/mind/memory.test.mjs:58` | 題名だけ | C の持ち越しどおり。期待値と中身は不変 |

## 8. 配信の文字列の独立の比較

- **方法**: `git archive HEAD` で `apps/soul/agent/src`・`skills`・`package.json` をスクラッチパッドの一時フォルダに取り出し、スクラッチの下に置いた 1 本の比較スクリプト(`apps/soul/agent/` の外。`node --test` は拾わない)を HEAD の版と今の作業ツリーで走らせ、出力を `cmp` した。スクリプトは配信の場面(語の組なし・体験の口は null・`createSpeakNowController` / `createRecallDesk` に問いの組を渡さない)だけを使う。終わったら一時フォルダは消した(`apps/soul/agent/tmp/` には何も置いていない。元の 2 つのまま)。
- **項目数**: 69 項目が **HEAD と今で一字も違わない(`cmp` が一致)**。内訳:
  - 固定テストの呼び出し一覧(`streamWordingPinCases`)の全ケース: ①への行・②の固定の指示と頼み・④の固定の指示と頼みと結果の文面・`skills/recall.md`・判定の入力など。
  - speak-now の判定に実際に渡る要求(`input` / `instructions` / `choices`)を、3 つの名前 × 4 つの口数(quiet / normal / chatty / 未指定)で採取(12 項目)。ラベル・相槌の指示・窓・発火する選択の定数と問い。
  - 思い出しの係が判定に渡す要求(`input` と `questions`)と、係が①に発火するときの文面を、3 つの名前で採取。見つからない・失敗・自発 OFF の道の文面。`recallAvoidQuestion(name)` の戻り。
  - `FIRE_SYSTEM_PROMPT`・`buildFireSystemPrompt()`・既定の教え(`loadSoulSkills()`・`listSoulSkills()`・`SOUL_SKILL_NAMES`)・②の固定の指示と頼み・④の固定の指示と頼みと結果の 7 文面・「避けるか」の入力 3 通り(窓あり・会話なし・広い窓)・`STREAM_WORDING`。
- 採取の出力が空でないこと(判定の要求・係の判定の要求が実際に捕まっていること)も目で確かめた。
- そのほか: 固定テスト 36 件は pass。呼び出しも期待値も fixture も差分 0。

## 9. 守りの決まりの確かめ方と結果

- 鍵 `.env*.local`: 中身は開いていない。差分とテストのコードに鍵を読む箇所は無い(`loadToken` はテストで差し替え。`.env.discord.local` の文字列は偽の `currentKeyFile` が返す名前だけ)。
- 実 ID: 差分(追跡中の差分と新規ファイル)に 15 桁以上の数字・サーバー / チャンネルの実 ID は無い。
- ログ: 追加行に `console`・`log(`・`warn(` の新しい行は無い。文字起こし本文・名前・Discord の id を出す行は増えていない。
- 実データ: `cockpit-settings.local.json`(2026-11-01 08:24)・`codex-rollouts.local.json`(08:34)・`memories/`(10-31)・`roles/`(10-31 / 11-01 08:24 の `role.json`)の mtime は、HEAD の時刻(09:58)より前で、F の作業の時間帯には触られていない。`tmp/` も元のまま。
- 依存・lockfile: 差分 0。
- テストの書き込み: `scripts/cockpit-discord-f.test.mjs` は `os.tmpdir()` の下に作って後始末している。サーバのテストは偽の耳・偽の orchestrator・偽の口・偽の時計で、本物の Discord・LLM・外部 API には触れない。

## 10. 質問(Orch-Sylph へ)

止める質問は無い。次の 2 点だけ申し送る。

- G の最初に直すもの: `glance-meters.mjs:270`(上の 4-1)。
- コメント反応の守り(上の 4-2)にテストを足すかは Undine の判断でよい。
