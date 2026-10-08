# Wave108 Domain A Review (revise): `wave108-gen-uv-unclamp` — Option E 適合レビュー

- Domain id: `wave108-gen-uv-unclamp`
- レビュー担当: Review-Sylph（Orch-Sylph からのサブエージェント委任）
- 版: **revise レビュー**（前回 pass の「K=4 固定・r 束縛」→ ユーザー決定 Option E「サイズ別パディング」への組み直しを検証）
- レビュー対象 report: `discussion/implementation/waves/wave108/wave108-domain-a-gen-uv-unclamp-report.md`
- 判定オラクル: `discussion/design/mesh-rendering/boundary-transparent-margin-design.md` §5(:78-83)/§9(:134)、`discussion/implementation/orchestration/wave108-plan.md` §3.1/§5/§13-14
- **判定: 合格（pass）**。blocking なし。非 blocking の軽微な doc コメント staleness を 1 件記録（下記 裁量判断②）。

## 設計適合（観点ごと pass/fail と根拠）

### 1. r 束縛の revert 完全性 — pass
- **v7**: `mesh-generation-v7-parameters.ts:163-169` の `deriveV7Parameters` は clamp 上限が自然値 `V7_MARGIN_RADIUS_MAX_PIXELS(16)` に戻り、`r = round(clamp(0.012×長辺, 4, 16))` の長辺比例へ復帰（:29-31 で定数 4/16 定義）。前回追加の `V7_MARGIN_RADIUS_MAX_PIXELS_BOUND_TO_K` は grep で 0 件（除去済み）。coverage-margin からの K import も無し（grep 確認）。
- **最強の裏取り**: `git diff` 上に `mesh-generation-v7-parameters.ts` が**現れない**＝ファイルが HEAD と完全一致。前回 WIP で追加した BOUND_TO_K/K import が net で完全に消え、r 式が元の自然値へ戻ったことを git レベルで確認。
- **v6d**: `mesh-generation-v6d-adaptive-contour-constrainautor.ts:57,61` で `ADAPTIVE_CONTOUR_MASK_EXPANSION_PIXELS = 2` / `ADAPTIVE_CONTOUR_VIRTUAL_PADDING_PIXELS = 4` の自然値。前回の `Math.min(...,K)` / `Math.max(...,expansion)` 束縛、中間定数（`..._TARGET_..._EXPANSION`, `..._BUFFER_...`）、coverage-margin import は grep で 0 件。:162,202 は expansion=2 を、:1005 は padding=4 を直接使用。束縛残渣なし。diff は「定数を export に変更＋根拠コメント追加」のみ（値は HEAD と同じ自然値）。

### 2. UV 非クランプ維持 — pass
- 共有 `mapV6ContourPointToUv`（`mesh-generation-v6-contour-pipeline.ts:259-266`）: `clamp(...,0,1)` を削除し `point.x/textureWidth` を素通し。`clamp` import も削除（diff 確認）。
- v7 `mapPixelPointToUv`（`mesh-generation-v7-margin-contour.ts:277-283`）: 同様に clamp 廃止。`clamp` import 削除。
- stage 写像（`mapV6ContourPointToStagePoint` / `mapPixelPointToStagePoint`）は `bounds.origin + bounds.size×(pixel/size)` のまま不変。UV と stage が同一 `pixel/size` 基準で対称。revert で誤って clamp を戻していないことを diff で確認。

### 3. mesh 作り替えが無いこと — pass
- layer-local UV は純粋幾何（`pixel/size`）のまま。padded 座標系への作り替え・オフセット注入は無い（diff は写像式の clamp 除去のみ、座標系変更なし）。

### 4. `maxCoverageMarginSourcePixels` の正しさ（Option E の核）— pass
- シグネチャ: `maxCoverageMarginSourcePixels(longEdgePixels: number): number`（`mesh-generation-coverage-margin.ts:92`）。
- 式: `Math.ceil(clamp(0.012×longEdge, 4, 16) + blur)`（:92-99）。v7 の r 式を上界に採り blur を足す構造。
- blur は named constant `COVERAGE_MARGIN_SOFT_ALPHA_MASK_BLUR_PIXELS = 1`（:73）。softAlphaMask 由来（`blurAlphaAt` 3×3 radius1 + `closeSinglePixelCracks` 3×3 radius1 で背景画素が 1 歩外へにじむ上界 ≈1px）を doc コメントで根拠付け。マジックナンバー禁止に準拠。
- **単一真実源**: v7 定数（`V7_MARGIN_RADIUS_TEXTURE_FRACTION`/`MIN`/`MAX`）を `mesh-generation-v7-parameters.ts` から import して再利用（:1-6, 95-97）。上界式が v7 の r 式と構造上一致し、v7 の r を将来調整すればパディング上界が自動追随。
- **循環依存なし**: `coverage-margin → v7-parameters` の一方向。v7-parameters は coverage-margin を import しない（grep 0 件、かつ HEAD と同一で確定）。v6d も coverage-margin を import しない。一方向を実 import で確認。
- 単位・上界契約が doc コメントに明記（:44-59, 75-90）: ソース・テクスチャ画素、atlas は別座標系で placement スケール換算が要る旨、全稼働方式で `r ≤ maxCoverageMarginSourcePixels(size)`、v6d ≈3px は floor `ceil(4+1)=5 > 3` で常に内側、飽和は clamp 端点+blur（5/17）。
- `index.ts:31` で `export * from "./mesh-generation-coverage-margin.js";`（re-export 済み、cross-package 参照可）。

