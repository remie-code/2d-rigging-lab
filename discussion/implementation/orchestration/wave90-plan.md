# Wave 90 Plan: Workspace Save v0

> Wave90は、Portable JSONとは別軸の「日常作業用 Workspace Save」を導入する。ユーザーは編集前にworkspaceを作成または開き、通常のSaveでは軽量JSONを中心に更新し、PSD由来textureやTexture Atlas artifactのような重いbinaryは未保存またはdigest不一致の場合だけ書く。Runtime Exportは対象外である。

## 1. Status

- Status: Planned / ready for orchestration
- Target wave: Wave90
- Wave name: `workspace-save-v0`
- Primary objective:
  - Workspace-first UXを実装する。
  - Temporary Draft編集を作らない。
  - Headerをworkspace / app-level操作に整理する。
  - Toolboxをworkspace-internal tool / task / viewに整理する。
  - Directory workspace save/openを実装する。
  - Portable JSON Export / Importは残すが、通常Saveとは分離する。
  - Save時にunchanged heavy binary assetsを毎回書き直さない。
  - PSD元bytesは保存せず、抽出済みlayer raw RGBAとcommitted atlas raw RGBAだけをworkspace assetとして扱う。
  - Runtime Export、camera capture、cloud sync、operation log persistence、temporary draft editingは対象外にする。

## 2. Planning Gate Result

Planning Gate result: `Inventory first`, then plan.

Why planning is now safe:

- Workspace Save / Navigation設計は [../../design/screen-design/screens/workspace-save-and-navigation.md](../../design/screen-design/screens/workspace-save-and-navigation.md) に記録済み。
- Authoring Workspace側のWorkspace Gate解釈は [../../design/screen-design/screens/authoring-workspace.md](../../design/screen-design/screens/authoring-workspace.md) に反映済み。
- Read-only Sylph Aがpackage-format / authoring-core / binary file-set事実を棚卸し、既存file-set APIとbinary verification APIを確認済み。
- Read-only Sylph BがEditor UI / AppBar / Toolbox / project-storage / FSA導入点を棚卸し、`activeEntry="import"` 分離とworkspaceStorage stateの必要性を確認済み。
- ユーザーは `operations/log.jsonl` をWave90で書かない方針を採用済み。

Uncertainty:

- factual: low. 実装境界と主要APIは棚卸済み。
- decision: low. UX方針と非ゴールは合意済み。
- cost of wrong plan: high. 保存基盤は後続全機能に影響するため、domain順序とreviewを厳格にする。

## 3. Accepted Decisions / Oracles

### 3.1 Save Concepts

Workspace Save、Portable JSON Export、Runtime Exportを分離する。

Required:

- Workspace Saveは日常作業の継続用であり、directory workspaceを使う。
- Portable JSON Export / Importは共有、バックアップ、持ち運び用として残す。
- Runtime ExportはWave90対象外。
- Portable JSONを通常Saveの別名にしない。

Forbidden:

- Portable JSON機能を削除する。
- Runtime Exportを混ぜる。
- Workspace Saveを単一巨大JSON downloadとして実装する。

### 3.2 Workspace-first UX

編集開始前にworkspaceが確定している必要がある。

Required:

- workspace未open時は既存Authoring Workspace shellのHeader領域を使ってWorkspace Gateを表示する。
- Gateでは `Create Workspace`, `Open Workspace`, `Import Portable JSON` をHeader内に横並びで置く。
- workspace未open時はToolbox、Parts Tree、Canvas、Inspector、Parameter Bar、PSD Import、Mesh/Rig/Dynamics、Texture Atlas、Validate、Viewer、Saveを表示または実行可能にしない。
- `Import Portable JSON` 後もtemporary draft編集へ入らず、workspace化してから編集へ入る。

Forbidden:

- workspaceなしで編集可能なtemporary draftを作る。
- UIを隠すだけでPSD import / commit APIsをguardしない。
- Workspace Gateを別ランディングページとして扱い、Authoring Workspace shellとの関係を曖昧にする。

### 3.3 Header / Toolbox Responsibility

