# Private 2D Rigging Lab Acceptance Criteria System Draft

# 3. MVP Acceptance Criteria

## 0. 位置付け

現在のMVPは **Private Authoring-to-Viewer Prototype** である。

このMVPは、「最小モデルを表示できること」ではなく、権利クリーンな素材から private GUI editor で2Dキャラクターの可動モデルを制作し、project-defined model package として保存し、private runtime core / private viewer で表示し、validator と AI assistant で検証できることを初期成功条件とする。

GUI Editor は後付けの表示確認UIではない。MVPでは、model package、編集operation、検証設計、AI assistant interface が、GUI上で人間が制作できる authoring workflow を前提に成立していなければならない。

Cubism Editor の画面配置やメニュー構成を模倣することは目的ではない。再構築する対象は、素材から2Dキャラクターの可動モデルを作る制作能力、制作途中の見通し、保存と再編集、runtime確認、構造化検証、AIによる制作補助である。

## 1. MVPの中心問い

最初に何ができれば、Private 2D Rigging Lab は「制作からViewer確認まで一周できる」と言えるのか。

MVPの中心問いは次である。

> 権利クリーンな自作または明示許諾の layered character art を private GUI editor で drawable / texture / part / mesh / parameter / keyform / rig control構造を持つ2Dキャラクター可動モデルへ制作し、project-defined model package として保存・再読み込みし、private runtime core / private viewer で parameter 操作に応じて表示し、validator と AI assistant が validation report、dry-run operation、diff、repair suggestion として扱えるか。

この問いに答えられない成果は、CLI、script、AI操作、手書きJSON、単体runtime表示が成功していてもMVP達成とはしない。

## 2. MVPに含める範囲

MVPに含めるもの:

- private GUI editor。
- private runtime core。
- private viewer。
- project-defined model package。
- layered-character PSD import profile。
- split PNG fallback。
- drawable / texture / part。
- mesh。
- parameter / keyform。
- manual authored parameter grid。
- rotation2d / warpLattice2d rig control。
- parent-child rig hierarchy。
- generic mask / clipping。
- draw order。
- editor preview。
- save / reload。
- runtime snapshot。
- validator report。
- AI dry-run / model diff / runtime diff / validation diff / repair suggestion。
- rights metadata / provenance。
- demo-safe screenshot/video capture。

MVPで扱うミニモデルは、商用品質ではなく、制作概念を一周検証できることを優先する。

## 3. MVP外へ下げる範囲

次は現在MVPに含めない。

- Cubism format import/export。
- Cubism SDK/Core。
- Cubism model loading。
- `.model3.json`、`.moc3`、`.cmo3`、`.physics3.json`、`.motion3.json`、`.pose3.json` の検査、読み込み、変換。
- Cubism Viewer compatibility。
- Cubism Editor UI reproduction。
- VTube Studio compatibility。
- Future SDK。
- Future integration surface。
- Future streaming app。
- OBS output。
- plugin system。
- marketplace / registry。
- public sample distribution。
- code / binary distribution。
- 既存公式/第三者サンプル、第三者Live2Dモデル、nizima素材の利用。
- timeline型animation editor、motion export、lip sync、video editor。

## 4. MVP Acceptance Criteria

### AC-MVP-001: GUI Editor を必須の制作入口にすること

MVPでは private GUI editor が必須であること。

ユーザーは GUI Editor で素材を読み込み、パーツや描画要素を選択し、lock / hide / select、draw order、mesh編集、parameter / keyform / rig control編集、preview、保存、再読み込みを行えること。

CLI、script、AI操作、手書きJSONだけで model package を生成できても、それはMVP達成とはしない。これらは GUI Editor の補助、検証、fixture生成、automation として使ってよいが、GUI制作フローを置き換えるものではない。

### AC-MVP-002: 権利クリーンな素材で完結すること

MVPに使う入力素材、分割画像、texture、sample package、validation fixture、AI編集結果は、自作または明示的に利用可能な権利状態であること。

