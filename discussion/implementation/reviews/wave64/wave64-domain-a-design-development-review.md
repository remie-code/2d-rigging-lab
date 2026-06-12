# Wave64 Domain A Design / Development Compliance Review

## Verdict

pass

## Scope Reviewed

- Target: `wave64-parameter-keyform-package-operation-foundation`
- Review loop: 2
- Basis:
  - `discussion/implementation/orchestration/wave64-plan.md`
  - `discussion/implementation/waves/wave64/wave64-preplan-parameter-package-inventory.md`
  - `discussion/development_convention/source-file-organization-policy.md`
  - `discussion/development_convention/ux-backed-package-logic-authority.md`
  - `discussion/development_convention/operation-policy.md`
  - `discussion/development_convention/schema-and-id-conventions.md`
  - `.github/skills/implementation-orchestration/SKILL.md`
  - `C:/Users/remie/.codex/skills/implementation-orchestration/SKILL.md`
- Reviewed artifact:
  - `discussion/implementation/waves/wave64/wave64-domain-a-parameter-keyform-package-operation-foundation-report.md`
- Reviewed source:
  - Claimed Domain A package-format / authoring-core / operation-core / runtime-core / validator-core files.
  - Loop 2 focus files requested by Orch-Sylph.
  - Concurrent Domain C mesh changes were ignored except as forbidden-scope audit context.

## Compliance Findings

No blocking design/development compliance findings remain.

### Closed: `createParameter` preset-catalog collision now returns structured Operation Core rejection

Loop 1 finding:

- Domain A had changed authoring uniqueness to include initialized preset catalog ids, but `createParameter` still checked only stored parameters and could throw `AuthoringMutationError("duplicate_parameter")` outside the Operation Core result path.

Loop 2 verification:

- `packages/operation-core/src/operations/create-parameter.ts:1` through `packages/operation-core/src/operations/create-parameter.ts:6` now imports `AuthoringMutationError` and `hasInitializedParameter`.
- `packages/operation-core/src/operations/create-parameter.ts:112` through `packages/operation-core/src/operations/create-parameter.ts:128` now checks initialized parameter existence and emits `operation.createParameter.duplicateParameter`.
- `packages/operation-core/src/operations/create-parameter.ts:80` through `packages/operation-core/src/operations/create-parameter.ts:96` catches duplicate authoring mutation errors and maps them to the same structured diagnostic.
- `packages/operation-core/src/operations/create-parameter.test.ts:18` through `packages/operation-core/src/operations/create-parameter.test.ts:39` proves `param_face_angle_x` rejects without mutation or revision change.

Assessment: fixed.

### Closed: Custom parameter semantic/preset fields are no longer stored or projected by the new create/read path

Loop 1 warning:

- Custom parameter creation still accepted and stored legacy `semanticRole` / `projectPresetAlias` fields, while accepted UX says Custom parameters are role-less project-local parameters.

Loop 2 verification:

- `packages/operation-core/src/operations/create-parameter.ts:69` through `packages/operation-core/src/operations/create-parameter.ts:78` now constructs created parameters without `semanticRole` or `projectPresetAlias`.
- `packages/package-format/src/parameter-presets.ts:166` through `packages/package-format/src/parameter-presets.ts:178` now constructs initialized custom projection field-by-field and omits legacy semantic/preset fields.
- `packages/operation-core/src/operations/create-parameter.test.ts:41` through `packages/operation-core/src/operations/create-parameter.test.ts:65` verifies legacy payload fields are not stored.
- `packages/package-format/src/parameter-presets.test.ts` also covers initialized custom projection omission.

Assessment: fixed for the new operation/read surface. Storage schema still allows legacy fields for compatibility, which is acceptable as a residual compatibility surface and not a Domain A blocker.

### Closed: `createEndsCenter` duplicate endpoint/default positions reject instead of de-duplicating into invalid keyform sets

Loop 2 reported change was verified:

- `packages/authoring-core/src/linear-keyform-editing.ts:77` through `packages/authoring-core/src/linear-keyform-editing.ts:80` validates key value uniqueness before mutation.
- `packages/authoring-core/src/linear-keyform-editing.ts:345` through `packages/authoring-core/src/linear-keyform-editing.ts:356` rejects duplicate input key values with `duplicate_linear_keyform_key`.
- `packages/operation-core/src/operations/edit-keyform-key.ts:356` through `packages/operation-core/src/operations/edit-keyform-key.ts:361` maps that mutation error to `operation.editKeyformKey.duplicateKey`.
- `packages/operation-core/src/operations/edit-keyform-key.test.ts:180` through `packages/operation-core/src/operations/edit-keyform-key.test.ts:210` covers endpoint-default `createEndsCenter` rejection.
- `packages/operation-core/src/operations/edit-keyform-key.test.ts:565` through `packages/operation-core/src/operations/edit-keyform-key.test.ts:584` asserts rejected edits preserve keyform sets, stable order, and authoring revision.

Assessment: fixed.

## Must-Not / Forbidden-Scope Audit

- No editor UI implementation was introduced by Domain A.
- No Camera Capture implementation, external facade, HTTP/WebSocket/MCP transport, Cubism schema/format target, or external mapping implementation was found.
- No Domain A mesh algorithm implementation was found. Existing `auto-outline-v3-envelope` references remain attributable to concurrent Domain C context.
- The v0 operation boundary still limits authoring to `drawable.opacity`, `rigControl.angleDegrees`, `rigControl.controlPointOffsets`, and `rigControl.opacityMultiplier`; visibility/draw order are present only in a negative test and legacy compatibility surfaces.
- No semantic auto-assignment from source assets, PSD names, parts, drawables, or camera/tracker input was found. Fixed preset catalog role construction is not semantic recognition over project content.

## Source Organization And Operation-Boundary Assessment

- `packages/package-format/src/index.ts`, `packages/authoring-core/src/index.ts`, and `packages/operation-core/src/index.ts` remain barrel-only.
- New source files keep clear responsibilities; no broad catch-all source file was introduced.
- `createParameter`, `updateParameter`, `deleteParameter`, and `editKeyformKey` all remain Operation Core mutation paths with dry-run/commit handlers, structured rejection, and model diffs for committed/dry-run mutations.
- Loop 1 operation-boundary blocker is resolved: preset catalog duplicate creates now remain inside Operation Core rejection semantics.
- Machine-readable operation/check IDs reviewed in the changed paths contain no spaces.

## Verification

- `node scripts/check-source-organization.mjs`
  - Pass: Source organization guard passed.
- `node scripts/check-dependencies.mjs`
  - Pass: Dependency guard passed.
- Focused vitest command:
  - `pnpm.cmd exec vitest run packages/operation-core/src/operations/create-parameter.test.ts packages/operation-core/src/operations/edit-keyform-key.test.ts packages/package-format/src/parameter-presets.test.ts packages/authoring-core/src/parameter-surface.test.ts`
  - Initial sandbox run failed with esbuild `spawn EPERM`; rerun outside sandbox after approval passed.
  - Pass: 4 test files, 15 tests.

## Residual Risks / Open Verification Items

- Storage schema still permits legacy `semanticRole` / `projectPresetAlias` on parameter DTOs for compatibility. New Custom create/read behavior is role-less, but future schema/validator policy should decide whether legacy stored custom semantics are tolerated indefinitely or migrated.
- Validator intentionally accepts a broader legacy keyform property set than Wave64 v0 authoring. This remains acceptable if Domain B/D route user-facing v0 edits through `editKeyformKey`.
- Domain B/D handoff is concrete enough for downstream use: operation names, payload shapes, read projection fields, rejected states/diagnostics, preset initialization behavior, and `createEndsCenter` duplicate-position behavior are documented in the Domain A report.
