# Domain C test review — currentBrain wiring / final integration

## Verdict

**PASS (loop 2 targeted re-review); blocking findings: 0.** The fake-only focused assertions
execute the identity prompt, swap disposal, current-state projection, dynamic
input-provider handoff, and TTS invariance claims. The normal worker runner is
separately environment-blocked by pre-assertion `spawn EPERM`; it is not green
evidence and is not counted with the worker-free runs.

## Basis and scope

- Accepted plan: `discussion/ai-cohost/implementation/orchestration/model-identity-wave-plan.md`
  §§2–4, 9–15.
- Domain reports: `waves/model-identity/domain-{a,b,c,d}.md`; A/B/D test reviews
  were read as dependency evidence.
- Reviewed C files: `scripts/cockpit{,.test}.mjs`,
  `src/cockpit/cockpit-server{,.test}.mjs`, and
  `src/mind/fire-orchestrator{,.test}.mjs`.
- Current C diff scope is exactly those six files: **268 insertions / 17 deletions**.
  No source/test ownership breach was observed.

## Independently rerun evidence

| Command | Raw result |
|---|---|
| `node --test apps/soul/agent/src/mind/fire-orchestrator.test.mjs` | exit **1**; one file subtest, **0 assertions started / 0 pass / 1 fail**, `spawn EPERM` before assertions |
| `node --test apps/soul/agent/scripts/cockpit.test.mjs` | exit **1**; one file subtest, **0 assertions started / 0 pass / 1 fail**, `spawn EPERM` before assertions |
| `node --test apps/soul/agent/src/cockpit/cockpit-server.test.mjs` | exit **1**; one file subtest, **0 assertions started / 0 pass / 1 fail**, `spawn EPERM` before assertions |
| worker-free import of `fire-orchestrator.test.mjs` | exit **0**, **68/68 passed**, 0 failed/skipped/cancelled |
| worker-free import of `scripts/cockpit.test.mjs` | exit **0**, **70/70 passed**, 0 failed/skipped/cancelled |
| worker-free import of `cockpit-server.test.mjs` | exit **0**, **120/120 passed**, 0 failed/skipped/cancelled |
| worker-free Domain D UI/static fallback imports | exit **0**, **51/51 passed**, 0 failed/skipped/cancelled |
| `node --check` on six C source/test modules | exit **0** for all six |
| `git diff --check` on six C files | exit **0** (only existing LF→CRLF warnings) |
| `node scripts/check-soul-zone-boundary.mjs` | exit **0**; 1,391 files scanned, 0 violations |

Counts from failed worker runs and worker-free imports are intentionally kept
separate; no count is combined into a false total.

## Loop 2 targeted verification

The new server authority tests execute the previously unproven provider-only
and mismatched-status cases:

- with `brainStatus` absent and `currentBrainIdentity → chappy`, `/api/state`
  returns exactly `{ brain: { identity: { id: "chappy", displayName: "チャッピー" } } }`;
- with technical status `{ brain: "codex" }` but the injected provider changed
  to Cody, the snapshot keeps `brain: "codex"`/`credentialHealth` and projects
  `{ id: "cody", displayName: "こーでぃー" }`, proving status cannot relabel the
  current public identity;
- a transcript snapshot explicitly asserts no `identity` field on transcript
  entries, preserving the no-historical-schema-addition boundary.

The implementation canonicalizes the provider’s `id` through
`resolveModelIdentity`; it does not derive public identity from a competing
technical `brainStatus` resolver when the current provider is present. The
updated worker-free server suite is **120/120**, with the full companion
focused suites **68/68 Fire** and **70/70 cockpit**.

## Coverage assessment

- **Four brains / prompt:** the production `buildBrainSessionSystemPrompt`
  test is table-driven for `claude`, `codex`, `codex-55`, and `codex-56-sol`,
  with unknown fallback to Cody. Domain A’s canonical registry tests provide
  the four strict bindings.
- **Two-way lifecycle:** the fake `createSessionProxy` path exercises
  Claude→GPT and GPT→Claude: `dispose()` is awaited, the session is nulled, and
  only the next `ask()` creates the new fake head with the new self-name. The
  pending old Claude request is resolved after the swap and is not relabeled.
- **Current state and broadcast:** HTTP state tests assert the additive exact
  `{ id, displayName }` projection for Cody/Chappy, all four technical IDs,
  Claude fallback for unknown technical IDs, POST acknowledgement, and SSE
  state broadcast. Domain D’s 51/51 run covers malformed/cross-pair identity
  neutral fallback (`Soul Cockpit`).
- **Dynamic B handoff:** the C server test captures the injected Whisper,
  voice-variant, and comment-variant providers, mutates one current identity,
  and observes the new values through the same pipeline/scheduler objects.
  Domain B’s 86/86 worker-free seam run (11 Whisper + 12 ear + 63 scheduler)
  proves request/handling-time reads, old-family negatives, exact Chappy
  variants, and literal fallback behavior.
- **Schemas/history:** C’s diff adds only the required current `brain.identity`
  view and prompt/provider wiring; no transcript, SSE transcript, usage,
  memory, persisted-history, settings, or viewer identity field/rewrite is
  present. Existing transcript/usage/memory regression tests remain green in
  the 120/120 server and 70/70 cockpit runs.
- **TTS/provider isolation:** the swap test keeps one frozen fake player and
  fixed `{ baseUrl, speaker }`, asserting no second player/dependency across
  both directions. No WAV writer, real TTS, LLM SDK, credential content, or
  provider call is exercised.

## Forbidden-path / consumption audit

- `git status --short` and `git diff --name-only` under
  `apps/soul/agent/src/voice/**`: **0 paths**.
- C diff contains no package/lockfile path and no provider/credential adapter
  path. Real Claude/Codex/Terra/Sol calls: **0**; external network calls:
  **0**; credential-content reads: **0**. Loopback HTTP in cockpit tests is
  injected local test traffic only.

## Residuals and actionable hardening

These are nonblocking because the production source paths are exercised for
prompt/state/provider behavior and the diff contains no historical or TTS
schema mutation:

1. The swap test reconstructs `ensureFireResources`/`onSetBrain` in a local fake
   harness (while using the production `createSessionProxy`), so it does not
   invoke `main()`’s private closures directly. If a follow-up hardening loop
   is desired, add a narrow injectable/exported swap harness or an assertion
   against the production hook factory; do not add provider calls.
2. The SSE assertion currently checks `brain.brain === "codex"` but not the
   accompanying `brain.identity` pair. Add one `evt.data.brain.identity`
   deep-equality assertion to guard broadcast-specific regressions.
3. The fake TTS check proves object/config identity but does not pass through
   `createFireOrchestrator`’s `speakDeps`; a future hardening test may capture
   one injected fake `speakImpl` call and assert the same frozen base URL and
   speaker after both swaps. No Gnome fix is required for this loop.

Human visible title/header, actual ASR recognition, next-Fire behavior against
real providers, and the operator disclosure remain the separate human gate.
