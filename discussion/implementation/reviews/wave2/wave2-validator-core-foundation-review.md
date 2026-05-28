# Wave 2 Validator Core Foundation Review

> Review target: `wave2-validator-core-foundation`  
> Review role: Review-Sylph  
> Review date: 2026-05-29  
> Verdict: `pass`

## Reviewed Files / Basis

- `discussion/implementation/orchestration/wave2-plan.md`
- `discussion/design/module-contracts/validator-contract.md`
- `discussion/design/module-contracts/package-file-format-contract.md`
- `discussion/design/module-contracts/runtime-core-contract.md`
- `discussion/design/module-contracts/module-boundaries.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/implementation/waves/wave2/wave2-validator-core-foundation-completion.md`
- `packages/validator-core/src/**`
- public exports:
  - `packages/contracts/src/index.ts`
  - `packages/package-format/src/index.ts`
  - `packages/runtime-core/src/index.ts`

## Findings

### Warning: summary aggregation is not yet profile-aware

- Evidence: `packages/validator-core/src/validation-summary.ts:42`-`45` derives report status from severity as well as check status.
- Evidence: profile config exists in `packages/validator-core/src/validation-profile.ts:19`-`49`, but `buildValidationReport` / `aggregateValidationSummary` do not consume profile fail policy.
- Basis: `discussion/design/module-contracts/validator-contract.md:154`-`156` defines profile-specific behavior, and `discussion/design/module-contracts/validator-contract.md:185` states that severity describes impact while status describes outcome in a profile.
- Impact: current Wave 2 checks all emit blocking fail for representative invalid cases, so required behavior is covered. Later warning/error checks may need explicit profile-aware status mapping to avoid treating severity as the profile outcome.
- Verdict impact: non-blocking for this foundation; track before broader validator profiles are implemented.

### Warning: validator test file is a compact integration test but fixture-heavy

- Evidence: `packages/validator-core/src/validator-core.test.ts:38` starts a single suite covering catalog, summary, report, package/runtime pass, and invalid cases; inline fixture builders begin at `packages/validator-core/src/validator-core.test.ts:156` and `packages/validator-core/src/validator-core.test.ts:329`.
- Basis: `discussion/development_convention/source-file-organization-policy.md:71`-`73` says tests should mirror source responsibility and large all-in-one test files are a warning unless they are small integration tests.
- Impact: acceptable for Wave 2 because production source is split and the file functions as a minimal integration smoke test. If Domain D adds shared contract fixtures, move or share the minimal package/runtime fixture instead of growing this file further.
- Verdict impact: non-blocking.

### Info: dependency follow-up is correctly recorded

- Evidence: `packages/validator-core/package.json:9`-`14` adds direct dependencies on contracts, package-format, runtime-core, and zod.
- Evidence: `pnpm-lock.yaml:33` still has an empty `packages/validator-core` importer, and `generated/dependencies/dependency-registry.json:28`-`33` has not expanded zod scope beyond the prior registry entry.
- Evidence: completion report records this as integration follow-up at `discussion/implementation/waves/wave2/wave2-validator-core-foundation-completion.md:93`-`97`.
- Verdict impact: non-blocking per review rubric; integration domain must synchronize lockfile and dependency registry.

## Test Adequacy Assessment

Assessment: `pass`.

- Required catalog coverage exists in `packages/validator-core/src/validator-core.test.ts:39`-`45`.
- Empty summary pass coverage exists in `packages/validator-core/src/validator-core.test.ts:48`-`58`.
- Blocking/error fail summary coverage exists in `packages/validator-core/src/validator-core.test.ts:61`-`84`.
- Minimal package plus runtime pass report coverage exists in `packages/validator-core/src/validator-core.test.ts:87`-`127`.
- Representative invalid missing package field and empty runtime draw list coverage exists in `packages/validator-core/src/validator-core.test.ts:130`-`152`.

Verification run:

| Command | Result |
|---|---|
| `pnpm.cmd exec vitest run packages/validator-core/src` | sandbox 内は `vitest.mjs` EPERM。承認済み外部実行で pass。1 file / 5 tests pass。 |
| `pnpm.cmd check:source` | pass。`Source organization guard passed.` |
| `pnpm.cmd check:deps` | pass。`Dependency guard passed.` |
| `pnpm.cmd typecheck` | sandbox 内は `tsc` EPERM。承認済み外部実行で pass。 |
| `git diff --check -- packages/validator-core discussion/implementation/waves/wave2/wave2-validator-core-foundation-completion.md` | pass。LF/CRLF warning のみ。 |
| private/forbidden import search | no private subpath imports and no operation-core integration detected. Matches were limited to public package imports and repair candidate DTO fields. |

## Source Organization Assessment

Assessment: `pass`.

- `packages/validator-core/src/index.ts:1`-`9` is barrel-only.
- Production responsibilities are split by concern:
  - check catalog: `packages/validator-core/src/check-catalog.ts`
  - validation profile: `packages/validator-core/src/validation-profile.ts`
  - summary aggregation: `packages/validator-core/src/validation-summary.ts`
  - report schema: `packages/validator-core/src/validation-report.ts`
  - report builder: `packages/validator-core/src/report-builder.ts`
  - package schema validator: `packages/validator-core/src/validators/package-schema.ts`
  - runtime snapshot validator: `packages/validator-core/src/validators/runtime-load.ts`
  - package/runtime composition: `packages/validator-core/src/validators/package-runtime.ts`
- No catch-all production implementation file was found.
- `validator-core` imports public package entrypoints only:
  - `@private-2d-rigging-lab/contracts`
  - `@private-2d-rigging-lab/package-format`
  - `@private-2d-rigging-lab/runtime-core`

## Scope Assessment

Assessment: `pass`.

- Implemented scope matches Wave 2 Domain C: check catalog, validation profile, summary aggregation, report builder, minimal package schema validation, and runtime snapshot draw-list validation.
- No acceptance runner, GUI operation evidence validation implementation, repair automation, operation-core integration, renderer integration, package IO, or private runtime/package implementation dependency was found.
- `RepairCandidateSchema` and report fields are DTO shape only; no repair generation or operation execution is implemented.

## Remaining Risks

- Profile-aware summary/status mapping should be revisited before introducing broader strict/viewer/acceptance semantic checks.
- Minimal fixture data currently lives inline in `validator-core.test.ts`; Domain D should prefer reusable fixtures or smaller test helpers if it expands coverage.
- Lockfile and dependency registry are intentionally out of sync with new package manifests until the integration domain updates them.

## User-decision Points

- None.

