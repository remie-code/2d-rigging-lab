# Cockpit Settings modal — final closeout

## Status

**Mechanically complete — mechanical gate PASS; human gate PENDING.**

The three domain completions are present, all nine independent review lanes
are PASS, and the final mechanical review reports zero blocking findings. No
human/operator run, live Cockpit session, live provider, microphone, TTS, chat,
network, or credential-content observation is represented here. The wave is
fully closed only after the separate human gate is completed and recorded as
PASS.

## Evidence index

| Artifact | Status |
|---|---|
| [wave plan](../../orchestration/cockpit-settings-modal-wave-plan.md) | Accepted scope, ACs, ownership, review and gate contract |
| [Domain A completion](domain-a.md) | COMPLETE — loop 2 closure |
| [Domain B completion](domain-b.md) | PASS — modal shell; Domain C editor slot consumed later |
| [Domain C completion](domain-c.md) | IMPLEMENTED — loop 3 identity-authority blocker closed |
| [Domain A spec review](../../reviews/cockpit-settings-modal/domain-a-spec.md) | PASS — loop 1 |
| [Domain A design review](../../reviews/cockpit-settings-modal/domain-a-design.md) | PASS — loop 1 |
| [Domain A test review](../../reviews/cockpit-settings-modal/domain-a-test.md) | PASS — loop 2 |
| [Domain B spec review](../../reviews/cockpit-settings-modal/domain-b-spec.md) | PASS — targeted loop 3 |
| [Domain B design review](../../reviews/cockpit-settings-modal/domain-b-design.md) | PASS — targeted loop 2 |
| [Domain B test review](../../reviews/cockpit-settings-modal/domain-b-test.md) | PASS — loop 3 |
| [Domain C spec review](../../reviews/cockpit-settings-modal/domain-c-spec.md) | PASS — targeted loop 3 |
| [Domain C design review](../../reviews/cockpit-settings-modal/domain-c-design.md) | PASS — loop 3 |
| [Domain C test review](../../reviews/cockpit-settings-modal/domain-c-test.md) | PASS — loop 3 |
| [final mechanical review](../../reviews/cockpit-settings-modal/final-mechanical.md) | PASS — mechanical gate |
| [human gate](human-gate.md) | PENDING — operator checklist not executed |

Gate totals: **3/3 completion reports, 9/9 review lanes, 0 blocking
findings**. Loop history is **A: loop 2; B: spec loop 3 / test loop 3 /
design loop 2; C: loop 3**. B's targeted review history is intentionally
preserved as separate lane counts; no final-gate repair loop was required.

## Nine-lane verdicts

| Domain | Spec | Design | Test | Final loop disposition |
|---|---|---|---|---|
| A — prompt profile, persistence, API, session revision | PASS (1) | PASS (1) | PASS (2) | Blocking test/privacy findings closed |
| B — accessible Cockpit Settings modal | PASS (targeted 3) | PASS (targeted 2) | PASS (targeted 3) | Taxonomy, panel visibility, and interaction findings closed |
| C — conversation-instruction editor/integration | PASS (targeted 3) | PASS (3) | PASS (3) | Dirty-keyboard and duplicate-identity-authority findings closed |

## Changed-file inventory and attribution

The current worktree is intentionally dirty for several concurrent waves. The
inventory below is the Cockpit Settings wave attribution, not a claim that all
current dirty files belong to this wave.

### Domain A — prompt profile, persistence, API, and session revision

- `apps/soul/agent/src/mind/fire-orchestrator.mjs`
- `apps/soul/agent/src/mind/fire-orchestrator.test.mjs`
- `apps/soul/agent/src/cockpit/cockpit-settings-store.mjs`
- `apps/soul/agent/src/cockpit/cockpit-settings-store.test.mjs`
- `apps/soul/agent/src/cockpit/cockpit-server.mjs`
- `apps/soul/agent/src/cockpit/cockpit-server.test.mjs`
- `apps/soul/agent/scripts/cockpit.mjs`
- `apps/soul/agent/scripts/cockpit.test.mjs`
- `domain-a.md` (completion report)

### Domain B/C — shared modal and editor integration surfaces

- `apps/soul/agent/src/cockpit/ui/settings-drawer.mjs` — B modal shell and C
  editor/guard integration; compatibility export does not render a drawer.
- `apps/soul/agent/src/cockpit/ui/app.mjs` — B modal mount/trigger guard and C
  editor wiring; modal-external controls remain outside.
- `apps/soul/agent/src/cockpit/ui/styles.mjs` — B modal styling and C editor/
  status styling.
- `apps/soul/agent/src/cockpit/cockpit-ui.test.mjs` — B shell and C editor,
  identity, keyboard, guard, and read-only-boundary assertions.

### Domain B — modal trigger

- `apps/soul/agent/src/cockpit/ui/header.mjs` — modal trigger attributes and
  close-request routing; unrelated inherited identity edits are not B scope.
