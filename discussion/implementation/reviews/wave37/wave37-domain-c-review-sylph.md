# Wave37 Domain C Review-Sylph

Date: 2026-06-03
Target: `wave37-validator-transport-capability-diagnostics`
Verdict: `pass`

Clean-context review for Domain C. I reviewed the Wave37 plan, Domain A transport capability contract, validator contract updates, Domain C changed files/diff, focused tests, and independent verification output. I did not rely on Gnome's report as the sole basis and did not edit source implementation files.

## Findings

No blocking, warning, or needs-fix findings.

Advisory only:

- Domain C intentionally trusts the Domain A `PackageTransportCapabilityDto` / `PackageTransportCapabilityCatalogDto` parse result and reports based on `status`. This matches the assignment to use the Domain A evidence shape without redesigning it. Future hardening could add a cross-check against the canonical Domain A catalog if the validator later accepts untrusted standalone capability evidence from external callers.

## Review Lanes

### 1. Design / Development Compliance Review

Result: `pass`

- `packages/validator-core/src/validators/package-transport-capability-diagnostics.ts` consumes the Domain A transport capability DTO/catalog schemas from `@private-2d-rigging-lab/contracts`; it does not define a parallel transport evidence DTO.
- Supported `projectDefinedJsonBundleV0` / `portable-package-bundle-v0` evidence produces no transport diagnostic.
- `standardArchiveZipV0`, `fileSystemAccessApiV0`, `directoryPickerV0`, `dragDropFileIntakeV0`, and `nativeFilesystemPersistenceV0` evidence from the Domain A catalog produces stable `transportCapability.dependencyGated`, `.futureGated`, or `.unsupported` diagnostics with capability, kind, status, gate, and issue evidence.
- Missing evidence is explicitly gated by `requireTransportCapabilityEvidence`; existing runtime validation callers without transport evidence do not fail by default.
- Malformed supplied transport evidence produces deterministic `transportCapability.schemaInvalid` diagnostics.
- `transportCapability.*` diagnostics are separate from `portableBundle.*`, `byteAvailability.*`, and `persistentByteStorage.*`; I found no contradictory archive/filesystem/drag-drop support claim in the Domain C changes.
- `packages/validator-core/src/index.ts` remains barrel-only.
- No package-format writer/importer, Editor UI, ZIP/archive implementation, File System Access API, directory picker, drag-drop, parser, image decode, external dependency, manifest, or lockfile change was introduced by Domain C.

### 2. Test Adequacy Review

Result: `pass`

- The focused test file covers check catalog registration, supported portable JSON evidence, whole Domain A catalog behavior, ZIP dependency-gated evidence, future-gated filesystem and drag-drop evidence, unsupported native filesystem evidence, explicit missing-evidence gating, malformed evidence, and `validatePackageRuntime` integration.
- Existing `packages/validator-core/src/validator-core.test.ts` was rerun with the new tests to guard baseline validator report behavior.
- Typecheck passes across root and editor TypeScript projects.

### 3. Orchestration Compliance Review

Result: `pass`

- The assignment separated Gnome implementation and clean Review-Sylph review.
- Gnome's implementation report is present at `discussion/implementation/waves/wave37/wave37-domain-c-gnome-implementation-report.md`.
- This Review-Sylph run wrote only this review artifact under `discussion/implementation/reviews/wave37/`.
- I found no evidence in the reviewed artifacts that Orch-Sylph implemented source itself.

## Verification Performed

Read / inspection:

- Read `.agents/skills/implementation-orchestration/SKILL.md`.
- Read `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`.
- Read `discussion/implementation/orchestration/wave37-plan.md`.
- Read Domain A final/review artifacts used as transport contract dependency context.
- Read source organization, dependency, and schema/ID policies.
- Read package file format and validator contracts.
- Read Domain A transport capability contract and package-format binding.
- Inspected Domain C git status, tracked diff, untracked validator source/test, package runtime integration, check catalog, and barrel export.
- Performed focused forbidden-scope and dependency-manifest scans over Domain C files.

Commands rerun in this review:

- `pnpm.cmd exec vitest run packages/validator-core/src/package-transport-capability-diagnostics.test.ts packages/validator-core/src/validator-core.test.ts`
  - Result: pass, 2 files / 14 tests.
- `pnpm.cmd typecheck`
  - Result: pass.
- `git diff --check -- packages/validator-core/src discussion/design/module-contracts/validator-contract.md discussion/implementation/waves/wave37`
  - Result: pass; LF-to-CRLF working-copy warnings only.
- `git diff -- package.json pnpm-lock.yaml pnpm-workspace.yaml packages/validator-core/package.json`
  - Result: no output.
- `rg` forbidden-scope scan over Domain C files for File System Access APIs, drag/drop APIs, archive dependencies, image decode, Cubism/Live2D terms, full renderer, and pixel-oracle terms.
  - Result: no implementation/API/dependency matches; only expected diagnostic prose/test descriptions for archive/filesystem/drag-drop boundaries.
- `rg -n "^[^\\n]*$" packages/validator-core/src/index.ts`
  - Result: export-only barrel file.

Sandbox note: sandboxed PowerShell and Node process startup failed with `windows sandbox: spawn setup refresh`, so necessary read and verification commands were rerun through the approved escalated path.

## Files Reviewed

- `packages/validator-core/src/validators/package-transport-capability-diagnostics.ts`
- `packages/validator-core/src/package-transport-capability-diagnostics.test.ts`
- `packages/validator-core/src/validators/package-runtime.ts`
- `packages/validator-core/src/check-catalog.ts`
- `packages/validator-core/src/index.ts`
- `discussion/design/module-contracts/validator-contract.md`
- `discussion/implementation/waves/wave37/wave37-domain-c-gnome-implementation-report.md`
- `packages/contracts/src/package-transport-capability.ts`
- `packages/package-format/src/package-transport-capabilities.ts`
- `discussion/implementation/orchestration/wave37-plan.md`
- `discussion/implementation/waves/wave37/wave37-domain-a-orch-sylph-final-report.md`
- `discussion/implementation/reviews/wave37/wave37-domain-a-review-sylph.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`
- `discussion/design/module-contracts/package-file-format-contract.md`

## Remaining Issues

No Domain C source fix is required.

Future decisions remain outside Domain C: ZIP/archive dependency approval, File System Access API or directory picker adoption, drag-drop UX, native filesystem persistence scope, parser/image decode dependency scope, and any future validator hardening against untrusted standalone transport capability evidence.

## User-Decision Points

None for Domain C.

## Source Edit Confirmation

I did not edit source implementation files. I wrote only this requested review artifact.
