# Wave 101 Plan: Texture Atlas Skyline Packing + Blocking Issues UX

> Wave101は、Texture Atlasの自動配置を現行の単純shelf配置から `single-page-skyline-v1` へ差し替え、隙間の多いatlas previewを改善する。同時に、Generate Preview失敗時の原因が右ペイン下部のWarningsに埋もれるUXを修正し、Blocking Issuesとしてユーザーがすぐ見つけられる表示へ整える。

## 1. Status

- Status: Planned / ready for orchestration
- Target wave: Wave101
- Wave name: `texture-atlas-skyline-packing-blocking-issues-ux`
- Primary objective:
  - Texture Atlasのpacking algorithmとして `single-page-skyline-v1` を実装し、Generate Preview / Apply Atlasのdefault algorithmにする。
  - 現行 `single-page-shelf-v1` artifactの読み取り互換を壊さない。
  - target extraction、padding、edge extrusion、artifact-only Apply semantics、Viewer `Original` / `Atlas Runtime` の責務を維持する。
  - Generate Preview失敗やApply不可の直接原因を、右ペイン上部のBlocking IssuesとPreview中央failure cardに表示する。
  - Header / title rowの高さは変えず、失敗時に画面全体の縦位置がずれないようにする。
  - alpha trim、rotation、multi-page、manual placement、packing algorithm selectorは対象外にする。

## 2. Planning Gate Result

Planning Gate result: `Plan directly`.

Why planning is now safe:

- Read-only Sylphにより、現行Texture Atlas packingが `single-page-shelf-v1` のsingle-page row/shelf next-fit方式であること、draw order順・row height固定・穴再利用なしが隙間の主因であることを確認済み。
- Texture Atlas対象抽出は `selectTextureAtlasTargets()` が共通オラクルであり、rig graph所属Drawableを対象、Drawable Pool/unbound Drawableを除外する仕様が確認済み。
- `single-page-skyline-v1` の設計は [../../design/texture-atlas/skyline-packing-v1.md](../../design/texture-atlas/skyline-packing-v1.md) にAccepted implementation targetとして記録済み。
- Texture Atlas Taskの失敗表示UXは [../../design/screen-design/screens/texture-atlas-task.md](../../design/screen-design/screens/texture-atlas-task.md) に反映済み。
- ユーザーは以下を採用済み:
  - Skyline方式を新algorithmにする。
  - alpha trim、rotation、multi-page、manual placement、algorithm selectorは今回扱わない。
  - Header付近に状態を出してよいが、失敗時に画面が縦にずれる体験は避ける。
  - Blocking Issuesは右ペイン上部に置き、Warnings下部に埋もれさせない。

Uncertainty:

- factual: low. 現行algorithmと対象抽出の事実は調査済み。
- decision: low. Skyline採用とBlocking Issues表示位置は合意済み。
- cost of wrong plan: medium. Atlas artifact / Viewer Atlas Runtime / Runtime Exportへ接続する機能だが、sourceRectPixelsやUV semanticsを変えないことでblast radiusを抑えられる。

## 3. Accepted Decisions / Oracles

### 3.1 Skyline Packing Semantics

Required:

- 新規Texture Atlas preview / applyのdefault packing algorithmは `single-page-skyline-v1` とする。
- `single-page-skyline-v1` はsingle-pageのみを扱う。
- 配置対象は既存 `selectTextureAtlasTargets()` の結果を使い、target extraction semanticsを変更しない。
- content sizeは現行どおり `round(mesh.bounds.width)` / `round(mesh.bounds.height)` を使う。
- packed rectはcontent sizeに `paddingPixels * 2` を足した矩形として扱う。
- edge extrusionは既存どおりpadding領域内へコピーし、packing sizeを増やさない。
- 配置順はsize-aware deterministic orderにする。
- 同じ入力から常に同じlayoutを生成する。
- 置けないtargetはdeterministicに `atlas.pack.cannotFit` 相当のpreview failureにする。
- 新規layout summary / source signature / stale判定はalgorithm identityを区別できるようにする。
- 旧 `single-page-shelf-v1` artifactは読み取り不能にしない。

Forbidden:

- alpha / transparent trim。
- `sourceRectPixels` semanticsの変更。
- Mesh UVやauthoring textureの破壊的差し替え。
- rotation packing。
- multi-page atlas。
- manual rect placement。
- user-facing algorithm selector。
- Texture Atlas target extraction policy変更。
- Variant / visibility policy変更。

