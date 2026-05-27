# DOMAIN-06: Part, Visibility, and Composition Semantics

> Status: Current for Private Prototype baseline.

## 問い

Private Prototypeは、part構造、表示状態、差し替え、compositionをどう保存・評価するべきか。

### AC-PART-001: パーツ構造を管理できること

Partはstable ID、display name、parent/child relation、所属drawable、lock/hide/select状態を保持できること。

### AC-PART-002: パーツ単位の表示状態を制御できること

Partとdrawableのvisibility、opacity、draw orderを制作状態とruntime評価状態に分けて扱えること。

### AC-PART-003: ポーズ・差し替え表現を扱えること

表情差分や差し替えはproject-defined compositionとして扱い、外部形式のpose asset互換を成功条件にしないこと。

### AC-PART-004: 表示状態のランタイム再現性を保持できること

Private runtime coreとprivate viewerは、同じpackageとparameter入力から同じvisibility、opacity、draw orderを再現できること。
