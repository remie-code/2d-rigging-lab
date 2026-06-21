# Validator Profile Design

> Status: Draft design for test evidence planning. This is not implementation code.

## Purpose

Validator profiles define how the same diagnostics are interpreted for different consumers: editor warnings, viewer diagnostics, strict package checks, MVP acceptance, and AI dry-run review.

The validator detects package, runtime, rights, GUI evidence, AI evidence, and demo-safe issues. The Acceptance Runner consumes validator reports and other artifacts to produce AC-level `pass`, `fail`, or `needs_review` decisions.

## Basis Separation

### Repository Facts

- Shared severity values are `info`, `warning`, `error`, and `blocking`.
- Shared check statuses are `pass`, `warning`, `fail`, `needs_review`, and `not_applicable`.
- Current validation profile IDs are `editorIncremental`, `viewer`, `strict`, `acceptance`, and `aiDryRun`.
- Runtime strictness values include `interactive`, `strict`, `acceptance`, and `demoSafe`.
- Validator report schema includes package identity, profile, related scenarios, summary, checks, repair candidates, and evidence refs.
- `acceptance` validation fails missing GUI evidence and blocking checks.
- `aiDryRun` validation blocks mutation without approval or target ambiguity.

### Design Decisions

- Do not add a new validator profile ID for demo-safe until the shared contract changes. Demo-safe behavior is an evidence facet using `acceptance` or `strict` validation plus `RuntimeEvaluationContextDto.policy.strictness="demoSafe"` where runtime replay is involved.
- Rights, demo-safe, GUI evidence, AI evidence, and dynamics replay are profile facets. They influence gate behavior but do not replace the five existing validator profiles.
- Severity and status remain separate. Severity describes impact; status describes profile-specific outcome.
- Missing required evidence must be represented as diagnostics or explicit missing-evidence entries, not silently ignored.
- The validator must not use external proprietary model formats, SDK/Core behavior, viewer matching, physics compatibility, or existing external models as an oracle.

### Assumptions

- Check registry entries will carry enough metadata for profile-specific status mapping.
- Acceptance manifests will identify which evidence facets are required per fixture.
- Demo-safe wording and visual review thresholds may change, so those checks should be traceable and reviewable.

### Items Requiring Hands-on Verification

- Final check registry storage format.
- Actual mapping from check IDs to UI jump targets.
- Whether demo preflight report is produced by validator-core alone or by validator-core plus viewer-ui capture metadata.
- Exact report diff format used by AI repair suggestions.

## Profile Behavior

| Profile ID | Primary consumer | Inputs | Behavior |
|---|---|---|---|
| `editorIncremental` | GUI editor | Dirty authoring graph and target IDs | Fast feedback. Warnings are allowed. Blocks only destructive invalid commits or impossible edits. |
| `viewer` | Private viewer | Saved package and runtime snapshot | Fails non-loadable packages. Reports runtime diagnostics and package references needed for inspection. |
| `strict` | Contract and package tests | Package plus representative runtime evaluation | Fails on `blocking` or `error`. May escalate warnings when contract fixtures require exact behavior. |
| `acceptance` | Acceptance Runner | Package, operation log, runtime snapshots, scenario evidence, supplemental evidence | Fails missing required GUI evidence, rights failures, blocking checks, required dynamics replay failures, and AI evidence failures. Produces AC/scenario-linked report evidence. |
| `aiDryRun` | AI assistant and operation review | Baseline graph, temporary graph, diffs, validation report | Requires dry-run isolation, target disambiguation, diffs, repair provenance, and human approval before commit. |

## Profile Facets

Facets are evidence dimensions applied by manifests and runner gates.

| Facet ID | Applies to profiles | Required evidence |
|---|---|---|
| `facet.rightsProvenance` | `strict`, `acceptance`, `aiDryRun` | Source asset metadata, license/permission, author, AI-use flags, display/reuse flags, generated artifact lineage. |
| `facet.guiEvidence` | `acceptance` | `operations/log.jsonl`, operation IDs, semantic GUI evidence, optional captures. |
| `facet.dynamicsReplay` | `strict`, `acceptance`, `aiDryRun` | Initial state, input frame hash, context, evaluator versions, fixed timestep, state sequence, runtime snapshot sequence. |
| `facet.demoSafe` | `acceptance`, sometimes `viewer` | Demo preflight report, allowed capture state, redacted fields, safe public wording, capture classification. |
| `facet.aiEvidence` | `aiDryRun`, `acceptance` | AI command transcript, dry-run result, model/runtime/validation diffs, repair candidates, approval boundary proof. |

