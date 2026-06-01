# Wave 27 Domain F Review: Composition E2E Persistence Smoke

## Verdict

pass

Clean Review-Sylph inspected the Wave 27 plan, Domain E handoff, changed e2e files/diff, current worktree status, and verification output. I did not edit source or e2e implementation files; this review report is the only file written by this review pass.

## Findings By Lane

No blocking or non-blocking findings requiring fixes.

| Lane | Verdict | Evidence |
|---|---|---|
| Browser Persistence | pass | The smoke creates a target drawable, commits `setMaskRelation`, adds a drawable opacity keyform, saves, inspects browser-local persisted package files (`model/drawables.json`, `model/masks.json`, `model/keyforms.json`), reloads, loads, and reasserts state in `apps/editor/e2e/composition-persistence-smoke.mjs:29`, `:62`, `:66`, `:70`, `:77`, `:229`, `:260`. |
| Viewer / Runtime Evidence | pass | Viewer is opened before save and after load, the viewer slider is set, and the test asserts semantic mask relation evidence, drawable opacity evidence, runtime diff, and diagnostics without a pixel oracle in `apps/editor/e2e/composition-persistence-smoke.mjs:57`, `:72`, `:197`. This matches Wave 27 Domain F pass criteria in `discussion/implementation/orchestration/wave27-plan.md:327` and `:348`. |
| UI / Accessibility / Mobile Layout | pass | The smoke is wired into the existing desktop/mobile viewport run in `apps/editor/e2e/smoke-checks.mjs:47` and `:170`, with horizontal overflow checks after composition and reset at `:174` and `:177`. The composition smoke checks panel reachability and basic labels/names in `apps/editor/e2e/composition-persistence-smoke.mjs:404` and `:461`. Accessibility coverage is intentionally basic; it does not replace a full accessibility-tree audit. |
| Non-regression | pass | `pnpm.cmd test:e2e` reran the existing combined editor smoke, including preview, AI approval, source intake/split PNG, asset I/O boundary, drawable, mesh vertex, layer controls, dynamics, viewer runtime, rig control, and the new composition smoke in `apps/editor/e2e/smoke-checks.mjs:71` through `:177`. |
| Development Compliance | pass | Domain F diff is limited to e2e/test-id wiring plus its report. No manifest or lockfile diff was present. `check:source` and `check:deps` passed. Public `index.ts` files were not changed by Domain F. |
| Test Adequacy | pass | The e2e covers visible authoring flow, Preview evidence, Viewer evidence before save, persisted package contents, browser save/load, and Viewer reinspection after load. It relies on semantic evidence and persisted project data, not only implementation-internal state. |
| Non-goals Containment | pass | I found no new renderer, pixel oracle, file picker, parser, image decode, external dependency, Cubism compatibility, or broad runtime/operation/validator/editor source edit in the Domain F diff. A forbidden-scope scan only found pre-existing image decode helper text in `apps/editor/e2e/smoke-checks.mjs` outside the Domain F hunks. |
| Orchestration Compliance | pass | The Wave 27 plan requires Gnome implementation and separate Review-Sylph review (`discussion/implementation/orchestration/wave27-plan.md:42`, `:394`). This review was run as a clean-context Review-Sylph from the Orch-Sylph handoff, and I found no evidence that Orch-Sylph implemented source directly. |

## Verification

- `node --check apps\editor\e2e\composition-persistence-smoke.mjs`
  - pass
- `pnpm.cmd test:e2e`
  - pass
  - observed output: local editor server started at `http://127.0.0.1:5173/`; desktop smoke passed; mobile smoke passed; final smoke passed
- `pnpm.cmd typecheck`
  - pass
- `git diff --check -- apps/editor/e2e discussion/implementation/waves/wave27`
  - pass; Git printed LF-to-CRLF working-copy warnings for `apps/editor/e2e/smoke-checks.mjs` and `apps/editor/e2e/test-ids.mjs`
- `pnpm.cmd run check:source`
  - pass
- `pnpm.cmd run check:deps`
  - pass
- `git diff --name-status -- package.json pnpm-lock.yaml pnpm-workspace.yaml apps/editor/package.json packages/*/package.json`
  - no output; no manifest/lockfile diff

## Residual Risks

- No pixel clipping oracle or full renderer was added. This is expected for Wave 27, which treats clipping as semantic mask relation evidence.
- The e2e runner logs preview/drawable screenshot lengths, not the composition screenshot returned by the new smoke. Composition behavior is still enforced by assertions.
- The shared worktree contains upstream Wave 27 Domain A-E changes; this review treats them as basis, not Domain F changes.

## Fixes Required

None.

## User-Decision Points

None.
