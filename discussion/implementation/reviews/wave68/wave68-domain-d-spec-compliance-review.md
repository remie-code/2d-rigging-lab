# Wave68 Domain D Spec Compliance Review

- Verdict: `pass` after Fix Loop 2
- Wave: `mesh-generation-quality-foundation-v6-sidecar-candidates`
- Domain: `wave68-mesh-auto-outline-v6c-poly2tri-sidecar`
- Review lane: Spec Compliance
- Date: 2026-06-14
- Reviewer: Review-Sylph

## Summary

Domain D implements a real `auto-outline-v6c-poly2tri` authoring-core sidecar path and the main code path matches the v6c design: it derives a soft alpha mask, selects a main outer contour, samples deterministic boundary and interior/Steiner points, calls `poly2tri`, verifies boundary edges, exposes v6c diagnostics, and falls back visibly for holes, multiple islands, empty alpha, and missing texture bytes.

The lane does not pass yet. Required Domain D report evidence is missing, browser/Vite import behavior is still unverified because the Editor build stops on an unrelated/concurrent canvas type error before Vite bundling, and the v6c design's minimum fixture/failure evidence is incomplete for touching-hole / near-duplicate / invalid-polygon / triangulation-throw / boundary-missing cases.

## Findings

### 1. Missing Domain D implementation report and dependency/import evidence

Severity: blocking for Spec Compliance.

Wave68 requires Gnome/domain reports and explicitly lists the Domain D report at `discussion/implementation/waves/wave68/wave68-domain-d-mesh-auto-outline-v6c-poly2tri-sidecar-report.md` (`discussion/implementation/orchestration/wave68-plan.md:593`, `:600`). Domain D guidance also requires dependency and import behavior evidence to be recorded in the report (`discussion/implementation/orchestration/wave68-plan.md:448` through `:452`).

At review time, `discussion/implementation/waves/wave68/` contains the Domain A report, Domain B report, and `_map.md`, but no Domain D report. Without that artifact, the required Basis Coverage Self-Report, deferred items, import evidence, and must-not compliance evidence are not persisted.

Required change: add the Domain D implementation report, including dependency/import/runtime evidence, browser/Vite status, basis coverage, deferred items, and old-algorithm firebreak evidence. No source change is required by this finding if the report exists outside the worktree and only needs to be persisted.

### 2. Browser/Vite import behavior for `poly2tri` remains unverified

Severity: blocking for Spec Compliance evidence.

The v6c design calls out CommonJS/browser risk for `poly2tri` (`discussion/design/mesh-generation/auto-outline-v6c-poly2tri.md:78` through `:82`), and Domain D must record dependency/import behavior evidence (`discussion/implementation/orchestration/wave68-plan.md:452`). Repository evidence is sufficient for package-scope Node/Vitest/TypeScript use:

- `poly2tri` is declared in `packages/authoring-core/package.json:16`.
- The dependency registry records `poly2tri@1.5.0` as the approved v6c candidate backend dependency at `generated/dependencies/dependency-registry.json:68` through `:73`.
- `packages/authoring-core/src/mesh-generation-v6c-poly2tri.ts:3` imports `poly2tri`.
- Focused Vitest and root `pnpm.cmd typecheck` passed.
- A package-scope Node dynamic import from `packages/authoring-core` returned `typeof SweepContext === "function"`.

However, `pnpm.cmd build` from `apps/editor` failed during editor typecheck at `apps/editor/src/workspace/canvas/canvas-render-scene-adapter.ts:115` before Vite bundling. That failure appears outside Domain D and in an already dirty/concurrent Editor area, but it means browser/Vite bundling behavior for the v6c `poly2tri` import is still `unclear`.

Required change: once the concurrent Editor type error is resolved or bypassed by an accepted scoped verification method, run a Vite/browser bundle check that reaches the bundler and records the result in the Domain D report.

### 3. v6c minimum fixture and failure evidence is incomplete

Severity: blocking for complete Spec Compliance evidence; overlaps Test Adequacy but affects the v6c design basis.