Facets should be declared by fixture/test manifests so the validator and runner know which evidence is required.

## Diagnostic Handling

### Severity to Status

Default profile mapping:

| Severity | `editorIncremental` | `viewer` | `strict` | `acceptance` | `aiDryRun` |
|---|---|---|---|---|---|
| `info` | `pass` | `pass` | `pass` | `pass` | `pass` |
| `warning` | `warning` | `warning` | `needs_review` unless check registry says fail | `needs_review` unless required evidence makes it fail | `needs_review` unless target or approval safety is affected |
| `error` | `warning` or `fail` for destructive commit | `fail` if package/runtime cannot load | `fail` | `fail` | `fail` |
| `blocking` | `fail` | `fail` | `fail` | `fail` | `fail` |

Check registry entries can override this mapping for a profile. Examples:

- `rights.provenanceMissing` is `error` and fails `acceptance`.
- `evidence.guiOperationLogMissing` is `blocking` and fails `acceptance`.
- `ai.dryRunMutatedPackage` is `blocking` and fails `aiDryRun` and `acceptance`.
- `runtime.stateSequenceLengthMismatch` may warn in interactive contexts but fails strict, acceptance, or demo-safe replay evidence.
- `rigControl.warpBindingOutsideDomain` can become `needs_review` for acceptance. Current vertices leaving a parent warp visual domain after child deformation are not a warning by themselves when rest / bind membership remains valid.

### Required Diagnostic Fields

Each diagnostic result used by acceptance must include:

- stable check ID with no spaces;
- severity;
- profile-resolved status;
- target kind and target ID where applicable;
- target path or jump target when available;
- related AC and scenario IDs;
- evidence refs such as operation IDs, snapshot IDs, runtime state refs, and diff IDs;
- repair candidate IDs when repair is possible;
- human-readable impact and remediation note.

Diagnostics must be deterministic for the same package, profile, runtime context, input sequence, and fixture manifest.

### Diagnostic Registry Status

Acceptance oracles use two registry statuses:

- `formal`: the diagnostic is present in `discussion/design/module-contracts/validator-contract.md` and can be used by `mvp-blocking` tests.
- `candidate`: the diagnostic is a design candidate only. It may appear in notes or future fixtures, but an `mvp-blocking` test must also have a formal diagnostic or an explicit expected artifact oracle.

Formal diagnostics required by the current traceability matrix:

| Diagnostic ID | Status | Acceptance use |
|---|---|---|
| `rights.provenanceMissing` | `formal` | Missing source rights/provenance blocks intake and demo acceptance. |
| `ref.drawableTextureMissing` | `formal` | Visible drawable texture reference failure. |
| `mesh.triangleIndexOutOfRange` | `formal` | Invalid mesh triangle index. |
| `mask.sourceMissing` | `formal` | Missing mask source blocks composition evidence. |
| `keyform.missingEndpoint` | `formal` | One-axis keyform endpoint omission. |
| `keyform.grid2dMissingKey` | `formal` | Missing two-axis grid coordinate. |
| `keyform.grid2dDuplicateKey` | `formal` | Duplicate two-axis grid coordinate. |
| `rigControl.cycle` | `formal` | Rig control hierarchy cycle. |
| `dynamics.driverMissing` | `formal` | Dynamics group has no valid authored driver. |
| `dynamics.outputMissing` | `formal` | Dynamics group has no computed output parameter. |
| `dynamics.outputTargetDuplicate` | `formal` | More than one group writes the same computed output. |
| `dynamics.outputParameterOutOfRange` | `formal` | Dynamics output range violates parameter bounds. |
| `dynamics.outputClamped` | `formal` | Runtime clamp evidence for a dynamics output. |
| `dynamics.outputUsedAsDriver` | `formal` | Computed output is used as a dynamics driver. |
| `dynamics.groupCycle` | `formal` | Dynamics group dependency cycle. |
| `runtime.parameterClamped` | `formal` | Runtime parameter input clamps under declared policy. |
| `runtime.loadBlocking` | `formal` | Runtime cannot produce deterministic viewer output. |
| `runtime.stateSequenceLengthMismatch` | `formal` | Exact replay state sequence has invalid length. |
| `ai.dryRunMutatedPackage` | `formal` | AI dry-run changed package state or revision. |
| `evidence.guiOperationLogMissing` | `formal` | MVP GUI authoring evidence is absent. |
| `demo.unsafeDependencyClaim` | `formal` | Demo/proposal surface claims forbidden format, SDK/Core, viewer matching, or physics compatibility dependency. |
| `dynamics.demoUnsafeInternalName` | `formal` | Demo surface exposes unsafe internal dynamics wording. |

