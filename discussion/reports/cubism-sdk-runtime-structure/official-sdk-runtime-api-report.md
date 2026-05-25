# Official SDK Runtime API Report

> Research date: 2026-05-25  
> Scope: Official Live2D Cubism SDK/Core documentation for runtime structures exposed after loading `.moc3` / creating a runtime model.  
> Allowed source posture: official Live2D manuals, official Core API PDF, and Live2D-owned GitHub framework source only where the official Web SDK manual points to the framework.

## 1. Bottom Line

Official Cubism SDK/Core APIs expose enough runtime structure to build a `.model3.json` + `.moc3` inspector for:

- model canvas size/origin/unit scale;
- parameter IDs, values, min/max/default, parameter type, repeat/key data;
- part IDs, opacities, parent part indices, and Cubism 5.3+ offscreen links;
- drawable IDs, texture indices, draw order, render order, opacity, masks, vertices, UVs, triangle indices, parent part indices, blend/culling/static flags, visibility/dynamic-change flags, and Cubism 5.3+ offscreen render objects.

The official API surface is runtime/rendering oriented. It does not document recovery of Cubism Editor authoring structures such as deformers, keyform timelines, PSD/source layer data, full ArtMesh editing semantics, or a public `.moc3` binary schema. Bounds are documented indirectly through canvas information and vertex positions; no official per-drawable bounds API was found.

## 2. Official Source Set

Primary official sources:

- [Cubism Core API Reference page](https://docs.live2d.com/en/cubism-sdk-manual/cubism-core-api-reference/) and [English Cubism Core API Reference r15 PDF](https://cubism.live2d.com/sdk-doc/reference/NativeCoreAPIReference_en_r15.pdf), last updated 2025-10-30.
- [Cubism Core manual](https://docs.live2d.com/en/cubism-sdk-manual/cubism-core/), updated 2026-01-08.
- [About Models (Native)](https://docs.live2d.com/en/cubism-sdk-manual/model/), updated 2026-01-29.
- [About Models (Web)](https://docs.live2d.com/en/cubism-sdk-manual/model-web/), updated 2026-01-29.
- [Cubism SDK for Web](https://docs.live2d.com/en/cubism-sdk-manual/cubism-sdk-for-web/), updated 2023-05-25.
- [Parameter Operation](https://docs.live2d.com/en/cubism-sdk-manual/parameters/), updated 2026-01-29.
- [DrawableVertexPositions Range](https://docs.live2d.com/en/cubism-sdk-manual/drawablevertexpositions/), updated 2019-11-07.

Official implementation evidence used only for Web wrapper names:

- [Live2D/CubismWebFramework `CubismMoc` at commit `d4da0aa`](https://github.com/Live2D/CubismWebFramework/blob/d4da0aa07e47d2c1e4f5fa7ea6047861ea5e5d0b/src/model/cubismmoc.ts#L574-L614)
- [Live2D/CubismWebFramework `CubismModel` at commit `d4da0aa`](https://github.com/Live2D/CubismWebFramework/blob/d4da0aa07e47d2c1e4f5fa7ea6047861ea5e5d0b/src/model/cubismmodel.ts#L207-L239)

The official Web SDK page says the latest Web SDK is available on Live2D's GitHub and links `CubismWebFramework`; it also states Cubism Core itself is not published on GitHub and is included in the SDK package. Source: [Cubism SDK for Web](https://docs.live2d.com/en/cubism-sdk-manual/cubism-sdk-for-web/). The Cubism Core manual separately states Core is included in each public SDK package and is not published on GitHub under the proprietary software license. Source: [Cubism Core manual](https://docs.live2d.com/en/cubism-sdk-manual/cubism-core/).

## 3. Load Path After `.moc3`

### Official Core C API

The Core API reference describes loading `.moc3` bytes by:

1. optionally checking consistency with `csmHasMocConsistency`;
2. creating a `csmMoc*` with `csmReviveMocInPlace`;
3. getting model memory size with `csmGetSizeofModel`;
4. creating a `csmModel*` with `csmInitializeModelInPlace`;
5. using `csmModel*` as the key for later API calls.

Source: [Core API Reference r15 PDF, "Loading files"](https://cubism.live2d.com/sdk-doc/reference/NativeCoreAPIReference_en_r15.pdf).

Version APIs documented for `.moc3` compatibility:

- `csmGetLatestMocVersion()`
- `csmGetMocVersion(const void* address, const unsigned int size)`

The PDF warns that newer `.moc3` files may not be readable by older Core versions. Source: [Core API Reference r15 PDF, "File version of moc3"](https://cubism.live2d.com/sdk-doc/reference/NativeCoreAPIReference_en_r15.pdf).

### Native Framework

The Native model manual shows:

- `CubismMoc::Create(buffer, size)` creates a `CubismMoc*`;
- `CubismMoc::CreateModel()` creates a `CubismModel*`;
- the `CubismModel` instance is then used to manipulate parameters and acquire drawing information.

Source: [About Models (Native), "Create an Instance (Import .moc3 Files)"](https://docs.live2d.com/en/cubism-sdk-manual/model/).

### Web Framework

The Web model manual shows:

- loading `.moc3` bytes into memory;
- `CubismMoc.create(buffer)` creates a `CubismMoc` instance;
- `CubismMoc.createModel()` creates a `CubismModel` instance;
- the `CubismModel` instance is then used to manipulate parameters and acquire drawing information.

Source: [About Models (Web), "Create an Instance (Import .moc3 Files)"](https://docs.live2d.com/en/cubism-sdk-manual/model-web/).

The current Live2D Web Framework source has a more explicit `CubismMoc.create(mocBytes: ArrayBuffer, shouldCheckMocConsistency: boolean)` signature, internally using `Live2DCubismCore.Moc.fromArrayBuffer`, optional `hasMocConsistency`, and `createModel()` via `Live2DCubismCore.Model.fromMoc`. Source: [CubismWebFramework `cubismmoc.ts`](https://github.com/Live2D/CubismWebFramework/blob/d4da0aa07e47d2c1e4f5fa7ea6047861ea5e5d0b/src/model/cubismmoc.ts#L574-L614).

## 4. Runtime Field Map

| Runtime area | Core API names | Native/Web equivalent names found | Officially exposed? | Notes |
|---|---|---|---|---|
| Canvas/model size | `csmReadCanvasInfo` | Native `CubismModel::GetCanvasWidth`, `CubismModel::GetCanvasHeight`; Web `getPixelsPerUnit`, `getCanvasWidth`, `getCanvasHeight` | Yes | Core returns canvas size, origin, and pixels-per-unit. |
| Parameters | `csmGetParameterCount`, `csmGetParameterIds`, `csmGetParameterTypes`, `csmGetParameterMinimumValues`, `csmGetParameterMaximumValues`, `csmGetParameterDefaultValues`, `csmGetParameterValues`, `csmGetParameterRepeats`, `csmGetParameterKeyCounts`, `csmGetParameterKeyValues` | Web `getParameterCount`, `getParameterType`, `getParameterMinimumValue`, `getParameterMaximumValue`, `getParameterDefaultValue`, `getParameterId`, `getParameterValueByIndex` | Yes | Current values are writable through the returned array in Core; Framework wraps by ID/index. |
| Parts | `csmGetPartCount`, `csmGetPartIds`, `csmGetPartOpacities`, `csmGetPartParentPartIndices`, `csmGetPartOffscreenIndices` | Web `getPartCount`, `getPartId`, `getPartOpacityByIndex`, `getPartParentPartIndices`, `getPartOffscreenIndices` | Yes | Part opacity is runtime mutable; parent hierarchy is exposed as indices. |
| Drawables | `csmGetDrawableCount`, `csmGetDrawableIds`, `csmGetDrawableParentPartIndices` | Web `getDrawableCount`, `getDrawableId`, `getDrawableParentPartIndex` | Yes | Core defines Drawable as the rendering unit corresponding to an ArtMesh. |
| Texture indices | `csmGetDrawableTextureIndices` | Web `getDrawableTextureIndex`; renderer `bindTexture` APIs | Yes | Core exposes atlas/texture index, not texture file paths. File paths come from `.model3.json` / model settings. |
| Draw order | `csmGetDrawableDrawOrders` | Web `getRenderOrders`; current source does not expose a dedicated `getDrawableDrawOrder` method in the checked file | Yes in Core | DrawOrder is the Editor inspector value for an ArtMesh. |
| Render order | `csmGetRenderOrders` | Web `getRenderOrders` | Yes | Current r15 docs say `csmGetRenderOrders` is the actual draw order including offscreen objects. |
| Masks/clipping | `csmGetDrawableMaskCounts`, `csmGetDrawableMasks`; offscreen variants in 5.3+ | Web `getDrawableMaskCounts`, `getDrawableMasks`, `isUsingMasking`, `getDrawableInvertedMaskBit`; offscreen mask wrappers | Yes | Mask arrays contain Drawable indices. Clipping behavior is specified for rendering, not as authoring mask objects. |
| Vertex positions / UVs | `csmGetDrawableVertexCounts`, `csmGetDrawableVertexPositions`, `csmGetDrawableVertexUvs` | Web `getDrawableVertexCount`, `getDrawableVertexPositions`, `getDrawableVertices`, `getDrawableVertexUvs` | Yes | Vertex positions are 2D and depend on export canvas settings. |
| Triangle indices | `csmGetDrawableIndexCounts`, `csmGetDrawableIndices` | Web `getDrawableVertexIndexCount`, `getDrawableVertexIndices` | Yes | Index counts are multiples of 3; zero-count cases require care. |
| Opacity | `csmGetPartOpacities`, `csmGetDrawableOpacities`, `csmGetOffscreenOpacities` | Web `getPartOpacityByIndex`, `getDrawableOpacity`, `getOffscreenOpacity` | Yes | Drawable/offscreen opacity is 0.0 to 1.0. |
| Visibility/dynamic changes | `csmGetDrawableDynamicFlags`, `csmResetDrawableDynamicFlags` | Web `getDrawableDynamicFlagIsVisible`, `getDrawableDynamicFlagVisibilityDidChange`, `getDrawableDynamicFlagOpacityDidChange`, `getDrawableDynamicFlagRenderOrderDidChange`, `getDrawableDynamicFlagVertexPositionsDidChange`, `getDrawableDynamicFlagBlendColorDidChange` | Yes | Use installed Core headers for exact bit set; docs have evolved. |
| Static flags / culling / blend | `csmGetDrawableConstantFlags`, `csmGetDrawableBlendModes`, `csmGetOffscreenBlendModes`, `csmGetOffscreenConstantFlags` | Web `getDrawableCulling`, `getDrawableBlendMode`, `getDrawableColorBlend`, `getDrawableAlphaBlend`, offscreen equivalents | Yes | Blend modes and offscreen APIs are version-dependent; 5.3+ for newer offscreen/blend-mode functions. |
| Bounds | none found for per-drawable bounds | derive from vertex arrays; use canvas APIs | Partially | Official docs define vertex coordinate range, not a direct bounds getter. |

## 5. Official Facts

### 5.1 Core role and model structure

Core is documented as the library with APIs needed to handle models created by Cubism Editor as `.moc3` files. Core calculates vertex information according to model parameters and lets applications obtain vertex and rendering information such as UV and opacity; it does not provide rendering functions. Source: [Cubism Core API Reference page](https://docs.live2d.com/en/cubism-sdk-manual/cubism-core-api-reference/) and [Core API Reference r15 PDF](https://cubism.live2d.com/sdk-doc/reference/NativeCoreAPIReference_en_r15.pdf).

The Core API reference classifies model data provided by Core into three major categories: Parameter, Part, and Drawable. It describes Drawable as the collection of data necessary for rendering and notes that Drawable corresponds to an ArtMesh in the Editor. Source: [Core API Reference r15 PDF, "Data for rendering provided by Core" and "Loading and placement Drawable"](https://cubism.live2d.com/sdk-doc/reference/NativeCoreAPIReference_en_r15.pdf).

### 5.2 `.model3.json` vs `.moc3`

The Web model manual says model information is basically created in Modeler, vertex/object movement relative to parameters is recorded in `.moc3`, and physics/user-data/art-mesh companion data is output as separate files tracked by `.model3.json`. Source: [About Models (Web), "Edit Model Information"](https://docs.live2d.com/en/cubism-sdk-manual/model-web/).

For Framework loading, the Web manual assumes extracting needed model information from `.model3.json` and maintaining an instance inheriting `CubismUserModel`; each element extracted via `ICubismModelSetting` can be loaded through `CubismUserModel.load~~` functions. Source: [About Models (Web), "Import from .model3.json File Using Framework"](https://docs.live2d.com/en/cubism-sdk-manual/model-web/).

### 5.3 Canvas/model size

Core exposes canvas size, origin, and `pixelsPerUnit` via `csmReadCanvasInfo`. Source: [Core API Reference r15 PDF, "Get rendering size of model"](https://cubism.live2d.com/sdk-doc/reference/NativeCoreAPIReference_en_r15.pdf).

Native and Web model manuals use `CubismModelMatrix` with `CubismModel::GetCanvasWidth` / `CubismModel::GetCanvasHeight` and `CubismModel.getCanvasWidth` / `CubismModel.getCanvasHeight` for display sizing. Sources: [About Models (Native)](https://docs.live2d.com/en/cubism-sdk-manual/model/) and [About Models (Web)](https://docs.live2d.com/en/cubism-sdk-manual/model-web/).

The current official Web Framework source also exposes `getPixelsPerUnit`, `getCanvasWidth`, and `getCanvasHeight` over `this._model.canvasinfo`. Source: [CubismWebFramework `cubismmodel.ts` lines 207-239](https://github.com/Live2D/CubismWebFramework/blob/d4da0aa07e47d2c1e4f5fa7ea6047861ea5e5d0b/src/model/cubismmodel.ts#L207-L239).

### 5.4 Parameters

Core documents parameter element access for ID, present value, maximum, minimum, initial/default value, and type. The relevant APIs are:

- `csmGetParameterCount`
- `csmGetParameterIds`
- `csmGetParameterValues`
- `csmGetParameterMaximumValues`
- `csmGetParameterMinimumValues`
- `csmGetParameterDefaultValues`
- `csmGetParameterTypes`
- `csmGetParameterRepeats`
- `csmGetParameterKeyCounts`
- `csmGetParameterKeyValues`

Source: [Core API Reference r15 PDF, "Acquiring each element of the parameter" and individual APIs](https://cubism.live2d.com/sdk-doc/reference/NativeCoreAPIReference_en_r15.pdf).

The Core document says parameter operation is performed by getting the parameter array address and writing values; values are clamped on `csmUpdateModel()` unless repeat is set. Source: [Core API Reference r15 PDF, "Operating parameters"](https://cubism.live2d.com/sdk-doc/reference/NativeCoreAPIReference_en_r15.pdf).

The SDK parameter manual says Native and Web Frameworks support both index and ID access through `CubismIdHandle`; it lists `CubismModel::SetParameterValue` for Native and `CubismModel.setParameterValueById` for Web. Source: [Parameter Operation](https://docs.live2d.com/en/cubism-sdk-manual/parameters/).

The current Web Framework source exposes parameter count/type/min/max/default/id/value by index. Source: [CubismWebFramework `cubismmodel.ts` lines 641-701](https://github.com/Live2D/CubismWebFramework/blob/d4da0aa07e47d2c1e4f5fa7ea6047861ea5e5d0b/src/model/cubismmodel.ts#L641-L701).

### 5.5 Parts

Core documents part IDs, opacities, parent part indices, and offscreen indices:

- `csmGetPartCount`
- `csmGetPartIds`
- `csmGetPartOpacities`
- `csmGetPartParentPartIndices`
- `csmGetPartOffscreenIndices`

It also states parts are a tree structure generated by Editor operations, that parent indices expose this structure, and that `-1` indicates Root. Source: [Core API Reference r15 PDF, "Getting the parent parts of parts"](https://cubism.live2d.com/sdk-doc/reference/NativeCoreAPIReference_en_r15.pdf).

Part opacity is writable via the returned opacity array and is clamped to 0.0 to 1.0 by `csmUpdateModel`. Source: [Core API Reference r15 PDF, "Operating parts opacity"](https://cubism.live2d.com/sdk-doc/reference/NativeCoreAPIReference_en_r15.pdf).

The current Web Framework source exposes `getPartCount`, `getPartOffscreenIndices`, and `getPartParentPartIndices`, plus part ID/opacity methods near the same area. Source: [CubismWebFramework `cubismmodel.ts` lines 506-545](https://github.com/Live2D/CubismWebFramework/blob/d4da0aa07e47d2c1e4f5fa7ea6047861ea5e5d0b/src/model/cubismmodel.ts#L506-L545).

### 5.6 Drawables and geometry

Core documents Drawable as the unit of drawing, corresponding to an ArtMesh, with static data that can be cached and dynamic data affected by parameter values. It describes the Core arrays as structure-of-arrays (SOA): APIs return arrays in the same sequence, and IDs are used to search a particular element. Source: [Core API Reference r15 PDF, "Loading and placement Drawable"](https://cubism.live2d.com/sdk-doc/reference/NativeCoreAPIReference_en_r15.pdf).

Core exposes drawable geometry and render data through:

- `csmGetDrawableCount`
- `csmGetDrawableIds`
- `csmGetDrawableTextureIndices`
- `csmGetDrawableConstantFlags`
- `csmGetDrawableDynamicFlags`
- `csmGetDrawableDrawOrders`
- `csmGetRenderOrders`
- `csmGetDrawableOpacities`
- `csmGetDrawableMaskCounts`
- `csmGetDrawableMasks`
- `csmGetDrawableVertexCounts`
- `csmGetDrawableVertexPositions`
- `csmGetDrawableVertexUvs`
- `csmGetDrawableIndexCounts`
- `csmGetDrawableIndices`
- `csmGetDrawableParentPartIndices`
- `csmGetDrawableMultiplyColors`
- `csmGetDrawableScreenColors`
- `csmGetDrawableBlendModes`

Source: [Core API Reference r15 PDF, "Loading and placement Drawable" and individual APIs](https://cubism.live2d.com/sdk-doc/reference/NativeCoreAPIReference_en_r15.pdf).

The current Web Framework source exposes matching wrapper methods for drawable count, ID, texture index, vertex/index counts, vertex positions, UVs, indices, opacity, blend/culling/masks, and parent part index. Sources: [CubismWebFramework `cubismmodel.ts` lines 991-1099](https://github.com/Live2D/CubismWebFramework/blob/d4da0aa07e47d2c1e4f5fa7ea6047861ea5e5d0b/src/model/cubismmodel.ts#L991-L1099), [lines 1107-1299](https://github.com/Live2D/CubismWebFramework/blob/d4da0aa07e47d2c1e4f5fa7ea6047861ea5e5d0b/src/model/cubismmodel.ts#L1107-L1299).

### 5.7 Draw order and render order

The Core PDF distinguishes DrawOrder from RenderOrder. DrawOrder is the value referenced for determining drawing order on the ArtMesh in the Editor; the value returned by `csmGetDrawableDrawOrders` is the value in the Cubism Editor inspector. The actual drawing order for Drawable and Offscreen objects, taking draw order groups into account, is obtained with `csmGetRenderOrders()`. Source: [Core API Reference r15 PDF, "DrawOrder and RenderOrder"](https://cubism.live2d.com/sdk-doc/reference/NativeCoreAPIReference_en_r15.pdf).

The r15 PDF says the `csmGetRenderOrders` array contains Drawable indices in the first half, followed by Offscreen indices. Source: [Core API Reference r15 PDF changelog and "DrawOrder and RenderOrder"](https://cubism.live2d.com/sdk-doc/reference/NativeCoreAPIReference_en_r15.pdf).

The current Web Framework source exposes `getRenderOrders()` as a wrapper over `this._model.getRenderOrders()`. Source: [CubismWebFramework `cubismmodel.ts` lines 1006-1013](https://github.com/Live2D/CubismWebFramework/blob/d4da0aa07e47d2c1e4f5fa7ea6047861ea5e5d0b/src/model/cubismmodel.ts#L1006-L1013).

### 5.8 Masks and clipping

Core uses `csmGetDrawableMaskCounts` and `csmGetDrawableMasks` to identify which Drawables mask a Drawable. The mask values are Drawable indices. Source: [Core API Reference r15 PDF, "Apply mask on rendering"](https://cubism.live2d.com/sdk-doc/reference/NativeCoreAPIReference_en_r15.pdf).

The Core clipping specification says clipping is applied by combining mask alpha and multiplying it into the rendering source. For multiple masks, Normal composition is used for mask synthesis regardless of the Drawable's blend mode, and inverted masks invert the synthesized alpha value. Source: [Core API Reference r15 PDF, "Specification of Clipping"](https://cubism.live2d.com/sdk-doc/reference/NativeCoreAPIReference_en_r15.pdf).

The current Web Framework source exposes `getDrawableMasks`, `getDrawableMaskCounts`, `isUsingMasking`, and `getDrawableInvertedMaskBit`. Source: [CubismWebFramework `cubismmodel.ts` lines 1277-1317](https://github.com/Live2D/CubismWebFramework/blob/d4da0aa07e47d2c1e4f5fa7ea6047861ea5e5d0b/src/model/cubismmodel.ts#L1277-L1317).

### 5.9 Texture indices and texture binding

Core exposes drawable texture indices with `csmGetDrawableTextureIndices`. It does not expose image file paths. Texture file references come from `.model3.json` / model setting objects, and actual graphics API texture objects are registered through renderer-specific methods. Sources: [Core API Reference r15 PDF, "Loading and placement Drawable"](https://cubism.live2d.com/sdk-doc/reference/NativeCoreAPIReference_en_r15.pdf), [About Models (Web), "Associate Textures"](https://docs.live2d.com/en/cubism-sdk-manual/model-web/), [About Models (Native), "Associate Textures"](https://docs.live2d.com/en/cubism-sdk-manual/model/).

The Web manual says `CubismRenderer_WebGL.bindTexture` takes the model texture number, identified in the Editor by texture atlas number, and a WebGL texture management number. Source: [About Models (Web), "Associate Textures"](https://docs.live2d.com/en/cubism-sdk-manual/model-web/).

### 5.10 Dynamic flags, visibility, and update cycle

After changing parameters or part opacity, Core requires `csmUpdateModel` to reflect operations into actual Drawable vertices and opacity. The affected outputs include `csmGetDrawableDynamicFlags`, `csmGetDrawableVertexPositions`, `csmGetDrawableDrawOrders`, `csmGetDrawableOpacities`, and `csmGetRenderOrders`. Source: [Core API Reference r15 PDF, "Applying the operation to the model"](https://cubism.live2d.com/sdk-doc/reference/NativeCoreAPIReference_en_r15.pdf).

The Core PDF documents `csmResetDrawableDynamicFlags` and states it must be called before `csmUpdateModel` when tracking changed drawing information. Source: [Core API Reference r15 PDF, "Reset of DynamicFlag"](https://cubism.live2d.com/sdk-doc/reference/NativeCoreAPIReference_en_r15.pdf).

Documented dynamic flags include visibility, visibility change, opacity change, draw order change, render order change, vertex position change, and later blend color change text. Because this section has evolved across SDK releases, the adapter should decode flags through the installed SDK's constants/utilities rather than hard-coding a bit count. Source: [Core API Reference r15 PDF, "Confirmation of updated information"](https://cubism.live2d.com/sdk-doc/reference/NativeCoreAPIReference_en_r15.pdf).

The current Web Framework exposes boolean helpers for visibility and dynamic-change bits, including `getDrawableDynamicFlagIsVisible`, `getDrawableDynamicFlagVisibilityDidChange`, `getDrawableDynamicFlagOpacityDidChange`, `getDrawableDynamicFlagRenderOrderDidChange`, `getDrawableDynamicFlagVertexPositionsDidChange`, and `getDrawableDynamicFlagBlendColorDidChange`. Source: [CubismWebFramework `cubismmodel.ts` lines 1334-1410](https://github.com/Live2D/CubismWebFramework/blob/d4da0aa07e47d2c1e4f5fa7ea6047861ea5e5d0b/src/model/cubismmodel.ts#L1334-L1410).

### 5.11 Offscreen data and newer blend modes

The r15 Core PDF includes Cubism 5.3+ offscreen APIs:

- `csmGetOffscreenCount`
- `csmGetOffscreenBlendModes`
- `csmGetOffscreenOpacities`
- `csmGetOffscreenOwnerIndices`
- `csmGetOffscreenMultiplyColors`
- `csmGetOffscreenScreenColors`
- `csmGetOffscreenMaskCounts`
- `csmGetOffscreenMasks`
- `csmGetOffscreenConstantFlags`

Source: [Core API Reference r15 PDF, individual offscreen APIs](https://cubism.live2d.com/sdk-doc/reference/NativeCoreAPIReference_en_r15.pdf).

The PDF states `csmGetOffscreenCount` returns `0` when offscreen is not set or when the model is from version 5.2 or earlier. Source: [Core API Reference r15 PDF, `csmGetOffscreenCount`](https://cubism.live2d.com/sdk-doc/reference/NativeCoreAPIReference_en_r15.pdf).

The current Web Framework exposes matching offscreen wrappers such as `getOffscreenCount`, `getOffscreenOwnerIndices`, `getOffscreenOpacity`, `getOffscreenMasks`, and `getOffscreenMaskCounts`. Source: [CubismWebFramework `cubismmodel.ts` lines 1422-1496](https://github.com/Live2D/CubismWebFramework/blob/d4da0aa07e47d2c1e4f5fa7ea6047861ea5e5d0b/src/model/cubismmodel.ts#L1422-L1496).

### 5.12 Bounds and coordinate ranges

Core exposes model canvas information and per-drawable vertex positions, not direct per-drawable bounds. The official DrawableVertexPositions page states that vertex information refers to XY coordinates obtained by `CubismModel::GetDrawableVertexPositions` in Framework and `csmGetDrawableVertexPositions` in Core, and that the values depend on export settings from the Editor. Source: [DrawableVertexPositions Range](https://docs.live2d.com/en/cubism-sdk-manual/drawablevertexpositions/).

Feasible inference: per-drawable bounds can be computed by scanning each drawable's current `vertexPositions` after `csmUpdateModel` / `CubismModel.update`, but this is an application-derived value, not an official Core getter.

## 6. Inferred Facts

These are engineering inferences from official APIs, not guarantees beyond the documented API contracts:

- A runtime inspector can produce a stable structured output by treating Core arrays as indexed SOA tables: parameters, parts, drawables, and offscreens each have counts plus parallel arrays.
- Drawable masks can be represented as index references to other drawables because `csmGetDrawableMasks[d][i]` yields drawable numbers.
- Texture file paths should be joined from `.model3.json` / `ICubismModelSetting`; Core only supplies drawable texture indices.
- Bounds can be derived from current vertex arrays but should be labeled "computed bounds" and regenerated after parameter updates.
- Web SDK extraction should prefer Framework `CubismModel` methods when available; direct use of underscored fields such as `_model.drawables` is implementation detail unless the installed SDK exposes a public typed API for it.

## 7. Unknowns and Non-Guaranteed Areas

- No official public `.moc3` binary layout/schema was found in the official docs searched.
- No official SDK/Core API was found for reconstructing full Cubism Editor authoring state: deformer hierarchy, keyform timelines, source PSD layers, original mesh-editing handles, modeling history, or `.cmo3` project state.
- No direct official per-drawable bounds API was found.
- The Core API reference is Native C oriented. Web equivalents are documented at the loading/usage level in the manual, but the detailed Web wrapper method map above relies on the official Live2D Web Framework source.
- Current r15 offscreen and expanded blend-mode APIs are version-dependent. A loader should check installed Core/SDK version and `.moc3` version before assuming those arrays exist.
- The exact stability of `develop` branch Web Framework method names is not guaranteed by this report. For implementation, pin to a downloaded SDK package or a specific Live2D repository commit.

## 8. Feasibility Judgment

| Capability | Official-doc feasibility | Reason |
|---|---|---|
| Load `.moc3` and create runtime model | High | Core, Native Framework, and Web Framework manuals document the load path. |
| Inspect parameters/parts/drawables | High | Core API explicitly exposes counts, IDs, values, hierarchy indices, drawable geometry, masks, texture indices, opacity, and flags. |
| Build render-oriented structured JSON | High | Official arrays map cleanly to JSON tables, with source category labels. |
| Compute current drawable bounds | Medium | Data exists via vertex arrays, but bounds are computed by the application, not an official getter. |
| Recover editor-level rig/source structure | Low / unsupported by official docs | Runtime APIs expose render/runtime structures, not authoring project semantics. |
| Use runtime data as editable Cubism source | Low | The official surface supports runtime manipulation and rendering, not `.moc3` authoring or `.cmo3` round-trip editing. |

Recommended project stance: use official SDK/Core for runtime intake, preview, validation, and structured runtime inspection. Do not phrase acceptance criteria as "reconstructs editable Cubism project state from `.moc3`" unless separate non-official reverse-engineering or Editor-mediated workflow research is explicitly approved.

## 9. Recommended Inspector Output Categories

For the planned local Web/Core loader, classify each output field:

- `source: "model3.json"` for file references, texture paths, physics/user-data/display-info paths, motions, expressions, groups, and layout settings.
- `source: "cubism-core-runtime"` for canvas info, parameter/part/drawable/offscreen arrays, geometry, indices, masks, orders, opacity, flags, and blend data.
- `source: "computed"` for bounds, aggregate counts, mask graph summaries, and validation warnings.
- `source: "unavailable-official-api"` for editor-only structures not exposed by official runtime APIs.

Minimum Core-backed fields:

- `canvas`: width, height, origin if available, pixelsPerUnit.
- `parameters[]`: index, id, type, value, min, max, default, repeat, keyValues if available.
- `parts[]`: index, id, opacity, parentPartIndex, offscreenIndex if available.
- `drawables[]`: index, id, parentPartIndex, textureIndex, drawOrder, renderOrder, opacity, vertexCount, indexCount, vertices, uvs, indices, masks, maskCount, constantFlags, dynamicFlags, visibility, blend/culling/invertedMask fields where available.
- `offscreens[]`: index, ownerPartIndex, renderOrder, opacity, masks, blend/constant flags where supported by the installed SDK/Core.
- `computedBounds`: current model/drawable bounds derived from vertices, with update timestamp or parameter-state hash if needed.

## 10. Open Verification Items

- Verify the exact Web SDK package version intended for the adapter, because the manual example and current framework source differ on `CubismMoc.create` arguments.
- Confirm whether the installed Web Core exposes a public TypeScript declaration for lower-level `Live2DCubismCore.Model` fields, or whether the adapter should strictly use `CubismModel` wrapper methods.
- Run a local sample model through the target SDK to confirm actual availability of offscreen arrays, blend-mode arrays, parameter repeat/key arrays, and dynamic flag helper methods.
- Decide whether output should preserve all raw runtime arrays or normalize them into stable project-specific names.

## 11. Research Performed

- Read the repository basis documents listed in the task prompt, including the runtime-structure topic map and prior `.cmo3` / `.moc3` feasibility and local loader planning reports.
- Searched current official Live2D documentation for Cubism Core, Cubism Core API reference, Cubism SDK for Web, model loading, parameters, and drawable vertex position range.
- Opened the current Core API Reference r15 PDF from Live2D and checked load flow, canvas, parameters, parts, drawables, dynamic flags, clipping, draw/render order, vertex/index arrays, offscreen APIs, and individual API names.
- Checked Live2D-owned `CubismWebFramework` source at commit `d4da0aa07e47d2c1e4f5fa7ea6047861ea5e5d0b` for Web wrapper names where the manual does not enumerate all methods.

This report is technical feasibility research, not legal advice.
