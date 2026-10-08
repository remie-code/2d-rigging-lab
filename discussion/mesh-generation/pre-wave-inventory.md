# メッシュ生成 v7改修 実装wave前 インベントリ調査

> Status: Recorded(2026-07-07)
> 調査担当: Sylph。本文書は**リポジトリ事実**の記録である。確認できなかった箇所は「未確認(推測)」と明示しており、それらは仮説として扱うこと。
> 目的: [current-implementation-survey.md](current-implementation-survey.md) §6「未確認」に残った、計画の書き込みスコープ・制約に直接効く7項目を file:line 付きで確定する。
> 設計の正は [concept-design.md](concept-design.md)。パスはリポジトリルート相対。

---

## 1. UI面(method選択肢・既定method・densityHint露出・公開パラメータ)

**結論: UI は method を一切露出していない。3プリセットのみを露出し、method は単一定数にハードコードされている。**

- **3プリセットは既に存在**: `MESH_GENERATION_PRESETS`(`apps/editor/src/features/editor-session/model/mesh-tool-state.ts:48-67`)が `largeMotion`(Large Motion / densityHint `high`)・`standard`(Standard / `medium`)・`lowMotion`(Low Motion / `low`)の3つ。既定プリセットは `standard`(`mesh-tool-state.ts:69`、UIの初期state も `mesh-tool-inspector.tsx:52` で `"standard"`)。concept-design §2.5 の3プリセット「大きく動く/標準/あまり動かない」と**1:1で対応する枠が既にある**。
- **UI が見せるのはプリセットのラベルとsummaryのみ**: `mesh-tool-inspector.tsx:243-260` が `MESH_GENERATION_PRESETS` をボタン列で描画。プリセット選択 → `previewPreset`(L173-179) → `previewMeshDraft`(L161)。method 選択のUI要素は**存在しない**。
- **method はハードコード**: `DEFAULT_MESH_GENERATION_METHOD = "auto-outline-v6d-adaptive-contour-constrainautor"`(`mesh-tool-state.ts:70-71`)。プレビュー生成 `createMeshToolDraft` は method に**この定数を直に渡す**(`editor-session-context.tsx:2686,2688,2695,2708,2722`)。preset は densityHint に変換されるのみで、method には一切影響しない(`editor-session-context.tsx:2689` で `densityHint: preset.densityHint`)。
- **densityHint の露出**: densityHint はユーザーに数値/enumとして露出されず、プリセット選択に**内包**されている。preset→densityHint 変換は `getMeshGenerationPreset`(`mesh-tool-state.ts:73-76`)経由で `preset.densityHint` を読むのみ。
- **その他の公開パラメータ**: なし。UI からは preset 以外に L・r・ε・alphaThreshold 等を触る導線がない。`commitGenerateMesh`(`editor-session-commands.ts:284-302`)の payload は `drawableId / method / densityHint / previewMesh / previewProvenance` のみで、method と densityHint の実値は上記のとおりUIから固定 or preset由来。
- **provenance ID への method 焼き込み**: `createMeshPreviewProvenanceId`(`mesh-tool-state.ts:78-85`)は method が既定と異なるときだけ ID に method トークンを付ける(`formatMethodProvenanceSuffix` L230-231)。現状は常に既定なので suffix は空。v7 を既定にしない切替では ID に v7 トークンが乗る。

**v7 + 3プリセット追加時の変更面**:
- 3プリセット自体は**新設不要**(既存)。concept-design §2.5 が「プリセットが動かすのは L(=R) だけ」とするが、現状 preset は densityHint(low/medium/high)にしか写像していない。v7 のプリセット→(L, r, ε)導出層は **v7バックエンド側**(densityHint を受けて内部でL/r/ε算出)に置くのが既存構造と整合。
- **v6/v7 の UI 切替は現状未実装**。concept-design §5.2「v6/v7 は UI 上で切り替え可能」を満たすには、`mesh-tool-inspector.tsx` に method(または v6/v7)選択UIを新設し、ハードコードされた `DEFAULT_MESH_GENERATION_METHOD`(`mesh-tool-state.ts:70-71`, `editor-session-context.tsx` の5箇所)を可変化する必要がある。**これは新規の書き込みスコープ**。

