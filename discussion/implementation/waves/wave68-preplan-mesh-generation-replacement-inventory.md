# Wave68 Preplan Mesh Generation Replacement Inventory

> Status: preplan inventory / read-only Sylph delegation integrated by Undine.
> Date: 2026-06-14.
> Purpose: restore repository context before planning a replacement mesh-generation algorithm. This is not an implementation plan and does not make the failed existing algorithms the design basis.

## 1. Planning Gate Result

Mode: Inventory first.

Why:

- The user direction is clear: replace the current mesh generation algorithm with an independent alpha-mask contour / adaptive sampling / triangulation approach.
- Repository facts were stale or split across Wave61-Wave67 docs, dirty source files, and untracked mesh-generation drafts.
- A wrong plan would touch shared authoring-core, operation-core, Editor preview, and E2E surfaces.

No user decision was required before this inventory. After the inventory, the user decided that the new method should be a v6 sidecar. Remaining implementation decisions are listed below.

## 2. Delegation Shape

Undine delegated three read-only Sylph investigations:

| Agent focus | Question |
|---|---|
| Project context | What is this workspace building, how far has it progressed, and where does mesh generation fit? |
| Implementation seams | Which source files, contracts, tests, and UI consumers are touched by a mesh-generation replacement? |
| Failure/design history | Which mesh-generation approaches failed, which requirements remain durable, and which docs are current or stale? |

Subagents were instructed not to edit files, not to ask the user directly, and not to use the existing failed algorithms as design inspiration.

## 3. Repository Facts

- The repository is a pnpm workspace for `private-2d-rigging-lab`, a private project-defined 2D rigging authoring prototype.
- The project is not a Cubism-compatible editor. Cubism formats, SDK/Core, existing Cubism models, and old Live2D package formats are policy non-goals. See `discussion/_conventions.md` and root acceptance criteria.
- Mesh generation is a core MVP authoring capability. Mesh Tool turns PSD-imported texture / drawable / empty mesh scaffold state into editable drawable mesh state.
- The latest implementation map records Wave67 as complete / pass. Wave67 added WebGL2 renderer foundation, parent-child Deformer local-space semantics, and explicit non-default Mesh V4 sidecar while keeping Editor default at V2.6.
- Some higher-level maps are stale. `discussion/_map.md` still points at older Wave53/Wave54 context, while `discussion/implementation/_map.md` records Wave67.

## 4. Current Mesh-Generation State

Durable contract:

- `createGeneratedMeshForDrawable(input)` is the authoring-core seam for generating a mesh from session/drawable/method/density/provenance inputs.
- Output contracts include mesh DTO data, source id, alpha bounds, fallback reason/steps, and quality metrics.
- Operation payload method enums in operation-core and authoring-core method names must stay synchronized.
- Editor Mesh Tool preview must not mutate project mesh before Apply.
- Apply may commit a preview mesh without regenerating it, while replacing generation provenance with operation provenance.

Current defaults and conflict:

- Current accepted default from Wave66/Wave67 is `auto-outline-v2.6-soft-apron`.
- `auto-outline-v4-contour-band` is an explicit non-default sidecar.
- The dirty worktree currently contains a mismatch: some tests/E2E expectations point toward V4, while source/default behavior remains V2.6.
- V4 has paths where failure returns `undefined` instead of a fallback chain result; this conflicts with tests expecting fallback behavior.

## 5. Likely Touch Map

Primary replacement seam:

- `packages/authoring-core/src/mesh-generation.ts`

Likely supporting files:

- `packages/authoring-core/src/mesh-quality-metrics.ts`
- `packages/authoring-core/src/index.ts`
- `packages/operation-core/src/payloads/model-edit.ts`
- `packages/operation-core/src/operations/generate-mesh.ts`
- `apps/editor/src/features/editor-session/editor-session-context.tsx`
- `apps/editor/src/features/editor-session/model/mesh-tool-state.ts`
- `apps/editor/src/workspace/panels/mesh-tool-inspector.tsx`

Likely tests:

- `packages/authoring-core/src/mesh-generation.test.ts`
- `packages/operation-core/src/operations/generate-mesh.test.ts`
- `apps/editor/src/features/editor-session/model/editor-session-commands.test.ts`
- `apps/editor/e2e/psd-import.e2e.spec.ts`
- Canvas projection/evaluation tests if preview overlay behavior changes.

## 6. Failure History To Treat As Negative Evidence

The existing failed algorithms should not be copied or tuned as the new basis. They are useful only for integration contracts, failure categories, and tests.

- `auto-grid-v1`: minimal preview/apply grid; not contour-following.
- `auto-outline-v1`: better than grid, but fan concentration, large triangles, grid feel, and complex thin-shape risk remained.
- `auto-outline-v2`: more natural triangular mesh, but too fine and too tied to alpha contour detail.
- `auto-outline-v3-envelope`: envelope can become too strong and drift from drawable art.
- `auto-outline-v4-contour-band` and recursive/offset-ring variants: center-seed and local-normal offset directions recorded foldbacks, overlapping triangles, interior fill failures in thin hair/branch shapes, layer-rectangle pull, and missing faces when bad triangles are filtered.

## 7. Durable Requirements For The Replacement

- Input is drawable RGBA alpha data plus explicit preset/density, not semantic recognition.
- No automatic preset selection from part name, image meaning, or "hair" inference.
- Deterministic output for identical input.
- Preserve valid mesh DTO invariants: aligned vertices/UVs/stable IDs, valid triangles, no repeated triangle indices, stable bounds, valid UVs, `topologyRevision: 0` for generated meshes.
- Preserve preview -> Apply semantics.
- Return fallback reason / fallback steps / quality summary instead of silently failing where possible.
- Do not claim Cubism compatibility, pixel-perfect reproduction, or external format reconstruction.

## 8. New Direction To Plan Against

User decision after this inventory:

- The new method should land as a sidecar.
- The method name is `auto-outline-v6`.
- Gnome must be explicitly instructed not to use existing mesh-generation implementations as algorithm reference.

The user-provided target direction should be treated as a new independent algorithm family:

```text
soft alpha mask
-> contour extraction and adaptive boundary simplification
-> adaptive interior sampling
-> triangulation with boundary constraints or equivalent boundary preservation
-> deterministic cleanup and quality/fallback summary
```

This direction is now documented as the v6 sidecar basis in `discussion/design/mesh-generation/auto-outline-v6-alpha-constrained-delaunay.md`.

## 9. Open Decisions Before Implementation

- Is adding a triangulation dependency allowed, or must v0 remain dependency-free/local implementation?
- What is the v0 scope for multiple islands, holes, and very thin hair strands?
- Should fallback be allowed during visual comparison, or should new-algorithm failure be surfaced distinctly to avoid hiding quality regressions?
- Which dirty V4/V2.6 changes are user-owned experiments versus failed remnants to replace?

## 10. Recommended Next Action

1. Create a short algorithm basis document for the new independent approach under `discussion/design/mesh-generation/`.
2. Decide sidecar-first versus immediate default replacement.
3. Decide dependency policy for triangulation.
4. Plan implementation through authoring-core first, then operation schema/tests, then Editor preview/source-label expectations.
5. Keep V4/V5 recursive-offset documents as negative evidence, not implementation basis.
