# 配信の組み直し 人間ゲート前の直し レビュー(Review-Sylph)

基準 19e53770 からの作業ツリーの差分を、設計 §3 の 7・計画 Status 9 行目と §4・Gnome 報告(final-gnome-2.md)に照らして見た。実コードとテストを根拠にした(Gnome の説明だけには頼っていない)。

## 判定

**pass**(止めた指摘 0)。

## 止めた指摘

なし。§4 の 4 つの理由のどれにも当たらなかった。

- 1 設計とのずれ: 無し。設計 §3 の 7「つながらなくても場は開く」に沿い、場を先に open にして後ろでつなぐ形。
- 2 今の配信が壊れる: 無し。`node --test` 全件 pass。既存テストの期待値変更は仕様変更の分だけ(下)。
- 3 約束のテスト: 足りている(下)。
- 4 守りの決まり: 依存・lockfile 変化なし。鍵・実データ・チャッピーの規約/指示/判定の文面・skills/ に触れていない。LLM/API は偽のみ。

## 特に見てほしかった所の確認

- **後ろのつなぎの reject が未処理にならないか**: `startChatForStream` は `connecting.then(ok, ng).catch(...)` で全経路を握る。同期 throw も `Promise.reject` に変えて同じ then に乗る。呼び出しは `void`。テスト 1・3・4 が `unhandledRejection` を監視して空を確認している。OK。
- **場が閉じた/次の場になったあとに片付いたつなぎが状態に残らないか**: `stillMine` = `!closed && phase==="open" && 世代一致 && chatClient===mine`。外れたら `dropMine` で自分の器官だけ `stop()`(`chatClient` が別の器官=次の場や Connect したものなら触らない)。成功・失敗とも警告なし。テスト 1(閉じたあとの成功/失敗)・2(次の場が開いてから前の場が片付く、次の場の器官は残る)で確認。OK。
- **closeStream が後ろのつなぎで待たされないか**: `foldStream` は `foldChatClient()`(同期の stop)で畳むだけで、つなぎの Promise を待たない。開きかけも YouTube を待たなくなった(`phase="open"` の後に `void`)。テスト 1 は start が一生返らない偽で、始める 200・終える 200 を確認。OK。
- **Ctrl+C の道**: `endStream`→`closeStream`(同上)、その後 `close()` が `closed=true` と `foldChatClient()`。遅れて片付いたつなぎは `closed` で stale になり stop だけ呼ぶ。OK(Ctrl+C 専用のテストは無いが、`closed` と同じ判定を通る。持ち越し 3)。
- **自発の発火**: `requestSelfFire` の先頭で `streamPhase !== "open"` なら `{fired:false, reason:"stream-not-open"}`。自発の口(発火の予定 3031、speak-now 3074/3079、コメント反応 3132、思い出しの係 3195)は全部ここを通ることを grep で確認。手動 Fire は別経路で変更なし。思い出しの係は busy 以外の未受理を「見送り」として扱う(recall-desk.mjs 306〜309)ので整合。SSE の selfFire も出さない。テスト 5 が閉じている・開きかけ・開いている・閉じかけを順に確認(selfFire 行も 1 件だけ)。

## 約束のテスト(計画の依頼 1〜2)

- 応答しない偽の client で場が open になる・終えられる・あとから閉じても残らない: テスト 1(domain-e.test.mjs)。
- 失敗の警告(同じ文面・場は開いたまま): テスト 3。次の場・Connect/Disconnect との競り: テスト 2・4。
- 場が open でない間の自発の発火を捨てる: テスト 5。
- 既存テストの変更: 自発の発火を見る 8 件に偽の耳で場を開く前置きを足しただけ(見る中身は同じ)。cockpit-stream.test.mjs 1 件は「応答時点では後ろでつなぎ中」なので片付くのを待ってから見る形に。どれも仕様変更で妥当。

## 機械ゲート

- `apps/soul/agent` で `node --test`: 1884 tests / 1884 pass / 0 fail / 0 cancelled / 0 skipped(Gnome 申告と一致)。
- 根で `pnpm run check:soul-zone`: pass(1565 files・違反なし)。
- `git diff --stat 19e53770 -- pnpm-lock.yaml '**/package.json'`: 差分なし。
- 作業ツリーは Gnome 報告どおりのファイルのみ(plan.md は呼び出し元側で対象外)。

## 持ち越し・裁量(止めない)

1. **human-gate.md に 2 回目の場の URL の項目が残っている**(「(見ておいてほしいこと)同じ起動のまま 2 回目の配信を始めると…」)。計画 Status 9 行目は、ユーザー回答(別の配信はアプリを起動し直す・URL は毎回違う)により「人間ゲートの確かめからも外す」としている。Gnome は「そのまま残した」と報告。依頼 3 の「直した形に合わせる」と Status 9 に照らすと、この 1 行は消すのが筋(1 行削除で済む)。止める理由(§4)には当たらないので記録のみ。Orch-Sylph が人間ゲートに渡す前に消すことを勧める。
2. 後ろでつなぎ中の間、状態の `chat.connected` は `chatClient != null` なので「つながっている」と出る(実際は connecting)。上の帯の状態表示は lastChatStatus で補われ、Connect の経路も同じ性質。直前の動作と大きく変わらないので裁量。人間ゲートで「始めた直後の YouTube の表示」を見る項目が既にある。
3. Ctrl+C(close)後に遅れて片付くつなぎの専用テストは無い。判定は `closed` を含む同じ `stillMine` で、コードは正しい。端の場合として持ち越し。
4. `connected` の経路で `broadcastState()` を足している点、`"stale"` の戻り値を足した点、`mine` を呼んだ直後の `chatClient` で取る点(connectChat が await の前に器官を入れる前提)は Gnome の筋の通る裁量。前提はコメントに明記済み。

## 質問

なし。

## ループ 2

判定: **pass**(止めた指摘 0)。見たのは (a)(b) の 2 点だけ。

(a) 項目の削除
- human-gate.md から「同じ起動のまま 2 回目の配信…」の項目が消えている(基準との差分でも `-` の行として確認)。
- human-gate.md の URL に触れる行(19・52・53・57〜60・62・77 行目)を全部見た。2 回目の場の URL に触れるものは残っていない。手順 5 の「もう一度配信を始めて…Ctrl+C」は URL に触れない。

(b) ほかが壊れていないか
- 手順 4 の新しい項目(場はすぐ開く / 間違った URL のあとで 1 行 / 始めた直後でも終えられる・残らない / 「始めてる」が短い・勝手にしゃべらない)はすべて残っている。見出し「仕上げと人間ゲート前の直しで直した所」も残っている。
- `git diff --stat 19e53770`: コード・テスト 4 ファイルの行数は前回と同じ(cockpit-stream.test.mjs 8、domain-e.test 325、cockpit-server.mjs 98、cockpit-server.test 15)。変わったのは human-gate.md だけ(9 → 10 行)。plan.md は対象外で 2 行のまま。
- コードとテストは触られていないので、機械ゲートの結果(1884 pass・soul-zone pass・依存差分なし)は前回のまま有効。走らせ直してはいない。

質問: なし。
