# S4 Domain A レビュー（test レーン）

> レーン: **test**（テストの質・網羅・実行）。レビュアー: Review-Sylph。呼び出し元: Orch-Sylph。
> 対象: `apps/soul/agent`（`node --test`）。日付: 2026-07-13。読み取り専任・自分で再実行した生数字を根拠にする。
> 総合判定: **PASS**（blocking ゼロ・non-blocking 2 件は軽微観察）。

## 0. 自分で再実行した `node --test` 生数字（tail）

`cd apps/soul/agent && node --test`（1 回で緑・空/interrupted なし・再試行不要）:

```
1..326
# tests 326
# suites 0
# pass 326
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 1321.6752
```

- Claim（domain-a.md §8: tests 326 / pass 326 / fail 0）と **完全一致**。
- 無退行: S4 前ベースライン 284 → 326（+42）。§8 内訳（演出表 7 / パーサ 13 / 翻訳層 9 / channel-client +3 / cockpit +1 / orchestrator +9 = 42）を各テストファイルの `test(...)` 実数で照合し一致（下記各項目）。偽装した緑・skip/todo 隠しは無し（skipped 0 / todo 0）。

## 1. 実行と数字の一致（項目 1）— **PASS**
- 上記生数字が Claim と一致。生数字は自分の実行から採取。
- 内訳照合（新規テスト実数）:
  - 演出表 `expression-table.test.mjs`: 7 本（L41/48/55/63/74/87/101）。
  - パーサ `expression-parser.test.mjs`: 13 本（L11–123）。
  - 翻訳層 `expression-translator.test.mjs`: 9 本（L10–109）。
  - channel-client 追加 3 本（`channel-client.test.mjs` L82 既定 requiredKinds envelope / L98 sendEnvelope accepted / L126 sendEnvelope rejected）。
  - cockpit 追加 1 本（`cockpit.test.mjs` L71 sendEnvelope 接続共有）。
  - orchestrator 追加 9 本（`fire-orchestrator.test.mjs` L47 タグ教示 + L76/109/140/171/196/225/248/275 の縦検証 8 本）。

## 2. 性質テスト `speechText` に `<``>` が残らない（項目 2）— **PASS**
- 実在: `expression-parser.test.mjs` L123–155「性質: speechText に < > は絶対に残らない」。
- 網羅: fixtures 18 種が well-formed 既知（`<smile>`）・未知（`<wink>`/`<zzz>`/`<explode>`）・壊れ（`<>` `a<b` `a>b` `<<>>` `壊れ<未閉じ` `閉じすぎ>>>`）・混在（`<nod>うん<troubled>むむ<explode>！`）・タグのみ（`<smile>`）・生不等号（`文中に < 生の不等号 >`）・args 付き（`<look-at x=.3 y=-.2>`）・絵文字/多重不正（`😀<surprised>びっくり<><`）を含む。各 fixture で `!includes("<")` と `!includes(">")` を assert し、加えて events が既知語のみ・diagnostics が配列（throw しない）を確認。
- 単一 fixture でなく複数代表入力に対する性質検証として書かれている（要求充足）。実装（`expression-parser.mjs` L91–96 の無条件 stray 剥ぎ）がこの不変条件を担保している。

## 3. パーサ fixture 網羅（項目 3）— **PASS**
- 出現順: L28–40（`<nod>そうだね<look-away>ちょっと<troubled>` → `["nod","look-away","troubled"]`）。
- position 保持: L18–26 / L36–39（元 replyText 内のタグ開始位置を昇順で assert）。
- args 保持: L72–79（`<look-away reason=shy>` → `events[0].args === "reason=shy"`）。
- 未知タグ診断: L52–60（`unknownTag` を剥離 + 診断・event 化しない）。
- 壊れタグ非 throw: L95–104（未閉じ `<`/単独 `>` で `brokenTag` count=2・throw せず）・L106–112（空タグ `<>`）。
- 非文字列入力: L114–120（`null/undefined/42/{}/[]` を空文字扱い・throw せず）。
- 6 語既知認識: L42–50（`EXPRESSION_WORDS` 全語が event 化・診断ゼロ）で表とパーサの語彙一致を固定。

## 4. 演出表健全性テスト（項目 4）— **PASS**
- 全語 slot 束を持つ: L48–53。
- sustain 2〜4s: L63–72（2000〜4000ms・裁定 4）。
- slotId 契約語彙内: L55–61（契約 16 slotId enum を `CONTRACT_SLOTS` にミラーし照合）。
- ADS 合計 > 0: L87–99（各相非負 + 合計 > 0＝zero-life envelope 禁止）。
- peak 域内: L74–85（中央 -1..1 / 重み 0..1 をスロット種別で判定）。
- 追加: 語彙 6 語ちょうど（L41–46）・1 語内 slotId 重複なし（L101–106）。
- データ駆動宣言が壊れたら落ちる構造: 全テストが `EXPRESSION_TABLE`/`EXPRESSION_WORDS` を反復し、数値の在り処（`expression-table.mjs`）を直接検証している。

