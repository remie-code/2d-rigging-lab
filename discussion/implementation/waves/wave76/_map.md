# Wave76 Implementation Map

> Local map for Wave76 implementation artifacts.

## Entry Points

- Plan: [../../orchestration/wave76-plan.md](../../orchestration/wave76-plan.md)
- Domain A implementation report: [wave76-domain-a-webgl-clipping-feedback-loop-fix-report.md](wave76-domain-a-webgl-clipping-feedback-loop-fix-report.md)
- Domain B implementation report: [wave76-domain-b-rigcontrol-partid-legacy-optional-decoupling-report.md](wave76-domain-b-rigcontrol-partid-legacy-optional-decoupling-report.md)
- Domain C implementation report: [wave76-domain-c-drawable-multiselect-parts-tree-select-inspector-report.md](wave76-domain-c-drawable-multiselect-parts-tree-select-inspector-report.md)
- Domain D implementation report: [wave76-domain-d-mesh-target-simplification-multi-preview-apply-report.md](wave76-domain-d-mesh-target-simplification-multi-preview-apply-report.md)
- Domain E implementation report: [wave76-domain-e-rig-batch-create-unbound-drawables-report.md](wave76-domain-e-rig-batch-create-unbound-drawables-report.md)
- Final integration report: [wave76-final-integration-report.md](wave76-final-integration-report.md)

## Status

| Artifact | Status | Notes |
|---|---|---|
| [wave76-domain-a-webgl-clipping-feedback-loop-fix-report.md](wave76-domain-a-webgl-clipping-feedback-loop-fix-report.md) | pass | WebGL mask framebuffer feedback-loop fixed with sampler unbind before mask FBO draw; fake-GL guard covers first clipped drawable, mask target reuse, and missing/unrenderable mask skip behavior after Fix Loop 1. Real WebGL/readPixels proof remains blocked by missing focused harness and is recorded as residual risk. |
| [wave76-domain-b-rigcontrol-partid-legacy-optional-decoupling-report.md](wave76-domain-b-rigcontrol-partid-legacy-optional-decoupling-report.md) | pass | RigControl `partId` is optional legacy metadata; new rig create flows omit Parts Container ownership; focused tests, typecheck, policy guards, and all three independent review lanes passed. |
| [wave76-domain-c-drawable-multiselect-parts-tree-select-inspector-report.md](wave76-domain-c-drawable-multiselect-parts-tree-select-inspector-report.md) | pass | Drawable-only multi-select, Parts Tree modifier-click selection, Select Inspector list, and Canvas selected Drawable projection passed after Fix Loop 1 resolved anchor/test findings. |
| [wave76-domain-d-mesh-target-simplification-multi-preview-apply-report.md](wave76-domain-d-mesh-target-simplification-multi-preview-apply-report.md) | pass | Mesh Inspector Target is name-only, Drawable-set Mesh Tool lists selected names, batch preview/apply targets eligible missing/empty meshes only, generated meshes are warned/excluded, Cancel clears all drafts, and Canvas evaluation/projection/renderer support multiple mesh overlays. |
| [wave76-domain-e-rig-batch-create-unbound-drawables-report.md](wave76-domain-e-rig-batch-create-unbound-drawables-report.md) | pass | Rig Tool Drawable-set target section lists selected Drawables, excludes/warns already-bound Drawables, disables create actions when zero eligible, and creates root Rotation/Warp Deformers for eligible Drawables only with union bounds and no `partId`. Independent Spec, Design/Development, and Test Adequacy review lanes passed with no fix loop required. |
| [wave76-final-integration-report.md](wave76-final-integration-report.md) | final complete / pass | Domain F integration report records A-E pass gates, final integrated behavior, validation evidence, residual risks, final clean review pass, and Domain F checks. |

## Current State

- Domain A implementation and review gate are complete / pass after Fix Loop 1.
- Domain B implementation and review gate are complete / pass with no fix loop required.
- Domain C implementation and review gate are complete / pass after Fix Loop 1.
- Domain D implementation and review gate are complete / pass with no fix loop required.
- Domain E implementation and review gate are complete / pass with no fix loop required.
- Domain F final integration report and independent final clean review are complete / pass.

## Next Actions

1. Treat Wave76 as final complete / pass.
2. Carry Domain A residual risk forward: real browser WebGL pixel proof is not passed, only documented as blocked by missing focused package-level harness.
3. Carry Domain D residual risks forward: the Generate Preview disabled/running visual state is source-covered but synchronous and not directly asserted, and multi-overlay count is covered by unit tests while E2E asserts overlay status.
4. Carry Domain E residual risk forward: batch Warp create is model/operation-tested but not separately browser-tested; E2E covers batch Rotation create and bound-only disabled UI.

## Unresolved Questions

- None requiring a user decision.
