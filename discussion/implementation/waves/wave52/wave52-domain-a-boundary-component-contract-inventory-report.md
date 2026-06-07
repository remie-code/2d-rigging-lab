# Wave52 Domain A Report: Boundary / Component Contract Inventory

> Target: `wave52-boundary-component-contract-inventory`  
> Role: Domain A Orch-Sylph boundary inventory  
> Verdict: `pass`

## Verdict

`pass`

Wave52 can proceed to Domains B and C in parallel after the required clean Review-Sylph review for this report passes.

Domain A did not implement source code. No production source, tests, e2e, scripts, or product design documents were modified by this report. Domain A is a boundary-only gate that fixes ownership, component contracts, PSD Import Task migration limits, regression targets, and escalation points before component implementation begins.

Mandatory separation basis:

```text
Orch-Sylph自身は実装担当ではない。source implementation は必ず別コンテキストの Gnome に委譲し、レビューは必ず別コンテキストの Review-Sylph に委譲すること。これを分離できない場合は実装せず escalate / blocked として報告すること。
```

Domain A has no source implementation deliverable, so no Gnome source implementation was delegated.

## Basis Documents Used

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave52-plan.md`
- `discussion/implementation/orchestration/wave51-plan.md`
- `discussion/implementation/waves/wave51/wave51-final-integration-report.md`
- `discussion/implementation/reviews/wave51/wave51-final-integration-review.md`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/remaining-work-backlog.md`
- `discussion/design/codex-friendly-automation-policy.md`
- `discussion/design/screen-design/_map.md`
- `discussion/design/screen-design/scope-and-principles.md`
- `discussion/design/screen-design/overview.md`
- `discussion/design/screen-design/screens/psd-import-task.md`
- `discussion/design/screen-design/screens/authoring-workspace.md`
- `discussion/design/screen-design/components/toolbox.md`
- `discussion/design/screen-design/inventories/codex-test-evidence-dependency.md`

## Source Files Inspected

Bounded source inspection was used only to confirm existing shell, PSD import, task observation, app wiring, and e2e ID boundaries.

- `apps/editor/src/ui/app-shell/shell-surfaces.ts`
- `apps/editor/src/ui/app-shell/app-shell.ts`
- `apps/editor/src/ui/app-shell/app-shell.test.ts`
- `apps/editor/src/ui/explicit-psd-import/explicit-psd-import-panel.ts`
- `apps/editor/src/editor-state/explicit-psd-import-task-observation.ts`
- `apps/editor/src/app/editor-app.ts`
- `apps/editor/e2e/test-ids.mjs`

Confirmed current facts:

- `shellSurfaces.psdImportTask` already exists as minimal task metadata.
- `app-shell.ts` currently classifies the explicit PSD Import panel as `shellSurfaces.psdImportTask` but still appends it into the legacy always-visible workspace host.
- `app-shell.test.ts` explicitly verifies the current Wave51 state as named shell surface classification "without moving workflows".
- `explicit-psd-import-panel.ts` uses local approval bindings for import-plan and structural scaffold approval synchronization; `data-testid` assignments remain test-facing hooks.
- `projectExplicitPsdImportTaskObservation` already projects source loaded state, parse status, selected scope, import-plan status, structural scaffold status, human summary, warning counts, and an evidence boundary that routes details to `diagnosticsEvidenceView`.
- `editor-app.ts` still wires PSD import callbacks directly into the app shell render path.
- `apps/editor/e2e/test-ids.mjs` mirrors the stable PSD import test IDs used by focused e2e.

## Exact PSD Import Task Migration Boundary

Wave52 migrates PSD Import / structural scaffold from a constantly visible workspace panel into a task-shell task surface reachable from Empty / Authoring Workspace.

In scope:

- Reuse the existing deterministic PSD parse, tree inspection, import-plan preview, explicit approval, approved batch intake, structural scaffold preview, structural approval, structural commit, and result summary workflows.
- Provide a generic Task Shell / Task Chrome that can host PSD Import and later tasks.
- Provide PSD Import Task human UI content that can be rendered inside the generic shell.
- Add a minimal entry point from Empty / Authoring Workspace to open PSD Import as a task.
- Preserve focused PSD workflows and stable test-facing IDs unless a stable replacement is explicitly documented and reviewed.
- Keep operation IDs, approval digests, generated refs, evidence paths, raw parser payloads, command payloads, and test selector strings out of primary human UI.
- Route detailed evidence toward Diagnostics / Evidence View or structured surfaces.
- Either consume the Wave51 PSD Import Task structured observation projector narrowly, or explicitly defer its consumption with Review-Sylph acceptance.

