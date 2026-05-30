# Wave 17 Domain E Review: mesh vertex edit e2e and persistence smoke

- verdict: `pass`
- reviewer: Review-Sylph
- target: `wave17-mesh-vertex-edit-e2e-and-persistence-smoke`
- review lanes: Product Workflow / Persistence Review, Test Adequacy Review, UI / Accessibility Smoke Review

## Review Context Separation Evidence

本レビューは、Domain E 実装担当 Gnome とは別コンテキストの Review-Sylph として実施した。

- Gnome implementation context: `019e78a6-1073-73d0-bcb1-b49ecdda7b7d` (`Gnome the 16th`)
- Review-Sylph context: this review context, separate from the implementation context. 本レビュー context の agent id はツール出力や呼び出し文脈からは露出していない。
- Source implementation files / tests は編集していない。書き込みは、親から明示委譲された本 review report の新規作成のみ。
- Gnome summary だけに依存せず、basis documents、actual diff、新規 E2E source、completion report、独立 verification rerun を直接確認した。

## Basis Documents Used

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave17-plan.md`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/waves/wave16/wave16-final-report.md`
- `discussion/implementation/waves/wave17/wave17-mesh-vertex-operation-foundation-completion.md`
- `discussion/implementation/reviews/wave17/wave17-mesh-vertex-operation-foundation-review.md`
- `discussion/implementation/waves/wave17/wave17-mesh-vertex-runtime-evidence-regression-completion.md`
- `discussion/implementation/reviews/wave17/wave17-mesh-vertex-runtime-evidence-regression-review.md`
- `discussion/implementation/waves/wave17/wave17-editor-mesh-edit-workflow-state-completion.md`
- `discussion/implementation/reviews/wave17/wave17-editor-mesh-edit-workflow-state-review.md`
- `discussion/implementation/waves/wave17/wave17-editor-mesh-vertex-controls-ui-completion.md`
- `discussion/implementation/reviews/wave17/wave17-editor-mesh-vertex-controls-ui-review.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/implementation/waves/wave17/wave17-mesh-vertex-edit-e2e-and-persistence-smoke-completion.md`

## Changed Files / Diff Reviewed

Scoped diff reviewed:

- `apps/editor/e2e/test-ids.mjs`
- `apps/editor/e2e/smoke-checks.mjs`
- `apps/editor/e2e/layer-controls-smoke.mjs`
- `discussion/implementation/waves/wave17/wave17-mesh-vertex-edit-e2e-and-persistence-smoke-completion.md`

New file read directly:

- `apps/editor/e2e/mesh-vertex-smoke.mjs`

Supporting files inspected for runner / UI contract context:

- `scripts/editor-e2e-smoke.mjs`
- `apps/editor/e2e/page-session.mjs`
- `apps/editor/src/editor-state/editor-test-ids.ts`
- `apps/editor/src/ui/drawable-authoring/mesh-vertex-controls.ts`

Worktree には Domain A-D 由来の package/editor/UI 変更と orchestration/report 変更も残っているが、Domain E の実装差分としては扱っていない。Domain E の対象変更は許可された `apps/editor/e2e/**` と Domain E completion report に収まっている。

## Verification Performed / Considered

Independent review verification performed:

- `git status --short -uall`: Domain E 変更と Wave17 既存 domain 変更を確認。
- `git diff -- apps/editor/e2e/test-ids.mjs apps/editor/e2e/smoke-checks.mjs apps/editor/e2e/layer-controls-smoke.mjs discussion/implementation/waves/wave17/wave17-mesh-vertex-edit-e2e-and-persistence-smoke-completion.md`: reviewed.
- `node --check apps/editor/e2e/mesh-vertex-smoke.mjs`: pass.
- `node --check apps/editor/e2e/smoke-checks.mjs`: pass.
- `node --check apps/editor/e2e/layer-controls-smoke.mjs`: pass.
- `pnpm.cmd run check:source`: pass.
- `git diff --check -- apps/editor/e2e discussion/implementation/waves/wave17/wave17-mesh-vertex-edit-e2e-and-persistence-smoke-completion.md`: pass, LF/CRLF warnings only.
- `pnpm.cmd typecheck`: sandbox run failed with `EPERM` reading `node_modules/.../typescript/bin/tsc`; escalated rerun passed root and editor typecheck.
- `pnpm.cmd test:e2e`: sandbox run failed with Vite `fdir` `ERR_MODULE_NOT_FOUND`; escalated rerun passed desktop and mobile smoke. Logged metadata matched the Gnome report: desktop preview `base64Length=68048`, desktop drawable `base64Length=86504`, mobile preview `base64Length=39172`, mobile drawable `base64Length=48796`.

