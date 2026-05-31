# Wave 20 Domain A Completion

> Domain: `wave20-psd-spec-field-matrix-and-sample-characterization`
> Orchestrator: Orch-Sylph
> Status: `pass`

## Delegation

| Role | Context | Result |
|---|---|---|
| Gnome artifact author | `019e7b5e-3e57-7522-86f4-111cda305bc4` / Gnome the 63rd | Created the PSD spec field matrix and sample characterization artifacts, then applied the review-requested scope fix. |
| Review-Sylph independent review | `019e7b64-f7f9-7c70-a0bc-8641238d76e7` / Sylph the 64th | Initial verdict `needs_fix`; post-fix verdict `pass`. |

## Changed Files

| File | Owner |
|---|---|
| `discussion/implementation/waves/wave20/wave20-psd-spec-field-matrix.md` | Gnome |
| `discussion/implementation/waves/wave20/wave20-psd-sample-characterization.md` | Gnome |
| `discussion/implementation/reviews/wave20/wave20-domain-a-review.md` | Review-Sylph |
| `discussion/implementation/waves/wave20/wave20-domain-a-completion.md` | Orch-Sylph |

No source implementation files, dependency files, lockfiles, fixture directories, or PSD binary files were intentionally changed by Domain A.

## Artifact Summary

- `wave20-psd-spec-field-matrix.md` maps Adobe PSD header, color mode data, image resources, layer/mask info, layer records, channel image data, additional layer info, section divider/group data, masks, and compression to Wave 20 MVP adapter handling.
- The field matrix classifies surfaces as `supported`, `deferred`, or `unsupported`, and ties them to `layered-character-psd-profile-v1` needs: layer/group identity, bounds, opacity, visibility, `unsupportedFeatures`, texture preview references, and target part mapping.
- `wave20-psd-sample-characterization.md` records `test_data/sample_model.psd` as a user-provided rights-cleared sample and limits facts to file size, SHA-256, fixed PSD header fields, and top-level length/offset fields.
- The sample artifact explicitly avoids claims about layer tree extraction, image resource interpretation, raster extraction, texture generation, or Photoshop-compatible rendering.

## Sample Facts Recorded

| Fact | Value |
|---|---|
| File size | `22,406,225` bytes |
| SHA-256 | `44AB43238CD2B2AF2FB0CE6A7B5073A60E332D03DA7666EA274C02E0462294B5` |
| Signature | `8BPS` |
| Version | `1` |
| Canvas | `2048 x 3072` |
| Channels | `4` |
| Depth | `8` bits per channel |
| Color mode | `3` / RGB |

The exact PowerShell method for checksum, fixed-header reads, and top-level length/offset reads is recorded in `wave20-psd-sample-characterization.md`.

## Verification Performed

Required checks:

```powershell
git diff --check -- discussion/implementation/waves/wave20 discussion/implementation/reviews/wave20 discussion/implementation/orchestration/wave20-plan.md
```

Result: pass.

```powershell
git diff --name-only -- apps packages fixtures test_data package.json pnpm-lock.yaml
```

Result: no output.

Additional checks:

```powershell
rg -n "[ \t]+$" discussion/implementation/waves/wave20 discussion/implementation/reviews/wave20
```

Result: no matches.

```powershell
git status --short -uall -- discussion/implementation/waves/wave20 discussion/implementation/reviews/wave20 apps packages fixtures test_data package.json pnpm-lock.yaml
```

Result after this completion file: only the two Domain A artifacts, the Domain A review report, and this completion report are listed as untracked in the checked scope.

Review-Sylph also rechecked the official Adobe Photoshop File Formats Specification at `https://www.adobe.com/devnet-apps/photoshop/fileformatashtml/` and verified the post-fix sample characterization no longer reads or interprets Image Data compression bytes.

## Residual Risks

- Domain A did not parse layer records, image resources, masks, channel image data, or raster pixels from `test_data/sample_model.psd`; this is intentional.
- Adobe's Photoshop File Formats Specification describes file data structures, not complete Photoshop rendering behavior.
- Future parser work still needs explicit decisions/tests for Unicode layer names, visibility flag semantics, group pairing, masks, clipping, additional layer info variants, decompression, and texture preview generation.
- Git status cannot prove authorship of pre-existing dirty discussion files, but the checked source/dependency/binary scopes show no Domain A edits.

## Recommended Next Domain Gate

Domain A can pass to Domain B.

Domain B should consume these artifacts as a parser-free basis only. It should define DTO/payload gates for adapter-supplied PSD profile results and deterministic parser-missing / unsupported-feature diagnostics, without adding a PSD parser dependency or claiming actual PSD byte parsing.
