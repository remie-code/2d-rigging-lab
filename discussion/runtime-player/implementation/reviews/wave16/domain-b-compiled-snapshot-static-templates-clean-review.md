# Runtime Player Wave16 Domain B Clean Review: Compiled Snapshot / Static Templates

- Verdict: pass
- Domain: Compiled Snapshot / Static Templates
- Reviewer: Review-Sylph
- Date: 2026-06-26
- Domain C may proceed: yes

## Scope Reviewed

Reviewed whether Domain B safely moved static snapshot inputs into runtime-core's compiled model while preserving snapshot DTO compatibility, fresh per-frame output, runtime-core dependency boundaries, and Domain B scope limits.

This review did not fix source files and did not treat the already accepted Domain A API shell as a Domain B violation.

## Basis Documents Used

- `discussion/runtime-player/implementation/orchestration/player-wave16-plan.md`
- `discussion/runtime-player/implementation/waves/wave16/domain-a-runtime-core-compiled-api-shell-report.md`
- `discussion/runtime-player/implementation/reviews/wave16/domain-a-runtime-core-compiled-api-shell-clean-review.md`
- `discussion/runtime-player/implementation/waves/wave15/wave15-final-integration-report.md`
- `tmp/report.log`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/runtime-player/implementation/waves/wave16/domain-b-compiled-snapshot-static-templates-report.md`
- `discussion/_conventions.md`
- `discussion/_map.md`

## Changed Files Reviewed

- `packages/runtime-core/src/runtime-model.ts`
- `packages/runtime-core/src/runtime-core.ts`
- `packages/runtime-core/src/snapshot.ts`
- `packages/runtime-core/src/snapshot-static-templates.ts`
- `packages/runtime-core/src/snapshot-static-templates.test.ts`
- `packages/runtime-core/src/runtime-core.test.ts`
- `discussion/runtime-player/implementation/waves/wave16/domain-b-compiled-snapshot-static-templates-report.md`

Context spot-checks:

- `packages/runtime-core/src/index.ts`
- `packages/runtime-core/src/dependency-boundary.test.ts`
- `packages/runtime-core/src/keyform-target-application.ts`
- `packages/runtime-core/src/texture-projection.ts`
- `packages/runtime-core/src/mesh-evidence.ts`
- `packages/runtime-core/src/runtime-profiling.ts`

## Findings

No blocking or non-blocking implementation findings.

## Rubric Assessment

| Rubric item | Result | Evidence |
|---|---|---|
| Compiled model owns only safe static snapshot/template data | Pass | `createCompiledRuntimeModel` builds `compileRuntimeSnapshotStaticTemplates(graph)` once and passes it privately to instances. See `packages/runtime-core/src/runtime-model.ts:70` and `packages/runtime-core/src/runtime-model.ts:73`. |
| Snapshot DTO shape is preserved | Pass | Public `evaluateRuntimeFrame` remains routed through the same `RuntimeFrameEvaluationResult` shape, and `createRuntimeSnapshot` still returns `RuntimeSnapshotDto`. See `packages/runtime-core/src/runtime-core.ts:81`, `packages/runtime-core/src/runtime-core.ts:159`, and `packages/runtime-core/src/snapshot.ts:176`. |
| Fresh final snapshot object compatibility is preserved | Pass | Compiled instance calls `evaluateRuntimeFrameInternal` each frame and creates a new snapshot. Tests assert previous and next snapshots are distinct and previous snapshots remain equal to a pre-second-frame clone. See `packages/runtime-core/src/runtime-model.ts:107`, `packages/runtime-core/src/snapshot-static-templates.test.ts:118`, and `packages/runtime-core/src/snapshot-static-templates.test.ts:119`. |
| Public nested arrays are not reused in a way that mutates previous snapshots | Pass | Materialization clones bounds, vertices, UV arrays, mask source/target arrays, and drawList is rebuilt from current drawables. See `packages/runtime-core/src/snapshot-static-templates.ts:136`, `packages/runtime-core/src/snapshot-static-templates.ts:143`, `packages/runtime-core/src/snapshot-static-templates.ts:148`, `packages/runtime-core/src/snapshot-static-templates.ts:242`, and `packages/runtime-core/src/snapshot.ts:271`. Tests mutate previous public vertices, UVs, mask source IDs, and drawList before a later frame. See `packages/runtime-core/src/snapshot-static-templates.test.ts:128`, `packages/runtime-core/src/snapshot-static-templates.test.ts:131`, and `packages/runtime-core/src/snapshot-static-templates.test.ts:148`. |
| Keyform-driven opacity, visibility, drawOrder, and vertices remain per-frame | Pass | Per-frame keyform sampling/application is still outside compiled templates. See `packages/runtime-core/src/snapshot.ts:204` and `packages/runtime-core/src/snapshot.ts:232`. Domain B's compiled-vs-legacy fixture covers vertices, opacity, and drawOrder keyforms; existing target-application tests cover direct visibility patch application. See `packages/runtime-core/src/snapshot-static-templates.test.ts:22`, `packages/runtime-core/src/snapshot-static-templates.test.ts:238`, `packages/runtime-core/src/snapshot-static-templates.test.ts:252`, and `packages/runtime-core/src/snapshot-static-templates.test.ts:266`. |
| Full snapshot detail remains available and compatible | Pass | Full snapshot compiled output is deep-equal to legacy/transient output. See `packages/runtime-core/src/snapshot-static-templates.test.ts:22` and `packages/runtime-core/src/snapshot-static-templates.test.ts:56`. |
| Compiled and legacy/transient outputs are deep-equal for deterministic full snapshots | Pass | `expect(compiled).toEqual(legacy)` covers the full frame result for the Domain B fixture. See `packages/runtime-core/src/snapshot-static-templates.test.ts:56`. |
| Reference/base vertex streams, static drawable metadata/templates, texture/UV templates, and mask topology are compiled where safe | Pass | Compiled templates include drawables, reference vertices, and masks. See `packages/runtime-core/src/snapshot-static-templates.ts:75`, `packages/runtime-core/src/snapshot-static-templates.ts:98`, `packages/runtime-core/src/snapshot-static-templates.ts:110`, and `packages/runtime-core/src/snapshot-static-templates.ts:188`. |
| No deformer hierarchy topology leaked into Domain B | Pass | `evaluateRigControlHierarchy` remains per-frame in `snapshot.ts`; Domain B only supplies compiled reference vertices. See `packages/runtime-core/src/snapshot.ts:242` and `packages/runtime-core/src/snapshot.ts:245`. |
| No Runtime Player connection work leaked into Domain B | Pass | Reviewed target diff and status; changes are limited to runtime-core source/tests and Wave16 reports. |
| runtime-core dependency boundary remains intact | Pass | Runtime-core imports remain local/contracts-only; dependency-boundary test passed. The forbidden-import scan only found the test's own regex. See `packages/runtime-core/src/dependency-boundary.test.ts:12`. |
| Performance/profiling phase names remain meaningful | Pass | Phase keys remain present. Domain B report documents the changed compiled-path meaning for drawable and mask phase timing and defers real Browser Source interpretation to Domain E. See `discussion/runtime-player/implementation/waves/wave16/domain-b-compiled-snapshot-static-templates-report.md:123`, `discussion/runtime-player/implementation/waves/wave16/domain-b-compiled-snapshot-static-templates-report.md:129`, and `discussion/runtime-player/implementation/waves/wave16/domain-b-compiled-snapshot-static-templates-report.md:140`. |
| Source organization policy is respected | Pass | New `snapshot-static-templates.ts` has a focused responsibility, `index.ts` remains barrel-only, and `node scripts/check-source-organization.mjs` passed. See `packages/runtime-core/src/index.ts:1` and `discussion/runtime-player/implementation/waves/wave16/domain-b-compiled-snapshot-static-templates-report.md:168`. |

## Test Adequacy Assessment

Adequate for Domain B risk.

The added tests directly cover the highest-risk behavior: compiled-vs-legacy full snapshot equality, fresh snapshot/drawable/nested array materialization, mutation of a previous public snapshot before later evaluation, texture UV cloning, mask array cloning, drawList rebuilding, and keyform-driven vertices/opacity/drawOrder.

Visibility keyform sampling remains an existing limitation: runtime linear keyform sampling does not currently support boolean patches, and Domain B intentionally did not broaden sampler semantics. Existing target-application coverage plus Gnome's report make this acceptable for Domain B.

Residual coverage note for Domain C: Domain B compiles reference/base vertex streams, but the focused Domain B test does not exercise a compiled-instance rig-control vertex transform. Domain C should add or retain compiled-path rig/deformer tests when it compiles deformer topology.

## Verification Commands Run

- `git status --short -uall`
  - Reviewed working tree. Domain B target files are mixed with accepted Domain A untracked/modified baseline files.
- `git diff -- packages/runtime-core/src/runtime-core.ts packages/runtime-core/src/snapshot.ts packages/runtime-core/src/runtime-core.test.ts`
  - Reviewed tracked source/test diff. LF-to-CRLF working-copy warnings only.
- `rg -n "package-format|@private-2d-rigging-lab/package|RuntimeExport|Runtime Export" packages/runtime-core/src`
  - No runtime-core package-format or Runtime Export DTO import found; only dependency-boundary test regex matched.
- `pnpm.cmd exec vitest run packages/runtime-core/src/runtime-core.test.ts packages/runtime-core/src/snapshot-static-templates.test.ts packages/runtime-core/src/texture-projection.test.ts packages/runtime-core/src/runtime-keyform-snapshot-integration.test.ts packages/runtime-core/src/rig-control-opacity-keyform-state.test.ts packages/runtime-core/src/keyform-target-application.test.ts packages/runtime-core/src/dependency-boundary.test.ts`
  - Passed: 7 files / 27 tests.
  - Run with escalation because Vitest/esbuild process spawning had previously failed in sandbox with EPERM.
- `pnpm.cmd typecheck`
  - Passed.
  - Run with escalation because the TypeScript toolchain may spawn processes or access caches outside the sandbox.
- `node scripts/check-source-organization.mjs`
  - Passed.
- `git diff --check -- packages/runtime-core/src discussion/runtime-player/implementation/waves/wave16 discussion/runtime-player/implementation/reviews/wave16`
  - Passed with LF-to-CRLF working-copy warnings only.

`pnpm install` was not run.

## Profiling / Domain E Interpretation Assessment

Domain B preserved the profiling fields needed by Performance Diagnostics. The key interpretation change is documented: in compiled runtime-core evaluation, `runtimeCoreDrawableSnapshotCreationDurationMs` now measures per-frame DTO materialization/finalization from compiled templates, not one-time graph-to-template construction. `runtimeCoreMaskEvaluationDurationMs` similarly measures fresh mask DTO materialization from compiled topology templates in the compiled path.

This is acceptable for Domain B. Domain E should use the Domain B report interpretation when comparing real Browser Source diagnostics, especially because Domain D is still required before Runtime Player benefits from compiled templates.

## Remaining Risks / Follow-Up

- Domain B does not move deformer hierarchy/effect-chain topology out of the frame path. That remains Domain C.
- Final DTO materialization still allocates fresh public objects and arrays by design. If this remains too costly after Domains C-D, Wave17 should consider typed/render-buffer or direct render-scene output on top of the compiled evaluator foundation.
- Runtime Player is not connected to `CompiledRuntimeModel` yet. Domain D must ensure Native Stage and Browser Source own separate mutable `RuntimeModelInstance`s.
- Domain C should include compiled-path rig/deformer tests, including reference/base vertex stream behavior and previous-snapshot non-mutation around transformed vertices.

## Domain C Gate

Domain C may proceed.
