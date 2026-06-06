# Wave47 Domain D Review: Editor Multi-Layer Selection Batch Intake UX

> Target: `wave47-editor-multi-layer-selection-batch-intake-ux`
> Reviewed report: `discussion/implementation/waves/wave47/wave47-domain-d-editor-multi-layer-selection-batch-intake-ux-report.md`
> Role: Review-Sylph independent review
> Verdict: `pass`

## Verdict

`pass`

The previous blocking finding is resolved. Domain D now preflights the first-time source metadata import plus Domain C generated part scaffold batch operation in an isolated temporary Editor session adapter before mutating the real adapter. If Domain C preflight rejects, the workflow updates only the transient PSD import batch UI state and returns `latestSessionPersistenceResult: null`; the real project/session state remains unchanged.

No new blocking design/development-compliance or test-adequacy issue was found in the fix loop.

## Scope Reviewed

Fix-loop files reviewed:

- `apps/editor/src/editor-workflow/selected-psd-layer-batch-intake-workflow.ts`
- `apps/editor/src/editor-workflow/selected-psd-layer-batch-intake-workflow.test.ts`
- `discussion/implementation/waves/wave47/wave47-domain-d-editor-multi-layer-selection-batch-intake-ux-report.md`

Supporting contract spot-checks:

- `apps/editor/src/editor-session/session-adapter.ts`
- `packages/operation-core/src/lifecycle/dry-run.ts`
- `packages/operation-core/src/operations/import-psd-layer-materialization-batch.ts`

Worktree note:

- The repository remains a mixed Wave47 worktree with parallel `apps/editor/**`, `packages/operation-core/**`, `packages/validator-core/**`, and discussion artifacts. This re-review scoped attribution to the Domain D fix-loop files and dependency contracts above.

