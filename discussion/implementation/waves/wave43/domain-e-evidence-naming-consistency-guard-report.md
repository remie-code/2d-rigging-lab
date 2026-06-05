# Wave43 Domain E Completion Report: Evidence Naming Consistency Guard

## Verdict

`pass`

Gnome implementation for Domain E completed and passed independent Review-Sylph review. The active runtime/viewer/validator evidence and Product Preflight wording scan did not require source wording changes. The one safe stale validator diagnostic label in the fixture manifest was corrected from `portableBundle.digest.mismatch` to canonical `portableBundle.digestMismatch`.

## Scope Changed

- Updated `discussion/tests/fixtures/fixture-manifest.md` line 98 so the Wave36 fixture manifest uses the catalog-backed validator diagnostic ID `portableBundle.digestMismatch`.
- Added this Domain E completion report under `discussion/implementation/waves/wave43/**`.

No source helper, public schema rename, fixture-wide churn, Product Preflight capability, parser/archive/filesystem/renderer/pixel/Cubism/LLM/autofix/external transport work, manifest change, lockfile change, or dependency change was made.

## Files Changed

- `discussion/tests/fixtures/fixture-manifest.md`
- `discussion/implementation/waves/wave43/domain-e-evidence-naming-consistency-guard-report.md`

## Basis Used

- `discussion/implementation/orchestration/wave43-plan.md`
- `discussion/implementation/waves/wave43/domain-a-validator-evidence-coverage-matrix.md`
- `discussion/implementation/waves/wave43/domain-a-validator-evidence-inventory-foundation-report.md`
- `discussion/implementation/waves/wave43/domain-b-validator-contract-prose-refresh-report.md`
- `discussion/implementation/waves/wave43/domain-c-diagnostic-policy-schema-traceability-sync-report.md`
- `discussion/implementation/waves/wave43/domain-d-validator-contract-coverage-checker-report.md`
- `discussion/implementation/reviews/wave43/domain-a-validator-evidence-inventory-foundation-review.md`
- `discussion/implementation/reviews/wave43/domain-b-validator-contract-prose-refresh-review.md`
- `discussion/implementation/reviews/wave43/domain-c-diagnostic-policy-schema-traceability-sync-review.md`
- `discussion/implementation/reviews/wave43/domain-d-validator-contract-coverage-checker-review.md`
- `discussion/design/module-contracts/validator-contract.md`
- `discussion/development_convention/diagnostic-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/tests/traceability/test-traceability-matrix.md`
- `discussion/tests/fixtures/fixture-manifest.md`
- `packages/validator-core/src/check-catalog.ts`
- Focused runtime/validator evidence and report source scans under `packages/runtime-core/src/**` and `packages/validator-core/src/**`.

The implementation-orchestration and subagent-context-hygiene skill files were provided in the task prompt. Direct shell reads of skill files and normal workspace reads hit the local sandbox startup issue `windows sandbox: spawn setup refresh`, so required read and verification commands were run with approved escalation.

## Evidence Wording Scan

Focused scan scope:

- `packages/runtime-core/src/**`
- `packages/validator-core/src/**`
- `scripts/**`
- active contract/policy/traceability/fixture surfaces for Wave43 diagnostic and Product Preflight wording

Risk terms scanned:

- Product Preflight durability/export/release/demo gate claims
- parser, image decode, archive/filesystem, File System Access, renderer, pixel oracle
- Cubism compatibility/oracle claims
- LLM/provider, natural-language repair, repair candidate generation/ranking, auto-fix, automatic commit, external transport
- stale `portableBundle.digest.mismatch`

Result:

- Runtime/validator source hits were negative or boundary-preserving wording, such as semantic evidence only, unsupported claims, `not_supported`, `not_evaluated`, `persistedArtifactCreated: false`, and tests that assert no parser/decode/archive/renderer/pixel claims.
- Product Preflight source wording remained bounded to session report/diff/read/rerun and targeted diagnostic/evidence refs.
- Runtime bridge wording explicitly says semantic runtime/state evidence only and no renderer/pixel oracle.
- Transport and byte-intake validator wording records unsupported/future/dependency-gated boundaries instead of implemented archive/filesystem/parser/decode capability.
- No source wording cleanup was required.

