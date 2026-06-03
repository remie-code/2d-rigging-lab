# Wave35 Domain D Test Adequacy Re-review

Date: 2026-06-03

verdict: `pass`

Review lane: Test Adequacy Re-review after fix loop 1

Target: `wave35-editor-ux-e2e-persistent-byte-smoke`

## Scope Reviewed

- `apps/editor/e2e/byte-intake-smoke.mjs`
- `apps/editor/e2e/smoke-checks.mjs`
- `apps/editor/src/app/editor-app.ts`
- `apps/editor/src/editor-state/binary-byte-intake-state.ts`
- `apps/editor/src/editor-state/binary-byte-intake-state.test.ts`
- `apps/editor/src/editor-state/source-intake-view-model.ts`
- `apps/editor/src/editor-session/indexeddb-persistent-byte-store.test.ts`
- `apps/editor/src/editor-workflow/workflow-controller.ts`
- `apps/editor/src/editor-workflow/workflow-controller.test.ts`
- `apps/editor/src/editor-workflow/workflow-persistent-byte-restore.test.ts`
- `apps/editor/src/ui/project-persistence/project-persistence-panel.ts`
- `apps/editor/src/ui/source-assets/source-intake-form.ts`
- `apps/editor/src/ui/source-assets/source-intake-panel.test.ts`
- `discussion/implementation/reviews/wave35/wave35-domain-d-design-development-compliance-review.md`
- `discussion/implementation/waves/wave35/wave35-domain-d-editor-ux-e2e-persistent-byte-smoke-completion-report.md`

Scope attribution note:

- `git status --short -uall` shows Wave35 A/B/C files are also dirty or untracked.
- Per the review assignment, I ignored unrelated A/B/C work except where Domain D assertions depend on accepted persistent-byte storage/restore and validator diagnostics.
- I read the Domain D completion report and Design/Development re-review only after direct source, diff, basis, and test inspection.

## Basis Documents Used

- `discussion/implementation/orchestration/wave35-plan.md`
- `discussion/design/module-contracts/package-file-format-contract.md`
- `discussion/design/module-contracts/validator-contract.md`
- `discussion/tests/fixtures/fixture-manifest.md`
- `discussion/tests/traceability/test-traceability-matrix.md`

Key basis points checked directly:

- Wave35 is scoped to browser-native IndexedDB in the same origin/browser profile, not portable archive or filesystem persistence (`discussion/implementation/orchestration/wave35-plan.md:47-52`).
- Domain D owns editor UX/e2e proof for file intake -> IndexedDB persist -> browser-local save/load -> no-reupload availability -> validator observation (`discussion/implementation/orchestration/wave35-plan.md:98-101`, `:202-205`).
- Reloaded bytes can be treated as available only after IndexedDB re-read plus digest/byteLength verification; unverifiable bytes must fall back to `requiresReupload` or missing/corrupt diagnostics (`discussion/implementation/orchestration/wave35-plan.md:47-51`, `:328-335`).
- Validator persistent-byte diagnostics are deterministic `persistentByteStorage.*` evidence and do not claim archive persistence, File System Access API support, parser support, or image decode support (`discussion/design/module-contracts/validator-contract.md:237-240`).
- The existing fixture/traceability basis still anchors the Wave31 byte sample and Wave34 byte-availability guard (`discussion/tests/fixtures/fixture-manifest.md:91`, `:94`; `discussion/tests/traceability/test-traceability-matrix.md:64`, `:67`).

## Fix Loop 1 Verdict

No blocking or needs-change test adequacy findings.

The stale residual from the first Test Adequacy artifact is resolved and removed. The Design/Development re-review now passes, and the tests/e2e now distinguish current-session byte availability from restored same-origin IndexedDB byte availability directly.

## Coverage Assessment

### Current-session vs Restored Availability

Status: adequate.

The implementation now formats available-byte labels by `reloadSource`: current-session intake says IndexedDB persistence may be recorded for best-effort restore, while browser-local load says restored bytes came from same-origin IndexedDB and were verified during load (`apps/editor/src/editor-state/binary-byte-intake-state.ts:173-181`).

Focused unit tests assert both paths separately:

- current operation commit uses the best-effort current-session label and validator `available` (`apps/editor/src/editor-state/binary-byte-intake-state.test.ts:50-66`);
- browser-local restored bytes use the restored/verified label, validator `available`, and no current selected-file summary metadata (`apps/editor/src/editor-state/binary-byte-intake-state.test.ts:69-86`);
- stale verified summaries after browser-local load still require reupload (`apps/editor/src/editor-state/binary-byte-intake-state.test.ts:29-47`).

The e2e also encodes the distinction. It defines separate current-session and restored labels (`apps/editor/e2e/byte-intake-smoke.mjs:23-26`), uses the current-session label before reload (`apps/editor/e2e/byte-intake-smoke.mjs:99`), uses the restored label only after browser-local load (`apps/editor/e2e/byte-intake-smoke.mjs:120-124`), and throws if the current-session path claims restored IndexedDB bytes (`apps/editor/e2e/byte-intake-smoke.mjs:318-350`).

### Desktop and Mobile Persistent-Byte E2E

Status: adequate.

The focused e2e covers both desktop and mobile viewports (`apps/editor/e2e/byte-intake-smoke.mjs:55-67`) and is included in the full editor smoke suite (`apps/editor/e2e/smoke-checks.mjs:29`, `:151-153`).

The Domain D e2e flow directly covers the requested user path:

- clears persistent IndexedDB before starting the smoke (`apps/editor/e2e/byte-intake-smoke.mjs:75`);
- imports the Wave31 sample through the file input and asserts committed current-session source intake state (`apps/editor/e2e/byte-intake-smoke.mjs:83-102`);
- saves browser-local project data and asserts both metadata persistence and a separate IndexedDB byte record (`apps/editor/e2e/byte-intake-smoke.mjs:104-107`, `:521-550`);
- reloads, clicks `Load saved`, asserts `Persistent bytes: 1 restored / 1 checked` plus `issues none`, then asserts validator-visible availability without reupload (`apps/editor/e2e/byte-intake-smoke.mjs:109-126`, `:505-511`);
- keeps the UI scoped to best-effort same-origin browser-local IndexedDB and avoids parser/decode/archive claims (`apps/editor/e2e/byte-intake-smoke.mjs:95`, `:677-695`).

The app load button awaits `workflow.loadProjectWithPersistentBytes()` before rerendering (`apps/editor/src/app/editor-app.ts:178-181`), and the workflow records `persistentByteRestore` plus a restored snapshot in the loaded result (`apps/editor/src/editor-workflow/workflow-controller.ts:1199-1246`).

### Missing, Corrupt, and Unavailable Fallback

Status: adequate.

The e2e asserts browser-visible fallback outcomes:

- corrupt IndexedDB bytes produce `persistentByteStorage.digest.mismatch` and `requiresReupload` (`apps/editor/e2e/byte-intake-smoke.mjs:130-138`);
- missing IndexedDB records produce `persistentByteStorage.record.missing` and `requiresReupload` (`apps/editor/e2e/byte-intake-smoke.mjs:140-148`);
- unavailable IndexedDB produces `persistentByteStorage.backend.unavailable`, `backend states unsupported-v1`, and `requiresReupload` (`apps/editor/e2e/byte-intake-smoke.mjs:150-160`).

Focused workflow tests cover the same failure modes deterministically: unsupported/unavailable stores (`apps/editor/src/editor-workflow/workflow-persistent-byte-restore.test.ts:161-193`), missing records (`:195-224`), digest and byteLength mismatch (`:226-297`), and stale package/binary reference evidence (`:299-337`).

The project persistence panel exposes restored/checked counts, backend states, and issue codes for validator-readable UI evidence (`apps/editor/src/ui/project-persistence/project-persistence-panel.ts:166-195`).

### Assertions Were Not Weakened

Status: adequate.

Fix loop 1 strengthened the e2e expectations:

- successful restored availability must show `validator bytesAvailability=available` and must not show `validator bytesAvailability=requiresReupload` (`apps/editor/e2e/byte-intake-smoke.mjs:328-344`);
- current-session availability must not include the restored IndexedDB claim (`apps/editor/e2e/byte-intake-smoke.mjs:345-350`);
- fallback rows must show `validator bytesAvailability=requiresReupload` and must not show source filename, `verified-pass`, validator available, or current-session available claims (`apps/editor/e2e/byte-intake-smoke.mjs:353-374`);
- unsupported parser/decode/archive/full-renderer/pixel-oracle wording is still rejected (`apps/editor/e2e/byte-intake-smoke.mjs:677-695`);
- source panel tests still reject file picker, FileReader, parsed bytes, decoded bytes, and raster extraction claims for metadata-only package-local refs (`apps/editor/src/ui/source-assets/source-intake-panel.test.ts:515-567`).

