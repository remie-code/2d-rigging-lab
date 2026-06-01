# Wave 27 Domain F: Composition E2E Persistence Smoke

## Verdict

pass

## Summary

Domain F added focused browser e2e smoke coverage for the minimum Composition / Mask / Opacity workflow delivered by Domain E.

- The smoke creates a second drawable through existing Editor controls, commits a semantic mask relation, adds a drawable opacity keyform, and verifies Preview composition evidence.
- It opens Viewer / Runtime, applies the viewer parameter override, and verifies semantic mask relation evidence plus drawable opacity evidence.
- It saves to the existing browser project persistence store, reloads the page, loads the saved project, and reinspects Preview plus Viewer / Runtime evidence.
- The smoke is wired into the existing desktop and mobile editor e2e run, including horizontal overflow checks after the composition workflow and after reset.

## Files Changed

- `apps/editor/e2e/composition-persistence-smoke.mjs`
- `apps/editor/e2e/smoke-checks.mjs`
- `apps/editor/e2e/test-ids.mjs`
- `discussion/implementation/waves/wave27/wave27-domain-f-composition-e2e-persistence-smoke.md`

## Verification

- `node --check apps\editor\e2e\composition-persistence-smoke.mjs`
  - pass
- `pnpm.cmd test:e2e`
  - pass
  - desktop smoke passed
  - mobile smoke passed
  - server behavior: e2e started a local Vite server at `http://127.0.0.1:5173/` and closed it after the run
- `pnpm.cmd typecheck`
  - pass
- `git diff --check -- apps/editor/e2e discussion/implementation/waves/wave27`
  - pass; Git printed LF-to-CRLF working-copy warnings for edited e2e files only

## Review Result

Review-Sylph verdict: pass.

Review-Sylph found no blocking or non-blocking findings requiring fixes. The review confirmed browser persistence, Viewer / Runtime semantic evidence, desktop/mobile wiring, horizontal overflow checks, adjacent e2e non-regression coverage, dependency/source guard containment, and non-goal containment.

## Adjacent E2E Reruns

`pnpm.cmd test:e2e` runs the existing combined editor smoke, so the following adjacent workflows were rerun in both desktop and mobile viewports:

- preview smoke
- AI approval flow
- source intake and split-PNG compatibility smoke
- asset I/O boundary smoke
- drawable authoring
- mesh vertex edit
- layer controls
- dynamics persistence smoke
- viewer runtime persistence smoke
- rig control persistence smoke

## Local Server Behavior

The e2e runner did not reuse an external server in the recorded passing run. It started Vite on `http://127.0.0.1:5173/` and shut it down through the existing `startOrReuseEditorServer` flow.

## Remaining Issues

- No pixel clipping oracle was added. The smoke verifies semantic mask relation and opacity evidence only, matching Wave 27 non-goals.
- Runtime Diff affected-drawable membership is not asserted for composition because the required evidence is available through Viewer / Runtime snapshot and composition evidence surfaces.
- The broader worktree still contains upstream Wave 27 Domain A-E changes and reports; Domain F did not modify those source areas.

## User-Decision Points

None.

## Non-Goals Containment

No runtime, operation, authoring, validator, fixture, manifest, dependency, file picker, parser, image decode, full renderer, pixel oracle, or public `index.ts` implementation changes were made by Domain F.
