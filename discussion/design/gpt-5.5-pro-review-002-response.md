# GPT-5.5 Pro Review 002 Response

> Source review: `memo/gpt-5.5-pro-review/review_002.md`
> Scope: `discussion/` only. No implementation code changed.

## Decision

Minimum Open Dynamics v1 is restored to the current MVP.

It is defined as parameter-driven deterministic secondary motion:

- reads authored driver parameters such as `faceYaw`, `facePitch`, `bodyAngle`, `headMoveX`;
- writes computed output parameters such as `hairSway`, `clothSway`, `ribbonSwing`, `accessorySwing`;
- feeds ordinary keyform / rig control evaluation;
- does not directly mutate mesh vertices, rig control properties, drawable state, mask state, or renderer state in MVP.

Cubism Physics compatibility, `.physics3.json` import/export, Cubism Viewer matching, Cubism Editor Physics UI reproduction, direct mesh physics, cloth simulation, collision, IK, timeline bake, production motion integration, and AI automatic physics tuning remain outside MVP.

## RE3 Classification

| Review item | Classification | Result |
|-------------|----------------|--------|
| RE3-001 MVP ACにOpen Dynamics v1復帰 | Reflected | MVP AC, MVP scenario, DOMAIN-08/09 updated to include Minimum Open Dynamics v1. |
| RE3-002 DOMAIN-09をCurrent MVPへ戻す | Reflected | `DOMAIN-09` status changed to Current MVP for Minimum Open Dynamics v1. |
| RE3-003 package schemaに`model/dynamics.json` | Reflected | Package layout, manifest modelFiles, file table, Dynamics DTO schemas added. |
| RE3-004 Dynamics outputをcomputed parameterに限定 | Reflected | AC, DOMAIN-09, package/runtime contracts specify computed output parameters only. |
| RE3-005 authored/computed parameter区別 | Reflected | `Parameter.valueSource`, authored/computed/effective layers added. |
| RE3-006 runtime evaluation order更新 | Reflected | Dynamics step inserted before keyform sampling in runtime docs/contracts. |
| RE3-007 timestep / determinism / reset policy | Reflected | `frameIndex`, `deltaTimeMs`, `fixedStepMs`, `maxSubSteps`, `resetDynamics`, reset conditions documented. |
| RE3-008 RuntimeSnapshotDtoへdynamics state追加 | Reflected | `EvaluatedDynamicsGroupSchema` and `dynamics` snapshot array added. |
| RE3-009 dynamics dependency rules | Reflected | Driver/output valueSource rules, output-as-driver ban, group dependency ban documented. |
| RE3-010 Dynamics operations | Reflected | `createDynamicsGroup`, `updateDynamicsGroup`, `deleteDynamicsGroup`, `bindDynamicsDriver`, `bindDynamicsOutput`, `setDynamicsSettings`, `resetDynamicsPreviewState` added. |
| RE3-011 GUI Dynamics surface | Reflected | Dynamics panel, preview/reset/simple graph, terminology constraints added. |
| RE3-012 Dynamics validator checks | Reflected | Dynamics check registry added with severity/profile guidance. |
| RE3-013 Dynamics fixtures | Reflected | `minimal-dynamics-hairSway` plus invalid/reset/demo-safe fixtures added. |
| RE3-014 Streaming Demo Policy | Reflected | Dynamics demo allowed/avoid rules and safe Japanese wording added. |
| RE3-015 PSD primary / split PNG fallback未決表現 | Reflected | Remaining unresolved wording removed from MVP screen/self-review docs. |
| RE3-016 空白入りrig-control IDsを`rigControl`へ統一 | Reflected | Schema/check/test identifiers changed to `rigControl`; prose may still use general words. |
| RE3-017 `CheckIdSchema` camelCase対応 | Reflected | Regex changed to `/^[a-z][A-Za-z0-9]*(\.[a-z][A-Za-z0-9]*)+$/`. |
| RE3-018 `KeyformSetSchema`を1D/2D union化 | Reflected | `Linear1dKeyformSetSchema` and `ParameterGrid2dKeyformSetSchema` added. |
| RE3-019 Parameter scenarioが広い | Reflected | `linear-1d-v1` and exactly two grid parameters specified; step/smooth/N-D grid Post-MVP. |
| RE3-020 `SC-PARAM-005/006/007`不整合 | Reflected | Scenarios added for multi-override, alias/role inspect, endpoint-missing detection. |

## Implementation Checklist Status

- [x] MVPに `Minimum Open Dynamics v1` を正式に含めた。
- [x] `DOMAIN-09` を Current MVP に戻した。
- [x] `model/dynamics.json` を package layout に追加した。
- [x] `DynamicsGroupId` / `DynamicsGroupSchema` を追加した。
- [x] Dynamics output はMVPでは computed parameter に限定した。
- [x] Parameterに `valueSource` を追加した。
- [x] Runtimeに authored / computed / effective parameter layer を追加した。
- [x] Runtime evaluation order に Dynamics step を追加した。
- [x] Fixed timestep / reset policy / deterministic comparison を定義した。
- [x] RuntimeSnapshotDto に dynamics state を追加した。
- [x] Validatorに dynamics checks を追加した。
- [x] Operation contractに dynamics operations を追加した。
- [x] GUIに dynamics panel / preview / reset / simple graph を追加した。
- [x] Fixtureに `minimal-dynamics-hairSway` を追加した。
- [x] Streaming Demo PolicyにDynamics表示ルールを追加した。
- [x] Cubism Physics / `.physics3.json` / Cubism Viewer一致 / Cubism Editor UI再現は引き続き禁止した。
- [x] PSD primary / split PNG fallback の未決表現を削除した。
- [x] 空白入りrig-control IDを `rigControl` に統一した。
- [x] `CheckIdSchema` を実際のcheck IDと一致させた。
- [x] `KeyformSetSchema` を1D/2D discriminated unionにした。
- [x] `SC-PARAM-005` / `006` / `007` のtraceability不整合を直した。

## Follow-up Implementation Notes

- `scalarDampedFollowV1` is the only MVP solver.
- `resetDynamicsPreviewState` records preview evidence but must not mutate package files.
- Demo-safe validation should warn on internal solver/schema names in captured UI, without claiming legal safety.
