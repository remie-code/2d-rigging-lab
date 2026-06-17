# Wave80 Domain A Test Adequacy Review

- Verdict: pass
- Role: Review-Sylph lane 3/3, Test Adequacy Review
- Date: 2026-06-17

## Basis Reviewed

- `discussion/implementation/orchestration/wave80-plan.md`
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

## Findings

### Blocking

- None.

### Warnings / Notes

- Clean Stage wheel and pointer interaction are not exercised through a live DOM event dispatch test. The tests cover the exported view transformation helpers and non-mutation behavior, while source wiring covers `onWheel`, `onPointerDown`, pointer capture, pan state, and handler attachment in `apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx:268`, `apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx:279`, `apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx:291`, `apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx:309`, `apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx:383`, and `apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx:387`. This is adequate for the focused unit/component scope, with residual browser-event risk recorded below.
- `git diff --check -- apps/editor/src/workspace/viewer discussion/implementation/waves/wave80` passed, but the Viewer files are currently untracked, so normal `git diff --check` does not inspect their content. The Domain A report already records this limitation at `discussion/implementation/waves/wave80/wave80-domain-a-viewer-interaction-controls-density-followup-report.md:85`.

## Test Coverage Trace By Acceptance Evidence

| Acceptance evidence | Coverage assessment |
|---|---|
| Hidden Parts Container hides descendant Drawables in Viewer. | Covered. `createViewerCleanStageProjection` forwards `editorHiddenPartIds` to the Canvas projection at `apps/editor/src/workspace/viewer/viewer-clean-stage.ts:40`. Tests cover hidden direct part and hidden ancestor part at `apps/editor/src/workspace/viewer/viewer-clean-stage.test.ts:78`, `apps/editor/src/workspace/viewer/viewer-clean-stage.test.ts:82`, `apps/editor/src/workspace/viewer/viewer-clean-stage.test.ts:85`, `apps/editor/src/workspace/viewer/viewer-clean-stage.test.ts:99`, and `apps/editor/src/workspace/viewer/viewer-clean-stage.test.ts:103`. Integration projection forwarding is covered at `apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts:251`. |
| Drawable visibility still hides individual Drawables in Viewer. | Covered. The same test keeps the mask Drawable visible while `DRAW_FACE` runtime visibility is false at `apps/editor/src/workspace/viewer/viewer-clean-stage.test.ts:88`, `apps/editor/src/workspace/viewer/viewer-clean-stage.test.ts:107`, and `apps/editor/src/workspace/viewer/viewer-clean-stage.test.ts:108`. |
| Visible ancestor Parts Containers plus visible Drawable allow rendering. | Covered. The visible projection expects both Drawables visible and renderable artwork true at `apps/editor/src/workspace/viewer/viewer-clean-stage.test.ts:79`, `apps/editor/src/workspace/viewer/viewer-clean-stage.test.ts:95`, and `apps/editor/src/workspace/viewer/viewer-clean-stage.test.ts:97`. |
| Wheel over Clean Stage changes Viewer zoom and does not mutate project state. | Covered by helper test plus source wiring. `onWheel` prevents default, converts the pointer location, and calls `zoomViewerStageViewAtPoint` at `apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx:268`. The helper is tested for zoom increase, pointer anchoring, no session mutation, and no input view mutation at `apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts:277`, `apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts:286`, `apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts:295`, `apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts:302`, and `apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts:303`. |
| Left-drag pans Clean Stage and does not create authoring operations. | Covered by helper test plus source wiring. Pointer down/move/up/cancel handling and pointer capture are wired at `apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx:279`, `apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx:291`, `apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx:309`, `apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx:320`, `apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx:383`, and `apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx:386`. The helper test checks pan delta and no project/session mutation at `apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts:291`, `apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts:298`, `apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts:302`, `apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts:307`, and `apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts:308`. |
| Runtime Controls rows are compact horizontal rows. | Covered. Row source uses a grid row with name, slider, numeric input, and reset button at `apps/editor/src/workspace/viewer/runtime-controls.tsx:151`, `apps/editor/src/workspace/viewer/runtime-controls.tsx:168`, `apps/editor/src/workspace/viewer/runtime-controls.tsx:178`, and `apps/editor/src/workspace/viewer/runtime-controls.tsx:189`. Markup test asserts the compact grid class and shorter numeric input at `apps/editor/src/workspace/viewer/runtime-controls-state.test.ts:244`, `apps/editor/src/workspace/viewer/runtime-controls-state.test.ts:263`, and `apps/editor/src/workspace/viewer/runtime-controls-state.test.ts:264`. |
| Parameter row min/max text and visible `Changed` label are absent. | Covered. Runtime row renders slider/input min/max as attributes rather than row text at `apps/editor/src/workspace/viewer/runtime-controls.tsx:168` and `apps/editor/src/workspace/viewer/runtime-controls.tsx:178`, and changed state is data/style based at `apps/editor/src/workspace/viewer/runtime-controls.tsx:153` and `apps/editor/src/workspace/viewer/runtime-controls.tsx:158`. Markup assertions check absence at `apps/editor/src/workspace/viewer/runtime-controls-state.test.ts:265`, `apps/editor/src/workspace/viewer/runtime-controls-state.test.ts:266`, and `apps/editor/src/workspace/viewer/runtime-controls-state.test.ts:267`. |
| Row reset still resets one parameter. | Covered. State test deletes only `FACE_ANGLE_X` and preserves `MOUTH_OPEN` at `apps/editor/src/workspace/viewer/runtime-controls-state.test.ts:115`, `apps/editor/src/workspace/viewer/runtime-controls-state.test.ts:116`, and `apps/editor/src/workspace/viewer/runtime-controls-state.test.ts:117`. UI row reset remains per row at `apps/editor/src/workspace/viewer/runtime-controls.tsx:117` and `apps/editor/src/workspace/viewer/runtime-controls.tsx:189`. |
| `Reset changed` is absent. | Covered. Runtime Controls source has only global reset-all in the header at `apps/editor/src/workspace/viewer/runtime-controls.tsx:91`, and markup asserts absence at `apps/editor/src/workspace/viewer/runtime-controls-state.test.ts:265`. |
| `Reset all` clears all Viewer-local overrides and has tooltip / aria label evidence. | Covered. State reset clears overrides while preserving search at `apps/editor/src/workspace/viewer/runtime-controls-state.ts:165` and `apps/editor/src/workspace/viewer/runtime-controls-state.test.ts:119`. UI evidence for `aria-label` and `title` is at `apps/editor/src/workspace/viewer/runtime-controls.tsx:91`, `apps/editor/src/workspace/viewer/runtime-controls.tsx:92`, `apps/editor/src/workspace/viewer/runtime-controls.tsx:96`, `apps/editor/src/workspace/viewer/runtime-controls-state.test.ts:258`, and `apps/editor/src/workspace/viewer/runtime-controls-state.test.ts:259`. |
| Existing Viewer tests remain passing. | Covered by the focused Vitest run recorded below: 3 Viewer test files, 21 tests passed. |
| Verification commands are appropriate and reported accurately. | Mostly covered and independently re-run. Domain report command lines are at `discussion/implementation/waves/wave80/wave80-domain-a-viewer-interaction-controls-density-followup-report.md:102`, `discussion/implementation/waves/wave80/wave80-domain-a-viewer-interaction-controls-density-followup-report.md:107`, `discussion/implementation/waves/wave80/wave80-domain-a-viewer-interaction-controls-density-followup-report.md:109`, and `discussion/implementation/waves/wave80/wave80-domain-a-viewer-interaction-controls-density-followup-report.md:112`. The report accurately records the focused Vitest pass, root typecheck pass, app typecheck failure outside Viewer, and `git diff --check` limitation. I additionally ran source organization and dependency guards; both passed. |

