# Workspace activity refresh — product policy

> 基準日: 2026-08-08 (Asia/Tokyo)。Git HEAD: `af5839452f0968a005cb6cd13c62b714aa4e6d4e` (`docs: refresh discussion maps`)。
> 担当範囲は product policy / scope / requirements / demo-proposal hygiene / development-convention boundary。調査のみで、source・test・既存mapは変更していない。

## 1. Scope / inspected entry points

先に `discussion/reports/workspace-activity-refresh/audit-contract.md`、`discussion/_conventions.md`、`discussion/_map.md` を読み、次の関連 map と原典を確認した。

- Maps: `discussion/concept/_map.md`、`discussion/acceptance-criteria/_map.md`、`discussion/acceptance-criteria/02_DomainAcceptanceCriteria/_map.md`、`discussion/scenarios/_map.md`、`discussion/scenarios/02_DomainAcceptanceCriteria/_map.md`、`discussion/demo/_map.md`、`discussion/proposal/_map.md`、`discussion/development_convention/_map.md`。
- Product originals: `concept/modified_concept.md`、Root Question、Root AC、MVP AC、Domain-09 AC/scenario、`demo/streaming-demo-policy.md`、`proposal/live2d-feature-proposal-template.md`。
- Policy/design originals: `design/dynamics-world-frame-chain.md`、`design/codex-friendly-automation-policy.md`、development-convention の source-of-truth / testing-and-acceptance / demo-rights-ip / ux-backed-package-logic authority。
- Boundary originals: `ai-cohost/concept/mvp-boundary-amendment.md`、`apps/soul/README.md`。
- Current source/evidence: `packages/package-format/src/model-files.ts`、`packages/contracts/src/runtime-state.ts`、`packages/runtime-core/src/dynamics-evaluation.ts` / `normalized-runtime-graph.ts`、`packages/contracts/src/product-preflight-report.ts`、`scripts/check-soul-zone-boundary.mjs`、Wave106 final clean review、Git history。

## 2. Executive summary

1. **Accepted product baseline:** 主目的は権利クリーン素材を扱う個人用 `Private 2D Rigging Lab / Prototype`。MVP は `Private Authoring-to-Viewer Prototype` であり、GUI editor、private runtime/viewer、project-defined package、validator、AI assistant、demo-safe captureを一周させる方針である（`discussion/concept/modified_concept.md:7-21,125-146`、Root AC `:5-11`）。
2. **Four-track separation:** Private Prototype、Streaming Demo Surface、Live2D Feature Proposal、Future Public Clean Subset は混同しない。Demo/proposal/public subset は private implementation の現在仕様・公開許可を意味しない（`modified_concept.md:40-49,66-123`）。
3. **Cubism boundary:** Cubism形式の読み書き・解析・変換・再構築、SDK/Core、既存Cubismモデル、公式/第三者素材、互換・代替主張は現在方針で禁止。既存Cubismレポートは private historical archive であり oracle ではない（`modified_concept.md:23-38`、Root AC `:65-77`）。
4. **Requirement vs implementation truth:** AC/scenario が要求・合否のオラクル、module/design が DTO/solver/cardinality の実装意味論、test design が証拠形式、reports は歴史・リスク文脈という責務分離を採用している（`source-of-truth-policy.md:79-128,179-194`）。Dynamics v3 は accepted design/Wave106 が現行実装正だが、Domain-09 AC/scenario本文には旧 one-output/scalar 文言が残り、追跡表現は未決である（`acceptance-criteria/.../209_...md:17-25`、`scenarios/.../209_...md:41-47`、root map `:32-33,78,93`）。
5. **Accepted Dynamics implementation:** `dynamics-file-v3` は世界系 Verlet chain、segment N≥1、複数 outputs、`worldFrameChainV1`、明示 `RuntimeStateDto`/sequence evidence。これはMVP scopeを変えず、旧v0を破壊的置換した実装意味論である（`dynamics-world-frame-chain.md:1-5,21-31,115-161,175-185`、Wave106 map `:22-32`）。
6. **Automation/boundary:** Editor/repo は提案生成、意味推論、semantic PSD分類、LLM埋め込み、auto-riggingを行わず、外部Codex/LLMからの明示入力を deterministic API、dry-run、diff、validation、承認、evidenceで受ける。改定二号は loopback 操縦チャネル/生理層を解禁し、LLM/知覚は `apps/soul` 特区内のみ許可、特区外は禁止（`codex-friendly-automation-policy.md:6-18,20-29,71-95`、`mvp-boundary-amendment.md:19-24,36-55`）。
7. **Current implementation evidence does not close product gates:** Product Preflight は10カテゴリ、`pass` と `not_evaluated`/`not_supported` を区別する契約を持つ（`packages/contracts/src/product-preflight-report.ts:16-35,88-111,387-465`）。Demoのrights-clean fixture、最終 disclaimer/UI、preflight運用、Proposal target、Domain-09 traceability、Future subset、legal archive restart は未決のままである（root map `:91-103`）。
8. **Workspace activity shape:** 2026-05 のconcept/convention整理、2026-06-24のEditor Wave102計画停止、2026-07-05のDynamics v3実装、2026-07-11の`apps/soul`境界改定/C4、2026-08-08のmap refreshという順に、製品方針→実装境界→現在入口が更新された（Git commits `129e292`, `121da75`, `d2e7b7e`, `356959c`, `3714fe3`, `140fb63`, `af58394`）。

