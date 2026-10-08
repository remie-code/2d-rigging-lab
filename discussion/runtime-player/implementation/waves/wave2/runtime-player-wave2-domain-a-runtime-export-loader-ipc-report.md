# Runtime Player Wave2 Domain A Report: Runtime Export Loader + IPC

> Target: `runtime-player-wave2-runtime-export-loader-ipc`  
> Date: 2026-06-22  
> Domain owner: Orch-Sylph

## Verdict

`pass`

Domain A implementation and post-fix review gates pass for Runtime Export selection,
validation, file loading, Control status/error UI, and typed Stage payload delivery.

Post-install follow-up: after the user ran `pnpm install`, a real TypeScript
formatter issue surfaced in Domain A loader error-detail formatting. The issue
was fixed by accepting `PropertyKey` path segments from Zod issues and
stringifying them safely. Runtime Player typecheck now passes.

## Scope Completed

- Added Runtime Export loader dependency metadata:
  - `apps/runtime-player/package.json`
  - `pnpm-lock.yaml`
- Added main-process Runtime Export loader and native directory picker IPC:
  - reads `runtime-export.json`
  - reads `runtime/model.json`
  - reads the manifest v0 raw RGBA texture page
  - reads `runtime/atlas.json`
  - validates path containment under the selected directory
  - validates v0 single-page artifacts, required load capabilities, byte length, and SHA-256 digest
- Added typed preload Runtime Export API:
  - `runtimeExport.openDirectory()`
  - `runtimeExport.getStatus()`
  - `runtimeExport.getLoadedPayload()`
  - `runtimeExport.onStatusChanged(callback)`
  - `runtimeExport.onLoadedPayload(callback)`
- Updated Control Window to show loading, loaded, and error status for Runtime Export.
- Updated Stage Window to receive loaded payload through typed bridge only.
  - Stage does not render WebGL/static model in Domain A.
  - Loaded receipt is non-visual plumbing through state/data attributes.
- Removed stale Wave1 `open-runtime-export` placeholder action so the real typed API is the open/load path.
- Added focused loader and session/error tests.

## Files Changed

Runtime Player source and tests:

- `apps/runtime-player/package.json`
- `apps/runtime-player/src/control/control-window-app.tsx`
- `apps/runtime-player/src/main/placeholder-action-state.ts`
- `apps/runtime-player/src/main/placeholder-action-state.test.ts`
- `apps/runtime-player/src/main/runtime-player-main.ts`
- `apps/runtime-player/src/main/runtime-export-loader/runtime-export-bridge-handlers.ts`
- `apps/runtime-player/src/main/runtime-export-loader/runtime-export-directory-loader.ts`
- `apps/runtime-player/src/main/runtime-export-loader/runtime-export-directory-loader.test.ts`
- `apps/runtime-player/src/main/runtime-export-loader/runtime-export-errors.ts`
- `apps/runtime-player/src/main/runtime-export-loader/runtime-export-paths.ts`
- `apps/runtime-player/src/main/runtime-export-loader/runtime-export-session-state.ts`
- `apps/runtime-player/src/main/runtime-export-loader/runtime-export-session-state.test.ts`
- `apps/runtime-player/src/preload/runtime-export-bridge-channels.ts`
- `apps/runtime-player/src/preload/runtime-export-bridge-contract.ts`
- `apps/runtime-player/src/preload/runtime-player-bridge-contract.ts`
- `apps/runtime-player/src/preload/runtime-player-bridge.ts`
- `apps/runtime-player/src/stage/stage-window-app.tsx`

Dependency metadata:

- `pnpm-lock.yaml`

Reports and maps:

- `discussion/runtime-player/implementation/waves/wave2/runtime-player-wave2-domain-a-runtime-export-loader-ipc-report.md`
- `discussion/runtime-player/implementation/waves/wave2/_map.md`
- `discussion/runtime-player/implementation/reviews/wave2/runtime-player-wave2-domain-a-spec-compliance-review.md`
- `discussion/runtime-player/implementation/reviews/wave2/runtime-player-wave2-domain-a-design-development-review.md`
- `discussion/runtime-player/implementation/reviews/wave2/runtime-player-wave2-domain-a-test-adequacy-review.md`
- `discussion/runtime-player/implementation/reviews/wave2/_map.md`

Observed but not part of Domain A:

- Existing `apps/editor/**` and `discussion/implementation/**` worktree changes were present during final review.
- They were not edited or attributed to this Domain A loop.

## Loader Contract Shape

Renderer-facing API:

```ts
window.runtimePlayer.runtimeExport.openDirectory();
window.runtimePlayer.runtimeExport.getStatus();
window.runtimePlayer.runtimeExport.getLoadedPayload();
window.runtimePlayer.runtimeExport.onStatusChanged(callback);
window.runtimePlayer.runtimeExport.onLoadedPayload(callback);
```

Loaded payload shape:

```ts
{
  artifacts: { manifest, model, atlas },
  texturePage: { metadata, bytes },
  summary,
  loadedAtIso
}
```

