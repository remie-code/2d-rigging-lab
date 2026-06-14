# Wave71 Domain A Design / Development Compliance Review

- Verdict: `pass`
- Target: `wave71-adaptive-staggered-band-backend-default-route`
- Date: 2026-06-15
- Reviewer: Review-Sylph
- Re-review: Fix Loop 1

## Basis Documents Used

- `discussion/implementation/orchestration/wave71-plan.md`
- `discussion/design/mesh-generation/auto-outline-v6d-adaptive-staggered-band.md`
- `discussion/design/mesh-generation/auto-outline-v6d-staggered-inner-strip.md`
- `discussion/design/mesh-generation/auto-outline-v6g-contour-band-support-rings.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/ux-backed-package-logic-authority.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/operation-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`
- `discussion/implementation/reviews/wave70/wave70-final-clean-integration-review.md`
- Direct source, tests, reports, and working-tree diff inspection after Fix Loop 1.

## Findings

No unresolved design/development compliance findings remain.

### Resolved: Parent / Domain-B-owned map prep diffs are now explicitly excluded from Domain A

The original review flagged modified map files outside Domain A's allowed write scope. Fix Loop 1 does not revert those parent/preparation diffs, which is acceptable under the re-review request. The Domain A report now explicitly records that pre-existing parent/Domain-B preparation diffs in `discussion/design/mesh-generation/_map.md`, `discussion/implementation/_map.md`, and `discussion/implementation/orchestration/_map.md`, plus the Wave71 plan/design docs, are excluded from Domain A changed files.

This resolves the Domain A scope finding because ownership is now clear and Domain B remains responsible for final map closeout. Source and test diffs for Domain A remain concentrated in the expected `packages/authoring-core`, `packages/operation-core`, and `apps/editor` areas.

### Resolved: Unused local-strip-omitted reason removed from source/UI contract

Fix Loop 1 removed the unused `v6d-adaptive-staggered-band-local-strip-omitted` fallback reason instead of implementing a partial local strip omission output. The remaining behavior is coherent: the backend makes deterministic reduced inner-offset attempts (`packages/authoring-core/src/mesh-generation-v6d-adaptive-staggered-band.ts:1273-1285`); if a full safe staggered inner ring still cannot be built, geometry fails with `v6d-adaptive-staggered-band-geometry-invalid` (`packages/authoring-core/src/mesh-generation-v6d-adaptive-staggered-band.ts:617-633`) and falls back to Wave70 support rings before coarse fallback (`packages/authoring-core/src/mesh-generation-v6d-adaptive-staggered-band.ts:939-1014`).

Evidence:

- `packages/authoring-core/src/mesh-generation-contract.ts:197-201` now lists only the adaptive geometry-invalid and constraint-recovery-failed reasons.
- `apps/editor/src/workspace/panels/mesh-tool-inspector.tsx:631-634` formats only those two adaptive reasons.
- `rg -n "local-strip-omitted|Adaptive strip locally omitted|v6d-adaptive-staggered-band-local" packages apps` returned no matches.
- The fallback-order test still asserts Wave70 support-ring source before coarse fallback (`packages/authoring-core/src/mesh-generation.test.ts:2645-2684`).

### Informational: New backend file remains cohesive but should not keep growing indefinitely

`packages/authoring-core/src/mesh-generation-v6d-adaptive-staggered-band.ts` is a large single-backend file, but it owns one cohesive algorithm and does not put implementation logic in an entrypoint or catch-all file. `node scripts/check-source-organization.mjs` passed. Future waves should split reusable density, strip-geometry, or fallback helpers if the file grows further.

## Checks Performed And Key Evidence

- Source organization: `node scripts/check-source-organization.mjs` passed.
- Dependency policy: `node scripts/check-dependencies.mjs` passed; `git diff -- package.json pnpm-lock.yaml pnpm-workspace.yaml apps/editor/package.json packages/authoring-core/package.json packages/operation-core/package.json packages/render-webgl2/package.json` was empty.
- Renderer / texture scope: `git diff -- packages/render-webgl2/src` was empty. Existing `packages/render-webgl2/src/webgl2-textures.ts:39-40` still uses `NEAREST`; no padding or dilation changes were found.
- Diff hygiene: `git diff --check -- discussion/implementation/reviews/wave71/wave71-domain-a-design-development-review.md packages/authoring-core packages/operation-core apps/editor discussion/implementation/waves/wave71` passed with CRLF working-copy warnings only.
- Operation/schema alignment: adaptive diagnostics remain optional and separate from support-ring diagnostics in `packages/operation-core/src/payloads/model-edit.ts:208-229` and `:270-299`; operation transform history serializes adaptive diagnostics at `packages/operation-core/src/operations/generate-mesh.ts:600-632`.
- Operation boundary: preview/apply continues to pass the preview mesh and preview provenance through `commitGenerateMesh` rather than directly mutating package state (`apps/editor/src/features/editor-session/editor-session-context.tsx:740-756`, `apps/editor/src/features/editor-session/model/editor-session-commands.ts:275-292`).
- Editor default route remains the new method at `apps/editor/src/features/editor-session/model/mesh-tool-state.ts:61-63`; the e2e negative selector assertions remain at `apps/editor/e2e/psd-import.e2e.spec.ts:261-263`.
- Wave70 preservation: `auto-outline-v6d-contour-band-support-rings`, `outline-v6d-contour-band-support-rings-rgba`, and `v6d-contour-band-support-rings` remain registered in `packages/authoring-core/src/mesh-generation-contract.ts`.

## User-Decision Points

None for this Design / Development Compliance gate.

If future product work wants a partial local strip omission output rather than reduced-offset attempts followed by Wave70 fallback, that should be planned as a separate design/implementation decision. It is no longer represented as an active but unimplemented contract value in this Domain A implementation.

## Residual Risks

- Automated evidence does not prove final visual quality across broad real artwork; it proves routing, deterministic density behavior, strip diagnostics, fallback/provenance shape, and policy boundaries.
- Thin or highly concave silhouettes may fall back to Wave70 support rings instead of producing a partial adaptive strip. That behavior is now explicit and contract-coherent.
- The new backend file is readable now, but future geometry/fallback additions should be split by responsibility.
