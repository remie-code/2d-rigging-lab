# Wave 1A completion: Codex App Server transport foundation

- Scope: A1 streaming transport contract / A2 session continuity and lifecycle
- Status: **Wave 1A complete — A1 PASS (loop 2); A2 PASS (loop 1)**
- Source owner: Wave 1A Gnome

## Implemented outcome

The three Codex brains now share a persistent Codex App Server stdio JSONL adapter. Claude remains on `createLlmSession` and was not changed.

The adapter lazily starts the bundled platform Codex executable, performs `initialize` followed by `initialized` exactly once per connection, starts one App Server thread, and appends one `turn/start` for each ordinary `ask`. A transport error, failed/interrupted turn, malformed protocol message, process exit, callback failure, or final-text mismatch invalidates the connection and thread. The next ask waits for bounded process reaping and starts a fresh process/thread.

`ask(content, { onTextDelta })` is additive: existing one-argument callers still receive the existing final `{ replyText, usage, ttftMs, elapsedMs }` shape, while an opted-in caller receives ordered append-only `item/agentMessage/delta` text. Per-item accumulated delta text and the combined final reply must exactly equal completed `agentMessage` snapshots. Any mismatch rejects the turn; it is never rewritten into a successful final result.

## A1 details

- Persistent process and request-id-correlated JSON-RPC connection with fragmented UTF-8/JSONL decoding.
- `initialize` / `initialized`, `thread/start`, and `turn/start` lifecycle.
- Bundled executable resolution from the existing `@openai/codex` platform package; no dependency or lockfile change.
- `approvalPolicy: "never"`, read-only sandbox, `networkAccess: false`, repository-external scratch cwd, disabled web search configuration, and forced ChatGPT login configuration.
- String and image content conversion to App Server `text` / `localImage` input.
- Vision input remains image-first. On the first turn, the session prompt is merged into the first text item instead of moving ahead of the image.
- Ordered text-delta callback with item/thread/turn identity and monotonic elapsed metadata.
- Exact delta/completed-item/final-reply agreement.
- Token usage normalization from `thread/tokenUsage/updated` when present.
- Explicit handling for successful completion, failed/interrupted completion, non-retrying error notification, process error/exit, malformed JSON/RPC/turn notification, disposal, and callback exception.
- Unknown well-formed notifications remain additive-compatible and are ignored.
- `codex`, `codex-55`, and `codex-56-sol` route through this adapter. Sol sends `effort: "low"`; the other existing model/effort selections remain unchanged.

## A2 details

- One adapter reuses one process/thread across ordinary asks; the first system prompt is sent exactly once on that healthy thread.
- A new adapter instance creates a new process/thread and captures its own system prompt/model/effort settings, preserving the surrounding proxy's existing dispose/recreate seam for next-Fire settings revisions.
- Content and callback references are snapshotted before the first await. Later caller mutation cannot change an accepted turn's text/image bytes or selected callback.
- A failed first turn does not consume first-turn prompt semantics. Recovery starts a fresh thread and injects the system prompt again.
- Any later failed turn or dead process also recovers through a fresh process/thread on the following ask.
- Concurrent asks are rejected deterministically; the accepted product path remains single-flight and one ask equals one App Server turn.
- Dispose is idempotent, rejects the active ask, disables its delta callback, attempts bounded `turn/interrupt`, attempts exact `thread/delete`, terminates/reaps the child, removes scratch images, and performs exact-owned-thread rollout/ledger cleanup.
- The observed App Server 0.144.5 `thread/delete` `agent_jobs` database failure remains best-effort. No Codex database mutation or inferred deletion was added.
- A child that remains alive after bounded TERM/KILL waits causes disposal/recovery to surface an error instead of falsely reporting successful reaping.

## Files modified by this implementation

- `apps/soul/agent/src/mind/codex-session.mjs`
- `apps/soul/agent/src/mind/codex-session.test.mjs`
- `apps/soul/agent/src/mind/brains.mjs` — only the Sol effort/comment hunk; unrelated pre-existing identity edits were preserved
- `apps/soul/agent/src/mind/brains.test.mjs` — App Server routing tests were updated while unrelated pre-existing identity tests were preserved
- `discussion/ai-cohost/implementation/waves/codex-progressive-speech/wave1a-app-server-transport.md`

No Wave 1B file, `fire-orchestrator.mjs`, voice/audio/channel module, Cockpit UI, Runtime Player, Claude implementation, dependency manifest, or lockfile was changed by Wave 1A.

## Focused verification and raw summaries

Syntax checks:

```powershell
node --check src/mind/codex-session.mjs
node --check src/mind/codex-session.test.mjs
node --check src/mind/brains.test.mjs
```

Result: exit 0; no output.

Repository-standard isolated runner attempt:

```powershell
node --test --test-concurrency=1 src/mind/codex-session.test.mjs src/mind/brains.test.mjs
```

Raw summary:

```text
tests 2
pass 0
fail 2
duration_ms 10.3425
Error: spawn EPERM
```

