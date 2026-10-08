# Codex Progressive Speech — Wave 2 progressive Fire completion

- Status: **SOURCE IMPLEMENTATION PASS — mechanical and human gates pending**
- Scope: production incremental Fire boundary, overlapped FIFO sentence delivery, Fire/generation lifecycle, and partial-conversation continuity.
- Review units: C1 **PASS loop 1**; C2 **PASS loop 3**; C3 **PASS loop 2**.
- This report records source implementation and independent unit-review completion. It does not claim the later mechanical gate, real-device gate, or human acceptance as passed.

## Unit status and review history

| Unit | Final verdict | Final findings | Review history |
|---|---|---|---|
| C1 incremental boundary | PASS, loop 1 | Blocker 0 / Major 0 / Minor 0 | Passed on the first independent review. |
| C2 Fire state machine | PASS, loop 3 | Blocker 0 / Major 0 / Minor 0 | Loop 1 REVISE: Blocker 2 / Major 3. Loop 2 REVISE: Blocker 0 / Major 1. Loop 3 closed the remaining Major. |
| C3 partial conversation | PASS, loop 2 | Blocker 0 / Major 0 / Minor 0 | Loop 1 REVISE: Blocker 0 / Major 1. Loop 2 closed the zero-spoken error projection Major. |

Independent reviews:

- [C1 incremental boundary](../../reviews/codex-progressive-speech/c1-incremental-boundary.md)
- [C2 Fire state machine](../../reviews/codex-progressive-speech/c2-fire-state-machine.md)
- [C3 partial conversation](../../reviews/codex-progressive-speech/c3-partial-conversation.md)

## Implemented production behavior

### C1 — incremental boundary

One accepted Codex Fire installs one `onTextDelta` callback on its single App Server ask. Each delta enters one Fire-local Wave 1B incremental sentence/tag buffer exactly once. A completed safe sentence is handed to the delivery seam immediately, without a minimum-length merger, and the final unterminated remainder is flushed at most once.

Expression/control tags do not become speech. NG scanning occurs after sentence assembly, so a configured word split across transport deltas is still blocked. The first unsafe sentence stops later delivery without retracting an already delivered safe prefix. The existing final NG gate remains active.

Sentence chunks are TTS/playback units only. They do not call `session.ask` and do not create additional App Server turns. Claude and non-streaming final-result fallback remain one-shot.

### C2 — overlapped delivery and Fire lifecycle

The C1 enqueue seam is connected to a production delivery adapter that reuses the Wave 1B FIFO coordinator. Sentence TTS preparation may overlap LLM generation and other preparation, but only the FIFO-active job may send its timeline and start audio. Control Channel acceptance occurs before the matching Soul WAV starts.

The active job is correlated by Fire generation, `jobId`, generation-qualified `playbackId`, exact WAV path, Control Channel `requestId`, serialized UTF-8 byte count, and terminal cause. `ENDED`/`STOPPED` before matching `STARTED`, duplicate markers, path-only matches, and stale old-generation markers cannot commit a job. A STARTED watchdog and a duration-plus-bounded-margin completion watchdog fail their exact generation rather than fabricating completion.

LLM terminal state and playback-queue terminal state are distinct. A Fire cannot report successful completion while delivery remains unsettled. The production lifecycle is:

```text
idle
  -> acquire immutable accepted-Fire resources
  -> thinking / one App Server ask
       -> delta -> safe sentence -> TTS preparation
       -> FIFO active -> Control Channel accepted -> PLAYID
       -> matching STARTED -> speaking ownership
       -> matching ENDED -> completed watermark -> next FIFO job
  -> LLM terminal + queue terminal
  -> complete / failed / cancelled
  -> idle
```

Only one audio job is active at a time and sentence order is stable even when preparation finishes out of order. Streamed Codex responses do not fall through to legacy full-response `speak`, preventing duplicate audio.

Kill and dispose remain authoritative before STARTED. Barge-in is a no-op before an authenticated STARTED, including thinking and PLAY-issued/pre-STARTED windows. After audible ownership begins, barge-in remains available during active playback and inter-sentence gaps. Kill, barge, dispose, settings revisions, preparation/play/channel failures, watchdogs, and late callbacks are isolated by exact Fire/generation ownership; a closed generation cannot resurrect queued work or commit into a later Fire.

Each accepted Fire snapshots its session/brain and prompt revisions, memory/context, conversation instruction, player/audio device, Channel URL/connection generation, and TTS dependencies before acceptance is published. Mid-Fire setting changes affect the next accepted Fire only. A synchronous pre-publication Fire claim prevents overlapping callers from both becoming accepted while resource acquisition or vision-target resolution is pending.