- `domain-b.md` (completion report)

### Domain C — editor/controller

- `apps/soul/agent/src/cockpit/ui/conversation-instruction-editor.mjs`
- `apps/soul/agent/src/cockpit/view-logic/conversation-instruction.mjs`
- `apps/soul/agent/src/cockpit/view-logic/conversation-instruction.test.mjs`
- `domain-c.md` (completion report)

The nine review reports, `final-mechanical.md`, `human-gate.md`, the wave plan,
and this closeout are durable evidence artifacts for the wave. The current
status also contains inherited model-identity files (`model-identity.*`, its
reports/closeout, and related ears/brain/scheduler changes), broad research and
operations documents, agent configuration, and other unrelated dirty paths.
Those paths were preserved and are excluded from the settings-wave attribution;
`apps/soul/agent/src/cockpit/cockpit.html` is likewise attributed to the
inherited identity/title work, not counted as a new settings-modal change.

No file was staged, committed, reset, restored, deleted, or reverted by the
wave evidence work.

## Exact API, privacy, session, and UI invariants

### API and profile authority

- The single profile authority accepts exactly `claude`, `codex`, `codex-55`,
  and `codex-56-sol`.
- The dedicated local API is exactly:
  `GET /api/conversation-instructions/:brainId`,
  `PUT /api/conversation-instructions/:brainId` with
  `{ "instruction": string }`, and
  `DELETE /api/conversation-instructions/:brainId`.
- Successful operations return exactly the effective-body shape
  `{ ok: true, brainId, instruction, isOverride, revision }`.
- Unknown IDs, malformed JSON, non-string values, and trim-empty strings are
  rejected with JSON 400 responses. Unavailable hooks return 503; unsupported
  methods return 404. Durable save/reset failures return fixed JSON 500
  responses without instruction text.
- Persistence is additive and version-tolerant through the
  `conversationInstructions` key. Reset removes only the selected brain's
  override; a missing, corrupt, empty, or unknown entry falls back to the
  existing default body.

### Privacy and lifecycle

- Prompt composition is generated identity line → effective editable
  conversation body → optional existing memory section, and occurs only when a
  new Cockpit Fire session is created.
- Instruction text is returned only by the dedicated API and the newly-created
  session prompt. It is absent from `/api/state`, state/transcript/usage/
  diagnostic SSE, transcript/history, memory status/record, identity
  projections, ordinary errors/logs, and captured stdout/stderr.
- A durable save/reset advances the in-process instruction revision only after
  the write succeeds. The existing session remains in place; the next Fire
  detects a stale revision, disposes that session, and creates the replacement.
  Repeated Fire with no boundary reuses the session. An in-flight answer is
  not interrupted, relabelled, re-prompted, or rewritten.
- Existing brain and memory boundaries retain their `dispose → null → next
  Fire` lifecycle, and memory/history/transcript entries are not rewritten or
  re-attributed.

### UI and accessibility

- The editor is a content-pane swap inside exactly one labelled
  `role="dialog" aria-modal="true"`; there is no nested dialog or
  `alertdialog`. Categories are exactly **接続**, **入出力**, **頭脳・会話**,
  and **記憶**, with hidden inactive panels.
- Focus entry, visible-control containment, focus return, Escape, backdrop,
  header close, back, category click/keyboard, and brain-change routes share
  the dirty-draft guard. Discard/Continue is an inline status region, not a
  second dialog.
- Only the conversation-instruction body is editable. Save/reset are explicit
  per-brain actions; existing settings remain immediate and do not acquire a
  global Save/Cancel transaction.
- Identity is read-only and comes from the existing active server/registry
  fact only when the selected technical brain is active. A non-active profile
  explicitly displays `非アクティブ（identity は表示しません）`; no
  brain→Cody/Chappy map is duplicated in the editor. Memory exposes enabled/
  count/time structure only; memory body is not shown or editable.
- Fire, Fire+視覚, self-fire, barge-in, verbosity, and KILL/revive remain on
  the modal-external `ControlBar` with existing names, endpoints, handlers,
  and semantics.

## Fresh mechanical evidence

These are the fresh counts recorded by
[final-mechanical.md](../../reviews/cockpit-settings-modal/final-mechanical.md).
Worker-free/fake-only assertion results are kept separate from normal worker
runner failures.

