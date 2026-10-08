# Runtime Player Wave7 Domain A Spec Compliance Review

verdict: `pass`

## Findings

- なし。

## Resolved Previous Finding

- 前回finding「`packageHash` 優先 identity なのに、load 時の一致判定が `parameterSignatureHash` 差分で profile を拒否する」は解消済み。
- 実装事実: `isMatchingIdentity` は、current export と profile の双方に `packageHash` がある場合、`packageHash` 一致をauthoritativeに扱う（`apps/runtime-player/src/main/model-mapping-profiles/model-mapping-profile-store.ts:161`）。
- 実装事実: `packageHash` がないfallbackでは、`packageId + packageRevision + parameterSignatureHash` の一致を引き続き要求する（`apps/runtime-player/src/main/model-mapping-profiles/model-mapping-profile-store.ts:172`）。
- テスト事実: store test は `packageHash` 一致時に revision/signature 差分があってもprofileをloadすることを確認している（`apps/runtime-player/src/main/model-mapping-profiles/model-mapping-profile-store.test.ts:85`）。
- テスト事実: hashなしfallbackでは signature不一致を `read-failed` にすることを確認している（`apps/runtime-player/src/main/model-mapping-profiles/model-mapping-profile-store.test.ts:147`）。
- テスト事実: live mapping state test は `packageHash` matched profileを復元し、stale saved targetをvisible warning付き `stale` statusへ伝播することを確認している（`apps/runtime-player/src/main/live-mapping/live-mapping-state.test.ts:44`）。
- obvious regression: 指定ファイル範囲では確認なし。

## Spec Items Covered

- Deterministic Runtime Export identity: `packageHash` がある場合は load一致判定でもauthoritativeに扱われる。hashなしfallbackでは `packageId + packageRevision + parameterSignatureHash` を要求する（`apps/runtime-player/src/main/model-mapping-profiles/model-mapping-profile-store.ts:161`）。
- Profile storage path: `<userData>/model-mapping-profiles/<safe-package-id>/<fingerprint>.json` の形で構築している（`apps/runtime-player/src/main/model-mapping-profiles/model-mapping-profile-store.ts:47`、`apps/runtime-player/src/main/model-mapping-profiles/model-mapping-profile-store.ts:57`）。
- Runtime Export open時のprofile load: `setRuntimeExportPayload` が `profileStore.loadProfile(payload)` を呼ぶ（`apps/runtime-player/src/main/model-mapping-bridge-handlers.ts:68`）。
- Mapping slots / Body Follow controls restore: profile document は `enabled / invert / strength / smoothing / bodyRotationStrength / bodyRotationInvert / bodyPositionStrength / bodyPositionInvert` を保存し、restore時に戻している（`apps/runtime-player/src/main/model-mapping-profiles/model-mapping-profile-document.ts:29`、`apps/runtime-player/src/main/model-mapping-profiles/model-mapping-profile-slots.ts:146`）。
- Debounced auto-save and flush: save controller は既定750ms debounceで `Unsaved changes` から保存し、Runtime Export switch/clear と app quit で flush している（`apps/runtime-player/src/main/model-mapping-profiles/model-mapping-profile-save-controller.ts:38`、`apps/runtime-player/src/main/runtime-player-main.ts:80`、`apps/runtime-player/src/main/runtime-player-main.ts:94`、`apps/runtime-player/src/main/runtime-player-main.ts:113`）。
- Mapping / Overview status: Mapping page は profile status と warning details、save失敗時の Retry を表示し、Overview は concise な Mapping Profile status を表示している（`apps/runtime-player/src/control/mapping-page.tsx:59`、`apps/runtime-player/src/control/mapping-page.tsx:72`、`apps/runtime-player/src/control/mapping-page.tsx:86`、`apps/runtime-player/src/control/overview-page.tsx:192`）。
- Reset to Auto Map: auto mappingを再生成し、Body Follow lag stateをresetし、即時saveを試みている（`apps/runtime-player/src/main/model-mapping-bridge-handlers.ts:161`）。
- Missing/corrupt fallback: missingは Auto Map status、read/parse failure は `load-warning` で Auto Map fallback している（`apps/runtime-player/src/main/live-mapping/live-mapping-state.ts:305`、`apps/runtime-player/src/main/live-mapping/live-mapping-state.ts:313`）。
- Stale targets: `restoreModelMappingProfileSlots` は missing target をslot単位で Auto Map fallback し、warningを返す（`apps/runtime-player/src/main/model-mapping-profiles/model-mapping-profile-slots.ts:74`、`apps/runtime-player/src/main/model-mapping-profiles/model-mapping-profile-slots.ts:80`）。修正後は `packageHash` matched profileがrestore pathへ進み、stale statusへ伝播することをtestで確認している（`apps/runtime-player/src/main/live-mapping/live-mapping-state.test.ts:44`）。
- Out-of-scope: Domain A 変更範囲では general Runtime parameter editing UX、Stage raw tracking、OBS/click-through/always-on-top 等のDomain A実装は確認していない。Stage/window-state変更は同一worktreeのDomain Bとして扱い、Domain A契約に関係するshared bridgeのみ確認した。

