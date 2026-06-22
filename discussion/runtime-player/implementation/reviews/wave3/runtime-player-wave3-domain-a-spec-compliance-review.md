# Runtime Player Wave3 Domain A Spec Compliance Review

## Verdict

pass

## Scope Reviewed

- Lane: Spec Compliance Review
- Target: `runtime-player-wave3-default-pose-evaluation-adapter`
- Reviewed implementation files:
  - `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-runtime-graph-adapter.ts`
  - `apps/runtime-player/src/stage/runtime-evaluation/default-runtime-pose-evaluator.ts`
  - `apps/runtime-player/src/stage/stage-renderer/evaluated-runtime-export-stage-scene.ts`
  - `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-default-pose-evaluation.test.ts`
- Reviewed implementation report:
  - `discussion/runtime-player/implementation/waves/wave3/runtime-player-wave3-domain-a-default-pose-evaluation-adapter-report.md`

## Basis Documents Used

- `discussion/runtime-player/implementation/orchestration/player-wave3-plan.md`
  - Sections 3, 6.1, 6.2, 7, 10, 11, 12.
- `discussion/runtime-player/_map.md`
- `discussion/runtime-player/implementation/_map.md`
- `discussion/runtime-player/implementation/orchestration/_map.md`
- `discussion/runtime-player/architecture/runtime-player-development-policy.md`
- `discussion/runtime-player/architecture/technology-stack-decision.md`
- `discussion/runtime-player/architecture/tracking-input-mapping-baseline.md`
- `discussion/runtime-player/screens/initial-runtime-player-screen.md`
- `discussion/runtime-player/backlog/runtime-player-backlog.md`
- `discussion/development_convention/source-file-organization-policy.md`

## Findings

No blocking or needs-change findings.

## Spec Compliance Notes

- The adapter is Player-local and pure in the Wave3 sense: `createRuntimeExportRuntimeGraph` accepts Runtime Export DTO inputs and returns a `NormalizedRuntimeGraph` plus separate render resources without Electron, Stage interaction, persistence, or network side effects. See `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-runtime-graph-adapter.ts:32` and `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-runtime-graph-adapter.ts:67`.
- Runtime Export parameters, dynamics groups, drawables/meshes, masks, draw order, rig controls, and keyform bindings are mapped into the `runtime-core` graph shape. See `runtime-export-runtime-graph-adapter.ts:72`, `runtime-export-runtime-graph-adapter.ts:110`, `runtime-export-runtime-graph-adapter.ts:132`, `runtime-export-runtime-graph-adapter.ts:157`, `runtime-export-runtime-graph-adapter.ts:197`, and `runtime-export-runtime-graph-adapter.ts:346`.
- Texture/atlas-page metadata and render-only mesh resources are preserved separately from graph evaluation through `renderResources.texturePages` and `drawableRenderResources`. See `runtime-export-runtime-graph-adapter.ts:56`, `runtime-export-runtime-graph-adapter.ts:96`, and `runtime-export-runtime-graph-adapter.ts:247`.
- Default pose evaluation uses `runtime-core` rather than Stage-side keyform/deformer logic: it builds initial reset state with empty `authoredParameterValues`, calls `evaluateRuntimeFrame`, uses `deltaTimeMs: 0`, and requests `snapshotDetail: "full"`. See `apps/runtime-player/src/stage/runtime-evaluation/default-runtime-pose-evaluator.ts:22`.
- The evaluated Stage render contract consumes the full snapshot and maps evaluated vertices, opacity, draw order, visibility, and clipping into `RenderScene` data for Domain B. See `apps/runtime-player/src/stage/stage-renderer/evaluated-runtime-export-stage-scene.ts:34` and `evaluated-runtime-export-stage-scene.ts:67`.
- The implementation does not import `authoring-core`; the reviewed new source imports `package-format`, `runtime-core`, `render-core`, and local Runtime Player modules only. See `runtime-export-runtime-graph-adapter.ts:1`, `default-runtime-pose-evaluator.ts:1`, and `evaluated-runtime-export-stage-scene.ts:1`.
- Forbidden Domain A scope was not added in the reviewed target files: no iFacialMocap/network/mapping, parameter controls, body/head motion, dynamics playback loop, Stage pan/zoom UX, or persistence was introduced.
- Focused tests cover adapter field conversion, default-pose evaluation from empty authored values, and evaluated snapshot-to-render input mapping. See `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-default-pose-evaluation.test.ts:28`, `runtime-export-default-pose-evaluation.test.ts:169`, and `runtime-export-default-pose-evaluation.test.ts:242`.

## Verification Evidence

Not rerun by this review to keep the Review-Sylph pass read-only except for this report. Gnome-reported verification was inspected as supporting evidence:

- `pnpm.cmd --filter @private-2d-rigging-lab/runtime-player typecheck`: pass
- Focused Vitest elevated rerun: pass, 1 file / 3 tests
- `pnpm.cmd --filter @private-2d-rigging-lab/runtime-player test`: pass, 7 files / 33 tests
- `node scripts/check-source-organization.mjs`: pass
- `node scripts/check-dependencies.mjs`: pass
- `git diff --check -- apps/runtime-player/src/stage discussion/runtime-player/implementation/waves/wave3`: pass

## Remaining Risks / Gaps

- Domain A creates the evaluated output contract but does not wire it into the current production Stage renderer. The current renderer still calls `createRuntimeExportStageRenderInput(payload)` in `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:59`. This matches the plan split because Domain B owns Stage evaluated render integration.
- The focused tests cover rig control field conversion, direct mesh keyform deformation, opacity, draw order, masks, and render mapping. They do not add a new adapter-fed test where rig-control keyforms deform output through a hierarchy; this is acceptable for Domain A because `runtime-core` remains the evaluation authority, but Domain B/final review should keep an eye on real Stage visual behavior.
- The evaluated render scene currently consumes the Wave2 single loaded texture page payload. Adapter metadata preservation is in place, but multi-page rendering is not exercised. This is not blocking for current Runtime Export v0 single-page constraints.

## User-Decision Points

None.