```text
Domain A focused worker-free run:
node --test --experimental-test-isolation=none --test-concurrency=1 \
  apps/soul/agent/src/mind/fire-orchestrator.test.mjs \
  apps/soul/agent/src/cockpit/cockpit-settings-store.test.mjs \
  apps/soul/agent/scripts/cockpit.test.mjs \
  apps/soul/agent/src/cockpit/cockpit-server.test.mjs
exit 0 — 314/314 passed, 0 failed/skipped/cancelled

Domain B/C focused worker-free run:
node --test --experimental-test-isolation=none --test-concurrency=1 \
  apps/soul/agent/src/cockpit/view-logic/conversation-instruction.test.mjs \
  apps/soul/agent/src/cockpit/cockpit-ui.test.mjs \
  apps/soul/agent/src/cockpit/cockpit-page.test.mjs \
  apps/soul/agent/src/cockpit/cockpit-static-assets.test.mjs \
  apps/soul/agent/src/cockpit/view-logic/settings.test.mjs \
  apps/soul/agent/src/cockpit/view-logic/control.test.mjs \
  apps/soul/agent/src/cockpit/view-logic/status.test.mjs \
  apps/soul/agent/src/cockpit/view-logic/health.test.mjs
exit 0 — 122/122 passed, 0 failed/skipped/cancelled

Relevant regressions (kept separate from the focused totals):
node --test --experimental-test-isolation=none --test-concurrency=1 \
  apps/soul/agent/src/mind/brains.test.mjs \
  apps/soul/agent/src/mind/model-identity.test.mjs \
  apps/soul/agent/src/mind/memory.test.mjs \
  apps/soul/agent/src/mind/fire-scheduler.test.mjs
exit 0 — 108/108 passed, 0 failed/skipped/cancelled

Syntax:
node --check on the current A/B/C source and test surface plus inherited
identity/ear/scheduler regression modules
exit 0 — 32/32 modules parsed

Boundary guard:
node scripts/check-soul-zone-boundary.mjs
exit 0 — 1,394 source files scanned; no boundary violations

Diff check:
git diff --check on the current tracked worktree and scoped Cockpit/Fire paths
exit 0 — only existing LF→CRLF normalization warnings; no whitespace error
```

Normal worker attempts are an environment limitation and are not green
evidence:

```text
Normal Domain A command: exit 1 — 4 files, 0 pass, 0 assertions;
ChildProcess.spawn -> spawn EPERM before assertions.
Normal Domain B/C command: exit 1 — 5 files, 0 pass, 0 assertions;
ChildProcess.spawn -> spawn EPERM before assertions.
```

## Diff, forbidden paths, and consumption boundary

The final mechanical status snapshot found a substantially dirty worktree
(96 paths), including unrelated research/docs and the inherited
model-identity wave. The scoped settings-wave candidate set is limited to the
A/B/C Cockpit/Fire source and tests, the three completion reports, nine lane
reports, final mechanical review, human gate, plan, and this closeout. The
following forbidden-path checks reported zero settings-wave paths:

```text
package.json / pnpm-lock.yaml /
apps/soul/agent/package.json / apps/soul/agent/package-lock.json  0 paths
apps/soul/agent/src/voice/**                                  0 paths
apps/runtime-player/** / apps/editor/**                        0 paths
packages/shared/** / contracts/**                              0 paths
```

No persona, matcher, ASR, TTS, provider/session-adapter, credential, Runtime
Player, Editor, contract, dependency, or lockfile implementation path was
added to the settings-wave scope. Broad dirty filename matches for
`contract`/`runtime-player` were unrelated untracked research/report artifacts
under `discussion/reports/**`.

All machine evidence used fake sessions/hooks, injected fake fetch,
loopback-only page/static seams, in-memory fixtures, and OS temporary settings
paths. Observed consumption was **0** provider, external-network,
microphone, TTS, chat, credential-content, and real user-settings-file reads.

## Residuals and owners

These are nonblocking and remain explicitly open:

1. **Human/operator — PENDING:** run the real local Cockpit checklist for
   one-modal rendering, four tabs, focus entry/containment/return, keyboard
   tabs, Escape/backdrop, and inline dirty Discard/Continue behavior.
2. **Human/operator — PENDING:** with one Claude and one GPT-family brain,
   save distinct harmless marker bodies, verify save→next Fire, per-brain
   isolation, reset/default, in-flight non-interruption, following-Fire
   revision, identity/memory read-only boundaries, and unchanged history.
3. **Environment owner — nonblocking:** restore a worker-capable Node test
   environment; normal worker attempts remain pre-assertion `spawn EPERM`.
4. **Maintainer/documentation — nonblocking:** remove or consciously retain
   the `SettingsDrawer` compatibility export and legacy `.settings-drawer`
   CSS aliases after the migration. They do not render a drawer and are not a
   mechanical blocker.
5. **Human/product owner — nonblocking:** confirm the Japanese non-active
   identity suppression copy. Showing non-active identities would require a
   separate canonical registry/API decision.

## What remains to fully close

The only wave-level gate still open is [human-gate.md](human-gate.md). An
operator must fill every checklist row using a safe local/test session and
record the operator/date, browser/OS, test brains, observations, and a
`PASS`/`FAIL` decision. Until that record is completed, the authoritative
closeout state remains **mechanical PASS / human PENDING**; this document does
not convert fake-only evidence or unobserved runtime behavior into a human
result.
