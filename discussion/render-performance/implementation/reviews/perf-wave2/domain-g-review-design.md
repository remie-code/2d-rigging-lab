# Perf Wave 2 / Domain G レビュー — 案D+E: deformerVertex 表示経路最適化（レーン1: 設計適合）

> レビュー: Review-Sylph（設計適合レーン、読み取り専任）。委任元: Orch-Sylph
> 設計オラクル: `discussion/render-performance/improvement-design.md` §3（案D）/ §3-3（案E）、`design-inputs.md` §5
> 対象実装レポート: `discussion/render-performance/implementation/waves/perf-wave2/domain-g-report.md`
> レビュー対象ファイル: `canvas-evaluation.ts` / `canvas-projection.ts` / `canvas-evaluation.test.ts`（いずれも apps/editor/src/workspace/canvas/）

---

## 判定: **合格**

Domain G の変更（toFixed 除去 / shallowCloneVec2 / applyRigControlChainToVertices コピー除去 / cloneEvaluatedMesh 参照渡し / unionRects spread 除去）は設計 §3 の各項目に適合し、不変条件「保存・export・provenance のバイト互換不可侵／表示値 epsilon(1e-9) 等価」を維持している。要修正の差分はなし。

---

## 1. 保存・export・provenance 非侵犯（最重要）— 検証結果: 合格

diff 全行および対象ファイル本体を確認。**`session.graph`（原本 = メッシュ・rigControls・provenance の source of truth）へ書き込む/変更する箇所は一切ない。**

- `canvas-evaluation.ts` 内の `session.graph.*` 参照は全て read（`session.graph.parts.map` :223 / `session.graph.meshes.map` :224 / `textureAtlas?.textures.map` :226 / `drawables.map` :1102）のみ。代入・push・splice・sort 等の破壊操作は grep で 0 件。
- 触っているのは全て評価済み表示物（`evaluatedMesh` / `bounds` / `rigControls` DTO）のみ。cloneMesh（:1002）以降が表示専用という design-inputs §5 の境界を Gnome は保っている。

### 原本 isolation の維持（cloneMesh を shallowCloneVec2 に変えた影響）

- `cloneMesh`（:1012-1013）は `mesh.vertices.map(shallowCloneVec2)` / `mesh.uvs.map(shallowCloneVec2)` で**新規オブジェクト `{x, y}` を生成**している。`shallowCloneVec2`（:1273-1275）は `{ x: value.x, y: value.y }` を返す純粋な新規オブジェクト化であり、原本頂点オブジェクトを alias しない。normalize を落としただけで isolation は不変。**原本 alias の懸念なし。**
- 二層分離テスト `isolates evaluated display vertices from the original mesh objects`（:666）が、評価頂点の破壊書き換えが原本 `session.graph.meshes` に波及しないことを実証。green 確認済み。

### applyRigControlChainToVertices の参照渡し化（原本 isolation）

- 変更前は入力 `currentVertices`/`referenceVertices` を両方 `.map(cloneVec2)` していたが、変更後は参照をそのまま使う（chain 空なら `input.currentVertices` を素通し）。入力は `baseMesh.vertices`（= cloneMesh 由来の新規オブジェクト、:288-289）なので、原本からは既に分離済み。**素通しでも原本 isolation は保たれる**（原本を指すのは一度も無い）。
- chain が非空のとき `current = current.map(...)` で毎段新配列を生成し、`applyRigControlToPoint` が変形時に新規オブジェクトを返す（identity/disabled ケースも `applyWarpLatticeToPoint` :947 が `cloneVec2` で新規、`referencePoint` は読むだけ）。reference は元 `baseMesh.vertices` を指し続けるが read-only。**mutation 波及なし。**

### cloneEvaluatedMesh 参照渡し化（projection 間・原本との共有）— 合格

- `cloneEvaluatedMesh`（canvas-projection.ts :383-395）は `vertices`/`uvs` を参照渡し、`triangles`/`bounds`/`vertexStableIds` は shallow copy 保持。受ける `evaluatedMesh` は当該評価で新規生成された表示専用オブジェクトで、この projection 専用。
- **下流 consumer が vertices/uvs を mutate しないことを独立確認**（grep `.vertices[...]=` / push / splice / sort 等を apps/editor/src/workspace 全域で走査）:
  - `canvas-render-scene-adapter.ts:83-84`: `.map(clonePoint)` で再クローン（read-only）。最終境界で新規化するため参照渡しは安全。
  - `canvas-renderer.ts:803-805, 919-921` / adapter :115-117: index 参照の読み取りのみ。
  - `viewer-render-source.ts:502`: `.uvs.map(...)` で新配列生成（read-only）。
  - mutate 箇所は 0 件（唯一 `runtime-export-task-screen.test.ts:206` が `session.graph.meshes...uvs[1]=` だが、これはテストが原本を直接操作しているだけで表示経路と無関係）。
