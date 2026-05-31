# Wave 21 Clean Integration Review

> Target: `wave21-integration-review-and-final-report`  
> Review agent: Review-Sylph (`context id not exposed in this subagent call`)  
> Context name: Wave 21 Domain G clean integration review  
> Date: 2026-05-31  
> Status: `pass`

## Verdict

`pass`.

Source behavior, tests, dependency policy, PSD truthfulness, structured persistence, fixtures, validator evidence, editor projection, e2e smoke, and the re-reviewed Domain D artifact amendment pass this clean integration review. No source or artifact fix remains.

Domain D's original Gnome implementation context id/name remains unavailable from persisted Wave 21 artifacts. The amended Domain D completion report now makes that evidence gap explicit and records the review artifact, Review-Sylph pass result, and downstream gate, which is sufficient for the Wave 21 context-id-if-available requirement. The unavailable historical context id/name remains a residual risk, not a blocker.

## Findings

| Severity | Finding | Evidence | Required action | Status |
|---|---|---|---|---|
| Blocking | None. | n/a | n/a | pass |
| High | None. | n/a | n/a | pass |
| Medium | None. Prior Domain D artifact evidence finding is resolved by the amended Delegation, Review Result, and Downstream Gate sections. | `discussion/implementation/waves/wave21/wave21-domain-d-psd-structured-contract-fixtures-completion.md:7`, `:14`, `:83` | n/a | pass |
| Low | None. | n/a | n/a | pass |

## Rubric

| Rubric | Result | Evidence |
|---|---|---|
| Structured Persistence | pass | `LayeredCharacterPsdProfileSchema` persists adapter, canvas, groups, layers, unsupported features, diagnostics, and compatibility policy, and `SourceAssetSchema` stores optional `psdProfile` at `packages/package-format/src/source-manifest.ts:162` and `:182`. Operation materializes it at `packages/operation-core/src/operations/import-psd-source-asset-materialization.ts:45` and `:125`. |
| Backward Compatibility | pass | Flattened fallback policy is schema-backed at `packages/package-format/src/source-manifest.ts:116`. Tests cover Wave 20 flattened PSD and split PNG loading at `packages/package-format/src/source-manifest.test.ts:99` and `:141`; validator split PNG compatibility is covered at `packages/validator-core/src/psd-source-profile.test.ts:378`. |
| PSD Profile Truthfulness | pass | UI and AI projections explicitly describe adapter-supplied metadata without parser/decode/raster claims at `apps/editor/src/editor-state/source-intake-view-model.ts:235` and `apps/editor/src/ai-command-host/editor-ai-inspection-projector.ts:370`. Fixture manifests state metadata-only/no PSD or image bytes at `fixtures/contracts/psd-import-happy-path/fixture-manifest.json:5` and `fixtures/contracts/psd-unsupported-layer/fixture-manifest.json:5`. |
| Dependency Policy Compliance | pass | `pnpm.cmd run check:deps` passed. Dependency manifest diff/status check in `discussion/implementation/waves/wave21/wave21-final-verification-report.md:34` and reviewed workspace diff showed no package manifest or lockfile changes. |
| Source Layer Mapping | pass | Operation preserves source layer texture/part relation in structured profile at `packages/operation-core/src/operations/import-psd-source-asset-materialization.ts:175`. E2E saved-state assertions inspect source layer, texture preview, texture ID, and target part at `apps/editor/e2e/source-intake-smoke.mjs:329`, `:340`, `:341`, and `:342`. |
| Texture Preview Persistence | pass | E2E saves, reloads, and reasserts source intake/preview state at `apps/editor/e2e/smoke-checks.mjs:99`, `:106`, and `:121`; saved source intake state reads texture atlas and preview metadata at `apps/editor/e2e/source-intake-smoke.mjs:215`, `:242`, and `:245`. |
| Validator Evidence | pass | Structured validator path emits profile checks and fallback mismatch diagnostics at `packages/validator-core/src/validators/psd-source-profile-structured.ts:22`, `:288`, and `:332`; catalog IDs are registered at `packages/validator-core/src/check-catalog.ts:125` and `:149`. |
| UI / Accessibility | pass | Source Intake keeps accessible labels and long text wrapping at `apps/editor/src/ui/source-assets/source-intake-panel.ts:20`, `:172`, `:232`, and `:233`; e2e verifies Source Intake accessible names at `apps/editor/e2e/source-intake-smoke.mjs:796`, `:823`, and `:825`. |
| Source Organization | pass | `pnpm.cmd run check:source` passed. No editor/package `index.ts` implementation changes were observed in Wave 21 source diffs. |
| Test Adequacy | pass | Review reran `pnpm.cmd typecheck`, `pnpm.cmd test:unit`, `pnpm.cmd test:e2e`, `pnpm.cmd run check:source`, `pnpm.cmd run check:deps`, and `git diff --check -- apps/editor packages fixtures/contracts discussion/implementation/waves/wave21 discussion/implementation/reviews/wave21`; all passed. |
| Orchestration Compliance | pass | A/B/C/E/F completion artifacts record separate Gnome and Review-Sylph contexts. The amended Domain D completion artifact now records the Delegation, Review Result, and Downstream Gate sections, and explicitly discloses that the original Domain D Gnome context id/name was not persisted and is unavailable from Wave 21 artifacts at `discussion/implementation/waves/wave21/wave21-domain-d-psd-structured-contract-fixtures-completion.md:7`, `:10`, `:14`, and `:83`. |

