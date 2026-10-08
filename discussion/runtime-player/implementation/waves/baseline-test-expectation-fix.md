# baseline-test-expectation-fix

runtime-player 既知 baseline テスト2件の期待値陳腐化修正。dynamics-tuning のレスポンス形拡張（コミット 4627bbd 由来）で runtime-export レスポンスに `effectiveDynamicsTuning` フィールドが追加されたが、テスト側の `toStrictEqual` 期待オブジェクトが未更新だったため shape 不一致で失敗していた。**実挙動の退行ではなく期待値の陳腐化**であることを実測で確認済み。実装コードは一切変更していない（テスト期待オブジェクトのみ）。

## 1. 変更したファイルと各期待サイト

### `apps/runtime-player/src/main/broadcast-source/browser-source-server.test.ts`（2 挿入）

| サイト | テスト | 分岐 | 追加キーと値 | 挿入位置 |
| --- | --- | --- | --- | --- |
| 元 150 行（emptyResponse） | "serves current Runtime Export payload..." | not-loaded | `effectiveDynamicsTuning: null` | `activeVariantSelection: createDisabledActiveVariantSelection(),` の直後 |
| 元 176 行（loadedResponse） | 同上 | loaded | `effectiveDynamicsTuning: null` | `activeVariantSelection: createDisabledActiveVariantSelection(),` の直後 |

- loaded 分岐の期待は元々 150 行の throw により未到達だったため、150 行修正後の再実行で received 側を実測し、値が `null`（fixture は dynamics tuning を publish しないため）であることを確定した。

### `apps/runtime-player/src/stage/browser-source/browser-source-server-message.test.ts`（1 挿入 / 既存行に `,` 追加）

| サイト | テスト | 分岐 | 追加キーと値 | 挿入位置 |
| --- | --- | --- | --- | --- |
| 元 216 行付近（期待オブジェクト末尾） | "accepts the not-loaded response shape" | not-loaded | `effectiveDynamicsTuning: null` | 末尾 `activeVariantSelection: createDisabledActiveVariantSelection()` の直後（当該行に末尾 `,` を付与） |

- 入力オブジェクト側は `effectiveDynamicsTuning` を渡していないが、権威実装 `readBrowserSourceRuntimeExportResponse`（`browser-source-server-message.ts` 58-60, 84 行）が未指定入力に対し `readEffectiveDynamicsTuning(undefined)` → `null` を必ず emit するため、期待側にのみ `null` を追加した（入力側は変更不要）。

### 値・位置の根拠（参照のみ・変更禁止）
- `browser-source-runtime-export-payload.ts` の `createBrowserSourceRuntimeExportResponse`（66-95 行）は loaded / not-loaded 両分岐で必ず `effectiveDynamicsTuning` を含む。
- 3 サイトとも実失敗 diff の received 側は `effectiveDynamicsTuning: null` を `activeVariantSelection` の直後に表示。キー順は toStrictEqual では非依存だが、received diff の並びに合わせて `activeVariantSelection` 直後に配置した。

## 2. 検証コマンドの実出力要約

対象2ファイル（`apps/runtime-player` で実行）:
```
pnpm exec vitest run src/main/broadcast-source/browser-source-server.test.ts src/stage/browser-source/browser-source-server-message.test.ts
```
- 修正前: Test Files 2 failed (2) / Tests 2 failed | 20 passed (22)
  - server.test.ts:150（not-loaded emptyResponse）で `effectiveDynamicsTuning: null` 不足
  - message.test.ts:216（not-loaded response）で同上
- 150 修正後の中間再実行: server.test.ts が loaded 分岐（元 177 行）で新たに失敗 → received 実測値 `effectiveDynamicsTuning: null` を確定
- 最終: **Test Files 2 passed (2) / Tests 22 passed (22)**

全体ユニット（`apps/runtime-player` で `pnpm run test:unit`、cross-env はスクリプト経由で解決）:
- **Test Files 140 passed (140) / Tests 925 passed (925)**、Duration 9.64s
- 失敗・スキップ・既知別債務なし

## 3. git 実出力

`git status --porcelain`:
```
 M apps/runtime-player/src/main/broadcast-source/browser-source-server.test.ts
 M apps/runtime-player/src/stage/browser-source/browser-source-server-message.test.ts
```

`git diff --stat`（CRLF 変換 warning は環境由来・内容非該当）:
```
 .../src/main/broadcast-source/browser-source-server.test.ts        | 2 ++
 .../src/stage/browser-source/browser-source-server-message.test.ts | 3 ++-
 2 files changed, 4 insertions(+), 1 deletion(-)
```
- 実装ソース・contract・golden・lockfile 等の混入なし。許可 scope の2テストファイルのみ。

## 4. 判定

**done**

- 対象2ファイル緑（22/22）、全体 test:unit 緑（925/925）、変更は許可2ファイルのみ。
- 期待更新のみで解消（実装バグの疑いなし・実装コード不変）。

## 5. 迷った点・Orch への質問

- 診断で「他の runtime-export 期待サイト（528, 691 近辺を確認せよ）」の指示があったが、当該サイトは実際には runtime-export レスポンスの `toStrictEqual` ではなかった:
  - server.test.ts 528 行付近（"broadcasts..." の `runtime-export-changed`）と 700 行付近（`runtime-export-resync`）は `toMatchObject` であり、余剰フィールドを許容するため修正不要（実測でも pass 済み）。
  - server.test.ts 691 行付近の `toStrictEqual` は `browser-source-server-hello` メッセージであり `effectiveDynamicsTuning` を持たないため対象外。
  - よって `toStrictEqual` で当該フィールドを要したのは診断どおり server.test.ts の 2 サイト（not-loaded / loaded）と message.test.ts の 1 サイトの計 3 サイトのみ。質問・ブロッカーなし。
