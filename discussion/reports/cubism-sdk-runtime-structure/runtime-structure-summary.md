# Cubism SDK Runtime Structure Summary

> Date: 2026-05-25 JST  
> Purpose: Decision-oriented synthesis for the planned Web inspector sample.  
> Scope: Synthesis of the listed basis reports only; no new broad web research was performed.

## 1. Executive Decision

Build the first Web inspector as a runtime/package observer, not as an authoring-project recovery tool.

The stable first contract should export:

- package facts from `.model3.json`, `.physics3.json`, and `.cdi3.json`;
- SDK/Core runtime facts after `.moc3` load: canvas, parameters, parts, and basic drawables;
- derived joins and diagnostics;
- an explicit unavailable-authoring-data section.

Do not promise reconstruction of `.cmo3`, deformer hierarchy, keyform authoring data, PSD/source layer structure, or a public `.moc3` binary schema. The SDK/Core surface documented in the basis reports is render/runtime oriented.

## 2. Official Facts

These are facts from official Live2D documentation as reported in the basis documents.

- Cubism Core is the library for handling `.moc3` runtime models. It calculates vertex information from model parameters and exposes rendering data such as UVs and opacity; it does not render by itself. Sources: Cubism Core API Reference page and r15 PDF, <https://docs.live2d.com/en/cubism-sdk-manual/cubism-core-api-reference/> and <https://cubism.live2d.com/sdk-doc/reference/NativeCoreAPIReference_en_r15.pdf>.
- Official Core APIs classify runtime data into Parameters, Parts, and Drawables. Drawable is the rendering unit corresponding to an ArtMesh in the Editor. Source: Core API Reference r15 PDF.
- Official loading flow is documented: check `.moc3` consistency/version when available, revive/create a Moc, allocate/create a runtime Model, then query model arrays. Web Framework manuals describe `CubismMoc.create(buffer)` followed by `CubismMoc.createModel()`. Sources: Core API Reference r15 PDF and About Models (Web), <https://docs.live2d.com/en/cubism-sdk-manual/model-web/>.
- Official APIs expose canvas/model size, parameter IDs and values, parameter min/max/default/type/repeat/key values, part IDs/opacities/parent indices, drawable IDs, texture indices, masks, vertices, UVs, triangle indices, opacities, render order, flags, culling/blend data, and newer offscreen-related data where the Core/SDK version supports it.
- `.model3.json` is the model setting file linking the `.moc3`, textures, and optional runtime companion files. Physics, user data, display info, motions, expressions, and related settings are separate runtime/exported files when present. Sources: About Models (Web), Data for Embedded Use, and File Types and Extensions: <https://docs.live2d.com/en/cubism-sdk-manual/model-web/>, <https://docs.live2d.com/en/cubism-editor-manual/export-moc3-motion3-files/>, <https://docs.live2d.com/en/cubism-editor-manual/file-type-and-extension/>.
- Cubism Core is included in official SDK packages and is not published on GitHub. A local SDK/Core installation is required for `.moc3` runtime loading in the Web sample. Sources: Cubism Core manual and Cubism SDK for Web manual: <https://docs.live2d.com/en/cubism-sdk-manual/cubism-core/>, <https://docs.live2d.com/en/cubism-sdk-manual/cubism-sdk-for-web/>.
- No official public `.moc3` binary schema or official API for reconstructing Cubism Editor authoring state was found in the basis research.

## 3. Source-Code Observations

These are observations from Live2D-owned Web Framework/Samples source as captured in the basis reports. They are practical evidence, but the implementation should still pin and test the local SDK version.

- The official Web sample load pipeline fetches `.model3.json`, constructs `CubismModelSettingJson`, fetches the referenced `.moc3`, loads it through `CubismUserModel.loadModel()`, creates a `CubismMoc`, creates a `CubismModel`, and initializes a renderer.
- `CubismModelSettingJson` exposes many `.model3.json` accessors for the MOC file, textures, hit areas, physics, pose, expressions, motions, layout, EyeBlink IDs, and LipSync IDs. The inspected source did not expose a dedicated `getDisplayInfoFileName()` method, so `FileReferences.DisplayInfo` should be parsed directly from JSON.
- `CubismModel` source exposes practical runtime accessors for canvas, parameters, parts, drawables, masks, texture indices, vertices, UVs, indices, opacities, culling/blend/color fields, dynamic flags, render orders, and newer offscreen fields.
- Render order is safely observable through Web Framework `getRenderOrders()`. Draw order is documented in Core, but the inspected Web Framework wrapper did not expose a dedicated typed convenience method; treat draw order as optional until verified against the local Web Core binding.
- Dynamic flags and current drawable vertices are frame/update-state dependent. A standalone inspector should run a controlled update before reading them and record when the read happened.

