# レシピ 04: 表示切替の足場（runtimeVisibility）

作業対象外の drawable 群（例: 別表情セット）を隠して視界を切り替える。作業用の足場であり、最終リグの表示制御（opacity keyform 等）が入るまでの仮設。

## 前提状態

- 隠す/出す対象の drawableId を同定済み（部品コンテナ単位なら `graph.json` の parts から `displayName` で part を特定し、`drawables.json` を `partId` でフィルタして配下 drawable を列挙する。PSD のグループ名が Parts Container にそのまま残っている）

## 操作 `setRuntimeVisibility`（drawable 1 枚ずつ）

```json
{ "operationType": "setRuntimeVisibility",
  "payload": { "target": { "kind": "drawable", "id": "<drawableId>" }, "runtimeVisibility": false } }
```

- **Parts Container 単位の専用 operation は無い**。配下 drawable への連続適用で代替する
- 同値への再設定は reject（no-op 保護）。現在値は `drawables.json` の `runtimeVisibility` で確認
- wave105 の可視性ゲートは snapshot レベルなので、**renderView / inspectEvaluatedGeometry / Editor / Player すべてが同じ可視性世界を見る**。切替は知覚世界ごと切り替わる

## 完了チェック

- `drawables.json` で対象の `runtimeVisibility` が期待値
- レンダ 1 枚で視覚確認（隠した部品が消え、出した部品が現れている）

## 注意（足場の返却）

- これは **committed 変更**（git に載る）。工程完了時に「最終的にどのセットが見えているべきか」を判断して復元すること。復元漏れは validate では検出されない——工程の完了チェックに含めるのが唯一の防御
- 例: 表情セットの切替作業後は、デフォルト表情（通常）を可視に戻すのが基本形

## エスカレーション条件

- 隠したはずの drawable がレンダに残る → マスク源としての参加（レシピ 03 補足のレンダラ仕様）と混同していないか確認してからユーザーへ
