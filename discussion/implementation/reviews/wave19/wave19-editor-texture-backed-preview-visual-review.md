# Wave19 Domain F Review: Editor Texture-Backed Preview Visual

- Review verdict: `pass`
- Target: `wave19-editor-texture-backed-preview-visual`
- Reviewer role: independent Review-Sylph
- Review-Sylph agent/context id: not exposed in this subagent context
- Gnome implementation agent: `019e7965-c004-7780-971a-44f7747465c5` (`Gnome the 47th`)
- Gnome context id: not separately exposed; parent-recorded multi-agent id is `019e7965-c004-7780-971a-44f7747465c5`
- Review artifact: `discussion/implementation/reviews/wave19/wave19-editor-texture-backed-preview-visual-review.md`
- Follow-up review result: F-1 resolved; no new blocking findings found.

## Scope Reviewed

Domain F changed files:

- `apps/editor/src/editor-preview/preview-dto.ts`
- `apps/editor/src/editor-preview/texture-preview-resolution.ts`
- `apps/editor/src/editor-preview/texture-preview-resolution.test.ts`
- `apps/editor/src/ui/preview-panel/preview-visual.ts`
- `apps/editor/src/ui/preview-panel/preview-summary.ts`
- `apps/editor/src/ui/app-shell/app-shell.ts`
- `apps/editor/src/ui/app-shell/app-shell.test.ts`

The workspace contains other Wave19 changes. This review treated those as context only unless they directly affect Domain F texture preview truthfulness.

## Basis Used

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave19-plan.md`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/waves/wave18/wave18-final-report.md`
- `discussion/implementation/waves/wave19/wave19-runtime-editor-preview-texture-projection-completion.md`
- `discussion/implementation/waves/wave19/wave19-source-import-create-drawable-texture-workflow-completion.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/design/module-contracts/package-file-format-contract.md`
- `discussion/design/module-contracts/operation-contracts.md`
- `discussion/design/module-contracts/validator-contract.md`
- `discussion/design/mvp-authoring-runtime/01-open-model-package-design.md`
- Actual source/diff in the Domain F files.

## Findings

None blocking.

### F-1 Resolved: package-local preview refs no longer claim successful texture rendering

The previous blocking issue was that `package-local-file-v1` refs were emitted as raw SVG image hrefs and marked as successful `texture_pattern` rendering even though the browser-local package flow stores only text metadata, not the referenced PNG bytes.

The follow-up fix resolves this:

- `preview-visual.ts` now creates pattern defs only for `isBrowserRenderableTextureReference(...)`, which is restricted to `deterministic-data-url-v1` (`apps/editor/src/ui/preview-panel/preview-visual.ts:92-95`, `apps/editor/src/ui/preview-panel/preview-visual.ts:221-223`).
- `getTexturePatternFill` returns a pattern fill only for browser-renderable refs; package-local refs use `solid_fallback` (`apps/editor/src/ui/preview-panel/preview-visual.ts:216-219`, `apps/editor/src/ui/preview-panel/preview-visual.ts:78-82`).
- Package-local fallback is explicit in SVG title text as `solid fallback, package-local texture preview not browser materialized` (`apps/editor/src/ui/preview-panel/preview-visual.ts:191-198`).
- `preview-summary.ts` counts only deterministic data URL refs as `pattern` and separately reports package-local unavailable fallbacks (`apps/editor/src/ui/preview-panel/preview-summary.ts:59-65`, `apps/editor/src/ui/preview-panel/preview-summary.ts:76-85`).
- App shell tests now cover both branches: package-local refs stay fallback with no `<image>`, while deterministic data URL refs render as an SVG image/pattern (`apps/editor/src/ui/app-shell/app-shell.test.ts:42-78`, `apps/editor/src/ui/app-shell/app-shell.test.ts:81-108`).

## Design / Development Compliance Review

- Source organization remains compliant: the resolver stays in `texture-preview-resolution.ts`; visual rendering stays in `preview-visual.ts`; summary aggregation stays in `preview-summary.ts`; app-shell wiring remains narrow metadata wiring.
- No implementation logic was added to `index.ts` by this domain.
- The app shell reads package texture atlas metadata through `package-format`, but Domain F now keeps that as metadata unless the preview ref is browser-renderable. This satisfies the Wave19 truthfulness requirement without requiring package schema redesign, PNG decode, OS file picker, or renderer rewrite.
- Existing polygon/rect geometry behavior is preserved because the texture decision changes only fill/defs/title attributes, not polygon point or rect bounds construction.

## Test Adequacy Review

Focused test coverage is adequate for Domain F after the needs-fix update:

- Resolver unit coverage still proves deterministic data URL preview assets enrich projected drawables.
- App shell coverage now proves package-local refs remain truthful solid fallback.
- App shell coverage also proves deterministic data URL refs become SVG `<pattern><image ...>` rendering.
- Existing smoke coverage remains intact for generated drawable creation, layer controls, preview parameter changes, source intake, and mesh vertex nudge preview updates.

No additional blocking test gap remains for Domain F. Browser-level desktop/mobile e2e coverage remains Domain G scope.

## Verification Performed

| Command | Result | Notes |
|---|---|---|
| `pnpm.cmd exec vitest run apps/editor/src/editor-preview/texture-preview-resolution.test.ts apps/editor/src/ui/app-shell/app-shell.test.ts apps/editor/src/editor-preview/preview-projection.test.ts` | pass after sandbox escalation | Sandbox run failed with `EPERM` reading Vitest from `node_modules`; escalated rerun passed 3 files / 22 tests. |
| `pnpm.cmd typecheck` | pass after sandbox escalation | Sandbox run failed with `EPERM` reading TypeScript from `node_modules`; escalated rerun passed root and editor typecheck. |
| `pnpm.cmd run check:source` | pass | Source organization guard passed. |
| `git diff --check -- apps/editor/src/editor-preview apps/editor/src/ui/preview-panel apps/editor/src/ui/app-shell apps/editor/src/app/editor-app.ts apps/editor/src/styles` | pass | CRLF warnings only; no whitespace errors. |
| `rg -n "[ \t]+$" <Domain F touched files>` | pass | No trailing whitespace matches; `rg` exited 1 because there were no matches. |

## Remaining Risks

- Package-local preview refs intentionally remain solid fallback until a future browser-materialization layer provides blob/object URLs or served asset URLs. This is truthful and not blocking for Domain F.
- The existing cross-domain mismatch where Source Intake draft UI mentions `generated://texture-preview/` while operation commit rejects unsupported generated-scheme refs remains a broader Wave19 integration risk, but Domain F no longer converts unresolved refs into apparent rendering success.
- Full desktop/mobile browser e2e verification of the texture workflow remains Domain G scope.

## User-Decision Points

None.
