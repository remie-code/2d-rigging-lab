# Wave90 Domain A Spec Compliance Review

Role: Review-Sylph, Spec Compliance Review lane
Domain: `wave90-workspace-persistence-core`
Verdict: `pass`
Date: 2026-06-20

## Basis Reviewed

- `discussion/implementation/orchestration/wave90-plan.md`
- `discussion/design/screen-design/screens/workspace-save-and-navigation.md`
- `discussion/design/screen-design/screens/authoring-workspace.md`
- `discussion/design/screen-design/screens/project-storage-task.md`
- `discussion/design/screen-design/components/toolbox.md`
- `discussion/implementation/waves/wave88/wave88-final-integration-report.md`
- `discussion/implementation/waves/wave89/wave89-final-integration-report.md`

## Files Reviewed

- `packages/package-format/src/workspace-metadata.ts`
- `packages/package-format/src/workspace-file-set.ts`
- `packages/package-format/src/workspace-save-plan.ts`
- `packages/package-format/src/workspace-file-set.test.ts`
- `packages/package-format/src/workspace-save-plan.test.ts`
- `packages/package-format/src/index.ts`
- `packages/authoring-core/src/workspace-save.ts`
- `packages/authoring-core/src/workspace-save.test.ts`
- `packages/authoring-core/src/index.ts`

I also read supporting existing helpers used by the changed files:

- `packages/package-format/src/package-file-paths.ts`
- `packages/package-format/src/package-file-set.ts`
- `packages/package-format/src/package-binary-file-set.ts`
- `packages/package-format/src/binary-asset.ts`
- `packages/package-format/src/texture-atlas.ts`
- `packages/authoring-core/src/binary-byte-registration.ts`
- `packages/authoring-core/src/texture-atlas-mutations.ts`

## Findings

Blocking findings: none.

Non-blocking spec deviations: none found.

## Compliance Notes

### Workspace Save concept separation

Pass. Domain A adds directory workspace primitives under package-format / authoring-core and does not make Portable JSON the primary save path.

- `workspace.json` is introduced as `WORKSPACE_METADATA_PATH`, not a portable bundle: `packages/package-format/src/workspace-metadata.ts:8`.
- `createWorkspaceSavePlan()` returns workspace text file-set materialization plus binary skip/write/error decisions: `packages/package-format/src/workspace-save-plan.ts:155`.
- No new Portable JSON writer/importer path is introduced in the changed Domain A files.

### `workspace.json` entrypoint metadata only

Pass. `workspace.json` is strict metadata with schema/kind, package entrypoint, package id/display name, and timestamps only.

- Metadata schema: `packages/package-format/src/workspace-metadata.ts:10`.
- Entrypoint is `manifest.json` via `PACKAGE_MANIFEST_PATH`: `packages/package-format/src/workspace-metadata.ts:13`.
- Metadata is created from the package manifest, not from a second aggregate project body: `packages/package-format/src/workspace-metadata.ts:26`.
- Workspace serialization writes `workspace.json` beside the existing package file-set: `packages/package-format/src/workspace-file-set.ts:53`.

No `project.json` or second authoritative aggregate was found in the changed Domain A files.

### Existing PackageDocument file-set reuse

Pass. Workspace text materialization reuses the existing package file-set serializer/parser.

- Serialization calls `serializePackageDocumentToFileSet()`: `packages/package-format/src/workspace-file-set.ts:53`.
- Parsing delegates back to `parsePackageDocumentFromFileSet()` after excluding only workspace metadata / derived metadata: `packages/package-format/src/workspace-file-set.ts:72`.
- Save plan also exposes the existing package text file-set: `packages/package-format/src/workspace-save-plan.ts:155`.

### Forbidden persistence roots and non-goals

Pass. I found no Domain A source/test implementation of `assets/atlas/`, `binary/`, Runtime Export, temporary draft editing, Browser FSA APIs, or workspace operation log persistence.

- `operations/log.jsonl` is explicitly rejected as unsupported workspace derived metadata in a focused test: `packages/package-format/src/workspace-file-set.test.ts:102`.
- `rg` scan over changed Domain A files found no `FileSystemDirectoryHandle`, `showDirectoryPicker`, `assets/atlas/`, `binary/`, `project.json`, `Runtime Export`, or `temporary draft` usage. The only `operations/log.jsonl` hit was the negative test above.

### Browser API boundary

Pass. Domain A packages remain browser-API independent.

- The changed package-format and authoring-core files import package/core helpers only; no File System Access or DOM types appear.
- FSA adapter responsibilities remain deferred to Domain B per the Wave90 plan.

### Heavy binary skip/write/error policy

Pass. The save plan implements the required verified-skip, missing/mismatch-write, and session-mismatch-error behavior.

