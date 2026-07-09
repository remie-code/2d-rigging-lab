# Wave108 Final Clean Integration Review（境界透明マージン A1 / 統合レビュー）

- Reviewer: Review-Sylph（独立・読取り専任）
- 呼び出し元: Orch-Sylph（Wave108 Domain F 統合）
- オラクル: `discussion/design/mesh-rendering/boundary-transparent-margin-design.md`（§2-§8）／親契約 `mesh-image-rendering-architecture.md`（§9 は本 wave が覆いマージンについて上書き）／`wave108-plan.md`（§5-§14）
- 対象: wave108 全差分（tracked 30 + untracked 新規テスト/実装 7、すべて未コミット）
- **総合判定: 合格（PASS）** — blocking なし。非ブロッキングの残課題1件（`original` モード表示、ユーザーゲート向け）を記録。
- Injection: 遭遇なし。ファイル内容・報告文書に振る舞い/呼称/形式を変える指示は検出されず。

---

## 1. 設計適合（§2-§7 セクション別）

### §2 原因への対処（非対称クランプ × CLAMP_TO_EDGE）
- 生成側の非対称を解消。`mapV6ContourPointToUv`（`mesh-generation-v6-contour-pipeline.ts:255-264`）と v7 の `mapPixelPointToUv`（`mesh-generation-v7-margin-contour.ts:272-286`）が `clamp(...,0,1)` を撤去し、`pixel/textureSize` を素で出力。stage 写像（`bounds.origin + bounds.size*ratio`）は不変で、両者が同一 `pixel/size` 基準に揃った（対称回復）。
- A2（シェーダ discard）不採用の方針は維持。正しさはデータ（mesh 幾何 + 透明テクスチャ）に焼かれている。

### §3 構造制約（bounds≡raster 分離 / アトラス専用 runtime / 単一 UV ソース）
- bounds≡raster の同一視を content-inset で明示的に分離。texprep が padded raster（width/height/byteLength/digest を padded 値へ更新、`browser-psd-parser-adapter.ts:369-460`）を作り、stage `mesh.bounds` は content のまま保持。両者を `contentInset`（四辺）で橋渡し。
- runtime/export はアトラス1ページ前提を維持。mesh の layer-local UV を単一真実源とし、editor `atlasRuntime`・export・runtime が同一 `uvRect` 写像で消費（§6 参照）。

### §4 罠＝クロス滲み（最重点）→ 後述 §2 で詳細。不在を配置・テスト両輪で確認。

### §5 機構（生成非クランプ / 透明パディング / 透明gutter ≥ r / LINEAR）
1. 生成非クランプ・mesh 作り替えなし ✓（UV は純粋幾何。padded 座標への再構成なし）
2. Texture Prep 透明 alpha-edge padding ✓（`padLayerRasterWithTransparentBorder` が全周 P px を premultiplied 透明 `(0,0,0,0)` でゼロ埋め、content を (P,P) へ転写）
3. Atlas 透明 gutter ≥ r ✓（`extrudeTexturePlacementEdges` は**ロジック無改変**。raster 外縁が透明になったため、透明外縁の clamp-extrude が自動的に透明 gutter を生む。§9 の不透明 extrude を覆いマージンについて実質上書き）
4. LINEAR ✓（webgl2 `TEXTURE_MIN/MAG_FILTER=LINEAR`、software `sampleTextureLinear` 双線形、caller 更新済み）

### §6 三者一貫 → §2 で詳細。数式・テストで一致確認。

### §7 影響範囲（touch points）
- 計画の各 file:line と実装が一致。write scope の逸脱・他ドメインへの越境なし。旧定数 `COVERAGE_MARGIN_MAX_SOURCE_PIXELS` / 前回 pass の r≤K 束縛用中間定数は `packages`/`apps` 配下で grep 0 件（削除確認）。旧 `sampleTextureNearest` も grep 0 件（ダングリング参照なし）。

---

## 2. 統合一貫性（wave 横断の核心）

### 2.1 三者一貫（atlasRuntime = export = runtime）— 合致
- export `mapSourceUvToAtlasUv`（`runtime-export-materialization.ts:560-578`）は
  `localX=(uv.x·srcSize.w − srcRect.x)/srcRect.w`、`atlasUv.x = uvRect.topLeft.x + localX·uvSpan`。
