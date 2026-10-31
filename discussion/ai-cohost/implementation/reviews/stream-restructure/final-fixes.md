# 配信の組み直し 仕上げの見直し(Review-Sylph)

Review-Sylph → Orch-Sylph(2026-10-31)。対象: ブランチ `ai-cohost/stream-restructure`、基準 1a585775 に対する作業ツリーの未コミット差分と未追跡ファイル(Gnome の仕上げ)。読み取り専任で、ソースもテストも書き換えていない。

## 判定

**pass(止めた指摘 0)**

頼んだ仕上げの 1〜5 はすべて入り、テストが付いている。後退は見つからない。守りの違反もない。Undine に上げる分岐が 4 つ、持ち越しが数件ある(後ろに書く)。

## 機械ゲート

| ゲート | 結果 |
|---|---|
| `apps/soul/agent` で `node --test`(自分で走らせた) | 1879 tests / 1879 pass / 0 fail / 0 cancelled / 0 skipped(Gnome の報告と一致) |
| 根で `pnpm run check:soul-zone`(自分で走らせた) | pass(1565 source files・器→魂・魂→器の違反なし) |
| 依存・lockfile | 差分なし(変更 12 ファイル + 未追跡 2 ファイルに `package.json`・lockfile は無い) |

install はしていない。操縦席は起動していない。鍵は読んでいない。

## 1〜5 の適合と根拠

### 1. YouTube の自動接続: 適合

- 実装(`src/cockpit/cockpit-server.mjs`)
  - `chatSourceThisBoot` に入るのは `POST /api/chat/source` と `connectChat`(Connect)だけ。起動時に `chatSourceStatus` から読み戻した値は入らない。
  - `startChatForStream()` の順は 3 段。(a) 器官があればそのまま持ち込む。(b) 無ければ覚えた source へ `connectChat`。(c) 投げたら `foldChatClient` で器官を畳み、ログのタブに 1 行(`internalError`)を出して `"failed"` を返す。どの場合も場は開く(`openStream` の 7 は `await startChatForStream()` の後に `streamPhase = "open"`)。
  - snapshot の `chat.enteredThisBoot` は additive。
- テスト(`scripts/cockpit-stream.test.mjs`、本物の server + 本物の場の口)
  - 「前回の起動から欄に残っているだけ…にはつなぎにいかない」: 保存値だけならつながない(`created` が 0)。
  - 「この起動で入れた(POST /api/chat/source…)URL へ、始めるでつなぐ」: つなぐ。順は `channel.connect` → `chat.start:<url>` も見ている。
  - 「…つながらなくても場は開く」: `startThrows` で `phase=open`・`stream.error=null`・`connected=false`・`stopped=1`。
  - 「終えたあと次の場でも…」: Connect 済みの URL を次の場でもつなぐ。空保存・Disconnect でつながない。
  - 「POST /api/chat/source: 文字列か null だけ…」: 400・null で消す・場の途中でも保存できる。
  - 「場を開く前に Connect 済みならそのまま(作り直さない)」(既存のまま通る)。
- 画面
  - `ui/settings-drawer.mjs`: 欄の `onChange` で保存。ダイアログの「配信を始める」は保存の Promise を待つ。
  - `view-logic/status.mjs`: `chatAutoConnectHint`。
  - 画面のテストは `cockpit-ui-settings.test.mjs` の 3 件。ソースの文字列照合が主で、これは既存の流儀どおり。

### 2. `/api/verbosity`・`/api/speak-start` は場が閉じていなければ 409: 適合

- 実装: `streamPhase !== "closed"`(開きかけ・開いている・閉じかけ)で `409 { error, state }`。未注入の 503 → body → 409 → 中身の 400 の順。`/api/role/edit` と同じ作り。何も変えず、永続化も呼ばない。
- テスト(`cockpit-server-domain-e.test.mjs`): 「POST /api/verbosity・/api/speak-start: 場が閉じていない間(開いている・閉じかけ)は 409…」。開いている間と閉じかけ(保存を保留して `closing` を作る)の両方を見る。値が変わっていないこと、`persisted` が空であること、閉じていれば 200 で `persisted` が入ることまで見る。
- 開きかけ(`opening`)の 409 を直接見るテストは無い。条件は同じ 1 行(`!== "closed"`)で、`/api/chat/connect` 側では開きかけを見ている。止める理由にはしない(持ち越し 4)。
- 画面からこの 2 つを叩く所が無いことを grep で確認した。直しは要らない。

### 3. `closeStream` の想定外の例外でも最後の保存を 1 回だけ: 適合

- 実装
  - `finalSaveRequested` は `saveFinal` を引く直前に立つ。
  - catch の中で、写しが取れていなければもう一度試し、取れなければ空にする。続いて `foldStream` を畳み直し、まだ頼んでいなければ 1 回だけ `saveFinal` を頼む。
  - `closed` に戻すのは今までどおり。
  - `foldStream` は段ごとに握り、全部畳んだ後で最初の例外を投げ直す。
