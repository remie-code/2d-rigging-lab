# Runtime Player Wave2 Domain A Design / Development Compliance Review

> Target: `runtime-player-wave2-runtime-export-loader-ipc` Domain A  
> Reviewer: Review-Sylph  
> Date: 2026-06-22

## Verdict

`pass`

Design/development compliance has no blocking finding in the reviewed source. Main/preload/control/stage boundaries are respected in the implemented Domain A shape, source organization guard passes, and the dependency addition is scoped to the expected workspace package.

This pass has verification caveats: package-local Runtime Player typecheck and the new loader Vitest suite currently fail in this workspace until the new workspace dependency is materialized by `pnpm install`. The Wave2 plan explicitly says implementation agents must not run install unless asked, so this is recorded as a remaining integration step rather than a source boundary failure.

## Reviewed Scope

- Basis documents:
  - `discussion/runtime-player/implementation/orchestration/player-wave2-plan.md`
  - `discussion/runtime-player/architecture/runtime-player-development-policy.md`
  - `discussion/runtime-player/architecture/technology-stack-decision.md`
  - `discussion/development_convention/source-file-organization-policy.md`
- Direct source/diff inspection:
  - `git status --short -uall`
  - `git diff -- apps/runtime-player pnpm-lock.yaml`
  - Changed/untracked files under `apps/runtime-player/**`
  - `apps/runtime-player/package.json`
  - `pnpm-lock.yaml`

## Findings

### Non-Blocking Risk: Runtime Export payload is sent as a full IPC object

- Severity: Low / contract risk
- References:
  - `apps/runtime-player/src/preload/runtime-export-bridge-contract.ts:49`
  - `apps/runtime-player/src/preload/runtime-export-bridge-contract.ts:55`
  - `apps/runtime-player/src/preload/runtime-export-bridge-contract.ts:57`
  - `apps/runtime-player/src/main/runtime-export-loader/runtime-export-bridge-handlers.ts:80`

`RuntimeExportLoadedPayload` includes the full manifest/model/atlas DTOs plus raw texture bytes as `Uint8Array`, and the main process sends that payload to the Stage Window over IPC. This is a reasonable Domain A contract for a first static render handoff, and it does not expose filesystem handles or Electron objects. However, large Runtime Exports may copy substantial raw RGBA data across process boundaries.

Recommendation: keep this as the explicit Domain A transfer contract for now, but require Domain B/final integration to validate practical payload size with a real export and consider a render-specific DTO, ArrayBuffer-focused transfer shape, or staged loading if IPC cost becomes visible.

### Non-Blocking Risk: Shared preload API is broader than each individual window needs

- Severity: Low / hardening risk
- References:
  - `apps/runtime-player/src/preload/runtime-player-bridge.ts:27`
  - `apps/runtime-player/src/preload/runtime-player-bridge.ts:29`
  - `apps/runtime-player/src/preload/runtime-player-bridge.ts:61`
  - `apps/runtime-player/src/stage/stage-window-app.tsx:21`
  - `apps/runtime-player/src/stage/stage-window-app.tsx:28`

The same preload API is exposed to both Control and Stage windows. Stage production code only calls `getLoadedPayload()` and `onLoadedPayload()`, so the current implementation satisfies the rubric that Stage receives payload through the typed API and does not implement directory picker or traversal logic. Still, the Stage window technically receives the same `runtimeExport.openDirectory()` function that Control uses.

Recommendation: not blocking for Domain A, but consider splitting or capability-gating control-only and stage-only bridge APIs once the Stage renderer contract stabilizes.

### Non-Blocking Risk: Stage-local receipt can become stale after a later load error

- Severity: Low / follow-up risk for Domain B or final integration
- References:
  - `apps/runtime-player/src/main/runtime-export-loader/runtime-export-session-state.ts:55`
  - `apps/runtime-player/src/main/runtime-export-loader/runtime-export-session-state.ts:69`
  - `apps/runtime-player/src/stage/stage-window-app.tsx:14`
  - `apps/runtime-player/src/stage/stage-window-app.tsx:21`
  - `apps/runtime-player/src/stage/stage-window-app.tsx:28`

On load error, main session state clears `#loadedPayload`, but the current Stage component stores only the last successful receipt and does not consume `statusChanged` to clear local display state. This is not a Domain A boundary violation because Stage rendering is still deferred, but Domain B/final integration should ensure the rendered Stage state matches the authoritative main session after failed loads.

## Compliance Notes

