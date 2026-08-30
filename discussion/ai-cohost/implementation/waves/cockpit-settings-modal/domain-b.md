# Cockpit Settings modal — Domain B completion

Status: PASS (Domain B source/UI migration complete; Domain C editor integration remains a bounded slot).

## Scope

- `apps/soul/agent/src/cockpit/ui/settings-drawer.mjs`: migrated the mounted drawer surface to one `role="dialog" aria-modal="true"` Cockpit Settings modal with four internal category tabs (接続 / 入出力 / 頭脳・会話 / 記憶). Existing endpoint handlers, validation, defaults, persistence, immediate application, status/error views, and device-loading effects are unchanged.
- `apps/soul/agent/src/cockpit/ui/app.mjs`: mounts the modal while leaving the external ControlBar unchanged; first-run `shouldAutoOpenSettings` predicate remains unchanged.
- `apps/soul/agent/src/cockpit/ui/header.mjs`: gear trigger exposes `aria-expanded` and `aria-controls`.
- `apps/soul/agent/src/cockpit/ui/styles.mjs`: modal backdrop, panel, tabs, dirty-warning, focus-visible styling; legacy drawer selectors remain as compatibility aliases.

The conversation editor is intentionally a `data-prompt-editor-slot` placeholder. No profile API, persistence, resolver, session, identity vocabulary, provider, voice, or operational-control code was changed.

## Accessibility and interaction checks

- Single dialog shell: `id="cockpit-settings-dialog"`, labelled by `cockpit-settings-title`, `role="dialog"`, and `aria-modal="true"`; no nested dialog/alertdialog is emitted (dirty handling is an inline `role="status"`).
- Four `role="tab"` buttons expose `aria-selected`, `aria-controls`, and keyboard focus order; existing controls are grouped by connection, input/output, brain/conversation, and memory categories. Each tabpanel, including connections, carries the active-category `hidden` guard.
- Open effect records `document.activeElement`, focuses the first modal control, traps Tab/Shift+Tab within visible dialog controls, supports Arrow/Home/End tab navigation, and returns focus on close. Worker-free UI tests execute category, dirty-close, focus-entry/return, focus-boundary, and hidden-control helpers in addition to source guards.
- Escape and backdrop close route through the same `requestClose` guard. A dirty Domain C draft invokes inline Discard/Continue controls without opening another dialog.

## External-control invariants

Fire, Fire+vision, self-fire, barge-in, verbosity, and KILL/revive remain rendered by `ControlBar` outside the modal and are not moved, renamed, or re-bound. Existing `/api/channel`, `/api/chat/*`, `/api/devices`, `/api/windows`, `/api/audio-devices`, `/api/ears/*`, `/api/vision-target`, `/api/audio-device`, `/api/brain`, `/api/memory`, and `/api/memory-record` request paths and response handling remain intact.

## Verification (fake/worker-free)

Raw commands and counts:

```text
node --check apps/soul/agent/src/cockpit/ui/settings-drawer.mjs
node --check apps/soul/agent/src/cockpit/ui/app.mjs
node --check apps/soul/agent/src/cockpit/ui/header.mjs
=> exit 0 (3/3 modules)

node --test --experimental-test-isolation=none apps/soul/agent/src/cockpit/cockpit-ui.test.mjs
=> exit 0; 42 tests, 42 pass, 0 fail, 0 skipped, 0 cancelled

node --test --experimental-test-isolation=none apps/soul/agent/src/cockpit/cockpit-page.test.mjs apps/soul/agent/src/cockpit/cockpit-static-assets.test.mjs
=> exit 0; 14 tests, 14 pass, 0 fail, 0 skipped, 0 cancelled

node --test --experimental-test-isolation=none apps/soul/agent/src/cockpit/cockpit-ui.test.mjs apps/soul/agent/src/cockpit/cockpit-page.test.mjs apps/soul/agent/src/cockpit/cockpit-static-assets.test.mjs
=> exit 0; 56 tests, 56 pass, 0 fail, 0 skipped, 0 cancelled (combined rerun after accessibility hardening)
```

No live provider, network, microphone, TTS, chat, or credential-content reads were used (zero consumption). Normal worker-spawn test mode was not needed for this lane; the worker-free counts above are kept separate from any repository-wide `spawn EPERM` limitation.

## Residual

Domain C owns the prompt editor implementation and may provide `promptEditorSlot`, `draftDirty` (or `dirty`), `onDiscardDraft`, and `onContinueDraft` without changing this modal shell or reimplementing existing settings handlers. The header gear routes through `closeRequestRef` so dirty drafts cannot bypass the inline guard.
