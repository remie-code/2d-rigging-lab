# Wave19 Domain G Gnome Notes: Texture Preview E2E And Persistence Smoke

## Verdict

`escalate`

## Reason

The requested browser-level smoke requires a deterministic browser-materialized texture preview reference so the preview can assert actual SVG pattern/image rendering and not count `package-local-file-v1` fallback as success.

Current source intake UI state blocks that path:

- `apps/editor/src/editor-state/source-intake-draft-state.ts` accepts only `assets/textures/`, `assets/thumbnails/`, or `generated://texture-preview/` references.
- Domain C completion explicitly records data URLs as intentionally not allowed in the draft UI and says adding them requires a user/design decision.
- Domain D/package operation materialization accepts deterministic image data URLs.
- Domain F preview rendering treats only `deterministic-data-url-v1` as actual texture pattern rendering and correctly keeps `package-local-file-v1` as solid fallback.

Because the current source intake form cannot confirm a deterministic `data:image/png;base64,...` texture preview reference, the existing e2e harness cannot drive the required source intake -> texture-backed drawable -> generated mesh -> actual texture preview -> save/load path without changing editor-state validation behavior.

## Scope Not Changed

No source implementation files were changed. In particular, I did not broaden the allowed write scope by editing:

- `apps/editor/src/editor-state/source-intake-draft-state.ts`
- `apps/editor/src/ui/source-assets/source-intake-form.ts`
- package / operation / runtime / validator source

## Evidence From Inspection

- Source intake form reads `texturePreviewReference.0` and passes it through `confirmSourceIntakeDraft`.
- `confirmSourceIntakeDraft` rejects unsupported texture preview references before `onConfirmDraft` can call the workflow import.
- Operation-side import code can create `deterministic-data-url-v1` preview assets.
- Preview visual renders actual texture patterns only for `deterministic-data-url-v1`; package-local refs are explicitly `solid_fallback`.

## Verification Performed

- Read the required orchestration and context hygiene skills.
- Read Wave19 plan and Domain D/E/F completion reports.
- Inspected existing e2e entry points:
  - `apps/editor/e2e/smoke-checks.mjs`
  - `apps/editor/e2e/source-intake-smoke.mjs`
  - `apps/editor/e2e/test-ids.mjs`
  - `scripts/editor-e2e-smoke.mjs`
- Inspected relevant source intake, workflow, operation, and preview files listed above.

Full `pnpm.cmd test:e2e` and `pnpm.cmd typecheck` were not run because no passing implementation can be produced within the delegated write scope until the data URL source-intake policy is resolved.

## User-Decision Points For Orch-Sylph / Undine

- Decide whether Domain G may change source intake draft validation to accept deterministic image data URLs, replacing or supplementing the Domain C `generated://texture-preview/` allowance.
- Decide whether to remove `generated://texture-preview/` from the source intake UI accepted set, or leave it as a draft-only value that operation commit must reject visibly.

## Suggested Narrow Follow-Up If Approved

If the design decision is to allow deterministic data URLs in the source intake UI, the likely focused change is:

- Add `data:image/(png|jpeg|webp);base64,...` support to source intake draft validation.
- Update source intake state/UI tests and accessible-name smoke assertions for texture preview / texture ID / target part controls.
- Extend the existing editor e2e smoke with a deterministic PNG data URL, then assert:
  - imported source row and drawable handoff include source layer / texture ID / part ID,
  - preview shape has `data-texture-render="texture_pattern"`,
  - preview shape has the expected `data-texture-id`,
  - SVG `image` href matches the deterministic data URL,
  - saved package file set contains `assets/textures/texture-atlas.json` with `deterministic-data-url-v1`,
  - load restores the same preview relation on desktop and mobile.
