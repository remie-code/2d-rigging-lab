# Wave 21 Map

> Entry map for Wave 21 PSD structured profile persistence hardening artifacts.

## Status

- Wave: `psd-structured-profile-persistence-hardening`
- Result: `Completed / implementation-proven`
- Final report: [wave21-final-report.md](wave21-final-report.md)
- Final verification: [wave21-final-verification-report.md](wave21-final-verification-report.md)
- Clean integration review: [../../reviews/wave21/wave21-clean-integration-review.md](../../reviews/wave21/wave21-clean-integration-review.md)

## Domain Completion Reports

| Domain | Report | Result |
|---|---|---|
| A. PSD structured source manifest contract | [wave21-domain-a-structured-source-manifest-contract-completion.md](wave21-domain-a-structured-source-manifest-contract-completion.md) | pass |
| B. PSD operation structured materialization | [wave21-domain-b-psd-operation-structured-materialization-completion.md](wave21-domain-b-psd-operation-structured-materialization-completion.md) | pass |
| C. PSD validator structured diagnostics | [wave21-domain-c-psd-validator-structured-diagnostics-completion.md](wave21-domain-c-psd-validator-structured-diagnostics-completion.md) | pass |
| D. PSD structured contract fixtures | [wave21-domain-d-psd-structured-contract-fixtures-completion.md](wave21-domain-d-psd-structured-contract-fixtures-completion.md) | pass |
| E. Editor PSD structured projection | [wave21-domain-e-editor-psd-structured-projection-completion.md](wave21-domain-e-editor-psd-structured-projection-completion.md) | pass |
| F. PSD structured e2e and compatibility smoke | [wave21-domain-f-psd-structured-e2e-and-compatibility-smoke-completion.md](wave21-domain-f-psd-structured-e2e-and-compatibility-smoke-completion.md) | pass |
| G. Integration review and final report | [wave21-final-report.md](wave21-final-report.md) | pass |

## Current State Summary

- Wave 21 hardens the parser-free PSD adapter/profile path by persisting adapter, canvas, group, layer, unsupported-feature, diagnostic, and compatibility evidence as structured source manifest data.
- Operation, validator, fixtures, editor projection, AI inspection, and e2e smoke all consume or verify the structured profile while keeping flattened Wave 20 compatibility.
- Split PNG metadata intake compatibility remains covered.
- No PSD parser, file picker, image decode, raster extraction, binary storage, PSD/image dependency, or dependency manifest change was added.

## Next Actions

1. Use [wave21-final-report.md](wave21-final-report.md) before planning any real PSD parser, image decode, binary storage, or file picker work.
2. If proceeding toward real assets, plan package binary file-set and import/export boundaries before parser/decode implementation.