---

## 2. レンダラ前提(winding・UV clamp・bounds外頂点)

**結論: マージン付きメッシュ(元シルエットより外側の頂点)を壊すレンダラ前提は無い。安全。**

- **winding order**: ソフトウェアラスタライザは三角形を**CCWに正規化する**(`packages/render-software/src/raster/triangle-rasterizer.ts:80-92`、`area2 < 0` なら v1/v2 スワップ)。バックフェースカリングは software・WebGL2(`webgl2-renderer.ts`, `webgl2-shaders.ts`)ともに**無し**(`CULL_FACE` 設定なし)。→ v7 が出す三角形の向きは問わない。ただし software と WebGL2 の一致性のため元の頂点順は保持するのが無難(推測)。
- **UV clamp**: `texture-sampler.ts` が **CLAMP_TO_EDGE** を実装(`sampleTextureNearest` L86-105、範囲外UVを `clampInt` L58-66 で縁テクセルに丸める。テスト `texture-sampler.test.ts:51-58`)。UV空間は "layer-local-top-left-0-1-v1"(コメント L79-84)。WebGL2 側はGPUデフォルトの CLAMP_TO_EDGE 依存(`webgl2-shaders.ts:45` の `texture(u_texture, v_uv)`)。→ マージン領域の頂点UVが 0..1 にクランプ済みなら、テクスチャの縁色を引く(=Live2Dの膨張メッシュと同じ想定挙動)。
- **bounds外頂点**: drawable bounds によるチェック・弾き・クランプは**無い**。三角形頂点は無制限に image 座標へ変換され、スキャン範囲だけが framebuffer にクリップされる(`triangle-rasterizer.ts:98-111`、startX/endX/startY/endY を `max(0,...)`/`min(width-1,...)` で制限)。out-of-range 頂点は削除されず barycentric 補間に使われる。→ 膨張でシルエット外・キャンバス外に出た頂点も描画可能。
- **メッシュ妥当性**: 三角形index が `[0, min(vertices.length, uvs.length))` の範囲内であることのみチェック(`drawable-rasterizer.ts:40,62-71`)。範囲外indexの三角形はskip。→ v7が同数の vertices/uvs と有効indexを出せば通る。

**含意**: レンダラは v7 の設計前提(元絵より外側にマージン頂点+UVは0..1クランプ)を**そのまま許容する**。追加のレンダラ改修は不要。唯一の注意は「UVを必ず 0..1 にクランプしてから頂点に載せる」こと(既存 v6a の `pixelPointToUv` clamp と同じ規約を踏襲すればよい)。

---

## 3. エクスポート面(MeshDtoシリアライズ・schemaVersion・保存互換)

**結論: 新method ID追加は export/保存形式に破壊的変更をもたらさない。method ID はメッシュに焼き込まれない。**

- **MeshDto の形式**: `packages/package-format/src/model-files.ts:55-68`(`MeshSchema`)。フィールドは `meshId / drawableId / vertices(Vec2[]) / uvs(Vec2[]) / triangles / vertexStableIds / triangleStableIds(optional) / topologyRevision(optional) / bounds / generationProvenanceId(必須)`。**method ID・source ID・algorithmId は MeshDto に含まれない**。
- **schemaVersion**: メッシュファイル `meshes.json` は `schemaVersion: z.literal("meshes-file-v1")`(`model-files.ts:329`、`MeshesFileSchema`)。runtime export モデルは `schemaVersion: "runtime-export-model-v0"`(`runtime-export-materialization.ts:190`)。**バージョンはファイルレベルのみ**で、メッシュオブジェクト自体にバージョンフィールドは無い。→ 新method追加で `meshes-file-v1` を上げる必要はない。
- **runtime export でのメッシュ変換**: `runtime-export-materialization.ts:162-187`。頂点/uvを `atlasUvs` に変換して出力。`generationProvenanceId` は export 出力に**含まれない**(生成オブジェクトに無い)。
- **どのアルゴリズムで生成したか**は MeshDto ではなく **provenance record の transformHistory** に文字列で記録される(`generate-mesh.ts:326-337`、`generateMesh:${method}` 等)。これはメッシュ本体とは別のデータ。
- **保存済みモデル読込時の method バリデーション**: `MeshesFileSchema` は `z.array(MeshSchema)` のみで method を検証しない(`model-files.ts:328-332`)。→ **未知method IDでも既存 .model の読込は失敗しない**。method enum で弾かれるのは **generateMesh operation 実行時のみ**(次項)。

