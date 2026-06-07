# Wave 51 Plan: UI Surface Protection / Task Shell Foundation v0

> Wave51で実装すべきdomain、依存順、Orch-Sylph投入方針を固定する計画。
> このwaveは新しいauthoring機能を増やすためのwaveではなく、`discussion/design/screen-design/` で整理した画面設計を安全に実装していくための最初の負債解消waveである。

## 1. 状態

- Status: Planned
- Target wave: Wave51
- Wave name: `ui-surface-protection-task-shell-foundation-v0`
- Primary objective: 現行Editorの巨大1ページUIに新機能を積み増す前に、Human UI / Codex-facing surface / test-facing surface / Evidence surface の境界を実装上も守れる状態にする。特に、production code が `data-testid` や可視DOM構造に依存している箇所を解消し、今後PSD Import Task、Texture Atlas Task、Parameter Manager、Viewer、Diagnostics / Evidence View などを段階的に移動・分離できるTask/View Shellの最小基盤を作る。

## 2. Planning Gate Result

Planning Gate result before this plan: `Inventory first` -> `Discuss first` -> `Plan directly`.

Delegated inventory found:

- Wave50 is recorded as final `pass` and can be treated as the latest implementation-proven baseline for explicit deterministic PSD structural initial state.
- Post-Wave50 user-scenario gap candidates include Mesh generation/tool v0, Texture Atlas task v0, Codex-facing structural parity, UI/task-shell layout separation, and validation/evidence separation.
- Mesh generation/tool v0 would be natural after Wave50 only if it does not add new UI debt. A UI-including Mesh wave would likely expand the current one-page UI debt.
- UI layout cleanup is not safe as a pure visual refactor yet because PSD import-plan / structural scaffold production code currently uses `data-testid` selectors and local DOM structure for behavior.
- Therefore the first screen-design implementation wave should protect surfaces and introduce task/view shell foundations before adding new UI-heavy authoring capability.

Accepted user direction:

- 当面は画面設計負債の解消を優先する。
- `discussion/design/screen-design/` の設計を一連のwaveで実装していく。
- ここで実装計画が `logic-only new feature` に寄りすぎることは避ける。
- Mesh / Atlas などの新機能は、置き場所とsurface境界が整ってから扱う。

## 3. User Decisions / Design Boundary

Accepted decisions:

- 現行UIは巨大1ページ化しており、ここへ新機能UIを追加し続けることは負債を拡大する。
- 次waveは機能追加ではなく、UI負債の解消を優先する。
- Human UI、Codex-facing surface、test-facing surface、Evidence surfaceを分離する方針を実装上も守る必要がある。
- `data-testid` はtest-facing観測用であり、production behaviorの依存先にしてはいけない。
- Codex-friendlyであることは重要だが、人間UIを後回しにしてoperation-only機能追加へ寄りすぎることも避ける。

Design basis:

- [discussion/design/screen-design/scope-and-principles.md](../../design/screen-design/scope-and-principles.md)
- [discussion/design/screen-design/overview.md](../../design/screen-design/overview.md)
- [discussion/design/screen-design/inventories/feature-inventory-and-classification.md](../../design/screen-design/inventories/feature-inventory-and-classification.md)
- [discussion/design/screen-design/inventories/codex-test-evidence-dependency.md](../../design/screen-design/inventories/codex-test-evidence-dependency.md)
- [discussion/design/screen-design/screens/psd-import-task.md](../../design/screen-design/screens/psd-import-task.md)
- [discussion/design/screen-design/screens/diagnostics-evidence-view.md](../../design/screen-design/screens/diagnostics-evidence-view.md)
- [discussion/design/screen-design/screens/codex-automation-view.md](../../design/screen-design/screens/codex-automation-view.md)

Automation policy basis:

- [discussion/design/codex-friendly-automation-policy.md](../../design/codex-friendly-automation-policy.md)

## 4. Next Wave Selection

Wave50 created a useful editing starting point from PSD structure: groups become part containers, leaves become texture/drawable/empty mesh scaffolds, and hidden leaves become runtime-hidden drawables.