- テスト 2 件
  - 「畳む途中で想定外の例外が出ても、…1 回だけ(その場の写しで)頼み…」: `closeSession` の getter が投げる。保存は 1 回で、中身は写しの `"今日はありがとう"`。`closed` に戻る。投げた段の前後の耳・目・器も畳まれる。次の場の終わりは 2 回目で普通に 1 回。
  - 「最後の保存を頼んだあとで投げても二度は頼まない・写しが取れずに投げたら空で 1 回だけ頼む」: 二重にならない(`saves.length` が 1 のまま)。写しの throw では `[]` で 1 回。
- 保存を頼むのは基本の 1 回と catch の 1 回のどちらか片方だけなので、二重にならない。

### 4. 古い記述を今の形に: 適合

- 差分の追加行を全部見た。コードの動作を変えた行は、1〜3 と持ち越し 2 の `cockpit-server.mjs` 以外に無い。
  - `scripts/cockpit.mjs`: 頭の JSDoc、`createChatSourceHooks` の注記、`--channel` の HELP だけ(動作は不変)。
  - `src/memory/memory-store.mjs`: 頭の注記 3 行だけ。
  - `view-logic/settings.mjs`: 注記と、`chatConnectErrorText` の 409・`chatSourceSaveErrorText`・`requestErrorText("chatSource")` の追加。
- README は古い節を消さず「※」の注記と末尾の節「配信の組み直し」で今の形を足している。`--channel` の HELP は「配信の準備」の欄・体があるときだけ・起動時には何もつながない、に変わった。
- `recall-flow.md` は `memories/<role-id>/…` に直った。§7 の「今ある 8 件」の行は括弧で「当時は直下」と添えただけで、`memories/_conventions.md` の文字は当時の記述として残っている。意図どおりで差し支えない。
- **②④の指示の文面は一字も変わっていない。**
  - 指示の文面を持つファイル(`src/memory/` の指示類・`conventions-seed.md`・`skills/`)は差分の一覧に無い。
  - README・`recall-flow.md` の追加行は説明文だけで、指示の文面そのものは含まない。
  - `recall-flow.md` にはもともと指示文面が載っていない。

### 5. 持ち越し 1・2: 適合

- 持ち越し 1: 「配信を始める: 耳を起こしたあとの想定外の例外でも、耳・目・頭のセッション・器を畳んで closed + error に戻る…」。`openSession` の getter が投げる。耳 1・目 1・`closeSession` 1・`closeBody` 1 が畳まれ、`closed` + `stream.error` になり、もう一度始められる。
- 持ち越し 2: 「POST /api/chat/connect: 閉じかけ(記録中)の間は 409…開きかけも 409・開いている間は通る」。閉じかけと開きかけは `created=0` で、`enteredThisBoot` も変わらない。閉じた後に器官が残らない。開いている間は通る。

## 後退の確認

- 既存の流れ(場の始まり・終わり・Ctrl+C・体なし・記憶の最後の保存)は、既存テストが無傷で通っている(1879 pass)。
  - Ctrl+C は開いていれば終えると同じ道、閉じていれば保存を頼まない、2 回目で待ちを打ち切る、の各テストが緑。
  - 体なしの close、2 つ目の場の `lastRecordedSeq`、`main` の結線のテストも緑。
- `foldStream` を段ごとに握る形にしたことの副作用: 呼び出し側(`openStream` の失敗の巻き戻し・`closeStream`)の扱いは「最初の例外を最後に投げ直す」ので今までと同じ。以前は途中で止まって後ろが畳まれなかったので、直しになっている。
- 期待値を変えた既存テスト 4 件は、差分で確かめた。いずれも仕様変更によるもの。
  - `cockpit-stream` の「保存値だけではつなぎにいかない…」: 後半の「前の場で Connect した器官は次の場に持ち込まない」を外した。Undine の追認(この起動で Connect した URL はつなぐ)と逆になったため。前半は残っている。次の場でつなぐことは新テストが見る。
  - `cockpit-server` の speak-start の 503/400/切替: 場を開く前に並べ替えた。期待値(判定の数・発火の数・永続化の並び)は同じ。
  - `cockpit-server` の speak-now の口数: 前後に終える・始めるを足しただけ。期待値は不変。
  - `cockpit-server` のコメント反応: 場の途中が 409 であることの assert を足し、終える → 替える → 始めるにした。最後の期待値は不変。
  - 期待値を弱めたものはない。
- 後退の穴を一つ見つけたが、止める理由にはならない(持ち越し 1 と Undine 分岐 4)。始めるの中で `client.start()` を待つため、YouTube の取得が止まると `opening` が長引く。

## 守りの確認

