# Wave57 Domain A Review: React Stack App Reset

> Target: `wave57-react-stack-app-reset`  
> Reviewer: Review-Sylph independent clean review  
> Verdict: `pass`

## 1. Scope Reviewed

Reviewed the Domain A source/package reset and report for:

- `apps/editor/index.html`
- `apps/editor/package.json`
- `apps/editor/tsconfig.json`
- `apps/editor/vite.config.ts`
- `apps/editor/src/main.tsx`
- `apps/editor/src/app/editor-app.tsx`
- `apps/editor/src/workspace/foundation-workspace.tsx`
- `apps/editor/src/components/status-badge.tsx`
- `apps/editor/src/state/editor-ui-store.ts`
- `apps/editor/src/styles/global.css`
- `apps/editor/src/lib/class-name.ts`
- `apps/editor/src/features/.gitkeep`
- `apps/editor/src/ui/.gitkeep`
- `package.json`
- `pnpm-lock.yaml`
- `discussion/implementation/waves/wave57/wave57-domain-a-react-stack-app-reset-report.md`

Also inspected deletion diffs for the old tracked vanilla scaffold files:

- `apps/editor/src/assets.d.ts`
- `apps/editor/src/editor-root.ts`
- `apps/editor/src/main.ts`
- `apps/editor/src/styles.css`
- `apps/editor/src/workspace-content.ts`
- `apps/editor/src/workspace-shell.ts`

Observed modified files outside Domain A source scope:

- `discussion/design/screen-design/react-editor-foundation-oracle.md`
- `discussion/implementation/_map.md`
- `discussion/implementation/orchestration/_map.md`
- `discussion/implementation/orchestration/wave57-plan.md`

I treated those as upstream working-tree context and did not edit them.

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
- `discussion/implementation/waves/wave56/wave56-domain-b-legacy-app-e2e-gui-doc-physical-purge-report.md`
- `discussion/implementation/waves/wave56/wave56-domain-c-headless-scripts-typecheck-baseline-report.md`
- `C:/Users/remie/.codex/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/waves/wave57/wave57-domain-a-react-stack-app-reset-report.md`

Key basis points checked:

- Wave57 Domain A must delete/recreate `apps/editor`, add the agreed React/Vite/Tailwind stack, preserve the Wave56 B/C headless baseline, and avoid feature implementation.
- The oracle permits small React/Vite/Tailwind supporting dependencies if the reason is recorded.
- Wave57 must not introduce dev server validation, browser e2e, screenshot validation, visual regression, or long-running process validation.
- `apps/editor/src/` must contain intentional top-level directories and avoid flat source growth; `index.ts`, if present, must be barrel-only.

## 3. Findings

No blocking or change-required findings.

### Informational / Residual Risk

1. `apps/editor/dist/` exists as ignored generated output.
   - Evidence: `git status --short --ignored apps/editor/dist` reports `!! apps/editor/dist/`; `.gitignore:2` ignores `dist/`.
   - Contents match a Vite build output (`index.html`, `assets/index-*.js`, `assets/index-*.css`) and are not tracked source.
   - This does not block Domain A because the source reset is clean, but it slightly contradicts a broad reading of the report statement that generated `dist/**` was removed and not restored. I classify it as nonblocking generated-output residue.

2. Process command-line inspection was partially limited by local permissions.
   - `Get-CimInstance Win32_Process` was denied, so I could not independently verify command lines for leftover node/cmd processes.
   - `Get-Process node,cmd -ErrorAction SilentlyContinue` produced no listed node/cmd processes in this review run.
   - No dev server, browser e2e, screenshot, or visual regression command was found in Domain A source/report evidence.

## 4. Verification Performed

Passed:

- `pnpm.cmd --filter @private-2d-rigging-lab/editor typecheck`
  - Result: pass.
