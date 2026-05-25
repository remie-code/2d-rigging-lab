# CMO3 / MOC3 Format Feasibility Summary

> Synthesis date: 2026-05-24  
> Scope: decision-oriented synthesis of the `.cmo3` and `.moc3` research reports for input/intake scenario planning.  
> Basis: `discussion/_conventions.md`, this topic's `_map.md`, `cmo3-format-report.md`, `moc3-format-report.md`, and `discussion/scenarios/02_DomainAcceptanceCriteria/201_Input_Asset_and_Model_Intake.md`.  
> Research note: this synthesis did not reopen broad web research; it relies on the cited source reports and the local scenario file.

## 1. Bottom Line

| Question | Provisional answer | Confidence | Decision impact |
|---|---|---:|---|
| Is independent `.cmo3` read/write feasible for this project? | Not as an MVP or acceptance-criteria commitment. Limited container inspection may be possible, but full semantic read/write and reliable round-trip save are not supported by an official public spec. | High | Treat direct editable `.cmo3` support as unresolved or Editor-mediated only. |
| Is independent `.moc3` read/write feasible? | Not as a primary product path. Official loading is feasible through Cubism SDK/Core, but independent binary parsing/writing depends on reverse-engineered work and lacks Live2D compatibility guarantees. | High | Do not base editing, export, or scenario success on owning `.moc3` serialization. |
| Is `.model3.json` + `.moc3` runtime intake feasible through official SDK/Core? | Yes, for runtime intake, display, validation, parameter/motion playback, and companion asset inspection, subject to SDK/Core licensing and security posture. | High | Keep runtime package intake in scope, with explicit limits on production-history recovery. |
| What should SC-IN-004 or the intake scenario say provisionally? | SC-IN-004 should not require independent `.cmo3` parsing/writing. It should be narrowed to recognizing `.cmo3` as an editing-project asset and, if needed, an Editor-mediated workflow until a dedicated implementation decision is made. | High | Scenario wording should separate asset classification from editable-state reconstruction. |

## 1.1 Recorded Design Decision

Decision date: 2026-05-24

The project will proceed under the following local-use policy unless the user later changes the distribution plan:

- The tool is not intended for public distribution.
- Cubism SDK/Core will not be bundled into this repository or redistributed as part of the tool.
- `.moc3` runtime intake may rely on a locally installed or user-provided official Cubism SDK/Core.
- SDK/Core access should be isolated behind an adapter boundary, so the rest of the editor can operate without directly depending on proprietary binaries.
- If SDK/Core is absent, the editor should still be able to inspect `.model3.json` and companion JSON/package structure where possible, while reporting that `.moc3` runtime loading is unavailable.
- Independent `.moc3` parsing/writing and independent `.cmo3` parsing/writing remain out of scope unless explicitly reopened as separate research tracks.

This is a project design decision, not legal advice. If the tool is ever distributed or exposed as a hosted/public service, SDK/Core licensing and publication requirements must be reviewed again before release.

## 2. Official Facts

