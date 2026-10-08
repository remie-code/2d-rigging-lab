# Runtime Player Wave16 Domain C: Compiled Rig / Deformer Topology

- Verdict recommendation: pass
- Domain: Compiled Rig / Deformer Topology
- Agent: Gnome
- Date: 2026-06-26

## Scope

Moved graph-topology-only rig/deformer hierarchy work into runtime-core's compiled model while preserving legacy `evaluateRuntimeFrame(...)` compatibility and per-frame rig/deformer semantics.

This domain did not implement Runtime Player integration, Runtime Export format changes, Editor changes, dependencies, lockfile changes, final render-buffer output, or typed-array rewrites.

## Files Changed

Domain C source/test/report changes:

- `packages/runtime-core/src/rig-control-hierarchy.ts`
- `packages/runtime-core/src/rig-control-evaluation.ts`
- `packages/runtime-core/src/runtime-model.ts`
- `packages/runtime-core/src/runtime-core.ts`
- `packages/runtime-core/src/snapshot.ts`
- `packages/runtime-core/src/rig-control-compiled-topology.test.ts`
- `discussion/runtime-player/implementation/waves/wave16/domain-c-compiled-rig-deformer-topology-report.md`

Pre-existing accepted Domain A/B and orchestration working-tree files were not reverted or overwritten.

## Implementation Summary

Compiled model ownership:

- `CompiledRuntimeModel` now builds one `RigControlTopologyEvaluation` at `compileRuntimeModel(graph)` time.
- Each `RuntimeModelInstance` passes the compiled topology through the internal compiled frame evaluator.
- Legacy/transient `evaluateRuntimeFrame(...)` still works without compiled artifacts by building transient topology inside the frame path.

Compiled rig/deformer topology now owns:

- parent-before-child ordered rig-control IDs;
- descendant rig-control IDs by rig ID;
- declared child drawable IDs by rig ID;
- hierarchy blocked rig-control IDs and topology diagnostics;
- affected drawable IDs by rig ID;
- direct drawable parent candidate order;
- effect-chain rig-control ID lookup.

Frame-local evaluation remains frame-local:

- rig-control keyform samples and parameter values;
- rotation/warp local state and world transforms;
- dynamic `evaluationStatus` from invalid keyform patches or invalid warp lattice state;
- direct drawable parent final selection when a candidate is frame-blocked;
- opacity multiplication and final vertex transforms;
- transformed vertices, bounds, and vertex hashes.

## Invalid / Blocked Behavior

The final direct drawable parent map is intentionally not compiled as a fixed first-wins map.

Existing behavior chooses the first non-blocked rig control for a drawable, and `blocked` can be frame-dependent when rig keyform patches or warp state are invalid. Domain C therefore compiles the candidate order only, then selects the final parent each frame using evaluated rig-control status.

This preserves the case where an earlier direct-parent candidate becomes blocked in a frame and a later candidate may become the active parent without producing a duplicate-parent diagnostic.

## Snapshot Freshness

- Compiled topology is internal and not exposed as public snapshot DTO state.
- Hierarchy diagnostics from compiled topology are cloned before being appended to frame diagnostics.
- Transformed vertices are still freshly materialized per frame.
- No final deformed vertices are cached in the compiled model.
- Public snapshot DTO shape is unchanged.

## Profiling Phase Interpretation

`runtimeCoreDeformerHierarchyEvaluationDurationMs` remains present and meaningful.

Compiled-path meaning after Domain C:

- measures per-frame rig-control sample grouping, evaluated rig-control state construction, frame-dependent direct parent selection, opacity/effect-chain application, and drawable transform application;
- excludes one-time graph hierarchy ordering, descendant/declaration lookup construction, affected drawable lookup construction, direct parent candidate construction, and effect-chain ID lookup construction.

Legacy/transient path meaning:

- still includes transient topology construction because no compiled model owns the topology.

Nested `runtimeCoreWarpDeformerVertexTransformDurationMs` and `runtimeCoreRotationDeformerVertexTransformDurationMs` remain per-frame vertex transform measurements.

Domain E should use this interpretation when comparing Browser Source diagnostics after Runtime Player connects to the compiled evaluator.

## Verification

- `pnpm.cmd exec vitest run packages/runtime-core/src/rig-control-compiled-topology.test.ts`
  - Passed: 1 file / 2 tests.
  - Run with escalation because Vitest/Vite spawns esbuild child processes that have previously failed in sandbox with `EPERM`.
- `pnpm.cmd typecheck`
  - Passed.
- `pnpm.cmd exec vitest run packages/runtime-core/src/rig-control-nested-warp-rest-bind-semantics.test.ts packages/runtime-core/src/rig-control-hierarchy-evidence.test.ts packages/runtime-core/src/rig-control-keyform-evidence.test.ts packages/runtime-core/src/rig-control-opacity-keyform-state.test.ts packages/runtime-core/src/rig-control-compiled-topology.test.ts packages/runtime-core/src/runtime-core.test.ts packages/runtime-core/src/snapshot-static-templates.test.ts packages/runtime-core/src/dependency-boundary.test.ts`
  - Passed: 8 files / 40 tests.
  - Run with escalation for the same Vitest/esbuild process-spawn reason.
- `node scripts/check-source-organization.mjs`
  - Passed.
- `git diff --check -- packages/runtime-core/src/runtime-core.ts packages/runtime-core/src/snapshot.ts packages/runtime-core/src/rig-control-hierarchy.ts packages/runtime-core/src/rig-control-evaluation.ts`
  - Passed for tracked files with LF-to-CRLF working-copy warnings only.
- `git diff --no-index --check -- NUL <new-or-untracked Domain C files>`
  - Checked `packages/runtime-core/src/runtime-model.ts`, `packages/runtime-core/src/rig-control-compiled-topology.test.ts`, and this report.
  - No whitespace findings; commands returned normal no-index diff status with LF-to-CRLF warnings only.

Focused test evidence added:

- compiled output deep-equals legacy/transient output for a deterministic nested rotation + warp deformer scenario;
- compiled topology reuse still samples rig-control keyforms per frame and changes output between parameter values;
- previous transformed-vertex snapshots remain unchanged after later evaluations;
- mutating a previous public vertex array does not affect a later compiled frame;
- frame-blocked direct parent selection remains compatible with legacy behavior.

`pnpm install` was not run.

## Residual Risks / Follow-Up

- Runtime Player is not connected to `CompiledRuntimeModel` yet. Domain D must create target-local `RuntimeModelInstance`s for Native Stage and Browser Source.
- `runtimeCoreDeformerHierarchyEvaluationDurationMs` will not improve in Runtime Player until Domain D uses the compiled evaluator.
- The compiled model still stores the supplied `NormalizedRuntimeGraph` reference from the Domain A shell. Domain C adds immutable topology artifacts but does not deep-freeze the entire graph.
- Direct parent final selection intentionally remains per-frame because frame-dependent blocked status affects semantics.

## Source Organization

- No new production source file was added.
- `rig-control-hierarchy.ts` remains the focused owner of rig topology construction.
- `rig-control-compiled-topology.test.ts` is a focused regression test for compiled rig/deformer topology.
- No source organization exception is requested.
