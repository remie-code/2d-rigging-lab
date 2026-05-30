# Wave19 Domain G Completion: Texture Preview E2E And Persistence Smoke

## Verdict

`escalate`

Domain G did not implement the browser-level texture preview e2e smoke. The current Source Intake browser workflow cannot submit the deterministic data URL texture preview reference required for truthful actual texture rendering. Package-local texture preview references are intentionally rendered as `solid_fallback`, and `generated://texture-preview/...` remains UI-accepted but operation-rejected.

The early escape is accepted by independent Review-Sylph review.

## Scope

- Domain: `wave19-texture-preview-e2e-and-persistence-smoke`
- Gnome implementation agent: `019e7adf-7d95-7a71-a511-ef38ec13a0fa` (`Gnome the 49th`)
- Review-Sylph agent/context id: `019e7ae4-04ba-7792-ab20-df9224c920bc` (`Sylph the 50th`)
- Review report: `discussion/implementation/reviews/wave19/wave19-texture-preview-e2e-and-persistence-smoke-review.md`
- Review verdict: `pass` for accepting the escalation
- Date: 2026-05-31
- Orch-Sylph source implementation: none. Orch-Sylph only coordinated, reviewed outputs, and wrote this discussion artifact.

## Basis

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave19-plan.md`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/waves/wave18/wave18-final-report.md`
- `discussion/implementation/waves/wave19/wave19-editor-source-layer-part-texture-draft-ui-completion.md`
- `discussion/implementation/waves/wave19/wave19-source-import-create-drawable-texture-workflow-completion.md`
- `discussion/implementation/waves/wave19/wave19-texture-provenance-validator-evidence-completion.md`
- `discussion/implementation/waves/wave19/wave19-editor-texture-backed-preview-visual-completion.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/design/module-contracts/package-file-format-contract.md`
- `discussion/design/module-contracts/operation-contracts.md`
- `discussion/design/module-contracts/validator-contract.md`
- `discussion/design/mvp-authoring-runtime/01-open-model-package-design.md`

## Files Changed

Discussion artifacts only:

- `discussion/implementation/waves/wave19/wave19-texture-preview-e2e-and-persistence-smoke-gnome-notes.md`
- `discussion/implementation/reviews/wave19/wave19-texture-preview-e2e-and-persistence-smoke-review.md`
- `discussion/implementation/waves/wave19/wave19-texture-preview-e2e-and-persistence-smoke-completion.md`

No source implementation, e2e, fixture, UI, package, operation, runtime, or validator files were changed by Domain G.

## Escalation Reason

Domain G pass evidence requires a browser-level flow that starts from the Source Intake form and reaches actual texture-backed preview rendering. The only current actual-rendering path is a `deterministic-data-url-v1` preview asset, materialized from a `data:image/(png|jpeg|webp);base64,...` texture preview reference.

The current Source Intake draft validation does not accept `data:image/...`; it accepts package-local `assets/textures/...`, `assets/thumbnails/...`, and `generated://texture-preview/...` values. Package-local values are correctly treated by Domain F as fallback only, not successful texture rendering. `generated://texture-preview/...` is UI-accepted but rejected by the operation materialization path, and hiding that mismatch in e2e would violate the Wave19 truthfulness note.

Changing Source Intake draft validation is editor-state behavior, not a narrow e2e/test-id/aria tweak, and is outside the Domain G allowed source write scope.

## Review Result

Review-Sylph accepted Gnome's escalation.

Key review findings:

- High: Domain G cannot satisfy actual texture rendering from the Source Intake form within allowed source scope.
- High: Package-local references are truthful fallback only and cannot count as actual texture rendering evidence.
- Medium: `generated://texture-preview/...` is UI-accepted but operation-rejected, so using it as a hidden success path would be misleading.
- Low: Existing e2e accessible-name checks do not yet cover new texture fields, but that is not the blocker.

## Verification

| Command / Check | Result | Notes |
|---|---|---|
| Gnome source inspection | complete | Gnome inspected the required basis docs and relevant e2e/source files, then stopped before source edits. |
| Review-Sylph clean review | pass | Review inspected basis docs, current source/e2e/diff, and accepted the early escape. |
| `git diff --check -- discussion/implementation/waves/wave19/wave19-texture-preview-e2e-and-persistence-smoke-gnome-notes.md` | pass | Run by Review-Sylph and confirmed by Orch-Sylph. |
| `git diff --check -- discussion/implementation/waves/wave19/wave19-texture-preview-e2e-and-persistence-smoke-gnome-notes.md discussion/implementation/reviews/wave19/wave19-texture-preview-e2e-and-persistence-smoke-review.md` | pass | Orch-Sylph rerun; no whitespace errors. |

Not run:

- `pnpm.cmd test:e2e`
- `pnpm.cmd typecheck`
- focused UI/e2e tests

Reason: no source implementation was produced and the current browser workflow cannot create the required actual texture-rendered state without a source validation/design change.

## Pass Evidence Not Achieved

- Source intake form cannot currently register a deterministic data URL texture preview reference.
- Actual texture-backed preview observation from source intake cannot be produced through the browser form.
- Save/load preservation of the actual texture preview relation cannot be proven at e2e level.
- Desktop/mobile texture-backed workflow smoke remains unimplemented.

Existing package-local fallback behavior remains truthful and should not be counted as Domain G pass evidence.

## User-Decision Points For Undine

- Decide whether Source Intake draft validation may accept deterministic `data:image/(png|jpeg|webp);base64,...` preview references. This is the narrowest path to unblock Domain G's current pass criteria.
- Decide whether to remove `generated://texture-preview/...` from the draft UI accepted set, make it an operation-supported generated artifact path, or keep it only as a visibly rejected draft/operation mismatch.
- If data URLs are not acceptable product direction, assign a prior source implementation domain for an alternate browser-materialized preview reference before re-running Domain G.

## Remaining Risks

- Wave19 cannot pass its Domain G gate until this design/scope issue is resolved and the desktop/mobile browser smoke is implemented.
- Package-local preview references remain metadata-only fallback until a browser materialization layer provides served URLs, object URLs, or equivalent deterministic browser-resolvable references.
- Once unblocked, Domain G still needs robust e2e assertions for `data-texture-render="texture_pattern"`, expected `data-texture-id`, SVG image reference, saved `assets/textures/texture-atlas.json`, and load restoration.

