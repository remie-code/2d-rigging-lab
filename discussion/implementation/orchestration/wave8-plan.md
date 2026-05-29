# Wave 8 Plan: AI interface dry-run command foundation

> Status: Completed / implementation-proven
> Created: 2026-05-29
> Coordinator: Undine
> Execution unit: Wave 8 only

## 1. 上流ゲート

Wave 7 は完了済み。

- Basis: [../waves/wave7/wave7-final-report.md](../waves/wave7/wave7-final-report.md)
- Wave 7 で成立したこと:
  - root/core package の DOM-free typecheck と editor app の DOM-aware typecheck 分離。
  - operation log hydration。
  - browser-local project persistence。
  - editor workflow の save / load / reset。
  - Project Storage UI。
  - `pnpm run test:e2e:editor` による desktop / mobile の commit / save / load / reset smoke。

Wave 7 の残課題:

- AI assistant がまだ構造化 command として editor workflow / operation-core を呼べない。
- AI dry-run / approval / commit 境界が package として存在しない。
- AI command transcript / provenance / approval evidence がまだ fixture 化されていない。
- `apps/editor` には人間向け操作 UI はあるが、AI observe / dry-run 用の in-process host がない。

## 2. Wave Objective

Wave 8 の目的は、AI assistant が GUI workflow を置き換えず、構造化された in-process command bus 経由で editor state を観測し、operation を dry-run し、承認済みの場合だけ commit できる最小境界を作ること。

この wave では transport 非依存の `ai-interface` package を作り、最初の実装対象を `getEditorState` / `dryRunOperation` / `commitOperation` / `getOperationLog` に絞る。

HTTP / WebSocket / MCP、LLM provider、prompt format、repair candidate ranking、AI用の本格UIは扱わない。

## 3. Repository Facts

- `packages/operation-core` は `dryRunOperation` と `commitOperation` を持つ。
- operation dry-run は original authoring session を mutate しない。
- commit は operation log entry を append し、package revision を進める。
- Wave 7 で operation log hydration と persisted editor workflow が成立した。
- `apps/editor/src/editor-workflow` は commit/save/load/reset を持つが、AI command host はまだない。
- `apps/editor/src/editor-session/create-parameter-command.ts` は現在 human/gui commit request を作る専用 helper である。
- `packages/ai-interface` はまだ存在しない。

## 4. Wave Design Decisions

### DEC-W8-001: 最初の AI interface は in-process command bus にする

Wave 8 では HTTP / WebSocket / MCP adapter を作らない。

理由:

- 意味論の正は command DTO と operation-core 境界であり、endpoint ではない。
- editor workflow と同一 process で dry-run / approval / commit を検証できる。
- external agent authorization や network transport を先に入れると、未確定の権限・承認境界が広がる。

### DEC-W8-002: AI は operation-core を bypass しない

AI command は package DTO や authoring graph を直接 mutate してはならない。

Wave 8 の mutating command は `commitOperation` のみで、次を満たす必要がある。

- 先行する `dryRunOperation` がある。
- command session に `commitWithApproval` capability がある。
- approval token または approved dry-run command ID が一致する。
- commit request は `dryRun: false` である。

### DEC-W8-003: Wave 8 の command catalog は最小縦切りに限定する

Wave 8 で実装する command:

- `getEditorState`
- `dryRunOperation`
- `commitOperation`
- `getOperationLog`

Wave 8 で schema だけ置いてもよいが、本格実装しない command:

- `getSelection`
- `getCanvasViewport`
- `hitTestCanvas`
- `inspectModel`
- `inspectTarget`
- `getRuntimeSnapshot`
- `runDynamicsPreviewSequence`
- `validatePackage`
- `createRepairCandidate`
- `getDiff`
- `rerunValidation`

理由:

- 現在の editor vertical slice は `createParameter` が中心で、canvas / hit-test / target inspection の実装面がまだ薄い。
- まず AI dry-run が直接 mutation しないことと、承認境界を検証する方が依存順として重要。

