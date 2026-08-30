# Domain A completion report: model identity contract / resolver

## Scope and ownership

Implemented only the Domain A assignment from
`discussion/ai-cohost/implementation/orchestration/model-identity-wave-plan.md` §§3 and 6:

- one frozen Cody/Chappy identity contract and fallback resolver;
- bindings for all four existing `BRAINS` entries;
- focused fake-only unit coverage for exact values, exact variants, immutability,
  four-brain mapping, and unknown/absent fallback.

No prompt, ears, scheduler, Cockpit UI/server, operations disclosure, memory,
TTS, package/lockfile, map, or provider code was edited. No provider calls,
network calls, or credential-content reads were made (all real provider calls: **0**).

Before editing, `git status --short -uall` was captured. It showed **33
pre-existing paths** (the existing `.codex` edits, discussion maps/reports,
inventory artifacts, and `discussion/expo.zip`); those paths were preserved and
not edited by this assignment. The final worktree has those same pre-existing
paths plus the five Domain A paths listed below.

## Files changed (owned files only)

1. `apps/soul/agent/src/mind/model-identity.mjs` (new, 89 lines)
   - `MODEL_IDENTITIES.cody` and `.chappy` are deeply frozen contracts with
     `id`, `canonicalName`, `latinName`, `displayName`, `whisperPrompt`,
     `voiceCallVariants`, and `commentCallVariants`.
   - Values and variant lists match plan §3 exactly; Chappy has only the two
     accepted voice forms and five accepted comment forms.
   - `DEFAULT_MODEL_IDENTITY` is Cody and `resolveModelIdentity(unknown)`
     preserves the existing Claude/Cody fallback.
2. `apps/soul/agent/src/mind/model-identity.test.mjs` (new, 71 lines)
   - exact Cody/Chappy contract and variant assertions;
   - deep-freeze assertions;
   - valid resolver identity preservation and unknown/absent fallback tests.
3. `apps/soul/agent/src/mind/brains.mjs` (22 added / 4 removed lines)
   - imports the single contract and attaches the same frozen identity object
     to `claude`, `codex`, `codex-55`, and `codex-56-sol`;
   - exports `resolveBrainIdentity(brainId)`, which resolves registry bindings
     and falls back to Cody for unknown/absent persisted values;
   - technical ids, labels, factories, model/effort wrappers, and credential
     paths remain unchanged.
4. `apps/soul/agent/src/mind/brains.test.mjs` (21 added / 1 removed line)
   - exact four-entry Cody/Chappy identity binding and frozen-reference tests;
   - resolver mapping and unknown/absent fallback tests.

The four existing registry entries remain the only brain-to-identity bindings;
there is no second consumer-side mapping.

## Verification evidence

### Normal Node test runner (environment-limited)

Command:

```text
node --test apps/soul/agent/src/mind/model-identity.test.mjs apps/soul/agent/src/mind/brains.test.mjs
```

Exit code: **1**. Node discovered **2 files**, but both failed before any test
assertion while creating the runner child worker (`failureType: testCodeFailure`,
`error: spawn EPERM`). Raw runner summary: `tests 2`, `pass 0`, `fail 2`,
`cancelled 0`, `skipped 0`; this is classified as the known environment
limitation, not an implementation assertion failure and not a green run.

### Worker-free selected-import fallback

Command:

```text
node --input-type=module -e "await import('./apps/soul/agent/src/mind/model-identity.test.mjs'); await import('./apps/soul/agent/src/mind/brains.test.mjs');"
```

Exit code: **0**. Both selected files ran in one process without spawning
workers: **18/18 passed**, **0 failed**, **0 skipped**, **0 cancelled**.

### Syntax / diff guards

```text
node --check apps/soul/agent/src/mind/model-identity.mjs
node --check apps/soul/agent/src/mind/brains.mjs
node --check apps/soul/agent/src/mind/model-identity.test.mjs
node --check apps/soul/agent/src/mind/brains.test.mjs
git diff --check -- apps/soul/agent/src/mind/brains.mjs apps/soul/agent/src/mind/brains.test.mjs apps/soul/agent/src/mind/model-identity.mjs apps/soul/agent/src/mind/model-identity.test.mjs
```

All syntax checks and `git diff --check` completed with exit code **0**.

`git status --short -uall -- apps/soul/agent/src/voice` returned **0 paths**;
`apps/soul/agent/src/voice/**` is untouched (explicit required count: **0**).

## Handoff notes

- Domain B should consume `resolveBrainIdentity(currentBrain)` or the returned
  frozen contract's `whisperPrompt`, `voiceCallVariants`, and
  `commentCallVariants`; do not add aliases or a family/name table in ears or
  scheduler code. Request/handling-time provider seams remain B's ownership.
- Domain D should use the exact public projection `{ id, displayName }` from the
  current resolver result for fake Cockpit state. Do not serialize the full
  contract or derive family/name from technical labels.
- Domain C owns current-brain composition and next-Fire prompt lifecycle. It
  should resolve the identity once when creating a new session and retain the
  existing unknown-brain Claude fallback; historical transcript/SSE/memory and
  TTS behavior remain unchanged.

## Residual concerns

- The repository's normal Node test runner remains blocked by pre-assertion
  `spawn EPERM`; the 18/18 worker-free result is valid focused evidence but is
  not a full worker-runner acceptance result.
- Human gate, live ASR vocabulary observations, and cross-domain integration
  are intentionally pending for Domains B/C/D and are outside this report.
