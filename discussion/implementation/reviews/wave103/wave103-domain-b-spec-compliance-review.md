# Wave103 Domain B (Software Rasterizer Foundation) — Spec Compliance Review

- Lane: Spec Compliance Review（Review-Sylph, model: opus）
- Reviewer: Sylph（Review-Sylph）
- Caller: Orch-Sylph（Wave103 Domain B オーケストレーター）
- Date: 2026-07-02
- Source of truth: `discussion/implementation/orchestration/wave103-plan.md` §3.2 / §7 / §9 / §12。basis: `discussion/model-authoring/research/perception-path-survey.md`
- Scope: 新規パッケージ `packages/render-software/`（15 ソース + 6 テスト = 21 ファイル）
- Method: Gnome 要約に依存せず、全ソース + 全テストを読み、WebGL2 レンダラソースと突き合わせ、テストを 2 回実行して検証（§12）

## 判定: `pass`

必須検証項目 6 件すべて合格。Blocking 条件（依存/lockfile 変更、render-webgl2 挙動変更、非決定源の描画経路混入、必須項目欠落）はいずれも該当なし。Domain A の並行変更（`apps/authoring-host/`, `packages/ai-interface/`）は本判定に含めていない。

---

## 検証項目ごとの結果と証拠

### 1. 依存ゼロ / DOM・GL・ネイティブ参照ゼロ / lockfile 無変更 — PASS

- 非テストソースの全 import を抽出（`grep` 実行）。外部 import は `@private-2d-rigging-lab/render-core` と `node:zlib` のみ。残りはすべて相対 import。
  - `png-encoder.ts:1` `import { deflateSync, constants as zlibConstants } from "node:zlib"`（標準ライブラリ、依存に数えない）
  - `test-support/png-decoder.ts:1` `import { inflateSync } from "node:zlib"`（テスト補助）
  - render-core からの import は型（`RenderScene` / `RenderDrawable` / `RenderPoint` / `RenderRgba8TextureSource` 等）と純関数 `orderRenderDrawablesBackToFront` のみ。
- テスト内 import は `vitest`（テストランナー、テスト内のみ）+ 相対のみ。
- `package.json`（`packages/render-software/package.json`）の `dependencies` は `@private-2d-rigging-lab/render-core: workspace:*` の 1 件のみ。外部依存なし。
- 禁止トークン grep（`window|document|canvas|getContext|webgl|navigator|requestAnimationFrame|headless-gl|node-canvas|createImageBitmap|OffscreenCanvas|fetch|node:fs|node:child_process`）: ヒットはすべて **コメント内の "WebGL2" / "canvas" 参照**（実装意図の記述）であり、実コードの DOM/GL/native 参照はゼロ。
- `pnpm-lock.yaml` / ルート `package.json`: `git status --short` に出現せず = 無変更。
- node_modules 混入: `packages/render-software/node_modules/` は存在するが `.gitignore:1`（`node_modules/`）+ 明示 `git check-ignore packages/render-software/node_modules` でヒット。`git status --untracked-files=all packages/render-software/` に **21 ソース/テストファイルのみ**が出現し node_modules 配下は 1 件も出現しない（コミット対象混入なし）。

### 2. golden テストの決定論実証（厳密バイト一致 + 複数回実行不変 + テスト実行） — PASS

- golden テストは実際に「期待バイト列との厳密一致」をアサート:
  - `software-renderer.test.ts:79-85`（単色三角形の完全な期待バイト配列 `toEqual`）
  - `software-renderer.test.ts:104-109`（4 色テクスチャ NEAREST）
  - `software-renderer.test.ts:129-141`（opacity: premultiplied / straight 両バッファのバイト）
  - `software-renderer.test.ts:172-177`（draw order over）
  - `software-renderer.test.ts:212-217`（half-opacity blend）
- 複数回実行不変を明示アサート:
  - `software-renderer.test.ts:250-262`（同一 scene を 3 回レンダし premultiplied / straight のバイト完全一致）
  - `mask.test.ts:187-217`（マスク付きレンダの反復バイト一致）
  - `png-encoder.test.ts:30-38`（同一入力 PNG バイト一致）、`png-encoder.test.ts:107-129`（end-to-end PNG バイト一致）
- テスト実行: `npx vitest run packages/render-software` を **2 回**実行、両回とも `6 test files / 33 tests passed`。Gnome 自己申告（33 テスト全通過）と一致。

### 3. ビュー変換 API の公開 + 座標対応の実証 — PASS

