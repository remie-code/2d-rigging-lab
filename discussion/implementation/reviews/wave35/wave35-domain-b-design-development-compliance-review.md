# Wave35 Domain B Design / Development Compliance Review

Date: 2026-06-03

verdict: `pass`

## Review Lane

Design / Development Compliance Review for
`wave35-editor-indexeddb-byte-store-session-restore`.

This review used clean, repository-grounded context. I inspected the Domain B
diff/source files directly, read the relevant wave/policy/contract basis, and ran
focused verification. I did not rely on an implementer summary as the review basis.

## Findings

No blocking findings.

No design/development compliance issue was found in the Domain B changed files.

## Scope Reviewed

Reviewed Domain B files:

- `apps/editor/src/editor-session/index.ts`
- `apps/editor/src/editor-session/persistent-byte-store.ts`
- `apps/editor/src/editor-session/indexeddb-persistent-byte-store.ts`
- `apps/editor/src/editor-session/indexeddb-persistent-byte-store.test.ts`
- `apps/editor/src/editor-session/persistent-byte-restore.ts`
- `apps/editor/src/editor-workflow/workflow-controller.ts`
- `apps/editor/src/editor-workflow/workflow-state-projection.ts`
- `apps/editor/src/editor-workflow/workflow-persistent-byte-restore.test.ts`
- `apps/editor/src/editor-state/binary-byte-intake-state.test.ts`

The broader worktree includes package-format and validator-core files attributable to
Domain A/C. I treated those as basis or parallel changes only. Domain B source changes
stay in the allowed editor session/workflow/state surface and do not edit
`packages/package-format/**` or `packages/validator-core/**`.

## Basis Used

- Wave35 plan: Domain B objective and constraints require IndexedDB-only browser-local
  persistence, digest/byteLength verification before availability, no large raw bytes
  in saved browser-local project data, and no dependency/manifest/lockfile changes
  (`discussion/implementation/orchestration/wave35-plan.md:47-52`,
  `:147-171`, `:296`, `:330-333`).
- Source organization policy: `index.ts` must remain a barrel/re-export surface and
  implementation logic must live in named responsibility files
  (`discussion/development_convention/source-file-organization-policy.md:26-46`,
  `:83-88`).
- Dependency policy: dependency and lockfile changes require approval evidence, and
  Cubism/proprietary parser/runtime dependencies remain forbidden
  (`discussion/development_convention/dependency-policy.md:187`,
  `:374-380`).
- Domain A contract/evaluator basis: persistent byte records and availability reports
  carry package identity/revision, binary ref, digest/byteLength/mediaType, backend
  state, verification status, and stable issue codes
  (`packages/package-format/src/persistent-binary-storage.ts:76-145`,
  `:185-279`, `:465-497`).
- Domain A completion report confirms the contract is same-origin browser-local
  evidence only, not portable archive/filesystem/cloud persistence
  (`discussion/implementation/waves/wave35/wave35-domain-a-persistent-binary-storage-contract-foundation-completion-report.md:79-80`,
  `:130-136`).

## Compliance Evidence

- Storage truthfulness: the Editor store backend constant is explicitly
  `indexeddb-same-origin-browser-local-v1`
  (`apps/editor/src/editor-session/persistent-byte-store.ts:9-10`), and the concrete
  adapter only uses `globalThis.indexedDB` / injected `IDBFactory`
  (`apps/editor/src/editor-session/indexeddb-persistent-byte-store.ts:31-43`,
  `:75-86`, `:124-142`). There is no archive, filesystem, cloud, File System Access
  API, localStorage/base64 payload, parser, image decode, Cubism/Core/SDK, renderer,
  pixel oracle, or external dependency implementation in Domain B files.
- File intake persistence: PSD selected-file intake stores actual selected bytes
  separately after a committed import by calling `storeEditorPersistentSourceBinaryBytes`
  with the reloaded package document, source asset id, and selected bytes
  (`apps/editor/src/editor-workflow/workflow-controller.ts:707-728`).
- Stored record identity: the store record is created from the current package id,
  package revision, binary asset reference, storage backend, and timestamps
  (`apps/editor/src/editor-session/persistent-byte-restore.ts:83-91`). The IndexedDB
  adapter stores the record and a copied byte buffer as a browser-local value
  (`apps/editor/src/editor-session/indexeddb-persistent-byte-store.ts:45-65`).
- Restore integrity: the async restore path reads stored bytes, verifies them with
  `verifyPackageBinaryAssetBytes`, evaluates Domain A persistent availability, and
  registers bytes into the authoring session only when both availability and
  verification pass (`apps/editor/src/editor-session/persistent-byte-restore.ts:169-200`).
- Stale identity/revision cannot silently pass: Domain B passes the current package
  id/revision and stored record into the Domain A evaluator
  (`apps/editor/src/editor-session/persistent-byte-restore.ts:179-187`), and Domain A
  emits stale issues for package id/revision, binary ref, digest, byteLength, media
  type, or backend mismatch
  (`packages/package-format/src/persistent-binary-storage.ts:185-279`,
  `:524-538`).
