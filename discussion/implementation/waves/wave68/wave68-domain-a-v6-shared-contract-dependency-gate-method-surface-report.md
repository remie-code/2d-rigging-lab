# Wave68 Domain A Report: V6 Shared Contract / Dependency Gate / Method Surface

- Status: complete / pass
- Wave: `mesh-generation-quality-foundation-v6-sidecar-candidates`
- Domain: `wave68-v6-shared-contract-dependency-gate-method-surface`
- Date: 2026-06-14
- Owner: Orch-Sylph
- Implementation agents:
  - Gnome `019ec411-fabb-7731-a0f5-05bf2fc71581` for Domain A source implementation.
  - Gnome `019ec42e-8b89-7182-8b74-ef56dc3051df` for dependency registry fix loop 2.

## Verdict

`pass`

Domain A source implementation and tests are complete. Spec Compliance passed, Test Adequacy passed, and Design / Development Compliance passed after Undine authorized a scoped update to `generated/dependencies/dependency-registry.json` for the Wave68 direct and observed transitive dependencies.

## Residual Work Classification

### Continued Domain A remnants

These files matched the previous partial Domain A implementation and were continued:

- `packages/authoring-core/package.json`
- `pnpm-lock.yaml`
- `packages/authoring-core/src/index.ts`
- `packages/authoring-core/src/mesh-generation.ts`
- `packages/authoring-core/src/mesh-generation.test.ts`
- `packages/authoring-core/src/mesh-quality-metrics.ts`
- `packages/authoring-core/src/mesh-generation-contract.ts`
- `packages/authoring-core/src/mesh-generation-v6-fixtures.ts`
- `packages/operation-core/src/payloads/model-edit.ts`
- `packages/operation-core/src/operations/generate-mesh.ts`
- `packages/operation-core/src/operations/generate-mesh.test.ts`

### User package install / dependency state

The user reported running `pnpm install` after the dependency manifest update. Orch-Sylph and Gnome treated the five Wave68 candidate packages as installed and did not run `pnpm install`.

Observed installed packages under `node_modules/.pnpm`:

- `@kninnug/constrainautor@4.1.0`
- `d3-contour@4.0.2`
- `delaunator@5.1.0`
- `poly2tri@1.5.0`
- `simplify-js@1.2.4`

### Preserved unrelated / pre-existing changes

The following dirty worktree areas were classified as unrelated to Domain A and preserved:

- `apps/editor/**` changes, including E2E/canvas/Mesh Tool files.
- `discussion/design/mesh-generation/_map.md`, v4/v5 design drafts, and implementation maps outside Wave68 Domain A closeout.
- `packages/authoring-core/src/mesh-outline-v2-6-soft-apron-generation.ts`.
- `packages/authoring-core/src/mesh-outline-v4-contour-band-generation.ts`.
- `tmp/**` logs.

Domain A did not edit `apps/editor/**`, `packages/render-core/**`, `packages/render-webgl2/**`, or `packages/package-format/**`.

### Conflicts resolved

The partial Domain A code still described v6b/v6c as dependency-gated or not-added even though the user-installed package state showed those packages present. Gnome separated these concepts:

- `dependencyGateStatus`: `not-required` for v6a, `available` for v6b/v6c.
- `backendImplementationStatus`: `deferred` for all three candidates.
- fallback reason for generated v6 candidate calls while backends are deferred: `v6-backend-not-implemented`.

## Implementation Summary

Domain A now establishes:

- v6 candidate method ids:
  - `auto-outline-v6a-local`
  - `auto-outline-v6b-constrainautor`
  - `auto-outline-v6c-poly2tri`
- v6 candidate source ids:
  - `outline-v6a-local-rgba`
  - `outline-v6b-constrainautor-rgba`
  - `outline-v6c-poly2tri-rgba`
- shared candidate metadata for backend id, dependency gate status, dependency package ids, and backend implementation status.
- shared v6 fixture helpers for:
  - `v6-simple-rectangle`
  - `v6-curved-blob`
  - `v6-thin-tapered`
  - `v6-hole-like`
  - `v6-empty-alpha-fallback`
