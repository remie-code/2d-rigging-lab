# Model Authoring Map

> LLM（Fable）によるモデル制作挑戦の外部記憶の入口地図。

## 位置付け

足場（Editor / Runtime Player）完成後の次挑戦「**Fable に 2D モデルを作らせる**」に関する前提合意・閉問題・制作定石を保持するトピック。[../design/codex-friendly-automation-policy.md](../design/codex-friendly-automation-policy.md)（外部 LLM が deterministic API 経由で人間同等操作を行う Accepted decision）の後継。

## Entry Points

- 前提のオラクル: [premises/](premises/) の 3 文書（下記）
- 現在の作業: [closed-problems/_map.md](closed-problems/_map.md)

## 直下のディレクトリ

| Path | Role | Status |
|---|---|---|
| [premises/](premises/) | 前提合意層。この挑戦のオラクル | Accepted 5 文書を記録済み |
| [closed-problems/](closed-problems/) | 閉問題の連続。1 問題 = 1 ディレクトリ | **01〜06 すべて通過**（03 = 盲目再構成満点、04 = 回転射影則、05 = 頭部外周 + 隠蔽維持拘束、06 = 立体物の回転表現 + **FaceX 完結・着地**）。07 定義待ち |
| [research/](research/) | 調査事実の置き場（Sylph 報告の L0 統合、較正ログ） | 較正ログ Round 8 まで（Fable 委任10代 reject 累計ゼロ。planning-gate 実戦 + 拘束台帳 + 人間仕上げ境界の初測定） |
| [craft/](craft/) | 閉問題から蒸留したレシピと不変量 = 制作定石（設計は [premises/craft-design.md](premises/craft-design.md)) | **レシピ 8 枚（00-07）+ 不変量 12 種**。06 の頂点に**回転射影則**、07（optional）に**ステッカー↔立体物スペクトラム + 技法6種 + 拘束台帳運用 + 人間仕上げ境界** |

## Key Files

| Path | Content | Status |
|---|---|---|
| [premises/authoring-solvability-analysis.md](premises/authoring-solvability-analysis.md) | 最小構成が不可解である理由、欠けた二器官、可解の境界、中心的未知 | Accepted |
| [premises/operating-policies.md](premises/operating-policies.md) | ヘッドレス専有運用、Git 巻き戻し、判定の梯子、Fable の知覚能力、素材スコープ、ref の位置づけ | Accepted |
| [premises/closed-problem-approach.md](premises/closed-problem-approach.md) | 閉問題連続アプローチの定義、利点 i-v、既知リスク、問題列 | Accepted |
| [premises/craft-design.md](premises/craft-design.md) | craft/ の目的（2周目のための手続き記憶）、遅延ロード参照モデル、レシピ自己完結性テスト、終着イメージ（プログラム化） | Accepted |
| [premises/model-allocation-policy.md](premises/model-allocation-policy.md) | Fable 枠制約下のモデル配分原則（実験=Fable必須 / L0=Fable / 委任=Fable以外）、調査モデル選定基準、較正ループ | Accepted |
| [closed-problems/01-eyeball-x/problem-definition.md](closed-problems/01-eyeball-x/problem-definition.md) | 第一閉問題: 眼球 X rigging の操作列・判断の所在・成功基準 | Problem defined |
| [closed-problems/01-eyeball-x/api-requirements.md](closed-problems/01-eyeball-x/api-requirements.md) | 6 操作の operation 対応表（全て exists）、実行ライフサイクル、ギャップ 3 件（host 不在 / Validate 入口無し / CLI 無し） | Facts recorded |
| [research/perception-path-survey.md](research/perception-path-survey.md) | 知覚経路の存否: 評価までは Node 到達可能、「RenderScene→PNG」の一段のみ欠落。入力形式の分岐材料 | Facts recorded |
| [research/delegation-calibration-log.md](research/delegation-calibration-log.md) | モデル配分較正の記録。Round 1: sonnet は狭い問い + アンカー付きなら足る | Living log |

## 現在の状態サマリ

