# Domain A design review — model identity contract / resolver

## Verdict

**PASS** — loop 1; blocking findings **0**, nonblocking findings **0**.

The implementation has one frozen Cody/Chappy contract, binds all four registry
entries to those same object references, preserves Claude/Cody fallback for
unknown or absent persisted values, and leaves prompt/input/UI/history/TTS
composition to the downstream domains as required.

## Evidence and raw results

- Basis read: `discussion/ai-cohost/implementation/orchestration/model-identity-wave-plan.md`;
  inventory final review `discussion/reports/ai-cohost-model-identity-inventory/20-final-review.md`;
  Gnome report `discussion/ai-cohost/implementation/waves/model-identity/domain-a.md`.
- Current status captured before review: pre-existing dirty worktree; Domain A
  source changes are limited to `brains.mjs`, `brains.test.mjs`, and the two new
  `model-identity` files. No `apps/soul/agent/src/voice/**` paths are modified.
- Current line/diff counts: `model-identity.mjs` 89 lines,
  `model-identity.test.mjs` 66 lines; tracked diffs are `brains.mjs` 22 added /
  4 removed and `brains.test.mjs` 21 added / 1 removed.
- `node --test apps/soul/agent/src/mind/model-identity.test.mjs apps/soul/agent/src/mind/brains.test.mjs`:
  exit **1**, tests/files **2**, pass **0**, fail **2**, skipped **0**; both
  stopped before assertions with `spawn EPERM` while creating runner workers.
  This is the known environment limitation, not an assertion result or green
  run.
- Worker-free selected-import fallback (same two test files): exit **0**;
  **18/18 passed**, **0 failed**, **0 skipped**, **0 cancelled**.
- `node --check` on both source and both test files: exit **0**. `git diff
  --check` on tracked Domain A edits: exit **0**.
- `node scripts/check-soul-zone-boundary.mjs`: exit **0**; **1,391** source
  files scanned, no import-direction violations.
- Real provider calls **0**, external network calls **0**, credential-content
  reads **0**.

## Design assessment

1. **Single authority and registry binding — PASS.**
   `model-identity.mjs` is the sole declaration of Cody/Chappy values and
   exact voice/comment/Whisper variants. The identity objects and nested arrays
   are frozen. `brains.mjs` adds only the registry bindings and a brain-ID
   adapter (`resolveBrainIdentity`); it does not repeat a four-brain-to-name
   table or provider/model logic. All four entries point to the canonical
   `MODEL_IDENTITIES.cody` or `.chappy` references, which the focused tests
   assert by identity.

2. **Fallback and compatibility — PASS.**
   `resolveBrainIdentity` returns the attached contract for each known ID and
   `DEFAULT_MODEL_IDENTITY` (Cody) for unknown, absent, or malformed values.
   Existing IDs, labels, factories, model/effort wrappers, credential paths,
   `BRAINS`/`BRAIN_IDS` shape, and API validation code are unchanged. The new
   `identity` property is additive and frozen; no existing consumer-visible
   technical field is replaced.

3. **Downstream API shape / dependency direction — PASS.**
   The contract exposes the fields needed by B/C and the `{id, displayName}`
   projection required by D while retaining canonical/Latin names and matching
   variants for their owned seams. No prompt builder, Whisper, scheduler,
   Cockpit, wire/history, memory, persona, or runtime/TTS behavior is imported
   or changed in Domain A. The two resolver functions are adapters over the
   same frozen authority, not competing mappings.

4. **Immutability — PASS.**
   Top-level identities, each identity object, and all variant arrays are
   `Object.freeze`d; tests assert every level and resolver reference identity.
   Registry entries and the registry remain frozen as before.

5. **Owned-file and forbidden-scope discipline — PASS.**
   The current diff contains only the four assigned Domain A files. No voice
   path, lockfile/package, provider adapter, prompt/ear/scheduler/UI/server,
   transcript, memory, settings, or map file was edited by this change.

## Residual risks (non-blocking)

- The normal Node test runner remains environment-blocked by pre-assertion
  `spawn EPERM`; the 18/18 worker-free result is focused evidence, not a full
  worker-runner acceptance result.
- Existing Cody literals in prompt/Whisper/scheduler/Cockpit surfaces are
  intentionally untouched under Domain A ownership. B/D/C must consume the
  registry resolver/contract and prove dynamic switching, next-Fire semantics,
  and the exact current public projection in their own lanes.
- No human ASR/UI/provider run was attempted; all real-consumption counts remain
  zero as required.

No Gnome-targeted fix is required. Downstream domains should preserve this
single-authority binding and must not introduce a second family/name table.
