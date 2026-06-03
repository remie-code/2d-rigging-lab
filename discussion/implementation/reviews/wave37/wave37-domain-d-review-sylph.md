# Wave37 Domain D Review-Sylph

Date: 2026-06-03
Target: `wave37-editor-transport-capability-ui-truthfulness`
Verdict: `pass`

Clean-context review for Domain D. I reviewed the Wave37 plan, prior Domain A/B/C pass artifacts as dependency context, the Domain D source diff and untracked files, the package-format capability/boundary APIs consumed by the Editor, and independent verification output. I did not rely on Gnome's implementation report as the sole basis.

## Findings

No blocking, warning, or needs-fix findings.

Confirmed:

- `apps/editor/src/editor-state/transport-capability-view-model.ts:47` projects rows from `PACKAGE_FORMAT_TRANSPORT_CAPABILITY_CATALOG` and `evaluatePackageTransportBoundary`, so the Editor view follows the Domain B capability boundary rather than duplicating package-format state.
- `apps/editor/src/editor-state/transport-capability-view-model.ts:60` marks only supported capabilities as `Available in this editor`; non-supported routes are `Unavailable in this editor`.
- `apps/editor/src/ui/project-persistence/project-transport-capability-section.ts:47` renders visible status and availability text; `:63`-`:79` creates disabled `Unavailable` controls for non-supported routes without a success handler.
- `apps/editor/src/ui/project-persistence/project-persistence-panel.ts:53` and `:107` keep existing portable JSON export/import actions active and explicitly named as portable JSON, not ZIP/archive/filesystem.
- `apps/editor/src/ui/project-persistence/project-persistence-panel.ts:210`-`:231` reports portable export/import status as portable JSON, and `:290`/`:297` describes bundle v0 and same-origin browser-local IndexedDB persistence without native filesystem claims.
- `apps/editor/src/editor-state/index.ts:41` remains barrel-only.

## Review Lanes

### 1. Design / Development Compliance Review

Result: `pass`

- Domain D stays inside the allowed Editor source/test scope plus the Gnome report artifact. I found no Domain D source edits in package-format, validator-core, dependency manifests, or lockfiles.
- The view model consumes Domain B package-format APIs and does not redesign validator-core or package-format contracts.
- `standardArchiveZipV0`, `fileSystemAccessApiV0`, `directoryPickerV0`, `dragDropFileIntakeV0`, and `nativeFilesystemPersistenceV0` are displayed through their gated/unsupported boundary status, not treated as implemented operations.
- No ZIP/archive writer/importer, File System Access API, directory picker, drag/drop handler, parser/decode implementation, full renderer, pixel oracle, external dependency, manifest, or lockfile change was introduced by Domain D.
- Public `apps/editor/src/editor-state/index.ts` remains export-only.

### 2. Test Adequacy Review

Result: `pass`

- `apps/editor/src/editor-state/transport-capability-view-model.test.ts:7` verifies catalog order projection.
- `apps/editor/src/editor-state/transport-capability-view-model.test.ts:17` verifies portable JSON remains supported/available with no unavailable action.
- `apps/editor/src/editor-state/transport-capability-view-model.test.ts:31` verifies archive dependency-gated, future-gated filesystem/directory/drag-drop, and unsupported native filesystem projections.
- `apps/editor/src/ui/app-shell/app-shell.test.ts:627` verifies the rendered shell labels portable JSON actions, keeps portable export/import enabled, marks non-supported rows unavailable/disabled, and guards against parser/decode/support-claim wording.
- `apps/editor/src/editor-workflow/portable-bundle-workflow.test.ts:22`, `:78`, and `:103` continue to cover portable bundle export/import, truthful metadata-only export failure, and invalid import rejection.

### 3. UI / Accessibility Truthfulness Review

Result: `pass`

- The capability section is a named `section` with a heading and list (`project-transport-capability-section.ts:11`-`:27`), so supported and unavailable states are visible in normal DOM text.
- Non-supported transports show both status and availability text, plus gates/issues from the canonical boundary (`project-transport-capability-section.ts:45`-`:59`).
- Disabled `Unavailable` buttons are present only for non-supported routes and have no event handler (`project-transport-capability-section.ts:70`-`:81`), so they cannot trigger a successful ZIP/archive/filesystem/drag-drop operation.
- The portable route remains operable through the existing project persistence actions; Domain D changes wording to portable JSON and does not remove the callbacks (`project-persistence-panel.ts:52`-`:64`).
- I found no UI text in Domain D changed files implying ZIP/archive/filesystem/parser/decode support.

