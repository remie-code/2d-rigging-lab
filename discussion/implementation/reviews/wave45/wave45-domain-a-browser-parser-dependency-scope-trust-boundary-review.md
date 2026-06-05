# Wave45 Domain A Review: Browser Parser Dependency Scope / Trust Boundary

> Target: `wave45-browser-parser-dependency-scope-trust-boundary`
> Role: Review-Sylph independent clean reviewer
> Date: 2026-06-05
> Artifact: `discussion/implementation/reviews/wave45/wave45-domain-a-browser-parser-dependency-scope-trust-boundary-review.md`

## Verdict

`pass`

No blocking findings were found. The `@webtoon/psd@0.4.0` dependency scope expansion is narrow enough for the future Wave45 Editor/browser explicit PSD import adapter only, and the embedded WebAssembly decoder is documented and independently checked as a binary-like artifact for that narrow scope.

This is not approval for direct parser imports in `packages/**`, runtime, validator, general Editor components, demos, public asset workflows, archive/filesystem flows, renderer/pixel work, Cubism compatibility, or repair/LLM/autofix behavior.

## Scope Reviewed

Changed files reviewed:

- `generated/dependencies/dependency-registry.json`
- `discussion/implementation/waves/wave45/wave45-domain-a-browser-parser-dependency-scope-trust-boundary-report.md`

Basis and evidence used:

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave45-plan.md`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/remaining-work-backlog.md`
- `discussion/implementation/waves/wave44/wave44-domain-h-integration-review-and-final-report.md`
- `discussion/implementation/reviews/wave44/wave44-domain-h-clean-integration-review.md`
- `discussion/implementation/waves/wave44/wave44-domain-b-psd-parser-dependency-node-smoke-report.md`
- `discussion/implementation/reviews/wave44/wave44-domain-b-psd-parser-dependency-node-smoke-review.md`
- `discussion/development_convention/dependency-policy.md`
- `generated/dependencies/dependency-registry.json`
- `node_modules/@webtoon/psd/package.json`
- `node_modules/@webtoon/psd/README.md`
- `node_modules/@webtoon/psd/dist/index.js`
- `node_modules/@webtoon/psd/dist/index.js.map`
- Upstream official/source files:
  - `https://github.com/webtoon/psd/blob/0.4.0/README.md`
  - `https://github.com/webtoon/psd/blob/0.4.0/packages/psd/package.json`
  - `https://github.com/webtoon/psd/blob/0.4.0/LICENSE`
  - `https://github.com/webtoon/psd/blob/0.4.0/packages/decoder/Cargo.toml`
  - `https://github.com/webtoon/psd/blob/0.4.0/packages/decoder/Cargo.lock`
  - `https://github.com/webtoon/psd/blob/0.4.0/packages/decoder/src/lib.rs`

I did not rely on Gnome's report as the only basis. I read the changed files, policy basis, prior Wave44 reports/reviews, installed package files, direct diffs/scans, and upstream source files.

## Findings

### Blocking

None.

### Low / Residual

- Independent raw `pnpm.cmd audit --audit-level moderate` was not completed in this review. The approval reviewer rejected that command because it can disclose the private workspace dependency graph to an external service. I did not work around that rejection. The narrower ignored-baseline audit command exited `0`, and the pass mainly rests on local dependency guard, lockfile/package inspection, upstream provenance, binary-like scan, and narrow scope.
- External vulnerability search did not produce a package-specific OSV/Snyk finding for `@webtoon/psd@0.4.0`, but that is not proof of no vulnerabilities.
- Browser use is plausible, not yet product-proven. Domains B-D still need implementation and tests for bundling, parse failure handling, large file rejection, and UI/session behavior.

## Dependency Scope And Registry Conclusion

Pass.

- The registry has one `@webtoon/psd` entry at `generated/dependencies/dependency-registry.json:28` through `:33`.
- The updated purpose explicitly limits the expansion to Wave45 Editor/browser explicit PSD import adapter use, parser-free session/package evidence, embedded WASM boundary review, and no raw/visual persistence, public demo material, package/runtime/validator direct import, drag-drop, archive/filesystem, renderer/pixel, Cubism, or repair scope at `generated/dependencies/dependency-registry.json:30`.
- The scope is classified as existing scripts-only smoke plus `editor:browser:wave45-explicit-psd-import-adapter-only:not-packages-runtime-validator-demo` at `generated/dependencies/dependency-registry.json:32`.
- Registry JSON parse passed: dependency count `5`, `@webtoon/psd` entry count `1`.
- The report states the expansion is not general Editor/runtime approval and restricts direct import to the future adapter/bridge at `discussion/implementation/waves/wave45/wave45-domain-a-browser-parser-dependency-scope-trust-boundary-report.md:14`.
- No `apps/**`, `packages/**`, manifests, lockfiles, public demo assets, raw/visual bytes, or parser bridge implementation files were changed in Domain A, per the report at `:21` and direct working-tree inspection.

