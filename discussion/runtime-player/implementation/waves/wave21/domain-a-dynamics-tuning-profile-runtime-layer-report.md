# Runtime Player Wave21 Domain A Report: Dynamics Tuning Profile / Effective Runtime Graph

## Verdict

- Verdict: pass
- Fix cycles: 2
- Domain owner: Orch-Sylph
- Source implementation: delegated to Gnome
- Review: delegated to independent Review-Sylph lanes

## Scope Completed

- Added Runtime Player-owned dynamics tuning profile persistence under `userData/dynamics-tuning-profiles/<safePackageId>/<fingerprint>.json`.
- Added profile identity/signature handling with `schemaVersion`, timestamps, export identity, `dynamicsSignatureHash`, revision, and group-keyed overrides.
- Added effective dynamics composition that layers runtime tuning over exported base dynamics without mutating Runtime Export artifacts.
- Applied effective tuning before runtime-core graph compile/evaluation.
- Added Runtime Evaluation Cache keying/invalidation on tuning revision/fingerprint/signature.
- Synchronized effective tuning to Native Stage and Browser Source through separate tuning/profile transport fields and messages.
- Added narrow bridge/backend contract scaffolding for Domain B consumption without implementing the Control Window `Dynamics Tune` page.

## Source Files Changed

- `apps/runtime-player/src/main/dynamics-tuning-profiles/**`
- `apps/runtime-player/src/main/dynamics-tuning-bridge-handlers.ts`
- `apps/runtime-player/src/main/dynamics-tuning-bridge-request-validation.ts`
- `apps/runtime-player/src/main/runtime-player-main.ts`
- `apps/runtime-player/src/main/broadcast-source/browser-source-runtime-export-payload.ts`
- `apps/runtime-player/src/main/broadcast-source/browser-source-server.ts`
- `apps/runtime-player/src/main/broadcast-source/browser-source-session.ts`
- `apps/runtime-player/src/preload/dynamics-tuning-bridge-channels.ts`
- `apps/runtime-player/src/preload/dynamics-tuning-bridge-contract.ts`
- `apps/runtime-player/src/preload/browser-source-transport-contract.ts`
- `apps/runtime-player/src/preload/runtime-player-bridge-contract.ts`
- `apps/runtime-player/src/preload/runtime-player-bridge.ts`
- `apps/runtime-player/src/preload/runtime-player-stage-bridge-contract.ts`
- `apps/runtime-player/src/preload/runtime-player-stage-bridge.ts`
- `apps/runtime-player/src/stage/runtime-evaluation/effective-dynamics-tuning.ts`
- `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-pose-evaluator.ts`
- `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-runtime-graph-adapter.ts`
- `apps/runtime-player/src/stage/stage-renderer/evaluated-runtime-export-stage-scene.ts`
- `apps/runtime-player/src/stage/stage-renderer/runtime-export-evaluation-cache.ts`
- `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts`
- `apps/runtime-player/src/stage/stage-window-app.tsx`
- `apps/runtime-player/src/stage/browser-source/browser-source-server-message.ts`
- `apps/runtime-player/src/stage/browser-source/browser-source-stage-client.ts`
- `apps/runtime-player/src/stage/browser-source/browser-source-stage-renderer.ts`

## Tests Added / Updated

- `apps/runtime-player/src/main/dynamics-tuning-profiles/dynamics-tuning-profile-store.test.ts`
- `apps/runtime-player/src/main/dynamics-tuning-profiles/dynamics-tuning-state.test.ts`
- `apps/runtime-player/src/main/dynamics-tuning-profiles/dynamics-tuning-profile-save-controller.test.ts`
- `apps/runtime-player/src/main/dynamics-tuning-bridge-handlers.test.ts`
- `apps/runtime-player/src/stage/runtime-evaluation/effective-dynamics-tuning.test.ts`
- `apps/runtime-player/src/stage/stage-renderer/runtime-export-evaluation-cache.test.ts`
- `apps/runtime-player/src/main/broadcast-source/browser-source-session.test.ts`
- `apps/runtime-player/src/stage/browser-source/browser-source-stage-client.test.ts`

## Review Lanes

| Lane | Final verdict | Report |
|---|---|---|
| Spec compliance | pass | `discussion/runtime-player/implementation/reviews/wave21/domain-a-spec-compliance-review.md` |
| Design/development compliance | pass | `discussion/runtime-player/implementation/reviews/wave21/domain-a-design-development-review.md` |
| Test adequacy | pass after fix cycle 2 | `discussion/runtime-player/implementation/reviews/wave21/domain-a-test-adequacy-review.md` |

## Fix Cycle History

1. Test adequacy review found missing coverage for update/reset -> debounced save -> profile persistence.
2. Fix cycle 1 added save-controller persistence coverage with explicit `flush()`.
3. Test adequacy rereview found that debounce timer and bridge scheduling were still unguarded.
4. Fix cycle 2 added fake-timer debounce persistence coverage and bridge handler update/reset scheduling coverage.
5. Final test adequacy rereview passed.

## Verification

- `.\\node_modules\\.bin\\vitest.cmd run apps/runtime-player/src/main/dynamics-tuning-profiles/dynamics-tuning-profile-save-controller.test.ts apps/runtime-player/src/main/dynamics-tuning-bridge-handlers.test.ts apps/runtime-player/src/main/dynamics-tuning-profiles/dynamics-tuning-profile-store.test.ts apps/runtime-player/src/main/dynamics-tuning-profiles/dynamics-tuning-state.test.ts apps/runtime-player/src/stage/runtime-evaluation/effective-dynamics-tuning.test.ts apps/runtime-player/src/stage/stage-renderer/runtime-export-evaluation-cache.test.ts apps/runtime-player/src/main/broadcast-source/browser-source-session.test.ts apps/runtime-player/src/stage/browser-source/browser-source-stage-client.test.ts`: pass, 8 files / 35 tests.
- `.\\node_modules\\.bin\\tsc.CMD --noEmit -p apps/runtime-player/tsconfig.json`: pass.
- `pnpm.cmd --filter @private-2d-rigging-lab/runtime-player typecheck`: pass earlier before fix cycles. Later direct `tsc` was used because `pnpm exec` attempted a deps/install path in this environment.
- `git diff --check -- apps/runtime-player`: pass, CRLF warnings only.
- `node scripts/check-source-organization.mjs`: pass.
- `git diff --name-only -- packages apps/editor package.json pnpm-lock.yaml`: no output.

## Commands Not Run / Notes

- `pnpm install`: not run intentionally; forbidden for this wave.
- Full repo test/build: not run. Domain A used focused Runtime Player tests plus Runtime Player typecheck/direct `tsc`.
- A failed `pnpm.cmd exec vitest ...` attempt tried an internal install/deps-status path and aborted before installing; a generated `.pnpm-store/v11/index.db` artifact was removed.

## Remaining Manual Checks

- Open a real Runtime Export with visible dynamics and confirm Native Stage tuning affects live motion.
- Restart Runtime Player and confirm tuning restores.
- Switch to a different Runtime Export and confirm stale tuning does not apply.
- Confirm OBS Browser Source receives the same effective tuning as Native Stage.
- Reset a tuned group and confirm behavior returns to exported defaults.
- Confirm Runtime Export artifacts remain unmodified on disk.

## Unresolved Decisions / Risks

- No user decision is required for Domain A.
- The Control Window `Dynamics Tune` page remains Domain B scope.
- Manual Electron/OBS parity remains for final integration.
