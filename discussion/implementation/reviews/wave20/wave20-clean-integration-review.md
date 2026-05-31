# Wave 20 Clean Integration Review

> Target: `wave20-integration-review-and-final-report`
> Role: Review-Sylph clean integration reviewer
> Context name used: `Review-Sylph clean integration reviewer for Wave 20 / Domain H`
> Context id: not exposed in this subagent context
> Date: 2026-05-31

## Verdict

`pass`.

No blocking, high, medium, or low source findings were found. No source fix is required.

This review was grounded in the Wave 20 plan, Domain A-G completion and review artifacts, current source files, fixtures, workspace diff/status, Adobe's official Photoshop File Formats Specification, and independent verification commands. It did not rely on implementer summaries alone.

## Findings

| Severity | Finding | Responsible area | Status |
|---|---|---|---|
| Blocking | None. | n/a | pass |
| High | None. | n/a | pass |
| Medium | None. | n/a | pass |
| Low | None. | n/a | pass |

## Rubric Status

| Rubric item | Status | Evidence |
|---|---|---|
| PSD Spec Basis | pass | Domain A records Adobe official source at `discussion/implementation/waves/wave20/wave20-psd-spec-field-matrix.md:9`, maps layer records, channel image data, additional layer info, compression, and non-claims at `:55-60` and `:79-92`. I also checked the official Adobe spec URL: https://www.adobe.com/devnet-apps/photoshop/fileformatashtml/. |
| Sample Characterization | pass | `discussion/implementation/waves/wave20/wave20-psd-sample-characterization.md:19` records SHA-256, `:21-36` records fixed header and safe top-level offsets, and `:163-182` explicitly avoids layer/raster/channel/image-data claims. No PSD/image binaries were found under the new PSD fixture directories. |
| PSD Profile Truthfulness | pass | `packages/operation-core/src/operations/import-psd-source-asset-preconditions.ts:42` rejects missing adapter results with a parser-free diagnostic. Editor payload construction says manual metadata has no PSD-byte parse claim at `apps/editor/src/editor-workflow/source-intake-workflow.ts:228`. No production parser/file-picker/raster implementation was found. |
| Dependency Policy Compliance | pass | `pnpm.cmd run check:deps` passed. `git diff --name-only -- package.json pnpm-lock.yaml pnpm-workspace.yaml apps/*/package.json packages/*/package.json` had no output. Parser/decode dependency scans found no `ag-psd`, `sharp`, `pngjs`, `jimp`, Cubism SDK/Core, `.moc3`, or `.model3` additions. |
| Source Layer Mapping | pass | DTOs carry group/layer IDs, bounds, role, texture preview reference, texture ID, and target part ID in `packages/operation-core/src/payloads/import-source.ts:72-123`. Materialization stores `psd-source-v1` / `layered-character-psd-profile-v1` and source layers at `packages/operation-core/src/operations/import-psd-source-asset-materialization.ts:29-40`, `:115-117`; diagnostics preserve target/texture/preview relations at `packages/operation-core/src/operations/import-psd-source-asset-diagnostics.ts:62-70`. |
| Texture Preview Persistence | pass | Texture preview preconditions and materialization are in `packages/operation-core/src/operations/import-psd-source-asset-texture.ts:43-80`, `:138-186`. The e2e smoke asserts persisted source manifest, texture preview, operation log, and load projection through `apps/editor/e2e/source-intake-smoke.mjs:101-429`; preview texture rendering is checked in `apps/editor/e2e/smoke-checks.mjs:365-440`. |
| Validator Evidence | pass | `validatePsdSourceProfiles` is wired into package runtime validation at `packages/validator-core/src/validators/package-runtime.ts:29-33`. PSD unsupported feature and layer provenance checks are implemented at `packages/validator-core/src/validators/psd-source-profile.ts:147-212`; focused validator and fixture tests passed in the full unit suite. |
| UI / Accessibility | pass | Manual PSD adapter/profile mode and validation rules are in `apps/editor/src/editor-state/source-intake-draft-state.ts:226-299`; native required-state sync is in `apps/editor/src/ui/source-assets/source-intake-form.ts:389-418` and `:476-478`. E2E covers source-intake accessible names and native validation at `apps/editor/e2e/source-intake-smoke.mjs:494-675`, plus preview/drawable accessible names and horizontal overflow at `apps/editor/e2e/smoke-checks.mjs:153`, `:243`, `:1001`. |
| Source Organization | pass | `pnpm.cmd run check:source` passed. PSD operation implementation is split across lifecycle, diagnostics, materialization, preconditions, and texture files. `packages/validator-core/src/index.ts:1-19` remains barrel-only; `packages/operation-core/src/operations/import-split-png-source-asset-unsupported-psd.ts:1-4` is a compatibility re-export. |
| Test Adequacy | pass | Full verification passed: typecheck, unit suite, e2e smoke, source guard, dependency guard, and whitespace checks. Unit suite included 93 files / 496 tests. E2E passed desktop and mobile smoke with screenshots. |
| Orchestration Compliance | pass | Domain A-G completion reports record separate Gnome and Review-Sylph contexts, with pass verdicts after the Domain A and F needs-fix loops. Examples: Domain A at `discussion/implementation/waves/wave20/wave20-domain-a-completion.md:11-12`, Domain F at `:11-14` and `:48-54`, Domain G at `discussion/implementation/waves/wave20/wave20-domain-g-completion.md:12-15`. This clean review wrote only this review artifact. |

