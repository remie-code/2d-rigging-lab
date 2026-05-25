# Initial Design Decisions and Open Questions

> MVP更新後の設計10項目に対するユーザー判断、委任範囲、要調査・要議論事項を記録する。

## 1. 位置付け

この文書は、GUI Editor 必須の Authoring-to-Runtime MVP を前提に、設計で決めるべき10項目への初期コメントを外部記憶として保持する。

`_map.md` には要約だけを置き、詳細な判断、委任範囲、未決事項はこの文書で管理する。

## 2. 設計判断

### 2.1 MVP縦切りアーキテクチャ

- Editor と Viewer は同一アプリ内機能とする。
- Validator は、MVPでは Editor 内警告ができれば十分とする。
- Runtime は Editor preview と Viewer で同じ実装を使うかどうかを、保守性、再利用性、整合性などの品質特性から検討し、あるべき姿を採用する。

### 2.2 Open Model Package

- package内ファイル構成は、単一責務の原則を尊重する。
- ただし、保守性を高めるための設計側の工夫は縛りすぎない。
- Operation log は、Open Source 化と検証可能性を考えると組み込む方向とする。
- その他の詳細観点は、エージェントに設計判断を委任する。

### 2.3 GUI Editor操作モデル

- 現時点の操作モデル案に大きな不満はない。
- ただし、設計成果物として成立させるには「画面仕様として何を決めるべきか」を深掘りする必要がある。

### 2.4 Drawable / Mesh / Texture / Part

- 基本的な詳細設計はエージェントに委任する。
- MVPに含めるかどうかは作業量だけで判断しない。
- その要素をMVP内で扱うことで、後から追加機能を実装する際の大きな変更を避けられるかを判断基準にする。

### 2.5 Parameter / Keyform

- デフォルトparameterは、基本的に Cubism Editor のデフォルトまたは標準に準拠する方針とする。
- 標準parameterは必須に近い位置付けとする。
- 初心者が標準parameter体系を一から構築する前提にはしない。

### 2.6 Validator / Acceptance Runner

- MVPでは、解析的に判定可能な不可解状態を検出できることを中心にする。
- 例: 表示されているのに texture atlas に配置されていない要素がある、など。

### 2.7 Deformer相当構造

- deformer相当構造に関する調査レポートは、設計時の参考資料として十分と判断する。
- MVPでは、rotation相当を pivot付き2D transform / affine node とする方向を採用する。
- MVPでは、warp相当を 2D control lattice deformation node とする方向を採用する。
- warp補間は `bilinear-grid-v1` から始める方針とする。
- ただし、Open Model Package には `interpolationMethod` または同等の evaluator version を持たせ、将来 Bezier / bicubic などの補間方式を追加できるようにする。
- warp の bind space は、暫定的に deformer local rest space を第一候補とする。
- 評価順序は、parameter 値を決め、keyform補間で各deformer状態を決め、deformer treeを親から子へ評価し、drawable mesh、clipping / mask、opacity / visibility / draw order を解決する方向を採用する。

### 2.8 Viewer / Preview

- Viewer / Preview に関する調査レポートは、設計時の参考資料として十分と判断する。
- Editor と Viewer は同一アプリ内機能とする方針を維持する。
- Editor preview と Viewer は、同じ Shared Runtime evaluation core を共有する方向を採用する。
- ただし、Editor preview は制作中の dirty authoring state、selection、lock、hide、overlay、warning を扱う制作支援面とする。
- Viewer は保存済み Open Model Package を runtime として読み込み、parameter操作、runtime snapshot、diagnostics、package load確認を行う確認面とする。
- Editor-only production support state と runtime-visible model state を混同しないことを設計原則にする。

### 2.9 AI Agent 接続方式と技術スタック

- AI Agent 接続方式は、技術スタックと合わせて検討する。
- MVPの第一候補技術スタックは Web-first TypeScript とする。
- AI連携は File-level、GUI-level、Structured API-level の3層で考える。
- Open Model Package がAI-readableであれば、Codexなどによるファイル直接編集が最下層のAI連携になる。
- Web-first GUIであれば、PlaywrightなどによるGUI操作が第二層のAI連携になる。
- REST / WebSocket / MCP / in-process command bus などによる構造化operationを第三層のAI連携として設計する。
- 編集処理の正はGUIイベントハンドラではなく、shared operation core / model core / validator core に置く。
- 詳細は [ai-agent-connection-and-technology-stack.md](ai-agent-connection-and-technology-stack.md) を参照する。

## 3. 委任範囲

| 項目 | 委任内容 |
|------|----------|
| Open Model Package詳細 | 単一責務とOperation log方針を守りつつ、ファイル構成、versioning、migration、metadataなどは設計側に委任 |
| Drawable / Mesh / Texture / Part詳細 | 将来変更回避を判断基準に、具体表現とMVP採否を設計側に委任 |
| Runtime実装共有方針 | 品質特性を検討し、Editor preview / Viewer 間であるべき構成を提案する |

## 4. 要調査事項

| 項目 | 理由 |
|------|------|
| Deformer相当構造の技術的正体 | 調査済み。`discussion/reports/deformer-structure-technology/` を参照 |
| Viewer / Preview のCubism参照機能 | 調査済み。`discussion/reports/viewer-preview-reference/` を参照 |

## 5. 要議論事項

| 項目 | 論点 |
|------|------|
| AI Agent 接続方式 | Editorに接続するのか、packageに対して外部処理するのか。技術スタックと合わせて検討する |
| Runtime評価セマンティクス | ユーザーの解像度を上げたうえで、評価順序、state snapshot、diagnostics、invalid modelの扱いを決める |
| GUI Editor画面仕様 | 操作モデルに加えて、画面領域、パネル、canvas、properties、timeline外のpreview、warning表示など、何を設計完了条件にするか決める |
| AI Agent Interface | GUIの代替ではなく、GUI制作を補助・検証・修復するための責務と境界を議論する |

## 6. 参考調査レポート

| Topic | Reports | Design use |
|-------|---------|------------|
| Deformer相当構造 | `discussion/reports/deformer-structure-technology/` | MVP deformer の種類、補間方式、bind space、評価順序の設計判断に使う |
| Viewer / Preview | `discussion/reports/viewer-preview-reference/` | Editor preview / Viewer / Shared Runtime / Validator-AI bridge の境界設計に使う |
| AI Agent 接続方式 | `discussion/design/ai-agent-connection-and-technology-stack.md` | 技術スタック、3層AI連携、shared operation core 方針の設計判断に使う |

## 7. 次に分解すべき設計成果物候補

- MVP architecture decision record
- Open Model Package design brief
- GUI Editor screen specification checklist
- Parameter / Keyform defaults and standard parameter policy
- Deformer design decision record
- Runtime evaluation semantics explainer
- Viewer / Preview boundary design
- Validator MVP profile design
- AI Agent Interface discussion brief