- **複数 projection 間や原本との共有による mutation 波及リスクなし。** adapter が最終クローン境界として機能している。

---

## 2. 設計 §3 各項目（a/b/c）の適合状況

### (a) 表示経路 toFixed(12) 除去/数値置換 — 適合（除去を選択）

- `normalizeTransformNumber`（:1326）は `Math.abs(value) < 1e-12 ? 0 : value` へ変更。微小値ゼロ化 snap は保持、12桁固定小数点丸めのみ除去。
- 設計 §3-1 は「除去または数値演算への置換」を許容しており、除去は許容範囲内の選択。
- **epsilon 等価を独立実証**（下記 §epsilon 評価）。合格。

### (b) 3重クローン削減 — 適合

- 評価層: `cloneMesh` の per-vertex normalize パスを `shallowCloneVec2` で除去 + `applyRigControlChainToVertices` の冗長 `.map(cloneVec2)` 2本を除去（chain 空時は完全素通し）。
- projection 層: `cloneEvaluatedMesh` の `vertices`/`uvs` を参照渡し化（中間の1枚を削除）。
- adapter 層: `.map(clonePoint)` 保持（最終境界）。
- 実質「3枚 → adapter の1枚」まで削減。設計 §3-2「3重クローンの**削減**」要件を満たす（「全廃」は要求されていない）。adapter 保持判断は下記で妥当と評価。

### (c) 案E unionRects spread 除去 — 適合

- `unionRects`（:1168-）を `Math.min(...positive.map(...))` ×4 + filter 中間配列から、1パス reduce ループへ置換。中間配列5本と spread（大 N のスタックオーバーフロー要因）を除去。
- min/max の計算内容は同一入力・同一演算で不変（`hasPositive` フラグで空判定も従来と等価）。数値結果同一。合格。
- 注記: `canvas-projection.ts` の同名 `unionRects` は設計 §3-3 の標的外（evaluation 側のみが標的）であり、Gnome が触っていないのは正しいスコープ判断。

---

## 3. 独立確認した normalizeTransformNumber 箇所（表示専用性）

Gnome の §4 を鵜呑みにせず、以下を呼び出し元まで独立に辿った:

| 箇所 | 関数 | 辿った流れ先 | 表示専用の独立確認 |
|---|---|---|---|
| :924/927 | applyRotationToPoint | `applyRigControlToPoint` → `applyRigControlChainToVertices` → `evaluatedMesh.vertices`（表示頂点）/ overlay | 新規オブジェクトを返し原本非依存。`session.graph` 書き戻りなし。**確認済み** |
| :969/970 | applyWarpLatticeToPoint | 同上（+ identity は cloneVec2 で新規、referencePoint は read-only） | 同上。**確認済み** |
| :1186-1189 | computeBoundsFromVertices | `computeEvaluatedMeshBounds`（:1193）→ `drawable.bounds`（表示 bounds、:291→:304-305 の `mesh`/`bounds`） | 保存 bounds は原本 `session.graph.meshes[].bounds`（cloneMesh で structuredClone、原本不変）。表示 bounds は派生。**確認済み** |
| :1072/1073 | composeControlPointPreview | warp preview 入力合成 → 表示頂点/overlay | preview は評価入力（表示専用）、原本 `session.graph.rigControls` は別。**確認済み** |

6箇所群すべて `createCanvasEvaluatedScene` 内にあり、その出力の消費者は canvas-projection（表示）とテスト/ベンチのみ。`session.graph` への書き込み経路が存在しない（§1 の grep で確証）。**normalizeTransformNumber 除去は保存・export・provenance のバイト互換に一切触れない。**

---

## 4. epsilon 等価の妥当性評価 — Gnome の toFixed 除去判断に同意

Gnome の §2-1 の epsilon 主張を独立に数値検証した:

- **45度回転の実座標**（テスト fixture 相当）での `toFixed(12)` vs 除去の max diff = **2.52e-13**。テストの `OLD_TOFIXED_ROTATED_SQUARE`（`-20.710678118655` 等）とも整合。
- **広範囲**（1e-4〜1e9、300万ケース）の max diff = **9.09e-13**。Gnome の主張「最大 9.1e-13」と完全一致。
- いずれも epsilon(1e-9) を約3桁下回る。**表示等価は安全に保たれている。**
- Gnome が `Math.round(v*1e12)/1e12` 方式を不採用とした根拠も独立検証: |value| が 1e6〜1e10 の範囲で toFixed との差が **1.9e-6** まで拡大し epsilon を大幅超過（Gnome 見積もり 1.5e-8 より大きいが、epsilon 超過という結論は同一で不採用判断は妥当）。

