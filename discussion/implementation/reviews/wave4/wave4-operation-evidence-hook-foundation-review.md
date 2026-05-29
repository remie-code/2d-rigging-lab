# Wave 4 Domain D Review: operation evidence hook foundation

> Domain: `wave4-operation-evidence-hook-foundation`  
> Review role: Review-Sylph / clean context review  
> Review date: 2026-05-29  
> Verdict: `pass`

## Scope Reviewed

- `packages/operation-core/package.json`
- `packages/operation-core/src/**`
- Domain completion report:
  - `discussion/implementation/waves/wave4/wave4-operation-evidence-hook-foundation-completion.md`

Production source は編集していない。書き込みは本 review report のみ。

## Basis Used

- `discussion/implementation/orchestration/wave4-plan.md`
- `discussion/design/module-contracts/operation-contracts.md`
- `discussion/design/module-contracts/module-boundaries.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/implementation/waves/wave4/wave4-authoring-runtime-adapter-foundation-completion.md`
- `discussion/implementation/reviews/wave4/wave4-authoring-runtime-adapter-foundation-review.md`
- `discussion/implementation/waves/wave4/wave4-runtime-evidence-helper-foundation-completion.md`
- `discussion/implementation/reviews/wave4/wave4-runtime-evidence-helper-foundation-review.md`
- `discussion/implementation/waves/wave4/wave4-validator-evidence-report-foundation-completion.md`
- `discussion/implementation/reviews/wave4/wave4-validator-evidence-report-foundation-review.md`
- `discussion/implementation/waves/wave4/wave4-operation-evidence-hook-foundation-completion.md`
- `discussion/_conventions.md`
- `discussion/_map.md`

## Findings

### Blocking

なし。

### Major

なし。

### Minor / Non-blocking

1. Package revision update semantics は未実装のまま残っている。`operation-contracts.md:530` と `wave4-plan.md:364` は commit 時の `packageRevision` update を要求しているが、現実装の commit path は evidence merge から log entry append までで、`session.packageRevision` を更新していない。参照: `packages/operation-core/src/lifecycle/commit.ts:73`, `packages/operation-core/src/lifecycle/commit.ts:85`, `packages/operation-core/src/lifecycle/commit.ts:95`。ただし今回の明示 rubric は provider hook と Wave3 互換を中心にしており、completion report もこの点を user-decision candidate として記録しているため、この Domain D review では blocking にしない。参照: `discussion/implementation/waves/wave4/wave4-operation-evidence-hook-foundation-completion.md:91`。
2. Provider が例外を投げる、または schema 不適合 evidence を返す場合の commit atomicity は未定義。commit は先に mutation を適用し、その後 `applyOperationEvidence` を呼ぶため、provider failure 時の rollback / log policy は後続で決める必要がある。参照: `packages/operation-core/src/lifecycle/commit.ts:66`, `packages/operation-core/src/lifecycle/commit.ts:73`。現 rubric は provider success path を対象にしているため、remaining risk として扱う。

## Design / Development Compliance

