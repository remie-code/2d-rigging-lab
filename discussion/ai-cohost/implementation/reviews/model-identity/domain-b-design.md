# Domain B design review — dynamic input seams

## Verdict

**PASS** (loop 1) — blocking findings: **0**; nonblocking findings: **0**.

The implementation keeps Domain B generic: Whisper and scheduler retain
request/handling-time getter seams, while the fixed identity authority remains
in Domain A. Existing literal/default behavior and scheduler gating remain
intact. Domain C can supply a current-brain closure without a second mapping.

## Basis and snapshot

- Accepted plan: `discussion/ai-cohost/implementation/orchestration/model-identity-wave-plan.md`, §§2–4, 7, 10–13.
- Domain A contract/reviews: `apps/soul/agent/src/mind/model-identity.mjs` and
  `discussion/ai-cohost/implementation/reviews/model-identity/domain-a-{spec,design,test}.md`.
- Inventory evidence: `discussion/reports/ai-cohost-model-identity-inventory/01-fixed-name-and-identity-flow.md`
  through `04-ui-contracts-and-tests.md`, `10-inventory-integration.md`, and
  `20-final-review.md` (PASS, 0 blocking / 0 nonblocking).
- Domain B report: `discussion/ai-cohost/implementation/waves/model-identity/domain-b.md`.
- Pre-review snapshot: dirty shared worktree with concurrent Domain A/D and
  unrelated changes; all were preserved. Domain B owns only the six source/test
  paths listed below plus its completion report.

## Evidence and raw results

| Check | Raw result |
|---|---|
| `node --test apps/soul/agent/src/ears/whisper-inference.test.mjs apps/soul/agent/src/ears/ear-pipeline.test.mjs apps/soul/agent/src/mind/fire-scheduler.test.mjs` | Exit **1**; 3 file subtests, tests **3**, pass **0**, fail **3**, skipped/cancelled **0**. Every file failed before assertions with `ChildProcess.spawn -> spawn EPERM`; this is the documented environment limitation, not an assertion failure and not a green run. |
| Worker-free selected imports (same three files, one process each) | Exit **0** for each: Whisper **11/11**, ear pipeline **12/12**, scheduler **63/63**; total **86/86** pass, 0 fail/skipped/cancelled. Counts are kept separate from the failed worker runner. |
| `node --check` on six owned source/test files | Exit **0** for all six. |
| `git diff --check --` six owned paths | Exit **0** (only existing LF→CRLF warnings). |
| `node scripts/check-soul-zone-boundary.mjs` | Exit **0**; 1,391 files scanned, no import-direction violations. |
| `git diff --name-only/--numstat -- apps/soul/agent/src/voice` | 0 paths / 0 rows; `src/voice/**` unchanged. |

Automated real provider calls, external network calls, and credential-content
reads: **0**.

## Design assessment

### Request-time Whisper seam — PASS

`createWhisperInference` stores only the optional `promptProvider` function and
evaluates it once at the start of every `transcribe()` (`whisper-inference.mjs:87–118`).
The prompt is therefore chosen for the actual request, not inference creation;
`createEarPipeline` forwards the same getter when it lazily creates the
inference client (`ear-pipeline.mjs:388–394`). The mutable fake tests prove Cody
then Chappy prompts through one inference/pipeline without ear restart.

Literal compatibility is preserved: a string `options.prompt`, including an
explicit empty string, remains the fallback; a non-function provider or
non-string result falls back to that literal and then the existing Cody default.
The returned transcript still comes only from the server response
(`whisper-inference.mjs:157–159`), and the prompt-authority regression passes.

Provider exceptions intentionally propagate. In the ear pipeline they are
contained by the existing per-utterance ASR failure handling, so the resident
pipeline continues; a direct inference caller receives the error as before.

### Handling-time scheduler seams — PASS

`nameVariantsProvider` and `commentNameVariantsProvider` are called only during
the corresponding matching decisions (`fire-scheduler.mjs:478–482, 731–775`),
not at scheduler construction. `buildNeedles` creates a fresh normalized array
from the provider's current array and never mutates or retains that returned
array. Frozen arrays from Domain A are accepted by `Array.isArray`; no brain ID
or name table is introduced in Domain B.

The provider calls occur after the existing disposed/speaker/text/OFF/busy
guards. Thus `speaker:"soul"` remains excluded, OFF/busy remains silent, and
viewer transcript rows remain a no-op. Turn-end pending-gate ordering and all
verbosity timers/budgets are untouched. The targeted follow-up tests now cover
every accepted Chappy voice (2) and comment (5) variant, reject unlisted
`ChApPy` and old-family values, assert zero provider calls during construction,
and verify custom literal arrays plus non-function/non-array fallbacks.
The full scheduler suite passes 63/63.

Absent/non-function providers preserve the original literal arrays and static
needles. A non-array result falls back to the literal option/default. A getter
exception propagates by design; Domain C must provide the total canonical
resolver closure. An array containing only invalid values is filtered to no
needles rather than falling back; canonical Domain A arrays are frozen,
non-empty strings, so this is a malformed-injection residual rather than a
current-wave path.

### Scope and handoff — PASS

The exact Domain C handoff names are `promptProvider`, `nameVariantsProvider`,
and `commentNameVariantsProvider`. C should resolve `currentBrain` through
Domain A's `resolveBrainIdentity`/frozen contract at invocation time and return
only the contract's `whisperPrompt`, `voiceCallVariants`, and
`commentCallVariants`. B does not duplicate the four-brain mapping.

The ear pipeline currently shallow-copies `options.whisper` and passes it to the
server factory; the real `createWhisperServer` ignores unknown
`promptProvider`, while only `createWhisperInference` consumes it. No provider
state is mutated or exposed on any wire/history/schema surface. Keeping this
option filtering tighter is an optional follow-up, not a behavioral blocker.

## Diff scope / forbidden paths

The live Domain B diff is exactly:

- `apps/soul/agent/src/ears/whisper-inference.mjs`
- `apps/soul/agent/src/ears/whisper-inference.test.mjs`
- `apps/soul/agent/src/ears/ear-pipeline.mjs`
- `apps/soul/agent/src/ears/ear-pipeline.test.mjs`
- `apps/soul/agent/src/mind/fire-scheduler.mjs`
- `apps/soul/agent/src/mind/fire-scheduler.test.mjs`

No prompt builder/lifecycle/session, registry, Cockpit/server/UI, disclosure,
memory, transcript/usage schema, persona, TTS, `src/voice/**`, package, or
lockfile path is changed by this domain. The scheduler remains import-free and
does not gain an LLM/provider path.

## Residuals and actionable handoff

No Domain B fix is required for this lane. Before wiring C, ensure its three
getters are total/no-throw and read the current brain at invocation time; do not
cache a brain mapping or return mutable/shared state that B would need to own.
If a future caller needs exception-to-default behavior, that is a reviewed
error-policy change (currently exceptions propagate and the existing ear
failure boundary handles Whisper errors). The worker-free 86/86 result is
focused evidence only; the normal worker runner remains environment-blocked by
pre-assertion `spawn EPERM`, and human ASR recognition remains a later gate.
