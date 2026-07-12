# S3 Domain A レビュー（test レーン）: 呼べば応える（会話ログ+発火オーケストレーション）

> レビュアー: Review-Sylph（test レーン）。委任元: Orch-Sylph。読み取り専任（本 .md のみ書く）。
> 対象実装記録: [../../waves/s3/domain-a.md](../../waves/s3/domain-a.md) §3（生数字の主張）
> 判定基準: [../../orchestration/s3-wave-plan.md](../../orchestration/s3-wave-plan.md) §1 機械ゲート・§4 blocking基準
> 実行環境: win32 / Node（`apps/soul/agent`）。すべて自分で独立実行した生数字のみ記録。

## 判定: **PASS**（blocking なし）

Gnome の §3 生数字の主張はすべて独立実行で一致。新規テストはホローでなく具体値で振る舞いを縦に固定。
既存テストは書き換えゼロ（末尾追記のみ）。lockfile 不変・新規依存ゼロ・決定的（2回同数）・preflight は
ハングせず PASS/EXIT=0。

## 1. 全テスト無退行（独立実行・2回）

`cd apps/soul/agent && node --test`（timeout 300s）を自分で2回実行:

| 回 | tests | pass | fail | cancelled | skipped | todo | duration_ms |
|----|-------|------|------|-----------|---------|------|-------------|
| 1  | 257   | 257  | 0    | 0         | 0       | 0    | 1036.173    |
| 2  | 257   | 257  | 0    | 0         | 0       | 0    | 998.4929    |

- baseline 231 + 新規 26 = **257** に一致（Gnome 主張と同値）。
- fail / cancelled / skipped すべてゼロ。
- **2回とも 257/257/0**（決定的・時刻依存フレークなし）。

新規内訳（後述の diff/読解で裏取り済み）: fire-injection **8** / fire-orchestrator **9** /
transcript-buffer **+3** / cockpit-server **+6** = **+26**。

## 2. preflight-fire（独立実行）

`cd apps/soul/agent && timeout 60 node scripts/preflight-fire.mjs`:

```
[preflight-fire] server listening at http://127.0.0.1:3361 (loopback)
[preflight-fire] POST /api/ears/start → 200
[preflight-fire] POST /api/fire   → 202 fired=true reply=はーい、どうしたの？
[preflight-fire] SSE soul(thinking→speaking→idle) + soul transcript observed
[preflight-fire] RESULT: PASS (fire → ask → speak → soul recorded; SSE observed; no real SDK/TTS/mic)
[preflight-fire] server closed (no hang)
[preflight-fire] EXIT=0
```

- **RESULT: PASS / EXIT=0**。127.0.0.1 バインド・clean close（ハングなし）を実測。

## 3. lockfile 不変・新規依存ゼロ（実測）

- `git diff --stat pnpm-lock.yaml apps/soul/agent/package-lock.json` → **出力なし（差分ゼロ）**。
- `git diff apps/soul/agent/package.json` → **出力なし（dependencies 不変・新規依存ゼロ）**。

## 4. 新規テストのホロー検査（読解）

すべて呼んだだけの空テストでなく、具体値で振る舞いを固定。実 SDK/実マイク/実器/実再生は不使用。

### 4.1 fire-injection.test.mjs（8件・純関数 fixture）
- 窓境界: threshold=995000 で「境界ちょうど(995000)含む・1ms前(994999)落とす」を `includedCount`/`droppedByWindow`
  と**整形後テキスト全文** `"you: 境界ちょうど\nyou: 窓内"` で固定。
- 空窓 → `includedCount=0`/`text=''`/`droppedByWindow=1`。空配列 → throw せず空注入。
- you/soul 混在ラベルを seq 昇順で全文固定 `"you: …\nsoul: …\nyou: …"`。
- 文字上限: maxChars=21 で最古1行落とし → 全文 `"you: BBBBB\nyou: CCCCC"`・`droppedByLimit=1`・`charCount<=21`。
- 最新1行が上限超でも空にしない（`droppedByLimit=0`・`text` は `"you: "` 始まり）。
- 不正 nowMs（欠落/文字列/NaN）は TypeError。
- コード実測: `fire-injection.mjs` に `Date.now`/`import`/`process`/`fetch` が**皆無**＝純関数・時計は nowMs 引数のみ ⇒ 決定的。

### 4.2 fire-orchestrator.test.mjs（9件・縦貫通・fake 注入）
- fake `session.ask`（カナ応答）・fake `speakImpl`（テキスト記録）・fake channel/player・**実** transcript-buffer で構成。実 SDK/実 TTS 不使用を確認。
- busy 中2発目無視: deferred gate で1発目を thinking に留め、`askCount===1`・2発目 `reason:"busy"`/`state:"thinking"` を縦に固定。
- 空窓で ask 未呼び出し: `windowMs:0`＋`nowImpl` で窓外へ押し出し `askCalled===false`。
- throw 時 idle 復帰: ask throw / speak throw ともに `states==["thinking",...,"idle"]`・`reason:"error"`・fireError 診断・
  speak throw 時は soul 追記なし（`buffer.all().length===1`）を検証（finally 保証を実挙動で固定）。
- soul append: 正常系で `all[1].speaker==="soul"`・`startMs/endMs===0`・`onSoulTranscript` を縦に検証。

### 4.3 transcript-buffer.test.mjs（+3・追加のみ）
- diff は `@@ -169,3 +169,39 @@` の**末尾追記のみ**＝既存11ケース無変更を実測。
- 既定 `speaker==="you"`（S2 挙動不変）・`"soul"` 指定で soul エントリ（frozen 維持）・不正値（`"bot"`/`1`）は
  RangeError かつ `size()===0`（失敗 append は何も残さない）を具体値で固定。

### 4.4 cockpit-server.test.mjs（+6・追加のみ）
- diff は `@@ -558,3 +559,181 @@` の**末尾追記のみ**＝既存21ケース無変更を実測。
- 未注入 503（`fireState()===null`）・受理 202（fire 結果 JSON＋`state` 補完）・busy 200（`{fired:false,reason:"busy",state:"thinking"}`）・
  close で dispose・SSE `soul`(thinking/speaking/idle)/`fire`(accepted:true)/`transcript`(speaker:"soul") を固定。
- 最終ケースは **実** createFireOrchestrator を fake session/speak/channel/player＋fake pipeline の実バッファに結線した縦貫通
  （実 SDK/実マイク不使用）。`askedText` に `you: ねえ`・soul 追記・SSE 列を検証。

## 5. blocking / non-blocking

- **blocking: なし。**
- **non-blocking（Gnome §4 の未決事項・Domain B/Orch 判断）:**
  1. preflight-fire を package.json scripts へ未登録（直接 `node scripts/preflight-fire.mjs` 実行・既存 preflight-cockpit 踏襲）。テストゲートには無影響。
  2. GET /api/fire は現状 404（405 明示は Domain B/Review の裁量）。状態機械が冪等保護するため機能上の欠陥ではない。
  3. SSE `fire` の accepted:false は busy/ears-not-running/empty-window のみ（empty-reply/error は diagnostic 経由）。UX 次第で拡張余地。

## 6. Orch への質問

なし。test レーンの機械ゲートはすべて緑・独立裏取り済み。設計整合・ワイヤ契約の妥当性は design/review レーンの領分。
