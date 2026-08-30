# Cockpit Settings modal — Domain C test review

- Lane: independent Domain C test re-review (loop 3)
- Verdict: **PASS**
- Blocking findings: **0**
- Review scope: profile-editor controller/UI tests, dirty-navigation routing, PUT/DELETE races, privacy/read-only boundaries, fake-only verification, and regressions around the Domain B modal shell.

This re-review inspected the loop-3 identity-authority source/tests and
completion report, the accepted wave plan and conventions, all prior Domain
A/B review lanes, and the current dirty-worktree diff. No source, test, or
other review report was changed; this report is the only file written by this
review. Unrelated dirty paths were preserved.

## Loop-3 identity-authority closure

The selected conversation-instruction brain now consumes the canonical
runtime identity only when `brainId === activeBrainId`; the helper passes
through the supplied `{ id, displayName }` and returns `null` for every
non-active profile (`apps/soul/agent/src/cockpit/view-logic/conversation-instruction.mjs:26-47`).
The former `CONVERSATION_BRAIN_IDENTITY_PROJECTIONS` table and handwritten
brain→Cody/Chappy mapping are absent. The editor receives
`settings.brain.identity` plus the canonical active brain id from the drawer
(`apps/soul/agent/src/cockpit/ui/settings-drawer.mjs:857-858`) and renders
non-active identity as suppressed, not as a guessed name.

Fresh executable tests prove all four technical ids pass through their
synthetic canonical active identity and suppress that same identity when the
active id differs (`apps/soul/agent/src/cockpit/view-logic/conversation-instruction.test.mjs:32-49`).
The UI seam independently checks all four active/non-active cases and asserts
the old projection symbol is absent (`apps/soul/agent/src/cockpit/cockpit-ui.test.mjs:650-665`).
The source-level negative checks are limited to detecting the removed mapping;
the existing header Cody/Chappy tests concern server-provided header identity
validation and are not a second conversation-profile map.

## Loop-1 finding closure

### C-TEST-01 — Keyboard dirty-guard bypass: CLOSED

The key handler now delegates ArrowLeft/ArrowRight/Home/End to
`settingsModalKeyboardCategoryAction()` (`apps/soul/agent/src/cockpit/ui/settings-drawer.mjs:141-154,
407-420`). That seam calls the same `requestCategory()` guarded action used by
clicks (`:331-342`) with `category-keyboard`, and supplies a focus callback
that runs only after the guarded navigation action is accepted or explicitly
discarded. A dirty draft therefore keeps the current pane while the inline
Discard/Continue choice is pending; the old direct `setActiveCategory()` path
is gone.

The fresh keyboard seam test verifies all four key forms, no focus before the
guarded action, focus after continuation, and prompt/no-prompt behavior
(`apps/soul/agent/src/cockpit/cockpit-ui.test.mjs:568-620`).

### C-TEST-02 — Dirty back/category/brain/header/Escape/backdrop routing: CLOSED

The real handlers route through `runGuardedNavigation()` and the shared
`settingsModalEventRoute()` seam (`settings-drawer.mjs:162-180, 293-303`).
Source assertions verify editor back, editor-brain change, Escape, backdrop,
and `closeRequestRef` header-close wiring; executable fake-only routing checks
cover back, category click, category keyboard, brain, and close paths with
dirty prompt plus explicit continuation (`cockpit-ui.test.mjs:622-648`).
This is adequate under the repository's accepted no-DOM Cockpit test policy:
the common guard is executable and the actual handler call sites are checked,
while browser-mounted focus/keyboard behavior remains a human-gate item.

### C-TEST-03 — PUT/DELETE and cross-brain stale responses: CLOSED

The controller still uses one monotonic sequence per brain, and fresh tests
now cover both overlapping operation orders and cross-brain isolation:

- PUT then DELETE: stale PUT is rejected and only the reset baseline/revision
  becomes current (`conversation-instruction.test.mjs:135-160`).
- DELETE then PUT: stale DELETE is rejected and only the newest save baseline,
  override flag, revision, and clean state remain (`:162-187`).
- Reverse-order concurrent saves for Claude and Codex never cross-clobber
  either brain's draft, saved value, or revision (`:189-216`).

Existing stale-load, edit-during-save, and failed save/reset preservation tests
remain green. The required fetch/save/reset race coverage is now present in
the fake controller suite.

## Coverage and invariants

