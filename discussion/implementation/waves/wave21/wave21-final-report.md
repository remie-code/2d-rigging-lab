# Wave 21 Final Report: PSD Structured Profile Persistence Hardening

> Target: `wave21-integration-review-and-final-report`
> Date: 2026-05-31
> Orchestrator: Orch-Sylph
> Status: `pass`

## Status

Wave 21 is `pass` / implementation-proven.

Domain A-F completion reports are `pass`, Domain G final verification passed, clean integration review passed after a non-source Domain D artifact amendment, maps and current capability documentation were updated, and no source fix remains.

## Domain Results

| Domain | Result | Gnome / verification context | Review-Sylph context | Evidence |
|---|---|---|---|---|
| A. PSD structured source manifest contract | `pass` | `019e7ca4-6e6e-78e1-9e79-1662ff7f0bed` / Gnome the 2nd | `019e7caf-8153-7de2-a1b2-6c3dba1a7225` / Sylph the 3rd | [wave21-domain-a-structured-source-manifest-contract-completion.md](wave21-domain-a-structured-source-manifest-contract-completion.md), [../../reviews/wave21/wave21-domain-a-structured-source-manifest-contract-review.md](../../reviews/wave21/wave21-domain-a-structured-source-manifest-contract-review.md) |
| B. PSD operation structured materialization | `pass` | `019e7cbf-b15c-70e3-92ce-a1cf1cf3b589` / Gnome the 5th | `019e7cd3-6b4b-7e11-8437-443ac2c715bc` / Sylph the 6th | [wave21-domain-b-psd-operation-structured-materialization-completion.md](wave21-domain-b-psd-operation-structured-materialization-completion.md), [../../reviews/wave21/wave21-domain-b-psd-operation-structured-materialization-review.md](../../reviews/wave21/wave21-domain-b-psd-operation-structured-materialization-review.md) |
| C. PSD validator structured diagnostics | `pass` | `019e7cbf-e6cd-7682-8a8e-74f714df7017` / Gnome the 6th | `019e7cdb-cae5-7223-bd3d-ca9b78de1363` / Sylph the 7th | [wave21-domain-c-psd-validator-structured-diagnostics-completion.md](wave21-domain-c-psd-validator-structured-diagnostics-completion.md), [../../reviews/wave21/wave21-domain-c-psd-validator-structured-diagnostics-review.md](../../reviews/wave21/wave21-domain-c-psd-validator-structured-diagnostics-review.md) |
| D. PSD structured contract fixtures | `pass` | not available from persisted artifacts | review context id/name not recorded; review artifact pass | [wave21-domain-d-psd-structured-contract-fixtures-completion.md](wave21-domain-d-psd-structured-contract-fixtures-completion.md), [../../reviews/wave21/wave21-domain-d-psd-structured-contract-fixtures-review.md](../../reviews/wave21/wave21-domain-d-psd-structured-contract-fixtures-review.md) |
| E. Editor PSD structured projection | `pass` | `019e7ce5-da0f-77b0-9833-4fffd88ffcf6` / Gnome the 10th | `019e7cfa-9e86-78b0-87dc-9202ab32c067` / Sylph the 11th | [wave21-domain-e-editor-psd-structured-projection-completion.md](wave21-domain-e-editor-psd-structured-projection-completion.md), [../../reviews/wave21/wave21-domain-e-editor-psd-structured-projection-review.md](../../reviews/wave21/wave21-domain-e-editor-psd-structured-projection-review.md) |
| F. PSD structured e2e and compatibility smoke | `pass` | `019e7d07-4a22-7160-8e8e-359d10432513` / Gnome the 12th | `019e7d10-b116-79b0-bd20-c7bacba70dac` / Sylph the 13th | [wave21-domain-f-psd-structured-e2e-and-compatibility-smoke-completion.md](wave21-domain-f-psd-structured-e2e-and-compatibility-smoke-completion.md), [../../reviews/wave21/wave21-domain-f-psd-structured-e2e-and-compatibility-smoke-review.md](../../reviews/wave21/wave21-domain-f-psd-structured-e2e-and-compatibility-smoke-review.md) |
| G. Integration review and final report | `pass` | `019e7d1c-64fd-7563-87ad-37615694adc2` / Gnome the 14th final verification | `019e7d1c-a22e-7e61-a305-3b3f0613ec35` / Sylph the 15th clean integration review | [wave21-final-verification-report.md](wave21-final-verification-report.md), [../../reviews/wave21/wave21-clean-integration-review.md](../../reviews/wave21/wave21-clean-integration-review.md) |

## Changed-File Summary

| Area | Summary |
|---|---|
| Package format | Added optional structured `psdProfile` persistence for adapter evidence, canvas, source groups/layers, unsupported feature details, diagnostics, blend metadata, texture relation metadata, and flattened compatibility policy. |
| Operation / authoring | `importPsdSourceAsset` now materializes adapter results into structured `sourceAsset.psdProfile` while keeping flattened `diagnostics` and `sourceLayer.unsupportedFeatures` for compatibility. |
| Validator | Validator-core now prefers structured PSD profile diagnostics and preserves flattened fallback behavior for Wave 20 compatibility and split PNG compatibility. |
| Fixtures | PSD happy-path and unsupported-layer contract fixtures now pin structured profile evidence, structured validation reports, metadata-only texture relation evidence, and explicit no-bytes/no-parser truthfulness flags. |
| Editor | Source Intake, source evidence, and AI inspection projection now summarize structured PSD profile metadata after import and save/load without claiming byte parsing, image decode, or raster extraction. |
| E2E | Browser smoke now verifies structured PSD profile persistence, post-load projection, texture preview relation, and split PNG metadata intake compatibility. |
| Discussion/maps | Added Wave 21 domain completion/review artifacts, final verification, clean integration review, final report, and Wave 21 maps; updated implementation and capability maps. |
| Dependency manifests | No dependency manifest or lockfile changes. |