### DEC-W8-004: AI transcript は evidence として残す

AI command は自然文会話ログではなく、command request / response / approval / operation log refs を構造化 transcript として保存できる形にする。

Wave 8 では最小 fixture と test で次を確認する。

- `getEditorState` で package revision を観測する。
- `dryRunOperation` は model diff を返し、operation log を増やさない。
- approval なし commit は拒否される。
- approval あり commit は operation log を増やす。
- transcript が command ID、agent ID、capability、basis、operation ID を追跡できる。

### DEC-W8-005: editor integration は test-facing in-process host に留める

Wave 8 では AI用の visible UI tab や `window` global debug API は作らない。

`apps/editor` 側には in-process host / adapter を置き、unit / integration test で editor workflow に接続する。ブラウザ e2e は Wave 7 の smoke を維持し、AI command e2e は必要になった時点で別 wave へ分ける。

## 5. Non-goals

- HTTP JSON adapter。
- WebSocket adapter。
- MCP server。
- external AI agent authentication / authorization。
- LLM provider integration。
- prompt template / prompt storage policy の確定。
- natural language repair suggestion generation。
- repair candidate ranking。
- AI Report tab / approval UI。
- canvas hit-test implementation。
- screenshot-based target selection。
- broader operation catalog。
- filesystem / archive export。
- React / JSX 導入。

## 6. Required Basis Documents

Undine はこの plan と Wave 7 final report を root context の中心に置く。詳細規約は domain ごとに渡す。

共通 basis:

- `.agents/skills/implementation-orchestration/SKILL.md`
- [wave8-plan.md](wave8-plan.md)
- [../../development_convention/source-file-organization-policy.md](../../development_convention/source-file-organization-policy.md)
- [../../design/module-contracts/module-boundaries.md](../../design/module-contracts/module-boundaries.md)
- [../../design/module-contracts/ai-command-contract.md](../../design/module-contracts/ai-command-contract.md)
- [../../design/module-contracts/operation-contracts.md](../../design/module-contracts/operation-contracts.md)
- [../waves/wave7/wave7-final-report.md](../waves/wave7/wave7-final-report.md)

Domain-specific basis:

- editor integration:
  - [../../design/module-contracts/gui-operation-contract.md](../../design/module-contracts/gui-operation-contract.md)
- MVP AI requirement:
  - [../../acceptance-criteria/03_MVP_Acceptance_Criteria.md](../../acceptance-criteria/03_MVP_Acceptance_Criteria.md)
  - [../../scenarios/02_DomainAcceptanceCriteria/213_AI-native_Operation.md](../../scenarios/02_DomainAcceptanceCriteria/213_AI-native_Operation.md)
  - [../../scenarios/02_DomainAcceptanceCriteria/222_Open_AI_Agent_Interface.md](../../scenarios/02_DomainAcceptanceCriteria/222_Open_AI_Agent_Interface.md)

## 7. Domain Plan

### Domain A: `wave8-ai-interface-package-scaffold`

目的:

`packages/ai-interface` を作成し、依存境界と source organization guard を先に固定する。

Allowed write scope:

- `packages/ai-interface/package.json`
- `packages/ai-interface/src/index.ts`
- `packages/ai-interface/src/package-info.ts`
- `packages/ai-interface/src/dependency-boundary.test.ts`
- `pnpm-lock.yaml` only if `pnpm install` updates workspace importers

Forbidden write scope:

- `apps/**`
- `packages/operation-core/**`
- `packages/runtime-core/**`
- `packages/validator-core/**`
- `packages/package-format/**`
- `fixtures/**`
- root scripts unless required and reported

Expected output:

- package name: `@private-2d-rigging-lab/ai-interface`。
- `exports` は `./src/index.ts`。
- allowed dependencies は `contracts` / `operation-core` / `runtime-core` / `validator-core` / `zod` を基本とする。
- production source は editor app、DOM、transport、filesystem、package-format を import しない。
- `index.ts` は barrel-only。

Required tests / verification:

