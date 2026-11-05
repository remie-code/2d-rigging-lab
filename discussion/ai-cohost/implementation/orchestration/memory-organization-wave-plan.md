# 記憶の整理(③整理役)の実装計画

> Status: 着手(ユーザー 2026-11-04「OK、ブランチ切って実装に入ってくれ」)。ブランチ `ai-cohost/memory-organization`(master `a305eaa8` から)。
> 根拠: 設計 [../../memory/organization.md](../../memory/organization.md)、決定 [../../memory/_map.md](../../memory/_map.md) §4、コードの棚卸し [../../memory/organization-code-inventory-2026-11.md](../../memory/organization-code-inventory-2026-11.md)(以下「コード棚」。file:line はこちら)。

## 1. 体制

- Undine → ドメインごとに Orch-Sylph(opus)→ Gnome(opus)+ Review-Sylph(sonnet)。
- ドメインは A → B → C の順(B は A の git の口を使い、C は B の口を結線する)。
- **機械ゲート(各ドメインの合格の条件)**:
  - `apps/soul/agent` で `node --test` が全件 pass。土台は A の Orch-Sylph が着手時に数えて報告に書く。
  - リポジトリの根で `pnpm run check:soul-zone` が pass。
  - 依存と lockfile は変えない(要るなら escalate)。
- **守ること(全ドメイン)**:
  - テストと子エージェントは実データに触らない: `cockpit-settings.local.json`、`memories/`、`roles/`、`session-usage/`、`fire-diagnostics/`、`memory-backups/`、`.env*`(読まない)。
  - 操縦席を起動しない。本物の LLM・外部 API を呼ばない。
  - テストの git は一時フォルダに作る。
  - ④思い出し役の文面は一字も変えない。②の文面は §2 の指定どおりだけ変える。
  - ログと警告に本文・名前・id を出さない。

## 2. Domain A — 書き出し役の名前を soul から外す

設計 §4・§6「始める前」。コード棚 §1・§4・§5。

**触る所**: `src/mind/memory.mjs`、`src/memory/memory-store.mjs`、`scripts/cockpit.mjs`(場ごとの名前の持ち回り `streamRecord` のみ)、`src/memory/conventions-seed.md`、`src/mind/fixtures/stream-wording-pin-expected.mjs`(`writer.request.*` のみ)、それぞれのテスト。

1. **git の口**(`memory-store.mjs`):
   - **コミットで足された・変わったファイルの一覧**: `diff-tree --root -r --name-status -z --no-renames`。非 ASCII の名前を壊さない。
   - **今の先頭**(HEAD のハッシュ)。
   - **コミットされていない変更を捨てる**: 追跡済みは HEAD に戻し、追跡外は消す。`.gitignore` されたものは残す。
   - B で使うので export する。
2. **本体の名前を soul が決めない**:
   - `resolveStreamRecordBaseName`・`findStreamRecordFiles`・`createStreamRecordIdentity` の役目を外す。
   - 代わりに、場の保存ごとに、そのコミットで**足された・変わった本体**(名前が `_` で始まらない `.md`。深さは問わない)をためる。場の間、操縦席の `createRoleMemoryPlaces` の持ち回りで保つ。
   - 次の保存の頼みで伝える。場が閉じたら捨てる。
3. **書いていないの判定**(`detectWriterMiss`): 名前ではなく「そのコミットで本体が 1 つも足されても変わってもいない」で見る。足りなければ今どおり 1 回だけやり直す(化けのやり直しと合わせて 1 回の枠は今どおり)。
4. **始める前に捨てる**: 書き出し役を呼ぶ前に、コミットされていない変更を捨てる。
5. **頼みの文面**(`buildWriterRequest`)。日付の行・手順・材料の行は一字も変えない。変えるのは、ファイル名の行と既存の行だけ:
   - ファイル名の行(新しい場・続きの場とも)を次に置き換える:
     `- 本体のファイル名と置き場所は、\`_conventions.md\` の決まりに従ってあなたが決めます。置くトピックのフォルダは、全体の目次を見てあなたが決めます（既存のトピックを使うか、新しく作るか）。話題が複数あってトピックを分けるときも、どのトピックでも同じファイル名にします。`
   - 続きの場の行を次に置き換える(`${files}` は「、」ではなく今どおり `, ` で並べる):
     `- 今回の${w.venue}の前回までの保存では、次のファイルに書きました: ${files}。作り直さず、今ある内容を残したまま、下の材料をもとに書き足し・直してください。新しい話題で別のトピックに分けるときだけ、そのトピックに同じファイル名で本体を足します。`
   - 新しい場の行(`- 今回の${w.venue}の本体はまだありません。新しく書きます。`)は変えない。
   - 固定のテスト `writer.request.new` / `writer.request.existing` を、これに合わせて書き直す(ユーザー OK の例外)。ファイル冒頭の注意書きに、この例外の日付と根拠を 1 行足す。
