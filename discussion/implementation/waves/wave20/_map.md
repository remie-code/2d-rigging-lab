# Wave 20 Map

> Entry map for Wave 20 PSD spec field matrix and adapter boundary artifacts.

## Status

- Wave: `psd-spec-field-matrix-and-adapter-boundary`
- Result: `Completed / implementation-proven`
- Final report: [wave20-final-report.md](wave20-final-report.md)
- Final verification: [wave20-final-verification-report.md](wave20-final-verification-report.md)
- Clean integration review: [../../reviews/wave20/wave20-clean-integration-review.md](../../reviews/wave20/wave20-clean-integration-review.md)

## Basis Artifacts

| Path | Content |
|---|---|
| [wave20-psd-spec-field-matrix.md](wave20-psd-spec-field-matrix.md) | Adobe PSD spec field matrix for the parser-free adapter boundary. |
| [wave20-psd-sample-characterization.md](wave20-psd-sample-characterization.md) | Safe characterization of rights-cleared `test_data/sample_model.psd`. |

## Domain Completion Reports

| Domain | Report | Result |
|---|---|---|
| A. PSD spec field matrix and sample characterization | [wave20-domain-a-completion.md](wave20-domain-a-completion.md) | pass |
| B. PSD adapter result DTO and operation payload gate | [wave20-domain-b-completion.md](wave20-domain-b-completion.md) | pass |
| C. PSD import operation materialization | [wave20-domain-c-completion.md](wave20-domain-c-completion.md) | pass |
| D. PSD profile validator diagnostics | [wave20-domain-d-completion.md](wave20-domain-d-completion.md) | pass |
| E. PSD fixtures and contract evidence | [wave20-domain-e-completion.md](wave20-domain-e-completion.md) | pass |
| F. Editor PSD source intake mode | [wave20-domain-f-completion.md](wave20-domain-f-completion.md) | pass |
| G. PSD intake e2e and persistence smoke | [wave20-domain-g-completion.md](wave20-domain-g-completion.md) | pass |
| H. Integration review and final report | [wave20-final-report.md](wave20-final-report.md) | pass |

## Current State Summary

- Wave 20 adds a parser-free PSD adapter/profile path. It does not add a PSD parser, image decoder, raster extractor, OS file picker, PSD binary fixture, or dependency manifest change.
- `importPsdSourceAsset` is commit-capable when supplied adapter metadata is present.
- Editor Source Intake can manually enter PSD adapter/profile metadata and persist source layer, texture preview, target part, drawable, and save/load relations.
- Validator and contract fixtures expose unsupported PSD feature and provenance diagnostics.

## Next Actions

1. Use [wave20-final-report.md](wave20-final-report.md) before planning any real PSD parser, image decode, binary storage, or file picker work.
2. Keep parser/decode/raster/file-picker claims out of future reports unless a later wave explicitly implements and verifies them.