### C3 — audible truth and conversation continuity

When one or more sentences reached matching `ENDED` and a later LLM, NG, channel, preparation, play, marker, kill, barge, or dispose terminal prevents full delivery, the visible canonical assistant entry is exactly the completed `playedText` plus the fixed restrained note:

```text
（応答は途中で中断されました）
```

The canonical entry is appended once through the existing transcript buffer and `onSoulTranscript` path. Therefore Cockpit projection, memory/digest input, and self-fire refractory bookkeeping all consume the same audible truth. Generated but unheard suffixes, queued/unplayed text, control tags, and NG content are not committed. The audible prefix is not replayed by legacy fallback or recovery.

A partial canonical entry creates one internal continuity correction. The next actual `session.ask` consumes it once, telling the same ongoing conversation that only the visible spoken prefix reached the listener. It is not a Cockpit user line and does not create another LLM turn. Pre-ask resource or vision-capture failure retains the correction; once an ask is invoked, even an ambiguous handoff failure consumes it to avoid duplicate correction. Vision remains image-first.

If no sentence completed, no partial transcript, interruption note, correction, soul/self-spoke append, or memory/digest entry is created. Genuine delivery failures use the established normal Fire error result and one `fireError` diagnostic so Cockpit's existing error ghost remains available. Intentional killed/disposed/barge outcomes and the existing NG cause-specific policy are not broadly remapped. Ordinary complete progressive responses commit the full spoken answer once without interruption metadata or a future correction.

## C2 and C3 correction closure

C2 loop 1 found two Blockers and three Majors. The Blockers were closed by external marker authentication with playback ID plus exact path, STARTED ordering/watchdogs, and exact lazy-Channel generation invalidation with no same-request retry. The Majors were closed by pre-publication immutable resource snapshots, exact-once private terminal outcomes including LLM failure after a played prefix, and exact owned WAV/directory cleanup. Loop 2 verified those closures and found one new Major: pre-STARTED progressive barge-in incorrectly cancelled a thinking Fire. Loop 3 added authenticated audible ownership and preserved post-prefix gap interruption while keeping kill/dispose authority; it passed with no findings.

C3 loop 1 passed partial canonicalization, continuity, transcript/memory exclusion, and race ownership, but found one Major: a genuine zero-completed delivery failure returned a progressive-specific result without the existing Cockpit-visible Fire error. Loop 2 narrowly routed non-NG `status:"failed"` zero-watermark outcomes through the normal `{reason:"error"}` plus exactly one `fireError` diagnostic. Channel and preparation failures, no transcript/correction/self-spoke, and later-Fire recovery were independently verified; C3 then passed with no findings.

## Wave 2 attribution

### Production integration and tests

- `apps/soul/agent/src/mind/fire-orchestrator.mjs`
- `apps/soul/agent/src/mind/fire-orchestrator.test.mjs`
- `apps/soul/agent/scripts/cockpit.mjs`
- `apps/soul/agent/scripts/cockpit.test.mjs`
- `apps/soul/agent/src/voice/progressive-speech-delivery.mjs`
- `apps/soul/agent/src/voice/progressive-speech-delivery.test.mjs`
- `apps/soul/agent/src/mind/fixtures/fire-diagnostics.success.jsonl`

### Approved Wave 1 boundary-integration hunks

These are minimal Wave 2 integration changes to previously accepted primitives or adjacent production adapters, not a reimplementation of the Wave 1 contracts:

- `apps/soul/agent/src/voice/speak.mjs`
- `apps/soul/agent/src/voice/speak.test.mjs`
  - extracted compatible `prepareSpeech` / `activatePreparedSpeech` stages while preserving `speak()` as the one-shot wrapper;
- `apps/soul/agent/src/channel/channel-client.mjs`
- `apps/soul/agent/src/channel/channel-client.test.mjs`
  - returned the already-known request ID and exact serialized byte count; retained serialization, preflight, pending-registration, timeout/close, and no-retry contracts;
- `apps/soul/agent/src/voice/audio-player.mjs`
- `apps/soul/agent/src/voice/audio-player.test.mjs`
- `apps/soul/agent/src/test-support/fake-media-player.mjs`
  - added the progressive `PLAYID` marker path and exact owned-temp cleanup while retaining legacy `PLAY` compatibility.