### 3.2 Skyline Candidate Selection

Recommended implementation oracle:

```text
sort targets by:
  1. packedArea desc
  2. max(packedWidth, packedHeight) desc
  3. packedHeight desc
  4. packedWidth desc
  5. existing stable target order
  6. drawableId asc

for each target:
  evaluate every skyline node as candidate x
  candidateY = max skyline y over covered x span
  reject if candidate exceeds page bounds
  choose by:
    1. candidateY + packedHeight asc
    2. candidateY asc
    3. horizontal waste asc
    4. candidateX asc
    5. stable target order asc
```

Skyline update requirements:

- Insert placed rect top edge as a skyline node.
- Trim or remove existing nodes covered by placed rect.
- Merge adjacent nodes with identical `y`.
- Keep nodes sorted by `x`.
- Never emit overlapping padded rects.

### 3.3 Preview / Apply / Viewer / Runtime Export

Required:

- Generate Preview uses `single-page-skyline-v1` layout.
- Apply Atlas commits the same algorithm identity and a layout compatible with preview.
- Apply remains Operation Core-backed and artifact-only.
- Authoring Workspace Canvas remains original texture / original UV based.
- Viewer `Original` remains original texture / original UV based.
- Viewer `Atlas Runtime` uses committed atlas artifact and existing remap path.
- Runtime Export materializes committed atlas artifact using existing atlas placement semantics.

Must not:

- Reintroduce destructive atlas apply.
- Require Viewer or Runtime Export to understand alpha-trimmed source rects.
- Require a Runtime Player change.

### 3.4 Texture Atlas Blocking Issues UX

Required:

- Generate Preview failure or Apply blocker must be visible near the top of the right panel.
- Add or wire a `Blocking Issues` section directly under `Target Summary`, above Settings / Included / Excluded / Warnings.
- Preview center area must show a compact failure card when preview generation fails.
- Title row may show a short failure summary, but must not add a new row or increase row height.
- Warnings remain supplemental; direct blockers must not live only at the bottom of the right panel.
- Apply stays disabled when preview is failed or stale.
- Failure display should include:
  - short reason title;
  - target Drawable name or count when available;
  - page size/settings context when useful;
  - minimal source ref for copying/debugging if already available.

Forbidden:

- Modal interruption for ordinary preview failure.
- Full stack trace or raw diagnostic payload in primary UI.
- Layout shift that changes vertical position of preview/settings when failure appears.
- Moving atlas-specific failure into global Diagnostics as the only visibility path.

## 4. Primary Basis

Common:

- [Implementation Orchestration Skill](../../../.agents/skills/implementation-orchestration/SKILL.md)
- [UX-Backed Package Logic Authority](../../development_convention/ux-backed-package-logic-authority.md)
- [Source File Organization Policy](../../development_convention/source-file-organization-policy.md)
- [Dependency Policy](../../development_convention/dependency-policy.md)
- [Operation Policy](../../development_convention/operation-policy.md)
- [Schema and ID Conventions](../../development_convention/schema-and-id-conventions.md)

Design basis:

- [Texture Atlas Skyline Packing v1](../../design/texture-atlas/skyline-packing-v1.md)
- [Texture Atlas Task v0 screen spec](../../design/screen-design/screens/texture-atlas-task.md)
- [Texture Atlas design map](../../design/texture-atlas/_map.md)
- [Screen Design Map](../../design/screen-design/_map.md)

Wave baseline:

- [Wave87 Plan](wave87-plan.md)
- [Wave88 Plan](wave88-plan.md)
- [Wave89 Plan](wave89-plan.md)
- [Wave89 Final Integration Report](../waves/wave89/wave89-final-integration-report.md)
- [Wave89 Final Clean Integration Review](../reviews/wave89/wave89-final-clean-integration-review.md)
- [Wave100 Plan](wave100-plan.md)
- [Wave100 Final Integration Report](../waves/wave100/wave100-final-integration-report.md)
- [Wave100 Final Clean Integration Review](../reviews/wave100/wave100-final-clean-integration-review.md)

Known source facts from planning inventory:

- `packages/authoring-core/src/texture-atlas-packing.ts` owns current `single-page-shelf-v1` layout generation.
- Current algorithm places targets left-to-right in row order and opens a new row when horizontal space is exhausted.
- Current placement order follows target/draw stable order, not size-aware sorting.
- Current content size uses rounded `mesh.bounds.width/height`.
- `packages/authoring-core/src/texture-atlas-targets.ts` owns target extraction and should remain the target oracle.
- `packages/authoring-core/src/texture-atlas-binary.ts` creates raw RGBA atlas bytes and edge extrusion.
- `packages/authoring-core/src/texture-atlas-mutations.ts` / operation paths validate and commit atlas preview artifacts.
- `apps/editor/src/workspace/atlas/**` owns Texture Atlas Task projection/screen state and preview failure display.
- Viewer Atlas Runtime and Runtime Export already consume committed atlas artifacts and should not need sourceRectPixels changes for Skyline v1.

Likely implementation areas:

- `packages/authoring-core/src/texture-atlas-packing.ts`
- `packages/authoring-core/src/texture-atlas-*.ts`
- `packages/package-format/src/texture-atlas.ts` only if the algorithm id type/schema must be extended.
- `packages/operation-core/src/operations/*texture-atlas*` only if Apply stale/source-signature validation needs the algorithm id.
- `apps/editor/src/workspace/atlas/atlas-task-projection.ts`
- `apps/editor/src/workspace/atlas/texture-atlas-task-screen.tsx`
- `apps/editor/src/workspace/atlas/texture-atlas-task-screen.test.ts`
- focused tests for touched modules.

## 5. Wave Strategy

Wave101 should run as a narrow single implementation domain plus final integration.

```text
Batch 1:
  Domain A: Texture Atlas Skyline Packing + Blocking Issues Integration

Batch 2:
  Domain B: Final Integration / Clean Review / Map Closeout
```

Dependency rationale:

- Skyline packing and Texture Atlas failure display are both within the Texture Atlas Task flow.
- Splitting core packing and UI failure display would increase review overhead and create coordination cost around preview failure shape.
- The scope is still bounded because target extraction, Viewer Runtime, Runtime Export semantics, alpha trim, rotation, and multi-page are explicitly out of scope.

## 5.1 Domain Design

| Batch | Domain | Dependency | Parallelism | Purpose |
|---|---|---|---|---|
| 1 | A. Texture Atlas Skyline Packing + Blocking Issues Integration | Wave89 Atlas performance/runtime scope pass and accepted Skyline/UX docs | Single implementation domain | Add `single-page-skyline-v1`, make it default for preview/apply, preserve shelf read compatibility, surface blockers near top of Texture Atlas Task |
| 2 | B. Final Integration / Clean Review / Map Closeout | Domain A pass or explicit escalation | Final only | Validate atlas algorithm, UI failure visibility, source organization, forbidden scope, reports/reviews/maps |

## 6. Domain A: Texture Atlas Skyline Packing + Blocking Issues Integration

Domain id: `wave101-texture-atlas-skyline-packing-blocking-issues-integration`

Purpose:

- Improve Texture Atlas packing quality with `single-page-skyline-v1` while keeping existing atlas artifact semantics stable.
- Make preview/apply blockers visible immediately in Texture Atlas Task.

Allowed write scope:

- `packages/authoring-core/src/texture-atlas-*.ts`
- `packages/operation-core/src/**texture-atlas**`
- `packages/package-format/src/texture-atlas.ts` only for narrow algorithm id/type compatibility if needed.
- `apps/editor/src/workspace/atlas/**`
- focused tests for touched modules.
- Domain A report/review files under `discussion/implementation/waves/wave101/` and `discussion/implementation/reviews/wave101/`.

Conditional write scope requiring explicit report justification:

- `apps/editor/src/workspace/viewer/**` only if a focused test or type adjustment is required to prove Skyline layout remains consumable by Viewer `Atlas Runtime`.
- `packages/runtime-core/src/**` or `packages/render-core/src/**` only if existing type exports require narrow compile compatibility. Any behavioral change here must escalate.

Forbidden write scope:

- Runtime Player.
- Workspace Save / Workspace Directory Export.
- Runtime Export product behavior beyond consuming existing atlas artifact semantics.
- Mesh generation.
- Deformer / keyform / dynamics.
- Variant Manager / Viewer Variant switching.
- Atlas target extraction policy changes.
- alpha trim / sourceRectPixels remap.
- rotation / multi-page / manual placement / algorithm selector.
- new dependencies / lockfile.

