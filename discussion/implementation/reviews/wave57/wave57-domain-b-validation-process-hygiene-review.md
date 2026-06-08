# Wave57 Domain B Review: Validation / Dependency / Process Hygiene

> Target: `wave57-workspace-placeholder-composition-validation-gates`
> Reviewer: Review-Sylph lane 2
> Verdict: `pass`

## 1. Scope Reviewed

Reviewed the Domain B validation/process/dependency surface for:

- `apps/editor/**`
- `package.json`
- `pnpm-lock.yaml`
- `pnpm-workspace.yaml`
- `tsconfig.json`
- `discussion/implementation/waves/wave57/**`
- `discussion/implementation/reviews/wave57/**`
- root validation scripts only where needed to confirm the standard path does not restore old GUI/e2e/testid gates

This lane did not edit source files, did not start a dev server, and did not run browser e2e, screenshot, or visual regression validation.

## 2. Basis Documents Used

- `discussion/implementation/orchestration/wave57-plan.md`
- `discussion/design/screen-design/react-editor-foundation-oracle.md`
- `discussion/design/screen-design/editor-rebuild-purge-policy.md`
- `discussion/design/screen-design/scope-and-principles.md`
- `discussion/design/screen-design/overview.md`
- `discussion/design/screen-design/screens/authoring-workspace.md`
- `discussion/design/screen-design/components/toolbox.md`
- `discussion/design/codex-friendly-automation-policy.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/implementation/waves/wave57/wave57-domain-a-react-stack-app-reset-report.md`
- `discussion/implementation/reviews/wave57/wave57-domain-a-react-stack-app-reset-review.md`
- `discussion/implementation/waves/wave57/wave57-domain-b-workspace-placeholder-composition-validation-gates-report.md`
- `C:/Users/remie/.codex/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/discussion-management/SKILL.md`

## 3. Findings

No blocking, needs-fix, or escalation findings.

Informational residuals:

- Ignored generated directories exist under `apps/editor/dist/` and `apps/editor/node_modules/`. They are ignored build/install output, not tracked source.
- `scripts/` still contains pre-existing historical references such as `check-focused-e2e-registry.mjs` text inside `scripts/check-wave43-validator-contract-coverage.mjs`. `scripts/` is unchanged in this wave, and root `check` does not invoke the old GUI/e2e/testid path.
- `git diff --check` passed for tracked diffs. Because current wave files are largely untracked, I also used direct source/path scans instead of relying on `git diff --check` alone.

## 4. Exact Validation / Check Results

- `pnpm.cmd --filter @private-2d-rigging-lab/editor typecheck`
  - Result: pass.
- `pnpm.cmd --filter @private-2d-rigging-lab/editor build`
  - Sandbox result: fail with Vite/esbuild `spawn EPERM`.
  - Required escalated rerun: pass. Vite built for production, 1800 modules transformed, output under `apps/editor/dist/`.
- `pnpm.cmd run typecheck`
  - Result: pass.
- `pnpm.cmd run test:unit`
  - Sandbox result: fail with Vitest/esbuild `spawn EPERM`.
  - Required escalated rerun: pass. 185 test files / 942 tests passed.
- `pnpm.cmd run check`
  - Sandbox result: fail with Vitest/esbuild `spawn EPERM` during nested `test:unit`.
  - Required escalated rerun: pass. 185 test files / 942 tests passed, `Dependency guard passed`, `Source organization guard passed`.
- Forbidden string/source scan over `apps/editor/src/**`
  - Pattern covered `Task Summary`, `Codex`, `debug`, `diagnostic(s)`, `evidence`, `operation ID`, `diagnostic ID`, `testid`, `test-id`, `data-testid`, `auto-rig`, `auto-fix`, `semantic recognition`, `proposal generation`, `command payload`, and standalone `ref` / `refs`.
  - Result: no matches.
- `Test-Path apps/editor/e2e`
  - Result: `False`.