### Saved Project Raw/Base64 Serialization Guards

Status: adequate.

The e2e reads the real Wave31 sample bytes, derives a base64 prefix, and rejects that prefix in serialized project data in addition to rejecting payload-field names in package text and operation log JSONL (`apps/editor/e2e/byte-intake-smoke.mjs:179-191`, `:378-437`).

The workflow test keeps the sentinel guard over saved project JSON, package text entries, operation log JSONL, editor state, workflow state, and all browser project storage values. It rejects literal raw-byte sentinel text, the base64 sentinel, and `"bytes"`, `"bytesBase64"`, `"rawBytes"`, and `"selectedFile"` in saved project JSON (`apps/editor/src/editor-workflow/workflow-persistent-byte-restore.test.ts:26-27`, `:550-576`).

## Verification / Inspection Performed

- `git status --short -uall`
  - Confirmed Domain D files are mixed with broader Wave35 dirty/untracked files.
- `git diff -- apps/editor/e2e/byte-intake-smoke.mjs`
  - Read directly. Confirmed separate labels, IndexedDB record assertion, restored/no-reupload assertion, fallback assertions, and raw/base64 guard additions.
- `git diff -- apps/editor/src/editor-state/binary-byte-intake-state.ts`
  - Read directly. Confirmed `reloadSource`-dependent availability wording.
- `git diff -- apps/editor/src/editor-state/binary-byte-intake-state.test.ts`
  - Read directly. Confirmed current-session and restored browser-local label assertions are separate.
- `rg` direct inspections over the target files and basis docs
  - Confirmed current line assertions cited above, UI summary wording, workflow persistent load wiring, validator-readable fallback summaries, and Wave35 scope constraints.
- `pnpm.cmd exec vitest run apps/editor/src/editor-state/binary-byte-intake-state.test.ts apps/editor/src/editor-workflow/workflow-persistent-byte-restore.test.ts`
  - pass, 2 files / 13 tests.

Completion-report verification cited, after direct assertion inspection:

- Fix loop 1 records `node apps\editor\e2e\byte-intake-smoke.mjs` pass on desktop and mobile persistent byte smoke (`discussion/implementation/waves/wave35/wave35-domain-d-editor-ux-e2e-persistent-byte-smoke-completion-report.md:78-81`).
- Fix loop 1 records `pnpm.cmd typecheck` pass and `git diff --check` pass with LF-to-CRLF warnings only (`discussion/implementation/waves/wave35/wave35-domain-d-editor-ux-e2e-persistent-byte-smoke-completion-report.md:82-85`).
- The original Domain D verification also records full `pnpm.cmd test:e2e` pass with desktop/mobile editor smoke (`discussion/implementation/waves/wave35/wave35-domain-d-editor-ux-e2e-persistent-byte-smoke-completion-report.md:40-47`).

Environment note:

- Initial sandboxed PowerShell startup failed with `windows sandbox: spawn setup refresh`; read-only inspection and the focused vitest command were run through the approved escalated command path.

## Remaining Issues

No blocking Domain D test gap.

Non-blocking residual risk remains limited to Wave35's accepted scope: the focused e2e proves same-origin browser-local IndexedDB behavior in the current local browser environment. It does not attempt quota/private-browsing/cross-profile guarantees, archive persistence, File System Access API persistence, parser/image decode, renderer behavior, or pixel oracles, matching the Wave35 non-goals.

## User-Decision Points

None for this test adequacy lane.

Escalation would be needed only if later work expands beyond same-origin browser-local IndexedDB evidence into archive import/export, File System Access API, drag-drop, parser/image decode dependencies, cross-browser-profile or cloud guarantees, Cubism compatibility, full renderer behavior, or pixel oracle claims.

## Clean Review Confirmation

This was a clean, grounded test adequacy re-review. I inspected the basis docs, changed files, diffs, e2e assertions, unit/component tests, related persistent-byte dependency tests, final Design/Development re-review, and verification records directly. I did not rely on the Gnome completion report as my source of truth. I did not edit source implementation files. The only file written by this re-review is `discussion/implementation/reviews/wave35/wave35-domain-d-test-adequacy-review.md`.
