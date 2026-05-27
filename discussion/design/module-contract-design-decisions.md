# Module Contract Design Decisions

> 状態: In discussion  
> 目的: 次の `/goal` で module contract design を実施する前に、ユーザーとUndineで合意した方針、未決事項、goal指示文へ反映すべき内容を記録する。

## 1. 位置付け

この文書は、`discussion/design/module-contract-design-goal.md` に到達目標として記録した module contract design を、実際に `/goal` へ渡す前の判断ログである。

- `module-contract-design-goal.md`: 次の設計作業が到達すべき正解の定義。
- `module-contract-design-decisions.md`: その設計作業に入る前に、ユーザーとUndineで合意した方針。
- `mvp-authoring-runtime/`: 既存のMVP縦切りDraft設計成果物群。

この文書は、今後の対話で決まった内容を追記して育てる。

## 2. 合意済み方針

### 2.1 次の設計成果物の範囲

次の `/goal` では、文書だけでなく TypeScript `type` / `interface` のスケッチまで成果物に含める。

理由:

- 技術スタックは TypeScript + Web を第一候補として合意済みである。
- 後続実装は module 単位でサブエージェント並列化される可能性が高い。
- module 間 contract が自然文だけだと、各エージェントが別々の前提で実装し、接続時にずれやすい。
- `runtime-core`、`operation-core`、`package-format`、`validator-core`、`editor-ui`、`ai-interface` の境界では、ID、DTO、operation、snapshot、diagnostic、diff の形を具体的に固定する必要がある。

ただし、この段階では実装用の `.ts` ファイルを作ることを必須にしない。Markdown設計文書内に TypeScript code block として型スケッチを置き、後続で `packages/contracts` などへ移せる粒度で書く。

現時点の推奨範囲:

| 成果物 | 扱い |
|--------|------|
| module boundary 文書 | 必須 |
| TypeScript `type` / `interface` スケッチ | 必須 |
| package JSON DTO対応 | 必須 |
| operation request / response 型 | 必須 |
| runtime snapshot 型 | 必須 |
| validator report / check 型 | 必須 |
| GUI event -> operation mapping | 必須 |
| AI command schema | 必須 |
| fixtures / contract tests 方針 | 必須 |
| 実 `.ts` ファイル作成 | 今回は原則不要 |
| JSON Schema / Zod 実体ファイル作成 | 今回は原則不要。source of truth方針を設計する |

### 2.2 TypeScript contract の source of truth

単一の source of truth に寄せすぎず、外部境界と内部ドメイン型で分ける。

| 対象 | Source of truth | 理由 |
|------|-----------------|------|
| 外部境界DTO | Zod schema | file / AI / external command 由来の値は実行時検証が必要 |
| package保存形式 | Zod schema を第一候補、JSON Schema は生成または後続整備 | MVPではTypeScript実装との整合を優先しつつ、将来の公開仕様に備える |
| operation log entry | Zod schema | append-only artifactであり、後から読み直す必要がある |
| validation report | Zod schema | 人間UI、AI Agent、保存artifactで共有する |
| runtime snapshot artifact | Zod schema | Viewer、Validator、AI dry-run、保存snapshotで共有する |
| AI command request / response | Zod schema | 外部入力に近く、runtime validationが必要 |
| 内部ドメイン型 | TypeScript `type` / `interface` | 実装内部の表現力、開発速度、過剰なruntime validation回避を優先 |
| evaluator内部状態 | TypeScript `type` / `interface` | 外部境界ではなく、runtime core内部の計算状態 |
| UI view state | TypeScript `type` / `interface` | ブラウザ内の一時状態であり、package artifactではない |
| JSON Schema | 公開仕様・外部検証用 | MVPではZodから生成可能な形、または後続生成対象として扱う |

方針:

- 外部から入る、保存する、AIが触る、後から読み直す DTO は Zod schema を正とする。
- TypeScript型は `z.infer<typeof Schema>` により導出する。
- `AuthoringGraph`、`NormalizedRuntimeGraph`、evaluator internal state、renderer internal input、UI view state などの内部ドメイン型は TypeScript `type` / `interface` を正とする。
- JSON Schema は project-defined model package の公開仕様や外部検証に必要だが、MVP module contract design では Zod から生成可能な形、または後続生成対象として扱う。
- 各 contract には `sourceOfTruth: zod | typescript | generated-json-schema` を明記する。

この方針により、TypeScript実装者には型安全な設計図を渡しつつ、AIやファイル由来の曖昧なデータは実行時に検証できる。

### 2.3 Zod の位置付け

Zod は、TypeScriptの型に似た schema を実行時にも検証できるライブラリとして扱う。

このプロジェクトでは、Zod を「AIやfileや外部入力が持ち込む曖昧さを止める門番」と位置付ける。

使うべき場所:

- project-defined model package の `manifest.json` や `model/*.json`
- operation log の1行
- AI command request / response
- validation report
- runtime snapshot artifact
- repair candidate

使わなくてよい場所:

- runtime evaluator内部の一時計算状態
- canvas drag中だけの一時UI状態
- renderer内部のWebGL handle
- algorithm内部のcache

基本原則は「外部境界だけZod、内部はTypeScript」とする。

### 2.4 Module contract 設計の出力先

次の `/goal` による module contract design の成果物は、`discussion/design/module-contracts/` に出力する。

理由:

- `module-contract-design-goal.md` は到達目標であり、成果物本体ではない。
- `module-contract-design-decisions.md` は `/goal` 前の判断ログであり、成果物本体ではない。
- `mvp-authoring-runtime/` は既存のMVP縦切りDraft設計成果物群であり、そこへ contract-first 設計の詳細成果物を混ぜると役割が曖昧になる。
- `module-contracts/` を分けることで、後続の実装エージェントが module boundary、TypeScript contract、operation/runtime/validator/GUI/AI contract、fixture、traceability を一箇所から辿れる。

`discussion/design/module-contracts/` は、次の `/goal` が実際の設計成果物を配置する場所である。現時点では入口 `_map.md` のみ作成し、個別成果物は次の設計タスクで作成する。

### 2.5 出力ファイルフォーマット

次の `/goal` で作成する各成果物は、`discussion/design/module-contract-output-format-template.md` の共通テンプレートとファイル別テンプレートに従う。

基本方針:

- 各成果物は共通ヘッダーを持つ。
- 各成果物は `Purpose and Scope`、`Basis Separation`、`Contract Summary`、`TypeScript / Zod Sketches`、`Diagram Requirements`、`Traceability`、`Verification and Fixtures`、`Open Questions`、`Handoff Checklist` を持つ。
- TypeScript / Zod code block は `ts` fence で書く。
- 外部境界DTOは Zod schema + `z.infer` を基本にする。
- 内部ドメイン型は TypeScript `type` / `interface` を基本にする。
- 各contractごとに `sourceOfTruth` を明記する。
- 各成果物はAC、scenario、fixture、expected output への traceability を持つ。
- 依存方向、処理順序、状態遷移、artifact生成flowは Mermaid 図を積極的に使う。ただし図だけを source of truth にせず、契約の正は TypeScript / Zod code block と表に置く。

### 2.6 サブエージェントレビュー方針

次の `/goal` で module contract design の初稿を作成した後、可能であればサブエージェントによる独立レビューを行う。

レビューは、少なくとも次の3観点に分ける。

