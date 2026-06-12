# Wave64 Domain A Spec Compliance Review

## Verdict

pass

Loop 2 result: pass. Loop 1 の3 blocking findings は実ファイル、Domain report、focused tests で解消を確認した。`createParameter` preset id collision は structured rejection になり、Custom parameter semantic fields は create/read surface で保存・投影されず、endpoint-default parameter の `createEndsCenter` は duplicate key rejection になって invalid duplicate keys を commit しない。

## Scope reviewed

Reviewed:

- Basis: `discussion/implementation/orchestration/wave64-plan.md`
- Basis: `discussion/implementation/waves/wave64/wave64-preplan-parameter-package-inventory.md`
- Basis: `discussion/design/screen-design/components/parameter-keyform.md`
- Basis: `discussion/design/screen-design/screens/parameter-manager.md`
- Basis: `discussion/design/parameter-preset-ecosystem.md`
- Basis: `discussion/design/screen-design/components/rig-tool.md`
- Basis: `discussion/development_convention/ux-backed-package-logic-authority.md`
- Domain report: `discussion/implementation/waves/wave64/wave64-domain-a-parameter-keyform-package-operation-foundation-report.md`
- Claimed Domain A source files under `packages/package-format`, `packages/authoring-core`, `packages/operation-core`, `packages/runtime-core`, and `packages/validator-core`.

Ignored except for must-not context:

- Domain C mesh sidecar files and Domain C reports/reviews.
- `apps/editor/.dev-server.out.log`.

Verification run by reviewer:

```text
pnpm.cmd exec vitest run packages/package-format/src/parameter-presets.test.ts packages/authoring-core/src/parameter-surface.test.ts packages/authoring-core/src/runtime-graph-adapter.test.ts packages/operation-core/src/operations/parameter-definition.test.ts packages/operation-core/src/operations/edit-keyform-key.test.ts packages/runtime-core/src/rig-control-opacity-keyform-state.test.ts packages/validator-core/src/parameter-keyform-package.test.ts
```

Result: pass, 7 files / 18 tests. Initial sandbox run failed with `spawn EPERM`; reviewer reran with approved escalation.

Loop 2 verification run by reviewer:

```text
pnpm.cmd exec vitest run packages/package-format/src/parameter-presets.test.ts packages/authoring-core/src/parameter-surface.test.ts packages/authoring-core/src/runtime-graph-adapter.test.ts packages/operation-core/src/operations/create-parameter.test.ts packages/operation-core/src/operations/parameter-definition.test.ts packages/operation-core/src/operations/edit-keyform-key.test.ts packages/runtime-core/src/rig-control-opacity-keyform-state.test.ts packages/validator-core/src/parameter-keyform-package.test.ts
```

Result: pass, 8 files / 26 tests. Initial sandbox run failed with `spawn EPERM`; reviewer reran with approved escalation.

## Basis requirement matrix

