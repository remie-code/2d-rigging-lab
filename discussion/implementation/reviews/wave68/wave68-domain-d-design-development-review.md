# Wave68 Domain D Design / Development Compliance Review

- Wave: `mesh-generation-quality-foundation-v6-sidecar-candidates`
- Domain: `wave68-mesh-auto-outline-v6c-poly2tri-sidecar`
- Review lane: Design / Development Compliance
- Date: 2026-06-14
- Reviewer: Review-Sylph

## Verdict

`pass`

No blocking design/development compliance findings were found in the inspected Domain D source surface. The v6c implementation is a cohesive sidecar, keeps failure modes visible, uses the Domain A-approved `poly2tri` dependency scope, and does not make v6c the default.

## Findings

Blocking findings: none.

Non-blocking notes:

- Focused Vitest could not be completed in the Windows sandbox because Vite/esbuild failed at config load with `spawn EPERM`. Per instruction, source was not changed. The attempted unsandboxed rerun was rejected by the approval reviewer, so this review relies on static inspection, guards, typecheck, and direct package-scoped import smoke.
- The Domain D implementation report artifact was not present at review time under `discussion/implementation/waves/wave68/`. This is an orchestration artifact gap for the parent loop to close, not a source design/development blocker for this lane.

## Compliance Evidence

### Architecture / Module Boundary

- v6c has a clear sidecar implementation entrypoint in `packages/authoring-core/src/mesh-generation-v6c-poly2tri.ts:127`.
- Shared routing calls v6c only for `auto-outline-v6c-poly2tri` in `packages/authoring-core/src/mesh-generation.ts:143` and delegates through `createV6CPoly2TriMeshResult` at `packages/authoring-core/src/mesh-generation.ts:1077`.
- `packages/authoring-core/src/index.ts:1` remains barrel-only; v6c does not add implementation logic there.

### Source Organization

- The new v6c file is large but cohesive: alpha mask, simple polygon validation, Steiner sampling, `poly2tri` triangulation, diagnostics, and DTO conversion all serve the single v6c backend responsibility.
- `node scripts/check-source-organization.mjs` passed.
- No catch-all `utils.ts` / `helpers.ts` style file was introduced.

### Dependency Policy

- v6c imports only `poly2tri` directly at `packages/authoring-core/src/mesh-generation-v6c-poly2tri.ts:3`.
- Domain A records `poly2tri@1.5.0` as approved BSD-3-Clause runtime scope for Wave68 v6c at `generated/dependencies/dependency-registry.json:68`.
- `packages/authoring-core/package.json:16` contains `poly2tri`; this matches the Domain A report's approved dependency set. No extra Domain D dependency was observed.
- Package-scoped Node import smoke from `packages/authoring-core` succeeded and triangulated one simple triangle.
- `node scripts/check-dependencies.mjs` passed.

### Operation Boundary

- Operation payload method validation is synchronized through `MESH_GENERATION_METHOD_IDS` in `packages/operation-core/src/payloads/model-edit.ts:153`.
- Operation provenance formats v6 source/output/fallback and v6 diagnostics in `packages/operation-core/src/operations/generate-mesh.ts:487` and poly2tri-specific diagnostics in `packages/operation-core/src/operations/generate-mesh.ts:537`.
- Package mutation remains through `generateMeshOperationHandler` / `replaceDrawableMesh`; no direct package mutation path was added by v6c.

### Determinism / IDs

- v6c stable IDs are deterministic and machine-readable with no spaces: vertex IDs at `packages/authoring-core/src/mesh-generation-v6c-poly2tri.ts:302` and triangle IDs at `packages/authoring-core/src/mesh-generation-v6c-poly2tri.ts:307`.
- Triangle output is sorted deterministically after filtering at `packages/authoring-core/src/mesh-generation-v6c-poly2tri.ts:976`.
- Contract method/source/fallback IDs are machine-readable and synchronized in `packages/authoring-core/src/mesh-generation-contract.ts:10`, `packages/authoring-core/src/mesh-generation-contract.ts:16`, and `packages/authoring-core/src/mesh-generation-contract.ts:129`.

### Firebreak

- Static search of `packages/authoring-core/src/mesh-generation-v6c-poly2tri.ts` found no imports or references to old V1-V5/grid/envelope/apron/contour-band/recursive-ring implementation files.
- The v6c file uses the v6 alpha/contour/sampling/poly2tri design path and its own local helpers; no old algorithm helper reuse was observed.

### Failure Honesty

