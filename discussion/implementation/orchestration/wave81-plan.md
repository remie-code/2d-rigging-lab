# Wave 81 Plan: Dynamics Tool v0 + Additive Pendulum Runtime Contract

> Wave80でViewer / Runtime Viewの確認体験が整い、次の大きな表現価値はDynamics / Physicsである。Wave81はViewer playbackを先に作らず、Authoring WorkspaceにDynamics Tool v0を追加し、複数driver入力から1つの仮想振り子offsetを計算して既存parameterへ加算する基礎を実装する。

## 1. Status

- Status: Planned / ready for orchestration
- Target wave: Wave81
- Wave name: `dynamics-tool-v0-additive-pendulum-contract`
- Primary objective:
  - Dynamics schemaをaccepted v0に置き換え、`dynamics-file-v2`として保存復元できるようにする。
  - 古い`computedDynamics`必須、`scalarDampedFollowV1`、replace風resolution、未接続preview operationsなどのDynamics残骸を削除またはv2へ置換する。
  - 複数driver input、1 pendulum、1 outputのDynamics Groupをoperation/history/validation対象にする。
  - runtime-coreに`base parameter value + one Dynamics Group offset`のeffective value contractを実装する。
  - EditorにDynamics Tool Inspectorを追加し、group list/create/edit/delete、inputs、pendulum、output、validation、Inspector-local preview controlsを提供する。
  - Dynamics Tool中はParameter Barを通常編集不可にし、Canvasはnon-driver default + Inspector-local driver preview + Dynamics offsetで調整用previewを表示する。
  - Viewer v1、time controls、mixer、多段pendulum、複数output、frame steppingは対象外。

## 2. Planning Gate Result

Planning Gate result: `Inventory first`, then `Plan directly`.

Why planning is now safe:

- Dynamics Tool UX is captured in [Dynamics Tool Component Spec](../../design/screen-design/components/dynamics-tool.md).
- User decisions are explicit:
  - Dynamics v0 is `multiple inputs -> one pendulum -> one output`.
  - Output model is additive offset, not replace.
  - Same output parameter owned by multiple Dynamics Groups is forbidden.
  - Output parameter can be an existing preset/custom scalar parameter.
  - Output kind defaults to `angle` and is user-selectable.
  - Input normalization UI is Advanced; defaults come from parameter min/default/max.
  - Dynamics Tool preview uses default values for non-driver parameters.
  - Parameter Bar is disabled for normal editing during Dynamics Tool.
  - Viewer v1 is not implemented in this wave.
  - Frame stepping is not needed.
  - Old Dynamics remnants should not remain if they are superseded by v2.
- Read-only Sylph inventory confirmed:
  - `activeTool === "dynamics"` and Toolbox entry already exist, but Inspector / Canvas / Parameter Bar integration is missing.
  - Existing Dynamics schema/operations/runtime/validation are stale and still assume `computedDynamics`, `scalarDampedFollowV1`, and replace-style output.
  - The correct injection boundary is the effective parameter map before keyform/deformer evaluation.
  - Save/load paths already include Dynamics, but the serialized shape is stale.

Uncertainty:

- factual: medium. The old Dynamics implementation is spread across package-format, operation-core, authoring-core, validator-core, runtime-core, and Editor references.
- decision: low. Product/UX decisions are settled.
- cost of wrong plan: high. Keeping stale v1 semantics or patching only the Editor preview would make Viewer/runtime Dynamics harder and more confusing later.

## 3. Accepted Decisions / Oracles

### 3.1 Dynamics Tool Meaning

- Dynamics Tool is an Authoring Workspace Active Tool.
- Dynamics Tool creates and edits Dynamics Groups.
- Dynamics Tool preview is an authoring adjustment preview, not finished-model Viewer playback.
- Viewer consumes authored Dynamics later; Viewer does not define this wave's Dynamics contract.
- Dynamics Tool does not edit mesh vertices directly.
- Dynamics Tool does not create motion timelines, transport controls, frame stepping, collision, cloth, IK, or Cubism compatibility.

