# Domain B — Cockpit Settings modal design review

Verdict: **PASS (loop 2 targeted re-review; blocking findings 0)**

This is an independent design review of the current Domain B working-tree
diff. It covers the accepted Cockpit Settings modal contract in
`cockpit-settings-modal-wave-plan.md` (§3, AC-01, AC-05, AC-06), the Domain B
completion report, and the raw UI source/tests. No source was changed by this
review.

## Repository facts and verified invariants

- `apps/soul/agent/src/cockpit/ui/settings-drawer.mjs` now emits one labelled
  `role="dialog"` with `aria-modal="true"`, an inline dirty-status region, and
  a bounded `data-prompt-editor-slot`; no `alertdialog` or second dialog is
  present (lines 504–535, 685–692).
- The current category constants and panel IDs are the accepted four
  categories (`connections`, `input-output`, `brain-conversation`, `memory`)
  with Japanese labels (lines 111–116, 513–521, 592–685). The connections
  panel is closed before the next panel begins (lines 537–591), so the earlier
  nested-tabpanel shape is not present in this snapshot.
- Existing setting handlers remain on their existing endpoints in the modal;
  the `ControlBar` remains a sibling outside the modal in `ui/app.mjs`
  (lines 252–275). No profile resolver, persistence/API, session, provider,
  identity, voice, or operational-control implementation is introduced by the
  Domain B UI diff.
- The shell is mounted while closed, preserving existing local-control state;
  the prompt editor remains a placeholder for Domain C as required.

## Loop 1 findings and loop 2 resolution

### BF-01 — Header gear bypassed the dirty-close guard (resolved)

Loop 1 found `app.mjs:249-250` closing directly via `setSettingsOpen`. Loop 2
now routes an open-trigger click through `settingsCloseRequestRef.current`
(`app.mjs:251-268`; registration in `settings-drawer.mjs:190-198`). The ref
invokes the same `requestClose()` used by the close button, Escape, and
backdrop (`settings-drawer.mjs:181-188`), so a dirty Domain C draft reaches the
inline Discard/Continue choice.

### BF-02 — Tab focus containment counted hidden controls (resolved)

Loop 1 found that the trap included inactive-panel controls. Loop 2 filters
the candidate list with `!element.closest("[hidden]")` and excludes
`aria-hidden="true"` (`settings-drawer.mjs:241-250`), so hidden categories no
longer define the containment boundary.

### BF-03 — Roving tab index had no keyboard tab navigation (resolved)

Loop 1 found that only the active tab was tabbable with no way to move the
roving focus. Loop 2 adds ArrowLeft/ArrowRight wraparound and Home/End
selection/focus (`settings-drawer.mjs:224-239`), while preserving the four
accepted category IDs/labels (`settings-drawer.mjs:111-116`).

### BF-04 — Required interaction evidence was absent (downgraded residual)

Loop 1 found that the test only checked importability. Loop 2 extends the
static contract assertions to the exact four labels, one panel per category,
Escape/backdrop guards, previous-focus return, hidden filtering, Arrow key
handling, and the header close-request ref
(`cockpit-ui.test.mjs:521-537`). This is adequate for the shell design lane;
browser-mounted behavior remains an explicit human-gate check and a follow-up
for the Domain B test lane if a DOM harness is introduced.

## Verification evidence

Fresh worker-free runs in this environment:

| Command | Result |
|---|---:|
| `node --check` on `settings-drawer.mjs`, `app.mjs`, `header.mjs` | exit 0 (3/3) |
| `node --test --experimental-test-isolation=none cockpit-ui.test.mjs` | exit 0, 42/42 pass |
| same worker-free page + static-assets tests | exit 0, 14/14 pass |
| combined worker-free UI/page/static command | exit 0, 56/56 pass |
| `node --test` on the three UI/page/static files | exit 1 before assertions (`spawn EPERM`, 0/3 files run) |
| `git diff --check` | exit 0 (only existing LF→CRLF warnings) |
| `node scripts/check-soul-zone-boundary.mjs` | exit 0, 1,391 files scanned |

The normal-runner `spawn EPERM` is an environment limitation, not an
assertion result; the worker-free counts are kept separate. The focused tests
used fake/loopback fixtures and no real provider, network, microphone, TTS,
chat, or credential-content reads were observed.

## Nonblocking residuals

- `closeWarning` is not explicitly cleared when a dirty draft becomes clean
  without closing; a stale warning can remain visible until the next close
  attempt (`settings-drawer.mjs:170-186, 523-534`).
- The compatibility export/name `SettingsDrawer` and legacy `.settings-drawer`
  CSS selectors remain in the module. They do not create a drawer UI in this
  snapshot, but a later cleanup can remove the stale terminology after Domain C
  integration.
- The completion report says the normal worker-spawn command was “not needed”.
  The independent normal run is recorded above as pre-assertion `spawn EPERM`;
  this is an environment limitation, not a Domain B failure.
- The completion report's accessibility prose still says “brain/memory” and
  “advanced slot” although the loop-2 source now uses the accepted
  `頭脳・会話` and `記憶` tabs; this is documentation drift only.

Loop 2 therefore has zero blocking findings. Human browser interaction and
Domain C editor integration remain outside this lane's mechanical PASS.
