# Wave 20 Domain F Review

> Domain: `wave20-editor-psd-source-intake-mode`
> Reviewer: Review-Sylph independent review
> Implementer context: `019e7ba1-2572-7e30-b436-12ad9efdf8fe` / Gnome the 73rd
> Verdict: `pass` after needs_fix re-review

## Basis Reviewed

- `.agents/skills/implementation-orchestration/SKILL.md`
- `discussion/implementation/orchestration/wave20-plan.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/design/module-contracts/package-file-format-contract.md`
- `discussion/design/module-contracts/operation-contracts.md`
- `discussion/design/mvp-authoring-runtime/01-open-model-package-design.md`
- `discussion/implementation/waves/wave20/wave20-psd-spec-field-matrix.md`
- `discussion/implementation/waves/wave20/wave20-psd-sample-characterization.md`
- `discussion/implementation/waves/wave20/wave20-domain-b-completion.md`
- `discussion/implementation/waves/wave20/wave20-domain-c-completion.md`
- `discussion/implementation/waves/wave20/wave20-domain-d-completion.md`
- `discussion/implementation/reviews/wave20/wave20-domain-c-review.md`
- `discussion/implementation/reviews/wave20/wave20-domain-d-review.md`

## Files Reviewed

- `apps/editor/src/editor-state/source-intake-draft-state.ts`
- `apps/editor/src/editor-state/source-intake-view-model.ts`
- `apps/editor/src/ui/source-assets/source-intake-form.ts`
- `apps/editor/src/ui/source-assets/source-intake-panel.ts`
- `apps/editor/src/editor-session/source-import-command.ts`
- `apps/editor/src/editor-session/evidence-provider.ts`
- `apps/editor/src/editor-workflow/source-intake-workflow.ts`
- `apps/editor/src/editor-workflow/workflow-controller.ts`
- `apps/editor/src/editor-state/source-intake-draft-state.test.ts`
- `apps/editor/src/ui/source-assets/source-intake-panel.test.ts`
- `apps/editor/src/editor-workflow/workflow-controller.test.ts`
- `apps/editor/src/ui/app-shell/app-shell.test.ts`

No source implementation files were changed by this review.

## Verification

```powershell
pnpm.cmd exec vitest run apps/editor/src/editor-state/source-intake-draft-state.test.ts apps/editor/src/ui/source-assets/source-intake-panel.test.ts apps/editor/src/editor-workflow/workflow-controller.test.ts apps/editor/src/ui/app-shell/app-shell.test.ts
```

Initial sandbox result: failed with `EPERM` reading `node_modules/.pnpm/vitest.../vitest.mjs`.

Escalated rerun result: pass, `4` files / `55` tests.

```powershell
pnpm.cmd typecheck
```

Result: pass for root `tsc --noEmit` and editor `tsc --noEmit -p tsconfig.json`.

```powershell
git diff --check -- apps/editor discussion/implementation/waves/wave20 discussion/implementation/reviews/wave20
```

Result before this report was written: pass. Output contained only Git LF/CRLF working-copy warnings for tracked editor files.

```powershell
git diff --name-only -- package.json pnpm-lock.yaml pnpm-workspace.yaml
```

Result: no output.

Focused parser/decode/file-picker scan over changed editor production files:

```powershell
rg -n -e "showOpenFilePicker" -e "FileReader" -e "readFile" -e "OpenRead" -e "ag-psd" -e "sharp" -e "pngjs" -e "jimp" -e "raster extraction" -e "extract raster" -e "decode image" -e "image decode" -e "PSD parser" -e "psd parser" -e "parsed from bytes" -e "Photoshop-compatible" -e "file picker" <changed editor production files>
```

Result: no matches.

The same terms in changed tests only appear in truthfulness assertions or negative regex checks, including `no PSD bytes were parsed by the editor`.

## Initial Blocking Findings (Resolved)

1. `apps/editor/src/ui/source-assets/source-intake-form.ts:369` and `apps/editor/src/ui/source-assets/source-intake-form.ts:376` mark `Texture preview reference` and `Texture ID` as native HTML `required` for every source layer row. This conflicts with the draft validator in `apps/editor/src/editor-state/source-intake-draft-state.ts:278`, which intentionally allows PSD adapter/profile layers with `role: "unsupported"` to omit texture preview, texture ID, and target part mapping. In a real browser, native form validation blocks submit before the local `confirmSourceIntakeDraft` path runs, so a valid Domain B/C adapter-result shape for an unsupported PSD source layer cannot be entered through the UI. The existing tests use a fake form submission path and do not exercise browser constraint validation, so they miss this user-facing mismatch.

Needs-fix re-review confirmed this is resolved. `source-intake-form.ts` now derives native texture required state through `requiresLayerTextureMapping`, initializes texture preview / texture ID `required` from current intake mode and role, and resyncs on source intake mode and layer role changes.

## Initial Non-Blocking Findings (Resolved)

- `apps/editor/src/ui/source-assets/source-intake-form.ts:42` still labels the layer-row group as `Split PNG source layer rows`. The visible form supports both split PNG and manual PSD adapter/profile metadata, so this accessible name is stale for PSD mode. It does not imply parsing, but it should be made generic or mode-aware with the fix above.

