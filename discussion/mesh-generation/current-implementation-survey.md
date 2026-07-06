# メッシュ自動生成 現状実装 調査レポート

> Status: Recorded(2026-07-07)
> 調査担当: Sylph(Opus)。本文書は**リポジトリ事実**の記録である。調査時に確認できなかった箇所は「未確認(推測)」と明示しており、それらは仮説として扱うこと。
> 比較基準にした「提案パイプライン」の正は [concept-design.md](concept-design.md)。

対象リポジトリ: リポジトリルート(以下、パスはリポジトリ相対)

## 1. 所在(実装ファイル群と呼び出し連鎖)

**エントリポイント連鎖**(直接確認済み):

1. オペレーション `generateMesh` — `packages/operation-core/src/operations/generate-mesh.ts:34`(`generateMeshOperationHandler`、dryRun/commit の2経路)
2. → `createGeneratedMeshForDrawable` — `packages/authoring-core/src/mesh-generation.ts:114`(method 文字列で分岐するディスパッチャ、全2482行)
3. → method 別バックエンド(下記)
4. → `replaceDrawableMesh` — `packages/authoring-core/src/mesh-mutations.ts:37`(セッショングラフ内のメッシュをまるごと差し替え)

別経路として、payload に `previewMesh` を積んでプレビュー済みメッシュをそのままコミットするパスがある(`generate-mesh.ts:105-114`、検証は `evaluatePreviewMeshPreconditions` `generate-mesh.ts:205-304`)。

**バックエンド実装ファイル**(すべて `packages/authoring-core/src/`):

| 世代 | ファイル |
|---|---|
| 契約層(method/backend/依存の一覧) | `mesh-generation-contract.ts` |
| v1〜v4(旧世代) | `mesh-outline-generation.ts`, `mesh-outline-v2-generation.ts`, `mesh-outline-v2-5-soft-boundary-generation.ts`, `mesh-outline-v2-6-soft-apron-generation.ts`, `mesh-outline-v3-envelope-generation.ts`, `mesh-outline-v4-contour-band-generation.ts` |
| v6 共通輪郭パイプライン | `mesh-generation-v6-contour-pipeline.ts` |
| v6 多島サポート | `mesh-generation-v6-alpha-islands.ts` |
| v6 各バックエンド | `mesh-generation-v6a-local.ts`, `-v6b-constrainautor.ts`, `-v6c-poly2tri.ts`, `-v6d-contour-constrainautor.ts`, `-v6d-contour-band-support-rings.ts`, `-v6d-adaptive-staggered-band.ts`, `-v6d-adaptive-contour-constrainautor.ts`, `-v6e-contour-poly2tri.ts`, `-v6f-custom-cdt.ts` |
| 密度適応 | `mesh-generation-v6d-adaptive-density.ts` |
| 品質メトリクス | `mesh-quality-metrics.ts` |

UI 側は `apps/editor/src/workspace/panels/mesh-tool-inspector.tsx` と `apps/editor/src/features/editor-session/model/editor-session-commands.ts` が generateMesh を呼ぶ(所在のみ確定、内容は未確認)。AI 向けカタログは `packages/ai-interface/src/ai-codex-proposal-operation-catalog.ts` に generateMesh への言及がある(Grep ヒットのみ、内容未確認)。

method ID の全一覧は `mesh-generation-contract.ts:147-157`: `manual-empty`, `auto-grid-v1`, `auto-outline-v1/v2/v2.5/v2.6/v3/v4` + v6系9種(`contract.ts:7-17`)。**失敗時は多段フォールバック**(例: v4→v2.6→v2.5→v2→v1→bounds-grid、`mesh-generation.ts:243-408`)で、最終的に必ず `bounds-grid`(均一格子)に落ちる。

## 2. 現行アルゴリズム(v6 世代・contour-pipeline 基準)

v6d/e/f 系が共有する `mesh-generation-v6-contour-pipeline.ts` の `createV6ContourCandidateInput`(L116)を工程別に説明する。**全工程が自前実装**であり、このファイルに外部ライブラリの import はない(import は contracts の型のみ、L1-3)。

