# Cockpit Settings modal — human gate checklist

> Human state: **PENDING**. This is an operator-run checklist; no real browser,
> Cockpit, provider, Fire, or in-flight session observation has been performed
> while preparing this document. Do not treat the mechanical gate as a human
> result.

## Basis and boundary

- Accepted wave plan: [cockpit-settings-modal-wave-plan.md](../../orchestration/cockpit-settings-modal-wave-plan.md)
- Final mechanical evidence: [final-mechanical.md](../../reviews/cockpit-settings-modal/final-mechanical.md)
- Current settings inventory: [01-current-settings-inventory.md](../../../../reports/cockpit-settings-modal-inventory/01-current-settings-inventory.md)
- Mechanical prerequisite reported by `final-mechanical.md`: **PASS**; human gate: **PENDING**.
- Run this only against the user's normal local Cockpit setup and a safe/test
  session. Do not paste credentials or instruction text into this report.

## Operator record

Fill these fields only after a real operator run:

| Field | Observed result |
|---|---|
| Operator / date | |
| Cockpit URL and build/worktree reference | |
| Browser and OS | |
| Test brains (must include one Claude and one GPT-family brain) | |
| Human-gate decision (`PASS` / `FAIL`) | |
| Failure/reproduction notes or evidence link | |

## 1. Launch and one-modal shell

1. Start Cockpit through the normal local command (`npm run cockpit --prefix apps/soul/agent`) and open the served local URL.
2. Use the header gear. Confirm that exactly one labelled `Cockpit Settings`
   dialog opens (`role="dialog"`, `aria-modal="true"`), with no drawer still
   rendered and no nested confirmation dialog.
3. Confirm that the four category tabs are present and usable: **接続**,
   **入出力**,
   **頭脳・会話**, and **記憶**. Switch each tab and back; confirm the current
   control values and any unmodified local input are not lost.
4. If the first-run state is being checked, confirm that an empty settings
   state auto-opens the modal and that a remembered settings state lands on the
   observation surface instead.

| Check | Expected result | Observed result / notes |
|---|---|---|
| 1.1 Launch | Local Cockpit loads without a blank/error screen. | |
| 1.2 Single dialog | One labelled modal; no drawer/nested dialog. | |
| 1.3 Four tabs | All four named categories switch within the same dialog. | |
| 1.4 State retention | Clean tab/close/reopen does not lose existing control values or unmodified input. | |
| 1.5 First-run routing | Empty state opens settings; remembered state opens observation. | |

## 2. Focus, keyboard, backdrop, and dirty-draft guards

Run each close/navigation path from a clean modal, then repeat with a dirty
conversation-instruction draft.

1. On open, confirm focus enters the dialog. Tab and Shift+Tab must remain
   contained in visible dialog controls; closing returns focus to the header gear.
2. Use the tab keyboard controls (Arrow keys and Home/End) and confirm they
   switch categories without escaping the dialog.
3. From a clean dialog, press Escape and click the backdrop. Each closes the
   modal and returns focus to the trigger.
4. Open **頭脳・会話** → the conversation-instruction editor, change the body,
   and leave it unsaved. Press Escape and click the backdrop. Confirm that an
   inline discard/continue choice appears in the same dialog; no nested
   confirmation opens and the dirty draft is not silently lost.
5. Choose **Continue** and confirm the draft remains. Then repeat the dirty
   close path and choose **Discard**; confirm the close/navigation completes and
   the discarded text is gone. Also exercise the editor back affordance,
   category change, header gear, and selected-brain change while dirty; each
   must use the same guard.

| Check | Expected result | Observed result / notes |
|---|---|---|
| 2.1 Focus entry/containment | Focus enters on open; Tab/Shift+Tab stay within visible modal controls. | |
| 2.2 Focus return | Close returns focus to the header gear. | |
| 2.3 Keyboard tabs | Arrow/Home/End navigation changes category and remains guarded. | |
| 2.4 Clean Escape | Escape closes a clean modal. | |
| 2.5 Clean backdrop | Backdrop closes a clean modal. | |
| 2.6 Dirty Escape/backdrop | Dirty state shows inline discard/continue; no nested dialog or silent loss. | |
| 2.7 Dirty Continue | Draft remains after Continue and navigation is not accepted. | |
| 2.8 Dirty Discard | Draft is discarded only after explicit Discard. | |
| 2.9 Other dirty routes | Back/category/gear/brain-change use the same guard. | |

## 3. Existing settings remain immediate

In each applicable category, exercise the existing controls one at a time.
After each action, verify that its existing request, validation, persistence,
status/error feedback, and immediate effect still occur. There is no global
Save/Cancel step for these controls.

- **接続:** set the Channel, confirm the input is cleared and the displayed
  endpoint is redacted; confirm connected/error status and existing disconnect
  behavior.
- **入出力:** refresh/select the microphone and use Start/Stop; refresh/select
  the voice output device; refresh/select the vision/game window. Confirm each
  action applies immediately and retains its existing status/error behavior.
- **頭脳・会話:** select a technical brain and confirm the existing brain
  selection lifecycle remains immediate. The instruction editor is the only
  control in this category with an explicit draft/save/reset flow.
- **記憶:** exercise the existing memory toggle and memory-record controls (if
  available in the current setup) and confirm their current immediate behavior.
- Change tabs and reopen the clean modal after these actions; confirm persisted
  values are restored and no unrelated control was reset.

