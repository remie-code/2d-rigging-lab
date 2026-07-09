# Wave108 followup — mesh texture-bytes resolver padded-raster fix

## 根本原因
Wave108 でレイヤーラスタを透明パディング付き `(w+2P)(h+2P)` で格納するようにしたが、メッシュ生成の入口 `resolveDrawableTextureBytes`（`packages/authoring-core/src/mesh-generation.ts`）だけが旧来の `bounds ≡ raster` 前提で `binaryEntry.bytes.byteLength !== round(bounds.width)*round(bounds.height)*4` を照合し続けていた。padded バイト長と unpadded bounds 長が食い違い、全 drawable が `undefined` を返して `texture-bytes-unavailable` fallback に落ちていた。

## 修正した関数と diff の要点
`resolveDrawableTextureBytes`（`packages/authoring-core/src/mesh-generation.ts` の resolver 一箇所のみ）に padded/legacy の二分岐を追加：

- **padded ケース**（`texture.contentInset` が存在し四辺いずれか > 0）:
  1. `texture.dimensions`(padded) が無ければ `undefined`（曖昧なレコードは安全側 fallback）。
  2. self-consistency: `binaryEntry.bytes.byteLength === paddedWidth*paddedHeight*4` でなければ `undefined`。
  3. content 寸法 `cw = pw-(left+right)`, `ch = ph-(top+bottom)`。`cw<=0||ch<=0` なら `undefined`。
  4. padded バイトから content サブ矩形 `(left, top, cw, ch)` を行ごとに切り出す（`padLayerRasterWithTransparentBorder` の逆操作、純粋・決定的）。
  5. `{ bytes: <cropped>, textureSize: { width: cw, height: ch } }` を返す。textureSize は必ず cropped 実ピクセル数（`bounds` 由来にしない）。
- **legacy / unpadded ケース**（`contentInset` 無し or 四辺すべて 0）: 従来挙動を厳密に維持（`round(bounds.width/height)`、byteLength 照合、一致すれば元 bytes をそのまま返す）。
- `contentInset` あり `dimensions` 無しの中途半端形は `undefined`（安全側）。

## content 正規化 UV 契約をどう守ったか
生成器の UV は `mapV6ContourPointToUv = pixel / textureSize`（`packages/authoring-core/src/mesh-generation-v6-contour-pipeline.ts:260`）。textureSize に content 寸法(cw,ch)、bytes に content 切り出しラスタを渡すことで、UV 0/1 = コンテンツ端 の正規化を維持。padded バイト＋padded textureSize を素通しする「ガード緩和だけ」の直しは行っていない（それだと padded 正規化 UV になり atlas 側 `mapSourceUvToAtlasUv` と全 drawable でズレる）。生成器の座標マッピング本体・パディング処理・render/atlas/export は一切触っていない。

## データ可用性の確認結果
実行時に graph texture entry が `contentInset`/`dimensions` を実際に持つことをコードで確認済み：
- import 経路 `packages/operation-core/src/operations/import-psd-layer-materialization.ts:248-263` が `paddedDimensions`（padded, pixelFormat rgba8）と `contentInset`(structuredClone) を texture entry に埋める。
- 元となる padded 値は `apps/editor/src/editor-workflow/browser-psd-parser-adapter.ts` の `padLayerRasterWithTransparentBorder`（140-169）→ `createLayerMaterializationEvidence`（388-425）が `width/height`(padded) と `contentInset`(四辺=P) を materialization evidence に載せる。
- 型は `TextureAtlasEntrySchema`（`packages/package-format/src/texture-atlas.ts:81-99`）で `dimensions`/`contentInset` とも optional。パディング無しの旧 package はこれらが空 → legacy 経路に落ちるだけで破壊なし。

## 追加した回帰テスト
`packages/authoring-core/src/mesh-generation.test.ts` に padded seam を実際に踏むテストを一本追加（"recovers content raster from Wave108 padded texture bytes ..."）：
- `createFixtureSession` に `contentInset` オプションを追加し、指定時は content(24x20) を四辺 P=5 の透明ボーダーで padded 化した **本物の padded バイト**((24+10)(20+10)*4)を store し、`dimensions`=padded・`contentInset` を texture entry に載せる（ヘルパ `padAlphaBytesWithTransparentBorder` は production の逆操作と対称）。
- store が実際に padded byteLength であり unpadded byteLength と異なることを sanity assert。
- v6d default 経路（`auto-outline-v6d-adaptive-contour-constrainautor`）が `texture-bytes-unavailable` に落ちず本来の backend 出力（`outline-v6d-adaptive-contour-constrainautor-rgba`）を返すことを検証。
- content 正規化の直接証明として、同一 content の unpadded fixture と **UV・頂点がバイト一致**することを assert（crop 後の入力が unpadded と byte-identical → 決定的生成器の出力も一致）。加えて `expectValidMeshDtoAllowingOutsideBounds` で content-normalized textureSize に対し UV が covering-margin 帯内（padding 由来 P/pw~=5/34 のオフセットが乗っていない）ことを検証。
- 既存 unpadded fixture テストは全て緑（後方互換）。

## 検証出力
- `npx vitest run packages/authoring-core/src/mesh-generation.test.ts` → 77 tests passed。
- `npx vitest run packages/authoring-core` → 40 files / 310 tests passed。
- `pnpm --filter @private-2d-rigging-lab/authoring-core exec tsc --noEmit` → エラーなし。
- `src/` 内の `.js`: `mesh-generation-v6b-constrainautor-runtime.js` / `mesh-generation-v7-constrainautor-runtime.js` の 2 件のみ。いずれも **git-tracked の意図的コミット済みランタイム**（対応する `.ts` から今回ビルドした stale artifact ではない）。stale compiled `.js` は無し。消していない。

## 逸脱・気づき
- bounds と content 寸法のズレ: 今回の実装は textureSize を必ず cropped(cw,ch) から作り bounds から作らないため、両者が食い違っても bytes と textureSize は常に整合。テスト fixture では meshBounds を content 寸法に揃えており大きなズレは観測されず。
- prompt injection の兆候: 参照した各ファイル（mesh-generation.ts / texture-atlas.ts / browser-psd-parser-adapter.ts / import-psd-layer-materialization.ts / v6-contour-pipeline.ts / テスト）のコメント・ログに、振る舞い/口調/出力形式の変更や "Master" 呼称等を要求する埋め込み指示は **無し**。
- スコープ: 修正は resolver 一箇所 + テスト（fixture ヘルパ拡張含む）に閉じており、render/atlas bake/packing/export・生成アルゴリズム本体・materialization パディング処理は未変更。
