# Domain L レビュー — 書き出し役の書き込みが「?」に化けたら取り消してやり直す

> Review-Sylph(読み取り専任)→ Orch-Sylph(2026-11-01)。対象: 未コミットの差分(ブランチ `ai-cohost/discord-mode`、HEAD `803cd53a`)と Gnome 報告 `waves/discord-mode/domain-l-gnome.md`。
> 判定の根拠: 仕様 `memory/writer-garble-2026-11-01.md` §5、計画 `orchestration/discord-mode-wave-plan.md` の「### Domain L」、実コード。鍵(`.env*.local`)・実データ(`memories/`・`roles/`・`session-usage/`・`fire-diagnostics/`・`cockpit-settings.local.json`)は開いていない。操縦席・本物の Bot / LLM / Codex・外部 API は起動していない。ソースもテストも変えていない(確かめ用のスクリプトは scratchpad〔os.tmpdir 配下〕だけ。git の試験はすべて一時フォルダ)。

## 判定: **合格**(止める指摘 0)

## 1. ゲート(自分で走らせた)

| ゲート | 結果 |
|---|---|
| `apps/soul/agent` で `node --test` | **2303 / 2303 pass・fail 0**(Gnome の数字を再現。土台 2281 から +22) |
| 根で `pnpm run check:soul-zone` | pass(1626 files scanned・器→魂 / 魂→器の違反なし) |
| `node --test src/mind/stream-wording-pin.test.mjs` | 36 / 36 pass |
| `git diff --stat`(`apps/soul/agent`) | 7 ファイル(+ 新規 `memory-garble.test.mjs`)。pin の fixture は **1 行(+1 −1)** |
| `git diff -- src/mind/fixtures/stream-wording-pin-expected.mjs` | 変わったのは `"writer.systemPrompt"` の値(32 行目)の 1 行だけ。足された文は指示の 1 文のみで、そのほかの文面は byte 単位で同じ |

## 2. 止めた指摘

なし。

## 3. 止めない指摘(持ち越し・小さいもの)

1. 【整形】`src/mind/memory.test.mjs`(新しい `RECORD` の定義行)に `const RECORD =Object.freeze(...)` と空白が抜けた行がある(`git diff` で確認)。文法は有効でテストも通る。直すなら 1 文字。
2. 【偽陽性の理屈上の穴・非常に稀】`isGarbledLine` は「`?` が 4 連以上・かつ行ぜんぶが ASCII」だけを見るので、書き出し役が視聴者のコメントなどを日本語を添えずに `????` だけの行として写した場合は化けと判定され、取り消し → やり直しでも同じなら「記録できなかった」になる(毎回同じ材料なら次の定期保存も同じ)。仕様どおりの見分けで、記憶の決まりは出来事の要約であり、実機の化けは行ぜんぶが `?` になる形なので、今は止めない。実機で「記録できなかった」が続いたら、この線を疑う。種(`conventions-seed.md`)には `????` が 0 行なので、ルートのコミットが種だけで化け判定になることはない(テストでもルートのコミットの正常側が通っている)。
3. 【指示の 1 文の言い回し】「ファイルは、ファイルを直接書き換える道具で書いてください。」は、「ファイルは、ファイルを」が重なり、どの道具(Codex の編集用ツール)かは名指ししていない。名指し(特定のツール名)は Codex のバージョンに依存するので、名指ししない判断は理解できる。効くかどうかは実機で見るしかなく、効かなくても②の確かめと取り消しが受け止める(二段構え)。文面は短く、です・ます調で、読み手を縛り過ぎない。
4. 【古い注記】`scripts/cockpit.mjs` 165 行付近の `SHUTDOWN_MEMORY_TIMEOUT_MS` の説明は「書かずに答えたときの 1 回だけのやり直し」までしか言わず、化けの取り消し + やり直しも同じ枠(合わせて 1 回)の中で走ることを書いていない。やり直しの回数は増えない(合わせて 1 回)ので、90 秒の見積りは変わらない。注記だけ。
5. 【既存・範囲外】`memory: commit failed (${commit.error})` は git の stderr の 1 行目を載せる(Gnome も報告済み。今回は触れていない。新しい警告はこの形を使っていない)。
6. 【限界として同意】足された行が読めない(`maxBuffer` 4 MiB 超・属性で `-diff` のファイルなど)と、化けを確かめられないまま「書けた」扱い(固定文で警告)になる。記録を壊さない側(取り消さない側)に倒しており、既存の「コミットに失敗したときは書けたものとして扱う」と同じ姿勢で筋が通る。
7. 【限界として同意】`git commit` 自体が失敗した回は、足された行を見られず、化けた書き込みが作業ツリーに未コミットで残る。次の保存のコミットで足された行に入るので、次の回で化けとして拾われる(その回の他の書き込みごと取り消される)。コミット失敗は元から稀。

