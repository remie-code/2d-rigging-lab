# Wave65 Domain D Design / Development Compliance Review

## Verdict

`pass`

## Findings

No blocking or warning findings.

## Evidence Checked

- Basis and policy documents:
  - `discussion/implementation/orchestration/wave65-plan.md`
    - Domain D is a headless sidecar and must not switch the Editor default to V2.5 (`wave65-plan.md:15`, `wave65-plan.md:73`, `wave65-plan.md:249`, `wave65-plan.md:432`, `wave65-plan.md:453`).
    - Required Domain D package capabilities include explicit `auto-outline-v2.5-soft-boundary`, ratio-based soft boundary, fallback, quality/provenance, and no broad geometry dependency (`wave65-plan.md:434`, `wave65-plan.md:436`, `wave65-plan.md:455`).
  - `discussion/design/mesh-generation/auto-outline-v2-5-soft-boundary.md`
    - V2.5 is defined as V2-based alpha-aware soft-boundary generation, not Cubism reproduction (`auto-outline-v2-5-soft-boundary.md:13`, `auto-outline-v2-5-soft-boundary.md:54`, `auto-outline-v2-5-soft-boundary.md:243`).
  - `discussion/design/screen-design/components/mesh-tool.md`
    - Mesh Tool design treats V2.5 as the next candidate and keeps algorithm details in package logic, not UI components (`mesh-tool.md:287`).
  - `discussion/development_convention/source-file-organization-policy.md`
  - `discussion/development_convention/ux-backed-package-logic-authority.md`
  - `discussion/development_convention/dependency-policy.md`

- Changed source files:
  - `packages/authoring-core/src/mesh-outline-v2-5-soft-boundary-generation.ts`
    - Owns the headless V2.5 generator (`mesh-outline-v2-5-soft-boundary-generation.ts:109`).
    - Keeps V2.5-specific config, soft boundary creation, interior sampling, triangle filtering, and metrics in package code (`mesh-outline-v2-5-soft-boundary-generation.ts:125`, `mesh-outline-v2-5-soft-boundary-generation.ts:157`, `mesh-outline-v2-5-soft-boundary-generation.ts:176`, `mesh-outline-v2-5-soft-boundary-generation.ts:200`, `mesh-outline-v2-5-soft-boundary-generation.ts:224`).
    - Does not claim full constrained triangulation; provenance records ordinary Delaunay filtering and deferred constrained triangulation (`mesh-outline-v2-5-soft-boundary-generation.ts:245`, `mesh-outline-v2-5-soft-boundary-generation.ts:247`, `mesh-outline-v2-5-soft-boundary-generation.ts:249`, `mesh-outline-v2-5-soft-boundary-generation.ts:801`).
  - `packages/authoring-core/src/mesh-generation.ts`
    - Adds the explicit method and result source (`mesh-generation.ts:24`, `mesh-generation.ts:29`, `mesh-generation.ts:34`).
    - Routes V2.5 through V2 then V1/grid fallback without replacing V2 (`mesh-generation.ts:127`, `mesh-generation.ts:141`, `mesh-generation.ts:156`, `mesh-generation.ts:158`, `mesh-generation.ts:169`, `mesh-generation.ts:216`).
  - `packages/authoring-core/src/mesh-quality-metrics.ts`
    - Adds scoped `softBoundaryMetrics` alongside existing quality metrics (`mesh-quality-metrics.ts:16`, `mesh-quality-metrics.ts:42`, `mesh-quality-metrics.ts:69`, `mesh-quality-metrics.ts:132`).
  - `packages/authoring-core/src/index.ts`
    - Remains a barrel export; it only re-exports the new V2.5 generator.
  - `packages/operation-core/src/payloads/model-edit.ts`
    - Adds the same method string to the operation payload schema (`model-edit.ts:157`).
  - `packages/operation-core/src/operations/generate-mesh.ts`
    - Allows V2.5 in preconditions and records fallback/provenance through existing transform-history plumbing (`generate-mesh.ts:215`, `generate-mesh.ts:327`, `generate-mesh.ts:331`, `generate-mesh.ts:389`).
  - `packages/authoring-core/src/mesh-generation.test.ts`
    - Covers deterministic V2.5 output, lower counts, soft-boundary metrics, Large Motion density guard, fallback, and explicit sidecar routing (`mesh-generation.test.ts:226`, `mesh-generation.test.ts:282`, `mesh-generation.test.ts:336`, `mesh-generation.test.ts:637`, `mesh-generation.test.ts:709`).
  - `packages/operation-core/src/operations/generate-mesh.test.ts`
    - Covers V2.5 operation provenance and fallback chain (`generate-mesh.test.ts:283`, `generate-mesh.test.ts:402`).
  - `discussion/implementation/waves/wave65/wave65-domain-d-mesh-auto-outline-v2-5-soft-boundary-sidecar-report.md`
    - Report path is correct and its scope claims match the inspected implementation: explicit method, no dependency/manifest changes, ordinary Delaunay with filters, and residual risks (`wave65-domain-d-mesh-auto-outline-v2-5-soft-boundary-sidecar-report.md:10`, `wave65-domain-d-mesh-auto-outline-v2-5-soft-boundary-sidecar-report.md:12`, `wave65-domain-d-mesh-auto-outline-v2-5-soft-boundary-sidecar-report.md:41`, `wave65-domain-d-mesh-auto-outline-v2-5-soft-boundary-sidecar-report.md:111`).

