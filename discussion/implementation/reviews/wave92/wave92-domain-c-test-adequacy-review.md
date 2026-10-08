# Wave92 Domain C Test Adequacy Review

Verdict: `pass`

## Scope reviewed

- `apps/editor/src/workspace/runtime-export/runtime-export-task-screen.test.ts`
- `apps/editor/src/workspace/toolbox/workspace-toolbox.test.ts`
- `apps/editor/src/features/runtime-export/model/runtime-export-directory.ts`
- `apps/editor/src/features/runtime-export/model/runtime-export-task-state.ts`
- `apps/editor/src/workspace/runtime-export/runtime-export-task-screen.tsx`
- `apps/editor/src/state/editor-ui-store.ts`
- `apps/editor/src/workspace/workspace-data.ts`
- `apps/editor/src/workspace/authoring-workspace.tsx`
- Related regression tests:
  - `apps/editor/src/workspace/authoring-workspace.test.ts`
  - `apps/editor/src/workspace/atlas/texture-atlas-task-screen.test.ts`
  - `apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts`
  - `apps/editor/src/workspace/viewer/viewer-render-source.test.ts`
  - `apps/editor/src/features/workspace-storage/model/workspace-session-storage.test.ts`
  - `apps/editor/src/features/editor-session/editor-session-context-history.test.ts`
  - `apps/editor/src/workspace/app-bar.test.ts`
  - `apps/editor/src/workspace/project-storage/project-storage-screen.test.ts`

## Basis documents used

- `discussion/implementation/orchestration/wave92-plan.md`
- `discussion/design/module-contracts/runtime-export-v0-contract.md`
- `discussion/design/screen-design/screens/runtime-export-task.md`
- `discussion/design/screen-design/screens/texture-atlas-task.md`
- `discussion/design/screen-design/screens/viewer-runtime-view.md`
- `discussion/design/screen-design/screens/workspace-save-and-navigation.md`
- Domain A/B reports and reviews under `discussion/implementation/waves/wave92/` and `discussion/implementation/reviews/wave92/`
- `discussion/implementation/waves/wave92/wave92-domain-c-runtime-export-editor-task-report.md` as secondary context only

## Findings

### Blocking

None.

### Needs Changes

None.

### Non-blocking Notes

- The test named "writes picked Runtime Export directories without calling Workspace Save or Portable JSON export" is weaker than its name: it creates local `saveProject` / `exportPortableProject` spies that are not wired into the subject under test (`apps/editor/src/workspace/runtime-export/runtime-export-task-screen.test.ts:327`). Source inspection mitigates this for Wave92 because the Runtime Export screen export path calls `assembleRuntimeExport` and `writeRuntimeExportToPickedDirectory` only (`apps/editor/src/workspace/runtime-export/runtime-export-task-screen.tsx:97`, `apps/editor/src/workspace/runtime-export/runtime-export-task-screen.tsx:114`), and the directory helper only imports workspace directory IO primitives (`apps/editor/src/features/runtime-export/model/runtime-export-directory.ts:1`). Future hardening should either trigger the screen export action with session spies wired in or add a small import-boundary assertion.
- `Open Texture Atlas` and `Open Validate` routing is covered by source wiring and button presence, while only Back is click-asserted. The source wires Back/Atlas/Validate to `setActiveEntry("workspace")`, `setActiveEntry("atlas")`, and `setActiveEntry("validate")` (`apps/editor/src/workspace/runtime-export/runtime-export-task-screen.tsx:135`, `apps/editor/src/workspace/runtime-export/runtime-export-task-screen.tsx:139`, `apps/editor/src/workspace/runtime-export/runtime-export-task-screen.tsx:140`). This is adequate but easy to harden with one callback assertion on `RuntimeExportTaskView`.
- No real browser File System Access e2e was added. The seam is reasonable for this wave: Runtime Export writes through the existing directory IO layer (`apps/editor/src/features/runtime-export/model/runtime-export-directory.ts:67`, `apps/editor/src/features/runtime-export/model/runtime-export-directory.ts:73`), and the fake directory/storage tests cover capability detection and safe nested path writes/rejection (`apps/editor/src/features/workspace-storage/model/workspace-session-storage.test.ts:65`, `apps/editor/src/features/workspace-storage/model/workspace-session-storage.test.ts:115`).

## Coverage Matrix

