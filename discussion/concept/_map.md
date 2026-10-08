# Concept Map

> `discussion/concept/` 直下のファイルだけを示す地図。

---

## 位置付け

この階層は、Private 2D Rigging Lab / Prototype のコンセプト、スコープ、方針変更、根本問いを保持する。

Product requirement の正は [modified_concept.md](modified_concept.md) と Root/MVP AC である。Dynamics の schema / solver / cardinality などの具体的な実装意味論は、受入要件を置き換えず、accepted [dynamics-file-v3 design](../design/dynamics-world-frame-chain.md) と [Wave106](../implementation/waves/wave106/_map.md) を参照する。

## 直下のファイル

| Path | Role | Status |
|------|------|--------|
| [_map.md](_map.md) | この階層の入口地図 | Private baselineへ更新済み |
| [modified_concept.md](modified_concept.md) | 旧公開エコシステム方針をsupersedeし、Private Prototype / Streaming Demo Surface / Live2D Feature Proposal / Future Public Clean Subset とmemo対応完了状態を定義する現在baseline | Current baseline |

## 次の行動

1. Private Prototypeの設計未決を、実装済み成果とのcontract/test traceabilityへ照合し、未達・再設計・人間ゲートを列挙する。
2. Live2Dへ最初に提案する機能テーマをユーザー判断で選ぶ。
3. Future Public Clean Subsetが必要になった場合に別途scopeを設計する。

## 未決事項

| 項目 | 状態 |
|------|------|
| Future Public Clean Subset の具体範囲 | 現在MVP外。必要時に別途再設計 |
| authoring format と runtime format を同一にするか分けるか | Private Prototype内の設計未決 |
| RigControl概念をAI-nativeな独自構造としてどう定義するか | Private Prototype内の設計未決 |
