# Wave 3 Domain B Completion: operation contract DTO foundation

> Domain: `wave3-operation-contract-dto-foundation`  
> Date: 2026-05-29  
> Verdict: pass

## Basis Used

- `discussion/implementation/orchestration/wave3-plan.md`
- `discussion/implementation/waves/wave2/wave2-final-report.md`
- `discussion/design/module-contracts/operation-contracts.md`
- `discussion/design/module-contracts/module-boundaries.md`
- `discussion/design/module-contracts/typescript-contracts.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `packages/contracts/src/index.ts`

## Changed Files

- `packages/operation-core/package.json`
- `packages/operation-core/src/index.ts`
- `packages/operation-core/src/operation-type.ts`
- `packages/operation-core/src/operation-payload.ts`
- `packages/operation-core/src/operation-precondition.ts`
- `packages/operation-core/src/operation-request.ts`
- `packages/operation-core/src/operation-result.ts`
- `packages/operation-core/src/operation-log-entry.ts`
- `packages/operation-core/src/payloads/import-source.ts`
- `packages/operation-core/src/payloads/model-edit.ts`
- `packages/operation-core/src/payloads/dynamics.ts`
- `packages/operation-core/src/payloads/rig-control.ts`
- `packages/operation-core/src/operation-schemas.test.ts`
- `packages/operation-core/src/dependency-boundary.test.ts`
- `discussion/implementation/waves/wave3/wave3-operation-contract-dto-foundation-completion.md`

## Implementation Summary

- `operation-core` に operation catalog、payload schema family、operation payload discriminated union、request/result/log/precondition DTO schema を追加した。
- Payload は import source、model edit、dynamics、rig control の責務別ファイルへ分割した。
- `index.ts` は public barrel export のみにした。
- 実行 lifecycle、dry-run/commit 実装、operation registry executor、`authoring-core` import は追加していない。
- `operation-core` の direct dependencies として `@private-2d-rigging-lab/contracts` と `zod` を追加した。

## Verification Performed

- `pnpm exec vitest run packages/operation-core/src`
  - 初回 sandbox 実行は `EPERM` で `vitest.mjs` open に失敗。
  - 外部権限で再実行後、依存 symlink 未更新により `zod` 解決に失敗。
  - `pnpm install --no-lockfile --offline` で `pnpm-lock.yaml` を読まず書かずに symlink を更新。
  - 再実行結果: pass, 2 files / 6 tests.
- `pnpm typecheck`: pass.
- `pnpm run check:source`: pass.
- `pnpm run check:deps`: pass.
- `git diff --check -- packages/operation-core discussion/implementation/waves/wave3`: pass. CRLF warning only.
- Boundary search:
  - `rg "@private-2d-rigging-lab/(authoring-core|editor-ui|ai-interface|renderer-adapter|runtime-core|validator-core)" packages/operation-core/src`
  - no matches.

## Test Coverage Added

- Representative payload parse:
  - `importSplitPngSourceAsset`
  - `createParameter`
  - `createDynamicsGroup`
  - `createRotation2dRigControl`
- `OperationRequestSchema` preserves `dryRun=true`.
- `OperationResultSchema` and `OperationLogEntrySchema` parse required fields and defaults.
- Invalid operation type fails.
- Invalid `OperationId` and invalid `ParameterId` prefixes fail.
- `index.ts` is barrel-only.
- DTO domain has no forbidden sibling/downstream implementation imports.

## Remaining Issues

- Blocking: none.
- Non-blocking:
  - `operation-payload.ts` is intentionally a cohesive composition file for the operation payload discriminated union. If the catalog expands materially, it should split into smaller composition files by operation family.
  - Log entry schema does not enforce equality between top-level `operationType` and nested `payload.operationType`; this mirrors the current contract sketch and can be tightened later if desired.

## User-Decision Points

- None for this domain.

## Provisional Assumptions

- `parameterId` is allowed as an optional client-supplied field in `CreateParameterPayloadSchema` so DTO tests and later lifecycle work can validate ID prefix and uniqueness preconditions at the operation boundary.
- Runtime preview sequence payloads may reference runtime state DTO/ref schemas from `contracts`, but this domain does not implement runtime evaluation.
- `pnpm-lock.yaml` and dependency registry updates remain outside this domain's write scope; no changes were made to either file.