## 5. 翻訳層テスト（項目 5）— **PASS**
- intensity スケール: L47–58（`troubled` ×0.5・時間相不変）・L275–292 の orchestrator 側でも `expressionIntensity:0.5` で `-0.35→-0.175` を実測。
- クランプ境界: L67–79（×2 で mouth-smile 0.8→1.0・gaze -0.6→-1.0）・L81–100（k∈{0,0.3,1,3,100} で全語 payload が域内）。
- 未知語診断: L41–45（`unknownWord`・空 payloads）。
- args 受理の口: L109–113（args 付きでも 6 語は payload 不変＝S5 の口だけ開く）。
- 追加: 係数 0 → peak 0（L60–65）・非有限/負（`NaN/Infinity/-Infinity/-0.5/"1.0"/null`）→ 1.0 丸め（L102–107）。実装（`expression-translator.mjs` L68 の型ガード）と一致。

## 6. orchestrator 縦検証（fake）（項目 6）— **PASS**
観測点は fake channel の `envelopes` 配列・fake speak の `spoken` 配列・実 `transcript-buffer` の `buffer.all()`・`onExpression`/`onDiagnostic` 収集で、実装細部の写経でなく観測可能挙動を検証している。

| 要求 | テスト | 検証内容 |
|---|---|---|
| (a) speechText のみ speak（タグ込みでない） | L76–107 | `"そうだね<nod>"`→`spoken[0].text==="そうだね"`・`result.replyText==="そうだね"` |
| (b) envelope がスロット毎 | L109–138 | `<smile>` → envelopes 4 件（mouth-smile/eye-blink-left/eye-blink-right/head-tilt）・各 payload 5 フィールド |
| (c) rejected/throw で発話止まらない | L140–169（rejected）/ L171–194（throw） | どちらも `fired:true`・`spoken.length===1`・診断へ握る |
| (d) 部分適用正常 | L140–169 | 4 スロット中 1 rejected・3 applied → `onExpression {applied:3, rejected:1}` |
| (e) タグのみ応答で演出のみ（speak/append 無し） | L196–223 | `"<look-away>"`→`fired:false, reason:"expression-only", expressed:true`・`spoken.length===0`・`buffer.all().length===1`・envelopes 2 件 |
| (f) soul 記録 = speechText | L96–100 / L342–347 | `buffer.all()[1].text==="そうだね"`・`!includes("<")`・startMs/endMs=0 |
| (g) onExpression 発火 | L105 / L136 / L220 | 語ごとに `{word, applied, rejected}` 通知 |
| (h) 未知タグ診断 | L225–246（発話あり）/ L248–273（未知タグのみ→fireEmptyReply） | `expressionUnknownTag` 診断・声にも演出にも出さない |

実装（`fire-orchestrator.mjs` L232–270 の分岐・L148–191 の applyExpressions）と各挙動が対応。

## 7. 既存テストの改変（項目 7）— **PASS**
- soul 記録 = speechText 化: `fire-orchestrator.test.mjs` の既存縦検証（L294–352）は従来 replyText 記録のままだが、S4 で speechText 化バグ修正を固定する新規テスト（L76–107 の soul 記録 assert）が追加され、既存テストの意味は退行していない（タグ無し応答では speechText==replyText なので L294 系は不変のまま通る）。裁定済みの意図変更として妥当・最小。
- requiredKinds 拡張: `channel-client.test.mjs` L82–96 を **新規追加**（envelope 無しで fail-fast）。既存 hello 照合テスト（L67–80）は supportedKinds を `["intent.set","intent.envelope"]`（speech 欠）にして `intent.speech` 欠落で throw を検証する形で、新既定でも意味不変。ws-double 既定 supportedKinds は 3 種（envelope 含む）ゆえ他の既存テストは無退行。無関係な既存テストを緩めた形跡なし。

## 8. fake 徹底（項目 8）— **PASS**
- 実マイク・録音物・実 SDK・実 TTS・実器接続を引くテストは無い。
- orchestrator: fake session（`ask` がカナ返し）・fake speakImpl・fake channel/player・実 transcript-buffer（純ロジック）。
- 翻訳層/パーサ/演出表: I/O ゼロの純関数。
- channel-client/cockpit: `MinimalWebSocket` + `ws-double`（node:http upgrade の RFC6455 最小自作サーバ・器コード非 import・npm 依存ゼロ）への **127.0.0.1 loopback テストダブル**接続。実器ではなくダブルゆえ fake の範疇（ws-double.mjs 冒頭コメントが「配線の存在 ≠ 疎通・実器は人間ゲート preflight-e2e」と正直に限界を明記）。cockpit は fake connectImpl のみ。

## non-blocking（軽微観察・修正不要）
1. 性質テスト（parser L123）は 18 個の固定 fixture 集合で、真の property-based（ランダム生成）ではない。ただし委任要件（既知/未知/壊れ/混在/タグのみの網羅）は代表入力で満たしており、不変条件を複数入力で固定できている。強化するなら fuzz 生成器を足せるが必須ではない。
2. orchestrator の envelope 送出 throw ケース（`fire-orchestrator.test.mjs` L171–194）は `onExpression` を渡しておらず、その経路の summary（`{applied:0, rejected:1}`）自体は未 assert。診断（`expressionSendError`）は検証済みで挙動の要は押さえている。rejected 経路（L140）では summary を assert 済みのため網羅性への実害なし。

## 総合判定
**PASS**（blocking ゼロ）。生数字 326/326/0 を自分の実行で確認・Claim と一致・無退行（284→326・+42 内訳照合済み）。性質テスト・fixture 網羅・演出表健全性・翻訳層・orchestrator 縦検証 (a)〜(h)・既存改変の妥当性・fake 徹底、すべて実在テストで観測可能挙動を検証している。non-blocking 2 件はいずれも修正不要の軽微観察。
