# Perf Wave 2 / Domain G 実装レポート — 案D+E: deformerVertex 表示経路最適化

> Status: Complete
> 実装: Gnome（Orch-Sylph からのサブエージェント委任）
> ブランチ: feature/2d-rigging-eco-system（Domain F 案A 適用後の作業ツリー上に実装。Domain F 変更は巻き戻していない）
> 設計オラクル: `discussion/render-performance/improvement-design.md` §3（案D）/ §3-3（案E）、`discussion/render-performance/design-inputs.md` §5

---

## 1. 変更ファイル一覧

| ファイル（リポジトリ相対） | 変更種別 |
|---|---|
| `apps/editor/src/workspace/canvas/canvas-evaluation.ts` | 実装（normalizeTransformNumber / applyRigControlChainToVertices / cloneMesh / shallowCloneVec2 追加 / unionRects） |
| `apps/editor/src/workspace/canvas/canvas-projection.ts` | 実装（cloneEvaluatedMesh の頂点/UV 参照渡し化） |
| `apps/editor/src/workspace/canvas/canvas-evaluation.test.ts` | テスト追加（二層分離検証の新 describe ブロック 3 テスト） |

`canvas-render-scene-adapter.ts` は**変更していない**（判断根拠は §3-2 末尾）。計測フック（`recordLive2dPerformanceTiming` / `recordLive2dPerformanceCounter` / `startLive2dPerformanceTiming`）は 1 箇所も削除・改変していない（git diff で削除行なしを確認済み）。

---

## 2. 各変更の設計対応

### 2-1. normalizeTransformNumber の数値演算置換（設計 §3-1「toFixed 除去または数値演算置換」）

**選択: toFixed の完全除去（微小値ゼロ化 snap は保持）**。

- 変更前: `Math.abs(value) < 1e-12 ? 0 : Number(value.toFixed(12))`
- 変更後: `Math.abs(value) < 1e-12 ? 0 : value`

**根拠（なぜ「数値丸め関数への置換」ではなく「除去」を選んだか）**:
`Math.round(value * 1e12) / 1e12` 方式も検討したが、`value * 1e12` が |value| > ~9e6 で 2^53 を超え、丸め誤差が最大 1.5e-8 まで拡大し、元の toFixed 出力との差が epsilon(1e-9) を超えることを数値検証で確認した（座標が絶対値で大きい経路があるため不採用）。
一方、toFixed(12) の除去は「12 桁固定小数点への丸め」を外すだけで、元の toFixed 出力との差は座標範囲全域（1e-4〜1e9、300 万ケース + 45 度回転の代表点）で**最大 9.1e-13**、epsilon(1e-9) を 3 桁下回る。純粋にホットパスから文字列 alloc/parse を消せて表示等価を最も安全に保てるため、除去を採用した。

呼び出し 6 箇所群（applyRotationToPoint :907/910、applyWarpLatticeToPoint :952/953、composeControlPointPreview :1049/1050、computeBoundsFromVertices :1163-1166、cloneVec2 :1222/1223、interpolateVec2 :1229/1230）はいずれも表示専用（§4 参照）。除去はこれら全経路に一括で効く。

### 2-2. 3 重クローン削減（設計 §3-2）

対象の 3 つのクローンポイント（評価 → projection → adapter）をそれぞれ次のように扱った。

**(a) 評価層 `cloneMesh`（表示/保存の境界そのもの）**
`vertices`/`uvs` を `cloneVec2`（= normalizeTransformNumber 経由）から新設 `shallowCloneVec2`（素の `{x, y}` コピー）へ変更。cloneMesh の唯一の役目は「`session.graph` 原本を alias しない新規頂点オブジェクトを作る」こと（design-inputs §5 の境界）。原本座標は既に正規化済みなので、ここで再度 normalize する必要はない。新規オブジェクト化（原本 isolation）は維持したまま、per-vertex の正規化パスを落とした。**この境界（新規オブジェクト化）は保持しており、原本 `session.graph.meshes` には触れない。**

