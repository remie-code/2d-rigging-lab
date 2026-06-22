# Runtime Player Wave2 Domain A Test Adequacy Review

Verdict: `pass`

Target: `runtime-player-wave2-runtime-export-loader-ipc` / Domain A  
Reviewer: Review-Sylph - Test Adequacy Review  
Date: 2026-06-22

## Scope Reviewed

Basis documents:

- `discussion/runtime-player/implementation/orchestration/player-wave2-plan.md`
- `discussion/runtime-player/architecture/runtime-player-development-policy.md`
- `discussion/development_convention/source-file-organization-policy.md`

Repository evidence reviewed:

- `git status --short -uall`
- `git diff -- apps/runtime-player pnpm-lock.yaml`
- `apps/runtime-player/src/main/runtime-export-loader/runtime-export-directory-loader.test.ts`
- `apps/runtime-player/src/runtime-player-boundary.test.ts`
- `apps/runtime-player/src/main/placeholder-action-state.test.ts`
- Changed and new Runtime Player source under `apps/runtime-player/**`
- `apps/runtime-player/package.json`
- `pnpm-lock.yaml`

## Findings

### High - Required loader validation failures are not fully covered

`apps/runtime-player/src/main/runtime-export-loader/runtime-export-directory-loader.test.ts:49` covers missing `runtime-export.json`, `:58` covers invalid JSON for `runtime/model.json`, `:72` covers missing `runtime/atlas.json`, `:82` covers multi-page rejection, `:100` covers raw RGBA byte length, `:114` covers digest mismatch, and `:130` covers path traversal at the resolver level.

Those tests do not yet cover several required validation cases from the Wave2 rubric:

- missing referenced `runtime/model.json`
- missing referenced raw RGBA texture page
- invalid manifest schema producing `runtimeExport.invalidManifest`
- invalid model schema producing `runtimeExport.invalidModel`
- invalid atlas schema producing `runtimeExport.invalidAtlas`
- missing/unsupported required capability producing `runtimeExport.unsupportedCapability`

The implementation has distinct branches for these outcomes in `apps/runtime-player/src/main/runtime-export-loader/runtime-export-directory-loader.ts:103`, `:121`, `:140`, and `:233`, but the current test file does not exercise them. This leaves required Runtime Export rejection behavior unpinned.

Recommendation: add focused loader tests that mutate the existing synthetic fixture to remove `runtime/model.json`, remove `assets/textures/atlas_page_0.raw-rgba`, break manifest/model/atlas schema shape without invalid JSON, and remove one required capability.

### Medium - Visible error mapping is present in source but not tested

The bridge converts loader failures into an error status at `apps/runtime-player/src/main/runtime-export-loader/runtime-export-bridge-handlers.ts:90`, using `toRuntimeExportLoadError` from `apps/runtime-player/src/main/runtime-export-loader/runtime-export-errors.ts:18`. The Control Window displays error state at `apps/runtime-player/src/control/control-window-app.tsx:211` and maps open-directory errors to visible feedback at `:326`.

No current test exercises that a loader error becomes `RuntimeExportOpenDirectoryResult.result === "error"`, that `RuntimeExportSessionState` clears the loaded payload on error, or that the user-visible status/feedback carries the mapped message/details. The Wave2 test adequacy rubric explicitly asks for visible error mapping coverage.

Recommendation: add a small pure/session test for `toRuntimeExportLoadError` and `RuntimeExportSessionState.setError`. If practical, add a bridge-handler unit test with a stubbed loader and fake windows to verify the returned error result and status broadcast. A component test or extracted pure feedback mapper can cover Control-visible text without needing a real Electron dialog.

## Adequacy Matrix

| Rubric item | Current evidence | Status |
|---|---|---|
| Valid arbitrary directory name | `runtime-export-directory-loader.test.ts:24` uses a temp directory prefix rather than `.runtime-export` | Covered |
| Missing `runtime-export.json` | `runtime-export-directory-loader.test.ts:49` | Covered |
| Missing required referenced artifacts | Atlas only at `runtime-export-directory-loader.test.ts:72`; model and raw texture are not covered | Partial |
| Invalid JSON/schema | Invalid JSON only at `runtime-export-directory-loader.test.ts:58`; schema failures are not covered | Partial |
| Path traversal | `runtime-export-directory-loader.test.ts:130` covers resolver rejection | Covered |
| Single-page enforcement | `runtime-export-directory-loader.test.ts:82` | Covered |
| Raw RGBA byte length | `runtime-export-directory-loader.test.ts:100` | Covered |
| Digest mismatch | `runtime-export-directory-loader.test.ts:114` | Covered |
| Visible error mapping | Source exists, but no test currently exercises error result/status/UI feedback mapping | Missing |
| Avoid Editor imports | Targeted search found no `apps/editor`, `../editor`, or `../../editor` imports under `apps/runtime-player/src` | Covered by inspection |
| Avoid real user artifacts | Loader tests build synthetic fixtures in temp directories at `runtime-export-directory-loader.test.ts:139` | Covered |

