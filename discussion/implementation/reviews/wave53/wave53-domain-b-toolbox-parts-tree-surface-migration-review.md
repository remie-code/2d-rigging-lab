# Wave53 Domain B Review: Toolbox / Parts Tree Surface Migration

## verdict

`pass`

No blocking findings. The Domain B implementation adds bounded, reusable left-side surface factories and focused tests without final App Shell wiring or overlap with Domain C. It is acceptable for Domain D integration to consume these surfaces.

## basis used

- `C:/Users/remie/.codex/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave53-plan.md`
- `discussion/implementation/waves/wave53/wave53-domain-a-workspace-layout-boundary-current-host-inventory-report.md`
- `discussion/implementation/reviews/wave53/wave53-domain-a-workspace-layout-boundary-current-host-inventory-review.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/design/screen-design/overview.md`
- `discussion/design/screen-design/screens/authoring-workspace.md`
- `discussion/design/screen-design/components/toolbox.md`
- `discussion/design/screen-design/components/parts-tree.md`
- `discussion/design/codex-friendly-automation-policy.md`
- `apps/editor/src/ui/app-shell/toolbox-surface.ts`
- `apps/editor/src/ui/app-shell/toolbox-surface.test.ts`
- `apps/editor/src/ui/app-shell/parts-tree-surface.ts`
- `apps/editor/src/ui/app-shell/parts-tree-surface.test.ts`
- Adjacent existing components used by Domain B:
  - `apps/editor/src/ui/app-shell/shell-surfaces.ts`
  - `apps/editor/src/ui/layer-tree/layer-tree-panel.ts`
  - `apps/editor/src/ui/drawable-authoring/drawable-list.ts`

## findings, blocking first

Blocking findings: none.

Non-blocking observations:

- The Toolbox surface currently exposes tooltip text through `title` plus accessible button text/description (`toolbox-surface.ts:120-126`, `toolbox-surface.ts:167-171`). This satisfies the Domain B launcher/test boundary, but final hover/focus tooltip presentation and real icon styling remain a later integration or polish concern.
- The Parts Tree surface wraps the existing Layer Tree and Drawable List row controls, but it does not migrate the separate manual drawable creation form from `drawable-authoring-panel.ts`. That is acceptable for this Domain B row-surface migration because no final App Shell integration removes the old workflow yet; Domain D or a later wave must avoid losing that entry if Parts Tree becomes the sole structure home.
- Existing wrapped row UI still contains technical identifiers and texture labels from pre-existing components. Domain B did not introduce raw operation/evidence/debug primary UI, but later design polish may want more human-facing row labels.

## design/development compliance review

- Layout Boundary: pass. Domain B creates reusable surface factories only. It does not wire them into `createEditorAppShell`, change `editor-app.ts`, or add shared responsive CSS.
- Parallel Boundary: pass. `git status --short -uall` shows Domain B changes are limited to the four target untracked files. Domain C files are present separately and were not reviewed or edited here. No e2e, package, lockfile, script, PSD workflow, or final shell integration file was changed by Domain B.
- Toolbox Boundary: pass. `createToolboxSurface` accepts explicit action/task/view item arrays and one explicit `onActivate` callback (`toolbox-surface.ts:19-25`). It builds action, task, and view groups (`toolbox-surface.ts:58-76`), supports active/disabled/badge/status state (`toolbox-surface.ts:113-153`), and suppresses disabled callbacks (`toolbox-surface.ts:156-162`). There is no global workflow wiring.
- Parts Tree Boundary: pass. `createPartsTreeSurface` composes the existing layer tree and optional drawable list through explicit options (`parts-tree-surface.ts:9-34`). It adds a structure/row-state summary from the layer tree view model (`parts-tree-surface.ts:39-70`) and a draw order/runtime visibility section around the existing drawable list (`parts-tree-surface.ts:72-85`).
- Existing Workflow Preservation: pass for the implemented surface scope. The layer tree options and drawable list options are passed through to the existing components, preserving selection, lock/editor-hidden, runtime visibility, and move callbacks instead of replacing them with global state.
- Codex/Automation Policy: pass. A forbidden-scope search found no repo-side proposal generation, semantic recognition, auto-classification, auto-rig/auto-fix, external transport, or autonomous commit behavior in the Domain B files. Mentions of Mesh/Diagnostics are launcher labels or test fixture labels, not capability implementation.
- Orchestration Compliance: pass. This review was performed independently from the implementation context and did not modify source or tests. Source implementation is treated as Gnome-owned per the Orch-Sylph handoff.

