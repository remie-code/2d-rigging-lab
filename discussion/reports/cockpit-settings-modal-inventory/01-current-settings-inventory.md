# Current AI Cohost Cockpit settings inventory

> Scope: repository facts from the current working-tree source and tests, inspected 2026-08-09. This is an inventory for a possible drawer-to-modal replacement; it does not choose a future IA or assign controls to a new modal. No credentials, settings-local file, or user data were read. The worktree was already dirty; only this report was added by this task.

## Repository facts

### Current component and state map

- `apps/soul/agent/src/cockpit/ui/app.mjs:75-96` extracts the settings-related part of each `/api/state` snapshot. It keeps `channel`, `visionTarget`, `selfFire`, `verbosity`, `bargeIn`, `audioDevice`, `chat`, `killed`, `brain`, and `memory` in the UI settings object. `app.mjs:119-136` stores that object and applies snapshots from both initial GET and SSE/POST responses.
- `apps/soul/agent/src/cockpit/ui/app.mjs:242-274` always mounts `SettingsDrawer` and `ControlBar`; `settingsOpen` only controls drawer visibility. The control bar is not part of the drawer.
- `apps/soul/agent/src/cockpit/ui/settings-drawer.mjs:417-568` renders the four drawer sections and all current drawer controls. The handlers are in `:219-411`.
- `apps/soul/agent/src/cockpit/ui/control-bar.mjs:313-332` renders the always-visible run/safety bar. `header.mjs:81-100` renders the header and settings toggle.

### Every current `SettingsDrawer` control

The classifications below are repository descriptions, not a recommendation for the future modal.

