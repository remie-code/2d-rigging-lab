# Wave103 Domain B — Design / Development Compliance Review

- Wave: Wave103 (`headless-authoring-host-foundation`)
- Domain: B — Software Rasterizer Foundation (`wave103-software-rasterizer-foundation`)
- Lane: Design / Development Compliance Review
- Reviewer: Review-Sylph (opus)
- Date: 2026-07-02
- Source of truth: `discussion/implementation/orchestration/wave103-plan.md` §3.2 / §7 / §9 / §12
- Basis conventions read: source-file-organization-policy.md, dependency-policy.md, operation-policy.md, schema-and-id-conventions.md
- Read-only review. No source modified.

## 判定 (Verdict)

**pass**

Domain B の新規パッケージ `packages/render-software/`（15 ソース + 6 テスト）は、source organization / dependency / schema-and-id / 責務境界（render-core 契約の最小性・render-webgl2 無変更）の各規約を満たす。禁止スコープへの Domain B 由来変更は無い。ガード 2 本・typecheck は所定の判定基準で clean。blocking finding は無し。

---

## 検証項目ごとの結果と証拠

### 1. Source organization policy 遵守 — pass

- **`src/index.ts` はバレル**: `packages/render-software/src/index.ts:1-10` は `export * from "./..."` のみ（8 本の re-export + 冒頭コメント2行）。実装ロジック無し。DEC-FILE-001 / R-FILE-001 準拠。
- **責務ごとのファイル分割**: 各ファイルが単一責務を持つ。
  - `view/view-transform.ts`（座標変換）、`software-renderer.ts`（合成オーケストレーション）、`render-scene-to-png.ts`（PNG 直行 API）
  - `raster/framebuffer.ts`（float バッファ + 読み出し量子化）、`raster/blend.ts`（premultiplied over）、`raster/texture-sampler.ts`（NEAREST + premultiply）、`raster/triangle-rasterizer.ts`（三角形ラスタ + top-left rule）、`raster/drawable-rasterizer.ts`（drawable → 三角形展開）、`raster/mask.ts`（マスクパス）
  - `png/png-encoder.ts`（PNG チャンク構築 + node:zlib）、`png/crc32.ts`（CRC-32）
  - `test-support/png-decoder.ts` / `test-support/scene-fixtures.ts`（テスト補助、責務名で分離）
  - god file / catch-all 無し。最長でも `software-renderer.test.ts:365` 行で、いずれも閾値内。
- **禁止名の不在**: `types.ts` / `schemas.ts` / `utils.ts` / `helpers.ts` はソース・テストともに存在しない（ファイル一覧で確認）。
- **ガード実行**: `node scripts/check-source-organization.mjs` → `Source organization guard passed.` (EXIT 0)。

### 2. 依存ポリシー遵守 — pass

- **新規外部依存ゼロ / lockfile 無変更**:
  - `git diff --name-only HEAD -- pnpm-lock.yaml` は空（無変更）。
  - `git ls-files packages/render-software/node_modules` は空（node_modules 非追跡）。
  - render-software は `render-software` の語で lockfile に登場しない（`grep -n "render-software" pnpm-lock.yaml` 空）。install 由来のドリフト無し。
- **依存ガード実行と分類**: `node scripts/check-dependencies.mjs` → EXIT 1、finding は 1 件のみ:
  - `pnpm-lock.yaml: lockfile mentions forbidden dependency class (Cubism cmo3 parser/runtime dependency)`
  - **分類**: この finding は Domain B 由来ではない。pnpm-lock.yaml は無変更（上記）で、マッチ元は `pnpm-lock.yaml:2452` の integrity ハッシュ `sha512-95Pu1QXQvruGEhv62XCMO3Mm90Gsc...` に含まれる base64 部分文字列 `cmo3` の誤検知（clean HEAD に既存）。`git stash` を使わずに HEAD 内容を直接照合して確認。**Domain B 由来の新規 dependency finding はゼロ**。
- **package.json の依存**: `packages/render-software/package.json:9-11` の `dependencies` は `@private-2d-rigging-lab/render-core: workspace:*` のみ。§3.2「新規外部依存ゼロ」・§7 allowed scope に整合。
- **node_modules の materialize**: `packages/render-software/node_modules/@private-2d-rigging-lab/render-core` のみが存在（pnpm install 禁止下の手動 workspace materialize、Undine 許容済み）。`git check-ignore` が `packages/render-software/node_modules` を返し gitignore 済み、`git ls-files` で非追跡を確認。コミット対象に混入なし。

### 3. schema-and-id 規約 — pass

- **公開 API・型・定数の命名**: 既存 render-core の `RenderXxx` 流儀と整合。
  - 型: `SoftwareRenderView` / `ResolvedSoftwareRenderView` / `StageViewportRect` / `SoftwareRenderResult` / `SoftwareRenderPngResult` / `SoftwareFramebuffer` / `PreparedTexture` / `TextureSample` / `RasterVertex` / `MaskAlphaSampler` / `PremultipliedFragment`。PascalCase、一貫。
  - 関数: `resolveSoftwareRenderView` / `stagePointToImagePixel` / `imagePixelToStagePoint` / `pixelCenterToStagePoint` / `renderSceneToRgba8` / `renderSceneToPng` / `encodeRgba8ToPng` / `crc32` 等。camelCase 動詞句、一貫。
