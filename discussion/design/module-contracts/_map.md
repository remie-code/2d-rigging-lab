# Module Contracts Map

> `discussion/design/module-contracts/` 直下の TypeScript + Web 向け contract-first module design 成果物の入口地図。

## 位置付け

このディレクトリは、Private 2D Rigging Lab / Prototype の MVP を後続サブエージェントが module 単位で並列実装できるように、module boundary、TypeScript / Zod contract、package file format、operation/runtime/validator/GUI/AI contract、fixtures、traceability、review結果を保持する。

各成果物は [../module-contract-output-format-template.md](../module-contract-output-format-template.md) の共通セクションに従う。外部境界DTOは Zod、内部ドメイン型は TypeScript を source of truth とする。

## 直下のファイル

| Path | Role | Status |
|------|------|--------|
| [_map.md](_map.md) | この module contract design 成果物群の入口地図 | Private baselineへ更新済み |
| [module-boundaries.md](module-boundaries.md) | module責務、所有state、禁止依存、Future integration boundary、実装分担境界 | Private baseline語彙へ整理済み |
| [typescript-contracts.md](typescript-contracts.md) | shared branded ID、primitive、diagnostic、diff、DTO index の TypeScript / Zod 契約 | RuntimeEvaluationContext、RuntimeState/sequence artifact refs、RuntimeStateSequenceArtifact evidence fieldsへ更新済み |
| [package-file-format-contract.md](package-file-format-contract.md) | project-defined model package layout、layered character PSD profile、split PNG fallback、package DTO 対応 | layout tree / tableとも `runtime/states/` と `runtime/state-sequences/` generated evidenceへ更新済み |
| [operation-contracts.md](operation-contracts.md) | GUI / AI / migration / repair が共有する operation request/response/log/diff 契約 | `RunDynamicsPreviewSequencePayloadSchema.context`、`finalRuntimeState`、state/sequence artifact refsへ更新済み |
| [runtime-core-contract.md](runtime-core-contract.md) | Shared Runtime evaluation core、`parameter-grid-2d-v1`、Minimum Open Dynamics v1、parent-before-child rig control、snapshot契約 | RuntimeEvaluationContext正本、options profile廃止、state sequence initial/post-frame semanticsへ更新済み |
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
| Minimum Open Dynamics v1 はdriver parameterからcomputed output parameterを生成し、通常keyform / rig control評価へ渡す。MVPではinitial RuntimeState evidence、full RuntimeState sequence evidence、1 group = 1 output、weighted sum、`scalarDampedFollowV1`固定式 | [package-file-format-contract.md](package-file-format-contract.md), [runtime-core-contract.md](runtime-core-contract.md), [operation-contracts.md](operation-contracts.md), [validator-contract.md](validator-contract.md), [gui-operation-contract.md](gui-operation-contract.md), [fixtures-and-contract-tests.md](fixtures-and-contract-tests.md) |
| Runtime Export v0はWorkspace Save / Portable JSONとは別責務の実行用成果物。v0はdirectory + raw RGBA、materialized runtime graph、current atlas必須、player/camera appなし | [runtime-export-v0-contract.md](runtime-export-v0-contract.md), [../screen-design/screens/runtime-export-task.md](../screen-design/screens/runtime-export-task.md) |

## 参照入口

| Path | Role |
|------|------|
| [../../concept/modified_concept.md](../../concept/modified_concept.md) | 現在のPrivate Prototype baseline |
| [../../acceptance-criteria/03_MVP_Acceptance_Criteria.md](../../acceptance-criteria/03_MVP_Acceptance_Criteria.md) | MVP AC |
| [../../reports/cmo3-moc3-format-spec/format-feasibility-summary.md](../../reports/cmo3-moc3-format-spec/format-feasibility-summary.md) | Cubism形式調査のsuperseded方針 |
| [../../reports/rights-risk-cleanup/cleanup-report.md](../../reports/rights-risk-cleanup/cleanup-report.md) | 実装前に読む権利・商標・非互換方針 |

## 次の行動候補

1. Contract testsへ落とすfixture実体を作る。
2. Demo-safe preflight fixtureをvalidator/AI assistantの実装taskへ落とす。
3. Future integration boundaryを再開する場合は、transport/API公開範囲を別途reviewする。

## 未決事項

| 項目 | 分類 | 状態 |
|------|------|------|
| 実装時の npm package 名 / import path | can-defer | module ID と責務は暫定固定済み |
| fixture 実ファイルの保存場所 | can-defer | `fixtures/contracts/<fixture-id>/` を推奨 |
| rights-clean PSD art bytes の作成方法 | can-defer | provenance / rights / fixture manifest 契約は固定済み |
| HTTP JSON / WebSocket / MCP の具体endpoint | can-defer | transport-independent command contract が正だがFuture integration surface化はMVP外 |
