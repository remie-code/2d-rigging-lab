# Wave47 Domain B Review: Browser Multi-Layer Materialization Service

> Target: `wave47-browser-multi-layer-materialization-service`
> Reviewed report: `discussion/implementation/waves/wave47/wave47-domain-b-browser-multi-layer-materialization-service-report.md`
> Role: Review-Sylph independent review
> Verdict: `pass`

## Verdict

`pass`

No blocking design, development-compliance, boundary, or test-adequacy finding was found for Domain B. The implementation satisfies the browser/editor materialization-service scope for explicit multi-layer PSD leaf selections and leaves UI, package operation commit, validator diagnostics, persistence e2e, recursive group import, all-layer import, renderer/pixel oracle, and public demo asset behavior outside Domain B.

## Findings

### Blocking

None.

### Non-Blocking Notes

- Browser `File` batch entrypoint coverage is indirect. The implementation preserves `intakeKind: "explicitFile"` before delegating to current-source materialization in `apps/editor/src/editor-workflow/selected-psd-layer-batch-materialization-service.ts:72`, but the focused batch tests exercise the ArrayBuffer entrypoint. This is not blocking because the File wrapper has no separate materialization logic and Editor typecheck passes, but Domain D/F may add browser-path coverage when wiring UI/e2e.
- Hidden leaf policy remains a downstream product/UX choice. Domain B records `visibleInSource` in per-layer evidence through the adapter and result DTOs (`apps/editor/src/editor-workflow/browser-psd-parser-adapter.ts:331`, `apps/editor/src/editor-workflow/selected-psd-layer-materialization-result.ts:47`), but does not reject hidden explicit leaf refs. The reviewed objective only required explicit leaf selection, no group recursion, no all-layer import, and truthful per-layer evidence.

## Design / Development Compliance Review

- Pass: Batch API and result types are scoped to Editor workflow files, with default caps matching Domain A: `4` selected unique layer refs and `32 MiB` total raw RGBA (`apps/editor/src/editor-workflow/selected-psd-layer-batch-materialization-result.ts:11`).
- Pass: Result evidence includes structured per-entry success/failure, aggregate status, requested/success/failure counts, duplicate/unsupported/missing/stale/materialization/cap counts, total byte cap facts, and `publicDemoAsset=false` (`apps/editor/src/editor-workflow/selected-psd-layer-batch-materialization-result.ts:21`, `:70`).
- Pass: The service enforces no current bytes and source oversize before parser execution (`apps/editor/src/editor-workflow/selected-psd-layer-batch-materialization-service.ts:75`, `:98`, `:144`, `:158`), batch count cap before parser execution (`:210`), and stale source digest/byteLength before per-layer materialization (`:266`).
- Pass: Duplicate refs are reported as `duplicateSelection` and are not materialized (`apps/editor/src/editor-workflow/selected-psd-layer-batch-materialization-service.ts:461`). Missing empty selections become explicit failures (`:500`).
- Pass: Each unique non-empty ref is materialized through the existing approved single-layer source-evidence service, preserving the Wave46 parser boundary (`apps/editor/src/editor-workflow/selected-psd-layer-batch-materialization-service.ts:305`, `:314`).
- Pass: Total raw RGBA cap overflow is reported per entry without adding that candidate to accepted bytes; already materialized evidence remains visible, so partial failure is not summarized as success (`apps/editor/src/editor-workflow/selected-psd-layer-batch-materialization-service.ts:325`, `:346`, `:355`, `:678`).
- Pass: Group selection stays non-recursive. The adapter returns `unsupportedLayerType` for selected non-layer nodes (`apps/editor/src/editor-workflow/browser-psd-parser-adapter.ts:293`, `:304`), and the batch service maps that failure without expanding children (`apps/editor/src/editor-workflow/selected-psd-layer-batch-materialization-service.ts:520`).
- Pass: Per-layer candidate evidence includes source PSD digest/byteLength/file identity, source layer ref/path/name/bounds/visibility, parser identity, extraction options, raw RGBA media type/dimensions/byteLength/digest, private/local provenance, and Domain B storage boundary (`apps/editor/src/editor-workflow/selected-psd-layer-materialization-service.ts:269`, `:423`; `apps/editor/src/editor-workflow/selected-psd-layer-materialization-result.ts:39`, `:60`).
- Pass: `apps/editor/src/editor-workflow/index.ts` remains barrel-only re-exports (`apps/editor/src/editor-workflow/index.ts:1`). New source files have a clear batch result/service responsibility; no source organization exception is needed.
- Pass: No dependency manifest, lockfile, `packages/**`, UI, e2e, renderer, parser-scope, or public demo asset source changes are attributed to Domain B. The current worktree does include parallel Domain C `packages/operation-core/**` changes, reviewed here only as out-of-scope status context.