**含意**: v7 の export/保存互換リスクは無い。書き込みスコープは「保存形式」には及ばない。

---

## 4. validator面(細長三角形・退化・アスペクト比の検査)

**結論(計画上最重要): validator に「細長三角形/アスペクト比/最小角」を弾く・警告する検査は存在しない。v7の意図的な細長三角形はblockされない。**

- **メッシュ検査の実体**: `packages/validator-core/src/validators/mesh-semantics.ts`(`validateMeshTriangles`)。検査項目(severity付き):
  - `mesh.triangleIndexOutOfRange`(index範囲外、L141-150) → **blocking**
  - `mesh.degenerateTriangle`(L154-157, 判定関数 L214-230) → **warning**。判定は **`repeated-index`(`new Set(triangle).size < 3`)** と **`zero-area`(`signedDoubleArea === 0`)** の**2種のみ**。細長さは見ない
  - `mesh.duplicateTriangle`(同一頂点トリプレット、L159-166) → **error**
  - `mesh.orphanedVertex`(未参照頂点、L169,186-193) → **error**
  - `mesh.vertexStableIdsLengthMismatch`(L116-117) / `mesh.uvCountMismatch`(L120-121) / `mesh.triangleStableIdsLengthMismatch`(L125-128) → **error**
  - `mesh.uvCoordinateOutOfBounds`(**UVが[0,1]外**、L174-183、`x<0||x>1||y<0||y>1`) → **error**
  - `mesh.runtimeEvidenceMissing`(L233-249) / `mesh.runtimeEvidenceMismatch`(L353-380) → **error**
- **細長三角形(sliver/high aspect ratio/最小角)検査**: **存在しない**。`degenerateTriangle` は零面積のみトリガ(L230)。最小角・アスペクト比・高さ閾値の検査は validator-core に無い。`minAngleDegrees`(`generate-mesh.ts:373`)は**品質メトリクス記録用**でありバリデーション検査ではない。
- **winding検査**: **無し**。signed double area を計算するが(L226-228)符号判定(CCW/CW)はしない。
- **検証経路**: generateMesh operation(`generate-mesh.ts`)の previewMesh 検証(L248-301)は **repeated-index のみ**でzero-area検査すら**していない**。validator-core の `validateMeshSemantics` は **operation とは別**の経路(`package-runtime.ts:254`、`validatePackageRuntime` → `collectPackageReferenceChecks`)で走る。previewMesh検証(operation内)と mesh-semantics検証(validator)は別物。

**計画上の重要含意(要注意点、ただしblockではない)**:
- v7が「毛先を少数の細長い三角形で覆う」設計を出しても、**現状のvalidatorはそれをerror/warningにしない**(細長さ検査が無いため)。→ **v7計画側で追加対処は原則不要**。閾値との衝突は起きない。
- ただし**2つの隣接制約に注意**: (a) `mesh.uvCoordinateOutOfBounds` が **UV[0,1]外をerror扱い**(L174-183)。膨張マージン頂点のUVは**必ず0..1にクランプ**しないと validator error になる(レンダラの clamp とは別に、validator が明示errorを出す)。(b) `zero-area` 三角形は warning になる。極端に潰れた(数値的に面積0の)三角形をv7が出さないよう、細長でも非零面積を保つ必要がある。
- **(推測)** これらは v7 の設計と本質的に矛盾しない。concept-design §3の内部点除外則(境界R/2クリアランス)が潰れ三角形を防ぐ意図と整合し、UVクランプは既存規約踏襲で満たせる。

---

## 5. 簡略化ライブラリ(simplify-js の実使用と v7 流用可否)

