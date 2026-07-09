# Wave108 Domain C Review — `wave108-atlas-transparent-gutter` (Option E, D-atlas)

Role: Review-Sylph（レビュー）, delegated by Orch-Sylph. 対象: Batch 2 / Domain C（D-atlas）。
判定基準: `boundary-transparent-margin-design.md`（§3.1/§4/§5/§9）, `wave108-plan.md` §7,
親契約 `mesh-image-rendering-architecture.md` §8.3/§9, Domain B report（透明パディング前提）。
突合対象（鵜呑みにしない）: `wave108-domain-c-atlas-transparent-gutter-report.md`。

## 判定: **合格（PASS）**

Domain C の中核設計（§4 クロス滲み根絶、§3.1 bounds≡raster 分離、§9 透明 gutter 上書き）は
コード・テスト両面で正しく担保されている。git diff / tests / typecheck を自分で再取得・再実行し、
Gnome report の主張がコード実体と一致することを確認した。要修正の差分は無い。残課題は Domain 外の
リポジトリ衛生（stale `.js`）1件で、Gnome が既にエスカレーション済み（下記 §残課題）。

---

## 1. 設計適合

### §3.1 bounds≡raster 分離（padded raster 基準への切替）— 適合
- `texture-atlas-targets.ts`: 新設 `resolvePackedRasterSize(mesh, textureEntry)` を
  `validateTextureBytesForAtlas` と `createPackableTarget` の**両方**が使用。`textureEntry.dimensions`
  があれば padded 寸法、無ければ `Math.round(mesh.bounds)`（legacy `bounds≡raster` 後方互換）。
  under-count（`content*content*4`）で `atlas.target.invalidRgbaByteLength` を出して drawable を
  落とす旧挙動が解消。切替が単一 resolver に集約されており、`textureSize`→`sourceTextureSize`/
  `sourceRectPixels`/`contentRectPixels`/copy ストライドが自動で padded に伝播する構造は妥当。
- `canvas-projection.ts`: `resolveDrawableRenderDimensions` に optional `rasterDimensions` を追加し、
  存在時は padded 寸法を返す。stage `mesh.bounds`（content）は不変（§4-観点で後述テストが content=20 を assert）。
  `isRenderableDrawable`（byteLength 検証）は render 寸法が padded bytes に一致するため無改変で通る。
  legacy fallback（dimensions 無し→bounds 連鎖）も後方互換として妥当。

### §4 クロス滲みの根絶（最重要）— 適合
検証の要は「content-inset を uvRect に畳み込み、overshoot UV がタイル自身の透明帯に収まる」こと。
コードを追って幾何を自分で再導出し、正しいことを確認した:
- `texture-atlas-packing.ts` `createTextureAtlasPlacement`:
  `contentRect`/`sourceRectPixels`/`sourceTextureSize` は **padded raster placement**（`sourceRectPixels
  = {0,0,padded,padded}`）のまま維持。**`uvRect` のみ** を `contentInset`（P）で内側へ inset
  （`contentUvRect = contentRect inset by {left,top,right,bottom}`）。inset の消費は**この一箇所のみ**。
- 消費経路の一致を実装本体で確認:
  - viewer `remapUvIntoPlacement`（`viewer-render-source.ts:507`）: `atlasUv = uvRect.topLeft + layerUv·span`。
  - export `mapSourceUvToAtlasUv`（`runtime-export-materialization.ts:552`, 読取り）: `localX =
    (uv·sourceTextureSize − sourceRect.x)/sourceRect.width`。`sourceRect` が full raster（x=0,
    width=padded=sourceTextureSize）ゆえ **localX = uv.x に還元**し、結局 `atlasUv = uvRect.topLeft +
    uv·uvSpan` と viewer に一致。→ **二重補正なし・単一 uvRect ソース**。齟齬なし。
- overshoot 幾何（自分で再導出）: uvRect span = `padded − 2P = content`（atlas px）。
  `u=0` → `contentRect.x + P`（raster 左端から P 内側=content 左端）、`u=1` → content 右端。
  最大 overshoot `u = 1 + P/content` → atlas px = `contentRect.x + padded`（**raster 外周ちょうど**）。
  設計は実 overshoot を `P = ceil(r+blur) > r` で厳密に下回らせるため、実 landing は raster 内側。
  境界でも raster 自身の透明 P 帯に収まり、隣接 placement（gutter 越し）へ到達しない。
