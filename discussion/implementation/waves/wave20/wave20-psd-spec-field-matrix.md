# Wave 20 PSD Spec Field Matrix

> Target: `wave20-psd-spec-field-matrix-and-sample-characterization`
> Status: Domain A artifact
> Scope: documentation/research only. This file does not define a PSD parser, runtime model structure, or Photoshop-compatible renderer.

## Source Basis

Official source:

- Adobe Photoshop File Formats Specification: https://www.adobe.com/devnet-apps/photoshop/fileformatashtml/

Repository basis:

- `discussion/implementation/orchestration/wave20-plan.md`
- `discussion/design/module-contract-design-decisions.md`
- `discussion/design/module-contracts/package-file-format-contract.md`

## Boundary Rule

Official PSD fields are input facts for a future import adapter. Wave 20 Domain A does not parse PSD bytes into runtime model structures.

`layered-character-psd-profile-v1` should receive normalized, adapter-supplied metadata. Downstream MVP code may consume that adapter result, but must not infer that the repository has decoded the original PSD, extracted rasters, or rendered Photoshop features.

Status meanings:

| Status | Meaning for Wave 20 MVP adapter boundary |
|---|---|
| `supported` | A future parser/adapter may normalize this data into the adapter result, and downstream Wave 20 implementation can consume that normalized result. |
| `deferred` | Recognized as PSD input surface, but not required for Wave 20 materialization. Preserve as diagnostics, metadata, or future work. |
| `unsupported` | Do not implement in Wave 20. If needed for a product claim, stop and escalate for parser/dependency/rendering scope. |

## MVP Profile Needs

`layered-character-psd-profile-v1` needs these normalized adapter fields:

| Profile need | Adapter result shape | Official PSD input area |
|---|---|---|
| Layer/group identity | stable adapter IDs, original names, normalized names, group path, source order | layer count, layer records, layer name, section divider tagged blocks |
| Bounds | source canvas size and per-layer top/left/bottom/right rectangles | header, layer records |
| Opacity | `opacityInSource` normalized from PSD byte opacity to 0..1 | layer records |
| Visibility | `visibleInSource` | layer record flags |
| Unsupported features | `unsupportedFeatures[]`, import diagnostics, optional rasterize/manual-confirm hints | blend modes, masks, effects, text/smart object/vector/fill/adjustment tagged blocks, color mode, compression/decode requirements |
| Texture preview references | adapter-supplied browser/package preview references only | future adapter output; PSD channel/image data is not decoded by Domain A |
| Target part mapping | adapter- or UI-supplied `targetPartId` / part candidates | layer/group names, group hierarchy, source order; not a direct PSD field |

## Field Matrix

