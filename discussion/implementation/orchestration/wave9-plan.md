# Wave 9 Plan: AI command approval UI and transcript persistence

> Status: Completed / implementation-proven
> Created: 2026-05-29
> Coordinator: Undine
> Execution unit: Wave 9 only

## 1. 上流ゲート

Wave 8 は完了済み。

- Basis: [../waves/wave8/wave8-final-report.md](../waves/wave8/wave8-final-report.md)
- Wave 8 で成立したこと:
  - `packages/ai-interface` の transport-independent command schema。
  - `getEditorState` / `dryRunOperation` / `commitOperation` / `getOperationLog`。
  - dry-run command ID、agent ID、operation ID に紐づく approval policy。
  - editor workflow への test-facing in-process AI command host。
  - command / approval event を含む structured transcript。
  - AI command fixture による observe -> dry-run -> approval -> commit -> operation log の acceptance oracle。

Wave 8 の残課題:

- approval は in-process test-facing policy であり、visible UI がない。
- transcript は fixture-proven だが、project persistence に保存されない。
- operation log と transcript の対応が UI 上で見えない。
- AI approval / commit flow は unit/integration test 中心で、browser UI smoke に入っていない。

## 2. Wave Objective

Wave 9 の目的は、Wave 8 の command semantics を変えずに、editor 上で AI dry-run を確認し、承認または却下し、承認済み commit を実行できる visible approval workflow を作ること。

あわせて AI command transcript を browser-local project persistence に保存し、load 後も transcript と operation log の対応を確認できるようにする。

## 3. Repository Facts

- `apps/editor` は Vite + vanilla TypeScript の DOM app である。
- editor UI は `createEditorAppShell` で組み立てられ、panel は `apps/editor/src/ui/**` に分かれている。
- project persistence は `apps/editor/src/project-persistence` が browser storage DTO/store を所有している。
- `EditorWorkflowController` は save / load / reset / commitCreateParameter と `aiCommandHost` を持つ。
- `aiCommandHost.transcript.entries` は read / dry-run / approval / commit / rejected provenance command を記録できる。
- e2e smoke は dependency-free CDP harness で desktop / mobile を検査する。

## 4. Wave Design Decisions

### DEC-W9-001: Wave 9 は visible approval workflow に集中する

Wave 9 は HTTP / WebSocket / MCP transport を作らない。

理由:

- Wave 8 で command semantics が成立した直後であり、次に必要なのは人間が承認境界を確認できる UI である。
- transport を先に入れると、approval UI なしで外部 caller が commit path を扱うことになり、責務が広がる。
- AI approval の UI / persistence oracle が成立してから transport を wrap する方が安全。

### DEC-W9-002: Transcript は operation log とは別の project evidence として保存する

AI transcript は operation log を置き換えない。

- operation log: committed operation の durable ledger。
- AI transcript: command request / response / approval event の audit trail。

project persistence では両方を保存し、UI では operation ID / evidence refs を通じて対応を見せる。

### DEC-W9-003: UI は deterministic fixture command を発行する

Wave 9 の AI approval UI は LLM provider や prompt template を使わない。

UI は現在の vertical slice に合わせ、最初の AI dry-run 操作を deterministic な `createParameter` command に限定する。自然言語入力、repair candidate ranking、target inspection は扱わない。

### DEC-W9-004: Save / load / reset は transcript lifecycle を明示する

- save: current transcript を persisted project に含める。
- load: persisted transcript を workflow / AI host に復元する。
- reset: sample package と同時に transcript / approval state を初期化する。

古い保存データに transcript がない場合は空 transcript として扱い、既存 browser-local project を不必要に破壊しない。

### DEC-W9-005: UI source は panel 単位で分割する

`app-shell.ts` や `index.ts` に approval / transcript logic を集中させない。

- approval UI は `ui/ai-approval/**`。
- transcript UI は `ui/ai-transcript/**`。
- workflow state projection は `editor-state/**` または `editor-workflow/**` の named files。
- `index.ts` は re-export のみ。

## 5. Non-goals

- HTTP JSON adapter。
- WebSocket adapter。
- MCP server。
- external AI agent authentication / authorization。
- LLM provider integration。
- prompt template / prompt storage。
- natural language repair suggestion generation。
- repair candidate ranking。
- canvas hit-test / screenshot target selection。
- broader operation catalog。
- multi-user approval。
- filesystem / archive export。
- React / JSX 導入。

