# Design / UI Map Update Report

> 2026-08-08 の map-update-contract に従う Phase 1 更新。担当 map とこの report だけを編集し、実装 source・test・non-owned map は変更していない。

## 1. 所有 map の確認

確認した所有範囲は 6 map。

- `discussion/design/module-contracts/_map.md`
- `discussion/design/mvp-authoring-runtime/_map.md`
- `discussion/design/screen-design/_map.md`
- `discussion/design/screen-design/components/_map.md`
- `discussion/design/screen-design/screens/_map.md`
- `discussion/development_convention/_map.md`

## 2. 変更・未変更

| 区分 | 件数 | Path |
|---|---:|---|
| Changed | 5 | `design/module-contracts/_map.md`, `design/mvp-authoring-runtime/_map.md`, `design/screen-design/_map.md`, `design/screen-design/screens/_map.md`, `development_convention/_map.md` |
| Intentionally unchanged | 1 | `design/screen-design/components/_map.md`（component index として current。今回の stale claim 対象なし） |
| Created | 1 | 本 report |

`discussion/design/_map.md`、mesh-generation / mesh-rendering child maps、その他の非所有 map は変更していない。

## 3. 置換した claim と evidence

### Decisions / current owners

- `scalarDampedFollowV1` / `dynamics-file-v2` を current contract として扱う wording を、Wave106 の破壊的置換後の `worldFrameChainV1` / `dynamics-file-v3` に更新した。詳細の設計 owner は [dynamics-world-frame-chain.md](../../design/dynamics-world-frame-chain.md)、実装 owner/evidence は [Wave106 map](../../implementation/waves/wave106/_map.md)。旧 scalar は historical/superseded と明示した。
- MVP map と module-contracts map の Draft/Accepted status を実装 pass と混同しない注記を追加した。MVP AC/scenario の v3 traceability は別の user/design decision として残した。

### Repository facts

- Canvas の `CanvasEvaluatedScene` / evaluated rendering / overlay / hit-test は [Wave66 map](../../implementation/waves/wave66/_map.md) を current evidence として追加した。
- read-only Diagnostics v0（badges、jump、inline diagnostics）は [Wave85 map](../../implementation/waves/wave85/_map.md) pass として screens/module/MVP map に反映した。full Evidence View は未実装・未決として分離した。
- Runtime Export v0 の contract、assembly/preflight、Editor task は [Wave92 map](../../implementation/waves/wave92/_map.md) pass として反映した。browser picker / external player parity は対象外として残した。
- Variant Manager v0 の package/evaluation/Manager UI/Canvas preview は [Wave99 map](../../implementation/waves/wave99/_map.md) pass として反映した。final visual polish は別 gate とした。
- Screen map の Mesh wording は V2/V2.5/V2.6 を historical experiment/sidecar、v6d default + v7 comparison toggle を current implementation fact として整理した。

### Stale next steps / missing index

- `module-contracts` の「fixture実体を作る」は、既存 fixtures/tests を照合し不足時だけ補う action に限定した。
- `screen-design` の Wave57/58 起点の「Mesh/Atlas/Parameter/Variant を実装へ昇格」「Diagnostics を再設計」は、実装済み v0 と full-surface/product gate に置換した。
- 存在しない `discussion/design/screen-design/inventories/_map.md` のリンクを削除し、現行 map として再作成せず audit report を参照する注記にした。
- `development_convention` の `wave48-plan.md` を current next wave とする記述を、implementation/current-capability/backlog/orchestration の current routing に置換した。

## 4. 保持した decisions / gates

- Private baseline、four tracks、Wave102 Editor mainline stop、Cubism exclusion、Wave106 が semantics replacement で performance claim ではないことは変更していない。
- full Diagnostics/Evidence・Codex/Automation surface placement、real GPU/pixel parity、Canvas2D sunset、v6/v7 quality hold/toggle lifetime、PSD preview clarity、visual accessibility、Runtime Export browser/external-player parity は未完了の human/visual/product gate として明示した。
- E2E は状態・主要導線の oracle、layout/pixel/visual quality は human visual check という既存境界を維持した。

## 5. 検証

- Owned map 相対リンク検査（PowerShell `Test-Path`、6 map）: **0 missing links**。特に削除した `inventories/_map.md` へのリンクは残っていない。
- `git diff --check -- discussion/design/module-contracts/_map.md discussion/design/mvp-authoring-runtime/_map.md discussion/design/screen-design/_map.md discussion/design/screen-design/components/_map.md discussion/design/screen-design/screens/_map.md discussion/development_convention/_map.md discussion/reports/map-freshness-audit/111-design-ui-map-update.md`: **pass**（CRLF warning のみ、whitespace error なし）。
- 実装 source/test の再実行は行っていない。Wave66/85/92/99/106 final maps/reports を evidence として参照した。

## 6. 所有範囲外の残課題

- `discussion/design/_map.md` 親 map の更新、mesh-generation / mesh-rendering child map の更新、AC/scenario の v3 traceability は各 owner の child-before-parent 更新待ち。
- Wave108/109 の formal visual gate、real GPU/pixel proof、Canvas2D sunset、full Diagnostics/Evidence/Codex UI の product placement はこの report では裁定していない。
- `discussion/design/screen-design/components/_map.md` の child component docs が Draft のまま実装事実を含む場合の status policy は未決。
