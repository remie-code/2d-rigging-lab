# Domain A — 会話の正本を場へ・話者の形 完了報告

> Orch-Sylph → Undine(2026-10-31)。計画: [../../orchestration/discord-mode-wave-plan.md](../../orchestration/discord-mode-wave-plan.md) §1 Domain A。
> 判定: **escalate**(実装とレビューは合格。ループ 1 回、止めた指摘 0 件。設計 §3.2 と計画 §1 の「期待値を変えてよい既存テストは 1 件だけ」がぶつかる 1 点だけ、Undine の判断を待つ。下の §9 質問 1)。
> 判断が (b) か (c) なら、このままコミットしてよい状態。(a) なら Gnome の直し 1 か所 + 既存テストの assert 1 行 + レビューの見直しが要る(Orch-Sylph を SendMessage で再開すれば回す。または Domain C の委任に入れる)。
> 実装: Gnome(opus)→ [domain-a-gnome.md](domain-a-gnome.md)。レビュー: Review-Sylph(sonnet)→ [../../reviews/discord-mode/domain-a.md](../../reviews/discord-mode/domain-a.md)。
> コミットはしていない(ブランチ `ai-cohost/discord-mode`、HEAD `6327a42b`)。鍵(`.env*.local`)・実データ(`cockpit-settings.local.json`・`memories/`・`roles/`)には誰も触れていない。操縦席は起動していない。依存・lockfile の変更なし。

## 1. 機械ゲート

| ゲート | 結果 |
|---|---|
| `apps/soul/agent` で `node --test` | **1938 pass / 0 fail / 0 skipped**(土台 1884 → +54: 固定テスト 36・耳 5・話者の形 8・サーバ 5)。Gnome とレビューの両方で実行 |
| 根で `pnpm run check:soul-zone` | pass(1572 files) |
| 依存・lockfile | 変更なし |
| 本物の LLM・外部 API・Discord | 呼ばない |

## 2. 変えたファイル(`apps/soul/agent/` 起点)

- 変更(14 ファイル、+264 / −108): `src/cockpit/cockpit-server.mjs`、`src/ears/ear-pipeline.mjs`、`src/ears/transcript-buffer.mjs`、`src/mind/fire-orchestrator.mjs`、`src/mind/fire-injection.mjs`、`src/mind/speak-now.mjs`、`src/mind/comment-react.mjs`、`src/mind/memory.mjs`、`src/mind/recall.mjs`(コメントだけ)、テストの偽の耳 5 ファイル(`src/cockpit/cockpit-server.test.mjs`・`src/cockpit/cockpit-server-domain-e.test.mjs`・`scripts/cockpit.test.mjs`・`scripts/cockpit-stream.test.mjs`・`scripts/cockpit-role-edit.test.mjs`)。
- 新規: `src/mind/stream-wording-pin.test.mjs`、`src/mind/fixtures/stream-wording-pin-input.mjs`・`-calls.mjs`・`-expected.mjs`、`src/mind/speaker-shape-discord-a.test.mjs`、`src/ears/ear-pipeline-discord-a.test.mjs`、`src/cockpit/cockpit-server-discord-a.test.mjs`。

## 3. 配信の文字列の固定テスト

- ファイル: `src/mind/stream-wording-pin.test.mjs`(36 件)。入力・呼び出し・期待値を fixture 3 本に分けた(Domain C は `-calls.mjs` だけを合わせればよく、期待値と入力は触らない)。
- 対象: ① `formatFireInjection`・`formatFireInjectionSince`、② `WRITER_SYSTEM_PROMPT`・`formatTranscriptForDigest`・`buildWriterRequest`、④ `RECALL_SYSTEM_PROMPT`・`formatRecentConversation`・`buildRecallRequest`・結果の 7 関数、`skills/recall.md` の本文(`loadSoulSkills({ names: ["recall"] })` を通した①に渡る本文。生のバイトではないので C の印の差し込みでも守れる)、判定の入力 `buildSpeakNowInput`・`buildSpeakNowInstructions`・`buildSpeakNowChoices`・`buildCommentReactInput`・`buildRecallAvoidInput`。入力の転写は you / soul / 名前つき viewer / 名前の無い viewer / 窓の外の行 / 空白の名前を含む。
- 期待値は文字列リテラルで `assert.strictEqual`。今の関数で組み直して比べていない。
- 採取時にコードが未変更だった証拠: 採取の前後とも `git diff --stat` 空、`git diff --quiet HEAD -- apps/soul/agent` exit 0(Gnome 報告 §1)。
- 独立の照合(レビュー): HEAD のソースを `git archive` で gitignore 済みの一時フォルダに取り出し、今の固定テストと fixture を置いて走らせ 36/36 pass。HEAD の語を 1 語ずつ変えると 6 件落ちる(感度あり)。一時フォルダは削除済み。

