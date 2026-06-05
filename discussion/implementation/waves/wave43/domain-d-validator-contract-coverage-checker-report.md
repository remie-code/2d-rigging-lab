# Wave43 Domain D Completion Report: Validator Contract Coverage Checker

## Verdict

`pass`

Domain D added a deterministic Node checker for representative drift between the validator check catalog, Wave43 Domain A coverage matrix, validator/docs/traceability surfaces, and Product Preflight category mapping. The checker is intentionally representative; it does not mirror the full catalog and does not claim browser coverage.

Fix loop 1 addressed review finding `D-001`: the checker no longer hard-requires post-B/C documentation tokens from `diagnostic-policy.md`, `schema-and-id-conventions.md`, or updated validator-contract prose. Hard documentation checks are limited to tokens that pass against the `HEAD` docs/traceability/fixture baseline plus Domain A artifacts. Product Preflight report/diff schema tokens are checked through source-owned contract files instead.

## Files Changed

- `scripts/check-wave43-validator-contract-coverage.mjs`
- `discussion/implementation/waves/wave43/domain-d-validator-contract-coverage-checker-report.md`

No package manifest, lockfile, dependency, validator implementation, contract prose, diagnostic policy prose, schema convention prose, traceability prose, fixture, Product Preflight capability, parser/archive/filesystem/renderer/Cubism/LLM/autofix/external transport, or product implementation change was made.

Final status also showed concurrent Wave43 changes in contract/policy/traceability/orchestration files outside Domain D ownership. Domain D did not edit those files and treated them as parallel upstream/domain work.

## Checker Command Introduced

```powershell
node scripts/check-wave43-validator-contract-coverage.mjs
```

The checker verifies:

- representative `check-catalog.ts` IDs for `byteAvailability.*`, `persistentByteStorage.*`, `portableBundle.*`, `transportCapability.*`, `mesh.*`, and `rigControl.warpLattice*`;
- Domain A matrix tokens for the eight Wave43 target surfaces and explicit non-goal boundaries;
- stable representative docs/traceability/fixture tokens for Wave31/Wave32/Wave34/Wave36/Wave38/Wave39/Wave40/Wave41 evidence rows;
- Product Preflight report and diff schema vocabulary through source-owned contract files, plus validator-core diagnostic-prefix category mapping;
- Wave42 focused e2e wording that registry/list/check/dry-run commands are not browser execution coverage;
- conditional `codexProposal.*` classification consistency only if current docs classify it as proposal-local/result-local, rather than requiring `check-catalog.ts` registration.

## D-001 Fix Summary

- Removed post-B/C-only documentation tokens from hard docs requirements: `product-preflight-report-v0`, `product-preflight-report-diff-v0`, `not a persisted/exported package artifact`, and exact `Codex proposal` prose.
- Kept equivalent drift coverage through stable surfaces:
  - `product-preflight-report-v0` is checked in `packages/contracts/src/product-preflight-report.ts`.
  - `product-preflight-report-diff-v0` is checked in `packages/contracts/src/product-preflight-report-diff.ts`.
  - persisted/exported artifact and release/demo gate boundaries are checked through Domain A matrix and Wave42 traceability/guard wording.
  - Codex proposal coverage is checked through Domain A matrix and stable Wave40 fixture/traceability vocabulary without requiring `check-catalog.ts` registration.
- Verified the remaining hard documentation tokens against `HEAD:` docs/traceability/fixture files to confirm the checker is independent of concurrent B/C doc edits.

## Verification

Normal sandboxed process startup failed earlier in this subagent run with `windows sandbox: spawn setup refresh`, so required local commands were run with approved escalation.

| Command | Result |
| --- | --- |
| `node scripts/check-wave43-validator-contract-coverage.mjs` | pass: `12 representative catalog IDs, 37 stable documentation tokens, 7 focused e2e boundary tokens` |
| `HEAD:` baseline token check for the remaining stable docs requirements | pass: `37 tokens` |
| `pnpm run check:source` | pass: `Source organization guard passed.` |
| `pnpm run check:deps` | pass: `Dependency guard passed.` |
| `node scripts/check-wave42-quality-gate-boundary.mjs` | pass: `5 categories, 19 focused e2e entries, 9 explicit non-goals` |
| `node scripts/check-source-organization-fixtures.mjs` | pass: `4 cases` |
| `node scripts/check-focused-e2e-registry.mjs` | pass: `19 entries, 14 aggregate-discoverable, 5 standalone direct` |
| `node scripts/run-focused-e2e.mjs --check` | pass: `19 entries` |
| `node scripts/check-dependencies-guard-self-test.mjs` | pass: `7 cases` |
| `git diff --check -- scripts packages/validator-core discussion/implementation/waves/wave43 discussion/implementation/reviews/wave43` | pass: no output |

## Remaining Issues

- The checker is representative by design. It does not replace full validator contract review or full catalog mirroring.
- If a future accepted Domain C/F decision promotes `codexProposal.*` to catalog-backed formal validator diagnostics, the checker and `check-catalog.ts` should be updated together. Current docs classify that surface as proposal-local/result-local vocabulary.

## User-Decision Points

None required for Domain D.

Future product priority decisions remain outside this domain: Product Preflight durability/export, release/demo gates, archive/filesystem work, real parser/decode, renderer/pixel oracle, public/demo assets, Cubism compatibility policy, repo-side repair generation/ranking, LLM/provider integration, natural-language repair, auto-fix, automatic commit, and external transport.

## Forbidden Scope / Product-Claim Avoidance

- Did not edit `discussion/design/module-contracts/validator-contract.md`.
- Did not edit `discussion/development_convention/diagnostic-policy.md`.
- Did not edit `discussion/development_convention/schema-and-id-conventions.md`.
- Did not edit `discussion/tests/traceability/test-traceability-matrix.md`.
- Did not edit package manifests or lockfiles.
- Did not add dependencies.
- Did not make broad validator implementation changes.
- Did not add Product Preflight persisted/exported artifact, release/demo gate, parser/archive/filesystem/renderer/pixel oracle/Cubism/LLM/autofix/external transport, or product capability claims.

## Provisional Assumptions

- Domain A remains the Wave43 foundation artifact for representative coverage targets.
- Current diagnostic/schema docs classify `codexProposal.*` preview/rerun check IDs and issue codes as proposal-local/result-local vocabulary, not current `check-catalog.ts` registrations.
- Wave42 focused e2e registry/list/check/dry-run commands remain metadata or selection checks only. Browser coverage is only claimed for exact selected non-dry commands that exit zero.
