# Wave 4 Domain E Review: runtime validation evidence fixture

> Domain: `wave4-runtime-validation-evidence-fixture`  
> Review role: Review-Sylph / clean context review  
> Review date: 2026-05-29  
> Verdict: `pass`

## Scope Reviewed

- `fixtures/contracts/minimal-operation-runtime-evidence/**`
- `packages/operation-core/src/runtime-validation-evidence-fixture.test.ts`
- 関連 production source は read-only で参照:
  - `packages/authoring-core/src/index.ts`
  - `packages/authoring-core/src/to-runtime-graph.ts`
  - `packages/runtime-core/src/index.ts`
  - `packages/runtime-core/src/runtime-evidence.ts`
  - `packages/runtime-core/src/runtime-diff-builder.ts`
  - `packages/runtime-core/src/snapshot-comparison.ts`
  - `packages/validator-core/src/index.ts`
  - `packages/validator-core/src/runtime-evidence-report.ts`
  - `packages/validator-core/src/validation-diff-builder.ts`

Production source は編集していない。書き込みは本 review report のみ。

## Basis Used

- `discussion/implementation/orchestration/wave4-plan.md`
- `discussion/design/module-contracts/fixtures-and-contract-tests.md`
- `discussion/design/module-contracts/runtime-core-contract.md`
- `discussion/design/module-contracts/validator-contract.md`
- `discussion/design/module-contracts/operation-contracts.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/implementation/waves/wave4/wave4-operation-evidence-hook-foundation-completion.md`
- `discussion/implementation/reviews/wave4/wave4-operation-evidence-hook-foundation-review.md`
- `discussion/implementation/waves/wave4/wave4-runtime-validation-evidence-fixture-completion.md`
- 実ファイル一式

## Findings

### Blocking

なし。

### Major

なし。

### Minor / Non-blocking

1. Runtime diff summary は、新規 parameter 追加を `parameterChangeCount` として数えない現状を期待値化している。fixture は candidate runtime snapshot 上で `param_fixture_smile` と authored value を確認しているため Domain E の evidence 接続確認としては成立しているが、runtime diff だけを見ると追加 parameter の意味的差分は表現されない。参照: `fixtures/contracts/minimal-operation-runtime-evidence/expected/runtime-diff-summary.json:7`, `packages/operation-core/src/runtime-validation-evidence-fixture.test.ts:90`, `packages/operation-core/src/runtime-validation-evidence-fixture.test.ts:388`, `packages/runtime-core/src/snapshot-comparison.ts:26`。これは completion report の non-blocking note と一致し、Domain E の rubric では blocking にしない。

## Design / Development Compliance

- Fixture は text JSON のみ。`rg --files fixtures/contracts/minimal-operation-runtime-evidence` と拡張子確認で、対象 fixture 配下は `.json` 9 files のみだった。
- Fixture は required summaries を含む。baseline / authoring input は `baseline-authoring-input.json:3` から `:13`、operation requests は `request/create-parameter-*.request.json:2` から `:25`、expected runtime snapshot / validation report / runtime diff / validation diff / operation result evidence summary は `fixture-manifest.json:43` から `:64` で参照されている。
- Test は authoring-core adapter、runtime-core evidence helper、validator-core evidence helper、operation-core provider hook を接続している。参照: `packages/operation-core/src/runtime-validation-evidence-fixture.test.ts:6`, `:8`, `:29`, `:32`, `:33`, `:66`, `:67`, `:275`, `:276`, `:279`, `:296`, `:304`, `:314`, `:327`。
- GUI evidence は要求しておらず、invent していない。対象 fixture/test に対する `gui|GUI|screenshot|playwright|trace|image|png|moc3|Cubism|Live2D` 検索は request の `trace` field 以外 match なし。
- Domain E target の git status は新規 fixture JSON と `runtime-validation-evidence-fixture.test.ts` のみ。workspace には prior Wave4 domains の production source 変更が残っているが、Domain E completion / review target の範囲では production source 変更は確認していない。
- Test file は integration fixture responsibility に閉じており、operation-core 全般を広く追加検査する dump ではない。`check:source` も pass。

## Test Adequacy

