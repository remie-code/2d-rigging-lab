# Product-baseline map freshness audit

基準点: Git HEAD `3c3669eefcc375c62d1ec6b4d77a000d7cbbb61c` / 2026-08-08 (Asia/Tokyo)。
対象は product-baseline 系の `_map.md` のみ。既存 map、source、test、設定は変更していない。

## 1. 担当範囲と実確認 map 一覧

確認した map は次の7件である（各 map の Markdown 相対リンクも機械確認し、missing なし）。

- `discussion/concept/_map.md`
- `discussion/acceptance-criteria/_map.md`
- `discussion/acceptance-criteria/02_DomainAcceptanceCriteria/_map.md`
- `discussion/scenarios/_map.md`
- `discussion/scenarios/02_DomainAcceptanceCriteria/_map.md`
- `discussion/demo/_map.md`
- `discussion/proposal/_map.md`

リンク検証 command: PowerShell の `[regex]::Matches(..., '\\[[^\\]]+\\]\\(([^)]+)\\)')` と `Test-Path`。結果は 7/7 `PASS`（それぞれ 2, 7, 26, 3, 30, 4, 2 links）。

## 2. 判定一覧

| Map | 種類 | 判定 | 要点 |
|---|---|---|---|
| `concept/_map.md` | `living-current-state` + `living-index` | **Partially stale** | Private baseline、4-track、未決事項、リンクは正しい。一方「実装着手時」を次 action とする表現は、既に実装 wave が進行・完了している基準点では古い。 |
| `acceptance-criteria/_map.md` | `living-current-state` + `living-index` | **Partially stale** | Root/MVP/Domain の入口と Private baseline 方針は正しい。`実装着手時` の next action が古く、下位 Dynamics AC の旧 cardinality/solver 前提を Current として集約している。 |
| `acceptance-criteria/02_DomainAcceptanceCriteria/_map.md` | `living-index` | **Partially stale** | 25 domain の列挙と Current/Optional/Future の分類は実在ファイルと一致。DOMAIN-09 を Current とする要約は大枠では正しいが、子 AC の one-output/旧 solver 詳細は Wave106 で supersede されており、next action も実装前提のまま。 |
| `scenarios/_map.md` | `living-current-state` + `living-index` | **Partially stale** | Root/MVP の境界、Cubism archive、demo/proposal 分離は正しい。`1 group = 1 output` の要約と `実装時` next action は現行 accepted design/repo と不一致。 |
| `scenarios/02_DomainAcceptanceCriteria/_map.md` | `living-index` | **Partially stale** | 25 scenario の列挙と Current/Optional/Future 分類は一致。Dynamics scenario を Current とする status は大枠で正しいが、Wave106 semantic replacement を案内せず、実装前提の next action が古い。 |
| `demo/_map.md` | `living-current-state` + `living-index` | **Current** | Policy の対象、MVP AC/scenario との責務分離、high-level Dynamics hygiene、rights/disclaimer の未決事項が本文と一致。Product Preflight の実装は進んでいるが、demo-specific capture fixture、最終 disclaimer、policy 文言の自動検査は未決なので next actions は有効。 |
| `proposal/_map.md` | `living-current-state` + `living-index` | **Current** | Template の current baseline、互換実装を示さない境界、draft 作成と提出先/最初の機能の user decision が本文と一致。 |

**Verdict counts:** Current 2 / Partially stale 5 / Stale 0 / Intentionally historical 0 / Unverifiable 0。

## 3. Accepted product/policy decisions（repository 実装とは分離）

次は「現在のプロダクト方針・受け入れ判断」であり、コード実装の完了を意味しない。

