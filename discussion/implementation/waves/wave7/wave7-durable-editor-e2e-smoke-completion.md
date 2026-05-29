# Wave 7 Domain F Completion: durable editor e2e smoke

> Wave: `editor-project-persistence-and-e2e-hardening`
> Domain: `wave7-durable-editor-e2e-smoke`
> Verdict: `pass`

## 1. Changed Files

- `scripts/editor-e2e-smoke.mjs`
- `apps/editor/e2e/browser-discovery.mjs`
- `apps/editor/e2e/cdp-client.mjs`
- `apps/editor/e2e/chrome-launcher.mjs`
- `apps/editor/e2e/early-escape.mjs`
- `apps/editor/e2e/page-session.mjs`
- `apps/editor/e2e/smoke-checks.mjs`
- `apps/editor/e2e/test-ids.mjs`
- `apps/editor/e2e/vite-server.mjs`
- `package.json`
- `apps/editor/package.json`

## 2. Summary

Domain F added a permanent dependency-free editor e2e smoke script. It starts or reuses the Vite editor server, locates Chrome or Edge through environment variables, known Windows paths, or PATH, and drives the app through Chrome DevTools Protocol.

The smoke runs both desktop and mobile viewport flows and verifies initial render, `createParameter` commit, save to browser storage, reload/load from storage, reset to sample, and horizontal overflow count `0`.

## 3. Verification

| Command | Result |
|---|---|
| `pnpm run test:e2e:editor` | pass; Chrome desktop + mobile smoke |
| `pnpm --filter @private-2d-rigging-lab/editor build` | pass |
| `pnpm check` | pass; 37 files / 169 tests plus guards |
| `git diff --check -- scripts/editor-e2e-smoke.mjs apps/editor/e2e package.json apps/editor/package.json` | pass; CRLF warnings only |

## 4. Review Notes

- No Playwright or full e2e framework dependency was added.
- Production source under `apps/editor/src/**` was not changed by this domain.
- Browser unavailable cases exit as early escape with exit code `2`.
- Helper files are split by responsibility; no giant e2e script blob was introduced.

## 5. Remaining Issues

- E2E test IDs are duplicated in `apps/editor/e2e/test-ids.mjs`; this is acceptable for the no-build/no-new-dependency script, but drift should be watched in later waves.
