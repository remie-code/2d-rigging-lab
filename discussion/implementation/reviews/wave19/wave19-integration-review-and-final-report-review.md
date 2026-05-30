# Wave19 Domain H Clean Integration Review

- Verdict: `pass`
- Target: `wave19-integration-review-and-final-report-review`
- Review-Sylph agent/context id: `019e7b35-10c4-7833-b6e8-c8a35eebaefd` (`Sylph the 60th`)
- Date: 2026-05-31
- Source fix required: none

## Basis Used

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave19-plan.md`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/waves/wave18/wave18-final-report.md`
- `discussion/development_convention/source-file-organization-policy.md`
- Wave19 implementation map and final report:
  - `discussion/implementation/waves/wave19/_map.md`
  - `discussion/implementation/waves/wave19/wave19-final-report.md`
- Wave19 review map:
  - `discussion/implementation/reviews/wave19/_map.md`
- Wave19 completion/review reports under:
  - `discussion/implementation/waves/wave19/`
  - `discussion/implementation/reviews/wave19/`
- Actual repository status, changed file list, focused source/test reads, and diff/whitespace checks.

## Scope Reviewed

Focused source and test files reviewed included:

- `packages/package-format/src/texture-atlas.ts`
- `packages/authoring-core/src/texture-asset-mutations.ts`
- `packages/authoring-core/src/package-document-assets.ts`
- `packages/authoring-core/src/runtime-graph-drawables.ts`
- `packages/operation-core/src/payloads/import-source.ts`
- `packages/operation-core/src/operations/import-split-png-source-asset.ts`
- `packages/operation-core/src/operations/import-split-png-source-asset-texture.ts`
- `packages/operation-core/src/operations/create-drawable.ts`
- `packages/runtime-core/src/texture-projection.ts`
- `packages/runtime-core/src/snapshot.ts`
- `packages/runtime-core/src/keyform-target-application.ts`
- `apps/editor/src/editor-preview/preview-dto.ts`
- `apps/editor/src/editor-preview/preview-projection.ts`
- `apps/editor/src/editor-preview/texture-preview-resolution.ts`
- `apps/editor/src/ui/preview-panel/preview-visual.ts`
- `apps/editor/src/ui/preview-panel/preview-summary.ts`
- `apps/editor/src/ui/source-assets/source-intake-form.ts`
- `apps/editor/src/editor-state/source-intake-draft-state.ts`
- `apps/editor/src/editor-workflow/source-intake-workflow.ts`
- `apps/editor/src/ui/app-shell/app-shell.ts`
- `apps/editor/e2e/source-intake-smoke.mjs`
- `apps/editor/e2e/smoke-checks.mjs`
- `packages/validator-core/src/validators/texture-assets.ts`
- `packages/validator-core/src/validators/package-runtime.ts`
- `packages/validator-core/src/check-catalog.ts`
- focused Wave19 tests and fixtures under `apps/editor/**`, `packages/**`, and `fixtures/contracts/**`.

## Findings

No blocking, high, medium, or low source findings.

Non-blocking integration notes:

- `discussion/implementation/waves/wave19/wave19-final-report.md` and `discussion/implementation/reviews/wave19/_map.md` still showed this clean review as pending at inspection time. This is expected because this artifact did not exist yet and is outside my allowed write scope. Orch-Sylph should update those report/map fields after consuming this review.
- Runtime-core can carry texture metadata when `NormalizedDrawable.texture` is supplied, and editor UI preview resolves package/state texture assets before rendering. The authoring `toRuntimeGraph` adapter still does not directly populate `NormalizedDrawable.texture` from package drawable `textureId`, source-layer mapping, and mesh `uvs` (`packages/authoring-core/src/runtime-graph-drawables.ts`). Domain B already recorded this as a producer-side residual, and current Wave19 UI/e2e coverage proves the editor path through app-shell resolution. A future runtime/viewer wave should close the adapter gap before relying on raw runtime snapshots as texture-backed render evidence.
- Source Intake accepts `assets/textures/`, `assets/thumbnails/`, and deterministic data URLs, while package-format/operation also accept `assets/sources/` package-local preview paths. The current deterministic data URL path and defaults are covered, so this is not blocking; aligning prefix sets later would reduce surprise.

