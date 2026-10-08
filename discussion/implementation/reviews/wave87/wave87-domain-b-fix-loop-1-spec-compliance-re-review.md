# Wave87 Domain B Fix Loop 1 Spec Compliance Re-review

Verdict: `pass`

対象: Wave87 Domain B Fix Loop 1, Operation-backed Apply and Atlas Image Preview.

## Scope Reviewed

Basis documents read:

- `discussion/implementation/orchestration/wave87-plan.md`
- `discussion/design/screen-design/screens/texture-atlas-task.md`
- `discussion/implementation/waves/wave87/wave87-domain-a-atlas-core-schema-apply-mutation-report.md`
- `discussion/implementation/reviews/wave87/wave87-domain-a-spec-compliance-review.md`
- `discussion/implementation/waves/wave87/wave87-domain-b-texture-atlas-task-ui-routing-preview-report.md`
- `discussion/implementation/reviews/wave87/wave87-domain-b-spec-compliance-review.md`
- `discussion/implementation/waves/wave87/wave87-domain-b-fix-loop-1-operation-backed-apply-image-preview-report.md`

Source/tests inspected directly:

- `apps/editor/src/workspace/authoring-workspace.tsx`
- `apps/editor/src/workspace/atlas/atlas-task-projection.ts`
- `apps/editor/src/workspace/atlas/texture-atlas-task-screen.tsx`
- `apps/editor/src/workspace/atlas/texture-atlas-task-screen.test.ts`
- `apps/editor/src/features/editor-session/model/texture-atlas-session-command.ts`
- `apps/editor/src/features/editor-session/editor-session-context.tsx` relevant atlas apply section
- `packages/operation-core/src/operations/apply-texture-atlas-preview.ts`
- `packages/operation-core/src/payloads/texture-atlas.ts`
- `packages/operation-core/src/operation-payload.ts`
- `packages/operation-core/src/operation-registry.ts`
- `packages/operation-core/src/operation-type.ts`
- `packages/operation-core/src/lifecycle/commit.ts`
- `packages/operation-core/src/lifecycle/dry-run.ts`
- `packages/operation-core/src/operation-core.ts`
- `packages/authoring-core/src/texture-atlas-binary.ts`
- `packages/authoring-core/src/texture-atlas-packing.ts`
- `packages/authoring-core/src/texture-atlas-targets.ts`
- `packages/authoring-core/src/texture-atlas-mutations.ts`
- `packages/authoring-core/src/texture-atlas-mutations.test.ts`

## Findings

Blocking findings: none.

The Fix Loop 1 implementation satisfies the accepted fix decisions. User-facing `Apply Atlas` is now operation-backed, the generated preview displays atlas image bytes behind rect overlays, and the previously accepted Domain B routing/summary/guard behavior remains intact.

## Compliance Evidence