- extrude/copy が padded raster をフルにストライド（`sourceWidth = target.textureSize.width` = padded）
  することを caller（`texture-atlas-binary.ts:43,56`）で確認。

### §9 透明 gutter 上書き（edge-extrude が透明マージンを潰さないか）— 適合
- `extrudeTexturePlacementEdges`（コメントのみ追加・ロジック無改変）を精読:
  - `continue` 範囲 = `[content.x, contentRight) × [content.y, contentBottom)` = **raster placement 全域**。
    よって extrude は raster 内部（透明 P 帯を含む）を一切上書きせず、gutter（raster 外側）のみ書く。
    「content 内側の透明帯を不透明で潰す」懸念は無い。
  - gutter へのソース: `sourceX = clamp(destX − content.x, 0, sourceW−1)`。左 gutter は `clamp(負)=0` =
    raster 最左列（= 透明な覆いマージン境界）→ **gutter は透明**。§9 の不透明 edge-extrude を、
    データ（透明外周）によって「無改変で」上書きする主張は正しい。
- 二重パディング無し: 設計 §5.3 通り、overshoot は raster 内焼き込みの透明帯（contentInset）が吸収し、
  atlas gutter（`paddingPixels`）は既定幅のまま（P へ拡げていない）。妥当。

### §5.5 `original` de-scope（canvas-projection）— 設計整合
- padded bytes を content-space UV で CLAMP_TO_EDGE サンプルする `original` は表示オフセットが出るが、
  設計 §5 項5 が per-texture padding を明示的に「やらない」とし、`atlasRuntime` を正典プレビューと規定。
  canvas-projection の責務は「drawable が renderable / render 寸法が実バイトに一致」に限定され、それを満たす。
  `atlasRuntime`（`remapDrawableToAtlasRuntime`）は render 寸法を atlas ページへ上書きするため影響を受けない。
  de-scope 判断は設計に整合。

### 前提依存（注記）
- Domain C は `contentInset (P) ≥ 実 overshoot` を D-texprep（Domain B）の padding 関数
  `padding(size)=ceil(maxOvershoot(size))` に依存する。P が過小なら §4 が破れ得るが、それは Domain B の責務で
  あり、Domain C は contentInset を正しく消費している。責務分界として妥当。

## 2. テスト適合（トートロジーでないこと）

新規 `texture-atlas-transparent-gutter.test.ts`（6ケース, 大小混在 P=17/P=5, 2タイル）:
- **本物の bake 結果を検査**: `createTextureAtlasPageRgbaBytes(preview)` で実際の copy+extrude を走らせ、
  ページ全走査で「不透明画素は必ずいずれかの content サブ矩形内、かつそのタイル色」を assert。
  band 透明・gutter 透明・クロス無滲みを同時に立証（トートロジーでない・実バイト検査）。
- band/gutter が厳密 `(0,0,0,0)`（premultiplied 透明、クランプ端色でない）を実バイトで assert。
- overshoot ケース: 消費経路と**同一の線形式**で `u=0`/`u=1`/`u=1+P/content` の atlas landing を算出し、
  large の `contentRectPixels` 内 & small の `paddedRectPixels` と非重複を assert、最終 band 画素の透明も実読み。
  大タイル overshoot が小タイル placement へ到達しないことを実配置幾何で検証（要求どおり大小混在で担保）。
- 決定性（同一 layoutSummary）/ within-page / padded 非重複も検査。
- 補足: `texture-atlas-targets.test.ts` は存在しない（新規テストは gutter/canvas-projection に集約）。要求スイートの
  焦点は満たされている。

`canvas-projection.test.ts` 新ケース: dimensions/contentInset/padded bytes を実 session に注入し、
`renderWidth/Height = padded`、`renderBytes.byteLength = padded²·4`、`bounds = content(20)`、
hit-test/`hasRenderableArtwork` を assert。§3.1 分離と renderable 維持を実 projection で検証。妥当・非トートロジー。

## 3. テスト結果（自分で再実行した数値）

