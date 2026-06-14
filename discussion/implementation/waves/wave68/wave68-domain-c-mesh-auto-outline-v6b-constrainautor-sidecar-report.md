# Wave68 Domain C Report: Mesh Auto Outline V6B Constrainautor Sidecar

- Status: complete / pass
- Wave: `mesh-generation-quality-foundation-v6-sidecar-candidates`
- Domain: `wave68-mesh-auto-outline-v6b-constrainautor-sidecar`
- Date: 2026-06-14
- Owner: Orch-Sylph
- Implementation agent: Gnome `019ec45a-dd70-7441-ba47-a6703a67cd45`
- Review agents:
  - Spec Compliance Review: Review-Sylph `019ec479-e853-76f2-a496-437d62eb3ada`
  - Design / Development Compliance Review: Review-Sylph `019ec47a-781a-7710-9561-96bc0e9e2329`
  - Test Adequacy Review: Review-Sylph `019ec47a-f542-7a70-b742-1fd890dd2ccc`

## Verdict

`pass`

Domain C implements `auto-outline-v6b-constrainautor` as the `delaunator + @kninnug/constrainautor` backend. The backend is selectable through `createGeneratedMeshForDrawable` and through operation payloads established by Domain A. Simple and curved fixtures produce deterministic backend output with preserved required boundary constraints. Failure and limitation cases are visible through fallback/blocker metadata rather than being reported as constrained success.

Initial Design / Development Compliance passed. Initial Spec Compliance and Test Adequacy returned `needs_changes`. Fix Loop 1 added v6b retry behavior and missing fixture/fallback coverage. Spec Compliance re-review passed, Test Adequacy re-review passed, and Design / Development delta re-review passed.

## Current-State Confirmation

- Domain A was confirmed complete / pass before Domain C started.
- Domain A recorded the approved and installed Wave68 dependencies, including `delaunator@5.1.0` and `@kninnug/constrainautor@4.1.0`.
- Domain B was confirmed complete / pass before Domain C started.
- The user reported `pnpm install` had already been run; Domain C did not run `pnpm install`.
- Domain D ran in parallel. Shared files currently include v6c changes; Domain C did not take ownership of v6c behavior.

## Scope Changed

Domain C implementation changes:

- `packages/authoring-core/src/mesh-generation-v6b-constrainautor.ts`
  - New v6b backend, input sanitizer, Delaunator/Constrainautor recovery, boundary-constraint verification, retry sequence, fallback mesh behavior, diagnostics, and test probe.
- `packages/authoring-core/src/mesh-generation-v6b-constrainautor-runtime.js`
  - Thin runtime ESM shim that re-exports `@kninnug/constrainautor`.
- `packages/authoring-core/src/mesh-generation-v6b-constrainautor-runtime.d.ts`
  - Local declaration for the v6b-used Constrainautor runtime surface.
- `packages/authoring-core/src/mesh-generation.ts`
  - v6b routing from deferred fallback to backend/fallback result.
- `packages/authoring-core/src/mesh-generation-contract.ts`
  - v6b implementation status and v6b fallback reasons.
- `packages/authoring-core/src/mesh-quality-metrics.ts`
  - v6b triangulation mode and Constrainautor diagnostics shape.
- `packages/authoring-core/src/mesh-generation.test.ts`
  - v6b deterministic fixture, fallback, retry, preflight, and DTO invariant tests.
- `packages/operation-core/src/operations/generate-mesh.test.ts`
  - v6b operation payload/provenance expectations.

Domain C did not edit `apps/editor/**`, render packages, old mesh algorithm implementation files, package manifests, lockfile, or generated dependency registry.

## Implementation Summary

`auto-outline-v6b-constrainautor` now follows this bounded pipeline:

```text
RGBA alpha
-> v6b soft alpha / main island context
-> deterministic boundary and interior samples
-> Delaunator.from(points)
-> @kninnug/constrainautor constraint recovery
-> required boundary-edge verification
-> triangle filtering and post-filter boundary-edge verification
-> backend mesh or visible fallback/blocker metadata
```

Recoverable recovery/final-verification failures now try:

1. initial v6b input,
2. coarser boundary sampling,
3. no-interior retry.

Retry evidence is recorded in v6 provenance with `v6b-retry-coarser-boundary` and `v6b-retry-fewer-interior-points` when those attempts are reached. Unsupported hole-like regions remain immediate visible fallback because the v6b backend does not claim hole support. Multi-island inputs are handled as main-island-only and reported through `multiIslandHandling: "main-island-only"` and provenance.

## Diagnostics Exposed

Successful or fallback v6b metrics expose:

- `backendId: "v6b-constrainautor"`
- `dependencyGateStatus`
- `constraintEdgeCount`
- `preservedConstraintEdgeCount`
- `missingConstraintEdgeCount`
- `constraintRecoveryFailed`
- `outsideTriangleCount`
- `thrownErrorKind` when a backend throw is caught

Operation transform history records the same v6b diagnostic family through `meshQuality:v6Constrainautor*` entries.

## Dependency Import / Runtime Behavior Evidence

