# Wave40 Domain B Review: Operation Catalog / Proposal Validation

## Verdict

- Review verdict: `pass`
- Date: 2026-06-04
- Reviewer: Review-Sylph independent clean-context reviewer
- Target: `wave40-operation-catalog-proposal-validation`
- Latest re-review: source/test findings and report-only documentation consistency finding are fixed.

## Scope Reviewed

- Basis docs:
  - `discussion/implementation/orchestration/wave40-plan.md`
  - `discussion/implementation/waves/wave40/domain-a-codex-proposal-api-contract-foundation-report.md`
  - `discussion/implementation/reviews/wave40/wave40-domain-a-codex-proposal-api-contract-foundation-review.md`
  - `discussion/implementation/current-capability-map.md`
  - `discussion/implementation/remaining-work-backlog.md`
  - `discussion/implementation/waves/wave39/wave39-final-report.md`
  - `discussion/implementation/reviews/wave39/wave39-clean-integration-review.md`
  - `discussion/development_convention/source-file-organization-policy.md`
  - `discussion/development_convention/dependency-policy.md`
  - `discussion/development_convention/schema-and-id-conventions.md`
  - `discussion/design/module-contracts/validator-contract.md`
- Contract / command basis:
  - `packages/contracts/src/codex-proposal.ts`
  - `packages/contracts/src/codex-proposal-operation-catalog.ts`
  - `packages/contracts/src/codex-proposal-results.ts`
  - `packages/ai-interface/src/ai-codex-proposal-command.ts`
- Domain B files:
  - `packages/ai-interface/src/ai-codex-proposal-operation-catalog.ts`
  - `packages/ai-interface/src/ai-codex-proposal-validation.ts`
  - `packages/ai-interface/src/ai-codex-proposal-validation.test.ts`
  - `packages/ai-interface/src/index.ts`
  - `discussion/implementation/waves/wave40/wave40-domain-b-operation-catalog-proposal-validation-report.md`

## Fix Loop Re-review

- Prior high finding status: fixed.
- Prior medium finding status: fixed.
- Report-only finding status: fixed.

## Original Findings and Fix Verification

### Fixed High: catalog targetKinds are now aligned for reviewed operations

Original finding: `getCodexProposalOperationCatalog()` previously advertised `addKeyform` as available with `targetKinds: ["drawable", "rigControl", "parameter"]`, while existing operation-core target conversion accepts `"drawable"`, `"mesh"`, and `"rigControl"` and rejects other kinds in `packages/operation-core/src/operations/add-keyform.ts:178`. Existing operation-core coverage also dry-runs `addKeyform` on a mesh target in `packages/operation-core/src/operations/add-keyform.test.ts:36`.

Domain B validation then uses catalog `targetKinds` as the allowed set for `operation.targetRefs` in `packages/ai-interface/src/ai-codex-proposal-validation.ts:333`, without checking the operation payload target against the same operation-specific target oracle. This can make a real mesh-target `addKeyform` proposal fail catalog target validation, while a proposal that lists only a parameter targetRef can pass target-ref validation even though the actual payload target may be different.

A second concrete mismatch was `setRuntimeVisibility`: the catalog previously advertised drawable, part, rigControl, dynamicsGroup, and maskRelation target kinds, but the existing handler explicitly accepts only drawable refs in `packages/operation-core/src/operations/set-runtime-visibility.ts:112`. Because the payload schema only requires a generic `TargetRef` for this operation, Domain B could mark non-drawable visibility proposals valid and approval-ready when preflight is pass.

This violates the Domain B requirement that the operation catalog be truthful/useful to Codex and that proposal validation check catalog/target refs deterministically before preview or approval.

Recommended fix: align each available catalog entry's target semantics with the actual operation payload/handler contract, and add validation/tests that cover at least one positive mesh-target keyform case and one negative non-drawable `setRuntimeVisibility` case. If `targetKinds` is intended as "touched target kinds" rather than allowed primary target kinds, introduce a separate explicit primary-target descriptor instead of using `targetKinds` for validation.

Fix-loop verification: fixed. The current catalog has `addKeyform` target kinds `["drawable", "mesh", "rigControl"]` at `packages/ai-interface/src/ai-codex-proposal-operation-catalog.ts:166`, `addKeyformGrid2d` target kinds `["drawable", "mesh", "rigControl"]` at `packages/ai-interface/src/ai-codex-proposal-operation-catalog.ts:182`, and `setRuntimeVisibility` target kinds `["drawable"]` at `packages/ai-interface/src/ai-codex-proposal-operation-catalog.ts:470`. Focused tests now assert these catalog entries at `packages/ai-interface/src/ai-codex-proposal-validation.test.ts:45`, and cover a valid mesh `addKeyform` plus invalid non-drawable `setRuntimeVisibility` at `packages/ai-interface/src/ai-codex-proposal-validation.test.ts:227`.