| Visible control / label | Meaning and source | API / handler | State origin and persistence | When it takes effect | Classification |
|---|---|---|---|---|---|
| `器（Channel）` text input + `Set` | Loopback control-channel URL (token-bearing input). The rendered status is redacted via `channelStatusView`; successful Set clears the raw input (`settings-drawer.mjs:249-269`, `:417-441`). | `POST /api/channel`, `{url}`; `onChannelSet`. Server validates/forwards to `onSetChannelUrl` (`cockpit-server.mjs:1128-1142`). | Runtime `lazyChannel` plus file key `lastChannelUrl` (`scripts/cockpit.mjs:935-955`; `cockpit-settings-store.mjs:130-135`). Startup precedence is CLI `--channel` > stored key > null (`scripts/cockpit.mjs:690-696`). Snapshot is `channel:{configured,url(redacted),connection}` (`cockpit-server.mjs:588-590`). | Immediately changes the lazy channel URL and drops its connection cache; the next Fire connects. A session/player is not spawned solely by setting the URL (`scripts/cockpit.mjs:935-945`; top-level lazy policy `:20-38`). | User configuration (persistent, secret-adjacent token handling). |
| `YouTube` text input + `Connect` / `Disconnect` | Viewer live-chat source (URL/video ID/channel/live URL) and current chat state (`settings-drawer.mjs:271-306`, `:442-473`). `Connect` rejects blank input locally; `Disconnect` is state-driven disabled. | `POST /api/chat/connect`, `{source}` and `POST /api/chat/disconnect` (`settings-drawer.mjs:280-305`; server `:1144-1176`). | Stored file key `chatSource` is written on successful Connect through `onSetChatSource`; snapshot `chat.source` remains after disconnect, while `connected/state` are live client state (`scripts/cockpit.mjs:578-603`; `cockpit-server.mjs:607-613`). Input restoration is allowed only when not edited and currently empty (`status.mjs:63-72`; drawer `:188-203`). | Connect starts the chat client immediately; Disconnect stops/folds it immediately. Persisted source is for next startup/input restoration, not a live connection by itself. | User configuration plus immediate connection lifecycle control. |
| `マイク` select | Input device list. `GET /api/devices` options use device names; `lastDevice` is preferred when present, otherwise the first option (`settings-drawer.mjs:144-166`; `settings.mjs:61-74,111-122`). | Selection is consumed by `POST /api/ears/start`, `{device}` (`settings-drawer.mjs:219-237`; server `:886-900`). | File key `lastDevice` is written when Start begins (`cockpit-server.mjs:697-708`); `/api/devices` returns it (`:868-875`). Server test fallback has an in-memory store (`:244-268`). | Start uses the selected device immediately to create/start the ear pipeline; persisted choice affects later starts. | User configuration, but the Start operation is an immediate run control. |
| `Start` / `Stop` beside the mic | Starts or stops the ears/Whisper/ffmpeg pipeline; both buttons disable while transitioning (`settings-drawer.mjs:219-247,477-491`). | `POST /api/ears/start` and `POST /api/ears/stop` (`cockpit-server.mjs:886-914`). | Start also updates `lastDevice`; Stop does not clear it. Snapshot fields affected are `ears`, `device`, `health`, `uptimeMs`, transcript state, and SSE `state` (`cockpit-server.mjs:577-587`). | Immediate pipeline lifecycle change. | Immediate run control, not merely configuration. |
| `声の出力先` select + `Refresh devices` + `Set device` | Enumerates Windows output devices, lets the user choose one, refreshes the list, and applies it (`settings-drawer.mjs:168-178,329-348,492-509`). | `GET /api/audio-devices`; `POST /api/audio-device`, `{name}` (`cockpit-server.mjs:969-994`). | File key `audioDevice`; null means the default output device (`cockpit-settings-store.mjs:144-149`; `scripts/cockpit.mjs:313-327`). Snapshot `audioDevice:{name}` and header voice label come from the same provider. | Set persists and, if a player exists, disposes it; the next Fire recreates the player with the new device (`scripts/cockpit.mjs:778-805`). | User configuration with an immediate player-restart side effect; Refresh is an enumeration action. |
| `視界（ゲーム窓）` select + `Refresh windows` + `Set target` | Lists windows (label `title (processName)`), selects the target for visual Fire, refreshes enumeration, and applies the title (`settings-drawer.mjs:156-166,308-327,510-525`). | `GET /api/windows`; `POST /api/vision-target`, `{title}` (`cockpit-server.mjs:929-954`). | File key `visionTarget`; snapshot `visionTarget:{title}` (`scripts/cockpit.mjs:269-296`; store `:137-143`). Status is `not configured` when absent (`settings.mjs:47-54`). | The selected title is used when the next `Fire+視覚` (or preferred autonomous visual fire) resolves its target. | User configuration. |
| `頭脳` select + `Set` | Fixed four choices derived from `BRAIN_LABELS`: Claude (Opus 4.8), Codex (GPT-5.6 Terra), Codex (GPT-5.5), Codex (GPT-5.6 Sol) (`settings-drawer.mjs:72-79,527-545`; `health.mjs:89-109`). Status also shows credential-file existence wording only (`health.mjs:112-122`). | `POST /api/brain`, `{brain}`; `onBrainSet` (`settings-drawer.mjs:350-369`; server `:1096-1126`). | File key `brainChoice`; startup default Claude and registry validation are in `scripts/cockpit.mjs:535-575,640-664`; snapshot `brain:{brain,credentialHealth,identity}` (`cockpit-server.mjs:552-576,601-602`). Credential content is never read. | Persists immediately; current session is disposed and the next Fire creates a session for the selected brain (`scripts/cockpit.mjs:807-831`). | User configuration with an immediate hot-swap boundary. |
| `記憶` checkbox | Enables/disables inter-stream memory (`memoryToggleView` is controlled by snapshot state) (`settings-drawer.mjs:371-393,546-566`; `settings.mjs:173-203`). | `POST /api/memory`, `{enabled}` (`cockpit-server.mjs:1178-1194`). | File key `memoryEnabled`; default ON. Runtime `memoryText`, `memoryCount`, checkpoint timer, and `lastRecordAtMs` are in-memory in `scripts/cockpit.mjs:666-688,885-914`; snapshot `memory:{enabled,count,lastRecordAtMs}`. | ON reloads recent digests; OFF clears injected text and stops checkpoint work; either state change disposes the current session so the next Fire uses the new prompt (`scripts/cockpit.mjs:874-908`). | User configuration with an immediate session/persistence side effect. |
| `今日を記録` button | Explicitly records the current stream transcript as a digest; it is not a toggle or a stored preference (`settings-drawer.mjs:395-411,548-565`). | `POST /api/memory-record`, `{}` (`cockpit-server.mjs:1196-1210`). | Uses memory files and runtime transcript through `recordMemory`; no `cockpit-settings.local.json` key. Server deliberately returns 200 after record failures (failure tolerant). | Immediate best-effort record operation. | Immediate action, not configuration. |

