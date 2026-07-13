# S5 Domain C レビュー（test レーン）: 操縦席結線の fake 徹底・網羅性・実行検証

> Reviewer: Review-Sylph（Orch-Sylph 委任・test レーン）。読み取り専任。
> 対象: `apps/soul/agent/src/cockpit/cockpit-server.test.mjs`（+11）・
> `apps/soul/agent/src/cockpit/cockpit-settings-store.test.mjs`（+4）・
> `apps/soul/agent/scripts/cockpit.test.mjs`（+4）。
> 契約の正: [s5-wave-plan.md](../../orchestration/s5-wave-plan.md) §3 Domain C・§4 blocking 基準。
> 実装 Claim: [domain-c.md](../../waves/s5/domain-c.md) §8 機械ゲート生数字。
> 判定: **PASS（要修正なし）**。

## 総合判定

**PASS**。blocking 項目に抵触なし。non-blocking の申し送り 1 件（下記 §5）。

## 自分で実行した node --test 生数字（tail 全体・1 回目で成功・再試行不要）

```
1..411
# tests 411
# suites 0
# pass 411
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 1351.9231
```

`cd apps/soul/agent && node --test`（タイムアウト 300s 付き）。Claim（domain-c.md §8: tests 411 / pass 411 /
fail 0）と完全一致。skipped/todo 0 のため緑の偽装なし。duration_ms が約 1.35s と短く、実 PowerShell・実
SDK 消費が紛れ込んでいないことも実行時間の面から裏付けられる（実 SDK 消費が起きれば秒〜数秒単位で跳ねる）。

## 内訳照合

Claim: ベースライン 392（Domain B 完了時点）→ 411（+19）。内訳 `cockpit-settings-store.test.mjs` +4 /
`cockpit-server.test.mjs` +11 / `cockpit.test.mjs` +4。

各ファイルを自分で Read し `test(...)` 呼び出しを数えて確認:

- `cockpit-server.test.mjs`: §「視覚発火の口（S5「目が開く」・Domain C 前半）」セクション（L930-1146）に
  ちょうど 11 本（`GET /api/windows` 成功/失敗/未注入 3 本・`POST /api/vision-target` 未注入 503/橋渡し 2
  本・`POST /api/vision-fire` 未注入 503/受理/no-target 3 本・SSE `visionCaptured`/`usage`/`diagnostic kind`
  3 本）。**+11 と一致**。
- `cockpit-settings-store.test.mjs`: §「視覚発火の対象ウインドウ設定の永続化（S5「目が開く」）」セクション
  （L143-213）に 4 本（roundtrip・3 者同居・壊れ JSON→null・unwritable path→握る）。**+4 と一致**。
- `cockpit.test.mjs`: §「createVisionTargetHooks」セクション（L295-342）に 4 本（getVisionTarget 透過・
  onSetVisionTarget 橋渡し+クリア・visionTargetStatus 形状・settings throw を握る）。**+4 と一致**。
  同ファイルには `createSessionProxy` 用の 3 本（L232-293）も見えるが、これは Domain B 由来でベースライン
  392 に既に含まれており、今回の +4 とは別勘定（git diff にまとめて出るのは working tree が Domain B/C
  両方の未コミット差分を含むため。数字の整合に矛盾なし）。

skipped/todo が全ファイルで 0 であることは上記生数字で確認済み。緑の偽装（意図的な skip 等）は無い。

## 検証観点ごとの根拠

### 1. 新エンドポイントの fake 固定

- `GET /api/windows`: `listWindowsImpl` を fake 注入した成功系（cockpit-server.test.mjs L936-955）・
  失敗系（L957-970）・未注入時の型確認のみで実行しない系（L972-977）の 3 本。実装側
  `cockpit-server.mjs` L669-679 の `await listWindowsImpl()` 呼び出しと整合。
