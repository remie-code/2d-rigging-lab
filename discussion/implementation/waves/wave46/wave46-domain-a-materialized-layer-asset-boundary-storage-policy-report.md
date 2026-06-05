# Wave46 Domain A Report: Materialized Layer Asset Boundary / Storage Policy

> Target: `wave46-materialized-layer-asset-boundary-storage-policy`
> Date: 2026-06-05
> Author: Gnome documentation-editing agent
> Review status: separate Review-Sylph review passed; Domain H final integration also passed

## Status / Verdict

`pass`

Domain A found no policy conflict that blocks Wave46 from storing a user-selected PSD layer's materialized bytes as private/local project binary asset bytes, provided the downstream implementation stays inside the existing binary byte storage, same-origin browser-local persistence, and project-defined portable JSON bundle boundaries.

This report is policy/documentation only. It does not edit source, dependency manifests, lockfiles, fixture/traceability docs, or review artifacts.

## Basis Inspected

- `discussion/implementation/orchestration/wave46-plan.md`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/remaining-work-backlog.md`
- `discussion/implementation/waves/wave45/wave45-domain-h-integration-review-and-final-report.md`
- `discussion/implementation/reviews/wave45/wave45-domain-h-clean-integration-review.md`
- `discussion/implementation/waves/wave44/wave44-domain-d-psd-raster-layer-materialization-pilot-report.md`
- `discussion/implementation/reviews/wave44/wave44-domain-d-psd-raster-layer-materialization-pilot-review.md`
- `discussion/implementation/waves/wave45/wave45-domain-b-browser-psd-parser-bridge-session-evidence-report.md`
- `discussion/implementation/waves/wave45/wave45-domain-c-package-operation-psd-import-evidence-bridge-report.md`
- `discussion/implementation/waves/wave45/wave45-domain-e-validator-product-preflight-psd-import-diagnostics-report.md`
- `discussion/implementation/waves/wave31/domain-a-package-binary-byte-intake-contract-boundary-report.md`
- `discussion/implementation/waves/wave34/wave34-domain-a-byte-availability-contract-foundation-completion-report.md`
- `discussion/implementation/waves/wave35/wave35-final-report.md`
- `discussion/implementation/reviews/wave35/wave35-clean-integration-review.md`
- `discussion/implementation/waves/wave36/wave36-domain-a-orch-sylph-final-report.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/tests/fixtures/fixture-manifest.md`
- `discussion/tests/traceability/test-traceability-matrix.md`

## Boundary Decisions

### Storage And Provenance

- Materialized selected-layer bytes may be stored only when they were produced from explicit user-selected private/local PSD input.
- The stored object is a project-local binary asset byte payload, not a public sample, public demo, or distributable demo asset.
- Every materialized asset must carry private/local provenance and `publicDemoAsset=false`.
- Rights/provenance evidence must continue to distinguish the source PSD, the selected source layer, and the derived materialized binary asset.
- Raw parser objects are never persisted as project capability.
- Source PSD bytes are not persisted as project capability by this Wave46 boundary. If current PSD bytes are needed to re-materialize, the UI and validators must require reupload or re-selection.
- Browser-local persistence may use the existing same-origin IndexedDB byte storage semantics only when stored-record identity and digest/byteLength verification pass.
- IndexedDB persistence remains best-effort same-origin/browser-local storage. It is not cloud persistence, cross-profile persistence, native filesystem persistence, archive persistence, or an OS-level storage guarantee.
- A project-defined portable JSON bundle may include the materialized private/local project binary bytes as a private/local payload with explicit provenance.
- Portable inclusion must not use public distribution, public demo, or sample-redistribution wording.
- If a downstream domain finds that existing binary storage or portable bundle contracts reject this private/local materialized-byte use, it must return `escalate` rather than invent a bypass.

### MediaType And Evidence Minimums

- Wave46 Domain A does not approve a new image encode/decode dependency.
- The canonical media type for materialized selected-layer bytes in Wave46 is raw RGBA:
  `application/vnd.ai-native-live2d.raw-rgba; pixelFormat=rgba8`
- PNG, WebP, or other encoded texture media types require a future approved encode/decode dependency and are out of scope for Domain A.
- Minimum materialized asset evidence fields:
  - source PSD digest/hash, including algorithm
  - source PSD byteLength
  - source PSD evidence/ref when available
  - source layer ref/id/path/name
  - parser name and parser version
  - extraction options, including composition/effects flags and channel order
  - mediaType
  - materialized digest/hash, including algorithm
  - materialized byteLength
  - width/height when available
  - private/local provenance
  - `publicDemoAsset=false`
  - binary asset ref or storage ref when bytes are stored
  - byte availability evidence when bytes are current-session, IndexedDB-restored, portable-restored, missing, or stale
- Evidence must be parser-free outside the approved Editor/browser parser adapter and Wave44 scripts boundary.
- Raw RGBA byteLength should be consistent with width, height, and rgba8 channel count when dimensions are present.

### Destination Part / Drawable Semantics

- The selected PSD layer can map to an existing part or to a user-created new part.
- The operation should create or update texture/drawable/part mapping evidence using existing generated/minimal mesh or existing drawable mechanisms.
- Destination evidence must connect source PSD layer, materialized binary asset, texture ref, drawable ref, and destination part ref.
- Automatic retopology, UV unwrap, atlas packing, all-layer import, recursive group import, and full PSD-to-rig conversion are not part of this boundary.
- Texture-backed preview or viewer evidence remains semantic/product evidence. It does not prove texture sampling correctness, rendered pixel equality, Photoshop-equivalent compositing, or Cubism compatibility.

### Stale Source And Storage Identity Handling

The following states must require re-materialization, reupload, or re-selection. They must not silently treat stale bytes as current:

- source PSD digest/hash mismatch
- missing current PSD bytes when re-materialization is required
- missing materialized bytes
- stale materialized bytes
- materialized digest mismatch
- materialized byteLength mismatch
- mediaType mismatch
- source layer ref/id/path/name mismatch
- parser name/version mismatch
- extraction option mismatch
- width/height mismatch when dimensions are recorded
- binary asset ref mismatch
- IndexedDB stored-record identity mismatch
- portable payload identity mismatch
- storage evidence that lacks passing digest/byteLength verification

Wave31/Wave34/Wave35 already reject stale byte availability when expected digest, byteLength, mediaType, binary ref, package revision, or storage identity does not match. Wave46 materialized selected-layer assets must follow the same pattern.

### Save / Load / Portable Truthfulness

- Save/load may preserve parser-free metadata/evidence and private/local materialized binary bytes only through existing project binary byte storage rules.
- Save/load must not claim raw parser object persistence.
- Save/load must not claim source PSD byte persistence as project capability.
- After load, source PSD parse/session evidence may be absent or cleared. If current source bytes are required, the state must say reparse/reupload/re-selection is required.
- Materialized layer bytes may become available after load only when project binary byte storage or portable restored bytes pass digest/byteLength identity verification.
- Portable bundle support means the project-defined JSON bundle path only. It is not ZIP, archive writer/importer, native filesystem, File System Access API, directory picker, drag-drop, cloud transport, or cross-profile sync.
- Portable payloads that contain materialized bytes must preserve private/local provenance and `publicDemoAsset=false`.

## Downstream Requirements For Domains B-F

### Domain B: Browser Selected-Layer Materialization Service

- Use only the approved Editor/browser parser adapter boundary for direct parser execution.
- Return a private/local materialized asset candidate with the minimum evidence fields above.
- Emit raw RGBA bytes and raw RGBA mediaType unless a later approved dependency decision changes the boundary.
- Do not emit raw parser objects or parser stacks.
- Return structured failure evidence for unsupported layer type, materialization failure, oversize, missing layer, and parser failure.

### Domain C: Package / Operation Texture Intake And Part Mapping Bridge

- Accept parser-free materialized asset evidence and project binary asset refs only.
- Connect source layer, materialized asset, texture, drawable, and part mapping evidence without importing a PSD parser in `packages/**`.
- Preserve existing operation/package contract compatibility unless a real schema conflict is found; if found, return `escalate`.
- Treat stale/missing binary evidence as reupload or re-materialization required, not as current availability.

### Domain D: Editor Selected Layer Intake / Part Mapping UX

- Require explicit user action to materialize/add the selected layer to the project.
- Let the user choose an existing part or create a new part.
- Display destination part/drawable/texture summary, materialized digest/byteLength/mediaType, and private/local provenance.
- Display truthful recovery states for missing source PSD bytes, missing materialized bytes, stale identity, and browser-local storage unavailability.
- Do not add drag-drop, directory picker, File System Access API, archive, all-layer import, automatic retopology, UV unwrap, atlas packing, or public demo wording.

### Domain E: Validator / Product Preflight Materialized Asset Diagnostics

- Diagnose missing, stale, mismatched, or unavailable materialized bytes.
- Diagnose source PSD hash mismatch and parser/extraction option mismatch when evidence is present.
- Preserve private/local provenance and `publicDemoAsset=false` as explicit evidence, not as a public asset claim.
- Keep diagnostics parser-free; validator-core must not import or execute the PSD parser.
- Keep Product Preflight session-generated/read-only unless a later product decision changes that boundary.

### Domain F: Focused E2E / Persistence / Parser-Boundary Regression

- Cover the private/local `test_data/sample_model.psd` selected-layer path without claiming public sample distribution.
- Verify materialized asset digest/byteLength/mediaType, binary availability, texture/drawable/part summary, and private/local provenance.
- Verify save/load truthfulness: raw parser objects and source PSD bytes are not persisted as project capability.
- Verify browser-local restore only after digest/byteLength identity verification passes.
- Verify portable JSON bundle behavior only inside the project-defined private/local payload boundary, if portable coverage is implemented in Wave46.
- Keep parser direct import restricted to the approved Editor/browser adapter and existing Wave44 scripts.

## Non-Goals / Forbidden Positive Claims

Wave46 Domain A makes no positive claim for:

- public demo assets or distributable sample-derived material
- PSD all-layer import, recursive group import, or general PSD materialization
- drag-drop, directory picker, File System Access API, ZIP/archive, native filesystem, cloud, or cross-profile transport
- PNG image-set workflow expansion
- Photoshop-equivalent full compositing
- blend/effects/mask/clipping/color-management correctness
- texture sampling correctness
- renderer/pixel oracle or rendered acceptance oracle
- Cubism SDK/Core integration, Cubism import/export/load compatibility, `.moc3`, `.model3.json`, or Cubism Physics compatibility
- automatic retopology, UV unwrap, atlas packing, or topology correctness oracle
- repo-side AI repair generation/ranking, natural-language repair, LLM provider integration, auto-fix, or automatic commit
- Product Preflight persisted/exported artifact, CI gate, release gate, or demo gate

Negative, unsupported, and non-goal mentions of these terms are allowed in review and verification scans.

## Verification Performed

- Inspected the required report path after creation.
- Ran `git diff --check -- discussion/implementation/waves/wave46`.
- Ran a forbidden-claim text scan over this report for public demo/distributable wording, all-layer import, archive/filesystem, full compositing, renderer/pixel oracle, Cubism compatibility, source PSD byte persistence, and related scope-creep terms.
- The text scan found only policy, unsupported, downstream requirement, or non-goal references. No positive support claim was intentionally added.

## Remaining Issues / User-Decision Points

- No user decision is required for Domain A pass.
- Downstream domains must return `escalate` if implementation requires a new image encode/decode dependency, direct parser import in `packages/**` or validator-core, public/demo distribution wording, archive/filesystem/File System Access API semantics, Cubism compatibility, or a schema-breaking storage/portable bypass.
- Future product priority decisions remain outside Domain A: all-layer PSD import, drag-drop/archive/filesystem workflows, renderer/pixel oracle, advanced topology/UV/atlas work, public/demo asset policy, and Cubism policy reconsideration.

## Escalation / Blocker

None.

## Authorship / Review Separation

Gnome authored this Domain A report. Review-Sylph review is separate and pending.
