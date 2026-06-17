# Wave81 Domain B Design / Development Compliance Review

## Verdict

pass

## Scope reviewed

- Wave: Wave81 `dynamics-tool-v0-additive-pendulum-contract`.
- Domain B: `wave81-editor-dynamics-tool-authoring-preview`.
- Review lane: Design / Development Compliance Review.
- Reviewed the Domain B implementation report, Wave81 plan, Dynamics Tool component spec, Domain A report and review lanes, development policies, current worktree status/diff, Domain B source files, and focused Domain B tests.
- Did not edit source or tests. This review only writes this artifact.

## Basis documents used

- `discussion/implementation/orchestration/wave81-plan.md`
- `discussion/design/screen-design/components/dynamics-tool.md`
- `discussion/implementation/waves/wave81/wave81-domain-a-headless-dynamics-v2-contract-additive-runtime-report.md`
- `discussion/implementation/reviews/wave81/wave81-domain-a-spec-compliance-review.md`
- `discussion/implementation/reviews/wave81/wave81-domain-a-design-development-review.md`
- `discussion/implementation/reviews/wave81/wave81-domain-a-test-adequacy-review.md`
- `discussion/design/screen-design/components/_map.md`
- `discussion/implementation/remaining-work-backlog.md`
- `discussion/implementation/_map.md`
- `discussion/development_convention/ux-backed-package-logic-authority.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/operation-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`
- `discussion/implementation/waves/wave81/wave81-domain-b-editor-dynamics-tool-authoring-preview-report.md`

## Findings

No blocking or needs-change findings.

## Policy compliance notes

- Source organization: no implementation logic was added to an `index.ts`, and no new broad `types.ts`, `utils.ts`, `helpers.ts`, or `schemas.ts` file was introduced. New `dynamics-tool-state.ts` owns tool state/projection logic, and `dynamics-tool-inspector.tsx` owns the Editor panel UI. `node scripts/check-source-organization.mjs` passed.
- Boundary compliance: Domain B production changes are Editor-side. The workspace still contains upstream Domain A package/fixture changes, but Domain B did not add package manifests or dependencies. `node scripts/check-dependencies.mjs` passed.
- Operation policy: committed Dynamics create/update/delete route through Editor command wrappers that call Operation Core operation types at `apps/editor/src/features/editor-session/model/editor-session-commands.ts:392`, `:402`, and `:412`. The provider exposes those commands through `runCommandWithHistory` at `apps/editor/src/features/editor-session/editor-session-context.tsx:844`, `:853`, and `:862`.
- Preview operation boundary: Inspector preview group selection, driver scrub, and reset are local React state updates at `apps/editor/src/features/editor-session/editor-session-context.tsx:871`, `:880`, and `:893`, not Operation Core commits.
- State hygiene: transient Dynamics preview state is cleared through `clearTransientCommitState` at `apps/editor/src/features/editor-session/editor-session-context.tsx:537`, called on undo/redo at `:593` and `:608`, and project load reset uses `resetEditorLocalStateAfterProjectLoad` at `:545` and `openProjectFromPortableBundle` at `:656`.
- UI architecture: `activeTool === "dynamics"` renders the Dynamics Tool Inspector instead of falling through to selection inspectors at `apps/editor/src/workspace/panels/inspector-panel.tsx:29`.
- Tool-local selection: Dynamics Group selection lives in `dynamicsToolPreview.selectedGroupId` and Inspector local state, with no global `EditorSelection` expansion found.
- Parameter Manager boundary: Dynamics authoring is in `DynamicsToolInspector`; Parameter Manager is not used as the Dynamics Group management surface.

## Source organization / dependency / operation / state-boundary evidence

