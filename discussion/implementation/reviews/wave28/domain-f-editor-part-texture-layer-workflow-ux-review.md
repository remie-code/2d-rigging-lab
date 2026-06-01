# Wave28 Domain F Review: Editor Part / Texture / Layer Workflow UX

## verdict

pass

## scope reviewed

- Domain target: `wave28-editor-part-texture-layer-workflow-ux`.
- Re-review scope: focused fix loop for the prior `needs_changes` findings in Domain F.
- Reviewed changed/fix-loop files:
  - `apps/editor/src/editor-workflow/part-texture-layer-workflow.ts`
  - `apps/editor/src/editor-workflow/workflow-controller.ts`
  - `apps/editor/src/editor-workflow/index.ts`
  - `apps/editor/src/editor-workflow/part-texture-layer-workflow.test.ts`
  - `discussion/implementation/waves/wave28/domain-f-editor-part-texture-layer-workflow-ux-gnome-report.md`
- Rechecked the relevant Domain F paths for source organization, lock/runtime visibility separation, test adequacy, typecheck, and diff hygiene.
- Treated Wave28 Domain A-E changes in `packages/**`, `fixtures/contracts/**`, and `apps/editor/src/editor-preview/**` as upstream accepted basis except where Domain F depends on them.

## basis documents used

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave28-plan.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`
- `discussion/acceptance-criteria/03_MVP_Acceptance_Criteria.md`
- `discussion/scenarios/03_MVP_Acceptance_Criteria.md`
- `discussion/design/module-contracts/package-file-format-contract.md`
- `discussion/design/module-contracts/operation-contracts.md`
- `discussion/design/module-contracts/validator-contract.md`
- `discussion/design/mvp-authoring-runtime/03-runtime-evaluation-semantics.md`
- `discussion/tests/traceability/test-traceability-matrix.md`
- `discussion/tests/fixtures/fixture-manifest.md`
- Upstream accepted reports:
  - `discussion/implementation/reviews/wave28/domain-a-orch-sylph-final-report.md`
  - `discussion/implementation/reviews/wave28/domain-b-orch-sylph-final-report.md`
  - `discussion/implementation/reviews/wave28/domain-c-validator-part-texture-layer-diagnostics-orch-report.md`
  - `discussion/implementation/reviews/wave28/domain-d-editor-layer-tree-draft-state-view-model-review.md`
  - `discussion/implementation/reviews/wave28/domain-e-orch-sylph-final-report.md`

## findings

No current blocking, medium, or low-severity findings.

### Previously blocking finding 1: resolved

Prior issue: locked layers did not guard existing runtime visibility / draw-order authoring edits.

Resolution verified:

- `commitWorkflowSetDrawableRuntimeVisibility` rejects locked drawable edits before committing an operation (`apps/editor/src/editor-workflow/part-texture-layer-workflow.ts:250`).
- `commitWorkflowToggleDrawableRuntimeVisibility` delegates through the guarded setter (`apps/editor/src/editor-workflow/part-texture-layer-workflow.ts:274`).
- `commitWorkflowMoveDrawableLayer` checks the moved drawable and adjacent affected drawable before committing draw-order changes (`apps/editor/src/editor-workflow/part-texture-layer-workflow.ts:299`, `apps/editor/src/editor-workflow/part-texture-layer-workflow.ts:320`).
- Locked results return `status: "locked"` and leave `latestSessionPersistenceResult` null, so no authoring operation is committed for the blocked runtime visibility / draw-order actions.
- Focused tests now cover locked texture assignment, locked runtime visibility set/toggle, moving a locked drawable, moving across a locked drawable, unchanged draw order, and editor-hidden separation from runtime visibility (`apps/editor/src/editor-workflow/part-texture-layer-workflow.test.ts:140`, `apps/editor/src/editor-workflow/part-texture-layer-workflow.test.ts:157`, `apps/editor/src/editor-workflow/part-texture-layer-workflow.test.ts:159`, `apps/editor/src/editor-workflow/part-texture-layer-workflow.test.ts:196`, `apps/editor/src/editor-workflow/part-texture-layer-workflow.test.ts:203`).

### Previously blocking finding 2: resolved

Prior issue: Domain F workflow logic was added directly to an already oversized `workflow-controller.ts`.

Resolution verified:

- Domain F part/texture/layer commit, draft, lock guard, draw-order move, and operation ID helper logic was extracted into `apps/editor/src/editor-workflow/part-texture-layer-workflow.ts`.
- `workflow-controller.ts` now delegates Domain F part/texture/layer actions to the extracted workflow helper and mostly retains state assignment, latest result tracking, and preview invalidation wiring (`apps/editor/src/editor-workflow/workflow-controller.ts:430`, `apps/editor/src/editor-workflow/workflow-controller.ts:567`, `apps/editor/src/editor-workflow/workflow-controller.ts:600`).
- `workflow-controller.ts` line count is now 963, reduced from the prior reviewed 1110 lines. The extracted file is 447 lines and has a cohesive Domain F workflow responsibility.
- `apps/editor/src/editor-workflow/index.ts` remains barrel-only and now re-exports `part-texture-layer-workflow.js` (`apps/editor/src/editor-workflow/index.ts:9`).
- Rechecked `apps/editor/src/editor-session/index.ts`, `apps/editor/src/editor-state/index.ts`, `apps/editor/src/editor-workflow/index.ts`, and `apps/editor/src/ui/layer-tree/index.ts`; all remain export-only barrels.

## compliance notes

- Allowed/forbidden scope: the fix loop stayed within Domain F editor workflow/test/report scope. No Domain F-specific source changes were found in `packages/**` or `fixtures/contracts/**`.
- No dependency manifest or lockfile changes were present for Domain F.
- No file picker, parser, asset I/O, image decode, full renderer, pixel oracle, drag-and-drop tree editor, or broad app shell redesign was introduced.
- Editor-only hide remains separate from runtime visibility. Tests assert `editorHiddenIds` while `runtimeVisible` remains true for the locked drawable.
- Save/load persistence for `model/editor-state.json` remains covered by the focused workflow test.

## verification run

Passed:

- `pnpm.cmd exec vitest run apps/editor/src/editor-workflow/part-texture-layer-workflow.test.ts`
  - 1 file / 2 tests passed.
- `pnpm.cmd exec vitest run apps/editor/src/editor-workflow/workflow-controller.test.ts apps/editor/src/editor-session/session-adapter.test.ts apps/editor/src/ui/app-shell/app-shell.test.ts apps/editor/src/ui/layer-tree/layer-tree-panel.test.ts apps/editor/src/editor-preview/preview-projection.test.ts apps/editor/src/editor-preview/texture-preview-resolution.test.ts apps/editor/src/editor-workflow/viewer-runtime-workflow.test.ts`
  - 7 files / 75 tests passed.
- `pnpm.cmd typecheck`
  - root and editor typecheck passed.
- `git diff --check -- apps/editor/src/editor-state apps/editor/src/editor-workflow apps/editor/src/editor-session apps/editor/src/app/editor-app.ts apps/editor/src/ui discussion/implementation/waves/wave28/domain-f-editor-part-texture-layer-workflow-ux-gnome-report.md discussion/implementation/reviews/wave28/domain-f-editor-part-texture-layer-workflow-ux-review.md`
  - passed; Git emitted LF-to-CRLF working-copy warnings only.
- `pnpm.cmd exec vitest run apps/editor/src`
  - 31 files / 174 tests passed.
- Supplemental trailing whitespace scan for new untracked Domain F files:
  - `apps/editor/src/editor-workflow/part-texture-layer-workflow.ts`
  - `apps/editor/src/editor-workflow/part-texture-layer-workflow.test.ts`
  - `discussion/implementation/reviews/wave28/domain-f-editor-part-texture-layer-workflow-ux-review.md`
  - no matches.

Not run:

- Browser/e2e persistence smoke. Domain G owns e2e smoke after Domain F.

## residual risks

- The UI remains a minimum form-based workflow, not a drag-and-drop tree editor. This matches Wave28 non-goals.
- Texture preview remains semantic/package-local evidence with deterministic data URL support; no real image decode or file picker was introduced.
- Desktop/mobile layout should still be verified in Domain G because Domain F unit/component tests do not render actual browser layout.

## user-decision points

None.

## report path

`discussion/implementation/reviews/wave28/domain-f-editor-part-texture-layer-workflow-ux-review.md`