Headerはworkspace / app-level、Toolboxはworkspace-internalである。

Header required:

- workspace name / identity
- save status: `Saved`, `Unsaved changes`, `Saving...`, `Save failed`
- Workspace menu
- Save
- Undo / Redo
- Create/Open Workspace, Save As, Portable JSON Export / Import through Workspace menu

Toolbox required:

- Select
- Mesh
- Rig
- Dynamics
- Import PSD
- Parameters
- Variants
- Texture Atlas
- Validate
- Viewer

Forbidden:

- HeaderにParameters / Variants / Texture Atlas / Validate / Viewer / Import PSD navigationを重複配置する。
- ToolboxにProject Storage / Open Workspace / Create Workspace / Save / Save As / Portable JSON Export / Importを置く。
- `Import PSD` をHeaderのfile open操作として扱う。

### 3.4 Directory Workspace Layout

Workspace v0は既存PackageDocument file-set構造を優先する。

Required:

```text
<project>.ail2d-workspace/
  workspace.json
  manifest.json
  model/
    graph.json
    drawables.json
    meshes.json
    parameters.json
    keyforms.json
    rig-controls.json
    dynamics.json
    masks.json
    draw-order.json
    editor-state.json
  assets/
    sources/
      source-manifest.json
    textures/
      texture-atlas.json
      psd/<token>/<layer>.raw-rgba
      generated_atlas_page_0.raw-rgba
    thumbnails/
    provenance.json
    rights.json
  metadata/
    binary-asset-index.json
    byte-intake-summaries.json
```

Required:

- `workspace.json` はentrypoint metadataに留める。
- `serializePackageDocumentToFileSet()` / `parsePackageDocumentFromFileSet()` を再利用する。
- raw bytesは `BinaryAssetReference.packageRelativePath` と同じpathへ置く。
- `assets/textures/texture-atlas.json` はcommitted atlas artifact metadataとして扱う。

Forbidden:

- `project.json` のような二重authoritative aggregateを作る。
- `assets/atlas/` や `binary/` のような独自rootをv0で追加する。
- `operations/log.jsonl` をWave90で保存対象にする。

### 3.5 Save Plan And Heavy Binary Policy

Saveは毎回全ファイルを書かない。

Required:

- normal Saveはdirty lightweight JSONとsmall metadataを中心に書く。
- heavy binaryはmissing、digest mismatch、length/media mismatchの場合だけ書く。
- binaryを書き込む前に、session内bytesがBinaryAssetReferenceと一致することを検証する。
- verified existing binaryはskipする。
- digest mismatchのworkspace fileは、session bytesが正しければrewriteする。
- session bytes自体がrefと一致しない場合はSave errorにする。

Required binary handling:

- PSD extracted layer raw RGBAは保存する。
- generated atlas raw RGBAはcommitted artifactだけ保存する。
- Texture Atlas `Generate Preview` は保存しない。
- PSD source bytesは保存しない。

Forbidden:

- SaveごとにPSD layer raw RGBAやatlas raw RGBAを無条件で書き直す。
- PSD元bytesをbrowser PSD import由来のworkspaceに保存する。
- missing/corrupt binaryを黙って成功扱いにする。

### 3.6 File System Access API Boundary

Browser File System Access APIはapp層に閉じる。

Required:

- `FileSystemDirectoryHandle` 型やbrowser APIはpackagesへ入れない。
- FSA wrapperは `apps/editor/src/features/workspace-storage/` 付近に置く。
- package-format / authoring-coreはbrowser APIを知らない。
- FSA unsupported時はWorkspace Create/Open/Saveをdisabledまたは明示fallbackにし、Portable JSON Export / Importを別導線として残す。

Forbidden:

- FSA unsupported時にworkspaceなしtemporary draft編集へ自動fallbackする。
- browser-specific型をpackage-format / authoring-core / runtime-coreへ漏らす。

### 3.7 Routing Cleanup

`activeEntry="import"` は通常workspace fallbackとImport PSD actionを兼ねていて危険である。

Required:

- neutral authoring workspace route/stateを導入する。名称は実装側で `workspace`, `authoring`, `home`, or `null activeEntry` から既存storeに自然なものを選んでよい。
- Import PSDはworkspace-internal actionとして扱う。
- existing Back/Close routes from Atlas / Validate / Viewer / Project Storage equivalents must return to neutral authoring workspace, not to Import PSD.

Forbidden:

- `activeEntry="import"` を通常workspaceへ戻るためのsentinelとして残す。
- Import PSD modal open side effectをworkspace home routeへ残す。

## 4. Primary Basis

Design basis:

- [../../design/screen-design/screens/workspace-save-and-navigation.md](../../design/screen-design/screens/workspace-save-and-navigation.md)
- [../../design/screen-design/screens/authoring-workspace.md](../../design/screen-design/screens/authoring-workspace.md)
- [../../design/screen-design/screens/project-storage-task.md](../../design/screen-design/screens/project-storage-task.md)
- [../../design/screen-design/components/toolbox.md](../../design/screen-design/components/toolbox.md)
- [../../design/screen-design/screens/texture-atlas-task.md](../../design/screen-design/screens/texture-atlas-task.md)

Implementation baseline:

- [../waves/wave88/wave88-final-integration-report.md](../waves/wave88/wave88-final-integration-report.md)
- [../reviews/wave88/wave88-final-clean-integration-review.md](../reviews/wave88/wave88-final-clean-integration-review.md)
- [../waves/wave89/wave89-final-integration-report.md](../waves/wave89/wave89-final-integration-report.md)
- [../reviews/wave89/wave89-final-clean-integration-review.md](../reviews/wave89/wave89-final-clean-integration-review.md)

Required conventions:

- [../../development_convention/source-file-organization-policy.md](../../development_convention/source-file-organization-policy.md)
- [../../development_convention/dependency-policy.md](../../development_convention/dependency-policy.md)
- [../../development_convention/operation-policy.md](../../development_convention/operation-policy.md)

Known source facts:

- `packages/package-format/src/package-file-set.ts`: `serializePackageDocumentToFileSet()`, `parsePackageDocumentFromFileSet()`.
- `packages/package-format/src/package-binary-file-set.ts`: binary file entry helpers and verification.
- `packages/package-format/src/package-file-paths.ts`: package-relative path guard.
- `packages/authoring-core/src/portable-project-bundle.ts`: portable hydration helpers, currently partly private.
- `apps/editor/src/features/editor-session/editor-session-context.tsx`: current portable save/open and session dirty handling.
- `apps/editor/src/workspace/app-bar.tsx`: current header duplication.
- `apps/editor/src/workspace/workspace-data.ts`: current Toolbox entries including `Project Storage`.
- `apps/editor/src/state/editor-ui-store.ts`: current `activeEntry="import"` default.

## 5. Wave Strategy

Wave90 should run in ordered batches.

```text
Batch 1:
  Domain A: Workspace Persistence Core

Batch 2:
  Domain B: Editor Workspace Integration

Batch 3:
  Domain C: Final Integration / Clean Review / Map Closeout
```

Dependency rationale:

- Domain A establishes pure package/document/binary save-plan primitives and is the required foundation.
- Domain B depends on Domain A and owns the app-layer Browser File System Access adapter, workspaceStorage state, Header/Gate/Toolbox integration, routing cleanup, and PSD import guards.
- Browser FSA adapter and Editor UX integration are intentionally a single domain in Wave90:
  - both live in `apps/editor`;
  - both need the same `workspaceStorage` state and permission/error UX;
  - splitting them would increase review/orchestration cost without meaningful parallelism.
- Domain C integrates after Domain A+B pass or explicit escalation.

## 5.1 Domain Design

| Batch | Domain | Dependency | Parallelism | Purpose |
|---|---|---|---|---|
| 1 | A. Workspace Persistence Core | Wave89 final pass and Workspace Save design docs | First / blocking | Add browser-independent workspace metadata, save plan, file-set materialization, binary verification, and heavy-binary skip/write/error decisions |
| 2 | B. Editor Workspace Integration | Domain A pass | After A; not parallel with A | Add Browser FSA wrapper, workspaceStorage state, Workspace Gate, Header Workspace menu, Toolbox cleanup, routing cleanup, portable JSON separation, and PSD import guards |
| 3 | C. Final Integration / Clean Review / Map Closeout | Domain A+B pass or explicit escalation | Final only | Validate combined behavior, record reports/reviews/maps, and run final checks |

