# Wave 108 Plan: Boundary Transparent Margin（輪郭メッシュ境界のにじみ根絶 / A1）

> 輪郭メッシュが drawable 境界外へ延ばした覆いマージン頂点付近で、テクスチャ端が引き伸ばされて「拡大されたようににじむ」問題を根絶する。方式は A1＝覆いマージンを**透明**で受ける。生成側の UV クランプを廃し、テクスチャ側（Texture Preparation / Atlas gutter）を透明パディングにし、フィルタを LINEAR へ戻す。正しさを描画規約でなくデータ（mesh 幾何 + texture）に焼く。追加的・置換的変更であり、既存の描画契約・保存形式の別意味論を新設しない。

## 1. Status

- Status: Planned / ready for orchestration
- Target wave: Wave108
- Wave name: `boundary-transparent-margin`
- Primary objective:
  - 生成側 UV クランプ廃止（layer-local はみ出しを許容）+ 覆いマージン r を単一幅 K に束縛
  - Texture Preparation に**透明** alpha-edge padding、Atlas gutter を**透明**化（§9 edge-extrude を覆いマージンについて上書き）+ `bounds≡raster` 同一視の分離
  - テクスチャフィルタ `NEAREST → LINEAR`（render-webgl2 + render-software パリティ、`textureFiltering="linear-v1"` 宣言と整合）
  - export 再materialize の整合（非クランプ UV が atlas 透明gutter へ入る）
  - editor `original`（per-texture）は据置き、`atlasRuntime` を正典プレビューに（= ship する絵）

## 2. Planning Gate Result

Planning Gate result: `Proceed`（inventory は調査3本で充足済み）。

- 事実調査: Sylph A（テクスチャ抽出・アトラス）/ Sylph B（export・runtime 消費）/ Sylph C（生成マージン・生成器棚卸し）で変更面を file:line 付きで確定。統合は設計文書 §3/§7 に畳み込み済み。
- ユーザー承認済み（2026-07-09）: A1 採用 / 本丸をアトラス透明gutterに / r 束縛 / LINEAR 復帰 / original は atlasRuntime を正典に / §9 上書き。
- Uncertainty: factual **low**（3調査で変更面確定）/ decision **low**（決定固定）/ cost of wrong plan **medium**（export 不可侵層に触れる。ただし決定は固定、クロス滲みの罠は §4 で明文化済み）。

## 3. Accepted Decisions / Oracles

### 3.1 設計の正（オラクル）

**[../../design/mesh-rendering/boundary-transparent-margin-design.md](../../design/mesh-rendering/boundary-transparent-margin-design.md) が唯一の正**。親契約は [../../design/mesh-rendering/mesh-image-rendering-architecture.md](../../design/mesh-rendering/mesh-image-rendering-architecture.md)（§4 Rendering Contract / §6 RenderScene Invariants「mesh UV は layer-local、atlas 物理 UV を mesh データへ混ぜない」/ §8 Texture Preparation / §9 は覆いマージンについて本 wave で上書き）。特に:

- §2 原因: 生成の非対称（stage 頂点クランプ無し / UV `clamp(pixel/size,0,1)`）× `CLAMP_TO_EDGE`。A2（シェーダ discard）は却下済み。
- §4 **罠（必達）**: UV クランプを単独で外すと per-texture では正常に見え atlas でクロス滲みする。**クランプ廃止は透明gutter確保と必ず同一 wave で統合**し、検証は `atlasRuntime` で行う。
- §5 機構: 生成 UV 非クランプ（mesh 作り替え無し）/ 透明パディングは Texture Prep・Allocation 層 / gutter ≥ K / LINEAR。

**覆いマージン幅契約（Option E: サイズ別パディング。2026-07-09 決定で「K=4 固定・r 束縛」を上書き）**:

- **生成側の r は束縛しない**（v6d ≈3px 固定 / v7 `clamp(0.012×長辺,4,16)` とも自然値。v7 の将来性・調整中を尊重）。
- **透明パディングを層サイズの関数で焼く**: `padding(layerSize) = ceil(maxOvershoot(layerSize))`。`maxOvershoot` は全方式の最大はみ出しを層サイズで包む上界式。**authoring-core が正準関数**（旧 `COVERAGE_MARGIN_MAX_SOURCE_PIXELS` 定数を `maxCoverageMarginSourcePixels(longEdgePixels)` 関数へ一般化、ソース画素単位、index re-export）。texprep が import。
- import 時（層サイズ既知）に焼く→方式非依存・再bake不要。利用前提「メッシュは生成後ほぼ不変」ゆえサイズ推定で十分。
- パディングはタイルラスタに焼き込まれ per-tile `content-inset`（D-texprep 導入の四辺形）で運ばれる。atlas は混在サイズを詰めるだけ（可変gutter専用パッキング不要）。atlas gutter は per-tile content-inset を placement スケールで換算して整合。

### 3.2 Model Allocation

Orch-Sylph・Gnome・Review-Sylph = **opus = Opus 4.8（`claude-opus-4-8`）**（`Agent` 呼び出しで `model: "opus"` 明示必須。無指定は親モデル継承の罠）。L0 = 本セッションの Undine。

## 4. Wave Strategy

```text
Batch 1（並列・相互独立。K は本 plan §3.1 が定義するため相互依存しない）:
  Domain A (D-gen):     生成 UV 非クランプ + 覆いマージン幅を maxOvershoot(size) 関数化（r 束縛せず, Option E）
  Domain B (D-texprep): 透明 alpha-edge padding 焼き込み + content-inset 伝播
  Domain D (D-render):  NEAREST → LINEAR + software パリティ
Batch 2（D-texprep 完了後）:
  Domain C (D-atlas):   透明 gutter（§9 上書き）+ bounds↔raster 分離。content-inset を消費
Batch 3（D-gen + D-atlas 完了後）:
  Domain E (D-export):  再materialize 整合（非クランプ UV → atlas 透明gutter）
Batch 4:
  Domain F (D-final):   統合 / clean review / atlasRuntime 実機検証 / map 閉栓
```

- D-atlas は D-texprep が導入する content-inset スキーマと透明パディング済みラスタに依存するため順次。
- D-export は非クランプ UV（D-gen）と透明gutter atlas（D-atlas）の双方に依存。
- 各 Orch-Sylph は SKILL.md の分離規則に従う（Orch 自身は実装しない / Gnome 実装 / Review-Sylph レビュー / ループ上限5 / ユーザー判断が要る設計漏れ検出時は早期脱出）。

## 5. Domain A: 生成 UV 非クランプ + 覆いマージン幅の関数化（`D-gen`, Option E）

Domain id: `wave108-gen-uv-unclamp`

Allowed write scope:
- `packages/authoring-core/src/mesh-generation-v6-contour-pipeline.ts`（共有 `mapV6ContourPointToUv` `:254-261` のクランプ廃止）
- `packages/authoring-core/src/mesh-generation-v6d-adaptive-contour-constrainautor.ts`（wrapper `:1036-1048`、r/padding 定数 `:51-52`）
- `packages/authoring-core/src/mesh-generation-v7-margin-contour.ts`（自前 UV `:269-276`）、`packages/authoring-core/src/mesh-generation-v7-parameters.ts`（r clamp `:163-169`）
- K の named constant 定義（生成側の単一定数。ソース画素）
- 対応テスト、Domain report / review（`discussion/implementation/waves/wave108/`, `discussion/implementation/reviews/wave108/`）

Forbidden write scope:
- テクスチャ抽出・アトラス・レンダラ・export（他 Domain）。非稼働 v6a/b/c の自前クランプは対象外（触るなら escalate）。

