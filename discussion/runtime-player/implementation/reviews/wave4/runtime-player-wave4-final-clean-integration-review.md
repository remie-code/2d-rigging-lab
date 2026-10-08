# Runtime Player Wave4 Final Clean Integration Review

## Verdict

pass

Runtime Player Wave4 satisfies the agreed receive / parse / normalize / Control diagnostics gate. I found no blocking source, test, or documentation issue requiring a Wave4 source/test fix.

## Basis Reviewed

- Wave plan, Domain A/B reports, all six Domain A/B review lanes, final integration report, Wave4 maps, Runtime Player implementation/orchestration maps.
- Runtime Player policy, iFacialMocap research, initial Runtime Player screen, and source file organization policy.
- Required preload contracts and bridge files under `apps/runtime-player/src/preload/`.
- Required main input parser/normalizer/UDP receiver/session/throttle/local-IP/IPC files under `apps/runtime-player/src/main/`.
- Required Control diagnostics source under `apps/runtime-player/src/control/`.
- Relevant parser, normalizer, UDP receiver, input session, diagnostics throttle, placeholder state, and process-boundary tests.
- Stage source and boundary coverage enough to confirm Wave4 did not add input/debug consumption to Stage.

## Required Check Results

| Check | Result | Evidence |
|---|---|---|
| Domain A and Domain B reports exist | pass | Both Wave4 domain reports exist under `discussion/runtime-player/implementation/waves/wave4/` and record done/pass scope, changed files, verification, and limitations. |
| Review lanes exist and pass or explicitly escalate | pass | All six Domain A/B review artifacts exist under `discussion/runtime-player/implementation/reviews/wave4/` and report `pass`. |
| UDP-only scope is preserved | pass | `node:dgram`/`createSocket` appears only in the main iFacialMocap UDP receiver. No TCP receiver or TCP port lifecycle is implemented; TCP mentions are limited to parser delimiter tolerance and tests. |
| Control diagnostics expose required fields | pass | The typed status/diagnostics contracts and `input-diagnostics-panel.tsx` expose state, transport, receive port, local IPs, optional iPhone IP, handshake, remote endpoint, packet count, FPS, last packet age, malformed count, raw sample, parsed blendshapes, head rotation/position, eye rotation, normalized frame, parser warnings, and normalization warnings. |
| Debug snapshots are throttled to at most 10Hz | pass | Packet-derived renderer updates call `RuntimePlayerInputDiagnosticsThrottle.request()` with a 100ms default interval. Main state still records every packet before requesting a throttled broadcast. Lifecycle, error, and handshake broadcasts remain immediate. |
| Runtime parameter mapping/model motion are not implemented | pass | Source search found no Wave4 mapping from `TrackingFrame` into runtime parameters, model motion, body follow, head-position Stage motion, dynamics playback, or parameter slider UI. |
| Stage Window remains capture-clean and unaffected | pass | Stage source does not use `window.runtimePlayer.input`, input channels, tracking frames, raw frames, or diagnostics UI. The existing boundary test also checks Stage production files for setup/debug controls. |
| Manual real-device verification instructions are clear | pass | Domain B and final integration reports include loopback and real-device checklists covering firewall/network setup, passive listen, optional start request, remote endpoint, packet/FPS/raw/parsed/normalized diagnostics, Copy diagnostics, and Stage cleanliness. |
| Maps are updated and Wave4 artifacts are discoverable | pass | Wave4 wave/review maps and Runtime Player implementation/orchestration maps link the Wave4 plan, reports, reviews, and final closeout artifacts. This review file now satisfies the linked final clean review path. |

## Blocking Findings

None.

## Non-Blocking Risks/Gaps

- Real iFacialMocap device behavior remains manually unverified in this clean review: firewall prompts, iOS local network permission, passive-vs-start-request behavior, multi-NIC selection, axis signs, head position units, and long-running UDP stability still need real-device evidence before Wave5 mapping decisions.
- Control state computes `stale` correctly on fresh `getStatus()` reads, but there is no autonomous renderer timer that broadcasts the stale transition exactly when packets stop. This is acceptable for the Wave4 receive/debug gate, but should be revisited if users rely on hands-free stale indication.
- `control-window-app.tsx` is now large. The diagnostics panel was split out, but the Input Source panel and command helpers should be extracted before adding more Control Window features.
- During review, one pre-existing trailing-whitespace match was found in `runtime-player-wave4-domain-b-design-development-review.md` metadata. Parent closeout removed that whitespace-only issue after this review returned `pass`.

## Verification Performed

- Directly reviewed the required source, tests, reports, and maps listed in the task.
- Ran `node scripts/check-source-organization.mjs`: passed.
- Ran `node scripts/check-dependencies.mjs`: passed.
- Ran targeted `rg` searches for UDP/TCP scope, renderer Node/Electron access, Stage input/debug leakage, runtime parameter mapping/model motion, diagnostics fields, and throttling paths.
- Ran trailing-whitespace search across Wave4 source/report/review/map scope. During review it found only the pre-existing Domain B review trailing-space noted above; parent closeout removed that whitespace-only issue after review.
- Ran `git diff --check -- apps/runtime-player/src/preload apps/runtime-player/src/main apps/runtime-player/src/control discussion/runtime-player/implementation`: passed with Git LF/CRLF normalization warnings only.
- Did not run `pnpm install`.
- Did not rerun Runtime Player typecheck or Vitest in this clean review. I reused Domain A/B recorded passing evidence because this review made no source/test edits and direct source/test inspection matched the reported implementation surface.

## Source/Test Fix Required

No source or test fix is required for Wave4 pass.

Optional follow-up only:

- Add a focused bridge-level socket-error propagation test.
- Add a renderer-side stale refresh if stale status must update without user action or packet/lifecycle events.
- Split the Control Window Input Source section before the next Control feature expansion.

## User-Decision Points

None blocking Wave4.

Future decisions before Wave5/model motion:

- Whether real-device diagnostics are sufficient to start runtime parameter mapping.
- Whether to add explicit NIC selection or persisted iPhone IP/receive port before mapping.
- Whether and when to add TCP transport.
