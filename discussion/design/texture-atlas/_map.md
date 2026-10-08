# Texture Atlas Design Map

> `discussion/design/texture-atlas/` の入口地図。Texture Atlas Taskの画面仕様ではなく、対象抽出、packing algorithm、artifact semantics、runtime remap境界などの設計論点を扱う。

## 位置付け

Texture Atlas Taskの画面UXは [../screen-design/screens/texture-atlas-task.md](../screen-design/screens/texture-atlas-task.md) を正とする。

このディレクトリは、Texture Atlasの内部設計、とくにpacking algorithmとruntime artifact semanticsを、画面仕様から分離して記録する。

## ファイル一覧

| Path | Role | Status |
|---|---|---|
| [_map.md](_map.md) | このディレクトリの入口地図 | Active |
| [skyline-packing-v1.md](skyline-packing-v1.md) | 現行shelf配置の課題を踏まえた single-page skyline packing algorithm | Accepted implementation / Wave101 pass |

## 現在の判断

- 新規 Generate Preview / Apply の default algorithm は `single-page-skyline-v1`（[Wave101 final](../../implementation/waves/wave101/wave101-final-integration-report.md) pass）。旧 `single-page-shelf-v1` は既存 artifact の読み取り互換 path として残る。
- Skyline の mixed-size non-overlap / within-page / determinism / padding-content-source-UV semantics と Blocking Issues UX は Wave101 で実装・focused 検証済み。
- 新しい algorithm selector を user-facing に出すか、将来 alpha trim / rotation / multi-page を許可するかは未決。現行 planning truth は Skyline default であり shelf 改良ではない。
- Texture Atlas対象抽出、padding、single-page方針、Apply時のartifact-only commit方針は維持する。
- **edge extrusion は覆いマージンについて透明gutterへ上書きされる**（[../mesh-rendering/boundary-transparent-margin-design.md](../mesh-rendering/boundary-transparent-margin-design.md) A1決定。**Wave108 で実装済み / Option E**）。メッシュ境界頂点が drawable 外へ延ばした overshoot を、端色の複製ではなく透明で受ける。透明パディング P は per-tile `content-inset`（`maxCoverageMarginSourcePixels(longEdge)`、層サイズ別・ソース画素）としてラスタに焼き込まれ、overshoot を自タイルの透明帯へ収束させる（クロス滲み無し）。実装は `extrudeTexturePlacementEdges` を**コード無改変**のまま（透明 raster 外縁が透明 gutter を自動生成し §9 の不透明 extrude を上書き）、`texture-atlas-targets.ts`/`texture-atlas-packing.ts` を padded raster 基準＋`uvRect`=content sub-rect へ整合。atlas gutter(`paddingPixels`)は既存幅据置（overshoot はラスタ内透明帯が吸収）。premultiplied のため透明 gutter は暗い fringe を出さない。
- Wave109 で non-zero `contentInset` placement の `uvRect` preflight 期待値を `deriveContentSubRectUv` に共有化し、packing と Runtime Export の照合が同じ契約になった。非ゼロ inset の export-ready / 旧契約値の block を focused test で固定（[Domain A report](../../implementation/waves/wave109/wave109-domain-a-uvrect-preflight-report.md)）。

## 次の作業候補

1. Wave101/108/109 の focused contracts を維持し、contentInset / uvRect / export preflight の再乖離を防ぐ。
2. Wave108 の Atlas Runtime 実機目視（透明 margin、cross-bleed、LINEAR端 AA）は mesh-rendering のユーザー gate として別管理する。
3. 将来 alpha trim / rotation / multi-page または user-facing algorithm selector を進める場合は、sourceRect/UV remap と旧 shelf artifact 互換の設計判断を先に記録する。

## 未決事項

- Skyline v1導入後も、ユーザーUIにpacking algorithm選択肢を出さない方針でよいか。
- 将来、alpha trimを入れる場合の `sourceRectPixels` とViewer / Runtime Export UV remap更新範囲。
- 将来、rotationを許可するか。
- 将来、multi-page atlasを扱うか。