The shared worktree also contains concurrent/user-owned identity, conversation-instruction, passive-diagnostics, Cockpit settings/UI, Runtime, and documentation changes. Those hunks are not Wave 2 work and are not attributed here, including when they share one of the dirty files above. Existing `transcript-buffer`, memory/digest, scheduler, Cockpit-server projection, Codex session, brain registry, and Runtime behavior was reused and regression-tested rather than reimplemented or claimed as Wave 2 source.

## Verification evidence

All successful Node lanes below use worker-free test isolation because the repository-standard runner cannot create test workers in the sandbox.

From `apps/soul/agent`:

```powershell
node --test --test-isolation=none --test-concurrency=1 src/mind/fire-orchestrator.test.mjs
```

Final C3 review: **90 tests / 90 pass / 0 fail**.

```powershell
node --test --test-isolation=none --test-concurrency=1 --test-name-pattern='C2/C3|C3:' src/mind/fire-orchestrator.test.mjs
```

Exact C3 slice: **8/8 pass**.

```powershell
node --test --test-isolation=none --test-concurrency=1 \
  src/mind/incremental-sentence-tag-buffer.test.mjs \
  src/voice/tts-playback-coordinator.test.mjs \
  src/voice/progressive-speech-delivery.test.mjs \
  src/voice/speak.test.mjs \
  src/channel/channel-client.test.mjs \
  src/mind/fire-orchestrator.test.mjs \
  scripts/cockpit.test.mjs \
  src/mind/codex-session.test.mjs \
  src/mind/brains.test.mjs
```

Final transport/delivery/Fire regression: **252/252 pass**. C2's loop-3 seven-file foundation lane independently passed **217/217** before C3 additions. C1's loop-1 six-file related lane independently passed **213/213** at its review boundary.

```powershell
node --test --test-isolation=none --test-concurrency=1 \
  src/ears/transcript-buffer.test.mjs \
  src/mind/memory.test.mjs \
  src/mind/fire-scheduler.test.mjs
```

Transcript/memory/self-fire regression: **107/107 pass**.

```powershell
node --test --test-isolation=none --test-concurrency=1 \
  scripts/cockpit.test.mjs \
  src/cockpit/cockpit-server.test.mjs
```

Cockpit production seam: **207/207 pass**.

The repository-standard isolated attempt remains environment-blocked:

```powershell
node --test src/mind/fire-orchestrator.test.mjs
```

Raw summary: **0/1 pass**; module precollection failed at test-worker `spawn EPERM`, before implementation assertions ran. C2's full standard `npm test` attempt likewise collected 59 files and failed **0/59** at worker creation. These are environment failures, not green evidence and not source assertion failures.

`node --check` passed for the final Fire source/test files, and target `git diff --check` passed with only repository LF-to-CRLF warnings.

## Preserved invariants and boundaries

- The three Codex brains use App Server transport; Sol remains configured at `low` reasoning.
- One Fire is one assistant turn. Sentence chunks never create additional asks or turns.
- Healthy later Fires continue the same App Server thread. Fatal App Server recovery retains the accepted Wave 1A fresh-process/thread policy and adds no blind retry.
- Vision remains mandatory where previously required and image-first when attached.
- Claude remains on its existing full-result one-shot path.
- Active audio is at most one job and playback is FIFO.
- Accepted Fire resources remain immutable through LLM and queue settlement.
- `SPEECH_ENVELOPE_UTF8_CAP` remains exactly **4096**. The exact serialized-string preflight is reused; the current ambiguous request is never blindly retried.
- No dependency, package manifest, or lockfile change is attributed to Wave 2.
- No diagnostic UI or public telemetry polish was added. New passive traces remain content-free; played text is confined to the private terminal/projection seam.
- No Runtime Player source change is attributed to Wave 2.

## Residual gates and unresolved decisions

- No real App Server/model, AivisSpeech, PowerShell/WinRT AudioPlayer, or Runtime Player progressive run was performed in Wave 2. Current evidence is worker-free fake/probe-shaped mechanical source evidence.
- The repository mechanical gate and its integration report are not closed by this document.
- The Sol/low real-device run with mandatory vision, first-audible timing, multi-sentence delivery, interruption behavior, payload measurements, and subjective note readability remains the human gate.
- The 4096-byte retain/raise/remove/subdivide decision is deliberately deferred until real serialized-payload measurements are reported to the user. Wave 2 does not authorize changing it.
- Diagnostic UI and public telemetry polish remain out of scope.
- Real same-thread conversational quality after a partial response and actual memory-checkpoint prose remain runtime/human observations; source preserves the required seams but does not claim those observations passed.

No source, tests, independent review documents, closeout, or human-gate document was edited while producing this completion report.