## Final Verification

Final verification was delegated to Gnome and persisted in [wave21-final-verification-report.md](wave21-final-verification-report.md).

| Command / check | Result | Notes |
|---|---|---|
| `pnpm.cmd typecheck` | pass | Root and editor typecheck completed with exit code 0. |
| `pnpm.cmd test:unit` | pass | Vitest passed `94` files / `509` tests. |
| `pnpm.cmd test:e2e` | pass | Desktop and mobile editor smoke passed. |
| `pnpm.cmd run check:source` | pass | Source organization guard passed. |
| `git diff --check -- apps/editor packages fixtures/contracts discussion/implementation` | pass | No whitespace errors; Git LF/CRLF working-copy warnings only. |
| Dependency manifest diff/status check | pass | No changes to root, workspace, app, package manifests, or `pnpm-lock.yaml`. |
| Parser/file-picker/decode/raster scan | pass | Changed production files contain no OS file picker, PSD parser, filesystem read, image decode, raster extraction, binary storage implementation, or Photoshop-compatible rendering claim. Matches were schema parsing, metadata labels, explicit non-claims, or future-scope diagnostic text. |

## Integration Review

Clean integration review was delegated to Review-Sylph and persisted in [../../reviews/wave21/wave21-clean-integration-review.md](../../reviews/wave21/wave21-clean-integration-review.md).

Verdict: `pass`.

Rubric result:

| Rubric | Result |
|---|---|
| Structured Persistence | pass |
| Backward Compatibility | pass |
| PSD Profile Truthfulness | pass |
| Dependency Policy Compliance | pass |
| Source Layer Mapping | pass |
| Texture Preview Persistence | pass |
| Validator Evidence | pass |
| UI / Accessibility | pass |
| Source Organization | pass |
| Test Adequacy | pass |
| Orchestration Compliance | pass |

Review-Sylph found no blocking, high, medium, or low findings after the Domain D completion artifact was amended to disclose the unavailable original context id/name and record review/gate evidence. No source or artifact fix remains.

## Capability Now Proven

Wave 21 proves structured PSD profile persistence on top of the Wave 20 parser-free adapter boundary:

- `psd-source-v1` source assets can persist structured `layered-character-psd-profile-v1` adapter evidence, canvas, groups, source layers, unsupported features, adapter diagnostics, and compatibility policy.
- `importPsdSourceAsset` materializes trusted adapter metadata into the structured source manifest while preserving flattened compatibility fields.
- Validator diagnostics read structured PSD profile evidence for adapter diagnostics, unsupported features, missing structured fallback, flattened mismatch, and non-PSD profile mismatch.
- Contract fixtures and browser e2e prove structured profile persistence, validation evidence, source layer texture/part mapping, texture preview relation, and save/load projection.
- Editor Source Intake and AI inspection can summarize structured PSD metadata truthfully.
- Split PNG metadata intake compatibility remains covered.

## Explicit Non-Claims

Wave 21 does not implement or claim:

- actual PSD binary parser support;
- PSD layer tree extraction from file bytes;
- PSD channel or image decode;
- raster extraction or preview generation from PSD pixels;
- Photoshop-compatible compositing, masks, effects, smart objects, text, or vector rendering;
- OS file picker or package archive import/export;
- binary package storage;
- dependency additions for PSD/image parsing.

## Residual Risks

- Domain D's original Gnome implementation context id/name is unavailable from persisted artifacts. This is disclosed in the amended Domain D completion report and accepted under the context-id-if-available rule.
- Verification and review were run against the current uncommitted workspace, not a fresh checkout replay.
- Forbidden parser/decode/file-picker/raster checks are grep/source-review based, not a semantic proof against future changes.
- E2E remains smoke coverage. Unsupported-feature and broader multilayer PSD cases are primarily covered by unit and contract fixture tests.
- `SourceAssetSchema` remains non-discriminated; validator covers `psdProfile` on non-PSD source assets, but a future package-format cleanup could make source kind/profile pairing stricter.
- Domain C introduced validator check IDs that are not yet mirrored into `discussion/design/module-contracts/validator-contract.md`; this is documentation debt for a later contract refresh.

## Next-Wave Recommendation

Recommended next wave: real asset I/O boundary design, still without implementing a PSD parser. The next useful decision is package binary file-set policy, OS/file/archive import-export boundaries, storage failure UX, and fixture/provenance policy for future real image bytes.

Alternative candidates:

1. Real texture pipeline expansion for rights-clean PNG bytes/decode/materialization before PSD raster extraction.
2. Product authoring workflow expansion for full layer tree, opacity/mask/clipping controls, richer part/texture authoring, or standalone viewer/renderer.
3. Validator contract documentation refresh to mirror the new Wave 21 structured PSD check IDs.

No escalation or user decision is required to close Wave 21. Parser/decode/file-picker/binary-storage work remains future scope and must be planned as a separate wave.
