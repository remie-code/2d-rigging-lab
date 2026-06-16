# Wave76 Domain A Report: WebGL Clipping Feedback-Loop Fix

- Verdict: `pass`
- Domain: `wave76-webgl-clipping-feedback-loop-fix`
- Date: 2026-06-16
- Implementer: Gnome

## Basis Coverage Self-Report

| Basis item | Coverage |
|---|---|
| Wave76 plan 3.1 WebGL clipping feedback-loop | Implemented: mask framebuffer draws now unbind renderer sampler units before drawing into the mask target framebuffer. |
| Wave76 plan 7.1 first clipped drawable | Implemented and tested with newly-created mask target path. |
| Wave76 plan 7.1 repeated clipped drawables / mask target reuse | Implemented and tested with two clipped targets reusing one mask framebuffer texture. |
| Wave76 plan 7.1 visible inside mask / transparent outside | Real WebGL pixel proof was not practical in existing focused infrastructure; see blocker below. Fake-GL proof verifies the mask path remains active and feedback-loop-free. |
| Wave76 plan 7.1 existing WebGL primary path | Preserved; focused renderer tests still cover primary textured mesh draw and mask draw path. |
| Wave76 plan 7.1 Canvas2D fallback | Not touched; no `apps/editor` Canvas2D fallback files were modified by this Domain A work. |
| Wave76 plan 7.1 missing/unrenderable mask skip behavior | Preserved and tested in Fix Loop 1 with missing mask id, invisible mask drawable, and mask drawable whose texture source is absent. |
| Wave76 plan 9 expected areas | Changed only `packages/render-webgl2/src/webgl2-renderer.ts` and `packages/render-webgl2/src/webgl2-renderer.test.ts`. |
| Wave76 plan 15 no framebuffer feedback loop evidence | Implemented via fake-GL state guard that fails on draw-time framebuffer/texture feedback. |
| Wave76 plan 17-19 subagent/must-not scope | Followed; no renderer redesign, PSD clipping extraction, app-wide pixel oracle, new dependency, review artifact edit, or map edit. |

## Changed Files

- `packages/render-webgl2/src/webgl2-renderer.ts`
  - Added a small local sampler unbind helper.
  - `renderMaskTexture()` now clears renderer-used sampler units before binding/drawing to the mask framebuffer.
- `packages/render-webgl2/src/webgl2-renderer.test.ts`
  - Extended fake WebGL state tracking for active texture unit, texture bindings, current framebuffer, and framebuffer color attachment.
  - `drawElements()` now records and throws on framebuffer feedback-loop risk.
  - Added first-use and reuse coverage for clipped drawables.
  - Fix Loop 1: added missing/unrenderable mask skip regression coverage.
- `discussion/implementation/waves/wave76/wave76-domain-a-webgl-clipping-feedback-loop-fix-report.md`
  - This report.

## Implementation Summary

`renderMaskTexture()` now calls `unbindRendererSamplerTextures()` immediately after ensuring the mask target and before binding the mask framebuffer for drawing. The helper unbinds `TEXTURE_2D` from `TEXTURE0` and `TEXTURE1`, which are the only sampler units used by this renderer: source texture sampling uses `TEXTURE0`, and mask texture sampling uses `TEXTURE1`.

This covers both risky paths:

- First clipped drawable: `ensureMaskTarget()` creates the mask texture on `TEXTURE1`; the helper unbinds it before the framebuffer draw pass.
- Repeated clipped drawables: a previous clipped target sampled the mask texture on `TEXTURE1`; the helper unbinds it before reusing the same framebuffer texture for the next mask pass.

No clipping architecture, shader contract, draw ordering, missing mask behavior, texture cache semantics, or Canvas2D fallback behavior was changed.

## WebGL Feedback-Loop Proof

The fake WebGL context now models the state needed to catch this bug:

- current active texture unit;
- `TEXTURE_2D` binding per texture unit;
- current framebuffer;
- `COLOR_ATTACHMENT0` texture per framebuffer.

On every `drawElements()`, the fake context checks whether the currently bound framebuffer has a color attachment texture that is also bound to any texture unit. If so, it records `feedbackLoopViolations` and throws `WebGL framebuffer feedback loop detected.`

Focused cases:

- First clipped drawable test creates a fresh mask framebuffer texture and verifies no feedback-loop violations while drawing 3 expected draw calls.
- Reuse test renders two clipped drawables sharing one mask source and one reused mask framebuffer texture, verifies one framebuffer creation, 5 expected draw calls, and no feedback-loop violations.

These tests would fail if the mask target remained bound on `TEXTURE1` after first creation or after a clipped drawable sampled it.

## Missing / Unrenderable Mask Skip Proof

Fix Loop 1 added a focused regression test for the reviewer finding that skip behavior was claimed but not directly tested.

