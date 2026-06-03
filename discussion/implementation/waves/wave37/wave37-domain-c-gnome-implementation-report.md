# Wave37 Domain C Gnome Implementation Report

verdict: `done`

Target: `wave37-validator-transport-capability-diagnostics`
Date: 2026-06-03

## Summary

Added deterministic validator diagnostics for Domain A package transport capability evidence.

Supported `projectDefinedJsonBundleV0` evidence with the portable package bundle v0 binding produces no transport diagnostic. ZIP/archive dependency-gated evidence, File System Access API / directory picker / drag-drop future-gated evidence, and native filesystem unsupported evidence now produce stable `transportCapability.*` diagnostics with AI-readable capability ID, transport kind, status, gate, and issue evidence.

Runtime validation integration is explicitly gated: existing `validatePackageRuntime` and `validatePackageRuntimeWithBinaryAssets` callers do not fail when no transport evidence is supplied. Missing evidence is reported only when `requireTransportCapabilityEvidence: true`; malformed supplied evidence is always reported.

## Files Changed

- `packages/validator-core/src/validators/package-transport-capability-diagnostics.ts`
- `packages/validator-core/src/package-transport-capability-diagnostics.test.ts`
- `packages/validator-core/src/validators/package-runtime.ts`
- `packages/validator-core/src/check-catalog.ts`
- `packages/validator-core/src/index.ts`
- `discussion/design/module-contracts/validator-contract.md`
- `discussion/implementation/waves/wave37/wave37-domain-c-gnome-implementation-report.md`

## Notable Decisions

- The validator consumes Domain A `PackageTransportCapabilityDto` and `PackageTransportCapabilityCatalogDto` shapes without defining a new transport evidence DTO.
- Transport diagnostics use the `transportCapability.*` namespace to stay distinct from `portableBundle.*`, `byteAvailability.*`, and `persistentByteStorage.*`.
- `index.ts` was touched only as a barrel export for the new validator module.
- Transport capability diagnostics target package-level evidence paths such as `/transportCapabilityEvidence` and `/transportCapabilityEvidence/capabilities/1`; no new target kind was added.

## Verification Performed

- `pnpm.cmd exec vitest run packages/validator-core/src/package-transport-capability-diagnostics.test.ts packages/validator-core/src/validator-core.test.ts`
  - pass: 2 test files / 14 tests.
- `pnpm.cmd typecheck`
  - pass: root `tsc --noEmit` and editor `tsc --noEmit -p tsconfig.json`.
- `git diff --check -- packages/validator-core/src discussion/design/module-contracts/validator-contract.md discussion/implementation/waves/wave37`
  - pass: no whitespace errors; git reported LF-to-CRLF working-copy warnings only.
- `rg -n "[ \t]$" packages/validator-core/src/validators/package-transport-capability-diagnostics.ts packages/validator-core/src/package-transport-capability-diagnostics.test.ts discussion/implementation/waves/wave37/wave37-domain-c-gnome-implementation-report.md`
  - pass: no trailing whitespace matches.
- `git diff -- package.json pnpm-lock.yaml pnpm-workspace.yaml packages/validator-core/package.json`
  - pass: no output.
- Source organization inspection
  - pass: `packages/validator-core/src/index.ts` contains only exports.

Sandbox note: shell execution required the approved escalated path because normal sandboxed PowerShell failed with `windows sandbox: spawn setup refresh`.

Worktree note: Domain A/B and orchestration files were already present in the shared worktree and were not reverted. Domain C changes are the files listed above.

## Scope Guard

- No package-format writer/importer or transport guard implementation was added.
- No ZIP/archive, File System Access API, directory picker, drag-drop, native filesystem, parser, image decode, media sniffing, or Editor UI implementation was added.
- No external dependency, package manifest, or lockfile change was made intentionally.
- `packages/validator-core/src/index.ts` remains barrel-only.

## Remaining Issues

- None for Domain C implementation.
- Future product decisions remain outside this domain: archive dependency approval, File System Access API/directory picker/drag-drop adoption, and native filesystem persistence scope.

## User-Decision Points

- None.
