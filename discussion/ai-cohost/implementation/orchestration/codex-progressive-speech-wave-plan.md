# Codex App Server Progressive Speech Wave Plan

> Status: **ACTIVE — Wave 1A / 1B launched (2026-08-30)**.
> Positioning: Codex 三頭の LLM transport を App Server の逐次 delta へ移し、一回の Fire を一つの会話 turn のまま、確定文から順に AivisSpeech へ流して最初の発話開始を早める。Claude 経路、vision 必須条件、通常の会話継続を維持する。
> Orchestration: **L0 Undine / L1 domain Orch-Sylph / L2 Gnome + independent Review-Sylph**。Wave 1A ∥ Wave 1B → Wave 2 → worker-free mechanical gate → Sol human gate → 4096-byte decision gate。

## 1. Basis

- App Server transport inventory: [../../research/app-server-transport-integration-inventory.md](../../research/app-server-transport-integration-inventory.md)
- streaming speech pipeline inventory: [../../research/streaming-speech-pipeline-inventory.md](../../research/streaming-speech-pipeline-inventory.md)
- official streaming options: [../../research/codex-text-streaming-official-options-2026-08.md](../../research/codex-text-streaming-official-options-2026-08.md)
- App Server bounded probe: [../../experiments/codex-app-server-streaming-probe.md](../../experiments/codex-app-server-streaming-probe.md)
- sentence probe: [../../experiments/codex-streaming-sentence-probe.md](../../experiments/codex-streaming-sentence-probe.md)
- passive diagnostics baseline: [fire-diagnostics-wave-plan.md](fire-diagnostics-wave-plan.md)
- implementation orchestration rules: `.agents/skills/implementation-orchestration/SKILL.md`

Repository facts used as planning premises:

- accepted Fires are single-flight;
- the current Codex session preserves conversation across ordinary Fires;
- App Server exposes one conversation as a thread and later Fires can append turns to the same thread;
- the bounded Sol/low/vision probe observed incremental `item/agentMessage/delta` and a safe first sentence before the final assistant item;
- actual Aivis WAV playback is owned by Soul's audio player; Runtime Player receives the synchronized mouth timeline through the Control Channel;
- Runtime Player currently limits one WebSocket text frame to 4096 UTF-8 bytes; this is an application boundary, not a WebSocket protocol requirement;
- passive Fire diagnostics already records a baseline but does not implement streaming, reconnect, preflight, or cap changes;
- the worktree is dirty with user-owned settings, identity, diagnostics, documentation, agent-profile, and Expo changes. Every agent preserves them and edits only assigned hunks.

## 2. Accepted product decisions

1. The change is limited to the three Codex brains. Claude remains on its current provider path and is not made a verification dependency while its subscription is paused.
2. App Server use is common to the three Codex brains. The first real-device human gate uses GPT-5.6 Sol.
3. Sol may use reasoning effort `low`. Vision remains mandatory and cannot be removed as a latency optimization.
4. Ordinary Fires continue the same App Server thread. One Fire is one LLM turn; sentence chunks are delivery/TTS units and must not become separate LLM turns.
5. The first safe completed sentence is spoken immediately. There is no minimum-length merger or “too short” heuristic in this wave.
6. At most one audio chunk is active. Later chunks preserve generated order and start only after the preceding playback reaches its chosen terminal completion.
7. If one or more sentences were played and a later chunk fails, the user-visible result is partial delivery: keep the spoken prefix in Cockpit history, add a restrained interruption note, do not automatically replay the prefix, and make the next Fire aware that the previous answer was not fully heard.
8. If no sentence was played, preserve the normal Fire-error experience.
9. brain, memory, conversation instruction, audio device, and channel URL are snapshotted for an accepted Fire. Changes do not disturb that Fire and apply from the next Fire.
10. The 4096-byte value is held constant only during the observation wave. Chunk-local UTF-8 serialized byte measurement and preflight are required. Retain, raise, remove, or add weaker-boundary subdivision only after real measurements are reported to the user.
11. The user operates Cockpit normally. Diagnostic collection and analysis remain agent work; no diagnostic UI or log-copy workflow is added.

## 3. User experience and human gate