- Private 2D Rigging Lab / Prototype が主目的で、Cubism 互換/SDK/Core/既存モデル読み込みを行わず、Streaming Demo Surface、Live2D Feature Proposal、Future Public Clean Subset を分離することは、`discussion/concept/modified_concept.md:3-5, 7-21, 23-38, 40-49`、Root question `discussion/acceptance-criteria/00_RootQuestion.md:7-26`、Root AC `discussion/acceptance-criteria/01_RootAcceptanceCriteria.md:5-11, 65-89` で確認できる。
- MVP の中心は Private Authoring-to-Viewer Prototype で、GUI editor、private runtime/viewer、project-defined package、validator、AI dry-run/diff/repair suggestion、demo-safe capture を含む方針は `discussion/acceptance-criteria/03_MVP_Acceptance_Criteria.md:7-23, 25-50` と `discussion/scenarios/03_MVP_Acceptance_Criteria.md:6-26` にある。
- Demo は実装仕様ではなく high-level hygiene であり、互換/形式/solver 詳細を出さない方針は `discussion/demo/streaming-demo-policy.md:3-10, 12-33, 35-60`。Proposal も互換実装・SDK/Core 代替・既存解析ではない template である（`discussion/proposal/live2d-feature-proposal-template.md:3-4, 10-16, 43-57, 67-81`）。
- `memo/new_concept.md` は入力メモで、Current baseline の正は `discussion/concept/modified_concept.md:3-5, 172-190` に反映済み。従って acceptance map の `memo/new_concept.md` 参照自体はリンク切れではないが、判断根拠としては modified concept/Root AC を優先する。

## 4. Stale / 疑わしい記述と replacement truth

### 4.1 「実装着手時」の next action

次の5 map 行は、実装をまだ始めていないように読める。

- `discussion/concept/_map.md:20`
- `discussion/acceptance-criteria/_map.md:33`
- `discussion/acceptance-criteria/02_DomainAcceptanceCriteria/_map.md:46`
- `discussion/scenarios/_map.md:37`
- `discussion/scenarios/02_DomainAcceptanceCriteria/_map.md:48`

これは product decision ではなく map の current-state/navigation claim であり、基準点では **Partially stale**。少なくとも Wave23/39 は完了記録があり（`discussion/implementation/_map.md:79-82, 118`）、Dynamics は Wave106 で accepted/implemented になっている（`discussion/design/_map.md:27`、`discussion/implementation/waves/wave106/_map.md:18, 22-33`）。

**Replacement truth:** 「実装着手時に落とす」ではなく、Current/Future domain の contract/test traceability を実装済み成果と照合し、未達・再設計・human gate を列挙する状態。これは repository fact（implementation maps/source/tests）であり、MVP 方針そのものを変更しない。

### 4.2 Dynamics の one-output / scalar solver 要約

`discussion/scenarios/_map.md:33` は「Dynamics scenario = initial/final RuntimeState evidence、**1 group = 1 output**、validation、demo-safe capture」と要約する。しかし、後続の accepted design はこの詳細を破壊的に置換している。

- 旧 product AC/scenario: `discussion/acceptance-criteria/02_DomainAcceptanceCriteria/209_Physics_and_Dynamic_Behavior.md:17-25`、`discussion/scenarios/02_DomainAcceptanceCriteria/209_Physics_and_Dynamic_Behavior.md:41-47, 67-73`（one output、`scalarDampedFollowV1`、computed output parameter への parameter-driven semantics）。
- 新 accepted design: `discussion/design/dynamics-world-frame-chain.md:1-5, 21-31, 140-150, 175-185`（`dynamics-file-v3` world-frame Verlet chain、outputs 複数解禁、`worldFrameChainV1` 等への置換）。Wave106 map と final clean review も全層置換・pass を記録している（`discussion/implementation/waves/wave106/_map.md:18, 22-33`、`discussion/implementation/reviews/wave106/wave106-final-clean-integration-review.md:8-12, 20-27`）。
- Current repository fact: `packages/contracts/src/runtime-state.ts:5-20, 22-30` は粒子 (`x,y,px,py`) state を定義し、`packages/runtime-core/src/dynamics-evaluation.ts:14-20` は world-frame Verlet chain を直接実装仕様として参照する。`packages/runtime-core/src/normalized-runtime-graph.ts:53-75` は chain と複数 `outputs` を表す。

**Replacement truth:** Dynamics が MVP であること、明示 `RuntimeStateDto`/snapshot/next-state evidence、determinism、Cubism 非互換という大枠は維持される。しかし solver/cardinality/evidence の具体的正は `discussion/design/dynamics-world-frame-chain.md` と Wave106 実装であり、旧 one-output/scalar 文言は scenario/AC から supersede 注記または更新が必要。