Required implementation:

- Add `single-page-skyline-v1` algorithm identity.
- Use `single-page-skyline-v1` as the default for new Texture Atlas preview/apply.
- Preserve ability to read or inspect old `single-page-shelf-v1` committed artifacts.
- Keep `selectTextureAtlasTargets()` behavior unchanged.
- Keep content/source rect semantics unchanged.
- Implement deterministic size-aware target sorting.
- Implement skyline placement with non-overlap and within-page guarantees.
- Return deterministic cannot-fit diagnostics for oversized or unplaceable targets.
- Ensure source signature / stale logic distinguishes algorithm identity where appropriate.
- Ensure Generate Preview and Apply agree on algorithm/settings/source signature.
- Add Blocking Issues projection data or UI mapping as needed.
- Place Blocking Issues under Target Summary and above Settings / Included / Excluded / Warnings.
- Add Preview center failure card for failed preview.
- Keep title/header row height stable.
- Keep Warnings section as supplemental information.

Out of scope:

- Proving mathematically optimal packing.
- Page size auto-shrink.
- Multi-page fallback.
- Atlas rect editing.
- Runtime Player support for atlas debugging.
- Browser pixel proof unless an existing cheap test path is already available.

Required tests:

- Mixed-size rectangles produce non-overlapping placed rects.
- All placed padded rects stay within page bounds.
- Same input produces same layout.
- Padding/content rects are calculated correctly.
- Edge extrusion existing tests still pass.
- Oversized or unplaceable target produces deterministic cannot-fit result.
- Shelf artifact/type compatibility remains intact.
- Algorithm id is recorded for new Skyline layouts.
- Algorithm id participates in source signature/stale behavior or equivalent Apply guard.
- Generate Preview uses Skyline layout.
- Apply Atlas uses/validates Skyline layout and remains artifact-only.
- Viewer `Atlas Runtime` can consume a committed Skyline atlas artifact, if existing tests make this cheap to assert.
- Runtime Export can materialize a Skyline atlas artifact, if existing tests make this cheap to assert.
- Texture Atlas Task shows Blocking Issues near the top when preview generation fails.
- Preview center failure card appears for failed preview.
- Apply remains disabled for failed/stale preview.
- Header/title row failure summary does not add a new row or change the expected layout structure.

Recommended focused commands:

- `pnpm.cmd exec vitest run packages/authoring-core/src/texture-atlas-packing.test.ts`
- `pnpm.cmd exec vitest run packages/authoring-core/src/texture-atlas-binary.test.ts`
- `pnpm.cmd exec vitest run packages/authoring-core/src/texture-atlas-mutations.test.ts`
- `pnpm.cmd exec vitest run packages/operation-core/src`
- `pnpm.cmd exec vitest run apps/editor/src/workspace/atlas`
- `pnpm.cmd exec vitest run apps/editor/src/workspace/viewer/viewer-render-source.test.ts`
- `pnpm.cmd typecheck`

Escalate if:

- Skyline implementation requires changing `sourceRectPixels` semantics.
- Existing artifact/schema cannot represent algorithm identity without broad package migration.
- Apply validation cannot distinguish preview algorithm from committed algorithm without changing Operation Core broadly.
- Texture Atlas Task failure projection is too entangled to add Blocking Issues without broad screen redesign.
- Viewer or Runtime Export cannot consume Skyline placement without remap semantics changes.

## 7. Domain B: Final Integration / Clean Review

Domain id: `wave101-final-integration-clean-review-map-closeout`

Dependencies:

- Domain A `pass`, or explicit `needs_fix` loop resolution.

Purpose:

- Verify that Skyline packing and Blocking Issues UX are complete, bounded, and compatible with existing Atlas Runtime behavior.
- Record reports, reviews, and closeout artifacts.

Allowed write scope:

- `discussion/implementation/waves/wave101/**`
- `discussion/implementation/reviews/wave101/**`
- implementation maps if status updates are required.
- narrow source/test fixes only if final clean review requires them.

Forbidden write scope:

- New product features.
- alpha trim / rotation / multi-page / manual placement.
- Runtime Player.
- Workspace Save / Runtime Export workflow changes.
- Mesh / Deformer / Keyform / Dynamics / Variant feature changes.
- new dependencies / lockfile.

