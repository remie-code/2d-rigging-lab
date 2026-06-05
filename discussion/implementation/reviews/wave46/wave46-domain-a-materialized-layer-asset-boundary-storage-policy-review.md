# Wave46 Domain A Review: Materialized Layer Asset Boundary / Storage Policy

> Target: `wave46-materialized-layer-asset-boundary-storage-policy`
> Date: 2026-06-05
> Reviewer: Review-Sylph independent reviewer
> Reviewed report: `discussion/implementation/waves/wave46/wave46-domain-a-materialized-layer-asset-boundary-storage-policy-report.md`

## Verdict

`pass`

No required fixes were found. The report is a documentation-only Domain A boundary artifact and its policy decisions are consistent with the Wave46 plan, the prior binary byte availability/storage/portable bundle contracts, and the Wave44/Wave45 PSD parser/materialization boundaries.

## Scope Reviewed And Basis Inspected

Reviewed directly, without relying on Gnome's completion summary:

- `discussion/implementation/waves/wave46/wave46-domain-a-materialized-layer-asset-boundary-storage-policy-report.md`
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
- `discussion/tests/fixtures/fixture-manifest.md`
- `discussion/tests/traceability/test-traceability-matrix.md`

## Design / Development Compliance Findings

- Pass: Domain A remains documentation-only. The reviewed report says it does not edit source, dependency manifests, lockfiles, fixture/traceability docs, or review artifacts at `discussion/implementation/waves/wave46/wave46-domain-a-materialized-layer-asset-boundary-storage-policy-report.md:12` and `:14`. This matches the Wave46 Domain A purpose and forbidden scope in `discussion/implementation/orchestration/wave46-plan.md:127` through `:147`.
- Pass: The selected-layer boundary is narrow. The report allows only explicit user-selected private/local PSD input and selected-layer materialized bytes at `:42` through `:52`, maps only to existing or user-created parts at `:80` through `:84`, and lists all-layer import, drag-drop, archive/filesystem, full compositing, renderer/pixel oracle, Cubism, and repo-side AI repair as non-goals at `:160` through `:177`. This matches `discussion/implementation/orchestration/wave46-plan.md:53` through `:60`.
- Pass: Parser dependency scope is preserved. The report keeps `@webtoon/psd` direct execution inside the approved Editor/browser adapter and existing Wave44 scripts, and requires package/validator evidence to stay parser-free at `:75`, `:122`, `:131`, `:148`, and `:158`. This aligns with Wave45 final evidence in `discussion/implementation/waves/wave45/wave45-domain-h-integration-review-and-final-report.md:49` through `:58` and the capability map at `discussion/implementation/current-capability-map.md:69` through `:75`.
- Pass: Storage/provenance semantics do not conflict with prior byte contracts. The report treats materialized bytes as project-local binary asset bytes with private/local provenance and `publicDemoAsset=false` at `:42` through `:52`, requires digest/byteLength/storage identity verification before availability at `:86` through `:116`, and tells downstream domains to escalate instead of bypassing storage contracts at `:52`. This is consistent with Wave31 stale verification rejection at `discussion/implementation/waves/wave31/domain-a-package-binary-byte-intake-contract-boundary-report.md:33` through `:36`, Wave34 byte availability mismatch handling at `discussion/implementation/waves/wave34/wave34-domain-a-byte-availability-contract-foundation-completion-report.md:19` through `:23`, Wave35 IndexedDB restore truthfulness at `discussion/implementation/reviews/wave35/wave35-clean-integration-review.md:27` through `:35`, and Wave36 portable bundle contract reuse of binary asset identity metadata at `discussion/implementation/waves/wave36/wave36-domain-a-orch-sylph-final-report.md:21` through `:23`.
- Pass: Source PSD bytes/raw parser objects are separated from derived project bytes. The report says raw parser objects and source PSD bytes are not persisted as project capability at `:46` through `:48` and `:110` through `:115`, while allowing only parser-free metadata/evidence and private/local materialized bytes through existing project binary storage rules.
- Pass: Portable inclusion wording is bounded. The report allows only project-defined portable JSON bundle inclusion of private/local materialized payloads with explicit provenance at `:50` through `:51` and `:115` through `:116`. It does not claim public distribution, public demo use, sample redistribution, ZIP/archive, native filesystem, File System Access API, drag-drop, cloud, or cross-profile sync.
- Pass: Media type and dependency policy are clear. The report records no new image encode/decode dependency and sets canonical raw RGBA as `application/vnd.ai-native-live2d.raw-rgba; pixelFormat=rgba8` at `:56` through `:59`. Encoded PNG/WebP paths are explicitly future-scope.
- Pass: Evidence minimums are adequate. The report requires source PSD digest/hash and byteLength, source layer ref/id/path/name, parser name/version, extraction options, mediaType, materialized digest/hash, byteLength, dimensions when available, private/local provenance, `publicDemoAsset=false`, storage refs, and byte availability refs at `:60` through `:75`.
- Pass: Destination part/drawable semantics stay on existing mechanisms. The report permits mapping to an existing part or user-created new part, uses existing generated/minimal mesh or drawable mechanisms, and forbids automatic retopology, UV unwrap, atlas packing, recursive group import, and full PSD-to-rig conversion at `:78` through `:84`.
- Pass: Stale source/missing bytes handling is explicit. The report requires re-materialization, reupload, or re-selection for source/materialized digest, byteLength, mediaType, parser, extraction option, dimension, storage identity, IndexedDB identity, portable payload identity, and storage verification mismatches at `:86` through `:106`.