## Rubric Review

### Texture Asset Integrity

Pass.

- Package-format defines explicit preview reference kinds, preview asset records, texture atlas entries, and optional `previewAssets` under `texture-atlas-v1` (`packages/package-format/src/texture-atlas.ts:34`, `packages/package-format/src/texture-atlas.ts:46`, `packages/package-format/src/texture-atlas.ts:58`, `packages/package-format/src/texture-atlas.ts:68`).
- Authoring upsert validates texture/source/provenance/rights coherence before mutating the session and ensures `textureAtlas.previewAssets` exists (`packages/authoring-core/src/texture-asset-mutations.ts:21`, `packages/authoring-core/src/texture-asset-mutations.ts:58`, `packages/authoring-core/src/texture-asset-mutations.ts:151`).
- Import preconditions reject missing preview refs, duplicate/existing texture IDs, missing target parts, and invalid path/data URL references before materialization (`packages/operation-core/src/operations/import-split-png-source-asset-texture.ts:25`, `packages/operation-core/src/operations/import-split-png-source-asset-texture.ts:50`, `packages/operation-core/src/operations/import-split-png-source-asset-texture.ts:112`, `packages/operation-core/src/operations/import-split-png-source-asset-texture.ts:210`).

### Source Layer Mapping

Pass.

- Source Intake draft state requires per-layer texture preview reference, texture ID, and effective target part ID (`apps/editor/src/editor-state/source-intake-draft-state.ts:203`, `apps/editor/src/editor-state/source-intake-draft-state.ts:220`).
- Source Intake form exposes and reads those fields (`apps/editor/src/ui/source-assets/source-intake-form.ts:341`, `apps/editor/src/ui/source-assets/source-intake-form.ts:348`, `apps/editor/src/ui/source-assets/source-intake-form.ts:354`, `apps/editor/src/ui/source-assets/source-intake-form.ts:454`).
- Workflow import passes texture/part data into the operation payload and selected createDrawable defaults (`apps/editor/src/editor-workflow/source-intake-workflow.ts:32`, `apps/editor/src/editor-workflow/source-intake-workflow.ts:67`, `apps/editor/src/editor-workflow/source-intake-workflow.ts:117`).
- `createDrawable` stores explicit `textureId` and maps the new drawable back to the source layer (`packages/operation-core/src/operations/create-drawable.ts:77`, `packages/operation-core/src/operations/create-drawable.ts:106`, `packages/authoring-core/src/drawable-mutations.ts:45`, `packages/authoring-core/src/drawable-mutations.ts:110`).

### Preview Truthfulness

Pass.

- Runtime texture status distinguishes `resolved`, `missing`, and `not_materialized` without treating a texture ID alone as rendered texture (`packages/runtime-core/src/texture-projection.ts:14`, `packages/runtime-core/src/texture-projection.ts:56`, `packages/runtime-core/src/texture-projection.ts:102`).
- Editor preview resolution attaches preview assets and sets status only after matching package texture preview metadata (`apps/editor/src/editor-preview/texture-preview-resolution.ts:32`, `apps/editor/src/editor-preview/texture-preview-resolution.ts:90`, `apps/editor/src/editor-preview/texture-preview-resolution.ts:110`).
- SVG preview creates texture patterns only for browser-renderable deterministic data URL refs; package-local refs remain `solid_fallback` with explicit wording (`apps/editor/src/ui/preview-panel/preview-visual.ts:92`, `apps/editor/src/ui/preview-panel/preview-visual.ts:113`, `apps/editor/src/ui/preview-panel/preview-visual.ts:197`, `apps/editor/src/ui/preview-panel/preview-visual.ts:221`).
- E2E rejects dishonest texture patterns and browser-decodes the exact SVG image href (`apps/editor/e2e/smoke-checks.mjs:356`, `apps/editor/e2e/smoke-checks.mjs:367`, `apps/editor/e2e/smoke-checks.mjs:379`, `apps/editor/e2e/smoke-checks.mjs:440`).

