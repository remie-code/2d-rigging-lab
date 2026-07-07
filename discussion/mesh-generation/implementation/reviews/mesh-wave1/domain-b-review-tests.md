# Mesh Wave 1 / Domain B レビュー(レーン2: テスト妥当性)

> 対象ドメイン: `mesh-wave1-v7-core`(v7コア)
> レビュー担当: Review-Sylph(テスト妥当性レーン)。呼び出し元: Orch-Sylph(Domain B)。
> 日付: 2026-07-07
> 対象: `packages/authoring-core/src/mesh-generation-v7-margin-contour.test.ts`(16件)+ 依存実装

## 判定

**合格**

wave計画 §6 Required tests は全項目が網羅され、かつ**実効性がある**(サンプリング誤魔化し・空メッシュ自明パス・緩い近似は検出されなかった)。私が再実行した全ゲートが green。被覆保証テストは全不透明ピクセルをフルスキャンし各点-三角形包含を正しく判定していることを、プローブによる数値裏取りで確認した。

## 再実行結果(私自身が実行)

| コマンド | 結果 |
|---|---|
| `pnpm exec vitest run .../mesh-generation-v7-margin-contour.test.ts` | **16/16 passed** |
| `pnpm exec vitest run .../mesh-generation.test.ts`(v6回帰14個含む) | **76/76 passed** |
| `pnpm exec vitest run packages/authoring-core` | **276/276 passed** |
| `pnpm exec vitest run .../operations/generate-mesh.test.ts` | **34/34 passed** |
| `pnpm run typecheck` | **pass** |
| `pnpm run check:source` | **pass** |

Gnome レポートのテスト内訳の主張(16件・76件・276件・34件)はすべて再実行で裏取り一致。

## Required tests 網羅状況と実効性評価

### 1. 被覆保証(本waveの核) ○ 実効的

- **フルスキャンか**: ○。`assertEveryOpaquePixelCovered`(test:461-483)は `for y / for x` の二重ループで**全ピクセルを走査**し、`isOpaque(x,y)` な各点(ピクセル中心 `+0.5`)について包含を検査。サンプリング・間引きなし。uncovered/firstUncovered を集計して `{uncovered:0}` を assert するため、1点でも漏れれば座標付きで fail する(実効的な失敗検出)。
- **包含判定の正しさ**: ○。`pointInTriangle`(test:544-556)は標準の同符号判定。「全て同符号 OR ゼロ許容」の**寛容側**実装で、境界上ピクセルを漏らさない=被覆主張の方向として正しい。ゼロ面積三角形は実装側 `filterTrianglesInsideBoundary`(pipeline:612)で事前除外済みのため、退化三角形による誤陽性(実際は覆っていないのに覆うと誤判定)は起きない。
- **誤陽性でないことの実証**: プローブで塗り潰し円(opaque=441点)を生成し、far-outside 点(-100,-100)が covered=**false** を確認。メッシュは「全域を無条件に覆う」のではなく、有界な三角形群で厳密判定している。空メッシュ自明パスでもない(11点/10三角形が実生成)。
- **細い毛先 fixture が実際に細いか**: ○。tail は幅 3px(x=13..15)、閾値 R=12px。プローブで status=generated・interior=2(body の厚い部分のみ)・tail は内部点なし=細長三角形で包む(特徴3)ことを確認。fixture は真に細い。
- **膨張とオフセットの整合**: 元不透明ピクセルの中心は膨張輪郭(元絵より r=4px 外側)の十分内側にあるため、`+0.5` オフセットや寛容/厳密判定の差は結果に影響しない。堅牢。

### 2. 決定性 ○ 実効的

- test:141-174。同一入力2セッションで **vertices / uvs / triangles / vertexStableIds / triangleStableIds の5フィールド全て**を `toEqual` で完全一致検査。一部フィールドのみの手抜きではない。加えて `first?.source` を assert して v7 経路を通ったことを担保。実装側も乱数不使用・tie-break ソート・座標丸めで決定性を構成しており、テストが検査する主張と実装が整合。

### 3. ε < r ○ 実効的

- test:62-73。`[16,64,256,1024,4096]` × `high/medium/low` = **全15行をループ**で `simplifyEpsilon < marginRadiusPixels` を assert。プリセット導出テーブル全行・複数テクスチャサイズ網羅。
- プローブで全15行の実値を確認: r は 4/12/16 と複数値をカバー、ε=0.8r で全行 ε<r 成立(ANY_EPS_GE_R: false)。テクスチャ小(r floor=4)でも ε=3.2<4 が成立し、境界条件も踏んでいる。

### 4. 細長抑制 ○ 実効的