- `DynamicsToolInspector` calls create/update/delete commands at `apps/editor/src/workspace/panels/dynamics-tool-inspector.tsx:133`, `:151`, and `:164`; validation blocks apply/create at `:102` and `:507`; preview sliders and reset call preview-only context methods at `:557`, `:573`, and `:607`.
- Draft validation covers missing inputs, invalid normalization, v0 one-output cardinality, missing output refs, and duplicate output ownership at `apps/editor/src/features/editor-session/model/dynamics-tool-state.ts:331`, `:345`, `:360`, `:409`, `:421`, and `:431`.
- Dynamics preview evaluation starts from parameter defaults, applies Inspector-local driver values, and writes only the effective output value into the preview map at `apps/editor/src/features/editor-session/model/dynamics-tool-state.ts:600`, `:631`, `:639`, and `:648`.
- Canvas Dynamics mode selects `dynamicsToolPreviewEvaluation.parameterValues` instead of normal authored `parameterValues` at `apps/editor/src/workspace/panels/canvas-preview-panel.tsx:146`. Canvas left-click selection and Rig/Mesh edit starts are gated by `isCanvasAuthoringSelectionEnabled` at `:96`, `:399`, and `:524`; pan/zoom remains available through middle/space pan and wheel handlers at `:371` and `:383`.
- Parameter Bar read-only behavior is gated by `disabledForDynamics` at `apps/editor/src/workspace/panels/parameter-bar.tsx:51`. It blocks keyform actions at `:101`, disables value controls at `:179` and `:193`, displays the Dynamics preview read-only reason at `:207`, and blocks thumb/marker scrub paths at `:364` and `:435`.
- Context-level guards also block parameter value changes, parameter reset, and keyform edits in Dynamics mode at `apps/editor/src/features/editor-session/editor-session-context.tsx:775`, `:910`, and `:935`.
- Focused tests cover the main design/development risks:
  - Inspector presence: `apps/editor/src/workspace/panels/inspector-panel.test.ts:29`.
  - Dynamics state defaults, duplicate ownership, default-based local preview, additive output, and reset: `apps/editor/src/features/editor-session/model/dynamics-tool-state.test.ts:24`, `:58`, `:99`, and `:149`.
  - Parameter Bar read-only behavior: `apps/editor/src/workspace/panels/parameter-bar.test.ts:200`.
  - Canvas Dynamics selection gate: `apps/editor/src/workspace/panels/canvas-preview-panel.test.ts:5`.
  - Dynamics additive output feeding Canvas keyform evaluation: `apps/editor/src/workspace/canvas/canvas-projection.test.ts:533`.
  - Dynamics create/update/delete history and preview state not adding history entries: `apps/editor/src/features/editor-session/editor-session-context-history.test.ts:177`.

## Verification / inspection commands performed

- `git status --short -uall`
- `git diff --stat -- apps/editor/src discussion/implementation/waves/wave81`
- `git diff -- apps/editor/src/features/editor-session/model/dynamics-tool-state.ts apps/editor/src/features/editor-session/model/editor-session-commands.ts apps/editor/src/features/editor-session/editor-session-context.tsx apps/editor/src/workspace/panels/dynamics-tool-inspector.tsx apps/editor/src/workspace/panels/parameter-bar.tsx apps/editor/src/workspace/panels/canvas-preview-panel.tsx`
- `node scripts/check-source-organization.mjs` - passed.
- `node scripts/check-dependencies.mjs` - passed.
- `rg -n "@private-2d-rigging-lab/runtime-core|computedDynamics|scalarDampedFollowV1|runDynamicsPreviewSequence|resetDynamicsPreviewState|Viewer|frame stepping|playback" apps/editor/src discussion/implementation/waves/wave81`
  - Found only reports and pre-existing Viewer files; no Domain B active Editor implementation reintroduced stale Dynamics operations or solver names.
- `rg -n "dynamics-file-v1|scalarDampedFollowV1|bindDynamicsDriver|bindDynamicsOutput|setDynamicsSettings|resetDynamicsPreviewState|runDynamicsPreviewSequence|computedDynamics" apps/editor/src/features/editor-session apps/editor/src/workspace/panels apps/editor/src/workspace/canvas -g "*.ts" -g "*.tsx"`
  - No matches.
- `rg --files apps/editor/src | rg "(^|/)(index|types|utils|helpers|schemas)\.ts$|(^|/)(index|types|utils|helpers|schemas)\.tsx$"`
  - No matches.
- `git diff --check -- apps/editor/src discussion/implementation/waves/wave81 discussion/implementation/reviews/wave81`
  - Passed; Git printed LF/CRLF warnings only.
- `pnpm.cmd exec vitest run apps/editor/src/features/editor-session/model/dynamics-tool-state.test.ts apps/editor/src/workspace/panels/dynamics-tool-inspector.test.ts apps/editor/src/workspace/panels/inspector-panel.test.ts apps/editor/src/workspace/panels/parameter-bar.test.ts apps/editor/src/workspace/panels/canvas-preview-panel.test.ts apps/editor/src/workspace/canvas/canvas-projection.test.ts apps/editor/src/features/editor-session/editor-session-context-history.test.ts`
  - Sandboxed attempt failed with esbuild `spawn EPERM`; approved rerun passed, 7 files / 47 tests.

## Residual risks

- No browser/manual visual QA was run for the Inspector layout. This lane verified source, SSR/component tests, model tests, Canvas projection tests, history tests, and guard commands.
- `discussion/development_convention/operation-policy.md` still contains older prose/examples for `runDynamicsPreviewSequence`; Wave81 explicitly supersedes persistent Dynamics preview operations, and no Domain B code uses those stale operation names.
- Pre-existing Viewer files still mention `computedDynamics` for Viewer read-only behavior. They were not changed by Domain B and are outside this review lane unless a future Viewer Dynamics wave changes that surface.
- The workspace remains broadly dirty from upstream Domain A package/fixture edits and some Editor projection/test fallout. This review treated those as upstream unless they directly affected Domain B boundaries.

## User-decision points

None.
