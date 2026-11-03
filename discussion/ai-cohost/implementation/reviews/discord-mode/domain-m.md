# Domain M レビュー — 判定の札を同じ場の中だけで結ぶ

> Review-Sylph(読み取り専任)→ Orch-Sylph(2026-11-03)。対象: 未コミットの差分(ブランチ `ai-cohost/discord-mode`、HEAD `c0d99235`)と Gnome 報告 `waves/discord-mode/domain-m-gnome.md`。
> 判定の根拠: `waves/discord-mode/gate-3-stale-judgment-chip.md` §3・§5、計画 `orchestration/discord-mode-wave-plan.md` §8「### Domain M」、実コード(サーバ `src/cockpit/cockpit-server.mjs` を含む)。
> 鍵(`.env*.local`)・実データ(`memories/`・`roles/`・`session-usage/`・`fire-diagnostics/`・`cockpit-settings.local.json`)は開いていない。操縦席・本物の Bot / LLM / 外部 API は起動していない。リポジトリのソースもテストも変えていない(確かめ用の差分比較スクリプトは scratchpad だけ)。

## 判定: **pass**(止める指摘 0)

## 1. ゲート(自分で走らせた)

| ゲート | 結果 |
|---|---|
| `apps/soul/agent` で `node --test` | **2315 / 2315 pass・fail 0**(Gnome の数字を再現) |
| 根で `pnpm run check:soul-zone` | pass(1627 files scanned・器→魂 / 魂→器の違反なし) |
| `git diff --stat -- src/mind scripts src/cockpit/cockpit-server.mjs src/cockpit/cockpit-page.mjs` | 差分 0(`stream-wording-pin.test.mjs`・fixture も `src/mind/` の中なので 0) |
| `git diff --stat -- '*.test.mjs'` | 差分 0(既存テストの変更なし。新規は未追跡の `glance-venue-m.test.mjs` のみ) |
| 変更ファイル | `git diff --name-only` は `ui/app.mjs`・`view-logic/glance-timeline.mjs`・(対象外の)wave-plan.md だけ。未追跡は新規テストと Undine/Gnome の文書 |
| 改行 | 3 ファイルとも作業ツリーは全行 CRLF(531 / 550 / 277 行すべて)。リポジトリは `core.autocrlf=true`・index は LF で、既存の隣のファイル(`glance-timeline.test.mjs`)も作業ツリーは CRLF。同じ形で、混在なし |

## 2. 止める指摘(blocking)

なし。

## 3. 止めない指摘(non-blocking)

1. 【合図の契約を固定するテストがない】「phase "opening" の `state` が、正本の作り直し(seq が 0 に戻る)より前に配られる」ことは、`cockpit-server.mjs` の `openStream`(2938〜2943 行で `streamPhase = "opening"` → `broadcastState()`、そのあと 2977 行の `openVenueTranscript()`)を読んだ結果でしか保証されていない。新規テストは `state` を手で並べた画面側の列で、サーバの順序を固定していない。将来サーバ側の開く段の順が替わると、黙って札がずれる。サーバの SSE を購読して `opening` の `state` が最初の `transcript` より前に来ること(と VC の抜け・入り・移りで `state` の `phase`・`openedAtMs` が変わらないこと)を固定する小さなテストを、次の機会に足すとよい(新規テストファイルだけで足りる。サーバは触らなくてよい)。
2. 【Gnome 報告 §7 の残リスクは実際より重く書かれている】「つなぎ直しで snapshot を取り直さない」とあるが、サーバは SSE を張るたびに現在の `state` を 1 発送る(`cockpit-server.mjs` 4142〜4145 行 `openSse`)。EventSource の自動再接続でも同じなので、切れている間に場が閉じて開き直されても、再接続の最初の `state`(phase "opening"、または openedAtMs の違う "open")で控えの判定が働く。つまり「控えの判定が届くまで前の場の札が残りうる」のは、再接続の直後に限らず起きにくい。実際に残る穴は、切れている間の `transcript`・`selfFire` の取りこぼし(既存の挙動・今回の範囲外)だけ。報告の文言を直すだけでよい。
3. 【既存・範囲外】サーバ(操縦席の処理)を再起動すると `fire-orchestrator` の `nextFireId`(`src/mind/fire-orchestrator.mjs` 503 行)が 1 から数え直しになる。再読み込みしていない画面は、前のプロセスの行と `causes` を持ったまま新しい fireId 1 を受けるので、fireId の鍵が衝突しうる。今回の直しとは別の問題(場をまたぐことでなく、プロセスをまたぐこと)で、通常は再起動後に画面も開き直す。人間ゲートでも出ていないので持ち越しでよい。
4. 【テストの穴・小】下の §6 を参照(読み込み時が "opening" の履歴、始められなかった場〔opening → closed → opening〕の通し、App を通した `state` の流れ)。どれも実装は正しく動くことを私の手元の確かめで確認した。
5. 【写しの理屈】App の結線テスト(最後の 1 件)はソースの文字列照合(`readFileSync` + 正規表現)で、`cockpit-ui-glance.test.mjs` と同じ作法。空白や改行の整形で壊れやすいが、既存と揃っているので止めない。

