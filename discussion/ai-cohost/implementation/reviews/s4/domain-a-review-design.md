# S4 Domain A レビュー（design レーン）

> レビュアー: Review-Sylph（design レーン）。呼び出し元: Orch-Sylph。読み取り専任。
> 日付: 2026-07-13。対象: `apps/soul/agent`（S4 Domain A 実装）。
> 総合判定: **PASS-with-nonblocking**。blocking なし。

観点は設計の健全性・アーキテクチャ・シーム。数値の再実行はしていない（機械ゲートの数字は Gnome 報告に委ね、私は検証していない項目の数字を書かない）。器 diff 空は自分で `git status --porcelain` を実行して確認した。

---

## 検証項目 PASS/FAIL

### 1. 純関数性 — PASS
- パーサ `parseExpressionTags`（`expression-parser.mjs:53-99`）: I/O なし・throw しない・入力非破壊（`input` は `slice` のみ）・診断は戻り値。非文字列は空文字防御（L54）。グローバル可変状態は `TAG_RE`（`:42` module scope, `g` フラグ）のみだが、関数冒頭 `TAG_RE.lastIndex = 0`（L62）で毎回リセットし、関数内でループを閉じる（L65-88）ため観測可能な純関数性は保たれる。→ non-blocking #1 に理論的再入リスクを記録。
- 翻訳層 `translateExpression`（`expression-translator.mjs:58-84`）: `bundle.map` で新オブジェクト生成・表を破壊しない・診断は戻り値・グローバル状態なし。`clamp`/`slotRange` も純関数。
- 演出表（`expression-table.mjs`）: `Object.freeze` を束・エントリまで再帰適用（L52-92）。可変漏れなし。

### 2. 診断の設計 — PASS
- パーサ/翻訳層は診断を戻り値（`diagnostics[]`）で返し、副作用ゼロ。orchestrator が `expression${capitalize(d.type)}` でフックへ橋渡し（`fire-orchestrator.mjs:237-239, 153-156`）。層の分離は綺麗。
- `capitalize`（`fire-orchestrator.mjs:299-302`）で `unknownTag→expressionUnknownTag` / `brokenTag→expressionBrokenTag` / `unknownWord→expressionUnknownWord`。domain-a.md §7 の type 表と一致。

### 3. クランプの正しさ — PASS
- 翻訳層 `slotRange`（`expression-translator.mjs:44-46`）: `CENTERED_SLOTS`（head-horizontal/head-vertical/head-tilt/gaze-horizontal/gaze-vertical/body-x/body-z）→ `[-1,1]`、それ以外 → `[0,1]`。
- 器契約 `channel-intent-envelope-payload-schema.json:52-62` の `normalizedRanges`: head-centered/gaze-centered/body-x/body-z = `[-1,1]`、blink-*/mouth-* = `[0,1]`。**完全一致**。head-tilt を centered 扱いする点も peak description「Centered slots (head/gaze/body) accept -1..1」（同 L34）と整合。
- 器は「域外は clamp せず slotValueOutOfRange で拒否」（同 L34）。魂側で `clamp(peak*intensity, min, max)`（`expression-translator.mjs:70-81`）して収めるので域外送出は構造的に起きない。演出表の全 peak も基準値時点で域内（`expression-table.mjs` 各行を目視確認）。

### 4. sendEnvelope の写経忠実性 — PASS
- `channel-client.mjs:156-171` の `sendEnvelope` は写経元 `reference-driver.mjs:801-824` と同型: id 採番 `req-${++idCounter}`、payload `{slotId, peak, attackMs, sustainMs, decayMs}`（キー・順序一致）、`pending` に replyTo 相関、`{v:1,id,kind:"intent.envelope",payload}` 送出、`withTimeout(..., "envelope reply for ${slotId}")`。sendSpeech と相関機構を共有。
- 器コード import なし: `grep -rn runtime-player apps/soul/agent/src apps/soul/agent/scripts` の全ヒットはコメント/ドキュメント参照のみ（実 import はゼロ）。特区規律 OK。

### 5. requiredKinds 変更の blast radius — PASS
- 既定 `requiredKinds` を `["intent.speech","intent.envelope"]` に変更（`channel-client.mjs:57`）。
- 器 additive 広告: `channel-exchange-examples.json:16` の `supportedKinds` は常に `["intent.set","intent.envelope","intent.speech"]` の 3 種。既定に envelope を足しても実器接続は無退行。
- fail-fast: hello 照合（`channel-client.mjs:125-131`）で不足 kind は throw。envelope 非対応の相手には接続時に落ちる（表情の黙殺事故を封じる）。設計妥当。
- 既存呼び出し: `preflight-e2e.mjs:79` は `connectChannel(args.url)` を requiredKinds 未指定で呼ぶ → 新既定を使う。`cockpit.mjs:100,216` の `createLazyChannel→connectChannel` も既定使用。いずれも実器（3 種広告）相手なので通る。壊れない。
- lazyChannel の 1 接続共有: `createLazyChannel.sendEnvelope`（`cockpit.mjs:135-142`）は `ensure()` で speech と同じ 1 接続を張り委譲。speech/envelope が同一接続を共有する設計は正しい。

