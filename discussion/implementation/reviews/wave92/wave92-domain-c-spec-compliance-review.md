# Wave92 Domain C Spec Compliance Review

- Role / lane: Review-Sylph / Spec Compliance Review
- Date: 2026-06-20
- Target: `wave92-runtime-export-editor-task`
- Verdict: `pass`

## Scope Reviewed

- Domain C source/tests:
  - `apps/editor/src/features/runtime-export/model/runtime-export-directory.ts`
  - `apps/editor/src/features/runtime-export/model/runtime-export-task-state.ts`
  - `apps/editor/src/workspace/runtime-export/runtime-export-task-screen.tsx`
  - `apps/editor/src/workspace/runtime-export/runtime-export-task-screen.test.ts`
  - `apps/editor/src/state/editor-ui-store.ts`
  - `apps/editor/src/workspace/workspace-data.ts`
  - `apps/editor/src/workspace/authoring-workspace.tsx`
  - `apps/editor/src/workspace/toolbox/workspace-toolbox.tsx`
  - `apps/editor/src/workspace/toolbox/workspace-toolbox.test.ts`
- Upstream Runtime Export APIs and directory IO:
  - `packages/authoring-core/src/runtime-export-assembly.ts`
  - `packages/package-format/src/runtime-export-file-set.ts`
  - `packages/package-format/src/runtime-export.ts`
  - `apps/editor/src/features/workspace-storage/model/workspace-directory-io.ts`
- Domain A/B/C reports and Domain A/B reviews under `discussion/implementation/waves/wave92/` and `discussion/implementation/reviews/wave92/`.

## Basis Documents Used

- `discussion/implementation/orchestration/wave92-plan.md`
- `discussion/design/module-contracts/runtime-export-v0-contract.md`
- `discussion/design/screen-design/screens/runtime-export-task.md`
- `discussion/design/screen-design/screens/texture-atlas-task.md`
- `discussion/design/screen-design/screens/viewer-runtime-view.md`
- `discussion/design/screen-design/screens/workspace-save-and-navigation.md`
- `discussion/implementation/waves/wave92/wave92-domain-a-runtime-export-package-contract-report.md`
- `discussion/implementation/waves/wave92/wave92-domain-b-runtime-export-assembly-preflight-report.md`
- `discussion/implementation/waves/wave92/wave92-domain-c-runtime-export-editor-task-report.md`
- All existing Domain A/B review files under `discussion/implementation/reviews/wave92/`.

## Findings

### Blocking

None.

### Needs Changes

None.

### Non-blocking Notes

- Browser File System Access behavior is covered through the existing directory capability seam and fake directory handle, not through a real browser e2e picker flow. This is acceptable for this spec lane because Domain C uses the app-layer directory IO boundary and the focused directory write tests passed.
- I did not rerun broad `pnpm typecheck` or the broader storage/viewer/atlas regression test groups in this review lane. The Domain C report records those as passed; this review reran the focused Domain C task/toolbox tests directly.

## Evidence