**結論(訂正済み・自分で直接検証): simplify-js は authoring-core のどこからも import/呼び出しされていない未使用の依存宣言。実態のDP簡略化は自前実装(v1〜v4)であり、v6はDPを使わず等間隔サンプルのみ。v7 は自前DP関数の流用が第一候補、simplify-js導入は任意。**

- **simplify-js の import は0件(自分でGrep確認)**: `packages/authoring-core/src` 全体で `import ... "simplify-js"` / `require("simplify-js")` / `simplify(` の実呼び出しは**存在しない**。ヒットするのは依存**宣言**のみ — `mesh-generation-contract.ts:48`(`V6_MESH_GENERATION_DEPENDENCY_PACKAGE_IDS`)、同 `:86`(v6b候補)、`:94`(v6c候補)、および `mesh-generation.test.ts:1119,1135,1143`(契約検証テスト)。**当初のサブエージェント報告が「mesh-outline-v2-generation.ts:9 で import」としたのは誤りで、自分で再検証し否定した。**
- **契約と実装の乖離が確定**: contract で v6b/v6c が `dependencyPackageIds` に `simplify-js` を宣言しているが(`mesh-generation-contract.ts:86,94`)、v6b/v6c バックエンドも v6共通 contour-pipeline も simplify を**呼んでいない**。設計計画段階の宣言が実装に反映されなかった名残(設計文書 `discussion/design/mesh-generation/auto-outline-v6-library-candidate-inventory.md` に「d3-contour → simplify-js → …」の計画記述あり=**推測補強**)。
- **実態のDP簡略化は自前実装**(v1〜v4世代): `mesh-outline-generation.ts:415-443` の `simplifyOpenPolyline`(再帰的Douglas-Peucker、`epsilon` を tolerance として受け `{x,y}[]`→`{x,y}[]`)+ `mesh-outline-generation.ts:348-385` の `simplifyContourLoop`(閉ループ用ラッパー、凹点保護付き、`config.simplifyEpsilon` 使用、L113で各ループに適用)。同型の `simplifyContourLoop` が `mesh-outline-v2-5-soft-boundary-generation.ts:484-`、`mesh-outline-v3-envelope-generation.ts:481-` にもある。これらは決定的(再帰的最大距離選択、乱数なし)。
- **v6系はDP不使用**: v6共通 `mesh-generation-v6-contour-pipeline.ts:621-653`(`sampleBoundaryLoop`)は **周長÷boundarySpacing の等間隔再サンプル**のみで、DPを通さず生ピクセル輪郭を直接歩く。v6d/e/f も DP なし。

**含意**: v7 の Douglas-Peucker 輪郭簡略化は選択肢が2つ。(A) **既存の自前DP `simplifyOpenPolyline`/`simplifyContourLoop`(mesh-outline-generation.ts:348-443)を中立部品として抽出・流用**する — 決定的で `epsilon=tolerance` の形が `ε=0.8r` 設計と直結し、外部依存を増やさない。**第一候補**。(B) simplify-js を実際に導入する — 既に package.json 依存済み(`packages/authoring-core/package.json`)だが**未使用のため実績ゼロ**、決定性は simplify-js 自体は純幾何で決定的だが導入検証が要る。**(A)を推奨**。どちらでも v7 candidate の `dependencyPackageIds` は正確に(自前DPなら空 or simplify-js なしで)宣言し、既存 v6b/v6c の乖離宣言に便乗しないこと。

---

## 6. AI面(ai-codex-proposal-operation-catalog の generateMesh 記述)

**結論: AIカタログは method 一覧を列挙していない。ゆえに v7 追加でカタログ本体の method 列挙更新は不要。ただし AI は method を必須入力として指定する経路がある。**

