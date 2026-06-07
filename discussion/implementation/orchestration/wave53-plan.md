# Wave 53 Plan: Workspace Layout Migration v0

> Wave53で実装すべきdomain、依存順、Orch-Sylph投入方針を固定する計画。
> このwaveはWave51-Wave52で作ったscreen-design debt foundationとPSD Import Task migrationを前提に、Authoring Workspaceの基本レイアウトを「巨大な1ページ」から作業用の骨格へ移す。

## 1. 状態

- Status: Planned
- Target wave: Wave53
- Wave name: `workspace-layout-migration-v0`
- Primary objective: Authoring Workspaceに、App Bar / Toolbox / Structure・Parts Tree / Canvas・Preview / Inspector / Parameter Bar / Diagnostics Strip の基本実配置を作る。PSD Import TaskはWave52のTask Shell経路を維持し、通常workspaceから開ける。Mesh / Atlas / Parameter Manager / Variant Managerなどの新機能は追加しない。

## 2. Planning Gate Result

Planning Gate result before this plan: `Discuss first` -> `Plan directly`.

Planning basis:

- Wave52 final integration report/review is `pass` and Wave52 is the latest final implementation-proven baseline.
- Wave52 moved PSD Import out of the default always-visible workspace panel and into a Task Shell task reachable from Empty / Authoring Workspace.
- Wave52 did not complete full workspace layout, final Toolbox placement, final modal/task-window/dedicated-view policy, Diagnostics / Evidence final view, Codex / Automation final view, Mesh / Atlas / Parameter / Variant UI, or broad DOM/text oracle migration.
- The next screen-design debt step should establish the normal authoring workspace skeleton before adding another UI-heavy authoring capability.

Accepted user direction:

- Continue UI debt repayment before feature expansion.
- Do not let the user's earlier layout concern become unexamined priority bias; Wave53 is selected because Workspace Layout is a dependency for later UX work.
- Use the screen-design documents as the design basis, but implement a v0 skeleton rather than final visual polish.
- Keep Undine/root context protected. Detailed source inventory, diffs, test log analysis, and integration review must be delegated to domain Orch-Sylphs.

## 3. User Decisions / Design Boundary

Accepted decisions:

- Wave53 should target Workspace Layout Migration v0.
- The v0 default layout may follow the current screen-design ASCII direction:
  - App Bar at top.
  - Left Toolbox.
  - Left Structure / Parts Tree next to Toolbox.
  - Central Canvas / Preview.
  - Right Inspector.
  - Bottom Parameter Bar.
  - Bottom Diagnostics Strip with summary only.
- This is not the final visual design. It is a stable implementation skeleton that later waves can refine.
- PSD Import remains a task opened from the workspace, not a default always-visible panel.

Design basis:

- [discussion/design/screen-design/_map.md](../../design/screen-design/_map.md)
- [discussion/design/screen-design/scope-and-principles.md](../../design/screen-design/scope-and-principles.md)
- [discussion/design/screen-design/overview.md](../../design/screen-design/overview.md)
- [discussion/design/screen-design/screens/authoring-workspace.md](../../design/screen-design/screens/authoring-workspace.md)
- [discussion/design/screen-design/components/toolbox.md](../../design/screen-design/components/toolbox.md)
- [discussion/design/screen-design/components/parts-tree.md](../../design/screen-design/components/parts-tree.md)
- [discussion/design/screen-design/components/drawable-inspector.md](../../design/screen-design/components/drawable-inspector.md)
- [discussion/design/screen-design/components/parameter-keyform.md](../../design/screen-design/components/parameter-keyform.md)
- [discussion/design/screen-design/screens/diagnostics-evidence-view.md](../../design/screen-design/screens/diagnostics-evidence-view.md)
- [discussion/design/screen-design/screens/codex-automation-view.md](../../design/screen-design/screens/codex-automation-view.md)
- [discussion/design/screen-design/screens/psd-import-task.md](../../design/screen-design/screens/psd-import-task.md)

