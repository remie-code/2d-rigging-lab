# Wave84 Final Clean Integration Review

## Verdict

pass

## Scope Reviewed

This review checked Wave84 after Domain A pass classification and Domain B verification. I reviewed the plan, Domain A report, all three Domain A review lanes, the Wave84 review map, source/dependency policies, the current worktree diff, the new Viewer playback adapter, touched Viewer Runtime Controls and Dynamics Tool preview code, focused tests, and lightweight guard results.

Basis documents used:

- `discussion/implementation/orchestration/wave84-plan.md`
- `discussion/implementation/waves/wave84/wave84-domain-a-viewer-dynamics-playback-solver-consolidation-report.md`
- `discussion/implementation/reviews/wave84/wave84-domain-a-spec-compliance-review.md`
- `discussion/implementation/reviews/wave84/wave84-domain-a-design-development-review.md`
- `discussion/implementation/reviews/wave84/wave84-domain-a-test-adequacy-review.md`
- `discussion/implementation/reviews/wave84/_map.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`

Primary source/tests reviewed:

- `apps/editor/package.json`
- `pnpm-lock.yaml`
- `apps/editor/src/workspace/viewer/viewer-runtime-playback.ts`
- `apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx`
- `apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts`
- `apps/editor/src/workspace/viewer/runtime-controls-state.ts`
- `apps/editor/src/workspace/viewer/runtime-controls-state.test.ts`
- `apps/editor/src/workspace/viewer/runtime-controls.tsx`
- `apps/editor/src/features/editor-session/model/dynamics-tool-state.ts`
- `apps/editor/src/features/editor-session/model/dynamics-tool-state.test.ts`
- `apps/editor/src/workspace/panels/dynamics-tool-inspector.test.ts`
- `packages/runtime-core/src/dynamics-evaluation.ts`
- `packages/runtime-core/src/dynamics-evaluation.test.ts`
- `packages/runtime-core/src/parameter-resolution.ts`
- `packages/runtime-core/src/parameter-resolution.test.ts`
- `packages/runtime-core/src/runtime-core.ts`
- `packages/runtime-core/src/initial-state.ts`
- `packages/runtime-core/src/snapshot.ts`
- `packages/authoring-core/src/to-runtime-graph.ts`
- `packages/authoring-core/src/runtime-graph-dynamics.ts`

## Findings

No blocking, needs-change, or escalation findings.

## Acceptance Coverage Notes

