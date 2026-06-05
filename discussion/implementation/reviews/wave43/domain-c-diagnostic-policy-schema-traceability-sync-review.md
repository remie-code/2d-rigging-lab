# Wave43 Domain C Review: Diagnostic Policy / Schema / Traceability Sync

## Verdict

`pass`

Fix Loop 1 resolved the prior `needs_changes` finding. The Wave36 traceability row now records the catalog-backed validator diagnostic as `portableBundle.digestMismatch`, matching the validator catalog, validator contract, diagnostic policy, and Domain A matrix.

## Review Scope

Role: Review-Sylph independent reviewer for Wave43 Domain C re-review after Gnome fix loop 1.

I used only the explicit re-review task text and repository files. I did not use `fork_context`, did not ask the user directly, and did not edit implementation target files. This report is the only file updated by this re-review.

Files reviewed:

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave43-plan.md`
- `discussion/implementation/waves/wave43/domain-a-validator-evidence-coverage-matrix.md`
- `discussion/implementation/waves/wave43/domain-c-diagnostic-policy-schema-traceability-sync-report.md`
- `discussion/design/module-contracts/validator-contract.md`
- `discussion/development_convention/diagnostic-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`
- `discussion/tests/traceability/test-traceability-matrix.md`
- `discussion/tests/fixtures/fixture-manifest.md`
- `packages/validator-core/src/check-catalog.ts`
- Relevant schema/source references under `packages/contracts/src`, `packages/package-format/src`, `packages/validator-core/src`, `packages/operation-core/src`, `packages/ai-interface/src`, and `apps/editor/e2e` for ID grounding.

## Prior Finding Resolution

Status: `resolved`.

Prior finding C-TRACE-001 was that `discussion/tests/traceability/test-traceability-matrix.md:92` listed `portableBundle.digest.mismatch` in the expected diagnostics column for `TC-WAVE36-PORTABLE-BUNDLE-ROUNDTRIP-E2E-001`. The row now lists `portableBundle.digestMismatch` at `discussion/tests/traceability/test-traceability-matrix.md:92`.

Independent scan in the required checked scope found only `portableBundle.digestMismatch` in:

- `discussion/tests/traceability/test-traceability-matrix.md:92`
- `discussion/development_convention/diagnostic-policy.md:297`
- `discussion/development_convention/diagnostic-policy.md:347`
- `packages/validator-core/src/check-catalog.ts:532`
- `discussion/implementation/waves/wave43/domain-a-validator-evidence-coverage-matrix.md:232`

The old `portableBundle.digest.mismatch` value remains outside the Domain C checked scope as package-format/editor workflow issue-code vocabulary, for example in `packages/package-format/src/portable-package-bundle.ts` and `apps/editor/e2e/portable-bundle-roundtrip-smoke.mjs`. That is not a Domain C pass blocker because the traceability expected diagnostics column now points to the validator diagnostic ID.

## Lane 1: Diagnostic / Schema Convention Compliance

Status: `pass`.

The diagnostic policy namespace coverage remains aligned with Wave43's stated purpose to synchronize `diagnostic-policy.md`, `schema-and-id-conventions.md`, and traceability rows with current check IDs and evidence labels (`discussion/implementation/orchestration/wave43-plan.md:164`). The namespace additions in `diagnostic-policy.md:116` and the representative formal entries at `diagnostic-policy.md:295` through `diagnostic-policy.md:301` match catalog-backed validator families.

Product Preflight remains correctly documented as report/category/status vocabulary over targeted diagnostics and evidence refs, not as a `productPreflight.*` check family (`discussion/development_convention/diagnostic-policy.md:351`, `discussion/development_convention/schema-and-id-conventions.md:483`). This matches the source/contract boundary for category/status/artifact vocabulary and does not claim persisted/exported Product Preflight artifacts, release gates, demo gates, parser/archive/filesystem validation, renderer or pixel oracle behavior, Cubism compatibility, LLM, or auto-fix behavior.

Codex proposal vocabulary remains correctly bounded as proposal-local/result-local rather than catalog-backed formal validator diagnostics (`discussion/development_convention/diagnostic-policy.md:352`, `discussion/development_convention/schema-and-id-conventions.md:484`). That matches `discussion/design/module-contracts/validator-contract.md:447` and the absence of a `codexProposal.*` family in `packages/validator-core/src/check-catalog.ts`.

Transport capability and portable bundle schema vocabulary in `schema-and-id-conventions.md:481` through `schema-and-id-conventions.md:482` remains aligned with source-owned schema values and unsupported-boundary wording.

## Lane 2: Traceability Adequacy

Status: `pass`.

The required traceability fix is present. `TC-WAVE36-PORTABLE-BUNDLE-ROUNDTRIP-E2E-001` now uses `portableBundle.digestMismatch` in the expected diagnostics column, so validator diagnostic traceability matches the current catalog-backed check ID.

The persistent byte storage traceability note remains adequate for this pass. Domain A left Domain C to choose a narrow note or row for existing persistent restore evidence, and the note at `discussion/tests/traceability/test-traceability-matrix.md:63` through `discussion/tests/traceability/test-traceability-matrix.md:69` keeps the evidence boundary to same-origin browser-local byte restore evidence without native filesystem persistence, cloud/cross-profile durability, parser/decode, archive/filesystem support, renderer/pixel evidence, Cubism compatibility, persisted/exported Product Preflight artifacts, release gates, or demo gates.

No broad traceability rewrite, fixture churn, source edit, validator-contract edit, or product capability claim was introduced.

## Orchestration Compliance

Status: `pass`.

- Gnome and Review-Sylph separation is preserved by separate implementation and review artifacts; this re-review did not act as implementer for Domain C target files.
- No `fork_context` was used by this reviewer.
- The re-review is grounded in the explicit task, repository diff, basis docs, source/catalog references, and verification evidence, not the implementer's report alone.
- Domain C changes remain within its allowed implementation scope: `diagnostic-policy.md`, `schema-and-id-conventions.md`, `test-traceability-matrix.md`, and the Domain C wave report. This reviewer updated only the allowed review report.
- Parallel Domain B/D changes visible in `git status` were not reverted or attributed to Domain C.

## Verification

Performed by this reviewer:

- Read the implementation-orchestration and subagent-context-hygiene skill files.
- Inspected `git status --short -uall`.
- Inspected the actual diff for the Domain C target files and this review report.
- Searched the required Domain C checked scope for `portableBundle.digest.mismatch|portableBundle.digestMismatch`; only `portableBundle.digestMismatch` appears in the checked scope.
- Re-read `discussion/tests/traceability/test-traceability-matrix.md:92` and confirmed the expected diagnostics column uses `portableBundle.digestMismatch`.
- Re-checked Product Preflight and Codex proposal boundary wording against source/catalog references.

Relied on supplied Orch-Sylph verification evidence:

- `node scripts/check-wave42-quality-gate-boundary.mjs`: pass.
- `node scripts/check-source-organization.mjs`: pass.
- `node scripts/check-dependencies.mjs`: pass.
- `git diff --check -- discussion/development_convention discussion/tests/traceability discussion/implementation/waves/wave43 discussion/implementation/reviews/wave43`: exit 0, with only LF-to-CRLF working-copy warnings for touched markdown files.

Normal shell sandbox execution failed previously with `windows sandbox: spawn setup refresh`; read and verification commands in this re-review were run escalated as permitted by the task context.

## Remaining Issues

No remaining Domain C pass blockers.

Non-blocking follow-up for Orch-Sylph/integration: `discussion/tests/fixtures/fixture-manifest.md:98` still uses `validation=portableBundle.digest.mismatch`. That file is outside Domain C's implementation target scope. If the manifest field is intended to record validator diagnostics, align it to `portableBundle.digestMismatch` in a separately scoped pass; if it records package-format/editor workflow issue-code vocabulary, label that distinction explicitly.

## User-Decision Points

None.
