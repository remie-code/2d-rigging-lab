# Wave108 Domain B レビュー（組み直し・Option E 版）: `wave108-texprep-transparent-padding`

- 対象: Option E（層サイズ別パディング）への組み直し
- レビュー担当: Review-Sylph（Orch-Sylph からの委任）。読み取り専任。
- 判定: **合格**

---

## 1. 判定サマリ

Domain B は Option E 契約に適合。padding 幅の固定 4px が完全に廃止され、正準関数
`maxCoverageMarginSourcePixels(longEdge)` の import による層サイズ関数へ置換されている。
per-size 焼き込み・飽和/比例・content-inset 伝播・stage bounds 据置・scope 遵守いずれも満たす。
自分で再走したテスト（adapter 15 / package-format+operation-core 465）は green、typecheck clean。

軽微な非ブロッキング所見が 1 件（維持側ファイルの旧「K」コメント表現、後述 §5）。合格判定に影響しない。

---

## 2. Option E 契約適合

### 2.1 padding 幅の関数化（観点1）— 適合
- 固定定数 `LAYER_RASTER_TRANSPARENT_PADDING_PX=4` は adapter から消失。残骸なし
  （adapter 差分に固定定数・stale export 無し）。
- `browser-psd-parser-adapter.ts` で
  `import { maxCoverageMarginSourcePixels } from "@private-2d-rigging-lab/authoring-core";`
  を追加し、既存 `workspace:*` 依存経由・`index.ts` re-export（Domain A が追加）を利用。
  新規依存追加なし。
- 焼き込み時: `longEdge = Math.max(bounds.width, bounds.height)` →
  `padding = layerTransparentPaddingSourcePixels(longEdge)`。契約どおり
  `P = maxCoverageMarginSourcePixels(max(w,h))`。
- thin wrapper `layerTransparentPaddingSourcePixels` は
  `(longEdgePixels) => maxCoverageMarginSourcePixels(longEdgePixels)` の
  **純粋 pass-through**。式の複製・二重定義は無い（正準関数 = 単一真実源）。裁量として妥当（§4）。

### 2.2 per-size 焼き込みの正しさ（観点2）— 適合
- `padLayerRasterWithTransparentBorder(content, w, h, P)`:
  バッファ `(w+2P)×(h+2P)×4`、`new Uint8Array`（ゼロ = premultiplied 透明 (0,0,0,0)）。
  行転写 `dstStart = (row+P)*paddedRowBytes + P*4`、content 行を `contentRowBytes` ずつ set。
  offset (P,P)・off-by-one 無し。純粋・決定性（テストで byte 同一を実証）。
- P が層ごとに変わることが下流へ整合反映:
  `digest = sha256(paddedBytes)`、`byteLength = paddedBytes.byteLength`、
  evidence `width/height = padded.width/height`、`layerBytes.{width,height,bytes}` も padded。
  `binaryAssetRef.byteLength = evidence.byteLength`、`binaryAssetRef.digest = evidence.digest` を
  テスト "keeps evidence, binaryAssetRef, and layerBytes mutually consistent" で確認。
- digest が content ではなく padded を対象とすることを
  "digests the padded bytes, not the tightly-cropped content bytes" で確認。

### 2.3 飽和・比例の妥当性（観点3）— 適合
正準関数 `Math.ceil(clamp(0.012×L,4,16)+1)`（v7 定数: FRACTION=0.012 / MIN=4 / MAX=16、
soft-mask blur=1）を検証。テスト値と手計算一致:
- 下限飽和: L=3,250,333 → 全て 5（clamp 下限 4 + blur 1、ceil）
- 中間比例: L=500 → ceil(6+1)=7、L=1000 → ceil(12+1)=13
- 上限飽和: L=1334 → ceil(16.008→clamp16 +1)=17、L=2048 → 17
飽和境界（clamp 端点 + blur 1）と一致。evidence 側テストも小=5 / 中=13 / 大=17 の
三領域代表ケースで per-size 焼き込みを実証。

### 2.4 content-inset（観点4）— 適合
- adapter は四辺形 `{left,top,right,bottom}` を全辺 = P で生成（`padded.contentInset`）。
- 伝播: adapter evidence.contentInset → `import-source.ts` DTO `PsdAdapterContentInsetSchema`
  （4 辺・optional）→ `import-psd-layer-materialization.ts` が `structuredClone` で
  textureEntry.contentInset へ、`materialization.width/height` を `dimensions`（padded raster）へ。
  `textureEntry.dimensions` = padded raster を確認。