6. **種の決まり**(`conventions-seed.md`): 本体のファイル名の段落を「同じ日付の本体が、どのトピックのどの棚(年と月のフォルダ)にあっても、次の番号を付けます」に直す。ほかは変えない。
7. **化けの検査**: 書き出し役のコミットには今どおり掛ける。

## 3. Domain B — 整理役の本体

設計 §5・§6。A の git の口を使う。

**触る所**: 新しいモジュール(置き場は Orch-Sylph の裁量。例 `src/mind/organizer.mjs`)、`src/memory/memory-store.mjs`(足りない口だけ)、`apps/soul/agent/.gitignore`(`memory-backups/`)、テスト。結線(cockpit)はしない。

1. **整理の時期か**: 記憶の git で最後の `整理役 ` で始まるコミット(`Revert` は除く)から 7 日以上たっているか、または一度も無いか。時計は注入する。
2. **1 回の整理**(注入: 頭を作る口・時計・控えの置き場):
   1. コミットされていない変更を捨てる。
   2. 控えを作る: `git bundle create <控えの置き場>/<role>/<JST の日時>.bundle --all`。直近 4 個を残し、古いものを消す。作れなければ、その回は走らず、警告を出して「走らなかった」を返す。
   3. 先頭と、本体の中身の一覧(中身のハッシュの組。名前が `_` で始まらない `.md` すべて)を控える。
   4. 使い捨てのセッションで頼む。作り方は書き出し役と同じ: cwd = 記憶の置き場、`workspace-write`、最後の答えだけ、ephemeral。頼みの待つ上限は既定 30 分(注入で変えられる)。
   5. 見張り: 先頭が同じ、かつ本体の中身の一覧が同じ。だめなら変更を捨ててコミットしない(警告は中身なしの英語 1 行)。
   6. 合格なら soul がコミットする(役名 `整理役`。今のコミットの書式に合わせる)。変更が無ければ空のコミット `整理役 <日時>(変更なし)`。
   7. 化けの検査は掛けない。
3. **打ち切りの口**: 走っている整理をすぐ止める(セッションを閉じ、変更を捨てる。時刻は進まない)。C の Ctrl+C で使う。
4. **頼みの文面**(固定。固定のテストを足す)。指示(systemPrompt)は書き出し役の指示に倣い、場の語の組には依存させない。頼みの本文は設計 §5 の 5 手順。加えて、次を入れる:
   - 「目次など本体でないファイルは名前を `_` で始める」。
   - 「本体のファイルは動かすだけで、中身は一字も変えない(見張りで確かめる)」。
   - 「フォルダの外には書かない」。
   - 「git のコマンドは使わない(コミットは魂がする)」。
   文面の案は Gnome が書き、Review-Sylph がこの節と設計 §5 に照らす。Undine が最後に読む。

## 4. Domain C — 閉じの流れと「整理中」

設計 §7。B の口を結線する。

**触る所**: `scripts/cockpit.mjs`(場の閉じ・終わりの流れ・役ごとの置き場)、`src/cockpit/cockpit-server.mjs`(閉じの段階の状態と SSE)、操縦席の画面(閉じの表示)、テスト。

1. **場を閉じる操作**(配信を終える・通話を終える)。閉じの書き出し(`saveFinal`、今の 90 秒の上限のまま)のあと、整理の時期なら整理を走らせ、終わるまで上限なしで待つ。新しい文字起こしが無い閉じでも、時期なら走らせる。
   - 頭は書き出し役と同じく `resolveWriterBrainDef` で決める。
   - 閉じの段階(`closing`)のまま、整理中であることが状態と SSE で分かる印を足す。
   - 画面には閉じの文言に代えて「整理中」が分かる表示を出す(文言の案は Gnome。例「記憶を整理しています…」)。
