# Codex Progressive Speech — Wave 1B speech-delivery completion

- Status: **PASS — Wave 2 integration pending**
- Scope: safe incremental sentence/tag buffering, bounded FIFO TTS/playback primitives, and Control Channel payload observation/failure isolation.
- Ownership boundary preserved: Soul `AudioPlayer` remains the actual WAV playback owner; Runtime Player remains the Control Channel mouth-timeline recipient. No App Server adapter, brain registry, Fire orchestrator, Cockpit/history, scheduler, dependency, or lockfile change is claimed by Wave 1B.

## Implemented files

- `apps/soul/agent/src/mind/incremental-sentence-tag-buffer.mjs`
- `apps/soul/agent/src/mind/incremental-sentence-tag-buffer.test.mjs`
- `apps/soul/agent/src/voice/tts-playback-coordinator.mjs`
- `apps/soul/agent/src/voice/tts-playback-coordinator.test.mjs`
- `apps/soul/agent/src/channel/channel-client.mjs`
- `apps/soul/agent/src/channel/channel-client.test.mjs`
- `apps/runtime-player/src/main/control-channel/control-channel-overlay-store.ts`
- `apps/runtime-player/src/main/control-channel/control-channel-overlay-store.test.ts`

## B1 — safe sentence and playback primitives

The pure incremental buffer emits each completed sentence once without a length merger and emits one final unterminated remainder on flush. Valid fragmented expression tags are withheld from speech and retained in stream order; malformed angle syntax preserves prose while stripping brackets.

The playback coordinator assigns generation-qualified playback identities, preserves FIFO even when preparation completes out of order, permits at most one active playback, and ignores duplicate or stale terminal signals. Kill, barge-in, dispose, and failures clear queued work and clean late artifacts exactly once.

- Review: **PASS, loop 2**; Blocker 0 / Major 0 / Minor 0.
- Review evidence: `discussion/ai-cohost/implementation/reviews/codex-progressive-speech/b1-sentence-playback.md`.
- Reviewer raw summaries: focused/related Soul tests **36/36 pass**; AudioPlayer responsibility-boundary tests **20/20 pass** using the permitted process-spawn run. The initial sandbox AudioPlayer runner failure was `spawn EPERM` before the affected assertions and is recorded in the review.

## B2 — payload observation and failure isolation

`intent.speech` preflight measures the exact serialized UTF-8 envelope sent to the socket. The existing 4096-byte application boundary is unchanged: an oversize request fails locally before pending registration or socket send, so the healthy connection remains usable for a later small request. Close/timeout after a sent request is treated as ambiguous and is not blindly retried.

Diagnostics remain passive and content-free: the available seams expose character, mora, timeline, actual JSON-byte, request/connection, job/playback, and terminal-cause information without response bodies. Runtime still replaces only when it accepts an ordered control-channel write; no speech protocol expansion was made.

- Review: **PASS, loop 1**; Blocker 0 / Major 0 / Minor 0.
- Review evidence: `discussion/ai-cohost/implementation/reviews/codex-progressive-speech/b2-payload-failure-isolation.md`.
- Reviewer raw summaries: Soul channel/speak/coordinator modules **17/17**, **6/6**, and **10/10 pass**; Runtime focused tests **35/35 pass**, related dispatch/validation/diagnostic tests **56/56 pass**, and Runtime typecheck/diff check passed. Standard sandbox runner `spawn EPERM` startup failures are separated in the review from successful worker-free/permitted runs.

## Residual for Wave 2

These primitives are deliberately not wired into production Fire flow. Wave 2 must provide the queue-to-channel adapter that, for one progressive chunk, correlates `jobId`, generation-qualified `playbackId`, character/mora/timeline counts, serialized JSON bytes, and terminal cause; it must send a chunk timeline only when that FIFO job becomes active, await Control Channel acceptance, then start the corresponding Soul WAV and route only its matching terminal signal back to the coordinator.

This residual is an integration task, not a Wave 1B failure: Runtime cannot observe Soul WAV `ENDED`, and adding a cross-process ordering protocol here would exceed the accepted ownership boundary.
