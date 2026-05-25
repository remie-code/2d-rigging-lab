# Cubism Web MOC3 Inspector Implementation Note

> Date: 2026-05-25 JST  
> Scope: Record what was implemented for `experiments/cubism-web-moc3-inspector/`, what was verified locally, and what remains blocked until a local Cubism SDK/Core for Web is supplied.

## Repository Facts

- Added a local-only Vite + TypeScript sample under `experiments/cubism-web-moc3-inspector/`.
- The sample targets `ref/kipfel2_vts/黒シャツキプフェル.model3.json`.
- `vite.config.ts` serves repository reference assets from `/ref/` during dev and preview, without copying the reference package into the experiment.
- Local Cubism SDK/Core serving is isolated to `/vendor/live2d/`:
  - either from `VITE_CUBISM_SDK_WEB_ROOT`, served by Vite middleware;
  - or from the gitignored `public/vendor/live2d/` placeholder.
- SDK/Core usage in repository code is isolated behind `src/cubismSdkAdapter.ts`.
- `.gitignore` now excludes the local SDK/Core placeholder contents, `node_modules/`, `dist/`, dev-server logs, and generated JSON outputs.
- The experiment includes:
  - browser-visible structured JSON preview;
  - diagnostics section;
  - JSON download button;
  - local dev/preview save endpoint and **Save to outputs** button for writing generated reports under `outputs/`;
  - `.env.example` and README instructions for local SDK/Core configuration.

## Design Decisions

- The first adapter path tries the official Core-style browser global from `live2dcubismcore.js`:
  - default script URL: `/vendor/live2d/Core/live2dcubismcore.js`;
  - override: `VITE_CUBISM_CORE_SCRIPT_URL`.
- A local advanced adapter module can be supplied with `VITE_CUBISM_RUNTIME_ADAPTER_URL`. It must export `inspectCubismMoc(request)`.
- The app still emits package inspection JSON when SDK/Core is unavailable.
- The report explicitly separates:
  - package facts from `model3.json`, `physics3.json`, `cdi3.json`, and optional `vtube.json`;
  - SDK/Core runtime observations;
  - derived joins and consistency checks;
  - unavailable authoring data.
- The app does not promise recovery of `.cmo3` project state, deformer hierarchy, keyforms, PSD/source layers, source artwork paths, mesh edit history, or direct `.moc3` binary semantics.
- If `/vendor/live2d/Core/live2dcubismcore.js` resolves to Vite's HTML app fallback, the adapter reports `cubism-core-script-html-fallback` before trying to execute it as a script.

## Experiment Results

Commands run from `experiments/cubism-web-moc3-inspector/`:

```text
pnpm install
pnpm typecheck
pnpm build
```

Observed results:

- `pnpm install` completed and generated `pnpm-lock.yaml`.
- `pnpm typecheck` passed.
- `pnpm build` passed.
- Vite dev server was started at `http://127.0.0.1:5173/`.
- A later continuation re-ran `pnpm typecheck` and `pnpm build`; both still passed after the Vite preview/static middleware and SDK path documentation adjustments.
- A later continuation added the local output writer endpoint, the **Save to outputs** UI path, and explicit Core HTML-fallback diagnostics. `pnpm typecheck` and `pnpm build` still passed.
- Browser plugin backend was unavailable in this session (`agent.browsers.list()` returned an empty list), so visual browser automation could not be performed.
- As a fallback, the built browser bundle was executed against the running Vite dev server with a minimal DOM environment. It produced the structured JSON preview through the same HTTP fetch path.
- A later continuation repeated the fallback JSON-only run against the running dev server; `http://127.0.0.1:5173/` and the target `.model3.json` both returned HTTP 200.
- A later continuation ran the same fallback with `Include geometry arrays` enabled and saved the report through the Vite endpoint.

JSON-only inspection observations from that fallback run:

| Field | Observed value |
|---|---|
| `schemaVersion` | `cubism-runtime-inspector.v0.1` |
| `capabilities.jsonInspection` | `true` |
| `capabilities.sdkCoreAvailable` | `false` |
| `capabilities.runtimeModelLoaded` | `false` |
| `capabilities.vtubeSidecarFound` | `true` |
| model3 asset | found, 363 bytes |
| moc asset | found, 237824 bytes |
| texture asset | found, 4647192 bytes |
| physics asset | found, 3160 bytes |
| display-info asset | found, 3385 bytes |
| vtube sidecar asset | found, 13408 bytes |
| texture dimensions | 4096 x 4096 |
| physics settings | 2 |
| display parameters | 29 |
| display parts | 20 |
| diagnostics | `cubism-core-script-unavailable` |
| consistency checks | `sdk-core-runtime-unavailable` |
| unavailable authoring entries | 6 |

Latest saved output:

```text
experiments/cubism-web-moc3-inspector/outputs/kipfel2_vts-runtime-inspector-json-only-geometry-20260525T040444Z.json
```

Latest saved-output observations:

| Field | Observed value |
|---|---|
| dev app URL | `http://127.0.0.1:5173/` returned HTTP 200 |
| target `.model3.json` URL | returned HTTP 200 |
| `.env.local` | not present |
| default Core file | `public/vendor/live2d/Core/live2dcubismcore.js` not present |
| `/vendor/live2d/Core/live2dcubismcore.js` | returned HTTP 200 `text/html`, matching Vite HTML fallback |
| `outputOptions.includeGeometry` | `true` |
| `capabilities.jsonInspection` | `true` |
| `capabilities.sdkCoreAvailable` | `false` |
| `capabilities.runtimeModelLoaded` | `false` |
| `.moc3` bytes fetched | 237824 bytes |
| runtime parameters / parts / drawables | `0 / 0 / 0` because SDK/Core did not load |
| drawables with geometry arrays | `0` because runtime drawables were unavailable |
| diagnostics | `cubism-core-script-html-fallback`, `geometry-requested-runtime-unavailable` |
| consistency checks | `sdk-core-runtime-unavailable` |

## Remaining Blockers

- A local Cubism SDK/Core for Web installation was not configured in this session.
- `.moc3` runtime load and extraction of canvas, parameters, parts, drawables, masks, render order, and geometry counts remain unverified until Core is supplied.
- Exact Web Core field names for draw order, offscreen data, blend/color fields, and moc version should be confirmed against the installed local SDK/Core version.
- Browser visual verification was not completed because the in-app browser backend was unavailable in the current environment.

## Next Verification When SDK/Core Is Available

1. Extract the official Cubism SDK for Web outside the repository.
2. Add `.env.local` under `experiments/cubism-web-moc3-inspector/` with `VITE_CUBISM_SDK_WEB_ROOT` and, if needed, `VITE_CUBISM_CORE_SCRIPT_URL`; or place/symlink Core files under the gitignored `public/vendor/live2d/Core/` placeholder.
3. Run `pnpm dev`.
4. Open `http://127.0.0.1:5173/`.
5. Confirm:
   - `capabilities.sdkCoreAvailable` is `true`;
   - `capabilities.runtimeModelLoaded` is `true`;
   - runtime canvas, parameter, part, and drawable arrays are populated;
   - no SDK/Core binaries are tracked by git.