The natural product temptation after Wave50 is Mesh generation/tool v0. However, if Mesh generation adds preset UI, preview UI, inspector coupling, and e2e assertions onto the current one-page workspace, it worsens the UI debt that screen design has just exposed.

Therefore Wave51 intentionally does not add Mesh generation, Texture Atlas, Parameter Manager implementation, Variant Manager implementation, or new authoring capability. It prepares the UI architecture and surface boundaries so those future waves can be implemented in the right place.

Reasoning:

- Current UI debt is a product blocker, not just cosmetic debt.
- Existing e2e and evidence patterns rely heavily on visible DOM text and `data-testid`.
- At least the PSD import-plan / structural scaffold area has production behavior coupled to `data-testid` selectors.
- Future screen-design waves require the ability to move panels into task/view shells without breaking production behavior.
- New UI-heavy functionality should not be built on a known-bad one-page structure.

## 5. Repository Facts From Planning Inventory

Facts treated as planning basis:

- Wave50 final integration report and clean final review record `pass`.
- Wave50 does not add initial grid mesh generation, texture atlas packing, Photoshop compositing, renderer/pixel oracle, external transport, public demo assets, or Cubism compatibility.
- PSD structural refs are readable through `getPsdImportPlanState`.
- Structural-specific Codex execute/stale command parity is not fully proven; stale rejection remains proven through existing `psdImportPlanCodexFocused`.
- Current screen design docs define the desired separation of Human UI, Codex-facing surface, test-facing surface, and Evidence surface.
- The PSD Import Task design explicitly says Human UI should not show operation IDs, approval digests, generated refs, raw parser payloads, evidence paths, command payloads, or test selector strings as primary UI.
- Current UI/test/evidence inventory records broad e2e dependence on `data-testid`, visible text, `dt/dd`, form disabled/value state, SVG/data attrs, and evidence text.
- Narrow source check found that PSD import-plan / structural scaffold production code uses `data-testid` selectors and local DOM parent structure for approved refs and submit state synchronization.

## 6. Design Decisions

- Wave51 is a foundation/debt wave, not a visual redesign wave.
- The first protected surface is PSD Import / structural scaffold because it is a known production coupling risk and central to the Wave44-Wave50 PSD path.
- `data-testid` may remain stable for tests, but production logic must not query behavior-critical elements through test IDs.
- Where production behavior needs element coordination, use explicit local references, state objects, or component-local wiring rather than global DOM queries by test ID.
- Task/View Shell work must be minimal and enabling: it should create a safe host/registry/state boundary for future task/view migrations without attempting to redesign every panel.
- Human UI remains allowed to show concise status and summaries, but detailed evidence/debug/machine refs should be routed toward Diagnostics / Evidence or structured surfaces.
- Existing focused e2e IDs must continue to pass. Where tests still read visible DOM text, this wave should preserve compatibility unless the domain explicitly replaces the oracle with a stable structured surface.
- Any new structured test-facing surface must be documented and intentionally scoped; it must not become a second hidden product UI.

## 7. Non-Goals

- Mesh generation, mesh preset UI, mesh preview overlay, batch mesh generation, alpha-bound mesh fitting, triangulation, retopology, or automatic mesh editing.
- Texture Atlas packing, atlas preview, UV unwrap, texture sampling correctness, renderer/pixel oracle, or Photoshop compositing.
- New Parameter Manager, Variant / Expression Manager, Viewer / Runtime redesign, Product Preflight redesign, or Codex / Automation redesign.
- Full app-wide visual redesign, final CSS/design-system polish, icon set completion, modal/window framework completion, or complete panel migration.
- Removing all e2e visible-text or DOM oracles in one wave.
- Removing all debug/evidence text from the UI in one wave.
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

Domain basis as needed:

- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/diagnostic-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`
- `discussion/tests/traceability/test-traceability-matrix.md`
- `discussion/tests/fixtures/fixture-manifest.md`
- Wave45-Wave50 PSD import/scaffold reports and reviews where PSD surface details are needed
- Wave39-Wave41 Product Preflight / Codex-facing reports and reviews where evidence or command surface details are needed
- Wave42 focused e2e registry and source guard reports where quality gate changes are needed

UndineはEditor source、e2e全体、command host source全文を自分で読み込まない。詳細source、diff、test evidenceはOrch-Sylphがdomain必要分だけ読み、Gnome / Review-Sylphへ狭く渡す。

## 9. Dependency / Parallel Design

Wave51はまず既存couplingとfirst migration boundaryを固定する。その後、production `data-testid` coupling除去、Task/View Shell foundation、test/evidence surface準備を進める。

| Batch | Domain | Parallelism | Dependency | Purpose |
|---|---|---|---|---|
| 1 | A. Boundary / coupling target inventory | Solo first | Wave50 final pass + screen-design docs | Wave51で外すproduction coupling、触るUI範囲、残すtest oracle、作らない新機能を固定する |
| 2 | B. PSD Import production coupling removal | Solo | A | import-plan / structural scaffoldのproduction `data-testid` dependencyを明示参照または状態モデルへ置き換える |
| 3 | C. Task/View Shell foundation | Solo after B | A + B | App Shellに将来のtask/view分離を受ける最小host/state/registryを追加し、既存表示を大きく崩さず移行可能性を作る |
| 4 | D. Test-facing / evidence surface preparation | Parallel after B/C if file scopes do not overlap | B + C | UI移動に耐える最小structured status/snapshotとevidence boundaryを追加または整理する |
| 5 | E. Focused regression / guardrails | Solo after B/C/D | B + C + D | PSD import/scaffold focused regressions、production `data-testid` coupling guard、existing e2e preservationを確認する |
| 6 | F. Documentation / traceability refresh | Solo after E | E | screen-design implementation status、capability map、backlog、traceabilityをWave51範囲へ同期する |
| 7 | G. Integration review and final report | Solo after F | F | final verification、clean integration review、final report、map/backlog更新を行う |

Safety constraints:

- A owns boundary and must not implement source.
- B owns PSD Import production behavior decoupling and must not redesign the whole PSD Import Task.
- C owns shell foundation and must not migrate all panels or introduce large visual redesign.
- D owns test/evidence surface preparation and must not hide required human status without replacement.
- E owns tests/guards and must not implement product fixes beyond narrowly delegated regression hooks.
- F owns docs/maps/traceability only.
- G owns final review/report and must return `needs_fix` if source changes are required.

## 10. Domain Assignments

### A. `wave51-boundary-coupling-target-inventory`

Purpose:

- Confirm the exact Wave51 debt boundary.
- Identify production `data-testid` coupling that must be removed in this wave.
- Identify test/evidence DOM oracle areas to preserve, defer, or protect through structured surface.
- Confirm minimal Task/View Shell target shape.
- Define exact non-goals for Mesh / Atlas / Parameter / Variant / full layout work.

Allowed write scope:

- `discussion/implementation/waves/wave51/**`
- `discussion/implementation/reviews/wave51/**`
- narrow notes in `discussion/design/screen-design/**` only if the screen-design basis needs a factual implementation-readiness note

Forbidden:

- Source implementation
- Full source inventory beyond bounded target files
- Product priority changes
- New authoring capability
- User-facing layout redesign

Expected output:

- Domain A report with verdict `pass`, `needs_fix`, `escalate`, or `blocked`.
- Exact list of production coupling targets for B.
- Exact minimal shell target for C.
- Exact test/evidence preparation targets for D/E.

### B. `wave51-psd-import-production-coupling-removal`

Purpose:

- Remove production behavior dependency on `data-testid` selectors in PSD import-plan / structural scaffold flows.
- Preserve existing `data-testid` values as test-facing observation hooks where needed.
- Replace behavior-critical DOM selector wiring with explicit element references, local state objects, or component-local binding.
- Preserve existing import-plan, structural scaffold, stale/approved refs, submit disabled, and focused e2e behavior.

Allowed write scope:

- `apps/editor/src/ui/explicit-psd-import/**`
- `apps/editor/src/ui/explicit-psd-import/explicit-psd-import-panel.ts`
- narrow editor workflow files only if direct state plumbing requires it
- focused unit/e2e tests for PSD Import if needed
- `discussion/implementation/waves/wave51/**`
- `discussion/implementation/reviews/wave51/**`

Forbidden:

- Redesigning PSD Import Task layout
- Changing PSD import semantics
- Adding structural-specific Codex execute/stale commands unless explicitly required by the coupling fix and escalated
- Removing `data-testid` values that focused e2e still depends on
- Adding Mesh / Atlas / new authoring capability
- Broad rewrite of explicit PSD import panel unrelated to coupling removal

Review emphasis:

- `data-testid` remains test-facing, not production behavior-facing.
- Existing Wave45-Wave50 PSD focused paths still work.
- Structural scaffold Human UI / Codex / test / evidence boundary remains truthful.

### C. `wave51-task-view-shell-foundation`

Purpose:

- Introduce the minimal app-level Task/View Shell foundation needed to implement screen-design docs over later waves.
- Represent authoring workspace, task views, and diagnostic/automation views as explicit shell concepts in code.
- Keep current visible layout mostly intact unless a small move is necessary to prove the shell.
- Avoid adding new tools or new authoring capability.

Allowed write scope:

- `apps/editor/src/app/**`
- `apps/editor/src/ui/app-shell/**`
- new narrowly named shell/task/view files under `apps/editor/src/ui/**` if needed
- `apps/editor/src/editor-state/**` only for shell state/test-facing state if required
- focused shell tests/e2e if needed
- `discussion/implementation/waves/wave51/**`
- `discussion/implementation/reviews/wave51/**`

Forbidden:

- Full workspace visual redesign
- Moving every existing panel
- Final modal/window framework
- Introducing lucide or another UI dependency unless separately justified and approved
- Mesh / Atlas / Parameter / Variant feature implementation
- Hiding existing required controls without replacement
- Changing package/runtime/operation semantics

Review emphasis:

- Shell is enabling infrastructure, not a half-finished redesign.
- Current user workflows remain reachable.
- Future task migrations can target named shell surfaces instead of appending more panels to the one-page workspace.

### D. `wave51-test-evidence-surface-preparation`

Purpose:

- Add or refine the minimal structured state / status / evidence observation surface needed to move UI later without breaking tests and Codex-facing expectations.
- Separate human-readable summaries from evidence/debug details where a safe local boundary exists.
- Keep e2e compatibility where full migration is too broad.

Allowed write scope:

- `apps/editor/src/editor-state/**`
- `apps/editor/src/ai-command-host/**` only for read-only/status projection if required
- `apps/editor/src/ui/evidence-panel/**`
- `apps/editor/src/ui/product-preflight/**` only if targeted surface preparation is required
- `apps/editor/e2e/**` only for focused oracle updates
- `packages/ai-interface/src/**` only if a narrow read schema is required and coordinated
- `discussion/implementation/waves/wave51/**`
- `discussion/implementation/reviews/wave51/**`

Forbidden:

- Full Product Preflight redesign
- Full Diagnostics / Evidence View implementation
- External transport
- Repo-side proposal generation or repair generation
- Removing evidence visibility needed by existing tests without a stable replacement
- Broad ai-interface schema churn

Review emphasis:

- Structured surface is intentionally scoped and documented.
- Human UI does not become responsible for machine-only refs.
- Tests that remain DOM-based do so intentionally and are recorded as deferred debt.

### E. `wave51-focused-regression-and-guardrails`

Purpose:

- Prove Wave51 did not regress the Wave45-Wave50 PSD path.
- Add a guard or focused check preventing future production behavior from depending on `data-testid` selectors in app source, with explicit allowlist if unavoidable.
- Preserve focused e2e registry expectations.

Allowed write scope:

- `apps/editor/e2e/**`
- `scripts/**`
- focused unit/integration test files under `apps/editor/src/**` if needed
- `discussion/tests/traceability/test-traceability-matrix.md`
- `discussion/tests/fixtures/fixture-manifest.md`
- `discussion/implementation/waves/wave51/**`
- `discussion/implementation/reviews/wave51/**`

Forbidden:

- Product implementation beyond regression hooks
- Broad aggregate e2e expansion
- Hiding broken behavior by weakening focused tests
- Removing existing focused IDs without replacement

Required focus:

- `psdStructuralInitialStateFocused`
- `psdImportPlanCodexFocused`
- `psdImportPlanFocused`
- `psdMultiLayerBatchFocused`
- `psdImportFocused`
- new or updated guard for production `data-testid` behavior dependency

### F. `wave51-docs-traceability-screen-design-refresh`

Purpose:

- Update implementation maps, capability map, backlog, and screen-design implementation status to reflect Wave51 exactly.
- Record that Wave51 starts screen-design implementation debt work but does not complete the full visual redesign.
- Record remaining screen-design implementation waves as future work.

Allowed write scope:

- `discussion/_map.md` if top-level current status needs updating
- `discussion/design/screen-design/**`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/remaining-work-backlog.md`
- `discussion/implementation/_map.md`
- `discussion/implementation/orchestration/_map.md`
- `discussion/tests/fixtures/fixture-manifest.md`
- `discussion/tests/traceability/test-traceability-matrix.md`
- `discussion/implementation/waves/wave51/**`
- `discussion/implementation/reviews/wave51/**`

Forbidden:

- Source implementation
- Unsupported capability claims
- Rewriting screen-design docs beyond the actual Wave51 implementation status
- Claiming Mesh / Atlas / Parameter / Variant UI progress

### G. `wave51-integration-review-and-final-report`

Purpose:

- Integrate Domains A-F, run final verification, produce clean integration review and final report, and update maps/backlog.

Allowed write scope:

- `discussion/implementation/waves/wave51/**`
- `discussion/implementation/reviews/wave51/**`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/remaining-work-backlog.md`
- `discussion/implementation/_map.md`
- `discussion/implementation/orchestration/_map.md`
- `discussion/_map.md` if final baseline status needs top-level sync
- narrow final bookkeeping in traceability/screen-design docs if required

Forbidden:

- Orch-Sylph自身によるsource code edits。source fixが必要な場合はGnomeに明示委譲し、Review-Sylphで再レビューする。
- Broad documentation rewrite unless Wave51 evidence registration requires it and scope is narrow.

## 11. Subagent / Orch-Sylph Execution Policy

Wave51起動時の実行単位はdomainごとのOrch-Sylphである。

1. UndineはDomain AのOrch-Sylphを単独投入する。
2. Domain Aが`pass`したら、UndineはDomain Bを投入する。
3. Domain Bが`pass`したら、UndineはDomain Cを投入する。
4. Domain Cが`pass`したら、UndineはDomain Dを投入できる。
5. Domain Dが`pass`したら、UndineはDomain Eを投入する。
6. Domain Eが`pass`したら、UndineはDomain Fを投入する。
7. Domain Fが`pass`したら、UndineはDomain Gを投入する。
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

- Surface Boundary: Human UI / Codex-facing / test-facing / Evidence surface の分離を悪化させていない。
- Test ID Boundary: `data-testid` はtest-facing observationであり、production behavior dependencyになっていない。
- Existing Workflow Preservation: Wave45-Wave50 PSD import/scaffold focused pathsが壊れていない。
- Shell Scope: Task/View Shell foundationは最小基盤に留まり、全面visual redesignや全panel migrationをしていない。
- Evidence Truthfulness: machine-only refs、operation IDs、digests、evidence pathsを人間向けprimary UIへ押し戻していない。
- Codex Policy: repo/Editor側でsemantic recognition、proposal generation、auto-rigging、auto-fix、auto-commitを追加していない。
- Test Adequacy: coupling removal、shell foundation、focused PSD regressions、guardrailsが適切に検証されている。
- Source Organization: `index.ts` files remain barrel-only and source organization guardrails pass.
- Orchestration Compliance: Orch-Sylph did not implement directly; Gnome implementation and Review-Sylph review are separated.

## 13. Verification Plan

Domain minimum verification:

- Domain A: boundary report/review, coupling target list, first migration target list, `git diff --check`.
- Domain B: targeted PSD Import tests / focused e2e proving import-plan and structural scaffold behavior after coupling removal.
- Domain C: shell/unit tests or focused e2e proving current workflows remain reachable through the shell foundation.
- Domain D: structured status/surface tests or focused oracle update proving human/evidence/test boundaries are explicit.
- Domain E: focused e2e and guard scripts for production `data-testid` behavior dependency.
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
- production `data-testid` behavior dependency guard, if added by Domain E
- `node scripts/check-psd-parser-import-boundary.mjs`
- `node scripts/check-focused-e2e-registry.mjs`
- `node scripts/check-wave42-quality-gate-boundary.mjs`
- `pnpm run check:source`
- `pnpm run check:deps`
- `git diff --check -- apps packages scripts fixtures test_data generated discussion discussion/implementation discussion/development_convention discussion/tests`
- forbidden-scope scan for new Mesh/Atlas feature claims, semantic recognition, suggestion UI, proposal generation, auto classify, auto-fix, automatic commit, Photoshop compositing, renderer/pixel oracle, external transport, Cubism, public demo asset, persisted source PSD bytes/raw parser objects

## 14. Early Escape / User Decision Points

Orch-Sylph must escalate if:

- Removing `data-testid` production coupling requires a broader UI state rewrite than Wave51 can safely own.
- Task/View Shell foundation requires a product decision about modal vs dedicated view vs side panel that is not already captured in screen-design docs.
- Existing focused e2e cannot be preserved without either weakening tests or completing a larger layout migration.
- The implementation requires moving many panels at once.
- The implementation requires new Mesh / Atlas / Parameter / Variant UI.
- The implementation requires structural-specific Codex execute/stale command parity beyond a narrow read/status surface.
- The implementation requires external HTTP / WebSocket / MCP transport.
- The implementation requires persisted/exported Product Preflight artifacts or release/demo gates.
- The implementation requires semantic recognition, auto-classification, proposal generation, auto-rigging, or auto-fix.
- The implementation requires renderer/pixel oracle, Photoshop compositing, Cubism compatibility, or public demo assets.
- Parallel domains need to edit the same files.

No additional user question is required before starting Wave51 under this plan. If the desired direction changes to Mesh generation, Texture Atlas, full visual redesign, or Codex external transport, replace this plan before launch.

## 15. Expected Screen-Design Implementation Sequence

Wave51 is the first screen-design implementation wave. It should leave the project ready for follow-up waves such as:

1. Workspace Layout Migration v0: move toward the Authoring Workspace layout with Toolbox, Parts Tree, Canvas, Inspector, Parameter Bar, and Diagnostics Strip.
2. PSD Import Task Migration v0: move PSD import from the one-page panel into the task shell once production coupling is removed.
3. Diagnostics / Evidence View Separation v0: move operation log, generated evidence, package file set, reload summary, and full diagnostics out of the normal authoring UI.
4. Codex / Automation View Separation v0: organize proposal review, approval, transcript, command surface status, and operation availability without treating visible DOM as the command surface.
5. Texture Atlas Task v0 and Mesh generation/tool v0: add or expose new authoring capabilities only after their UI home and surface boundaries are ready.

This sequence is a planning expectation, not a binding promise. Each follow-up wave must run its own planning gate.

## 16. Pass Criteria

Wave51 passes when:

- PSD import-plan / structural scaffold production behavior no longer depends on `data-testid` selectors or fragile local DOM structure for behavior-critical state.
- Existing `data-testid` values needed by tests remain as test-facing observation hooks or are replaced by an explicitly documented stable surface.
- A minimal Task/View Shell foundation exists, allowing future task/view migrations without further appending everything into the one-page workspace.
- Current core workflows remain reachable; Wave51 does not hide or remove required controls without replacement.
- Human UI / Codex-facing / test-facing / Evidence surface boundaries are improved and documented.
- Focused PSD import/scaffold regressions pass.
- A guard or focused review prevents reintroducing production `data-testid` behavior dependency, or explicitly records why the guard could not be implemented in Wave51.
- No Mesh generation, Texture Atlas packing, Parameter Manager implementation, Variant Manager implementation, full visual redesign, semantic recognition, proposal generation, auto-rigging, renderer/pixel oracle, external transport, Cubism compatibility, or public demo asset work is introduced.
- `index.ts` files remain barrel-only and source organization guardrails pass.
- Domain completion reports, Review-Sylph reviews, final integration report, clean review, and map/backlog updates are recorded under `discussion/implementation/`.
