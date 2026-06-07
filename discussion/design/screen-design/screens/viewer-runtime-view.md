# Viewer / Runtime View 画面仕様

> 状態: Draft screen spec。

## 1. 役割

Viewer / Runtime Viewは、authoring previewとは別に、runtime/viewer状態を確認するviewである。

## 2. 表示するもの

- runtime snapshot summary
- runtime diff summary
- viewer parameter controls
- validation diagnostics summary
- part/drawable/mesh/mask/rig/dynamicsのruntime確認に必要な最小情報

## 3. 通常表示しないもの

- runtime state artifact path全文
- sequence artifact path全文
- validation report path全文
- raw runtime evidence

## 4. 関連機能ID

- `UX-FEAT-007`
- 一部 `UX-FEAT-020`〜`UX-FEAT-025`
- 一部 `UX-FEAT-034`

## 5. 未決事項

- Viewer / Runtimeをauthoring previewと同列に扱うか、別view/tabとして扱うか。
- runtime evidence詳細をこのviewに残すか、Diagnostics / Evidence Viewへ分けるか。
