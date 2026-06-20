# Runtime Player Technology Stack Decision

> Status: Accepted baseline.  
> Topic: Editor外の Runtime Player / Capture Host app の技術スタック。

## 1. Purpose

Runtime Playerは、Editorが生成したRuntime Export directoryを読み込み、tracking inputを受け取り、transparent Stage Windowでモデルをライブ表示する別アプリである。

この文書は、Runtime Player v0の技術スタックと責務分割を固定し、後続のplanning-gate / wave計画で迷わないためのbasisとして残す。

## 2. Accepted Stack

| Layer | Decision |
|---|---|
| Language | TypeScript-first |
| Package manager | 既存monorepoと同じ `pnpm workspace` |
| App shell | Electron |
| Electron dev/build | `electron-vite` |
| UI framework | React |
| Frontend build | Vite |
| Styling | Tailwind CSS, existing app-level CSS conventions |
| UI primitives | Radix UI where needed |
| Icons | lucide-react |
| Local UI state | Zustand |
| Runtime rendering | Existing `@private-2d-rigging-lab/runtime-core` + `@private-2d-rigging-lab/render-webgl2` |
| Tracking input transport | Electron main process using Node.js networking APIs, first target iFacialMocap UDP/TCP |
| Renderer/Main bridge | Electron preload + `contextBridge` + typed IPC API |
| Packaging | Defer final packaging choice, but `electron-builder` is the likely first candidate |

## 3. Official Facts

- Electron `BrowserWindow` is the API for creating and controlling app windows, and exposes options relevant to this app such as preload scripts, WebGL, background throttling, and transparent windows.  
  Source: <https://www.electronjs.org/docs/latest/api/browser-window>
- Electron `contextBridge` is the supported mechanism for exposing a safe API from an isolated preload script to renderer code when context isolation is enabled.  
  Source: <https://www.electronjs.org/docs/latest/api/context-bridge>
- Node.js provides UDP/datagram sockets through `node:dgram`, including socket creation, binding, receiving messages, and sending messages.  
  Source: <https://nodejs.org/api/dgram.html>
- `electron-vite` is designed around Electron's dual environment and provides one configuration point for main process, preload scripts, and renderer processes.  
  Source: <https://electron-vite.org/guide/>
- Vite provides a fast dev server and production build pipeline for modern frontend projects.  
  Source: <https://vite.dev/guide/>

## 4. Repository Facts

- The current repository is already a TypeScript + pnpm workspace.
- The current Editor app is in `apps/editor`.
- The current Editor app already uses React, Vite, Tailwind CSS, Radix UI, lucide-react, Zustand, and Playwright for app-level UI/e2e verification.
- Runtime/evaluation/rendering code already exists in packages such as:
  - `packages/runtime-core`
  - `packages/render-core`
  - `packages/render-webgl2`
  - `packages/contracts`
- Runtime Export v0 already exists as an Editor-produced artifact intended to be consumed by a runtime/player app.

## 5. App Layout

Runtime Player should be added as a new app, separate from Editor:

```text
apps/runtime-player/
  src/main/
    # Electron app lifecycle, BrowserWindow creation, file IO,
    # iFacialMocap UDP/TCP adapter, recent state persistence.
  src/preload/
    # Narrow typed API exposed to renderer windows through contextBridge.
  src/control/
    # Control Window React app: open export, connect input, calibration,
    # display controls, debug drawer.
  src/stage/
    # Transparent Stage Window React/bootstrap entry and imperative render loop.
```

The exact filenames are implementation details, but the process boundary should stay stable:

- Main process owns OS integration and network sockets.
- Renderer processes own UI and WebGL canvas display.
- Preload owns the narrow bridge between them.

## 6. Window Model

Runtime Player uses two windows:

1. Control Window
   - Normal desktop UI.
   - Opens Runtime Export directory.
   - Shows connection state.
   - Configures iFacialMocap or future input adapters.
   - Sends display/calibration commands to Stage Window.

2. Stage Window
   - Transparent and frameless.
   - Capture-friendly target for OBS or similar software.
   - Shows the model only.
   - Does not show parameter sliders, debug data, or setup controls in normal operation.

This keeps the capture output clean while preserving a full control surface elsewhere.

## 7. Rendering Decision

Use existing runtime/rendering packages rather than adding PixiJS, Three.js, or another scene renderer.

Reasoning:

- The Editor already has a WebGL2 rendering path for the project-defined runtime model.
- The Runtime Player needs the same semantic rendering as the Editor's Atlas Runtime view, not a separate visual interpretation.
- Adding a second high-level rendering engine would create another mapping layer without solving a current problem.

Stage Window may use React for bootstrapping layout, but the hot path must not be React state driven. Tracking frames, dynamics simulation, parameter evaluation, and WebGL drawing should run through an imperative runtime loop.

## 8. Input Adapter Decision

The first input adapter target is iFacialMocap.

Architecture:

```text
iFacialMocap
  -> UDP/TCP socket in Electron main process
  -> parser/normalizer
  -> typed tracking frame
  -> IPC/preload API
  -> runtime parameter mapping
  -> runtime-core evaluation + dynamics
  -> render-webgl2 draw
```

Input source switching should be a first-class design boundary, even if v0 implements only iFacialMocap.

Future adapter candidates include VMC/OSC or other face tracking sources. They should produce the same normalized tracking frame shape before entering runtime parameter mapping.

## 9. Security / Process Policy

- Keep `nodeIntegration` disabled in renderer windows.
- Keep context isolation enabled.
- Do not expose raw filesystem or socket APIs to renderer code.
- Expose only narrow app-specific methods through preload, such as:
  - open Runtime Export directory
  - get last opened export
  - connect/disconnect input source
  - receive tracking connection state
  - send stage display settings

This is not about distrusting local model files as hostile internet content. It is about keeping the Electron process boundary predictable before the app grows.

## 10. Non-Decisions / Rejected Options

### Browser-only app

Rejected for v0 because the player must receive iFacialMocap UDP/TCP traffic and manage transparent/capture-friendly desktop windows. Browser-only would push these requirements into a separate native bridge anyway.

### Tauri

Not selected for v0.

Tauri remains plausible later, but v0 favors implementation speed and reuse of existing TypeScript runtime/rendering assets. Tauri would introduce a Rust backend boundary and extra IPC/platform surface before the core player UX is proven.

### PixiJS / Three.js

Not selected for v0.

The project already has a dedicated WebGL2 renderer for the runtime model. A general scene engine should be added only if a concrete rendering requirement appears that the existing renderer cannot satisfy.

## 11. Testing Direction

Initial tests should emphasize deterministic pieces:

- Runtime Export directory load/parse.
- Runtime graph validation.
- iFacialMocap frame parser and normalizer fixtures.
- Parameter mapping from normalized tracking frame to runtime parameters.
- Dynamics/runtime-core evaluation independent of Electron windows.

Electron window tests should stay thin at first:

- Control Window can open.
- Stage Window can be created transparent/frameless in development smoke tests.
- Renderer can receive a synthetic tracking frame and render a nonblank frame.

## 12. Open Questions

- Stage Window v0 controls: position, size, always-on-top, click-through.
- Transparent Window behavior on target OS/version combinations.
- iFacialMocap connection strategy: require iPhone IP for handshake, or passive listen first with optional handshake.
- Runtime Export stale/compatibility handling in Player.
- Whether packaging uses `electron-builder` first or waits until after the player prototype is usable.
