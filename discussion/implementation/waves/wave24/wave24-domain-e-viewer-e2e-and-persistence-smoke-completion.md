# Wave 24 Domain E Completion: Viewer E2E and Persistence Smoke

> Target: `wave24-viewer-e2e-and-persistence-smoke`
> Date: 2026-06-01
> Role: Gnome implementation agent
> Status: `pass`

## Summary

Domain E is `pass`.

The implementation adds a focused browser smoke helper for the in-editor `Viewer / Runtime` surface and wires it into the existing desktop/mobile editor E2E loop. The smoke follows the required user-visible path: browser-local save, page reload, browser-local load, open `Viewer / Runtime`, inspect the recomputed viewer snapshot/diff/diagnostics, apply a viewer parameter override, and confirm the same parameter can drive the existing editor preview without leaking viewer session state into preview state.

No editor UI implementation was changed. The only test-id change is the E2E mirror of Domain B's already-added viewer test IDs and `createViewerParameterControlTestId` helper.

## Changed Files

E2E:

- `apps/editor/e2e/viewer-runtime-smoke.mjs`
- `apps/editor/e2e/smoke-checks.mjs`
- `apps/editor/e2e/test-ids.mjs`

Completion report:

- `discussion/implementation/waves/wave24/wave24-domain-e-viewer-e2e-and-persistence-smoke-completion.md`

## Pass Evidence

- Viewer workflow passes in the existing desktop and mobile smoke loop.
- Save/load happens before opening the viewer surface, and the smoke asserts the loaded package state plus recomputed viewer snapshot evidence after reload.
- Viewer snapshot summary is observable after load, including `surface: viewer`, snapshot ID, package ID/revision, parameter count, override count, and runtime state evidence refs.
- Viewer parameter override is observable through the browser slider for `param_preview_body_yaw`; the snapshot summary updates to `viewerOverride`, runtime diff changes, and affected drawable evidence includes `draw_body`.
- Viewer diagnostics are observable through the `Validation Diagnostics` section, including report ID, check count, and `No diagnostics`.
- Preview/viewer equivalence evidence is kept semantic and browser-visible: the viewer override does not mutate preview state, then the same parameter value applied to Preview changes the preview drawable while the Viewer diff reports `draw_body` as affected. This avoids a pixel oracle.
- Existing source/PSD/binary/dynamics E2E paths remain in the same full smoke run and passed.
- Desktop/mobile accessibility basics are checked for the viewer panel name, open button `aria-expanded`, close/reset button names, and viewer slider accessible name.
- Desktop/mobile horizontal overflow checks include the viewer surface and post-viewer reset.

## Verification

| Check | Result |
|---|---|
| `pnpm.cmd test:e2e` | pass; desktop smoke passed, mobile smoke passed |
| `pnpm.cmd typecheck` | pass |
| `pnpm.cmd run check:source` | pass |
| `pnpm.cmd run check:deps` | pass |
| `git diff --check -- apps/editor discussion/implementation/waves/wave24 discussion/implementation/reviews/wave24` | pass; Git emitted LF/CRLF working-copy warnings only |

Sandbox note: non-escalated PowerShell commands failed in this workspace with `windows sandbox: spawn setup refresh`; important reads and verification commands were rerun with tool-policy escalation.

## Forbidden Scope Confirmation

- No broad editor implementation changes.
- No runtime, operation, validator, package, fixture, or public `index.ts` implementation changes.
- No asset I/O, file picker, parser, image decode, archive, actual upload, or real asset byte work.
- No external dependency, package manifest, or lockfile changes.
- No Cubism SDK/Core, Cubism Viewer compatibility, Cubism Physics compatibility, or pixel-renderer oracle claims.
- No UI test-id or aria source tweaks were made. `apps/editor/e2e/test-ids.mjs` only mirrors Domain B's existing source test IDs for browser smoke access.

## Residual Risks

- The browser smoke asserts semantic UI evidence and session behavior, not exact runtime numeric values. Runtime numeric determinism remains covered by Domain A/D focused tests and fixtures.
- Domain C viewer-specific diagnostics for missing/stale viewer evidence are not directly surfaced by Domain B's current UI path, which uses the existing editor incremental validation report. The E2E verifies the observable diagnostics section and report presence.
- The E2E checks preview/viewer alignment through shared parameter behavior and affected drawable evidence, not through a pixel or full renderer oracle.
- Verification ran in the shared uncommitted workspace containing upstream Domain A-D changes and review artifacts.

## User Decision Points

None.