| Requirement | Basis | Classification | Evidence / note |
|---|---|---:|---|
| Spec review must classify basis requirements and not pass unclear items | `wave64-plan.md:87-90`, `wave64-plan.md:523` | implemented | This artifact provides the lane review. |
| Domain A owns package/operation/runtime/validator foundation, not editor UI | `wave64-plan.md:227-298` | implemented | Source changes are in `packages/**`; no Domain A editor UI change was reviewed. |
| Accepted UX may drive package fixes; package behavior must be deterministic and structured | `ux-backed-package-logic-authority.md:33-64` | implemented | `createParameter` preset-id collision now returns `operation.createParameter.duplicateParameter` instead of throwing; `editKeyformKey` endpoint-default `createEndsCenter` now rejects atomically. |
| Parameter preset catalog is always present; no `+ From Preset` creation flow | `wave64-plan.md:48-50`, `parameter-manager.md:292-299` | implemented | `PRESET_PARAMETER_CATALOG` and initialized surface exist in `parameter-presets.ts:29-149`; tests cover empty graph preset listing. |
| Preset role/group/range/sign convention locked; delete/mutation rejected | `wave64-plan.md:49`, `wave64-plan.md:245-249`, `parameter-manager.md:149-184` | implemented | `isLockedPresetParameter` and update/delete paths reject preset ids in `parameter-surface.ts:28-34`, `parameter-mutations.ts:42-61`, `parameter-mutations.ts:86-95`; operation tests cover update/delete rejection. |
| Preset id must not be recreated as Custom / duplicate create must be rejected coherently | `parameter-manager.md:292-299`, `wave64-plan.md:48-50`, Domain report handoff claim | implemented | `createParameter` uses `hasInitializedParameter` in preconditions and maps duplicate mutation fallback to `operation.createParameter.duplicateParameter` in `create-parameter.ts:57-128`; test covers `param_face_angle_x`. |
| Custom parameter can be updated | `wave64-plan.md:245-247`, `parameter-manager.md:201-206` | implemented | `updateParameter` updates displayName/min/max/default/step and validates merged range in `parameter-mutations.ts:33-84`, `parameter-mutations.ts:128-158`; operation handler/test exists. |
| Custom parameter can be safely deleted only when unreferenced | `wave64-plan.md:245-247`, `parameter-manager.md:218-222` | implemented | `deleteParameter` checks keyform and dynamics refs in `parameter-mutations.ts:86-126`, `parameter-mutations.ts:160-185`; operation test covers keyform ref rejection. |
| Custom parameter has no semantic role / role is Preset-only | `wave64-plan.md:50`, `parameter-manager.md:18-21`, `parameter-manager.md:188-212`, `parameter-preset-ecosystem.md:31-34` | implemented | `createParameter` ignores legacy `semanticRole` / `projectPresetAlias` payload fields in `create-parameter.ts:69-78`; initialized custom projection rebuilds only role-less fields in `parameter-presets.ts:166-178`; tests cover both paths. |
| Parameter Manager table fields can be backed by read projection | `wave64-plan.md:186-190`, `parameter-manager.md:112-143` | implemented | Initialized parameters expose id/displayName/kind/group/range/lockedFields/signConvention as report handoff states; usage count can be computed from graph refs by Domain D. |
| Preset Details locked metadata visible | `parameter-manager.md:149-184` | implemented | Preset DTO includes `presetRole`, `group`, `signConvention`, `lockedFields` in `parameter-presets.ts:12-20`, `parameter-presets.ts:272-300`. |
| Preset display name override | `parameter-manager.md:167`, `parameter-manager.md:363` | deferred by plan | v0 allowance is explicitly unresolved in screen spec; Domain A rejects all preset update operations. Not a pass blocker for the required checklist. |
| Parameter refactor stable id / type expansion | `parameter-manager.md:203-222`, `parameter-manager.md:365` | deferred by plan | Domain A supports displayName/range/step update only; Domain D must disable or defer unsupported refactor/type actions. |
| Keyform add/update/delete current value in one binding | `wave64-plan.md:251-257`, `parameter-keyform.md:171-182`, inventory `wave64-preplan-parameter-package-inventory.md:161-165` | implemented | `editLinear1dKeyformSet` handles add/update/delete and canonical binding id via `operation-ids.ts:88-139`; tests cover one binding set. |
| Ends keyforms | `wave64-plan.md:255`, `parameter-keyform.md:172-182` | implemented | `createKeyInputs` maps min/max in `edit-keyform-key.ts:185-196`; operation test covers min/max key positions. |
| Ends+Center keyforms | `wave64-plan.md:256`, `parameter-keyform.md:65`, `parameter-keyform.md:172-182` | implemented | Distinct min/default/max creates three keys; endpoint-default parameters reject with `operation.editKeyformKey.duplicateKey` and leave the session unchanged. Tests cover `param_eye_left_open` duplicate-position cases. |
| Reject duplicate key values for v0 | inventory `wave64-preplan-parameter-package-inventory.md:166`, `wave64-preplan-parameter-package-inventory.md:289` | implemented | `assertUniqueInputKeyValues` now rejects any duplicate input key value in `linear-keyform-editing.ts:345-356`; operation tests cover duplicate current key and endpoint-default `createEndsCenter`. |
| Reject missing parameter, missing target, unsupported v0 target/property, invalid patch shape, out-of-range key value | `wave64-plan.md:257`, inventory `wave64-preplan-parameter-package-inventory.md:289-291` | implemented | `edit-keyform-key.ts:214-387` maps state patch mismatch and mutation errors to structured diagnostics; operation tests cover unsupported property, invalid shape, key out of range. |
| Target support: Drawable opacity | `wave64-plan.md:259-264`, `parameter-keyform.md:214-231` | implemented | Whitelist and patch range check in `linear-keyform-editing.ts:363-369`; runtime existing drawable opacity behavior preserved. |
| Target support: Warp control point offsets / lattice state | `wave64-plan.md:259-264`, `parameter-keyform.md:216`, `rig-tool.md:281` | implemented | Whitelist/cardinality check in `linear-keyform-editing.ts:397-408`; existing runtime warp lattice behavior preserved. |
| Target support: Warp opacity multiplier | `wave64-plan.md:262`, `parameter-keyform.md:216`, `rig-tool.md:393-413` | implemented | `linear-keyform-editing.ts:410-415`; runtime warp path applies opacity samples in `rig-control-evaluation.ts:281-315`. |
| Target support: Rotation angle | `wave64-plan.md:263`, `parameter-keyform.md:217` | implemented | `linear-keyform-editing.ts:386-395`; existing runtime rotation sampling preserved. |
| Target support: Rotation opacity multiplier | `wave64-plan.md:264`, `parameter-keyform.md:217`, `rig-tool.md:393-413` | implemented | `linear-keyform-editing.ts:410-415`; runtime rotation path applies opacity samples in `rig-control-evaluation.ts:226-277`; test covers descendant opacity. |
| Runtime evaluates current parameter value for in-scope target properties | `wave64-plan.md:266-269` | implemented | Runtime parameter map uses initialized surface in `runtime-graph-parameters.ts:6-23`; opacity multiplier runtime added in `rig-control-opacity-keyform-state.ts:7-113` and integrated in `rig-control-evaluation.ts:235-240`, `rig-control-evaluation.ts:290-295`. |
| Preserve existing linear 1D / grid 2D behavior | `wave64-plan.md:266-269` | implemented | New operation is additive; legacy `addKeyform` / `addKeyformGrid2d` remain. Focused adapter/runtime tests pass. |
| Validation: duplicate parameter id | `wave64-plan.md:271-276` | implemented | `parameter-keyform-package.ts:27-59`; test expects `parameter.duplicateId`. |
| Validation: missing parameter refs, including preset catalog initialization | `wave64-plan.md:271-276` | implemented | `parameter-keyform-package.ts:134-184`; preset initialized surface at `parameter-keyform-package.ts:137-138`; test covers preset ref not missing. |
| Validation: out-of-range keyform positions | `wave64-plan.md:271-276` | implemented | `parameter-keyform-package.ts:186-244`, `parameter-keyform-package.ts:379-406`; test expects `keyform.keyOutOfRange`. |
| Validation: keyform target missing | `wave64-plan.md:271-276` | implemented | `parameter-keyform-package.ts:246-292`, `parameter-keyform-package.ts:408-423`; test expects `keyform.targetMissing`. |
| Validation: unsupported keyform property | `wave64-plan.md:271-276` | implemented | `parameter-keyform-package.ts:425-469`; test expects `keyform.unsupportedTargetProperty`. Validator intentionally remains broader than v0 operation for legacy runtime-supported package keyforms. |
| Validation: preset locked mutation | `wave64-plan.md:271-276` | implemented | `parameter-keyform-package.ts:61-98`, `parameter-keyform-package.ts:333-377`; test expects `parameter.presetLockedMutation`. |
| Domain B/D handoff: operation names / DTOs | `wave64-plan.md:285-290` | implemented | Domain report lists `updateParameter`, `deleteParameter`, `editKeyformKey` payload shapes. |
| Domain B/D handoff: read projection fields | `wave64-plan.md:285-290` | implemented | Domain report lists initialized parameter fields; source exports `listInitializedParameters` / `getInitializedParameterById`. |
| Domain B/D handoff: rejected states / diagnostics | `wave64-plan.md:285-290` | implemented | Updated Domain report documents `operation.createParameter.duplicateParameter`, `operation.editKeyformKey.duplicateKey`, and Domain B/D behavior for endpoint-default `createEndsCenter`. |
| Domain B/D handoff: preset initialization behavior | `wave64-plan.md:285-290` | implemented | Report and source describe catalog-first surface and runtime projection. |
| Domain B/D handoff: exact support matrix | `wave64-plan.md:285-290` | implemented | Report includes v0 target/property/value/composition matrix for `editKeyformKey`; legacy broader ops are called out. |
| Forbidden: Editor UI, full Parameter Manager UI, Camera Capture, external facade | `wave64-plan.md:291-298`, `wave64-plan.md:451-453` | implemented | No Domain A code in `apps/editor/**`; no facade/transport implementation found in claimed files. |
| Forbidden: visibility/clipping/draw order/Parts Container/mesh topology keyforms for v0 editing | `wave64-plan.md:291-298`, `parameter-keyform.md:214-223` | implemented | New `editKeyformKey` rejects non-drawable/rigControl targets and unsupported v0 properties in `edit-keyform-key.ts:273-296`, `linear-keyform-editing.ts:359-419`. Legacy operations remain broader by explicit compatibility note. |
| Forbidden: semantic auto assignment / auto-rig | `wave64-plan.md:298`, `parameter-preset-ecosystem.md:34`, `rig-tool.md:9-25` | implemented | No semantic recognition or auto assignment behavior found. |