| Oracle | Result | Evidence |
|---|---|---|
| Apply is represented through Operation Core / operation-layer semantics | pass | `applyTextureAtlasPreview` is in the Operation Core type/payload/registry path (`packages/operation-core/src/operation-type.ts:44`, `packages/operation-core/src/operation-payload.ts:123`, `packages/operation-core/src/operation-registry.ts:51`, `packages/operation-core/src/operation-registry.ts:133`). The editor command creates an operation request and calls `commitOperationAsync()` (`apps/editor/src/features/editor-session/model/texture-atlas-session-command.ts:46`, `apps/editor/src/features/editor-session/model/texture-atlas-session-command.ts:57`). |
| User-facing Apply no longer bypasses Operation Core | pass | The Atlas screen calls `useEditorSession().applyTextureAtlasPreview()` only after UI guards (`apps/editor/src/workspace/atlas/texture-atlas-task-screen.tsx:76`), the provider delegates to `commitTextureAtlasPreview()` (`apps/editor/src/features/editor-session/editor-session-context.tsx:790`), and that helper routes through Operation Core rather than directly calling Domain A mutation (`apps/editor/src/features/editor-session/model/texture-atlas-session-command.ts:47`, `apps/editor/src/features/editor-session/model/texture-atlas-session-command.ts:57`). |
| Domain A mutation remains pure/core while operation-backed action commits it | pass | Operation Core recreates the preview from current session/settings/hidden ids (`packages/operation-core/src/operations/apply-texture-atlas-preview.ts:100`), rejects not-ready or mismatched layout previews before mutation (`packages/operation-core/src/operations/apply-texture-atlas-preview.ts:110`, `packages/operation-core/src/operations/apply-texture-atlas-preview.ts:129`), then calls Domain A `applyTextureAtlasPreview()` with the operation id (`packages/operation-core/src/operations/apply-texture-atlas-preview.ts:157`). |
| Operation history/editor session update behavior remains coherent | pass | Async commit lifecycle appends an Operation Core log entry and increments package revision only after committed outcome (`packages/operation-core/src/lifecycle/commit.ts:142`, `packages/operation-core/src/lifecycle/commit.ts:152`, `packages/operation-core/src/lifecycle/commit.ts:165`). Editor session records one undo-history commit labeled `Apply Texture Atlas` after the operation-backed result is committed and rejects concurrent-session drift (`apps/editor/src/features/editor-session/editor-session-context.tsx:804`, `apps/editor/src/features/editor-session/editor-session-context.tsx:814`). Tests assert operation log/model diff evidence and generated operation ids (`packages/operation-core/src/operations/apply-texture-atlas-preview.test.ts:80`, `apps/editor/src/workspace/atlas/texture-atlas-task-screen.test.ts:286`). |
| Atlas Preview displays actual generated atlas artwork/image | pass | Projection calls `createTextureAtlasPageRgbaBytes(preview)` for ready previews and exposes image bytes/signature (`apps/editor/src/workspace/atlas/atlas-task-projection.ts:338`, `apps/editor/src/workspace/atlas/atlas-task-projection.ts:343`). The screen paints those bytes into a canvas with `ImageData` (`apps/editor/src/workspace/atlas/texture-atlas-task-screen.tsx:228`, `apps/editor/src/workspace/atlas/texture-atlas-task-screen.tsx:242`) and then renders placement overlays on top (`apps/editor/src/workspace/atlas/texture-atlas-task-screen.tsx:208`, `apps/editor/src/workspace/atlas/texture-atlas-task-screen.tsx:209`). |
| Actual preview uses existing texture-byte conventions and does not mutate before Apply | pass | Generated preview image bytes come from existing raw RGBA atlas byte generation (`packages/authoring-core/src/texture-atlas-binary.ts:15`, `packages/authoring-core/src/texture-atlas-binary.ts:20`). Preview projection creates bytes from preview data and returns new `Uint8Array` image data without session mutation (`apps/editor/src/workspace/atlas/atlas-task-projection.ts:325`, `packages/authoring-core/src/texture-atlas-binary.ts:28`). Apply mutation remains isolated to Domain A apply (`packages/authoring-core/src/texture-atlas-mutations.ts:71`). |
| Dedicated task routing and Back behavior remain | pass | `activeEntry === "atlas"` renders `TextureAtlasTaskScreen` and suppresses `ParameterBar` (`apps/editor/src/workspace/authoring-workspace.tsx:38`, `apps/editor/src/workspace/authoring-workspace.tsx:49`, `apps/editor/src/workspace/authoring-workspace.tsx:91`). Back calls `setActiveEntry("import")` without PSD import (`apps/editor/src/workspace/atlas/texture-atlas-task-screen.tsx:106`, `apps/editor/src/workspace/atlas/texture-atlas-task-screen.test.ts:357`). |
| Counts/lists, hidden included, and pool excluded behavior remain | pass | Projection summary/list rows still derive from Domain A target selection (`apps/editor/src/workspace/atlas/atlas-task-projection.ts:119`, `apps/editor/src/workspace/atlas/atlas-task-projection.ts:151`). Bound hidden drawables stay included and show `Currently hidden` (`packages/authoring-core/src/texture-atlas-targets.ts:119`, `apps/editor/src/workspace/atlas/atlas-task-projection.ts:259`); unbound drawables are excluded as `Unbound drawable in Drawable Pool` (`packages/authoring-core/src/texture-atlas-targets.ts:120`, `apps/editor/src/workspace/atlas/atlas-task-projection.ts:252`). Focused tests cover both (`apps/editor/src/workspace/atlas/texture-atlas-task-screen.test.ts:152`). |
| Generate / Apply / stale guard behavior remains | pass | Generate Preview creates Domain A preview state (`apps/editor/src/workspace/atlas/texture-atlas-task-screen.tsx:65`, `apps/editor/src/workspace/atlas/atlas-task-projection.ts:186`). Apply is enabled only for ready, non-stale previews with placements (`apps/editor/src/workspace/atlas/atlas-task-projection.ts:130`, `apps/editor/src/workspace/atlas/atlas-task-projection.ts:150`) and the handler returns early when guards fail (`apps/editor/src/workspace/atlas/texture-atlas-task-screen.tsx:76`). Operation Core also rejects stale layout mismatches (`packages/operation-core/src/operations/apply-texture-atlas-preview.ts:129`). |
| No UI-local target selection or packing duplication | pass | UI projection delegates target selection and preview generation to Domain A (`apps/editor/src/workspace/atlas/atlas-task-projection.ts:119`, `apps/editor/src/workspace/atlas/atlas-task-projection.ts:186`). Operation handler also recreates preview through Domain A before committing (`packages/operation-core/src/operations/apply-texture-atlas-preview.ts:100`). No independent UI packing algorithm was found. |
| Forbidden scope remains out | pass | Scoped source search found no Workspace Directory Export, File System Access, camera/capture, Cubism, `.moc3`, `.model3.json`, base64 embedding, or manual placement implementation in the reviewed Atlas/operation files. No new image library is used; the image preview uses browser canvas APIs only. |

