# Wave43 Domain D Fix-Loop 1 Re-Review: Validator Contract Coverage Checker

## Verdict

`pass`

Fix-loop 1 resolves prior blocking finding `D-001`. The checker still reads the validator contract / diagnostic policy / schema conventions / traceability / fixture documentation surfaces, but its hard documentation token set now passes against the `HEAD:` baseline of those files and no longer depends on concurrent Domain B/C worktree prose edits. Product Preflight report/diff version coverage moved to source-owned contract files, and Codex proposal coverage remains anchored in Domain A plus stable Wave40 traceability/fixture vocabulary.

## Scope Reviewed

Target files:

- `scripts/check-wave43-validator-contract-coverage.mjs`
- `discussion/implementation/waves/wave43/domain-d-validator-contract-coverage-checker-report.md`

Also inspected:

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave43-plan.md`
- `discussion/implementation/waves/wave43/domain-a-validator-evidence-coverage-matrix.md`
- `packages/validator-core/src/check-catalog.ts`
- `packages/contracts/src/product-preflight-report.ts`
- `packages/contracts/src/product-preflight-report-diff.ts`
- `packages/validator-core/src/product-preflight-report.ts`
- current and `HEAD:` versions of the docs/traceability/fixture files used by the checker

Known concurrent non-Domain-D changes are still present in B/C-owned documentation and orchestration files. I did not treat those as Domain D edits.

## Findings By Lane

### 1. Checker / Development Compliance Review

No blocking findings.

#### D-001 Re-Check: Fixed

Wave43 still defines Domain D as parallel with B/C after Domain A at `discussion/implementation/orchestration/wave43-plan.md:103`, so Domain D must be able to pass without relying on B/C worktree edits. I independently extracted `requiredStableDocTokens` from `scripts/check-wave43-validator-contract-coverage.mjs:91` and checked those tokens against `HEAD:` versions of:

- `discussion/design/module-contracts/validator-contract.md`
- `discussion/development_convention/diagnostic-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`
- `discussion/tests/traceability/test-traceability-matrix.md`
- `discussion/tests/fixtures/fixture-manifest.md`

Result:

```json
{
  "tokenCount": 37,
  "missingInHeadBaseline": [],
  "stillHardRequired": []
}
```

The four prior hidden-dependency tokens are no longer in the hard docs token array:

- `product-preflight-report-v0`
- `product-preflight-report-diff-v0`
- `not a persisted/exported package artifact`
- `Codex proposal`

The Domain D report also records the same fix direction at `discussion/implementation/waves/wave43/domain-d-validator-contract-coverage-checker-report.md:9` and `discussion/implementation/waves/wave43/domain-d-validator-contract-coverage-checker-report.md:35`.

#### Passing Observations

- Deterministic/local/dependency-free: the checker imports only Node built-ins and fixed repository files at `scripts/check-wave43-validator-contract-coverage.mjs:1` through `scripts/check-wave43-validator-contract-coverage.mjs:24`; it does not call network, browser, package managers, or external downloads. This matches the Wave43 deterministic checker constraint at `discussion/implementation/orchestration/wave43-plan.md:54`.
- Representative catalog coverage remains meaningful: the checker requires twelve representative IDs at `scripts/check-wave43-validator-contract-coverage.mjs:64` through `scripts/check-wave43-validator-contract-coverage.mjs:75`, and those IDs are registered in `packages/validator-core/src/check-catalog.ts:308`, `:380`, `:388`, `:476`, `:500`, `:532`, `:564`, `:580`, `:788`, `:820`, `:876`, and `:916`.
- Domain A matrix coverage remains explicit: the checker requires the Wave43 surface/non-goal tokens at `scripts/check-wave43-validator-contract-coverage.mjs:77`, and Domain A contains those targets and non-goals, including Product Preflight, Codex proposal, and no parser/archive/filesystem/renderer/Cubism/LLM/autofix/external transport work at `discussion/implementation/waves/wave43/domain-a-validator-evidence-coverage-matrix.md:13`, `:14`, `:20`, `:551`, `:552`, and `:616`.
- Product Preflight source mapping is checked through source-owned files: report schema tokens are checked at `scripts/check-wave43-validator-contract-coverage.mjs:131`, diff schema tokens at `:154`, and category mapping tokens at `:159`. The corresponding source lines include `packages/contracts/src/product-preflight-report.ts:503`, `packages/contracts/src/product-preflight-report.ts:504`, `packages/contracts/src/product-preflight-report-diff.ts:26`, `packages/contracts/src/product-preflight-report-diff.ts:598`, and `packages/validator-core/src/product-preflight-report.ts:568` through `:599`.
- Focused e2e boundary coverage remains explicit: the checker requires registry/list/check/dry-run non-coverage wording at `scripts/check-wave43-validator-contract-coverage.mjs:170` and checks it against traceability at `scripts/check-wave43-validator-contract-coverage.mjs:238`.
- `codexProposal.*` classification is handled in the safer direction: the checker does not require catalog registration; it only flags a conflict if docs classify it as proposal-local/result-local while catalog IDs are present at `scripts/check-wave43-validator-contract-coverage.mjs:246` through `:257`. `rg` found no `codexProposal.` check IDs in `packages/validator-core/src/check-catalog.ts`.
- Forbidden-scope edits were not observed for Domain D. `git status --short -uall --` over Domain D files, manifests, and related source-owned contract files showed only the Domain D checker/report and this review artifact. Existing B/C doc changes remain outside Domain D ownership.
- Forbidden-scope/product-claim wording in Domain D files is used as non-goal or "did not add" language, not as an implemented capability claim; see `discussion/implementation/waves/wave43/domain-d-validator-contract-coverage-checker-report.md:16`, `:71`, and `:82`.

### 2. Test Adequacy Review

No blocking findings.

The verification set is adequate for Domain D's narrow risk:

- the new checker exercises representative catalog, Domain A matrix, stable docs/traceability/fixtures, Product Preflight source mapping, focused e2e boundary wording, and `codexProposal.*` classification;
- `pnpm.cmd run check:source` covers source organization expectations for the new script;
- `pnpm.cmd run check:deps` and `node scripts/check-dependencies-guard-self-test.mjs` cover the no-new-dependency / forbidden dependency guard;
- Wave42 boundary and focused e2e registry/check commands confirm Domain D does not treat registry/list/check/dry-run operations as browser execution coverage;
- `git diff --check -- scripts packages/validator-core discussion/implementation/waves/wave43 discussion/implementation/reviews/wave43` passed with no whitespace output.

Residual risk: the checker is intentionally token-based and representative. It is not a semantic documentation parser, not a full catalog mirror, and not a browser e2e execution oracle. That residual risk is acceptable for the Wave43 Domain D purpose, which is representative drift detection, not exhaustive behavioral proof.

## Orchestration Compliance Review

`pass` with one provenance caveat.

- Gnome implementation / Review-Sylph separation is consistent with the subagent-call contract and the reported Gnome verification evidence. The repository files themselves do not encode actor identity, so I cannot prove authorship from file content alone.
- This re-review was performed in a clean Review-Sylph role, using basis documents, target files, direct commands, and `HEAD:` comparison rather than relying on the implementation explanation as the only source. This follows `discussion/implementation/orchestration/wave43-plan.md:258` and the Review-Sylph rules in `.agents/skills/implementation-orchestration/SKILL.md`.
- I wrote only this allowed review artifact under `discussion/implementation/reviews/wave43/**` and did not edit source, docs, scripts, tests, manifests, or lockfiles.
- The fix loop shrank the prior finding: `D-001` moved from blocking hidden dependency to independently verified pass.

## Independent Verification Performed

Sandboxed process startup failed locally with `windows sandbox: spawn setup refresh`, so reads and commands were rerun with approved escalation.

| Command / Check | Result |
| --- | --- |
| `node scripts/check-wave43-validator-contract-coverage.mjs` | pass: `12 representative catalog IDs, 37 stable documentation tokens, 7 focused e2e boundary tokens` |
| `HEAD:` baseline comparison for `requiredStableDocTokens` | pass: `37` tokens, `0` missing, prior four tokens not hard-required |
| `pnpm.cmd run check:source` | pass: `Source organization guard passed.` |
| `pnpm.cmd run check:deps` | pass: `Dependency guard passed.` |
| `node scripts/check-wave42-quality-gate-boundary.mjs` | pass: `5 categories, 19 focused e2e entries, 9 explicit non-goals` |
| `node scripts/check-source-organization-fixtures.mjs` | pass: `4 cases` |
| `node scripts/check-focused-e2e-registry.mjs` | pass: `19 entries, 14 aggregate-discoverable, 5 standalone direct` |
| `node scripts/run-focused-e2e.mjs --check` | pass: `19 entries` |
| `node scripts/check-dependencies-guard-self-test.mjs` | pass: `7 cases` |
| `git diff --check -- scripts packages/validator-core discussion/implementation/waves/wave43 discussion/implementation/reviews/wave43` | pass: no output |

## Remaining Issues

- No blocking Domain D issues remain.
- Residual risk is representative/token-based coverage, accepted for this domain.
- Future accepted changes that promote `codexProposal.*` into formal catalog-backed diagnostics should update `check-catalog.ts` and this checker together.

## User-Decision Points

None for Domain D.
