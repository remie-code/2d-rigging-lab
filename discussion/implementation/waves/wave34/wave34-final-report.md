# Wave34 Final Report: Byte Intake Preflight Direct-Call Contract Hardening v0

Date: 2026-06-03

Verdict: `pass`

## Scope

Wave34 completed the bounded Byte Intake Preflight Direct-Call Contract Hardening v0 scope from `discussion/implementation/orchestration/wave34-plan.md`.

Implemented capability:

- Package-format now exposes a direct-call byte availability contract that distinguishes current-session bytes, missing current-session bytes, reupload-required state, stale verified summaries, package identity/revision mismatch, binary ref mismatch, digest mismatch, byteLength mismatch, mediaType mismatch, and unsupported verification.
- Validator-core maps the package-format byte availability oracle to deterministic `byteAvailability.*` diagnostics with AI-readable evidence.
- Editor session/workflow byte-intake preflight now preserves truthfulness across current-session validation and browser-local save/load: current in-memory bytes include current-session verification evidence, while reloaded metadata-only bytes require reupload.
- Direct-call fixture regressions and desktop/mobile e2e guard prove stale summaries, missing current-session bytes, and caller-declared reupload state do not silently pass.

## Domain Status

| Domain | Verdict | Evidence |
|---|---|---|
| A. Byte availability direct-call contract foundation | `pass` | [wave34-domain-a-byte-availability-contract-foundation-completion-report.md](wave34-domain-a-byte-availability-contract-foundation-completion-report.md), [../../reviews/wave34/wave34-domain-a-design-development-compliance-review.md](../../reviews/wave34/wave34-domain-a-design-development-compliance-review.md), [../../reviews/wave34/wave34-domain-a-test-adequacy-review.md](../../reviews/wave34/wave34-domain-a-test-adequacy-review.md) |
| B. Validator stale-summary and reupload diagnostics | `pass` | [wave34-domain-b-validator-stale-summary-reupload-diagnostics-completion-report.md](wave34-domain-b-validator-stale-summary-reupload-diagnostics-completion-report.md), [../../reviews/wave34/wave34-domain-b-design-development-compliance-review.md](../../reviews/wave34/wave34-domain-b-design-development-compliance-review.md), [../../reviews/wave34/wave34-domain-b-test-adequacy-review.md](../../reviews/wave34/wave34-domain-b-test-adequacy-review.md) |
| C. Editor session / workflow byte truthfulness bridge | `pass` | [wave34-domain-c-editor-session-byte-truthfulness-bridge-completion-report.md](wave34-domain-c-editor-session-byte-truthfulness-bridge-completion-report.md), [../../reviews/wave34/wave34-domain-c-design-development-compliance-review.md](../../reviews/wave34/wave34-domain-c-design-development-compliance-review.md), [../../reviews/wave34/wave34-domain-c-test-adequacy-review.md](../../reviews/wave34/wave34-domain-c-test-adequacy-review.md) |
| D. Fixtures, direct-call regressions, and e2e guard | `pass` | [wave34-domain-d-direct-call-fixtures-and-e2e-guard-completion-report.md](wave34-domain-d-direct-call-fixtures-and-e2e-guard-completion-report.md), [../../reviews/wave34/wave34-domain-d-design-development-compliance-review.md](../../reviews/wave34/wave34-domain-d-design-development-compliance-review.md), [../../reviews/wave34/wave34-domain-d-test-adequacy-review.md](../../reviews/wave34/wave34-domain-d-test-adequacy-review.md) |
| E. Integration review and final report | `pass` | [../../reviews/wave34/wave34-clean-integration-review.md](../../reviews/wave34/wave34-clean-integration-review.md), this final report |

## Domain E Source/Test Fix

The first clean integration review returned `needs_changes` because editor current-session preflight attached raw bytes and claimed `bytesAvailability=available`, but did not pass `currentSessionVerificationReport` into the Wave34 validator availability path. That could produce `byteAvailability.currentSessionBytes.missing` / `byteAvailability.verifiedSummary.stale` while editor state claimed validator availability.

Orch-Sylph did not edit source. A narrow Gnome fix loop updated:

- `apps/editor/src/editor-session/session-byte-availability-bridge.ts`
- `apps/editor/src/editor-session/binary-byte-registration-command.test.ts`

The fix supplies current-session verification evidence when a current `PackageBinaryFileEntry` exists, preserves reupload truthfulness when bytes are absent, and expands the editor integrated-validation test filter to fail on any `byteAvailability.*` failure. Review-Sylph accepted the fix and updated the clean integration review to `pass`.

## Final Verification

Final parent-side verification after fix loop 1:

- `pnpm.cmd typecheck`: pass.
- `pnpm.cmd test:unit`: pass, 175 files / 887 tests.
- `pnpm.cmd test:e2e`: pass, desktop and mobile smoke.
- `pnpm.cmd run check:source`: pass.
- `pnpm.cmd run check:deps`: pass.
- `git diff --check -- apps/editor packages fixtures/contracts discussion/implementation discussion/design discussion/tests`: pass, LF-to-CRLF warnings only.
- Dependency manifest / lockfile / workspace diff and status checks: empty.
- Forbidden-scope scans over focused Wave34 source/test/fixture/report paths found only negative assertions, unsupported-claim diagnostics, existing localStorage e2e inspection, and non-goal prose; no forbidden implementation or unsupported positive claim was found.

Clean integration review passed at [../../reviews/wave34/wave34-clean-integration-review.md](../../reviews/wave34/wave34-clean-integration-review.md).

## Compliance

- Orch-Sylph / Integrator did not implement source changes directly.
- The only final source/test blocker was delegated to Gnome and re-reviewed by Review-Sylph in a separate clean context.
- Domains A-D have completion reports plus separate design/development and test adequacy review artifacts.
- `packages/package-format/src/index.ts` remains barrel-only.
- `pnpm.cmd run check:source` and `pnpm.cmd run check:deps` passed.
- No dependency manifest, lockfile, or workspace manifest changed.
- Fixture and traceability markdown registration were updated for `wave34-byte-availability-direct-call-fixtures`.

## Non-Goals Kept Out

Wave34 did not implement or claim:

- Persistent binary storage, IndexedDB/base64/localStorage binary persistence policy, or package archive import/export.
- PSD parser, PNG/image decode, media signature sniffing, raster extraction, or texture materialization.
- Drag-drop, File System Access API, directory picker, or a new file input mechanism beyond the existing browser file input path.
- External dependency, package manifest, workspace manifest, or lockfile changes.
- Cubism SDK/Core, Cubism import/export, Cubism compatibility, full renderer, standalone viewer, or pixel oracle.

## Residual Risks / Future Work

- `discussion/design/module-contracts/validator-contract.md` prose does not yet enumerate every new `byteAvailability.*` diagnostic. Source catalog registration, tests, fixtures, and clean review make this non-blocking for Wave34; it remains a small docs-sync follow-up.
- The editor bridge constructs a synchronous current-session report from existing byte entry metadata rather than recomputing SHA-256 there. Integrated validator validation still receives raw bytes and verifies digest/byteLength through the validator path.
- Persistent binary storage, archive import/export, parser/decode, File System Access API, drag-drop, public/demo asset policy, and real image fixture policy remain future decisions.

## User Decision Points

None for completing Wave34.

Future user decisions are required only if a later wave opens persistent binary storage, archive/filesystem import/export, drag-drop/File System Access API, parser/image decode dependencies, real binary/image fixture policy, public demo assets, Cubism compatibility, full renderer, or pixel oracle boundaries.
