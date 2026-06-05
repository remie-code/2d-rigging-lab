# Wave45 Domain D Review: Editor Explicit PSD Import / Layer Tree UX

> Target: `wave45-editor-explicit-psd-import-layer-tree-ux`
> Role: Review-Sylph independent clean reviewer
> Date: 2026-06-05
> Artifact: `discussion/implementation/reviews/wave45/wave45-domain-d-editor-explicit-psd-import-layer-tree-ux-review.md`

## Verdict

`pass`

Blocking findings were not found. Domain D adds an explicit browser `File` selection workflow for PSD parse/display, keeps parser usage inside the approved Editor-local adapter boundary, preflights `File.size` before `File.arrayBuffer()` with the 32 MiB cap, and displays parser-free PSD session evidence without persisting raw parser objects, raw PSD bytes, or raw materialized bytes.

This is not approval for drag-drop, archive/filesystem, directory picker, remote URL, OS watcher, public demo assets, Photoshop compositing preview, renderer/pixel oracle, Cubism compatibility, or repair/LLM/autofix scope.

## Scope Reviewed

Basis documents and reports read:

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave45-plan.md`
- `discussion/development_convention/source-file-organization-policy.md`
- Wave45 Domain A/B/C reports and reviews
- `discussion/implementation/waves/wave45/wave45-domain-d-editor-explicit-psd-import-layer-tree-ux-report.md`

Changed Domain D areas reviewed:

- `apps/editor/src/app/editor-app.ts`
- `apps/editor/src/editor-state/*explicit-psd-import*`
- `apps/editor/src/editor-state/editor-semantic-state.ts`
- `apps/editor/src/editor-state/editor-test-ids.ts`
- `apps/editor/src/editor-state/editor-view-model.ts`
- `apps/editor/src/editor-state/index.ts`
- `apps/editor/src/editor-workflow/browser-psd-parser-adapter.ts`
- `apps/editor/src/editor-workflow/browser-psd-parser-bridge.ts`
- `apps/editor/src/editor-workflow/browser-psd-parser-bridge-result.ts`
- `apps/editor/src/editor-workflow/browser-psd-parser-bridge.test.ts`
- `apps/editor/src/editor-workflow/explicit-psd-import-workflow.ts`
- `apps/editor/src/editor-workflow/workflow-controller.ts`
- `apps/editor/src/editor-workflow/index.ts`
- `apps/editor/src/ui/app-shell/app-shell.ts`
- `apps/editor/src/ui/app-shell/app-shell.test.ts`
- `apps/editor/src/ui/explicit-psd-import/**`
- `apps/editor/src/styles/editor.css`
- Domain D implementation report

I did not rely on the implementation report as the only basis. I inspected source files, local status/diff, parser import scans, source organization entrypoints, and reran verification.

## Findings

### Blocking

None.

### Low / Residual

- The Domain D report's Files Changed list omits `apps/editor/src/editor-workflow/workflow-controller.ts`, while the source now imports and exposes the explicit PSD workflow at `apps/editor/src/editor-workflow/workflow-controller.ts:201`, `:387`, and `:839`. The source behavior is correct, but the report should be corrected if orchestration requires exact file inventory traceability.
- `apps/editor/src/ui/app-shell/app-shell.test.ts` does not directly assert that the shell contains `explicitPsdImport.fileInput`; the visible file input and upload callback are covered by `apps/editor/src/ui/explicit-psd-import/explicit-psd-import-panel.test.ts:19` and `:34`, and shell wiring was inspected in source at `apps/editor/src/ui/app-shell/app-shell.ts:292` and `:431`. This is not blocking for Domain D, but a future shell regression test would reduce integration risk.

## Design / Development Compliance

Pass.

- Explicit user-selected PSD workflow only: the UI creates a normal file input at `apps/editor/src/ui/explicit-psd-import/explicit-psd-import-panel.ts:82` through `:86`, and submit passes only the selected `File` plus selected layer ref at `:112` through `:125`. Scope-creep scans over Domain D Editor paths found no drag-drop, directory picker, File System Access API, archive/zip, remote URL/fetch workflow, or OS watcher additions.
- Size preflight: `parseExplicitBrowserPsdFile` checks `input.file.size` against the default 32 MiB cap before `arrayBuffer()` at `apps/editor/src/editor-workflow/browser-psd-parser-bridge.ts:30` through `:67`; the no-read oversize regression is covered at `apps/editor/src/editor-workflow/browser-psd-parser-bridge.test.ts:117` through `:133`.
- Parser boundary: the only direct `@webtoon/psd` import in `apps/**` is the approved adapter at `apps/editor/src/editor-workflow/browser-psd-parser-adapter.ts:1` through `:5`. Broad scan also found only existing Wave44 script imports plus parser package strings in tests/evidence.
- Parser-free evidence: adapter output is validated through DTO schemas at `apps/editor/src/editor-workflow/browser-psd-parser-adapter.ts:104`, layer tree evidence records `privateShapePolicy` at `:125` through `:134`, parser failures become structured evidence at `:150` through `:177`, and selected materialization stores byte length/digest plus `bytesPersisted: false` at `:399` through `:431`.
- UI evidence display: the panel renders parse status/source/document/features/materialization/tree/persistence/diagnostics sections at `apps/editor/src/ui/explicit-psd-import/explicit-psd-import-panel.ts:34` through `:64`. Tree rows include visibility, opacity, bounds, role, blend metadata, and unsupported IDs in the view model at `apps/editor/src/editor-state/explicit-psd-import-view-model.ts:181` through `:196`.
- Save/load truthfulness: explicit PSD state is initialized empty at `apps/editor/src/editor-state/editor-semantic-state.ts:141`, parse updates only session state at `apps/editor/src/editor-workflow/workflow-controller.ts:839` through `:843`, and the view model surfaces `sessionEvidenceClearedOnProjectLoadReparseRequiredV1` via persistence facts at `apps/editor/src/editor-state/explicit-psd-import-view-model.ts:165` through `:173`.
- Source organization: `apps/editor/src/editor-state/index.ts`, `apps/editor/src/editor-workflow/index.ts`, and `apps/editor/src/ui/explicit-psd-import/index.ts` are barrel-only. New source files are scoped by state, view model, workflow, bridge/result, and panel responsibilities.
- Forbidden source scope: Domain D did not require `packages/**`, `package.json`, `pnpm-lock.yaml`, broad e2e registry, renderer/pixel oracle, Photoshop compositing preview, or public demo asset wording changes. Concurrent Wave45 changes in package/validator areas were treated as outside this Domain D review scope.

## Test Adequacy

Pass for Domain D.

- State tests cover parser-free projection, layer tree/evidence display state, persistence boundaries, and oversize rejection state.
- Bridge tests cover real sample PSD parse/materialization, ArrayBuffer oversize rejection, File oversize rejection, `File.size` preflight before `arrayBuffer()`, and invalid bytes parser failure evidence.
- UI panel tests cover visible PSD file input/test ID, persistence boundary text, selected file callback payload, and empty submit behavior.
- App-shell tests still pass after wiring. See residual note above for a missing direct shell-specific PSD panel assertion.

## Verification Performed

Passed:

- `pnpm.cmd exec vitest run apps/editor/src/editor-state/explicit-psd-import-state.test.ts apps/editor/src/ui/explicit-psd-import/explicit-psd-import-panel.test.ts apps/editor/src/editor-workflow/browser-psd-parser-bridge.test.ts apps/editor/src/ui/app-shell/app-shell.test.ts`
  - Passed: 4 files, 34 tests.
- `pnpm.cmd typecheck`
  - Passed root and Editor package typecheck.
- `pnpm.cmd run check:source`
  - Passed: `Source organization guard passed.`
- `pnpm.cmd run check:deps`
  - Passed: `Dependency guard passed.`
- Parser import scan with `rg -n -F "@webtoon/psd" apps packages scripts`
  - Direct app import is only `apps/editor/src/editor-workflow/browser-psd-parser-adapter.ts`; existing Wave44 script imports remain; package/app non-adapter hits are parser evidence strings in tests.
- `git diff --check -- apps/editor/src discussion/implementation/waves/wave45 discussion/implementation/reviews/wave45`
  - Passed with CRLF working-copy warnings only.
- No-index whitespace check for new untracked Domain D files
  - Passed; no whitespace findings.

## Remaining Issues / User-Decision Points

No user decision is required for Domain D.

Future decisions remain required before widening scope to public demo materials, public visual byte distribution, drag-drop/archive/filesystem/File System Access API, full renderer/pixel oracle, Cubism compatibility, Worker parser execution, general PSD materialization, or repo-side repair/LLM/autofix behavior.

## Separation Confirmation

I acted only as the independent review gate. I did not edit implementation source, did not revert unrelated changes, and wrote only this review artifact under `discussion/implementation/reviews/wave45/**`.
