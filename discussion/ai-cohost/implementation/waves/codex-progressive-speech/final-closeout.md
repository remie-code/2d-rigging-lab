# Codex Progressive Speech — final closeout

- Outcome: **MECHANICAL PASS / HUMAN GATE PENDING**
- Final mechanical findings: **Blocker 0 / Major 0 / Minor 1**
- This closes the planned source and mechanical-review work only. No real-device or human pass is claimed.

## Review ledger

| Unit / gate | Final result | Review loops |
|---|---|---:|
| A1 stream transport | PASS | 2 |
| A2 session lifecycle | PASS | 1 |
| B1 sentence playback | PASS | 2 |
| B2 payload/failure isolation | PASS | 1 |
| C1 incremental boundary | PASS | 1 |
| C2 Fire state machine | PASS | 3 |
| C3 partial conversation | PASS | 2 |
| Wave 2 integration | PASS | 1 |
| Final mechanical | MECHANICAL PASS, B0 / M0 / m1 | 1 |
| Human gate | **PENDING** | — |

The REVISE rounds are preserved in the individual review records. Their Blocker and Major findings were closed before the final PASS verdicts.

## Production outcome and accepted invariants

The three Codex brains use App Server sessions; GPT-5.6 Sol remains `gpt-5.6-sol` at low effort. A Fire retains one assistant ask/turn, and sentence chunks are only TTS/playback jobs. Healthy Fires continue on the same App Server thread, while fatal transport state must pass its invalidation/reap barrier before replacement. Claude remains on its existing non-progressive path.

Mandatory vision remains image-first. Each accepted Fire snapshots its brain/session and prompt revisions, memory/context and conversation instruction, audio/player generation, Channel URL/connection generation, and TTS dependencies before acceptance becomes visible. Mid-Fire setting changes apply to the next accepted Fire.

Codex deltas enter one pure incremental buffer once. The first safe sentence is delivered immediately without a minimum-length merger; the final remainder flushes once. Expression/control tags never become speech, and cross-delta NG scanning stops the remaining delivery without retracting an already completed safe prefix.

TTS preparation overlaps generation, while FIFO activation keeps active audio at zero or one. Control Channel acceptance precedes the matching WAV start. Fire/generation-qualified playback ID, exact path, matching STARTED, watchdogs, and exact terminal ownership reject stale, reordered, duplicate, or late markers. Kill, dispose, authenticated post-STARTED barge-in, failures, and late callbacks cannot resurrect an old queue; pre-STARTED barge-in remains a no-op.

LLM terminal and playback-queue terminal are separate. A Fire succeeds only after both settle. A completed spoken prefix followed by failure becomes the sole visible assistant truth plus one restrained interruption note; unheard suffixes, tags, and NG content do not enter transcript, memory, or digest. The next actual ask consumes one private continuity correction without creating another Fire, user line, or App Server turn. Zero-spoken genuine failures keep the established normal Fire-error experience and do not create partial history or self-spoke state.

The Soul and Runtime byte cap remains exactly **4096**. Exact serialized UTF-8 preflight, no blind retry, content-free passive correlation, one-turn/same-thread behavior, Sol-low selection, and vision requirements are preserved.

## Feature-attributed files

The final mechanical review bounded the feature to **24 unique source/test/fixture paths**: 17 tracked modifications and 7 new untracked files at review time. Attribution is by feature hunk where a shared file also contains user or concurrent work.

### Wave 1A — App Server transport and session routing

- `apps/soul/agent/src/mind/codex-session.mjs`
- `apps/soul/agent/src/mind/codex-session.test.mjs`
- `apps/soul/agent/src/mind/brains.mjs`
- `apps/soul/agent/src/mind/brains.test.mjs`

### Wave 1B — incremental delivery primitives and boundary isolation

- `apps/soul/agent/src/mind/incremental-sentence-tag-buffer.mjs`
- `apps/soul/agent/src/mind/incremental-sentence-tag-buffer.test.mjs`
- `apps/soul/agent/src/voice/tts-playback-coordinator.mjs`
- `apps/soul/agent/src/voice/tts-playback-coordinator.test.mjs`
- `apps/soul/agent/src/channel/channel-client.mjs`
- `apps/soul/agent/src/channel/channel-client.test.mjs`
- `apps/runtime-player/src/main/control-channel/control-channel-overlay-store.ts`
- `apps/runtime-player/src/main/control-channel/control-channel-overlay-store.test.ts`

The Channel result-correlation additions used by Wave 2 are approved additive integration hunks in the two Wave 1B Channel files above and are counted once. They do not alter the protocol, timeout/close policy, retry policy, or 4096 limit.

### Wave 2 — production Fire integration and conversation continuity

- `apps/soul/agent/src/mind/fire-orchestrator.mjs`
- `apps/soul/agent/src/mind/fire-orchestrator.test.mjs`
- `apps/soul/agent/scripts/cockpit.mjs`
- `apps/soul/agent/scripts/cockpit.test.mjs`
- `apps/soul/agent/src/voice/progressive-speech-delivery.mjs`
- `apps/soul/agent/src/voice/progressive-speech-delivery.test.mjs`
- `apps/soul/agent/src/voice/speak.mjs`
- `apps/soul/agent/src/voice/speak.test.mjs`
- `apps/soul/agent/src/voice/audio-player.mjs`
- `apps/soul/agent/src/voice/audio-player.test.mjs`
- `apps/soul/agent/src/test-support/fake-media-player.mjs`
- `apps/soul/agent/src/mind/fixtures/fire-diagnostics.success.jsonl`