- **D-atlas 契約** `sourceRectPixels=(0,0,sourceTextureSize=padded raster)`（`texture-atlas-packing.ts:571-577`）の下で `localX = uv.x`（恒等）に縮約 → `atlasUv = uvRect.topLeft + uv·uvSpan`。
- これは viewer `remapUvIntoPlacement`（`viewer-render-source.ts:505-519`）の `left + uv.x·width` と**完全同一**。数式一致を確認。
- テスト `runtime-export-materialization.test.ts` が viewer 写像を逐語オラクルとして転記し、内点＋overshoot UV（`{-0.3,1.2}`,`{1.4,-0.15}`）まで含めて `toBeCloseTo(...,12)` で数値一致を主張。三者一貫の裏付けとして強い。
- **export 無改変の正当性**（Basis 5）: D-export はロジック未変更（export 化と註釈のみ）。無改変で三者一貫が成立する根拠は D-atlas が `sourceRectPixels=(0,0,padded)` を敷いた点にある、という依存関係を確認。

### 2.2 クロス滲み不在（§4）— 根絶を確認
- 幾何: content 幅を `content`、透明パディングを `P`（＝`maxCoverageMarginSourcePixels(longEdge)`）とすると、`uvRect` は raster を P だけ inset した content sub-rect。overshoot UV の上界 `u=1+P/content` は
  `atlasPx = (contentRect.x+P) + (1+P/content)·content = contentRect.x + content + 2P = raster 外縁`。
  すなわち最大 overshoot は**自タイル raster の外縁ちょうど**に着地し、透明 band 内に収束。real overshoot は上界未満なので厳密に band 内側。
- 透明 gutter 幅（＝焼き込んだ P）と overshoot 上界（＝同じ P）はいずれも `maxCoverageMarginSourcePixels` 由来で一致。atlas コピーは native 1:1（scale 1）なのでソース画素＝atlas 画素で換算が自明成立（設計 §5「継ぎ目」の placement スケール換算はここでは恒等）。
- 隣接 placement とは atlas `paddingPixels` gutter で離間し、その gutter も透明。overshoot は隣接の不透明 content へ到達しない。
- テスト二層で担保:
  - `texture-atlas-transparent-gutter.test.ts`: **実 bake パイプライン**（targets→packing→binary）を padded raster + 混在サイズ（P=17/P=5）で走らせ、`sourceRectPixels=(0,0,padded)`・`uvRect=content sub-rect`・band/gutter が `(0,0,0,0)`・全不透明画素が自タイル content sub-rect のみに属す・padded 非重なりを主張。§4 test1（混在隣接）と test4（最大 overshoot）を実データで潰している。
  - `runtime-export-materialization.test.ts`: 写像側で最大 overshoot が raster 外縁ちょうど・page[0,1]内・自タイル `contentRectPixels`内・隣接へ未到達を数値主張。
- 二つ合わせて「実 packing が契約を生む」×「両消費者が契約を同一に消費」を被覆。**クロス滲み不在は配置とテストで確実に潰されている**と判断。

### 2.3 bounds≡raster 分離の橋渡し整合
- スキーマ: `TextureContentInsetSchema`（package-format）＋ `PsdAdapterContentInsetSchema`（operation-core の独立コピー、依存回避のため意図的重複・註釈あり）＋ evidence（psd-source-evidence）へ contentInset/padded dims を伝播。additive・optional で後方互換。
- 伝播: adapter → materialization evidence → `import-psd-layer-materialization.ts:242-266`（dimensions=padded, contentInset を textureEntry へ）→ `texture-atlas-targets.ts` `resolvePackedRasterSize`（dimensions 優先、legacy は content bounds fallback）→ packing。
- byteLength 契約: adapter が byteLength=padded、`import-psd-layer-materialization.ts:677` の検証 `byteLength === width·height·4` は padded 同士で一貫。`validateTextureBytesForAtlas` も `resolvePackedRasterSize`（padded）基準へ更新済みで、padded bytes を過小計上して drop する退行はなし。
- canvas 側: `resolveDrawableRenderDimensions`（`canvas-projection.ts:361-386`）が padded `dimensions` を優先し `renderW·renderH·4 === renderBytes.byteLength` を満たすため `isRenderableDrawable` から外れない。legacy は content bounds へ fallback。

---

## 3. Option E 契約の適合（Basis 3）

