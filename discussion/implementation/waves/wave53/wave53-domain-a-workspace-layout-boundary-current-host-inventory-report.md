# Wave53 Domain A Report: Workspace Layout Boundary / Current Host Inventory

> Target: `wave53-workspace-layout-boundary-current-host-inventory`  
> Role: Domain A Orch-Sylph boundary and current-host inventory coordinator  
> Verdict: `pass`

## Verdict

`pass`

Wave53 can proceed to Domains B and C in parallel after the required independent Review-Sylph review for this report passes.

Domain A did not implement source code. No production source, tests, scripts, fixtures, package metadata, lockfiles, generated assets, or application code were modified by this report. Domain A is a boundary-only gate that fixes the current workspace host facts, visible-surface classification, B/C/D write ownership, DOM/text oracle risks, focused regression targets, and user-decision points before source implementation begins.

Mandatory separation basis:

```text
Orch-Sylph自身は実装担当ではない。source implementation は必ず別コンテキストの Gnome に委譲し、レビューは必ず別コンテキストの Review-Sylph に委譲すること。これを分離できない場合は実装せず escalate / blocked として報告すること。
```

Domain A has no source implementation deliverable, so no Gnome source implementation was delegated.

## Basis Documents Used

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave53-plan.md`
- `discussion/implementation/orchestration/wave52-plan.md`
- `discussion/implementation/waves/wave52/wave52-final-integration-report.md`
- `discussion/implementation/reviews/wave52/wave52-final-integration-review.md`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/remaining-work-backlog.md`
- `discussion/design/codex-friendly-automation-policy.md`
- `discussion/design/screen-design/_map.md`
- `discussion/design/screen-design/scope-and-principles.md`
- `discussion/design/screen-design/overview.md`
- `discussion/design/screen-design/screens/authoring-workspace.md`
- `discussion/design/screen-design/components/toolbox.md`
- `discussion/design/screen-design/components/parts-tree.md`
- `discussion/design/screen-design/components/drawable-inspector.md`
- `discussion/design/screen-design/components/parameter-keyform.md`
- `discussion/design/screen-design/screens/psd-import-task.md`
- `discussion/design/screen-design/screens/diagnostics-evidence-view.md`
- `discussion/design/screen-design/screens/codex-automation-view.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/tests/traceability/test-traceability-matrix.md`, only for focused regression target identification
- `discussion/tests/fixtures/fixture-manifest.md`, only for focused regression target identification
- Wave52 Domain A/D/E reports and Domain A review, only to carry forward the proven PSD Import task and guard baseline

## Bounded Source Files Inspected

Source inspection was limited to the workspace host, shell/task entry points, stable test hooks, focused regression references, and source-boundary risks.

- `apps/editor/src/main.ts`
- `apps/editor/src/app/editor-app.ts`
- `apps/editor/src/ui/app-shell/app-shell.ts`
- `apps/editor/src/ui/app-shell/shell-surfaces.ts`
- `apps/editor/src/ui/app-shell/task-shell.ts`
- `apps/editor/src/ui/app-shell/app-shell.test.ts`
- `apps/editor/src/ui/app-shell/task-shell.test.ts`
- `apps/editor/src/editor-state/editor-test-ids.ts`
- `apps/editor/e2e/test-ids.mjs`
- `apps/editor/e2e/smoke-checks.mjs`
- `apps/editor/e2e/psd-import-focused-smoke.mjs`
- `apps/editor/e2e/psd-import-plan-focused-smoke.mjs`
- `apps/editor/e2e/psd-import-plan-codex-focused-smoke.mjs`
- `apps/editor/e2e/psd-multi-layer-batch-focused-smoke.mjs`
- `apps/editor/e2e/psd-structural-initial-state-focused-smoke.mjs`
- `scripts/focused-e2e-registry.mjs`
- `scripts/wave42-focused-e2e-boundary.mjs`
- `scripts/check-production-testid-boundary.mjs`
- `package.json`, only for existing verification script names

## Current Workspace Host Facts

Current entry points:

- `apps/editor/src/main.ts` locates `#app` and calls `mountEditorApp(root)`.
- `apps/editor/src/app/editor-app.ts` owns the browser workflow controller and local task state. Wave52 added `activeTask: "psdImport" | null`; `onOpenPsdImportTask` sets it to `"psdImport"`, and `onCloseActiveTask` resets it to `null`.
- `apps/editor/src/ui/app-shell/app-shell.ts` builds the visible shell. It creates `main.editor-shell` with `data-testid="editor.shell"`, an App Bar, and one `section.editor-workspace` with `aria-label="Editor workspace"`.
- The current `editor-workspace` is still a legacy host: it carries `data-shell-surface-id="authoringWorkspace"` and `data-shell-surface-group="legacy-host"`, then appends many panels in sequence.
- `apps/editor/src/styles/editor.css` currently defines the workspace as a two-column grid, `minmax(0, 1fr) minmax(320px, 440px)`, with a single-column responsive fallback under `860px`. It does not yet implement the Wave53 App Bar / Toolbox / Parts Tree / Canvas / Inspector / Parameter Bar / Diagnostics Strip skeleton.

Current important host append order in `createEditorAppShell`:

1. `parameter-list` panel.
2. `canvas-preview` panel.
3. `tutorial-workflow` task panel.
4. Optional `viewer-runtime` view panel.
5. `drawable-composition` panel.
6. `active-tool-rig` panel.
7. `active-tool-dynamics` panel.
8. `parameter-operation` panel.
9. `parts-tree` panel.
10. `drawable-authoring` panel.
11. `source-intake` task panel.
12. `task-launcher` with `Import PSD`.
13. Optional active PSD Import task shell.
14. `project-persistence` task panel.
15. `product-preflight` task panel.
16. `proposal-review`, `ai-approval`, and `ai-transcript` Codex / automation panels.
17. `operation-persistence-evidence` diagnostics/evidence grid.

PSD Import Task preservation facts:

- The visible launcher is `editorTestIds.psdImportTaskOpen` / `psdImport.task.open`.
- The opened task shell uses `shellSurfaces.psdImportTask`, `data-task-shell-region` regions, and the `psd-import` shell-surface group.
- The PSD Import task content preserves `editorTestIds.explicitPsdImportPanel` / `explicitPsdImport.panel` inside the task shell.
- Focused PSD e2e helpers open the task by clicking `psdImport.task.open` if `explicitPsdImport.panel` is absent, then continue to use the stable existing PSD IDs.
- PSD Import is no longer a default always-visible workspace panel under the Wave52 final baseline.

## Existing Visible Surface Classification

| Existing surface group / file area | Current classification | Wave53 v0 handling |
|---|---|---|
| App Bar and package status | Normal human authoring shell | D owns final shell integration. B/C must not rework App Bar wiring. |
| `task-launcher` / `psdImport.task.open` | Normal human entry point, but minimal and not final Toolbox | B may introduce the Toolbox launcher surface; D must preserve the PSD Import entry and route it through the existing task state. |
| `canvas-preview` / Preview panel | Normal human authoring UI, central semantic preview | D owns central Canvas / Preview placement and smoke preservation. B/C must not move preview wiring. |
| `parts-tree` / layer tree | Normal human authoring UI for structure/list/selection | B owns left-side Parts Tree surface. Preserve row IDs and existing structure operations. |
| `drawable-authoring` and current drawable list | Normal human authoring UI, but split across old panels | B may reuse/migrate list/row pieces for Parts Tree only under assigned files. C/D must not independently edit list ownership. |
| `parameter-list` and `parameter-operation` | Current human UI; Wave53 target is a smaller Parameter Bar shell plus future manager | C owns Parameter Bar v0 shell and summary/control boundary. Full Parameter Manager is out of scope. |
| `drawable-composition`, `rig-control`, `dynamics` | Current active-tool/context controls; some sections include evidence/diagnostics | C owns right-side Inspector and bottom/summary extraction only. Full tool redesign, Mesh/Atlas/Parameter/Variant capability, and broad behavior moves are out of scope. |
| `source-intake`, `project-persistence`, `product-preflight`, `tutorial-workflow`, optional `viewer-runtime` | Human-reachable tasks/views, not normal authoring primary content | D must keep reachable. B/C should not make these primary workspace content. |
| `operation-persistence-evidence`, operation log, generated evidence, package file set, reload summary | Debug/evidence | C may expose summary-only Diagnostics Strip. Full detail remains future Diagnostics / Evidence View work. |
| `codexProposalReview`, `aiApproval`, `aiTranscript` | Codex / automation | Must remain reachable but not primary human authoring UI. Full Codex / Automation View is out of Wave53. |
| PSD Import Task panel | Human task UI, reachable from workspace, not always-visible primary workspace | D must preserve Task Shell path. B/C must not reintroduce it as a default panel. |
| Stable `data-testid`, `data-shell-surface-*`, `data-task-shell-region`, and PSD observation `data-*` attributes | Test-facing / structured observation hooks | Preserve or migrate only with reviewed replacement before E. Production behavior must not query `data-testid`. |

