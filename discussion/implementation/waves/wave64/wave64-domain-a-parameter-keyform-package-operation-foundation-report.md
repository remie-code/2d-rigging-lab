# Wave64 Domain A Report: Parameter / Keyform Package Operation Foundation

## Status

pass

## Fix-Loop Summary

- Review loop 1 の blocking/actionable findings を修正した。
- `createParameter` は initialized preset catalog id collision を `operation.createParameter.duplicateParameter` の structured rejection として返す。mutation 例外も同じ diagnostic に変換する。
- Custom parameter create path は legacy `semanticRole` / `projectPresetAlias` payload を受けても保存しない。initialized custom read surface も legacy stored semantic/preset fields を投影しない。
- `createEndsCenter` は parameter `min` / `default` / `max` positions が distinct でない場合に `operation.editKeyformKey.duplicateKey` で reject する。duplicate key を de-dup して commit しない。
- `editKeyformKey` の negative/atomicity、dry-run、multi-key modelDiff、warp opacityMultiplier operation/runtime coverage を追加した。
- Operation handler 自体は runtime evidence/diff を生成しない既存境界を維持した。runtime-visible proof は runtime-core focused tests と lifecycle evidence provider tests に委譲する N/A rationale として本 report に記録する。

## Basis Coverage Self-Report

- Parameter definition operations:
  - `updateParameter` を追加。Custom parameter の `displayName` / `min` / `max` / `default` / `recommendedUiStep` を更新する。
  - `deleteParameter` を追加。Custom parameter は keyform / dynamics refs がない場合のみ削除する。
  - Preset parameter は catalog 由来でも stored 由来でも locked として扱い、update / delete / duplicate create を reject する。
  - `createParameter` は preset catalog id collision を structured rejection にする。
  - Custom parameter create/read projection は role-less とし、legacy semantic/preset fields を保存・投影しない。
  - `PRESET_PARAMETER_CATALOG` と `createInitializedParameterSurface` を追加し、Parameter Manager が初期状態から preset role catalog を読める read surface を用意した。
- Keyform set mutation operations:
  - `editKeyformKey` を追加。`addCurrent` / `updateCurrent` / `deleteCurrent` / `createEnds` / `createEndsCenter` を 1 binding = 1 linear keyform set で扱う。
  - canonical keyform set id は `target.kind + target.id + targetProperty + parameterId` で、旧 `addKeyform` のように key value を id に含めない。
  - duplicate key、missing key、missing binding、out-of-range key position、target/property/value shape mismatch を structured diagnostics で reject する。
  - `createEndsCenter` は `min/default/max` が distinct でない endpoint-default parameters では duplicate-key rejection とし、invalid duplicate linear keys を commit しない。
- Target property support:
  - `drawable.opacity`
  - `rigControl.angleDegrees` for `rotation2d`
  - `rigControl.controlPointOffsets` for `warpLattice2d`
  - `rigControl.opacityMultiplier` for `rotation2d` / `warpLattice2d`
- Runtime / evaluation:
  - `rigControl.opacityMultiplier` keyform sampling/evaluation を追加し、static opacity multiplier と同じ descendant drawable opacity chain に反映する。
  - 既存の linear 1D / grid 2D sampling と drawable / mesh / rotation / warp lattice behavior は変更しない方針で維持した。
  - runtime graph parameter projection は initialized preset surface を含める。
- Validation:
  - duplicate parameter id、duplicate keyform set id、missing parameter refs、out-of-range keyform positions、keyform target missing、unsupported target/property、duplicate linear key values、preset locked mutation を追加。
  - Missing parameter refs は initialized preset catalog を含めて解決するため、preset id 参照は stored parameter がなくても missing にならない。

## Intentionally Deferred Basis Items

- `apps/editor/**` 連携は Domain B/D handoff のみ。Editor UI は変更していない。
- Mesh algorithm implementation / Mesh keyform UX は Domain C または future scope。
- Camera Capture / external facade は未対応。
- Visibility / clipping / draw order / Parts Container keyform authoring は追加していない。
- 旧 `addKeyform` / `addKeyformGrid2d` の legacy behavior は互換維持のため残した。Domain B/D は新規 v0 editing loop では `editKeyformKey` を使う。
- Validator の unsupported target/property は既存 runtime-supported package properties との互換を保つため、operation の v0 authoring whitelist より広い。v0 authoring の reject は `editKeyformKey` 側で保証する。