## 6. Domains

### Domain A: `wave9-ai-transcript-document-contract`

目的:

`ai-interface` 側で transcript document の parse / serialize / hydrate helper を固め、project persistence や editor workflow が structured transcript を安全に保存・復元できるようにする。

Dependencies:

- Wave 8 `packages/ai-interface` transcript schema。

Allowed write scope:

- `packages/ai-interface/src/ai-command-transcript.ts`
- `packages/ai-interface/src/ai-command-transcript.test.ts`
- `packages/ai-interface/src/index.ts`

Forbidden write scope:

- `apps/**`
- `packages/operation-core/**`
- `packages/runtime-core/**`
- `packages/validator-core/**`
- `fixtures/**`
- transport adapters

Expected output:

- `AiCommandTranscriptDocumentSchema` or equivalent public parse helper。
- helper to create an empty transcript document。
- helper or constructor to hydrate `InMemoryAiCommandTranscript` from validated entries。
- tests for:
  - empty transcript document。
  - command + approval event round-trip。
  - invalid event rejection。
  - hydrated in-memory transcript append preserves existing entries。

Required verification:

- `pnpm exec vitest run packages/ai-interface/src`
- `pnpm typecheck`
- `pnpm check:source`

Early escape:

- current transcript schema cannot represent persisted approval event without breaking Wave 8 fixture。

Parallelism:

- Batch 1。最初に実行する。

### Domain B: `wave9-editor-project-transcript-persistence`

目的:

browser-local persisted editor project に AI transcript document を保存・復元できる contract を追加する。

Dependencies:

- Domain A。

Allowed write scope:

- `apps/editor/src/project-persistence/**`

Forbidden write scope:

- `apps/editor/src/editor-workflow/**`
- `apps/editor/src/ui/**`
- `apps/editor/src/app/**`
- `packages/**` except imports from public APIs
- e2e scripts

Expected output:

- `PersistedEditorProjectDto` に `aiCommandTranscript` or equivalent field。
- old stored project without transcript loads as empty transcript。
- save input accepts transcript document。
- validation rejects malformed transcript。
- browser project store tests cover save/load with transcript and legacy missing-transcript fallback。

Required verification:

- `pnpm exec vitest run apps/editor/src/project-persistence`
- `pnpm --filter @private-2d-rigging-lab/editor typecheck`
- `pnpm check:source`

Early escape:

- adding transcript persistence forces a schemaVersion break that cannot be migrated locally。

Parallelism:

- Batch 2。Domain C と並列可能。ただし Domain B は `project-persistence/**` のみを編集する。

### Domain C: `wave9-ai-approval-workflow-state`

目的:

editor workflow に visible UI 用の AI approval state と actions を追加する。ここでは UI rendering を作らず、workflow / state / view model のみを実装する。

Dependencies:

- Domain A。

Allowed write scope:

- `apps/editor/src/ai-command-host/**`
- `apps/editor/src/editor-workflow/**`
- `apps/editor/src/editor-state/**`
- `apps/editor/src/editor-session/**` only if deterministic AI operation request helper needs session-owned data

Forbidden write scope:

- `apps/editor/src/ui/**`
- `apps/editor/src/app/**`
- `apps/editor/index.html`
- `apps/editor/e2e/**`
- `packages/**` except imports from public APIs
- `apps/editor/src/project-persistence/**`

Expected output:

- workflow actions:
  - dry-run deterministic AI `createParameter` command。
  - approve latest dry-run。
  - reject / clear pending dry-run。
  - commit approved AI operation。
- workflow state / view model:
  - pending approval status。
  - latest AI dry-run operation ID and result summary。
  - whether approve / commit / reject actions are enabled。
  - transcript summary entries for UI。
- approval state resets on load/reset unless restored from persisted transcript in later integration。
- tests cover:
  - dry-run creates pending approval and does not mutate parameter list / operation log。
  - reject clears pending approval without mutation。
  - approve + commit mutates through operation-core。
  - stale approval cannot survive reset。
  - transcript summary contains command and approval events。

Required verification:

- `pnpm exec vitest run apps/editor/src/editor-workflow apps/editor/src/editor-state apps/editor/src/ai-command-host`
- `pnpm --filter @private-2d-rigging-lab/editor typecheck`
- `pnpm check:source`

Early escape:

- current workflow cannot produce deterministic AI operation request without broad operation catalog changes。
- approval state cannot be represented without bypassing `aiCommandHost.approvalPolicy`。

Parallelism:

- Batch 2。Domain B と並列可能。Domain C は `project-persistence/**` を編集しない。

### Domain D: `wave9-ai-approval-panel-component`

目的:

AI dry-run result を見て approve / reject / commit できる visible panel component を作る。

Dependencies:

- Domain C。

Allowed write scope:

- `apps/editor/src/ui/ai-approval/**`
- `apps/editor/src/styles/ai-approval.css`
- component-local tests if present under `apps/editor/src/ui/ai-approval/**`

Forbidden write scope:

- `apps/editor/src/app/**`
- `apps/editor/src/ui/app-shell/**`
- `apps/editor/index.html`
- `apps/editor/src/editor-workflow/**`
- `apps/editor/src/project-persistence/**`
- e2e scripts

Expected output:

- AI approval panel component with:
  - dry-run trigger button。
  - dry-run result / model diff summary。
  - approve button。
  - reject / clear button。
  - commit approved operation button。
  - disabled states for invalid transitions。
- no operation-core bypass; panel uses callbacks only。
- stable dimensions and no text overflow on mobile-sized layout。
- `index.ts` is barrel-only。

Required verification:

- `pnpm --filter @private-2d-rigging-lab/editor typecheck`
- `pnpm check:source`

Early escape:

- workflow view model from Domain C lacks enough state to render approval safely。

Parallelism:

- Batch 3。Domain E と並列可能。Domain D は app shell integration を行わない。

### Domain E: `wave9-ai-transcript-panel-component`

目的:

AI command transcript を UI 上で確認できる read-only panel component を作る。

Dependencies:

- Domain C。

Allowed write scope:

- `apps/editor/src/ui/ai-transcript/**`
- `apps/editor/src/styles/ai-transcript.css`
- component-local tests if present under `apps/editor/src/ui/ai-transcript/**`

Forbidden write scope:

- `apps/editor/src/app/**`
- `apps/editor/src/ui/app-shell/**`
- `apps/editor/index.html`
- `apps/editor/src/editor-workflow/**`
- `apps/editor/src/project-persistence/**`
- e2e scripts

Expected output:

- transcript panel component with:
  - command / approval event rows。
  - status / operation ID / evidence count。
  - operation log cross-link text by operation ID where present。
  - empty state。
- no mutation controls。
- stable responsive layout。
- `index.ts` is barrel-only。

Required verification:

- `pnpm --filter @private-2d-rigging-lab/editor typecheck`
- `pnpm check:source`

Early escape:

- transcript summary from Domain C lacks command / approval distinction or operation ID。

Parallelism:

- Batch 3。Domain D と並列可能。Domain E は app shell integration を行わない。

### Domain F: `wave9-editor-ai-ui-persistence-integration`

目的:

approval panel / transcript panel を editor app shell に統合し、project save/load/reset と transcript lifecycle を接続する。

Dependencies:

- Domain B。
- Domain C。
- Domain D。
- Domain E。

Allowed write scope:

- `apps/editor/src/app/**`
- `apps/editor/src/ui/app-shell/**`
- `apps/editor/index.html`
- `apps/editor/src/editor-workflow/**` only for save/load transcript wiring
- `apps/editor/src/project-persistence/**` only for final type integration fixes
- `apps/editor/src/editor-state/**` only for test IDs / view-model integration fixes

Forbidden write scope:

- `packages/**`
- operation-core / ai-interface behavior changes
- transport adapters
- prompt templates

Expected output:

- app shell renders Project Storage, AI Approval, AI Transcript, and existing evidence panels coherently。
- save includes current AI transcript。
- load restores transcript and shows transcript panel entries。
- reset clears transcript / approval state and browser storage。
- tests cover workflow save/load transcript restoration and UI callback integration where practical。
- `apps/editor/index.html` includes any new CSS files if separate styles are used。

Required verification:

- `pnpm exec vitest run apps/editor/src/project-persistence apps/editor/src/editor-workflow apps/editor/src/ai-command-host`
- `pnpm --filter @private-2d-rigging-lab/editor typecheck`
- `pnpm check:source`

Early escape:

- persisted transcript restoration requires changing ai-interface contract beyond Domain A。
- app shell would need to become a giant responsibility sink instead of panel composition。

Parallelism:

- Batch 4。Domains B-E の完了後に実行する。

### Domain G: `wave9-ai-approval-ui-regression-and-e2e`

目的:

AI approval UI と transcript persistence を regression test / browser smoke で固定する。

Dependencies:

- Domain F。

Allowed write scope:

- `apps/editor/e2e/**`
- `scripts/editor-e2e-smoke.mjs` only if routing to new smoke checks is needed
- `apps/editor/src/**/*.test.ts`
- `fixtures/contracts/ai-approval-ui-transcript-persistence/**`

Forbidden write scope:

- production source except test-only selectors if explicitly reported。
- network transport。
- binary assets。
- prompt templates。

Expected output:

- e2e smoke covers desktop and mobile:
  - AI dry-run from UI。
  - dry-run does not create parameter or operation log entry。
  - approve + commit creates parameter and operation log entry。
  - save stores transcript in localStorage。
  - reload + load restores transcript panel entries。
  - reset clears project storage and visible transcript state。
- optional text JSON fixture summarizing expected transcript persistence。
- no horizontal overflow regression。

Required verification:

- `pnpm run test:e2e:editor`
- `pnpm exec vitest run apps/editor/src`
- `pnpm --filter @private-2d-rigging-lab/editor build`
- `pnpm check:source`

Early escape:

- local browser unavailable for e2e; record early escape with `pnpm --filter @private-2d-rigging-lab/editor build` and unit coverage instead。
- UI cannot expose deterministic AI dry-run without violating no-LLM / no-prompt boundary。

Parallelism:

- Batch 5。Domain F の後に実行する。

### Domain H: `wave9-integration-review-and-final-report`

目的:

Wave 9 全体を統合し、clean review、verification、永続レポートを作成する。

Dependencies:

- Domains A-G。

Allowed write scope:

- `discussion/implementation/waves/wave9/**`
- `discussion/implementation/reviews/wave9/**`
- `discussion/implementation/_map.md`
- `discussion/implementation/orchestration/_map.md`
- `discussion/_map.md`
- minimal source/test fixes only if needed to resolve integration findings

Expected output:

- domain completion reports。
- clean-context review report。
- integration review。
- final report。
- next wave recommendation。

Required verification:

- `pnpm install` if workspace manifest / lockfile changed。
- `pnpm exec vitest run packages/ai-interface/src`
- `pnpm exec vitest run apps/editor/src`
- `pnpm --filter @private-2d-rigging-lab/editor build`
- `pnpm run test:e2e:editor`
- `pnpm typecheck`
- `pnpm check:deps`
- `pnpm check:source`
- `pnpm check`
- `git diff --check -- . ':!pnpm-lock.yaml'`

Parallelism:

- 最後に実行する。

## 7. Launch Order

```text
Batch 1
  A ai transcript document contract

Batch 2
  B editor project transcript persistence
  C ai approval workflow state

Batch 3
  D ai approval panel component
  E ai transcript panel component

Batch 4
  F editor ai ui persistence integration

Batch 5
  G ai approval ui regression and e2e

Batch 6
  H integration review and final report
```

Batch 2 は Domain B が `project-persistence/**`、Domain C が workflow/state/ai-host を所有するため並列可能。Batch 3 は panel component を別ディレクトリに分け、app shell integration を Domain F に留保することで並列可能。

## 8. Wave Pass Criteria

Wave 9 passes only if all are true:

- editor UI exposes visible AI dry-run approval workflow。
- dry-run from UI does not mutate parameter list or operation log。
- approval + commit from UI routes through Wave 8 `aiCommandHost` / `operation-core`。
- reject / reset clears pending approval safely。
- AI transcript is saved in browser-local persisted project。
- load restores transcript panel entries without replaying commands。
- operation log and transcript can be correlated by operation ID。
- desktop and mobile e2e smoke covers AI approval / transcript persistence。
- `pnpm check` passes。
- source organization guard passes。
- integration review and final report are written。

## 9. User Decision Points

No user decision is required before starting under this plan.

Assumptions:

- The first visible AI approval workflow may use deterministic `createParameter` rather than natural language AI generation。
- Browser-local project persistence is the correct first durable transcript storage。
- Transcript storage can be added as an optional/defaulted field for old persisted projects。
- Transport adapters should wait until visible approval and durable transcript evidence are proven。

If any assumption is rejected, revise this plan before launching implementation.
