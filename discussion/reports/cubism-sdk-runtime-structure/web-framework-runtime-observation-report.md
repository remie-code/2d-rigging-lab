# Cubism SDK for Web Runtime Observation Report

> Date: 2026-05-25 JST  
> Scope: Cubism SDK for Web / CubismWebFramework source and official samples, focused on what a local inspector can observe after loading `.model3.json` plus `.moc3`.

## 1. Key Conclusion

A Web inspector built on official Cubism SDK for Web can observe the runtime rendering structure needed to display and debug an exported model: package settings, runtime parameters, parts, drawables, canvas dimensions, texture indices, render order, mesh vertices/UVs/indices, opacities, clipping mask references, and dynamic drawable flags.

It should not be treated as an authoring-project inspector. The official embedded runtime files and Web Framework APIs do not expose the original Cubism Editor project state: deformer hierarchy, modeling keyforms, source PSD/layer structure, or the full `.cmo3` authoring graph. Runtime parent-part/drawable hierarchy is observable; editor deformer hierarchy is not.

## 2. Sources Checked

### Official repositories

- CubismWebFramework repository: <https://github.com/Live2D/CubismWebFramework>
- Latest CubismWebFramework release observed through GitHub API: `5-r.5`, "Cubism 5 SDK for Web R5", published 2026-04-02: <https://github.com/Live2D/CubismWebFramework/releases/tag/5-r.5>
- CubismWebSamples repository: <https://github.com/Live2D/CubismWebSamples>
- Latest CubismWebSamples release observed through GitHub API: `5-r.5`, "Cubism 5 SDK for Web R5", published 2026-04-02: <https://github.com/Live2D/CubismWebSamples/releases/tag/5-r.5>

### Official docs

- Cubism SDK for Web overview/download: <https://www.live2d.com/en/sdk/about/> and <https://www.live2d.com/en/sdk/download/web/>
- How to Use CubismWebFramework Directly: <https://docs.live2d.com/en/cubism-sdk-manual/use-framework-web/>
- About Models (Web): <https://docs.live2d.com/en/cubism-sdk-manual/model-web/>
- Cubism Core API Reference page: <https://docs.live2d.com/en/cubism-sdk-manual/cubism-core-api-reference/>
- Editor file types: <https://docs.live2d.com/en/cubism-editor-manual/file-type-and-extension/>
- Embedded export files: <https://docs.live2d.com/en/cubism-editor-manual/export-moc3-motion3-files/>
- Cubism Viewer for OW loading boundary: <https://docs.live2d.com/en/cubism-editor-manual/cubism3-viewer-for-ow/>

### Local basis and reference package

- Basis docs read:
  - `discussion/_conventions.md`
  - `discussion/reports/cubism-sdk-runtime-structure/_map.md`
  - `discussion/reports/cmo3-moc3-format-spec/sdk-web-local-loader-plan.md`
- Local reference package inspected:
  - `ref/kipfel2_vts/黒シャツキプフェル.model3.json`
  - `ref/kipfel2_vts/黒シャツキプフェル.physics3.json`
  - `ref/kipfel2_vts/黒シャツキプフェル.cdi3.json`

## 3. Official Facts