Required checks:

- Domain A report and review lanes exist.
- Focused authoring-core atlas packing tests pass.
- Focused atlas binary/mutation/operation tests pass where touched.
- Focused Texture Atlas Task UI tests pass.
- Focused Viewer Atlas Runtime / Runtime Export tests pass where touched or explicitly classified as not needed.
- `pnpm typecheck`, or explicit known unrelated failure classification.
- `node scripts/check-source-organization.mjs`.
- `node scripts/check-dependencies.mjs`.
- `git diff --check`.
- Forbidden-scope diff check:
  - no Runtime Player changes.
  - no alpha trim/sourceRectPixels remap.
  - no rotation/multi-page/manual placement/algorithm selector.
  - no dependency/lockfile changes.

## 8. Review Policy

Domain A requires independent review lanes:

1. Spec Compliance Review
2. Design / Development Compliance Review
3. Test Adequacy Review

Spec Compliance Review must explicitly check:

- `single-page-skyline-v1` is the default for new preview/apply.
- Old `single-page-shelf-v1` artifacts remain readable or non-breaking.
- Target extraction semantics are unchanged.
- content/source rect semantics are unchanged.
- Padding and edge extrusion semantics are unchanged.
- Skyline placement is deterministic, non-overlapping, and within page bounds.
- cannot-fit behavior is deterministic.
- Preview and Apply agree on algorithm/settings/source signature.
- Blocking Issues are visible above Settings/Lists.
- Preview failure card appears in the central preview area.
- Header/title row does not gain height or a new row for failures.
- alpha trim, rotation, multi-page, manual placement, and algorithm selector are not implemented.

Design / Development Review must explicitly check:

- Packing logic stays in authoring-core and is not duplicated in the UI.
- Texture Atlas Task UI consumes projection/domain data rather than reimplementing packer logic.
- Source file organization policy is respected.
- No broad renderer/runtime/export rewrite.
- No new dependencies.
- No destructive Apply regression.
- No package-format broad migration unless explicitly justified and reviewed.

Test Adequacy Review must explicitly check:

- Mixed-size packing coverage.
- Determinism coverage.
- Non-overlap / within-page coverage.
- Padding/content rect coverage.
- cannot-fit negative coverage.
- old shelf compatibility coverage.
- preview/apply algorithm identity or stale/signature coverage.
- UI Blocking Issues and preview failure card coverage.
- Apply disabled failed/stale coverage.

## 9. Verification Matrix

| Requirement | Minimum evidence |
|---|---|
| Skyline is default for new preview/apply | authoring-core / operation focused test |
| Old shelf artifacts do not break | package/authoring compatibility test or explicit source review evidence |
| Non-overlap and page bounds | packing unit test |
| Deterministic layout | packing unit test |
| Padding/content rect correctness | packing unit test |
| cannotFit deterministic | packing negative test |
| Source signature/stale includes algorithm distinction | mutation/operation test or explicit source evidence |
| Generate Preview failure visible | Atlas Task UI test |
| Blocking Issues above Settings/Lists | Atlas Task UI test |
| Preview center failure card | Atlas Task UI test |
| Header/title row stable | UI structure test or explicit source/review evidence |
| Viewer Atlas Runtime still works | focused viewer test or explicit unchanged-consumer evidence |
| Runtime Export still works | focused runtime export test or explicit unchanged-consumer evidence |

## 10. Expected Persistent Artifacts

Wave reports:

- `discussion/implementation/waves/wave101/wave101-domain-a-texture-atlas-skyline-packing-blocking-issues-integration-report.md`
- `discussion/implementation/waves/wave101/wave101-final-integration-report.md`
- `discussion/implementation/waves/wave101/_map.md`

Review reports:

- `discussion/implementation/reviews/wave101/wave101-domain-a-spec-compliance-review.md`
- `discussion/implementation/reviews/wave101/wave101-domain-a-design-development-review.md`
- `discussion/implementation/reviews/wave101/wave101-domain-a-test-adequacy-review.md`
- `discussion/implementation/reviews/wave101/wave101-final-clean-integration-review.md`
- `discussion/implementation/reviews/wave101/_map.md`

## 11. Subagent Contract

Orch-Sylph instructions must include:

- Use this active wave plan as source of truth.
- Start with bounded current-state confirmation for assigned domain.
- Orch-Sylph自身は実装担当ではない。source implementation は必ず別コンテキストの Gnome に委譲し、レビューは必ず別コンテキストの Review-Sylph に委譲すること。これを分離できない場合は実装せず escalate / blocked として報告すること。
- Delegate implementation to Gnome.
- Delegate independent reviews to Review-Sylphs.
- Wait for all started children.
- Treat `wait_agent` timeout as polling timeout.
- Do not close or interrupt running children.
- Close completed child sessions before final domain report.
- Report `pass`, `needs_fix`, `blocked`, or `escalate`.

Gnome instructions must include:

- You are not alone in the codebase.
- Do not revert unrelated changes.
- Work only in allowed scope.
- Do not run `pnpm install`.
- Do not add dependencies.
- Keep Texture Atlas target extraction unchanged.
- Keep authoring texture / Mesh UV / topology semantics unchanged.
- Do not implement alpha trim, rotation, multi-page, manual placement, or algorithm selector.
- Keep Viewer / Runtime Export changes out of scope unless a narrow compatibility fix is explicitly required and reported.
- Include Basis Coverage Self-Report and Deferred Basis Items.

Review-Sylph instructions must include:

- Review source and tests, not only Gnome summary.
- Report `pass`, `needs_changes`, or `escalate`.
- Remain read-only unless explicitly delegated a narrow fix.
- Treat target extraction changes as blocking unless explicitly justified.
- Treat alpha trim/sourceRectPixels remap, rotation, multi-page, manual placement, algorithm selector, dependency changes, or Runtime Player changes as blocking unless explicitly escalated.
- Treat missing determinism/non-overlap/cannotFit tests as blocking unless explicit evidence explains why another oracle covers them.

## 12. Orchestration Policy

This wave must follow `.agents/skills/implementation-orchestration/SKILL.md`.

Root / Undine:

- Owns wave plan, dependency graph, user questions, and final decision.
- Must not implement the wave.
- Must preserve root context.
- Must wait for every started subagent.
- Must treat `wait_agent` timeout as polling timeout, not failure.
- Must not close, kill, interrupt, or summarize running children as complete.

Orch-Sylph:

- Owns exactly one domain loop.
- Must start with bounded current-state confirmation for its domain.
- Must delegate implementation to Gnome unless the domain is review-only.
- Must delegate review to independent Review-Sylphs.
- Must include separate Spec Compliance Review lane.
- Must wait for Gnome and Review-Sylph completion.
- Must not cancel, close, or interrupt child agents because they are slow or waiting.
- Must close completed child agent sessions at the end of the domain.
- Must not close running child sessions.
- Must report `pass`, `needs_fix`, `blocked`, or `escalate` with file paths, validation, and residual risks.

Gnome:

- Receives domain-specific basis sections only.
- Implements within allowed scope.
- May add dependencies only through dependency policy compliance and escalation.
- Must include Basis Coverage Self-Report and Deferred Basis Items.
- Must not implement unrelated Runtime Player, Workspace Save, Runtime Export workflow, Mesh generation, Deformer, keyform, Dynamics, Variant, camera, or transport features.

Review-Sylph:

- Reviews from artifacts and source, not only from Gnome summary.
- Must produce assigned lane report.
- Spec Compliance Review must not silently treat basis omissions as future scope.
- Must check algorithm semantics, UI failure visibility, tests, and forbidden scope explicitly.

Waiting rule:

- `wait_agent` timeout is polling timeout, not failure.
- No parent agent may terminate a child agent's work merely because it has not responded yet.
- If interruption is unavoidable, record incomplete / blocked / escalated. Do not pass the wave gate.

## 13. Out of Scope

- Alpha / transparent trim.
- `sourceRectPixels` remap.
- Rotation packing.
- Multi-page atlas.
- Manual atlas rect editing.
- Packing algorithm selector/comparison UI.
- Page size auto-shrink.
- Texture compression / mipmap optimization.
- Workspace Save / Workspace Directory Export.
- Runtime Export workflow changes.
- Runtime Player.
- Browser Source / OBS / Spout.
- Mesh generation changes.
- Deformer/keyform/dynamics changes.
- Variant Manager / Viewer Variant changes.
- Camera capture / face tracking input.
- New dependencies.
- Base64 image embedding changes.
- Cubism SDK / `.moc3` / `.model3.json` / `.physics3.json` compatibility.
