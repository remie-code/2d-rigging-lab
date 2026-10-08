# Domain A spec review — prompt profile, persistence, API, and session revision

## Verdict

**PASS — Loop 1.** Blocking findings: **0**. The current Domain A source
implements the accepted per-brain conversation-instruction contract, keeps the
editable body separate from generated identity and memory, and preserves the
next-Fire session boundary. The normal Node test runner is environment-limited
by pre-assertion `spawn EPERM`; worker-free results are reported separately.
Human next-Fire/provider verification remains the wave-level gate.

## Basis and scope

Reviewed independently from the Gnome summary:

- `.codex/skills/implementation-orchestration/SKILL.md`;
- `discussion/_conventions.md`;
- `discussion/ai-cohost/implementation/orchestration/cockpit-settings-modal-wave-plan.md`;
- `discussion/ai-cohost/implementation/waves/cockpit-settings-modal/domain-a.md`;
- the prior model-identity closeout for the inherited identity resolver;
- current Domain A source, tests, and the dirty-worktree diff.

The Domain A implementation diff is confined to the assigned source/test
surfaces:

- `apps/soul/agent/src/mind/fire-orchestrator{,.test}.mjs`;
- `apps/soul/agent/src/cockpit/cockpit-settings-store{,.test}.mjs`;
- `apps/soul/agent/src/cockpit/cockpit-server{,.test}.mjs`;
- `apps/soul/agent/scripts/cockpit{,.test}.mjs`.

The shared worktree also contains unrelated dirty paths from the prior
model-identity/UI work. Those paths were preserved and are not counted as
Domain A settings changes. The identity-aware prompt wiring visible in
`fire-orchestrator.mjs`/`cockpit.mjs` is treated as that accepted prior-wave
baseline; this review does not expand Domain A into identity definitions,
input vocabulary, UI, voice, or persona work.

## Acceptance and contract review

### AC-02 — Per-brain editable body

PASS. `CONVERSATION_INSTRUCTION_BRAIN_IDS` contains exactly
`claude`, `codex`, `codex-55`, and `codex-56-sol` in
`fire-orchestrator.mjs:178–183`. `resolveConversationInstructionProfile()`
(`:201–216`) gives each valid ID an independent override and falls back to the
legacy default body for absent, empty, malformed, or unknown values. The
legacy body is kept in `DEFAULT_CONVERSATION_INSTRUCTION_BODY` (`:173`) and
the one-argument `buildFireSystemPrompt()` path still exports the generated
Cody default (`:226–237`), preserving the old default prompt bytes while
leaving the generated identity line outside the editable body.

The effective session composition in `scripts/cockpit.mjs:808–824` orders
generated identity → effective instruction body → optional memory section.
The store validates the selected brain, reset removes only that selected
override, and the tests cover all four IDs, direct-map compatibility,
malformed/unknown values, reset isolation, and failed writes.

### AC-03 — Persistence and privacy boundary

PASS. `cockpit-settings-store.mjs:138–184` adds only the additive
`conversationInstructions` key. Reads tolerate the versioned
`{version, overrides}` shape and the direct-map compatibility shape, while
filtering unknown IDs, empty strings, and non-string values. Instruction saves
and resets use `writeMergedStrict()` and return only after the durable
`writeFileSync` completes (`:138–146`, `:272–291`). Existing settings keys keep
their existing failure-tolerant behavior.

The dedicated server route in `cockpit-server.mjs:897–955` exposes exactly:

| Method | Path | Body / result |
|---|---|---|
| GET | `/api/conversation-instructions/:brainId` | effective body |
| PUT | `/api/conversation-instructions/:brainId` | `{instruction:string}`; effective body after save |
| DELETE | `/api/conversation-instructions/:brainId` | effective default/override after reset |

Success is assembled by `conversationInstructionResponse()` at
`:859–873` as `{ok:true, brainId, instruction, isOverride, revision}`. Route
validation rejects unknown brain IDs, malformed JSON, non-string values, and
trim-empty strings with 400 responses. Persistence/read/reset failures return
fixed 500 errors without the instruction text. The revision is obtained only
after the hook reports successful persistence.

The source audit found no instruction-body projection into `/api/state`, SSE
state/transcript/usage/diagnostic events, transcript/history, memory status or
files, identity projections, or ordinary error/log strings. `rg` finds the body
outside the dedicated route only at prompt composition and test fixtures, as
required for the session prompt. No credential content, provider response, or
external resource was consumed.

Interpretation recorded for this review: “unknown” in the fixed contract is
the unknown technical brain ID (matching the plan and current tests). The
route does not reject unrelated extra JSON object keys; the accepted plan
specifies the required `{instruction:string}` field rather than an explicit
no-extra-fields schema.

