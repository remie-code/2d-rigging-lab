# Wave68 Domain C Design / Development Compliance Review

- Verdict: `pass`
- Wave: `mesh-generation-quality-foundation-v6-sidecar-candidates`
- Domain: `wave68-mesh-auto-outline-v6b-constrainautor-sidecar`
- Review lane: Design / Development Compliance
- Date: 2026-06-14
- Reviewer: Review-Sylph

## Scope Reviewed

Basis documents reviewed:

- `discussion/implementation/orchestration/wave68-plan.md`
- `discussion/implementation/waves/wave68/wave68-domain-a-v6-shared-contract-dependency-gate-method-surface-report.md`
- `discussion/implementation/waves/wave68/wave68-domain-b-mesh-auto-outline-v6a-local-sidecar-report.md`
- `discussion/design/mesh-generation/auto-outline-v6-alpha-constrained-delaunay.md`
- `discussion/design/mesh-generation/auto-outline-v6b-constrainautor.md`
- `discussion/design/mesh-generation/auto-outline-v6-library-candidate-inventory.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/operation-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`

Source and tests reviewed:

- `packages/authoring-core/src/mesh-generation-v6b-constrainautor.ts`
- `packages/authoring-core/src/mesh-generation-v6b-constrainautor-runtime.js`
- `packages/authoring-core/src/mesh-generation-v6b-constrainautor-runtime.d.ts`
- `packages/authoring-core/src/mesh-generation.ts`
- `packages/authoring-core/src/mesh-generation-contract.ts`
- `packages/authoring-core/src/mesh-quality-metrics.ts`
- `packages/authoring-core/src/mesh-generation.test.ts`
- `packages/authoring-core/src/mesh-generation-v6-fixtures.ts`
- `packages/operation-core/src/operations/generate-mesh.ts`
- `packages/operation-core/src/operations/generate-mesh.test.ts`
- `packages/operation-core/src/payloads/model-edit.ts`
- Local dependency metadata for `delaunator@5.1.0` and `@kninnug/constrainautor@4.1.0`.

No Domain C implementation summary artifact was present under `discussion/implementation/waves/wave68/` at review time, so this review is based on the basis documents, source, tests, dependency metadata, and parent verification record.

## Findings

No blocking or needs-change findings.

### Observation: Browser/Vite Import Evidence Is Indirect

Severity: `residual-risk`

The v6b runtime path is TypeScript/Vitest exercised through `packages/authoring-core/src/mesh-generation-v6b-constrainautor.ts:3` and `packages/authoring-core/src/mesh-generation-v6b-constrainautor.ts:13`, and the local shim is intentionally thin at `packages/authoring-core/src/mesh-generation-v6b-constrainautor-runtime.js:1`. Package metadata supports an ESM/browser-oriented path: `delaunator` declares `"type": "module"` and types at `node_modules/.pnpm/delaunator@5.1.0/node_modules/delaunator/package.json:5-13`; `@kninnug/constrainautor` declares an ESM export at `node_modules/.pnpm/@kninnug+constrainautor@4.1.0/node_modules/@kninnug/constrainautor/package.json:7-19`, and its README documents ES module/browser use plus input restrictions at `node_modules/.pnpm/@kninnug+constrainautor@4.1.0/node_modules/@kninnug/constrainautor/README.md:40-76`.

Parent verification did not include a Vite build. I do not treat this as blocking for this lane because the package metadata, TypeScript pass, and focused Vitest runtime pass are consistent with the approved dependency scope. Final integration or Domain E should still treat browser bundling as open verification before claiming Editor-side import behavior is fully proven.

### Observation: v6b Backend File Is Large But Cohesive

Severity: `residual-risk`