- ビュー指定は「モデル（stage）空間 viewport 矩形 + 出力ピクセルサイズ」で構成（`view-transform.ts:18-35` `StageViewportRect` + `SoftwareRenderView { stageViewport, outputWidth, outputHeight }`）。§3.2 の要求形と一致。
- stage↔ピクセル変換（順・逆）が公開 API としてエクスポート:
  - `stagePointToImagePixel`（順, `view-transform.ts:103`）
  - `imagePixelToStagePoint`（逆, `view-transform.ts:116`）
  - `pixelCenterToStagePoint`（`view-transform.ts:129`）
  - `resolveSoftwareRenderView`（`view-transform.ts:76`）と型 `SoftwareRenderView` / `ResolvedSoftwareRenderView`
  - すべて `index.ts:3`（`export * from "./view/view-transform.js"`）でバレル公開。
- テストで座標対応を実証: `view-transform.test.ts` が矩形コーナー→画像エッジ写像（18-24）、+Y down（26-31）、既知点→期待ピクセル（33-37）、順逆 round-trip（39-53, 55-68）、pixel center 逆写像（70-77）、退化正規化での可逆性維持（79-94）を検証。
- Wave104 サイドカー再利用前提（§3.2）: `SoftwareRenderView` は純データ・serializable であり `resolveSoftwareRenderView` は referentially transparent（コメント `view-transform.ts:71-75`）。再利用可能な形。

### 4. マスク / draw order / 不透明度の意味論 — WebGL2 と一致（PASS）

WebGL2 ソース（`webgl2-renderer.ts`, `webgl2-shaders.ts`, `webgl2-textures.ts`, `webgl2-mesh.ts`）を読み、逐一突き合わせた。

- **draw order**: 両レンダラとも render-core の `orderRenderDrawablesBackToFront` を直接呼ぶ（software: `software-renderer.ts:92`, `mask.ts:42` / webgl2: `webgl2-renderer.ts:61,134`）。比較は `render-order.ts:7-22`（drawOrder 降順 → stableIndex 昇順 → drawableId localeCompare、背面から）。完全一致。テスト `software-renderer.test.ts:144-178`。
- **ブレンド**: `blend.ts:26-38` の premultiplied over（`dst = src + dst*(1-src_a)`）は `webgl2-renderer.ts:117` の `blendFunc(ONE, ONE_MINUS_SRC_ALPHA)` と一致。透明クリア: `framebuffer.ts:24-27`（Float64Array ゼロ初期化 = 透明）は `webgl2-renderer.ts:114` `clearColor(0,0,0,0)` と一致。
- **alphaMode "straight" の premultiply**: `texture-sampler.ts:48-50` の `Math.round((c * a) / 255)` は `webgl2-textures.ts:77-79` の `createUploadBytes` と **byte-exact 一致**。"premultiplied" ソースは as-is（`texture-sampler.ts:41-45` / `webgl2-textures.ts:70-72`）。テスト `texture-sampler.test.ts:7-40`。
- **フラグメント**: `triangle-rasterizer.ts:153-164` の `sample.{r,g,b,a} * (opacity * maskAlpha)` を全チャンネルに乗算し premultiplied を維持。`webgl2-shaders.ts:51` `outColor = color * (u_opacity * maskAlpha)` と一致。opacity は両者とも clamp01（software: `drawable-rasterizer.ts:58` / webgl2: `webgl2-renderer.ts:251,335`）。
- **【Undine 裁定】mask drawable の二重寄与**: `software-renderer.ts:97-139` の解釈が `webgl2-renderer.ts:65-90` と一致することを確認:
  - mask drawable は renderable なら**メインパスにも通常描画される**（ordered ループで通常の drawable として処理され、かつ target のマスク源に選ばれる）。software 側は mask を別扱いにせず ordered ループに残す構造で二重寄与が成立。テスト `mask.test.ts:69-114` がこの二重寄与（mask 自身の色がメインバッファに乗り、かつ target を maskAlpha でスケール）を明示的に期待バイトで検証。
  - mask バッファは透明クリア → 背面順 over 合成 → その alpha を maskAlpha に使用（`mask.ts:37-64`, `buildMaskAlphaSampler`）。スクリーン空間 1:1 対応（同解像度・同座標系のため index equality、`mask.ts:56-64`）。`webgl2-shaders.ts:48-49` の `maskAlpha = texture(maskTex, fragCoord/viewportSize).a` に対応。
  - renderable な mask が 0 件 → target スキップ（`software-renderer.ts:123-125` / `webgl2-renderer.ts:84-86`）。テスト `mask.test.ts:155-185`。
- **NEAREST + CLAMP_TO_EDGE / 禁止機能なし**: `texture-sampler.ts:86-105`（`floor(uv*dim)` + clamp）は GL NEAREST + CLAMP_TO_EDGE（`webgl2-textures.ts:41-44`）と一致。テスト `texture-sampler.test.ts:42-58`。アンチエイリアス/バイリニア/フィルタリングは実装に存在しない（カバレッジは pixel-center 単一サンプル + 決定論的 top-left rule, `triangle-rasterizer.ts:47-57,132-137`）。§3.2 Forbidden 遵守。
  - 注記（非 blocking）: WebGL2 の **mask target テクスチャ**のみ MIN/MAG=LINEAR（`webgl2-renderer.ts:170-171`）だが、software はスクリーン空間 1:1 対応で index equality サンプリングのため補間が発生せず結果は一致。マスク源テクスチャ自体の描画は両者 NEAREST で一致。
