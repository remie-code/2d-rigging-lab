# Wave57 Domain B Review: UX / Source Structure

> Target: `wave57-workspace-placeholder-composition-validation-gates`

## Verdict

`pass`

## Scope Reviewed

- Startup Authoring Workspace placeholder composition.
- Required visible regions for Wave57 Domain B.
- Work-focused editor surface vs. landing/debug/evidence surface.
- `apps/editor/src/` oracle source structure and flat-source risk.
- `components/` hygiene.
- Forbidden visible/source content absence.

This review did not edit source files, start a dev server, run browser e2e, take screenshots, or perform visual regression validation.

## Basis Documents Used

- `discussion/implementation/orchestration/wave57-plan.md`
- `discussion/design/screen-design/react-editor-foundation-oracle.md`
- `discussion/design/screen-design/editor-rebuild-purge-policy.md`
- `discussion/design/screen-design/scope-and-principles.md`
- `discussion/design/screen-design/overview.md`
- `discussion/design/screen-design/screens/authoring-workspace.md`
- `discussion/design/screen-design/components/toolbox.md`
- `discussion/design/codex-friendly-automation-policy.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/implementation/waves/wave57/wave57-domain-a-react-stack-app-reset-report.md`
- `discussion/implementation/reviews/wave57/wave57-domain-a-react-stack-app-reset-review.md`
- `discussion/implementation/waves/wave57/wave57-domain-b-workspace-placeholder-composition-validation-gates-report.md`

## Findings

No blocking or change-required findings.

## Evidence And Confirmations

### Required Visible Regions

Confirmed against the Wave57 plan required regions (`wave57-plan.md:122` through `wave57-plan.md:130`, acceptance restated at `wave57-plan.md:330`).

- Startup path renders the workspace immediately: `apps/editor/src/main.tsx:13` renders `EditorApp`, `apps/editor/src/app/editor-app.tsx:6` renders `FoundationWorkspace`, and `apps/editor/src/workspace/foundation-workspace.tsx:4` returns `AuthoringWorkspace`.
- App Bar exists: `apps/editor/src/workspace/authoring-workspace.tsx:20`; implementation in `apps/editor/src/workspace/app-bar.tsx:11`.
- Task / View entry points exist: `apps/editor/src/workspace/authoring-workspace.tsx:21`; implementation in `apps/editor/src/workspace/task-view-entry-bar.tsx:10`; entries come from `apps/editor/src/workspace/workspace-data.ts:57`.
- Toolbox exists in desktop and mobile layouts: `apps/editor/src/workspace/authoring-workspace.tsx:25`, `apps/editor/src/workspace/authoring-workspace.tsx:45`; implementation in `apps/editor/src/workspace/toolbox/workspace-toolbox.tsx:18`.
- Parts / Structure Tree exists: `apps/editor/src/workspace/authoring-workspace.tsx:30`, `apps/editor/src/workspace/authoring-workspace.tsx:47`; panel title at `apps/editor/src/workspace/panels/structure-tree-panel.tsx:15`.
- Canvas / Preview exists: `apps/editor/src/workspace/authoring-workspace.tsx:34`, `apps/editor/src/workspace/authoring-workspace.tsx:48`; panel title at `apps/editor/src/workspace/panels/canvas-preview-panel.tsx:7`.
- Inspector exists: `apps/editor/src/workspace/authoring-workspace.tsx:38`, `apps/editor/src/workspace/authoring-workspace.tsx:49`; panel title at `apps/editor/src/workspace/panels/inspector-panel.tsx:8`.
- Parameter Bar exists: `apps/editor/src/workspace/authoring-workspace.tsx:52`; implementation in `apps/editor/src/workspace/panels/parameter-bar.tsx:5`.

Note: `authoring-workspace.md` and `overview.md` still mention a Diagnostics Strip in the broader screen-design layout (`screens/authoring-workspace.md:29`, `overview.md:148`), but Wave57 Domain B required visible regions and acceptance criteria omit it. I treated the Wave57 plan as the controlling narrower scope for this review.

### Work-Focused Editor Surface

Confirmed. The startup screen is an editor workspace, not a landing, marketing, debug, or evidence surface.