The v6c design's minimum fixture set includes a touching/nearly-touching hole, near-duplicate contour points, and multiple-island input (`discussion/design/mesh-generation/auto-outline-v6c-poly2tri.md:190` through `:198`), and each fixture should assert deterministic output, DTO validity, boundary preservation, and visible fallback when polygon constraints are not met (`:200` through `:207`). Current tests cover rectangle, curved blob, thin tapered, small transparent hole, empty alpha, and an inline multiple-island case:

- shared fixtures are `v6-simple-rectangle`, `v6-curved-blob`, `v6-thin-tapered`, `v6-hole-like`, and `v6-empty-alpha-fallback` at `packages/authoring-core/src/mesh-generation-v6-fixtures.ts:3` through `:9`;
- v6c success fixtures run at `packages/authoring-core/src/mesh-generation.test.ts:1424` through `:1503`;
- hole and multi-island fallback metadata is asserted at `packages/authoring-core/src/mesh-generation.test.ts:1506` through `:1590`.

The implementation has explicit non-success branches for invalid polygon, thrown triangulation, and boundary-missing cases:

- polygon validation occurs before triangulation at `packages/authoring-core/src/mesh-generation-v6c-poly2tri.ts:240` through `:258`;
- triangulation failure chooses `v6c-poly2tri-triangulation-threw`, `v6c-poly2tri-boundary-missing`, or `v6c-poly2tri-generation-failed` at `packages/authoring-core/src/mesh-generation-v6c-poly2tri.ts:269` through `:291`;
- `poly2tri` throws are caught at `packages/authoring-core/src/mesh-generation-v6c-poly2tri.ts:923` through `:947`;
- boundary preservation is counted and missing edges block success at `packages/authoring-core/src/mesh-generation-v6c-poly2tri.ts:976` through `:985`.

But I did not find tests or persistent report evidence that trigger:

- touching or nearly touching hole behavior;
- near-duplicate contour point behavior after threshold/sanitization;
- non-hole invalid polygon fallback with `polygonValidationFailed: true`;
- `triangulationThrown: true`;
- `boundaryEdgeMissingCount > 0` and `v6c-poly2tri-boundary-missing`.

Required change: add focused fixture/test evidence or a documented accepted deferral for these v6c design items. If the implementation cannot naturally produce some branches through public fixtures, expose a narrow test seam or document why the branch is defensive-only and how it will be verified.

## Basis Coverage