### 3.2 Dynamics v0 Shape

Required v0 shape:

```text
DynamicsGroup
  inputs.length >= 1
  pendulums.length === 1
  outputs.length === 1
```

Input:

```text
parameterId
kind: angle | positionX | positionY
influencePercent
invert
normalization: min / center / max
```

Pendulum:

```text
length
sway
reactionSpeed
convergenceSpeed
```

Output:

```text
parameterId
kind: angle | positionX | positionY
strength
invert
limit
```

### 3.3 Additive Offset Contract

- Dynamics output is an offset, not an absolute parameter value.
- v0 effective value:

```text
effective output = base output + one Dynamics Group offset
```

- Runtime base output can come from authored/default/runtime input.
- Dynamics Tool preview uses default values for non-driver parameters, so its output base is usually the output parameter default.
- Runtime/evaluation code must preserve the future Viewer semantics of `runtime input base + Dynamics offset`.
- No `replace` mode is implemented.
- No hidden multiple-Dynamics mixer is implemented.

### 3.4 Output Ownership

- One output parameter may be owned by at most one Dynamics Group.
- Duplicate output ownership is blocking invalid.
- Same-output multi-group blending is Future scope and requires explicit Mixer / Blend design.
- v0 must not silently choose the first enabled group when duplicates exist.

### 3.5 Schema Strategy and Stale Remnant Removal

- New accepted schema uses `dynamics-file-v2`.
- Wave81 does not preserve old v1 semantics as a compatibility target.
- If old v1 fixtures/tests exist only to assert stale behavior, update or delete them.
- Do not keep adapter code solely to support:
  - output parameter `valueSource === "computedDynamics"` as a requirement;
  - `scalarDampedFollowV1`;
  - replacement-style computed output;
  - persistent preview sequence/reset operations;
  - old `drivers[] -> output -> scalar settings` authoring assumptions.
- If a stale remnant is still required by an unrelated active capability, it must be explicitly reported with the path and reason.

### 3.6 Editor Preview Policy

- Dynamics Tool preview values are session-only.
- Preview driver values are Inspector-local.
- Preview does not commit operations while scrubbing.
- Preview does not mutate normal `parameterValues`.
- Preview does not persist in save/load.
- Dynamics Tool Canvas mode:
  - uses all parameter defaults as the initial map;
  - applies Inspector-local driver preview values;
  - steps/evaluates the selected Dynamics Group preview state;
  - adds the output offset to the output base;
  - passes the effective map into existing keyform/deformer/render evaluation.
- Dynamics mode must disable normal selection hit-test, mesh editing, rig editing, and authoring operations on Canvas.

### 3.7 Parameter Bar Policy

- Parameter Bar may remain visible during Dynamics Tool.
- Parameter Bar is disabled/read-only for normal parameter editing during Dynamics Tool.
- The disabled state should make it clear that Dynamics preview controls live in the Inspector.
- Parameter Bar must not create keyforms, scrub authored parameter values, or commit parameter operations while `activeTool === "dynamics"`.

## 4. Primary Basis

Common:

- [Implementation Orchestration Skill](../../../.agents/skills/implementation-orchestration/SKILL.md)
- [UX-Backed Package Logic Authority](../../development_convention/ux-backed-package-logic-authority.md)
- [Source File Organization Policy](../../development_convention/source-file-organization-policy.md)
- [Dependency Policy](../../development_convention/dependency-policy.md)
- [Operation Policy](../../development_convention/operation-policy.md)
- [Schema and ID Conventions](../../development_convention/schema-and-id-conventions.md)

Screen / UX basis:

