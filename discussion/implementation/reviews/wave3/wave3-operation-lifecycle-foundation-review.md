# Wave 3 Domain C Review: operation lifecycle foundation

> Review role: Review-Sylph  
> Target domain: `wave3-operation-lifecycle-foundation`  
> Review date: 2026-05-29  
> Verdict: `pass`

## 1. Scope Reviewed

対象:

- `packages/operation-core/package.json`
- `packages/operation-core/src/**`
- `packages/authoring-core/src/**` public API usage, read-only

レビュー報告のみを作成し、production source は編集していない。

## 2. Basis Used

- `discussion/implementation/orchestration/wave3-plan.md`
- `discussion/design/module-contracts/operation-contracts.md`
- `discussion/design/module-contracts/module-boundaries.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/implementation/waves/wave3/wave3-authoring-core-session-foundation-completion.md`
- `discussion/implementation/reviews/wave3/wave3-authoring-core-session-foundation-review.md`
- `discussion/implementation/waves/wave3/wave3-operation-contract-dto-foundation-completion.md`
- `discussion/implementation/reviews/wave3/wave3-operation-contract-dto-foundation-review.md`
- `discussion/implementation/waves/wave3/wave3-operation-lifecycle-foundation-completion.md`
- 実ファイル:
  - `packages/operation-core/package.json`
  - `packages/operation-core/src/**`
  - `packages/authoring-core/src/index.ts`
  - `packages/authoring-core/src/authoring-session.ts`
  - `packages/authoring-core/src/authoring-mutations.ts`
  - `packages/authoring-core/src/graph-selectors.ts`

## 3. Findings

### Blocking

なし。

### Warnings

なし。

### Evidence Notes

- `operation-core` の production dependency は `authoring-core`、`contracts`、`zod` に閉じており、`runtime-core` / `validator-core` / GUI / AI / renderer package は manifest dependency に含まれていない。根拠: `packages/operation-core/package.json:10`
- lifecycle は `authoring-core` の public barrel から公開される `createDryRunAuthoringSession`、`createParameter`、`getParameterById` を mutation / selector boundary として使用している。根拠: `packages/authoring-core/src/index.ts:3`, `packages/authoring-core/src/index.ts:6`, `packages/authoring-core/src/index.ts:7`, `packages/operation-core/src/operations/create-parameter.ts:2`
- `dryRunOperation` は request parse / precondition 後に handler の dry-run path へ渡し、`createParameter` handler 側で cloned authoring session を作って mutation を適用しているため、元 session を mutate しない設計になっている。根拠: `packages/operation-core/src/lifecycle/dry-run.ts:15`, `packages/operation-core/src/lifecycle/dry-run.ts:34`, `packages/operation-core/src/operations/create-parameter.ts:24`
- `commitOperation` は渡された authoring session に handler commit を適用し、成功時のみ `OperationLogEntryDto` を生成して operation log に append し、`logEntry` と `operationLogLength` を返す。根拠: `packages/operation-core/src/lifecycle/commit.ts:58`, `packages/operation-core/src/lifecycle/commit.ts:66`, `packages/operation-core/src/lifecycle/commit.ts:76`, `packages/operation-core/src/lifecycle/commit.ts:80`
- 最初の supported operation は `createParameter` のみである。根拠: `packages/operation-core/src/operation-registry.ts:28`
- duplicate parameter は mutation 前に `getParameterById` で検出され、`operation.createParameter.duplicateParameter` の rejected result になる。根拠: `packages/operation-core/src/operations/create-parameter.ts:57`, `packages/operation-core/src/operations/create-parameter.ts:100`, `packages/operation-core/src/operations/create-parameter.ts:103`
- operation log schema / builder は required fields の operation ID、transaction ID、actor、surface、operationType、target IDs、payload、result、provenance ID、validation/runtime refs、reversible を持つ。根拠: `packages/operation-core/src/operation-log-entry.ts:19`, `packages/operation-core/src/operation-log.ts:36`
- `index.ts` は export のみで barrel-only 要件を満たす。根拠: `packages/operation-core/src/index.ts:1`
- source は lifecycle、operation registry、operation log、preconditions、operation handler、payload schema family に分割され、catch-all `types.ts` / `schemas.ts` / `utils.ts` / `helpers.ts` は見つからなかった。

## 4. Test Adequacy

判定: `pass`

- dry-run status と original session non-mutation: `packages/operation-core/src/operation-lifecycle.test.ts:9` で `status="dry_run"`、parameter 未追加、authoring revision / dirty / log が変化しないことを確認している。
- commit status と revision / log increment: `packages/operation-core/src/operation-lifecycle.test.ts:25` で `status="committed"`、authoring revision increment、dirty flag、operation log length を確認している。
- duplicate / precondition rejection without mutation: `packages/operation-core/src/operation-lifecycle.test.ts:52` で duplicate commit が `rejected` になり、revision と log length が変わらないことを確認している。
- operation log required fields: `packages/operation-core/src/operation-lifecycle.test.ts:42` 以降で committed log の主要 required fields を確認し、DTO schema test でも required fields parse を確認している。根拠: `packages/operation-core/src/operation-schemas.test.ts:125`
- boundary guard: `packages/operation-core/src/dependency-boundary.test.ts:9` が barrel-only、`packages/operation-core/src/dependency-boundary.test.ts:22` が GUI / AI / renderer / runtime / validator import 禁止を検査している。追加で `pnpm.cmd run check:deps` も pass した。