## Verification Command Evidence Reviewed

- `pnpm.cmd exec vitest run apps/editor/src/workspace/viewer/viewer-clean-stage.test.ts apps/editor/src/workspace/viewer/runtime-controls-state.test.ts apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts`
  - Sandbox run failed with Vitest/esbuild `spawn EPERM`.
  - Approved external rerun passed: 3 files / 21 tests.
- `pnpm.cmd typecheck`
  - Passed.
- `pnpm.cmd --dir apps/editor typecheck`
  - Failed, matching the Domain A report. The emitted errors were in non-Viewer files such as `src/features/editor-session/editor-session-context-history.test.ts`, `src/features/editor-session/model/mesh-tool-state.test.ts`, `src/features/project-storage/model/editor-project-storage.test.ts`, `src/workspace/canvas/canvas-render-scene-adapter.ts`, and project-storage / mesh-tool tests; no `src/workspace/viewer/*` file appeared in the failure output.
- `git diff --check -- apps/editor/src/workspace/viewer discussion/implementation/waves/wave80`
  - Passed, exit 0, with the untracked-file limitation noted above.
- `node scripts/check-source-organization.mjs`
  - Passed: `Source organization guard passed.`
- `node scripts/check-dependencies.mjs`
  - Passed: `Dependency guard passed.`

## Residual Risks / Test Gaps

- Low: Clean Stage wheel and drag behavior are not tested by firing actual browser/React wheel and pointer events against a mounted component. Current coverage is helper-level plus source wiring review.
- Low: There is no Playwright or pixel/layout test for runtime row density. The accepted E2E oracle does not require pixel/layout assertions here, and static markup/source assertions are reasonable for this wave.
- Low: `git diff --check` does not inspect currently untracked Viewer files. Focused tests, typecheck, and source review covered the functional risk.
- Medium, outside Domain A test adequacy: app-local typecheck still fails on pre-existing non-Viewer errors. Root `pnpm typecheck` and focused Viewer tests pass.

## User-Decision Points

- None.
