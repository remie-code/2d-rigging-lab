# Wave37 Clean Integration Review-Sylph Final

verdict: `pass`

Review-Sylph clean integration re-review after Domain F Gnome fix loop 2. Source code was reviewed read-only; no source edits were made. This artifact is the only write from this review.

## Findings

- blocking finding fixed. `packages/contracts/src/package-transport-capability.ts:133`-`:141` now rejects `status: "supported"` unless `capabilityId` is `projectDefinedJsonBundleV0`; `:185`-`:190` still requires the portable bundle capability itself to remain supported. This closes the previous silent-pass gap for non-canonical archive/filesystem evidence.
- Contract tests cover the fix. `packages/contracts/src/package-transport-capability.test.ts:50`-`:89` rejects supported claims for `standardArchiveZipV0`, `fileSystemAccessApiV0`, `directoryPickerV0`, `dragDropFileIntakeV0`, and `nativeFilesystemPersistenceV0`; `:91`-`:105` rejects catalog evidence when ZIP is falsified as supported.
- Validator diagnostics now cover the same failure mode. `packages/validator-core/src/package-transport-capability-diagnostics.test.ts:40`-`:82` expects those false supported claims to produce `transportCapability.schemaInvalid` with blocking severity and stable evidence. The validator implementation reports schema-invalid evidence through `packages/validator-core/src/validators/package-transport-capability-diagnostics.ts:257`.
- Package-format boundary remains truthful. `packages/package-format/src/package-transport-boundary.ts:68`-`:96` returns `supported` only from the canonical capability status and otherwise returns deterministic `not-supported`; `:99`-`:108` throws for required non-supported routes. Tests keep portable JSON usable and archive/filesystem/native routes non-supported.
- Editor/e2e evidence keeps the existing portable JSON bundle route active. `apps/editor/e2e/portable-bundle-roundtrip-smoke.mjs:92`-`:103` exports, validates shape, imports, and waits for `Portable JSON imported`; `:554`-`:600` asserts portable export/import are enabled while unavailable transport rows cannot masquerade as supported. Orch-Sylph final verification reports desktop and mobile smoke passed.

## Boundary / Non-Goals

- No real ZIP/archive implementation, external archive dependency, File System Access API, directory picker, drag-drop file intake, PSD/PNG parser, image decode, full renderer, pixel oracle, or Cubism compatibility claim was found in the Wave37 source-scope scan.
- Source-scope forbidden hits were negative oracle/prose only: e.g. `apps/editor/e2e/portable-bundle-roundtrip-smoke.mjs:387` asserts metadata-only with no image decode, and `:528`-`:541` lists forbidden success claims that must not appear.
- Relevant `index.ts` files remain barrel-only: `packages/contracts/src/index.ts:1`-`:18`, `packages/package-format/src/index.ts:1`-`:23`, `packages/validator-core/src/index.ts:1`-`:32`, `apps/editor/src/editor-state/index.ts:1`-`:43`.

## Verification Evidence

- Reviewed final verification results from Orch-Sylph after fix loop 2: focused Wave37 vitest pass, `pnpm.cmd typecheck` pass, `pnpm.cmd test:unit` pass, `pnpm.cmd test:e2e` pass, `check:source` pass, `check:deps` pass.
- Review-side `git diff --check -- apps/editor packages fixtures/contracts discussion/implementation discussion/design discussion/tests` was effectively pass; output was LF-to-CRLF warnings only.
- Review-side dependency manifest/lockfile checks produced no output for `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `apps/editor/package.json`, `packages/contracts/package.json`, `packages/validator-core/package.json`, and `packages/package-format/package.json`.

## Residual Risks

- Future waves that intentionally promote any non-`projectDefinedJsonBundleV0` capability to `supported` must update the contract guard and tests explicitly.
- I did not rerun the full pnpm suites in this review; I relied on the provided final verification results and supplemented them with read-only source/status/diff scans.

## Verdict

`pass`. The previous blocking finding is resolved, Wave37 remains inside its decision-boundary non-goals, no dependency manifest/lockfile changes are introduced or required, and the portable JSON bundle route remains verified by the final e2e evidence.
