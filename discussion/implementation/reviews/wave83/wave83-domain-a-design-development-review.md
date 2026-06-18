# Wave83 Domain A Design / Development Compliance Review

## Verdict

pass

No blocking or needs-change findings were found in this design / development compliance lane.

## Scope Reviewed

- Wave: Wave83 `dynamics-tool-time-progression-preview-quick-tune`.
- Domain A: `wave83-dynamics-preview-time-progression-quick-tune`.
- Review lane: independent Design / Development Compliance Review.
- Reviewed from source, tests, policies, Wave83 plan, the Domain A draft report, and Wave81/Wave82 baselines.
- No source or test files were edited. This review wrote only this artifact.

## Basis Documents Used

- `discussion/implementation/orchestration/wave83-plan.md`
- `discussion/design/screen-design/components/dynamics-tool.md`
- `discussion/implementation/waves/wave83/wave83-domain-a-dynamics-preview-time-progression-quick-tune-report.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/ux-backed-package-logic-authority.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/operation-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`
- `discussion/implementation/waves/wave82/wave82-final-integration-report.md`
- `discussion/implementation/reviews/wave82/wave82-final-clean-integration-review.md`
- `discussion/implementation/waves/wave81/wave81-final-integration-report.md`
- `discussion/implementation/reviews/wave81/wave81-final-clean-integration-review.md`

## Source And Tests Reviewed

- `apps/editor/src/features/editor-session/model/dynamics-tool-state.ts`
- `apps/editor/src/features/editor-session/model/dynamics-tool-state.test.ts`
- `apps/editor/src/features/editor-session/editor-session-context.tsx`
- `apps/editor/src/features/editor-session/editor-session-context-history.test.ts`
- `apps/editor/src/workspace/panels/dynamics-tool-inspector.tsx`
- `apps/editor/src/workspace/panels/dynamics-tool-inspector.test.ts`
- `apps/editor/src/workspace/panels/inspector-panel.test.ts`
- `apps/editor/src/workspace/controls/raf-coalesced-number.ts`
- `packages/runtime-core/src/dynamics-evaluation.ts`
- `apps/editor/package.json`

## Findings

None.

## Design / Development Compliance Summary

### Solver Reuse / Alignment Boundary

Pass.

- Direct runtime-core reuse was not added, and `apps/editor/package.json:13`-`:29` still has no `@private-2d-rigging-lab/runtime-core` dependency. That supports the Domain A report's package-boundary justification without adding an unreviewed dependency.
- Editor preview keeps an Editor-local stepper, but its formula follows the runtime-core Dynamics solver shape: source velocity, source acceleration, reaction, sway, convergence damping, output offset clamp, and reset state align with `packages/runtime-core/src/dynamics-evaluation.ts:75`-`:122`, `:158`-`:174`, and `:190`-`:200`.
- The Editor-local implementation clamps elapsed time to `100ms` and splits long elapsed time into nominal `16.6666667ms` steps at `apps/editor/src/features/editor-session/model/dynamics-tool-state.ts:81`-`:82` and `:798`-`:853`. This is compatible with the runtime-core fixed-step sequence path in `packages/runtime-core/src/dynamics-evaluation.ts:124`-`:147`, while avoiding a broad package rewrite.
- Tests cover multi-frame stepping, later driver values, continued settling after driver stops, and session-local Quick Tune overrides at `apps/editor/src/features/editor-session/model/dynamics-tool-state.test.ts:160`-`:314`.

### Session / History / Persistence Boundary

Pass.

- Mutable preview state remains under `DynamicsToolPreviewState`, including selected group, driver values, simulation states, definition overrides, and reset serial at `apps/editor/src/features/editor-session/model/dynamics-tool-state.ts:52`-`:57`.
- Animation ticks mutate only session-local preview state through `advanceDynamicsToolPreviewSimulation(...)` at `apps/editor/src/features/editor-session/model/dynamics-tool-state.ts:572`-`:616`.
- Quick Tune live preview uses session-local definition overrides at `apps/editor/src/features/editor-session/model/dynamics-tool-state.ts:619`-`:662`, and `createDynamicsToolPreviewEvaluation(...)` consumes those overrides only for preview/effective Canvas values at `:697`-`:757`.
- The Editor session context exposes preview tick/override setters as React state updates, while committed Dynamics updates still route through `runCommandWithHistory(...)` at `apps/editor/src/features/editor-session/editor-session-context.tsx:869`-`:875` and `:909`-`:936`.
- History tests prove preview ticks do not create undo entries and a committed coefficient update stays undoable at `apps/editor/src/features/editor-session/editor-session-context-history.test.ts:261`-`:323`.
- No save/load schema or portable project files were changed in the reviewed diff.

### React / Context Scope

Pass.