`packages/authoring-core/src/mesh-generation-v6b-constrainautor.ts` is a large backend-owned file, but its responsibilities are cohesive for this sidecar: v6b mask/context creation, boundary/interior sampling, Delaunator/Constrainautor recovery, cleanup, fallback mesh creation, diagnostics, and deterministic helpers. `packages/authoring-core/src/index.ts:1-45` remains barrel-only, and parent verification reports `node scripts/check-source-organization.mjs` passed. Future shared-v6 pipeline extraction may reduce Domain C/D churn, but the current layout does not violate the accepted source organization policy.

## Dependency Import / Runtime Behavior Assessment

Pass.

- `packages/authoring-core/package.json:13-17` contains the Wave68 dependencies that Domain A approved and registered.
- v6b production imports are limited to `delaunator` and the local Constrainautor shim at `packages/authoring-core/src/mesh-generation-v6b-constrainautor.ts:3` and `packages/authoring-core/src/mesh-generation-v6b-constrainautor.ts:13`.
- The local shim re-exports `@kninnug/constrainautor` at `packages/authoring-core/src/mesh-generation-v6b-constrainautor-runtime.js:1`; the paired declaration file narrows the used runtime surface at `packages/authoring-core/src/mesh-generation-v6b-constrainautor-runtime.d.ts:1-15`.
- The registry entries for `@kninnug/constrainautor`, `delaunator`, and `robust-predicates` classify the usage as Wave68 authoring-core runtime scope in `generated/dependencies/dependency-registry.json:44-65` and `generated/dependencies/dependency-registry.json:84-89`.
- No Cubism SDK/Core, proprietary parser, model parser, binary runtime, or forbidden asset dependency is imported by the v6b source. Static search of the Domain C source for Cubism/Live2D format/runtime terms returned no matches.

The runtime shim is acceptable for this domain: it does not hide an unapproved dependency, it exists to keep the import path and local type surface stable, and it delegates directly to the approved package.

## Source Organization Assessment

Pass.

- New v6b behavior lives in a named backend file rather than `index.ts`.
- `packages/authoring-core/src/mesh-generation-v6b-constrainautor-runtime.js` and `.d.ts` are small import/type shims, not broad utility files.
- `packages/authoring-core/src/mesh-generation.ts:122-150` keeps the routing seam explicit for v6a/v6b/v6c without moving backend algorithm logic into the router.
- `packages/authoring-core/src/mesh-generation-contract.ts:7-17` and `packages/authoring-core/src/mesh-quality-metrics.ts:143-179` own contract/metrics definitions, not runtime algorithms.

## Operation Policy Assessment

Pass.

- The mutating path remains `generateMeshOperationHandler` at `packages/operation-core/src/operations/generate-mesh.ts:34-44`.
- Operation payload method validation uses the shared `MESH_GENERATION_METHOD_IDS` enum at `packages/operation-core/src/payloads/model-edit.ts:151-155`, so v6b is not maintained in a separate operation-only allowlist.
- The authoring route selects v6b only for `auto-outline-v6b-constrainautor` at `packages/authoring-core/src/mesh-generation.ts:133-140`.
- v6b operation provenance records method/source/fallback/quality diagnostics through `packages/operation-core/src/operations/generate-mesh.ts:300-327` and v6b-specific Constrainautor metrics through `packages/operation-core/src/operations/generate-mesh.ts:516-534`.
- Operation tests assert v6b commit provenance, source id, implementation status, and constraint diagnostics at `packages/operation-core/src/operations/generate-mesh.test.ts:520-555`.

No unsupported mutation behavior or direct package mutation path was introduced.

## Schema / ID Convention Assessment

Pass.

- Method/source/backend ids are machine-readable and stable at `packages/authoring-core/src/mesh-generation-contract.ts:7-17` and `packages/authoring-core/src/mesh-generation-contract.ts:61-67`.
- v6b fallback reasons are stable no-space ids at `packages/authoring-core/src/mesh-generation-contract.ts:121-128`.
- Generated stable ids derive from contract-valid drawable ids and deterministic indices at `packages/authoring-core/src/mesh-generation-v6b-constrainautor.ts:249-261` and fallback ids at `packages/authoring-core/src/mesh-generation-v6b-constrainautor.ts:1129-1228`.
- DTO invariant tests check stable id formats and triangle/vertex cardinality at `packages/authoring-core/src/mesh-generation.test.ts:1888-1945`.

