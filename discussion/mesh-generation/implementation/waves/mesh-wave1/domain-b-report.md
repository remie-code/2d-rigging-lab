# Mesh Wave 1 / Domain B 実装レポート: v7 コア

> Domain id: `mesh-wave1-v7-core`
> 実装担当: Gnome(Opus 4.8)。呼び出し元: Orch-Sylph(Domain B)。
> 日付: 2026-07-07

## 判定

**completed**

concept-design.md §2-4 のパイプラインを、Domain A が抽出した中立モジュール(`mesh-geometry/`)+ `delaunator` + `@kninnug/constrainautor` のみに依存する自己完結構成で新規実装した。v6系ファイルは import していない。契約に V7系統を新設分離し、ディスパッチャに v7 分岐を追加、v7 blocked 時は既存 v6d-adaptive 連鎖へ接続した。要求テスト全件 green・v6 回帰14個を含む既存全 green・typecheck pass・check:source pass。

## 新設した v7 ファイル一覧と役割

| ファイル | 役割 |
|---|---|
| `packages/authoring-core/src/mesh-generation-v7-parameters.ts` | v7 パラメータの named constants(r/ε/L 導出、細長閾値、Lloyd回数、上限)+ `deriveV7Parameters()`。全定数に根拠コメント。マジックナンバーなし |
| `packages/authoring-core/src/mesh-generation-v7-pipeline.ts` | v7 パイプライン本体(ピクセル空間、単一成分単位)。マスク→r膨張→主成分→外周輪郭追跡→DP簡略化(事前 roundCoordinate 丸め)→L再サンプル→距離変換による細長抑制付き内部点→CDT→内部点のみ Lloyd 緩和。テストプローブ `probeV7MarginContourPipelineForTest` を公開 |
| `packages/authoring-core/src/mesh-generation-v7-margin-contour.ts` | オーケストレータ。多島の valid 全島を独立サブメッシュ化して 1 MeshDto に併置、ピクセル→stage/UV 変換、v7 stableId・provenance の焼き込み。公開 `createAutoOutlineV7MarginContourMesh` |
| `packages/authoring-core/src/mesh-generation-v7-constrainautor-runtime.js` | `@kninnug/constrainautor` の default を再エクスポートする v7 所有の runtime シム(下記「裁量判断」参照) |
| `packages/authoring-core/src/mesh-generation-v7-constrainautor-runtime.d.ts` | 上記シムの型宣言 |
| `packages/authoring-core/src/mesh-generation-v7-margin-contour.test.ts` | v7 新規テスト(16件) |

## 契約への V7系統追記内容

`packages/authoring-core/src/mesh-generation-contract.ts`(V7系統の追記のみ。既存 V6/その他は不変):

- **method ID**: `V7_MESH_GENERATION_METHOD_IDS = ["auto-outline-v7-margin-contour"]`
- **source ID**: `V7_MESH_GENERATION_SOURCE_IDS = ["outline-v7-margin-contour-rgba"]`
- **backend ID**: `V7_MESH_GENERATION_BACKEND_IDS = ["v7-margin-contour"]`
- **dependency IDs**: `V7_MESH_GENERATION_DEPENDENCY_PACKAGE_IDS = ["@kninnug/constrainautor", "delaunator"]`(v6b/v6c の乖離宣言に便乗せず、実依存のみを正確に宣言)
- **型**: `V7MeshGenerationMethod`/`V7MeshGenerationSourceId`/`V7MeshGenerationBackendId`/`V7MeshGenerationDependencyPackageId`/`V7MeshGenerationCandidate`
- **candidates**: `V7_MESH_GENERATION_CANDIDATES`(V6 と同型で新設)
- **合流**: `MESH_GENERATION_METHOD_IDS` / `DRAWABLE_GENERATED_MESH_SOURCE_IDS` / `GENERATED_MESH_PREVIEW_COMMIT_METHOD_IDS` に V7 系統をスプレッド合流
- **fallback reason**: `MeshGenerationV7FallbackReason`(`v7-margin-contour-alpha-empty` / `-extraction-failed` / `-triangulation-failed` / `-generation-failed`)を新設し `MeshGenerationFallbackReason` union に合流。`MeshGenerationFallbackMethod` にも `V7MeshGenerationMethod` を合流
- **helper**: `isV7MeshGenerationMethod`(v6分岐の前に置くガード)/ `getV7MeshGenerationCandidate`

