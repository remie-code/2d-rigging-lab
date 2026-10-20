# Material authoring

Material work on a saved editable `open-model-package-v1` directory has two parts:

- Two read-only commands, `extractMaterialSource` and `previewMaterialPlacement`. They render from the saved package and write artifacts outside it. They never change the package.
- Two ordinary operations, `addDrawableFromImage` and `replaceDrawableImage`. They run through `dryRunOperation` / `commitOperation` like every other operation. The host reads the PNG named in the payload.

Run the CLI from the repository root:

```powershell
node --experimental-transform-types --no-warnings --import ./apps/authoring-host/register-workspace-source-resolver.mjs ./apps/authoring-host/src/cli.ts --package-dir C:/work/model --state-dir C:/work/host-state --command-file C:/work/command.json
```

Omit `--command-file` to read one JSON command from stdin. The state directory must be outside the package directory. Every call loads the package again from disk. The CLI prints JSON. The exit code is 0 for success, 2 for a rejection, and 1 for a failure.

All host commands share one lock per package: the file `<package-dir>.authoring.lock`, next to the package directory. It exists only while a command runs. If another command holds it, the CLI rejects the call with check ID `authoringHost.packageBusy` (exit 2). Retry later. Do not delete the lock while a command is running.

Every command uses the usual envelope:

```json
{
  "schemaVersion": "ai-command-request-v1",
  "commandId": "cmd_material_001",
  "session": { "agentId": "author", "capabilities": ["render", "dryRunEdit", "commitWithApproval"] },
  "basis": { "relatedAC": [], "relatedScenarios": [] },
  "command": "extractMaterialSource",
  "payload": { "drawableId": "draw_target", "viewport": { "stageRect": { "space": "rest-stage-canvas-y-down-v1", "x": 0, "y": 0, "width": 512, "height": 512 }, "outputWidth": 512, "outputHeight": 512 } }
}
```

## Shared values

`viewport` fixes the render frame: a rest-stage rectangle and an output size with the same aspect ratio (uniform pixels per stage unit).

```json
{ "stageRect": { "space": "rest-stage-canvas-y-down-v1", "x": 0, "y": 0, "width": 512, "height": 512 }, "outputWidth": 512, "outputHeight": 512 }
```

`placement` maps source-image pixel edges to rest-stage coordinates with a positive uniform scale: `xStage = scale * xPixel + translation.x`, and the same for y.

```json
{ "from": "source-image-pixel-edge-v1", "to": "rest-stage-canvas-y-down-v1", "scale": 2, "translation": { "x": 10, "y": 20 } }
```

`image` names a PNG file. The same object is used by `previewMaterialPlacement` and by both operations:

```json
{ "imagePath": "C:/work/materials/chin-shadow.png", "rgbaSha256": "<64 lowercase hex>", "width": 128, "height": 96 }
```

- `imagePath` must be absolute.
- `rgbaSha256` is the SHA-256 of the normalized pixels, not of the PNG file. The normalized pixels are straight-alpha RGBA8, row by row from the top. For a plain 8-bit RGBA PNG, these are the decoded pixel bytes.
- `width` and `height` are the decoded size in pixels.
- `contentInset` (storage padding) is optional. It defaults to zero and must be zero for now.

The host reads the file and checks it in this order:

1. The PNG structure. Color metadata other than sRGB is rejected, not converted. Animated PNGs are rejected.
2. Decoding to RGBA8. A fully transparent image is rejected.
3. The decoded size against `width` and `height`.
4. The SHA-256 of the RGBA bytes against `rgbaSha256`.

Transparent margins stay in place. The whole image area is placed, not only its alpha bounding box.

## Read-only commands

Both require the `render` capability and write PNG + JSON sidecar pairs under `<state-dir>/material-artifacts`. Each sidecar records `packageRef` (`packageId` and `packageRevision`), the viewport, the pixel-to-stage mapping, and the rest pose. Artifact paths are absolute. If `basis.packageRevision` is given and differs from the saved revision, the command is rejected (`material.basisStale`).