## 6. Domain A: Workspace Persistence Core

Domain id: `wave90-workspace-persistence-core`

Purpose:

- Add pure, browser-independent workspace save/open primitives.
- Reuse existing PackageDocument file-set APIs and binary verification.
- Extract reusable binary ref collection / hydration helpers from portable-only code where needed.

Allowed write scope:

- `packages/package-format/src/**`
- `packages/package-format/src/**/*.test.ts`
- `packages/authoring-core/src/**`
- `packages/authoring-core/src/**/*.test.ts`
- Domain A report/review files under `discussion/implementation/waves/wave90/` and `discussion/implementation/reviews/wave90/`

Forbidden write scope:

- `apps/editor/src/workspace/**`
- `apps/editor/src/features/editor-session/**`
- `apps/editor/src/features/workspace-storage/**`
- UI components
- runtime-core / validator-core unrelated code
- package dependencies

Required implementation:

- Workspace metadata contract for `workspace.json`.
- Pure `WorkspaceSavePlan` or equivalent.
- Text file-set materialization using existing PackageDocument serializer.
- Binary candidate collection from PackageDocument/session refs.
- Binary decision result: `skip`, `write`, `error`.
- Missing/digest mismatch/media mismatch detection.
- Path traversal / absolute path / backslash / duplicate path guards.
- PSD source byte exclusion guard for browser PSD import workspace save.
- Optional metadata writers for `metadata/binary-asset-index.json` and `metadata/byte-intake-summaries.json` if low-risk; these must remain derived/non-authoritative.

Out of scope:

- Browser FSA handles.
- Header/Toolbox UI.
- Project Storage screen cleanup.
- `operations/log.jsonl` persistence.
- Runtime Export.

Required tests:

- save plan skips verified binary.
- save plan writes missing binary.
- save plan rewrites corrupt/digest mismatch binary when session bytes verify.
- save plan errors when session bytes do not match reference.
- parse/open rejects path traversal, absolute paths, backslashes, duplicate paths.
- stale metadata/binary index is derived warning or ignored, while PackageDocument refs + files are authoritative.
- PSD source bytes are not collected for browser PSD workspace save.
- generated atlas raw RGBA is collected only when committed as texture atlas artifact.

## 7. Domain B: Editor Workspace Integration

Domain id: `wave90-editor-workspace-integration`

Dependencies:

- Domain A `pass`.

Purpose:

- Connect Workspace Save v0 to the actual Editor UX.
- Add app-layer directory workspace I/O using Browser File System Access API.
- Keep browser API out of packages.
- Replace portable JSON-as-save with workspace save as the primary Save.
- Keep Portable JSON as explicit import/export.
- Implement Workspace Gate and Header/Toolbox responsibility split.
- Clean up routing so Import PSD is an action, not the default workspace route.

Allowed write scope:

- `apps/editor/src/features/editor-session/**`
- `apps/editor/src/features/project-storage/**`
- `apps/editor/src/features/psd-import/**`
- `apps/editor/src/features/workspace-storage/**`
- `apps/editor/src/workspace/**`
- `apps/editor/src/state/**`
- focused app tests/e2e updates
- Domain B report/review files under `discussion/implementation/waves/wave90/` and `discussion/implementation/reviews/wave90/`

Forbidden write scope:

- package-format / authoring-core source changes, unless a Domain A contract bug is escalated.
- mesh/deformer/dynamics/atlas algorithm changes.
- runtime export.
- package dependencies.

Required implementation:

- FSA / directory I/O:
  - FSA capability detection.
  - Create workspace directory flow primitives.
  - Open workspace directory flow primitives.
  - Save / Save As primitives.
  - Permission query/request handling.
  - Permission denied / lost error reporting.
  - Safe package-relative path traversal over directory handles.
  - Write text entries.
  - Write binary entries only when save plan says `write`.
  - Read text file-set and binary entries back.
  - fake-handle test surface.