- Context changes are narrow: three preview-only callbacks were added to the existing Editor session context surface at `apps/editor/src/features/editor-session/editor-session-context.tsx:291`-`:302`, wired at `:909`-`:936`, and exposed at `:1671`-`:1674`.
- No React context split, provider architecture rewrite, or cross-module state store change was introduced.
- The Canvas connection remains the existing `dynamicsToolPreviewEvaluation.parameterValues` path in `apps/editor/src/workspace/panels/canvas-preview-panel.tsx:146`-`:174`.

### Operation Policy

Pass.

- Quick Tune finalization commits through the existing `updateDynamicsGroup(...)` operation path from `apps/editor/src/workspace/panels/dynamics-tool-inspector.tsx:224`-`:235` and `:477`-`:497`.
- Live Quick Tune changes update only a local draft/preview override at `apps/editor/src/workspace/panels/dynamics-tool-inspector.tsx:458`-`:498`; they do not call the operation path until completion.
- Component tests prove live Quick Tune preview occurs before commit, pointer completion commits once, same-value finalization no-ops, and repeated pointerup/blur completion events deduplicate at `apps/editor/src/workspace/panels/dynamics-tool-inspector.test.ts:139`-`:196` and `:243`-`:363`.
- Animation ticks do not call operation-backed mutation; the rAF loop calls only `onAdvancePreview(...)` at `apps/editor/src/workspace/panels/dynamics-tool-inspector.tsx:931`-`:974`.

### Source Organization

Pass.

- No `index.ts` file or broad catch-all source file was changed.
- The touched source remains in the expected Dynamics Tool state/context/Inspector files from the Wave83 plan.
- `dynamics-tool-inspector.tsx` is large, but the added logic is cohesive to the Existing Group Inspector preview/Quick Tune surface, not an unrelated refactor. Automated source organization guard passed.
- `apps/editor/src/workspace/controls/raf-coalesced-number.ts` was reused unchanged; its existing rAF coalescing and final flush behavior remains at `apps/editor/src/workspace/controls/raf-coalesced-number.ts:15`-`:78`.

### Dependency / Forbidden Scope

Pass.

- No dependency manifest or lockfile diff was found.
- Dependency guard passed.
- Search over the reviewed implementation files found no Viewer playback/time-progression controls, frame stepping, Cubism format compatibility, Cubism SDK/Core use, `setInterval`, or `setTimeout`.
- `packages/runtime-core/src/dynamics-evaluation.ts` was reviewed as an alignment basis only and has no source diff in this domain.

### Cleanup And rAF Lifecycle

Pass.

- Group open/list/create/delete transitions select or clear preview state at `apps/editor/src/workspace/panels/dynamics-tool-inspector.tsx:122`-`:149` and `:212`-`:218`.
- Existing Group Inspector starts the preview loop only while its selected preview group is active at `apps/editor/src/workspace/panels/dynamics-tool-inspector.tsx:440`-`:444`.
- The loop cancels the pending frame and clears the last timestamp on unmount or dependency change at `apps/editor/src/workspace/panels/dynamics-tool-inspector.tsx:942`-`:974`.
- Component tests assert pending rAF cleanup when entering Edit, List, and Create states at `apps/editor/src/workspace/panels/dynamics-tool-inspector.test.ts:198`-`:218`.

## Verification Considered Or Rerun

Orchestrator verification considered:

- `pnpm.cmd typecheck`: pass.
- Focused Vitest sandbox run failed with known esbuild `spawn EPERM`; approved rerun passed 4 files / 29 tests.
- `node scripts/check-source-organization.mjs`: pass.
- `node scripts/check-dependencies.mjs`: pass.
- `git diff --check`: pass with CRLF warnings only.

Reviewer-local checks rerun:

- `node scripts/check-source-organization.mjs`: passed.
- `node scripts/check-dependencies.mjs`: passed.
- Scoped `git diff --check` over reviewed files and the Domain A report: passed with CRLF warnings only.
- Targeted searches for forbidden Viewer playback/frame stepping/Cubism/timer patterns in reviewed implementation files: no matches.
- `git diff --name-only -- package.json pnpm-lock.yaml pnpm-workspace.yaml packages/*/package.json apps/*/package.json`: no dependency manifest/lockfile diff.

Not rerun:

- `pnpm.cmd typecheck` and focused Vitest were not rerun by this reviewer because the orchestrator already recorded successful approved runs and the design/development lane rechecked source/policy boundaries directly.

## Residual Risks

- Editor preview still duplicates Dynamics solver code instead of importing runtime-core. This is acceptable for Wave83 because the package dependency boundary was not changed and the formulas are aligned, but future solver changes should either consolidate the stepping contract or add explicit parity tests.
- `dynamics-tool-inspector.tsx` remains large. The current change is cohesive and source-organization guard passes, but future Dynamics Inspector expansion should split Quick Tune and preview-loop components/hooks before the file becomes harder to review.
- Browser/manual visual QA was not run in this review; actual drag feel and Canvas motion remain covered by component/model tests rather than a live browser check.

## User-Decision Points

None for Domain A from this design / development compliance lane.