- Toolbox contains a Runtime Export task entry. `WorkspaceEntryId` includes `runtimeExport` (`apps/editor/src/state/editor-ui-store.ts:9`), the Toolbox data adds `{ id: "runtimeExport", label: "Runtime Export", kind: "task" }` (`apps/editor/src/workspace/workspace-data.ts:49`), and the Toolbox test verifies the entry opens the task (`apps/editor/src/workspace/toolbox/workspace-toolbox.test.ts:110`, `apps/editor/src/workspace/toolbox/workspace-toolbox.test.ts:113`).
- A dedicated route/task screen exists. `AuthoringWorkspaceContent` detects `activeEntry === "runtimeExport"` (`apps/editor/src/workspace/authoring-workspace.tsx:40`) and renders `RuntimeExportTaskScreen` for that route (`apps/editor/src/workspace/authoring-workspace.tsx:54`, `apps/editor/src/workspace/authoring-workspace.tsx:55`). The route suppresses the normal Parameter Bar on task screens including Runtime Export (`apps/editor/src/workspace/authoring-workspace.tsx:95`, `apps/editor/src/workspace/authoring-workspace.tsx:97`).
- Back returns to the neutral Authoring Workspace. The task screen wires `onBack` to `setActiveEntry("workspace")` (`apps/editor/src/workspace/runtime-export/runtime-export-task-screen.tsx:135`), and the focused test asserts that Back calls only the workspace route and does not open PSD import (`apps/editor/src/workspace/runtime-export/runtime-export-task-screen.test.ts:177`, `apps/editor/src/workspace/runtime-export/runtime-export-task-screen.test.ts:187`).
- Missing/stale/atlas-byte blockers route to Texture Atlas, while runtime graph/materialization blockers route to Validate. Atlas blocker codes include no atlas, missing source signature/page/texture/binary ref, stale atlas, missing bytes, metadata mismatches, invalid placement, and uncovered targets (`apps/editor/src/features/runtime-export/model/runtime-export-task-state.ts:66` to `apps/editor/src/features/runtime-export/model/runtime-export-task-state.ts:79`); `getRuntimeExportBlockedAction` maps atlas blockers to `textureAtlas` and other blockers to `validate` (`apps/editor/src/features/runtime-export/model/runtime-export-task-state.ts:203`, `apps/editor/src/features/runtime-export/model/runtime-export-task-state.ts:210`). User-facing blocked titles cover required examples for no atlas, stale atlas, missing bytes, and runtime graph failure (`apps/editor/src/features/runtime-export/model/runtime-export-task-state.ts:259` to `apps/editor/src/features/runtime-export/model/runtime-export-task-state.ts:266`). Tests cover missing atlas and stale atlas routing (`apps/editor/src/workspace/runtime-export/runtime-export-task-screen.test.ts:191`, `apps/editor/src/workspace/runtime-export/runtime-export-task-screen.test.ts:203`).
- Ready state enables Export Runtime. The screen preflights with `preflightRuntimeExport` (`apps/editor/src/workspace/runtime-export/runtime-export-task-screen.tsx:72`), only disables export when state is not ready, directory access is unsupported, or an export is in progress (`apps/editor/src/workspace/runtime-export/runtime-export-task-screen.tsx:156`), and tests assert a valid current atlas shows Ready with an enabled action (`apps/editor/src/workspace/runtime-export/runtime-export-task-screen.test.ts:219`).
- Included/excluded counts display, and Drawable Pool exclusions are non-warning. The sidebar renders included, excluded, and Validate counts from the preflight target summary (`apps/editor/src/workspace/runtime-export/runtime-export-task-screen.tsx:390`, `apps/editor/src/workspace/runtime-export/runtime-export-task-screen.tsx:395`, `apps/editor/src/workspace/runtime-export/runtime-export-task-screen.tsx:400`) and labels the exclusion reason as `Drawable Pool entries are not exported` (`apps/editor/src/workspace/runtime-export/runtime-export-task-screen.tsx:408`). Domain B provides `excludedUnboundDrawableCount` from target selection without warnings (`packages/authoring-core/src/runtime-export-assembly.ts:655`). The Domain C test covers this non-warning display (`apps/editor/src/workspace/runtime-export/runtime-export-task-screen.test.ts:248`).
- Validate warnings are compact and do not disable export. Domain B emits only a preflight warning for Validate warnings (`packages/authoring-core/src/runtime-export-assembly.ts:601`), Domain C formats that warning label (`apps/editor/src/features/runtime-export/model/runtime-export-task-state.ts:241`), and the task sidebar offers `Open Validate` from the compact warning panel (`apps/editor/src/workspace/runtime-export/runtime-export-task-screen.tsx:445`). The export disable condition does not inspect warnings (`apps/editor/src/workspace/runtime-export/runtime-export-task-screen.tsx:156` to `apps/editor/src/workspace/runtime-export/runtime-export-task-screen.tsx:159`), and the test asserts warnings do not disable Export Runtime (`apps/editor/src/workspace/runtime-export/runtime-export-task-screen.test.ts:233`).
- Directory export writes the v0 directory file set. Domain A defines the required text paths and raw RGBA media type (`packages/package-format/src/runtime-export.ts:46`, `packages/package-format/src/runtime-export.ts:47`, `packages/package-format/src/runtime-export.ts:48`, `packages/package-format/src/runtime-export.ts:51`). Domain B serializes manifest/model/atlas text entries and creates raw RGBA texture entries into a Runtime Export file set (`packages/authoring-core/src/runtime-export-assembly.ts:156`, `packages/authoring-core/src/runtime-export-assembly.ts:158`, `packages/authoring-core/src/runtime-export-assembly.ts:169`). Domain C writes text entries through `writeWorkspaceTextEntries` and texture bytes through `writeWorkspaceBinaryEntry` (`apps/editor/src/features/runtime-export/model/runtime-export-directory.ts:54`, `apps/editor/src/features/runtime-export/model/runtime-export-directory.ts:60`, `apps/editor/src/features/runtime-export/model/runtime-export-directory.ts:67`, `apps/editor/src/features/runtime-export/model/runtime-export-directory.ts:73`). The test asserts exactly `runtime-export.json`, `runtime/model.json`, `runtime/atlas.json`, and `assets/textures/atlas_page_0.raw-rgba`, with binary bytes preserved (`apps/editor/src/workspace/runtime-export/runtime-export-task-screen.test.ts:260`, `apps/editor/src/workspace/runtime-export/runtime-export-task-screen.test.ts:285` to `apps/editor/src/workspace/runtime-export/runtime-export-task-screen.test.ts:299`).
- Directory export unavailable disables export with a clear reason and no Portable JSON fallback. Domain C detects directory picker capability (`apps/editor/src/workspace/runtime-export/runtime-export-task-screen.tsx:65`), formats the unsupported reason (`apps/editor/src/features/runtime-export/model/runtime-export-task-state.ts:221`, `apps/editor/src/features/runtime-export/model/runtime-export-task-state.ts:224`), displays it in the task (`apps/editor/src/workspace/runtime-export/runtime-export-task-screen.tsx:328`), and includes directory capability in the disabled condition (`apps/editor/src/workspace/runtime-export/runtime-export-task-screen.tsx:156`, `apps/editor/src/workspace/runtime-export/runtime-export-task-screen.tsx:158`). The focused test asserts the disabled state and absence of Portable JSON copy (`apps/editor/src/workspace/runtime-export/runtime-export-task-screen.test.ts:302`, `apps/editor/src/workspace/runtime-export/runtime-export-task-screen.test.ts:323`).
- Export Runtime does not call Workspace Save or Portable JSON export. The export action calls `assembleRuntimeExport` and `writeRuntimeExportToPickedDirectory` only (`apps/editor/src/workspace/runtime-export/runtime-export-task-screen.tsx:97`, `apps/editor/src/workspace/runtime-export/runtime-export-task-screen.tsx:114`). Scoped search in Domain C source found Workspace Save / Portable JSON references only in tests. The focused test also asserts no save/export fallback calls (`apps/editor/src/workspace/runtime-export/runtime-export-task-screen.test.ts:327`, `apps/editor/src/workspace/runtime-export/runtime-export-task-screen.test.ts:345`, `apps/editor/src/workspace/runtime-export/runtime-export-task-screen.test.ts:346`).
- Runtime/player app, OBS, camera mapping, bundle reload, single-file, ZIP, PNG, and automatic atlas generation were not added in Domain C. Scoped search over Domain C files found only test references to Portable JSON/Workspace Save non-calls and no implementation references to those non-goals. The task UI format details explicitly state raw RGBA, materialized runtime graph, and directory-only single-page v0 (`apps/editor/src/workspace/runtime-export/runtime-export-task-screen.tsx:322`, `apps/editor/src/workspace/runtime-export/runtime-export-task-screen.tsx:323`, `apps/editor/src/workspace/runtime-export/runtime-export-task-screen.tsx:460`).
- Viewer and Atlas Runtime behavior are preserved by scope. Scoped git status for `apps/editor/src/workspace/viewer`, `apps/editor/src/workspace/atlas`, `packages/runtime-core`, `packages/operation-core`, package manifests, and `pnpm-lock.yaml` produced no output in this review. Domain C routes missing/stale atlas resolution to the existing Atlas task without changing atlas generation/apply behavior (`apps/editor/src/workspace/runtime-export/runtime-export-task-screen.tsx:139`, `apps/editor/src/workspace/runtime-export/runtime-export-task-screen.tsx:277`).