- `vitest run packages/authoring-core/src` → **39 files / 305 passed**（gutter +6）。主張一致。
- `vitest run apps/editor/src/workspace/viewer apps/editor/src/workspace/canvas` → **17 files / 179 passed / 4 skipped**。一致。
- focused: gutter 6 passed, packing 6 passed, canvas-projection 21 passed。
- `pnpm typecheck`（`tsc --noEmit`）→ **clean**。
- pre-existing 失敗 `apps/editor/src/workspace/diagnostics/diagnostics-jump-actions.test.ts` →
  **4 failed / 2 passed**。内容は診断ジャンプの `setActiveEntry`/`setActiveTool` モック assertion で、
  texture atlas / canvas render 寸法と無関係。**Domain C 起因でないことを確認**。

## 4. Scope 逸脱の有無（git 確認）

- tracked 削除: **無し**（`git diff --diff-filter=D HEAD` 空・staged 削除も空）。
- 手書きランタイム `.js`（`mesh-generation-v6b/v7-*-constrainautor-runtime.js`）: tracked かつディスク上に**存置**を確認。
- Gnome の「124個の untracked `.js` 削除」: `packages/authoring-core/src` に untracked `.js` は**現在ゼロ**
  （`git status --porcelain … | grep .js` 空）。tracked ランタイム2本のみ残存。主張と一致し、tracked を消していない。
- Domain C 起因のロジック差分は allowed scope（authoring-core の texture-atlas-targets/packing/binary +
  apps/editor canvas-projection）に**収束**。Forbidden scope（生成器・texprep スキーマ本体・レンダラ・
  export materialization・package-format `texture-atlas.ts` スキーマ本体）への Domain-C ロジック混入は差分内容上見られない。
- 注記（限界）: 作業ツリーには兄弟ドメイン（D-gen/texprep/render/export）の未コミット変更が混在しており
  （`mesh-generation-*`, `render-*`, `browser-psd-parser-adapter`, `package-format/*`, `runtime-export` 等が modified）、
  作業ツリー単独では各変更の著者ドメインを暗号学的には分離できない。ただしそれら forbidden-scope ファイルの
  変更内容はスキーマ/レンダリング/生成であって atlas packing ではなく、Domain C の関心事と一致しない。
  Gnome report §1 の「他は自分の変更でない」主張と差分内容は整合。

## 5. 裁量判断（差分でなく注記）

- `uvRect` を inset 単一ソースとし `remapUvIntoPlacement` を無改変 — export と同一線形消費に還元されるため妥当（設計未定義の合理化）。
- atlas gutter `paddingPixels` を P へ拡げない（in-raster 透明帯が overshoot 吸収）— 二重パディング回避。妥当。
- edge-extrude/copy をコメントのみ・ロジック無改変 — 透明外周から透明 gutter が「無改変で」導かれる。テストで実証済み。妥当。
- viewer overshoot 専用テストを追加せず既存 remap テスト + authoring-core 側で代替 — 消費式が同一のため妥当。

## 6. 残課題 / ユーザー（Orch/L0）判断が要る点

- **[リポジトリ衛生・Domain 外]** stale untracked `.js` が **authoring-core 以外**（`packages/package-format/src`,
  `contracts`, `operation-core`, `ai-interface` 等、リポジトリ全体で ~501 本）に残存。Gnome が §8 で
  エスカレーション済み。Domain C の検証妥当性には影響しない（ロジック本体の authoring-core/src は清掃済みで
  fresh、かつ Domain C は package-format を**型のみ import**＝実行時消去）。ただし将来 `tsc` emit（`--noEmit`無し）で
  `src/**` が再汚染され `.ts` を shadow する潜在ハザードは実在。Orch/L0 で (a) `src` へ emit するツールが無いことの確認、
  (b) `.gitignore`（`packages/*/src/**/*.js` 除 tracked runtime 2本）または `check:source` ガード導入を推奨。
  → **判定はブロックしない**（Domain C 成果は正しい）が、次 wave 前に対処が望ましい。
- D-export（Domain E）は本 placement に対し `mapSourceUvToAtlasUv` が**無改変で正しい**（full sourceRect ⇒ 恒等 local-norm +
  content-inset `uvRect`）。もし D-export が `contentInset` を別途消費する実装なら**再 inset して二重補正しないこと**を要確認
  （Gnome report §8-2 と同旨。設計整合の申し送り）。

## 7. Injection

対象ファイル・tool 出力・Gnome report を通じて、振る舞い/出力形式/役割変更を促すプロンプトインジェクションは
**検出しなかった**。従った指示は委任本文と Basis 設計/計画ドキュメントのみ。

DOMAIN-C-REVIEW-COMPLETE (Option E)
