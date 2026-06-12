# Mesh Generation Design Map

> Mesh生成アルゴリズム、品質基準、非ゴール、実装時の検証観点を扱う設計トピック。画面上の操作UXは `screen-design/` に置き、ここでは「どう生成するか」を扱う。

## ファイル一覧

| Path | Role | Status |
|---|---|---|
| [_map.md](_map.md) | このディレクトリの入口地図 | Active |
| [auto-outline-v2.md](auto-outline-v2.md) | Drawable RGBA alpha maskから自然な初期meshを生成する `auto-outline-v2` アルゴリズム候補 | Draft algorithm spec |
| [auto-outline-v3-envelope.md](auto-outline-v3-envelope.md) | `auto-outline-v2` 後の次候補。alpha輪郭そのものではなく外側包絡 envelope boundary を使い、粗めで自然な初期meshを生成する方針 | Draft algorithm spec |

## 境界

- ここではMesh Toolのボタン配置、Inspector layout、Canvas toolbarなどのUXを扱わない。
- 画面仕様は [../screen-design/components/mesh-tool.md](../screen-design/components/mesh-tool.md) を正とする。
- ここではCubism互換、pixel-perfect再現、semantic preset selectionを主張しない。

## 現在の焦点

- Wave62で `auto-outline-v1` により矩形grid主体から輪郭追従へ進んだ。
- Wave63で `auto-outline-v2` により自然なtriangular meshへ大きく近づいた。
- 次候補は、alpha輪郭をなぞるのではなく、透明領域を少し含む外側包絡線で部品を包む `auto-outline-v3-envelope` である。

## 次の作業候補

1. `auto-outline-v3-envelope` のenvelope offset式、self-intersection cleanup、support ring方式を実装前に調査する。
2. V2より粗めのpreset spacing / max edge / max area / valence閾値を、実サンプルで調整可能な形にする。
3. アルゴリズム品質の自動テスト境界と、人間visual check境界を分ける。
