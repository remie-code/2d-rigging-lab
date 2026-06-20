# Runtime Player Development Policy

> Status: Accepted baseline.  
> Topic: Runtime Player / Capture Host app のディレクトリ粒度、ファイル分割、process boundary、runtime loop、IPC、test方針。

## 1. Purpose

この文書は、Runtime Playerを健全に実装するための開発規約である。

既存の [Source File Organization Policy](../../development_convention/source-file-organization-policy.md) を前提に、Electron / Control Window / transparent Stage Window / tracking input / runtime rendering に固有の規約を追加する。

## 2. Scope

対象:

- `apps/runtime-player/**`
- Runtime Player実装のために追加する専用package
- Runtime Playerから利用する新規のpure runtime/input/mapping package

対象外:

- Editor authoring UI
- Workspace Save / Portable JSON / Texture Atlas authoring
- Runtime Export生成側
- 既存 `packages/**` の一般source organization規約

ただし、Runtime Playerのために既存 `packages/**` を変更する場合は、既存source organization規約とこの文書の依存境界を両方満たす。

## 3. Process Boundary

Electron process boundaryは責務境界であり、便利さで崩してはならない。

| Area | Owns | Must not own |
|---|---|---|
| `main` | App lifecycle, window creation, file IO, Runtime Export directory access, UDP/TCP sockets, persistent settings, OS integration | React components, WebGL drawing, DOM manipulation |
| `preload` | Narrow typed bridge from main to renderer through `contextBridge` | Business logic, runtime simulation, raw filesystem/socket exposure |
| `control` | Control Window UI, user setup flow, connection controls, calibration UI, debug drawer | Direct Node/Electron access, WebGL runtime hot loop |
| `stage` | Transparent Stage Window bootstrap, runtime loop ownership, WebGL canvas display | File picker, socket ownership, setup-heavy UI |

Rules:

- Renderer code must not import `node:*`, Electron main APIs, or filesystem/socket APIs directly.
- Main process must not import React UI modules.
- Main process may own network and filesystem handles, but renderer receives only typed app-level results/events.
- Stage Window is model display only in normal operation. It must not become a setup surface.

## 4. Directory Granularity

Directories should be created by responsibility, not by vague file type.

Preferred structure shape:

```text
apps/runtime-player/
  src/main/
    window-management/
    runtime-export-loader/
    input-adapters/
      ifacialmocap/
    settings-store/
  src/preload/
    ipc-contract/
  src/control/
    app-shell/
    model-selection/
    input-setup/
    calibration/
    debug-panel/
  src/stage/
    runtime-loop/
    stage-renderer/
    display-settings/
```

These names are examples, not mandatory. The responsibility boundary is mandatory.

Create a subdirectory when one of these is true:

- The responsibility naturally needs three or more source files.
- The responsibility has its own focused tests.
- The responsibility has a stable boundary with another process/window/package.
- The responsibility has fixtures or protocol samples.

Do not create deep directories for a concept that currently needs one small file and has no stable boundary yet.

## 5. File Split Rules

One file should own one cohesive concept.

Good split example for iFacialMocap:

```text
ifacialmocap-frame-parser.ts
ifacialmocap-normalizer.ts
ifacialmocap-udp-receiver.ts
ifacialmocap-connection-state.ts
ifacialmocap-frame-fixtures.test.ts
```

Forbidden patterns:

- `ifacialmocap.ts` containing socket lifecycle, parsing, normalization, UI labels, settings, and tests.
- `runtime-player.ts` containing app bootstrap, IPC, input mapping, render loop, and settings.
- Broad catch-all files such as `types.ts`, `utils.ts`, `helpers.ts`, `common.ts`, or `ipc.ts` when they mix unrelated responsibilities.
- Substantial implementation logic in `index.ts`.

`index.ts` is a barrel or minimal entrypoint only.

## 6. IPC Contract Policy

IPC is an app contract, not a dumping ground.

Rules:

- Define typed request/response shapes and event payloads.
- Keep raw Electron channels behind named preload functions.
- Separate command-style APIs from event streams.
- Do not expose raw `ipcRenderer`, filesystem handles, sockets, or Electron objects to React code.
- IPC names should be namespaced by responsibility.

Preferred API shape:

```ts
runtimeExport.openDirectory()
runtimeExport.getLastOpened()
input.connect(config)
input.disconnect()
input.onConnectionState(callback)
input.onFrame(callback)
stage.setDisplaySettings(settings)
stage.resetSimulation()
```

High-frequency data must be treated carefully:

- Tracking frames may flow through an event stream.
- React state should not be updated for every raw tracking frame unless the UI specifically needs throttled/debug display.
- Stage runtime loop should consume the latest frame through an imperative bridge or buffered state, not through React re-render cadence.

## 7. Runtime Loop Policy

The runtime hot path must not be driven by React state.

Hot path:

```text
latest normalized tracking frame
  -> parameter mapping
  -> dynamics simulation
  -> runtime-core evaluation
  -> render-webgl2 draw
```

Rules:

- Stage rendering should use `requestAnimationFrame` or an equivalent imperative loop.
- React may create/attach the canvas and provide settings, but must not perform per-frame evaluation by component render.
- Runtime simulation state belongs to the Stage runtime loop.
- Control Window may send settings/calibration changes; Stage applies them at frame boundaries.
- The loop must have explicit start, stop, reset simulation, and dispose paths.

## 8. State Ownership

Avoid the same authoritative state living in multiple places.

| State | Authority | Notes |
|---|---|---|
| Runtime Export directory path | Main process | Control Window displays it; Stage receives loaded runtime data |
| Loaded runtime artifact bytes/graph | Main process for loading, Stage for render-ready copy | Do not duplicate parsing logic in each renderer |
| Input connection state | Main process | Renderer subscribes |
| Latest normalized tracking frame | Input adapter / Stage bridge | UI debug display should be throttled |
| Runtime simulation state | Stage runtime loop | Reset through explicit command |
| Control UI state | Control renderer | Zustand/React is fine |
| Persistent player settings | Main process | Renderer requests changes through preload |

If a state needs to cross a process boundary, define whether it is:

- a command,
- a snapshot,
- an event stream,
- or a render-loop local value.

## 9. Package Boundary

Dependency direction:

```text
apps/runtime-player
  -> packages/runtime-core
  -> packages/render-core
  -> packages/render-webgl2
  -> packages/contracts
```

Rules:

- `runtime-core` must remain independent of Electron, React, DOM, and Node sockets.
- `render-webgl2` must remain independent of Electron and React.
- Player-specific OS integration stays under `apps/runtime-player`.
- Pure parser/normalizer/mapping logic may move to `packages/**` only when it is clearly reusable or needs non-Electron tests.
- Editor must not depend on `apps/runtime-player`.
- Shared code between Editor and Player should be promoted to a named package or existing package only when the boundary is stable.

## 10. Error And Diagnostics Policy

Do not silently ignore failures.

Control Window should surface:

- Runtime Export load errors.
- Missing or incompatible runtime artifact data.
- Input connection errors.
- Last received frame age / disconnected state.
- Mapping/calibration validation errors.

Stage Window should stay capture-clean:

- Normal operation shows only the model.
- Fatal runtime display errors may show a minimal fallback only if the model cannot render at all.
- Debug data belongs in Control Window, not on the captured Stage.

Debug drawer should have room for:

- Raw input frame summary.
- Normalized frame summary.
- Mapped parameter values.
- Dynamics enabled / reset state.
- Last renderer/runtime error.

## 11. Naming Policy

Use these terms consistently:

| Term | Meaning |
|---|---|
| `tracking frame` | External input frame from iFacialMocap or another source before app-level normalization |
| `normalized frame` | Adapter-independent input frame shape consumed by mapping |
| `parameter mapping` | Conversion from normalized frame to runtime parameter values |
| `runtime frame` | One evaluated display frame after parameter mapping and dynamics |
| `control window` | Setup/operation window |
| `stage window` | Transparent capture-friendly display window |
| `input adapter` | Source-specific receiver/parser/normalizer boundary |
| `runtime export` | Editor-produced directory artifact consumed by Runtime Player |

Avoid ambiguous names such as `data`, `payload`, `state`, or `frame` without a qualifier when crossing module boundaries.

## 12. Testing Policy

Prefer deterministic tests for pure logic and thin smoke tests for Electron windows.

Required test focus:

- Runtime Export directory load/parse.
- Runtime graph validation and compatibility checks.
- iFacialMocap parser fixtures.
- Normalization from source-specific frame to normalized frame.
- Parameter mapping from normalized frame to runtime parameters.
- Dynamics/runtime-core evaluation independent of Electron.
- Stage runtime loop behavior with synthetic frames and fake timing where practical.

Electron-specific tests should be thin:

- Control Window can open.
- Stage Window can be created with transparent/frameless settings.
- Stage receives a synthetic frame and renders a nonblank frame.

Do not make every behavior depend on Electron end-to-end tests. If a behavior can be tested as pure TypeScript, test it there.

## 13. Review Checklist

Blocking:

- Renderer imports Node/Electron APIs directly.
- Main process imports React UI modules.
- Stage runtime hot path is driven by React re-rendering.
- Substantial implementation logic is placed in `index.ts`.
- New `types.ts` / `utils.ts` / `helpers.ts` catch-all files hide multiple responsibilities.
- Raw `ipcRenderer`, filesystem handles, sockets, or Electron objects are exposed to renderer code.
- Input adapter parsing, normalization, socket lifecycle, and UI are all mixed in one file.

Warning:

- A responsibility is currently readable but likely to need its own directory next wave.
- High-frequency input updates are routed through unthrottled React state.
- Debug UI leaks into Stage Window.
- A pure mapping/parser function is trapped inside Electron-specific code and cannot be tested without Electron.

## 14. Open Questions

- Exact Stage Window controls for v0: position, size, always-on-top, click-through.
- Transparent Window behavior across target OS/version combinations.
- iFacialMocap connection strategy: required iPhone IP handshake vs passive listen first.
- Runtime Export compatibility/stale handling in Player.
- Packaging timing and first packaging tool choice.
