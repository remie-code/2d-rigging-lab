# Wave95 Domain A Spec Compliance Review

## Verdict

`pass`

Loop: 2

Domain A now satisfies the Wave95 Domain A spec rubric for authoring-core multi-island V6D mesh generation. Loop 1's all-kept-island fallback issue is fixed in code, and the budget policy now uses a narrow, explicit minimum-boundary-floor exception instead of giving each island a full preset budget.

Residual risk: there is still no deterministic public alpha fixture that naturally forces every kept island through backend fallback. The all-kept fallback verdict is therefore based on direct source review of the new all-fallback branch plus the existing no-valid-island fallback test.

## Scope Reviewed

- `packages/authoring-core/src/mesh-generation-v6-alpha-islands.ts`
- `packages/authoring-core/src/mesh-generation-v6d-adaptive-contour-constrainautor.ts`
- `packages/authoring-core/src/mesh-generation.test.ts`
- `packages/authoring-core/src/mesh-generation.ts` dispatch check only
- `apps/editor/src/features/editor-session/model/mesh-tool-state.ts` default method check only
- `discussion/implementation/waves/wave95/wave95-domain-a-authoring-core-multi-island-mesh-generation-report.md`
- Existing Loop 1 review: `discussion/implementation/reviews/wave95/wave95-domain-a-spec-compliance-review.md`

No source files were modified by this review. This file was updated with the Loop 2 verdict and evidence.

## Basis Documents Used

- `discussion/implementation/orchestration/wave95-plan.md`
- `discussion/design/mesh-generation/auto-outline-v6d-adaptive-contour-constrainautor.md`
- `discussion/design/mesh-generation/auto-outline-v6g-contour-band-support-rings.md`

## Findings

No blocking or change-required findings.

## Loop 1 Findings Status

- High: all kept-island backend failure must use existing whole-drawable fallback behavior, not a final merge of only per-island fallback meshes.
  - Status: fixed.
  - Evidence: `createMergedV6DAdaptiveContourMesh(...)` now detects `fallbackOutputs.length === sortedOutputs.length` and returns `createWholeDrawableMultiIslandFallback(...)` instead of merging per-island fallback meshes (`packages/authoring-core/src/mesh-generation-v6d-adaptive-contour-constrainautor.ts:636`). The whole-drawable fallback is built from the original `input.input.rgbaBytes`, not an isolated island buffer (`packages/authoring-core/src/mesh-generation-v6d-adaptive-contour-constrainautor.ts:821`). The returned result is a visible `status: "fallback"` with `source: "alpha-aware-rgba"` and whole-drawable alpha bounds derived from the kept/raw island union (`packages/authoring-core/src/mesh-generation-v6d-adaptive-contour-constrainautor.ts:903`). Provenance explicitly records `v6d-adaptive-contour-multi-island-all-islands-fallback` and `v6d-adaptive-contour-multi-island-whole-drawable-fallback` (`packages/authoring-core/src/mesh-generation-v6d-adaptive-contour-constrainautor.ts:1580`).
- Medium: global preset budget should be respected as much as practical; any minimum-floor exception must be narrow and explicit.
  - Status: fixed.
  - Evidence: multi-island generation resolves one global density from the kept-island total and union bounds, then allocates that budget across islands (`packages/authoring-core/src/mesh-generation-v6d-adaptive-contour-constrainautor.ts:351`, `packages/authoring-core/src/mesh-generation-v6d-adaptive-contour-constrainautor.ts:364`). The allocator has a boundary floor of `3` and an interior floor of `0` (`packages/authoring-core/src/mesh-generation-v6-alpha-islands.ts:52`). The only cap-exceeding path is the minimum boundary floor when `3 * keptIslandCount` is greater than the global boundary cap (`packages/authoring-core/src/mesh-generation-v6-alpha-islands.ts:300`). Diagnostics expose both global and allocated totals plus floor-exception booleans (`packages/authoring-core/src/mesh-generation-v6d-adaptive-contour-constrainautor.ts:1522`). The two-island success test asserts allocated boundary/interior totals stay within the global caps for the normal case and that neither floor exception is set (`packages/authoring-core/src/mesh-generation.test.ts:2195`).

## Spec Checks

