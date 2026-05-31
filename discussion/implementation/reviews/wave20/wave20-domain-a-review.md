# Wave 20 Domain A Review

> Target: `wave20-psd-spec-field-matrix-and-sample-characterization`
> Reviewer: Review-Sylph independent clean-context review
> Reviewer context id: not exposed in this subagent context
> Verdict: `pass`

## Basis Reviewed

- `.agents/skills/implementation-orchestration/SKILL.md`
- `discussion/implementation/orchestration/wave20-plan.md`
- `discussion/design/module-contract-design-decisions.md`
- `discussion/design/module-contracts/package-file-format-contract.md`
- Adobe Photoshop File Formats Specification: https://www.adobe.com/devnet-apps/photoshop/fileformatashtml/
- `test_data/sample_model.psd`, limited to safe metadata/header/top-level offset verification

## Files Reviewed

- `discussion/implementation/waves/wave20/wave20-psd-spec-field-matrix.md`
- `discussion/implementation/waves/wave20/wave20-psd-sample-characterization.md`
- `discussion/implementation/reviews/wave20/wave20-domain-a-review.md`
- Repository state from `git status --short -uall` and `git diff --name-status`

## Files Changed By This Review

- `discussion/implementation/reviews/wave20/wave20-domain-a-review.md`

## Verification Performed

- Read the orchestration skill and Wave 20 plan to confirm Domain A scope, review separation, forbidden implementation, and downstream gate criteria.
- Read both Domain A artifacts directly. I did not rely on Gnome's explanation as the only source.
- Checked Adobe's official Photoshop File Formats Specification at `https://www.adobe.com/devnet-apps/photoshop/fileformatashtml/`, including:
  - preface / audience: the document describes data format, not full interpretation behavior;
  - Photoshop file structure: fixed header plus four variable length sections;
  - File Header, Color Mode Data, Image Resources, Layer and Mask Information, Layer Records, Channel Image Data, Additional Layer Information, and Image Data sections;
  - section divider / group-related tagged block coverage through Additional Layer Information.
- Re-ran sample metadata checks:
  - `Get-Item test_data\sample_model.psd | Select-Object FullName,Length`
  - `Get-FileHash -Algorithm SHA256 test_data\sample_model.psd`
  - PowerShell binary read of the fixed 26-byte header and top-level section length offsets only, matching the artifact's size, hash, header, and section offset values.
- Checked line anchors with:
  - `rg -n "Official source|Boundary Rule|MVP Profile Needs|Field Matrix|Header \||Color mode data|Image resources|Layer and mask info|Layer records|Channel image data|Additional layer info|Group / section divider|Mask \||Compression|Explicit Non-Claims|Stop / Escalate" discussion/implementation/waves/wave20/wave20-psd-spec-field-matrix.md`
  - `rg -n "Provenance|rights-cleared|File size|SHA-256|Safe Header Facts|Signature|Version|Color mode|Safe Top-Level|Image Resources length|Layer and Mask Info length|Image Data compression|Commands / Methods Used|Scope Limits|No claim|Stop / Escalate" discussion/implementation/waves/wave20/wave20-psd-sample-characterization.md`
  - `rg -n "imageDataCompression|Image Data payload start|Remaining bytes including compression|The Image Data compression code" discussion/implementation/waves/wave20/wave20-psd-sample-characterization.md`

Post-fix re-review:

- Re-read `discussion/implementation/waves/wave20/wave20-psd-sample-characterization.md`.
- Re-read this existing review report before updating it.
- Confirmed the narrow regression search returns no matches:
  - `rg -n "Image Data compression|imageDataCompression|payload start|Image Data payload|Remaining bytes including compression|RLE compressed|\$fs\.Position = \$imageDataOffset|Read-UInt16BE \$br" discussion/implementation/waves/wave20/wave20-psd-sample-characterization.md`
- Confirmed repository dirty state remains discussion-only:
  - `git status --short -uall`

## Findings

No open findings remain.

## Resolved Initial Finding

Initial finding: `wave20-psd-sample-characterization.md` recorded Image Data compression facts outside the agreed sample scope.

Status: resolved.

The post-fix sample characterization now states that no bytes inside the final Image Data Section were read or interpreted. It retains only `Image Data start` and `Remaining bytes from Image Data start`, with the remaining-byte value explicitly derived as `fileSizeBytes - imageDataStart`. The method block no longer seeks to `$imageDataOffset` or reads the final Image Data compression code.

## Passing Checks

- Official source grounding is otherwise sound. The field matrix maps Adobe's header, color mode data, image resources, layer/mask info, layer records, channel data, additional layer info, section divider, mask, and compression surfaces into supported/deferred/unsupported Wave 20 handling.
- The spec matrix is truthful about parser-free boundaries. It repeatedly states that Domain A does not decode PSD bytes into runtime model structures, extract rasters, interpret image resources, or render Photoshop features.
- No forbidden source/dependency/binary implementation was observed. Current dirty state before this review was limited to `discussion/implementation/**` files plus the untracked Wave 20 artifacts/plan.
- The sample artifact records the file as user-provided and rights-cleared, and it avoids layer count, layer names, layer tree, mask content, image resource interpretation, raster extraction, texture generation, and rendering claims.
- The matrix is actionable for Domain B/C/D: it covers layer/group identity, bounds, opacity, visibility, unsupported feature diagnostics, texture preview references, and target part mapping for `layered-character-psd-profile-v1`.
- Review separation is satisfied on this side: this report is an independent Review-Sylph artifact written under `discussion/implementation/reviews/wave20/**`. The Gnome context id/name was not exposed in this subagent call.

## Residual Risks

- This review did not parse layer records or image resources from `test_data/sample_model.psd`, by design.
- Adobe's specification is a data format specification, not a complete Photoshop rendering oracle. Future parser work still needs dedicated tests for visibility bit semantics, Unicode layer names, group pairing, clipping, masks, and additional layer info variants.
- Git state alone cannot prove which prior agent authored each dirty discussion file. It does show no app/package/source/dependency/binary files changed.

## Recommended Next Domain Gate

Domain A can pass to Domain B. The remaining review risks are future parser risks, not blockers for this parser-free field matrix and sample characterization gate.