## 3. What was built or investigated

### Product and requirements

- `modified_concept.md` が旧公開エコシステム方針を supersede し、Private Prototype を主対象に据えた。MVP中心問いは素材取り込み→編集→保存→runtime/viewer→validation/AI dry-run/diff/repair suggestion→demo-safe capture の一周である（`:1-5,7-21,125-146,162-191`）。
- Root Question/Root AC は4トラック、非互換・非依存、project-defined package、GUI制作、runtime/viewer、AI assistant の責任境界を記録する（`00_RootQuestion.md:7-41`、`01_RootAcceptanceCriteria.md:5-89`）。
- MVP AC は drawable/mesh/part/mask/parameter/keyform/rig control、Minimum Open Dynamics v1、保存・再読込、viewer、validator、AI assistant、demo-safe capture を列挙し、Cubism import/export・SDK/Core・direct vertex physics・cloth/collision/IK/timeline bake等をMVP外に置く（`03_MVP_Acceptance_Criteria.md:104-160,175-237`）。
- Domain AC/scenario の25 domainは Current / Optional / Future に分類され、rights/公開系は Futureまたはhygiene責務に分離されている（`acceptance-criteria/02_DomainAcceptanceCriteria/_map.md:18-42`、`scenarios/02_DomainAcceptanceCriteria/_map.md:20-44`）。

### Runtime semantics and evidence

- accepted Dynamics v3 design は旧 `additivePendulumV0` / `dynamics-file-v2` を、world-frame Verlet chain / `dynamics-file-v3` へ置換した。スキーマは inputs、chain、複数 outputs を持ち（`:115-161`）、Wave106 final review は ref-e2e 7/7、dynamics packages 27/27、editor/player 17/17、tsc exit 0 を記録する（`wave106-final-clean-integration-review.md:8-27`）。これらは当時の実装・レビュー evidence であり、人間製品受入の完了を意味しない。
- Current source は package schema に `segmentLengths.min(1)`、`outputs.min(1)`、`segmentIndex` を定義し（`packages/package-format/src/model-files.ts:175-211`）、Runtime state は粒子 `x,y,px,py`、tick、resetCounter、package identity、fixed timestep を持つ（`packages/contracts/src/runtime-state.ts:5-31`）。Solver source は設計式を直接参照する（`packages/runtime-core/src/dynamics-evaluation.ts:14-26`）。

### Demo / proposal / policy

- Demo policy は結果と高レベルUIのみ許可し、内部schema/state/solver、Cubism形式名・比較、第三者素材、法的安全の断言を避ける。capture前に rights/provenance、forbidden terms、redaction、表示範囲を確認する（`streaming-demo-policy.md:6-10,12-46,62-89`）。
- Proposal template は制作課題・UX要望・before/after観察を扱うが、互換実装、SDK/Core代替、既存モデル解析、法的/特許判断を提案しない（`live2d-feature-proposal-template.md:1-4,10-16,34-57,67-87`）。
- Accepted Demo/Rights/IP policy は、rights metadata/provenanceを全asset/fixture/demo artifactに要求し、preflightをcapture/publication/proposal export前に実行し、allow/blockと証拠参照を出す（`demo-rights-ip-policy.md:68-170`）。
- Accepted source-of-truth policy はAC/Scenario、Module Contract、Test Design、Development Convention、Review、Research、Demo/Proposalを別カテゴリとして扱い、reportsをimplementation/test/acceptance oracleにしない（`source-of-truth-policy.md:79-128,179-194`）。

