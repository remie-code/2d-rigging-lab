# Wave 1B B2 independent review — payload observation / failure isolation

- Review loop: **1**
- Verdict: **PASS**
- Findings: **Blocker 0 / Major 0 / Minor 0**

## Basis and reviewed state

Reviewed directly against:

- `discussion/ai-cohost/implementation/orchestration/codex-progressive-speech-wave-plan.md` §2 decision 10, §6 B2, §8–9
- `discussion/ai-cohost/research/streaming-speech-pipeline-inventory.md`
- `discussion/ai-cohost/implementation/orchestration/fire-diagnostics-wave-plan.md`

Claimed B2 target files inspected as complete current files and tracked diffs:

- `apps/soul/agent/src/channel/channel-client.mjs`
- `apps/soul/agent/src/channel/channel-client.test.mjs`
- `apps/runtime-player/src/main/control-channel/control-channel-overlay-store.ts`
- `apps/runtime-player/src/main/control-channel/control-channel-overlay-store.test.ts`

The shared worktree is substantially dirty, including concurrent Wave 1A, passive diagnostics, Cockpit/settings, scheduler, and unrelated Expo work. Those changes were not attributed to B2, edited, reverted, staged, or committed. The B2 claimed change set is confined to the four files above. `git diff -- package.json pnpm-lock.yaml apps/soul/agent/package.json apps/runtime-player/package.json` was empty; no dependency or lockfile change is part of this unit. The target diff also does not edit `fire-orchestrator.mjs`, Cockpit UI/history, scheduler, or Wave 1A files. Existing dirty changes in those files remain outside this review.

The Soul channel target overlaps the already-dirty passive diagnostics work. I therefore assessed the current integrated behavior rather than assuming every hunk in that file belongs to B2.

## Behavioral verification

### 1. Exact serialized UTF-8 envelope and unchanged 4096 boundary

PASS.

`channel-client.mjs:175-210` constructs the actual `{ v, id, kind, payload }` envelope once, serializes it once with `JSON.stringify`, measures that exact string with `Buffer.byteLength(serialized, "utf8")`, and passes the same `serialized` value to `socket.send()`. The speech preflight is `serializedUtf8Bytes > 4096`; therefore 4096 remains accepted and 4097+ is locally rejected. Pending reply registration and `socket.send()` occur only after the preflight. Runtime's configured transport cap remains `controlChannelMaxClientMessageBytes = 4096` in `channel-websocket-frame.ts:40`; it was not changed by the target diff.

`channel-client.test.mjs:42-70` independently rebuilds the exact request envelope with the traced request ID and compares its UTF-8 byte length. The oversize test at `:72-105` proves the rejection reports the measured bytes/cap, sends zero speech requests, and then sends a small speech successfully over the same established channel.

No payload, timeline body, speech text, WAV body, or credentials are included in the new channel trace fields. The trace contains only connection/request identity, kind, counts, result/error code, durations, configured cap, and failure metadata. Existing `speak.test.mjs:150-173` also verifies that speech diagnostics retain counts without the supplied text.

### 2. Passive diagnostic seams and explicit integration limitation

PASS, with the Wave 2 integration boundary stated explicitly rather than treated as already implemented.

- chunk characters: existing `speak.mjs:94` emits `speechChars` without text;
- raw mora count: `speak.mjs:112,118,143,149,158` emits `rawMoraCount`;
- timeline count: `speak.mjs:159,181,191,201` and `channel-client.mjs:243` emit `timelineCount`;
- actual JSON UTF-8 bytes and request/connection identity: `channel-client.mjs:175-243` emits `serializedUtf8Bytes`, `requestId`, kind, and `connectionGeneration`;
- job/playback identity and terminal cause: `tts-playback-coordinator.mjs:11-18,53,85-98,141-169` exposes `jobId`, generation-qualified `playbackId`, terminal cause, and active/queued identity at its injected adapter boundaries;
- persistence seam: `cockpit.mjs:770-772` passes channel trace events to the existing bounded passive Fire diagnostics writer.

The new B1 coordinator is not yet wired into production Fire flow, and no current event claims to correlate all of these fields as one progressive chunk. In particular, the coordinator's `onTerminal` event contains `jobId` and cause while the player adapter receives the matching `playbackId`; the Wave 2 adapter must correlate/record them when it integrates player signals. Likewise, per-chunk `speechChars`, mora/timeline counts, and channel JSON bytes become one diagnosable chain only when Wave 2 builds and wires the per-job preparation/playback adapter. This is an integration-owned residual, not fabricated Wave 1 evidence. B2 adds no diagnostic UI, new persistent schema framework, or log-schema overhaul.

### 3. Failure isolation and ambiguous acceptance

PASS.

