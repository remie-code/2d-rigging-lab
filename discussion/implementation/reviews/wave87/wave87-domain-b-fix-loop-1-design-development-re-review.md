# Wave87 Domain B Fix Loop 1 Design / Development Compliance Re-review

## Verdict

pass

No blocking findings.

The previous Design / Development escalation is resolved: user-facing `Apply Atlas` now reaches the package mutation through Operation Core async commit, not through a direct editor-session / Domain A mutation path.

## Scope Reviewed

- Review lane: Design / Development Compliance re-review for Wave87 Domain B Fix Loop 1.
- Reviewed from basis documents, source, tests, and local guard output, not only from the implementation report.
- Changed/new source inspected directly:
  - `packages/operation-core/src/operation-type.ts`
  - `packages/operation-core/src/operation-payload.ts`
  - `packages/operation-core/src/operation-registry.ts`
  - `packages/operation-core/src/operation-ids.ts`
  - `packages/operation-core/src/operation-core.ts`
  - `packages/operation-core/src/lifecycle/commit.ts`
  - `packages/operation-core/src/lifecycle/dry-run.ts`
  - `packages/operation-core/src/payloads/texture-atlas.ts`
  - `packages/operation-core/src/operations/apply-texture-atlas-preview.ts`
  - `packages/operation-core/src/operations/apply-texture-atlas-preview.test.ts`
  - `packages/operation-core/src/index.ts`
  - `apps/editor/src/features/editor-session/model/texture-atlas-session-command.ts`
  - `apps/editor/src/features/editor-session/editor-session-context.tsx`
  - `apps/editor/src/workspace/authoring-workspace.tsx`
  - `apps/editor/src/workspace/atlas/atlas-task-projection.ts`
  - `apps/editor/src/workspace/atlas/texture-atlas-task-screen.tsx`
  - `apps/editor/src/workspace/atlas/texture-atlas-task-screen.test.ts`
  - `packages/authoring-core/src/texture-atlas-packing.ts`

## Findings

