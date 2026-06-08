# Wave58 Domain A Test / Process Review

## Verdict

pass

Loop: `fix-loop-1 re-review`

Previous blocker F-001 is resolved. Direct re-checks found no `LISTENING` sockets on `4173` or `5173`, and the Playwright E2E remains scoped to path/state reflection without visual, pixel, tooltip-full-text, parser-DTO, CSS-class, or internal-store oracle coupling.

## Scope Reviewed

- Wave58 Domain A: `wave58-psd-import-e2e-v0-implementation`
- Review lane: test adequacy / process hygiene
- Source/product files were read-only. This report is the only file written by this reviewer.
- Inspected current worktree status, scoped diff, package scripts, Playwright config, E2E spec, PSD parser boundary, PSD import planning/commit/session code, generated artifact status, Gnome fix-loop report, and local process/port state.

## Basis Documents Used

- `discussion/implementation/orchestration/wave58-plan.md`
- `discussion/design/screen-design/e2e-oracle.md`
- `discussion/design/screen-design/screens/psd-import-task.md`
- `discussion/design/screen-design/screens/authoring-workspace.md`
- `discussion/design/screen-design/react-editor-foundation-oracle.md`
- `discussion/design/screen-design/editor-rebuild-purge-policy.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `.github/skills/implementation-orchestration/SKILL.md`
- Previous report: `discussion/implementation/reviews/wave58/wave58-domain-a-test-process-review.md`
- Fix evidence: `discussion/implementation/waves/wave58/wave58-domain-a-psd-import-e2e-v0-gnome-report.md`

## Findings

### F-001: pass - long-running editor dev server cleanup verified

- Previous finding was the leftover editor Vite dev server on `127.0.0.1:5173`.
- Gnome fix-loop report records that the stale process tree was identified and stopped at `discussion/implementation/waves/wave58/wave58-domain-a-psd-import-e2e-v0-gnome-report.md:36-39`.
- Gnome fix-loop report records the final cleanup check as `no LISTENING sockets on 4173 or 5173` at `discussion/implementation/waves/wave58/wave58-domain-a-psd-import-e2e-v0-gnome-report.md:90-93`.
- Direct re-check by this reviewer:
  - `Get-NetTCPConnection -LocalPort 4173,5173 -State Listen`: `no LISTENING sockets on 4173 or 5173`.
  - `netstat -ano | Select-String -Pattern ':(4173|5173)\s+.*LISTENING'`: no matches.
  - `Get-Process` name scan found only Codex/node_repl Node processes, not an obvious `vite`, `playwright`, or `pnpm` server process.
- `Get-CimInstance Win32_Process` was denied by OS permissions, so command-line-level process inspection could not be repeated in this review context. The clean port evidence is sufficient for the Wave58 process hygiene gate.

### F-002: pass - explicit PSD-import Playwright command is scoped

- `apps/editor/package.json:10` adds `test:e2e:psd-import` as `playwright test -c playwright.config.ts`.
- `apps/editor/package.json:30` adds `@playwright/test`; no root script was changed to run this E2E unconditionally.
- `apps/editor/playwright.config.ts:4` scopes the suite to `./e2e`.
- `apps/editor/playwright.config.ts:10-18` uses a single local Vite `webServer` on `127.0.0.1:4173`, sets `reuseExistingServer: false`, and lets Playwright own server lifecycle.
- `apps/editor/playwright.config.ts:11-12` disables screenshot and video capture.

### F-003: pass - E2E follows the path/state oracle and does not overreach

- The governing oracle allows minimal path/state E2E only: `discussion/design/screen-design/e2e-oracle.md:11-31`, `:54-68`, and `:71-89`.
- The Wave58 plan repeats the same boundary: path completion and state reflection only at `discussion/implementation/orchestration/wave58-plan.md:40`, `:95-120`, and `:181-185`.
- The E2E uses the local fixture PSD at `apps/editor/e2e/psd-import.e2e.spec.ts:6`.
- It checks the user path and state reflection: import entry/dialog (`apps/editor/e2e/psd-import.e2e.spec.ts:13-17`), review state (`:19-24`), import action (`:26`), modal close and workspace reflection (`:28-37`).
- I found no `toHaveScreenshot`, screenshot/pixel oracle, layout geometry assertion, tooltip full-text assertion, parser DTO full-field assertion, CSS class assertion, or internal store shape coupling in the E2E.
- The `data-testid` hooks used by the spec are narrow path/state observation hooks:
  - `apps/editor/src/features/psd-import/components/psd-import-modal.tsx:217`
  - `apps/editor/src/features/psd-import/components/psd-import-modal.tsx:238`
  - `apps/editor/src/workspace/panels/structure-tree-panel.tsx:18`
  - `apps/editor/src/workspace/panels/structure-tree-panel.tsx:27`
  - `apps/editor/src/workspace/panels/inspector-panel.tsx:29`

### F-004: pass - parser/operation correctness remains in unit/headless coverage

- Browser parser usage is isolated to `apps/editor/src/editor-workflow/browser-psd-parser-adapter.ts`; direct `Psd.parse` appears at `apps/editor/src/editor-workflow/browser-psd-parser-adapter.ts:87`.
- The parser boundary guard allows that adapter plus Wave44 scripts only at `scripts/check-psd-parser-import-boundary.mjs:20-24`, and this reviewer reran it successfully.
- Durable React/session planning avoids raw parser object and raw PSD byte persistence via policy fields in `apps/editor/src/features/psd-import/model/psd-import-planner.ts:121`, `:145-147`, and `:176-178`.
- The commit path uses operation-core commits at `apps/editor/src/features/psd-import/model/psd-import-commit.ts:31` and `:46`; the E2E does not validate operation DTO internals, evidence paths, digests, generated refs, or parser fields.

### F-005: pass - old e2e/focused/testid registry architecture was not restored wholesale

- The new E2E surface is limited to `apps/editor/playwright.config.ts`, `apps/editor/e2e/psd-import.e2e.spec.ts`, and `apps/editor/package.json:10`.
- Repository searches still find historical focused-e2e/testid references in old scripts and discussion records, but I did not find a new restored focused registry architecture in the changed editor source or a restored root standard E2E gate.
- Production `data-testid` usage in the changed editor source is limited to the narrow hooks listed in F-003.

### F-006: pass with note - generated artifacts are not added as normal source evidence

- `apps/editor/dist/` and `apps/editor/node_modules/` appear as ignored directories under `git status --short --ignored`.
- `apps/editor/test-results/` exists but is empty; `apps/editor/playwright-report/` and `apps/editor/blob-report/` are absent.
- No Playwright report/result artifact is listed as a normal source addition.
- Note: `.tmp-editor-vite.log` and `.tmp-editor-vite.err.log` are tracked repository files and remain modified in the dirty worktree. They look like dev-server logs, but they are not new E2E source additions and were not reverted because this review is read-only for source/product files and the worktree was already dirty before Domain A.

## Validation Evidence Checked

Independently run by this reviewer:

- PASS: `node scripts/check-psd-parser-import-boundary.mjs`
  - Output: `PSD parser import boundary check passed: 6 direct import/resolve sites limited to approved adapter and Wave44 scripts.`
- PASS: `git diff --check -- apps/editor package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json scripts discussion`
  - Only CRLF conversion warnings were emitted.
- PASS: direct port checks for `4173` and `5173`
  - `Get-NetTCPConnection`: no listeners.
  - `netstat`: no `LISTENING` matches.

Checked from Gnome fix-loop report plus direct config/spec/source inspection, not rerun to avoid adding build/test artifacts:

- Reported PASS: `pnpm --dir apps/editor typecheck`
- Reported PASS: `pnpm --dir apps/editor build`
- Reported PASS: root `pnpm run typecheck`
- Reported PASS: root `pnpm run test:unit` (`185` files / `942` tests)
- Reported PASS: root `pnpm run check`
- Reported PASS: `pnpm run smoke:wave44:psd-parser`
- Reported PASS: `pnpm --dir apps/editor test:e2e:psd-import` (`1` test)
- Reported PASS: `git diff --check -- apps/editor package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json scripts discussion`
- Reported PASS: final port/process cleanup check for `4173` and `5173`

## Process Check Evidence

- Gnome report documents cleanup of the previous `5173` server process tree at `discussion/implementation/waves/wave58/wave58-domain-a-psd-import-e2e-v0-gnome-report.md:36-39`.
- Gnome report documents a clean post-E2E port check at `discussion/implementation/waves/wave58/wave58-domain-a-psd-import-e2e-v0-gnome-report.md:90-93`.
- This reviewer independently confirmed no `LISTENING` sockets on `4173` or `5173`.
- This reviewer did not kill any processes.

## Residual Risks

- Full build/root unit/root check/Playwright E2E were not rerun by this reviewer; they are accepted from the Gnome fix-loop report and corroborated by direct file inspection plus lightweight reruns.
- `Get-CimInstance Win32_Process` was denied, so command-line-level process inspection could not be independently repeated. Port-level evidence is clean.
- The tracked `.tmp-editor-vite.*` logs remain modified in the dirty worktree. This is a repo hygiene note, not a Domain A E2E/process blocker after port cleanup.

## User-Decision Points

- None.
