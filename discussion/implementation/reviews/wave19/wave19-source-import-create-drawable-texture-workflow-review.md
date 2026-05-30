# Wave19 Domain D Review: source import / createDrawable texture workflow

## Verdict

`pass`

Reviewer: Review-Sylph independent clean-context review agent
Implementation agent recorded: `019e793b-f0db-7620-a9c6-aff961e3efb4` (`Gnome the 45th`)

This report was updated after the Gnome follow-up fix for the prior `needs_changes` findings.

## Scope Reviewed

Follow-up review was limited to the fix delta and whether the prior findings were resolved:

- `packages/operation-core/src/operations/import-split-png-source-asset-texture.ts`
- `packages/operation-core/src/operations/import-split-png-source-asset.test.ts`

The original Domain D review also covered:

- `packages/operation-core/src/payloads/import-source.ts`
- `packages/operation-core/src/operations/import-split-png-source-asset.ts`
- `packages/operation-core/src/operations/create-drawable.test.ts`
- `apps/editor/src/editor-session/source-import-command.ts`
- `apps/editor/src/editor-session/session-adapter.test.ts`
- `apps/editor/src/editor-state/create-drawable-form-state.ts`
- `apps/editor/src/editor-state/drawable-list-state.ts`
- `apps/editor/src/editor-state/editor-state-projections.ts`
- `apps/editor/src/editor-workflow/source-intake-workflow.ts`
- `apps/editor/src/editor-workflow/workflow-controller.ts`
- `apps/editor/src/editor-workflow/workflow-controller.test.ts`
- `apps/editor/src/editor-workflow/workflow-state-projection.ts`

Concurrent Wave19 preview/runtime/validator/package changes were treated as out of scope except where they define package texture semantics used by this domain.

## Basis Documents Used

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave19-plan.md`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/waves/wave18/wave18-final-report.md`
- `discussion/implementation/waves/wave19/wave19-texture-asset-package-authoring-foundation-completion.md`
- `discussion/implementation/waves/wave19/wave19-editor-source-layer-part-texture-draft-ui-completion.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/design/module-contracts/package-file-format-contract.md`
- `discussion/design/module-contracts/operation-contracts.md`
- `discussion/design/module-contracts/validator-contract.md`
- `discussion/design/mvp-authoring-runtime/01-open-model-package-design.md`

## Findings

No blocking findings remain for Domain D.

### Resolved: Existing texture IDs can no longer be silently overwritten

The fix adds a conservative precondition check before materialization: when a requested layer `textureId` already exists in `session.graph.textureAtlas?.textures`, the operation now emits `operation.importSplitPngSourceAsset.existingTextureId` (`packages/operation-core/src/operations/import-split-png-source-asset-texture.ts:77-85`, `packages/operation-core/src/operations/import-split-png-source-asset-texture.ts:230-234`).

The regression seeds an existing `tex_body` atlas entry, attempts an import using the same texture ID, asserts rejection with the structured diagnostic, and confirms source assets are not imported and the existing atlas entry remains unchanged (`packages/operation-core/src/operations/import-split-png-source-asset.test.ts:172-213`).

### Resolved: Operation preview path validation now rejects package-format-invalid segments

The operation preview reference guard now rejects empty path segments, `.` segments, and `..` segments in addition to the prior URL/backslash/absolute/trailing slash checks (`packages/operation-core/src/operations/import-split-png-source-asset-texture.ts:213-221`). This aligns the operation precondition with the package-format path semantics relevant to the original finding.

The regression covers both concrete failure cases from the original review, `assets/textures//face.png` and `assets/textures/./face.png`, and asserts structured rejection before source/texture mutation (`packages/operation-core/src/operations/import-split-png-source-asset.test.ts:387-420`).

## Positive Coverage / Design Notes

- The payload extension remains narrow and backward-compatible: `texturePreviewReference`, `textureId`, and `targetPartId` are optional additions to split PNG layer metadata.
- Domain D does not add implementation logic to `index.ts`, and the reviewed Domain D files do not implement preview visual rendering or validator oracle logic.
- Texture materialization evidence remains present in operation result/model diff/log/package persistence tests.
- Imported source selection still carries `textureId` and effective `partId` into createDrawable defaults and commit payload inheritance.

## Verification Considered

I did not rerun tests during this follow-up clean review. I inspected the actual helper source and test diff, including the untracked `packages/operation-core/src/operations/import-split-png-source-asset-texture.ts`.

I considered the Orch-Sylph post-fix verification summary:

- PASS `pnpm.cmd exec vitest run packages/operation-core/src/operations/import-split-png-source-asset.test.ts packages/operation-core/src/operations/create-drawable.test.ts`
- Result: 2 files / 22 tests passed after escalated rerun; sandbox attempt hit EPERM reading `node_modules`.
- PASS `git diff --check -- <Domain D tracked files>` with CRLF warnings only.

This is sufficient for the two fixed findings because both were operation-core precondition/test coverage issues.

## Remaining Risks

- Preview asset IDs are derived through sanitized source asset/layer IDs. If arbitrary source layer IDs sanitize to the same token, preview asset upsert semantics may collapse distinct source layers. This is not a new blocking Domain D finding because the current fix delta did not change that behavior and editor-generated layer IDs remain stable.
- Domain C allows `generated://texture-preview/...` draft references, while Domain D/package-format currently accepts package-local paths and deterministic image data URLs. This remains an integration wording/UX consistency risk for later domains, not a Domain D blocker.

## User-Decision Points

None. Both prior findings were resolved through implementation/contract alignment.

## Orchestration Compliance Notes

- Clean-context follow-up review used actual repository source and test diff, not the Gnome summary alone.
- Reviewer did not edit source files.
- The only file updated by this reviewer is this allowed report: `discussion/implementation/reviews/wave19/wave19-source-import-create-drawable-texture-workflow-review.md`.
- Required review lanes were covered for the fix delta: design/development compliance and test adequacy.
