# Wave 2 C2 independent review — Fire state machine

- Current review loop: **3**
- Current verdict: **PASS**
- Current findings: **Blocker 0 / Major 0 / Minor 0**
- Loop 2 history: **REVISE — Blocker 0 / Major 1 / Minor 0**
- Loop 1 history: **REVISE — Blocker 2 / Major 3 / Minor 0**
- Reviewer role: independent Review-Sylph; this review did not change source implementation

## Basis and reviewed state

The review inspected the current full files, tracked target diffs, untracked target files in full, focused tests, and reviewer-executed adversarial probes. It did not rely on the implementation author's summary as evidence.

Basis:

- `discussion/ai-cohost/implementation/orchestration/codex-progressive-speech-wave-plan.md` §2, §3, §7 C2, §8–§10
- Wave 1A/1B completion reports and independent A1/A2/B1/B2 reviews
- `discussion/ai-cohost/implementation/reviews/codex-progressive-speech/c1-incremental-boundary.md`
- the passive Fire diagnostics plan/review and current diagnostic fixture
- reference Wave 1 incremental buffer/coordinator, Codex session adapter, `AudioPlayer`, transcript/memory/session/settings seams

C2 attribution targets inspected directly:

- new `apps/soul/agent/src/voice/progressive-speech-delivery.mjs` and `.test.mjs`
- `apps/soul/agent/src/voice/speak.mjs` and `.test.mjs`
- `apps/soul/agent/src/channel/channel-client.mjs` and `.test.mjs`
- `apps/soul/agent/src/mind/fire-orchestrator.mjs` and `.test.mjs`
- `apps/soul/agent/scripts/cockpit.mjs` and `.test.mjs`
- `apps/soul/agent/src/mind/fixtures/fire-diagnostics.success.jsonl`

The worktree is broadly dirty and several C2 files also contain accepted earlier identity, settings, memory, and passive-diagnostics work. Attribution was therefore by logical hunk and current behavior, not by claiming the whole dirty diff as C2. No file was staged, committed, reverted, or broadly formatted.

## Conforming behavior confirmed

- A streamed Fire still issues one `session.ask`; sentence jobs never issue an App Server turn.
- The first safe sentence can enter preparation/playback before the final model result. Preparations overlap, while the Wave 1B coordinator preserves FIFO and one active job.
- Control Channel acceptance precedes WAV play. The active adapter records `jobId`, generated `playbackId`, `requestId`, exact serialized UTF-8 bytes, character/mora/timeline counts, and terminal cause without response content.
- LLM completion and queue completion are separate in the normal successful path. Fire remains nonterminal until queued jobs receive terminal markers.
- Kill/barge/dispose close coordinator generations and late preparation artifacts are cleaned once. The tested different-path stale marker is ignored.
- The 4096 value is unchanged. `channel-client` serializes once, measures that exact string, preflights before pending registration/send, and does not retry an ambiguous sent request.
- Streamed progressive responses do not invoke legacy full `speak`; non-streaming/Claude-style final fallback remains one-shot. The existing vision route and one-turn behavior remain green.
- The private delivery outcome contains completed played chunks/text and terminal cause, which is suitable for C3 when it actually reaches the hook.

These positives do not offset the Blocker/Major findings below.

## Findings

### Blocker 1 — marker authentication can commit speech that never reached STARTED, and a stale same-path ENDED can commit a newer generation

`progressive-speech-delivery.mjs:216-259` checks only the current marker's WAV path before forwarding `ENDED`/`STOPPED` to the coordinator. It does not require `marker.started === true`, and the child marker contains no generation-qualified `playbackId`. The generated ID therefore does not authenticate the external terminal signal.

Reviewer probe 1 sent `ENDED\tsame.wav` without `STARTED`. Raw result:

```json
{"plays":["same.wav"],"status":"completed","completedSentenceCount":1,"playedText":"未開始。"}
```

Reviewer probe 2 reused the same path for an old killed generation and a fresh generation, then delivered the old `ENDED` line to all listeners before the fresh `STARTED`. Raw result:

```json
{"status":"completed","playedText":"新。","completed":1}
```