The staged `speak` split, Channel result metadata, and AudioPlayer playback identity/temp ownership are approved minimum integration hunks around the Wave 1 primitives. Existing one-shot `speak()` compatibility and AudioPlayer protocol behavior remain intact.

Identity, conversation-instruction, Cockpit settings/UI, unrelated passive-diagnostics and Runtime work, agent profiles, Expo artifacts, other reports, and other dirty-worktree hunks are user/concurrent work and are not attributed to this feature.

## Persistent records

- [Wave plan](../../orchestration/codex-progressive-speech-wave-plan.md)
- [Wave 1A completion](wave1a-app-server-transport.md)
- [Wave 1B completion](wave1b-speech-delivery.md)
- [Wave 2 completion](wave2-progressive-fire.md)
- [A1 review](../../reviews/codex-progressive-speech/a1-stream-transport.md)
- [A2 review](../../reviews/codex-progressive-speech/a2-session-lifecycle.md)
- [B1 review](../../reviews/codex-progressive-speech/b1-sentence-playback.md)
- [B2 review](../../reviews/codex-progressive-speech/b2-payload-failure-isolation.md)
- [C1 review](../../reviews/codex-progressive-speech/c1-incremental-boundary.md)
- [C2 review](../../reviews/codex-progressive-speech/c2-fire-state-machine.md)
- [C3 review](../../reviews/codex-progressive-speech/c3-partial-conversation.md)
- [Wave 2 integration review](../../reviews/codex-progressive-speech/wave2-integration.md)
- [Final mechanical review](../../reviews/codex-progressive-speech/final-mechanical.md)
- [Human gate procedure and pending record](human-gate.md)

## Final mechanical evidence

Counts are per command and overlap; they must not be summed.

### Standard runner and worker-free fallback

From `apps/soul/agent`:

```powershell
node --test src/mind/fire-orchestrator.test.mjs
```

This standard isolated runner exited 1 before module collection: **tests 1 / pass 0 / fail 1**, with `ChildProcess.spawn` reporting `EPERM`. It is retained as non-green environment evidence, not represented as a source failure or a pass.

The reproducible fallback disabled Node's test-worker process and serialized the same integrated lane:

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

Result: **Soul worker-free 491/491 pass**, 0 fail, 0 skipped. This changes only test execution isolation; it does not skip assertions. The exact Fire slices also passed C1 **4/4**, C2 **10/10**, and C3 **8/8**.

AudioPlayer's full permitted no-real-device process-spawn run passed **22/22**. In the restricted sandbox, the safe ownership slice passed 2/2; the full file recorded 13 pass and 9 `spawn EPERM` failures while starting the injected silent fake child. These environment failures are separated from the permitted 22/22 result.

### Runtime lanes

From `apps/runtime-player`, the focused permitted worker-reduced command was:

```powershell
pnpm.cmd exec vitest run -c vitest.config.ts \
  src/main/control-channel/control-channel-overlay-store.test.ts \
  src/main/control-channel/channel-websocket-connection.test.ts \
  src/main/control-channel/channel-server-events.test.ts \
  src/main/control-channel/fire-diagnostics.test.ts \
  --pool=threads --maxWorkers=1 --no-file-parallelism
```

Result: **4 files / 39 tests pass**. The permitted full Runtime suite with the same worker-reduced options passed **142 files / 934 tests**, 0 fail, 0 pending. `pnpm.cmd typecheck` also **PASS**. The initial restricted focused run failed before config collection because esbuild could not spawn (`EPERM`); the identical permitted command produced the recorded result.

Syntax checking passed for 10 production modules. Targeted diff checking passed, package-manifest and lockfile status/diffs were empty, and direct source checks confirmed Soul and Runtime remain at 4096.

## Accepted residual and pending gates

Final mechanical review records one accepted Minor: `reportedProgressiveGenerations` retains completed generation IDs in a non-shrinking `Set`. Entries are small, and current ownership tests show no correctness or user-visible UX impact. It is a bounded maintainability/lifetime follow-up if long-lived high-Fire sessions later make accumulation material; it does not reopen this implementation round.

No real App Server/model + AivisSpeech + WinRT AudioPlayer + Runtime Player run has occurred. First-audible latency, natural gaps, real marker/lip-sync timing, interruption readability, and real same-thread conversational quality remain for the [human gate](human-gate.md), whose outcome is **PENDING** and whose measurements remain blank.

The real per-chunk serialized-byte distribution has not been measured. The cap remains **4096** for the passive real run; retaining, raising, removing, or subdividing it is a later user decision and is **PENDING**.

No dependency or lockfile change, diagnostic UI, public telemetry framework, Claude progressive path, cap change, or broader Runtime audio ownership was added. No stage or commit was performed.
