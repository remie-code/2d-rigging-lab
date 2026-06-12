# Wave65 Domain D Spec Compliance Review

- verdict: `pass`
- review lane: Spec Compliance Review
- domain: `wave65-mesh-auto-outline-v2-5-soft-boundary-sidecar`
- reviewer: independent Review-Sylph
- date: 2026-06-12

## Findings

No blocking spec findings.

Non-blocking residual note:

- V2.5 shares the metrics surface and uses V2 as fallback, but common alpha / contour / Delaunay helpers were not extracted from V2. Comparable private helpers remain in V2 (`packages/authoring-core/src/mesh-outline-v2-generation.ts:261`, `:299`, `:740`) and V2.5 (`packages/authoring-core/src/mesh-outline-v2-5-soft-boundary-generation.ts:331`, `:373`, `:801`). This is a maintenance risk, not a spec failure, because the rubric says reuse/extract V2 helpers "where appropriate" and the sidecar behavior is explicitly routed and tested.

## Spec Compliance Evidence

- Explicit method exists and is headlessly routed: `MeshGenerationMethod` includes `auto-outline-v2.5-soft-boundary` in `packages/authoring-core/src/mesh-generation.ts:24`, and `createGeneratedMeshForDrawable` routes that method to `createAutoOutlineV25SoftBoundaryMesh` at `packages/authoring-core/src/mesh-generation.ts:127`. Operation payload validation accepts the same method at `packages/operation-core/src/payloads/model-edit.ts:150`.
- V2.5 remains a sidecar and does not become the Editor default: current editor command default remains `auto-outline-v2` at `apps/editor/src/features/editor-session/model/editor-session-commands.ts:279`; app usage search shows only `auto-outline-v2` in `apps/editor/src/features/editor-session/editor-session-context.tsx:646` and `:684`.
- Required algorithm capabilities are represented: Drawable RGBA alpha thresholding starts at `packages/authoring-core/src/mesh-outline-v2-5-soft-boundary-generation.ts:118`; ratio-based padding config is derived from alpha bounds at `:268`; soft boundary generation applies centroid padding and area caps at `:521`; sparse interior sampling is at `:614`; outside / far-transparent triangle rejection is at `:674` and `:724`.
- Quality metrics and provenance are present: V2.5 soft boundary metrics are assembled at `packages/authoring-core/src/mesh-outline-v2-5-soft-boundary-generation.ts:224`, included in `computeMeshQualityMetrics` at `:252`, typed in `packages/authoring-core/src/mesh-quality-metrics.ts:41`, and formatted into operation provenance at `packages/operation-core/src/operations/generate-mesh.ts:386`.
- Fallback to V2 / existing fallback is implemented with reasons: V2.5 failure falls to V2 at `packages/authoring-core/src/mesh-generation.ts:147`, then V1 / bounds-grid at `:177` and `:211`, with fallback steps populated at `:156`, `:186`, and `:216`.
- Acceptance coverage is present in focused tests: deterministic/coarser V2.5 vs V2 fixture coverage at `packages/authoring-core/src/mesh-generation.test.ts:246` and `:257`; Large Motion no denser than V2 Low Motion at `:282`; rejection metrics at `:336`; explicit sidecar routing at `:709`; V2.5 fallback to V2 at `:637`; operation provenance at `packages/operation-core/src/operations/generate-mesh.test.ts:283`.
- Forbidden work was not found in the reviewed Domain D diff. No package manifest or lockfile change was present. The report explicitly says ordinary Delaunay is not full constrained triangulation at `discussion/implementation/waves/wave65/wave65-domain-d-mesh-auto-outline-v2-5-soft-boundary-sidecar-report.md:41` and `:113`; source provenance records `constrained-triangulation-deferred` rather than claiming full constrained triangulation at `packages/authoring-core/src/mesh-outline-v2-5-soft-boundary-generation.ts:249`.

## Evidence Checked

- Basis documents: Wave65 plan, V2/V2.5/V3 mesh generation specs, Mesh Tool component spec, Wave65 test oracle inventory, Wave64 V3 sidecar report, Wave64 final integration report.
- Changed files: all files listed in the review request, including the Domain D sidecar report.
- Searches performed: method/default routing search across `apps/editor/src`, `packages/authoring-core/src`, and `packages/operation-core/src`; forbidden-term / dependency surface search over the Domain D files; package manifest / lockfile status check.

## Verification Performed

- `pnpm.cmd exec vitest run packages/authoring-core/src/mesh-generation.test.ts packages/operation-core/src/operations/generate-mesh.test.ts`
  - sandbox attempt failed before config load with known `spawn EPERM`.
  - approved rerun passed: 2 files, 37 tests.
- `pnpm.cmd typecheck`
  - passed (`tsc --noEmit`).

## Residual Risks

- Visual quality on real art remains unverified; this matches the basis docs' human visual check boundary before considering a default switch.
- Multiple distant islands still rely on largest-contour behavior, as recorded by the implementer, and should remain a future algorithm risk.
- V2/V2.5 helper duplication may make future mesh algorithm changes more expensive unless a later design/development pass extracts stable shared utilities.