| Severity | Finding | Evidence | Recommendation |
|---|---|---|---|
| none / resolved | The previous blocking issue is fixed. The GUI-facing Apply path now constructs an `applyTextureAtlasPreview` operation request and calls `commitOperationAsync()` on a cloned session. The provider only records editor history after that operation-backed commit succeeds and rejects an async race if the current editor session changed. | `apps/editor/src/features/editor-session/model/texture-atlas-session-command.ts:46`, `apps/editor/src/features/editor-session/model/texture-atlas-session-command.ts:48`, `apps/editor/src/features/editor-session/model/texture-atlas-session-command.ts:54`, `apps/editor/src/features/editor-session/model/texture-atlas-session-command.ts:57`, `apps/editor/src/features/editor-session/editor-session-context.tsx:790`, `apps/editor/src/features/editor-session/editor-session-context.tsx:793`, `apps/editor/src/features/editor-session/editor-session-context.tsx:804`, `apps/editor/src/features/editor-session/editor-session-context.tsx:814` | Proceed. Keep future GUI package mutations on Operation Core paths. |
| none | Async Operation Core lifecycle is narrow and coherent with the existing sync lifecycle. Async hooks are optional on `OperationHandler`; `dryRunOperationAsync()` / `commitOperationAsync()` use the same precondition, handler lookup, package revision, evidence provider, and log-entry flow as sync lifecycle, with sync fallback for existing handlers. The atlas handler explicitly rejects sync calls with `operation.applyTextureAtlasPreview.asyncLifecycleRequired`, so it does not silently apply through the wrong lifecycle. | `packages/operation-core/src/operation-registry.ts:59`, `packages/operation-core/src/operation-registry.ts:66`, `packages/operation-core/src/operation-registry.ts:76`, `packages/operation-core/src/operation-core.ts:18`, `packages/operation-core/src/operation-core.ts:21`, `packages/operation-core/src/operation-core.ts:23`, `packages/operation-core/src/lifecycle/commit.ts:108`, `packages/operation-core/src/lifecycle/commit.ts:140`, `packages/operation-core/src/lifecycle/commit.ts:152`, `packages/operation-core/src/lifecycle/commit.ts:165`, `packages/operation-core/src/lifecycle/dry-run.ts:66`, `packages/operation-core/src/lifecycle/dry-run.ts:90`, `packages/operation-core/src/operations/apply-texture-atlas-preview.ts:45`, `packages/operation-core/src/operations/apply-texture-atlas-preview.ts:54`, `packages/operation-core/src/operations/apply-texture-atlas-preview.ts:193` | Proceed. |
| none | Operation payload/log avoids raw binary blobs and remains reviewable. The payload carries settings, hidden part ids, expected layout summary, and locked target ids only; generated/source atlas bytes are not payload fields. Tests assert the operation log payload does not contain `textureBytes` or `atlasBytes`. | `packages/operation-core/src/payloads/texture-atlas.ts:10`, `packages/operation-core/src/payloads/texture-atlas.ts:11`, `packages/operation-core/src/payloads/texture-atlas.ts:12`, `packages/operation-core/src/payloads/texture-atlas.ts:13`, `packages/operation-core/src/payloads/texture-atlas.ts:14`, `packages/operation-core/src/operations/apply-texture-atlas-preview.test.ts:93`, `packages/operation-core/src/operations/apply-texture-atlas-preview.test.ts:95`, `packages/operation-core/src/operations/apply-texture-atlas-preview.test.ts:96` | Proceed. The expected layout summary may grow for large models; keep that as reviewable metadata, not bytes. |
| none | Operation result/model diff/log evidence is meaningful for the atlas apply surface. The handler recreates the preview from current session/settings/hidden ids, rejects not-ready or mismatched layouts, then records model-diff fields for generated atlas texture entry, layout summary, generated binary metadata, drawable texture refs, mesh UVs, and mesh topology revisions. Tests assert generated texture/layout/binary refs, pool exclusion, UV changes, topology revisions, and changed diff paths. | Recreate/reject: `packages/operation-core/src/operations/apply-texture-atlas-preview.ts:100`, `packages/operation-core/src/operations/apply-texture-atlas-preview.ts:110`, `packages/operation-core/src/operations/apply-texture-atlas-preview.ts:129`; apply: `packages/operation-core/src/operations/apply-texture-atlas-preview.ts:157`; diff fields: `packages/operation-core/src/operations/apply-texture-atlas-preview.ts:253`, `packages/operation-core/src/operations/apply-texture-atlas-preview.ts:256`, `packages/operation-core/src/operations/apply-texture-atlas-preview.ts:263`, `packages/operation-core/src/operations/apply-texture-atlas-preview.ts:273`, `packages/operation-core/src/operations/apply-texture-atlas-preview.ts:294`, `packages/operation-core/src/operations/apply-texture-atlas-preview.ts:304`; tests: `packages/operation-core/src/operations/apply-texture-atlas-preview.test.ts:80`, `packages/operation-core/src/operations/apply-texture-atlas-preview.test.ts:101`, `packages/operation-core/src/operations/apply-texture-atlas-preview.test.ts:120`, `packages/operation-core/src/operations/apply-texture-atlas-preview.test.ts:129`, `packages/operation-core/src/operations/apply-texture-atlas-preview.test.ts:132`, `packages/operation-core/src/operations/apply-texture-atlas-preview.test.ts:147` | Proceed. |
| none | Actual image preview now uses existing raw RGBA page bytes and browser canvas painting without new dependencies or renderer rewrite. Projection derives `rgbaBytes` from Domain A `createTextureAtlasPageRgbaBytes()`, and the screen paints it with `ImageData`/`putImageData` behind placement overlays. | `apps/editor/src/workspace/atlas/atlas-task-projection.ts:338`, `apps/editor/src/workspace/atlas/atlas-task-projection.ts:343`, `apps/editor/src/workspace/atlas/atlas-task-projection.ts:346`, `apps/editor/src/workspace/atlas/texture-atlas-task-screen.tsx:235`, `apps/editor/src/workspace/atlas/texture-atlas-task-screen.tsx:242`, `apps/editor/src/workspace/atlas/texture-atlas-task-screen.tsx:243`, `apps/editor/src/workspace/atlas/texture-atlas-task-screen.test.ts:207`, `apps/editor/src/workspace/atlas/texture-atlas-task-screen.test.ts:212`, `apps/editor/src/workspace/atlas/texture-atlas-task-screen.test.ts:278` | Proceed. |
| none | Accepted UI behavior is preserved. Atlas still has a dedicated route, suppresses Parameter Bar, has Back, shows summary/settings/lists, keeps hidden bound drawables included, excludes Drawable Pool, uses Domain A selection/preview, and disables Apply when the preview is missing/stale/failed. | Route/suppression: `apps/editor/src/workspace/authoring-workspace.tsx:38`, `apps/editor/src/workspace/authoring-workspace.tsx:44`, `apps/editor/src/workspace/authoring-workspace.tsx:48`, `apps/editor/src/workspace/authoring-workspace.tsx:91`; Domain A source-of-truth/stale/canApply: `apps/editor/src/workspace/atlas/atlas-task-projection.ts:119`, `apps/editor/src/workspace/atlas/atlas-task-projection.ts:123`, `apps/editor/src/workspace/atlas/atlas-task-projection.ts:150`, `apps/editor/src/workspace/atlas/atlas-task-projection.ts:186`; UI actions: `apps/editor/src/workspace/atlas/texture-atlas-task-screen.tsx:65`, `apps/editor/src/workspace/atlas/texture-atlas-task-screen.tsx:76`, `apps/editor/src/workspace/atlas/texture-atlas-task-screen.tsx:137`; tests: `apps/editor/src/workspace/atlas/texture-atlas-task-screen.test.ts:160`, `apps/editor/src/workspace/atlas/texture-atlas-task-screen.test.ts:167`, `apps/editor/src/workspace/atlas/texture-atlas-task-screen.test.ts:172`, `apps/editor/src/workspace/atlas/texture-atlas-task-screen.test.ts:228`, `apps/editor/src/workspace/atlas/texture-atlas-task-screen.test.ts:323`, `apps/editor/src/workspace/atlas/texture-atlas-task-screen.test.ts:342`, `apps/editor/src/workspace/atlas/texture-atlas-task-screen.test.ts:357`, `apps/editor/src/workspace/atlas/texture-atlas-task-screen.test.ts:371` | Proceed. |
| none | Source organization, dependency policy, schema/id conventions, and forbidden scope are compliant for this fix loop. New operation files are focused; `index.ts` remains barrel-only; no package manifest/lockfile changes were present; source/dependency guards passed; no Cubism, workspace export, archive/filesystem, camera/tracking, manual placement, or multi-page implementation was found in the reviewed fix-loop files. | Source organization guard passed. Dependency guard passed. `git diff --check -- <reviewed files>` passed with CRLF normalization warnings only. `git diff -- package.json pnpm-lock.yaml apps/editor/package.json packages/operation-core/package.json packages/authoring-core/package.json` was empty. `rg` forbidden-scope search over reviewed files returned no matches. `packages/operation-core/src/index.ts:1` through `packages/operation-core/src/index.ts:65` are export-only. Operation id is machine-readable `applyTextureAtlasPreview` at `packages/operation-core/src/operation-type.ts:44`; generated default id token uses sanitized lower tokens at `packages/operation-core/src/operation-ids.ts:210`. | Proceed. |

