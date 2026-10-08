# Final mechanical review — Codex Progressive Speech

- Verdict: **MECHANICAL PASS**
- Findings: **Blocker 0 / Major 0 / Minor 1**
- Reviewer: fresh independent Review-Sylph
- Human gate: **PENDING**
- 4096-byte decision: **PENDING — deferred to the post-human-run user decision gate**

## Review basis and independence

This review independently inspected the current basis documents, all seven final unit reviews and their preserved loop histories, both Wave 1 completion reports, the Wave 2 completion report, the Wave 2 narrow integration review, the human procedure, the current target source/tests, tracked dirty hunks, relevant untracked whole files, passive diagnostics seams, and fresh raw test results. Source implementation, completion reports, closeout, and the human-gate document were not edited.

The worktree is shared and broadly dirty. Identity, conversation-instruction, Cockpit settings/UI, passive diagnostics, other Runtime work, agent profiles, documentation, Expo artifacts, and other reports remain user/concurrent work. This verdict attributes only the bounded progressive-speech files/hunks described below; it does not claim or normalize the rest of the worktree. No stage, commit, revert, or broad format operation was performed.

## Unit review and loop ledger

| Unit | Final loop / verdict | Final findings | Preserved review history |
|---|---|---|---|
| A1 stream transport | loop 2 — PASS | B0 / M0 / m0 | loop 1 found the fatal transport reap/reset-barrier Blocker; loop 2 records source, focused-test, and adversarial-probe closure. The stale `ttftMs` comment was also corrected. |
| A2 session lifecycle | loop 1 — PASS | B0 / M0 / m0 | First review passed same-thread continuity, snapshotting, dispose/reap, late-callback suppression, and next-ask recovery. |
| B1 sentence/playback | loop 2 — PASS | B0 / M0 / m0 | loop 1 REVISE: B1 / M2 / m0; loop 2 closes cross-generation playback identity, malformed-angle fragmentation, and cleanup coverage. |
| B2 payload/failure isolation | loop 1 — PASS | B0 / M0 / m0 | First review passed exact serialization/preflight, ambiguous-send isolation, passive diagnostics, and Runtime boundary checks. |
| C1 incremental boundary | loop 1 — PASS | B0 / M0 / m0 | First review passed one-entry delta flow, immediate first safe sentence, one flush, tag exclusion, and cross-delta NG handling. |
| C2 Fire state machine | loop 3 — PASS | B0 / M0 / m0 | loop 1 REVISE: B2 / M3 / m0; loop 2 REVISE: B0 / M1 / m0; loop 3 closes the pre-STARTED barge race after the marker, reconnect, snapshot, private-terminal, and temp-ownership closures. |
| C3 partial conversation | loop 2 — PASS | B0 / M0 / m0 | loop 1 REVISE: B0 / M1 / m0; loop 2 closes the zero-completed normal-error projection with two independent failure causes and later-Fire recovery. |

All seven final review states are PASS with zero final Blocker/Major. Histories retain the actual REVISE rounds and finding counts instead of presenting first-pass success.

## Foundation and integration gates

- Wave 1A completion records A1 PASS loop 2 and A2 PASS loop 1. Current source still uses one persistent App Server thread per session, one `turn/start` per ask, ordered `item/agentMessage/delta`, exact delta/final agreement, image-first `localImage`, invalidation/reap barriers, and fresh-process/thread recovery after fatal failure.
- Wave 1B completion records B1 PASS loop 2 and B2 PASS loop 1. Current pure buffer, FIFO coordinator, exact serialized-byte preflight, reusable-connection failure isolation, and Runtime overlay seam match that foundation.
- Wave 2 completion records C1 PASS loop 1, C2 PASS loop 3, and C3 PASS loop 2 without claiming the mechanical or human gate.
- `wave2-integration.md` is a narrow seam review with PASS and B0 / M0 / m0. Fresh source inspection and the current integrated lanes below reproduce its ordered-delta → sentence job → authenticated playback → canonical transcript/correction chain.

## Current behavior audit

### Provider, thread, turn, and vision boundaries

- `brains.mjs` routes `codex`, `codex-55`, and `codex-56-sol` through `createCodexSession`; Sol remains `gpt-5.6-sol` with `effort: "low"`. Claude still uses `createLlmSession`.
- One accepted Fire performs one `session.ask`; sentence chunks create no LLM ask/turn. Healthy ordinary Fires reuse the App Server thread. Fatal transport state is invalidated and reaped before replacement.
- Vision input remains mandatory where selected and image-first. The first text block receives system/correction text without moving the preceding image block.

### Sentence, queue, and lifecycle boundaries