- Solver ownership / dependency decision: pass. Wave84 explicitly accepts `runtime-core` as owner for Dynamics solver, additive parameter resolution, and runtime frame primitives, with `apps/editor` owning UI/rAF/session-local state (`discussion/implementation/orchestration/wave84-plan.md:67`, `:71`, `:80`). The implementation adds only a local workspace dependency from Editor to `@private-2d-rigging-lab/runtime-core` (`apps/editor/package.json:13`, `:19`; `pnpm-lock.yaml:27`, `:44`) and imports solver/evaluation helpers from that package (`apps/editor/src/workspace/viewer/viewer-runtime-playback.ts:10`, `:15`; `apps/editor/src/features/editor-session/model/dynamics-tool-state.ts:8`, `:12`).
- `authoring-core` remains adapter-only for Dynamics runtime graph conversion. `toRuntimeGraph(...)` delegates to named runtime graph adapters (`packages/authoring-core/src/to-runtime-graph.ts:21`, `:40`), and `createRuntimeDynamicsGroupMap(...)` copies group/input/pendulum/output fields without implementing stepping formulas (`packages/authoring-core/src/runtime-graph-dynamics.ts:5`, `:42`).
- Viewer runtime playback: pass. The Viewer playback model is built from the authoring session via `toRuntimeGraph(...)`, records Dynamics output ids, enabled group count, and a package identity key (`apps/editor/src/workspace/viewer/viewer-runtime-playback.ts:43`, `:59`). Frame evaluation clamps elapsed time, calls `evaluateRuntimeFrame(...)`, and returns runtime-core effective parameters (`apps/editor/src/workspace/viewer/viewer-runtime-playback.ts:76`, `:119`). Viewer rAF advances session-local `RuntimeStateDto` and cancels on cleanup (`apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx:144`, `:188`).
- Project/session stale-state guard: pass. Playback rejects incompatible previous state by package id/revision/hash (`apps/editor/src/workspace/viewer/viewer-runtime-playback.ts:122`, `:128`), the screen filters incompatible state before projection and rAF advancement (`apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx:101`, `:105`; `:166`, `:178`), and it clears mutable simulation state when the model identity changes (`apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx:190`, `:192`). The regression test covers a reused Dynamics Group id across projects (`apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts:378`, `:432`).
- Time progression and continued motion: pass. Runtime-core stepping owns the pendulum formula and state transition (`packages/runtime-core/src/dynamics-evaluation.ts:75`, `:122`), runtime frame advancement substeps enabled groups (`packages/runtime-core/src/runtime-core.ts:120`, `:154`), and Viewer tests cover advancing frames plus convergence after held driver input (`apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts:266`, `:305`; `packages/runtime-core/src/dynamics-evaluation.test.ts:58`, `:118`).
- Dynamics output injection before keyform/deformer evaluation: pass. Viewer builds base values from authoring values plus normalized Runtime Controls overrides, resolves runtime effective values, and passes them to Clean Stage projection (`apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx:232`, `:263`; `apps/editor/src/workspace/viewer/viewer-clean-stage.ts:40`, `:50`). Runtime snapshots resolve effective parameters before keyform sampling (`packages/runtime-core/src/snapshot.ts:174`, `:182`). Focused tests prove an output override is dropped, the runtime Dynamics output becomes effective, and Clean Stage bounds move through keyform evaluation (`apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts:308`, `:343`).
- Reset simulation: pass. Viewer reset creates a fresh runtime state from current base inputs and only calls React `setRuntimePlaybackState(...)` (`apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx:129`, `:142`; `apps/editor/src/workspace/viewer/viewer-runtime-playback.ts:62`, `:74`). Initial runtime state resets angle, angular velocity, previous source, previous source velocity, tick, and reset counter (`packages/runtime-core/src/initial-state.ts:11`, `:43`). Tests confirm Runtime Controls overrides remain and `session.dirty` is false (`apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts:346`, `:375`).
- Runtime Controls output exclusion: pass. Runtime Controls filter options exclude Dynamics output ids from editability, row projection, override normalization, direct override updates, and runtime value maps (`apps/editor/src/workspace/viewer/runtime-controls-state.ts:62`, `:67`; `:82`, `:106`; `:108`, `:141`; `:144`, `:191`; `:222`, `:241`). Tests cover authored output exclusion, driver retention, ignored direct output overrides, and no output rows/meters (`apps/editor/src/workspace/viewer/runtime-controls-state.test.ts:53`, `:90`; `:221`, `:247`).
- Reset affordance / no transport controls: pass. Runtime Controls renders editable parameter rows from projection and a minimal `Motion / Physics` footer with `Reset simulation` only when Dynamics exists (`apps/editor/src/workspace/viewer/runtime-controls.tsx:121`, `:167`). Tests assert the configured Dynamics footer contains `Reset simulation` and does not contain Play/Pause controls (`apps/editor/src/workspace/viewer/runtime-controls-state.test.ts:367`, `:394`).
- Editor preview parity / migration: pass. `dynamics-tool-state.ts` imports `stepDynamics(...)` and `computeDynamicsOutputOffsets(...)` from runtime-core, and the remaining `stepDynamicsToolPreview(...)` helper clamps/splits UI elapsed time around runtime-core calls rather than owning an independent formula (`apps/editor/src/features/editor-session/model/dynamics-tool-state.ts:8`, `:12`; `:577`, `:620`; `:808`, `:860`). Output summary also uses runtime-core offsets with local UI clamping only (`apps/editor/src/features/editor-session/model/dynamics-tool-state.ts:862`, `:890`). Tests cover preview stepping, direct parity with `stepDynamics(...)`, continued motion, Quick Tune preview behavior, and session-local reset (`apps/editor/src/features/editor-session/model/dynamics-tool-state.test.ts:161`, `:221`; `:259`, `:383`).
- Additive runtime parameter semantics: pass. Runtime-core resolves effective values as `baseValue + dynamicsOffset`, clamps afterward, and ignores duplicate same-output ownership by withholding an enabled group for duplicate output ids (`packages/runtime-core/src/parameter-resolution.ts:37`, `:79`; `:81`, `:105`). Tests assert base `0.4`, offset `0.25`, and effective `0.65` (`packages/runtime-core/src/parameter-resolution.test.ts:16`, `:60`).
- Persistence/history non-mutation: pass by source review plus targeted tests. Viewer playback/reset writes only React state in the Viewer screen path (`apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx:95`, `:142`; `:161`, `:179`) and targeted search found no operation/history/save call in the Viewer playback path. Tests assert authoring values are not mutated by Runtime Controls projection and `session.dirty` remains false on reset (`apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts:239`, `:264`; `:346`, `:375`).

