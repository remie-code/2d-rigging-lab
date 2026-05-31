# Wave 20 Domain G Review

> Domain: `wave20-psd-intake-e2e-and-persistence-smoke`
> Reviewer: Review-Sylph independent clean-context review
> Implementer context: `019e7bc4-987e-7b43-b69c-f019fdcc3927` / Gnome the 75th
> Verdict: `pass`

## Basis Reviewed

- `.agents/skills/implementation-orchestration/SKILL.md`
- `discussion/implementation/orchestration/wave20-plan.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/implementation/waves/wave20/wave20-psd-spec-field-matrix.md`
- `discussion/implementation/waves/wave20/wave20-psd-sample-characterization.md`
- `discussion/implementation/waves/wave20/wave20-domain-c-completion.md`
- `discussion/implementation/waves/wave20/wave20-domain-e-completion.md`
- `discussion/implementation/waves/wave20/wave20-domain-f-completion.md`
- `discussion/implementation/reviews/wave20/wave20-domain-e-review.md`
- `discussion/implementation/reviews/wave20/wave20-domain-f-review.md`
- `discussion/implementation/waves/wave20/wave20-domain-g-completion.md`

## Files Reviewed

- `apps/editor/e2e/source-intake-smoke.mjs`
- `apps/editor/e2e/smoke-checks.mjs`
- `discussion/implementation/waves/wave20/wave20-domain-g-completion.md`

Supporting read-only context for source-layer handoff:

- `apps/editor/src/editor-session/create-drawable-preset-command.ts`
- `apps/editor/src/editor-workflow/workflow-controller.ts`
- `apps/editor/src/editor-state/create-drawable-form-state.ts`
- `apps/editor/src/ui/drawable-authoring/drawable-authoring-form.ts`

## Findings

No blocking findings.

No non-blocking findings requiring a Domain G fix.

## Verification Commands / Results

```powershell
git diff -- apps/editor/e2e/source-intake-smoke.mjs apps/editor/e2e/smoke-checks.mjs discussion/implementation/waves/wave20/wave20-domain-g-completion.md
```

Result: reviewed. Domain G source diff is limited to PSD-centered e2e smoke expectations and the Domain G completion artifact.

```powershell
pnpm.cmd test:e2e
```

Initial sandbox result: failed while resolving/reading pnpm-installed Vite dependencies. Escalated rerun result: pass. Desktop smoke passed, mobile smoke passed, final output `editor-e2e: smoke passed`.

```powershell
pnpm.cmd typecheck
```

Initial sandbox result: failed with `EPERM` reading the pnpm-installed TypeScript binary. Escalated rerun result: pass for root `tsc --noEmit` and editor `tsc --noEmit -p tsconfig.json`.

```powershell
git diff --check -- apps/editor fixtures/e2e discussion/implementation/waves/wave20 discussion/implementation/reviews/wave20
```

Result: pass. Output contained only existing Git LF/CRLF working-copy warnings.

```powershell
git diff --name-only -- package.json pnpm-lock.yaml pnpm-workspace.yaml apps/*/package.json packages/*/package.json
```

Result: no output.

```powershell
rg -n -e "showOpenFilePicker" -e "FileReader" -e "ag-psd" -e "sharp" -e "pngjs" -e "jimp" -e "raster extraction" -e "extract raster" -e "decode image" -e "image decode" -e "PSD parser" -e "psd parser" -e "parsed from bytes" -e "Photoshop-compatible" -e "file picker" apps/editor/e2e/source-intake-smoke.mjs apps/editor/e2e/smoke-checks.mjs
```

Result: no matches.

Additional broader keyword scan:

```powershell
rg -n -e "decode" -e "raster" -e "parser" -e "file picker" -e "showOpenFilePicker" -e "FileReader" -e "ag-psd" -e "sharp" -e "pngjs" -e "jimp" apps/editor/e2e/source-intake-smoke.mjs apps/editor/e2e/smoke-checks.mjs
```

Result: matches only the pre-existing `Image.decode()` helper in `apps/editor/e2e/smoke-checks.mjs:379`, `apps/editor/e2e/smoke-checks.mjs:393`, and `apps/editor/e2e/smoke-checks.mjs:407-408`. `git diff -U0` confirms Domain G did not add or modify that helper; it verifies that the deterministic data URL preview loads in the browser and is not PSD byte parsing, raster extraction, or production image decode implementation.

## Development Compliance Review

Pass.

