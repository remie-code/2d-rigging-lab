# Wave108 Domain A Report (revise): 生成側 UV 非クランプ + 覆いマージン幅を層サイズ関数へ（`wave108-gen-uv-unclamp` / D-gen, Option E）

- Domain id: `wave108-gen-uv-unclamp`
- 実装担当: Gnome（Orch-Sylph からのサブエージェント委任）
- 版: **revise**（前回 pass の「K=4 固定・r 束縛」→ ユーザー決定 Option E「サイズ別パディング」へ組み直し）
- 判定: **緑**（`vitest run packages/authoring-core/src` 全 299 green / `typecheck` エラー無し）
- 設計オラクル: `discussion/design/mesh-rendering/boundary-transparent-margin-design.md` §5(:78-83)/§9(:134)、`discussion/implementation/orchestration/wave108-plan.md` §3.1(:35-41)/§5(:65-89)/§13(:219-220)

## 1. 作成 / 変更ファイル一覧（絶対パス）

変更（実装）:
- `C:\workspace\remie\code\ai-native-live2d-editor\packages\authoring-core\src\mesh-generation-coverage-margin.ts`（K 定数 → `maxCoverageMarginSourcePixels(longEdgePixels)` 関数へ一般化。blur named constant 追加。v7 定数を再利用）
- `C:\workspace\remie\code\ai-native-live2d-editor\packages\authoring-core\src\mesh-generation-v7-parameters.ts`（r 束縛 revert。`V7_MARGIN_RADIUS_MAX_PIXELS_BOUND_TO_K` と K import を除去、clamp 上限を自然値 `V7_MARGIN_RADIUS_MAX_PIXELS(16)` へ）
- `C:\workspace\remie\code\ai-native-live2d-editor\packages\authoring-core\src\mesh-generation-v6d-adaptive-contour-constrainautor.ts`（mask expansion=2 / virtual padding=4 の自然値へ revert。K import と `Math.min/Math.max` 束縛を除去）

変更（テスト）:
- `C:\workspace\remie\code\ai-native-live2d-editor\packages\authoring-core\src\mesh-generation-v7-margin-contour.test.ts`（旧「r≤K 実質4固定」テストを「r 自然値（長辺比例 4..16、長辺1000→12>4）」へ書換え。import 整合）
- `C:\workspace\remie\code\ai-native-live2d-editor\packages\authoring-core\src\mesh-generation-v6d-adaptive-coverage-margin.test.ts`（旧「r≤K 束縛」テストを「自然値 2 / 4」へ書換え）
- `C:\workspace\remie\code\ai-native-live2d-editor\packages\authoring-core\src\mesh-generation.test.ts`（UV overshoot 予算を `COVERAGE_MARGIN_MAX_SOURCE_PIXELS+1`（定数）→ `maxCoverageMarginSourcePixels(max(w,h))+1`（サイズ関数）へ。2 箇所 + import）

作成（テスト）:
- `C:\workspace\remie\code\ai-native-live2d-editor\packages\authoring-core\src\mesh-generation-coverage-margin.test.ts`（`maxCoverageMarginSourcePixels` の単体テスト）

不変（前回実装のまま維持）:
- `mesh-generation-v6-contour-pipeline.ts` 共有 `mapV6ContourPointToUv` の clamp 廃止（非クランプ）
- `mesh-generation-v7-margin-contour.ts` `mapPixelPointToUv` の clamp 廃止（非クランプ）
- `mesh-generation-v6-contour-pipeline.test.ts`（共有ヘルパ非クランプ検証。触れず）
- `index.ts` の `export * from "./mesh-generation-coverage-margin.js";`（`export *` なので関数へ自動追随、変更不要）

## 2. r 束縛の revert 内容

