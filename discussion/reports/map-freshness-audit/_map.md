# Map Freshness Audit Map

> `discussion/**/_map.md` 鮮度監査の出力先、担当範囲、進行状態を示す軽量な地図。

## Entry Points

- 共通契約: [audit-contract.md](audit-contract.md)
- map更新契約: [map-update-contract.md](map-update-contract.md)
- 監査基準点: Git HEAD `3c3669eefcc375c62d1ec6b4d77a000d7cbbb61c`
- 監査開始日: 2026-08-08

## Investigation Outputs

| Output | Scope | Status |
|---|---|---|
| [01-mechanical-inventory.md](01-mechanical-inventory.md) | 全 `discussion/**/_map.md` の機械的inventory、リンク、親子網羅、疑わしいcurrent表現 | Completed (2026-08-08) |
| [10-product-baseline.md](10-product-baseline.md) | concept、acceptance-criteria、scenarios、demo、proposal | Completed (2026-08-08) |
| [11-design-and-conventions.md](11-design-and-conventions.md) | design全体、development_convention、関連する現行source/test | Completed (2026-08-08) |
| [20-editor-waves-000-028.md](20-editor-waves-000-028.md) | implementation Wave 0-28 のplans、wave maps、review maps、証拠 | Completed (2026-08-08) |
| [21-editor-waves-029-058.md](21-editor-waves-029-058.md) | implementation Wave 29-58 のplans、wave maps、review maps、証拠 | Completed (2026-08-08) |
| [22-editor-waves-059-080.md](22-editor-waves-059-080.md) | implementation Wave 59-80 のplans、wave maps、review maps、証拠 | Completed (2026-08-08) |
| [23-editor-waves-081-102.md](23-editor-waves-081-102.md) | implementation Wave 81-102 のplans、wave maps、review maps、証拠 | Completed (2026-08-08) |
| [30-runtime-player-waves-001-012.md](30-runtime-player-waves-001-012.md) | Runtime Player Wave 1-12、基盤、入力、配信経路 | Completed (2026-08-08) |
| [31-runtime-player-waves-013-023.md](31-runtime-player-waves-013-023.md) | Runtime Player Wave 13-23、性能、lifecycle、dynamics、lipsync | Completed (2026-08-08) |
| [40-model-authoring.md](40-model-authoring.md) | model-authoring、Wave 103-105/107、authoring-host | Completed (2026-08-08) |
| [41-mesh-and-rendering.md](41-mesh-and-rendering.md) | mesh-generation、mesh/render design、関連waves、Wave108 | Completed (2026-08-08) |
| [42-render-performance-and-dynamics.md](42-render-performance-and-dynamics.md) | render-performance、performance report、Wave106、Editor/Player性能・dynamics境界 | Completed (2026-08-08) |
| [43-editor-electron-migration.md](43-editor-electron-migration.md) | editor-electron-migration全map、apps/editor Electron/packaging事実 | Completed (2026-08-08) |
| [50-ai-cohost.md](50-ai-cohost.md) | ai-cohost全map、C/S系列、apps/soulとの境界 | Completed (2026-08-08) |
| [51-expo-and-research-archives.md](51-expo-and-research-archives.md) | expo、reports全map、成果物とarchive位置付け | Completed (2026-08-08) |

## Reserved Integration Outputs

| Output | Role | Status |
|---|---|---|
| [60-editor-integration.md](60-editor-integration.md) | Wave調査と専門トピックを統合し、implementation親map群を判定 | Completed (2026-08-08) |
| [61-runtime-player-integration.md](61-runtime-player-integration.md) | Runtime Player前後半を統合し、親map群を判定 | Completed (2026-08-08) |
| [62-cross-topic-integration.md](62-cross-topic-integration.md) | model/mesh/performance/Electron/AI/Expo境界を照合 | Completed (2026-08-08) |
| [90-root-map-integration.md](90-root-map-integration.md) | 全ドメイン結論から `discussion/_map.md` を最終判定 | Completed (2026-08-08) |

