# Wave 26 Domain E Completion Report

> Wave: Wave 26 `rig-control-keyform-viewer-hardening`  
> Domain: E `wave26-viewer-evidence-e2e-persistence-smoke`  
> Date: 2026-06-01  
> Orch-Sylph: L1 domain orchestrator  
> Gnome: `019e8153-490e-71f3-892c-b79537408028` / Gnome the 78th  
> Design / Development Review-Sylph: `019e815d-0e26-7e33-8404-800db48ea366` / Sylph the 79th  
> Test Adequacy Review-Sylph: `019e815d-66c8-7db2-9e22-655636b02348` / Sylph the 80th  
> Verdict: `pass`

## Summary

Domain E is `pass`.

The browser editor e2e rig-control smoke now proves the Wave 26 keyform workflow at the browser level:

- create parent and child project-defined `rotation2d` rig controls
- bind child rig control to the parent
- bind drawable `draw_body` to the child control
- add a `rigControl:angleDegrees` keyform for `param_preview_body_yaw`
- inspect Preview evidence and Viewer / Runtime semantic evidence
- save to browser-local project storage
- reload, load the saved project, reopen Viewer / Runtime, and recompute keyform-driven evidence

Orch-Sylph did not perform source implementation. Source/test implementation was delegated to Gnome in a separate context, and review was delegated to two separate Review-Sylph contexts.

## Files Changed For Domain E

Implementation:

- `apps/editor/e2e/rig-control-persistence-smoke.mjs`
- `apps/editor/e2e/test-ids.mjs`

Review artifacts:

- `discussion/implementation/reviews/wave26/wave26-domain-e-design-development-review.md`
- `discussion/implementation/reviews/wave26/wave26-domain-e-test-adequacy-review.md`

Completion artifact:

- `discussion/implementation/waves/wave26/domain-e-completion-report.md`

## Implementation Notes

Gnome hardened the existing rig-control persistence smoke rather than adding a separate runner. This preserves the existing desktop/mobile editor smoke path and keeps coverage connected to prior source intake, asset I/O boundary, dynamics, Viewer / Runtime, and rig-control workflows.

The e2e now:

- adds the angle keyform through the real Rig Controls panel form
- asserts `addKeyform committed`, operation log count `5`, generated runtime / validation artifacts, and keyform list projection
- sets the Viewer / Runtime parameter override to the authored key value
- asserts keyform-driven local/world angle evidence for the parent and child rig controls
- parses persisted `model/rig-controls.json` and `model/keyforms.json`
- verifies `addKeyform` operation log evidence, operation target IDs, child binding, keyform target, keyform parameter, evaluator/interpolation/composition, and persisted key state
- repeats Viewer / Runtime evidence checks after reload/load

The negative UX smoke is the initial unavailable path: no project rig controls, no rotation2d rig control available for keyform authoring, no angle keyforms, no Preview affected targets, Viewer unopened text, and disabled bind/keyform submit buttons.

## Review Results

Design / Development Compliance Review:

- Report: `discussion/implementation/reviews/wave26/wave26-domain-e-design-development-review.md`
- Verdict: `pass`
- Findings: none.
- Key checks: Domain E stayed inside `apps/editor/e2e/**`; no manifest or lockfile change; no runtime/operation/validator broad source fix; no Cubism, full renderer, pixel oracle, asset I/O, parser, image decode, archive, warp lattice evaluator, or physics claim; source organization and dependency policy respected.

Test Adequacy Review:

- Report: `discussion/implementation/reviews/wave26/wave26-domain-e-test-adequacy-review.md`
- Verdict: `pass`
- Findings: none.
- Key checks: browser create/bind/keyform/Preview/Viewer path covered; save/load inspects package JSON and operation log evidence; Viewer / Runtime recomputes after load; desktop/mobile smoke remains connected; existing source/PSD/binary/dynamics/viewer/rig-control smoke paths remain in the full runner.

Fix loops used: `0`.

## Verification

Gnome reported:

- `node --check apps/editor/e2e/rig-control-persistence-smoke.mjs` passed.
- `node --check apps/editor/e2e/test-ids.mjs` passed.
- `pnpm.cmd test:e2e` passed; desktop and mobile smoke passed.
- `pnpm.cmd typecheck` passed.
- `pnpm.cmd run check:source` passed.
- `pnpm.cmd run check:deps` passed.
- `git diff --check -- apps/editor/e2e` passed with LF/CRLF working-copy warnings only.

Design / Development Review-Sylph independently ran:

- Scoped diff review for the two Domain E e2e files.
- Manifest / lockfile diff check: no output.
- Forbidden-scope scan over the two changed files: no matches.
- `node --check` for both changed e2e files: passed.
- `pnpm.cmd typecheck`: passed.
- `pnpm.cmd run check:source`: passed.
- `pnpm.cmd run check:deps`: passed.
- `git diff --check -- apps/editor/e2e`: passed with LF/CRLF warnings only.
- `pnpm.cmd test:e2e`: passed; desktop and mobile smoke passed.

Test Adequacy Review-Sylph independently ran:

- `node --check apps/editor/e2e/rig-control-persistence-smoke.mjs`: passed.
- `node --check apps/editor/e2e/test-ids.mjs`: passed.
- `git diff --check -- apps/editor/e2e`: passed with LF/CRLF warnings only.
- `pnpm.cmd test:e2e`: passed; desktop and mobile editor smoke passed.
- `pnpm.cmd typecheck`: passed.

## Pass Evidence

- Browser e2e observes create rig control -> bind child rig control -> bind drawable -> add rig-control angle keyform -> Preview / Viewer inspection.
- Save/load preserves rig-control keyform and child binding, verified through browser-local project storage and package JSON.
- Viewer / Runtime surface recomputes semantic evidence after load by reopening Viewer / Runtime, applying the viewer override, and repeating local/world angle and affected drawable assertions.
- Negative UX is observed through the initial unavailable/disabled keyform path.
- Desktop and mobile smoke passed through the existing full editor e2e runner.
- Existing dynamics/source/PSD/binary/viewer/rig-control e2e paths remain in the same full runner and passed as part of `pnpm.cmd test:e2e`.
- Source organization policy is respected: no production source changes, no `index.ts` implementation logic, no catch-all file, and `check:source` passed.
- Dependency policy is respected: no manifest/lockfile changes and `check:deps` passed.

## Residual Risks

- The browser-level negative UX path is limited to initial unavailable/disabled state checks. Focused UI tests from Domain D cover invalid keyform rejection messages; a future hardening pass could add a browser invalid-submit diagnostic assertion if a stricter e2e rejection oracle is desired.
- Viewer evidence remains semantic text/runtime evidence, not a renderer or pixel oracle. This matches Wave 26 non-goals.
- Verification ran in the shared working tree, not a fresh checkout replay.

## User Decision Points

None.