- **machine-readable id**: 本パッケージは新規の enum 値・check id・operation id・fixture id を定義していない（render-core の既存 string リテラル型 `"stage-y-down-v1"` / `"layer-local-top-left-0-1-v1"` / `"rgba8"` 等を消費するのみ）。スペース入り id の新規導入は無い。DTO/Schema ペア（`Dto`/`DtoSchema`）を要する外部境界 DTO も新設していない（純データ型の消費側）。R-SCHEMA-002 違反なし。

### 4. 責務境界（§9: render-core 契約の最小性） — pass

- **`packages/render-core/src/**` 無変更**: `git diff --stat HEAD -- packages/render-core` 空、untracked 無し。**既存 `RendererBackend` の変更なし**。render-software は render-core の型 (`RenderScene` / `RenderDrawable` / `RenderRgba8TextureSource` / `RenderPoint`) と関数 `orderRenderDrawablesBackToFront` を **消費のみ**。契約追加ゼロで実現しており、§7 の「読み出し可能な契約の狭い追加のみ」の範囲すら使わず、より安全側に着地している。
- **`packages/render-webgl2/src/**` 無変更**: `git diff --stat HEAD -- packages/render-webgl2` 空、untracked 無し。blocking 条件（render-webgl2 挙動変更）に該当なし。WebGL2 意味論への言及はすべて **コメント上の参照**（`orderRenderDrawablesBackToFront` の再利用、`maskDrawableIds.length === 0` 分岐、`blendFunc(ONE, ONE_MINUS_SRC_ALPHA)`、`clearColor(0,0,0,0)`、`createWebGl2MeshUpload` の mesh validity）であり、参照先は `packages/render-webgl2/src/webgl2-renderer.ts:72,114,117,120-132,221` 等に実在。実装は WebGL2 を写しているだけで変更していない。
- **既存部品の再利用**: draw order は render-core の `orderRenderDrawablesBackToFront`（`packages/render-core/src/render-order.ts:24`）を `software-renderer.ts:92` と `mask.ts:42` で使用。ソートロジックの再発明なし。
- **パッケージ構成の整合**: `package.json` は既存流儀（`"private": true`、`"type": "module"`、`"exports": { ".": "./src/index.ts" }`）に一致。個別 tsconfig 無し（ルート `tsconfig.json:17` の `packages/*/src/**/*.ts` include に乗る既存流儀通り）。

### 5. 禁止スコープ無違反 — pass

- `git status --porcelain` の Domain B 由来変更は `?? packages/render-software/` のみ（完全新規、ディレクトリ丸ごと untracked）。
- `apps/**`（authoring-host は Domain A の並行作業、判定対象外）、`packages/runtime-core/**`、`packages/operation-core/**`、`packages/ai-interface/**` に Domain B 由来の変更なし。
- 作業ツリー上の `apps/authoring-host/`・`packages/ai-interface/*`（`index.ts` 変更、`ai-auto-approval-policy*`）は Domain A の並行変更であり、本判定に含めていない。

### 6. typecheck — pass

- `pnpm run typecheck:root`（`tsc --noEmit`）→ EXIT 0。エラーゼロ。
- render-software はルート `tsconfig.json:17` の include に含まれ typecheck 対象。render-software 由来のエラーは 0。Domain A 由来の ai-interface 先行エラーも観測されず（今回は全体 clean）。

---

## Findings

| # | Severity | 項目 | 内容 |
|---|---|---|---|
| — | — | — | Domain B 由来の blocking / warning finding は検出されなかった。 |

参考（Domain B 由来ではない既存事象、記録のみ）:

- INFO-1: `check-dependencies.mjs` が clean HEAD の pnpm-lock.yaml で先行 fail する（integrity ハッシュ内 `cmo3` 部分文字列の誤検知、`pnpm-lock.yaml:2452`）。これは既知の先行 finding であり render-software とは無関係。Domain B の pass 判定を妨げない。ガード側の false-positive 抑制はガード保守の課題（本 wave スコープ外）。

---

## 質問 (Questions to caller / Orch-Sylph)

なし。§3.2 / §7 / §9 の Design/Development 共通項に照らして解釈上の曖昧点は生じなかった。

補足（判断が必要になった場合の情報）:

- 依存ガードの先行 fail（INFO-1）は「Domain B 由来の新規 finding が無いこと」を判定基準とする委任指示に従い、pass を妨げないものとして扱った。ガード自体の false-positive を別 wave で解消するか否かは Undine の裁量。

---

## 参照ファイル

- `packages/render-software/package.json`
- `packages/render-software/src/index.ts`
- `packages/render-software/src/software-renderer.ts`
- `packages/render-software/src/render-scene-to-png.ts`
- `packages/render-software/src/view/view-transform.ts`
- `packages/render-software/src/raster/{framebuffer,blend,texture-sampler,triangle-rasterizer,drawable-rasterizer,mask}.ts`
- `packages/render-software/src/png/{png-encoder,crc32}.ts`
- `packages/render-core/src/render-scene.ts`, `packages/render-core/src/render-order.ts`
- `packages/render-webgl2/src/webgl2-renderer.ts`（無変更・意味論の参照先）
