# Wave33 Clean Integration Review: Layer Tree Direct Manipulation / Part Tree UX v0

Date: 2026-06-02

Reviewer: Review-Sylph clean integration reviewer

Verdict: `pass`

## Decision

Wave33 can proceed to final report, map, backlog, and current capability updates.

No source/test blocker was found in the reviewed integration scope after Domains A-F passed and after the Domain G narrow Wave30 fixture fix was reviewed as `pass`.

This is not yet a final Wave33 completion pass because the final report and final map/capability/backlog updates have not been written. The required documentation updates are listed below.

## Findings

No blocking findings.

### Non-Blocking: Final Wave33 documentation is still stale/planned

Severity: required before final Wave33 pass, not a source/test fix.

Current documentation still contains pre-final wording:

- `discussion/implementation/current-capability-map.md` is still headed as Wave32 completion state and does not include a Wave33 update.
- `discussion/implementation/_map.md` says Wave33 is planned and the next action is to execute Wave33.
- `discussion/implementation/orchestration/_map.md` lists Wave33 as `Planned`.
- `discussion/implementation/remaining-work-backlog.md` describes Wave33 as selected/planned, not completed.

These are expected Domain G final-doc tasks, but they must be corrected before the wave is marked complete.

### Non-Blocking: New Wave33 source/test files are large

Severity: residual quality risk.

Local line-count inspection found:

- `apps/editor/e2e/layer-tree-direct-manipulation-smoke.mjs`: 895 lines.
- `apps/editor/src/ui/layer-tree/layer-tree-panel.ts`: 872 lines.
- `apps/editor/src/editor-state/layer-tree-direct-manipulation-view-model.ts`: 617 lines.
- `apps/editor/src/editor-workflow/layer-tree-direct-manipulation-workflow.ts`: 587 lines.
- `packages/operation-core/src/wave33-layer-tree-direct-manipulation-contract-fixtures.test.ts`: 583 lines.

`check:source` passed and public `index.ts` files remain barrel-only, so this is not a pass blocker. It should be carried as a backlog/watch item for future layer-tree/e2e decomposition.

### Non-Blocking: Wave30 fixture-local runtime part evidence backfill remains narrow

Severity: future-work note.

The Domain G fix correctly patches Wave30 fixture tests by backfilling drawable `partId` evidence into fixture-local runtime graphs. It does not change production `toRuntimeGraph` behavior. This is acceptable for the delegated blocker, but if future runtime adapter work expects all authoring-to-runtime conversions to carry drawable part membership by default, that should be handled as a separate source change and review.

## Verification Evidence

Basis and orchestration:

- Reviewed `.agents/skills/implementation-orchestration/SKILL.md` and `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`.
- Reviewed `discussion/implementation/orchestration/wave33-plan.md`; Domain G is explicitly responsible for final verification, clean integration review, final report, and map/backlog/current capability updates.
- Reviewed all Wave33 completion and review artifacts under `discussion/implementation/waves/wave33/` and `discussion/implementation/reviews/wave33/`.
- Domains B-F completion reports explicitly record Gnome implementation and Review-Sylph review separation. Domain A has separate completion/review artifacts and the review records clean Review-Sylph review with no source edits. Domain C and E each used one needs-fix loop and ended in `pass`. Domain G narrow fix review ended in `pass`.

Source/test integration:

- Public index diffs are re-export only:
  - `apps/editor/src/editor-state/index.ts`
  - `apps/editor/src/editor-workflow/index.ts`
  - `packages/operation-core/src/index.ts`
  - `packages/validator-core/src/index.ts`
- `packages/operation-core/src/operations/delete-part.ts` implements `deletePart` as empty-leaf-only, with deterministic missing part, parent, child part, drawable, rig-control, and locked target precondition diagnostics.
- `packages/validator-core/src/validators/part-delete-blockers.ts` reports `part.deleteNonEmpty` for delete candidate blockers including child parts, drawables, rig controls, and mask relations.
- `packages/validator-core/src/validators/part-runtime-evidence.ts` reports `part.runtimeEvidenceMismatch` for stale runtime snapshot package identity/revision, part hierarchy mismatch, extra/missing part evidence, and drawable part membership mismatch.
- `apps/editor/src/editor-workflow/layer-tree-direct-manipulation-workflow.ts` rejects same-batch reparent/drawable assignment to a pending-delete part before committing any operation.
- `apps/editor/src/editor-state/layer-tree-direct-manipulation-view-model.ts` disables pending-delete parts as parent/drawable assignment targets.
- `apps/editor/src/ui/layer-tree/layer-tree-panel.ts` uses explicit forms, selects, and buttons. No native drag/drop implementation was found in the reviewed Wave33 files.

