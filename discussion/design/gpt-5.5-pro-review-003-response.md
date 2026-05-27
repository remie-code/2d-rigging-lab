# GPT-5.5 Pro Review 003 Response

> Source review: `memo/gpt-5.5-pro-review/review_003.md`
> Scope: `discussion/` only. No implementation code changed.
> Relationship: Supersedes and refines `review_002` Dynamics contract details.

## Decision

Minimum Open Dynamics v1 remains in the current MVP.

The finalized MVP interpretation is:

- Dynamics is parameter-driven deterministic secondary motion.
- Runtime core has no hidden mutable Dynamics state.
- Runtime evaluation receives previous `RuntimeStateDto` and returns `RuntimeSnapshotDto` plus next `RuntimeStateDto`.
- One dynamics group produces exactly one computed output parameter.
- A computed output parameter may have at most one producer group.
- Multiple drivers are combined by deterministic weighted sum.
- `scalarDampedFollowV1` is the only MVP solver, with fixed discrete update semantics.
- Dynamics never directly writes mesh vertices or rigControl properties in MVP.

Cubism Physics compatibility, `.physics3.json` import/export, Cubism Viewer matching, Cubism Editor Physics UI reproduction, direct vertex physics, direct rigControl physics output, cloth simulation, collision, IK, timeline bake, production motion integration, and AI automatic dynamics tuning remain outside MVP.

## RE-FINAL Classification

| Review item | Classification | Result |
|-------------|----------------|--------|
| RE-FINAL-001 Runtime APIはDynamics stateを明示的に入出力 | 今回反映 | `evaluateRuntimeFrame`, `evaluateRuntimeSequence`, `RuntimeStateDto`, explicit previous/next state, deterministic replay wording added. |
| RE-FINAL-002 1 dynamics group = 1 computed output parameter | 今回反映 | Package/runtime/AC/scenario now use single `output`; multi-output is Post-MVP. |
| RE-FINAL-003 computed output parameter重複producer禁止 | 今回反映 | Output uniqueness rule and `dynamics.outputTargetDuplicate` added. |
| RE-FINAL-004 複数driverはweighted sum | 今回反映 | Runtime formula and AC/scenario wording added. |
| RE-FINAL-005 `scalarDampedFollowV1`式を固定 | 今回反映 | Settings, update formula, clamp order, reset snap, timestep overflow diagnostics added; `response` is UI-only / not runtime input. |
| RE-FINAL-006 output rangeとtarget parameter range | 今回反映 | `DynamicsOutputSchema` keeps min/max; output range inside parameter range and clamp order documented. |
| RE-FINAL-007 `dynamics.groupMissing`一般error廃止 | 今回反映 | Replaced with `dynamics.requiredGroupMissing` and `dynamics.computedParameterProducerMissing`. |
| RE-FINAL-008 resetPolicyとreset reason mapping | 今回反映 | Runtime and operation contracts include reset reason mapping; preview reset is non-package mutation evidence. |
| RE-FINAL-009 `RuntimeDiffSchema.dynamicsChanges` | 今回反映 | Shared TypeScript contract and runtime contract add `dynamicsChanges`. |
| RE-FINAL-010 SC-DYN-003/004 AC対応 | 今回反映 | `SC-DYN-003` maps to AC-PHYS-002/003/005; `SC-DYN-004` remains demo-safe AC-PHYS-006. |
| RE-FINAL-011 `scalarDampedFollowV1`未決扱い解除 | 今回反映 | Dynamics scenarios now list it under finalized MVP constraints. |
| RE-FINAL-012 存在しないreport参照修正 | 今回反映 | `deformer-structure-technology` paths and private-research-archive note added. |
| RE-FINAL-013 prose / machine-readable ID規則 | 今回反映 | `_conventions.md` now separates prose `rig control` from machine-readable `rigControl`. |
| RE-FINAL-014 PSD primary / split PNG fallback確定 | 維持済み | Existing AC/contracts already treat PSD primary and split PNG fallback as fixed MVP contract. |
| RE-FINAL-015 CheckIdSchema camelCase / 空白禁止 | 維持済み | Existing `CheckIdSchema` already matches camelCase dotted IDs; naming convention reinforces space ban. |
| RE-FINAL-016 KeyformSetSchema 1D/2D union | 維持済み | Existing package contract already uses `z.discriminatedUnion("evaluator", [...])`. |
| RE-FINAL-017 Parameter scenario current contract | 維持済み | Existing Parameter scenario already limits MVP to `linear-1d-v1`, `parameter-grid-2d-v1`, `bilinear-grid-v1`. |
| RE-FINAL-018 SC-PARAM-005/006/007 traceability | 維持済み | Existing scenarios and traceability matrix already include SC-PARAM-005/006/007. |

## Implementation Checklist Status

- [x] Minimum Open Dynamics v1 remains in MVP.
- [x] Runtime API receives previous `RuntimeStateDto` and returns next `RuntimeStateDto`.
- [x] `evaluateRuntimeSequence` helper is defined.
- [x] 1 dynamics group = 1 computed output parameter.
- [x] Duplicate computed output producer is detected by validator.
- [x] Multiple driver weighted sum is fixed in runtime contract.
- [x] `scalarDampedFollowV1` discrete update formula is fixed.
- [x] `response` is excluded from runtime evaluator source of truth and treated as UI-only if exposed.
- [x] Output range must fit inside target parameter range.
- [x] `dynamics.groupMissing` is not a general package error.
- [x] Reset policy and reset reason mapping are documented.
- [x] `RuntimeDiffSchema.dynamicsChanges` is added.
- [x] `SC-DYN-003` / `SC-DYN-004` AC mapping is corrected.
- [x] `scalarDampedFollowV1` is removed from unresolved status.
- [x] Invalid historical rig-control report references are corrected.
- [x] Machine-readable IDs use `rigControl`; spaced prose is allowed only in natural language.
- [x] PSD primary / split PNG fallback remains a fixed MVP decision.
- [x] `CheckIdSchema` matches camelCase check IDs.
- [x] `KeyformSetSchema` is a 1D/2D discriminated union.
- [x] `SC-PARAM-005` / `006` / `007` traceability is present.

## Remaining User-Decision Points

None for review_003 document reflection.

Implementation-time non-blockers remain:

- exact fixture JSON values for `scalarDampedFollowV1` expected output sequences,
- concrete rights-clean PSD art bytes,
- exact repository fixture path and test harness implementation.
