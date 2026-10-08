# Runtime Player Wave12 Final Integration Report

Date: 2026-06-25

## Verdict

Verdict: `pass`.

Runtime Player Wave12 implemented Live Controller Variant Switching and passed final integration review. Domain B aligned the Runtime Player discussion docs with implementation facts, verified forbidden-scope boundaries, ran repository checks, and delegated the clean review to an independent Review-Sylph.

実装事実に合わせて関連ドキュメントを更新する。

## Orchestration

| Role | Agent | Result |
|---|---|---|
| Domain A implementation | Gnome from parent orchestration | `pass`, source/test changes under `apps/runtime-player/src/**` |
| Domain B docs alignment | Gnome the 14th | `done`, docs-only |
| Domain B clean review | Sylph the 15th | `pass`, no findings |
| Domain B final integration | Orch-Sylph | `pass` |

Completed child sessions were closed before this report.

## Files Changed

Runtime Player source/test changes from Domain A:

- `apps/runtime-player/src/control/control-window-app.tsx`
- `apps/runtime-player/src/control/control-window-shell.tsx`
- `apps/runtime-player/src/control/live-controller-page.tsx`
- `apps/runtime-player/src/control/live-controller-page.test.ts`
- `apps/runtime-player/src/main/variant-controller/runtime-variant-bridge-handlers.ts`
- `apps/runtime-player/src/main/variant-controller/runtime-variant-session-state.ts`
- `apps/runtime-player/src/main/variant-controller/runtime-variant-session-state.test.ts`
- `apps/runtime-player/src/shared/runtime-export-variant-selection.ts`
- `apps/runtime-player/src/preload/runtime-variant-bridge-channels.ts`
- `apps/runtime-player/src/preload/runtime-variant-bridge-contract.ts`
- `apps/runtime-player/src/preload/runtime-player-bridge.ts`
- `apps/runtime-player/src/preload/runtime-player-bridge-contract.ts`
- `apps/runtime-player/src/preload/runtime-player-bridge.variants.test.ts`
- `apps/runtime-player/src/preload/runtime-player-stage-bridge.ts`
- `apps/runtime-player/src/preload/runtime-player-stage-bridge-contract.ts`
- `apps/runtime-player/src/preload/runtime-player-stage-bridge.variants.test.ts`
- `apps/runtime-player/src/preload/browser-source-transport-contract.ts`
- `apps/runtime-player/src/main/broadcast-source/browser-source-runtime-export-payload.ts`
- `apps/runtime-player/src/main/broadcast-source/browser-source-server.ts`
- `apps/runtime-player/src/main/broadcast-source/browser-source-server.test.ts`
- `apps/runtime-player/src/main/broadcast-source/browser-source-session.ts`
- `apps/runtime-player/src/main/broadcast-source/browser-source-session.test.ts`
- `apps/runtime-player/src/main/runtime-player-main.ts`
- `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-runtime-graph-adapter.ts`
- `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-pose-evaluator.ts`
- `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-variant-visibility.test.ts`
- `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts`
- `apps/runtime-player/src/stage/stage-renderer/runtime-export-stage-scene.ts`
- `apps/runtime-player/src/stage/stage-renderer/evaluated-runtime-export-stage-scene.ts`
- `apps/runtime-player/src/stage/stage-window-app.tsx`
- `apps/runtime-player/src/stage/stage-window-app.test.ts`
- `apps/runtime-player/src/stage/browser-source/browser-source-server-message.ts`
- `apps/runtime-player/src/stage/browser-source/browser-source-server-message.test.ts`
- `apps/runtime-player/src/stage/browser-source/browser-source-stage-client.ts`
- `apps/runtime-player/src/stage/browser-source/browser-source-stage-client.test.ts`
- `apps/runtime-player/src/stage/browser-source/browser-source-stage-renderer.ts`

Discussion docs and closeout artifacts:

- `discussion/runtime-player/screens/live-controller-page.md`
- `discussion/runtime-player/screens/control-window-screen-structure.md`
- `discussion/runtime-player/backlog/runtime-player-backlog.md`
- `discussion/runtime-player/implementation/orchestration/player-wave12-plan.md`
- `discussion/runtime-player/implementation/orchestration/_map.md`
- `discussion/runtime-player/implementation/waves/wave12/wave12-final-integration-report.md`
- `discussion/runtime-player/implementation/waves/wave12/_map.md`
- `discussion/runtime-player/implementation/reviews/wave12/wave12-final-clean-integration-review.md`
- `discussion/runtime-player/implementation/reviews/wave12/_map.md`