- Main owns native dialog and file IO:
  - `dialog.showOpenDialog` is in main at `apps/runtime-player/src/main/runtime-export-loader/runtime-export-bridge-handlers.ts:53`.
  - `node:fs/promises`, `node:path`, and `node:crypto` are used only in main loader/test files, e.g. `apps/runtime-player/src/main/runtime-export-loader/runtime-export-directory-loader.ts:1`.
- Preload exposes typed app methods, not raw Electron objects:
  - `contextBridge.exposeInMainWorld("runtimePlayer", runtimePlayerApi)` at `apps/runtime-player/src/preload/runtime-player-bridge.ts:61`.
  - Raw `ipcRenderer` remains inside preload at `apps/runtime-player/src/preload/runtime-player-bridge.ts:1`.
- Control renderer uses the typed API and has no direct filesystem/Electron imports:
  - `openRuntimeExportDirectory()` calls `window.runtimePlayer.runtimeExport.openDirectory()` at `apps/runtime-player/src/control/control-window-app.tsx:86`.
  - Status/error rendering is local UI state at `apps/runtime-player/src/control/control-window-app.tsx:92` and `apps/runtime-player/src/control/control-window-app.tsx:211`.
- Stage renderer uses the typed payload API and has no picker/traversal logic:
  - Initial snapshot call at `apps/runtime-player/src/stage/stage-window-app.tsx:21`.
  - Loaded payload event subscription at `apps/runtime-player/src/stage/stage-window-app.tsx:28`.
- Renderer direct-import search found no `node:*`, `electron`, `ipcRenderer`, filesystem, or socket imports in `apps/runtime-player/src/control` or `apps/runtime-player/src/stage`.
- Main direct-import search found no React UI module imports under `apps/runtime-player/src/main`.
- Source organization is acceptable:
  - New runtime export loader concerns are split across loader, bridge handlers, paths, errors, and session state.
  - No substantial implementation was added to `index.ts`.
  - No broad `types.ts`, `utils.ts`, `helpers.ts`, or `common.ts` catch-all file was added.
- Dependency change is scoped:
  - `apps/runtime-player/package.json:17` adds only `@private-2d-rigging-lab/package-format` as `workspace:*`.
  - `pnpm-lock.yaml` diff for Runtime Player adds the corresponding workspace link entry only.

## Verification Commands Run

- `git status --short -uall`
  - Observed modified Runtime Player files, `pnpm-lock.yaml`, and untracked Domain A runtime export loader files.
  - Also observed unrelated `discussion/implementation/**` changes; those were not part of this review.
- `git diff -- apps/runtime-player pnpm-lock.yaml`
  - Inspected main/preload/control/stage/package diff.
- `git diff --check -- apps/runtime-player pnpm-lock.yaml`
  - Passed; only Git CRLF conversion warnings were printed.
- `node scripts/check-source-organization.mjs`
  - Passed.
- `node scripts/check-dependencies.mjs`
  - Passed.
- `pnpm.cmd typecheck`
  - Passed, but root `tsconfig.json` includes `packages/**` and does not cover `apps/runtime-player/**`.
- `pnpm.cmd --filter @private-2d-rigging-lab/runtime-player typecheck`
  - Failed: `TS2307 Cannot find module '@private-2d-rigging-lab/package-format'`.
  - Cause appears to be missing local workspace dependency link after `package.json` change.
- `pnpm.cmd exec vitest run apps/runtime-player/src/main/runtime-export-loader/runtime-export-directory-loader.test.ts apps/runtime-player/src/main/placeholder-action-state.test.ts`
  - First sandboxed run failed with `spawn EPERM` while starting esbuild.
  - Re-run with elevated execution started Vitest.
  - `placeholder-action-state.test.ts` passed.
  - `runtime-export-directory-loader.test.ts` failed because `@private-2d-rigging-lab/package-format` could not be resolved.
- Cross-boundary searches:
  - Renderer forbidden import search: matches were limited to main/preload/test files; no control/stage direct Node/Electron imports were found.
  - Main React/UI import search: no matches under `apps/runtime-player/src/main`.

## Remaining Risks / Decision Points

- Parent/user must decide when to run `pnpm install` to materialize the new Runtime Player workspace dependency. Until then, package-local Runtime Player typecheck and loader tests cannot complete in this workspace.
- Domain B must either render/fail-fast required capabilities such as clipping according to Wave2 policy, using `summary.requiredCapabilities` and the full loaded artifacts, or explicitly narrow the accepted capability set before reporting load success.
- Domain B/final integration should validate whether the raw RGBA IPC payload size is acceptable with the user's real Runtime Export.
- Domain B/final integration should ensure Stage display state is cleared or kept intentionally consistent after a failed load following a successful load.
