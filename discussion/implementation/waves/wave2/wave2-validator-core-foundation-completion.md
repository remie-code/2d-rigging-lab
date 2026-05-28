# Wave 2 Validator Core Foundation Completion

> Domain: `wave2-validator-core-foundation`  
> 実施日: 2026-05-29  
> Verdict: `pass`

## Changed Files Grouped By Responsibility

### Package manifest

- `packages/validator-core/package.json`
  - direct dependency として `@private-2d-rigging-lab/contracts`、`@private-2d-rigging-lab/package-format`、`@private-2d-rigging-lab/runtime-core`、`zod` を追加。
  - lockfile / dependency registry は本 domain の禁止範囲に従い未更新。

### Check catalog / profile / summary

- `packages/validator-core/src/check-catalog.ts`
  - Wave 2 foundation 用 check definition schema、catalog registration API、主要 check ID を追加。
- `packages/validator-core/src/validation-profile.ts`
  - `editorIncremental` / `viewer` / `strict` / `acceptance` / `aiDryRun` の最小 profile config を追加。
- `packages/validator-core/src/validation-summary.ts`
  - severity counts、highest severity、summary status aggregation を追加。

### Validation report schema / builder

- `packages/validator-core/src/validation-report.ts`
  - `ValidationCheckResultSchema`、`RepairCandidateSchema`、`ValidationReportSchema` を追加。
- `packages/validator-core/src/report-builder.ts`
  - summary aggregation と evidence default を含む `buildValidationReport` を追加。

### Minimal validators

- `packages/validator-core/src/validators/package-schema.ts`
  - `package-format` の public `parsePackageDocument` を使う package schema validation を追加。
- `packages/validator-core/src/validators/runtime-load.ts`
  - `runtime-core` の public `RuntimeSnapshotSchema` を使う runtime snapshot validation と empty draw list check を追加。
- `packages/validator-core/src/validators/package-runtime.ts`
  - package schema check と runtime snapshot check を結合して `ValidationReportDto` を作る最小 API を追加。

### Public barrel / tests

- `packages/validator-core/src/index.ts`
  - re-export のみ。実装ロジックは追加していない。
- `packages/validator-core/src/validator-core.test.ts`
  - catalog、summary、report builder、minimal package + runtime pass、missing required file / empty draw list fail を確認。

## Basis Documents Used

- `discussion/implementation/orchestration/wave2-plan.md`
- `discussion/implementation/waves/wave1/wave1-final-report.md`
- `discussion/implementation/waves/wave2/wave2-package-format-foundation-completion.md`
- `discussion/implementation/waves/wave2/wave2-runtime-core-foundation-completion.md`
- `discussion/implementation/reviews/wave2/wave2-package-format-foundation-review.md`
- `discussion/implementation/reviews/wave2/wave2-runtime-core-foundation-review.md`
- `discussion/design/module-contracts/validator-contract.md`
- `discussion/design/module-contracts/package-file-format-contract.md`
- `discussion/design/module-contracts/runtime-core-contract.md`
- `discussion/design/module-contracts/module-boundaries.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `packages/contracts/src/index.ts`
- `packages/package-format/src/index.ts`
- `packages/runtime-core/src/index.ts`

## Implementation Summary

- validator-core の Wave 2 foundation として、check catalog、validation profile、summary aggregation、validation report DTO schema、report builder を責務別ファイルに分割して追加した。
- package validation は `@private-2d-rigging-lab/package-format` の public `parsePackageDocument` のみを使い、private schema implementation には依存していない。
- runtime validation は `@private-2d-rigging-lab/runtime-core` の public `RuntimeSnapshotSchema` のみを使い、runtime-core の private helper には依存していない。
- `validatePackageRuntime` は package parse result と runtime snapshot check を結合し、最小 pass / fail report を生成する。
- Wave 2 非目標である full check catalog behavior、acceptance runner、GUI operation evidence validation、repair automation、operation-core integration は実装していない。

## Tests / Verification

| Command | Result |
|---|---|
| `pnpm exec vitest run packages/validator-core/src` | pass。1 file / 5 tests pass。sandbox 内では `node_modules/.../vitest.mjs` の EPERM が出たため、承認付き外部実行で確認。 |
| `pnpm typecheck` | pass |
| `pnpm check:source` | pass。Source organization guard passed。 |
| `git diff --check -- packages/validator-core discussion/implementation/waves/wave2/wave2-validator-core-foundation-completion.md` | pass。CRLF warning のみ。 |

Environment note:

- `validator-core` の新規 workspace dependency link が必要だったため、lockfile 非更新の `pnpm install --lockfile=false --force` を実行して `node_modules` を再構成した。
- offline store 不足により一度 `--offline` は失敗したため、承認付きで lockfile 非更新のまま install を完走させた。
- `pnpm-lock.yaml` と `generated/dependencies/dependency-registry.json` は変更していない。

## Source Organization Notes

- `packages/validator-core/src/index.ts` は barrel-only。
- check catalog、validation profile、summary、report schema、report builder、package schema validator、runtime load validator、package-runtime composition を責務別に分割した。
- Test は Wave 2 foundation の最小 integration を含むため 1 file にまとめたが、production logic は広い catch-all file にしていない。

## Dependency Follow-up Needed

- `packages/validator-core/package.json` に direct dependencies を追加した。
- 本 domain の指示に従い、`pnpm-lock.yaml` と `generated/dependencies/dependency-registry.json` は更新していない。
- Integration domain で `package-format` / `runtime-core` / `validator-core` の package manifest 変更をまとめて lockfile と dependency registry に同期する必要がある。

## Remaining Issues

- `ValidationReportSchema` と `RepairCandidateSchema` は Wave 2 foundation の DTO shape 固定まで。repair candidate 生成、operation-core 連携、AI dry-run mutation evidence は後続 wave の範囲。
- package schema parse issue は現時点で `pkg.schema.requiredFileMissing` に集約している。後続で reference / semantic validators を追加する際、missing file と invalid field の check ID 分離を再評価する余地がある。
- runtime validation は snapshot parse と empty draw list まで。representative evaluation orchestration と deterministic replay evidence validation は未実装。

## User-decision Points

- なし。

## Early Escape Triggers

- なし。

