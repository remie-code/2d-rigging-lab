# Wave45 Domain A Report: Browser Parser Dependency Scope / Trust Boundary

> Target: `wave45-browser-parser-dependency-scope-trust-boundary`
> Role: Gnome implementation/documentation agent
> Date: 2026-06-05
> Verdict: `pass`

## Verdict

`pass`

`@webtoon/psd@0.4.0` can be expanded from Wave44 scripts-only smoke scope to one narrow Wave45 Editor/browser explicit PSD import adapter scope.

The expansion is not a general Editor/runtime dependency approval. It permits direct `@webtoon/psd` import only in the future Wave45 Editor/browser explicit PSD import adapter/bridge that receives a user-selected PSD `ArrayBuffer`, parses it in the browser session, and converts the result into parser-free PSD evidence. Production packages, runtime, validator, general Editor source, demos, scripts outside the existing Wave44 smoke, and public asset workflows remain outside the approved import boundary.

## Files Changed

- `generated/dependencies/dependency-registry.json`
- `discussion/implementation/waves/wave45/wave45-domain-a-browser-parser-dependency-scope-trust-boundary-report.md`

No `apps/**`, `packages/**`, `package.json`, `pnpm-lock.yaml`, public demo assets, raw/visual fixture bytes, or parser bridge implementation files were changed.

## Registry Update

The registry entry for `@webtoon/psd@0.4.0` was updated from:

- `dev:test:fixture-smoke:scripts-only:not-editor-runtime-demo`

to:

- `dev:test:fixture-smoke:scripts-only;editor:browser:wave45-explicit-psd-import-adapter-only:not-packages-runtime-validator-demo`

The status now records Wave45 Domain A approval with embedded WASM boundary review. The registry purpose explicitly keeps raw/visual byte persistence, public demo material, package/runtime/validator direct import, drag-drop, archive/filesystem, renderer/pixel, Cubism, and repair scope out of this approval.

## Basis Used

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave45-plan.md`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/remaining-work-backlog.md`
- `discussion/implementation/waves/wave44/wave44-domain-h-integration-review-and-final-report.md`
- `discussion/implementation/reviews/wave44/wave44-domain-h-clean-integration-review.md`
- `discussion/implementation/waves/wave44/wave44-domain-a-psd-dependency-security-fixture-boundary-report.md`
- `discussion/implementation/reviews/wave44/wave44-domain-a-psd-dependency-security-fixture-boundary-review.md`
- `discussion/implementation/waves/wave44/wave44-domain-b-psd-parser-dependency-node-smoke-report.md`
- `discussion/implementation/reviews/wave44/wave44-domain-b-psd-parser-dependency-node-smoke-review.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `generated/dependencies/dependency-registry.json`
- `node_modules/@webtoon/psd/package.json`

External provenance references used:

- `https://github.com/webtoon/psd`
- `https://github.com/webtoon/psd/releases/tag/0.4.0`
- `https://github.com/webtoon/psd/blob/0.4.0/LICENSE`
- `https://github.com/webtoon/psd/blob/0.4.0/packages/psd/package.json`
- `https://github.com/webtoon/psd/blob/0.4.0/packages/decoder/Cargo.toml`
- `https://github.com/webtoon/psd/blob/0.4.0/packages/decoder/Cargo.lock`
- `https://github.com/webtoon/psd/blob/0.4.0/packages/decoder/src/lib.rs`

## License / Provenance / Security

