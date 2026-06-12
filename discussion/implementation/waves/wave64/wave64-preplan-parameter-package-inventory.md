# Wave64 Preplan: Parameter / Keyform Package Inventory

## Verdict

pass

次waveで Parameter / Keyform Editing Loop v0 を計画できるだけの package 側棚卸は完了。結論として、parameter / keyform の基礎 DTO、create 系 operation、runtime interpolation / application の一部は既にある。ただし v0 UX に必要な「1つの binding に対して key を add / update / delete する編集ループ」は package contract として未成立であり、Wave64 package work が必要。

## Short Summary

- Parameter 定義は `packages/package-format/src/model-files.ts` の `ParameterDto` / `ParametersFileDto` として保存済み。Operation は `createParameter` のみ。
- Keyform は placeholder だけではなく、`linear-1d-v1` / `parameter-grid-2d-v1` の保存、authoring mutation、operation、runtime sampling が存在する。
- ただし現行 `addKeyform` は「1 key を持つ新規 keyform set」を作る operation であり、既存 set に key を追加・更新・削除する UX には合わない。
- Runtime は authored parameter values を受け取り、Drawable opacity、Rotation angle、Warp lattice controlPointOffsets、Mesh vertices を評価できる。Deformer opacity multiplier keyform は未対応。
- Validator は rig control / warp lattice / dynamics に偏っており、generic parameter/keyform validation には穴がある。

## Basis Facts

- `discussion/design/screen-design/components/parameter-keyform.md`
  - v0 keyform 対象は Drawable opacity、Warp Deformer lattice/control point positions、Warp/Rotation Deformer opacity multiplier、Rotation Deformer angle。
  - Keyform 専用 Inspector は作らず、Parameter Bar と対象 Inspector が協調する。
  - Add / Update / Delete、Ends、Ends + Center が v0 UX の基本操作。
- `discussion/design/screen-design/screens/parameter-manager.md`
  - Parameter Manager は parameter 定義の一覧・作成・確認・編集が役割。
  - Preset は locked、Custom は作成・編集・削除可能という設計だが、現 package schema はまだこの粒度を持たない。
- `discussion/design/parameter-preset-ecosystem.md`
  - Core Parameter、Preset/Profile、Facade/Mapping は分離する方針。
  - Core Parameter は stable id、display name、type/range/group/usage refs を持つ想定。ただし現 DTO は group/type/usage refs が不足。
- `discussion/implementation/orchestration/wave63-plan.md`
  - Wave63 は Parameter / Keyform authoring を out of scope とし、Deformer 管理と static opacity multiplier を先行した。
- `discussion/implementation/waves/wave63/wave63-domain-a-report.md`
  - `opacityMultiplier` は package / operation / validator / runtime projection に保存・検証・反映される static property として実装済み。
  - Transform / Bezier divisions は keyform cardinality conflict 時に reject される。
- `discussion/implementation/waves/wave63/wave63-domain-c-report.md`
  - Editor は Deformer Tree / Inspector で static opacity multiplier を編集できるが、Parameter / Keyform authoring は未実装。
- `discussion/development_convention/source-file-organization-policy.md`
  - Wave64 package work は operation / runtime / validator / schema concerns を named files に分割し、`index.ts` は barrel に留める必要がある。

## Repository Facts With Paths

### Parameter Definition / Storage

- `packages/package-format/src/model-files.ts`
  - `ParameterSchema`: `parameterId`, `displayName`, optional coarse `semanticRole`, optional `projectPresetAlias`, `valueSource`, `min`, `max`, `default`, `recommendedUiStep`。
  - `ParametersFileSchema`: `schemaVersion: "parameters-file-v1"`, `parameters: Parameter[]`。
  - Package schema itself does not refine `min <= max` or `default inside range`.
- `packages/contracts/src/ids.ts`
  - `ParameterIdSchema` uses `param_` prefix.
  - `KeyformSetIdSchema` uses `keyset_` prefix.
