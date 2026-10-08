# Domain A test review — model identity

## Verdict

**PASS** (loop 1). The focused Domain A tests execute all assertions in the
worker-free fallback and cover the frozen contract, exact four-brain bindings,
Cody fallback, immutability/reference invariants, and fake-only provider paths.

## Basis and scope

- Plan: `discussion/ai-cohost/implementation/orchestration/model-identity-wave-plan.md` §§3, 6, 10, 11.
- Implementation report: `discussion/ai-cohost/implementation/waves/model-identity/domain-a.md`.
- Reviewed source/tests: `apps/soul/agent/src/mind/model-identity.mjs`,
  `model-identity.test.mjs`, `brains.mjs`, and `brains.test.mjs`.
- Worktree status was captured before review. Other dirty files are concurrent
  work; this review treats only the Domain A files above as owned scope.

## Coverage findings

- Full frozen identity contract: `model-identity.test.mjs` deep-equals every
  Cody and Chappy field and exact variant list (4 tests total in that file).
  It checks `MODEL_IDENTITIES`, each identity object, and both variant arrays
  with `Object.isFrozen`.
- Exact mapping: `brains.test.mjs` asserts strict-reference bindings for
  `claude → MODEL_IDENTITIES.cody` and each of `codex`, `codex-55`, and
  `codex-56-sol → MODEL_IDENTITIES.chappy`; expected registry IDs are also
  asserted.
- Fallback: `resolveModelIdentity` tests absent, null, empty, legacy/unknown,
  numeric, object, and array values; `resolveBrainIdentity` tests absent and
  removed persisted brain values. Both must return the canonical frozen Cody
  object.
- Anti-alias/immutability: strict-reference assertions ensure registry and
  resolver results reuse the canonical objects (no mutable copies), while
  top-level, identity, and nested-array freezes are asserted. Deep-equal
  expected Chappy variants also prevent accidental Cody-array reuse.
- Provider isolation: registry imports do not invoke factories. The two
  factory tests inject a fake Codex SDK and scratch home/ledger, exercise
  `session.ask`, and clean the scratch directory. No Claude/Codex provider,
  credential content, or network path is exercised; observed real provider
  calls: **0**.

## Commands and raw evidence

1. `node --test apps/soul/agent/src/mind/model-identity.test.mjs apps/soul/agent/src/mind/brains.test.mjs`
   - exit **1**;
   - files discovered **2**; tests **2**, pass **0**, fail **2**, cancelled **0**, skipped **0**;
   - both failures are `failureType: testCodeFailure`, `error: spawn EPERM`
     from Node's child-worker creation before assertions. This is an
     environment limitation, not assertion evidence and not a green run.
2. `node --input-type=module -e "await import('./apps/soul/agent/src/mind/model-identity.test.mjs'); await import('./apps/soul/agent/src/mind/brains.test.mjs');"`
   - exit **0**;
   - tests **18**, pass **18**, fail **0**, cancelled **0**, skipped **0**.
   - This worker-free selected-import run executes the test assertions in one
     process; counts are not combined with the failed worker run.
3. `node --check` on all four Domain A source/test files: exit **0** for each.
4. `git diff --check` on tracked Domain A modifications: exit **0**.

## Scope and forbidden-path audit

The Domain A diff adds only `model-identity.mjs`/test and identity fields plus
resolver/tests in `brains.mjs`/`brains.test.mjs`; no prompt, ears, scheduler,
Cockpit, memory, disclosure, TTS, package/lockfile, or provider implementation
file is touched by this domain. `git status --short -uall -- apps/soul/agent/src/voice`
returned no paths: `src/voice/**` changes **0**.

## Residual risks

- Normal Node worker-runner acceptance remains unavailable due to the
  pre-assertion `spawn EPERM`; retain the 18/18 worker-free result as the only
  assertion evidence until an environment permits workers.
- Cross-domain consumption (prompt, request/handling-time input seams, UI
  projection, and next-Fire lifecycle) is not tested here and remains for
  Domains B/C/D and their integration lanes.
- Human ASR/name recognition and live-provider behavior remain outside this
  fake-only lane.
