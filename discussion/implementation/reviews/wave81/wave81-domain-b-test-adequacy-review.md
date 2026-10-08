# Wave81 Domain B Test Adequacy Review

## Verdict

pass

## Scope reviewed

- Wave: Wave81 `dynamics-tool-v0-additive-pendulum-contract`
- Domain B: `wave81-editor-dynamics-tool-authoring-preview`
- Review lane: Test Adequacy Review
- Reviewed the Wave81 plan, Dynamics Tool component spec, Domain A report/reviews, Domain B implementation report, required development policies, Domain B source/tests, current worktree status, focused test inventory, and selected source/test diffs.
- Did not edit source or tests.

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
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/operation-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`
- `discussion/implementation/waves/wave81/wave81-domain-b-editor-dynamics-tool-authoring-preview-report.md`

## Findings

No blocking or needs-change findings.

## Coverage matrix

| Required coverage | Evidence reviewed | Adequacy |
|---|---|---|
| Dynamics tool renders Dynamics Inspector | `apps/editor/src/workspace/panels/inspector-panel.tsx:33` renders `DynamicsToolInspector`; `apps/editor/src/workspace/panels/inspector-panel.test.ts:29`-`53` proves active Dynamics mode renders it. | Sufficient |
| Group list/create/edit/delete flows are available and committed via operation/history where appropriate | Inspector list/actions exist at `apps/editor/src/workspace/panels/dynamics-tool-inspector.tsx:138`-`179` and `:216`-`244`; operation wrappers use `create/update/deleteDynamicsGroup` at `apps/editor/src/features/editor-session/model/editor-session-commands.ts:392`-`419`; provider routes them through history at `apps/editor/src/features/editor-session/editor-session-context.tsx:844`-`868`; history test covers create/update/delete undo behavior at `apps/editor/src/features/editor-session/editor-session-context-history.test.ts:177`-`238`. | Sufficient |
| Input rows can add multiple driver inputs | `addInputToDynamicsDraft` appends instead of replacing at `apps/editor/src/features/editor-session/model/dynamics-tool-state.ts:235`-`250`; test covers two unique inputs at `apps/editor/src/features/editor-session/model/dynamics-tool-state.test.ts:45`-`56`; Inspector exposes Add Input at `apps/editor/src/workspace/panels/dynamics-tool-inspector.tsx:343`-`350`. | Sufficient |
| Output kind defaults/selects correctly | Default output kind is `angle` at `apps/editor/src/features/editor-session/model/dynamics-tool-state.ts:226`-`229`; Inspector select exposes `angle`, `positionX`, `positionY` at `apps/editor/src/workspace/panels/dynamics-tool-inspector.tsx:429`-`440`; tests assert default/options at `apps/editor/src/features/editor-session/model/dynamics-tool-state.test.ts:24`-`42` and `apps/editor/src/workspace/panels/dynamics-tool-inspector.test.ts:53`-`56`. | Sufficient |
| Advanced normalization defaults from parameter min/default/max | Default input normalization copies parameter `min/default/max` at `apps/editor/src/features/editor-session/model/dynamics-tool-state.ts:205`-`216`; Advanced UI edits min/center/max at `apps/editor/src/workspace/panels/dynamics-tool-inspector.tsx:356`-`383`; test asserts defaults at `apps/editor/src/features/editor-session/model/dynamics-tool-state.test.ts:24`-`38`. | Sufficient |
| Invalid normalization appears as blocking validation | Validation emits `dynamicsTool.normalizationInvalid` as an error at `apps/editor/src/features/editor-session/model/dynamics-tool-state.ts:360`-`370`; blocking state disables create/apply at `apps/editor/src/workspace/panels/dynamics-tool-inspector.tsx:106`, `:511`, and `:521`; test asserts error severity at `apps/editor/src/features/editor-session/model/dynamics-tool-state.test.ts:58`-`97`. | Sufficient |
| Duplicate output ownership appears as blocking validation | Duplicate output owner check is at `apps/editor/src/features/editor-session/model/dynamics-tool-state.ts:431`-`443`; same blocking create/apply path above; test asserts `dynamicsTool.outputOwnershipDuplicate` error at `apps/editor/src/features/editor-session/model/dynamics-tool-state.test.ts:58`-`97`. | Sufficient |
| Parameter Bar is disabled/read-only in Dynamics mode and cannot mutate normal parameter values/keyforms | Component sets Dynamics read-only/disabled state and blocks keyform actions at `apps/editor/src/workspace/panels/parameter-bar.tsx:101`-`107`, `:135`-`220`, and `:224`-`275`; marker clicks return when disabled at `:435`-`440`; provider guards parameter value/reset/keyform mutation at `apps/editor/src/features/editor-session/editor-session-context.tsx:775`-`778`, `:910`-`938`; component test proves Dynamics mode cannot scrub or jump values at `apps/editor/src/workspace/panels/parameter-bar.test.ts:200`-`237`. | Sufficient, with residual risk below |
| Canvas preview uses non-driver defaults and Inspector-local driver values | Preview map starts from defaults at `apps/editor/src/features/editor-session/model/dynamics-tool-state.ts:600`-`650` and `:663`-`668`, then overlays preview driver values; model test asserts driver value and non-driver default at `apps/editor/src/features/editor-session/model/dynamics-tool-state.test.ts:99`-`147`; Canvas panel uses the Dynamics preview map instead of normal Parameter Bar values at `apps/editor/src/workspace/panels/canvas-preview-panel.tsx:146`-`160`. | Sufficient |
| Canvas preview applies additive output offset before keyform/deformer evaluation | Additive output summary computes `baseValue + offset` at `apps/editor/src/features/editor-session/model/dynamics-tool-state.ts:787`-`807`; Canvas projection test proves offset `5` drives rotation keyform evaluation to `evaluatedAngleDegrees: 5` at `apps/editor/src/workspace/canvas/canvas-projection.test.ts:533`-`638`. | Sufficient |
| Canvas Dynamics mode does not select/edit | `isCanvasAuthoringSelectionEnabled("dynamics")` is false at `apps/editor/src/workspace/panels/canvas-preview-panel.tsx:96`-`98` and tested at `apps/editor/src/workspace/panels/canvas-preview-panel.test.ts:5`-`11`; pointer down returns before selection/deformer starts at `apps/editor/src/workspace/panels/canvas-preview-panel.tsx:399`-`402`, selection finish is gated at `:524`-`531`, and rig handle hooks are enabled only in Rig mode at `:180` and `:190`. | Sufficient |
| Preview reset resets simulation state | Reset source/model behavior is covered at `apps/editor/src/features/editor-session/model/dynamics-tool-state.test.ts:149`-`180`; provider exposes reset as local state update at `apps/editor/src/features/editor-session/editor-session-context.tsx:893`-`901`; Inspector reset button calls it at `apps/editor/src/workspace/panels/dynamics-tool-inspector.tsx:607`-`614`. | Sufficient |
| Preview state is session-only/no operation history/no persistence | Preview is React local state at `apps/editor/src/features/editor-session/editor-session-context.tsx:432`-`433`; preview setters only call local state at `:871`-`901`; save exports only session/base document/editor hidden IDs at `:628`-`632`; undo/redo/load clear transient preview state at `:537`-`540`, `:593`-`620`, and `:656`-`670`; history test proves preview select/driver/reset do not add another undo entry at `apps/editor/src/features/editor-session/editor-session-context-history.test.ts:177`-`238`. | Sufficient, with residual risk below |
| No stale replace semantics or `computedDynamics` requirement in tests | Focused stale search found no active `computedDynamics`, `scalarDampedFollowV1`, `dynamics-file-v1`, preview operation IDs, or replacement-output assertions in Domain B source/tests; remaining `driverValues` matches are the new Inspector-local preview state, and `compositionMode: "replace"` matches are unrelated keyform/deformer test fixtures. | Sufficient |

## Verification commands performed and results

- `git status --short -uall`: reviewed current dirty worktree. Domain B editor files are modified/untracked; upstream Domain A/package/fixture files are also dirty and were treated as upstream unless directly relevant.
- `rg -n "describe|it\(" ...`: inspected focused Domain B test inventory across Dynamics state, Inspector, Parameter Bar, Canvas panel/projection, and provider history tests.
- Focused Vitest command from the Domain B report:
  - `pnpm.cmd exec vitest run apps/editor/src/features/editor-session/model/dynamics-tool-state.test.ts apps/editor/src/workspace/panels/dynamics-tool-inspector.test.ts apps/editor/src/workspace/panels/inspector-panel.test.ts apps/editor/src/workspace/panels/parameter-bar.test.ts apps/editor/src/workspace/panels/canvas-preview-panel.test.ts apps/editor/src/workspace/canvas/canvas-projection.test.ts apps/editor/src/features/editor-session/editor-session-context-history.test.ts`
  - Result: sandbox run failed before loading tests with esbuild `spawn EPERM`. Escalated rerun was not authorized for this review task, so I did not independently confirm the Gnome-reported escalated pass.
- `pnpm.cmd typecheck`: passed.
- `node scripts/check-source-organization.mjs`: passed.
- `node scripts/check-dependencies.mjs`: passed.
- `git diff --check -- apps/editor/src discussion/implementation/waves/wave81 discussion/implementation/reviews/wave81`: passed; Git printed LF/CRLF conversion warnings only.
- `rg -n "runDynamicsPreviewSequence|resetDynamicsPreviewState|scalarDampedFollowV1|dynamics-file-v1|computedDynamics|replace-style|replace style|outputValue|driverValues" apps/editor/src/features/editor-session apps/editor/src/workspace/panels apps/editor/src/workspace/canvas`: no stale v1 active behavior found; only local preview `driverValues` naming and unrelated non-Dynamics `compositionMode` strings appeared.

## Remaining test gaps / residual risks

- Focused Vitest was not independently rerun to completion in this review because the sandbox blocked esbuild startup with `spawn EPERM`, and unsandboxed rerun approval was rejected. The implementation report records an escalated pass, but this review's own command result is the sandbox failure.
- The Inspector test is static SSR coverage plus provider/history tests; it does not simulate real button clicks for create/apply/delete. Source wiring and provider history tests make this non-blocking for this lane.
- Parameter Bar Dynamics mode has a component test for no scrub/jump mutation and provider/source guards for reset/keyform mutation. There is no separate direct provider test that calls `editKeyformKey` while `activeTool === "dynamics"`.
- Preview persistence is source-proven by local React state and export/load cleanup, and history-proven for undo entries. There is no explicit save/load roundtrip test that sets a Dynamics preview value before saving and asserts it is absent after load.
- Canvas Dynamics selection/edit gating is source-proven with a small exported-helper unit test. There is no full pointer-event component test that clicks the Canvas in Dynamics mode.

## User-decision points

None.