This is both omitted speech and stale callback commit under the review policy. The existing stale-marker test uses `old.wav` versus `fresh.wav`, so it cannot detect the same-path case. There is also no post-STARTED completion watchdog: if `STARTED` arrives but the child exits or loses `ENDED`, queue/Fire remain active indefinitely and later Fire stays busy.

Correction required:

1. Do not accept `ENDED` or `STOPPED` before a matching `STARTED` for the same active generation.
2. Carry or otherwise unambiguously authenticate the generation-qualified `playbackId` together with the exact owned WAV path across the player marker boundary. Path-only current-state inference is insufficient for duplicate/same-path stale callbacks.
3. Add a generation-owned post-STARTED watchdog derived from the prepared duration plus a bounded margin. A watchdog may fail/abort the generation, but must never mark it completed or advance a newer generation.
4. Add focused tests for ENDED-before-STARTED, STOPPED-before-STARTED, duplicate STARTED/ENDED, stale same-path markers across generations, and missing ENDED after STARTED followed by a recoverable later Fire.

### Blocker 2 — a post-connect Channel close remains cached, so later Fires do not reconnect

`createLazyChannel()` clears `channelPromise` only when initial connection creation fails or the configured URL changes. Once connected, `sendSpeech()` simply delegates. A `channel_closed`/socket/send failure does not invalidate the cached closed handle, and connection state remains `connected`. A later Fire reuses the same dead object.

Reviewer probe used an injected connected channel whose `sendSpeech` reports `channel_closed` twice. Raw result:

```json
{"connects":1,"expectedForRecovery":2}
```

The delivery test labelled “later Fire recovers” constructs an entirely new accepted channel object, bypassing the production lazy-channel cache, so it does not cover this seam. This violates the explicit later-Fire recoverability requirement.

Correction required:

1. On terminal connection failures (`channel_closed`, socket failure, closed/send failure, and the chosen post-timeout policy), invalidate only the exact cached connection generation that failed and close it best-effort.
2. Do not retry the current ambiguous sent request. The next Fire may establish a fresh connection and issue its own new request exactly once.
3. Keep local 4096 preflight rejection on the healthy connection; it must not trigger reconnection.
4. Add production-seam tests using `createLazyChannel`: close-before-reply then later Fire reconnects/succeeds; timeout receives no same-request retry and later Fire follows the documented fresh-or-reused policy; oversize then later small request reuses the healthy connection.

### Major 1 — the accepted-Fire settings snapshot is taken after acceptance, so an active vision Fire can adopt a mid-Fire revision

Normal/vision Fire emits accepted and changes state before calling `sessionProxy.ask`. `createSessionProxy.ask()` then runs `ensureSessionCurrent()`, which applies the current channel, audio, brain/memory/context, and instruction revisions. Vision Fire has an awaited capture between acceptance and this gate. A settings write during capture is therefore applied to the already accepted Fire, not the next Fire.

Reviewer probe changed the desired setting after `onFire{accepted:true}` while capture was pending. Raw result:

```json
{"acceptedSnapshotExpected":"old","actualAskSetting":"new"}
```

The existing revision tests mutate settings only after the session's `ask` has already begun, so they prove in-flight session retention but not the accepted-to-ask gap.

Correction required:

Acquire one immutable Fire resource/config snapshot at the accepted transition (before publishing acceptance): selected brain/session prompt revision, memory/context revision, conversation instruction, audio-device/player generation, channel URL/connection generation, and TTS dependencies. Normal, vision, and preferred/degraded paths must use that fixed snapshot through queue settlement. Apply later writes only when the next Fire is accepted. Add a delayed-capture test that changes each revision after acceptance and proves old resources are used for the current Fire and new resources exactly once by the next Fire.

### Major 2 — LLM failure after a played prefix loses the private progressive outcome seam required by C3

`askIncrementally()` correctly aborts the delivery with `llm-failed`, waits for queue settlement, and stores the outcome on `error.progressiveDelivery`. The outer Fire catch converts the error to `{ fired:false, reason:"error", message }` and never calls `onProgressiveTerminal`. Thus the only C3-capable private seam does not receive played text/watermark or terminal cause for this critical partial-delivery path.

Reviewer probe completed one safe prefix, then rejected the LLM ask. Raw result:

