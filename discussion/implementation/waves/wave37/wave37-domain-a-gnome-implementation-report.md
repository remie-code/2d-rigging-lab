# Wave37 Domain A Gnome Implementation Report

verdict: `done`

Target: `wave37-archive-filesystem-capability-contract-foundation`
Date: 2026-06-03

## Summary

Added an additive package transport capability contract and package-format binding for the Wave37 archive/filesystem decision boundary.

The contract records `projectDefinedJsonBundleV0` as the only supported transport and binds it to Wave36 `portable-package-bundle-v0` / `project-defined-json-bundle-v0`. ZIP/archive is represented as `dependency-gated`. File System Access API, directory picker, and drag-drop are represented as `future-gated`. Native OS filesystem persistence is represented as `unsupported`.

No archive writer/importer, filesystem API route, directory picker, drag-drop route, parser, image decode, dependency, package manifest, or lockfile change was added.

## Files Changed

- `packages/contracts/src/package-transport-capability.ts`
- `packages/contracts/src/package-transport-capability.test.ts`
- `packages/contracts/src/contracts-integration.test.ts`
- `packages/contracts/src/index.ts`
- `packages/package-format/src/package-transport-capabilities.ts`
- `packages/package-format/src/package-transport-capabilities.test.ts`
- `packages/package-format/src/index.ts`
- `discussion/implementation/waves/wave37/wave37-domain-a-gnome-implementation-report.md`

## Notable Decisions

- `contracts` owns the shared transport capability DTO/schema/catalog.
- `package-format` has only a thin adapter that parses the shared catalog and verifies the supported transport binding against the existing portable bundle version/kind schemas.
- `index.ts` changes are barrel-only exports.
- Gated and unsupported capabilities require deterministic gate/issue metadata through schema tests.

## Verification Performed

- `pnpm.cmd exec vitest run packages/contracts/src/package-transport-capability.test.ts packages/contracts/src/contracts-integration.test.ts packages/package-format/src/package-transport-capabilities.test.ts packages/package-format/src/portable-package-bundle-contract.test.ts packages/package-format/src/portable-package-bundle.test.ts`
  - pass: 5 test files / 24 tests.
- `pnpm.cmd typecheck`
  - pass: root `tsc --noEmit` and editor `tsc --noEmit -p tsconfig.json`.
- `git diff --check -- packages\contracts\src packages\package-format\src discussion\implementation\waves\wave37`
  - pass: no whitespace errors; git reported LF-to-CRLF working-copy warnings only.
- `rg -n "[ \t]$"` over new Domain A files
  - pass: no trailing whitespace matches.
- `git diff -- package.json pnpm-lock.yaml pnpm-workspace.yaml packages\contracts\package.json packages\package-format\package.json`
  - pass: no output.
- Source organization inspection
  - pass: `packages/contracts/src/index.ts` and `packages/package-format/src/index.ts` contain only exports.

Sandbox note: one focused test command and some inspection commands needed the approved escalated path because sandboxed PowerShell intermittently failed with `windows sandbox: spawn setup refresh`.

## Source Organization / Dependency Guard

- `packages/contracts/src/index.ts` and `packages/package-format/src/index.ts` remain barrel-only.
- New source files have single responsibilities: shared transport contract/catalog and package-format binding.
- No dependency manifest or lockfile was intentionally changed.
- No external archive/image/parser/Cubism dependency was added.

## Non-Goals Preserved

- No ZIP, tar, compression, or archive import/export implementation.
- No File System Access API, directory picker, native filesystem picker, or drag-drop implementation.
- No Editor UI or Validator broad implementation.
- No PSD/PNG parser, image decode, full renderer, pixel oracle, or Cubism compatibility claim.

## Remaining Issues

- Downstream Wave37 domains still need to consume this contract in package-format guards, validator diagnostics, Editor UI truthfulness, and e2e fixtures.
- This slice only defines the contract/binding; it does not expose runtime behavior for gated routes.

## User-Decision Points

- None needed for Domain A completion.
- Future decisions remain for approving ZIP/archive dependencies, File System Access API/directory picker/drag-drop UX, and any OS filesystem/cloud persistence scope.