Additional drawer-visible read-only status/error elements: Channel redacted connection status, YouTube chat status, microphone enumeration/start/stop error, voice output status, vision target status, brain label + credential-health label, memory count/latest-record label, and per-control error text (`settings-drawer.mjs:438-565`). They are derived from snapshot/list responses; they do not create separate settings keys.

Important current UI behavior: Channel URL is not hydrated back into the text input (only redacted snapshot status is shown, and a successful Set clears it); chat source is the only text input with explicit snapshot restoration (`settings-drawer.mjs:118,188-203,249-269`). The audio and vision selects are initialized from the first enumerated option, not from the persisted status; the status line still shows the persisted/current value (`settings-drawer.mjs:156-178,413-415,492-525`). Brain selection is synchronized from `snapshot.brain.brain` (`:205-215`).

### Configuration-like controls outside the drawer

| Surface/control | Meaning/API/state | Classification |
|---|---|---|
| Header `⚙` (`aria-label="settings"`) | Toggles `settingsOpen` through `Header.onToggleSettings` (`header.mjs:81-100`; `app.mjs:242-260`). | Navigation to settings, not a persisted setting. |
| `🎤 Fire` | Manual conversation trigger; `POST /api/fire`, empty JSON. Disabled while soul is thinking/speaking or a request is busy (`control-bar.mjs:71-83,186-207`; server `:916-927`). | Immediate run control. |
| `🖼 Fire+視覚` | Manual visual conversation trigger; `POST /api/vision-fire`, empty JSON. Shares Fire busy guard (`control-bar.mjs:77-82,316-321`; server `:956-967`). Consumes the configured vision target. | Immediate run control. |
| `自発` checkbox pill | Enables autonomous fire scheduler; controlled from `snapshot.selfFire`, `POST /api/self-fire`, `{enabled}` (`control-bar.mjs:85-104,209-233`). File key `selfFireEnabled`, default OFF (`scripts/cockpit.mjs:330-358,632-634`). | Persistent user preference exposed as an immediate operating control. |
| `かぶり` checkbox pill | Enables barge-in interruption; controlled from `snapshot.bargeIn`, `POST /api/barge-in`, `{enabled}` (`control-bar.mjs:106-127,235-259`). File key `bargeInEnabled`, default ON (`scripts/cockpit.mjs:362-392,634-635`). | Persistent safety/operating control; affects current speech immediately. |
| `口数` select (`控えめ/ふつう/おしゃべり`) | Changes scheduler verbosity; controlled from `snapshot.verbosity`, `POST /api/verbosity`, `{mode}` (`control-bar.mjs:129-150,261-284`). File key `verbosityMode`, default `normal` (`scripts/cockpit.mjs:501-532,638-639`). | Persistent operating preference deliberately kept in the run bar. |
| `■ KILL` / `◆ 復帰` | Explicit boolean safety switch, not a toggle inversion API. `POST /api/kill`, `{killed:true|false}`; bar and button show the killed state (`control-bar.mjs:152-165,286-311`; server `:1065-1094`). | Immediate safety control; `killed` is server in-memory state and is not in the settings file. |
| `soul:` status, Fire note, control error | Read-only/diagnostic text adjacent to the controls (`control-bar.mjs:313-332`; `control.mjs:44-78`). | Observational/feedback state. |
| Header Listening lamp, whisper/ffmpeg health, `voice:` label | Read-only health and output observation (`header.mjs:81-100`; `health.mjs:32-87`). | Observational state. |
| Feed rows, `最新へ↓`, usage/discarded/uptime | Transcript, viewer, speech, diagnostics, markers, usage and navigation. The jump button only changes scroll position (`styles.mjs:118-162`; `app.mjs:251`). | Observational/navigation state, not configuration. |

