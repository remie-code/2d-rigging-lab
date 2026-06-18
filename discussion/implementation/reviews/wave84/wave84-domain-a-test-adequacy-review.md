# Wave84 Domain A Test Adequacy Review

Verdict: `pass`

## Findings

None.

The Domain A test set is adequate for the Wave84 verification matrix. The only notable gaps are residual risks, not needs-change findings, because the plan explicitly permits model-helper tests for Viewer time progression and source-review evidence for history/save non-mutation.

## Fix Loop 1 Delta Re-review

Verdict: `pass`.

Post-fix test adequacy is preserved and improved for the stale Viewer runtime simulation state finding. `viewer-runtime-screen.test.ts:378-432` now covers switching to a new project/session with enabled Dynamics while reusing the same Dynamics Group id. The test builds a stale previous state with non-zero `angle`, `angularVelocity`, `previousSource`, and `previousSourceVelocity`, then verifies `evaluateViewerRuntimePlaybackFrame(...)` resets those fields to the new project's source state and that `createViewerRuntimeCleanStageProjection(...)` renders a zero Dynamics output instead of reusing stale `HAIR_SWAY_X`.

Source review confirms the test protects the intended behavior:

- `viewer-runtime-playback.ts:79-86` discards incompatible previous `RuntimeStateDto` before evaluating a frame.
- `viewer-runtime-playback.ts:122-128` defines compatibility by package id, revision, and hash.
- `viewer-runtime-screen.tsx:101-105` filters incompatible runtime state before render/projection.
- `viewer-runtime-screen.tsx:166-178` filters incompatible runtime state before rAF advancement.
- `viewer-runtime-screen.tsx:190-192` clears simulation state when `runtimePlaybackModel.stateIdentityKey` changes.

Viewer reset and Runtime Controls override coverage remains intact at `viewer-runtime-screen.test.ts:346-375`; it still asserts reset state fields, retained `FACE_ANGLE_X` override, and non-dirty authoring session.

The Gnome-reported focused command is credible from source and report: the report records `pnpm.cmd exec vitest run apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts` as passed with 1 file / 12 tests, and the reviewed file contains 12 `it(...)` cases including the new stale-state regression.

## Basis Documents Used

- `discussion/implementation/orchestration/wave84-plan.md`
- `discussion/design/screen-design/components/dynamics-tool.md`
- `discussion/design/screen-design/screens/viewer-runtime-view.md`
- `discussion/implementation/waves/wave84/wave84-domain-a-viewer-dynamics-playback-solver-consolidation-report.md`
- `discussion/_conventions.md`
- `discussion/_map.md`
- `discussion/implementation/_map.md`

## Tests Reviewed

- `apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts`
- `apps/editor/src/workspace/viewer/runtime-controls-state.test.ts`
- `apps/editor/src/features/editor-session/model/dynamics-tool-state.test.ts`
- `apps/editor/src/workspace/panels/dynamics-tool-inspector.test.ts`
- `packages/runtime-core/src/dynamics-evaluation.test.ts`
- `packages/runtime-core/src/parameter-resolution.test.ts`
- `packages/runtime-core/src/viewer-evaluation.test.ts`
- `packages/runtime-core/src/runtime-core.test.ts`

## Source Reviewed

- `apps/editor/src/workspace/viewer/viewer-runtime-playback.ts`
- `apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx`
- `apps/editor/src/workspace/viewer/runtime-controls-state.ts`
- `apps/editor/src/workspace/viewer/runtime-controls.tsx`
- `apps/editor/src/features/editor-session/model/dynamics-tool-state.ts`
- `apps/editor/src/workspace/panels/dynamics-tool-inspector.tsx`
- `packages/runtime-core/src/dynamics-evaluation.ts`
- `packages/runtime-core/src/parameter-resolution.ts`
- `packages/runtime-core/src/runtime-core.ts`
- `packages/runtime-core/src/initial-state.ts`
- `packages/authoring-core/src/authoring-session.ts`
- Persistence/schema files were checked for touch-risk by path/search: `packages/package-format/src/model-files.ts`, `packages/package-format/src/package-document.test.ts`, `packages/authoring-core/src/package-document-from-authoring-session.ts`, `packages/authoring-core/src/package-document-model-files.ts`, `packages/authoring-core/src/authoring-graph.ts`.

## Coverage Notes

