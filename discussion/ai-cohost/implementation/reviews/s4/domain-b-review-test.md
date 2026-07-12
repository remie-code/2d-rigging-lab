# S4 Domain B レビュー（test レーン）

> レビュアー: Review-Sylph（test レーン）。呼び出し元: Orch-Sylph。
> 対象: `apps/soul/agent`（S4 Domain B・可視化 + SSE expression 結線 + preflight 演出足し）。
> 日付: 2026-07-13。**読み取り専任**・全数字は自分で再実行した生値。
> 根拠 Claim: [../../waves/s4/domain-b.md](../../waves/s4/domain-b.md) §6（tests 331・+5）・§4（preflight PASS）。

## 総合判定: **PASS-with-nonblocking**

機械ゲート（node --test 331/331/0・無退行）・preflight 2 本（EXIT=0）を**自分で再実行して確認**。
Claim の生数字（331/331/0・+5・preflight PASS）と一致。追加テストは観測可能挙動を検証しており、
既存テストは addition-only で一切改変・緩めなし。blocking なし。non-blocking 2 件（下記 §7）。

---

## 1. node --test 再実行・数字一致・無退行 — **PASS**

`cd apps/soul/agent && node --test`（timeout 300s・自分で実行）末尾:

```
1..331
# tests 331
# suites 0
# pass 331
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 1142.0985
```

- Claim（331/331/0・§6）と**完全一致**。
- 無退行: Domain A 後ベースライン 326 → Domain B 後 331（**+5**・≥326 を満たす）。空/interrupted なし・1 回で確定。

## 2. cockpit-server.test.mjs の expression broadcast テスト実在・実挙動検証 — **PASS**

+2 の両方が実在し、素通し broadcast の**観測可能挙動**を検証している（写経でない）:

- **L684** `cockpit SSE: fire() の onExpression が expression イベントで流れる（演出行の材料）`:
  fake orchestrator の `drive` が `hooks.onExpression({word:"nod",...})` / `{word:"smile",args:"x=.3",applied:3,rejected:1}`
  を呼ぶ → SSE クライアントが `expression` イベントを `waitFor` で受信し、`word/applied/rejected/args` が
  **素通しで届く**ことを assert（L703-710）。実装 `cockpit-server.mjs:744 onExpression:(info)=>broadcast("expression",info)` の振る舞いを検証。
- **L779** `実 orchestrator の演出タグが sendEnvelope→onExpression→SSE expression まで縦貫通`:
  **実** `createFireOrchestrator` に fake session（`ask`→`"そうだね<nod>"`）を注入し、
  parseExpressionTags→translate→`channel.sendEnvelope`→`onExpression`→SSE まで貫通。
  `expr.data.word==="nod"`・`applied===1`・`envelopes[0].slotId==="head-vertical"`（L819-823）を assert。
  タグ剥離後 `replyText==="そうだね"`（L816）も固定。**強い縦貫通テスト**。

## 3. cockpit-page.test.mjs のテスト実在・既存不改変 — **PASS**

+3 が実在（HTML 構造 assertion・当ドメインの既存流儀「見た目はテストしない」に整合）:

- **L212** `subscribes SSE expression events and draws an expression row`: `addEventListener("expression"`・`addExpressionRow(` を固定。
- **L219** `expression rows carry word + applied/rejected slot counts, distinct class + CSS`:
  `function addExpressionRow(`・`className="row expression"`・`d.word`/`d.applied`/`d.rejected` 参照・CSS `.row.expression{…var(--accent)`。
- **L234** `expressionUnknownTag diagnostic adds a ghost row …; other expression diagnostics do not`:
  `type==="expressionUnknownTag"`+`addGhostRow(` を固定し、**過剰表示回避の裁定**を negative assert で担保
  （`doesNotMatch` で `expressionBrokenTag`/`expressionRejected`/`expressionSendError` の分岐が**無い**ことを固定・L244-246）。

**既存テスト不改変の証明**（git diff HEAD）: 両ファイル **128 insertions / 0 deletions**
（cockpit-page +39・cockpit-server +89）。削除・変更行ゼロ = 既存 assert の緩めなし。
S3 followup §1-5 の名前ズレ既存ケース `diagnostic asrFailure adds a ghost row; other diagnostic types do not`
（cockpit-page.test.mjs L98-105）は**触っていない**（regime 通り）。

## 4. preflight 実行 — **PASS**（EXIT=0 × 2）

自分で実行（各 timeout 120s）:

- `node scripts/preflight-fire.mjs` → **EXIT=0**。末尾:
  ```
  [preflight-fire] POST /api/fire   → 202 fired=true reply=はーい、どうしたの？
  [preflight-fire] SSE soul(thinking→speaking→idle) + soul transcript observed
  [preflight-fire] SSE expression(smile) observed — envelope slots: ["eye-blink-left","eye-blink-right","head-tilt","mouth-smile"]
  [preflight-fire] RESULT: PASS (…演出 envelope → SSE expression; no real SDK/TTS/mic)
  [preflight-fire] server closed (no hang) / EXIT=0
  ```
  **演出縦貫通が緑**: `<smile>` → sendEnvelope（fake accepted）4 スロット → SSE expression(smile)・applied>0/rejected=0 を実 HTTP/SSE で確認。ハングなし。
- `node scripts/preflight-cockpit.mjs` → **EXIT=0**。末尾:
  ```
  [preflight-cockpit] GET /            → 200 html=true hasTimeline=true
  [preflight-cockpit] GET /api/state   → 200 ears=stopped health=true
  [preflight-cockpit] GET /api/devices → 200 deviceCount=0 error=ffmpeg spawn failed: spawn ffmpeg ENOENT
  [preflight-cockpit] RESULT: PASS (page served, state + devices respond; mic untouched)
  ```
  無退行（tag 追加後もハングなし）。ffmpeg ENOENT はこの環境に ffmpeg 未インストールなだけで、
  スクリプトの設計通り「列挙失敗でも 200・devices 配列」を満たし PASS（実マイク非依存）。

## 5. fake 徹底・実 SDK/実器/実マイク非依存 — **PASS**

- **observe-expressions.mjs（実 SDK）はテストからも preflight からも import されない**（grep 確認: `observe-expressions` の参照は当該ファイル内の自己ログのみ）。サブスク消費なし。**本レビューでも走らせていない。**
- cockpit-server.test.mjs: pipeline / orchestrator / spawn / session / speak / channel を全注入 fake。実 ffmpeg/whisper/ONNX/SDK 不使用。SSE は素の node:http。
- preflight-fire: fake pipeline・fake session（タグ込み応答固定）・fake speak・fake channel（sendSpeech/sendEnvelope とも accepted 固定）・fake player。実 SDK/TTS/器/マイク一切なし（コメント L4-6・実装で確認）。
- preflight-cockpit: 耳 Start を押さない = 実デバイス非依存。settings は OS temp 注入で実設定を汚さない。

## 6. 追加テストが観測可能挙動を検証しているか — **PASS**

- server 側 +2 は SSE ワイヤに出る事実（broadcast の event/data・envelope の slotId）を検証。特に L779 は実 orchestrator 経由の縦貫通で実装細部の写経ではない。
- page 側 +3 は HTML 静的 regex（当ドメイン既存テスト全ての確立された流儀・DOM 実行はしない=「見た目は人間ゲート」）。negative assert（過剰表示回避）も含め、消費するワイヤ契約と描画関数の存在・参照フィールドを固定している。

---

## 7. non-blocking（判定を下げない・申し送り）

1. **page テストは静的 regex で、`addExpressionRow` の DOM 出力（`✓N/✗M` 文字列生成）自体は実行検証されない。**
   これは cockpit.html の全関数に共通する既存の構造的限界（テストハーネスが DOM を実行しない・視覚は人間ゲート）で、
   Domain B 固有の退行ではない。server 側縦貫通 + preflight-fire が「expression が SSE に乗る」までは実挙動で担保済み。
   将来 cockpit.html に DOM 実行テスト基盤を入れる wave で addExpressionRow の出力文字列を behavioral 化する余地（s4-followup 相当）。

2. **既存名前ズレの累積（cockpit-page.test.mjs L98）**: S3 followup §1-5 の
   `diagnostic asrFailure adds a ghost row; other diagnostic types do not` は、fireEmptyReply/fireError に続き
   expressionUnknownTag もゴースト行を出すようになり名前の含意が更にズレたが、既存テスト変更禁止の規律で未改名（正当）。
   domain-b.md §7-4 に申し送り済み。次に当該既存ケースを触る wave で改名推奨（Domain B の責ではない）。

---

## 8. 検証で走らせたコマンド（全て自分で実行・生値）

| コマンド | 結果 |
|---|---|
| `node --test`（apps/soul/agent） | tests 331 / pass 331 / fail 0 / duration 1142ms |
| `node scripts/preflight-fire.mjs` | RESULT: PASS / EXIT=0（演出縦貫通 smile 4 スロット緑） |
| `node scripts/preflight-cockpit.mjs` | RESULT: PASS / EXIT=0（無退行） |
| `git diff --stat HEAD -- (両 test)` | 128 insertions / 0 deletions（既存不改変） |
| grep `observe-expressions` | 参照は当該ファイル自己ログのみ（テスト/preflight 非参照） |
