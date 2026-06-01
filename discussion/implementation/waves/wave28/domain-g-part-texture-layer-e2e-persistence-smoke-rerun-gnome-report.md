# Wave28 Domain G Gnome Rerun Report: Part / Texture / Layer E2E Persistence Smoke

## verdict

pass

## files changed

- `discussion/implementation/waves/wave28/domain-g-part-texture-layer-e2e-persistence-smoke-rerun-gnome-report.md`

No source or e2e test code changes were made in this rerun. Existing Wave28 upstream changes in `apps/editor/e2e/**` and UI/source files were preserved.

## tests / verification run

Passed:

- `node --check apps/editor/e2e/part-texture-layer-persistence-smoke.mjs`
  - Syntax check passed.
- `node apps/editor/e2e/part-texture-layer-persistence-smoke.mjs`
  - Focused desktop smoke passed.
  - Focused mobile smoke passed.
  - Final focused smoke result passed.
- `pnpm.cmd test:e2e`
  - Full editor desktop smoke passed.
  - Full editor mobile smoke passed.
  - Final full e2e smoke result passed.
- `git diff --check -- apps/editor/e2e discussion/implementation/waves/wave28/domain-g-part-texture-layer-e2e-persistence-smoke-rerun-gnome-report.md`
  - Passed with existing LF/CRLF working-copy warnings for `apps/editor/e2e/smoke-checks.mjs` and `apps/editor/e2e/test-ids.mjs`.

Skipped:

- `pnpm.cmd typecheck` was not run in this rerun because no TypeScript or UI source files were changed by this agent.

Note:

- Non-escalated shell commands initially failed with `windows sandbox: spawn setup refresh`; required verification commands were rerun with escalation and completed successfully.

## desktop / mobile evidence

Focused Domain G smoke:

- Desktop: `part-texture-layer-e2e: desktop smoke passed`; screenshot `png base64Length=105828`.
- Mobile: `part-texture-layer-e2e: mobile smoke passed`; screenshot `png base64Length=53888`.

The focused smoke asserts the reassigned drawable's Viewer evidence truthfully:

- `draw_body: part part_wave_28_face / texture tex_w28`

It no longer accepts `part none` after reassignment/save/load. It also verifies saved package state for:

- part hierarchy: `part_root` -> `part_wave_28_face`
- drawable membership: `draw_body` under `part_wave_28_face`
- texture assignment: `tex_w28`
- editor state: selected, locked, editor-hidden `draw_body`
- generated runtime and validation artifacts

## adjacent smoke / full e2e status

`pnpm.cmd test:e2e` passed after the upstream remediation changes:

- Desktop full smoke passed.
- Mobile full smoke passed.
- Previously blocking mobile layer-tree overflow did not recur.
- Integrated Wave28 part/texture/layer smoke was reached by the full editor smoke and completed.

Full e2e screenshot evidence reported by the runner:

- Desktop preview screenshot: `png base64Length=84316`
- Desktop drawable screenshot: `png base64Length=148868`
- Mobile preview screenshot: `png base64Length=52412`
- Mobile drawable screenshot: `png base64Length=39656`

## fixes applied

None in this rerun. Source-owned blockers had already been addressed upstream before this rerun.

## remaining issues

None for this Domain G rerun.

Residual scope note: this evidence remains semantic e2e evidence, not a full renderer or pixel oracle.

## user-decision points

None.
