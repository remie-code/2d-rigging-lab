# Runtime Player Wave7 Domain A Test Adequacy Review

verdict: `pass`

## Findings

なし。

前回 re-review の残件だった `Reset to Auto Map` の user-facing bridge action coverage は、Loop 3 の `apps/runtime-player/src/main/model-mapping-bridge-handlers.test.ts` で解消された。

追加テストは `electron.ipcMain.handle` を mock し、`registerModelMappingBridgeHandlers` 登録後に `modelMappingBridgeChannels.resetToAutoMap` の handler を直接呼び出している（`apps/runtime-player/src/main/model-mapping-bridge-handlers.test.ts:47`, `apps/runtime-player/src/main/model-mapping-bridge-handlers.test.ts:78`）。そのうえで、action result が `ok` / `Reset to Auto Map saved.` であること、保存済み profile の Body Z が auto map defaults に戻ること、`RuntimePlayerBodyFollowState.reset()` が呼ばれることを確認している（`apps/runtime-player/src/main/model-mapping-bridge-handlers.test.ts:91`, `apps/runtime-player/src/main/model-mapping-bridge-handlers.test.ts:100`, `apps/runtime-player/src/main/model-mapping-bridge-handlers.test.ts:104`）。

## Coverage Notes

| Required behavior | Re-review judgment |
|---|---|
| Profile store read/write / corrupt fallback | Covered. |
| packageHash preference / fallback identity mismatch | Covered. |
| deterministic identity / parameter order stability | Covered. |
| Body Follow slot restore | Covered. |
| stale/missing targets and visible status | Covered at helper/state level. |
| corrupt/read-failed profile status propagation | Covered. |
| debounce / flush behavior | Covered, including in-flight edit flush. |
| Reset to Auto Map bridge action | Covered. Handler-level test now protects regenerate + Body Follow reset + immediate saved defaults. |
| live frame after restore uses sanitized player-owned values | Covered. |

## Verification

Inspected parent verification after Loop 3:

```text
pnpm.cmd --filter @private-2d-rigging-lab/runtime-player exec vitest run src/main/model-mapping-bridge-handlers.test.ts src/main/model-mapping-profiles/model-mapping-profile-store.test.ts src/main/model-mapping-profiles/model-mapping-profile-save-controller.test.ts src/main/live-mapping/live-mapping-state.test.ts src/main/model-mapping-profiles/model-mapping-export-identity.test.ts src/main/model-mapping-profiles/model-mapping-profile-slots.test.ts src/main/live-mapping/runtime-export-auto-mapping.test.ts src/main/live-mapping/runtime-parameter-frame.test.ts
```

Result: passed, 8 files / 30 tests.

Also inspected:

- runtime-player typecheck -> passed.
- source organization guard -> passed.
- Domain A diff check -> exit 0 with CRLF warnings only.

I did not rerun tests in this re-review; scope was the remaining bridge-action coverage gap only.

## Residual Manual Gaps

- Electron manual: tune Mapping / Body Follow, restart or reopen same Runtime Export, and confirm restored values plus Mapping / Overview status.
- Electron/manual or fault-injection: save failure and Retry status path.
- Real input/manual: after restore/reset, Body Follow visual motion still feels correct with real tracking input and authored Body X/Z targets.

