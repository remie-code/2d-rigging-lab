# Passive Fire Diagnostics D1 — final closeout

- Mechanical gate: **PASS**
- Independent review: **PASS**, loop **3 / 5**, blocking findings **0**
- Accepted User Gate: **PENDING**
- D2/D3: **not launched**

## 1. Loop record

- Domain A / Soul: initial implementation, then two targeted repair turns. Review loop 1 found three Domain A blockers; loop 2 confirmed A-1 and A-3 resolved and returned one narrowed A-2R blocker; loop 3 confirmed all resolved.
- Domain B / Runtime Player: one implementation turn. Integrated review found no Domain B blocker or later regression.
- Independent integrated review: three loops. Final evidence is [final-review.md](../../reviews/fire-diagnostics/final-review.md).

## 2. Automatic diagnostic locations and bounds

### Soul

```text
apps/soul/agent/fire-diagnostics/fire-<ISO-safe timestamp>-<sequence>.jsonl
```

- Enabled automatically by normal Cockpit startup; no toggle, UI, copy, save, or terminal operation is added.
- Keeps the latest **5** `fire-*.jsonl` runs.
- Writes and pruning use a serialized best-effort asynchronous queue; the Fire path does not await it.
- The queue is bounded at **128** pending tasks. Overflow drops new diagnostic tasks rather than delaying Fire; a missing event must therefore be treated as unknown.
- Write/prune failures are nonfatal and later queued work can continue.

### Runtime Player

```text
{app.getPath("userData")}\ai-cohost-fire-diagnostics\runtime-player\control-channel.jsonl
```

- Enabled automatically when the autonomous Control Channel is composed.
- Bounded by overwrite-on-process-start: one current Runtime Player process trace remains at the deterministic per-slot app-data path.
- Writes are incremental, best effort, and not awaited by Control Channel operation. Initialization/write failures are nonfatal.

Both traces keep content-free timings, counts, stage/code, and correlation metadata only. They do not store API keys/tokens, URLs, prompts, conversation or speech text, transcript text, image/audio/WAV bodies, binary frame bodies, or exception messages.

## 3. Changed files by domain

### Domain A — Soul

- `apps/soul/agent/.gitignore`
- `apps/soul/agent/scripts/cockpit.mjs`
- `apps/soul/agent/src/channel/channel-client.mjs`
- `apps/soul/agent/src/channel/channel-client.test.mjs`
- `apps/soul/agent/src/mind/fire-diagnostics.mjs`
- `apps/soul/agent/src/mind/fire-diagnostics.test.mjs`
- `apps/soul/agent/src/mind/fixtures/fire-diagnostics.success.jsonl`
- `apps/soul/agent/src/mind/fixtures/fire-diagnostics.failure.jsonl`
- `apps/soul/agent/src/mind/fire-orchestrator.mjs`
- `apps/soul/agent/src/mind/fire-orchestrator.test.mjs`
- `apps/soul/agent/src/test-support/ws-double.mjs`
- `apps/soul/agent/src/voice/speak.mjs`
- `apps/soul/agent/src/voice/speak.test.mjs`
- `discussion/ai-cohost/implementation/waves/fire-diagnostics/domain-a.md`

### Domain B — Runtime Player

- `apps/runtime-player/src/main/control-channel/fire-diagnostics.ts`
- `apps/runtime-player/src/main/control-channel/fire-diagnostics.test.ts`
- `apps/runtime-player/src/main/control-channel/channel-websocket-frame.ts`
- `apps/runtime-player/src/main/control-channel/channel-websocket-connection.ts`
- `apps/runtime-player/src/main/control-channel/channel-websocket-connection.test.ts`
- `apps/runtime-player/src/main/control-channel/channel-server.ts`
- `apps/runtime-player/src/main/control-channel/channel-server-events.test.ts`
- `apps/runtime-player/src/main/control-channel/fixtures/fire-diagnostics-runtime-sample.jsonl`
- `apps/runtime-player/src/main/runtime-player-main.ts`
- `discussion/ai-cohost/implementation/waves/fire-diagnostics/domain-b.md`

### Orchestration and review records

- `discussion/ai-cohost/implementation/reviews/fire-diagnostics/final-review.md`
- `discussion/ai-cohost/implementation/waves/fire-diagnostics/final-closeout.md`
- `discussion/ai-cohost/implementation/waves/fire-diagnostics/human-gate.md`
- narrow status/link updates in the wave plan and existing implementation/orchestration maps

