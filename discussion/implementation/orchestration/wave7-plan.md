# Wave 7 Plan: editor project persistence and e2e hardening

> Status: Draft / ready for execution request
> Created: 2026-05-29
> Coordinator: Undine
> Execution unit: Wave 7 only

## 1. 上流ゲート

Wave 6 は完了済み。

- Basis: [../waves/wave6/wave6-final-report.md](../waves/wave6/wave6-final-report.md)
- Wave 6 で成立したこと:
  - `apps/editor` の Vite + vanilla TypeScript app。
  - GUI から `createParameter` を `operation-core` 経由で commit。
  - operation log JSONL、runtime / validation evidence、package file set、reload summary の UI 表示。
  - Chrome headless smoke で desktop / mobile とも commit + reload 成功、横 overflow 0。

Wave 6 の残課題:

- Browser smoke が恒久的な e2e test ではない。
- editor は in-memory sample package から起動している。
- browser storage / filesystem save / archive writer がない。
- root `tsconfig.json` に DOM lib が入っており、core package の accidental DOM 依存を型レベルで検出しにくい。

## 2. Wave Objective

Wave 7 の目的は、Wave 6 の GUI 縦切りを「何度でも検証でき、ブラウザ上で保存・復元でき、core package の型境界も守れる」状態へ固めること。

この wave では OS filesystem picker や zip/archive writer までは扱わない。まず browser-local project persistence と durable e2e harness を作る。

## 3. Repository Facts

- `apps/editor` は存在し、build 可能。
- app は `createEditorSessionAdapter` を通じて operation を commit している。
- app 内の永続化はまだ in-memory。
- `operation-core` の `createOperationLog()` / `createOperationCore()` は現在 empty log から始まる。
- `package-format` は `PackageFileSet` serialize / parse を持つ。
- `operation-core` は operation log JSONL parse / serialize を持つ。
- root `typecheck` は単一 `tsconfig.json` を使い、現在 DOM lib を含んでいる。

## 4. Wave Design Decisions

### DEC-W7-001: まず browser storage を正にする

Wave 7 では `localStorage` 互換の browser storage adapter を実装する。File System Access API、native filesystem、zip/archive export は扱わない。

理由:

- headless e2e で安定検証できる。
- OS / browser permission UI に依存しない。
- package file set と operation log の永続化境界を先に固定できる。

### DEC-W7-002: persisted project は DTO として扱い、raw artifact dump はしない

保存対象は editor 専用の persisted project DTO とする。

最小内容:

- schema version
- savedAt
- package file set
- operation log JSONL
- generated artifact paths
- package identity / revision summary

UI は counts / IDs / paths / status を表示し、artifact content は通常表示しない。

### DEC-W7-003: load 後の追加 commit で operation log を継続できるようにする

保存済み project を load した後に追加 operation を commit する場合、operation log が空に戻ると workflow と evidence が壊れる。

そのため Wave 7 では `operation-core` に operation log hydrate の最小APIを追加する。

### DEC-W7-004: root typecheck から DOM を外す

root package / core packages は DOM-free を維持しやすくする。

Wave 7 では:

- root `tsconfig.json` を package / scripts 寄りに戻す。
- `apps/editor/tsconfig.json` に DOM lib を持たせる。
- root `pnpm typecheck` から editor app typecheck も走るようにする。

### DEC-W7-005: e2e は依存追加なしの headless smoke から始める

Playwright などの新規依存はこの wave では入れない。

既存の Vite app とローカル Chrome / Edge headless を使う Node script を追加し、次を検証する:

- app 起動
- `createParameter` commit
- save to browser storage
- reload from browser storage
- reset
- desktop / mobile 横 overflow 0

Chrome / Edge が見つからない場合は early escape とする。

## 5. Non-goals

- OS filesystem picker。
- zip/archive writer。
- File System Access API。
- real project import/export download。
- `ai-interface` 実装。
- `viewer-ui` 実装。
- `renderer-adapter` 実装。
- React / JSX 導入。
- full Playwright e2e 導入。
- broader operation catalog。

## 6. Required Basis Documents

Undine はこの plan と wave final report を root context の中心に置く。詳細規約は domain ごとに渡す。

共通 basis:

- `.agents/skills/implementation-orchestration/SKILL.md`
- [wave7-plan.md](wave7-plan.md)
- [../../development_convention/source-file-organization-policy.md](../../development_convention/source-file-organization-policy.md)
- [../../design/module-contracts/module-boundaries.md](../../design/module-contracts/module-boundaries.md)
- [../waves/wave6/wave6-final-report.md](../waves/wave6/wave6-final-report.md)

Domain-specific basis:

- editor GUI / workflow:
  - [../../design/module-contracts/gui-operation-contract.md](../../design/module-contracts/gui-operation-contract.md)
