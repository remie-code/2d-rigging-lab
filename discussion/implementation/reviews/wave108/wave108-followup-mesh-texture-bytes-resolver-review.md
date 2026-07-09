# Wave108 followup レビュー — mesh texture-bytes resolver padded-raster fix

レビュー担当: Review-Sylph（敵対的検算）
対象: Gnome 回帰修正（`resolveDrawableTextureBytes` の padded/legacy 二分岐 + テスト）
報告書: `discussion/implementation/waves/wave108/wave108-followup-mesh-texture-bytes-resolver-report.md`

## 総合判定: PASS

blocking なし。修正は content 正規化 UV 契約を実際に守っており、追加テストは正規化ズレを本当に捕まえる（mutation で実証）。後方互換・安全側 fallback・スコープいずれも問題なし。nit も実質なし。

---

## チェックリスト各項 verdict

### 1. 契約遵守（padded で content 実ピクセル数を返すか / crop 正しさ） — PASS
- `mesh-generation.ts:2499-2503` `contentWidth = paddedWidth-(left+right)`, `contentHeight = paddedHeight-(top+bottom)`。`bounds` 由来ではなく `dimensions`(padded) から算出 → cropped 実ピクセル数。
- 返す textureSize は `{ width: contentWidth, height: contentHeight }`（`:2520-2526`）。padded バイト素通しでなく、実際に crop したバイトを返す。
- crop ループ `:2511-2515` `srcStart = (row+inset.top)*paddedRowBytes + inset.left*4`、`contentRowBytes` ぶんコピー。行ストライド・オフセット正しい。off-by-one 無し。`padLayerRasterWithTransparentBorder` の厳密逆操作。

### 2. content 正規化の実証（見せかけ緑でないか） — PASS
- 新テスト `mesh-generation.test.ts:2184-2185` が padded fixture と unpadded fixture で `mesh.uvs`／`mesh.vertices` の **バイト一致** を assert。単なる「fallback しない」だけでなく、決定的生成器の入力 byte-identity を経由して UV 正規化ズレを検出する構造。
- **mutation sanity check で実証済み**（下記）: crop オフセットを 0 に潰すと、この UV 等値 assertion が赤くなる（padding 由来 P オフセットが UV に混入 → 検出）。見せかけ緑ではない。

### 3. テストが本物の padded seam を踏むか — PASS
- `padAlphaBytesWithTransparentBorder`（test `:5363-5385`）で content(24x20) を四辺 P=5 の透明ボーダーで padded 化。
- fixture は実 padded 長 `(24+10)(20+10)*4` を store し、texture entry に `dimensions`(padded 34x30)+`contentInset`(5,5,5,5) を載せる（`:5299-5305`）。
- sanity assert `:2149-2151` で store が padded byteLength であり unpadded byteLength と **異なる** ことを確認。unpadded スタンドインでお茶を濁していない。

### 4. 後方互換 — PASS
- legacy 経路（`:2529-2548`）は `contentInset` 無し or 四辺すべて 0 のとき従来の `round(bounds.w/h)`・byteLength 照合・元 bytes 素通しを厳密維持。
- `isPadded` ガード `:2481-2482` は「inset 存在 かつ いずれかの辺 > 0」。旧 package は `contentInset` optional で undefined → legacy へ。破壊なし。
- 既存 unpadded fixture テスト群は全緑（310 tests、下記独立検証）。

### 5. 安全側 fallback — PASS
- `binaryEntry === undefined` → undefined（`:2468-2470`、従来分岐を関数頭に前倒し。挙動同一）。
- padded で `dimensions` 欠落 → undefined（`:2486-2490`、中途半端形を安全に倒す）。
- self-consistency `byteLength != pw*ph*4` → undefined（`:2495-2497`）。
- `cw<=0 || ch<=0` → undefined（`:2501-2503`）。
- crop ループは正の contentWidth/Height に境界され `subarray` 使用 → crash/NaN/負インデックス無し。

### 6. 非一様 inset 一般性 — PASS
- src オフセットは `inset.top`/`inset.left`、寸法は `pw-(left+right)`/`ph-(top+bottom)`。四辺個別に正しく作用。left/top（オフセット）と right/bottom（幅高減算のみ）の取り違え無し。今日は一様 P だが将来非一様でも正しい。

### 7. blast radius（他の取り残し消費者） — PASS（追加の取り残し無しを確認）
- generator ファミリ内の `byteLength !== w*h*4` チェック（v6a/b/c/d, v7, contour-pipeline, alpha-* 等）は全て **resolver が渡す `textureBytes.bytes` / `textureSize`（cropped content）に対する self-consistency** で、session の padded raster を独立に読まない。v6d `:1003-1009` も `input.textureSize`（resolver 由来 content）を使用。resolver が唯一の generator 側 funnel であることを独立確認。
- session binary を読む他箇所（`runtime-export-assembly.ts` はパス複製のみ、`texture-atlas-targets.ts` は atlas bake で `dimensions`/`contentInset`/`uvRect` を正しく使用 = Wave108 別ドメイン済）は本回帰と無関係。Gnome の「resolver 一箇所のみ」結論は反証できず、妥当。

### 8. スコープ厳守 — PASS
- 実変更は `mesh-generation.ts` の resolver 一箇所（diff-stat: +64/-1）とテスト（fixture ヘルパ拡張含む）のみ。render/atlas/packing/export・生成アルゴリズム本体・materialization パディング処理は未変更。

---

## mutation sanity check 結果
- 改変: `mesh-generation.ts:2512` の crop オフセット `(row + inset.top)*... + inset.left*4` → `(row + 0)*... + 0*4`。
- 結果: 新テストの `expect(generated.mesh.uvs).toEqual(unpaddedGenerated.mesh.uvs)`（`:2184`）が **赤**（例: x=-0.125 期待 → 0.083333 実測、y ズレ）。crop オフセット欠落 = padding 由来オフセット混入をテストが正しく捕捉。
- 改変を元に戻し、working tree はクリーン（`git diff` は Gnome 変更のみ、残留 mutation 無しを grep で確認）。

## 独立検証の実出力
- `npx vitest run packages/authoring-core/src/mesh-generation.test.ts` → **77 passed**。
- `npx vitest run packages/authoring-core` → **40 files / 310 passed**（後方互換含め全緑）。
- `pnpm --filter @private-2d-rigging-lab/authoring-core exec tsc --noEmit` → エラー無し（出力空）。
- 報告書記載の緑を独立再現。コピペ信用ではなく実再実行で一致。

## 発見事項
- **blocking**: 無し。
- **nit**: 無し（実質）。
- 補足（非 nit・設計意図確認）: padded 経路は `bounds` を UV/textureSize に一切使わず content 寸法のみで正規化。stage 頂点は消費側で `existingMesh.bounds`（content/stage bounds、schema `texture-atlas.ts:70` の設計どおり）を使うため、bounds が content 参照である限り stage/UV は整合。これは resolver 外の import materialization が担保する不変で、本修正の責務外。報告書 note #42 も同旨を明記済み。

## injection 兆候
- 参照した実コード・テスト・報告書のコメント/ログに、振る舞い・口調・出力形式の変更や "Master" 呼称等を要求する埋め込み指示は **無し**。