- `POST /api/vision-target`: 未注入 503（L979-992）・trim/クリア/state 反映（L994-1023）。実装
  L680-695 と整合（`onSetVisionTarget` 未注入は 503・title を trim・空はクリア=null・
  `broadcastState()`→`snapshot()` で `visionTarget` を返す）。
- `POST /api/vision-fire`: 未注入 503（L1025-1035）・`fire({vision:true})` 呼び出しの固定（L1037-1054）・
  no-target 系（L1056-1071）。実装 L696-708 の `fireOrchestrator.fire({ vision: true })` と整合。
  `makeFakeOrchestrator`（L565-593）が `fire(fireOptions)` の引数を `record.lastFireOptions` に記録する
  よう拡張されており、テストは `assert.deepEqual(fake.record.lastFireOptions, { vision: true })`
  （L1049, L1067）で **通常 `/api/fire`（引数なし）ではなく確実に `{vision:true}` で呼ばれたこと**を
  固定している。この検証観点は Orch-Sylph の委任プロンプトが明示的に要求していた点であり、実際に
  固定されていることを確認した。

### 2. SSE 3 種のテスト

- `visionCaptured`（L1073-1102）: `jpegBase64` を含む全フィールド（title/width/height/jpegBase64/
  elapsedMs）がフレームにそのまま届くことを assert。実装 L811 `onVisionCaptured: (info) =>
  broadcast("visionCaptured", info)` と整合。
- `usage`（L1104-1124）: `{usage, vision}` が届くことを固定。実装 L813 `onUsage: (info) =>
  broadcast("usage", info)` と整合。
- `diagnostic` の `kind`（L1126-1146）: `fireVisionError` の `kind` フィールドがイベントに載ることを固定。
  実装 `handleDiagnostic`（L444-453）で `kind: d?.kind ?? null` が既存 diagnostic ペイロードに追加されて
  おり、既存診断型は `kind:null` になるだけで契約破壊がないことも実装コードから確認した。

### 3. settings-store visionTarget テスト

- set→get roundtrip（別インスタンス間で永続化確認・L145-161）。
- device/channel/visionTarget の 3 者同居（read-modify-write で他を消さない・L163-184）: 3 つを順に
  set し、都度別インスタンスで 3 者とも保持されていることを assert。実装 `writeMerged`（
  cockpit-settings-store.mjs L66-74）が `{ ...readAll(), ...patch }` で既存内容をマージしてから書く
  ことと整合。
- 壊れ JSON → null（L186-200）。
- 書き込み失敗を握る（親をファイルにして mkdir/writeFile を必ず失敗させ、`setVisionTarget` が
  throw しないこと・get も null のままなことを確認・L202-213）。実装 `writeMerged` の try/catch
  （L67-73、失敗を握って続行）と整合。

### 4. createVisionTargetHooks テスト

- `getVisionTarget` 透過（cockpit.test.mjs L308-312）。
- `onSetVisionTarget` 橋渡し+クリア（L314-323、`null` を渡すとクリアされることも確認）。
- `visionTargetStatus` の形状 `{title}`（L325-331）。
- `settings.setVisionTarget` が throw しても握って続行（L333-342）。実装
  `createVisionTargetHooks`（cockpit.mjs L222-237）の `onSetVisionTarget` に try/catch があり
  （L228-232）、テストが検証する防御的挙動と実装が一致することをソースで確認した。

### 5. fake 徹底 + 実 SDK/実 PowerShell 非依存（§4 #2・blocking）

- `cockpit-server.test.mjs` の視覚発火関連 11 本は全て `listWindowsImpl` または
  `fireOrchestratorFactory`（`makeFakeOrchestrator`）を明示的に注入しており、実 PowerShell・実 SDK を
  起動する既定実装（`defaultListWindows` = Domain A `listWindows`・実 `createFireOrchestrator` 経由の
  実 LLM セッション）を一度も呼んでいない。唯一「未注入時は既定実装が使われる」テスト（L972-977）は
  `createCockpitServer({})` を構築するだけで HTTP リクエストを送らないため、既定 `listWindowsImpl`
  （実 PowerShell 起動）は実際には呼び出されない（構築時に throw しないことの型確認のみ、とコメントで
  明記・実装と整合）。
