# MOC3 Format Availability and Feasibility Report

> Status: Historical private research archive. Current project policy supersedes the implementation recommendations in this report. The Private 2D Rigging Lab will not inspect, load, parse, convert, or reconstruct `.moc3`, `.cmo3`, `.model3.json`, `.physics3.json`, `.motion3.json`, or `.pose3.json`, and will not use Cubism SDK/Core.

Research date: 2026-05-24

Scope: Live2D Cubism `.moc3` public specification availability, SDK loading path, OSS ecosystem evidence, and practical read/write feasibility for AI-native 2D Character Rigging Editor model intake and runtime export decisions.

All recommendations below are historical. Current implementation guidance is in [format-feasibility-summary.md](format-feasibility-summary.md).

## Key Conclusion

The public evidence does not show an official, public binary file-format specification for `.moc3`. Official Live2D documentation describes `.moc3` as runtime model data exported by Cubism Editor and loaded by Cubism SDK/Core, while the official public `CubismSpecs` repository documents JSON companion formats rather than the `.moc3` binary layout. This is absence-of-found-evidence, not proof that no private or partner documentation exists.

Practical conclusion: runtime loading through the official SDK/Core is realistic. Independent production-grade `.moc3` read/write, especially editing and re-emitting modified `.moc3`, is not a realistic MVP foundation without accepting reverse-engineering, compatibility, licensing, and validation risk.

## Repository Context

- `discussion/scenarios/02_DomainAcceptanceCriteria/201_Input_Asset_and_Model_Intake.md` includes runtime-package intake and `.cmo3` authoring-asset scenarios. The `.moc3` question mainly affects whether runtime-only packages can become editable source models.
- `discussion/scenarios/02_DomainAcceptanceCriteria/211_Runtime_Export_and_Compatibility.md` frames runtime export and compatibility as observable load/display/parameter/motion behavior, not byte-identical binary output.
- This report should inform the open map question in `discussion/reports/cmo3-moc3-format-spec/_map.md`: whether `.moc3` should be treated as a public spec target or as an SDK-loaded runtime artifact.

## Official Facts

