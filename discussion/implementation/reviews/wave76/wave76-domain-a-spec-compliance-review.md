# Wave76 Domain A Spec Compliance Review

## Verdict

pass

No blocking or needs-change findings were found for Domain A. The WebGL/readPixels pixel proof remains absent, but the implementation report gives an exact blocker that matches the Wave76 Domain A early-escape condition, and the fallback fake-GL evidence is focused on the parent bug.

## Basis Reviewed

- `discussion/implementation/orchestration/wave76-plan.md`, especially sections 3.1, 7.1, 9, 15, 17, 18, and 19.
- `discussion/implementation/orchestration/wave75-plan.md`
- `discussion/implementation/waves/wave75/wave75-final-integration-report.md`
- `discussion/implementation/reviews/wave75/wave75-final-clean-integration-review.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/operation-policy.md`
- `discussion/implementation/waves/wave76/wave76-domain-a-webgl-clipping-feedback-loop-fix-report.md`
- `packages/render-webgl2/src/webgl2-renderer.ts`
- `packages/render-webgl2/src/webgl2-renderer.test.ts`
- Supporting source inspection of `packages/render-webgl2/src/webgl2-shaders.ts` and `apps/editor/src/workspace/canvas/canvas-renderer.ts`

## Requirement Classification

| Requirement | Classification | Evidence / notes |
|---|---:|---|
| Fix likely WebGL mask framebuffer feedback loop | implemented | `renderMaskTexture()` now calls `unbindRendererSamplerTextures()` after `ensureMaskTarget()` and before binding/drawing to the mask framebuffer: `packages/render-webgl2/src/webgl2-renderer.ts:119` through `:126`. |
| Do not draw into a framebuffer while its attached mask target texture is bound to a sampler unit | implemented | The helper unbinds renderer sampler units `TEXTURE0` and `TEXTURE1` before mask framebuffer draw: `packages/render-webgl2/src/webgl2-renderer.ts:207` through `:212`. The fake GL detector records texture bindings by active unit and throws on draw when the current framebuffer attachment is bound to any tracked unit: `packages/render-webgl2/src/webgl2-renderer.test.ts:507` through `:529`. |
| Guard holds for first clipped drawable / newly-created mask target | implemented | `ensureMaskTarget()` creates and attaches the mask texture on `TEXTURE1`: `packages/render-webgl2/src/webgl2-renderer.ts:145` through `:196`; the first-use test covers the newly-created mask target path and expects no feedback violations: `packages/render-webgl2/src/webgl2-renderer.test.ts:100` through `:122`. |
| Guard holds for repeated clipped drawables / mask target reuse | implemented | Reused target path returns the existing mask target at `packages/render-webgl2/src/webgl2-renderer.ts:145` through `:152`; the reuse test covers two clipped targets sharing one mask framebuffer texture and expects no feedback violations: `packages/render-webgl2/src/webgl2-renderer.test.ts:124` through `:150`. |
| A clipped drawable remains visible inside an opaque overlapping mask in WebGL | implemented, proof partially deferred by plan | The WebGL shader keeps masked pixels by multiplying target color by sampled mask alpha: `packages/render-webgl2/src/webgl2-shaders.ts:44` through `:52`, and the renderer binds `u_useMask=1` for clipped draws: `packages/render-webgl2/src/webgl2-renderer.ts:235` through `:239`. A real WebGL pixel proof was not run; see "Real WebGL Proof Assessment". |
| The clipped drawable is absent or transparent outside the mask | implemented, proof partially deferred by plan | Same shader path multiplies by `maskAlpha`, which becomes transparent where mask alpha is zero: `packages/render-webgl2/src/webgl2-shaders.ts:47` through `:52`. Pixel-level outside-mask proof is deferred under the same early escape. |
| Existing WebGL primary path remains active | implemented | `renderCanvasProjection()` still attempts `drawDrawableStackWithWebGl()` before Canvas2D fallback: `apps/editor/src/workspace/canvas/canvas-renderer.ts:115` through `:129`. The focused renderer test for the non-clipped textured mesh remains present: `packages/render-webgl2/src/webgl2-renderer.test.ts:34` through `:47`. |
| Canvas2D fallback behavior is not regressed | implemented | No `apps/editor` files were changed for Domain A. The fallback path still draws with Canvas2D when WebGL drawing is unavailable: `apps/editor/src/workspace/canvas/canvas-renderer.ts:125` through `:129`, and the Canvas2D mask skip/draw path remains at `apps/editor/src/workspace/canvas/canvas-renderer.ts:250` through `:283`. |
| Missing or unrenderable mask sources keep existing skip behavior | implemented | The WebGL renderer still filters mask sources to renderable drawables with available textures, and skips the clipped drawable when no mask sources remain: `packages/render-webgl2/src/webgl2-renderer.ts:76` through `:85`. |
| Fake GL context tracks active texture unit, texture bindings, current framebuffer, and framebuffer color attachment | implemented | State tracking was added at `packages/render-webgl2/src/webgl2-renderer.test.ts:255` through `:259`, `:366` through `:375`, `:409` through `:431`. |
| Fake GL `drawElements()` fails or records error on framebuffer feedback-loop risk | implemented | `drawElements()` invokes `detectFramebufferFeedbackLoop()`: `packages/render-webgl2/src/webgl2-renderer.test.ts:489` through `:491`; the detector records and throws on violation at `:507` through `:529`. |
| Focused real WebGL/pixel evidence confirms clipped target visibility inside mask | deferred by plan | Wave76 section 9 allows early escape when existing test infrastructure cannot provide real WebGL proof without a broad/flaky oracle. The report records the exact blocker: no package-level browser/WebGL/readPixels harness, no existing `readPixels` harness, app-level Playwright would become a broad pixel oracle, and adding a harness/dependency exceeds Domain A scope. This review confirmed `rg -n "readPixels" packages apps scripts` returned no matches. |
| No broad renderer redesign or new clipping architecture | implemented | Production diff is one small helper and one call site in `packages/render-webgl2/src/webgl2-renderer.ts`; no shader contract or clipping architecture rewrite was found. |
| No Photoshop/PSD pixel-perfect parity claim | implemented | The report explicitly avoids Photoshop/PSD parity claims, and no Domain A source or test diff touches PSD paths. |
| No broad screenshot/pixel oracle in normal app E2E | implemented | No Playwright or app E2E files were changed. Existing repository text marks renderer/pixel oracle support as unsupported, e.g. `packages/ai-interface/src/ai-codex-proposal-operation-catalog.ts:642` through `:679`. |
| Isolate Selected mask opacity parity remains follow-up unless directly required | not relevant | Domain A did not touch isolate-selected behavior. The report records it as deferred/out of scope. |
| No out-of-scope Mesh/Rig/selection work | implemented | `git diff --name-status HEAD -- packages/render-webgl2 discussion/implementation/waves/wave76 discussion/implementation/reviews/wave76` showed only the two render-webgl2 files and the Domain A report before this review artifact. |
| No new dependency | implemented | `git diff --name-only HEAD -- package.json pnpm-lock.yaml packages/render-webgl2/package.json apps/editor/package.json` produced no manifest or lockfile output. |
| Source organization policy compliance for Domain A scope | implemented | No new broad/catch-all file was added; the implementation stays in the existing WebGL renderer responsibility file and its matching test. |
| Operation policy relevance | not relevant | Domain A changes rendering behavior only and do not mutate model packages or operation contracts. |
| Wave75 baseline preservation | implemented | Wave75 final report and clean review are `pass`; Domain A did not modify Wave75 Editor keyform/inspector files. |

