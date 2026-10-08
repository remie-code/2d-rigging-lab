# Mesh Wave 1.2 / Domain F 実装報告

> Domain id: `mesh-wave1_2-original-content-inset-uv-remap`
> 担当: Gnome（サブエージェント委任、呼び出し元 Orch-Sylph）
> 日付: 2026-07-12
> 判定: **completed**

PSDインポート直後のライブキャンバス（original 経路）で、パーツ絵柄が自バウンズ中心へ P px 縮んで見える位置ズレ（調査レポート H1）を、描画時の contentInset UV remap で解消した。パディング焼き込み・contentInset 記録は正しく、欠陥は描画側の UV 反映欠落のみ、という前提どおり、editor 側アダプタでの描画時アフィン変換のみで閉じた。

## 変更ファイル一覧（リポジトリ相対）

実装:
- `apps/editor/src/workspace/canvas/canvas-projection.ts`（contentInset + rasterDimensions を `CanvasRenderableDrawable` へ伝搬。型に optional フィールド追加。陳腐化コメント更新）
- `apps/editor/src/workspace/canvas/canvas-render-scene-adapter.ts`（content UV → padded ラスタの content 副矩形へのアフィン remap を三角メッシュ経路と bounds quad 経路に一様適用。`resolveContentUvRemap` / `applyContentUvRemap` 追加）
- `apps/editor/src/workspace/viewer/viewer-render-source.ts`（atlasRuntime remap 時に contentInset/rasterDimensions を drop。二重補正防止。詳細は Required 6）

テスト:
- `apps/editor/src/workspace/canvas/canvas-projection.test.ts`（伝搬テスト1件追加）
- `apps/editor/src/workspace/canvas/canvas-render-scene-adapter.test.ts`（remap 単体・後方互換・非クランプ・位置意味論・非対称 inset の5件追加、及び `createDrawable` ヘルパーに contentInset/rasterDimensions オプション追加）

設計文書:
- `discussion/design/mesh-rendering/boundary-transparent-margin-design.md`（§5 項目5 を最小差分改訂）

報告:
- `discussion/mesh-generation/implementation/waves/mesh-wave1.2/domain-f-report.md`（本ファイル）

## Required implementation 1〜7 の実装内容

### 1. contentInset 伝搬（canvas-projection.ts）
`CanvasRenderableDrawable` に optional フィールド `contentInset?: {left,top,right,bottom}` と `rasterDimensions?: {width,height}` を追加。drawable 構築ループで `textureEntriesById.get(...)` を一度だけ引き、`dimensions`（padded）と `contentInset`（四辺 P、source px）を読み、存在時のみ drawable へ伝搬（exactOptionalPropertyTypes 準拠のスプレッド条件付与）。`rasterDimensions` は remap の除数 paddedW/paddedH として contentInset と対で運ぶ意図。不在時（legacy / 非 PSD）は両フィールド undefined。

### 2. UV remap（canvas-render-scene-adapter.ts）
`resolveContentUvRemap(drawable)` が inset と raster から remap パラメータを算出し、`applyContentUvRemap(uv, remap)` が
```
u' = (insetLeft + u·contentW) / paddedW,  contentW = paddedW − insetLeft − insetRight
v' = (insetTop  + v·contentH) / paddedH,  contentH = paddedH − insetTop  − insetBottom
```
を適用。`createRenderMeshForDrawable`（三角メッシュ経路）の `uvs.map` と `createBoundsQuadRenderMesh`（空メッシュの bounds quad）の4隅 UV の両方に一様適用。`applyContentUvRemap` は remap 不在時に新規オブジェクトを返し、従来の `clonePoint` の役割も兼ねる（クローン不変条件を保持）。grid/輪郭メッシュは三角メッシュ経路を通るため同一式が適用される。

### 3. 非クランプ
remap はアフィン写像のみ。`Math.max/min` 等のクランプは一切入れていない。content UV が 0..1 外（被覆マージン overshoot）の頂点は padding の透明域へ線形に落ちる（A1 設計保存）。テストで u=−0.3 → 負値、u=1.3 → 1超 が保たれることを検証済み。

### 4. 後方互換
`resolveContentUvRemap` が (a) contentInset または rasterDimensions が不在、(b) 全辺 0、(c) contentW/contentH/paddedW/paddedH が 0 以下（防御）のいずれかで `undefined` を返し、UV は 0..1 のまま不変。(a) の「不在時に確実に恒等」ガードを明示実装。(b) 全辺 0 は式上も恒等だが早期 return で明示。(c) は異常データで NaN/負副矩形を出さない防御。