**v7**（`mesh-generation-v7-parameters.ts` `deriveV7Parameters`）:
- clamp 上限を前回の `V7_MARGIN_RADIUS_MAX_PIXELS_BOUND_TO_K(=min(16,K)=4)` から自然値 `V7_MARGIN_RADIUS_MAX_PIXELS(16)` へ戻した。
- r = `clamp(V7_MARGIN_RADIUS_TEXTURE_FRACTION(0.012)×長辺, V7_MARGIN_RADIUS_MIN_PIXELS(4), V7_MARGIN_RADIUS_MAX_PIXELS(16))` の長辺比例（4..16px）に復帰。
- 追加していた `V7_MARGIN_RADIUS_MAX_PIXELS_BOUND_TO_K` 定数と、そのための coverage-margin からの K import を除去（v7 内で他に未使用を確認）。

**v6d**（`mesh-generation-v6d-adaptive-contour-constrainautor.ts`）:
- `ADAPTIVE_CONTOUR_MASK_EXPANSION_PIXELS` を `Math.min(TARGET=2, K)` から自然値 `2` へ。
- `ADAPTIVE_CONTOUR_VIRTUAL_PADDING_PIXELS` を `Math.max(buffer=4, expansion)` から自然値 `4` へ。
- 前回の `ADAPTIVE_CONTOUR_TARGET_MASK_EXPANSION_PIXELS` / `ADAPTIVE_CONTOUR_VIRTUAL_PADDING_BUFFER_PIXELS` 中間定数と K import を除去。両 export は test が参照するため維持（値のみ自然値へ）。wrapper `paddingPixels = ADAPTIVE_CONTOUR_VIRTUAL_PADDING_PIXELS`（:1004 付近）はそのまま整合。

生成側は r を一切束縛しない。**UV 非クランプ（前回実装）は維持**（v6 共有 / v7 とも clamp 廃止のまま）。stage 写像も従来どおり不変。

## 3. `maxCoverageMarginSourcePixels` の設計

- 正準定義位置: `packages/authoring-core/src/mesh-generation-coverage-margin.ts`、関数名 `maxCoverageMarginSourcePixels`。
- 公開経路: 同ファイルで `export const`、`packages/authoring-core/src/index.ts:31` の `export * from "./mesh-generation-coverage-margin.js";` により package から re-export（texprep が import 可能）。
- シグネチャ: `maxCoverageMarginSourcePixels(longEdgePixels: number): number`
- 式:
  ```ts
  Math.ceil(
    clamp(
      V7_MARGIN_RADIUS_TEXTURE_FRACTION * longEdgePixels,  // 0.012
      V7_MARGIN_RADIUS_MIN_PIXELS,                          // 4
      V7_MARGIN_RADIUS_MAX_PIXELS                           // 16
    ) + COVERAGE_MARGIN_SOFT_ALPHA_MASK_BLUR_PIXELS         // 1
  )
  ```
- blur named constant: `COVERAGE_MARGIN_SOFT_ALPHA_MASK_BLUR_PIXELS = 1`。softAlphaMask 由来（`alpha-mask.ts` の 3×3 weighted blur `blurAlphaAt` kernel radius 1 + `closeSinglePixelCracks` 3×3 radius 1 が背景画素を 1 歩外へにじませ得る上界 ≈1px）を doc コメントに明記。マジックナンバー禁止に準拠。
- **v7 定数の再利用（DRY）を採用**。`mesh-generation-coverage-margin.ts` が `mesh-generation-v7-parameters.ts` から `V7_MARGIN_RADIUS_TEXTURE_FRACTION` / `V7_MARGIN_RADIUS_MIN_PIXELS` / `V7_MARGIN_RADIUS_MAX_PIXELS` を import し、上界式を v7 の r 式と単一真実源で一致させた。将来 v7 の r を調整すればパディング上界が自動追随し、上界が v7 に対して静かに不足することが構造上起きない。
- **依存方向・循環依存の確認**: revert により `mesh-generation-v7-parameters.ts` は coverage-margin を import しなくなった。よって新設の `coverage-margin → v7-parameters` は一方向で循環しない。v7-parameters の他 import（`mesh-geometry/geometry-primitives.js` の `clamp`、`mesh-generation-contract.js` の型）も coverage-margin を import しないことを grep で確認済み。v6d も coverage-margin を import しなくなった（束縛除去）。したがって循環依存は無く、DRY 構造を採れた。
- 単位・契約は doc コメントに明記: 単位は**ソース・テクスチャ画素**（atlas 出力画素は別座標系で placement スケール換算が要る旨も記載）。全稼働方式で `r ≤ maxCoverageMarginSourcePixels(size)` が成り立つ上界契約であること、v7 の r 式が上界で v6d の外向き ≈2..3px は常に内側（floor `ceil(4+1)=5 > 3`）であることを根拠付きで記載。飽和点は clamp 端点+blur（小さい層 `ceil(4+1)=5`、大きい層 `ceil(16+1)=17`）である旨も注記。