Candidate diagnostics:

| Diagnostic ID | Status | Use before promotion |
|---|---|---|
| `rights.displayNotAllowed` | `candidate` | Use only as nonblocking design note unless promoted. |
| `rights.sourceUnknown` | `candidate` | Covered for MVP by formal provenance diagnostics or explicit rights expected artifacts. |
| `rights.aiUseUnrecorded` | `candidate` | Use only as future rights facet candidate. |
| `evidence.guiSemanticStateMissing` | `candidate` | MVP tests rely on required GUI evidence artifacts or formal GUI operation-log diagnostics. |
| `evidence.operationSurfaceMismatch` | `candidate` | Use only as future GUI evidence refinement. |
| `ai.targetAmbiguous` | `candidate` | MVP tests rely on explicit semantic-target artifacts unless promoted. |
| `ai.approvalRequired` | `candidate` | MVP tests rely on approval-bound repair candidate artifacts unless promoted. |
| `ai.repairCandidateMissingProvenance` | `candidate` | MVP tests rely on repair candidate provenance artifacts unless promoted. |
| `demo.internalSchemaVisible` | `candidate` | MVP tests rely on demo preflight artifacts or formal unsafe dependency claims. |
| `demo.sourcePathVisible` | `candidate` | MVP tests rely on demo preflight artifacts unless promoted. |
| `demo.redactionMissing` | `candidate` | MVP tests rely on demo preflight artifacts unless promoted. |

## Report Shape

Validator reports should preserve the existing contract shape:

| Field | Purpose |
|---|---|
| `schemaVersion` | Report schema version. |
| `reportId` | Stable report ID. No spaces. |
| `createdAt` | Timestamp, excluded from semantic hashes unless explicitly included. |
| `packageId` | Package identity. |
| `packageRevision` | Package revision used by validator. |
| `packageHash` | Hash for exact replay and package identity where available. |
| `validatorVersion` | Validator implementation or contract version. |
| `profile` | One of the five current validation profiles. |
| `relatedScenarios` | Scenario IDs covered by the report. |
| `summary` | Profile-resolved status, highest severity, and counts. |
| `checks` | Diagnostic results. |
| `repairCandidates` | Structured repair candidates, always approval-bound. |
| `evidence` | Operation log presence/path, runtime snapshot IDs, GUI evidence refs. |

The report may link additional acceptance artifacts through the Acceptance Runner evidence bundle instead of embedding them.

## Rights and Provenance Integration

Rights checks must validate that:

- every required source asset has source, author, license or permission basis, and display/reuse classification;
- generated textures, drawables, package data, and AI-edited outputs trace back to source assets;
- AI generation or AI editing is recorded when applicable;
- blocked or unknown-rights assets fail `acceptance` unless explicitly scoped as a negative fixture;
- demo-safe capture excludes blocked assets.

Representative diagnostics:

- `rights.provenanceMissing`
- `rights.displayNotAllowed`
- `rights.sourceUnknown`
- `rights.aiUseUnrecorded`

Registry status: `rights.provenanceMissing` is formal. The additional IDs above are candidates and cannot be the only oracle for an `mvp-blocking` test until promoted.

## GUI Evidence Integration

The validator must distinguish a viewer-loadable package from an MVP-acceptable GUI-authored package.

Acceptance behavior:

- `operations/log.jsonl` is required for MVP authoring flows.
- The operation log must contain GUI-surface operations for the required authoring steps.
- Semantic GUI evidence should link screen, panel, selected object, active tool, hit-test result, operation ID, and stable target ID.
- Screenshots or captures are supplemental and cannot satisfy GUI evidence alone.
- A script-generated package can be useful as an auxiliary fixture but must fail MVP acceptance when GUI evidence is required.

Representative diagnostics:

- `evidence.guiOperationLogMissing`
- `evidence.guiSemanticStateMissing`
- `evidence.operationSurfaceMismatch`

Registry status: `evidence.guiOperationLogMissing` and `evidence.playwrightSupplementMissing` are formal. The additional IDs above are candidates; MVP tests must depend on required GUI evidence artifacts or formal diagnostics, not candidate-only checks.