- shared `MeshGenerationV6Metrics` fallback/quality metadata.
- operation payload method allowlist synchronization through `MESH_GENERATION_METHOD_IDS`.
- previewMesh commit allowlist synchronization through `isGeneratedMeshPreviewCommitMethod`.
- operation transform-history formatting for shared v6 metadata.

Domain A intentionally does not implement v6a/v6b/v6c backend geometry. Each v6 candidate currently returns a valid explicit fallback/blocker result with metadata that does not claim backend success.

## Dependency Decision And Due Diligence

The Wave68 plan required dependency decision and due-diligence notes in this Domain A report. This section is the durable Wave68 Domain A dependency decision record.

### Direct dependencies

| Dependency | Version | Purpose | License | Scope | Domain A decision |
|---|---:|---|---|---|---|
| `@kninnug/constrainautor` | `4.1.0` | Constraint recovery candidate for v6b with Delaunator. | ISC | `runtime:packages/authoring-core:v6-candidate-backend` | Available for Domain C implementation; not imported by Domain A production code. |
| `d3-contour` | `4.0.2` | Marching-squares contour extraction candidate for shared v6 pipeline. | ISC | `runtime:packages/authoring-core:v6-candidate-backend` | Available for Domains B/C/D implementation; not imported by Domain A production code. |
| `delaunator` | `5.1.0` | Delaunay triangulation candidate for v6b. | ISC | `runtime:packages/authoring-core:v6-candidate-backend` | Available for Domain C implementation; not imported by Domain A production code. |
| `poly2tri` | `1.5.0` | Constrained polygon triangulation candidate for v6c. | BSD-3-Clause | `runtime:packages/authoring-core:v6-candidate-backend` | Available for Domain D implementation; not imported by Domain A production code. |
| `simplify-js` | `1.2.4` | Contour simplification candidate for shared v6 pipeline. | BSD-2-Clause | `runtime:packages/authoring-core:v6-candidate-backend` | Available for Domains B/C/D implementation; not imported by Domain A production code. |

### Transitive dependency notes

| Transitive dependency | Via | License | Note |
|---|---|---|---|
| `robust-predicates@3.0.3` | `@kninnug/constrainautor`, `delaunator` | Unlicense | Geometry predicate package; no binary or Cubism/proprietary dependency observed. |
| `d3-array@3.2.4` | `d3-contour` | ISC | ESM package. |
| `internmap@2.0.3` | `d3-array` | ISC | ESM package. |

### Lockfile and install evidence

- `packages/authoring-core/package.json` includes exactly the five listed Wave68 dependencies.
- `pnpm-lock.yaml` includes those five package entries and transitive entries.
- The user preinstalled the packages before this restart.
- `node_modules/.pnpm` metadata was read for each direct package and transitive package listed above.
- `node scripts/check-dependencies.mjs` passed.

### Dependency policy interpretation

No Cubism SDK/Core, proprietary parser, unlicensed binary, model pack, or forbidden Cubism compatibility dependency was introduced. The current automated dependency guard passed.

Fix Loop 2 resolved the remaining registry governance issue. Undine explicitly authorized a narrowly scoped update to `generated/dependencies/dependency-registry.json`; the registry now records the five direct Wave68 dependencies and the three observed transitive dependencies listed above.

Registry verification after Fix Loop 2:

| Command | Result |
|---|---|
| `node -e "JSON.parse(require('fs').readFileSync('generated/dependencies/dependency-registry.json','utf8')); console.log('json-parse-ok')"` | pass |
| `node scripts/check-dependencies.mjs` | pass |
| `git diff --check -- generated/dependencies/dependency-registry.json` | pass, LF/CRLF warning only |

## Mesh Generation Contract Trace

```text
OperationRequestSchema.parse
  -> accepts shared MESH_GENERATION_METHOD_IDS
generateMeshOperationHandler
  -> accepts preview/apply for isGeneratedMeshPreviewCommitMethod
createGeneratedMeshForDrawable
  -> routes v6 method ids to deferred v6 fallback result
deferred v6 result
  -> returns valid mesh DTO or explicit blocked fallback
  -> records requested source, actual source, backend id, dependency status,
     backend implementation status, fallback reason, fallback steps, and counts
operation provenance
  -> records v6 metrics and backend-specific diagnostic placeholders
```

