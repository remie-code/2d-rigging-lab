# Wave51 Domain A Boundary / Coupling Target Inventory Report

- Domain: `wave51-boundary-coupling-target-inventory`
- Verdict: `pass`
- Scope: boundary inventory only; no production source implementation

## Basis Documents Used

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave51-plan.md`
- `discussion/implementation/orchestration/wave50-plan.md`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/remaining-work-backlog.md`
- `discussion/design/codex-friendly-automation-policy.md`
- `discussion/design/screen-design/_map.md`
- `discussion/design/screen-design/scope-and-principles.md`
- `discussion/design/screen-design/overview.md`
- `discussion/design/screen-design/inventories/feature-inventory-and-classification.md`
- `discussion/design/screen-design/inventories/codex-test-evidence-dependency.md`
- `discussion/design/screen-design/screens/psd-import-task.md`
- `discussion/design/screen-design/screens/diagnostics-evidence-view.md`
- `discussion/design/screen-design/screens/codex-automation-view.md`

## Exact Wave51 Debt Boundary

Wave51 is a screen-surface protection and shell foundation wave. It must not add new authoring capability. The exact debt boundary for this wave is:

1. Remove production behavior dependency on `data-testid` selectors and fragile local parent DOM structure in the PSD import-plan / structural scaffold approval flows.
2. Preserve `data-testid` values as test-facing observation hooks unless a replacement structured test surface is explicitly introduced and documented.
3. Introduce only the minimum Task/View Shell foundation needed for later PSD Import Task, Diagnostics / Evidence View, and Codex / Automation View migration.
4. Prepare test/evidence surfaces so future UI movement does not force tests or Codex-facing behavior to rely on human-visible debug text.
5. Preserve existing Wave45-Wave50 PSD focused workflows and current user reachability.

The boundary does not include final visual redesign, full panel migration, final modal/window behavior, or new Mesh / Atlas / Parameter / Variant implementation.

## Production Coupling Targets For Domain B

Domain B should target `apps/editor/src/ui/explicit-psd-import/explicit-psd-import-panel.ts` only unless direct local state plumbing forces a narrow adjacent edit.

Confirmed behavior-critical couplings:

1. Import-plan approval synchronization:
   - `syncImportPlanApprovedRefs` at lines 312-329 queries the parent form by `[data-testid="${editorTestIds.explicitPsdImportPlanForm}"]`, then queries approved refs by `[data-testid="${editorTestIds.explicitPsdImportPlanApprovedRefs}"]`.
   - It derives production state from checked DOM inputs named `explicitPsdImportPlanCandidateApproval`, writes the textarea value, and updates submit enabled state.
2. Structural scaffold approval synchronization:
   - `syncStructuralScaffoldApprovedRefs` at lines 523-540 queries the parent form by `[data-testid="${editorTestIds.explicitPsdStructuralScaffoldForm}"]`, then queries approved refs by `[data-testid="${editorTestIds.explicitPsdStructuralScaffoldApprovedRefs}"]`.
   - It derives production state from checked DOM inputs named `explicitPsdStructuralScaffoldApproval`, writes the textarea value, and updates submit enabled state.
3. Submit-state coupling:
   - `updateImportPlanApprovedBatchSubmitState` at lines 944-955 finds `[data-testid="${editorTestIds.explicitPsdImportPlanApprovedBatchSubmit}"]`, combines `dataset.baseDisabled` with current approved refs, and mutates `submit.disabled`.
   - `updateStructuralScaffoldCommitSubmitState` at lines 957-968 does the same for `[data-testid="${editorTestIds.explicitPsdStructuralScaffoldApprovedSubmit}"]`.
4. Approved-ref freshness coupling:
   - `isImportPlanApprovedSelectionCurrent` at lines 970-982 and `isStructuralScaffoldApprovedSelectionCurrent` at lines 985-997 find approved refs by `data-testid` and compare textarea value against `dataset.lastGeneratedApprovedRefs`.
5. Fragile local DOM lookup:
   - `findInRootOrParent` at lines 1000-1009 searches the current root and parent element with arbitrary selectors, making behavior depend on local DOM placement.
6. Dataset-backed behavior state:
   - The panel writes `dataset.lastGeneratedApprovedRefs` for import-plan and structural approved refs and `dataset.baseDisabled` for submit buttons. These are production behavior state, not test-only state.

Expected Domain B replacement shape:

- Keep stable `data-testid` names for tests where still needed.
- Move behavior-critical coordination to explicit local element references, a component-local state object, or callback-bound state wiring.
- Avoid global or parent-relative `[data-testid=...]` queries for production behavior.
- Preserve import-plan preview, approved batch intake, structural scaffold preview, structural commit, stale/changed approval blocking, and existing focused E2E behavior.

## Minimal Task / View Shell Target For Domain C

Domain C should treat the current shell as a one-page legacy host and introduce named shell concepts without deciding the final UI form.

Confirmed current target:

- `apps/editor/src/ui/app-shell/app-shell.ts` creates one `section.editor-workspace` at lines 224-226.
- The same file creates many panels locally and appends them into `workspace` at lines 463-481, including PSD import, Product Preflight, Codex proposal review, AI approval/transcript, and operation persistence evidence.
- `apps/editor/src/app/editor-app.ts` remains the app-level wiring point from workflow callbacks into `createEditorAppShell`.

