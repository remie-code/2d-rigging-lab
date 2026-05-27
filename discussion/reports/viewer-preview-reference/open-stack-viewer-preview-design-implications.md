# Open Stack Viewer / Preview Design Implications

> 状態: Preliminary design recommendation  
> 目的: Open 2D Character Rigging Stack MVP における Editor preview、Viewer、Shared Runtime、Validator / AI bridge の境界を、Cubism参照レポート完成前でも使える設計推奨として整理する。

## 1. Official facts

- Cubism公式資料は、Editor tutorial 1-5、Viewer loading、SDK parameter operation、model integrity などを参照対象として挙げられている。
- Cubism基本チュートリアル6相当の animation mode、timeline、motion作成は、MVP ACでは MVP+1 / 将来候補に置かれている。
- 公式資料は制作能力や確認能力の参考であり、Open 2D Character Rigging Stack のオラクルではない。

## 2. Repository facts

- `discussion/acceptance-criteria/03_MVP_Acceptance_Criteria.md` は、MVPを「権利的にクリーンな素材から GUI Editor で制作し、Open Model Package として保存し、Runtime / Viewer で表示し、Validator と AI Agent が検証できる Authoring-to-Runtime 一周」と定義している。
- `AC-MVP-011` は、Editor preview が parameter 操作により keyform、deformer、clipping、draw order、part表示状態を制作意図通りに反映することを要求している。
- `AC-MVP-012` は、Viewer が保存済み Open Model Package を読み込み、parameter一覧・範囲・初期値・現在値を表示し、slider等で評価済み drawable state、vertex、visibility、opacity、draw order、mask状態、diagnostics を変化・取得できることを要求している。
- `AC-MVP-013` は、Validator report が人間向け要約と AI-readable な構造化形式を持ち、check ID、status、severity、target ID、根拠、関連ACまたはシナリオ、影響範囲、修復候補、provenance を持てることを要求している。
- `AC-MVP-014` は、AI Agent が model structure inspection、runtime state snapshot、validation report、operation dry-run / preview、model diff、runtime diff、validation diff、repair候補を扱えることを要求している。
- `discussion/design/initial-design-decisions-and-open-questions.md` では、Editor と Viewer は同一アプリ内機能とされている。
- 同文書では、Validator MVP は Editor 内警告で十分とされている。
- 同文書では、Editor preview と Viewer の runtime 実装共有は、保守性、再利用性、整合性などの品質特性から検討し、あるべき姿を採用するとされている。
- `discussion/scenarios/03_MVP_Acceptance_Criteria.md` の `SC-MVP-003` は、保存済み package を Viewer で開き、parameter slider で表示と runtime state が変化し、snapshot に parameter値、評価済みdrawable state、vertex、visibility、opacity、draw order、mask状態、diagnostics が含まれることを期待結果としている。
- `SC-MVP-004` は、Validator と AI Agent が validation report、model structure、dry-run operation、model diff、runtime diff、validation diff、repair候補、影響範囲、provenance、再検証手順を扱うことを期待結果としている。
- `discussion/reports/deformer-structure-technology/_map.md` は、deformer設計で Editor preview / Viewer 共通化、決定性、毎フレーム評価、Validator適性を調査観点としている。

## 3. Assumptions

- 本レポートは、Cubism Editor preview / Cubism Viewer の個別観測レポートが未完成でも成立する preliminary pass とする。
- Open Model Package の詳細スキーマ、runtime評価順序、diagnostics schema、AI Agent API は未確定とする。
- Editor preview は保存前またはdirtyな制作中モデルを扱い、Viewer は保存済み package を主対象にするものとして境界を引く。
- Runtime評価は、Editor preview と Viewer の双方で同じ意味論を持つ必要がある。見た目の完全一致だけでなく、runtime state snapshot の一致可能性を重視する。

## 4. Experiment results

- このレポートでは実装検証、Cubism実機観測、Playwright等の画面確認は行っていない。
- 現時点の結果は、基礎文書に基づく設計推奨であり、手元実装やCubism実機との差分は未検証である。

## 5. Design recommendation

### 5.1 基本方針

Editor preview と Viewer は同一アプリ内の別機能として扱う。両者は同じ Open Runtime evaluation core を共有し、入力境界と表示責務を分ける。

- Editor preview: 制作中モデルの確認と修正判断を支援する authoring preview。
- Viewer: 保存済み Open Model Package が runtimeとして読めるか、parameter操作で期待通り評価されるかを確認する runtime inspection surface。
- Shared Runtime: parameter、keyform、deformer、mesh、mask、draw order を決定的に評価し、同じ snapshot schema を返す core。
- Validator / AI bridge: 人間向け警告とAI-readable report / diff / repair候補をつなぐ構造化診断層。

