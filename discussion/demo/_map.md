# Demo Map

> `discussion/demo/` 直下のファイルだけを示す地図。Streaming Demo Surfaceの方針はPrivate Prototype本体とは分離して管理する。

---

## 位置付け

`demo/` は、Private Prototypeを配信・録画・スクリーンショットで見せるときの表示範囲、避ける表現、preflight、disclaimerを記録する場所である。

Demo文書は実装仕様ではない。MVPの正は [../acceptance-criteria/03_MVP_Acceptance_Criteria.md](../acceptance-criteria/03_MVP_Acceptance_Criteria.md) と [../scenarios/03_MVP_Acceptance_Criteria.md](../scenarios/03_MVP_Acceptance_Criteria.md) に置く。

## 直下のファイル

| Path | Role | Status |
|------|------|--------|
| [_map.md](_map.md) | `demo/` 直下の入口地図 | Current |
| [streaming-demo-policy.md](streaming-demo-policy.md) | Streaming Demo Surfaceで見せてよいもの、避けるもの、preflight、disclaimer | Current baseline policy |

## 次の行動

1. Demo-safe preflightの自動検査項目を実装設計へ落とす。
2. 配信に使うrights-clean fixtureとcapture sceneをユーザー判断で決める。

## 未決事項

| 項目 | 状態 |
|------|------|
| Demo captureに使うキャラクター素材 | 文書移行外の別課題。自作、生成、または明示許諾済み素材のみ |
| Disclaimerの最終文言 | 文書移行外の別課題。配信前に再確認 |
