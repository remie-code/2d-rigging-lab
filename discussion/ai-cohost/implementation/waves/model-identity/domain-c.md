# Domain C completion report: currentBrain wiring / final integration

Status: implemented; all three Domain C review lanes pass (loop-2 targeted
re-review, blocking 0). The final mechanical gate and human gate remain
pending.

## Scope and pre-edit snapshot

The accepted basis was
`discussion/ai-cohost/implementation/orchestration/model-identity-wave-plan.md`
§§3, 9–15. Before editing, the required `git status --short -uall` snapshot
showed 19 modified paths and 42 untracked paths (Domain A/B/D artifacts,
inventory/reports, `.codex` edits, and `discussion/expo.zip`). None of the six
Domain C source/test paths below were in that snapshot. All pre-existing and
other-agent changes were preserved; no stage/commit/reset/revert/cleanup or
dependency/lockfile operation was performed.

## Owned diff

Only the following Domain C paths were edited, plus the explicitly permitted
adjacent prompt-builder/test pair:

- `apps/soul/agent/scripts/cockpit.mjs`
- `apps/soul/agent/scripts/cockpit.test.mjs`
- `apps/soul/agent/src/cockpit/cockpit-server.mjs`
- `apps/soul/agent/src/cockpit/cockpit-server.test.mjs`
- `apps/soul/agent/src/mind/fire-orchestrator.mjs` (minimal adjacent prompt builder)
- `apps/soul/agent/src/mind/fire-orchestrator.test.mjs` (builder coverage)
- this report

No Domain B/D files, `src/voice/**`, transcript/history/memory schemas, viewer
names, technical brain labels/IDs, settings schema, or provider adapters were
edited by Domain C.

## Integrated behavior

- `currentBrain` in `scripts/cockpit.mjs` remains the sole runtime selection
  authority. `resolveBrainIdentity(currentBrain)` is supplied as one closure to
  the server. No second brain-family/name table was introduced.
- `buildFireSystemPrompt(identity)` composes the frozen identity self-name line
  with the unchanged Fire prompt body. `FIRE_SYSTEM_PROMPT` remains the Cody
  default export. `buildBrainSessionSystemPrompt()` resolves the identity once
  per newly-created session; Claude keeps `あなたの名前はコーディ（Cody）です。`,
  and all GPT registry entries receive
  `あなたの名前はチャッピー（Chappy）です。`.
- Brain selection still performs `dispose()` then `session = null`; the new
  identity is used only when `ensureFireResources()` is reached by the next
  Fire. In-flight/old responses are not relabeled or rewritten.
- `createCockpitServer` accepts the resolver-backed `currentBrainIdentity`
  provider. Ear startup forwards a request-time `whisper.promptProvider`, and
  scheduler construction receives handling-time
  `nameVariantsProvider`/`commentNameVariantsProvider` closures. The provider
  object is not read at construction time, so Claude↔GPT changes need no ear or
  scheduler recreation.
- The server snapshot preserves the existing technical `brain` and
  `credentialHealth` fields and adds exactly
  `brain.identity = { id, displayName }`, derived from the injected
  `currentBrainIdentity` provider through the canonical identity resolver. The
  provider remains authoritative when technical status is absent or deliberately
  mismatched; provider-only snapshots still carry `brain.identity`. If the
  provider is absent, unknown/absent technical IDs retain the Cody fallback.
  Only the public id/displayName pair is serialized; aliases, Whisper text, and
  prompt metadata stay private.
- Existing transcript/SSE transcript/usage/memory/history/settings shapes are
  unchanged. Existing TTS construction is independent of brain selection.

## Focused tests and raw results

Normal Node runner (environment-origin limitation, before assertions):

```text
node --test apps/soul/agent/src/mind/fire-orchestrator.test.mjs
exit 1; tests 1; suites 0; pass 0; fail 1; error spawn EPERM

node --test apps/soul/agent/scripts/cockpit.test.mjs
exit 1; tests 1; suites 0; pass 0; fail 1; error spawn EPERM

node --test apps/soul/agent/src/cockpit/cockpit-server.test.mjs
exit 1; tests 1; suites 0; pass 0; fail 1; error spawn EPERM
```

These are classified as pre-assertion worker-spawn failures, not green runs
and not assertion failures.

Worker-free selected-import fallback (legitimate focused evidence):