- Operation request parse: covered。`OperationRequestSchema.parse` で dry-run / commit request を parse し、`createParameter` と payload 一致を確認している。参照: `packages/operation-core/src/runtime-validation-evidence-fixture.test.ts:39`, `:42`, `:45`, `:51`。
- Provider wiring produces runtime snapshot IDs and validation report IDs: covered。dry-run / commit の両方で `generatedRuntimeSnapshotIds` と `generatedValidationReportIds` を fixture summary と照合している。参照: `packages/operation-core/src/runtime-validation-evidence-fixture.test.ts:79`, `:82`, `:127`, `:130`。
- Dry-run non-mutating and evidence return: covered。runtime / validation diff presence、operation result evidence summary、session summary unchanged、target parameter absence を確認している。参照: `packages/operation-core/src/runtime-validation-evidence-fixture.test.ts:85`, `:86`, `:99`, `:102`。
- Commit mutates/appends log and returns evidence: covered。parameter creation、`authoringRevision` / `dirty` update、operation log append、result/log entry evidence refs を確認している。参照: `packages/operation-core/src/runtime-validation-evidence-fixture.test.ts:115`, `:122`, `:123`, `:124`, `:125`, `:126`, `:146`, `:147`, `:148`, `:149`, `:150`, `:151`, `:152`。
- Operation-core package-local regression context: covered。`pnpm.cmd exec vitest run packages/operation-core/src` は 6 files / 18 tests pass。

## Verification Performed