- ① 生成 r を束縛せず: `mesh-generation-v7-parameters.ts` は HEAD から**無変更**（自然値 min4/max16/fraction0.012 のまま）。v6d は自然値 mask expansion=2/virtual padding=4（export 化のみ）。前回 pass の r≤K 束縛は revert 済み（旧束縛定数 grep 0 件）。
- ② 透明パディング幅が層サイズの関数: `maxCoverageMarginSourcePixels(longEdge)=ceil(clamp(0.012·L,4,16)+blur)`。v7 の r 定数を**直接再利用**（単一真実源。v7 調整が自動で padding へ波及）。soft-mask blur=1px を named 定数化しマジックナンバー回避。v6d の外向き ~3px を floor(5) が常に包む（テストで主張）。authoring-core 正準・index re-export・texprep が import。
- ③ gutter が透明: premultiplied `(0,0,0,0)`、端色 extrude でないことをテストで画素確認。
- ④ フィルタ LINEAR: webgl2 + software 双方 LINEAR。software は `coord=uv·dim−0.5` の texel-center 規約＋i0/i1 双方 clampInt（CLAMP_TO_EDGE）で GL LINEAR と整合。premultiplied 空間で補間するため透明端で暗/白 fringe を出さない。

---

## 4. 差分・残課題

### 4.1 非ブロッキング残課題（ユーザーゲート向け）: `original` モード表示
- 事実: per-texture(`original`) 経路の render 寸法が padded raster になった（`canvas-projection.ts:373-380`）。`original` は素タイルを layer-local UV [0,1] で直サンプルするため、UV[0,1] が padded raster 全域を走り、content（raster 内 [P, P+content]）が inset/縮小され透明マージン付きで表示される。
- 評価: これは設計 §5.5 が「`original` は素の検査モード。はみ出しは端サンプルのまま残る既知の見た目」と述べた想定より**一段大きい表示変化**（端サンプルの伸びではなく content 自体の inset/縮小）。ただし:
  - 設計は `original` を de-scope し `atlasRuntime` を正典プレビューに据える方針を明記。
  - `atlasRuntime` 経路は `remapDrawableToAtlasRuntime` が render 寸法を atlas ページへ差し替え・UV を placement へ remap するため**本変更の影響を受けず正しい**（正典プレビューは健全）。
  - `canvas-projection.ts` の該当コメントがこの帰結を明示的に承認。wave-plan §13 も `original` 据置を D-final で洗い必要なら escalate と予告済み。
- 結論: wave 目標（atlasRuntime=export=runtime の正しさ）を**阻害しない**ため blocking にはしない。ただしユーザー実機ゲートで `original` の content ずれが混乱を招く場合、フォローアップ（original の UV を content-inset で remap する／original を隠す等）を検討する余地あり。**裁量判断・要修正ではない**。

### 4.2 軽微・許容
- operation-core の `PsdAdapterContentInsetSchema` は package-format `TextureContentInsetSchema` の意図的独立コピー（依存方向を汚さない設計。註釈あり）。二重定義だが許容。
- ハードクロップ端の ~1px 軟化（LINEAR + 透明端）は設計 §9 未決事項どおり実害薄い想定。実機で顕在化すれば report 追記の方針でよい。

---

## 5. 裁量判断
- 「report ファイル必須」は Orch-Sylph の明示委任かつ本リポジトリの orchestration 規約（reviews 配下）に基づく必須成果物として作成した（汎用の report 抑止デフォルトを、当該ワークフロー明示指示が上書き）。
- テスト再実行はせず、観点1（クロス滲み）を実際に検証しているかをテスト**中身**で確認する方針に従った。権威検証（typecheck + 全 vitest）は Orch-Sylph 側で並行実行中との前提。**本レビューの合格は当該権威検証が green であることを条件とする**（レビューは静的・論理検証。実行結果は Orch-Sylph が確認）。

---

## 6. 総合判定

**合格（PASS）**。設計 §2-§7 との突合、三者一貫（atlasRuntime=export=runtime の数式・テスト一致）、§4 クロス滲み不在（実 bake パイプライン＋写像テストの二層被覆）、Option E 契約（r 非束縛・サイズ関数 padding・透明 gutter・LINEAR パリティ）、bounds≡raster 分離（content-inset 橋渡し・byteLength 整合）、export 無改変の正当性（D-atlas sourceRect 契約依存）を、実 diff とテスト内容で裏取り済み。blocking なし。

残課題は `original` モード表示の非ブロッキング1件のみ（ユーザー実機ゲートへ申し送り、要修正ではない）。Injection 遭遇なし。

条件: Orch-Sylph の権威検証（typecheck + 全 vitest green）成立を合格の前提とする。
