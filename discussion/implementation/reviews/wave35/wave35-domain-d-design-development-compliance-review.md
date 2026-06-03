# Wave35 Domain D Design / Development Compliance Re-review

Date: 2026-06-03

verdict: `pass`

## Review Lane

Design / Development Compliance re-review after Fix Loop 1 for
`wave35-editor-ux-e2e-persistent-byte-smoke`.

This was a clean, repository-grounded re-review. I inspected the changed files,
diffs, current source lines, basis documents, and status output directly. The
Domain D completion report was read only as a consistency artifact, not as the
sole basis for this verdict.

## Fix Loop 1 Verdict

The prior medium finding is fixed.

Prior finding:

- `apps/editor/src/editor-state/binary-byte-intake-state.ts:175` used one
  availability label for all `available-current-editor-session-v1` assets. The
  wording implied IndexedDB restore had already been verified immediately after
  initial file intake.

Fix verified:

- `apps/editor/src/editor-state/binary-byte-intake-state.ts:179-181` now splits
  available-byte wording by `reloadSource`.
- Current-session file intake says same-origin browser-local IndexedDB
  persistence may be recorded for best-effort restore after reload; it does not
  claim reload restore verification.
- Browser-local load says restored bytes came from same-origin IndexedDB and
  were verified during browser-local load.
- `apps/editor/src/editor-state/binary-byte-intake-state.test.ts:58-84`
  asserts both wording paths separately.
- `apps/editor/e2e/byte-intake-smoke.mjs:24-26` defines separate current-session
  and restored availability labels, and `apps/editor/e2e/byte-intake-smoke.mjs:347-350`
  fails the smoke if the current-session path claims restored IndexedDB bytes.

No new design/development compliance finding was introduced by this fix.

## Findings

None.

## Scope Attribution

Domain D is allowed to touch editor e2e, narrow editor UI/test-id/wiring, and
Wave35 reports/reviews. It must not broaden into `packages/**` source
implementation, assertion weakening, archive/File System Access API/drag-drop,
parser/image decode/renderer/pixel oracle work, external dependency changes, or
manifest/lockfile edits.

The inspected Domain D target diff stays in editor UX/e2e/wiring/test files and
the Domain D report. Worktree status also shows Wave35 A/B/C dirty/untracked
files outside Domain D. I did not attribute those package-format or
validator-core changes to Domain D.

One additional dirty editor file visible in status,
`apps/editor/src/editor-workflow/workflow-state-projection.ts`, was inspected
because it participates in the async load projection. Its diff only adds a
narrow optional `binaryByteIntake` projection input and uses
`reloadSource: "browserLocalLoad"` for restored load state
(`apps/editor/src/editor-workflow/workflow-state-projection.ts:171-180`). I did
not find a Domain D scope issue there.

## Compliance Evidence

- App load wiring uses the async persistent-byte path:
  `apps/editor/src/app/editor-app.ts:179` awaits
  `workflow.loadProjectWithPersistentBytes()`.
- `apps/editor/src/editor-workflow/workflow-controller.ts:1199-1238` performs a
  normal project load, restores persistent bytes, creates a restored snapshot,
  and projects byte evidence with `reloadSource: "browserLocalLoad"`.
- Restored bytes are registered only after verification:
  `apps/editor/src/editor-session/persistent-byte-restore.ts:175-190` verifies
  stored bytes and requires `persistentVerificationReport.status === "pass"` and
  `report.availability === "available-browser-local-persistent-bytes-v1"`;
  registration happens only inside that `canRestore` branch at
  `apps/editor/src/editor-session/persistent-byte-restore.ts:188-205`.
- Project persistence UI truthfully scopes the result to same-origin
  browser-local IndexedDB and reports restored/checked counts, backend state, and
  issue codes:
  `apps/editor/src/ui/project-persistence/project-persistence-panel.ts:169-195`.
- Current-session source-intake summary remains scoped to best-effort
  same-origin browser-local IndexedDB and says load verifies bytes before
  availability:
  `apps/editor/src/editor-state/source-intake-view-model.ts:189-192` and
  `apps/editor/src/ui/source-assets/source-intake-form.ts:719-722`.
- E2E assertions strengthen the storage smoke rather than weakening it:
  `apps/editor/e2e/byte-intake-smoke.mjs:75-155` clears IndexedDB, checks record
  creation, verifies reload restore without reupload, then checks corrupt,
  missing, and unavailable backend fallbacks.
