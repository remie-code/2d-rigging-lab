# Mesh Generation Design Map

> Mesh生成アルゴリズム、品質基準、非ゴール、実装時の検証観点を扱う設計トピック。画面上の操作UXは `screen-design/` に置き、ここでは「どう生成するか」を扱う。

## ファイル一覧

| Path | Role | Status |
|---|---|---|
| [_map.md](_map.md) | このディレクトリの入口地図 | Active |
| [auto-outline-v2.md](auto-outline-v2.md) | Drawable RGBA alpha maskから自然な初期meshを生成する `auto-outline-v2` アルゴリズム候補 | Draft algorithm spec |
| [auto-outline-v2-5-soft-boundary.md](auto-outline-v2-5-soft-boundary.md) | `auto-outline-v2` を基礎に、bounds比率ベースのsoft boundaryで輪郭だけ少し包み、V2より粗いmeshを生成する次の主候補 | Draft algorithm spec / current next candidate |
| [auto-outline-v2-6-soft-apron.md](auto-outline-v2-6-soft-apron.md) | V2.5の内部密度を維持し、alpha輪郭外側に薄いapron triangle帯を追加して境界不足を補う次候補 | Draft algorithm spec / next refinement candidate |
| [auto-outline-v3-envelope.md](auto-outline-v3-envelope.md) | `auto-outline-v2` 後の実験候補。alpha輪郭そのものではなく外側包絡 envelope boundary を使う方針だが、現状は包絡が強すぎるリスクがある | Draft algorithm spec / experimental |
| [auto-outline-v4-contour-band.md](auto-outline-v4-contour-band.md) | Cubism三段階自動メッシュの観察をもとに、輪郭帯を明示生成し、その内側をpreset別target sizeで三角形充填する別系統候補 | Draft algorithm spec / next sidecar candidate |
| [auto-outline-v4-recursive-offset-ring.md](auto-outline-v4-recursive-offset-ring.md) | V4試行後の最新整理。輪郭点を頂点化せず、内側から外側へoffset ringを成長させ、最後にalpha contourを高さ中央付近に通す輪郭帯を作る候補 | Draft algorithm spec / current discussion snapshot |
| [auto-outline-v5-recursive-contour-band.md](auto-outline-v5-recursive-contour-band.md) | V4試行の破綻を受けた次候補。中心seedから広げず、輪郭点群を覆う三角形帯を最外層として確定し、内側へ帰納的にring-to-ring三角形帯を展開する | Draft algorithm spec / current next candidate |
| [auto-outline-v6-alpha-constrained-delaunay.md](auto-outline-v6-alpha-constrained-delaunay.md) | alpha mask、adaptive contour simplification、adaptive interior sampling、boundary-preserving triangulationで初期meshを生成する新規sidecar候補。既存実装をアルゴリズム根拠にしない | Draft algorithm spec / current sidecar target |
| [auto-outline-v6b-constrainautor.md](auto-outline-v6b-constrainautor.md) | v6 shared pipelineの `delaunator + @kninnug/constrainautor` triangulation backend。Editor一時比較用 | Draft backend spec / temporary comparison sidecar |
| [auto-outline-v6c-poly2tri.md](auto-outline-v6c-poly2tri.md) | v6 shared pipelineの `poly2tri` triangulation backend。Editor一時比較用 | Draft backend spec / temporary comparison sidecar |
| [auto-outline-v6-library-candidate-inventory.md](auto-outline-v6-library-candidate-inventory.md) | v6 sidecarで利用可能な外部ライブラリ候補、依存リスク、spike順序の調査メモ | Research inventory |

## 境界

- ここではMesh Toolのボタン配置、Inspector layout、Canvas toolbarなどのUXを扱わない。
- 画面仕様は [../screen-design/components/mesh-tool.md](../screen-design/components/mesh-tool.md) を正とする。
- Mesh境界の白線、透明境界のにじみ、WebGL2 / Canvas2Dなどの描画方式は [../mesh-rendering/](../mesh-rendering/_map.md) を正とする。
- ここではCubism互換、pixel-perfect再現、semantic preset selectionを主張しない。

## 現在の焦点

- Wave62で `auto-outline-v1` により矩形grid主体から輪郭追従へ進んだ。
- Wave63で `auto-outline-v2` により自然なtriangular meshへ大きく近づいた。
- `auto-outline-v2.5-soft-boundary` は、V2比でLarge Motionの密度と見た目を大きく改善し、現在の主候補として扱う。
- `auto-outline-v2.6-soft-apron` は、V2.5の内部密度を保ったまま、輪郭外側に薄いapron triangle帯を追加して頭頂部などの境界不足を補うrefinementである。
- `auto-outline-v4` 系は、中心seedから広げる方式や局所normal offsetで折り返し・重なり・interior-fill failureが残ったため、次候補は [auto-outline-v5-recursive-contour-band.md](auto-outline-v5-recursive-contour-band.md) とする。
- `auto-outline-v3-envelope` は、外側包絡が強すぎるとDrawable描画領域から外れやすいことが分かったため、現時点では実験候補として扱う。
- 2026-06-14のユーザー判断により、新方式は `auto-outline-v6` sidecarとして扱う。v6の設計根拠は [auto-outline-v6-alpha-constrained-delaunay.md](auto-outline-v6-alpha-constrained-delaunay.md) に限定し、既存実装やV1-V5系統をアルゴリズム根拠にしない。
- v6は最終的に1方式へ絞る前提で、動作確認中だけEditorから `v6a local` / `v6b constrainautor` / `v6c poly2tri` を切り替えられる一時比較用backendとして扱う。

## 次の作業候補

1. `auto-outline-v6-alpha-constrained-delaunay` をsidecarとして実装計画に載せる。
2. 実装ノームには、v6文書をアルゴリズムsource of truthとし、既存mesh生成実装を参照しないことを明示する。
3. `v6b` と `v6c` の依存追加を許可する場合は、[auto-outline-v6-library-candidate-inventory.md](auto-outline-v6-library-candidate-inventory.md) のdue diligenceを先に満たす。
4. Editorには一時比較用selectorとして実装し、最終方式選定後に削除しやすい境界にする。
5. アルゴリズム品質の自動テスト境界と、人間visual check境界を分ける。
6. Mesh形状品質とmesh rendering品質を混同しない。描画方式の改善は [../mesh-rendering/mesh-image-rendering-architecture.md](../mesh-rendering/mesh-image-rendering-architecture.md) をbasisにする。