Automation policy basis:

- [discussion/design/codex-friendly-automation-policy.md](../../design/codex-friendly-automation-policy.md)

## 4. Next Wave Selection

Wave53 is selected because the workspace skeleton is a dependency for the next several UX migrations:

- Diagnostics / Evidence separation needs a normal authoring surface from which evidence details can be removed.
- Codex / Automation separation needs a clear non-human-primary surface that does not rely on visible DOM text.
- Mesh Tool, Texture Atlas Task, Parameter Manager, and Variant / Expression Manager need stable launch and placement conventions.
- PSD Import Task final placement/navigation polish needs the normal workspace entry points to exist.

Wave53 deliberately does not finish the entire screen design. It creates the smallest useful authoring layout shell that can absorb later waves.

## 5. Repository Facts From Wave52

Facts treated as planning basis:

- Generic Task Shell / Task Chrome exists from Wave52.
- PSD Import Task Human UI exists from Wave52.
- PSD Import can be opened from Empty / Authoring Workspace through Task Shell.
- PSD Import is no longer a default always-visible workspace panel.
- Wave51-Wave52 structured observation / `data-testid` boundary work is active and must not be regressed.
- Existing focused PSD e2e IDs passed under Wave52 final verification.
- `check:testids` is included in standard `check`.
- `check:testids:fixtures` exists but remains outside standard `check`.

## 6. Design Decisions

- Wave53 implements the workspace skeleton, not final visual polish.
- The Toolbox is implemented as a workspace launcher surface, not as the work UI itself.
- Parts Tree is implemented or migrated as the structure/list/selection home, not as a debug/evidence dump.
- Canvas / Preview remains the central visual/semantic preview area. Wave53 does not add a full renderer or pixel oracle.
- Inspector is the right-side contextual area for selected project/part/drawable/tool summary. It must not become a raw evidence surface.
- Parameter Bar is the bottom cross-cutting current-parameter surface. It must remain a v0 shell if full parameter operation would require a separate wave.
- Diagnostics Strip is a summary-only bottom strip. Full operation logs, generated refs, evidence paths, package file sets, and raw diagnostics belong to future Diagnostics / Evidence View work.
- Codex / Automation details are not moved into normal human UI. If Wave53 needs an entry point, it should be a placeholder or launcher only.
- PSD Import Task remains reachable and must not be reintroduced as a default always-visible panel.
- Existing human-equivalent operation behavior and Codex-facing deterministic surfaces must remain intact.

## 7. Non-Goals

- Mesh generation, mesh preset UI, mesh preview overlay, batch mesh generation, triangulation, retopology, or automatic mesh editing.
- Texture Atlas packing, atlas preview, UV unwrap, texture sampling correctness, renderer/pixel oracle, or Photoshop compositing.
- Parameter Manager implementation, Variant / Expression Manager implementation, Viewer / Runtime redesign, Product Preflight redesign, Diagnostics / Evidence View final UI, or Codex / Automation View final UI.
- Final modal/window framework or final dedicated-view policy.
- Full app-wide visual redesign, final design system, CSS framework migration, or new UI framework adoption.
- Moving every existing panel or deleting every legacy UI block in one wave.
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

Domain basis as needed:

- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/diagnostic-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`
- `discussion/tests/traceability/test-traceability-matrix.md`
- `discussion/tests/fixtures/fixture-manifest.md`
- `discussion/design/screen-design/components/drawable-inspector.md`
- `discussion/design/screen-design/components/parameter-keyform.md`
- `discussion/design/screen-design/screens/diagnostics-evidence-view.md`
- `discussion/design/screen-design/screens/codex-automation-view.md`
- `discussion/design/screen-design/screens/psd-import-task.md`
- Wave51-Wave52 screen-design reports and reviews where UI boundary details are needed
- Wave42 focused e2e registry and source guard reports where quality gate changes are needed

UndineはEditor source、e2e全体、command host source全文を自分で読み込まない。詳細source、diff、test evidenceはOrch-Sylphがdomain必要分だけ読み、Gnome / Review-Sylphへ狭く渡す。

## 9. Dependency / Parallel Design

Wave53 uses a boundary gate, then 2 parallel component-surface domains, then centralized workspace integration.

| Batch | Domain | Parallelism | Dependency | Purpose |
|---|---|---|---|---|
| 1 | A. Workspace layout boundary / current host inventory | Solo first | Wave52 final pass + screen-design docs | Existing workspace host, legacy visible panels, file ownership, test oracle risks, and B/C/D boundariesを固定する |
| 2 | B. Toolbox / Parts Tree surface migration | Parallel with C | A | Left-side launch and structure surfacesを作る。Toolboxはlauncher、Parts Treeはstructure/list/selection homeにする |
| 2 | C. Inspector / Parameter Bar / Diagnostics Strip surface migration | Parallel with B | A | Right/bottom contextual surfacesを作る。human summaryとevidence/debug detailを分離する |
| 3 | D. Authoring Workspace shell integration / canvas center | Solo after B/C | B + C | App Shellに基本workspace layoutを統合し、Canvas / Preview中心とPSD Import task entryを保つ |
| 4 | E. Focused regression / responsive and guard verification | Solo after D | D | existing workflows、PSD task opening、desktop/mobile layout smoke、production-testid/source guardsを確認する |
| 5 | F. Documentation / traceability refresh | Solo after E | E | screen-design implementation status、capability map、backlog、traceabilityをWave53範囲へ同期する |
| 6 | G. Integration review and final report | Solo after F | F | final verification、clean integration review、final report、map/backlog更新を行う |

Safety constraints:

- A owns boundary and must not implement source.
- B/C may run in parallel only after A defines non-overlapping write scopes.
- B owns left-side launch/structure surfaces, not final App Shell integration.
- C owns right/bottom contextual surfaces, not final App Shell integration.
- D owns layout integration and must resolve B/C outputs without pushing source diff integration into Undine.
- E owns regression and guard verification, not product scope expansion.
- F owns docs/maps/traceability only.
- G owns final review/report and must return `needs_fix` if source changes are required.

## 10. Domain Assignments

### A. `wave53-workspace-layout-boundary-current-host-inventory`

Purpose:

- Confirm exact current workspace host and layout entry points.
- Identify which existing panels are normal human authoring UI, which are debug/evidence, and which must remain reachable but not primary.
- Define file ownership for B/C/D so parallel work does not collide.
- Confirm test oracle risks for DOM/text changes.
- Confirm the minimal acceptable v0 responsive behavior.

Allowed write scope:

- `discussion/implementation/waves/wave53/**`
- `discussion/implementation/reviews/wave53/**`
- narrow notes in `discussion/design/screen-design/**` only if implementation-readiness status needs updating

Forbidden:

- Source implementation
- Broad source/test/e2e inventory beyond the bounded workspace-host question
- Product priority changes
- New authoring capability
- Final visual redesign

Expected output:

- Domain A report with verdict `pass`, `needs_fix`, `escalate`, or `blocked`.
- B/C/D file ownership matrix.
- Human UI vs evidence/debug/Codex/test-facing classification risks.
- Focused regression target list.
- User-decision points, if any.

### B. `wave53-toolbox-parts-tree-surface-migration`

Purpose:

- Implement or migrate the left-side workspace surfaces:
  - Toolbox launcher surface.
  - Structure / Parts Tree surface.
- Preserve selection and existing structure operations.
- Keep Toolbox as launcher only; concrete tool controls belong in Inspector / task / view surfaces.
- Keep Parts Tree as part/drawable hierarchy, draw order, selection, and row-state home.

Allowed write scope:

- `apps/editor/src/ui/app-shell/**` only for left-surface components if A assigns ownership here
- `apps/editor/src/ui/**` narrowly named Toolbox / Parts Tree files if A assigns ownership here
- focused component/unit tests
- `discussion/implementation/waves/wave53/**`
- `discussion/implementation/reviews/wave53/**`

Forbidden:

- Final App Shell integration
- Inspector / Parameter Bar / Diagnostics Strip implementation
- PSD Import workflow changes
- Reintroducing machine-only evidence into primary human UI
- Adding UI framework dependencies unless escalated and explicitly accepted
- Mesh / Atlas / Parameter / Variant capability

### C. `wave53-inspector-parameter-diagnostics-surface-migration`

Purpose:

- Implement or migrate the right/bottom workspace surfaces:
  - Inspector shell / contextual summary surface.
  - Parameter Bar v0.
  - Diagnostics Strip summary-only surface.
- Preserve existing controls that remain necessary for current workflows.
- Move or mark raw evidence/debug details as non-primary where feasible without breaking tests.

Allowed write scope:

- `apps/editor/src/ui/app-shell/**` only for right/bottom surface components if A assigns ownership here
- `apps/editor/src/ui/**` narrowly named Inspector / Parameter Bar / Diagnostics Strip files if A assigns ownership here
- focused component/unit tests
- `discussion/implementation/waves/wave53/**`
- `discussion/implementation/reviews/wave53/**`

Forbidden:

- Final App Shell integration
- Toolbox / Parts Tree implementation
- Full Diagnostics / Evidence View implementation
- Full Codex / Automation View implementation
- Full Parameter Manager implementation
- Removing required controls without replacement
- Broad DOM/text oracle migration
- Mesh / Atlas / Parameter / Variant capability

### D. `wave53-authoring-workspace-shell-integration-canvas-center`

Purpose:

- Integrate B/C surfaces into the Authoring Workspace shell.
- Keep Canvas / Preview as the central area.
- Keep PSD Import Task reachable through the workspace without making it a default always-visible panel again.
- Preserve Empty Workspace entries for PSD Import, Project Storage, and Tutorial where currently supported.
- Ensure layout is stable enough for desktop and mobile smoke without claiming final visual design.

Allowed write scope:

- `apps/editor/src/app/**`
- `apps/editor/src/ui/app-shell/**`
- narrowly needed `apps/editor/src/ui/**` files touched by B/C integration
- focused integration/unit tests
- focused e2e updates only where layout migration requires stable opening/selecting behavior
- `discussion/implementation/waves/wave53/**`
- `discussion/implementation/reviews/wave53/**`

Forbidden:

- Full workspace visual redesign beyond the v0 layout skeleton
- Reworking unrelated workflows
- Final modal/window framework
- Removing PSD Import Task Shell path
- Reintroducing PSD Import as default always-visible panel
- New authoring capability

### E. `wave53-focused-regression-responsive-guard-verification`

Purpose:

- Prove the workspace layout migration did not regress existing core authoring and PSD task paths.
- Verify desktop/mobile layout smoke for the v0 skeleton.
- Run production `data-testid` guard and source/dependency guards.
- Confirm visible human UI no longer depends on machine-only evidence as primary workspace content where Wave53 touched surfaces.

Allowed write scope:

- `apps/editor/e2e/**`
- focused test files assigned by A/D
- `scripts/**` only for narrow guard/test registration fixes
- `discussion/tests/traceability/test-traceability-matrix.md`
- `discussion/tests/fixtures/fixture-manifest.md`
- `discussion/implementation/waves/wave53/**`
- `discussion/implementation/reviews/wave53/**`

Forbidden:

- Product implementation beyond regression hooks
- Weakening focused tests
- Removing focused IDs without replacement
- Broad aggregate e2e expansion
- Lockfile or dependency churn

Required focus:

- Existing editor smoke / preview / save-load paths selected by A/D.
- PSD task opening after Wave52.
- `psdStructuralInitialStateFocused`
- `psdImportPlanCodexFocused`
- `psdImportPlanFocused`
- `psdMultiLayerBatchFocused`
- `psdImportFocused`
- production `data-testid` guard.
- source organization guard.

### F. `wave53-docs-traceability-screen-design-refresh`

Purpose:

- Update implementation maps, capability map, backlog, and screen-design implementation status to reflect Wave53 exactly.
- Record Workspace Layout Migration v0 as done only if D/E pass.
- Keep Diagnostics / Evidence final view, Codex / Automation final view, Mesh / Atlas / Parameter / Variant UI as future unless actually implemented and reviewed in this wave.

Allowed write scope:

- `discussion/_map.md` if top-level current status needs updating
- `discussion/design/screen-design/**`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/remaining-work-backlog.md`
- `discussion/implementation/_map.md`
- `discussion/implementation/orchestration/_map.md`
- `discussion/tests/fixtures/fixture-manifest.md`
- `discussion/tests/traceability/test-traceability-matrix.md`
- `discussion/implementation/waves/wave53/**`
- `discussion/implementation/reviews/wave53/**`

Forbidden:

- Source implementation
- Unsupported capability claims
- Claiming full screen-design completion
- Claiming Diagnostics / Evidence final view, Codex / Automation final view, or Mesh / Atlas / Parameter / Variant progress unless those are actually implemented by earlier domains

### G. `wave53-integration-review-and-final-report`

Purpose:

- Integrate Domains A-F, run final verification, produce clean integration review and final report, and update maps/backlog.

Allowed write scope:

- `discussion/implementation/waves/wave53/**`
- `discussion/implementation/reviews/wave53/**`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/remaining-work-backlog.md`
- `discussion/implementation/_map.md`
- `discussion/implementation/orchestration/_map.md`
- `discussion/_map.md` if final baseline status needs top-level sync
- narrow final bookkeeping in traceability/screen-design docs if required

Forbidden:

- Orch-Sylph自身によるsource code edits。source fixが必要な場合はGnomeに明示委譲し、Review-Sylphで再レビューする。
- Broad documentation rewrite unless Wave53 evidence registration requires it and scope is narrow.

## 11. Subagent / Orch-Sylph Execution Policy

Wave53起動時の実行単位はdomainごとのOrch-Sylphである。

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

- Layout Boundary: Wave53 implements v0 workspace skeleton, not final visual design or broad redesign.
- Parallel Boundary: B/C do not integrate into App Shell directly and do not edit overlapping files beyond A-approved scope.
- Human UI Boundary: normal authoring UI shows human-relevant summaries and controls, not raw evidence/debug details as primary content.
- PSD Task Preservation: PSD Import remains a Task Shell task and is not reintroduced as a default always-visible panel.
- Test ID Boundary: `data-testid` remains test-facing, not production behavior-facing.
- Existing Workflow Preservation: Wave45-Wave52 PSD focused paths remain passing.
- Codex Policy: repo/Editor do not add semantic recognition, proposal generation, auto-rigging, auto-fix, or auto-commit.
- Test Adequacy: component tests, integration tests, desktop/mobile layout smoke, focused PSD e2e, and guard checks cover the migration.
- Source Organization: `index.ts` files remain barrel-only and source organization guardrails pass.
- Orchestration Compliance: Orch-Sylph did not implement directly; Gnome implementation and Review-Sylph review are separated.

## 13. Verification Plan

Domain minimum verification:

- Domain A: boundary report/review, ownership matrix, focused regression target list, `git diff --check`.
- Domain B: Toolbox / Parts Tree component tests, source organization check if new files are added.
- Domain C: Inspector / Parameter Bar / Diagnostics Strip component tests and static/human UI boundary review.
- Domain D: workspace integration tests/e2e proving layout skeleton loads and PSD Import remains task-openable.
- Domain E: desktop/mobile layout smoke, focused PSD e2e, production-testid guard, source/dependency guards.
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
- `pnpm run check`
- `git diff --check -- apps packages scripts fixtures test_data generated discussion discussion/implementation discussion/development_convention discussion/tests`
- forbidden-scope scan for new Mesh/Atlas feature claims, semantic recognition, suggestion UI, proposal generation, auto classify, auto-fix, automatic commit, Photoshop compositing, renderer/pixel oracle, external transport, Cubism, public demo asset, persisted source PSD bytes/raw parser objects

## 14. Early Escape / User Decision Points

Orch-Sylph must escalate if:

- Workspace layout cannot be implemented without deciding a final modal/task-window/dedicated-view policy.
- Toolbox left placement or Parts Tree left placement proves incompatible with current product direction or existing workflows.
- B/C component contracts conflict or require overlapping edits that cannot be merged cleanly.
- App Shell integration requires full visual redesign or moving many unrelated panels.
- Existing focused e2e cannot be preserved without weakening tests.
- The migration requires hiding required controls without replacement.
- The migration requires moving machine-only evidence into primary human UI.
- The migration requires new Mesh / Atlas / Parameter / Variant UI.
- The implementation requires external HTTP / WebSocket / MCP transport.
- The implementation requires semantic recognition, auto-classification, proposal generation, auto-rigging, or auto-fix.
- The implementation requires renderer/pixel oracle, Photoshop compositing, Cubism compatibility, or public demo assets.

No additional user question is required before starting Wave53 under this plan. If the desired direction changes to full visual design system work, Diagnostics / Evidence final UI, Codex / Automation final UI, Mesh generation, Texture Atlas, or Codex external transport, replace this plan before launch.

## 15. Expected Follow-up Sequence

Wave53 creates the normal authoring workspace skeleton. Follow-up candidates after Wave53:

1. Diagnostics / Evidence View Separation v0: move operation log, generated evidence, package file set, reload summary, and full diagnostics out of normal authoring UI.
2. Codex / Automation View Separation v0: organize proposal review, approval, transcript, command surface status, and operation availability.
3. PSD Import Task final placement/navigation polish: decide and refine final task/window/dedicated-view behavior if Wave53 v0 leaves it provisional.
4. Texture Atlas Task v0 or Mesh generation/tool v0: add new authoring capability only after UI home and surface boundaries are stable.
5. Parameter Manager / Variant Expression Manager implementation waves after workspace and task/view conventions are stable.

This sequence is a planning expectation, not a binding promise. Each follow-up wave must run its own planning gate.

## 16. Pass Criteria

Wave53 passes when:

- Authoring Workspace has a v0 implementation of App Bar / Toolbox / Structure・Parts Tree / Canvas・Preview / Inspector / Parameter Bar / Diagnostics Strip.
- Toolbox is a launcher surface and does not become the work UI itself.
- Parts Tree is the structure/list/selection home for current part/drawable workflows that Wave53 touches.
- Canvas / Preview remains central and current preview/smoke paths continue to work.
- Inspector / Parameter Bar / Diagnostics Strip show human-relevant summary/control surfaces without turning raw evidence/debug details into primary workspace content.
- PSD Import remains reachable as a Task Shell task from Empty / Authoring Workspace.
- PSD Import is not reintroduced as a default always-visible workspace panel.
- Existing stable `data-testid` hooks remain test-facing and production behavior does not query them for behavior-critical state.
- All required PSD focused e2e IDs pass.
- Production `data-testid` guard and source organization guard pass.
- No Mesh generation, Texture Atlas packing, Parameter Manager implementation, Variant Manager implementation, full visual redesign, final modal/window framework, Diagnostics / Evidence final view, Codex / Automation final view, semantic recognition, proposal generation, auto-rigging, renderer/pixel oracle, external transport, Cubism compatibility, or public demo asset work is introduced.
- `index.ts` files remain barrel-only and source organization guardrails pass.
- Domain completion reports, Review-Sylph reviews, final integration report, clean review, and map/backlog updates are recorded under `discussion/implementation/`.