## 4. Current repository state

| 観点 | 現在のrepo fact | 根拠 |
|---|---|---|
| Product package | Dynamics v3 model schema は world-frame chain、inputs/chain/outputs、segment N≥1、複数outputを表現する | `packages/package-format/src/model-files.ts:175-211` |
| Runtime evidence | `RuntimeStateDto` は package identity、fixedStep、dynamics particle state、tick/resetを持つ | `packages/contracts/src/runtime-state.ts:5-31` |
| Solver source | `dynamics-evaluation.ts` は accepted world-frame Verlet design を直接参照する | `packages/runtime-core/src/dynamics-evaluation.ts:14-26` |
| Graph contract | normalized graph は inputs、chain、複数 outputs を保持する | `packages/runtime-core/src/normalized-runtime-graph.ts:53-84` |
| Product Preflight | 必須カテゴリ10、statusは pass/warn/fail/not_supported/not_evaluated、artifactに rights/validation/runtime/demo readiness を含む | `packages/contracts/src/product-preflight-report.ts:16-35,88-111` |
| Soul boundary | 本repo走査は 1389 source files、器→魂/魂→器コード importなしで exit 0 | `node scripts/check-soul-zone-boundary.mjs` → `Soul zone boundary guard passed...` |
| Check pipeline | root `check` は typecheck、unit、deps、source、soul-zone を含む | `package.json:10-20` |
| Current maps | map refresh commit は requirement oracle/implementation semantics/未決gateを分離している | `discussion/_map.md:11-18,31-46,74-103`; commit `af58394` |

## 5. Accepted decisions and boundaries

### Product decisions

- Private 2D Rigging Lab / Prototype が主目的で、4トラックを分離する（`modified_concept.md:7-21,40-49`）。
- MVPは Private Authoring-to-Viewer Prototype。AIは inspect/explain/validate/dry-run/diff/repair suggestion/provenance を補助し、人間の制作承認を置き換えない（`00_RootQuestion.md:22-41`、`01_RootAcceptanceCriteria.md:49-63`）。
- Cubism互換・形式・SDK/Core・既存モデル・公式/第三者素材は採用しない（`modified_concept.md:23-38`）。
- Editor mainline は Wave102 を計画停止点とし、W103–109 は specialized evidence として扱う。これは製品方針/計画境界であり、後続 evidence の存在だけではEditor mainlineを再開しない（`discussion/_map.md:38,63-65`）。

### Automation and boundary decisions

- Editor/repoに semantic inference、proposal generation、auto-rigging、LLM/provider埋込みを持たせない。明示された deterministic operation と承認を正とする（`codex-friendly-automation-policy.md:6-18,20-29,52-69`）。
- 改定二号で loopback操縦チャネルと知性なし生理層を解禁。LLM/知覚は `apps/soul` 配下でのみ許可し、魂と器の相互コードimportは禁止、契約(JSON)越しのWSを使う（`mvp-boundary-amendment.md:13-24,36-55`、`apps/soul/README.md:1-14`）。
- Source-of-truth責務を単純な優先順位にせず、要求（AC/scenario）・実装意味論（module/design）・証拠（test design）・規約・歴史（reports）を分離する（`source-of-truth-policy.md:85-128`）。
- Demo/proposal は private implementation の内部形式や互換性を公開する場ではなく、rights/provenanceとredactionを先行させる（`demo-rights-ip-policy.md:70-170`）。

## 6. Verification and experiment evidence

### Re-run in this refresh

- Markdown link check（root + product/convention maps、URL encoded pathをdecode）: **9/9 PASS**、missing 0。
- `node scripts/check-soul-zone-boundary.mjs`: **PASS**。1389 source files scanned、器→魂/魂→器コード import なし。
- `node scripts/check-soul-zone-boundary-fixtures.mjs`: この環境では `spawnSync` child process 結果が `undefined` となり regression harness 自体が失敗（valid/invalid fixtureの期待出力未取得）。これは本体guardの直接実行失敗ではない。Wave C4の記録済みfixture self-testは別の実装時 evidence として保持する（`mvp-boundary-amendment.md:42-44`）。

### Existing evidence (not rerun here)