- `packages/authoring-core/src/authoring-graph.ts`
  - Authoring graph stores `parameters: ParameterDto[]` and `keyformSets: KeyformSetDto[]`.
- `packages/authoring-core/src/authoring-mutations.ts`
  - `createParameter(session, parameter)` only creates a parameter.
  - Duplicate parameter IDs are rejected with `duplicate_parameter`.
- `packages/authoring-core/src/graph-selectors.ts`
  - `listParameters`, `getParameterById`, `hasParameter` only.
- `packages/operation-core/src/payloads/model-edit.ts`
  - `CreateParameterPayloadSchema` validates `min <= max` and `default` within range.
  - Payload has no preset-locked/custom-kind distinction beyond optional `semanticRole` / `projectPresetAlias`.
- `packages/operation-core/src/operations/create-parameter.ts`
  - `createParameterOperationHandler` supports dry-run / commit and duplicate rejection.
  - No `updateParameter`, `deleteParameter`, `refactorParameterId`, or preset initialization operation exists.
- `packages/operation-core/src/operation-type.ts` and `packages/operation-core/src/operation-registry.ts`
  - Registered parameter operation is `createParameter` only.

### Keyform Structures

- `packages/package-format/src/model-files.ts`
  - `KeyformTargetSchema`: `{ kind: "mesh" | "rigControl" | "drawable" | "opacity" | "visibility" | "drawOrder", id: string, property: string }`.
  - `Linear1dKeyformSetSchema`: `parameterId`, `evaluator: "linear-1d-v1"`, `interpolation: "linear-1d-v1"`, `compositionMode: "replace" | "additiveDelta" | "multiplyOpacity"`, `compositionOrder`, `keys[]`.
  - `ParameterGrid2dKeyformSetSchema`: `parameterX`, `parameterY`, `evaluator: "parameter-grid-2d-v1"`, `interpolation: "bilinear-grid-v1"`, `clampPolicy`, `missingKeyPolicy`, `compositionMode`, `keys[]`.
  - Warp `controlPointOffsets` keyforms receive extra schema refinement for composition mode and Vec2[] patch shape.
- `packages/authoring-core/src/keyform-mutations.ts`
  - `createLinear1dKeyformSet` validates unique keyform set id, parameter existence, target existence, supported target property, and warp offset patch shape.
  - `createParameterGrid2dKeyformSet` additionally validates distinct axis parameters and duplicate grid coordinates.
  - Supported target properties currently include:
    - `mesh`: `vertices`
    - `rigControl`: `angleDegrees`, `restAngleDegrees`, `translation`, `restTranslation`, `scale`, `restScale`, `controlPoints`, `restControlPoints`, `controlPointOffsets`
    - `drawable`: `opacity`, `defaultOpacity`, `visibility`, `runtimeVisibility`, `drawOrder`, `baseDrawOrder`
    - `opacity`, `visibility`, `drawOrder` pseudo-kinds mapped to drawables.
- `packages/authoring-core/src/keyform-selectors.ts`
  - `listKeyformSets`, `getKeyformSetById`, `hasKeyformSet`, `listKeyformSetsForParameter`.

Keyforms are therefore not only placeholders. They are generic target/property bindings, and several properties have actual runtime behavior. However, the generic schema admits more targets than Parameter / Keyform v0 wants to expose.

### Existing Operations

- `packages/operation-core/src/operations/add-keyform.ts`
  - Operation name: `addKeyform`.
  - DTO: `AddKeyformPayloadSchema` from `packages/operation-core/src/payloads/model-edit.ts`.
  - Converts operation target kinds `drawable` / `mesh` / `rigControl` into package keyform targets.
  - Rejects unsupported target kinds, target-property/statePatch mismatch, missing parameter, missing target, unsupported target property, unsupported composition mode, invalid warp offset patch, duplicate keyform set.
  - Creates a new linear keyform set containing exactly one key.