This failed before loading either test file because the sandbox denied the test runner's worker process. The required worker-free fallback was then used.

Focused Wave 1A lane:

```powershell
node --test --test-isolation=none --test-concurrency=1 src/mind/codex-session.test.mjs src/mind/brains.test.mjs
```

Raw summary:

```text
tests 29
pass 29
fail 0
cancelled 0
skipped 0
todo 0
duration_ms 295.809
```

Relevant regression lane:

```powershell
node --test --test-isolation=none --test-concurrency=1 src/mind/codex-session.test.mjs src/mind/brains.test.mjs src/mind/fire-orchestrator.test.mjs src/mind/memory.test.mjs scripts/cockpit.test.mjs
```

Raw summary:

```text
tests 200
pass 200
fail 0
cancelled 0
skipped 0
todo 0
duration_ms 5217.9402
```

Diff hygiene:

```powershell
git diff --check -- apps/soul/agent/src/mind/codex-session.mjs apps/soul/agent/src/mind/codex-session.test.mjs apps/soul/agent/src/mind/brains.mjs apps/soul/agent/src/mind/brains.test.mjs
```

Result: exit 0. Git emitted only the repository's LF-to-CRLF working-copy warnings; no whitespace error was reported.

## Test coverage highlights

- fragmented JSONL and fragmented multi-byte UTF-8 notification delivery;
- ordered deltas, TTFT, usage, and exact final agreement;
- image-first `localImage`, temporary image lifetime, and caller-object mutation after acceptance;
- same process/thread across two ordinary asks and first-prompt-only-once behavior;
- mismatch, failed first turn, dead process, malformed JSON, and malformed relevant notification;
- recovery with a fresh process/thread and system prompt preservation;
- disposal interrupt, active rejection, child termination, idempotence, and late-delta suppression;
- observed `thread/delete` database failure containment followed by child reaping;
- fatal transport delayed-exit barrier: no replacement spawn before the old child exits;
- fatal transport never-exit barrier: no recovery spawn, deterministic reap error from ask/dispose, and no `unhandledRejection`;
- fresh adapter/settings lifecycle;
- API-key environment guard and invalid/concurrent/disposed ask behavior;
- exact-id rollout/ledger isolation;
- common App Server model/effort route for all three Codex brains, including Sol `low`.

## Residual risks / intentionally unfulfilled conditions

- No real Codex/App Server LLM turn was run in this implementation wave; all automated tests are fake/probe-shaped and consume no model quota. The earlier bounded real probe remains the runtime evidence for 0.144.5 Sol/low/vision delta behavior.
- Wave 1A only exposes ordered deltas. It does not perform sentence splitting, TTS, partial transcript policy, NG/tag streaming policy, or Fire orchestration; those belong to Wave 1B/Wave 2.
- When App Server omits `thread/tokenUsage/updated` before terminal completion, `usage` remains `null`; this preserves an honest absence rather than fabricating usage.
- Exact rollout cleanup remains a fallback around best-effort official `thread/delete`; App Server metadata deletion cannot be guaranteed while the observed 0.144.5 database defect exists.

## Correction loop 1 — A1 fatal transport reap barrier

Independent A1 review found that `AppServerConnection.fail()` called the session fatal callback and then discarded `void close()`. Because the callback cleared the current connection before the ask catch reached `invalidateConnection()`, the close/reap promise was not installed as the session reset barrier. A subsequent ask could therefore spawn a replacement while the old process still lived, and a rejected reap promise could become unhandled.

Correction:

- `AppServerConnection.fail()` now delegates fatal ownership only once to the session callback; it no longer starts an unobserved close.
- The session invalidation path accepts the exact stale connection, clears it only when it is still current, starts its close immediately, and composes that promise into the persistent `resetPromise` barrier.
- An immediate no-op rejection observer prevents timing-window `unhandledRejection`, while the original rejected barrier remains observable by the active ask, dispose, and every later ask.
- `ensureThread()` continues to await the barrier before spawning. A child that exits late delays recovery; a child that cannot be reaped permanently prevents a replacement spawn and surfaces `codex-session: App Server process could not be reaped.`
- Dispose now runs exact rollout/ledger/scratch cleanup in `finally` and then rethrows a reap error, rather than skipping local cleanup when the barrier rejects.
- stderr is drained without retention, stdout errors are fatal, and a clean unexpected stdout EOF is now also fatal.
- The A1 review's minor documentation finding was closed: `ttftMs` is now described as null only for heads where it cannot be observed, matching App Server's numeric first-delta timing.

Correction-focused raw summaries:

```powershell
node --check src/mind/codex-session.mjs
node --check src/mind/codex-session.test.mjs
node --test --test-isolation=none --test-concurrency=1 src/mind/codex-session.test.mjs src/mind/brains.test.mjs
```

```text
tests 29
pass 29
fail 0
cancelled 0
skipped 0
todo 0
duration_ms 295.809
```

Correction regression raw summary:

```text
tests 200
pass 200
fail 0
cancelled 0
skipped 0
todo 0
duration_ms 5217.9402
```