## Integration Check Trace

| Required check | Result | Evidence |
|---|---|---|
| Live Controller page exists in existing Control Window | `pass` | `control-window-shell.tsx` adds `Live Controller` between Overview and Input; no separate window was added. |
| Variant defaults, `singleSelect`, `multiToggle`, reset, clear/reload | `pass` | `runtime-variant-session-state.ts` initializes from Runtime Export defaults, mutates session state, resets to defaults, clears on unload, and reloads another export from that export's defaults. |
| New exports with `baseVisible` switch Variants | `pass` | `runtime-export-variant-selection.ts` evaluates `baseVisible && variantVisibilityPredicate(activeSelection, drawableId)` for ready new exports. |
| Legacy exports without complete `baseVisible` disable switching | `pass` | Variant controller status uses `legacy-export`, disables controls, and gives re-export guidance. |
| Stage Window and Browser Source use same active selection | `pass` | Main publishes one session status; Stage bridge and Browser Source session/client consume the same `activeVariantSelection`. |
| Browser Source reload/resync includes current active selection | `pass` | Browser Source runtime export response and resync messages include `activeVariantSelection`. |
| Browser Source receives no raw tracking/debug/calibration data for Variant switching | `pass` | Browser Source receives Runtime Export payload, sanitized live parameter frame, Stage display state, and active Variant selection. Review and tests found no raw tracking/debug/calibration leakage. |
| Quick actions reuse existing ownership | `pass` | Live Controller calls existing Look Forward, Center Model, and Stage Motion setting update paths. |
| Wave10 native local preview suspension preserved | `pass` | Local preview suspension still gates native Stage live-frame delivery only; Browser Source publication remains active. |
| Runtime Export schema/materialization unchanged | `pass` | Forbidden-scope diff over `packages/package-format`, `packages/authoring-core`, manifests, workspace manifest, and lockfile produced no output. |
| Active Variant selection is session-only | `pass` | No active Variant selection store/persistence path was found; selection resets on load/reload/restart and clears on unload. |
| Docs/maps match implementation facts | `pass` | Live Controller, Control Window structure, backlog, Wave12 report/review maps, and orchestration map were updated within allowed scope. |

## Verification

Commands run by Domain B / reviewers:

| Command | Result |
|---|---|
| `pnpm.cmd --filter @private-2d-rigging-lab/runtime-player typecheck` | Pass |
| `pnpm.cmd --filter @private-2d-rigging-lab/runtime-player test:unit` | Pass: 74 files / 312 tests |
| `pnpm.cmd typecheck` | Pass |
| `node scripts/check-source-organization.mjs` | Pass |
| `node scripts/check-dependencies.mjs` | Pass |
| `git diff --check -- apps/runtime-player/src ...` | Pass with LF-to-CRLF working-copy warnings only |
| docs-only `git diff --check` | Pass with LF-to-CRLF working-copy warnings only |
| Review-Sylph focused Vitest rerun | Pass: 5 files / 30 tests after sandbox `spawn EPERM` rerun with escalation |
| forbidden-scope diff/status checks | Pass: no package-format, authoring-core, manifest, workspace manifest, or lockfile changes |

`pnpm install` was not run.

## Clean Review

- Review artifact: [wave12-final-clean-integration-review.md](../../reviews/wave12/wave12-final-clean-integration-review.md)
- Verdict: `pass`
- Findings: none.

## Residual Risks / Manual Checks

- Electron/native Stage visual parity with a real Runtime Export still needs manual verification.
- OBS Browser Source reload/resync in OBS CEF still needs manual confirmation.
- Real iFacialMocap behavior for Look Forward while live still needs manual confirmation.
- Browser Source transparency/WebGL2/alpha, Stage/Browser Source visible parity, and performance confidence remain manual product checks.
- Legacy export re-export guidance should be manually smoke-tested with an actual pre-`baseVisible` export if one is available.

## User-Decision Points

None blocking.

Future decisions remain deferred:

- whether Player should persist last active Variant selection in a future wave.
- hotkeys / StreamDeck / MIDI.
- separate compact controller window.
- Player-side Variant definition editing.