- [Dynamics Tool Component Spec](../../design/screen-design/components/dynamics-tool.md)
- [Screen Design Components Map](../../design/screen-design/components/_map.md)
- [Screen Design Map](../../design/screen-design/_map.md)
- [React Editor Foundation Oracle](../../design/screen-design/react-editor-foundation-oracle.md)
- [E2E Oracle](../../design/screen-design/e2e-oracle.md)

Wave baseline:

- [Wave80 Plan](wave80-plan.md)
- [Wave80 Final Integration Report](../waves/wave80/wave80-final-integration-report.md)
- [Wave80 Final Clean Integration Review](../reviews/wave80/wave80-final-clean-integration-review.md)
- [Remaining Work Backlog](../remaining-work-backlog.md)

Read-only inventory facts:

- `activeTool` already supports `"dynamics"` in `apps/editor/src/state/editor-ui-store.ts`.
- Toolbox already exposes a Dynamics button through `apps/editor/src/workspace/workspace-data.ts` and `apps/editor/src/workspace/toolbox/workspace-toolbox.tsx`.
- Inspector currently branches only for Mesh and Rig; Dynamics falls through to selection inspectors.
- Canvas currently has no Dynamics preview input.
- Canvas click selection is not fully gated for Dynamics mode.
- Parameter Bar has no global disabled/read-only mode.
- Package save/load already includes Dynamics, but the shape is stale.
- Current operation/validator/runtime code assumes `computedDynamics` and replace-style output.
- Correct injection boundary is the effective parameter map before keyform/deformer evaluation:
  - runtime-core around `parameter-resolution.ts`;
  - Editor Canvas preview before `createEvaluatedParameterKeyformState` / `createCanvasRenderProjection`.

## 5. Review Policy

Each implementation domain requires three review lanes unless explicitly documented as not applicable:

1. `Spec Compliance Review`
   - Check every Wave81 Dynamics v0 requirement and every explicit non-goal.
   - Treat stale v1 semantics left behind in active code as blocking unless explicitly justified.
2. `Design / Development Compliance Review`
   - Check package/editor boundaries, operation policy, session-only preview state, source organization, and stale-remnant removal.
3. `Test Adequacy Review`
   - Check schema, operations, validation, runtime additive offset, save/load, Inspector behavior, Parameter Bar disablement, Canvas preview, and negative cases.

Domain reports must include:

- Basis Coverage Self-Report
- Stale Dynamics Remnant Removal Report
- Additive Offset Contract Trace
- Effective Parameter Injection Trace
- Save/Load Trace
- UI/Preview Trace where applicable
- Must-not Compliance Evidence
- Residual Risk Classification

## 6. Wave Strategy

```text
Batch 1:
  Domain A: Headless Dynamics v2 Contract + Additive Runtime + Stale Removal

Batch 2:
  Domain B: Editor Dynamics Tool + Authoring Preview

Batch 3:
  Domain C: Final Integration / Clean Review / Map Closeout
```

Dependency rationale:

- Domain A owns the canonical data/runtime/operation/validation contract. Domain B must not build UI against stale v1 semantics.
- Splitting Domain A into separate schema/runtime/validator domains would increase the chance of inconsistent intermediate semantics and duplicate stale-remnant work.
- Domain B depends on Domain A and owns Editor-only tool state, Inspector, Canvas preview, and Parameter Bar disablement.
- Domain C runs only after A/B pass or explicit escalation.

## 7. Acceptance Criteria

### 7.1 Dynamics File v2 Contract

Required:

- New persisted Dynamics schema is `dynamics-file-v2`.
- Dynamics Group stores `inputs[]`, `pendulums[]`, and `outputs[]`.
- v0 cardinality is validated:
  - `inputs.length >= 1`;
  - `pendulums.length === 1`;
  - `outputs.length === 1`.
- Input normalization includes `min`, `center`, `max`.
- Output includes `kind`, `strength`, `limit`, and `invert`.
- Output parameter may reference an existing preset/custom scalar parameter.
- Output parameter is not required to have `valueSource === "computedDynamics"`.
- Portable project save/load preserves Dynamics v2 data.

