# CMO3 Format Report

> Status: Historical private research archive. Current project policy supersedes the implementation recommendations in this report. The Private 2D Rigging Lab will not inspect, load, parse, convert, or reconstruct `.cmo3`, `.moc3`, `.model3.json`, `.physics3.json`, `.motion3.json`, or `.pose3.json`, and will not use Cubism SDK/Core.

> Research date: 2026-05-24  
> Scope: Live2D Cubism `.cmo3` format specification availability and practical independent read/write feasibility, with SC-IN-004 impact.

All recommendations below are historical. Current implementation guidance is in [format-feasibility-summary.md](format-feasibility-summary.md).

## Executive Conclusion

`.cmo3` appears, with high confidence, to be the Cubism Editor model work/project file for the Model Workspace, not the runtime model format. Official Live2D documentation says the Model Workspace handles model data as `.cmo3`, exports runtime `.moc3`, and exports `.model3.json` to link runtime assets such as `.moc3`, textures, and physics files. Official Viewer documentation separately says `.cmo3` / `.can3` editing files cannot be loaded in Cubism Viewer; the Viewer loads embedded-use data such as `.moc3` or `.model3.json`.

I did not find an official `.cmo3` file-format specification detailed enough to implement an independent, compatible, production-grade reader/writer. Public OSS evidence indicates that `.cmo3`/`.can3` use a reverse-engineered CAFF archive container and that container-level parsing is possible. That is not the same as a stable, documented semantic schema for all editable Live2D model structures or a safe round-trip writer.

Recommendation for SC-IN-004: treat direct `.cmo3` support as a high-risk stretch goal unless the product is explicitly allowed to depend on Cubism Editor as the import/export authority. For MVP, prefer PSD intake and runtime package intake via `.model3.json` / `.moc3`, while marking `.cmo3` editing-project intake as unresolved or "Editor-mediated only."

## Official Facts