- **記述箇所**: `packages/ai-interface/src/ai-codex-proposal-operation-catalog.ts:358-365`。`operationType: "generateMesh"`, `payloadSchemaRef: "operation.generateMesh.payload.v1"`, `requiredInputs: codexInputs(..., ["drawableId", "method"])`。**method は required input だが、候補一覧の列挙は無い**(payloadSchemaRef 経由でschemaを参照)。`densityHint` の記述も無し(optional のため)。
- **method の実 enum 定義元**: `mesh-generation-contract.ts:147-157`(`MESH_GENERATION_METHOD_IDS`、17種)を単一の真実源として、`packages/operation-core/src/payloads/model-edit.ts:337`(`GenerateMeshPayloadSchema.method: z.enum(MESH_GENERATION_METHOD_IDS)`)が参照。→ **contract に v7 IDを足せば operation schema は自動で追随**。
- **preview commit 経路の追加スキーマ制約(重要)**: preview経路(UIが使う経路)の qualityMetrics は `model-edit.ts:307-320`(`PreviewMeshQualityMetricsShapeSchema`)で検証。うち `v6Metrics`(L319,274-305, `PreviewMeshV6MetricsShapeSchema`)は `algorithmId: z.literal("auto-outline-v6-alpha-constrained-delaunay")`(L275)・`methodId: z.enum(V6_MESH_GENERATION_METHOD_IDS)`(L276)・`backendId: z.enum(V6_MESH_GENERATION_BACKEND_IDS)`(L277)に固定。**v6Metrics 自体は optional**(L319)なので、v7が独自の algorithmId/diagnostics を持つなら v6Metrics フィールドを使わず回避できるが、UIの診断カード(`mesh-tool-inspector.tsx:545-572,675-682`)が v6Metrics.multiIslandDiagnostics 前提で組まれているため、v7 が多島診断をUIに出すなら **v6Metrics スキーマの拡張 or v7専用メトリクス経路の新設が必要**。

**v7 method 追加時に触る面(最小集合)**:
- `packages/authoring-core/src/mesh-generation-contract.ts`: `V6_...METHOD_IDS`/`SOURCE_IDS`/`BACKEND_IDS`(v7を独立系にするなら `V7_...` 系を新設)、`MESH_GENERATION_METHOD_IDS` への合流、`DRAWABLE_GENERATED_MESH_SOURCE_IDS`(L162-172)への source 追加、`GENERATED_MESH_PREVIEW_COMMIT_METHOD_IDS`(L176-185)への追加、fallback reason型(L190-228)への追加。
- `packages/authoring-core/src/mesh-generation.ts`: ディスパッチャ(L141-240)に v7 分岐。
- `packages/operation-core/src/payloads/model-edit.ts`: method enum は自動追随。preview qualityMetrics に v7 用メトリクスを通すなら L274-320 の拡張。
- `ai-codex-proposal-operation-catalog.ts`: **更新不要**(method列挙なし)。

---

## 7. 既存テストの地形(所在・規模・v6決定性回帰テストの有無)

**結論: v6の「決定的出力」回帰テストが14個既存。ただしバイト同一ではなく exact vertex/triangle 座標を `toMatchObject` で検証する形式。v6無傷回帰の土台は整っている。**

- **主テストファイル**:
  - `packages/authoring-core/src/mesh-generation.test.ts`(約5519行)— v1〜v6f 全アルゴリズムの詳細テスト。**"deterministic" 出力テストが14個**。
  - `packages/authoring-core/src/mesh-generation-v6f-custom-cdt.test.ts`(約458行)— v6f 専用。
  - `packages/authoring-core/src/mesh-generation-v6e-contour-poly2tri.test.ts`(約356行)— v6e 専用。
  - `packages/operation-core/src/operations/generate-mesh.test.ts`(約1805行)— generateMesh operation handler(ディスパッチ層)。L38 に auto-grid-v1 の "deterministic vertices and triangles" テスト。
  - contour-pipeline 専用テストファイルは無く、`mesh-generation.test.ts` 内に統合(L1209+ の v6 テスト群)。
- **決定性回帰テストの実体(mesh-generation.test.ts)**: v2/v2.5/v2.6/v3/v4/v6a/v6b/v6c/v6d 各系に "generates deterministic ... meshes" テストがある(L135, 232(regression), 264, 399, 525, 632, 758, 1209, 1327, 1444, 1513, 1909, 2771, 3407)。
- **検証形式**: `toMatchSnapshot()` は**不使用**。代わりに **exact な vertex/triangle index/座標を `toMatchObject` で直接アサート**。→ 「バイト同一」ではないが「構造・座標同一」を保証する回帰網。v7追加でv6のこれらテストが1つでも壊れれば v6 が変わったことを検知できる。