2. **Ctrl+C**: 書き出しは今どおり最大 90 秒待つ。整理は B の打ち切りの口ですぐ止めてから終わる。
3. **見え方**: ターミナルに開始と終了の 1 行を出す(中身なし。例 `memory: organising (role chappy)` / `memory: organised (commit …)` / `memory: organising skipped: …`)。
4. 配信と Discord の両方の場で同じ。
5. A からの片付け: 場ごとの持ち回り(`createStreamRecordLog`)で、コミットの一覧に `D`(消えた)がある本体は外す。範囲外の古いコメント(`cockpit.mjs` の main・`createStreamVenueHooks` の JSDoc、`cockpit-server.mjs` の 778・2959 行付近)を今の動きに合わせる。`stream-wording-pin-calls.mjs` の使われない `baseName` 引数を外す(pin の期待値は変えない)。

## 4b. Domain D — サブトピックと月の目次・上限の撤去(人間ゲート 1 回目の所見から)

設計 §2・§3・§5(2026-11-05 改訂)、決定 [../../memory/_map.md](../../memory/_map.md) §4「サブトピックの目次は整理役の必須の仕事」。1 回目の整理(記憶の git `224825b`)では棚への引っ越しは済んだが、話題の目次が「作るかは裁量」だったため作られなかった。あわせて、時系列の目次を月の棚ごとにし、たどり方を `_conventions.md` に一本化する。

**触る所**: `src/mind/memory-organizer.mjs`(頼みの文面・待つ上限)、`src/mind/memory.mjs`(②の手順 4 の 1 行だけ)、`src/mind/recall.mjs`(④の手順 2 の 1 行だけ)、`scripts/cockpit.mjs`(上限を渡しているなら外すだけ)、固定のテスト(整理役の文面・`stream-wording-pin-expected.mjs` の `writer.request.*`・④の文面の固定があればそれ)とその他のテスト。②・④のほかの行、`conventions-seed.md` は変えない。

**以下の文面は Undine の指定(ユーザーが全文を読んで OK)。一字一句そのまま使う。** 括弧は今のコードどおり全角。

1. **整理役の頼み**(systemPrompt は変えない)。全文を次に置き換える。`${dateJst}` は整理を始めたときの日本時間の日付 `YYYY-MM-DD`(時計は注入どおり)。
   ```
   記憶の置き場を整理してください。

   - 今日の日付（日本時間）: ${dateJst}

   手順:
   1. `_conventions.md` と全体の目次 `_map.md` を読む。
   2. 各トピックの直下に本体があれば、名前の日付の `<YYYY>/<MM>/` へ動かす（例: `<topic>/2026-10-21.md` は `<topic>/2026/10/2026-10-21.md` へ）。本体の中身は一字も変えない。
   3. 月の棚ごとに、時系列の目次 `<topic>/<YYYY>/<MM>/_map.md` をそろえる。その月の本体が載っていなければ足し、目次が無ければ作る。トピックの目次に時系列の行が残っていれば、月の目次へ移す。年のフォルダには目次を置かない。
   4. どのサブトピックの目次にも載っていない本体を読み、当たるサブトピックの目次に足す。サブトピックは、トピックの中に作る、目次 `_map.md` だけを入れたフォルダです。サブトピックの中に、さらに細かいサブトピックを作ってもかまいません。サブトピックが無ければ作る。分け方とどこまで掘るかはあなたが決め、話題が増えたら分けたり合わせたりしてよい。本体はサブトピックのフォルダに入れず、年と月の棚に置いたまま目次から指す。1 件の本体を、いくつのサブトピックの目次に載せてもかまいません。
   5. トピックの目次 `<topic>/_map.md` を、そのトピックの入口として書き直す。そのトピックが何の話かの一言と、すぐ下のサブトピックの一覧（名前と一言）を載せる。サブトピックの目次にも、すぐ下にサブトピックがあれば同じように一覧を載せる。全体の目次は、トピックごとの行を今の置き方に合わせて直す。
   6. `_conventions.md` を、今の置き方・名前の付け方・目次のたどり方に合わせて書き換える。書き出し役と思い出し役は、これを読んで動く。書き出し役が新しい本体をどこに書き、どの目次に行を足すかも書く。サブトピックの目次が今日の整理までの本体を載せていることと、それより新しい本体は月の目次で探すことも書く。
   7. 書き終えてから、短く「済み」とだけ答える。

   守ること:
   - 名前が `_` で始まらない `.md` は、すべて本体として扱われます。目次など本体でないファイルは、名前を `_` で始めてください。
   - 本体のファイルは動かすだけで、中身は一字も変えないでください。整理のあと、魂が本体の中身が前と同じかを確かめます。違えば、整理はすべて取り消されます。
   - 本体のファイルは、書き直さずに移動のコマンドで動かしてください（中身を通さないので、1 バイトも変わりません）。
   - サブトピックのフォルダの名前は、トピックと同じく英小文字とハイフンにしてください。
   - このフォルダの外には書かないでください。
   - git のコマンドは使わないでください（コミットは魂がします）。
   ```
   (守ることは今の 5 行に 4 行目を足しただけ。今のコードの括弧が全角なら全角のまま。)
