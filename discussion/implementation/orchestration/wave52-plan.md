# Wave 52 Plan: PSD Import Task Migration v0

> Wave52で実装すべきdomain、依存順、Orch-Sylph投入方針を固定する計画。
> このwaveはWave51で作ったscreen-design debt foundationを使い、PSD Importを巨大1ページUIからTask Shellへ移す最初の実戦投入である。

## 1. 状態

- Status: Planned
- Target wave: Wave52
- Wave name: `psd-import-task-migration-v0`
- Primary objective: PSD Import / structural scaffold の人間向けUIを、常時workspace上の巨大panelからTask Shellで開くtaskへ移行する。Wave52では2並列で、汎用Task Shell / Task Chrome component と PSD Import Task Human UI component を分離して作り、統合domainで接続・観測・regressionをまとめる。Mesh / Atlas / Parameter / Variant などの新しいauthoring機能は追加しない。

## 2. Planning Gate Result

Planning Gate result before this plan: `Discuss first` -> `Plan directly`.

Planning basis:

- Wave51 final integration report is `pass` and Wave51 is the latest final implementation-proven baseline.
- Wave51 removed PSD Import production `data-testid` behavior coupling.
- Wave51 added minimal Task/View Shell metadata.
- Wave51 added PSD Import Task structured observation projector, but it is not yet consumed by UI/e2e/Codex-facing APIs.
- Wave51 added standalone production `data-testid` guard, but it is not yet integrated into `package.json`.
- The next screen-design implementation step should use the foundation instead of adding another UI-heavy authoring feature to the one-page workspace.

Accepted user direction:

- Continue UI debt repayment.
- Use 2 parallel component creation domains first.
- If the 2-parallel pattern is stable, consider 3 parallel domains in a later wave.
- Do not let parallel implementation shift integration burden into Undine/root context.

## 3. User Decisions / Design Boundary

Accepted decisions:

- Wave52 should target PSD Import Task Migration rather than Mesh generation/tool v0.
- Parallel work is valuable when components are independent and integration is centralized.
- Initial parallelism should be 2 component domains, not 3+.
- Parallel component domains must not perform final App Shell integration.
- Integration should be a separate domain with explicit ownership of wiring, focused e2e, and regression.

Design basis:

- [discussion/design/screen-design/scope-and-principles.md](../../design/screen-design/scope-and-principles.md)
- [discussion/design/screen-design/overview.md](../../design/screen-design/overview.md)
- [discussion/design/screen-design/screens/psd-import-task.md](../../design/screen-design/screens/psd-import-task.md)
- [discussion/design/screen-design/screens/authoring-workspace.md](../../design/screen-design/screens/authoring-workspace.md)
- [discussion/design/screen-design/components/toolbox.md](../../design/screen-design/components/toolbox.md)
- [discussion/design/screen-design/screens/diagnostics-evidence-view.md](../../design/screen-design/screens/diagnostics-evidence-view.md)
- [discussion/design/screen-design/screens/codex-automation-view.md](../../design/screen-design/screens/codex-automation-view.md)

Automation policy basis:

- [discussion/design/codex-friendly-automation-policy.md](../../design/codex-friendly-automation-policy.md)

## 4. Next Wave Selection

Wave51 established the foundation needed to stop adding everything to the one-page workspace. The most natural first migration target is PSD Import because:

- It is already documented as a task, not a persistent authoring control.
- It has a clear start/finish flow: choose PSD, parse, inspect tree, preview/approve, commit, return to authoring.
- It has already been decoupled from production `data-testid` selector behavior.
- Its machine-only evidence and human-facing summary boundary is already documented.
- Moving it reduces visible workspace complexity without requiring full workspace redesign.

Wave52 deliberately does not migrate every panel. It proves the migration pattern with one high-value task and a reusable Task Shell / Task Chrome component.

## 5. Repository Facts From Wave51

Facts treated as planning basis:

- `apps/editor/src/ui/explicit-psd-import/explicit-psd-import-panel.ts` uses local approval bindings for import-plan / structural scaffold behavior after Wave51.
- Stable `data-testid` hooks remain test-facing observation hooks.
- `apps/editor/src/ui/app-shell/shell-surfaces.ts` exists as minimal Task/View Shell metadata.
- `apps/editor/src/editor-state/explicit-psd-import-task-observation.ts` exists as a prepared structured observation projector.
- `scripts/check-production-testid-boundary.mjs` and related fixtures exist as standalone guards.
- Existing focused PSD regressions passed in Wave51 final verification.
- Current screen-design docs still leave final toolbox placement, modal/task view/dedicated view decisions, and full visual redesign as future work.

## 6. Design Decisions

- Wave52 uses exactly 2 parallel component creation domains:
  - Generic Task Shell / Task Chrome component.
  - PSD Import Task Human UI component.
- Component creation domains must expose explicit inputs/outputs and avoid final App Shell integration.
- Integration is centralized in a later domain that owns opening PSD Import as a task and preserving existing workflows.
- PSD Import Task migration should reduce always-visible workspace noise, but it must not hide required functionality.
- Human UI should show concise source/parse/tree/preview/warning/approval/commit information.
- Operation IDs, approval digests, raw parser payloads, generated refs, evidence paths, and test selector strings remain outside the primary human UI.
- Existing PSD focused e2e IDs must remain valid unless a stable replacement is explicitly documented and reviewed.
- Wave52 may connect the Wave51 structured observation projector to a narrow UI/test-facing consumer if it is needed for safe migration.
- Wave52 may add a standard verification script hook for the production `data-testid` guard only if it stays narrow and does not cause broad package-script churn. If not done, it must be recorded as residual debt.

## 7. Non-Goals

- Mesh generation, mesh preset UI, mesh preview overlay, batch mesh generation, triangulation, retopology, or automatic mesh editing.
- Texture Atlas packing, atlas preview, UV unwrap, texture sampling correctness, renderer/pixel oracle, or Photoshop compositing.
- Parameter Manager, Variant / Expression Manager, Viewer / Runtime redesign, Product Preflight redesign, Diagnostics / Evidence View final UI, or Codex / Automation View final UI.
- Full app-wide visual redesign, final toolbox implementation, final modal/window framework, or complete panel migration.
- Moving all evidence/debug panels.
- Removing all existing DOM/text e2e oracles.
- Structural-specific Codex execute/stale command parity unless a narrow read/status connection is needed and explicitly escalated.
- External HTTP / WebSocket / MCP transport.
- LLM provider integration, repo-side proposal generation, semantic recognition, auto-classification, auto-rigging, auto-fix, or automatic commit.
- Cubism compatibility, Cubism SDK/Core integration, `.moc3`, `.cmo3`, `.model3.json`, `.physics3.json`, `.motion3.json`, `.pose3.json`.
- Public demo asset work.
- Persisting source PSD bytes or raw parser objects as package capabilities.

## 8. Basis Documents

Undineが保持する最小basis:

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `C:/Users/remie/.codex/skills/planning-gate/SKILL.md`
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

Domain basis as needed:

- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/diagnostic-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`
- `discussion/tests/traceability/test-traceability-matrix.md`
- `discussion/tests/fixtures/fixture-manifest.md`
- Wave45-Wave51 PSD import/scaffold/screen-design reports and reviews where PSD surface details are needed
- Wave42 focused e2e registry and source guard reports where quality gate changes are needed

UndineはEditor source、e2e全体、command host source全文を自分で読み込まない。詳細source、diff、test evidenceはOrch-Sylphがdomain必要分だけ読み、Gnome / Review-Sylphへ狭く渡す。

## 9. Dependency / Parallel Design

Wave52 uses 2 parallel component creation domains after a short boundary gate. Integration remains centralized.

| Batch | Domain | Parallelism | Dependency | Purpose |
|---|---|---|---|---|
| 1 | A. Boundary / component contract inventory | Solo first | Wave51 final pass + screen-design docs | 2並列の契約、write scope、task migration boundary、integration ownershipを固定する |
| 2 | B. Generic Task Shell / Task Chrome component | Parallel with C | A | Reusable task shell / chrome component with title, status, primary actions, back/close affordance, slots, and accessibility basics |
| 2 | C. PSD Import Task Human UI component | Parallel with B | A | Existing PSD Import human-facing UIをTask contentとして分離し、machine-only情報をprimary UIへ戻さない |
| 3 | D. PSD Import Task integration / observation bridge | Solo after B/C | B + C | Task ShellへPSD Import Taskを載せ、workspaceから開けるようにし、structured observation / focused e2eを接続する |
| 4 | E. Focused regression / guard integration | Solo after D | D | PSD focused e2e、production-testid guard、task migration regressions、existing workflow preservationを確認する |
| 5 | F. Documentation / traceability refresh | Solo after E | E | screen-design implementation status、capability map、backlog、traceabilityをWave52範囲へ同期する |
| 6 | G. Integration review and final report | Solo after F | F | final verification、clean integration review、final report、map/backlog更新を行う |

Safety constraints:

- A owns boundary and must not implement source.
- B and C are parallel component creation domains. They must not perform final App Shell integration.
- B owns generic shell/chrome, not PSD-specific workflow logic.
- C owns PSD Import task content extraction/human UI, not app-level routing.
- D owns integration and must reconcile B/C outputs without pushing unresolved conflicts into Undine.
- E owns focused regression/guard verification and must not weaken tests to make migration pass.
- F owns docs/maps/traceability only.
- G owns final review/report and must return `needs_fix` if source changes are required.

## 10. Domain Assignments

### A. `wave52-boundary-component-contract-inventory`

Purpose:

- Confirm the exact PSD Import Task migration boundary.
- Define the interface between Generic Task Shell / Task Chrome and PSD Import Task Human UI.
- Confirm which files B/C may edit without collisions.
- Confirm the integration domain owns all App Shell wiring.
- Confirm focused regression IDs and observation targets.
- Confirm whether production `data-testid` guard script integration is in Wave52 or deferred.

Allowed write scope:

- `discussion/implementation/waves/wave52/**`
- `discussion/implementation/reviews/wave52/**`
- narrow notes in `discussion/design/screen-design/**` only if the basis needs an implementation-readiness note

Forbidden:

- Source implementation
- Broad source/test/e2e inventory
- Product priority changes
- New authoring capability
- User-facing full layout redesign

Expected output:

- Domain A report with verdict `pass`, `needs_fix`, `escalate`, or `blocked`.
- B/C component contracts.
- D integration contract.
- Exact file ownership guidance.
- User-decision points, if any.

### B. `wave52-generic-task-shell-task-chrome-component`

Purpose:

- Implement reusable Task Shell / Task Chrome component for future task migrations.
- Support title, concise status, back/close affordance, primary action slot, secondary/action status slot, diagnostics summary slot, and content slot.
- Keep it generic and reusable for PSD Import, Atlas, Parameter, Variant, Storage, Validation, Diagnostics, and Codex views.

Allowed write scope:

- `apps/editor/src/ui/app-shell/**`
- new narrowly named task shell files under `apps/editor/src/ui/**`
- focused component/unit tests
- `discussion/implementation/waves/wave52/**`
- `discussion/implementation/reviews/wave52/**`

Forbidden:

- PSD import workflow logic
- App Shell final integration
- Moving existing panels
- Adding UI dependencies unless escalated
- Full visual redesign
- Mesh / Atlas / Parameter / Variant capability

### C. `wave52-psd-import-task-human-ui-component`

Purpose:

- Extract or create PSD Import Task Human UI content so it can live inside Task Shell.
- Preserve existing PSD import-plan / structural scaffold semantics.
- Keep human primary UI focused on source summary, parse/tree state, import scope, scaffold preview summary, warning summary, approval/commit state.
- Keep machine-only details out of primary UI.

Allowed write scope:

- `apps/editor/src/ui/explicit-psd-import/**`
- focused PSD Import component/unit tests
- `discussion/implementation/waves/wave52/**`
- `discussion/implementation/reviews/wave52/**`

Forbidden:

- App Shell final integration
- Reintroducing production `data-testid` behavior dependency
- Removing stable test hooks without replacement
- Changing PSD import semantics
- Adding structural-specific Codex execute/stale command parity
- Mesh / Atlas / Parameter / Variant capability
- Full PSD Import redesign beyond migration-ready human UI componentization

### D. `wave52-psd-import-task-integration-observation-bridge`

Purpose:

- Wire Generic Task Shell and PSD Import Task Human UI into App Shell.
- Move PSD Import from always-visible workspace panel to Task Shell / task view entry without making a full workspace redesign.
- Provide a clear entry point from Empty / Authoring Workspace.
- Connect Wave51 structured observation projector to a narrow test-facing or debug/status surface if needed for safe migration.
- Preserve existing PSD import focused flows.

Allowed write scope:

- `apps/editor/src/app/**`
- `apps/editor/src/ui/app-shell/**`
- `apps/editor/src/ui/explicit-psd-import/**`
- `apps/editor/src/editor-state/**` only for observation connection if required
- `apps/editor/e2e/**` focused updates only
- `discussion/implementation/waves/wave52/**`
- `discussion/implementation/reviews/wave52/**`

Forbidden:

- Full workspace visual redesign
- Moving unrelated panels
- Final toolbox implementation beyond a minimal Import task entry
- Removing existing workflows
- Broad e2e oracle migration
- New authoring capability

### E. `wave52-focused-regression-and-guard-integration`

Purpose:

- Prove PSD Import task migration did not regress Wave45-Wave51 paths.
- Run all required focused PSD e2e IDs.
- Run production `data-testid` guard.
- Decide and implement, if in-scope and low-risk, standard script integration for the production `data-testid` guard; otherwise record explicit deferral.

Allowed write scope:

- `apps/editor/e2e/**`
- `scripts/**`
- `package.json` only if Domain A/D explicitly confirmed guard script integration is in scope and Review-Sylph accepts it
- `discussion/tests/traceability/test-traceability-matrix.md`
- `discussion/tests/fixtures/fixture-manifest.md`
- `discussion/implementation/waves/wave52/**`
- `discussion/implementation/reviews/wave52/**`

Forbidden:

- Product implementation beyond regression hooks
- Broad aggregate e2e expansion
- Weakening focused tests
- Removing focused IDs without replacement
- Lockfile churn unless package scripts truly require it and review accepts no dependency change

Required focus:

- `psdStructuralInitialStateFocused`
- `psdImportPlanCodexFocused`
- `psdImportPlanFocused`
- `psdMultiLayerBatchFocused`
- `psdImportFocused`
- `check-production-testid-boundary`
- `check-production-testid-boundary-fixtures`

### F. `wave52-docs-traceability-screen-design-refresh`

Purpose:

- Update implementation maps, capability map, backlog, and screen-design implementation status to reflect Wave52 exactly.
- Record PSD Import Task Migration as done only if D/E pass.
- Record remaining screen-design migration waves as future work.

Allowed write scope:

- `discussion/_map.md` if top-level current status needs updating
- `discussion/design/screen-design/**`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/remaining-work-backlog.md`
- `discussion/implementation/_map.md`
- `discussion/implementation/orchestration/_map.md`
- `discussion/tests/fixtures/fixture-manifest.md`
- `discussion/tests/traceability/test-traceability-matrix.md`
- `discussion/implementation/waves/wave52/**`
- `discussion/implementation/reviews/wave52/**`

Forbidden:

- Source implementation
- Unsupported capability claims
- Claiming full screen-design completion
- Claiming Mesh / Atlas / Parameter / Variant progress

### G. `wave52-integration-review-and-final-report`

Purpose:

- Integrate Domains A-F, run final verification, produce clean integration review and final report, and update maps/backlog.

Allowed write scope:

- `discussion/implementation/waves/wave52/**`
- `discussion/implementation/reviews/wave52/**`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/remaining-work-backlog.md`
- `discussion/implementation/_map.md`
- `discussion/implementation/orchestration/_map.md`
- `discussion/_map.md` if final baseline status needs top-level sync
- narrow final bookkeeping in traceability/screen-design docs if required

Forbidden:

- Orch-Sylph自身によるsource code edits。source fixが必要な場合はGnomeに明示委譲し、Review-Sylphで再レビューする。
- Broad documentation rewrite unless Wave52 evidence registration requires it and scope is narrow.

## 11. Subagent / Orch-Sylph Execution Policy

Wave52起動時の実行単位はdomainごとのOrch-Sylphである。

1. UndineはDomain AのOrch-Sylphを単独投入する。
2. Domain Aが`pass`したら、UndineはDomain B / Cを並列投入できる。
3. Domain B / Cが両方`pass`したら、UndineはDomain Dを投入する。
4. Domain Dが`pass`したら、UndineはDomain Eを投入する。
5. Domain Eが`pass`したら、UndineはDomain Fを投入する。
6. Domain Fが`pass`したら、UndineはDomain Gを投入する。
7. 各Orch-Sylphは自分でsource実装せず、domain内でGnome実装とReview-Sylphレビューを別コンテキストに分離する。
8. Review-Sylphはclean contextで、implementation notesではなくbasis docs、target files、diff、testsを根拠にレビューする。
9. Subagentからユーザーへ直接質問してはならない。質問はOrch-Sylphが集約し、Undineが重複排除してユーザーへ確認する。
10. Undineはcompletion reportが`pass`でないdomainをwave gate通過扱いにしない。
11. 長時間処理でも、UndineとOrch-Sylphは待機を理由にsubagentを打ち切らない。
12. Undineのroot context保護は最優先である。Undineは広域source/diff/test棚卸を自分で実施せず、必要な調査をdomainへ委譲する。

Each assignment must include:

```text
Orch-Sylph自身は実装担当ではない。source implementation は必ず別コンテキストの Gnome に委譲し、レビューは必ず別コンテキストの Review-Sylph に委譲すること。これを分離できない場合は実装せず escalate / blocked として報告すること。
```

## 12. Review Lanes

Every domain review must check:

- Parallel Boundary: B/C do not integrate into App Shell directly and do not edit overlapping files beyond A-approved scope.
- Human UI Boundary: PSD Import Task shows human-relevant summaries and does not reintroduce machine-only debug detail as primary UI.
- Test ID Boundary: `data-testid` remains test-facing, not production behavior-facing.
- Existing Workflow Preservation: Wave45-Wave51 PSD focused paths remain passing.
- Shell Scope: Task Shell / Task Chrome is reusable and minimal, not a full modal/window framework.
- Evidence Truthfulness: operation IDs, digests, evidence paths, raw parser payloads, and generated refs are not pushed back into primary human UI.
- Codex Policy: repo/Editor do not add semantic recognition, proposal generation, auto-rigging, auto-fix, or auto-commit.
- Test Adequacy: component tests, integration tests, focused PSD e2e, and guard checks cover the migration.
- Source Organization: `index.ts` files remain barrel-only and source organization guardrails pass.
- Orchestration Compliance: Orch-Sylph did not implement directly; Gnome implementation and Review-Sylph review are separated.

## 13. Verification Plan

Domain minimum verification:

- Domain A: boundary report/review, component contract list, ownership matrix, `git diff --check`.
- Domain B: Task Shell / Task Chrome component tests, source organization check if new files are added.
- Domain C: PSD Import Task Human UI component tests and static scan for machine-only primary UI regressions.
- Domain D: task integration tests/e2e proving PSD Import opens as a task and current workflows remain reachable.
- Domain E: focused PSD e2e and production-testid guard scripts.
- Domain F: docs/map/traceability consistency checks and `git diff --check`.
- Domain G: final full verification and clean integration review.

Final verification:

- `pnpm typecheck`
- `pnpm test:unit`
- `pnpm test:e2e`
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
- forbidden-scope scan for new Mesh/Atlas feature claims, semantic recognition, suggestion UI, proposal generation, auto classify, auto-fix, automatic commit, Photoshop compositing, renderer/pixel oracle, external transport, Cubism, public demo asset, persisted source PSD bytes/raw parser objects

## 14. Early Escape / User Decision Points

Orch-Sylph must escalate if:

- PSD Import Task migration requires a final decision between modal, dedicated view, or side panel beyond what Wave52 can safely infer.
- B/C component contracts conflict or require overlapping edits that cannot be merged cleanly.
- App Shell integration requires full workspace redesign or moving many unrelated panels.
- Existing focused e2e cannot be preserved without weakening tests.
- The migration requires hiding required PSD Import controls without replacement.
- The migration requires structural-specific Codex execute/stale command parity.
- The migration requires new Mesh / Atlas / Parameter / Variant UI.
- The implementation requires external HTTP / WebSocket / MCP transport.
- The implementation requires semantic recognition, auto-classification, proposal generation, auto-rigging, or auto-fix.
- The implementation requires renderer/pixel oracle, Photoshop compositing, Cubism compatibility, or public demo assets.

No additional user question is required before starting Wave52 under this plan. If the desired direction changes to full workspace visual redesign, Mesh generation, Texture Atlas, or Codex external transport, replace this plan before launch.

## 15. Expected Follow-up Sequence

Wave52 proves one task migration. Follow-up candidates after Wave52:

1. Workspace Layout Migration v0: make Authoring Workspace visibly lighter with Toolbox, Parts Tree, Canvas, Inspector, Parameter Bar, and Diagnostics Strip.
2. Diagnostics / Evidence View Separation v0: move operation log, generated evidence, package file set, reload summary, and full diagnostics out of normal authoring UI.
3. Codex / Automation View Separation v0: organize proposal review, approval, transcript, command surface status, and operation availability.
4. Texture Atlas Task v0 or Mesh generation/tool v0: add new authoring capability only after UI home and surface boundaries are stable.
5. 3-parallel component creation wave: attempt three parallel component domains only if Wave52 integration remains stable.

This sequence is a planning expectation, not a binding promise. Each follow-up wave must run its own planning gate.

## 16. Pass Criteria

Wave52 passes when:

- PSD Import is reachable as a Task Shell task from Empty / Authoring Workspace.
- PSD Import is no longer a constantly dominant always-visible workspace panel.
- Generic Task Shell / Task Chrome component exists and is tested.
- PSD Import Task Human UI component exists and preserves existing PSD import-plan / structural scaffold semantics.
- App Shell integration is centralized and does not force Undine/root into diff integration work.
- Wave51 structured observation projector is consumed narrowly or its non-consumption is explicitly reviewed and deferred.
- Existing stable `data-testid` hooks remain test-facing and production behavior does not query them for behavior-critical state.
- All required PSD focused e2e IDs pass.
- Production `data-testid` guard passes and guard script integration is either completed or explicitly deferred with review approval.
- No Mesh generation, Texture Atlas packing, Parameter Manager implementation, Variant Manager implementation, full visual redesign, semantic recognition, proposal generation, auto-rigging, renderer/pixel oracle, external transport, Cubism compatibility, or public demo asset work is introduced.
- `index.ts` files remain barrel-only and source organization guardrails pass.
- Domain completion reports, Review-Sylph reviews, final integration report, clean review, and map/backlog updates are recorded under `discussion/implementation/`.
