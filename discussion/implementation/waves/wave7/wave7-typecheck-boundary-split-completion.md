# Wave 7 Domain A Completion: typecheck boundary split

> Wave: `editor-project-persistence-and-e2e-hardening`
> Domain: `wave7-typecheck-boundary-split`
> Verdict: `pass`

## 1. Changed Files

- `tsconfig.json`
  - Root compile target now uses `lib: ["ES2022"]` and excludes browser app source.
- `apps/editor/tsconfig.json`
  - Added editor-specific DOM-aware TypeScript config.
- `package.json`
  - Added `typecheck:root`; root `typecheck` now runs root plus editor typecheck.
- `apps/editor/package.json`
  - Added editor `typecheck` script.

## 2. Summary

Domain A restored the root typecheck boundary so core packages do not receive DOM lib types by default, while keeping `apps/editor` explicitly DOM-aware. This makes accidental DOM usage in core package source easier to catch at compile time.

## 3. Verification

| Command | Result |
|---|---|
| `pnpm --filter @private-2d-rigging-lab/editor typecheck` | pass |
| `pnpm typecheck` | pass |
| `pnpm check:source` | pass |
| `pnpm check` | pass during domain verification |

## 4. Review Notes

- `apps/editor/tsconfig.json` owns browser libs.
- Root `tsconfig.json` remains package/script focused.
- No new source organization risk was introduced.

## 5. Remaining Issues

- None.