- Old e2e/focused/testid/browser/visual path scan over `apps/editor`
  - Pattern covered `e2e`, `focused`, `testid`, `test-id`, `playwright`, `cypress`, and `visual`.
  - Result: no matches.
- Source structure check
  - `apps/editor/src` contains the oracle directories: `app`, `workspace`, `features`, `components`, `ui`, `state`, `styles`, and `lib`.
  - `apps/editor/src/components` contains only `status-badge.tsx`.
  - No `index.ts`, `types.ts`, `schemas.ts`, `utils.ts`, or `helpers.ts` paths were found under `apps/editor/src`.
- Forbidden dependency / architecture scan over `package.json`, `apps/editor/package.json`, and `pnpm-lock.yaml`
  - Result: no matches for `shadcn`, MUI, Mantine, Pixi, Playwright, Cypress, Chromatic, Percy, WebDriver, Storybook, React Router, TanStack Query, Formik, React Hook Form, Socket.IO, or Express.
- Forbidden Live2D/Cubism asset/dependency scan over package manifests, lockfile, and editor source
  - Result: no matches for `live2d`, `cubism`, `moc3`, `cmo3`, `model3`, `motion3`, `physics3`, or `pose3`.
- `git diff --check -- apps/editor package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json discussion/implementation/waves/wave57 discussion/implementation/reviews/wave57`
  - Result: pass. Git emitted LF/CRLF warnings only.

## 5. Dependency Assessment

Pass.

Direct editor dependencies in `apps/editor/package.json` match the oracle stack plus normal supporting React/Vite/TypeScript packages:

- Oracle stack: `react`, `react-dom`, `@vitejs/plugin-react`, `tailwindcss`, `@tailwindcss/vite`, `lucide-react`, Radix dialog/tooltip/tabs/popover, `react-resizable-panels`, `zustand`, `clsx`.
- Supporting packages: `typescript`, `vite`, `@types/react`, `@types/react-dom`.

Supporting dependency reasons are recorded in the Domain A report. The root `pnpm.overrides` pin for `@radix-ui/react-slot@1.2.4` is also recorded there as a dependency-guard false-positive workaround.

Domain B added no dependencies. No extra UI framework, component kit, renderer/canvas engine, routing/data-fetching/form architecture, browser e2e framework, visual regression tooling, or external transport was added.

## 6. Process Hygiene Assessment

Pass.

- No dev server was started by this review lane.
- No browser e2e, screenshot validation, visual regression, or long-running validation was run.
- No browser e2e, screenshot, or visual regression tooling was added to package manifests or the lockfile.
- `apps/editor/package.json` has ordinary Vite `dev` and `preview` scripts, but they are not part of root `typecheck`, `test:unit`, or `check`, and they were not used as validation.
- Post-validation `Get-Process node,cmd -ErrorAction SilentlyContinue` listed no `node` or `cmd` processes.

## 7. Old Guard Path Assessment

Pass.

- `apps/editor/e2e/**` was not restored.
- No `apps/editor` path matched old `e2e`, `focused`, `testid`, `test-id`, Playwright, Cypress, or visual-regression naming.
- The changed root/editor package and TypeScript config diffs do not add old e2e/focused/testid standard scripts.
- Pre-existing historical script references remain outside the standard root validation path and were not changed by this wave.

## 8. Standard Headless Baseline

Pass.

The standard headless baseline remains intact:

- `pnpm.cmd run typecheck`: pass.
- `pnpm.cmd run test:unit`: pass on escalated rerun after sandbox `spawn EPERM`.
- `pnpm.cmd run check`: pass on escalated rerun, including unit tests, dependency guard, and source organization guard.

No old GUI/e2e/testid gate was required for the standard headless baseline.

## 9. Remaining Issues

- None blocking.
- Nonblocking: ignored generated `apps/editor/dist/` and package-local `apps/editor/node_modules/` exist after install/build validation.
- Nonblocking: runtime visual fidelity remains unverified because Wave57 intentionally forbids dev server/browser/screenshot/visual validation.

## 10. User-Decision Points

None.
