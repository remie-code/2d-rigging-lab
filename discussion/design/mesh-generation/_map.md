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

## 境界

- ここではMesh Toolのボタン配置、Inspector layout、Canvas toolbarなどのUXを扱わない。
- 画面仕様は [../screen-design/components/mesh-tool.md](../screen-design/components/mesh-tool.md) を正とする。
- ここではCubism互換、pixel-perfect再現、semantic preset selectionを主張しない。

## 現在の焦点

- Wave62で `auto-outline-v1` により矩形grid主体から輪郭追従へ進んだ。
- Wave63で `auto-outline-v2` により自然なtriangular meshへ大きく近づいた。
- `auto-outline-v2.5-soft-boundary` は、V2比でLarge Motionの密度と見た目を大きく改善し、現在の主候補として扱う。
- `auto-outline-v2.6-soft-apron` は、V2.5の内部密度を保ったまま、輪郭外側に薄いapron triangle帯を追加して頭頂部などの境界不足を補うrefinementである。
- 次のsidecar候補は、V2系統とは別に、輪郭帯を主構造として先に作り、その内側をpreset別target sizeで充填する `auto-outline-v4-contour-band` である。
- `auto-outline-v3-envelope` は、外側包絡が強すぎるとDrawable描画領域から外れやすいことが分かったため、現時点では実験候補として扱う。

## 次の作業候補

1. `auto-outline-v4-contour-band` を次wave sidecar候補として計画に載せる。
2. `auto-outline-v2.6-soft-apron` とV4を比較可能にし、人間visual checkでdefault候補を判断する。
3. アルゴリズム品質の自動テスト境界と、人間visual check境界を分ける。
