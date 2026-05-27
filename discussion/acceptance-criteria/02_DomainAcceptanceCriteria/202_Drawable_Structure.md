# DOMAIN-02: Drawable Structure

> Status: Current for Private Prototype baseline.

## 問い

Private Prototypeは、描画要素をどの単位で管理し、runtime評価とvalidatorへ渡すべきか。

### AC-DRAW-001: 描画要素を管理できること

Project-defined packageは、drawableのstable ID、display name、texture参照、mesh参照、bounds、opacity、visibilityを保持できること。

### AC-DRAW-002: 描画要素の階層・所属を扱えること

Drawableはpartに所属し、private GUI editor、private runtime core、validatorが同じIDで参照できること。

### AC-DRAW-003: 描画順と表示状態を制御できること

Drawableはdraw order、visibility、opacity、lock/hide/selectなどの制作状態とruntime状態を分離して扱えること。

### AC-DRAW-004: マスク・クリッピング等の描画制約を扱えること

Drawable間のmask / clipping関係をproject-defined構造として保持し、private viewerで確認し、validatorで不整合を検出できること。
