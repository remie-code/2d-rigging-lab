# Wave19 Domain G Review: Texture Preview E2E And Persistence Smoke

## Verdict

`pass`

Gnome's `escalate` result is accepted. The escalation is grounded in the current source/UI/operation/preview contracts, and a Domain G source implementation should not proceed without an Undine design/scope decision.

## Review-Sylph Agent

- Agent/name: Review-Sylph clean review agent
- Runtime id: not provided in the subagent prompt

## Scope Reviewed

- Target: `wave19-texture-preview-e2e-and-persistence-smoke`
- Implementation agent under review: `019e7adf-7d95-7a71-a511-ef38ec13a0fa` (`Gnome the 49th`)
- Reviewed mode: clean review; source was inspected directly and Gnome notes were not treated as the only basis.
- Write scope used by this review: this review artifact only.

## Basis Documents Used

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave19-plan.md`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/waves/wave18/wave18-final-report.md`
- `discussion/implementation/waves/wave19/wave19-editor-source-layer-part-texture-draft-ui-completion.md`
- `discussion/implementation/waves/wave19/wave19-source-import-create-drawable-texture-workflow-completion.md`
- `discussion/implementation/waves/wave19/wave19-texture-provenance-validator-evidence-completion.md`
- `discussion/implementation/waves/wave19/wave19-editor-texture-backed-preview-visual-completion.md`
- `discussion/implementation/waves/wave19/wave19-texture-preview-e2e-and-persistence-smoke-gnome-notes.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/design/module-contracts/package-file-format-contract.md`
- `discussion/design/module-contracts/operation-contracts.md`
- `discussion/design/module-contracts/validator-contract.md`
- `discussion/design/mvp-authoring-runtime/01-open-model-package-design.md`

## Findings

### High: Domain G cannot satisfy actual texture rendering from the Source Intake form within the allowed source scope

Domain G pass requires browser-level smoke for source intake -> texture-backed drawable -> generate mesh -> actual preview observation -> save/load, including source layer / `textureId` / `partId` / preview relation on desktop and mobile. The Wave19 plan also defines an early escape when the current e2e harness cannot stably input a deterministic texture preview reference.

The current Source Intake draft validation accepts only package-local texture references under `assets/textures/` or `assets/thumbnails/`, plus `generated://texture-preview/...`:

- `apps/editor/src/editor-state/source-intake-draft-state.ts:31`
- `apps/editor/src/editor-state/source-intake-draft-state.ts:35`
- `apps/editor/src/editor-state/source-intake-draft-state.ts:206`
- `apps/editor/src/editor-state/source-intake-draft-state.ts:306`

It does not accept `data:image/...`, so submitting a deterministic data URL through the form is rejected before the workflow import runs. Broadening that validation is editor-state behavior, not a narrow e2e/test-id/aria tweak, and is outside the Domain G allowed source scope in `discussion/implementation/orchestration/wave19-plan.md:350`.

### High: Package-local references are truthful fallback only and cannot be counted as actual texture rendering

Domain F intentionally restricted actual SVG pattern/image rendering to `deterministic-data-url-v1`, while keeping package-local refs as fallback:

- `discussion/implementation/waves/wave19/wave19-editor-texture-backed-preview-visual-completion.md:57`
- `discussion/implementation/waves/wave19/wave19-editor-texture-backed-preview-visual-completion.md:58`
- `discussion/implementation/waves/wave19/wave19-editor-texture-backed-preview-visual-completion.md:73`
- `apps/editor/src/ui/preview-panel/preview-visual.ts:92`
- `apps/editor/src/ui/preview-panel/preview-visual.ts:221`

The existing e2e source intake smoke still uses metadata/default package-local behavior and even labels the fixture as metadata-only:

- `apps/editor/e2e/source-intake-smoke.mjs:15`
- `apps/editor/e2e/source-intake-smoke.mjs:355`
- `apps/editor/e2e/source-intake-smoke.mjs:377`

Extending this smoke to assert package-local preview fallback would be useful, but it would not meet the Domain G requirement to observe actual texture-backed preview rendering.

### Medium: `generated://texture-preview/...` is UI-accepted but operation-rejected, so hiding it in e2e would be misleading

Domain C explicitly recorded the draft UI's allowed references as `assets/textures/...`, `assets/thumbnails/...`, and `generated://texture-preview/...`, and also recorded that data URLs are intentionally not allowed without a user/design decision:

- `discussion/implementation/waves/wave19/wave19-editor-source-layer-part-texture-draft-ui-completion.md:68`
- `discussion/implementation/waves/wave19/wave19-editor-source-layer-part-texture-draft-ui-completion.md:137`

Operation-side materialization accepts package-local paths or deterministic data URLs and rejects schemes such as `generated://`:

- `packages/operation-core/src/operations/import-split-png-source-asset-texture.ts:50`
- `packages/operation-core/src/operations/import-split-png-source-asset-texture.ts:166`
- `packages/operation-core/src/operations/import-split-png-source-asset-texture.ts:208`

Domain D and Domain F both record this UI/operation mismatch as remaining risk, not as resolved behavior:

- `discussion/implementation/waves/wave19/wave19-source-import-create-drawable-texture-workflow-completion.md:106`
- `discussion/implementation/waves/wave19/wave19-editor-texture-backed-preview-visual-completion.md:125`

Therefore a Domain G e2e cannot use `generated://texture-preview/...` as an accepted actual-rendering path without hiding a known unsupported operation path.

### Low: Existing e2e accessibility smoke does not yet cover the new texture fields, but that is not the blocking issue

The Source Intake form now has labels for `Texture preview reference`, `Texture ID`, and `Target part ID`:

- `apps/editor/src/ui/source-assets/source-intake-form.ts:339`
- `apps/editor/src/ui/source-assets/source-intake-form.ts:347`
- `apps/editor/src/ui/source-assets/source-intake-form.ts:352`

The current e2e accessible-name assertion still checks only the older subset of labels:

- `apps/editor/e2e/source-intake-smoke.mjs:277`
- `apps/editor/e2e/source-intake-smoke.mjs:304`

This is implementable within Domain G, but by itself it does not unblock the actual texture-rendering pass criterion because the browser-materialized preview reference remains unavailable through the form.

## Gnome Escalation Acceptance

Accepted.

Gnome correctly avoided editing `apps/editor/src/editor-state/source-intake-draft-state.ts` or other source validation behavior outside Domain G's allowed scope. The claimed blocker is real: the only currently truthful actual-rendering reference kind is `deterministic-data-url-v1`, but the Source Intake draft UI rejects the `data:image/...` string needed to create that reference through the browser form.

## Verification / Commands Performed

- Read orchestration and subagent hygiene skill instructions.
- Read the Wave19 plan, current capability map, Wave18 final report, Wave19 Domain C/D/E/F completion reports, and Gnome notes.
- Inspected relevant source/e2e files:
  - `apps/editor/e2e/source-intake-smoke.mjs`
  - `apps/editor/e2e/smoke-checks.mjs`
  - `apps/editor/e2e/test-ids.mjs`
  - `scripts/editor-e2e-smoke.mjs`
  - `apps/editor/src/editor-state/source-intake-draft-state.ts`
  - `apps/editor/src/ui/source-assets/source-intake-form.ts`
  - `apps/editor/src/editor-workflow/source-intake-workflow.ts`
  - `packages/operation-core/src/operations/import-split-png-source-asset-texture.ts`
  - `packages/operation-core/src/operations/import-split-png-source-asset.ts`
  - `packages/operation-core/src/payloads/import-source.ts`
  - `packages/package-format/src/texture-atlas.ts`
  - `apps/editor/src/ui/preview-panel/preview-visual.ts`
  - `apps/editor/src/ui/preview-panel/preview-summary.ts`
  - `apps/editor/src/editor-preview/texture-preview-resolution.ts`
- Inspected current diff/stat for relevant source and e2e files.
- Confirmed no tracked diff exists under Domain G e2e write paths (`apps/editor/e2e`, `apps/editor/tests`, `fixtures/e2e`, `scripts/editor-e2e-smoke.mjs`).
- Ran `git diff --check -- discussion/implementation/waves/wave19/wave19-texture-preview-e2e-and-persistence-smoke-gnome-notes.md`; result: pass, no whitespace errors.

No e2e test run was performed for this review because the review verdict is about accepting an early escape before implementation; the existing e2e path cannot produce the required actual texture-rendered state without a source validation/design change.

## Remaining Risks

- A direct app-shell/unit path can create a data URL texture preview by bypassing Source Intake form confirmation, but that is not Domain G browser-level source-intake evidence.
- Package-local preview refs remain metadata-only fallback until a future browser materialization path provides served URLs, object URLs, or another deterministic browser-resolvable reference.
- If `generated://texture-preview/...` remains UI-accepted, the next e2e/domain must assert the rejection visibly or align the UI/operation contract first.
- After the design decision, Domain G still needs robust desktop/mobile assertions for `data-texture-render="texture_pattern"`, expected `data-texture-id`, SVG `<image>` href/reference kind, saved `texture-atlas.json`, and load restoration.

## User-Decision Points For Undine

- Decide whether Source Intake draft validation may accept deterministic `data:image/(png|jpeg|webp);base64,...` preview references. This is the narrowest path to unblock the current Domain G pass criteria.
- Decide whether to remove `generated://texture-preview/...` from the draft UI accepted set, convert it into an operation-supported generated artifact path, or keep it only as a visibly rejected draft/operation mismatch.
- If data URLs are not acceptable product direction, decide the alternate browser-materialized preview reference design and assign it to a source implementation domain before re-running Domain G.
