# baseline-test-expectation-fix レビュー (Review-Sylph)

対象: runtime-player 既知 baseline テスト2件の期待値陳腐化修正 (working tree 未コミット)。
判定要旨: **approve**。実装から独立に導出した仕様と全 `toStrictEqual` 走査の結果、追加された 3 サイトの `effectiveDynamicsTuning: null` はすべて実挙動に一致し、漏れサイトも無い。実装非改変・退行でないことを確認済み。緑実測 22/22。

---

## 1. 独立導出した runtime-export レスポンスの `effectiveDynamicsTuning` 出力仕様

Gnome の説明に依存せず、実装コードから導出した。

### server 側 (`/runtime-export/payload` エンドポイント)
- `browser-source-server.ts` L387-394: `/runtime-export/payload` は常に `createBrowserSourceRuntimeExportResponse({ ..., effectiveDynamicsTuning: this.#session.getEffectiveDynamicsTuning(), ... })` を返す。
- `browser-source-runtime-export-payload.ts` L66-95: `createBrowserSourceRuntimeExportResponse` は **loaded / not-loaded の両分岐で無条件に** `effectiveDynamicsTuning: input.effectiveDynamicsTuning` を出力オブジェクトに含める (L82, L92)。よってこのフィールドはレスポンスに常在する。
- `browser-source-session.ts` L76-77: `#effectiveDynamicsTuning` の初期値は `null`。値が非 null になるのは `publishDynamicsTuningProfile` 相当の publish が起きたときのみ。
- **fixture の publish 有無**: server.test.ts の当該テスト "serves current Runtime Export payload..." は `startTestServer()` と `server.publishRuntimeExportLoaded(createLoadedPayload())` のみを呼び、dynamics tuning profile を一切 publish しない。したがって not-loaded (publish 前) / loaded (runtime-export のみ publish 後) の両時点で `getEffectiveDynamicsTuning()` は初期値 `null` を返す。
- **結論**: server 側は not-loaded・loaded いずれも `effectiveDynamicsTuning: null` を出力する。

### stage 側 (`readBrowserSourceRuntimeExportResponse`)
- `browser-source-server-message.ts` L46-106: 入力の `value.effectiveDynamicsTuning` を `readEffectiveDynamicsTuning` に通す (L58-60)。
- `readEffectiveDynamicsTuning` L369-372: 入力が `null` または `undefined` のとき `null` を返す。
- 妥当性ガード L70-76: 入力の当該フィールドが未指定 (`undefined`) の場合、`readEffectiveDynamicsTuning` が `null` を返しても reject されない (`value.effectiveDynamicsTuning !== undefined` の条件で除外)。
- 返却オブジェクトは not-loaded (L78-87) / loaded (L89-103) の両分岐で無条件に `effectiveDynamicsTuning` を含める。
- **fixture の publish 有無**: message.test.ts の当該テスト "accepts the not-loaded response shape" の入力オブジェクト (L196-215) は `effectiveDynamicsTuning` を渡していない → `readEffectiveDynamicsTuning(undefined)` → `null`。
- **結論**: stage 側 not-loaded は `effectiveDynamicsTuning: null` を出力する。

---

## 2. 各追加サイトの突合結果

| # | ファイル | 行 | テスト/分岐 | 追加値 | 実装の出力 | 判定 |
| --- | --- | --- | --- | --- | --- |
| 1 | browser-source-server.test.ts | 154 | "serves current..." / not-loaded (emptyResponse) | `effectiveDynamicsTuning: null` | `null` (session 初期値) | 一致 |
| 2 | browser-source-server.test.ts | 195 | 同上 / loaded (loadedResponse) | `effectiveDynamicsTuning: null` | `null` (tuning 未 publish) | 一致 |
| 3 | browser-source-server-message.test.ts | 236 | "accepts the not-loaded response shape" | `effectiveDynamicsTuning: null` | `readEffectiveDynamicsTuning(undefined)` → `null` | 一致 |

3 サイトすべて一致。値・分岐・出力常在性ともに実装から独立導出した仕様と整合。

---

## 3. 漏れサイトの有無 (全 `toStrictEqual` 走査結果)

両テストファイルの全 `toStrictEqual` を走査した (grep + 各サイト精読)。

