# MVP Authoring-to-Viewer Design Map

> `discussion/design/mvp-authoring-runtime/` 直下の設計文書だけを示す地図。上位地図にはこのディレクトリだけを載せ、個別文書の詳細はここに委譲する。

## 位置付け

このディレクトリは、GUI Editor必須のAuthoring-to-Viewer MVPを実装へ進める前に固定すべき設計をまとめる。

MVPの正は `discussion/acceptance-criteria/03_MVP_Acceptance_Criteria.md` と `discussion/scenarios/03_MVP_Acceptance_Criteria.md` である。Cubism Editor / SDK / Core 関連レポートは、参考資料として反映するが、Private Prototype のオラクルとしては扱わない。

## 直下のファイル

| Path | Role | Status |
|---|---|---|
| [_map.md](_map.md) | この設計セットの入口地図 | Draft |
| [00-mvp-vertical-slice-architecture.md](00-mvp-vertical-slice-architecture.md) | Editor / Viewer / Preview / Runtime / Validator / AI assistant interface と shared runtime core の境界設計 | Draft |
| [01-open-model-package-design.md](01-open-model-package-design.md) | project-defined model package のファイル構成、stable ID、operation log、versioning、metadata、validation境界 | Draft |
| [02-gui-editor-screen-spec.md](02-gui-editor-screen-spec.md) | GUI Editor の画面領域、主要パネル、初心者導線、Editor-only state と runtime-visible state の分離 | Draft |
| [03-runtime-evaluation-semantics.md](03-runtime-evaluation-semantics.md) | Runtime評価pipeline、snapshot粒度、diagnostics severity、invalid state と unsupported feature の扱い | Draft semantics doc; dynamics v3 owner is linked below |
| [04-validator-acceptance-runner-design.md](04-validator-acceptance-runner-design.md) | Validator / Acceptance Runner の検出対象、Editor警告、runtime load test、AI-readable report の関係 | Draft |
| [05-ai-agent-interface-design.md](05-ai-agent-interface-design.md) | File-level / GUI-level / structured operation-level の3層AI連携と dry-run / diff / repair / revalidation 手順 | Draft |
| [06-self-review-and-open-questions.md](06-self-review-and-open-questions.md) | MVP AC / scenario / 参照レポートへの自己レビュー、残未決事項の分類 | Draft |

## 読む順序

1. [00-mvp-vertical-slice-architecture.md](00-mvp-vertical-slice-architecture.md)
2. [01-open-model-package-design.md](01-open-model-package-design.md)
3. [03-runtime-evaluation-semantics.md](03-runtime-evaluation-semantics.md)
4. [02-gui-editor-screen-spec.md](02-gui-editor-screen-spec.md)
5. [04-validator-acceptance-runner-design.md](04-validator-acceptance-runner-design.md)
6. [05-ai-agent-interface-design.md](05-ai-agent-interface-design.md)
7. [06-self-review-and-open-questions.md](06-self-review-and-open-questions.md)

## 設計セット全体の判断

- MVPは、GUI Editorで制作した project-defined model package を、同じShared Runtime evaluation coreでEditor previewとViewerが評価する縦切りとする。
- project-defined model package はAI-readableなテキスト中心のディレクトリ形式とし、stable ID、operation log、provenance、validation reportを同じID体系で接続する。
- Runtime core は package loader、authoring graph adapter、renderer、Editor UI stateから独立させる。
- Editor warning、Viewer diagnostics、Validator report、AI diff は同じ diagnostics vocabulary と check ID を共有する。
- AI assistant interface は、ファイル直接編集、GUI操作、構造化operationの3層を持つ。ただし正はoperation core / model core / validator coreであり、GUI操作や自然文応答ではない。
- `parameter-grid-2d-v1` はMVP採用済み。Dynamics v0/v2 の `scalarDampedFollowV1` / `dynamics-file-v2` は Wave106 で superseded され、現行の意味論・schema owner は [dynamics-world-frame-chain.md](../dynamics-world-frame-chain.md) の `worldFrameChainV1` / `dynamics-file-v3`。実装 evidence は [Wave106 map](../../implementation/waves/wave106/_map.md) を参照する。

## 実装状態（repository facts）

この設計セットの Draft status は、各 capability の実装済み範囲や未完了の visual/product gate を表さない。現在の evidence 入口は次のとおり。

| Capability | Current evidence | Remaining gate boundary |
|---|---|---|
| Canvas evaluation / overlay / hit-test | [Wave66](../../implementation/waves/wave66/_map.md) pass; `CanvasEvaluatedScene` 実装済み | pixel/visual parity は人間の visual gate |
| Validation / Diagnostics v0 | [Wave85](../../implementation/waves/wave85/_map.md) pass; read-only Diagnostics、badges、jump、inline diagnostics | full Evidence View の最終 surface は未決 |
| Runtime Export v0 | [Wave92](../../implementation/waves/wave92/_map.md) pass; contract、assembly/preflight、Editor task | browser picker / external player parity は非対象 |
| Variant Manager v0 | [Wave99](../../implementation/waves/wave99/_map.md) pass; package/evaluation/Canvas preview | final visual polish は別 gate |

## 未決事項の入口

実装前に決めるべき未決事項とPost-MVPでよい未決事項は、[06-self-review-and-open-questions.md](06-self-review-and-open-questions.md) に集約する。Wave106 の実装 pass は、AC/scenario の v3 traceability や human/visual acceptance gate を自動的に閉じるものではない。