Required implementation:
- layer-local UV を `clamp` せず素直に出力（覆いマージンで [0,1] を少しはみ出すことを許容）。**mesh を padded 座標へ作り替えない**。
- r 束縛は**しない**（Option E）。旧定数 `COVERAGE_MARGIN_MAX_SOURCE_PIXELS`(=4) を `maxCoverageMarginSourcePixels(longEdgePixels: number): number`（≈ `ceil(clamp(0.012×longEdge,4,16)+blur)`、ソース画素、v6d ≈3px を内側に含む上界、根拠コメント付き・マジックナンバー禁止）へ一般化し `mesh-generation-coverage-margin.ts` に置き index re-export。v7 の r clamp 上限（`mesh-generation-v7-parameters.ts:163-169`）と v6d の mask expansion 束縛を**解除し自然値へ戻す**（前回 pass 分の r≤K=4 束縛を revert）。

Required tests:
- 凍結ケース `mouth_u` 相当の入力で、境界頂点の UV が**クランプされず** stage 頂点と同一 `pixel/size` 基準（[0,1] 外を含む）で出ること。
- 合致メッシュ（overshoot 無し）で UV が従来同等に留まり退行しないこと。
- v6d / v7 の外向き r が K を超えないこと。
- stage 頂点は従来どおり（非クランプ）で不変であること。

Review focus: mesh データの作り替えが無いこと。UV と stage が同一基準。K が単一定数でマジックナンバー無し。

## 6. Domain B: 透明パディング焼き込み + content-inset（`D-texprep`）

Domain id: `wave108-texprep-transparent-padding`

Allowed write scope:
- `apps/editor/src/editor-workflow/browser-psd-parser-adapter.ts`（`createLayerMaterializationEvidence` L296-372: ラスタを全周 K の透明バッファへ content offset で転写、width/height/byteLength/digest を padded 値へ更新）
- `packages/operation-core/src/operations/import-psd-layer-materialization.ts`（byteLength 検証 L651-667 を padded 整合へ、`resolveInitialBounds` L1057-1066）
- テクスチャ entry スキーマ `packages/package-format/src/texture-atlas.ts`（raster 寸法 / content-inset を持たせる）
- 対応テスト、Domain report / review

Forbidden write scope:
- 生成器・アトラス pack/bake・レンダラ・export。stage `bounds`（content）の意味論は変えない（content のまま保つ）。

Required implementation:
- layer raster の外周に**透明**（premultiplied で `(0,0,0,0)`）な K px パディングを焼く。content は inset (K,K) に置く。
- 「raster 寸法（padded）」と「content bounds（stage, 不変）」を分離し、両者を繋ぐ **content-inset** を evidence/graph 上で運ぶ新フィールドを追加。
- byteLength 契約は padded 同士で保つ。

Required tests:
- padded ラスタの外周 K px が透明（alpha=0）で、content が正しく inset されること。
- width/height/byteLength/digest が padded 値で整合すること。
- content-inset が正しく記録・伝播されること。
- stage `bounds` が content のまま（padding で動かない）こと。

Review focus: bounds≡raster の破れを content-inset で明示的に橋渡ししているか。既存 byteLength 検証を壊していないか。

## 7. Domain C: 透明 gutter + bounds↔raster 分離（`D-atlas`）

Domain id: `wave108-atlas-transparent-gutter`

Allowed write scope:
- `packages/authoring-core/src/texture-atlas-binary.ts`（`extrudeTexturePlacementEdges` `:120-163` を覆いマージンについて透明化、`copyTextureIntoPlacement` `:96-118`）
- `packages/authoring-core/src/texture-atlas-packing.ts`（padding/gutter 幅 `:137-153` を K 契約へ、placement/uvRect `:516-561`）
- `packages/authoring-core/src/texture-atlas-targets.ts`（textureSize/byteLength `:354-372` を bounds 由来から raster 由来へ）
- `apps/editor/src/workspace/viewer/viewer-render-source.ts`（`remapUvIntoPlacement` `:507-520`）
- `apps/editor/src/workspace/canvas/canvas-projection.ts`（`resolveDrawableRenderDimensions` `:354-369`、`isRenderableDrawable` `:629-640` を padded raster と content-inset で整合）
- 対応テスト、Domain report / review