## Algorithm Firebreak Assessment

Pass.

The v6b source imports only DTO/contracts, `delaunator`, the local Constrainautor runtime shim, v6 candidate contract helpers, and quality metrics. It does not import old mesh outline implementations. Static search of the v6b source and runtime shim for `auto-outline-v1` through `auto-outline-v5`, `soft-apron`, `soft-boundary`, `contour-band`, `envelope`, `recursive`, `apron`, `ring`, or `grid` as old-algorithm markers returned no matches.

The implementation follows the v6/v6b design boundary:

- Builds soft alpha and main-island context at `packages/authoring-core/src/mesh-generation-v6b-constrainautor.ts:393-470`.
- Samples boundary/interior points deterministically at `packages/authoring-core/src/mesh-generation-v6b-constrainautor.ts:982-1110`.
- Runs Delaunator and Constrainautor at `packages/authoring-core/src/mesh-generation-v6b-constrainautor.ts:324-346`.
- Verifies recovered constraints before success at `packages/authoring-core/src/mesh-generation-v6b-constrainautor.ts:362-381` and again after triangle filtering at `packages/authoring-core/src/mesh-generation-v6b-constrainautor.ts:204-247`.

Fallback mesh generation is visibly marked as fallback output and does not claim v6b backend success.

## Failure Semantics Assessment

Pass.

- Missing or invalid byte dimensions block as `v6b-constrainautor-generation-failed` at `packages/authoring-core/src/mesh-generation-v6b-constrainautor.ts:398-402`.
- Empty alpha blocks as `alpha-empty` at `packages/authoring-core/src/mesh-generation-v6b-constrainautor.ts:404-407`.
- Hole-like regions produce visible fallback with `v6b-unsupported-hole-region`, missing-constraint diagnostics, and fallback provenance at `packages/authoring-core/src/mesh-generation-v6b-constrainautor.ts:158-172`.
- Duplicate, zero-length, crossing, or point-intersecting constraints fail pre-triangulation at `packages/authoring-core/src/mesh-generation-v6b-constrainautor.ts:555-607`.
- Backend throws are caught and surfaced as `v6b-backend-threw` with `thrownErrorKind` at `packages/authoring-core/src/mesh-generation-v6b-constrainautor.ts:324-360`.
- Missing constraints after recovery fail at `packages/authoring-core/src/mesh-generation-v6b-constrainautor.ts:362-381`.
- Missing constraints after final mask filtering fail at `packages/authoring-core/src/mesh-generation-v6b-constrainautor.ts:218-247`.
- Visible fallback records `source: "alpha-aware-rgba"`, `outputKind: "fallback-output"`, and actual fallback reason at `packages/authoring-core/src/mesh-generation-v6b-constrainautor.ts:472-540`.

This satisfies the requirement that unconstrained Delaunay output, missing constraints, holes, invalid constraints, throws, and missing alpha do not masquerade as successful constrained v6b backend output.

## Determinism And DTO Invariant Assessment

Pass.