この drift は product scope の変更ではなく、accepted implementation design の更新を product AC/scenario に反映し損ねた source-sync gap。`acceptance-criteria/_map.md:22, 29` と `acceptance-criteria/02_DomainAcceptanceCriteria/_map.md:26` は子文書を Current と表示するため、間接的に古い詳細を current と誤認させる可能性がある。したがって両 map は **Partially stale** とした。

### 4.3 Scenario source-of-truth の案内不足

`discussion/scenarios/02_DomainAcceptanceCriteria/_map.md:13` は scenario の正を concept/Root AC/MVP AC に限定し、後続 accepted Dynamics design への導線を示さない。Root/MVP が product acceptance oracle であること自体は正しいが、実装意味論・schema/cardinality の照合先として `discussion/design/dynamics-world-frame-chain.md` が必要である。

これはリンク欠落ではなく cross-topic guidance gap。親 map 統合では、AC/scenario（要求・合否）と accepted design/module contract（実装意味論）を区別したうえで supersession を明記すべきである。

## 5. Current repository facts checked

- Product Preflight はすでに Wave39/41 で実装・review 済み（session-generated/read-only boundary を含む）。`discussion/implementation/_map.md:79-82`、`discussion/implementation/reviews/wave39/wave39-clean-integration-review.md:9, 149-152`、`discussion/implementation/reviews/wave41/wave41-clean-integration-review.md:79-86, 135-144`。
- Product Preflight contract は `demoSafePreflight` artifact kind と `unsupportedClaims` category を持つ（`packages/contracts/src/product-preflight-report.ts:16-35, 88-108, 138-145, 217-219, 395-462`）。これは demo policy 全項目（実素材の最終選定、最終 disclaimer、画面に出る全文言の法的レビュー）が完了したことを意味しない。
- Runtime evidence は operation result に runtime snapshot/state/sequence refs と final state を持つ（`packages/operation-core/src/operation-evidence-result.ts:18-26`）。従って RuntimeState evidence という product map の大枠は生きているが、旧 artifact/cardinality 文言の精密な正は Wave106 design に依存する。
- 7 map の子ファイル列挙は実ディレクトリと一致し、リンク切れはなかった（上記 machine check）。

## 6. Parent map へ反映すべき短い結論

1. Product baseline の4-track境界、MVP scope、Demo/Proposal hygiene は Current。`concept/_map.md`、`demo/_map.md`、`proposal/_map.md` は broad policy では生きている。
2. Acceptance/Scenario maps は入口として機能するが、5 map の「実装着手時」next action を現行実装・未達追跡へ更新する必要がある。
3. 最重要の cross-topic gap は Dynamics。`scenarios/_map.md:33` と Domain-09 の子本文が one-output/`scalarDampedFollowV1` を Current と読ませる一方、Wave106 accepted design/repo は world-frame Verlet chain (`dynamics-file-v3`, multi-output) である。AC/scenario と design/module-contract の責務を分けた supersession 注記を親統合へ申し送る。
4. Demo map の broad status は Current だが、Product Preflight 実装済みと demo-specific open items（rights-clean fixture、最終 disclaimer、UI文言自動検査）を混同しない。

## 7. Unresolved points / user decisions

- Dynamics v3 の semantics/cardinality を、Root/MVP AC と Domain-09/Domain scenario にいつ・どの粒度で反映するか（文書更新は監査後のユーザー合意が必要）。
- 「実装着手時」の next action を、traceability gap・未実装 Current domain・human gate のどれに置き換えるか。
- Demo capture に使う rights-clean fixture、最終 disclaimer、preflight が UI 文言・内部形式名まで自動検査する範囲は、`discussion/demo/streaming-demo-policy.md:85-89`、`discussion/scenarios/03_MVP_Acceptance_Criteria.md:173-177` の未決事項である。
- 最初の Live2D proposal 機能、提出先、公開範囲は未決（`discussion/proposal/_map.md:20-30`、template `:83-87`）。

## 8. 調査できなかった範囲 / 注意

- 本報告は product map と直接の根拠文書、および Dynamics/Preflight の限定的な source/review facts の監査であり、全 implementation wave、全 design、全 runtime-player 境界の網羅監査ではない。
- Git worktree の既存変更（`.codex/agents/*`、`discussion/expo.zip`、context-check skill、reports map）には触れていない。
- 法務・特許の安全性、rights-clean 素材の実際の権利状態、最終 demo capture の人間判断は検証対象外である。