## Verification Performed

- Read the Wave92 plan, Runtime Export contract, Runtime Export Task spec, Texture Atlas spec, Viewer Runtime View spec, and Workspace Save / Navigation spec directly.
- Read Domain A/B/C reports and all existing Domain A/B review artifacts under Wave92.
- Inspected the Domain C source/tests and relevant upstream Runtime Export assembly/file-set/directory IO files directly.
- Ran focused Domain C tests:
  - `pnpm.cmd exec vitest run apps/editor/src/workspace/runtime-export/runtime-export-task-screen.test.ts apps/editor/src/workspace/toolbox/workspace-toolbox.test.ts`
  - First sandboxed run failed during Vitest/esbuild startup with `spawn EPERM`.
  - Approved rerun passed: 2 test files, 14 tests.
- Ran scoped `git status --short -uall` checks for Viewer, Atlas, runtime-core, operation-core, package manifests, and lockfile; no scoped changes were reported.
- Ran scoped `rg` searches over Domain C files for Workspace Save / Portable JSON fallback and forbidden runtime/player/camera/OBS/ZIP/PNG/single-file/reload/automatic-atlas terms; no implementation hits were found.

## Remaining Issues / User-decision Points

- No source-level spec compliance issue found.
- No user decision is required for this lane.
- Remaining verification item for later integration: a real browser File System Access e2e picker flow is still outside this review lane; current coverage uses the app directory capability seam and fake directory handle.

## Final Verdict

`pass`

Domain C satisfies the Runtime Export Editor Task spec: it exposes a Toolbox task and route, returns Back to neutral workspace, maps preflight blockers to Texture Atlas or Validate, keeps Validate warnings non-blocking, displays included/excluded counts without treating Drawable Pool exclusions as warnings, writes the v0 directory/raw RGBA Runtime Export file set through app-layer directory IO, disables export when directory access is unavailable without Portable JSON fallback, and does not add the forbidden runtime/player, camera, OBS, PNG, ZIP, bundle reload, automatic atlas generation, Workspace Save, or Portable JSON behaviors.
