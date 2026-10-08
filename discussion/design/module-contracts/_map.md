# Module Contracts Map

> `discussion/design/module-contracts/` 直下の TypeScript + Web 向け contract-first module design 成果物の入口地図。

## 位置付け

このディレクトリは、Private 2D Rigging Lab / Prototype の MVP を後続サブエージェントが module 単位で並列実装できるように、module boundary、TypeScript / Zod contract、package file format、operation/runtime/validator/GUI/AI contract、fixtures、traceability、review結果を保持する。

各成果物は [../module-contract-output-format-template.md](../module-contract-output-format-template.md) の共通セクションに従う。外部境界DTOは Zod、内部ドメイン型は TypeScript を source of truth とする。

## 直下のファイル

| Path | Role | Status |
|------|------|--------|
| [_map.md](_map.md) | この module contract design 成果物群の入口地図 | Current index; dynamics v3 ownerを明示 |
| [module-boundaries.md](module-boundaries.md) | module責務、所有state、禁止依存、Future integration boundary、実装分担境界 | Private baseline語彙へ整理済み |
| [typescript-contracts.md](typescript-contracts.md) | shared branded ID、primitive、diagnostic、diff、DTO index の TypeScript / Zod 契約 | RuntimeEvaluationContext、RuntimeState/sequence artifact refs、RuntimeStateSequenceArtifact evidence fieldsへ更新済み |
| [package-file-format-contract.md](package-file-format-contract.md) | project-defined model package layout、layered character PSD profile、split PNG fallback、package DTO 対応 | layout tree / tableとも `runtime/states/` と `runtime/state-sequences/` generated evidenceへ更新済み |
| [operation-contracts.md](operation-contracts.md) | GUI / AI / migration / repair が共有する operation request/response/log/diff 契約 | `RunDynamicsPreviewSequencePayloadSchema.context`、`finalRuntimeState`、state/sequence artifact refsへ更新済み |
| [runtime-core-contract.md](runtime-core-contract.md) | Shared Runtime evaluation core、`parameter-grid-2d-v1`、world-frame dynamics、parent-before-child rig control、snapshot契約 | RuntimeEvaluationContext正本。現行 dynamics は `worldFrameChainV1` / `dynamics-file-v3`（[accepted oracle](../dynamics-world-frame-chain.md)）であり、旧 scalar 詳細は履歴 |
| [runtime-export-v0-contract.md](runtime-export-v0-contract.md) | Editor外のOBS/camera-driven runtime app向けRuntime Export v0 contract。directory + raw RGBA、materialized runtime graph、atlas metadata、preflight境界 | Accepted direction / Draft module contract |
| [validator-contract.md](validator-contract.md) | check catalog、severity/status、validation profile、report、repair candidate契約 | `runtime.profileMismatch`、`runtime.stateSequenceLengthMismatch`、state identity diagnosticsへ更新済み |
| [gui-operation-contract.md](gui-operation-contract.md) | UI event -> operation mapping、semantic state、hit-test、GUI evidence契約 | Dynamics panel / preview reset / simple graphへ更新済み |
| [ai-command-contract.md](ai-command-contract.md) | scenario-derived AI assistant command、dry-run、approval、diff、revalidation、transport adapter分類 | AI responseを `finalRuntimeState` / `finalRuntimeStateRef` と state/sequence artifact refsへ統一済み |
| [fixtures-and-contract-tests.md](fixtures-and-contract-tests.md) | fixture registry、expected validation report/runtime snapshot/diff、contract test方針 | suffix準拠RuntimeState artifacts、state sequence initial/post-frame semantics、exact deterministic replay evidenceへ更新済み |
| [traceability-matrix.md](traceability-matrix.md) | AC / scenario / module / API / diagnostic / fixture / expected output の対応 | review_007 RuntimeState sequence artifact / deterministic replay evidence traceabilityへ更新済み |
| [review-summary.md](review-summary.md) | 独立レビュー3観点の findings、対応状況、残未決事項分類 | 旧baselineレビューとして参考 |

## 主要な設計判断の反映先

