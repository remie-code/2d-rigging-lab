# auto-outline-v6G Contour Band Support Rings

> Draft algorithm spec / post-Wave69 refinement candidate.
> This document records the user discussion after visually checking v6D: v6D is strong, especially around the contour, and the next likely improvement is to keep the v6D contour/constrained-triangulation direction while adding inner and outer support rings and removing layer-bounds clipping pressure from mesh vertices. The filename keeps the original discussion label, but Wave70 treats this as a v6D-lineage refinement basis, not as a public `v6g` implementation id.

## 1. Position

`auto-outline-v6g-contour-band-support-rings` was the discussion label for a proposed refinement of the Wave69 v6D direction.

Wave70 resolves the naming direction: implement this idea as improved v6D lineage, not as public v6G.

Expected Wave70 implementation names:

```text
method id: auto-outline-v6d-contour-band-support-rings
source id: outline-v6d-contour-band-support-rings-rgba
implementation file: packages/authoring-core/src/mesh-generation-v6d-contour-band-support-rings.ts
```

The current `auto-outline-v6d-contour-constrainautor` implementation remains available as the old v6D baseline.

The main observation:

- v6D is currently the strongest visual candidate.
- The v6D contour extraction is good enough to keep.
- The remaining visible issue is that boundary vertices connect directly to relatively sparse interior Steiner points, creating long contour-to-interior triangle bands.
- The next improvement should add explicit support rings around the alpha boundary.

## 2. User Decision

Accepted direction from discussion:

```text
Keep v6D-like soft alpha contour extraction.
Keep constrained triangulation as the backbone.
Add support rings around the alpha boundary.
Allow mesh vertices to extend outside the layer bounds.
Do not let layer bounds clipping force the mesh shape.
```

The user also wants the mesh to extend a bit outside the alpha/layer area instead of being tightly clipped to the current layer rectangle.

## 3. Soft Alpha Mask Basis

The current v6 contour pipeline builds a soft mask before contour tracing.

Current implementation facts:

- `DEFAULT_ALPHA_THRESHOLD = 8`
- `SOFT_ALPHA_THRESHOLD = 0.18`
- alpha is read from RGBA bytes and normalized to `[0, 1]`
- a 3x3 weighted blur is applied
- a pixel is included if either:
  - original alpha is above `DEFAULT_ALPHA_THRESHOLD`; or
  - blurred alpha is above `SOFT_ALPHA_THRESHOLD`
- single-pixel cracks are closed
- isolated weak alpha noise is removed

The blur weight pattern is conceptually:

```text
1 2 1
2 4 2
1 2 1
```

This means the contour is not a mathematically exact alpha isoline. It is a working silhouette for mesh generation:

- faint antialiasing near the edge can still influence the mesh;
- tiny gaps in the alpha boundary are less likely to split the contour;
- isolated alpha dust is less likely to create topology;
- the resulting boundary is stable enough for deterministic sampling.

This soft mask behavior should remain unless a later visual check proves it is too fat or too permissive.

## 4. Current v6D Contour Strength

The strong v6D path is:

```text
soft alpha mask
-> main component selection
-> pixel boundary loop trace
-> outer loop selection
-> arclength boundary sampling
-> boundary constraint edges
-> Delaunator over boundary + interior points
-> Constrainautor constraint recovery
-> outside / crossing triangle filtering
-> final boundary preservation verification
```

The important property is that sampled contour edges are treated as hard constraints, not just ordinary points.

That is why v6D preserves the alpha silhouette better than the old v6A ear-clipping triangulator.

## 5. Problem To Solve

The current v6D mesh often has this shape:

```text
alpha boundary ring
-> sparse interior Steiner points
```

This can create a visible band of long triangles from the boundary to the first interior points.

It is much better than the v6A spoke fan, but it is still not ideal for editable deformation.

Desired shape:

```text
outer support ring
-> alpha boundary ring
-> inner support ring
-> interior points
```

This creates a real contour band instead of forcing the alpha boundary to connect directly into the broader interior.

## 6. Outer Support Ring

The outer support ring is a ring of mesh vertices slightly outside the alpha boundary.

Purpose:

- prevent deformation from clipping or collapsing the visible alpha edge;
- give the mesh a small safety apron around antialiased edges;
- make contour triangles shorter and more stable;
- better resemble artist-friendly initial meshes that wrap the visible shape.

Construction idea:

1. For each sampled alpha boundary point, estimate an outward normal.
2. Move the point outward by a preset-dependent distance.
3. Keep the outer ring ordered in the same boundary order.
4. Add constraints between adjacent outer-ring points.
5. Add band constraints or bridge edges between outer ring and alpha boundary ring when needed.

Preset-dependent starting values:

| Preset | Outer offset |
|---|---:|
| Large Motion | larger |
| Standard | medium |
| Low Motion | small |

The exact pixel distances should be decided by visual checks. A reasonable starting range is 1-6 texture pixels depending on density and texture size.

## 7. Alpha Boundary Ring

The alpha boundary ring is the existing v6D sampled boundary.

It should remain the primary silhouette anchor:

- sampled by arclength;
- keeps extreme top/bottom/left/right anchors;
- preserves deterministic order;
- becomes a constrained loop.

This ring should not be discarded even after adding outer and inner rings.

The alpha boundary ring is the semantic boundary of the visible shape. The outer ring is support, not the new shape identity.

## 8. Inner Support Ring

The inner support ring is a ring of mesh vertices slightly inside the alpha boundary.

Purpose:

- prevent long boundary-to-interior triangles;
- create a controllable deformation band just inside the silhouette;
- support hair tips, eye corners, and other contour-heavy deformation;
- make the mesh look and edit more like a deliberate contour band.

Construction idea:

1. For each sampled alpha boundary point, estimate an inward normal.
2. Move the point inward by a preset-dependent distance.
3. If the inward point leaves the soft mask, project it to the nearest valid mask point or skip it.
4. Keep the inner ring ordered with the alpha boundary.
5. Add constraints between adjacent inner-ring points when safe.
6. Use the inner ring as the first interior support before broader Steiner sampling.

The inner support ring must avoid self-intersections in narrow parts. Thin hair tips may need reduced offset or merged inner points.

## 9. Bounds And UV Policy

The mesh vertex position and texture UV should be treated as separate concerns.

Desired policy:

```text
mesh vertices:
  may extend outside alpha bounds and may extend outside the original layer rectangle

texture UVs:
  must remain valid for the available texture
```

This allows the mesh to provide deformation support outside the visible pixels without requiring texture samples outside the source image.

For outer-ring vertices:

- stage/local vertex positions may move outside the layer bounds;
- UVs should usually be projected back to the corresponding alpha boundary point or clamped to texture edge;
- if texture padding/dilation is available later, UV handling may use padded texture coordinates instead.

This design intentionally avoids using layer bounds as a hard mesh clipping boundary.

## 10. Triangulation Strategy

The preferred first implementation should stay close to v6D:

```text
all ring points + interior points
-> Delaunator
-> Constrainautor
-> verify ring constraints
-> filter outside invalid triangles only where appropriate
```

Candidate constraints:

- outer ring adjacent edges;
- alpha boundary ring adjacent edges;
- inner ring adjacent edges where valid;
- optional bridge constraints between corresponding outer/alpha/inner points.

Open design question:

- Should the alpha boundary remain a hard visible-boundary constraint if the outer ring extends beyond it?
- Or should the outer ring become the outer triangulation boundary while alpha boundary is an internal support loop?

Recommended direction:

```text
outer ring is the triangulation outer boundary
alpha boundary is an internal constrained support ring
inner ring is another internal support ring
```

This better supports deformation outside the visible edge, but it requires careful filtering so triangles outside the visible alpha are not incorrectly treated as invalid.

## 11. Filtering Policy Change

Current v6D filters triangles outside the main mask / outer polygon.

For v6G, filtering must change because the outer ring deliberately extends outside alpha.

New policy:

- Do not remove a triangle just because its centroid is outside the alpha mask.
- Instead classify triangles by region:
  - outer support band;
  - alpha boundary band;
  - interior fill;
  - invalid outside / crossing triangle.
- Remove triangles only when they cross forbidden boundaries, are degenerate, or clearly leave the intended outer support envelope.

The alpha mask is still useful, but it should no longer be the only acceptance region once the mesh intentionally extends outside alpha.

## 12. Layer Bounds Clipping

Layer bounds should no longer be treated as the maximum allowed mesh extent.

Rationale:

- A PSD layer rectangle is a storage/texture boundary, not necessarily the ideal deformation boundary.
- Mesh support outside the visible shape can be necessary for natural deformation.
- Hard clipping to the layer rectangle can flatten or cut off useful outer support geometry.

Implementation implications:

- The generated `MeshDto.bounds` policy may need review.
- Vertex coordinates may need to exceed the original drawable bounds.
- Hit testing, view fitting, and mesh overlay bounds may need to account for mesh bounds separately from texture bounds.
- UVs must remain valid even when vertices extend outside texture space.

This must be implemented carefully because other systems may currently assume mesh vertices stay inside drawable bounds.

## 13. Diagnostics

v6G should report:

- soft mask opaque pixel count;
- boundary ring point count;
- outer ring point count;
- inner ring point count;
- skipped / merged ring point count;
- ring self-intersection count;
- bridge constraint count;
- preserved constraint count;
- removed invalid triangle count;
- support-band triangle count;
- alpha-boundary-band triangle count;
- interior triangle count;
- whether any vertex extends outside layer bounds;
- max outside-layer distance.

## 14. Acceptance Criteria

v6G is acceptable as an experimental candidate when:

- it keeps the v6D soft mask and contour sampling strengths;
- it adds at least one outer support ring and one inner support ring;
- it does not clip mesh vertices merely because they exceed the current layer bounds;
- UVs remain valid and deterministic;
- default mesh method remains unchanged;
- v6D remains available for comparison unless a later decision removes it;
- visible contour triangles are shorter and more band-like than v6D on representative hair/eye fixtures;
- fallback metadata clearly distinguishes unsupported masks or invalid ring geometry.

## 15. Non-Goals

- Choosing final default.
- Permanent backend selector UX.
- Pixel-perfect reproduction of another editor.
- Cubism compatibility.
- Full robust offset-curve geometry for every pathological shape in v0.
- Texture padding/dilation implementation, though v6G should be compatible with it later.

## 16. Open Questions

- Resolved for Wave70: implement as v6D lineage, specifically `auto-outline-v6d-contour-band-support-rings`.
- Should outer support ring use alpha-boundary UVs, clamped texture-edge UVs, or a later padded texture coordinate model?
- How far outside the layer bounds may mesh vertices extend before view fitting / hit testing becomes confusing?
- Should outer ring be the triangulation boundary, with alpha boundary as an internal support ring?
- Should bridge constraints be explicit, or should Delaunay choose the connections after preserving ring constraints?
