# Runtime Player Wave3 Domain A Design / Development Compliance Review

## Verdict

pass

## Scope Reviewed

Target: `runtime-player-wave3-default-pose-evaluation-adapter`

Reviewed implementation/report files:

- `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-runtime-graph-adapter.ts`
- `apps/runtime-player/src/stage/runtime-evaluation/default-runtime-pose-evaluator.ts`
- `apps/runtime-player/src/stage/stage-renderer/evaluated-runtime-export-stage-scene.ts`
- `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-default-pose-evaluation.test.ts`
- `discussion/runtime-player/implementation/waves/wave3/runtime-player-wave3-domain-a-default-pose-evaluation-adapter-report.md`

Basis documents used:

- `discussion/runtime-player/implementation/orchestration/player-wave3-plan.md`
- `discussion/runtime-player/architecture/runtime-player-development-policy.md`
- `discussion/runtime-player/architecture/technology-stack-decision.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/runtime-player/implementation/_map.md`
- `discussion/runtime-player/implementation/orchestration/_map.md`

Additional repository references checked where needed:

- `packages/runtime-core/src/normalized-runtime-graph.ts`
- `packages/package-format/src/runtime-export.ts`
- `apps/runtime-player/package.json`
- Existing Stage renderer: `apps/runtime-player/src/stage/stage-renderer/runtime-export-stage-scene.ts`

## Findings

### Blocking

None.

### Warnings / Follow-up Notes

None requiring Domain A changes.

## Design / Development Compliance Notes

### Process / Window Boundaries

Compliant.

- The new source files are under `apps/runtime-player/src/stage/**`, matching the Domain A allowed source scope.
- No main-process, preload implementation, or Control Window source changes were introduced in the reviewed source set.
- `evaluated-runtime-export-stage-scene.ts` imports `RuntimeExportLoadedPayload` as a type from the existing preload bridge contract, matching the existing Stage renderer pattern and not exposing Electron or raw IPC APIs to renderer code.

### Forbidden Runtime Player Dependencies

Compliant.

- A target-scope search found no `authoring-core` import and no direct `node:*`, Electron, `ipcRenderer`, or `contextBridge` usage in the new Stage files.
- `apps/runtime-player/package.json` continues to depend on `contracts`, `package-format`, `runtime-core`, `render-core`, and `render-webgl2`; it does not add `authoring-core`.

### runtime-core Evaluation Authority

Compliant.

- `createRuntimeExportRuntimeGraph` builds a `NormalizedRuntimeGraph` from Runtime Export DTO fields and does not evaluate keyforms/deformers itself (`runtime-export-runtime-graph-adapter.ts:67-83`).
- Rig controls and keyforms are converted as graph data, not executed in Stage code (`runtime-export-runtime-graph-adapter.ts:197-244`, `runtime-export-runtime-graph-adapter.ts:346-379`).
- Default pose evaluation delegates to `runtime-core` via `createInitialRuntimeState` and `evaluateRuntimeFrame` with empty authored values, `deltaTimeMs: 0`, reset reason `packageLoad`, and `snapshotDetail: "full"` (`default-runtime-pose-evaluator.ts:22-48`).
- Stage render mapping consumes evaluated snapshot vertices, opacity, visibility, draw order, and masks; it does not sample keyforms or apply deformers itself (`evaluated-runtime-export-stage-scene.ts:34-91`, `evaluated-runtime-export-stage-scene.ts:155-180`).

### Adapter / Render Boundary

Compliant.

- The adapter preserves render resources separately from the runtime graph: texture pages, drawable render resources, and input manifest are returned alongside `graph` (`runtime-export-runtime-graph-adapter.ts:67-103`).
- The Stage render adapter throws when evaluated drawable render resource data or full snapshot vertices are missing, which leaves fatal evaluation/render contract failures visible to the caller rather than silently fabricating output (`evaluated-runtime-export-stage-scene.ts:78-84`).
- Runtime Export v0 currently requires exactly one texture page in the package-format contract (`packages/package-format/src/runtime-export.ts:746-748`, `packages/package-format/src/runtime-export.ts:771-774`), so the current single loaded texture source bridge is consistent with the existing v0 payload shape. Future multi-page Runtime Export support will need a broader loader/render contract update.

### Source Organization

Compliant.

- No implementation logic was added to `index.ts`.
- No new catch-all `types.ts`, `utils.ts`, `helpers.ts`, or `schemas.ts` files were introduced.
- Production files have cohesive responsibilities:
  - graph conversion: `runtime-export-runtime-graph-adapter.ts`
  - one-shot default pose evaluation: `default-runtime-pose-evaluator.ts`
  - evaluated snapshot to Stage render scene mapping: `evaluated-runtime-export-stage-scene.ts`
- The focused test file is fixture-heavy but scoped to the Domain A adapter/evaluation/render-input contract. Gnome reported `node scripts/check-source-organization.mjs` passing.

### Error Behavior

Compliant for Domain A contract level.

- The reviewed source has no top-level side effects that would crash the app at import time.
- Adapter/evaluation contract failures throw to the caller instead of being hidden.
- Runtime diagnostics remain available through `defaultPoseEvaluation.snapshot.diagnostics`; Domain B still needs to catch/surface fatal evaluation failures through the agreed Stage/Control error path.

## Verification Evidence Inspected

Gnome reported:

- `pnpm.cmd --filter @private-2d-rigging-lab/runtime-player typecheck`: pass
- Focused Vitest: sandbox failed with esbuild `spawn EPERM`; elevated rerun passed, 1 file / 3 tests
- `pnpm.cmd --filter @private-2d-rigging-lab/runtime-player test`: pass, 7 files / 33 tests
- `node scripts/check-source-organization.mjs`: pass
- `node scripts/check-dependencies.mjs`: pass
- `git diff --check -- apps/runtime-player/src/stage discussion/runtime-player/implementation/waves/wave3`: pass

This review did not rely on the report alone; it also inspected the implementation source, existing Stage renderer pattern, package dependency surface, and relevant runtime/package-format contracts.

## Remaining Risks / Gaps

- Domain A intentionally does not replace the live Stage render call; Domain B must consume `createEvaluatedRuntimeExportStageRenderInput` and remove the raw static mesh final display path.
- Domain B must add the app-level handling required by Wave3 error criteria: fatal evaluation failures should leave Stage safe and surface human-readable status through Control Window.
- GUI/screenshot verification and manual real Runtime Export visual checks remain open for later lanes, especially default pose appearance, clipping, alpha behavior, and practical payload size.
- Multi-texture-page support is not implemented in the Stage payload/render bridge, but this is not a Domain A violation while Runtime Export v0 enforces a single texture page.

## User Decision Points

None.