- The visible composition is workspace chrome plus operational panels: app bar, launcher, hierarchy, canvas grid/empty state, inspector fields, and parameter control (`apps/editor/src/workspace/authoring-workspace.tsx:19` through `apps/editor/src/workspace/authoring-workspace.tsx:52`).
- The canvas placeholder is editor-oriented (`No artwork loaded`, `Preview and edit overlays appear here`, `Origin centered`) at `apps/editor/src/workspace/panels/canvas-preview-panel.tsx:16` through `apps/editor/src/workspace/panels/canvas-preview-panel.tsx:25`.
- Toolbox entries are editor actions/tasks/views, using icon buttons and labels from `apps/editor/src/workspace/workspace-data.ts:30` through `apps/editor/src/workspace/workspace-data.ts:54`.
- No hero/landing copy, evidence table, debug console, Codex panel, or old panel stack was found in inspected source.

### Source Structure

Confirmed. `apps/editor/src/` follows the oracle structure and is not a flat source pile.

- Required oracle directories are present: `app/`, `workspace/`, `features/`, `components/`, `ui/`, and `state/` (`react-editor-foundation-oracle.md:92` through `react-editor-foundation-oracle.md:97`; `wave57-plan.md:97` through `wave57-plan.md:106`).
- Current top-level source contains one entry file plus intentional directories: `main.tsx`, `app/`, `workspace/`, `features/`, `components/`, `ui/`, `state/`, plus narrow support dirs `styles/` and `lib/`.
- Workspace responsibility is split into focused files: `authoring-workspace.tsx`, `app-bar.tsx`, `task-view-entry-bar.tsx`, `workspace-data.ts`, `toolbox/workspace-toolbox.tsx`, and `panels/*`.
- No `index.ts` files were found under `apps/editor/src/`.
- No catch-all `types.ts`, `schemas.ts`, `utils.ts`, or `helpers.ts` files were found under `apps/editor/src/`.
- `node scripts/check-source-organization.mjs --source-root apps/editor/src` passed.

### `components/` Hygiene

Confirmed. `components/` is not being used as a dumping ground.

- `apps/editor/src/components/` contains only `status-badge.tsx`.
- The only component there is a small neutral app-specific badge wrapper (`apps/editor/src/components/status-badge.tsx:12` through `apps/editor/src/components/status-badge.tsx:29`).
- Workspace-specific panels and toolbox implementation live under `workspace/`, and low-level primitives live under `ui/`, matching the oracle meanings (`react-editor-foundation-oracle.md:106` through `react-editor-foundation-oracle.md:111`).

### Forbidden Content Absence

Confirmed by source inspection and static scans.

- No matches found in `apps/editor/src`, `apps/editor/index.html`, `apps/editor/package.json`, `apps/editor/vite.config.ts`, or `apps/editor/tsconfig.json` for forbidden/guard terms including `Codex`, `debug`, `diagnostic(s)`, `evidence`, `operation id`, `diagnostic id`, `testid`, `data-testid`, `auto-rig`, `auto-fix`, `semantic recognition`, `proposal generation`, `command payload`, `Wave51`-`Wave56`, `moc3`, `model3`, `Cubism`, `Live2D`, `screenshot`, `visual regression`, `playwright`, `storybook`, and `landing`.
- `Test-Path apps/editor/e2e` returned `False`.
- No old e2e/focused/testid guard path was observed under `apps/editor`.

## Verification / Static Checks Performed

- Read primary target source files directly under `apps/editor/src/`.
- Read/queried the listed basis documents for required regions, source structure, purge policy, automation boundary, and source-file organization policy.
- `rg --files apps/editor/src`
- `rg --files apps/editor/src/components`
- `Get-ChildItem -Force apps/editor/src`
- `Get-ChildItem -Force apps/editor/src/features`
- `Get-ChildItem -Force apps/editor/src/ui`
- `Test-Path apps/editor/e2e`
- Forbidden string/source scan over `apps/editor/src`, `apps/editor/index.html`, `apps/editor/package.json`, `apps/editor/vite.config.ts`, and `apps/editor/tsconfig.json`.
- Catch-all/barrel-risk path scan for `index.ts`, `types.ts`, `schemas.ts`, `utils.ts`, and `helpers.ts` under `apps/editor/src`.
- `node scripts/check-source-organization.mjs --source-root apps/editor/src`
- `git diff --check -- apps/editor package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json discussion/implementation/waves/wave57 discussion/implementation/reviews/wave57`

`git diff --check` completed with no whitespace errors; it emitted line-ending warnings for existing modified text files.

## Remaining Issues

None blocking for this review lane.

Residual scope note: broader screen-design docs still include Diagnostics Strip as part of the eventual Authoring Workspace layout, while Wave57 Domain B narrowed the required visible-region list and acceptance criteria to omit it. This does not require a Wave57 B fix unless Orch-Sylph chooses to expand the wave scope beyond the current plan.

## User-Decision Points

None.
