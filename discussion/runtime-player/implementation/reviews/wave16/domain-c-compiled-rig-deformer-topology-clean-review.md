# Runtime Player Wave16 Domain C Clean Review: Compiled Rig / Deformer Topology

- Verdict: pass
- Domain: Compiled Rig / Deformer Topology
- Reviewer: Review-Sylph
- Date: 2026-06-26
- Domain D may proceed: yes

## Scope Reviewed

Reviewed whether Domain C safely moved graph-topology-only rig/deformer hierarchy work into runtime-core's compiled model while preserving rig/deformer semantics, snapshot DTO compatibility, runtime-core dependency boundaries, and Wave16 domain boundaries.

This review did not edit source implementation files.

## Basis Documents Used

- `discussion/runtime-player/implementation/orchestration/player-wave16-plan.md`
- `discussion/runtime-player/implementation/waves/wave16/domain-a-runtime-core-compiled-api-shell-report.md`
- `discussion/runtime-player/implementation/reviews/wave16/domain-a-runtime-core-compiled-api-shell-clean-review.md`
- `discussion/runtime-player/implementation/waves/wave16/domain-b-compiled-snapshot-static-templates-report.md`
- `discussion/runtime-player/implementation/reviews/wave16/domain-b-compiled-snapshot-static-templates-clean-review.md`
- `discussion/runtime-player/implementation/waves/wave15/wave15-final-integration-report.md`
- `tmp/report.log`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/runtime-player/implementation/waves/wave16/domain-c-compiled-rig-deformer-topology-report.md`
- `discussion/_conventions.md`
- `discussion/_map.md`

## Changed Files Reviewed

- `packages/runtime-core/src/rig-control-hierarchy.ts`
- `packages/runtime-core/src/rig-control-evaluation.ts`
- `packages/runtime-core/src/runtime-model.ts`
- `packages/runtime-core/src/runtime-core.ts`
- `packages/runtime-core/src/snapshot.ts`
- `packages/runtime-core/src/rig-control-compiled-topology.test.ts`
- `discussion/runtime-player/implementation/waves/wave16/domain-c-compiled-rig-deformer-topology-report.md`

Context spot-checks:

- `packages/runtime-core/src/snapshot-static-templates.ts`
- `packages/runtime-core/src/snapshot-static-templates.test.ts`
- `packages/runtime-core/src/runtime-core.test.ts`
- `packages/runtime-core/src/dependency-boundary.test.ts`
- `packages/runtime-core/src/rig-control-warp-lattice.ts`
- existing focused rig-control evidence tests covered by verification

## Findings

No blocking or non-blocking implementation findings.

## Rubric Assessment

| Rubric item | Result | Evidence |
|---|---|---|
| Compiled topology contains only graph-topology-safe data | Pass | Compiled artifacts contain snapshot static templates and `RigControlTopologyEvaluation`; rig topology is limited to hierarchy, affected drawable IDs, direct parent candidates, and effect-chain IDs. See `packages/runtime-core/src/runtime-model.ts:66`, `packages/runtime-core/src/runtime-model.ts:78`, `packages/runtime-core/src/runtime-model.ts:79`, `packages/runtime-core/src/rig-control-hierarchy.ts:21`, and `packages/runtime-core/src/rig-control-hierarchy.ts:55`. |
| Compiled data does not cache final deformed vertices, per-frame samples, parameter/keyform values, opacity, dynamics state, or mutable runtime instance state | Pass | Compiled topology is built from graph hierarchy only; per-frame parameter/keyform sampling still occurs in snapshot creation, and transformed vertices are computed inside frame rig evaluation. See `packages/runtime-core/src/snapshot.ts:196`, `packages/runtime-core/src/snapshot.ts:204`, `packages/runtime-core/src/snapshot.ts:244`, `packages/runtime-core/src/rig-control-evaluation.ts:97`, `packages/runtime-core/src/rig-control-evaluation.ts:130`, and `packages/runtime-core/src/rig-control-evaluation.ts:390`. |
| Per-frame rig-control samples/keyforms still drive different outputs in compiled instances | Pass | Samples are grouped from current frame input before evaluation, not compiled. The new compiled topology test proves frame 1 and frame 2 compiled outputs match legacy and differ by sampled parent rotation and vertices. See `packages/runtime-core/src/rig-control-evaluation.ts:97`, `packages/runtime-core/src/rig-control-compiled-topology.test.ts:76`, `packages/runtime-core/src/rig-control-compiled-topology.test.ts:77`, `packages/runtime-core/src/rig-control-compiled-topology.test.ts:79`, and `packages/runtime-core/src/rig-control-compiled-topology.test.ts:81`. |
| Nested warp rest/bind semantics are protected | Pass | The existing nested warp rest/bind test suite was rerun and passed. The transform path still applies warp lattice using current and reference vertices per frame. See `packages/runtime-core/src/rig-control-evaluation.ts:489`, `packages/runtime-core/src/rig-control-evaluation.ts:539`, and `packages/runtime-core/src/rig-control-nested-warp-rest-bind-semantics.test.ts:30`. |
| Disabled/invalid rig-control diagnostics remain unchanged | Pass | Compiled hierarchy diagnostics are cloned before frame diagnostics are appended, and invalid warp keyform behavior remains evaluated per frame. The new test covers the frame-blocked invalid patch path and expects the same diagnostic. See `packages/runtime-core/src/rig-control-evaluation.ts:100`, `packages/runtime-core/src/rig-control-evaluation.ts:634`, `packages/runtime-core/src/rig-control-warp-lattice.ts:153`, and `packages/runtime-core/src/rig-control-compiled-topology.test.ts:120`. |
| Frame-dependent blocked behavior and direct drawable parent selection remain compatible with legacy/transient evaluation | Pass | Compiled data stores candidate order, then final parent selection skips frame-blocked evaluated rig controls at frame time. The focused test verifies a blocked first parent falls through to the later parent and remains equal to legacy. See `packages/runtime-core/src/rig-control-hierarchy.ts:63`, `packages/runtime-core/src/rig-control-evaluation.ts:427`, `packages/runtime-core/src/rig-control-evaluation.ts:441`, `packages/runtime-core/src/rig-control-compiled-topology.test.ts:95`, and `packages/runtime-core/src/rig-control-compiled-topology.test.ts:126`. |
| Transformed-vertex snapshots remain fresh and previous frame snapshots are not mutated | Pass | Vertex transforms are freshly produced during frame evaluation, and the new test snapshots the first result, evaluates later frames, mutates previous public vertices, and confirms later compiled output is unaffected. See `packages/runtime-core/src/rig-control-evaluation.ts:390`, `packages/runtime-core/src/rig-control-evaluation.ts:644`, `packages/runtime-core/src/rig-control-compiled-topology.test.ts:58`, `packages/runtime-core/src/rig-control-compiled-topology.test.ts:78`, `packages/runtime-core/src/rig-control-compiled-topology.test.ts:83`, and `packages/runtime-core/src/rig-control-compiled-topology.test.ts:92`. |
| Legacy `evaluateRuntimeFrame(...)` remains compatible and snapshot DTO shape is unchanged | Pass | Public `evaluateRuntimeFrame` remains the legacy entrypoint and delegates internally; `RuntimeSnapshotSchema` remains `runtime-snapshot-v1`. Compiled-vs-legacy deep equality is asserted in runtime-core and Domain C tests. See `packages/runtime-core/src/runtime-core.ts:82`, `packages/runtime-core/src/runtime-core.ts:90`, `packages/runtime-core/src/snapshot.ts:142`, `packages/runtime-core/src/snapshot.ts:143`, and `packages/runtime-core/src/rig-control-compiled-topology.test.ts:76`. |
| Runtime-core dependency boundary remains intact | Pass | Runtime-core imports remain contracts/local runtime-core modules; forbidden package-format/import boundary scan only found the dependency-boundary test regex, and the dependency-boundary test passed. See `packages/runtime-core/src/dependency-boundary.test.ts:12`. |
| No Runtime Player connection work leaked into Domain C except strict compile/type plumbing | Pass | `git status --short -uall` showed Domain C source/test/report changes under runtime-core and discussion reports only, with no `apps/runtime-player` source changes. Runtime Player connection remains documented as Domain D work. See `discussion/runtime-player/implementation/waves/wave16/domain-c-compiled-rig-deformer-topology-report.md:118`. |
| No Editor/Runtime Export format/dependency/lockfile changes | Pass | Working tree status did not show Editor, Runtime Export/package-format, dependency manifest, or lockfile changes. `pnpm install` was not run. |
| Profiling phase names remain meaningful and Domain C report documents Domain E interpretation | Pass | `deformerHierarchyEvaluationDurationMs` still wraps rig-control evaluation, while nested vertex transform phases remain per-frame. The Domain C report documents the compiled-path interpretation for Domain E. See `packages/runtime-core/src/snapshot.ts:242`, `packages/runtime-core/src/rig-control-evaluation.ts:517`, `packages/runtime-core/src/rig-control-evaluation.ts:539`, and `discussion/runtime-player/implementation/waves/wave16/domain-c-compiled-rig-deformer-topology-report.md:71`. |
| Test coverage is adequate for Domain C risks | Pass | Coverage includes compiled-vs-legacy nested rotation/warp equality, per-frame keyform changes, previous snapshot non-mutation, frame-blocked direct parent fallback, nested warp rest/bind semantics, hierarchy evidence, rig keyform evidence, opacity keyform state, runtime-core compiled API/static templates, and dependency boundary. |

## Verification Commands Run

- `git status --short -uall`
  - Reviewed working tree. Domain C changes are mixed with accepted Domain A/B untracked/modified baseline files; no app, editor, package-format, dependency manifest, or lockfile changes appeared.
- `git diff -- packages/runtime-core/src/rig-control-hierarchy.ts packages/runtime-core/src/rig-control-evaluation.ts packages/runtime-core/src/runtime-core.ts packages/runtime-core/src/snapshot.ts`
  - Reviewed the requested tracked diff. LF-to-CRLF working-copy warnings only.
- `rg -n "package-format|@private-2d-rigging-lab/package|RuntimeExport|Runtime Export|runtime-player|RuntimePlayer" packages/runtime-core/src`
  - No runtime-core Runtime Export/package-format import found; only the dependency-boundary test regex matched.
- `pnpm.cmd exec vitest run packages/runtime-core/src/rig-control-nested-warp-rest-bind-semantics.test.ts packages/runtime-core/src/rig-control-hierarchy-evidence.test.ts packages/runtime-core/src/rig-control-keyform-evidence.test.ts packages/runtime-core/src/rig-control-opacity-keyform-state.test.ts packages/runtime-core/src/rig-control-compiled-topology.test.ts packages/runtime-core/src/runtime-core.test.ts packages/runtime-core/src/snapshot-static-templates.test.ts packages/runtime-core/src/dependency-boundary.test.ts`
  - Passed: 8 files / 40 tests.
  - Run with escalation because Vitest/Vite uses esbuild child process spawning, which is known to fail in this sandbox.
- `pnpm.cmd typecheck`
  - Passed.
  - Run with escalation because the compiler/toolchain may spawn processes or access caches outside the restricted sandbox.
- `node scripts/check-source-organization.mjs`
  - Passed.
- `git diff --check -- packages/runtime-core/src/rig-control-hierarchy.ts packages/runtime-core/src/rig-control-evaluation.ts packages/runtime-core/src/runtime-core.ts packages/runtime-core/src/snapshot.ts`
  - Passed for tracked Domain C source diffs with LF-to-CRLF working-copy warnings only.
- `git diff --no-index --check -- NUL packages/runtime-core/src/runtime-model.ts`
  - No whitespace findings; LF-to-CRLF warning only.
- `git diff --no-index --check -- NUL packages/runtime-core/src/rig-control-compiled-topology.test.ts`
  - No whitespace findings; LF-to-CRLF warning only.
- `git diff --no-index --check -- NUL discussion/runtime-player/implementation/waves/wave16/domain-c-compiled-rig-deformer-topology-report.md`
  - No whitespace findings; LF-to-CRLF warning only.

`pnpm install` was not run.

## Test Adequacy Assessment

Adequate for Domain C risk.

The new focused test directly covers the highest-risk compiled topology behaviors: legacy/transient deep equality for nested rotation plus warp deformation, frame-to-frame rig keyform sampling, previous transformed-vertex snapshot freshness, mutation isolation for public vertex arrays, and frame-blocked direct parent fallback. Existing focused suites cover nested warp rest/bind semantics, hierarchy diagnostics, rig-control keyform diagnostics, opacity keyform state, static template freshness, API shell compatibility, and dependency boundaries.

## Remaining Risks / Follow-Up

- Runtime Player still does not use `CompiledRuntimeModel`; Domain D must connect it and keep Native Stage and Browser Source on separate mutable `RuntimeModelInstance`s.
- The compiled model still retains the supplied `NormalizedRuntimeGraph` reference inherited from Domain A/B. Domain C compiles immutable topology artifacts but does not deep-freeze the entire graph.
- Real Browser Source performance improvement remains unverified until Domain D integration and Domain E diagnostics.

## User-Decision Points

None.

## Domain D Gate

Domain D may proceed.