## Design / Development Compliance Notes

### Operation Boundary

Repository facts:

- `applyTextureAtlasPreview` is now a first-class operation type and registry entry.
- The editor-session command helper creates an Operation Core request with actor `human`, surface `gui`, `dryRun: false`, base package revision, operation type, and atlas payload.
- The operation handler recreates the preview from current package state and rejects mismatched layout/state before mutation.
- Sync lifecycle calls reject instead of silently applying an async digest-dependent operation.

Review judgment:

- This satisfies the prior escalation's requirement for Operation Core routing or accepted operation-layer semantics.
- The async additions are narrow. They add optional lifecycle methods rather than changing the synchronous handler contract for every existing operation.

### Payload / Evidence Boundary

Repository facts:

- Operation payload contains layout/settings/ids, not `Uint8Array` bytes.
- UI projection holds in-memory `rgbaBytes` for preview display, but that is not part of the operation payload/log.
- Operation diff contains generated atlas texture entry, layout summary, binary reference metadata, drawable texture refs, mesh UVs, and topology revision fields.

Review judgment:

- Evidence is reviewable and covers the atlas mutation surface required by Wave87 Domain B Fix Loop 1.
- The payload's expected layout summary is larger than a compact preview identity, but it is structured metadata and is currently useful for stale-layout rejection.