## Verification Performed

| Command / check | Result | Notes |
|---|---|---|
| `pnpm.cmd install --frozen-lockfile` | pass after escalation | Restored workspace links from the existing lockfile. No dependency manifest or lockfile changed. |
| `pnpm.cmd install --frozen-lockfile --force` | pass after escalation | Required after sandbox-visible pnpm tree could not resolve Vite's `fdir` dependency for e2e. Reused lockfile packages; no manifest/lockfile diff. |
| `pnpm.cmd typecheck` | pass after escalation | Sandbox run failed with `EPERM` reading installed TypeScript; escalated rerun passed root and editor typecheck. |
| `pnpm.cmd test:unit` | pass after escalation | Sandbox run failed with `EPERM` reading installed Vitest; escalated rerun passed `93` files / `496` tests. |
| `pnpm.cmd test:e2e` | pass after escalation | Sandbox run could not read/resolve Vite dependencies; escalated rerun passed desktop smoke, mobile smoke, preview/drawable screenshots, and final `editor-e2e: smoke passed`. |
| `pnpm.cmd run check:source` | pass | Source organization guard passed. |
| `pnpm.cmd run check:deps` | pass | Dependency guard passed. |
| `git diff --check -- apps/editor packages fixtures/contracts discussion/implementation` | pass | No whitespace errors; Git emitted LF/CRLF working-copy warnings only. |
| `rg -n "[ \t]+$" <Wave20 reports, fixtures, new source/test files>` | pass | No matches. |
| `git diff --name-only -- package.json pnpm-lock.yaml pnpm-workspace.yaml apps/*/package.json packages/*/package.json` | pass | No dependency manifest or lockfile diff. |
| Binary fixture scan under `fixtures/contracts/psd-*` | pass | No `.psd`, `.psb`, `.png`, `.jpg`, `.jpeg`, `.webp`, or `.wasm` files. |

## Source Review Notes

- `importPsdSourceAsset` is now commit-capable only when `payload.adapterResult` is present. Preconditions reject missing adapter result, blank source paths, profile mismatch, missing source layers, duplicate groups/layers, missing parent groups, missing target parts, invalid preview references, duplicate/existing texture IDs, and unknown requested layer roles.
- The operation stores PSD source profile evidence as source manifest metadata and deterministic diagnostics, not as actual PSD binary decode output.
- Texture preview persistence remains adapter supplied. Package-local paths and deterministic image data URLs are accepted; generated preview URIs, absolute paths, traversal, and unsupported URI schemes are rejected.
- Validator evidence reports unsupported PSD layer features and missing PSD layer provenance, and existing texture validators still detect missing preview assets and source-layer mismatch.
- Editor Source Intake exposes manual PSD adapter/profile metadata mode without an OS file picker or parser wording. Native required state follows the same rule as draft validation: split PNG always requires texture mapping, PSD unsupported layers do not, and PSD mapped layers do.
- The root e2e smoke is now PSD-centered and verifies save/load persistence, preview texture pattern rendering, desktop/mobile layout, and accessible names.

## Residual Risks

- Wave 20 remains parser-free. It does not prove actual PSD layer tree extraction, channel decode, raster extraction, image-resource interpretation, mask rendering, or Photoshop-compatible compositing.
- `SourceManifest` persists richer PSD details through flattened `diagnostics: string[]` and `sourceLayer.unsupportedFeatures: string[]`. This is truthful and tested, but a later package-format wave may want structured PSD profile fields.
- The root browser smoke now centers PSD intake rather than split PNG intake. Split PNG compatibility is still covered by focused unit/workflow tests and existing operation tests, but this is a residual integration coverage tradeoff.
- E2E required restoring the local pnpm dependency tree outside sandbox restrictions. This changed `node_modules` only; no dependency manifests or lockfiles changed.
- Domain H final report and capability-map updates are post-review orchestration work; this review evaluates the clean integration gate and source/test evidence available before that final reporting step.

## Open Verification Items

None blocking.

Future waves should add new evidence before claiming:

- real PSD parser support;
- real PSD byte/package storage;
- raster preview extraction from PSD channel data;
- Photoshop-compatible text/effect/smart-object/vector/mask rendering;
- file picker or archive import/export workflows.
