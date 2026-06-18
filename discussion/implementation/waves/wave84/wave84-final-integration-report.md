# Wave84 Final Integration Report

## Status

- Wave: Wave84 `viewer-runtime-dynamics-playback-solver-consolidation`.
- Domain: `wave84-final-integration-clean-review-map-closeout`.
- Status: final complete / pass.
- Current phase at closeout: final report / map closeout complete.
- Domain A: pass after fix loop 1.
- Domain B: pass.
- Final clean review: `discussion/implementation/reviews/wave84/wave84-final-clean-integration-review.md`, verdict `pass`.

## Basis Documents Used

- `discussion/implementation/orchestration/wave84-plan.md`
- `discussion/implementation/waves/wave84/wave84-domain-a-viewer-dynamics-playback-solver-consolidation-report.md`
- `discussion/implementation/reviews/wave84/wave84-domain-a-spec-compliance-review.md`
- `discussion/implementation/reviews/wave84/wave84-domain-a-design-development-review.md`
- `discussion/implementation/reviews/wave84/wave84-domain-a-test-adequacy-review.md`
- `discussion/implementation/reviews/wave84/wave84-final-clean-integration-review.md`
- `discussion/implementation/reviews/wave84/_map.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`

## Domain A Pass Evidence

- Domain A report exists and records `done / implementation complete`.
- Domain A Spec Compliance Review exists and records `pass`.
- Domain A Design / Development Compliance Review exists and records `pass` after fix loop 1.
- Domain A Test Adequacy Review exists and records `pass` after fix loop 1 delta re-review.
- Domain A fix loop 1 resolved stale Viewer runtime simulation state across project/session changes by adding package identity compatibility checks and clearing incompatible runtime state.
- Domain A review map records Domain A `pass after fix loop 1`.

## Final Clean Review

- Final clean Review-Sylph artifact: `discussion/implementation/reviews/wave84/wave84-final-clean-integration-review.md`.
- Verdict: `pass`.
- Findings: none blocking, needs-change, or escalation.
- Fix loop required by Domain B: none.
- Reviewer confirmed source/test behavior from basis documents, current diff, line-referenced source review, and guard results rather than relying only on implementer summaries.

## Integrated Behavior

### Solver Ownership / Dependency Decision

- `packages/runtime-core` owns Dynamics stepping, output offset calculation, additive parameter resolution, and runtime frame evaluation primitives.
- `apps/editor` owns Viewer UI, rAF scheduling, Runtime Controls state, reset affordance, and session-local mutable runtime state.
- `apps/editor` now has a direct local workspace dependency on `@private-2d-rigging-lab/runtime-core`.
- `authoring-core` remains an authoring graph / authoring-to-runtime conversion owner and does not own physical simulation formulas.
- No external dependency was added.

### Viewer Runtime Playback Behavior

- Viewer builds a runtime playback model from the current authoring session via the existing runtime graph conversion path.
- While the Viewer is mounted and enabled Dynamics Groups exist, a browser-frame loop advances runtime-core Dynamics state using clamped elapsed time and fixed substeps.
- Runtime Controls authored/base values feed runtime-core frame evaluation as inputs.
- Runtime-core effective parameter values are passed to existing Clean Stage / Canvas projection before keyform/deformer evaluation.
- Driver values can stop changing while pendulum motion continues and converges through runtime state.
- Viewer runtime state is checked against package id, revision, and hash so incompatible state is discarded on project/session/runtime package changes.

### Reset Simulation Behavior

- Viewer exposes a minimal `Reset simulation` affordance under `Motion / Physics` when Dynamics exists.
- Reset creates a fresh runtime state for mutable simulation fields such as angle, angular velocity, previous source, previous source velocity, tick, and reset counter.
- Reset keeps Runtime Controls overrides and authored data unchanged.
- Reset writes only React/session-local runtime state and does not persist simulation state.

### Runtime Controls Output Exclusion

- Parameters used as Dynamics outputs are excluded from Viewer Runtime Controls projection, editability, override normalization, direct override updates, and runtime value map creation.
- Driver/input parameters remain visible and editable.
- Output exclusion applies to authored/preset parameters used as Dynamics outputs.
- Runtime Controls do not show output meters, moving read-only output sliders, play/pause controls, frame stepping, or raw solver diagnostics.
- Output ids are excluded broadly for Dynamics Groups, including disabled groups, under the accepted "used as output" policy.

### Editor Preview Parity / Migration Evidence