This satisfies the dependency policy requirements that PSD/image tooling receive explicit approval, provenance review, and scope classification before use outside an existing scope (`discussion/development_convention/dependency-policy.md:164`, `:181`).

## Browser Suitability And WASM/Security Conclusion

Pass for Domain A's narrow approval gate.

Installed package and upstream metadata:

- Installed `node_modules/@webtoon/psd/package.json:2` through `:14` reports name `@webtoon/psd`, version `0.4.0`, MIT license, `type=module`, `main=./dist/index.js`, and `types=./dist/index.d.ts`.
- `pnpm-lock.yaml:460` through `:461` records `@webtoon/psd@0.4.0` with the expected integrity, and `pnpm-lock.yaml:891` shows an empty package snapshot.
- `pnpm.cmd list @webtoon/psd --depth 0 --json` confirmed root devDependency `@webtoon/psd@0.4.0` resolved from the npm registry tarball.
- Upstream tag files match installed package metadata and MIT license. The upstream README says the package is ESM, browser/Node capable, uses WebAssembly for image decoding, accepts `ArrayBuffer`, shows `file.arrayBuffer()` plus `Psd.parse(result)`, and recommends Web Worker parsing.

Embedded WASM boundary:

- `node_modules/@webtoon/psd/dist/index.js:1305` embeds a `data:application/wasm;base64,...` payload.
- `node_modules/@webtoon/psd/dist/index.js:1307` through `:1319` decodes data URLs through guarded `Buffer.from` or browser `atob`, then calls `WebAssembly.instantiate`.
- `node_modules/@webtoon/psd/dist/index.js:1321` through `:1326` contains a generic non-data URL `fetch` fallback, but the installed bundle uses the embedded data URL.
- Decoded WASM byte length: `22041`.
- Decoded WASM SHA-256: `23aed4d5d96530e23bcd5c8ba753d2d8896d6d431e918a170ea03bc45b2c7919`.
- Decoded WASM strings include `producers`, `Rust`, `rustc`, `1.70.0`, `walrus`, `wasm-bindgen`, and `0.2.87`.
- Recursive installed package scan found no separate `.wasm`, `.node`, `.exe`, `.dll`, or wasm/binary-named files under `node_modules/@webtoon/psd`.
- `dist/index.js.map` lists `../../decoder/dist/index.js` and `../src/methods/generateRgba.ts`, connecting the embedded decoder path to the upstream decoder package.
- Upstream `packages/decoder/Cargo.toml` records a Rust `cdylib`/`rlib` decoder using `wasm-bindgen 0.2.87`, optional `console_error_panic_hook 0.1.7`, and `web-sys 0.3.64`.
- Upstream `packages/decoder/Cargo.lock` records checksums for the Rust build inputs.
- Upstream `packages/decoder/src/lib.rs` has MIT header and exports `decode_rgb`, `decode_rgba`, `decode_grayscale`, and `decode_grayscale_a`; its RLE/raw decode paths use panic/expect failure behavior that Domains B-D must catch at the adapter boundary.

This is sufficient binary-like evidence for the narrow adapter approval under the policy's binary requirement for source, checksum, license, purpose, environment, redistribution rule, approval status, and update process (`discussion/development_convention/dependency-policy.md:141` through `:147`, `:378` through `:380`). The report records update process at `discussion/implementation/waves/wave45/wave45-domain-a-browser-parser-dependency-scope-trust-boundary-report.md:95`.

## Allowed Import Boundary For Domains B-D

Domains B-D may introduce a direct `@webtoon/psd` import only in the future Wave45 Editor/browser explicit PSD import adapter/bridge owned by Domain B, matching the report section at `discussion/implementation/waves/wave45/wave45-domain-a-browser-parser-dependency-scope-trust-boundary-report.md:110`.

The allowed flow is:

1. User explicitly selects a local PSD file through approved file input.
2. Browser session reads that `File` as `ArrayBuffer`.
3. Adapter parses bytes with `@webtoon/psd@0.4.0`.
4. Adapter emits parser-free evidence: source profile, document metadata, layer/group tree, visibility/opacity/bounds, unsupported/notEvaluated summary, parse failure evidence, and selected-layer compact materialization summary where separately implemented.
5. Parser objects and raw PSD/raster bytes do not enter package/session persisted state.

Current import scan status:

- Existing direct imports remain only in Wave44 scripts: `scripts/wave44-psd-parser-smoke.mjs:6` and `scripts/wave44-psd-layer-materialization.mjs:6`.
- Fixed-string scans under `apps packages` for `from "@webtoon/psd"`, `from '@webtoon/psd'`, `import("@webtoon/psd")`, and `require("@webtoon/psd")` found no matches.
- Package/app mentions are evidence strings in tests, not parser imports.

## Forbidden Import Boundary

The following remain forbidden unless a later dependency/scope review explicitly approves them:

- Direct `@webtoon/psd` import in `packages/**`, runtime-core, validator-core, operation-core, package-format, contracts, viewer/runtime, general Editor source, demos, or public asset workflows.
- Drag-drop, directory picker, File System Access API, archive expansion, native filesystem, remote URL, OS watcher, cloud transport, or ZIP behavior.
- General PSD materialization, all-layer raster export, raw/visual byte persistence, public screenshots/exports/bundles, or public demo assets from `test_data/sample_model.psd`.
- Photoshop-style full compositing, blend/effects/mask/color-management correctness, renderer/pixel oracle, texture sampling correctness, full renderer, or standalone viewer claims.
- Cubism SDK/Core, Cubism import/export/load compatibility, `.moc3`, `.model3.json`, Cubism Physics compatibility, or Cubism oracle use.
- Repo-side repair generation/ranking, natural-language repair, LLM/provider integration, autofix, automatic apply, or automatic commit.

The report records this boundary at `discussion/implementation/waves/wave45/wave45-domain-a-browser-parser-dependency-scope-trust-boundary-report.md:122` through `:131`.

## Large File / Failure / Fixture Boundary

Pass as Domain A documentation and handoff requirements.

- The report correctly states Domains B-D must treat PSD files as untrusted user-supplied binary input at `discussion/implementation/waves/wave45/wave45-domain-a-browser-parser-dependency-scope-trust-boundary-report.md:133`.
- Required expectations include a size cap/reject path, worker or recorded main-thread risk, catchable parse/materialization errors, no raw/visual byte persistence, truthful save/load byte availability, and private/local fixture wording at `:137` through `:146`.
- Domain A does not pretend to implement these controls; it assigns them to later implementation domains. That is the right boundary for this scope-only dependency review.

## Verification Performed

- `git diff -- generated/dependencies/dependency-registry.json discussion/implementation/waves/wave45/wave45-domain-a-browser-parser-dependency-scope-trust-boundary-report.md`: reviewed tracked registry diff directly.
- Read untracked Domain A report directly because `git diff` does not show untracked file content.
- Registry JSON parse: passed; dependency count `5`, `@webtoon/psd` count `1`.
- `pnpm.cmd run check:deps`: passed with `Dependency guard passed.`
- `git diff --check -- generated/dependencies/dependency-registry.json discussion/implementation/waves/wave45/wave45-domain-a-browser-parser-dependency-scope-trust-boundary-report.md`: exit `0`; CRLF warning only.
- `git diff --check --no-index -- NUL discussion/implementation/waves/wave45/wave45-domain-a-browser-parser-dependency-scope-trust-boundary-report.md`: no whitespace findings; expected no-index diff exit `1`; CRLF warning only.
- Installed package metadata inspection: version/license/ESM/dist entry confirmed.
- Lockfile inspection: root devDependency and empty `@webtoon/psd@0.4.0` snapshot confirmed.
- `pnpm.cmd list @webtoon/psd --depth 0 --json`: confirmed installed root devDependency `0.4.0` and npm tarball resolution.
- Embedded WASM scan: data URL, browser decode path, fallback fetch path, decoded byte length, SHA-256, and producer strings checked.
- Installed package binary-like file scan: no separate `.wasm`, `.node`, `.exe`, `.dll`, wasm-named, or binary-named files found.
- Source map scan: decoder source path references found.
- GitHub source fetch: package metadata, README, LICENSE, decoder `Cargo.toml`, decoder `Cargo.lock`, and decoder `src/lib.rs` fetched from tag `0.4.0`.
- Parser direct import scans under `apps packages`: no direct parser imports found.
- Forbidden-scope scan over changed Domain A artifacts: hits were negative/forbidden-boundary wording only.
- `pnpm.cmd audit --audit-level moderate --ignore GHSA-5xrq-8626-4rwp`: exited `0` with `No new vulnerabilities were ignored`.
- Raw `pnpm.cmd audit --audit-level moderate`: not independently rerun; approval rejected due private dependency graph disclosure risk.

## Remaining Issues / User-Decision Points

No user decision is required for Domain A to pass.

Remaining implementation obligations for later domains:

- Domain B must implement the browser adapter, choose/test a PSD size cap, decide worker vs recorded main-thread risk, and turn parser/materialization failures into parser-free evidence.
- Domain C must consume parser-free evidence only; it must not import `@webtoon/psd`.
- Domain D may display parser-free evidence and parse state only.
- Domain F or later guard work should add/import-scan enforcement once the allowed Domain B import site exists.

Future user decisions remain required before widening scope to public demo assets, public screenshots/exports/bundles derived from the private/local PSD fixture, archive/filesystem/drag-drop/File System Access API, full renderer/pixel oracle, Cubism compatibility, or repo-side repair/LLM/autofix behavior.

## Separation Confirmation

Gnome and Review-Sylph were separated. I acted only as the independent review gate, did not edit `generated/dependencies/dependency-registry.json` or the Domain A report, and wrote only this review artifact.