## test adequacy review

- `toolbox-surface.test.ts` covers shell metadata, action/task/view grouping, accessible labels, active state, disabled reason, tooltip/title text, disabled suppression, and callback dispatch (`toolbox-surface.test.ts:14-83`).
- `parts-tree-surface.test.ts` covers shell metadata, structure heading, row-state summary labels, absence of raw operation/evidence wording, reuse of existing layer tree and drawable list test IDs, row state rendering, selection callback, runtime visibility callback, and move callback (`parts-tree-surface.test.ts:26-142`).
- The tests are appropriately focused for pre-integration component factories. They do not cover App Shell placement, CSS/responsive behavior, browser accessibility behavior, or PSD task reachability; those belong to later Wave53 D/E verification after final wiring.
- Reviewed Orch-Sylph evidence that the approved outside-sandbox rerun of `pnpm.cmd exec vitest run apps/editor/src/ui/app-shell/toolbox-surface.test.ts apps/editor/src/ui/app-shell/parts-tree-surface.test.ts` passed with 2 test files and 2 tests, after a sandbox `esbuild spawn EPERM` failure.
- Reviewed Orch-Sylph evidence that `pnpm.cmd typecheck` passed.

## source organization review

- The new source files are narrowly named and cohesive:
  - `toolbox-surface.ts` owns only the Toolbox launcher surface.
  - `parts-tree-surface.ts` owns only the Structure / Parts wrapper surface.
  - Each has a matching focused test file.
- No `index.ts` implementation logic, broad catch-all `types.ts`/`utils.ts`/`helpers.ts`, package metadata churn, or shared barrel expansion was introduced.
- I ran `node scripts/check-source-organization.mjs`; it passed.

## residual risks

- Final App Shell integration is still unreviewed for Domain B behavior because Domain B intentionally does not wire these surfaces into the live workspace.
- Browser-level tooltip behavior, real icon assets, compact-vs-expanded styling, and responsive layout are not proven by these unit tests.
- If multiple copies of these surfaces were mounted in one document, the hard-coded heading IDs could collide. The accepted v0 skeleton expects a single Toolbox and Parts Tree instance, so this is not blocking.
- Existing e2e text oracles may still be affected when Domain D moves old panels into the new layout. Stable wrappers/test IDs should be preserved or replaced deliberately.

## user-decision points

No immediate user decision is required for Domain B.

Possible future design/dependency decisions remain outside this review: final visual tooltip component behavior, whether to add a real icon package such as `lucide`, final Toolbox expanded-label policy, and the final home for manual drawable creation if the legacy Drawable Authoring panel is removed.

## verification reviewed/performed

Performed:

- Read all required basis documents and the four Domain B source/test files directly.
- Inspected adjacent existing `shell-surfaces`, `layer-tree-panel`, and `drawable-list` code used by the new surfaces.
- Ran `git status --short -uall` to verify the Domain B source/test scope and note concurrent Domain C files separately.
- Ran a forbidden-scope `rg` scan over the four Domain B files for automation/transport/proposal/raw evidence terms.
- Ran `node scripts/check-source-organization.mjs`; passed.

Reviewed from Orch-Sylph evidence:

- Targeted Domain B Vitest passed outside sandbox: 2 test files, 2 tests.
- `pnpm.cmd typecheck` passed.
- `node scripts/check-source-organization.mjs` passed.
- `git diff --check -- apps/editor/src/ui/app-shell apps/editor/src/ui/layer-tree apps/editor/src/ui/drawable-authoring` passed for tracked diff.
- Additional no-index whitespace check for the four new untracked files passed, with only LF/CRLF working-copy warnings on the first run.

Not rerun here:

- I did not rerun targeted Vitest or `pnpm.cmd typecheck` in this review context because the handoff already recorded the sandbox `esbuild spawn EPERM` behavior and the approved outside-sandbox pass. This review independently inspected code and performed the source organization guard.