| Item | Evidence | Domain A conclusion |
|---|---|---|
| npm package | Installed `node_modules/@webtoon/psd/package.json` reports `name=@webtoon/psd`, `version=0.4.0`, `license=MIT`, `type=module`, `main=./dist/index.js`, `types=./dist/index.d.ts`, and no runtime `dependencies` field. | Known package identity and license. |
| Upstream source | GitHub tag `0.4.0` exists and matches installed package metadata. Release `0.4.0` was published on 2023-06-27 from commit `3712289` per GitHub release page. | Provenance is traceable to the public `webtoon/psd` repository and tag. |
| Distribution license | Upstream `LICENSE` at tag `0.4.0` is MIT, copyright NAVER WEBTOON. | Allowed license for the package distribution. |
| npm lockfile | `pnpm-lock.yaml` contains `@webtoon/psd@0.4.0` with integrity `sha512-ztriE8oFOamRrV9opBURDy+JMiyhur2//vOXsC5CgdnYCB0L1Lnaag4NzP8N+NFCj7uNz9JRYtPmAbQMSDLIsQ==` and an empty dependency snapshot. | No npm transitive dependency expansion. |
| Security audit | `pnpm.cmd audit --audit-level moderate --ignore GHSA-5xrq-8626-4rwp` exited `0`. Raw `pnpm.cmd audit --audit-level moderate` still reports only the pre-existing `vitest` advisory `GHSA-5xrq-8626-4rwp` at path `.>vitest`. | No audit finding attributable to `@webtoon/psd` in this lockfile check. |
| External vulnerability lookup | Web search did not find a package-specific OSV/Snyk vulnerability page for `@webtoon/psd@0.4.0`. This is weaker than an authenticated scanner result and is not treated as proof of no vulnerabilities. | Acceptable only with the narrow bridge scope and local audit result. |

## Embedded WASM Boundary

Domain A independently verified the additional Wave45 issue from local installed package inspection.

| Field | Evidence |
|---|---|
| Location | `node_modules/@webtoon/psd/dist/index.js:1305` embeds a `data:application/wasm;base64,...` string. |
| Instantiation path | `dist/index.js:1307` through `:1327` decodes the data URL via guarded `Buffer.from` or browser `atob`, then calls `WebAssembly.instantiate`. A non-data URL fallback uses `fetch` / `instantiateStreaming`, but the installed bundle uses the data URL. |
| Decoded size | `22041` bytes. |
| Decoded SHA-256 | `23aed4d5d96530e23bcd5c8ba753d2d8896d6d431e918a170ea03bc45b2c7919`. |
| File scan | Recursive installed package scan found no separate `.wasm`, `.node`, `.exe`, `.dll`, or wasm/binary-named files under `node_modules/@webtoon/psd`. |
| Source map | `dist/index.js.map` lists `../../decoder/dist/index.js` and `../src/methods/generateRgba.ts`, connecting the bundled decoder to the upstream decoder package. |
| WASM producers metadata | Decoded module text in the bundle includes Rust, `rustc 1.70.0`, `walrus 0.19.0`, and `wasm-bindgen 0.2.87` producer strings. |
| Upstream decoder source | Tag `0.4.0` has `packages/decoder/src/lib.rs`, with MIT header and exported `decode_rgb`, `decode_rgba`, `decode_grayscale`, and `decode_grayscale_a` functions. |
| Upstream Rust dependency lock | Tag `0.4.0` has `packages/decoder/Cargo.lock` with checksums for `wasm-bindgen 0.2.87`, `console_error_panic_hook 0.1.7`, `web-sys 0.3.64`, `js-sys 0.3.64`, and build/transitive crates. |

Policy interpretation:

- The embedded WASM is a binary-like artifact even though it is not stored as a separate file.
- It is justified for the narrow Editor/browser explicit PSD import adapter because source, package tag, checksum, license, purpose, allowed environment, and update process are recorded here.
- Redistribution is limited to the repository's existing private prototype dependency bundle posture. No public demo bundle, screenshot, export, or distributable sample material approval is created by this report.
- Update process: any `@webtoon/psd` version change, regenerated dist, changed embedded WASM checksum, or move to another parser requires a new dependency/trust-boundary review before use outside the already approved scope.

## Browser Suitability

