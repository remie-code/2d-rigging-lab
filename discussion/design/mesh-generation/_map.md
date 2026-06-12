# Mesh Generation Design Map

> Mesh生成アルゴリズム、品質基準、非ゴール、実装時の検証観点を扱う設計トピック。画面上の操作UXは `screen-design/` に置き、ここでは「どう生成するか」を扱う。

## ファイル一覧

| Path | Role | Status |
|---|---|---|
| [_map.md](_map.md) | このディレクトリの入口地図 | Active |
| [auto-outline-v2.md](auto-outline-v2.md) | Drawable RGBA alpha maskから自然な初期meshを生成する `auto-outline-v2` アルゴリズム候補 | Draft algorithm spec |

## 境界

- ここではMesh Toolのボタン配置、Inspector layout、Canvas toolbarなどのUXを扱わない。
- 画面仕様は [../screen-design/components/mesh-tool.md](../screen-design/components/mesh-tool.md) を正とする。
- ここではCubism互換、pixel-perfect再現、semantic preset selectionを主張しない。

## 現在の焦点

- Wave62で `auto-outline-v1` により矩形grid主体から輪郭追従へ進んだ。
- 次候補は、扇状集中、大きすぎる三角形、grid由来の矩形感を減らす `auto-outline-v2` である。

## 次の作業候補

1. `auto-outline-v2` のtriangulation方式と依存ライブラリ候補を実装前に調査する。
2. presetごとのspacing / max edge / max area / valence閾値を、実サンプルで調整可能な形にする。
3. アルゴリズム品質の自動テスト境界と、人間visual check境界を分ける。
