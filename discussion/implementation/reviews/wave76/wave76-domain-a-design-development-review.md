# Wave76 Domain A Design / Development Compliance Review

## Verdict

pass

This is a pass for the Design / Development Compliance lane only. It does not waive the separate Wave76 requirement for focused real WebGL pixel evidence; that remains a Spec Compliance / Test Adequacy gate item because the Domain A report documents it as blocked by missing focused infrastructure.

## Basis Reviewed

- `discussion/implementation/orchestration/wave76-plan.md`
  - Section 3.1 requires `renderMaskTexture()` not to draw into a framebuffer while the attached mask texture is bound to any sampler texture unit, allows current missing-mask skip behavior, and forbids broad renderer redesign (`:44`-`:51`).
  - Section 7.1 requires first-use and reuse feedback-loop safety, WebGL primary path preservation, Canvas2D fallback non-regression, and unchanged missing/unrenderable mask skip behavior (`:193`-`:211`).
  - Section 9 names the expected Domain A source/test files and fake-GL feedback-loop evidence, first clipped drawable coverage, reuse coverage, and focused real WebGL/pixel evidence (`:332`-`:355`).
  - Section 15 lists real WebGL clipped-pixel proof and fake-GL feedback-loop tests as minimum evidence (`:536`-`:541`).
  - Sections 17-19 require review from source/tests/plans/reports, scoped package changes, dependency policy compliance, no broad renderer redesign, and no PSD/Photoshop parity work (`:588`-`:685`).
- `discussion/implementation/orchestration/wave75-plan.md`
  - Wave75 accepted no renderer architecture, package format, Viewer, Texture Atlas, Variant, Cubism compatibility, or LLM/provider work (`:43`-`:54`) and requires review from source/tests/plans/reports (`:402`-`:407`).
- `discussion/implementation/waves/wave75/wave75-final-integration-report.md`
  - Wave75 is final complete / pass (`:3`-`:8`), with no dependency/lockfile claim and no renderer/package-format/Cubism expansion in must-not compliance (`:113`-`:118`).
- `discussion/implementation/reviews/wave75/wave75-final-clean-integration-review.md`
  - Final clean review verdict is pass (`:3`-`:5`) and records no dependency manifest or lockfile diff, no package schema/runtime rewrite, and no forbidden-scope contradiction (`:63`-`:71`).
- `discussion/development_convention/source-file-organization-policy.md`
  - `index.ts` must stay barrel-oriented, source files must keep clear responsibility boundaries, catch-all files are forbidden/warnable, and `node scripts/check-source-organization.mjs` is required evidence for authored source changes (`:49`-`:124`).
- `discussion/development_convention/dependency-policy.md`
  - New dependencies require proposal/license/review evidence, forbidden Cubism/proprietary/parser dependencies are blocking, lockfile drift without registry/review is blocking, and manifests/lockfiles are in scope (`:7`-`:18`, `:88`-`:116`, `:331`-`:425`).
- `discussion/development_convention/operation-policy.md`
  - Operation Core is the package mutation gateway; runtime-only evaluation is out of scope for package mutation unless used as evidence, and direct model package mutation/Cubism oracle use is forbidden (`:7`-`:20`, `:34`-`:38`, `:348`-`:402`).
- Domain A implementation/report files:
  - `packages/render-webgl2/src/webgl2-renderer.ts`
  - `packages/render-webgl2/src/webgl2-renderer.test.ts`
  - `discussion/implementation/waves/wave76/wave76-domain-a-webgl-clipping-feedback-loop-fix-report.md`

## Findings

No blocking findings.

No needs-change findings.

## Design / Development Compliance Notes

