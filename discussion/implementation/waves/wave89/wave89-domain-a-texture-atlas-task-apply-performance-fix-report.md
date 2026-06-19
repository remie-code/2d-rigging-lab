# Wave89 Domain A Report: Texture Atlas Task / Apply Performance Fix

## Verdict / Status

pass

Wave89 Domain A removed the blocking Texture Atlas Task preview performance issue where settings/stale projection regenerated the full RGBA atlas image. Generate Preview now owns task-preview RGBA generation, stale settings keep the previous preview image visible while disabling Apply, and Apply remains Operation Core-backed and artifact-only while reducing avoidable duplicate guard/source-byte work.

Domain A is safe for Wave89 final integration.

## Basis Coverage Self-Report

Read and applied:

- `discussion/implementation/orchestration/wave89-plan.md`
- `discussion/implementation/orchestration/_map.md`
- `C:/Users/remie/.codex/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/operation-policy.md`
- `discussion/design/screen-design/screens/texture-atlas-task.md`
- `discussion/implementation/waves/wave87/wave87-final-integration-report.md`
- `discussion/implementation/waves/wave88/wave88-final-integration-report.md`
- `discussion/implementation/reviews/wave88/wave88-final-clean-integration-review.md`

Covered accepted decisions:

- Settings changes are metadata-only for task-preview RGBA generation.
- Stale preview remains visible and is not Apply-able as fresh.
- Generate Preview owns task-preview RGBA image generation.
- Apply remains Operation Core-backed and artifact-only.
- Apply reduces duplicate freshness/source-signature guard work after Operation Core validates the current recreated layout.
- Source texture byte clone and result byte copy were reduced where safe.
- No dependency, workerization, export, multi-page atlas, manual atlas editing, camera, mesh/deformer/dynamics, Viewer, or destructive authoring texture/UV work was added.

Deferred basis items:

- Viewer `Atlas Runtime` scope and Viewer `Original` performance guard are Domain B.
- Apply still generates final atlas artifact bytes inside the Operation Core-authorized commit. Domain A did not pass UI raw bytes through the operation payload, preserving the no-raw-payload and Operation Core authority boundary.
- Broader history structural sharing / binary-storage redesign remains out of scope.

## Current-State Confirmation

- `apps/editor/src/workspace/atlas/atlas-task-projection.ts` previously created a preview page during every projection by calling `createTextureAtlasPageRgbaBytes()` through `createPreviewPage(preview)`, including stale settings projections.
- `apps/editor/src/workspace/atlas/texture-atlas-task-screen.tsx` paints `projection.previewPage.image` through `ImageData` / `putImageData()`, so regenerating a new image object also retriggered canvas repaint work.
- `selectTextureAtlasTargets()` previously cloned source texture bytes with `new Uint8Array(binaryEntry.bytes)` for every packable target.
- Operation Core already recreated a current preview and rejected layout mismatch before mutation, but authoring-core `applyTextureAtlasPreview()` repeated target selection/source-signature guard work.
- Authoring-core Apply returned `atlasBytes: new Uint8Array(atlasBytes)`, adding an avoidable large result copy.

## Implementation Trace

### Texture Atlas Task Preview

- `TextureAtlasTaskPreviewState` now stores `previewPage`.
- `createTextureAtlasTaskPreviewState()` creates the preview page when Generate Preview runs.
- `createTextureAtlasTaskProjection()` reuses `input.previewState?.previewPage ?? null` instead of regenerating image bytes during projection.
- Stale state still compares the stored preview signature to current task inputs.
- Stale previews keep the previous image object/page visible, add the stale warning, and set `canApply` false.

Changed files:

- `apps/editor/src/workspace/atlas/atlas-task-projection.ts`
- `apps/editor/src/workspace/atlas/texture-atlas-task-screen.test.ts`

### Apply Computation

- `packages/operation-core/src/operations/apply-texture-atlas-preview.ts` now passes `freshnessValidation` to authoring-core only after the handler has recreated the current preview and verified the expected layout matches.
- `packages/authoring-core/src/texture-atlas-mutations.ts` skips its duplicate direct freshness guard only when that validated layout matches the ready preview layout, ignoring only `generatedByOperationId`.
- Direct authoring-core Apply without validation still recomputes target selection/source signature and rejects stale source bytes.
- Apply still generates final atlas bytes in authoring-core for the Operation Core commit and still keeps raw bytes out of the operation payload/log.
- The returned `atlasBytes` no longer performs an extra `new Uint8Array(atlasBytes)` copy.

Changed files:

- `packages/authoring-core/src/texture-atlas-mutations.ts`
- `packages/authoring-core/src/texture-atlas-mutations.test.ts`
- `packages/operation-core/src/operations/apply-texture-atlas-preview.ts`

### Source Byte Copy