## Verification Commands

Passed:

- `node scripts/check-source-organization.mjs`
  - Result: passed.
- `node scripts/check-dependencies.mjs`
  - Result: passed.
- `git diff --check -- apps/runtime-player pnpm-lock.yaml`
  - Result: passed; Git emitted line-ending normalization warnings only.
- `git diff --check`
  - Result: passed; Git emitted line-ending normalization warnings only.
- Targeted renderer boundary search:
  - `Get-ChildItem -Path apps/runtime-player/src/control,apps/runtime-player/src/stage -Recurse -Include *.ts,*.tsx | Select-String -Pattern ...`
  - Result: no renderer `electron`, `node:`, `ipcRenderer`, or `BrowserWindow` hits.
- Targeted Editor import search:
  - `Get-ChildItem -Path apps/runtime-player/src -Recurse -Include *.ts,*.tsx | Select-String -Pattern 'apps/editor','../editor','../../editor'`
  - Result: no hits.

Blocked or failed:

- `pnpm.cmd --filter @private-2d-rigging-lab/runtime-player typecheck`
  - Result: failed with `TS2307: Cannot find module '@private-2d-rigging-lab/package-format' or its corresponding type declarations`.
  - A direct check showed `apps/runtime-player/node_modules/@private-2d-rigging-lab/package-format` is missing.
- `pnpm.cmd --filter @private-2d-rigging-lab/runtime-player exec vitest run -c vitest.config.ts src/main/runtime-export-loader/runtime-export-directory-loader.test.ts`
  - First sandboxed attempt failed with `spawn EPERM` while loading Vitest config through esbuild.
  - Escalated rerun reached Vitest and failed because `@private-2d-rigging-lab/package-format` is not linked.
- Full `test:unit` was not run after the focused loader test confirmed the same dependency-link block.

Required user action before typecheck/unit verification can complete:

- Run dependency installation/linking for the workspace, for example `pnpm install`, so the new `@private-2d-rigging-lab/package-format` dependency is linked into `apps/runtime-player/node_modules`.

`pnpm install` was not run by this reviewer, per instruction.

## Remaining Risks

- After the workspace dependency link is restored, `typecheck` and Runtime Player unit tests still need to be rerun.
- The current tests use rights-clean synthetic fixtures and do not depend on real user artifacts, which is appropriate for Domain A. Manual verification with a real user Runtime Export remains useful after dependency linking and after the missing negative tests are added.

## Post-Fix Review

Final verdict: `pass`

The previous test adequacy findings are resolved in source:

- Loader negative coverage now includes missing referenced `runtime/model.json` at `apps/runtime-player/src/main/runtime-export-loader/runtime-export-directory-loader.test.ts:58`, missing raw texture page at `:68`, invalid manifest schema at `:97`, invalid model schema at `:114`, invalid atlas schema at `:131`, and missing required capability at `:158`.
- Existing coverage remains for arbitrary directory names at `runtime-export-directory-loader.test.ts:24`, missing manifest at `:49`, invalid JSON at `:83`, missing atlas at `:148`, single-page enforcement at `:179`, raw RGBA byte length at `:197`, digest mismatch at `:211`, and path traversal at `:227`.
- Error/status mapping now has focused pure coverage in `apps/runtime-player/src/main/runtime-export-loader/runtime-export-session-state.test.ts`: `toRuntimeExportLoadError` maps loader errors at `:14`, unexpected errors at `:32`, and `RuntimeExportSessionState` clears stale loaded payloads when entering error state at `:40`.

Post-fix verification:

- `node scripts/check-source-organization.mjs`: passed.
- `node scripts/check-dependencies.mjs`: passed.
- `git diff --check`: passed; Git emitted line-ending normalization warnings only.
- `Test-Path apps/runtime-player/node_modules/@private-2d-rigging-lab/package-format`: `False`.
- `pnpm.cmd --filter @private-2d-rigging-lab/runtime-player typecheck`: blocked by `TS2307` for `@private-2d-rigging-lab/package-format`.
- `pnpm.cmd --filter @private-2d-rigging-lab/runtime-player exec vitest run -c vitest.config.ts src/main/runtime-export-loader/runtime-export-directory-loader.test.ts src/main/runtime-export-loader/runtime-export-session-state.test.ts`: session-state suite passed 3 tests; loader suite was blocked by the same missing `@private-2d-rigging-lab/package-format` link.

No remaining test-adequacy findings. Full typecheck and loader unit execution should be rerun after the user performs dependency linking, for example by running `pnpm install`; this reviewer did not run install per instruction.
