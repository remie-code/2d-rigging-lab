# Wave55 Domain C Report: Task Window Overlay UX v0

> Target: `wave55-task-window-overlay-ux-v0`  
> Role: Domain C Orch-Sylph  
> Verdict: `pass`  
> Scope: Task Window overlay shell/CSS と focused task shell tests。source implementation は Gnome に委譲し、レビューは独立 Review-Sylph に委譲した。

## 1. Verdict

`pass`

Domain C は、Task Shell を通常 document flow section ではなく viewport fixed overlay/window shell として成立させる source-side foundation を追加した。`role="dialog"`、focus、`data-task-window-*` のみを UX proof とせず、fixed overlay host、backdrop、window frame、internal scroll body、task-shell CSS の static proof を追加している。

Runtime desktop/mobile の geometry、scroll-jump、screenshot/bounding-box proof は Domain F/G/H の e2e gate で継続確認が必要だが、Domain C の所有境界内では pass 可能な実装・テスト・レビューが揃った。

## 2. Basis

参照・委譲 basis:

- `C:/Users/remie/.codex/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `.agents/skills/implementation-orchestration/SKILL.md`
- `discussion/implementation/orchestration/wave55-plan.md`
- `discussion/implementation/waves/wave55/wave55-domain-a-reset-boundary-ownership-contract-report.md`
- `discussion/implementation/reviews/wave55/wave55-domain-a-reset-boundary-ownership-contract-review.md`
- `discussion/design/screen-design/inventories/ui-reset-inventory-ux-ac-test-gaps.md`
- `discussion/design/screen-design/screens/authoring-workspace.md`
- `discussion/design/screen-design/screens/psd-import-task.md`
- `discussion/development_convention/source-file-organization-policy.md`

## 3. Delegation / Loop

- Implementation: Gnome (`Gnome the 34th`) に委譲。
- Review: independent Review-Sylph (`Sylph the 37th`) に委譲。
- Fix loops used: 0 / 2.
- Review verdict: `pass`.
- Review artifact: `discussion/implementation/reviews/wave55/wave55-domain-c-task-window-overlay-ux-v0-review.md`

Orch-Sylph は source implementation を直接行っていない。レポート作成と verification coordination のみ実施した。

## 4. Changed Files

Domain C changed files:

- `apps/editor/src/ui/app-shell/task-shell.ts`
- `apps/editor/src/ui/app-shell/task-shell.test.ts`
- `apps/editor/src/styles/editor.css`
- `discussion/implementation/reviews/wave55/wave55-domain-c-task-window-overlay-ux-v0-review.md`
- `discussion/implementation/waves/wave55/wave55-domain-c-task-window-overlay-ux-v0-report.md`

Other visible working-tree changes belong to other domains or earlier Wave55 docs and were not modified by Domain C.

## 5. Implementation Summary

Gnome changed the generic Task Shell so the root shell remains the existing focus/selector target while acting as an overlay host:

- root keeps `data-task-window-scope="workspace"` and `data-task-window-region="window"` for existing focus selector compatibility.
- root now carries overlay metadata: `data-task-window-overlay="host"`, `data-task-window-placement="fixed"`, and `data-task-window-scroll="internal"`.
- task shell adds an aria-hidden backdrop region.
- task shell adds an inner window frame region with header chrome and body/internal scroll region.
- diagnostics/content/state slots now render inside the internal scroll body.
- Close / Back buttons and Escape close behavior remain intact.

CSS changes are restricted to task-shell selector blocks:

- `.editor-task-shell` is now `position: fixed; inset: 0;` with overlay stacking and viewport padding.
- `.editor-task-shell__window` owns the visible window frame, max-height, and overflow containment.
- `.editor-task-shell__body` owns internal scrolling via `overflow: auto` and `overscroll-behavior: contain`.
- responsive task-shell overrides constrain mobile/max viewport height with `vh` / `dvh`.

## 6. Tests / Verification

Verification run by Domain C:

- `pnpm.cmd exec vitest run apps/editor/src/ui/app-shell/task-shell.test.ts`
  - Initial sandbox run failed with esbuild `spawn EPERM`.
  - Re-run with escalation passed: 1 file, 10 tests.
- `git diff --check -- apps/editor/src/ui/app-shell/task-shell.ts apps/editor/src/ui/app-shell/task-shell.test.ts apps/editor/src/styles/editor.css`
  - Passed with only CRLF working-copy warnings.
- `pnpm.cmd run check:source`
  - Passed.
- `pnpm.cmd typecheck`
  - Failed on parallel/out-of-domain `apps/editor/src/ui/explicit-psd-import/explicit-psd-import-panel.ts` missing symbols such as `findFactValue`, `formatPsdScopeLabel`, and `hideTechnicalField`.
  - No Domain C file errors appeared in the typecheck output.

Test coverage added in `task-shell.test.ts`:

- overlay/backdrop/window chrome/body region structure.
- internal scroll body presence even with sparse slots.
- existing Back / Close / Escape behavior.
- generic non-PSD task shell behavior.
- static CSS proof that `.editor-task-shell` is fixed viewport overlay and body owns scrolling.

## 7. Ownership Compliance

Domain C stayed inside Domain A ownership:

- No PSD-specific workflow/content edits.
- No `apps/editor/src/ui/app-shell/app-shell.ts` final routing or mount cutover edits.
- No `apps/editor/src/app/editor-app.ts` edits.
- No e2e registry edits.
- No legacy quarantine route/content edits.
- No browser-native modal, OS-window behavior, or full modal framework.
- No `index.ts` implementation logic.

## 8. Review Result

Review-Sylph verdict: `pass`.

Blocking findings: none.

Review confirmed:

- Domain C does not rely only on `role=dialog` / `data-task-window-*`.
- fixed overlay host, backdrop, window frame, viewport containment CSS, and internal scroll body are present.
- existing focus selector remains compatible with the root task shell.
- source organization is compliant.
- runtime browser evidence remains a downstream F/G/H responsibility, not a blocker for this source-side Domain C pass.

## 9. Residual Risks / Handoff

Residual risks for F/G/H:

- Runtime desktop/mobile no-scroll, viewport containment, document height delta, and `elementFromPoint()` stacking still need focused browser/e2e proof.
- `editor-app.ts` still uses `.focus()` without `preventScroll`; current C design makes the target fixed and viewport-contained, but F/G should verify no scroll jump in browser.
- The overlay uses a backdrop while keeping `aria-modal="false"` and without focus trap/inert background. This is acceptable for Wave55 v0, but final modal/non-modal policy remains deferred.
- G must consume this shell in final App Shell integration without reintroducing active task as a visible normal-flow section.

## 10. Consumption Status

Domain F may consume this as the source-side task window overlay contract for `taskWindowUxFocused` or equivalent runtime gate.

Domain G may consume this for App Shell primary cutover and final task-window wiring, with the residual runtime checks above kept as required integration/e2e proof.
