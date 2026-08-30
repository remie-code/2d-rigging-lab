# AI Cohost Model Identity Inventory Map

> Claude/GPT系列ごとの魂名を扱う機能追加に先立ち、現行の固定名・brain registry・記憶・表示面・テスト境界を調べる入口。

## Contract

- [inventory-contract.md](inventory-contract.md) — 調査範囲、証拠分類、非目標。

## Primary inventories

| Report | Question | Status |
|---|---|---|
| [01-fixed-name-and-identity-flow.md](01-fixed-name-and-identity-flow.md) | `コーディ`等の固定値はどこにあり、どこへ伝播するか | Completed |
| [02-brain-registry-and-model-selection.md](02-brain-registry-and-model-selection.md) | brain/model/provider registryとswapはどう構成されているか | Completed |
| [03-memory-prompt-voice-persistence.md](03-memory-prompt-voice-persistence.md) | memory、履歴、prompt、persona、TTSは名前をどう保持・参照するか | Completed |
| [04-ui-contracts-and-tests.md](04-ui-contracts-and-tests.md) | UI、配信面、contract、tests、AC/mapへの影響は何か | Completed |

## Integration

| Report | Role | Status |
|---|---|---|
| [10-inventory-integration.md](10-inventory-integration.md) | 変更面、リスク、repoで閉じる前提、ユーザー判断点を統合 | Completed |
| [20-final-review.md](20-final-review.md) | inventoryの完全性・根拠・非過剰設計レビュー | PASS（blocking 0 / nonblocking 0） |