### AC-04 — Next-Fire behavior

PASS by source/lifecycle inspection and focused fake evidence. The in-process
revision controller (`scripts/cockpit.mjs:283–294`) advances only through
`createConversationInstructionHooks()` after `setConversationInstruction()` or
`resetConversationInstruction()` returns `true` (`:305–327`). A durable write
failure therefore leaves the live session revision unchanged.

`createSessionProxy.ask()` invokes `ensureSessionCurrent()` before the normal
lazy resource path (`:261–273`). Production `ensureSessionCurrent`
(`scripts/cockpit.mjs:839–850`) disposes a session only when its captured
`sessionInstructionRevision` is stale, then lets the same next Fire create a
new session with the latest effective body. Saving/resetting does not call
this path, so an in-flight answer remains on its original session/prompt.
Brain and memory boundaries continue to dispose and null their sessions and
clear the captured revision (`:918`, `:996`), preserving their existing
`dispose → null → next Fire` lifecycle. Repeated Fire with no boundary retains
the current session and captured revision.

The focused tests cover stale-session disposal ordering and post-success-only
revision advancement. The implementation does not rewrite transcript/history
entries or reattribute an in-flight response.

### AC-06 — Boundaries and consumption

PASS. No `src/voice/**`, package/lockfile, Runtime Player, Editor, contract,
persona, or UI/modal path is part of the Domain A diff. The soul-zone guard
passes. The dedicated API remains loopback Cockpit server functionality; no
live network/provider/microphone/TTS/chat call or credential-content read was
used by this review.

## Raw verification evidence

Commands were run against the current worktree; counts below are not mixed
between runners.

### Normal worker runner

```text
node --test --test-concurrency=1 \
  apps/soul/agent/src/mind/fire-orchestrator.test.mjs \
  apps/soul/agent/src/cockpit/cockpit-settings-store.test.mjs \
  apps/soul/agent/scripts/cockpit.test.mjs \
  apps/soul/agent/src/cockpit/cockpit-server.test.mjs
exit 1 — 4 file subtests; 0 pass / 4 fail; 0 assertions ran.
All failed before assertions with ChildProcess.spawn -> spawn EPERM.
```

This is the managed-environment worker limitation, not an assertion failure
and not green evidence.

### Worker-free fallback

```text
node --test --experimental-test-isolation=none --test-concurrency=1 \
  apps/soul/agent/src/mind/fire-orchestrator.test.mjs
exit 0 — 69/69 passed

node --test --experimental-test-isolation=none --test-concurrency=1 \
  apps/soul/agent/src/cockpit/cockpit-settings-store.test.mjs
exit 0 — 44/44 passed

node --test --experimental-test-isolation=none --test-concurrency=1 \
  apps/soul/agent/scripts/cockpit.test.mjs
exit 0 — 73/73 passed

node --test --experimental-test-isolation=none --test-concurrency=1 \
  apps/soul/agent/src/cockpit/cockpit-server.test.mjs
exit 0 — 124/124 passed
```

Separate-command total: **310/310 passed**, 0 failed/skipped/cancelled.

Additional checks:

```text
node --check on the 8 Domain A source/test modules: exit 0 (8/8).
git diff --check on the 8 Domain A paths: exit 0 (only existing LF→CRLF warnings).
node scripts/check-soul-zone-boundary.mjs: exit 0; 1,391 source files scanned; 0 violations.
```

Real provider calls / external network calls / microphone sessions / TTS
playback / chat connections / credential-content reads: **0 / 0 / 0 / 0 / 0 /
0**.

## Blocking findings

None. No Gnome source fix is required for this spec lane.

## Nonblocking residuals and follow-up

1. The current AC-04 machine evidence exercises the real session-proxy seam
   and revision hooks, but does not instantiate `main()` or run a single fake
   end-to-end sequence of API save/reset during an orchestrator thinking or
   speaking phase. This is a test-adequacy hardening item and should remain in
   the Domain A test lane / wave human gate; source inspection shows the save
   path does not dispose the session and the next-Fire stale check does.
2. The normal runner remains unavailable because of pre-assertion worker
   `spawn EPERM`; the 310/310 worker-free evidence is valid focused evidence,
   not a worker-runner PASS.
3. Human verification is still required for real Cockpit save/reset and
   next-Fire behavior, including a save while an answer is in flight. No live
   provider was used here.

## Conclusion

Domain A satisfies the accepted specification for Loop 1 with **PASS** and
zero blocking findings. It is ready for the independent Domain A design/test
lanes and downstream Domain C consumption, carrying the explicit fake-only
and human-gate residuals above.
