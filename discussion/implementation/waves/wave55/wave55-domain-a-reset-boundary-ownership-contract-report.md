# Wave55 Domain A Report: Reset Boundary / Ownership Contract

> Target: `wave55-reset-boundary-ownership-contract`  
> Role: Domain A Orch-Sylph  
> Verdict: `pass`  
> Scope: UI Reset inventories を実装可能な所有境界、UX AC、並列計画へ変換する。source implementation は行わない。

## 1. Verdict

`pass`

Wave55 B-F は、全件同時ではなく分割 batch で開始するべきである。理由は `apps/editor/src/styles/editor.css`、`apps/editor/src/ui/app-shell/app-shell.ts`、`apps/editor/src/ui/app-shell/app-shell.test.ts` が現在の物理衝突点であり、特に primary cutover と UX e2e gate は G 統合後でないと pass evidence にできないためである。

推奨 batch:

| Batch | Domain | 開始可否 | 条件 |
|---|---|---|---|
| 2a | B Primary Human Shell / C Task Window Overlay / D PSD Clean Task / E Legacy Quarantine | 並列可 | B/C/D/E は下記の file ownership を守り、`app-shell.ts` final mount、`editor-app.ts` focus、`app-shell.test.ts` integration、`index.html` stylesheet wiring を触らない。 |
| 2b | F UX-focused E2E Gate | B/C/D/E の主要 DOM/class/testid 契約後 | `taskWindowUxFocused` または equivalent を追加する。最終 pass は G/H の統合後 evidence で確認する。 |
| 3 | G App Shell integration / primary cutover | B/C/D/E と F gate definition 後 | live App Shell の cutover、support region primary removal、overlay wiring、quarantine reachability を一括統合する。 |

B-F を全件同時に開始することは推奨しない。B/C/D/E の component work は並列化できるが、F は最終 UX gate の性質上、少なくとも gate 定義と最終 pass verification を分けて扱う必要がある。

## 2. Basis

参照した主な基礎文書:

- `C:/Users/remie/.codex/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `.agents/skills/implementation-orchestration/SKILL.md`
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
- `discussion/development_convention/source-file-organization-policy.md`

補足: `current-capability-map.md` と `remaining-work-backlog.md` には Wave54 Domain J 未完了の古い記述が残っているが、Wave55 plan と Wave54 final report/review は Wave54 final `pass` を明示している。この差分は Wave55 Domain I の docs refresh 対象であり、B-F 開始の blocker ではない。

## 3. Minimal Source Boundary Facts

Domain A は source implementation を行っていない。所有境界確認のため、以下だけを狭く確認した。

- `apps/editor/src/ui/app-shell/app-shell.ts`
  - `createEditorAppShell(...)` は primary layout、active task、`createWorkspaceSupportRegion([...])` を同じ `editor-workspace` に append している。
  - legacy/debug/evidence/Codex-heavy panels は `createWorkspaceSupportRegion([...])` の中にまとまっており、normal primary flow に残っている。
  - `EditorAppShellOptions` は primary shell に必要な state/callback と legacy support panel callback を同時に抱えているため、B/G は表示削除と callback 保持を分ける必要がある。
- `apps/editor/src/ui/app-shell/authoring-workspace-v0-shell.ts`
  - `createWorkspaceSupportRegion()` は `className = "authoring-workspace-support"` と `data-shell-surface-group="legacy-support"` を付ける。
  - Toolbox disabled reason に `Detailed controls are in support panels` / `Available in support panels` が残っている。
- `apps/editor/src/ui/app-shell/task-shell.ts`
  - task shell は `role="dialog"`、`aria-modal="false"`、`data-task-window-*`、Back/Close/Escape を持つ。
  - これは UX pass の補助情報であり、window/overlay geometry の十分条件ではない。
- `apps/editor/src/styles/editor.css`
  - `.editor-task-shell` は現状 `display:flex`、`width`、`max-height` 等を持つが、確認範囲では `position: fixed` / `absolute` / overlay host / backdrop がない。
  - `.authoring-workspace-support` は通常 grid として見える。
  - responsive では `.editor-task-shell { max-height: none; }` もあり、mobile viewport containment を必ず e2e で確認する必要がある。
- `apps/editor/src/app/editor-app.ts`
  - active task open 後に `[data-task-window-scope="workspace"][data-task-window-region="window"]` へ `.focus()` している。`preventScroll` 相当の no-scroll 保証は現状確認できない。
- `apps/editor/src/ui/explicit-psd-import/**`
  - 現存パスは `apps/editor/src/ui/explicit-psd-import/` であり、`apps/editor/src/ui/psd-import/` は存在しない。
  - `explicit-psd-import-task-summary.ts` は `Task Summary` heading を生成している。
  - `explicit-psd-import-panel.ts` には parse/source/tree/plan/structural scaffold/advanced intake/evidence-oriented details が同じ task content に残っている。
- `apps/editor/e2e/task-window-routing-focused-smoke.mjs` と `scripts/focused-e2e-registry.mjs`
  - `taskWindowRoutingFocused` は route/role/focus/skeleton text を見る。
  - geometry、scroll、overlay/static-flow、desktop/mobile registered UX gate、first viewport forbidden text は見ていない。
  - `taskWindowUxFocused` は未登録。

## 4. Ownership Matrix

### Domain B: Primary Human Shell v0

Purpose:

- normal startup の primary first viewport から legacy/debug/evidence/Codex-heavy content を外した clean shell component を作る。
- 現行 panel composition を UX 正解にしない。
- state/callback contract は落とさない。

Owned source candidates:

- Preferred new files under `apps/editor/src/ui/app-shell/`, for example primary shell/layout adapter files.
- `apps/editor/src/ui/app-shell/authoring-workspace-v0-shell.ts` only for primary layout / Toolbox launcher wording / primary surface contract.
- `apps/editor/src/ui/app-shell/toolbox-surface.ts` and `toolbox-surface.test.ts` only if launcher component contract needs update.
- `apps/editor/src/ui/app-shell/workspace-context-surfaces.ts`, `parts-tree-surface.ts`, and focused tests only for primary region contract preservation.

Do not touch:

- `apps/editor/src/ui/app-shell/app-shell.ts` final mount/cutover.
- `apps/editor/src/app/editor-app.ts`.
- `apps/editor/src/ui/app-shell/task-shell.ts`.
- `apps/editor/src/ui/explicit-psd-import/**`.
- legacy/evidence/Codex panel implementations.
- broad `app-shell.test.ts` integration assertions unless G delegates a narrow post-cutover fix.

### Domain C: Task Window Overlay UX v0

Purpose:

- task shell を normal flow section ではなく viewport-contained overlay/window UX にする。
- no-scroll launch、Close/Back visibility、desktop/mobile geometry の source-side foundation を作る。

Owned source candidates:

- `apps/editor/src/ui/app-shell/task-shell.ts`
- `apps/editor/src/ui/app-shell/task-shell.test.ts`
- task-shell focused CSS selectors/classes. If CSS stays in `apps/editor/src/styles/editor.css`, C owns only `.editor-task-shell*` / `.task-shell*` / overlay host/backdrop selector blocks.
- Optional new task window overlay helper files under `apps/editor/src/ui/app-shell/**`.

Do not touch:

- PSD-specific content in `apps/editor/src/ui/explicit-psd-import/**`.
- final App Shell routing/cutover in `app-shell.ts`.
- legacy quarantine route/content.
- e2e registry ownership except if F explicitly requests an assertion helper.

Note:

- If no-scroll requires `focus({ preventScroll: true })` in `apps/editor/src/app/editor-app.ts`, record it for G integration rather than expanding C ownership.

### Domain D: PSD Import Clean Human Task v0

Purpose:

- PSD Import を最初の clean human task vertical slice にする。
- parse/source/tree/scope/preview/approve/commit/cancel を中心にし、raw refs/evidence/Codex/test details を primary human UI から外す。
- PSD parser/import/scaffold semantics は変えない。

Owned source candidates:

- `apps/editor/src/ui/explicit-psd-import/explicit-psd-import-panel.ts`
- `apps/editor/src/ui/explicit-psd-import/explicit-psd-import-task-summary.ts`
- `apps/editor/src/ui/explicit-psd-import/explicit-psd-import-panel.test.ts`
- `apps/editor/src/ui/explicit-psd-import/index.ts` only as barrel re-export if new files are added.
- Optional new files under `apps/editor/src/ui/explicit-psd-import/**` split by responsibility.

Do not touch:

- PSD parser/workflow/operation semantics.
- `apps/editor/src/ui/app-shell/task-shell.ts`.
- `apps/editor/src/ui/app-shell/app-shell.ts` final task routing.
- e2e registry/gate files except targeted selector compatibility notes for F.

### Domain E: Legacy / Debug Quarantine Surface v0

Purpose:

- legacy/support panels の callback/test/evidence reachability を normal primary 以外に逃がす最小 surface を用意する。
- quarantine は primary authoring UX ではない。

Owned source candidates:

- Preferred new files under `apps/editor/src/ui/app-shell/**`, for example `legacy-quarantine-surface` style component/test files.
- Narrow existing support-region helper ownership only if B does not touch the same file and G has not reserved it.
- Focused tests for quarantine component presence/absence behavior.

Do not touch:

- final removal of `createWorkspaceSupportRegion([...])` from live App Shell; that is G.
- full Diagnostics/Evidence or full Codex/Automation migration.
- PSD Import clean task content.
- Product Preflight redesign.

### Domain F: UX-focused E2E / Review Gate v0

Purpose:

- Wave54 の UX見逃しを再発させない focused gate を作る。
- DOM role/data marker ではなく geometry、scroll、first viewport text、legacy visibility を oracle にする。

Owned source/test candidates:

- `apps/editor/e2e/task-window-ux-focused-smoke.mjs` or equivalent new focused e2e file.
- Focused geometry/text helper files under `apps/editor/e2e/**`, if needed.
- `scripts/focused-e2e-registry.mjs`
- `scripts/check-focused-e2e-registry.mjs` only if registry shape must change.
- screenshot/bounding-box helper files if needed.
- `discussion/tests/traceability/test-traceability-matrix.md` if F owns traceability update before Domain I.

Do not touch:

- production App Shell behavior.
- PSD parser/import semantics.
- source CSS/DOM to make the test pass.
- existing PSD focused tests except to move oracles away from primary human text without weakening behavior.

## 5. Shared File Fences

Reserved for G integration unless explicitly reassigned:

- `apps/editor/src/ui/app-shell/app-shell.ts`
- `apps/editor/src/app/editor-app.ts`
- `apps/editor/src/ui/app-shell/app-shell.test.ts`
- `apps/editor/index.html`
- final stylesheet link/wiring

Potential conflict:

- `apps/editor/src/styles/editor.css` is currently monolithic. To preserve parallelism, either:
  - C owns only task-window overlay selector blocks while B/D/E avoid `editor.css`, or
  - B/C/D/E create domain-specific CSS files and G links/orders them, or
  - Undine batches CSS-bearing domains sequentially.

`index.ts` files remain barrel-only per `source-file-organization-policy.md`.

## 6. G Integration Contract

G owns the central cutover and must not be pushed into Undine/root.

G owned integration candidates:

- `apps/editor/src/ui/app-shell/app-shell.ts`
  - Consume B Primary Shell output.
  - Remove `authoring-workspace-support` from normal primary flow.
  - Mount active task through C overlay/window host.
  - Keep E quarantine reachable only as non-primary/internal/debug surface.
  - Wire D PSD clean task content into the task window.
- `apps/editor/src/app/editor-app.ts`
  - Apply no-scroll focus behavior if not solved inside task shell.
  - Preserve active task open/close/back/Escape state.
- `apps/editor/src/styles/editor.css` and/or `apps/editor/index.html`
  - Final CSS ordering/linking for B/C/D/E if new style files are introduced.
- Focused integration/unit/e2e tests that prove primary cutover.

G must not:

- Reintroduce legacy panels into primary UI.
- Treat quarantine as the main Editor UX.
- Change PSD import/parser/scaffold semantics.
- Implement Mesh/Atlas/Parameter/Variant/full Diagnostics/full Codex/full Viewer redesign.
- Accept `role=dialog` / `data-task-window-*` as sufficient UX proof.

## 7. UX AC Checklist

The following checklist is fixed for Wave55 implementation/review gates.

- Startup first viewport:
  - Normal editor startup first viewport must not show `authoring-workspace-support`.
  - It must not show legacy/debug/evidence/Codex-heavy headings or content such as Operation Log, Generated Evidence, Package File Set, Reload Summary, Codex Proposal Review, AI Approval, AI Transcript, Product Preflight full detail, Project Persistence full panel, Transport capability, Source Intake, Drawable Authoring, Rig Control, Dynamics, Composition, Tutorial Workflow, Viewer / Runtime full evidence panel.
  - Toolbox disabled/status text must not refer to `support panels` as the correct user path.
- Primary shell:
  - Primary shell contains only App Bar, Toolbox, Structure/Parts, Canvas/Preview, Inspector, Parameter/status strip, compact diagnostics/status indicator, and active task window when open.
  - Required state/callback contracts remain reachable through primary, task, quarantine, Diagnostics/Evidence, or Codex/Automation surfaces as appropriate.
- Toolbox PSD open:
  - Opening PSD Import from Toolbox must not cause document scroll jump.
  - `window.scrollY` / `document.scrollingElement.scrollTop` before and after open/focus must remain within a narrow tolerance.
- Task window visual UX:
  - Task window must be visible in the initial viewport as a window/overlay/docked-window experience on desktop and mobile.
  - Header/title/Back/Close/primary action must be within viewport on open.
  - Long content scrolls inside the task window, not by moving the outer document.
  - `elementFromPoint()` at the task window center resolves to the active task window or its child.
  - Active task must not increase document height as a normal below-the-fold section.
  - `role=dialog`, `aria-modal`, `data-task-window-*`, surface id/kind/group, focus state, or screenshot `base64Length` alone are never sufficient to pass.
- PSD Import clean task:
  - Primary human PSD task shows PSD file selection, human parse status, PSD structure tree or empty state, import target/scope, preview summary, warnings, import/commit/cancel affordances.
  - PSD Import semantics, parser boundary, approval/commit guards, and existing operation contracts are preserved.
  - Advanced/debug/evidence content is secondary or quarantined; it must not dominate primary human UI.
- Forbidden primary human UI text/data:
  - `Task Summary`, raw refs, PSD node refs such as `psd:root/...`, operation IDs, approval IDs, plan/candidate digests, diagnostics IDs, evidence paths, generated refs, command payloads, raw parser payloads, route IDs such as `diagnosticsEvidenceView`, `data-testid`, and test-selector strings must not appear in primary human UI.
  - If tests need these details, F/G must use structured test-facing state, Diagnostics/Evidence, Codex-facing commands, or quarantine, not visible primary human copy.
- Legacy quarantine:
  - Legacy/debug/evidence/Codex-heavy content may remain reachable for investigation/test continuity, but only outside normal primary authoring.
  - Quarantine must not look or behave as the main Editor workspace.
- Review gate:
  - Review-Sylph must return `needs_fix` if visual/geometry/no-scroll/first-viewport checks are absent for a claimed UX pass.
  - Tests must not be weakened to hide removed primary debug text.

## 8. Focused Regression Targets

Required new/focused target:

- `node scripts/run-focused-e2e.mjs --id taskWindowUxFocused` or exact A/F-approved equivalent.

Required preservation targets:

- `node scripts/run-focused-e2e.mjs --id taskWindowRoutingFocused`
- `node scripts/run-focused-e2e.mjs --id psdStructuralInitialStateFocused`
- `node scripts/run-focused-e2e.mjs --id psdImportPlanCodexFocused`
- `node scripts/run-focused-e2e.mjs --id psdImportPlanFocused`
- `node scripts/run-focused-e2e.mjs --id psdMultiLayerBatchFocused`
- `node scripts/run-focused-e2e.mjs --id psdImportFocused`
- `node scripts/check-focused-e2e-registry.mjs`
- `node scripts/check-production-testid-boundary.mjs`
- `node scripts/check-production-testid-boundary-fixtures.mjs`
- `node scripts/check-psd-parser-import-boundary.mjs`
- `node scripts/check-wave42-quality-gate-boundary.mjs`
- `pnpm typecheck`
- `pnpm test:unit`
- `pnpm test:e2e`
- `pnpm run check`
- `pnpm run check:source`
- `pnpm run check:deps`
- `git diff --check -- apps packages scripts fixtures test_data generated discussion discussion/implementation discussion/development_convention discussion/tests`

`taskWindowUxFocused` must include desktop and mobile geometry/no-scroll/forbidden primary text assertions. `taskWindowRoutingFocused` remains route semantic smoke only.

## 9. User-decision Points

Blocking user decision before B-F: none.

Wave55 v0 can proceed with these bounded defaults:

- PSD Import uses a workspace-scoped overlay/window UX.
- `Task Summary` is not allowed in primary human UI for Wave55.
- legacy/debug quarantine is non-primary and may be route/drawer/dev-only refined later.
- Product Preflight full detail remains outside primary UI in Wave55.

Deferred non-blocking user decisions:

- Final all-tool policy: modal overlay vs non-modal floating window vs docked drawer vs dedicated view.
- Final legacy quarantine form: explicit route, dev-only drawer, or removable build-time surface.
- Final Product Preflight owner: Validation task vs Diagnostics/Evidence detail.
- Next authoring workflow to promote after PSD Import proves the reset pattern.

## 10. Orchestration Compliance

- Domain A did not edit source, tests, scripts, fixtures, package metadata, lockfiles, or generated assets.
- Domain A only wrote this report under `discussion/implementation/waves/wave55/**`.
- Source reads were limited to ownership/contract confirmation.
- Domain A source implementation is N/A; no Gnome implementation was launched.
- Independent Review-Sylph review is required at `discussion/implementation/reviews/wave55/wave55-domain-a-reset-boundary-ownership-contract-review.md`.
