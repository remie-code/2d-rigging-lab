# Structured Output Field Map for Cubism Web Runtime Inspector

> Date: 2026-05-25  
> Scope: Proposed structured output for a planned sample web app that loads `ref/kipfel2_vts/黒シャツキプフェル.model3.json` / `.moc3` and exports observed data.  
> Status: Draft field map, not implementation code.

## 1. Purpose

The sample inspector should export a single JSON document that separates:

- package facts read from documented companion JSON files;
- runtime facts observed through Cubism SDK/Core after loading `.moc3`;
- joins and diagnostics derived by the sample app;
- authoring information that should not be promised from runtime package intake.

The key design constraint is that `.moc3` remains Core-owned runtime data. The output should make successful runtime observation useful without implying that the app can reconstruct a full Cubism Editor `.cmo3` project.

## 2. Required Source Labels

Every output section or field in this report uses one of these labels:

| Label | Meaning |
|---|---|
| `model3.json` | Directly read from `黒シャツキプフェル.model3.json`. |
| `physics3.json` | Directly read from `黒シャツキプフェル.physics3.json`. |
| `cdi3.json` | Directly read from `黒シャツキプフェル.cdi3.json`. |
| `vtube.json` | Directly read from `黒シャツキプフェル.vtube.json`. |
| `SDK/Core runtime` | Observed through Cubism SDK/Core or the official Web Framework after `.moc3` load. |
| `derived` | Computed by the inspector from paths, fetch results, cross-file joins, counts, validations, or timestamps. |
| `unavailable` | Not available from `.model3.json` + `.moc3` runtime intake and companion JSONs, or not safe to promise without a separate source. |

## 3. Evidence Summary

### 3.1 Official facts

