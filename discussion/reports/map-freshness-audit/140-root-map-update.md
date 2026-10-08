# Root map update report

> 2026-08-08 (Asia/Tokyo)。`map-update-contract.md` と `90-root-map-integration.md` に従い、child/parent map 更新と pre-root review pass 後に `discussion/_map.md` だけを更新した。

## 1. 所有範囲・入力

- Exclusive map: `discussion/_map.md`（変更 1 map）。
- 作成 report: 本ファイル（変更 1 report）。source、test、non-map design/AC 本文、生成物、stage/commit は変更していない。
- 読了した入力: `map-update-contract.md`、`90-root-map-integration.md`、updater reports `110`–`123`、`130-map-update-mechanical-review.md`、`131-map-update-semantic-review.md`。下層を再サーベイせず、child/parent map と各 report の current-owner route を照合した。

## 2. Root correction ledger（90 report の R01–R22 対応）

| 90 ID | Root section | 反映した現在の入口 truth |
|---|---|---|
| R01 | 位置付け / AC・scenario・design 行 | 要求/スコープの正は root concept/AC。runtime schema・solver・cardinality は `design/dynamics-world-frame-chain.md` + Wave106。v3 traceability は未決の user gate。 |
| R02 | 直下 implementation 行 | Wave102 は Editor mainline の計画停止。W103–109 は specialized evidence。 |
| R03 | 直下 runtime-player 行 | W1–20 source/review pass、W21 A/B pass・C pending、W22/23 source/test pass。実機/製品 gate は未完了。 |
| R04 | 直下 model-authoring 行 | 装備・閉問題01–19・craft second cycle 完了。PNG、strict-ref/sidecar、次 scope は未決。 |
| R05 | 直下 mesh-generation 行 | v6D default + v7 comparison toggle と品質 hold を保持し、W108/109 render/data contract 完了を別記。 |
| R06 | 直下 render-performance 行 | Editor Perf Wave2 close、Player W13–19 complete、C7 二体負荷は optional/未計測。 |
| R07 | 直下 editor-electron-migration 行 | WS1–WS4 + packaging 完了。PSD E2E、typecheck/unit、dead branch、metadata warning は残債。 |
| R08 | 直下 ai-cohost 行 | C1–C7 器完了、S1–S8 実装進行。S8/brain/memory human gate、`apps/soul` 特区例外を明記。 |
| R09 | 直下 expo 行 | 6 HTML + 6 A2 PDF 完成。外部 acceptance 未検証、proof print/権利確認を未完了。 |
| R10 | 直下 reports 行 | Cubism/旧性能資料は private historical archive。現行 performance/runtime owner を topic map に移した。 |
| R11 | 状態サマリ Implementation baseline/maps | repaired implementation/orchestration を current index、capability/backlog は dated snapshot とした。 |
| R12 | 状態サマリ Current implementation work | Editor mainline は停止、model-authoring/runtime-player が active family、W103–109 は再承認なしに継続しない。 |
| R13 | 状態サマリ Runtime Player | root route を runtime parent/implementation parent と W22/23 gate index に更新。 |
| R14 | 状態サマリ Model Authoring | 01–19/second cycle 完了と PNG/portability/next-scope gate を分離。 |
| R15 | 状態サマリ Mesh | quality hold と W108/109 contract evidence を分離。 |
| R16 | 状態サマリ Render | Perf Wave2/Player W13–19 close、historical report boundary、C7 optional を反映。 |
| R17 | 状態サマリ Electron | packaging 完了と residual debt を反映。 |
| R18 | 状態サマリ AI | C/S progress、S8/brain/memory/persona gate、`apps/soul` only exception を反映。 |
| R19 | 次の行動 #1 | implementation/orchestration + specialized maps を basis、Wave102 stop、dated snapshot 注記。 |
| R20 | 次の行動 #4 | Runtime Player parent と W21/W11/W20/W22/W23 human/device gate を current route。 |
| R21 | 次の行動 #7 | WS1 first を除去し、Electron residual E2E/type/test/metadata debt を action 化。 |
| R22 | 次の行動 #8 / 未決事項 | AI action を S8 kill、brain-swap、stream-memory、persona/S9 に更新し、history/index queue を W51–55、W22/23、W107、W89–102 まで拡張。 |

Correction records: **22/22**（90 ledger と一致）。Root は wave-level evidence を複製せず、各 child/parent map と report に委譲した。

## 3. Preserved decisions and open gates

### Accepted decisions intentionally unchanged

