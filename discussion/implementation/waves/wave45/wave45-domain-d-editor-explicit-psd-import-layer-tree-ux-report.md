# Wave45 Domain D Report: Editor Explicit PSD Import / Layer Tree UX

> Target: `wave45-editor-explicit-psd-import-layer-tree-ux`
> Role: Gnome implementation agent
> Date: 2026-06-05
> Verdict: `pass`

## Verdict

`pass`

Editor に明示 PSD file selection workflow を追加した。ユーザーが選択した PSD を browser/editor session で parse し、parse status、document metadata、group/layer tree、visibility / opacity / bounds、unsupported / notEvaluated summary、selected layer materialization evidence summary を表示する。表示 state は parser-free session evidence projection であり、raw parser object、raw PSD bytes、raw materialized bytes の persistence は主張しない。

## Files Changed

- `apps/editor/src/app/editor-app.ts`
- `apps/editor/src/editor-state/editor-semantic-state.ts`
- `apps/editor/src/editor-state/editor-test-ids.ts`
- `apps/editor/src/editor-state/editor-view-model.ts`
- `apps/editor/src/editor-state/explicit-psd-import-state.ts`
- `apps/editor/src/editor-state/explicit-psd-import-state.test.ts`
- `apps/editor/src/editor-state/explicit-psd-import-view-model.ts`
- `apps/editor/src/editor-state/index.ts`
- `apps/editor/src/editor-workflow/browser-psd-parser-bridge.ts`
- `apps/editor/src/editor-workflow/browser-psd-parser-bridge.test.ts`
- `apps/editor/src/editor-workflow/explicit-psd-import-workflow.ts`
- `apps/editor/src/editor-workflow/workflow-controller.ts`
- `apps/editor/src/editor-workflow/index.ts`
- `apps/editor/src/styles/editor.css`
- `apps/editor/src/ui/app-shell/app-shell.ts`
- `apps/editor/src/ui/app-shell/app-shell.test.ts`
- `apps/editor/src/ui/explicit-psd-import/explicit-psd-import-panel.ts`
- `apps/editor/src/ui/explicit-psd-import/explicit-psd-import-panel.test.ts`
- `apps/editor/src/ui/explicit-psd-import/index.ts`
- `discussion/implementation/waves/wave45/wave45-domain-d-editor-explicit-psd-import-layer-tree-ux-report.md`

Pre-existing Domain B untracked files remained in the working tree. Domain D changed only the parser bridge preflight/test within that Editor scope and did not edit package contracts or dependency files.

## UX / Workflow Summary

- Added a `PSD Import` editor panel after Source Intake.
- The panel contains a normal browser file input with `.psd,image/vnd.adobe.photoshop,application/octet-stream` accept metadata and stable test IDs for focused e2e upload.
- The workflow accepts only a user-selected `File`; no drag-drop, directory picker, File System Access API, archive, remote URL, OS watcher, full renderer, compositing preview, or pixel oracle UI was added.
- The selected layer node ref defaults to `psd:root/layer[0]`, matching the Wave45 sample parse/materialization path while remaining editable.
- Product-facing file parsing uses `File.size` preflight before `arrayBuffer()` through `parseExplicitBrowserPsdFile`; the UI does not expose a size-cap override.

## Parser / Session Evidence Display Summary

The new session projection displays:

- parse status and selected source filename/media type/byte length/size cap
- parser/document metadata, adapter/version, canvas, group/layer counts, visible/hidden layer counts, raster candidate count, max depth
- combined group/layer tree ordered by parser-free source order
- per-row kind, node ref, visibility, opacity, bounds when available, role, blend mode evidence, unsupported feature IDs
- unsupported and notEvaluated feature-support summaries
- selected layer materialization evidence by source layer, media type, byte length, sha256 digest, and summary-only byte persistence
- parser diagnostics and structured failure evidence

## Persistence Boundary Summary

- Parser-private shapes are excluded.
- Raw parser objects are not persisted.
- Raw PSD bytes are read only for the browser parser session and are not persisted by the parser bridge.
- Selected layer materialization evidence is displayed as digest/byte-length/media summary only; raw materialized bytes are not persisted.
- Save/load semantics are displayed as session evidence cleared on project load; reparse/reselect is required.
- No Photoshop compositing, renderer correctness, pixel oracle, Cubism compatibility, or public demo asset claim was added.

## Verification

Passed:

- `pnpm.cmd exec vitest run apps/editor/src/editor-state/explicit-psd-import-state.test.ts apps/editor/src/ui/explicit-psd-import/explicit-psd-import-panel.test.ts apps/editor/src/editor-workflow/browser-psd-parser-bridge.test.ts`
  - Passed: 3 files, 10 tests.
- `pnpm.cmd exec vitest run apps/editor/src/ui/app-shell/app-shell.test.ts`
  - Passed: 1 file, 24 tests.
- `pnpm.cmd typecheck`
  - Passed.
- `pnpm.cmd run check:source`
  - Passed: `Source organization guard passed.`
- `pnpm.cmd run check:deps`
  - Passed: `Dependency guard passed.`
- Direct parser import scan:
  - `apps/**` direct import hit remains `apps/editor/src/editor-workflow/browser-psd-parser-adapter.ts`.
  - `packages/**` had parser package strings in tests/evidence only, not direct imports.
  - Existing Wave44 scripts still import `@webtoon/psd`; Domain D did not modify scripts.
- `git diff --check -- apps/editor/src`
  - Passed with CRLF working-copy warnings only.
- `git diff --no-index --check -- NUL <new/Domain-D-touched-untracked-file>`
  - No whitespace findings; expected no-index exit `1` with CRLF working-copy warnings only.

## Remaining Issues / User-Decision Points

None for Domain D.

Future decisions remain required before widening scope to drag-drop, archive/filesystem/File System Access API, Worker parser execution, general PSD materialization, full compositing, renderer/pixel oracle, Cubism compatibility, public sample PSD demo material, or repair/LLM/autofix behavior.