- Truthful fallback: unsupported/unavailable IndexedDB returns unavailable store
  results (`apps/editor/src/editor-session/indexeddb-persistent-byte-store.ts:188-214`);
  missing records and unavailable stores are evaluated as not restored
  (`apps/editor/src/editor-session/persistent-byte-restore.ts:141-167`); corrupt or
  stale bytes are not registered because `canRestore` requires available persistent
  bytes and a pass verification report (`apps/editor/src/editor-session/persistent-byte-restore.ts:188-200`).
- API shape: the existing synchronous `loadProject()` remains unchanged and continues
  to load metadata-only browser-local state (`apps/editor/src/editor-workflow/workflow-controller.ts:1150-1198`).
  The new async `loadProjectWithPersistentBytes()` wraps `loadProject()`, performs
  restore, then rebuilds state from restored snapshot evidence
  (`apps/editor/src/editor-workflow/workflow-controller.ts:1199-1244`).
- State projection remains truthful: restored bytes appear available only when the
  restored snapshot reports the package-local in-memory path
  (`apps/editor/src/editor-workflow/workflow-controller.ts:1213-1232`;
  `apps/editor/src/editor-state/binary-byte-intake-state.ts:154-164`).
- Separation of data: `saveProject()` persists `snapshot.packageFileSet` and
  operation log, not `packageInMemoryFileSet` (`apps/editor/src/editor-workflow/workflow-controller.ts:1130-1148`).
  Domain B tests assert the sentinel raw bytes and byte-like fields are not present in
  saved project JSON, operation log, editor state, or re-saved project data
  (`apps/editor/src/editor-workflow/workflow-persistent-byte-restore.test.ts:41-52`,
  `:92-108`).
- Source organization: `apps/editor/src/editor-session/index.ts` remains a barrel with
  re-exports only (`apps/editor/src/editor-session/index.ts:1-18`). New logic is split
  into clear responsibility files: persistent byte store API/key/copy helpers,
  IndexedDB adapter, and session restore/store orchestration.
- Dependency boundary: manifest/lockfile diff check for the relevant package manifests
  returned empty output, and Domain B imports only existing workspace modules plus
  browser-native IndexedDB types.

## Verification Performed

- `git status --short -uall`
  - confirmed Domain B changed files plus parallel Domain A/C worktree changes.
- `git diff -- apps/editor/src/editor-session/index.ts apps/editor/src/editor-workflow/workflow-controller.ts apps/editor/src/editor-workflow/workflow-state-projection.ts apps/editor/src/editor-state/binary-byte-intake-state.test.ts`
  - inspected tracked Domain B changes directly.
- Direct line-numbered inspection with `rg -n "^"` / focused `rg -n -C` for all new
  Domain B files and relevant existing source.
- Forbidden-scope scan over Domain B files for archive, File System Access API,
  drag-drop, parser, image decode, external dependency, Cubism, full renderer, pixel
  oracle, localStorage, base64, and zip terms.
  - Only imports, existing drag mesh method names, IndexedDB identifiers, and negative
    raw-byte/base64 test assertions appeared.
- `git diff -- package.json pnpm-lock.yaml apps/editor/package.json packages/package-format/package.json packages/validator-core/package.json`
  - empty output; no manifest/lockfile dependency changes.
- `git diff --check --` the Domain B target files
  - exit 0; Git emitted LF-to-CRLF working-copy warnings for tracked files.
- `pnpm.cmd exec vitest run apps/editor/src/editor-session/indexeddb-persistent-byte-store.test.ts apps/editor/src/editor-workflow/workflow-persistent-byte-restore.test.ts apps/editor/src/editor-state/binary-byte-intake-state.test.ts`
  - pass, 3 files / 12 tests.
- `pnpm.cmd typecheck`
  - pass.

Environment note: sandboxed shell startup failed with `windows sandbox: spawn setup
refresh`, so read-only inspection and verification commands were run through the
approved escalated command path.

## Remaining Issues

No remaining Domain B design/development compliance issues.

Non-blocking scope notes:

- The existing app UI still calls synchronous `workflow.loadProject()`
  (`apps/editor/src/app/editor-app.ts:179`). This preserves the truthful metadata-only
  fallback and matches the API-shape rubric, but user-facing async load wiring and e2e
  smoke remain Domain D work per the Wave35 plan
  (`discussion/implementation/orchestration/wave35-plan.md:200-226`).
- The IndexedDB adapter reports `stored` after the `put` request succeeds
  (`apps/editor/src/editor-session/indexeddb-persistent-byte-store.ts:57-66`), not after
  an explicit transaction-complete wait. This is not a blocking compliance issue for
  Domain B because restore still re-reads and verifies bytes before availability, but
  a future hardening pass could wait for transaction completion before returning
  `stored`.

## User-Decision Points

None for Domain B.

Escalation would be needed only if later work requires archive/export/import,
filesystem or cloud persistence guarantees, File System Access API, directory picker,
drag-drop, parser/image decode dependencies, Cubism compatibility, full renderer
behavior, pixel oracle claims, or storing raw bytes in browser-local project JSON.

## Reviewer Conduct

I did not modify source implementation files, tests, package manifests, lockfiles, or
Domain A/C files. The only file written by this review is
`discussion/implementation/reviews/wave35/wave35-domain-b-design-development-compliance-review.md`.
