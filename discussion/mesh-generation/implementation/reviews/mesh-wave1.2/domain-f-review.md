# Mesh Wave 1.2 / Domain F レビュー

> Domain id: `mesh-wave1_2-original-content-inset-uv-remap`
> レビュー担当: Review-Sylph（サブエージェント委任、呼び出し元 Orch-Sylph）
> 日付: 2026-07-12
> 判定: **合格**

PSDインポート直後の original ライブキャンバスで content が padding ぶん内側にズレる位置ズレ（調査レポート H1）を、editor アダプタの描画時 content-inset UV remap で解消する実装。実差分・実テストを自分で確認し、計画・調査レポート・アトラス側 remap 式との突合を行った。要修正なし。

## 観点別適合状況（根拠は実差分・実テスト結果）

### 1. 計画・調査レポートとの突合（Required 1〜7）
- **(1) 伝搬**: `canvas-projection.ts` で `textureEntry` を一度引き `dimensions`(padded) と `contentInset` を読み、exactOptionalPropertyTypes 準拠の条件付きスプレッドで `CanvasRenderableDrawable` へ `contentInset` / `rasterDimensions` を伝搬。不在時 undefined。適合。
- **(2) 一様 remap**: `canvas-render-scene-adapter.ts` の三角メッシュ経路（`createRenderMeshForDrawable` の `uvs.map`）と bounds quad 経路（`createBoundsQuadRenderMesh` の4隅）双方に `applyContentUvRemap` を適用。grid/輪郭メッシュは三角メッシュ経路を通るため同式適用。適合。
- (3) 非クランプ / (4) 後方互換 / (5) 陳腐化コメント / (6) Viewer original / (7) 設計文書 は下記個別観点参照。全て適合。

### 2. アトラス側 `contentUvRect` との同型性（重点）
`texture-atlas-packing.ts:553-588` を実確認。アトラスは `contentUvRect.x = contentRect.x + inset.left`（`contentRect.x = paddedRect.x + paddingPixels`）、`width = contentRect.width − inset.left − inset.right`、`uv = contentUvRect / pageWidth`。layer-local UV 0/1 を content 端へ写す。
adapter の `applyContentUvRemap`: `u' = (insetLeft + u·contentW)/paddedW`, `contentW = paddedW − insetLeft − insetRight`。
- u=0 → `insetLeft/paddedW`（= アトラス topLeft.u、per-texture で paddingPixels=0・pageWidth=paddedW）
- u=1 → `(insetLeft+contentW)/paddedW`（= アトラス bottomRight.u）
除数は padded 寸法（`raster.width/height`）。x軸は left/right、y軸は top/bottom を独立使用。**同型・非対称 inset 正しく対応**。per-texture 経路は raster がそのまま content+透明境界のため atlas gutter オフセット0に相当する対応も妥当。適合。

### 3. 非クランプ保存
remap は純アフィンのみ。`Math.max/min` 等クランプ皆無（`resolveContentUvRemap`/`applyContentUvRemap` 全体を確認）。テスト「does not clamp content UV outside [0,1]」が u=−0.3 → 負値、u=1.3 → 1超 を数値検証し、overshoot が線形に padded 透明域へ写ることを実証。A1 保存。適合。

### 4. 後方互換
`resolveContentUvRemap` が (a) inset/raster 不在、(b) 全辺0、(c) paddedW/H・contentW/H ≤ 0 のいずれかで `undefined` を返し、`applyContentUvRemap` が恒等コピーを返す。テストが (a)(b) を UV 0..1 不変で実証。(c) の防御は NaN/負副矩形回避として妥当（(c) の明示テストは無いが防御ガードであり非ブロッキング）。適合。

### 5. 陳腐化コメント
`resolveDrawableRenderDimensions` 付近の「§5.5-de-scoped — atlasRuntime is the canonical preview」誤記述を除去し、「UV remap はしない/offset は下流アダプタの contentInset remap で正される（§5参照）」へ更新。事実（この関数はテクスチャ寸法決定のみ）を保持しつつ誤った de-scoped 記述を除去。適合。

### 6. Viewer original（重点）
`viewer-render-source.ts:154-189` を実確認。`requestedMode !== "atlasRuntime"`（:175）および atlasRuntime unavailable フォールバック（:189）は `projection: input.originalProjection` を**無変換で返す**。描画は共有 `createRenderSceneFromCanvasProjection` を通るため、canvas 側 remap 追加で original も同型で自動的に正される。Gnome の「viewer に構造変更不要・同型で閉じる」結論は**正しい**。