**診断ID**: 別建ての preview メトリクス経路(`model-edit.ts` の `v6Metrics` 固定枠 / `triangulationMode` enum)は**一切変更していない**(ユーザー判断「v7診断は provenance のみ」に従う)。v7 の provenance トークンは operation 層が provenance record の `transformHistory` に焼き込む `meshSource:outline-v7-margin-contour-rgba` として記録される(generate-mesh.ts:328 の既存機構)。qualityMetrics は純幾何(`computeMeshQualityMetrics(mesh, { refinementIterationCount: 0 })`)のみで、`v6Metrics`/`triangulationMode` は付与しない。

## ディスパッチャ分岐追加内容

`packages/authoring-core/src/mesh-generation.ts`(v7 分岐追加のみ。既存 v6分岐は不変):

- import に `getV7MeshGenerationCandidate`/`isV7MeshGenerationMethod` と `createAutoOutlineV7MarginContourMesh` を追加
- `createGeneratedMeshForDrawable` 内、textureBytes 解決後・**v6分岐の前**に `isV7MeshGenerationMethod(input.method)` ガードを置き `createV7MarginContourMeshResult(...)` へ委譲
- `createV7MarginContourMeshResult`: 生成成功時は `source: "outline-v7-margin-contour-rgba"` で返す。textureBytes 欠如 or v7 blocked 時は `createV7FallbackToV6Chain` 経由で既存 `createV6DAdaptiveContourConstrainautorMeshResult`(既定 v6d-adaptive)へ接続し、`fallbackSteps` の先頭に v7 ステップ(`{ method: "auto-outline-v7-margin-contour", reason }`)を差し込む

## パラメータ定数の値と根拠コメントの所在

すべて `mesh-generation-v7-parameters.ts` に named constant + 根拠コメントで定義。初期値が評価フェーズ調整の出発点である旨も同ファイル冒頭コメントに明記。

- `r = clamp(0.012 × max(texW, texH), 4px, 16px)`(全プリセット共通): `V7_MARGIN_RADIUS_TEXTURE_FRACTION=0.012` / `_MIN_PIXELS=4` / `_MAX_PIXELS=16`
- `ε = 0.8 × r`: `V7_SIMPLIFY_EPSILON_RADIUS_FRACTION=0.8`(ε<r 結合則のコメント付き)
- `L(=R)`: `V7_VERTEX_SPACING_PIXELS = { high: 12, medium: 18, low: 28 }`(high が「大きく動く」=最小=密)
- 内部点境界クリアランス R/2: `V7_INTERIOR_BOUNDARY_CLEARANCE_SPACING_FRACTION=0.5`
- 細長閾値 局所幅 < R: `V7_THIN_REGION_WIDTH_SPACING_FRACTION=1`
- Lloyd 回数: `V7_LLOYD_RELAXATION_PASSES=2`
- 上限: `V7_MAX_BOUNDARY_VERTICES=512` / `V7_MAX_INTERIOR_VERTICES=2048` / `V7_MAX_MASK_EXPANSION_PIXELS=16`(8px クランプ解除)

## 実装方針(細長抑制・多島・穴埋め・Lloyd)

- **細長領域の内部点抑制(決定的)**: 主成分マスクに対し決定的な 2 パス(前進+後退)チャンファ距離変換を計算(重み 1 / √2)。各不透明ピクセルの局所幅 ≈ 2×(背景までの距離)とみなし、`2×dist >= R`(= `dist >= R/2`)を満たす「厚い」ピクセルのみで thick マスク/成分を構成。内部点サンプリングはこの thick 成分に対してのみ実行するため、局所幅 < R の細長領域は候補ゼロ=内部点ゼロになる(feature 3)。thick 成分が空なら内部点は 0。乱数不使用・決定的。
- **多島**: `mesh-geometry/alpha-island-components.ts` の `detectRawAlphaIslands`/`filterAlphaIslands` で valid 全島を検出し、島ごとに `createAlphaIslandRgbaBytes` で分離した RGBA に対してパイプラインを実行。各島の頂点・三角形を offset して 1 MeshDto に連結併置(結合ではなく併置)。島が複数のとき stableId に `_island_<componentOrder>_` を挿入して決定的にスコープ化。単一島は同一経路(島 1 件)を通る。
- **穴埋め**: 膨張マスクの主成分について**外周ループのみ**を追跡・制約辺化する(穴ループは制約に渡さない)。三角形は「重心が境界多角形の内側」なものだけ残すため、穴の内部も三角形で充填される(§4「穴は全部埋める」)。donut fixture で穴中心ピクセルが被覆されることをテスト済み。
- **Lloyd 緩和**: 内部点のみを、その点に接する三角形の重心の平均へ移動(境界頂点固定)、毎回 CDT を再構築。2 パス。再三角形分割で内部点数が減っても破綻しないよう、各パスの CDT が失敗したらそのパスを破棄して直前結果を採用する(制約辺回復の不安定に対する保守的挙動。escalate 対象の「不安定」には至らず=下記)。

