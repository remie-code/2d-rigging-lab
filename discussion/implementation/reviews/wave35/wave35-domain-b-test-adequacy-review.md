# Wave35 Domain B Test Adequacy Re-review

verdict: pass

## Scope Reviewed

- Lane: Test Adequacy Re-review after fix loop 1.
- Target: `wave35-editor-indexeddb-byte-store-session-restore`.
- Review mode: clean test adequacy review; inspected target source/tests directly and did not rely on Gnome summary as sole basis.
- Changed test files reviewed:
  - `apps/editor/src/editor-session/indexeddb-persistent-byte-store.test.ts`
  - `apps/editor/src/editor-workflow/workflow-persistent-byte-restore.test.ts`
- Domain B source/test files consulted:
  - `apps/editor/src/editor-session/index.ts`
  - `apps/editor/src/editor-session/persistent-byte-store.ts`
  - `apps/editor/src/editor-session/indexeddb-persistent-byte-store.ts`
  - `apps/editor/src/editor-session/persistent-byte-restore.ts`
  - `apps/editor/src/editor-workflow/workflow-controller.ts`
  - `apps/editor/src/editor-workflow/workflow-state-projection.ts`
  - `apps/editor/src/editor-state/binary-byte-intake-state.test.ts`
- Basis docs/contracts consulted:
  - `discussion/implementation/orchestration/wave35-plan.md`
  - `discussion/implementation/waves/wave35/wave35-domain-a-persistent-binary-storage-contract-foundation-completion-report.md`
  - `packages/package-format/src/persistent-binary-storage-contract.ts`
  - `packages/package-format/src/persistent-binary-storage.ts`

## Summary

Fix loop 1 resolves the four previous test adequacy findings. The added tests now cover the actual `createEditorIndexedDbPersistentByteStore` available put/get path through an injected IndexedDB test double, prove sync `loadProject()` remains metadata-only even when persistent bytes exist, split stale package identity-only and revision-only workflow fallback coverage, and assert both plain-text and base64 sentinel absence across persisted project boundaries.

No new Domain B test adequacy blockers were introduced.

## Previous Findings Re-reviewed

### 1. Actual IndexedDB available roundtrip

Status: resolved

Evidence:

- The real adapter under test is `createEditorIndexedDbPersistentByteStore` in `apps/editor/src/editor-session/indexeddb-persistent-byte-store.ts:31`, with real `put` and `get` logic at `apps/editor/src/editor-session/indexeddb-persistent-byte-store.ts:37` and `apps/editor/src/editor-session/indexeddb-persistent-byte-store.ts:75`.
- The new direct adapter test `stores and restores bytes through the available IndexedDB adapter roundtrip` starts at `apps/editor/src/editor-session/indexeddb-persistent-byte-store.test.ts:36`.
- It verifies DB name/version and object-store creation, stored `ArrayBuffer` bytes for a sliced `Uint8Array`, returned record/bytes, defensive byte copy, and key derivation/missing behavior for same binary id with a different path at `apps/editor/src/editor-session/indexeddb-persistent-byte-store.test.ts:67`, `apps/editor/src/editor-session/indexeddb-persistent-byte-store.test.ts:81`, and `apps/editor/src/editor-session/indexeddb-persistent-byte-store.test.ts:88`.
- The same test file also covers missing available store, unreadable stored value, and open/request failures.

Assessment:

- Adequate for Domain B unit coverage. It exercises the adapter's browser API boundary through an injected `IDBFactory` without adding dependencies. Real browser smoke remains Domain D's e2e responsibility, not a Domain B blocker.

### 2. Sync `loadProject()` metadata-only behavior with persistent bytes present

Status: resolved

Evidence:

- Source still separates sync metadata load and async restore at `apps/editor/src/editor-workflow/workflow-controller.ts:1150` and `apps/editor/src/editor-workflow/workflow-controller.ts:1199`.
- The new test `keeps sync loadProject metadata-only even when persistent bytes exist` starts at `apps/editor/src/editor-workflow/workflow-persistent-byte-restore.test.ts:129`.
- It first proves the persistent store contains bytes, then calls only `loadProject()`, asserts no `persistentByteRestore` payload, asserts no persistent-store `get` request was made, and confirms editor state stays `requires-reupload-after-browser-local-load-v1` / `requiresReupload` at `apps/editor/src/editor-workflow/workflow-persistent-byte-restore.test.ts:145` and `apps/editor/src/editor-workflow/workflow-persistent-byte-restore.test.ts:153`.