## 4. 確かめた項目

### 4.1 正しさ(項目 1)

コード(`glance-timeline.mjs`)を全部読み、差分比較で確かめた。

- 場の番号 `venue` を状態に持ち、行は積んだときの `venue` を持つ(`glanceWithTranscript` の you / soul / event と `selfFire` の skip-interval の note・219・205・309 行)。
- 新しい場が開いたら(`glanceAfterVenueStatus`・143〜152 行)`venue + 1`、`judgments = {}`、`window = null`。行・`causes`・`latencies`・`reacted`・`comments` は残す(fireId の鍵は変えていない)。
- 表示(`conversationRowsView`)で seq で結ぶのは `here(r)`(今の場の行)だけ: 札(481 行)・推論の範囲(433 行)・`seqs`(きっかけの行が手元にあるか・425 行)・`linkedSeq`(449 行で最新の返事が今の場の行のときだけ、471 行で結ぶ行も今の場の行だけ)・返事の行の `kindText`(492 行)。fireId で結ぶもの(`reactText`・`kindText` のうち comment-react / 手動 / 視覚など・`latency`・`reacted`)は `here` を掛けていない。意図どおり。
- 新規テストの 1 件目が、ゲート 3 の再現(前の場の seq 24 が「応答 0.34」で発火 → 閉じて開き直し → 新しい場の seq 24 が「待つ」で札なし)を押さえている。
- **私が足した確かめ(scratchpad・リポジトリ外・各 3000 通りの乱択)**:
  - HEAD の `glance-timeline.mjs` と今の版に、1 つの場の中の乱択列(you / soul / event / viewer / 判定 fire・skip-interval / fire / fireAsk / latency、`state` の opening・open・VC の接続だけの変化を混ぜる)を流し、`conversationRowsView`・`commentRowsView` が deepEqual で一致 → 1 つの場の中の挙動は HEAD と同じ。
  - 2 つの場(1 つ目を閉じて開き直す)の乱択列で、(a)前の場の行は `chipText` が常に null・`inRange` が常に false、(b)新しい場の行の表示(札・範囲・きっかけ・遅延・skip-interval の行。行の連番 `key` は除く)は、新しい場の列だけを最初から流した結果と一致 → 前の場が新しい場に影響しない。新しい場に返事がある列では `latest`・`linked` も一致。

### 4.2 合図の妥当性(項目 2・サーバのコードを読んだ)