- `packages/operation-core/src/operations/add-keyform-grid2d.ts`
  - Operation name: `addKeyformGrid2d`.
  - DTO: `AddKeyformGrid2dPayloadSchema`.
  - Creates one grid keyform set containing multiple supplied coordinates.
  - Rejects missing axis parameter, duplicate axis parameter, missing target, duplicate grid coordinate, unsupported target kind/payload.
- `packages/operation-core/src/operations/create-parameter.ts`
  - Operation name: `createParameter`.
  - DTO: `CreateParameterPayloadSchema`.
  - Rejects duplicate parameter IDs.
- `packages/operation-core/src/operation-ids.ts`
  - `addKeyform` keyform set id includes target kind, target id, target property, parameter id, and key value.
  - This means multiple keys for the same target/property/parameter become separate keyform sets if created through current `addKeyform`.

Important consequence:

- Current `addKeyform` is unsuitable for Ends / Ends + Center and normal add/update/delete at current value, because interpolation requires multiple keys inside the same linear keyform set. Creating separate one-key sets would sample and apply them independently rather than interpolate as one binding.

### Runtime / Canvas Evaluation

- `packages/runtime-core/src/runtime-input.ts`
  - Runtime evaluation accepts `authoredParameterValues: Record<ParameterId, number>`.
- `packages/runtime-core/src/parameter-resolution.ts`
  - Effective parameter values are resolved from authored values, defaults, and computed dynamics.
  - Authored values are clamped to parameter min/max.
- `packages/runtime-core/src/keyform-sampling.ts`
  - Samples linear and grid keyform bindings from effective parameter values.
  - Emits diagnostics for missing parameter, duplicate linear key values, duplicate grid coordinates, missing grid keys, target missing/unsupported.
- `packages/runtime-core/src/keyform-linear1d-interpolation.ts`
  - Interpolates number, Vec2, and Vec2[] patches.
  - Unsupported shapes return diagnostics; booleans/strings/records admitted by storage are not sampled by this interpolation layer.
- `packages/runtime-core/src/keyform-grid2d-interpolation.ts`
  - Bilinear interpolation for grid keyforms; clamps coordinates to key range and reports missing corners.
- `packages/runtime-core/src/keyform-target-application.ts`
  - Applies non-rigControl keyforms before rig control evaluation.
  - Supports mesh `vertices`.
  - Supports drawable `opacity` / `defaultOpacity`, visibility, and draw order.
  - Does not apply `rigControl` patches here.
- `packages/runtime-core/src/rig-control-keyform-state.ts`
  - Applies rotation2d rigControl keyform samples for `angleDegrees`, `restAngleDegrees`, `translation`, `restTranslation`, `scale`, `restScale`.
- `packages/runtime-core/src/rig-control-warp-lattice.ts`
  - Applies warpLattice2d `controlPointOffsets` keyform samples and deforms affected drawable vertices.
- `packages/runtime-core/src/rig-control-evaluation.ts`
  - Applies static `opacityMultiplier` from rig control ancestors to descendant drawable opacity.
  - Does not sample or apply keyformed `opacityMultiplier`.
- `packages/runtime-core/src/snapshot.ts`
  - Runtime snapshot sequence: parameter resolution -> keyform sampling -> apply drawable/mesh keyforms -> evaluate rig controls -> final drawables.

## Existing Capabilities

- Create authored parameters through package/operation path.
- Store linear 1D and grid 2D keyform sets in package format.
- Create linear 1D keyform sets for mesh, drawable, and rigControl target properties supported by authoring-core.
- Create grid 2D keyform sets with multiple keys.
- Runtime evaluate authored parameter values and defaults.
- Runtime evaluate:
  - Drawable opacity keyforms.
  - Rotation2d angle keyforms.
  - WarpLattice2d controlPointOffsets keyforms.
  - Mesh vertices keyforms.
  - Static deformer opacity multiplier.
- Operation dry-run / commit and modelDiff behavior exist for createParameter/addKeyform/addKeyformGrid2d.
- Warp lattice patch shape/cardinality validation exists in schema, authoring mutation, runtime, and validator-specific diagnostics.

