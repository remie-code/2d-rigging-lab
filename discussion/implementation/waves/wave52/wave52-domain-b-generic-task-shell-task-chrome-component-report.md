# Wave52 Domain B Report: Generic Task Shell / Task Chrome Component

> Target: `wave52-generic-task-shell-task-chrome-component`  
> Role: Domain B Orch-Sylph implementation orchestration  
> Verdict: `pass`

## verdict

`pass`

Domain B implemented and reviewed a reusable, PSD-agnostic Task Shell / Task Chrome component. Source implementation was delegated to Gnome, and clean review was delegated to Review-Sylph. Orch-Sylph did not perform source implementation.

Mandatory separation basis:

```text
Orch-Sylph自身は実装担当ではない。source implementation は必ず別コンテキストの Gnome に委譲し、レビューは必ず別コンテキストの Review-Sylph に委譲すること。これを分離できない場合は実装せず escalate / blocked として報告すること。
```

## Gnome Implementation Summary

Gnome verdict: `done`

Changed source/test files:

- `apps/editor/src/ui/app-shell/task-shell.ts`
- `apps/editor/src/ui/app-shell/task-shell.test.ts`

Implementation summary:

- Added a generic `createTaskShell(...)` DOM factory under the App Shell boundary.
- Supports title, concise status, `ShellSurfaceDefinition` metadata through `applyShellSurfaceMetadata`, optional back/close native button affordances, primary action slot, secondary action slot, action status slot, diagnostics summary slot, and content slot.
- Keeps slots generic as DOM elements or arrays of DOM elements so later PSD Import, Storage, Validation, Diagnostics, Codex, Atlas, Parameter, and Variant task/view content can be hosted without workflow-specific coupling.
- Did not edit PSD Import, App Shell routing, e2e, scripts, dependencies, styles, or barrel files.

## Review-Sylph Result

Review-Sylph verdict: `pass`

Review path:

- `discussion/implementation/reviews/wave52/wave52-domain-b-generic-task-shell-task-chrome-component-review.md`

Review summary:

- Blocking findings: none.
- Confirmed Domain B fits the Domain A contract and Wave52 B objective.
- Confirmed no PSD Import workflow logic, App Shell routing/final integration, dependency addition, full visual redesign, or new Mesh / Atlas / Parameter / Variant capability was introduced.
- Confirmed source organization policy is respected; no `index.ts` implementation logic was added.

## Verification Commands / Results

Focused verification after Gnome implementation:

| Command | Result |
|---|---|
| `git diff --check -- apps/editor/src/ui/app-shell/task-shell.ts apps/editor/src/ui/app-shell/task-shell.test.ts` | `pass` |
| `pnpm.cmd exec vitest run apps/editor/src/ui/app-shell/task-shell.test.ts` | sandbox attempt failed with esbuild `spawn EPERM`; approved rerun passed `1` file / `5` tests |
| `node scripts/check-source-organization.mjs` | `pass` |
| `pnpm.cmd typecheck` | `pass` |

Review-Sylph also reported artifact whitespace check passed for the review file.

## Residual Risks / Deferred Debt

- This domain provides reusable DOM structure and class hooks only. Final task presentation, CSS polish, modal vs dedicated task view vs side panel policy, and Toolbox placement remain outside Domain B.
- The component generates default title/status ids from surface id and optional group. If Domain D mounts multiple shells for the same surface/group at once, Domain D should provide explicit `titleId` and `statusId`.
- Diagnostics summary is structurally separated but not independently labelled by the shell. Later UI polish can add a label option if diagnostics needs a named landmark.
- Concrete Atlas, Parameter, and Variant shell surface registry entries were not added here. The component can accept future `ShellSurfaceDefinition` values; adding concrete surfaces belongs to later task/view or integration domains.
- Domain B does not prove PSD Import task reachability, App Shell integration, or focused PSD e2e preservation. Those are Domain D/E responsibilities.
- The working tree contains parallel/non-B changes under `apps/editor/src/ui/explicit-psd-import/**`; Domain B did not inspect or review those as implementation output.

## Domain D Consumption

Domain D may consume Domain B output after Domain C also passes.

Expected Domain D consumption:

- Import or directly reference `createTaskShell(...)` from `apps/editor/src/ui/app-shell/task-shell.ts`.
- Provide the concrete task/view content from Domain C or later domains through the generic slots.
- Own task open/close/back state, App Shell wiring, PSD Import reachability, and any visual placement decisions.
- Preserve the Domain A boundary: no unresolved B/C merge conflicts should be pushed into Undine/root context.

## User-Decision Points

No immediate user decision is required for Domain B.

Future decisions remain outside Domain B:

- final modal/task-window/dedicated-view policy;
- final Toolbox placement;
- final Diagnostics / Evidence View and Codex / Automation View placement;
- broader quality-gate policy for production `data-testid` guard integration if Domain E defers narrow script integration.