No new deterministic wording guard script was added. The existing Domain D checker is intentionally representative/token-based, and adding another script for this narrow pass would duplicate that guard without improving the evidence surface.

## Portable Bundle Diagnostic Name

Resolved for the active fixture manifest:

- `discussion/tests/fixtures/fixture-manifest.md:98` now uses `validation=portableBundle.digestMismatch`.

Post-fix active-surface scan:

```powershell
rg -n "portableBundle\.digest\.mismatch" packages\validator-core\src packages\runtime-core\src scripts discussion\tests\fixtures\fixture-manifest.md discussion\tests\traceability\test-traceability-matrix.md discussion\design\module-contracts\validator-contract.md discussion\development_convention\diagnostic-policy.md discussion\development_convention\schema-and-id-conventions.md
```

Result: pass, no matches.

Broader Wave43 report/review scan still finds the old spelling only in historical Domain C report/review prose that describes the prior finding and non-blocking follow-up. Those provenance notes were not changed because they are not active diagnostic labels.

## Verification Performed

| Command / check | Result |
| --- | --- |
| Evidence wording scan over runtime-core, validator-core, scripts, contract/policy/traceability/fixture active surfaces | pass; hits were negative/unsupported/boundary wording, not product capability claims |
| Active-surface stale diagnostic scan for `portableBundle.digest.mismatch` | pass; no matches |
| Canonical diagnostic confirmation scan for `portableBundle.digestMismatch` | pass; fixture, traceability, validator contract, diagnostic policy, check catalog, validator source, and Wave43 checker use the canonical ID |
| `node scripts/check-wave43-validator-contract-coverage.mjs` | pass: 12 representative catalog IDs, 37 stable documentation tokens, 7 focused e2e boundary tokens |
| `node scripts/check-wave42-quality-gate-boundary.mjs` | pass: 5 categories, 19 focused e2e entries, 9 explicit non-goals |
| `node scripts/check-source-organization.mjs` | pass |
| `node scripts/check-source-organization-fixtures.mjs` | pass: 4 cases |
| `node scripts/check-dependencies.mjs` | pass |
| `node scripts/check-dependencies-guard-self-test.mjs` | pass: 7 cases |
| `git diff --check -- packages/validator-core packages/runtime-core scripts discussion/tests/fixtures discussion/implementation/waves/wave43 discussion/implementation/reviews/wave43` | pass; Git reported the existing LF-to-CRLF working-copy warning for `discussion/tests/fixtures/fixture-manifest.md` only |
| `rg -n "[ \t]+$" discussion/implementation/waves/wave43/domain-e-evidence-naming-consistency-guard-report.md discussion/tests/fixtures/fixture-manifest.md` | pass; no trailing whitespace matches |

No focused unit test was added because no runtime/validator helper changed. The relevant focused check for this domain is the direct wording/naming scan plus the existing Wave42/Wave43 deterministic guards.

## Remaining Issues

- Independent Review-Sylph review passed and was written to `discussion/implementation/reviews/wave43/domain-e-evidence-naming-consistency-guard-review.md`.
- Historical Domain C report/review text still mentions `portableBundle.digest.mismatch` as the old value in prior-finding narrative. It is intentionally left as provenance and is not an active evidence label.
- `packages/package-format/src/portable-package-bundle.ts` and the Browser Editor e2e still use `portableBundle.digest.mismatch` as package-format/editor workflow issue-code vocabulary. That is separate from the validator diagnostic ID reviewed here; unifying those names would be a source/schema behavior change outside Domain E.
- No source wording issue remains from the Domain E scan.

## User-Decision Points

None.

## Review Outcome

Review-Sylph verdict: `pass`.

Review lanes:

- Evidence Naming / Contract Truthfulness Review: pass.
- Test Adequacy Review: pass.
- Orchestration Compliance: pass.