- Existing verified bytes return `skip`: `packages/package-format/src/workspace-save-plan.ts:201`.
- Missing/corrupt existing bytes require current session verification before write: `packages/package-format/src/workspace-save-plan.ts:224`.
- Session verification failure returns `error`: `packages/package-format/src/workspace-save-plan.ts:224`.
- Write reasons cover missing, asset id mismatch, byte length mismatch, digest mismatch, media type mismatch, and fallback verification mismatch: `packages/package-format/src/workspace-save-plan.ts:272`.
- Tests cover skip, missing write, digest/media rewrite, and session mismatch error: `packages/package-format/src/workspace-save-plan.test.ts:24`, `packages/package-format/src/workspace-save-plan.test.ts:40`, `packages/package-format/src/workspace-save-plan.test.ts:57`, `packages/package-format/src/workspace-save-plan.test.ts:98`.

### PSD source bytes exclusion

Pass. Source asset original binary refs are excluded from workspace binary candidates; PSD source originals receive an explicit exclusion reason.

- Source asset binary refs are pushed to `excluded`, not `candidates`: `packages/package-format/src/workspace-save-plan.ts:119`.
- PSD source refs receive `psd-source-original-excluded-v1`: `packages/package-format/src/workspace-save-plan.ts:127`.
- Texture binary refs are collected from `assets.textureAtlas.textures`: `packages/package-format/src/workspace-save-plan.ts:134`.
- Focused test verifies PSD source bytes are not collected while extracted layer texture bytes are written: `packages/package-format/src/workspace-save-plan.test.ts:116`.

### Generated atlas raw RGBA committed-only collection

Pass. Save-plan candidate collection is document-driven; session bytes alone do not create a candidate. Generated atlas bytes are collected only after the generated atlas texture entry is committed into `textureAtlas.textures`.

- Candidate collection only iterates `document.assets.textureAtlas?.textures`: `packages/package-format/src/workspace-save-plan.ts:134`.
- Texture atlas preview assets are schema-separated from committed texture entries in `TextureAtlasFileSchema`: `packages/package-format/src/texture-atlas.ts:171`.
- Apply Atlas commits a generated texture entry and registers bytes only after apply: `packages/authoring-core/src/texture-atlas-mutations.ts:151`, `packages/authoring-core/src/texture-atlas-mutations.ts:163`, `packages/authoring-core/src/texture-atlas-mutations.ts:174`.
- Focused test verifies uncommitted generated atlas session bytes produce no save decision, while committed texture entry bytes are collected: `packages/package-format/src/workspace-save-plan.test.ts:148`.

### Authoring-core adapter

Pass. The authoring adapter converts the session to a PackageDocument, passes current session binary file entries into package-format, and does not introduce UI/FSA concerns.

- Session to PackageDocument conversion: `packages/authoring-core/src/workspace-save.ts:31`.
- Current session binary entries are passed to `createWorkspaceSavePlan()`: `packages/authoring-core/src/workspace-save.ts:40`.
- Focused adapter test verifies a workspace text file-set with `workspace.json` and a write decision for missing texture bytes: `packages/authoring-core/src/workspace-save.test.ts:26`.

## Verification Performed

- Read the Wave90 plan and listed design/baseline documents directly.
- Reviewed all changed Domain A source/test files directly.
- Reviewed existing package path, package file-set, binary verification, texture atlas schema, and authoring binary registration helpers used by Domain A.
- Ran forbidden-term scan over changed Domain A files:
  - no Browser FSA / DOM API leaks;
  - no `project.json`;
  - no `assets/atlas/` or `binary/`;
  - no Runtime Export or temporary draft implementation;
  - only `operations/log.jsonl` occurrence was a negative test.
- Focused tests:
  - `pnpm.cmd exec vitest run packages/package-format/src/workspace-file-set.test.ts packages/package-format/src/workspace-save-plan.test.ts packages/authoring-core/src/workspace-save.test.ts`
  - sandbox attempt failed with known esbuild `spawn EPERM`;
  - escalated rerun passed: 3 files, 11 tests.
- Typecheck:
  - `pnpm.cmd typecheck`
  - passed.

## Remaining Risks

- Domain A materializes full workspace/package text file sets; it does not itself compute per-text-file dirty write decisions. This is acceptable for Domain A's primitive boundary, but Domain B must avoid treating text materialization as permission to rewrite verified heavy binaries.
- Domain A does not implement Browser File System Access write/read traversal; safe directory I/O, permission handling, unsupported fallback, and actual selective writes remain Domain B responsibilities.
- Optional `metadata/binary-asset-index.json` / `metadata/byte-intake-summaries.json` writers were not added. Parsing correctly treats them as derived/ignored if present, so this is not blocking.
- Full create/open/save workspace roundtrip with fake directory handles is outside Domain A and must be covered in Domain B.

## User-Decision Points

None blocking for Domain A.