## テスト結果

すべてリポジトリルートで実行。

| 検証 | コマンド | 結果 |
|---|---|---|
| **v7 新規テスト** | `pnpm exec vitest run .../mesh-generation-v7-margin-contour.test.ts` | **16/16 passed** |
| **v6決定性回帰(核)** | `pnpm exec vitest run .../mesh-generation.test.ts` | **76/76 passed**。exact 座標 `toMatchObject` 検証の v6 決定性回帰14個が座標同一のまま全 green(baseline も 76/76・1座標の差なし) |
| authoring-core 全体 | `pnpm exec vitest run packages/authoring-core` | **276/276 passed**(baseline 260 + v7 新規 16) |
| operation層 | `pnpm exec vitest run .../operations/generate-mesh.test.ts` | **34/34 passed** |
| 型 | `pnpm run typecheck` | **pass** |
| 構成 | `pnpm run check:source` | **pass**(禁止名・1200行上限に抵触なし) |
| 依存 | `pnpm run check:deps` | **fail(既存・本ドメイン非起因)**。下記参照 |

### v7 新規テストの内訳(項目ごと)

- 契約 wiring: method/source/backend ID・`isV7`ガード・candidate 依存(1件)
- ε < r: プリセット×テクスチャサイズ全行(high/medium/low × 5サイズ)で ε<r を assert(1件)+ プリセット単調性 L(high<medium<low)・r/ε プリセット不変(1件)+ r クランプ [4,16](1件)
- **被覆保証(核)**: 全不透明ピクセルを走査し各点-三角形包含を実検査(サンプリングでない)。塗り潰し円(1件)+ 細い毛先 fixture(1件)
- 決定性: 同一入力2回で vertices/uvs/triangles/vertexStableIds/triangleStableIds 完全一致(1件)
- 細長抑制: 細長 fixture で内部点0・全頂点 boundary(1件)+ 太い領域で内部点>0(1件)
- プリセット出力単調性: 頂点数 high>medium>low(1件)
- UV範囲 [0,1] + 零面積三角形なし(全三角形 signed area ≠ 0)(1件)+ v7 stableId トークン(1件)
- 多島: 2島が独立サブメッシュ化(`_island_` スコープ)+ 両島の全不透明ピクセル被覆(stage空間、1件)
- 穴埋め: donut の穴中心が被覆される(1件)
- フォールバック: alpha空で v6d-adaptive連鎖へ・v7ステップ先頭記録(1件)+ texture欠如で `texture-bytes-unavailable`(1件)

### v6回帰14個の座標同一

`mesh-generation.test.ts` は v7 追加後も 76/76・baseline と同一。v6 決定性回帰14個は exact 座標を `toMatchObject` で検証しており、1座標でも動けば即 fail する。全 green = v6 出力が座標同一のまま(v7 は v6 ファイルを import せず自己完結のため、v6 経路に一切干渉しない)。

### check:deps の既存 fail について(事実報告・回避工作なし)

`pnpm run check:deps` は `pnpm-lock.yaml: lockfile mentions forbidden dependency class (Cubism cmo3 parser/runtime dependency)` で fail する。これは**本ドメイン非起因の既存状態**(Domain A も同一確認)。検証: (1) lockfile・package.json を一切変更していない(`git status` に両者の変更なし)。(2) 本ドメイン変更を `git stash` で退避 → 同一 fail を再現 → `git stash pop` で復元済み。回避工作(手動symlink・独自resolver等)は一切行っていない。本ドメインの gate に check:deps は含まれない(委任契約の明示どおり)。

### 参考: モノレポ横断テストの既存 fail(本ドメイン非起因、事実報告)

`pnpm exec vitest run packages/operation-core packages/validator-core packages/package-format` を回すと **12 件 fail**(rig-control / warp-lattice / tutorial-mini-model / evidence fixture 系)。これらは mesh 生成と無関係。本ドメイン変更を `git stash` した pristine baseline でも同一 fail を再現確認済み(代表3ファイルで検証)。本ドメイン起因ではない。Domain D の全体 green ゲートで別途扱う想定。

