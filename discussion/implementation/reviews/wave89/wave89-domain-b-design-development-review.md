# Wave89 Domain B Design / Development Compliance Review

## Verdict

Verdict: `pass`.

I found no blocking design/development compliance issues for Domain B `wave89-viewer-atlas-runtime-scope-original-perf-guard`.

Domain B stays Viewer-local, does not mutate authoring graph state, does not rewrite renderer/shader or Canvas atlas behavior, and provides focused tests for Original-mode performance guard and Atlas Runtime drawable scope.

## Basis Read

- `discussion/implementation/orchestration/wave89-plan.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/design/screen-design/screens/viewer-runtime-view.md`
- `discussion/design/screen-design/screens/texture-atlas-task.md`
- `discussion/implementation/waves/wave88/wave88-final-integration-report.md`
- `discussion/implementation/reviews/wave88/wave88-final-clean-integration-review.md`

## Scope Reviewed

- Primary Domain B diff:
  - `apps/editor/src/workspace/viewer/viewer-render-source.ts`
  - `apps/editor/src/workspace/viewer/viewer-render-source.test.ts`
- Relevant callers/tests:
  - `apps/editor/src/workspace/viewer/viewer-clean-stage.ts`
  - `apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx`
  - `apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts`
  - `apps/editor/src/workspace/viewer/runtime-controls-state.test.ts`
- Relevant shared oracle for runtime-bound atlas targets:
  - `packages/authoring-core/src/texture-atlas-targets.ts`
- Repository metadata / scope checks:
  - package manifest and lockfile diff check
  - `git status --short -uall`
  - focused forbidden-term search over Domain B files

Concurrent Domain A dirty files are present in atlas/authoring/operation areas. I did not review those implementation changes for correctness in this lane, except to confirm the provided Domain B diff is confined to the two Viewer render-source files.

## Findings

| Severity | Evidence | Required action |
|---|---|---|
| none | No blocking or warning finding. Domain B changes are confined to `apps/editor/src/workspace/viewer/viewer-render-source.ts` and `apps/editor/src/workspace/viewer/viewer-render-source.test.ts` in the reviewed diff. | None. |

## Design / Development Compliance Assessment

Pass.

Viewer-local architecture is preserved. `createViewerCleanStageRenderSourceProjection()` still creates the normal Canvas projection first and delegates only render-source selection/remap to the Viewer helper (`apps/editor/src/workspace/viewer/viewer-clean-stage.ts:57`). Domain B does not change Canvas projection creation, Canvas renderer code, WebGL/renderer/shader code, or authoring operation code.

No destructive session mutation surfaced in Domain B. Atlas Runtime remapping is built as a returned projection copy: drawables are filtered/remapped from `projection.drawables`, mask relations and overlays are filtered, bounds are recomputed, and the returned projection replaces only Viewer projection fields (`apps/editor/src/workspace/viewer/viewer-render-source.ts:362`). Individual drawable remapping returns a new drawable object with atlas texture/binary fields and remapped evaluated UVs (`apps/editor/src/workspace/viewer/viewer-render-source.ts:442`). The focused test snapshots `session.graph` before Atlas Runtime projection and asserts it remains equal afterward (`apps/editor/src/workspace/viewer/viewer-render-source.test.ts:87`).

Original mode behavior is preserved for authoring texture refs, original mesh UVs, and unbound Drawable Pool drawables. Tests cover Original authoring texture/UV behavior (`apps/editor/src/workspace/viewer/viewer-render-source.test.ts:54`), Original retaining the pool drawable after atlas commit (`apps/editor/src/workspace/viewer/viewer-render-source.test.ts:72`), and Canvas projection still retaining original texture refs/UVs including the pool drawable (`apps/editor/src/workspace/viewer/viewer-render-source.test.ts:139`).

Atlas Runtime scope now follows the runtime-bound atlas target oracle. The Viewer runtime source path uses `selectTextureAtlasTargets(...).packableTargets` for source-signature validation, placement validation, and `runtimeDrawableIds` construction (`apps/editor/src/workspace/viewer/viewer-render-source.ts:190`). It then filters the Viewer projection to those runtime drawable ids (`apps/editor/src/workspace/viewer/viewer-render-source.ts:376`). The authoring-core target selector excludes drawables that are not bound through rig controls (`packages/authoring-core/src/texture-atlas-targets.ts:105`, `packages/authoring-core/src/texture-atlas-targets.ts:145`), and the test fixture binds only Body/Sleeve through the rig control while leaving Pool outside that runtime-bound set (`apps/editor/src/workspace/viewer/viewer-render-source.test.ts:405`). The regression test asserts Atlas Runtime remains available and omits the pool drawable (`apps/editor/src/workspace/viewer/viewer-render-source.test.ts:122`).

Runtime-bound missing placement still fails deterministically. The Viewer runtime source requires a placement for every current packable runtime target and returns `missingPlacement` when one is absent (`apps/editor/src/workspace/viewer/viewer-render-source.ts:209`). The focused negative test removes the Sleeve placement and asserts fallback to Original with `missingPlacement` (`apps/editor/src/workspace/viewer/viewer-render-source.test.ts:315`).

