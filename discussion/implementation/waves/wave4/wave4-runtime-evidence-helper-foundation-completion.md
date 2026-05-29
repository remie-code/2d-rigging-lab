# Wave 4 Domain B Completion: runtime evidence helper foundation

> Domain: `wave4-runtime-evidence-helper-foundation`  
> 実施日: 2026-05-29  
> Verdict: pass

## 1. Basis Used

- `discussion/implementation/orchestration/wave4-plan.md`
- `discussion/implementation/waves/wave3/wave3-final-report.md`
- `discussion/design/module-contracts/runtime-core-contract.md`
- `discussion/design/module-contracts/operation-contracts.md`
- `discussion/design/module-contracts/fixtures-and-contract-tests.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/implementation/waves/wave2/wave2-final-report.md`
- `discussion/implementation/waves/wave2/integration-review.md`
- `packages/runtime-core/src/index.ts`
- `packages/contracts/src/index.ts`

## 2. Changed Files

Runtime evidence orchestration:

- `packages/runtime-core/src/runtime-evidence.ts`

Default runtime evidence inputs:

- `packages/runtime-core/src/runtime-evidence-defaults.ts`

Generated runtime state evidence refs:

- `packages/runtime-core/src/runtime-state-artifacts.ts`

Runtime diff adapter:

- `packages/runtime-core/src/runtime-diff-builder.ts`

Tests and boundary guard:

- `packages/runtime-core/src/runtime-evidence.test.ts`
- `packages/runtime-core/src/dependency-boundary.test.ts`

Public barrel export only:

- `packages/runtime-core/src/index.ts`

Report:

- `discussion/implementation/waves/wave4/wave4-runtime-evidence-helper-foundation-completion.md`

## 3. Implementation Summary

- `buildRuntimeEvidence` を追加し、`NormalizedRuntimeGraph` の baseline / candidate 入力から baseline snapshot、candidate snapshot、final runtime state、`RuntimeDiffDto`、generated runtime snapshot IDs、runtime state ref、runtime state sequence ref を生成できるようにした。
- Evidence helper は既存の `createInitialRuntimeState`、`evaluateRuntimeFrame`、`evaluateRuntimeSequence`、`compareRuntimeSnapshots` を利用する薄い orchestration 層に留めた。
- Artifact refs は `RuntimeStateArtifactRefSchema` / `RuntimeStateSequenceArtifactRefSchema` で parse する生成文字列のみで、filesystem IO は実装していない。
- `buildRuntimeDiff` / `buildRuntimeDiffComparison` を追加し、snapshot comparison result から operation / validator がそのまま使える `RuntimeDiffDto` を取り出せるようにした。
- `index.ts` は re-export 追加のみで、実装ロジックは置いていない。
- dependency boundary test に `authoring-core` 禁止を追加し、runtime-core が `package-format` / `authoring-core` / `operation-core` / `validator-core` を import しないことを固定した。

## 4. Verification Performed

Pass:

- `pnpm.cmd install`
- `pnpm.cmd install --force`。sandbox 側の依存展開不完全により `vite` 解決が壊れていたため、外部権限で再展開した。
- `pnpm.cmd exec vitest run packages/runtime-core/src`。5 files / 9 tests pass。
- `pnpm.cmd exec tsc --noEmit ... packages/runtime-core/src/runtime-evidence*.ts packages/runtime-core/src/runtime-state-artifacts.ts packages/runtime-core/src/runtime-diff-builder.ts packages/runtime-core/src/dependency-boundary.test.ts`。pass。
- `pnpm.cmd run check:source`。pass。
- `rg -n "@private-2d-rigging-lab/(package-format|authoring-core|operation-core|validator-core)" packages/runtime-core/src`。No forbidden imports found。
- `git diff --check -- packages/runtime-core/src`。pass。CRLF warning のみ。

Partial / blocked by parallel scope:

- `pnpm.cmd typecheck` は失敗。失敗箇所は `packages/authoring-core/src/runtime-graph-adapter.test.ts` と `packages/authoring-core/src/runtime-graph-dynamics.ts` の branded ID / exact optional property errors で、Domain B の許可範囲外。runtime-core 変更ファイルの targeted typecheck は pass。

## 5. Remaining Issues

- Domain B 実装内の blocking issue はなし。
- 全体 `pnpm typecheck` は並列作業中の `authoring-core` 型エラー解消後に再実行が必要。

## 6. User-Decision Points

- なし。

## 7. Provisional Assumptions

- Runtime evidence refs は generated evidence refs として返し、実体ファイルの書き込みは後続 fixture / operation / validator integration 側で必要に応じて扱う。
- Default baseline frame は `frameIndex=0`、default candidate frame は `frameIndex=1` とし、既存 snapshot ID 生成規則でも baseline / candidate を識別できるようにした。
- Sequence refs は single-frame evidence でも deterministic replay 用の generated ref として返せる扱いにした。