### Fixed Medium: focused tests now cover required Product Preflight status matrix

`packages/ai-interface/src/ai-codex-proposal-validation.test.ts` covers valid pass context, missing preflight context, unsupported catalog operation, warning preflight gating, target-ref mismatch, payload/schema failures, and malformed proposal data. It does not directly cover supplied Product Preflight `fail`, `not_supported`, or explicit `not_evaluated` statuses, even though the review assignment requires coverage for `preflight fail/not_supported/not_evaluated/warn/user-decision gating`.

The implementation has branches for these statuses in `packages/ai-interface/src/ai-codex-proposal-validation.ts:202`, but without focused tests a regression could convert one of these statuses into previewable or approval-ready output.

Recommended fix: add focused tests for supplied `fail`, `not_supported`, and `not_evaluated` Product Preflight reports, asserting status, issue code, `canPreview: false`, `canRequestApproval: false`, and `approvalGate.approvalReady: false`.

Fix-loop verification: fixed. The current tests use a table for supplied Product Preflight `fail`, `not_supported`, and `not_evaluated`, and assert non-previewable / non-approval-ready results at `packages/ai-interface/src/ai-codex-proposal-validation.test.ts:179`.

## Report-only Fix Verification

### Fixed Low: implementation report stale typecheck limitation text removed

Original report-only finding: `discussion/implementation/waves/wave40/wave40-domain-b-operation-catalog-proposal-validation-report.md:40` reported the focused ai-interface tests pass as 2 files / 16 tests, and `discussion/implementation/waves/wave40/wave40-domain-b-operation-catalog-proposal-validation-report.md:42` reported `pnpm.cmd typecheck` pass. The report then also had a stale former line 56 saying full typecheck needed parallel Domain C type errors resolved before it could pass globally.

I independently reran `pnpm.cmd typecheck` during this re-review and it passed. The stale line should be removed or updated so the persistent Domain B report does not contradict the verified final state.

Final short re-review verification: fixed. The implementation report now ends its remaining-issues section with only `No Domain B user-decision point identified.` at `discussion/implementation/waves/wave40/wave40-domain-b-operation-catalog-proposal-validation-report.md:55`, and the stale typecheck limitation no longer appears. A targeted search for stale Domain C/typecheck-limitation wording in the report found only the valid `pnpm.cmd typecheck`: pass line.

## Passing Checks / Compliance Notes

- Domain A shared contract files were read as basis; Domain B did not rewrite Domain A contracts in the inspected target scope.
- Catalog output is deterministic by default: `generatedAt` is omitted unless supplied, operations are sorted, target/input arrays are sorted, and unsupported boundaries include the Domain A required boundary kinds.
- Unsupported operation catalog entries are represented as unsupported entries with false preview support and blocking unsupported boundary records, not as fake repair actions.
- Validation result construction keeps non-`valid` statuses non-previewable and non-approval-ready in `packages/ai-interface/src/ai-codex-proposal-validation.ts:443`.
- `packages/ai-interface/src/index.ts` remains barrel-only; its diff only adds three export lines.
- No package manifest or lockfile changes were present in current `git status`.
- Forbidden-scope scan hits in Domain B files are unsupported-boundary/catalog truthfulness text and report no-claim wording, not implementation of repo-side proposal generation, repair generation/ranking, LLM/provider/prompt, natural-language repair, auto-fix, automatic commit, external transport, parser/image/archive/filesystem, renderer/pixel oracle, or Cubism behavior.

## Verification Performed

- `git status --short -uall`: Domain B files are new/untracked except `packages/ai-interface/src/index.ts`; Domain C files under `packages/operation-core/src/**` and `packages/validator-core/src/**` are also present and were treated as out of scope except for verification reporting.
- `pnpm.cmd exec vitest run packages/ai-interface/src/ai-codex-proposal-validation.test.ts packages/ai-interface/src/ai-codex-proposal-command.test.ts`: pass, 2 files / 16 tests.
- `pnpm.cmd run check:source`: pass.
- `pnpm.cmd typecheck`: pass.
- `git diff --check -- packages/ai-interface/src discussion/implementation/waves/wave40`: pass; CRLF warning only for `packages/ai-interface/src/index.ts`.
- Targeted forbidden-scope scan over Domain B files: no implementation-scope violation found.
- `git diff -- packages/ai-interface/src/index.ts`: barrel-only export additions.

## Fix Loop Required

No.

## Remaining Issues / User-Decision Points

- No Domain B user-decision point identified.
- Source/test prior findings are fixed.
- Report-only stale typecheck limitation finding is fixed.
