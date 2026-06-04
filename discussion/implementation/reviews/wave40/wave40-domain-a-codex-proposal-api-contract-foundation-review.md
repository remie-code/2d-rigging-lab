# Wave40 Domain A Final Re-review: Codex Proposal API Contract Foundation

## verdict

`pass`

## scope reviewed

- `packages/contracts/src/codex-proposal.ts`
- `packages/contracts/src/codex-proposal-operation-catalog.ts`
- `packages/contracts/src/codex-proposal-results.ts`
- `packages/contracts/src/codex-proposal-contract.test.ts`
- `packages/contracts/src/contracts-integration.test.ts`
- `packages/contracts/src/index.ts`
- `packages/ai-interface/src/ai-codex-proposal-command.ts`
- `packages/ai-interface/src/ai-codex-proposal-command.test.ts`
- `packages/ai-interface/src/index.ts`
- `discussion/implementation/waves/wave40/domain-a-codex-proposal-api-contract-foundation-report.md`

## findings

No blocking, medium, or low-severity findings remain for Domain A.

## prior finding verification

- Fixed: operation catalog requests cannot suppress unsupported boundaries. `includeUnsupportedBoundaries` is `z.literal(true).default(true)` in `packages/ai-interface/src/ai-codex-proposal-command.ts:27`, with invalid coverage in `packages/ai-interface/src/ai-codex-proposal-command.test.ts:85`.
- Fixed: operation catalogs must include every required unsupported boundary via `CODEX_PROPOSAL_REQUIRED_UNSUPPORTED_BOUNDARY_KINDS` and the missing-boundary refinement in `packages/contracts/src/codex-proposal-operation-catalog.ts:12` and `packages/contracts/src/codex-proposal-operation-catalog.ts:210`; coverage is in `packages/contracts/src/codex-proposal-contract.test.ts:71`.
- Fixed: invalid guardrail tests now cover ready preview validity, missing ready preview package revision, preview-scoped rerun without `previewId`, passing rerun without Product Preflight report, and committed approval evidence refs in `packages/contracts/src/codex-proposal-contract.test.ts:150`, `packages/contracts/src/codex-proposal-contract.test.ts:167`, `packages/contracts/src/codex-proposal-contract.test.ts:187`, `packages/contracts/src/codex-proposal-contract.test.ts:207`, `packages/contracts/src/codex-proposal-contract.test.ts:260`, and `packages/contracts/src/codex-proposal-contract.test.ts:279`.
- Fixed: rerun validation status must match embedded Product Preflight `summary.status` when a report is present in `packages/contracts/src/codex-proposal-results.ts:242`; mismatch coverage is in `packages/contracts/src/codex-proposal-contract.test.ts:227`.
- Fixed: non-`valid` proposal validation results cannot set `canRequestApproval: true` in `packages/contracts/src/codex-proposal-results.ts:138`; invalid coverage is in `packages/contracts/src/codex-proposal-contract.test.ts:115`.

## verification performed

- `git status --short -uall`: reviewed before final review.
- Inspected current tracked diff and all listed untracked changed files.
- `pnpm.cmd exec vitest run packages/contracts/src/codex-proposal-contract.test.ts packages/contracts/src/contracts-integration.test.ts packages/ai-interface/src/ai-codex-proposal-command.test.ts packages/ai-interface/src/ai-command-schema.test.ts`: pass, 4 files / 31 tests.
- `pnpm.cmd typecheck`: pass.
- `pnpm.cmd run check:source`: pass.
- `git diff --check -- packages/contracts/src packages/ai-interface/src discussion/implementation/waves/wave40 discussion/implementation/reviews/wave40`: pass with LF-to-CRLF working-copy warnings only.
- Additional trailing-whitespace scan over untracked changed files: no matches.
- Manifest/lockfile status check for `package.json`, `pnpm-lock.yaml`, `packages/contracts/package.json`, `packages/ai-interface/package.json`, and `apps/editor/package.json`: no changes.
- Barrel-only check: `packages/contracts/src/index.ts:21` and `packages/ai-interface/src/index.ts:18` add re-exports only.
- Changed-file forbidden-scope scan found no implementation of repo-side proposal generation, repair generation/ranking, LLM/provider/prompt, natural-language repair, auto-fix, automatic commit, external transport, parser/image/archive/filesystem, renderer/pixel oracle, or Cubism behavior. Hits are unsupported-boundary names, false approval/commit flags, no-claim report wording, or baseline integration-test vocabulary.

## compliance notes

- The source change is additive and bounded to Codex-facing contract and ai-interface command schemas plus focused tests.
- The new proposal command schema remains separate from the existing executable `ai-command-request-v1` union; coverage confirms it is not host-wired yet.
- Approval and commit fields are approval-gated and truthful: automatic commit is fixed false, previews are `previewOnly: true` and `committed: false`, and committed evidence requires approval and commit evidence refs.

## fix loop

No Gnome fix loop remains required.

## remaining issues / user-decision points

- No Domain A user-decision point identified.
- `discussion/design/module-contracts/validator-contract.md` still contains older repair-candidate prose from earlier waves; Wave40 basis constrains repo-side candidate generation as out of scope, so this is not a Domain A blocker.