### Package Persistence

Pass.

- Package file set includes `assets/textures/texture-atlas.json` when texture atlas metadata is present (`packages/package-format/src/package-file-paths.ts:4`, `packages/package-format/src/package-file-set.ts:31`, `packages/package-format/src/package-file-set.ts:69`).
- Authoring package asset projection preserves session texture atlas or base texture atlas (`packages/authoring-core/src/package-document-assets.ts:7`).
- E2E saved-state assertions cover source manifest, provenance, rights, drawables, texture atlas entry, preview asset ID, deterministic reference kind/data URL, and import operation target coverage (`apps/editor/e2e/source-intake-smoke.mjs:80`, `apps/editor/e2e/source-intake-smoke.mjs:147`, `apps/editor/e2e/source-intake-smoke.mjs:203`).

### Validator Evidence

Pass.

- `validatePackageRuntime` wires texture asset validation into package validation (`packages/validator-core/src/validators/package-runtime.ts:31`).
- Texture validator covers texture entries, preview assets, missing preview payloads, source-layer mismatch, and rights/provenance mismatch (`packages/validator-core/src/validators/texture-assets.ts:15`, `packages/validator-core/src/validators/texture-assets.ts:323`, `packages/validator-core/src/validators/texture-assets.ts:362`, `packages/validator-core/src/validators/texture-assets.ts:406`, `packages/validator-core/src/validators/texture-assets.ts:437`).
- Check catalog registers the new AI-readable texture diagnostics (`packages/validator-core/src/check-catalog.ts:32` through `packages/validator-core/src/check-catalog.ts:76` in the current diff context).

### UI / Accessibility

Pass.

- Source Intake field labels include the new texture preview reference, texture ID, and target part controls (`apps/editor/e2e/source-intake-smoke.mjs:289`, `apps/editor/e2e/source-intake-smoke.mjs:332`, `apps/editor/e2e/source-intake-smoke.mjs:362`).
- E2E verifies desktop/mobile Source Intake reachability and strict horizontal overflow after the long diagnostic layout fix (`apps/editor/e2e/smoke-checks.mjs:76`, `apps/editor/e2e/smoke-checks.mjs:82`, `apps/editor/e2e/smoke-checks.mjs:999`).
- CSS contains targeted `min-width: 0` / `overflow-wrap: anywhere` handling for source intake, imported-source rows, and long diagnostics (`apps/editor/src/styles/editor.css:421`, `apps/editor/src/styles/editor.css:430`, `apps/editor/src/styles/editor.css:510`, `apps/editor/src/styles/editor.css:516`).

### Source Organization

Pass.

- New responsibilities are in named files: `texture-atlas.ts`, `texture-asset-mutations.ts`, `import-split-png-source-asset-texture.ts`, `texture-projection.ts`, `texture-preview-resolution.ts`, and `texture-assets.ts`.
- Changed `index.ts` files are barrel-only re-exports (`packages/authoring-core/src/index.ts`, `packages/runtime-core/src/index.ts`, `packages/validator-core/src/index.ts`).
- Final verification records `pnpm.cmd run check:source` passing.

### Test Adequacy

Pass.

- Unit coverage spans package/authoring round-trip, import materialization/preconditions, createDrawable handoff, runtime/editor preview DTOs, visual truthfulness, Source Intake validation, validator diagnostics, workflow, and app-shell behavior.
- E2E covers Source Intake -> texture-backed drawable -> generated mesh -> preview -> save/load -> loaded preview on desktop and mobile.
- Final verification reported `pnpm.cmd test:unit` passing with `90 files / 474 tests` and `pnpm.cmd test:e2e` passing desktop/mobile smoke.