Assessment:

- Adequate. The regression where sync `loadProject()` silently restores persistent bytes would now fail.

### 3. Stale package identity-only and revision-only fallback coverage

Status: resolved

Evidence:

- Stale single-mismatch cases are defined in `STALE_PERSISTENT_RECORD_CASES` at `apps/editor/src/editor-workflow/workflow-persistent-byte-restore.test.ts:28`.
- The workflow fallback test is parameterized at `apps/editor/src/editor-workflow/workflow-persistent-byte-restore.test.ts:299`.
- Each case asserts stale report state, `requiresReupload`, expected single issue code, and absence of the opposite issue code at `apps/editor/src/editor-workflow/workflow-persistent-byte-restore.test.ts:333`.
- This maps to the package-format stale rules for package id/revision mismatch in `packages/package-format/src/persistent-binary-storage.ts:179`, `packages/package-format/src/persistent-binary-storage.ts:440`, and `packages/package-format/src/persistent-binary-storage.ts:475`.

Assessment:

- Adequate. The workflow/state projection path now proves package identity-only and package revision-only stale fallback independently.

### 4. Base64 raw-byte sentinel absence

Status: resolved

Evidence:

- The workflow test defines the base64 encoding of `PERSISTENT_RAW_BYTES_SENTINEL` at `apps/editor/src/editor-workflow/workflow-persistent-byte-restore.test.ts:27`.
- The shared negative assertion now checks both the plain sentinel and base64 sentinel at `apps/editor/src/editor-workflow/workflow-persistent-byte-restore.test.ts:574`.
- That assertion is applied to saved browser project JSON, package text entries, operation log JSONL, editor-state JSON, workflow state JSON, and browser storage values at `apps/editor/src/editor-workflow/workflow-persistent-byte-restore.test.ts:553`, `apps/editor/src/editor-workflow/workflow-persistent-byte-restore.test.ts:556`, `apps/editor/src/editor-workflow/workflow-persistent-byte-restore.test.ts:557`, `apps/editor/src/editor-workflow/workflow-persistent-byte-restore.test.ts:560`, and `apps/editor/src/editor-workflow/workflow-persistent-byte-restore.test.ts:562`.

Assessment:

- Adequate. The test now protects against accidental raw-byte serialization through both direct text and base64 payload forms across the relevant persisted metadata surfaces.

## New Findings

None.

## Verification Commands

- `pnpm.cmd exec vitest run apps/editor/src/editor-session/indexeddb-persistent-byte-store.test.ts apps/editor/src/editor-workflow/workflow-persistent-byte-restore.test.ts apps/editor/src/editor-state/binary-byte-intake-state.test.ts`
  - Result: pass, 3 files / 18 tests.
- `pnpm.cmd typecheck`
  - Result: pass.
- `git diff --check -- apps/editor/src/editor-session/index.ts apps/editor/src/editor-session/persistent-byte-store.ts apps/editor/src/editor-session/indexeddb-persistent-byte-store.ts apps/editor/src/editor-session/indexeddb-persistent-byte-store.test.ts apps/editor/src/editor-session/persistent-byte-restore.ts apps/editor/src/editor-workflow/workflow-controller.ts apps/editor/src/editor-workflow/workflow-state-projection.ts apps/editor/src/editor-workflow/workflow-persistent-byte-restore.test.ts apps/editor/src/editor-state/binary-byte-intake-state.test.ts`
  - Result: pass; Git emitted LF-to-CRLF working-copy warnings for tracked files only.

Note: local sandboxed PowerShell failed with `windows sandbox: spawn setup refresh`, so read-only inspection and verification commands were run with approved escalation. Source files were not modified.

## Remaining Issues

None for Domain B test adequacy.

Non-blocking follow-up for the wave: real-browser IndexedDB smoke coverage remains appropriately assigned to Domain D e2e, because Domain B now has focused adapter and workflow unit coverage for its risk surface.

## User-Decision Points

None.
