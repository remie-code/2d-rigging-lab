# Wave 22 Domain G Review: Asset I/O Boundary Smoke and Persistence

> Target: `wave22-asset-io-boundary-smoke-and-persistence`  
> Reviewer: independent Review-Sylph  
> Implementation agent: `019e7dad-fd00-7b82-920a-4676a9890835` / Gnome the 14th  
> Review loop: 1  
> Verdict: `pass`  
> Date: 2026-05-31

## Verdict

`pass`.

Domain G stayed inside e2e/smoke and metadata fixture scope. I found no blocking, high, medium, or low findings.

## Findings

| Severity | Finding | Required action | Status |
|---|---|---|---|
| Blocking | None. | n/a | pass |
| High | None. | n/a | pass |
| Medium | None. | n/a | pass |
| Low | None. | n/a | pass |

## Basis Checked

- `.agents/skills/implementation-orchestration/SKILL.md`
- `discussion/implementation/orchestration/wave22-plan.md`
- `discussion/implementation/waves/wave22/wave22-asset-io-boundary-policy.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/design/module-contracts/fixtures-and-contract-tests.md`
- `discussion/design/module-contracts/operation-contracts.md`
- `discussion/design/module-contracts/validator-contract.md`
- Domain A-F completion/review artifacts under `discussion/implementation/waves/wave22/` and `discussion/implementation/reviews/wave22/`

Upstream gate: Domains A-F all have `pass` completion/review records. Domain C had an earlier `needs_fix` loop for unsupported storage test coverage, but its follow-up review and completion are `pass`.

## Changed Files Reviewed

| Path | Review note |
|---|---|
| `apps/editor/e2e/asset-io-boundary-smoke.mjs` | Adds e2e-only helper that seeds browser-local project storage with a metadata-only package document, loads it through the editor, saves it, reloads the browser, and re-loads it. |
| `apps/editor/e2e/smoke-checks.mjs` | Adds only an import, calls the new smoke in the existing desktop/mobile smoke flow, checks horizontal overflow, resets, and returns evidence. |
| `fixtures/e2e/wave22-asset-io-boundary/package-document.json` | Adds a deterministic metadata-only package document with PSD structured profile metadata, split PNG fallback metadata, binary refs, missing-byte status, unsupported-storage status, provenance, and rights metadata. |

## Design / Development Compliance