1. **二値化+平滑化**(`createSoftAlphaMask` L271-305): アルファ閾値 8/255(L112)で二値化。加えて 3x3 重み付きブラー(中心4・辺2・角1、L307)をかけ、ブラー後 0.18 以上(L113)も不透明扱い。1px の裂け目埋め(`closeSinglePixelCracks` L330: 近傍5以上で埋める)と孤立ノイズ除去(L345)を実施。→ 提案の「膨張+平滑化」に相当する処理は**軽い平滑化のみ**がデフォルト。
2. **膨張(dilation)**: `expandMask`(L480-510)として実装済み。4近傍の反復膨張、`maskExpansionPixels` は 0〜8 にクランプ(L114, L475-478)。**ただしデフォルト 0 で、実際に渡しているのは `auto-outline-v6d-adaptive-contour-constrainautor` だけ**(`mesh-generation-v6d-adaptive-contour-constrainautor.ts:51` で `ADAPTIVE_CONTOUR_MASK_EXPANSION_PIXELS = 2`、L153/L193 で使用。L52 に `VIRTUAL_PADDING_PIXELS = 4` もある)。
3. **輪郭追跡**(`traceBoundaryLoops` L512-605): ピクセル境界エッジを列挙してループに繋ぐ自前 Moore 風トレース。ループの正規化・安定始点回転・正方向化を行う。最大面積ループのみ採用(`selectOuterLoop` L607)。
4. **簡略化・再サンプル**(`sampleBoundaryLoop` L621-653): **Douglas-Peucker は使っていない**。周長 ÷ `boundarySpacing` で目標点数を決め、周長に沿った**等間隔再サンプル**+上下左右の極値点4つをアンカー追加(L641-646)。曲率適応はない。ピクセル階段形状の輪郭を直接歩くので、結果は「アルファ境界に忠実」。
5. **内部点**(`sampleInteriorSteinerPoints` L690-739): ポアソンディスクではなく、`interiorSpacing` 刻みの**格子候補を生成 → 境界から `interiorBoundaryClearance` 未満を除外 → 最遠点貪欲選択(farthest-point sampling)**で `maxInteriorVertices` 個まで選ぶ。スコアは「境界距離と既選択点距離の min」(L781)なので、実質ポアソンディスク風の等間隔性は部分的に得られる。**局所幅による細長領域除外はない**(clearance は 1.1〜1.5px と極小)。
6. **三角形分割**: バックエンドごとに異なる(契約 `mesh-generation-contract.ts:72-145` の依存宣言より):
   - v6b/v6d 系: `delaunator` + `@kninnug/constrainautor`(外部ライブラリ、CDT)
   - v6c/v6e: `poly2tri`(外部ライブラリ、CDT)
   - v6f: **自前 CDT**(`v6f-contour-custom-cdt`、依存 `not-required`、L138-144)。edge flip・constraint recovery・long-spoke 改善の診断フィールドあり(`generate-mesh.ts:737-761`)
   - v6a: 自前 ear-clipping + 内部点での三角形分割(`mesh-generation-v6a-local.ts:636-780`、`splitTrianglesWithInteriorPoints` は包含三角形の3分割)+ 重心がマスク外の三角形を除去(L782)
   - 旧 v1: 「ordinary-delaunay-alpha-filter」(`mesh-generation.ts:382`; 中身は未読)
7. **Lloyd 緩和・refinement**: **どこにも存在しない**。品質メトリクスに `refinementIterationCount` フィールドがあるが、確認した全呼び出しで 0 固定(例: `mesh-generation-v6a-local.ts:184`, `mesh-generation.ts:380`)。

なお v6a-local(`mesh-generation-v6a-local.ts`)は contour-pipeline とほぼ同一の前段(soft mask / トレース / 等間隔サンプル)を独自に持ち、`boundarySpacing` の単位が違う(1.75〜4.25px、contour-pipeline は 10〜30px)。

## 3. メッシュデータ構造

`MeshDto`(型定義本体は `packages/package-format/src/model-files.ts` にあると推測 — 未読。使用箇所 `mesh-generation-v6a-local.ts:162-179` から構造は確定):