## 作成/変更ファイル一覧

新規(本ドメイン):
- `packages/authoring-core/src/mesh-generation-v7-parameters.ts`
- `packages/authoring-core/src/mesh-generation-v7-pipeline.ts`
- `packages/authoring-core/src/mesh-generation-v7-margin-contour.ts`
- `packages/authoring-core/src/mesh-generation-v7-constrainautor-runtime.js`
- `packages/authoring-core/src/mesh-generation-v7-constrainautor-runtime.d.ts`
- `packages/authoring-core/src/mesh-generation-v7-margin-contour.test.ts`
- `discussion/mesh-generation/implementation/waves/mesh-wave1/domain-b-report.md`(本レポート)

変更(本ドメイン):
- `packages/authoring-core/src/mesh-generation-contract.ts`(V7系統追記のみ)
- `packages/authoring-core/src/mesh-generation.ts`(v7 ディスパッチャ分岐追加のみ)

備考: `mesh-generation-v6-alpha-islands.ts` / `mesh-generation-v6-contour-pipeline.ts` / `mesh-outline-generation.ts` / `mesh-geometry/**` は Domain A の成果物として作業開始時点で既に working tree に存在。本ドメインでは読むのみで一切変更していない。

## 裁量判断(設計未定義を合理的に実装した箇所)

1. **v7 所有の constrainautor runtime シム**: `@kninnug/constrainautor` を直接 import すると、その `types: "Constrainautor.ts"` により tsc が未整備のライブラリソース(`strict`/`verbatimModuleSyntax` 非対応)を型検査して大量エラーになる。v6 は同一理由で `mesh-generation-v6b-constrainautor-runtime.js`(default 再エクスポートの `.js`+`.d.ts`)で隔離している。同パターンを **v7 名前空間で自前に新設**(`mesh-generation-v7-constrainautor-runtime.{js,d.ts}`)した。これは v6 ファイルの import ではなく v7 が所有するシムであり、依存は allowed の `@kninnug/constrainautor` のみ。将来 v6 一括削除時に v7 シムは独立して残る(系統分離を損なわない)。新規外部依存・lockfile 変更なし。
2. **細長判定の距離変換方式**: concept-design は「距離変換(またはそれと等価な決定的な局所幅計算)」を許容。決定的な 2 パスチャンファ距離変換(重み 1/√2)を採用し、`局所幅 ≈ 2×dist`、`dist >= R/2` を厚さ判定に用いた。設計の許容範囲内の等価実装。
3. **v7 provenance の焼き込み先**: preview スキーマ非変更の制約下で、v7 provenance を qualityMetrics ではなく provenance record の `transformHistory`(source ID 経由、既存機構)に載せる方針を採用。qualityMetrics は純幾何のみ。ユーザー判断「v7診断は provenance のみ」に整合。
4. **blocked 時のフォールバック接続先**: 「既存連鎖(v6d-adaptive 以下)へ接続」の指示に従い、既定 method の `createV6DAdaptiveContourConstrainautorMeshResult` を再利用して接続。v7 ステップを fallbackSteps 先頭に差し込み、v7 が先に試行された事実を provenance に残す。

## 質問・escalate

**escalate: なし**。concept-design §2-4 の範囲内で全分岐を実装でき、設計未定義の判断分岐に遭遇しなかった。Lloyd 再三角形分割の制約辺回復は「失敗パスを破棄して直前結果を採用」で安定しており(全 fixture で 2 パス完走)、escalate 条件の「不安定」には至らなかった。距離変換のコストも許容内(全テスト高速完了)。

**質問(呼び出し元 Orch-Sylph 経由でユーザー/L0 に確認したい点)**:

1. **Domain A 申し送りの pointKey 丸め方針**: L0 裁定どおり、DP に渡す輪郭座標を `roundCoordinate`(1e-6)で事前丸めしてから中立DP(非丸め pointKey)に渡す形で実装済み(`mesh-generation-v7-pipeline.ts` の `preRoundedLoop`)。中立DPの変更・丸め付き版新設はしていない。追加対応不要と判断したが、この解釈で問題ないか念のため確認されたい。
2. **モノレポ横断の既存12 fail**: 本ドメイン非起因(baseline 再現確認済み)だが、Domain D の全体 green ゲートに影響する。誰が是正するか(または既知の受容状態か)を wave レベルで確認されたい(Domain A の check:deps 同様の申し送り)。
