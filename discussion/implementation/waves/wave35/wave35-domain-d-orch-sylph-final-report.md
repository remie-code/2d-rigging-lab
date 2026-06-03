# Wave35 Domain D Orch-Sylph Final Report

Date: 2026-06-03

verdict: `pass`

## Target

Wave35 Domain D:
`wave35-editor-ux-e2e-persistent-byte-smoke`

## Orchestration Summary

Orch-Sylph did not implement source changes directly.

Source implementation was delegated to Gnome in a separate context. Independent
review was delegated to separate clean Review-Sylph contexts:

- Design / Development Compliance Review
- Test Adequacy Review

One Gnome -> Review-Sylph fix loop was required. The initial design/development
review found one UI truthfulness issue where current-session byte availability
wording implied IndexedDB restore verification before a browser-local reload had
occurred. Gnome fixed the wording and assertions, then both review lanes passed
after re-review.

## Files Changed For Domain D

Source and e2e files:

- `apps/editor/e2e/byte-intake-smoke.mjs`
- `apps/editor/src/app/editor-app.ts`
- `apps/editor/src/editor-state/binary-byte-intake-state.ts`
- `apps/editor/src/editor-state/binary-byte-intake-state.test.ts`
- `apps/editor/src/editor-state/source-intake-view-model.ts`
- `apps/editor/src/editor-workflow/workflow-controller.ts`
- `apps/editor/src/editor-workflow/workflow-controller.test.ts`
- `apps/editor/src/ui/project-persistence/project-persistence-panel.ts`
- `apps/editor/src/ui/source-assets/source-intake-form.ts`
- `apps/editor/src/ui/source-assets/source-intake-panel.test.ts`

Domain D artifacts:

- `discussion/implementation/waves/wave35/wave35-domain-d-editor-ux-e2e-persistent-byte-smoke-completion-report.md`
- `discussion/implementation/waves/wave35/wave35-domain-d-orch-sylph-final-report.md`
- `discussion/implementation/reviews/wave35/wave35-domain-d-design-development-compliance-review.md`
- `discussion/implementation/reviews/wave35/wave35-domain-d-test-adequacy-review.md`

Worktree status also contains Wave35 A/B/C dirty and untracked files. Those
were treated as upstream domain work and not attributed to Domain D except where
Domain D depends on their accepted contracts and behavior.

## Implementation Summary

Domain D wires the user-facing `Load saved` path to the async
`loadProjectWithPersistentBytes()` flow so browser-local load can restore
verified bytes from same-origin IndexedDB instead of remaining metadata-only.

The editor UX now reports persistent-byte restore outcomes in the browser-local
project panel, including restored/checked counts, backend states, and
`persistentByteStorage.*` issue codes. Source-intake and byte availability text
now distinguish:

- initial current-session byte availability, where IndexedDB persistence may be
  recorded for best-effort restore after reload
- browser-local restored byte availability, where same-origin IndexedDB bytes
  were re-read and verified during load

The e2e smoke now covers desktop and mobile file intake, IndexedDB byte record
creation, browser-local save/load restore without reupload, validator-visible
availability, saved project raw/base64 byte exclusion, and corrupt/missing/
unavailable IndexedDB fallback.

Domain D did not implement package contracts, broad validator changes, archive
import/export, File System Access API, drag-drop file intake, parser behavior,
image decode behavior, external dependencies, Cubism compatibility, full
renderer behavior, or pixel oracle behavior.

## Reviews Performed

Design / Development Compliance Review:

- artifact:
  `discussion/implementation/reviews/wave35/wave35-domain-d-design-development-compliance-review.md`
- initial verdict: `needs_fix`
- fix loop: 1 Gnome wording/assertion fix loop
- final verdict: `pass`
- result: prior UI truthfulness finding was fixed. No scope, dependency,
  `index.ts`, forbidden implementation, or unsupported positive-claim issue
  remained.

Test Adequacy Review:

- artifact:
  `discussion/implementation/reviews/wave35/wave35-domain-d-test-adequacy-review.md`
- initial verdict: `pass`
- re-review after fix loop: `pass`
- result: final tests/e2e distinguish current-session availability from restored
  IndexedDB availability, prove no-reupload availability on desktop/mobile, and
  keep missing/corrupt/unavailable fallback validator-readable.

## Verification

Final Orch-Sylph verification:

- `pnpm.cmd exec vitest run apps/editor/src/editor-workflow/workflow-controller.test.ts apps/editor/src/editor-workflow/workflow-persistent-byte-restore.test.ts apps/editor/src/ui/source-assets/source-intake-panel.test.ts apps/editor/src/editor-state/binary-byte-intake-state.test.ts`
  - pass, 4 files / 63 tests
- `node apps\editor\e2e\byte-intake-smoke.mjs`
  - pass, desktop and mobile persistent byte smoke
- `pnpm.cmd test:e2e`
  - pass, desktop and mobile editor smoke
- `pnpm.cmd typecheck`
  - pass
- `git diff --check --` scoped to Domain D source/e2e files
  - pass; Git emitted LF-to-CRLF working-copy warnings only
- `git diff --check --` scoped to Domain D completion/review artifacts
  - pass
- dependency manifest / lockfile status check over root, editor,
  package-format, validator-core, contracts manifests and `pnpm-lock.yaml`
  - empty
- forbidden-scope scan over Domain D source/e2e/report/review files
  - hits were limited to negative assertions, truthful non-goal wording,
    same-origin IndexedDB wording, existing canvas `dragMeshCanvasSelection`
    names, and unrelated `compatibilityLabel` data fields
  - no forbidden implementation or unsupported positive claim was found

Environment note: sandboxed PowerShell startup failed with
`windows sandbox: spawn setup refresh`, so inspection and verification commands
were run through the approved escalated command path.

## Remaining Issues

No blocking Domain D issues remain.

Non-blocking residuals:

- IndexedDB persistence remains same-origin browser-local best-effort storage,
  not portable project archive persistence, filesystem persistence, cloud
  persistence, cross-browser-profile persistence, or a quota/private-browsing
  guarantee.
- Domain E still needs final wave integration review and final reporting across
  Domains A-D.

## User Decision Points

None for Domain D.

Escalation is needed only if later work expands beyond same-origin
browser-local IndexedDB evidence into archive import/export, File System Access
API, drag-drop file intake, parser/image decode dependencies,
cross-browser-profile or cloud guarantees, Cubism compatibility, full renderer
behavior, or pixel oracle claims.

## Separation Confirmation

Orch-Sylph did not implement source logic directly. Source implementation and
fix-loop changes were performed by Gnome in separate contexts. Reviews were
performed by separate Review-Sylph contexts using clean, grounded context and
not relying only on Gnome's summary.