The worktree already contained extensive user-owned Soul/Cockpit/settings/identity, profile, discussion, and Expo changes. D1 agents used scoped hunks, did not revert or broadly format them, and did not stage or commit.

## 4. Log-only reconstruction evidence

Fixtures:

- `apps/soul/agent/src/mind/fixtures/fire-diagnostics.success.jsonl`
- `apps/soul/agent/src/mind/fixtures/fire-diagnostics.failure.jsonl`
- `apps/runtime-player/src/main/control-channel/fixtures/fire-diagnostics-runtime-sample.jsonl`

Independent black-box review reconstructed the Soul success from Fire accepted to child `STARTED` in 499 ms. The explicit pre-playback durations were LLM 120 ms, audio query 30 ms, synthesis 320 ms, timeline 1 ms, connect-to-hello 19 ms, speech reply 5 ms, and enqueue-to-child proxy 4 ms; synthesis was the dominant explicit segment. The 1501 ms after `STARTED` was separated as playback occupancy, not Fire-to-audio latency.

The Soul failure retained `rawMoraCount=110`, `timelineCount=110`, WAV duration/bytes, actual serialized speech envelope **4164 UTF-8 bytes**, `requestId=req-7`, connection generation, and final `control_channel.close / channel_closed`. The reviewer treated an oversize cause as inference because the Runtime 4097-byte sample is a different run. Runtime independently demonstrated a factual 4097-byte `oversize` close without changing the 4096-byte acceptance boundary.

## 5. Raw mechanical results

```text
Soul focused worker-free Node tests
node --test --test-isolation=none src/mind/fire-diagnostics.test.mjs src/channel/channel-client.test.mjs src/voice/speak.test.mjs src/mind/fire-orchestrator.test.mjs
→ 98 passed / 0 failed

Soul Cockpit worker-free tests
node --test --test-isolation=none scripts/cockpit.test.mjs
→ 74 passed / 0 failed

Runtime typecheck
pnpm.cmd --filter @private-2d-rigging-lab/runtime-player typecheck
→ exit 0

Runtime focused Vitest
pnpm.cmd --filter @private-2d-rigging-lab/runtime-player exec vitest run src/main/control-channel/channel-websocket-connection.test.ts src/main/control-channel/fire-diagnostics.test.ts src/main/control-channel/channel-server-events.test.ts src/main/control-channel/channel-server.test.ts --pool=forks --maxWorkers=1 --no-file-parallelism
→ final green evidence: 4 files / 20 tests passed

Soul scoped syntax checks
→ pass

Scoped git diff --check
→ pass; CRLF conversion warnings only

Dependency/lockfile guard
→ no changed dependency manifest or lockfile in D1 scope
```

Environment-only results are separated from product evidence:

- Standard isolated Node tests could not start workers because of `spawn EPERM`; the established `--test-isolation=none` path passed.
- Sandboxed Runtime Vitest initially failed before assertions because esbuild could not spawn. Approved scoped execution passed. A later loopback run transiently passed 17/20, and its immediate identical rerun passed 20/20; the final verdict does not present the transient run as green evidence.

## 6. Scope and residuals

- No diagnostic UI, user operation, public API/toggle, prompt/session behavior change, dependency, or lockfile was added.
- The 4096-byte boundary, reconnect/retry behavior, reply timeout value, protocol response, and latency semantics were not changed.
- Soul child `STARTED` is the closest available child-process proxy, not physical speaker onset.
- Soul and Runtime checked-in samples are different runs. A later analysis may attribute a Runtime close reason to a Soul Fire only when wall-time neighborhood, request identity, connection generation, and event order support the correlation.
- Queue saturation can produce an incomplete Soul trace; missing records are unknown, not evidence of skipped production stages.
- Real provider, vision capture, microphone, AivisSpeech, ordinary Cockpit use, and physical audio remain untested by the mechanical gate.

## 7. Final state

- Mechanical gate: **PASS**
- Review blockers: **0**
- Accepted User Gate: **PENDING**

Only the user can perform the Accepted User Gate through ordinary use. Mechanical tests, fixtures, agents, and this closeout do not pass it on the user's behalf.
