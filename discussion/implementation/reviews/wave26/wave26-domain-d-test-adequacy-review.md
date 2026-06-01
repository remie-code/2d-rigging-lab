# Wave 26 Domain D Test Adequacy Review

> Wave: Wave 26 `rig-control-keyform-viewer-hardening`  
> Domain: D `wave26-editor-rig-control-keyform-authoring-ux`  
> Lane: Test Adequacy Review  
> Reviewer: Review-Sylph, clean context  
> Verdict: `pass`

## Scope Reviewed

Reviewed the Domain D editor-focused tests and relevant implementation under:

- `apps/editor/src/editor-session/session-adapter.test.ts`
- `apps/editor/src/editor-state/editor-view-model.test.ts`
- `apps/editor/src/editor-workflow/workflow-controller.test.ts`
- `apps/editor/src/ui/rig-control-panel/rig-control-panel.test.ts`
- corresponding implementation files in `apps/editor/src/editor-session`, `apps/editor/src/editor-state`, `apps/editor/src/editor-workflow`, and `apps/editor/src/ui/rig-control-panel`

Review basis included the Wave26 plan, current capability/backlog documents, Wave25 final and integration review records, Wave26 Domain A/B/C completion reports, source file organization policy, operation contract, and validator contract.

## Findings

No blocking, high, medium, or low test-adequacy findings.

## Evidence Reviewed

Positive UI authoring path is covered at focused UI level:

- `apps/editor/src/ui/rig-control-panel/rig-control-panel.test.ts:113` proves the Rig Controls panel submits an `addRigControlAngleKeyform` command from an existing authored parameter, an existing `rotation2d` rig control, a key value, and an angle patch.
- `apps/editor/src/ui/rig-control-panel/rig-control-panel.ts:175` through `apps/editor/src/ui/rig-control-panel/rig-control-panel.ts:231` implements the minimal form and dispatches the parsed command through the existing workflow callback.

Operation/session commit evidence is covered:

- `apps/editor/src/editor-session/session-adapter.test.ts:263` proves the editor session adapter commits `addKeyform` for `rigControl:angleDegrees`, reloads the package, and exposes runtime diff / keyform sample evidence.
- `apps/editor/src/editor-session/rig-control-command.ts:92` through `apps/editor/src/editor-session/rig-control-command.ts:126` builds the GUI `addKeyform` operation request with `target.kind = "rigControl"` and `targetProperty = "angleDegrees"`.

State, view-model, workflow, and save/load restoration are covered:

- `apps/editor/src/editor-state/editor-view-model.test.ts:508` proves authored rig-control angle keyforms are projected into semantic state and the Rig Controls view model.
- `apps/editor/src/editor-state/editor-state-projections.ts:101` through `apps/editor/src/editor-state/editor-state-projections.ts:118` and `apps/editor/src/editor-state/editor-state-projections.ts:153` through `apps/editor/src/editor-state/editor-state-projections.ts:169` project package keyform sets on load and after commits.
- `apps/editor/src/editor-workflow/workflow-controller.test.ts:908` proves create rig control -> bind drawable child -> add angle keyform -> open Viewer / Runtime -> set viewer parameter -> save/load -> reopen Viewer / Runtime, with restored `localAngleLabel` / `worldAngleLabel` evidence.

Deterministic negative UI handling is covered at the Domain D level:

- `apps/editor/src/ui/rig-control-panel/rig-control-panel.test.ts:152` covers no eligible authored parameter.
- `apps/editor/src/ui/rig-control-panel/rig-control-panel.test.ts:178` covers no eligible `rotation2d` rig control.
- `apps/editor/src/ui/rig-control-panel/rig-control-panel.test.ts:205` covers missing selection, unsupported non-`rotation2d` target selection, and non-finite numeric input.
- `apps/editor/src/ui/rig-control-panel/rig-control-panel.ts:598` through `apps/editor/src/ui/rig-control-panel/rig-control-panel.ts:638` implements deterministic validation messages for those paths.

Preview / Viewer observability is sufficient for Domain D and leaves the browser smoke to Domain E as planned:

- `apps/editor/src/ui/rig-control-panel/rig-control-panel.test.ts:248` covers panel-visible authored angle keyform evidence.
- `apps/editor/src/ui/rig-control-panel/rig-control-panel.ts:314` through `apps/editor/src/ui/rig-control-panel/rig-control-panel.ts:377` displays Preview and Viewer rig-control evidence or explicit “open Viewer / Runtime” diagnostics.
- `apps/editor/src/editor-workflow/workflow-controller.test.ts:927` through `apps/editor/src/editor-workflow/workflow-controller.test.ts:992` covers workflow-level Viewer / Runtime recomputation before and after save/load.

Regression coverage remains appropriate for a Domain D focused test lane:

- Existing create/bind rig-control workflow remains covered at `apps/editor/src/editor-workflow/workflow-controller.test.ts:837`.
- Dynamics, source intake, PSD metadata, binary refs, rights, duplicate rejection, and runtime-source hygiene remain represented by existing tests such as `apps/editor/src/editor-session/session-adapter.test.ts:75`, `apps/editor/src/editor-session/session-adapter.test.ts:468`, `apps/editor/src/editor-session/session-adapter.test.ts:555`, `apps/editor/src/editor-session/session-adapter.test.ts:603`, `apps/editor/src/editor-session/session-adapter.test.ts:789`, `apps/editor/src/editor-session/session-adapter.test.ts:832`, `apps/editor/src/editor-state/editor-view-model.test.ts:180`, `apps/editor/src/editor-workflow/workflow-controller.test.ts:99`, `apps/editor/src/editor-workflow/workflow-controller.test.ts:248`, and `apps/editor/src/editor-workflow/workflow-controller.test.ts:1020`.

## Adequacy Assessment

The focused editor tests prove the Domain D minimum workflow without taking over Domain E:

- UI can produce the intended rig-control angle keyform command.
- Session/workflow layers commit the operation through operation-core and preserve operation/runtime evidence.
- State/view-model projections expose authored keyforms.
- Save/load restores authored rig-control keyform state and Viewer / Runtime projection.
- Deterministic UI rejection messages cover the relevant editor-side invalid states.
- Existing editor workflows remain protected by focused regression tests in the same four files.

Additional e2e is not required inside Domain D. Per `discussion/implementation/orchestration/wave26-plan.md`, Domain E owns desktop/mobile browser smoke for create rig control -> bind child -> add keyform -> Preview / Viewer inspection -> save/load -> Viewer reinspection and at least one negative UX path.

## Verification Commands

- `pnpm.cmd exec vitest run apps/editor/src/editor-session/session-adapter.test.ts apps/editor/src/editor-state/editor-view-model.test.ts apps/editor/src/editor-workflow/workflow-controller.test.ts apps/editor/src/ui/rig-control-panel/rig-control-panel.test.ts`
  - Pass: 4 files / 58 tests.
- `pnpm.cmd typecheck`
  - Pass.
- `pnpm.cmd run check:source`
  - Pass: Source organization guard passed.
- `git diff --check -- apps/editor/src/editor-session apps/editor/src/editor-state apps/editor/src/editor-workflow apps/editor/src/ui/rig-control-panel`
  - Pass with LF/CRLF working-copy warnings only.

## Remaining Issues

No Domain D test-adequacy issues remain.

Bounded residual risk: the focused tests are not a browser-level proof of actual DOM interaction across desktop/mobile, nor a final e2e persistence smoke. That is intentional and aligned with the Wave26 plan assigning e2e persistence smoke to Domain E.

## User-Decision Points

None.
