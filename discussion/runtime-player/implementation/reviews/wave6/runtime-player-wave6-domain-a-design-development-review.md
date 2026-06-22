# Runtime Player Wave6 Domain A Design / Development Compliance Review

> Target: `runtime-player-wave6-input-profile-position-calibration`  
> Lane: Design / Development Compliance Review  
> Verdict: `pass`

## Scope Reviewed

Reviewed source and tests directly, not only the Domain A report.

- Preload contract: `apps/runtime-player/src/preload/input-profile-bridge-contract.ts`
- Control UI: `apps/runtime-player/src/control/control-window-app.tsx`, `apps/runtime-player/src/control/input-page.tsx`
- Main profile/session state and bridge: `apps/runtime-player/src/main/input-session-state.ts`, `apps/runtime-player/src/main/input-profile-bridge-handlers.ts`, `apps/runtime-player/src/main/input-profile-bridge-request-validation.ts`
- Input profile documents/calibration: `apps/runtime-player/src/main/input-profiles/input-profile-document.ts`, `input-profile-document-parser.ts`, `input-profile-calibration-sections.ts`, `input-profile-calibration-start.ts`, `input-profile-calibration-session.ts`
- Focused tests listed in the Domain A request.

## Basis Documents Used

- `discussion/runtime-player/implementation/orchestration/player-wave6-plan.md`
- `discussion/runtime-player/architecture/runtime-player-development-policy.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/runtime-player/implementation/waves/wave6/runtime-player-wave6-domain-a-input-profile-position-calibration-report.md`

## Findings

No blocking or needs-change findings.

### Info: calibration session file is large but cohesive

`apps/runtime-player/src/main/input-profiles/input-profile-calibration-session.ts` is 851 lines. It has a named, cohesive responsibility and the source organization guard passes, so this is not blocking. If Domain B or a later wave extends calibration behavior further, split prompt definitions/evaluation/range math before adding more responsibility to this file.

## Compliance Notes

- Process boundaries are preserved. Control renderer calls `window.runtimePlayer.inputProfile.*` from `apps/runtime-player/src/control/control-window-app.tsx:448` and `apps/runtime-player/src/control/input-page.tsx:225`, `:246`, `:257`; it does not directly import Node/Electron APIs. `rg` found no `node:`, `electron`, `ipcRenderer`, `contextBridge`, or `require(` under `apps/runtime-player/src/control` or `apps/runtime-player/src/stage`.
- Preload remains a narrow typed bridge. The contract adds calibration mode/section and optional `headPositionRaw` fields in `apps/runtime-player/src/preload/input-profile-bridge-contract.ts:33`, `:58`, `:63`, `:138`, `:157`; runtime exposure remains named API methods in `apps/runtime-player/src/preload/runtime-player-bridge.ts`.
- Main owns persistence and calibration state. IPC handlers validate/start/finish calibration in `apps/runtime-player/src/main/input-profile-bridge-handlers.ts:117`, `:180`, and save via `store.saveProfile` at `:225`. Profile parsing keeps `headPositionRaw` optional/backward-compatible at `apps/runtime-player/src/main/input-profiles/input-profile-document-parser.ts:145`.
- Stage remains model-only for this domain. No Stage source is in the Domain A source change set, and no Body Auto Mapping, body runtime value generation, Stage scale/translation, Broadcast/OBS, VMC/OSC, or persistent Model Mapping Profile behavior was introduced.
- Source organization is acceptable. New files have specific responsibility names, no new catch-all `types.ts`/`utils.ts`/`helpers.ts`/`schemas.ts` or substantial `index.ts` implementation was found, and `node scripts/check-source-organization.mjs` passed.
- Dependency scope is clean. `git diff --name-only -- package.json apps/runtime-player/package.json pnpm-lock.yaml` returned no files, and `node scripts/check-dependencies.mjs` passed. No `pnpm install` was run.
- Request validation is cohesive. `readStartCalibrationRequest` validates mode/section combinations in `apps/runtime-player/src/main/input-profile-bridge-request-validation.ts:21`, and focused validation tests cover malformed requests and mode/section rules in `apps/runtime-player/src/main/input-profile-bridge-request-validation.test.ts:22`, `:31`.

## Verification Performed

- Read all basis documents listed above.
- Read all requested changed source/test files directly.
- Ran `node scripts/check-source-organization.mjs`: pass.
- Ran `node scripts/check-dependencies.mjs`: pass.
- Ran `git status --short -uall`: confirmed no `apps/editor/**`, `packages/**`, `node_modules/**`, or package manifest/lockfile changes in the source review scope. The workspace also contains broader discussion map/backlog edits and untracked `test_data/iFaceMocap/*.json`; this lane did not attribute those to Domain A implementation source.
- Ran `git diff --check -- apps/runtime-player/src discussion/runtime-player/implementation/waves/wave6`: pass, with Git LF-to-CRLF working-copy warnings only.
- Ran `git diff --name-only -- package.json apps/runtime-player/package.json pnpm-lock.yaml`: no output.
- Ran boundary searches for renderer Node/Electron access, main React/UI imports, forbidden Wave6 terms, and catch-all file names.

## Remaining Issues

- Real Electron Control Window interaction and real iFacialMocap capture were not manually exercised by this lane.
- The 851-line calibration session file is acceptable for Domain A, but should not become the place for Domain B body follow runtime behavior.

## User-Decision Points

None.

## Domain B Start Decision

From this Design / Development Compliance lane's perspective, Domain B can start. There is no process-boundary, source-organization, dependency, IPC-contract, or forbidden-scope blocker in Domain A.
