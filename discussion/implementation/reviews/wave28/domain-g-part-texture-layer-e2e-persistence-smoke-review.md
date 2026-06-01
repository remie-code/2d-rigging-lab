# Wave28 Domain G Review: Part / Texture / Layer E2E Persistence Smoke

## verdict

escalate

## basis used

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave28-plan.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`
- `discussion/tests/traceability/test-traceability-matrix.md`
- `discussion/tests/fixtures/fixture-manifest.md`
- Upstream Domain F reports under `discussion/implementation/waves/wave28/` and `discussion/implementation/reviews/wave28/`
- Gnome report: `discussion/implementation/waves/wave28/domain-g-part-texture-layer-e2e-persistence-smoke-gnome-report.md`
- Target files and repository diff

## findings

### Blocking: full mobile e2e still fails before the integrated Domain G smoke can run

`pnpm.cmd test:e2e` fails in the mobile full smoke at `mobile post-source-intake` with horizontal overflow from `.layer-tree-panel__field` / `.layer-tree-panel__select`: element right edge `451` against viewport width `390`. The failure is raised at `apps/editor/e2e/smoke-checks.mjs:89` from overflow evidence captured at `apps/editor/e2e/smoke-checks.mjs:83`.

This prevents full mobile adjacent regression coverage from reaching the new Domain G integrated smoke in `apps/editor/e2e/smoke-checks.mjs:179` to `apps/editor/e2e/smoke-checks.mjs:186`. Desktop full smoke does pass before the mobile run starts, and the focused desktop/mobile smoke passes, but the Wave28 Domain G pass evidence requires existing e2e not to regress or to be rerun and recorded honestly.

I do not consider the narrow layout fix to be within Domain G's allowed source scope. The Domain G scope is `apps/editor/e2e/**`, reports/reviews, and only narrow test id or aria tweaks in UI files. Fixing the overflowing texture `<select>` would change UI layout behavior in source files such as `apps/editor/src/ui/layer-tree/layer-tree-panel.ts:102` to `apps/editor/src/ui/layer-tree/layer-tree-panel.ts:106` or stylesheet rules, not test id or aria wiring. Escalation is the correct boundary.

### Blocking: the focused smoke codifies non-truthful Viewer drawable part evidence

The focused smoke verifies saved package truth correctly: the saved drawable is expected to have `partId: smoke.partId` at `apps/editor/e2e/part-texture-layer-persistence-smoke.mjs:523` to `apps/editor/e2e/part-texture-layer-persistence-smoke.mjs:527`, and the created part is expected to contain the drawable at `apps/editor/e2e/part-texture-layer-persistence-smoke.mjs:516` to `apps/editor/e2e/part-texture-layer-persistence-smoke.mjs:522`.

However, the Viewer assertion after save/load expects the Drawable Layer Evidence text `${smoke.drawableId}: part none / texture ${smoke.textureId}` at `apps/editor/e2e/part-texture-layer-persistence-smoke.mjs:381` to `apps/editor/e2e/part-texture-layer-persistence-smoke.mjs:385`. That contradicts the saved package state and the part hierarchy evidence. The Gnome report also calls this out as a remaining issue.

Because the review lane requires Viewer/Runtime evidence after load to be semantic and truthful, this cannot be treated as a Domain G pass. Fixing the actual Viewer projection appears to require source changes outside Domain G's e2e-only scope, so this should be routed back to the owning source domain rather than hidden by e2e expectations.

## compliance review

- E2E scope containment: the Domain G target changes are confined to `apps/editor/e2e/**` and the Gnome report. No implementation source changes are part of the Domain G changed-file set.
- Test-id mirror: `apps/editor/e2e/test-ids.mjs:13` to `apps/editor/e2e/test-ids.mjs:22` and `apps/editor/e2e/test-ids.mjs:116` to `apps/editor/e2e/test-ids.mjs:129` mirror the source IDs in `apps/editor/src/editor-state/editor-test-ids.ts:13` to `apps/editor/src/editor-state/editor-test-ids.ts:22` and `apps/editor/src/editor-state/editor-test-ids.ts:105` to `apps/editor/src/editor-state/editor-test-ids.ts:118`.
- Public `index.ts` policy: inspected changed `index.ts` diffs in editor/package source. They are re-export only, with no implementation bodies.
- Dependency policy: no `package.json`, workspace, or lockfile diff was present for Domain G. No external dependency was added.
- Forbidden scope: scanned Domain G files for file picker, parser, image decode, external dependency, full renderer, pixel oracle, Cubism, SDK/Core, wasm, archive, and asset I/O claims. The only hit is a fixture note at `apps/editor/e2e/part-texture-layer-persistence-smoke.mjs:57` explicitly saying the seed is metadata-only and does not use PSD bytes, file picker, parser, or image decode.

## test adequacy review

- The focused smoke covers desktop/mobile viewports via `partTextureLayerSmokeViewports` at `apps/editor/e2e/part-texture-layer-persistence-smoke.mjs:18` to `apps/editor/e2e/part-texture-layer-persistence-smoke.mjs:31`.
- The focused workflow performs part create, drawable part reassignment, texture assignment, layer select/lock/editor-hide, Preview inspection, Viewer inspection, save/load, and reinspection at `apps/editor/e2e/part-texture-layer-persistence-smoke.mjs:66` to `apps/editor/e2e/part-texture-layer-persistence-smoke.mjs:124`.
- Persistence assertions cover package graph, drawable membership, texture atlas entry, preview asset reference kind, operation log target IDs, generated runtime/validation artifacts, and editor-state `selection`, `lockedIds`, and `editorHiddenIds` at `apps/editor/e2e/part-texture-layer-persistence-smoke.mjs:410` to `apps/editor/e2e/part-texture-layer-persistence-smoke.mjs:577`.
- Preview evidence is semantic rather than pixel-based: it checks summary text plus `data-*` attributes and the deterministic reference kind at `apps/editor/e2e/part-texture-layer-persistence-smoke.mjs:311` to `apps/editor/e2e/part-texture-layer-persistence-smoke.mjs:367`.
- Test adequacy does not pass overall because Viewer Drawable Layer Evidence is not truthful after reassignment and the full mobile adjacent smoke is blocked by the overflow failure.

## verification run

Passed:

- `node --check apps/editor/e2e/part-texture-layer-persistence-smoke.mjs`
- `node apps/editor/e2e/part-texture-layer-persistence-smoke.mjs`
  - Desktop focused smoke passed.
  - Mobile focused smoke passed.
  - Screenshot evidence was reported as `desktop png base64Length=110704` and `mobile png base64Length=52608`.
- `git diff --check -- apps/editor/e2e discussion/implementation/waves/wave28/domain-g-part-texture-layer-e2e-persistence-smoke-gnome-report.md`
  - Passed with LF-to-CRLF working-copy warnings only.

Failed:

- `pnpm.cmd test:e2e`
  - Desktop full smoke passed.
  - Mobile failed at `mobile post-source-intake` horizontal overflow before later mobile adjacent smokes and the integrated Domain G smoke could run.

Note: initial non-escalated shell invocations failed with `windows sandbox: spawn setup refresh`; verification commands were rerun with escalation and completed as above.

## user-decision points

None for the end user from this review alone.

Orch-Sylph decision points:

- Route a source-owned fix for the mobile layer-tree texture select overflow. This is outside Domain G unless the allowed scope is explicitly changed.
- Route a source-owned fix for Viewer Drawable Layer Evidence so it does not report `part none` after drawable reassignment. Domain G should not pass while its smoke expects that false text.
