# Cockpit Settings modal — final mechanical review

## Verdict

**PASS — mechanical gate; human gate PENDING.**

The three domain completion reports are present, all nine independent domain
review lanes are PASS, and no blocking finding remains. The fresh verification
below is worker-free/fake-only where assertions run; normal worker attempts are
recorded separately as the managed-environment `spawn EPERM` limitation and
are not counted as green evidence. This report does not claim real Cockpit,
provider, microphone, TTS, chat, or credential verification.

## Completion and review gate

| Domain | Completion report | Completion status | Loop history | Spec | Design | Test |
|---|---|---|---:|---|---|---|
| A — prompt profile, persistence, API, session revision | [domain-a.md](../../waves/cockpit-settings-modal/domain-a.md) | COMPLETE | 2 | PASS (1) | PASS (1) | PASS (2) |
| B — accessible Cockpit Settings modal | [domain-b.md](../../waves/cockpit-settings-modal/domain-b.md) | PASS | targeted 3 | PASS (targeted 3) | PASS (targeted 2) | PASS (targeted 3) |
| C — conversation-instruction editor/integration | [domain-c.md](../../waves/cockpit-settings-modal/domain-c.md) | IMPLEMENTED; review pending was closed here | 3 | PASS (targeted 3) | PASS (targeted 3) | PASS (targeted 3) |

- Domain completion: **3/3**.
- Review lanes: **9/9 PASS**.
- Blocking findings: **0**.
- Loop history: A closed its test-lane lifecycle/privacy findings in loop 2;
  B closed taxonomy/panel/interaction findings through targeted loops 2–3; C
  closed the dirty-keyboard and duplicate-identity-authority findings through
  targeted loops 2–3. No final-gate repair loop was required.
- The inherited model-identity closeout remains mechanically PASS and human
  gate PENDING; its frozen identity authority is treated as the accepted
  baseline for this wave.

## Fresh raw verification

### Normal worker attempts (environment limitation, not green evidence)

```text
node --test --test-concurrency=1 \
  apps/soul/agent/src/mind/fire-orchestrator.test.mjs \
  apps/soul/agent/src/cockpit/cockpit-settings-store.test.mjs \
  apps/soul/agent/scripts/cockpit.test.mjs \
  apps/soul/agent/src/cockpit/cockpit-server.test.mjs
exit 1 — 4 files, 0 pass, 4 fail, 0 assertions; every file failed before
assertions with ChildProcess.spawn -> spawn EPERM.

node --test --test-concurrency=1 \
  apps/soul/agent/src/cockpit/view-logic/conversation-instruction.test.mjs \
  apps/soul/agent/src/cockpit/cockpit-ui.test.mjs \
  apps/soul/agent/src/cockpit/cockpit-page.test.mjs \
  apps/soul/agent/src/cockpit/cockpit-static-assets.test.mjs \
  apps/soul/agent/src/cockpit/view-logic/settings.test.mjs
exit 1 — 5 files, 0 pass, 5 fail, 0 assertions; every file failed before
assertions with ChildProcess.spawn -> spawn EPERM.
```

### Worker-free assertions

```text
node --test --experimental-test-isolation=none --test-concurrency=1 \
  apps/soul/agent/src/mind/fire-orchestrator.test.mjs \
  apps/soul/agent/src/cockpit/cockpit-settings-store.test.mjs \
  apps/soul/agent/scripts/cockpit.test.mjs \
  apps/soul/agent/src/cockpit/cockpit-server.test.mjs
exit 0 — 314/314 passed, 0 failed/skipped/cancelled.
```

This focused Domain A run includes the production-shaped session revision
seam, repeated-Fire reuse, save/reset during pending work, busy rejection,
next-Fire replacement, persistence failure, dedicated API validation, and the
successful-save privacy test.

