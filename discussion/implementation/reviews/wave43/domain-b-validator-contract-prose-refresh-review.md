# Wave43 Domain B Review: Validator Contract Prose Refresh

## Verdict

`pass`

No Gnome fix loop is needed for Domain B.

The update to `discussion/design/module-contracts/validator-contract.md` truthfully reflects the Wave31-W42 validator diagnostics, Product Preflight, evidence, and report surfaces reviewed here. It keeps unsupported capability boundaries explicit, preserves topology/UV and warp lattice as semantic evidence only, and does not claim future or unsupported product capabilities.

## Scope Reviewed

- Changed target file: `discussion/design/module-contracts/validator-contract.md`
- Domain B completion artifact: `discussion/implementation/waves/wave43/domain-b-validator-contract-prose-refresh-report.md`
- Direct diff: `git diff -- discussion/design/module-contracts/validator-contract.md`
- Focused source reads/searches for check catalog, Product Preflight report/diff/read/rerun, byte/persistent storage, portable bundle/transport, topology/UV, warp lattice, and Codex proposal surfaces.

## Basis Documents Used

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave43-plan.md`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/remaining-work-backlog.md`
- `discussion/implementation/waves/wave42/wave42-final-report.md`
- `discussion/implementation/reviews/wave42/wave42-clean-integration-review.md`
- `discussion/implementation/waves/wave43/domain-a-validator-evidence-coverage-matrix.md`
- `discussion/implementation/waves/wave43/domain-a-validator-evidence-inventory-foundation-report.md`
- `discussion/implementation/reviews/wave43/domain-a-validator-evidence-inventory-foundation-review.md`
- `discussion/design/module-contracts/validator-contract.md`
- `discussion/development_convention/diagnostic-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`
- `packages/validator-core/src/check-catalog.ts`

## Findings By Review Lane

### 1. Contract Truthfulness / Design Compliance Review

Pass. No findings.

- The contract table now enumerates the Wave31-W42 byte/storage/bundle/transport families, and those IDs, phases, severities, profiles, and related ACs are backed by `packages/validator-core/src/check-catalog.ts` lines 260-601.
- `byteAvailability.*`, `persistentByteStorage.*`, `portableBundle.*`, and `transportCapability.*` prose stays within deterministic evidence boundaries. The text explicitly excludes parser/decode, archive/filesystem, renderer/pixel oracle, external transport, and Cubism capability claims.
- Persistent byte storage is correctly framed as same-origin browser-local IndexedDB evidence, matching `indexeddb-same-origin-browser-local-v1` in source/test evidence.
- Portable bundle wording correctly limits support to `portable-package-bundle-v0` / `project-defined-json-bundle-v0`, matching `packages/contracts/src/package-transport-capability.ts` and portable bundle validator evidence.
- Product Preflight is correctly described as an additive session-generated report/diff/read/rerun surface over targeted diagnostics/evidence refs. The source confirms category requirements and diagnostic mapping: `packages/validator-core/src/product-preflight-report.ts` lines 78-88 and 552-604; artifact vocabulary is in `packages/contracts/src/product-preflight-report.ts` lines 88-106.
- The contract correctly states that `assetBytes` maps `binary.*`, `byteAvailability.*`, `persistentByteStorage.*`, and binary rights/provenance diagnostics, while `persistenceTransport` maps `portableBundle.*` and `transportCapability.*`.
- The contract preserves semantic-only boundaries for mesh topology/UV and warp lattice. This matches the Domain A matrix guidance and source evidence for `mesh.*` and `rigControl.warpLattice*` diagnostics.
- Codex proposal wording is correctly limited to deterministic validation, preview, rerun validation, approval evidence, report refs, and Product Preflight bridge behavior. `codexProposal.*` exists in proposal preview/rerun result code, while `rg -n "codexProposal\\." packages/validator-core/src/check-catalog.ts` returned no matches; the contract therefore correctly treats it as proposal-local/report vocabulary unless later promoted.
- The prose does not claim Product Preflight persisted/exported artifacts, CI/release gate, demo gate, repo-side proposal generation, repair generation/ranking, LLM/provider integration, natural-language repair, auto-fix, automatic commit, parser/image decode, archive/filesystem implementation, renderer/pixel oracle support, external transport, or Cubism compatibility.

### 2. Test Adequacy / Evidence Adequacy Review

Pass. No findings.

- Domain B is prose-only and does not require source edits or new executable tests.
- The direct diff covers the requested contract refresh: purpose/scope, check table, semantic-only clarifications, Product Preflight hook, Codex proposal evidence surface, traceability, fixture table, and review checklist.
- Re-ran the supplied guard/whitespace evidence during review:
  - `git diff --check -- discussion/design/module-contracts/validator-contract.md discussion/implementation/waves/wave43 discussion/implementation/reviews/wave43`: pass; only the LF-to-CRLF warning for `validator-contract.md`.
  - `node scripts/check-wave42-quality-gate-boundary.mjs`: pass, `5 categories, 19 focused e2e entries, 9 explicit non-goals`.
  - `node scripts/check-source-organization.mjs`: pass.
  - `node scripts/check-dependencies.mjs`: pass.
- Focused `rg` scans confirmed required Domain B prose coverage for `byteAvailability`, `persistentByteStorage`, `portableBundle`, `transportCapability`, `meshTopologyUv`, `rigControlDynamics`, Product Preflight statuses, Codex proposal vocabulary, IndexedDB, project-defined JSON, semantic evidence, and unsupported boundaries.
- Full `pnpm` suites were not rerun. Given the docs-only change and successful source/guard checks, that is adequate for this review.

## Verification Evidence Reviewed

- Direct `git diff -- discussion/design/module-contracts/validator-contract.md`.
- Domain B completion report.
- `packages/validator-core/src/check-catalog.ts` check-family coverage.
- `packages/validator-core/src/product-preflight-report.ts` category evidence and diagnostic mapping.
- `packages/contracts/src/product-preflight-report.ts` Product Preflight artifact/status/category DTO vocabulary.
- Codex proposal contract/result/validation/preview/rerun/approval source searches.
- Domain A coverage matrix and inventory/review artifacts.
- Wave42 final and clean integration review non-goal boundaries.

Sandboxed process startup failed with `windows sandbox: spawn setup refresh`, so read-only review commands were run with approved escalation. No implementation/source/policy/schema/traceability files were edited by this reviewer.

## Orchestration Compliance

Pass.

- The prompt supplied a clean Review-Sylph context, explicit basis documents, changed files, review lanes, and write scope.
- The implementation report identifies Gnome as the implementation agent and this artifact is an independent Review-Sylph report.
- I did not rely on the Gnome completion report as the only basis; I inspected the target file, direct diff, basis docs, and source evidence directly.
- Orch-Sylph supplied verification evidence and did not ask the reviewer to infer from full conversation history.
- This reviewer wrote only this review artifact under `discussion/implementation/reviews/wave43/**`.
- Scoped `git status` showed parallel Domain C/D modifications/artifacts in the workspace. They are outside this Domain B review and do not indicate a Domain B scope violation.

## Remaining Issues

None for Domain B.

Domain C/D still own diagnostic policy, schema/id convention, traceability, and checker synchronization, including any future decision to promote `codexProposal.*` into catalog-backed validator diagnostics.

## User-Decision Points

None for Domain B.

Future product decisions remain outside this domain: Product Preflight durability/export, release/demo gates, archive/filesystem support, real parser/decode, renderer/pixel oracle, external transport, LLM/provider/repair generation, public/demo assets, and Cubism policy reconsideration.
