# Wave40 Domain A: Codex Proposal API Contract Foundation

## Verdict

- Implementation verdict: `fixed`
- Date: 2026-06-04
- Domain: `wave40-codex-proposal-api-contract-foundation`

## Scope Implemented

- Added Codex-facing proposal DTOs for proposal receipt, operation sequence, package/preflight context, approval policy, and proposal evidence refs.
- Added operation catalog DTOs with deterministic operation entries, approval requirements, preview support flags, and required unsupported boundary records.
- Added proposal validation result, dry-run diff preview result, rerun validation / Product Preflight result, and approval/evidence response DTOs.
- Added an ai-interface proposal command contract surface as a separate schema family, without wiring it into the existing executable `ai-command-request-v1` host union.
- Fix loop: made operation catalog requests require unsupported boundary inclusion, matching the catalog response DTO that requires the full unsupported boundary set.
- Fix loop: added invalid guardrail tests for ready preview validity, preview-scoped rerun `previewId`, passing rerun Product Preflight report, and committed approval evidence refs.
- Second fix loop: made rerun validation top-level Product Preflight status match the embedded report summary status whenever a report is present.
- Second fix loop: added an invalid guardrail test for non-`valid` proposal validation results that incorrectly allow approval requests.

## Files Changed

- `packages/contracts/src/codex-proposal.ts`
- `packages/contracts/src/codex-proposal-operation-catalog.ts`
- `packages/contracts/src/codex-proposal-results.ts`
- `packages/contracts/src/codex-proposal-contract.test.ts`
- `packages/contracts/src/contracts-integration.test.ts`
- `packages/contracts/src/index.ts`
- `packages/ai-interface/src/ai-codex-proposal-command.ts`
- `packages/ai-interface/src/ai-codex-proposal-command.test.ts`
- `packages/ai-interface/src/index.ts`

## Verification

- `pnpm.cmd exec vitest run packages/contracts/src/codex-proposal-contract.test.ts packages/contracts/src/contracts-integration.test.ts packages/ai-interface/src/ai-codex-proposal-command.test.ts packages/ai-interface/src/ai-command-schema.test.ts`: pass, 4 files / 31 tests.
- `pnpm.cmd typecheck`: pass.
- `pnpm.cmd run check:source`: pass.
- Barrel-only check:
  - `packages/contracts/src/index.ts`: pass; export-only lines.
  - `packages/ai-interface/src/index.ts`: pass; export-only lines.
- Dependency manifest / lockfile diff check for `package.json`, `pnpm-lock.yaml`, `packages/contracts/package.json`, and `packages/ai-interface/package.json`: no output, no changes.
- `git diff --check -- packages/contracts/src packages/ai-interface/src discussion/implementation/waves/wave40`: pass; Git emitted LF-to-CRLF working-copy warnings only.

## Boundary Notes

- No Editor UI implementation was added.
- No repo-side proposal generation, repair candidate generation, candidate ranking, LLM provider, prompt, natural-language repair, auto-fix, or automatic commit was added.
- No diff execution, rerun validation execution, approval execution, external transport, parser/image/archive/render/Cubism behavior, dependency, manifest, or lockfile change was added.
- The proposal API command contract is intentionally separate from the existing executable AI command union because Editor host wiring is a later Wave40 domain and is outside Domain A write scope.

## Remaining Issues

- Independent Review-Sylph review is still required.
- Later Wave40 domains must implement catalog contents, proposal validation, dry-run diff preview, rerun validation, approval/transcript bridge, fixtures, UI, and e2e. Domain A only freezes DTO/schema shape.
- `discussion/design/module-contracts/validator-contract.md` still contains older repair-candidate prose; Domain A did not edit it because the source contract addition does not require validator contract prose changes, and Wave40 basis documents already constrain repo-side candidate generation as out of scope.

## User Decision Points

- None for Domain A implementation.