- `delaunator` is imported by the v6b backend as an ESM dependency and is exercised by focused Vitest.
- `@kninnug/constrainautor` is imported through the local static ESM shim because the package's published `types` target its TypeScript source and is not compatible with this repository's strict NodeNext/verbatim settings.
- Local package metadata confirms:
  - `delaunator@5.1.0` is ESM, typed, ISC licensed, and depends on `robust-predicates`.
  - `@kninnug/constrainautor@4.1.0` exposes ESM/CJS entries, is ISC licensed, and documents duplicate/intersecting constraint preconditions.
- Focused Vitest uses Vite config loading and executed both dependency paths after the expected Windows sandbox `esbuild spawn EPERM` rerun was escalated.
- Root `pnpm.cmd build` is not available in this repository (`Command "build" not found`). Editor/browser build verification is left as a Domain E or final-integration check because `apps/editor/**` is outside Domain C write scope.

## Contract Trace

```text
OperationRequestSchema / generateMesh payload
-> shared MESH_GENERATION_METHOD_IDS accepts auto-outline-v6b-constrainautor
-> generateMeshOperationHandler.commit
-> createGeneratedMeshForDrawable
-> createAutoOutlineV6BConstrainautorMesh
-> outline-v6b-constrainautor-rgba on verified backend output
   or alpha-aware-rgba / bounds-grid visible fallback
-> v6 metrics and Constrainautor diagnostics in operation provenance
```

## Review Lanes

| Lane | Initial verdict | Fix Loop 1 action | Current status |
|---|---|---|---|
| Spec Compliance Review | `needs_changes` | Added retry behavior and broader v6b fixture evidence; this report supplies missing durable report evidence. | Final `pass` after Fix Loop 1 |
| Design / Development Compliance Review | `pass` | No source fix required. Delta re-review found no regression. Residual browser bundling risk recorded. | `pass` |
| Test Adequacy Review | `needs_changes` | Added direct v6b empty-alpha fallback coverage. | Final `pass` after Fix Loop 1 |

Review artifacts:

- [Spec Compliance Review](../../reviews/wave68/wave68-domain-c-spec-compliance-review.md)
- [Design / Development Compliance Review](../../reviews/wave68/wave68-domain-c-design-development-review.md)
- [Test Adequacy Review](../../reviews/wave68/wave68-domain-c-test-adequacy-review.md)

## Verification

Parent / Orch-Sylph verification after Fix Loop 1:

| Command | Result |
|---|---|
| `pnpm.cmd exec vitest run packages/authoring-core/src/mesh-generation.test.ts packages/operation-core/src/operations/generate-mesh.test.ts --reporter=dot` | Sandbox hit expected Windows `esbuild spawn EPERM`; escalated rerun passed, 2 files / 69 tests. |
| `pnpm.cmd typecheck` | pass |
| `node scripts/check-source-organization.mjs` | pass |
| `node scripts/check-dependencies.mjs` | pass |
| `git diff --check -- packages/authoring-core/src/mesh-generation.ts packages/authoring-core/src/mesh-quality-metrics.ts packages/authoring-core/src/mesh-generation.test.ts packages/operation-core/src/operations/generate-mesh.test.ts` | pass, LF/CRLF warnings only |
| no-index `git diff --check` on new v6b files and `mesh-generation-contract.ts` | no whitespace diagnostics, expected no-index exit `1` and LF/CRLF warnings only |
| `pnpm.cmd build` | unavailable; root package has no `build` script |

Gnome also reported focused authoring-core-only Vitest passed after sandbox escalation before the full focused rerun.

## Must-Not Compliance

- Current default remains `auto-outline-v2.6-soft-apron`.
- Domain C did not switch Editor default to v6b.
- Domain C did not edit `apps/editor/**`, render packages, package manifests, lockfile, or dependency registry.
- Domain C did not run `pnpm install`.
- V1-V5/grid/envelope/apron/contour-band/recursive-ring implementations were not used as v6b algorithm basis.
- v6b success is only reported after Constrainautor recovery and boundary-edge verification.
- Missing constraints, invalid constraints, backend throws, empty alpha, missing bytes, and unsupported holes are visible failure/fallback/blocker states.
- v6b does not claim Cubism compatibility, pixel-perfect reproduction, hole support, or full multi-island support.

## Deferred Items

Deferred by plan:

- Editor temporary backend selector and browser UI provenance: Domain E.
- Final v6 backend choice.
- Switching default to v6.
- Removing or hiding the temporary backend selector.

Deferred by v6b v0 limitation:

- Full hole triangulation.
- Full multi-island merge.
- Artist-facing visual/editability acceptance beyond deterministic fixture evidence.

## Residual Risk

- Browser bundle proof is indirect for Domain C. Vite/Vitest import behavior passes, but Editor build/browser smoke should be checked in Domain E or final integration.
- The v6b backend file is large but cohesive. Shared v6 pipeline extraction should wait until backend comparison stabilizes.
- v6b uses a local runtime shim for Constrainautor type compatibility. The shim is thin and static, but it should remain visible in final integration review.
- The shared worktree includes parallel Domain D v6c edits in router/contract/metrics/tests. Final integration must review combined shared-file state.

## User-Decision Points

None for Domain C.

Later product decisions remain outside this domain: final backend selection, default switch, and temporary selector removal/hiding.