| Requirement / rubric item | Classification | Evidence |
|---|---|---|
| Domain D report exists with basis coverage and dependency/import evidence | `unclear` / not satisfied | Expected at `wave68-plan.md:600`; not present under `discussion/implementation/waves/wave68/` at review time. |
| Use v6c backend doc as source of truth | `implemented` for source shape; report evidence missing | v6c file follows the v6c pipeline and imports only contract/metrics plus `poly2tri` at `mesh-generation-v6c-poly2tri.ts:1` through `:12`. |
| Headless selection of `auto-outline-v6c-poly2tri` | `implemented` | Routed in `packages/authoring-core/src/mesh-generation.ts:143` through `:145`; tested at `mesh-generation.test.ts:1424`. |
| Operation payload accepts v6c | `implemented` | Payload enum uses `MESH_GENERATION_METHOD_IDS` at `packages/operation-core/src/payloads/model-edit.ts:151` through `:155`; v6 method IDs include v6c at `mesh-generation-contract.ts:7` through `:11`. |
| Operation provenance exposes v6c success diagnostics | `implemented` for success | Formatter emits v6c diagnostics at `packages/operation-core/src/operations/generate-mesh.ts:537` through `:556`; success assertions at `generate-mesh.test.ts:466` through `:483`. |
| PreviewMesh commit allowlist includes v6c | `implemented` | `GENERATED_MESH_PREVIEW_COMMIT_METHOD_IDS` includes all v6 IDs at `mesh-generation-contract.ts:107` through `:116`; operation test covers all v6 candidates at `generate-mesh.test.ts:557` through `:579`. |
| Deterministic output for identical input | `implemented` for covered fixtures | v6c test compares repeated generation at `mesh-generation.test.ts:1445` through `:1448`. |
| Simple outer polygon plus Steiner points | `implemented` | `SweepContext.addPoints` is used for interior samples at `mesh-generation-v6c-poly2tri.ts:924` through `:926`; `steinerPointCount > 0` asserted at `mesh-generation.test.ts:1501`. |
| Validate simple polygon preconditions before triangulation | `implemented` | `validateSimplePolygon` checks point count, area, zero-length edges, duplicates, and self-intersection at `mesh-generation-v6c-poly2tri.ts:815` through `:855`; called before triangulation at `:240`. |
| Hole support or clear limitation | `implemented` as clear limitation | Hole-like regions return `v6c-poly2tri-hole-unsupported`, `holeHandling: "unsupported-fallback"`, and `holeValidationFailed: true` at `mesh-generation-v6c-poly2tri.ts:218` through `:237`; tested at `mesh-generation.test.ts:1506` through `:1590`. |
| Multiple island support or clear limitation | `implemented` as clear limitation | Multiple components return `v6c-poly2tri-multi-island-unsupported`, `multiIslandHandling: "main-island-only"`, and `mainIslandOnlyFallback: true` at `mesh-generation-v6c-poly2tri.ts:196` through `:215`; tested at `mesh-generation.test.ts:1523` through `:1590`. |
| Backend diagnostics exposed | `implemented` | Diagnostic type fields at `mesh-quality-metrics.ts:181` through `:192`; v6c diagnostics created at `mesh-generation-v6c-poly2tri.ts:387` through `:399`; operation formatting at `generate-mesh.ts:537` through `:556`. |
| Failure semantics: invalid polygon, throw, boundary missing do not masquerade as success | `implemented` in code, `unclear` in evidence | Branches exist at `mesh-generation-v6c-poly2tri.ts:240`, `:269`, `:923`, and `:976`; targeted fixture/test/report evidence is missing. |
| DTO invariants | `implemented` for covered success/fallback outputs | `expectValidMeshDto` checks cardinality, IDs, bounds, UVs, indices, and nonzero triangle area at `mesh-generation.test.ts:1882` through `:1958`; used by v6c tests at `:1455` and `:1560`. |
| Existing default remains V2.6, no v6 default switch | `implemented` | Mesh Tool preview/apply still use `auto-outline-v2.6-soft-apron` at `apps/editor/src/features/editor-session/editor-session-context.tsx:653` and `:689`; default command test at `editor-session-commands.test.ts:609` through `:680`. |
| Dependency policy compliance | `implemented` for registry/package/guard; browser/Vite evidence `unclear` | Package/registry evidence at `packages/authoring-core/package.json:13` through `:17` and `generated/dependencies/dependency-registry.json:44` through `:80`; dependency guard passed. |
| Critical firebreak: no V1-V5/grid/envelope/apron/contour-band/recursive-ring basis for v6c | `implemented` from source inspection | Static search found no forbidden old-algorithm references in `mesh-generation-v6c-poly2tri.ts`; the file imports only workspace DTO/metrics contracts and `poly2tri`. Existing old algorithm imports in `mesh-generation.ts` are separate legacy routes, not v6c implementation basis. |
| Temporary Editor backend selector | `deferred by plan` / not Domain D | Domain E owns UI selector per `wave68-plan.md:468` onward. Domain D only needs headless/operation method reachability. |
| Final backend selection / default switch | `explicit non-goal` | Out of scope at `wave68-plan.md:625` through `:629`. |

## Verification

| Command | Result |
|---|---|
| `pnpm.cmd exec vitest run packages/authoring-core/src/mesh-generation.test.ts packages/operation-core/src/operations/generate-mesh.test.ts --reporter=dot` | Sandbox run failed with Windows/Vite/esbuild `spawn EPERM`; approved rerun passed, 2 files / 61 tests. |
| `pnpm.cmd typecheck` | Passed. |
| `node scripts/check-dependencies.mjs` | Passed. |
| `node scripts/check-source-organization.mjs` | Passed. |
| `git diff --check -- <Domain D and shared mesh files>` | Passed with LF/CRLF warnings only. |
| `node -e "import('poly2tri')..."` from `packages/authoring-core` | Passed; `SweepContext` resolved as a function. |
| `pnpm.cmd build` from `apps/editor` | Failed before Vite bundling on unrelated/concurrent `apps/editor/src/workspace/canvas/canvas-render-scene-adapter.ts:115` TypeScript errors, so browser/Vite import behavior remains unverified. |