| 項目 | 結果 |
|---|---|
| 鍵(`.env*.local`)の読み・出し・環境変数 | 追加行のコードに `process.env`・`.env`・`readFile`・`writeFile` は無い(`.env.elevenlabs.local` や `process.env` が出る追加行は JSDoc の説明のみ) |
| `_conventions.md`・`conventions-seed.md`・②④の指示の文面・判定の文面・`skills/` | 無差分 |
| 依存・lockfile | 無差分 |
| 実データ | 新テストは偽の settings(関数で値を返す)・偽の場の口・偽の器官のみ。テスト後の `cockpit-settings.local.json` は 10/29 21:00、`memories/` は 10/28、`roles/`・`tmp/restructure-backups/` は無い。実データに触れていない |
| 本物の LLM・API | 新テストは偽の器官・偽の場の口のみ。本物は呼んでいない |
| 差分の範囲 | `apps/soul` の 10 ファイルと `discussion/ai-cohost` の 1 ファイル + 未追跡の報告 2 ファイル。他は無い |

## 止めた指摘

なし(0 件)。

## 持ち越し

1. **欄の保存とメイン画面の「配信を始める」の順(低い)**。メイン画面の「配信を始める」は保存の完了を待たない。欄を離れた時点で保存が始まるので通常は先に着くが、HTTP リクエストの順序は保証されない。入れた直後に即押す場合に限り、保存より始めるが先に処理されると、その場はつながらない(Connect で救える)。ダイアログの方は待つ。
2. **欄の保存が `change` だけ(低い)**。フォーカスが欄にある間にダイアログが閉じたとき、`change` が出ないと保存されない。人間ゲートで見る。
3. **器官の初回取得に上限が見えない**。`live-chat-client.mjs` の `start()` は bootstrap と初回 poll を await する。`innertube.mjs` に固有の timeout は見えず、あるのは fetch の既定だけ。Undine 分岐 4 とあわせて判断。
4. **`opening` の 409 を `/api/verbosity`・`/api/speak-start` で直接見るテストが無い**。条件は `/api/role/edit` と同じ 1 行。
5. 全体の突き合わせの持ち越し 4(`main` の結線のテストが文字列の照合)と 5(ロールの引っ越しだけ失敗した起動)は、指示どおり手付かず。
6. `verbosityPostErrorText` と `speakStartPostErrorText` は 409 を個別に扱わない。画面から呼ぶ所が無いため。

## Undine に上げる分岐(設計に無い判断。Gnome の質問 4 つへの私の見立てを添える)

1. **同じ起動の 2 回目の配信で、前の URL へまたつなぐ**。素描の注記「この起動で入れた(または Connect した)URL はつなぐ」を素直に読んだ形で、追認の文面と矛盾しない。害は YouTube 側で終わっていれば ended の行が出るだけ。ただし配信ごとに URL が替わる前提なら、「終えたら覚えたことを消す」の方が素描の意図(今日の URL を入れる)に近い。**見立て: どちらも可。Undine の好みで決める。今のままなら人間ゲートで 2 回目の挙動を確かめる。**
2. **Disconnect で「この起動で入れた」を消す**。自分で切ったものを勝手につなぎ直さない、という自然な読み。**見立て: 妥当。**
3. **欄の下の案内の文面と置き場**。設計にも素描にも文面は無い。「前回の URL(自動ではつながない…)」は、前回の値が欄に戻ることの誤解を防ぐ。**見立て: 残してよい。1 行で外せるので好みの範囲。**
4. **始めるの中で `client.start()` を待つ**。待つ形にしたので「開きかけの Connect を 409」と整合している(競らない)。器官の契約では notLive / network は再試行を予約してすぐ返る。ただし接続だけ張れて応答が来ない場合の上限が見えず、`opening` では Stop も 409 になる。**見立て: 待つ形でよいが、取得に上限を持たせる(または待たずに投げて場を先に開く)案も用意しておくとよい。実機で重いかを人間ゲートで見てから決めるのが安全。**

## 人間ゲートで確かめる点

- 前回の URL が欄に戻っているとき、案内が出て、「配信を始める」でつながない。
- 今日の URL を入れて欄を離れる(または Enter)と、案内が「配信を始めるとつなぐ」に変わる。メイン画面の「配信を始める」でつながる。ダイアログの「配信を始める」を入力の直後に押しても同じ。
- 欄にフォーカスしたままダイアログを閉じて、保存が効くか(持ち越し 2)。
- 間違った URL・ネット無しでも場は開き、ログのタブに 1 行出る。Connect でつなぎ直せる。
- 同じ起動の 2 回目の配信の挙動(Undine 分岐 1)。
- 「配信を終える」の記録中と、開きかけの間の Connect が 409 で断られる文面。
- 配信の途中は口数・話し始めが替えられない(ロールのタブで押せない)。
- 実際の YouTube の取得が遅いときの「始めてる」の長さ(Undine 分岐 4)。

## 質問

なし。判断の分岐は上の「Undine に上げる分岐」にまとめた。