**(b) 評価層 `applyRigControlChainToVertices` の冗長コピー除去**
変更前は入力 `currentVertices`/`referenceVertices` を両方 `.map(cloneVec2)` で防御コピーしてから chain を適用していた。入力は cloneMesh 由来の使い捨て新規オブジェクトなので防御コピーは冗長。`applyRigControlToPoint` は変形時に必ず新規オブジェクトを返し、reference は読むだけ（`applyWarpLatticeToPoint` が referencePoint を read-only 参照）なので、入力配列をそのまま使って問題ない。加えて **chain が空（= deformer を持たない大多数の drawable）の場合は入力頂点をそのまま返す**ようにし、無変形 drawable の per-vertex コピーを完全に消した。

**(c) projection 層 `cloneEvaluatedMesh` の頂点/UV 参照渡し化**
`vertices`/`uvs` を `.map(clonePoint)` から**参照渡し**へ変更（`bounds`/`triangles`/`vertexStableIds` の小メタデータコピーは保持）。この関数が受ける `evaluatedMesh` は当該評価で新規生成された表示専用オブジェクトで、この projection 専用（複数 projection・原本と共有されない）。下流消費者（`createRenderSceneFromCanvasProjection`、canvas-renderer、mesh overlay、viewer-render-source）はいずれも頂点/UV を read-only で消費し、adapter が RenderScene 生成時に再クローンする。よってこの中間コピーは 3 重クローンの「真ん中の 1 枚」であり、削れる。

**adapter 層（`canvas-render-scene-adapter.ts` の `.map(clonePoint)`）は残した（変更なし）。判断根拠**: adapter は表示経路の最終境界で、ここで作られた頂点配列は `createRenderScene` を経て WebGL 等のレンダラ（packages/render-core / render-webgl2、本タスクで変更・調査対象外）へ渡り、そのライフサイクル（後段 mutate の有無）を editor 側から保証できない。参照渡しにすると、今回参照渡し化した projection → 評価層の evaluatedMesh まで mutation が波及するリスクが読めない。設計 §3-2 の要件は「3 重クローンの**削減**」であり、評価層の正規化除去 + projection 層の完全参照渡しで既に実質「3 枚 → adapter の 1 枚」まで削減済み。最終境界の 1 枚を保持するのが決定性・isolation を壊さない最も安全な選択と判断した。

### 2-3. 案E: unionRects の spread 除去（設計 §3-3）

`canvas-evaluation.ts` の `unionRects` の `Math.min(...positive.map(...))` × 4（+ filter の中間配列）を、フィルタ + extrema 計算を 1 パスに畳んだ reduce ループへ置換。中間配列 5 本と spread（大 N でのスタックオーバーフロー要因）を除去。数値結果は同一（同じ min/max を同じ入力で計算）。
※ `canvas-projection.ts` にも同名 `unionRects` があるが、設計 §3-3 の標的は evaluation 側であり、projection 側は Domain G スコープ外のため触っていない。

---

## 3. 二層分離の実証方法

新規 describe ブロック `canvas evaluation — display/save two-layer separation (Perf Wave 2 / Domain G)` を `canvas-evaluation.test.ts` に追加（3 テスト）。**45 度回転**を使い、無理数座標（非整数）を実際に発生させることで toFixed-vs-数値の差を意味あるかたちで踏ませている（整数のみの fixture では差 0 で自明通過してしまうため）。

| テスト | 検証層 | 内容 |
|---|---|---|
| `keeps evaluated (display) vertices within 1e-9 of the old toFixed normalization` | **表示層 epsilon 等価** | 45 度回転後の評価頂点が、旧 `Number(value.toFixed(12))` 実装が出していた値（`OLD_TOFIXED_ROTATED_SQUARE` にハードコード）と各座標で絶対差 ≤ 1e-9。回帰ガードとして、実測差（最大 2.5e-13）があるため epsilon を 0 にすれば落ちる = 有効に機能する。 |
| `leaves the session.graph save-layer originals byte-identical across evaluation` | **保存層バイト同一** | 無理数を生む評価の前後で `JSON.stringify(session)` が完全一致。評価済み表示物が保存/export/provenance の source of truth（`session.graph`）へ書き戻らないことを保証。 |
| `isolates evaluated display vertices from the original mesh objects` | **クローン isolation** | 評価頂点を破壊的に書き換えても原本 mesh 頂点が不変。クローン削減後も表示境界が新規頂点オブジェクトを配っていることを保証。 |