## User Workflow Trace

1. Parameter Manager が `listInitializedParameters(graph)` を読む。
2. 初期状態でも preset catalog が表示され、stored custom parameters は preset の後に並ぶ。
3. User が custom parameter を作成/更新/削除する。
4. Parameter Bar が active parameter の current value を持つ。
5. Parameter-aware Inspector が selected target/property と current target state を `editKeyformKey` payload に変換する。
6. `addCurrent` は current value に key を追加し、`updateCurrent` は既存 key を現在の target state で更新する。
7. `deleteCurrent` は current value の key を削除し、最後の key なら keyform set も削除する。
8. `createEnds` は parameter min/max に key を作る。
9. `createEndsCenter` は parameter min/default/max が distinct な場合に 3 keys を作る。endpoint-default preset/custom では `duplicateKey` rejection になるため、Domain B/D は action を disable するか rejection diagnostic を表示する。
10. Runtime snapshot は current parameter value から supported target property を評価し、deformer opacity multiplier も descendant drawable opacity に反映する。

## Must-not Compliance Evidence

- `apps/editor/**` は Domain A では変更していない。現在の worktree には別作業由来の `apps/editor/.dev-server.out.log` 差分が見えるが、この Domain A report の対象外。
- Mesh algorithm files / Domain C report/review files は並行 Domain C 作業として対象外。Domain A では mesh algorithm implementation を変更していない。
- Camera Capture / external facade / HTTP / WebSocket / MCP facade は追加していない。
- New v0 editing operation は visibility / clipping / draw order / Parts Container / mesh topology keyform を authoring 対象にしていない。
- `index.ts` は export 追加のみで barrel-only を維持した。

## Residual Risk Classification

- Low: `editKeyformKey` は v0 whitelist を厳格に reject するが、旧 `addKeyform` は既存互換のため広い target/property を維持している。Domain B/D は `editKeyformKey` を使うこと。
- Medium: Validator は既存 runtime-supported package keyforms を壊さないため、v0-only authoring whitelist より広い supported property set を持つ。将来、package validation 自体を v0-only にするなら、legacy fixtures / existing runtime tests への影響判断が必要。
- Low: Custom parameter legacy semantic/preset fieldsは package storage schema 上は互換のため残るが、new create operation は保存せず、initialized read surface も投影しない。Validator failure にはしていない。
- Low: Operation handlers in `operation-core` は modelDiff を返し、runtimeDiff/validationDiff は lifecycle evidence provider または runtime-core tests の責務として維持した。`editKeyformKey` runtime-visible proof は runtime-core focused tests で補う。
- Low: Full `pnpm test:unit` は未実行。focused Domain A tests、related operation/runtime preservation tests、typecheck、source organization、dependency guard は pass。

## Changed Files List

