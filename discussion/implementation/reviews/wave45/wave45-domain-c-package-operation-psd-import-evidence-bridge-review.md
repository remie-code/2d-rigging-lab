# Wave45 Domain C Review: Package / Operation PSD Import Evidence Bridge

> Target: `wave45-package-operation-psd-import-evidence-bridge`
> Role: Review-Sylph independent clean reviewer
> Date: 2026-06-05
> Artifact: `discussion/implementation/reviews/wave45/wave45-domain-c-package-operation-psd-import-evidence-bridge-review.md`

## Verdict

`pass`

No blocking findings were found. Domain C stays inside the package/session evidence bridge boundary: it consumes parser-free PSD evidence DTOs, adds operation/package evidence summaries, avoids direct PSD parser imports in `packages/**`, and does not persist raw parser objects or raw/visual byte payloads in operation evidence.

## Scope Reviewed

Changed files reviewed:

- `packages/operation-core/src/psd-import-operation-evidence.ts`
- `packages/operation-core/src/operation-result.ts`
- `packages/operation-core/src/operation-evidence-result.ts`
- `packages/operation-core/src/lifecycle/evidence.ts`
- `packages/operation-core/src/index.ts`
- `packages/operation-core/src/operations/import-psd-source-asset.ts`
- `packages/operation-core/src/operations/import-psd-source-asset-diagnostics.ts`
- `packages/operation-core/src/operations/import-psd-source-asset.test.ts`
- `packages/operation-core/src/mesh-topology-uv-contract.test.ts`
- `packages/package-format/src/source-manifest.test.ts`
- `discussion/implementation/waves/wave45/wave45-domain-c-package-operation-psd-import-evidence-bridge-report.md`

