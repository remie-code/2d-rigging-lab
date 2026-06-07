# Wave54 Domain A Report: Boundary / Current Surface Inventory

> Target: `wave54-boundary-current-surface-inventory`  
> Role: Domain A Orch-Sylph  
> Verdict: `pass`

## Verdict

`pass`

Wave54 B-F may start as a 5-way parallel batch if they keep the file ownership below. The current repository surface supports the Wave54 direction: PSD Import already opens from the Toolbox through the App Shell task route, but it is still rendered as an in-workspace `TaskShell` section rather than a workspace-scoped window with focus / escape / overlay behavior. Diagnostics / Evidence and Codex / Automation already have shell-surface metadata and legacy panel candidates, but no separated skeleton views or enabled Toolbox routes.

No source, test, fixture, package, lockfile, or generated asset was edited by Domain A.

## Basis

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `C:/Users/remie/.codex/skills/planning-gate/SKILL.md`
- `discussion/implementation/orchestration/wave54-plan.md`
- `discussion/implementation/orchestration/wave53-plan.md`
- `discussion/implementation/waves/wave53/wave53-final-integration-report.md`
- `discussion/implementation/reviews/wave53/wave53-final-integration-review.md`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/remaining-work-backlog.md`
- `discussion/design/codex-friendly-automation-policy.md`
- `discussion/design/screen-design/_map.md`
- `discussion/design/screen-design/scope-and-principles.md`
- `discussion/design/screen-design/overview.md`
- `discussion/design/screen-design/screens/authoring-workspace.md`
- `discussion/design/screen-design/screens/psd-import-task.md`
- `discussion/design/screen-design/screens/diagnostics-evidence-view.md`
- `discussion/design/screen-design/screens/codex-automation-view.md`
- `discussion/design/screen-design/components/toolbox.md`
- `discussion/design/screen-design/components/parts-tree.md`
- Minimal test/fixture refs: `discussion/tests/traceability/test-traceability-matrix.md`, `discussion/tests/fixtures/fixture-manifest.md`

## Current Surface Inventory

### App Shell task routing

- `apps/editor/src/app/editor-app.ts` owns the current local route state: `activeTask: EditorAppShellActiveTask = null`, with `onOpenPsdImportTask()` setting `"psdImport"` and `onCloseActiveTask()` returning to `null`.
- `apps/editor/src/ui/app-shell/app-shell.ts` defines `EditorAppShellActiveTask = "psdImport" | null`.
- `createEditorAppShell()` appends the primary Authoring Workspace v0 layout first, then appends `createPsdImportTaskShell()` only when `activeTask === "psdImport"`.
- Current routing is therefore single-task and PSD-only. It does not yet model `diagnosticsEvidenceView` or `codexAutomationView` as openable active workspace surfaces.
- Viewer / Runtime is separate: it is controlled by workflow state (`viewerRuntime.isOpen`) and remains dedicated-view leaning. It should not be converted into a Wave54 task window.

### Toolbox launch path

- `apps/editor/src/ui/app-shell/authoring-workspace-v0-shell.ts` builds the Toolbox through `createAuthoringToolboxSurface()`.
- Current enabled routes:
  - `import-psd` calls `options.onOpenPsdImportTask?.()`.
  - `viewer-runtime` calls `options.onOpenViewerRuntimeSurface()`.
- Current disabled launchers:
  - Active tool launchers: Mesh / Rig / Dynamics are disabled with support-panel messaging.
  - Task launchers: Parameter Manager, Storage, Validate are disabled or support-panel routed.
  - View launchers: Diagnostics and Codex are disabled because dedicated views are not available yet.
- `apps/editor/src/ui/app-shell/toolbox-surface.ts` is generic enough for actions / tasks / views, but final enabling and route mapping must be owned by G, not by B-F.

### PSD Import surface

- PSD Import is created by `createPsdImportTaskShell()` in `apps/editor/src/ui/app-shell/app-shell.ts`.
- It uses `createTaskShell()` from `apps/editor/src/ui/app-shell/task-shell.ts` with title/status, Back, Close, diagnostics summary, and content slots.
- The PSD content comes from `apps/editor/src/ui/explicit-psd-import/explicit-psd-import-panel.ts`, especially `createExplicitPsdImportTaskContent()`.
- Current PSD content has a useful `Task Summary`, but still includes large `Technical Workflow Details` sections with parser session, source/document facts, import-plan preview/candidates/diagnostics, structural scaffold preview/nodes/diagnostics/results, selected layer intake, batch intake, persistence boundary, diagnostics, and layer tree.
- The observation projector in `apps/editor/src/editor-state/explicit-psd-import-task-observation.ts` already points detailed PSD evidence to `diagnosticsEvidenceView` and exposes structured dataset fields on the task observation summary.
- C should polish PSD task content without changing import/scaffold semantics and without implementing generic task window behavior.

### Legacy support panels

`apps/editor/src/ui/app-shell/app-shell.ts` still appends many panels into `createWorkspaceSupportRegion()`, which is marked `shellSurfaceGroup="legacy-support"`:

- Human authoring / currently reachable support:
  - Parameters panel and create parameter operation panel.
  - Tutorial workflow panel.
  - Composition, Rig Control, Dynamics, Drawable Authoring.
  - Source Intake, Project Persistence, Product Preflight.
- Diagnostics / Evidence candidates:
  - Operation log summary.
  - Generated evidence summary.
  - Package file set.
  - Reload summary.
  - Product Preflight details where full diagnostics exceed the Diagnostics Strip.
  - PSD Import evidence details summarized by the PSD observation projector.
- Codex / Automation candidates:
  - Codex Proposal Review.
  - AI Approval.
  - AI Transcript.
  - Command surface / proposal availability status currently implied by existing panels and Codex-facing APIs.

Wave54 should create separated skeleton homes for Diagnostics / Evidence and Codex / Automation, but it should not move every legacy panel or claim final full view completion.

### Selector / test risks

- Stable IDs already used by focused PSD e2e include `psdImport.task.open` and `explicitPsdImport.panel`.
- Existing focused PSD e2e helpers open the PSD task by clicking `psdImport.task.open` if `explicitPsdImport.panel` is not already present.
- App Shell unit tests already assert:
  - PSD panel is not appended by default.
  - PSD Import renders inside a task shell when `activeTask: "psdImport"`.
  - surface metadata exists for `diagnosticsEvidenceView` and `codexAutomationView`.
  - legacy support panels are classified without moving workflows.
- `drawable.list` appears both in the Wave53 Parts Tree surface and the legacy Drawable Authoring panel. Wave53 assessed this as nonblocking, but future legacy-list tests must scope through `drawableAuthoring.panel` or a stable wrapper.
- The production `data-testid` guard is available through standard `check:testids`; fixture self-test remains available but outside standard `check`.
- Risk for Wave54: if the task window uses DOM text or broad `[data-testid]` selection as behavior input, it violates the Wave51-Wave53 boundary. New task-window behavior should use explicit local state and callbacks; test IDs remain test-facing observation only.

## B-F Ownership Matrix

| Domain | Owns | Must not edit / own | Notes |
|---|---|---|---|
| B Generic Task Window Shell | `apps/editor/src/ui/app-shell/task-shell.ts`, `apps/editor/src/ui/app-shell/task-shell.test.ts`, optional new `apps/editor/src/ui/app-shell/task-window-*.ts`, generic task-window CSS blocks in `apps/editor/src/styles/editor.css` | PSD import content, Toolbox route wiring, `apps/editor/src/app/editor-app.ts`, final App Shell integration | B may evolve existing `TaskShell` into the generic workspace-scoped task window shell. It must stay PSD-independent. |
| C PSD Import Task Window Polish | `apps/editor/src/ui/explicit-psd-import/**`, focused PSD component tests | Generic shell/chrome, `app-shell.ts` final routing, PSD workflow semantics, package/workflow code, broad e2e rewrite | C may split or reorganize PSD Human UI inside the task content. It should avoid CSS ownership unless B exposes stable generic classes; final placement styling belongs to B/G. |
| D Diagnostics / Evidence View Skeleton | New narrowly named files such as `apps/editor/src/ui/app-shell/diagnostics-evidence-view-skeleton.ts` and matching test | Codex/Automation content, final App Shell routing, broad evidence migration, Product Preflight redesign | D creates a minimal read-only skeleton and slots for operation log, generated evidence, package file set, reload summary, full diagnostics, and PSD evidence detail availability. |
| E Codex / Automation View Skeleton | New narrowly named files such as `apps/editor/src/ui/app-shell/codex-automation-view-skeleton.ts` and matching test | Diagnostics/Evidence content, proposal generation, LLM/provider work, external transport, final App Shell routing | E creates a minimal skeleton for proposal review, approval, transcript, command surface status, and PSD import command availability. |
| F Test-facing / Selector Scope Hardening | Focused `apps/editor/e2e/**` helper/hardening files, focused selector tests, guard registration fixes if needed, traceability/fixture notes only if actually changed | Product UI features, B/C/D/E components, final App Shell routing, weakening focused tests, broad DOM/text oracle rewrite | F should prepare selector/window observation hardening and duplicate `drawable.list` scoping. G/H own final task-window route verification after integration. |

### CSS collision rule

`apps/editor/src/styles/editor.css` is a shared single CSS file. To preserve 5-way parallelism:

- B may edit generic `.editor-task-shell` / `.task-shell` / task-window CSS.
- C/D/E should avoid CSS edits in their parallel pass unless they use narrowly scoped new classes and A/G explicitly accepts the collision risk.
- G owns any final integration positioning CSS after B-F pass.

## G Integration Contract

G starts only after B-F are `pass`.

G owns:

- Final App Shell route model and route state in `apps/editor/src/app/editor-app.ts`.
- App Shell integration in `apps/editor/src/ui/app-shell/app-shell.ts`.
- Final Toolbox route enablement and item mapping in `apps/editor/src/ui/app-shell/authoring-workspace-v0-shell.ts`.
- Wiring PSD Import so the Toolbox opens it in the workspace-scoped task window.
- Wiring Diagnostics / Evidence and Codex / Automation skeleton entry points without claiming final full implementations.
- Close/back return to Authoring Workspace and any integration-level focus/escape callbacks exposed by B.
- Integration tests and narrow e2e route tests that require B-F outputs together.

G must not:

- Change PSD import/scaffold semantics.
- Reintroduce PSD Import as a default always-visible panel.
- Move all legacy support panels or delete broad legacy UI in Wave54.
- Convert Viewer / Runtime into a task window.
- Add Mesh / Atlas / Parameter Manager / Variant Manager implementation.
- Add proposal generation, semantic recognition, auto-rigging, auto-fix, automatic commit, LLM/provider, or external transport.

## Parallelism Decision

B-F may start in parallel: `yes`.

Recommended batch:

- Batch 2: B, C, D, E, F together.
- B-F should each write an independent report/review under Wave54.
- If B changes the public shape of `createTaskShell()` in a way that C/D/E need, B should finish first or publish a very small compatibility note. Until then, C/D/E should use existing shell assumptions and not import B-only new APIs.
- If C discovers it must edit `app-shell.ts` to mount PSD content, it should stop and report that as G-owned integration work.
- If D/E discover they need shared route state or enabled Toolbox entries, they should stop and report that as G-owned integration work.

## Focused Regression Targets

Domain-level targets:

- B: task window / task shell unit tests, source organization guard if new files are added.
- C: PSD Import component tests and preservation of `explicitPsdImport.panel` / focused PSD hooks.
- D: Diagnostics / Evidence skeleton unit tests and overclaim scan.
- E: Codex / Automation skeleton unit tests and automation-policy scan.
- F: selector scope checks, duplicate `drawable.list` scoping, production `data-testid` guard self-checks if touched.

G/H/final targets:

- `pnpm typecheck`
- `pnpm test:unit`
- `pnpm test:e2e`
- `pnpm run check`
- `node scripts/run-focused-e2e.mjs --id psdStructuralInitialStateFocused`
- `node scripts/run-focused-e2e.mjs --id psdImportPlanCodexFocused`
- `node scripts/run-focused-e2e.mjs --id psdImportPlanFocused`
- `node scripts/run-focused-e2e.mjs --id psdMultiLayerBatchFocused`
- `node scripts/run-focused-e2e.mjs --id psdImportFocused`
- `node scripts/check-production-testid-boundary.mjs`
- `node scripts/check-production-testid-boundary-fixtures.mjs`
- `node scripts/check-psd-parser-import-boundary.mjs`
- `node scripts/check-focused-e2e-registry.mjs`
- `node scripts/check-wave42-quality-gate-boundary.mjs`
- `pnpm run check:source`
- `pnpm run check:deps`
- `git diff --check -- apps packages scripts fixtures test_data generated discussion discussion/implementation discussion/development_convention discussion/tests`

Specific Wave54 route assertions to add or preserve:

- PSD Import is absent by default from the Authoring Workspace.
- Toolbox `psdImport.task.open` opens PSD Import in the workspace-scoped task window.
- Back / Close returns to Authoring Workspace.
- Task window exposes stable task/window regions without production behavior querying `data-testid`.
- Diagnostics / Evidence skeleton and Codex / Automation skeleton are reachable only as skeletons and do not claim final view completion.
- Desktop/mobile editor smoke still passes.
- Existing focused PSD paths still pass.
- Duplicate `drawable.list` tests scope to Parts Tree or legacy Drawable Authoring explicitly.

## User-Decision Points

None required before B-F start under the accepted Wave54 plan.

Escalate to Undine if any implementation domain finds that:

- Workspace-scoped PSD task window v0 cannot be implemented without deciding the final modal/window/dedicated-view policy for all tools.
- Diagnostics / Evidence or Codex / Automation skeletons require a full view implementation or broad panel migration.
- B-F ownership cannot stay non-overlapping.
- PSD import/scaffold semantics must change.
- Existing focused e2e cannot pass without weakening tests.
- New Mesh / Atlas / Parameter Manager / Variant UI, proposal generation, semantic recognition, external transport, renderer/pixel oracle, Cubism compatibility, or public demo assets become necessary.

## Domain A Verification

- Bounded source inventory only; no source implementation.
- Report written at `discussion/implementation/waves/wave54/wave54-domain-a-boundary-current-surface-inventory-report.md`.
- Independent Review-Sylph review is required at `discussion/implementation/reviews/wave54/wave54-domain-a-boundary-current-surface-inventory-review.md`.
- `git diff --check` is to be run after the review artifact is present.
