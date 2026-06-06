# Wave48 Domain C Review: Package / Operation Import Plan Approval Bridge

> Target: `wave48-package-operation-import-plan-approval-bridge`
> Reviewed report: `discussion/implementation/waves/wave48/wave48-domain-c-package-operation-import-plan-approval-bridge-report.md`
> Role: Review-Sylph independent clean review
> Verdict: `pass`

## Verdict

`pass`

No blocking design/development-compliance or test-adequacy finding was found. The implementation adds parser-free import plan candidate and approval evidence shapes to package-format and operation-core, wires optional approval-bridge evidence into the existing Wave47 batch materialization operation, and preserves bridge-less Wave47 batch behavior.

This review does not approve Editor UI, browser parser candidate discovery, validator/Product Preflight diagnostics, all-layer one-click import, recursive group auto import, drag-drop, archive/filesystem access, full compositing, renderer/pixel/texture correctness oracles, Cubism compatibility, public demo assets, repo-side AI/LLM behavior, or auto-fix behavior.

## Findings

### Blocking Findings

None.

### Non-Blocking Findings

- C-N1: The Domain C implementation report's full-suite failure note is stale in the current worktree. It records `pnpm.cmd typecheck` and `pnpm.cmd test:unit` as failing in out-of-scope `apps/editor/**` files at `discussion/implementation/waves/wave48/wave48-domain-c-package-operation-import-plan-approval-bridge-report.md:97`, `:98`, `:102`, and `:107`. I reran both commands during this review and both pass now. This is not a Domain C source blocker, but later integration bookkeeping should use this review's current verification evidence or update the Domain C report before final Wave48 status is summarized.

## Scope Reviewed

- Required basis documents listed in the assignment, including the Wave48 plan, current capability map, backlog, Domain A report/review, Wave47 final report/review, development policies, fixture manifest, and traceability matrix.
- Relevant Wave45 Domain C, Wave46 Domain C, and Wave47 Domain C/F/H reports/reviews for parser-free PSD evidence, materialized raw RGBA asset boundaries, batch intake behavior, and focused persistence evidence.
- Direct diff requested by the assignment and direct reads of untracked new files that `git diff` does not show.
- Changed package-format and operation-core source/test files plus the Domain C implementation report.

## Design / Development Compliance

- Pass: package-format now owns a parser-free import plan schema family in `packages/package-format/src/psd-import-plan-evidence.ts`. It records candidate statuses, source PSD identity with `sourceBytePersistence: "metadataOnlyNoRawBytes"` and `publicDemoAsset=false`, candidate plan evidence, approval evidence, and bridge evidence (`packages/package-format/src/psd-import-plan-evidence.ts:26`, `:42`, `:120`, `:182`, `:212`).
- Pass: `LayeredCharacterPsdProfileSchema` is extended additively with optional import plan candidate/approval evidence arrays; no existing PSD profile fields are renamed or removed (`packages/package-format/src/source-manifest.ts:227`).
- Pass: operation-core has a local parser-free approval bridge schema instead of importing package-format or a PSD parser. The batch payload and batch operation evidence carry `importPlanBridge` as optional additive evidence (`packages/operation-core/src/payloads/import-source.ts:355`, `packages/operation-core/src/psd-layer-materialization-batch-operation-evidence.ts:74`).
- Pass: source organization is compliant. `packages/operation-core/src/index.ts` adds only a barrel re-export, while bridge diagnostics live in the named operation helper file (`packages/operation-core/src/index.ts:10`, `packages/operation-core/src/operations/import-psd-layer-materialization-batch-import-plan.ts:42`).
- Pass: only approved ordered leaf refs are connected to the existing Wave47 batch path. The batch operation builds planned entries from request entries, runs import-plan diagnostics before cloning for child mutation, and keeps rejected results pre-mutation (`packages/operation-core/src/operations/import-psd-layer-materialization-batch.ts:123`, `:335`, `:357`, `:149`).
- Pass: stale/mismatch states are representable and rejected where Domain C owns revalidation: candidate-plan digest mismatch, non-approved approval status, approved leaf count/order/ref mismatch, source asset/source PSD mismatch, destination mismatch, selected not-approved/blocked candidates, materialization source mismatch, and generated scaffold mismatch are diagnosed in the import-plan helper (`packages/operation-core/src/operations/import-psd-layer-materialization-batch-import-plan.ts:70`, `:135`, `:148`, `:166`, `:177`, `:202`, `:213`, `:224`, `:235`, `:257`, `:268`).
- Pass: approved materialized leaves still rely on the Wave47/Wave46 materialization evidence path for raw RGBA binary asset refs, canonical media type, digest, byteLength, dimensions, source layer ref/path, extraction options, operation IDs, private/local provenance, and `publicDemoAsset=false`. Domain C only adds bridge evidence around that path.
- Pass: no `apps/**`, `packages/validator-core/**`, package manifest, lockfile, dependency registry, raw parser object, source PSD byte payload, inline raw/visual byte payload, or public demo asset implementation change is part of Domain C.

