# Model identity Domain D review — test lane

## Verdict

**PASS** — loop 3 targeted re-review; blocking findings **0**. The loop-1
malformed cross-family pair finding and loop-2 documentation finding are fixed;
the validator, neutral fallback tests, and operator-facing no-rewrite copy are
all present. Normal worker-based execution remains an environment limitation
and is recorded separately, never as green evidence.

## Targeted change reviewed

`apps/soul/agent/src/cockpit/ui/header.mjs:31–47` now uses one frozen
`IDENTITY_PAIRS` contract and accepts only the canonical pairs:

```text
{ id: "cody",   displayName: "こーでぃー" }
{ id: "chappy", displayName: "チャッピー" }
```

`apps/soul/agent/src/cockpit/cockpit-ui.test.mjs:431–461` adds both inverse
cross-pair negatives, wrong-type cases, and neutral-title checks. The shared
`identityDisplayName` validator is still used by both `Header` and
`cockpitDocumentTitle`; no technical brain ID is inspected.

Independent direct probe (exit 0) confirms the complete acceptance matrix:

```text
cody/こーでぃー     -> こーでぃー / こーでぃー — Soul Cockpit
chappy/チャッピー   -> チャッピー / チャッピー — Soul Cockpit
cody/チャッピー     -> Soul Cockpit / Soul Cockpit
chappy/こーでぃー   -> Soul Cockpit / Soul Cockpit
gpt/チャッピー      -> Soul Cockpit / Soul Cockpit
null, undefined, wrong types -> Soul Cockpit / Soul Cockpit
```

Direct Header vnode probe (exit 0) for both cross-pairs yielded text beginning
`Soul CockpitListening...` and containing no Cody/Chappy display name.

## Evidence and raw results

### Focused tests

Normal runner:

```text
node --test apps/soul/agent/src/cockpit/cockpit-ui.test.mjs
exit 1; one file discovered; assertions started 0; pass 0; fail 1;
skipped 0; cancelled 0; suites 0; pre-assertion worker creation error `spawn EPERM`.
```

This is the known environment-origin limitation, not an assertion failure and
not PASS evidence.

Worker-free selected-import fallback:

```text
node --input-type=module -e "await import('./apps/soul/agent/src/cockpit/cockpit-ui.test.mjs'); await import('./apps/soul/agent/src/cockpit/cockpit-static-assets.test.mjs');"
exit 0; cockpit-ui 41/41; cockpit-static-assets 10/10; combined 51/51;
fail 0; skipped 0; cancelled 0; todo 0.
```

Static-assets tests use only an injected loopback server (`127.0.0.1`), not an
external network. Real provider calls: **0**; external network calls: **0**;
credential-content reads: **0**; no browser, microphone, or TTS runtime was
started.

### Requirement coverage

- Static neutral title: `cockpit.html:6` is `<title>Soul Cockpit</title>`;
  test 24 (`cockpit-ui.test.mjs:381–385`) asserts it and rejects Cody, Chappy,
  Claude, and GPT literals.
- Server-provided rendering: tests 26–27 exercise valid Cody and Chappy
  identity props through the `Header` vnode, plus missing/unknown neutral
  handling. Technical brain labels remain fixed by the four-option fixture at
  test 39.
- Title update output: `cockpitDocumentTitle` is tested for both valid pairs,
  unknown/missing values, wrong types, and both cross-pairs. `app.mjs:227–235`
  wires the current `state.brain.identity` to `document.title` and recomputes
  neutral on malformed/missing current state.
- Malformed fallback: both inverse cross-family pairs and wrong-type/unknown/
  missing inputs now return neutral in the helper and title assertions. The
  implementation probe also confirms `Header({identity: crossPair})` renders
  `Soul Cockpit` through the shared validator; no stale family text appears.
- No UI mapping: rerun guard over `header.mjs`, `app.mjs`, and `cockpit.html`:
  `rg -n -i "claude|codex|gpt|provider|model"` returned **NO_MATCH**. The
  exact public-pair validator is not a technical brain-to-name table.
- Operations/docs: checklist has copy-ready Claude/Cody and GPT/Chappy
  disclosures plus a selection-aware short form. It explicitly keeps the
  configured AI output device independent of the selected head; README states
  TTS output/speaker/persona are unchanged and self-name changes from next
  Fire. README and checklist now also explicitly say that prior/in-flight
  transcript, SSE transcript, usage, memory, persisted history, and settings
  receive no identity attribution and are never relabeled or rewritten; the
  README picker lists all four current technical brain choices.

### Static, syntax, scope, and forbidden paths

```text
node --check header.mjs app.mjs cockpit-ui.test.mjs       exit 0
git diff --check [six Domain D paths]                    exit 0
git status/diff -- apps/soul/agent/src/voice             0 paths
```

The six reported Domain D paths are the cockpit HTML/UI source and test,
README, and pre-stream checklist. No server, registry, prompt, history,
memory, settings schema, or `src/voice/**` path changed in this domain.

## Residuals / follow-up

1. The suite does not mount `App` or execute its hook effect; actual browser
   DOM title assignment remains a human/UI integration check. The pure title
   function and source wiring are covered deterministically.
2. The malformed Header fallback is covered through the shared validator and a
   direct probe, but the repository test does not yet instantiate `Header` with
   each cross-pair (it instantiates valid pairs and `undefined`). Adding those
   two vnode assertions is a low-cost hardening follow-up, not a blocking gap
   after the exact-pair validator is unit-tested.
3. No human visible-title or live identity/ASR gate was run; those remain
   separate Domain C/human-gate evidence.

## Re-review disposition

Loop-1 D-T1 and loop-2 documentation findings are closed. Exact pair validation
and inverse cross-pair/title negatives remain green at **51/51** worker-free
assertions; docs-only checks are `git diff --check` exit 0. Domain D test lane
is **PASS** pending Domain C integration and the separate human gate; retain
the normal-run `spawn EPERM` classification.
