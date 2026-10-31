# 配信の組み直し 人間ゲート前の直し(Gnome 報告)

Gnome → Orch-Sylph(2026-10-31)。基準 19e53770。コミットはしていない。

## 変えたファイル

- `apps/soul/agent/src/cockpit/cockpit-server.mjs`(本体)
- `apps/soul/agent/src/cockpit/cockpit-server-domain-e.test.mjs`(新しいテスト 5 件)
- `apps/soul/agent/src/cockpit/cockpit-server.test.mjs`(既存テスト 8 件の前置きを直した: 仕様変更)
- `apps/soul/agent/scripts/cockpit-stream.test.mjs`(既存テスト 1 件の見方を直した: 仕様変更)
- `discussion/ai-cohost/implementation/waves/stream-restructure/human-gate.md`(手順 4 の YouTube の項目)

`stream-restructure-wave-plan.md` に作業ツリーの差分があるが、私は触っていない(作業前からあった変更)。

## 直しの形

### 1. 「配信を始める」は YouTube を待たない

- `openStream` の 7 で、先に `streamPhase = "open"` にしてから `void startChatForStream()` を呼ぶ(await しない)。
- `startChatForStream` は reject しない Promise を返す。最後に `.catch` も付けた。
- 場の世代 `streamGeneration` を足した。開きかけにするたびに 1 つ進む。
- 後ろのつなぎの扱い:
  - 呼んだ直後の `chatClient` を自分の器官として取っておく(`connectChat` は await の前に器官を入れる)。
  - 片付いた時点で「サーバが閉じていない・場が open・世代が同じ・器官が自分のまま」なら有効とする。
- 有効なとき:
  - 成功: `broadcastState()`。
  - 失敗: 今までと同じ警告(chatDiagnostic `internalError`、同じ文面)を出す。器官を畳む。場は開いたまま。
- 無効なとき(場が閉じた・2 回目の場・押した操作で差し替わった):
  - 自分の器官だけを畳む。差し替わっていれば、自分の器官の `stop()` だけを呼ぶ(冪等)。
  - 警告は出さない。
- `closeStream` は後ろのつなぎを待たない。器官はもう `chatClient` に入っているので、今までどおり `foldStream` の最初で畳まれる。本物の器官(`live-chat-client.mjs`)は stop のあとの start を何もしない作りなのも確かめた。
- これで「開きかけ」は YouTube の応答で長引かなくなった。開いた直後から「配信を終える」が通る。

### 2. 場が open でない間の自発の発火は捨てる

- `requestSelfFire` の頭で `streamPhase !== "open"` なら `{ fired: false, reason: "stream-not-open" }` を返す。頭へ流さず、selfFire の SSE も出さない。

## 足したテスト(`cockpit-server-domain-e.test.mjs`)

1. 配信を始める: YouTube の start() が返ってこなくても場はすぐ開き、配信を終えられる(断られない)。あとから start が片付いても器官は畳んで残さない
   - あとから reject しても警告を出さず、未処理の reject も出ないことも見る。
2. 配信を始める: 前の場の後ろのつなぎが、次の場が開いてから片付いても残さない(次の場のつなぎはそのまま)
3. 配信を始める: 後ろのつなぎが失敗したら警告(ログの行)を出し、場は開いたまま・器官は畳む・未処理の reject を出さない
4. 配信を始める: 後ろのつなぎの間に Connect / Disconnect を押したら押した方を優先する(後ろのつなぎは黙って捨てる・押した器官を畳まない)
5. 自発の発火: 場が開いていない間(閉じている・開きかけ・閉じかけ)は捨てる(頭に流さない)。開いている間だけ通す(手動の Fire と揃える)

前のコードではテスト 1 が終わらない(start を待ち続ける)ことを確かめた。

期待値・前置きを直した既存テスト(どれも仕様変更による):

- `cockpit-stream.test.mjs`「この起動で入れた YouTube の URL につながらなくても場は開く」: 応答の時点ではまだ後ろでつないでいる。片付くのを待ってから state を見る形にした。
- `cockpit-server.test.mjs` の onFireRequest interjection の 2 件と、思い出しの流れの 6 件(`startRecallServer` を直したもの):
  - 自発の発火を見るので、偽の耳で先に場を開くようにした。
  - 見ている中身は変えていない。

## 機械ゲート

- `apps/soul/agent` で `node --test`: **1884 tests / 1884 pass / 0 fail / 0 cancelled / 0 skipped**(基準 1879 + 5)。
- 根で `pnpm run check:soul-zone`: **pass**(1565 source files・違反なし)。
- 依存と lockfile は変えていない。鍵・実データには触れていない。操縦席は起動していない。本物の LLM・API は呼んでいない。

## human-gate.md

手順 4 の YouTube の項目を直した形に合わせた。

- 消した項目: 「YouTube につなぐ間『始めてる』がどのくらい続くか」。
- 足した・書き直した項目:
  - URL を入れて始めると、場はすぐ開き、YouTube はあとから付く。
  - 間違った URL では、場はすぐ開き、あとからログに 1 行が出る。場は開いたまま。
  - つながる前でも「配信を終える」が断られない。終えたあと YouTube が残らない。
  - 「始めてる」は短い。始めている途中で勝手にしゃべらない。
- 「2 回目の場で前の URL へまたつなぐか」の項目は、そのまま残した。

## 裁量

1. 後ろでつないでいる間に Connect / Disconnect が押されたら、押した方を優先する。
   - 後ろのつなぎは黙って捨てる(押した器官は畳まない・警告も出さない)。
   - 判定は「器官が差し替わったか(`chatClient === mine`)」で行う。
2. 閉じた場・前の場のつなぎが片付いたときは、成功でも失敗でも警告を出さない(もう関係のない場なので)。
3. 自発の発火を捨てる場所は `requestSelfFire` にした。自発の口(発火の予定・speak-now・コメント反応・思い出しの①)が全部ここを通るので、1 か所で済む。
   - 捨てた分はフィードの行にもしない。開きかけの取りこぼしでゴースト行が出るのは雑音になるため。
   - 思い出しの係には受理しなかった結果(`reason: "stream-not-open"`)を返す。busy ではないので、届けは見送りになる。閉じかけ・閉じている間は係ごと畳まれているので、実際に当たるのは開きかけの間だけ。
4. 場を開いた直後、まだ後ろでつないでいる間の snapshot は `chat.connected: true` になる(器官はもう `chatClient` に入っている。中身の状態は `chat.state` の connecting 等)。「つなぎにいっている」の意味で、今までの Connect の途中と同じ扱いにした。

## 質問

なし。同じ起動の 2 回目の場で前の URL へまたつなぐか(「終えたら忘れる」か)は、指示どおり変えていない(ユーザーに聞く事項のまま)。

## 追記(ループ 2)

- `human-gate.md` 手順 4 から次の 1 行を消した: 「□ (見ておいてほしいこと)同じ起動のまま 2 回目の配信を始めると、前の配信で入れた URL へまたつなぎにいく作りになっている。それでよいか、「終えたら忘れる」ほうがよいか、感想をメモ。」(ユーザーの回答: 同じ起動で場を開き直さないので、ゲートから外す)。
- ほかに 2 回目の場の URL に触れる記述は無かった(50 行目の「2 回目以降の返事」は返事の速さの話、手順 5 の Ctrl+C の項目は URL に触れないので残した)。番号のずれは無い。コードとテストは触っていない。