## AI Evidence Integration

The `aiDryRun` profile verifies the safety boundary of AI assistance.

Required behavior:

- AI may inspect model structure, validation report, runtime state, and diffs.
- AI proposed edits are dry-run first.
- Dry-run must not mutate package files, bump package revision, or append committed operation logs.
- Repair suggestions must name source checks, target IDs, rationale, expected diffs, risk, approval requirement, and provenance.
- Commit must be a separate approved operation using normal operation logging and revalidation.

Representative diagnostics:

- `ai.dryRunMutatedPackage`
- `ai.targetAmbiguous`
- `ai.approvalRequired`
- `ai.repairCandidateMissingProvenance`

Registry status: `ai.dryRunMutatedPackage` is formal. The additional IDs above are candidates; acceptance tests that mention them must also require command transcripts, diffs, approval artifacts, or a formal diagnostic.

## Demo-safe Integration

Demo-safe validation is a facet, not a separate validator profile ID in the current contract.

Demo-safe evidence should classify:

- `allowedToCapture`;
- unsafe terms or claims;
- hidden fields;
- redacted fields;
- rights status;
- third-party asset detection;
- internal schema visibility;
- solver detail visibility;
- recommended disclaimer.

Acceptance behavior:

- Missing demo preflight report fails demo-safe ACs.
- Exposed private file paths, internal schema, code surfaces, solver internals, or forbidden dependency/compatibility claims fail or require review according to fixture policy.
- Structured capture state is authoritative. Screenshots or videos are supplemental.

Representative diagnostics:

- `dynamics.demoUnsafeInternalName`
- `demo.internalSchemaVisible`
- `demo.sourcePathVisible`
- `demo.unsafeDependencyClaim`
- `demo.redactionMissing`

Registry status: `dynamics.demoUnsafeInternalName` and `demo.unsafeDependencyClaim` are formal. The additional IDs above are candidates and remain nonblocking unless promoted or backed by explicit demo preflight artifacts.

## Dynamics Replay Integration

When a fixture requires Minimum Open Dynamics v1 evidence, validator profiles must check:

- dynamics groups have valid authoredInput drivers and computedDynamics outputs;
- each MVP dynamics group writes exactly one computed output parameter;
- no two groups target the same computed output parameter;
- computed output parameters are not used as dynamics drivers;
- the runtime state sequence has `states.length` equal to `frameCount+1`;
- package identity, input frame hash, context, evaluator versions, fixed timestep, and epsilon policy match expected artifacts;
- clamping, reset, timestep mismatch, and missing/unknown state diagnostics are reported.

Strict or acceptance replay evidence fails on incomplete state sequence, package mismatch, required timestep mismatch, non-deterministic snapshot, NaN state, or blocking dependency cycle.

## Acceptance Runner Handoff

The validator report handed to the Acceptance Runner must include:

- `profile=acceptance` for MVP evidence runs;
- related AC/scenario IDs where known;
- operation log presence and path;
- runtime snapshot IDs;
- supplemental GUI evidence refs;
- repair candidates and diff refs when present;
- unresolved `needs_review` checks;
- blocking failure list suitable for AC/scenario rollup.

The Acceptance Runner remains responsible for cross-artifact rollup, missing evidence outside validator scope, manual visual review status, and final AC/scenario status.

## Result Acceptance Criteria

This profile design is acceptable when:

- it preserves the five existing validator profile IDs;
- it separates severity from status;
- it makes profile-specific escalation explicit;
- it treats rights, GUI, AI, demo-safe, and dynamics replay as evidence facets;
- it separates formal diagnostics from candidate diagnostics;
- it ensures `mvp-blocking` tests do not rely only on candidate diagnostics;
- it fails missing GUI evidence for MVP acceptance;
- it fails AI dry-run mutation;
- it does not treat screenshots as sufficient evidence;
- it does not use external proprietary formats, SDK/Core behavior, viewer matching, physics compatibility, or existing external models as validation oracle.

## Risks

- Adding profile IDs without updating shared contracts would fragment report consumers.
- Treating warning diagnostics uniformly would hide important fixture-specific failures. Check registry profile behavior must stay explicit.
- Demo-safe checks can become wording-sensitive. They should produce structured evidence and leave subjective wording to `needs_review`.
- AI repair candidates can appear safe while changing semantics. Revalidation and diff refs must remain required.
