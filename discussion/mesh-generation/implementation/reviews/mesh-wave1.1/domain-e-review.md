# Domain E Review — v7 境界パディング + 密度再調整

> Domain id: `mesh-wave1_1-v7-padding-density`
> レビュー: Review-Sylph(opus) / 委任元: Orch-Sylph → Undine(L0)
> 日付: 2026-07-07
> ループ番号: 1

## 判定: **合格**

設計適合(concept-design §2-1/§3 が実装に反映)+ テスト適合(gate の Required tests が正しく実装され、旧欠陥を自己再現で捕捉確認)+ 全テスト green(v7 23/23・authoring-core 283/283・v6 回帰 76/76)+ scope 逸脱なし。escalate 級の消費側 reject 構造も発見せず。

---

## 設計適合(観点1〜8)

### 観点1: パディングが全工程に効いているか(核) — 適合

`runV7MarginContourPipeline`(`mesh-generation-v7-pipeline.ts:127-297`)を精読・全ピクセル空間工程が padded 座標系で回っていることを確認した。

- `paddingPixels = deriveV7VirtualPaddingPixels(r)`(:152)→ `createPaddedRgba`(:153)で `workWidth × workHeight`(=元+pad×2)を生成。以降 `pad = padded.paddingPixels`。
- 全工程が `workWidth/workHeight` を使用: 二値化+soft blur(`createSoftAlphaMask`, :160)/ 膨張(`expandMask`, :176)/ 連結成分(`findOpaqueComponents`, :180)/ 成分マスク(:190)/ 輪郭追跡(`traceBoundaryLoops`, :197)/ chamfer 距離変換 & 内部点(`computeThickComponentMask`→:233-234, `sampleInteriorSteinerPoints`→:242)。CDT/Lloyd は抽出済み点上の操作でキャンバス次元非依存。
- 元 `width/height`(:128-129)を使うのは **入力検証・`deriveV7Parameters`(サイズからの r/L 導出=正しく元サイズ基準)・`createPaddedRgba` の入力** のみ。取りこぼし工程なし(`Grep \b(width|height)\b` 全ヒットを目視確認済み)。
- 中立モジュールは全て width/height を明示引数で受け、その座標系で歩く(`traceBoundaryLoops:23-27`, `sampleInteriorSteinerPoints:38-44`)。よって渡した padded 次元がそのまま効く。
- 膨張が pad 余白へ広がれる構造: `expandMask`(`alpha-mask.ts:220-250`)は4近傍反復膨張で、padded キャンバスの透明余白ピクセルを on にできる。pad(=⌈r+2⌉)> r(膨張量)なので、膨張は pad 端に到達せず余白内で完結(pad>r アサートで担保、後述)。concept-design §2-1「作業空間の仮想パディング pad ≈ ⌈r+ぼかし半径⌉」・§3「膨張の非クランプ」と一致。

### 観点2: 端張り付きテストが旧欠陥を再現→解消しているか — 適合(自己再現で実証)

`describe "v7 boundary non-clamp"`(`.test.ts:142-225`, 200×160 全ブリード矩形)の (a)(b)(c) を精読。

- **(a)**(:153-178): 輪郭頂点の過半数が元 bounds 外、かつ bbox が四辺すべて厳密超過(minX<0, minY<0, maxX>width, maxY>height)。クランプ下では原理的に全頂点が [0,width]×[0,height] 内 → outside=0 が必然なので、**クランプ実装なら必ず落ちる**論理。
- **(b)**(:180-199): 各元エッジ線上の頂点数 `< 3`(wallThreshold=3)。クランプ下では全ブリード側が丸ごとエッジ線に乗り ⌈辺長/L⌉≈4〜5個の壁ができる。padded 下では輪郭が軸を横切る孤立点(≤2)のみ。閾値3は両レジームを分離する。
- **(c)**(:201-209): `assertEveryOpaquePixelCovered` の全走査(sampled でない、`.test.ts:702-724`)。coverage はクランプ下でも成立するのが正しく、緩和ではない。

**自己再現検証(実施)**: `deriveV7VirtualPaddingPixels` を一時的に `0 * Math.ceil(...)`(=pad常時0=クランプ相当)へ上書きし v7 スイート実行 → **(a)・(b)・pad値・bounds拡張の4件が fail、(c) coverage は pass**:
- (a) `expected 0 to be greater than 5`(outside=0)
- (b) `expected 3 to be less than 3`(壁=3)
- pad `expected +0 to be 6`
- bounds拡張 `expected false to be true`

Gnome の主張(§4)と完全一致。テストが旧欠陥を確かに捕捉することを **私自身の再現で確認**した。上書きは直後に元の `Math.ceil(marginRadiusPixels + V7_SOFT_MASK_GROWTH_PIXELS)` へ復旧し、v7 23/23 green を再確認済み(残置なし)。