- Vite production build with temporary outDir:
  - Command: `pnpm.cmd --filter @private-2d-rigging-lab/editor exec vite build --outDir "$env:TEMP\wave57-editor-build-review" --emptyOutDir`
  - First sandbox run hit `spawn EPERM` while esbuild loaded the Vite config.
  - Escalated rerun passed: 1761 modules transformed, output written to temp, not `apps/editor/dist`.
  - I did not rerun the exact package `build` script because it writes `apps/editor/dist`; the typecheck step and Vite production build were verified separately to keep the reviewer write footprint outside source.
- `pnpm.cmd run typecheck`
  - Result: pass.
- `pnpm.cmd run check`
  - First sandbox run hit `spawn EPERM` while Vitest/esbuild loaded config.
  - Escalated rerun passed.
  - Included 185 test files / 942 tests passed, dependency guard passed, source organization guard passed.
- `git diff --check -- apps/editor package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json discussion/implementation/waves/wave57 discussion/implementation/reviews/wave57`
  - Result: pass; Git emitted LF/CRLF warnings only.
- `Test-Path apps/editor/e2e`
  - Result: `False`.
- Source structure check:
  - `apps/editor/src` has `app`, `workspace`, `features`, `components`, `ui`, `state`, `styles`, `lib`.
- `rg --files apps/editor/src | Select-String -Pattern '\\index\.ts$|/index\.ts$'`
  - Result: no `index.ts` files.
- Forbidden Domain A source/content scan over `apps/editor/src`, `apps/editor/index.html`, `apps/editor/package.json`, `apps/editor/tsconfig.json`, and `apps/editor/vite.config.ts`
  - Result: only package-name hit for `@private-2d-rigging-lab/editor`; no forbidden visible/debug/evidence/feature implementation text.
- Forbidden dependency/asset scan over `apps/editor/package.json`, root `package.json`, and `pnpm-lock.yaml`
  - Result: no matches for `cmo3`, `live2d`, `cubism`, `moc3`, `model3`, `motion3`, `physics3`, `pose3`, `shadcn`, MUI, Mantine, Pixi, Playwright, Cypress, Chromatic, or Percy.
- Old e2e/testid path scan:
  - `rg --files scripts | Select-String -Pattern 'editor-e2e|focused-e2e|production-testid|testid|playwright|cypress|visual'` produced no path matches.
  - Standard-path reference scan still finds `scripts/check-wave43-validator-contract-coverage.mjs:171` referencing `node scripts/check-focused-e2e-registry.mjs`; Wave56 Domain C already classified this as a non-standard historical/helper reference not invoked by root `check`, `typecheck`, or `test:unit`.

Not performed:

- No dev server.
- No browser e2e.
- No screenshot or visual regression validation.
- No long-running process validation.

## 5. Dependency Assessment

Pass.

Direct editor dependencies in `apps/editor/package.json:12-31` match the oracle stack:

- React runtime: `react`, `react-dom`.
- Vite/Tailwind: `vite`, `@vitejs/plugin-react`, `tailwindcss`, `@tailwindcss/vite`.
- UI primitives/icons/layout/state/classes: Radix dialog/tooltip/tabs/popover, `lucide-react`, `react-resizable-panels`, `zustand`, `clsx`.
- Supporting type/compiler deps: `typescript`, `@types/react`, `@types/react-dom`.

Supporting dependency reasons are recorded in the Domain A report at `discussion/implementation/waves/wave57/wave57-domain-a-react-stack-app-reset-report.md:72-84`.

Root `package.json:23-25` adds a `pnpm.overrides` pin for `@radix-ui/react-slot@1.2.4`; the report explains it as a dependency-guard false-positive workaround at `discussion/implementation/waves/wave57/wave57-domain-a-react-stack-app-reset-report.md:84` and `:159`. This is not a new UI architecture or forbidden runtime surface.

No `shadcn/ui`, MUI, Mantine, PixiJS, browser e2e framework, visual regression tool, renderer/canvas engine, routing architecture, form architecture, data fetching architecture, or external transport was introduced.

## 6. Source Structure Assessment

Pass.

