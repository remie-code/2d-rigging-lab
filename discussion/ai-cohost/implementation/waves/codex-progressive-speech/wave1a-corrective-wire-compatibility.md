# Wave 1A corrective completion: App Server wire compatibility

- Date: 2026-08-30 (Asia/Tokyo)
- Scope: bounded corrective loop for the Codex App Server receive/dispatch boundary
- Source implementation: Gnome context
- Independent Review-Sylph review: **PASS (loop 1)** — Blocker/Major/Minor なし

## Outcome

The adapter now accepts the bundled Codex CLI 0.144.5 wire envelope, whose normal responses and notifications omit `jsonrpc`. Envelope purity, unknown additive fields, an unknown/late response id, a well-formed unknown notification, and an unrelated thread/turn notification no longer invalidate the App Server connection.

The common direct fake in `codex-session.test.mjs` and the Codex route fake in `brains.test.mjs` now model normal 0.144.5 responses, RPC errors, and notifications without an artificial `jsonrpc: "2.0"`. The only test-side `jsonrpc` field is an intentional adversarial `"1.0"` record proving that this unused field cannot spoof or kill an active turn.

## Validation boundaries implemented

- Connection-fatal: process start/stdio loss, process or stdout/stdin failure, stdin write failure, newline-terminated invalid JSON, truncated JSONL at EOF, clean unexpected stdout EOF, and failure to reap the child.
- Request-local: a safely correlated RPC error, timeout, response missing both result and error, or a correlated response with an unusable method field rejects that request without discarding a healthy process. Initialization can be retried on that same process.
- Turn-local: malformed active agent item/delta/final/terminal semantics reject only that turn. The owned thread is abandoned, but the process remains; the next ask starts a fresh thread and reinjects the first-turn system prompt.
- Diagnose and ignore: valid JSON primitives/arrays, uncorrelated malformed objects, unknown/late response ids, unsupported notifications, stale notifications, and messages whose thread and turn are both unowned.
- Correlation protection: a message matching only one required active coordinate fails the active turn instead of being applied; a message matching neither coordinate is ignored. Untrusted records cannot append text, complete the turn, or revive an old generation.
- Consumer-point validation: non-agent item notifications do not fail a turn merely for unused identity fields; agent-message lifecycle fields remain validated where consumed.

An additive `session.initialize()` entrypoint starts and initializes the corrected adapter without creating a thread or turn. It exists to support a bounded protocol health smoke without sending arbitrary text.

## Focused and adjacent verification

Syntax checks:

```text
node --check src/mind/codex-session.mjs
node --check src/mind/codex-session.test.mjs
node --check src/mind/brains.test.mjs
exit 0 for all three
```

Default-isolation attempt:

```text
node --test --test-concurrency=1 src/mind/codex-session.test.mjs src/mind/brains.test.mjs
tests 2
pass 0
fail 2
both test-file workers failed before loading with Error: spawn EPERM
```

Required worker-free fallback:

```text
node --test --test-isolation=none --test-concurrency=1 src/mind/codex-session.test.mjs src/mind/brains.test.mjs
tests 32
pass 32
fail 0
cancelled 0
skipped 0
todo 0
duration_ms 300.7642
```

Narrow adjacent session/brain/Fire/memory/Cockpit regression:

```text
node --test --test-isolation=none --test-concurrency=1 src/mind/codex-session.test.mjs src/mind/brains.test.mjs src/mind/fire-orchestrator.test.mjs src/mind/memory.test.mjs scripts/cockpit.test.mjs
tests 230
pass 230
fail 0
cancelled 0
skipped 0
todo 0
duration_ms 5223.9023
```

## Real bundled App Server smoke

The first sandboxed attempt was blocked at child spawn:

```text
Error: codex-session: failed to start App Server process.
cause: Error: spawn EPERM
exit 1
```

Per policy, the same bounded command was immediately rerun with escalation. It used the corrected `createCodexSession()` adapter, current bundled executable resolution, current managed subscription auth, and only `initialize()` followed by `dispose()`. It created no thread and sent no prompt/response text.

Raw successful outcome:

```text
REAL_SMOKE initialize=PASS threadIds=0
exit 0
```

This is a protocol initialize smoke only. It is not a real turn, model-quality check, Cockpit run, or human acceptance result.

## Owned files

- `apps/soul/agent/src/mind/codex-session.mjs`
- `apps/soul/agent/src/mind/codex-session.test.mjs`
- `apps/soul/agent/src/mind/brains.test.mjs` (only the directly required App Server fake envelope)
- `discussion/ai-cohost/implementation/waves/codex-progressive-speech/wave1a-corrective-wire-compatibility.md`

No dependency, lockfile, progressive sentence/queue/partial path, Claude, Runtime Player, Fire orchestrator, UI, or payload-cap source was changed by this correction. No stage, commit, revert, or unrelated cleanup was performed.

## Remaining gate and risk

- Human Cockpit validation remains **PENDING**. This implementation does not claim human PASS.
- The real smoke proves the corrected adapter can complete bundled 0.144.5 initialize and dispose, but deliberately does not exercise a real `thread/start`, `turn/start`, notification stream, or LLM turn.
- The pre-existing absence of a bounded terminal-notification timeout remains outside this wire-compatibility correction; a server that keeps stdio alive but never emits a terminal event can still leave an ask pending.
