# Model Authoring Map

> LLM（Fable）によるモデル制作挑戦の外部記憶の入口地図。

## 位置付け

足場（Editor / Runtime Player）完成後の次挑戦「**Fable に 2D モデルを作らせる**」に関する前提合意・閉問題・制作定石を保持するトピック。[../design/codex-friendly-automation-policy.md](../design/codex-friendly-automation-policy.md)（外部 LLM が deterministic API 経由で人間同等操作を行う Accepted decision）の後継。

## Entry Points

- 2026-09-25の参照画像rigging試作: [reference-guided-rigging/_map.md](reference-guided-rigging/_map.md)（Astra、将来craft v2へ蒸留）

- 前提のオラクル: [premises/](premises/) の 5 文書（下記）
- 現在の作業: [closed-problems/_map.md](closed-problems/_map.md)
- 現在の gate / 調査記録: [research/](research/)（Wave107 母音・キャリブレーション・mapping-strength・variant 調査を含む）

## 直下のディレクトリ

| Path | Role | Status |
|---|---|---|
| [premises/](premises/) | 前提合意層。この挑戦のオラクル | Accepted 5 文書を記録済み |
| [closed-problems/](closed-problems/) | 閉問題の連続。1 問題 = 1 ディレクトリ | **01〜19 すべて通過 = 1周目完了**（2026-07-06。追従5軸・揺れ4系統・口パク・別衣装・差分管理——配信導線一周をユーザー実機確認） |
| [research/](research/) | 調査事実の置き場（Sylph 報告の L0 統合、較正ログ、Wave107 母音/キャリブレーション調査) | 較正ログ Round 16 まで（**Fable 委任32代 reject 累計ゼロで1周目完了**）。player calibration / iFacialMocap / mapping-strength / variant の調査を収録 |
| [craft/](craft/) | 閉問題から蒸留したレシピと不変量 = 制作定石（設計は [premises/craft-design.md](premises/craft-design.md)) | **レシピ 11 枚（00-10）+ 不変量 20 種 + 周回指揮書（[_conductor.md](craft/_conductor.md)）**。回転射影の統一原理・2周目実施事項4件・遡及の物差しを焼き込み済み |
| [reference-guided-rigging/](reference-guided-rigging/_map.md) | 参照生成・格子への変換・動作評価、および実験記録 | 方針合意、Face-X参照2候補の位置合わせ承認済み・隣接フロー試作へ |

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
| [research/player-ifacialmocap-survey.md](research/player-ifacialmocap-survey.md) | Wave107/Runtime Player の iFacialMocap 入力・実機確認の調査 | Facts recorded; human gate remains |
| [research/player-calibration-survey.md](research/player-calibration-survey.md) | Wave107 母音キャリブレーションの調査 | Facts recorded; human gate remains |
| [research/player-mapping-strength-survey.md](research/player-mapping-strength-survey.md) | 母音 mapping strength と実機評価の調査 | Facts recorded; human gate remains |
| [research/variant-feature-survey.md](research/variant-feature-survey.md) | Variant feature の調査 | Facts recorded |

## 現在の状態サマリ

- 2026-07-02: 前提 5 文書合意、第一閉問題（眼球 X）定義、API 調査完了（6 操作すべて既存 operation で対応可能）。
- 2026-07-02: **Wave103 final complete / pass**（[計画](../implementation/orchestration/wave103-plan.md) / [最終報告](../implementation/waves/wave103/wave103-final-integration-report.md)）: **手** `apps/authoring-host`（ワンショット CLI、dry-run 自動承認、01 の 5 操作スモーク全 committed、`createEndsCenter` 単独実証）+ **網膜** `packages/render-software`（依存ゼロ決定論 RenderScene → PNG）。
- 2026-07-03: **Wave104 final complete / pass**（[計画](../implementation/orchestration/wave104-plan.md) / [最終報告](../implementation/waves/wave104/wave104-final-integration-report.md)）: **目** `renderView`（フレーミング / drawableFocus / コンタクトシート / ビュー変換サイドカー、生きた session から直接描画・Atlas 非前提）+ **巻尺** `inspectEvaluatedGeometry`（評価済み bbox / 頂点 / warp 格子制御点）+ **健診** `validatePackage` 実働（孤立 read 機構の正式接続）+ **ref/ e2e**（126 テクスチャ全件検証付き導出、決定論バイト一致、ref 無変更）。
- 2026-07-05: **Wave105 final complete / pass**（[計画](../implementation/orchestration/wave105-plan.md) / [最終報告](../implementation/waves/wave105/wave105-final-integration-report.md)）。snapshot レベルの variant 可視性ゲートと render/measurement/framing の同一可視性世界を確定。
- **武器製造フェーズ完了（repository fact）。** 三位一体（目・測量・変換器）+ 手 + 健診が全装備。Wave103〜105 の装備 pass は、人間・実機 gate の完了を意味しない。
- 途中の L0 裁定: §3.4 テクスチャ寸法の検証付き導出への改訂（明示 dimensions or byteLength 厳密一致の導出のみ。無検証推定は引き続き禁止）。
- 記録済みの技術フォローアップ: `validatePackage` / ref strict validation のエラー 97 件の内訳分類 / サイドカー絶対パスのポータビリティ。装備不足ではなく、現行出力の受入れ・持ち運び条件の整理である。

## 現在の課題（2026-08-08、分類）

### Repository facts

- 閉問題 01〜19、craft 2周目（房の層座標系・前髪3帯・目/眉の弦の項・眼球Y）、craft/09・10 の3周目追試は完了。[closed-problems/_map.md](closed-problems/_map.md) / [craft/_map.md](craft/_map.md)
- Wave103〜105 の authoring-host / software renderer / renderView・測量・健診装備は final pass 済み。Wave107 は Runtime Player 側の歴史的実装 evidence であり、後続の Wave22/23 が現在の母音 semantics を所有する。