Gnome verification considered:

- Same node syntax checks: pass.
- `pnpm.cmd test:e2e`: pass after sandbox escalation.
- `pnpm.cmd typecheck`: pass after sandbox escalation.
- `pnpm.cmd run check:source`: pass.
- Scoped `git diff --check`: pass, LF/CRLF warnings only.
- New-file trailing whitespace check: pass per completion report.

## Findings

Blocking findings: none.

Warnings: none requiring a Gnome fix loop.

Non-blocking residual notes:

- `assertSavedMeshVertexState` verifies the saved package vertex coordinate exactly and verifies a `moveMeshVertex` operation log entry with expected target ids, but it does not assert the operation log payload delta itself (`apps/editor/e2e/mesh-vertex-smoke.mjs:139`, `apps/editor/e2e/mesh-vertex-smoke.mjs:172`). This is acceptable for Domain E smoke because saved `model/meshes.json`, loaded UI row, operation count/type, and target ids are all fixed; a future stronger regression could also assert `payload.vertexDeltas`.
- The mesh-vertex screenshot is captured by the workflow but the top-level runner still logs only preview/drawable screenshot metadata (`apps/editor/e2e/mesh-vertex-smoke.mjs:105`, `scripts/editor-e2e-smoke.mjs:35`). This is not blocking because the E2E command itself fails on blank screenshot capture and the requested smoke assertions are DOM/SVG/persistence based.

## Product Workflow / Persistence Review

`pass`.

The browser smoke now executes the intended path in the main E2E flow: generated drawable creation, mesh vertex nudge, layer controls, save, load, and reset (`apps/editor/e2e/smoke-checks.mjs:63`, `apps/editor/e2e/smoke-checks.mjs:65`, `apps/editor/e2e/smoke-checks.mjs:67`, `apps/editor/e2e/smoke-checks.mjs:74`, `apps/editor/e2e/smoke-checks.mjs:80`).

The mesh edit workflow targets the deterministic generated vertex `vtx_wave_15_smoke_drawable_0_0`, confirms the initial row and preview point at `84, 24`, clicks the `+X` button, and waits for row text, status text, preview summary, SVG polygon point change, and the new `85,24` point (`apps/editor/e2e/mesh-vertex-smoke.mjs:29`, `apps/editor/e2e/mesh-vertex-smoke.mjs:52`, `apps/editor/e2e/mesh-vertex-smoke.mjs:58`, `apps/editor/e2e/mesh-vertex-smoke.mjs:69`). This is a deterministic preview-change oracle rather than a click-only smoke.

Persistence is checked at three levels. Saved package text is parsed from browser-local project storage and `model/meshes.json` must contain vertex index 0 at `{ x: 85, y: 24 }` (`apps/editor/e2e/mesh-vertex-smoke.mjs:134`, `apps/editor/e2e/mesh-vertex-smoke.mjs:172`). The operation log must contain a `moveMeshVertex` entry targeting both the mesh and vertex (`apps/editor/e2e/mesh-vertex-smoke.mjs:139`, `apps/editor/e2e/mesh-vertex-smoke.mjs:143`, `apps/editor/e2e/mesh-vertex-smoke.mjs:177`). After reload, the mesh vertex controls and row must still show the edited coordinate (`apps/editor/e2e/smoke-checks.mjs:80`, `apps/editor/e2e/mesh-vertex-smoke.mjs:187`).

Existing preview slider, generated drawable, layer controls, save/load, and AI smoke behavior remain in the same runner. Layer operation count expectations were parameterized while preserving the previous default count for standalone use (`apps/editor/e2e/layer-controls-smoke.mjs:11`, `apps/editor/e2e/layer-controls-smoke.mjs:143`), and the integrated smoke passes the new mesh edit count through `initialOperationLogEntryCount: 4` (`apps/editor/e2e/smoke-checks.mjs:67`).