加えて、既存の Domain F 由来テスト `produces byte-identical drawables whether or not a rig control is selected`（drawables の JSON バイト一致）も、私の表示経路変更後に green を維持しており、drawable 出力の等価を追加で担保している。

---

## 4. normalizeTransformNumber 呼び出し箇所と表示専用の確認根拠

全呼び出しが `createCanvasEvaluatedScene` 内にあり、その出力の消費者は `canvas-projection.ts`（表示）とテスト/ベンチのみ（Grep `createCanvasEvaluatedScene` で全消費者を確認）。保存・export・provenance は `session.graph` 原本を読むため評価済み値は流れない（design-inputs §2/§5、Orch-Sylph 確認済み事実と一致）。個別の辿り:

| 箇所（行） | 関数 | 流れ先 | 表示専用の根拠 |
|---|---|---|---|
| :907/910 | applyRotationToPoint | applyRigControlToPoint 経由で ① deformerVertex（drawable.evaluatedMesh.vertices）② rigControl overlay（applyRigControlChainToPoint） | どちらも evaluatedScene の派生表示物。原本非依存。 |
| :952/953 | applyWarpLatticeToPoint | 同上 | 同上 |
| :1049/1050 | composeControlPointPreview | EvaluationWarpRigControl.controlPointOffsets（warp 変形入力）→ 表示頂点/overlay | 評価内部表現のみ。原本は別（session.graph.rigControls）。 |
| :1163-1166 | computeBoundsFromVertices | ① drawable.bounds（表示 bounds、computeEvaluatedMeshBounds 経由）② warp overlay domainBounds | いずれも評価済み表示物。保存 bounds は原本 mesh.bounds（別経路）。 |
| :1222/1223 | cloneVec2 | rotation pivot/translation/scale、warp rest/offset、applyRigControlChainToPoint の初期化等（全て評価内部・overlay） | 評価内部表現・表示 overlay のみ。cloneMesh からは shallowCloneVec2 へ切替済みで、原本頂点コピー経路からは外れた。 |
| :1229/1230 | interpolateVec2 | applyWarpLatticeToPoint の格子補間（deformerVertex/overlay） | 変形計算の中間値。表示専用。 |

結論: 6 箇所群すべて表示専用。normalizeTransformNumber の除去は保存・export・provenance のバイト互換に一切触れない。

---

## 5. ベンチ before/after（合成ベンチ, `synthetic-heavy-model.bench.test.ts`, RUN_PERF_BENCH=1, 20 iterations）

各セル = totalMs（20 回合計） / avgMs（1 評価あたり）。before/after ともに 2 回計測し安定を確認。

### deformerVertex（`canvas.evaluation.deformerVertex.ms`）

| scale | before (total / avg) | after (total / avg) | 削減率(total) |
|---|---|---|---|
| light (8×16, D1) | 9.19 / 0.46,  9.19 / 0.46 | 3.36 / 0.17,  3.79 / 0.19 | 約 −61% |
| medium (40×64, D3) | 178.8 / 8.94,  177.1 / 8.86 | 18.3 / 0.92,  18.4 / 0.92 | **約 −90%** |
| heavy (120×256, D6) | 3569 / 178.5,  3607 / 180.4 | 329.3 / 16.5,  332.6 / 16.6 | **約 −91%** |
| rigHeavy (200×4, D8) | 141.5 / 7.07,  141.3 / 7.06 | 34.3 / 1.71,  34.5 / 1.73 | 約 −76% |

### evaluation 全体（`canvas.evaluation.ms`）

| scale | before (total / avg) | after (total / avg) | 削減率(total) |
|---|---|---|---|
| light | 12.1 / 0.61 | 6.5 / 0.33,  6.9 / 0.35 | 約 −45% |
| medium | 197.9 / 9.90,  196.8 / 9.84 | 36.4 / 1.82,  36.4 / 1.82 | **約 −82%** |
| heavy | 3679 / 183.9,  3720 / 186.0 | 418.9 / 20.9,  415.1 / 20.8 | **約 −89%** |
| rigHeavy | 349.6 / 17.5,  356.0 / 17.8 | 206.8 / 10.3,  207.3 / 10.4 | 約 −41% |