```text
node --test --experimental-test-isolation=none --test-concurrency=1 \
  apps/soul/agent/src/cockpit/view-logic/conversation-instruction.test.mjs \
  apps/soul/agent/src/cockpit/cockpit-ui.test.mjs \
  apps/soul/agent/src/cockpit/cockpit-page.test.mjs \
  apps/soul/agent/src/cockpit/cockpit-static-assets.test.mjs \
  apps/soul/agent/src/cockpit/view-logic/settings.test.mjs \
  apps/soul/agent/src/cockpit/view-logic/control.test.mjs \
  apps/soul/agent/src/cockpit/view-logic/status.test.mjs \
  apps/soul/agent/src/cockpit/view-logic/health.test.mjs
exit 0 — 122/122 passed, 0 failed/skipped/cancelled.
```

The 122 assertions cover the Domain B/C modal shell, editor/controller,
settings view logic, page/static asset wiring, and control/status/health
regressions.

```text
node --test --experimental-test-isolation=none --test-concurrency=1 \
  apps/soul/agent/src/mind/brains.test.mjs \
  apps/soul/agent/src/mind/model-identity.test.mjs \
  apps/soul/agent/src/mind/memory.test.mjs \
  apps/soul/agent/src/mind/fire-scheduler.test.mjs
exit 0 — 108/108 passed, 0 failed/skipped/cancelled.
```

These are separate relevant regressions; their counts are not added to the
focused Domain A total.

### Syntax, guard, and diff checks

- `node --check` on the current A/B/C source and test surface plus inherited
  identity/ear/scheduler regression modules: **32/32 exit 0**.
- `node scripts/check-soul-zone-boundary.mjs`: **exit 0**; 1,394 source files
  scanned; no 魂→器 imports or 器→魂 code imports.
- `git diff --check` on the current tracked worktree and the scoped Cockpit/
  Fire paths: **exit 0**. Git emitted only existing LF→CRLF normalization
  warnings; no whitespace error was reported.

## Acceptance-criteria matrix

| AC | Mechanical result | Evidence and boundary |
|---|---|---|
| AC-01 modal migration without operational regression | PASS | One labelled `role="dialog" aria-modal="true"` shell, four independent category panels, and unchanged modal-external ControlBar are covered by the 122 UI/page/static/control assertions and source inspection. First-run predicate remains the existing `shouldAutoOpenSettings` seam. |
| AC-02 per-brain editable body | PASS | Domain A resolves exactly `claude`, `codex`, `codex-55`, `codex-56-sol`; Domain C keeps isolated per-brain drafts and dedicated GET/PUT/DELETE calls. Only the body textarea is editable. Identity/memory are readonly; non-active identity is explicitly suppressed rather than inferred. |
| AC-03 persistence and privacy | PASS | Additive `conversationInstructions` persistence is version-tolerant and strict-write gated. The dedicated API is exactly `GET/PUT/DELETE /api/conversation-instructions/:brainId`; success returns `{ ok, brainId, instruction, isOverride, revision }`, while malformed/unknown/empty requests and unavailable/failing hooks use fixed errors. The 314/314 privacy test observes the saved secret only in dedicated API responses, not `/api/state`, SSE state/transcript/usage/diagnostic, transcript/history, memory status/record, identity, stdout, or stderr. |
| AC-04 next-Fire behavior | PASS | The fresh Domain A run proves unchanged-revision session reuse, durable-save-only revision advancement, stale-session disposal before the following accepted Fire, in-flight answer preservation, and unchanged brain/memory/TTS fake seams. Real provider/session observation remains human-gate work. |
| AC-05 accessibility and interaction | PASS mechanically | The shell/editor has one dialog, labelled tabs/panels, hidden inactive panels, focus entry/containment/return helpers, Escape/backdrop/close routing, inline dirty discard/continue, keyboard Arrow/Home/End guarded navigation, visible status/live-region text, and no global Save/Cancel semantics for immediate controls. Actual browser-mounted focus and visual behavior remains human-gate work. |
| AC-06 boundaries and consumption | PASS | No dependency, lockfile, Runtime Player, Editor, contract, `src/voice/**`, persona, or provider implementation path is changed by this wave. Focused tests use fakes/injected fetch, temporary settings paths, and loopback fixtures only; observed provider/network/microphone/TTS/chat/credential-content/user-settings consumption is **0**. |

