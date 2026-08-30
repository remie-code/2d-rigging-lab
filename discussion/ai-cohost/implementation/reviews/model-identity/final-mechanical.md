# Model identity wave — final mechanical review

## Verdict

**PASS — mechanical gate.** Blocking findings: **0**. All 12 domain review
lanes are present and PASS after their recorded loops. The separate human gate
is explicitly **PENDING**.

This report is an independent closeout check; it does not combine failed
worker-runner counts with worker-free assertion counts and does not claim live
provider, microphone, browser, or TTS acceptance.

## Basis and persistent artifacts

Independently reread the accepted plan, inventory contract/primary/integrated
reports and final review, all four Gnome completion reports, the current source
and tests, the live diff/status, all 12 lane reports, and
`waves/model-identity/human-gate.md`.

| Artifact | Mechanical status |
|---|---|
| `orchestration/model-identity-wave-plan.md` | present |
| Domain A/B/C/D completion reports | 4/4 present |
| Spec/design/test review lanes | 12/12 present; 12/12 PASS |
| `waves/model-identity/human-gate.md` | present; PENDING template, no operator evidence |
| `final-closeout.md` | not yet present; L1 closeout remains pending |
| This report | written only at the assigned final-mechanical path |

Review loops recorded by the lane artifacts: Domain A **1**; Domain B **2**
(targeted test re-review); Domain C **2** (targeted integration re-review);
Domain D **3** (pair-validator and documentation re-reviews).

## Raw commands and results

### Normal runner (attempted once)

Command (one invocation):

```text
node --test apps/soul/agent/src/mind/model-identity.test.mjs apps/soul/agent/src/mind/brains.test.mjs apps/soul/agent/src/ears/whisper-inference.test.mjs apps/soul/agent/src/ears/ear-pipeline.test.mjs apps/soul/agent/src/mind/fire-scheduler.test.mjs apps/soul/agent/src/mind/fire-orchestrator.test.mjs apps/soul/agent/scripts/cockpit.test.mjs apps/soul/agent/src/cockpit/cockpit-server.test.mjs apps/soul/agent/src/cockpit/cockpit-ui.test.mjs apps/soul/agent/src/cockpit/cockpit-static-assets.test.mjs
```

Raw result: exit **1**; 10 file subtests discovered, **0 pass / 10 fail / 0
skipped / 0 cancelled**. Every failure was `ChildProcess.spawn -> spawn EPERM`
before assertions (`failureType: testCodeFailure`). This is the managed
environment worker-spawn limitation, not an assertion-level implementation
failure and not green evidence.

### Worker-free selected imports

Each command was a separate in-process `node --input-type=module -e
"await import('./...test.mjs')"` invocation. Raw results, kept separate from
the failed runner above:

| Test file | Exit | Tests / pass / fail / skipped / cancelled |
|---|---:|---:|
| `model-identity.test.mjs` | 0 | 4 / 4 / 0 / 0 / 0 |
| `brains.test.mjs` | 0 | 14 / 14 / 0 / 0 / 0 |
| `whisper-inference.test.mjs` | 0 | 11 / 11 / 0 / 0 / 0 |
| `ear-pipeline.test.mjs` | 0 | 12 / 12 / 0 / 0 / 0 |
| `fire-scheduler.test.mjs` | 0 | 63 / 63 / 0 / 0 / 0 |
| `fire-orchestrator.test.mjs` | 0 | 68 / 68 / 0 / 0 / 0 |
| `scripts/cockpit.test.mjs` | 0 | 70 / 70 / 0 / 0 / 0 |
| `cockpit-server.test.mjs` | 0 | 120 / 120 / 0 / 0 / 0 |
| `cockpit-ui.test.mjs` | 0 | 41 / 41 / 0 / 0 / 0 |
| `cockpit-static-assets.test.mjs` | 0 | 10 / 10 / 0 / 0 / 0 |
| **Total (separate commands)** | **0** | **413 / 413 / 0 / 0 / 0** |

This is the current post-loop rerun; earlier per-domain/lane counts in the
persistent reports (including pre-loop scheduler counts) are historical
evidence only and were not added to this total.

The selected tests use fake sessions/fetch/pipelines/schedulers/TTS objects and
loopback-only HTTP fixtures; no external provider path was started.

### Syntax, guards, and fixtures

- `node --check` on **20 selected modules** (19 wave-touched JS source/tests,
  including both new model-identity modules, plus the static-assets fixture
  test): exit **0** for **20/20**, failures **0**.
- `node scripts/check-soul-zone-boundary.mjs`: exit **0**; **1,391** source
  files scanned; no import-direction violations.
- `git diff --check`: exit **0**. Output contained only existing LF→CRLF
  normalization warnings; no whitespace errors.
- A corrected ASCII-escaped inline identity probe imported the registry and
  prompt builder and passed **12/12** checks (exact values/variant arrays,
  deep freezes, four bindings, Cody fallback, and Chappy prompt). An initial
  ad-hoc Japanese-literal probe was rejected by the PowerShell code page before
  execution; the corrected probe is the recorded assertion result, not a source
  failure.

## Mechanical contract audit

### Identity authority and defaults — PASS

