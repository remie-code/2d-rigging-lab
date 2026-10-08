# Domain D design review — UI/current disclosure (loop 3)

## Verdict

**PASS** — blocking findings **0**; nonblocking residuals are the known
`spawn EPERM` runner limitation and pending C/human-gate evidence. The pair
validator and the docs-only scope-boundary fix both satisfy the accepted UI
contract. No source, test, or documentation file other than this review report
was edited by Review-Sylph.

## Basis and scope

- Accepted basis: `discussion/ai-cohost/implementation/orchestration/model-identity-wave-plan.md`
  §§2–4, 8, 10–15 (AC-04 exact public projection + neutral malformed fallback,
  AC-05 disclosure, and Domain D ownership).
- Re-read Domain A contract/report, inventory UI contract/final review, Domain D
  completion report, current source/tests/diff, and loop-2 findings.
- The launch packet explicitly assigns `apps/soul/README.md` and
  `discussion/ai-cohost/operations/pre-stream-checklist.md` to Domain D's
  current-disclosure work. Their present-tense target behavior is therefore
  accepted documentation scope; C remains the runtime dependency and the
  human gate remains separate evidence.

## Design assessment

### Exact public pair and neutral fallback — PASS

`apps/soul/agent/src/cockpit/ui/header.mjs:25-49` uses an immutable list of
only these public pairs and compares both fields together:

```text
{ id: "cody",   displayName: "こーでぃー" }
{ id: "chappy", displayName: "チャッピー" }
```

The UI consumes `state.brain.identity` without deriving from technical brain
IDs (`apps/soul/agent/src/cockpit/ui/app.mjs:75-96,227-250`). It has no
`claude`/`codex`/GPT/provider/model mapping. The static title is neutral before
state (`cockpit.html:5`), and the same validator feeds header and document
title, preventing stale claims when state is missing or malformed.

Independent direct probe (exit 0):

```text
valid Cody                  -> こーでぃー / こーでぃー — Soul Cockpit
valid Chappy                -> チャッピー / チャッピー — Soul Cockpit
cross Cody/Chappy           -> Soul Cockpit / Soul Cockpit
cross Chappy/Cody           -> Soul Cockpit / Soul Cockpit
unknown or missing          -> Soul Cockpit / Soul Cockpit
```

The added fixtures cover both cross-pairs, unknown/missing values, and wrong
field types (`apps/soul/agent/src/cockpit/cockpit-ui.test.mjs:431-461`). This
is public wire-shape validation, not a second four-brain-to-name table.

### Ownership and non-historical UI behavior — PASS

Feed restoration/live routing remains `feedFromHistory`/`feedAfterSseEvent`
(`app.mjs:164-197`); identity is not added to transcript rows, usage entries,
memory, persisted settings, or history. Technical brain labels/raw IDs,
settings interaction, and accessibility paths remain unchanged. No
`src/voice/**`, server, registry, prompt, memory, transcript/history,
settings-schema, provider, package, or lockfile path changed in Domain D.

### Current disclosure and lifecycle boundary — PASS

- The checklist has explicit Claude/Cody and GPT/Chappy copy plus a marked
  selection-dependent short form (`pre-stream-checklist.md:6-23`). Its voice
  checklist keeps the configured AI output independent of the selected head
  (`:30-45`); no persona/TTS coupling claim was added.
- The README picker now names all four current technical choices with exact
  labels — Claude Opus 4.8, Codex GPT-5.6 Terra, GPT-5.5, and GPT-5.6 Sol —
  matching `BRAINS` (`apps/soul/README.md:402-404`; `apps/soul/agent/src/mind/brains.mjs:49-89`).
- Both README and checklist explicitly state that switching changes only the
  current name/next-Fire self-introduction and does not add identity
  attribution, re-label, or rewrite prior/in-flight transcript, SSE transcript,
  usage records, memory, persisted-history text, or settings
  (`apps/soul/README.md:420-424`; `pre-stream-checklist.md:20-24`). This closes
  the loop-2 documentation finding while preserving existing AI/memory/privacy
  disclosure semantics.
- No historical wave report or unrelated documentation was mechanically
  rewritten.

## Independent raw verification

### Worker-free focused fallback

```text
node --input-type=module -e "await import('./apps/soul/agent/src/cockpit/cockpit-ui.test.mjs'); await import('./apps/soul/agent/src/cockpit/cockpit-static-assets.test.mjs');"
```

Loop-2 source fix result (unchanged by this docs-only loop): exit **0**;
**51/51 passed**, 0 failed, 0 skipped, 0 cancelled (UI **41/41** and
static-assets **10/10**). It includes cross-pair/title negatives,
history/feed fixtures, technical brain-label fixtures, and the neutral static
title.

### Normal Node runner (environment limitation)

```text
node --test apps/soul/agent/src/cockpit/cockpit-ui.test.mjs
```

Exit **1** before assertions: worker creation returned `spawn EPERM`
(`failureType: testCodeFailure`, 0 assertions started). Per the accepted plan,
this is an environment limitation, not an assertion failure and not green
evidence; it remains separate from the 51/51 fallback.

### Static/scope checks

- `rg -n -i "claude|codex|gpt|provider|model"` over `header.mjs`, `app.mjs`,
  and `cockpit.html`: **NO_MATCH**.
- `git diff --check` over the six Domain D paths plus the docs-only fix: exit
  **0** (only existing LF→CRLF normalization warnings).
- Domain D paths are the four UI source/test files plus the assigned README and
  pre-stream checklist; no additional implementation path was touched.
- `git diff --name-only -- apps/soul/agent/src/voice`: **0 paths**.
- Real provider calls, external network calls, and credential-content reads:
  **0**; no staging or commit performed.

## Residuals / gate state

- Domain D design lane: **PASS (loop 3)**.
- The normal worker-based runner is environment-blocked; the separate 51/51
  worker-free result is valid focused evidence but must not be combined with
  the failed runner count.
- Real server projection/currentBrain wiring, browser-visible title, next-Fire
  behavior, practical name recognition, and disclosure selection remain Domain
  C and human-gate work; this UI review does not claim those fake-only checks.