- The official Web Framework repository says it provides functions for displaying/manipulating models and is used together with Live2D Cubism Core to load models. It also states Cubism Core for Web is not included in that repository and must be downloaded from the Cubism SDK for Web page. Source: <https://github.com/Live2D/CubismWebFramework#live2d-cubism-core-for-web>
- The SDK manual says `.model3.json` describes the model's built-in data with relative paths, and recommends parsing it with `CubismModelSettingJson` to obtain model file paths. Source: <https://docs.live2d.com/en/cubism-sdk-manual/use-framework-web/>
- The same manual states that the `.moc3` path can be obtained from `.model3.json`, and that facial expression, physics, pose, eye blinking, lip-sync, user data, and motion paths are similarly obtained from `.model3.json`. Source: <https://docs.live2d.com/en/cubism-sdk-manual/use-framework-web/>
- Cubism Core's documented role is to handle `.moc3` models, calculate vertex information from parameters, and provide vertex/rendering data such as UV and opacity; drawing itself is outside Core. Source: <https://docs.live2d.com/en/cubism-sdk-manual/cubism-core-api-reference/>
- Official embedded export docs define `.moc3` as model data for applications and `.model3.json` as JSON linking MOC3 files, texture files, and related runtime files. They also list `.physics3.json`, `.userdata3.json`, `.cdi3.json`, `.paramctrl3.json`, and `.motion3.json` as embedded/runtime files. Source: <https://docs.live2d.com/en/cubism-editor-manual/export-moc3-motion3-files/>
- Official file-type docs distinguish `.cmo3` editor model files from `.moc3` program/runtime model data. Source: <https://docs.live2d.com/en/cubism-editor-manual/file-type-and-extension/>
- Cubism Viewer for OW loads embedded data such as `.moc3` or `.model3.json`; the docs explicitly say `.cmo3` and `.can3` editing files cannot be loaded by that Viewer. Source: <https://docs.live2d.com/en/cubism-editor-manual/cubism3-viewer-for-ow/>

## 4. Code-Level Observations

### Load pipeline

Official sample `LAppModel.loadAssets()` fetches `.model3.json`, constructs `CubismModelSettingJson`, and calls `setupModel()`.

- `LAppModel.loadAssets()`: <https://github.com/Live2D/CubismWebSamples/blob/develop/Samples/TypeScript/Demo/src/lappmodel.ts#L91-L106>
- `LAppModel.setupModel()` obtains the MOC filename from `this._modelSetting.getModelFileName()`, fetches it, then calls `this.loadModel(...)`: <https://github.com/Live2D/CubismWebSamples/blob/develop/Samples/TypeScript/Demo/src/lappmodel.ts#L120-L149>
- `CubismUserModel.loadModel()` creates `CubismMoc`, creates `CubismModel`, saves parameters, and creates a `CubismModelMatrix` from runtime canvas width/height: <https://github.com/Live2D/CubismWebFramework/blob/develop/src/model/cubismusermodel.ts#L138-L158>
- `CubismMoc.create()` calls `Live2DCubismCore.Moc.fromArrayBuffer(...)`; `CubismMoc.createModel()` calls `Live2DCubismCore.Model.fromMoc(...)` and wraps it as `CubismModel`: <https://github.com/Live2D/CubismWebFramework/blob/develop/src/model/cubismmoc.ts#L20-L80>
- `CubismUserModel.createRenderer()` creates `CubismRenderer_WebGL` and initializes it with the `CubismModel`: <https://github.com/Live2D/CubismWebFramework/blob/develop/src/model/cubismusermodel.ts#L363-L374>

### Model settings

`CubismModelSettingJson` exposes structured accessors for common `.model3.json` fields:

- MOC file, texture count, texture path, hit areas, physics, pose: <https://github.com/Live2D/CubismWebFramework/blob/develop/src/cubismmodelsettingjson.ts#L95-L210>
- expressions and motion groups/files: <https://github.com/Live2D/CubismWebFramework/blob/develop/src/cubismmodelsettingjson.ts#L217-L320>
- layout, EyeBlink IDs, LipSync IDs: <https://github.com/Live2D/CubismWebFramework/blob/develop/src/cubismmodelsettingjson.ts#L383-L521>
- raw JSON access is public via `getJson()`: <https://github.com/Live2D/CubismWebFramework/blob/develop/src/cubismmodelsettingjson.ts#L87-L89>

Observation: in the inspected `develop` source, there is no dedicated `getDisplayInfoFileName()` method in `CubismModelSettingJson`. An inspector should parse `FileReferences.DisplayInfo` from the raw JSON or from its own JSON parse.