| Decision | Primary files |
|----------|---------------|
| PSD import primary、split PNG fallback/debug/compatibility | [package-file-format-contract.md](package-file-format-contract.md), [operation-contracts.md](operation-contracts.md), [fixtures-and-contract-tests.md](fixtures-and-contract-tests.md) |
| `layered-character-psd-profile-v1` は汎用layered character art import profileであり、Live2D / Cubism import profileではない | [package-file-format-contract.md](package-file-format-contract.md), [operation-contracts.md](operation-contracts.md) |
| face yaw / pitch はproject-defined parameterとして扱う。カメラ方向やCubism face turn behaviorの再現とはしない | [runtime-core-contract.md](runtime-core-contract.md), [operation-contracts.md](operation-contracts.md), [gui-operation-contract.md](gui-operation-contract.md), [fixtures-and-contract-tests.md](fixtures-and-contract-tests.md) |
| GUI authoring evidence は operation log 必須、Playwright trace/screenshot/session metadata は補助 | [operation-contracts.md](operation-contracts.md), [gui-operation-contract.md](gui-operation-contract.md), [validator-contract.md](validator-contract.md) |
| AIはassistant / validatorとして扱い、dry-run / diff / repair suggestion / provenanceを中心にする | [ai-command-contract.md](ai-command-contract.md), [operation-contracts.md](operation-contracts.md) |
| Dynamics v0/v2 の `scalarDampedFollowV1` / `dynamics-file-v2` は superseded。現行 contract は `worldFrameChainV1` / `dynamics-file-v3`（Wave106 pass）で、詳細の current owner は [dynamics-world-frame-chain.md](../dynamics-world-frame-chain.md) と [Wave106 map](../../implementation/waves/wave106/_map.md) | [package-file-format-contract.md](package-file-format-contract.md), [runtime-core-contract.md](runtime-core-contract.md), [operation-contracts.md](operation-contracts.md), [validator-contract.md](validator-contract.md), [gui-operation-contract.md](gui-operation-contract.md), [fixtures-and-contract-tests.md](fixtures-and-contract-tests.md) |
| Runtime Export v0はWorkspace Save / Portable JSONとは別責務の実行用成果物。v0はdirectory + raw RGBA、materialized runtime graph、current atlas必須、player/camera appなし | [runtime-export-v0-contract.md](runtime-export-v0-contract.md), [../screen-design/screens/runtime-export-task.md](../screen-design/screens/runtime-export-task.md) |

## 実装状態の入口（repository facts）

設計文書の Draft/Accepted status と、実装・検証の状態は分けて読む。次の Wave map が現在の実装 evidence の入口である。

| Capability | Current evidence |
|---|---|
| Canvas evaluated scene / overlay / hit-test | [Wave66](../../implementation/waves/wave66/_map.md) — `CanvasEvaluatedScene` 境界を実装済み。pixel/visual parity は別 gate。 |
| Validation / Diagnostics v0 | [Wave85](../../implementation/waves/wave85/_map.md) — read-only Diagnostics、badges、jump、inline diagnostics を pass。full Evidence View の最終UIは未決。 |
| Runtime Export v0 | [Wave92](../../implementation/waves/wave92/_map.md) — package contract、assembly/preflight、Editor task を pass。browser picker / external player parity は非対象。 |
| Variant Manager v0 | [Wave99](../../implementation/waves/wave99/_map.md) — package/evaluation/Editor Canvas preview を pass。最終 visual polish は別 gate。 |
| Dynamics v3 replacement | [Wave106](../../implementation/waves/wave106/_map.md) — scalar v2 を破壊的置換し、全層 pass。 |

## 参照入口

| Path | Role |
|------|------|
| [../../concept/modified_concept.md](../../concept/modified_concept.md) | 現在のPrivate Prototype baseline |
| [../../acceptance-criteria/03_MVP_Acceptance_Criteria.md](../../acceptance-criteria/03_MVP_Acceptance_Criteria.md) | MVP AC |
| [../../reports/cmo3-moc3-format-spec/format-feasibility-summary.md](../../reports/cmo3-moc3-format-spec/format-feasibility-summary.md) | Cubism形式調査のsuperseded方針 |
| [../../reports/rights-risk-cleanup/cleanup-report.md](../../reports/rights-risk-cleanup/cleanup-report.md) | 実装前に読む権利・商標・非互換方針 |

## 次の行動候補

1. 既存の `fixtures/contracts/` と package test evidence を current contract と照合し、欠落が見つかった場合だけ fixture gap を補う。
2. Demo-safe preflight fixture は product/demo の rights・disclaimer gate と分けて扱い、実装完了とはみなさない。
3. Future integration boundary を再開する場合は、transport/API 公開範囲を別途 review する（MVP外）。

## 未決事項

| 項目 | 分類 | 状態 |
|------|------|------|
| 実装時の npm package 名 / import path | can-defer | module ID と責務は暫定固定済み |
| fixture 実ファイルの保存場所 | can-defer | `fixtures/contracts/<fixture-id>/` を推奨 |
| rights-clean PSD art bytes の作成方法 | can-defer | provenance / rights / fixture manifest 契約は固定済み |
| HTTP JSON / WebSocket / MCP の具体endpoint | can-defer | transport-independent command contract が正だがFuture integration surface化はMVP外 |