Needs-fix re-review confirmed this is resolved. The layer-row group accessible label is now `Source intake layer rows`.

## Design / Development Compliance Review

The parser-free boundary is otherwise preserved. The production editor scan found no OS file picker, `FileReader`, filesystem read, PSD parser dependency, image decoder, raster extraction, Photoshop-compatible rendering claim, dependency manifest change, fixture write, validator implementation, operation-core implementation change, broad app shell redesign, or `index.ts` implementation logic change in Domain F files.

User-entered PSD profile data maps to the Domain B/C adapter-result payload shape. `createPsdSourceIntakeImportCommand` routes PSD mode to `importPsdSourceAsset`, and `createPsdAdapterResultFromDraft` emits `psd-adapter-result-v1`, `layered-character-psd-profile-v1`, adapter name, canvas, source groups, source layers, role overrides, unsupported feature records, texture preview reference, texture ID, target part ID, and a truthful manual-entry adapter diagnostic.

Split PNG source intake remains compatible. The split PNG path still builds `importSplitPngSourceAsset`, keeps the existing provenance metadata path, and the focused workflow tests continue to cover split PNG import, rights update, create drawable handoff, texture preview metadata, save, and load.

The `apps/editor/src/editor-session/evidence-provider.ts` scope expansion is acceptable. It is a narrow editor-session support addition for committed PSD intake evidence: a switch branch and `createImportPsdSourceAssetEvidenceInput` target collection. It does not add parser, file IO, validation, fixture, or operation-core behavior.

Source organization is acceptable for this domain. No `index.ts` logic changed, and the added PSD source-intake mapping stays in the existing editor source-intake workflow boundary.

## Test Adequacy Review

Focused state, UI, workflow, and app-shell tests passed and cover:

- split PNG draft compatibility;
- manual PSD adapter/profile confirmation wording;
- PSD commit through `importPsdSourceAsset`;
- adapter-result payload shape in the operation log;
- truthfulness checks against file-picker/parser/raster wording;
- local diagnostics and long diagnostic wrapping;
- existing preview/app-shell compatibility.

Needs-fix re-review confirmed test adequacy for the original blocking issue. `source-intake-panel.test.ts` now covers split PNG required texture fields and PSD adapter/profile `role: "unsupported"` dynamic required state across role and source mode changes.

## Residual Risks

- PSD source URL and rights notes entered in the shared form are preserved for split PNG provenance but are not represented by Domain C's `ImportRightsSummaryDto` for PSD imports. This follows the current operation contract, but a later provenance contract refresh may need richer PSD provenance fields.
- Group IDs are generated from sanitized group paths in the editor workflow. Collision handling is left to operation preconditions; this is acceptable for manual metadata entry but may need friendlier UI diagnostics later.
- Full desktop/mobile browser layout and native form validation are not covered by the focused unit-style DOM tests in this domain. Domain G should include browser smoke coverage.

## Domain Gate

Domain F can pass after the needs-fix patch. No blocking or non-blocking findings remain.

## Needs-Fix Re-Review

Reviewed additional changed files:

- `apps/editor/src/ui/source-assets/source-intake-form.ts`
- `apps/editor/src/ui/source-assets/source-intake-panel.test.ts`

The original blocking finding is fixed. `source-intake-form.ts:389-415` initializes and updates the native `required` attributes for texture preview and texture ID using the same rule as draft validation: split PNG always requires texture mapping; PSD adapter/profile requires it for mapped layers; PSD adapter/profile `unsupported` layers do not require it. `source-intake-panel.test.ts:129-159` covers the PSD unsupported initial state plus dynamic role and intake mode changes. Split PNG required state remains covered at `source-intake-panel.test.ts:72-73`.

The accessible label issue is fixed at `source-intake-form.ts:42`, and covered at `source-intake-panel.test.ts:69-70`.

Re-run verification:

```powershell
pnpm.cmd exec vitest run apps/editor/src/editor-state/source-intake-draft-state.test.ts apps/editor/src/ui/source-assets/source-intake-panel.test.ts apps/editor/src/editor-workflow/workflow-controller.test.ts apps/editor/src/ui/app-shell/app-shell.test.ts
```

Initial sandbox result: failed with `EPERM` reading the pnpm-installed Vitest entrypoint.

Escalated rerun result: pass, `4` files / `56` tests.

```powershell
pnpm.cmd typecheck
```

Result: pass for root `tsc --noEmit` and editor `tsc --noEmit -p tsconfig.json`.

```powershell
git diff --check -- apps/editor discussion/implementation/waves/wave20 discussion/implementation/reviews/wave20
```

Result: pass. Output contained only Git LF/CRLF working-copy warnings for tracked editor files.

```powershell
git diff --name-only -- package.json pnpm-lock.yaml pnpm-workspace.yaml
```

Result: no output.

Focused production scan for OS file picker, `FileReader`, filesystem reads, parser/image dependencies, image decode, raster extraction, PSD parser wording, Photoshop-compatible claims, and file-picker wording found no matches in changed editor production files. Matches in tests were only negative/truthfulness assertions.

No new parser/file-picker/decode/dependency/fixture/scope issue was observed. The `apps/editor/src/editor-session/evidence-provider.ts` scope expansion remains acceptable as narrow editor-session evidence support for committed PSD intake.

Final verdict: `pass`.