## Test Adequacy Review

`pass`.

The oracle is specific enough for a browser-level smoke:

- mesh vertex controls/status/row/button are required before action (`apps/editor/e2e/mesh-vertex-smoke.mjs:29`);
- accessible labels and reachability are checked before clicking (`apps/editor/e2e/mesh-vertex-smoke.mjs:39`);
- initial preview polygon includes the starting point (`apps/editor/e2e/mesh-vertex-smoke.mjs:52`);
- post-click polygon points must be non-empty, different from the initial points, and include the nudged coordinate (`apps/editor/e2e/mesh-vertex-smoke.mjs:69`);
- operation log count and operation summary include `moveMeshVertex` after nudge (`apps/editor/e2e/mesh-vertex-smoke.mjs:92`);
- preview summary is fixed to the current deterministic post-nudge state of `0 changes / 0 drawables` (`apps/editor/e2e/mesh-vertex-smoke.mjs:101`);
- saved package, operation log target ids, and loaded row coordinate are checked separately (`apps/editor/e2e/mesh-vertex-smoke.mjs:122`, `apps/editor/e2e/mesh-vertex-smoke.mjs:187`).

Desktop and mobile are both covered by the existing runner. `editorSmokeViewports` defines desktop and mobile viewports (`apps/editor/e2e/smoke-checks.mjs:33`), and `scripts/editor-e2e-smoke.mjs` iterates every viewport and calls `runEditorSmoke` (`scripts/editor-e2e-smoke.mjs:29`). The independent escalated `pnpm.cmd test:e2e` rerun confirmed both `desktop smoke passed` and `mobile smoke passed`.

Helper changes are narrow. `test-ids.mjs` mirrors the Domain D mesh vertex ids (`apps/editor/e2e/test-ids.mjs:13`, `apps/editor/e2e/test-ids.mjs:59`), `smoke-checks.mjs` composes the new workflow into the existing smoke, and `layer-controls-smoke.mjs` only adds operation-count parameters with previous defaults intact. No broad UI or production source change was introduced by Domain E.

## UI / Accessibility Smoke Review

`pass` at browser smoke level.

The E2E checks basic layout/reachability by requiring the controls section, status, and nudge button to have visible non-zero rectangles after scrolling the target button into view (`apps/editor/e2e/mesh-vertex-smoke.mjs:204`). It also runs the existing horizontal overflow checks after mesh edit, after layer controls, after load, and after reset (`apps/editor/e2e/smoke-checks.mjs:66`, `apps/editor/e2e/smoke-checks.mjs:73`, `apps/editor/e2e/smoke-checks.mjs:93`).

Accessible-name smoke covers the Domain D controls directly: `aria-labelledby` resolves to `Mesh Vertex Controls`, status has `role="status"` and `aria-label="Mesh vertex edit status"`, the button text is `+X`, and the button accessible label is `Nudge <vertexId> right` (`apps/editor/e2e/mesh-vertex-smoke.mjs:257`). These correspond to the UI contract implemented by Domain D (`apps/editor/src/ui/drawable-authoring/mesh-vertex-controls.ts:21`, `apps/editor/src/ui/drawable-authoring/mesh-vertex-controls.ts:65`, `apps/editor/src/ui/drawable-authoring/mesh-vertex-controls.ts:179`).

No residual accessibility/layout gap is blocking Domain E. This remains a smoke-level check, not a complete accessibility tree audit.

## Remaining Risks / Open Verification Items

- Browser-local persistence is proven; OS filesystem / archive import-export remains future scope.
- Preview summary does not count base mesh vertex edits as preview diff changes by current design. Domain E therefore fixes visual polygon points, mesh row labels, operation log, saved package coordinates, and loaded UI coordinates instead of requiring a preview-summary diff count.
- The final saved/loaded preview has the edited drawable hidden because the existing layer controls smoke continues after mesh edit and hides the created drawable. Loaded coordinate persistence is still proven through the mesh vertex row.
- Operation log payload delta assertion could be added later for a stricter persistence regression, but it is not required to pass this smoke gate.

## Needs-Fix Recommendation

No needs-fix loop is recommended. Domain E satisfies the assigned browser workflow, persistence, desktop/mobile, basic a11y, and existing smoke preservation requirements.