- Saved project JSON remains metadata-only for raw bytes in the e2e assertion:
  `apps/editor/e2e/byte-intake-smoke.mjs:402-433` scans package text,
  operation log text, and a sample base64 prefix sentinel.
- Changed `index.ts` files remain barrel-only:
  `apps/editor/src/editor-session/index.ts:1-18` and
  `packages/package-format/src/index.ts:1-19`.
- Manifest/lockfile status check for `package.json`, `pnpm-lock.yaml`,
  `pnpm-workspace.yaml`, `apps/editor/package.json`,
  `packages/package-format/package.json`, `packages/validator-core/package.json`,
  and `packages/contracts/package.json` returned empty output.

## Forbidden Scope Check

I scanned the Domain D target files for archive/export/import claims, File
System Access API, drag-drop, parser, image decode, Cubism, compatibility, full
renderer, pixel oracle, external dependency, cloud, cross-origin, and portable
persistence wording.

Hits were limited to:

- negative assertions such as no parser/decode/archive/full renderer/pixel
  oracle claims,
- safe UI text such as no editor file import or image decode,
- existing `dragMeshCanvasSelection` canvas interaction names, not drag-drop file
  intake,
- existing `compatibilityLabel` data fields unrelated to Cubism compatibility
  claims,
- same-origin browser-local IndexedDB wording.

I found no forbidden implementation or unsupported positive claim for archive
import/export, File System Access API, drag-drop file input, parser, image
decode, Cubism compatibility, full renderer, pixel oracle, external dependency,
cloud persistence, cross-origin guarantee, or portable archive persistence.

## Verification Performed

- Read discussion entry documents:
  `discussion/_conventions.md` and `discussion/_map.md`.
- Read basis documents:
  `discussion/implementation/orchestration/wave35-plan.md`,
  `discussion/development_convention/source-file-organization-policy.md`,
  `discussion/development_convention/dependency-policy.md`,
  `discussion/development_convention/schema-and-id-conventions.md`,
  `discussion/design/module-contracts/package-file-format-contract.md`, and
  `discussion/design/module-contracts/validator-contract.md`.
- Inspected `git status --short -uall` and `git diff --name-status`.
- Inspected `git diff --` for all Domain D target files listed in the
  re-review assignment.
- Inspected the additional dirty editor projection diff shown by worktree
  status.
- Inspected `apps/editor/src/editor-session/persistent-byte-restore.ts` to
  confirm reload availability is gated by byte verification before registration.
- Ran line-number scans for fixed availability labels, load wiring,
  persistent-byte summary text, index barrel exports, forbidden-scope terms, and
  manifest/lockfile status.
- Ran `git diff --check --` over the Domain D target files. It exited 0 with
  Git LF-to-CRLF working-copy warnings only.
- Read
  `discussion/implementation/waves/wave35/wave35-domain-d-editor-ux-e2e-persistent-byte-smoke-completion-report.md`
  as a consistency artifact and confirmed it records Fix Loop 1 and the focused
  verification claims.

I did not rerun vitest or the browser e2e suite in this compliance re-review
lane. The completion report records those fix-loop test runs; this verdict is
based on direct source/diff/basis inspection and the successful `git diff
--check` run.

Environment note: initial sandboxed PowerShell startup failed with
`windows sandbox: spawn setup refresh`, so read-only inspection commands were
run through the approved escalated command path.

## Remaining Issues

None for this design/development compliance lane.

Residual product limits remain correctly scoped and do not require a fix here:

- IndexedDB persistence is same-origin/browser-local and best-effort.
- It is not portable archive persistence.
- It is not File System Access API persistence.
- It is not parser, image decode, full renderer, pixel oracle, or Cubism
  compatibility work.

## User-Decision Points

None.

Escalation would be needed only if later work expands into archive import/export,
File System Access API, drag-drop file intake, parser/image decode dependencies,
cross-browser-profile guarantees, cloud persistence, Cubism compatibility, full
renderer behavior, or pixel oracle claims.

## Reviewer Conduct

I did not edit source implementation files, tests, package manifests, lockfiles,
or fixtures. The only file written by this re-review is this artifact:
`discussion/implementation/reviews/wave35/wave35-domain-d-design-development-compliance-review.md`.