## Tests And Validation Considered

Directly inspected tests show coverage for:

- Operation Core registry, async-only lifecycle, commit evidence/log entry, dry run non-mutation, stale layout rejection, failed preview recreation rejection (`packages/operation-core/src/operations/apply-texture-atlas-preview.test.ts:58`, `packages/operation-core/src/operations/apply-texture-atlas-preview.test.ts:63`, `packages/operation-core/src/operations/apply-texture-atlas-preview.test.ts:80`, `packages/operation-core/src/operations/apply-texture-atlas-preview.test.ts:161`, `packages/operation-core/src/operations/apply-texture-atlas-preview.test.ts:186`, `packages/operation-core/src/operations/apply-texture-atlas-preview.test.ts:209`).
- Atlas projection image bytes and pixel evidence, stale guards, Operation Core command helper, route/Back/Toolbox behavior (`apps/editor/src/workspace/atlas/texture-atlas-task-screen.test.ts:181`, `apps/editor/src/workspace/atlas/texture-atlas-task-screen.test.ts:254`, `apps/editor/src/workspace/atlas/texture-atlas-task-screen.test.ts:286`, `apps/editor/src/workspace/atlas/texture-atlas-task-screen.test.ts:342`, `apps/editor/src/workspace/atlas/texture-atlas-task-screen.test.ts:357`, `apps/editor/src/workspace/atlas/texture-atlas-task-screen.test.ts:371`).
- Domain A mutation persistence, source texture retention behavior by implication, generated binary bytes, UV rewrite, hidden/pool target semantics (`packages/authoring-core/src/texture-atlas-mutations.test.ts:51`, `packages/authoring-core/src/texture-atlas-mutations.test.ts:178`, `packages/authoring-core/src/texture-atlas-mutations.test.ts:230`, `packages/authoring-core/src/texture-atlas-mutations.test.ts:263`).

Validation evidence accepted from Orch-Sylph:

- `pnpm.cmd exec vitest run packages/operation-core/src/operations/apply-texture-atlas-preview.test.ts apps/editor/src/workspace/atlas/texture-atlas-task-screen.test.ts packages/authoring-core/src/texture-atlas-mutations.test.ts`: passed outside sandbox after sandbox esbuild EPERM; 3 files, 20 tests.
- `pnpm.cmd typecheck`: passed.
- `node scripts/check-source-organization.mjs`: passed.
- `node scripts/check-dependencies.mjs`: passed.
- `git diff --check`: passed with CRLF normalization warnings only.

No additional validation commands were rerun in this re-review lane.

## Residual Risks

- Browser canvas painting is covered by projection/render tests and direct source review, not by a Playwright screenshot or pixel inspection in a real browser.
- `applyTextureAtlasPreview` is async-only in Operation Core because generated atlas binary digesting is async. Sync lifecycle callers reject deterministically, but callers must use `commitOperationAsync()` / `dryRunOperationAsync()`.
- The operation payload stores expected layout metadata. It avoids raw texture/generated bytes, but placement metadata can grow with model size.
- The authoring-core schema re-export used by Operation Core is acceptable for this fix loop but may merit a later boundary cleanup if package-format schema access policy changes.
- The UI stale signature samples texture bytes for performance; Operation Core layout recreation and Domain A apply guards are the stronger final Apply protection.

## User-decision Points

- Whether to keep the new async lifecycle names `dryRunOperationAsync` / `commitOperationAsync`.
- Whether expected layout summary should remain in the operation payload long term or be replaced later with a smaller preview identity.
- Whether to formalize Operation Core access to texture atlas layout schemas through package-format rather than the current authoring-core re-export.
