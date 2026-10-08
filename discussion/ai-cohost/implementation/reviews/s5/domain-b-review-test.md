# S5 Domain B レビュー（test レーン）

> レビュアー: Review-Sylph（test レーン）。呼び出し元: Orch-Sylph（S5「目が開く」wave Domain B）。
> 対象: `apps/soul/agent`（S5 Domain B・視覚発火の結線＝mind + session）。
> 日付: 2026-07-13。**読み取り専任**・全数字は自分で再実行した生値。
> 根拠 Claim: [../../waves/s5/domain-b.md](../../waves/s5/domain-b.md) §8（tests 392・+20・内訳）。
> 契約の正: [../../orchestration/s5-wave-plan.md](../../orchestration/s5-wave-plan.md) §3 Domain B・§4 blocking 基準。

## 総合判定: **PASS-with-nonblocking**

機械ゲート（`node --test` 392/392/0・無退行）を自分で再実行して確認。視覚発火の成功系・失敗全分岐
（no-target 3 パターン・キャプチャ失敗 4 kind）・busy 無視・耳未起動・usage 計器・fake 徹底のいずれも
テストで固定されており、通常 Fire の既存挙動（18 本・変更ゼロ）を含め無退行が成立している。
blocking なし。non-blocking 1 件（domain-b.md §1 の「既存 N 本」記載の数字誤り・下記 §6）。

---

## 1. node --test 再実行・数字一致 — **PASS**

`cd apps/soul/agent && node --test`（timeout 300s・自分で 1 回実行・空/interrupted なし）末尾:

```
1..392
# tests 392
# suites 0
# pass 392
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 1447.1386
```

Claim（domain-b.md §8: tests 392 / pass 392 / fail 0）と**完全一致**。skipped/todo とも 0 ＝緑の偽装なし。

## 2. 内訳照合 — **PASS（増分は一致・「既存 N 本」の記載数字に誤りあり＝non-blocking）**

各テストファイルを `git show HEAD:<path>` で S5 Domain B 着手前の状態と比較し、実測で確認した:

| ファイル | 着手前（HEAD） | 現在 | 増分 | Claim の増分 |
|---|---|---|---|---|
| `src/mind/llm-session.test.mjs` | 8 本 | 11 本 | **+3** | +3 ✓ |
| `scripts/cockpit.test.mjs` | 11 本 | 14 本 | **+3** | +3 ✓ |
| `src/mind/fire-orchestrator.test.mjs`（`for` ループ4 kind 展開後の実行数・単体 `node --test` で実測 32） | 18 本 | 32 本 | **+14** | +14 ✓ |
| 合計 | 37 | 57 | **+20** | +20 ✓ |

増分（+3/+3/+14=+20）・合計 392 は Claim と一致。ただし domain-b.md §1 の実装ファイル一覧の説明文は
「既存 7 本は無変更」（llm-session）「既存 21 本は無変更」（fire-orchestrator）「既存 10 本は無変更」
（cockpit）と書いており、**実測の着手前本数（8 / 18 / 11）と食い違う**（いずれも 1〜3 本少なく記載）。
増分・合計・「無変更」という主張自体は正しい（下記 §3 の diff 確認で改変ゼロを実証済み）ので実害はないが、
ドキュメントの数字が不正確 → non-blocking（§6）。

## 3. 通常 Fire の無退行（既存テスト完全不変） — **PASS**

`git diff HEAD` で 3 ファイルとも既存部分に変更・削除が一切なく addition-only であることを確認:

- `llm-session.test.mjs`: 既存 183 行目まで無変更、184 行目以降に S5 セクションのみ追加（48 insertions / 0 deletions）。
- `fire-orchestrator.test.mjs`: 既存 529 行目まで無変更、以降に S5 セクションのみ追加（330 insertions / 0 deletions）。
- `cockpit.test.mjs`: 既存 230 行目まで無変更、以降に `createSessionProxy` テストのみ追加（65 insertions / 0 deletions）。

実装側 `fire-orchestrator.mjs` の通常 `fire()`（引数なし）分岐は、`processAskedReply` ヘルパー抽出後も
コードパスが完全同一であることをソースで確認（L363-411: busy/ears-not-running 判定→`vision` 分岐は
その後段で通常 Fire ロジックへは無関係・§3 の元インライン実装のロジックがそのままヘルパー呼び出しに
置換されているのみ）。`cockpit.mjs` の `sessionProxy` も同様に `createSessionProxy` への構造的抽出のみ
（URL 未設定チェック→`ensureFireResources`→`session.ask` の順序・エラーメッセージ文言とも完全同一）。

## 4. 視覚発火の失敗全分岐が fake で固定・session.ask を呼ばない — **PASS（blocking 相当・充足）**

- **no-target 3 パターン**（`fire-orchestrator.test.mjs` L703, L738, L761）: `getVisionTarget→null`／未注入
  （既定 `undefined`）／`throw` の 3 通りすべてで `askCalled === false` を明示 assert（L718, L748, L771）。
  `fireVisionError(kind:"no-target")` 診断・`{fired:false, reason:"vision-no-target"}` も固定。
- **キャプチャ失敗 4 kind**（L662-701 の `for` ループ）: `notFound`/`minimized`/`failed`/`timeout` の各 kind で
  fake `captureImpl` が `{error:{kind, message}}` を返し、`askCalled === false`・`fakeSpeak.spoken.length===0`・
  `buffer.all().length===1`（soul 追記なし）・`fireVisionError` 診断の `kind` 一致・`orch.getState()==="idle"`
  をすべて assert（L678-688）。実装側（`fire-orchestrator.mjs` L313-320）も `captured.error` があれば即座に
  `session.ask` を呼ばずに return しており、テストとソースの整合を確認。

