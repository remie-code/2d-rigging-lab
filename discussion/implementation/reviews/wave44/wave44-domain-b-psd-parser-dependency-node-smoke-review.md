# Wave44 Domain B Review: PSD Parser Dependency / Node Smoke

> Target: `wave44-psd-parser-dependency-node-smoke`
> Role: Review-Sylph independent reviewer
> Resumed scope: registry correction for `@webtoon/psd@0.4.0`
> Verdict: `pass`

## Scope Reviewed

- `package.json`
- `pnpm-lock.yaml`
- `generated/dependencies/dependency-registry.json`
- `scripts/wave44-psd-parser-smoke.mjs`
- `discussion/implementation/waves/wave44/wave44-domain-b-psd-parser-dependency-node-smoke-report.md`
- Previous review in this file, which had escalated on the missing generated registry entry
- Basis documents: Wave44 plan, Domain A report/review, dependency policy, source organization policy, fixture manifest

Gnome and Review-Sylph contexts were separated. This review read the basis docs, target files, registry, diff, and verification outputs directly, and did not rely on Gnome's summary as the sole basis.

## Findings

No blocking findings.

Non-blocking observations:

- The working tree contains concurrent non-Domain-B changes under `packages/contracts/**`, `packages/operation-core/**`, `packages/package-format/**`, `pnpm-workspace.yaml`, and Wave44 map/backlog docs. I treated those as unrelated or parallel Domain C work and did not review them as Domain B implementation.
- Raw `pnpm audit --audit-level moderate` still fails on the known baseline `vitest` advisory `GHSA-5xrq-8626-4rwp`; the advisory path is `.>vitest`, not `@webtoon/psd`.

## Dependency Registry Evidence Conclusion

Pass.

- `generated/dependencies/dependency-registry.json:28` through `generated/dependencies/dependency-registry.json:33` now records exactly one `@webtoon/psd` entry at version `0.4.0`, MIT license, scope `dev:test:fixture-smoke:scripts-only:not-editor-runtime-demo`, and status `wave44-domain-b-explicit-path-node-smoke-approved`.
- The entry matches the existing registry shape: `name`, `version`, `purpose`, `license`, `scope`, and `status` inside the top-level `dependencies[]` array.
- Registry JSON parse passed: dependency count `5`, `@webtoon/psd` entry count `1`.
- `generated/dependencies/` currently contains only `dependency-registry.json`; no existing generated license-review, dependency-scan, or forbidden-dependency-scan schema was present to extend. Within the resumed Undine scope, no additional generated evidence file is required.

## Dependency Manifest / Lockfile Conclusion

Pass.

- `package.json:12` adds only the focused `smoke:wave44:psd-parser` script.
- `package.json:20` adds exact devDependency `@webtoon/psd: 0.4.0`.
- `pnpm-lock.yaml:14`, `pnpm-lock.yaml:460`, and `pnpm-lock.yaml:891` add only `@webtoon/psd@0.4.0`.
- `pnpm-lock.yaml:461` integrity matches Domain A: `sha512-ztriE8oFOamRrV9opBURDy+JMiyhur2//vOXsC5CgdnYCB0L1Lnaag4NzP8N+NFCj7uNz9JRYtPmAbQMSDLIsQ==`.
- The lockfile snapshot for `@webtoon/psd@0.4.0` is empty, so no transitive dependency expansion was introduced.
- Searches did not find added `ag-psd` or `psd` package dependencies. `@webtoon/psd` imports are limited to the Domain B smoke script; Domain C source/test references are evidence strings, not parser imports.
- Installed package recursive scan found package metadata plus `dist/**` JavaScript, type declaration, and source map files; no `.wasm`, `.node`, `.exe`, `.dll`, or binary-like installed files. The only `psd-decoder` hit is a package-local devDependency field, not a repository dependency or lockfile addition.

## Parser Smoke And Raster Capability Conclusion

Pass.

- `scripts/wave44-psd-parser-smoke.mjs:8` pins the expected source byteLength and SHA-256.
- `scripts/wave44-psd-parser-smoke.mjs:37` requires an explicit `--psd` path.
- `scripts/wave44-psd-parser-smoke.mjs:215` parses the explicit local fixture via `Psd.parse(toArrayBuffer(sourceBytes))`.
- `scripts/wave44-psd-parser-smoke.mjs:177` through `scripts/wave44-psd-parser-smoke.mjs:199` assert source hash/length, positive document dimensions, non-empty layer tree, non-empty group tree, and raster availability.
- The rerun of `pnpm smoke:wave44:psd-parser` emitted schema `wave44.psdParserNodeSmokeEvidence.v1`, parser `@webtoon/psd@0.4.0`, source byteLength `22406225`, SHA-256 `44AB43238CD2B2AF2FB0CE6A7B5073A60E332D03DA7666EA274C02E0462294B5`, document `2048x3072`, channelCount `4`, depth `8`, colorMode `3`, root childCount `14`, groupCount `20`, layerCount `126`, visibleLayerCount `121`, hiddenLayerCount `5`, rasterCandidateLayerCount `126`, and maxDepth `3`.
- `scripts/wave44-psd-parser-smoke.mjs:258` proves selected-layer raster extraction through `Layer.composite(false, false)`. The rerun produced raw RGBA byteLength `460800`, SHA-256 `671E6A363745B1CE2E8D29C1A63438170FE9511C8884EA42298CF9B8886E5C1A`, and source layer `psd:root/layer[0]`.
- `scripts/wave44-psd-parser-smoke.mjs:276`, `scripts/wave44-psd-parser-smoke.mjs:285`, and `scripts/wave44-psd-parser-smoke.mjs:288` through `scripts/wave44-psd-parser-smoke.mjs:290` keep derived bytes unpersisted, mark the fixture as non-public-demo evidence, and keep full compositing, renderer pixel oracle, and texture sampling correctness as `notEvaluated`.

## Verification Performed

- `pnpm smoke:wave44:psd-parser`: passed.
- `pnpm typecheck`: passed.
- `pnpm run check:source`: passed.
- `pnpm run check:deps`: passed.
- Registry JSON parse / policy-shape check: passed; one `@webtoon/psd` entry.
- `pnpm list @webtoon/psd --depth 0 --json`: confirmed root devDependency `@webtoon/psd@0.4.0`, resolved from the npm registry tarball.
- Installed package binary/WASM scan: no binary-like files found; only package-local `@webtoon/psd-decoder` devDependency text.
- `pnpm audit --audit-level moderate`: failed only on baseline `vitest` advisory `GHSA-5xrq-8626-4rwp`.
- `pnpm audit --audit-level moderate --ignore GHSA-5xrq-8626-4rwp`: passed.
- `git diff -- package.json pnpm-lock.yaml generated/dependencies/dependency-registry.json`: only the focused smoke script registration, exact `@webtoon/psd@0.4.0` devDependency, lockfile entry, and registry entry were observed.

## Remaining Issues

- No Domain B blocking issues remain.
- The baseline `vitest` advisory remains outside this domain's parser dependency/smoke scope.

## User-Decision Points

- None required for Domain B.
- Future user decision remains required before any `test_data/sample_model.psd` derived visual bytes are treated as public distributable demo material.