### 観点3: bounds 拡張の整合 — 適合

- `unionStageAlphaBounds`(`margin-contour.ts:238-257`)は各島の pixel bounds を min/max 合成のみ。**clamp-back なし**。v6d の `unpadVirtualPixelBounds`(clamp)は踏襲していない(`Grep unpadVirtualPixelBounds` は v7 ファイルにヒットなし)。
- pipeline 側 `unpadPixelBounds`(:317-325)は pad を差し引くのみ(clamp なし)→ padded 成分 bounds が元 drawable bounds 外へ自然に伸びる。
- `describe "v7 bounds expansion"`(`.test.ts:231-287`)が (i) 少なくとも1頂点が元 bounds 外、(ii) alphaBounds が元 bounds 外へ拡張、(iii) 全頂点が拡張後 alphaBounds に包含、を検証。green 確認済み。

### 観点4: UV[0,1] クランプ維持 — 適合

`mapPixelPointToUv`(`margin-contour.ts:269-276`)が `clamp(pixel/textureSize, 0, 1)`。pad 領域に出た負値/超過ピクセルは 0/1 に張り付く。`keeps UVs clamped to [0,1] even for vertices pushed outside`(`.test.ts:289-322`)が全 UV∈[0,1] かつ端値0/1の出現を検証。validator `mesh.uvCoordinateOutOfBounds`(error, `check-catalog.ts:1388`)に抵触しないことを担保。

### 観点5: 既存不変条件の無傷 — 適合(意味論の緩和なし)

- 被覆保証: `assertEveryOpaquePixelCovered` は **全走査**(`.test.ts:710-723`、sampled 化していない)。(c)・coverage guarantee・multi-island で使用。
- 決定性: `v7 determinism`(:381-416)が vertices/uvs/triangles/stableIds の完全一致を検証。pipeline は乱数なし、unpad は `roundCoordinate`(1e-6)で決定性保持(:300-325)。
- ε<r: `holds ε < r for every preset`(:63-74)。
- 零面積なし: `mesh validity`(:495-539)が全三角形 signedArea≠0。pipeline も `TRIANGLE_AREA_EPSILON` フィルタ(:671)。
- 多島(:570-608)・穴埋め(:615-635): green。
- UV[0,1] チェックは緩んでいない(観点4)。v6 回帰 76/76 green(下記)。

### 観点6: 密度 — 適合

- `V7_VERTEX_SPACING_PIXELS = { high: 28, medium: 42, low: 64 }`(`parameters.ts:60-64`)。単調性 high<medium<low。r・ε 導出式据え置き(`r=clamp(0.012·longEdge,4,16)`, `ε=0.8r`, :29-42,163-170)。
- 出典コメント: JSDoc に「confirmed by the user in the world-visual evaluation gate, round-trip 1 (2026-07-07)」明記(:53-58)。
- テスト: `moves only L across presets`(:76-89)が新値 `{28,42,64}` を直接アサート・`boundary spacing tracks L`(:329-374)が実測中央値を [0.5L,1.2L] 帯で検証。

### 観点7: scope 逸脱なし — 適合

- Domain E が編集した実ファイルは Gnome 報告どおり: `mesh-generation-v7-pipeline.ts` / `mesh-generation-v7-parameters.ts` / `mesh-geometry/alpha-mask.ts`(追加のみ)/ `mesh-generation-v7-margin-contour.test.ts`。すべて Allowed scope。
- `mesh-generation-v7-margin-contour.ts` は無改修(写像層は既存線形写像がそのまま活きる)を確認。
- alpha-mask.ts の既存関数(`createSoftAlphaMask`/`expandMask`/`resolveMaskExpansionPixels` 等)はシグネチャ・本体不変。追加は `PaddedRgba` 型 + `createPaddedRgba` のみ(:23-64)。**v6 回帰 76/76 green** が数値挙動不変の傍証。
- git 上の `M`(tracked)ファイル(`apps/editor/**` 4件・`mesh-generation-contract.ts`・fixtures 多数)は **Mesh Wave 1 の未コミット統合層残置** であり Domain E の変更ではない。裏取り: これら `M` ファイルに Domain-E 固有マーカー(`virtualPadding`/`SOFT_MASK_GROWTH`/`createPaddedRgba`/28·42·64/padding)は `Grep` で**一切ヒットせず**。Forbidden(v6系変更・契約変更・apps・依存/lockfile・コミット)への Domain E 由来の接触なし。

### 観点8: escalate 不要の裏付け — 適合(自分でも確認)

pre-wave-inventory §2/§4 を鵜呑みにせず該当箇所を再確認:

- previewMesh 検証(`generate-mesh.ts:274-301`): 三角形 index 範囲外と repeated-index のみ検査。**頂点 bounds チェック・UV チェックなし** → bounds 外頂点を reject しない。
- validator `mesh.uvCoordinateOutOfBounds`(`check-catalog.ts:1388`, `mesh-semantics.ts:630`): UV[0,1]外が error だが、v7 は UV を clamp 済み(観点4)→ 抵触なし。
- `Grep uvCoordinateOutOfBounds|clampToBounds|outsideBounds|vertexOutOfBounds` で packages 全域を捜索 → 頂点を bounds に clamp/reject する新構造なし。
- 消費側で alphaBounds を clamp-back する箇所なし。

**escalate 不要**。

---

## テスト適合(gate の Required tests ごと)

| Required test(plan §3) | 実装 | 状況 |
|---|---|---|
| 境界非クランプ (a) 元 bounds 外 | `.test.ts:153-178` | 適合・pad0で fail 確認 |
| 境界非クランプ (b) 張り付き消失 | `.test.ts:180-199` | 適合・pad0で fail 確認・閾値3は妥当 |
| 境界非クランプ (c) 被覆保証維持 | `.test.ts:201-209` | 適合・全走査 |
| bounds 拡張の正しさ(全頂点包含・pad 補正整合) | `.test.ts:231-287` | 適合 |
| 密度: 各プリセット実測間隔が新 L・単調性 | `.test.ts:329-374` | 適合 |
| 既存不変(決定性/ε<r/UV/零面積/多島/穴埋め) | 各 describe | 適合・緩和なし |
| v6 回帰 + 既存 green | `mesh-generation.test.ts` | 76/76 green |
| pad = ⌈r+growth⌉ かつ pad>r | `.test.ts:211-224` | 適合 |

---

## テスト結果(自己再実行)

すべて repo ルートから `npx` で read-only 実行(`pnpm install` せず)。

| 対象 | 結果 |
|---|---|
| v7(`mesh-generation-v7-margin-contour.test.ts`) | **23/23 pass** |
| authoring-core 全体(35ファイル) | **283/283 pass** |
| うち v6 回帰(`mesh-generation.test.ts`) | **76/76 pass** |
| mesh-geometry smoke | **12/12 pass**(283に含む) |
| `tsc --noEmit`(repo 全体) | **pass**(exit 0) |
| `check:source` | **pass**(Source organization guard passed) |
| `check:deps` | **pass**(Dependency guard passed) |

Gnome 報告の件数(v7 23・全体 283・typecheck/check green)と完全一致。

---

## 裁量判断の妥当性評価

- **soft-mask growth = 2px**(`V7_SOFT_MASK_GROWTH_PIXELS`, `parameters.ts:117`): 妥当。`createSoftAlphaMask` を精読 → `blurAlphaAt`(3×3 加重平均, カーネル半径1, `alpha-mask.ts:117-138`)が soft 閾値0.18で真の境界1px外の背景を on にしうる + `closeSinglePixelCracks`(3×3, `:140-153`)がさらに最大1px。合計2px は安全側上限として正当。`removeIsolatedAlphaNoise` は縮小方向で成長に寄与せず(:155-169)、除外判断も正しい。named constant 単一箇所定義で将来のカーネル変更時に見直しやすい。
- **pad を pipeline 内部に閉じ、写像層無改修**: 妥当。v7 は clamp しないため v6d の写像層 unpad+clamp を持ち込まない方が意味論が明快。既存線形写像 `mapPixelPointToStagePoint`(:259-267)が bounds 外へ自然に伸びる。
- **`createPaddedRgba` を alpha-mask.ts に追加**: 妥当。二値化入口の中立操作として自然。pad=0/不正入力で原バッファを返すガード(:48-51)も安全。v6 ファイル非 import。
- **(b) 壁閾値=3**: 妥当。自己再現でクランプ時=3、padded時≤2 を確認、クリーンな分離。

裁量はいずれも設計オラクルの範囲内で合理的。意味論の緩和・オラクル逸脱なし。

---

## 差分・残課題

**なし。**

軽微な観察(修正不要・情報として記録):
- `deriveV7VirtualPaddingPixels` の `Math.ceil` は r が整数(`Math.round` 済み, `parameters.ts:163`)のため実質恒等。Gnome も JSDoc(:119-127)で明記済み。設計意図保持のため残置は妥当。指摘なし。

---

## 質問

なし。設計オラクル(concept-design §2-1/§3, evaluation-log 往復1, plan §3)で全論点が確定しており、実装・テストとも整合。Gnome の裁量判断(soft-mask growth=2px 等)も検証の結果すべて妥当と確認した。