## Test / Verification Adequacy Findings

- Pass: For a documentation-only boundary artifact, source tests are not required. The appropriate checks are direct basis inspection, path existence, whitespace/diff hygiene, and forbidden-positive-claim scanning.
- Pass: The reviewed report records report path inspection, `git diff --check -- discussion/implementation/waves/wave46`, and a forbidden-claim text scan at `discussion/implementation/waves/wave46/wave46-domain-a-materialized-layer-asset-boundary-storage-policy-report.md:179` through `:184`.
- Pass: This review adds the missing review-artifact side to the whitespace check by running `git diff --check -- discussion/implementation/waves/wave46 discussion/implementation/reviews/wave46` after creating this review artifact.

## Forbidden-Claim Scan Summary

The scan terms covered public demo/distributable/sample redistribution, all-layer import, drag-drop, archive/filesystem/File System Access API, full compositing, renderer/pixel oracle, texture sampling correctness, Cubism, repo-side AI repair/LLM/autofix, parser imports outside the approved boundary, raw parser object persistence, source PSD byte persistence, and encoded PNG/WebP workflow expansion.

All relevant hits in the reviewed report are negative, unsupported, conditional, downstream requirement, escalation, or non-goal wording. I found no risky positive claim.

## Required Fixes

None.

## Remaining Issues / User-Decision Points

- None for Domain A.
- Downstream domains should still escalate if implementation needs a new image encode/decode dependency, package/validator parser import, public/demo distribution wording, archive/filesystem/File System Access API semantics, Cubism compatibility, or a schema-breaking storage/portable bypass.

## Verification Performed

- Read the reviewed report directly with line numbers.
- Inspected all required basis documents listed above, narrowly for storage/provenance, parser boundary, evidence minimums, public/private fixture policy, and forbidden-scope claims.
- Created the required review artifact at `discussion/implementation/reviews/wave46/wave46-domain-a-materialized-layer-asset-boundary-storage-policy-review.md`.
- Confirmed `discussion/implementation/reviews/wave46` exists before writing this review artifact.
- Ran forbidden-claim text scans over the reviewed report and classified hits as negative/non-goal/downstream-boundary wording.
- Ran `git diff --check -- discussion/implementation/waves/wave46 discussion/implementation/reviews/wave46`: pass.
- Checked changed paths under `discussion/implementation/waves/wave46` and `discussion/implementation/reviews/wave46`; no source, dependency, fixture, traceability, backlog, capability map, or orchestration files were edited by this reviewer.

## Context Separation

Gnome and Review-Sylph contexts were separated. I reviewed the changed report and the basis documents directly and did not rely on Gnome's completion summary as the source of truth.