- dependency-boundary test。
- `pnpm typecheck`
- `pnpm exec vitest run packages/ai-interface/src`
- `pnpm check:source`

Early escape:

- package dependency direction conflicts with module-boundaries。
- package creation requires dependency not already allowed by project policy。

Parallelism:

- Batch 1。最初に実行する。

### Domain B: `wave8-ai-command-schema-foundation`

目的:

AI command request / response / command name / capability / minimal payload schemas を実装する。

Allowed write scope:

- `packages/ai-interface/src/ai-capability.ts`
- `packages/ai-interface/src/ai-command-name.ts`
- `packages/ai-interface/src/ai-command-request.ts`
- `packages/ai-interface/src/ai-command-response.ts`
- `packages/ai-interface/src/ai-command-payload.ts`
- `packages/ai-interface/src/ai-command-response-payload.ts`
- `packages/ai-interface/src/ai-command-schema.test.ts`
- `packages/ai-interface/src/index.ts`

Forbidden write scope:

- `apps/**`
- `packages/operation-core/**`
- `packages/runtime-core/**`
- `packages/validator-core/**`
- `fixtures/**`
- transport adapters

Expected output:

- `AiCapabilitySchema`。
- `AiCommandNameSchema`。
- `AiCommandRequestSchema` with `schemaVersion`, `commandId`, `session`, `basis`。
- `AiCommandResponseSchema` with `status`, diagnostics, diff fields, evidence refs。
- 実装対象 command の payload:
  - `getEditorState`
  - `dryRunOperation`
  - `commitOperation`
  - `getOperationLog`
- 未実装 command は command name enum に含めるか、明示的に later として分離する。どちらを選んでも test で意図を固定する。

Required tests:

- valid request / response parse。
- `dryRunOperation` は `OperationRequestSchema` かつ `dryRun: true` でないと拒否。
- `commitOperation` は `dryRun: false` でないと拒否。
- invalid capability / command name rejection。
- `index.ts` remains barrel-only。

Required verification:

- `pnpm exec vitest run packages/ai-interface/src`
- `pnpm typecheck`
- `pnpm check:source`

Early escape:

- `ai-command-contract.md` と現行 `operation-core` schema が矛盾している。
- minimal command subset の切り方が user decision を要する。

Parallelism:

- Batch 2。Domain A の後に実行する。

### Domain C: `wave8-ai-operation-dry-run-approval-executor`

目的:

`dryRunOperation` と approval-gated `commitOperation` を実行する transport-independent executor を作る。

Allowed write scope:

- `packages/ai-interface/src/ai-command-executor.ts`
- `packages/ai-interface/src/ai-command-host.ts`
- `packages/ai-interface/src/ai-approval-policy.ts`
- `packages/ai-interface/src/ai-command-transcript.ts`
- `packages/ai-interface/src/ai-operation-command.test.ts`

Forbidden write scope:

- `apps/**`
- `packages/operation-core/**`
- `packages/runtime-core/**`
- `packages/validator-core/**`
- `fixtures/**`
- `packages/ai-interface/src/index.ts` unless assigned by integrator

Expected output:

- host interface:
  - `dryRunOperation(request)`
  - `commitOperation(request)`
  - `getOperationLog(filter)`
- executor:
  - validates request schema。
  - checks session capabilities。
  - rejects commit without approval。
  - records transcript entries。
  - returns `permission_denied`, `needs_approval`, `rejected`, or `ok` consistently。
- approval policy:
  - in-memory approval registry or equivalent minimal policy。
  - approval is linked to prior dry-run command ID and operation ID。

Required tests:

- read/dry-run capability can dry-run but cannot commit。
- commit without `commitWithApproval` capability is denied。
- commit with capability but no approval is `needs_approval` or rejected according to chosen policy。
- approved commit calls host exactly once。
- dry-run does not append operation log in fake host。
- transcript captures command ID, agent ID, status, and evidence refs.

Required verification:

- `pnpm exec vitest run packages/ai-interface/src`
- `pnpm typecheck`
- `pnpm check:source`

Early escape:

