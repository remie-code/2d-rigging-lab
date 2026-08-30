# Domain C spec review — currentBrain wiring / final integration

## Verdict

**PASS — Loop 2 targeted re-review.** Blocking findings: **0**. The server
authority fix and the new provider-only/mismatch and historical-transcript
assertions are present in the current snapshot. The normal worker runner is
environment-blocked before assertions (`spawn EPERM`); worker-free evidence is
reported separately below. Human visible/real-provider checks remain pending
as the plan requires.

## Basis and scope

Reviewed independently:

- accepted plan `discussion/ai-cohost/implementation/orchestration/model-identity-wave-plan.md`;
- inventory contract, four primary inventories, integration, and final review;
- Domain A/B/D completion reports and all nine A/B/D review lanes;
- latest Domain C completion report (including Loop 2), C source/tests, and live
  diff.

The C diff is confined to the six assigned paths (the two cockpit script files,
the two cockpit-server files, and the two fire-orchestrator prompt-builder
files): **268 insertions / 17 deletions**. No A/B/D implementation path,
`src/voice/**`, transcript/history/memory/settings schema, viewer identity,
technical brain labels, or TTS implementation path was changed by C.

## Acceptance review

- **Single authority and mapping:** `currentBrain` is captured once in
  `scripts/cockpit.mjs`; `resolveBrainIdentity(currentBrain)` is the sole
  closure supplied to prompt, Whisper, scheduler, and server state. The A
  frozen registry binds `claude` to Cody and `codex`, `codex-55`, and
  `codex-56-sol` to Chappy. C adds no four-brain/name table.
- **Prompt/lifecycle:** `ensureFireResources()` resolves the identity once
  when creating a new session and composes the identity line with the existing
  memory prompt. Brain selection remains `dispose()` then `session = null`; the
  changed self-name is observable only on the next Fire. The fake reverse swap
  leaves the pending old request untouched; no in-flight response is relabeled.
- **Input seams:** the server passes request-time `whisper.promptProvider` and
  handling-time voice/comment variant providers. Mutable fakes show Claude ↔
  GPT values changing without ear or scheduler recreation; B negatives keep
  the inactive family from matching.
- **Public state:** `snapshot()` derives exactly additive
  `brain.identity = { id, displayName }` from the injected current-identity
  provider. It remains authoritative when technical status is absent or
  deliberately mismatched, while technical `brain` and `credentialHealth`
  remain unchanged. The four POST/GET projections and unknown technical-ID Cody
  fallback pass. UI consumes only this pair; no mapping is derived in UI.
- **Non-goals:** transcript/SSE transcript entries, usage, memory, persisted
  history, settings, viewer `displayName`, persona, TTS speaker/dependency, and
  technical IDs are unchanged. A server transcript snapshot explicitly asserts
  historical entries have no `identity` field. The fake-only TTS regression
  keeps one frozen player/configuration across both swaps (creation count 1);
  no real TTS/provider path is exercised.
- **Documentation:** the operational checklist and `apps/soul/README.md`
  explicitly state that only the current name/next Fire changes and that past
  or in-flight transcript/SSE/usage/memory/history text is not attributed,
  renamed, or rewritten, with no TTS/persona-change claim.

## Raw evidence

Worker-free selected-import run (single process, exit 0): **403/403 passed**,
0 failed/skipped/cancelled. Per-file counts were:

```text
model-identity 4/4; brains 14/14; whisper 11/11; ear-pipeline 12/12;
fire-scheduler 63/63; fire-orchestrator 68/68; cockpit script 70/70;
cockpit-server 120/120; cockpit-ui 41/41.
```

Normal runner results for each C file (`fire-orchestrator.test.mjs`,
`scripts/cockpit.test.mjs`, `cockpit-server.test.mjs`) were separately:
`exit 1; one file subtest; tests 1; pass 0; fail 1; spawn EPERM before any
assertion`. Per the plan this is an environment limitation, not a green run
and not an assertion-level implementation failure.

Additional guards:

```text
node --check on all six C source/test modules: exit 0 (6/6).
git diff --check on six C paths: exit 0 (only LF/CRLF normalization warnings).
node scripts/check-soul-zone-boundary.mjs: exit 0; 1391 files scanned; 0 violations.
src/voice/** diff paths: 0. Package/lockfile diff paths: 0.
real provider calls / external network calls / credential-content reads: 0/0/0.
```

## Blocking findings

None. No actionable Gnome source fix is required for PASS.

## Nonblocking residuals / follow-up

1. The C swap/TTS test uses a production-proxy plus local fake
   `ensureFireResources` harness rather than invoking `main()`'s private
   closure. Source inspection and 68/70/120 focused runs cover the wiring;
   an optional future hardening test could expose an injectable swap harness.
2. The SSE brain-selection test asserts the technical `brain` marker but not
   the identity pair on that event. `broadcastState()` uses the same tested
   snapshot path, so this is test hardening only; a future C Gnome pass could
   add one `evt.data.brain.identity` deep-equality assertion.
3. Real ASR recognition, visible title/header, next-Fire behavior against a
   real provider, and the operator disclosure are deliberately human-gate
   work. The fake-only TTS invariant is the required automated evidence.
4. Ordinary historical comments/reports that still mention Cody are retained
   under accepted AC-05; no broad rewrite is indicated.

## Conclusion

Domain C satisfies the frozen spec mechanically after Loop 2. It is ready for
the cross-domain mechanical gate, with the normal-run EPERM limitation and
human gate carried forward explicitly.