- Workspace storage/session state:
  - no workspace open
  - creating
  - opening
  - saving
  - saved
  - save failed
  - unsupported
  - permission denied/lost
- Workspace Gate:
  - existing Header shell
  - horizontal `Create Workspace`, `Open Workspace`, `Import Portable JSON`
  - no editing surfaces before workspace target exists
- Header Workspace menu:
  - Save
  - Save As
  - Open Workspace
  - Create Workspace
  - Export Portable JSON
  - Import Portable JSON
  - workspace identity and save status
- Portable JSON:
  - explicit import/export labels
  - import must transition into create/open workspace flow before editing
  - Portable JSON fallback remains separate and available when FSA unsupported.
- Save behavior:
  - primary Save writes workspace file-set.
  - Save does not trigger portable JSON download.
  - Export Portable JSON remains available separately.
- Toolbox cleanup:
  - remove Project Storage from Toolbox.
  - remove duplicated Header task navigation.
  - keep Import PSD in Toolbox.
  - keep Parameters / Variants / Texture Atlas / Validate / Viewer in Toolbox.
- Routing cleanup:
  - replace `activeEntry="import"` workspace-home sentinel.
  - Back/Close from dedicated screens returns to neutral authoring workspace.
  - Import PSD opening is an action, not the default route.
- Guards:
  - `openPsdImport`, PSD file selection/commit, and editing actions must reject or no-op with visible reason if workspace is not open.

Out of scope:

- Project Storage full replacement screen design beyond removing Toolbox duplication and preserving portable JSON reachability.
- Runtime Export.
- Cloud / collaboration / file watcher.
- Browser support beyond FSA-capable browsers plus explicit portable fallback.
- Temporary draft fallback.
- E2E browser permission automation unless already practical.

Required tests:

- fake directory handle create/open/save roundtrip.
- unsupported FSA capability state.
- permission denied/lost.
- Save As writes a new workspace file-set.
- safe nested path creation.
- path traversal rejection.
- JSON-only dirty save does not rewrite verified binary.
- missing/digest mismatch binary rewrite.
- App starts in Workspace Gate.
- Gate uses Header area and does not show editing surfaces.
- `Create Workspace` enables Authoring Workspace.
- `Open Workspace` hydrates saved workspace.
- `Import Portable JSON` requires workspace creation before editing.
- Save writes workspace and marks saved.
- PSD import after workspace writes raw RGBA once.
- Apply Atlas after workspace writes generated atlas raw RGBA once.
- Save button does not trigger portable JSON download.
- Export Portable JSON still downloads portable bundle.
- Toolbox does not contain Project Storage.
- Header no longer duplicates Parameters / Texture Atlas / Validate / Viewer nav.
- Import PSD remains reachable from Toolbox after workspace open.
- Back/Close from Atlas / Validate / Viewer returns to neutral authoring workspace.

Escalate if:

- Editor integration requires changes to Domain A packages beyond imports of exposed APIs.
- FSA adapter cannot be tested without broad browser/e2e infrastructure.
- Portable JSON preservation conflicts with Workspace Gate.
- Workspace-first guard cannot be enforced without invasive session-provider redesign.

## 8. Domain C: Final Integration / Clean Review

Domain id: `wave90-final-integration-clean-review`

Dependencies:

- Domain A `pass`
- Domain B `pass`

Purpose:

- Verify combined Workspace Save v0.
- Confirm maps/reports are updated.
- Run broad enough validation for persistence and UI routing.

Allowed write scope:

- `discussion/implementation/waves/wave90/**`
- `discussion/implementation/reviews/wave90/**`
- possibly orchestration/review maps if status updates are required

Required checks:

- Domain reports and all review lanes present.
- Focused unit tests for package-format / authoring-core / workspace-storage.
- Focused app tests for AppBar / Toolbox / Project Storage / PSD Import guard / routing.
- Focused e2e or browser-level test for create/open/save/import if feasible.
- `pnpm typecheck`.
- source organization check.
- dependency check.
- `git diff --check`.