Basis documents read:

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave45-plan.md`
- `discussion/implementation/waves/wave45/wave45-domain-a-browser-parser-dependency-scope-trust-boundary-report.md`
- `discussion/implementation/reviews/wave45/wave45-domain-a-browser-parser-dependency-scope-trust-boundary-review.md`
- `discussion/implementation/waves/wave44/wave44-domain-c-psd-layer-tree-contract-profile-boundary-report.md`
- `discussion/implementation/waves/wave44/wave44-domain-e-psd-validator-provenance-security-diagnostics-report.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`

I did not rely on Gnome's report as the only basis. I inspected the changed source, changed tests, direct diffs, parser import scans, and verification commands independently.

## Blocking Findings

None.

## Non-Blocking Findings

- The new PSD operation evidence schema smoke was added to `packages/operation-core/src/mesh-topology-uv-contract.test.ts`, whose name is mesh/UV-specific. This is not blocking because the file remains small, `check:source` passes, and the test exercises shared operation evidence schema plumbing. If PSD operation evidence grows, move those assertions into a dedicated PSD/operation evidence contract test.
- The Domain C implementation report records that full `pnpm.cmd typecheck` failed in parallel Domain B Editor files at implementation time. I could not reproduce that failure during review: full `pnpm.cmd typecheck` passed on 2026-06-05 after the current working tree state. This is not a Domain C blocker; orchestration should report the current verification state rather than preserving the stale caveat as final status.

## Development / Design Compliance

Pass.

- `packages/operation-core/src/psd-import-operation-evidence.ts:71` defines `psd-import-operation-evidence-v1` as a strict operation evidence DTO over parser-free adapter evidence. It records parser summary, layer tree evidence, feature-support summary, selected layer materialization summaries, and explicit persistence boundary claims.
- Browser-origin evidence is classified without package-side parser execution: `resolveParseOrigin` maps `runtime: "browser"` to `browserExplicitFileSelection` at `packages/operation-core/src/psd-import-operation-evidence.ts:133`.
- Selected layer materialization evidence is summary-only in operation evidence. `PsdImportLayerMaterializationEvidenceSummarySchema` omits `binaryAssetRef` at `packages/operation-core/src/psd-import-operation-evidence.ts:60`, and `toMaterializationEvidenceSummary` copies digest, byte length, provenance, parser/extraction summaries, and storage classification without raw bytes at `:146`.
- Persistence claims are explicit and non-renderer/non-compositing: `rawParserObjectPersistence: "notPersisted"`, source/materialized byte persistence boundaries, `photoshopCompositingClaim: "none"`, `rendererPixelOracleClaim: "none"`, and save/load semantics are set at `packages/operation-core/src/psd-import-operation-evidence.ts:193`.
- `importPsdSourceAsset` attaches operation evidence to results and therefore log entries through the existing lifecycle/log schema path at `packages/operation-core/src/operations/import-psd-source-asset.ts:166` and `packages/operation-core/src/operation-log-entry.ts:28`.
- Lifecycle provider evidence merge support is additive at `packages/operation-core/src/lifecycle/evidence.ts:71`.
- Source manifest/package compatibility remains additive. Existing parser-free profile fields are preserved, and browser-origin parse evidence serializes/reloads through `packages/package-format/src/source-manifest.test.ts:331`.
- `packages/operation-core/src/index.ts` remains barrel-only; the Domain C change is one re-export at line `9`.
- No public schema-breaking rename, drag-drop/archive/filesystem scope, full compositing, renderer/pixel oracle, Cubism compatibility claim, public demo asset claim, or repair/LLM/autofix behavior was added.

## Test Adequacy

Pass.

- Package-format tests cover browser-origin parser-free profile evidence serialization/reparse and raw parser/raw byte absence.
- Operation-core PSD import tests cover commit result evidence, operation log result evidence, source diagnostics, browser parser runtime, persistence boundary claims, materialization summary only, and absence of `rawLayerObject`, `rawRgba`, `data:image`, and `binaryAssetRef` in operation evidence.
- Operation evidence schema tests cover `OperationEvidenceResultSchema` and `OperationResultSchema` accepting `psdImportEvidence`.
- Existing PSD import contract fixture tests still pass.
- Parser import guard was manually verified with exact forbidden import-form scans under `packages/**`; broad mentions are evidence strings in tests, not imports.

## Verification Performed

- `git diff -- ...changed Domain C files...`: inspected tracked diffs directly.
- Read new untracked files directly: `packages/operation-core/src/psd-import-operation-evidence.ts` and the Domain C report.
- `rg -n -e '@webtoon/psd' -e 'ag-psd' packages`: only evidence/test strings found.
- Exact forbidden import scan under `packages/**` for `from "@webtoon/psd"`, `from '@webtoon/psd'`, `import("@webtoon/psd")`, `require("@webtoon/psd")`, and equivalent `ag-psd` forms: no matches.
- `pnpm.cmd exec vitest run packages/package-format/src/source-manifest.test.ts packages/operation-core/src/operations/import-psd-source-asset.test.ts packages/operation-core/src/mesh-topology-uv-contract.test.ts`: passed, 3 files, 21 tests.
- `pnpm.cmd exec vitest run packages/operation-core/src/psd-import-contract-fixtures.test.ts`: passed, 1 file, 2 tests.
- `pnpm.cmd run typecheck:root`: passed.
- `pnpm.cmd run check:source`: passed, `Source organization guard passed.`
- `pnpm.cmd typecheck`: passed, including root and Editor package typecheck.
- `git diff --check -- ...tracked Domain C files...`: passed with LF-to-CRLF warnings only.
- `git diff --no-index --check -- NUL packages/operation-core/src/psd-import-operation-evidence.ts`: no whitespace findings; expected no-index diff exit `1`, LF-to-CRLF warning only.
- `git diff --no-index --check -- NUL discussion/implementation/waves/wave45/wave45-domain-c-package-operation-psd-import-evidence-bridge-report.md`: no whitespace findings; expected no-index diff exit `1`, LF-to-CRLF warning only.

## Remaining Issues

- None blocking in Domain C source.
- Future guard work should automate the parser import boundary once Domain B's allowed Editor/browser adapter import site is finalized.

## User-Decision Points

None for Domain C.

Future user decisions remain required before widening scope to public demo material, public visual byte distribution, archive/filesystem/drag-drop, full renderer/pixel oracle, Cubism compatibility, or repo-side repair/LLM/autofix behavior.

## Separation Confirmation

Gnome and Review-Sylph were separated. I acted only as the independent review gate, did not implement source changes, did not revert unrelated work, and wrote only this review artifact under `discussion/implementation/reviews/wave45/**`.