## 4. 期待値を変えた既存テスト

- **0 件**。計画が許していた `chatBufferAbsent`(`cockpit-server.test.mjs:1901` 付近)も変えずに通る。正本の寿命を「場が開いている間」にしたため、場が閉じている間は今も正本が無く、この分岐が今まで通り効く。
- 偽の耳の直し 7 か所(どれも `options?.transcriptBuffer ?? 自前` の 1 行。期待値は変えない): `cockpit-server.test.mjs` の `makeFakePipeline`・`makeOnAppendPipeline`、`cockpit-server-domain-e.test.mjs` の `makeEars`、`scripts/cockpit-role-edit.test.mjs` の `makeEars`、`scripts/cockpit-stream.test.mjs` の偽の耳、`scripts/cockpit.test.mjs` の `pipelineFactory` 2 か所。レビューが差分で確認(assert の値・件数・削除・skip なし)。

## 5. `onAppend` の持ち主と耳ごとの情報

- 正本は場が持つ: `cockpit-server.mjs` の `openStream` の 4(耳の Start の直前)で `openVenueTranscript()` が `venueTranscript` を作り、耳に `transcriptBuffer` として渡す。手放すのは `stopEars` の中・`openStream` の `fail()`・`close()`(冪等)。サーバで正本を読む 15 か所(13 + 耳の中の discard 購読 2)はすべて場の正本を読む。`pipeline.transcriptBuffer` を読む所は残っていない。
- `onAppend` は**場が 1 回だけ張る**(追記 → 発火の予定と speak-now、破棄 → discard の放送)。耳 2 本が同じ正本に積んでも 1 行 1 回(耳とサーバのテストで確認)。
- 耳ごとの情報は**耳ごとの口から引く**: 外から正本を渡された耳は `onAppend` を張らず、自分が積んだ行だけに `onTranscript(entry, { latencyMs, audioCtx })` を直に呼ぶ。サーバのこの口が soul / viewer を放送しない除外・遅延ログ・you の放送を受け持つ。渡されなければ耳は今まで通り自分で作って `onAppend` を張る。
- 配信のふるまい(放送・speak-now・遅延ログ・除外・discard の放送)は順序も含めて従来どおり(レビュー確認)。

## 6. 話者の形

- `transcript-buffer.mjs`: 名前をどの話者にも許し、任意の `speakerId`(文字列)を持つ。
- `fire-orchestrator.mjs` の `speaker: "soul"` 6 か所に、`getSoulSpeaker` からロールの id(`speakerId`)と名前(`canonicalName` → `displayName`)を載せる。
- 整形: ①は名前のある you を `you(名前): 本文`。speak-now とコメント反応の判定の入力は `配信者(名前): 本文`。soul はどこも今のまま。**②④(`memory.mjs` の `formatDigestLine`)は名前をまだ付けていない**(§9 質問 1)。思い出しの「避けるか」の入力にも付けていない(質問 2)。
- `speakerId` は①②④・判定・ログ・放送・`/api/state` に出ない(テストで確認)。放送の soul の `displayName` は null(配信で出ていなかったロールの名前を新たに出さない)。配信で出る文字列は変わらない(固定テストで確認)。

## 7. `startMs` の確かめ(設計 §3.1・§12.3)

- 変更後の `src/`・`scripts/` で、`startMs` / `endMs` を耳をまたいで比べている所は**無い**(`inRange` を呼ぶ所も無い)。Gnome とレビューがそれぞれ grep で確認し、結論が一致。

## 8. 裁量(レビューが筋が通ると認めたもの。全 9 項目は domain-a-gnome.md §7)