## Forbidden-Scope Compliance

No forbidden Wave84 scope was found in the reviewed source, tests, or package metadata.

- No `dynamics-file-v2` schema, save/load format, package-format, operation payload/schema, or persistence file was changed in the current relevant diff.
- No `authoring-core` physics solver ownership was introduced.
- No frame stepping, play/pause transport, timeline, camera input, external motion transport, output meter/slider, raw Viewer solver diagnostics, multi-pendulum, multi-output, same-output mixer, mesh generation, persistent WebGL cache, or Cubism compatibility work was found.
- No external dependency was added. The dependency change is a local workspace link to an existing package (`apps/editor/package.json:19`; `pnpm-lock.yaml:44`, `:46`), and the dependency guard passes.
- `tmp/image.png` deletion and untracked `tmp/phase*.png` files remain unrelated/out-of-scope and were not modified.
- `discussion/implementation/_map.md` and `discussion/implementation/orchestration/_map.md` currently contain preliminary Wave84 entries. This review does not edit maps; final map closeout remains for the parent integration step and is not a source/test fix-loop issue.

## Verification Considered

Domain B verification reported by Orch-Sylph:

- Initial `pnpm.cmd typecheck` failed because `node_modules` lacked TypeScript; workspace dependencies were repaired with approved `pnpm.cmd install --frozen-lockfile --prefer-offline --force`.
- `pnpm.cmd typecheck`: pass.
- Initial focused Vitest failed before tests due to sandbox `esbuild spawn EPERM`; approved rerun passed.
- Focused Vitest command covered Viewer runtime, Runtime Controls state, Dynamics Tool state/Inspector, and runtime-core Dynamics/parameter/viewer/runtime tests. Result: 8 files / 55 tests passed.
- `node scripts/check-source-organization.mjs`: pass.
- `node scripts/check-dependencies.mjs`: pass.
- `git diff --check`: pass with LF-to-CRLF warnings only.

Reviewer-local verification:

- Re-read source/tests with line references rather than relying on implementer summaries.
- Counted the focused test set in source: 55 `it(...)` cases across the 8 reported files.
- Re-ran `node scripts/check-source-organization.mjs`: pass.
- Re-ran `node scripts/check-dependencies.mjs`: pass.
- Re-ran `git diff --check -- . ':(exclude)tmp'`: pass with LF-to-CRLF warnings only.
- Did not rerun typecheck or focused Vitest in this final clean review; their Domain B results are treated as verification evidence and were checked against current test contents.

## Residual Risks

- No browser/manual visual QA was run in this final review for perceived Canvas motion smoothness or real pointer/slider feel.
- Viewer now uses runtime-core effective parameter values but still renders through the existing Editor Canvas projection rather than runtime-core drawable snapshots. This matches Wave84 scope, but future runtime/viewer unification should keep this boundary visible.
- Runtime Controls excludes output ids broadly from all Dynamics Groups, including disabled groups, because the accepted rule is "used as Dynamics output". Future UX may decide disabled groups should release controls, but that would be a new decision.
- The current implementation maps still show Wave84 as preliminary/planned. They should be updated by the parent closeout pass after this review artifact is accepted.

## User-Decision Points

None blocking Wave84. No fix loop is required from this review.

## Reviewer Write Scope

This Review-Sylph edited only this final clean integration review artifact:

- `discussion/implementation/reviews/wave84/wave84-final-clean-integration-review.md`
