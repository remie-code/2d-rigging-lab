# Wave39 Domain D: Editor Product Preflight Workflow

## Verdict

done

## Scope

- Added an Editor workflow entrypoint that builds the MVP-wide product preflight report from the current editor session snapshot.
- Added Editor state projection for latest product preflight status, category summary, blocking issues, warnings, not-supported claims, and not-evaluated claims.
- Added a full-width Product Preflight panel in the Editor app shell with a single run action and read-only report sections.
- Kept AI repair, executable AI preflight command wiring, renderer/pixel claims, archive/filesystem implementation, drag-drop, and Cubism compatibility claims out of Domain D.

## Files Changed

- `apps/editor/src/editor-workflow/product-preflight-workflow.ts`
- `apps/editor/src/editor-workflow/product-preflight-workflow.test.ts`
- `apps/editor/src/editor-workflow/workflow-controller.ts`
- `apps/editor/src/editor-workflow/index.ts`
- `apps/editor/src/editor-state/product-preflight-state.ts`
- `apps/editor/src/editor-state/product-preflight-state.test.ts`
- `apps/editor/src/editor-state/editor-semantic-state.ts`
- `apps/editor/src/editor-state/editor-state-projections.ts`
- `apps/editor/src/editor-state/editor-test-ids.ts`
- `apps/editor/src/editor-state/index.ts`
- `apps/editor/src/ui/product-preflight/index.ts`
- `apps/editor/src/ui/product-preflight/product-preflight-panel.ts`
- `apps/editor/src/ui/product-preflight/product-preflight-panel.test.ts`
- `apps/editor/src/ui/app-shell/app-shell.ts`
- `apps/editor/src/app/editor-app.ts`
- `apps/editor/src/styles/editor.css`
- `discussion/implementation/waves/wave39/domain-d-editor-preflight-workflow.md`

## Implementation Evidence

- `runEditorProductPreflightWorkflow` creates a persistence snapshot from the active editor state, evaluates semantic viewer/runtime evidence, validates the package with binary byte and supported portable JSON transport evidence, and passes Domain B output into `buildProductPreflightReport`.
- Domain C bridge helpers are used for:
  - viewer/runtime evidence refs via `createViewerRuntimeProductPreflightEvidence`
  - byte availability evidence refs via `createByteAvailabilityProductPreflightEvidence`
  - portable JSON transport evidence refs via `createTransportCapabilityProductPreflightEvidence`
- The Product Preflight panel displays exact product status vocabulary: `pass`, `warn`, `fail`, `not_supported`, and `not_evaluated`.
- The panel includes category summary, blocking issues, warnings, not-supported, and not-evaluated sections. Empty sections stay explicit instead of being collapsed into pass.
- Editing operations clear the latest preflight state through `applyCommittedOperationSummary`, preventing stale report display after package mutation. Save/load rerun behavior is covered by focused workflow test.

## Verification

- `pnpm.cmd exec vitest run apps/editor/src/editor-state/product-preflight-state.test.ts apps/editor/src/editor-workflow/product-preflight-workflow.test.ts apps/editor/src/ui/product-preflight/product-preflight-panel.test.ts apps/editor/src/ui/app-shell/app-shell.test.ts apps/editor/src/editor-state/editor-test-ids.test.ts`
  - 5 test files passed, 28 tests passed.
- `pnpm.cmd typecheck`
  - Root typecheck and editor typecheck passed.

## Fix Loop 1

Review-Sylph verdict was `needs_changes`.

Fixes applied:

- Product preflight warning projection now collects warning / needs-review diagnostic refs from every category, including categories whose overall status is `fail`.
- `apps/editor/src/editor-state/product-preflight-state.test.ts` now covers a failed `modelStructure` category that still exposes a `needs_review` diagnostic ref in `state.warnings`.
- `apps/editor/src/ui/product-preflight/product-preflight-panel.test.ts` now keeps the warnings UI fixture tied to the failed category name.
- `apps/editor/src/ui/app-shell/app-shell.test.ts` now asserts the Product Preflight panel is present and the run action calls the app-shell callback.

Fix-loop verification:

- `pnpm.cmd exec vitest run apps/editor/src/editor-state/product-preflight-state.test.ts apps/editor/src/ui/product-preflight/product-preflight-panel.test.ts apps/editor/src/ui/app-shell/app-shell.test.ts apps/editor/src/editor-state/editor-test-ids.test.ts`
  - 4 test files passed, 28 tests passed.
- `pnpm.cmd typecheck`
  - Root typecheck and editor typecheck passed.

## Residual Risks

- Domain D does not add e2e coverage. Desktop/mobile smoke remains Domain F scope.
- Product preflight AI observation remains helper/schema-only from Domain C. No executable AI command or host wiring was added.
- The UI is read-only and does not persist the product preflight report artifact into package files; it reruns from the current editor session state.

## User Decision Points

- None.

## Notes For Reviewer

- Review that `index.ts` changes remain barrel-only.
- Review that the UI does not expose repair controls or imply unsupported capabilities.
- Review that not-supported and not-evaluated states are not mapped to pass in state or UI.
