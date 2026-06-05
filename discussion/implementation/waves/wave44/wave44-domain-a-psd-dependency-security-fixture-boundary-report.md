# Wave44 Domain A Report: PSD Dependency / Security / Fixture Boundary

> Target: `wave44-psd-dependency-security-fixture-boundary`
> Drafted by: Gnome implementation/documentation agent
> Review status: pending independent Review-Sylph review

## Verdict

`pass`

Domain A fixed the policy boundary for Wave44 Batch 1 without adding dependencies, editing source, editing package manifests, or decoding `test_data/sample_model.psd`.

Domain B must perform the actual dependency manifest/lockfile change, dependency registry/approval evidence, `npm audit`/OSV/Snyk or equivalent checks against the actual lockfile, dependency guard verification, and sample parse smoke before treating any parser as approved implementation.

## Files Changed

- `discussion/implementation/waves/wave44/wave44-domain-a-psd-dependency-security-fixture-boundary-report.md`

No changes were made to `package.json`, `pnpm-lock.yaml`, `packages/**`, `apps/**`, `scripts/**`, `discussion/implementation/current-capability-map.md`, or `discussion/implementation/remaining-work-backlog.md`.

## Basis Used

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave44-plan.md`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/remaining-work-backlog.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/tests/fixtures/fixture-manifest.md`
- `discussion/tests/traceability/test-traceability-matrix.md`
- `test_data/sample_model.psd` metadata/hash only

## Repository And Fixture Facts

- Repository manifest state: `package.json` currently lists only `@types/node`, `typescript`, and `vitest` in `devDependencies`.
- Manifest/lockfile search for `ag-psd`, `@webtoon/psd`, and `psd` found no current PSD/decode dependency in `package.json` or `pnpm-lock.yaml`.
- `test_data/sample_model.psd` metadata:
  - byteLength: `22406225`
  - SHA-256: `44AB43238CD2B2AF2FB0CE6A7B5073A60E332D03DA7666EA274C02E0462294B5`
  - lastWriteTime: `2026/05/23 20:41:38`
- Domain A did not decode, parse, render, export, screenshot, or otherwise inspect PSD semantic contents.

## Dependency Candidate Matrix

Registry metadata below is the 2026-06-05 evidence gathered by Orch-Sylph. Domain A did not install packages.