```json
{"fireResult":{"fired":false,"reason":"error","message":"llm failed"},"terminalHookCount":0}
```

Correction required:

Route the settled progressive outcome to `onProgressiveTerminal` exactly once for success, LLM failure, NG-after-prefix, channel/prepare/play/marker failure, kill, barge, and dispose. Keep public results/content-free as needed, but preserve the private `playedText`/played-chunk watermark and terminal cause for C3. Add a test for “safe prefix matching ENDED → later LLM failure” and prove no transcript commit occurs in C2 while the hook retains the prefix.

### Major 3 — production progressive cleanup removes WAV files but leaks one temporary directory per prepared sentence

The default writer creates a new `soul-agent-*` directory for every `writeTempWav` call (`audio-player.mjs:174-183`). The new delivery cleanup only calls `unlinkSync(artifact.wavPath)` (`progressive-speech-delivery.mjs:77-87`). Every completed, failed, killed, or late-prepared progressive sentence therefore leaves its owned empty directory behind. All new delivery tests inject `cleanupArtifact`, so the production cleanup path is untested.

Correction required:

Represent exact temp ownership in the prepared artifact (for example an owned cleanup handle or explicit owned directory metadata), and clean the WAV plus only its exactly owned directory once on completion/cancel/failure/late preparation. Do not infer and remove arbitrary parent directories for custom `writeWav` paths. Add production cleanup tests for natural completion, prepare-late-after-abort, channel/play failure, and dispose, including idempotent late callbacks.

## Reviewer-executed verification

### Repository-standard runner — environment limitation

```powershell
cd apps/soul/agent
npm test
```

Raw summary: exit 1; **59 files / 0 pass / 59 fail**. Every file failed before collection at test-worker `spawn EPERM`. This is environment evidence, not green evidence and not an implementation assertion failure.

### Focused C2 lane — PASS but insufficient for verdict

```powershell
cd apps/soul/agent
node --test --test-isolation=none --test-concurrency=1 \
  src/voice/progressive-speech-delivery.test.mjs \
  src/voice/speak.test.mjs \
  src/channel/channel-client.test.mjs \
  src/mind/fire-orchestrator.test.mjs
```

Raw summary: exit 0; **105 tests / 105 pass / 0 fail**, duration 837.5395 ms.

An additional focused run including `scripts/cockpit.test.mjs` passed **182/182**.

### AudioPlayer responsibility-boundary lane

```powershell
node --test --test-isolation=none --test-concurrency=1 src/voice/audio-player.test.mjs
```

Raw summary: exit 1; **20 tests / 11 pass / 9 fail**. All nine failures are sandbox `spawn EPERM` at the fake child-process start. `audio-player.mjs` is untouched by C2, but this lane is not counted as green marker-protocol evidence.

### Supplied aggregate claims

The supplied summaries were worker-free core **199/199**, brain/memory/diagnostics **145/145**, Cockpit server/settings **171/171**, aggregate **515/515**. Their exact file-list commands were not present in the reviewed artifacts, so this reviewer did not represent those numbers as independently reconstructed raw evidence. The independently rerun 105-test and 182-test subsets overlap the claimed lanes and were green. A blanket worker-free run without the curated file lists is not equivalent: process-spawning tests still execute and fail in this sandbox.

### Syntax and diff hygiene

`node --check` over all ten C2 source/test modules exited 0. `git diff --check -- <C2 targets>` exited 0 with only the repository's LF-to-CRLF working-copy warnings. The configured speech envelope cap remains exactly 4096.

## Residuals and next loop

- C3 partial-history policy is intentionally not judged here, but C2 must expose every settled private outcome before C3 can implement it safely.
- The legacy success fixture remains a trace-parity fixture; it is not evidence of live progressive marker correlation. Current focused traces establish additive fields, while the findings above show missing failure-state coverage.
- No real App Server, AivisSpeech, AudioPlayer, Runtime Player, or human audio run was performed in this review. The real Sol/low/vision and first-audible gate remains later work and cannot begin while C2 has Blockers.

## Verdict

