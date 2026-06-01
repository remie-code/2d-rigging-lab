# Wave28 Domain G Remediation R1 Gnome Report: Mobile Layer Tree Overflow

## Verdict

done

## Scope

- Target: `wave28-domain-g-remediation-mobile-layer-tree-overflow`
- Source scope used:
  - `apps/editor/src/ui/layer-tree/layer-tree-panel.ts`
  - `apps/editor/src/ui/layer-tree/layer-tree-panel.test.ts`
- Report scope used:
  - `discussion/implementation/waves/wave28/domain-g-remediation-mobile-layer-tree-overflow-gnome-report.md`

## Implementation Summary

- Constrained layer-tree workflow fields so wrapped labels, text inputs, and selects stay within their containing panel width.
- Added a two-column responsive workflow grid with `minmax(0, 1fr)` columns so mobile keeps the four layer-tree workflow forms reachable without horizontal overflow.
- Added width constraints and selected-label `title` updates to `<select>` controls, including the long texture selector that caused the mobile full-smoke failure.
- Added wrapping/flex behavior for layer-tree summary, part/drawable text, and row action buttons so long labels and controls do not force page width.
- Kept label-wrapped form controls and button text intact; no semantic workflow behavior changed.

## Tests / Verification

Passed:

- `pnpm.cmd exec vitest run apps/editor/src/ui/layer-tree/layer-tree-panel.test.ts`
  - 1 file / 3 tests passed.
- `pnpm.cmd typecheck`
  - root and editor typecheck passed.
- `pnpm.cmd test:e2e`
  - desktop smoke passed.
  - mobile smoke passed.
  - final smoke result passed.

Notes:

- Initial sandboxed shell setup failed with `windows sandbox: spawn setup refresh`, so verification commands were rerun with approved escalation.
- The prior `post-source-intake` mobile overflow gate is covered by the successful full `pnpm.cmd test:e2e` rerun.

## Source Organization / Dependency Notes

- No `index.ts` implementation logic was added.
- No dependency manifest, lockfile, package, fixture, e2e, workflow/session, or app-shell source changes were made by this remediation.
- No file picker, parser, image decode, asset I/O, renderer, pixel oracle, Cubism, or full drag-and-drop layer-tree work was introduced.

## Remaining Issues

- The earlier Domain G review also raised a separate Viewer Drawable Layer Evidence truthfulness concern. This remediation was scoped only to the mobile layer-tree overflow and did not change Viewer/runtime projection behavior.

## User-Decision Points

None.
