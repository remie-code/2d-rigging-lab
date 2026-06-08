# Wave 55 Plan: Human UI Reset Foundation v0

> Wave55で実装すべきdomain、依存順、Orch-Sylph投入方針を固定する計画。
> このwaveはWave54で露呈した「既存UI延命によるUX未達」を受け、Primary Human UIからlegacy/debug/evidence/Codex-heavy panelsを隔離し、UX-firstなEditor shellとtask window挙動へ切り替える。

## 1. 状態

- Status: Planned
- Target wave: Wave55
- Wave name: `human-ui-reset-foundation-v0`
- Primary objective: 現在のEditor通常画面から `authoring-workspace-support` 系のlegacy/debug/evidence/Codex-heavy panelsを外し、Primary Human UI Shell v0をUX観点で再構築する。既存UI componentは画面設計の正解として扱わず、必要なstate / callback / operation接続だけを再利用する。PSD Importは最初のvertical sliceとして、既存panel延命ではなくclean human task UIとして表示する。

## 2. Planning Gate Result

Planning Gate result before this plan: `Inventory first` -> `Plan directly`.

Inventory basis:

- [UI Reset Inventory: Primary UI Quarantine](../../design/screen-design/inventories/ui-reset-inventory-primary-ui-quarantine.md)
- [UI Reset Inventory: State / Operation Contracts](../../design/screen-design/inventories/ui-reset-inventory-state-operation-contracts.md)
- [UI Reset Inventory: UX AC / Test Gaps](../../design/screen-design/inventories/ui-reset-inventory-ux-ac-test-gaps.md)
- [Wave54 final integration report](../waves/wave54/wave54-final-integration-report.md)
- [Wave54 final integration review](../reviews/wave54/wave54-final-integration-review.md)

Gate summary:

- Factual uncertainty after inventory: medium.
- Decision uncertainty after user confirmation: low to medium.
- Cost of wrong plan: high.

Accepted user direction:

- Existing panels disappearing from normal UI is not just acceptable; it is preferred.
- Current UI should not be treated as the UX reference.
- The correct next step is not a small PSD Import polish pass, but a UI reset foundation.
- Existing workflow/state/operation logic should be preserved where needed, while human-facing panel composition may be replaced.

## 3. User Decisions / Design Boundary

Accepted decisions:

- Primary Human UI should be rebuilt from UX intent, not from current panel inventory.
- Legacy/support panels must be removed from the normal Authoring Workspace first viewport and normal workspace flow.
- Existing visible panels may be quarantined rather than deleted, so tests/debugging can recover required evidence while the primary UX is cleaned.
- `Task Summary`, raw refs, operation IDs, diagnostics IDs, plan digests, generated refs, command payloads, and evidence paths are not primary human UI.
- PSD Import remains a task launched from the Toolbox, but it must open as a real workspace-scoped overlay/window experience, not as a normal-flow section that causes scrolling.

Wave55 assumptions:

- Legacy/debug quarantine should be an explicit internal/debug surface, not a normal user-facing primary surface.
- Product Preflight full detail is not primary workspace content in Wave55. If preservation is needed, keep it in quarantine or Diagnostics/Evidence-facing surfaces.
- Viewer / Runtime remains a dedicated-view leaning surface and is not converted into a task window by Wave55.
- Diagnostics / Evidence and Codex / Automation full migrations are still future work; Wave55 may only add enough quarantine/route plumbing to remove them from primary UI.

User-decision points to monitor, but not block Wave55 start:

- Whether legacy/debug quarantine should later become a dev-only drawer, explicit route, or removable build-time surface.
- Whether Product Preflight detail should ultimately belong to a Validation task or Diagnostics/Evidence view.
- Which authoring workflow should be promoted after PSD Import proves the reset pattern.

## 4. Next Wave Selection

Wave55 is selected because Wave54 proved route-level task-window behavior but failed the actual UX expectation:

- The task window was mounted in normal document flow.
- Focus caused scrolling to the task region.
- Tests verified `role=dialog`, metadata, focus, and routes, but not overlay/window geometry or first-viewport UX cleanliness.
- Existing panels still dominated the user-visible UI and continued to influence implementation.

The most important next move is to stop treating the existing UI as a baseline.

Wave55 should create a clean primary shell and quarantine old panels before adding more authoring capability.

## 5. Repository Facts From Inventory

Facts treated as planning basis:

- `createWorkspaceSupportRegion([...])` is the main primary UI pollution point. It lays legacy/debug/evidence/Codex-heavy panels into the normal Authoring Workspace flow.
- Evidence-heavy surfaces can move toward Diagnostics/Evidence.
- Codex/AI-heavy surfaces can move toward Codex/Automation.
- Drawable/Rig/Dynamics/Composition/Source/Persistence panels may contain callbacks that must survive, but their current DOM/text should not guide Primary UX.
- Existing unit/e2e tests depend heavily on visible text from legacy panels.
- `EditorSemanticState`, `EditorWorkflowViewModel`, and `EditorWorkflowController` callbacks are the core contracts a reset shell must preserve.
- PSD Import can use `ExplicitPsdImportTaskObservationState` to separate human summary from evidence detail.
- Wave54 test coverage did not assert overlay geometry, scroll position, backdrop/static-flow absence, first viewport debug text absence, or screenshot contents.

## 6. Design Decisions

- Build a new Primary Human UI Shell v0 that displays only the normal authoring workspace essentials:
  - App bar
  - Toolbox
  - Parts / Structure tree
  - Canvas / Preview
  - Inspector
  - Parameter/status strip
  - compact diagnostics/status indicator only if human-relevant
- Remove `authoring-workspace-support` from the normal primary workspace flow.
- Preserve required callback/state connections, but do not preserve current visual panels by default.
- Implement task windows as actual workspace overlays:
  - fixed or equivalent overlay placement inside viewport
  - no open-trigger scroll jump
  - visible window chrome
  - close/back/Escape behavior
  - desktop and mobile geometry checks
- PSD Import clean human task UI must prioritize:
  - choose PSD file
  - parse status in human language
  - PSD structure tree
  - import target/scope
  - preview summary
  - import/commit/cancel
- PSD Import clean human task UI must not show primary `Task Summary`, raw refs, plan digests, operation IDs, evidence paths, command payloads, parser payloads, or test selector strings.
- Legacy/debug/evidence/Codex-heavy content must be reachable only through quarantine/debug/specialized surfaces where necessary; it must not be part of primary authoring.

## 7. Non-Goals

- Full visual design system.
- Full deletion of all legacy UI code.
- Full replacement of all workflow-specific authoring panels.
- Mesh generation/tool implementation.
- Texture Atlas packing or UI implementation.
- Parameter Manager / Variant Manager implementation.
- Full Diagnostics / Evidence implementation.
- Full Codex / Automation implementation.
- Product Preflight redesign.
- Viewer / Runtime redesign.
- New external transport, HTTP/WebSocket/MCP, LLM/provider integration, proposal generation, semantic recognition, auto-fix, auto-commit, or automatic rigging.
- Changing PSD parser/import/scaffold semantics.
- Removing or weakening existing operation/state/callback capability.
- Rewriting tests merely to hide regressions.

## 8. Basis Documents

