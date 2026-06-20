# Runtime Export v0 Contract

> Status: Accepted direction / Draft module contract.

## 1. Purpose

Runtime Export v0 defines the execution artifact that leaves the Editor and is consumed by a future external runtime application.

The intended external runtime app receives camera capture / tracking values, maps those values to model parameters, evaluates keyforms and Dynamics, renders the character on a transparent background, and is captured by OBS or a similar compositor.

Runtime Export is not an authoring save format. It is an execution artifact for a prepared model.

## 2. Accepted Decisions

- Runtime Export v0 is directory-only.
- Runtime Export v0 uses raw RGBA atlas page bytes.
- Runtime Export v0 does not create a player or camera capture application.
- Runtime Export v0 does not re-import or verify exported bundles inside the Editor.
- Runtime Export v0 requires a committed, current Texture Atlas.
- Runtime Export v0 exports a materialized runtime graph with atlas-applied drawable texture references and UVs as the primary execution data.
- `runtime/atlas.json` may include atlas placement and source-signature metadata as reference/debug data, but external runtimes should not need to remap authoring UVs to render v0 bundles.
- Drawable Pool / unbound Drawables are not runtime targets and are simply excluded from export.
- Existing diagnostics warnings do not block export. The export task may say that Validate has warnings and route the user to Validate.

## 3. Non-Goals

Runtime Export v0 does not include:

- portable authoring JSON export;
- Workspace Save or Workspace Open;
- ZIP/archive packaging;
- PNG encoding;
- runtime/player application implementation;
- camera capture, tracker integration, calibration, smoothing, mirroring, or lost-tracking policy;
- OBS integration code;
- export bundle reload inside the Editor;
- source PSD/original bytes;
- editor state, selections, tool state, pan/zoom, overlays, drafts, previews, operation logs, or diagnostics payloads;
- material for unbound Drawable Pool Drawables.

## 4. Ownership Boundary

| Layer | Responsibility |
|---|---|
| `package-format` | Pure Runtime Export DTOs, schemas, file-set path rules, binary metadata shape. |
| `authoring-core` | Runtime Export assembly and preflight from `AuthoringSession`: atlas freshness, runtime graph conversion, target filtering, required binary collection. |
| `apps/editor` | User-facing Runtime Export task, export directory picker/write flow, status/error display. |
| `runtime-core` | Runtime evaluation semantics used by consumers; does not own package/file assembly or browser/file IO. |
| `operation-core` | Not involved. Export is not a mutating authoring operation. |

No Browser File System Access API types may leak into `package-format`, `authoring-core`, or `runtime-core`.

## 5. Artifact Shape

Runtime Export v0 writes a directory.

```text
<model>.runtime-export/
  runtime-export.json
  runtime/
    model.json
    atlas.json
  assets/
    textures/
      atlas_page_0.raw-rgba
```

### 5.1 `runtime-export.json`

Top-level manifest.

It should include:

- export schema version;
- model identity: package id, display name, source revision/hash if available;
- coordinate system and canvas/model bounds;
- graph path, atlas path, texture page paths;
- texture page dimensions, byte length, digest, media type, pixel format;
- required runtime capabilities;
- render assumptions such as transparent background, alpha mode, color space, texture filtering, and blend mode;
- created/exported timestamp if useful for user display.

### 5.2 `runtime/model.json`

Materialized runtime graph.

This is not the current authoring `PackageDocument` and not a raw `NormalizedRuntimeGraph` dump. It is a JSON-serializable runtime DTO prepared for rendering.

It should include:

- model/canvas coordinate information;
- parameters with id, display name, min, max, default, value source, and runtime role;
- runtime input manifest:
  - externally authored input parameters;
  - computed Dynamics output parameters;
  - parameters hidden from direct runtime controls if needed;
- keyforms required for included runtime targets;
- rig control / deformer hierarchy required for included runtime targets;
- Dynamics groups and solver contract data;
- included runtime Drawables only;
- meshes with atlas-applied UVs;
- draw order for included runtime Drawables;
- mask / clipping relations among included runtime Drawables;
- opacity and visibility defaults;
- texture page references that point to `assets/textures/*`.

### 5.3 `runtime/atlas.json`

Atlas reference metadata.

It should include:

- atlas source signature;
- atlas settings that affect export validity;
- page list. v0 writes one page but schema should allow future pages;
- placements for included runtime Drawables;
- original texture/mesh identifiers when helpful for debugging;
- source/content/padded rects and UV rects.

