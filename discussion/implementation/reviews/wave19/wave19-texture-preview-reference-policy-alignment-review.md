# Wave19 Review: Texture Preview Reference Policy Alignment

- Target: `wave19-texture-preview-reference-policy-alignment`
- Verdict: `pass`
- Date: 2026-05-31
- Review-Sylph agent/context id: not exposed in this context
- Gnome implementation agent: `019e7aec-6692-7f42-a53e-61ec42060b1c` (`Gnome the 51st`)

## Scope Reviewed

Basis documents inspected:

- `discussion/implementation/orchestration/wave19-plan.md`
- `discussion/implementation/waves/wave19/wave19-editor-source-layer-part-texture-draft-ui-completion.md`
- `discussion/implementation/waves/wave19/wave19-source-import-create-drawable-texture-workflow-completion.md`
- `discussion/implementation/waves/wave19/wave19-editor-texture-backed-preview-visual-completion.md`
- `discussion/implementation/waves/wave19/wave19-texture-preview-e2e-and-persistence-smoke-completion.md`
- `discussion/development_convention/source-file-organization-policy.md`

Current source and tests inspected:

- `apps/editor/src/editor-state/source-intake-draft-state.ts`
- `apps/editor/src/editor-state/source-intake-draft-state.test.ts`
- `apps/editor/src/ui/source-assets/source-intake-panel.test.ts`
- `packages/operation-core/src/operations/import-split-png-source-asset-texture.ts`
- `packages/operation-core/src/operations/import-split-png-source-asset.test.ts`
- Supporting workflow / operation files touched by the same path:
  - `apps/editor/src/editor-session/source-import-command.ts`
  - `apps/editor/src/editor-workflow/source-intake-workflow.ts`
  - `apps/editor/src/editor-workflow/workflow-controller.ts`
  - `packages/operation-core/src/payloads/import-source.ts`
  - `packages/operation-core/src/operations/import-split-png-source-asset.ts`

## Findings

No blocking findings.

### Pass Evidence

- Source Intake draft validation now accepts deterministic `data:image/(png|jpeg|webp);base64,...` references. The draft validator checks the deterministic data URL pattern before package-local path validation and keeps package-local `assets/textures/` / `assets/thumbnails/` references accepted as draft metadata paths.
- Source Intake draft validation rejects `generated://texture-preview/...` with a clear diagnostic before confirmation. Focused state and UI tests cover the local rejection path.
- Operation preconditions accept deterministic image data URLs and materialize them as `referenceKind: "deterministic-data-url-v1"` preview assets. The focused operation test asserts the committed atlas preview asset stores the data URL under that reference kind.
- Operation preconditions reject `generated://texture-preview/...` before mutation with `operation.importSplitPngSourceAsset.invalidTexturePreviewReference`, and the test asserts source assets / texture atlas are not mutated.
- Existing package-local preview references remain accepted by the operation path as metadata / fallback references, and Domain F's preview behavior still distinguishes package-local fallback from actual data URL pattern rendering.
- Source organization policy is respected for this target. The new operation texture concern remains in `import-split-png-source-asset-texture.ts`; inspected `index.ts` diffs in related Wave19 packages are barrel re-exports only. `pnpm.cmd run check:source` passed.
- The implementation stayed inside the allowed source areas for this alignment target and did not add preview renderer rewrites, package schema redesign, validator redesign, OS picker / binary import, or `index.ts` implementation logic.

## Verification Performed

Commands run by this reviewer:

| Command | Result | Notes |
|---|---|---|
| `pnpm.cmd exec vitest run apps/editor/src/editor-state/source-intake-draft-state.test.ts apps/editor/src/ui/source-assets/source-intake-panel.test.ts` | pass | Initial sandbox run hit `EPERM` reading Vitest from `node_modules`; escalated rerun passed 2 files / 13 tests. |
| `pnpm.cmd exec vitest run packages/operation-core/src/operations/import-split-png-source-asset.test.ts` | pass | Initial sandbox run hit `EPERM`; escalated rerun passed 1 file / 17 tests. |
| `pnpm.cmd exec vitest run apps/editor/src/ui/app-shell/app-shell.test.ts apps/editor/src/editor-workflow/workflow-controller.test.ts` | pass | Escalated rerun passed 2 files / 38 tests. Covers workflow handoff and preview truthfulness regressions relevant to the policy change. |
| `pnpm.cmd typecheck` | pass | Root and editor typecheck passed. |
| `pnpm.cmd run check:source` | pass | Source organization guard passed. |
| `git diff --check -- <target alignment files>` | pass | CRLF warnings only; no whitespace errors. |
| `rg -n "[ \t]+$" packages/operation-core/src/operations/import-split-png-source-asset-texture.ts` | pass | No trailing whitespace matches; `rg` exited 1 because there were no matches. |

## Remaining Risks / Decision Points

- Domain G browser-level e2e smoke still needs to be rerun or implemented after this policy alignment; this review did not run `pnpm.cmd test:e2e`.
- Source Intake draft package-local acceptance remains narrower than operation / package-format package-local preview references: draft accepts `assets/textures/` and `assets/thumbnails/`, while operation / package-format also accept `assets/sources/`. This is not blocking for the current Wave19 unblock because existing draft defaults and tests use `assets/textures/`, but Undine may choose to align the accepted prefix sets later.
- The deterministic data URL check validates the agreed textual shape, not decoded image bytes. This matches the current package-format schema and keeps binary image validation out of scope.

## Verdict

`pass`. The implementation resolves the Domain G blocker at the reference policy layer: deterministic image data URLs can now pass Source Intake and operation materialization, while `generated://texture-preview/...` is no longer a successful Source Intake path and is rejected before operation mutation.
