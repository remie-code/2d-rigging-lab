# Wave18 Domain D レビュー: Editor Source Import Workflow Integration

## Verdict

`pass`

Domain D の対象である editor session / workflow / state / source-assets 範囲では、`importSplitPngSourceAsset` と `setRightsMetadata` を operation-core 経由で commit し、imported source layer を既存 createDrawable preset workflow に渡し、save/load で source manifest / provenance / rights / drawable relation を復元する経路を確認できた。

Blocking findings: なし。

## Review Context Separation

- Role: Review-Sylph for `wave18-editor-source-import-workflow-integration`
- Gnome implementation agent id: `019e78df-bf62-7d72-8d6b-87230ba82675` (`Gnome the 28th`)
- Review-Sylph はこの別コンテキストで clean review を実施した。
- source implementation files / tests は編集していない。
- 書き込みはこの review artifact のみ。

## Basis Documents Used

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave18-plan.md`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/waves/wave17/wave17-final-report.md`
- `discussion/implementation/waves/wave18/wave18-split-png-import-operation-foundation-completion.md`
- `discussion/implementation/reviews/wave18/wave18-split-png-import-operation-foundation-review.md`
- `discussion/implementation/waves/wave18/wave18-editor-source-intake-draft-ui-state-completion.md`
- `discussion/implementation/reviews/wave18/wave18-editor-source-intake-draft-ui-state-review.md`
- `discussion/implementation/waves/wave18/wave18-asset-rights-provenance-validator-evidence-completion.md`
- `discussion/implementation/reviews/wave18/wave18-asset-rights-provenance-validator-evidence-review.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/design/module-contracts/operation-contracts.md`
- `discussion/design/mvp-authoring-runtime/01-open-model-package-design.md`
- `discussion/implementation/waves/wave18/wave18-editor-source-import-workflow-integration-completion.md`

## Scope Reviewed

Direct reads and scoped diffs were used for:

- `apps/editor/src/editor-session/**`
- `apps/editor/src/editor-workflow/**`
- `apps/editor/src/editor-state/**`
- `apps/editor/src/ui/source-assets/**`
- `discussion/implementation/waves/wave18/wave18-editor-source-import-workflow-integration-completion.md`

Boundary-only check:

- `apps/editor/src/app/editor-app.ts`

`git status --short -uall` shows other Wave18 package / validator / app-shell / style changes outside this Domain D review scope. They were treated as parallel domain work unless required for a boundary decision.

## Lane 1: Design / Development Compliance

`pass`.

- Editor source import requests are built as operation-core requests with `actor: "human"`, `surface: "gui"`, `operationType: "importSplitPngSourceAsset"` and payload rights / provenance metadata in `apps/editor/src/editor-session/source-import-command.ts:36`.
- Rights update requests similarly go through `operationType: "setRightsMetadata"` in `apps/editor/src/editor-session/source-import-command.ts:66`.
- `EditorSessionAdapter` exposes `commitImportSplitPngSourceAsset` and `commitSetRightsMetadata` and both delegate to `commitOperation`, so editor code does not directly mutate package documents (`apps/editor/src/editor-session/session-adapter.ts:218`, `apps/editor/src/editor-session/session-adapter.ts:226`).
- Workflow controller exposes `commitSourceIntakeDraft` / `commitSetRightsMetadata`, commits through the session adapter, and projects successful import results into state (`apps/editor/src/editor-workflow/workflow-controller.ts:191`, `apps/editor/src/editor-workflow/workflow-controller.ts:335`, `apps/editor/src/editor-workflow/workflow-controller.ts:359`).
- Source draft to operation payload conversion is isolated in `source-intake-workflow.ts`, including provenance `transformHistory` notes (`apps/editor/src/editor-workflow/source-intake-workflow.ts:12`, `apps/editor/src/editor-workflow/source-intake-workflow.ts:38`).
- Workflow projection reloads `sourceAssets` from the reloaded package document and applies imported source selection to createDrawable defaults (`apps/editor/src/editor-workflow/workflow-state-projection.ts:67`, `apps/editor/src/editor-state/editor-state-projections.ts:166`).
- `index.ts` files remain barrel-only re-export surfaces. Spot-checked `apps/editor/src/editor-state/index.ts`, `apps/editor/src/editor-session/index.ts`, `apps/editor/src/editor-workflow/index.ts`, and `apps/editor/src/ui/source-assets/index.ts`.
- No packages, e2e, drawable-authoring source, or unrelated large refactor was introduced in the Domain D scoped source files.

App-level callback gap judgment:

- `apps/editor/src/app/editor-app.ts` still stores `sourceIntakeDraft` as app-local state and `onConfirmSourceIntakeDraft` only assigns that draft and rerenders (`apps/editor/src/app/editor-app.ts:15`, `apps/editor/src/app/editor-app.ts:52`).
- This is not a blocking Domain D finding because `editor-app.ts` is outside the Domain D allowed write scope and Domain D pass evidence is explicitly session/workflow integration. It is, however, a Domain F prerequisite: browser GUI submit will not commit an import until the app-level callback is allowed to call `workflow.commitSourceIntakeDraft(draft)`.