- Empty/invalid input returns blocked results before backend success can be claimed at `packages/authoring-core/src/mesh-generation-v6c-poly2tri.ts:135` and `packages/authoring-core/src/mesh-generation-v6c-poly2tri.ts:143`.
- Multiple islands and holes are reported as visible fallback, not backend success, at `packages/authoring-core/src/mesh-generation-v6c-poly2tri.ts:196` and `packages/authoring-core/src/mesh-generation-v6c-poly2tri.ts:218`.
- Polygon validation failure and triangulation/boundary failure are blocked at `packages/authoring-core/src/mesh-generation-v6c-poly2tri.ts:240` and `packages/authoring-core/src/mesh-generation-v6c-poly2tri.ts:269`.
- Fallback conversion records actual source, output kind, fallback reason, fallback steps, and poly2tri diagnostics at `packages/authoring-core/src/mesh-generation.ts:1161`.

### Dirty Worktree / Concurrency

- Concurrent v6b files are present and treated as Domain C scope unless they affect shared contracts:
  - `packages/authoring-core/src/mesh-generation-v6b-constrainautor.ts`
  - `packages/authoring-core/src/mesh-generation-v6b-constrainautor-runtime.js`
  - `packages/authoring-core/src/mesh-generation-v6b-constrainautor-runtime.d.ts`
- Manifest, lockfile, and dependency registry changes are present, but Domain A's report records the approved Wave68 dependency set. No additional Domain D-only manifest or registry drift was found.
- Existing editor and old mesh algorithm dirty files were not reviewed as Domain D implementation scope.

## Verification

| Command | Result |
|---|---|
| `node scripts/check-source-organization.mjs` | pass |
| `node scripts/check-dependencies.mjs` | pass |
| `pnpm.cmd typecheck` | pass |
| `git diff --check -- <Domain D/shared tracked files>` | pass, LF/CRLF warnings only |
| `rg -n '[ \t]+$' packages/authoring-core/src/mesh-generation-v6c-poly2tri.ts ...` | no trailing whitespace matches |
| `node --input-type=module -e "import * as p from 'poly2tri'; ..."` from `packages/authoring-core` | pass, returned `1` triangle |
| `pnpm.cmd exec vitest run packages/authoring-core/src/mesh-generation.test.ts packages/operation-core/src/operations/generate-mesh.test.ts --reporter=dot` | blocked by Windows sandbox `esbuild spawn EPERM` before tests ran |

## Fix Loop 1 Regression Re-review

- Date: 2026-06-14
- Scope: direct regressions from the narrow v6c test probe added in Fix Loop 1.
- Verdict: `pass`

No direct design/development regression was found.

### Probe API Review

- `probeAutoOutlineV6CPoly2TriFailureForTest` is exported only from `packages/authoring-core/src/mesh-generation-v6c-poly2tri.ts:383`.
- Related probe types are limited to the same v6c module at `packages/authoring-core/src/mesh-generation-v6c-poly2tri.ts:123`.
- `packages/authoring-core/src/index.ts:25` exports shared v6 contracts/fixtures and `mesh-generation`, but does not re-export `mesh-generation-v6c-poly2tri.ts`; static search found no barrel export for the probe.
- The probe is v6c-local: it copies point inputs, calls v6c polygon validation and `triangulateWithPoly2Tri`, and returns diagnostic/failure data only. It does not mutate session/package state and does not add a product operation surface.
- The test seam is narrow enough for the defensive branches it covers: invalid polygon, forced triangulation throw, and boundary-missing output.

### Added Tests Review

- The new probe tests use a relative test import from `packages/authoring-core/src/mesh-generation.test.ts:32` and exercise the probe at `packages/authoring-core/src/mesh-generation.test.ts:1701`.
- The probe tests use synthetic polygon points and stubbed sweep contexts. They do not use old V1-V5/grid/envelope/apron/contour-band/recursive-ring internals as the v6c basis.
- Existing old-algorithm tests remain in the same broad test file, but the Fix Loop 1 v6c probe tests do not add new old-algorithm coupling.

### Vite / Tmp Evidence Review

- The Domain D report now exists and records Vite bundler evidence at `discussion/implementation/waves/wave68/wave68-domain-d-mesh-auto-outline-v6c-poly2tri-sidecar-report.md:105`.
- `tmp/vite-v6c-poly2tri-build` was not present during re-review, matching the report's cleanup note.
- Existing `tmp/run-logs/**` and `tmp/console.log` remain dirty worktree artifacts, but the Domain D report classifies tmp logs as pre-existing/not attributed to Domain D. This does not change dependency or compliance status.
- Vite evidence and tmp cleanup do not introduce package manifest, lockfile, dependency registry, or source organization risk.

### Fix Loop 1 Verification