- approval semantics require visible UI decision before testable in-process policy can be written。
- operation result cannot be associated with dry-run command ID.

Parallelism:

- Batch 3。Domain D と並列可能。Domain B の後に実行する。

### Domain D: `wave8-ai-read-command-host-contract`

目的:

AI observe/read 系の最小 host contract を作り、`getEditorState` と `getOperationLog` を executor から呼べるようにする。

Allowed write scope:

- `packages/ai-interface/src/ai-read-command.ts`
- `packages/ai-interface/src/ai-editor-state.ts`
- `packages/ai-interface/src/ai-operation-log-query.ts`
- `packages/ai-interface/src/ai-read-command.test.ts`

Forbidden write scope:

- `apps/**`
- `packages/operation-core/**`
- `packages/runtime-core/**`
- `packages/validator-core/**`
- `fixtures/**`
- `packages/ai-interface/src/index.ts` unless assigned by integrator

Expected output:

- `getEditorState` host contract。
- `getOperationLog` query / filter contract。
- response payload は editor-specific DTO を package 内で再定義せず、schemaVersion passthrough または explicit minimal shape に留める。
- read commands never mutate host state。

Required tests:

- `getEditorState` returns current package revision / schema version through fake host。
- `getOperationLog` filters by operation ID or returns entries。
- missing capability is permission denied。
- read command cannot call operation mutation host methods。

Required verification:

- `pnpm exec vitest run packages/ai-interface/src`
- `pnpm typecheck`
- `pnpm check:source`

Early escape:

- current editor semantic state shape is insufficient even for minimal AI observe。
- read DTO ownership would force `ai-interface` to import `apps/editor`。

Parallelism:

- Batch 3。Domain C と並列可能。Domain B の後に実行する。

### Domain E: `wave8-editor-ai-command-host-integration`

目的:

`apps/editor` に test-facing in-process AI command host を接続し、current editor workflow 上で AI dry-run / approved commit を検証する。

Allowed write scope:

- `apps/editor/src/ai-command-host/**`
- `apps/editor/src/editor-session/**` only for exposing dry-run / generic operation request support
- `apps/editor/src/editor-workflow/**` only for exposing AI host state/actions
- `apps/editor/src/app/**` only if composition needs non-UI wiring
- `apps/editor/src/editor-state/**` only if minimal AI observable state field is required
- `apps/editor/package.json` only to add the `@private-2d-rigging-lab/ai-interface` workspace dependency
- `pnpm-lock.yaml` only if workspace importer metadata changes

Forbidden write scope:

- `packages/ai-interface/src` except imports from public API after Domains C/D
- `packages/operation-core/**`
- `packages/runtime-core/**`
- `packages/validator-core/**`
- UI panels / CSS unless a tiny test ID exposure is absolutely required and reported
- browser `window` global debug API

Expected output:

- editor workflow can provide an AI command host without visible UI。
- AI `dryRunOperation` with `createParameter` returns operation result and does not mutate editor state / operation log。
- approved AI `commitOperation` mutates through operation-core and appends operation log。
- AI actor / surface are distinguishable from human/gui where existing schemas allow it。
- persisted save/load after AI commit still works or is explicitly covered by existing workflow snapshot path。

Required tests:

- `getEditorState -> dryRunOperation` leaves parameter count and operation log unchanged。
- approval-less commit is denied。
- approved commit appends operation log and increments package revision。
- save/load after approved AI commit preserves AI operation log entry。

Required verification:

- `pnpm exec vitest run apps/editor/src/ai-command-host apps/editor/src/editor-session apps/editor/src/editor-workflow`
- `pnpm --filter @private-2d-rigging-lab/editor typecheck`
- `pnpm check:source`

Early escape:

- editor-session cannot expose dry-run without broad rewrite。
- operation actor/surface schema cannot represent AI-originated editor command cleanly。
- AI host would require visible approval UI to be correct。

Parallelism:

- Batch 4。Domains C / D の完了後に実行する。

### Domain F: `wave8-ai-command-fixture-and-regression`