各素材と生成物は、出典、作成者、ライセンス、生成・編集手順、AI利用の有無、表示可否、再利用可否を provenance として記録できること。

既存公式/第三者サンプル、第三者Live2Dモデル、nizima素材、権利不明素材、Cubism SDK/Core を、MVPの必須データまたは依存関係にしないこと。

### AC-MVP-003: layered character art を制作入力として受け入れられること

GUI Editor は、layered character PSD profile または split PNG fallback を入力として受け入れられること。

このPSD profile は汎用の layered character art import profile であり、Live2D / Cubism import profile ではない。Cubismモデル構造を読み取り、推定し、変換するものではない。

入力時には、元素材、レイヤーまたは分割画像、キャンバス上の配置、表示状態、グループ構造、下絵またはガイド画像、受け入れ時の警告を観測できること。

### AC-MVP-004: drawable / texture / part 化できること

GUI Editor は、入力素材から texture、drawable、part を作成・管理できること。

各 drawable は、安定ID、元素材との対応、texture参照、初期配置、表示状態、opacity、draw order、part所属を持つこと。

part と drawable の対応は、Editor、保存形式、Runtime、Viewer、Validator、AI assistant から同じIDで追跡できること。

### AC-MVP-005: mesh を生成・編集・検証できること

GUI Editor は、drawable に対して mesh を生成し、頂点、UV、triangle index を編集できること。

MVPでは、自動生成と手動編集の少なくとも一方がGUI上で成立し、頂点移動により drawable の見た目を変形できること。

mesh は、vertex数、uv数、triangle index範囲、重複または退化triangle、texture範囲、drawable参照、保存後の整合性を Validator と AI assistant が検証できること。

### AC-MVP-006: part管理、lock / hide / select、draw order を扱えること

GUI Editor は、part / drawable 単位で lock、hide、select、multi-select、表示確認、編集対象の限定を行えること。

draw order は GUI Editor で編集でき、Editor preview、保存後の再読み込み、Runtime / Viewer 表示、Validator report で一致すること。

lock / hide / select は制作支援状態として扱い、runtimeに必要な表示状態や描画順と混同しないこと。

### AC-MVP-007: clipping / mask を扱えること

GUI Editor は、drawable に clipping / mask 関係を設定できること。

MVPでは、少なくとも目の白目と瞳、または同等の小さな局所部位で、mask対象と被mask drawable の関係を作成し、Editor preview と Runtime / Viewer で確認できること。

Validator は、mask参照先の欠落、循環、無効対象、runtimeで解決不能な mask を構造化して報告できること。

### AC-MVP-008: parameter、範囲、keyform、補間を制作できること

GUI Editor は、project-defined parameter を作成し、ID、表示名、最小値、最大値、初期値、現在値、semantic role、`projectPresetAlias` を扱えること。

GUI Editor は、parameter に keyform を追加し、各keyformで drawable、mesh、rig control構造、opacity、visibility などの状態を編集できること。

Runtime は、keyform間の中間値を補間し、Viewer で slider 操作したときに連続的な見た目の変化を確認できること。

### AC-MVP-009: rig control、親子階層、parameter接続を制作できること

GUI Editor は、warpLattice2d rig control と rotation2d rig control の変形制御構造を作成できること。

rig control構造は、対象 drawable または子rig control、親子階層、局所変形と大域変形、回転中心または制御格子、parameter / keyform 接続を持てること。

MVPでは、少なくとも顔や体のまとまりを変形する warpLattice2d rig control と、頭部または腕などを回転的に扱う rotation2d rig control をGUI上で作成し、parameter に接続できること。

Validator は、親子循環、親子サイズまたは対象範囲の不整合、存在しない対象ID、parameter未接続、runtime評価不能なrig controlを報告できること。

### AC-MVP-010: 基本制作能力を含むミニモデル可動を制作できること

GUI Editor で作るMVPミニモデルは、見た目の完成度より、2Dキャラクターの制作概念を一周検証できることを優先する。