Live2D's official "File Types and Extensions" page classifies `.cmo3` as the model data handled by the Model Workspace, `.moc3` as the model data used in programs, and `.model3.json` as the model settings file that links `.moc3`, textures, physics settings, and related metadata. The same page states that Cubism 3 changed `.cmo3` so model data includes physics settings.  
Source: [File Types and Extensions](https://docs.live2d.com/en/cubism-editor-manual/file-type-and-extension/)

Official embedded-data documentation says data for embedded use is output from `.cmo3` and `.can3`; the default "Export as MOC3 file" outputs `.moc3`, `.model3.json`, and textures, with optional files such as physics, motion-sync, user data, parameter/display information, and motions.  
Source: [Data for Embedded Use](https://docs.live2d.com/en/cubism-editor-manual/export-moc3-motion3-files/)

Official SDK documentation describes runtime loading around `.model3.json` and `.moc3`: model references are taken from `.model3.json`, and `.moc3` is loaded into memory to create `CubismMoc` and `CubismModel` instances. I found no equivalent SDK path for loading `.cmo3`.  
Source: [About Models (Native)](https://docs.live2d.com/en/cubism-sdk-manual/model/)

Official Cubism Viewer documentation says the Viewer is for validating data created with Cubism, loads embedded-use data, and cannot load `.cmo3` / `.can3` editing files. It starts by dragging in `.moc3` or `.model3.json`.  
Source: [About Cubism Viewer (for OW)](https://docs.live2d.com/en/cubism-editor-manual/cubism3-viewer-for-ow/)

Official manual notes say CMO3, CAN3, and CMP3 files are backward compatible: newer Editors can use older files, but older Editors may not open files created or saved with newer Editors and may corrupt them.  
Source: [Live2D Cubism Manual](https://docs.live2d.com/en/cubism-editor-manual/top/)

Live2D documents an Editor external API over WebSocket/JSON, but the documented functions are for interaction with the running Editor, such as parameters, documents, physics information, logs, and export notifications. I did not find a documented API that exposes full `.cmo3` parse/serialize or a supported headless `.cmo3` to `.moc3` compiler.  
Sources: [External API Integration](https://docs.live2d.com/en/cubism-editor-manual/external-application-integration-api/), [External API Function List](https://docs.live2d.com/en/cubism-editor-manual/external-application-integration-api-list/)

The Editor software license includes restrictions relevant to reverse-engineering risk, including no reverse engineering/decompilation/disassembly of the Software, no evasion of license/security means, and output-file usage restrictions by license type. This report is not legal advice; the project risk is that format work based on inspecting Live2D software internals may cross license boundaries even if file bytes are user-provided.  
Source: [Live2D Cubism Editor Software License Agreement](https://www.live2d.com/eula/live2D-editor-software-license-agreement_en.html)

If the project uses or distributes Cubism SDK functionality, Live2D's SDK Release License page says SDK verification/development is available subject to Live2D SDK software license agreements, while publishing SDK-based content may require a publication license depending on user/entity/use case.  
Source: [SDK Release License](https://www.live2d.com/en/sdk/license/)

## Public-Source Findings

`wader/fq`, an MIT-licensed binary-format inspection tool, lists `caff` and `moc3` among supported formats. Its CAFF decoder registers the format as a "Live2D Cubism archive" and parses archive IDs, format versions, preview image fields, file-info entries, obfuscation, compression flags, and embedded files. This is evidence that container-level inspection of some `.cmo3` files is practical, not evidence of full semantic `.cmo3` model support.  
Sources: [wader/fq README](https://github.com/wader/fq), [fq formats](https://github.com/wader/fq/blob/master/doc/formats.md), [CAFF decoder](https://github.com/wader/fq/blob/master/format/caff/caff.go)

The public `file(1)` issue tracker accepted magic detection for MOC3 and CAFF, describing MOC3 and CAFF as proprietary Live2D Cubism formats and noting that CAFF files usually use `.cmo3` or `.can3` extensions. This supports the CAFF-container observation but does not provide official semantics.  
Source: [MantisBT issue 0000472](https://bugs.astron.com/view.php?id=472)

The `caff-archive` Rust crate advertises CAFF archive read/write support for `.cmo3` and `.can3` files. Its README-like registry text also says it was created without vendor code and was informed by public reverse-engineering work. This again points to archive-level feasibility, with the same caveat: archive write support is not a guarantee that Cubism Editor will accept edited project semantics across versions.  
Source: [caff-archive docs](https://docs.rs/caff-archive/latest/caff_archive/)

Public practitioner pages commonly distinguish runtime deliverables from source/editable files, calling `.cmo3`/`.can3` source files and `.moc3`/textures/settings runtime deliverables. This aligns with official documentation but is secondary evidence.  
Example source: [PIXELVERTICE project terms](https://pixelvertice.com/projects)

## Repository Facts

`discussion/scenarios/02_DomainAcceptanceCriteria/201_Input_Asset_and_Model_Intake.md` currently defines SC-IN-004 as accepting an existing `Avatar_Working.cmo3` and reopening drawing elements, parts, meshes, deformers, parameters, and possible physics settings as editable model state.

The same scenario file already separates `.cmo3` editing-project intake from `.model3.json` / `.moc3` runtime package intake. SC-IN-005 explicitly treats runtime packages as display/verification inputs with incomplete production-history recovery when `.cmo3` and PSD are absent.

The report map in `discussion/reports/cmo3-moc3-format-spec/_map.md` lists `cmo3-format-report.md` as the `.cmo3` specification/publication and read/write feasibility report.

## Assumptions

Independent read/write means implementing support in this repository without relying on Cubism Editor's proprietary save/load implementation at runtime.

"Documented enough" means an official or stable public specification sufficient to parse, validate, modify, and re-emit `.cmo3` files with predictable compatibility across supported Cubism versions.

Public CAFF parsers are assumed to cover observed samples, not the full future `.cmo3` semantic space. This is a search-based assumption, not an exhaustive test result.

## Feasibility Judgment

| Capability | Feasibility | Confidence | Rationale |
|---|---:|---:|---|
| Open `.cmo3` in Cubism Editor manually | High | High | Official docs identify `.cmo3` as Model Workspace model data. |
| Use `.cmo3` as source for Editor export to `.moc3` | High, with Editor | High | Official export flow outputs embedded data from `.cmo3`. |
| Load `.cmo3` through Cubism SDK/runtime | Low / unsupported | High | SDK docs focus on `.model3.json` / `.moc3`; Viewer docs exclude `.cmo3`. |
| Independent CAFF container inspection | Medium | Medium | OSS decoders and magic detection exist. |
| Independent semantic read into editable model graph | Low to Medium | Low | Public evidence is reverse-engineered and incomplete relative to all editable semantics. No official schema found. |
| Independent `.cmo3` writer with reliable Editor round-trip | Low | Medium | Archive writers exist publicly, but semantic correctness, version compatibility, and corruption risk remain unresolved. |
| Independent `.cmo3` to `.moc3` compiler | Low | Medium | Official flow uses Cubism Editor export. No official headless compiler found. |

Practical result: `.cmo3` should not be considered documented enough for independent read/write implementation. A limited importer that extracts container entries or reads known metadata could be researched experimentally, but a user-facing promise to edit and save `.cmo3` would be fragile without an explicit compatibility test matrix and license review.

## SC-IN-004 Impact

SC-IN-004 is valid as a Cubism reference workflow: a human can open `.cmo3` in Cubism Editor and inspect model structure. It is not currently valid as an independent implementation commitment unless narrowed.

Recommended wording direction for future scenario/AC updates:

- Treat `.cmo3` intake as "supported only through Cubism Editor-mediated workflow" until a formal implementation decision is made.
- Separate "recognize and classify `.cmo3` as an editing-project asset" from "parse into editable AI-native internal state."
- For MVP, keep `.model3.json` / `.moc3` runtime intake as display/verification-oriented and avoid implying full reconstruction of production editing state.
- If `.cmo3` is retained in scope, require a dedicated experiment with real sample files, Cubism version matrix, round-trip tests, and explicit license/risk approval before implementation.

## Reverse-Engineering and Project Risks

Licensing risk: Live2D's Editor license restricts reverse engineering of the Software. File-format work that depends on decompiling or instrumenting Editor/Core internals is a high-risk path. This report does not determine legal permissibility.

Compatibility risk: official docs say project/editing files are backward-compatible only in the newer-Editor direction. A writer that targets one version may fail or corrupt data in another.

Completeness risk: `.cmo3` likely carries editable structures absent from `.moc3` runtime output, including source/model guide image relationships, edit-time model structures, physics data, and Editor-specific metadata. Missing any of these can produce lossy imports or invalid saves.

Security/robustness risk: proprietary binary/container formats need defensive parsing. Even public discussions around Live2D formats include vulnerability history around Cubism Core and MOC3 validation, so malformed input handling must be treated as a security boundary.

Product risk: promising `.cmo3` editing support would create user expectations around opening existing paid/commissioned source files, preserving rig quality, and saving back for Cubism Editor. Without official support, failures would be hard to diagnose and support.

## Unresolved Questions and Decision Points

1. Should `.cmo3` be excluded from MVP as an editable input, leaving only recognition/classification and guidance to use Cubism Editor?
2. Is an Editor-mediated workflow acceptable, where users open/export via Cubism Editor and this product consumes `.model3.json` / `.moc3` / texture packages?
3. Does the project intend to distribute Cubism SDK-based functionality, and if so, which SDK license/publication path applies to the product category?
4. Is the team willing to run a controlled reverse-engineering experiment using only public sample files and public OSS decoders, with no decompilation of Live2D software?
5. What Cubism Editor versions must be supported if `.cmo3` intake remains a requirement?

## Search Limits

Official sources checked included Live2D Editor manual pages, SDK manual pages, Editor external API pages, Viewer documentation, and Live2D license pages available as of 2026-05-24. Public sources checked included GitHub/OSS decoders, a `file(1)` magic issue, Rust crate documentation, and practitioner pages. I did not inspect proprietary binaries, decompile Live2D software, or test actual `.cmo3` samples in this report.
