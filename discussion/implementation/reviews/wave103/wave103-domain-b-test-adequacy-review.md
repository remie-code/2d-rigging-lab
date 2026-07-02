# Wave103 Domain B (Software Rasterizer Foundation) — Test Adequacy Review

- レーン: Test Adequacy Review
- レビュアー: Review-Sylph (opus)
- 呼び出し元: Orch-Sylph (Wave103 Domain B)
- 対象: `packages/render-software/`（6 テストファイル / 33 テスト）
- Source of truth: `discussion/implementation/orchestration/wave103-plan.md` §3.2 / §7 / §9 / §12
- 日付: 2026-07-02

## 判定

**pass**

§7 Domain B「Required tests」の 5 項目すべてが存在し、いずれも実質的（固定期待値との比較・意味論のピクセルレベル検証・複数回不変の明示アサート）である。決定論は 2 回実行および専用テストで実地確認済み。描画経路に非決定要素（`Date.now` / `Math.random`）の混入なし。欠落は blocking レベルにない minor findings のみ。

## Required tests 判定表

| # | 要求（§7） | 存在 | 実質 | 証拠パス:行 |
|---|---|---|---|---|
| 1a | 単色三角形 golden（固定期待バイト、複数回不変） | Yes | Yes | `software-renderer.test.ts:39-86`（固定 `expected` Uint8Array と `toEqual`。top-left rule のカバレッジをハードコード） |
| 1b | テクスチャ付き四角形 golden | Yes | Yes | `software-renderer.test.ts:88-110`（NEAREST 4 色を固定ピクセルで検証） |
| 1c | 不透明度 golden（数値レベル） | Yes | Yes | `software-renderer.test.ts:112-142`（premul `128` / straight `255,a=128` を固定比較。`mask.test.ts:69-114` も半透明マスクで数値検証） |
| 1d | マスク golden（内外） | Yes | Yes | `mask.test.ts:32-67`（左列 red / 右列透明）, `:116-153`（隔離クリップ）, `:155-185`（空マスク集合で target スキップ） |
| 1e | draw order golden（前後関係） | Yes | Yes | `software-renderer.test.ts:144-178`（緑が赤を完全被覆）, `:180-218`（半透明 front over opaque back のブレンド数値） |
| 1f | 複数回実行でバイト完全一致の明示アサート | Yes | Yes | `software-renderer.test.ts:220-262`（3 回 render、premul/straight 一致）, `mask.test.ts:187-217`, `png-encoder.test.ts:107-129`（PNG バイト end-to-end 一致） |
| 2 | ビュー変換の正確性（既知座標→期待ピクセル、順逆対応、境界・ピクセル中心規則） | Yes | Yes | `view-transform.test.ts:18-24`（矩形コーナー→画像端）, `:33-37`（既知点→中心 (2,2)）, `:39-68`（順→逆 / 逆→順 round-trip）, `:70-77`（ピクセル中心規則 0.5,0.5）, `:26-31`（+Y down 向き） |
| 3 | PNG round-trip（幅/高さ/ピクセル一致、純 TS デコーダ・外部依存なし） | Yes | Yes | `png-encoder.test.ts:16-28`（signature/IHDR/IEND, decode 一致）, `:44-69`（rendered scene → PNG → straight 一致）, `:71-105`（premul 合成の un-premultiply 保存）。デコーダは `test-support/png-decoder.ts`（純 TS + `node:zlib inflateSync` のみ、外部依存なし） |
| 4 | エッジケース（空シーン / 退化三角形 / viewport 外）が決定論的 | Yes | Yes | `software-renderer.test.ts:264-268`（空シーン全透明）, `:270-302`（面積 0 三角形スキップ）, `:304-328`（viewport 外クリップ）, `:330-364`（invisible / opacity0 / missing texture スキップ）。`view-transform.test.ts:79-94`（退化 view spec 正規化で invertible 維持） |
| 5 | 参考性能計測（fail させない構造、報告可能な出力） | Yes | Yes | `performance-reference.test.ts:71-109`（512x512 / 8 drawable、`console.log` で ms と PNG bytes 出力。壁時計アサートなし、`png.length>0` と寸法のみ検証） |

## 追加境界カバレッジの評価（§7 エッジケース補足）

