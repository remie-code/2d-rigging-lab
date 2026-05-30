# Wave19 Domain C Completion: Editor Source Layer Part / Texture Draft UI

> Target: `wave19-editor-source-layer-part-texture-draft-ui`
> Status: `pass`
> Date: 2026-05-30

## Verdict

`pass`.

Source intake draft UI / state now carries per-layer texture preview reference, texture ID, and target part mapping as draft-only user input. The UI confirms draft state only and does not directly commit an operation payload.

## Delegation

- Orch-Sylph: this context; source implementation was not edited directly here.
- Gnome implementation agent: `019e7923-28d8-7e11-9e5a-36f1325531d6` (`Gnome the 39th`)
- Review-Sylph agent: `019e792c-49b6-7e30-af10-6e1dd6e44c23` (`Sylph the 40th`)
- Review report: [../../reviews/wave19/wave19-editor-source-layer-part-texture-draft-ui-review.md](../../reviews/wave19/wave19-editor-source-layer-part-texture-draft-ui-review.md)

The subagent contexts did not expose separate internal context IDs in their final messages. The orchestration tool agent IDs above are the recorded context identifiers for this domain.

## Basis

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave19-plan.md`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/waves/wave18/wave18-final-report.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/design/module-contracts/package-file-format-contract.md`
- `discussion/design/module-contracts/operation-contracts.md`
- `discussion/design/module-contracts/validator-contract.md`
- `discussion/design/mvp-authoring-runtime/01-open-model-package-design.md`

## Files Changed

- `apps/editor/src/editor-state/source-intake-draft-state.ts`
- `apps/editor/src/editor-state/source-intake-view-model.ts`
- `apps/editor/src/ui/source-assets/source-intake-form.ts`
- `apps/editor/src/styles/editor.css`
- `apps/editor/src/editor-state/source-intake-draft-state.test.ts`
- `apps/editor/src/ui/source-assets/source-intake-panel.test.ts`
- `discussion/implementation/reviews/wave19/wave19-editor-source-layer-part-texture-draft-ui-review.md`
- `discussion/implementation/waves/wave19/wave19-editor-source-layer-part-texture-draft-ui-completion.md`

Other Wave19 changes exist in the workspace under `apps/editor/src/editor-preview/**`, `packages/**`, and discussion maps. They were treated as out of scope for this Domain C verdict.

## What Changed

- Added optional per-layer draft fields:
  - `texturePreviewReference`
  - `textureId`
  - `targetPartId`
- Added deterministic default draft values for split PNG layer rows:
  - package-local texture preview references under `assets/textures/`
  - `tex_` texture IDs
  - default part propagation when provided by the draft defaults.
- Added draft validation for:
  - missing texture preview reference
  - invalid external or unsafe texture preview reference
  - missing or malformed `tex_` texture ID
  - missing or malformed effective target `part_` ID.
- Added view-model labels for texture preview reference, texture ID, target part, and mapping status.
- Added form inputs for texture preview reference, texture ID, and target part ID inside each source layer row.
- Added narrow CSS for a wrapping per-layer mapping summary line.
- Added focused state/UI tests for valid confirmation, invalid texture reference, missing target part, and no direct operation payload.

Allowed texture preview references at this draft layer are intentionally limited to:

- `assets/textures/...`
- `assets/thumbnails/...`
- `generated://texture-preview/...`

This keeps the Domain C UI within package-local or deterministic generated reference semantics and avoids OS file picker, external URL, binary IO, PNG decode, or operation materialization.

## Pass Evidence

- Source layerごとに texture preview reference / textureId / target part を入力または確認できる。
  - Draft state includes the fields.
  - Source intake form renders labeled inputs for all three.
  - View model exposes labels and a mapping status summary.
- Draft view model が invalid texture reference / missing part を表示できる。
  - Focused state tests assert external URL rejection and missing target part diagnostics.
  - UI tests assert invalid input stays local and renders diagnostics.
- Operation payload を UI が直接 commit しない。
  - Submit only calls `confirmSourceIntakeDraft` and `onConfirmDraft` when diagnostics are empty.
  - Tests assert confirmed draft objects do not include `operationType`.
  - No `apps/editor/src/editor-session/**`, `apps/editor/src/editor-workflow/**`, or `packages/**` changes were made for this domain.
- Existing source intake / drawable authoring UI の layout と accessible name を壊さない。
  - Existing source intake `aria-labelledby`, form `aria-label`, and test IDs are retained.
  - Focused source-assets panel tests pass.
  - Editor package typecheck passes.

## Verification

Performed / confirmed by Orch-Sylph:

| Command | Result | Notes |
|---|---|---|
| `pnpm.cmd exec vitest run apps/editor/src/editor-state/source-intake-draft-state.test.ts apps/editor/src/ui/source-assets/source-intake-panel.test.ts` | pass | 2 files / 9 tests. Initial sandbox run hit `EPERM` on Vitest dependency; escalated rerun passed. |
| `pnpm.cmd --filter @private-2d-rigging-lab/editor typecheck` | pass | Initial sandbox run hit `EPERM` on TypeScript dependency; escalated rerun passed. |
| `pnpm.cmd run check:source` | pass | Source organization guard passed. |
| `git diff --check -- apps/editor/src/editor-state/source-intake-draft-state.ts apps/editor/src/editor-state/source-intake-view-model.ts apps/editor/src/ui/source-assets/source-intake-form.ts apps/editor/src/styles/editor.css apps/editor/src/editor-state/source-intake-draft-state.test.ts apps/editor/src/ui/source-assets/source-intake-panel.test.ts` | pass | CRLF warnings only; no whitespace errors. |

Reported by Gnome implementation agent:

| Command | Result | Notes |
|---|---|---|
| `pnpm.cmd test:unit` | pass | 89 files / 446 tests. Review-Sylph treated this as implementation-agent-reported, not independently rerun. |

Review-Sylph independently inspected the six Domain C changed files and their diff, reran `git diff --check -- <Domain C files>`, and returned `pass`.

## Review Result

- Review report: [../../reviews/wave19/wave19-editor-source-layer-part-texture-draft-ui-review.md](../../reviews/wave19/wave19-editor-source-layer-part-texture-draft-ui-review.md)
- Review verdict: `pass`
- Blocking findings: none
- Source fix required: none

Review-Sylph residual notes:

- Texture reference validation is local to Domain C and does not fully reuse package-format path semantics. Domain D/E should align materialization / validator behavior with package-format path rules.
- There is no focused regression for the fallback path where layer `targetPartId` is blank but `defaultPartId` is valid.
- Browser/E2E visual layout verification was not rerun for this domain; Domain G should cover desktop/mobile source intake reachability and accessible names after workflow integration.

## Source Organization

- `index.ts` was not changed for this domain.
- No new catch-all source file was added.
- Existing implementation remains in named source intake state, view-model, UI, style, and focused test files.
- `pnpm.cmd run check:source` passed.

## Remaining Risks

- Operation payload propagation / materialization is intentionally not implemented in Domain C and remains Domain D scope.
- Package/validator texture path semantics must be aligned in later domains before treating these draft references as committed package evidence.
- Data URLs are intentionally not allowed in this draft UI. If product direction later requires data URLs, that should be a user/design decision.
- Full desktop/mobile browser layout and a11y smoke is deferred to the Wave19 E2E/persistence domain.

## User-Decision Points

None blocking for Domain C.