- Each delta enters one Fire-local pure buffer once. Completed punctuation is emitted synchronously with no minimum-length merger; successful ask completion flushes the unterminated remainder once.
- Expression/control tags are withheld across fragmentation and never become speech. Cross-delta NG text stops later delivery while preserving an already authenticated completed prefix.
- TTS preparation may overlap, but the coordinator starts only the ready queue head. Playback IDs include a module-lifetime coordinator generation, active playback is 0 or 1, and only exact playback ID plus exact WAV path with matching STARTED can authorize ENDED/STOPPED.
- Kill, dispose, post-STARTED barge-in, inter-sentence-gap barge-in, marker timeout, late preparation, stale/duplicate marker, and lazy-Channel failure all close only the owned generation. Pre-STARTED barge-in remains a no-op. Later-Fire recovery is directly covered.
- Accepted-Fire resource acquisition snapshots session/brain/configuration, prompt/memory/instruction context, audio/player/channel state, and TTS dependencies. `fireClaimed` closes the acquisition window; setting writes apply at the next accepted Fire.

### Canonical partial truth and continuity

- A non-complete generation with a completed watermark appends exactly `playedText + one fixed interruption note` once. It does not append or replay queued/unheard suffixes, tags, or NG content.
- A genuine zero-completed delivery failure returns the established `{ reason: "error" }` path with exactly one `fireError`; it creates no partial note, correction, transcript, or self-spoke event.
- The next actual ask consumes the private continuity correction once. Pre-ask resource/vision failure preserves it; an invoked but ambiguously failed ask consumes it to avoid replay. It creates no extra user transcript line, Fire, ask, or turn.
- Transcript, digest input, and self-fire refractory state share the canonical append. Full responses carry no interruption metadata; partial audible speech counts as Soul speech; zero-spoken failure does not.

### Measurement, diagnostics, cap, and responsibility

- Soul constructs one actual outgoing envelope string, measures `Buffer.byteLength(serialized, "utf8")`, sends that same string, and rejects only when bytes are `> 4096`. Runtime still accepts 4096 and observes 4097 as oversize.
- Fire/job/playback/request/connection generation and counts/timings are sufficient to correlate first delta, first safe sentence, preparation, activation, STARTED/ENDED/error, queue settlement, and terminal cause. New passive trace fields are content-free; full `playedText` is confined to the private canonical-projection seam.
- The cap is exactly 4096 in Soul and Runtime. No cap redesign, subdivision, diagnostic UI, public telemetry framework, Claude streaming, or Runtime audio ownership was added.
- Package manifests and lockfiles have empty status/diff for this feature. Runtime responsibility expansion is limited to the accepted additive Control Channel observation/timeline seam.

## Changed-file scope summary

The current bounded target set contains **24 source/test/fixture paths: 17 tracked modified and 7 untracked additions**. Attribution is logical-hunk based where files also contain concurrent changes.

- Wave 1A: `codex-session.mjs` / test and the Codex routing hunks in `brains.mjs` / test.
- Wave 1B: new incremental buffer / test, new playback coordinator / test, exact-byte/failure-isolation hunks in `channel-client.mjs` / test, and Runtime overlay-store / test.
- Wave 2: `fire-orchestrator.mjs` / test, Cockpit session/projection integration hunks / tests, new progressive delivery / test, compatible staged `speak` hunks / tests, channel result-correlation hunks / tests, AudioPlayer `PLAYID` and owned-temp hunks / tests/fake, and the progressive diagnostics success fixture.
- Runtime WebSocket/diagnostics files exercised below include concurrent passive-diagnostics work and are regression evidence, not falsely attributed as Wave 2 implementation.

No unrelated dirty path was edited, reverted, staged, committed, or included in the feature attribution.

## Reviewer-executed commands and raw results

Counts below are per command and overlap; they must not be summed.

### Standard Node runner — non-green environment evidence

```powershell
cd apps/soul/agent
node --test src/mind/fire-orchestrator.test.mjs
```

Exit 1: **tests 1 / pass 0 / fail 1**, duration 8.5462 ms. Failure occurred at test-worker `ChildProcess.spawn` with `Error: spawn EPERM` before module collection or implementation assertions. This is recorded as non-green environment evidence, not as passing evidence.

### Worker-free integrated Soul lane

```powershell
node --test --test-isolation=none --test-concurrency=1 \
  src/mind/codex-session.test.mjs \
  src/mind/brains.test.mjs \
  src/mind/incremental-sentence-tag-buffer.test.mjs \
  src/voice/tts-playback-coordinator.test.mjs \
  src/voice/progressive-speech-delivery.test.mjs \
  src/voice/speak.test.mjs \
  src/channel/channel-client.test.mjs \
  src/mind/fire-orchestrator.test.mjs \
  scripts/cockpit.test.mjs \
  src/cockpit/cockpit-server.test.mjs \
  src/ears/transcript-buffer.test.mjs \
  src/mind/memory.test.mjs \
  src/mind/fire-scheduler.test.mjs \
  src/mind/fire-diagnostics.test.mjs
```