- Wave106 final clean review: ref-e2e 7/7、packages dynamics 27/27、editor/player dynamics 17/17、tsc exit 0、final判定 pass（`wave106-final-clean-integration-review.md:8-27`）。
- Product Preflight tests encode both all-category pass and missing-evidence `not_evaluated`; unsupported claims remain `not_supported` rather than being promoted to pass（`packages/validator-core/src/product-preflight-report.test.ts:27-107,110-150,350-380`）。
- Boundary amendment records C4 direction guard as 1243-file scan at its historical implementation point; current direct scan is 1389 files（`mvp-boundary-amendment.md:42-55`、this refresh command above）。

## 7. Historical progression / turning points

| Date | Commit | Product-policy turning point |
|---|---|---|
| 2026-05-27 | `129e292` | concept change: Private Prototype baselineへ移行 |
| 2026-05-28 | `121da75` | development convention 初稿。責務・source-of-truthを外部記憶化 |
| 2026-06-06 | policy record | Codex-friendly automation: repoは deterministic surface、推論/提案は外部 |
| 2026-06-24 | `d2e7b7e` | Editor Wave102まで到達。後の mainline planning stop の基点 |
| 2026-07-04〜05 | `356959c` + Dynamics design/Wave106 | Dynamics v3 world-frame chainを accepted/implemented。旧v0を破壊的置換 |
| 2026-07-10〜11 | `3714fe3`, `140fb63` | ai-cohost 境界改定二号と `apps/soul` 特区/C4 direction guard |
| 2026-07-12〜19 | `3eaf605`〜`a5e2d07` | S1–S8、chat/brain/reading/memory等の実装系列。残る安全・運用human gateは製品受入と分離 |
| 2026-08-08 | `af58394` | map refresh: requirement oracle、current implementation owner、specialized evidence、未決gateを再索引 |

## 8. Open gates, debts, and uncertainties

### Product / user / legal gates (未完了)

- **Domain-09 traceability:** profile-v2 / dynamics-file-v3 の cardinalityをAC/scenario本文へどう追跡表示するか。AC/scenario本文の旧 one-output/scalar は歴史的な要求記述として残っており、実装意味論との整合をユーザーが決める必要がある（`discussion/_map.md:32-33,78,93`、Domain-09 AC `:17-25`、scenario `:41-47`）。
- **Streaming Demo safety:** rights-clean fixture/capture scene、最終 disclaimer/UI wording、automated preflight の具体的範囲が未確定。Demo policy自体は法的安全を保証しない（`demo/streaming-demo-policy.md:8-10,35-46,85-89`、`demo-rights-ip-policy.md:121-170`）。
- **Proposal target:** 最初の機能、提出先、公開範囲、個別draftは未決（`proposal/_map.md:20-30`）。
- **Future Public Clean Subset:** 現在MVP外。必要時にscope、rights、dependency、表示範囲を別途再設計する（`modified_concept.md:102-123,185-191`）。
- **Cubism archive restart:** Cubism/旧性能資料を再利用する場合、permission/legal/scope reviewが先。archiveはruntime/acceptance oracleではない（`modified_concept.md:38`、`source-of-truth-policy.md:179-194`、root map `:101`）。
- **AI cohost product/human gates:** S8 kill/restore/no-regression、brain-swap rollout/choice、stream-memory privacy/OFF/auto-load、persona/S9 voice は実装存在と人間受入を分離して未完了（root map `:44,72,83,99`）。

### Implementation/evidence debts that must not be mistaken for product decisions

- Runtime Player W11/W20/W21/W22/W23 real-device/OBS/lifecycle/vowel gates、model-authoring PNG/portability、mesh GPU/pixel/Canvas sunset、Electron E2E/typecheck/unit、optional C7 captureは別topicの human/device/quality gate（root map `:66,68-71,79-82,94-98`）。
- Product Preflightの型・テストが存在しても、rights-clean実素材、最終disclaimer、external acceptance、human/device結果を自動的に完了へ昇格させない（`product-preflight-report.test.ts:110-150`）。
- `check-soul-zone-boundary-fixtures.mjs` の今回の再実行は child process spawn制限で失敗した。ソース走査guardは直接PASS。fixture harness再実行は環境変更後の確認課題であり、境界ポリシーを新規変更する根拠ではない。

## 9. Candidate next work（推奨ではなく、現在記録から導ける候補）

