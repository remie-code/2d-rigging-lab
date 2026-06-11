# Wave59 Domain A Package / Data Contract Review

- verdict: `pass`
- target: `canvas-renderer-psd-drawable-display-v0`
- reviewer: Review-Sylph 2
- report path: `discussion/implementation/reviews/wave59/domain-a-package-data-contract-review.md`
- reviewed workspace state: current working tree, including modified and untracked Wave59 files

## Basis

- `discussion/implementation/orchestration/wave59-plan.md`
- `discussion/design/screen-design/components/canvas-preview.md`
- `discussion/development_convention/ux-backed-package-logic-authority.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/operation-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`
- `.github/skills/implementation-orchestration/SKILL.md`
- `discussion/implementation/waves/wave59/domain-a-gnome-report.md` as evidence only, not the sole source

## Findings

Blocking findings: none.

Non-blocking notes:

1. `CanvasBitmapCache` keys include binary asset id, dimensions, and byte length, but not digest (`apps/editor/src/workspace/canvas/canvas-renderer.ts:196`). Normal PSD import creates new ids and the panel clears the cache when `projection.contentKey` changes, but a future same-id/same-size byte replacement path should include digest or byte versioning.

2. `registerAuthoringSessionBinaryBytes` trusts the supplied `binaryAssetRef` metadata when creating the file entry and binary index entry (`packages/authoring-core/src/binary-byte-registration.ts:45`, `packages/authoring-core/src/binary-byte-registration.ts:55`). In this Wave59 flow, bytes and refs originate together in the browser adapter and Operation Core validates materialization ref digest/byteLength/media type before structural commit (`packages/operation-core/src/operations/import-psd-layer-materialization.ts:691`), so this is not blocking. If byte registration becomes a broader intake path, add direct digest/byteLength verification or make the validator boundary explicit.

## Contract Assessment

Pass. The source changes keep raw source PSD bytes out of durable package/session state while making derived, browser-renderable selected-layer RGBA bytes available after import commit:

- The planner records source PSD persistence as metadata-only (`apps/editor/src/features/psd-import/model/psd-import-planner.ts:120`, `apps/editor/src/features/psd-import/model/psd-import-planner.ts:145`, `apps/editor/src/features/psd-import/model/psd-import-planner.ts:176`).
- The adapter materializes selected-layer RGBA bytes with `layer.composite(false, false)` and creates package-local texture `binaryAssetRef` metadata under `assets/textures/psd/...raw-rgba` (`apps/editor/src/editor-workflow/browser-psd-parser-adapter.ts:275`, `apps/editor/src/editor-workflow/browser-psd-parser-adapter.ts:280`).
- The import plan carries those bytes only as transient `materializedLayerBytes` (`apps/editor/src/editor-workflow/browser-psd-parser-adapter.ts:187`, `apps/editor/src/features/psd-import/model/psd-import-types.ts:33`, `apps/editor/src/features/psd-import/model/psd-import-planner.ts:199`).
- Commit uses Operation Core for source and structural mutations (`apps/editor/src/features/psd-import/model/psd-import-commit.ts:34`, `apps/editor/src/features/psd-import/model/psd-import-commit.ts:49`), then registers the derived texture bytes into the current authoring session binary asset path (`apps/editor/src/features/psd-import/model/psd-import-commit.ts:85`, `apps/editor/src/features/psd-import/model/psd-import-commit.ts:87`).

PSD opacity is preserved vertically rather than patched in the GUI:

- Adapter/planner preserve layer `opacityInSource` (`apps/editor/src/editor-workflow/browser-psd-parser-adapter.ts:226`, `apps/editor/src/features/psd-import/model/psd-import-planner.ts:325`).
- Structural scaffold checks planned/approved/source/profile opacity consistency (`packages/operation-core/src/operations/import-psd-structural-scaffold.ts:1200`, `packages/operation-core/src/operations/import-psd-structural-scaffold.ts:1256`).
- `importPsdLayerMaterialization` sets drawable `defaultOpacity` from the source layer with clamping (`packages/operation-core/src/operations/import-psd-layer-materialization.ts:277`, `packages/operation-core/src/operations/import-psd-layer-materialization.ts:1063`).
- Focused package test asserts the committed drawable opacity is `0.42` (`packages/operation-core/src/operations/import-psd-layer-materialization.test.ts:79`).

Canvas projection and renderer derive from session/package data, not DOM/debug text:

- Projection reads texture binary refs, session binary files, draw order, runtime visibility, opacity, and masks from `AuthoringSession` (`apps/editor/src/workspace/canvas/canvas-projection.ts:83`, `apps/editor/src/workspace/canvas/canvas-projection.ts:87`, `apps/editor/src/workspace/canvas/canvas-projection.ts:129`, `apps/editor/src/workspace/canvas/canvas-projection.ts:130`, `apps/editor/src/workspace/canvas/canvas-projection.ts:133`, `apps/editor/src/workspace/canvas/canvas-projection.ts:162`).
- Renderer skips non-visible/non-renderable drawables, draws from `renderBytes`, applies opacity/isolate alpha, and uses the same projection for hit testing (`apps/editor/src/workspace/canvas/canvas-renderer.ts:87`, `apps/editor/src/workspace/canvas/canvas-renderer.ts:211`, `apps/editor/src/workspace/canvas/canvas-renderer.ts:226`, `apps/editor/src/workspace/canvas/canvas-projection.ts:174`).
- Draw order and hit test are deterministic through `stableOrder` projection and reverse topmost hit walk (`apps/editor/src/workspace/canvas/canvas-projection.ts:87`, `apps/editor/src/workspace/canvas/canvas-projection.ts:140`, `apps/editor/src/workspace/canvas/canvas-projection.ts:174`, `apps/editor/src/workspace/canvas/canvas-projection.ts:418`).

