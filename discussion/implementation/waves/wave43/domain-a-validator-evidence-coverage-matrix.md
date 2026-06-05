# Wave43 Domain A: Validator / Evidence Coverage Matrix

## Scope

This inventory fixes the Wave43 Domain A foundation for diagnostic, evidence, and report surfaces added or affected across Waves31-W42. It covers the required target areas:

- byte availability
- persistent byte storage
- portable bundle
- transport capability
- topology/UV
- warp lattice
- Product Preflight
- Codex proposal

The artifact is a planning and evidence matrix for later Wave43 Domains B/C/D. It does not add product capability, does not rewrite the validator contract or diagnostic policy, and does not change public schemas, fixtures, product source, manifests, or lockfiles.

## Non-goals

- No Product Preflight persisted/exported package artifact, CI/release gate, demo gate, or external-tool Preflight artifact.
- No PSD/PNG parser, image decode, raster extraction, texture materialization, compositing, media header sniffing, archive writer/importer, File System Access API, directory picker, drag-drop implementation, native filesystem persistence, cloud/cross-profile persistence, renderer, pixel oracle, Cubism SDK/Core, Cubism import/export/load compatibility, Cubism Physics compatibility, LLM/provider, natural-language repair, auto-fix, repair candidate generation/ranking, automatic commit, or external proposal transport.
- No product source changes under `apps/editor/src/**`, no broad `packages/**` changes, no schema-breaking rename, and no fixture-wide churn.

## Inventory Method

Domain A used direct, focused repository search instead of adding a helper script. The search basis was:

- `discussion/implementation/orchestration/wave43-plan.md`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/remaining-work-backlog.md`
- `discussion/implementation/waves/wave42/wave42-final-report.md`
- `discussion/implementation/reviews/wave42/wave42-clean-integration-review.md`
- `discussion/design/module-contracts/validator-contract.md`
- `discussion/development_convention/diagnostic-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/tests/traceability/test-traceability-matrix.md`
- `discussion/tests/fixtures/fixture-manifest.md`
- `packages/validator-core/src/check-catalog.ts`

Concrete searches used for the inventory:

```powershell
rg -n "byteAvailability|portableBundle|transportCapability|topology|uv|warpLattice|Product Preflight|productPreflight|proposal|codex|checkId" packages/validator-core/src/check-catalog.ts
rg --files packages/validator-core/src packages/ai-interface/src packages/operation-core/src apps/editor/src | rg -i "product-preflight|codex-proposal|proposal|validation-report|runtime-evidence|operation-evidence|portable-bundle|byte|transport|topology|uv|warp-lattice"
rg -n -i "persistent byte|persistentByteStorage|IndexedDB|browser-local persistent|byte restore|same-origin" discussion/tests/traceability/test-traceability-matrix.md discussion/tests/fixtures/fixture-manifest.md fixtures/contracts packages/validator-core/src apps/editor/e2e apps/editor/src/editor-session apps/editor/src/editor-workflow
rg -n "evaluatePackageBinaryCurrentSessionByteAvailability|PackageBinaryCurrentSessionByteAvailability|availabilityStatus|validatorBytesAvailability|byteAvailability" packages/validator-core/src apps/editor/src/editor-session apps/editor/src/editor-state apps/editor/src/editor-workflow apps/editor/e2e/byte-intake-smoke.mjs fixtures/contracts/wave34-byte-availability-direct-call-fixtures
rg -n "schemaVersion|projectDefinedJsonBundleV0|portableBundle|transportCapability|SUPPORTED|digestMismatch|missingRequiredBinary|PackageTransport" apps/editor/src/editor-workflow/portable-bundle-workflow.ts apps/editor/src/editor-state/transport-capability-view-model.ts packages/validator-core/src/validators/portable-bundle-integrity.ts packages/validator-core/src/validators/package-transport-capability-diagnostics.ts packages/contracts/src/package-transport-capability.ts packages/contracts/src/product-preflight-report.ts apps/editor/e2e/portable-bundle-roundtrip-smoke.mjs
rg -n "addMeshVertex|addMeshTriangle|removeMeshVertex|moveMeshUvPoint|topologyRevision|uvCoordinateOutOfBounds|uvCountMismatch|mesh\.runtimeEvidence|topology|uv" packages/operation-core/src/operations/mesh-topology.ts packages/operation-core/src/mesh-topology-evidence.ts packages/operation-core/src/mesh-topology-uv-contract.test.ts packages/validator-core/src/validators/mesh-semantics.ts apps/editor/src/editor-workflow/mesh-topology-workflow.ts apps/editor/e2e/topology-uv-persistence-smoke.mjs
rg -n "warpLattice2d|controlPointOffsets|warpLattice|bilinear|runtimeEvidence|schemaVersion|createWarpLattice2dRigControl|bindRigControlChild" packages/validator-core/src/validators/warp-lattice-diagnostics.ts packages/validator-core/src/validators/warp-lattice-schema-issues.ts packages/validator-core/src/warp-lattice-diagnostics.test.ts packages/operation-core/src/operations/create-warp-lattice2d-rig-control.ts packages/operation-core/src/wave32-warp-lattice2d-contract-fixtures.test.ts apps/editor/src/editor-workflow/workflow-controller.test.ts fixtures/contracts/wave32-warp-lattice2d-contract-fixtures
rg -n "schemaVersion|operationCatalog|unsupportedBoundaries|unsupportedOperation|validateCodexProposal|previewCodexProposalDiff|createCodexProposalRerunValidationResult|approval|auto-fix|Generate proposal|external proposal|LLM|prompt|natural-language|automatic commit|repair" packages/ai-interface/src/ai-codex-proposal-operation-catalog.ts packages/ai-interface/src/ai-codex-proposal-validation.ts packages/ai-interface/src/ai-codex-proposal-command.ts packages/ai-interface/src/ai-codex-proposal-approval-lifecycle.ts packages/operation-core/src/codex-proposal-preview.ts packages/validator-core/src/codex-proposal-rerun-validation.ts fixtures/contracts/wave40-codex-proposal-fixtures
rg -n -i "byte availability|byteAvailability|persistentByteStorage|persistent byte|portableBundle|portable bundle|transportCapability|transport capability|topology|uv|warpLattice|warp lattice|Product Preflight|productPreflight|Codex proposal|codexProposal|proposal" discussion/design/module-contracts/validator-contract.md discussion/development_convention/diagnostic-policy.md discussion/development_convention/schema-and-id-conventions.md discussion/tests/traceability/test-traceability-matrix.md discussion/tests/fixtures/fixture-manifest.md
```

Search findings:

- `check-catalog.ts` registers `byteAvailability.*`, `persistentByteStorage.*`, `portableBundle.*`, `transportCapability.*`, `mesh.*`, and `rigControl.warpLattice*` check IDs.
- `product-preflight-report.ts` maps `byteAvailability.*` and `persistentByteStorage.*` to `assetBytes`, `portableBundle.*` and `transportCapability.*` to `persistenceTransport`, `mesh.*` to `meshTopologyUv`, and `rigControl.*` to `rigControlDynamics`.
- Traceability and fixture manifest rows exist for `TC-WAVE31-BYTE-SAMPLE-CHARACTERIZATION-001`, `TC-WAVE32-WARP-LATTICE2D-CONTRACT-001`, `TC-WAVE34-BYTE-AVAILABILITY-DIRECT-CALL-001`, `TC-WAVE36-PORTABLE-BUNDLE-ROUNDTRIP-E2E-001`, `TC-WAVE38-TOPOLOGY-UV-E2E-001`, `TC-WAVE39-PRODUCT-PREFLIGHT-STATES-001`, `TC-WAVE40-CODEX-PROPOSAL-FIXTURES-001`, and `TC-WAVE41-PRODUCT-PREFLIGHT-DIFF-FIXTURES-001`.
- Persistent byte storage has source/tests/e2e evidence and catalog IDs, but the traceability row coverage is implicit through `byte-intake-smoke.mjs` / portable bundle paths rather than a dedicated `TC-WAVE35-*` row.
- `validator-contract.md` already contains several Wave31-W42 surfaces, but the main check table is not complete for all `byteAvailability.*`, `persistentByteStorage.*`, and `portableBundle.*` IDs. It has Product Preflight hook prose and category/status vocabulary.
- `diagnostic-policy.md` and `schema-and-id-conventions.md` currently give generic ID/formal-candidate rules. They do not yet enumerate the newer namespace groups from Wave31-W42.

## Coverage Matrix Summary

| Area | Implementation/report source evidence | Current docs coverage | Wave43 target |
| --- | --- | --- | --- |
| Byte availability | `byteAvailability.*` catalog/validators, Wave34 fixtures, Editor byte availability bridge, Product Preflight byte evidence refs | Contract narrative present; check table incomplete; policy/schema generic; traceability row present | B/C/D sync ID families, formal status, and checker coverage |
| Persistent byte storage | `persistentByteStorage.*` catalog/validators/tests, Editor IndexedDB store/restore, byte-intake e2e | Contract narrative present; check table incomplete; traceability implicit | B/C/D add explicit docs/checker coverage without claiming storage guarantees |
| Portable bundle | `portableBundle.*` catalog/validator, Editor portable bundle workflow, Wave36 e2e, transport contract binding | Contract narrative present; check table incomplete; traceability row present | B/C/D sync project-defined JSON bundle v0 only |
| Transport capability | `transportCapability.*` catalog/validator, `PackageTransportCapability*` contracts, transport UI/e2e | Contract table/narrative present; policy/schema generic; traceability row present | B/C/D sync supported/future/dependency/unsupported boundary |
| Topology/UV | `mesh.*` catalog/validator, `mesh-topology` operations/evidence, Wave38 e2e | Contract table/rules strong; traceability row present | B/C/D preserve semantic-only wording and checker tokens |
| Warp lattice | `rigControl.warpLattice*` catalog/validator, operation fixture, runtime/viewer evidence | Contract table/rules strong; traceability row present | B/C/D preserve project-defined bilinear lattice boundary |
| Product Preflight | `ProductPreflightReportDto`, builder/diff, AI read/diff bridge, Wave39/41 fixtures | Contract hook present; policy/schema generic; traceability rows present | B/C/D sync category/status/evidence vocabulary and no artifact/gate claim |
| Codex proposal | Codex proposal catalog/validation/preview/rerun/approval, Wave40 fixtures | Traceability row present; policies generic; catalog boundary has local `codexProposal.*` and issue surfaces | B/C/D clarify proposal surface vs repo-side AI non-goals |

## Area Details

### 1. Byte Availability

Source evidence paths:

- `packages/validator-core/src/check-catalog.ts`
- `packages/validator-core/src/validators/byte-intake-availability-diagnostics.ts`
- `packages/validator-core/src/validators/byte-intake-preflight.ts`
- `packages/validator-core/src/byte-intake-availability.test.ts`
- `packages/validator-core/src/wave34-byte-availability-direct-call-fixture.test.ts`
- `fixtures/contracts/wave34-byte-availability-direct-call-fixtures/expected/direct-call-availability-summary.json`
- `fixtures/contracts/wave34-byte-availability-direct-call-fixtures/expected/validator-availability-diagnostics-summary.json`
- `apps/editor/src/editor-session/session-byte-availability-bridge.ts`
- `apps/editor/src/editor-state/binary-byte-intake-state.ts`
- `apps/editor/src/editor-workflow/product-preflight-workflow.ts`
- `apps/editor/e2e/byte-intake-smoke.mjs`
- `discussion/tests/traceability/test-traceability-matrix.md`
- `discussion/tests/fixtures/fixture-manifest.md`

Known check IDs / diagnostics / report and evidence surfaces:

- `binary.bytesMissing`
- `binary.byteLengthMismatch`
- `binary.digestMismatch`
- `binary.digestUnsupported`
- `binary.mediaTypeMismatch`
- `binary.assetIdMismatch`
- `byteAvailability.currentSessionBytes.missing`
- `byteAvailability.requiresReupload`
- `byteAvailability.verifiedSummary.stale`
- `byteAvailability.packageId.mismatch`
- `byteAvailability.packageRevision.mismatch`
- `byteAvailability.binaryAssetRef.mismatch`
- `byteAvailability.digest.mismatch`
- `byteAvailability.byteLength.mismatch`
- `byteAvailability.mediaType.mismatch`
- `byteAvailability.digest.unsupported`
- Product Preflight artifact kind: `byteAvailability`
- Product Preflight category mapping: `assetBytes`
- Wave traceability: `TC-WAVE31-BYTE-SAMPLE-CHARACTERIZATION-001`, `TC-WAVE34-BYTE-AVAILABILITY-DIRECT-CALL-001`

Current docs/policy/traceability coverage status:

- `validator-contract.md` has byte-intake preflight rules and explains `byteAvailability.*` behavior, but the main check table does not enumerate the full `byteAvailability.*` family.
- `diagnostic-policy.md` has generic formal/candidate rules but does not list the newer `byteAvailability.*` formal namespace.
- `schema-and-id-conventions.md` has generic dotted lower-camel check ID rules but no byte availability DTO/artifact vocabulary.
- Traceability has direct rows for Wave31 byte-only characterization and Wave34 direct-call byte availability.
- Fixture manifest has `wave34-byte-availability-direct-call-fixtures`.

Wave43 docs sync target:

- Domain B should keep byte availability as current-session/package-local byte evidence and must state that media type is declared metadata, not image decode.
- Domain C should add or group `byteAvailability.*` as formal, contract-backed diagnostics and connect `byteAvailability` Product Preflight artifact vocabulary to schema/id rules.
- Domain C should preserve the Wave31/Wave34 traceability rows and avoid implying persistent storage or parser support.

Wave43 checker target recommendation:

- Domain D should make the checker assert that `byteAvailability.` IDs are present in `check-catalog.ts`, represented in `validator-contract.md`, and covered by Wave31/Wave34 traceability or fixture rows.
- The checker should not require every expected JSON fixture to be parsed unless D deliberately scopes that as deterministic and narrow.

Unsupported/product-boundary notes:

- Byte availability proves selected/package-local bytes, length, SHA-256 digest, metadata, and rights/provenance evidence.
- It does not prove PSD/PNG parsing, header/layer semantics, image decode, raster extraction, texture materialization, archive import/export, File System Access API, drag-drop, full renderer, pixel oracle, or Cubism compatibility.

Open uncertainty:

- None blocking for Domain A. Later docs should decide how detailed the `byteAvailability.*` table expansion should be without turning the contract into a full copy of `check-catalog.ts`.

### 2. Persistent Byte Storage

Source evidence paths:

- `packages/validator-core/src/check-catalog.ts`
- `packages/validator-core/src/validators/persistent-byte-availability-diagnostics.ts`
- `packages/validator-core/src/persistent-byte-availability.test.ts`
- `apps/editor/src/editor-session/persistent-byte-store.ts`
- `apps/editor/src/editor-session/indexeddb-persistent-byte-store.ts`
- `apps/editor/src/editor-session/indexeddb-persistent-byte-store.test.ts`
- `apps/editor/src/editor-session/persistent-byte-restore.ts`
- `apps/editor/src/editor-workflow/workflow-persistent-byte-restore.test.ts`
- `apps/editor/src/editor-workflow/workflow-controller.ts`
- `apps/editor/e2e/byte-intake-smoke.mjs`
- `apps/editor/src/editor-workflow/portable-bundle-workflow.test.ts`

Known check IDs / diagnostics / report and evidence surfaces:

- `persistentByteStorage.backend.unavailable`
- `persistentByteStorage.backend.mismatch`
- `persistentByteStorage.record.missing`
- `persistentByteStorage.record.unverified`
- `persistentByteStorage.verification.missing`
- `persistentByteStorage.packageId.mismatch`
- `persistentByteStorage.packageRevision.mismatch`
- `persistentByteStorage.binaryAssetRef.mismatch`
- `persistentByteStorage.digest.mismatch`
- `persistentByteStorage.byteLength.mismatch`
- `persistentByteStorage.mediaType.mismatch`
- `persistentByteStorage.bytes.missing`
- `persistentByteStorage.digest.unsupported`
- Editor storage backend: `indexeddb-same-origin-browser-local-v1`
- Editor record schema: `editor-indexeddb-persistent-binary-byte-v1`
- Product Preflight artifact kind exists in contract: `persistentByteStorage`, while the current Product Preflight builder requires `byteAvailability` for `assetBytes`.
- Product Preflight category mapping for diagnostics: `assetBytes`

Current docs/policy/traceability coverage status:

- `validator-contract.md` has narrative coverage for `persistentByteStorage.*`, but the main check table does not enumerate the family.
- `diagnostic-policy.md` does not list `persistentByteStorage.*` as formal.
- `schema-and-id-conventions.md` does not mention persistent byte storage artifact/schema naming.
- Traceability has no dedicated `TC-WAVE35-*` row in the inspected matrix. Evidence is present through `byte-intake-smoke.mjs`, workflow tests, validator tests, and portable bundle import tests.

Wave43 docs sync target:

- Domain B should describe browser-local, same-origin, best-effort IndexedDB restore as verified evidence only, not as an OS/cloud/quota/private-browsing guarantee.
- Domain C should add `persistentByteStorage.*` formal namespace coverage and decide whether to register a narrow traceability note or row for the existing persistent byte restore evidence.
- Domain C must not claim `persistentByteStorage` as a required Product Preflight artifact unless the existing report builder contract is changed in a future source/schema wave.

Wave43 checker target recommendation:

- Domain D should assert `persistentByteStorage.` ID presence in `check-catalog.ts` and docs.
- If Domain C adds a traceability row, D can check that the row references existing tests/e2e only and does not claim new browser coverage beyond already executed smoke paths.

Unsupported/product-boundary notes:

- Persistent byte storage is same-origin browser-local IndexedDB evidence with deterministic verification and truthful fallback.
- It does not provide portable archive persistence, native filesystem access, cloud/cross-profile sync, quota/private-browsing guarantees, parser support, image decode support, renderer evidence, or pixel correctness.

Open uncertainty:

- Whether Wave43 C should add a dedicated traceability row for the existing persistent byte restore surface, or annotate existing Wave34/Wave36 rows. This is a documentation-scope decision for C, not a product decision.

### 3. Portable Bundle

Source evidence paths:

- `packages/validator-core/src/check-catalog.ts`
- `packages/validator-core/src/validators/portable-bundle-integrity.ts`
- `packages/validator-core/src/portable-bundle-integrity.test.ts`
- `apps/editor/src/editor-workflow/portable-bundle-workflow.ts`
- `apps/editor/src/editor-workflow/portable-bundle-workflow.test.ts`
- `apps/editor/e2e/portable-bundle-roundtrip-smoke.mjs`
- `packages/contracts/src/package-transport-capability.ts`
- `packages/contracts/src/product-preflight-report.ts`
- `discussion/tests/traceability/test-traceability-matrix.md`
- `discussion/tests/fixtures/fixture-manifest.md`

Known check IDs / diagnostics / report and evidence surfaces:

- `portableBundle.schemaInvalid`
- `portableBundle.unsupportedVersion`
- `portableBundle.missingPayload`
- `portableBundle.missingRequiredBinary`
- `portableBundle.digestMismatch`
- `portableBundle.byteLengthMismatch`
- `portableBundle.availabilityMismatch`
- `portableBundle.digestUnsupported`
- Supported bundle schema: `portable-package-bundle-v0`
- Supported bundle kind: `project-defined-json-bundle-v0`
- Supported payload encoding: `base64-v1`
- Product Preflight artifact kind: `portableBundle`
- Product Preflight category mapping for diagnostics: `persistenceTransport`
- Wave traceability: `TC-WAVE36-PORTABLE-BUNDLE-ROUNDTRIP-E2E-001`

Current docs/policy/traceability coverage status:

- `validator-contract.md` has narrative coverage for `portableBundle.*`, but its main check table does not enumerate the family.
- `diagnostic-policy.md` and `schema-and-id-conventions.md` do not list portable bundle namespaces or schema vocabulary.
- Traceability and fixture manifest have Wave36 portable bundle coverage.

Wave43 docs sync target:

- Domain B should state that `portableBundle.*` validates project-defined JSON portable bundle v0 evidence only.
- Domain C should add formal diagnostic namespace and schema/artifact vocabulary coverage for `portableBundle`.
- Domain C should keep Wave36 traceability as desktop/mobile Editor smoke plus contract fixture evidence, not generic archive/filesystem coverage.

Wave43 checker target recommendation:

- Domain D should assert `portableBundle.` ID presence in catalog/docs and that docs name `portable-package-bundle-v0` / project-defined JSON bundle v0 without ZIP/archive claims.

Unsupported/product-boundary notes:

- Portable bundle proves project-defined JSON bundle v0 base64 byte round-trip and digest/length validation.
- It does not claim ZIP/archive compatibility, File System Access API support, directory picker, drag-drop, native filesystem persistence, cloud transport, parser, image decode, renderer, pixel oracle, or Cubism compatibility.

Open uncertainty:

- None blocking for Domain A.

### 4. Transport Capability

Source evidence paths:

- `packages/validator-core/src/check-catalog.ts`
- `packages/validator-core/src/validators/package-transport-capability-diagnostics.ts`
- `packages/validator-core/src/package-transport-capability-diagnostics.test.ts`
- `packages/contracts/src/package-transport-capability.ts`
- `packages/contracts/src/package-transport-capability.test.ts`
- `apps/editor/src/editor-state/transport-capability-view-model.ts`
- `apps/editor/src/editor-state/transport-capability-view-model.test.ts`
- `apps/editor/src/ui/project-persistence/project-transport-capability-section.ts`
- `apps/editor/e2e/portable-bundle-roundtrip-smoke.mjs`
- `discussion/tests/traceability/test-traceability-matrix.md`

Known check IDs / diagnostics / report and evidence surfaces:

- `transportCapability.evidenceMissing`
- `transportCapability.schemaInvalid`
- `transportCapability.unsupported`
- `transportCapability.futureGated`
- `transportCapability.dependencyGated`
- Supported capability ID: `projectDefinedJsonBundleV0`
- Supported transport kind: `portableBundle`
- Unsupported/future/dependency-gated capability IDs include `standardArchiveZipV0`, `fileSystemAccessApiV0`, `directoryPickerV0`, `dragDropFileIntakeV0`, and `nativeFilesystemPersistenceV0`
- Product Preflight artifact kind: `transportCapability`
- Product Preflight category mapping for diagnostics: `persistenceTransport`
- Wave traceability: `TC-WAVE36-PORTABLE-BUNDLE-ROUNDTRIP-E2E-001` includes Wave37 transport capability truthfulness.

Current docs/policy/traceability coverage status:

- `validator-contract.md` already lists `transportCapability.*` in the check table and narrative.
- `diagnostic-policy.md` and `schema-and-id-conventions.md` do not list the transport capability namespace or capability ID vocabulary.
- Traceability row coverage is present through Wave36/Wave37 portable bundle and transport capability guard text.

Wave43 docs sync target:

- Domain B should keep transport capability separate from portable bundle integrity and byte availability.
- Domain C should add schema/id convention coverage for capability IDs, transport kinds, statuses, gates, and issue codes if needed.
- Domain C should keep traceability wording clear that unsupported/future/dependency-gated controls are disabled/unavailable and do not trigger forbidden APIs.

Wave43 checker target recommendation:

- Domain D should assert `transportCapability.` ID presence in catalog/docs and that the docs name only `projectDefinedJsonBundleV0` as supported.
- D may check for explicit unsupported boundary strings for archive/filesystem/File System Access/directory picker/drag-drop/native filesystem without interpreting those strings as implemented capabilities.

Unsupported/product-boundary notes:

- Transport capability is a truthfulness boundary for package transport evidence.
- It does not implement archive/filesystem transport, File System Access API, directory picker, drag-drop event path, native filesystem persistence, cloud transport, parser/decode, full renderer, pixel oracle, or Cubism compatibility.

Open uncertainty:

- None blocking for Domain A.

### 5. Topology/UV

Source evidence paths:

- `packages/validator-core/src/check-catalog.ts`
- `packages/validator-core/src/validators/mesh-semantics.ts`
- `packages/validator-core/src/mesh-topology-diagnostics.test.ts`
- `packages/operation-core/src/operations/mesh-topology.ts`
- `packages/operation-core/src/mesh-topology-evidence.ts`
- `packages/operation-core/src/mesh-topology-uv-contract.test.ts`
- `apps/editor/src/editor-workflow/mesh-topology-workflow.ts`
- `apps/editor/src/editor-session/mesh-topology-command.ts`
- `apps/editor/src/ui/drawable-authoring/mesh-topology-controls.ts`
- `apps/editor/e2e/topology-uv-persistence-smoke.mjs`
- `fixtures/contracts/wave38-topology-uv-fixture-e2e/**`
- `discussion/tests/traceability/test-traceability-matrix.md`
- `discussion/tests/fixtures/fixture-manifest.md`

Known check IDs / diagnostics / report and evidence surfaces:

- `mesh.triangleIndexOutOfRange`
- `mesh.degenerateTriangle`
- `mesh.duplicateTriangle`
- `mesh.orphanedVertex`
- `mesh.vertexStableIdsLengthMismatch`
- `mesh.uvCountMismatch`
- `mesh.triangleStableIdsLengthMismatch`
- `mesh.uvCoordinateOutOfBounds`
- `mesh.runtimeEvidenceMissing`
- `mesh.runtimeEvidenceMismatch`
- Operation diagnostics include `operation.addMeshVertex.*`, `operation.removeMeshVertex.*`, `operation.addMeshTriangle.*`, `operation.removeMeshTriangle.*`, `operation.moveMeshUvPoint.*`, and `operation.<type>.topologyRevisionMismatch`
- Operation evidence schema: `mesh-topology-operation-evidence-v1`
- Product Preflight category mapping: `meshTopologyUv`
- Wave traceability: `TC-WAVE38-TOPOLOGY-UV-E2E-001`

Current docs/policy/traceability coverage status:

- `validator-contract.md` has strong table and rule coverage for `mesh.*`, including UV count/out-of-bounds, runtime evidence, and semantic-only boundary.
- `diagnostic-policy.md` lists only a smaller older subset such as `mesh.triangleIndexOutOfRange`.
- `schema-and-id-conventions.md` has generic ID rules but no topology evidence vocabulary.
- Traceability and fixture manifest have Wave38 topology/UV coverage.

Wave43 docs sync target:

- Domain B should preserve current validator-contract detail and ensure it includes bounded topology/UV edits as semantic evidence only.
- Domain C should decide whether to group `mesh.*` formal coverage by namespace instead of listing every ID in policy.
- Domain C should keep Wave38 traceability and avoid upgrading it into renderer/texture correctness.

Wave43 checker target recommendation:

- Domain D should assert representative `mesh.*` IDs and `meshTopologyUv` category coverage in catalog/docs/traceability.
- D should not require full operation-core operation diagnostics to be in validator-core `check-catalog.ts` unless C/B decide those are formal validator diagnostics.

Unsupported/product-boundary notes:

- Topology/UV proves bounded add/remove vertex/triangle and semantic UV nudge/materialization through package/runtime/viewer/validator evidence.
- It does not prove automatic triangulation, retopology, UV unwrap, atlas packing, real texture decode, texture sampling correctness, full renderer, pixel oracle, external dependency, or Cubism compatibility.

Open uncertainty:

- Whether operation-level topology diagnostics should be named in Wave43 policy as operation diagnostics or kept outside the validator check catalog. This is a C/D design boundary, not a product decision.

### 6. Warp Lattice

Source evidence paths:

- `packages/validator-core/src/check-catalog.ts`
- `packages/validator-core/src/validators/warp-lattice-diagnostics.ts`
- `packages/validator-core/src/validators/warp-lattice-schema-issues.ts`
- `packages/validator-core/src/warp-lattice-diagnostics.test.ts`
- `packages/operation-core/src/operations/create-warp-lattice2d-rig-control.ts`
- `packages/operation-core/src/wave32-warp-lattice2d-contract-fixtures.test.ts`
- `apps/editor/src/editor-workflow/workflow-controller.test.ts`
- `fixtures/contracts/wave32-warp-lattice2d-contract-fixtures/**`
- `discussion/tests/traceability/test-traceability-matrix.md`
- `discussion/tests/fixtures/fixture-manifest.md`

Known check IDs / diagnostics / report and evidence surfaces:

- `rigControl.warpLatticeCardinalityMismatch`
- `rigControl.warpLatticeDomainBoundsInvalid`
- `rigControl.warpLatticeRestControlPointMismatch`
- `rigControl.warpLatticeUnsupportedProperty`
- `rigControl.warpLatticeMalformedPatch`
- `rigControl.warpLatticeRuntimeEvidenceMismatch`
- Related general rig evidence IDs: `rigControl.runtimeEvidenceMissing`, `viewer.runtimeEvidenceMissing`
- Operation diagnostics include `operation.createWarpLattice2dRigControl.*`, `operation.bindRigControlChild.*`, and keyform target/property diagnostics.
- Runtime/evidence terms: `warpLattice2d`, `controlPointOffsets`, `bilinear-grid-v1`
- Product Preflight category mapping: `rigControlDynamics`
- Wave traceability: `TC-WAVE32-WARP-LATTICE2D-CONTRACT-001`

Current docs/policy/traceability coverage status:

- `validator-contract.md` has strong table and rule coverage for `rigControl.warpLattice*`.
- `diagnostic-policy.md` lists older rig-control IDs but not the warp lattice namespace.
- `schema-and-id-conventions.md` has generic ID rules but no `warpLattice2d` / `controlPointOffsets` vocabulary.
- Traceability and fixture manifest have Wave32 warp lattice coverage.

Wave43 docs sync target:

- Domain B should preserve the current validator-contract semantics and explicitly keep warp lattice project-defined.
- Domain C should add or group formal warp lattice diagnostic coverage and stable machine vocabulary.
- Domain C should keep traceability tied to semantic JSON/runtime evidence, not Cubism deformer compatibility.

Wave43 checker target recommendation:

- Domain D should assert `rigControl.warpLattice` IDs and `rigControlDynamics` category coverage in catalog/docs/traceability.

Unsupported/product-boundary notes:

- Warp lattice proves project-defined `warpLattice2d` rig control semantics, `controlPointOffsets` keyforms, and semantic bilinear runtime evidence.
- It does not prove Cubism deformers, Cubism Physics, `.moc3`, `.model3.json`, image bytes, parser/decode, renderer, pixel oracle, archive/filesystem, or dependency expansion.

Open uncertainty:

- None blocking for Domain A.

### 7. Product Preflight

Source evidence paths:

- `packages/contracts/src/product-preflight-report.ts`
- `packages/contracts/src/product-preflight-report-diff.ts`
- `packages/validator-core/src/product-preflight-report.ts`
- `packages/validator-core/src/product-preflight-report.test.ts`
- `packages/validator-core/src/product-preflight-report-diff.ts`
- `packages/validator-core/src/product-preflight-report-diff-changes.ts`
- `packages/validator-core/src/product-preflight-report-diff-fixtures.test.ts`
- `packages/validator-core/src/wave39-product-preflight-report-states-fixture.test.ts`
- `packages/ai-interface/src/ai-product-preflight-observation.ts`
- `packages/ai-interface/src/ai-product-preflight-command.ts`
- `packages/ai-interface/src/ai-product-preflight-command-fixtures.test.ts`
- `apps/editor/src/editor-workflow/product-preflight-workflow.ts`
- `apps/editor/src/editor-workflow/product-preflight-comparison-workflow.ts`
- `apps/editor/src/editor-workflow/product-preflight-read-diff-bridge.ts`
- `apps/editor/src/ui/product-preflight/**`
- `fixtures/contracts/wave39-product-preflight-report-states/**`
- `fixtures/contracts/wave41-product-preflight-diff-fixtures/**`
- `discussion/tests/traceability/test-traceability-matrix.md`
- `discussion/tests/fixtures/fixture-manifest.md`

Known check IDs / diagnostics / report and evidence surfaces:

- Report DTO schema: `product-preflight-report-v0`
- Diff DTO schema: `product-preflight-report-diff-v0`
- Required categories: `modelStructure`, `authoringWorkflowEvidence`, `runtimeViewerEvidence`, `meshTopologyUv`, `composition`, `rigControlDynamics`, `assetBytes`, `persistenceTransport`, `tutorialDemoReadiness`, `unsupportedClaims`
- Status values: `pass`, `warn`, `fail`, `not_supported`, `not_evaluated`
- Artifact kinds include `byteAvailability`, `persistentByteStorage`, `portableBundle`, `transportCapability`, `validationReport`, `runtimeSnapshot`, `operationLog`, `guiEvidence`, `aiTranscript`, and tutorial/demo evidence.
- Product Preflight uses targeted diagnostic refs; it does not introduce a separate `productPreflight.*` check ID family in `check-catalog.ts`.
- Wave traceability: `TC-WAVE39-PRODUCT-PREFLIGHT-STATES-001`, `TC-WAVE41-PRODUCT-PREFLIGHT-DIFF-FIXTURES-001`

Current docs/policy/traceability coverage status:

- `validator-contract.md` has a Product Preflight hook with categories/statuses and unsupported non-goals.
- `diagnostic-policy.md` does not describe Product Preflight category/status/report vocabulary.
- `schema-and-id-conventions.md` does not list Product Preflight ID prefixes, DTO/schema names, report IDs, evidence IDs, claim IDs, blocking reason IDs, or action IDs.
- Traceability and fixture manifest have Wave39 and Wave41 rows.

Wave43 docs sync target:

- Domain B should explain Product Preflight as an additive product-level report over targeted diagnostics/evidence, not a replacement for `ValidationReportDto`.
- Domain C should add schema/id vocabulary for report IDs, evidence refs, category IDs, statuses, unsupported/not-evaluated outcomes, and diff surface as needed.
- Domain C should keep Wave39/Wave41 traceability as rights-clean semantic JSON evidence only.

Wave43 checker target recommendation:

- Domain D should assert that Product Preflight docs mention the ten categories, five statuses, and no persisted/exported artifact, release/demo gate, parser/archive/renderer/Cubism/LLM/autofix claims.
- D can check that `product-preflight-report.ts` category mappings include the key ID prefixes from this matrix.

Unsupported/product-boundary notes:

- Product Preflight v0 is session-generated, read-only report/diff/read/rerun affordance surface.
- It does not add persisted/exported package artifacts, release gates, demo gates, external-tool artifacts, repair system, parser/archive/filesystem validator, renderer oracle, pixel oracle, or Cubism compatibility proof.

Open uncertainty:

- Whether Domain C should register `persistentByteStorage` as Product Preflight artifact vocabulary even though the current builder requires `byteAvailability` for `assetBytes`. This should be worded as contract vocabulary, not required current-builder input.

### 8. Codex Proposal

Source evidence paths:

- `packages/contracts/src/codex-proposal.ts`
- `packages/contracts/src/codex-proposal-operation-catalog.ts`
- `packages/contracts/src/codex-proposal-results.ts`
- `packages/ai-interface/src/ai-codex-proposal-operation-catalog.ts`
- `packages/ai-interface/src/ai-codex-proposal-validation.ts`
- `packages/ai-interface/src/ai-codex-proposal-command.ts`
- `packages/ai-interface/src/ai-codex-proposal-approval-lifecycle.ts`
- `packages/operation-core/src/codex-proposal-preview.ts`
- `packages/validator-core/src/codex-proposal-rerun-validation.ts`
- `apps/editor/src/editor-workflow/codex-proposal-review-workflow.ts`
- `apps/editor/src/editor-workflow/codex-proposal-preview-preflight.ts`
- `apps/editor/src/ui/codex-proposal-review/**`
- `fixtures/contracts/wave40-codex-proposal-fixtures/**`
- `discussion/tests/traceability/test-traceability-matrix.md`
- `discussion/tests/fixtures/fixture-manifest.md`

Known check IDs / diagnostics / report and evidence surfaces:

- Proposal DTO schema: `codex-rigging-edit-proposal-v0`
- Operation catalog schema: `codex-proposal-operation-catalog-v0`
- AI command request/response schemas: `ai-codex-proposal-command-request-v0`, `ai-codex-proposal-command-response-v0`
- Validation result schema: `codex-proposal-validation-result-v0`
- Diff preview result schema: `codex-proposal-diff-preview-result-v0`
- Rerun validation result schema: `codex-proposal-rerun-validation-result-v0`
- Approval evidence response schema: `codex-proposal-approval-evidence-response-v0`
- Rerun check IDs: `codexProposal.rerunValidation.notEvaluated`, `codexProposal.rerunValidation.proposalMismatch`, `codexProposal.rerunValidation.validationNotReady`, `codexProposal.rerunValidation.previewMismatch`, `codexProposal.rerunValidation.previewNotReady`, `codexProposal.rerunValidation.packageMismatch`, `codexProposal.rerunValidation.staleEvidence`
- Preview check ID: `codexProposal.preview.unsupportedOperation`
- Validation issue codes include `schemaInvalid`, `operationCatalogMismatch`, `operationCatalogMissing`, `unsupportedOperation`, and `unsupportedBoundary`
- Unsupported boundary kinds include `repoSideProposalGeneration`, `repairCandidateGeneration`, `candidateRanking`, `llmProvider`, `naturalLanguageRepair`, `autoFix`, `automaticCommit`, `externalTransport`, `parserImageDecode`, `archiveFilesystem`, `rendererPixelOracle`, and `cubismCompatibility`
- Wave traceability: `TC-WAVE40-CODEX-PROPOSAL-FIXTURES-001`; Wave41 uses Product Preflight read/diff command bridge.

Current docs/policy/traceability coverage status:

- `validator-contract.md` has older AI/repair candidate concepts and Product Preflight hook wording, but it does not yet clearly inventory the Wave40 Codex proposal command/catalog/preview/rerun/approval surfaces.
- `diagnostic-policy.md` has generic AI diagnostic examples but does not classify `codexProposal.*`, proposal issue codes, or unsupported boundary vocabulary.
- `schema-and-id-conventions.md` has generic DTO/ID rules but no Codex proposal DTO/evidence ID vocabulary.
- Traceability and fixture manifest have Wave40 and Wave41 coverage.

Wave43 docs sync target:

- Domain B should mention Codex proposal only as deterministic validation/preview/rerun/approval/report evidence surface where it intersects validator/report behavior.
- Domain C should clarify whether `codexProposal.*` are formal validator diagnostics, proposal-local diagnostics, or issue-code surfaces. It should also document unsupported boundary vocabulary without claiming repo-side repair/generation capability.
- Domain C should preserve approval-gated commit semantics and no automatic commit.

Wave43 checker target recommendation:

- Domain D should verify that Codex proposal docs mention operation catalog, validation, diff preview, rerun validation, approval gate, and unsupported boundaries.
- D should not require `codexProposal.*` to be in `check-catalog.ts` unless B/C decide that catalog registration is the intended boundary.

Unsupported/product-boundary notes:

- Codex proposal support is deterministic intake, operation catalog, validation, dry-run diff preview, rerun validation/Product Preflight bridge, approval lifecycle, transcript/evidence recording, and Editor review workflow.
- The repo does not generate proposals, generate/rank repair candidates, host an LLM/provider/prompt loop, convert natural-language repair text, auto-fix invalid proposals, commit automatically, provide external proposal transport, parse/decode images, implement archive/filesystem package transport, render pixel oracles, or prove Cubism compatibility.

Open uncertainty:

- The catalog boundary for `codexProposal.*` is the main open design point for C/D. Current source emits proposal/rerun check IDs and issue codes, while `check-catalog.ts` does not register a `codexProposal.*` family.

## Boundary For Later Domains

### Domain B: Validator Contract Prose Refresh

Domain B may safely sync:

- `validator-contract.md` check table and prose with the check ID families and report/evidence surfaces listed here.
- Product Preflight categories/statuses and the fact that it aggregates targeted diagnostics/evidence refs.
- Unsupported boundaries for byte intake, persistent storage, portable bundle, transport, topology/UV, warp lattice, Product Preflight, and Codex proposal.

Domain B must keep out of scope:

- Source code edits.
- Diagnostic policy/schema convention/traceability edits.
- Claims that Product Preflight is persisted/exported, a release/demo gate, or an external-tool artifact.
- Claims that byte/storage/bundle/transport/topology/warp/proposal surfaces implement parser/decode/archive/filesystem/renderer/pixel/Cubism/LLM/autofix/external transport capability.

### Domain C: Diagnostic Policy / Schema Convention / Traceability Sync

Domain C may safely sync:

- Formal namespace grouping for `byteAvailability.*`, `persistentByteStorage.*`, `portableBundle.*`, `transportCapability.*`, representative `mesh.*`, `rigControl.warpLattice*`, Product Preflight report vocabulary, and Codex proposal issue/check vocabulary.
- Schema/id convention vocabulary for Product Preflight IDs, artifact refs, transport capability IDs/status/gates/issues, portable bundle schema/kind, and Codex proposal DTO/evidence IDs.
- Traceability rows or notes where current source/tests already exist, especially persistent byte storage if C chooses a dedicated registration.

Domain C must keep out of scope:

- Source/schema changes, public schema-breaking rename, fixture-wide churn, validator-contract rewrite, product capability claims, and new product tests.
- Treating `codexProposal.*` as catalog-backed formal validator diagnostics unless C explicitly records that boundary for D.

### Domain D: Catalog Coverage Checker And Tests

Domain D may safely add a deterministic checker or narrow test that verifies representative consistency among:

- this matrix,
- `packages/validator-core/src/check-catalog.ts`,
- `validator-contract.md`,
- `diagnostic-policy.md` / `schema-and-id-conventions.md` after C,
- traceability/fixture manifest rows for Wave31, Wave32, Wave34, Wave36, Wave38, Wave39, Wave40, and Wave41.

Recommended checker assertions:

- Required catalog families exist for `byteAvailability.`, `persistentByteStorage.`, `portableBundle.`, `transportCapability.`, `mesh.`, and `rigControl.warpLattice`.
- `validator-contract.md` mentions representative IDs and unsupported boundaries for the eight target areas.
- Product Preflight docs mention the ten categories, five statuses, and no persisted/exported artifact or gate claim.
- Codex proposal docs mention deterministic validation/preview/rerun/approval and unsupported boundary kinds without repo-side generation/LLM/autofix/external transport claims.
- Traceability includes the existing Wave31/Wave32/Wave34/Wave36/Wave38/Wave39/Wave40/Wave41 evidence rows, and any new persistent byte storage row C adds.

Domain D must keep out of scope:

- Product source changes under `apps/editor/src/**`.
- Broad `packages/**` implementation changes.
- Schema-breaking rename or fixture-wide churn.
- External dependencies, manifest/lockfile changes, parser/archive/filesystem/renderer/Cubism/LLM/autofix/external transport work.

## Provisional Assumptions

- Wave42 is complete and is the repository safety baseline for Wave43.
- Domain A uses direct search evidence and does not need a helper script.
- Product Preflight remains session-generated and read-only. Its read/diff/rerun surfaces are implementation-proven, but persistence/export/release/demo gates remain out of scope.
- Persistent byte storage is browser-local same-origin IndexedDB evidence with truthful fallback; it is not a durable portability or OS-level storage guarantee.
- Codex proposal support is deterministic proposal handling and approval lifecycle support; proposal generation and repair reasoning remain Codex-side responsibilities.

## User-decision Points

None required for Domain A.

Future product priority decisions remain outside Wave43 Domain A: archive/filesystem, real parser/decode, renderer/pixel oracle, advanced topology/UV, layer tree UX, public/demo assets, Product Preflight durability/export, acceptance/demo gates, and Cubism policy reconsideration.