Minimum acceptable shell foundation:

1. Add explicit source-level concepts for authoring workspace, task surface, diagnostics/evidence view surface, and Codex/automation view surface.
2. Register or classify at least these surfaces: PSD Import Task, Diagnostics / Evidence View, Codex / Automation View, and the current authoring workspace.
3. Keep current visible workflows reachable. Existing panels may remain visible or legacy-hosted if moving them would become a visual redesign.
4. Do not choose final modal vs task window vs side panel vs dedicated view. If implementation requires that product decision, return `escalate`.
5. Do not migrate every panel. A small proof wrapper/host/registry/state boundary is sufficient.
6. Do not introduce a new UI dependency or icon system.
7. Preserve existing `data-testid` and accessibility labels unless a focused test/evidence update covers the change.

## Test / Evidence Surface Preparation Targets For Domain D/E

Domain D should prepare a minimal structured observation surface, not a full evidence redesign.

Targets for Domain D:

- PSD Import Task structured status should be enough to observe source loaded state, parse status, selected scope, approval status, scaffold preview status, commit enabled state, and warning count without relying on verbose human debug text.
- Evidence/debug details for operation IDs, approval IDs, plan digests, generated refs, evidence paths, package paths, reload summary, and raw diagnostics should remain available through Diagnostics / Evidence oriented surfaces rather than primary PSD Import Human UI.
- Product Preflight and operation persistence details may remain in existing UI for compatibility, but any new movement should record whether the oracle remains DOM-based or structured.
- Codex-facing state should prefer `packages/ai-interface` / `EditorAiCommandHost` structured responses over visible DOM text.

Targets for Domain E:

- Preserve and rerun the focused PSD IDs called out by Wave51: `psdStructuralInitialStateFocused`, `psdImportPlanCodexFocused`, `psdImportPlanFocused`, `psdMultiLayerBatchFocused`, and `psdImportFocused`.
- Add or update a guard that flags production app-source behavior depending on `[data-testid=...]` selector queries. The intended allowlist is test id assignment/observation, tests/e2e files, and explicitly documented exceptions only.
- Preserve `apps/editor/src/editor-state/editor-test-ids.ts` and `apps/editor/e2e/test-ids.mjs` parity unless a replacement test-facing surface is documented.
- Do not weaken visible-text or DOM assertions merely to make the shell pass; where broad oracle migration is too large, record deferred debt.

## Non-Goals Confirmed

- Mesh generation, mesh preset UI, mesh preview overlay, automatic mesh fitting, triangulation, retopology, UV unwrap, and atlas packing.
- Texture Atlas task implementation.
- Parameter Manager implementation, Variant / Expression Manager implementation, Viewer / Runtime redesign, and Product Preflight redesign.
- Full app-wide visual redesign, final CSS/design-system polish, final modal/window framework, or complete panel migration.
- Removing all E2E visible-text or DOM oracles in one wave.
- Removing all debug/evidence text from visible UI in one wave.
- External HTTP / WebSocket / MCP transport.
- LLM/provider integration, repo-side proposal generation, semantic recognition, auto-classification, auto-rigging, auto-fix, automatic commit, or suggestion UI.
- Renderer/pixel oracle, Photoshop compositing, Cubism SDK/Core integration, `.moc3`, `.cmo3`, `.model3.json`, `.physics3.json`, `.motion3.json`, `.pose3.json`, public demo asset work, persisted source PSD bytes, or raw parser objects as package capabilities.

## Source Files Inspected

Bounded source inspection only:

- `apps/editor/src/ui/explicit-psd-import/explicit-psd-import-panel.ts`
- `apps/editor/src/editor-state/editor-test-ids.ts`
- `apps/editor/e2e/test-ids.mjs`
- `apps/editor/src/app/editor-app.ts`
- `apps/editor/src/ui/app-shell/app-shell.ts`
- `apps/editor/src/ai-command-host/editor-ai-command-host.ts`

No full source, full E2E, or broad test inventory was performed.

## Risks And Escalation Points

- If removing PSD Import `data-testid` behavior coupling requires broad UI state architecture or moving many panels, Domain B should return `escalate`.
- If Task/View Shell foundation requires deciding modal vs dedicated view vs side panel, Domain C should return `escalate` rather than settling the product decision.
- If Domain D/E cannot preserve focused E2E behavior without weakening tests or completing a broad oracle migration, they should preserve compatibility and record deferred debt.
- If Product Preflight current report/comparison must become DOM-independent in Wave51 to support shell work, treat it as a narrow D target; if it expands into a full Product Preflight command/view redesign, escalate.
- If structural-specific Codex execute/stale parity becomes required beyond narrow read/status preparation, escalate; Wave51 does not authorize broad Codex command expansion.
- If two domains need to edit the same source files after Domain C, Undine should serialize them or narrow ownership before parallel work.

## User-Decision Points

No new user decision is required before starting Domain B.

Known future decisions remain unresolved but are not blockers for Domain B:

- PSD Import Task final form: modal, task window, side panel, or dedicated view.
- Toolbox placement and final navigation pattern.
- Product Preflight / Codex Automation final position in normal UI.
- Final structured replacement strategy for all visible-text and DOM oracles.

## Domain B Start Recommendation

Domain B may start after an independent clean Review-Sylph review of this report returns `pass`.
