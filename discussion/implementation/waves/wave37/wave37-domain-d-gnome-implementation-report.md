# Wave37 Domain D Gnome Implementation Report

verdict: `done`

Target: `wave37-editor-transport-capability-ui-truthfulness`
Date: 2026-06-03

## Summary

Editor の Project Storage UI に package-format transport capability の truthful 表示を追加しました。

表示行は `@private-2d-rigging-lab/package-format` の `PACKAGE_FORMAT_TRANSPORT_CAPABILITY_CATALOG` と `evaluatePackageTransportBoundary` から投影しています。Portable JSON bundle は supported / available として表示し、既存の export/import 操作を `Export portable JSON` / `Import portable JSON` として引き続き有効にしています。

ZIP/archive は dependency-gated、File System Access API / directory picker / drag-drop は future-gated、native filesystem persistence は unsupported として表示します。これらは disabled な `Unavailable` control だけを持ち、成功 handler は接続していません。

## Files Changed

- `apps/editor/src/editor-state/transport-capability-view-model.ts`
- `apps/editor/src/editor-state/transport-capability-view-model.test.ts`
- `apps/editor/src/editor-state/editor-test-ids.ts`
- `apps/editor/src/editor-state/index.ts`
- `apps/editor/src/ui/project-persistence/project-transport-capability-section.ts`
- `apps/editor/src/ui/project-persistence/project-persistence-panel.ts`
- `apps/editor/src/ui/app-shell/app-shell.test.ts`
- `discussion/implementation/waves/wave37/wave37-domain-d-gnome-implementation-report.md`

## Implementation Notes

- Added a focused editor-state projection for transport capability UI rows, sourced from Domain B package-format capability/boundary APIs.
- Added dynamic test IDs for transport capability rows and disabled unavailable controls.
- Split the Project Storage transport capability DOM into `project-transport-capability-section.ts` so `project-persistence-panel.ts` remains focused on storage actions/status.
- Kept `apps/editor/src/editor-state/index.ts` barrel-only with a single re-export.
- Existing portable bundle workflow source was not changed; the workflow regression test still passes.

## Verification Performed

- `pnpm.cmd exec vitest run apps/editor/src/editor-state/transport-capability-view-model.test.ts apps/editor/src/ui/app-shell/app-shell.test.ts apps/editor/src/editor-workflow/portable-bundle-workflow.test.ts`
  - pass: 3 test files / 29 tests.
- `pnpm.cmd typecheck`
  - pass: root `tsc --noEmit` and editor `tsc --noEmit -p tsconfig.json`.
- `git diff --check -- apps/editor/src/editor-state apps/editor/src/ui discussion/implementation/waves/wave37`
  - pass: no whitespace errors; git reported LF-to-CRLF working-copy warnings only.
- Forbidden API/dependency scan over changed editor files:
  - pass for `showOpenFilePicker`, `showDirectoryPicker`, `webkitdirectory`, `DataTransfer`, `JSZip`, `createImageBitmap`, `ImageData`, filesystem handle types, and `pixel oracle`.
  - hits were limited to an existing tutorial test assertion containing `no full renderer`, plus new negative UI assertions that capability text does not contain `parser` or `decode`.
- Manifest/lockfile status check:
  - pass: no `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, or `apps/editor/package.json` changes.
- Source organization check:
  - pass: no implementation logic in `index.ts`; new projection and UI section are responsibility-named files.

Sandbox note: shell execution required escalated runs because normal sandboxed PowerShell failed with `windows sandbox: spawn setup refresh`.

Worktree note: Domain A/B/C and orchestration files were already present in the shared worktree and were not reverted. Domain D changed only the files listed above.

## Scope Guard

- No ZIP/archive writer/importer was implemented.
- No File System Access API, directory picker implementation, drag/drop event implementation, native filesystem persistence, parser, image decode, full renderer, pixel oracle, or external dependency was added.
- UI text marks unavailable transports as dependency-gated, future-gated, unsupported, or unavailable; it does not present them as successful operations.
- Unsupported/future/dependency-gated controls are disabled and have no success handler attached.

## Remaining Issues

- None for Domain D implementation.
- Product/dependency decisions for ZIP/archive, File System Access API, directory picker, drag-drop, and native filesystem persistence remain future-wave work.

## User-Decision Points

- None.
