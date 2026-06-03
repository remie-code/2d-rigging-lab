# Wave37 Clean Integration Review-Sylph

verdict: `needs_fix`

Domains A-E と Domain F Gnome fix loop 1 後の clean integration review。基礎文書、Wave36/Wave37 reports、変更 source/tests/docs、最終 verification 報告、read-only scan を確認した。source 実装ファイルは編集していない。

## Findings

1. **blocking: 非 canonical な archive/filesystem capability evidence が `supported` として silent pass できる。**
   - `packages/contracts/src/package-transport-capability.ts:172`-`:196` は `projectDefinedJsonBundleV0` を supported portable bundle として縛っているが、他 capability ID が `status: "supported"` を名乗ることを拒否していない。
   - `packages/validator-core/src/validators/package-transport-capability-diagnostics.ts:143`-`:145` は parse 済み capability の `status` が `supported` なら常に diagnostic なしで返す。
   - そのため、standalone evidence が `standardArchiveZipV0` / `archive` / `supported` を名乗ると、Wave37 では dependency-gated のはずの ZIP/archive claim が `transportCapability.*` diagnostic なしで通る可能性がある。
   - 既存 tests は canonical catalog の truthfulness（`packages/contracts/src/package-transport-capability.test.ts:26`-`:83`）と supported portable evidence（`packages/validator-core/src/package-transport-capability-diagnostics.test.ts:31`-`:58`）を pin しているが、非 portable capability の supported 偽装は覆っていない。
   - Gnome 修正 scope: contract schema で現在の Wave37 status を capability ID に結び付ける、または validator が supplied evidence を canonical Domain A catalog と照合してから `supported` を受理する。`standardArchiveZipV0`、`fileSystemAccessApiV0`、`directoryPickerV0`、`dragDropFileIntakeV0`、`nativeFilesystemPersistenceV0` が supported を名乗っても `transportCapability.schemaInvalid` または同等の deterministic boundary diagnostic になる focused test を追加する。`projectDefinedJsonBundleV0` は引き続き valid / diagnostic-free にする。

## Verification Reviewed / Performed

- Wave37 plan / pass criteria を確認: supported は project-defined portable JSON bundle のみ。ZIP/archive、File System Access API、directory picker、drag-drop、native filesystem persistence、parser/decode、renderer/pixel、Cubism compatibility、dependency expansion は非目標。
- Orch-Sylph の final verification 報告を確認: `pnpm.cmd typecheck` pass、`pnpm.cmd test:unit` pass（188 files / 962 tests）、`pnpm.cmd test:e2e` pass、`pnpm.cmd run check:source` pass、`pnpm.cmd run check:deps` pass、scoped `git diff --check` pass、dependency manifest diff empty。
- read-only で `git status --short -uall`、dependency manifest diff、scoped `git diff --check`、changed `index.ts` barrel scan、forbidden API/dependency scan を実施。
- manifest / lockfile diff は no output。`git diff --check` は LF-to-CRLF warnings のみ。barrel scan は non-export 行なし。
- forbidden scan の hit は E2E の禁止成功文言チェックに限定。drag scan の hit は既存 mesh-canvas drag callback で、file drag/drop intake ではない。

## Review Lanes

- Transport truthfulness: `needs_fix`。canonical catalog は truthful だが、非 canonical evidence の supported 偽装が通る。
- Package-format boundary guards: `pass`。canonical catalog 経由では portable JSON のみ supported、gated/unsupported route は deterministic non-supported / throw。
- Validator diagnostics: `needs_fix`。canonical gated/unsupported evidence の diagnostics は deterministic だが、supported 偽装 gap がある。
- Editor UI / CSS: `pass`。UI は package-format boundary から投影され、portable JSON だけ有効。non-supported rows は disabled `Unavailable` control で成功 handler なし。CSS fix は mobile overflow 対応のみ。
- E2E / fixtures / traceability: `pass`。desktop/mobile e2e は Wave36 portable JSON round-trip と Wave37 unavailable/future-gated UI negative oracle を確認している。
- Non-goal containment: `pass`。ZIP/archive implementation、external archive dependency、File System Access API invocation、directory picker、file drag/drop event path、PSD/PNG parser、image decode、full renderer、pixel oracle、Cubism compatibility implementation は見つからない。
- Source organization / dependency: `pass`。changed `index.ts` は barrel-only。新規 source は責務単位で、catch-all file 追加なし。dependency manifests / lockfile 変更なし。
- Orchestration compliance: `pass`。A-E は Gnome / Review-Sylph 分離、E fix loop と再 review、F Gnome fix loop 1、この clean Review-Sylph が分離されている。

## Files Reviewed

- Basis / policy: orchestration skill、subagent context hygiene、Wave37 plan、current capability map、backlog、source organization policy、dependency policy、schema/id convention、package-format contract、validator contract、fixture manifest、traceability matrix。
- Prior wave: Wave36 final report、Wave36 clean integration review。
- Wave37 artifacts: Domain A-E Gnome/final/review artifacts、Domain E final re-review、Domain F Gnome fix loop 1 report。
- Source/tests/docs: contracts transport capability source/tests/integration/barrel、package-format capability/boundary source/tests/barrel、validator transport diagnostics/runtime integration/catalog/barrel/contract doc、editor transport view model/test IDs/persistence UI/app-shell tests/CSS、portable bundle E2E/test-id mirror、fixture manifest、traceability matrix。

## Remaining Issues / Residual Risks

- 上記 blocking source issue の修正と再 review が必要。
- `.github.zip` は untracked / unowned のまま残っている。Wave37 allowed write scope 外なので削除していない。commit 前の ownership / cleanup residual risk。
- full `pnpm` suites はこの clean review では再実行していない。Orch-Sylph final-state verification を確認し、read-only scan で補足した。

## User-Decision Points

- narrow fix には追加 user decision 不要。
- Future decisions: ZIP/archive dependency support、File System Access API、directory picker、file drag/drop intake、native/cloud/cross-profile persistence、parser/image decode、full renderer、pixel oracle を採用するか。

## Orchestration Separation Confirmation

分離は確認できた。Orch-Sylph reports は source implementation を Gnome に委譲し、clean review を Review-Sylph に委譲している。この review は implementer report だけに依存せず basis docs と source inspection を使い、source は read-only、書き込みはこの artifact のみに限定した。
