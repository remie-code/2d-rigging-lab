# Wave54 Domain G Review: App Shell Integration / Window Routing

## Verdict

`pass`

Domain G is acceptable as the App Shell integration / window-routing pass. The change wires PSD Import, Diagnostics / Evidence, and Codex / Automation through centralized App Shell active-task state, mounts each as a workspace-scoped task window, preserves the Authoring Workspace v0 skeleton, and leaves Viewer / Runtime on its existing dedicated-view path.

## Findings

Blocking findings: none.

Non-blocking residuals:

- `psdImportFocused` still fails after the PSD task opens and parses, at a PSD content/status assertion expecting `psd:root/layer[0]`. I reproduced the same failure: `status missing "psd:root/layer[0]" in "Parse StateStatusPSD parsed in browser sessionSelected leaf layers1 selected PSD leaf layer"`. The changed G routing files do not change PSD parser, plan, scaffold, or import semantics. The visible diff points to Domain C/F surface/test-oracle movement: Domain C made Parse State concise by replacing the raw selected node ref with selected leaf-layer count, and Domain F only routed the opener through a scoped helper. This is not a Domain G routing blocker, but H/final verification must resolve the focused PSD oracle before Wave54 can close.
- Focus behavior is covered for initial task-window focus, close, and Escape. The current app-level focus helper focuses the active workspace task window after each render while an active task exists. I did not find a G-blocking regression, but later PSD polish should watch for focus being restored to the window root after task-internal rerenders.

## Scope Reviewed

Target files reviewed:

- `apps/editor/src/app/editor-app.ts`
- `apps/editor/src/ui/app-shell/app-shell.ts`
- `apps/editor/src/ui/app-shell/authoring-workspace-v0-shell.ts`
- `apps/editor/src/ui/app-shell/app-shell.test.ts`
- `apps/editor/e2e/task-window-routing-focused-smoke.mjs`
- `scripts/focused-e2e-registry.mjs`
- `scripts/wave42-focused-e2e-boundary.mjs`

Consumed dependencies reviewed:

- `apps/editor/src/ui/app-shell/task-shell.ts`
- `apps/editor/src/ui/app-shell/diagnostics-evidence-view-skeleton.ts`
- `apps/editor/src/ui/app-shell/codex-automation-view-skeleton.ts`
- `apps/editor/e2e/selector-scopes.mjs`

Basis used included the required orchestration/context-hygiene docs, Wave54 plan, Domain A-F reports/reviews under `discussion/implementation/waves/wave54/` and `discussion/implementation/reviews/wave54/`, the screen specs for Authoring Workspace / PSD Import Task / Diagnostics Evidence / Codex Automation / Toolbox, and the source-file organization policy.

## Design / Development Compliance

`pass`

- App route state is centralized in `EditorAppShellActiveTask` with `"psdImport"`, `"diagnosticsEvidence"`, and `"codexAutomation"` routes, and `mountEditorApp()` updates that local state via explicit callbacks rather than DOM/test-id state.
- `createActiveWorkspaceSurfaceShell()` mounts the active surface immediately after the Authoring Workspace v0 primary layout and before legacy support panels. PSD Import remains absent by default and appears only when routed.
- Diagnostics / Evidence and Codex / Automation are enabled from Toolbox as skeleton routes and are clearly labelled/statused as read-only bounded skeletons. They do not claim final full view implementation.
- Viewer / Runtime still uses `viewerRuntime.isOpen` and `createViewerRuntimePanel()` outside `activeTask`; it was not converted into a task window.
- No new Mesh / Atlas / Parameter / Variant capability, external transport, semantic recognition, proposal generation, auto-rigging, auto-fix, automatic commit, Cubism integration, renderer/pixel oracle, or PSD semantics change was found in the G diff.
- Production behavior does not query `data-testid`. The only production `querySelector` added for routing/focus uses explicit `data-task-window-*` shell metadata. `data-testid` additions remain test-facing observation hooks.
- Source organization is acceptable: no `index.ts` logic, catch-all file, broad utility, or dependency/lockfile churn was introduced.

The `scripts/focused-e2e-registry.mjs` and `scripts/wave42-focused-e2e-boundary.mjs` changes are acceptable for Domain G. They add exactly one Wave54 focused smoke entry, `taskWindowRoutingFocused`, as standalone direct verification and mirror the existing post-Wave42 overlay/boundary pattern. The registry/quality-gate guards still pass with 25 entries.

## Test Adequacy

`pass`

- `app-shell.test.ts` covers PSD closed-by-default behavior, PSD task-window metadata, close/back/Escape wiring, Diagnostics skeleton routing, Codex skeleton routing, and mutual absence of other task content while each route is active.
- `task-window-routing-focused-smoke.mjs` covers real browser route open/close from Toolbox for PSD, Diagnostics, and Codex; asserts workspace-scoped task-window metadata, role, Escape shortcut, focus, skeleton bounded/read-only content, and no stale route after close.
- Selector use is scoped through `selectorScopes.toolbox` and `selectorScopes.psdImportTaskWindow` for the new focused smoke. Test selectors are not used as production behavior inputs.
- Coverage intentionally does not parse PSD in `taskWindowRoutingFocused`; that is the right separation for a G routing test. PSD content/scaffold oracles remain the focused PSD IDs and H/final verification.

## Verification Performed

- `node --check apps/editor/e2e/task-window-routing-focused-smoke.mjs`: pass.
- `node scripts/check-focused-e2e-registry.mjs`: pass, 25 entries.
- `node scripts/check-wave42-quality-gate-boundary.mjs`: pass, 5 categories / 25 focused e2e entries / 9 explicit non-goals.
- `git diff --check -- <Domain G target files>`: pass; CRLF working-copy warnings only.
- `pnpm.cmd exec vitest run apps/editor/src/ui/app-shell/app-shell.test.ts apps/editor/src/ui/app-shell/task-shell.test.ts apps/editor/src/ui/app-shell/diagnostics-evidence-view-skeleton.test.ts apps/editor/src/ui/app-shell/codex-automation-view-skeleton.test.ts`: sandbox run hit esbuild `spawn EPERM`; escalated rerun passed, 4 files / 47 tests.
- `pnpm.cmd typecheck`: pass.
- `pnpm.cmd run check:source`: pass.
- `pnpm.cmd run check:testids`: pass.
- `node scripts/run-focused-e2e.mjs --id taskWindowRoutingFocused`: sandbox run hit Vite/esbuild `spawn EPERM`; escalated rerun passed, desktop surfaces `psdImportTask`, `diagnosticsEvidenceView`, `codexAutomationView`.
- `node scripts/run-focused-e2e.mjs --id psdImportFocused`: escalated rerun reproduced the known post-parse content assertion failure noted above.

## Residual Risks / User Decision Points

- No user decision point is needed for Domain G.
- Wave54 H/final verification must decide the exact fix for `psdImportFocused`: either update the focused oracle to the accepted concise PSD Task UI shape or route it back to the Domain C PSD-content owner. G should not fix this by reintroducing raw selected PSD node refs into the task-window route.
- Mobile/responsive task-window layout remains a Domain H verification responsibility; Domain G's new focused smoke currently covers desktop routing.