## Gaps For Parameter / Keyform Editing Loop v0

### Blocking / Package Contract Gaps

- No operation to add a key into an existing linear keyform set.
- No operation to update a key at the current parameter value.
- No operation to delete a key at the current parameter value.
- No operation to create or upsert Ends / Ends + Center as a single multi-key linear keyform set.
- Current linear `addKeyform` id generation includes `keyValue`, which works against one keyform set per target/property/parameter binding.
- No generic linear key duplicate-value policy at authoring mutation level. Runtime warns and ignores duplicates deterministically, but authoring should probably reject for v0.
- No keyform key-value range validation against the referenced parameter min/max.
- No generic package validator for missing keyform parameter refs, missing keyform target refs, duplicate parameter ids, duplicate keyform set ids, invalid parameter range/default, or linear key out-of-range.
- No package-level active parameter/current value state. If persistence across reload is required, `EditorStateFileSchema` needs fields; otherwise this can stay app/session state.
- No keyformed `rigControl.opacityMultiplier` support in authoring whitelist, operation tests, runtime rig control evaluation, or validator.
- Parameter Manager design calls for Preset locked vs Custom semantics, group, type, usage refs, stable id refactor; current DTO has only coarse `semanticRole`, optional `projectPresetAlias`, and no usage refs.

### Target-Specific v0 Gaps

- Drawable opacity:
  - Storage and runtime support exist.
  - Needs key add/update/delete operations and v0 validation around numeric opacity statePatch and range.
- Warp lattice:
  - Runtime support for `controlPointOffsets` exists.
  - Needs multi-key editing operation, Ends/Center helpers, and operation-level tests for interpolation over multiple keys.
- Rotation angle:
  - Runtime support for `angleDegrees` / `restAngleDegrees` exists.
  - v0 should standardize on `angleDegrees` as the authored keyform property unless planner explicitly chooses otherwise.
- Deformer opacity multiplier:
  - Static `opacityMultiplier` exists and runtime multiplies descendants.
  - Keyformed `opacityMultiplier` is missing and must be added if v0 includes Deformer opacity multiplier.
- Active parameter:
  - Parameter definitions exist.
  - No package operation/state is needed for purely local active selection.
  - Persistence or cross-session active parameter requires package/editor-state schema work.

## Validation Inventory

Existing:

- `CreateParameterPayloadSchema` validates `min <= max` and default inside range for create operation payloads.
- `createParameter` rejects duplicate parameter ID in the current authoring session.
- `createLinear1dKeyformSet` rejects missing parameter, missing target, unsupported property, duplicate keyform set id, invalid warp controlPointOffsets patch.
- `createParameterGrid2dKeyformSet` rejects duplicate axis parameters and duplicate grid coordinates.
- `addKeyform` maps authoring mutation failures to structured operation diagnostics.
- `runtime-core` emits diagnostics for missing parameter effective values, missing targets, duplicate linear key values, duplicate/missing grid keys, unsupported target/property/mode, invalid patch shapes.
- `validator-core` has strong rig-control hierarchy validation and warp lattice patch validation:
  - `packages/validator-core/src/validators/rig-control-semantic.ts`
  - `packages/validator-core/src/validators/warp-lattice-diagnostics.ts`
  - `packages/validator-core/src/validators/rig-control-keyform-evidence.ts`
- `validator-core` maps static rig control `opacityMultiplier` schema issues to `rigControl.opacityMultiplierRange`.

Missing or weak:

- Package schema does not enforce parameter min/max/default consistency.
- Package schema/validator does not enforce uniqueness of parameter IDs or keyform set IDs.
- Package validator does not provide a generic keyform reference validator for missing parameter refs or missing target refs.
- Package validator does not flag linear key positions outside parameter range.
- Authoring mutation does not reject duplicate linear key values.
- Authoring mutation does not validate numeric patch ranges for Drawable opacity or rigControl opacity multiplier because the latter is unsupported.
- Runtime clamps parameter values, but that is not a substitute for authoring/preflight validation of out-of-range key positions.