2. **②書き出し役の頼みの手順 4**(`memory.mjs` の `buildWriterRequest`)を次に置き換える。ほかの行は一字も変えない。
   `` `4. \`_conventions.md\` の決まりに従って、今回の${w.venue}に当たる目次の行を更新する（新しいトピックなら行を足す。記録の数と最後の日付も直す）。` ``
   (今: `4. トピックの目次と全体の目次の、今回の${w.venue}に当たる行を更新する（…）。`)
3. **④思い出し役の頼みの手順 2**(`recall.mjs`)を次に置き換える。ほかの行は一字も変えない。
   `"2. \`_conventions.md\` のたどり方に従って、目次からたどって探す。頼みごとの言葉がずれていても、下の直近の会話も手がかりにする。"`
   (今: `2. 全体の目次 \`_map.md\` → トピックの目次 → 本体、の順にたどって探す。頼みごとの言葉がずれていても、…`)
4. **待つ上限を外す**: 整理役の頼みには、どの層でも待つ上限を掛けない(`askTimeoutMs` の既定 30 分と、それによる timed out の道・警告の行を外す)。下の層(頭の ask)に既定の上限があるなら、整理役からの呼び出しでは掛からないようにする。書き出し役の上限は変えない。打ち切りは今どおり `abort()` / `signal`(Ctrl+C)だけ。
5. **固定のテスト**: 整理役・②・④の手書きの期待値を上の文面に合わせて直す(ユーザー OK の例外。ファイル冒頭の注意書きがあれば日付と根拠を 1 行足す)。警告の固定テストから timed out の行を外す。日付の行は注入した時計で固定する。
6. 一発の移行のためのコードは入れない(頼みを状態で書くので、棚にある本体・今の時系列の目次も次の整理で自然に移る。ユーザーの指定)。

## 5. 人間ゲート(全ドメインのあと)

手順は C の完了後に Undine が書く。見るのは次の 4 つ:
- 場を閉じたときに「整理中」が出て、終わってから閉じる。
- 記憶の置き場が年と月の棚になり、本体の中身が変わっていない。
- `_conventions.md` と目次が新しい置き方を説明している。
- 次の場で書き出し役が新しい決まりどおりに書く。

## 6. Status

- **Domain A 合格**(2026-11-05・1 周目)。テスト 2320 → 2341 件、check:soul-zone pass。報告 [../waves/memory-organization/domain-a-report.md](../waves/memory-organization/domain-a-report.md)、レビュー [../reviews/memory-organization/domain-a.md](../reviews/memory-organization/domain-a.md)。
  - B 向けの口(`memory-store.mjs`): `readCommitChangedFiles`・`readMemoryHead`・`discardUncommittedChanges`・`parseNameStatusZ`。`memory.mjs`: `isMemoryBodyPath`・`createStreamRecordLog`。
  - 裁量(Undine OK): 始める前に捨てると未コミットの種の `_conventions.md` が消えるので、HEAD に無ければそれだけ `魂 <JST>` でコミットする。ファイル一覧が読めなければ書けたとみなして警告する。捨てられなければ警告して続ける。
  - A の質問への Undine の裁定(下に続く)。