Must not:

- Keep `dynamics-file-v1` behavior as the active implementation target.
- Keep `scalarDampedFollowV1` as the accepted v0 solver.
- Require `computedDynamics` parameters for outputs.
- Claim backward-compatible migration unless actually implemented and tested.

### 7.2 Operations / Authoring Mutations

Required:

- History-backed operations can create, update, and delete Dynamics Groups.
- Create/update validates required refs and v0 cardinality.
- Operations write the v2 shape.
- Preview state is not persisted through operations.
- Existing operation registry no longer advertises unsupported stale Dynamics operations as active behavior.
- If separate bind/settings operations remain, they must either be implemented against v2 or removed from active operation catalogs.

Must not:

- Commit preview scrubbing as operation history.
- Keep delete/bind/preview operation payloads as apparent active API when no handler exists.
- Enforce old computed-output restrictions.

### 7.3 Validation / Product Preflight

Blocking diagnostics:

- missing input;
- missing output;
- missing referenced driver parameter;
- missing referenced output parameter;
- invalid v0 cardinality;
- invalid normalization, such as `min >= center` or `center >= max`;
- duplicate output ownership across Dynamics Groups.

Warning diagnostics:

- all input influences are zero;
- output strength is zero;
- output limit is zero or too small to show visible motion;
- pendulum coefficients are extreme or likely unstable.

Must not:

- Require output parameter `computedDynamics`.
- Require old runtime evidence for replacement-style computed output.
- Silently pass duplicate output ownership because runtime picks the first group.

### 7.4 Runtime Additive Pendulum Evaluation

Required:

- Runtime state stores pendulum-oriented mutable state, such as:
  - angle;
  - angular velocity;
  - previous source;
  - previous source velocity.
- Shared solver boundary resembles:

```text
stepDynamics(definition, previousState, inputValues, dt)
  -> nextState
  -> outputOffsets
```

- Runtime effective parameter resolution uses:

```text
base = authored/default/runtime input value
offset = Dynamics Group output offset
effective = clamp(base + offset)
```

- Effective value is injected before keyform/deformer evaluation.
- The same effective map drives keyform sampling, deformer evaluation, and rendering.
- Dynamics reset initializes mutable simulation state deterministically.
- Runtime tests prove base input plus offset semantics.

Must not:

- Replace base value with Dynamics output.
- Depend on `parameter.valueSource === "computedDynamics"` to apply Dynamics.
- Apply more than one Dynamics Group offset to the same output parameter.

### 7.5 Editor Dynamics Inspector

Required:

- `activeTool === "dynamics"` renders a Dynamics Tool Inspector instead of falling through to selection inspectors.
- Inspector includes:
  - Dynamics Group list/select;
  - create group;
  - rename/update group;
  - delete group;
  - enabled toggle if practical;
  - creation preset or initial preset defaults;
  - Inputs section;
  - Advanced normalization section;
  - Pendulum section;
  - Outputs section;
  - Preview section;
  - Validation section.
- Multiple driver inputs can be added.
- Output kind defaults to `angle` and can be changed by the user.
- Normalization defaults are derived from parameter min/default/max and can be edited in Advanced.
- Validation errors are visible enough to prevent applying invalid configuration.

Must not:

- Add a global `EditorSelection` kind for Dynamics Group unless current implementation facts make tool-local state impossible.
- Put Dynamics Group management in Parameter Manager.
- Require Viewer to edit Dynamics.

### 7.6 Editor Dynamics Preview

Required:

- Preview driver values are Inspector-local.
- Non-driver parameters resolve to defaults.
- Preview applies Dynamics offset to the output effective value.
- Canvas shows the evaluated model with the preview effective parameter map.
- Preview state is session-only and does not persist.
- Preview scrubbing does not create operation history.
- Reset simulation resets the Editor preview simulation state.

Must not:

- Use normal Parameter Bar current values as preview drivers.
- Mix current authored pose into Dynamics Tool preview.
- Persist preview state in save/load.
- Implement Viewer time progression UI in Wave81.

### 7.7 Parameter Bar and Canvas Interaction Gating

Required:

- Parameter Bar is disabled/read-only while `activeTool === "dynamics"`.
- Disabled state communicates that Dynamics preview controls live in the Inspector.
- Parameter Bar cannot edit parameter values or create/update/delete keyforms in Dynamics mode.
- Canvas in Dynamics mode keeps viewing navigation available where already supported.
- Canvas in Dynamics mode does not perform selection hit-test or select Drawables on click.
- Canvas in Dynamics mode does not edit mesh, warp, rotation, keyforms, or deformer handles.

Must not:

- Mutate normal authoring parameter state during Dynamics preview.
- Create operation history from Canvas interactions in Dynamics mode.
- Leak Mesh/Rig draft interactions into Dynamics mode.

## 8. Domain Design

| Batch | Domain | Dependency | Purpose |
|---|---|---|---|
| 1 | A. Headless Dynamics v2 Contract + Additive Runtime + Stale Removal | Wave80 pass baseline | Replace stale Dynamics contract, implement additive runtime/effective values, update operations/validation/persistence, delete stale remnants |
| 2 | B. Editor Dynamics Tool + Authoring Preview | Domain A pass | Add Dynamics Inspector, tool-local preview state, Canvas preview mode, and Parameter Bar disablement |
| 3 | C. Final Integration / Clean Review / Map Closeout | Domains A-B pass or explicit escalation | Combined validation, clean review, reports/maps |

## 9. Domain A: `wave81-headless-dynamics-v2-contract-additive-runtime`

Purpose:

- Establish the canonical Dynamics v2 contract and remove stale v1 behavior from active package/runtime/operation/validation paths.

Expected implementation areas:

- `packages/package-format/src/model-files.ts`
- `packages/contracts/src/runtime-state.ts`
- `packages/runtime-core/src/dynamics-evaluation.ts`
- `packages/runtime-core/src/parameter-resolution.ts`
- `packages/runtime-core/src/runtime-core.ts`
- `packages/runtime-core/src/snapshot.ts`
- `packages/runtime-core/src/normalized-runtime-graph.ts`
- `packages/operation-core/src/payloads/dynamics.ts`
- `packages/operation-core/src/operations/*dynamics*`
- `packages/operation-core/src/operation-registry.ts`
- `packages/authoring-core/src/dynamics-mutations.ts`
- `packages/authoring-core/src/authoring-graph.ts`
- `packages/authoring-core/src/package-document-from-authoring-session.ts`
- `packages/authoring-core/src/package-document-model-files.ts`
- `packages/authoring-core/src/portable-project-bundle.ts`
- `packages/validator-core/src/validators/dynamics-semantic.ts`
- `packages/validator-core/src/check-catalog.ts`
- Relevant package tests and fixtures

Conditional write scope, requiring report justification:

- `apps/editor/src/features/editor-session/model/parameter-manager-projection.ts`
- `packages/ai-interface/**` if operation catalog/type generation references stale Dynamics operations
- Shared test fixtures that encode old Dynamics v1 assumptions

Forbidden write scope:

- Editor UI component implementation, except conditional projection/type fallout listed above
- Viewer UI
- Mesh generation
- Deformer editing
- Parameter Bar UI
- Canvas UI interactions
- New external dependencies
- Cubism compatibility or import/export

Required tests / evidence:

- Dynamics v2 schema accepts the new shape and rejects invalid cardinality/normalization.
- Create/update/delete Dynamics Group operations work through operation-core/authoring-core.
- Duplicate output ownership is blocking invalid.
- Output parameter does not require `computedDynamics`.
- Runtime `base + offset` is proven by unit tests.
- Runtime reset is deterministic.
- Save/load/portable bundle preserves Dynamics v2 data.
- Stale v1 tests/fixtures/operation catalog entries are updated or deleted.
- `pnpm typecheck` impact is assessed; if Domain B is needed to restore full typecheck, Domain A report must state the remaining expected compile fallout precisely.