The UX source document explicitly records this three-way split—observation, operation, settings—and says self-fire/verbosity are operation rather than settings (`discussion/ai-cohost/implementation/screens/cockpit-redesign.md:7-19,84-99`). The current bar additionally contains barge-in and KILL.

### Drawer navigation, layout, opening/closing, accessibility, and dirty state

- The drawer has no tabs or internal navigation; it is a single scrollable panel with four sections in this order: 接続, 入出力, 頭脳, 記憶 (`settings-drawer.mjs:417-568`). Rows are flex/wrapping rows; CSS hides the panel unless `.open`, gives it `max-height:46vh` and `overflow-y:auto` (`styles.mjs:302-337`).
- `settingsOpen` starts false. Header gear toggles it; drawer close `✕` sets it false (`app.mjs:119-121,242-260`; `settings-drawer.mjs:418-422`). The component remains mounted while closed, so its three list-loading effects run once and local input/selection state survives close/reopen (`settings-drawer.mjs:180-186`; `styles.mjs:304-314`).
- After a successful GET `/api/state`, `app.mjs:164-197` sets `stateLoaded`; `app.mjs:212-221` runs a one-shot auto-open guard. `shouldAutoOpenSettings` returns true only when all of `channel.configured`, `visionTarget.title`, `audioDevice.name`, `chat.source`, and active `device` are absent (`settings.mjs:286-314`). It deliberately ignores `lastDevice` (not in the state snapshot), self-fire/barge-in/verbosity, brain, memory, and a failed state fetch. Subsequent snapshots never re-run the decision (`autoOpenedRef`).
- There is no backdrop click, Escape handler, focus trap, focus return, `role="dialog"`, `aria-modal`, `aria-expanded`, or `aria-controls` in the current source. The panel has only `aria-label="settings drawer"`; gear and close buttons have labels; normal `label for`/`id` pairs exist for selects/inputs (`header.mjs:97-100`; `settings-drawer.mjs:418-422,425-568`). This is an inventory fact, not a modal requirement.
- There is no Save/Cancel transaction or dirty-state model. Each Set/toggle posts immediately; select/input edits are local until their specific action. Closing does not discard local values. Channel success clears the token-bearing input; chat restoration is suppressed while the user is editing and re-enabled after successful Connect (`settings-drawer.mjs:188-203,249-269`; `status.mjs:63-72`). No unsaved-change prompt exists.

### Settings persistence keys and file/in-memory boundary

`createFileSettingsStore` uses `apps/soul/agent/cockpit-settings.local.json` by default (`cockpit-settings-store.mjs:59-66`), performs read-modify-write merges (`:98-116`), treats missing/corrupt JSON as empty, and swallows disk write errors (`:49-56,98-116`). The file is gitignored and is not part of this inventory. The complete current key set is:

| File key | Store API / default | Runtime boundary and effect |
|---|---|---|
| `lastDevice` | `get/setLastDevice`, string/null (`cockpit-settings-store.mjs:73-76,123-129`); no remembered value falls back to the first enumerated option in UI. | File-backed; server reads it for `/api/devices` and when Start omits a device, then writes the raw Start choice. Current active device is server `currentDevice`, not a snapshot-persisted field. |
| `lastChannelUrl` | `get/setLastChannelUrl`, string/null (`:75-76,130-135`); startup default null unless CLI `--channel`. | File-backed token-bearing value; runtime `lazyChannel` is in-memory and snapshot URL is redacted. |
| `visionTarget` | `get/setVisionTarget`, string/null (`:77-78,137-143`); default null. | File-backed; `createVisionTargetHooks` exposes it to the server/orchestrator and snapshot. |
| `audioDevice` | `get/setAudioDevice`, string/null (`:79-80,144-149`); null means OS/default output. | File-backed; live player object and its restart are in-memory. |
| `selfFireEnabled` | `get/setSelfFireEnabled`, boolean/null (`:81-82,151-158`); default false (`scripts/cockpit.mjs:330-358,632-634`). | File-backed preference; scheduler enabled state is in-memory and immediately changed by POST. |
| `bargeInEnabled` | `get/setBargeInEnabled`, boolean/null (`:83-84,159-166`); default true (`scripts/cockpit.mjs:362-392,634-635`). | File-backed preference; current interruption gate is in-memory. |
| `chatSource` | `get/setChatSource`, string/null (`:85-86,167-172`); default null. | File-backed source; connected client/state is in-memory and is not recreated merely by reading the key. |
| `verbosityMode` | `get/setVerbosityMode`, string/null (`:87-88,174-179`); accepted values quiet/normal/chatty, default normal (`scripts/cockpit.mjs:501-532,638-639`). | File-backed preference; scheduler mode is in-memory and changes immediately. |
| `brainChoice` | `get/setBrainChoice`, string/null (`:89-90,181-186`); valid registry values, default `claude` (`scripts/cockpit.mjs:535-575,640-664`). | File-backed selection; current brain/session are in-memory and hot-swapped on POST. |
| `memoryEnabled` | `get/setMemoryEnabled`, boolean/null (`:91-92,188-195`); default true (`scripts/cockpit.mjs:395-428,636-637`). | File-backed preference; memory text/count/checkpoint/last-record timestamp are in-memory and memory digest files are a separate runtime boundary. |

