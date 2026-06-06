# Wave49 Domain D: Editor Explicit Leaf Approval Generalization UX Report

Status: pass

## Scope

Implemented the Editor-side source changes for `wave49-editor-explicit-leaf-approval-generalization-ux`.

Domain D changed these files:

- `apps/editor/src/editor-workflow/selected-psd-layer-batch-intake-workflow.ts`
- `apps/editor/src/editor-workflow/selected-psd-layer-batch-intake-workflow.test.ts`
- `apps/editor/src/editor-workflow/explicit-psd-import-plan-workflow.test.ts`
- `apps/editor/src/editor-workflow/explicit-psd-import-plan-approval-bridge.test.ts`
- `apps/editor/src/ui/explicit-psd-import/explicit-psd-import-panel.test.ts`
- `discussion/implementation/waves/wave49/wave49-domain-d-editor-explicit-leaf-approval-generalization-ux-report.md`

No `packages/**`, `scripts/**`, dependency manifest, lockfile, or validator files were edited by Domain D.

## Implementation Notes

- Extended Editor import-plan workflow and approval-bridge coverage so arbitrary eligible leaf refs use the same approval path as the Wave48 fixed leaves.
- Added focused coverage for `front hair` at `psd:root/group[2]/layer[0]` without hard-coding it as a unique path.
- Preserved Wave48 compatibility for the existing `headwear`, `eyewear`, and `tie / tie` fixtures.
- Kept the panel surface simple: approve, unapprove, execute, and status/result observation. No new smart UI controls or visible smart-copy flows were added.
- Expanded selected PSD layer batch result projection so committed, rejected, and preflight-blocked summaries expose batch evidence id, aggregate status, batch operation id, per-leaf operation ids, result refs, materialization evidence refs, and per-leaf issue summaries.
- Mirrored result/status observability against the Domain C Codex-facing projector from a focused Editor workflow test, using the same committed arbitrary-leaf operation result.
- Existing stale-preview approval binding behavior was preserved and remains covered by the focused panel test file.

The Editor AI command host source files already had Domain C changes in the worktree before Domain D. Domain D did not edit those host source files; the host mirror assertion uses the accepted Domain C projector surface.

## Verification

Focused workflow/UI Vitest command:

```text
pnpm.cmd exec vitest run apps/editor/src/editor-workflow/explicit-psd-import-plan-workflow.test.ts apps/editor/src/editor-workflow/explicit-psd-import-plan-approval-bridge.test.ts apps/editor/src/editor-workflow/selected-psd-layer-batch-intake-workflow.test.ts apps/editor/src/ui/explicit-psd-import/explicit-psd-import-panel.test.ts
```

Initial sandbox run failed while loading Vite config with `spawn EPERM`. Per policy, the command was rerun with escalation.

Escalated rerun result:

```text
Test Files  4 passed (4)
Tests       19 passed (19)
```

Typecheck:

```text
pnpm.cmd typecheck
```

Result:

```text
root tsc --noEmit passed
editor tsc --noEmit -p tsconfig.json passed
```

PSD parser boundary:

```text
node scripts/check-psd-parser-import-boundary.mjs
```

Result:

```text
PSD parser import boundary check passed: 5 direct import/resolve sites limited to approved adapter and Wave44 scripts.
```

Source organization:

```text
pnpm.cmd run check:source
```

Result:

```text
Source organization guard passed.
```

Dependency guard:

```text
pnpm.cmd run check:deps
```

Result:

```text
Dependency guard passed.
```

Changed source/test smart-copy scan:

```text
rg -n "Suggest|Auto|Recommended|recommend|suggest|auto|all-layer|all layer|import all|recursive|group import|drag|drop|directory picker|File System Access|archive|Photoshop|compositing|Cubism|demo asset" apps/editor/src/editor-workflow/explicit-psd-import-plan-workflow.test.ts apps/editor/src/editor-workflow/explicit-psd-import-plan-approval-bridge.test.ts apps/editor/src/editor-workflow/selected-psd-layer-batch-intake-workflow.ts apps/editor/src/editor-workflow/selected-psd-layer-batch-intake-workflow.test.ts apps/editor/src/ui/explicit-psd-import/explicit-psd-import-panel.test.ts
```

Result classification:

- Matches were limited to evidence/test fixture keys, negative boundary fixture values, negative text assertions, and the test DOM `autocomplete` shim.
- No visible UI label, button, command, or workflow copy was added for smart import behavior.

Parser/Cubism scoped scan:

```text
rg -n "@webtoon/psd|live2dcubismcore|CubismSdk|CubismSdkForWeb|/Core/|\\Core\\|\\.wasm$" apps/editor/src/editor-workflow/explicit-psd-import-plan-workflow.test.ts apps/editor/src/editor-workflow/explicit-psd-import-plan-approval-bridge.test.ts apps/editor/src/editor-workflow/selected-psd-layer-batch-intake-workflow.ts apps/editor/src/editor-workflow/selected-psd-layer-batch-intake-workflow.test.ts apps/editor/src/ui/explicit-psd-import/explicit-psd-import-panel.test.ts
```

Result classification:

- Matches were limited to `@webtoon/psd` evidence strings in test fixtures.
- No new direct parser import, parser-scope expansion, native runtime, wasm, or SDK dependency was added.

Scoped whitespace check:

```text
git diff --check -- apps/editor/src apps/editor/e2e discussion/implementation/waves/wave49 discussion/implementation/reviews/wave49
```

Result:

```text
exit 0; Git reported only CRLF normalization warnings for dirty Editor files; no whitespace errors
```

## Compatibility

- Wave48 fixed leaf behavior remains covered by the existing fixtures and expectations.
- Non-fixed eligible leaf approval is covered by `front hair` at `psd:root/group[2]/layer[0]`.
- Hidden, blocked, not-approved, stale-preview, and issue states continue to avoid silent execution through the existing explicit preview/approval/execution flow.

## Assumptions

- Domain B result evidence fields and issue taxonomy are accepted as the package operation contract.
- Domain C in-process command surface and projector are accepted as the Codex-facing host surface.
- Domain E validator work may change files under `packages/validator-core/src/**`; Domain D did not edit that scope.

## Residual Risks

- The arbitrary-leaf path is verified with focused synthetic Editor fixtures. A later focused e2e should still bind this to a real front-hair PSD fixture once the parallel domains settle.
- The worktree contains parallel Wave49 A/B/C/E changes outside Domain D scope; this report does not claim ownership of those diffs.