| Required check | Assessment | Evidence |
|---|---|---|
| Toolbox contains Runtime Export entry. | Covered. | Toolbox data adds `runtimeExport` (`apps/editor/src/workspace/workspace-data.ts:49`); toolbox test renders and clicks it (`apps/editor/src/workspace/toolbox/workspace-toolbox.test.ts:97`, `apps/editor/src/workspace/toolbox/workspace-toolbox.test.ts:110`). |
| Runtime Export Task opens and Back returns to neutral workspace. | Covered. | Route renders the dedicated screen and suppresses Parameter Bar (`apps/editor/src/workspace/runtime-export/runtime-export-task-screen.test.ts:161`); Back sets `activeEntry` to `workspace` (`apps/editor/src/workspace/runtime-export/runtime-export-task-screen.test.ts:177`). |
| Missing atlas blocked + `Open Texture Atlas`. | Covered. | Missing atlas preflight renders blocked title, blocker code, and action (`apps/editor/src/workspace/runtime-export/runtime-export-task-screen.test.ts:191`). |
| Stale atlas blocked. | Covered. | Test mutates source UVs after atlas apply and asserts stale blocker and Open Texture Atlas (`apps/editor/src/workspace/runtime-export/runtime-export-task-screen.test.ts:203`). |
| Valid current atlas Ready + Export Runtime enabled. | Covered. | Ready state, included/excluded counts, and enabled action are asserted (`apps/editor/src/workspace/runtime-export/runtime-export-task-screen.test.ts:219`). |
| Validate warnings compact warning and export remains enabled. | Covered. | Warning text, compact count, Open Validate affordance, and enabled action are asserted (`apps/editor/src/workspace/runtime-export/runtime-export-task-screen.test.ts:233`). |
| Drawable Pool excluded count appears as excluded/non-warning. | Covered. | Excluded count, Drawable Pool exclusion copy, and zero Validate warning count are asserted (`apps/editor/src/workspace/runtime-export/runtime-export-task-screen.test.ts:248`). |
| Directory write emits expected files and raw RGBA bytes. | Covered. | Test uses real Domain B assembly, writes through `writeRuntimeExportDirectory`, checks exact paths/text markers/raw bytes (`apps/editor/src/workspace/runtime-export/runtime-export-task-screen.test.ts:260`). |
| Directory export unavailable disables export without Portable JSON fallback. | Covered. | Unsupported directory capability renders unavailable reason, omits `Portable JSON`, and disables the action (`apps/editor/src/workspace/runtime-export/runtime-export-task-screen.test.ts:302`). |
| Export Runtime does not call Workspace Save or Portable JSON export. | Adequate with source-backed caveat. | UI source does not call session save/portable in the Runtime Export export path (`apps/editor/src/workspace/runtime-export/runtime-export-task-screen.tsx:97`, `apps/editor/src/workspace/runtime-export/runtime-export-task-screen.tsx:114`); the current test's local spies are not wired (`apps/editor/src/workspace/runtime-export/runtime-export-task-screen.test.ts:327`). |
| Existing Workspace Save / Portable JSON tests remain passing or focused regression coverage is run/reported. | Covered. | Reran app-bar, project-storage, workspace storage, authoring workspace, and editor-session history tests. Relevant cases include Save Workspace without portable export (`apps/editor/src/workspace/app-bar.test.ts:163`), Portable JSON controls (`apps/editor/src/workspace/project-storage/project-storage-screen.test.ts:95`), workspace save/import flows (`apps/editor/src/features/editor-session/editor-session-context-history.test.ts:564`, `apps/editor/src/features/editor-session/editor-session-context-history.test.ts:682`), and workspace binary save behavior (`apps/editor/src/features/editor-session/editor-session-context-history.test.ts:726`, `apps/editor/src/features/editor-session/editor-session-context-history.test.ts:776`). |
| Atlas/Viewer runtime preservation has regression checks or scoped no-change evidence. | Covered. | Reran atlas and viewer regression tests. Viewer Atlas Runtime remap, pool exclusion, stale/missing layout behavior, and no-mutation checks are covered (`apps/editor/src/workspace/viewer/viewer-render-source.test.ts:87`, `apps/editor/src/workspace/viewer/viewer-render-source.test.ts:122`, `apps/editor/src/workspace/viewer/viewer-render-source.test.ts:205`, `apps/editor/src/workspace/viewer/viewer-render-source.test.ts:230`, `apps/editor/src/workspace/viewer/viewer-render-source.test.ts:315`); Atlas apply preservation remains covered (`apps/editor/src/workspace/atlas/texture-atlas-task-screen.test.ts:329`). |

## Verification Performed

- `pnpm.cmd exec vitest run apps/editor/src/workspace/runtime-export/runtime-export-task-screen.test.ts apps/editor/src/workspace/toolbox/workspace-toolbox.test.ts apps/editor/src/workspace/authoring-workspace.test.ts apps/editor/src/features/workspace-storage/model/workspace-session-storage.test.ts apps/editor/src/workspace/app-bar.test.ts apps/editor/src/workspace/project-storage/project-storage-screen.test.ts apps/editor/src/workspace/atlas/texture-atlas-task-screen.test.ts apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts apps/editor/src/workspace/viewer/viewer-render-source.test.ts`
  - First sandbox run failed before tests with Vitest/esbuild `spawn EPERM`.
  - Approved rerun passed: 9 files, 72 tests.
- `pnpm.cmd exec vitest run apps/editor/src/features/editor-session/editor-session-context-history.test.ts`
  - Approved run passed: 1 file, 24 tests.
  - The run emitted the expected stderr from the workspace-required rejection test; it did not fail the suite.

## Remaining issues / user-decision points

- No user decision is required for Domain C test adequacy.
- Recommended follow-up before a broader release gate: harden the Runtime Export non-call regression so `saveProject` / `exportPortableProject` spies are part of the rendered screen/session path, not local unused functions.
- Browser picker behavior itself remains covered through the app-layer directory seam, not a real browser e2e flow. That is acceptable for Wave92 v0 because the output writer, capability check, path safety, and raw byte writes are covered in focused tests.