- Evidence provider hook: pass。`createOperationCore` option から `dryRunOperation` / `commitOperation` へ provider が渡される。参照: `packages/operation-core/src/operation-core.ts:13`, `packages/operation-core/src/operation-core.ts:29`, `packages/operation-core/src/operation-core.ts:37`。
- Provider input boundary: pass。provider input は `baselineSession`、`candidateSession`、`request`、`result`、`targetIds`、`lifecycle` に限定されている。参照: `packages/operation-core/src/operation-evidence-provider.ts:9`, `packages/operation-core/src/operation-evidence-provider.ts:11`, `packages/operation-core/src/operation-evidence-provider.ts:12`。
- Provider evidence subset: pass。provider result は `OperationEvidenceResultSchema` で runtime diff、validation diff、runtime snapshot / state / sequence refs、final runtime state、validation report IDs に限定される。参照: `packages/operation-core/src/operation-evidence-result.ts:12`, `packages/operation-core/src/operation-evidence-result.ts:15`, `packages/operation-core/src/operation-evidence-result.ts:20`。
- Provider absent behavior: pass。`applyOperationEvidence` は provider 未指定なら元 result をそのまま返し、commit 側も provider 未指定時は baseline clone を作らない。参照: `packages/operation-core/src/lifecycle/evidence.ts:23`, `packages/operation-core/src/lifecycle/evidence.ts:26`, `packages/operation-core/src/lifecycle/commit.ts:64`。
- Provider present dry-run: pass。dry-run handler は `createDryRunAuthoringSession` による candidate を作り、original session を baseline として provider に渡す。provider success path では original session mutation は発生しない。参照: `packages/operation-core/src/operations/create-parameter.ts:24`, `packages/operation-core/src/lifecycle/dry-run.ts:46`, `packages/operation-core/src/lifecycle/dry-run.ts:51`, `packages/operation-core/src/lifecycle/dry-run.ts:52`。
- Provider present commit: pass。commit は provider がある場合に commit 直前 baseline clone を作り、commit 後 candidate と evidence merge 済み result を log entry に渡す。log entry の `runtimeSnapshotIds` / `validationReportIds` も result の generated refs から反映される。参照: `packages/operation-core/src/lifecycle/commit.ts:64`, `packages/operation-core/src/lifecycle/commit.ts:73`, `packages/operation-core/src/lifecycle/commit.ts:78`, `packages/operation-core/src/lifecycle/commit.ts:79`, `packages/operation-core/src/operation-log.ts:50`, `packages/operation-core/src/operation-log.ts:51`。
- Rejected / duplicate operation: pass。prepare / unsupported / handler rejected path は provider 呼び出し前に返る。duplicate precondition は handler 内で rejected result を返し、dry-run / commit lifecycle は `status` check で provider を呼ばない。参照: `packages/operation-core/src/lifecycle/dry-run.ts:22`, `packages/operation-core/src/lifecycle/dry-run.ts:29`, `packages/operation-core/src/lifecycle/dry-run.ts:42`, `packages/operation-core/src/lifecycle/commit.ts:40`, `packages/operation-core/src/lifecycle/commit.ts:50`, `packages/operation-core/src/lifecycle/commit.ts:67`, `packages/operation-core/src/operations/create-parameter.ts:62`。
- No direct runtime / validator dependency: pass。production source と package manifest は `authoring-core` / `contracts` だけを direct package dependency として使い、`runtime-core` / `validator-core` import は検出されなかった。参照: `packages/operation-core/package.json:10`, `packages/operation-core/package.json:11`。
- No GUI / AI / renderer / transport imports: pass。production source search で `editor-ui` / `ai-interface` / `renderer-adapter` / transport 系 match はなし。
- `index.ts` barrel-only: pass。`packages/operation-core/src/index.ts:1` から `:22` は export statement のみ。
- Source organization: pass。provider interface、provider result schema、provider application、dry-run / commit lifecycle、operation handler、operation log が責務別ファイルに分かれており、`check:source` も pass。

## Test Adequacy

- Provider absent tests: covered。`operation-lifecycle.test.ts` は provider なしの dry-run non-mutating、commit log append、duplicate rejection を検証している。参照: `packages/operation-core/src/operation-lifecycle.test.ts:9`, `packages/operation-core/src/operation-lifecycle.test.ts:25`, `packages/operation-core/src/operation-lifecycle.test.ts:52`。
- Provider present dry-run tests: covered。runtime / validation evidence fields、generated refs、final runtime state、original session non-mutation、log absence を検証している。参照: `packages/operation-core/src/operation-evidence.test.ts:14`, `packages/operation-core/src/operation-evidence.test.ts:36`, `packages/operation-core/src/operation-evidence.test.ts:45`, `packages/operation-core/src/operation-evidence.test.ts:47`。
- Provider present commit/log tests: covered。result と log entry の generated runtime snapshot IDs / validation report IDs、log-level refs、session mutation、log append を検証している。参照: `packages/operation-core/src/operation-evidence.test.ts:52`, `packages/operation-core/src/operation-evidence.test.ts:78`, `packages/operation-core/src/operation-evidence.test.ts:80`, `packages/operation-core/src/operation-evidence.test.ts:82`, `packages/operation-core/src/operation-evidence.test.ts:83`。
- Duplicate rejection / provider-not-called test: covered。2回目 commit の duplicate rejection で provider call count、session revision、log length が変わらないことを検証している。参照: `packages/operation-core/src/operation-evidence.test.ts:88`, `packages/operation-core/src/operation-evidence.test.ts:100`, `packages/operation-core/src/operation-evidence.test.ts:108`。
- Boundary guard / search: adequate for this foundation。`dependency-boundary.test.ts` は `index.ts` barrel-only と forbidden root import を検査し、別途 `rg` で production source / package manifest も確認した。参照: `packages/operation-core/src/dependency-boundary.test.ts:8`, `packages/operation-core/src/dependency-boundary.test.ts:20`。