| Area | Fresh evidence | Assessment |
|---|---:|---|
| Four technical IDs, options, encoded paths | controller **11/11** includes exact four IDs and identity authority cases | PASS |
| Default / override / reset / trim-empty | controller tests; local empty save makes no API call | PASS |
| Per-brain draft isolation and selected identity projection | controller per-brain tests; `conversationBrainIdentity` covers Claude/Codex family and active/non-active cases | PASS |
| Load/save/reset stale response races | PUT→DELETE, DELETE→PUT, reverse cross-brain, stale GET | PASS |
| Edit during save and failed save/reset preservation | controller tests | PASS |
| Dirty close/back/category/brain/header/Escape/backdrop | executable guard/event seams plus actual-handler source routing assertions | PASS mechanically; browser mount remains human gate |
| Status, next-Fire, reset, revision, read-only identity/memory | editor vnode; visible status/live-region text and revision; memory count/time only, no body | PASS |
| One dialog and no nested dialog | shell/editor vnode/source checks; no `alertdialog` or nested `role="dialog"` | PASS |
| Existing immediate controls and external ControlBar | UI **46/46**, settings **17/17**, control/status/health regressions **34/34**; ControlBar remains outside modal | PASS |
| Page/static import and asset wiring | page **4/4**, static **10/10** | PASS |

All machine tests use pure fixtures, injected fake fetch, and existing local
loopback page/static seams only. No provider, external network, microphone,
TTS, chat, credential-content, or user settings-file read occurred. Observed
external/credential consumption: **0**.

## Raw verification evidence

### Worker-free assertions

```text
node --test --experimental-test-isolation=none --test-concurrency=1 \
  apps/soul/agent/src/cockpit/view-logic/conversation-instruction.test.mjs \
  apps/soul/agent/src/cockpit/cockpit-ui.test.mjs \
  apps/soul/agent/src/cockpit/cockpit-page.test.mjs \
  apps/soul/agent/src/cockpit/cockpit-static-assets.test.mjs \
  apps/soul/agent/src/cockpit/view-logic/settings.test.mjs
exit 0 — 88/88 passed, 0 failed/skipped/cancelled
```

Focused Domain C rerun:

```text
node --test --experimental-test-isolation=none --test-concurrency=1 \
  apps/soul/agent/src/cockpit/cockpit-ui.test.mjs \
  apps/soul/agent/src/cockpit/view-logic/conversation-instruction.test.mjs
exit 0 — 57/57 passed
```

Separate external-control regression rerun:

```text
control.test.mjs + status.test.mjs + health.test.mjs
exit 0 — 34/34 passed
```

### Normal worker runner (kept separate)

```text
node --test --test-concurrency=1 \
  apps/soul/agent/src/cockpit/view-logic/conversation-instruction.test.mjs \
  apps/soul/agent/src/cockpit/cockpit-ui.test.mjs \
  apps/soul/agent/src/cockpit/cockpit-page.test.mjs \
  apps/soul/agent/src/cockpit/cockpit-static-assets.test.mjs \
  apps/soul/agent/src/cockpit/view-logic/settings.test.mjs
exit 1 — 5 files, 0 pass, 0 assertions; every file failed before assertions
with ChildProcess.spawn -> spawn EPERM in the managed environment.
```

This is an environment limitation, not assertion-failure evidence and not a
worker-runner PASS.

### Syntax, guard, diff, and scope

- `node --check` on the eight Domain C/shared UI source and test modules: **8/8 exit 0**.
- `node scripts/check-soul-zone-boundary.mjs`: **exit 0**, 1,394 source files scanned, no violations.
- `git diff --check` on the Domain C/shared UI target paths: **exit 0**; only existing LF→CRLF normalization warnings.
- Domain C assigned paths remain limited to the settings shell/editor/view-logic/UI test surfaces. No Domain C path adds package or lockfile changes, `src/voice/**`, Runtime Player/Editor, contract, persona, provider, or credential-content reads. Concurrent pre-existing worktree changes outside this ownership were not attributed to Domain C.

## Residuals

1. Browser-mounted focus return, Escape/backdrop, dirty prompt rendering, and
   real save/reset→next-Fire behavior remain wave-level human-gate
   observations. The event seam is executable fake-only routing evidence and
   does not claim a browser DOM mount.
2. Normal Node worker mode remains unavailable because child-worker creation
   fails with pre-assertion `spawn EPERM`; the 88/88 and 57/57 worker-free
   results are kept separate.
3. Compatibility naming (`SettingsDrawer` and legacy drawer CSS aliases)
   remains from Domain B; it does not create a second rendered dialog.
4. Non-active technical profiles intentionally suppress identity until they
   become active; browser-mounted rendering of that copy and the active
   identity transition remain human-gate observations.

## Disposition

Domain C TEST lane is **PASS — loop 3**. The identity-authority blocker and
prior dirty/race blockers are closed, no new
blocking test issue was found, and the report is ready for the independent
Domain C spec/design lanes and the wave-level mechanical/human gates. Review-
Sylph did not fix source or tests.