Schema/evidence surfaces remain coherent where touched:

- Package-format source manifest already allows PSD profile materialization evidence and optional materialization `binaryAssetRef` (`packages/package-format/src/source-manifest.ts:267`, `packages/package-format/src/source-manifest.ts:289`).
- Operation evidence records `sourcePsdBytePersistence: "metadataOnlyNoRawBytes"` and `materializedLayerBytePersistence: "binaryAssetRefOnlyNoInlineBytes"` (`packages/operation-core/src/psd-layer-materialization-operation-evidence.ts:65`, `packages/operation-core/src/psd-layer-materialization-operation-evidence.ts:67`, `packages/operation-core/src/psd-layer-materialization-operation-evidence.ts:123`).

## Clipping Status Assessment

Pass, with a real limitation.

Existing model mask/clipping relation support is present and renderer-side support is not faked:

- Package model has `MaskRelationSchema` with mask and target drawable ids (`packages/package-format/src/model-files.ts:255`).
- Operation Core has `setMaskRelation` and validator/runtime evidence uses `semanticClipping` (`packages/operation-core/src/operations/set-mask-relation.ts:32`, `packages/runtime-core/src/mask-relation-evidence.ts:10`, `packages/validator-core/src/validators/mask-composition.ts:228`).
- Canvas projection maps enabled `session.graph.masks` to target `maskSourceDrawableIds` (`apps/editor/src/workspace/canvas/canvas-projection.ts:136`, `apps/editor/src/workspace/canvas/canvas-projection.ts:162`, `apps/editor/src/workspace/canvas/canvas-projection.ts:402`).
- Renderer applies existing mask sources with `destination-in` and skips a masked target when all mask sources are absent (`apps/editor/src/workspace/canvas/canvas-renderer.ts:91`, `apps/editor/src/workspace/canvas/canvas-renderer.ts:96`, `apps/editor/src/workspace/canvas/canvas-renderer.ts:103`, `apps/editor/src/workspace/canvas/canvas-renderer.ts:182`).
- Projection test covers mask relation projection (`apps/editor/src/workspace/canvas/canvas-projection.test.ts:45`, `apps/editor/src/workspace/canvas/canvas-projection.test.ts:67`).

PSD clipping extraction is not implemented and is not claimed. I checked the installed `@webtoon/psd@0.4.0` type surface: root `index.d.ts` exports `Psd` and `Group`/`Layer` types only (`node_modules/@webtoon/psd/dist/index.d.ts:1`, `node_modules/@webtoon/psd/dist/index.d.ts:2`); `Layer.d.ts` exposes opacity, masks, hidden state, and additional properties but no clipping getter (`node_modules/@webtoon/psd/dist/classes/Layer.d.ts:22`, `node_modules/@webtoon/psd/dist/classes/Layer.d.ts:27`, `node_modules/@webtoon/psd/dist/classes/Layer.d.ts:29`). Internal section types contain `LayerProperties.clippingMask`, but access would require the private `layerFrame` member (`node_modules/@webtoon/psd/dist/classes/Layer.d.ts:11`, `node_modules/@webtoon/psd/dist/sections/LayerAndMaskInformation/interfaces.d.ts:42`). Given the adapter's `privateShapePolicy: "parser-private-shape-excluded-v1"` (`apps/editor/src/editor-workflow/browser-psd-parser-adapter.ts:90`, `apps/editor/src/editor-workflow/browser-psd-parser-adapter.ts:179`), deferring PSD clipping extraction is truthful and bounded.

## Dependency / Persistence / Privacy

Pass.

- No dependency manifests or lockfiles are changed in the current diff (`git diff --name-only` shows no `package.json`, `pnpm-lock.yaml`, or workspace config changes).
- The renderer uses Canvas 2D and existing dependencies; no Pixi/Konva/Three/WebGL or parser dependency was added.
- Source PSD evidence remains metadata-only; derived selected-layer bytes are package-local texture bytes, not durable raw source PSD bytes.

## Verification Performed

- Read basis docs, Gnome report, current review artifact, target source files, untracked canvas files, package/schema/evidence files, and installed `@webtoon/psd` type files.
- Inspected `git status --short -uall`, `git diff --stat`, `git diff --name-only`, and target `git diff`.
- Ran `git diff --check -- apps packages discussion`: pass, with CRLF normalization warnings only.
- Ran `pnpm.cmd exec vitest run apps/editor/src/workspace/canvas/canvas-projection.test.ts packages/operation-core/src/operations/import-psd-layer-materialization.test.ts`: sandbox attempt failed with esbuild `spawn EPERM`; approved rerun passed, 2 files / 9 tests.

## Residual Risks / Decision Points For Orch-Sylph

- PSD clipping extraction remains a parser/product boundary decision. A future implementation should either use an approved public parser API exposing layer clipping or explicitly approve private-shape access/new dependency/mapping semantics.
- If binary byte registration becomes a general package mutation/intake contract, promote it into an explicit Operation Core/evidence path or add direct digest verification at registration time.
- Cache invalidation should include digest/version if future workflows support same-id byte replacement.

## Verdict Rationale

Wave59 Domain A satisfies the package/data contract lane: runtime-renderable derived RGBA bytes are available after PSD import commit without durable raw PSD byte persistence, PSD opacity flows through Operation Core into drawable display state, projection/render/hit testing derive from session data, existing mask relations are rendered, and PSD clipping extraction is explicitly bounded instead of faked.