**REVISE (loop 1).** The focused tests are green, but C2 has two Blockers: stale/premature marker commit and unrecoverable cached Channel closure. It also has three Major accepted-behavior gaps in snapshot timing, LLM-failure outcome handoff, and production temp ownership. A correction loop must address these exact findings and add the adversarial tests above before C2 can PASS.

## Loop 2 correction review

### Scope and current diff basis

Loop 2 reread the current full source and tests for every correction-attributed file, including the newly attributed `audio-player.mjs`/`.test.mjs` and `src/test-support/fake-media-player.mjs`. It also reread the complete target diff instead of accepting the correction author's summary. The tracked attribution set is currently **2,711 insertions / 249 deletions** relative to HEAD; `progressive-speech-delivery.mjs` (362 lines), its test (424 lines), and the diagnostics success fixture are untracked and were inspected in full. The repository remains broadly dirty, so unrelated earlier Runtime, identity, Cockpit, and discussion changes were not re-attributed to this correction.

No source file was changed by this review. No file was staged, committed, reverted, or broadly formatted.

### Loop 1 finding closure

#### Blocker 1 — closed

The player protocol is now additive: legacy `PLAY <path>` remains unchanged, while progressive playback uses `PLAYID\t<playbackId>\t<path>`. Both the production PowerShell resident player and the fake player echo generation-qualified `STARTED`/`ENDED`/`STOPPED`/`ERROR` markers.

The delivery adapter now requires exact playback ID plus exact path, rejects `ENDED`/`STOPPED` before matching `STARTED`, ignores duplicate/stale markers, and owns both a STARTED timeout and a post-STARTED duration-plus-margin completion watchdog. Timers are cleared only by the exact active marker. The same-path old-generation test and missing-ENDED recovery test passed, and the prior stale/premature commit probes no longer match the implementation.

#### Blocker 2 — closed

`createLazyChannel` now invalidates only the exact cached promise that reports a terminal connection error. It never retries the current ambiguous request, closes the retired handle best-effort, and permits the next Fire/request to connect once. `reply_timeout` follows that explicit retire-and-reconnect policy. Local `speech_envelope_oversize` is not terminal and preserves the healthy cache. Superseded old failures cannot clear a newer URL/cache generation.

The four focused close/timeout/oversize/stale-generation tests passed. Direct source inspection confirms the identity comparison is against the exact cached `pending`, not merely URL or connection state.

#### Major 1 — closed

Normal, manual-vision, and preferred-with-target paths now acquire an immutable resource snapshot before `thinking` and before `onFire{accepted:true}`. Preferred-without-target enters the same normal pre-publication acquisition; preferred capture failure reuses the already acquired snapshot for degraded normal Fire. The snapshot fixes the session, player facade, channel generation/URL, TTS dependencies, and configuration/revision metadata for settlement. Production setting setters advance desired revisions without mutating the active resources; the next acquisition applies them once.

The normal/vision/preferred-degraded race test changes the desired resources in the acceptance callback and proves Fire 1 uses old session/channel/player/TTS while Fire 2 uses new resources, with exactly one acquisition per accepted Fire.

#### Major 2 — closed

Every production progressive generation registers its `whenSettled()` promise immediately and routes it through a generation-ID idempotence gate to the private `onProgressiveTerminal` hook. The hook therefore receives the played watermark and terminal cause even when the outer LLM ask rejects. NG-after-prefix, LLM-reject-after-prefix, channel failure, ordinary success, and kill/fresh-generation tests all reported exactly once and did not commit a partial C2 transcript. Successful complete delivery still performs the pre-existing final transcript append once; partial-history projection remains C3 work.

#### Major 3 — closed

Default preparation now receives an exact ownership handle from `writeOwnedTempWav`. Its cleanup removes the exact WAV and only a directory created by that call, exactly once. A custom parent directory is never inferred or removed. Coordinator cleanup covers natural completion, late preparation after abort, channel failure, play failure, and dispose; the focused filesystem tests verified both file and owned-directory disappearance and idempotence.

### New finding

#### Major 1 — progressive `interrupt()` cancels a Fire while it is still thinking and no audio has started

