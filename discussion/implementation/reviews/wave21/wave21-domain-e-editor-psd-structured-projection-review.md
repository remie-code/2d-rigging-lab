# Wave 21 Domain E Review: Editor PSD Structured Projection

> Target: `wave21-editor-psd-structured-projection`
> Review agent: Review-Sylph
> Date: 2026-05-31
> Status: `pass`

## Scope

Reviewed Domain E changes only:

- `apps/editor/src/editor-session/evidence-provider.ts`
- `apps/editor/src/editor-state/source-intake-view-model.ts`
- `apps/editor/src/ui/source-assets/source-intake-panel.ts`
- `apps/editor/src/ui/source-assets/source-intake-panel.test.ts`
- `apps/editor/src/editor-workflow/workflow-controller.test.ts`
- `apps/editor/src/ai-command-host/editor-ai-inspection-projector.ts`
- `apps/editor/src/ai-command-host/editor-ai-inspection-projector.test.ts`
- `discussion/implementation/waves/wave21/wave21-domain-e-editor-psd-structured-projection-implementation.md`

Basis checked independently:

- `.agents/skills/implementation-orchestration/SKILL.md`
- `discussion/implementation/orchestration/wave21-plan.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/design/module-contracts/package-file-format-contract.md`
- `discussion/design/module-contracts/operation-contracts.md`
- `discussion/design/mvp-authoring-runtime/01-open-model-package-design.md`
- `discussion/implementation/waves/wave20/wave20-final-report.md`
- Wave 21 Domain A/B/C completion reports and Review-Sylph reports
- Domain D review report for parallel fixture-scope context only

## Findings

| Severity | Finding | File / line | Status |
|---|---|---|---|
| Blocking | None. | n/a | pass |
| High | None. | n/a | pass |
| Medium | None. | n/a | pass |
| Low | None. | n/a | pass |

## Review Notes

UI projection is truthful and metadata-scoped. Imported source view models prefer `sourceAsset.psdProfile` when present and summarize adapter, canvas, groups, unsupported feature evidence, adapter diagnostics, compatibility policy, texture relation, and blend-mode metadata in `apps/editor/src/editor-state/source-intake-view-model.ts:186`, `:231`, `:249`, `:313`, `:333`, and `:362`. The visible evidence wording says the editor did not parse PSD bytes at `apps/editor/src/editor-state/source-intake-view-model.ts:235`, and the production scan found no file picker, PSD parser, image decode implementation, or raster extraction claim.

The source intake UI exposes the structured profile without layout or accessibility regressions. Imported source rows include the profile evidence text and diagnostics wrapping at `apps/editor/src/ui/source-assets/source-intake-panel.ts:121`, `:126`, and `:232`. The structured profile section has an explicit accessible label at `apps/editor/src/ui/source-assets/source-intake-panel.ts:166`, and grouped profile lists apply `overflow-wrap:anywhere` to long diagnostics/features at `apps/editor/src/ui/source-assets/source-intake-panel.ts:197` and `:210`.

AI source asset inspection is coherent and scoped. `inspectTarget` dispatches `sourceAsset` targets at `apps/editor/src/ai-command-host/editor-ai-inspection-projector.ts:156`, resolves them from package documents or editor state at `apps/editor/src/ai-command-host/editor-ai-inspection-projector.ts:294`, and returns structured profile evidence at `apps/editor/src/ai-command-host/editor-ai-inspection-projector.ts:353`. The structured result includes adapter evidence, canvas, group/layer summaries, unsupported-feature counts, compatibility policy, adapter diagnostics, and the explicit non-claim that the editor did not parse bytes, decode images, or extract rasters at `apps/editor/src/ai-command-host/editor-ai-inspection-projector.ts:370`.

Evidence-provider changes are traceable and do not add runtime-core PSD DTOs. The import evidence target IDs add only scoped string identifiers such as `psd-profile:*`, group/layer IDs, unsupported feature IDs, and diagnostic IDs at `apps/editor/src/editor-session/evidence-provider.ts:211` and `:232`. Tokens are sanitized at `apps/editor/src/editor-session/evidence-provider.ts:297`; no runtime-core schema or DTO was changed.

