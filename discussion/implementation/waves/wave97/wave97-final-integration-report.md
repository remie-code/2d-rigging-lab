# Wave97 Final Integration Report: Viewer Dynamics Idle Playback Throttle

## Verdict

Verdict: `pass`.

Wave97 is pass-ready. Domain A implemented the Viewer Dynamics idle playback throttle, all three independent Domain A review lanes passed, and the final clean integration Review-Sylph passed with no required fixes.

## Basis

- `discussion/implementation/orchestration/wave97-plan.md`
- `discussion/implementation/orchestration/wave96-plan.md`
- `discussion/implementation/waves/wave96/wave96-final-integration-report.md`
- `.agents/skills/implementation-orchestration/SKILL.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/operation-policy.md`

## Domain Verdicts

| Domain | Verdict | Evidence |
|---|---|---|
| Domain A: `wave97-viewer-dynamics-idle-playback-throttle` | `pass` | `wave97-domain-a-viewer-dynamics-idle-playback-throttle-report.md`; spec, design/development, and test adequacy reviews all passed. |
| Domain B: `wave97-final-integration-clean-review` | `pass` | `../../reviews/wave97/wave97-final-clean-integration-review.md` passed with no required fixes. |

## Files Changed

Source and tests:

- `apps/editor/src/workspace/viewer/viewer-runtime-playback.ts`
- `apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx`
- `apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts`

Wave97 reports and reviews:

- `discussion/implementation/waves/wave97/wave97-domain-a-viewer-dynamics-idle-playback-throttle-report.md`
- `discussion/implementation/waves/wave97/wave97-final-integration-report.md`
- `discussion/implementation/waves/wave97/_map.md`
- `discussion/implementation/reviews/wave97/wave97-domain-a-spec-compliance-review.md`
- `discussion/implementation/reviews/wave97/wave97-domain-a-design-development-review.md`
- `discussion/implementation/reviews/wave97/wave97-domain-a-test-adequacy-review.md`
- `discussion/implementation/reviews/wave97/wave97-final-clean-integration-review.md`
- `discussion/implementation/reviews/wave97/_map.md`

Pre-existing dirty artifacts observed outside Wave97 implementation ownership:

- `discussion/implementation/orchestration/_map.md`
- `discussion/implementation/orchestration/wave97-plan.md`
- `discussion/runtime-player/implementation/_map.md`
- `discussion/runtime-player/implementation/orchestration/_map.md`
- `discussion/runtime-player/implementation/orchestration/player-wave2-plan.md`

## Integration Summary

- Viewer Dynamics playback no longer runs a permanent `requestAnimationFrame` loop only because enabled Dynamics Groups exist.
- Playback starts when evaluation is needed, keeps at most one pending rAF, continues while Dynamics are not settled, and stops after convergence.
- The final settled `runtimePlaybackState` is retained so Clean Stage projection and `resolveViewerRuntimeParameterValues(...)` continue to use the stable runtime state.
- Restart conditions include runtime parameter signature changes, manual Reset simulation, runtime model/session/package identity changes, enabled Dynamics availability changes, and missing or incompatible runtime state.
- Settled detection is Viewer-side and uses named conservative constants for minimum evaluated frames, angular velocity, source velocity, angle/source distance, and output/target distance.
- Reset simulation creates a manual runtime initial state and restarts playback without clearing Runtime Controls overrides.
- Frame evaluation still goes through `evaluateViewerRuntimePlaybackFrame(...)`; the runtime-core Dynamics solver formula was not changed.
- Original / Atlas Runtime render-source paths were not changed.

## Verification

Fresh final-integration checks run by Orch-Sylph:

| Check | Result |
|---|---|
| `pnpm.cmd exec vitest run apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts apps/editor/src/workspace/viewer/runtime-controls-state.test.ts` | Pass: 2 files / 35 tests. |
| `pnpm.cmd typecheck` | Pass. |
| `node scripts/check-source-organization.mjs` | Pass: `Source organization guard passed.` |
| `node scripts/check-dependencies.mjs` | Pass: `Dependency guard passed.` |
| `git diff --check` | Pass. LF-to-CRLF working-copy warnings only; no whitespace errors. |

Independent review verification:

- Domain A spec compliance Review-Sylph reran focused Viewer / Runtime Controls tests, typecheck, source organization, dependency guard, diff check, and forbidden-scope check: pass.
- Domain A design/development Review-Sylph reran focused Viewer tests, Runtime Controls tests, typecheck, source organization, dependency guard, diff check, and forbidden-scope checks: pass.
- Domain A test adequacy Review-Sylph reran focused Viewer / Runtime Controls tests and scoped diff check: pass.
- Final clean Review-Sylph reran focused Viewer / Runtime Controls tests, typecheck, source organization, dependency guard, diff check, and forbidden-scope checks: pass.

## Forbidden-Scope Result

Forbidden-scope verdict: `pass`.

Scoped tracked and untracked/status checks were empty for:

- dependency manifests and `pnpm-lock.yaml`;
- `packages/runtime-core/src/**` Dynamics solver paths;
- `packages/package-format/**`;
- Runtime Export paths;
- Workspace Save / export paths covered by the Wave97 forbidden path set;
- Texture Atlas / Atlas Runtime source cache paths;
- Runtime Player app paths;
- mesh generation and package schema paths covered by the Wave97 forbidden path set.

No Dynamics solver formula, Runtime Export format, Workspace Save format, Texture Atlas / Atlas Runtime source cache, Runtime Player app, package-format schema, mesh generation, dependency, or lockfile drift was found.

Unrelated dirty Runtime Player planning/map documentation under `discussion/runtime-player/implementation/**` was observed and kept outside Wave97 ownership. It is documentation/orchestration state, not Runtime Player app/source drift.

## Review Results

| Review | Verdict | Path |
|---|---|---|
| Domain A Spec Compliance Review | `pass` | `discussion/implementation/reviews/wave97/wave97-domain-a-spec-compliance-review.md` |
| Domain A Design / Development Compliance Review | `pass` | `discussion/implementation/reviews/wave97/wave97-domain-a-design-development-review.md` |
| Domain A Test Adequacy Review | `pass` | `discussion/implementation/reviews/wave97/wave97-domain-a-test-adequacy-review.md` |
| Final Clean Integration Review | `pass` | `discussion/implementation/reviews/wave97/wave97-final-clean-integration-review.md` |

## Residual Risks

- Browser CPU profiling was not run. Focused rAF tests prove the Dynamics playback loop itself becomes idle after convergence.
- Browser pixel proof was not run. Existing Viewer projection/runtime behavior tests passed, and the diff does not touch render-source, atlas, solver, export, runtime-player app, or renderer code.
- Extremely slow future Dynamics presets may need threshold tuning with model-specific evidence. Current thresholds favor extra frames over premature visible motion cutoff.
- `viewer-runtime-screen.test.ts` is larger after adding the interactive fake DOM/rAF harness, but it remains responsibility-specific and the source organization guard passes.

## User-Decision Points

None blocking.