## Tests Found

- `packages/authoring-core/src/authoring-session.test.ts`
  - create parameter session mutation and dry-run clone behavior.
- `packages/authoring-core/src/keyform-mutations.test.ts`
  - linear keyform create, rotation angle keyform create, grid keyform create, missing parameter/target, unsupported property, duplicate keyform set, duplicate grid axis/coordinate.
- `packages/authoring-core/src/runtime-graph-keyforms.test.ts`
  - authoring graph to runtime keyform binding projection.
- `packages/operation-core/src/operations/add-keyform.test.ts`
  - dry-run/commit, mesh vertices, rigControl `angleDegrees`, warp `controlPointOffsets`, missing parameter/target, unsupported target/property, property mismatch, duplicate set.
- `packages/operation-core/src/operations/add-keyform-grid2d.test.ts`
  - dry-run/commit, missing axis parameters, duplicate axis, missing target, duplicate coordinates, unsupported payload.
- `packages/operation-core/src/operation-schemas.test.ts`
  - operation payload schema coverage including createParameter/addKeyform.
- `packages/runtime-core/src/parameter-resolution.test.ts`
  - default / override / dynamics parameter resolution and clamping.
- `packages/runtime-core/src/keyform-linear1d-interpolation.test.ts`
  - linear interpolation behavior.
- `packages/runtime-core/src/keyform-grid2d-interpolation.test.ts`
  - grid interpolation behavior.
- `packages/runtime-core/src/keyform-sampling.test.ts`
  - sampling diagnostics including duplicates and missing parameter.
- `packages/runtime-core/src/keyform-target-application.test.ts`
  - mesh vertex patches and Drawable opacity/visibility/draw order patches.
- `packages/runtime-core/src/rig-control-keyform-evidence.test.ts`
  - rotation2d angle keyform runtime evidence, invalid rotation patch diagnostics, warp controlPointOffsets runtime deformation and blocking invalid patch shape.
- `packages/validator-core/src/rig-control-semantic.test.ts`
  - rig control duplicate child, multiple parent, hierarchy validation.
- `packages/validator-core/src/warp-lattice-diagnostics.test.ts`
  - warp lattice unsupported property, malformed patch, cardinality, runtime evidence mismatch.
- `packages/package-format/src/warp-lattice2d-contract.test.ts`
  - warp lattice contract and static rig control opacityMultiplier schema range.

Likely needed:

- Operation tests for `upsertLinearKeyformKey` / `deleteLinearKeyformKey` or equivalent.
- Operation tests for multi-key Ends and Ends + Center creation in one keyform set.
- Operation atomicity tests for rejected key updates/deletes.
- Runtime tests for v0 target matrix:
  - Drawable opacity with min/default/max keys.
  - Rotation angle with interpolation between Ends/Center.
  - Warp controlPointOffsets with multiple keys and matching cardinality.
  - Deformer opacityMultiplier keyform after support is added.
- Validator tests for duplicate parameter IDs, duplicate keyform set IDs, invalid parameter ranges/defaults, missing keyform parameter/target refs, out-of-range linear key values, duplicate linear key values, unsupported v0 target property.
- Projection tests proving authoring graph -> runtime graph keeps v0 keyform target metadata stable.

## Recommended Wave64 Package Domain Scope

### Domain A: Linear Keyform Editing Operation Contract

Purpose:

- Make the user-facing keyform editing loop possible without Editor inventing package mutations.

Expected packages:

- `packages/package-format/**` only if DTO shape or identifier convention changes.
- `packages/authoring-core/**`
- `packages/operation-core/**`
- `packages/ai-interface/**` if operation catalog/read surface is updated.

Recommended capabilities:

- Define canonical linear keyform set identity as one binding per target kind/id/property + parameter id, not one key value.
- Add operation(s) for:
  - create or get binding keyform set
  - add key at value
  - update existing key at value
  - delete key at value
  - Ends
  - Ends + Center