The primary runtime graph should already contain atlas-applied UVs. `runtime/atlas.json` is not the main render path.

### 5.4 `assets/textures/*.raw-rgba`

Texture page bytes.

v0 uses the existing raw RGBA representation:

- media type: `application/vnd.ai-native-live2d.raw-rgba; pixelFormat=rgba8` or the current package-format equivalent;
- bytes are uncompressed RGBA8;
- dimensions and byte length must match the manifest and binary reference;
- digest must match the manifest and binary reference.

PNG is out of scope until a dependency and export-contract decision is made.

## 6. Include / Exclude Rules

### Include

Include only runtime-ready data needed by the external runtime app:

- committed current atlas page bytes and metadata;
- runtime-bound, atlas-placed Drawables;
- meshes for included Drawables with atlas-applied UVs;
- draw order for included Drawables;
- mask/clipping relations whose sources and targets are included;
- rig controls / deformer hierarchy reachable from included Drawables;
- parameter definitions;
- keyforms used by included Drawables and rig controls;
- Dynamics groups and solver parameters;
- minimal export/version/digest/render metadata.

### Exclude

Exclude editor/workspace/authoring-only data:

- Workspace metadata such as `workspace.json`;
- editor state, selection, active tool, pan/zoom, search/filter state, Runtime Controls session overrides;
- mesh/deformer overlays, handles, wireframes, diagnostics payloads;
- draft mesh previews, atlas preview-only data, uncommitted task state;
- operation logs;
- source PSD bytes, source manifests, parser evidence, raw source profiles;
- thumbnails and preview images;
- Drawable Pool / unbound Drawables;
- any Drawable not covered by the current committed atlas.

## 7. Export Preflight

Runtime Export v0 must hard-block export when deterministic runtime execution cannot be produced.

Hard block when:

- no committed atlas exists;
- committed atlas is stale against the current runtime target source signature;
- atlas layout, page, texture entry, binary ref, or binary bytes are missing;
- atlas page dimensions, byte length, media type, or digest do not match;
- placement data is invalid;
- current packable runtime targets are not covered by placements;
- runtime graph materialization fails;
- required runtime binary bytes are unavailable.

Do not hard-block for:

- unbound Drawable Pool entries;
- general validation warnings that do not prevent deterministic runtime evaluation;
- Dynamics warnings that are already visible through Validate.

The user-facing export task may show a compact warning such as:

> Validate has warnings. Open Validate to inspect them before exporting.

## 8. Runtime Input Contract

Runtime Export v0 does not define camera/tracker mapping.

The bundle should expose enough parameter metadata for an external app to map tracker outputs later:

- parameter id and display name;
- min / max / default;
- value source or runtime role;
- whether direct external input is allowed;
- whether the parameter is computed by Dynamics and should be treated as read-only output.

The future camera runtime app owns:

- tracker channel names;
- face/body semantic mapping;
- unit conversion;
- mirroring;
- smoothing;
- calibration;
- confidence/lost tracking behavior;
- reset policy beyond the exported model's Dynamics reset semantics.

## 9. Renderer Contract Notes

Runtime Export v0 must make render assumptions explicit in the manifest or graph:

- coordinate system;
- transparent background expectation;
- raw RGBA pixel format;
- alpha mode;
- color space;
- texture filtering;
- blend mode;
- mask/clipping semantics;
- Dynamics fixed-step/reset defaults.

If any assumption is not yet proven by external runtime tests, mark it as an export contract field rather than relying on Editor implementation details.

## 10. Known Repository Facts

- Viewer Atlas Runtime currently remaps atlas texture/UV data in the Viewer projection layer.
- `runtime-core` is currently used mainly for parameter, keyform, and Dynamics evaluation; it is not a complete serialized render bundle by itself.
- Existing Texture Atlas artifacts contain page/layout/source-signature data suitable as export source material.
- Existing Workspace Save and Portable JSON export are different responsibilities and should not be reused as Runtime Export v0 output.

## 11. Open Implementation Questions

These are not product-blocking decisions, but implementation should answer them explicitly:

- exact JSON schema names and version strings;
- whether materialized runtime graph stores atlas UVs only, or stores both original and atlas UVs;
- exact alpha mode / color-space declaration used by the current renderer;
- exact mask/clipping render contract fields;
- whether export writes a minimal `README` or manifest note for external app authors.