- `observe-vision.mjs`（実 SDK 観測スクリプト、C-verify 後半が新規作成）はファイル名が `.test.mjs` では
  ないため node --test の自動収集対象外であることをファイル一覧で確認した
  （`apps/soul/agent/scripts/` に `observe-vision.mjs` は存在するが `observe-vision.test.mjs` は存在
  しない）。また `observe-vision.mjs` をどのテストファイルからも import していないことを grep で確認
  （唯一のヒットはファイル自身）。実行した node --test の duration_ms が 1351.9ms と短いことも、実
  SDK/実 PowerShell 消費が紛れ込んでいないことの状況証拠になる。
- テストがディスクに画像を書かないこと: `visionCaptured` 関連テストは `jpegBase64: "AAAA"` という
  ダミー文字列を使うのみで、`cockpit-server.test.mjs` は `node:fs` を import していない（冒頭 import
  は `http`/`events`/`stream` のみ）。`cockpit-settings-store.test.mjs` は `fs` 系関数
  （`mkdtempSync`/`writeFileSync`/`rmSync`）を使うが、これは OS temp 上の **設定ファイル**（JSON）用
  であり画像ではない。テストコードに画像相当のバイナリをディスクへ書く経路は無い。

### 6. 既存 392 本の無退行（§4 #1・blocking）

`git diff -- apps/soul/agent/src/cockpit/cockpit-server.test.mjs
apps/soul/agent/src/cockpit/cockpit-settings-store.test.mjs apps/soul/agent/scripts/cockpit.test.mjs` を
自分で実行して確認した:

- `cockpit.test.mjs`: 変更は import 行 1 行（`createSessionProxy, createVisionTargetHooks` を追加）と
  末尾への新規 `test(...)` 追記のみ。既存 `test(...)` ブロックの内部は 1 行も変更されていない。
- `cockpit-server.test.mjs`: `makeFakeOrchestrator` の `record` オブジェクトへ `lastFireOptions:
  undefined` を追加し、`fire()` を `fire(fireOptions)` に変更して `record.lastFireOptions =
  fireOptions` を記録する 1 行を足しただけ（コメントで「既存呼び出し（fire()）は undefined のまま
  記録されるだけで、この記録追加自体は既存テストの挙動に影響しない」と明記されており、実装（引数を
  1 個追加しただけで既存の `record.fireCount += 1` 等の挙動は不変）と整合）。それ以外は末尾セクション
  への新規追記のみ。既存 `test(...)` の assertion 本体は 1 行も変更されていない。
- `cockpit-settings-store.test.mjs`: 末尾への新規セクション追記のみ。既存 8 本は無変更。

→ 既存 392 本のテスト本体（assertion）は 1 行も変更・削除・緩められておらず、無退行。

## 5. non-blocking 申し送り

1. **サムネがディスクに書かれないことの直接証跡は「構造的な担保」に留まる**（domain-c.md §7 質問 3 の
   自己申告どおり）。cockpit-server.test.mjs の SSE テストは `jpegBase64` の値がフレームにそのまま
   届くことは固定しているが、ブラウザ側（`cockpit.html`）が実際に `localStorage`/ダウンロード等へ
   保存しないことを machine test で直接検証してはいない。これは test レーンの構造的な限界（ブラウザ
   実行環境が無い）であり、domain-c.md §9-4（C-verify 後半）で実 SDK 確認時に「画像はディスクへ一切
   書いていない」ことを目視確認済みと記録されている。test レーン単独としては blocking にしない
   （spec/design レーンの判断領域）。

## 質問

なし（実装・テストとも contract・claim と整合しており、判断に迷う点はなかった）。

## 成果物パス

`discussion/ai-cohost/implementation/reviews/s5/domain-c-review-test.md`（本ファイル）。