### Runtime model accessors

`CubismModel` exposes or wraps the following runtime structures:

| Area | Observable fields / APIs | Evidence |
|---|---|---|
| Canvas | pixels-per-unit, canvas width, canvas height | `getPixelsPerUnit()`, `getCanvasWidth()`, `getCanvasHeight()` in <https://github.com/Live2D/CubismWebFramework/blob/develop/src/model/cubismmodel.ts#L207-L238> |
| Parts | count, ID, opacity, parent part indices, offscreen indices, derived part hierarchy | <https://github.com/Live2D/CubismWebFramework/blob/develop/src/model/cubismmodel.ts#L505-L586> and <https://github.com/Live2D/CubismWebFramework/blob/develop/src/model/cubismmodel.ts#L1647-L1718> |
| Parameters | count, ID, type, min, max, default, current value, repeat | <https://github.com/Live2D/CubismWebFramework/blob/develop/src/model/cubismmodel.ts#L641-L705> and <https://github.com/Live2D/CubismWebFramework/blob/develop/src/model/cubismmodel.ts#L929-L930> |
| Drawables | count, ID, texture index, vertex/index counts, vertices, vertex positions, UVs, indices, opacity | <https://github.com/Live2D/CubismWebFramework/blob/develop/src/model/cubismmodel.ts#L991-L1109> |
| Drawable relationships | parent part index, blend mode, color blend, alpha blend, inverted mask bit | <https://github.com/Live2D/CubismWebFramework/blob/develop/src/model/cubismmodel.ts#L1209-L1283> |
| Masks | drawable mask index arrays and mask counts | <https://github.com/Live2D/CubismWebFramework/blob/develop/src/model/cubismmodel.ts#L1289-L1300> |
| Dynamic flags | visible, visibility changed, opacity changed, render-order changed, blend-color changed, vertex-position changed | <https://github.com/Live2D/CubismWebFramework/blob/develop/src/model/cubismmodel.ts#L1034-L1041> and <https://github.com/Live2D/CubismWebFramework/blob/develop/src/model/cubismmodel.ts#L1341-L1415> |
| Render order | runtime sorted order via `getRenderOrders()` | <https://github.com/Live2D/CubismWebFramework/blob/develop/src/model/cubismmodel.ts#L1006-L1013> |

### Renderer and clipping behavior

- `CubismRenderer_WebGL.initialize()` creates clipping managers when the model reports masking/offscreen masking, sizes sorted object arrays, then calls the base renderer initializer: <https://github.com/Live2D/CubismWebFramework/blob/develop/src/rendering/cubismrenderer_webgl.ts#L495-L528>
- `CubismClippingManager.initializeForDrawable()` scans every drawable, reads `model.getDrawableMaskCounts()` and `model.getDrawableMasks()`, groups shared mask contexts, and records which drawable is clipped by which mask context: <https://github.com/Live2D/CubismWebFramework/blob/develop/src/rendering/cubismclippingmanager.ts#L121-L149>
- Renderer draw order is based on `model.getRenderOrders()`, sorted into `_sortedObjectsIndexList` / `_sortedObjectsTypeList`, then rendered in order: <https://github.com/Live2D/CubismWebFramework/blob/develop/src/rendering/cubismrenderer_webgl.ts#L896-L928>
- WebGL draw submission uses the drawable vertex index count and issues `gl.drawElements(...)`: <https://github.com/Live2D/CubismWebFramework/blob/develop/src/rendering/cubismrenderer_webgl.ts#L1097-L1105>

### Draw order versus render order

Render order is directly exposed in the Web Framework through `CubismModel.getRenderOrders()`.

Draw order is more nuanced:

- The inspected Web Framework `CubismModel` source does not expose a dedicated `getDrawableDrawOrders()` method.
- Official Core API reference material still lists draw-order retrieval as a Core concept/API, while Cubism 5 changed drawable render order retrieval to model-level `csmGetRenderOrders()`. Source: <https://docs.live2d.com/en/cubism-sdk-manual/cubism-core-api-reference/>
- `CubismModel.getModel()` returns the raw `Live2DCubismCore.Model`: <https://github.com/Live2D/CubismWebFramework/blob/develop/src/model/cubismmodel.ts#L467-L469>

Feasibility judgment: render order is safely obtainable through Web Framework. Draw order is likely obtainable only by using the underlying Web Core model object if the Web Core distribution exposes `model.drawables.drawOrders` or an equivalent binding, but that is not confirmed by the public Web Framework source alone. Treat draw order as an implementation-time verification item.

## 5. Practical Inspector Field Map

### Safely obtainable from `.model3.json`

- `Version`
- `FileReferences.Moc`
- `FileReferences.Textures[]`
- `FileReferences.Physics`
- `FileReferences.Pose`, when present
- `FileReferences.Expressions[]`, when present
- `FileReferences.Motions`, when present
- `FileReferences.DisplayInfo`, by raw JSON parse
- `Groups[]` including EyeBlink/LipSync parameter IDs
- `HitAreas[]`, when present
- `Layout`, when present

Recommended implementation: parse `.model3.json` directly with normal JSON parsing for full fidelity, and optionally instantiate `CubismModelSettingJson` for parity with the official sample loader.

### Safely obtainable from sibling JSON files

- From `.physics3.json`: physics metadata, setting IDs/names, input sources, output destinations, normalization, particles, gravity/wind, FPS when present.
- From `.cdi3.json`: parameter display names, part display names, group IDs/names, and parameter linkage display information.
- From `.userdata3.json`, `.motion3.json`, `.exp3.json`, `.pose3.json`, `.motionsync3.json`, `.paramctrl3.json`: parse if present and needed. These are exported runtime/supplemental files, not the `.moc3` core runtime mesh itself.

### Obtainable after successful `.moc3` load through SDK/Core

- Load status and MOC consistency/version checks:
  - `CubismMoc.hasMocConsistency(...)`
  - `CubismMoc.getMocVersionFromBuffer(...)`
  - sample `hasMocConsistencyFromFile()`: <https://github.com/Live2D/CubismWebSamples/blob/develop/Samples/TypeScript/Demo/src/lappmodel.ts#L950-L968>
- Canvas info:
  - width, height, pixels-per-unit.
- Parameters:
  - index, ID, type, minimum, maximum, default, current value, repeat.
- Parts:
  - index, ID, opacity, parent part index, offscreen index, runtime part/drawable child relation.
- Drawables:
  - index, ID, texture index, opacity, culling, blend mode, multiply/screen color, parent part index.
  - vertex count, index count, vertex positions, UVs, triangle indices.
  - mask counts and mask drawable index lists.
  - inverted mask bit.
  - dynamic flags for visibility, opacity changes, render-order changes, blend-color changes, vertex-position changes.
  - render order via `getRenderOrders()`.

### Conditional or needs direct verification

- Draw order:
  - Official Core has draw-order concepts/API, but the public Web Framework wrapper inspected here does not expose a typed convenience method.
  - Verify against the actual downloaded Web Core JS/WASM package before making this a required output field.
- Dynamic flags:
  - Accessors exist, and renderer code uses them.
  - The exact timing for a standalone inspector should be tested around `model.update()` and the sample render loop, because flags are frame/update-state dependent.
- Offscreen drawing fields introduced by newer Cubism 5.3 paths:
  - Web Framework source contains offscreen-related accessors and renderer paths, but a model that actually uses these features should be tested before committing schema requirements.

## 6. Local Reference Package Observation

The local package under `ref/kipfel2_vts/` is a good first smoke-test target for the JSON side of the inspector:

| Item | Observed local fact |
|---|---|
| `.model3.json` | `黒シャツキプフェル.model3.json` |
| MOC reference | `黒シャツキプフェル.moc3` |
| Textures | 1 texture path |
| Physics reference | present |
| DisplayInfo reference | present |
| Groups | 1 `EyeBlink` group with empty `Ids` |
| `.cdi3.json` | 29 parameters, 20 parts |
| `.physics3.json` | 2 physics settings, 6 total inputs, 3 total outputs |

These are repository facts from JSON parsing only. Runtime counts for parameters, parts, drawables, masks, and vertices still require loading the `.moc3` through a local Cubism Core for Web package.

## 7. Likely Not Obtainable From Runtime Intake

The following should be classified as not obtainable or not reliably reconstructable from `.model3.json` + `.moc3` + runtime JSON siblings:

- Original `.cmo3` project graph and Cubism Editor workspace state.
- Original `.can3` animation project state.
- Deformer hierarchy and editor deformer objects as authored in Cubism Editor.
- Modeling keyforms / parameter-keyform grid used to author deformations.
- Original PSD/layer hierarchy and source art layer metadata.
- Editor-only hidden/guide state unless it was exported into runtime files or reflected in runtime output.
- Complete semantic intent of ArtMeshes beyond runtime IDs, parent parts, vertices, masks, draw order/render order, texture atlas UVs, and display names from `.cdi3.json`.

Reasoning:

- Official file-type docs identify `.cmo3` as editor model data and `.moc3` as model data used in programs.
- Official embedded export docs list the runtime/exported artifacts and do not list source PSDs, editor deformer trees, or `.cmo3` internals as embedded outputs.
- The inspected Web Framework classes expose runtime model, parameter, part, drawable, mask, physics/pose/motion loading, and renderer-facing data, but no authoring deformer/keyform/PSD accessors.

## 8. Recommendations For The Sample Inspector

Use a two-layer extraction model:

1. `packageJsonFacts`
   - Parse `.model3.json`, `.physics3.json`, `.cdi3.json`, and any optional sibling JSON files directly.
   - Preserve raw relative paths and source file names.
   - Add a `source: "model3.json" | "physics3.json" | "cdi3.json"` marker per field group.

2. `runtimeCoreFacts`
   - Load `.moc3` through `CubismMoc.create(...)` and `CubismUserModel.loadModel(...)` or an equivalent narrow adapter.
   - Extract `CubismModel` counts and arrays through public Web Framework accessors where available.
   - Convert typed arrays to normal JSON arrays only at export boundaries.
   - Run one controlled `model.update()` before extracting frame-dependent drawable values, then record the update timing in output metadata.

Keep draw order optional until tested against the actual Web Core package. Render order should be required.

## 9. Assumptions

- The inspector will use an official, locally supplied Cubism SDK/Core for Web distribution and will not commit or redistribute Core files.
- The public `develop` branches and latest `5-r.5` releases are representative of the current official SDK for Web behavior as of this report date.
- Raw `.model3.json`, `.physics3.json`, and `.cdi3.json` parsing is acceptable in addition to using `CubismModelSettingJson`.
- The goal is observation/export for inspection, not reconstruction of an editable Cubism project.

## 10. Open Questions

- Does the current downloaded Cubism Core for Web expose drawable draw orders on the JavaScript `Live2DCubismCore.Model` object, and if so under what property or method name?
- What is the most stable sample timing for dynamic flags: immediately after `CubismModel.update()`, immediately before renderer draw, or after the sample's full update scheduler?
- Should an inspector include Cubism 5.3 offscreen fields in the first schema, or keep them behind feature detection until a model using offscreen/blend-mode features is available?
- Should `DisplayInfo` remain a raw JSON field, or should a small local typed parser be added for `.cdi3.json` display names and linkage metadata?
- If authoring-level hierarchy is required later, should the project depend on `.cmo3`/Editor APIs instead of runtime `.moc3` inspection?