Undineが保持する最小basis:

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `C:/Users/remie/.codex/skills/planning-gate/SKILL.md`
- `discussion/implementation/orchestration/wave55-plan.md`
- `discussion/implementation/waves/wave54/wave54-final-integration-report.md`
- `discussion/implementation/reviews/wave54/wave54-final-integration-review.md`
- `discussion/design/screen-design/inventories/ui-reset-inventory-primary-ui-quarantine.md`
- `discussion/design/screen-design/inventories/ui-reset-inventory-state-operation-contracts.md`
- `discussion/design/screen-design/inventories/ui-reset-inventory-ux-ac-test-gaps.md`
- `discussion/design/screen-design/screens/authoring-workspace.md`
- `discussion/design/screen-design/screens/psd-import-task.md`
- `discussion/design/screen-design/components/toolbox.md`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/remaining-work-backlog.md`

Domain basis as needed:

- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/diagnostic-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`
- `discussion/tests/traceability/test-traceability-matrix.md`
- `discussion/tests/fixtures/fixture-manifest.md`
- Wave51-Wave54 reports/reviews only where a domain needs precise implementation history

UndineはEditor source、e2e全体、command host source全文を自分で読み込まない。詳細source、diff、test evidenceはOrch-Sylphがdomain必要分だけ読み、Gnome / Review-Sylphへ狭く渡す。

## 9. Dependency / Parallel Design

Wave55 uses a stricter dependency structure than Wave54. Some component work can run in parallel, but final App Shell integration must be centralized.

| Batch | Domain | Parallelism | Dependency | Purpose |
|---|---|---|---|---|
| 1 | A. Reset boundary / ownership fix | Solo first | UI Reset inventories + Wave54 final pass | Source ownership、legacy quarantine strategy、AC、B-F write scopesを固定する |
| 2 | B. Primary Human Shell v0 | Parallel with C/D/E/F if A approves | A | Primary workspaceからlegacy support flowを前提にしないclean shell componentを作る |
| 2 | C. Task Window Overlay UX v0 | Parallel with B/D/E/F if A approves | A | task shellを通常flow sectionではなくoverlay/window UXとして成立させる |
| 2 | D. PSD Import Clean Human Task v0 | Parallel with B/C/E/F if A approves | A | 既存PSD panelをUX参考にせず、clean human task contentを作る |
| 2 | E. Legacy / Debug Quarantine Surface v0 | Parallel with B/C/D/F if A approves | A | support panelsをprimaryから外す退避先または内部surfaceを用意する |
| 2 | F. UX-focused E2E / Review Gate v0 | Parallel with B/C/D/E if A approves | A | overlay geometry、scroll、first viewport cleanliness、forbidden primary textを検証する |
| 3 | G. App Shell integration / primary cutover | Solo after B-F | B + C + D + E + F | 新shell、overlay task window、PSD clean task、quarantineをApp Shellに統合し、primaryからsupport regionを外す |
| 4 | H. Regression / UX verification | Solo after G | G | desktop/mobile、focused PSD、taskWindowUxFocused、guards、legacy absence/presenceを検証する |
| 5 | I. Documentation / traceability refresh | Solo after H | H | screen-design、capability map、backlog、traceabilityをWave55範囲へ同期する |
| 6 | J. Integration review and final report | Solo after I | I | clean final review、final report、残リスク整理を行う |

Safety constraints:

- A owns boundary and must not implement source.
- B-F must not perform final App Shell routing or merge overlapping shell decisions.
- B must not pull legacy support panels into the new Primary Human Shell.
- C must not treat `role=dialog` as sufficient; visual geometry is part of the implementation.
- D must not reuse the old PSD panel composition as human UI.
- E must not make quarantine a normal primary user surface.
- F must not weaken tests to pass the new UX.
- G owns central cutover and must not push source diff integration into Undine/root.
- H owns verification and must not accept DOM-only task-window proof.
- I owns docs/maps/traceability only.
- J owns final review/report and must return `needs_fix` if source changes are required.

## 10. Domain Assignments

### A. `wave55-reset-boundary-ownership-contract`

Purpose:

- Convert the three UI Reset inventories into an implementation ownership contract.
- Identify exact current source ownership for Primary Shell, Task Shell, PSD task content, legacy quarantine, and e2e gates.
- Decide whether B-F can run in parallel or must be split.
- Fix the UX AC and review rubric before source implementation starts.