- Editor default evidence:
  - `apps/editor/src/features/editor-session/editor-session-context.tsx:646` and `apps/editor/src/features/editor-session/model/editor-session-commands.ts:279` still default to `auto-outline-v2`.
  - Search for `auto-outline-v2.5-soft-boundary` under `apps/editor/src` returned no matches.

## Verification Performed

- `node scripts/check-source-organization.mjs`
  - Passed.
- `node scripts/check-dependencies.mjs`
  - Passed.
- `git diff --check -- packages/authoring-core/src packages/operation-core/src discussion/implementation/waves/wave65/wave65-domain-d-mesh-auto-outline-v2-5-soft-boundary-sidecar-report.md`
  - Passed. Git printed LF/CRLF working-copy warnings only.
- `pnpm.cmd exec vitest run packages/authoring-core/src/mesh-generation.test.ts packages/operation-core/src/operations/generate-mesh.test.ts`
  - Passed outside sandbox after sandboxed Vitest failed with esbuild child-process `spawn EPERM`.
  - Result: 2 test files passed, 37 tests passed.

## Compliance Notes

- Logic authority remains in package layers. No inspected UI component embeds V2.5 algorithm details.
- Source organization is acceptable for this lane. The new algorithm file is large, but it has a specific responsibility and the source organization guard passed; `index.ts` remains barrel-only.
- No forbidden Domain D `apps/editor/**` implementation/default change was found. Existing Editor mesh generation default remains V2.
- No dependency, manifest, or lockfile change was found; dependency guard passed.
- Public method/provenance additions are scoped and consistent between authoring-core and operation-core.
- The implementation and report do not misrepresent ordinary Delaunay filtering as full constrained triangulation.

## Residual Risks

- `mesh-outline-v2-5-soft-boundary-generation.ts` is 1410 lines and duplicates several geometry helper patterns already present in V2/V3 generators. This is acceptable for the current sidecar but should be revisited if more outline variants are added.
- V2.5 still uses ordinary Delaunay plus filtering, so constrained boundary quality remains a future improvement.
- Multiple distant alpha islands are represented by largest-contour behavior; this is recorded as residual risk in the report and should be visually reviewed on real artwork before any default switch.
- This review did not evaluate unrelated dirty `apps/editor/**` changes from other Wave65 domains beyond confirming they do not default to V2.5.