The user starts the normal applications and converses through Cockpit. A successful candidate should make the first sentence audible before the full model response is complete while preserving sentence order, natural playback, lip synchronization, vision use, and conversational memory.

The user judges:

- whether the delay from visible `fired` to first audible speech is materially improved;
- whether sentence boundaries and gaps sound acceptable;
- whether no text/tag is duplicated, omitted, or spoken as control syntax;
- whether a deliberately or naturally interrupted later chunk leaves an understandable partial response and the next conversation can continue without pretending the full answer was heard;
- whether ordinary multi-Fire conversation still remembers earlier exchanges.

The user does not inspect raw logs, internal IDs, App Server JSON-RPC, byte calculations, queue state, or test output. Agents read the logs and report timings and payload measurements.

This section is immutable for downstream agents. A requested change requires escalation to L0.

## 4. Dependency graph

```text
Wave 1A — App Server transport foundation ───────┐
                                                  ├─ Wave 2 — Progressive Fire integration
Wave 1B — sentence / speech delivery foundation ┘                  │
                                                                     ▼
                                                        mechanical integration gate
                                                                     │
                                                                     ▼
                                                             Sol human gate
                                                                     │
                                                                     ▼
                                                        4096-byte user decision gate
```

Wave 1A and 1B may run in parallel because they have separate source ownership. Shared-contract changes are owned by Wave 1A; Wave 1B must escalate rather than edit Wave 1A files. Wave 2 starts only after both completion reports and independent reviews are PASS.

## 5. Wave 1A — App Server transport foundation

### Ownership

- Codex/App Server session adapter and focused tests under `apps/soul/agent/src/mind/`;
- minimum brain registry/factory seam needed to route the three Codex brains;
- no ownership of `fire-orchestrator.mjs`, speech/TTS/audio/channel modules, Cockpit UI, Runtime Player, Claude implementation, dependencies, or lockfiles without escalation;
- completion report: `discussion/ai-cohost/implementation/waves/codex-progressive-speech/wave1a-app-server-transport.md`;
- reviews:
  - `discussion/ai-cohost/implementation/reviews/codex-progressive-speech/a1-stream-transport.md`;
  - `discussion/ai-cohost/implementation/reviews/codex-progressive-speech/a2-session-lifecycle.md`.

### Review unit A1 — streaming transport contract

Implement and independently verify:

- App Server process/connection initialization;
- thread start, turn start, vision input, and ordered text delta exposure;
- exact accumulated-delta/final-text agreement;
- terminal success, turn failure, process exit, cancellation/dispose, and malformed notification handling;
- common routing for the three Codex brains, including Sol `low`;
- unchanged Claude path.

PASS requires no delta loss, duplication, or reordering; errors must not be reported as successful final text; focused tests must cover fragmented notifications and process failure.

### Review unit A2 — session continuity and lifecycle

Implement and independently verify:

- the same thread across ordinary multi-Fire turns;
- prior conversation visible to later turns;
- a new session/thread from the next Fire after brain, memory, or conversation-instruction revision;
- accepted-Fire settings snapshot;
- deterministic disposal and no orphan process/late callback commit;
- recovery on the next Fire after a failed turn or dead App Server process.

PASS requires conversational continuity without stale-setting leakage and no one-failure cascade into later Fires.

## 6. Wave 1B — sentence and speech-delivery foundation

### Ownership

- new pure incremental sentence/tag buffer and focused tests;
- Soul voice/audio/channel delivery primitives and focused tests;
- the minimum Runtime Player Control Channel/timeline seam required for chunk-local preflight, correlation, and failure isolation;
- no ownership of Codex/App Server adapters, brain registry, `fire-orchestrator.mjs`, Cockpit UI/history, scheduler policy, dependencies, or lockfiles without escalation;
- completion report: `discussion/ai-cohost/implementation/waves/codex-progressive-speech/wave1b-speech-delivery.md`;
- reviews:
  - `discussion/ai-cohost/implementation/reviews/codex-progressive-speech/b1-sentence-playback.md`;
  - `discussion/ai-cohost/implementation/reviews/codex-progressive-speech/b2-payload-failure-isolation.md`.

### Review unit B1 — safe sentence and playback primitives