### Orchestration Compliance

Pass.

- Wave19 plan required Orch-Sylph to stay orchestration-only and separate Gnome implementation from Review-Sylph review.
- Final report records separate Gnome and Review-Sylph context IDs for Domains A-G, needs-fix loops, final verification, and this clean integration review (`discussion/implementation/waves/wave19/wave19-final-report.md:33`).
- Domain H final verification was delegated to `Gnome the 59th`; this clean integration review is a separate Review-Sylph context (`discussion/implementation/waves/wave19/wave19-final-report.md:46`, `discussion/implementation/waves/wave19/wave19-final-report.md:63`).
- I did not edit source files, final report, or maps. This review artifact is the only file written by this context.

## Verification Reviewed / Performed

Reviewed final verification evidence:

- `pnpm.cmd typecheck`: pass after sandbox EPERM rerun outside sandbox.
- `pnpm.cmd test:unit`: pass after sandbox EPERM rerun; `90 files / 474 tests`.
- `pnpm.cmd test:e2e`: pass after sandbox-limited Vite dependency rerun; desktop/mobile smoke passed.
- `pnpm.cmd run check:source`: pass.
- `git diff --check -- apps/editor packages fixtures/contracts discussion/implementation`: pass; LF/CRLF warnings only.
- `rg -n "[ \t]+$" discussion\implementation\waves\wave19 discussion\implementation\reviews\wave19`: pass after Orch-Sylph fixed one discussion-only trailing whitespace issue.

Performed in this review:

- `git status --short -uall`: reviewed.
- `git diff --name-only`: reviewed.
- `git diff --stat -- apps/editor packages fixtures/contracts discussion/implementation`: reviewed.
- `git diff --check -- apps/editor packages fixtures/contracts discussion/implementation`: pass; CRLF warnings only.
- `rg --files discussion/implementation/waves/wave19 discussion/implementation/reviews/wave19`: reviewed.
- Cross-report `rg` over all Wave19 completion/review reports for verdicts, needs-fix loops, residual risks, and verification sections.
- Focused source/test reads and line-target searches for all required rubric areas.

I did not rerun `pnpm.cmd typecheck`, `pnpm.cmd test:unit`, `pnpm.cmd test:e2e`, or `pnpm.cmd run check:source` in this Review-Sylph context because final verification evidence from `Gnome the 59th` plus the source/diff review above was sufficient for this clean integration gate.

## Remaining Risks

- Texture rendering is proven for deterministic data URL SVG pattern refs, not arbitrary real PNG package-local bytes.
- The e2e texture oracle checks SVG image href decode and metadata, not pixel-level screenshot/canvas sampling.
- Package-local texture preview refs remain truthful browser fallback until a future binary/file/archive materialization layer exists.
- The raw authoring-to-runtime graph adapter still does not project package drawable texture IDs/source-layer mapping/mesh UVs into `NormalizedDrawable.texture`; current editor UI preview bridges that at app-shell resolution time.
- Source Intake package-local accepted prefixes are narrower than package-format/operation accepted prefixes.
- Final report and review map pending fields need Orch-Sylph follow-up after this review artifact exists.

## User-Decision Points

None blocking for Wave19 completion.

Future wave decisions remain:

- Add real PNG bytes / file picker / archive import-export before deeper rendering, or continue with deterministic browser-safe preview references.
- Decide whether to harden preview truthfulness with pixel-level screenshot/canvas sampling.
- Decide whether package-local preview prefix acceptance should be aligned across Source Intake, operation, and package-format.
- Decide whether the next slice should prioritize runtime adapter texture projection, real texture durability, UV/mesh editing, mask/clipping/opacity, rig controls, dynamics, or standalone viewer surface.

## Post-Review Follow-Up

Orch-Sylph consumed this review and updated the pending clean-review fields in:

- `discussion/implementation/waves/wave19/wave19-final-report.md`
- `discussion/implementation/reviews/wave19/_map.md`