- Dynamics Tool preview no longer owns an independent pendulum physics formula.
- The remaining Editor preview helper is a UI/session adapter that clamps/splits elapsed time and delegates stepping to runtime-core `stepDynamics(...)`.
- Preview output summaries use runtime-core `computeDynamicsOutputOffsets(...)`.
- Focused tests cover representative parity with runtime-core stepping, continued preview motion, reset behavior, Quick Tune preview, and Quick Tune commit behavior.

### Persistence / History Non-Mutation Evidence

- Viewer playback ticks update React `RuntimeStateDto` state only.
- Viewer reset updates React runtime simulation state only.
- Runtime Controls overrides remain session-local.
- No package-format schema, portable save/load path, operation payload/schema, or authoring-core persistence source was changed.
- Focused tests and source review cover reset without dirtying the session and projection/runtime controls without authored value mutation.
- Dynamics Tool Quick Tune committed edits continue to use the existing operation-backed path.

## Forbidden Scope Compliance

Confirmed by Domain A review lanes, final clean review, diff scope, source review, dependency guard, and targeted checks:

- No `dynamics-file-v2` schema change.
- No save/load format change.
- No operation payload/schema change.
- No frame stepping, play/pause transport, timeline, camera input, or external motion transport.
- No output meter, moving read-only output slider, or raw Viewer solver diagnostic UI.
- No multi-pendulum, multi-output, same-output mixer, or same-output additive blending.
- No `authoring-core` physics solver ownership.
- No mesh generation, mesh/deformer/keyform authoring behavior change unrelated to effective parameter evaluation.
- No persistent WebGL cache architecture change.
- No Cubism SDK/runtime/export compatibility work.
- No new external dependency.

## Verification Performed

Passed:

- `pnpm.cmd typecheck`
- Focused Vitest after sandbox `esbuild spawn EPERM` and approved rerun:
  - `apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts`
  - `apps/editor/src/workspace/viewer/runtime-controls-state.test.ts`
  - `apps/editor/src/features/editor-session/model/dynamics-tool-state.test.ts`
  - `apps/editor/src/workspace/panels/dynamics-tool-inspector.test.ts`
  - `packages/runtime-core/src/dynamics-evaluation.test.ts`
  - `packages/runtime-core/src/parameter-resolution.test.ts`
  - `packages/runtime-core/src/viewer-evaluation.test.ts`
  - `packages/runtime-core/src/runtime-core.test.ts`
  - Result: 8 files / 55 tests passed.
- `node scripts/check-source-organization.mjs`
- `node scripts/check-dependencies.mjs`
- `git diff --check`
  - Result: passed with LF-to-CRLF normalization warnings only.

Setup / rerun notes:

- Initial `pnpm.cmd typecheck` failed because `node_modules` lacked TypeScript.
- Dependencies were repaired with approved `pnpm.cmd install --frozen-lockfile --prefer-offline --force`; lockfile resolution was already up to date.
- Initial focused Vitest failed before test execution due to sandbox `esbuild spawn EPERM`; the approved rerun passed.

Not run:

- Browser/manual visual QA for real Canvas motion smoothness, pointer/slider feel, or real rAF cadence.
- Persistence roundtrip tests, because package-format, authoring persistence, save/load, and operation payload/schema files were not changed.

## Children Started And Closed

- Final clean Review-Sylph: `019edc65-a682-76f1-96c1-ffe6b1d34e69`; completed; waited; verdict `pass`; closed.

## Fix Loops

- Domain B fix loops: none.

## Files Changed By Domain B

- `discussion/implementation/waves/wave84/wave84-final-integration-report.md`
- `discussion/implementation/waves/wave84/_map.md`
- `discussion/implementation/reviews/wave84/wave84-final-clean-integration-review.md`
- `discussion/implementation/reviews/wave84/_map.md`
- `discussion/implementation/_map.md`
- `discussion/implementation/orchestration/_map.md`

## Residual Risks

- No browser/manual visual QA was run for perceived Canvas motion smoothness, real pointer/slider feel, or real rAF cadence.
- Viewer uses runtime-core effective parameter values but still renders through the existing Editor Canvas projection rather than runtime-core drawable snapshots; this is accepted for Wave84 but remains a future unification risk.
- Runtime Controls output exclusion includes disabled Dynamics Groups under the accepted "used as Dynamics output" rule; a future UX decision could choose to release controls for disabled groups.
- Larger real projects may need later performance profiling for Viewer per-frame runtime evaluation.

## User Decision Points

- None blocking Wave84 closeout.

## Final Gate

Wave84 `viewer-runtime-dynamics-playback-solver-consolidation` is final complete / pass. Domain A reports and review lanes pass, Domain B verification passed, final clean integration review records `pass`, no Domain B fix loop was required, and maps are updated to final complete / pass.