## Lane 2: Test Adequacy

`pass`.

- Session tests cover split PNG source import persistence into package assets and operation log (`apps/editor/src/editor-session/session-adapter.test.ts:323`, `apps/editor/src/editor-session/session-adapter.test.ts:343`).
- Session tests cover rights metadata update after import and rights file materialization (`apps/editor/src/editor-session/session-adapter.test.ts:386`, `apps/editor/src/editor-session/session-adapter.test.ts:429`).
- Session tests cover createDrawable from an imported source layer and source layer `mappedDrawableIds` update (`apps/editor/src/editor-session/session-adapter.test.ts:434`, `apps/editor/src/editor-session/session-adapter.test.ts:472`).
- Workflow tests cover import -> rights update -> createDrawable -> save/load restore, including operation log count and source layer mapping after load (`apps/editor/src/editor-workflow/workflow-controller.test.ts:98`, `apps/editor/src/editor-workflow/workflow-controller.test.ts:130`, `apps/editor/src/editor-workflow/workflow-controller.test.ts:197`, `apps/editor/src/editor-workflow/workflow-controller.test.ts:202`).
- Workflow tests cover blocked rights draft rejection with no operation log append and no source asset list insertion (`apps/editor/src/editor-workflow/workflow-controller.test.ts:210`, `apps/editor/src/editor-workflow/workflow-controller.test.ts:221`, `apps/editor/src/editor-workflow/workflow-controller.test.ts:229`).
- Source-assets tests cover imported source asset rows for createDrawable handoff (`apps/editor/src/ui/source-assets/source-intake-panel.test.ts:125`).

No blocking test gap was found for Domain D. GUI-level submit-to-commit and desktop/mobile persistence smoke correctly remain Domain F scope, but must include the app-level callback wiring noted above.

## Lane 3: Workflow / Persistence Integrity

`pass`.

- Editor session can commit `importSplitPngSourceAsset` and `setRightsMetadata` via operation-core boundary.
- Import commits materialize `assets/sources/source-manifest.json`, `assets/provenance.json`, `assets/rights.json`, and `operations/log.jsonl`.
- Rights update keeps provenance operation linkage observable.
- Imported source layer can feed existing `commitCreateDrawablePreset`.
- Save/load restores source manifest, rights/provenance, operation log, and drawable relation.
- Blocked rights draft remains a rejected operation result and does not append successful import evidence.

## Verification

Reviewed Gnome-reported verification:

- `pnpm.cmd exec vitest run apps/editor/src/editor-session/session-adapter.test.ts apps/editor/src/editor-workflow/workflow-controller.test.ts apps/editor/src/ui/source-assets/source-intake-panel.test.ts apps/editor/src/editor-state/editor-view-model.test.ts apps/editor/src/editor-state/source-intake-draft-state.test.ts`
  - reported pass after sandbox escalation, 5 files / 45 tests.
- `pnpm.cmd --filter @private-2d-rigging-lab/editor typecheck`
  - reported pass after sandbox escalation and one type fix.

Reviewer reruns / spot checks:

- `pnpm.cmd run check:source` -> pass.
- `git diff --check -- apps/editor/src/editor-session apps/editor/src/editor-workflow apps/editor/src/editor-state apps/editor/src/ui/source-assets discussion/implementation/waves/wave18/wave18-editor-source-import-workflow-integration-completion.md` -> pass with LF/CRLF warnings only.
- Direct file reads and `rg` checks for `commitSourceIntakeDraft`, `commitImportSplitPngSourceAsset`, `setRightsMetadata`, `onConfirmSourceIntakeDraft`, source manifest / rights / provenance / blocked rights coverage.

Focused Vitest / typecheck were not independently rerun in this review context because the implementation context already supplied the necessary escalated pass results and the review reran non-mutating source guard / diff checks.

## Non-Blocking Risks / Follow-Up

- `apps/editor/src/app/editor-app.ts` must be included in the next GUI/e2e domain or explicitly delegated back before Domain F can prove browser-level source intake submit -> import commit -> save/load. Current mounted app submit only confirms the draft locally (`apps/editor/src/app/editor-app.ts:52`).
- `setRightsMetadata` has workflow/session API coverage but no dedicated UI control yet. Domain D proves the operation path; later GUI work must decide how users trigger rights updates after import.
- Real PNG bytes, file picker, image decoding, texture atlas generation, and actual texture rendering remain Wave18 non-goals.

## User / Design Decision Points

No user decision is blocking Domain D.

Orch-Sylph / Undine should ensure Domain F write scope permits `apps/editor/src/app/editor-app.ts` callback wiring, or Domain F will hit an avoidable app-level integration blocker.
