# Wave76 Domain A Test Adequacy Review

## Verdict

pass

Fix Loop 1 resolved the prior needs-change finding. Domain A now has focused fake-GL coverage for the WebGL framebuffer feedback-loop risk, first-use and repeated mask target paths, existing primary/mask render paths, and missing/unrenderable mask skip behavior.

Real WebGL pixel proof remains not verified, but the implementation report records a specific practical blocker and fallback evidence. This review does not treat inside-mask/outside-mask pixel behavior as proven.

## Basis Reviewed

- `discussion/implementation/orchestration/wave76-plan.md`
  - 3.1 WebGL clipping accepted decisions.
  - 7.1 WebGL clipping acceptance criteria.
  - 9 Domain A required tests / evidence.
  - 15 verification matrix.
  - 17-19 subagent, orchestration, and out-of-scope constraints.
- `discussion/implementation/orchestration/wave75-plan.md`
- `discussion/implementation/waves/wave75/wave75-final-integration-report.md`
- `discussion/implementation/reviews/wave75/wave75-final-clean-integration-review.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/operation-policy.md`
- `discussion/implementation/waves/wave76/wave76-domain-a-webgl-clipping-feedback-loop-fix-report.md`
- `packages/render-webgl2/src/webgl2-renderer.ts`
- `packages/render-webgl2/src/webgl2-renderer.test.ts`
- Current Domain A diffs for renderer source/test and Domain A report.

## Fix Loop 1 Disposition

Prior finding: `packages/render-webgl2/src/webgl2-renderer.test.ts` lacked a focused negative regression for missing/unrenderable mask skip behavior.

Disposition: fixed.

Evidence:

- New test `skips clipped drawables when all mask sources are missing or unrenderable` exists at `packages/render-webgl2/src/webgl2-renderer.test.ts:153`.
- The test includes a missing mask drawable id, an invisible mask drawable, and a mask drawable whose texture source is absent (`webgl2-renderer.test.ts:163-173`).
- The test asserts only one normal background draw, no mask framebuffer creation, no `u_useMask = 1`, and no fake-GL feedback-loop violations (`webgl2-renderer.test.ts:181-192`).
- The source branch under test remains the existing skip path when `maskDrawables.length === 0` (`webgl2-renderer.ts:83-84`).
- No production behavior change was required for Fix Loop 1.

## Findings

No blocking findings.

No needs-change findings.

## Test Adequacy Matrix

| Requirement / risk | Status | Evidence |
|---|---:|---|
| Fake GL tracks active texture unit | pass | `activeTextureUnit` is stored at `webgl2-renderer.test.ts:300` and updated in `activeTexture()` at `:412`. |
| Fake GL tracks texture bindings by texture unit | pass | `textureBindingsByUnit` is stored at `webgl2-renderer.test.ts:302` and updated in `bindTexture()` at `:418`. |
| Fake GL tracks current framebuffer | pass | `currentFramebuffer` is stored at `webgl2-renderer.test.ts:301` and updated in `bindFramebuffer()` at `:456`. |
| Fake GL tracks framebuffer color attachment | pass | `colorAttachmentByFramebuffer` is stored at `webgl2-renderer.test.ts:303` and updated in `framebufferTexture2D()` at `:474`. |
| `drawElements` fails/records violation when current framebuffer attachment is bound to any texture unit | pass | `drawElements()` calls `detectFramebufferFeedbackLoop()` at `webgl2-renderer.test.ts:535`; the detector records `feedbackLoopViolations` and throws at `:551-573`. |
| First clipped drawable / newly-created mask target | pass | Test at `webgl2-renderer.test.ts:100-121` asserts no violations, one framebuffer, and three draw calls. |
| Repeated clipped drawables / mask target reuse | pass | Test at `webgl2-renderer.test.ts:124-150` asserts no violations, one framebuffer, and five draw calls. |
| Existing WebGL primary textured draw path remains active | pass | Test at `webgl2-renderer.test.ts:34-48` covers blend setup, texture upload, draw call, and vertex buffer upload. |
| Positive mask framebuffer path remains active | pass | Test at `webgl2-renderer.test.ts:63-97` verifies framebuffer use, `u_useMask = 1`, expected draw count, and no feedback-loop violations. |
| Missing/unrenderable mask skip behavior remains guarded | pass | Fix Loop 1 test at `webgl2-renderer.test.ts:153-192` covers missing id, invisible mask, absent texture source, no framebuffer creation, no mask use, and no violations. |
| Real WebGL inside-mask visible / outside-mask transparent pixel proof | deferred / not verified | Plan requires focused proof where practical. Domain A report records a blocker at `wave76-domain-a-webgl-clipping-feedback-loop-fix-report.md:84-96`; reviewer search found no existing `readPixels` harness. |
| Focused render-webgl2 tests | pass | Re-run passed: `pnpm.cmd exec vitest run packages/render-webgl2/src/webgl2-renderer.test.ts`, 1 file / 6 tests. |
| Root typecheck evidence for current worktree | pass | Reviewer re-run of `pnpm.cmd typecheck` passed in the current worktree. This differs from the Domain A report's recorded earlier Fix Loop 1 failure in an unrelated dirty file. |

## Validation Run Or Inspected

| Check | Result |
|---|---|
| `pnpm.cmd exec vitest run packages/render-webgl2/src/webgl2-renderer.test.ts` | Initial sandbox run failed with esbuild `spawn EPERM`; approved escalated rerun passed 6/6 tests. |
| `pnpm.cmd typecheck` | Passed in the current worktree. |
| `node scripts/check-source-organization.mjs` | Passed. |
| `node scripts/check-dependencies.mjs` | Passed. |
| `git diff --check -- packages/render-webgl2/src/webgl2-renderer.ts packages/render-webgl2/src/webgl2-renderer.test.ts` | Passed; CRLF normalization warnings only. |
| `rg -n "[ \t]+$" packages/render-webgl2/src/webgl2-renderer.test.ts discussion/implementation/waves/wave76/wave76-domain-a-webgl-clipping-feedback-loop-fix-report.md discussion/implementation/reviews/wave76/wave76-domain-a-test-adequacy-review.md` | No trailing whitespace matches. |
| `rg -n "readPixels" packages apps scripts` | No existing focused `readPixels` harness found. |
| Current Domain A diff | Reviewed; Fix Loop 1 changes are test/report only. |

## Residual Risks / Non-Blockers

- Real browser/GPU pixel output is still unverified. The report's blocker is specific and plausible under current package infrastructure, but Wave76 final reporting must not claim inside-mask/outside-mask pixel proof as passed.
- The sampler unbind helper covers the renderer's current sampler units, `TEXTURE0` and `TEXTURE1`. If future renderer code adds sampler units, tests or helper scope must be updated.
- The Domain A report still records that Fix Loop 1 root typecheck failed in an unrelated dirty file. This review's later rerun passed, so no Domain A action is needed, but integrator reporting should use the latest wave-level validation result.

## User-Decision Points

None.
