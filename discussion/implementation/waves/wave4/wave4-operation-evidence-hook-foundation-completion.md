# Wave 4 Domain D Completion: operation evidence hook foundation

> Domain: `wave4-operation-evidence-hook-foundation`  
> 実施日: 2026-05-29  
> 担当: Orch-Sylph domain agent  
> Verdict: pass

## Changed Files

- `packages/operation-core/src/operation-evidence-provider.ts`
  - runtime / validation evidence provider interface を追加。
- `packages/operation-core/src/operation-evidence-result.ts`
  - provider が返す evidence subset の Zod DTO を追加。
- `packages/operation-core/src/lifecycle/evidence.ts`
  - provider 呼び出しと `OperationResultDto` への evidence merge を追加。
- `packages/operation-core/src/lifecycle/dry-run.ts`
  - provider 指定時のみ dry-run candidate session と baseline session を渡して evidence を統合。
- `packages/operation-core/src/lifecycle/commit.ts`
  - provider 指定時のみ commit 前 baseline clone と commit 後 candidate session を渡し、result / log entry に evidence を統合。
- `packages/operation-core/src/operation-core.ts`
  - `createOperationCore` option に `evidenceProvider` を追加。
- `packages/operation-core/src/operation-registry.ts`
  - operation apply outcome に `candidateSession` を追加。
- `packages/operation-core/src/operations/create-parameter.ts`
  - dry-run / commit / rejection outcome に candidate session を返すよう更新。
- `packages/operation-core/src/operation-evidence.test.ts`
  - provider あり dry-run / commit / duplicate rejection のテストを追加。
- `packages/operation-core/src/index.ts`
  - barrel export のみ更新。

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
- `packages/operation-core/src/index.ts`
- `packages/authoring-core/src/index.ts`
- `packages/contracts/src/index.ts`
- `packages/runtime-core/src/index.ts` / `packages/validator-core/src/index.ts` は provider 実装期待の把握目的で参照のみ。

## Implementation Summary

- `OperationEvidenceProviderLike` を追加し、function 形式と object 形式の provider を受けられるようにした。
- Provider input は `baselineSession`、`candidateSession`、`request`、`result`、`targetIds`、`lifecycle` を持つ。
- Provider result は既存 `OperationResultSchema` の evidence fields に限定し、contracts 変更なしで `runtimeDiff`、`validationDiff`、runtime snapshot / state / sequence refs、final runtime state、validation report IDs を統合できるようにした。
- `dryRunOperation` は handler が作る dry-run clone を `candidateSession` として provider に渡す。original session は mutate されない。
- `commitOperation` は provider がある場合だけ commit 前 session を clone し、commit 後 session を candidate として provider に渡す。
- Provider がない場合は既存 Wave3 behavior のまま、追加 clone や evidence merge は行わない。
- Unsupported operation、invalid request、base revision mismatch、duplicate parameter など rejected result では provider を呼ばない。
- Commit の log entry は evidence merge 後の result を保持し、`runtimeSnapshotIds` / `validationReportIds` も result の generated refs から反映される。
- Package revision update は実装していない。既存 Wave3 tests が `basePackageRevision: 0` のまま duplicate precondition を確認しているため、互換性を優先した。

## Verification Performed

- `pnpm.cmd typecheck`
  - pass。
- `pnpm.cmd exec vitest run packages/operation-core/src/operation-evidence.test.ts packages/operation-core/src/operation-lifecycle.test.ts packages/operation-core/src/dependency-boundary.test.ts`
  - 初回は sandbox EPERM で `vitest.mjs` を open できず fail。
  - 権限付き再実行で pass。3 files / 8 tests pass。
- `pnpm.cmd exec vitest run packages/operation-core/src`
  - 権限付きで pass。5 files / 15 tests pass。
- `pnpm.cmd check:source`
  - pass。`Source organization guard passed.`
- `pnpm.cmd check:deps`
  - pass。`Dependency guard passed.`
- Forbidden import search:
  - `rg -n '@private-2d-rigging-lab/(runtime-core|validator-core)|editor-ui|ai-interface|renderer-adapter|transport|WebSocket|MCP|HTTP' packages/operation-core/src -g '*.ts' -g '!*.test.ts`
  - match なし。
- Barrel-only check:
  - `rg -n '^\s*(import|export)\b|function|class|const|let|var|=>' packages/operation-core/src/index.ts`
  - export statements のみ。
- `git diff --check -- packages/operation-core/src packages/operation-core/package.json discussion/implementation/waves/wave4/wave4-operation-evidence-hook-foundation-completion.md`
  - pass。CRLF warning のみ。

## Remaining Issues

- Blocking: なし。
- Non-blocking: package revision increment semantics は未実装。Wave4 plan では ambiguous な場合 user decision point とされており、今回は Wave3 互換維持のため変更していない。
- Non-blocking: provider 実装自体は後続 Domain E / integration fixture で authoring adapter、runtime evidence helper、validator evidence helper を接続して確認する必要がある。

## User-Decision Points

- 現時点ではなし。
- 将来 commit 時に `packageRevision` を必ず increment するなら、duplicate / subsequent operation request の `basePackageRevision` 期待値と fixture 更新を含む明示判断が必要。

## Provisional Assumptions

- Provider は同期的に evidence DTO を返す。filesystem artifact writing や async persistence は Domain D の対象外。
- Provider が返した evidence は operation result の evidence fields に merge し、重複 ID / ref は一意化する。
- Provider がある場合の commit baseline は `cloneAuthoringSession(session)` による commit 直前 snapshot で十分。
- `operation-core` production source は runtime-core / validator-core を直接 import せず、provider 境界で structural DTO のみ扱う。
- `index.ts` は barrel export のみとし、provider invocation logic は `lifecycle/evidence.ts` に分離する。

## Coordinated Authoring-Core Edits

- なし。