- operation log hydrate:
  - [../../design/module-contracts/operation-contracts.md](../../design/module-contracts/operation-contracts.md)
- package file set persistence:
  - [../../design/module-contracts/package-file-format-contract.md](../../design/module-contracts/package-file-format-contract.md)

## 7. Domain Plan

### Domain A: `wave7-typecheck-boundary-split`

目的:

DOM lib を root typecheck から外し、editor app 専用 tsconfig / typecheck を作る。

Allowed write scope:

- `tsconfig.json`
- `apps/editor/tsconfig.json`
- `apps/editor/package.json`
- root `package.json`
- `vitest.config.ts` only if test include / environment adjustment is required

Forbidden write scope:

- `packages/**` production logic
- editor runtime source
- persistence / UI source
- unrelated `discussion/**`

Expected output:

- root package / core packages の typecheck は DOM lib なしで通る。
- `apps/editor` は DOM lib ありで typecheck できる。
- root `pnpm typecheck` が core と editor の両方を検証する。
- `pnpm check` が既存 semantics を維持する。

Required verification:

- `pnpm typecheck`
- `pnpm --filter @private-2d-rigging-lab/editor typecheck`
- `pnpm check:source`

Early escape:

- app / package の tsconfig 分離により module resolution が壊れる。
- root scripts の責務が不明確になる。

Parallelism:

- Batch 1。最初に実行する。

### Domain B: `wave7-operation-log-hydration-foundation`

目的:

保存済み operation log を `operation-core` に hydrate し、load 後の追加 commit でも log append を継続できるようにする。

Allowed write scope:

- `packages/operation-core/src/**`

Forbidden write scope:

- `apps/**`
- `packages/authoring-core/**`
- `packages/package-format/**`
- `packages/runtime-core/**`
- `packages/validator-core/**`
- `fixtures/**` unless a narrowly scoped operation-core fixture is needed and reported

Expected output:

- `createOperationLog` が initial entries を受け取れる、または同等の hydrate API を持つ。
- `createOperationCore` が initial operation log entries を受け取れる。
- initial entries は schema parse / defensive copy される。
- append order と log length が安定する。

Required tests:

- hydrated log entries are preserved.
- new commit appends after hydrated entries.
- invalid hydrated entry is rejected.
- public `index.ts` remains barrel-only.

Required verification:

- `pnpm exec vitest run packages/operation-core/src`
- `pnpm typecheck`
- `pnpm check:source`

Early escape:

- operation log hydrate semantics conflict with operation contract.
- initial log entries require package-format ownership.

Parallelism:

- Batch 2。Domain C と並列可能。

### Domain C: `wave7-browser-project-store-foundation`

目的:

editor app 用 browser project persistence adapter を作る。

Allowed write scope:

- `apps/editor/src/project-persistence/**`

Forbidden write scope:

- `apps/editor/src/app/**`
- `apps/editor/src/editor-session/**`
- `apps/editor/src/editor-state/**`
- `apps/editor/src/ui/**`
- `packages/**`
- config files

Expected output:

- persisted project DTO / schema version。
- `StorageLike` interface。
- save / load / clear API。
- package file set と operation log JSONL の保存。
- load 時の parse / validation summary。
- corrupted storage の graceful error。

Required tests:

- save then load returns package file set and operation log JSONL.
- clear removes project.
- invalid JSON / invalid schema returns failed result without throwing through UI boundary.
- adapter uses StorageLike so unit tests do not require real browser global.

Required verification:

- `pnpm exec vitest run apps/editor/src/project-persistence`
- `pnpm --filter @private-2d-rigging-lab/editor typecheck`
- `pnpm check:source`

Early escape:

- package file set storage shape conflicts with package-format contract.
- persisted DTO would need raw artifact rendering or rights/provenance changes.

Parallelism:

- Batch 2。Domain B と並列可能。

### Domain D: `wave7-editor-workflow-persistence-controller`

目的:

Wave 6 の app-local state wiring を、save / load / reset を扱える editor workflow controller へ整理する。

Allowed write scope:

- `apps/editor/src/editor-workflow/**`
- `apps/editor/src/editor-session/**` only if needed to use operation log hydration
- `apps/editor/src/app/**` for composition wiring only

Forbidden write scope:

- `apps/editor/src/project-persistence/**` except import use
- `apps/editor/src/ui/**`
- `packages/**` except using Domain B public API
- config files

Expected output:

- create initial workflow from sample package.
- commit operation through session adapter.
- save current persisted project through project persistence adapter.
- load persisted project and restore UI state / package revision / operation log summary.
- reset to sample package and clear persistence.
- load path uses operation log hydrate so future commit can append.

Required tests:

- commit -> save -> load restores parameter and reload summary.
- load -> second commit appends operation log rather than replacing it.
- reset clears persisted state and returns to sample package.

Required verification:

- `pnpm exec vitest run apps/editor/src/editor-workflow apps/editor/src/editor-session`
- `pnpm --filter @private-2d-rigging-lab/editor typecheck`
- `pnpm check:source`

Early escape:

- `operation-core` hydrate API is insufficient.
- UI state projection cannot represent saved / loaded / reset status cleanly.

Parallelism:

- Batch 3。Domains B / C の完了後に実行。

### Domain E: `wave7-project-persistence-ui`

目的:

save / load / reset 操作と storage status を editor UI に追加する。

Allowed write scope:

- `apps/editor/src/ui/project-persistence/**`
- `apps/editor/src/ui/app-shell/**`
- `apps/editor/src/app/**` for wiring
- `apps/editor/src/editor-state/**` only for minimal status fields if required
- `apps/editor/src/styles/**`

Forbidden write scope:

- `apps/editor/src/project-persistence/**`
- `apps/editor/src/editor-workflow/**`
- `packages/**`
- config files

Expected output:

- Save button。
- Load saved button。
- Reset button。
- storage status / last saved summary。
- disabled / empty / error states。
- stable test IDs。
- no text overlap at desktop / mobile widths。

Required verification:

- `pnpm --filter @private-2d-rigging-lab/editor build`
- `pnpm --filter @private-2d-rigging-lab/editor typecheck`
- `pnpm check:source`

Early escape:

- UI requires browser permission workflow.
- status state needs a broad catch-all file.

Parallelism:

- Batch 4。Domain D の後に実行。

### Domain F: `wave7-durable-editor-e2e-smoke`

目的:

Wave 6 の ad hoc smoke を恒久的な e2e script にする。

Allowed write scope:

- `apps/editor/e2e/**`
- `scripts/editor-e2e-smoke.mjs`
- `apps/editor/package.json`
- root `package.json`

Forbidden write scope:

- production source, except only if a stable test ID is missing and explicitly reported
- `packages/**`
- persisted project implementation internals

Expected output:

- script starts or reuses editor Vite server.
- script locates Chrome / Edge via env or known Windows paths.
- script runs desktop and mobile smoke.
- smoke checks:
  - initial shell renders
  - createParameter commit succeeds
  - save to browser storage succeeds
  - reload from browser storage succeeds
  - reset returns to sample state
  - horizontal overflow count is 0
- root script exposes this as `test:e2e:editor` or similar.

Required verification:

- `pnpm run test:e2e:editor`
- `pnpm --filter @private-2d-rigging-lab/editor build`
- `pnpm check`

Early escape:

- no Chrome / Edge binary available.
- browser storage cannot be validated without adding heavy dependency.

Parallelism:

- Batch 5。Domain E の後に実行。

### Domain G: `wave7-integration-review-and-final-report`

目的:

Wave 7 全体を統合し、clean review、verification、永続レポートを作成する。

Allowed write scope:

- `discussion/implementation/waves/wave7/**`
- `discussion/implementation/reviews/wave7/**`
- `discussion/implementation/_map.md`
- `discussion/implementation/orchestration/_map.md`
- `discussion/_map.md`
- minimal source wiring only if needed to resolve integration findings

Expected output:

- domain completion reports。
- Review-Sylph reports。
- integration review。
- final report。

Required verification:

- `pnpm install` if dependency tree changes.
- `pnpm --filter @private-2d-rigging-lab/editor build`
- `pnpm --filter @private-2d-rigging-lab/editor typecheck`
- `pnpm exec vitest run apps/editor/src`
- `pnpm exec vitest run packages/operation-core/src`
- `pnpm run test:e2e:editor`
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
  A typecheck boundary split

Batch 2
  B operation log hydration foundation
  C browser project store foundation

Batch 3
  D editor workflow persistence controller

Batch 4
  E project persistence UI

Batch 5
  F durable editor e2e smoke

Batch 6
  G integration review and final report
```

Batch 2 は並列投入可能。Batch 3 以降は依存が強いので順次投入する。

## 9. Wave Pass Criteria

Wave 7 passes only if all are true:

- root core package typecheck no longer needs DOM lib.
- editor app has its own DOM-aware typecheck.
- saved browser project can be stored, loaded, and cleared.
- loaded project can preserve operation log summary and support a subsequent commit append.
- UI exposes save / load / reset with clear status.
- permanent e2e script verifies commit / save / load / reset on desktop and mobile widths.
- `pnpm check` passes.
- `test:e2e:editor` passes or a real browser availability blocker is recorded as early escape.
- source organization guard passes.
- integration review and final report are written.

## 10. User Decision Points

No user decision is required before starting under this plan.

Assumptions:

- Browser-local storage is acceptable as the first project persistence layer.
- OS filesystem / archive writer can wait for a later wave.
- No new e2e framework dependency should be introduced in Wave 7.

If any assumption is rejected, revise this plan before launching implementation.