| Review lane | 観点 | 注意点 |
|-------------|------|--------|
| AC / Scenario Traceability Review | AC、シナリオ、contract、operation flow、fixture、expected output の対応を確認する | trace は AC だけで閉じない。シナリオの操作列、期待結果、代表fixture、validation/runtime snapshot に結びつくかを見る |
| TypeScript / Zod Contract Consistency Review | branded ID、DTO、内部型、Zod schema、sourceOfTruth、module boundary、Mermaid図と表の整合を確認する | 外部境界DTOと内部ドメイン型の混同、重複型、依存方向の矛盾を重点的に見る |
| Fixture / Verification Review | fixture、expected validation report、expected runtime snapshot、expected diff、contract test方針が十分か確認する | happy path だけでなく invalid texture、rig control cycle、mask invalid、out-of-range dry-run、AI repair dry-run を見る |

レビューの運用方針:

- サブエージェントはユーザーに直接質問しない。
- 質問や判断待ちは、担当エージェントが重複排除してユーザーへ提示する。
- レビュー担当は、成果物を直接上書きするのではなく、findings と required fixes を出す。
- 担当エージェントはレビュー結果を統合し、必要な修正を成果物へ反映する。
- 修正できない論点は `implementation-blocking` または `can-defer` に分類する。
- レビュー結果と対応状況は `discussion/design/module-contracts/review-summary.md` に記録する。

### 2.7 face yaw / pitch の斜め方向評価

face yaw / pitch の斜め方向評価は Private Prototype独自の評価規則として定義する。

Historical capability observation, not implementation oracle:

- Cubism Editor では、同一オブジェクトまたは変形制御に X / Y の2軸パラメータを設定し、3 x 3 のキー形状パターンとして扱う説明がある。
- 親子関係を使うことで、全組み合わせを同一オブジェクトに持たせず、親変形制御と子変形制御に動きを分担して表現する説明がある。
- 1つのオブジェクトまたは変形制御に過剰な数のパラメータを設定することは避けるべきであり、MVPでも任意N次元のキー形状合成は扱わない。

These observations are not implementation requirements. The Private Prototype does not implement Cubism Editor semantics, UI, file format, or runtime behavior. The active implementation requirement is only the project-defined `parameter-grid-2d-v1` evaluator described below.

参照:

- [About Key Forms in the XY Direction](https://docs.live2d.com/4.2/en/cubism-editor-manual/keyform-xydirection/)
- [About movements using parent-child relationships](https://docs.live2d.com/en/cubism-editor-manual/keyform-parent-chilid-relation/)

設計判断:

- MVPでは、1軸キー形状評価に加え、project-defined な2軸キー形状グリッドを扱える contract を用意する。
- 公開contract上の概念名は `parameter-grid-2d-v1` とする。`bilinear` は補間実装の選択肢であり、Cubism Editor 内部仕様そのものとしては扱わない。
- 2軸グリッドは、同一対象に `faceYaw` / `facePitch` などproject-defined scalar parametersを割り当てた場合のキー形状評価を表す。
- 斜め方向や複合的な動きは、2軸グリッドだけでなく、親子変形制御階層による分担でも表現できるようにする。
- 親子変形制御の評価順序は parent-before-child とし、子は親変形後の空間に対して評価される。
- MVPでは任意N次元キー形状グリッドを採用しない。3軸以上を同一対象に割り当てるケースは validator で警告または post-MVP 扱いにする。

次の module contract design で明確化すること:

- `KeyformBinding` または同等の型で、1軸評価と2軸グリッド評価を表現できるようにする。
- `parameter-grid-2d-v1` の key coordinate、欠損keyの扱い、補間method、境界clamp、diagnostic を明示する。
- GUIでは、1軸 keyform 編集と2軸 keyform grid 編集が operation-core を迂回しないようにする。
- Fixtures には、face yaw / pitch の同一変形制御2軸グリッドと、親子変形制御で斜め方向を表現するケースを含める。

### 2.8 PSD import vs split PNG primary

MVPの source asset import は PSD を primary とする。

公式 / 参照事実:

- Adobe は PSD を Photoshop の native file format として扱っている。
- Adobe の Photoshop File Formats Specification は、PSD / PSB native file format の詳細仕様を第三者向けに公開している。
- ただし、この仕様はISO等の公的オープン標準ではなく、Adobeの proprietary format に対する公開仕様である。
- Adobe の仕様文書は、データ形式を説明するものであり、すべてのデータの解釈方法を説明するものではない。
- Photoshop Cloud Document / PSDC は仕様文書の対象外であり private とされている。
- PSDは2GBまでのファイルを対象とし、より大きいドキュメントはPSBが使われる。

参照:

- [Adobe Photoshop File Formats Specification](https://www.adobe.com/devnet-apps/photoshop/fileformatashtml/)
- [Photoshop file formats overview](https://helpx.adobe.com/photoshop/desktop/save-and-export/export-files-to-different-formats/photoshop-file-formats-overview.html)
- [Supported file formats in Photoshop](https://helpx.adobe.com/photoshop/using/file-formats.html)

設計判断:

- MVPでは、PSDを主要なsource asset formatとして扱う。
- split PNG は primary ではなく、fallback import、debug fixture、またはPSDを持たない素材の互換入口として扱う。
- project-defined model package には、PSDそのものを runtime-visible model graph と混同せず、source asset / provenance として記録する。
- PSD import は、PSDの全機能を完全再現するのではなく、2Dキャラクターリギング向けの立ち絵モデル制作に必要な layer tree、group、layer name、bounds、visibility、opacity、raster pixel data、mask の扱いをMVP範囲として設計する。
- Adjustment layer、smart object、text layer、layer effect、vector shape、complex blend mode などは、MVPで完全解釈しない可能性がある。これらは validator diagnostic または rasterize-required / unsupported-layer として扱う。
- PSD parser / adapter は package-format または import-adapter の境界に閉じ込め、authoring-core / runtime-core がPSD固有構造へ直接依存しないようにする。
- PSB はPSDと近い形式だが、MVP primaryには含めない。大容量対応が必要になった時点で optional import として検討する。

次の module contract design で明確化すること:

- `importPsdSourceAsset` operation の request / response / diagnostic。
- PSD layer tree から project-defined model package の `sourceAssets`、`drawables`、`parts`、`textures`、`provenance` へ落とす mapping。
- unsupported PSD feature の check ID、severity、repair candidate。
- split PNG import を fallback として残す場合の provenance と操作差分。
- PSD happy path fixture と unsupported layer fixture。

### 2.9 GUI authoring evidence

GUI authoring evidence は、GUIで制作操作が可能であり、その操作が正式なモデル変更として記録・検証できることを示す証拠である。

設計判断:

- MVPでは operation log を GUI authoring evidence の必須証拠とする。
- Playwright trace、screenshot、video、session metadata は補助証拠として扱う。
- contract の正は、operation log、validation report、runtime snapshot に置く。
- Playwright trace や screenshot は、人間の調査・E2E失敗時の補助には使うが、module間contractの source of truth にはしない。
- すべてのGUI編集操作は operation-core を通る。GUIが authoring-core や package DTO を直接変更してはならない。
- Acceptance / E2E では、GUIを操作した事実だけでなく、operation log、validation report、runtime snapshot の期待結果を確認する。

次の module contract design で明確化すること:

- `OperationLogEntry` に必要な最小項目。
- GUI操作由来であることを示す `source: "gui"` または同等のfield。
- `GuiOperationEvidence` の項目。例: `uiSurface`、`toolId`、`testId`、`pointerGesture`。
- UI event -> operation-core -> preview/runtime -> validation report の流れ。
- Playwright trace / screenshot / session metadata をどこに保存し、どの程度 contract test の補助にするか。
- GUI操作証拠とAC / scenario / fixture の traceability。

### 2.10 `/goal` 指示文の投入方式

次の `/goal` は、4000字程度の入力制約を想定し、詳細な設計方針を本文にすべて展開しない。

方針:

- `/goal` 本文は短い依頼文とし、詳細は既存の決定ファイル・到達目標・テンプレートを読ませる。
- 参照させる中心文書は `discussion/design/module-contract-design-decisions.md`、`discussion/design/module-contract-design-goal.md`、`discussion/design/module-contract-output-format-template.md`、`discussion/design/module-contracts/_map.md` とする。
- `/goal` 本文には、出力先、読むべきファイル、完了条件、レビュー要求だけを圧縮して書く。
- 長い背景、決定理由、未決事項の詳細はファイル側を source of truth とする。
- 今後も新しい合意事項はこの決定ログに追記し、`/goal` 本文へ直接長文転記しない。

### 2.11 Structured API transport / AI操作口の検討方法

Structured API transport は、先に固定のendpoint一覧を決め打ちしない。

次の module contract design の中で、既存のユースケースシナリオをAI操作目線でレビューし、実際にAI AgentがGUI画面やスクリーンショットを見ながら作業する場合に必要な口を逆算して定義する。

設計判断:

- Structured API は、operation command だけでなく、Editor semantic state / selection / canvas hit-test を読む口も必要である。
- スクリーンショットやPlaywrightは、画面理解とGUI反映確認に使う。
- 正確な対象特定は、構造化APIで `RigControlId`、`ParameterId`、selection、viewport、hit-test 結果を取得して行う。
- モデル変更は必ず operation-core 経由で dry-run / commit する。
- commit時は operation log を必ず残し、validation report と runtime snapshot で結果を検証する。
- transportそのものを source of truth にしない。正は transport-independent command / editor semantic state contract に置く。
- HTTP JSON、WebSocket、MCP は adapter として扱う。どのtransportをMVPで開けるかは、シナリオ導出後に設計成果物内で提案・分類する。

次の module contract design で必ず実施すること:

- ユースケースシナリオを読み、AI Agentが支援・代行しうる操作を抽出する。
- 代表例として「スクリーンショットを見ながら、選択中または指定された変形制御に対してパラメータを設定する」操作を分析する。
- 各シナリオについて、必要な `observe`、`inspect`、`hit-test`、`dry-run`、`commit`、`validate`、`snapshot`、`evidence` の口を表にする。
- API口を少なくとも次の3群に分ける:
  - Editor semantic state API: `getEditorState`、`getSelection`、`getCanvasViewport`、`hitTestCanvas` など。
  - Operation command API: `dryRunOperation`、`commitOperation`、`getOperationLog` など。
  - Runtime / Validator read API: `inspectModel`、`validatePackage`、`getRuntimeSnapshot` など。
- `ai-command-contract.md` と `gui-operation-contract.md` の両方に、シナリオから導出した口一覧と traceability を持たせる。
- transport候補は、MVP必須、MVP任意、post-MVP に分類する。

## 3. 未決事項

次に決める項目:

| 項目 | 状態 |
|------|------|
| なし | 次の `/goal` 前にユーザーとUndineで決めるべき主要項目は現時点で解消済み。Structured API transport の口一覧は、次の module contract design 内でユースケースシナリオから導出する |

## 4. `/goal` 指示文へ反映すべき内容

次の `/goal` では、少なくとも次を明示する。

- 成果物は Markdown 設計文書とし、TypeScript `type` / `interface` code block を必須にする。
- 実 `.ts` ファイル作成は原則不要。ただし後続実装へ転記可能な粒度で書く。
- 外部境界DTOは Zod schema を正とし、TS型は `z.infer` で導出する方針を採用する。
- 内部ドメイン型は TypeScript `type` / `interface` を正とする。
- JSON Schema は公開仕様・外部検証用として生成または後続整備対象にする。
- 各 contract ごとに `sourceOfTruth` を明記する。
- 成果物の出力先は `discussion/design/module-contracts/` とする。
- 成果物は `discussion/design/module-contract-output-format-template.md` の共通テンプレートとファイル別テンプレートに従う。
- 依存方向、処理順序、状態遷移、artifact flow には Mermaid 図を使う。特に `module-boundaries.md` の module dependency graph は必須とする。
- 初稿作成後、AC / Scenario Traceability、TypeScript / Zod Contract Consistency、Fixture / Verification の3観点でサブエージェントレビューを行う。
- レビュー結果と対応状況を `discussion/design/module-contracts/review-summary.md` に記録する。
- 各成果物は、上位AC、scenario、参照レポートへの traceability を持つ。
- module間の齟齬を防ぐため、fixtures と expected output を contract の一部として設計する。
- face yaw / pitch の斜め方向評価は Private Prototype独自の規則とし、1軸 keyform と `parameter-grid-2d-v1`、親子変形制御階層の組み合わせとして contract 化する。
- 任意N次元キー形状グリッドはMVPでは扱わず、3軸以上を同一対象に割り当てるケースは validator diagnostic として扱う。
- MVPの source asset import は PSD primary とする。split PNG は fallback / debug / compatibility 入口として扱う。
- PSD import は全Photoshop機能再現ではなく、layer tree、group、layer name、bounds、visibility、opacity、raster pixel data、mask を中心にcontract化し、unsupported PSD feature は validator diagnostic として扱う。
- GUI authoring evidence は operation log を必須証拠とし、Playwright trace / screenshot / session metadata は補助証拠とする。
- GUI操作は必ず operation-core を通り、contract の正は operation log、validation report、runtime snapshot に置く。
- `/goal` 本文には詳細方針を展開しすぎず、この決定ログ、到達目標、出力テンプレート、出力先mapを参照させる。
- Structured API の口一覧は、ユースケースシナリオをAI操作目線でレビューしたうえで導出する。
- API口は Editor semantic state API、Operation command API、Runtime / Validator read API に分け、transport-independent contract を正とする。
- 代表例として、スクリーンショットを見ながら変形制御へパラメータを設定する操作を分析し、必要な observe / inspect / hit-test / dry-run / commit / validate / snapshot / evidence を明示する。

## 5. Change Log

| Date | 内容 |
|------|------|
| 2026-05-26 | 次の設計成果物は TypeScript型スケッチまで含める方針で合意 |
| 2026-05-26 | 外部境界DTOはZod schema、内部ドメイン型はTypeScript `type` / `interface`、JSON Schemaは公開仕様・外部検証用という source of truth 方針で合意 |
| 2026-05-26 | module contract design の成果物出力先を `discussion/design/module-contracts/` にする方針で合意 |
| 2026-05-26 | module contract design 成果物の共通テンプレートとファイル別テンプレートを `module-contract-output-format-template.md` に定義 |
| 2026-05-26 | 依存方向、処理順序、状態遷移、artifact flow には Mermaid 図を積極利用する方針をテンプレートへ反映 |
| 2026-05-26 | サブエージェントレビューは AC / Scenario Traceability、TypeScript / Zod Contract Consistency、Fixture / Verification の3観点で行う方針で合意 |
| 2026-05-26 | face yaw / pitch の斜め方向評価は Private Prototype独自の規則とし、2軸キー形状グリッドと親子変形制御階層を contract 化する方針で合意 |
| 2026-05-26 | MVPの source asset import は PSD primary とし、split PNG は fallback / debug / compatibility 入口として扱う方針で合意 |
| 2026-05-26 | GUI authoring evidence は operation log を必須証拠、Playwright trace / screenshot / session metadata を補助証拠とする方針で合意 |
| 2026-05-26 | `/goal` 指示文は詳細方針を直接展開せず、決定ログ・到達目標・テンプレート・出力先mapを参照させる方針で合意 |
| 2026-05-26 | Structured API の口一覧は、ユースケースシナリオをAI操作目線でレビューし、Editor semantic state / Operation command / Runtime・Validator read API に分けて導出する方針で合意 |
