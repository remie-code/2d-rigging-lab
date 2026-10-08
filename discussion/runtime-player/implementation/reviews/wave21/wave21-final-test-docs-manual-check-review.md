# Runtime Player Wave21 Final Test/Docs/Manual-Check Review

- Verdict: pass

## Scope reviewed

- Wave21 plan, Domain A/B implementation reports, and Domain A/B Review-Sylph reports.
- Current Runtime Player docs/maps under `discussion/runtime-player/_map.md`, `screens/`, `architecture/`, `backlog/`, and `implementation/`.
- Focused Wave21 Runtime Player test files for dynamics profile persistence/state, effective dynamics layering, evaluation cache invalidation, Browser Source sync/client handling, and Control Window `Dynamics Tune` UI/bridge wiring.
- Lightweight source/docs guards only. I did not run `pnpm install`, broad build, broad test, Electron, or OBS manual checks.

## Basis documents used

- `discussion/runtime-player/implementation/orchestration/player-wave21-plan.md`
- `discussion/runtime-player/implementation/orchestration/runtime-player-wave-planning-conventions.md`
- `discussion/runtime-player/implementation/waves/wave21/domain-a-dynamics-tuning-profile-runtime-layer-report.md`
- `discussion/runtime-player/implementation/waves/wave21/domain-b-dynamics-tune-control-page-report.md`
- `discussion/runtime-player/implementation/waves/wave21/_map.md`
- `discussion/runtime-player/implementation/reviews/wave21/_map.md`
- Domain A/B review reports under `discussion/runtime-player/implementation/reviews/wave21/`
- Current docs/maps under `discussion/runtime-player/_map.md`, `discussion/runtime-player/screens/`, `discussion/runtime-player/architecture/`, `discussion/runtime-player/backlog/`, and `discussion/runtime-player/implementation/`
- Focused tests under `apps/runtime-player/src/main/dynamics-tuning-profiles/`, `apps/runtime-player/src/main/dynamics-tuning-bridge-handlers.test.ts`, `apps/runtime-player/src/stage/runtime-evaluation/effective-dynamics-tuning.test.ts`, `apps/runtime-player/src/stage/stage-renderer/runtime-export-evaluation-cache.test.ts`, `apps/runtime-player/src/main/broadcast-source/browser-source-session.test.ts`, `apps/runtime-player/src/stage/browser-source/browser-source-stage-client.test.ts`, `apps/runtime-player/src/control/dynamics-tune-page.test.ts`, `apps/runtime-player/src/control/control-window-app.dynamics-tune.test.ts`, and `apps/runtime-player/src/control/live-controller-page.test.ts`.

## Findings

No blocking or needs-change findings.

The remaining gaps are manual product checks, not deterministic source/docs review failures. Current maps and docs explicitly keep real-device Electron / OBS verification pending rather than claiming it has already happened.

## Test adequacy checklist

- Profile path/save/load/corrupt JSON coverage: pass. `dynamics-tuning-profile-store.test.ts:27`, `:52`, and `:102` cover profile path, persistence/reload, and corrupt JSON fallback.
- Stale signature / missing group behavior: pass. `dynamics-tuning-state.test.ts:19`, `:72`, and `:117` cover stale signatures, missing group ids, and revision changes.
- Effective dynamics layering without Runtime Export mutation: pass. `effective-dynamics-tuning.test.ts:16` and `:60` through `:62` assert the base model remains equal to the original and effective groups/pendulums are cloned.
- Debounced update/reset persistence: pass. `dynamics-tuning-profile-save-controller.test.ts:88` covers fake-timer debounce persistence; `dynamics-tuning-bridge-handlers.test.ts:53`, `:85`, `:97`, `:112`, and `:119` cover bridge update/reset mutation and saved profile results.
- Evaluation cache invalidation on tuning changes: pass. `runtime-export-evaluation-cache.test.ts:313`, `:351`, and `:362` cover tuning revision/cache-key invalidation.
- Browser Source same-tuning transport/application: pass for deterministic protocol paths. `browser-source-session.test.ts:228` covers resync plus separate update messages; `browser-source-stage-client.test.ts:320` covers applying dynamics tuning updates without reapplying Runtime Export payload.
- Control Window `Dynamics Tune` UI coverage: pass. Empty states, group controls, all quick-tune fields, reset/retry, disabled reset, and privacy non-rendering are covered at `dynamics-tune-page.test.ts:19`, `:41`, `:67`, `:109`, `:131`, and `:157`.
- Control route/bridge wiring: pass. Initial status/subscription and action wiring to `updateGroup`, `resetGroup({ groupId })`, and `retryProfileSave` are covered at `control-window-app.dynamics-tune.test.ts:24` and `:58` through `:102`.
- Navigation order: pass. `live-controller-page.test.ts:123` covers accepted Control Window navigation order including `Dynamics Tune` after `Mapping` and before `Stage`.
- Scope guards: pass at reviewed evidence level. Domain reports record focused Vitest/typecheck/source-organization success and no forbidden package/editor/schema/dependency changes; current read-only guard also found no `package.json`, `pnpm-lock.yaml`, `apps/editor`, or `packages` status entries.