### UI Behavior

Repository facts:

- The dedicated Atlas route still renders `TextureAtlasTaskScreen`.
- The screen still uses Domain A `selectTextureAtlasTargets()` and `createTextureAtlasPreview()` from projection, not UI-local target selection or packing.
- Hidden included drawables and unbound Drawable Pool exclusion remain covered by focused tests.
- Apply remains disabled unless preview is ready, not stale, and has placements.
- Actual atlas image preview is rendered from generated raw RGBA bytes into a canvas layer.

Review judgment:

- Domain B Fix Loop 1 preserved the previously accepted UI behavior while replacing the Apply mutation boundary.

## Validation Considered

Review-side checks run:

- `node scripts/check-source-organization.mjs`: passed.
- `node scripts/check-dependencies.mjs`: passed.
- `git diff --check -- <reviewed fix-loop source/tests>`: passed; Git reported LF-to-CRLF working-copy warnings only.
- `git diff -- package.json pnpm-lock.yaml apps/editor/package.json packages/operation-core/package.json packages/authoring-core/package.json`: no dependency manifest/lockfile diff.
- Focused forbidden-scope `rg` across reviewed fix-loop files: no matches for Cubism/proprietary format terms, workspace/directory export, File System Access, archive/zip, camera/tracking, manual placement, or multi-page implementation.

Parent / Orch-Sylph validation considered:

- `pnpm.cmd exec vitest run packages/operation-core/src/operations/apply-texture-atlas-preview.test.ts apps/editor/src/workspace/atlas/texture-atlas-task-screen.test.ts packages/authoring-core/src/texture-atlas-mutations.test.ts`: passed outside sandbox after sandbox esbuild `EPERM`; 3 files, 20 tests.
- `pnpm.cmd typecheck`: passed.
- `node scripts/check-source-organization.mjs`: passed.
- `node scripts/check-dependencies.mjs`: passed.
- `git diff --check`: passed with CRLF normalization warnings only.

I did not rerun Vitest or typecheck in this re-review because the parent supplied successful outside-sandbox results and the known sandbox `esbuild` failure mode was already recorded.

## Residual Risks

- The operation result still uses the current Operation Core foundation where GUI-created operation logs are returned in the operation outcome and editor history records before/after session snapshots; this fix loop does not introduce a durable project-level operation-log store beyond the existing pattern. If final integration wants literal durable `operations/log.jsonl` semantics for GUI sessions, that is a broader Operation Core persistence decision.
- `runtimeDiff` and validation report refs remain empty for this operation unless an evidence provider is supplied, matching current Operation Core patterns. The atlas-specific `modelDiff` is meaningful, but final integration may decide whether atlas Apply needs a dedicated runtime/validation evidence provider before a stricter acceptance gate.
- Browser canvas painting is covered by render/projection tests, not by a Playwright screenshot or pixel inspection in this fix loop.
- The operation payload includes expected layout placement metadata. It avoids raw bytes, but very large models could produce large operation log entries.
- The narrow authoring-core re-export of package-format atlas layout schemas from `texture-atlas-packing.ts` is acceptable for this fix loop, but a later package-boundary pass may choose a more formal dependency direction.

## User-decision Points

- Whether `dryRunOperationAsync` / `commitOperationAsync` are the long-term Operation Core API names.
- Whether expected layout summary should remain in the operation payload long term, or be replaced by a smaller preview identity plus operation-side reconstruction checks.
- Whether future integration should persist GUI operation logs as package/export artifacts rather than only returning the operation log entry/outcome to the editor-session command layer.
- Workspace Directory Export remains outside Wave87 Domain B Fix Loop 1 and should stay deferred.