## Exact API, lifecycle, and UI boundary audit

- Domain A owns the sole prompt-profile resolver and the additive file-backed
  override key. The effective prompt order is generated identity line →
  selected effective conversation body → optional existing memory section.
- Saving/resetting persists first, then increments the in-process revision.
  Existing sessions are not disposed by the API operation; the next Fire
  compares the captured revision, disposes a stale session, and creates the
  replacement. An in-flight answer therefore retains its original prompt.
  Existing brain selection and memory toggles retain their `dispose → null →
  next Fire` lifecycle.
- The editor is a pane swap in the same dialog. It has no nested dialog and
  no second prompt resolver. Its technical label comes from the existing
  brain-label registry; active identity is passed through from the existing
  server/registry fact only for the active technical brain, and non-active
  profiles display the explicit suppression message. Memory exposes enabled/
  count/time structure only; memory body, transcript, and history are not
  rendered or edited.
- Fire, Fire+視覚, self-fire, barge-in, verbosity, and KILL/revive remain in
  the modal-external `ControlBar`; their existing handlers/endpoints and
  status behavior are outside the editor integration.

## Scope and forbidden-path audit

The pre-report status snapshot contained 96 dirty paths, including unrelated
research/docs and the inherited model-identity wave. The scoped settings-wave
candidate set is limited to the A/B/C Cockpit/Fire files and the three domain
completion plus nine review reports listed in the wave plan. The inherited
identity set is kept separately (ears, brain registry, scheduler, identity
reports, and its closeout); it is not counted as new settings-modal scope.

Fresh path checks reported:

```text
package.json / pnpm-lock.yaml / apps/soul/agent/package.json /
apps/soul/agent/package-lock.json       0 paths
apps/soul/agent/src/voice/**             0 paths
apps/runtime-player/** / apps/editor/**  0 paths
packages/shared/** / contracts/**        0 paths
```

Four broad dirty-worktree filename matches for `contract` or
`runtime-player` were unrelated untracked research/report artifacts under
`discussion/reports/**`; none is a settings-wave implementation path. No
persona, matcher, ASR, TTS, provider/session-adapter, or credential file was
added to the settings-wave scope. No files were staged, committed, reset,
restored, deleted, or modified by this review other than this report.

## Nonblocking residuals and owners

1. **Human/operator — PENDING:** mount the real Cockpit and verify gear open,
   tabs, close, Escape/backdrop, focus entry/containment/return, and inline
   dirty discard/continue behavior.
2. **Human/operator — PENDING:** with one Claude and one GPT-family brain,
   save distinct bodies, complete any current answer, verify only the next
   Fire uses the selected saved body, then reset and verify per-brain
   isolation plus unchanged identity/memory/history.
3. **Environment owner — nonblocking:** restore a worker-capable Node test
   environment. Normal worker attempts remain pre-assertion `spawn EPERM`; the
   worker-free counts above must not be represented as worker-runner passes.
4. **Maintainer/documentation — nonblocking:** `SettingsDrawer` compatibility
   export and legacy `.settings-drawer` CSS aliases remain from the accepted
   Domain B migration. They do not render a drawer in the current shell and
   are not a mechanical blocker.
5. **Human/product owner — nonblocking:** non-active editor profiles
   intentionally suppress identity. Confirm the Japanese copy is acceptable
   during the human gate; displaying non-active identities would require a
   separate canonical registry/API decision.

## Human gate status

**PENDING.** No human-gate checklist/result was executed or edited by this
mechanical reviewer. Mechanical PASS means the wave is ready for the separate
operator gate; it is not full user closure.
