# Wave 16 Domain D Review: Editor Layer Controls UI

> Wave: `drawable-layer-controls-and-visibility-authoring`
> Domain: `wave16-editor-layer-controls-ui`
> Date: 2026-05-30

## Verdict

`pass`

Independent Review-Sylph found no blocking or medium findings for Domain D.

## Review Basis

- `discussion/implementation/orchestration/wave16-plan.md`
- `discussion/implementation/waves/wave16/wave16-editor-layer-workflow-state-completion.md`
- `discussion/implementation/reviews/wave16/wave16-editor-layer-workflow-state-review.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/design/module-contracts/runtime-core-contract.md`
- Changed Domain D files listed in the completion report.
- Focused verification results from the Domain D loop.

## Findings

### Open

None.

### Notes

1. Minor a11y refinement opportunity: visibility controls currently use action labels (`Hide` / `Show`) with `aria-pressed`. This is acceptable for the current focused UI scope and tests, but future a11y hardening may prefer an explicit current-state label.

## Lane Review

| Lane | Result | Notes |
|---|---|---|
| Product Workflow | pass | Drawable list rows expose runtime visibility toggle and move up/down controls. |
| Runtime Truthfulness | pass | UI delegates to Domain C workflow actions and does not synthesize operation payloads or preview semantics. Preview updates continue through runtime-backed workflow projection. |
| Operation Integrity | pass | UI passes only drawable ID and move direction to callbacks; `setDrawOrder` / `setRuntimeVisibility` operation requests remain owned by Domain C/session code. |
| UI / Accessibility | pass | Controls have stable test IDs and accessible labels, disabled states cover first/last/single rows, and controls are kept in the existing responsive drawable list. |
| Development Compliance | pass | Changes stayed in the Domain D write scope; no forbidden package or E2E edits; no `index.ts` or catch-all growth. |
| Test Adequacy | pass | Focused panel and app-shell tests cover rendering, callback wiring, preview summary after visibility action, boundary disabled states, and same-shell preview/authoring presence. |
| Determinism | pass | Button enabled state and test IDs are derived from deterministic Domain C view-model state. |

## Verification Reviewed

- `pnpm.cmd exec vitest run apps/editor/src/ui/drawable-authoring/drawable-authoring-panel.test.ts apps/editor/src/ui/app-shell/app-shell.test.ts apps/editor/src/editor-state/editor-test-ids.test.ts` passed 3 files / 17 tests.
- `pnpm.cmd typecheck` passed.
- `pnpm.cmd run check:source` passed.
- `git diff --check --` for Domain D target paths passed with LF/CRLF warnings only.

## Remaining Issues

- Browser/mobile visual smoke and full E2E workflow are intentionally assigned to Domain E.

## User-Decision Points

None.
