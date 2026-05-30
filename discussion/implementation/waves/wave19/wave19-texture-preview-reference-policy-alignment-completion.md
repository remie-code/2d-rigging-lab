# Wave19 Completion: Texture Preview Reference Policy Alignment

- Target: `wave19-texture-preview-reference-policy-alignment`
- Status: `pass`
- Date: 2026-05-31
- Orch-Sylph role: orchestration only; no source implementation edits
- Gnome implementation agent/context id: `019e7aec-6692-7f42-a53e-61ec42060b1c` (`Gnome the 51st`)
- Review-Sylph agent/context id: `019e7af3-dc4a-7262-b963-a51dfb2f6f36` (`Sylph the 52nd`)
- Review artifact: [../../reviews/wave19/wave19-texture-preview-reference-policy-alignment-review.md](../../reviews/wave19/wave19-texture-preview-reference-policy-alignment-review.md)

## Verdict

`pass`.

The Wave19 reference policy mismatch that blocked Domain G is resolved at the source intake / operation boundary:

- Deterministic `data:image/(png|jpeg|webp);base64,...` texture preview references now pass Source Intake draft validation.
- The import operation accepts deterministic image data URLs and materializes them as `deterministic-data-url-v1` preview assets.
- `generated://texture-preview/...` is rejected before Source Intake confirmation and before operation mutation with explicit diagnostics.
- Package-local references remain accepted as metadata/fallback paths; Domain F preview rendering truthfulness was not changed.

## Basis

- `discussion/implementation/orchestration/wave19-plan.md`
- `discussion/implementation/waves/wave19/wave19-editor-source-layer-part-texture-draft-ui-completion.md`
- `discussion/implementation/waves/wave19/wave19-source-import-create-drawable-texture-workflow-completion.md`
- `discussion/implementation/waves/wave19/wave19-editor-texture-backed-preview-visual-completion.md`
- `discussion/implementation/waves/wave19/wave19-texture-preview-e2e-and-persistence-smoke-completion.md`
- `discussion/development_convention/source-file-organization-policy.md`

## Files Changed

Source and focused tests:

- `apps/editor/src/editor-state/source-intake-draft-state.ts`
- `apps/editor/src/editor-state/source-intake-draft-state.test.ts`
- `apps/editor/src/ui/source-assets/source-intake-panel.test.ts`
- `packages/operation-core/src/operations/import-split-png-source-asset-texture.ts`
- `packages/operation-core/src/operations/import-split-png-source-asset.test.ts`

Reports:

- `discussion/implementation/reviews/wave19/wave19-texture-preview-reference-policy-alignment-review.md`
- `discussion/implementation/waves/wave19/wave19-texture-preview-reference-policy-alignment-completion.md`

Other Wave19 changes already exist in the workspace and were treated as context only.

## Implementation Summary

- Source Intake draft texture preview reference validation now accepts deterministic image data URLs that match the agreed textual shape.
- Source Intake draft validation keeps `assets/textures/` and `assets/thumbnails/` package-local preview references accepted.
- Source Intake draft validation rejects `generated://texture-preview/...` with a clear diagnostic that it is not supported by Source Intake commits.
- Operation texture mapping preconditions now emit a generated-scheme-specific diagnostic while continuing to reject unsupported schemes before mutation.
- Operation materialization tests now prove deterministic data URL inputs become `referenceKind: "deterministic-data-url-v1"` preview assets.
- Focused Source Intake state/UI tests now prove deterministic data URL acceptance and generated scheme rejection.

## Pass Evidence

- Deterministic `data:image/png;base64,iVBORw0KGgo=` passes Source Intake draft state validation and form confirmation.
- The same deterministic data URL passes `importSplitPngSourceAsset` commit validation and is stored as a `deterministic-data-url-v1` preview asset.
- `generated://texture-preview/...` no longer confirms locally in Source Intake and is rejected by operation preconditions before source asset or texture atlas mutation.
- Package-local `assets/textures/...` references still pass and remain package-local preview metadata.
- No preview visual rendering, package schema redesign, validator redesign, OS picker, binary import, or `index.ts` implementation logic was added.

## Verification

Performed or confirmed by Orch-Sylph after Gnome implementation and Review-Sylph review:

| Command | Result | Notes |
|---|---|---|
| `pnpm.cmd exec vitest run apps/editor/src/editor-state/source-intake-draft-state.test.ts apps/editor/src/ui/source-assets/source-intake-panel.test.ts` | pass | Initial sandbox run hit `EPERM` reading Vitest from `node_modules`; escalated rerun passed 2 files / 13 tests. |
| `pnpm.cmd exec vitest run packages/operation-core/src/operations/import-split-png-source-asset.test.ts` | pass | Initial sandbox run hit `EPERM`; escalated rerun passed 1 file / 17 tests. |
| `pnpm.cmd exec vitest run apps/editor/src/ui/app-shell/app-shell.test.ts apps/editor/src/editor-workflow/workflow-controller.test.ts` | pass | Reported by Gnome and independently rerun by Review-Sylph; 2 files / 38 tests. |
| `pnpm.cmd typecheck` | pass | Initial sandbox run hit `EPERM` reading TypeScript from `node_modules`; escalated rerun passed root and editor typecheck. |
| `pnpm.cmd run check:source` | pass | Source organization guard passed. |
| `git diff --check -- <target alignment files>` | pass | CRLF warnings only; no whitespace errors. |

Not run:

- Full `pnpm.cmd test:unit`
- `pnpm.cmd test:e2e`
- a11y smoke

Reason: this target is a focused reference-policy unblock. Browser-level Domain G e2e should be rerun or implemented after this pass.

## Review Result

- Review-Sylph agent/context id: `019e7af3-dc4a-7262-b963-a51dfb2f6f36` (`Sylph the 52nd`)
- Review report: [../../reviews/wave19/wave19-texture-preview-reference-policy-alignment-review.md](../../reviews/wave19/wave19-texture-preview-reference-policy-alignment-review.md)
- Review verdict: `pass`
- Blocking findings: none

Review-Sylph residual notes:

- Domain G browser-level e2e smoke still needs rerun or implementation after this unblock.
- Source Intake draft package-local acceptance is narrower than operation/package-format acceptance: draft accepts `assets/textures/` and `assets/thumbnails/`, while operation also accepts `assets/sources/`. This is not blocking for the Wave19 deterministic data URL unblock.
- The deterministic data URL check validates textual shape, not decoded image bytes, which is consistent with the current Wave19 non-goals.

## Orchestration Compliance

- Source implementation was delegated to Gnome `019e7aec-6692-7f42-a53e-61ec42060b1c`.
- Independent review was delegated to separate Review-Sylph `019e7af3-dc4a-7262-b963-a51dfb2f6f36`.
- Orch-Sylph did not edit source implementation files.
- Orch-Sylph edited only `discussion/implementation/**` artifacts.
- Review-Sylph was grounded in basis documents, current files/diff, and verification evidence, not only the implementation summary.

## Remaining Risks

- Domain G remains to be rerun or implemented to prove the full browser workflow: Source Intake form -> texture-backed drawable -> preview -> save/load.
- Package-local preview references remain truthful fallback unless a future browser materialization layer provides resolvable image bytes/URLs.
- Exact prefix parity for draft package-local refs (`assets/sources/`) can be decided later if Undine wants it; it is not required for this pass because the supported rendered Wave19 path is deterministic data URL.

## User-Decision Points

None blocking.