Fixture/e2e coverage:

- `packages/operation-core/src/wave33-layer-tree-direct-manipulation-contract-fixtures.test.ts` pins `updatePart`, `setDrawablePart`, `setDrawableTexture`, `deletePart`, non-empty delete rejection, runtime/viewer evidence, validation report, editor save/load reinspection, and pending-delete preflight expected summaries.
- `apps/editor/e2e/layer-tree-direct-manipulation-smoke.mjs` drives desktop/mobile production UI through rename, reparent, drawable reassignment, texture assignment, empty-leaf delete, Preview/Viewer evidence, browser-local save/load, and pending-delete preflight.
- `discussion/tests/fixtures/fixture-manifest.md` and `discussion/tests/traceability/test-traceability-matrix.md` register `wave33-layer-tree-direct-manipulation-contract-fixtures` and `TC-WAVE33-LAYER-TREE-DIRECT-MANIPULATION-001`.

Final verification supplied by the parent after the Domain G fix:

- `pnpm.cmd typecheck`: pass.
- `pnpm.cmd test:unit`: pass, 170 files / 868 tests.
- `pnpm.cmd test:e2e`: pass, desktop and mobile smoke.
- `pnpm.cmd run check:source`: pass.
- `pnpm.cmd run check:deps`: pass.
- `git diff --check -- apps/editor packages fixtures/contracts discussion/implementation discussion/design discussion/tests`: pass, CRLF normalization warnings only.
- Dependency manifest/lockfile/workspace diff check: empty. I also confirmed no diff in root/workspace/editor/package manifests and relevant package manifests.
- Added-context forbidden-scope scan: parent reported only explicit non-goal/future-scope documentation and fixture/traceability non-claims; my focused scan of Wave33 added files found only negative semantic-boundary assertions such as `rendererOracle: false`, `pixelOracle: false`, `recursiveDelete: false`, and metadata-only e2e notes.

## Residual Risks / Future Work

- The delivered Wave33 UX is explicit-control direct manipulation, not native browser drag-and-drop, multi-select bulk, group transform, recursive delete, delete-with-reassign, renderer/pixel correctness, real image decode, archive import/export, File System Access API, Cubism compatibility, or external dependency expansion.
- E2E remains semantic smoke coverage. It verifies DOM text, structured package/project evidence, Preview/Viewer semantic evidence, and persistence, not pixel rendering.
- Large Wave33 UI/e2e/test files should be split opportunistically in future layer-tree work or a quality wave.
- Domain A's completion report does not record implementation/review agent IDs as explicitly as B-F. Do not invent missing IDs in the final report; cite the available artifacts accurately.

## Required Final Documentation Updates

Before final Wave33 pass, Domain G should:

- Create `discussion/implementation/waves/wave33/wave33-final-report.md` with domain status table, final verification, non-goals, residual risks, and links to this clean integration review.
- Create or update `discussion/implementation/waves/wave33/_map.md` for Wave33 reports/reviews/final report entry points.
- Create or update `discussion/implementation/reviews/wave33/_map.md` to include all Wave33 review artifacts, including this clean integration review and the Domain G narrow fix review.
- Update `discussion/implementation/_map.md` from Wave33 planned/execution wording to completed / implementation-proven wording and update next actions toward Wave34 planning.
- Update `discussion/implementation/orchestration/_map.md` from Wave33 `Planned` to completed / implementation-proven with final review link.
- Update `discussion/implementation/current-capability-map.md` to add a Wave33 update, revise Part / Texture / Layer Tree capability from Wave28 minimum form workflow to Wave33 direct manipulation v0, update verification posture through Wave33, and leave native drag/drop, multi-select, group transform, recursive delete, renderer/pixel, real image/archive/dependency scopes as future work.
- Update `discussion/implementation/remaining-work-backlog.md` from Wave33 planned scope to Wave33 completed scope, remove/retitle the old full part-tree UX candidate, add follow-up layer-tree native drag/drop / multi-select / group transform / recursive delete as future scope, and add the large-file watch items.
- Ensure final docs keep fixture/traceability registrations consistent with the markdown-only warning-gated fixture policy unless the project decides to update JSON mirrors separately.

## User-Decision Points

None for completing the current Wave33 final documentation pass.

Future user decisions are only needed if a later wave reopens native browser drag-and-drop, multi-select bulk operations, recursive delete/delete-with-reassign, renderer/pixel correctness, real asset decode/archive/File System Access, external dependencies, or Cubism compatibility boundaries.
