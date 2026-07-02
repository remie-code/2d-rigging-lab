# Wave103 Domain B Report: Software Rasterizer Foundation

- Domain id: `wave103-software-rasterizer-foundation`
- Orchestrator: Orch-Sylph（opus）
- Implementer: Gnome（opus）
- Reviewers: Review-Sylph 3 レーン（すべて opus）
- Source of truth: `discussion/implementation/orchestration/wave103-plan.md` §3.2 / §7 / §9 / §12
- Date: 2026-07-02

## 1. 判定

**pass**（実装ループ回数 1、レビュー 3 レーン全 pass、blocking findings なし）

## 2. 成果物

新規パッケージ `packages/render-software/`: RenderScene（render-core 純データ）+ ビュー指定（stage 空間 viewport 矩形 + 出力ピクセルサイズ）→ RGBA8 バッファ（premultiplied / straight 両提供）→ PNG バイト列（`node:zlib` のみ、外部依存ゼロ）の決定論的純 TS ラスタライザ。

### 変更・新規ファイル一覧（21 ファイル、すべて新規。他パッケージへの変更ゼロ）

エントリポイント / トップレベル:

- `packages/render-software/package.json`（依存は `@private-2d-rigging-lab/render-core: workspace:*` のみ）
- `packages/render-software/src/index.ts`（バレルのみ）
- `packages/render-software/src/software-renderer.ts` / `software-renderer.test.ts`
- `packages/render-software/src/render-scene-to-png.ts`
- `packages/render-software/src/performance-reference.test.ts`

ビュー変換（Wave104 サイドカー再利用前提の公開 API）:

- `packages/render-software/src/view/view-transform.ts` / `view-transform.test.ts`
  - `StageViewportRect`、`SoftwareRenderView { stageViewport, outputWidth, outputHeight }`、`resolveSoftwareRenderView`
  - 順変換 `stagePointToImagePixel`、逆変換 `imagePixelToStagePoint`、`pixelCenterToStagePoint`（すべてバレル公開・純データ・serializable）

ラスタライズ:

- `packages/render-software/src/raster/triangle-rasterizer.ts`（重心座標 + 決定論的エッジ規則、退化三角形スキップ）
- `packages/render-software/src/raster/drawable-rasterizer.ts`（renderable 判定・valid-triangle 規則は WebGL2 の `createWebGl2MeshUpload` 準拠）
- `packages/render-software/src/raster/texture-sampler.ts`（NEAREST + CLAMP_TO_EDGE 相当）/ `texture-sampler.test.ts`
- `packages/render-software/src/raster/blend.ts`（premultiplied over: `blendFunc(ONE, ONE_MINUS_SRC_ALPHA)` 相当）
- `packages/render-software/src/raster/mask.ts`（WebGL2 マスクパス忠実再現）/ `mask.test.ts`
- `packages/render-software/src/raster/framebuffer.ts`

PNG:

- `packages/render-software/src/png/png-encoder.ts`（IHDR/IDAT/IEND 純 TS チャンク構築、`deflateSync` 固定設定、straight alpha 出力）
- `packages/render-software/src/png/crc32.ts`
- `packages/render-software/src/png/png-encoder.test.ts`

テスト補助（rights-clean 合成フィクスチャのみ）:

- `packages/render-software/src/test-support/png-decoder.ts`（テスト内純 TS デコーダ、外部依存なし）
- `packages/render-software/src/test-support/scene-fixtures.ts`

## 3. 描画意味論（既存 WebGL2 レンダラとの一致。Orch-Sylph 事前確定 + Spec レーン突き合わせ検証済み）

- draw order: render-core の `orderRenderDrawablesBackToFront` を再利用（drawOrder 降順 → stableIndex → drawableId、背面から描画）
- renderable 判定: `visible && opacity > 0` + texture source 存在（`webgl2-renderer.ts` `isDrawableRenderable` 準拠）
- alphaMode `"straight"` の premultiply 変換は `webgl2-textures.ts:69-83` と同一規則
- フラグメント: `色 * (opacity * maskAlpha)` を全チャンネルに乗算（`webgl2-shaders.ts:51` 準拠）
- ブレンド: premultiplied over、透明 (0,0,0,0) クリア（`webgl2-renderer.ts:114-117` 準拠）
- マスク: mask 集合を別バッファに透明クリア → 背面順 over 合成 → その alpha を target の maskAlpha としてスクリーン空間 1:1 で使用。renderable な mask 0 件なら target 自体をスキップ（`webgl2-renderer.ts:71-90` 準拠）
- サンプリング: NEAREST + CLAMP_TO_EDGE。アンチエイリアス / バイリニア等の禁止機能は不実装（§3.2 Forbidden 遵守）

## 4. テスト結果

- `npx vitest run packages/render-software`: **6 テストファイル / 33 テスト全通過**
  - Gnome 実装時、Spec Compliance レーン（2 回実行）、Test Adequacy レーン（2 回実行）でそれぞれ独立に再現
- golden 決定論の実証:
  - 固定期待バイト列との厳密一致（単色三角形 / テクスチャ NEAREST / 不透明度 / draw order / half-opacity blend、`software-renderer.test.ts`）。期待値はハードコード固定値であり実行結果のオウム返しではない（Test Adequacy B-3 で確認）
  - 同一 scene 3 回レンダのバイト完全一致（`software-renderer.test.ts:250-262`）、マスク付き反復バイト一致（`mask.test.ts:187-217`）、PNG end-to-end バイト一致（`png-encoder.test.ts:107-129`）