## Unresolved User-Decision Points

None. The remaining items are implementation/report/verification tasks within the existing Wave68 Domain D scope.

## Fix Loop 1 Re-review

- Re-review verdict: `needs_changes`
- Scope: only original blocking findings and direct regressions from Fix Loop 1.
- Date: 2026-06-14

### Original Finding Resolution

| Original finding | Status | Evidence |
|---|---|---|
| 1. Missing Domain D implementation report and dependency/import evidence | Resolved | The Domain D report now exists at `discussion/implementation/waves/wave68/wave68-domain-d-mesh-auto-outline-v6c-poly2tri-sidecar-report.md`. It records scope, contract trace, dependency/import/runtime evidence, verification, must-not compliance, deferred items, residual risk, and no user-decision points. Dependency/import evidence is recorded at report lines `98` through `108`. |
| 2. Browser/Vite import behavior for `poly2tri` remains unverified | Resolved by persisted parent evidence | The Domain D report records parent bundler-only verification: `pnpm.cmd exec vite build --outDir ../../tmp/vite-v6c-poly2tri-build --emptyOutDir` from `apps/editor` hit sandbox `esbuild spawn EPERM`, then an approved rerun passed with 2182 modules transformed. I did not rerun this build during re-review. |
| 3. v6c minimum fixture and failure evidence is incomplete | Partially resolved; still needs changes | Fix Loop 1 added explicit invalid polygon, forced `poly2tri` throw, and boundary-missing probe coverage at `packages/authoring-core/src/mesh-generation.test.ts:1701` through `:1784`, backed by the v6c test probe at `packages/authoring-core/src/mesh-generation-v6c-poly2tri.ts:383` through `:447`. It also added near-touching-hole fallback coverage at `mesh-generation.test.ts:1803` through `:1818`, and operation fallback provenance at `packages/operation-core/src/operations/generate-mesh.test.ts:557` through `:600`. However, the original finding also called out the v6c design's near-duplicate contour-point fixture/evidence. Current evidence has a v6b near-duplicate test at `mesh-generation.test.ts:1531`, and a v6c exact duplicate/zero-length invalid-polygon probe at `mesh-generation.test.ts:1701` through `:1764`, but I did not find a v6c near-duplicate contour fixture or assertion after threshold/sanitization. `sanitizePolygonLoop` removes short edges at `mesh-generation-v6c-poly2tri.ts:845` through `:854`, but that behavior is not directly verified for v6c. |

### Direct Regressions

No new direct regressions found in the Fix Loop 1 review scope.

- v6c still is not the default. Mesh Tool preview/apply continue to use `auto-outline-v2.6-soft-apron` at `apps/editor/src/features/editor-session/editor-session-context.tsx:653` and `:689`.
- The v6c implementation file still has no static references to old V1-V5/grid/envelope/apron/contour-band/recursive-ring algorithm names.
- The added test probe is exported from `mesh-generation-v6c-poly2tri.ts` for direct test import, but it is not re-exported from `packages/authoring-core/src/index.ts`.

### Fix Loop 1 Verification

| Command / check | Result |
|---|---|
| `pnpm.cmd exec vitest run packages/authoring-core/src/mesh-generation.test.ts packages/operation-core/src/operations/generate-mesh.test.ts --reporter=dot` | Sandbox run failed with Windows/Vite/esbuild `spawn EPERM`; approved rerun passed, 2 files / 67 tests. |
| `pnpm.cmd typecheck` | Passed. |
| `node scripts/check-dependencies.mjs` | Passed. |
| `git diff --check -- <Domain D report/review and changed v6c test files>` | Passed with LF/CRLF warnings only. |
| Static default check | V2.6 remains the Mesh Tool preview/apply method; v6c appears only as explicit method/contract/test routing. |
| Static v6c firebreak check | No forbidden old-algorithm references found in `packages/authoring-core/src/mesh-generation-v6c-poly2tri.ts`. |

