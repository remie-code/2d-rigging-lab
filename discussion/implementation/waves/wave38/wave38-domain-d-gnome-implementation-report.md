# Wave38 Domain D Gnome Implementation Report

## Verdict

needs_review

## Domain

`wave38-editor-canvas-topology-uv-workflow`

## Summary

- Added bounded Editor mesh topology and UV controls near the existing mesh canvas/vertex controls.
- Added editor-session command builders and narrow adapter commits for:
  - `addMeshVertex`
  - `removeMeshVertex`
  - `addMeshTriangle`
  - `removeMeshTriangle`
  - `moveMeshUvPoint`
- Added editor workflow commits that reuse Domain B operation APIs and existing commit state projection.
- Extended mesh edit state/view-model projection with UVs, topology revision, and stable triangle list state.
- Added DOM-observable controls for add vertex, remove selected unreferenced vertex, add triangle from exactly three selected vertices, remove listed stable-ID triangle, and UV nudge for selected vertices.
- Preserved the existing canvas/table vertex move workflow and added focused tests for it alongside topology/UV paths.

## Files Changed

Editor session:

- `apps/editor/src/editor-session/mesh-topology-command.ts`
- `apps/editor/src/editor-session/session-adapter.ts`
- `apps/editor/src/editor-session/evidence-provider.ts`
- `apps/editor/src/editor-session/index.ts`
- `apps/editor/src/editor-session/session-adapter.test.ts`

Editor state:

- `apps/editor/src/editor-state/mesh-edit-state.ts`
- `apps/editor/src/editor-state/mesh-edit-view-model.ts`
- `apps/editor/src/editor-state/mesh-topology-edit-state.ts`
- `apps/editor/src/editor-state/mesh-topology-view-model.ts`
- `apps/editor/src/editor-state/editor-test-ids.ts`
- `apps/editor/src/editor-state/index.ts`

Editor workflow/UI/app wiring:

- `apps/editor/src/editor-workflow/mesh-topology-workflow.ts`
- `apps/editor/src/editor-workflow/workflow-controller.ts`
- `apps/editor/src/editor-workflow/workflow-controller.test.ts`
- `apps/editor/src/editor-workflow/index.ts`
- `apps/editor/src/ui/drawable-authoring/mesh-topology-controls.ts`
- `apps/editor/src/ui/drawable-authoring/drawable-authoring-panel.ts`
- `apps/editor/src/ui/drawable-authoring/drawable-authoring-panel.test.ts`
- `apps/editor/src/ui/app-shell/app-shell.ts`
- `apps/editor/src/ui/app-shell/app-shell.test.ts`
- `apps/editor/src/app/editor-app.ts`

Report:

- `discussion/implementation/waves/wave38/wave38-domain-d-gnome-implementation-report.md`

## Verification

- Passed: `pnpm.cmd typecheck`
- Passed: `pnpm.cmd exec vitest run apps/editor/src/editor-session/session-adapter.test.ts apps/editor/src/editor-workflow/workflow-controller.test.ts apps/editor/src/editor-state/mesh-canvas-selection-state.test.ts apps/editor/src/ui/drawable-authoring/drawable-authoring-panel.test.ts apps/editor/src/ui/app-shell/app-shell.test.ts`
  - 5 files, 100 tests passed.
- Passed: `git diff --check -- apps/editor/src discussion/implementation/waves/wave38`
  - Git reported CRLF normalization warnings only.
- Passed: `rg -n "[ \t]+$" ...` over new topology source/report files produced no matches.
- Passed: manifest/lockfile guard: `git diff --name-only -- package.json pnpm-lock.yaml apps/editor/package.json` produced no output.
- Passed: topology/UV implementation forbidden-claim scan for automatic triangulation, atlas packing, texture sampling, image decode, pixel oracle, and Cubism terms produced no matches in the new/changed topology implementation files.

## Scope Compliance

- Stayed inside the allowed source write scope: `apps/editor/src/editor-session/**`, `apps/editor/src/editor-workflow/**`, `apps/editor/src/editor-state/**`, `apps/editor/src/ui/**`, narrow `apps/editor/src/app/**`, focused editor tests, and this Wave38 report.
- Did not edit `packages/**`; existing Domain A/B/C package changes were left untouched.
- Did not edit package manifests, lockfiles, dependencies, global styles, or `apps/editor/src/styles/**`.
- `index.ts` edits are barrel re-exports only.

## Remaining Issues / Risks

- Triangle removal is only enabled for listed triangles with stable triangle IDs. Legacy meshes without `triangleStableIds` show the bounded state and do not invent IDs for existing triangles.
- Add triangle is manual from exactly three selected vertices and can still be rejected by Domain B operation validation if the resulting topology is invalid.
- UV nudge is semantic UV editing only. It does not claim texture sampling correctness, image decode, renderer correctness, or pixel oracle coverage.
- Full e2e fixture/save-load smoke remains Domain E scope.

## User Decision Points

None.