## Verification Performed

| Command | Outcome |
|---|---|
| `Get-Content -Encoding UTF8 C:\workspace\remie\code\ai-native-live2d-editor\.codex\skills\implementation-orchestration\SKILL.md` | pass。review execution rules を確認。 |
| `Get-Content -Encoding UTF8 C:\Users\remie\.codex\skills\discussion-management\SKILL.md` | pass。discussion artifact rules を確認。 |
| `rg --files packages/operation-core` | pass。review target inventory を確認。 |
| `Get-Content -Encoding UTF8 discussion/_conventions.md` | pass。discussion 配置規約を確認。 |
| `Get-Content -Encoding UTF8 discussion/_map.md` | pass。Wave4 entry status を確認。 |
| `git status --short -uall` | pass。既存 dirty / untracked 状態を確認。production source は編集しない方針で継続。 |
| `Get-Content -Encoding UTF8 discussion/implementation/orchestration/wave4-plan.md` | pass。Domain D scope / expected shape / pass criteria を確認。 |
| `Get-Content -Encoding UTF8 discussion/design/module-contracts/operation-contracts.md` | pass。operation result / log / dry-run / commit contract を確認。 |
| `Get-Content -Encoding UTF8 discussion/design/module-contracts/module-boundaries.md` | pass。module boundary / forbidden dependency を確認。 |
| `Get-Content -Encoding UTF8 discussion/development_convention/source-file-organization-policy.md` | pass。barrel-only / source split policy を確認。 |
| `Get-Content -Encoding UTF8 discussion/implementation/waves/wave4/wave4-authoring-runtime-adapter-foundation-completion.md` | pass。Domain A completion を確認。 |
| `Get-Content -Encoding UTF8 discussion/implementation/reviews/wave4/wave4-authoring-runtime-adapter-foundation-review.md` | pass。Domain A review pass を確認。 |
| `Get-Content -Encoding UTF8 discussion/implementation/waves/wave4/wave4-runtime-evidence-helper-foundation-completion.md` | pass。Domain B completion を確認。 |
| `Get-Content -Encoding UTF8 discussion/implementation/reviews/wave4/wave4-runtime-evidence-helper-foundation-review.md` | pass。Domain B review pass を確認。 |
| `Get-Content -Encoding UTF8 discussion/implementation/waves/wave4/wave4-validator-evidence-report-foundation-completion.md` | pass。Domain C completion を確認。 |
| `Get-Content -Encoding UTF8 discussion/implementation/reviews/wave4/wave4-validator-evidence-report-foundation-review.md` | pass。Domain C review pass を確認。 |
| `Get-Content -Encoding UTF8 discussion/implementation/waves/wave4/wave4-operation-evidence-hook-foundation-completion.md` | pass。Domain D completion を確認。 |
| `Get-Content -Encoding UTF8 packages/operation-core/package.json` | pass。direct dependencies を確認。 |
| `Get-Content -Encoding UTF8 packages/operation-core/src/operation-core.ts` | pass。provider option wiring を確認。 |
| `Get-Content -Encoding UTF8 packages/operation-core/src/lifecycle/dry-run.ts` | pass。dry-run provider hook / reject path を確認。 |
| `Get-Content -Encoding UTF8 packages/operation-core/src/lifecycle/commit.ts` | pass。commit provider hook / log entry path を確認。 |
| `Get-Content -Encoding UTF8 packages/operation-core/src/lifecycle/evidence.ts` | pass。evidence validation / merge logic を確認。 |
| `Get-Content -Encoding UTF8 packages/operation-core/src/operation-evidence-provider.ts` | pass。provider input contract を確認。 |
| `Get-Content -Encoding UTF8 packages/operation-core/src/operation-evidence-result.ts` | pass。provider result schema を確認。 |
| `Get-Content -Encoding UTF8 packages/operation-core/src/operation-registry.ts` | pass。candidate session outcome を確認。 |
| `Get-Content -Encoding UTF8 packages/operation-core/src/operations/create-parameter.ts` | pass。dry-run clone / duplicate rejection / candidate session を確認。 |
| `Get-Content -Encoding UTF8 packages/operation-core/src/operation-evidence.test.ts` | pass。provider present / duplicate tests を確認。 |
| `Get-Content -Encoding UTF8 packages/operation-core/src/operation-lifecycle.test.ts` | pass。provider absent Wave3-compatible tests を確認。 |
| `Get-Content -Encoding UTF8 packages/operation-core/src/dependency-boundary.test.ts` | pass。boundary guard を確認。 |
| `Get-Content -Encoding UTF8 packages/operation-core/src/index.ts` | pass。barrel-only を確認。 |
| `Get-Content -Encoding UTF8 packages/operation-core/src/operation-result.ts` | pass。evidence fields を確認。 |
| `Get-Content -Encoding UTF8 packages/operation-core/src/operation-log.ts` | pass。log entry refs mapping を確認。 |
| `Get-Content -Encoding UTF8 packages/operation-core/src/operation-log-entry.ts` | pass。log entry schema を確認。 |
| `Get-Content -Encoding UTF8 packages/operation-core/src/preconditions.ts` | pass。prepare / rejected result path を確認。 |
| `Get-Content -Encoding UTF8 packages/authoring-core/src/authoring-session.ts` | pass。`cloneAuthoringSession` / `createDryRunAuthoringSession` を確認。 |
| `Get-Content -Encoding UTF8 packages/authoring-core/src/session-clone.ts` | failed。file does not exist。clone helper は `authoring-session.ts` にあることを確認済み。 |
| `rg -n '@private-2d-rigging-lab/(runtime-core|validator-core)|editor-ui|ai-interface|renderer-adapter|transport|WebSocket|MCP|HTTP' packages/operation-core/src -g '*.ts' -g '!*.test.ts'` | exit 1。match なし。 |
| `rg -n '^\s*(import|export)\b|function|class|const|let|var|=>' packages/operation-core/src/index.ts` | pass。export statements only。 |
| `pnpm.cmd exec vitest run packages/operation-core/src/operation-evidence.test.ts packages/operation-core/src/operation-lifecycle.test.ts packages/operation-core/src/dependency-boundary.test.ts` | sandbox では EPERM で Vitest open に失敗。許可付き再実行は pass。3 files / 8 tests pass。 |
| `pnpm.cmd typecheck` | sandbox では EPERM で `tsc` open に失敗。許可付き再実行は pass。 |
| `pnpm.cmd exec vitest run packages/operation-core/src` | sandbox では EPERM で Vitest open に失敗。許可付き再実行は pass。5 files / 15 tests pass。 |
| `pnpm.cmd check:source` | pass。`Source organization guard passed.` |
| `pnpm.cmd check:deps` | pass。`Dependency guard passed.` |
| `git diff --check -- packages/operation-core/src packages/operation-core/package.json discussion/implementation/waves/wave4/wave4-operation-evidence-hook-foundation-completion.md` | exit 0。CRLF warning のみ。 |
| `rg -n "applyOperationEvidence|baselineSession|candidateSession|OperationEvidenceResultSchema|generatedRuntimeSnapshotIds|generatedValidationReportIds|runtimeSnapshotIds|validationReportIds|collectOperationEvidence|evidenceProvider" packages/operation-core/src/operation-core.ts packages/operation-core/src/operation-evidence-provider.ts packages/operation-core/src/operation-evidence-result.ts packages/operation-core/src/lifecycle/dry-run.ts packages/operation-core/src/lifecycle/commit.ts packages/operation-core/src/lifecycle/evidence.ts packages/operation-core/src/operation-log.ts` | pass。provider / evidence merge line refs を取得。 |
| `rg -n "adds dry-run|adds commit|does not call the provider|dry-runs createParameter|commits createParameter|rejects duplicate|keeps the public index|does not import GUI" packages/operation-core/src -g '*.test.ts'` | pass。test coverage line refs を取得。 |
| `rg -n -g '*.ts' -g '!*.test.ts' '@private-2d-rigging-lab/(runtime-core|validator-core)|editor-ui|ai-interface|renderer-adapter|transport|WebSocket|MCP|HTTP' -- packages/operation-core/src packages/operation-core/package.json` | exit 1。match なし。 |
| `rg -n -g '*.ts' -g '!*.test.ts' '@private-2d-rigging-lab/' -- packages/operation-core/src packages/operation-core/package.json` | pass。production imports / package dependencies は `authoring-core` と `contracts` のみ。 |
| `rg -n "import\(" packages/operation-core/src` | exit 1。dynamic import match なし。 |
| `rg -n "generatedRuntimeSnapshotIds|generatedRuntimeStateRefs|generatedRuntimeStateSequenceRefs|finalRuntimeState|generatedValidationReportIds|OperationResultSchema|OperationLogEntrySchema" packages/operation-core/src/operation-schemas.test.ts` | pass。schema evidence defaults の既存 test refs を確認。 |
| `rg -n "packageRevision|basePackageRevision|authoringRevision|operationLog.append|createOperationLogEntry|const result = applyOperationEvidence" packages/operation-core/src/lifecycle/commit.ts packages/operation-core/src/preconditions.ts packages/operation-core/src/operation-lifecycle.test.ts packages/operation-core/src/operation-evidence.test.ts` | pass。package revision risk line refs を取得。 |
| <code>rg -n "packageRevision&#124;RevisionUpdated&#124;Commit must append&#124;update `packageRevision`&#124;commit 成功時に package revision" discussion/design/module-contracts/operation-contracts.md discussion/implementation/orchestration/wave4-plan.md discussion/implementation/waves/wave4/wave4-operation-evidence-hook-foundation-completion.md</code> | pass。basis 上の package revision requirement / completion caveat refs を取得。 |
| `Test-Path discussion/implementation/reviews/wave4/wave4-operation-evidence-hook-foundation-review.md` | pass。report 未作成を確認。 |