目的:

AI dry-run / approval / commit の最小 fixture と regression tests を作り、Wave 8 の acceptance oracle を固定する。

Allowed write scope:

- `fixtures/contracts/ai-dry-run-command-foundation/**`
- `packages/ai-interface/src/**` test files only
- `apps/editor/src/**` test files only
- `discussion/tests/traceability/**` only if updating existing traceability is required and reported

Forbidden write scope:

- production source outside test-only fixes。
- HTTP / WebSocket / MCP adapter。
- prompt templates。
- generated binary assets。

Expected output:

- AI command transcript fixture:
  - `getEditorState`
  - `dryRunOperation`
  - rejected or needs-approval commit attempt
  - approved commit
  - `getOperationLog`
- expected summary:
  - dry-run no mutation。
  - approved commit mutation。
  - operation log records AI actor/surface/provenance boundary。
- tests load fixture and compare expected summary。

Required verification:

- `pnpm exec vitest run packages/ai-interface/src apps/editor/src/ai-command-host`
- `pnpm check:deps`
- `pnpm check:source`

Early escape:

- operation log schema cannot distinguish AI-assisted action from human GUI action without changing operation-core contract。
- fixture would require rights/provenance material not present in the repository。

Parallelism:

- Batch 5。Domain E の後に実行する。

### Domain G: `wave8-integration-review-and-final-report`

目的:

Wave 8 全体を統合し、clean review、verification、永続レポートを作成する。

Allowed write scope:

- `discussion/implementation/waves/wave8/**`
- `discussion/implementation/reviews/wave8/**`
- `discussion/implementation/_map.md`
- `discussion/implementation/orchestration/_map.md`
- `discussion/_map.md`
- minimal source/test fixes only if needed to resolve integration findings

Expected output:

- domain completion reports。
- Review-Sylph reports。
- integration review。
- final report。
- next wave recommendation。

Required verification:

- `pnpm install` if workspace manifest / lockfile changed。
- `pnpm exec vitest run packages/ai-interface/src`
- `pnpm exec vitest run apps/editor/src/ai-command-host apps/editor/src/editor-session apps/editor/src/editor-workflow`
- `pnpm typecheck`
- `pnpm check:deps`
- `pnpm check:source`
- `pnpm check`
- `git diff --check -- . ':!pnpm-lock.yaml'`

Parallelism:

- 最後に実行する。

## 8. Launch Order

```text
Batch 1
  A ai-interface package scaffold

Batch 2
  B ai command schema foundation

Batch 3
  C ai operation dry-run approval executor
  D ai read command host contract

Batch 4
  E editor ai command host integration

Batch 5
  F ai command fixture and regression

Batch 6
  G integration review and final report
```

Batch 3 は並列投入可能。A/B は package / schema の前提を作るため逐次。E は C/D の両方に依存する。F は editor integration の後に fixture oracle を固定する。

## 9. Wave Pass Criteria

Wave 8 passes only if all are true:

- `packages/ai-interface` exists and passes dependency/source organization guards.
- AI command request / response schemas parse valid minimal commands and reject invalid dry-run / commit payloads.
- `dryRunOperation` through AI executor does not mutate host state or append operation log.
- `commitOperation` is denied without `commitWithApproval` capability and matching approval.
- approved AI commit routes through operation-core and appends operation log.
- `getEditorState` and `getOperationLog` work through in-process host.
- editor workflow can expose test-facing AI command host without visible UI or transport adapter.
- AI command transcript fixture proves dry-run / approval / commit / operation log sequence.
- `pnpm check` passes.
- source organization guard passes.
- integration review and final report are written.

## 10. User Decision Points

No user decision is required before starting under this plan.

Assumptions:

- In-process command bus is acceptable as the first AI interface implementation.
- Visible AI approval UI can wait for a later wave.
- HTTP / WebSocket / MCP can wait until command semantics are implementation-proven.
- The first AI operation can reuse `createParameter` rather than adding a new operation catalog entry.

If any assumption is rejected, revise this plan before launching implementation.