- Reject duplicate key values for v0.
- Reject missing parameter/target, unsupported v0 target property, invalid patch shape, key value outside parameter range, no-op update/delete.
- Preserve dry-run / commit / modelDiff / no-mutation-on-reject behavior.

### Domain B: Runtime + Validator Completion For v0 Targets

Purpose:

- Ensure every v0 target property that Editor can author has deterministic runtime and validation behavior.

Expected packages:

- `packages/runtime-core/**`
- `packages/validator-core/**`
- `packages/authoring-core/**` for target whitelist updates.
- `packages/package-format/**` if schema refinements are introduced.

Recommended capabilities:

- Add keyformed `rigControl.opacityMultiplier` support or explicitly defer Deformer opacity multiplier from v0.
- Keep v0 target whitelist narrow:
  - `drawable.opacity`
  - `rigControl.angleDegrees`
  - `rigControl.controlPointOffsets`
  - `rigControl.opacityMultiplier` if included
- Add generic parameter/keyform validators:
  - invalid parameter range/default
  - duplicate parameter IDs
  - duplicate keyform set IDs
  - missing parameter refs
  - missing target refs
  - out-of-range key positions
  - duplicate linear key values
  - invalid target/property patch shape for v0 targets
- Add runtime/evidence tests for v0 target property combinations.

### Domain C: Parameter Definition Scope Gate

Purpose:

- Decide whether Wave64 only needs Quick Create support or also Parameter Manager package foundations.

Expected packages:

- `packages/package-format/**`
- `packages/authoring-core/**`
- `packages/operation-core/**`

Recommended conservative scope:

- Keep Wave64 v0 to custom authored scalar parameters plus existing `createParameter`.
- Defer full Preset locked catalog, group taxonomy, usage refs, stable id refactor, parameter update/delete, and preset facade unless Parameter Manager itself is in the same wave.

## What Can Be Deferred

- Full Parameter Manager package model:
  - Preset locked/custom kind distinction.
  - Full role catalog from `parameter-preset-ecosystem.md`.
  - Group taxonomy and sign convention metadata.
  - Usage refs persisted on parameters.
  - Stable id refactor operation.
  - Parameter update/delete operation.
- 2D/grid keyform authoring UX.
- Mesh vertex keyform UX.
- Visibility and draw order keyform UX, despite existing runtime support.
- Variant / Expression integration.
- Camera Capture facade, smoothing, calibration, external runtime API mapping.
- Bezier edit surface runtime evaluation claim beyond existing warp controlPointOffsets behavior.
- Keyform migration/rescale when parameter range changes.
- Persisted active parameter/current value if v0 can treat it as Editor session state.

## User-Decision Points

- Whether v0 must include keyformed Deformer opacity multiplier. If yes, package/runtime work is required; if no, keep static opacity multiplier only and defer this row from v0.
- Whether active parameter/current value must persist in package `editorState`. If no, Editor can own active selection/session values.
- Whether Wave64 includes Parameter Manager foundations or only Quick Create + keyform loop. Package scope changes materially if preset/custom/usage/refactor are included.
- Whether v0 exposes only design-approved keyform targets or continues to allow existing generic mesh/visibility/drawOrder targets through shared operations.

## Unresolved Technical Risks

- Current linear `addKeyform` contract can lead planners toward separate one-key sets, which would not produce the intended interpolated Ends / Center behavior.
- Generic target schema is broader than v0 UX and can encode properties the design says not to keyform.
- Runtime can evaluate several existing properties, but package validation does not comprehensively protect arbitrary package documents.
- `ParameterSchema` lacks final preset/profile fields and does not encode group/type/usage refs from design docs.
- Adding keyformed `opacityMultiplier` must be integrated carefully with existing static ancestor multiplication to avoid double-application or ambiguous composition semantics.
- If package schema changes keyform set identity, migration/compatibility for existing tests/fixtures must be handled intentionally.