## Unresolved User-Decision Points

- なし。

## Evidence Commands / Files Inspected

- `Get-Content -Encoding UTF8 discussion/_conventions.md`
- `Get-Content -Encoding UTF8 discussion/_map.md`
- `Get-Content -Encoding UTF8 discussion/runtime-player/implementation/orchestration/player-wave7-plan.md`
- `Get-Content -Encoding UTF8 discussion/runtime-player/screens/tracking-setup-live-mapping.md`
- `Get-Content -Encoding UTF8 discussion/runtime-player/screens/control-window-screen-structure.md`
- `Get-Content -Encoding UTF8 discussion/runtime-player/backlog/runtime-player-backlog.md`
- `Get-Content -Encoding UTF8 discussion/runtime-player/implementation/orchestration/runtime-player-wave-planning-conventions.md`
- `git status --short -uall`
- `git diff --stat -- apps/runtime-player/src/main/model-mapping-profiles ... apps/runtime-player/src/control/control-window-formatters.ts`
- `rg -n` over Domain A source files for `packageHash`, `parameterSignatureHash`, `profile`, `restore`, `stale`, `debounce`, `flush`, `Reset to Auto Map`, `loadedAtIso`, and out-of-scope keywords.
- Re-review after fix loop 2:
  - `Get-Content -Encoding UTF8 apps/runtime-player/src/main/model-mapping-profiles/model-mapping-profile-store.ts`
  - `Get-Content -Encoding UTF8 apps/runtime-player/src/main/model-mapping-profiles/model-mapping-profile-store.test.ts`
  - `Get-Content -Encoding UTF8 apps/runtime-player/src/main/live-mapping/live-mapping-state.test.ts`
  - `Get-Content -Encoding UTF8 discussion/runtime-player/implementation/reviews/wave7/runtime-player-wave7-domain-a-spec-compliance-review.md`
  - Parent verification reported passed: focused runtime-player vitest 7 files / 29 tests, runtime-player typecheck, source organization check, Domain A `git diff --check`.
- Inspected source files under `apps/runtime-player/src/main/model-mapping-profiles/**`.
- Inspected `apps/runtime-player/src/main/live-mapping/live-mapping-state.ts`.
- Inspected `apps/runtime-player/src/main/live-mapping/runtime-export-auto-mapping.ts`.
- Inspected `apps/runtime-player/src/main/model-mapping-bridge-handlers.ts`.
- Inspected `apps/runtime-player/src/main/runtime-export-loader/runtime-export-bridge-handlers.ts`.
- Inspected `apps/runtime-player/src/main/runtime-player-main.ts`.
- Inspected `apps/runtime-player/src/preload/model-mapping-bridge-channels.ts`.
- Inspected `apps/runtime-player/src/preload/model-mapping-bridge-contract.ts`.
- Inspected Domain A portions of `apps/runtime-player/src/preload/runtime-player-bridge.ts` and `apps/runtime-player/src/preload/runtime-player-bridge-contract.ts`.
- Inspected `apps/runtime-player/src/control/mapping-page.tsx`.
- Inspected `apps/runtime-player/src/control/overview-page.tsx`.
- Inspected `apps/runtime-player/src/control/control-window-app.tsx`.
- Inspected `apps/runtime-player/src/control/control-window-formatters.ts`.