## Test Adequacy Review

- Pass: Focused batch tests verify actual materialization of Domain A sample targets and assert exact raw RGBA byte lengths/digests:
  - `headwear`: `671e6a363745b1ce2e8d29c1a63438170fe9511c8884ea42298cf9b8886e5c1a`, `460800` bytes.
  - `eyewear`: `a5558168cbf75f7817a139131c764e317a77056138d6be0e591077b3e373e708`, `116600` bytes.
  - `tie / tie`: `46ba1a95659ac420d37ca89b0ab919ca6ad2022280bb268313937fcd2cd69673`, `232960` bytes.
- Pass: The same tests cover sample aggregate success and evidence fields (`apps/editor/src/editor-workflow/selected-psd-layer-batch-materialization-service.test.ts:71`), duplicate selection (`:180`), selected group unsupported without recursion (`:208`), missing current source bytes (`:241`), stale source identity (`:267`), parser/materialization failure (`:304`), batch count cap (`:336`), and total byte cap partial failure (`:379`).
- Pass: Related Editor workflow tests still pass after adding bounds/visibility to the single-layer evidence mock (`apps/editor/src/editor-workflow/selected-psd-layer-intake-workflow.test.ts:200`).
- Pass: Parser-boundary, source-organization, dependency, Editor typecheck, and full repository typecheck all pass in the current worktree.

## Files Reviewed

- `apps/editor/src/editor-workflow/browser-psd-parser-adapter.ts`
- `apps/editor/src/editor-workflow/index.ts`
- `apps/editor/src/editor-workflow/selected-psd-layer-materialization-result.ts`
- `apps/editor/src/editor-workflow/selected-psd-layer-materialization-service.ts`
- `apps/editor/src/editor-workflow/selected-psd-layer-batch-materialization-result.ts`
- `apps/editor/src/editor-workflow/selected-psd-layer-batch-materialization-service.ts`
- `apps/editor/src/editor-workflow/selected-psd-layer-batch-materialization-service.test.ts`
- `apps/editor/src/editor-workflow/selected-psd-layer-intake-workflow.test.ts`
- `discussion/implementation/waves/wave47/wave47-domain-b-browser-multi-layer-materialization-service-report.md`

Basis documents reviewed include the Wave47 plan, Domain A report/review, Wave46 Domain B report/review, Wave46 Domain D report, source file organization policy, dependency policy, implementation-orchestration skill, and subagent-context-hygiene skill.

## Verification Performed

- `pnpm.cmd exec vitest run apps/editor/src/editor-workflow/selected-psd-layer-batch-materialization-service.test.ts`: passed, 1 file / 8 tests.
- `pnpm.cmd exec vitest run apps/editor/src/editor-workflow/selected-psd-layer-batch-materialization-service.test.ts apps/editor/src/editor-workflow/selected-psd-layer-materialization-service.test.ts apps/editor/src/editor-workflow/browser-psd-parser-bridge.test.ts apps/editor/src/editor-workflow/selected-psd-layer-intake-workflow.test.ts`: passed, 4 files / 26 tests.
- `pnpm.cmd --filter @private-2d-rigging-lab/editor typecheck`: passed.
- `pnpm.cmd typecheck`: passed in the current worktree.
- `pnpm.cmd run check:source`: passed.
- `pnpm.cmd run check:deps`: passed.
- `node scripts/check-psd-parser-import-boundary.mjs`: passed; 5 direct import/resolve sites remain limited to the approved adapter and Wave44 scripts.
- `git diff --check -- <Domain B touched tracked files and report>`: passed with line-ending normalization warnings only.
- `git diff --no-index --check -- NUL <new Domain B source/test/report files>`: passed for untracked new files; exit `1` was normalized as expected no-index difference, with line-ending normalization warnings only and no whitespace findings.

## Verification Blocked / Failing

None in the current worktree. The Domain B report noted an earlier full-typecheck failure in parallel `packages/operation-core` changes, but `pnpm.cmd typecheck` now passes.

## Remaining Issues

No Domain B blocker remains.

Downstream scope still belongs to later domains:

- Domain C: parser-free package/operation batch intake and generated part scaffold commit.
- Domain D: UI controls, destination parent selection, result surfacing, and browser-path user workflow coverage.
- Domain E: validator/Product Preflight batch diagnostics.
- Domain F: focused e2e persistence/portable boundary regression for multi-layer batch intake.

## User-Decision Points

None for Domain B.