- test:182-201。strand(6px tall, y=9..14)で `interiorPoints.length === 0` かつ `points.every(role==="boundary")` を検査。
- **fixture が実際に細長いか + 抑制が実際に働いたか**: ○。プローブで strand高=6px < R=18px、`thinRegionSuppressedInteriorCandidateCount=868`(膨張成分の全ピクセルが距離変換で細長判定→抑制)、interior=0、点数11・三角形9で**メッシュは生成される**。つまり「空メッシュだから内部点0」ではなく、距離変換による抑制ロジックが実際に発火した結果の0。加えて太い領域(50×50)で interior>0 を確認するペアテスト(test:203-218)があり、抑制が無差別でないことも担保。

### 5. プリセット単調性 ○ 実効的

- パラメータ単調性(test:75-87): L(high 12 < medium 18 < low 28)、r/ε がプリセット不変、`V7_VERTEX_SPACING_PIXELS` の定数値まで assert。
- 出力単調性(test:226-247): 同一 blob で頂点数 high > medium > low を検査(L の逆順=密度が高いほど頂点多)。wave計画 §6「頂点数はその逆順」を満たす。r クランプ [4,16] の下限/上限も別途 assert(test:89-92)。

### 6. UV範囲/零面積/多島/穴埋め ○ 実効的

- **UV [0,1] + 零面積三角形なし**(test:255-298): 全 uv を [0,1] で範囲検査、全三角形の signed area を計算して `≠ 0` かつ `abs>0` を assert。加えて vertices/uvs/stableIds の長さ整合も検査。
- **多島**(test:330-367): 2島 fixture で stableId の `_island_<n>_` スコープが2種以上あることを検査し、**両島の全不透明ピクセル被覆**を assembled MeshDto(stage空間)でフルスキャン検査。本 fixture は bounds==textureSize なので stage 変換が恒等となり pixel-space 検査と一致=変換の妥当性も保たれる。
- **穴埋め(donut)**(test:375-393): 穴中心ピクセル(21,21 = 元絵は透明)が `isPixelCoveredByPixelMesh` で covered=true を検査。§4「穴は全部埋める」を実検査(外周ループのみ制約辺化+重心内包フィルタで穴を充填する実装と整合)。

### 7. 既存挙動の無傷 ○

- v6 決定性回帰を含む `mesh-generation.test.ts` 76/76 green(私が再実行)。exact 座標 `toMatchObject` 検証のため1座標でも動けば fail する。全 green = v6 座標同一。v7 は v6 ファイルを import しない自己完結構成(git status 上も v6 ファイルは import 切替=Domain A の変更のみ、v7 ファイルは新規)で干渉なし。
- 契約 wiring テスト(test:40-53): method/source/backend ID・`isV7` ガード(v6d誤判定 false 含む)・candidate 依存 sort を検査。V7系統分離が機能していることを担保。
- フォールバック(test:400-437): alpha空 → v6d-adaptive連鎖接続・v7ステップ先頭記録、texture欠如 → `texture-bytes-unavailable`。V7系統の blocked が既存連鎖へ正しく接続することを検査。

## 実効性に欠けるテスト・抜けているテスト

**なし。** wave計画 §6 Required tests の全項目が存在し、いずれもサンプリング・空メッシュ自明パス・緩い近似で誤魔化していないことを、コード読解 + プローブ数値裏取りで確認した。強いて挙げれば以下は「欠け」ではなく観察:

- 被覆保証 fixture のテクスチャサイズは小さく(40×36 等)r=4px 固定域に留まる。大テクスチャ(r=12/16)での被覆保証はテストされていないが、被覆は膨張で構成的に担保される不変で r に単調(r が大きいほど輪郭は外側=より安全)なため、小サイズで担保できれば大サイズでも破れない。抜けとは判定しない。
- pointInTriangle の寛容判定は被覆主張には正しい方向だが、「厳密内部でなく境界上でも covered」を許す。元絵ピクセル中心は膨張により輪郭の十分内側に来るため実害なし(上記1で実証済み)。

## 質問(Orch-Sylph 経由での確認事項)

なし。テスト妥当性の観点では合格。Gnome レポートの質問2件(pointKey丸め方針の解釈確認 / モノレポ横断12 fail の是正主体)はテスト妥当性レーンの領分外だが、後者は既知・受容状態(委任契約の「横断 fail を本ドメインの blocker と誤認しない」に沿う)であり、本レーンの判定に影響しない。

## レビュー手法の記録

- 対象テスト・依存実装(pipeline/parameters/margin-contour)・wave計画§6・concept-design§3 を精読。
- 全ゲートを私自身で再実行(上表)。
- 一時プローブテスト(authoring-core 内に配置→実行→削除)で以下を数値裏取り: 細長 fixture の実寸法と抑制発火(suppressed=868/interior=0)、blob 被覆の誤陽性なし(far-outside=false)、毛先 fixture の実寸法、ε<r 全15行の実値。プローブは削除済み・git status に痕跡なしを確認。読み取り専任を遵守(実装・テストコードは無変更)。