- `meshId`, `drawableId`
- `vertices: {x,y}[]` — ステージ座標(drawable bounds へ線形写像、`pixelPointToStagePoint` `v6a-local.ts:1194`)
- `uvs: {x,y}[]` — 0..1 に clamp(`v6a-local.ts:1204`)。**膨張でテクスチャ外に頂点を出すと UV clamp との整合が論点になる**
- `triangles: [number,number,number][]` — 頂点インデックス
- `vertexStableIds: string[]` — 頂点と同数必須(検証 `generate-mesh.ts:248-259`)。命名例 `vtx_<token>_v6a_boundary_<i>`(`v6a-local.ts:168-172`)
- `triangleStableIds` — 三角形と同数(任意? previewMesh 検証では undefined 許容 `generate-mesh.ts:261-272`)
- `topologyRevision: number`(生成時 0)
- `bounds: RectDto`, `generationProvenanceId`

**多島(複数連結成分)**: `mesh-generation-v6-alpha-islands.ts` が島検出(`detectV6RawAlphaIslands` L55)・ノイズフィルタ(`filterV6AlphaIslands` L97、閾値定数 L39-49: 2px以下は常時除去等)・島ごとの頂点予算配分(`allocateV6AlphaIslandBudgets` L150)・島別RGBA分離(L124)を提供。**これを実際に使って「valid な島をすべてメッシュ化」するのは `auto-outline-v6d-adaptive-contour-constrainautor` のみ**(`v6d-adaptive-contour-constrainautor.ts:110-135` で検出→フィルタ→単島/複島分岐、L373 で `keptIslands.map(...)` により島ごとに独立生成して1つの MeshDto に統合、`multiIslandHandling: "supported"` L490/587/753)。他のバックエンドはすべて最大成分のみ(`main-island-only`、例 `v6a-local.ts:206`、contour-pipeline L228)。島は独立サブメッシュ(頂点・三角形を連結せず1つの MeshDto 内に併置)。

**穴あきポリゴン**: 未サポート。全経路で `countHoleLikeRegions`(contour-pipeline L820)により**検出・報告のみ**(`holeHandling: "unsupported-fallback"` L229)。poly2tri 診断に `holeCount` フィールドはある(`generate-mesh.ts:726`)が、穴を制約として渡す実装は確認した範囲では存在しない(v6e/v6c 内部の未読部分に限り断定保留)。

## 4. パラメータ

**外部(operation payload)から渡るもの**(`generate-mesh.ts:116-122` で確認):

- `method: MeshGenerationMethod`(全17種、§1参照)
- `densityHint: "low" | "medium" | "high"`(省略時 "medium"、contour-pipeline L186)
- `previewMesh` + `previewProvenance`(プレビューコミット用)
- `alphaThreshold` は関数シグネチャにあるが operation 経路では渡されない(既定 8)

**内部固定値**(主要なもの):

| パラメータ | 値 | 場所 |
|---|---|---|
| alpha 閾値 | 8/255 | `v6-contour-pipeline.ts:112` |
| soft blur 閾値 | 0.18 | 同 L113 |
| 膨張上限 | 8px(既定0) | 同 L114 |
| adaptive-contour の膨張 | 2px 固定 | `v6d-adaptive-contour-constrainautor.ts:51` |
| contour-pipeline density | low: 境界30/内部15/上限64+16、medium: 15/10/96+32、high: 10/7.5/96+64、clearance 1.1〜1.5 | `v6-contour-pipeline.ts:884-911` |
| adaptive baseline | high 8/7.5(128+64)、medium 12/10(128+32)、low 30/15(64+16) | `v6d-adaptive-density.ts:13-35` |
| 面積適応 | spacingScale = clamp((1/√areaRatio)^0.35, 0.82, 1.25)、基準面積 73,936px | 同 L37-58 |
| v6a-local density | 境界1.75〜4.25 / 内部3〜7 | `v6a-local.ts:863-890` |
| 島ノイズフィルタ | ≦2px 常時除去ほか | `v6-alpha-islands.ts:39-49` |