## Source Evidence

| Area | Evidence |
|---|---|
| Package-format contract | Structured PSD profile schema and optional persistence are present in `packages/package-format/src/source-manifest.ts:162` and `:182`; compatibility policy literals are at `:116`. |
| Operation materialization | `importPsdSourceAsset` writes `sourceAsset.psdProfile` from adapter result at `packages/operation-core/src/operations/import-psd-source-asset-materialization.ts:45`; compatibility policy is fixed at `:211`. |
| Validator structured diagnostics | `validatePsdSourceProfiles` routes structured profiles through `validateStructuredPsdProfile` at `packages/validator-core/src/validators/psd-source-profile.ts:18` and `:39`; missing structured fallback is emitted at `:36`. |
| Editor projection | Source Intake prefers `sourceAsset.psdProfile` at `apps/editor/src/editor-state/source-intake-view-model.ts:186` and `:190`; AI source asset inspection includes structured profile details at `apps/editor/src/ai-command-host/editor-ai-inspection-projector.ts:65` and `:374`. |
| Evidence provider | Import PSD evidence target IDs include profile, adapter, canvas, group, layer, unsupported-feature, and diagnostic markers at `apps/editor/src/editor-session/evidence-provider.ts:216` and `:232`. |
| Runtime boundary | No `packages/runtime-core/**` diff appeared in Wave 21 status; PSD-specific DTOs remain out of runtime-core. |

## Test Evidence

| Check | Result | Notes |
|---|---|---|
| `pnpm.cmd typecheck` | pass | Root and editor typecheck completed with exit code 0. |
| `pnpm.cmd test:unit` | pass | Vitest reported `94` files / `509` tests passed. |
| `pnpm.cmd test:e2e` | pass | Desktop and mobile editor smoke passed; preview/drawable screenshot checks completed. |
| `pnpm.cmd run check:source` | pass | Source organization guard passed. |
| `pnpm.cmd run check:deps` | pass | Dependency guard passed. |
| `git diff --check -- apps/editor packages fixtures/contracts discussion/implementation/waves/wave21 discussion/implementation/reviews/wave21` | pass | Exit 0; Git emitted LF/CRLF working-copy warnings only. |
| Forbidden parser/file-picker/decode/raster/binary scan | pass | Reviewed production matches were schema parsing, metadata names, explicit non-claims, or future-scope diagnostic text. No implementation or positive claim was found. |

## Artifact Evidence

| Artifact class | Evidence |
|---|---|
| Domain gates | Domain A/B/C/E/F completion artifacts record `pass` plus Gnome/Review-Sylph context separation. Domain D now records `pass`, Delegation, Review Result, review artifact, and Downstream Gate; it also explicitly documents that the original implementation context id/name was not persisted and is unavailable from Wave 21 artifacts. |
| Final verification | `discussion/implementation/waves/wave21/wave21-final-verification-report.md:29` through `:35` records pass for typecheck, unit, e2e, source guard, diff check, dependency diff/status, and forbidden-scope scan. |
| Fixtures | PSD fixture manifests are JSON-only in the reviewed fixture directories and declare parser-free metadata-only evidence at `fixtures/contracts/psd-import-happy-path/fixture-manifest.json:5`, `:28`, `:33`, and `:35`; unsupported-layer fixture mirrors that at `fixtures/contracts/psd-unsupported-layer/fixture-manifest.json:5`, `:23`, and `:27`. |
| Contract fixture oracle | `packages/operation-core/src/psd-import-contract-fixtures.test.ts:52` and `:75` exact-compare generated validation reports; source manifest `psdProfile` and texture relations are summarized at `:222` and `:278`. |

## Residual Risks

- The workspace is uncommitted; this review did not replay from a clean checkout.
- The forbidden-scope scan is grep/source-review based, not a semantic proof against future parser/decode/file-picker work.
- E2E remains smoke coverage. Unsupported-feature and broader multilayer structured PSD behavior are primarily covered by unit and contract fixture tests, not by exhaustive browser interaction.
- `SourceAssetSchema` remains non-discriminated. Validator covers `psdProfile` on non-PSD source assets, but broader source kind/import-profile pairing could be hardened in a future contract cleanup.
- Domain C noted validator-contract documentation drift for new check IDs. This is documentation debt, not a Wave 21 source blocker.
- Domain D's original Gnome implementation context id/name is unavailable from persisted artifacts. The gap is now disclosed in the Domain D completion report and accepted under the context-id-if-available rule.

## Source Fix Remaining

No source fix remains.

No artifact fix remains.