- 2026-07-02: 前提 5 文書合意、第一閉問題（眼球 X）定義、API 調査完了（6 操作すべて既存 operation で対応可能）。
- 2026-07-02: **Wave103 final complete / pass**（[計画](../implementation/orchestration/wave103-plan.md) / [最終報告](../implementation/waves/wave103/wave103-final-integration-report.md)）: **手** `apps/authoring-host`（ワンショット CLI、dry-run 自動承認、01 の 5 操作スモーク全 committed、`createEndsCenter` 単独実証）+ **網膜** `packages/render-software`（依存ゼロ決定論 RenderScene → PNG）。
- 2026-07-03: **Wave104 final complete / pass**（[計画](../implementation/orchestration/wave104-plan.md) / [最終報告](../implementation/waves/wave104/wave104-final-integration-report.md)）: **目** `renderView`（フレーミング / drawableFocus / コンタクトシート / ビュー変換サイドカー、生きた session から直接描画・Atlas 非前提）+ **巻尺** `inspectEvaluatedGeometry`（評価済み bbox / 頂点 / warp 格子制御点）+ **健診** `validatePackage` 実働（孤立 read 機構の正式接続）+ **ref/ e2e**（126 テクスチャ全件検証付き導出、決定論バイト一致、ref 無変更）。
- **武器製造フェーズ完了。** 三位一体（目・測量・変換器）+ 手 + 健診が全装備。
- 途中の L0 裁定: §3.4 テクスチャ寸法の検証付き導出への改訂（明示 dimensions or byteLength 厳密一致の導出のみ。無検証推定は引き続き禁止）。
- 記録済みの将来課題: ref validate strict = error 97 件の内訳分類 / サイドカー絶対パスのポータビリティ / 実 WebGL2 とのピクセル同値性（目視 gate が実質の確認）。

## 次の行動

1. **閉問題 02 の定義**（次候補: 目の開閉。ユーザーと工程スコープの認識合わせから）。

## 閉問題 01: 通過（2026-07-03、ユーザー判定 100/100）

**「100点満点で評価するなら文句なしの100点だ。期待していたものとの差、という意味なら君は期待の数段上を超えてきた」**——問い B は Yes、初回満点。閉問題アプローチの第 1 サイクル（定義→A調査→武器製造→実験→gate→蒸留）が完全に一周し、craft/ が開設された。詳細: [results.md](closed-problems/01-eyeball-x/results.md)。

## 閉問題 01 実験: 完走記録

新規ワークスペース `C:/workspace/remie/rigging/llm-rigging`（ref と同一 PSD、ユーザーがインポート・保存・git init）に対し、Fable が L0 直接・委任なしで 6 操作全てを headless CLI 経由で committed（rev 5→18、git 原子コミット 13）。三段検証（dry-run スキーマ / 巻尺の数値が設計値と小数点一致 / sweep + 高倍率ズームの自己目視）通過。reject 2 回（preset 重複・warp への translation）はいずれも無傷回復し craft 発見に転化。詳細: [experiment-log.md](closed-problems/01-eyeball-x/experiment/experiment-log.md)。

## ユーザー目視 gate: 通過（2026-07-03）

**ユーザー判定: 「完璧だ、これであっている」。** Wave105 再生成の PNG 3 枚（Default 衣装）に対する人間承認が成立。これにより:

- ソフトウェアラスタライザの描画正しさが、配信実証済み実モデルに対して**人間の目で承認された**（wave103 の accepted リスク「実 WebGL2 とのピクセル同値性未検証」は実用上closed）
- 判定梯子の最上段（段 5: ユーザーの目）が初めて行使・通過
- **知覚経路は全段が実証済み**となり、閉問題 01 の実験を開始できる状態が整った

## 補記（2026-07-03）

- **Wave105 final complete / pass**（[計画](../implementation/orchestration/wave105-plan.md) / [最終報告](../implementation/waves/wave105/wave105-final-integration-report.md)）: Variant 可視性ゲート（snapshot レベル、目と巻尺が同一の可視性世界を共有、optional `variantSelections`、空ケース挙動不変）。wave104 版 PNG の約 9 drawable 余分描画は解消、Fable 自身も新旧 PNG の差（3 衣装重畳 → Default 単独）を視覚で明確に弁別できることを確認（弁別力データ点）。
- **artifact-wait プロトコル実戦実証**: Orch-Sylph の在席ポーリング（PowerShell Start-Sleep）で L0 中継ゼロのドメインループ完走を二度実証。確定版は `.claude/skills/implementation-orchestration/SKILL.md` 規則 1-5、統制実験の記録は [research/delegation-calibration-log.md](research/delegation-calibration-log.md) Round 4。

## 決着済みの元・未決事項（2026-07-02 ユーザー決定）

- 承認 gate: ai-interface 経由（案 A）+ 自動承認ポリシー = dry-run を機械的検証ゲートとして再解釈
- 知覚経路: ホスト内で生きた AuthoringSession から直接描画（Runtime Export 経由は不要と決着）。要求仕様 = 目（renderView + フレーミング + コンタクトシート）/ 測量（評価済みジオメトリ照会）/ 変換器（サイドカーのビュー変換）の三位一体
- 実装 wave の置き場: 既存 implementation/ 機構の続番（wave103〜）
- ラスタライザ方式: 純 TS ソフトウェアラスタライザ（ネイティブ GL 不採用）。ホスト形態: ワンショット CLI

## 未決事項

- Git コミット粒度の規約化
- Fable の視覚弁別力の実測値（01-eyeball-x の実験で最初の答えが出る）
- コマ列グリッド生成の手段（欠落部品の一部として実装 wave で扱う見込み）