`src/mind/model-identity.mjs` is the sole frozen declaration. Exact fixed
values are preserved: Cody voice/comment variants **4/8** and Chappy
voice/comment variants **2/5**; Whisper prompts are the canonical Cody and
Chappy strings. `claude` binds by strict reference to Cody; `codex`,
`codex-55`, and `codex-56-sol` bind by strict reference to Chappy. Unknown or
absent identity/brain values resolve to the frozen Cody default. No alias
settings, user-editable alias migration, or per-model identity override was
added. The UI's exact `{id,displayName}` pair validator is an input guard, not
a technical brain-to-name table.

### Prompt, lifecycle, and input seams — PASS

The default `FIRE_SYSTEM_PROMPT` remains the Cody-compatible builder output;
the body is unchanged and only the self-name line is family-aware. All four
brain IDs receive the expected self-name in the new-session builder. Selection
still performs `dispose()` then `session = null`; identity is resolved once by
`ensureFireResources()` for the session created by the next Fire. No old or
in-flight response is relabeled.

Whisper resolves `promptProvider` at each request. Voice and comment matchers
resolve their providers at handling time, so switching families does not
recreate the ear or scheduler. The focused tests prove positive Chappy
variants, inactive Cody variants under GPT, and preservation of OFF/busy,
speaker-self exclusion, normalization, and literal fallback behavior.

### Current public UI identity — PASS

Server wiring uses the `currentBrain` resolver closure for Whisper, scheduler,
and public state. `state.brain.identity` is exactly the additive public pair
`{ id, displayName }`; the technical brain label and credential-health fields
remain unchanged. Provider-only and provider/technical-status mismatch cases
are covered. Missing, malformed, or unknown UI identity renders the neutral
`Soul Cockpit` header/title rather than stale Cody/GPT text. Technical brain
select labels and raw IDs remain visible.

### Non-goals and disclosure — PASS

No transcript entry, transcript SSE event schema, usage payload, memory Markdown,
persisted-history body, settings schema, viewer `displayName`, persona, TTS
speaker/voice, or technical brain ID/label was rewritten to carry identity.
The fake-only swap test keeps one TTS player and the same configured base URL /
speaker across Claude→GPT→Claude. `apps/soul/agent/src/voice/**` is unchanged.
The checklist and README provide Claude/Cody and GPT/Chappy copy and explicitly
state that TTS/persona and historical/in-flight attribution do not change.

## Scope and diff audit

Before this report was written, `git status --short -uall` contained **72**
paths: **40** wave paths (20 tracked source/docs changes, 2 new identity source
files, plan, 4 Gnome reports, 12 lane reports, and human-gate template) and
**32** pre-existing/concurrent unrelated paths. No unrelated path was edited by
this review; only this report was added.

Tracked wave diff: **20 files, 717 insertions / 48 deletions**. New identity
source/test files are **89 + 71 lines**. Forbidden-path audits returned:

- `src/voice/**`: **0 paths / 0 diff rows**;
- package or lock files: **0 paths**;
- provider/session adapter or credential files: **0 paths**;
- credential-content reads: **0**.

The concurrent `.codex`, map, inventory, archive, and workspace-activity paths
were preserved and are not attributed to this wave.

## Consumption and human boundary

| Resource/action | Mechanical count |
|---|---:|
| Real Claude provider calls | 0 |
| Real GPT/Terra/Sol provider calls | 0 |
| External network calls | 0 |
| Credential-content reads | 0 |
| Real microphone sessions/utterances | 0 |
| Real TTS playback checks | 0 |

Loopback HTTP used by fake server/static fixtures is not external consumption.
The operator-visible title/header, practical ASR recognition, real next-Fire
self-name in both directions, real voice/persona invariance, and disclosure
selection remain the separate human gate. `human-gate.md` is **PENDING** with
no rows executed.

## Nonblocking residuals and owners

These do not block the mechanical PASS and are explicitly retained:

1. **Managed runner / environment owner:** normal worker-based `node --test`
   remains pre-assertion `spawn EPERM`; worker-free evidence is the current
   machine evidence, not a claim that workers passed.
2. **Domain C / future integration hardening:** in-flight transcript `brain`
   technical labels use the pre-existing broadcast-time approximation;
   provider getter exceptions intentionally propagate under the Domain B
   contract. Neither changes identity attribution or production behavior in
   this wave.
3. **Domain C / future test hardening:** the swap test uses a local fake
   `ensureFireResources` harness; one SSE assertion checks the technical brain
   marker but not `brain.identity`; the fake TTS test does not traverse
   `createFireOrchestrator`'s production `speakDeps` path.
4. **Domain D / future UI test hardening:** tests do not mount `App` to execute
   the hook-driven document-title effect, and direct Header vnode coverage does
   not instantiate both malformed cross-pairs. Pure validators and source
   wiring pass; visible behavior belongs to the human gate.
5. **L1/maintainer and human-gate owners:** accepted historical reports/comments
   may still mention Cody; real ASR aliases, visible browser title/header,
   provider next-Fire behavior, and operator disclosure checks require a
   deliberate user run and must not be inferred from this report.

No blocking finding, unresolved child, provider call, external network call,
forbidden-path change, or ownership breach was found.

## Final status

- Domains completed: **4/4**
- Review lanes PASS: **12/12**
- Mechanical gate: **PASS**
- Human gate: **PENDING**
- Final closeout: **pending L1 artifact**