- UI truthfulness passes. The e2e fixture enters `intakeMode = "psdAdapterProfile"` and checks UI text for `PSD adapter/profile metadata (manual)`, `layered-character-psd-profile-v1`, adapter name, canvas size, and the note `no PSD bytes are parsed by the editor` in `apps/editor/e2e/source-intake-smoke.mjs:57-68` and `apps/editor/e2e/source-intake-smoke.mjs:405-406`.
- The PSD input path remains metadata-backed. The smoke uses `manifestPath = "assets/sources/e2e/source-reference.psd"` and `contentHash = "metadata:e2e-psd-adapter-profile"` in `apps/editor/e2e/source-intake-smoke.mjs:13-15`; no actual PSD file picker, PSD file read, parser dependency, or raster extraction is introduced.
- Persistence coverage is specific to PSD source/profile evidence. `assertSavedSourceIntakeState` reads saved `source-manifest`, provenance, rights, texture atlas, drawables, and operation log from browser storage in `apps/editor/e2e/source-intake-smoke.mjs:101-152`, then asserts `psd-source-v1`, `layered-character-psd-profile-v1`, adapter schema/name/canvas diagnostics, `importPsdSourceAsset`, source layer identity/bounds/role, texture ID, part ID, preview reference, rights, and provenance in `apps/editor/e2e/source-intake-smoke.mjs:311-413`.
- Source layer handoff to drawable authoring is covered through the existing supported UI workflow. Source intake asserts the drawable authoring panel receives `src_psd_e2e / layer_psd_face` in `apps/editor/e2e/source-intake-smoke.mjs:82-86`. The controller projects the committed source selection into pending create-drawable defaults in `apps/editor/src/editor-workflow/workflow-controller.ts:339-364`, the drawable form submits the draft source layer in `apps/editor/src/ui/drawable-authoring/drawable-authoring-form.ts:181-187`, and operation request construction includes `sourceLayerId` when provided in `apps/editor/src/editor-session/create-drawable-preset-command.ts:50-57`.
- Preview truthfulness passes. The smoke asserts the rendered preview uses `data-texture-render="texture_pattern"`, `textureId = tex_psd_e2e_face`, preview asset `preview_src_psd_e2e_layer_psd_face`, `href` equal to the deterministic data URL, and `referenceKind = deterministic-data-url-v1` in `apps/editor/e2e/smoke-checks.mjs:356-460`.
- Domain F native validation risk is covered in a real browser. `assertPsdNativeFormValidation` checks PSD `role = "unsupported"` does not make texture preview / texture ID required, then switches to `editableLayer` and confirms those fields become required and invalidate the form in `apps/editor/e2e/source-intake-smoke.mjs:591-698`.
- Desktop/mobile layout and accessible names are covered. The root smoke runs `desktop` and `mobile` viewports in `apps/editor/e2e/smoke-checks.mjs:41-54`, asserts horizontal overflow after source intake, drawable creation, mesh edits, layer controls, load, and reset in `apps/editor/e2e/smoke-checks.mjs:68-123`, and verifies source-intake accessible names in `apps/editor/e2e/source-intake-smoke.mjs:494-589`.
- Source organization and dependency compliance pass for Domain G. The domain changes do not touch dependency manifests, lockfiles, production parser/decode/raster code, OS file picker code, app shell redesign, operation implementation, validator implementation, or any `index.ts` implementation logic.

## Test Adequacy Review

Pass.

The e2e smoke now exercises the required Domain G path end to end: manual PSD adapter/profile intake, `importPsdSourceAsset`, create drawable, generate mesh, deterministic preview, browser save, browser load, reset, desktop/mobile layout checks, and accessible names. The assertions are stronger than a simple UI text check because they inspect the serialized package files and operation log stored in localStorage.

The save/load assertions are adequate for this domain. They verify persisted package state immediately after save and then verify loaded UI projection still shows the imported PSD source and mapped drawable. They also verify the texture/preview/source-layer relation through the saved texture atlas, preview asset, and source-layer mapping.

Focused split PNG e2e coverage is reduced because `runEditorSmoke` is now PSD-centered. This is acceptable for Domain G because split PNG compatibility was covered by Domain F focused state/UI/workflow tests and existing upstream tests, but it remains a residual integration risk for the wave integration review.

## Residual Risks

- The root editor e2e smoke is now PSD-centered instead of split PNG-centered. Split PNG remains covered outside this root smoke, but Domain H should treat split PNG regression coverage as an integration-level residual.
- The load phase verifies UI projection after parsing saved package files, but it does not re-read localStorage a second time after load. Current evidence is sufficient for Domain G save/load persistence, but a future persistence round-trip test could save again after load if that becomes a product risk.
- Drawable DTO persistence currently exposes the source layer relation mainly through source-layer `mappedDrawableIds`, texture `sourceLayerId`, preview `sourceLayerId`, and operation payload/target IDs; `drawableSourceLayerId` itself is expected to be `null` in the e2e assertion. This matches the current supported model but should remain visible to Domain H as a contract-shape nuance.

## Domain Gate

Domain G can pass.

Domain H can proceed.

No user input or design decision is needed for the current Domain G scope.