Out of scope:

- Full workspace visual redesign.
- Final toolbox placement or final modal/window framework.
- Moving unrelated panels.
- Mesh generation/tool UI, Texture Atlas implementation, Parameter Manager implementation, Variant / Expression Manager implementation, Viewer redesign, Diagnostics / Evidence final UI, or Codex / Automation final UI.
- Changing PSD import semantics.
- Structural-specific Codex execute/stale command parity unless a narrow read/status bridge is explicitly escalated and accepted.
- Semantic recognition, proposal generation, auto-classification, auto-rigging, auto-fix, automatic commit, external HTTP/WebSocket/MCP transport, Cubism compatibility, renderer/pixel oracle, Photoshop compositing, public demo assets, persisted source PSD bytes, or raw parser objects as package capabilities.

The remaining screen-design uncertainty around modal vs dedicated task view vs side panel is not a blocker for Wave52. Wave52 may implement a minimal task-shell presentation that preserves workflows, but it must not claim final screen-design completion.

## B/C Component Contracts

### Domain B: Generic Task Shell / Task Chrome

Domain B owns generic, PSD-agnostic shell/chrome component creation.

Contract:

- Inputs: title, concise status, task kind/surface metadata, primary action slot, secondary/status action slot, diagnostics summary slot, content slot, back/close affordance, optional disabled/busy state, accessible label/title.
- Outputs: a DOM component or component factory that hosts arbitrary task content without knowing PSD import workflow details.
- Accessibility: heading/label relationship, keyboard-reachable back/close affordance, clear button labels or aria labels, and no reliance on visible text as machine-only evidence.
- Scope: minimal reusable task shell/chrome only. It is not a full modal/window framework or app-wide visual redesign.
- Test expectation: focused component/unit tests for generic shell rendering, slots, affordances, metadata, and basic accessibility state.

Forbidden for B:

- PSD import workflow logic.
- App Shell final integration.
- Moving existing panels.
- Adding new UI dependencies unless escalated and accepted.
- New authoring capability.

### Domain C: PSD Import Task Human UI Component

Domain C owns PSD Import human-facing task content componentization.

Contract:

- Inputs: current PSD import view model and existing PSD import workflow callbacks, plus optional structured observation input if useful without editor-state mutation.
- Outputs: PSD Import Task content that can be placed inside the generic Task Shell by Domain D.
- Primary human information: source summary, parse/tree state, selected scope, import mode, scaffold preview summary, warnings summary, approval state, commit state, concise result summary.
- Test-facing hooks: preserve stable PSD import `data-testid` values unless Domain C documents replacements and Review-Sylph accepts them before D/E rely on the new surface.
- Machine-only boundary: do not reintroduce operation IDs, approval digests, generated refs, full source refs, plan digests, raw parser payloads, evidence paths, command payloads, or test selector strings as primary UI content.
- Semantics: preserve existing import-plan and structural scaffold behavior.

Forbidden for C:

- App Shell final integration.
- Routing/open-close state.
- Changing PSD import semantics.
- Reintroducing production behavior dependency on `data-testid`.
- Hiding required controls without replacement.
- Adding Mesh / Atlas / Parameter / Variant capability.

## D Integration Contract

Domain D is the only domain that wires B and C into the App Shell.

Contract:

- Integrate Generic Task Shell / Task Chrome from B with PSD Import Task Human UI from C.
- Provide a clear PSD Import task entry from Empty / Authoring Workspace.
- Remove PSD Import from the default always-visible workspace panel surface, while preserving reachability and existing workflow behavior.
- Preserve the existing callback chain from `editor-app.ts` through `createEditorAppShell` to PSD import workflow methods.
- Preserve stable focused e2e entry points or document stable replacements before updating tests.
- Own open/close/back task state and any shell-surface metadata changes required for the migration.
- Connect `projectExplicitPsdImportTaskObservation` to a narrow task status, test-facing, or debug/status bridge if doing so is needed for safe migration. If not consumed, D must record a reviewed deferral and E must preserve focused PSD regressions through other stable observations.
- Do not push B/C merge conflicts or unresolved shell decisions into Undine/root context.