## 5. Verification Performed

| Command | Outcome |
|---|---|
| `Get-Content -Encoding UTF8 -Raw discussion/implementation/orchestration/wave3-plan.md` | exit 0。basis を確認。 |
| `Get-Content -Encoding UTF8 -Raw discussion/design/module-contracts/operation-contracts.md` | exit 0。basis を確認。 |
| `Get-Content -Encoding UTF8 -Raw discussion/design/module-contracts/module-boundaries.md` | exit 0。basis を確認。 |
| `Get-Content -Encoding UTF8 -Raw discussion/development_convention/source-file-organization-policy.md` | exit 0。basis を確認。 |
| `Get-Content -Encoding UTF8 -Raw discussion/implementation/waves/wave3/wave3-authoring-core-session-foundation-completion.md` | exit 0。basis を確認。 |
| `Get-Content -Encoding UTF8 -Raw discussion/implementation/reviews/wave3/wave3-authoring-core-session-foundation-review.md` | exit 0。basis を確認。 |
| `Get-Content -Encoding UTF8 -Raw discussion/implementation/waves/wave3/wave3-operation-contract-dto-foundation-completion.md` | exit 0。basis を確認。 |
| `Get-Content -Encoding UTF8 -Raw discussion/implementation/reviews/wave3/wave3-operation-contract-dto-foundation-review.md` | exit 0。basis を確認。 |
| `Get-Content -Encoding UTF8 -Raw discussion/implementation/waves/wave3/wave3-operation-lifecycle-foundation-completion.md` | exit 0。basis を確認。 |
| `rg --files packages/operation-core/src` | exit 0。review target source files を列挙。 |
| `git status --short -uall` | exit 0。対象 domain の未追跡/変更ファイルを確認。既存の他 agent 変更は revert していない。 |
| `git diff --check -- packages/operation-core discussion/implementation/waves/wave3` | exit 0。whitespace error なし。LF/CRLF warning のみ。 |
| `pnpm.cmd exec vitest run packages/operation-core/src` | 初回 exit 1。sandbox EPERM で `vitest.mjs` open に失敗。 |
| `pnpm.cmd exec vitest run packages/operation-core/src` | 外部権限で再実行し exit 0。3 files / 9 tests passed。 |
| `pnpm.cmd exec vitest run packages/authoring-core/src packages/operation-core/src` | 外部権限で exit 0。5 files / 13 tests passed。 |
| `pnpm.cmd typecheck` | 初回 exit 1。sandbox EPERM で TypeScript `tsc` open に失敗。 |
| `pnpm.cmd typecheck` | 外部権限で再実行し exit 0。`tsc --noEmit` pass。 |
| `pnpm.cmd run check:source` | exit 0。`Source organization guard passed.` |
| `pnpm.cmd run check:deps` | exit 0。`Dependency guard passed.` |
| `Select-String -Path packages/operation-core/src/*.ts,packages/operation-core/src/**/*.ts -Pattern '@private-2d-rigging-lab/(runtime-core|validator-core|editor-ui|ai-interface|renderer-adapter)'` | exit 0。match なし。 |
| `Select-String -Path packages/operation-core/src/*.ts,packages/operation-core/src/**/*.ts -Pattern '@private-2d-rigging-lab/'` | exit 0。production imports は `authoring-core` と `contracts` のみ。test も同範囲。 |
| `Select-String -Path packages/operation-core/src/*.ts,packages/operation-core/src/**/*.ts -Pattern 'runtime-core|validator-core|editor-ui|ai-interface|renderer-adapter'` | exit 0。production match なし。dependency-boundary test の禁止 import pattern のみ。 |
| `Get-ChildItem -Path packages/operation-core/src -Recurse -File -Include types.ts,schemas.ts,utils.ts,helpers.ts` | exit 0。該当ファイルなし。 |
| `git diff --check -- discussion/implementation/reviews/wave3/wave3-operation-lifecycle-foundation-review.md` | exit 0。review report の whitespace error なし。 |
| `Get-Content -Encoding UTF8 -Raw discussion/implementation/reviews/wave3/wave3-operation-lifecycle-foundation-review.md` | exit 0。review report の内容を確認。 |

注記: review 中に PowerShell quoting が不適切な `rg` command を 2 件実行し、どちらも command parse error で失敗した。上記の `Select-String` command で同等内容を再確認済み。

## 6. Remaining Risks

- `commitOperation` は authoring revision と operation log を更新するが、`session.packageRevision` は increment していない。Domain C rubric は authoring revision / operation log increment を要求しており、この review では blocking としない。ただし save/write integration で package revision policy を再確認する必要がある。
- operation log は in-memory foundation で、`operations/log.jsonl` への永続化は未実装。Wave 3 Domain C の範囲では許容できるが、fixture / package write integration で contract evidence として再確認が必要。
- `parameterId` 未指定時の deterministic ID generation は display name 由来の暫定 policy である。将来の ID ownership / collision policy が固まる段階で見直しが必要。

## 7. User-Decision Points

なし。