- **mesh validity**: `drawable-rasterizer.ts:40-71`（`vertexCount = min(vertices, uvs)`, triangle 全 index が `[0, vertexCount)`）は `webgl2-mesh.ts:10-44` `createWebGl2MeshUpload` と一致。範囲外三角形はスキップ。

### 5. render-webgl2 無変更 / render-core 無変更 — PASS

- `git status --short packages/render-webgl2/` → 空（無変更）。`--untracked-files=all` でも空。
- `git status --short packages/render-core/` → 空（無変更）。§7 の「render-core 契約の狭い追加」も実際には行われておらず、既存 `RendererBackend` 変更もなし（そもそも render-core への書き込みゼロ）。既存 backend 契約への影響なし。
- render-software は render-core を **読み取り専用**で消費（型 + `orderRenderDrawablesBackToFront` 呼び出しのみ）。

### 6. PNG 意味論（straight alpha / RGBA8 両提供 / 決定論丸め / round-trip） — PASS

- PNG は straight alpha を出力: `render-scene-to-png.ts:33` が `render.straightRgba8` をエンコード。un-premultiply は `framebuffer.ts:57-82`（alpha>0 で `round(c_premul/a)`、alpha==0 で RGB=0）。決定論的丸め（`Math.round`、プラットフォーム非依存）。
- RGBA8 公開 API は premultiplied / straight 両提供: `SoftwareRenderResult.premultipliedRgba8` / `.straightRgba8`（`software-renderer.ts:37,43,160-161`）。Undine 承認済み設計通り。
- PNG エンコーダ決定論: 固定 deflate 設定（`png-encoder.ts:12-16` level=9, memLevel=8, Z_DEFAULT_STRATEGY）、全行 filter type 0（None, `png-encoder.ts:57`）、color type 6 / bit depth 8 固定。`node:zlib deflateSync` のみ。
- round-trip 成立: 独立実装のテスト用デコーダ（`test-support/png-decoder.ts`, node:zlib inflateSync のみ）で decode→straight バッファ一致を検証（`png-encoder.test.ts:44-69`）。premul→straight 変換の保持も検証（`png-encoder.test.ts:71-105`）。幅・高さ一致検証あり。

---

## 追加確認（§7 / §12 の周辺）

- **非決定源の描画経路混入なし**: `Date.now` / `Math.random` / `new Date` grep ゼロ。`performance.now()` は `performance-reference.test.ts:99,101` の**参考計測のみ**（タイミングアサーションなし、`expect` は png 長さ>0 とサイズのみ）。描画経路（software-renderer / raster / png / view）には非決定源なし。中間合成は Float64 で行い読み出し時のみ量子化（`framebuffer.ts:1-17`）でプラットフォーム間の丸め蓄積を回避。
- **エッジケース決定論**: 空シーン（`software-renderer.test.ts:264-268`）、退化三角形（270-302, `triangle-rasterizer.ts:80-83` で area2==0 スキップ）、viewport 外クリップ（304-328）、非 renderable スキップ（330-364）を検証。
- **参考性能**（非 blocking, §7）: 512x512 / 8 drawable × 512 tris = 83.56 ms、PNG 3464 bytes（テスト実行ログ）。報告記録用として妥当。
- **fixtures**: `test-support/scene-fixtures.ts` は全て合成生成（外部アセット・`ref/` 不使用）。§3.4 rights-clean 準拠。

## Findings

| # | Severity | 内容 |
|---|---|---|
| F1 | info | WebGL2 の mask target テクスチャは LINEAR フィルタ（`webgl2-renderer.ts:170-171`）だが、software はスクリーン空間 1:1 の index-equality サンプリングで補間が発生しないため描画結果は一致。相違は無害。修正不要。 |
| F2 | info | `png-encoder.ts` は filter type 0（None）固定で最小圧縮効率だが、決定論優先の明示的選択（§3.2 完全決定論）。仕様に沿った妥当なトレードオフ。修正不要。 |
| F3 | info | 参考性能 83.56 ms/512x512 は Wave104 のコンタクトシート（多フレーム）で無視できない可能性があるが、本 wave のブロッキング基準外（§7 明記）。将来の最適化余地としてのみ記録。 |

Blocking finding / needs_changes 相当の finding はなし。

## 質問（呼び出し元へ）

なし。§9 Domain B Spec Compliance の明示確認項目・追加裁定項目はすべて証拠付きで確認でき、判断に迷う点はありませんでした。
