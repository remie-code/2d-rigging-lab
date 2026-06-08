# Wave58 Domain A PSD Import E2E v0 Gnome Report

## Verdict

fixed

## Implemented Scope

- Added a React editor PSD import path from `Import PSD` into a large Authoring Workspace modal.
- Added browser PSD byte intake through `apps/editor/src/editor-workflow/browser-psd-parser-adapter.ts`.
  - Direct `@webtoon/psd` usage is limited to the approved adapter boundary.
  - Raw PSD bytes and parser objects are not kept in durable React session state.
- Added a v0 import planner that projects PSD structure into Editor Parts review rows:
  - `Part Container`
  - `Drawable`
  - `Hidden Drawable`
- Added row-level binary issue projection as badge/tooltip plumbing.
- Added PSD preview placeholder only; no compositing preview claim.
- Connected `Import` to the existing operation-core path:
  - `importPsdSourceAsset`
  - `importPsdStructuralScaffold`
- Added minimal editor session state, selection state, session-derived Parts Tree rows, and normal Inspector projection.
- After successful import, the modal closes, imported structure is rendered in `Parts / Structure Tree`, and the generated import root part is selected.
- Added minimal path/state Playwright E2E without screenshots, pixel assertions, or visual oracle checks.

## Fix Loop 1 Changes

- Addressed UX/source-structure F1:
  - Removed raw generated drawable `meshId` and `textureId` values from normal Inspector rows.
  - Replaced them with human-facing `Geometry: Mesh ready` and `Texture: Texture linked` summaries.
  - Did not add a dedicated Import Summary panel.
- Addressed UX/source-structure F2:
  - Built PSD import issue maps by source group/layer ids before review row projection.
  - Attached binary row-level `Issue` state and tooltip details using `sourceGroupRef.sourceGroupId` / `sourceLayerRef.sourceLayerId`.
  - Kept normal UI free of warning counts, category summaries, parser payloads, operation ids, and raw generated refs.
- Addressed test/process F1:
  - Inspected the leftover `127.0.0.1:5173` process from the prior validation workflow.
  - Confirmed PID `52960` was `vite --host 127.0.0.1 -- --port 5173` under `apps/editor`, parent PID `53460` was the shell wrapper, and parent PID `70572` was `pnpm --filter @private-2d-rigging-lab/editor dev -- --port 5173`.
  - Stopped PIDs `52960`, `53460`, and `70572`.

## Files Changed By This Implementation

- `apps/editor/package.json`
- `apps/editor/playwright.config.ts`
- `apps/editor/e2e/psd-import.e2e.spec.ts`
- `apps/editor/src/app/editor-app.tsx`
- `apps/editor/src/editor-workflow/browser-psd-parser-adapter.ts`
- `apps/editor/src/features/editor-session/editor-session-context.tsx`
- `apps/editor/src/features/editor-session/model/editor-selection.ts`
- `apps/editor/src/features/editor-session/model/empty-authoring-session.ts`
- `apps/editor/src/features/editor-session/model/session-tree.ts`
- `apps/editor/src/features/psd-import/components/psd-import-modal.tsx`
- `apps/editor/src/features/psd-import/model/psd-import-commit.ts`
- `apps/editor/src/features/psd-import/model/psd-import-planner.ts`
- `apps/editor/src/features/psd-import/model/psd-import-types.ts`
- `apps/editor/src/workspace/app-bar.tsx`
- `apps/editor/src/workspace/authoring-workspace.tsx`
- `apps/editor/src/workspace/panels/inspector-panel.tsx`
- `apps/editor/src/workspace/panels/structure-tree-panel.tsx`
- `apps/editor/src/workspace/task-view-entry-bar.tsx`
- `apps/editor/src/workspace/toolbox/workspace-toolbox.tsx`
- `pnpm-lock.yaml`
- `discussion/implementation/waves/wave58/wave58-domain-a-psd-import-e2e-v0-gnome-report.md`

Note: `package.json` at the repository root was already dirty before this task with a pnpm override. It was preserved. `pnpm install` refreshed the lockfile in the same dirty worktree.

## Validation Results

- PASS: `pnpm --dir apps/editor typecheck`
- PASS: `pnpm --dir apps/editor build`
  - Initial sandbox run hit esbuild `spawn EPERM`; approved rerun passed.
  - Vite emitted only the existing large chunk warning.
- PASS: `pnpm run typecheck`
- PASS: `pnpm run test:unit`
  - Initial sandbox run hit esbuild `spawn EPERM`; approved rerun passed.
  - Result: 185 test files / 942 tests passed.
- PASS: `pnpm run check`
  - Initial sandbox run hit esbuild `spawn EPERM`; approved rerun passed.
  - `check:deps` and `check:source` passed.
- PASS: `pnpm run smoke:wave44:psd-parser`
  - Used `test_data/sample_model.psd`, private/local fixture.
- PASS: `node scripts/check-psd-parser-import-boundary.mjs`
  - Direct parser imports limited to approved adapter and Wave44 scripts.
- PASS: `pnpm --dir apps/editor test:e2e:psd-import`
  - Installed Playwright Chromium because the local browser executable was missing.
  - Fix loop 1 sandbox run hit Playwright `spawn EPERM`; approved rerun passed.
  - Result: 1 test passed.
- PASS: `git diff --check -- apps/editor package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json scripts discussion`
  - No whitespace errors. Git reported CRLF conversion warnings only.
- PASS: explicit port/process cleanup check for `4173` and `5173`
  - Before cleanup: review-reported editor Vite dev server on `127.0.0.1:5173`, PID `52960`.
  - After cleanup and after rerunning Playwright E2E: `no LISTENING sockets on 4173 or 5173`.
  - Filtered process inspection found no remaining non-PowerShell `vite`, `playwright`, or `apps/editor` process for this workspace. `Get-CimInstance` required approval outside the sandbox for process command-line inspection.

## Assumptions And Notes

- The v0 planner imports the first cap-safe set of materialized PSD layers, limited by the existing structural scaffold cap policy (`approvedLeafLimit: 6`).
- A synthetic import root part (`sample_model import` for the fixture path) is generated from `psd:root` so the Workspace can select the generated root/group after Import.
- Duplicate PSD source layer names are preserved in source refs, while generated drawable display names are made unique to satisfy operation-core structural collision checks.
- Hidden source layers are committed with initial runtime visibility matching the source and appear as `Hidden Drawable` in review/workspace state.
- The normal UI intentionally does not expose raw diagnostics, operation IDs, generated refs, parser payloads, or import summary panels.

## Residual Risks

- The preview remains a placeholder by design; no renderer or Photoshop compositing claim is made.
- The import planner is a small project-local bridge for this vertical slice, not a full destination picker or layer-by-layer approval workflow.
- The in-app Browser plugin sanity check could not run because this session reported `Browser is not available: iab`; Playwright E2E covered the required path/state verification.
- The workspace had unrelated pre-existing dirty files outside Domain A. They were not reverted or cleaned.

## Blockers / User Decisions

- No current blocker.
- No user decision point to escalate to Undine for this Domain A implementation.