- **Domain B 合格**(2026-11-05・2 周目)。テスト 2401 件、check:soul-zone pass。報告 [../waves/memory-organization/domain-b-report.md](../waves/memory-organization/domain-b-report.md)、レビュー(文面の全文あり)[../reviews/memory-organization/domain-b.md](../reviews/memory-organization/domain-b.md)。
  - C の口(`src/mind/memory-organizer.mjs`): `checkOrganiseDue`・`organiseMemory`・`startMemoryOrganiser`(`{ done, abort() }`)・`DEFAULT_MEMORY_BACKUP_ROOT`。
  - 裁量(Undine OK): 頼んだあとの失敗はすべて走る前の先頭へ戻す。打ち切りはコミットの段に入ったら止めない。控えの名前は `YYYY-MM-DD_HH-MM-SS.bundle`。
  - B の質問への Undine の裁定: シェルの移動で名前が化ける心配は許容する(文面は変えない)。本体の名前は日付で、年と月のフォルダも ASCII、トピックの名前も決まりで英小文字とハイフンなので、移動で通るのは ASCII だけ。化けの元だったのは外のプログラムへのパイプで、PowerShell の移動のコマンドは化けない。仮に「?」に化けても Windows ではその名前のファイルを作れない。打ち切りの 1 行が C の 1 行と重なるなら、C の側で重ならないようにする。
- **Domain C 合格**(2026-11-05・1 周目)。テスト 2428 件、check:soul-zone pass。報告 [../waves/memory-organization/domain-c-report.md](../waves/memory-organization/domain-c-report.md)、レビュー [../reviews/memory-organization/domain-c.md](../reviews/memory-organization/domain-c.md)。
  - 閉じ: 書き出し(90 秒)→ 時期の確認(新しい文字起こしが無くても)→ 時期なら上限なしで待つ(`stream.organising`)→ 閉じる。書き出しが 90 秒で終わっていなければ、その回の整理は飛ばす(`memory: organising skipped: the writer is still saving`)。
  - Ctrl+C: 1 回目で走っている整理を打ち切り、新しい整理を始めさせない。書き出しは今どおり。
  - 画面の文言: 「記憶を整理しています…」・「整理中…」・札「整理中」。
  - C の質問への Undine の裁定: 書き出し中かの確認がロールごとでない件は、次の仕事として記録だけ(今はロールが 1 つ)。新しいロールの最初の閉じで整理が走るのは設計どおり。
- 人間ゲートの手順: [../waves/memory-organization/human-gate.md](../waves/memory-organization/human-gate.md)。
- **人間ゲート 1 回目**(2026-11-05 18:15): 整理が走った(記憶の git `224825b`)。本体 43 件はすべて中身そのままで年と月の棚へ。控え 1 個(約 250 KB)。ただし話題の目次は作られず、トピックの目次は月ごとに並べ直しただけだった。原因は設計に写すときの Undine の取りこぼし(決定は「話題は目次で引く」、設計と頼みは「作るかは裁量」)。→ Domain D。
- **Domain D 合格**(2026-11-05・1 周目)。テスト 2428 → 2433 件、check:soul-zone pass。報告 [../waves/memory-organization/domain-d-report.md](../waves/memory-organization/domain-d-report.md)、レビュー(整理役の頼みの全文あり)[../reviews/memory-organization/domain-d.md](../reviews/memory-organization/domain-d.md)。
  - 文面: 整理役の頼み・②の手順 4・④の手順 2 は、§4b の確定文面と byte 単位で一致(Gnome・Review-Sylph・Orch-Sylph が照合)。固定の期待値は `stream-wording-pin-expected.mjs`(②④)と `memory-organizer-wording-pin.test.mjs`。
  - 上限: 整理役から `askTimeoutMs`・既定 30 分・timed out の道と警告を外した。下の層(`codex-session.mjs`)の turn の待ちにはもともとタイマーが無い(RPC の応答待ち 15 秒だけ)。打ち切りは abort / signal のみ。
  - 裁量(Undine OK): 頼みは日付を受ける関数だけにした。時計は整理の始めに 1 回読み、頼みの日付と控えの名前に使う。
  - 残るリスク: 頭が固まると Ctrl+C まで「整理中」のまま(上限なしの設計どおり)。Codex の App Server 自身の上限は確かめられない(あれば失敗として走る前へ戻る)。
  - 確かめは来週の閉じで自然に走るのを待つ(ユーザー「来週まで待つでOK」)。手順は [human-gate.md](../waves/memory-organization/human-gate.md) §3c。
- A の質問への Undine の裁定: 範囲外の古いコメントと `stream-wording-pin-calls.mjs` の使われない `baseName` 引数は C で片付ける。②が同じ場の中で本体を動かした(`D`)ときは、持ち回りから外す。これも C で入れる(小さな直し)。
