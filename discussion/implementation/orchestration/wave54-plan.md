# Wave 54 Plan: Task Window & Surface Separation v0

> Wave54で実装すべきdomain、依存順、Orch-Sylph投入方針を固定する計画。
> このwaveはWave53のAuthoring Workspace v0 skeletonを前提に、Toolboxから開くtask itemの基本表現をworkspace-scoped task windowとして実装し、PSD Importの導線を磨きつつ、Diagnostics / Evidence と Codex / Automation の分離入口を作る。

## 1. 状態

- Status: Planned
- Target wave: Wave54
- Wave name: `task-window-surface-separation-v0`
- Primary objective: Toolbox task itemの基本表現をworkspace-scoped task windowとして定義・実装し、PSD Importをそのtask windowで自然に開けるようにする。同時に、legacy support panelsに残るEvidence / Debug / Codex-heavy UIを通常Authoring Workspaceから分離し始めるため、Diagnostics / Evidence View skeleton と Codex / Automation View skeleton を作る。Mesh / Atlas / Parameter Manager / Variant Managerなどの新しいauthoring機能は追加しない。

## 2. Planning Gate Result

Planning Gate result before this plan: `Discuss first` -> `Plan directly`.

Planning basis:

- Wave53 final integration report/review is `pass` and Wave53 is the latest final implementation-proven baseline.
- Wave53 delivered Authoring Workspace v0 skeleton: App Bar, Toolbox, Structure / Parts Tree, Canvas / Preview, Inspector, Parameter Bar, and Diagnostics Strip.
- Wave53 left final modal/task-window/dedicated-view policy unresolved.
- Screen-design docs state that PSD Import should be called from Toolbox or empty state as a task window / modal / dedicated task panel, not as a default always-visible workspace panel.
- User confirmed the desired next direction: the left Toolbox PSD Import button should open a dialog/window-like PSD Import task surface.
- User requested larger wave design with more independent tasks and higher parallelism, without merely extending the serial chain.

Accepted user direction:

- Treat `workspace-scoped task window` as the Wave54 v0 default for task items that should open over the workspace.
- Increase wave parallelism by including multiple independent surface-building domains.
- Keep final integration centralized so increased parallelism does not become Undine/root context integration work.
- Keep Undine/root context protected. Detailed source inventory, diffs, test logs, and broad current-state investigation must be delegated to domain Orch-Sylphs.

## 3. User Decisions / Design Boundary

Accepted decisions:

- Wave54 should target Task Window & Surface Separation v0.
- PSD Import should open from the left Toolbox as a workspace-scoped task window/dialog-like surface.
- The Wave54 task window is not an OS window and not a browser-native modal; it is an in-app workspace-scoped task surface with close/back, focus handling, title/status, actions, and content slots.
- Viewer / Runtime remains dedicated-view leaning and is not converted into a task window in Wave54.
- Diagnostics / Evidence and Codex / Automation should get skeleton separated surfaces, but not final full implementations.
- Wave54 may run more domains in parallel than Wave52-Wave53, as long as file ownership is explicit and final wiring is centralized.

Design basis:

- [discussion/design/screen-design/_map.md](../../design/screen-design/_map.md)
- [discussion/design/screen-design/scope-and-principles.md](../../design/screen-design/scope-and-principles.md)
- [discussion/design/screen-design/overview.md](../../design/screen-design/overview.md)
- [discussion/design/screen-design/screens/authoring-workspace.md](../../design/screen-design/screens/authoring-workspace.md)
- [discussion/design/screen-design/screens/psd-import-task.md](../../design/screen-design/screens/psd-import-task.md)
- [discussion/design/screen-design/screens/diagnostics-evidence-view.md](../../design/screen-design/screens/diagnostics-evidence-view.md)
- [discussion/design/screen-design/screens/codex-automation-view.md](../../design/screen-design/screens/codex-automation-view.md)
- [discussion/design/screen-design/components/toolbox.md](../../design/screen-design/components/toolbox.md)
- [discussion/design/screen-design/components/parts-tree.md](../../design/screen-design/components/parts-tree.md)