The new test builds one normal background drawable plus one clipped target whose mask list contains only invalid mask sources:

- a missing mask drawable id;
- an invisible mask drawable;
- a mask drawable whose texture source is absent.

Expected behavior is preserved:

- only the normal background drawable draws;
- no mask framebuffer is created;
- no `u_useMask = 1` clipped draw path is used;
- no fake-GL feedback-loop violation is recorded.

No production behavior was changed for this fix loop.

## Real WebGL Proof Status / Blocker

Status: blocked as impractical within Domain A constraints.

Exact blocker:

- `packages/render-webgl2` has only Node/Vitest fake-GL coverage and no browser/WebGL/readPixels test harness.
- Repository search found no existing `readPixels` proof harness.
- Existing Playwright setup is app-level PSD-import coverage under `apps/editor`; using it here would become a broader app E2E/pixel oracle path, which Wave76 Domain A explicitly forbids.
- Adding a new browser bundling harness or new dependency for focused package-level WebGL pixels would exceed the narrow implementation scope and dependency policy burden for this loop.

Fallback evidence is therefore the fake-GL draw-time feedback-loop detector plus focused renderer path tests.

## Validation Commands / Results

| Command | Result |
|---|---|
| `pnpm.cmd exec vitest run packages/render-webgl2/src/webgl2-renderer.test.ts` | Initial sandbox runs failed with `spawn EPERM` while starting esbuild; reruns with approved escalation passed. Initial loop: 1 file / 5 tests. Fix Loop 1: 1 file / 6 tests. |
| `pnpm.cmd typecheck` | Initial loop passed. Fix Loop 1 root typecheck failed in an unrelated dirty file outside Domain A: `packages/authoring-core/src/rig-control-mutations.ts(479,3): error TS2304: Cannot find name 'assertPartExists'.` |
| `node scripts/check-source-organization.mjs` | Passed. |
| `git diff --check -- packages/render-webgl2/src/webgl2-renderer.ts packages/render-webgl2/src/webgl2-renderer.test.ts discussion/implementation/waves/wave76/wave76-domain-a-webgl-clipping-feedback-loop-fix-report.md` | Passed for tracked renderer source/test files; Git reported CRLF normalization warnings only for renderer source/test files. The report is untracked, so this command does not include it in normal Git diff output. |
| `git -c core.autocrlf=false diff --check --no-index -- <empty-temp-file> discussion/implementation/waves/wave76/wave76-domain-a-webgl-clipping-feedback-loop-fix-report.md` | Passed for the untracked report file. |
| `rg -n "[ \t]+$" packages/render-webgl2/src/webgl2-renderer.test.ts discussion/implementation/waves/wave76/wave76-domain-a-webgl-clipping-feedback-loop-fix-report.md` | No trailing whitespace matches. |
| `rg -n readPixels packages apps scripts` | No existing focused `readPixels` harness found. |

## Fix Loop 1 Reviewer Finding Disposition

Finding: Test Adequacy review reported `needs_changes` because `packages/render-webgl2/src/webgl2-renderer.test.ts` lacked a focused negative regression for missing/unrenderable mask skip behavior.

Disposition: fixed.

Evidence:

- Added `skips clipped drawables when all mask sources are missing or unrenderable` in `packages/render-webgl2/src/webgl2-renderer.test.ts`.
- Focused render-webgl2 Vitest now passes with 6 tests.
- No production behavior change was required.

## Must-Not Compliance

- No renderer architecture redesign.
- No PSD clipping extraction or Photoshop/PSD pixel-perfect parity claim.
- No app-wide screenshot or pixel oracle E2E.
- No new dependency, manifest, or lockfile change.
- No Canvas2D fallback edit.
- No missing/unrenderable mask source behavior change.
- No review artifact edits under `discussion/implementation/reviews/wave76/**`.
- No map edits by this Domain A worker.
- No out-of-scope Mesh/Rig/Parts Tree/selection work by this Domain A worker.

## Residual Risks

- Real browser GPU pixel behavior is not directly proven in this loop because no focused renderer-level WebGL/readPixels harness exists.
- The fake-GL proof catches framebuffer feedback-loop state at draw time, but it does not validate shader pixel output.
- The helper intentionally unbinds both renderer-used sampler units before each mask pass; this is narrow and safe for current renderer code, but future sampler unit additions must update the helper.
- The shared worktree contained unrelated dirty files before and during this work; this report covers only the Domain A files listed above.

## Deferred Basis Items

- Focused real WebGL pixel proof for inside-mask visible / outside-mask transparent should be added when a package-level browser/readPixels harness exists or when orchestration explicitly permits a narrow harness.
- Isolate Selected mask opacity parity remains out of scope.

## User Decision Points

None.
