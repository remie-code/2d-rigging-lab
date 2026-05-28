# Wave 2 Runtime Core Foundation Completion

> Domain: `wave2-runtime-core-foundation`  
> 実施日: 2026-05-29  
> Verdict: `pass`

## 1. Changed Files

### Package manifest

- `packages/runtime-core/package.json`
  - direct dependency として `@private-2d-rigging-lab/contracts` と `zod` を追加。
  - lockfile / dependency registry は本 domain の禁止範囲のため未更新。

### Public barrel

- `packages/runtime-core/src/index.ts`
  - re-export のみ。
  - 実装ロジックは含めていない。

### Runtime graph / input / options

- `packages/runtime-core/src/normalized-runtime-graph.ts`
  - `NormalizedRuntimeGraph` と parameter / dynamics / drawable / rigControl / keyform / mask の runtime-facing 型を追加。
- `packages/runtime-core/src/runtime-input.ts`
  - initial state request と frame evaluation input の Zod schema / types を追加。
- `packages/runtime-core/src/runtime-options.ts`
  - runtime evaluation options、epsilon policy、default options helper を追加。

### Runtime state / diagnostics / evaluation

- `packages/runtime-core/src/initial-state.ts`
  - `createInitialRuntimeState` を追加。
  - active dynamics group の初期 `position / velocity / tick / resetCounter` を deterministic に生成。
- `packages/runtime-core/src/state-compatibility.ts`
  - package identity / hash unavailable / missing or unknown dynamics group の stable diagnostics を追加。
- `packages/runtime-core/src/diagnostics.ts`
  - runtime-core 内の diagnostic construction helper を追加。
- `packages/runtime-core/src/runtime-core.ts`
  - `evaluateRuntimeFrame`、`evaluateRuntimeSequence`、`runtimeCore` facade を追加。
  - Wave 2 foundation として state explicit / deterministic shape を固定。full dynamics solver は未実装。

### Snapshot / comparison

- `packages/runtime-core/src/snapshot.ts`
  - `RuntimeSnapshotSchema` と minimal snapshot assembly を追加。
  - minimal drawable から non-empty draw list を生成。
- `packages/runtime-core/src/snapshot-comparison.ts`
  - snapshot comparison policy と `RuntimeDiffDto` 生成の最小実装を追加。

### Tests

- `packages/runtime-core/src/initial-state.test.ts`
  - empty dynamics graph の initial `RuntimeStateDto`。
  - active dynamics group identity / initial state。
- `packages/runtime-core/src/runtime-core.test.ts`
  - minimal non-empty draw list snapshot。
  - package mismatch / hash unavailable diagnostics。
  - sequence evaluation public result shape。
- `packages/runtime-core/src/dependency-boundary.test.ts`
  - runtime-core source が `package-format` を import しないこと。

## 2. Basis Documents Used

- `discussion/implementation/orchestration/wave2-plan.md`
- `discussion/implementation/waves/wave1/wave1-final-report.md`
- `discussion/design/module-contracts/runtime-core-contract.md`
- `discussion/design/module-contracts/module-boundaries.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `packages/contracts/src/index.ts`
- `packages/contracts/src/ids.ts`
- `packages/contracts/src/diagnostics.ts`
- `packages/contracts/src/runtime-state.ts`
- `packages/contracts/src/runtime-sequence.ts`
- `packages/contracts/src/runtime-diff.ts`

## 3. Implementation Summary

- `runtime-core` は `contracts` と `zod` のみを直接参照し、`package-format` は import していない。
- RuntimeState は `contracts` の `RuntimeStateDtoSchema` を source of truth として parse している。
- RuntimeSnapshot は contract document に従い、runtime-core 所有 schema として追加した。
- Wave 2 foundation の範囲に留め、full mesh deformation、full grid interpolation、rig hierarchy evaluation、renderer integration、complete dynamics solver は実装していない。
- Dynamics は initial state と explicit state carry-forward / reset shape まで固定した。solver の物理ステップ完成は後続 wave の責務。
- Sequence evaluation は frame list を public shape で受け、snapshot list と final state を返す。

## 4. Tests / Verification

| Command | Result | Notes |
|---|---|---|
| `pnpm exec vitest run packages/runtime-core/src` | pass | 3 files / 6 tests pass。初回 sandbox EPERM 後、外部権限で実行。 |
| `pnpm typecheck` | fail | runtime-core 修正後、runtime-core 起因の error は解消。残存 error は並行 domain の `packages/package-format/src/parse-result.ts(15,56)` で `z.SafeParseReturnType` が存在しない件。 |
| `pnpm exec tsc ... packages/runtime-core/src/*.ts` | pass | runtime-core source / tests の targeted TypeScript check。 |
| `rg "@private-2d-rigging-lab/package-format\|package-format" packages/runtime-core` | pass with expected test text only | production import はなし。境界テスト内の説明文字列だけ検出。 |
| `git diff --check -- packages/runtime-core discussion/implementation/waves/wave2/wave2-runtime-core-foundation-completion.md` | pass | CRLF warning のみ。 |

Verification environment note:

- 初回は `node_modules` の `.bin` shim 欠落と sandbox EPERM により Vitest / TypeScript 実行が失敗した。
- lockfile 更新なしの `pnpm install --lockfile=false`、`pnpm store add vite@6.4.2`、壊れていた workspace 内 Vite 展開の再作成で検証環境を復元した。
- `pnpm-lock.yaml` と dependency registry は更新していない。
- 最終的な `pnpm exec vitest run packages/runtime-core/src`、runtime-core targeted `tsc`、`pnpm typecheck` は実行済み。`pnpm typecheck` の残存失敗は runtime-core 外の package-format 起因。

## 5. Source Organization Notes

- `index.ts` は barrel-only。
- Runtime graph、input、options、initial state、state compatibility、snapshot、comparison、runtime facade、diagnostics を責務別に分割。
- Test は initial state、runtime evaluation、dependency boundary に分割。
- 現時点で oversized entrypoint / broad catch-all file はなし。

## 6. Dependency Follow-up Needed

- `packages/runtime-core/package.json` に direct dependencies を追加したが、本 domain の禁止範囲により `pnpm-lock.yaml` と `generated/dependencies/dependency-registry.json` は未更新。
- Integration domain で lockfile と dependency registry の整合更新が必要。
- 並行 domain の `packages/package-format/package.json` も direct dependencies を追加しているため、同時に整合させるのがよい。

## 7. Remaining Issues

- `pnpm typecheck` 全体は package-format 側の型 error により fail。
- RuntimeSnapshot schema は Wave 2 foundation の最小 schema。後続 wave で full vertices / keyform samples / rig hierarchy / dynamics debug completeness を拡張する必要がある。
- Dynamics evaluator は state shape と reset / carry-forward foundation まで。full `scalarDampedFollowV1` solver は未実装。

## 8. User-decision Points

- なし。

## 9. Early Escape Triggers

- なし。
