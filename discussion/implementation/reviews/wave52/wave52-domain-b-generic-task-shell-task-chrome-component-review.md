# Wave52 Domain B Review: Generic Task Shell / Task Chrome Component

Target: `wave52-generic-task-shell-task-chrome-component`  
Review target files:

- `apps/editor/src/ui/app-shell/task-shell.ts`
- `apps/editor/src/ui/app-shell/task-shell.test.ts`

## verdict

`pass`

Blocking findings: none.

The Domain B implementation fits the Wave52 B contract. It adds a PSD-agnostic `createTaskShell` DOM component with title/status, shell surface metadata, back/close affordances, primary/secondary/action-status slots, diagnostics summary slot, and content slot. It does not wire the component into App Shell, does not add PSD Import workflow logic, does not add dependencies, and does not introduce Mesh / Atlas / Parameter / Variant capability.

## Scope Reviewed

Reviewed as clean Review-Sylph from basis documents, target file contents, working-tree status for `apps/editor/src/ui/app-shell/**`, narrow static searches, and verification evidence supplied by Orch-Sylph.

Important review note: the two target files were untracked new files at review time, so `git diff -- apps/editor/src/ui/app-shell/task-shell.ts apps/editor/src/ui/app-shell/task-shell.test.ts` had no patch output. The review therefore used the full target file contents directly.

Read-only source files checked:

- `apps/editor/src/ui/app-shell/task-shell.ts`
- `apps/editor/src/ui/app-shell/task-shell.test.ts`
- `apps/editor/src/ui/app-shell/shell-surfaces.ts`
- `apps/editor/src/ui/app-shell/index.ts` was checked and does not exist, so no app-shell barrel implementation logic was introduced.

## Basis Documents Used

- `discussion/implementation/orchestration/wave52-plan.md`
- `discussion/implementation/waves/wave52/wave52-domain-a-boundary-component-contract-inventory-report.md`
- `discussion/implementation/reviews/wave52/wave52-domain-a-boundary-component-contract-inventory-review.md`
- `discussion/implementation/waves/wave51/wave51-final-integration-report.md`
- `discussion/design/screen-design/overview.md`
- `discussion/design/screen-design/screens/authoring-workspace.md`
- `discussion/design/screen-design/components/toolbox.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/_conventions.md`
- `discussion/_map.md`

## Findings

Blocking findings: none.

No `needs_changes` or `escalate` finding was identified.

## Design / Contract Fit

The implementation matches Domain A's B contract:

- Generic shell/chrome: `createTaskShell` accepts a `ShellSurfaceDefinition` and does not branch on PSD-specific workflow state.
- Required inputs are present: title, concise status, surface metadata, back and close affordance options, primary action slot, secondary action slot, action status slot, diagnostics summary slot, and content slot.
- Required outputs are present: a DOM `section` with stable task-shell region metadata and shell-surface `dataset` metadata from `applyShellSurfaceMetadata`.
- Scope is narrow: the implementation stays under `apps/editor/src/ui/app-shell/**`, adds no dependencies, performs no App Shell routing/final integration, and does not touch PSD Import files.
- Future task/view reuse is credible: tests instantiate the shell for Project Storage, Validation, Diagnostics / Evidence, Tutorial, and Codex Automation surfaces; the API also accepts arbitrary future `ShellSurfaceDefinition` values for later Atlas, Parameter, Variant, and other task surfaces.

Accessibility basics are adequate for this component layer:

- The root `section` is labelled by the generated or caller-supplied title id and described by the generated or caller-supplied status id.
- Back and close controls are native `button type="button"` elements.
- Affordance buttons require explicit `ariaLabel`, support optional visible labels and titles, and expose disabled/busy state through native `disabled`, `aria-disabled`, and `aria-busy`.
- Optional regions are omitted when not supplied, avoiding empty keyboard or screen-reader clutter.

The implementation preserves the Wave52 screen-design boundary:

- It does not decide modal vs dedicated task view vs side panel.
- It does not implement Toolbox placement.
- It does not make PSD Import always-visible panel migration claims.
- It does not add machine-only evidence, operation IDs, digests, raw parser payloads, generated refs, or test selector strings to primary human UI.

## Verification Assessed

Orch-Sylph supplied the following post-Gnome verification evidence, and it is sufficient for Domain B:

- `pnpm.cmd exec vitest run apps/editor/src/ui/app-shell/task-shell.test.ts`
  - sandbox attempt failed with esbuild `spawn EPERM`
  - approved rerun passed: 1 test file, 5 tests
- `node scripts/check-source-organization.mjs`: passed
- `pnpm.cmd typecheck`: passed
- `git diff --check -- apps/editor/src/ui/app-shell/task-shell.ts apps/editor/src/ui/app-shell/task-shell.test.ts`: passed

Additional read-only review checks:

- `rg --files apps/editor/src/ui/app-shell` confirmed the new task shell files sit beside existing app-shell responsibilities.
- Static search of the target files for forbidden scope terms found no production-scope drift. The only PSD mention was the negative genericity assertion in the test, and the Codex mention was the expected non-PSD view fixture.
- `apps/editor/src/ui/app-shell/index.ts` does not exist, so the source organization policy's barrel-only rule was not put at risk by this domain.

Test adequacy is acceptable for a narrow component domain:

- The tests cover title/status/content rendering and shell surface metadata.
- The tests cover primary, secondary, action-status, diagnostics, and content slot placement into stable regions.
- The tests cover native back/close buttons, callbacks, disabled state, and busy state.
- The tests cover optional-region omission.
- The tests cover generic non-PSD usage through Codex Automation.

## Residual Risks / Deferred Debt

- Visual styling and final task presentation remain deferred. This component supplies DOM structure and class hooks, not the final modal/task-view/window design.
- Multiple simultaneously mounted task shells using the same surface and group would generate duplicate default title/status ids unless callers provide explicit `titleId` and `statusId`. Wave52 currently treats task presentation as minimal v0, so this is not blocking.
- The diagnostics summary container is structurally separated but not independently labelled by the shell. If a later design needs diagnostics as a named landmark, Domain D or a later UI polish wave should add a label option or require labelled diagnostic content.
- Atlas, Parameter, and Variant shell surface registry entries are not added here. The component can accept future `ShellSurfaceDefinition` values, and adding those concrete surfaces belongs to later task/view domains or integration work.
- Domain B does not prove App Shell integration, PSD Import reachability, or focused PSD e2e preservation. Those are owned by Domains D and E.

## User-Decision Points

No immediate user decision is required for Domain B.

Future decisions remain the same as the Wave52 plan and Domain A review:

- final modal/task-window/dedicated-view policy;
- final Toolbox placement;
- final Diagnostics / Evidence View and Codex / Automation View placement;
- whether production `data-testid` guard integration becomes part of a broader standard quality gate if Domain E defers narrow script integration.
