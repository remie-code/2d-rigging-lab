# Wave 15 Domain A Completion: Drawable / Mesh Operation Foundation

> Wave: `editor-drawable-mesh-authoring-vertical-slice`
> Domain: `wave15-drawable-mesh-operation-foundation`
> Verdict: `pass`
> Date: 2026-05-30

## Files Changed

- `packages/authoring-core/src/authoring-mutations.ts`
- `packages/authoring-core/src/draw-order-mutations.ts`
- `packages/authoring-core/src/drawable-mutations.ts`
- `packages/authoring-core/src/drawable-mutations.test.ts`
- `packages/authoring-core/src/drawable-selectors.ts`
- `packages/authoring-core/src/index.ts`
- `packages/authoring-core/src/mesh-generation.ts`
- `packages/authoring-core/src/mesh-mutations.ts`
- `packages/authoring-core/src/stable-order-mutations.ts`
- `packages/operation-core/src/index.ts`
- `packages/operation-core/src/operation-ids.ts`
- `packages/operation-core/src/operation-registry.ts`
- `packages/operation-core/src/operations/add-keyform-grid2d.ts`
- `packages/operation-core/src/operations/create-drawable.ts`
- `packages/operation-core/src/operations/create-drawable.test.ts`
- `packages/operation-core/src/operations/generate-mesh.ts`
- `packages/operation-core/src/operations/generate-mesh.test.ts`

## Implementation Summary

- Added authoring helpers for drawable creation, mesh replacement/generation, draw order insertion, stable order insertion, and drawable/mesh/part/source selectors.
- Implemented `createDrawable` operation handler and registered it.
  - Resolves deterministic drawable, mesh, texture, and provenance ids.
  - Creates a runtime-safe drawable plus manual-empty placeholder mesh in one committed mutation.
  - Updates part `drawableIds`, source layer `mappedDrawableIds`, draw order, stable order, and provenance.
  - Reports duplicate drawable/mesh, missing part, missing source asset, and missing source layer preconditions.
- Implemented `generateMesh` operation handler and registered it.
  - Replaces the drawable's existing mesh deterministically.
  - Supports `manual-empty` and preview-useful `auto-grid-v1` geometry.
  - Rejects `auto-outline-v1` with a precondition diagnostic because outline extraction is outside Domain A and would require a future source/texture pipeline.
  - Reports missing drawable and missing referenced mesh preconditions.
- Kept committed create/generate graph states runtime-safe; focused tests convert candidate/committed sessions through `toRuntimeGraph`.
- Kept `index.ts` files barrel-only.

## Tests Run

| Command | Result | Notes |
|---|---|---|
| `pnpm.cmd exec vitest run packages/authoring-core/src/drawable-mutations.test.ts packages/operation-core/src/operations/create-drawable.test.ts packages/operation-core/src/operations/generate-mesh.test.ts` | initial sandbox fail | Failed with `EPERM` opening `node_modules/.../vitest.mjs`. |
| `pnpm.cmd exec vitest run packages/authoring-core/src/drawable-mutations.test.ts packages/operation-core/src/operations/create-drawable.test.ts packages/operation-core/src/operations/generate-mesh.test.ts` | pass after escalation | 3 files / 15 tests passed. |
| `pnpm.cmd typecheck` | initial fail, final pass | Initial failures were fixed: package-format type imports from operation-core, `TextureIdSchema` value import, exact optional fields, and widened mutation-error map. Final root + editor typecheck passed. |
| `pnpm.cmd exec vitest run packages/operation-core/src/operations/add-keyform-grid2d.test.ts` | pass after escalation | 1 file / 7 tests passed; covers the existing handler touched for widened mutation error codes. |
| `pnpm.cmd run check:source` | pass | Source organization guard passed. |
| `git diff --check -- packages/authoring-core/src packages/operation-core/src` | pass | Only existing LF/CRLF working-copy warnings. |

## Review Findings And Fixes Applied

- Fixed typecheck finding: operation handlers no longer import `@private-2d-rigging-lab/package-format` directly; they derive needed graph item types through `AuthoringSession`.
- Fixed typecheck finding: `TextureIdSchema` is now a value import and optional payload fields are passed with conditional spreads under `exactOptionalPropertyTypes`.
- Fixed regression risk from extending `AuthoringMutationErrorCode`: `add-keyform-grid2d` now has a fallback diagnostic path for unrelated mutation error codes, and its focused test still passes.

## Remaining Issues

- `auto-outline-v1` is schema-accepted but intentionally rejected by the handler until an outline extraction pipeline exists.
- The generated provenance uses internal generated fixture metadata. This is sufficient for Domain A operation/runtime safety but may be refined by later evidence or product workflow domains.
- No editor UI, e2e, package evidence, or persistence workflow was implemented in this domain by scope.

## User-Decision Points

- None blocking for Domain A.
- Future product decision remains: whether `auto-outline-v1` should become a real outline extractor or be replaced by a different generated preset method.

## Provisional Assumptions

- A committed `createDrawable` may create a manual-empty placeholder mesh so the graph never enters a normal committed state where a drawable references a missing mesh.
- `auto-grid-v1` rectangle/grid geometry over the drawable bounds is an acceptable rights-clean preview-useful generated mesh for this vertical slice.
- `createDrawable` can rely on an existing source asset and part; creating source assets or parts belongs to a later domain/wave.