| 境界 | カバー | 証拠 |
|---|---|---|
| 頂点数 0 | Yes（間接） | `drawable-rasterizer.ts:41` の `vertexCount === 0` 早期 return。空シーンテストで到達経路は担保 |
| triangles 範囲外 index | ソース防御あり / **専用テストなし** | `drawable-rasterizer.ts:62-71` で範囲外 index を skip。明示テストは無い（minor finding B-1） |
| opacity 0 / visible false スキップ | Yes | `software-renderer.test.ts:330-364` |
| missing texture スキップ | Yes | 同上（`does-not-exist`） |
| mask 集合が空のとき target スキップ | Yes | `mask.test.ts:155-185`（invisible mask → 集合空 → target 全スキップ） |
| alphaMode "straight" | Yes | `texture-sampler.test.ts:7-24`, fixtures 既定 `straight` |
| alphaMode "premultiplied" | Yes | `texture-sampler.test.ts:26-40`（as-is 使用を検証） |
| CLAMP_TO_EDGE（範囲外 UV） | Yes | `texture-sampler.test.ts:51-58`（uv>=1 / uv<0 / uv==1.0 の境界） |

## 実行ログ要点（render-software に限定）

- Run 1: `6 passed (6) / 33 passed (33)`。perf ログ `512x512, 8 drawables x 512 tris: 72.77 ms, png 3464 bytes`
- Run 2: `6 passed (6) / 33 passed (33)`。perf ログ `... 71.89 ms, png 3464 bytes`
- 2 回とも全通過、flakiness なし。PNG bytes（3464）が両実行で一致 = end-to-end 決定論の実地確認。
- 実行コマンド: `npx vitest run packages/render-software`（Domain A の並行変更 ai-interface 系は判定対象外、本実行にも含まれない）。

## 決定論・非依存の確認（コードから）

- `Date.now` / `Math.random` / `new Date`: 描画経路・golden 期待値生成に**混入なし**（grep 済み、`packages/render-software/src`）。
- `performance.now` の使用は `performance-reference.test.ts:99,101` の性能計測のみ（§7 が許可する時刻使用）。描画結果には影響しない。
- PNG 決定論: `png/png-encoder.ts:12-16` で deflate level/strategy/memLevel を固定、filter type 0 (None) 固定（`:57`）。圧縮設定が pin されており実装レベルで決定論が担保。
- マスク意味論: `raster/mask.ts` は WebGL2 mask pass（専用 target を back-to-front 合成、maskAlpha = 同一 index の alpha）を忠実に再現。mask drawable の main buffer 二重寄与（Undine 承認済み設計）を `mask.test.ts:69-114` が数値レベルで検証。

## Findings

| ID | severity | 内容 |
|---|---|---|
| B-1 | minor（non-blocking） | `triangles` の**範囲外 index** をスキップする防御（`drawable-rasterizer.ts:62-71`）に対する専用テストが無い。頂点数 0 / 面積 0 / 範囲内は明示テストがあるが、範囲外 index は間接カバーのみ。WebGL2 忠実性（`createWebGl2MeshUpload` の valid-triangle 規則）の回帰検出のため、範囲外 index を含む mesh が決定論的にスキップされることの明示テスト追加が望ましい。§7 の明示要求項目ではなくソース防御が存在するため blocking にはしない。 |
| B-2 | info | golden の「バイト一致」は PNG ファイルバイト列そのものではなく、`premultipliedRgba8` / `straightRgba8` バッファのバイト列に対する固定期待値比較で担保されている。PNG バイト列自体の不変は `png-encoder.test.ts:30-38`（同一入力 → byte-identical）と `:107-129`（scene → PNG end-to-end byte-identical）でカバー済み。意味論 golden をバッファ層、PNG 決定論をエンコーダ層で分離検証する構成であり、§7「バイト一致・複数回不変」は満たされている。指摘は構成の記録目的のみ。 |
| B-3 | info | golden 期待値は「実行結果のオウム返し」ではなく、テスト内にハードコードされた固定ピクセル値（例 `software-renderer.test.ts:79-84` の `expected`、`:104-109`, `:129-141`）およびコメントで導出過程が明記された数値（`mask.test.ts:76-83`, `software-renderer.test.ts:182-186`）と比較している。自己整合テストではない。 |

## 質問

なし。§3.2 / §7 / §9 の範囲で判定に必要な情報はすべてコード・実行から確認できた。B-1 のテスト追加を Domain B のフォローに含めるか否かは Orch-Sylph / Undine の裁量（blocking ではないため本レビューは pass を維持）。