The server’s `createInMemorySettingsStore` intentionally implements only `lastDevice` and `lastChannelUrl` for isolated server tests (`cockpit-server.mjs:244-268`). Other runtime-only values include `killed`, ears/health/uptime, channel connection status, chat connected/state, scheduler/gate state, current session/player, `memoryCount`, and `lastRecordAtMs`. `brain.credentialHealth` is a boolean from `existsSync` only (`scripts/cockpit.mjs:833-840`); credential file contents are not read by the Cockpit.

### API endpoints tied to settings and their snapshot fields

The settings surface consumes these routes (server route anchors are `cockpit-server.mjs:868-1210`):

| Method/path | Payload/result and setting relationship |
|---|---|
| `GET /api/state` | Full snapshot used to hydrate settings/operation state. Relevant fields: `device`, `channel`, `visionTarget`, `selfFire`, `bargeIn`, `verbosity`, `killed`, `brain`, `memory`, `audioDevice`, `chat` (`cockpit-server.mjs:552-614`; UI projection `app.mjs:75-96`). |
| `GET /api/events` (SSE) | Initial `state` frame and live state/control/status events. UI subscribes to 13 event names (`app.mjs:45-59`); settings changes broadcast `state`, while chat status and operation markers use their dedicated events. |
| `GET /api/devices` | Device list plus `lastDevice`, input format and enumeration error (`cockpit-server.mjs:868-875`). |
| `POST /api/ears/start`, `POST /api/ears/stop` | Ear lifecycle; Start accepts `{device}` and persists `lastDevice` on start (`:886-914`, `:697-708`). |
| `GET /api/windows` / `POST /api/vision-target` | Enumerate windows; set/clear persisted vision target (`:929-954`). |
| `GET /api/audio-devices` / `POST /api/audio-device` | Enumerate output devices; set/clear persisted output target and return snapshot (`:969-994`). |
| `POST /api/channel` | Set/clear token-bearing URL; response snapshot exposes only redacted status (`:1128-1142`). |
| `POST /api/chat/connect` / `POST /api/chat/disconnect` | Start/fold live chat client; Connect persists source, disconnect is idempotent and leaves remembered source (`:1144-1176`). |
| `POST /api/self-fire`, `POST /api/barge-in`, `POST /api/verbosity` | Immediate scheduler/gate changes, persistence callbacks, and snapshot response (`:996-1063`). |
| `POST /api/brain` | Validates one of four brain IDs, invokes hot-swap callback, and returns `brain` snapshot (`:1096-1126`). |
| `POST /api/memory`, `POST /api/memory-record` | Toggle persistent memory and perform an explicit digest record (`:1178-1210`). |
| `POST /api/kill` | Adjacent safety endpoint; explicit `{killed:boolean}`, snapshot `killed`, no settings-file key (`:1065-1094`). |
| `POST /api/fire`, `POST /api/vision-fire` | Adjacent run endpoints. They consume channel/brain/audio/memory/vision settings but are not preference persistence routes (`:916-927,956-967`). |