MVPミニモデルは、少なくとも次の可動を制作・保存・再読み込み・Preview・Runtime評価できること。

- まばたき。
- 眉。
- 口開閉。
- 顔roll。
- 体上下または体傾き。
- 片腕の回転、上下、または姿勢差分。
- 髪揺れの最小表現。MVPでは `hairSway` 等のproject-defined scalar parameter、手動keyform、通常rig controlで扱う。
- faceYaw / facePitch の手動authored parameter grid または通常補間。

これらは project-defined stable ID として扱う。外部runtimeやCubism標準parameterとの互換を目的にしない。

Full Open Dynamics、dynamics group、secondary motion solver は current MVP の成功条件にしない。必要な場合は Private Optional / Post-MVP として、package / operation / runtime / validator contract を追加してから扱う。

### AC-MVP-011: Editor preview、保存、再読み込みが成立すること

GUI Editor は、制作中のモデルを preview できること。

previewでは、parameter slider または同等のGUI操作により、keyform、rig control、clipping、draw order、part表示状態が制作意図通りに反映されること。

制作結果は project-defined model package として保存でき、GUI Editor で再読み込みしたときに、素材対応、drawable、texture、part、mesh、parameter、keyform、rig control、clipping、draw order、rights metadata、provenance が保持されること。

### AC-MVP-012: Private Runtime / Viewer で表示し parameter 操作できること

Private Runtime / Viewer は、GUI Editor で保存した project-defined model package を読み込み、非空のモデル表示を生成できること。

Viewer は、MVPミニモデルの parameter 一覧、範囲、初期値、現在値を表示し、GUI slider または同等の操作で値を変えられること。

parameter 操作の結果として、評価済み drawable state、vertex、visibility、opacity、draw order、mask状態、diagnostics が変化し、構造化runtime stateとして取得できること。

### AC-MVP-013: Validator が構造化レポートを出力できること

Validator は、GUI Editor で保存した package に対して、少なくとも次を検証できること。

- package schema と format version。
- 必須ファイルと asset reference。
- rights metadata と provenance。
- texture / drawable / part 参照。
- mesh の vertex / uv / triangle index 整合性。
- draw order と表示状態。
- clipping / mask 参照。
- parameter 範囲、初期値、keyform。
- rig control構造、親子階層、parameter接続。
- runtime load test と代表parameter評価。
- demo-safe capture に出してよい情報と隠すべき情報の分類。

レポートは、人間向け要約に加え、AI-readable な構造化形式で保存できること。

### AC-MVP-014: AI assistant が観測、dry-run、diff、検証を扱えること

AI assistant は、GUI Editor で制作されたMVPミニモデルに対して、構造化された観測、dry-run operation、diff、検証、repair suggestion を行えること。

AI assistant は少なくとも次を実行または取得できること。

- model structure inspection。
- runtime state snapshot。
- validation report 読み込み。
- 対象IDを指定した編集operationのdry-run。
- 編集前後の model diff、runtime diff、validation diff。
- 修復候補とprovenance。
- AC / scenario に照らした Pass / Fail / Needs review / Not applicable の判定材料。

AI assistant の操作は、GUI制作フローを置き換えるためではなく、人間がGUIで制作したモデルを検証・補助・修復提案するために使えること。

### AC-MVP-015: Demo-safe capture が成立すること

MVPは、Streaming Demo Surface に出せる素材・画面・説明を private implementation から分離できること。

demo-safe capture は、自作または明示許諾素材、非互換・非提携の説明、高レベルな操作結果、validation/repair suggestion の概念表示に限定できること。

capture には、コード、内部schema、ファイル構造、Cubism形式名、既存モデル読み込みを示唆するログ、公式/第三者素材、Cubism比較画面を含めないこと。

### AC-MVP-016: Cubism非依存の一周として成立すること

MVPの Authoring-to-Viewer 一周は、Cubism Editor、Cubism SDK/Core、Cubism形式、既存Cubismモデルを使わずに成立すること。