| Command | Outcome |
|---|---|
| `Get-Content -Encoding UTF8 C:\workspace\remie\code\ai-native-live2d-editor\.codex\skills\implementation-orchestration\SKILL.md` | pass。review execution rules を確認。 |
| `Get-Content -Encoding UTF8 C:\Users\remie\.codex\skills\discussion-management\SKILL.md` | pass。discussion artifact rules を確認。 |
| `Get-Content -Encoding UTF8 discussion/implementation/orchestration/wave4-plan.md` | pass。Domain E scope / required tests を確認。 |
| `Get-Content -Encoding UTF8 discussion/design/module-contracts/fixtures-and-contract-tests.md` | pass。fixture artifact requirements を確認。 |
| `Get-Content -Encoding UTF8 discussion/design/module-contracts/runtime-core-contract.md` | pass。runtime snapshot/diff requirements を確認。 |
| `Get-Content -Encoding UTF8 discussion/design/module-contracts/validator-contract.md` | pass。validation report/diff requirements を確認。 |
| `Get-Content -Encoding UTF8 discussion/design/module-contracts/operation-contracts.md` | pass。operation request/result/log evidence requirements を確認。 |
| `Get-Content -Encoding UTF8 discussion/development_convention/source-file-organization-policy.md` | pass。test/source responsibility policy を確認。 |
| `Get-Content -Encoding UTF8 discussion/implementation/waves/wave4/wave4-operation-evidence-hook-foundation-completion.md` | pass。Domain D completion を確認。 |
| `Get-Content -Encoding UTF8 discussion/implementation/reviews/wave4/wave4-operation-evidence-hook-foundation-review.md` | pass。Domain D review を確認。 |
| `Get-Content -Encoding UTF8 discussion/implementation/waves/wave4/wave4-runtime-validation-evidence-fixture-completion.md` | pass。Domain E implementer report を確認。 |
| `rg --files fixtures/contracts/minimal-operation-runtime-evidence packages/operation-core/src` | pass。target inventory を確認。 |
| `git status --short -uall` | pass。workspace dirty state を確認。 |
| `git diff --name-only` | pass。tracked production changes が prior domains と混在していることを確認。 |
| `Get-Content -Encoding UTF8 packages/operation-core/src/runtime-validation-evidence-fixture.test.ts` | pass。test implementation を確認。 |
| `Get-Content -Encoding UTF8 fixtures/contracts/minimal-operation-runtime-evidence/fixture-manifest.json` | pass。manifest を確認。 |
| `Get-Content -Encoding UTF8 fixtures/contracts/minimal-operation-runtime-evidence/baseline-authoring-input.json` | pass。baseline / authoring input reference を確認。 |
| `Get-Content -Encoding UTF8 fixtures/contracts/minimal-operation-runtime-evidence/request/create-parameter-dry-run.request.json` | pass。dry-run request を確認。 |
| `Get-Content -Encoding UTF8 fixtures/contracts/minimal-operation-runtime-evidence/request/create-parameter-commit.request.json` | pass。commit request を確認。 |
| `Get-Content -Encoding UTF8 fixtures/contracts/minimal-operation-runtime-evidence/expected/runtime-snapshot-summary.json` | pass。runtime snapshot summary を確認。 |
| `Get-Content -Encoding UTF8 fixtures/contracts/minimal-operation-runtime-evidence/expected/validation-report-summary.json` | pass。validation report summary を確認。 |
| `Get-Content -Encoding UTF8 fixtures/contracts/minimal-operation-runtime-evidence/expected/runtime-diff-summary.json` | pass。runtime diff summary を確認。 |
| `Get-Content -Encoding UTF8 fixtures/contracts/minimal-operation-runtime-evidence/expected/validation-diff-summary.json` | pass。validation diff summary を確認。 |
| `Get-Content -Encoding UTF8 fixtures/contracts/minimal-operation-runtime-evidence/expected/operation-result-evidence-summary.json` | pass。operation result evidence summary を確認。 |
| `rg -n "createAuthoringSessionFromPackageDocument|toRuntimeGraph|buildRuntimeEvidence|buildRuntimeEvidenceReport|buildValidationDiff|createOperationCore|OperationRequestSchema|dryRunOperation|commitOperation|operationLog|authoringRevision|dirty|runtimeDiff|validationDiff|generatedRuntimeSnapshotIds|generatedValidationReportIds|OperationEvidenceResultSchema|collectFixtureEvidence" packages/operation-core/src/runtime-validation-evidence-fixture.test.ts` | pass。line refs を取得。 |
| `rg -n "fixtureId|baseline-authoring-input|create-parameter-dry-run|create-parameter-commit|runtime-snapshot-summary|validation-report-summary|runtime-diff-summary|validation-diff-summary|operation-result-evidence-summary|operationLog|runtimeSnapshot|validationReport|runtimeDiff|validationDiff" fixtures/contracts/minimal-operation-runtime-evidence/fixture-manifest.json` | pass。manifest line refs を取得。 |
| `rg -n "schemaVersion|baselinePackage|authoringInput|packageHash|expectedInitial" fixtures/contracts/minimal-operation-runtime-evidence/baseline-authoring-input.json` | pass。baseline line refs を取得。 |
| `rg -n "schemaVersion|operationId|dryRun|operationType|parameterId|basePackageRevision|relatedAC|relatedScenarios" fixtures/contracts/minimal-operation-runtime-evidence/request/create-parameter-dry-run.request.json fixtures/contracts/minimal-operation-runtime-evidence/request/create-parameter-commit.request.json` | pass。request line refs を取得。 |
| `rg -n "generatedRuntimeSnapshotIds|generatedRuntimeStateRefs|generatedRuntimeStateSequenceRefs|finalRuntimeState|baselineSnapshot|candidateSnapshot|authoredParameterValues" fixtures/contracts/minimal-operation-runtime-evidence/expected/runtime-snapshot-summary.json fixtures/contracts/minimal-operation-runtime-evidence/expected/operation-result-evidence-summary.json` | pass。runtime/result evidence line refs を取得。 |
| `rg -n "dryRun|commit|baselineReportId|candidateReportId|operationLogPresent|operationLogPath|runtimeSnapshotIds|newFailureCount|resolvedFailureCount|severityChangeCount|parameterChangeCount|beforeSnapshotId|afterSnapshotId" fixtures/contracts/minimal-operation-runtime-evidence/expected/validation-report-summary.json fixtures/contracts/minimal-operation-runtime-evidence/expected/validation-diff-summary.json fixtures/contracts/minimal-operation-runtime-evidence/expected/runtime-diff-summary.json` | pass。validation/runtime diff line refs を取得。 |
| `rg -n "ContractFixtureIdSchema|contract-fixture-manifest-v1|minimal-operation-runtime-evidence|fixture-manifest" packages fixtures -g '*.ts' -g '*.json'` | pass。実装済み manifest schema の有無と fixture references を確認。 |
| `Get-Content -Encoding UTF8 packages/runtime-core/src/index.ts` | pass。runtime public exports を確認。 |
| `Get-Content -Encoding UTF8 packages/runtime-core/src/runtime-evidence.ts` | pass。runtime evidence helper を確認。 |
| `Get-Content -Encoding UTF8 packages/validator-core/src/index.ts` | pass。validator public exports を確認。 |
| `Get-Content -Encoding UTF8 packages/validator-core/src/runtime-evidence-report.ts` | pass。runtime snapshot evidence report helper を確認。 |
| `Get-Content -Encoding UTF8 packages/validator-core/src/validation-diff-builder.ts` | pass。validation diff helper を確認。 |
| `rg -n 'runtime-evidence|runtime-state-artifacts|buildRuntimeEvidence|generatedRuntimeSnapshotIds|generatedRuntimeStateRefs|generatedRuntimeStateSequenceRefs|runtimeDiff|createRuntimeStateArtifactRef|createRuntimeStateSequenceArtifactRef' packages/runtime-core/src/index.ts packages/runtime-core/src/runtime-evidence.ts` | pass。runtime helper line refs を取得。 |
| `rg -n 'runtime-evidence-report|validation-diff-builder|buildRuntimeEvidenceReport|validateRuntimeSnapshotEvidence|createOperationLogEvidence|runtimeSnapshotIds|buildValidationDiff|newFailures|resolvedFailures|severityChanges' packages/validator-core/src/index.ts packages/validator-core/src/runtime-evidence-report.ts packages/validator-core/src/validation-diff-builder.ts` | pass。validator helper line refs を取得。 |
| `rg -n "export .*operation-evidence|export .*operation-core|export .*operation-result|export .*operation-request" packages/operation-core/src/index.ts` | pass。operation-core public exports を確認。 |
| `rg -n "export .*to-runtime-graph|toRuntimeGraph|createAuthoringSessionFromPackageDocument|getParameterById" packages/authoring-core/src/index.ts packages/authoring-core/src/to-runtime-graph.ts packages/authoring-core/src/authoring-session.ts` | pass。authoring adapter/export refs を確認。 |
| `rg --files fixtures/contracts/minimal-operation-runtime-evidence` | pass。fixture files は 9 files。 |
| `Get-ChildItem -Recurse -File fixtures/contracts/minimal-operation-runtime-evidence | Select-Object -ExpandProperty Extension` | pass。すべて `.json`。 |
| `rg -n "gui|GUI|screenshot|playwright|trace|image|png|moc3|Cubism|Live2D" fixtures/contracts/minimal-operation-runtime-evidence packages/operation-core/src/runtime-validation-evidence-fixture.test.ts` | pass。GUI/media/proprietary evidence はなし。`trace` field のみ match。 |
| `rg -n "@private-2d-rigging-lab/(runtime-core|validator-core)|editor-ui|ai-interface|renderer|transport|WebSocket|MCP|HTTP" packages/operation-core/src -g "*.ts" -g "!*.test.ts"` | exit 1。production operation-core forbidden import match なし。 |
| `git status --short -uall fixtures/contracts/minimal-operation-runtime-evidence packages/operation-core/src/runtime-validation-evidence-fixture.test.ts` | pass。Domain E target は untracked fixture/test files のみ。 |
| `git diff --name-only -- fixtures/contracts/minimal-operation-runtime-evidence packages/operation-core/src/runtime-validation-evidence-fixture.test.ts` | pass。tracked diff なし。対象は untracked。 |
| `git diff --name-only -- packages/operation-core/src ':!packages/operation-core/src/*.test.ts'` | pass。operation-core production changes は prior Domain D scope files。Domain E target ではない。 |
| `pnpm.cmd exec vitest run packages/operation-core/src/runtime-validation-evidence-fixture.test.ts` | sandbox では EPERM で Vitest open に失敗。許可付き再実行で pass。1 file / 3 tests pass。 |
| `pnpm.cmd typecheck` | sandbox では EPERM で TypeScript `tsc` open に失敗。許可付き再実行で pass。 |
| `git diff --check -- fixtures/contracts/minimal-operation-runtime-evidence packages/operation-core/src/runtime-validation-evidence-fixture.test.ts` | pass。 |
| `pnpm.cmd check:source` | pass。`Source organization guard passed.` |
| `pnpm.cmd check:deps` | pass。`Dependency guard passed.` |
| `pnpm.cmd exec vitest run packages/operation-core/src` | 許可付きで pass。6 files / 18 tests pass。 |
| `Get-Content -Encoding UTF8 packages/runtime-core/src/runtime-diff-builder.ts` | pass。runtime diff helper delegation を確認。 |
| `rg -n "parameterChanges|beforeParameters|afterParameters|compare|new parameter|missing" packages/runtime-core/src/runtime-diff-builder.ts packages/runtime-core/src/snapshot-comparison.ts` | pass。runtime diff minor risk の line refs を取得。 |
| `Get-Content -Encoding UTF8 packages/runtime-core/src/snapshot-comparison.ts` | pass。new parameter skip behavior を確認。 |
| `Test-Path discussion/implementation/reviews/wave4/wave4-runtime-validation-evidence-fixture-review.md` | pass。report 未作成を確認してから作成。 |
| `git diff --check -- discussion/implementation/reviews/wave4/wave4-runtime-validation-evidence-fixture-review.md` | pass。report の whitespace check を確認。 |
| `Get-Content -Encoding UTF8 discussion/implementation/reviews/wave4/wave4-runtime-validation-evidence-fixture-review.md` | pass。作成後の report 内容を確認。 |