Open result shape:

```ts
{ result: "canceled", runtimeExport }
{ result: "loaded", runtimeExport }
{ result: "error", runtimeExport }
```

## Validation Implemented

- Directory name is not used as a validity oracle.
- A selected directory is valid only if `runtime-export.json` parses as Runtime Export manifest v0.
- Runtime Export is separate from Workspace Save; no `workspace.json` or Editor workspace input is opened.
- Artifact paths are package-relative and resolved under the selected directory.
- Path traversal and absolute/outside-directory resolution are rejected.
- Required artifacts are read in Domain A order:
  1. `runtime-export.json`
  2. `runtime/model.json`
  3. raw RGBA texture page path from the manifest
  4. `runtime/atlas.json`
- v0 single texture page is enforced.
- Required load capabilities are checked.
- Runtime Export artifacts are parsed and checked through package-format Runtime Export schemas.
- Raw RGBA byte length must match metadata and `width * height * 4`.
- SHA-256 digest is checked against manifest texture metadata.
- `model.meshes[].atlasUvs` are carried through in the loaded model payload; no UV recomputation is implemented.

## Tests Added

- Valid load from an arbitrary directory name.
- Missing `runtime-export.json`.
- Missing referenced `runtime/model.json`.
- Missing referenced raw RGBA texture page.
- Missing referenced `runtime/atlas.json`.
- Invalid JSON in a referenced artifact.
- Invalid manifest schema.
- Invalid model schema.
- Invalid atlas schema.
- Missing required Runtime Export load capability.
- Unsupported v0 multi-page Runtime Export.
- Raw RGBA byte length mismatch.
- Raw RGBA digest mismatch.
- Path traversal rejection.
- Loader error DTO mapping.
- Runtime Export session loading/loaded/error state and stale payload clearing.

## Review Summary

Review agents started:

- Gnome implementation agent: `Gnome the 2nd`
- Spec Compliance Review: `Sylph the 3rd`
- Design / Development Compliance Review: `Sylph the 4th`
- Test Adequacy Review: `Sylph the 5th`
- Follow-up typecheck fix agent: `Gnome the 5th`
- Follow-up typecheck review: `Sylph the 6th`

Review results:

| Review | Final Verdict | Notes |
|---|---|---|
| Spec Compliance | `pass` | Initial findings about visible Stage loaded label and stale placeholder open action were fixed. |
| Design / Development Compliance | `pass` | No blocking boundary findings. Noted IPC payload size, shared preload breadth, and Stage stale-receipt follow-up risks. |
| Test Adequacy | `pass` | Initial missing negative tests and error-state test coverage were fixed. |
| Post-install Typecheck Follow-Up | `pass` | `formatParseIssues` now accepts `PropertyKey[]`; Runtime Player typecheck passes. |

## Post-Install Follow-Up

After dependency linking, `pnpm.cmd --filter @private-2d-rigging-lab/runtime-player typecheck`
reported that `formatParseIssues(result.issues)` was too narrow for
`z.ZodIssue[]`; Zod issue paths are `PropertyKey[]`, not only
`(string | number)[]`.

Fix applied:

- `apps/runtime-player/src/main/runtime-export-loader/runtime-export-directory-loader.ts`
  now formats parse issue paths from `readonly PropertyKey[]`.
- Path segments are converted with `String(segment)` before joining.
- Runtime Export validation behavior is unchanged; only error-detail formatting changed.

## Verification Performed

Passed:

- `node scripts/check-source-organization.mjs`
- `node scripts/check-dependencies.mjs`
- `git diff --check`
- `pnpm.cmd --filter @private-2d-rigging-lab/runtime-player typecheck`
- Renderer boundary source inspection/search for Control/Stage direct Node/Electron/raw IPC imports.
- `pnpm.cmd --filter @private-2d-rigging-lab/runtime-player test:unit`
  - Gnome follow-up run: pass, 5 files / 27 tests.
  - Follow-up review run: sandbox first hit esbuild `spawn EPERM`; elevated rerun passed, 5 files / 27 tests.

Orch-Sylph parent-session caveat:

- Parent-session sandboxed `pnpm.cmd --filter @private-2d-rigging-lab/runtime-player test:unit`
  still hit Vitest/esbuild `spawn EPERM`.
- Parent-session elevated rerun was rejected by the approval policy, so the parent
  could not independently reproduce the passing unit-test run. The passing unit-test
  evidence comes from Gnome and Review-Sylph child sessions.

## Remaining Risks / Next Domain Notes

- Domain B must implement static Stage rendering or fail fast for unsupported render capabilities, especially clipping.
- Domain B/final integration should check practical IPC payload size with the user's real Runtime Export because Domain A sends full artifacts plus raw texture bytes.
- Domain B/final integration should ensure Stage display state is reconciled after a failed load following a successful load.
- Runtime Player still does not implement iFacialMocap, parameter runtime, dynamics runtime, previous export restore, or Runtime Export mutation.
