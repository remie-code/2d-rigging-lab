# Design Parent Map Update Report

> 2026-08-08 の `map-update-contract.md` Phase 2。子 map の更新後に、`discussion/design/_map.md` だけを親 map として刷新した。non-map design docs、source、tests、他トピックの map は変更していない。

## 1. 確認した入力

親 map の更新前に、次の契約・統合レポートと child map を照合した。

- `map-update-contract.md`
- `11-design-and-conventions.md`
- `62-cross-topic-integration.md`
- `90-root-map-integration.md`
- `111-design-ui-map-update.md`
- `112-mesh-render-perf-map-update.md`
- `design/canvas-evaluation/_map.md`
- `design/mesh-generation/_map.md`
- `design/mesh-rendering/_map.md`
- `design/texture-atlas/_map.md`
- `design/module-contracts/_map.md`
- `design/mvp-authoring-runtime/_map.md`
- `design/screen-design/_map.md` / `screens/_map.md`

## 2. 変更範囲

| 区分 | 件数 | Path |
|---|---:|---|
| Changed map | 1 | `discussion/design/_map.md` |
| Created report | 1 | 本ファイル |
| Intentionally unchanged | child mapsは既にPhase 1で更新済み | `design/**/_map.md`（本 report の入力として参照のみ） |

## 3. 親 map で置換した claim

### Decisions / owners

- Dynamics の current owner を `dynamics-world-frame-chain.md` の `worldFrameChainV1` / `dynamics-file-v3` に変更した。旧 `scalarDampedFollowV1` / `dynamics-file-v2` は superseded と明示し、AC/scenario の v3 traceability は未決の user decision として残した。
- Mesh は `auto-outline-v6d-adaptive-contour-constrainautor` を default、`auto-outline-v7-margin-contour` を比較用 toggle とし、往復2の「一長一短」品質 hold と Wave 2/v6削除未承認を親要約へ反映した。
- Mesh rendering は Wave67 の WebGL2 foundation と Wave108/109 の Option E・`contentInset`/`uvRect` 契約を implemented とした。Texture Atlas は Wave101 の `single-page-skyline-v1` default と shelf artifact 読み取り互換へ更新した。

### Repository facts

- Canvas evaluation の `CanvasEvaluatedScene`、evaluated mesh、overlay、hit-test は Wave66 implemented boundary とした。
- Validation / Diagnostics v0 (Wave85)、Runtime Export v0 (Wave92)、Variant Manager v0 (Wave99) を implemented authoring surfaces として一行にまとめ、full Evidence/Codex、browser/external-player parity、final visual polish は別 gate に分離した。
- `module-contracts` と `mvp-authoring-runtime` は child map の current evidence/gate boundary を参照する親 index として状態を更新した。設計文書の Draft/Accepted と実装 pass を同一視していない。
- child map と Wave evidence が示す既存 contract/test の実装状態を踏まえ、不足がある場合だけ fixture gap を補う、という next action に更新した。旧「実装着手時に module contract/tests へ落とす」は削除した。

## 4. 残す decisions / gates

- Private Prototype baseline、Cubism exclusion、shared private runtime core、外部 Codex/LLM の accepted operation boundary、Demo/Proposal の分離を維持した。
- 実 GPU/readPixels または同等の pixel oracle による WebGL2/Canvas2D parity、Canvas2D sunset、Atlas Runtime の透明 margin・cross-bleed・LINEAR端 AA、`original` inset 再現、v6/v7 quality/toggle lifetime は自動 pass に昇格せず human/device gate とした。
- Full Diagnostics/Evidence/Codex の最終 placement、task/window policy、visual accessibility、Runtime Export の browser picker / external-player parity は product decision/gate として残した。
- Wave106 は dynamics/schema semantics replacement であり、render-performance 改善の証拠ではない。Wave54-era skeleton を current UI の正本へ戻さない方針も保持した。

## 5. 検証

- `git diff --check -- discussion/design/_map.md discussion/reports/map-freshness-audit/120-design-parent-update.md`：whitespace error なし（既存の CRLF/LF 警告のみ）。
- 親 map から参照する child map、Dynamics owner、Wave66/85/92/99/101/106/108/109 evidence の相対リンクを `Test-Path` で確認した（missing 0）。
- `design/_map.md` と本 report の Markdown 相対リンクを regex + `Test-Path` で走査した（missing 0）。
- `git status --short -- discussion/design/_map.md discussion/reports/map-freshness-audit/120-design-parent-update.md` で assigned map と本 report のみが今回の対象として見えることを確認した（他 agent の既存変更は保持）。
- source/test/human-device/GPU/visual の再実行はしていない。child reports の pass は as-of-wave evidence として扱った。

## 6. 所有範囲外の残課題

- AC/scenario の `dynamics-file-v3` cardinality/traceability、implementation/runtime/report parent maps、`discussion/_map.md` root integration は各 owner の更新対象である。
- v6/v7 quality re-evaluation、Wave108 formal atlasRuntime visual gate、GPU/pixel parity、Canvas2D sunset、Diagnostics/Evidence/Codex product surface、Runtime Player の実機 gate は本 parent map では裁定していない。

## 7. Semantic review correction (N-02)

`131-map-update-semantic-review.md` の N-02 に対応し、`design/_map.md` の Wave107 nearest-reference / single-winner 行を **Historical specialized evidence / superseded for live mapping** と明示した。現行 live semantics は Wave22/23 の mouth-open coupling と normalized five-vowel blend が owner であり、Wave22/23 の real-device speech/vowel gate は未完了のまま保持した。Wave107 の行を current mapping oracle として読まないための wording-only correction で、実装・設計判断・gate 状態は変更していない。

Correction verification: assigned map/report の相対リンク再走査は missing 0、`git diff --check -- discussion/design/_map.md discussion/reports/map-freshness-audit/120-design-parent-update.md` は whitespace error なし（CRLF/LF warning のみ）。