## Findings

No open Spec Compliance blockers in loop 2.

### Loop 1 finding resolution

| Loop 1 finding | Loop 2 status | Evidence |
|---|---:|---|
| S1: `createParameter` preset-id collision threw instead of structured operation rejection | resolved | `createParameterOperationHandler` now checks `hasInitializedParameter` and maps duplicate mutation fallback to `operation.createParameter.duplicateParameter` in `packages/operation-core/src/operations/create-parameter.ts:57-128`; `packages/operation-core/src/operations/create-parameter.test.ts:18-39` covers `param_face_angle_x` rejection without mutation. |
| S2: `createEndsCenter` could commit duplicate key positions for endpoint-default parameters | resolved | `assertUniqueInputKeyValues` rejects any duplicate input key position in `packages/authoring-core/src/linear-keyform-editing.ts:345-356`; `packages/operation-core/src/operations/edit-keyform-key.test.ts:180-210` covers both different-patch and identical-patch endpoint-default cases with `operation.editKeyformKey.duplicateKey` and no mutation. |
| S3: Custom parameter role semantics were not enforced by create/read projection | resolved | `createParameter` no longer stores `semanticRole` / `projectPresetAlias` in `packages/operation-core/src/operations/create-parameter.ts:69-78`; initialized custom projection omits semantic/preset fields in `packages/package-format/src/parameter-presets.ts:166-178`; tests cover operation and legacy stored surface normalization in `create-parameter.test.ts:41-65` and `parameter-presets.test.ts:54-77`. |

