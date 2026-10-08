# Mesh Generation Design Map

> Mesh生成アルゴリズム、品質基準、非ゴール、実装時の検証観点を扱う設計トピック。画面上の操作UXは `screen-design/` に置き、ここでは「どう生成するか」を扱う。

## ファイル一覧

| Path | Role | Status |
|---|---|---|
| [_map.md](_map.md) | このディレクトリの入口地図 | Active |
| [auto-outline-v2.md](auto-outline-v2.md) | Drawable RGBA alpha maskから自然な初期meshを生成する `auto-outline-v2` アルゴリズム候補 | Draft algorithm spec |
| [auto-outline-v2-5-soft-boundary.md](auto-outline-v2-5-soft-boundary.md) | `auto-outline-v2` を基礎にした soft-boundary 比較案 | Historical / superseded by v6d mainline |
| [auto-outline-v2-6-soft-apron.md](auto-outline-v2-6-soft-apron.md) | V2.5 の apron triangle 比較案 | Historical / superseded by v6d mainline |
| [auto-outline-v3-envelope.md](auto-outline-v3-envelope.md) | `auto-outline-v2` 後の実験候補。alpha輪郭そのものではなく外側包絡 envelope boundary を使う方針だが、現状は包絡が強すぎるリスクがある | Draft algorithm spec / experimental |
| [auto-outline-v4-contour-band.md](auto-outline-v4-contour-band.md) | 輪郭帯を明示生成する別系統候補 | Historical / Wave67 non-default sidecar |
| [auto-outline-v4-recursive-offset-ring.md](auto-outline-v4-recursive-offset-ring.md) | V4 試行後の recursive offset-ring 候補 | Historical discussion snapshot |
| [auto-outline-v5-recursive-contour-band.md](auto-outline-v5-recursive-contour-band.md) | V4 試行後の recursive contour-band 候補 | Historical experiment |
| [auto-outline-v6-alpha-constrained-delaunay.md](auto-outline-v6-alpha-constrained-delaunay.md) | alpha mask / adaptive contour / boundary-preserving triangulation の v6 設計基礎 | Historical design basis; current lineage is v6d |
| [auto-outline-v6b-constrainautor.md](auto-outline-v6b-constrainautor.md) | v6 shared pipeline の constrainautor backend | Historical backend experiment |
| [auto-outline-v6c-poly2tri.md](auto-outline-v6c-poly2tri.md) | v6 shared pipeline の poly2tri backend | Historical backend experiment |
| [auto-outline-v6d-v6e-v6f-contour-salvage-triangulation.md](auto-outline-v6d-v6e-v6f-contour-salvage-triangulation.md) | Wave68 の v6D/v6E/v6F backend 比較基礎 | Historical experiment |
| [auto-outline-v6g-contour-band-support-rings.md](auto-outline-v6g-contour-band-support-rings.md) | Wave69/70 の v6D-lineage support-ring 実装基礎 | Historical implementation basis |
| [auto-outline-v6d-staggered-inner-strip.md](auto-outline-v6d-staggered-inner-strip.md) | Wave70 の staggered inner strip 候補 | Historical experiment |
| [auto-outline-v6d-adaptive-staggered-band.md](auto-outline-v6d-adaptive-staggered-band.md) | Wave70後のvisual tuningとdensity tuningを統合し、パーツサイズ適応densityとstaggered alpha-to-inner explicit stripを追加したWave71実装basis。現在のdefault方向としてはsuperseded | Historical / superseded for default direction |
| [auto-outline-v6d-adaptive-contour-constrainautor.md](auto-outline-v6d-adaptive-contour-constrainautor.md) | old v6D contour constrainautor、Wave71 adaptive density、後続のvirtual paddingを統合した現行の技術/default route | Technical/default route; implementation evidence (focused tests/visual evidence) only — v6/v7 product-quality and toggle-lifetime hold remains open |
| [auto-outline-v6-library-candidate-inventory.md](auto-outline-v6-library-candidate-inventory.md) | v6 sidecarで利用可能な外部ライブラリ候補、依存リスク、spike順序の調査メモ | Research inventory |

## 境界

- ここではMesh Toolのボタン配置、Inspector layout、Canvas toolbarなどのUXを扱わない。
- 画面仕様は [../screen-design/components/mesh-tool.md](../screen-design/components/mesh-tool.md) を正とする。
- Mesh境界の白線、透明境界のにじみ、WebGL2 / Canvas2Dなどの描画方式は [../mesh-rendering/](../mesh-rendering/_map.md) を正とする。
- ここではCubism互換、pixel-perfect再現、semantic preset selectionを主張しない。

## 現在の焦点

- 現行 Editor の default method は `auto-outline-v6d-adaptive-contour-constrainautor`。`apps/editor/src/features/editor-session/model/mesh-tool-state.ts` の薄い generation-family toggle で v7 (`auto-outline-v7-margin-contour`) を比較できるが、v6a/b/c などの backend selector は現行 UI ではない。
- 往復2のユーザー裁定は「v6 と v7 は一長一短」。品質勝敗は未確定のため、v6 default + v7 比較 toggle を維持し、Mesh Wave 2（v6削除）は未着手・未承認とする。
- Wave108/109 は mesh quality の優劣を決めるものではなく、生成 UV 非クランプ、層サイズ依存の透明 padding/gutter、LINEAR、contentInset を含む export preflight の rendering/data contract を実装・検証した。詳細は [../mesh-rendering/_map.md](../mesh-rendering/_map.md) と [../../implementation/waves/wave108/wave108-final-integration-report.md](../../implementation/waves/wave108/wave108-final-integration-report.md) を参照。
- V2–V6 系列の文書は比較・実験の根拠として保持する。自動テスト pass は商用風の目視品質勝利を意味せず、pixel/GPU gate と v6/v7 policy は別の未決事項である。

## 次の作業候補

1. v6/v7 quality criteria と generation-family toggle の寿命をユーザーと再裁定するまで、Wave 2（v6削除）を計画・実装しない。
2. v6d/v7 の自動契約テストと `evaluation-log.md` 往復2の人間所見を別証拠として保つ。必要ならユーザー指定の実モデル visual/pixel comparison を追加する。
3. Wave108/109 の rendering/data contract は実装済みとして参照し、Atlas Runtime の実機目視、GPU/pixel parity、`original` inset の再現確認は [../mesh-rendering/_map.md](../mesh-rendering/_map.md) の gate として扱う。
4. Mesh形状品質と mesh rendering 品質を混同しない。V2–V6 の候補文書は historical evidence として残し、現行 default の根拠は v6d source/tests とユーザー裁定に限定する。