| Check | Result | Evidence |
|---|---|---|
| Write scope | pass | `git status --short -uall -- apps/editor/e2e fixtures/e2e package.json pnpm-lock.yaml pnpm-workspace.yaml apps/editor/package.json` shows only `apps/editor/e2e/smoke-checks.mjs`, `apps/editor/e2e/asset-io-boundary-smoke.mjs`, and `fixtures/e2e/wave22-asset-io-boundary/package-document.json`. Dependency manifests are unchanged. |
| Domain G stayed e2e/smoke only | pass | No production source or UI source files were changed. `smoke-checks.mjs` diff is limited to importing and invoking `runAssetIoBoundaryPersistenceSmoke`. |
| Forbidden boundary | pass | The new smoke uses Node test-fixture `readFile` and browser `localStorage`; it does not add file picker, Browser File API import, actual upload, archive import/export, image decode, PSD parser, PNG parser, or runtime-core binary implementation. |
| Fixture policy | pass | `fixtures/e2e/wave22-asset-io-boundary` contains only `package-document.json` at 15009 bytes. No `.psd`, `.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`, `.wasm`, `.zip`, `.bin`, or `sample_model.psd` file was added. |
| Metadata truthfulness | pass | Fixture prose explicitly records metadata-only status and no PSD/PNG bytes. Binary refs use `missing-package-local-bytes-v1` and `storage-unsupported-v1`; the e2e asserts UI wording for missing bytes, unsupported storage, and no editor file import or image decode. |
| Dependency policy | pass | No `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, or `apps/editor/package.json` diff. No external dependency was added. |
| Source organization | pass | No production source files or `index.ts` files changed. The new e2e helper is cohesive and scoped to one smoke concern. |

## Test Adequacy

| Requirement | Result | Evidence |
|---|---|---|
| Binary refs survive browser save/load as metadata | pass | `asset-io-boundary-smoke.mjs` asserts localStorage metadata after seeded load, after save, and after browser reload/load. The stored metadata check compares package ID/revision, source/texture counts, PSD profile fields, split profile fields, and four binary refs. |
| Missing bytes / unsupported storage is visible and truthful | pass | UI assertions cover PSD source and texture refs with `missing-package-local-bytes-v1; package-local bytes are missing`, and split source/texture refs with `storage-unsupported-v1; current workflow cannot store bytes`. The smoke also rejects unsupported UI claims such as uploaded binary, parsed from bytes, decoded PSD/PNG, raster extraction, and archive import. |
| PSD structured profile path still works | pass | The fixture includes `psdProfile` with `layered-character-psd-profile-v1`, adapter metadata, structured layer, texture preview reference, and `structured-profile-preferred-v1`; e2e asserts these rendered and persisted fields. |
| Split PNG metadata path still works | pass | The fixture includes `kind: "split-png-set-v1"` and `importProfile: "split-png-fallback-v1"`; e2e asserts split source row, layer ID, texture ID, source ref, and texture ref. |
| Browser smoke integration | pass | `pnpm.cmd test:e2e` passed for desktop and mobile smoke after sandbox-related dependency access was rerun outside the sandbox. The command output reported `editor-e2e: smoke passed`. |
| Layout/a11y smoke fit | pass | The new flow reuses existing smoke horizontal overflow checks after the asset I/O boundary smoke and then resets state. |

## Verification Commands

| Command | Outcome | Notes |
|---|---|---|
| `git diff -- apps/editor/e2e fixtures/e2e discussion/implementation/waves/wave22 discussion/implementation/reviews/wave22` | reviewed | Shows only `smoke-checks.mjs` tracked diff because the new helper and fixture are untracked. |
| `git status --short -uall -- apps/editor/e2e fixtures/e2e package.json pnpm-lock.yaml pnpm-workspace.yaml apps/editor/package.json` | pass | Only the two e2e files and one e2e fixture are changed/untracked; dependency manifests are unchanged. |
| `git diff --check -- apps/editor/e2e fixtures/e2e discussion/implementation/waves/wave22 discussion/implementation/reviews/wave22` | pass | Exit 0; Git emitted LF/CRLF warning for `apps/editor/e2e/smoke-checks.mjs` only. |
| `rg --files fixtures/e2e/wave22-asset-io-boundary \| rg "(?i)\\.(psd\|png\|jpg\|jpeg\|webp\|gif\|wasm\|zip\|bin)$\|sample_model\\.psd"` | pass | No output; no real binary/image/WASM/archive/sample fixture file was added. |
| `rg -n "(?i)(FileReader\|arrayBuffer\\(\|Blob\\(\|fetch\\(\|uploaded binary\|actual binary\|file picker\|archive import\|archive export\|zip\|decodeImageReference\|decoded PSD\|decoded PNG\|pixelData\|bytesBase64\|data:image\|iVBOR\|8BPS\|wasm\|sample_model)" apps/editor/e2e/asset-io-boundary-smoke.mjs fixtures/e2e/wave22-asset-io-boundary/package-document.json` | pass with expected non-claim hits | Hits are guard strings in the test and fixture notes explicitly saying bytes/import/decode/archive are not performed. |
| `git diff -U0 -- apps/editor/e2e/smoke-checks.mjs` | pass | Added import, call, overflow check, reset, and returned evidence only. |
| `pnpm.cmd test:e2e` | pass after sandbox escalation | Initial sandbox run failed because `node_modules` package metadata for `fdir` was not readable, causing Vite resolution failure. After `pnpm.cmd install --frozen-lockfile` restored node_modules outside the sandbox and the e2e command was rerun outside the sandbox, desktop and mobile smoke passed. |

## Residual Risks

- Domain G intentionally proves browser-local persistence of metadata references, not actual archive import/export or binary byte materialization. That remains future scope.
- The smoke seeds `localStorage` with a metadata fixture rather than using a real file picker/import flow. This is correct for Wave 22 but does not cover future file I/O.
- The fixture records PSD/PNG path-like metadata and `.texture-bytes` references. These are metadata-only and no bytes are present, but future work must keep that distinction explicit.

## Orchestration Compliance

- Implementation was delegated to Gnome the 14th; this review was performed independently by Review-Sylph.
- I did not rely on Gnome's summary as the only source; I read basis docs, changed files, current diff/status, and ran focused verification.
- I did not edit source/test files. This report is the only file written by this review.

## Final Verdict

Domain G is `pass`. Domain H may proceed.