### 5. 陳腐化コメント更新（canvas-projection.ts の `resolveDrawableRenderDimensions`）
「`original` display may show the content offset by the padding … §5.5-de-scoped — atlasRuntime is the canonical preview」という誤記述を除去。`resolveDrawableRenderDimensions` はテクスチャ寸法を決めるだけで UV remap はしない、という事実は保持しつつ、offset は下流アダプタの contentInset remap で正される旨へ更新（設計文書 §5 参照付き）。

### 6. 有界調査（Viewer original）: **同型で閉じた（escalate 不要）**
`apps/editor/src/workspace/viewer/viewer-render-source.ts` の `createViewerRenderSourceProjection` を確認。`original` モードは `input.originalProjection`（= `createCanvasRenderProjection` の出力）を**無変換でそのまま返す**（`requestedMode === "atlasRuntime"` 以外の分岐、及び atlasRuntime unavailable フォールバックの両方で `projection: input.originalProjection`）。描画は共有 `createRenderSceneFromCanvasProjection` を通る。したがって canvas-projection / canvas-render-scene-adapter への remap 追加で Viewer original も自動的に同型で正され、**viewer 側に構造変更は不要**。

**ただし追加的な最小防御を1点実施**（Allowed scope の「同型で閉じる場合の追加的変更のみ許可」に該当）: `atlasRuntime` モードは `remapDrawableToAtlasRuntime` が content 空間 UV を placement の `uvRect`（アトラス側で contentInset を既に畳み込んだ content 副矩形）へ写す別経路。この remap 後の drawable に私が追加した `contentInset`/`rasterDimensions` が残ると、共有アダプタが atlas ページ寸法に対して**二重に** remap してしまう。これを防ぐため `remapDrawableToAtlasRuntime` の分割代入で `contentInset`/`rasterDimensions` を drop（`sourceLayerId` を drop している既存パターンと同型の1箇所変更）。`original` 経路は originalProjection を無変換で返すため両フィールドが残り、アダプタで正しく1回だけ remap される。これは構造変更ではなく回帰防止の最小防御であり escalate 事由には該当しないと判断。viewer テスト14件は緑のまま。

### 7. 設計文書改訂（boundary-transparent-margin-design.md §5 項目5）
「original は素の検査モードとして、はみ出しは端サンプルのまま残る既知の見た目とする」を、「表示上は original も content-inset UV remap（Mesh Wave 1.2 F）で内容位置を正とする。描画時に content UV 0..1 を padded ラスタの content 副矩形 `[inset, dim-inset]` へアフィン写像するため、パディング枠は見た目から消え content が bounds に整合する（アトラス `uvRect` と同型・非クランプ）。はみ出しは透明域へ落ち A1 が保存。atlasRuntime が export = runtime 一致検証の正典である地位は本 remap で不変」へ改訂。項目5内に閉じた最小差分。§9 の「解決済み Wave108」ログ末尾の非ブロッキング申し送り（"`original` の UV を content-inset で remap する等のフォローアップを検討"）は履歴ログのため scope 規律を優先して未改変（項5 のみ改訂の指示に従う）。

## Required tests の実装内容と実行結果

追加テスト（canvas-render-scene-adapter.test.ts）:
- remap 単体（三角メッシュ）: 四辺 P=4 / PADDED=28 で content UV {0,0}{1,0}{0,1} が `4/28`〜`24/28` 系へ写ること。頂点（stage 幾何）は不変。
- remap 単体（bounds quad / 空メッシュ）: 4隅 UV が同一式で content 副矩形へ写ること。
- 非対称 inset: `{left:3,top:5,right:7,bottom:9}` / raster 40×60 で各辺が独立に使われ、アトラス `contentUvRect` と同型式に一致すること。
- 後方互換: contentInset 不在 / 全辺 0 で UV が 0..1 のまま不変。
- 非クランプ: u=−0.3 → 負値、u=1.3 → 1超 が線形に保たれクランプされないこと。
- 位置意味論: P=7 / PADDED=34 / CONTENT=20、bounds quad の remap 後 content span（`(contentRightUv−contentLeftUv)·PADDED`）が bounds.width（=CONTENT）に一致することを数値アサーション（ピクセルレンダリング不使用）。

追加テスト（canvas-projection.test.ts）:
- 伝搬: contentInset/dimensions を持つ textureEntry から drawable へ `contentInset` と `rasterDimensions` が伝搬すること。legacy entry では両者 undefined。