```text
node --input-type=module -e "await import('./apps/soul/agent/src/mind/fire-orchestrator.test.mjs')"
exit 0; tests 68; pass 68; fail 0; skipped 0; cancelled 0

node --input-type=module -e "await import('./apps/soul/agent/scripts/cockpit.test.mjs')"
exit 0; tests 70; pass 70; fail 0; skipped 0; cancelled 0

node --input-type=module -e "await import('./apps/soul/agent/src/cockpit/cockpit-server.test.mjs')"
exit 0; tests 120; pass 120; fail 0; skipped 0; cancelled 0
```

The new/changed focused assertions include all-four brain prompt mapping,
Claude→GPT dispose/null/next-ask self-name lifecycle, public Cody/Chappy
snapshot projections plus unknown fallback, mutable Whisper/scheduler provider
switches without recreation, and a fake-only TTS regression. The TTS test keeps
one frozen base URL/speaker config and one fake player across the brain swap
(player creation count remains 1; dependency/config identity is unchanged).

Additional dependency checks run worker-free:

```text
model-identity.test.mjs       4/4 passed
brains.test.mjs              14/14 passed
whisper-inference.test.mjs   11/11 passed
fire-scheduler.test.mjs      63/63 passed
```

## Syntax, diff, and boundary guards

`node --check` passed (exit 0) for all six owned source/test modules.
`git diff --check -- <six owned files>` passed (exit 0; only Git's existing
LF→CRLF normalization warnings were emitted).

```text
node scripts/check-soul-zone-boundary.mjs
exit 0; 1391 source files scanned; no 器→魂 imports and no 魂→器 code imports

git diff --name-only -- apps/soul/agent/src/voice
git diff --numstat -- apps/soul/agent/src/voice
exit 0; no rows; src/voice/** change count = 0

git diff --name-only | package/lockfile filter
exit 0; no package.json/pnpm-lock/yarn/npm lock paths
```

No real Claude/Codex/Terra/Sol provider calls, external network calls, or
credential-content reads were made: **0 / 0 / 0**. Tests used local imports and
fake sessions, pipeline/fetch, scheduler, server, and TTS objects only.

## Handoff

The final mechanical Review-Sylph should verify the four Domain C acceptance
areas against the diff and these raw results, then record cross-domain
ownership, the 12/12 lane verdicts, forbidden-path count (including
`src/voice/** = 0`), zero-consumption evidence, and the EPERM classification in
`discussion/ai-cohost/implementation/reviews/model-identity/final-mechanical.md`.
The user-facing human-gate template/result remains
`discussion/ai-cohost/implementation/waves/model-identity/human-gate.md` and
must separately record visible Claude/GPT title/header, next-Fire self-name in
both directions, no old-text/in-flight/history rewrite, technical labels, and
selection-dependent disclosure without a TTS/persona-change claim.

Residual risk: the normal worker-based runner is unavailable in this managed
environment until the pre-assertion `spawn EPERM` condition changes; the
worker-free counts above are kept separate and are the current assertion
evidence. Real ASR/provider behavior and the visible human gate remain user-run
work.

## Loop 2 targeted design fix

The design lane requested that the injected `currentBrainIdentity` provider be
the public-state authority as well as the Whisper/scheduler source. The server
now normalizes that provider through `resolveModelIdentity`, keeps technical
status fields additive, emits an identity-only `brain` view when status is
unavailable, and proves provider precedence with a mismatched fake
(`brainStatus: codex` while provider identity is Cody). A transcript snapshot
assertion also confirms no `identity` field is added to historical entries.
The current six-file diff is **268 insertions / 17 deletions**.

Focused re-run after the fix:

```text
node --input-type=module -e "await import('./apps/soul/agent/src/cockpit/cockpit-server.test.mjs')"
exit 0; tests 120; pass 120; fail 0; skipped 0; cancelled 0

node --test apps/soul/agent/src/cockpit/cockpit-server.test.mjs
exit 1; one file subtest; tests 1; pass 0; fail 1; pre-assertion spawn EPERM

node --check apps/soul/agent/src/cockpit/cockpit-server.mjs
node --check apps/soul/agent/src/cockpit/cockpit-server.test.mjs
exit 0 for both
```

The Domain C design, spec, and test lanes have recorded targeted loop-2
re-review verdicts against this changed snapshot (all PASS, blocking 0).

The review lanes' nonblocking hardening notes are intentionally deferred: the
swap test uses a local fake lifecycle harness around the production session
proxy, the SSE assertion does not duplicate the already-covered HTTP identity
pair, and TTS invariance stays fake-only without invoking production
`speakDeps`. These do not change the accepted scope or the no-provider gate;
the final mechanical reviewer should retain them as residual follow-ups.
