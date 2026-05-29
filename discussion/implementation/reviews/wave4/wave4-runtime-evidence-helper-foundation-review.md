# Wave 4 Domain B Review: runtime evidence helper foundation

> Review role: Review-Sylph  
> Review date: 2026-05-29  
> Verdict: pass

## 1. Scope Reviewed

- Target domain: `wave4-runtime-evidence-helper-foundation`
- Review target: `packages/runtime-core/src/**`
- Report output: `discussion/implementation/reviews/wave4/wave4-runtime-evidence-helper-foundation-review.md`
- Review mode: clean context review. 実装者の completion report だけでなく、basis documents と実ファイルを読んで判定した。

Reviewed runtime-core files include:

- `packages/runtime-core/src/runtime-evidence.ts`
- `packages/runtime-core/src/runtime-evidence-defaults.ts`
- `packages/runtime-core/src/runtime-state-artifacts.ts`
- `packages/runtime-core/src/runtime-diff-builder.ts`
- `packages/runtime-core/src/runtime-evidence.test.ts`
- `packages/runtime-core/src/dependency-boundary.test.ts`
- `packages/runtime-core/src/index.ts`
- 既存 runtime evaluator / snapshot / comparison 関連ファイル

## 2. Basis Used

- `discussion/implementation/orchestration/wave4-plan.md`
- `discussion/design/module-contracts/runtime-core-contract.md`
- `discussion/design/module-contracts/operation-contracts.md`
- `discussion/design/module-contracts/fixtures-and-contract-tests.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/implementation/waves/wave4/wave4-runtime-evidence-helper-foundation-completion.md`
- `packages/contracts/src/runtime-artifact-refs.ts`
- `packages/contracts/src/runtime-diff.ts`

## 3. Findings

### Blocking / Needs Changes

- なし。

### Notes

- `buildRuntimeEvidence` は `NormalizedRuntimeGraph` の baseline / candidate 入力から baseline snapshot、candidate snapshot、candidate final runtime state、runtime comparison / `RuntimeDiffDto`、generated snapshot IDs、runtime state ref、runtime state sequence ref を返している。主な該当箇所は `packages/runtime-core/src/runtime-evidence.ts:49`, `packages/runtime-core/src/runtime-evidence.ts:60`, `packages/runtime-core/src/runtime-evidence.ts:74`, `packages/runtime-core/src/runtime-evidence.ts:93`, `packages/runtime-core/src/runtime-evidence.ts:99`, `packages/runtime-core/src/runtime-evidence.ts:118`。
- Runtime diff は既存 `compareRuntimeSnapshots` を薄く包む形で、operation / validator が利用できる DTO を返す構造になっている。該当箇所は `packages/runtime-core/src/runtime-diff-builder.ts:16`, `packages/runtime-core/src/runtime-diff-builder.ts:25`。
- Runtime state / sequence refs は contracts の schema parse を通して生成され、production source に filesystem writer IO はない。該当箇所は `packages/runtime-core/src/runtime-state-artifacts.ts:24`, `packages/runtime-core/src/runtime-state-artifacts.ts:31`。
- `index.ts` は re-export のみで、source organization policy の `index.ts` barrel-only 方針に合っている。該当箇所は `packages/runtime-core/src/index.ts:1`。
- 新規ファイルは evidence orchestration、defaults、artifact refs、runtime diff adapter、test、dependency guard に分かれており、Domain B の責務内では catch-all 化していない。

## 4. Design / Development Compliance

- Runtime evidence helper: pass。baseline / candidate snapshots、final runtime state、runtime diff、generated refs を `NormalizedRuntimeGraph` 入力から生成している。
- Filesystem / package writer IO: pass。production source で `node:fs`、`fs/promises`、writer 系 API は検出されなかった。test source の `dependency-boundary.test.ts` と既存 fixture test は read-only 検査用途。
- Module boundary: pass。production `runtime-core` から `package-format` / `authoring-core` / `operation-core` / `validator-core` への import は検出されなかった。
- Barrel-only `index.ts`: pass。`packages/runtime-core/src/index.ts` は export 文のみ。
- Source split: pass。Domain B の新規 production files は責務別に分かれている。

## 5. Test Adequacy

- Minimal graph to evidence: pass。`packages/runtime-core/src/runtime-evidence.test.ts:20` で minimal graph から baseline / candidate snapshot、final state、runtime diff、generated refs を検証している。
- Snapshot comparison / RuntimeDiff: pass。`packages/runtime-core/src/runtime-evidence.test.ts:54` で `RuntimeDiffDtoSchema` parse と parameter diff を確認し、`packages/runtime-core/src/runtime-evidence.test.ts:64` で comparison が非同値になることを確認している。
- State refs / sequence refs contract validation: pass。`packages/runtime-core/src/runtime-evidence.test.ts:66` と `packages/runtime-core/src/runtime-evidence.test.ts:69` で `RuntimeStateArtifactRefSchema` / `RuntimeStateSequenceArtifactRefSchema` による検証がある。
- Boundary guard: pass。`packages/runtime-core/src/dependency-boundary.test.ts:7` は runtime-core source を再帰的に読み、禁止 package の root import を検出する。完全な import linter ではないが、Domain B の境界回帰を捕まえる実効性はある。

## 6. Verification Performed

| Command | Outcome |
|---|---|
| `pnpm.cmd exec vitest run packages/runtime-core/src/runtime-evidence.test.ts packages/runtime-core/src/dependency-boundary.test.ts` | 初回は sandbox EPERM で `node_modules/.pnpm/vitest.../vitest.mjs` を open できず失敗。権限外で同一コマンドを再実行し、2 files / 3 tests pass。 |
| `pnpm.cmd exec vitest run packages/runtime-core/src` | 権限外で実行。5 files / 9 tests pass。 |
| `pnpm.cmd typecheck` | 初回は sandbox EPERM で `node_modules/.pnpm/typescript.../tsc` を open できず失敗。権限外で同一コマンドを再実行し、`tsc --noEmit` pass。 |
| `rg -n "@private-2d-rigging-lab/(package-format|authoring-core|operation-core|validator-core)" packages/runtime-core/src -g "!*.test.ts"` | No matches。exit code 1 は ripgrep の「一致なし」。 |
| `rg -n "node:fs|fs/promises|readFile|writeFile|appendFile|mkdir|rm\(|unlink|createWriteStream|createReadStream" packages/runtime-core/src -g "!*.test.ts"` | No matches。exit code 1 は ripgrep の「一致なし」。 |
| `git diff --check -- packages/runtime-core/src` | pass。CRLF warning のみ。 |

Additional inspection:

- `packages/runtime-core/package.json` の direct dependencies は `@private-2d-rigging-lab/contracts` と `zod` のみ。
- `packages/contracts/src/runtime-artifact-refs.ts` の artifact ref schema と `packages/contracts/src/runtime-diff.ts` の `RuntimeDiffSchema` に実装・テストが適合していることを確認した。

## 7. Remaining Risks

- `dependency-boundary.test.ts` の regex は root package の `from "@private-2d-rigging-lab/<forbidden>"` import を主に検出する。現状違反はないが、将来 subpath import や side-effect import を許す package export が増える場合は guard を広げる余地がある。
- Evidence helper は generated refs を返すが、実体 artifact の永続化は Domain B の非目標であり、後続 Domain D/E で provider wiring / fixture artifact として検証する必要がある。

## 8. User-Decision Points

- なし。

## 9. Verdict

pass。Domain B は Wave 4 plan の runtime evidence helper foundation 要件を満たしており、現時点で blocking / needs_changes finding はない。