Cubism関連の過去調査資料は、歴史的・リスク確認・スコープ除外の文脈に限定する。既存公式/第三者サンプル、Cubism runtime package、Cubism SDK/Core は、MVPの入力、解析対象、fixture、sample、implementation dependency、comparison oracle にしない。

## 5. Domain ACとの対応

Domain ACは、Private Prototypeを現在baselineとして整理済みである。歴史的なファイル名が残るものもあるが、本文のactive requirementはproject-defined package、private runtime core、private viewer、validator、AI assistant、demo/proposal hygieneに従う。

暫定対応:

| MVP AC | 主対応Domain AC | 備考 |
|---|---|---|
| AC-MVP-001 GUI Editor必須 | AC-WF, AC-AI | GUI authoring をMVPの正にする |
| AC-MVP-002 権利クリーン素材 | AC-RIGHTS, AC-SAMPLE | public redistribution ではなく demo/proposal hygiene を優先 |
| AC-MVP-003 入力素材 | AC-IN | 旧Live2D名のprofileではなく `layered-character-psd-profile-v1` |
| AC-MVP-004 - AC-MVP-012 model / runtime / viewer | AC-DRAW, AC-MESH, AC-PARAM, AC-DEF, AC-FACE, AC-BODY, AC-RUNTIME, AC-VIEWER | Cubism互換ではなく project-defined package と runtime semantics |
| AC-MVP-013 Validator | AC-VALIDATOR | Demo-safe分類を追加 |
| AC-MVP-014 AI assistant | AC-AGENT | auto-rigging ではなく assistant / validator |
| AC-MVP-015 Demo-safe capture | AC-RIGHTS, AC-DOC | 配信デモと提案資料を分離 |
| AC-MVP-016 Cubism非依存 | AC-IN, AC-EXPORT, AC-RIGHTS | 形式検査・読み込みも行わない |

## 6. MVP完了判定

MVPは、次のすべてを満たしたときに完了とする。

1. 権利クリーンな素材から、GUI Editor でMVPミニモデルを制作できる。
2. GUI Editor で、入力、drawable / texture / part、mesh、draw order、clipping、parameter、keyform、rig control、基本制作能力に含まれる可動を編集できる。
3. GUI Editor preview で、代表parameterの変化を確認できる。
4. Project-defined model package として保存し、GUI Editor で再読み込みできる。
5. Private Runtime / Viewer で読み込み、parameter操作に応じた表示と runtime state を確認できる。
6. Validator が構造化レポートを出力できる。
7. AI assistant が dry-run、diff、validation report、repair suggestion を構造化して扱える。
8. Demo-safe capture として外に出せる画面・素材・説明を分離できる。
9. Cubism形式、Cubism SDK/Core、既存Cubismモデルを含めずに一周できる。

## 7. memo/new_concept.md対応状況

`memo/new_concept.md` からの文書移行作業は完了扱いである。

完了済み:

- Domain AC / scenarioをPrivate Prototype baselineへ整理。
- Future SDK、Future integration surface、Future streaming app、public sample distributionはFuture / out of current MVPへ分類。
- 旧接続固有語をmanual overlap / mask / draw order / keyform / joint-area validationへ整理。
- Physics相当の語彙はPrivate Optional / Post-MVPへ分離し、MVPではhairSway等のproject-defined parameter / keyform / rig controlへ整理。
- face yaw / pitchをmanual authored parameter grid文脈へ整理。
- 旧標準ID語彙をprojectPresetAlias / semantic roleへ整理。
- AIをassistant / validator / dry-run / diff / repair suggestion文脈へ整理。
- Demo policyとLive2D Feature Proposal templateを追加。

文書移行を超える別課題:

- 実装コード作成。
- 法務判断や特許クリア判断。
- 配信用素材、capture scene、最終disclaimerの確定。
- Live2Dへ最初に提案する機能テーマの決定。
- Future Public Clean Subsetの詳細設計。