| Check | Result |
|---|---|
| Module format | ESM package with `type=module` and `main=./dist/index.js`. Official README says the package is provided as a pure ECMAScript module and should be bundled for browsers. |
| Browser input model | Official README documents browser file input usage via `File.arrayBuffer()` and `Psd.parse(result)`. This matches Wave45 explicit file selection. |
| Browser APIs | Installed bundle relies on standard `TextDecoder`, `TextEncoder`, `atob`, and `WebAssembly.instantiate` in browser path. Node fallbacks for `Buffer` and `module.require("util")` are guarded behind `typeof` checks or unavailable-browser branches. |
| Network behavior | The installed embedded data URL path does not require network fetch for the WASM. A generic non-data URL branch exists but is not the path used by the bundled data URL. |
| Dependency footprint | npm lockfile snapshot for `@webtoon/psd@0.4.0` is empty; no npm runtime dependencies. Rust-side build inputs are inside the embedded WASM provenance boundary above. |
| Known parser failure shape | Rust decoder uses panic/expect paths for malformed RLE/output bounds; bridge code must catch parse/materialization failures and turn them into session evidence instead of crashing the app workflow. |

Conclusion: browser import viability is sufficient for Domains B-D to attempt the adapter, provided they keep parsing isolated to explicit user-selected bytes and record failure states truthfully.

## Allowed Import Boundary For Domains B-D

Domains B-D may add direct `@webtoon/psd` import only under the future Wave45 Editor/browser explicit PSD import adapter/bridge source owned by Domain B, and only for this flow:

1. User explicitly selects a local PSD file through the approved file input workflow.
2. Browser session reads the selected `File` as an `ArrayBuffer`.
3. The adapter parses the bytes with `@webtoon/psd@0.4.0`.
4. The adapter extracts only metadata, group/layer tree fields, visibility/opacity/bounds, unsupported/notEvaluated feature summary, parse failure evidence, and selected-layer compact materialization evidence summary if separately implemented by the proper domain.
5. The adapter emits parser-free evidence shapes for session/package bridges. It must not store raw parser objects in package/session state.

Domain B owns the import site and parser-free conversion. Domain C may consume parser-free evidence only. Domain D may display parser-free evidence and parse state only.

## Forbidden Boundary

This approval does not allow:

- Direct `@webtoon/psd` import in `packages/**`, runtime-core, validator-core, operation-core, package-format, contracts, viewer/runtime, general Editor components, demo tooling, or public asset workflows.
- Drag-drop, directory picker, File System Access API, archive expansion, native filesystem, remote URL fetch, OS watcher, cloud transport, or ZIP behavior.
- General PSD materialization, all-layer raster export, raw/visual byte persistence, public screenshots, public exports, public bundles, or public demo assets derived from `test_data/sample_model.psd`.
- Photoshop-style full compositing, blend/effects/mask/color-management correctness, renderer/pixel oracle, texture sampling correctness, full renderer, or standalone viewer claims.
- Cubism SDK/Core, Cubism import/export/load compatibility, `.moc3`, `.model3.json`, Cubism Physics compatibility, or use as a Cubism oracle.
- Repo-side repair generation, repair candidate ranking, natural-language repair, LLM/provider integration, auto-fix, automatic apply, or automatic commit.

## Large PSD And Failure Trust Boundary

Domains B-D must treat every PSD as untrusted user-supplied binary input.

Required behavior expectations:

- Enforce a small, explicit initial size cap or reject path for unusually large selected PSD bytes before parse. Domain A does not set the numeric cap; Domain B must choose and test it against current Editor UX constraints.
- Prefer a Web Worker or equivalent non-blocking isolation for parse/materialization work when integrating into UI. If Domain B cannot use a worker in scope, it must record the main-thread risk and keep the workflow focused.
- Wrap parse and selected-layer materialization in catchable error handling. Failures must become parser-free session evidence with failure kind/message summary, not uncaught application crashes.
- Do not persist selected PSD bytes into public assets, screenshots, exports, or raw/visual derived byte files.
- Preserve save/load truthfulness: persisted state may know prior byte evidence and parse result summaries, but a later session must not pretend PSD bytes are still locally available unless the existing same-origin byte restore path actually restores them.
- Preserve private/local fixture wording for `test_data/sample_model.psd`; it remains a private/local fixture, not public distributable demo material.

## Unsupported / Not Evaluated Boundaries

The following remain unsupported or not evaluated after Domain A:

- full compositing, renderer/pixel oracle, texture sampling correctness;
- Cubism SDK/Core, Cubism import/export/load compatibility, `.moc3`, `.model3.json`, Cubism Physics;
- archive/filesystem, directory picker, drag-drop, File System Access API, remote URL, OS watcher;
- public demo assets or sample PSD visual redistribution;
- repair/LLM/provider/autofix behavior.

## Verification Performed

| Command/check | Result |
|---|---|
| `git status --short -uall` | Existing unrelated changes were visible: `discussion/implementation/orchestration/_map.md` modified and `discussion/implementation/orchestration/wave45-plan.md` untracked before Domain A edits. Domain A did not edit or revert them. |
| Basis document reads | Read Wave45 plan, Wave44 dependency/security reports and reviews, Wave44 clean integration/final report, current capability map, backlog, dependency policy, source organization policy, registry, and installed package metadata. |
| Installed package metadata | `node_modules/@webtoon/psd/package.json` reports version `0.4.0`, MIT, ESM, no runtime dependencies, and package-local `@webtoon/psd-decoder` devDependency/build dependency. |
| Dependency footprint scan | `package.json` and `pnpm-lock.yaml` show only root devDependency `@webtoon/psd@0.4.0`; lockfile package snapshot is empty. |
| Embedded WASM scan | `rg` confirmed embedded data URL, guarded `Buffer.from`, `atob`, `WebAssembly.instantiate`, and fallback `fetch` paths in `dist/index.js`. |
| Embedded WASM checksum | Decoded byteLength `22041`; SHA-256 `23aed4d5d96530e23bcd5c8ba753d2d8896d6d431e918a170ea03bc45b2c7919`. |
| Package binary-like file scan | No separate `.wasm`, `.node`, `.exe`, `.dll`, wasm-named, or binary-named files found under installed `@webtoon/psd`. |
| Source map inspection | `dist/index.js.map` lists `../../decoder/dist/index.js` and `../src/methods/generateRgba.ts`; decoder source is traceable to tag `0.4.0` files. |
| GitHub source/provenance checks | Fetched tag `0.4.0` package metadata, LICENSE, decoder `Cargo.toml`, decoder `Cargo.lock`, and decoder `src/lib.rs` through the GitHub app. |
| `pnpm.cmd audit --audit-level moderate --ignore GHSA-5xrq-8626-4rwp` | Passed, exit `0`. |
| `pnpm.cmd audit --audit-level moderate` | Failed only on pre-existing `vitest` advisory `GHSA-5xrq-8626-4rwp`; path `.>vitest`. |
| `pnpm.cmd run check:deps` | Passed after registry/report edit. Output: `Dependency guard passed.` |
| `git diff --check -- generated/dependencies/dependency-registry.json discussion/implementation/waves/wave45/wave45-domain-a-browser-parser-dependency-scope-trust-boundary-report.md` | Passed for tracked registry diff; only LF-to-CRLF working-copy warning for the registry file. |
| `git diff --check --no-index -- NUL discussion/implementation/waves/wave45/wave45-domain-a-browser-parser-dependency-scope-trust-boundary-report.md` | No whitespace findings for the new untracked report; command exited nonzero as expected for a no-index diff against `NUL`, with LF-to-CRLF working-copy warning only. |

## Remaining Issues

- Domain A does not implement the browser parser bridge. Domains B-D still need source implementation, tests, and import-guard checks.
- Domain B must pick and test the large PSD size cap and worker/main-thread behavior.
- Domain B must ensure parser errors, unsupported compression/depth/channel cases, malformed RLE failures, and materialization failures become truthful parser-free session evidence.
- External vulnerability lookup was not a full authenticated SCA scan. The pass relies on local lockfile audit, package provenance, and narrow scope.

## User-Decision Points

None required for this narrow Domain A registry/report update.

Future user decisions remain required before:

- treating `test_data/sample_model.psd` or derived visual bytes as public distributable demo material;
- widening parser usage beyond the Editor/browser explicit PSD import adapter;
- implementing archive/filesystem, drag-drop, full renderer, renderer/pixel oracle, Cubism compatibility, public demo assets, or repo-side repair/LLM/autofix scope.