### 5.2 境界表

| 領域 | MVP責務 | 扱う状態 | 人間向け表示 | AI Agent / Validator 向け出力 | MVP外に置くもの |
|---|---|---|---|---|---|
| Editor preview | 制作中モデルを即時評価し、parameter、keyform、deformer、clipping、draw order、part表示状態を確認する | dirty authoring graph、選択、lock、hide、part展開、編集中keyform、未保存operation、Editor warning | canvas上のpreview、parameter slider、選択対象の強調、mesh / deformer / mask overlay、警告badge | preview snapshot、target ID付きwarning、dirty state、operation dry-run結果、validation subset | runtime package互換の完全保証、motion/timeline再生、商用品質のデバッグUI |
| Viewer | 保存済み Open Model Package を読み込み、runtime表示とparameter操作を確認する | package manifest、asset参照、parameter current value、評価済みdrawable state、runtime diagnostics | package load状態、非空表示、parameter一覧とslider、runtime state inspection、diagnostics panel | runtime state snapshot、load diagnostics、parameter diff、runtime diff、AC/scenario判定材料 | authoring編集、lock/select、未保存状態、mesh編集、keyform編集、package修復 |
| Shared Runtime | Editor preview と Viewer で同じ評価意味論を提供する | 正規化model graph、parameter set、評価順序、補間、deformer評価、mask解決、draw order | 原則UIを持たない。呼び出し元UIへ結果を返す | deterministic evaluation result、diagnostics、snapshot、trace、bounds / NaN / missing reference検出 | Editor専用overlay、Viewer専用layout、AI repair policy |
| Validator-AI bridge | warning、report、diff、repair候補を人間とAIの双方に渡す | check result、severity、target ID、evidence、related AC/scenario、impact、repair candidate、provenance | Editor内警告、Viewer diagnostics、validation summary | AI-readable report、model diff、runtime diff、validation diff、operation dry-run response | MVP時点での独立acceptance runner完全版、全自動修復、GUI制作フローの置換 |

### 5.3 Editor preview should do in MVP

Editor preview は、制作途中のモデルを「保存前に制作意図と破綻を確認する場所」に限定する。

MVPで必要な機能は次の通り。

- parameter slider または同等操作で、keyform間補間、deformer、clipping、draw order、visibility / opacity を即時評価する。
- まばたき、眉、口開閉、顔Z、体上下 / 傾き、腕、髪揺れ、顔 Angle X / Y の代表parameterを確認できる。
- mesh、deformer、mask、draw order、part表示の制作支援overlayを表示できる。
- 選択、lock、hide、multi-select、part展開、編集中keyformなどの Editor-only state を preview 表示に反映する。ただし runtime state と混同しない。
- dirty状態や未保存operationがある場合でも preview できる。
- Validator MVP profile のうち、制作中に有用な warning を Editor内に出す。例: 欠落texture、範囲外triangle index、mask参照欠落、親子循環、parameter未接続、runtime評価不能、rights metadata不足。
- preview結果を AI Agent が参照できる snapshot として出す。最低限、対象ID、parameter値、評価済みdrawable state、警告、dirty operation ID を含める。

Editor preview は「制作UI」であり、Viewerの代替ではない。保存済み package として読めること、package境界でasset参照が解決すること、runtime load test が通ることは Viewer / Validator 側で確認する。

### 5.4 Viewer should do in MVP

Viewer は、保存済み Open Model Package を runtime視点で確認する場所にする。

MVPで必要な機能は次の通り。

- Open Model Package を読み込み、非空のモデル表示を生成する。
- package manifest、必須ファイル、asset reference、rights / provenance metadata の読込状態を表示する。
- parameter一覧、範囲、初期値、現在値を表示し、slider等で操作できる。
- parameter操作に応じて、評価済みdrawable state、vertex、visibility、opacity、draw order、mask状態、diagnostics が変化する。
- runtime state snapshot を取得できる。
- load diagnostics と evaluation diagnostics を分けて表示する。
- Editor preview と同じ Shared Runtime evaluation core を使い、同じ入力で同じ評価結果を返すことを検証可能にする。

Viewer は authoring editor ではない。MVPでは、Viewer上でmesh編集、keyform編集、deformer作成、part整理、operation修復確定を行わない。修復候補の表示やAI dry-runの確認は可能でも、確定編集は Editor に戻す。