- `packages/package-format/src/model-files.ts`
- `packages/package-format/src/parameter-metadata.ts`
- `packages/package-format/src/parameter-presets.ts`
- `packages/package-format/src/parameter-presets.test.ts`
- `packages/package-format/src/index.ts`
- `packages/authoring-core/src/authoring-mutations.ts`
- `packages/authoring-core/src/parameter-surface.ts`
- `packages/authoring-core/src/parameter-surface.test.ts`
- `packages/authoring-core/src/parameter-mutations.ts`
- `packages/authoring-core/src/linear-keyform-editing.ts`
- `packages/authoring-core/src/keyform-mutations.ts`
- `packages/authoring-core/src/runtime-graph-parameters.ts`
- `packages/authoring-core/src/runtime-graph-adapter.test.ts`
- `packages/authoring-core/src/index.ts`
- `packages/operation-core/src/payloads/model-edit.ts`
- `packages/operation-core/src/operation-type.ts`
- `packages/operation-core/src/operation-payload.ts`
- `packages/operation-core/src/operation-ids.ts`
- `packages/operation-core/src/operation-registry.ts`
- `packages/operation-core/src/operations/create-parameter.ts`
- `packages/operation-core/src/operations/create-parameter.test.ts`
- `packages/operation-core/src/operations/parameter-definition.ts`
- `packages/operation-core/src/operations/parameter-definition.test.ts`
- `packages/operation-core/src/operations/edit-keyform-key.ts`
- `packages/operation-core/src/operations/edit-keyform-key.test.ts`
- `packages/operation-core/src/index.ts`
- `packages/runtime-core/src/rig-control-opacity-keyform-state.ts`
- `packages/runtime-core/src/rig-control-opacity-keyform-state.test.ts`
- `packages/runtime-core/src/rig-control-evaluation.ts`
- `packages/validator-core/src/validators/parameter-keyform-package.ts`
- `packages/validator-core/src/parameter-keyform-package.test.ts`
- `packages/validator-core/src/validators/package-runtime.ts`
- `packages/validator-core/src/check-catalog.ts`
- `discussion/implementation/waves/wave64/wave64-domain-a-parameter-keyform-package-operation-foundation-report.md`

## Verification Commands / Results

- `pnpm.cmd exec vitest run packages/package-format/src/parameter-presets.test.ts packages/authoring-core/src/parameter-surface.test.ts packages/authoring-core/src/runtime-graph-adapter.test.ts packages/operation-core/src/operations/create-parameter.test.ts packages/operation-core/src/operations/parameter-definition.test.ts packages/operation-core/src/operations/edit-keyform-key.test.ts packages/runtime-core/src/rig-control-opacity-keyform-state.test.ts packages/validator-core/src/parameter-keyform-package.test.ts`
  - Pass: 8 test files, 26 tests.
  - Note: vitest requires approved escalation in this environment because Vite/esbuild spawns worker processes.
- `pnpm.cmd exec vitest run packages/operation-core/src/operation-lifecycle.test.ts packages/operation-core/src/operation-evidence.test.ts packages/runtime-core/src/keyform-linear1d-interpolation.test.ts packages/runtime-core/src/keyform-grid2d-interpolation.test.ts packages/runtime-core/src/keyform-sampling.test.ts packages/runtime-core/src/rig-control-keyform-evidence.test.ts packages/runtime-core/src/snapshot-keyform-integration.test.ts`
  - Pass: 7 test files, 43 tests.
- `pnpm.cmd typecheck`
  - Pass.
- `node scripts/check-source-organization.mjs`
  - Pass: Source organization guard passed.
- `node scripts/check-dependencies.mjs`
  - Pass: Dependency guard passed.

## Domain B/D Handoff

### Operation Names / DTO Shapes

- `createParameter`
  - Payload remains compatible: `{ parameterId?, displayName, semanticRole?, projectPresetAlias?, valueSource?, min, max, default, recommendedUiStep }`.
  - Wave64 behavior: `semanticRole` and `projectPresetAlias` are ignored for Custom creation and are not stored.
  - Preset catalog id collision, including `param_face_angle_x`, rejects with `operation.createParameter.duplicateParameter`.
- `updateParameter`
  - Payload: `{ parameterId, displayName?, min?, max?, default?, recommendedUiStep? }`
  - At least one editable field is required.
  - Only Custom/stored non-preset parameters can be updated.
- `deleteParameter`
  - Payload: `{ parameterId }`
  - Custom parameter only; rejects when keyform/dynamics refs remain.
- `editKeyformKey`
  - Common payload fields: `{ action, target, targetProperty, parameterId, interpolation: "linear-1d-v1", compositionMode? }`
  - `addCurrent`: `{ keyValue, statePatch: { propertyPath, value, valueSchemaHint? } }`
  - `updateCurrent`: `{ keyValue, statePatch: { propertyPath, value, valueSchemaHint? } }`
  - `deleteCurrent`: `{ keyValue }`
  - `createEnds`: `{ statePatches: { min, max } }`
  - `createEndsCenter`: `{ statePatches: { min, default, max } }`
  - `statePatch.propertyPath` must equal `targetProperty`.
  - `createEndsCenter` requires distinct parameter `min`, `default`, and `max` positions. If default equals an endpoint, the operation rejects with `operation.editKeyformKey.duplicateKey` and leaves the session unchanged.