Save/load projection and backward compatibility are covered. Workflow tests assert structured `psdProfile` persistence on save and after reload at `apps/editor/src/editor-workflow/workflow-controller.test.ts:287` and `:398`, and also assert the post-import view model projection at `apps/editor/src/editor-workflow/workflow-controller.test.ts:332` and `:415`. Existing split PNG path coverage remains in the targeted editor state and source intake panel suites, and flattened-only PSD data remains supported through the view model fallback at `apps/editor/src/editor-state/source-intake-view-model.ts:238` and `:333`.

Source organization is acceptable. No `apps/editor/**/index.ts` diffs were present. The changes extend existing responsibility files rather than adding a catch-all module or broad shell redesign.

## Test Adequacy

Focused tests cover the Domain E risk surfaces:

- UI structured profile evidence, parser-free wording, accessible section label, and long diagnostic wrapping at `apps/editor/src/ui/source-assets/source-intake-panel.test.ts:323`.
- Workflow import/save/load persistence and view-model projection at `apps/editor/src/editor-workflow/workflow-controller.test.ts:287`, `:332`, `:398`, and `:415`.
- AI source asset inspection and missing source asset diagnostics at `apps/editor/src/ai-command-host/editor-ai-inspection-projector.test.ts:190` and `:244`.
- Existing source-intake draft coverage remains in `apps/editor/src/editor-state/source-intake-draft-state.test.ts`.

This is adequate for Domain E. Evidence-provider target ID behavior is source-reviewed and indirectly exercised through workflow import evidence generation; there is no blocking test gap.

## Verification

| Check | Result | Notes |
|---|---|---|
| `pnpm.cmd exec vitest run apps/editor/src/editor-state/source-intake-draft-state.test.ts apps/editor/src/ui/source-assets/source-intake-panel.test.ts apps/editor/src/editor-workflow/workflow-controller.test.ts apps/editor/src/ai-command-host/editor-ai-inspection-projector.test.ts` | pass | 4 files / 47 tests passed. |
| `pnpm.cmd typecheck` | pass | Root and editor typecheck passed. |
| `git diff --check -- apps/editor discussion/implementation/waves/wave21 discussion/implementation/reviews/wave21` | pass | Exit 0; Git emitted LF/CRLF working-copy warnings only. |
| `git diff --name-only -- package.json pnpm-lock.yaml pnpm-workspace.yaml apps/*/package.json packages/*/package.json` | pass | No dependency manifest or lockfile diffs. |
| Parser/file-picker/decode/raster scan over Domain E production files | pass | Matches were explicit non-claims or `rasterizeCandidate` metadata labels only. No implementation or positive claim was found. |
| `git diff --name-status -- apps/editor/src/...Domain E files...` | reviewed | The changed editor files match the assigned Domain E file list. |
| Out-of-scope status check | observed parallel diffs | `fixtures/contracts/**`, `packages/operation-core/**`, and `packages/validator-core/**` changes are present from Domain B/C/D scope. No dependency manifest or `packages/runtime-core/**` diff was present. |
| `git diff --name-status -- apps/editor/src/index.ts apps/editor/src/**/index.ts` | pass | No editor `index.ts` implementation changes. |

The shell sandbox could not spawn commands in this review context, so read and verification commands were rerun with approved escalated execution.

## Residual Risks

- The UI summarizes structured profile metadata; it does not provide a full PSD layer tree editor. This matches Domain E scope and Wave 21 non-goals.
- Evidence-provider profile target IDs are concise string evidence markers, not rich PSD evidence bodies. This is appropriate for the current runtime-evidence boundary, but future AI evidence reports may want a dedicated editor/source evidence projection.
- Current workspace still contains parallel Wave 21 fixture, operation, and validator diffs. They are outside Domain E and should be handled by the integration gate as already planned.

## Verdict

Domain E can be reported `pass`. No implementation fix is required before the Wave 21 Domain F gate.
