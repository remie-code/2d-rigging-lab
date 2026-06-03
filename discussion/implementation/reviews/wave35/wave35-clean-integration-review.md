# Wave35 Clean Integration Review

verdict: pass

Reviewer: Review-Sylph
Date: 2026-06-03

## Scope

This review covers the Wave35 Domain E clean integration gate for same-origin browser-local IndexedDB persistent source bytes. I inspected the orchestration basis documents, Wave35 domain reports/reviews, the changed source/test/doc paths, and refreshed local verification. I did not rely on implementer summaries as the only source.

## Basis Inspected

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave35-plan.md`
- Development conventions for source organization, dependency policy, and schema/id conventions
- Module contracts for package file format and validator behavior
- Current capability map, remaining backlog, fixture manifest, and test traceability matrix
- Wave35 Domain A-D completion reports, final reports, design/development reviews, and test adequacy reviews
- Changed Wave35 source/test/doc paths listed by Orch-Sylph

## Findings

No source or test blockers were found.

Persistent binary storage contract correctness: pass. `packages/package-format/src/persistent-binary-storage-contract.ts` and `persistent-binary-storage.ts` define a narrow browser-local same-origin IndexedDB evidence contract. Availability is granted only when backend, stored record, record identity, and digest/byteLength verification are current and passing. Tests cover missing, stale, corrupt, backend-unavailable, and no-raw-payload cases.

No portable archive claim: pass. The contract stores metadata/evidence and deliberately excludes raw payload, archive, File System Access, parser, image decode, renderer, pixel oracle, and Cubism claims. The changed UI text and validator messages use same-origin browser-local wording.

Editor IndexedDB storage/session restore correctness: pass. The editor stores selected source bytes separately from localStorage project metadata, reloads project metadata synchronously without claiming byte availability, then `loadProjectWithPersistentBytes()` restores only verified bytes through the persistent store path. Digest/byteLength mismatch, missing records, stale identity, and unavailable backend fall back to reupload-required state.

Validator persistent storage diagnostics correctness: pass. `packages/validator-core/src/validators/persistent-byte-availability-diagnostics.ts` and the byte-intake preflight integration emit deterministic `persistentByteStorage.*` diagnostics only when persistent evidence or expectation exists. The check IDs follow dot lower camelCase style and do not claim parser/archive/decode behavior.

E2E persistent-byte smoke adequacy: pass. `apps/editor/e2e/byte-intake-smoke.mjs` exercises desktop and mobile save/load behavior, confirms raw bytes are absent from localStorage project payloads, verifies the separate IndexedDB record, validates restored byte availability, and covers corrupt bytes, deleted store, and unsupported IndexedDB fallback.

Non-goal containment: pass. I found no positive implementation claim for archive import/export, File System Access API, drag-drop intake, parser/image decode, external dependency, Cubism SDK/Core/runtime, full renderer, or pixel oracle. Forbidden-scope references are negative assertions, safe UI wording, or historical/orchestration non-goals.

Source organization and dependency compliance: pass. `apps/editor/src/editor-session/index.ts` and `packages/package-format/src/index.ts` remain barrel-only. New files are focused by package/domain. Dependency manifests and lockfile have no Wave35 dependency drift.

Orchestration compliance: pass. Domain reports show separated Gnome implementation and Review-Sylph review contexts, with Orch-Sylph coordination. Domain B recovery is documented as reporting/review coordination rather than source edits by Orch-Sylph.

## Verification Performed

Direct local verification:

- `pnpm.cmd typecheck`: pass
- `pnpm.cmd test:unit`: pass, 179 files / 916 tests
- Focused Wave35 unit run: pass, 5 files / 31 tests
- `pnpm.cmd test:e2e`: pass, desktop and mobile smoke passed
- `pnpm.cmd run check:source`: pass
- `pnpm.cmd run check:deps`: pass
- `git diff --check -- apps/editor packages fixtures/contracts discussion/implementation discussion/design discussion/tests`: pass, LF-to-CRLF warnings only
- `git diff -- package.json pnpm-lock.yaml apps/editor/package.json packages/package-format/package.json packages/validator-core/package.json`: empty

Cross-checked Orch-Sylph reported verification:

- Full typecheck/unit/e2e/source/dependency/diff checks matched the refreshed local results.
- Forbidden-scope scan conclusion is consistent with direct source/doc inspection.

## Residual Risks

- `discussion/implementation/waves/wave35/_map.md` and `discussion/implementation/reviews/wave35/_map.md` reference `discussion/implementation/waves/wave35/wave35-final-report.md`, but that file was not present during this review. This does not block the source/test integration verdict, but Orch-Sylph should create the final report before final Wave35 closure.
- `discussion/tests/fixtures/fixture-manifest.md` and `discussion/tests/traceability/test-traceability-matrix.md` contain prior Wave31/Wave34 byte rows but no dedicated Wave35 row. The Wave35 plan made fixture/traceability registration conditional, and current unit/e2e coverage is adequate; this is a documentation follow-up rather than a blocker.
- IndexedDB persistence remains same-origin/browser-local only. No guarantee is made for quota eviction, private browsing, cross-profile portability, cloud sync, filesystem persistence, or archive portability; these are intentional non-goals.
- `apps/editor/e2e/byte-intake-smoke.mjs` is now a broad smoke file. It remains adequate and policy checks pass, but future e2e growth should consider splitting scenario helpers before the file becomes harder to review.

## User Decision Points

None for Wave35 completion.

Future scope decisions remain explicit backlog items: portable archive behavior, File System Access or drag-drop intake, parser/image decode integration, dependency additions, cloud/cross-profile persistence, Cubism integration, full renderer behavior, and pixel-oracle validation.