Primary source-code URLs recorded in the basis reports:

- CubismWebFramework: <https://github.com/Live2D/CubismWebFramework>
- CubismWebSamples: <https://github.com/Live2D/CubismWebSamples>
- Example inspected `CubismModel` source: <https://github.com/Live2D/CubismWebFramework/blob/develop/src/model/cubismmodel.ts>

## 4. Repository Facts

These are project-local facts from the basis reports.

- The project has a local reference package under `ref/kipfel2_vts/`.
- Its `.model3.json` references one `.moc3`, one texture, one `.physics3.json`, and one `.cdi3.json` display-info file.
- The `.physics3.json` observation reports 2 physics settings, 6 total inputs, 3 total outputs, 4 total vertices, and FPS 60.
- The `.cdi3.json` observation reports 29 parameters, 0 parameter groups, and 20 parts.
- A `.vtube.json` sidecar exists and contains VTube Studio-specific metadata, including 20 parameter settings. This is not an official Cubism package file and should stay in a separate optional output section.
- No SDK/Core runtime load was performed in the field-map report. Runtime parameter, part, drawable, mask, vertex, and render-order counts for the local model still need a real Web SDK/Core run.
- The local loader plan records the project policy: SDK/Core is local-user supplied, not committed, not redistributed, and independent `.moc3` parsing/writing remains out of scope.

## 5. Assumptions

- The first implementation target is a local Web sample using an official, locally supplied Cubism SDK/Core for Web.
- The sample is for local/personal inspection and export, not public hosting or redistribution.
- It is acceptable to parse companion JSON files directly with normal JSON parsing, while using Cubism SDK/Core only for `.moc3` runtime model intake.
- The first sample should optimize for trustworthy source attribution over maximum field coverage.
- Large geometry arrays can be deferred or placed behind a detail mode without weakening the first sample's usefulness.

## 6. Realistic Structured Output

The Web sample can realistically output these categories.

### Must-Have For First Sample

| Area | Fields | Source class |
|---|---|---|
| Output metadata | schema version, generated timestamp, target path, diagnostics | derived |
| Capabilities | JSON inspection available, SDK/Core available, runtime model loaded, runtime error if any | derived / SDK runtime |
| Package graph | `.model3.json` version, MOC path, texture paths, physics path, display-info path, groups, referenced-file existence | `model3.json` / derived |
| Display info | parameter IDs/names/group IDs, part IDs/names | `cdi3.json` |
| Physics summary | version, meta counts, gravity/wind, setting IDs/names, input/output/vertex counts | `physics3.json` / derived |
| Runtime load | MOC path, load success/failure, error summary, optional MOC version if exposed | SDK/Core runtime / derived |
| Runtime canvas | width, height, pixels per unit | SDK/Core runtime |
| Runtime parameters | index, ID, current value, minimum, maximum, default, display-name join | SDK/Core runtime / `cdi3.json` |
| Runtime parts | index, ID, opacity, display-name join | SDK/Core runtime / `cdi3.json` |
| Basic drawables | index, ID, texture index, texture-path join, opacity, vertex count, index count | SDK/Core runtime / derived |
| Derived joins | parameter/part presence across runtime, display info, physics, and sidecars | derived |
| Unavailable authoring data | explicit list of unsupported authoring/project structures | unavailable |

### Optional Or Deferred

| Area | Reason to defer |
|---|---|
| Full drawable vertices, UVs, and triangle indices | Potentially large; useful behind detail mode after basic export works. |
| Masks, inverted masks, culling, blend modes, multiply/screen colors | Likely available, but exact names and version support should be verified in the installed SDK. |
| Render order details | Web Framework exposes render orders, but mapping should be verified in implementation with a loaded model. |
| Draw order | Core documents it; inspected Web Framework wrapper did not expose a dedicated method. Verify Web Core binding before making it required. |
| Dynamic flags | Useful but timing-dependent. Confirm read timing around `model.update()` and the render loop. |
| Offscreen data | Version/model-feature dependent; gate behind feature detection and test with an offscreen-capable model. |
| VTube Studio sidecar | Useful for the local reference package but not an official Cubism package standard. Keep separate and optional. |
| Texture dimensions and byte sizes | Helpful diagnostics, but not necessary to prove SDK/Core runtime structure. |
| Raw companion JSON blobs | Defer unless exact round-trip evidence is required. Normalized fields are clearer for the first sample. |