### Human / device gates

- **post-45d PNG 再認証**: 2026-07-03 の Default 衣装 PNG 3枚の承認は当時の Wave105 artifact に対する記録。commit `45d2734`（2026-07-26）で `experiments/ref-render-gate/*.png` が置換されたため、現在の bytes が同じ承認で覆われるかは未確認。[experiments/ref-render-gate/README.md](experiments/ref-render-gate/README.md)
- **Wave107 → Wave22/23 母音リップシンク実機 gate**: Wave107 の nearest-reference / 単一勝者を現在仕様とみなさず、Wave22/23 の mouth-open `w → s` と正規化5母音 blend を実モデル + iFacialMocap で確認する。対象は遷移、閉口ゼロ、ちらつき/ジッタ、ON/OFF、strength。[Wave107 final report](../implementation/waves/wave107/wave107-final-integration-report.md) / [Wave22 final report](../runtime-player/implementation/waves/wave22/wave22-final-integration-report.md) / [Wave23 final report](../runtime-player/implementation/waves/wave23/wave23-final-integration-report.md)

### User decisions / acceptance choices

- 次の閉問題のテーマ・番号・開始時期はユーザーが選ぶ。`closed problem 02`（目の開閉）を自動的な次の行動として予約しない。
- strict-ref 97 件の分類方針、sidecar portability の受入れ条件、別対象への craft 再走、post-45d PNG の同一性は、実装 pass から推論せずユーザーが決める。

## 閉問題 01: 通過（2026-07-03、ユーザー判定 100/100）

**「100点満点で評価するなら文句なしの100点だ。期待していたものとの差、という意味なら君は期待の数段上を超えてきた」**——問い B は Yes、初回満点。閉問題アプローチの第 1 サイクル（定義→A調査→武器製造→実験→gate→蒸留）が完全に一周し、craft/ が開設された。詳細: [results.md](closed-problems/01-eyeball-x/results.md)。

## 閉問題 01 実験: 完走記録

新規ワークスペース `C:/workspace/remie/rigging/llm-rigging`（ref と同一 PSD、ユーザーがインポート・保存・git init）に対し、Fable が L0 直接・委任なしで 6 操作全てを headless CLI 経由で committed（rev 5→18、git 原子コミット 13）。三段検証（dry-run スキーマ / 巻尺の数値が設計値と小数点一致 / sweep + 高倍率ズームの自己目視）通過。reject 2 回（preset 重複・warp への translation）はいずれも無傷回復し craft 発見に転化。詳細: [experiment-log.md](closed-problems/01-eyeball-x/experiment/experiment-log.md)。

## ユーザー目視 gate: 当時の artifact に対する承認（2026-07-03）

**ユーザー判定: 「完璧だ、これであっている」。** Wave105 再生成の PNG 3 枚（Default 衣装）に対する人間承認は、その時点の artifact に対して成立した。判定梯子の最上段（段 5: ユーザーの目）が行使され、閉問題 01 の実験開始条件を満たした、という歴史的記録である。

ただし commit `45d2734`（2026-07-26）で `experiments/ref-render-gate/*.png` の bytes が置換された。したがって「Wave105 当時の PNG gate は通過」と「現在の PNG bytes も承認済み」は別の主張であり、後者は再認証待ちである。

## 補記（2026-07-03）

- **Wave105 final complete / pass**（[計画](../implementation/orchestration/wave105-plan.md) / [最終報告](../implementation/waves/wave105/wave105-final-integration-report.md)）: Variant 可視性ゲート（snapshot レベル、目と巻尺が同一の可視性世界を共有、optional `variantSelections`、空ケース挙動不変）。wave104 版 PNG の約 9 drawable 余分描画は解消、Fable 自身も新旧 PNG の差（3 衣装重畳 → Default 単独）を視覚で明確に弁別できることを確認（弁別力データ点）。
- **artifact-wait プロトコル実戦実証**: Orch-Sylph の在席ポーリング（PowerShell Start-Sleep）で L0 中継ゼロのドメインループ完走を二度実証。確定版は `.claude/skills/implementation-orchestration/SKILL.md` 規則 1-5、統制実験の記録は [research/delegation-calibration-log.md](research/delegation-calibration-log.md) Round 4。

## 決着済みの元・未決事項（2026-07-02 ユーザー決定）

- 承認 gate: ai-interface 経由（案 A）+ 自動承認ポリシー = dry-run を機械的検証ゲートとして再解釈
- 知覚経路: ホスト内で生きた AuthoringSession から直接描画（Runtime Export 経由は不要と決着）。要求仕様 = 目（renderView + フレーミング + コンタクトシート）/ 測量（評価済みジオメトリ照会）/ 変換器（サイドカーのビュー変換）の三位一体
- 実装 wave の置き場: 既存 implementation/ 機構の続番（wave103〜）
- ラスタライザ方式: 純 TS ソフトウェアラスタライザ（ネイティブ GL 不採用）。ホスト形態: ワンショット CLI

## 未決事項

- Git コミット粒度は craft の運用不変量（1 committed operation = 1 git commit）として確定済み。別個のポリシー文書を追加するかはユーザー判断。
- Fable の視覚弁別力は 01-eyeball-x / Wave105 の記録に観測データ点あり。新たな測定を行うかはユーザー判断であり、現行 gate の未完了を意味しない。
- コマ列グリッド生成の手段（欠落部品の一部として実装 wave で扱う見込み）
