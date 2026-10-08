# Wave92 Domain C Runtime Export Editor Task Report

## Verdict Candidate

pass

## Files Changed

- `apps/editor/src/features/runtime-export/model/runtime-export-directory.ts`
  - Runtime Export file-set directory write helper using existing app directory IO.
  - picked-directory write helper for browser directory export.
- `apps/editor/src/features/runtime-export/model/runtime-export-task-state.ts`
  - Runtime Export preflight-to-UI state mapping, blocker action mapping, capability reason text, and compact summary labels.
- `apps/editor/src/workspace/runtime-export/runtime-export-task-screen.tsx`
  - Runtime Export Task screen, readiness/blocked/ready UI, Validate warning indicator, format details, export action, and navigation.
- `apps/editor/src/workspace/runtime-export/runtime-export-task-screen.test.ts`
  - focused task, preflight, capability, directory write, and non-fallback tests.
- `apps/editor/src/state/editor-ui-store.ts`
  - `runtimeExport` workspace entry id.
- `apps/editor/src/workspace/workspace-data.ts`
  - Runtime Export toolbox/task entry.
- `apps/editor/src/workspace/authoring-workspace.tsx`
  - Runtime Export dedicated route and Parameter Bar suppression on the task route.
- `apps/editor/src/workspace/toolbox/workspace-toolbox.test.ts`
  - toolbox entry coverage for Runtime Export.

## Verification Run

- Review fix focused run:
  - `pnpm.cmd exec vitest run apps/editor/src/workspace/runtime-export/runtime-export-task-screen.test.ts`
  - initial sandbox run failed before tests with Vitest/esbuild `spawn EPERM`.
  - approved rerun passed: 1 file, 11 tests.
- Orch-Sylph final focused rerun after review fix:
  - `pnpm.cmd exec vitest run apps/editor/src/workspace/runtime-export/runtime-export-task-screen.test.ts apps/editor/src/workspace/toolbox/workspace-toolbox.test.ts`
  - initial sandbox run failed before tests with Vitest/esbuild `spawn EPERM`.
  - approved rerun passed: 2 files, 15 tests.
- Initial implementation focused run before the review fix:
  - `pnpm.cmd exec vitest run apps/editor/src/workspace/runtime-export/runtime-export-task-screen.test.ts apps/editor/src/workspace/toolbox/workspace-toolbox.test.ts`
  - initial sandbox run failed before tests with Vitest/esbuild `spawn EPERM`.
  - approved rerun passed: 2 files, 14 tests.
- `pnpm.cmd exec vitest run apps/editor/src/workspace/authoring-workspace.test.ts apps/editor/src/features/workspace-storage/model/workspace-session-storage.test.ts apps/editor/src/workspace/project-storage/project-storage-screen.test.ts`
  - pass: 3 files, 17 tests.
- `pnpm.cmd exec vitest run apps/editor/src/workspace/atlas/texture-atlas-task-screen.test.ts apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts apps/editor/src/workspace/viewer/viewer-render-source.test.ts`
  - pass: 3 files, 32 tests.
- `pnpm.cmd typecheck`
  - pass.
- `node scripts/check-source-organization.mjs`
  - pass.
- `node scripts/check-dependencies.mjs`
  - pass.
- `git diff --check -- apps/editor/src/features/runtime-export apps/editor/src/workspace/runtime-export apps/editor/src/workspace/workspace-data.ts apps/editor/src/state/editor-ui-store.ts apps/editor/src/workspace/authoring-workspace.tsx apps/editor/src/workspace/toolbox/workspace-toolbox.test.ts`
  - pass before and after report creation, with Git LF/CRLF warnings only.

## Implementation Summary

- Review fix applied: classified `runtimeExport.requiredBinaryUnavailable` as a Texture Atlas recovery blocker so the primary blocked action routes to `Open Texture Atlas`, with focused UI-state coverage proving it does not render `Open Validate`.
- Added `Runtime Export` as a Toolbox task and `activeEntry="runtimeExport"` route.
- Added a dedicated Runtime Export Task screen:
  - Back returns to neutral Authoring Workspace.
  - blocked atlas states show `Open Texture Atlas`.
  - runtime/materialization failure states route to `Open Validate`.
  - ready state shows included/excluded counts, atlas/page summary, compact Validate warning state, and format details.
  - Validate warnings do not disable export.
  - Drawable Pool exclusion is shown as an excluded/non-warning count.
- Runtime Export uses Domain B `preflightRuntimeExport` and `assembleRuntimeExport` from `@private-2d-rigging-lab/authoring-core`.
- Directory export writes the Runtime Export file-set only:
  - `runtime-export.json`
  - `runtime/model.json`
  - `runtime/atlas.json`
  - `assets/textures/atlas_page_0.raw-rgba`
- Capability handling disables `Export Runtime` when the directory picker is unavailable and shows a clear reason.
- No Workspace Save mutation, Portable JSON fallback, archive/ZIP, PNG, single-file export, runtime/player, OBS, camera mapping, bundle reload, or atlas auto-generation was added.

## Basis Coverage Self-Report

- `discussion/implementation/orchestration/wave92-plan.md`
  - Covered Domain C task entry, route, readiness UI, directory write flow, capability handling, navigation, tests, and non-goals.
- `discussion/design/module-contracts/runtime-export-v0-contract.md`
  - Preserved directory-only Runtime Export, raw RGBA texture output, materialized runtime graph boundary, current atlas requirement, Drawable Pool exclusion, and Validate warning non-blocking behavior.
- `discussion/design/screen-design/screens/runtime-export-task.md`
  - Covered preflight/blocked/ready/exported/failed states, target summary, format details, Validate warning indicator, and task-local navigation.
- `discussion/design/screen-design/screens/texture-atlas-task.md`
  - Routed missing/stale atlas resolution to Texture Atlas and did not change atlas generation/apply semantics.
- `discussion/design/screen-design/screens/viewer-runtime-view.md`
  - Viewer Runtime behavior was not changed; focused Viewer/Atlas tests passed.
- `discussion/design/screen-design/screens/workspace-save-and-navigation.md`
  - Kept Runtime Export separate from Workspace Save and Portable JSON; focused storage/project tests passed.
- `discussion/development_convention/source-file-organization-policy.md`
  - New source is split by directory write, task state, and task screen responsibilities; source guard passed.
- `discussion/development_convention/dependency-policy.md`
  - No dependency or lockfile changes; dependency guard passed.
- `discussion/development_convention/operation-policy.md`
  - Runtime Export is non-mutating and does not route through operation-core or mutate package state.
- Domain A/B reports
  - Consumed Domain B public APIs from `authoring-core`; app layer does not directly import `package-format`.

## Deferred Basis Items

- Domain D final integration and clean review.
- Browser-level File System Access e2e was not added; directory write behavior is covered through the existing fake directory seam and app-layer write helper.
- External runtime/player loading, camera/tracker mapping, OBS integration, PNG, ZIP/archive, single-file/base64 export, exported bundle reload, and multi-page implementation remain out of scope.

## Policy Notes

- No package dependencies or lockfile changes.
- No edits to `packages/package-format`, `packages/authoring-core`, `packages/runtime-core`, or `packages/operation-core`.
- No Workspace Save format change and no Portable JSON behavior change.
- No Texture Atlas algorithm changes.
- `index.ts` files were not changed.

## Remaining Issues / Escalation Points

- No blocker or escalation point remains for Domain C.
- Residual risk: browser picker behavior itself is covered by the existing capability seam, not a real browser e2e flow.
