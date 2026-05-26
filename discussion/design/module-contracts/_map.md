# Module Contracts Map

> `discussion/design/module-contracts/` 直下の TypeScript + Web 向け contract-first module design 成果物の入口地図。

## 位置付け

このディレクトリは、Open Live2D Stack / AI-native Live2D-like editor の MVP を後続サブエージェントが module 単位で並列実装できるように、module boundary、TypeScript / Zod contract、package file format、operation/runtime/validator/GUI/AI contract、fixtures、traceability、review結果を保持する。

各成果物は [../module-contract-output-format-template.md](../module-contract-output-format-template.md) の共通セクションに従う。外部境界DTOは Zod、内部ドメイン型は TypeScript を source of truth とする。

## 直下のファイル

| Path | Role | Status |
|------|------|--------|
| [_map.md](_map.md) | この module contract design 成果物群の入口地図 | Updated |
| [module-boundaries.md](module-boundaries.md) | module責務、所有state、禁止依存、public API、実装分担境界 | Draft / Review fixes applied |
| [typescript-contracts.md](typescript-contracts.md) | shared branded ID、primitive、diagnostic、diff、DTO index の TypeScript / Zod 契約 | Draft / Review fixes applied |
| [package-file-format-contract.md](package-file-format-contract.md) | Open Model Package layout、PSD primary source asset、split PNG fallback、package DTO 対応 | Draft / Review fixes applied |
| [operation-contracts.md](operation-contracts.md) | GUI / AI / migration / repair が共有する operation request/response/log/diff 契約 | Draft / Review fixes applied |
| [runtime-core-contract.md](runtime-core-contract.md) | Shared Runtime evaluation core、`parameter-grid-2d-v1`、parent-before-child deformer、snapshot契約 | Draft / Review fixes applied |
| [validator-contract.md](validator-contract.md) | check registry、severity/status、validation profile、report、repair candidate契約 | Draft / Review fixes applied |
| [gui-operation-contract.md](gui-operation-contract.md) | UI event -> operation mapping、semantic state、hit-test、GUI evidence契約 | Draft / Review fixes applied |
| [ai-command-contract.md](ai-command-contract.md) | scenario-derived AI command、dry-run、approval、diff、revalidation、transport adapter分類 | Draft / Review fixes applied |
| [fixtures-and-contract-tests.md](fixtures-and-contract-tests.md) | fixture registry、expected validation report/runtime snapshot/diff、contract test方針 | Draft / Review fixes applied |
| [traceability-matrix.md](traceability-matrix.md) | AC / scenario / module / API / diagnostic / fixture / expected output の対応 | Draft / Review fixes applied |
| [review-summary.md](review-summary.md) | 独立レビュー3観点の findings、対応状況、残未決事項分類 | Draft / Review fixes applied |

## 主要な設計判断の反映先

| Decision | Primary files |
|----------|---------------|
| PSD import primary、split PNG fallback/debug/compatibility | [package-file-format-contract.md](package-file-format-contract.md), [operation-contracts.md](operation-contracts.md), [fixtures-and-contract-tests.md](fixtures-and-contract-tests.md) |
| Photoshop完全互換ではなく Live2D系素材向け PSD import profile | [package-file-format-contract.md](package-file-format-contract.md), [validator-contract.md](validator-contract.md) |
| Angle X/Y は1軸 keyform、`parameter-grid-2d-v1`、親子デフォーマ階層で扱う | [runtime-core-contract.md](runtime-core-contract.md), [operation-contracts.md](operation-contracts.md), [gui-operation-contract.md](gui-operation-contract.md), [fixtures-and-contract-tests.md](fixtures-and-contract-tests.md) |
| GUI authoring evidence は operation log 必須、Playwright trace/screenshot/session metadata は補助 | [operation-contracts.md](operation-contracts.md), [gui-operation-contract.md](gui-operation-contract.md), [validator-contract.md](validator-contract.md) |
| Structured API はシナリオ導出、Editor semantic state / Operation command / Runtime・Validator read API に分類 | [ai-command-contract.md](ai-command-contract.md), [gui-operation-contract.md](gui-operation-contract.md), [traceability-matrix.md](traceability-matrix.md) |
| transport-independent contract を正、HTTP JSON / WebSocket / MCP は adapter候補として分類 | [ai-command-contract.md](ai-command-contract.md), [module-boundaries.md](module-boundaries.md) |

## 参照入口

| Path | Role |
|------|------|
| [../module-contract-design-goal.md](../module-contract-design-goal.md) | module contract design の到達目標 |
| [../module-contract-design-decisions.md](../module-contract-design-decisions.md) | `/goal` 前に合意した判断ログ |
| [../module-contract-output-format-template.md](../module-contract-output-format-template.md) | 成果物の共通書式・ファイル別テンプレート |
| [../mvp-authoring-runtime/_map.md](../mvp-authoring-runtime/_map.md) | 既存MVP縦切りDraft設計成果物群 |
| [../../acceptance-criteria/03_MVP_Acceptance_Criteria.md](../../acceptance-criteria/03_MVP_Acceptance_Criteria.md) | MVP AC |
| [../../scenarios/03_MVP_Acceptance_Criteria.md](../../scenarios/03_MVP_Acceptance_Criteria.md) | MVP scenario |

## レビュー状況

| Review lane | Result | Response |
|-------------|--------|----------|
| AC / Scenario Traceability | `needs_changes` | findings を [traceability-matrix.md](traceability-matrix.md) へ反映し、[review-summary.md](review-summary.md) に記録 |
| TypeScript / Zod Contract Consistency | `needs_changes` | schema/source-of-truth 不整合を各 contract へ反映し、[review-summary.md](review-summary.md) に記録 |
| Fixture / Verification | `needs_changes` | fixture registry、expected output、diagnostic trace を修正し、[review-summary.md](review-summary.md) に記録 |

## 次の行動候補

1. 実装 `/goal` では、まず `packages/contracts` と fixture manifest skeleton を作り、Zod schema と branded ID を実ファイル化する。
2. その後、`package-format`、`operation-core`、`runtime-core`、`validator-core`、`editor-ui`、`ai-interface` を本 map の ownership に沿って分担する。
3. 実装開始前に、実際の fixture 保存場所と package import path だけを決める。

## 未決事項

| 項目 | 分類 | 状態 |
|------|------|------|
| 実装時の npm package 名 / import path | can-defer | module ID と責務は固定済み |
| fixture 実ファイルの保存場所 | can-defer | `fixtures/contracts/<fixture-id>/` を推奨 |
| rights-clean PSD art bytes の作成方法 | can-defer | provenance / rights / fixture manifest 契約は固定済み |
| HTTP JSON / WebSocket / MCP の具体endpoint | can-defer | transport-independent command contract が正 |

現時点で、module scaffolding 開始を妨げる `implementation-blocking` 未決事項は記録していない。