Snapshot fields are assembled in one server function (`cockpit-server.mjs:552-614`). `channel.url` is redacted by the caller-provided `channelStatus`; `brain.identity` is additive public identity; `memory` is null when its provider is not injected; `killed` is always a server boolean (default false). `lastDevice` is intentionally absent from `/api/state` and exists only in `/api/devices`.

### Existing tests and fixtures

- `apps/soul/agent/src/cockpit/cockpit-ui.test.mjs:491-681` covers imports, leaf vnode mappings (`SettingsSelect`, `DrawerStatus`, control-bar leaves), fixed brain options, and CSS drawer/bar tokens. It explicitly does not render hook-bearing `SettingsDrawer`/`ControlBar` bodies (`:491-495`).
- `apps/soul/agent/src/cockpit/view-logic/settings.test.mjs:26-263` covers device/window/audio list fixtures, POST error text, auto-open predicate, memory toggle/status labels. `view-logic/status.test.mjs` covers chat/channel status and source restoration; `view-logic/control.test.mjs` covers run/safety derivation; `view-logic/health.test.mjs:100-128` covers brain labels/credential-health wording.
- `apps/soul/agent/src/cockpit/cockpit-settings-store.test.mjs:17-729` covers all ten file keys, round trips across instances, key co-existence/read-modify-write, corrupt/missing data, and unwritable-path failure tolerance. Tests inject temporary paths and do not touch the real settings file.
- `apps/soul/agent/src/cockpit/cockpit-server.test.mjs` covers endpoint/snapshot/SSE contracts, including device/start (`:318-437`), vision/channel/audio (`:968-1210,1845-1933`), self-fire/barge/verbosity (`:1254-1369,1934-2116`), chat (`:1375-1824`), brain (`:2198-2420`), memory (`:2748-3035`), and kill behavior. The exact line ranges are grouped by the test headings in that file.
- `apps/soul/agent/scripts/cockpit.test.mjs` covers settings-to-runtime hook defaults and persistence bridges (vision/audio `:314-411`; self-fire/barge `:412-514`; memory `:515-564`; verbosity `:835-888`; brain/hot-swap `:892-1069`; chat source `:1085-1123`).
- `apps/soul/agent/src/cockpit/cockpit-page.test.mjs:24-74` records the migration mapping from old DOM controls to `settings-drawer.mjs`/`control-bar.mjs` and the entry HTML contract. `cockpit-static-assets.test.mjs:227-232` fixes the served UI asset list, including `settings-drawer.mjs`.

## Historical notes

- The historical/UX source candidate `discussion/ai-cohost/implementation/screens/cockpit-redesign.md` is marked Draft/history (`:1-5`) but documents the motivation and three-layer split (`:7-19`), the drawer as two original sections (`:49-64`), and the one-shot auto-open flow (`:66-82`). The current source has since added Brain and Memory sections and current barge-in/KILL behavior; the screen document is therefore not a complete current-control inventory.
- The initial drawer design explicitly treated self-fire and verbosity as operating controls rather than settings (`screens/cockpit-redesign.md:14-17,84-89`). This is reflected in `control-bar.mjs`, while persistence still exists for both keys.
- The current README and implementation maps describe the Cockpit redesign as implemented, but this report treats source/tests as the authority for exact controls and wire fields.

## Active verification evidence

Static inspection completed against the files and line anchors above. A focused Node test attempt was made without network access:

```text
node --test apps/soul/agent/src/cockpit/view-logic/settings.test.mjs apps/soul/agent/src/cockpit/cockpit-settings-store.test.mjs apps/soul/agent/src/cockpit/cockpit-ui.test.mjs
TAP version 13
not ok ... cockpit-settings-store.test.mjs — error: 'spawn EPERM'
not ok ... cockpit-ui.test.mjs — error: 'spawn EPERM'
not ok ... view-logic/settings.test.mjs — error: 'spawn EPERM'
1..3
# tests 3
# pass 0
# fail 3
```

The single-file retry with `node --test --test-concurrency=1 .../view-logic/settings.test.mjs` produced the same `spawn EPERM`. This is classified as an environment/process-spawn limitation, not as a product assertion or a test failure inside the suites. No providers, external network, credentials, or user-data files were accessed.