- Live2D's file-type manual describes `.moc3` as the final exported model format from the Model Workspace and as model data used by programs. It describes `.model3.json` as the file that links `.moc3`, textures, physics settings, and blink/lip-sync parameter lists. Source: [File Types and Extensions](https://docs.live2d.com/en/cubism-editor-manual/file-type-and-extension/).
- The embedded-data manual describes `.moc3` as actual Live2D model data for application use. It says `.moc3`, `.model3.json`, and textures are exported by default from "Export as MOC3 file"; physics, user data, display info, motion-sync, parameter-controller, and motion files are separate optional or companion outputs. Source: [Data for Embedded Use](https://docs.live2d.com/en/cubism-editor-manual/export-moc3-motion3-files/).
- Cubism Viewer for OW loads embedded-use data, accepts `.moc3` or `.model3.json`, and explicitly states that `.cmo3` and `.can3` editing files cannot be loaded in the Viewer. Source: [About Cubism Viewer (for OW)](https://docs.live2d.com/en/cubism-editor-manual/cubism3-viewer-for-ow/).
- The Native SDK manual says vertex and object movement relative to parameters is recorded in `.moc3`; physics and ArtMesh user data are separate files; `.model3.json` tracks file references. It documents loading by reading `.moc3` bytes, calling `CubismMoc::Create`, then `CubismMoc::CreateModel`. Source: [About Models (Native)](https://docs.live2d.com/en/cubism-sdk-manual/model/).
- The Web SDK manual gives the same conceptual model and documents `CubismMoc.create(buffer)` followed by `createModel()`. Source: [About Models (Web)](https://docs.live2d.com/en/cubism-sdk-manual/model-web/).
- The Cubism Core API Reference describes Core as the C API library needed to handle `.moc3` models created by Cubism 3+ Editors. Core calculates vertex information and exposes rendering data such as UV and opacity; it is not itself a drawing API. Source: [Cubism Core API Reference](https://docs.live2d.com/en/cubism-sdk-manual/cubism-core-api-reference/).
- Live2D says Cubism Core is included in SDK packages but is not published on GitHub under the Live2D Proprietary Software License Agreement. Source: [Cubism Core](https://docs.live2d.com/en/cubism-sdk-manual/cubism-core/).
- Live2D's public `CubismSpecs` repository says it contains Cubism-related specifications and JSON schema tooling. Its `FileFormats` directory lists `cdi3.json.md`, `exp3.json.md`, `model3.json.md`, `motion3.json.md`, `motionsync3.json.md`, `physics3.json.md`, `pose3.json.md`, and `userdata3.json.md`; it does not list a `.moc3` binary specification file in the observed tree. Sources: [CubismSpecs README](https://github.com/Live2D/CubismSpecs), [CubismSpecs/FileFormats](https://github.com/Live2D/CubismSpecs/tree/master/FileFormats).
- Live2D's SDK tutorial says model settings are JSON and can be edited as text if each setting's formatting is followed, and points to `CubismSpecs` for JSON file specs. This statement applies to JSON companion files, not to `.moc3`. Source: [Add Models to Sample Projects (Native)](https://docs.live2d.com/en/cubism-sdk-tutorials/model-add-to-sample-project/).

## Public-Source Findings

- Official Live2D framework repositories are open, but the Core binary/parser is not in those repositories. `CubismNativeFramework` says it is used with Cubism Core to load models and that Core for Native is not included in the repository. Source: [CubismNativeFramework README](https://github.com/Live2D/CubismNativeFramework).
- `CubismWebFramework` similarly says it is used with the Live2D Cubism Core library to load the model, and Core for Web is not included in the repository. Source: [CubismWebFramework README](https://github.com/Live2D/CubismWebFramework).
- `pixi-live2d-display`, a third-party PixiJS renderer, supports Cubism 3/4 models by requiring `live2dcubismcore.min.js`; it does not present itself as an independent `.moc3` parser. Source: [pixi-live2d-display README](https://github.com/guansss/pixi-live2d-display).
- Rust ecosystem examples are also mostly wrappers around Live2D Core. The older `live2d` crate says its `live2d-sys` package requires `Live2DCubismCore` and a `CUBISM_CORE` path to build/link. Source: [docs.rs live2d 0.1.0](https://docs.rs/live2d/0.1.0). The newer `live2d-cubism-core-sys` crate describes itself as raw FFI bindings to Live2D Cubism SDK Core v5. Source: [docs.rs live2d-cubism-core-sys](https://docs.rs/live2d-cubism-core-sys/latest/live2d_cubism_core_sys/).
- `py-moc3` is a recent third-party Python package claiming `.moc3` read/write support, byte-identical round trips, and support for format versions V3.00 through V5.00. It also says its implementation was ported from `moc3-reader-re`, described there as Java decompilation of the Cubism SDK exporter. This is reverse-engineered evidence, not an official spec. Source: [py-moc3 on PyPI](https://pypi.org/project/py-moc3/).
- `OpenL2D/moc3ingbird` provides a crafted `.moc3` security PoC and an ImHex pattern file that it says can inspect MOC3 files. Its README characterizes Live2D Cubism Core as the only widespread MOC3 reader implementation. Treat that as a third-party claim and security/reverse-engineering signal, not as official Live2D documentation. Source: [OpenL2D/moc3ingbird](https://github.com/OpenL2D/moc3ingbird).
- CVE aggregators record CVE-2023-27566 for crafted MOC3 files causing an out-of-bounds write in Live2D Cubism Editor/Core-era handling. This reinforces that accepting arbitrary `.moc3` input has security implications and should be sandboxed/validated, even when using the official loader. Source: [CVE-2023-27566 summary](https://cvefeed.io/vuln/detail/CVE-2023-27566).

## Assumptions

- "Public spec" means an official, stable, public description of the `.moc3` binary layout sufficient to implement an interoperable reader/writer without the Live2D Core binary.
- "Independent read/write" means the project owns parsing and serialization of `.moc3`, not merely calling Cubism Core or wrapping official SDK APIs.
- "Editing/re-emitting `.moc3`" means modifying model geometry, parameters, deformers, ArtMesh data, or equivalent runtime model data and writing a `.moc3` accepted by current official runtimes.
- This report does not provide legal advice. License and reverse-engineering questions are project risk items for separate legal/commercial review.

## Feasibility Judgment

### Does `.moc3` have a public spec?

Judgment: no official public binary spec was found. Confidence: high for public Live2D docs/GitHub searched on 2026-05-24, but not absolute.

Rationale: official docs explain what `.moc3` is and how to load/export it; official `CubismSpecs` publishes JSON companion schemas; the SDK/Core docs expose loader APIs and getter APIs. None of the official sources found publish a binary schema comparable to the JSON specs.

### Is runtime loading via SDK realistic?

Judgment: yes, realistic and the intended path. Confidence: high.

Use `.model3.json` as the package entry point where possible, load `.moc3` bytes through `CubismMoc`/Core, bind textures through the renderer, and load companion JSONs for physics, display info, user data, expressions, pose, and motions. This aligns with both official Native/Web manuals and the OSS ecosystem.

### Is independent read realistic?

Judgment: limited/partial independent read is technically possible, but not a stable production basis. Confidence: medium.

For metadata and runtime inspection, the official Core getter APIs are the safer path. Reverse-engineered readers may extract IDs, counts, UVs, indices, parameter ranges, and other arrays, but compatibility across Cubism versions and malformed files would need substantial validation.

### Is independent write realistic?

Judgment: not realistic as a primary product path. Confidence: medium-high.

`py-moc3` claims writer and byte-identical round-trip support, which proves some public experimentation exists. However, the source basis is reverse-engineered, recent, beta-status, and not backed by Live2D compatibility guarantees. Writing semantically modified `.moc3` files that survive official Core, Viewer, SDK versions, and feature-version differences is a larger problem than byte round-tripping unchanged files.

### Is editing and re-emitting `.moc3` realistic?

Judgment: not realistic for MVP or acceptance criteria unless the project explicitly accepts a reverse-engineering track. Confidence: high.

`.moc3` is a runtime artifact. Official editing source is `.cmo3`; official runtime output comes from Cubism Editor's export flow. Public SDK docs provide loading and runtime manipulation, not an official `.moc3` exporter API. Runtime-only `.model3.json` packages can support preview, validation, parameter/motion playback, and limited metadata inspection, but should not be treated as fully recoverable authoring projects.

## Recommendations

- Treat `.moc3` as an SDK-loaded runtime artifact, not as the editor's authoritative editable persistence format.
- For intake, support `.model3.json` packages and direct `.moc3` loading for preview/validation through official Cubism SDK/Core where licensing permits.
- Preserve companion JSON handling as first-class: `.model3.json`, `.physics3.json`, `.userdata3.json`, `.cdi3.json`, `.exp3.json`, `.pose3.json`, `.motion3.json`, `.motionsync3.json`, and `.paramctrl3.json` are public/structured enough to inspect and edit more safely than `.moc3`.
- For imported runtime-only models, communicate a "runtime-compatible but not full-authoring" capability boundary: render, inspect, validate, maybe edit external JSON/package metadata; do not promise full rig editing or `.moc3` regeneration.
- If `.moc3` modification remains a desired feature, isolate it as a separate research spike with representative model corpus tests, SDK-version matrix tests, sandboxing, and legal/licensing review before it affects acceptance criteria.

## Unresolved Questions and Decision Points

- Does the product require editing imported runtime-only `.model3.json`/`.moc3` packages, or is preview/validation sufficient when `.cmo3` is unavailable?
- Which official SDK targets must be supported first: Web, Native, Unity, Java, or Unreal?
- Can the project distribute or require Live2D Cubism Core under the intended commercial/open-source model?
- Is there any official Editor automation, plugin, or partner API for exporting `.moc3` from an editable project that should be evaluated separately?
- What security posture is required for untrusted `.moc3` intake: local-only trust, sandboxed parser/loader process, or server-side rejection?
- If reverse-engineered read/write is explored, what compatibility bar is required: byte round-trip, official Viewer load, parameter/render equivalence, or multi-version SDK equivalence?

## Search Limits

Sources checked: official Live2D manuals/tutorials, Cubism SDK manuals, Live2D GitHub repositories, official `CubismSpecs`, selected third-party OSS projects and packages, and selected CVE/security references. This pass did not test code, download SDK packages, inspect private documentation, or perform a license/legal analysis.