## Handoff assessment

Domain B/D handoff is usable for Wave64:

- Operation names and DTOs are present for `updateParameter`, `deleteParameter`, and `editKeyformKey`.
- Initialized read projection exists through `listInitializedParameters` / `getInitializedParameterById`.
- Target support matrix for `editKeyformKey` is explicit and aligned with v0 target properties.
- Runtime support for rig control opacity multiplier is present and tested for rotation descendants; warp path is integrated in the same evaluation path.
- Updated Domain report now documents `createParameter` preset collision diagnostics, role-less Custom create/read behavior, and endpoint-default `createEndsCenter` duplicate-key rejection.
- Domain B/D should disable `Ends+Center` or show `operation.editKeyformKey.duplicateKey` feedback when active parameter min/default/max are not distinct.

## Residual risks / open verification items

- Loop 2 focused tests pass and cover the prior high-risk rejected states.
- Legacy `addKeyform` / `addKeyformGrid2d` remain broader than v0. This is acceptable only if Domain B/D use `editKeyformKey` for the Wave64 loop, as the Domain report states.
- Validator intentionally accepts some legacy runtime-supported properties that v0 authoring rejects. Future final integration should confirm UI/operation paths do not surface visibility/draw-order keyform authoring for Wave64.
- Full `pnpm test:unit` was not run by this review lane; reviewer ran the focused Domain A command above.