### Remaining Required Change

Add v6c-specific evidence for near-duplicate contour points after thresholding/sanitization, or document an explicit accepted deferral for that minimum v6c fixture item. The exact-duplicate invalid-polygon probe is useful, but it does not prove the near-duplicate contour case from the v6c design minimum fixture set.

## Fix Loop 2 Final Re-review

- Final re-review verdict: `pass`
- Scope: only the remaining near-duplicate contour-point Spec finding and direct regressions from Fix Loop 2.
- Date: 2026-06-14

### Remaining Finding Resolution

Resolved.

Fix Loop 2 adds v6c-specific near-duplicate contour-point sanitization evidence:

- `AutoOutlineV6CPoly2TriSanitizationProbeResult` records original count, sanitized count, removed count, shortest sanitized edge length, sanitized points, validation failures, and diagnostics at `packages/authoring-core/src/mesh-generation-v6c-poly2tri.ts:152` through `:160`.
- `probeAutoOutlineV6CPoly2TriSanitizationForTest` calls the production `sanitizePolygonLoop`, validates the sanitized points before triangulation, and reports diagnostics at `packages/authoring-core/src/mesh-generation-v6c-poly2tri.ts:459` through `:478`.
- The production sanitization path dedupes points, removes collinear points, and removes edges shorter than `1.25` before validation at `packages/authoring-core/src/mesh-generation-v6c-poly2tri.ts:889` through `:934`.
- The test `sanitizes near-duplicate auto-outline-v6c-poly2tri contour points before validation` uses a five-point loop with one near-duplicate point, verifies it sanitizes to four valid points with no validation failures, verifies the shortest sanitized edge is at least `1.25`, and then passes the sanitized contour through the same poly2tri probe path with backend output, no validation failures, no thrown triangulation, and no missing boundary edges at `packages/authoring-core/src/mesh-generation.test.ts:1892` through `:1937`.
- The Domain D report records this evidence at `discussion/implementation/waves/wave68/wave68-domain-d-mesh-auto-outline-v6c-poly2tri-sidecar-report.md:76`.

This satisfies the remaining v6c-specific near-duplicate contour-point evidence requirement from the prior Spec finding.

### Direct Regressions

No new direct regressions found in the Fix Loop 2 review scope.

- The sanitization probe is exported only from `mesh-generation-v6c-poly2tri.ts` for direct test import and is not re-exported from `packages/authoring-core/src/index.ts`.
- v6c still is not the default; Mesh Tool preview/apply remain on `auto-outline-v2.6-soft-apron` at `apps/editor/src/features/editor-session/editor-session-context.tsx:653` and `:689`.
- Static search found no forbidden old-algorithm references in `packages/authoring-core/src/mesh-generation-v6c-poly2tri.ts`.

### Fix Loop 2 Verification

| Command / check | Result |
|---|---|
| `pnpm.cmd exec vitest run packages/authoring-core/src/mesh-generation.test.ts packages/operation-core/src/operations/generate-mesh.test.ts --reporter=dot` | Sandbox run failed with Windows/Vite/esbuild `spawn EPERM`; approved rerun passed, 2 files / 69 tests. |
| `git diff --check -- <Domain D source/test/report/review files>` | Passed with LF/CRLF warnings only. |
| Static barrel-export check | Probe exports are directly imported by tests from `mesh-generation-v6c-poly2tri.ts`; no `index.ts` re-export found. |
| Static default check | V2.6 remains the Mesh Tool preview/apply method; v6c remains an explicit sidecar method. |
| Static v6c firebreak check | No V1-V5/grid/envelope/apron/contour-band/recursive-ring references found in `mesh-generation-v6c-poly2tri.ts`. |

### Final Spec Status

All original Domain D Spec Compliance findings are resolved. No unresolved user-decision points remain for this lane.
