# Cockpit Settings modal — Domain B test レーンレビュー（loop 3）

Reviewer: independent Review-Sylph (test lane). Scope: Domain B modal shell,
UI/page/static tests, and `view-logic/settings` coverage. Basis:
`cockpit-settings-modal-wave-plan.md`, `discussion/_conventions.md`, and the
current `domain-b.md` completion report. No source was changed by this review.

## 判定

**PASS** — loop-3 targeted re-review; blocking findings **0**.

Loop-2 findings are closed: the exact four category IDs/labels are present,
the four panels are independent, the Connections panel itself is hidden when
inactive, and gear/Escape/backdrop dirty-close plus focus/tab helper contracts
are now exercised by executable pure helpers and source assertions. Browser DOM
mounting remains a human-gate observation under the repository's accepted
Cockpit policy (linkedom is deferred until repeated hook regressions).

## Loop history

- Loop 1: blocking taxonomy mismatch, tabpanel shape/visibility, and absent
  interaction evidence.
- Loop 2: taxonomy and panel separation fixed; Connections visibility and
  deterministic helper coverage remained to be hardened.
- Loop 3: `settings-drawer.mjs:608-610` hides the Connections `role="tabpanel"`
  itself; all four panels are independent/hidden by `activeCategory`; helper
  and static assertions pass. No blocking test finding remains.

## Coverage and invariants

| Area | Evidence | Result |
|---|---|---|
| Four categories / one dialog | `settings-drawer.mjs:111-116, 608-735`; `cockpit-ui.test.mjs:522-565` | Exact 接続 / 入出力 / 頭脳・会話 / 記憶 IDs and labels; four tabpanels; no alertdialog or nested role=dialog |
| Tab navigation | `settingsModalNextCategory` (`settings-drawer.mjs:119-128`) with ArrowLeft/Right/Home/End assertions | Pass |
| Dirty close | `settingsModalCloseAction` and `closeRequestRef` wiring (`settings-drawer.mjs:224-230`, `app.mjs:252-268`) | Clean closes; dirty routes to inline prompt; pass |
| Focus entry/return/containment | `settingsModalFocusEntryTarget`, `settingsModalFocusReturnTarget`, `settingsModalFocusableNodes`, `settingsModalFocusBoundary` (`settings-drawer.mjs:135-163, 243-294`) and helper assertions | Pass mechanically; real DOM remains human gate (nonblocking) |
| Escape/backdrop/close shell | `settings-drawer.mjs:251-256, 568-570`; static assertions in `cockpit-ui.test.mjs:529-538` | Pass by source contract; human-gate visual/keyboard confirmation remains |
| Existing immediate endpoints | unchanged handlers for `/api/channel`, `/api/chat/*`, `/api/devices`, `/api/windows`, `/api/audio-devices`, `/api/ears/*`, `/api/vision-target`, `/api/audio-device`, `/api/brain`, `/api/memory`, `/api/memory-record`; pure fixtures in `view-logic/settings.test.mjs` | No regression in Domain B diff; no live fetch required |
| Modal-external controls | `app.mjs:272-284` keeps `ControlBar` outside modal; UI vnode tests cover Fire/vision, self-fire, barge-in, verbosity, KILL/revive | Pass |
| First-run auto-open | `shouldAutoOpenSettings` positive/negative fixtures (`view-logic/settings.test.mjs:153-194`); `app.mjs:214-221` one-shot stateLoaded guard | Pass predicate/guard; DOM opening remains human gate |
| Prompt boundary / fake-only | `data-prompt-editor-slot`; no profile API, persistence, runtime, voice, provider, or credential changes | Pass |

## Nonblocking residuals

### B-TEST-03 — Browser-DOM execution is deferred by accepted policy

The shell tests intentionally do not mount Preact or dispatch real DOM events.
They execute the deterministic navigation, close, focus, and hidden-node
helpers and assert the wiring/source contract. Prior Cockpit policy
(`implementation/waves/cockpit-redesign/followup.md` §3 and its human gate)
assigns hook-driven rendering/focus behavior to the human gate and defers a
linkedom dev dependency until two repeated hook regressions. Keep real focus
return, Escape, backdrop, and dirty-close checks in the human checklist; this
is not blocking Domain B under that policy.

### B-TEST-04 — Completion prose should retain the normal-run EPERM record

The completion report records worker-free green counts but says the normal
worker mode was “not needed.” The raw normal command below reproducibly fails
before assertions with `spawn EPERM`; retain that result beside the worker-free
counts. This is evidence hygiene, not a product/test assertion failure.

## Raw verification

- `node --check` for `settings-drawer.mjs`, `app.mjs`, `header.mjs`: exit 0,
  3/3 modules.
- Worker-free combined UI/page/static command with
  `--experimental-test-isolation=none`: exit 0, **56/56 pass**, 0 failed,
  skipped, or cancelled.
- Worker-free `view-logic/settings.test.mjs`: exit 0, **17/17 pass**.
- Normal `node --test` over the three UI/page/static files: exit 1 before
  assertions, **3 files / 0 assertions**, each `ChildProcess.spawn -> spawn
  EPERM`. This is the managed runner limitation, not green evidence.
- `git diff --check` on Domain B paths: exit 0 (only LF→CRLF warnings).
- `node scripts/check-soul-zone-boundary.mjs`: exit 0, 1,391 source files
  scanned.

## Fake-only / scope audit

Focused tests use pure fixtures and a loopback HTTP server only. No live
provider, external network, microphone, TTS, chat, or credential-content read
was observed. Domain B changes are confined to the modal/app/header/styles and
UI shell test files; `src/voice/**`, package/lockfile, and `ControlBar`
implementation are unchanged.

## Disposition

Test lane **PASS**. Carry B-TEST-03 as the human-gate observation and B-TEST-04
as completion-report evidence cleanup; no Gnome source rework is required by
this lane.
