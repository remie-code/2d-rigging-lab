# Wave69 Implementation Map

> Lightweight map for Wave69 implementation artifacts.

## Entry Points

- Plan: [../../orchestration/wave69-plan.md](../../orchestration/wave69-plan.md)
- Design basis: [../../../design/mesh-generation/auto-outline-v6d-v6e-v6f-contour-salvage-triangulation.md](../../../design/mesh-generation/auto-outline-v6d-v6e-v6f-contour-salvage-triangulation.md)
- Mesh design map: [../../../design/mesh-generation/_map.md](../../../design/mesh-generation/_map.md)

## Domain Reports

| Domain | Status | Artifact |
|---|---|---|
| A: V6 contour salvage shared pipeline / method surface | pass | [wave69-domain-a-v6-contour-salvage-shared-pipeline-method-surface-report.md](wave69-domain-a-v6-contour-salvage-shared-pipeline-method-surface-report.md) |
| B: V6D contour + Constrainautor | pass | [wave69-domain-b-mesh-auto-outline-v6d-contour-constrainautor-report.md](wave69-domain-b-mesh-auto-outline-v6d-contour-constrainautor-report.md) |
| C: V6E contour + Poly2Tri | pass after Domain E registry integration | [wave69-domain-c-mesh-auto-outline-v6e-contour-poly2tri-report.md](wave69-domain-c-mesh-auto-outline-v6e-contour-poly2tri-report.md) |
| D: V6F custom constrained triangulation | pass | [wave69-domain-d-mesh-auto-outline-v6f-custom-constrained-triangulation-report.md](wave69-domain-d-mesh-auto-outline-v6f-custom-constrained-triangulation-report.md) |
| E: Editor selector replacement / final integration | pass | [wave69-domain-e-editor-v6d-v6e-v6f-selector-final-integration-report.md](wave69-domain-e-editor-v6d-v6e-v6f-selector-final-integration-report.md) |

## Current State Summary

- Domain A added v6D/E/F method/source/backend surfaces and the shared v6 contour pipeline.
- Domain B added the v6D Constrainautor backend and passed review.
- Domain C added the v6E Poly2Tri backend. Its registry status mismatch was resolved by Domain E; v6E is now canonical `implemented`.
- Domain D added the v6F custom constrained triangulation backend and passed review after Fix Loop 1.
- Domain E replaced the visible temporary Editor comparison choices with v6D/v6E/v6F and, at Wave69 closeout, kept the default on `auto-outline-v2.6-soft-apron`; later Wave70/71 changed the route.
- Final clean integration review is recorded `pass`.
- Wave69 is final complete / pass. Final backend selection remained outside Wave69 at that historical closeout; later Wave70/71 route changes supersede this temporal guidance.

## Next Actions

1. Historical Wave69 action: use the v6D/v6E/v6F selector for human visual comparison.
2. Historical Wave69 action: decide in a later wave whether v6D, v6E, v6F, or none should become the default; Wave70/71 subsequently selected the v6D lineage.

## Unresolved Questions

- At Wave69 closeout, final backend selection remained a later user decision after visual comparison; later route changes are recorded by Wave70/71.
- Exact visual fixture for the user's hair/eye spoke-like failure was a later backend/integration validation item in the Wave69 record.