Automation policy basis:

- [discussion/design/codex-friendly-automation-policy.md](../../design/codex-friendly-automation-policy.md)

## 4. Next Wave Selection

Wave54 is selected because Wave53 created the workspace skeleton but left the most visible task-launch behavior unresolved.

The highest-value next step is not a new authoring feature. It is the interaction layer that future task-style features will reuse:

- PSD Import needs a clear workspace-scoped task window instead of a vaguely reachable task view.
- Texture Atlas, Project Storage, Validation, Parameter Manager, and Variant / Expression Manager will all need a consistent task/window/dedicated-view policy later.
- Diagnostics / Evidence and Codex / Automation need separated homes before more human UI is cleaned up.
- Duplicate / legacy selector and DOM oracle risk should be tightened while the screen migration is still fresh.

Wave54 deliberately bundles several independent surface components so B-F can run in parallel. It still keeps App Shell wiring in a single integration domain.

## 5. Repository Facts From Wave53

Facts treated as planning basis:

- Authoring Workspace v0 skeleton exists in live App Shell.
- Toolbox launcher exists on the left side.
- PSD Import remains reachable as a Task Shell task and is not a default always-visible workspace panel.
- Legacy support panels still contain older evidence/debug/Codex-heavy UI below or around the primary v0 skeleton.
- Duplicate drawable-list hooks are nonblocking in current tests, but future tests that target the legacy list should scope through a stable wrapper.
- Existing focused PSD e2e IDs passed under Wave53 final verification.
- `check:testids` is included in standard `check`.
- `check:testids:fixtures` exists but remains outside standard `check`.

## 6. Design Decisions

- Wave54 uses a workspace-scoped task window as the default implementation target for task items that should appear over the Authoring Workspace.
- Task window shell owns chrome, title/status, close/back, primary/secondary action slots, content slot, focus/escape basics, and disabled/loading/error state.
- Task window shell must be generic and must not contain PSD-specific behavior.
- PSD Import Task Window owns PSD-specific content adaptation and navigation polish, not generic task window behavior.
- Diagnostics / Evidence View skeleton owns evidence/debug detail placement, not human authoring controls.
- Codex / Automation View skeleton owns Codex/AI transcript and command status placement, not proposal generation or LLM integration.
- Test-facing / selector hardening owns duplicate selector risk and structured observation direction, not user-visible feature work.
- App Shell integration owns final wiring of the parallel outputs and must not push merge decisions to Undine/root.
- Human UI should remain concise. Operation IDs, approval digests, generated refs, raw parser payloads, evidence paths, and command payloads remain outside primary human UI.

## 7. Non-Goals

- Mesh generation, mesh preset UI, mesh preview overlay, batch mesh generation, triangulation, retopology, or automatic mesh editing.
- Texture Atlas packing, atlas preview, UV unwrap, texture sampling correctness, renderer/pixel oracle, or Photoshop compositing.
- Full Parameter Manager implementation, Variant / Expression Manager implementation, Viewer / Runtime redesign, or Product Preflight redesign.
- Full Diagnostics / Evidence View implementation or full Codex / Automation View implementation.
- Final visual redesign, final design system, CSS framework migration, or UI framework adoption.
- Final modal/window/dedicated-view policy for every tool and view.
- Moving every legacy panel or deleting every legacy UI block in one wave.
- Removing all existing DOM/text e2e oracles.
- Structural-specific Codex execute/stale command parity.
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
- `discussion/design/screen-design/components/toolbox.md`

Domain basis as needed:

- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/diagnostic-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`
- `discussion/tests/traceability/test-traceability-matrix.md`
- `discussion/tests/fixtures/fixture-manifest.md`
- `discussion/design/screen-design/screens/diagnostics-evidence-view.md`
- `discussion/design/screen-design/screens/codex-automation-view.md`
- Wave51-Wave53 screen-design reports and reviews where UI boundary details are needed
- Wave42 focused e2e registry and source guard reports where quality gate changes are needed

UndineはEditor source、e2e全体、command host source全文を自分で読み込まない。詳細source、diff、test evidenceはOrch-Sylphがdomain必要分だけ読み、Gnome / Review-Sylphへ狭く渡す。

## 9. Dependency / Parallel Design

Wave54 intentionally increases parallelism. After Domain A fixes ownership, Domains B-F may run in parallel if A confirms non-overlapping write scopes. If A finds collisions, it may split B-F into two parallel batches, but the target design is 5-way parallel component / surface creation.

| Batch | Domain | Parallelism | Dependency | Purpose |
|---|---|---|---|---|
| 1 | A. Boundary / current surface inventory | Solo first | Wave53 final pass + screen-design docs | Task window contract、legacy support panel classification、B-F ownership、G integration contract、regression targetsを固定する |
| 2 | B. Generic Task Window Shell | Parallel with C/D/E/F | A | workspace-scoped task window chrome / slots / focus basicsを作る。PSD非依存 |
| 2 | C. PSD Import Task Window Polish | Parallel with B/D/E/F | A | PSD Importをtask window内で自然に見せるcontent/navigation polishを作る。generic chromeは作らない |
| 2 | D. Diagnostics / Evidence View Skeleton | Parallel with B/C/E/F | A | raw evidence/debug detailsの分離先skeletonを作る。最終full viewではない |
| 2 | E. Codex / Automation View Skeleton | Parallel with B/C/D/F | A | AI/Codex transcript / command status / automation detailの分離先skeletonを作る。LLM機能は作らない |
| 2 | F. Test-facing / Selector Scope Hardening | Parallel with B/C/D/E | A | duplicate drawable-list hook、task-window observation、DOM/text oracle riskを狭く締める |
| 3 | G. App Shell integration / window routing | Solo after B-F | B + C + D + E + F | B-FをApp Shellへ統合し、ToolboxからPSD Import task windowを開く。中央配線を所有 |
| 4 | H. Focused regression / responsive / guard verification | Solo after G | G | desktop/mobile、PSD focused、task window behavior、guardsを確認する |
| 5 | I. Documentation / traceability refresh | Solo after H | H | screen-design implementation status、capability map、backlog、traceabilityをWave54範囲へ同期する |
| 6 | J. Integration review and final report | Solo after I | I | final verification、clean integration review、final report、map/backlog更新を行う |

Safety constraints:

- A owns boundary and must not implement source.
- B-F must not perform final App Shell routing or shared integration.
- B owns generic shell only; no PSD workflow.
- C owns PSD-specific task content/polish only; no generic shell.
- D owns diagnostics/evidence skeleton only; no Codex automation and no final full evidence browser.
- E owns Codex/Automation skeleton only; no LLM, proposal generation, or external transport.
- F owns test-facing / selector risk hardening only; no product UX feature.
- G owns integration and must resolve B-F outputs without pushing source diff integration into Undine.
- H owns verification and must not weaken tests to pass.
- I owns docs/maps/traceability only.
- J owns final review/report and must return `needs_fix` if source changes are required.

## 10. Domain Assignments

### A. `wave54-boundary-current-surface-inventory`

Purpose:

- Confirm current App Shell task routing, Toolbox task launch path, PSD Import surface, legacy support panels, Diagnostics / Evidence candidates, Codex / Automation candidates, and selector/test risks.
- Define B-F non-overlapping file ownership.
- Define G integration ownership.
- Decide whether B-F can run as a 5-way parallel batch or must be split.
- Confirm focused regression targets.
- Confirm no user decision is needed before B-F start.

Allowed write scope:

- `discussion/implementation/waves/wave54/**`
- `discussion/implementation/reviews/wave54/**`
- narrow notes in `discussion/design/screen-design/**` only if implementation-readiness status needs updating

Forbidden:

- Source implementation
- Broad source/test/e2e inventory beyond the bounded surface and ownership question
- Product priority changes
- New authoring capability
- Final visual redesign

Expected output:

- Domain A report with verdict `pass`, `needs_fix`, `escalate`, or `blocked`.
- B-F ownership matrix and integration contract.
- Regression target list.
- User-decision points, if any.

### B. `wave54-generic-task-window-shell`

Purpose:

- Implement reusable workspace-scoped task window shell.
- Provide title/status region, close/back controls, primary/secondary action slots, content slot, diagnostics/status strip slot, loading/error/disabled states, focus/escape basics, and accessible labels.
- Keep it generic and reusable for PSD Import, Atlas, Storage, Validation, Parameter, Variant, and future task surfaces.

Allowed write scope:

- `apps/editor/src/ui/app-shell/**` only for generic task window shell files if A assigns ownership here
- focused component/unit tests
- `discussion/implementation/waves/wave54/**`
- `discussion/implementation/reviews/wave54/**`

Forbidden:

- PSD import workflow logic
- App Shell final routing
- Diagnostics / Evidence content
- Codex / Automation content
- New dependencies unless escalated
- Full visual redesign

### C. `wave54-psd-import-task-window-polish`

Purpose:

- Adapt existing PSD Import Task Human UI to work naturally inside the task window shell.
- Improve source/tree/preview/approval/commit/cancel flow within the bounded Human UI surface.
- Preserve PSD import-plan / structural scaffold semantics and focused paths.
- Keep machine-only details out of primary PSD Import human UI.

Allowed write scope:

- `apps/editor/src/ui/explicit-psd-import/**`
- narrowly named PSD Import task content helpers if A assigns ownership here
- focused component/unit tests
- `discussion/implementation/waves/wave54/**`
- `discussion/implementation/reviews/wave54/**`

Forbidden:

- Generic task window shell
- App Shell final routing
- Reintroducing PSD Import as always-visible panel
- Reintroducing production `data-testid` behavior dependency
- Changing PSD import semantics
- Codex command parity expansion
- Mesh / Atlas / Parameter / Variant capability

### D. `wave54-diagnostics-evidence-view-skeleton`

Purpose:

- Create a separated Diagnostics / Evidence View skeleton as the future home for operation log, generated evidence, package file set, reload summary, full diagnostics, and PSD import evidence details.
- Provide a minimal read-only structure and summary slots sufficient for Wave54 separation work.
- Do not move every legacy evidence panel in this wave unless A/G explicitly scope a narrow move.

Allowed write scope:

- `apps/editor/src/ui/app-shell/**` or narrowly named diagnostics/evidence view files if A assigns ownership here
- focused component/unit tests
- `discussion/implementation/waves/wave54/**`
- `discussion/implementation/reviews/wave54/**`

Forbidden:

- Full evidence browser implementation
- Product Preflight redesign
- Codex / Automation content
- App Shell final routing
- Broad evidence migration
- External transport or persisted report changes

### E. `wave54-codex-automation-view-skeleton`

Purpose:

- Create a separated Codex / Automation View skeleton as the future home for Codex proposal review, AI approval, transcript, command status, operation availability, and automation details.
- Provide a minimal read-only / navigation structure sufficient to stop treating these details as normal authoring UI.

Allowed write scope:

- `apps/editor/src/ui/app-shell/**` or narrowly named codex/automation view files if A assigns ownership here
- focused component/unit tests
- `discussion/implementation/waves/wave54/**`
- `discussion/implementation/reviews/wave54/**`

Forbidden:

- LLM/provider integration
- Proposal generation, repair generation/ranking, auto-fix, auto-commit
- External HTTP / WebSocket / MCP transport
- Diagnostics / Evidence content
- App Shell final routing
- Broad command-host changes

### F. `wave54-test-facing-selector-scope-hardening`

Purpose:

- Tighten test-facing surfaces and selector scope around the new task window and existing duplicate drawable-list hook risk.
- Provide narrow wrapper scoping, structured state hooks, or guard updates only where needed to keep tests stable without production behavior depending on `data-testid`.
- Preserve existing focused IDs and avoid broad DOM/text oracle migration.

Allowed write scope:

- focused `apps/editor/e2e/**` updates
- focused component/unit tests
- `scripts/**` only for narrow guard/test registration fixes
- `discussion/tests/traceability/test-traceability-matrix.md`
- `discussion/tests/fixtures/fixture-manifest.md`
- `discussion/implementation/waves/wave54/**`
- `discussion/implementation/reviews/wave54/**`

Forbidden:

- Product feature implementation
- Weakening focused tests
- Removing focused IDs without replacement
- Broad e2e rewrite
- Production behavior coupling to `data-testid`
- Lockfile or dependency churn

### G. `wave54-app-shell-integration-window-routing`

Purpose:

- Integrate B-F outputs into App Shell.
- Wire Toolbox PSD Import task item to open PSD Import in the workspace-scoped task window.
- Add or preserve task/window routing state, close/back behavior, and return-to-workspace behavior.
- Wire Diagnostics / Evidence and Codex / Automation skeleton entry points without claiming final full view completion.
- Preserve Authoring Workspace v0 skeleton and central Canvas / Preview.

Allowed write scope:

- `apps/editor/src/app/**`
- `apps/editor/src/ui/app-shell/**`
- narrowly needed `apps/editor/src/ui/**` files touched by B-F integration
- focused integration/unit tests
- focused e2e updates only where integration requires stable opening/selecting behavior
- `discussion/implementation/waves/wave54/**`
- `discussion/implementation/reviews/wave54/**`

Forbidden:

- Full visual redesign
- Reworking unrelated workflows
- Reintroducing PSD Import as default always-visible panel
- Hiding required controls without replacement
- New authoring capability
- External transport

### H. `wave54-focused-regression-responsive-guard-verification`

Purpose:

- Prove task window routing, PSD Import window behavior, skeleton entry points, existing authoring workflows, desktop/mobile smoke, PSD focused paths, and guardrails remain valid.
- Apply only narrow test-hook or focused test fixes if necessary through Gnome + Review-Sylph.

Allowed write scope:

- `apps/editor/e2e/**`
- focused test files assigned by A/G
- `scripts/**` only for narrow guard/test registration fixes
- `discussion/tests/traceability/test-traceability-matrix.md`
- `discussion/tests/fixtures/fixture-manifest.md`
- `discussion/implementation/waves/wave54/**`
- `discussion/implementation/reviews/wave54/**`

Forbidden:

- Product implementation beyond regression hooks
- Weakening focused tests
- Removing focused IDs without replacement
- Broad aggregate e2e expansion
- Lockfile or dependency churn

Required focus:

- Task window opens/closes from Toolbox PSD Import.
- PSD Import remains not default always-visible.
- Desktop/mobile editor smoke/layout paths.
- Existing preview/drawable/save/load/Product Preflight/Viewer/AI smoke paths where existing aggregate e2e covers them.
- `psdStructuralInitialStateFocused`
- `psdImportPlanCodexFocused`
- `psdImportPlanFocused`
- `psdMultiLayerBatchFocused`
- `psdImportFocused`
- production `data-testid` guard and fixture guard.
- source/dependency guards.

### I. `wave54-docs-traceability-screen-design-refresh`

Purpose:

- Update maps, capability map, backlog, screen-design docs, fixture/traceability docs to reflect Wave54 exactly.
- Record Wave54 as complete only if G/H pass.
- Preserve future scope for full visual redesign, final modal/window policy, full Diagnostics / Evidence, full Codex / Automation, Mesh / Atlas / Parameter / Variant UI.

Allowed write scope:

- `discussion/_map.md` if top-level current status needs updating
- `discussion/design/screen-design/**`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/remaining-work-backlog.md`
- `discussion/implementation/_map.md`
- `discussion/implementation/orchestration/_map.md`
- `discussion/tests/fixtures/fixture-manifest.md`
- `discussion/tests/traceability/test-traceability-matrix.md`
- `discussion/implementation/waves/wave54/**`
- `discussion/implementation/reviews/wave54/**`

Forbidden:

- Source implementation
- Unsupported capability claims
- Claiming full screen-design completion
- Claiming Mesh / Atlas / Parameter / Variant progress

### J. `wave54-integration-review-and-final-report`

Purpose:

- Integrate Domains A-I, run final verification, produce clean integration review and final report, and update maps/backlog.

Allowed write scope:

- `discussion/implementation/waves/wave54/**`
- `discussion/implementation/reviews/wave54/**`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/remaining-work-backlog.md`
- `discussion/implementation/_map.md`
- `discussion/implementation/orchestration/_map.md`
- `discussion/_map.md` if final baseline status needs top-level sync
- narrow final bookkeeping in traceability/screen-design docs if required

Forbidden:

- Orch-Sylph自身によるsource code edits。source fixが必要な場合はGnomeに明示委譲し、Review-Sylphで再レビューする。
- Broad documentation rewrite unless Wave54 evidence registration requires it and scope is narrow.

## 11. Subagent / Orch-Sylph Execution Policy

Wave54起動時の実行単位はdomainごとのOrch-Sylphである。

1. UndineはDomain AのOrch-Sylphを単独投入する。
2. Domain Aが`pass`し、B-Fのwrite ownershipが非重複なら、UndineはDomain B / C / D / E / Fを並列投入できる。
3. Domain AがB-Fの5並列を危険と判断した場合、UndineはAの推奨batchに従う。
4. Domain B-Fがすべて`pass`したら、UndineはDomain Gを投入する。
5. Domain Gが`pass`したら、UndineはDomain Hを投入する。
6. Domain Hが`pass`したら、UndineはDomain Iを投入する。
7. Domain Iが`pass`したら、UndineはDomain Jを投入する。
8. 各Orch-Sylphは自分でsource実装せず、domain内でGnome実装とReview-Sylphレビューを別コンテキストに分離する。
9. Review-Sylphはclean contextで、implementation notesではなくbasis docs、target files、diff、testsを根拠にレビューする。
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

- Parallel Boundary: B-F do not integrate into App Shell directly and do not edit overlapping files beyond A-approved scope.
- Task Window Boundary: generic task shell is PSD-independent and does not become full modal/window framework for every view.
- PSD Import Preservation: PSD Import opens from Toolbox as task window and is not restored as an always-visible panel.
- Human UI Boundary: normal authoring UI shows human-relevant summaries and controls, not raw evidence/debug/Codex details as primary content.
- Surface Separation: Diagnostics / Evidence and Codex / Automation skeletons do not claim final full view completion.
- Test ID Boundary: `data-testid` remains test-facing, not production behavior-facing.
- Existing Workflow Preservation: Wave45-Wave53 PSD focused paths remain passing.
- Codex Policy: repo/Editor do not add semantic recognition, proposal generation, auto-rigging, auto-fix, auto-commit, or external transport.
- Test Adequacy: component tests, integration tests, desktop/mobile layout smoke, focused PSD e2e, and guard checks cover the migration.
- Source Organization: `index.ts` files remain barrel-only and source organization guardrails pass.
- Orchestration Compliance: Orch-Sylph did not implement directly; Gnome implementation and Review-Sylph review are separated.

## 13. Verification Plan

Domain minimum verification:

- Domain A: boundary report/review, ownership matrix, focused regression target list, `git diff --check`.
- Domain B: generic task window component tests, source organization check if new files are added.
- Domain C: PSD Import task window content tests and PSD behavior preservation checks.
- Domain D: Diagnostics / Evidence skeleton tests and overclaim scan.
- Domain E: Codex / Automation skeleton tests and Codex policy scan.
- Domain F: selector / test-facing surface checks, guard self-checks if modified, `git diff --check`.
- Domain G: integration tests/e2e proving Toolbox PSD Import opens as task window and closes/returns to workspace.
- Domain H: desktop/mobile e2e, focused PSD e2e, production-testid guard, source/dependency guards.
- Domain I: docs/map/traceability consistency checks and `git diff --check`.
- Domain J: final full verification and clean integration review.

Final verification:

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
- forbidden-scope scan for new Mesh/Atlas feature claims, semantic recognition, suggestion UI, proposal generation, auto classify, auto-fix, automatic commit, Photoshop compositing, renderer/pixel oracle, external transport, Cubism, public demo asset, persisted source PSD bytes/raw parser objects

## 14. Early Escape / User Decision Points

Orch-Sylph must escalate if:

- Workspace-scoped task window cannot be implemented without a broader final modal/window policy decision.
- PSD Import task window requires changing PSD import/scaffold semantics.
- B-F file ownership cannot be made non-overlapping enough for parallel execution.
- App Shell integration requires full visual redesign or moving many unrelated panels.
- Existing focused e2e cannot be preserved without weakening tests.
- The migration requires hiding required controls without replacement.
- The migration requires moving machine-only evidence into primary human UI.
- The implementation requires new Mesh / Atlas / Parameter / Variant UI.
- The implementation requires external HTTP / WebSocket / MCP transport.
- The implementation requires semantic recognition, auto-classification, proposal generation, auto-rigging, or auto-fix.
- The implementation requires renderer/pixel oracle, Photoshop compositing, Cubism compatibility, or public demo assets.

No additional user question is required before starting Wave54 under this plan. If the desired direction changes to full visual design system work, full Diagnostics / Evidence implementation, full Codex / Automation implementation, Mesh generation, Texture Atlas, or Codex external transport, replace this plan before launch.

## 15. Expected Follow-up Sequence

Wave54 creates the task window policy v0 and separated surface skeletons. Follow-up candidates after Wave54:

1. Diagnostics / Evidence View Separation v1: move more operation log, generated evidence, package file set, reload summary, and full diagnostics out of normal authoring UI.
2. Codex / Automation View Separation v1: organize proposal review, approval, transcript, command surface status, and operation availability.
3. PSD Import Task final polish v1: improve the PSD import task content once the task window shell is stable.
4. Texture Atlas Task v0 or Mesh generation/tool v0: add new authoring capability only after task/window and surface boundaries are stable.
5. Parameter Manager / Variant Expression Manager implementation waves after task/window and workspace conventions are stable.

This sequence is a planning expectation, not a binding promise. Each follow-up wave must run its own planning gate.

## 16. Pass Criteria

Wave54 passes when:

- A generic workspace-scoped task window shell exists and is tested.
- Toolbox PSD Import opens PSD Import in the task window.
- PSD Import closes/cancels/commits back to workspace without becoming a default always-visible panel.
- Diagnostics / Evidence View skeleton exists as the separated future home for raw evidence/debug details.
- Codex / Automation View skeleton exists as the separated future home for Codex/AI details.
- Test-facing / selector scope hardening addresses duplicate drawable-list and task-window observation risks without production behavior depending on `data-testid`.
- App Shell integration is centralized and does not force Undine/root into diff integration work.
- Existing stable `data-testid` hooks remain test-facing and production behavior does not query them for behavior-critical state.
- All required PSD focused e2e IDs pass.
- Desktop/mobile e2e smoke passes.
- Production `data-testid` guard and source organization guard pass.
- No Mesh generation, Texture Atlas packing, Parameter Manager implementation, Variant Manager implementation, full visual redesign, final modal/window framework, full Diagnostics / Evidence implementation, full Codex / Automation implementation, semantic recognition, proposal generation, auto-rigging, renderer/pixel oracle, external transport, Cubism compatibility, or public demo asset work is introduced.
- `index.ts` files remain barrel-only and source organization guardrails pass.
- Domain completion reports, Review-Sylph reviews, final integration report, clean review, and map/backlog updates are recorded under `discussion/implementation/`.