The injected hook surface is narrow and maintainable. `ViewerRenderSourceProjectionHooks` exposes only the three heavy atlas functions needed to prove Original-mode avoidance (`apps/editor/src/workspace/viewer/viewer-render-source.ts:53`), and the resolver is local to the render-source helper (`apps/editor/src/workspace/viewer/viewer-render-source.ts:483`). This is not a broad catch-all hook or global test-only abstraction.

## Original-Mode Performance Guard Assessment

Pass.

The Original path in `createViewerRenderSourceProjection()` does not call the runtime validation path that performs target selection and source-signature work. Only the `atlasRuntime` requested branch calls `resolveViewerAtlasRuntimeSource()` (`apps/editor/src/workspace/viewer/viewer-render-source.ts:140`), where target selection and source-signature creation/comparison occur (`apps/editor/src/workspace/viewer/viewer-render-source.ts:190`). The Original branch uses `resolveViewerAtlasRuntimeStaticSource()` only (`apps/editor/src/workspace/viewer/viewer-render-source.ts:165`), preserving a cheap artifact-presence/dimensions/placement-shape check without selecting targets or hashing source signatures.

The focused test proves the guard by injecting throwing spies for `selectTextureAtlasTargets`, `createTextureAtlasSourceSignature`, and `sameTextureAtlasSourceSignature`, then requesting Original mode and asserting none were called (`apps/editor/src/workspace/viewer/viewer-render-source.test.ts:159`).

This satisfies the Wave89 requirement to avoid source-signature hashing and target selection on every Original projection/frame. Atlas Runtime still performs full target/signature validation when selected, which is appropriate for stale detection and placement enforcement in that mode.

## Source Organization / Dependency Assessment

Pass.

Source organization remains within existing Viewer responsibility files. No `index.ts`, broad `types.ts`/`utils.ts`/`helpers.ts`, or catch-all module was introduced. `node scripts/check-source-organization.mjs` passed.

No package manifest or lockfile diff was present for the reviewed dependency paths. `node scripts/check-dependencies.mjs` passed. Targeted search over the Domain B files found no renderer/shader rewrite, Workspace Directory Export implementation, Cubism SDK/Core, proprietary parser, `.moc3`, `.model3.json`, `.physics3.json`, or `live2dcubismcore` exposure. The only Live2D wording hit in Domain B files was the existing project-owned raw RGBA media type string in a test fixture, not an external dependency.

Domain B did not introduce Canvas atlas mode, renderer/shader changes, workerization, export/file-system APIs, or new runtime dependencies.

## Remaining Risks

- Original mode now reports only static atlas availability. It intentionally does not detect stale source signatures or runtime-bound missing placements until Atlas Runtime is requested, to avoid the heavy work in Original mode.
- Atlas Runtime requested mode still runs target selection/source-signature validation. If Atlas Runtime playback becomes hot on large projects, a future cache may be needed, but the Original-mode guard is in place.
- Verification is projection/UI-level. No browser pixel parity proof was added for Original versus Atlas Runtime rendering.
- `resolveViewerAtlasRuntimeAvailability()` still performs full runtime validation and retains an unused `originalProjection` input field. It has no current caller outside this module, but future callers should avoid invoking it from an Original-mode per-frame path.
- Concurrent Domain A dirty changes were present and not correctness-reviewed in this Domain B design/development lane.

## Verification Performed

- Read all assigned basis documents listed above.
- Inspected the Domain B diff with:
  - `git diff -- apps/editor/src/workspace/viewer/viewer-render-source.ts apps/editor/src/workspace/viewer/viewer-render-source.test.ts`
- Inspected source/tests directly:
  - `apps/editor/src/workspace/viewer/viewer-render-source.ts`
  - `apps/editor/src/workspace/viewer/viewer-render-source.test.ts`
  - `apps/editor/src/workspace/viewer/viewer-clean-stage.ts`
  - `apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx`
  - `apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts`
  - `apps/editor/src/workspace/viewer/runtime-controls-state.test.ts`
  - `packages/authoring-core/src/texture-atlas-targets.ts`
- Checked repository scope:
  - `git status --short -uall`
  - package manifest/lockfile diff check returned no dependency file changes
  - focused forbidden-term search over Domain B files found no forbidden implementation
- Ran focused Viewer tests:
  - sandbox run failed with known Vitest/esbuild `spawn EPERM`
  - escalated rerun passed: `apps/editor/src/workspace/viewer/viewer-render-source.test.ts`, `viewer-runtime-screen.test.ts`, `runtime-controls-state.test.ts`; 3 files, 40 tests
- Ran policy/format checks:
  - `node scripts/check-source-organization.mjs`: passed
  - `node scripts/check-dependencies.mjs`: passed
  - `git diff --check -- apps/editor/src/workspace/viewer/viewer-render-source.ts apps/editor/src/workspace/viewer/viewer-render-source.test.ts`: exit 0, with CRLF working-copy warnings only