| Check | Expected result | Observed result / notes |
|---|---|---|
| 3.1 Connection | Channel validation/save/status/disconnect remain immediate; token is not left in the input. | |
| 3.2 Microphone | Refresh and Start/Stop retain current status and errors immediately. | |
| 3.3 Voice output | Refresh/select applies to the existing output path immediately. | |
| 3.4 Vision target | Refresh/select applies to the existing target path immediately. | |
| 3.5 Brain selection | Existing selection/dispose/next-Fire behavior is unchanged. | |
| 3.6 Memory | Existing toggle/record behavior is immediate and unchanged. | |
| 3.7 No transaction leak | These controls do not require a global Save/Cancel. | |

## 4. External operational controls

Close the modal and confirm the following remain on the modal-external
`ControlBar`, with their current names, availability, handlers, and semantics:

- Fire and Fire+視覚;
- self-fire toggle;
- barge-in behavior;
- verbosity control; and
- KILL/revive control (including its current disabled/reserved behavior, if
  that is what the running surface exposes).

Use a safe/test session to exercise the controls that are available. Confirm
that opening or closing Settings does not move them into the modal, rename
them, or introduce a global Save/Cancel dependency.

| Check | Expected result | Observed result / notes |
|---|---|---|
| 4.1 External placement | Fire, visual Fire, self-fire, barge-in, verbosity, and KILL/revive remain outside the modal. | |
| 4.2 Fire | Existing Fire busy/complete behavior remains usable. | |
| 4.3 Fire+視覚 | Existing visual-Fire behavior remains usable when a target is configured. | |
| 4.4 Self-fire | Existing toggle availability and on/off behavior remain unchanged. | |
| 4.5 Barge-in | Existing interruption behavior remains unchanged. | |
| 4.6 Verbosity | Existing control remains available with its current semantics. | |
| 4.7 KILL/revive | Current reserved/enabled behavior is preserved; no accidental new action. | |

## 5. Per-brain instruction save → next Fire and in-flight noninterruption

The mandatory human sample is one **Claude** brain and one **GPT-family** brain.
Use two harmless, visibly distinct marker instructions (for example,
`CLAUDE_GATE_MARKER` and `GPT_GATE_MARKER`) rather than real secrets.

For each selected brain:

1. Open **頭脳・会話**, select the technical brain, and enter its editor. Record
   the displayed default/effective-body state without editing the read-only
   identity or memory structure.
2. Enter the brain-specific marker and choose **保存して次のFireから反映**.
   Confirm the saved/default status and `次のFireから反映` indication. Saving
   must not require or imply a global Save for the other settings.
3. Trigger the next normal Fire and record whether the answer reflects that
   selected brain's marker/body. Switch to the other test brain and repeat with
   the distinct marker. Confirm the first override did not bleed into the other
   brain.
4. While a Fire is thinking/speaking, save a new marker for the selected brain.
   Confirm the current answer completes under its original prompt: it is not
   stopped, relabelled, re-prompted, or rewritten. Trigger the following Fire
   and confirm it uses the newly saved body/session revision.

| Check | Expected result | Observed result / notes |
|---|---|---|
| 5.1 Claude save | Claude custom body saves and reports next-Fire application. | |
| 5.2 Claude next Fire | Next Claude Fire reflects only the Claude body. | |
| 5.3 GPT save | GPT-family custom body saves and reports next-Fire application. | |
| 5.4 GPT next Fire | Next GPT-family Fire reflects only the GPT body. | |
| 5.5 Isolation | Claude and GPT markers/bodies do not cross-apply. | |
| 5.6 In-flight save | Save during thinking/speaking does not interrupt or rewrite the current answer. | |
| 5.7 Following Fire | The Fire after the in-flight answer uses the newly saved body. | |

## 6. Reset/default and identity, memory, and history invariants

For the two mandatory test brains, and for the other valid technical IDs when
available (`claude`, `codex`, `codex-55`, `codex-56-sol`), perform the following
spot-check. Record the selected ID in the result column.

1. Save a custom body for the selected brain, switch away, and return. Confirm
   only that brain has the override; another brain's default/override is
   unchanged.
2. Choose **既定へ戻す**. Confirm the selected brain returns to the exact
   current default body and that another brain's override remains untouched.
3. Confirm identity is system-managed: the active selected brain may show the
   canonical existing identity, while a non-active profile shows the explicit
   non-active/suppressed state. The UI must not derive or edit identity from a
   technical label.
4. Confirm memory remains system-managed: only enabled/count/time structure
   status is shown; memory body is not exposed or editable, and instruction
   save/reset does not alter memory content.
5. Compare transcript/history before and after save/reset and the next Fire.
   Confirm existing entries are not rewritten, re-attributed, or polluted with
   instruction text; memory history remains unchanged.

| Check | Expected result | Brain ID / observed result / notes |
|---|---|---|
| 6.1 Isolated override | Selected brain only has its custom body. | |
| 6.2 Reset to default | Selected brain returns to the exact default; others stay unchanged. | |
| 6.3 Identity boundary | Existing active identity passes through; non-active identity is suppressed; no label-derived identity. | |
| 6.4 Memory boundary | Memory status structure is visible only as allowed; body is neither shown nor edited. | |
| 6.5 History boundary | Transcript/history/memory history are unchanged and contain no instruction text. | |

## Decision and follow-up

The operator fills every required row above and records `PASS` or `FAIL` in the
operator record. Until that happens, the authoritative human state remains
**PENDING**. A mechanical PASS does not close this gate. If any row fails,
record the exact steps and observed surface, then return the finding to the
wave owner; do not silently convert an unobserved row into PASS.
