# Wave37 Domain B Gnome Implementation Report

Date: 2026-06-03
Domain: `wave37-package-format-transport-boundary-guards`
Verdict: `done`

## Summary

- Added a package-format transport boundary guard over the Domain A capability catalog.
- Kept `projectDefinedJsonBundleV0` as the only supported route and exposed a supported result for export/import callers.
- Returned deterministic `not-supported` results for dependency-gated, future-gated, and unsupported routes, preserving Domain A `issues` and `gates`.
- Added a require-style guard that throws `PackageTransportBoundaryError` when a caller attempts to require a non-supported route.
- Preserved existing portable bundle export/import implementation; no archive, filesystem, browser API, parser, image decode, or renderer implementation was added.

## Files Changed

- `packages/package-format/src/package-transport-boundary.ts`
- `packages/package-format/src/package-transport-boundary.test.ts`
- `packages/package-format/src/index.ts`
- `discussion/implementation/waves/wave37/wave37-domain-b-gnome-implementation-report.md`

## Verification Performed

- `pnpm.cmd exec vitest run packages/package-format/src/package-transport-boundary.test.ts packages/package-format/src/package-transport-capabilities.test.ts packages/package-format/src/portable-package-bundle.test.ts`: pass, 3 files / 12 tests.
- `pnpm.cmd typecheck`: pass.
- `git diff --check -- packages\package-format\src discussion\implementation\waves\wave37`: pass; LF-to-CRLF working-copy warning only.
- `git diff -- package.json pnpm-lock.yaml pnpm-workspace.yaml packages\contracts\package.json packages\package-format\package.json`: pass, no output.
- `rg` forbidden implementation scan over Domain B package-format changed files for archive dependency names, browser filesystem API names, drag event APIs, image decode/canvas APIs, Cubism/Live2D terms, full renderer, and pixel oracle: pass, no matches.
- Source organization check: `packages/package-format/src/index.ts` remains barrel-only with re-exports only.

## Remaining Issues

- None known.

## User Decision Points

- None. Future ZIP/archive dependency approval, browser filesystem API decisions, drag-drop UX, and native filesystem persistence remain outside Domain B.

## Scope Confirmation

- No dependency manifest or lockfile changes were made.
- No `packages/contracts/**`, `packages/validator-core/**`, or Editor UI implementation files were edited.
- `packages/package-format/src/index.ts` remains barrel-only.
