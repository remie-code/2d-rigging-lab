# Wave80 Domain A Spec Compliance Review

## Verdict

pass

No blocking Wave80 Domain A spec gaps were found. The implementation satisfies the required Viewer Parts Container visibility parity, Viewer-local Clean Stage pan/zoom behavior, Runtime Controls density/reset changes, and documented non-goals.

## Basis Reviewed

- `discussion/implementation/orchestration/wave80-plan.md`
- `discussion/implementation/orchestration/wave79-plan.md`
- `discussion/implementation/waves/wave79/wave79-final-integration-report.md`
- `discussion/implementation/reviews/wave79/wave79-final-clean-integration-review.md`
- `discussion/design/screen-design/screens/viewer-runtime-view.md`
- `discussion/design/screen-design/e2e-oracle.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/implementation-orchestration/SKILL.md`
- `discussion/implementation/waves/wave80/wave80-domain-a-viewer-interaction-controls-density-followup-report.md`
- `apps/editor/src/workspace/viewer/viewer-clean-stage.ts`
- `apps/editor/src/workspace/viewer/viewer-clean-stage.test.ts`
- `apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx`
- `apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts`
- `apps/editor/src/workspace/viewer/runtime-controls.tsx`
- `apps/editor/src/workspace/viewer/runtime-controls-state.ts`
- `apps/editor/src/workspace/viewer/runtime-controls-state.test.ts`
- Targeted downstream visibility check in `apps/editor/src/workspace/canvas/canvas-evaluation.ts`

## Findings

None.

## Spec Compliance Trace

| Requirement | Status | Evidence |
|---|---|---|
| Hidden Parts Container hides descendant Drawables in Viewer. | pass | Viewer accepts `editorHiddenPartIds` and forwards them to Canvas projection in `apps/editor/src/workspace/viewer/viewer-clean-stage.ts:17` and `apps/editor/src/workspace/viewer/viewer-clean-stage.ts:44`; `ViewerRuntimeScreen` reads/passes the set in `apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx:82` and `apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx:168`. Downstream evaluation checks direct and ancestor hidden parts in `apps/editor/src/workspace/canvas/canvas-evaluation.ts:264`. Tests cover direct and ancestor hidden containers in `apps/editor/src/workspace/viewer/viewer-clean-stage.test.ts:79` and `apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts:251`. |
| Drawable visibility still hides individual Drawables in Viewer. | pass | Canvas visibility combines Drawable `runtimeVisibility` with part hiding in `apps/editor/src/workspace/canvas/canvas-evaluation.ts:308`; Viewer test keeps the mask visible while hiding the face Drawable in `apps/editor/src/workspace/viewer/viewer-clean-stage.test.ts:88` and asserts the result at `apps/editor/src/workspace/viewer/viewer-clean-stage.test.ts:101`. |
| Visible ancestor Parts Containers plus visible Drawable allow rendering. | pass | The visible projection with an empty hidden-part set is asserted renderable in `apps/editor/src/workspace/viewer/viewer-clean-stage.test.ts:79` and `apps/editor/src/workspace/viewer/viewer-clean-stage.test.ts:94`. |
| Wheel over Clean Stage changes Viewer zoom and does not mutate project state. | pass | The wheel handler prevents default scrolling and updates local `view` through `zoomViewerStageViewAtPoint` in `apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx:268`; the helper is pure at `apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx:411`. The test asserts zoom change, pointer anchoring, unchanged session JSON, and no authoring mutation calls in `apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts:277`. |
| Left-drag pans Clean Stage and does not create authoring operations. | pass | Left pointer down/move/up are local handlers with pointer capture and release in `apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx:279`, `apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx:293`, and `apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx:311`; `panViewerStageView` mutates only the local view value in `apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx:425`. The same no-mutation test covers panning at `apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts:291`. |
| Runtime Controls rows are compact horizontal rows. | pass | Rows use a four-column grid for name, slider, numeric input, and row reset in `apps/editor/src/workspace/viewer/runtime-controls.tsx:153`; the DOM/static markup test asserts that dense grid and shorter numeric input class in `apps/editor/src/workspace/viewer/runtime-controls-state.test.ts:244`. |
| Parameter row min/max text and visible `Changed` label are absent. | pass | Runtime rows use min/max only as input attributes in `apps/editor/src/workspace/viewer/runtime-controls.tsx:171` and `apps/editor/src/workspace/viewer/runtime-controls.tsx:181`, with changed state carried by `data-changed` at `apps/editor/src/workspace/viewer/runtime-controls.tsx:158`. The markup test asserts no `Changed` text and no `-30 to 30` min/max text in `apps/editor/src/workspace/viewer/runtime-controls-state.test.ts:265`. |
| Row reset still resets one parameter. | pass | Row reset calls `resetRuntimeParameterOverride` for the specific row at `apps/editor/src/workspace/viewer/runtime-controls.tsx:116`; the state helper deletes one override at `apps/editor/src/workspace/viewer/runtime-controls-state.ts:150`; the test asserts the other override remains at `apps/editor/src/workspace/viewer/runtime-controls-state.test.ts:115`. |
| `Reset changed` is absent. | pass | No production control remains; the markup regression asserts absence in `apps/editor/src/workspace/viewer/runtime-controls-state.test.ts:265`. |
| `Reset all` clears all Viewer-local overrides and has tooltip `Reset all` plus aria-label `Reset all parameter overrides`. | pass | The button has `aria-label="Reset all parameter overrides"` and `title="Reset all"` in `apps/editor/src/workspace/viewer/runtime-controls.tsx:92`; it calls the Viewer-local reset helper at `apps/editor/src/workspace/viewer/runtime-controls.tsx:95`. The helper clears overrides while preserving search in `apps/editor/src/workspace/viewer/runtime-controls-state.ts:165`, tested at `apps/editor/src/workspace/viewer/runtime-controls-state.test.ts:119`; markup assertions cover title and aria label at `apps/editor/src/workspace/viewer/runtime-controls-state.test.ts:258`. |
| Existing Viewer tests are recorded as passing. | pass | Domain A report records final focused Viewer Vitest pass, 3 files / 21 tests, in `discussion/implementation/waves/wave80/wave80-domain-a-viewer-interaction-controls-density-followup-report.md:102` and `discussion/implementation/waves/wave80/wave80-domain-a-viewer-interaction-controls-density-followup-report.md:106`; it also records `pnpm.cmd typecheck` pass at `discussion/implementation/waves/wave80/wave80-domain-a-viewer-interaction-controls-density-followup-report.md:107`. |
| Non-goals and forbidden scope are respected. | pass | Domain A report records no packages, dependency, schema, runtime-core, mesh/deformer/keyform, dynamics, export, screenshot, diff/compare, crop guide, favorite, grouping, CanvasPreviewPanel, or full ParameterBar changes in `discussion/implementation/waves/wave80/wave80-domain-a-viewer-interaction-controls-density-followup-report.md:74`. Source review found Viewer pan/zoom and Runtime Controls implemented without operation/history/project mutation imports. |

