# Wave43 Domain E Review: Evidence Naming Consistency Guard

## Verdict

`pass`

Independent Review-Sylph review found no blocking issues. The Domain E change is schema-preserving and limited to the active fixture manifest label plus the Domain E completion report. The fixture manifest now uses the catalog-backed validator diagnostic ID `portableBundle.digestMismatch`, while unsupported parser/archive/filesystem/renderer/pixel/Cubism/LLM/autofix/external transport and Product Preflight boundary language remains negative or explicitly bounded.

## Scope Reviewed

Changed files reviewed:

- `discussion/tests/fixtures/fixture-manifest.md`
- `discussion/implementation/waves/wave43/domain-e-evidence-naming-consistency-guard-report.md`

Relevant basis used:

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave43-plan.md`
- `discussion/design/module-contracts/validator-contract.md`
- `discussion/development_convention/diagnostic-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`
- `discussion/tests/traceability/test-traceability-matrix.md`
- `discussion/tests/fixtures/fixture-manifest.md`
- `packages/validator-core/src/check-catalog.ts`
- focused runtime/validator/report source files by search

## Lane 1: Evidence Naming / Contract Truthfulness Review

No blocking findings.

- `discussion/tests/fixtures/fixture-manifest.md:98` now records `validation=portableBundle.digestMismatch` for `wave36-portable-bundle-roundtrip-e2e`. That matches the validator catalog and synchronized docs: `packages/validator-core/src/check-catalog.ts:532`, `discussion/design/module-contracts/validator-contract.md:123`, `discussion/development_convention/diagnostic-policy.md:297`, and `discussion/tests/traceability/test-traceability-matrix.md:92`.
- Active checked validator/runtime/contract/traceability/fixture surfaces no longer contain `portableBundle.digest.mismatch`. The remaining broad-repository hits are either historical report/review prose or package-format/editor workflow issue-code vocabulary, for example `packages/package-format/src/portable-package-bundle.ts:33` and `apps/editor/e2e/portable-bundle-roundtrip-smoke.mjs`. I did not treat those as Domain E blockers because the reviewed fixture field is a validator `validation=` label, and renaming package-format/editor issue codes would be a source/schema behavior change outside this cleanup.
- Product Preflight wording remains bounded. `discussion/development_convention/schema-and-id-conventions.md:483` and `discussion/development_convention/diagnostic-policy.md:351` describe Product Preflight as session-generated read-only report/diff/read/rerun evidence, not a persisted/exported package artifact, release gate, demo gate, parser/archive/filesystem validator, renderer oracle, pixel oracle, or Cubism proof.
- Runtime/viewer evidence wording remains semantic. Representative source hits include `packages/runtime-core/src/product-preflight-runtime-bridge.ts:149` and `packages/runtime-core/src/product-preflight-runtime-bridge.ts:179`, which explicitly deny renderer and pixel evidence.
- Transport, byte-intake, portable bundle, Codex proposal, and tutorial readiness wording remains boundary-preserving. Representative lines include `discussion/design/module-contracts/validator-contract.md:306`, `discussion/design/module-contracts/validator-contract.md:307`, `discussion/design/module-contracts/validator-contract.md:451`, and `packages/validator-core/src/validators/byte-intake-preflight.ts:453`.

## Lane 2: Test Adequacy Review

No blocking findings.

The change is a one-line documentation label cleanup plus a report. No runtime/validator helper changed, so a new unit test is not required. The existing deterministic Wave43 checker reads the fixture manifest and verifies the canonical representative diagnostic token appears across the active documentation set. I also ran a direct stale-spelling scan because the checker verifies representative presence, not every possible stale-string absence.

Residual risk is low and acceptable for this scope: future reintroduction of `portableBundle.digest.mismatch` into an active validator-evidence doc would currently be caught by focused review or direct scan, not necessarily by the representative Wave43 checker alone.

## Orchestration Compliance

- Review was performed as a separate Review-Sylph gate using only the assignment prompt plus explicit basis docs/files; no full-history/fork-context basis was used.
- The wave plan requires Orch-Sylph to delegate implementation to Gnome and review to Review-Sylph. The Domain E completion report identifies the implementation as Gnome-completed, and this artifact is the separate review gate.
- Reviewer write scope was respected: no source, fixture, script, contract, traceability, or implementation report files were edited by this reviewer. Only this review report was written.
- The reviewed diff shows no schema-breaking rename, no package source changes, no fixture-wide churn, no dependency/manifest/lockfile change, and no product capability implementation.

## Verification Performed

Commands/checks run:

- `git status --short -uall`
- `git diff -- discussion/tests/fixtures/fixture-manifest.md discussion/implementation/waves/wave43/domain-e-evidence-naming-consistency-guard-report.md`
- `git diff --stat -- discussion/tests/fixtures/fixture-manifest.md discussion/implementation/waves/wave43/domain-e-evidence-naming-consistency-guard-report.md`
- `rg -n "portableBundle\.digestMismatch" ...` over active validator/runtime/script/contract/policy/traceability/fixture surfaces: pass, canonical ID found in expected active locations.
- `rg -n "portableBundle\.digest\.mismatch" ...` over active validator/runtime/script/contract/policy/traceability/fixture surfaces: pass, no matches.
- Broad `rg -n "portableBundle\.digest\.mismatch" discussion packages scripts`: classified remaining hits as historical prose or package-format/editor workflow issue-code vocabulary, not active validator diagnostic labels.
- Unsupported-capability wording scan over runtime-core, validator-core, scripts, active contracts/policies/traceability/fixture manifest, and Domain E report: pass, hits were negative, unsupported, non-goal, or guard contexts.
- `node scripts/check-wave43-validator-contract-coverage.mjs`: pass, 12 representative catalog IDs, 37 stable documentation tokens, 7 focused e2e boundary tokens.
- `node scripts/check-wave42-quality-gate-boundary.mjs`: pass, 5 categories, 19 focused e2e entries, 9 explicit non-goals.
- `node scripts/check-source-organization-fixtures.mjs`: pass, 4 cases.
- `git diff --check -- discussion/tests/fixtures discussion/implementation/waves/wave43 discussion/implementation/reviews/wave43 packages/validator-core packages/runtime-core scripts`: pass; Git emitted only the known LF-to-CRLF warning for `discussion/tests/fixtures/fixture-manifest.md`.

## Remaining Issues

None blocking.

Non-blocking integration note: `packages/package-format/src/portable-package-bundle.ts` and the Browser Editor e2e still use `portableBundle.digest.mismatch` as package-format/editor workflow issue-code vocabulary. That is separate from the validator diagnostic ID reviewed here. Unifying those names would be a source/schema behavior change and should not be folded into Domain E unless explicitly scoped.

## User-Decision Points

None.