## 9. Review Policy

Each implemented domain requires independent review lanes:

1. Spec Compliance Review
2. Design / Development Compliance Review
3. Test Adequacy Review

Spec Compliance Review must explicitly check:

- No temporary draft editing.
- No portable JSON-as-primary-save regression.
- No unconditional heavy binary rewrite on normal Save.
- No PSD source byte persistence.
- No Runtime Export.
- No `operations/log.jsonl` persistence in Wave90.
- Header/Toolbox responsibility split.
- `activeEntry="import"` sentinel removal or complete neutralization.

Design / Development Review must explicitly check:

- FSA/browser types do not leak into packages.
- package-format / authoring-core / editor responsibilities remain separated.
- binary index metadata is derived/non-authoritative.
- no catch-all source files or dependency policy violations.
- no duplicate authoritative project aggregate.

Test Adequacy Review must explicitly check:

- save plan skip/write/error cases.
- path traversal and bad path cases.
- create/open/save workspace roundtrip.
- PSD raw RGBA write-once behavior.
- atlas raw RGBA write-once behavior.
- Gate before workspace open.
- Portable JSON import/export still available separately.

## 10. Expected Persistent Artifacts

Wave reports:

- `discussion/implementation/waves/wave90/wave90-domain-a-workspace-persistence-core-report.md`
- `discussion/implementation/waves/wave90/wave90-domain-b-editor-workspace-integration-report.md`
- `discussion/implementation/waves/wave90/wave90-final-integration-report.md`
- `discussion/implementation/waves/wave90/_map.md`

Review reports:

- `discussion/implementation/reviews/wave90/wave90-domain-a-spec-compliance-review.md`
- `discussion/implementation/reviews/wave90/wave90-domain-a-design-development-review.md`
- `discussion/implementation/reviews/wave90/wave90-domain-a-test-adequacy-review.md`
- `discussion/implementation/reviews/wave90/wave90-domain-b-spec-compliance-review.md`
- `discussion/implementation/reviews/wave90/wave90-domain-b-design-development-review.md`
- `discussion/implementation/reviews/wave90/wave90-domain-b-test-adequacy-review.md`
- `discussion/implementation/reviews/wave90/wave90-final-clean-integration-review.md`
- `discussion/implementation/reviews/wave90/_map.md`

## 11. Subagent Contract

Orch-Sylph instructions must include:

- Use the active wave plan as source of truth.
- Start with bounded current-state confirmation for assigned domain.
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
- Preserve Portable JSON functionality.
- Preserve Wave88/89 atlas artifact semantics.
- Include Basis Coverage Self-Report and Deferred Basis Items.

Review-Sylph instructions must include:

- Review source and tests, not only Gnome summary.
- Report `pass`, `needs_changes`, or `escalate`.
- Remain read-only unless explicitly delegated a narrow fix.
- Treat forbidden scope as blocking unless explicitly escalated.

## 12. Orchestration Policy

Root / Undine:

- Owns wave plan, user questions, dependency graph, and final report.
- Must not implement Wave90 source changes.
- Must wait for every started subagent.
- Must treat wait timeouts as polling.
- Must not close running children.

Orch-Sylph:

- Owns one domain loop.
- Must start with bounded current-state confirmation.
- Must delegate implementation and review.
- Must wait for Gnome and all Review-Sylphs.
- Must close completed children.
- Must report domain verdict and evidence.

No parent may pass the wave gate while a child is incomplete, running, or unresolved.

## 13. Out of Scope

- Runtime Export.
- Camera capture / tracking input.
- Workspace cloud sync.
- Collaboration / conflict resolution.
- File watcher / external edit merge.
- Temporary draft editing.
- Project archive / ZIP export.
- `operations/log.jsonl` persistence.
- Operation history UI.
- Mesh algorithm changes.
- Deformer / keyform / Dynamics behavior changes.
- Texture Atlas algorithm changes.
- Viewer feature expansion beyond persistence verification.
- New dependencies.
- Cubism SDK / `.moc3` / `.model3.json` / `.physics3.json` compatibility.