## Real WebGL Proof Assessment

The parent requirement is "real WebGL proof if practical; if not, exact blocker and fallback evidence." I judge the report's blocker sufficiently exact.

- The focused package has Node/Vitest fake-GL tests only; no package-level browser/WebGL/readPixels harness was found.
- `rg -n "readPixels" packages apps scripts` returned no matches.
- Existing app Playwright configuration has screenshot capture disabled in `apps/editor/playwright.config.ts:11`, and app-level PSD-import pixel proof would broaden the oracle beyond Wave76 Domain A's must-not scope.
- Existing product-facing text marks renderer/pixel oracle support as unsupported, including `packages/ai-interface/src/ai-codex-proposal-operation-catalog.ts:642` through `:679`.
- Adding a browser bundling/readPixels harness or dependency would exceed the narrow Domain A source area and trigger dependency/process work outside this loop.

Fallback evidence is not equivalent to GPU pixel proof, but it directly targets the identified disappearance cause: the fake GL now detects the framebuffer/texture feedback-loop state at draw time and the first-use/reuse tests pass with the detector enabled. This satisfies the Domain A early-escape path without pretending pixel correctness has been proven.

## Findings

No blocking findings.

No needs-change findings.

## Validation Run Or Inspected

| Check | Result |
|---|---:|
| `pnpm.cmd exec vitest run packages/render-webgl2/src/webgl2-renderer.test.ts` | Initial sandbox run failed with esbuild `spawn EPERM`; rerun with approved escalation passed: 1 file / 5 tests. |
| `git diff --check -- packages/render-webgl2/src/webgl2-renderer.ts packages/render-webgl2/src/webgl2-renderer.test.ts discussion/implementation/waves/wave76/wave76-domain-a-webgl-clipping-feedback-loop-fix-report.md` | Exit 0; CRLF normalization warnings only. |
| `Test-Path discussion/implementation/reviews/wave76/wave76-domain-a-spec-compliance-review.md` before write | `False`; no pre-existing review artifact. |
| `rg -n "readPixels" packages apps scripts` | Exit 1 with no matches; supports the no-existing-focused-readPixels-harness blocker. |
| `git diff --name-only HEAD -- package.json pnpm-lock.yaml packages/render-webgl2/package.json apps/editor/package.json` | No output; no manifest or lockfile diff. |
| Source/test inspection | Reviewed current source, test fake GL state model, shader mask behavior, WebGL primary/fallback app path, and Domain A report. |

I did not rerun full repository typecheck or broad Playwright suites in this review. The Domain A report records `pnpm.cmd typecheck` as passed, and this lane's independent validation focused on the renderer-specific spec evidence.

## Residual Risks / Non-Blockers

- Real browser GPU pixel output is still not directly proven. The code path and shader are consistent with inside-mask visibility and outside-mask transparency, but this review accepts that proof gap only through the Wave76 Domain A early-escape condition.
- The unbind helper covers the renderer-owned sampler units currently used by the renderer (`TEXTURE0` and `TEXTURE1`). Future renderer sampler-unit additions must update the helper or add equivalent safety.
- Missing/unrenderable mask skip behavior was preserved by unchanged source inspection, not by a new negative test in Domain A.
- The shared worktree remains dirty with other Wave76 work; this review ignored unrelated dirty files except where needed to confirm Domain A scope.

## User Decision Points

None.

## Final Recommendation

Domain A Spec Compliance Review passes. Carry the missing real WebGL/readPixels proof as an explicit residual risk/deferred evidence item, not as a hidden pass condition.
