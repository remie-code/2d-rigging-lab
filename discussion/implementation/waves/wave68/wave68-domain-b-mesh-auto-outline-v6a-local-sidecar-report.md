# Wave68 Domain B Report: Mesh Auto Outline V6A Local Sidecar

- Status: complete / pass
- Wave: `mesh-generation-quality-foundation-v6-sidecar-candidates`
- Domain: `wave68-mesh-auto-outline-v6a-local-sidecar`
- Date: 2026-06-14
- Owner: Orch-Sylph
- Implementation agent: Gnome `019ec437-08e8-7b61-90c2-b92e4e26263c`
- Review agents:
  - Spec Compliance Review: Review-Sylph `019ec449-2872-72f2-ac47-4468aa4dbe61`
  - Design / Development Compliance Review: Review-Sylph `019ec449-9a26-77c1-bd1e-36564a055779`
  - Test Adequacy Review: Review-Sylph `019ec44a-1bd2-7f10-a450-24cefc0b98c2`

## Verdict

`pass`

Domain B implements `auto-outline-v6a-local` as a dependency-free local v6 sidecar backend. It now produces deterministic non-deferred meshes for representative non-empty alpha fixtures, while empty or missing alpha returns explicit blocked fallback metadata. v6b and v6c remain deferred for later domains.

Test Adequacy initially returned `needs_changes` because the v6a representative fixture tests did not directly assert mesh bounds, provenance, target IDs, UV ranges, and successful `alphaBounds`. Fix Loop 1 added those contract-shaped assertions in `packages/authoring-core/src/mesh-generation.test.ts`; Test Adequacy re-review then passed.

## Current-State Confirmation

- Domain A was confirmed complete / pass before Domain B started.
- Domain A dependency registry escalation was already resolved in `generated/dependencies/dependency-registry.json`.
- The user reported `pnpm install` had already been run; Domain B did not run `pnpm install`.
- Pre-existing dirty worktree areas under `apps/editor/**`, old mesh algorithm files, package manifests/lockfile, dependency registry, and Domain A artifacts were preserved and not attributed to Domain B unless directly listed below.

## Scope Changed

Domain B implementation changes:

- `packages/authoring-core/src/mesh-generation-v6a-local.ts`
  - New dependency-free v6a backend.
  - Builds a soft alpha mask, selects the main island, derives and samples boundary loops, samples deterministic interior points, triangulates with an ear-clip plus interior split approximation, filters invalid/outside triangles, and emits v6 metrics.
- `packages/authoring-core/src/mesh-generation-contract.ts`
  - Marks `auto-outline-v6a-local` as `implemented`.
  - Adds `v6a-local-generation-failed` as an explicit v6 fallback reason.
- `packages/authoring-core/src/mesh-generation.ts`
  - Routes only `auto-outline-v6a-local` to the new local backend.
  - Keeps v6b/v6c on visible deferred fallback metadata.
  - Adds shared v6 blocked/deferred fallback metric helpers for the routing surface.
- `packages/authoring-core/src/mesh-quality-metrics.ts`
  - Extends v6 triangulation mode support for `v6a-local-earclip-steiner-approximation`.
  - Carries v6 metrics used by v6a and deferred v6b/v6c diagnostics.
- `packages/authoring-core/src/mesh-generation.test.ts`
  - Adds v6a deterministic representative fixture tests, density-direction tests, fallback/blocker tests, and DTO invariant assertions.
  - Fix Loop 1 extends v6a DTO invariant coverage for bounds, provenance, target IDs, UV ranges, vertex bounds, and `alphaBounds`.
- `packages/operation-core/src/operations/generate-mesh.test.ts`
  - Updates operation provenance expectations for non-deferred v6a output and deferred v6b/v6c output.
  - Confirms previewMesh commits remain accepted for v6 candidate methods.

Domain B did not change `apps/editor/**`, render packages, package manifests, lockfile, dependency registry, or old mesh algorithm implementation files.

## Implementation Summary

`auto-outline-v6a-local` now returns `outline-v6a-local-rgba` backend output for representative non-empty alpha masks. The v6a backend records:

- `backendImplementationStatus: "implemented"`
- `outputKind: "backend-output"` on successful v6a generation
- boundary and interior vertex counts
- contour loop and hole-like region counts
- removed/outside triangle counts
- `multiIslandHandling`
- `holeHandling`
- `limitation-not-full-constrained-delaunay` provenance

For missing bytes or empty alpha, v6a returns `bounds-grid` with explicit fallback/blocker metadata:

- `texture-bytes-unavailable`
- `alpha-empty`
- `outputKind: "blocked"`
- fallback steps containing `auto-outline-v6a-local`

v6b and v6c are unchanged as deferred candidates and continue to expose `v6-backend-not-implemented` fallback metadata.

## Contract Trace

```text
createGeneratedMeshForDrawable
  -> input.method === auto-outline-v6a-local
  -> createAutoOutlineV6ALocalMesh
  -> valid Mesh DTO with stable vertices/UVs/triangles/ids/bounds/provenance
  -> source outline-v6a-local-rgba
  -> MeshGenerationV6Metrics outputKind backend-output

createGeneratedMeshForDrawable
  -> input.method === auto-outline-v6b-constrainautor or auto-outline-v6c-poly2tri
  -> deferred v6 fallback result
  -> visible fallback/blocker metadata
```

## Review Lanes

| Lane | Initial verdict | Final verdict | Notes |
|---|---|---|---|
| Spec Compliance Review | `pass` | `pass` | No blocking findings. Recorded missing Domain B report as orchestration bookkeeping before this report was written. |
| Design / Development Compliance Review | `pass` | `pass` | No blocking findings. Confirmed source organization, dependency policy, operation boundary, deterministic design, and old-algorithm firebreak. |
| Test Adequacy Review | `needs_changes` | `pass` after Fix Loop 1 | Initial DTO invariant coverage gap fixed in `mesh-generation.test.ts`; re-review passed. |

Review artifacts:

- [Spec Compliance Review](../../reviews/wave68/wave68-domain-b-spec-compliance-review.md)
- [Design / Development Compliance Review](../../reviews/wave68/wave68-domain-b-design-development-review.md)
- [Test Adequacy Review](../../reviews/wave68/wave68-domain-b-test-adequacy-review.md)

## Verification

Parent / Orch-Sylph verification:

| Command | Result |
|---|---|
| `pnpm.cmd exec vitest run packages/authoring-core/src/mesh-generation.test.ts packages/operation-core/src/operations/generate-mesh.test.ts --reporter=dot` | Sandbox run hit expected Windows `esbuild spawn EPERM`; escalated rerun passed, 2 files / 55 tests. |
| `pnpm.cmd exec vitest run packages/authoring-core/src/mesh-generation.test.ts --reporter=dot` | Fix Loop 1 sandbox run hit expected Windows `esbuild spawn EPERM`; escalated rerun passed, 1 file / 32 tests. |
| `pnpm.cmd typecheck` | pass |
| `node scripts/check-source-organization.mjs` | pass |
| `node scripts/check-dependencies.mjs` | pass |
| `git diff --check -- <tracked Domain B files>` | pass, LF/CRLF warnings only |
| no-index `git diff --check` on new v6 files | no whitespace diagnostics, LF/CRLF warnings only |

Reviewer-run verification included source organization guard, dependency guard, scoped diff checks, static old-algorithm firebreak checks, and direct source/test inspection. No reviewer ran `pnpm install`.

## Must-Not Compliance

- Current default remains `auto-outline-v2.6-soft-apron`; Domain B did not switch the default to v6.
- Domain B did not add dependencies and did not import v6b/v6c libraries in v6a.
- Domain B did not edit `apps/editor/**`, render packages, old mesh algorithm implementation files, manifests, lockfile, or dependency registry.
- V1-V5/grid/envelope/apron/contour-band/recursive-ring implementations were not used as the v6a algorithm basis.
- Old mesh-generation code was used only for public DTO/routing/fallback/metrics seams.
- v6a does not claim Cubism compatibility, pixel-perfect reproduction, or true constrained Delaunay.

## Deferred Items

Deferred by plan:

- true constrained Delaunay / CDT behavior
- v6b `delaunator + @kninnug/constrainautor`
- v6c `poly2tri`
- Editor temporary backend selector and UI provenance
- final backend selection
- switching the default to v6
- full hole and multi-island support

## Residual Risk

- Algorithm quality risk: medium. v6a is an approximate local backend, not a true CDT implementation.
- Hole/multi-island risk: medium. Hole-like regions and multiple islands are surfaced through metrics/provenance, but not fully triangulated as separate constrained loops.
- Visual/editability risk: medium. Representative fixture tests verify deterministic valid DTO output and metadata, but do not prove artist-editability or visual desirability.
- Integration risk: low for Domain B package scope after focused tests, typecheck, guards, and review pass.

## User-Decision Points

None for Domain B.

Later domains or final integration should decide whether v6a, v6b, v6c, or another backend becomes the final v6 path after comparison.