### 5. 旧定数の参照解消 — pass
- `COVERAGE_MARGIN_MAX_SOURCE_PIXELS` / `V7_MARGIN_RADIUS_MAX_PIXELS_BOUND_TO_K` / `ADAPTIVE_CONTOUR_TARGET_MASK_EXPANSION_PIXELS` / `ADAPTIVE_CONTOUR_VIRTUAL_PADDING_BUFFER_PIXELS` は `packages` 配下で **grep 0 件**。旧定数名は削除済み。

### 6. 対象外の不可侵 — pass（Domain A 帰属範囲において）
- Domain A 帰属ファイル（authoring-core の mesh-generation 系 + index + coverage-margin + 各テスト）のみ変更/作成。
- 非稼働 v6a/b/c は未変更（git status に現れず）。
- **注意（Domain A 帰属外）**: 作業ツリーには並行ドメインの未コミット変更が同居している（`apps/editor/.../browser-psd-parser-adapter.*`, `packages/operation-core/.../import-psd-layer-materialization.*`, `packages/package-format/src/texture-atlas.ts` 等＝D-texprep、`packages/render-software/*`, `packages/render-webgl2/src/webgl2-textures.ts`＝D-render）。これらは Domain A の帰属ではなく本レビューの対象外。Domain A 由来の変更に texprep/atlas/render/export への書き込みは含まれない（git diff で範囲を弁別済み）。

## テスト適合（Option E Required tests 充足状況）

- **① 境界頂点 UV 非クランプ・stage 同一基準（[0,1] 外含む）** — 充足。`mesh-generation-v7-margin-contour.test.ts`「leaves UVs UNclamped ... bounded by the covering margin」green。`mesh-generation.test.ts:2106-2127` で bounds 外頂点の UV が `[-marginX, 1+marginX]` 内かつ少なくとも 1 頂点が [0,1] を実際に超えることを検証。合致メッシュは strict [0,1]（:4598-4618, textureSize 未指定時 margin=0）で退行なし。
- **② v7 の r 自然復帰（長辺大で 4 超）** — 充足。`mesh-generation-v7-margin-contour.test.ts:97-117`「leaves the margin radius r at its natural long-edge-proportional value」: 長辺100→4(floor)、長辺1000→**12(>4)**、長辺4096→16(ceiling)、全サイズ 4..16。前回の「r≤K 実質4固定」テストを置換。
- **③ `maxCoverageMarginSourcePixels` 単体** — 充足。`mesh-generation-coverage-margin.test.ts`（5 tests）: 小長辺→`ceil(4+blur)=5` 飽和、大長辺→`ceil(16+blur)=17` 飽和、中間 1000→`ceil(12+1)=13` 比例、参照式 `ceil(clamp(0.012·L,4,16)+blur)` と全サイズ一致、v6d ≈3px を常に上回る。**飽和期待値が 5/17（単純 4/16 でない）で式に整合**していることを確認（甘くしていない）。
- **④ v6d mask expansion=2 / virtual padding=4** — 充足。`mesh-generation-v6d-adaptive-coverage-margin.test.ts`（3 tests）: expansion=2 / padding=4 / padding≥expansion。
- **テストを甘くして通した形でないか** — 該当なし。前回の「r≤K=4 束縛」テストは削除ではなく「自然値（長辺比例）」検証へ**書換え**られ、より強い制約（1000→12 の等値）を課している。UV overshoot 予算は定数 `+1` から `maxCoverageMarginSourcePixels(size)+1`（サイズ関数）へ厳密化。

## テスト結果（自分で実行）

- `pnpm.cmd exec vitest run packages/authoring-core/src`: **38 files / 299 tests all passed**（Duration 6.46s）。report の「299 green」を裏取り。
- `pnpm.cmd typecheck`（`tsc --noEmit`）: **clean（エラー無し）**。report の「typecheck clean」を裏取り。

## 裁量判断（設計未定義だが合理的に実装された箇所）

- **① v7 定数再利用の依存構造**: `maxCoverageMarginSourcePixels` が v7 の r 定数を import して上界式を単一真実源化する設計は plan §5/§13 の「v7 の r 式が上界」に忠実で、循環も無く合理的。追加の依存方向 `coverage-margin → v7-parameters` は妥当。承認。
- **② 軽微な doc コメント staleness（非 blocking）**: 「bound to K」等の旧 K 用語が 3 箇所のコメントに残存。
  - `mesh-generation-v6-contour-pipeline.ts:255`「the transparent texture gutter (bound to K, ...)」
  - `mesh-generation-v7-margin-contour.ts:274-275`「the transparent gutter (bound to K) receives them」
  - `mesh-generation-v7-parameters.ts:126`（`deriveV7VirtualPaddingPixels` docstring）「their UVs clamp to [0,1]」（UV 非クランプ化後は逆の記述。ただし当該ファイルは HEAD と net 一致＝Domain A が触れていない pre-existing コメントで、:126 は今回の allowed scope 行 :163-169 外）。
  - いずれも Option E で gutter は定数 K でなく `maxCoverageMarginSourcePixels(size)` に束縛される旨へ言い換えるのが正確。**挙動・契約には影響せず、正準コードコメント（:44-99）は Option E を正しく記述している**ため非 blocking。次に当該ファイルへ触れる際（D-texprep/D-atlas 連携や D-final clean review）に語彙を揃えることを推奨。

## 判定

**合格（pass）**。Option E の契約（生成 r 非束縛 / UV 非クランプ維持 / 覆いマージン幅の層サイズ関数化 / 単一真実源 / 循環依存なし / 旧定数解消）に全観点で適合。Required tests は書換え含め全て充足し、テストを甘くした痕跡なし。vitest 299 green・typecheck clean を独立に再現。要修正なし。上記 裁量②の doc 語彙統一のみ将来タスクとして申し送り（blocking ではない）。