## B/C/D Ownership Matrix

The main parallel-collision risk is `apps/editor/src/ui/app-shell/app-shell.ts` and `apps/editor/src/styles/editor.css`. To keep B and C parallel, both must avoid final App Shell append-order/layout integration. D owns the final wiring and shared responsive CSS.

| Domain | Owns | Primary source write scope for later implementation | Must not edit / must escalate |
|---|---|---|---|
| B: Toolbox / Parts Tree left surfaces | Left launcher and Structure / Parts surfaces. Toolbox is a launcher only. Parts Tree is hierarchy/list/selection home. | New narrowly named files under `apps/editor/src/ui/app-shell/**` for Toolbox/left-surface component factories and focused tests; `apps/editor/src/ui/layer-tree/**` for Parts Tree surface migration; `apps/editor/src/ui/drawable-authoring/drawable-list.ts` and related focused tests only if explicitly reusing/moving the current drawable list into Parts Tree. | Do not edit `apps/editor/src/app/editor-app.ts`; do not perform final `app-shell.ts` integration; do not edit PSD Import workflow/content; do not edit Inspector/Parameter/Diagnostics surfaces; do not edit `apps/editor/e2e/**`; do not edit `package.json`, scripts, lockfiles, or broad CSS layout. If B needs global `editor.css` or `app-shell.ts` integration, report it to D. |
| C: Inspector / Parameter Bar / Diagnostics Strip | Right-side Inspector shell; bottom Parameter Bar v0; bottom Diagnostics Strip summary only. Human summary/control boundary for contextual surfaces. | New narrowly named files under `apps/editor/src/ui/app-shell/**` for Inspector/Parameter Bar/Diagnostics Strip component factories and focused tests; `apps/editor/src/ui/parameter-operation/**` for narrow Parameter Bar reuse/extraction; `apps/editor/src/ui/composition-panel/**`, `apps/editor/src/ui/rig-control-panel/**`, `apps/editor/src/ui/dynamics-panel/**`, `apps/editor/src/ui/product-preflight/**`, and `apps/editor/src/ui/evidence-panel/**` only for summary extraction that does not change product behavior. | Do not edit `apps/editor/src/app/editor-app.ts`; do not perform final `app-shell.ts` integration; do not edit Toolbox/Parts Tree files; do not implement full Diagnostics / Evidence View, full Codex / Automation View, full Parameter Manager, Mesh/Atlas/Variant capability, or broad evidence migration; do not edit PSD Import Task workflow/content; do not edit `apps/editor/e2e/**`, package scripts, lockfiles, or broad CSS layout. If C needs global `editor.css` or `app-shell.ts` integration, report it to D. |
| D: Authoring Workspace shell integration / central Canvas and PSD entry preservation | Final v0 workspace shell integration, append order, App Bar/top/left/center/right/bottom layout, central Canvas/Preview, responsive skeleton, PSD Import task entry preservation, B/C reconciliation. | `apps/editor/src/app/editor-app.ts`; `apps/editor/src/ui/app-shell/app-shell.ts`; `apps/editor/src/ui/app-shell/app-shell.test.ts`; `apps/editor/src/styles/editor.css`; `apps/editor/src/editor-state/editor-test-ids.ts` and `apps/editor/e2e/test-ids.mjs` only if new stable IDs are necessary; `apps/editor/src/ui/preview-panel/**` only if central Canvas placement requires narrow adjustments; focused e2e updates only where layout migration requires stable opening/selecting behavior. | Do not broaden visual redesign beyond v0 skeleton; do not rework unrelated workflows; do not remove PSD Import Task Shell path; do not make PSD Import always-visible again; do not add Mesh/Atlas/Parameter/Variant capability; do not make B/C implementation choices by silently editing their owned component files except integration reconciliation documented in D. |