- (a) **seq が 0 に戻る前に必ず "opening" が配られる**: 正本を作るのは `openVenueTranscript()` の 1 か所だけ(呼び出しも `openStream` の 2977 行の 1 か所。`createTranscriptBuffer` を場の途中で作る別の道はない)。`openStream` は最初の同期区間で `streamPhase = "opening"` にして `broadcastState()`(2938〜2943 行)、そのあと非同期の段(ロールの記録の作り直し → …)を経て 4 番目の段で正本を作る。`broadcast` は SSE の全購読者へ同期で書くので、同じ接続の中では `opening` の `state` が最初の新しい `transcript` より前に届く。`phase` を書き換えるのは 2900(閉じた)・2938(opening)・3011(open)・3046(closing)の 4 か所だけで、"open" → "opening" は直接は起こらない(`streamPhase !== "closed"` なら 409)。
- (b) **VC の抜け・入り・移りで誤って切り替わらない**: `streamPhase`・`streamOpenedAtMs` は上の 4 か所と `markVenueClosed` だけが書く。Discord の VC の動きで変わるのは snapshot の `connection`・`vcName` だけ(1550 行付近)で、画面の `isNewVenue` は `phase`・`openedAtMs` しか見ない。正本も作り直さない(seq は続く)。テスト「場の状態が変わらない state…」が `connection: "outside"`・別の `vcName`・stream なし・null で同一参照が返ることを固定。
- (c) **配信の場でも効く**: `openStream` は体験に依らない共通の段(体験の口はその中の `prepareEntrance` 以降)。テスト「配信の場でも同じ」が配信 2 回で確認。
- (d) **開き直し(`glanceFromHistory` に snapshot の stream を渡す)と履歴の整合**: 前の場の履歴は snapshot に残らない。正本は `closeStream` の中の `foldStream` → `closeVenueEntrance`(2623 行・`releaseVenueTranscript()`)で手放され、snapshot の `transcripts` は `venueTranscript ? … : []`(1536 行付近)。つまり "closing" の途中から "closed"・開き始めの間は履歴が空で、"open" の間は今の場の分だけ。前の場の履歴を今の場として覚えてしまう道はない。読み込み時の stream が "open" なら履歴の行は今の場(venue 0 のまま・`venueMark` は open)で、そのあとの同じ openedAtMs の `state` では何も変わらない。"opening" の途中で読み込んだ場合も、履歴は空か新しい場の分だけ(前の場は 1 つ前の closing で手放し済み)で、`venueMark` が opening なのでそのあとの "open" で新しい場に進まない。正しい。
- (e) **SSE 再接続時の取りこぼし**: 上の指摘 2 のとおり、再接続の最初に必ず `state` が来る。取りこぼした `state` の控え(closed / closing → open、openedAtMs の違う open、open → opening)は `isNewVenue` に入っていて、`isNewVenue` の表がテストで押さえられている。
- 古い経路の確認: 起動時 `GET /api/state` が失敗(`.catch`)しても `venueMark` は null のまま SSE に進み、最初の `state` が open なら印だけ覚えて場は進めない("open" は途中から見始めただけ・`isNewVenue(null, open)` は false)。正しい。
- 始められなかった場(opening → closed)でも場の番号は進み札を捨てるが、前の場はもう閉じているので害はない(見た目だけ)。

### 4.3 1 つの場の中のふるまい(項目 3)

- 上の乱択比較(HEAD と一致)に加え、`git diff` 上、既存テストファイルの差分は 0。Gnome 申告どおり `glance-timeline.test.mjs`(「関係の無い SSE は同じ状態を返す」の `state` に `{ anything: 1 }` を含む・`glanceFromHistory(undefined) deepEqual emptyGlance()`)ほかは期待値の変更なしで通る(全体 2315 pass)。`emptyGlance()` に `venue: 0, venueMark: null` が増えるが、既存の比較は同じ関数の戻り値どうしなので通る。
- 閉じている間(closing / closed)は札も範囲も捨てない(新しい場が開いたときに捨てる)。HEAD と同じ見え方で、終えた直後の画面が変わらない。テストあり。

### 4.4 守り(項目 4)

- `src/mind/` 差分 0・サーバ系(`cockpit-server.mjs` ほか `cockpit/` 直下)差分 0・`scripts/` 差分 0・`stream-wording-pin.test.mjs`・fixture 差分 0(ゲート表)。依存の変更もなし。
- 画面側以外の seq 結び付け: `src/cockpit/` を seq・triggerSeq で当たった結果は Gnome の調査と同じ(`ui/rows.mjs` の観測フィードは時系列に積むだけで seq で結ばない・`conversation-instruction.mjs` の `requestSeq` は無関係)。
- 見た目の型 `ConvoRowView` は変えていない。

### 4.5 Gnome の裁量(項目 5)の評価