| Command | Payload | `payload.result` on success |
| --- | --- | --- |
| `extractMaterialSource` | `drawableId`, `viewport` | `packageRef`, `sourceContext`, `artifacts` |
| `previewMaterialPlacement` | `image`, `alignment`, `intent`, `viewport` | `packageRef`, `placement`, optional `fitEvidence`, `preview` (`artifact`, `sidecar`), `context`, `artifacts` |

`extractMaterialSource` returns:

- The drawable's original texture as a PNG.
- A rest composite of the whole package in `viewport`.
- `sourceContext`: the mesh, parent part, rig controls (including ancestors), mask relations, variant groups and related targets of the drawable. It also includes `sourceImageToStage`, the mapping from the texture's pixel edges to rest stage.

`previewMaterialPlacement` draws the image as one quad at the placement, before any mesh exists. The draw order, rest opacity, visibility and masks are the ones the `intent` (see below) would produce. It returns this preview together with the package's rest composite at the same viewport (`context`), for a before/after comparison. `alignment` is one of:

- `{ "placement": <placement> }`
- `{ "correspondences": [ { "pixel": { "space": "source-image-pixel-edge-v1", "x": 0, "y": 0 }, "stage": { "space": "rest-stage-canvas-y-down-v1", "x": 10, "y": 20 } }, ... ] }`

Correspondences need at least two points that are not all at the same place. They are fitted to a uniform scale and a translation. The fitted `placement` is returned; copy it into the operation payload. `fitEvidence` gives numerical residuals only. It does not judge how natural the result looks.

Errors from these commands use check IDs `material.<code>`. Examples: `material.imageDigestMismatch`, `material.missingDrawable`, `material.nonuniformSourceMapping`.

## Adding and replacing drawables

Use `dryRunOperation`, then `commitOperation`. This requires `dryRunEdit` and `commitWithApproval`. A dry-run with no error diagnostics is approved automatically, unless its operation type is routed to human approval. The commit names that dry-run in `approvedDryRunCommandId`.

Add a drawable:

```json
{
  "schemaVersion": "operation-request-v1",
  "operationId": "op_chin_shadow_add",
  "actor": "ai", "surface": "structuredApi", "dryRun": true, "basePackageRevision": 2152,
  "operationType": "addDrawableFromImage",
  "payload": {
    "image": { "imagePath": "C:/work/materials/chin-shadow.png", "rgbaSha256": "<64 hex>", "width": 128, "height": 96 },
    "placement": { "from": "source-image-pixel-edge-v1", "to": "rest-stage-canvas-y-down-v1", "scale": 0.5, "translation": { "x": 410, "y": 655 } },
    "provenanceNote": "Chin shadow painted for technique-catalog trial.",
    "intent": {
      "kind": "add", "drawableId": "draw_chin_shadow", "displayName": "Chin shadow", "parentPartId": "part_face",
      "insertion": { "position": "after", "sibling": { "kind": "drawable", "drawableId": "draw_neck" } },
      "rigControlIds": ["rig_head_rotation"], "maskBindings": [], "runtimeVisibility": true, "defaultOpacity": 1
    }
  }
}
```

- `insertion` is `first`, `last`, or `before` / `after` a sibling. The sibling is `{ "kind": "drawable", "drawableId": ... }` or `{ "kind": "part", "partId": ... }` and must be a direct child of `parentPartId`.
- `rigControlIds` names at most one deformer that the new drawable follows. The part hierarchy does not decide motion.
- A mask binding is `{ "maskRelationId": ..., "role": "target" | "maskSource" }`.

The operation creates these, all derived from one ID seed:

- the drawable
- an auto-grid mesh over the placed image area
- its position in the part and in the draw order
- the rig binding and mask bindings
- a source asset, layer, provenance and rights record (`needs_review`, `redistributionAllowed=false`)
- a texture entry with its size and inset

Replace a drawable's image, keeping its drawable ID:

```json
{
  "operationType": "replaceDrawableImage",
  "payload": {
    "image": { "imagePath": "C:/work/materials/eye-v2.png", "rgbaSha256": "<64 hex>", "width": 68, "height": 28 },
    "placement": { "from": "source-image-pixel-edge-v1", "to": "rest-stage-canvas-y-down-v1", "scale": 1, "translation": { "x": 126, "y": 130 } },
    "provenanceNote": "Repainted eye.",
    "intent": {
      "kind": "replace", "drawableId": "draw_eye", "preserveLogicalDrawableId": true,
      "geometryReset": { "scope": "target-direct-geometry-keyforms", "keyformSetIds": ["keyset_mesh_mesh_eye_vertices_param_eye_open"] },
      "preserveExistingDeformers": true, "sharedControlPolicy": "reject-shared-control-key-parameter-deletion"
    }
  }
}
```

The drawable keeps its ID and mesh ID. The mesh is rebuilt over the new placement. Other envelope fields are as in the add example.

`geometryReset.keyformSetIds` must list exactly the drawable's direct geometry keys. These are vertex keys on its mesh, and `vertices` keys on the drawable. Those keys are deleted. Every other key, deformer and parameter stays. The operation is rejected in these cases:

- The list differs from the actual direct geometry keys (`geometryResetMismatch`).
- A listed key also moves another drawable (`sharedKeyformReset`).
- The mesh is shared with another drawable (`sharedMeshReset`).

There is no automatic migration of old keys. Re-key the new mesh with ordinary operations.

### What the host does on dry-run and on commit

On both calls, before the operation runs, the host does the following:

1. It decides the operationId: the request's `operationId`, or the derived one if omitted.
2. It reads and checks the PNG as described in Shared values.
3. It registers the RGBA bytes in a separate copy of the session.

The operation then runs on that copy. A dry-run, a rejection or a failure discards the copy, so no image bytes are left in the session or the package. Only a successful commit replaces the session and saves it, writing the JSON files and the new texture file. If the image changes between dry-run and commit, the commit reads it again and is rejected.

Image problems reject the operation before it runs. Their check IDs are `operation.<operationType>.<code>`:

| Code | Meaning |
| --- | --- |
| `imageUnreadable` | The file cannot be read, for example because the path does not exist. |
| `invalidPng`, `unsupportedColorProfile`, `animatedPng`, `emptyAlpha` | The PNG is not accepted. |
| `imageDimensionsMismatch` | The decoded size differs from `width` / `height`. |
| `contentInsetUnsupported` | `contentInset` is not all zero. |
| `imageDigestMismatch` | The RGBA SHA-256 differs from `rgbaSha256`. |
| `idCollision` | The operationId was already used (see below). |

The operation log stores the payload: the image path and hash, never the pixels.

### ID seed and operationId reuse

Every ID the operation creates comes from the seed `material_<operationId without op_>`:

- `src_<seed>`, `layer_<seed>`, `tex_<seed>`, `prov_<seed>`, `mesh_<seed>` (add only), `bin_<seed>`, `preview_<seed>`
- the texture file `assets/textures/<seed>.rgba`

If `operationId` is omitted, it is derived from these four parts: the operation type, the drawable ID, `r<basePackageRevision>`, and the first 16 hex digits of `rgbaSha256`. For example: `op_add_drawable_from_image_chin_shadow_r2152_<16 hex>`. The dry-run result reports it. An approved dry-run is bound to that operationId, so put it explicitly in the commit's operation.

Running the same operationId again on a package where it was already committed is rejected as `idCollision`. Existing package bytes are never overwritten. The same rejection applies when a file the package JSON does not reference already sits at `assets/textures/<seed>.rgba` with different content. A file with identical content is accepted. To add or replace again, use a new operationId, or a new `basePackageRevision` when the ID is derived.

These two operations are not in the AI proposal operation catalog. Proposals are dry-run on a path without the host's PNG intake, so they would always be rejected with `imageBytesMissing`. The catalog also declares PNG decoding and local disk access out of scope.

## Not covered

- Texture files and entries that a replacement leaves unused are not cleaned up.
- Padded images (nonzero `contentInset`) are rejected.
- Atlas source signatures are not refreshed to hide material changes. An atlas preview made before an add or replace becomes stale and must be rebuilt through the atlas workflow.