The pre-Wave-2 interrupt contract remains explicit in `fire-orchestrator.mjs`: when Soul is not speaking, barge-in is a no-op. The progressive branch now tests only whether `currentProgressiveDelivery` exists. That object is created as soon as `session.ask` starts, before a safe sentence, TTS, `PLAY`, or matching `STARTED`. `interrupt()` therefore calls `progressive.bargeIn()` during `thinking`; the coordinator's abort succeeds even with an empty queue, so the method reports an interruption and permanently cancels the generation.

If the still-running LLM later emits a completed sentence, the boundary attempts to enqueue it into the cancelled delivery and throws. The accepted Fire becomes a generic error although no Soul audio existed to interrupt. This is reachable in production because the VAD barge-in gate forwards confirmed listener speech without consulting Fire state.

Reviewer-executed race probe, with `interrupt()` called after accepted ask start but before the first delta:

```json
{
  "interruption":{"interrupted":true,"charsSpoken":0,"prefix":""},
  "result":{"fired":false,"reason":"error","message":"progressive delivery generation is not accepting sentences (cancelled)."},
  "terminals":[{"status":"cancelled","cause":"barge-in","playedText":""}],
  "soulEntries":0
}
```

This is an existing-behavior regression and accepted Fire-state mismatch, classified Major rather than Blocker because the generation remains terminal and a later Fire is recoverable.

Correction required:

1. In the progressive path, do not call `delivery.bargeIn()` before the Fire has entered actual `speaking` ownership (matching STARTED), and return the existing `not-speaking` no-op result without cancelling the delivery.
2. Preserve interruption after the first matching STARTED, including an inter-sentence gap after an audible prefix; that case must retain the played watermark, stop future enqueue, emit the private terminal once, and permit a later Fire.
3. Add a focused race test that blocks the LLM before its first delta, calls `interrupt()`, verifies no terminal hook/cancellation, then completes the same Fire normally. Also cover PLAY-issued-but-no-STARTED and audible-prefix/inter-sentence interruption boundaries.

### Reviewer-executed raw evidence

#### Current focused integration lane

```powershell
cd apps/soul/agent
node --test --test-isolation=none --test-concurrency=1 \
  src/voice/progressive-speech-delivery.test.mjs \
  src/voice/speak.test.mjs \
  src/channel/channel-client.test.mjs \
  src/mind/fire-orchestrator.test.mjs \
  scripts/cockpit.test.mjs
```

Raw summary: exit 0; **196 tests / 196 pass / 0 fail**, duration 5,233.0404 ms.

The earlier C1 related regression file list, rerun against the corrected current tree, passed **225/225**. This is broader than the supplied **213/213** claim because the current Fire/Cockpit files now contain additional C2 correction tests. The supplied exact 213-test file/pattern command was not present, so this review does not fabricate that count; it instead records the independently reconstructed 196- and 225-test green lanes.

#### Exact correction slices

- marker authentication, completion watchdog, and owned-temp tests: **5/5 pass**;
- lazy-channel close/timeout/oversize/stale-generation tests: **4/4 pass**;
- orchestrator tests whose names begin `C2`: **7/7 pass**;
- exact serialized-envelope bytes and 4096 preflight: **2/2 pass**;
- diagnostics production-hook fixture parity and measured-byte/timing identity: **2/2 pass**;
- Claude one-shot, non-streaming fallback, and vision C1 regression slice: **3/3 pass**.

The AudioPlayer correction-only pattern (`writeOwnedTempWav|playbackId`) passed **2/2**. The full AudioPlayer file collected **22 tests / 13 pass / 9 fail**; all nine failures are the unchanged sandbox `spawn EPERM` child-process restriction.

#### Repository-standard runner

`npm test` collected 59 test files and passed **0/59**. Every file failed at test-worker creation with `spawn EPERM` before module collection. This remains environment evidence only, not a source assertion failure and not green evidence.

#### Syntax, diff, cap, and dependency boundary

`node --check` passed for all 13 current C2 source/test modules. `git diff --check -- <C2 targets>` passed with only LF-to-CRLF working-copy warnings. `SPEECH_ENVELOPE_UTF8_CAP` remains exactly **4096**. No package manifest or lockfile is changed by the reviewed attribution. Runtime files are broadly dirty from the existing shared baseline but are outside the loop 2 correction attribution; this review made no Runtime change.

### Residuals