## Must-Not / Forbidden Scope Check

- No source edits outside `apps/editor/src/workspace/viewer/**` are required by the reviewed Domain A implementation.
- `git ls-files --others --exclude-standard apps/editor/src/workspace/viewer discussion/implementation/waves/wave80 discussion/implementation/reviews/wave80` shows the Domain A candidate files under Viewer plus the Wave80 report path.
- The current worktree also contains Wave79 baseline modified/untracked files outside Viewer. Because the review basis explicitly includes Wave79 final reports and those files are outside the Wave80 Domain A changed-files self-report, they are treated as pre-existing baseline context, not Wave80 Domain A forbidden-scope evidence.
- No package manifest, lockfile, dependency configuration, save/load schema, runtime-core parity, grid2d parity, dynamics, export/screenshot, compare/diff, crop guide, favorite/pinned parameters, parameter grouping, mesh generation, deformer authoring, keyform authoring, Atlas, Cubism SDK/runtime export, or standalone runtime app work was found in the reviewed Domain A source.

## Verification Evidence Reviewed

- Focused Viewer tests recorded as passing: `pnpm.cmd exec vitest run apps/editor/src/workspace/viewer/viewer-clean-stage.test.ts apps/editor/src/workspace/viewer/runtime-controls-state.test.ts apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts`, final approved run passed 3 files / 21 tests.
- `pnpm.cmd typecheck` recorded as passed.
- `pnpm.cmd --dir apps/editor typecheck` recorded as still failing only on pre-existing non-Viewer errors, with no Viewer file remaining in the second failure output.
- Scoped `git diff --check -- apps/editor/src/workspace/viewer discussion/implementation/waves/wave80` recorded as passed.
- This review did not run a fresh Vitest/typecheck command; it reviewed source, tests, status/search evidence, and the recorded verification report.

## Residual Risks

- Browser-level wheel/pan event smoke was not recorded; current proof is source review plus pure helper/component tests.
- Runtime Controls density is asserted through DOM/class/static markup rather than a visual or pixel oracle. This matches the E2E oracle boundary, but human visual review remains the stronger check for final density.
- The dirty worktree and untracked Wave79 baseline files limit normal `git diff --check` visibility for untracked content; this is already recorded in the Domain A report and remains a non-blocking traceability risk.

## User-Decision Points

None.
