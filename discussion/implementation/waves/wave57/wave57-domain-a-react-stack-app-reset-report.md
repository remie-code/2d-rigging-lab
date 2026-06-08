# Wave57 Domain A Report: React Stack App Reset

> Target: `wave57-react-stack-app-reset`  
> Verdict: `pass`

## 1. Scope and Basis

Domain A reset `apps/editor` only:

- Verified the resolved deletion target before recursive delete:
  - Workspace: `C:\workspace\remie\code\ai-native-live2d-editor`
  - Target: `C:\workspace\remie\code\ai-native-live2d-editor\apps\editor`
- Deleted the current `apps/editor` directory with `Remove-Item -LiteralPath ... -Recurse -Force`.
- Recreated `apps/editor` as a fresh React + Vite + TypeScript + Tailwind scaffold.
- Kept the UI intentionally minimal; full Authoring Workspace placeholder composition remains Domain B ownership.
- Did not inspect or reuse old GUI source as implementation basis.

Basis documents followed:

- `discussion/implementation/orchestration/wave57-plan.md`
- `discussion/design/screen-design/react-editor-foundation-oracle.md`
- `discussion/design/screen-design/editor-rebuild-purge-policy.md`
- `discussion/design/screen-design/scope-and-principles.md`
- `discussion/design/screen-design/overview.md`
- `discussion/design/screen-design/screens/authoring-workspace.md`
- `discussion/design/screen-design/components/toolbox.md`
- `discussion/design/codex-friendly-automation-policy.md`
- `discussion/development_convention/source-file-organization-policy.md`
- Wave56 Domain B/C reports for purge and headless baseline

## 2. Files Deleted

The old tracked scaffold files under `apps/editor` were removed by the full directory reset:

- `apps/editor/src/assets.d.ts`
- `apps/editor/src/editor-root.ts`
- `apps/editor/src/main.ts`
- `apps/editor/src/styles.css`
- `apps/editor/src/workspace-content.ts`
- `apps/editor/src/workspace-shell.ts`

Untracked/generated files such as the previous `apps/editor/dist/**` and package-local cache were also removed by the directory reset and were not restored as source.

## 3. Files Created / Changed

Created fresh editor package files:

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

Changed:

- `apps/editor/package.json`
- `apps/editor/index.html`
- `apps/editor/tsconfig.json`
- `package.json`
- `pnpm-lock.yaml`
- Follow-up reconciliation changed `apps/editor/src/workspace/foundation-workspace.tsx` visible copy from developer-facing tech-stack text to neutral editor shell copy.

`pnpm-workspace.yaml` and root `tsconfig.json` were not changed.

## 4. Dependencies Added

Dependency reasons:

- `react` / `react-dom`: browser React runtime for the editor app.
- `vite` / `@vitejs/plugin-react`: retained Vite build path plus React transform support.
- `typescript` / `@types/react` / `@types/react-dom`: TypeScript compiler and React DOM type coverage for idiomatic React + TypeScript code.
- `tailwindcss` / `@tailwindcss/vite`: agreed CSS pipeline for the fresh editor scaffold.
- `lucide-react`: lightweight icon primitive used by the minimal shell header.
- `@radix-ui/react-dialog`, `@radix-ui/react-tooltip`, `@radix-ui/react-tabs`, `@radix-ui/react-popover`: accessible UI primitive baseline for later editor controls; Domain A only installs them and does not surface those controls.
- `react-resizable-panels`: panel layout primitive for later workspace composition; Domain A does not compose the full workspace.
- `zustand`: UI-only state boundary used by `state/editor-ui-store.ts`.
- `clsx`: class composition helper wrapped by `lib/class-name.ts`.

Root `package.json` also adds a `pnpm.overrides` entry pinning `@radix-ui/react-slot` to `1.2.4`. This avoids a false positive in the existing dependency guard: the `1.2.5` lockfile integrity hash contained the substring `cmo3`, which the guard treats as a forbidden asset/dependency marker even though it was only hash text.

## 5. Scaffold Structure

Required `apps/editor/src/` top-level structure exists:

```text
src/
  app/
  workspace/
  features/
  components/
  ui/
  state/
  styles/
  lib/
```

Implementation files are responsibility-scoped:

- `app/editor-app.tsx`: top-level app composition.
- `workspace/foundation-workspace.tsx`: minimal Domain A editor shell with neutral user-facing copy.
- `components/status-badge.tsx`: small app-specific reusable status display.
- `state/editor-ui-store.ts`: editor UI-only zustand store boundary.
- `styles/global.css`: Tailwind entry and global document styles.
- `lib/class-name.ts`: `clsx` wrapper.

No `index.ts` barrel files were added.

## 6. Verification

Passed:

- Environment prep for follow-up verification:
  - Initial verification found `node_modules` absent.
  - `pnpm install --frozen-lockfile` was run; the first sandbox attempt exited 1 with cleanup warnings, then the escalated rerun passed with the lockfile unchanged.
- `pnpm --filter @private-2d-rigging-lab/editor typecheck`
  - Result: pass.
- `pnpm --filter @private-2d-rigging-lab/editor build`
  - First sandbox run hit `spawn EPERM` while Vite/esbuild loaded config.
  - Escalated re-run: pass.
- `pnpm run typecheck`
  - Result: pass.
- `pnpm run check`
  - First sandbox run hit `spawn EPERM` while Vitest/esbuild loaded config.
  - Escalated re-run: pass.
  - Included 185 package test files / 942 tests passed, dependency guard passed, source organization guard passed.
- Mechanical `apps/editor/e2e/**` check:
  - Result: `apps/editor/e2e absent`.
- Mechanical direct dependency check:
  - Result: direct editor dependencies are the agreed React stack, retained `typescript` / `vite`, and user-approved `@types/react` / `@types/react-dom`.
- Forbidden dependency/asset pattern scan over `pnpm-lock.yaml`:
  - Result: no matches for `cmo3`, `live2d`, `cubism`, `moc3`, `model3`, `motion3`, `physics3`, or `pose3`.
- Visible tech-stack copy scan over `apps/editor/src`:
  - Result: no matches for `React stack`, `Fresh React`, `Vite`, `Tailwind`, or `TypeScript`.

- `git diff --check -- apps/editor package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json discussion/implementation/waves/wave57 discussion/implementation/reviews/wave57`
  - Result: pass; Git emitted line-ending warnings only.

## 7. Process / Non-Goals Confirmation

- No dev server was started.
- No browser e2e, visual regression, screenshot validation, or long-running process validation was introduced.
- `apps/editor/e2e/**` was not recreated.
- Old focused e2e, production `data-testid` guard paths, and browser e2e tooling were not restored.
- No old GUI source, git history, old Wave51-Wave56 GUI docs, old e2e, or old testid guard was used for implementation reuse.
- No PSD import, mesh, rig, atlas, parameter, variant, dynamics, viewer, Codex UI, diagnostics/evidence UI, semantic recognition, proposal generation, auto-rigging, or auto-fix functionality was implemented.
- Wave56 Domain B/C headless baseline remains intact: root `typecheck` and `check` passed.

## 8. Remaining Issues / User Decision Points

Remaining issues:

- None blocking Domain A review.
- Review should note the dependency-scope clarification: `@types/react` and `@types/react-dom` were added because the user explicitly prioritized idiomatic React + TypeScript implementation over avoiding type packages.
- Review should also note the root `pnpm.overrides` entry for `@radix-ui/react-slot@1.2.4`, which exists only to keep the current dependency guard from failing on a lockfile integrity-hash false positive.

User decision points:

- None.