- The legacy diagnostics fixture remains trace-parity evidence, not a live AudioPlayer proof. Exact serialized bytes are derived from the same string passed to `socket.send`, and progressive job/playback/request correlation is present in passive traces; real-device timings remain for the later human gate.
- C3 still owns visible partial-history/interruption projection and next-turn correction. Loop 2 correctly keeps private played text out of public Fire results and avoids partial transcript policy in C2.
- The standard worker runner and nine fake-child AudioPlayer cases remain sandbox-limited. The worker-free focused evidence is green and sufficient to judge source behavior, but it does not substitute for the planned real PowerShell/WinRT human gate.

## Loop 2 verdict

**REVISE (loop 2) — Blocker 0 / Major 1 / Minor 0.** All five loop 1 findings are independently closed, and the corrected focused lanes are green. C2 cannot PASS yet because progressive barge-in cancels an accepted Fire during `thinking`, before any authenticated playback has started, violating the existing no-op contract and converting a later delta into a Fire error. The next loop should be limited to that state gate and its three race boundaries; the already closed marker, channel, snapshot, private-terminal, and temp-ownership work should not be reopened absent regression evidence.

## Loop 3 final correction review

### Scope and source decision

Loop 3 independently inspected the current full `progressive-speech-delivery.mjs`/`.test.mjs` and `fire-orchestrator.mjs`/`.test.mjs`, their complete current diffs, and the unchanged seams closed in loops 1–2. The correction is limited to two state facts:

- delivery records `hasAudiblyStarted` only after an exact playback-ID/path `STARTED`, and retains it across an inter-sentence gap;
- the orchestrator stops the Fire-local incremental boundary only after a real barge-in, kill, or dispose cancellation, so late LLM deltas cannot enqueue into a closed generation.

No source implementation was changed by this review. No file was staged, committed, reverted, or broadly formatted.

### Loop 2 Major closure

The loop 2 race is closed. Before the first authenticated STARTED, both the delivery-level `bargeIn()` and orchestrator-level `interrupt()` are non-mutating no-ops. They do not change delivery status, do not settle the private terminal hook, do not stop the incremental boundary, and do not prevent the same Fire from later completing.

The three required ownership boundaries were verified independently:

1. **Ask started, no first delta:** `interrupt()` returns exactly `{interrupted:false, reason:"not-speaking"}`. The same boundary later accepts its first delta, prepares/plays it, and the Fire completes normally with one completed private terminal.
2. **PLAY issued, no matching STARTED:** `interrupt()` returns the same no-op result, does not call player stop, and does not emit a terminal. The later exact STARTED/ENDED completes that same Fire.
3. **Authenticated STARTED followed by prefix ENDED and an inter-sentence gap:** `hasAudiblyStarted` remains true, so `interrupt()` succeeds. It preserves the completed prefix watermark and `barge-in` cause, reports the private terminal exactly once, stops the incremental boundary before any await, rejects late job resurrection, and permits a fresh later Fire to complete.

The last case returned `{interrupted:true, charsSpoken:3, prefix:"先行。"}`; the first terminal retained `playedText:"先行。"` and `terminalCause:"barge-in"`. After the held LLM emitted a late second sentence, player activation count remained one and terminal count remained one. Fire 2 then activated and completed a fresh generation.

### Kill and dispose remain authoritative before STARTED

The STARTED gate applies only to barge-in. `kill()` and `dispose()` still abort before the first delta/STARTED and now also stop the incremental boundary, preventing the callback-throw regression that would otherwise arise from a late completed sentence.

Reviewer probe raw summaries:

```json
{"action":"kill","actionResult":{"killed":true,"severed":false,"charsSpoken":0,"prefix":""},"result":{"fired":false,"reason":"killed-inflight","injectedChars":12,"includedCount":1},"terminals":[{"status":"cancelled","cause":"killed","playedText":""}],"plays":[]}
{"action":"dispose","actionResult":"disposed-called","result":{"fired":false,"reason":"disposed","progressive":{"generationId":"fire-1","status":"cancelled","terminalCause":"disposed","enqueuedSentenceCount":0,"completedSentenceCount":0,"playedChars":0},"injectedChars":12,"includedCount":1},"terminals":[{"status":"cancelled","cause":"disposed","playedText":""}],"plays":[]}
```