### 5.5 What both should share

Editor preview と Viewer は、次を共有するべきである。

- Open Model Package / authoring graph を runtime評価用graphへ正規化する loader / adapter。
- parameter value model、範囲検証、初期値適用、standard alias 解決。
- keyform補間、deformer評価、mesh変形、mask解決、draw order解決、visibility / opacity評価。
- deterministic runtime state snapshot schema。
- diagnostics schema と severity語彙。
- target ID と provenance を保持する trace / evidence model。
- package load test と代表parameter評価に使う validation hooks。

共有しないものは、UI状態と編集権限である。Editor preview は authoring state と overlay を持ち、Viewer は package boundary と runtime inspection を持つ。

### 5.6 Editor-only production support state

次は Editor-only の制作支援状態として扱う。

- 選択、multi-select、hover、active tool、active panel。
- lock、Editor用hide、part tree展開、編集対象filter。
- mesh編集mode、deformer編集mode、mask編集mode、keyform編集中状態。
- guide image、下絵、作業用grid、snap、overlay visibility。
- undo / redo stack、未保存operation、dirty flag、operation log作成中の一時状態。
- GUI上の警告dismiss / pin / focus状態。
- AI Agent の dry-run preview result の一時表示。

これらは保存形式に一部metadataとして残せる場合があるが、runtime表示結果の正とはしない。特に lock / select は runtime state へ流さない。Editor用hide と runtime visibility は明確に別フィールドにする。

### 5.7 Viewer / runtime state

次は Viewer / runtime state として扱う。

- 読み込んだ package version、manifest、asset解決結果。
- parameter current value、default value、range、標準alias。
- 評価済みdrawable state: vertex、uv参照、visibility、opacity、draw order、mask membership、texture参照。
- 評価済みdeformer state: transform、lattice / control state、親子評価順序、bounds。
- runtime diagnostics: load error、missing asset、invalid reference、cycle、NaN / Infinity、bounds異常、mask解決不能、評価不能parameter。
- snapshot ID、evaluation seedまたはdeterminism marker、package hash、operation / model revision。

Viewer / runtime state は、AI Agent、Validator、diff、scenario検証で再利用できるよう、構造化して取得可能にする。

### 5.8 Diagnostics for humans and AI Agent

診断は、同じ実体を人間向け表示とAI-readable形式に分けて出す。MVPでは独立Validatorアプリが未完成でも、Editor内警告と構造化diagnosticsは同じ語彙を使う。

最小diagnostics schema案:

| Field | 内容 |
|---|---|
| `checkId` | 安定した検査ID。例: `mesh.triangleIndex.outOfRange` |
| `status` | `pass` / `fail` / `warning` / `needs_review` / `not_applicable` |
| `severity` | `info` / `warning` / `error` / `blocking` |
| `targetId` | drawable、mesh、parameter、keyform、deformer、mask、asset等のstable ID |
| `phase` | `authoring` / `package_load` / `runtime_evaluation` / `validation` |
| `evidence` | 失敗根拠、実測値、期待範囲、参照先ID |
| `relatedAc` | 関連するAC-MVPまたはscenario ID |
| `impact` | 人間が理解できる影響範囲 |
| `repairCandidate` | 修復候補。MVPでは提案またはdry-runまででよい |
| `provenance` | 素材、operation、AI利用、package revision との対応 |

人間向けには、Editor warning badge、diagnostics panel、対象へのfocus、Viewer load / runtime summary を提供する。AI Agent向けには、同じ診断をJSON等の構造化形式で返し、runtime snapshot、model diff、runtime diff、validation diff と関連付ける。

## 6. Rationale

- MVP ACは、Editor previewとViewerの両方を要求している。片方に統合すると、制作中確認と保存済みruntime確認の責務が混ざり、MVP完了判定が曖昧になる。
- Editor と Viewer は同一アプリ内機能と決まっているため、画面遷移やタブ分離は実装都合で選べる。ただし、同一アプリであることは同一責務を意味しない。
- Runtime評価意味論を共有しない場合、Editor previewで正しく見えたがViewerで崩れる、またはその逆が起きる。これは `AC-MVP-011` と `AC-MVP-012` の連続性を壊す。
- 共有しすぎて Editor-only state を runtime core に混ぜると、lock、select、overlay、dirty operation などがpackage実行結果に漏れる。これは保存形式、Viewer、AI diff の信頼性を下げる。
- Validator MVPをEditor警告に留めても、diagnostics語彙は最初から構造化しておくべきである。AI Agentと後続Validatorを後付けすると、target ID、severity、repair候補、ACリンクの再設計が発生しやすい。