Allowed write scope:

- `discussion/implementation/waves/wave55/**`
- `discussion/implementation/reviews/wave55/**`

Forbidden:

- Source implementation
- Broad source/test inventory beyond ownership/contract
- Product priority changes
- New authoring capability

Expected output:

- Domain A report/review with verdict.
- B-F write ownership matrix.
- UX AC checklist.
- Focused regression targets.
- User-decision points, if any.

### B. `wave55-primary-human-shell-v0`

Purpose:

- Create or replace the primary workspace shell so normal startup shows only UX-essential authoring regions.
- The new shell must not render `authoring-workspace-support` or legacy panel stack in normal flow.
- Preserve necessary props/callback pass-through for Parts Tree, Canvas/Preview, Inspector, Parameter/status strip, and Toolbox.

Allowed write scope:

- A-approved `apps/editor/src/ui/app-shell/**` files for primary shell components
- focused component/unit tests
- focused CSS for primary shell
- `discussion/implementation/waves/wave55/**`
- `discussion/implementation/reviews/wave55/**`

Forbidden:

- PSD Import content redesign
- task overlay implementation
- legacy quarantine route wiring
- broad visual design system
- deleting workflow/state/operation logic

### C. `wave55-task-window-overlay-ux-v0`

Purpose:

- Make task windows real workspace overlays/windows, not normal document-flow sections.
- Prevent Toolbox click from scrolling to a below-the-fold task surface.
- Preserve close/back/Escape/focus while adding geometry and viewport behavior.

Allowed write scope:

- A-approved task shell files under `apps/editor/src/ui/app-shell/**`
- focused CSS for task window overlay/backdrop/viewport containment
- focused task shell tests
- `discussion/implementation/waves/wave55/**`
- `discussion/implementation/reviews/wave55/**`

Forbidden:

- PSD-specific workflow logic
- full modal framework for every future tool
- browser-native modal
- OS-window behavior
- App Shell final routing

### D. `wave55-psd-import-clean-human-task-v0`

Purpose:

- Replace PSD Import primary human task content with a minimal UX-first flow.
- Use existing state/callback/operation contracts, but do not use existing panel composition as the UX reference.
- Keep evidence/test/Codex details out of the primary human task.

Allowed write scope:

- `apps/editor/src/ui/explicit-psd-import/**`
- narrowly assigned PSD task helper files
- focused component/unit tests
- `discussion/implementation/waves/wave55/**`
- `discussion/implementation/reviews/wave55/**`

Required visible UX:

- PSD file selection.
- Human parse status.
- PSD structure tree or empty state.
- Import scope/target summary.
- Preview/import/commit/cancel affordances as currently supported by state/callbacks.

Forbidden primary content:

- `Task Summary` as internal state table.
- raw PSD refs as primary status.
- operation IDs, approval IDs, plan digests, generated refs, evidence paths.
- raw parser payloads, command payloads, diagnostic IDs.
- test-selector-driven text.

### E. `wave55-legacy-debug-quarantine-surface-v0`

Purpose:

- Provide the minimum safe place for legacy/support panels or their evidence-heavy successors after they are removed from primary UI.
- Preserve debug/evidence/test reachability where required without making it a normal user-facing authoring surface.

Allowed write scope:

- A-approved quarantine/debug surface files under `apps/editor/src/ui/app-shell/**` or narrow existing support files
- focused tests for quarantine presence/absence
- `discussion/implementation/waves/wave55/**`
- `discussion/implementation/reviews/wave55/**`

Forbidden:

- Keeping legacy panels in primary workspace.
- Making quarantine look like the main Editor UX.
- Full Diagnostics/Evidence or Codex/Automation implementation.
- Moving every panel perfectly in one wave if a minimal quarantine is enough.

### F. `wave55-ux-focused-e2e-review-gate-v0`

Purpose:

- Add UX-focused verification that catches Wave54's failure mode.
- Ensure future waves cannot pass with DOM-only route/dialog evidence.

Allowed write scope:

- `apps/editor/e2e/**`
- focused e2e registry/check scripts if needed
- narrow screenshot/bounding-box helper files if needed
- `discussion/tests/traceability/test-traceability-matrix.md`
- `discussion/implementation/waves/wave55/**`
- `discussion/implementation/reviews/wave55/**`

Required checks:

- `taskWindowUxFocused` or equivalent focused ID.
- Desktop and mobile task window geometry.
- Open action does not cause scroll jump.
- Active task window is viewport-contained and overlay/fixed-like.
- Legacy/support panels are absent from primary first viewport.
- Forbidden primary text scan for raw refs, operation IDs, diagnostics IDs, evidence paths, command payloads, `Task Summary`.
- Screenshot artifact or visual geometry evidence beyond `base64Length`.

Forbidden:

- Weakening existing focused PSD tests.
- Treating `role=dialog` or `data-task-window-*` as sufficient.
- Making production behavior depend on `data-testid`.

### G. `wave55-app-shell-primary-cutover-integration`

Purpose:

- Integrate B-F outputs into the live App Shell.
- Cut over normal startup to the clean Primary Human Shell.
- Remove `authoring-workspace-support` from normal primary flow.
- Wire PSD Import to the overlay task window with clean task content.
- Keep legacy/debug quarantine reachable only as A-approved non-primary surface.

Allowed write scope:

- `apps/editor/src/app/**`
- A-approved `apps/editor/src/ui/app-shell/**`
- narrowly needed `apps/editor/src/ui/**` integration files
- focused integration/unit/e2e tests
- `discussion/implementation/waves/wave55/**`
- `discussion/implementation/reviews/wave55/**`

Forbidden:

- Full visual redesign.
- Reintroducing legacy panels into primary UI.
- Hiding required authoring controls without replacement or quarantine.
- Changing PSD import semantics.
- New authoring capability.

### H. `wave55-regression-ux-verification`

Purpose:

- Prove the UI reset did not break required workflows and did remove primary UI pollution.
- Run focused and aggregate checks required by A/G/F.

Allowed write scope:

- focused e2e/test fix files only if needed
- `discussion/implementation/waves/wave55/**`
- `discussion/implementation/reviews/wave55/**`

Required focus:

- Startup first viewport cleanliness.
- Primary shell layout desktop/mobile.
- Task window overlay UX desktop/mobile.
- PSD Import clean human task opens and remains usable.
- Existing five PSD focused IDs remain passing or are updated only for intended human text removal while preserving behavior/evidence checks.
- Source/dependency/testid/focused registry guards pass.

### I. `wave55-docs-traceability-refresh`

Purpose:

- Update maps, capability map, backlog, screen-design docs, and traceability docs to reflect Wave55 exactly.
- Record that legacy/support panels are quarantined from primary UI, not deleted from all code.

Allowed write scope:

- `discussion/design/screen-design/**`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/remaining-work-backlog.md`
- `discussion/implementation/_map.md`
- `discussion/implementation/orchestration/_map.md`
- `discussion/tests/traceability/test-traceability-matrix.md`
- `discussion/implementation/waves/wave55/**`
- `discussion/implementation/reviews/wave55/**`

Forbidden:

- Source implementation
- Unsupported capability claims
- Claiming full UI redesign completion

### J. `wave55-integration-review-and-final-report`

Purpose:

- Integrate Domains A-I, produce clean final integration review and final report.
- Confirm the wave closed the intended UX reset foundation without overclaiming full redesign.

Allowed write scope:

- `discussion/implementation/waves/wave55/**`
- `discussion/implementation/reviews/wave55/**`
- narrow final bookkeeping in implementation maps/backlog if required

Forbidden:

- Orch-Sylph自身によるsource code edits。source fixが必要な場合はGnomeに明示委譲し、Review-Sylphで再レビューする。
- Marking Wave55 pass if visual/UX gates are missing.

## 11. Subagent / Orch-Sylph Execution Policy

Wave55起動時の実行単位はdomainごとのOrch-Sylphである。

1. UndineはDomain AのOrch-Sylphを単独投入する。
2. Domain Aが`pass`し、B-Fのwrite ownershipが非重複なら、UndineはDomain B / C / D / E / Fを並列投入できる。
3. Domain AがB-F並列を危険と判断した場合、UndineはAの推奨batchに従う。
4. Domain B-Fがすべて`pass`したら、UndineはDomain Gを投入する。
5. Domain Gが`pass`したら、UndineはDomain Hを投入する。
6. Domain Hが`pass`したら、UndineはDomain Iを投入する。
7. Domain Iが`pass`したら、UndineはDomain Jを投入する。
8. 各Orch-Sylphは自分でsource実装せず、domain内でGnome実装とReview-Sylphレビューを別コンテキストに分離する。
9. Review-Sylphはclean contextで、implementation notesではなくbasis docs、target files、diff、tests、UX ACを根拠にレビューする。
10. Subagentからユーザーへ直接質問してはならない。質問はOrch-Sylphが集約し、Undineが重複排除してユーザーへ確認する。
11. Undineはcompletion reportが`pass`でないdomainをwave gate通過扱いにしない。
12. 長時間処理でも、UndineとOrch-Sylphは待機を理由にsubagentを打ち切らない。
13. Undineのroot context保護は最優先である。Undineは広域source/diff/test棚卸を自分で実施せず、必要な調査をdomainへ委譲する。

Each assignment must include:

```text
Orch-Sylph自身は実装担当ではない。source implementation は必ず別コンテキストの Gnome に委譲し、レビューは必ず別コンテキストの Review-Sylph に委譲すること。これを分離できない場合は実装せず escalate / blocked として報告すること。
```

## 12. Review Lanes

Every domain review must check:

- UX Reset Boundary: existing panels are not treated as UX source of truth.
- Primary UI Cleanliness: primary first viewport does not contain legacy/debug/evidence/Codex-heavy content.
- Logic Preservation: required state/callback/operation contracts are not broken.
- Task Window Visual UX: overlay/window geometry and no-scroll-open are verified, not just DOM role/metadata.
- PSD Human UI Boundary: PSD task shows user decisions and actions, not internal state dumps.
- Quarantine Boundary: legacy/debug/evidence/Codex-heavy surfaces are not normal authoring surfaces.
- Test Adequacy: visual/geometry/forbidden-text checks exist where UX claims are made.
- Existing Workflow Preservation: required focused PSD paths remain behaviorally proven.
- Test ID Boundary: `data-testid` remains test-facing, not production behavior-facing.
- Source Organization: `index.ts` files remain barrel-only and source organization guardrails pass.
- Orchestration Compliance: Orch-Sylph did not implement directly; Gnome implementation and Review-Sylph review are separated.

## 13. Verification Plan

Domain minimum verification:

- Domain A: boundary report/review, ownership matrix, UX AC checklist, `git diff --check`.
- Domain B: primary shell component/unit tests, primary first-viewport absence tests where feasible.
- Domain C: task window geometry/unit/e2e checks, no-scroll-open check.
- Domain D: PSD clean human task component tests and focused PSD behavior preservation.
- Domain E: quarantine presence/absence checks.
- Domain F: focused e2e registry/checks for `taskWindowUxFocused` and forbidden primary text scan.
- Domain G: integration tests/e2e proving clean primary shell, overlay task launch, quarantine separation.
- Domain H: desktop/mobile e2e, focused PSD e2e, UX focused e2e, production-testid guard, source/dependency guards.
- Domain I: docs/map/traceability consistency checks and `git diff --check`.
- Domain J: final integration review and final report.

Final verification target set:

- `pnpm typecheck`
- `pnpm test:unit`
- `pnpm test:e2e`
- `pnpm run check`
- `node scripts/run-focused-e2e.mjs --id taskWindowUxFocused` or A/F-approved equivalent
- `node scripts/run-focused-e2e.mjs --id taskWindowRoutingFocused`
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

UX-specific final verification must include:

- no open-trigger scroll jump for PSD Import task
- task window viewport containment on desktop and mobile
- task window overlay/static-flow detection
- primary first viewport forbidden text scan
- legacy/support panel absence from primary UI
- screenshot or bounding-box evidence with real assertions, not only base64 length

## 14. Early Escape / User Decision Points

Orch-Sylph must escalate if:

- Primary UI cleanup cannot proceed without a broader final design-system decision.
- Removing legacy panels from primary UI would break required workflow state/callbacks with no quarantine path.
- Task window overlay requires a final all-tool modal/window policy decision before v0 can ship.
- PSD Import clean human task requires changing PSD import/scaffold semantics.
- Existing focused e2e cannot be preserved without weakening behavior checks.
- Required human controls would be hidden without replacement or quarantine.
- Implementation requires new Mesh / Atlas / Parameter / Variant UI.
- Implementation requires external HTTP / WebSocket / MCP transport.
- Implementation requires semantic recognition, auto-classification, proposal generation, auto-rigging, or auto-fix.
- Visual UX cannot be verified beyond DOM metadata.

No additional user question is required before starting Wave55 under this plan. If the desired direction changes to full UI deletion, full design system, full Diagnostics/Evidence implementation, full Codex/Automation implementation, or feature implementation beyond PSD vertical slice cleanup, replace this plan before launch.

## 15. Expected Follow-up Sequence

Wave55 creates the reset foundation. Follow-up candidates:

1. PSD Import Task final UX v1: improve structure tree, preview, and import workflow on the clean task foundation.
2. Diagnostics / Evidence migration v1: move operation log, evidence paths, and diagnostic details into a real evidence surface.
3. Codex / Automation migration v1: organize Codex-facing status/transcript/command surface outside primary authoring.
4. Dedicated Viewer / Runtime view redesign.
5. Mesh / Rig / Parameter / Atlas authoring surface migrations, one workflow at a time.

This sequence is a planning expectation, not a binding promise. Each follow-up wave must run its own planning gate.

## 16. Pass Criteria

Wave55 passes when:

- Normal editor startup no longer shows legacy/debug/evidence/Codex-heavy support panels in the Primary Human UI.
- Primary Human UI Shell v0 shows only UX-essential authoring regions.
- Existing state/callback/operation contracts needed by the shell are preserved.
- PSD Import opens from Toolbox as an actual overlay/window-like workspace task and does not cause a scroll jump.
- PSD Import primary task UI is clean: file selection, parse/structure/import/preview/action flow, without internal state dump.
- `Task Summary`, raw refs, operation IDs, diagnostics IDs, evidence paths, command payloads, and test-selector strings are absent from primary human UI.
- Legacy/debug/evidence/Codex-heavy content is either quarantined or deferred without appearing in normal primary authoring.
- Visual/geometry UX checks exist and pass on desktop and mobile.
- Required PSD focused e2e IDs pass without weakening behavior/evidence coverage.
- Production `data-testid` guard, focused registry guard, source organization guard, and dependency guard pass.
- No Mesh generation, Texture Atlas packing, Parameter Manager implementation, Variant Manager implementation, full visual design system, full Diagnostics/Evidence implementation, full Codex/Automation implementation, semantic recognition, proposal generation, auto-rigging, renderer/pixel oracle, external transport, Cubism compatibility, or public demo asset work is introduced.
- Domain completion reports, Review-Sylph reviews, final integration report, clean review, and map/backlog updates are recorded under `discussion/implementation/`.