Both paths terminalized once, created no playback, accepted no late sentence job, and returned their intended terminal reason.

### Closed-area regression review

No regression was found in the five loop 1 closures or the other C2/C1 boundaries:

- playback remains `PLAYID`-qualified while legacy `PLAY` is unchanged; exact STARTED/path/ID ordering, duplicate/stale markers, completion watchdog, and later-Fire recovery remain green;
- lazy-channel close/timeout retirement, no ambiguous retry, healthy oversize reuse, and exact stale-generation isolation remain green;
- normal/vision/preferred-degraded accepted-Fire resource snapshots remain pre-publication and immutable through settlement;
- success, NG, LLM rejection, activation failure, kill, barge, and dispose retain one private terminal outcome without partial C2 transcript commit;
- exact owned WAV/directory cleanup remains once-only across natural, late, channel, play, and dispose paths;
- one Fire remains one ask/App Server turn, FIFO/active-audio<=1 and dual LLM/queue terminal behavior remain green;
- Claude/non-streaming one-shot fallback, vision, the three Codex route, C1 buffer behavior, and the 4096 exact-envelope preflight remain unchanged.

### Reviewer-executed raw evidence

#### Exact loop 3 slice

```powershell
cd apps/soul/agent
node --test --test-isolation=none --test-concurrency=1 \
  --test-name-pattern='C2 (delivery: barge-in|barge gate:)' \
  src/voice/progressive-speech-delivery.test.mjs \
  src/mind/fire-orchestrator.test.mjs
```

Raw summary: exit 0; **4 tests / 4 pass / 0 fail**, duration 39.4428 ms.

#### Worker-free C2 and foundation regression lane

```powershell
node --test --test-isolation=none --test-concurrency=1 \
  src/mind/incremental-sentence-tag-buffer.test.mjs \
  src/voice/tts-playback-coordinator.test.mjs \
  src/voice/progressive-speech-delivery.test.mjs \
  src/voice/speak.test.mjs \
  src/channel/channel-client.test.mjs \
  src/mind/fire-orchestrator.test.mjs \
  scripts/cockpit.test.mjs
```

Raw summary: exit 0; **217 tests / 217 pass / 0 fail**, duration 5,233.7021 ms. This reproduces the supplied 217-test claim and includes the Wave 1 sentence/coordinator primitives, all C2 delivery/Fire tests, channel exact-byte/preflight coverage, Claude and vision regressions, and Cockpit lazy-channel/settings seams.

#### AudioPlayer closed slice

The correction-independent AudioPlayer ownership/protocol pattern (`writeOwnedTempWav|playbackId`) passed **2/2**, duration 20.4168 ms.

#### Repository-standard runner and hygiene

`npm test` again collected 59 files and passed **0/59**. Every file failed at test-worker creation with sandbox `spawn EPERM` before module collection; there was no implementation assertion failure.

`node --check` passed for all four loop 3 source/test files. `git diff --check -- <loop 3 targets>` passed with only the existing LF-to-CRLF warnings. `SPEECH_ENVELOPE_UTF8_CAP` remains exactly **4096**, and no package manifest or lockfile changed in the reviewed attribution.

### Residuals

- C3 still owns visible partial-history/interruption projection and next-turn correction; C2 exposes the required private watermark/cause without preempting that policy.
- The repository-standard worker runner and real PowerShell/WinRT playback remain environment/human-gate work. They do not contradict the fully green worker-free C2 mechanical evidence.
- No Minor issue was found in the bounded correction. General refactoring of the boundary snapshot or terminal-ID set is neither required nor justified by this review.

## Loop 3 verdict

**PASS (loop 3) — Blocker 0 / Major 0 / Minor 0.** The only loop 2 Major is closed at the exact pre-delta, pre-STARTED, and post-STARTED inter-sentence boundaries. Kill/dispose retain pre-STARTED authority, late callbacks cannot resurrect jobs, all earlier C2 closures remain green, and the required 217-test focused/foundation lane passes. C2 is ready for the next gated Wave 2 review unit; real-device and C3 behavior remain explicitly outside this verdict.