The old tracked vanilla scaffold files are deleted, and the new files are React/Vite/Tailwind oriented:

- `apps/editor/index.html` now mounts `#root` and loads `/src/main.tsx`.
- `apps/editor/src/main.tsx:1-16` uses React `StrictMode`, `createRoot`, `EditorApp`, and `global.css`.
- `apps/editor/src/app/editor-app.tsx:1-4` is top-level composition only.
- `apps/editor/src/workspace/foundation-workspace.tsx:1-39` is a minimal foundation shell.
- `apps/editor/src/components/status-badge.tsx:1-29` is a small reusable app component.
- `apps/editor/src/state/editor-ui-store.ts:1-8` is UI-only zustand state.
- `apps/editor/src/styles/global.css:1-30` is the Tailwind/global style entry.
- `apps/editor/src/lib/class-name.ts:1-5` is a small `clsx` wrapper.
- `apps/editor/vite.config.ts:1-7` wires React and Tailwind Vite plugins.
- `apps/editor/tsconfig.json:17-22` enables React JSX and includes `src` plus `vite.config.ts`.

The required top-level directories exist:

```text
apps/editor/src/
  app/
  workspace/
  features/
  components/
  ui/
  state/
  styles/
  lib/
```

There are no `index.ts` files. No `src/` flat pile or `components/` dumping ground was introduced.

The startup UI is intentionally minimal and does not claim complete Authoring Workspace composition. That matches Domain A's stated scope in the report: full Authoring Workspace placeholder composition remains Domain B ownership.

## 7. Non-Goal / Forbidden Capability Assessment

Pass.

I found no Domain A implementation of:

- PSD import.
- Mesh, rig, atlas, parameter, variant, dynamics, or viewer functionality.
- Codex UI, diagnostics/evidence UI, semantic recognition, proposal generation, auto-rigging, or auto-fix.
- External HTTP, WebSocket, MCP, LLM/provider, or prompt workflow.

The only matched "rig" text in the Domain A source/package scan was the package name `@private-2d-rigging-lab/editor`.

## 8. Wave56 Headless Baseline Assessment

Pass.

Root scripts remain aligned with the Wave56 Domain C headless baseline:

- `package.json:8-15` still defines root `typecheck`, package-only `test:unit`, `check:deps`, `check:source`, and `check`.
- `pnpm run typecheck` passed.
- `pnpm run check` passed, including unit tests and both guards.

The known old GUI-coupled package fixture exclusion remains in `tsconfig.json` and root `test:unit`; this is existing Wave56 baseline behavior, not a new Domain A regression.

## 9. Process / Orchestration Assessment

Pass with limited independent proof.

Verified from basis/process evidence:

- Wave57 plan requires Orch-Sylph to delegate source implementation to Gnome and independent review to Review-Sylph, and requires waiting for child final state.
- The current review was launched only after a Domain A report with `Verdict: pass`.
- The Domain A report records follow-up reconciliation, required verification, no dev server/browser e2e/visual validation, and no feature implementation.

Limit of independent verification:

- I cannot prove from repository files alone whether Orch-Sylph directly edited source or whether both child-agent waits occurred exactly as described. I treat the caller-provided orchestration sequence as process evidence and found no repository contradiction.
- A command-line process audit via CIM was denied, but a basic `Get-Process node,cmd` check produced no listed node/cmd processes.

## 10. Remaining Issues

- Nonblocking: ignored generated `apps/editor/dist/` exists. It is not tracked source and appears to be Vite output. Orchestrator may leave it because it is ignored/generated, or clean it in a separate process-hygiene step if a pristine workspace is desired.
- Nonblocking: exact `pnpm --filter @private-2d-rigging-lab/editor build` was not rerun by this reviewer to avoid writing `apps/editor/dist`; editor typecheck plus Vite production build to a temp outDir passed.
- Nonblocking: modified map/oracle files outside Domain A source scope remain present in the working tree and should be owned by the upstream/orchestration context, not Domain A.

## 11. User-Decision Points

None.