補助コマンドのうち、PowerShell quoting のため失敗し、結果を採用しなかったもの:

| Command | Outcome |
|---|---|
| `rg -n "export \* from \"./runtime-evidence|export \* from \"./runtime-state-artifacts|buildRuntimeEvidence|generatedRuntimeSnapshotIds|generatedRuntimeStateRefs|generatedRuntimeStateSequenceRefs|runtimeDiff|createRuntimeStateArtifactRef|createRuntimeStateSequenceArtifactRef" packages/runtime-core/src/index.ts packages/runtime-core/src/runtime-evidence.ts` | PowerShell parser error。single-quote 版で再実行済み。 |
| `rg -n "export \* from \"./runtime-evidence-report|export \* from \"./validation-diff-builder|buildRuntimeEvidenceReport|validateRuntimeSnapshotEvidence|createOperationLogEvidence|runtimeSnapshotIds|buildValidationDiff|newFailures|resolvedFailures|severityChanges" packages/validator-core/src/index.ts packages/validator-core/src/runtime-evidence-report.ts packages/validator-core/src/validation-diff-builder.ts` | PowerShell parser error。single-quote 版で再実行済み。 |

## Remaining Risks

- Runtime diff は新規 parameter 追加を差分として数えない。Domain E は runtime snapshot summary と operation evidence refs で接続証明をしているが、将来 runtime diff semantics を強くするなら runtime-core 側の別判断が必要。
- Workspace は Wave4 全体の未コミット変更を含むため、Git だけで Domain E の変更 attribution を完全には証明できない。Domain E target と completion report 上は production source 変更なし。
- Integration test は production dependency を増やさないため、operation-core test から runtime-core / validator-core の `src/index.js` を relative import している。public exports 経由ではあるが、package-level integration runner ができたらそちらへ寄せる余地がある。

## User-Decision Points

- 現時点で Domain E pass を止める user decision はなし。
- 将来 fixture manifest schema に `operationResult` artifact kind を追加するかは、fixture contract 更新時の判断事項。
- `createParameter` で新規 parameter が runtime diff に現れるべきかは、runtime-core diff semantics の判断事項。
- Commit 時の `packageRevision` increment は Domain D review から残っている横断リスクであり、Domain E 固有の blocker ではない。

## Verdict Rationale

Fixture は text JSON のみで、baseline package / authoring input reference、operation request、runtime snapshot summary、validation report summary、runtime diff / validation diff summary、operation result evidence summary を含む。Test は authoring adapter、runtime evidence helper、validator evidence helper、operation-core provider hook を実際に接続し、request parse、dry-run non-mutation + evidence、commit mutation/log append + evidence refs を確認している。

Targeted fixture test、operation-core test suite、typecheck、source/dependency guards、diff whitespace check が pass した。Blocking / major findings はないため、verdict は `pass` とする。
