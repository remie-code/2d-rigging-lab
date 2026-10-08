# Wave81 Domain B Spec Compliance Review

## Verdict

pass

## Scope reviewed

- Wave: Wave81 `dynamics-tool-v0-additive-pendulum-contract`
- Domain B: `wave81-editor-dynamics-tool-authoring-preview`
- Review lane: Spec Compliance Review
- Reviewed the Domain B editor source/test changes, the Wave81 plan, Dynamics Tool component spec, Domain A implementation report and review artifacts, the Domain B implementation report, maps/backlog, and operation/schema conventions.
- No source or test files were edited by this review.

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
- `discussion/development_convention/operation-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`
- `discussion/implementation/waves/wave81/wave81-domain-b-editor-dynamics-tool-authoring-preview-report.md`

## Findings

No blocking or needs-change findings.

## Requirement coverage matrix

| Requirement | Review result | Evidence |
|---|---|---|
| `activeTool === "dynamics"` renders Dynamics Tool Inspector | pass | `apps/editor/src/workspace/panels/inspector-panel.tsx:29`-`34`; test at `apps/editor/src/workspace/panels/inspector-panel.test.ts:28`-`53` |
| Inspector includes group list/select, create, rename/update, delete, enabled, preset/defaults, Inputs, Advanced normalization, Pendulum, Outputs, Preview, Validation | pass | Group list/select `dynamics-tool-inspector.tsx:215`-`249`; name/enabled/preset `:253`-`:283`; Inputs `:287`-`:352`; Advanced `:356`-`:388`; Pendulum `:390`-`:417`; Outputs `:419`-`:465`; Validation `:467`-`:505`; Create/Apply/Delete `:507`-`:628`; Preview `:530`-`:617`; render test `dynamics-tool-inspector.test.ts:26`-`58` |
| Group list/selection is tool-local, not a global `EditorSelection` expansion | pass | Selection uses `dynamicsToolPreview.selectedGroupId` and `setDynamicsToolPreviewGroupId` in `dynamics-tool-inspector.tsx:61`-`90`; preview state is editor-local in `editor-session-context.tsx:432`; `rg` found no `kind: "dynamics"` / `dynamicsGroup` `EditorSelection` expansion under `apps/editor/src/features` or `apps/editor/src/workspace` |
| Multiple driver inputs can be added | pass | `addInputToDynamicsDraft` appends an input at `dynamics-tool-state.ts:235`-`250`; UI Add Input at `dynamics-tool-inspector.tsx:343`-`348`; test at `dynamics-tool-state.test.ts:45`-`56` |
| Output kind defaults to `angle` and can change among `angle | positionX | positionY` | pass | Default output kind at `dynamics-tool-state.ts:226`-`229`; output kind select at `dynamics-tool-inspector.tsx:429`-`440`; test at `dynamics-tool-inspector.test.ts:53`-`56` |
| Normalization defaults derive from parameter min/default/max and can be edited in Advanced | pass | Defaults at `dynamics-tool-state.ts:205`-`216`; parameter change refreshes normalization at `:273`-`:280`; Advanced fields at `dynamics-tool-inspector.tsx:356`-`384`; test at `dynamics-tool-state.test.ts:24`-`43` |
| Blocking validation is visible enough to prevent applying invalid config, including invalid normalization and duplicate output ownership | pass | Invalid normalization check `dynamics-tool-state.ts:360`-`371`; duplicate output ownership `:431`-`:443`; visible error/warning rows `dynamics-tool-inspector.tsx:467`-`504`; Create/Apply disabled on blocking issues at `:510`-`:522`; test at `dynamics-tool-state.test.ts:58`-`97` |
| Preview driver values are Inspector-local | pass | Preview state is React/editor-session local at `editor-session-context.tsx:432`; preview selection/driver/reset methods mutate only local state at `:871`-`:903`; driver controls call local preview setter at `dynamics-tool-inspector.tsx:553`-`583`; preview state is not part of operation payloads |
| Non-driver parameters resolve to defaults in Dynamics Tool preview | pass | Default parameter map uses initialized parameter defaults at `dynamics-tool-state.ts:663`-`668`; preview evaluation starts from defaults and only overlays driver values at `:631`-`:650`; test at `dynamics-tool-state.test.ts:139`-`146` |
| Preview applies Dynamics offset to output effective value before keyform/deformer evaluation | pass | Output summary computes `baseValue + offset` at `dynamics-tool-state.ts:798`-`807`; Canvas receives the effective Dynamics parameter map at `canvas-preview-panel.tsx:146`-`160`; projection test verifies evaluated rotation keyform uses additive output at `canvas-projection.test.ts:533`-`637` |
| Canvas shows evaluated model with preview map | pass | Dynamics mode switches Canvas projection from normal `parameterValues` to `dynamicsToolPreviewEvaluation.parameterValues` at `canvas-preview-panel.tsx:146`-`160`; `createCanvasRenderProjection` test verifies the evaluated deformer overlay receives the preview effective value at `canvas-projection.test.ts:619`-`637` |
| Preview reset resets Editor preview simulation state | pass | Reset updates local simulation state and reset serial at `dynamics-tool-state.ts:567`-`597`; reset state shape at `:845`-`:856`; UI reset at `dynamics-tool-inspector.tsx:607`-`614`; test at `dynamics-tool-state.test.ts:149`-`181` |
| Preview state is session-only, does not persist, and does not create operation history | pass | Preview state is local React state at `editor-session-context.tsx:432`; undo/redo/project load clear transients at `:537`-`:540`, `:593`-`:620`, and `:656`-`:670`; save exports only session/base document/editor-hidden part ids at `:623`-`:645`; preview methods do not call `runCommandWithHistory` at `:871`-`:903`; history test at `editor-session-context-history.test.ts:177`-`242` |
| Parameter Bar is disabled/read-only in Dynamics mode and cannot mutate parameter values/keyforms | pass | Dynamics read-only flag at `parameter-bar.tsx:51`-`52`; keyform action guard at `:101`-`:107`; controls disabled at `:147`-`:196` and `:216`-`:280`; slider/marker guards at `:332` and `:435`-`:440`; context-level guards for keyforms and parameter values at `editor-session-context.tsx:775`-`778` and `:910`-`:938`; test at `parameter-bar.test.ts:200`-`237` |
| Canvas Dynamics mode does not select Drawables or trigger Mesh/Rig editing interactions | pass | Selection gate returns false for Dynamics at `canvas-preview-panel.tsx:96`-`97`; Rig interactions are enabled only for `activeTool === "rig"` at `:177`-`:190`; left-click authoring interaction is blocked in Dynamics at `:399`-`:402`; click hit-test/select path returns before `selectDrawable` at `:524`-`:531`; test at `canvas-preview-panel.test.ts:5`-`11` |
| No reintroduction of `computedDynamics` requirement, stale v1 operations, or replace-style Dynamics output semantics | pass | Focused `rg` over Domain B files returned no matches for `computedDynamics`, `scalarDampedFollowV1`, `dynamics-file-v1`, `bindDynamicsDriver`, `bindDynamicsOutput`, `setDynamicsSettings`, `resetDynamicsPreviewState`, or `runDynamicsPreviewSequence`. `replace` matches in Domain B files were existing selection/keyform helper strings, not Dynamics output semantics. |