- PNG round-trip: 生成 PNG をテスト内純 TS デコーダで復号し幅・高さ・ピクセル一致を検証
- ビュー変換: 既知 stage 点 → 期待ピクセル、順逆 round-trip、+Y down、退化正規化の各テスト（`view-transform.test.ts`）
- エッジケース: 空シーン / 退化三角形 / viewport 外形状の決定論的処理を検証
- 描画経路に `Date.now` / `Math.random` 等の非決定源なし（Spec / Test Adequacy 両レーンで確認）

### 参考性能計測（ブロッキング基準ではない）

- typical scene（512x512 出力、8 drawables x 512 triangles）: **約 72 ms**（Test Adequacy レーン実測 Run1: 72.77 ms / Run2: 71.89 ms、PNG 3464 bytes で両回一致）

## 5. レビュー 3 レーン結果

| レーン | 判定 | レポート |
|---|---|---|
| Spec Compliance | pass | `discussion/implementation/reviews/wave103/wave103-domain-b-spec-compliance-review.md` |
| Design / Development Compliance | pass | `discussion/implementation/reviews/wave103/wave103-domain-b-design-development-review.md` |
| Test Adequacy | pass | `discussion/implementation/reviews/wave103/wave103-domain-b-test-adequacy-review.md` |

- Spec: 必須 6 項目（依存ゼロ / golden 決定論 / ビュー変換 API 公開 / 意味論一致 / render-webgl2・render-core 無変更 / PNG 意味論）すべて証拠付き合格。質問なし。
- Design/Dev: source organization ガード pass、`index.ts` バレルのみ、禁止名ファイルなし、render-core / render-webgl2 / ルート package.json / lockfile 無変更、命名規約整合。
- Test Adequacy: §7 Required tests 5 項目すべて存在かつ実質的。minor 1 件（下記 B-1）、blocking なし。

## 6. Undine 裁定事項の記録（4 件）

1. **ワークスペース symlink の手動 materialize — 許容**: `pnpm install` 禁止下で render-core 解決のため `packages/render-software/node_modules/` に per-package リンクを手動作成した。依存追加・lockfile 変更には当たらない。`node_modules/` は `.gitignore:1` で ignore されておりコミット対象に混入していない（Spec / Design 両レーンで確認）。
   - **追記**: その後ユーザーが `pnpm install` を実行し、手動リンクは正規の workspace リンクに置き換わった。その状態で `npx vitest run packages/render-software` 33/33 pass を Undine が再確認済み。
2. **PNG は straight alpha、RGBA8 公開 API は premultiplied / straight 両提供 — 承認**（計画 §3.2 と整合。un-premultiply は決定論的丸め）。
3. **mask drawable の二重寄与**（メインパスに通常描画されつつ target のマスク源にもなる）— **WebGL2 忠実解釈として承認**。Spec レーンが `webgl2-renderer.ts:77-89` の読み取りとの一致を明示検証し、`mask.test.ts:69-114` が数値レベルで検証している。
4. **先行 fail の分類**: 以下は clean HEAD / 並行作業由来の先行状態であり Domain B の判定に不算入（記録のみ。Domain C / Undine 側で別途扱う）:
   - `check-dependencies.mjs` の lockfile finding（`pnpm-lock.yaml:2452` の integrity ハッシュ内 `cmo3` 部分文字列誤検知。Domain A レビューでも同一事象を確認。lockfile 自体は無変更）
   - 全体 typecheck の ai-interface 系エラー（Domain A の並行作業由来）
   - `pnpm run test:unit` 全体の先行 18 failed（Wave103 無関係の先行状態）
   - Domain B 由来の新規 finding はゼロ（render-software 単体の typecheck / テスト / ガードは clean）

## 7. 実装ノート（Gnome 報告より）

- エッジ規則・NEAREST テクセル選択・量子化丸め・PNG フィルタ / 圧縮設定は決定論的に固定（詳細はソースコメントおよび各レビューレポート参照）。
- 実装は責務ごとに分割（view / raster / png / test-support）。`index.ts` はバレルのみ。

## 8. 残リスク / フォロー候補

- **B-1（minor, non-blocking）**: `triangles` の範囲外 index スキップ防御（`drawable-rasterizer.ts:62-71`）への専用テストが無い（間接カバーのみ）。WebGL2 の valid-triangle 規則の回帰検出のため明示テスト追加が望ましい。Wave104 以降のフォロー候補。
- **実 WebGL2 出力とのピクセル同値性は未検証**: 意味論一致はソース読解ベースの突き合わせで担保しており、実ブラウザ WebGL2 出力とのピクセル比較は本 wave のスコープ外（`ref/` e2e スモークは Wave104）。GL 実装依存の丸め差は原理的に残る（計画上の accepted リスク）。
- 依存ガードの `cmo3` false-positive はガード保守課題（本 wave スコープ外、Domain C / Undine 管轄）。
- 参考性能 72 ms / frame（512x512, 4096 tris）は知覚経路のワンショット用途には十分だが、将来コンタクトシートで多数フレームを描く場合は最適化余地あり（ブロッキングではない）。

## 9. 質問

なし（Gnome の確認事項 4 件はすべて Undine 裁定済み・上記 §6 に記録）。