**含意**: concept-design §5.4 が要求する「v7実装後にv6を無傷に保つ」の検証は、**既存14テストが自然に果たす**。v7 が v6系ファイルを import しない自己完結構成(§5.3)であり、中立部品抽出時に v6 の出力が1バイトも(=1座標も)変わらないことを、これらテストの全パスで担保できる。中立部品抽出(輪郭追跡・多島検出・expandMask・CDT)を v6 から切り出す際は、**抽出後に mesh-generation.test.ts 全パス**を必須ゲートに置くべき。

---

## 計画への含意(まとめ)

| # | 事実 | v7 wave計画への効き方 |
|---|---|---|
| 1 | UIは3プリセット既存・method完全ハードコード・v6/v7切替UI未実装 | 3プリセット枠は**流用**。だが concept-design §5.2 の「UI切替」は**新規書き込みスコープ**。`DEFAULT_MESH_GENERATION_METHOD`(mesh-tool-state.ts:70-71 + context 5箇所)の可変化が必要 |
| 2 | レンダラはマージン付き・bounds外頂点・0..1外UV(clamp)を許容。winding不問 | レンダラ改修**不要**。制約は「UVを0..1にクランプして頂点に載せる」既存規約の踏襲のみ |
| 3 | export/保存にmethod IDは焼き込まれない。schemaVersionはファイル単位 | export/保存互換リスク**無し**。書き込みスコープ外 |
| 4 | validatorに細長三角形/アスペクト比/最小角検査は**無い** | v7の意図的細長三角形は**blockされない**→計画上の追加対処不要。ただし **UV[0,1]外は validator error**(mesh-semantics.ts:174-183)、zero-areaはwarning→ **UVクランプ徹底と非零面積維持**が制約 |
| 5 | simplify-jsは**未使用の依存宣言**。実態のDPは自前実装(mesh-outline-generation.ts:348-443、決定的)、v6はDP無し等間隔サンプル | v7のDP簡略化は**既存自前DP関数の中立部品化・流用が第一候補**(εと直結・外部依存増やさない)。simplify-js導入は任意 |
| 6 | AIカタログはmethod列挙せず(更新不要)。method enumはcontract単一源。preview qualityMetricsのv6Metricsスキーマは固定 | v7追加の触る面は contract + dispatcher が最小。**preview経路でv7診断をUIに出すなら qualityMetrics/v6Metrics スキーマ拡張が必要**(v6Metrics optionalで回避も可) |
| 7 | v6決定性回帰テスト14個既存(座標同一検証、非スナップショット) | 「v6無傷」の回帰網は**既存**。中立部品抽出後に mesh-generation.test.ts 全パスを必須ゲートに |

**計画立案者への質問(ユーザー判断が要る点)**:

1. **v6/v7 UI切替の粒度**: 「method選択ドロップダウン(全method露出)」か「v6/v7トグル(2値)」か「プリセット×世代の2軸」か。concept-design §5.2は「切替可能」とのみ規定。現状UIはmethod非露出なので、露出の設計判断が新規に要る。**評価フェーズ限定の隠しトグルで足りるのか、恒常UIにするのか**も未決。
2. **v7 の qualityMetrics 経路**: v7の診断(多島・輪郭・簡略化統計)を UI 診断カードに出すか。出すなら preview qualityMetrics スキーマ(model-edit.ts:274-320)の拡張が要る。出さない(provenanceの文字列記録のみ)なら v6Metrics を使わず回避でき、スキーマ変更を避けられる。**どちらを取るか**が UI/契約の書き込みスコープを左右する。
3. **v7 の method ID 系統名**: concept-design §5.3「v7はv6系ファイルをimportしない自己完結」に沿うなら、contract の定数群を `V6_...` に相乗りさせず `V7_...` 系(METHOD_IDS/SOURCE_IDS/BACKEND_IDS)として新設すべきか。将来のv6一括削除(§5.4)を機械的作業にする観点でも、系統分離が望ましいと思われるが、命名規約の確定はユーザー判断。