| PSD section / feature | Official input facts | Wave 20 status | MVP adapter mapping | Deferred / unsupported handling |
|---|---|---|---|---|
| Header | Fixed 26-byte header with signature, version, channel count, height, width, depth, and color mode. PSD values are big-endian. | `supported` | Document identity/preflight facts: PSD vs PSB gate, canvas bounds, color/depth checks. Header facts can seed source asset metadata and unsupported diagnostics. | PSB, unsupported dimensions, unsupported depth, or unsupported color mode are diagnostics, not runtime model structures. |
| Color mode data | Length-delimited section after header. Indexed and duotone can contain data; RGB normally has zero-length color mode data. | `deferred` | No direct layer/group mapping. Header color mode is enough for MVP preflight. | Non-empty Indexed/Duotone data requires explicit adapter support or `unsupportedFeatures`. Do not interpret duotone or indexed tables in Domain A. |
| Image resources | Length-delimited resource blocks for non-pixel document data such as resolution, thumbnails, paths, metadata, and legacy grouping resources. | `deferred` | Optional provenance/display metadata only if adapter normalizes it. Not required for layer identity, bounds, opacity, visibility, preview refs, or part mapping. | Unknown or relevant-but-unconsumed resources should be retained as adapter diagnostics if inspected. Domain A makes no image resource interpretation claim. |
| Layer and mask info | Length-delimited fourth section containing layer info, global layer mask info, and additional layer information tagged blocks. Merged image data is in the final Image Data section, not here. | `supported` | Container for adapter-normalized source layer tree and per-layer metadata. Source for `sourceLayers[]`, `sourceGroups[]`, and diagnostics. | Downstream code consumes normalized adapter output only. Direct byte walking remains future parser scope. |
| Layer records | Per-layer records include bounds rectangle, channel info, blend mode, opacity byte, clipping byte, flags including visibility, extra data length, layer mask data, blending ranges, and layer name. | `supported` | Primary source for source layer identity, bounds, opacity, visibility, source order, basic channel presence, and feature diagnostics. | Complex blend modes, clipping semantics, protection flags, and blending ranges are not rendered in Wave 20. Record as unsupported/deferred diagnostics. |
| Channel image data | Per-layer channel data records follow the layer records in the same order. Each channel begins with a compression code and encoded image bytes. | `unsupported` | No direct mapping in Domain A. Future adapter may decode this and emit texture preview references or texture source records. Wave 20 core only accepts adapter-supplied preview refs. | No raster extraction, channel decode, alpha reconstruction, or texture generation in Domain A. If a claim needs channel pixels, escalate. |
| Additional layer info | Tagged blocks after layer records. They include many Photoshop 4.0+ features such as effects, adjustment settings, fill/vector/text/smart object related data, metadata, and section divider data. | `deferred` | Broad source for `unsupportedFeatures[]`; known keys may inform group structure or feature diagnostics. | Treat unhandled tagged blocks as diagnostics. Do not implement Photoshop effects, text shaping, smart object expansion, vector path rasterization, or fill rendering in Wave 20. |
| Group / section divider | Additional layer info key `lsct` marks section divider type: normal layer, open folder, closed folder, or bounding section divider. | `supported` | Future adapter can normalize this into source groups, group path, source order, and candidate target part hierarchy. | Pairing open/closed/bounding section entries is parser-owned. Downstream code should receive already-normalized group records. |
| Mask | Layer mask data can include mask rectangle, default color, flags, mask parameters, real mask flags/background, and real mask rectangle. Global layer mask info also exists. | `deferred` | Adapter may record mask presence, simple mask metadata, or mask-related unsupported diagnostics. Simple source mask metadata can later inform package mask candidates. | No mask raster decode, Photoshop blending, vector mask rendering, feather/density rendering, or clipping-result claim in Wave 20. |
| Compression | Channel image data and final image data have compression codes: raw, RLE, ZIP without prediction, or ZIP with prediction. | `unsupported` | Adapter may report compression type as metadata/diagnostic. Texture previews must be supplied by adapter output, not decoded by core. | No decompression implementation or dependency addition in Domain A. If decompression is needed, escalate for dependency and parser scope. |

## Profile Field Guidance

| Adapter field / diagnostic | Supported source facts | Wave 20 rule |
|---|---|---|
| `sourceAsset.kind` | PSD signature/version from header | Use `psd-source-v1` only for adapter-supplied PSD profile results. |
| `sourceAsset.importProfile` | Wave 20 design decision | Use `layered-character-psd-profile-v1`; this is not a Cubism or Photoshop rendering contract. |
| `sourceAsset.canvasBounds` | header width/height | Supported metadata. |
| `sourceLayer.originalName` | layer name from layer extra data | Supported when adapter supplies it. Duplicate names are allowed; adapter IDs disambiguate. |
| `sourceLayer.normalizedName` | adapter normalization from original name | Supported, but normalization is project-defined, not an Adobe field. |
| `sourceLayer.groupPath` | section divider/group interpretation | Supported only after adapter normalization. |
| `sourceLayer.bounds` | layer record rectangle | Supported. Preserve top/left/bottom/right as source facts and convert only at adapter boundary. |
| `sourceLayer.visibleInSource` | layer record visibility flag | Supported source visibility; do not confuse with runtime visibility. |
| `sourceLayer.opacityInSource` | layer record opacity byte | Supported; adapter normalizes 0..255 to 0..1. |
| `sourceLayer.unsupportedFeatures[]` | blend key, masks, extra tagged blocks, color/depth/compression requirements | Supported as diagnostics. It is valid for a layer to be present but not materializable. |
| `sourceLayer.texturePreviewRef` | adapter-supplied preview result | Supported only when the adapter provides a truthful preview reference. Domain A does not derive it from PSD bytes. |
| `sourceLayer.targetPartId` | adapter/UI mapping from group/layer identity | Supported as project-defined mapping, not an Adobe field. |

## Explicit Non-Claims

- This artifact does not claim that `test_data/sample_model.psd` has been fully parsed.
- This artifact does not claim any layer count, layer name, group hierarchy, image resource content, mask content, or raster content for the sample PSD.
- This artifact does not require or approve a PSD parser dependency.
- This artifact does not authorize raster extraction, texture generation from PSD bytes, or Photoshop-compatible compositing.

## Stop / Escalate Triggers

Escalate before making any downstream claim that requires:

- reading actual layer tree content from PSD bytes;
- interpreting image resource blocks;
- decoding channel image data or final image data;
- implementing RLE/ZIP decompression;
- rendering masks, effects, text, smart objects, vector shapes, fill layers, or blend modes;
- storing or copying PSD binary assets into fixtures or package files.