## Test Adequacy

- Pass: package-format tests cover round-trip serialization of candidate and approval evidence, source PSD digest/byteLength, generated scaffold preview/resolved IDs, not-approved/blocked summaries, and absence of raw parser/source byte/data URL payloads (`packages/package-format/src/source-manifest.test.ts:482`).
- Pass: operation-core tests cover bridge recording for approved leaves only, stale/mismatched approval rejection before mutation, not-approved candidate rejection before mutation, and the existing bridge-less Wave47 batch path (`packages/operation-core/src/operations/import-psd-layer-materialization-batch.test.ts:150`, `:257`, `:299`, `:28`).
- Pass: focused tests are proportionate for Domain C. Editor parser discovery, UI approval UX, validator diagnostics, and focused e2e are intentionally assigned to other Wave48 domains.
- Residual test gap: there is no dedicated negative test for every import-plan global mismatch variant, such as destination mismatch or generated scaffold mismatch. The helper code implements these diagnostics and the focused Domain C tests cover representative global and entry rejection paths; I do not consider this blocking for the bridge domain.

## Verification Performed

- `git diff -- packages/package-format/src packages/operation-core/src discussion/implementation/waves/wave48/wave48-domain-c-package-operation-import-plan-approval-bridge-report.md`
  - Inspected directly. Note: standard `git diff` did not include untracked new files, so I read those files directly.
- `git diff --stat -- packages/package-format/src packages/operation-core/src discussion/implementation/waves/wave48/wave48-domain-c-package-operation-import-plan-approval-bridge-report.md`
  - Reviewed; tracked diff showed 7 tracked files, 782 insertions, 7 deletions, plus untracked Domain C source/report files read separately.
- `pnpm.cmd exec vitest run packages/package-format/src/source-manifest.test.ts packages/operation-core/src/operations/import-psd-layer-materialization-batch.test.ts`
  - Passed with escalation after sandboxed Vitest hit esbuild `spawn EPERM`: 2 files / 18 tests.
- `rg -n --glob *.ts --glob *.tsx "@webtoon/psd|ag-psd" packages`
  - Found test/evidence string mentions only.
- `rg -n --glob *.ts --glob *.tsx 'from\s+.*@webtoon/psd|from\s+.*ag-psd|require\(.*@webtoon/psd|require\(.*ag-psd' packages`
  - No output, exit code 1; no direct parser import/require found in `packages/**`.
- `pnpm.cmd run typecheck:root`
  - Passed.
- `pnpm.cmd typecheck`
  - Passed in the current worktree.
- `pnpm.cmd test:unit`
  - Passed with escalation after sandboxed Vitest hit esbuild `spawn EPERM`: 239 files / 1225 tests.
- `pnpm.cmd run check:source`
  - Passed.
- `pnpm.cmd run check:deps`
  - Passed.

## Remaining Issues

No blocking Domain C source/test issue remains.

The Domain C implementation report's stale full-suite failure note is superseded by the narrow re-review addendum below. Downstream Wave48 domains still own browser candidate discovery, Editor approval UX, validator/Product Preflight diagnostics, focused e2e persistence, docs refresh, and final integration.

## User-Decision Points

None required for Domain C.

Future decisions remain outside this review: higher approval caps, explicit hidden leaf materialization, all-layer import, recursive group import, public/demo asset policy, Product Preflight durability/export, and any UI/parser/validator scope expansion.

## Provisional Assumptions

- Wave47 final pass remains the implementation-proven baseline for parser-free batch raw RGBA intake and generated scaffold evidence.
- Wave48 Domain A pass is accepted as the current import plan boundary and sample-root inventory basis.
- Approval-selection digest calculation is owned by the caller that constructs parser-free candidate/approval evidence; Domain C preserves it and validates the supplied bridge against batch execution facts.

## Narrow Re-review Addendum: Report-Only Fix

Date: 2026-06-06

Final verdict remains `pass`.

The prior non-blocking note C-N1 is resolved. I inspected the requested report diff command; because the Domain C completion report is currently untracked, standard `git diff -- discussion/implementation/waves/wave48/wave48-domain-c-package-operation-import-plan-approval-bridge-report.md` produced no output, so I inspected the report file contents directly.

The report now records `pnpm.cmd typecheck` as pass, `pnpm.cmd test:unit` as pass with 239 files / 1225 tests, and classifies the earlier `apps/editor/**` full-suite failures as transient out-of-scope failures that are no longer current blockers. The `Remaining Issues` section no longer presents full-suite failure as an active Domain C blocker.

No new overclaim was introduced in the edited report text I inspected. The report continues to keep UI, parser candidate discovery, validator diagnostics, focused e2e coverage, all-layer import, recursive group import, public/demo asset policy, and related future expansion outside Domain C.

Remaining issues after this narrow re-review: none for Domain C.

User-decision points after this narrow re-review: none.