補助コマンドのうち、PowerShell quoting / Windows wildcard 問題で失敗し、結果を採用しなかったもの:

| Command | Outcome |
|---|---|
| `rg -n "applyOperationEvidence|baselineSession|candidateSession|provider|collectOperationEvidence|generatedRuntimeSnapshotIds|generatedValidationReportIds|runtimeSnapshotIds|validationReportIds|OperationEvidenceResultSchema|OperationEvidenceProviderInput|lifecycle: \"dry_run\"|lifecycle: \"commit\"" packages/operation-core/src` | quoting の影響で一部出力後に `os error 123`。後続の分割 search で再確認済み。 |
| `rg -n "does not call the provider|adds dry-run|adds commit|duplicate|dry-runs createParameter|commits createParameter|keeps the public index|does not import GUI|forbiddenImportPattern" packages/operation-core/src/*.test.ts` | Windows path wildcard が rg file operand として失敗。`-g '*.test.ts'` で再実行済み。 |
| `rg -n "@private-2d-rigging-lab/(runtime-core|validator-core)|@private-2d-rigging-lab/(editor-ui|ai-interface|renderer-adapter)|transport|WebSocket|MCP|HTTP|from\s+['\"]@private-2d-rigging-lab" packages/operation-core/src packages/operation-core/package.json` | PowerShell parser error。simpler forbidden import search と package import inventory で再実行済み。 |