Forbidden write scope: 生成器・texprep スキーマ本体・レンダラ・export の再materialize 本体（読取り可）。

Required implementation:
- atlas gutter を**透明**にし（端色 extrude を覆いマージンについて廃止）、幅を K（placement スケールで atlas 画素換算）以上に確保。
- content-inset を消費して render 寸法 / renderable 契約 / atlas target を padded raster 基準へ整合。
- layer-local はみ出し UV が placement の**透明gutter内**へ写り、隣接 placement へ到達しない配置保証（§4 クロス滲み回避）。

Required tests:
- overshoot UV（[0,1] 外）が atlas 上で透明gutter内に収まり、隣接 placement のピクセルを拾わないこと（合成2タイルで確認）。
- gutter が透明（端色複製でない）こと。
- padded raster で `isRenderableDrawable` / render 寸法が整合し描画対象から外れないこと。
- 決定性・within-page・non-overlap の維持。

Review focus: §4 の罠（クロス滲み）を配置とテストで確実に潰しているか。inter-tile ブリード防止が透明gutter幅で担保されるか。

## 8. Domain D: LINEAR 化 + software パリティ（`D-render`）

Domain id: `wave108-render-linear`

Allowed write scope:
- `packages/render-webgl2/src/webgl2-textures.ts`（`MIN_FILTER` / `MAG_FILTER` `:41-44` を `LINEAR` へ。WRAP は据置可）
- `packages/render-software/src/raster/texture-sampler.ts`（LINEAR パリティ実装）
- `packages/authoring-core/src/runtime-export-materialization.ts:626`（`textureFiltering="linear-v1"` 宣言と実装整合の確認・必要なら整備）
- 対応テスト、Domain report / review

Forbidden write scope: 生成器・texprep・atlas・export の他責務。

Required implementation:
- WebGL2 と software の双方を LINEAR に揃える（両者バイト厳密一致のパリティ規約を維持）。
- 既存の `linear-v1` 宣言と実装の食い違いを解消。

Required tests:
- webgl2 / software の LINEAR サンプリングがパリティテストで一致すること。
- 透明パディング済みテクスチャで端が premultiplied で正しく AA され、暗い fringe が出ないこと（合成テクスチャで）。
- 既存レンダラテストの無退行。

Review focus: パリティが崩れていないか。premultiplied + LINEAR + 透明端の正しさ。

## 9. Domain E: export 再materialize 整合（`D-export`）

Domain id: `wave108-export-materialize`

Allowed write scope:
- `packages/authoring-core/src/runtime-export-materialization.ts`（`mapSourceUvToAtlasUv` `:174, 552-571` が非クランプ UV を透明gutter込み atlas 座標へ写すこと）
- `packages/package-format/src/runtime-export.ts`（`atlasUvs` `:346` の範囲前提。必要なら検証追加）
- 対応テスト、Domain report / review

Forbidden write scope: 生成器・texprep・atlas bake 本体・レンダラ（読取り可）。

Required implementation:
- 非クランプ layer-local UV が export の atlas 座標へ正しく写り、透明gutter内に収まること。
- editor `atlasRuntime` と export/runtime が同一 UV 意味論で一致すること。

Required tests:
- 凍結 `mouth_u` 相当を export し、materialize 済み UV が atlas 透明gutter内へ収まること（隣接侵入なし）。
- editor atlasRuntime 写像（`remapUvIntoPlacement`）と export 写像（`mapSourceUvToAtlasUv`）の一致（sourceRect 全域前提の数式一致）。

Review focus: 三者一貫（atlasRuntime = export = runtime）。範囲外 UV を弾く/受ける方針が一貫しているか。

