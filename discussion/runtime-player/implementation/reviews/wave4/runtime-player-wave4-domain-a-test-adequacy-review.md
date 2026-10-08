# Runtime Player Wave4 Domain A Test Adequacy Review

> Target: `runtime-player-wave4-input-contract-parser-normalizer`
> Review lane: Test Adequacy
> Verdict: `pass`

## 1. Basis

Reviewed against:

- `discussion/runtime-player/implementation/orchestration/player-wave4-plan.md`
- `discussion/runtime-player/architecture/runtime-player-development-policy.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/runtime-player/research/ifacialmocap-input-adapter-research.md`
- `discussion/runtime-player/implementation/waves/wave4/runtime-player-wave4-domain-a-input-contract-parser-normalizer-report.md`

Changed source and tests were inspected directly, including the untracked parser, normalizer, input contract, and parser/normalizer test files.

## 2. Findings

No blocking or needs-change findings.

Non-blocking observation:

- Dedicated runtime contract/input state tests are not present, but this is acceptable for Domain A. The changed contract files are DTO/API type definitions plus narrow preload channel wiring, while no main-process input state store, IPC handlers, receiver lifecycle, throttling, or socket behavior exists yet. Typecheck, focused parser/normalizer tests, and the existing Runtime Player boundary unit test are adequate for this Domain A surface. Domain B should add state/lifecycle/throttle/diagnostics tests when those behaviors are implemented.

## 3. Test Adequacy Assessment

Parser coverage is adequate for Domain A:

- Blendshape parsing is covered in `apps/runtime-player/src/main/input-adapters/ifacialmocap/ifacialmocap-frame-parser.test.ts:6`.
- Head rotation and raw position parsing are covered in `apps/runtime-player/src/main/input-adapters/ifacialmocap/ifacialmocap-frame-parser.test.ts:26`.
- Left/right eye rotation parsing is covered in `apps/runtime-player/src/main/input-adapters/ifacialmocap/ifacialmocap-frame-parser.test.ts:38`.
- `sendDataVersion=v2` ampersand-delimited blendshapes are covered in `apps/runtime-player/src/main/input-adapters/ifacialmocap/ifacialmocap-frame-parser.test.ts:54`.
- Malformed segment behavior asserts surviving valid data, `malformedSegmentCount`, warning count, and `lastParseError` in `apps/runtime-player/src/main/input-adapters/ifacialmocap/ifacialmocap-frame-parser.test.ts:69`.
- TCP delimiter-stripped and delimiter-suffixed samples are covered in `apps/runtime-player/src/main/input-adapters/ifacialmocap/ifacialmocap-frame-parser.test.ts:85`.

Normalizer coverage is adequate for Domain A:

- `0..100` to `0..1` blendshape normalization is covered in `apps/runtime-player/src/main/input-adapters/ifacialmocap/ifacialmocap-normalizer.test.ts:7`.
- Out-of-range clamping and normalization diagnostics are covered in `apps/runtime-player/src/main/input-adapters/ifacialmocap/ifacialmocap-normalizer.test.ts:22`.
- Missing head/eyes remain absent in `apps/runtime-player/src/main/input-adapters/ifacialmocap/ifacialmocap-normalizer.test.ts:39`.
- Head raw position preservation and degree rotations are covered in `apps/runtime-player/src/main/input-adapters/ifacialmocap/ifacialmocap-normalizer.test.ts:48`.
- Parser diagnostics are carried into `TrackingFrame.debug` in `apps/runtime-player/src/main/input-adapters/ifacialmocap/ifacialmocap-normalizer.test.ts:68`.

The focused tests do not require Electron or real UDP sockets. The parser/normalizer sources do not import Electron, Node sockets, renderer UI, runtime-core mapping, or Stage modules. The preload bridge uses Electron only at the expected preload boundary and exposes typed methods on `window.runtimePlayer.input`, not raw `ipcRenderer` or channel handles.

No test coverage is hiding out-of-scope behavior. Searches over the Domain A files found no runtime parameter mapping, Stage motion, UDP socket lifecycle, `node:dgram`, or TCP receiver implementation.

## 4. Commands Run

- `pnpm.cmd --filter @private-2d-rigging-lab/runtime-player exec vitest run -c vitest.config.ts src/main/input-adapters/ifacialmocap/ifacialmocap-frame-parser.test.ts src/main/input-adapters/ifacialmocap/ifacialmocap-normalizer.test.ts`
  - First sandboxed attempt failed before test execution with `spawn EPERM` while Vite/esbuild loaded.
  - Re-run with approval passed: 2 files / 11 tests.
- `pnpm.cmd --filter @private-2d-rigging-lab/runtime-player run typecheck`
  - Passed.
- `pnpm.cmd --filter @private-2d-rigging-lab/runtime-player run test:unit`
  - Passed with approval: 12 files / 54 tests.
- `node scripts/check-source-organization.mjs`
  - Passed.
- `node scripts/check-dependencies.mjs`
  - Passed.
- `git diff --check -- apps/runtime-player/src/preload/runtime-player-bridge-contract.ts apps/runtime-player/src/preload/runtime-player-bridge.ts discussion/runtime-player/implementation/_map.md discussion/runtime-player/implementation/orchestration/_map.md`
  - Passed. Git emitted CRLF normalization warnings only.
- `rg -n "[\\t ]$" apps/runtime-player/src/main/input-adapters/ifacialmocap apps/runtime-player/src/preload/input-bridge-channels.ts apps/runtime-player/src/preload/input-bridge-contract.ts apps/runtime-player/src/preload/input-tracking-frame-contract.ts discussion/runtime-player/implementation/waves/wave4/runtime-player-wave4-domain-a-input-contract-parser-normalizer-report.md`
  - No matches; used to cover new/untracked files that `git diff --check` does not inspect.
- Out-of-scope searches over Domain A files for runtime parameter mapping, Stage motion, sockets, and Node socket APIs found no blocking matches.

## 5. Remaining Risks / Gaps

- Real-device iFacialMocap frames may include additional segment forms or metadata not represented in current fixtures. This is an expected Wave4 real-device verification risk, not a Domain A test blocker.
- Input status store, IPC handlers, UDP lifecycle, throttling, diagnostics emission, and Copy diagnostics behavior are not implemented in Domain A. Domain B must add tests for those behaviors.
- `git diff --check` cannot inspect untracked files; trailing whitespace in new files was checked separately with `rg`.

## 6. User Decision Points

None.
