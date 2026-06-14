# Wave68 Domain B Design / Development Compliance Review

- Verdict: `pass`
- Wave: `mesh-generation-quality-foundation-v6-sidecar-candidates`
- Domain: `wave68-mesh-auto-outline-v6a-local-sidecar`
- Review lane: Design / Development Compliance
- Reviewer: Review-Sylph lane 2
- Date: 2026-06-14

## Scope Reviewed

Domain B implementation-relevant files reviewed:

- `packages/authoring-core/src/mesh-generation-v6a-local.ts`
- `packages/authoring-core/src/mesh-generation-contract.ts`
- `packages/authoring-core/src/mesh-generation.ts`
- `packages/authoring-core/src/mesh-quality-metrics.ts`
- `packages/authoring-core/src/mesh-generation.test.ts`
- `packages/authoring-core/src/index.ts`
- `packages/operation-core/src/operations/generate-mesh.ts`
- `packages/operation-core/src/payloads/model-edit.ts`
- `packages/operation-core/src/operations/generate-mesh.test.ts`

Basis documents reviewed:

- `discussion/implementation/orchestration/wave68-plan.md`
- `discussion/implementation/waves/wave68/wave68-domain-a-v6-shared-contract-dependency-gate-method-surface-report.md`
- `discussion/design/mesh-generation/auto-outline-v6-alpha-constrained-delaunay.md`
- `discussion/design/mesh-generation/_map.md`
- `discussion/implementation/waves/wave68-preplan-mesh-generation-replacement-inventory.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/operation-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`
- `discussion/development_convention/ux-backed-package-logic-authority.md`

Out of Domain B attribution:

- Dirty `apps/editor/**` changes are classified as unrelated/pre-existing for this lane.
- Dirty old algorithm files such as `mesh-outline-v2-6-soft-apron-generation.ts` and `mesh-outline-v4-contour-band-generation.ts` are classified as unrelated/pre-existing for this lane.
- Dependency manifest, lockfile, and registry changes are Domain A dependency-gate artifacts, not Domain B v6a implementation work.

## Findings

No blocking or non-blocking design/development findings.

## Policy Checklist

| Area | Result | Evidence |
|---|---|---|
| Architecture / module boundary | Pass | v6a implementation is isolated in `mesh-generation-v6a-local.ts`; `mesh-generation.ts` routes `auto-outline-v6a-local` to that helper and keeps v6b/v6c deferred fallback routing. |
| Source organization | Pass | `index.ts` remains barrel exports only. New v6a file has a clear single responsibility: dependency-free local v6a mesh generation. |
| Operation boundary | Pass | operation-core imports authoring-core public APIs and formats provenance only; no v6a geometry implementation is added to operation-core. |
| Dependency policy | Pass | v6a source imports no v6b/v6c external triangulation libraries. Domain A dependency entries are present and guarded, but v6a does not use them. |
| Determinism / DTO validity | Pass | v6a uses deterministic scans, sorted selection, stable vertex/triangle ids, triangle filtering, `topologyRevision: 0`, aligned vertices/UVs/stable IDs, and tests assert deterministic equality plus valid triangle indices. |
| v6 firebreak | Pass | `mesh-generation-v6a-local.ts` imports only contracts, v6 contract metadata, and metrics. Static searches found no old V1-V5/grid/envelope/apron/contour-band/recursive-ring implementation imports or forbidden library imports in v6a. |
| Scope / forbidden paths | Pass | Domain B implementation does not require `apps/editor/**`, render packages, old algorithm files, manifests, lockfile, or dependency registry changes. Existing dirty changes in those areas remain classified outside this domain. |
| Claims hygiene | Pass | v6a reports `v6a-local-earclip-steiner-approximation` and `limitation-not-full-constrained-delaunay`; no Cubism, pixel-perfect, or true CDT success claim was found. |

## Source Review Notes

- `packages/authoring-core/src/mesh-generation-v6a-local.ts` builds a soft alpha mask, selects the main component, traces/samples boundary points, samples deterministic interior points, triangulates with an earclip plus Steiner-style split approximation, filters duplicate/degenerate/outside triangles, and returns explicit blocked status for invalid bytes, empty alpha, insufficient boundary, or empty triangulation.
- Successful v6a output records `outputKind: "backend-output"`, v6 method/source/backend ids, counts, removed/outside triangle counts, multi-island and hole handling status, and provenance limitation strings.
- v6a hole-like fixtures are reported through `holeHandling: "unsupported-fallback"` and provenance rather than claiming full hole support.
- `packages/authoring-core/src/mesh-generation.ts` keeps `auto-outline-v6a-local` as an explicit sidecar route and sends missing bytes or v6a generation failure to visible `bounds-grid` fallback metadata.
- `packages/operation-core/src/operations/generate-mesh.ts` accepts v6 preview commits through the shared authoring-core allowlist and serializes v6 quality metrics into transform history. This is consistent with existing operation provenance behavior.

## Verification Performed

Reviewer-run checks:

| Command / check | Result |
|---|---|
| `node scripts/check-source-organization.mjs` | Pass |
| `node scripts/check-dependencies.mjs` | Pass |
| `git diff --check -- <tracked Domain B-related files>` | Pass; CRLF warnings only |
| Static search for v6a imports of old algorithm files and v6b/v6c libraries | Pass; no forbidden v6a imports found |
| Static search for Cubism / pixel-perfect / true constrained-Delaunay success claims in Domain B-relevant source/tests | Pass; only v6 algorithm id and explicit limitation strings found |

Parent-confirmed verification used as current execution evidence:

| Command / check | Parent-confirmed result |
|---|---|
| Focused authoring/operation Vitest | Pass after expected Windows sandbox `esbuild spawn EPERM` escalated rerun; 2 files / 55 tests |
| `pnpm.cmd typecheck` | Pass |
| `node scripts/check-source-organization.mjs` | Pass |
| `node scripts/check-dependencies.mjs` | Pass |
| tracked Domain B `git diff --check` | Pass; CRLF warnings only |
| no-index new-file whitespace checks | LF/CRLF warnings only |

## Residual Risks

- v6a is an approximation, not a true constrained Delaunay implementation. This is acceptable for Domain B because the implementation and tests label it as `v6a-local-earclip-steiner-approximation` and include `limitation-not-full-constrained-delaunay`.
- v6a handles multiple islands as main-island-only and hole-like regions as unsupported/limited metadata. That is acceptable for this v0 sidecar, but it remains a quality comparison risk for later backend selection.
- `mesh-generation-v6a-local.ts` is cohesive but large. If later waves share contour extraction, sampling, or validation across v6b/v6c, splitting reusable v6 pipeline steps into named responsibility files should be considered.
- The worktree contains unrelated dirty Editor, old algorithm, dependency, and Domain A artifacts. This review did not validate those unrelated changes.

## User-Decision Points

None for Domain B design/development compliance.

Domain B is ready for the companion review lanes and later integration review under the Wave68 plan.