- Live2D identifies `.moc3` as Live2D model data used in programs, and `.model3.json` as the model settings file linking `.moc3`, textures, physics settings, and blink/lip-sync parameter lists. Source: [Live2D File Types and Extensions](https://docs.live2d.com/en/cubism-editor-manual/file-type-and-extension/).
- Live2D's embedded export documentation says `.moc3`, `.model3.json`, and textures are exported by default, while files such as `physics3.json`, `userdata3.json`, `cdi3.json`, `motion3.json`, and related settings are optional companion outputs. Source: [Data for Embedded Use](https://docs.live2d.com/en/cubism-editor-manual/export-moc3-motion3-files/).
- The Cubism Web model manual says vertex and object movement relative to parameters is recorded in `.moc3`, while physics operations and user data are output as separate files; `.model3.json` tracks file references. Source: [About Models (Web)](https://docs.live2d.com/en/cubism-sdk-manual/model-web/).
- The Web Framework manual describes loading `.moc3` bytes from the path obtained in `.model3.json`, then using `CubismModel.update()` to let Core update vertex information from parameter and part values. Source: [How to Use CubismWebFramework Directly](https://docs.live2d.com/en/cubism-sdk-manual/use-framework-web/).
- The Core API reference describes Core as the library for handling `.moc3`; Core calculates vertex information according to model parameters and exposes information needed for rendering such as UV and opacity. Source: [Cubism Core API Reference](https://docs.live2d.com/en/cubism-sdk-manual/cubism-core-api-reference/).
- Live2D's public `CubismSpecs` repository documents JSON companion formats used here: [`model3.json`](https://raw.githubusercontent.com/Live2D/CubismSpecs/master/FileFormats/model3.json.md), [`physics3.json`](https://raw.githubusercontent.com/Live2D/CubismSpecs/master/FileFormats/physics3.json.md), and [`cdi3.json`](https://raw.githubusercontent.com/Live2D/CubismSpecs/master/FileFormats/cdi3.json.md).
- The official Web Framework source exposes model, canvas, parameter, part, drawable, mask, texture-index, vertex, opacity, blend, color, offscreen, and render-order accessors on `CubismModel`. Source: [Live2D/CubismWebFramework `cubismmodel.ts`](https://raw.githubusercontent.com/Live2D/CubismWebFramework/develop/src/model/cubismmodel.ts). This report treats exact method names as implementation details to confirm during the spike.

### 3.2 Repository observations for `ref/kipfel2_vts`

| Observation | Source label |
|---|---|
| `model3.json` has `Version: 3`. | `model3.json` |
| `FileReferences.Moc` is `黒シャツキプフェル.moc3`. | `model3.json` |
| `FileReferences.Textures` contains `黒シャツキプフェル.4096/texture_00.png`. | `model3.json` |
| `FileReferences.Physics` is `黒シャツキプフェル.physics3.json`. | `model3.json` |
| `FileReferences.DisplayInfo` is `黒シャツキプフェル.cdi3.json`. | `model3.json` |
| `Groups` contains `EyeBlink` targeting parameters, but its `Ids` array is empty. | `model3.json` |
| `physics3.json` has `Version: 3`, 2 physics settings, 6 total inputs, 3 total outputs, 4 total vertices, and `Fps: 60`. | `physics3.json` |
| Physics dictionary names are `髪追従` and `ネクタイ揺れ`. | `physics3.json` |
| `cdi3.json` has `Version: 3`, 29 parameters, 0 parameter groups, and 20 parts. | `cdi3.json` |
| `vtube.json` has `Version: 1`, name `黒シャツキプフェル`, model id `900832720c75419bac5484ed2088a34a`, and 20 VTube Studio parameter settings. | `vtube.json` |
| Local file byte sizes, texture dimensions, missing-file checks, and cross-file consistency are inspector computations. | `derived` |
| No SDK/Core runtime load was performed for this report. Runtime fields below are planned observations from official SDK/Core and Web Framework evidence. | `derived` |

## 4. First Spike Priority

Must-have for the first successful spike:

- emit schema/version metadata and diagnostics;
- parse `model3.json`, resolve its relative references, and report whether each referenced file was fetched;
- parse `physics3.json` and `cdi3.json` when referenced;
- report SDK/Core availability and `.moc3` load success or failure;
- if runtime load succeeds, export canvas, parameter, part, and basic drawable observations;
- export an explicit `unavailableAuthoringData` section so users do not mistake runtime intake for `.cmo3` project recovery.

Nice-to-have for the first spike:

- parse `vtube.json` as app-specific sidecar metadata;
- include full physics settings rather than only summaries;
- include full drawable vertex, UV, and index arrays rather than counts only;
- include masks, blend modes, multiply/screen colors, offscreen data, dynamic flags, and render-order arrays;
- include texture pixel dimensions and asset byte sizes;
- include cross-file joins that flag unused or unmatched parameters and parts.

## 5. Proposed JSON Output Shape

This is a schema sketch, not implementation code. Field names can be adjusted during implementation, but the source boundaries should remain.

```json
{
  "schemaVersion": "cubism-runtime-inspector.v0.1",
  "generatedAt": "2026-05-25T00:00:00.000Z",
  "target": {
    "basePath": "ref/kipfel2_vts/",
    "model3Path": "ref/kipfel2_vts/黒シャツキプフェル.model3.json"
  },
  "capabilities": {
    "jsonInspection": true,
    "sdkCoreAvailable": false,
    "runtimeModelLoaded": false,
    "vtubeSidecarFound": true
  },
  "package": {
    "model3": {},
    "assets": []
  },
  "displayInfo": {},
  "physics": {},
  "vtubeStudio": {},
  "runtime": {
    "coreLoad": {},
    "canvas": null,
    "parameters": [],
    "parts": [],
    "drawables": [],
    "offscreens": []
  },
  "derived": {
    "parameters": [],
    "parts": [],
    "textureUsage": [],
    "consistencyChecks": []
  },
  "unavailableAuthoringData": [],
  "diagnostics": []
}
```

## 6. Field Map

### 6.1 Root metadata and capabilities

| JSON path | Source label | Priority | Notes |
|---|---|---|---|
| `schemaVersion` | `derived` | Must-have | Inspector output schema version. |
| `generatedAt` | `derived` | Must-have | Inspector timestamp. |
| `target.basePath` | `derived` | Must-have | Directory used to resolve relative references. |
| `target.model3Path` | `derived` | Must-have | User-selected entry file. |
| `capabilities.jsonInspection` | `derived` | Must-have | True when public JSON files can be fetched and parsed. |
| `capabilities.sdkCoreAvailable` | `derived` | Must-have | True when the local SDK/Core adapter is available. |
| `capabilities.runtimeModelLoaded` | `SDK/Core runtime` | Must-have | True only after `.moc3` bytes create a runtime model successfully. |
| `capabilities.vtubeSidecarFound` | `derived` | Nice-to-have | True when a matching `.vtube.json` sidecar is found. |

### 6.2 Package and asset graph

| JSON path | Source label | Priority | Notes |
|---|---|---|---|
| `package.model3.version` | `model3.json` | Must-have | `Version`. Observed value: `3`. |
| `package.model3.fileReferences.moc` | `model3.json` | Must-have | `FileReferences.Moc`. Observed: `黒シャツキプフェル.moc3`. |
| `package.model3.fileReferences.textures[]` | `model3.json` | Must-have | `FileReferences.Textures`. Observed one texture. |
| `package.model3.fileReferences.physics` | `model3.json` | Must-have | `FileReferences.Physics`, nullable if absent. |
| `package.model3.fileReferences.displayInfo` | `model3.json` | Must-have | `FileReferences.DisplayInfo`, nullable if absent. |
| `package.model3.fileReferences.userData` | `model3.json` | Nice-to-have | Optional per CubismSpecs; absent in local reference. |
| `package.model3.fileReferences.pose` | `model3.json` | Nice-to-have | Optional per CubismSpecs; absent in local reference. |
| `package.model3.fileReferences.expressions[]` | `model3.json` | Nice-to-have | Optional per CubismSpecs; absent in local reference. |
| `package.model3.fileReferences.motions` | `model3.json` | Nice-to-have | Optional per CubismSpecs; absent in local reference. |
| `package.model3.fileReferences.motionSync` | `model3.json` | Nice-to-have | Optional per CubismSpecs; absent in local reference. |
| `package.model3.groups[]` | `model3.json` | Must-have | Include `Target`, `Name`, and `Ids`. Local `EyeBlink` has no IDs. |
| `package.model3.hitAreas[]` | `model3.json` | Nice-to-have | Optional per CubismSpecs; absent in local reference. |
| `package.model3.layout` | `model3.json` | Nice-to-have | Optional per CubismSpecs; absent in local reference. |
| `package.assets[].role` | `derived` | Must-have | Role such as `moc`, `texture`, `physics`, `displayInfo`, `vtubeSidecar`. |
| `package.assets[].path` | `derived` | Must-have | Resolved from entry path plus `model3.json` or sidecar references. |
| `package.assets[].referencedBy` | `derived` | Must-have | Example: `model3.FileReferences.Moc`. |
| `package.assets[].exists` | `derived` | Must-have | Fetch or filesystem existence result. |
| `package.assets[].byteLength` | `derived` | Nice-to-have | Observed local sizes include `.moc3` at 237824 bytes and texture at 4647192 bytes. |
| `package.assets[].texture.width` | `derived` | Nice-to-have | Observed texture header is 4096 by 4096. |
| `package.assets[].texture.height` | `derived` | Nice-to-have | Observed texture header is 4096 by 4096. |

### 6.3 Display info from `cdi3.json`

| JSON path | Source label | Priority | Notes |
|---|---|---|---|
| `displayInfo.present` | `derived` | Must-have | True when `DisplayInfo` exists and parses. |
| `displayInfo.version` | `cdi3.json` | Must-have | Observed value: `3`. |
| `displayInfo.parameters[].id` | `cdi3.json` | Must-have | `Parameters[].Id`; observed 29 entries. |
| `displayInfo.parameters[].groupId` | `cdi3.json` | Must-have | `Parameters[].GroupId`; local entries are empty strings. |
| `displayInfo.parameters[].name` | `cdi3.json` | Must-have | Human-readable parameter display name. |
| `displayInfo.parameterGroups[].id` | `cdi3.json` | Nice-to-have | Observed array is empty. |
| `displayInfo.parameterGroups[].groupId` | `cdi3.json` | Nice-to-have | Parent group id when present. |
| `displayInfo.parameterGroups[].name` | `cdi3.json` | Nice-to-have | Display name when present. |
| `displayInfo.parts[].id` | `cdi3.json` | Must-have | `Parts[].Id`; observed 20 entries. |
| `displayInfo.parts[].name` | `cdi3.json` | Must-have | `Parts[].Name`. |
| `displayInfo.combinedParameters[]` | `cdi3.json` | Nice-to-have | Optional per CubismSpecs; absent in local reference. |

### 6.4 Physics from `physics3.json`

| JSON path | Source label | Priority | Notes |
|---|---|---|---|
| `physics.present` | `derived` | Must-have | True when `Physics` exists and parses. |
| `physics.version` | `physics3.json` | Must-have | Observed value: `3`. |
| `physics.meta.physicsSettingCount` | `physics3.json` | Must-have | Observed value: `2`. |
| `physics.meta.totalInputCount` | `physics3.json` | Must-have | Observed value: `6`. |
| `physics.meta.totalOutputCount` | `physics3.json` | Must-have | Observed value: `3`. |
| `physics.meta.vertexCount` | `physics3.json` | Must-have | Observed value: `4`. |
| `physics.meta.fps` | `physics3.json` | Must-have | Optional in schema, present locally as `60`. |
| `physics.meta.effectiveForces.gravity` | `physics3.json` | Must-have | `EffectiveForces.Gravity`. |
| `physics.meta.effectiveForces.wind` | `physics3.json` | Must-have | `EffectiveForces.Wind`. |
| `physics.meta.dictionary[].id` | `physics3.json` | Must-have | Observed `PhysicsSetting1`, `PhysicsSetting2`. |
| `physics.meta.dictionary[].name` | `physics3.json` | Must-have | Observed `髪追従`, `ネクタイ揺れ`. |
| `physics.settings[].id` | `physics3.json` | Must-have | Physics setting id. |
| `physics.settings[].inputCount` | `derived` | Must-have | Count of `Input` entries for quick inspection. |
| `physics.settings[].outputCount` | `derived` | Must-have | Count of `Output` entries for quick inspection. |
| `physics.settings[].vertexCount` | `derived` | Must-have | Count of pendulum vertices in this setting. |
| `physics.settings[].inputs[].source.target` | `physics3.json` | Nice-to-have | Full input details. |
| `physics.settings[].inputs[].source.id` | `physics3.json` | Nice-to-have | Input parameter id. |
| `physics.settings[].inputs[].weight` | `physics3.json` | Nice-to-have | Input weight. |
| `physics.settings[].inputs[].type` | `physics3.json` | Nice-to-have | `X` or `Angle` in local file. |
| `physics.settings[].inputs[].reflect` | `physics3.json` | Nice-to-have | Reflection flag. |
| `physics.settings[].outputs[].destination.target` | `physics3.json` | Nice-to-have | Full output details. |
| `physics.settings[].outputs[].destination.id` | `physics3.json` | Nice-to-have | Output parameter id. |
| `physics.settings[].outputs[].vertexIndex` | `physics3.json` | Nice-to-have | Parent pendulum vertex index. |
| `physics.settings[].outputs[].scale` | `physics3.json` | Nice-to-have | Output scale. |
| `physics.settings[].outputs[].weight` | `physics3.json` | Nice-to-have | Output weight. |
| `physics.settings[].outputs[].type` | `physics3.json` | Nice-to-have | Output type. |
| `physics.settings[].outputs[].reflect` | `physics3.json` | Nice-to-have | Reflection flag. |
| `physics.settings[].vertices[]` | `physics3.json` | Nice-to-have | Full pendulum vertex settings. |
| `physics.settings[].normalization` | `physics3.json` | Nice-to-have | Position and angle normalization values. |

### 6.5 VTube Studio sidecar from `vtube.json`

`vtube.json` is app-specific sidecar data, not an official CubismSpecs file. Include it under a separate section so it does not get confused with Cubism package/runtime facts.

| JSON path | Source label | Priority | Notes |
|---|---|---|---|
| `vtubeStudio.present` | `derived` | Nice-to-have | True when matching sidecar is found and parses. |
| `vtubeStudio.version` | `vtube.json` | Nice-to-have | Observed value: `1`. |
| `vtubeStudio.name` | `vtube.json` | Nice-to-have | Observed `黒シャツキプフェル`. |
| `vtubeStudio.modelId` | `vtube.json` | Nice-to-have | Observed `900832720c75419bac5484ed2088a34a`. |
| `vtubeStudio.fileReferences.model` | `vtube.json` | Nice-to-have | Should point back to `黒シャツキプフェル.model3.json`. |
| `vtubeStudio.fileReferences.icon` | `vtube.json` | Nice-to-have | Empty locally. |
| `vtubeStudio.fileReferences.idleAnimation` | `vtube.json` | Nice-to-have | Empty locally. |
| `vtubeStudio.modelSaveMetadata` | `vtube.json` | Nice-to-have | Local VTube Studio save metadata. |
| `vtubeStudio.savedModelPosition` | `vtube.json` | Nice-to-have | VTube Studio placement, not Cubism runtime geometry. |
| `vtubeStudio.physicsSettings` | `vtube.json` | Nice-to-have | VTube Studio physics application settings, separate from `physics3.json`. |
| `vtubeStudio.generalSettings` | `vtube.json` | Nice-to-have | App settings such as model volume and expression saving. |
| `vtubeStudio.parameterSettings[].name` | `vtube.json` | Nice-to-have | Observed 20 mappings. |
| `vtubeStudio.parameterSettings[].input` | `vtube.json` | Nice-to-have | VTube Studio tracking input name. |
| `vtubeStudio.parameterSettings[].inputRange` | `vtube.json` | Nice-to-have | Lower and upper input range. |
| `vtubeStudio.parameterSettings[].outputRange` | `vtube.json` | Nice-to-have | Lower and upper output range. |
| `vtubeStudio.parameterSettings[].outputLive2D` | `vtube.json` | Nice-to-have | Target Cubism parameter id. |
| `vtubeStudio.parameterSettings[].smoothing` | `vtube.json` | Nice-to-have | VTube Studio smoothing value. |
| `vtubeStudio.hotkeys[]` | `vtube.json` | Nice-to-have | Empty locally. |
| `vtubeStudio.savedActiveExpressions[]` | `vtube.json` | Nice-to-have | Empty locally. |

### 6.6 SDK/Core runtime load and canvas

| JSON path | Source label | Priority | Notes |
|---|---|---|---|
| `runtime.coreLoad.sdkTarget` | `derived` | Must-have | Example: `Cubism SDK for Web`; chosen by the sample app. |
| `runtime.coreLoad.coreAvailable` | `derived` | Must-have | Adapter availability, not a model fact. |
| `runtime.coreLoad.mocPath` | `model3.json` | Must-have | Original `.moc3` reference from `model3.json`. |
| `runtime.coreLoad.mocByteLength` | `derived` | Nice-to-have | Fetch result byte length. |
| `runtime.coreLoad.loaded` | `SDK/Core runtime` | Must-have | True only after Core accepts the `.moc3`. |
| `runtime.coreLoad.error` | `derived` | Must-have | Missing SDK/Core, fetch failure, validation/load failure, or exception summary. |
| `runtime.coreLoad.mocVersion` | `SDK/Core runtime` | Nice-to-have | If exposed by the chosen Core binding. Do not infer from filename. |
| `runtime.canvas.width` | `SDK/Core runtime` | Must-have | Web Framework exposes canvas width. |
| `runtime.canvas.height` | `SDK/Core runtime` | Must-have | Web Framework exposes canvas height. |
| `runtime.canvas.pixelsPerUnit` | `SDK/Core runtime` | Must-have | Web Framework exposes pixels per unit. |

### 6.7 Runtime parameters

| JSON path | Source label | Priority | Notes |
|---|---|---|---|
| `runtime.parameters[].index` | `derived` | Must-have | Inspector enumeration index. |
| `runtime.parameters[].id` | `SDK/Core runtime` | Must-have | Runtime parameter id from `.moc3`. |
| `runtime.parameters[].type` | `SDK/Core runtime` | Nice-to-have | Normal vs blend-shape type if exposed by the SDK/Core version. |
| `runtime.parameters[].value` | `SDK/Core runtime` | Must-have | Current value after initial load/update. |
| `runtime.parameters[].minimumValue` | `SDK/Core runtime` | Must-have | Runtime minimum. |
| `runtime.parameters[].maximumValue` | `SDK/Core runtime` | Must-have | Runtime maximum. |
| `runtime.parameters[].defaultValue` | `SDK/Core runtime` | Must-have | Runtime default. |
| `runtime.parameters[].isRepeat` | `SDK/Core runtime` | Nice-to-have | Repeat flag if exposed. |
| `runtime.parameters[].displayName` | `cdi3.json` | Must-have | Join by id when present in `cdi3.json`; null if absent. |
| `runtime.parameters[].displayGroupId` | `cdi3.json` | Nice-to-have | Join by id when present. |
| `runtime.parameters[].physicsRoles[]` | `derived` | Nice-to-have | Join from `physics3.json` input/output references. |
| `runtime.parameters[].vtubeMappings[]` | `derived` | Nice-to-have | Join from `vtube.json` mappings targeting this id. |

### 6.8 Runtime parts

| JSON path | Source label | Priority | Notes |
|---|---|---|---|
| `runtime.parts[].index` | `derived` | Must-have | Inspector enumeration index. |
| `runtime.parts[].id` | `SDK/Core runtime` | Must-have | Runtime part id from `.moc3`. |
| `runtime.parts[].opacity` | `SDK/Core runtime` | Must-have | Runtime part opacity. |
| `runtime.parts[].parentPartIndex` | `SDK/Core runtime` | Nice-to-have | If exposed by the SDK/Core version. |
| `runtime.parts[].offscreenIndices[]` | `SDK/Core runtime` | Nice-to-have | If exposed. |
| `runtime.parts[].displayName` | `cdi3.json` | Must-have | Join by id when present in `cdi3.json`; null if absent. |
| `runtime.parts[].childDrawableIndices[]` | `derived` | Nice-to-have | Derived from drawable parent part indices if available. |

### 6.9 Runtime drawables and offscreens

| JSON path | Source label | Priority | Notes |
|---|---|---|---|
| `runtime.drawables[].index` | `derived` | Must-have | Inspector enumeration index. |
| `runtime.drawables[].id` | `SDK/Core runtime` | Must-have | Runtime drawable or ArtMesh id. |
| `runtime.drawables[].parentPartIndex` | `SDK/Core runtime` | Nice-to-have | Parent part index where exposed. |
| `runtime.drawables[].textureIndex` | `SDK/Core runtime` | Must-have | Used to join to `model3.json` texture paths. |
| `runtime.drawables[].texturePath` | `derived` | Must-have | Derived from `textureIndex` and `FileReferences.Textures`. |
| `runtime.drawables[].opacity` | `SDK/Core runtime` | Must-have | Runtime opacity. |
| `runtime.drawables[].culling` | `SDK/Core runtime` | Nice-to-have | Runtime culling value. |
| `runtime.drawables[].blendMode` | `SDK/Core runtime` | Nice-to-have | Include only after confirming exact Web SDK representation. |
| `runtime.drawables[].alphaBlend` | `SDK/Core runtime` | Nice-to-have | Current Web Framework has alpha blend accessors. |
| `runtime.drawables[].colorBlend` | `SDK/Core runtime` | Nice-to-have | Current Web Framework has color blend accessors. |
| `runtime.drawables[].renderOrder` | `SDK/Core runtime` | Nice-to-have | Current Web Framework exposes render orders. Confirm array mapping during implementation. |
| `runtime.drawables[].drawOrder` | `SDK/Core runtime` | Nice-to-have | Do not require for first spike until exact Core/Web accessor is confirmed. |
| `runtime.drawables[].vertexCount` | `SDK/Core runtime` | Must-have | Count only for first spike. |
| `runtime.drawables[].indexCount` | `SDK/Core runtime` | Must-have | Count only for first spike. |
| `runtime.drawables[].vertices[]` | `SDK/Core runtime` | Nice-to-have | Potentially large; include behind detail mode. |
| `runtime.drawables[].vertexUvs[]` | `SDK/Core runtime` | Nice-to-have | Potentially large; include behind detail mode. |
| `runtime.drawables[].vertexIndices[]` | `SDK/Core runtime` | Nice-to-have | Potentially large; include behind detail mode. |
| `runtime.drawables[].maskCount` | `SDK/Core runtime` | Nice-to-have | Current Web Framework exposes mask counts. |
| `runtime.drawables[].masks[]` | `SDK/Core runtime` | Nice-to-have | Current Web Framework exposes masks. |
| `runtime.drawables[].invertedMask` | `SDK/Core runtime` | Nice-to-have | If exposed by selected SDK/Core version. |
| `runtime.drawables[].multiplyColor` | `SDK/Core runtime` | Nice-to-have | Runtime color state, not original PSD color. |
| `runtime.drawables[].screenColor` | `SDK/Core runtime` | Nice-to-have | Runtime color state, not original PSD color. |
| `runtime.drawables[].dynamicFlags.isVisible` | `SDK/Core runtime` | Nice-to-have | Useful after `update()`. |
| `runtime.drawables[].dynamicFlags.visibilityDidChange` | `SDK/Core runtime` | Nice-to-have | Useful after `update()`. |
| `runtime.drawables[].dynamicFlags.opacityDidChange` | `SDK/Core runtime` | Nice-to-have | Useful after `update()`. |
| `runtime.drawables[].dynamicFlags.renderOrderDidChange` | `SDK/Core runtime` | Nice-to-have | Useful after `update()`. |
| `runtime.drawables[].dynamicFlags.vertexPositionsDidChange` | `SDK/Core runtime` | Nice-to-have | Useful after `update()`. |
| `runtime.offscreens[]` | `SDK/Core runtime` | Nice-to-have | Cubism 5-era/offscreen data where exposed; not required for first spike. |

### 6.10 Derived joins and consistency checks

| JSON path | Source label | Priority | Notes |
|---|---|---|---|
| `derived.parameters[].id` | `derived` | Must-have | Union of runtime, `cdi3.json`, `physics3.json`, and `vtube.json` parameter ids. |
| `derived.parameters[].runtimePresent` | `derived` | Must-have | Whether the id exists in runtime parameters. |
| `derived.parameters[].displayInfoPresent` | `derived` | Must-have | Whether the id exists in `cdi3.json`. |
| `derived.parameters[].physicsInputRefs[]` | `derived` | Nice-to-have | Physics settings using this parameter as input. |
| `derived.parameters[].physicsOutputRefs[]` | `derived` | Nice-to-have | Physics settings writing this parameter. |
| `derived.parameters[].vtubeInputRefs[]` | `derived` | Nice-to-have | VTube Studio mappings targeting this parameter. |
| `derived.parts[].id` | `derived` | Must-have | Union of runtime part ids and `cdi3.json` part ids. |
| `derived.parts[].runtimePresent` | `derived` | Must-have | Whether the id exists in runtime parts. |
| `derived.parts[].displayInfoPresent` | `derived` | Must-have | Whether the id exists in `cdi3.json`. |
| `derived.textureUsage[].textureIndex` | `derived` | Must-have | From runtime drawable texture indices. |
| `derived.textureUsage[].texturePath` | `derived` | Must-have | From `model3.json` texture references. |
| `derived.textureUsage[].drawableCount` | `derived` | Must-have | Number of drawables using the texture. |
| `derived.consistencyChecks[].code` | `derived` | Must-have | Stable diagnostic code. |
| `derived.consistencyChecks[].severity` | `derived` | Must-have | `info`, `warning`, or `error`. |
| `derived.consistencyChecks[].message` | `derived` | Must-have | Human-readable summary. |
| `derived.consistencyChecks[].relatedPaths[]` | `derived` | Nice-to-have | Output JSON paths or asset paths involved. |

Recommended consistency checks:

| Check | Source label |
|---|---|
| `model3.json` referenced file missing or failed fetch. | `derived` |
| `physics3.json` meta counts disagree with actual `PhysicsSettings` arrays. | `derived` |
| `cdi3.json` parameter id not present in runtime parameters. | `derived` |
| Runtime parameter id missing from `cdi3.json`. | `derived` |
| `physics3.json` input/output parameter id missing from runtime parameters. | `derived` |
| `vtube.json` `FileReferences.Model` does not match selected `model3.json`. | `derived` |
| `vtube.json` `OutputLive2D` target missing from runtime parameters. | `derived` |
| Runtime drawable texture index outside `model3.json` texture array. | `derived` |
| SDK/Core unavailable, so runtime sections are intentionally empty. | `derived` |

### 6.11 Diagnostics

| JSON path | Source label | Priority | Notes |
|---|---|---|---|
| `diagnostics[].phase` | `derived` | Must-have | `fetch`, `parse-json`, `sdk-init`, `moc-load`, `runtime-read`, or `join`. |
| `diagnostics[].severity` | `derived` | Must-have | `info`, `warning`, or `error`. |
| `diagnostics[].code` | `derived` | Must-have | Stable code for UI/tests. |
| `diagnostics[].message` | `derived` | Must-have | Concise message. |
| `diagnostics[].sourcePath` | `derived` | Nice-to-have | Asset path involved. |
| `diagnostics[].exceptionName` | `derived` | Nice-to-have | If available. |
| `diagnostics[].exceptionMessage` | `derived` | Nice-to-have | Redacted if needed. |

## 7. Must-Not-Promise Authoring Data

The output should include an explicit section similar to:

```json
{
  "unavailableAuthoringData": [
    {
      "name": "Cubism Editor project graph",
      "source": "unavailable",
      "reason": "Runtime package intake does not load .cmo3 authoring project data."
    }
  ]
}
```

Recommended entries:

| Name | Source label | Reason |
|---|---|---|
| `.cmo3` project graph and workspace settings | `unavailable` | `.model3.json` + `.moc3` runtime intake is not a `.cmo3` editor-project import path. |
| Original PSD/source image layer hierarchy | `unavailable` | Runtime package contains texture atlas output, not the original PSD layer structure. |
| Source artwork file paths and layer names | `unavailable` | Not represented in the inspected runtime package. |
| Deformer hierarchy as authored in Cubism Editor | `unavailable` | Runtime APIs expose render/runtime structures; do not promise Editor deformer tree recovery. |
| Parameter keyforms and form-editing grids | `unavailable` | Runtime parameters expose ids, values, min/max/default, and possibly type/repeat, not full keyform authoring state. |
| Which ArtMeshes were keyed to which parameter combinations | `unavailable` | Runtime vertex results do not expose the original keyform assignment table as editor data. |
| Mesh generator settings and manual edit history | `unavailable` | Runtime mesh vertices/indices are observable, generation history is not. |
| Glue, template, guide-image, and modeling operation history | `unavailable` | These are editor authoring concepts, not reliable runtime intake fields. |
| Original hidden/export-excluded editor objects | `unavailable` | Export settings can exclude hidden parts or ArtMeshes; absent runtime data cannot prove original authoring content. |
| Cubism Editor export dialog choices not serialized in companion JSON | `unavailable` | Some export choices affect outputs but are not generally recoverable as structured fields from runtime intake. |
| `.moc3` binary semantic layout | `unavailable` | No official public `.moc3` binary schema is used by this project; Core should load it. |
| Motion, expression, pose, user-data, motion-sync, or parameter-controller details when not referenced | `unavailable` | The local `model3.json` does not reference those companion files. |
| VTube Studio hotkey/expression behavior when arrays are empty | `unavailable` | The local `vtube.json` has empty hotkey and saved-active-expression arrays. |

## 8. Local Reference Expected Output Highlights

When run against the current local files, the inspector should be able to report these without SDK/Core:

| Expected value | Source label |
|---|---|
| model setting version `3`. | `model3.json` |
| one `.moc3` reference: `黒シャツキプフェル.moc3`. | `model3.json` |
| one texture reference: `黒シャツキプフェル.4096/texture_00.png`. | `model3.json` |
| physics sidecar reference: `黒シャツキプフェル.physics3.json`. | `model3.json` |
| display info sidecar reference: `黒シャツキプフェル.cdi3.json`. | `model3.json` |
| `EyeBlink` parameter group with an empty `Ids` array. | `model3.json` |
| physics setting count `2`, total input count `6`, total output count `3`, vertex count `4`, FPS `60`. | `physics3.json` |
| physics group names `髪追従` and `ネクタイ揺れ`. | `physics3.json` |
| display info count: 29 parameters, 0 parameter groups, 20 parts. | `cdi3.json` |
| VTube Studio sidecar name `黒シャツキプフェル`, model id `900832720c75419bac5484ed2088a34a`, 20 parameter settings. | `vtube.json` |
| `.moc3` runtime status should say unavailable or not loaded until SDK/Core is actually configured. | `derived` |

## 9. Open Questions and Verification Items

| Item | Status |
|---|---|
| Which exact Cubism SDK for Web version will the local adapter target? | Open. The Web Framework API surface changes over time; confirm against the installed SDK package during implementation. |
| Should the first exported JSON include full vertex/UV/index arrays, or only counts plus an optional detail mode? | Recommendation: counts first, arrays as nice-to-have detail mode. |
| Should `vtube.json` be auto-discovered by filename convention or selected explicitly? | Open. Auto-discovery is convenient for `ref/kipfel2_vts`, but it is not a Cubism package standard. |
| Can the chosen Web SDK/Core binding expose `.moc3` version and validation details in browser context? | Open. Include fields only if the local adapter can verify them. |
| How should large outputs be capped for browser download size? | Open. Runtime drawable arrays can be large. |
| Should the report schema preserve raw companion JSON blobs? | Recommendation: no for the first spike; export normalized fields and optional raw blobs later if a consumer needs exact round-trip evidence. |

## 10. Design Recommendation

For the first spike, make `model3.json`, `physics3.json`, `cdi3.json`, runtime `parameters`, runtime `parts`, runtime drawable counts, diagnostics, and unavailable authoring data the stable contract. Treat VTube Studio metadata, full geometry arrays, offscreen data, blend/color fields, and detailed render-order fields as optional extensions until the local SDK adapter proves them with the installed SDK package.

The most important user-facing behavior is not the number of fields. It is preserving source attribution so every exported value can be explained as public JSON, SDK/Core runtime observation, derived inspection, or unavailable authoring data.
