# Cubism SDK for Web Local Loader Plan

> Status: Superseded historical plan. Do not implement. Current project policy forbids Cubism SDK/Core use, existing Cubism model loading, and inspection/loading of `.model3.json`, `.moc3`, `.cmo3`, `.physics3.json`, `.motion3.json`, or `.pose3.json`.

> Date: 2026-05-24  
> Scope: Record the local-use decision, SDK acquisition path, and simplest sample app structure for loading `ref/kipfel2_vts/黒シャツキプフェル.moc3` through Cubism SDK for Web and exporting observed structured data.

## 1. Historical Recorded Decision

The previous plan recorded the following policy for `.moc3` runtime intake experiments. This policy is superseded and must not be implemented under the current Private 2D Rigging Lab baseline:

- The tool is for local personal use and is not intended for public distribution.
- Cubism SDK/Core will not be committed to this repository.
- Cubism SDK/Core will not be bundled or redistributed by the project.
- A local user-provided Cubism SDK/Core installation may be used through an adapter boundary.
- If Cubism SDK/Core is absent, the sample should still be able to inspect documented JSON assets such as `.model3.json`, `.physics3.json`, and `.cdi3.json`, while reporting that `.moc3` runtime loading is unavailable.
- Independent `.moc3` parsing/writing remains out of scope.

This is a historical project design note, not legal advice. Under the current baseline, Cubism SDK/Core and Cubism model intake are not used.

## 2. SDK Acquisition

Official acquisition path:

- Cubism SDK overview: <https://www.live2d.com/en/sdk/about/>
- Cubism SDK for Web download: <https://www.live2d.com/en/sdk/download/web/>
- Cubism SDK for Native download: <https://www.live2d.com/en/sdk/download/native/>
- Cubism SDK for Web manual: <https://docs.live2d.com/en/cubism-sdk-manual/cubism-sdk-for-web/>
- Cubism Core manual: <https://docs.live2d.com/cubism-sdk-manual/cubism-core/>

Official facts relevant to this project:

- Cubism SDK can be downloaded from the official Live2D website after reading and agreeing to the Live2D Proprietary Software License Agreement and Live2D Open Software License Agreement.
- Cubism Core is not published on GitHub.
- Cubism Core is included in official SDK distribution packages.
- The public GitHub framework/sample repositories are not enough by themselves to load `.moc3`; the local Core package is needed.

## 3. Local Reference Model

Repository facts:

```text
ref/kipfel2_vts/
  黒シャツキプフェル.model3.json
  黒シャツキプフェル.moc3
  黒シャツキプフェル.physics3.json
  黒シャツキプフェル.cdi3.json
  黒シャツキプフェル.vtube.json
  黒シャツキプフェル.4096/texture_00.png
  items_pinned_to_model.json
```

`黒シャツキプフェル.model3.json` references:

- `Moc`: `黒シャツキプフェル.moc3`
- `Textures`: `黒シャツキプフェル.4096/texture_00.png`
- `Physics`: `黒シャツキプフェル.physics3.json`
- `DisplayInfo`: `黒シャツキプフェル.cdi3.json`

## 4. Simplest Sample App Shape

Recommended minimal structure:

```text
experiments/cubism-web-moc3-inspector/
  package.json
  vite.config.ts
  src/
    main.ts
    cubismSdkAdapter.ts
    inspectModelPackage.ts
    writeOutput.ts
  public/
    vendor/live2d/        # local-only ignored copy or symlink target for Core assets
  outputs/
    .gitkeep
```

Recommended repository policy:

- Add `experiments/cubism-web-moc3-inspector/public/vendor/live2d/` to `.gitignore`.
- Add any downloaded/extracted SDK package directory to `.gitignore`.
- Do not commit Cubism Core `.js`, `.wasm`, `.dll`, `.lib`, or SDK package archives.

## 5. Why Vite + Browser Is The Easiest First Step

Use Cubism SDK for Web first because:

- The user asked for a sample web app.
- The model can be fetched by URL from a local dev server.
- The app can load `.model3.json`, `.physics3.json`, `.cdi3.json`, textures, and `.moc3` in the same browser context.
- Cubism SDK for Web already targets JavaScript/TypeScript and WebGL.
- The result can be exported as a JSON download, avoiding early filesystem-write complexity.

If automatic workspace file output is required, add a tiny local-only dev endpoint or Vite middleware later. For the first spike, a browser download button for `kipfel2_vts-structure.json` is simpler and avoids adding server state.

## 6. Expected Data Extraction

From documented JSON assets:

- model settings version
- file references
- texture paths
- physics metadata and physics groups
- display names from `.cdi3.json`
- VTube Studio-specific metadata from `.vtube.json`, if needed

From Cubism SDK/Core runtime model:

- successful `.moc3` load status
- model canvas or size information where available
- parameter count, IDs, current values, min/max/default values
- part count, IDs, opacities
- drawable count, IDs, draw orders/render orders, texture indices
- drawable masks or clipping relationships where exposed
- drawable vertex/index counts and runtime flags where exposed

The sample should distinguish:

- data observed from public JSON files
- data observed through Cubism SDK/Core
- data not available from runtime package intake
- errors caused by missing SDK/Core, missing files, or Core load failure

## 7. Suggested Implementation Steps

1. Download Cubism SDK for Web from the official Live2D site.
2. Extract it outside the repository or into a gitignored local path.
3. Configure the sample app to serve the local Core assets required by the SDK.
4. Create a Vite TypeScript app under `experiments/cubism-web-moc3-inspector/`.
5. Fetch `ref/kipfel2_vts/黒シャツキプフェル.model3.json`.
6. Resolve relative asset paths from the `model3.json` directory.
7. Load `.moc3` bytes through Cubism SDK/Core.
8. Extract runtime-observable model structure.
9. Merge runtime observations with `.model3.json`, `.physics3.json`, and `.cdi3.json` facts.
10. Show the JSON in the browser and provide a download button.

## 8. Design Recommendation

Keep the SDK dependency isolated:

```text
inspectModelPackage.ts
  -> parses public JSON and orchestrates inspection

cubismSdkAdapter.ts
  -> the only module that touches Cubism SDK/Core

writeOutput.ts
  -> browser download first; optional local dev-server write later
```

This was the old boundary rationale. It is retained only to explain the superseded plan and is not current implementation guidance.

## 9. Open Questions

- Which SDK target should be used first: Web or Native? Current recommendation: Web, because the requested spike is a web app.
- Should the first output be a browser download or a file written directly under the workspace? Current recommendation: browser download first.
- Where should the local SDK path be configured? Candidate: `.env.local` with `VITE_CUBISM_SDK_WEB_ROOT` or a documented local symlink under `public/vendor/live2d/`.
- Which exact runtime fields should be considered required for the first successful spike?