| Command | Result |
|---|---|
| `node scripts/check-source-organization.mjs` | pass |
| `node scripts/check-dependencies.mjs` | pass |
| `pnpm.cmd typecheck` | pass |
| `git diff --check -- packages/authoring-core/src/mesh-generation-v6c-poly2tri.ts packages/authoring-core/src/mesh-generation.test.ts packages/authoring-core/src/index.ts discussion/implementation/waves/wave68/wave68-domain-d-mesh-auto-outline-v6c-poly2tri-sidecar-report.md discussion/implementation/reviews/wave68/wave68-domain-d-design-development-review.md` | pass, LF/CRLF warnings only |
| `rg -n '[ \t]+$' packages/authoring-core/src/mesh-generation-v6c-poly2tri.ts packages/authoring-core/src/mesh-generation.test.ts discussion/implementation/waves/wave68/wave68-domain-d-mesh-auto-outline-v6c-poly2tri-sidecar-report.md discussion/implementation/reviews/wave68/wave68-domain-d-design-development-review.md` | no matches |
| `Test-Path tmp/vite-v6c-poly2tri-build` | `False` |
| `pnpm.cmd exec vitest run packages/authoring-core/src/mesh-generation.test.ts packages/operation-core/src/operations/generate-mesh.test.ts --reporter=dot` | blocked by Windows sandbox `esbuild spawn EPERM` before tests ran |

## Fix Loop 2 Direct Regression Re-review

- Date: 2026-06-14
- Scope: direct regressions from the v6c near-duplicate sanitization probe and report update.
- Verdict: `pass`

No direct design/development regression was found.

### Sanitization Probe API Review

- `AutoOutlineV6CPoly2TriSanitizationProbeResult` is declared in `packages/authoring-core/src/mesh-generation-v6c-poly2tri.ts:152`.
- `probeAutoOutlineV6CPoly2TriSanitizationForTest` is exported only from the v6c implementation file at `packages/authoring-core/src/mesh-generation-v6c-poly2tri.ts:459`.
- The probe is v6c-local and narrow: it copies provided probe points, calls the existing v6c `sanitizePolygonLoop` and `validateSimplePolygon`, and returns point counts, shortest sanitized edge length, sanitized points, validation failures, and poly2tri diagnostic shape. It does not call session/package mutation code, operation-core, editor code, dependency setup, or old mesh algorithms.
- `packages/authoring-core/src/index.ts:25` re-exports shared v6 contracts/fixtures and `mesh-generation`, but still does not re-export `mesh-generation-v6c-poly2tri.ts`; static search found no barrel exposure for the sanitization probe or its result type.

### Added Test Review

- The near-duplicate sanitization test is in `packages/authoring-core/src/mesh-generation.test.ts:1892`.
- The test uses synthetic v6c contour points, verifies one near-duplicate point is removed before validation, and then feeds the sanitized points into the existing v6c failure/backend probe. This stays within v6c test seams and does not use V1-V5/grid/envelope/apron/contour-band/recursive-ring internals as v6c algorithm basis.
- The test file still contains pre-existing old-algorithm coverage, but Fix Loop 2's added test does not add a new old-algorithm dependency.

### Domain D Report Review

- The Domain D report records Fix Loop 2 status and evidence at `discussion/implementation/waves/wave68/wave68-domain-d-mesh-auto-outline-v6c-poly2tri-sidecar-report.md:20`, `:38`, `:76`, and `:133`.
- The report update does not claim new dependency approval, package manifest edits, lockfile edits, or broader production API exposure.
- The report's `tmp` / Vite evidence remains compliance-neutral for this lane: no `tmp/vite-v6c-poly2tri-build` directory was present during this re-review, and dependency/source guards passed.

### Fix Loop 2 Verification

| Command | Result |
|---|---|
| `node scripts/check-source-organization.mjs` | pass |
| `node scripts/check-dependencies.mjs` | pass |
| `pnpm.cmd typecheck` | pass |
| `git diff --check -- packages/authoring-core/src/mesh-generation-v6c-poly2tri.ts packages/authoring-core/src/mesh-generation.test.ts packages/authoring-core/src/index.ts discussion/implementation/waves/wave68/wave68-domain-d-mesh-auto-outline-v6c-poly2tri-sidecar-report.md discussion/implementation/reviews/wave68/wave68-domain-d-design-development-review.md` | pass, LF/CRLF warnings only |
| `rg -n '[ \t]+$' packages/authoring-core/src/mesh-generation-v6c-poly2tri.ts packages/authoring-core/src/mesh-generation.test.ts discussion/implementation/waves/wave68/wave68-domain-d-mesh-auto-outline-v6c-poly2tri-sidecar-report.md discussion/implementation/reviews/wave68/wave68-domain-d-design-development-review.md` | no matches |
| `pnpm.cmd exec vitest run packages/authoring-core/src/mesh-generation.test.ts --reporter=dot` | blocked by Windows sandbox `esbuild spawn EPERM` before tests ran |

## Unresolved User-Decision Points

None.

Open verification item for the parent loop: focused Vitest should be rerun outside the Windows sandbox only if the parent/user explicitly permits it. This review did not change source in response to the sandbox failure.
