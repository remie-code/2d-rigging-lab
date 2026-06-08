# Wave55 Domain C Review: Task Window Overlay UX v0

> Role: independent Review-Sylph / clean context  
> Target: `wave55-task-window-overlay-ux-v0`  
> Verdict: `pass`

## Verdict

`pass`

Domain C changes satisfy the source-side task window overlay requirement for this bounded domain. The implementation no longer relies only on `role="dialog"`, focus, or `data-task-window-*` markers: it adds a fixed overlay host, backdrop layer, window frame, viewport containment CSS, and an internal scroll body, with component/static CSS tests covering those contracts as far as jsdom allows.

## Scope Reviewed

- `apps/editor/src/ui/app-shell/task-shell.ts`
- `apps/editor/src/ui/app-shell/task-shell.test.ts`
- `apps/editor/src/styles/editor.css` task-shell selector blocks
- Basis documents requested in the review assignment, including Wave55 plan, Domain A report/review, UX AC/test gap inventory, screen specs, and source file organization policy.
- Narrow compatibility reads of `apps/editor/src/app/editor-app.ts` and `apps/editor/src/ui/app-shell/app-shell.ts` for existing focus selector and mount context only.

## Blocking Findings

None.

## Non-Blocking Observations / Residual Risks

- `app-shell.ts` still appends the active task as a child of `.editor-workspace`, but `.editor-task-shell` is now `position: fixed` with `inset: 0`, so the task root is removed from normal document flow by CSS. Runtime proof that document height and scroll do not move remains a Domain F/G/H e2e responsibility.
- `editor-app.ts` still focuses `[data-task-window-scope="workspace"][data-task-window-region="window"]` without `preventScroll`. Because the selector still resolves to the fixed overlay root, the source-side design prevents the earlier below-the-fold focus jump. Runtime no-scroll verification should still be kept in `taskWindowUxFocused`.
- The overlay uses a full-viewport backdrop while keeping `aria-modal="false"` and without adding focus trap or inert behavior. That is acceptable for Domain C because Wave55 defers the final all-tool modal/non-modal policy, but G/F should verify the intended background interaction and tab-order behavior.
- CSS edits are narrow to task-shell blocks and responsive task-shell overrides. They should not obviously break the primary shell or mobile containment, but desktop/mobile geometry still needs browser evidence.

## Verification Reviewed

- Reviewed Orch-Sylph evidence:
  - `pnpm.cmd exec vitest run apps/editor/src/ui/app-shell/task-shell.test.ts`: pass, 10 tests after escalated rerun.
  - `git diff --check -- apps/editor/src/ui/app-shell/task-shell.ts apps/editor/src/ui/app-shell/task-shell.test.ts apps/editor/src/styles/editor.css`: pass with only CRLF working-copy warnings.
  - `pnpm.cmd run check:source`: pass.
  - `pnpm.cmd typecheck`: failed only on parallel/out-of-domain `apps/editor/src/ui/explicit-psd-import/explicit-psd-import-panel.ts` missing symbols; no Domain C file errors reported.
- Re-ran `git diff --check -- apps/editor/src/ui/app-shell/task-shell.ts apps/editor/src/ui/app-shell/task-shell.test.ts apps/editor/src/styles/editor.css`; result matched the provided evidence, with only CRLF working-copy warnings.
- Reviewed diff/stat for the three Domain C files: 176 insertions, 8 deletions across the exact allowed source/test/CSS files.

## Ownership Compliance

- Domain C stayed within the approved source scope: `task-shell.ts`, `task-shell.test.ts`, and task-shell CSS selector blocks in `editor.css`.
- No PSD-specific workflow logic was added to `task-shell.ts`; the explicit non-PSD generic test still covers Codex Automation and asserts PSD text is absent.
- No App Shell final routing, `editor-app.ts`, e2e registry, browser-native modal, OS-window behavior, or broad modal framework was introduced.
- Close, Back, Escape, and focus selector compatibility are preserved:
  - root remains `data-task-window-scope="workspace"` and `data-task-window-region="window"`;
  - Back/Close buttons retain `data-task-window-affordance`;
  - Escape close behavior remains guarded by available enabled close affordance.
- Source organization is compliant: no `index.ts` changes, no catch-all helper/source file, and tests remain focused on the task shell responsibility.

## User-Decision Points

Blocking user-decision points: none.

Deferred / non-blocking:

- Final task window policy: modal overlay vs non-modal floating window vs docked drawer vs dedicated view.
- Whether full backdrop plus `aria-modal="false"` should become inert/focus-trapped later or remain non-modal with explicit background interaction rules.
- Exact runtime gate placement for desktop/mobile scroll, viewport containment, and screenshot/bounding-box evidence.