Early escape triggers:

- Removing old v1 remnants breaks a current non-Dynamics capability.
- Existing package schema requires backward migration for active user data and cannot safely reject v1.
- Effective parameter injection requires broad runtime snapshot redesign.
- Operation registry/catalog behavior cannot cleanly remove unsupported stale Dynamics operations.
- Additive output semantics conflict with existing parameter model in a way that needs user decision.

## 10. Domain B: `wave81-editor-dynamics-tool-authoring-preview`

Purpose:

- Expose Dynamics v0 as a usable Editor Active Tool and provide authoring preview without contaminating normal parameter editing state.

Expected implementation areas:

- `apps/editor/src/workspace/panels/inspector-panel.tsx`
- `apps/editor/src/workspace/panels/parameter-bar.tsx`
- `apps/editor/src/workspace/panels/canvas-preview-panel.tsx`
- `apps/editor/src/workspace/canvas/canvas-projection.ts`
- `apps/editor/src/workspace/canvas/canvas-evaluation.ts`
- `apps/editor/src/features/editor-session/**`
- New Dynamics Tool Inspector/component/model files under existing Editor structure
- Focused Editor tests near touched files

Allowed write scope:

- `apps/editor/src/**`
- Editor-focused tests
- `discussion/implementation/waves/wave81/**`
- `discussion/implementation/reviews/wave81/**`

Conditional write scope, requiring report justification:

- `packages/**` only for type fallout or small helper exports discovered after Domain A

Forbidden write scope:

- Reintroducing stale `computedDynamics` output requirements
- Viewer v1 implementation
- Viewer playback/time controls
- Frame stepping
- Mixer / same-output multi-group blending
- Multi-pendulum or multi-output authoring
- Mesh/deformer/keyform feature changes unrelated to Dynamics preview gating
- New external dependencies

Required tests / evidence:

- Dynamics tool renders Dynamics Inspector.
- Dynamics group list/create/edit/delete flows are available.
- Input rows can add multiple driver inputs.
- Output kind defaults to `angle` and can be selected.
- Advanced normalization defaults from parameter min/default/max.
- Invalid normalization and duplicate output ownership appear as blocking validation.
- Parameter Bar is disabled/read-only in Dynamics mode.
- Parameter Bar does not mutate normal parameter values or keyforms in Dynamics mode.
- Canvas preview uses non-driver defaults and Inspector-local driver preview values.
- Canvas preview applies output additive offset before keyform/deformer evaluation.
- Canvas Dynamics mode does not select Drawables or trigger Mesh/Rig editing interactions.
- Preview reset resets Editor preview simulation state.
- Preview state is not persisted and does not create operation history.

Early escape triggers:

- Dynamics Inspector cannot be added without global EditorSelection expansion.
- Canvas preview cannot receive a tool-specific effective parameter map without broad Canvas architecture rewrite.
- Parameter Bar disablement requires rewriting unrelated keyform authoring behavior.
- Domain A contract remains unresolved or incompatible.
- UI implementation needs Viewer v1 to demonstrate basic Dynamics preview.

## 11. Domain C: `wave81-final-integration-clean-review-map-closeout`

Purpose:

- Validate combined Wave81 behavior, obtain independent clean review, and update persistent maps/reports.

Expected implementation areas:

- `discussion/implementation/waves/wave81/**`
- `discussion/implementation/reviews/wave81/**`
- `discussion/implementation/_map.md`
- `discussion/implementation/orchestration/_map.md`

Acceptance:

- Domain A/B reports exist and record `pass` or explicit escalation.
- Required review lanes exist and pass, or explicit escalation is recorded.
- Final clean integration review exists and passes before Wave81 is marked complete.
- Final report records:
  - Dynamics v2 schema and stale removal result;
  - additive offset runtime contract;
  - effective parameter injection boundary;
  - save/load proof;
  - operation/history proof;
  - validation proof;
  - Editor Dynamics Inspector behavior;
  - Parameter Bar disablement;
  - Canvas Dynamics preview behavior;
  - forbidden scope compliance;
  - validation results;
  - residual risks.
- Maps mark Wave81 status correctly.

Required checks:

- `pnpm typecheck`
- Focused package-format Dynamics schema tests
- Focused authoring-core Dynamics mutation/save-load tests
- Focused operation-core Dynamics operation tests
- Focused validator-core Dynamics semantic tests
- Focused runtime-core Dynamics additive offset tests
- Focused Editor Dynamics Tool tests
- Focused Canvas/Parameter Bar gating tests
- `node scripts/check-source-organization.mjs`
- `node scripts/check-dependencies.mjs`
- `git diff --check`

## 12. Verification Matrix

| Requirement | Minimum evidence |
|---|---|
| `dynamics-file-v2` schema exists | package-format test |
| old computed output requirement removed | authoring/validator negative tests |
| stale `scalarDampedFollowV1` not active | source review plus tests/catalog check |
| create/update/delete Dynamics Group | operation-core + authoring-core tests |
| save/load preserves v2 data | portable bundle/editor storage or package serializer test |
| invalid normalization blocks | validator/authoring test |
| duplicate output ownership blocks | validator/authoring test |
| runtime uses base + offset | runtime-core parameter-resolution/dynamics test |
| effective values feed keyforms/deformers | runtime snapshot or Editor canvas evaluation test |
| Inspector renders in Dynamics mode | Editor component test |
| multiple driver inputs authorable | Inspector/model test |
| output kind defaults/selects | Inspector/model test |
| Parameter Bar disabled | Parameter Bar/workspace test |
| Canvas preview uses default non-drivers | Canvas projection/model test |
| Canvas preview does not select/edit | Canvas interaction test or source review evidence |
| preview state session-only | state/history test |
| Viewer v1 not implemented | final report forbidden-scope evidence |

## 13. Expected Persistent Artifacts

Reports:

- `discussion/implementation/waves/wave81/wave81-domain-a-headless-dynamics-v2-contract-additive-runtime-report.md`
- `discussion/implementation/waves/wave81/wave81-domain-b-editor-dynamics-tool-authoring-preview-report.md`
- `discussion/implementation/waves/wave81/wave81-final-integration-report.md`
- `discussion/implementation/waves/wave81/_map.md`

Reviews:

- `discussion/implementation/reviews/wave81/wave81-domain-a-spec-compliance-review.md`
- `discussion/implementation/reviews/wave81/wave81-domain-a-design-development-review.md`
- `discussion/implementation/reviews/wave81/wave81-domain-a-test-adequacy-review.md`
- `discussion/implementation/reviews/wave81/wave81-domain-b-spec-compliance-review.md`
- `discussion/implementation/reviews/wave81/wave81-domain-b-design-development-review.md`
- `discussion/implementation/reviews/wave81/wave81-domain-b-test-adequacy-review.md`
- `discussion/implementation/reviews/wave81/wave81-final-clean-integration-review.md`
- `discussion/implementation/reviews/wave81/_map.md`

## 14. Subagent Contract

Domain assignment must include:

- target and wave;
- dependencies;
- allowed write scope;
- forbidden write scope;
- basis documents;
- applicable policies;
- required tests and verification;
- expected evidence;
- loop limit;
- early escape triggers.

Each Orch-Sylph must start with bounded current-state confirmation before delegating to Gnome.

Gnome instructions must include:

- This workspace may already have unrelated dirty changes.
- Do not revert user or other-agent changes.
- Do not run broad refactors.
- Implement within the domain write scope.
- Treat [Dynamics Tool Component Spec](../../design/screen-design/components/dynamics-tool.md) and this wave plan as the accepted basis.
- Do not treat old Dynamics implementation remnants as design authority.
- Remove or replace stale Dynamics remnants when the new v2 path supersedes them.
- Do not preserve `computedDynamics` requirement, `scalarDampedFollowV1`, replace-style output, or persistent preview operations unless explicitly justified as active non-stale behavior.
- Do not implement Viewer v1, frame stepping, mixer, multi-output, multi-pendulum, collision, cloth, IK, export, or Cubism compatibility.

Review-Sylph instructions must include:

- Review from source, tests, plan, and reports, not only from Gnome summary.
- Report `pass`, `needs_changes`, or `escalate`.
- Do not ask the user directly.
- Do not edit files unless explicitly delegated a narrow fix after review.
- Treat stale v1 Dynamics behavior left in active code as blocking unless explicitly justified.
- Treat missing additive offset proof as blocking.
- Treat Parameter Bar mutability in Dynamics mode as blocking.
- Treat Canvas selection/editing in Dynamics preview mode as blocking.

## 15. Orchestration Policy

This wave must follow `.agents/skills/implementation-orchestration/SKILL.md`.

Root / Undine:

- Owns wave plan, dependency graph, user questions, and final decision.
- Must not implement the wave.
- Must preserve root context.
- Must wait for every started subagent.
- Must treat `wait_agent` timeout as polling timeout, not failure.
- Must not close, kill, interrupt, or summarize running children as complete.

Orch-Sylph:

- Owns exactly one domain loop.
- Must start with bounded current-state confirmation for its domain.
- Must delegate implementation to Gnome unless the domain is review-only.
- Must delegate review to independent Review-Sylphs.
- Must include separate Spec Compliance Review lane.
- Must wait for Gnome and Review-Sylph completion.
- Must not cancel, close, or interrupt child agents because they are slow or waiting.
- Must close completed child agent sessions at the end of the domain.
- Must not close running child sessions.
- Must report `pass`, `needs_fix`, `blocked`, or `escalate` with file paths, validation, and residual risks.

Gnome:

- Receives domain-specific basis sections only.
- Implements within allowed scope.
- May add dependencies only through dependency policy compliance and escalation.
- Must include Basis Coverage Self-Report and Deferred Basis Items.
- Must not implement Viewer v1, frame stepping, mixer, multi-output, multi-pendulum, export, diff, Cubism compatibility, or unrelated mesh/deformer/keyform features.

Review-Sylph:

- Reviews from artifacts and source, not only from Gnome summary.
- Must produce assigned lane report.
- Spec Compliance Review must not silently treat basis omissions as future scope.
- Must check stale-remnant removal and forbidden scope explicitly.

Waiting rule:

- `wait_agent` timeout is polling timeout, not failure.
- No parent agent may terminate a child agent's work merely because it has not responded yet.
- If interruption is unavoidable, record incomplete / blocked / escalated. Do not pass the wave gate.

## 16. Out of Scope

- Viewer v1 implementation.
- Viewer time progression UI.
- Viewer reset simulation UI.
- Frame stepping.
- Mixer / same-output multi-group blending.
- Multi-pendulum simulation.
- Multiple outputs per Dynamics Group.
- Collision, cloth, IK, wind field, gravity UI beyond v0 pendulum coefficients.
- Motion timeline or transport controls.
- Runtime textured render scene parity expansion beyond what Dynamics contract needs.
- Texture Atlas Task.
- Mesh generation changes.
- Deformer editing changes unrelated to Dynamics preview evaluation.
- Keyform authoring changes unrelated to Dynamics output consumption.
- screenshot / export.
- Compare / Diff.
- External HTTP/WebSocket/MCP transport.
- LLM/provider integration.
- Cubism SDK / `.moc3` / `.model3.json` / `.physics3.json` compatibility.
