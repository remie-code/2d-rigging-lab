# AI Cohost model-identity wave — final closeout

> Mechanical status: **PASS** (the independent final mechanical review is PASS).
> Human status: **PENDING**. This is mechanically complete / human-gate pending,
> not full user closure.

## Gate and review status

| Domain | Completion report | Spec lane | Design lane | Test lane | Loops |
|---|---|---|---|---|---:|
| A — identity contract/resolver | [domain-a.md](domain-a.md) | PASS (1) | PASS (1) | PASS (1) | 1 |
| B — dynamic input seams | [domain-b.md](domain-b.md) | PASS (1) | PASS (1) | PASS (2 targeted) | 2 |
| C — currentBrain/final integration | [domain-c.md](domain-c.md) | PASS (2 targeted) | PASS (2 targeted) | PASS (2 targeted) | 2 |
| D — Cockpit identity/disclosure | [domain-d.md](domain-d.md) | PASS (3 targeted) | PASS (3 targeted) | PASS (3 targeted) | 3 |

- Domains completed: **4/4**.
- Review lanes: **12/12 PASS**; blocking findings **0**.
- Final mechanical review: **PASS** — [final-mechanical.md](../../reviews/model-identity/final-mechanical.md).
- Human gate: **PENDING**, with no operator rows executed — [human-gate.md](human-gate.md).

## Current mechanical evidence

The final mechanical review's post-loop run is the current count; earlier
per-domain counts are historical and are not added to it.

### Test runners

The combined normal command covered the ten relevant test files. It exited **1**:
10 file subtests discovered, **0 pass / 10 fail / 0 skipped / 0 cancelled**;
every file failed before assertions with `ChildProcess.spawn -> spawn EPERM`.
This is the managed-environment worker-spawn limitation, not an assertion
failure and not green evidence.

Each worker-free selected import exited **0**:

| Test file | Tests / pass / fail / skipped / cancelled |
|---|---:|
| `model-identity.test.mjs` | 4 / 4 / 0 / 0 / 0 |
| `brains.test.mjs` | 14 / 14 / 0 / 0 / 0 |
| `whisper-inference.test.mjs` | 11 / 11 / 0 / 0 / 0 |
| `ear-pipeline.test.mjs` | 12 / 12 / 0 / 0 / 0 |
| `fire-scheduler.test.mjs` | 63 / 63 / 0 / 0 / 0 |
| `fire-orchestrator.test.mjs` | 68 / 68 / 0 / 0 / 0 |
| `scripts/cockpit.test.mjs` | 70 / 70 / 0 / 0 / 0 |
| `cockpit-server.test.mjs` | 120 / 120 / 0 / 0 / 0 |
| `cockpit-ui.test.mjs` | 41 / 41 / 0 / 0 / 0 |
| `cockpit-static-assets.test.mjs` | 10 / 10 / 0 / 0 / 0 |
| **Separate-command total** | **413 / 413 / 0 / 0 / 0** |

### Guards and diff audit

- `node --check`: exit **0** for **20/20** touched source/test modules.
- `node scripts/check-soul-zone-boundary.mjs`: exit **0**; **1,391** source
  files scanned; no import-direction violations.
- `git diff --check`: exit **0**; only existing LF→CRLF normalization warnings.
- Corrected ASCII-escaped identity probe: **12/12** checks passed.
- At the final-mechanical snapshot, tracked wave diff was **20 files,
  717 insertions / 48 deletions**; the two new identity modules are **89 +
  71 lines**. The closeout artifact itself was not part of that audit.
- Forbidden-path counts: `apps/soul/agent/src/voice/**` **0 paths / 0 rows**;
  package/lockfile paths **0**; provider/session-adapter/credential files
  **0**; credential-content reads **0**.

## Exact scope and invariant audit

Implementation and disclosure scope was limited to these owned paths:

- Domain A: new `src/mind/model-identity.mjs` and test, plus
  `src/mind/brains.mjs` and test.
- Domain B: `src/ears/whisper-inference{,.test}.mjs`,
  `src/ears/ear-pipeline{,.test}.mjs`, and
  `src/mind/fire-scheduler{,.test}.mjs`.
- Domain C: `scripts/cockpit{,.test}.mjs`,
  `src/cockpit/cockpit-server{,.test}.mjs`, and
  `src/mind/fire-orchestrator{,.test}.mjs`.
- Domain D: `src/cockpit/cockpit.html`, `ui/header.mjs`, `ui/app.mjs`,
  `cockpit-ui.test.mjs`, `apps/soul/README.md`, and
  `discussion/ai-cohost/operations/pre-stream-checklist.md`.

The invariant audit is:

- `model-identity.mjs` is the one frozen Cody/Chappy authority. Claude maps to
  Cody; all three GPT brains map to Chappy; unknown/absent values retain the
  Cody fallback. No editable alias, settings migration, or second brain/name
  table was added.
- The existing selection lifecycle remains `dispose()` → `session = null`;
  identity changes apply to the session created by the next Fire only. No old
  or in-flight response is relabeled.
- Whisper reads its prompt at request time; scheduler voice/comment variants
  are read at handling time. Switching families does not recreate the ear or
  scheduler, and inactive-family call names remain negative.
- The current public projection is exactly
  `state.brain.identity = { id, displayName }`, resolver-derived. Missing or
  malformed UI identity uses neutral `Soul Cockpit`, never a stale claim.
- Transcript entries, transcript SSE payloads, usage entries, memory Markdown,
  persisted history, settings schema, viewer `displayName`, technical brain
  IDs/labels, credential paths, persona, and TTS speaker/voice remain unchanged;
  no historical text or in-flight attribution was added.
- The fake-only TTS regression kept one player/configuration (same base URL and
  speaker; creation count 1) across brain swaps. `src/voice/**` is unchanged.

## Consumption boundary

Mechanical work made **0** real Claude calls, **0** real GPT/Terra/Sol calls,
**0** external network calls, and **0** credential-content reads. It also made
**0** real microphone sessions/utterances and **0** real TTS playback checks.
The test HTTP traffic was injected/loopback fixture traffic only. No real
provider was called in the mechanical phase.

## Artifacts index

| Artifact | Link |
|---|---|
| Accepted plan | [model-identity-wave-plan.md](../../orchestration/model-identity-wave-plan.md) |
| Domain A/B/C/D reports | [A](domain-a.md), [B](domain-b.md), [C](domain-c.md), [D](domain-d.md) |
| Domain A reviews | [spec](../../reviews/model-identity/domain-a-spec.md), [design](../../reviews/model-identity/domain-a-design.md), [test](../../reviews/model-identity/domain-a-test.md) |
| Domain B reviews | [spec](../../reviews/model-identity/domain-b-spec.md), [design](../../reviews/model-identity/domain-b-design.md), [test](../../reviews/model-identity/domain-b-test.md) |
| Domain C reviews | [spec](../../reviews/model-identity/domain-c-spec.md), [design](../../reviews/model-identity/domain-c-design.md), [test](../../reviews/model-identity/domain-c-test.md) |
| Domain D reviews | [spec](../../reviews/model-identity/domain-d-spec.md), [design](../../reviews/model-identity/domain-d-design.md), [test](../../reviews/model-identity/domain-d-test.md) |
| Final mechanical review | [final-mechanical.md](../../reviews/model-identity/final-mechanical.md) |
| Human-gate checklist/result | [human-gate.md](human-gate.md) |
| Operational disclosure | [pre-stream-checklist.md](../../operations/pre-stream-checklist.md) |

## Nonblocking residual follow-ups

These are explicitly retained and do not change the mechanical PASS:

1. **Environment owner:** restore a worker-capable environment for normal
   `node --test`; `spawn EPERM` remains pre-assertion, so 413/413 worker-free
   evidence must not be represented as a worker-runner pass.
2. **Domain B/C integration hardening:** provider getter exceptions intentionally
   propagate; an alternative error policy, tighter Whisper option filtering, or
   malformed-array fallback behavior requires a reviewed follow-up.
3. **Domain C test hardening:** the swap test uses a local fake
   `ensureFireResources` harness; the SSE assertion checks the technical brain
   marker but not `brain.identity`; the TTS test does not traverse production
   `createFireOrchestrator` `speakDeps`.
4. **Domain C known out-of-scope behavior:** in-flight transcript technical
   `brain` labels retain the pre-existing broadcast-time approximation.
5. **Domain D UI hardening:** tests do not mount `App` to execute the hook-driven
   browser title effect, and the repository test does not instantiate Header
   for both malformed cross-pairs (the shared validator and direct probes pass).
6. **Maintainer/documentation:** accepted historical reports/comments may still
   mention Cody; no broad rewrite is authorized by this wave.
7. **Human/operator work:** visible browser title/header, practical ASR name
   recognition and inactive-family negatives, real next-Fire self-name in both
   directions, TTS/persona invariance, and selection-dependent disclosure must
   be run and evidenced by a conscious operator. Recurring ASR aliases, if any,
   are proposals only and must not be added during the gate.

## Next authority and closure rule

The next authority is the **user/operator**, who must execute and fill the
[human-gate checklist](human-gate.md), including deliberate real provider,
microphone, and visible Cockpit checks, and record consumption separately.
Until that record is completed and adjudicated, the wave remains **human gate
PENDING** and must not be described as fully/user closed.
