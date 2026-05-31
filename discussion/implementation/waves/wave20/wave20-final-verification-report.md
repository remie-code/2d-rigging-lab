# Wave 20 Final Verification Report

> Target: `wave20-integration-review-and-final-report`
> Role: Gnome final verification delegate
> Date: 2026-05-31

## Verdict

`pass`.

Wave 20 final verification passed after restoring the local frozen `node_modules` tree for the required e2e run. No source fix is required.

## Context Used

- Context role/name used in this run: `Gnome final verification agent for Wave 20 / Domain H integration`
- Context id: not exposed in this subagent context

## Required Commands

| Command / check | Result | Summary |
|---|---|---|
| `pnpm.cmd typecheck` | pass | Root `tsc --noEmit` and editor `tsc --noEmit -p tsconfig.json` both passed. |
| `pnpm.cmd test:unit` | pass after sandbox escalation | Sandbox run failed with `EPERM` reading the installed Vitest entrypoint. Escalated rerun passed: `93` test files / `496` tests. |
| `pnpm.cmd test:e2e` | pass after dependency-tree restore and sandbox escalation | Initial sandbox run failed before app code because Vite could not read/resolve pnpm-installed `fdir`. `pnpm.cmd install --frozen-lockfile --force` restored the existing frozen dependency tree with no manifest/lockfile changes. Escalated e2e rerun passed: desktop smoke, mobile smoke, preview/drawable screenshots, final `editor-e2e: smoke passed`. |
| `pnpm.cmd run check:source` | pass | `Source organization guard passed.` |
| `git diff --check -- apps/editor packages fixtures/contracts discussion/implementation` | pass | No whitespace errors. Output contained Git LF/CRLF working-copy warnings only. |

Additional whitespace check for currently untracked Wave20 reports, fixtures, and new source/test files:

- `rg -n "[ \t]+$" discussion/implementation/waves/wave20 discussion/implementation/reviews/wave20 fixtures/contracts/psd-import-happy-path fixtures/contracts/psd-unsupported-layer packages/operation-core/src/operations/import-psd-source-asset*.ts packages/operation-core/src/psd-import-contract-fixtures.test.ts packages/validator-core/src/psd-source-profile.test.ts packages/validator-core/src/validators/psd-source-profile.ts`
- Result: no matches.

## Dependency Manifest Diff

Checked:

- `git diff --name-only -- package.json pnpm-lock.yaml pnpm-workspace.yaml apps/*/package.json packages/*/package.json`
- `git ls-files --others --exclude-standard -- package.json pnpm-lock.yaml pnpm-workspace.yaml apps/*/package.json packages/*/package.json`
- `git status --short -uall -- package.json pnpm-lock.yaml pnpm-workspace.yaml apps/*/package.json packages/*/package.json`

Result: no changed or untracked dependency manifests / lockfiles. Wave 20 does not introduce dependency manifest or lockfile changes.

## Parser / File Picker / Decode / Raster Scan

Method:

1. Built the changed production source set from tracked and untracked changes under `apps/editor/src` and `packages/*/src`, excluding `*.test.ts` / `*.spec.ts`.
2. Ran a hard forbidden implementation scan for `showOpenFilePicker`, `FileReader`, `readFile`, `OpenRead`, `fs.`, `ag-psd`, `sharp`, `pngjs`, `jimp`, `createImageBitmap`, `ImageData`, `arrayBuffer`, `raster extraction`, `extract raster`, `decode image`, and `image decode`.
3. Ran a truthfulness wording scan for `parser`, `decode`, `raster`, `file picker`, `file-picker`, `PSD bytes`, `parsed from bytes`, `Photoshop-compatible`, and `extract`.
4. Inspected matching source contexts.

Result:

- No OS file picker, PSD parser dependency, filesystem read, image decode implementation, raster extraction implementation, or Photoshop-compatible rendering claim was found in changed production source files.
- Matches were either explicit negative/truthfulness diagnostics (`operation-core does not parse PSD bytes or extract raster data`, `no PSD bytes were parsed by the editor`), metadata fields such as `rasterizeCandidate`, TypeScript utility `Extract<>`, or deterministic data URL reference validation. None violate Wave 20 forbidden claims.

## Changed Production Files Considered

- `apps/editor/src/editor-session/evidence-provider.ts`
- `apps/editor/src/editor-session/source-import-command.ts`
- `apps/editor/src/editor-state/source-intake-draft-state.ts`
- `apps/editor/src/editor-state/source-intake-view-model.ts`
- `apps/editor/src/editor-workflow/source-intake-workflow.ts`
- `apps/editor/src/editor-workflow/workflow-controller.ts`
- `apps/editor/src/ui/source-assets/source-intake-form.ts`
- `apps/editor/src/ui/source-assets/source-intake-panel.ts`
- `packages/operation-core/src/operation-registry.ts`
- `packages/operation-core/src/operations/import-psd-source-asset.ts`
- `packages/operation-core/src/operations/import-psd-source-asset-diagnostics.ts`
- `packages/operation-core/src/operations/import-psd-source-asset-materialization.ts`
- `packages/operation-core/src/operations/import-psd-source-asset-preconditions.ts`
- `packages/operation-core/src/operations/import-psd-source-asset-texture.ts`
- `packages/operation-core/src/operations/import-split-png-source-asset-unsupported-psd.ts`
- `packages/operation-core/src/payloads/import-source.ts`
- `packages/validator-core/src/check-catalog.ts`
- `packages/validator-core/src/index.ts`
- `packages/validator-core/src/validators/package-runtime.ts`
- `packages/validator-core/src/validators/psd-source-profile.ts`

## Remaining Issues

No blocking or source-level issues remain from final verification.

Residual notes:

- The Wave 20 PSD path remains parser-free and metadata/adapter-result based. It does not prove actual PSD layer tree extraction, image decode, raster extraction, or Photoshop-compatible rendering.
- The e2e run required local dependency-tree restoration because the sandbox-visible pnpm install state could not read/resolve Vite's `fdir` dependency. The frozen reinstall did not change dependency manifests or lockfiles.
