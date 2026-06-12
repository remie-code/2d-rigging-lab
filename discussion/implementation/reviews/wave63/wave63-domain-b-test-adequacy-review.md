# Wave63 Domain B Test Adequacy Re-review

## Final Verdict

- Final Verdict: `pass`
- Domain: `wave63-mesh-auto-outline-v2-algorithm-foundation`
- Review lane: Test Adequacy Re-review, Fix Loop 1
- Reviewer: Review-Sylph Lane 3
- Date: 2026-06-12

Rationale:

- Fix Loop 1 directly closes the six previous blocking gaps with targeted unit and e2e assertions.
- The added tests are not only presence/smoke checks: they assert v2 density ordering, Standard/Large inset behavior, alpha outside filtering by triangle samples, sampler anti-grid invariants, full operation provenance metric prefixes plus fallback propagation, and Editor proof that Mesh Tool generation reaches `auto-outline-v2`.
- Focused unit tests, targeted Mesh Tool e2e, typecheck, source organization guard, and diff check passed in this re-review.

## Fix-loop Closure Table

| Previous blocking gap | Closure evidence inspected | Status |
|---|---|---|
| 1. v2 Large > Standard > Low density ordering direct test missing. | `packages/authoring-core/src/mesh-generation.test.ts:132` adds `uses denser auto-outline-v2 points and inset rings for Large Motion than Standard or Low Motion`; assertions at `:158` through `:161` require high > medium > low for vertices and triangles. | Closed |
| 2. v2 alpha outside triangle filtering direct test missing. | `packages/authoring-core/src/mesh-generation.test.ts:167` adds a notched alpha fixture and asserts `countTransparentSampledTriangles(...)` is `0` at `:189`; helper at `:611` through `:633` samples centroid, edge midpoints, and vertex-centroid midpoints against alpha. | Closed |
| 3. Large/Standard inset ring expectations missing. | The same v2 density test asserts Standard has at least one ring at `packages/authoring-core/src/mesh-generation.test.ts:162`, Large ring count is at least Standard at `:163`, and Large includes `_inset_1_` stable IDs at `:164`. Existing deterministic v2 test also asserts `_inset_0_` at `:128`. | Closed |
| 4. Jittered / Poisson-like sampler anti-grid regression invariant weak. | `packages/authoring-core/src/mesh-generation.test.ts:192` adds a direct anti-grid test. It extracts `_interior_` vertices at `:212`, asserts at least four samples, fractional diversity on X/Y at `:218` through `:220`, and a pairwise minimum-distance bound at `:221`. | Closed |
| 5. Operation provenance assertion for all quality metrics / fallback propagation missing. | `packages/operation-core/src/operations/generate-mesh.test.ts:259` asserts direct v2 provenance plus every required metric prefix at `:268` through `:280`. `:283` adds an empty-alpha operation test that asserts `fallback:auto-outline-v2:alpha-empty` and `fallback:auto-outline-v1:alpha-empty` at `:290` through `:296`. | Closed |
| 6. Editor preview/apply using `auto-outline-v2` not fixed by unit/e2e. | `apps/editor/src/features/editor-session/model/editor-session-commands.test.ts:110` verifies method-omitted Mesh Tool generation commits `generateMesh:auto-outline-v2` and `meshSource:outline-v2-rgba` at `:172` through `:179`. `apps/editor/e2e/psd-import.e2e.spec.ts:198` through `:206` asserts Mesh Tool preview source text is `Auto outline v2` and quality rows are visible after `Preview Standard mesh`. | Closed |

## Verification Commands / Results

- `pnpm.cmd exec vitest run packages/authoring-core/src/mesh-generation.test.ts packages/operation-core/src/operations/generate-mesh.test.ts apps/editor/src/features/editor-session/model/editor-session-commands.test.ts`
  - Sandbox run failed with `spawn EPERM` while loading Vitest/Vite config through esbuild.
  - Escalated rerun passed: 3 files passed, 28 tests passed.
- `pnpm.cmd --filter @private-2d-rigging-lab/editor exec playwright test -c playwright.config.ts e2e/psd-import.e2e.spec.ts -g "generates an initial mesh" --workers=1 --reporter=line`
  - Passed: 1 test passed.
- `pnpm.cmd typecheck`
  - Passed.
- `node scripts/check-source-organization.mjs`
  - Passed: `Source organization guard passed.`
- `git diff --check`
  - Passed with line-ending warnings only: Git reported LF-to-CRLF normalization warnings, and no whitespace errors.
- `rg -n "pixel-perfect|Cubism|snapshot|visual|golden|screenshot|toHaveScreenshot|model3|moc3|cmo3|Live2D" packages/authoring-core/src/mesh-generation.test.ts packages/operation-core/src/operations/generate-mesh.test.ts apps/editor/src/features/editor-session/model/editor-session-commands.test.ts apps/editor/e2e/psd-import.e2e.spec.ts`
  - No matches. The command returned exit code 1 because `rg` found no matching forbidden visual/Cubism oracle terms.

## Remaining Non-blocking Residual Risks

- Full constrained triangulation remains intentionally deferred; tests correctly preserve the interim `interim-delaunay-alpha-filter` contract rather than claiming constrained triangulation.
- The alpha outside filtering test samples representative points, not every continuous point along every triangle edge. This is adequate for the current alpha-filter implementation contract, but broader geometry robustness remains future work.
- The sampler anti-grid test now protects deterministic fractional diversity and minimum spacing, but it is not a statistical Poisson quality test.
- Representative quality comparison still uses a small number of fixtures. Future tuning should add more shape families, holes, multiple islands, and refinement-positive cases.
- Editor e2e covers the targeted Mesh Tool path and source/quality summary after preview. It does not exhaustively cover every preset, every drawable shape, or all future mesh UI states.

## Residual Risk Classification

- Residual Risk Classification: `medium`
- Reason: all prior blocking test gaps are closed for the Wave63 Domain B foundation slice, while robust constrained triangulation, full hole/multiple-island handling, and broad visual-quality fixture coverage remain intentionally deferred future work.

## Required Follow-up

No blocking test adequacy fixes remain for the six previous gaps.
