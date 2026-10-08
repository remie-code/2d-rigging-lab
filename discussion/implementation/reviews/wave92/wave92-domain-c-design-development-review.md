# Wave92 Domain C Design / Development Compliance Review

- Role: Review-Sylph / Design and Development Compliance Review
- Target: `wave92-runtime-export-editor-task`
- Date: 2026-06-20
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
  - `apps/editor/src/workspace/toolbox/workspace-toolbox.test.ts`
- Adjacent app source:
  - `apps/editor/src/features/workspace-storage/model/workspace-directory-io.ts`
  - `apps/editor/src/features/project-storage/model/browser-portable-project-transfer.ts`
  - `apps/editor/src/features/workspace-storage/model/workspace-session-storage.ts`
  - `apps/editor/src/workspace/atlas/texture-atlas-task-screen.tsx`
  - `apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx`
- Domain A/B handoff reports and reviews under:
  - `discussion/implementation/waves/wave92/`
  - `discussion/implementation/reviews/wave92/`

## Basis Documents Used

- `discussion/implementation/orchestration/wave92-plan.md`
- `discussion/design/module-contracts/runtime-export-v0-contract.md`
- `discussion/design/screen-design/screens/runtime-export-task.md`
- `discussion/design/screen-design/screens/texture-atlas-task.md`
- `discussion/design/screen-design/screens/viewer-runtime-view.md`
- `discussion/design/screen-design/screens/workspace-save-and-navigation.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/operation-policy.md`
- Domain A/B reports and reviews listed in the reviewed scope above.

## Findings

### Blocking

None.

### Needs Changes

None.

### Non-blocking Notes

- The previous `needs_changes` finding is fixed. `runtimeExport.requiredBinaryUnavailable` is now included in `ATLAS_BLOCKER_CODES`, so `getRuntimeExportBlockedAction` routes this Texture Atlas binary blocker to `Open Texture Atlas` (`apps/editor/src/features/runtime-export/model/runtime-export-task-state.ts:66`, `apps/editor/src/features/runtime-export/model/runtime-export-task-state.ts:78`, `apps/editor/src/features/runtime-export/model/runtime-export-task-state.ts:204`). The focused test constructs a blocked preflight with that code and asserts `Open Texture Atlas` is rendered while the primary `Open Validate` action is not (`apps/editor/src/workspace/runtime-export/runtime-export-task-screen.test.ts:220`, `apps/editor/src/workspace/runtime-export/runtime-export-task-screen.test.ts:252`).
- Ownership boundary is otherwise clean. The contract assigns pure DTO/file-set ownership to `package-format`, assembly/preflight to `authoring-core`, and task UX/browser directory write flow to `apps/editor` (`discussion/design/module-contracts/runtime-export-v0-contract.md:45`, `discussion/design/module-contracts/runtime-export-v0-contract.md:47`). Domain C source imports Domain B `authoring-core` APIs only for runtime export; searches found no direct Domain C import of `package-format`, `runtime-core`, or `operation-core` (`apps/editor/src/workspace/runtime-export/runtime-export-task-screen.tsx:13`, `apps/editor/src/features/runtime-export/model/runtime-export-directory.ts:1`, `apps/editor/src/features/runtime-export/model/runtime-export-task-state.ts:8`).
- Browser/directory IO stays in the app layer. Runtime Export writes through the existing workspace directory IO seam (`apps/editor/src/features/runtime-export/model/runtime-export-directory.ts:26`, `apps/editor/src/features/runtime-export/model/runtime-export-directory.ts:44`) and uses app-layer path-safe text/binary writers (`apps/editor/src/features/workspace-storage/model/workspace-directory-io.ts:195`, `apps/editor/src/features/workspace-storage/model/workspace-directory-io.ts:229`, `apps/editor/src/features/workspace-storage/model/workspace-directory-io.ts:240`). No Browser File System Access type leak into package Runtime Export code was found.
- Runtime Export remains separate from Workspace Save and Portable JSON. The write helper writes the assembled Runtime Export file set only, and the focused test asserts no Workspace Save or Portable JSON export call (`apps/editor/src/workspace/runtime-export/runtime-export-task-screen.test.ts:327`, `apps/editor/src/workspace/runtime-export/runtime-export-task-screen.test.ts:345`). The unavailable-directory UI also avoids Portable JSON fallback (`apps/editor/src/workspace/runtime-export/runtime-export-task-screen.test.ts:302`, `apps/editor/src/workspace/runtime-export/runtime-export-task-screen.test.ts:323`).
- UI integration follows the existing dedicated task-screen pattern. `runtimeExport` is a workspace entry (`apps/editor/src/state/editor-ui-store.ts:9`), appears in Toolbox tasks (`apps/editor/src/workspace/workspace-data.ts:49`), routes to a dedicated screen (`apps/editor/src/workspace/authoring-workspace.tsx:40`, `apps/editor/src/workspace/authoring-workspace.tsx:53`), and suppresses the Parameter Bar on the task route (`apps/editor/src/workspace/authoring-workspace.tsx:97`).
- Texture Atlas artifact separation and Viewer Atlas Runtime behavior appear preserved. Domain C did not modify atlas/viewer runtime source; the reviewed adjacent design docs keep Apply Atlas as committed artifact generation without authoring texture/UV replacement and keep Viewer `Atlas Runtime` as a viewer-only committed-atlas mode (`discussion/design/screen-design/screens/texture-atlas-task.md:99`, `discussion/design/screen-design/screens/viewer-runtime-view.md:194`, `discussion/design/screen-design/screens/viewer-runtime-view.md:200`).
- Source organization is acceptable. New Domain C files have cohesive responsibilities: directory writing, task-state mapping, and task screen. `index.ts` changes in the worktree are Domain A/B barrel re-exports only (`packages/package-format/src/index.ts:32`, `packages/authoring-core/src/index.ts:64`); Domain C did not add implementation logic to entrypoints.
- No new dependencies, manifest changes, or lockfile changes were found. `git status --short -- package.json pnpm-lock.yaml apps/editor/package.json packages/package-format/package.json packages/authoring-core/package.json packages/runtime-core packages/operation-core` produced no dependency/lockfile/package-scope changes beyond Domain A/B barrel files, and `node scripts/check-dependencies.mjs` passed.
- `runtime-core` was not made dependent on package/authoring/file IO, and `operation-core` is not used for the non-mutating export path. Domain C Runtime Export source has no `operation-core` import/use.