### 6. orchestrator 分岐の健全性 — PASS
- 3 分岐が漏れなし（`fire-orchestrator.mjs:241-270`）: (a) `!hasSpeech && !hasEvents`→`empty-reply`（L245-248）、(b) `hasEvents` で speaking 昇格→`!hasSpeech`→`expression-only`（speak せず soul append せず envelope のみ・L254-258）、(c) `hasSpeech`→envelope 開始と同時に speak→soul append（L260-270）。
- finally idle 復帰（L276-279）は冪等 setState（L134-138）で二重発火なし。busy 状態機械（L203-206）で state≠idle の fire は無視。従来設計と整合。
- envelope/speak 独立: `applyExpressions` は never-throw（内部で try/catch し診断へ握る・L159-182）。`expressionPromise` は speak 前に開始（L252）、speak throw 時は catch（fireError, L271-275）へ飛ぶが expressionPromise は並行完走する（片方の失敗が他方を巻き込まない）。設計意図に忠実。
  - non-blocking #2: speak throw の catch 経路では `await expressionPromise` に到達しないため envelope が fire-and-forget 化する（機能上は独立要件に沿うが観測性が落ちる）。

### 7. フックのワイヤ契約（Domain B 向け）— PASS
- `onExpression(summary)`（`fire-orchestrator.mjs:184-188`）: `{word, applied, rejected}` + args あれば `args`。domain-a.md §7 の `{word, args?, applied, rejected}` と一致。語ごと 1 回発火。発火マーカーと同型消費に足る。
- `onDiagnostic` の type 群（expressionUnknownTag/BrokenTag/Rejected/SendError/UnknownWord）は domain-a.md §7 表と一致。`expressionRejected` は `{type,slotId,error}`（L171-176）、`expressionSendError` は `{type,slotId,message}`（L163,180）。将来の破綻なし。

### 8. S5 拡張性 — PASS
- 翻訳層署名 `translateExpression(word, args, intensity=1.0)`（`expression-translator.mjs:58`）は args を受ける口が実在。パーサは args を生文字列で `event.args` に保持（`expression-parser.mjs:73-77`）。構文正規表現 `/<([A-Za-z][\w-]*)(\s[^<>]*)?>/g`（L42）は group2 で args を捕捉。
- look-at(x,y) は「演出表に行追加 + 翻訳層で args 解釈分岐追加」だけで足せる（パーサ署名・構文・翻訳層署名すべて不変）。口は実際に開いている。

### 9. 数値の局在 — PASS
- 演出数値は `EXPRESSION_TABLE`（`expression-table.mjs:52-92`）のみ。パーサに数値なし。orchestrator の数値は `expressionIntensity` 既定 `1.0`（`fire-orchestrator.mjs:116`）＝既定値でありマジックナンバーではない。
- 翻訳層のクランプ境界 `-1/1/0`（`slotRange`）と `CENTERED_SLOTS` リストは器契約 normalizedRanges 由来の**構造値**であって演出チューニング値ではない。コメント（`expression-translator.mjs:8,28`）でも明示。局在の妥当性 OK。

### 10. 器コード・C4/C5 契約・lockfile・package.json 不変 — PASS
- 自分で実行: `git status --porcelain -- apps/runtime-player pnpm-lock.yaml package.json` → **出力空（クリーン）**。器 diff 空を確認した。
- soul 側 diff は 7 ファイル（新規演出3層 + channel-client/cockpit/ws-double/orchestrator 改修）に限局。

---

## blocking / non-blocking

### blocking
- なし。

### non-blocking（提案・任意）
1. **TAG_RE の module-scope 共有 lastIndex**（`expression-parser.mjs:42,62`）: 毎回リセットで純関数性は保たれ JS 単一スレッドで実害なしだが、`g` フラグ付き共有正規表現の lastIndex 依存は理論的再入リスク。関数内でローカル `new RegExp(...)` にすれば共有可変状態が消える。純度を厳密化したい場合のみ。
2. **speak throw 時の expressionPromise 非 await**（`fire-orchestrator.mjs:261-275`）: catch 経路で `await expressionPromise` に到達せず envelope が fire-and-forget 化。独立要件（片方の失敗が他方を巻き込まない）には沿うが、テスト観測性・診断完全性の観点では try 内末尾ではなく finally 相当で握って完走を待つ設計もありうる。現状で機能欠陥はない。

---

## 総合判定

**PASS-with-nonblocking**。設計の健全性・シーム・器契約整合はすべて満たす。純関数性・診断分離・クランプ域一致・写経忠実性・blast radius 最小・分岐網羅・ワイヤ契約・S5 拡張の口・数値局在・器不変、いずれも根拠つき PASS。blocking 指摘なし。non-blocking 2 件は純度厳密化と観測性向上の任意提案で、Domain B / S5 へ送っても支障ない。