Parallel-start rule:

- B and C may start in parallel only after this report and independent review pass.
- B and C should create/factor component surfaces and focused unit/component tests in disjoint files.
- D remains the first domain allowed to integrate both into `createEditorAppShell`, own shared responsive CSS, and update e2e layout or opening behavior.
- If B/C cannot produce useful component surfaces without both editing the same existing global file, escalate rather than running parallel writes.

## DOM/Text Oracle And `data-testid` Risks

Stable test-facing hooks to preserve or migrate only with a reviewed replacement:

- App shell/layout: `editor.shell`, `preview.panel`, `preview.visual`, `preview.summary`, `preview.reset`, `preview.empty`, `layerTree.panel`, `layerTree.summary`, generated `layerTree.part.*` and `layerTree.drawable.*`, `drawableAuthoring.panel`, `drawable.list`, generated `drawable.row.*`, `projectPersistence.*`, `productPreflight.*`, `viewerRuntime.*`.
- PSD Task entry and content: `psdImport.task.open`, `explicitPsdImport.panel`, `explicitPsdImport.form`, `explicitPsdImport.fileInput`, `explicitPsdImport.submit`, `explicitPsdImport.status`, `explicitPsdImport.source`, `explicitPsdImport.document`, `explicitPsdImport.layerTree`, import-plan IDs, structural-scaffold IDs, batch-intake IDs, and result/diagnostics IDs.
- Codex/automation: `codexProposalReview.*`, `aiApproval.*`, `aiTranscript.*`.
- Diagnostics/evidence: `operationLog.summary`, `evidence.generated.summary`, `package.reload.summary`, package file set panel IDs, and existing evidence/diagnostics IDs inside rig/composition/dynamics panels.

Specific risks:

- `apps/editor/e2e/test-ids.mjs` mirrors `apps/editor/src/editor-state/editor-test-ids.ts`. Any ID addition/removal/rename must update both sides and the relevant tests.
- Many e2e oracles still use `document.querySelector([data-testid=...])` plus `textContent.includes(...)`. Moving visible text between panels can break tests even when behavior is preserved.
- PSD focused e2e assumes the task can be opened through `psdImport.task.open` and then observes `explicitPsdImport.panel`. D/E must preserve that path or provide a stable reviewed replacement.
- `apps/editor/src/ui/app-shell/app-shell.test.ts` checks `data-shell-surface-*`, `data-shell-surface-group`, and `data-task-shell-region`. Layout changes should preserve meaningful shell-surface metadata or update tests with equivalent structured surface assertions.
- PSD Import Task observation summary currently exposes structured `data-psd-import-task-*` attributes and text mentioning `diagnosticsEvidenceView`. Wave53 may keep this as interim; replacing it with human navigation polish is a future Diagnostics / Evidence placement decision unless D does a narrow, reviewed wording change.
- `node scripts/check-production-testid-boundary.mjs` forbids production behavior from querying `[data-testid]` or reading the `data-testid` attribute. B/C/D must continue using `data-testid` only as assignment/test-facing observation hooks.
- Broad DOM/text oracle migration is explicitly out of Wave53. Where visible text must move, keep an existing test-facing ID on a stable wrapper or add a narrow structured observation hook, then let E update tests without weakening assertions.

## Focused Regression Targets For Domain E

Minimum Wave53 E targets:

- Desktop/mobile editor aggregate smoke through `pnpm test:e2e` / `pnpm --filter @private-2d-rigging-lab/editor test:e2e`, with attention to `apps/editor/e2e/smoke-checks.mjs`.
- Existing editor smoke/layout paths: shell load, preview reachable/usable, no horizontal overflow checks, Preview summary/visual, drawable create/list/order, Parts Tree direct manipulation, project save/load/reset, Product Preflight, Viewer / Runtime, AI approval/transcript, and app bar viewer shortcut.
- New or updated Wave53 layout smoke: v0 skeleton loads with App Bar, Toolbox, Structure / Parts, central Canvas / Preview, right Inspector, Parameter Bar, and Diagnostics Strip on desktop; mobile/responsive layout remains non-overlapping and keeps core controls reachable.
- Required PSD focused paths from Wave52:
  - `node scripts/run-focused-e2e.mjs --id psdStructuralInitialStateFocused`
  - `node scripts/run-focused-e2e.mjs --id psdImportPlanCodexFocused`
  - `node scripts/run-focused-e2e.mjs --id psdImportPlanFocused`
  - `node scripts/run-focused-e2e.mjs --id psdMultiLayerBatchFocused`
  - `node scripts/run-focused-e2e.mjs --id psdImportFocused`
- Guard/registry/source checks:
  - `node scripts/check-production-testid-boundary.mjs`
  - `node scripts/check-production-testid-boundary-fixtures.mjs`
  - `node scripts/check-psd-parser-import-boundary.mjs`
  - `node scripts/check-focused-e2e-registry.mjs`
  - `node scripts/check-wave42-quality-gate-boundary.mjs`
  - `pnpm run check:source`
  - `pnpm run check:deps`
  - `pnpm run check`
- Type/unit baseline:
  - `pnpm typecheck`
  - `pnpm test:unit`
- Diff hygiene:
  - `git diff --check -- apps packages scripts fixtures test_data generated discussion discussion/implementation discussion/development_convention discussion/tests`

Domain E should not broaden aggregate e2e scope to compensate for weak focused assertions. If a test text oracle becomes unstable because Wave53 moved a human label, E should prefer a stable `data-testid`/structured hook replacement over weakening the behavioral assertion.

## User-Decision Points

No immediate user decision is required before Domains B and C start.

Reasoning:

- Wave53 plan already accepts a v0 skeleton direction: App Bar top, left Toolbox, left Structure / Parts, central Canvas / Preview, right Inspector, bottom Parameter Bar, bottom Diagnostics Strip summary.
- The remaining screen-design uncertainties are final design decisions, not blockers for a v0 skeleton.
- PSD Import remains a Task Shell task opened from Empty / Authoring Workspace; no final modal/task-window/dedicated-view decision is required for B/C.

Escalate to Undine if any later domain discovers that implementation requires:

- changing final Toolbox placement beyond the accepted v0 skeleton;
- deciding final modal/task-window/dedicated-view policy;
- broad visual redesign or CSS framework migration;
- moving Diagnostics / Evidence or Codex / Automation into final primary workspace form;
- hiding required controls without replacement;
- weakening existing focused e2e or `data-testid` guard assertions;
- adding Mesh / Atlas / Parameter Manager / Variant Manager capability;
- semantic recognition, proposal generation, auto-rigging, auto-fix, external transport, renderer/pixel oracle, Cubism compatibility, public demo assets, or persisted source PSD/raw parser objects.

## Verification Performed

- Loaded the required orchestration and context-hygiene skills.
- Read Wave53 planning basis and Wave52 final baseline documents.
- Read the screen-design documents needed for Authoring Workspace, Toolbox, Parts Tree, Drawable Inspector, Parameter / Keyform, PSD Import Task, Diagnostics / Evidence View, and Codex / Automation View.
- Performed bounded source inventory of the current app mount, App Shell host, shell-surface metadata, Task Shell, stable test IDs, PSD focused task opening preconditions, and production `data-testid` guard.
- Did not edit source code or tests.
- Did not run unit/e2e/guard commands because Domain A is a boundary inventory; the only expected command-level check for this domain is diff hygiene after report/review artifacts exist.

## Review Handoff

Independent Review-Sylph review is required at:

- `discussion/implementation/reviews/wave53/wave53-domain-a-workspace-layout-boundary-current-host-inventory-review.md`

The reviewer should use this report plus the basis documents and bounded source paths above, not this Orch-Sylph explanation alone.