| Candidate | License / provenance | Security and dependency posture | Node/browser suitability | Layer tree and raster extraction suitability | Domain A decision |
|---|---|---|---|---|---|
| `@webtoon/psd@0.4.0` | MIT. npm tarball integrity `sha512-ztriE8oFOamRrV9opBURDy+JMiyhur2//vOXsC5CgdnYCB0L1Lnaag4NzP8N+NFCj7uNz9JRYtPmAbQMSDLIsQ==`. Homepage/docs: <https://webtoon.github.io/psd/>. GitHub: <https://github.com/webtoon/psd>. Maintainers: `orange.bae`, `pastelmind`, `leedonghyun`. | npm metadata reports small package size (`463943`) and no dependencies. README says zero dependencies, but image decoding uses WebAssembly, so Domain B must review WASM/package provenance as binary-like dependency evidence before approval. No formal audit has been run against a Wave44 lockfile yet. | README/docs describe browser and Node support. Node requires passing an `ArrayBuffer` rather than a `Buffer`, which is compatible with explicit-path Node smoke if converted deliberately. | Docs/README claim layer information, offsets/sizes/image data, layer names, opacity, text strings, traversal, unicode text, guides/slices, and PSB support. Layer effects are WIP and metadata not directly image-related is unsupported. `Layer.prototype.composite()` can extract layer pixel data. | Preferred primary Wave44 parser/decode candidate, pending Domain B install approval, WASM/provenance review, and `sample_model.psd` smoke proving parse, group/layer tree, and selected layer raster extraction. |
| `ag-psd@30.1.1` | MIT. Repo: <https://github.com/Agamnentzar/ag-psd>. npm tarball integrity `sha512-0GbWYR4Rvm1QnWCYeMiVbUJBXnSyTUKvNUK2tIIVDt/wrUVUL9pHTsnwqOTonEC2RRh5I/aUcGydc1LNgXfJWA==`. Maintainer: `agamnentzar <agamnentzar@gmail.com>`. | Direct deps: `base64-js@1.5.1` MIT and `pako@2.1.0` `(MIT AND Zlib)`, both with recorded integrity. Package is larger (`12520348`). Snyk search found no direct vulnerabilities for `ag-psd@28.5.0`, but that is not a formal audit of `30.1.1` or the final lockfile. | README says `readPsd` accepts `ArrayBuffer`, typed array, and Node `Buffer`. Node image data/thumbnails need `node-canvas` through `ag-psd/initialize-canvas`; browser paths use canvas, with worker requirements around `OffscreenCanvas`/`bitmaprenderer`. | README and `README_PSD.md` indicate `useImageData` can expose `psd.imageData` and `layer.imageData`, so selected layer raster extraction is plausible. Limitations include unsupported Indexed/CMYK/Multichannel/Duotone/LAB, 16 bits/channel, PSB, patterns, animations, some metadata, 3D effects, newer Photoshop features, and incomplete text layer handling. | Backup candidate only if `@webtoon/psd` fails sample smoke or WASM/package provenance review. If selected, Domain B must document `node-canvas` avoidance or approval and parser limitations. |
| `psd@3.4.0` | npm metadata did not return a license field. npm page: <https://www.npmjs.com/package/psd>. Repo uses `git+ssh://git@github.com/meltingice/psd.js.git`. | Older dependency chain includes `coffee-script`, `coffeescript-module`, `iconv-lite`, `jspack`, `lodash`, `parse-engine-data`, `pngjs`, and `rsvp`. `lodash@4.17.21` and `pngjs@3.2.0` are MIT, but this does not clear all transitive dependency/license/security risk. Last modified `2022-06-24T22:35:21.472Z`. | PSD.js is described as a general-purpose CoffeeScript PSD parser. Browser/Node suitability for current TypeScript/Vite workflow is weaker than the other candidates and carries legacy dependency risk. | Parser may expose PSD structures, but Domain A has insufficient clean evidence that it is the best route for deterministic selected layer raster materialization under current policy. | Reject/defer. Do not use unless a separate license, provenance, maintenance, and security review explicitly clears it. |

## Recommendation

Prefer `@webtoon/psd` as the primary Wave44 parser/decode candidate.

Rationale:

- It is MIT licensed, has clear official docs, no npm dependencies, and is explicitly positioned for browser and Node PSD/PSB parsing.
- Its documented layer traversal, layer image data, text, opacity, and `Layer.prototype.composite()` surfaces align with Wave44's need for layer tree and selected layer raster materialization without claiming Photoshop-style full compositing.
- Its main unresolved risk is the WebAssembly decode/provenance boundary. That risk is suitable for Domain B's dependency approval gate and sample smoke, not a reason for Domain A to add the package.

Use `ag-psd` as backup only if `@webtoon/psd` fails one of these Domain B gates:

- cannot parse `test_data/sample_model.psd`;
- cannot expose a usable layer/group tree;
- cannot expose selected layer pixel/raster data;
- WASM/package provenance review is blocked;
- Node explicit-path smoke is materially unreliable.

Keep `psd` rejected/deferred until its missing license field, legacy dependency chain, and security posture are separately cleared.

## Domain B Dependency Gate

Domain B must not treat this report as dependency approval. Before committing a parser dependency, Domain B must:

- create/update dependency approval evidence required by `discussion/development_convention/dependency-policy.md`;
- record package name, exact version, purpose, scope, license, provenance, registry metadata, and maintainer/source refs;
- update `package.json` and `pnpm-lock.yaml` only after the approval evidence exists;
- run formal dependency/security checks against the generated lockfile, including `npm audit`/OSV/Snyk or equivalent;
- run the repository dependency guard after the manifest/lockfile diff;
- document whether any WASM or binary-like artifact exists in the selected package and how its provenance/checksum/redistribution boundary is handled;
- prove explicit-path Node smoke on `test_data/sample_model.psd` for parse, document metadata, group/layer tree, and selected layer raster extraction;
- stop and escalate if install/network approval, license uncertainty, parser failure, missing layer tree, or missing layer raster data blocks the smoke.

## Fixture And Provenance Policy

`test_data/sample_model.psd` is a private/local fixture allowed by the Wave44 plan. It is not a public distributable demo asset.

Allowed uses in Wave44:

- explicit local path parse/smoke in Node;
- metadata, byteLength, digest, parser evidence, layer tree evidence, selected layer raster materialization evidence;
- private/local regression evidence under documented fixture/provenance labels.

Forbidden uses in Wave44:

- public demo screenshots, public exports, public distributable sample bundles, or marketing/demo claims derived from this PSD;
- treating the PSD or derived visual bytes as rights-clean public assets;
- using visual output as a full renderer, Photoshop compositing, or pixel oracle.

## Derived Artifact Policy

If later domains commit derived bytes from `test_data/sample_model.psd`, place them in a clearly private Wave44 fixture path such as:

- `test_data/derived/wave44/**`
- another explicit Wave44/private fixture directory approved by the later domain

Each committed derived artifact must include adjacent or bundled provenance metadata with:

- source path;
- source SHA-256 and source byteLength;
- parser package and exact version;
- extraction options;
- source layer reference or stable parser-derived layer path/id;
- generated timestamp and tool/script id;
- mediaType;
- digest and byteLength of the derived artifact;
- privacy label: private/local fixture, not public distributable demo asset;
- unsupported/notEvaluated claims for compositing, renderer, pixel correctness, and parser limitations.

Derived visual bytes must not be promoted to public rights-clean demo material without a separate user decision and rights/provenance review.

## Unsupported Photoshop Feature Boundary

Wave44 may claim only the parser/materialization behavior proven by source, tests, and sample evidence. Product Preflight and validator surfaces may report unsupported or not-evaluated diagnostics for the following, but must not claim them as implemented:

- Photoshop-style full compositing;
- blend mode correctness;
- layer effects;
- masks and clipping semantics unless specifically parsed and tested;
- smart objects;
- adjustment layers;
- vector layer rerendering;
- text rerendering beyond parsed text strings;
- color profiles and color-managed output;
- CMYK/LAB/Indexed/Multichannel/Duotone, 16 bits/channel, and PSB limits depending on selected parser;
- texture sampling correctness;
- full renderer, rendered acceptance oracle, or pixel oracle.

## Early Escape Conditions

Later domains must stop and escalate rather than widening scope if any of these occur:

- selected parser cannot parse `test_data/sample_model.psd`;
- no usable layer/group tree is exposed;
- no selected layer pixel/raster data is exposed;
- dependency license, provenance, maintainer, WASM/binary, or security posture is risky or unclear;
- package install/network approval is required outside the planned Domain B approval gate;
- derived artifact repository policy conflicts with private/local fixture policy;
- Domain A findings require source implementation or manifest edits;
- Editor file picker/drag-drop/browser PSD UX is required to pass;
- full compositing, full renderer, texture sampling correctness, or pixel oracle is required to pass;
- Cubism compatibility or proprietary parser/oracle claims become necessary.

## Verification Performed

- Read the required Wave44 orchestration, capability, backlog, dependency, source organization, fixture, and traceability documents listed above.
- Confirmed `package.json` currently has only `@types/node`, `typescript`, and `vitest` in `devDependencies`.
- Searched `package.json` and `pnpm-lock.yaml` for `ag-psd`, `@webtoon/psd`, and `psd`; no matches were found.
- Verified `test_data/sample_model.psd` metadata and SHA-256 without decoding or parsing the PSD.
- Confirmed no source, script, package manifest, or lockfile edits were made.
- `git status --short -uall` before this report showed pre-existing modifications in `discussion/implementation/current-capability-map.md` and `discussion/implementation/remaining-work-backlog.md`; Domain A did not edit them.

## Remaining Issues

- Domain B still needs the actual dependency approval evidence, manifest/lockfile change, lockfile-based audit, dependency guard run, and sample parse smoke.
- `@webtoon/psd` WASM/package provenance must be reviewed before approval.
- The final parser choice remains provisional until `test_data/sample_model.psd` parse, layer tree, and selected layer raster materialization are proven.
- No Review-Sylph record exists yet for this report; independent review is pending.

## User-Decision Points

- None required for Domain A to pass.
- A future user decision is still required before any `sample_model.psd` derived visual bytes can be treated as public distributable demo material.

## Gnome / Review-Sylph Separation

Gnome drafted this Domain A report. Review-Sylph review is pending and should be recorded separately under `discussion/implementation/reviews/wave44/**` by the reviewer, not by this implementation agent.