## 5. 視覚発火の成功系 — **PASS**

`fire-orchestrator.test.mjs` L586-660（1 本の強い縦検証テスト）:

- `session.ask` へ渡る `content` 配列は長さ 2、`[0].type==="image"`／`source.type==="base64"`／
  `source.data==="ZmFrZQ=="`／`source.media_type==="image/jpeg"`、`[1].type==="text"`／会話窓+視覚指示文を
  含むことを assert（L622-630）。
- `speak` は speechText のみ・タグは含まない（L633-634）。
- 会話ログ正本（`buffer.all()`）に base64 が含まれないことを `!JSON.stringify(all).includes("ZmFrZQ==")` で
  明示的に固定（L642）。
- `onVisionCaptured` が `{title,width,height,jpegBase64,elapsedMs}` の完全形で 1 回発火することを
  `deepEqual` で固定（L645-652）。

## 6. busy 無視・耳未起動 — **PASS**

- L790-828: 通常 Fire を `thinking` に留めた状態で視覚発火を撃つと `{fired:false, reason:"busy"}` が返り、
  `capture.calls.length===0`（**キャプチャすら呼ばれない**）を明示 assert（L813）。
- L829-843: `getBuffer:()=>null` で `{fired:false, reason:"ears-not-running"}`。

## 7. usage 計器テスト — **PASS**

- 通常 Fire（vision なし）2 本（L535-568）: usage あり→`onUsage` に `{usage, vision:false}`／usage 省略→
  `onUsage` 未発火（`usages.length===0`）を明示固定。
- 視覚発火の成功系テスト内（L654）: `assert.deepEqual(usages, [{ usage: { input_tokens: 900 }, vision: true }])`
  で `vision:true` 側も固定。通常/視覚とも `usage` が `null`/未定義のときは発火しないことをソース側
  （`processAskedReply` L239: `asked.usage != null` ガード）と整合して確認。

## 8. fake 徹底・実 SDK/実 PowerShell 非依存 — **PASS**

- `fire-orchestrator.test.mjs` に `../eyes/` からの import なし（grep 確認・実 `captureWindow` は使われず、
  全テストが `makeFakeCapture` で `captureImpl` を注入）。`fs`/`writeFile` 等のディスク書き込み呼び出しも
  grep でゼロ件（画像をディスクに書かない担保）。
- `llm-session.test.mjs`・`cockpit.test.mjs` とも `queryImpl`/`getSession` を全 fake 注入。実 Agent SDK
  `query()`・実 PowerShell・実マイク・実 TTS はいずれも引いていない。

## 9. llm-session ask 拡張・createSessionProxy テスト — **PASS**

- `llm-session.test.mjs` L188-232: 文字列 push 無退行（`calls.userTexts[0]` が文字列のまま）／content 配列
  push（`deepEqual(calls.userTexts[0], blocks)`）／空文字列・空配列・`42`・`null`・`undefined` の 5 パターン
  すべて `TypeError` で reject（`assert.rejects`）を固定。
- `cockpit.test.mjs` L234-296: URL 未設定→`ensureFireResources` を呼ばず `/Channel URL is not set/` で
  reject（`ensureCalled===false` を明示）／文字列透過／content 配列透過（`Array.isArray`+`deepEqual`）を固定。

---

## 総合所見

視覚発火の成功・全失敗分岐・busy・耳未起動・usage 計器・fake 徹底・ask 拡張のいずれも観測可能な挙動
（`session.ask` 呼び出しの有無・引数形・会話ログの中身・診断の kind・状態遷移）で固定されており、
「盲目のまま撃たない」「会話ログに画像を積まない」という設計意図がテストで裏付けられている。
通常 Fire の既存テスト（18 本・完全不変）を含む無退行も diff で実証済み。

## 10. non-blocking（判定を下げない・申し送り）

1. **domain-b.md §1 の「既存 N 本は無変更」の N が実測と食い違う**: 実際の着手前本数は
   llm-session 8 本（記載 7 本）／fire-orchestrator 18 本（記載 21 本）／cockpit 11 本（記載 10 本）。
   増分（+3/+3/+14）・合計（392）・「無変更」という主張自体は本レビューの diff 確認で正しいと実証済みで
   実害はないが、次に domain-b.md を触る機会があれば実測値へ訂正することを推奨。

---

## 11. 検証で走らせたコマンド（全て自分で実行・生値）

| コマンド | 結果 |
|---|---|
| `node --test`（apps/soul/agent、timeout 300s） | tests 392 / pass 392 / fail 0 / duration 1447ms |
| `node --test src/mind/fire-orchestrator.test.mjs`（単体） | tests 32 / pass 32 / fail 0 |
| `git show HEAD:.../llm-session.test.mjs \| grep -c '^test('` | 8 |
| `git show HEAD:.../cockpit.test.mjs \| grep -c '^test('` | 11 |
| `git show HEAD:.../fire-orchestrator.test.mjs \| grep -c '^test('` | 18 |
| `git diff HEAD --` 各 test ファイル | addition-only（3 ファイルとも既存部分の変更・削除ゼロ） |
| `git diff --stat -- apps/runtime-player packages` | 差分ゼロ |
| `git diff --stat -- pnpm-lock.yaml apps/soul/agent/package.json` | 差分ゼロ |
| grep `../eyes/` import / `fs`/`writeFile` in fire-orchestrator.test.mjs | いずれもゼロ件 |