## Docs/map alignment checklist

- Exact final integration policy: pass. The Wave21 plan contains `実装事実に合わせて関連ドキュメントを更新する。` at `player-wave21-plan.md:365`; the active convention also contains the exact sentence at `runtime-player-wave-planning-conventions.md:10`.
- Runtime Player root map points to Wave21 facts and next reads: pass. `discussion/runtime-player/_map.md:75` through `:77` record Dynamics Tune, Runtime Dynamics Tune Profile storage, Runtime Export immutability, and Native Stage / Browser Source effective tuning parity; `:112` points future readers to Wave21 plan/report/review maps and the Dynamics Tune screen doc.
- Implementation maps point to Wave21: pass. `discussion/runtime-player/implementation/_map.md:43` and `implementation/orchestration/_map.md:27` list Wave21 with Domain A/B pass and Domain C pending.
- Wave21 report/review maps are aligned: pass. `implementation/waves/wave21/_map.md:9` through `:20` records Domain A/B pass and Domain C manual Electron/OBS parity remaining; `implementation/reviews/wave21/_map.md:25` through `:28` records review pass state and remaining manual parity.
- Screen docs are aligned: pass. `screens/dynamics-tune-profile.md:7` says implementation is complete at source/test level while final real-device Electron / OBS manual checks remain; `screens/_map.md:12` records real-device/OBS manual checks pending.
- Architecture/backlog docs are aligned: pass. `architecture/_map.md:33` records Runtime Dynamics Tune Profile as Runtime Player-owned state under `userData` without Runtime Export/package-format changes; `backlog/runtime-player-backlog.md:724` and `:756` through `:767` keep Wave21 manual tuning checks pending.
- No manual Electron/OBS overclaim found for Wave21. Root and screen maps explicitly mark OBS and native Electron checks as pending at `discussion/runtime-player/_map.md:106` through `:107`.

## Manual checks checklist

All required manual checks are present as pending work in current docs/maps:

- Real Runtime Export with visible dynamics: present at `screens/dynamics-tune-profile.md:114` and `backlog/runtime-player-backlog.md:758`.
- iFacialMocap connected: present at `screens/dynamics-tune-profile.md:115` and `backlog/runtime-player-backlog.md:759`.
- `Dynamics Tune` controls affect Native Stage immediately: present at `screens/dynamics-tune-profile.md:117` through `:118` and `screens/_map.md:54`.
- Restart/reopen restores tuning: restart is present at `screens/dynamics-tune-profile.md:119` and `backlog/runtime-player-backlog.md:763`; same Runtime Export reopen is explicitly present at `screens/_map.md:55`.
- OBS Browser Source uses same tuning: present at `screens/dynamics-tune-profile.md:120`, `screens/_map.md:57`, and `screens/browser-source-output-probe-v0.md:100`.
- Different Runtime Export does not get stale tuning: present at `screens/dynamics-tune-profile.md:121` and `screens/_map.md:56`.
- Reset returns to exported defaults: present at `screens/dynamics-tune-profile.md:122`, `screens/browser-source-output-probe-v0.md:101`, and `backlog/runtime-player-backlog.md:766`.
- Runtime Export artifacts remain unmodified: present at `screens/dynamics-tune-profile.md:123`, `screens/_map.md:58`, and `backlog/runtime-player-backlog.md:767`.

## Verification performed

- Read-only review of Wave21 plan, reports, reviews, docs/maps, focused test names/bodies, and key runtime/profile/Browser Source implementation paths.
- `git diff --name-only -- apps/editor packages package.json pnpm-lock.yaml`: no output.
- `git status --short -uall -- package.json pnpm-lock.yaml apps/editor packages`: no output.
- `git diff --check -- discussion/runtime-player`: no whitespace errors; Git emitted only LF-to-CRLF working-copy warnings.
- `git diff --check -- apps/runtime-player`: no whitespace errors; Git emitted only LF-to-CRLF working-copy warnings.
- `pnpm install`: not run.
- Broad install/build/test, Electron, and OBS manual checks: not run.

## Unresolved decisions / risks

- Real product confidence still depends on the manual checklist above: real Runtime Export, real iFacialMocap input, Native Stage visual response, restart/reopen restore, OBS Browser Source parity, different-export isolation, reset behavior, and artifact immutability on disk.
- This reviewer was only allowed to write this report file, so `implementation/reviews/wave21/_map.md` was not updated to index this final review.