UI(`mesh-tool-inspector.tsx`)がユーザーへどの method / density を見せているか、既定 method が何かは**未確認**。AI カタログの記述も未確認。

## 5. 差分分析(概念設計の各工程 vs 現行)

| 概念設計の工程 | 判定 | 根拠 |
|---|---|---|
| (1) 二値化+半径r膨張+平滑化(被覆保証) | **流用可**。`createSoftAlphaMask`(平滑化)と `expandMask`(膨張)は実装済み・パラメータ化済み(`maskExpansionPixels`)。差し替え点: (a) 上限8pxの緩和または解像度比例化、(b) 膨張を既定で有効にする(現在 adaptive-contour のみ2px)、(c) 「細部融解」目的なら膨張→収縮(closing)や強めのブラー半径が必要で、現行の3x3ブラーは半径固定 → **半径パラメータ化は新規** | pipeline L271-305, L480-510 |
| (2) 輪郭追跡→DP簡略化(ε<r)→間隔Lで再サンプル(高曲率密) | **輪郭追跡と等間隔再サンプルは流用可**(`traceBoundaryLoops`, `sampleBoundaryLoop`)。**DP簡略化は新規**(現行は生ピクセル輪郭を直接歩く。`simplify-js` は契約の依存一覧 `contract.ts:43-49` に既に列挙されており、v6b/v6c が使っている可能性が高い=流用候補、ただし該当ファイル未読で未確認)。**曲率適応サンプリングは新規** | pipeline L512-653 |
| (3) 疎な内部点(R≈L、境界R/2クリアランス、細長領域除外) | **半分流用可**。farthest-point 貪欲選択(L690-793)は決定的で挙動も近く、間隔Rの明示制御を足すのは小改修。**境界クリアランスを R/2 に引き上げるのはパラメータ変更のみ**(現行1.1px)。**局所幅<R の細長領域除外は新規**(距離変換の導入が必要) | pipeline L690-818 |
| (4) CDT・refinementなし・内部点のみLloyd 2〜3回 | **CDTは流用可**: v6f自前CDT / constrainautor / poly2tri の3系統が既にある。refinementなしも現状と一致。**Lloyd緩和は完全に新規**(現行どこにもない)。内部点のみ動かして再三角形分割 or flip 維持のループを足す形 | contract.ts:72-145, §2-7 |
| (5) 3プリセット(Lのみ可変、r固定導出、ε=0.8r) | **UI枠は流用可**: `MeshDensityHint` low/medium/high の3値が既に operation/API を貫通しており、「3プリセット」と1:1 対応させられる。**プリセット→(L, r, ε) の導出層は新規**(現行は density→5パラメータ表の直引き)。adaptive-density の面積比スケーリング(L37-58)は「解像度比率+クランプ」の r 導出とそのまま同型で流用可 | contract.ts:160, adaptive-density L13-60 |

総括: **骨格(マスク→輪郭→サンプル→CDT)は contour-pipeline + v6f/v6d 系がそのまま土台になる**。新規に必要なのは (a) 膨張半径 r の一級パラメータ化と適用、(b) DP簡略化(ε)、(c) 細長領域の内部点抑制、(d) Lloyd 緩和、の4点。最も近い既存 method は `auto-outline-v6d-adaptive-contour-constrainautor`(膨張2px+多島supported+面積適応密度)。

## 6. 制約・注意点(改修時に壊しやすいもの)

**直接確認済み**:

- **メッシュ差し替えは keyform/変形データを再マッピングしない**: `replaceDrawableMesh`(`mesh-mutations.ts:37-73`)は `session.graph.meshes` の該当要素を splice で置換し revision を上げるだけ。頂点数・stableId が変わっても周辺データへの追従処理はこの関数内にない。既存の変形(keyform 等)がメッシュを参照している場合の整合は上位層依存 — **上位層の挙動は未確認(推測: vertexStableId ベースの参照が切れるか、検証層が diagnostics を出す)**。
- **頂点参照は `vertexStableIds` がキー**: `moveMeshVertices`(`mesh-mutations.ts:75-175`)は vertexId→index を stableIds から引く。自動生成の stableId は `vtx_<token>_v6a_boundary_<i>` のような**生成順連番**なので、生成アルゴリズム変更で同じ見た目でも全 ID が変わる。ID 命名を変えると ID 規約([_conventions.md](../_conventions.md) §8 の machine-readable identifier 規約)にも触れる。
- **決定性が強く要求されている**: 全域にわたり tie-break 付きソート・`roundCoordinate`(1e-6 丸め)・安定始点回転など、同一入力→同一出力を保証する書き方(例 pipeline L944-957, L1140-1146)。乱数を使う素朴なポアソンディスクは不可で、**シード固定または決定的変種が必須**(現行 farthest-point 法が決定的なのはこのため、と推測)。
- **診断・provenance が契約の一部**: 生成結果は `qualityMetrics`/`fallbackSteps` を provenance `transformHistory` に文字列で焼き込む(`generate-mesh.ts:306-338`)。メトリクスのフィールド群(`v6Metrics` 等)は enum 的 ID(`algorithmId`, `triangulationMode`...)を持ち、新アルゴリズムは**新しい method ID・source ID・backend ID を契約(`mesh-generation-contract.ts`)に追加する形が既定路線**(v6a→v6f と増殖してきた構造自体がそれを示す)。既存 method の中身を黙って変えるより、新 method 追加が安全。
- **フォールバック連鎖の維持**: すべての生成は blocked 時に既存メソッド→最終 bounds-grid へ落ちる契約(`mesh-generation.ts` 全域)。新パイプラインも blocked 理由型(`MeshGenerationFallbackReason`, contract.ts:190-228)への追加が必要。
- **previewMesh 検証**: 頂点/uv/stableId の同数制約、三角形インデックス範囲・退化検査(`generate-mesh.ts:248-301`)。生成物はこの検証を通る必要がある。
- **UV clamp**: `pixelPointToUv` が 0..1 に clamp(`v6a-local.ts:1204-1211`)。膨張でテクスチャ境界を超える頂点を作る場合、bounds 外ステージ座標と clamp 済み UV の組が生じる(v6d 系 supportRing には `outerRingUvPolicy` 診断があり L652、外周リングの UV 方針という先行事例がある — 中身未確認)。
- **undo/redo**: generateMesh の結果は `reversible: true`(`generate-mesh.ts:830`)で、modelDiff に before/after のメッシュ全体を記録する(L776-815)。diff サイズ以外の構造的問題はない見込み。

**未確認(推測、追加調査が必要な範囲)**:

- レンダラ(`packages/render-software/src/raster/drawable-rasterizer.ts`)が三角形の向き(CW/CCW)や UV 範囲に置く前提。
- runtime-export(`packages/authoring-core/src/runtime-export-materialization.ts` 等)でのメッシュのシリアライズ形式・schemaVersion の有無、保存済みモデルとの互換性。
- validator-core の `mesh-topology-diagnostics` が新トポロジに課す検査(三角形品質の閾値等)。
- UI(mesh-tool-inspector)の既定 method と、density 3値以外の公開パラメータ。
- discussion/ 配下のメッシュ生成設計文書(v6 系の経緯・本命バックエンドの決定記録)。`v6-alpha-islands.ts:40` のコメント「Wave95 starts conservatively」から、多島対応は Wave95 の成果で、`discussion/implementation/orchestration/` の wave95 前後の計画文書に経緯がある可能性が高い(未読)。

## 7. 調査時の質問とその解決(2026-07-07 ユーザー合意)

調査担当からの質問2件は、以下のとおり解決済み([concept-design.md](concept-design.md) §5-6 が正):

1. 基準にする現行 method → `auto-outline-v6d-adaptive-contour-constrainautor` を**部品供給元と統合規約の土台**とする。ただし v6系の密度設計・サンプリング方針は v7 の設計参照元にしない
2. 新 method ID(v7)として追加する方針 → 承認。加えて v6/v7 の UI 切替と、v7品質確認後の v6系削除までがスコープ