Oversize rejection happens before `pending.set` and before `socket.send`, so it cannot create an orphan waiter or Runtime close. The focused test proves the same healthy connection remains reusable and the next small request receives `accepted`, which also rules out a later-request timeout cascade in this seam.

For sent requests, close-before-reply and reply timeout are machine-readable distinct failures (`channel_closed` versus `reply_timeout`). `channel-client.mjs:217-232` deletes the pending waiter and propagates the ambiguous failure without retry. The timeout test observes exactly one server receipt. This matches the Runtime fact that accepted speech is applied before its reply is sent (`channel-server.ts:373-402`): a close/timeout may be reply-lost after application, so blind retry would be unsafe.

### 4. Runtime replacement/order and responsibility boundary

PASS.

Runtime validation/dispatch still returns an accepted speech dispatch without protocol expansion (`channel-request-dispatch.ts:200-227`), and `channel-server.ts:373-402` is the existing sole accepted-request call into `overlayStore.setSpeech`. The target Runtime source change is documentation only; the focused test at `control-channel-overlay-store.test.ts:527-559` proves snapshots do not replay or replace the prior timeline and that only an explicit later accepted write replaces it.

Runtime has no AudioPlayer terminal signal and therefore cannot independently know WAV playback order. Soul remains the actual WAV owner; Runtime remains the Control Channel timeline consumer. The required Wave 2 residual is a queue→channel adapter that invokes `sendSpeech` only when the corresponding FIFO job becomes active, awaits acceptance, then starts the Soul WAV, and forwards only the matching playback terminal to the coordinator. The B1 `play({ jobId, artifact, playbackId })` boundary is suitable for this adapter. Until Wave 2 wires it, the new Runtime test establishes the replacement primitive/boundary, not a claim that progressive production ordering is already integrated.

No Control Channel request/response kind, validation contract, timeline schema, or Runtime AudioPlayer responsibility was added.

## Reviewer-executed verification

### Soul standard runner — environment limitation, not green evidence

```powershell
cd apps/soul/agent
node --test src/channel/channel-client.test.mjs src/voice/speak.test.mjs src/voice/tts-playback-coordinator.test.mjs
```

Raw result: exit 1; file subtests 3, pass 0, fail 3. Every file failed before assertions at `ChildProcess.spawn` with `Error: spawn EPERM`. This is the documented sandbox worker restriction and is kept separate from the valid worker-free results.

### Soul worker-free focused tests — PASS

```powershell
cd apps/soul/agent
node src/channel/channel-client.test.mjs
node src/voice/speak.test.mjs
node src/voice/tts-playback-coordinator.test.mjs
```

Raw results, kept per module:

- channel client: exit 0; **17 tests / 17 pass / 0 fail**;
- speak/diagnostic boundary: exit 0; **6 tests / 6 pass / 0 fail**;
- playback coordinator: exit 0; **10 tests / 10 pass / 0 fail**.

Additional `node --check` over the channel client, its test, and the coordinator exited 0.

### Runtime focused tests — PASS after separating sandbox startup failure

Initial sandbox command:

```powershell
cd apps/runtime-player
pnpm.cmd exec vitest run -c vitest.config.ts src/main/control-channel/control-channel-overlay-store.test.ts src/main/control-channel/channel-websocket-connection.test.ts --pool=threads --maxWorkers=1 --no-file-parallelism
```

Raw result: exit 1 before test collection; Vite config loading failed because esbuild could not spawn (`Error: spawn EPERM`). This is not green evidence and not an assertion failure.

The identical command rerun outside the sandbox passed: exit 0; **2 files / 35 tests passed / 0 failed** (overlay store 29, WebSocket connection 6).

Related validation/dispatch/diagnostic events command:

```powershell
pnpm.cmd exec vitest run -c vitest.config.ts src/main/control-channel/channel-request-dispatch.test.ts src/main/control-channel/channel-intent-validation.test.ts src/main/control-channel/channel-server-events.test.ts --pool=threads --maxWorkers=1 --no-file-parallelism
```

Raw result: exit 0; **3 files / 56 tests passed / 0 failed**.

Runtime Player `pnpm.cmd typecheck` exited 0. `git diff --check -- <four target files>` exited 0.

## Findings and verdict

No Blocker, Major, or Minor finding remains in B2. Measurement uses the actual outgoing serialization, local oversize failure preserves the connection and does not create pending timeout state, ambiguous sent requests are not retried, diagnostics remain passive/content-free, and the Soul/Runtime ownership boundary is preserved. The unimplemented Wave 2 queue→channel correlation adapter is explicitly recorded as the next-wave integration responsibility and is not represented as completed B2 telemetry.

**Verdict: PASS (loop 1).**
