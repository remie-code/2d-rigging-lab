# Texture Atlas Design Map

> `discussion/design/texture-atlas/` の入口地図。Texture Atlas Taskの画面仕様ではなく、対象抽出、packing algorithm、artifact semantics、runtime remap境界などの設計論点を扱う。

## 位置付け

Texture Atlas Taskの画面UXは [../screen-design/screens/texture-atlas-task.md](../screen-design/screens/texture-atlas-task.md) を正とする。

このディレクトリは、Texture Atlasの内部設計、とくにpacking algorithmとruntime artifact semanticsを、画面仕様から分離して記録する。

## ファイル一覧

| Path | Role | Status |
|---|---|---|
| [_map.md](_map.md) | このディレクトリの入口地図 | Active |
| [skyline-packing-v1.md](skyline-packing-v1.md) | 現行shelf配置の課題を踏まえた、新しいsingle-page skyline packing algorithm案 | Accepted implementation target |

## 現在の判断

- 現行の `single-page-shelf-v1` は、draw order順のnext-fit shelfであり、混在サイズのDrawableでは隙間が出やすい。
- 次の改善対象は、alpha trimやrotationではなく、矩形packingそのものをSkyline方式へ置き換えること。
- 新しいalgorithm idは `single-page-skyline-v1` として扱い、旧layout / 旧artifactとの互換性を保つ。
- Texture Atlas対象抽出、padding、edge extrusion、single-page方針、Apply時のartifact-only commit方針は維持する。

## 次の作業候補

1. `single-page-skyline-v1` を実装し、Texture Atlas preview / applyのdefault packing algorithmとして接続する。
2. mixed-size targetで、non-overlap / within-page / determinism / usage improvementをfocused testで保証する。
3. 旧 `single-page-shelf-v1` layout artifactが読み取り不能にならないことを確認する。

## 未決事項

- Skyline v1導入後も、ユーザーUIにpacking algorithm選択肢を出さない方針でよいか。
- 将来、alpha trimを入れる場合の `sourceRectPixels` とViewer / Runtime Export UV remap更新範囲。
- 将来、rotationを許可するか。
- 将来、multi-page atlasを扱うか。