### Read Projection Fields

- Use `listInitializedParameters(graph)` / `getInitializedParameterById(graph, parameterId)`.
- Fields available for Parameter Manager:
  - `parameterId`
  - `displayName`
  - `kind`: `preset` or `custom`
  - `parameterType`: currently `scalar`
  - `group`: preset group or `custom`
  - `valueSource`
  - `min`, `max`, `default`, `recommendedUiStep`
  - `lockedFields`
  - Preset-specific fields: `presetRole`, `projectPresetAlias`, `signConvention`
- Custom projection intentionally omits `semanticRole`, `projectPresetAlias`, `presetRole`, and `signConvention`, even if legacy stored data contains those fields.

### Rejected States / Diagnostics

- Parameter diagnostics:
  - `operation.createParameter.duplicateParameter`
  - `operation.updateParameter.missingParameter`
  - `operation.updateParameter.presetLocked`
  - `operation.updateParameter.invalidRange`
  - `operation.updateParameter.noOp`
  - `operation.deleteParameter.missingParameter`
  - `operation.deleteParameter.presetLocked`
  - `operation.deleteParameter.parameterInUse`
- Keyform diagnostics:
  - `operation.editKeyformKey.missingParameter`
  - `operation.editKeyformKey.missingTarget`
  - `operation.editKeyformKey.unsupportedTargetKind`
  - `operation.editKeyformKey.unsupportedTargetProperty`
  - `operation.editKeyformKey.unsupportedCompositionMode`
  - `operation.editKeyformKey.invalidPatchShape`
  - `operation.editKeyformKey.duplicateBinding`
  - `operation.editKeyformKey.duplicateKey`
  - `operation.editKeyformKey.missingKey`
  - `operation.editKeyformKey.missingBinding`
  - `operation.editKeyformKey.keyOutOfRange`
  - `operation.editKeyformKey.statePatchPropertyMismatch`
- Validator check IDs:
  - `parameter.duplicateId`
  - `parameter.presetLockedMutation`
  - `keyform.duplicateSetId`
  - `keyform.parameterMissing`
  - `keyform.keyOutOfRange`
  - `keyform.targetMissing`
  - `keyform.unsupportedTargetProperty`
  - `keyform.linear1dDuplicateKey`

### Preset Catalog Initialization Behavior

- Preset parameters are always present in `createInitializedParameterSurface`.
- Stored custom parameters are appended after preset catalog entries.
- Stored preset entries do not unlock preset fields; only display name override is merged into the initialized surface.
- `createParameter` rejects ids that collide with preset catalog ids through structured operation rejection.
- `createParameter` does not store semantic/preset fields for Custom parameters.
- `updateParameter` and `deleteParameter` reject preset ids even if there is no stored parameter row.
- Runtime parameter map uses initialized surface, so preset parameter overrides can be evaluated without a stored parameter definition.

### Exact Support Matrix For New V0 Editing Operation

| Target | Property | Target object | State patch value | Composition modes |
|---|---|---|---|---|
| `drawable` | `opacity` | existing drawable | finite number `0..1` | `replace`, `multiplyOpacity` |
| `rigControl` | `angleDegrees` | `rotation2d` | finite number | `replace`, `additiveDelta` |
| `rigControl` | `controlPointOffsets` | `warpLattice2d` | `Vec2[]` with exact lattice control point count | `replace`, `additiveDelta` |
| `rigControl` | `opacityMultiplier` | `rotation2d` or `warpLattice2d` | finite number `0..1` | `replace`, `multiplyOpacity` |

Other `editKeyformKey` targets/properties are rejected. Legacy `addKeyform` / `addKeyformGrid2d` and runtime sampling still preserve existing broader package behavior and should not be used by Domain B/D for the Wave64 v0 editing loop.