## Verification / inspection commands performed

- `git status --short -uall`
- `git diff -- apps/editor/src/features/editor-session/model/dynamics-tool-state.ts apps/editor/src/features/editor-session/editor-session-context.tsx apps/editor/src/workspace/panels/dynamics-tool-inspector.tsx apps/editor/src/workspace/panels/parameter-bar.tsx apps/editor/src/workspace/panels/canvas-preview-panel.tsx apps/editor/src/workspace/canvas/canvas-projection.test.ts`
- Focused source/test reads with line numbers for all Domain B changed files listed in the review request.
- `rg -n 'computedDynamics|scalarDampedFollowV1|dynamics-file-v1|bindDynamicsDriver|bindDynamicsOutput|setDynamicsSettings|resetDynamicsPreviewState|runDynamicsPreviewSequence' <Domain B files>` returned no matches.
- `rg -n 'interface EditorSelection|type EditorSelection|kind: "dynamics|dynamicsGroup' apps/editor/src/features apps/editor/src/workspace` returned no matches.
- `git diff --check -- <Domain B files>` passed with Windows LF/CRLF warnings only.
- `pnpm.cmd exec vitest run apps/editor/src/features/editor-session/model/dynamics-tool-state.test.ts apps/editor/src/workspace/panels/dynamics-tool-inspector.test.ts apps/editor/src/workspace/panels/inspector-panel.test.ts apps/editor/src/workspace/panels/parameter-bar.test.ts apps/editor/src/workspace/panels/canvas-preview-panel.test.ts apps/editor/src/workspace/canvas/canvas-projection.test.ts apps/editor/src/features/editor-session/editor-session-context-history.test.ts`
  - Sandboxed run failed before test loading with esbuild `spawn EPERM`.
  - Escalated rerun passed: 7 files / 47 tests.

## Residual risks

- No browser/manual visual QA was performed in this review; verification is by source inspection plus focused model/component/provider/projection tests.
- The Domain B report's preset-parameter residual risk is real: editor parameter helpers can expose initialized preset parameters, while the current headless Dynamics mutation path still validates bindings against persisted `graph.parameters`. Focused committed-operation tests use explicit graph parameters, so this does not block the inspected Domain B UI/preview/gating requirements, but it should remain visible for the later preset-binding authority cleanup.
- Canvas Dynamics mode blocks new Canvas selection/edit starts, but it does not clear an already-existing workspace selection. I did not treat that as a violation because the requirement is to prevent Canvas selection/editing interactions in Dynamics mode, not to erase selection state on tool switch.

## User-decision points

None for this review lane.
