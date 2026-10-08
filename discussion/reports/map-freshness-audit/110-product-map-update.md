# Product map update report

> 基準点: Git HEAD `3c3669eefcc375c62d1ec6b4d77a000d7cbbb61c` / 2026-08-08 (Asia/Tokyo)。
> 所有範囲は product-baseline 系の `_map.md` のみ。AC/scenario本文、source、test、設定は変更していない。

## 1. 確認範囲と判定

確認した map は7件。監査 report `10-product-baseline.md` の判定と、子 map→親 map の順序に従って確認した。

| Map | 種類 | 監査判定 | 今回の扱い |
|---|---|---|---|
| `discussion/concept/_map.md` | living-current-state + living-index | Partially stale | 変更 |
| `discussion/acceptance-criteria/_map.md` | living-current-state + living-index | Partially stale | 変更 |
| `discussion/acceptance-criteria/02_DomainAcceptanceCriteria/_map.md` | living-index | Partially stale | 変更 |
| `discussion/scenarios/_map.md` | living-current-state + living-index | Partially stale | 変更 |
| `discussion/scenarios/02_DomainAcceptanceCriteria/_map.md` | living-index | Partially stale | 変更 |
| `discussion/demo/_map.md` | living-current-state + living-index | Current | 意図的に変更なし |
| `discussion/proposal/_map.md` | living-current-state + living-index | Current | 意図的に変更なし |

変更: 5、作成: 0、意図的に変更なし: 2。

## 2. 変更した記述と根拠

### 2.1 Product requirement oracle と実装意味論の分離

- `concept/_map.md:11` に、product requirement の正を `modified_concept.md` と Root/MVP AC と明記し、Dynamics の schema / solver / cardinality は accepted `dynamics-file-v3` design と Wave106 を実装意味論の参照先とした。
- `acceptance-criteria/_map.md:11,13,22,29` と `acceptance-criteria/02_DomainAcceptanceCriteria/_map.md:11,26` で、AC/Domain AC が要求・合否のオラクルであること、具体的な Dynamics semantics/cardinality は design/Wave106 の責務であることを明記した。
- `scenarios/_map.md:11,18,24,33` と `scenarios/02_DomainAcceptanceCriteria/_map.md:11,13,28` で、Root/MVP AC と scenario の要求境界を保持しつつ、solver/cardinality の現行正を accepted `dynamics-file-v3` design/Wave106へ移した。親 scenario map の「1 group = 1 output」を現行要約から除き、旧 one-output/scalar 文言を Current oracle として扱わない旨を記録した。

根拠は、要求側が `discussion/concept/modified_concept.md:3-5,172-190`、`discussion/acceptance-criteria/00_RootQuestion.md:7-26`、`discussion/acceptance-criteria/01_RootAcceptanceCriteria.md:5-11,65-89`、`discussion/acceptance-criteria/03_MVP_Acceptance_Criteria.md:7-23,25-50` であること、実装意味論側が `discussion/design/dynamics-world-frame-chain.md:21-31,140-150,175-185` と `discussion/implementation/waves/wave106/_map.md:18,22-33` であることによる。Repository fact として `packages/contracts/src/runtime-state.ts:5-20,22-30`、`packages/runtime-core/src/dynamics-evaluation.ts:14-20`、`packages/runtime-core/src/normalized-runtime-graph.ts:53-75` も照合した。

これは MVP scope の変更ではない。旧 one-output/scalar 文言を含む AC/scenario本文は今回の所有範囲外なので編集せず、mapには source-sync gap として扱う導線だけを追加した。

### 2.2 古い「実装着手時」 next action の修正

- `concept/_map.md:22`
- `acceptance-criteria/_map.md:33,41`
- `acceptance-criteria/02_DomainAcceptanceCriteria/_map.md:46`
- `scenarios/_map.md:37`
- `scenarios/02_DomainAcceptanceCriteria/_map.md:48`

「まだ実装を始めていない」と読める表現を、実装済み成果との contract/test traceability を照合し、未達・再設計・人間ゲートを列挙する現在の action に置き換えた。根拠は Wave23 までの実装/レビュー到達と Wave106 の accepted/implemented 状態（`discussion/implementation/_map.md:79-82,118`、`discussion/design/_map.md:27`、`discussion/implementation/waves/wave106/_map.md:18,22-33`）である。

### 2.3 未決 gate の保持

AC/scenario map に `Domain-09` の v3 semantics/cardinality を要求本文へいつ・どう追跡するかというユーザー判断を追加した（`acceptance-criteria/_map.md:44`、`acceptance-criteria/02_DomainAcceptanceCriteria/_map.md:56`、`scenarios/_map.md:48`、`scenarios/02_DomainAcceptanceCriteria/_map.md:58`）。これは実装 pass を未達に戻すものではない。

既存の次の gate は変更していない。

- Demo rights-clean fixture / capture scene / 最終 disclaimer（`demo/_map.md:22-30`）。
- Proposal の最初の機能、提出先、公開範囲（`proposal/_map.md:22-30`）。
- Future Public Clean Subset、authoring/runtime format、RigControl の設計未決（`concept/_map.md:26-32`）。
- Cubism は private research archive / 非対応説明のまま（`scenarios/_map.md:31,46`、`scenarios/02_DomainAcceptanceCriteria/_map.md:13,56`）。

## 3. 変更しなかった map

`discussion/demo/_map.md` と `discussion/proposal/_map.md` は監査判定どおり Current。Demo policy の high-level hygiene と rights/disclaimer gate、Proposal template の互換実装を示さない境界と user decision は正しく、今回の correction は不要だった。

## 4. `apps/soul` 境界の所有範囲

AI の特区例外は product-baseline map の所有外であり、`discussion/ai-cohost/concept/_map.md:9` の「特区外では禁止」への修正は行っていない。正本は `discussion/ai-cohost/concept/mvp-boundary-amendment.md:46-52` と `apps/soul/README.md:1-28`。AI map owner は「repo全体禁止」ではなく **特区外禁止** と記録する必要がある。

## 5. 検証

- 所有7 map の相対 Markdown link 検査（URL encoded path を decode）: 7/7 PASS、missing 0。
- `git diff --check -- discussion/concept/_map.md discussion/acceptance-criteria/_map.md discussion/acceptance-criteria/02_DomainAcceptanceCriteria/_map.md discussion/scenarios/_map.md discussion/scenarios/02_DomainAcceptanceCriteria/_map.md discussion/demo/_map.md discussion/proposal/_map.md`: PASS（改行コードの既存警告のみ）。
- map/source/test の追加実行はしていない。人間デバイス、demo/legal、Dynamics v3 の要求文面裁定は未実施。

## 6. 残課題（所有外）

- AC/scenario本文の旧 one-output/scalar semantics を、ユーザーが決めた v3 traceability 方針に従って更新する作業。
- `discussion/ai-cohost/concept/_map.md` の `apps/soul` 境界文言（特区外禁止）。
- 親 `discussion/_map.md` への反映は、契約どおり本 report と全 child map 更新後に root owner が行う。