- package-format `TextureContentInsetSchema` / `PsdLayerMaterializationEvidenceSchema.contentInset`
  も 4 辺 optional で維持。スキーマは前回 pass から不変で Option E でも正しい
  （層ごと P も 4 辺形に収まる）。

### 2.5 stage bounds 据置（観点5）— 適合
- adapter は `mesh.bounds` / `resolveInitialBounds` を触っていない（diff は adapter の evidence
  生成部のみ）。stage bounds は content サイズのまま。padded raster と content bounds は
  contentInset で橋渡し（materialization コメントにも「mesh.bounds stay content-sized」明記）。

### 2.6 scope 遵守（観点6）— 適合
- adapter は `maxCoverageMarginSourcePixels` を **import のみ**。
  `mesh-generation-coverage-margin.ts`（Domain A・untracked）は改変されておらず、正準関数は契約
  どおりの定義（内容確認済み）。
- Domain B の変更は `browser-psd-parser-adapter.ts` + `.test.ts` に自己完結。
  atlas pack/bake・レンダラ・export・canvas-projection の render 寸法系への変更なし。
- working tree に併存する render-* / mesh-generation-*（v6/v6d/v7/coverage-margin）の変更は
  他ドメイン（主に Domain A）のものであり Domain B scope 外。Domain B の diff はそれらに及ばない。
  申し送りの旧「bound to K」stale コメント（v6-contour-pipeline 等）も Gnome(B) は未改変。

---

## 3. テスト適合（自分の再走結果）

| 対象 | 結果 |
|---|---|
| `browser-psd-parser-adapter.test.ts` | **15 passed** |
| `packages/operation-core/src` + `packages/package-format/src` | **465 passed (81 files)** |
| `tsc -b` typecheck | **clean (exit 0)** |

per-size 検証カバレッジ（adapter.test.ts）:
- `layerTransparentPaddingSourcePixels`: 下限飽和 / 中間比例 / 上限飽和を明示ケースで検証。
- `padLayerRasterWithTransparentBorder`: 1px 境界の全周透明・content 転写位置・決定性。
- `createLayerMaterializationEvidence`: 三領域 (P=5/13/17) の padded dims・byteLength・
  contentInset・content 復元・相互整合・全周透明バンド・digest 対象・決定性。

Gnome 申告（adapter 15 / 465 / typecheck clean）は再現。`apps/editor/src` 全体未再走の扱いも妥当:
変更は adapter + test に閉じ、前回 pre-existing 失敗（`diagnostics-jump-actions.test.ts` 4 件）は無関係。

---

## 4. 裁量判断の妥当性

- thin wrapper `layerTransparentPaddingSourcePixels`: 純粋 pass-through。式を複製せず正準関数へ
  委譲するため単一真実源を破らない。adapter ローカルに「透明パディング幅」という意味論的名前を
  与え、呼び出し側の可読性とテスト対象化を両立。妥当。
- longEdge に `bounds.width/height`（PSD layer tight bounds = alpha bbox）を採用: 契約
  「content=PSD alpha bbox サイズ」に一致。妥当。

---

## 5. 差分・残課題

### ブロッキング: なし

### 非ブロッキング所見（1 件・修正不要 / 任意）
維持側ファイル（前回 pass から不変・Gnome は今回未改変）のコメントに旧「K」表現が残存:
- `packages/package-format/src/texture-atlas.ts`: 「today all four sides equal the uniform
  padding K」「content + 2K border」
- `packages/operation-core/src/payloads/import-source.ts`: 「today all sides equal padding K」

Option E では単一グローバル定数 K は廃止され層ごとに P（サイズ関数）となったため、
「the uniform padding K」というグローバル前提の語が厳密には陳腐化。ただしスキーマ自体
（4 辺形・各辺非負整数）は Option E でも正しく、per-layer では依然 4 辺等値なので**意味論は
正しい**。これらは Domain B rebuild scope 外の維持ファイルであり、Gnome が触れていないのも scope
遵守として妥当。将来 Domain C/D 着手時に「K」→「P（層サイズ別）」へ doc-comment を揃えると明快。
**合格判定には影響しない。**

---

## 6. 質問

なし。契約・オラクル・テストいずれも整合しており、判断に迷う点はない。