Implement and independently verify:

- arbitrary delta fragmentation produces each completed sentence exactly once and a final unterminated remainder on flush;
- incomplete/complete expression tags never become spoken text, and completed tags retain stream order;
- no minimum sentence-length threshold;
- per-chunk TTS job identity and FIFO playback;
- active playback cardinality at most one;
- natural completion advances exactly once; duplicate/late ENDED, ERROR, STOPPED, or timer signals do not advance a newer generation;
- kill, barge-in, dispose, and failure clear queued work without resurrecting it.

PASS requires no duplicated or reordered speech and no listener/timer/temp-resource leak in the focused lifecycle tests.

### Review unit B2 — payload observation and failure isolation

Implement and independently verify:

- byte measurement from the actual serialized UTF-8 `intent.speech` envelope;
- chunk characters, mora count, timeline count, JSON bytes, queue/playback identity, and terminal cause in passive diagnostics without content capture;
- 4096-byte preflight before WebSocket send while leaving the configured cap unchanged;
- an oversize chunk fails locally without killing a reusable healthy connection or causing later-Fire timeout cascade;
- no blind retry after an ambiguous accepted/reply-lost state;
- Runtime timeline replacement occurs only in the intended playback order.

PASS requires measurement accuracy and failure containment. Production-grade telemetry, a diagnostics UI, cap redesign, and polished log schema are explicitly outside this review.

## 7. Wave 2 — Progressive Fire integration

Wave 2 is a single integration context because delta parsing, Fire state, spoken watermark, transcript/history, partial delivery, self-fire bookkeeping, expression timing, and next-turn correction must agree.

Ownership is assigned by the Wave 2 Orch-Sylph after reading both Wave 1 reports. It includes the minimum `fire-orchestrator`, Cockpit transcript/event projection, scheduler/memory seam, and integration tests. It must reuse Wave 1 primitives rather than reimplement them.

Persistent outputs:

- completion: `discussion/ai-cohost/implementation/waves/codex-progressive-speech/wave2-progressive-fire.md`;
- reviews:
  - `discussion/ai-cohost/implementation/reviews/codex-progressive-speech/c1-incremental-boundary.md`;
  - `discussion/ai-cohost/implementation/reviews/codex-progressive-speech/c2-fire-state-machine.md`;
  - `discussion/ai-cohost/implementation/reviews/codex-progressive-speech/c3-partial-conversation.md`.

### Review unit C1 — incremental boundary integration

- stream deltas enter the pure buffer once;
- the first safe sentence enqueues immediately;
- final flush emits the remainder once;
- expression/control tags are not spoken;
- NG scanning covers chunk boundaries; a later unsafe chunk stops remaining delivery and cannot retract an already played safe prefix.

### Review unit C2 — Fire state machine

- LLM generation, TTS preparation, and sequential playback may overlap without two active audio chunks;
- one Fire remains one App Server assistant turn;
- LLM completion and playback-queue completion are distinct;
- kill, barge-in, dispose, settings revision, channel failure, and late callbacks obey generation ownership;
- first delta, first safe sentence, TTS, PLAY/STARTED/ENDED, and Fire terminal timings remain reconstructable.

### Review unit C3 — partial delivery and conversation continuity

- the Cockpit-visible response equals the spoken prefix, followed by one restrained interruption note;
- zero-spoken-chunk failure follows the normal error path;
- no automatic replay duplicates an audible prefix;
- next Fire receives a correction that the prior assistant response was not fully heard, while the App Server thread remains internally coherent;
- memory/digest and self-fire refractory behavior reflect that the AI did audibly speak when at least one chunk completed;
- ordinary complete responses add no interruption metadata.

## 8. Proportional review policy

Review units are behavioral units, not files, commits, or the whole wave. A unit must have independently testable input, state transition, output, and failure behavior.

One loop is Gnome implementation/correction followed by independent Review-Sylph inspection of basis, diff, tests, and raw results. Operational targets:

- expected: initial review plus at most one correction;
- difficult boundary case: at most three loops;
- loops four and five are emergency ceiling only, allowed solely when findings are independently shrinking and no product decision is missing;
- a repeated Major/Blocker, non-decreasing findings, or a user/UX decision gap escalates before the ceiling;
- Minor findings do not force another loop when they do not affect accepted behavior, safety, regression evidence, or later diagnosis. They are recorded as residuals.