## Current State

- 監査契約と出力先を作成済み。
- Investigation Outputs 15本はすべて作成・完了済み（2026-08-08）。
- 機械監査は基準点の281 mapを全件確認済み。
- Integration Outputs 4本はすべて作成・完了済み（2026-08-08）。
- root map の最終監査判定は `Partially stale`。修正候補22件、更新wave 10段階、ユーザー判断・human/legal gate 22件を記録済み。
- map更新は `map-update-contract.md` の所有権と順序に従って完了済み（2026-08-08）。
- 最終機械レビュー: 316 maps / 3,965 relative links / broken 0 / missing registrations 0 / final `pass`。
- 最終意味レビュー: root correction ledger 22/22、user/human/legal gate 22/22、blocking 0、nonblocking 0、final `pass`。

## Map Update Outputs

| Output | Role | Status |
|---|---|---|
| [110-product-map-update.md](110-product-map-update.md) | Product / AC / scenario / demo / proposal leaf update | Completed (2026-08-08) |
| [111-design-ui-map-update.md](111-design-ui-map-update.md) | Design contract / screen / convention leaf update | Completed (2026-08-08) |
| [112-mesh-render-perf-map-update.md](112-mesh-render-perf-map-update.md) | Mesh / render / performance leaf update | Completed (2026-08-08) |
| [113-runtime-leaf-map-update.md](113-runtime-leaf-map-update.md) | Runtime Player wave/review leaf update | Completed (2026-08-08) |
| [114-model-authoring-map-update.md](114-model-authoring-map-update.md) | Model Authoring topic update | Completed (2026-08-08) |
| [115-electron-map-update.md](115-electron-map-update.md) | Electron migration topic update | Completed (2026-08-08) |
| [116-ai-cohost-map-update.md](116-ai-cohost-map-update.md) | AI Cohost topic update | Completed (2026-08-08) |
| [117-expo-archives-map-update.md](117-expo-archives-map-update.md) | Expo and archive leaf update | Completed (2026-08-08) |
| [118-editor-history-000-080-update.md](118-editor-history-000-080-update.md) | Editor historical maps Wave0-80 | Completed (2026-08-08) |
| [119-editor-history-081-109-update.md](119-editor-history-081-109-update.md) | Editor historical maps Wave81-109 | Completed (2026-08-08) |
| [120-design-parent-update.md](120-design-parent-update.md) | Design parent update | Completed (2026-08-08) |
| [121-implementation-parent-update.md](121-implementation-parent-update.md) | Implementation parent/index update | Completed (2026-08-08) |
| [122-runtime-parent-update.md](122-runtime-parent-update.md) | Runtime Player parent/index update | Completed (2026-08-08) |
| [123-reports-parent-update.md](123-reports-parent-update.md) | Reports parent update | Completed (2026-08-08) |
| [130-map-update-mechanical-review.md](130-map-update-mechanical-review.md) | Pre-root mechanical review | Completed / pass (2026-08-08) |
| [131-map-update-semantic-review.md](131-map-update-semantic-review.md) | Pre-root semantic review | Completed / pass (2026-08-08) |
| [140-root-map-update.md](140-root-map-update.md) | `discussion/_map.md` update | Completed (2026-08-08) |
| [141-root-map-mechanical-review.md](141-root-map-mechanical-review.md) | Final mechanical review | Completed / pass (2026-08-08) |
| [142-root-map-semantic-review.md](142-root-map-semantic-review.md) | Final semantic review | Completed / pass (2026-08-08) |

## Next Actions

1. ユーザーが必要と判断した場合、更新diffを確認してcommit単位を決める。
2. 未決の製品・human・device・external・legal gateは各topic mapの記録に従う。

## Unresolved Questions

- map更新作業としての未決事項はなし。製品・human・device・external・legal gateは各topicに残る。
