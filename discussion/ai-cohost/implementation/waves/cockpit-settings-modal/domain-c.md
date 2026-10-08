# Domain C — model conversation-instruction editor and UI integration

Status: **IMPLEMENTED — loop-3 identity-authority blocker closed; worker-free mechanical evidence passed; independent re-review and human gate pending** (2026-08-20)

## Scope and changed files

Domain C consumes Domain A's dedicated conversation-instruction API and Domain
B's single Cockpit Settings dialog. It adds no second prompt resolver, server
runtime code, identity registry, memory implementation, or operational-control
path.

Changed/created files owned by this implementation:

- `apps/soul/agent/src/cockpit/ui/settings-drawer.mjs` — same-dialog editor page, four-brain selection, per-brain controller wiring, guarded back/category/brain/header/Escape/backdrop close paths, and existing immediate controls preserved.
- `apps/soul/agent/src/cockpit/ui/conversation-instruction-editor.mjs` — stateless editor view with technical label, canonical active identity fact (or explicit non-active suppression), read-only memory structure, editable body, explicit save/reset actions, and textual status/live-region cues.
- `apps/soul/agent/src/cockpit/view-logic/conversation-instruction.mjs` — pure API response validation, four-ID contract, status derivation, and injected-fetch per-brain draft controller with stale-response protection.
- `apps/soul/agent/src/cockpit/view-logic/conversation-instruction.test.mjs` — fake-only controller and canonical-identity seam coverage.
- `apps/soul/agent/src/cockpit/cockpit-ui.test.mjs` — editor vnode/accessibility/read-only boundary coverage.
- `apps/soul/agent/src/cockpit/ui/styles.mjs` — editor layout/status styles; status text remains present independently of color.

The shared Domain B files retain their pre-existing migration work. No files
were staged, committed, reset, restored, deleted, or reverted.

## Implemented contract

- The editor is a content-pane swap inside the existing one labelled
  `role="dialog" aria-modal="true"`; it has a back affordance and emits no
  nested dialog.
- Technical IDs are exactly `claude`, `codex`, `codex-55`, and
  `codex-56-sol`, with per-brain isolated drafts and GET/PUT/DELETE requests
  to `/api/conversation-instructions/:brainId`.
- PUT sends `{instruction: string}`. Trim-empty text is rejected locally with
  a visible error, matching the API's non-empty requirement. Save/reset
  failures preserve the current draft.
- GET/save/reset responses update only the matching brain. Monotonic request
  sequences reject stale responses. Edits made while GET/save/reset is in
  flight remain in the draft while the server baseline is updated.
- Save, default, loading, error, and next-Fire states are visible text in a
  live status region; reset is labelled `既定へ戻す`, and save is labelled
  `保存して次のFireから反映`.
- Identity uses the existing `settings.brain.identity` server/registry fact only
  when the selected technical brain is the active brain. A non-active profile
  explicitly displays `非アクティブ（identity は表示しません）`, so the UI
  cannot show the active runtime name beside another selected profile. The
  Domain C view-logic contains no brain→Cody/Chappy projection or duplicate
  identity registry. Memory displays only enabled/count/time structure status;
  no memory body is rendered. Neither is editable.
- Dirty editor state guards close, Escape, backdrop, header gear, back,
  category, and editor-brain changes through the existing inline
  discard/continue status region. Immediate settings retain their existing
  per-control behavior, and the external Fire/visual Fire/self-fire/
  barge-in/verbosity/KILL bar remains untouched.
- Arrow/Right/Left/Home/End tab navigation now routes through the same
  guarded category action as clicks; focus is performed only after clean
  acceptance or explicit discard. A shared fake-only event seam exercises
  back/category-click/category-keyboard/brain/header-close/Escape/backdrop
  routes without adding a DOM dependency.
- The editor identity seam is keyed by the selected technical brain and the
  existing active-brain fact, not by a display label. Matching active profiles
  receive the canonical identity object; non-active profiles do not receive an
  inferred name. Four-brain assertions prove this pass-through behavior and a
  source assertion proves that no second brain→identity map exists.

## Loop-3 identity-authority closure

- Removed the Domain C `CONVERSATION_BRAIN_IDENTITY_PROJECTIONS` projection and
  any equivalent handwritten brain→Cody/Chappy duplication.
