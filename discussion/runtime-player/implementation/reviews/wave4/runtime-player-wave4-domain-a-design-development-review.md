# Runtime Player Wave4 Domain A Design / Development Compliance Review

> Target: `runtime-player-wave4-input-contract-parser-normalizer`
> Review lane: Design / Development Compliance
> Verdict: `pass`

## Basis

- `discussion/runtime-player/implementation/orchestration/player-wave4-plan.md`
- `discussion/runtime-player/architecture/runtime-player-development-policy.md`
- `discussion/runtime-player/architecture/technology-stack-decision.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/runtime-player/implementation/_map.md`
- `discussion/runtime-player/implementation/orchestration/_map.md`
- `discussion/runtime-player/implementation/waves/wave4/runtime-player-wave4-domain-a-input-contract-parser-normalizer-report.md`

## Findings

No blocking or non-blocking design/development compliance findings.

## Compliance Notes

- Electron process boundary is respected for Domain A. The new renderer-facing API is exposed as `window.runtimePlayer.input` functions through preload, while `ipcRenderer` remains local to preload in `apps/runtime-player/src/preload/runtime-player-bridge.ts:54` and `apps/runtime-player/src/preload/runtime-player-bridge.ts:95`.
- Raw input channel strings are not exposed to Control/Stage. The `runtime-player:input:*` constants live in `apps/runtime-player/src/preload/input-bridge-channels.ts:2`, and searches found no `runtime-player:input` usage in Control or Stage.
- The input contract is narrow and typed. `RuntimePlayerInputApi` exposes command/snapshot/event methods in `apps/runtime-player/src/preload/input-bridge-contract.ts:80`, while diagnostics/status DTOs include Domain B-ready fields such as local IP candidates and tracking frame snapshots in `apps/runtime-player/src/preload/input-bridge-contract.ts:51` and `apps/runtime-player/src/preload/input-bridge-contract.ts:64`.
- The normalized `TrackingFrame` contract matches the Wave4 shape: source/transport, normalized blendshapes, optional head position/rotation, eyes, and debug diagnostics are defined in `apps/runtime-player/src/preload/input-tracking-frame-contract.ts:19`.
- Existing startup placeholder compatibility is preserved. The old startup input snapshot still reports `"not-connected"` in `apps/runtime-player/src/preload/runtime-player-bridge-contract.ts:20` and `apps/runtime-player/src/preload/runtime-player-bridge-contract.ts:24`.
- Parser and normalizer are pure TypeScript logic without Electron, socket, or filesystem ownership. The parser entrypoint is `apps/runtime-player/src/main/input-adapters/ifacialmocap/ifacialmocap-frame-parser.ts:33`; normalization is in `apps/runtime-player/src/main/input-adapters/ifacialmocap/ifacialmocap-normalizer.ts:19`.
- Parser/normalizer responsibilities are split by file and test boundary. Parsed-frame DTOs live in `apps/runtime-player/src/main/input-adapters/ifacialmocap/ifacialmocap-parsed-frame.ts:18`, parsing in `ifacialmocap-frame-parser.ts`, normalization in `ifacialmocap-normalizer.ts`, and focused tests mirror those files.
- No broad catch-all `types.ts`, `utils.ts`, `helpers.ts`, substantial `index.ts`, or monolithic `ifacialmocap.ts` file was added.
- No package dependency changes were found. `git diff -- package.json pnpm-lock.yaml apps/runtime-player/package.json` was empty and the dependency guard passed.
- Allowed source scope is respected. Git status showed Runtime Player preload/main input-adapter files and discussion artifacts; no `apps/editor/**`, broad `packages/**`, `node_modules/**`, or Stage implementation changes were present.
- The implementation report documents changed files, contract shape, parser/normalizer coverage, verification, and known limitations in `discussion/runtime-player/implementation/waves/wave4/runtime-player-wave4-domain-a-input-contract-parser-normalizer-report.md:7`, `discussion/runtime-player/implementation/waves/wave4/runtime-player-wave4-domain-a-input-contract-parser-normalizer-report.md:30`, `discussion/runtime-player/implementation/waves/wave4/runtime-player-wave4-domain-a-input-contract-parser-normalizer-report.md:104`, and `discussion/runtime-player/implementation/waves/wave4/runtime-player-wave4-domain-a-input-contract-parser-normalizer-report.md:124`.

## Verification

Commands run:

- `git status --short -uall`
- `git diff -- apps/runtime-player/src/preload/runtime-player-bridge-contract.ts apps/runtime-player/src/preload/runtime-player-bridge.ts`
- `git diff -- package.json pnpm-lock.yaml apps/runtime-player/package.json`
- `pnpm.cmd --filter @private-2d-rigging-lab/runtime-player run typecheck`
  - Passed.
- `pnpm.cmd --filter @private-2d-rigging-lab/runtime-player run test:unit`
  - Passed: 12 files / 54 tests.
- `node scripts/check-source-organization.mjs`
  - Passed.
- `node scripts/check-dependencies.mjs`
  - Passed.
- `git diff --check -- apps/runtime-player/src/preload/runtime-player-bridge-contract.ts apps/runtime-player/src/preload/runtime-player-bridge.ts`
  - Passed with Git CRLF normalization warnings only.
- `rg -n '[\t ]$' apps/runtime-player/src/main/input-adapters/ifacialmocap apps/runtime-player/src/preload/input-bridge-channels.ts apps/runtime-player/src/preload/input-bridge-contract.ts apps/runtime-player/src/preload/input-tracking-frame-contract.ts discussion/runtime-player/implementation/waves/wave4/runtime-player-wave4-domain-a-input-contract-parser-normalizer-report.md`
  - No matches.
- `rg -n ipcRenderer apps/runtime-player/src`
  - Only preload and an existing boundary test matched.
- `rg -n electron apps/runtime-player/src/control apps/runtime-player/src/stage`
  - No matches.
- `rg -n "node:" apps/runtime-player/src/control apps/runtime-player/src/stage`
  - No matches.
- `rg -n "node:dgram|node:net|createSocket" apps/runtime-player/src/main apps/runtime-player/src/preload`
  - No matches.
- `rg -n "runtime-player:input" apps/runtime-player/src/control apps/runtime-player/src/stage apps/runtime-player/src/main apps/runtime-player/src/preload`
  - Only `apps/runtime-player/src/preload/input-bridge-channels.ts` matched.
- `rg --files apps/runtime-player/src | rg "(^|/)(types|utils|helpers|common|shared|index)\.ts$|ifacialmocap\.ts$"`
  - No matches.

Two initial compound `rg` searches failed because of PowerShell quoting. They were replaced by the simpler successful searches listed above and were not used as evidence.

## Remaining Risks / Gaps

- Domain B still needs to register main-process IPC handlers, own the UDP socket lifecycle, and implement throttled Control diagnostics. Domain A only defines the contract and pure parser/normalizer.
- Real-device iFacialMocap frames may reveal additional metadata or segment forms; this remains a Domain B/final integration verification item, already documented in the Domain A report.
- `TrackingFrame.transport` is currently fixed to `"udp"`, which is correct for Wave4 but will need extension if a later TCP adapter is accepted.

## User-Decision Points

None.
