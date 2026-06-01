# Wave 27 Clean Integration Review

> Wave: Wave 27 `mask-clipping-opacity-authoring-v1`  
> Review mode: clean Review-Sylph integration review  
> Date: 2026-06-01  
> Verdict: `pass`

## Scope Reviewed

- Wave basis and pass criteria: `discussion/implementation/orchestration/wave27-plan.md`.
- Integration report and maps: `discussion/implementation/waves/wave27/wave27-final-report.md`, `discussion/implementation/waves/wave27/_map.md`, `discussion/implementation/reviews/wave27/_map.md`.
- Test registration docs: `discussion/tests/fixtures/fixture-manifest.md`, `discussion/tests/traceability/test-traceability-matrix.md`.
- Final working tree scope via `git status --short -uall`.
- Tracked diff scope via `git diff --name-only -- apps/editor packages fixtures/contracts discussion/implementation discussion/design discussion/tests`.
- Public barrel and app callback diffs via targeted `git diff` commands.
- Markdown whitespace check via `git diff --check -- discussion/implementation discussion/tests`.
- Evidence search for Wave27 fixture/test IDs, clean review references, and non-goal wording via `rg`.

## Findings

None blocking.

No required source, fixture, map, final-report, or test-registration fix remains for the Wave27 semantic composition scope. The final report and maps now record this clean-review artifact as `pass`.

## Review Lanes

| Lane | Result | Notes |
|---|---|---|
| Composition Semantics | pass | Wave27 remains scoped to semantic mask relation / clipping intent / opacity evidence. The final report and registration docs explicitly avoid pixel clipping, bitmap masking, and renderer correctness claims. |
| Operation Integrity | pass | Domain A/D evidence recorded `setMaskRelation` dry-run / commit, operation result, package materialization, and invalid diagnostic coverage. Final verification and focused Wave27 vitest evidence are recorded as passing. |
| Runtime Evidence | pass | Domain B/D/F evidence records runtime snapshot, diff, opacity evidence, and Viewer-facing semantic evidence. No pixel oracle is required or claimed. |
| Validator Evidence | pass | Domain C/D evidence records deterministic mask and opacity diagnostics. The Domain C implementation report now records the focused validator suite as passing with 1 file / 11 tests; the older Domain C review artifact's "10 tests" note is historical only. |
| Viewer / Preview Evidence | pass | Domain E/F evidence records Preview / Viewer semantic observation before and after save/load, including desktop and mobile smoke. |
| UI / Accessibility | pass | E2E desktop/mobile smoke passed. The editor app diff is narrow callback wiring only for composition commits and opacity keyform commits. |
| Persistence | pass | Domain E/F evidence records save/load restoration and Viewer / Runtime reinspection of semantic composition evidence. |
| Non-Goals Containment | pass | Status/diff evidence and final report keep file picker, parser, image decode, archive, actual binary upload, Cubism compatibility, external dependency, full renderer, and pixel oracle out of scope. |
| Development Compliance | pass | Targeted `index.ts` diffs are barrel-only exports. `apps/editor/src/app/editor-app.ts` adds only narrow callback bridges. Final `check:source` and `check:deps` evidence is pass. |
| Test Adequacy | pass | Final report records `typecheck`, full unit, full e2e, source guard, dependency guard, diff check, and forbidden-scope scan as pass. Prior focused Wave27 vitest evidence passed 5 files / 27 tests. |
| Orchestration Compliance | pass | Plan required Gnome implementation and independent Review-Sylph review separation. Domain A-F review artifacts are mapped as pass, and Domain G source fixes were not performed by this clean reviewer. |
| Documentation / Map Consistency | pass | Final report, wave map, review map, implementation map, and this artifact consistently record the Wave27 clean integration review as `pass`. |

## Verification Inspected / Reran

- `git status --short -uall`: inspected. Working tree contains Wave27 source/docs/fixture changes plus expected untracked Wave27 files; no package manifest or lockfile path appeared.
- `git diff --name-only -- apps/editor packages fixtures/contracts discussion/implementation discussion/design discussion/tests`: inspected tracked scope. Changes stay in Wave27 implementation/editor/runtime/validator/fixture/docs surfaces.
- `git diff -- packages/authoring-core/src/index.ts packages/operation-core/src/index.ts packages/validator-core/src/index.ts apps/editor/src/editor-session/index.ts apps/editor/src/editor-state/index.ts apps/editor/src/editor-workflow/index.ts apps/editor/src/ui/composition-panel/index.ts`: inspected. Public indexes remain export-only.
- `git diff -- apps/editor/src/app/editor-app.ts`: inspected. App-level change is limited to `onCommitSetMaskRelation` and `onCommitAddDrawableOpacityKeyform` callback wiring.
- `git diff --check -- discussion/implementation discussion/tests`: pass with LF/CRLF working-copy warnings only.
- `rg -n "10 tests|TC-WAVE27-COMPOSITION-CONTRACT-001|wave27-composition-contract-fixtures|Clean integration review|pixel oracle|full renderer" ...`: inspected. Hits confirm warning-gated markdown registration, expected clean-review delegation wording, explicit non-goal wording, and that `10 tests` remains only in an older Domain C review historical note while the implementation report count is corrected to 1 file / 11 tests.
- Relied on recorded final verification evidence: `pnpm.cmd typecheck`, `pnpm.cmd test:unit` (132 files / 686 tests), `pnpm.cmd test:e2e`, `pnpm.cmd run check:source`, `pnpm.cmd run check:deps`, broad diff check, dependency manifest check, forbidden-scope scan, and focused Wave27 vitest evidence all passed.

## Required Gnome Fix

None.

## Residual Risks

- Clipping remains semantic evidence only; there is still no pixel clipping oracle and no full renderer.
- Browser and Viewer evidence prove semantic DTO/text evidence, not visual pixel clipping.
- JSON mirrors under `discussion/tests/**` were intentionally not updated for the warning-gated Wave27 fixture registration.
- Verification evidence was collected in a shared dirty worktree rather than a fresh checkout replay.
- `discussion/implementation/remaining-work-backlog.md` is modified from earlier planning and remains outside this clean review write scope; it is not a Wave27 pass blocker.

## User-Decision Points

None for the Wave27 semantic composition scope.