- Live2D documentation classifies `.cmo3` as Model Workspace model data, `.moc3` as model data used by programs, and `.model3.json` as the model settings file linking `.moc3`, textures, physics settings, and related runtime assets.  
  Source: [Live2D File Types and Extensions](https://docs.live2d.com/en/cubism-editor-manual/file-type-and-extension/)
- Official embedded-data documentation says Cubism Editor exports `.moc3`, `.model3.json`, and textures by default from "Export as MOC3 file"; physics, user data, display info, motion-sync, parameter-controller, and motion files are optional or companion outputs.  
  Source: [Data for Embedded Use](https://docs.live2d.com/en/cubism-editor-manual/export-moc3-motion3-files/)
- Official Viewer documentation treats `.moc3` / `.model3.json` as embedded-use inputs and says `.cmo3` / `.can3` editing files cannot be loaded in Cubism Viewer.  
  Source: [About Cubism Viewer for OW](https://docs.live2d.com/en/cubism-editor-manual/cubism3-viewer-for-ow/)
- Official SDK documentation describes loading `.moc3` bytes into `CubismMoc` and creating a runtime model. It does not describe a supported SDK path for loading `.cmo3`.  
  Sources: [About Models Native](https://docs.live2d.com/en/cubism-sdk-manual/model/), [About Models Web](https://docs.live2d.com/en/cubism-sdk-manual/model-web/)
- Live2D Core is the official runtime component for handling `.moc3`, but Core is distributed under Live2D's proprietary SDK terms and is not published as open source in the framework repositories.  
  Sources: [Cubism Core API Reference](https://docs.live2d.com/en/cubism-sdk-manual/cubism-core-api-reference/), [Cubism Core](https://docs.live2d.com/en/cubism-sdk-manual/cubism-core/)
- Live2D's public `CubismSpecs` repository documents JSON companion formats such as `model3.json`, `physics3.json`, `motion3.json`, `userdata3.json`, and related files. The observed public specs do not include a `.moc3` binary layout.  
  Sources: [CubismSpecs](https://github.com/Live2D/CubismSpecs), [CubismSpecs FileFormats](https://github.com/Live2D/CubismSpecs/tree/master/FileFormats)

## 3. Public-Source Findings

- Public tools and libraries indicate that some `.cmo3` / `.can3` files use a reverse-engineered CAFF archive container. `wader/fq` can inspect CAFF and MOC3-related formats, and `caff-archive` advertises CAFF read/write support. This supports archive-level feasibility, not full editable `.cmo3` semantic compatibility.  
  Sources: [wader/fq](https://github.com/wader/fq), [fq formats](https://github.com/wader/fq/blob/master/doc/formats.md), [CAFF decoder](https://github.com/wader/fq/blob/master/format/caff/caff.go), [caff-archive](https://docs.rs/caff-archive/latest/caff_archive/)
- `file(1)` public issue history describes MOC3 and CAFF as proprietary Live2D Cubism formats and notes CAFF files usually use `.cmo3` or `.can3` extensions. This corroborates format identification but not semantic documentation.  
  Source: [MantisBT issue 0000472](https://bugs.astron.com/view.php?id=472)
- The open Live2D framework repositories wrap or depend on Cubism Core rather than providing an independent `.moc3` parser. Third-party renderers and Rust bindings follow the same pattern.  
  Sources: [CubismNativeFramework](https://github.com/Live2D/CubismNativeFramework), [CubismWebFramework](https://github.com/Live2D/CubismWebFramework), [pixi-live2d-display](https://github.com/guansss/pixi-live2d-display), [live2d-cubism-core-sys](https://docs.rs/live2d-cubism-core-sys/latest/live2d_cubism_core_sys/)
- Reverse-engineered `.moc3` tooling exists, including `py-moc3` and `moc3ingbird`/ImHex patterns, but these are not official specs and carry compatibility, validation, and reverse-engineering risk.  
  Sources: [py-moc3](https://pypi.org/project/py-moc3/), [OpenL2D/moc3ingbird](https://github.com/OpenL2D/moc3ingbird)
- Public CVE references around crafted MOC3 handling reinforce that arbitrary runtime model intake should be treated as a parser/loader security boundary even when using official Core.  
  Source: [CVE-2023-27566 summary](https://cvefeed.io/vuln/detail/CVE-2023-27566)

## 4. Repository Facts

- `SC-IN-004` currently describes accepting `Avatar_Working.cmo3` and reopening drawing elements, parts, meshes, deformers, parameters, and possible physics settings as editable model state.
- `SC-IN-005` already separates runtime package intake through `Avatar.model3.json`, `Avatar.moc3`, textures, and companion files from full production-history recovery. It explicitly distinguishes display/verification/re-output information from missing `.cmo3`/PSD authoring data.
- The topic map already reserves this file as the comparison/feasibility synthesis and lists unresolved questions about whether `.cmo3` and `.moc3` should be specification targets or SDK/runtime targets.

## 5. Assumptions

- "Independent read/write" means this project owns parsing and serialization without relying on Cubism Editor save/load or Cubism Core as the semantic parser.
- "Feasible for this project" means feasible enough to drive near-term scenario or acceptance-criteria commitments, not merely possible as an open-ended reverse-engineering research program.
- "Runtime intake" means loading and validating runtime packages for display, parameter/motion playback, metadata inspection, and companion JSON handling; it does not imply reconstructing a full Cubism authoring project.
- Licensing and reverse-engineering observations here are project risks only, not legal advice.

## 6. Feasibility Judgment

| Capability | `.cmo3` | `.moc3` | `.model3.json` + `.moc3` through official SDK/Core |
|---|---|---|---|
| Official role | Editable Cubism Model Workspace project data. | Runtime model binary used by programs. | Runtime package entry and official runtime loading path. |
| Official public binary/schema spec found | No. | No. | JSON companion specs exist; `.moc3` binary remains Core-loaded. |
| Official load path | Cubism Editor, not SDK/runtime. | Cubism SDK/Core. | Cubism SDK/Core plus public companion JSON formats. |
| Independent read | Low for full editable semantics; medium only for container/metadata experiments. | Limited/partial possible via reverse-engineered tools, but not a stable product foundation. | High for JSON package graph; `.moc3` data should be treated as Core-owned. |
| Independent write | Low. Reliable Editor-compatible save/round-trip is not established. | Low. Reverse-engineered round-trip claims exist, but modified semantic output is not a safe commitment. | High for companion JSON where documented; `.moc3` write remains out of scope unless generated by official Editor/export workflow. |
| MVP suitability | Not suitable except recognition/classification or Editor-mediated intake. | Not suitable as owned binary editing/export path. | Suitable for runtime preview, validation, package inspection, and limited metadata workflows. |

Overall judgment: independent `.cmo3` and `.moc3` read/write should not be treated as feasible foundations for this project unless the project explicitly chooses a reverse-engineering track, accepts licensing/commercial review, and funds a compatibility test matrix. `.model3.json` + `.moc3` runtime intake through official SDK/Core is feasible and aligns with Live2D's documented architecture.

## 7. Risks

- Licensing/reverse-engineering risk: Live2D licenses restrict reverse engineering of software, and the public `.moc3`/CAFF tooling is explicitly or implicitly reverse-engineered. This requires project-level risk review before implementation reliance.
- Compatibility risk: Cubism files are versioned and Editor compatibility is directional. A writer that works for one version may fail or corrupt files in another.
- Completeness risk: `.cmo3` likely carries authoring semantics absent from `.moc3`; `.moc3` runtime packages cannot recover full PSD/source/editing history.
- Security risk: accepting arbitrary `.moc3` or proprietary binary/container input requires sandboxing, defensive validation, and failure isolation.
- Product-support risk: promising `.cmo3` editable import would create expectations around commissioned source files, rig preservation, and save-back compatibility that the current evidence does not support.

## 8. Scenario Implications

### SC-IN-004

Provisional direction: keep `.cmo3` as a recognized Live2D editing-project asset, but do not state that the AI-native editor independently reopens all contents as editable model state.

Recommended future wording direction:

- "Editor recognizes `.cmo3` as a Cubism editing-project asset and records that full editable import is unsupported, unresolved, or requires Cubism Editor-mediated workflow."
- "If Cubism Editor-mediated intake is adopted, the scenario should say which operation provides the importable output, such as human export to `.model3.json` / `.moc3` plus textures and companion JSONs."
- "Editable-state reconstruction from `.cmo3` remains a separate research/decision item, not a baseline intake expectation."

### SC-IN-005

SC-IN-005 is directionally sound. It should remain the preferred runtime-package intake path:

- `.model3.json` is the entry point.
- `.moc3` is loaded through official SDK/Core.
- textures and companion JSON files are validated as package assets.
- missing `.cmo3` or PSD authoring sources are reported as limits, not ambiguous import failure.

### Intake Scenario / AC Boundary

For now, intake acceptance should distinguish three tiers:

| Tier | Provisional status | Expected capability |
|---|---|---|
| PSD/source artwork intake | In scope per existing scenarios. | Build editable internal source elements where supported. |
| `.model3.json` runtime package intake | In scope through official SDK/Core. | Preview, validate, inspect package graph, load companion assets, and report reconstruction limits. |
| `.cmo3` authoring project intake | Unresolved / Editor-mediated only. | Recognize/classify asset; avoid promising independent editable import or save-back. |

## 9. Follow-Up Experiments and Decisions

1. Choose the first SDK/Core adapter target: Web, Native, Unity, Java, or Unreal.
2. Prototype `.model3.json` package intake through official SDK/Core with a small model corpus: successful load, missing-file diagnostics, physics/expression/motion companion handling, and malformed-file failure behavior.
3. Define the security posture for untrusted `.moc3`: local-only trust, sandboxed loader process, rejected server-side parsing, or another isolation boundary.
4. Decide whether `.cmo3` support is excluded from MVP, kept as recognition-only, or pursued as an explicit research spike.
5. If `.cmo3` research is approved, run a contained experiment using public samples and public CAFF tooling only: identify archive entries, compare versions, test no-op round trips in Cubism Editor, and record failures. Do not turn this into scenario/AC commitment until legal/commercial and compatibility decisions are made.
6. If the tool ever becomes distributed, hosted, or shared outside personal/local use, review Cubism SDK/Core licensing and publication requirements before release.

## 10. Open Questions

- Is Editor-mediated `.cmo3` intake acceptable, or must the product work without Cubism Editor installed?
- Is runtime-only model preview/validation enough for imported `.model3.json` packages, or does the product require editing imported runtime rigs?
- Which Cubism SDK/Core target should be used first for the local adapter prototype?
- Should SC-IN-004 be rewritten now, or left as a draft with this report as the provisional caveat until AC ownership decides?
- What sample model corpus and Cubism version matrix will be used for feasibility experiments?