Forbidden for D:

- Full workspace visual redesign.
- Moving unrelated panels.
- Final toolbox implementation beyond a minimal Import task entry.
- New authoring capability.
- Broad e2e oracle migration.
- Weakening existing workflows or focused regression coverage.

## Exact File Ownership Guidance

### Domain B Ownership

Primary allowed source scope:

- New generic task shell/chrome files under `apps/editor/src/ui/app-shell/**`, for example narrowly named task shell/chrome component files and focused tests.
- `apps/editor/src/ui/app-shell/shell-surfaces.ts` only for additive generic metadata needed by the shell component.
- `apps/editor/src/ui/app-shell/index.ts` only if an existing barrel export is required, and it must remain barrel-only.
- Focused component/unit tests for the generic shell/chrome.

B must not edit:

- `apps/editor/src/app/editor-app.ts`
- PSD import workflow/source semantics.
- `apps/editor/src/ui/explicit-psd-import/**`
- `apps/editor/e2e/**`
- `package.json` or guard scripts.

### Domain C Ownership

Primary allowed source scope:

- `apps/editor/src/ui/explicit-psd-import/**`
- New narrowly named PSD Import task content component files and focused tests under that directory.
- Existing `explicit-psd-import-panel.ts` only for extraction/componentization while preserving behavior.

C must not edit:

- `apps/editor/src/app/editor-app.ts`
- `apps/editor/src/ui/app-shell/app-shell.ts`
- App-level routing/open-close state.
- `apps/editor/src/editor-state/**` except by escalation; Domain D owns observation bridge decisions.
- `apps/editor/e2e/**`
- `package.json` or guard scripts.

### Domain D Ownership

Primary allowed source scope:

- `apps/editor/src/app/editor-app.ts`
- `apps/editor/src/ui/app-shell/**`
- `apps/editor/src/ui/explicit-psd-import/**` only for integration adjustments that combine B/C outputs.
- `apps/editor/src/editor-state/**` only for narrow observation bridge connection if required.
- `apps/editor/e2e/**` focused updates only where task opening or stable observation changes require them.

D owns:

- Final App Shell wiring.
- Task open/close/back state.
- Minimal Import task entry from Empty / Authoring Workspace.
- Reconciliation of B/C outputs.
- Documentation in its Domain D report for any structured observation consumption or reviewed deferral.

D must not:

- Create large new component abstractions better owned by B.
- Rewrite PSD import content beyond integration of C output.
- Move unrelated panels or perform full workspace redesign.

### Domain E Ownership

Primary allowed source scope:

- `apps/editor/e2e/**` focused regression updates only.
- `scripts/**` for production `data-testid` guard execution/fixture checks only.
- `package.json` only if guard script integration is narrow, has no dependency or lockfile churn, and D/E review accepts it.
- `discussion/tests/traceability/test-traceability-matrix.md`
- `discussion/tests/fixtures/fixture-manifest.md`

E owns:

- Running and, if needed, updating focused PSD e2e regressions for the task migration.
- Running production `data-testid` boundary guard scripts.
- Standard script integration for the production `data-testid` guard, conditionally.

E must not:

- Implement product behavior beyond regression hooks.
- Weaken focused tests.
- Remove focused IDs without stable replacement and review.
- Introduce lockfile churn unless explicitly justified and reviewed.

## Focused Regression IDs And Observation Targets

Required focused regression IDs:

- `psdStructuralInitialStateFocused`
- `psdImportPlanCodexFocused`
- `psdImportPlanFocused`
- `psdMultiLayerBatchFocused`
- `psdImportFocused`
- `check-production-testid-boundary`
- `check-production-testid-boundary-fixtures`

Required observation targets:

- PSD Import task reachability from Empty / Authoring Workspace.
- PSD Import no longer being a constantly dominant always-visible workspace panel after D.
- Stable PSD import test hooks from `apps/editor/e2e/test-ids.mjs`, especially:
  - `explicitPsdImportPanel`
  - `explicitPsdImportForm`
  - `explicitPsdImportFileInput`
  - `explicitPsdImportSubmit`
  - `explicitPsdImportStatus`
  - `explicitPsdImportSource`
  - `explicitPsdImportDocument`
  - `explicitPsdImportLayerTree`
  - `explicitPsdImportPlanForm`
  - `explicitPsdImportPlanScopeRef`
  - `explicitPsdImportPlanApprovedRefs`
  - `explicitPsdImportPlanSubmit`
  - `explicitPsdImportPlanPreview`
  - `explicitPsdImportPlanCandidates`
  - `explicitPsdImportPlanDiagnostics`
  - `explicitPsdImportPlanApprovedBatchForm`
  - `explicitPsdImportPlanApprovedBatchSubmit`
  - `explicitPsdStructuralScaffoldForm`
  - `explicitPsdStructuralScaffoldScopeRef`
  - `explicitPsdStructuralScaffoldApprovedRefs`
  - `explicitPsdStructuralScaffoldSubmit`
  - `explicitPsdStructuralScaffoldPreview`
  - `explicitPsdStructuralScaffoldNodes`
  - `explicitPsdStructuralScaffoldDiagnostics`
  - `explicitPsdStructuralScaffoldApprovedForm`
  - `explicitPsdStructuralScaffoldApprovedSubmit`
  - `explicitPsdStructuralScaffoldResult`
  - `explicitPsdStructuralScaffoldEntries`
  - `explicitPsdStructuralScaffoldResultDiagnostics`
  - `explicitPsdImportBatchLayerRefs`
  - `explicitPsdImportBatchIntakeForm`
  - `explicitPsdImportBatchIntakeSubmit`
  - `explicitPsdImportBatchIntakeResult`
  - `explicitPsdImportBatchIntakeEntries`
  - `explicitPsdImportBatchIntakeDiagnostics`
- Structured PSD Import Task observation fields if D consumes the projector:
  - `sourceLoaded`
  - `parseStatus`
  - `selectedScope`
  - `importPlan.previewStatus`
  - `importPlan.approvalStatus`
  - `importPlan.readyToSubmitApprovedBatch`
  - `structuralScaffold.previewStatus`
  - `structuralScaffold.approvalStatus`
  - `structuralScaffold.readyToCommitStructuralScaffold`
  - `structuralScaffold.runtimeHiddenDrawableCount`
  - `humanSummary.warningCount`
  - `humanSummary.detailSurface`
  - `evidenceBoundary.detailSurface`
  - `evidenceBoundary.detailStatus`
  - `evidenceBoundary.rawDetailRefsIncluded`
- Codex-facing existing structural read projection remains a preservation target, but structural-specific execute/stale parity is not a Wave52 requirement unless separately escalated.

## Production `data-testid` Guard Integration

Production `data-testid` guard integration is conditionally in Wave52, owned only by Domain E.

Domain A fixes this as:

- Domain E must run `node scripts/check-production-testid-boundary.mjs`.
- Domain E must run `node scripts/check-production-testid-boundary-fixtures.mjs`.
- Domain E may add standard package-script integration only if the change is narrow, has no dependency or lockfile churn, and Review-Sylph accepts the script placement.
- If package-script integration is not narrow or creates churn, Domain E must explicitly defer it as residual debt with review approval.
- B, C, and D must not touch package script integration.

## Risks And Escalation Points

Escalate to Undine if any of the following occurs:

- B and C require overlapping edits to the same source files beyond this ownership contract.
- D cannot integrate B/C outputs without a broader App Shell or workspace redesign.
- PSD Import task opening requires a product decision on modal vs dedicated view vs side panel that cannot be safely represented as a minimal v0 shell.
- Existing PSD focused e2e cannot be preserved without weakening tests.
- Required PSD Import controls become hidden or unreachable.
- Migration reintroduces production behavior dependency on `data-testid`.
- Machine-only details return to primary human UI as a substitute for structured/evidence surfaces.
- Structured observation consumption becomes broad state/schema churn.
- Guard package-script integration requires dependency, lockfile, or broad package script churn.
- Implementation drifts into Mesh, Atlas, Parameter, Variant, semantic recognition, proposal generation, auto-rigging, auto-fix, external transport, renderer/pixel oracle, Cubism compatibility, public demo assets, or persisted raw PSD/parser object capability.

## User-Decision Points

No immediate user decision is required for Domains B and C to start after this report and its clean review pass.

Future decisions remain outside Domain A:

- Final toolbox placement.
- Final modal/task-window/dedicated-view policy.
- Final Diagnostics / Evidence View and Codex / Automation View placement.
- Whether package-script guard integration should become part of a broader standard quality gate if Domain E defers the narrow integration.