- Private 2D Rigging Lab / Prototype と four-track 分離。
- Product requirement oracle は concept/Root AC/MVP AC、Cubism exclusion は維持。
- Editor mainline の Wave102 planning stop、および post-102 W103–109 specialized boundary。
- Runtime Player sanitized transport と product deep-profiler 非公開境界。
- v6D/v7 quality hold、Wave106 は semantics/schema replacement で performance claim ではないこと。
- WebGL2 primary + Canvas2D fallback、Skyline default、Wave108/109 data contract の実装 fact と visual gate の分離。
- AI の `apps/soul` 特区内 LLM/perception 例外（特区外は禁止）、D4 YouTube / D6 key-operation ladder / D7 Variant-out-of-scope。

### Open user/human/device/legal/product gates retained

`90-root-map-integration.md` §7 の **22 gates** を root の未決事項と child route に保持した。内訳は次のとおり。

1. Dynamics v3/profile-v2 の Domain-09 traceability/cardinality wording。
2. Runtime Player W11 near/far calibration・Stage Motion・Browser Source parity・restart。
3. Runtime Player W13–19 OBS/CEF alpha/WebGL2/real-model motion・cadence confidence。
4. Runtime Player W20 packaged/dev Electron lifecycle/reopen smoke。
5. Runtime Player W21 Dynamics Tune real-export/iFacialMocap parity・persistence/reset/isolation。
6. Runtime Player W22/23 real speech: mouth-open/closed-vowel/transition/“e”/“u”。
7. Model-authoring post-`45d2734` PNG byte re-certification。
8. Model-authoring strict-ref/sidecar portability acceptance。
9. Model-authoring next closed-problem scope selection。
10. Mesh v6 retention、toggle lifetime、Wave2/v6 deletion authorization。
11. Wave108 atlasRuntime formal visual acceptance。
12. Mesh GPU/pixel parity、Canvas2D sunset、original inset recheck。
13. Optional C7 two-instance hardware/browser CPU/GPU/FPS capture。
14. Electron PSD E2E precondition、typecheck/unit debt、metadata warning timing。
15. AI S8 kill during speech、reject/restore、no-regression human check。
16. AI brain-swap rollout cleanup、long-run behavior、Opus/Sol/Terra choice。
17. AI stream-memory privacy/save/load/OFF/update behavior。
18. AI persona/S9 voice product decision（body/rig remains model-authoring-owned）。
19. Expo acceptance notification and post-acceptance real-size proof print。
20. Expo/archive legal/permission/scope review before Cubism restart。
21. Demo rights-clean fixture、final disclaimer/UI、automated preflight。
22. First Live2D Feature Proposal draft/submission target。

## 4. Intentionally unchanged policy text / history boundaries

- `discussion/_conventions.md` policy, Private baseline, four tracks, and Cubism non-support wording were not rewritten.
- Historical wave maps/reports remain as-of-wave evidence; W51–55 purge is not recreated, and dated capability/backlog/static performance reports remain snapshots.
- Root does not promote automated pass, clean review, or repository artifact existence to human/device, external acceptance, legal, price, or product-quality completion.
- No implementation/source/test/config or external service/device run was performed.

## 5. Verification

- Root relative Markdown-link resolver (URL-decoded, fragment-stripped): `checked=64 missing=0` (**pass**).
- `git diff --check -- discussion/_map.md`: **pass** (only expected LF→CRLF working-copy warning).
- Root map changed count: **1**; correction records: **22**; retained open gates: **22**; owner report: **1**.
- No stage or commit performed; unrelated pre-existing user changes preserved.

## 6. Final semantic correction pass (142)

`142-root-map-semantic-review.md` was read after the initial root update. It found one stale residual description at the implementation history row (previously “38 missing-map decisions” plus W22/23/W107 indexes as an ongoing queue). That wording was corrected in `discussion/_map.md` to state that W0–50/W56–109 child/review indexes and W22/23/W107 registrations are backfilled/current; W51–55 remain intentionally purged/Git-history-only; six baseline orphan candidates are structural/historical hygiene only if relevant; and W109 partial evidence/human gates remain as documented. No new work item or gate was introduced.

Verification after correction:

- Root relative-link resolver: `checked=64 missing=0` (**pass**).
- `git diff --check -- discussion/_map.md discussion/reports/map-freshness-audit/140-root-map-update.md`: **pass** (only expected LF→CRLF warning).
- Scope remains exclusive to `discussion/_map.md` and this report; no stage/commit.