### 4. Orchestration Compliance Review

Result: `pass`

- The assignment separated Gnome implementation and clean Review-Sylph review.
- Gnome's implementation report is present at `discussion/implementation/waves/wave37/wave37-domain-d-gnome-implementation-report.md`.
- This Review-Sylph run stayed read-only for source and wrote only this review artifact under `discussion/implementation/reviews/wave37/`.
- Existing broader worktree changes from Domain A/B/C were observed and not reverted or reviewed as Domain D defects unless Domain D depended on them.

## Verification Performed

- Inspected `git status --short -uall`; observed Domain D changed/untracked files plus broader Domain A/B/C worktree entries.
- Inspected tracked Domain D diff and read untracked Domain D files with line numbers.
- Read Wave37 plan Domain D purpose/pass criteria and prior Domain A/B/C pass artifacts for dependency context.
- Read package-format transport catalog/boundary source used by Domain D.
- Ran `pnpm.cmd exec vitest run apps/editor/src/editor-state/transport-capability-view-model.test.ts apps/editor/src/ui/app-shell/app-shell.test.ts apps/editor/src/editor-workflow/portable-bundle-workflow.test.ts`
  - Result: pass, 3 test files / 29 tests.
- Ran `pnpm.cmd typecheck`
  - Result: pass, root and editor TypeScript projects.
- Ran `git diff --check -- apps/editor/src/editor-state apps/editor/src/ui discussion/implementation/waves/wave37`
  - Result: pass; LF-to-CRLF working-copy warnings only.
- Ran forbidden API/dependency/claim scans over Domain D changed editor files for File System Access APIs, directory picker, drag/drop package transport handlers, `DataTransfer`, `JSZip`, archive writer/importer, parser/decode implementation, image decode, filesystem handles, full renderer, and pixel oracle.
  - Result: no forbidden implementation/API matches. Hits were limited to the drag-drop capability label, an existing/negative test phrase, and negative assertions that parser/decode/support claims are absent.
- Ran manifest/lockfile diff check for `package.json`, `pnpm-lock.yaml`, and package manifests.
  - Result: no output.
- Checked `apps/editor/src/editor-state/index.ts` and related public `index.ts` files remain barrel-only.

Sandbox note: normal sandboxed PowerShell commands failed with `windows sandbox: spawn setup refresh`, so necessary read and verification commands were rerun through the approved escalated path.

## Files Reviewed

- `apps/editor/src/editor-state/transport-capability-view-model.ts`
- `apps/editor/src/editor-state/transport-capability-view-model.test.ts`
- `apps/editor/src/editor-state/editor-test-ids.ts`
- `apps/editor/src/editor-state/index.ts`
- `apps/editor/src/ui/project-persistence/project-transport-capability-section.ts`
- `apps/editor/src/ui/project-persistence/project-persistence-panel.ts`
- `apps/editor/src/ui/app-shell/app-shell.ts`
- `apps/editor/src/ui/app-shell/app-shell.test.ts`
- `apps/editor/src/editor-workflow/portable-bundle-workflow.test.ts`
- `packages/package-format/src/package-transport-capabilities.ts`
- `packages/package-format/src/package-transport-boundary.ts`
- `packages/package-format/src/index.ts`
- `packages/contracts/src/package-transport-capability.ts`
- `discussion/implementation/orchestration/wave37-plan.md`
- `discussion/implementation/waves/wave37/wave37-domain-a-orch-sylph-final-report.md`
- `discussion/implementation/reviews/wave37/wave37-domain-a-review-sylph.md`
- `discussion/implementation/waves/wave37/wave37-domain-b-orch-sylph-final-report.md`
- `discussion/implementation/reviews/wave37/wave37-domain-b-review-sylph.md`
- `discussion/implementation/waves/wave37/wave37-domain-c-orch-sylph-final-report.md`
- `discussion/implementation/reviews/wave37/wave37-domain-c-review-sylph.md`
- `discussion/implementation/waves/wave37/wave37-domain-d-gnome-implementation-report.md`

## Remaining Issues

No Domain D source fix is required.

Future decisions remain outside Domain D: ZIP/archive dependency approval, File System Access API or directory picker adoption, drag-drop UX, native filesystem persistence scope, parser/image decode dependency scope, and any future desktop/mobile e2e expansion assigned to Domain E.

## User-Decision Points

None for Domain D.

## Read-Only Confirmation

Review stayed independent and read-only for source. The only file written by this Review-Sylph run was `discussion/implementation/reviews/wave37/wave37-domain-d-review-sylph.md`.