## 4. 不変条件の言明

- **UV 非クランプ維持**: v6 共有 `mapV6ContourPointToUv`・v7 `mapPixelPointToUv` の clamp 廃止はそのまま。境界頂点 UV は stage と同一 `pixel/size` 基準で [0,1] 外を素直に取る。
- **mesh 作り替え無し**: layer-local UV は純粋な幾何のまま。padded 座標へ mesh を作り替える処理は追加していない（本ドメインは authoring-core 生成側のみ）。stage 頂点写像も不変。
- 透明パディングを焼く処理自体は D-texprep の担当。本ドメインは上界を層サイズの関数として公開するのみ。

## 5. 旧定数の参照解消

`grep` で `COVERAGE_MARGIN_MAX_SOURCE_PIXELS` / `V7_MARGIN_RADIUS_MAX_PIXELS_BOUND_TO_K` / 前回の中間定数（`ADAPTIVE_CONTOUR_TARGET_MASK_EXPANSION_PIXELS`, `ADAPTIVE_CONTOUR_VIRTUAL_PADDING_BUFFER_PIXELS`）の `packages` 配下参照が **0 件**であることを確認。旧定数名 `COVERAGE_MARGIN_MAX_SOURCE_PIXELS` は削除済み。

## 6. テスト結果

`pnpm.cmd exec vitest run packages/authoring-core/src`:
- Test Files: **38 passed (38)** / Tests: **299 passed (299)** / Duration 6.43s

`pnpm.cmd typecheck`（`tsc --noEmit`）: **エラー無し**（clean）。

更新/追加した主なテスト:
- `mesh-generation-coverage-margin.test.ts`（新規, 5 tests）: 小長辺→floor `ceil(4+blur)=5`、大長辺→ceiling `ceil(16+blur)=17` 飽和、中間で長辺比例（1000→13）、参照式 `ceil(clamp(0.012·L,4,16)+blur)` との一致、v6d 外向き ≈3px を常に上回ること。
- `mesh-generation-v7-margin-contour.test.ts`「leaves the margin radius r at its natural long-edge-proportional value」: 長辺100→r=4(floor)、長辺1000→r=12(>4)、長辺4096→r=16(ceiling)、全サイズで 4..16。
- `mesh-generation-v6d-adaptive-coverage-margin.test.ts`（3 tests）: expansion=2 / padding=4 / padding≥expansion。
- `mesh-generation-v7-margin-contour.test.ts` の UV 非クランプ群（overshoot で [0,1] 外、stage と同一基準、matching で退行無し）: 維持され green。
- `mesh-generation.test.ts` の v6d 非クランプ検証・共通ヘルパ UV 予算: サイズ関数へ切替後も green。

## 7. 質問 / escalate 事項

- なし。設計・計画のオラクルに沿って実装完了。Forbidden write scope（texprep/atlas/render/export、非稼働 v6a/b/c）には触れていない（読取りのみ）。並行ドメインの未コミット変更の同居有無は確認していないが、変更は Domain A 帰属ファイルに限定した。