追加変更（`remapDrawableToAtlasRuntime` の分割代入で `contentInset`/`rasterDimensions` を drop、:490-500）の妥当性判断: **許容（逸脱ではない）**。
- atlasRuntime 経路は `remapUvIntoPlacement` で per-layer inset を既に placement `uvRect` へ畳み込む別経路。drawable にこれらのフィールドが残ると共有アダプタが atlas ページ寸法に対し**二重に** remap する。この drop は共有アダプタ変更の正しさを成立させる**必須の回帰防止**であり、既存 `sourceLayerId` drop と同型の1箇所パターン変更。構造変更ではない。Allowed scope（同型で閉じるための追加的変更）に該当。escalate 不要と判断する Gnome の結論に同意。

### 7. スコープ逸脱なし
`CanvasRenderableDrawable` は editor ローカル型。optional フィールド追加は render-core 契約（`RenderMesh` の `uvSpace: layer-local-top-left-0-1-v1` 等）を変更しない。remap は UV 数値の描画時変換で、これはアトラス側 `remapUvIntoPlacement` が UV を placement へ書き換えるのと同型の既存慣行であり uvSpace 意味論の違反ではない（サンプル対象が padded raster であり、remap 後の UV はその content 副矩形を正しく指す）。保存メッシュ UV・アトラス側挙動・PSD adapter/materialization・contract・lockfile いずれも未改変。Forbidden scope 接触なし。適合。

### 8. 設計文書 §5 項5
最小差分（1行）で改訂。atlasRuntime が「export = runtime 一致検証の正典プレビュー」である地位を明記保持しつつ、original も content-inset UV remap で内容位置を正とする趣旨・非クランプ・A1 保存を追記。趣旨どおり。適合。

## テスト再実行結果（自分で実行）

| スイート | 結果 |
|---|---|
| `canvas-projection.test.ts` + `canvas-render-scene-adapter.test.ts`（apps/editor） | **32 passed**（adapter 10 / projection 22） |
| `src/workspace/canvas` + `src/workspace/viewer`（apps/editor 回帰） | **186 passed / 4 skipped**（17 files, viewer-render-source 14件緑含む） |
| `texture-content-inset` + `texture-atlas-transparent-gutter` + `texture-atlas-packing`（root 回帰） | **17 passed** |

**新規 fail ゼロ**。Gnome 報告の件数と完全一致。型チェックは負荷を考慮し実差分から論理確認: optional 追加は exactOptionalPropertyTypes 準拠の条件付きスプレッド、viewer の drop は既存 `sourceLayerId` パターンと同型で型安全。新規型エラーを誘発しないと判断（Gnome の baseline 23 errors 不変・新規ゼロ報告と整合）。

## テストの質の評価
- **良好**。三角メッシュ・bounds quad・後方互換・非クランプ・位置意味論・非対称 inset の6観点を網羅。
- 独立導出: triangle/quad/overshoot テストは concrete fraction（4/28, 24/28 等）を独立にハードコードし、実装式の写しでない。位置意味論テストは `contentPixelSpan === bounds.width === CONTENT` という**別ルートの不変量**で H1 欠陥解消を実証（実装式に依存しない検証）。頂点（stage 幾何）不変も併せて確認。
- 非対称 inset テスト（`{left:3,top:5,right:7,bottom:9}`/40×60）は remapX/remapY が実装と同形式のためやや循環的だが、**distinct な具体数値**により left/right 取り違え（0で 7/40 vs 3/40）・x/y 軸取り違え（5+u·46 vs 3+u·30）を検出可能。swap 検出器として有効。非ブロッキングの軽微指摘に留まる。

## 裁量判断の妥当性
1. `rasterDimensions` を `renderWidth/renderHeight`(round済) でなく生値で対運搬 — contentInset と同座標系を型で self-consistent にする合理的判断。妥当。
2. viewer atlasRuntime drop — 上記観点6のとおり必須の回帰防止。妥当。
3. 恒等時早期 return — 明示性・性能。妥当。
4. §9 履歴ログ未改変 — 「項5のみ改訂」指示への厳密遵守。妥当。

## Orch-Sylph への質問
1. **設計文書 §9 の陳腐化申し送り**: §9「解決済み Wave108」ログ末尾に「original の content ずれのフォローアップを検討（非ブロッキング）」が残り、本 wave で実装された今は陳腐化している。Gnome は scope 規律（項5のみ改訂）を優先し未改変。レビューとしては本ドメイン合格に影響しないが、§9 に「Wave 1.2 F で解決」の1行追記を許可するかは Orch-Sylph の判断を仰ぐ（軽微・任意）。
2. **baseline 型エラー 23件**: 本変更由来でない既知 fail。別途 escalate 対象として認識済みかの確認のみ（本ドメインでは対処不要）。
