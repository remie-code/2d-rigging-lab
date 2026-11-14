# Workspace reference images

Use the Authoring Host to save a PNG in a directory workspace and draw it with the same stage coordinates as the model. The workspace has one active reference. The model's revision and package files are unchanged by reference operations.

Run a request with:

```powershell
node --experimental-transform-types --no-warnings --import ./apps/authoring-host/register-workspace-source-resolver.mjs ./apps/authoring-host/src/cli.ts --package-dir <workspace> --state-dir <outside-state-dir> --command-file <request.json>
```

```json
{
  "schemaVersion": "ai-command-request-v1",
  "commandId": "cmd_register_reference",
  "session": { "agentId": "agent_authoring", "capabilities": ["editReference"] },
  "command": "referenceImage",
  "payload": {
    "action": "register",
    "imagePath": "C:/images/target.png",
    "settings": {
      "scale": 0.8,
      "translation": { "x": 500, "y": -130 },
      "opacity": 0.45
    }
  }
}
```

- `register` validates and copies the original PNG. It starts with model origin (0, 0), image-center pivot, scale 1 model unit per pixel, zero rotation, opacity 0.5, and overlay mode. Optional `settings` apply to those defaults in the same save. Registration replaces the active reference.
- `update` accepts `settings` with any of `displayMode`, `opacity`, `pivot`, `scale`, `rotationDegrees`, and `translation`. Use `pivot` by itself to place the pivot without moving the image. `pivot` uses upper-left image coordinates within the pixel edges. `scale` and `rotationDegrees` are absolute and keep the chosen pivot fixed. Positive rotation is clockwise in Y-down model space. `translation` adds a model-space offset after the scale and rotation.
- `get` uses the `read` capability and returns `payload.result.reference` in the AI response. `remove` saves a null reference. Register, update, and remove use the `editReference` capability.

The host stores `authoring/reference-image.json` and the exact PNG bytes at `authoring/reference-images/<sha256>.png`. It publishes PNG bytes before replacing the state JSON. A failed registration leaves the previous active state intact. Re-register a PNG or remove the reference to recover from a missing or damaged reference. Old PNGs remain so a reader that has already read the previous state can still open its image. Model save and Runtime Export process the model's own file set.

## Comparison renders

Use `renderView` with the `render` capability and a fixed `stageViewport`, output size and parameter overrides. Here is an example payload.

```json
{
  "referenceMode": "overlay",
  "view": { "kind": "stageViewport", "stageViewport": { "minX": 899, "minY": 330, "width": 134, "height": 111 } },
  "outputWidth": 536,
  "outputHeight": 444,
  "parameterOverrides": { "param_shared_laughter": 0.7, "param_eye_right_open": 1 },
  "outDir": "C:/renders",
  "outputName": "eye-overlay"
}
```

With `referenceMode` omitted, the Host uses the saved mode. A workspace without a reference renders the model by default. For a repeatable three-way comparison, send the same view and parameters with `referenceMode` set to `model`, `reference`, and `overlay` and give each output its own name. An explicit `model` render works with damaged reference files. Reference modes require a registered PNG and use the saved opacity, including zero. Render modes are per-request overrides and do not modify the saved state.

The sidecar records the model package ID and revision, parameter overrides, resolved viewport, effective reference mode, and the PNG hash, transform, and opacity when the reference is used. Keep the same saved model and original PNG to reproduce a comparison. CLI commands read the saved workspace on each invocation.
