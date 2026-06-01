# Wave25 Domain F Gnome Implementation Report

## Status

implemented

## Changed Files

- `apps/editor/e2e/rig-control-persistence-smoke.mjs`
- `apps/editor/e2e/smoke-checks.mjs`
- `apps/editor/e2e/test-ids.mjs`
- `discussion/implementation/waves/wave25/domain-f-gnome-implementation-report.md`

## Implementation Notes

- Added a focused browser smoke for the project-defined Rig Controls workflow.
- The smoke uses the real Domain E UI forms and buttons, not internal workflow calls:
  - creates a parent `rotation2d` rig control;
  - creates a child `rotation2d` rig control;
  - binds the child rig control to the parent through the bind form;
  - binds `draw_body` to the child rig control through the bind form;
  - inspects Preview-side rig-control affected-target summary;
  - opens Viewer / Runtime and checks runtime rig-control evidence, hierarchy order, evaluated count, affected drawable summary, and validation diagnostics;
  - saves to browser-local project storage, reloads, loads, and verifies the authored rig controls, child binding, generated runtime/validation evidence, and Viewer / Runtime recomputation after load.
- Integrated the new smoke into the existing `editorSmokeViewports` desktop/mobile loop in `smoke-checks.mjs`, so existing source/PSD/binary/dynamics/viewer browser smoke still runs in the same suite.
- Added e2e helper IDs in `apps/editor/e2e/test-ids.mjs` to mirror the production `editorTestIds` rig-control entries and row helper.
- No production UI test id or aria tweaks were needed. Accessibility checks are covered in the new smoke by asserting panel naming, form aria labels, submit names, and form control labels.

## Verification Performed

Initial non-escalated shell commands failed with `windows sandbox: spawn setup refresh`; verification commands were run with escalation per tool policy.

| Check | Result |
|---|---|
| `node --check apps/editor/e2e/rig-control-persistence-smoke.mjs` | pass |
| `pnpm.cmd test:e2e` | initial fail after implementation because the smoke expected load to preserve the transient last-operation label; fixed the assertion to require persisted graph/evidence instead |
| `pnpm.cmd test:e2e` | pass; desktop smoke passed, mobile smoke passed |
| `pnpm.cmd typecheck` | pass |
| `pnpm.cmd run check:source` | pass |
| `pnpm.cmd run check:deps` | pass |
| `git diff --check -- apps/editor discussion/implementation/waves/wave25 discussion/implementation/reviews/wave25` | pass; Git emitted LF/CRLF working-copy warnings only |

## Residual Risks

- Browser e2e asserts user-visible semantic evidence and persisted JSON package contents; it does not use numeric matrix/pixel oracles. Numeric transform determinism remains covered by runtime and fixture tests from Domains B/D.
- The focused rig-control smoke is integrated into the full editor e2e runner rather than exposed as a separate package script, to avoid manifest changes in Domain F.
- Verification ran in the shared dirty Wave25 workspace, not a fresh checkout replay.

## Review Handoff Notes

- Review-Sylph should confirm that the new browser smoke truly uses UI form controls for create/bind and does not bypass through internal workflow APIs.
- Please inspect whether the e2e assertions are appropriately semantic and not overfitted to exact transform math.
- Please confirm no production UI aria/test-id edits were needed and that `apps/editor/e2e/test-ids.mjs` only mirrors existing production IDs.