## 10. Domain F: Final Integration / Clean Review / Map Closeout（`D-final`）

Domain id: `wave108-final-integration`

- モノレポ全体 tsc + 全テストスイート green。
- クリーンレビュー（設計 §2〜§8 と実装の突合、Review-Sylph 独立）。§4 クロス滲みの不在を重点確認。
- 設計文書 Status 更新 / `design/mesh-rendering/_map.md`・`texture-atlas/_map.md`・`mesh-generation/_map.md` 閉栓 / wave final report（`discussion/implementation/waves/wave108/`）。
- **実機確認はユーザー gate（wave 外）**: 凍結 `mouth_u` を editor `atlasRuntime` モードで開き、境界の拡大にじみが消え・覆いマージンが透明・クロス滲み無し・LINEAR の端 AA が自然、を目視。

## 11. Handling Rules

- `.claude/skills/implementation-orchestration/SKILL.md` の規則に従う（役割/呼び出し元の散文明示 / 実装は Gnome / レビューは Review-Sylph / 在席ポーリングで子を待つ / model 明示 / 孤児を残さない / ループ上限5 / 早期脱出＝ユーザー判断が要る設計漏れ検出時）。
- 各 Orch-Sylph はレビュー合格後に完了報告（作成/変更ファイル・テスト結果・レビューレポートパスを含める）。
- 設計文書に無い判断分岐は実装で埋めず escalate（L0 が裁定して設計文書を改訂）。

## 12. Verification Plan

Minimum focused verification:
- `pnpm.cmd exec vitest run packages/authoring-core/src`
- `pnpm.cmd exec vitest run packages/render-webgl2/src packages/render-software/src`
- `pnpm.cmd exec vitest run apps/editor/src`
- `pnpm.cmd typecheck`

Preferred final verification:
- `pnpm.cmd test:standard`
- `pnpm.cmd build`

環境都合で preferred を省く場合、final report にスキップしたコマンドと理由を明記する。

## 13. Residual Risks

- **座標系の単一真実源**: 生成側 `maxCoverageMarginSourcePixels`（ソース画素）と atlas gutter（出力画素）の換算は、D-atlas が per-tile content-inset を placement スケールで行う。
- **v7 品質**: Option E 採用により r を束縛せず、パディングを層サイズで v7 の r を包むため、v7 の覆いマージン品質は維持される（劣化懸念は解消）。`maxOvershoot` 式が将来の v7 調整で不足する場合のみ式を更新する。
- **ハードクロップ端**: 不透明が raster 端まで詰まった稀タイルは透明gutter + LINEAR で ~1px 軟化し得る。現状タイルは有機的 alpha 端が主で実害薄い想定。目立てば report に記録。
- **`Math.round` 整合**: bounds≡raster 分離で各所の丸めが波及。D-texprep / D-atlas で padded raster 基準へ整合させ、残差は report に記録。
- **original プレビュー据置**: `original` モードは overshoot 端サンプルのまま。`atlasRuntime` を正典に据える UX 変更が要るか（editor 既定プレビューの確認）は D-final で洗い、必要なら escalate。

## 14. Completion Criteria

Wave 108 is complete when:
- 生成器が UV をクランプせず、覆いマージン幅が `maxCoverageMarginSourcePixels(size)` 関数として authoring-core に置かれる（r 束縛なし）。
- テクスチャ（Texture Prep + Atlas gutter）が覆いマージンを透明で受け、bounds≡raster 分離が content-inset で橋渡しされる。
- render-webgl2 / render-software が LINEAR でパリティ一致。
- export 再materialize で非クランプ UV が atlas 透明gutter内へ収まり、atlasRuntime = export = runtime が一致。
- 全 focused テスト + typecheck green。clean review が blocking を出さない、または全て解消。
- final report が検証証跡と残存リスク（K 値・v7 判断・original 据置）を記録。
- 実機 atlasRuntime 目視はユーザー gate として wave 外に残す。