- Point ordering and deduplication are deterministic at `packages/authoring-core/src/mesh-generation-v6b-constrainautor.ts:571-594`.
- Boundary loops and samples are normalized and stable-started at `packages/authoring-core/src/mesh-generation-v6b-constrainautor.ts:920-1013`.
- Interior points are sorted deterministically at `packages/authoring-core/src/mesh-generation-v6b-constrainautor.ts:1068-1110`.
- Coordinates are rounded through a stable precision at `packages/authoring-core/src/mesh-generation-v6b-constrainautor.ts:1871-1888`.
- Successful output preserves mesh id, drawable id, vertices, uvs, triangles, stable ids, topology revision, bounds, and provenance at `packages/authoring-core/src/mesh-generation-v6b-constrainautor.ts:249-265`.
- Tests assert repeated-run equality, DTO invariants, alpha bounds, source id, no fallback on success, and preserved constraints for simple/curved fixtures at `packages/authoring-core/src/mesh-generation.test.ts:1253-1319`.
- Tests assert visible fallback for hole-like fixtures and invalid constraints at `packages/authoring-core/src/mesh-generation.test.ts:1322-1422`.
- Tests assert missing alpha/bytes do not claim backend output at `packages/authoring-core/src/mesh-generation.test.ts:1657-1737`.

## Shared-File Churn / Domain D Collision Risk

Pass with residual integration risk.

Current shared files include parallel v6c changes:

- `packages/authoring-core/src/mesh-generation.ts:16-21` imports v6a, v6b, and v6c backends.
- `packages/authoring-core/src/mesh-generation.ts:122-150` routes each v6 method through separate method-id branches.
- `packages/authoring-core/src/mesh-generation-contract.ts:51-76` marks v6a/v6b/v6c candidates as implemented in the current shared tree.
- `packages/authoring-core/src/mesh-quality-metrics.ts:171-192` contains both v6b and v6c diagnostic shapes.

I found no v6b dependence on the v6c implementation file and no method/source id collision. Integration should still review the shared files after Domain D completes because Domain C and D intentionally touch the same router, contract, metrics, and tests.

## Verification Considered

Parent/Orch-Sylph verification considered:

- `pnpm.cmd typecheck`: pass.
- Focused Vitest for `packages/authoring-core/src/mesh-generation.test.ts` and `packages/operation-core/src/operations/generate-mesh.test.ts`: initial sandbox `esbuild spawn EPERM`, escalated rerun pass, 2 files / 61 tests.
- `node scripts/check-source-organization.mjs`: pass.
- `node scripts/check-dependencies.mjs`: pass.
- `git diff --check` on tracked Domain C-touched files: pass, LF/CRLF warnings only.
- `git diff --no-index --check` on new v6b files and untracked contract file: no whitespace diagnostics, LF/CRLF warnings only; nonzero no-index exit expected because files differ from `NUL`.

I did not run additional commands that would write build artifacts. Local read/static checks were used for this review.

## Fix Loop 1 Delta Re-review

- Final verdict after Fix Loop 1: `pass`
- Delta reviewed:
  - `packages/authoring-core/src/mesh-generation-v6b-constrainautor.ts`
  - `packages/authoring-core/src/mesh-generation.test.ts`
  - `discussion/implementation/waves/wave68/wave68-domain-c-mesh-auto-outline-v6b-constrainautor-sidecar-report.md`
  - `discussion/implementation/waves/wave68/_map.md`
  - `discussion/implementation/reviews/wave68/_map.md`
- Delta findings: no blocking or needs-change findings.

Resolution status:

- Source organization remains acceptable. The v6b file grew to include retry attempts and a narrow test probe, but the file still owns one backend responsibility. The package barrel still does not re-export the v6b backend or probe; `packages/authoring-core/src/index.ts:25-34` remains re-export-only for shared mesh-generation surfaces.
- Dependency policy is unchanged. The delta did not add manifest, lockfile, registry, or new import scope changes. v6b still imports only `delaunator` and the local Constrainautor runtime shim.
- Operation policy is unchanged. The retry sequence is internal to `createAutoOutlineV6BConstrainautorMesh`; operation routing/provenance remains through the existing generateMesh gateway.
- Schema/id conventions remain satisfied. New retry provenance ids, `v6b-retry-coarser-boundary` and `v6b-retry-fewer-interior-points`, are stable no-space machine-readable ids at `packages/authoring-core/src/mesh-generation-v6b-constrainautor.ts:84-86`.
- Firebreak remains intact. Static search of the v6b source after Fix Loop 1 found no old v1-v5/grid/envelope/apron/contour-band/recursive-ring algorithm references and no Cubism/Live2D forbidden format/runtime references.
- Failure semantics did not regress. Retry attempts are sequenced at `packages/authoring-core/src/mesh-generation-v6b-constrainautor.ts:220-256`; each attempt still uses the same recovery, mask filtering, and post-filter constraint verification at `packages/authoring-core/src/mesh-generation-v6b-constrainautor.ts:604-657`. Backend success still records `outputKind: "backend-output"` only after verified constraints at `packages/authoring-core/src/mesh-generation-v6b-constrainautor.ts:280-306`; all-attempt failure remains visible fallback.
- Determinism/DTO coverage improved. Added tests cover thin-tapered deterministic success/fallback behavior at `packages/authoring-core/src/mesh-generation.test.ts:1329-1392`, near-collinear and near-duplicate constraints at `packages/authoring-core/src/mesh-generation.test.ts:1496-1565`, retry success/fallback provenance at `packages/authoring-core/src/mesh-generation.test.ts:1567-1665`, multi-island main-island-only behavior at `packages/authoring-core/src/mesh-generation.test.ts:1667-1723`, and direct v6b empty-alpha blocked fallback at `packages/authoring-core/src/mesh-generation.test.ts:2140-2164`.
- Domain D collision risk did not increase for this lane. The v6b source still contains no v6c/poly2tri dependency. Shared router/contract/metrics remain final-integration review areas because Domain C and Domain D intentionally touch the same shared surfaces.

Verification considered after Fix Loop 1:

- Focused Vitest for `packages/authoring-core/src/mesh-generation.test.ts` and `packages/operation-core/src/operations/generate-mesh.test.ts`: initial sandbox `esbuild spawn EPERM`, escalated rerun pass, 2 files / 69 tests.
- `pnpm.cmd typecheck`: pass.
- `node scripts/check-source-organization.mjs`: pass.
- `node scripts/check-dependencies.mjs`: pass.
- Scoped `git diff --check`: pass, LF/CRLF warnings only.
- no-index `git diff --check` on new v6b/shim/contract files: no whitespace diagnostics; expected nonzero due diff from `NUL` and LF/CRLF warnings only.
- `pnpm.cmd build`: root script unavailable (`Command "build" not found`), so browser/app build proof remains a Domain E or final-integration residual.

Residual risks and user-decision points after Fix Loop 1:

- Browser/Vite bundling remains unproven by Domain C verification because the root package has no `build` script. Keep this as Domain E/final integration residual, not a Domain C design/development blocker.
- Full hole triangulation and full multi-island merge remain v6b v0 limitations, visibly represented through fallback or main-island-only metadata.
- No new user-decision point is introduced by Fix Loop 1.

## Residual Risks

- Browser/Vite bundling is not fully proven by the parent verification set. Package metadata and the runtime shim are favorable, but final integration or Domain E should verify the Editor build/import path before treating v6b as browser-bundle proven.
- The v6b backend is a v0 comparison sidecar. It visibly falls back for hole-like regions and reports main-island-only handling for multi-island inputs; this is acceptable for Wave68 comparison but not a final quality claim.
- The large v6b backend file is cohesive today, but shared v6 pipeline duplication/churn across v6a/v6b/v6c should be revisited after backend selection.

## User-Decision Points

None for Domain C Design / Development Compliance.

Later user/product decisions remain outside this lane:

- whether v6a, v6b, v6c, or another backend becomes the final v6 path;
- whether/when to remove or hide the temporary backend selector;
- whether to promote browser/Vite build verification to a required Domain C/D gate rather than final integration evidence.

## Artifact

Review artifact written:

- `discussion/implementation/reviews/wave68/wave68-domain-c-design-development-review.md`
