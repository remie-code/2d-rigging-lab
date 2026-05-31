# Wave 21 Domain F Completion: PSD Structured E2E and Compatibility Smoke

## Status

pass

## Delegated Contexts

- Implementation: Gnome the 12th (`019e7d07-4a22-7160-8e8e-359d10432513`)
- Review: Sylph the 13th (`019e7d10-b116-79b0-bd20-c7bacba70dac`)

Orch-Sylph did not implement e2e/source changes. The e2e implementation was delegated to Gnome, and independent review was delegated to Review-Sylph.

## Scope

Domain F extended the existing editor browser e2e smoke only.

Changed files:

- `apps/editor/e2e/source-intake-smoke.mjs`
- `apps/editor/e2e/smoke-checks.mjs`
- `discussion/implementation/waves/wave21/wave21-domain-f-psd-structured-e2e-and-compatibility-smoke-completion.md`

No production implementation files were changed by Domain F. Existing Wave 20 / Wave 21 production diffs from prior domains were observed and left untouched.

## Behavior Added

- PSD source intake e2e now asserts saved `assets/sources/source-manifest.json` includes structured `sourceAsset.psdProfile`, including:
  - adapter evidence
  - canvas bounds
  - source groups
  - source layer relation metadata
  - texture preview / texture / target part relation
  - adapter diagnostics
  - structured-vs-flattened compatibility policy
- PSD e2e already created a drawable from the imported texture-backed PSD metadata; the smoke continues to assert the preview resolves the deterministic texture data URL before and after save/load.
- Post-load source-intake projection now asserts the structured PSD profile summary remains visible and truthful, including the parser-free wording.
- A focused split PNG compatibility smoke now runs after the main save/load/reset flow. It confirms split PNG mode can still submit through the existing Source Intake controls, commits `importSplitPngSourceAsset`, projects the imported split PNG source row, updates pending drawable source selection, and avoids file-picker/parser/decode/raster claims.
- Source Intake visible text is checked for unsupported parser/file-picker/image-decoding/raster-extraction claims.

## Verification

- `pnpm.cmd test:e2e`
  - first run failed because the new saved-state assertion compared `psdProfile.compatibility` by JSON key order
  - assertion normalization was fixed
- `pnpm.cmd test:e2e`
  - pass
  - desktop smoke passed
  - mobile smoke passed
- `pnpm.cmd typecheck`
  - pass
- `git diff --check -- apps/editor fixtures/e2e discussion/implementation/waves/wave21 discussion/implementation/reviews/wave21`
  - pass
  - Git emitted LF/CRLF working-copy warnings only
- `git diff --name-only -- package.json pnpm-lock.yaml pnpm-workspace.yaml apps/*/package.json packages/*/package.json`
  - pass
  - no output

## Scope Guard

- No dependency manifests or lockfiles changed.
- No PSD parser, file picker, image decode, raster extraction, binary asset storage, or external dependency was added.
- Domain F changed e2e smoke files and this completion note only, so there were no changed production files to scan for parser/file-picker/decode/raster implementation.
- No `index.ts` implementation logic was changed.

## Residual Risks

- The split PNG smoke proves metadata intake and source projection compatibility, not real PNG bytes or file-picker behavior. This matches Wave 21 non-goals.
- The e2e runner logs preview/drawable screenshots but does not separately log the new split PNG screenshot, because `scripts/editor-e2e-smoke.mjs` is outside Domain F write scope.
- The structured PSD save assertion is exact for the current one-layer e2e fixture. Broader multilayer/unsupported-feature e2e coverage remains better suited to fixture and unit/contract tests.

## Review Result

Review artifact:

- `discussion/implementation/reviews/wave21/wave21-domain-f-psd-structured-e2e-and-compatibility-smoke-review.md`

Review-Sylph found no source/e2e findings. The initial review returned `needs_fix` only because this completion artifact was missing an allowed final status, delegated context ids/names, and the Domain G gate decision. This revision records those required fields.

## Domain G Gate

Domain G can proceed.