実行コマンドと結果:
- 対象: `pnpm exec vitest run src/workspace/canvas/canvas-projection.test.ts src/workspace/canvas/canvas-render-scene-adapter.test.ts`（apps/editor cwd）→ **32 passed**（adapter 10 / projection 22）。
- 回帰（editor）: `pnpm exec vitest run src/workspace/canvas src/workspace/viewer` → **186 passed / 4 skipped**（17 files）。viewer-render-source.test.ts 14件含む緑。
- 回帰（packages, root cwd）: `pnpm exec vitest run packages/package-format/src/texture-content-inset.test.ts packages/authoring-core/src/texture-atlas-transparent-gutter.test.ts packages/authoring-core/src/texture-atlas-packing.test.ts` → **17 passed**。
- 型チェック（apps/editor）: `pnpm run typecheck` → 23 errors。**baseline（本変更適用前を git stash で確認）も同一の 23 errors**。本変更由来の新規型エラー ゼロ。私の触れたファイル内に残る型エラー（`canvas-projection.test.ts:980/987` = 既存 Wave108 テストの optional binaryAssetRef / readonly bytes パターン、`viewer-render-source.ts:136/155` = 私が触れていない `atlasRuntimeSourceCache` の exactOptionalPropertyTypes）は全て baseline から存在する既知 fail。新規追加テストは binary mutation を排し型クリーンに実装済み。
- `node scripts/check-dependencies.mjs` → **Dependency guard passed**。
- `node scripts/check-source-organization.mjs` → 違反1件 `apps/runtime-player/src/main/physiology/index.ts`。**本ドメイン対象外（runtime-player、未コミットの無関係変更領域）で baseline の既存違反。本変更由来ではない**。

判定基準「新規 fail ゼロ」を満たす。

## remap 式のアトラス側 `contentUvRect` との同型性

`packages/authoring-core/src/texture-atlas-packing.ts` `createTextureAtlasPlacement`（:531-593）の `contentUvRect` は、content 副矩形（raster placement を contentInset ぶん内側へ）を全ページ寸法で正規化し、layer-local UV 0/1 を content 端へ写す。本実装は同一形式で、per-texture の場合「アトラスページ = padded ラスタそのもの」に対応させ、
```
u' = (insetLeft + u·(paddedW − insetLeft − insetRight)) / paddedW
```
と inset を content 副矩形へ畳み込み、full 寸法で正規化する。アトラスが `contentUvRect.x = contentRect.x + inset.left`、`width = contentRect.width − inset.left − inset.right`、`uv = contentUvRect / pageWidth` とするのと同型（アトラスは別途 gutter paddingPixels があるが、per-texture 経路は raster がそのまま content+透明境界のため gutter オフセットは 0 に相当）。非対称 inset テストでアトラス式を直接再現し一致を確認済み。

## 裁量判断（設計未定義を合理的に実装した箇所）

1. **rasterDimensions フィールドの追加**: 委任は「型に optional フィールド（例 contentInset?, rasterDimensions? など）」と例示。remap の除数 paddedW/paddedH を `renderWidth/renderHeight`（round 済み）から取らず、明示的な `rasterDimensions`（textureEntry.dimensions の生値、schema 上 int positive）を対で運ぶ形にした。contentInset と同一座標系であることを型で self-consistent にするため。両者は contentInset がある PSD import 経路では常に同値（int）。
2. **viewer atlasRuntime 経路での contentInset/rasterDimensions drop**: Required 6 の二重補正防止（上記 6 参照）。escalate ではなく最小防御で閉じられると判断。
3. **恒等時の早期 return**: 全辺 0・不在・異常寸法で `undefined` を返し、`applyContentUvRemap` が恒等コピーを返す設計。全辺 0 は式上も恒等だが、パフォーマンスと明示性のため早期 return。
4. **§9 履歴ログ未改変**: 項5 のみ最小改訂の指示に厳密に従い、§9 の resolved-items ログ内の申し送り文は改変せず（scope 規律優先）。

## escalate / blocked

なし。`CanvasRenderableDrawable` への optional フィールド追加は editor ローカル型で完結し `packages/render-core` の契約（`RenderMesh` の uvSpace `layer-local-top-left-0-1-v1` 等）は不変。remap は editor アダプタ内の描画時変換で、保存メッシュ UV・アトラス側・PSD import・contract いずれも未改変。Forbidden scope への接触なし。

## ユーザー/呼び出し元への質問

1. **設計文書 §9 の申し送り文**: §9「解決済み Wave108」ログ末尾に "`original` の content ずれ … フォローアップを検討（要修正ではない）" という非ブロッキング申し送りが残っている。本 wave でそのフォローアップが実装されたため、厳密には陳腐化している。ただし scope 規律（項5 のみ改訂）を優先して未改変とした。§9 ログにも「Wave 1.2 F で解決」の1行追記が望ましいと判断される場合は、追加改訂を指示いただきたい。
2. **既存 baseline の型エラー 23件**: 本変更とは無関係だが、apps/editor の typecheck は baseline で既に 23 errors（exactOptionalPropertyTypes 系・テスト fixture 系）ある。本ドメインでは触れないが、別途 escalate 対象として認識されているか確認されたい。
