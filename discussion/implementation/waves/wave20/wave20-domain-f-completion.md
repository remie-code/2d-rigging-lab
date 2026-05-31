# Wave 20 Domain F Completion

> Domain: `wave20-editor-psd-source-intake-mode`
> Orchestrator: Orch-Sylph
> Status: `pass`

## Delegation

| Role | Context | Result |
|---|---|---|
| Gnome source implementation | `019e7ba1-2572-7e30-b436-12ad9efdf8fe` / Gnome the 73rd | Implemented manual/profile-backed PSD source intake mode and needs-fix patch. |
| Review-Sylph independent review | `019e7bb0-7d2d-7b93-be32-6d8c749ab515` / Sylph the 74th | Reviewed basis docs, Domain A/C/D artifacts, changed files, diff, tests, and verification. Verdict `pass` after one needs-fix loop. |

Orch-Sylph did not implement source changes. Source implementation and review were separated into distinct contexts.

## Changed Files

| File | Purpose |
|---|---|
| `apps/editor/src/editor-state/source-intake-draft-state.ts` | Adds PSD adapter/profile draft mode, PSD layer metadata, validation, and parser-free diagnostics. |
| `apps/editor/src/editor-state/source-intake-view-model.ts` | Exposes PSD mode labels and controls through the source intake view model. |
| `apps/editor/src/ui/source-assets/source-intake-form.ts` | Adds mode/profile/layer controls for manual PSD adapter metadata and fixes native required state for unsupported PSD layers. |
| `apps/editor/src/ui/source-assets/source-intake-panel.ts` | Wires the expanded source intake form into the existing panel. |
| `apps/editor/src/editor-session/source-import-command.ts` | Maps confirmed PSD intake drafts to `importPsdSourceAsset`. |
| `apps/editor/src/editor-session/evidence-provider.ts` | Adds narrow editor-session evidence support for committed PSD intake operations. |
| `apps/editor/src/editor-workflow/source-intake-workflow.ts` | Builds Domain B/C PSD adapter-result payloads from user-entered profile metadata. |
| `apps/editor/src/editor-workflow/workflow-controller.ts` | Routes PSD source intake confirmation through the existing workflow controller path. |
| `apps/editor/src/editor-state/source-intake-draft-state.test.ts` | Focused state and validation coverage for split PNG compatibility and PSD manual metadata. |
| `apps/editor/src/ui/source-assets/source-intake-panel.test.ts` | Focused UI coverage for PSD wording, accessible controls, native required state, and long diagnostics. |
| `apps/editor/src/editor-workflow/workflow-controller.test.ts` | Workflow coverage for PSD intake commit through `importPsdSourceAsset` and split PNG compatibility. |
| `apps/editor/src/ui/app-shell/app-shell.test.ts` | Updates shell expectations for mode-neutral source intake accessibility text. |
| `discussion/implementation/reviews/wave20/wave20-domain-f-review.md` | Independent Review-Sylph report. |
| `discussion/implementation/waves/wave20/wave20-domain-f-completion.md` | This completion report. |

No dependency manifests, lockfiles, `fixtures/contracts/**`, validator files, operation-core implementation files, parser/image dependencies, PSD binaries, or `index.ts` implementation logic were changed for Domain F.

## Implementation Summary

- Source Intake now offers a manual `PSD adapter/profile metadata` mode without an OS file picker, PSD parser, image decode, raster extraction, or Photoshop-compatible rendering claim.
- User-entered canvas, profile, group, layer, texture preview, texture ID, target part, unsupported feature, opacity, visibility, and bounds metadata are converted into a `psd-adapter-result-v1` payload for `importPsdSourceAsset`.
- Split PNG intake remains on the existing `importSplitPngSourceAsset` path.
- UI wording stays parser-free and describes manual/profile metadata entry rather than PSD byte parsing.
- Accessible layer-row labeling is mode-neutral.
- Native form `required` behavior now matches draft validation: split PNG and mapped PSD layers require texture mapping; PSD `unsupported` layers do not.

## Review Loop

Initial Review-Sylph verdict was `needs_fix`.

Blocking issue:

- Native `required` attributes for texture preview and texture ID were applied to every row, which could block valid PSD `role: "unsupported"` layers before local draft validation.

Gnome fixed the issue in `source-intake-form.ts` and added DOM tests in `source-intake-panel.test.ts`. Review-Sylph re-reviewed the fix and returned `pass` with no remaining findings.

Review report:

- `discussion/implementation/reviews/wave20/wave20-domain-f-review.md`

## Verification

```powershell
pnpm.cmd exec vitest run apps/editor/src/editor-state/source-intake-draft-state.test.ts apps/editor/src/ui/source-assets/source-intake-panel.test.ts apps/editor/src/editor-workflow/workflow-controller.test.ts apps/editor/src/ui/app-shell/app-shell.test.ts
```

Result: initial sandbox run failed with `EPERM` reading the pnpm-installed Vitest entrypoint; escalated rerun passed, `4` files / `56` tests.

```powershell
pnpm.cmd typecheck
```

Result: initial sandbox run failed with `EPERM` reading the pnpm-installed TypeScript entrypoint; escalated rerun passed for root `tsc --noEmit` and editor `tsc --noEmit -p tsconfig.json`.

```powershell
git diff --check -- apps/editor discussion/implementation/waves/wave20 discussion/implementation/reviews/wave20
```

Result: pass. Output contained only Git LF/CRLF working-copy warnings for tracked editor files.

```powershell
git diff --name-only -- package.json pnpm-lock.yaml pnpm-workspace.yaml
```

Result: no output.

Focused production scan for OS file picker, `FileReader`, filesystem reads, parser/image dependencies, image decode, raster extraction, PSD parser wording, Photoshop-compatible claims, and file-picker wording found no matches in changed editor production files. Matches in tests were only negative/truthfulness assertions.

## Residual Risks

- PSD source URL and rights notes entered in the shared form are preserved for split PNG provenance but are not represented by the current Domain C PSD rights DTO. A later provenance contract refresh may add richer PSD provenance fields.
- Manual PSD group IDs are generated from sanitized group paths; collision handling remains operation-precondition-level rather than a friendlier UI diagnostic.
- Browser-native layout and end-to-end persistence still need Domain G smoke coverage, especially desktop/mobile behavior and native form validation in a real browser.

## Next Domain Gate

Domain F can pass.

Domain G can proceed after Domain E also passes. Domain G should cover browser smoke for PSD adapter/profile intake, createDrawable / preview / save-load persistence, desktop/mobile layout, and native form validation.
