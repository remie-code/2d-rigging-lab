# Runtime Player Wave7 Domain A Design/Development Review

## Verdict

pass

Fix loop 2 後の再レビューでは、前回の design/development 所見 2 件はいずれも解消されている。修正対象周辺に明白な責務境界・保存 lifecycle・identity 判定の回帰は見つからなかった。

## Findings

なし。

## Resolved Previous Findings

### Resolved: 保存中に追加された編集が flush で永続化されない可能性

- 対象:
  - `apps/runtime-player/src/main/model-mapping-profiles/model-mapping-profile-save-controller.ts:58`
  - `apps/runtime-player/src/main/model-mapping-profiles/model-mapping-profile-save-controller.ts:66`
  - `apps/runtime-player/src/main/model-mapping-profiles/model-mapping-profile-save-controller.ts:76`
  - `apps/runtime-player/src/main/model-mapping-profiles/model-mapping-profile-save-controller.test.ts:101`

`flush()` は最大 10 pass の loop になり、timer を消し、in-flight save があれば完了を待ち、完了後に `needsMappingProfileSave()` を再確認する。dirty state が残る場合は debounce へ逃がさず `saveNow()` で即時保存するため、前回指摘した export 切替/quit 前の編集喪失 path は閉じている。追加テストも、保存中の編集を flush が 2 回目の profile として保存することを確認している。

### Resolved: `packageHash` 優先 identity と load-time 一致判定が噛み合っていない

- 対象:
  - `apps/runtime-player/src/main/model-mapping-profiles/model-mapping-profile-store.ts:161`
  - `apps/runtime-player/src/main/model-mapping-profiles/model-mapping-profile-store.ts:165`
  - `apps/runtime-player/src/main/model-mapping-profiles/model-mapping-profile-store.ts:172`
  - `apps/runtime-player/src/main/model-mapping-profiles/model-mapping-profile-store.test.ts:85`
  - `apps/runtime-player/src/main/model-mapping-profiles/model-mapping-profile-store.test.ts:147`

`isMatchingIdentity()` は双方に `packageHash` がある場合に hash 一致を authoritative とし、hash がない場合だけ `packageId + packageRevision + parameterSignatureHash` の fallback 判定へ進む。追加テストは、同一 packageHash で revision/signature が変わっても load できること、および packageHash がない場合は fallback tuple 不一致を拒否することを確認している。

## Source Organization Notes

- `apps/runtime-player/src/main/model-mapping-profiles/` は identity、document、parser、slots、store、save-controller に責務分割されている。最大ファイルは `model-mapping-profile-parser.ts` の 289 行で、現時点では single responsibility の範囲内。
- 新規 `index.ts` はない。既存 `index.ts` 変更も確認していないため、`index.ts` 分類は「該当なし」。
- 禁止 catch-all 名の `types.ts` / `schemas.ts` / `utils.ts` / `helpers.ts` は新規 Domain A 配下にない。
- Fix loop 2 は既存責務ファイル内の lifecycle / identity 判定と既存テスト拡張で閉じており、source organization の悪化は見つからない。
- `control-window-app.tsx` は 689 行で、Domain A と concurrent Domain B の wiring が同居している。今回の Domain A blocking ではないが、次 wave でさらに state/API wiring が増えるなら page/controller hook 分割を検討した方がよい。
- `node scripts/check-source-organization.mjs` は pass。

## Boundary / API Notes

- Model Mapping Profile は `userData/model-mapping-profiles/<safe-package-id>/<fingerprint>.json` に保存され、Input Profile (`input-profiles/ifacialmocap/profiles.json`) と window-state (`window-state/runtime-player.json`) から分離されている。
- main が mapping/persistence を所有し、Control UI は `window.runtimePlayer.modelMapping` の typed preload API を使っている。
- Stage 側の live path は `RuntimePlayerLiveParameterFrame.parameterValues` のみを評価に渡しており、Domain A の実装で Stage に raw tracking frame を渡す変更は確認していない。
- UI は Mapping page の profile card に status/warning、`Reset to Auto Map`、保存失敗時の `Retry` を置いている。Header に manual save は追加されていない。

## Unresolved User-Decision Points

なし。

## Evidence

読んだ basis:

- `discussion/runtime-player/implementation/orchestration/player-wave7-plan.md`
- `discussion/runtime-player/screens/tracking-setup-live-mapping.md`
- `discussion/runtime-player/screens/control-window-screen-structure.md`
- `discussion/runtime-player/implementation/orchestration/runtime-player-wave-planning-conventions.md`
- `discussion/development_convention/source-file-organization-policy.md`

主に確認した source:

- `apps/runtime-player/src/main/model-mapping-profiles/**`
- `apps/runtime-player/src/main/live-mapping/live-mapping-state.ts`
- `apps/runtime-player/src/main/live-mapping/runtime-export-auto-mapping.ts`
- `apps/runtime-player/src/main/model-mapping-bridge-handlers.ts`
- `apps/runtime-player/src/main/runtime-export-loader/runtime-export-bridge-handlers.ts`
- `apps/runtime-player/src/main/runtime-player-main.ts`
- `apps/runtime-player/src/preload/model-mapping-bridge-*`
- `apps/runtime-player/src/preload/runtime-player-bridge.ts`
- `apps/runtime-player/src/preload/runtime-player-bridge-contract.ts`
- `apps/runtime-player/src/control/mapping-page.tsx`
- `apps/runtime-player/src/control/overview-page.tsx`
- `apps/runtime-player/src/control/control-window-app.tsx`
- `apps/runtime-player/src/control/control-window-formatters.ts`
- Stage live frame boundary確認として `apps/runtime-player/src/preload/live-parameter-bridge-contract.ts` と `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts`

実行した確認:

- `git status --short -uall`
- `git diff --stat -- <Domain A target paths>`
- `git diff --check -- <Domain A target paths>`: 空白エラーなし。LF/CRLF warning のみ。
- `node scripts/check-source-organization.mjs`: pass。
- `pnpm.cmd exec vitest run apps/runtime-player/src/main/model-mapping-profiles`: sandbox では esbuild spawn `EPERM`、権限昇格再実行で 4 files / 11 tests pass。

Fix loop 2 再レビューで追加確認:

- `apps/runtime-player/src/main/model-mapping-profiles/model-mapping-profile-save-controller.ts`
- `apps/runtime-player/src/main/model-mapping-profiles/model-mapping-profile-save-controller.test.ts`
- `apps/runtime-player/src/main/model-mapping-profiles/model-mapping-profile-store.ts`
- `apps/runtime-player/src/main/model-mapping-profiles/model-mapping-profile-store.test.ts`
- `pnpm.cmd exec vitest run apps/runtime-player/src/main/model-mapping-profiles/model-mapping-profile-save-controller.test.ts apps/runtime-player/src/main/model-mapping-profiles/model-mapping-profile-store.test.ts`: 権限昇格再実行で 2 files / 8 tests pass。
- Parent verification: targeted tests 7 files / 29 tests pass、runtime-player typecheck pass、source organization guard pass、Domain A diff check exit 0 with CRLF warnings only。
