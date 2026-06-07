# Diagnostics / Evidence View 画面仕様

> 状態: Draft screen spec。

## 1. 役割

Diagnostics / Evidence Viewは、通常authoring UIから分離したdebug/evidence確認用のviewまたはdrawerである。

## 2. レイアウト

```text
+--------------------------------------------------------------------------------+
| Diagnostics / Evidence                                                          |
+----------------------------+---------------------------------------------------+
| Navigation                 | Details                                           |
| - Product Preflight        | Selected diagnostic/evidence detail              |
| - Operation Log            | IDs / paths / refs / raw-ish details             |
| - Generated Evidence       |                                                   |
| - Package File Set         |                                                   |
| - Reload Summary           |                                                   |
+----------------------------+---------------------------------------------------+
```

## 3. 表示するもの

- operation log
- generated evidence
- package file set
- reload summary
- full validation diagnostics
- Product Preflight details
- runtime snapshot/diff details
- source refs / generated refs / evidence paths
- PSD import / structural scaffold evidence: operation ID、approval ID、plan digest、generated refs、evidence path、batch result、raw parser diagnostics、raw structural scaffold diagnostics

## 4. 関連機能ID

- `UX-FEAT-028`
- `UX-FEAT-029`
- `UX-FEAT-033`
- `UX-FEAT-034`
- `UX-FEAT-035`
- `UX-FEAT-036`
- 一部 `UX-FEAT-007`, `UX-FEAT-014`, `UX-FEAT-018`, `UX-FEAT-019`, `UX-FEAT-025`, `UX-FEAT-030`〜`UX-FEAT-032`

## 5. 注意点

- 人間向けdebug確認にも必要だが、通常authoring UIではない。
- E2E oracleが集中しているため、移動時にはtest-facing surfaceの扱いを決める必要がある。
- Wave51ではこのViewの最終UIは未実装。Domain DはPSD Import Task observationから詳細 evidence/debug の availability をこのView向けに分類しただけで、operation log、generated evidence、package file set、reload summary、Product Preflight details の移動は後続waveに残る。