## Remaining Risks

- Package revision update は operation contract / Wave4 plan 上の要求として残っているが、この Domain D 実装は Wave3 互換維持のため未実装。integration review か次 domain で、`packageRevision` increment の有無、duplicate / subsequent request の `basePackageRevision` 期待、fixture 更新範囲を明確化する必要がある。
- Provider failure / invalid evidence の rollback または rejected result policy は未定義。real provider wiring で runtime / validator helper が失敗しうる場合、commit mutation と operation log evidence の atomicity を設計する必要がある。
- Boundary guard は static root package import を主に見る。今回の production source に dynamic import はなく、`rg` search でも forbidden import はなかったが、将来 subpath export / dynamic import を導入する場合は guard 強化が必要。
- Domain D は provider hook foundation であり、Domain A/B/C の real helper をつなぐ provider 実装と integration fixture は後続 Domain E / integration review で検証が必要。

## User-Decision Points

- 現時点で Domain D pass を止める user decision はなし。
- 将来 commit 時に `packageRevision` を必ず increment するなら、operation contract の記述通りに進めるか、Wave3 互換を維持する例外を明文化するかをユーザー判断で決める必要がある。
- Provider failure 時に「commit を rollback / rejected にする」「mutation を許容して log に failure を残す」「provider を fail-fast trusted component とする」のどれを採用するかは、real provider integration 前に決める余地がある。

## Verdict Rationale

今回の rubric に含まれる evidence provider hook、provider absent Wave3-compatible behavior、provider present dry-run evidence + non-mutation、provider present commit result/log evidence、duplicate rejection provider-not-called、forbidden dependency、barrel-only `index.ts`、source split、required targeted tests は確認できた。

Package revision と provider failure atomicity は basis 上の残リスクとして残るが、Domain D の明示 review 条件を満たしており、targeted verification も pass しているため、verdict は `pass` とする。
