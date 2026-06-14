# Wave68 Implementation Map

> Lightweight map for Wave68 implementation artifacts.

## Entry Points

- Plan: [../../orchestration/wave68-plan.md](../../orchestration/wave68-plan.md)
- Preplan inventory: [../wave68-preplan-mesh-generation-replacement-inventory.md](../wave68-preplan-mesh-generation-replacement-inventory.md)

## Domain Reports

| Domain | Report | Status |
|---|---|---|
| Domain A: V6 Shared Contract / Dependency Gate / Method Surface | [wave68-domain-a-v6-shared-contract-dependency-gate-method-surface-report.md](wave68-domain-a-v6-shared-contract-dependency-gate-method-surface-report.md) | `pass` |
| Domain B: Mesh Auto Outline V6A Local Sidecar | [wave68-domain-b-mesh-auto-outline-v6a-local-sidecar-report.md](wave68-domain-b-mesh-auto-outline-v6a-local-sidecar-report.md) | `pass` |
| Domain C: Mesh Auto Outline V6B Constrainautor Sidecar | [wave68-domain-c-mesh-auto-outline-v6b-constrainautor-sidecar-report.md](wave68-domain-c-mesh-auto-outline-v6b-constrainautor-sidecar-report.md) | `pass` |
| Domain D: Mesh Auto Outline V6C Poly2Tri Sidecar | [wave68-domain-d-mesh-auto-outline-v6c-poly2tri-sidecar-report.md](wave68-domain-d-mesh-auto-outline-v6c-poly2tri-sidecar-report.md) | `pass` |
| Domain E: Editor Temporary V6 Backend Selector / Preview Provenance | [wave68-domain-e-editor-temporary-v6-backend-selector-preview-provenance-report.md](wave68-domain-e-editor-temporary-v6-backend-selector-preview-provenance-report.md) | `pass` |
| Domain F: Final Integration / Clean Review / Map Closeout | [wave68-final-integration-report.md](wave68-final-integration-report.md) | `pass` |

## Current State

- Domain A implementation source/tests are complete.
- Spec Compliance re-review passed after the Domain A report was added.
- Test Adequacy Review passed.
- Design / Development Compliance passed after Undine authorized and Gnome completed the dependency registry update.
- `generated/dependencies/dependency-registry.json` now records the five Wave68 direct dependencies and three observed transitive dependencies.
- Domain B implements dependency-free `auto-outline-v6a-local` as an approximate local backend and keeps v6b/v6c deferred.
- Domain B review lanes passed after Fix Loop 1 resolved a v6a DTO invariant test coverage gap.
- Domain C implements `auto-outline-v6b-constrainautor` as a `delaunator + @kninnug/constrainautor` sidecar. Initial Design / Development Review passed; initial Spec and Test Adequacy reviews found report/retry/fixture/empty-alpha coverage gaps; Fix Loop 1 resolved them and all re-reviews passed.
- Domain D implements `auto-outline-v6c-poly2tri` as a `poly2tri` constrained polygon + Steiner point sidecar. Spec Compliance, Design / Development Compliance, and Test Adequacy are final `pass` after two bounded fix loops.
- Domain E adds a temporary Mesh Tool backend selector for default v2.6 plus v6a/v6b/v6c, keeps presets separate, and preserves default v2.6 behavior when the selector is not used.
- Domain E Fix Loop 1 added durable `previewProvenance` through the generateMesh preview commit path so applied v6 previews retain actual source, fallback, and v6 output quality provenance.
- Domain E Spec Compliance, Design / Development Compliance, and Test Adequacy reviews are final `pass` after Fix Loop 1.
- Domain F final validation found and fixed a Vite/browser boot blocker from `poly2tri` reading Node `global`; `apps/editor/vite.config.ts` now maps `global` to `globalThis` for Vite and optimized dependencies.
- Domain F final validation passed typecheck, focused Vitest, source organization, dependency guard, Editor build, focused PSD/Mesh Playwright semantic flows, and `git diff --check`.
- Final clean integration review is `pass` with no blocking findings.

## Next Actions

1. No further Wave68 implementation action required before Undine closeout.
2. Future backend-selection work should compare v6a/v6b/v6c visually and semantically before promoting any v6 backend to default.
3. Future hardening can add direct operation-payload rejection for mismatched `previewProvenance` method metadata.

## Unresolved Questions

- None for Wave68 final integration.