1. 耳ごとの情報は耳ごとの口から引く(§5)。
2. 正本の寿命は「場が開いている間」(作るのは耳の Start の直前、手放すのは `stopEars`・`fail()`・`close()`)。閉じた後も残す形にはしない(閉じた後の転写や `chatBufferAbsent` が変わり、配信のふるまいが変わるため)。違いは、配信を始める途中・耳の Start の前にも正本があること(設計 §3.1「耳が無くても正本はある」)。
3. 正本の時計はサーバの `nowImpl`(本番は `Date.now` で従来と同じ)。
4. soul の名前は `normalizeModelIdentity(currentRoleIdentity()).canonicalName`、id はロールの id。ロールの口が無ければ載せない。
5. 放送の soul の `displayName` は常に null。you は名前があれば載る(配信では null のまま。G が使える)。
6. 判定の入力の名前つき you は `配信者(名前)`(コメント反応の `視聴者(名前)` と同じ形)。語の差し替えは C / F。
7. `buildRecallAvoidInput` には名前を付けない(質問 2)。

## 9. 質問(Undine へ)

1. **②④の整形に名前つき you の `you(名前):` を入れるか**(判定を escalate にした理由)。
   - 設計 §3.2・計画 §1 は整形の所(memory を含む)に「名前があれば付ける」と書く。一方、既存の `memory.test.mjs:58-65`「formatTranscriptForDigest: 名前のある viewer 行だけ `viewer(名前):` にする(…viewer 以外には付けない)」が `{ speaker: "you", displayName: "名前は付かない" }` → `you: やあ` を固定しており、計画 §1 が期待値の変更を `chatBufferAbsent` の 1 件しか認めていないため、Gnome は付けずに返した。
   - 配信への影響は無い(配信では you に名前を入れない。このテストは配信の場面ではない。固定テストは守られる)。影響が出るのは Discord の②の材料と④の会話だけ。
   - 選択肢: (a) A の直しとして `formatDigestLine` に 1 行足し、上のテストの最後の期待値 1 行を `you(名前は付かない): やあ` に変える(設計 §3.2 による変更として一覧に載せる)。(b) Domain C(語の組)か F(Discord の②④)で入れる。(c) ②④には付けない(設計 §3.2 の変更)。
   - Review-Sylph の見立ては (a) が設計に最も素直、(b) でも同じ結果。Orch-Sylph も (a) か (b) を推す。名前が②④に届くことは recall-flow §10「名前は残してよい」の Discord での効き目に関わるので、(c) は勧めない。
2. **`buildRecallAvoidInput`(思い出しの「避けるか」の判定)に名前のある you の名前を付けないでよいか**。もともと視聴者名を落とす話題判定で、名前は要らない。レビューも止める理由に当たらないと見る。Orch-Sylph は「付けない」でよいと考える。

## 10. 持ち越し(次のドメインへ)

- **Domain B**:
  - `openVenueTranscript` / `releaseVenueTranscript` と、耳ごとの口(`startEars` の `onTranscript`)が、場の共通の段 / 体験の口に移すときの切れ目。Discord の人ごとの耳は、同じ正本と耳ごとの口を受け取れば N 重にならない(耳の側は `ear-pipeline-discord-a.test.mjs` で確認済み)。
  - 正本の寿命を「耳を畳むとき」(今は `stopEars` の中で手放す)から「場を閉じるとき」に寄せるかを決める(Discord で耳が抜けても場の正本が続くように)。
  - `startEars` で `venueTranscript` が null のときの防御(今は到達しない)。
  - `chatBufferAbsent` の診断の文面が `ears not running` のまま(テストで固定。変えるなら期待値の変更)。
- **Domain C**: 固定テストの呼び出し(`src/mind/fixtures/stream-wording-pin-calls.mjs`)だけを②④の「共通部分 + 語の組」と `skills/recall.md` の差し込み口に合わせる。期待値と入力は触らない。質問 1 が (b) なら②④の名前つき you もここで。
- **Domain F / G**: 判定の「配信者(名前)」の語の差し替え(F)。画面の名前の表示(G。放送の you の `displayName` は既に載る)。
- 2 つ目のロールのときに soul の整形へ名前を足す(正本には既にロールの id と名前がある)。

## 11. 起動した子

| 役 | モデル | agentId | 状態 |
|---|---|---|---|
| Gnome(実装) | opus | `ab565466a26feea6f` | 完了(報告 domain-a-gnome.md を回収、hand-back 受領) |
| Review-Sylph(レビュー 1 回目) | sonnet | `ac54a6ae1820f99b1` | 完了(レポート reviews/discord-mode/domain-a.md を回収、hand-back 受領) |

生き残りの子は無い。