## 7. MVP vs Post-MVP

| 項目 | MVP | Post-MVP |
|---|---|---|
| Editor preview | parameter slider、代表可動確認、overlay、Editor warning、preview snapshot | 高度な比較表示、複数pose管理、録画、詳細profiling、共同編集preview |
| Viewer | package load、非空表示、parameter slider、runtime state snapshot、diagnostics | motion / expression asset再生、physics詳細確認、外部アプリ連携、埋め込みSDK互換検証 |
| Runtime共有 | 評価core、snapshot schema、diagnostics schemaを共有 | 複数backend、WebGL最適化、profiling、versioned runtime conformance suite |
| Validator | Editor内warningとAI-readable reportの最小profile | 独立Validator UI、acceptance runner、batch validation、CI統合 |
| AI bridge | inspection、dry-run、diff、repair候補 | 半自動修復、policy based auto-fix、複数案比較、自然言語レビュー統合 |
| Cubism-like features | チュートリアル1-5相当の制作確認に必要な範囲のみ参考 | Cubism Viewer相当のmotion、expression、physics、commercial QA相当の詳細機能を検討 |

MVP外に置くべき Cubism-like viewer / preview features:

- animation mode、timeline、motion作成、motion export。
- motion asset、expression asset、physics asset の完全制作と完全再生確認。
- Cubism Viewer互換、`.moc3` / `.model3.json` 互換出力確認。
- Cubism EditorのUI配置、メニュー、ショートカット、palette構成の模倣。
- VTuber app、tracking input、LipSync / MotionSync、OBS出力、plugin連携。
- 商用品質モデル用の全機能debugger、performance profiler、release packaging UI。
- Viewer上での本格authoring編集。

## 8. Risks

- Shared Runtime を早期に分けない場合、Preview専用処理がViewerへ混入し、保存済みpackageのruntime検証が信用できなくなる。
- Shared Runtime を抽象化しすぎる場合、GUI操作の即時性やEditor overlayが遅くなり、制作体験が悪化する。
- diagnostics schemaを後回しにすると、AI Agent、Validator、Editor warning、Viewer diagnostics が別語彙になり、MVP後に統合コストが増える。
- Editor用hideとruntime visibility、lockとruntime mutability、selected targetとruntime target IDが混同されると、diffとvalidationが不安定になる。
- Cubism-like機能をViewerへ広く取り込むと、MVPの中心問いである Authoring-to-Runtime 一周より、互換性や高度再生機能に作業が流れる。
- Cubism参照レポート未完成のため、Cubism側の実際のpreview / Viewer診断能力との差分は未確認である。

## 9. Items requiring hands-on verification

- Editor preview と Viewer が同じ代表parameter入力で同じ runtime snapshot を返すか。
- dirty authoring graph を runtime評価用graphへ正規化するとき、未保存operationと保存済みpackageの差分を説明できるか。
- mask、draw order、deformer親子階層が Editor preview と Viewer で一致するか。
- diagnostics schema が、Editor warning、Viewer diagnostics、Validator report、AI-readable diff の全てで破綻しないか。
- snapshotに含めるvertex量が、AI Agentやdiffに十分であり、UI応答性を壊さないか。
- `SC-MVP-003` と `SC-MVP-004` を、実装上のE2Eシナリオとして検証できるか。

## 10. Open questions

- Shared Runtime の境界は、package loaderを含むべきか、評価coreだけに限定すべきか。
- Editor preview は保存前dirty graphを直接評価するか、一度 temporary package-like graph に正規化してから評価するか。
- runtime state snapshot の粒度は、全drawable全vertexを常に含めるか、summary + targeted detail にするか。
- Editor用hide と runtime visibility の命名・保存場所をどう分けるか。
- Validator MVP profile は Editor warning schema と同一ファイルにするか、将来の独立Validatorを見据えて別profile定義にするか。
- AI Agent の dry-run operation は Editor preview surface に表示するだけか、Viewerでもruntime diffとして確認できるようにするか。
- 顔Z、Angle X / Y、髪揺れ相当の標準parameter aliasを、独自仕様に基づく名に寄せるか Open Stack固有名を正にするか。
- runtime diagnostics の severity で、MVP fail、warning、needs review、not applicable をどの規則で分けるか。
- Cubism reference report完成後、どのCubism-like Viewer機能をPost-MVP候補に格上げするか。