1. User decision後に Domain-09 AC/scenario本文と accepted Dynamics v3 design/Wave106 semantics の traceabilityを更新する。
2. Rights-clean fixture、capture scene、最終 disclaimer/UI文言、preflightの allow/block evidenceを揃え、Demo policyの未決を閉じる。
3. 最初の Live2D Feature Proposal の機能テーマ・提出先・公開範囲を決め、templateからdraftを作る。
4. Future Public Clean Subsetが必要になった時だけ、private prototypeと別のscope/rights/dependencyレビューを行う。
5. Cubism archiveや旧性能資料の再利用が必要なら、permission/legal/scope review後に historical evidence と current owner を分けて扱う。
6. S8/brain/stream-memoryなどの実装済みAI共演機能は、人間ゲート手順に従って安全・privacy・運用受入を確認する。
7. 実装判断では current implementation maps と accepted conventionsを先に読み、dated capability/backlogやhistorical reportsだけで新しいproduct semanticsを作らない。

## 10. Evidence index

| Evidence | 種別 | 結果 / 用途 |
|---|---|---|
| `discussion/_conventions.md:7-11,51-70` | Accepted convention | Private baseline、topic責務、情報種別の分離 |
| `discussion/_map.md:11-18,31-46,63-72,74-103` | Current map | oracle/implementation boundary、4 tracks、topic status、未決gate |
| `discussion/concept/modified_concept.md:7-21,23-49,125-170` | Accepted product baseline | Private Prototype、non-compat、4 tracks、MVP scope |
| `discussion/acceptance-criteria/01_RootAcceptanceCriteria.md:5-11,49-89` | Requirement oracle | package/runtime/editor/AI/Cubism/demo-proposal AC |
| `discussion/acceptance-criteria/03_MVP_Acceptance_Criteria.md:154-173,183-237` | Requirement oracle | MVP dynamics/runtime/validator/AI/demo-safe boundary |
| `discussion/design/dynamics-world-frame-chain.md:1-5,21-31,115-161,175-185` | Accepted design | v3 chain schema/solver/cardinality/reset/old-v0 replacement |
| `discussion/development_convention/source-of-truth-policy.md:85-128,179-194` | Accepted convention | responsibility model; reports/Cubism not oracle |
| `discussion/development_convention/testing-and-acceptance-policy.md:89-143` | Accepted convention | test/evidence mandatory; acceptance runner aggregation |
| `discussion/development_convention/demo-rights-ip-policy.md:70-170` | Accepted policy | demo/preflight/forbidden terms/redaction/rights/proposal boundary |
| `packages/package-format/src/model-files.ts:175-211` | Current source | v3 input/chain/output schema; N≥1 and multiple outputs |
| `packages/contracts/src/runtime-state.ts:5-31` | Current source | explicit RuntimeState particle/evidence identity |
| `packages/contracts/src/product-preflight-report.ts:16-35,88-111,387-465` | Current source | 10 categories, status vocabulary, evidence outcome constraints |
| `packages/validator-core/src/product-preflight-report.test.ts:27-150,350-380` | Test design/evidence | pass vs not_evaluated/not_supported semantics |
| `discussion/implementation/reviews/wave106/wave106-final-clean-integration-review.md:8-27` | Historical review evidence | v3 implementation/review pass, not human product acceptance |
| `node scripts/check-soul-zone-boundary.mjs` | Refresh command | 1389 files, no direction violations, PASS |
| `git log` / commits `129e292`, `121da75`, `d2e7b7e`, `356959c`, `3714fe3`, `140fb63`, `af58394` | Historical Git evidence | policy and boundary turning points |

## 11. Limitations

- 本報告は product policy 観点の bounded refresh であり、全repo、全wave、全source/testの再監査ではない。
- Wave106 review、Product Preflight tests、C4 fixture self-testの多くは既存記録を引用しており、このrefreshで全てを再実行していない。
- 今回再実行した `check-soul-zone-boundary.mjs` はPASSだが、fixture regression harness はsandboxのchild-process spawn制限で結果を取得できなかった。
- Demo rights、legal/permission、Expo acceptance、real-device/OBS/vowel、AI human gate は再確認していない。repo/mapに記録された未決状態を維持した。
- AC/scenario本文、maps、source、test、config、既存reportsは変更していない。新しいproduct decisionや法的判断は行っていない。