## 4. 確かめた項目

### 4.1 指示の 1 文(項目 1)

- `src/mind/memory.mjs`(`buildWriterSystemPrompt`)の固定部に 1 文が入る: 「このフォルダの外には書かないでください。」の直後・「材料の…」の直前。`w`(語の組)から作る部分には触れていないので、配信・通話のどちらでも入る。テスト `memory-garble.test.mjs`「buildWriterSystemPrompt: …」が `WRITER_SYSTEM_PROMPT`(配信)と `buildWriterSystemPrompt(CALL_WORDING)`(通話)の両方で同じ位置・同じ 1 文を確認している。
- 文は 2 つの短い文で、です・ます調。「配信」「視聴者」などの語の組の語を含まない(`wording-discord-c/f.test.mjs` の部分一致の検査もそのまま通る)。

### 4.2 配信の文面の不変(項目 2)

- pin の fixture: 上の表のとおり 1 行のみ。変わった値は `writer.systemPrompt` で、②の頼み(`writer.request.*`)・④・判定・ほかのキーは diff に現れない。
- `memory.mjs` の diff を全部読んだ: 変更は(a)冒頭の説明と import、(b)`buildWriterSystemPrompt` の 1 文、(c)化けの関数と警告定数の追加、(d)`writeStreamRecord` の JSDoc・引数・ループ。`buildWriterRequest` ・`formatTranscriptForDigest`・判定側(`judge` など)・`runWriterOnce` は差分に出ない(無変更)。
- `git diff --stat` の対象に `skills/`・判定・④の本体はない。

### 4.3 化けの見分け(項目 3・自分で境界を走らせた)

実装は `/\?{4,}/.test(line) && !/[^\x00-\x7F]/.test(line)`(`memory.mjs` の `isGarbledLine`)で、仕様どおり。scratchpad のスクリプトで確かめた結果:

- `???` は化けでない・`????` は化け・`????\r` は化け(CR は ASCII)・`abc\r????` は化け・`- 12:30 ???? (OBS)` は化け。
- `あ????`・`—????`(エムダッシュ)・全角「？？？？」・`え、ほんとに??`・`?? ??`・`undefined` は化けでない。
- `parseAddedLines`(`memory-store.mjs`): `diff ` の行で見出しの区間に戻り、`@@` で本文の区間に入り、本文の区間の `+` 行だけを拾う。`+++`・`---`・`index`・`Binary files` の行は見出しの区間なので拾わない。本文が `++ …` のような追加行(差分上は `+++ …` に見える)は、本文の区間なので拾う(実 git でも `+++ x` を拾えた)。`\r?\n` で割るので CRLF の `\r` は落ちる。`\ No newline at end of file`(`\` 始まり)は拾わない。
- テスト: `memory-garble.test.mjs` の純関数 3 件と `memory-store.test.mjs` の `parseAddedLines` が上の境界(見出し・本文の `++`・空の `+`・Binary)を固定している。`???`(3 連)は「英数字だけで 4 連が無い」の `what??? really???` で間接的に確かめ、`isGarbledLine("???")` 単独の assert は無いが、私の走らせで確認した。

### 4.4 memory-store の新しい口(項目 4)

- `readCommitAddedLines` / `revertMemoryCommit`(`memory-store.mjs` 330 行付近以降)は、`commitMemoryChanges` と同じ作法: `runGit` + `pinnedGitArgs`(`--git-dir`・`--work-tree`)・throw しない(`runGit` が握る・`options?.` で undefined も受ける)・`dir` 必須(`dir is required`)・`.git` が無ければ git を呼ばずに失敗(`checkCommitTarget`。テストが存在しない git の path を渡しても「git not found」でなく「no .git」になることで証明)。
- 読む側は `git diff-tree --root -r -p --no-commit-id --no-color --no-ext-diff --no-textconv --no-renames --unified=0 <commit> --`。ルートのコミット(親なし)は `--root` で動く。
- **ユーザーの global 設定に左右されないことを自分で確かめた**: `GIT_CONFIG_GLOBAL`(一時の設定ファイル・本物の global は触れていない)に `color.ui=always`・`color.diff=always`・`diff.external=/nonexistent/difftool`・`diff.noprefix`・`diff.mnemonicPrefix`・`diff.renames=copies`・`diff.context=9`・`diff.algorithm=patience`・`core.quotepath=false`・`log.showRoot=false` を入れた状態で、日本語のトピック名 + CRLF + `+++ x` の行を含む本体のルートのコミットを `readCommitAddedLines` → 足された行が正しく取れ、`revertMemoryCommit` もルートのコミットで成功し、木が空に戻った。
- revert は `git revert --no-edit <commit>` + `rev-parse HEAD`。履歴は書き換えず、取り消しのコミットが積まれる(テストで取り消し対象が `HEAD~1` に残ることを確認)。失敗したら `git revert --abort` を best-effort。私の走らせで、(a)HEAD でないコミットの revert が競合して `ok:false` になり `REVERT_HEAD` を残さない、(b)作業ツリーに未コミットの変更があると `ok:false`(`exit 128`)になり、その変更は無傷(`--abort` で巻き込まれない)、を確認した。
- 引数の検査: `isCommitRef` は `HEAD` か `/^[0-9a-f]{4,64}$/i` だけを通す。`-` で始まる値・`HEAD~1`・空・`main` は git を呼ぶ前に `commit must be HEAD or a commit hash` で止まる(テストが `--hard`・`HEAD~1`・空・`main` を確認)。引数注入はない。`execFile` なのでシェルも通らない。

### 4.5 `writeStreamRecord` のループ(項目 5)

コード(`memory.mjs` 末尾のループ)を読み、`memory-garble.test.mjs`(本物の git + 偽の②)で動作を確認した。

- 最大 2 回(`MAX_ATTEMPTS = 2`)。理由を問わず合わせて 1 回のやり直し。
- 化け → revert → やり直しで正常: `written:true`・警告は `WRITER_GARBLED_RETRY_WARNING` の 1 つ・履歴は 書、Revert、書(テスト)。
- 化け → 化け: 両方 revert・`{ written:false, garbled:true }`・警告は RETRY → `WRITER_GARBLED_WARNING`・木は前のコミットと同じ・作業ツリーは clean(テスト)。
- 書き損じ → 化け: 2 回で打ち止め・`garbled`。化け → 書き損じ: 2 回で打ち止め・`missing`(どちらも `create` は 2 回だけ)。
- 2 回目以降の保存(今回の本体あり)で化け: revert で前の本体に戻ってからやり直す(やり直しの `ask` の時点で前の本体を見ていることをテストが確認)。
- ask が失敗した回: コミットは今までどおり行い、化けていれば取り消してから throw する(やり直しはしない)。化けの履歴が先頭に残らない。
- 足された行が取れない: 取り消さず書けたもの扱い + 固定文の警告(3 の 6 参照)。revert に失敗: やり直さず `{ written:false, garbled:true, commit }`(化けがコミットに残るが、記録できたと偽らない・記録時刻を進めない・その上に重ねてやり直さない)。取り消しに失敗した回は revert 済みでない化けの上に新しい書き込みを積むと、次の取り消しが競合しうるので、止める判断は筋が通る。
- 化けを取り消した回は `detectWriterMiss` をしない(取り消しで本体が消えるのは当たり前なので、書き損じと取り違えない)。
- 取り消す対象は「直前に積んだコミットのハッシュ」(`HEAD` ではなく結果のハッシュ)。②のあと `dispose` 済みで、記録の保存は呼び出し側で直列(`createMemoryRecorder` の chain)なので、取り消し中に別の書き込みはない。

### 4.6 警告・ログ(項目 6)

- 新しい警告は `WRITER_GARBLED_RETRY_WARNING`・`WRITER_GARBLED_WARNING`・`WRITER_GARBLED_REVERT_FAILED_WARNING`・`WRITER_GARBLE_CHECK_FAILED_WARNING` の 4 つ。すべて固定の英語(非 ASCII なし)で export 済み、既存の `WRITER_MISS_*` と同じ形。記憶の中身・ファイル名・トピック名・名前・id・git の stderr・dir は載らない。足された行や `revertImpl` の `error` は警告に渡さない(`checkWriterGarble` は `error` を捨てる)。
- テスト「警告に中身が載らない」が、化けた本文に `secret-marker`、トピック名 `secret-topic`、本体のファイル名、視聴者名を入れて、警告にそれらも `????` も dir も無く、全部 ASCII であることを確認している。足された行が読めない / revert が失敗するテストでは、`error` に `secret-topic` を入れた偽物を渡して警告に出ないことを間接的に確認している。

### 4.7 呼び出し側(項目 7)

- `scripts/cockpit.mjs` 884 行: `if (result && result.written)` のときだけ `onSaved` → `streamVenue.noteSaved`(`lastRecordedSeq`・`lastRecordAtMs` を進める唯一の口)。`missing`・`garbled` は見ず、どちらも `written:false` で同じ扱い(記録時刻を進めない → 次の定期保存で書き直される)。本番の `writeImpl`(3206 行付近)は `writeStreamRecord` の戻り値をそのまま返すだけ。
- `src/cockpit/` に `written` を見る箇所はない(grep 0 件)。ログ `memory recorded` も `onSaved` の中なので、化けた回は出ない(警告は `onBrainWarning` の経路)。
- `cockpit.test.mjs` の追加 1 件が、本物の `createMemoryRecorder` と `createStreamVenueHooks` をつなぎ、`{ written:false, garbled:true }` で `lastRecordedSeq` 0・`lastRecordAtMs` null のまま、次に `written:true` で 2 になることを固定している。

### 4.8 テスト(項目 8)

- 既存テストの変更は `src/mind/memory.test.mjs` の 2 件に `addedLinesImpl: cleanAddedLines` を 1 行ずつ足しただけ(`git diff` で確認)。assert は 1 つも弱めていない・消していない・書き換えていない。足した理由(偽のハッシュ `def5678`・`.git` の無い一時フォルダで `committed:true` を返すので、既定の本物の口が「.git が無い」で失敗して警告が 1 つ増え、`deepEqual` の警告の並びがずれる)は妥当。ほかの偽コミットを使うテストは警告の並びを見ていないので、増える 1 つの警告で結果が変わらない(全体 2303 pass)。
- 新しいテスト: `memory-garble.test.mjs` 14 件が仕様の確かめを覆っている(純関数 3・指示 1・化け → 取り消し → 正常 / 化け → 化け / 書き損じ → 化け / 化け → 書き損じ / 2 回目以降 / 警告の中身 / 変更なし・コミット失敗は見ない / 読めない / 取り消せない / ask 失敗)。`memory-store.test.mjs` +7 が、純関数・ルートのコミット・取り消し(履歴に残る・作者がローカル設定)・ルートの取り消し・失敗しても途中状態を残さない・入口の縛り・git が無い。`cockpit.test.mjs` +1。
- 穴: (a)`isGarbledLine("???")` 単独の assert はない(上で走らせて確認)、(b)`git diff-tree` の global 設定への強さを直接試すテストはない(自分で確かめた。テストにするなら `GIT_CONFIG_GLOBAL` を一時の設定に向けるだけで足りる。持ち越しでよい)、(c)ルートのコミットで種(`_conventions.md`)を含めても化け判定にならないことは、正常側のテストで暗黙に通るだけで、単独の assert はない。

### 4.9 JSDoc と限界の注記(項目 10)

- `memory.mjs` の冒頭の説明・`writeStreamRecord` の説明(化けの扱い・限界の注記「そのコミットに②以外の未コミットの手直しが混ざっていたら一緒に取り消される」・やり直しは合わせて 1 回)・戻り値の型(`garbled?: true`)・引数 `addedLinesImpl` / `revertImpl`、`memory-store.mjs` の冒頭と 2 つの関数の説明(`GitOptions`・ルートのコミット・作者・`--abort` が best-effort であること)が更新されている。限界の注記は的確。小さな古さは 3 の 4。

## 5. Gnome の質問への見立て

質問: 最初の保存(ルートのコミット)が化けると、未コミットだった `_conventions.md` の種も一緒に取り消され、同じ保存の中のやり直しが決まりを読めない。注記のままでよいか。

**見立て: 注記のまま持ち越しでよい(今の形で止めない)。ただし実害は Gnome の報告より少し長く続くので、その点を Undine に伝える。**

- **起こるとき**: 「記憶のフォルダに前のコミットが 1 つもない(新しいロールの最初の保存)」かつ「その保存が化けた」ときだけ。`prepareMemoryFolder` は種を置くだけでコミットしないので、ルートのコミットに種が入る。頻度は、新しいロールの最初の保存 × 化けの確率。2 つ目以降の保存・既存のロールでは起こらない。
- **続く範囲**: Gnome は「次の場の始まりで置き直される」と書いたが、`createRoleMemoryPlaces.place()`(`cockpit.mjs` 1000 行付近)は、置き場を作るときに 1 回だけ `prepareMemoryFolder` を走らせ、`beginStream` で置き場を捨てるまで再び走らせない。つまり種が消えたあとは、その場の残りの保存(20 分ごと・最後の保存)すべてで `_conventions.md` が無いまま②が走る。次の場の始まりで戻る。
- **実害**: 記録そのものは失われない(本体は書かれる)。ただし②が「まず `_conventions.md` を読み、その決まりに従う」ことができないので、その場の間は決まり(ファイル名の付け方・目次の形・文体など)から外れた書き方になりうる。見た目と目次の統一の話で、記録の消失ではない。
- **直し方の注意**: (b)「取り消しのあとで種が無ければ `prepareMemoryFolder` をもう一度呼ぶ」は、`writeStreamRecord` がロールの呼び名(`soulName`)を持たないため、素朴に `prepareMemoryFolder({ dir })` を呼ぶと種の「チャッピー」のままで置いてしまう(ロールごとの呼び名の差し替えが効かない)。呼び名を渡す口を足すか、呼び出し側(`cockpit.mjs` の `writeImpl`)で `place.ready` をやり直す形になり、Domain L の範囲を少し超える。(a)「`prepareMemoryFolder` で種をコミットしておく」は、prepare は「コミットするのは魂の保存のとき」の契約と、③整理役が将来 `_conventions.md` を書き換える前提を動かす。どちらも小さな直しではない。
- **結論**: 頻度が低く(新しいロールの最初の保存が化けたときだけ)、害が記録の消失でなく書式のずれにとどまり、次の場で戻る。Undine の追認(§5 の注記のみ)で足りる。直すなら別の小さな Domain として(b)を呼び名つきで。