### browser-source-server.test.ts (`toStrictEqual` は 3 箇所)
- L150 not-loaded runtime-export レスポンス → **修正対象・修正済み** (#1)
- L177 loaded runtime-export レスポンス → **修正対象・修正済み** (#2)
- L693 `browser-source-server-hello` メッセージ → runtime-export レスポンスではなく、型に `effectiveDynamicsTuning` を持たない。**対象外 (正当)**

### browser-source-server-message.test.ts (`toStrictEqual` は 3 箇所)
- L35 `live-parameter-frame` メッセージ → runtime-export レスポンスではない。**対象外 (正当)**
- L173 `active-variant-selection-changed` メッセージ → 別メッセージ型で当該フィールドを持たない。**対象外 (正当)**
- L216 not-loaded runtime-export レスポンス → **修正対象・修正済み** (#3)

### 別途確認: runtime-export 系だが `toMatchObject` (余剰許容) のため対象外のサイト
- server.test.ts の `runtime-export-resync`/`runtime-export-changed` 期待 (L702 等) は `toMatchObject`。
- message.test.ts の resync 期待 (L117) は `toMatchObject`。
- これらは余剰キーを許容するため `effectiveDynamicsTuning` 追加は不要 (更新しても不要、しなくても緑)。

**漏れサイトなし。** `readBrowserSourceRuntimeExportResponse` の loaded 分岐を `toStrictEqual` で検証するテストは存在しないため (message.test.ts の該当 describe は not-loaded 1 ケースのみ)、追加すべき第4サイトは無い。Gnome の「3 サイトのみ」の主張は自走査で裏付けた。

---

## 4. 実装非改変・退行でないことの確認結果

### 実装非改変
- `git status --porcelain`: 変更は下記2テストファイルのみ。
  - `apps/runtime-player/src/main/broadcast-source/browser-source-server.test.ts`
  - `apps/runtime-player/src/stage/browser-source/browser-source-server-message.test.ts`
- `git diff --stat`: `2 files changed, 4 insertions(+), 1 deletion(-)`。
- `git diff` 実体: server.test.ts に `effectiveDynamicsTuning: null` を 2 行追加 (not-loaded / loaded)、message.test.ts に既存行へ末尾 `,` を付与し `effectiveDynamicsTuning: null` を 1 行追加。差分は期待オブジェクトへのキー追加のみで、入力・アサーション構造・他フィールドに変更なし。
- 実装ソース・contract (`preload/*-contract.ts`)・golden・lockfile への混入なし。

### 退行でないことの論証
- received 側が仕様上正しい形であることは §1 の独立導出で確立: 実装は当該フィールドを **常に出力する** 設計であり、fixture が tuning profile を publish しない以上 `null` が正しい received。
- したがって本変更は「実挙動の退行の隠蔽」ではなく、`effectiveDynamicsTuning` フィールド追加 (dynamics-tuning レスポンス形拡張) に対して `toStrictEqual` 期待が未追随だった **期待値の陳腐化を修正** したもの。期待を received に合わせて緩めたのではなく、received が仕様通り (常在フィールド=null) であることを実装から確認した上での正当な追随。

---

## 5. 判定

**approve**

- 追加 3 サイトの `effectiveDynamicsTuning: null` はいずれも実装から独立導出した出力仕様に一致。
- 全 `toStrictEqual` 走査で漏れサイトなし。`toMatchObject` / 別メッセージ型は正しく対象外。
- 変更は許可された2テストファイルのみ、実装・contract・golden・lockfile 不変。
- 退行の隠蔽ではなく期待値陳腐化の正当な修正。

指摘・changes-requested なし。

---

## 6. テスト実出力要約

`apps/runtime-player` で実行 (`pnpm exec vitest run` の2ファイル指定):

```
✓ src/stage/browser-source/browser-source-server-message.test.ts (6 tests)
✓ src/main/broadcast-source/browser-source-server.test.ts (16 tests)

Test Files  2 passed (2)
     Tests  22 passed (22)
```

対象2ファイル緑 (22/22)。全体スイートは本レビューでは未実行 (Gnome 報告の 925/925 は自分で再実行していないため数値は転記のみ・独自確認外)。