## Basis Documents Used

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave47-plan.md`
- `discussion/implementation/waves/wave47/wave47-domain-a-batch-layer-boundary-sample-target-inventory-report.md`
- `discussion/implementation/waves/wave47/wave47-domain-b-browser-multi-layer-materialization-service-report.md`
- `discussion/implementation/reviews/wave47/wave47-domain-b-browser-multi-layer-materialization-service-review.md`
- `discussion/implementation/waves/wave47/wave47-domain-c-package-operation-batch-intake-part-scaffold-bridge-report.md`
- `discussion/implementation/reviews/wave47/wave47-domain-c-package-operation-batch-intake-part-scaffold-bridge-review.md`
- `discussion/implementation/waves/wave46/wave46-domain-d-editor-selected-layer-intake-part-mapping-ux-report.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/implementation/waves/wave47/wave47-domain-d-editor-multi-layer-selection-batch-intake-ux-report.md`

## Findings

### Blocking

None.

### Resolved Finding

1. Resolved: batch operation rejection no longer leaves source-metadata project mutation behind.

   Evidence:

   - `apps/editor/src/editor-workflow/selected-psd-layer-batch-intake-workflow.ts:151` runs `preflightMaterializationBatchOperation` before real source metadata commit.
   - On preflight rejection, the workflow returns UI-only batch intake state based on the original state and reports `latestSessionPersistenceResult: null` (`apps/editor/src/editor-workflow/selected-psd-layer-batch-intake-workflow.ts:161`, `:163`, `:168`).
   - The preflight path creates a temporary adapter from the current persistence snapshot and operation log (`apps/editor/src/editor-workflow/selected-psd-layer-batch-intake-workflow.ts:408`, `:409`, `:411`).
   - Missing source metadata is committed only to that temporary adapter for preflight (`apps/editor/src/editor-workflow/selected-psd-layer-batch-intake-workflow.ts:414`, `:415`).
   - The same batch operation request is then dry-run on the temporary adapter with `dryRun: true` (`apps/editor/src/editor-workflow/selected-psd-layer-batch-intake-workflow.ts:430`, `:436`, `:438`).
   - Only after accepted preflight does the workflow commit source metadata on the real adapter (`apps/editor/src/editor-workflow/selected-psd-layer-batch-intake-workflow.ts:173`).
   - The regression now asserts rejected generated scaffold collision leaves package revision, source asset ids, operation log entries, generated artifacts, package in-memory paths, texture ids, drawable ids, part ids, and persistent byte writes unchanged (`apps/editor/src/editor-workflow/selected-psd-layer-batch-intake-workflow.test.ts:131`, `:152`, `:154`, `:165`, `:166`, `:176`).

   Contract confirmation:

   - `EditorSessionAdapter.dryRunOperation` delegates to operation-core dry-run without writing to the real operation log (`apps/editor/src/editor-session/session-adapter.ts:298`).
   - Operation-core dry-run returns rejected results directly when handler preflight fails and only applies evidence to the dry-run candidate path on success (`packages/operation-core/src/lifecycle/dry-run.ts:42`, `:43`, `:53`).
   - Domain C batch handler itself remains clone-first/no-partial for commit (`packages/operation-core/src/operations/import-psd-layer-materialization-batch.ts:73`, `:82`, `:89`).

### Non-Blocking Notes

- If future code makes dry-run and commit non-deterministic, a post-preflight real commit rejection could again create a source-metadata-only side effect. With the current deterministic operation request generation and single-threaded workflow state, I do not see that as a current blocker.
- Focused Domain D workflow tests still mock Domain B materialization outputs. Real sample PSD materialization with exact digests remains covered by Domain B, and focused save/load e2e remains Domain F scope.

## Design / Development Compliance

Pass:

- The fix preserves explicit selected leaf-layer batch scope and does not add all-layer import, recursive group import, drag/drop, filesystem/archive, renderer, compositing preview, parser-scope expansion, public demo asset wording, package contract changes, or dependency changes.
- Preflight-before-mutation now covers Domain C generated ID/name collision and destination/batch preflight rejection before any real source metadata commit.
- Rejected preflight surfaces operation diagnostics in the UI batch-intake state without changing real project/session state.
- Source PSD bytes and raw parser objects remain outside persisted project/editor state.
- The new preflight logic is contained in the named batch intake workflow file; no `index.ts` implementation logic was added.

## Test Adequacy

Pass:

- Existing happy path still covers successful generated part scaffold commit.
- Existing Domain B materialization partial-failure test still verifies no generated part/texture mutation when materialization is not fully successful.
- The collision regression now directly covers the previous gap by snapshotting and comparing source assets, operation log, package revision, generated artifacts, package in-memory paths, texture/drawable/part state, and persistent byte writes on rejected batch preflight.

Residual test scope:

- Full browser e2e/save-load regression is still Domain F scope.
- The focused no-mutation regression covers generated ID collision. Missing destination parent should follow the same dry-run rejection path, but it is not separately asserted in Domain D tests. Domain C covers missing parent behavior, so this is acceptable for this fix-loop review.

## Verification Performed

Passed:

- `pnpm.cmd exec vitest run apps/editor/src/editor-workflow/selected-psd-layer-batch-intake-workflow.test.ts apps/editor/src/ui/explicit-psd-import/explicit-psd-import-panel.test.ts apps/editor/src/editor-workflow/selected-psd-layer-intake-workflow.test.ts apps/editor/src/editor-state/explicit-psd-import-state.test.ts apps/editor/src/editor-state/editor-test-ids.test.ts`
  - Passed: 5 files / 16 tests.
- `pnpm.cmd --filter @private-2d-rigging-lab/editor typecheck`
  - Passed.
- `pnpm.cmd typecheck`
  - Passed.
- `pnpm.cmd run check:source`
  - Passed.
- `pnpm.cmd run check:deps`
  - Passed.
- `node scripts/check-psd-parser-import-boundary.mjs`
  - Passed: 5 direct import/resolve sites limited to approved adapter and Wave44 scripts.
- `git diff --check -- apps/editor/src discussion/implementation/waves/wave47 discussion/implementation/reviews/wave47`
  - Passed with Git LF/CRLF normalization warnings only.
- `git diff --no-index --check -- NUL apps/editor/src/editor-workflow/selected-psd-layer-batch-intake-workflow.ts`
  - Expected no-index exit `1`; LF/CRLF warning only, no whitespace finding.
- `git diff --no-index --check -- NUL apps/editor/src/editor-workflow/selected-psd-layer-batch-intake-workflow.test.ts`
  - Expected no-index exit `1`; LF/CRLF warning only, no whitespace finding.
- `git diff --no-index --check -- NUL discussion/implementation/waves/wave47/wave47-domain-d-editor-multi-layer-selection-batch-intake-ux-report.md`
  - Expected no-index exit `1`; LF/CRLF warning only, no whitespace finding.
- `git diff --no-index --check -- NUL discussion/implementation/reviews/wave47/wave47-domain-d-editor-multi-layer-selection-batch-intake-ux-review.md`
  - Expected no-index exit `1`; LF/CRLF warning only, no whitespace finding.

Not run:

- Full `pnpm.cmd test:unit` and `pnpm.cmd test:e2e` were not run. The focused Domain D tests plus type/static/boundary checks were rerun; multi-layer browser e2e/save-load remains Domain F scope.

## Remaining Issues

No Domain D fix-loop blocker remains.

Downstream/out-of-scope items remain:

- Domain F focused e2e/save-load regression.
- Domain E validator/Product Preflight batch diagnostics.
- Wave integration review across the mixed Wave47 worktree.

## User-Decision Points

None.