deformerVertex が支配的な medium/heavy で 90% 前後の削減。rigHeavy は rigControlEval（案A 対象、Domain G スコープ外）が主区間のため evaluation 全体の削減率は相対的に小さいが、deformerVertex 自体は −76%。before/after は 2 回とも近接しており改善は再現性あり。

---

## 6. テスト結果

| コマンド | 結果 |
|---|---|
| `vitest run apps/editor/src/workspace/canvas` | **106 passed / 4 skipped**（4 skip はベンチ opt-in）。新規二層分離 3 テスト含む。 |
| `vitest run apps/editor/src/workspace/viewer apps/editor/src/workspace/canvas` | **177 passed / 4 skipped**（evaluatedMesh 消費の viewer-render-source 含む） |
| `vitest run apps/editor/src`（editor 全体） | **450 passed / 4 failed / 4 skipped** |

除外した既知 fail: `apps/editor/src/workspace/diagnostics/diagnostics-jump-actions.test.ts` の **4 件**（gate が明示した既知 baseline fail。内容は jump アクションの `"import"` vs `"workspace"` で Domain G と無関係、私の変更前から failing）。

**exact→epsilon に更新した既存テスト: 0 件。** 既存テストは整数座標中心のため、toFixed 除去・クローン参照渡しでも表示値が変化せず（整数は完全一致、非整数経路は既存テストに無かった）exact 一致が壊れなかった。意味論の緩和も行っていない。二層分離の epsilon 検証は新規テストで**追加**したものであり、既存テストの緩和ではない。

---

## 7. typecheck / check:source / check:deps

| チェック | 結果 |
|---|---|
| `tsc --noEmit -p apps/editor/tsconfig.json` | 総エラー **22 件**（gate 明示の pre-existing 22 件と完全一致）。変更 3 ファイル（canvas-evaluation.ts / canvas-projection.ts / canvas-render-scene-adapter.ts）起因の型エラー **0 件**。 |
| `node scripts/check-source-organization.mjs` | **passed** |
| `node scripts/check-dependencies.mjs` | **passed** |

---

## 8. 禁止事項の遵守