前の場の返事の行に、fireId で結んだ speak-now のきっかけを「きっかけの行が手元に無いとき」と同じく小さく出す(`conversationRowsView` 492 行の `here(r) &&`)。**妥当。採用してよい。**

- 前の場の札の覚えは捨てるので、そのままだと前の場の返事は、きっかけが画面のどこにも出なくなる(情報が消える)。きっかけは fireId で結ぶ(ずれない)ので、同じ種類の表示(「きっかけの行が手元にない」)に寄せるのは筋が通る。
- 見た目の変化は、開き直した瞬間に「前の場の配信者の行の札が消え、前の場の返事の行にその札が小さく出る」こと。人間ゲートで見て驚かない程度で、前の場の行は薄く残る(古い行)扱い。
- 前の場のすべての返事の行に出る(最新の 1 件だけではない)が、`CONVO_KEEP`(300 行)で古い順に落ちる。実害なし。
- 「何も出さない方がよければ 1 か所を変えるだけ」(Gnome の言)は正しく、492 行の条件だけ。ユーザーの好みで後から変えられる。

## 5. 質問(Undine / ユーザー向け)

1. 上の non-blocking 1(サーバの順序を固定するテストを足すか)は、Domain M に含めるか、持ち越しにするか。私の見立ては持ち越しでよい(今のサーバの順は設計 §13 の開く段の順で、Domain A の正本の寿命の決めと一体のため、変わるときはほかの多くのテストが先に落ちる)。
2. 人間ゲートでの確かめ(Gnome 未実施): 同じ起動で通話を開き直し、新しい場の最初の発言に前の場の「応答 x.xx」が出ないこと、前の場の行に札が出ないこと。ついでに、開き直した瞬間に前の場の返事の行へ小さな札が出る見た目(裁量 5)を見て、好みでなければ 492 行の条件を変える。

## 6. テストの質(項目 6)

`glance-venue-m.test.mjs` の 12 件は、計画の確かめ項目を実際に押さえている。

- 押さえている: ゲート 3 の再現(札)・前の場の行に新しい場の札が付かない・推論の範囲(捨てる・同じ seq の旧行に付かない・skip-interval の薄い行が範囲に入る)・きっかけの結び付け(`linkedSeq`・手元の判定・きっかけの行が前の場にしか無い)・fireId で結ぶもの(コメント反応・手動・反応の印)・1 つの場の中は state を挟む / 挟まないで同じ・配信の 2 回・合図の表・VC の動きで場が変わらない・`glanceFromHistory` の経路・opening 取り逃しの控え・App の結線。
- 抜け(どれも小さい。実装は私の手元の確かめで正しいと確認済み):
  - (a) 読み込み時の stream が "opening" の履歴(履歴が空か新しい場の分で、そのあとの "open" で場が進まないこと)。
  - (b) 始められなかった場(opening → closed → opening)の通し。`isNewVenue` の表には載っているが、`glanceAfterSseEvent` を通した列としてはない。
  - (c) App の preact を通して `state` の SSE が `glance` に流れる(`cockpit-ui-glance.test.mjs` 流の描画)テスト。今は文字列の照合だけ。
  - (d) `isNewVenue` の表に、prev が "opening" で next が "closed"(始められなかった)の組が単独ではない(同じ表の「closed → opening」の行で間接的に通る)。
  - (e) サーバ側の順序の固定(non-blocking 1)。
- 1 つの場の中の同値は、テスト 6 件目が代表の 1 列だけを見る。私の乱択比較(3000 通り)が上乗せで確かめたので、いまの実装の保証は強い。回帰が心配なら、あの乱択の考え方(HEAD の関数との差分比較ではなく「新しい場の列だけを流した結果との一致」)を小さな決まった列で足すとよい。

## 7. 変更ファイル(参考)

- `apps/soul/agent/src/cockpit/view-logic/glance-timeline.mjs`(+93 −14 ほど・CRLF)
- `apps/soul/agent/src/cockpit/ui/app.mjs`(初期化の 1 行に `s.stream` を渡す・冒頭の説明 2 行・CRLF)
- 新規 `apps/soul/agent/src/cockpit/view-logic/glance-venue-m.test.mjs`(12 件・CRLF)
