# Craft Map — 制作定石の地図

> 常駐させるのはこのファイルだけ。工程に入るたびに該当レシピ 1 枚をロードして実行する（[../premises/craft-design.md](../premises/craft-design.md) の遅延ロード参照モデル）。各レシピは自己完結（= そのまま委任プロンプトに使える）。実行後に曖昧さを見つけたら**そのレシピを改訂してから**先へ進む（書き戻しループ）。

## 工程の順序

| # | 工程 | レシピ | 由来 | 状態 |
|---|---|---|---|---|
| 0 | ワークスペース開眼（新規モデル着手時に一度） | [00-workspace-bootstrap.md](00-workspace-bootstrap.md) | 閉問題01 | 実証済み（2026-07-03、満点 gate） |
| 1 | メッシュ生成 | [01-mesh-generation.md](01-mesh-generation.md) | 閉問題01 | 実証済み |
| 2 | 眼球 X rigging（デフォーマ + 移動キー） | [02-eyeball-x-rigging.md](02-eyeball-x-rigging.md) | 閉問題01 | 実証済み |
| 3 | 白目クリッピング | [03-eyewhite-clipping.md](03-eyewhite-clipping.md) | 閉問題01 | 実証済み |
| — | （以降の工程は閉問題 02+ の通過時に追記） | | | |

## 全工程共通の原則

- **dry-run → 自動承認 → commit** の 2 段階が強制。reject は無傷（何も変わらん）——原因を調べ、設計を直し、再実行する。reject を失敗と数えるな、craft の発見源や
- **1 committed operation = 1 git commit**（作業ワークスペース側。巻き戻し単位）
- **数値は巻尺（inspectEvaluatedGeometry）から取る。画像の目測を数値に使わない**
- 判断点は ★ 印、ユーザーの目が要る点は【ユーザー gate】印。それ以外は決定論的に流してよい
- 各操作の `basePackageRevision` は直前の commit が返した `packageRevision`。ズレたら reject されるだけ（安全）

## 共有不変量

まだ独立ファイル化するほど溜まっとらん。現時点の種（レシピ内に埋込済み）: 振幅設計 = 白目と虹彩の幅差から導出 / マスク効果の検証はピクセル差分か高倍率ズーム / 計測 bounds は rest=宣言値・変形時=頂点範囲で意味が違う。