- Multi-island detection always enabled for the Wave95 V6D default path: pass. The editor default method remains `auto-outline-v6d-adaptive-contour-constrainautor` (`apps/editor/src/features/editor-session/model/mesh-tool-state.ts:69`), authoring dispatch routes that method to the V6D adaptive generator (`packages/authoring-core/src/mesh-generation.ts:202`), and the generator starts by detecting raw alpha islands (`packages/authoring-core/src/mesh-generation-v6d-adaptive-contour-constrainautor.ts:107`).
- Single-island path behaviorally unchanged: pass. Invalid/zero/one raw component input still calls the prior single-island implementation directly (`packages/authoring-core/src/mesh-generation-v6d-adaptive-contour-constrainautor.ts:115`). Existing V6D single-island regression tests remain in place and passed (`packages/authoring-core/src/mesh-generation.test.ts:1998`, `packages/authoring-core/src/mesh-generation.test.ts:2066`).
- Raw alpha connected components detected before soft/support processing: pass. The detector reads original RGBA alpha into a raw mask before any V6 contour pipeline call (`packages/authoring-core/src/mesh-generation-v6-alpha-islands.ts:75`, `packages/authoring-core/src/mesh-generation-v6-alpha-islands.ts:93`; entry call at `packages/authoring-core/src/mesh-generation-v6d-adaptive-contour-constrainautor.ts:110`).
- Multiple valid islands generate disconnected mesh components in one Drawable mesh: pass. Each kept island is isolated into a full-size RGBA buffer and run through the existing V6D path (`packages/authoring-core/src/mesh-generation-v6d-adaptive-contour-constrainautor.ts:373`). Merge concatenates vertices/UVs and offsets triangle indices without adding cross-island triangles (`packages/authoring-core/src/mesh-generation-v6d-adaptive-contour-constrainautor.ts:652`). The two-island test asserts two triangle components (`packages/authoring-core/src/mesh-generation.test.ts:2155`).
- No cross-gap triangles: pass. The merge only offsets existing per-island triangle indices, and tests assert zero vertical-gap-crossing triangles for both the two-leg case and the slim separated island case (`packages/authoring-core/src/mesh-generation.test.ts:2157`, `packages/authoring-core/src/mesh-generation.test.ts:2352`).
- Tiny noise filtered and recorded, not surfaced as normal warning on success: pass. The noise filter uses compound pixel/bounds/ratio/meaningful-dimension rules (`packages/authoring-core/src/mesh-generation-v6-alpha-islands.ts:261`). The speck test asserts no fallback warning, no geometry in the speck bbox, and recorded skipped-noise diagnostics (`packages/authoring-core/src/mesh-generation.test.ts:2239`, `packages/authoring-core/src/mesh-generation.test.ts:2246`, `packages/authoring-core/src/mesh-generation.test.ts:2249`).
- Meaningful small/narrow islands not dropped solely by area: pass. The filter requires tiny dimensions and lacks a meaningful dimension before classifying relative dust (`packages/authoring-core/src/mesh-generation-v6-alpha-islands.ts:272`). The slim-strand test keeps a 30-pixel separated island and generates it (`packages/authoring-core/src/mesh-generation.test.ts:2323`, `packages/authoring-core/src/mesh-generation.test.ts:2361`).
- Global preset budget applies across islands: pass, with the explicit minimum boundary floor described above. Normal multi-island allocation is verified not to give each island a full preset cap (`packages/authoring-core/src/mesh-generation.test.ts:2195`, `packages/authoring-core/src/mesh-generation.test.ts:2210`).
- Partial/all-island fallback semantics match the plan: pass. Localized blocked-island fallback output exists for per-island blocked generation (`packages/authoring-core/src/mesh-generation-v6d-adaptive-contour-constrainautor.ts:440`), partial fallback remains visible when at least one island succeeds (`packages/authoring-core/src/mesh-generation-v6d-adaptive-contour-constrainautor.ts:783`), all kept-island fallback now routes to whole-drawable fallback (`packages/authoring-core/src/mesh-generation-v6d-adaptive-contour-constrainautor.ts:636`, `packages/authoring-core/src/mesh-generation-v6d-adaptive-contour-constrainautor.ts:803`), and no-valid-island fallback is directly tested (`packages/authoring-core/src/mesh-generation.test.ts:2265`).
- `multiIslandHandling: "supported"` emitted for successful multi-island generation: pass. Multi-kept merged metrics set `"supported"` (`packages/authoring-core/src/mesh-generation-v6d-adaptive-contour-constrainautor.ts:753`), single-kept/noise-filtered metrics also set `"supported"` (`packages/authoring-core/src/mesh-generation-v6d-adaptive-contour-constrainautor.ts:934`), and tests assert the value (`packages/authoring-core/src/mesh-generation.test.ts:2173`, `packages/authoring-core/src/mesh-generation.test.ts:2250`).
- Blocking checks: pass. I found no evidence of maximum-island-only behavior for valid multi-island input, cross-gap triangle creation, material single-island regression, package-format schema changes, runtime export changes, atlas algorithm changes, or dependency/lockfile changes in this Domain A scope.

## Evidence / Tests Inspected Or Run

Inspected:

- Wave95 plan and V6D/V6G design basis documents.
- Raw-alpha island detection, filtering, RGBA isolation, and budget allocation helper.
- V6D adaptive contour entry, single-island fast path, single-kept path, multi-kept path, merge, metrics, localized fallback, no-kept fallback, and whole-drawable all-island fallback.
- Focused tests for V6D single-island regression, two separated islands, disconnected topology, no cross-gap triangles, source-space UVs, stable IDs, deterministic output, tiny speck filtering, all-noise/no-valid fallback, and small/narrow island retention.
- Domain A implementation report and Loop 2 self-reported fixes.
- `git status --short -uall` for package/schema/export/dependency drift in the relevant paths.

Run:

- `pnpm.cmd exec vitest run packages/authoring-core/src/mesh-generation.test.ts`
  - First sandboxed attempt failed during config load with `Error: spawn EPERM` from esbuild child-process startup.
  - Reran with approved escalation: passed, 1 file / 76 tests.
- `pnpm.cmd typecheck`: passed.
- `node scripts/check-dependencies.mjs`: passed.
- `node scripts/check-source-organization.mjs`: passed.

Not run:

- Full `pnpm.cmd test:unit` was not rerun in this review pass. The Domain A report records a prior broad run with unrelated failures outside this scope.

## Unresolved Questions / User-Decision Points For Orch-Sylph

- None blocking for Domain A spec compliance.
- Remaining verification item: if Orch-Sylph wants executable coverage for all kept islands entering backend fallback, a future loop needs either a stable natural alpha fixture or a narrow test seam. The current code path is source-reviewed but not forced by a dedicated test.
- Downstream note: `multiIslandDiagnostics` is emitted at runtime and accessed in tests through an `unknown` cast. Formalizing that type surface can be handled by Domain B if its provenance/editor integration scope needs it.