## 7. Not Recoverable From `.moc3` Runtime Intake

Classify these as unavailable unless a separate authoring-source workflow is introduced:

- original `.cmo3` project graph and Cubism Editor workspace state;
- `.can3` animation project state;
- deformer hierarchy and editor deformer objects;
- modeling keyforms, parameter-keyform grids, and form-editing history;
- original PSD/source art layer hierarchy, source artwork file paths, and layer metadata;
- mesh generator settings, manual mesh edit history, glue/template/guide-image state, and modeling operation history;
- editor-only hidden/export-excluded objects not present in runtime output;
- complete semantic intent of ArtMeshes beyond runtime IDs, parent parts, vertices, masks, texture atlas UVs, order/opacity, and optional display names;
- a public, project-owned `.moc3` binary semantic layout.

## 8. Design Implications

- Use a two-layer extraction model: JSON package inspection first, SDK/Core runtime inspection second.
- Keep `cubismSdkAdapter.ts` as the only module touching SDK/Core. This preserves the local proprietary/runtime boundary and allows partial JSON-only inspection when Core is missing.
- Treat each output section as source-attributed: `model3.json`, `physics3.json`, `cdi3.json`, `SDK/Core runtime`, `derived`, `vtube.json`, or `unavailable`.
- Make runtime load failure a normal diagnostic path, not a fatal app failure. The sample should still export package facts when SDK/Core is absent.
- Require basic drawable counts and texture joins first; delay full geometry arrays until there is a detail mode or output-size policy.
- Pin or record the exact SDK/Core/Web Framework version used by the local adapter. Method availability and offscreen/blend APIs are version-sensitive.
- Do not define acceptance criteria around reconstructing editable Cubism project state from `.moc3`.

## 9. Additional Research And Experiments Before Implementation

Run these before treating the sample schema as final:

1. Install or point to the exact local Cubism SDK for Web package to be used by the adapter.
2. Verify the actual `CubismMoc.create(...)` signature and MOC consistency/version APIs in that installed package.
3. Load the local `ref/kipfel2_vts/` model through the SDK/Core in a browser and record actual runtime counts for parameters, parts, drawables, masks, vertices, indices, and render orders.
4. Confirm whether draw order is exposed in the Web Core binding and, if so, under what public or stable property/method.
5. Test dynamic flag timing: read after a controlled `model.update()`, before render, and after render-loop execution to decide a reproducible inspector snapshot point.
6. Feature-detect offscreen, blend/color, repeat/key, and MOC-version APIs against the installed SDK.
7. Decide whether first export includes full geometry arrays or counts-only plus an optional detail mode.
8. Test at least one model using masks and, if possible, one model using Cubism 5.3+ offscreen features.
9. Confirm sidecar handling policy for `.vtube.json`: auto-discover for local convenience or require explicit user selection.
10. Revisit SDK/Core licensing and publication requirements before any distribution, hosted demo, or shared binary/package.

## 10. Unresolved Questions

- Which exact Cubism SDK for Web version will the local adapter target?
- Should the first browser export include full vertex/UV/index arrays, or only counts with a detail toggle?
- Should `.vtube.json` be auto-discovered by filename convention, selected explicitly, or excluded from the first sample?
- Can the chosen Web SDK/Core binding expose `.moc3` version and validation details in browser context?
- What output-size cap is acceptable for large drawable geometry exports?
- Should raw companion JSON be preserved as optional evidence, or should the first schema stay normalized only?
- If authoring-level hierarchy becomes required, should the project pivot to `.cmo3`/Editor-mediated workflows instead of runtime `.moc3` inspection?

## 11. Basis Documents Read

- `discussion/_conventions.md`
- `discussion/reports/cubism-sdk-runtime-structure/_map.md`
- `discussion/reports/cubism-sdk-runtime-structure/official-sdk-runtime-api-report.md`
- `discussion/reports/cubism-sdk-runtime-structure/web-framework-runtime-observation-report.md`
- `discussion/reports/cubism-sdk-runtime-structure/structured-output-field-map.md`
- `discussion/reports/cmo3-moc3-format-spec/sdk-web-local-loader-plan.md`
