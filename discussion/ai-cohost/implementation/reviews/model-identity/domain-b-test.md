# Domain B test review — dynamic input seams

## Verdict

**PASS** (loop 2, targeted re-review). The loop-1 scheduler evidence gaps are
closed by test-only changes. Blocking findings: **0**. Nonblocking residuals:
the normal worker runner remains environment-blocked and real ASR/provider
behavior remains a separate human gate.

## Basis and scope

- Plan: `discussion/ai-cohost/implementation/orchestration/model-identity-wave-plan.md`
  §§3, 7, 10, 11.
- Inventory: `discussion/reports/ai-cohost-model-identity-inventory/`
  contract, reports 01–04, and integrated report 10.
- Domain A contract/report: `apps/soul/agent/src/mind/model-identity.mjs`,
  `model-identity.test.mjs`, and
  `discussion/ai-cohost/implementation/waves/model-identity/domain-a.md`.
- Domain B report: `discussion/ai-cohost/implementation/waves/model-identity/domain-b.md`.
- Owned source/tests: the six Domain B paths under `src/ears/` and
  `src/mind/fire-scheduler{,.test}.mjs`.

The pre-review worktree snapshot showed concurrent A/D changes; they were
preserved. The targeted fix changes only `fire-scheduler.test.mjs` within the
owned scope. `apps/soul/agent/src/voice/**` has **0** diff/status paths. No
package/lockfile, provider, credential, or network files were changed.

## Re-review coverage

- **Whisper request-time seam:** existing tests still cover default, custom
  literal, and empty `options.prompt`; invalid/non-function providers and
  non-string results fall back correctly. The mutable fake changes Cody to
  `ちゃっぴー、チャッピー。` across two `transcribe()` calls and asserts two
  provider reads, proving no creation-time capture. Prompt text remains separate
  from the server-authoritative transcript response.
- **Ear forwarding:** one running synthetic ear/pipeline handles two utterances
  and observes Cody then Chappy multipart prompts without restart.
- **Dynamic voice matching:** the existing Cody→Chappy switch test retains the
  old-family negative. The added table-driven test (current
  `fire-scheduler.test.mjs:217`) feeds both frozen Chappy voice variants
  (`チャッピー`, `ちゃっぴー`), rejects unlisted `ChApPy` and old Cody text, and
  asserts provider reads are zero at construction then exactly four at
  handling (two positives plus two negatives).
- **Dynamic comment matching:** the existing switch test retains the old-family
  negative. The added test (`fire-scheduler.test.mjs:269`) feeds all five
  frozen Chappy comment variants (`Chappy`, `chappy`, `CHAPPY`, `チャッピー`,
  `ちゃっぴー`), rejects `ChApPy` and old `Cody`, and asserts zero construction
  reads then seven handling reads. `commentBudget: 0` isolates comment-call.
- **Literal/default compatibility:** the added test (`:297`) supplies custom
  literal voice/comment arrays, passes a non-function voice provider and a
  non-array comment provider, and proves each invalid provider falls back to
  its literal array. Existing default-variant and scheduler behavior tests
  remain intact.
- **Safety regression:** the pre-existing scheduler matrix still covers
  normalization/false positives, soul self-call exclusion, OFF/busy gates,
  turn-end arm/timeout, comment refractory/probability/budget, viewer no-op,
  determinism, verbosity, interjection, and LLM-import isolation.

## Commands and raw results

1. Normal runner:
   `node --test apps/soul/agent/src/ears/whisper-inference.test.mjs
   apps/soul/agent/src/ears/ear-pipeline.test.mjs
   apps/soul/agent/src/mind/fire-scheduler.test.mjs`
   - exit **1**; 3 files/subtests, **0 pass / 3 fail**, 0 skipped/cancelled;
   - every file failed before assertions with `ChildProcess.spawn -> spawn
     EPERM`. This is the documented environment limitation, not assertion
     evidence and not a green run.
2. Worker-free selected-import runs (raw counts kept separate):
   - `fire-scheduler.test.mjs`: exit **0**, **63/63 passed**;
   - `whisper-inference.test.mjs`: exit **0**, **11/11 passed**;
   - `ear-pipeline.test.mjs`: exit **0**, **12/12 passed**.
3. `node --check` on all six owned source/test files: exit **0** for every
   file. `git diff --check` on all six: exit **0** (only existing LF→CRLF
   warnings). `git diff --name-only -- apps/soul/agent/src/voice`: **0 paths**.

Real Claude/Codex/Terra/Sol provider calls: **0**. External network calls:
**0**. Credential-content reads: **0**.

## Handoff and residuals

The loop-1 blockers (missing per-variant Chappy assertions, missing scheduler
literal/invalid-provider assertions, and implicit construction-vs-handling
counts) are resolved. Domain C must still wire these getters to the canonical
Domain A resolver and preserve the exact lists; no brain-to-name mapping belongs
in Domain B. Human ASR recognition and a worker-capable normal runner remain
outside this lane.