- packages/** 変更: なし
- 保存・export・provenance 経路の変更: なし（`session.graph` 原本に touch なし。§3/§4 で実証）
- 依存・lockfile / pnpm install: なし（`pnpm install` 相当の依存変更は不要だった）
- コミット: 行っていない
- Domain F 変更の巻き戻し: なし（git diff で私の編集箇所のみ変更、案A 差分は保持を確認）
- 計測フック削除: なし（git diff 削除行チェックで確認）

---

## 9. 判断に迷った点・質問

なし（設計オラクル §3 と design-inputs §5 の範囲で完結。設計に無い分岐は発生しなかった）。

補足の設計判断メモ（ユーザー裁定不要、report 記録のみ）:
- normalizeTransformNumber は「数値丸め関数への置換」ではなく「除去」を選択（§2-1 の epsilon 検証根拠による）。
- adapter 層のクローンは残す選択（§2-2(c) の RenderScene ライフサイクル isolation 根拠による）。3 重 → 実質 1 枚（adapter のみ）まで削減し、設計 §3-2 の「削減」要件を満たしつつ最終境界の安全性を優先した。

---

## 10. ループ2: isolation テスト補強（テスト追加のみ）

### 背景（レビュー指摘）

レーン2（テスト妥当性）レビューで、§3 で追加した既存 isolation テスト `isolates evaluated display vertices from the original mesh objects` に実効性の穴が見つかった。当該テストは **rotation deformer を持つ drawable（DRAW_FACE）** の評価頂点を使っている。deformer 経路では `applyRotationToPoint` が変形時に必ず新規オブジェクトを返すため、評価頂点は常に fresh となり、Domain G が実際に変更した唯一の行 — `cloneMesh` の `vertices`/`uvs` 用 `shallowCloneVec2`（= **無変形 drawable〔deformer chain 空〕の表示境界**）— を踏んでいなかった。

レビュアが注入検証で実証: `shallowCloneVec2` を `return value;`（原本 alias）に退行させても canvas スイート全体が green のまま。つまり Domain G が変更した 1 行の isolation 退行を旧テスト群は捕捉できていなかった。

### 追加したテストケース

`apps/editor/src/workspace/canvas/canvas-evaluation.test.ts` の Domain G 二層分離 describe ブロックに **1 テスト追加**（プロダクトコードは一切変更なし）:

- **テスト名**: `isolates evaluated display vertices for a deformer-free drawable from the original mesh`
- **対象の無変形 drawable**: `DRAW_HIDDEN`（既存 fixture の無変形 drawable。`createRotatedSquareSession` では rotation deformer は DRAW_FACE のみにバインドされ DRAW_HIDDEN は rig control 非バインド = deformer chain 空）
- **踏む経路**: 無変形 drawable は `applyRigControlChainToVertices` が chain 空で `currentVertices`（= `cloneMesh` 出力）を素通しで返すため、評価頂点は `cloneMesh` の `shallowCloneVec2` 出力そのもの。間に deformer 変形が介在せず、`shallowCloneVec2` の isolation 境界を直接踏む。
- **fixture の無変形性ガード**: テスト冒頭で「DRAW_HIDDEN を childDrawableIds に含む rig control が存在しないこと」を assert し、将来 fixture 変更で DRAW_HIDDEN に deformer が付いてもこの前提が崩れたことを検知できるようにした。fixture 追加は不要だった（既存 DRAW_HIDDEN が無変形）。

### 退行注入の実測結果

一時的に `apps/editor/src/workspace/canvas/canvas-evaluation.ts` の `shallowCloneVec2` を `return value;`（原本 alias）へ退行させて実測:

| テスト | 退行注入時の結果 |
|---|---|
| 既存 `isolates evaluated display vertices from the original mesh objects`（DRAW_FACE / rotation deformer 経由） | **green のまま**（=レビュア指摘どおり穴を再現。deformer が fresh オブジェクトを作るため退行を検知できない） |
| 新規 `isolates evaluated display vertices for a deformer-free drawable from the original mesh`（DRAW_HIDDEN / 無変形） | **fail**（`AssertionError: expected { x: 9999, y: 10 } to deeply equal { x: 10, y: 10 }` — 破壊的書き込みが原本 mesh 頂点へ漏洩） |

新規テストが `shallowCloneVec2` の isolation 退行を確実に捕捉することを実証。**確認後 `shallowCloneVec2` を `return { x: value.x, y: value.y };` に復元済み**（`git diff` で当該プロダクトファイルに退行由来の残差分がないこと、変更が Domain G/F 実装そのものであることを確認）。復元後、新規テスト単体・全体ともに green。

### gate 実測

| チェック | 結果 |
|---|---|
| 新規テスト単体（`-t "isolates evaluated display vertices for a deformer-free drawable"`） | **1 passed**（復元後） |
| `vitest run apps/editor/src/workspace/canvas` 全体 | **110 passed / 4 skipped**（前ループ 106 passed + 二層分離テスト 3→4 で +1、fixture/plan A テスト等含む。既知 baseline fail の diagnostics-jump-actions は canvas スコープ外で無関係） |
| `tsc --noEmit -p apps/editor/tsconfig.json` | 総エラー **22 件**（pre-existing 22 件と一致）。`canvas-evaluation.test.ts` 起因の型エラー **0 件** |

### 禁止事項の遵守（ループ2）

- プロダクトコード変更: なし（退行注入は確認用の一時変更で、確認後即復元。最終差分は前ループの Domain G/F 実装のみ）
- 既存 Domain G / Domain F 実装・テストの意味論変更: なし（テスト 1 件を**追加**したのみ、既存テストは無改変）
- packages/** / 依存 / pnpm install / コミット / 計測フック改変: なし

### 判断に迷った点・質問

なし。DRAW_HIDDEN が既存 fixture の無変形 drawable として利用可能で、`runtimeVisibility: false` でも評価済み drawable としてシーンに現れる（既存テスト line 103 が `requireDrawable(evaluatedScene, DRAW_HIDDEN)` で参照済み）ことを確認したため、fixture 追加なしで完結した。