→ **toFixed 除去への同意。異議なし。**

二層分離テスト（`canvas-evaluation.test.ts` :636-687 の新規 describe 3テスト）は epsilon 等価・保存層バイト同一・クローン isolation を的確に回帰ガードしており、45度回転で無理数座標を実際に踏ませる設計（整数 fixture の自明通過回避）も適切。green 実行確認済み。

---

## 5. adapter クローン保持判断への評価 — 妥当

adapter 層の `.map(clonePoint)`（:83-84）を残した Gnome の判断（§2-2(c)）に同意。

- 理由: adapter は表示経路の最終境界で、生成頂点は `createRenderScene` を経て packages/render-core/render-webgl2（Domain G スコープ外・調査対象外）へ渡る。そのライフサイクル（後段 mutate の有無）を editor 側から保証できない。ここを参照渡しにすると projection→評価層の evaluatedMesh まで mutation 波及リスクが読めない。
- 設計 §3-2 の要件は「3重クローンの**削減**」であり全廃ではない。評価層 normalize 除去 + projection 完全参照渡しで実質1枚まで削減済み。最終境界の1枚保持は決定性・isolation を壊さない最も安全な選択で、設計要件を満たす。**妥当。**

---

## 6. 裁量判断の妥当性

- **toFixed 除去（数値丸め置換ではなく）**: epsilon 検証（§4）により妥当。文字列 alloc/parse をホットパスから消しつつ表示等価を最も安全に保つ。
- **adapter クローン保持**: §5 の通り妥当。
- **projection 側 unionRects 非改修**: 設計 §3-3 の標的が evaluation 側のみのため正しいスコープ判断。
- いずれも設計オラクルの範囲内・不変条件を破らない合理的判断。

---

## 7. 計測フック維持 — 合格

`recordLive2dPerformanceTiming` / `recordLive2dPerformanceCounter` / `startLive2dPerformanceTiming` は削除・改変されていない（diff に削除行なし。むしろ細分化スパンが**追加**されている ← これは Domain G ではなく別ドメイン由来、§8 参照）。Domain G の変更が計測フックを壊していないことを確認。

---

## 8. 禁止事項遵守 — 合格

- packages/** 変更: なし。
- Domain F 巻き戻し: なし（案A の選択駆動化コードは保持されている）。

### 注記（作業ツリーの変更混在について — 質問あり）

diff には Domain G スコープ外の変更が混在している。切り分け結果:

- **Domain F 由来**: `createCanvasEvaluatedRigControls` の選択駆動化 / `resolveRequiredEvaluatedRigControlIds` 新設 / requiredIds 配線（案A、Domain F レポートに記載あり）。
- **どちらのレポートにも記載のない変更**: `CanvasEvaluationCaller` 型追加 / `recordLive2dPerformanceCounter` import / `evaluationCaller` オプションと panel/viewer/projection への caller 配線（`canvas-preview-panel.tsx:161` / `viewer-clean-stage.ts:59` / `viewer-runtime-screen.tsx:437` の各1行、`canvas-projection.ts` の evaluationCaller 転送）/ 計測スパン細分化（`indexBuild.ms` / `keyform.ms` / `rigControlEval.ms` / `assembly.*.ms` / `artworkBoundsAndAssembly.ms` / caller counter）。

これらは Domain F レポート（「projection/panel/viewer は無改修」と明記）とも Domain G レポート（計測フックは「削除・改変していない」のみ）とも一致しない。**Perf Wave の別ドメイン（計測基盤・caller 計装担当）由来と推測される。** レビュー対象の Domain G 実装（toFixed 除去 / クローン削減 / unionRects）自体には影響しないが、作業ツリーに第三の変更が混在している事実を Orch-Sylph に報告する（下記「質問」）。

---

## 差分・残課題

**なし。** Domain G の変更は設計 §3 に適合し、不変条件を維持している。要修正箇所なし。

---

## 質問（Orch-Sylph への確認）

1. **作業ツリーに Domain F/G いずれのレポートにも記載のない第三の変更（`evaluationCaller` caller 計装 + 計測スパン細分化、canvas-preview-panel.tsx / viewer 2ファイル / canvas-projection.ts の caller 転送 / canvas-evaluation.ts の計測スパン群）が混在している。** これは別ドメイン（計測基盤）の想定内の混在か、それとも意図しない混入か確認されたい。Domain G のレビュー判定自体はこの変更に依存しないが、統合時に別途レビュー対象となるべきか（あるいは既にレビュー済みか）を Orch-Sylph 側で把握しておく必要がある。
