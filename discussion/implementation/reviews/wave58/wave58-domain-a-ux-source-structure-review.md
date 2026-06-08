# Wave58 Domain A UX / Source Structure Review

verdict: `pass`

loop: `fix-loop-1 re-review`

## Scope Reviewed

- Target: Wave58 Domain A `wave58-psd-import-e2e-v0-implementation`
- Mode: independent Review-Sylph, read-only for source/product files
- Reviewed current `git status --short -uall`, the requested tracked diff command, untracked Domain A source/test files from status, prior review findings, and the fix-loop Gnome report.
- Reviewed UX/design/source-structure compliance only. Test adequacy and process hygiene remain Review-Sylph 2 scope.
- Only this review report was updated.

## Basis Documents Used

- `discussion/implementation/orchestration/wave58-plan.md`
- `discussion/design/screen-design/screens/psd-import-task.md`
- `discussion/design/screen-design/screens/authoring-workspace.md`
- `discussion/design/screen-design/e2e-oracle.md`
- `discussion/design/screen-design/overview.md`
- `discussion/design/screen-design/react-editor-foundation-oracle.md`
- `discussion/design/screen-design/editor-rebuild-purge-policy.md`
- `discussion/design/screen-design/components/toolbox.md`
- `discussion/design/screen-design/components/parts-tree.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `.github/skills/implementation-orchestration/SKILL.md`
- Previous review report: `discussion/implementation/reviews/wave58/wave58-domain-a-ux-source-structure-review.md`
- Implementation evidence: `discussion/implementation/waves/wave58/wave58-domain-a-psd-import-e2e-v0-gnome-report.md`

## Findings

- No blocking UX / design / source-structure findings remain in fix-loop-1.

## Previous Findings Re-check

1. pass: Drawable Inspector no longer leaks raw generated refs into normal UI.

   `apps/editor/src/features/editor-session/model/session-tree.ts:129-137` now projects a selected drawable as normal human-facing rows: `Target`, `Visibility`, `Opacity`, `Part`, `Geometry: Mesh ready`, `Texture: Texture linked`, and `Source: PSD layer`. `rg` found `meshId` / `textureId` construction only inside adapter/planner model boundaries, not in Inspector rendering. No dedicated Import Summary was introduced; `apps/editor/src/workspace/panels/inspector-panel.tsx:22-40` renders a generic `Selection` section from the normal inspector projection.

2. pass: row-level issue DTO projection now matches source ids before rendering binary Issue state.

   `apps/editor/src/features/psd-import/model/psd-import-planner.ts:369-379` builds issue maps by `sourceGroupRef.sourceGroupId` and `sourceLayerRef.sourceLayerId`. Group rows consume the source-group issue map at `apps/editor/src/features/psd-import/model/psd-import-planner.ts:399-403`; leaf rows consume the source-layer issue map at `apps/editor/src/features/psd-import/model/psd-import-planner.ts:432-436`. `createIssueProjection` reduces status/statusReasons/issue DTOs to binary `hasIssue` plus tooltip text at `apps/editor/src/features/psd-import/model/psd-import-planner.ts:448-472`, and the modal renders only a row-level `Issue` badge with tooltip at `apps/editor/src/features/psd-import/components/psd-import-modal.tsx:268-274`.

## Confirmations

- `Import PSD` opens the PSD Import modal from normal workspace entry points: App Bar calls `openPsdImport` for the import entry at `apps/editor/src/workspace/app-bar.tsx:16-20` and `apps/editor/src/workspace/app-bar.tsx:53-55`; Toolbox does the same at `apps/editor/src/workspace/toolbox/workspace-toolbox.tsx:19-23` and `apps/editor/src/workspace/toolbox/workspace-toolbox.tsx:53-63`.
- `PsdImportModal` is mounted over Authoring Workspace at `apps/editor/src/workspace/authoring-workspace.tsx:51-52`.
- The modal is a large Radix Dialog overlay, not a permanent workspace panel: `apps/editor/src/features/psd-import/components/psd-import-modal.tsx:94-99`.
- PSD file selection reads browser file bytes and reaches Import Review through `createPsdImportPlan` at `apps/editor/src/features/psd-import/components/psd-import-modal.tsx:36-52`.
- Import Review focuses on planned Editor Parts structure, not PSD-tree diagnostics: `apps/editor/src/features/psd-import/components/psd-import-modal.tsx:215-227`.
- Planned row kinds are exactly `Part Container`, `Drawable`, and `Hidden Drawable` in `apps/editor/src/features/psd-import/model/psd-import-types.ts:9`, with group/leaf projection at `apps/editor/src/features/psd-import/model/psd-import-planner.ts:397-431`.
- PSD preview is placeholder-only at `apps/editor/src/features/psd-import/components/psd-import-modal.tsx:232-245`.
- Required Review actions are limited to `Cancel` and `Import` at `apps/editor/src/features/psd-import/components/psd-import-modal.tsx:140-160`; no `Choose another file` action was found.
- Import commits through operation-core request creation in `apps/editor/src/features/psd-import/model/psd-import-commit.ts:25-61`, then closes the modal, updates session state, and selects `plan.importRootPartId` at `apps/editor/src/features/editor-session/editor-session-context.tsx:65-70`.
- Workspace Parts Tree renders session-derived rows and selection state at `apps/editor/src/features/editor-session/model/session-tree.ts:38-100` and `apps/editor/src/workspace/panels/structure-tree-panel.tsx:17-36`.
- Inspector shows normal selected part/group/drawable information, not a dedicated Import Summary: `apps/editor/src/features/editor-session/model/session-tree.ts:103-151` and `apps/editor/src/workspace/panels/inspector-panel.tsx:22-40`.
- Normal UI is not polluted with operation IDs, evidence paths, generated refs, parser payloads, approval digests, plan digests, or warning-count summaries. Those strings remain in model/operation boundaries such as `apps/editor/src/features/psd-import/model/psd-import-commit.ts:64-129` and `apps/editor/src/features/psd-import/model/psd-import-planner.ts:124-203`, not rendered UI.
- Source layout follows the React Editor Foundation Oracle shape: `app/`, `workspace/`, `features/`, `ui/`, `state/`, `lib/`, plus a named `editor-workflow/` adapter boundary. No `src/` flat dump or implementation-heavy `index.ts` was found.
- Direct `@webtoon/psd` use inside `apps/editor/src` is confined to `apps/editor/src/editor-workflow/browser-psd-parser-adapter.ts:1-2` and consumed through `parsePsdForEditorImport` from the planner.
- I did not find restoration of the old GUI/e2e/testid/focused registry architecture. The new E2E uses a small number of stable test hooks allowed by the E2E oracle, with no registry/focused architecture under `apps/editor`.
- `git diff --check -- apps/editor package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json scripts discussion` reported no whitespace errors; Git emitted CRLF conversion warnings only.

## Residual Risks

- I did not run the app, Playwright, typecheck, build, or unit tests in this UX/source-structure lane. Gnome recorded validation results; Review-Sylph 2 should independently assess test adequacy and process hygiene.
- The issue DTO path is source-id based now, but this lane did not execute a non-empty issue fixture to prove tooltip text at runtime.
- `apps/editor/src/features/psd-import/model/psd-import-planner.ts` is a 541-line v0 bridge spanning parse planning, scaffold DTO construction, review-row projection, evidence bridge creation, IDs, and hashing. It is not an `index.ts` or catch-all policy violation now, but it should be split if it grows in follow-up waves.
- `apps/editor/src/workspace/workspace-data.ts` still contains unused static `structureRows` and `inspectorSections` placeholders. They are no longer rendered by the Parts Tree / Inspector path, so this is not blocking for Domain A, but cleanup would reduce future confusion.
- The worktree contains pre-existing dirty files outside the Domain A source set. I did not revert or attribute unrelated dirty changes.

## User-Decision Points

- None.