| Required coverage | Adequacy |
|---|---|
| Viewer driver parameter change produces time-progressing Dynamics output | Covered by `viewer-runtime-screen.test.ts:266`, which drives `FACE_ANGLE_X` through `evaluateViewerRuntimePlaybackFrame(...)` and asserts non-zero `HAIR_SWAY_X` plus state ticks at `:295-:300`. Runtime-core also covers deterministic stepping in `dynamics-evaluation.test.ts:16`. |
| Viewer output motion continues after driver stops and converges | Covered by `viewer-runtime-screen.test.ts:283-305` and `dynamics-evaluation.test.ts:58-118`, both holding the driver source after the first movement and asserting angular velocity reduction plus angle convergence. |
| Viewer reset clears simulation state without changing authored data or Runtime Controls overrides | Covered by `viewer-runtime-screen.test.ts:346-375`; reset builds a fresh runtime state, keeps the frozen override map unchanged, and leaves `session.dirty` false. Source review confirms reset is local React state only in `viewer-runtime-screen.tsx:123-136`. |
| Dynamics output parameters are excluded from Runtime Controls editing/display | Covered by `runtime-controls-state.test.ts:53-90` and `:221-246`; source filter is `runtime-controls-state.ts:62-67`, and stale excluded overrides are normalized out at `:82-106`. |
| Driver/input parameters remain editable | Covered by `runtime-controls-state.test.ts:53-75`, which hides `HAIR_SWAY` while retaining `FACE_ANGLE_X`. |
| Editor Dynamics Tool preview still advances | Covered by `dynamics-tool-state.test.ts:161-188` and Inspector rAF wiring in `dynamics-tool-inspector.test.ts:121-125`; source rAF hook is `dynamics-tool-inspector.tsx:942-965`. |
| Quick Tune still affects preview and commits at interaction completion | Covered by `dynamics-tool-state.test.ts:305-348`, `dynamics-tool-inspector.test.ts:172-187`, and duplicate/no-op commit guards at `dynamics-tool-inspector.test.ts:243-284` and `:328-363`. |
| Editor preview and runtime-core solver semantics share common helper or parity tests prove representative behavior | Covered both ways: source imports `stepDynamics(...)` and `computeDynamicsOutputOffsets(...)` in `dynamics-tool-state.ts:8-12`, adapter stepping delegates to runtime-core in `:808-860`, and a representative parity assertion exists in `dynamics-tool-state.test.ts:191-221`. |
| Runtime effective values use additive `base + offset` | Covered by `parameter-resolution.test.ts:16-60`; source implements `baseValue + dynamicsOffset` in `parameter-resolution.ts:37-79`. Viewer Clean Stage injection also checks base exclusion and effective output at `viewer-runtime-screen.test.ts:308-343`. |
| Project/session change with enabled Dynamics and reused group id does not reuse stale simulation state | Covered by fix-loop test `viewer-runtime-screen.test.ts:378-432`; source compatibility gates are in `viewer-runtime-playback.ts:79-86`, `viewer-runtime-playback.ts:122-128`, `viewer-runtime-screen.tsx:101-105`, `viewer-runtime-screen.tsx:166-178`, and `viewer-runtime-screen.tsx:190-192`. |
| Playback ticks and reset do not create operation history entries or dirty project state | Dirty-state assertion exists at `viewer-runtime-screen.test.ts:375`. Operation-history non-mutation is source-reviewed: Viewer playback/reset use `useState` and `setRuntimePlaybackState` only in `viewer-runtime-screen.tsx:123-177`, and touched Viewer/Runtime Controls source has no operation/history commit imports or calls. This matches the Wave84 matrix allowance for source-review evidence. |
| Existing Dynamics export/import roundtrip remains safe if persistence was touched | Persistence was not touched. Git touched source/test/package metadata does not include `packages/package-format/**` or `packages/authoring-core/**` persistence files; schema/search review confirms `dynamics-file-v2` remains in existing schema paths. Existing roundtrip rerun is therefore not required for Domain A. |

## Verification Considered / Rerun Status

- Considered from Domain A report: `pnpm.cmd typecheck` passed.
- Considered from Domain A report: focused Vitest files passed, reported as 8 files / 54 tests.
- Considered from Domain A report: `node scripts/check-source-organization.mjs` passed.
- Considered from Domain A report: `node scripts/check-dependencies.mjs` passed.
- Rerun during this review: `git diff --check` passed with CRLF normalization warnings only.
- Not rerun during this review: typecheck, focused Vitest, source-organization, and dependency checks. The review scope was read-only except this artifact, and the existing report already records those results.
- Fix Loop 1 considered from updated Domain A report: `pnpm.cmd exec vitest run apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts` passed, 1 file / 12 tests; `pnpm.cmd typecheck` passed; `git diff --check` passed with CRLF normalization warnings only.

## Test Gaps / Residual Risks

- No mounted `ViewerRuntimeScreen` fake-rAF test exercises the actual React `useEffect` loop and `Reset simulation` button end to end. The stale project-change regression now has direct helper/projection coverage plus source-reviewed render/rAF compatibility gates, so this remains a small scheduling/integration residual risk rather than a gap in the fixed stale-state behavior.
- No direct `EditorSessionHistoryState` stack assertion exists for Viewer playback/reset. Source review shows no operation/history commit path is reachable from the touched Viewer code, so this is low risk and not a needs-change finding.
- Browser/manual visual QA was not rerun. Test adequacy for numerical playback and injection is good, but actual perceived Canvas smoothness remains a later manual/performance check.

## User-Decision Points

None.