- `selectTextureAtlasTargets()` now stores the session binary entry bytes reference for packable targets instead of cloning source bytes.
- Existing source-signature and direct Apply guard behavior still observe current bytes. A new direct Apply test mutates source bytes after preview and verifies stale rejection before mutation.

Changed file:

- `packages/authoring-core/src/texture-atlas-targets.ts`

## Review Loop

Implementation was delegated to Gnome and completed with verdict `done`.

Required independent review lanes were delegated to Review-Sylphs and all returned `pass`:

- [wave89-domain-a-spec-compliance-review.md](../../reviews/wave89/wave89-domain-a-spec-compliance-review.md): `pass`
- [wave89-domain-a-design-development-review.md](../../reviews/wave89/wave89-domain-a-design-development-review.md): `pass`
- [wave89-domain-a-test-adequacy-review.md](../../reviews/wave89/wave89-domain-a-test-adequacy-review.md): `pass`

No blocking findings were reported, so no fix loop was required.

## Changed Files

Source and tests:

- `apps/editor/src/workspace/atlas/atlas-task-projection.ts`
- `apps/editor/src/workspace/atlas/texture-atlas-task-screen.test.ts`
- `packages/authoring-core/src/texture-atlas-targets.ts`
- `packages/authoring-core/src/texture-atlas-mutations.ts`
- `packages/authoring-core/src/texture-atlas-mutations.test.ts`
- `packages/operation-core/src/operations/apply-texture-atlas-preview.ts`

Domain A reports/reviews/maps:

- `discussion/implementation/waves/wave89/wave89-domain-a-texture-atlas-task-apply-performance-fix-report.md`
- `discussion/implementation/waves/wave89/_map.md`
- `discussion/implementation/reviews/wave89/wave89-domain-a-spec-compliance-review.md`
- `discussion/implementation/reviews/wave89/wave89-domain-a-design-development-review.md`
- `discussion/implementation/reviews/wave89/wave89-domain-a-test-adequacy-review.md`
- `discussion/implementation/reviews/wave89/_map.md`

Pre-existing or concurrent non-Domain-A dirty files were not reverted. At Domain A closeout, concurrent Viewer files and some Domain B review artifacts were present in the worktree and remain outside this Domain A verdict.

## Verification Commands and Results

Implementation and review agents ran the focused verification set. Recorded outcomes:

- `pnpm.cmd exec vitest run apps/editor/src/workspace/atlas/texture-atlas-task-screen.test.ts packages/authoring-core/src/texture-atlas-mutations.test.ts packages/operation-core/src/operations/apply-texture-atlas-preview.test.ts`
  - sandbox attempts failed with known Vitest/esbuild `spawn EPERM`;
  - escalated reruns passed: 3 files, 23 tests.
- `pnpm.cmd typecheck`: passed.
- `node scripts/check-source-organization.mjs`: passed.
- `node scripts/check-dependencies.mjs`: passed.
- `git diff --check -- <Domain A files>`: passed with LF/CRLF working-copy warnings only.

## Must-not Compliance Evidence

- No `apps/editor/src/workspace/viewer/**` files were changed by Domain A.
- No package manifest or lockfile changes were made.
- No workerization, Workspace Directory Export, ZIP/archive export, File System Access API, multi-page atlas, manual atlas editor, camera capture, mesh generation, deformer, keyform, dynamics, import, or unrelated UI cleanup was added.
- Apply remains Operation Core-backed.
- Apply remains artifact-only:
  - no authoring `Drawable.textureId` rewrite;
  - no authoring `Mesh.uvs` rewrite;
  - no mesh topology revision rewrite;
  - source textures are retained.
- Operation payload/log tests continue to assert no raw `textureBytes` or `atlasBytes` in payloads.

## Residual Risks

- Task-local stale projection still performs target selection and a lightweight task signature so the target summary stays current. The removed blocking work is full RGBA atlas image generation and canvas image object replacement on stale/settings projection.
- The task-local signature uses sampled byte summarization for UI freshness; Operation Core remains the authoritative full source-signature guard before Apply.
- `TextureAtlasPreviewFreshnessValidation` is exported from authoring-core because the mutations module is part of the package export surface. Current production use is only Operation Core after current-session preview recreation and layout validation. Future callers should not use it without equivalent validation.
- Source byte reference reuse depends on the existing mutable authoring-session byte convention. The direct Apply stale-byte test covers mutation detection, but the code does not introduce byte immutability/freeze guarantees.
- Page size and edge extrusion settings share the same stale/reuse path as padding by source review; the focused no-regeneration test directly exercises padding.
- No browser pixel or Playwright canvas proof was added. Current proof is source dependency behavior, projection object identity, static markup, and focused tests.

## User-Decision Points

None blocking for Domain A.
