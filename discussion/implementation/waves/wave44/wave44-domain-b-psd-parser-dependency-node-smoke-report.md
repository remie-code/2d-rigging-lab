# Wave44 Domain B Report: PSD Parser Dependency / Node Smoke

> Target: `wave44-psd-parser-dependency-node-smoke`
> Status: implemented
> Dependency evidence paths: `generated/dependencies/dependency-registry.json`; this Wave44 domain report

## Verdict

`pass`

Domain B introduced `@webtoon/psd@0.4.0` for the explicit-path Node smoke only, parsed `test_data/sample_model.psd`, emitted structured evidence for document metadata and layer tree contents, and proved raw RGBA raster extraction for one visible layer without persisting derived image bytes.

## Dependency Approval Evidence

Domain B approves `@webtoon/psd@0.4.0` only for the Wave44 explicit-path Node PSD parser smoke and fixture evidence workflow.

| Field | Evidence |
|---|---|
| Dependency | `@webtoon/psd` |
| Version | `0.4.0` |
| Scope | dev/test fixture smoke under `scripts/**`; not editor/runtime/public demo scope |
| Purpose | Parse `test_data/sample_model.psd` by explicit local path and expose PSD document metadata, layer/group tree evidence, layer bounds, visibility, opacity, and raster extraction availability. |
| License | MIT, per Domain A npm metadata and package provenance review basis |
| Registry/package posture | Domain A recorded npm integrity `sha512-ztriE8oFOamRrV9opBURDy+JMiyhur2//vOXsC5CgdnYCB0L1Lnaag4NzP8N+NFCj7uNz9JRYtPmAbQMSDLIsQ==`, package size `463943`, and no npm dependency field. |
| Provenance refs | npm package `@webtoon/psd@0.4.0`; homepage/docs `https://webtoon.github.io/psd/`; source repository `https://github.com/webtoon/psd` |
| Binary/WASM boundary | Review-required because package documentation describes WebAssembly image decoding. Domain B must inspect installed package files and record package-local binary-like artifacts before final pass. |
| Parser limitation boundary | Full Photoshop compositing, renderer correctness, texture sampling correctness, and pixel oracle remain unsupported/notEvaluated. |
| Fixture boundary | `test_data/sample_model.psd` is private/local fixture input only, not a public distributable demo asset. |
| Approval status | Approved for Domain B install and smoke only; future editor/runtime scope requires separate approval or scope expansion. |

Dependency registry correction:

- `generated/dependencies/dependency-registry.json` now records `@webtoon/psd@0.4.0` with MIT license, `dev:test:fixture-smoke:scripts-only:not-editor-runtime-demo` scope, and `wave44-domain-b-explicit-path-node-smoke-approved` status.
- No additional generated dependency evidence file was added because the existing repository pattern under `generated/dependencies/` contains only the registry file, and inventing a new evidence schema is outside this narrow correction.

Installed package evidence:

- `package.json` devDependency: `@webtoon/psd` exact version `0.4.0`.
- `pnpm-lock.yaml` entry: `@webtoon/psd@0.4.0` with integrity `sha512-ztriE8oFOamRrV9opBURDy+JMiyhur2//vOXsC5CgdnYCB0L1Lnaag4NzP8N+NFCj7uNz9JRYtPmAbQMSDLIsQ==`.
- `pnpm list @webtoon/psd --depth 0 --json`: installed at root as a devDependency, version `0.4.0`, resolved from npm registry tarball `https://registry.npmjs.org/@webtoon/psd/-/psd-0.4.0.tgz`.
- Installed `node_modules/@webtoon/psd/package.json`: license `MIT`, package version `0.4.0`, no runtime `dependencies` field.
- Installed package binary-like scan for `.wasm`, `.node`, `.exe`, `.dll`, and names matching `wasm|binary`: no files found. The package manifest has build/test-only `devDependencies` including `@webtoon/psd-decoder`, but the Wave44 lockfile did not add that package as a runtime or dev dependency of this repository.

## Source Fixture

| Field | Value |
|---|---|
| Source path | `test_data/sample_model.psd` |
| Source byteLength | `22406225` |
| Source SHA-256 | `44AB43238CD2B2AF2FB0CE6A7B5073A60E332D03DA7666EA274C02E0462294B5` |
| Privacy label | private/local fixture; not public distributable demo asset |

## Parser Smoke Evidence

Command:

```text
pnpm smoke:wave44:psd-parser
```

Result: passed.

Structured evidence emitted by `scripts/wave44-psd-parser-smoke.mjs`:

- schema: `wave44.psdParserNodeSmokeEvidence.v1`
- parser: `@webtoon/psd@0.4.0`
- source: `test_data/sample_model.psd`, byteLength `22406225`, SHA-256 `44AB43238CD2B2AF2FB0CE6A7B5073A60E332D03DA7666EA274C02E0462294B5`, private/local fixture, not public demo asset
- document: width `2048`, height `3072`, channelCount `4`, depth `8`, colorMode `3`, root childCount `14`
- tree summary: groupCount `20`, layerCount `126`, visibleLayerCount `121`, hiddenLayerCount `5`, rasterCandidateLayerCount `126`, maxDepth `3`
- layer evidence includes stable `nodeRef`, name, bounds `{ left, top, width, height, right, bottom }`, visible/hidden, opacity, and composedOpacity

Representative layer samples from the emitted evidence:

| nodeRef | name | bounds | visible | opacity | composedOpacity |
|---|---|---|---|---|---|
| `psd:root/layer[0]` | `headwear` | left `808`, top `92`, width `400`, height `288`, right `1208`, bottom `380` | `true` | `255` | `1` |
| `psd:root/layer[1]` | `headwear` | left `807`, top `93`, width `400`, height `286`, right `1207`, bottom `379` | `false` | `255` | `1` |
| `psd:root/group[2]/layer[0]` | `front hair` | left `692`, top `144`, width `620`, height `620`, right `1312`, bottom `764` | `true` | `255` | `1` |

## Raster Extraction Result

Raster extraction is available for the sample through `Layer.composite(false, false)`.

| Field | Value |
|---|---|
| Source layer ref | `psd:root/layer[0]` |
| Source layer name | `headwear` |
| Bounds | left `808`, top `92`, width `400`, height `288`, right `1208`, bottom `380` |
| Media type | `application/vnd.private-2d-rigging-lab.raw-rgba` |
| Extraction options | `effect=false`, `composed=false`, `bytesPersisted=false` |
| Derived byteLength | `460800` |
| Derived SHA-256 | `671E6A363745B1CE2E8D29C1A63438170FE9511C8884EA42298CF9B8886E5C1A` |
| Privacy label | private/local fixture evidence |

No derived raster bytes were written to the repository in Domain B.

## Files Changed

- `package.json`
- `pnpm-lock.yaml`
- `generated/dependencies/dependency-registry.json`
- `scripts/wave44-psd-parser-smoke.mjs`
- `discussion/implementation/waves/wave44/wave44-domain-b-psd-parser-dependency-node-smoke-report.md`

## Verification Performed

| Command/check | Result |
|---|---|
| `pnpm install` | passed; added `@webtoon/psd@0.4.0`; pnpm reported ignored build scripts for existing `esbuild` only |
| `pnpm smoke:wave44:psd-parser` | passed |
| `pnpm audit --audit-level moderate` | failed on pre-existing `vitest` advisory `GHSA-5xrq-8626-4rwp`; no finding was attributed to `@webtoon/psd` in the output |
| `pnpm audit --audit-level moderate --ignore GHSA-5xrq-8626-4rwp` | passed with that single baseline advisory ignored |
| `pnpm typecheck` | passed |
| `pnpm run check:source` | passed |
| `pnpm run check:deps` | passed |
| `pnpm list @webtoon/psd --depth 0 --json` | confirmed root devDependency `@webtoon/psd@0.4.0` |
| package binary-like artifact scan | no `.wasm`, `.node`, `.exe`, `.dll`, or `wasm|binary` named files found under installed `@webtoon/psd` |
| `git diff --check -- package.json pnpm-lock.yaml` | no whitespace findings; CRLF conversion warnings only |
| `git diff --check --no-index -- NUL scripts/wave44-psd-parser-smoke.mjs` | no whitespace findings; command exits nonzero because the file is new; CRLF conversion warning only |
| `git diff --check --no-index -- NUL discussion/implementation/waves/wave44/wave44-domain-b-psd-parser-dependency-node-smoke-report.md` | no whitespace findings; command exits nonzero because the file is new; CRLF conversion warning only |

No unit test was added for Domain B; the focused executable coverage is the explicit-path smoke script.

## Remaining Issues

- `pnpm audit --audit-level moderate` fails on existing `vitest@3.1.4` advisory `GHSA-5xrq-8626-4rwp`. Updating Vitest is outside Domain B's parser dependency/smoke scope.
- The prior generated registry gap was resolved by the Wave44 orchestration scope correction for `@webtoon/psd@0.4.0`.

## User-Decision Points

- None required for Domain B to complete the parser smoke.
- Future user decision remains required before any `test_data/sample_model.psd` derived visual bytes are treated as public distributable demo material.

## Write-Scope Collisions Or Early Escape Triggers

- No B-owned source collision was required.
- During implementation, unrelated concurrent changes were visible in `packages/contracts/**`, `packages/operation-core/**`, `packages/package-format/**`, `pnpm-workspace.yaml`, and existing Wave44 map/backlog docs. Domain B did not edit or revert them.
- No early escape trigger was hit for `@webtoon/psd`: install succeeded, parse succeeded, layer/group tree evidence was emitted, and raster extraction succeeded.