## Known gaps

- There is no browser-level test of drawer open/close, auto-open integration, scroll layout, focus behavior, keyboard Escape, or dirty-state behavior. `shouldAutoOpenSettings` is tested as a pure function, but the `App` effect is not exercised by the current `cockpit-ui.test.mjs`.
- Hook-bearing drawer controls have no direct component interaction test; tests cover pure view-logic and leaf vnode mappings, while endpoint behavior is covered at server level.
- `lastDevice` is not in the state snapshot, so auto-open cannot distinguish a remembered mic from no remembered mic. Persisted vision/audio choices are shown in status but their selects initialize to the first enumerated option.
- No current setting key, endpoint, snapshot field, or UI editor exists for model-specific conversation instructions. Session prompts are built from the canonical brain identity, fixed fire prompt, and optional memory text (`scripts/cockpit.mjs:88-102,713-748`; `fire-orchestrator.mjs` fixed `FIRE_SYSTEM_PROMPT` contract). There is no user-editable per-brain instruction boundary today.

## Unresolved user decisions (not made here)

- Which current controls should remain always-visible operation/safety controls versus belong in a future settings modal; the source currently makes that split for self-fire, barge-in, verbosity, and KILL, but a modal replacement must preserve the distinction unless deliberately re-decided.
- Whether the future modal should preserve the current no-transaction/immediate-POST behavior or introduce dirty/Save/Cancel semantics, especially for model-specific conversation instructions.
- Storage and wire shape for model-specific instructions (per technical brain ID, public identity, or another profile), their fallback/default, validation/length limits, secret/privacy handling, and whether changes apply to the current session or only the next session.
- Modal accessibility/navigation behavior (dialog semantics, focus entry/return, Escape/backdrop, scroll/section navigation) is not specified by the current drawer implementation.
- The historical `cockpit-redesign.md` screen description should be reconciled with the current Brain/Memory additions if it is to remain a current UX source.

## Concrete source/test files implicated by a drawer-to-modal replacement

This list identifies likely directly affected files without prescribing edits:

- `apps/soul/agent/src/cockpit/ui/settings-drawer.mjs` (current component and all drawer handlers/markup).
- `apps/soul/agent/src/cockpit/ui/app.mjs` (drawer import, persistent mount, open state, auto-open effect, `settingsFromSnapshot` wiring).
- `apps/soul/agent/src/cockpit/ui/header.mjs` (gear trigger and its accessibility attributes).
- `apps/soul/agent/src/cockpit/ui/styles.mjs` (drawer display/scroll/layout selectors and shared control styling).
- `apps/soul/agent/src/cockpit/ui/control-bar.mjs` (only if operation controls or their placement/ownership changes; otherwise its API remains a separate surface).
- `apps/soul/agent/src/cockpit/view-logic/settings.mjs` and `settings.test.mjs` (auto-open predicate, list/status/error derivations, any new instruction view logic).
- `apps/soul/agent/src/cockpit/view-logic/status.mjs`, `health.mjs`, `control.mjs` and their tests (only for changed status/control or brain/instruction projections).
- `apps/soul/agent/src/cockpit/cockpit-ui.test.mjs` (component imports/leaf mappings/CSS assertions) and `cockpit-page.test.mjs` (migration mapping/entry assumptions).
- `apps/soul/agent/src/cockpit/cockpit-static-assets.test.mjs` (served UI module filename list if `settings-drawer.mjs` is renamed or removed).
- `apps/soul/agent/src/cockpit/cockpit-server.mjs` / `cockpit-server.test.mjs`, `cockpit-settings-store.mjs` / `cockpit-settings-store.test.mjs`, and `scripts/cockpit.mjs` / `cockpit.test.mjs` only if the replacement adds a new instruction API, snapshot field, persistence key, or runtime application boundary. A visual shell replacement alone does not require changing their existing settings contracts.
- `discussion/ai-cohost/implementation/screens/cockpit-redesign.md` and its screen map if the documented current IA is intentionally updated; this report makes no such decision.