Finding classes:

- **Blocker**: duplicated/omitted speech, broken conversation continuity, stale callback commit, unrecoverable later Fire, resource/process leak that affects operation;
- **Major**: accepted behavior mismatch, untested critical failure path, incorrect byte/timing evidence, Claude or existing Fire regression;
- **Minor**: local maintainability or bounded diagnostic polish without user-visible or correctness impact.

PASS requires zero Blocker and Major findings plus green focused tests. It does not require aesthetic refactoring, generalized frameworks, exhaustive public telemetry quality, all theoretical Unicode segmentation, or fixing unrelated repository debt.

After each Wave, one narrow integration review checks only the seams between already-passed units. It does not reopen passed implementation for style preferences.

## 9. Models and nested orchestration

- **L0 Undine**: owns this plan, accepted decisions, dependency gates, later 4096-byte user decision, and final user report. It does not implement or replace live children.
- **Wave 1A Orch-Sylph**: `gpt-5.6-terra`, effort `high`; Gnome `gpt-5.6-sol/high`; independent Review-Sylph `gpt-5.6-sol/high`.
- **Wave 1B Orch-Sylph**: `gpt-5.6-terra`, effort `high`; Gnome `gpt-5.6-terra/high`; independent Review-Sylph `gpt-5.6-sol/high`.
- **Wave 2 Orch-Sylph/Gnome/Review-Sylph**: `gpt-5.6-sol/high`, because App Server history, asynchronous queue, transcript truth, and partial recovery intersect.
- **Mechanical/human-run log analysis**: fresh `gpt-5.6-luna/high` for bounded aggregation; Sol is used only if cross-state-machine diagnosis is needed.

Every L1 assignment includes:

> Orch-Sylph自身は実装担当ではない。source implementation は必ず別コンテキストの Gnome に委譲し、レビューは必ず別コンテキストの Review-Sylph に委譲すること。これを分離できない場合は実装せず escalate / blocked として報告すること。

Every child is told it is not alone in the dirty worktree, must preserve others' edits, must stay inside ownership, and must not stage, commit, revert, or broadly reformat. Calls use the required `[subagent-call]` prefix. Parents wait with `wait_agent`; timeout is polling only and never authorizes interruption or parent-side substitute implementation.

## 10. Mechanical gate

Mechanical PASS requires:

- all seven behavioral-unit reviews PASS with zero Blocker/Major;
- Wave 1 and Wave 2 narrow integration reviews PASS;
- focused App Server fake/probe-shaped tests, sentence property tests, queue lifecycle tests, Fire partial-state tests, and Runtime channel tests green;
- relevant existing Soul and Runtime regression lanes green using worker-free fallback when repository-standard workers fail with `spawn EPERM`;
- Claude path, vision behavior, settings next-Fire behavior, kill/barge-in, and diagnostics passivity preserved;
- no dependency/lockfile change unless separately escalated and accepted;
- a human-gate procedure that asks the user only to operate the normal application.

Persistent final outputs:

- final review: `discussion/ai-cohost/implementation/reviews/codex-progressive-speech/final-mechanical.md`;
- closeout: `discussion/ai-cohost/implementation/waves/codex-progressive-speech/final-closeout.md`;
- human gate: `discussion/ai-cohost/implementation/waves/codex-progressive-speech/human-gate.md`.

## 11. Human and 4096-byte gates

The mechanical wave may close as **MECHANICAL PASS / HUMAN GATE PENDING**. The first real-device run uses Sol/low with mandatory vision and a response long enough to contain multiple sentences.

A fresh Luna reads the passive logs and reports per chunk:

- text character count without content;
- mora and timeline counts;
- serialized JSON UTF-8 bytes;
- first-delta, first-safe-sentence, TTS, playback-start, and playback-end timings;
- queue wait and terminal result.

L0 then reports the measured distribution and observed maximum to the user. The plan does not pre-authorize changing 4096. Retention, increase/removal, or oversize-sentence subdivision is a separate user decision after this evidence.