- Minimality: production code adds one call before mask framebuffer binding and one private helper in `packages/render-webgl2/src/webgl2-renderer.ts` (`:124`-`:126`, `:207`-`:212`). No renderer architecture, draw ordering, clipping architecture, shader, package format, or app-level fallback redesign is introduced.
- Renderer state correctness: the helper unbinds `TEXTURE_2D` from the renderer-owned sampler units `TEXTURE0` and `TEXTURE1` before drawing into the mask framebuffer. That directly addresses the current feedback-loop risk from fresh mask-target creation on `TEXTURE1` and later clipped-draw reuse where the mask target was sampled on `TEXTURE1` (`webgl2-renderer.ts:165`-`:188`, `:225`-`:239`).
- Texture unit coverage: current `WebGl2Like` exposes only `TEXTURE0` and `TEXTURE1` (`webgl2-context.ts:21`-`:23`). Texture cache uploads and source sampling use `TEXTURE0` (`webgl2-textures.ts:34`-`:35`, `webgl2-renderer.ts:225`-`:230`); mask sampling uses `TEXTURE1` (`webgl2-renderer.ts:231`-`:239`). The helper covers all sampler units currently used by this renderer.
- State restoration assumptions: the renderer does not try to restore prior external GL binding state, but its own subsequent draw path rebinds source textures and mask textures explicitly. The unbind is placed before `bindFramebuffer(maskTarget.framebuffer)`, so framebuffer draw calls cannot sample the attached texture through the renderer's known sampler bindings.
- Disposal/cache interactions: `dispose()` and mask-target resize cleanup still delete framebuffer/texture resources (`webgl2-renderer.ts:92`-`:107`, `:145`-`:205`). Texture cache ownership remains separate and unchanged (`webgl2-textures.ts:13`-`:62`). Unbinding texture units does not invalidate cached `WebGl2Texture` handles; later draws rebind them.
- Shader/API compatibility: `webgl2-shaders.ts` remains unchanged. The shader contract still uses `u_texture`, `u_maskTexture`, `u_useMask`, and `u_viewportSize` (`:35`-`:51`), and the WebGL interface surface is unchanged.
- Missing/unrenderable mask behavior: the existing render loop still filters missing or unrenderable mask drawables and skips clipped drawables when no renderable mask sources remain (`webgl2-renderer.ts:64`-`:88`). Domain A does not change Canvas2D fallback code; the Canvas2D skip path remains in `apps/editor/src/workspace/canvas/canvas-renderer.ts:259`-`:283`.
- Source organization: no `index.ts` file, broad catch-all file, or new production file is added. The changed production logic remains in the coherent renderer owner file, and test-only fake GL state tracking remains in the renderer test file.
- Dependency policy: no `package.json` or `pnpm-lock.yaml` diff is attributable to Domain A. `node scripts/check-dependencies.mjs` passed.
- Operation policy: Domain A touches runtime rendering only and does not mutate project-defined model packages, add operation types, bypass Operation Core, or use Cubism formats/oracles.
- Forbidden scope: no Canvas2D fallback rewrite, PSD clipping extraction, Photoshop/pixel-perfect parity claim, isolate-selected opacity work, broad app E2E pixel oracle, or renderer architecture redesign was found.

## Validation Ran / Inspected

- Ran `pnpm.cmd exec vitest run packages/render-webgl2/src/webgl2-renderer.test.ts`.
  - Sandbox attempt failed with esbuild `spawn EPERM`.
  - Approved escalated rerun passed: 1 file / 5 tests.
- Ran `node scripts/check-source-organization.mjs`: passed.
- Ran `node scripts/check-dependencies.mjs`: passed.
- Ran `git diff --check -- packages/render-webgl2/src/webgl2-renderer.ts packages/render-webgl2/src/webgl2-renderer.test.ts`: exit 0, CRLF normalization warnings only.
- Ran `git diff --name-only -- package.json pnpm-lock.yaml apps/*/package.json packages/*/package.json`: no output.
- Ran `rg -n "readPixels" packages apps scripts`: no matches, confirming the report's claim that no focused existing `readPixels` harness was found.
- Inspected the Domain A diff, full renderer/test files, shader/context/texture-cache files, Canvas2D fallback skip path, Wave76 plan sections, Wave75 pass baseline, and required development policies.

## Residual Risks / Non-Blockers

- Focused real browser WebGL pixel proof for inside-mask visibility and outside-mask transparency is still missing. Domain A reports this as impractical without a new focused harness or a broad/flaky app-level pixel oracle. This is not a design/development blocker for this lane, but it must remain visible to the Spec Compliance / Test Adequacy lane and final Domain A gate.
- Future renderer changes that add sampler units beyond `TEXTURE0`/`TEXTURE1` must update `unbindRendererSamplerTextures()` and its fake-GL coverage. The current helper is correct for the present `WebGl2Like` API and shader contract.
- Fake-GL feedback-loop tests validate framebuffer/sampler state at draw time, not actual GPU shader output. That is acceptable for this lane, but not a substitute for the separate pixel-evidence requirement.
- The shared worktree contains unrelated dirty Wave76 files outside Domain A. This review ignored them except for dependency/status checks that confirm no manifest/lockfile movement.

## User Decision Points

None for this Design / Development Compliance lane.
