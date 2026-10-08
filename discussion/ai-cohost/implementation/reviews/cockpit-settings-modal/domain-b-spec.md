# Domain B spec review — Cockpit Settings modal

## Verdict

**PASS** — targeted loop 3; blocking findings **0**, nonblocking findings **2**.

The targeted loops corrected the category IDs/labels, separated the four
panels, hid each `aria-controls` target when inactive, and added deterministic
keyboard/dirty-close helper coverage. The operating bar remains outside the
dialog and the prompt editor remains a bounded slot. No blocking spec finding
remains in Domain B.

## Basis and independent evidence

Basis inspected:

- `discussion/ai-cohost/implementation/orchestration/cockpit-settings-modal-wave-plan.md`
  (accepted decisions §§2–3, AC-01/05/06, Domain B ownership and verification
  matrix)
- `discussion/_conventions.md`
- `discussion/ai-cohost/implementation/waves/model-identity/final-closeout.md`
  (prior identity-wave ownership)
- `discussion/ai-cohost/implementation/waves/cockpit-settings-modal/domain-b.md`
- Domain B target files and the current dirty-worktree diff.

Raw checks run independently:

| Command | Result |
|---|---|
| `node --check` for `ui/settings-drawer.mjs`, `ui/app.mjs`, `ui/header.mjs` | Exit **0**, 3/3 modules parsed. |
| `node --test apps/soul/agent/src/cockpit/cockpit-ui.test.mjs apps/soul/agent/src/cockpit/cockpit-page.test.mjs apps/soul/agent/src/cockpit/cockpit-static-assets.test.mjs` | Exit **1**; 3 files, **0 pass / 3 fail**, all stopped before assertions with `ChildProcess.spawn -> spawn EPERM`. This is the managed worker-spawn limitation, not an assertion failure or green evidence. |
| Worker-free selected commands with `--experimental-test-isolation=none` (UI; page + static assets) | Exit **0**; **56/56 passed**, 0 failed/skipped/cancelled (42 + 14). |
| `git diff --check` on Domain B target paths | Exit **0** (only Git's existing LF→CRLF normalization warnings). |
| `node scripts/check-soul-zone-boundary.mjs` | Exit **0**; 1,391 source files scanned, no boundary violations. |

No live provider, network, microphone, TTS, chat, or credential-content read
was used. No `src/voice/**`, package, or lockfile path is changed in the
inspected diff.

## Blocking findings

### B-SPEC-01 — Accepted category taxonomy (resolved in targeted loop 2)

The targeted implementation now declares the accepted four IDs and labels at
`apps/soul/agent/src/cockpit/ui/settings-drawer.mjs:111–116`:
`connections`/接続, `input-output`/入出力,
`brain-conversation`/頭脳・会話, and `memory`/記憶. Brain and memory are
separate panels (`:715–735`) and the prompt slot is bounded to the
brain-conversation page (`:756–762`). The shell test now checks the four IDs at
`apps/soul/agent/src/cockpit/cockpit-ui.test.mjs:531–534`. This finding is
closed for loop 2; it must not regress in later integration.

### B-SPEC-02 — Tab-panel semantics (resolved in targeted loop 3)

The targeted implementation now applies
`hidden=${activeCategory !== "connections"}` to the controlled Connections
tabpanel itself (`settings-drawer.mjs:608–610`), and the other three panels are
independent and similarly hidden (`:663`, `:715`, `:734`). The source test
asserts exactly four `role="tabpanel"` nodes and the Connections hidden
condition (`cockpit-ui.test.mjs:538–542`). There is no nested tabpanel and each
tab's `aria-controls` resolves to one category page. AC-01/05 panel semantics
are satisfied.

## Nonblocking findings

### B-SPEC-03 — Browser-mount interaction execution is deferred (nonblocking)

AC-05 explicitly names tab navigation, focus entry/containment/return, Escape,
backdrop, close, and dirty-draft behavior. The final shell test covers the
pure deterministic contracts and wiring at
`cockpit-ui.test.mjs:531–564`: exact categories and four panels, source checks
for dialog/tab/hidden/Escape/backdrop/focus/close-ref behavior, plus executable
`settingsModalNextCategory`, `settingsModalCloseAction`,
`settingsModalFocusBoundary`, and `settingsModalFocusableNodes` assertions.
This repository's prior Cockpit policy keeps hook-driven DOM mounting out of
machine tests and assigns actual rendering/focus behavior to the human gate;
no browser DOM is mounted here. The 42 UI and 14 page/static worker-free
passes (56 total) are therefore sufficient mechanical evidence under that
accepted policy. Retain a human-gate observation for real focus return, Escape,
backdrop, and dirty close; this is nonblocking for Domain B spec.

### B-SPEC-04 — Completion evidence omits the normal-run EPERM record

The plan's verification rule requires recording a normal Node test command's
raw `spawn EPERM` result and keeping worker-free counts separate. The
completion report still says normal worker mode was “not needed” and records
only the 42 + 14 worker-free counts. The targeted independent run above
confirms the exact environment limitation (3 files, 0 assertions reached).
Update the completion evidence to include that raw result; this is an
evidence/documentation gap, not a source assertion failure.

## Scope and prior-wave attribution audit

The actual modal migration diff is confined to
`ui/settings-drawer.mjs`, `ui/styles.mjs`, modal mounting/trigger overlap in
`ui/app.mjs` and `ui/header.mjs`, and the modal shell/helper assertions in
`cockpit-ui.test.mjs`; `view-logic/settings.mjs`, page tests, and static-assets
tests have no current diff. Existing ControlBar rendering and handlers remain
outside the dialog in `app.mjs:262–275`, with no changes to its API or
operational controls.

Several changed lines in the shared files are **not Domain B work** and must
not be counted as B evidence: the prior model-identity Domain D wave owns the
identity resolver/display/title changes in `ui/header.mjs:25–53, 70–78`,
`ui/app.mjs:227–235, 247–250`, `cockpit-ui.test.mjs:381–455`, and the neutral
title in `cockpit.html`. Domain B overlap is limited to the gear's modal
attributes (`header.mjs:88–90`), modal import/mount (`app.mjs:261–269`), and
the settings shell/styles/tests identified above. No source fix was made by
this review.

## Loop history and disposition

- Loop 1: BLOCKING — wrong category taxonomy, tabpanel nesting/visibility, and
  no interaction coverage (3 blockers).
- Loop 2: category taxonomy and nested-panel structure fixed; Connections
  target still needed a hidden condition; helper/static coverage added.
- Loop 3 (current): Connections target hidden, four independent panels and
  exact labels verified; helper/static coverage accepted under repository UI
  policy. No Gnome source fix is required by this spec lane.
- Completion prose should still record the normal-run `spawn EPERM` result
  alongside worker-free counts (B-SPEC-04), and the human gate must exercise
  real focus/keyboard/dirty-close behavior (B-SPEC-03).
