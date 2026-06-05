# Wave44 Domain A Review: PSD Dependency / Security / Fixture Boundary

> Target: `wave44-psd-dependency-security-fixture-boundary`
> Reviewed artifact: `discussion/implementation/waves/wave44/wave44-domain-a-psd-dependency-security-fixture-boundary-report.md`
> Reviewer: Review-Sylph independent reviewer

## Verdict

`pass`

No blocking findings were found. The Domain A report stays within the documentation, dependency recommendation, security gate, and fixture boundary scope. It does not approve or install a dependency, and it correctly pushes manifest, lockfile, audit, dependency guard, WASM/provenance, and sample parse/raster smoke work to Domain B.

## Scope Reviewed

- `discussion/implementation/waves/wave44/wave44-domain-a-psd-dependency-security-fixture-boundary-report.md`
- Current working-tree scope for Wave44 docs/reviews, capability map, backlog, `package.json`, `pnpm-lock.yaml`, `packages/**`, `apps/**`, and `scripts/**`
- Fixture metadata for `test_data/sample_model.psd` by file metadata and SHA-256 only; no parse/decode/semantic inspection
- Read-only npm metadata and README checks for `@webtoon/psd`, `ag-psd`, and `psd`; no install

## Basis Documents Used

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave44-plan.md`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/remaining-work-backlog.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/tests/fixtures/fixture-manifest.md`
- `discussion/tests/traceability/test-traceability-matrix.md`

## Findings

No blocking findings.

Non-blocking observations:

- `git status --short -uall` shows modified `discussion/implementation/current-capability-map.md` and `discussion/implementation/remaining-work-backlog.md`, plus untracked `discussion/implementation/orchestration/wave44-plan.md` and the reviewed Domain A report. I did not attribute those map/backlog edits to Domain A; `package.json`, `pnpm-lock.yaml`, `packages/**`, `apps/**`, and `scripts/**` were not reported as modified.
- The report's candidate matrix uses `ag-psd` Snyk evidence for an older version only as weak context and explicitly requires Domain B to run a formal lockfile-based audit. That wording is acceptable for Domain A and must not be treated as dependency security clearance.

## Verification Performed

- Read the Domain A report directly and compared it against the Wave44 Domain A assignment, review lanes, dependency policy, fixture policy, traceability entries, current capability map, and backlog.
- Confirmed `package.json` currently lists only `@types/node`, `typescript`, and `vitest` in `devDependencies`.
- Confirmed `git status --short -uall package.json pnpm-lock.yaml` returns no manifest or lockfile modifications.
- Searched `package.json` and `pnpm-lock.yaml` for `ag-psd`, `@webtoon/psd`, and `psd`; no matches were found.
- Verified `test_data/sample_model.psd` metadata/hash only:
  - byteLength: `22406225`
  - SHA-256: `44AB43238CD2B2AF2FB0CE6A7B5073A60E332D03DA7666EA274C02E0462294B5`
  - lastWriteTime: `2026/05/23 20:41:38`
- Ran whitespace check:
  - `git diff --check -- discussion/implementation/waves/wave44 discussion/implementation/reviews/wave44 discussion/implementation/current-capability-map.md discussion/implementation/remaining-work-backlog.md`
  - Result: passed, with only CRLF conversion warnings for the already-modified map/backlog files.
- Checked package metadata without installing:
  - `@webtoon/psd`: npm metadata reports `0.4.0`, MIT, no dependency field, integrity matching the report, unpacked size `463943`, and maintainers matching the report. Official README/docs support zero-dependency browser/Node use, WASM image decode acceleration, layer tree traversal, image/layer pixel data, and `Layer.prototype.composite()`.
  - `ag-psd`: npm metadata reports `30.1.1`, MIT, dependencies `base64-js@1.5.1` and `pako@2.1.0`, integrity matching the report, unpacked size `12520348`, and maintainer matching the report. Official README supports `readPsd`, `useImageData`, Node `Buffer`/`ArrayBuffer`, `node-canvas` requirements for image data/thumbnails, browser canvas constraints, and the listed limitations.
  - `psd`: npm metadata reports `3.4.0`, no license field in the returned metadata, legacy dependencies matching the report, and `time.modified` `2022-06-24T22:35:21.472Z`. Official README describes a CoffeeScript PSD parser for browser/Node.

## Remaining Issues

- Domain B must still create dependency approval evidence before any manifest/lockfile change.
- Domain B must run formal dependency/security checks against the generated lockfile, such as `npm audit`, OSV, Snyk, or an equivalent accepted check.
- Domain B must run the repository dependency guard after the manifest/lockfile diff.
- Domain B must review any WASM or binary-like artifact provenance, checksum, license, environment, redistribution, and update process before approval.
- Domain B must perform explicit-path `test_data/sample_model.psd` smoke evidence for parse, document metadata, group/layer tree, and selected layer raster extraction.
- Later domains must keep unsupported Photoshop features as `unsupported` or `notEvaluated` diagnostics unless source/tests/sample evidence proves a narrower implemented behavior.

## User-Decision Points

- None required for Domain A.
- Future user decision remains required before any `sample_model.psd` derived visual bytes can be promoted to public distributable demo material.

## Review Separation Note

This review was performed as an independent Review-Sylph pass over the changed report, basis documents, repository status, fixture metadata/hash, and package metadata. It does not rely on Gnome's explanation as the sole basis and does not edit the implementation report or any forbidden scope.