Exit 0: **491 tests / 491 pass / 0 fail / 0 skipped**, duration 7,242.9181 ms. This is the current integrated App Server/session/brain, buffer/coordinator/delivery/speak/channel, Fire/Cockpit, transcript/memory/self-fire, and diagnostics lane.

Exact current Fire slices:

- `--test-name-pattern='C1:'`: **4/4 pass**.
- `--test-name-pattern='C2'`: **10/10 pass**.
- `--test-name-pattern='C3'`: **8/8 pass**.

The current malformed/tag fragmentation probe enumerated every three-piece partition for four representative strings: **305/305 partitions pass**, with no emitted `<` or `>`. Existing expression parser plus mora/timeline regressions passed **33/33**.

### AudioPlayer marker/cleanup and fake-child separation

```powershell
node --test --test-isolation=none --test-concurrency=1 \
  --test-name-pattern='writeOwnedTempWav|playbackId' \
  src/voice/audio-player.test.mjs
```

Sandbox-safe correction slice: **2/2 pass**.

The full same-process AudioPlayer file in the sandbox was deliberately kept non-green: **22 tests / 13 pass / 9 fail**; all nine failures were `spawn EPERM` while starting the injected silent fake child. The identical full command under permitted process-spawn execution used no real speaker/device and passed **22/22**, duration 379.4373 ms.

### Runtime focused and full worker-reduced lanes

The sandbox focused Vitest command failed before config collection because esbuild could not spawn (`spawn EPERM`). The identical permitted worker-reduced command was then used:

```powershell
cd apps/runtime-player
pnpm.cmd exec vitest run -c vitest.config.ts \
  src/main/control-channel/control-channel-overlay-store.test.ts \
  src/main/control-channel/channel-websocket-connection.test.ts \
  src/main/control-channel/channel-server-events.test.ts \
  src/main/control-channel/fire-diagnostics.test.ts \
  --pool=threads --maxWorkers=1 --no-file-parallelism
```

Exit 0: **4 files / 39 tests pass / 0 fail** (29 + 6 + 2 + 2), duration 1.18 s.

The permitted full Runtime suite with the same worker-reduced options and JSON aggregation reported `success: true`: **142 files / 934 tests pass / 0 fail / 0 pending**. `pnpm.cmd typecheck` also passed (`tsc --noEmit -p tsconfig.json`).

### Syntax, diff, dependency, and cap hygiene

- `node --check` passed for **10** production entry/modules: Codex session, brains, incremental buffer, coordinator, progressive delivery, channel client, Fire orchestrator, Cockpit entry, speak, and AudioPlayer.
- `git diff --check -- <17 tracked target paths>` exited 0 with no whitespace errors; output contained only LF→CRLF working-copy warnings. New untracked JavaScript modules were covered by `node --check` and tests.
- `git status --short` and `git diff --name-only` for root/Soul/Runtime package manifests and lockfiles were empty.
- Direct source check: Soul `SPEECH_ENVELOPE_UTF8_CAP = 4096`; Runtime `controlChannelMaxClientMessageBytes = 4096`; Runtime focused test fixes exact 4096 acceptance and 4097 oversize observation.

No command used a real model, model quota, real AivisSpeech, real WinRT playback device, or external network.

## Finding

### Minor 1 — progressive terminal tombstones grow for the orchestrator lifetime

`fire-orchestrator.mjs` stores every completed progressive `generationId` in `reportedProgressiveGenerations` and does not bound or clear that Set. The entry is small and current single-flight/terminal tests show no correctness or user-visible effect; therefore this is a maintainability/lifetime residual, not a Blocker or Major, and it does not require another implementation round under plan §8. A later cleanup may replace it with bounded exact-once ownership if long-lived high-Fire sessions make the accumulation meaningful.

## Residual gates and decision boundary

- No real App Server/model + AivisSpeech + WinRT AudioPlayer + Runtime Player run was performed. First-audible latency, natural sentence gaps, actual lip-sync/marker timing, subjective interruption readability, and real same-thread conversational quality remain human observations.
- The human procedure asks the user only to operate the normal applications; raw diagnostics, IDs, byte calculations, queue state, and log analysis remain agent work. Its record is still **PENDING** and claims no pass.
- The real per-chunk serialized-byte distribution has not been measured. The value remains exactly **4096** for observation; retain, raise, remove, or subdivide remains a separate user decision and is **pending**.
- Existing fake/probe-shaped mechanical evidence is sufficient for the source gate, but it is not represented as real-device or human evidence.

## Mechanical verdict

**MECHANICAL PASS** — Blocker 0 / Major 0 / Minor 1. All seven behavioral units and the Wave 2 narrow integration are final PASS; current worker-free/permitted Soul and Runtime evidence is green; accepted provider, vision, same-thread, one-turn, FIFO, lifecycle, partial-truth, correction, diagnostics, cap, dependency, and responsibility boundaries are preserved. **HUMAN GATE PENDING; 4096 DECISION PENDING.**