- Kept the public identity API/state unchanged. The editor receives the
  existing active `settings.brain.identity` fact through the safe UI seam and
  suppresses identity for a non-active editor selection.
- Added exact four-brain tests for canonical active-fact pass-through,
  non-active suppression, and source-level absence of the former projection.

## Verification evidence (current worktree)

Syntax checks (all exit 0):

```text
node --check apps/soul/agent/src/cockpit/ui/settings-drawer.mjs
node --check apps/soul/agent/src/cockpit/ui/conversation-instruction-editor.mjs
node --check apps/soul/agent/src/cockpit/ui/styles.mjs
node --check apps/soul/agent/src/cockpit/ui/app.mjs
node --check apps/soul/agent/src/cockpit/view-logic/conversation-instruction.mjs
node --check apps/soul/agent/src/cockpit/view-logic/conversation-instruction.test.mjs
```

Worker-free fallback (`--experimental-test-isolation=none`):

```text
node --test --experimental-test-isolation=none \
  apps/soul/agent/src/cockpit/view-logic/conversation-instruction.test.mjs \
  apps/soul/agent/src/cockpit/cockpit-ui.test.mjs \
  apps/soul/agent/src/cockpit/cockpit-page.test.mjs \
  apps/soul/agent/src/cockpit/cockpit-static-assets.test.mjs \
  apps/soul/agent/src/cockpit/view-logic/settings.test.mjs
  exit 0 — 88/88 passed, 0 failed/skipped/cancelled
```

The final focused rerun after the editor-slot integration was also green:

```text
node --test --experimental-test-isolation=none \
  apps/soul/agent/src/cockpit/cockpit-ui.test.mjs \
  apps/soul/agent/src/cockpit/view-logic/conversation-instruction.test.mjs
  exit 0 — 57/57 passed (keyboard/event seam, four-brain canonical identity
  seam, and overlapping PUT/DELETE race coverage included)
```

Separate fake-only regression run:

```text
node --test --experimental-test-isolation=none --test-concurrency=1 \
  apps/soul/agent/src/cockpit/view-logic/control.test.mjs \
  apps/soul/agent/src/cockpit/view-logic/status.test.mjs \
  apps/soul/agent/src/cockpit/view-logic/health.test.mjs
exit 0 — 34/34 passed
```

Normal worker runner was recorded separately and failed before assertions:

```text
node --test --test-concurrency=1 \
  apps/soul/agent/src/cockpit/view-logic/conversation-instruction.test.mjs \
  apps/soul/agent/src/cockpit/cockpit-ui.test.mjs \
  apps/soul/agent/src/cockpit/cockpit-page.test.mjs \
  apps/soul/agent/src/cockpit/cockpit-static-assets.test.mjs \
  apps/soul/agent/src/cockpit/view-logic/settings.test.mjs
exit 1 — 5 files, 0 pass, 0 assertions; all failed at ChildProcess.spawn with EPERM
```

Additional guards:

```text
node scripts/check-soul-zone-boundary.mjs
exit 0 — 1,394 source files scanned; no boundary violations.

git diff --check -- [Domain C target files]
exit 0 — only Git's existing LF→CRLF normalization warnings.
```

All machine tests use pure fixtures, injected fake fetch, and existing local
loopback page/static test seams. No provider, external network, microphone,
TTS, chat, credential-content, or user settings-file read was performed;
observed external/credential consumption is **0**.

## Residuals

- Normal Node worker mode remains unavailable in this managed environment due
  to pre-assertion `spawn EPERM`; worker-free evidence is kept separate.
- Browser-mounted focus return, Escape/backdrop, dirty prompt, and real
  next-Fire behavior remain wave-level human-gate observations. The new event
  seam provides executable fake-only handler routing but does not claim a
  browser DOM mount. Non-active editor profiles intentionally show that their
  identity is unavailable until their profile is active; this is the
  authority/privacy-safe residual and should be checked in the human gate.
  Independent Domain C spec/design/test re-review remains to be run by
  Review-Sylph.
- Existing compatibility naming (`SettingsDrawer` and legacy drawer CSS
  aliases) remains in the shared Domain B migration and is not removed by this
  integration.