## Review Lanes

| Lane | Initial verdict | Finding summary | Resolution status |
|---|---|---|---|
| Spec Compliance Review | Initial `needs_changes`, final `pass` | Required Domain A report and dependency/user-installed package note were missing. | Addressed by this report; re-review passed. |
| Design / Development Compliance Review | Initial `needs_changes`, Fix Loop 1 `escalate`, final `pass` | Dependency registry evidence missing; current dirty worktree includes unrelated Editor and old-algorithm changes. | Dirty-worktree classification accepted; registry updated in Fix Loop 2; re-review passed. |
| Test Adequacy Review | `pass` | No blocking findings. | No fix required. |

## Verification

Gnome reported:

| Command | Result |
|---|---|
| `pnpm.cmd exec vitest run packages/authoring-core/src/mesh-generation.test.ts packages/operation-core/src/operations/generate-mesh.test.ts --reporter=dot` | Initial sandbox Vitest hit Windows `esbuild spawn EPERM`; approved rerun passed, 2 files / 53 tests. |
| `pnpm.cmd typecheck` | pass |
| `node scripts/check-source-organization.mjs` | pass |
| `node scripts/check-dependencies.mjs` | pass |
| `git diff --check -- <Domain A files>` | pass, LF/CRLF warnings only |

Review-Sylph lanes independently reran or confirmed:

| Lane | Verification |
|---|---|
| Spec Compliance Review | focused Vitest approved rerun passed, typecheck passed, dependency guard passed, scoped diff check passed. |
| Design / Development Compliance Review | focused Vitest approved rerun passed, source organization guard passed, dependency guard passed, scoped diff check passed. |
| Test Adequacy Review | focused authoring/operation Vitest approved rerun passed, focused Editor default test passed, typecheck passed, dependency guard passed, source organization guard passed, scoped diff check passed. |

Fix Loop 2 verification:

| Command | Result |
|---|---|
| `node -e "JSON.parse(require('fs').readFileSync('generated/dependencies/dependency-registry.json','utf8')); console.log('json-parse-ok')"` | pass |
| `node scripts/check-dependencies.mjs` | pass |
| `git diff --check -- generated/dependencies/dependency-registry.json` | pass, LF/CRLF warning only |

## Must-Not Compliance

- Current default remains `auto-outline-v2.6-soft-apron`.
- v6 is not default and no backend selector is presented as final product UX in Domain A.
- Domain A did not implement v6a/v6b/v6c backend algorithms.
- Old V1-V5/grid/envelope/apron/contour-band/recursive-ring implementations were not used as v6 algorithm basis.
- Old mesh-generation code was read only for routing seams, public DTO/fallback contracts, operation allowlists, preview/apply behavior, and negative-history context.
- No dependencies beyond the five Wave68 candidate packages were added.
- No Cubism SDK/Core, model parser, proprietary runtime, or Cubism compatibility claim was added.
- No `apps/editor/**`, `packages/render-core/**`, or `packages/render-webgl2/**` edits were made by Domain A.

## Deferred Items

Deferred by plan:

- v6a local backend implementation: Domain B.
- v6b `delaunator + @kninnug/constrainautor` backend implementation and real import/runtime behavior: Domain C.
- v6c `poly2tri` backend implementation and real import/runtime behavior: Domain D.
- Editor temporary backend selector and preview provenance UI: Domain E.
- final backend selection and any default switch: out of scope for Wave68 Domain A.

## Residual Risk

- Contract risk: low after focused tests/typecheck.
- Dependency governance risk: low. Licenses and package metadata are recorded here, the machine-readable dependency registry is synchronized for direct and observed transitive Wave68 dependencies, and dependency guard checks pass.
- Future backend risk: medium. Domains C/D must verify actual package imports, browser/Vite behavior, deterministic triangulation, and boundary preservation before claiming backend success.
- Dirty worktree risk: medium. Unrelated Editor and old mesh algorithm changes remain present and must not be attributed to Domain A.

## Final Notes For Undine

No user decision is needed for Domain A source behavior. The source/test surface and dependency registry evidence are ready for Wave68 Domains B/C/D to start under Undine's dependency graph, subject to the wave plan's normal batching.