## Verification Performed

- Post-fix focused rerun:
  - `pnpm.cmd exec vitest run apps/editor/src/workspace/runtime-export/runtime-export-task-screen.test.ts`
  - Passed with approved escalation: 1 file, 11 tests.
- `pnpm.cmd exec vitest run apps/editor/src/workspace/runtime-export/runtime-export-task-screen.test.ts apps/editor/src/workspace/toolbox/workspace-toolbox.test.ts`
  - Sandbox attempt failed at Vitest config startup with esbuild `spawn EPERM`.
  - Approved rerun from the original review passed before the narrow fix: 2 files, 14 tests.
- `pnpm.cmd typecheck`
  - Passed.
- `node scripts/check-source-organization.mjs`
  - Passed.
- `node scripts/check-dependencies.mjs`
  - Passed.
- `git diff --check -- apps/editor/src/features/runtime-export apps/editor/src/workspace/runtime-export apps/editor/src/workspace/workspace-data.ts apps/editor/src/state/editor-ui-store.ts apps/editor/src/workspace/authoring-workspace.tsx apps/editor/src/workspace/toolbox/workspace-toolbox.test.ts`
  - Passed with Git LF/CRLF warnings only.
- Targeted searches:
  - No direct Domain C import of `@private-2d-rigging-lab/package-format`, `@private-2d-rigging-lab/runtime-core`, or `@private-2d-rigging-lab/operation-core`.
  - No Runtime Export source use of Workspace Save or Portable JSON fallback.
  - No package manifest or lockfile change.

## Remaining Issues / User-decision Points

- No remaining design/development compliance issues for Domain C.
- No user/product decision is required for this review lane.
