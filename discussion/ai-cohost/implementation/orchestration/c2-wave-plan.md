# AI Cohost C2 Wave Plan: 身体が呼吸する(まばたき)

> Objective: 自律ホストでRuntime Exportを読み込むと、入力ゼロでモデルが瞬きする(Native Stage / Browser Source両方)。トラッキングホストは挙動等価。生成器は固定シードfixtureで機械検証される。

## 1. Status

- Status: **完全閉鎖(2026-07-11)**。手動美的ゲート合格(ユーザー実施: 「ランダムに瞬きしているように見えるし、瞬きに違和感はない」。OBS Browser Source確認済み、トラッキング開始でAI側に影響なし・AI側の瞬きもトラッキング側に影響なし=二体並走の非干渉確認)。Q2(送信タイムスタンプの決定論化)は裁定どおり壁時計のままで確定(表示経路は決定性境界の外、P4)。以下は実装完了時の記録:
- (実装完了記録 2026-07-10) wave実装完了(Domain A→B→C→D)。 Domain A/B/C とも 3 レーン Review-Sylph PASS(blocking ゼロ)、Domain D(統合・検証・docs・手動ゲート手順)完了。機械ゲート green: runtime-player typecheck exit0 / アプリ回帰 606 pass・2 fail(既知 baseline=Wave21 `effectiveDynamicsTuning`、3 連続ラン安定・フレークなし)/ root typecheck exit0 / packages 1492 pass。Editor・package-format・Runtime Export schema・lockfile・`pnpm-workspace.yaml` 無変更、新規依存なし、`pnpm install` 不実施、実行時 role 分岐ゼロを確認。実装報告 → [../waves/c2/domain-a-headless-resolver.md](../waves/c2/domain-a-headless-resolver.md) / [../waves/c2/domain-b-blink-generator.md](../waves/c2/domain-b-blink-generator.md) / [../waves/c2/domain-c-frame-heart-composition.md](../waves/c2/domain-c-frame-heart-composition.md) / [../waves/c2/domain-d-final-integration.md](../waves/c2/domain-d-final-integration.md)、レビュー [../reviews/c2/](../reviews/c2/)。残タスク: §9 の手動美的ゲート(ユーザー実施、手順は Domain D 報告)。合格で C2 完全閉鎖。(初稿 Status: Ready to launch。)
- Planning gate: inventory then plan(実施済み → [c2-planning-inventory.md](c2-planning-inventory.md)。Verdict `needs_design` → 下記ユーザー裁定で解消)。
- Model Allocation: **L0 = fable / Orch-Sylph・Gnome・Review-Sylph = opus 明示必須**。
- ユーザー裁定(2026-07-10):
  1. **写像シーム=Option B(非破壊抽出)で確定**。`createRuntimeParameterFrame()` の中身を「活性度+スロット→parameterValues」の頭無しリゾルバとして抽出し、**トラッキング経路も同一リゾルバを呼ぶ形に揃える**(「まぶたの解決」の知識は一箇所)。トラッキング側の退行ゼロは等価性テストで保証。リファクタが危険と判明したらescalate。
  2. **生成器の置き場= `apps/runtime-player/src/main/physiology/`(Electron importゼロの純関数)**。「package-readyな純度」はレビューのblocking観点。packagesへの物理移動は第二段まで繰延([../../architecture/physiological-layer-and-envelope.md](../../architecture/physiological-layer-and-envelope.md) §2 繰延注記)。
  3. **フレーム心臓=60Hz周期タイマー(main)**。生成器の芯は「種+設定+論理時刻→意味スロット列」の純関数で、心臓が壁時計→論理時刻の変換を担う。fixtureは固定タイムステップで回す(決定論維持)。
  4. **左右同値供給**(左右ずれ非ツマミの決定どおり)。
  5. **極性=既存スロット語彙の意味論**(blink活性度 0=開/1=閉)。新しい極性を発明しない。
- Source of truth(実装前に読む):
  - 本計画。
  - 設計討議: [../../architecture/c2-blink-and-generator-skeleton.md](../../architecture/c2-blink-and-generator-skeleton.md)
  - 棚卸し(コード接地事実): [c2-planning-inventory.md](c2-planning-inventory.md)
  - 生理層の意味レベル: [../../architecture/physiological-layer-and-envelope.md](../../architecture/physiological-layer-and-envelope.md)
  - 閉問題定義: [../closed-problem-decomposition.md](../closed-problem-decomposition.md)(C2)
  - wave方式: [../../../runtime-player/implementation/orchestration/runtime-player-wave-planning-conventions.md](../../../runtime-player/implementation/orchestration/runtime-player-wave-planning-conventions.md)(方式継承)

## 2. Product Goal

この波の後にできること:

- 自律ホストでRuntime Exportを読み込むと、設定ゼロでモデルが瞬きしている(「読み込まれた身体は生きて生まれる」)。Native StageとBrowser Sourceの両方で。
- まばたきは普遍既定値で動く(ツマミ・UI・シード露出は一切なし)。
- トラッキングホストは今日と挙動等価(顔トラッキング由来のまばたきのまま。生成器は合成に存在しない)。
- 生成器は固定シードfixture(「同じ種と設定→同じ意味スロット列」)で機械検証される。

## 3. 責務境界

### 3.1 この波がやること

- 頭無しリゾルバの非破壊抽出(裁定1)と、トラッキング経路の同一リゾルバへの揃え。
- 生成器骨格: まばたき振る舞いクラス(内部スキーマ6要素+普遍既定値、baseline×modulation形)、レパートリー拡張可能な構造、シード付き決定論。
- フレーム心臓: mainの60Hz周期タイマー、タイムスタンプ/sequence単調供給、`publishLatestParameterFrame` 経路への接続(Stage IPC+Browser Source WSの既存sanitization境界のまま)。
- 役割合成: autonomousHost合成の inert な静的入力サブシステムを生成器駆動composerに差し替え(C1のdata-lookupテーブル拡張。実行時role分岐禁止)。
- 失敗も沈黙: 写像できないスロットは既存挙動どおり黙って落ちる。

### 3.2 この波がやらないこと(Out of Scope)

- 呼吸・視線・頭・姿勢(呼吸keyformは未作成。生成器骨格に拡張点を残すのみ。視線/頭はC3)。
- ツマミの露出・生理プロファイル画面(C3)、質感語UI。
- パッケージのエンベロープ宣言(第二段)、魂の変調(C5)、操縦チャネル(C4)。
- 新package作成・lockfile変更・`pnpm install`(裁定2の繰延)。
- Editor / package-format / Runtime Export schema の変更。
- トラッキングホストへの生成器導入(トラッキング喪失時の生理フォールバックはC5の合成の話)。

## 4. 設計要点(棚卸し接地)

### 4.1 頭無しリゾルバ(Domain A)

- `createRuntimeParameterFrame()`(`live-mapping/runtime-parameter-frame.ts`)内部の重み計算(`createWeightValue` 系)を「活性度+スロット定義+auto-mapping結果 → sanitized parameterValues」の純関数として抽出。
- トラッキング経路は抽出後のリゾルバを呼ぶ形に非破壊で書き換え、**抽出前後の出力等価性テスト**を必須とする。
- `eye-blink-*` スロットの素の既定(defaultInvert:true / defaultStrength:1)が生成器活性度で正しく動くことをテストで固定。

### 4.2 生成器骨格(Domain B)

- 置き場: `apps/runtime-player/src/main/physiology/`。**Electron importゼロ**(node built-inも時計・乱数を含め持ち込まない: 時刻は論理時刻として引数で受け、乱数はシードから決定論的に導出)。
- まばたき振る舞いクラス: 内部スキーマ6要素(平均頻度 / ばらつき+不応期 / 二連確率 / 閉速・開速非対称 / 保持 / 深さ)+普遍既定値。スキーマはbaseline×modulation形(C2ではmodulation=恒等)。
- 出力: 意味スロット値のRecord(`eye-blink-*` 両目同値、blink活性度極性)。
- レパートリー拡張点: 振る舞いクラスの追加(将来の呼吸等)が生成器本体の変更なしに足せる形。

### 4.3 フレーム心臓(Domain C)

- mainプロセスの60Hz周期タイマー。壁時計→論理時刻の変換、タイムスタンプ/sequenceの単調供給。
- 生成器出力→リゾルバ→`publishLatestParameterFrame` の接続。既存のsanitization境界・rAF合流・dynamics前進(`sourceFrameTimestampMs` 差分)にそのまま乗る。
- autonomousHost合成のみに組み込む(C1の役割→合成テーブルの一点。trackingHostは無変更)。
- ライフサイクル: Runtime Exportロード完了で開始、アンロード/quitで停止。タイマーリークを残さない。

### 4.4 沈黙

- まぶたスロットが写像できないモデルでは静止のまま。エラーダイアログ・ログ洪水を出さない。

## 5. Wave Strategy

単一のOrch-SylphがDomainを順次実行する(A→B→C→D)。AとBは独立性が高いが、ゲートを一つずつ君へ届ける規律とファイル交差リスク(リゾルバ契約)を優先して並列化しない。

| Domain | Work | 順序 |
|---|---|---|
| Domain A | 頭無しリゾルバ抽出+トラッキング経路の揃え+等価性テスト | 先行 |
| Domain B | 生成器骨格(まばたき+fixture)。純関数、リポジトリ流儀のfixtureテスト | Aの後(リゾルバ契約を参照) |
| Domain C | フレーム心臓+役割合成統合(60Hzタイマー、publish接続、autonomousHost合成差し替え) | A/Bの後 |
| Domain D | 最終統合: モノレポ検証、docs/maps更新、手動ゲート手順、clean review | 最後 |

## 6. Domain A: 頭無しリゾルバ

Suggested subagent name: `cohost-c2-headless-mapping-resolver`

### Required Behavior / Tests

- リゾルバ抽出(純関数)。トラッキング経路が同一リゾルバを呼ぶ。
- **等価性テスト: 代表的なTrackingFrame入力群で抽出前後の `parameterValues` が完全一致**。
- 活性度直接入力でeye-blinkスロットが正しい向き・範囲で解決される。
- 未写像スロットは黙って落ちる(既存挙動維持)。
- Runtime Export / package-format 無変更。

### Escalate 条件

- 非破壊抽出が既存トラッキング経路の挙動を変えずに行えない構造だった場合。

## 7. Domain B: 生成器骨格

Suggested subagent name: `cohost-c2-blink-generator`

### Required Behavior / Tests

- physiology/ に純関数生成器(裁定2の純度制約)。
- fixture: 「種X+既定設定→この意味スロット列」のgolden test。同種同列・異種異列。
- 分布性質のテスト: 不応期を破らない、二連瞬きが設定確率で出る、閉/開の非対称エンベロープ形状、両目同値、深さ・保持の反映。
- 設定値もfixture入力(設定を変えても決定論)。
- Electron/壁時計/Math.random非依存であることを構造的に確認(レビューblocking観点)。

### Escalate 条件

- 決定論とリポジトリ流儀の乱数慣行が両立しない場合。

## 8. Domain C: フレーム心臓と統合

Suggested subagent name: `cohost-c2-frame-heart-composition`

### Required Behavior / Tests

- 60Hzタイマー(fake timerでテスト)。タイムスタンプ/sequence単調。
- 生成器→リゾルバ→publish の配線。sanitized境界維持(rendererにrawスロット/シード/私的情報を渡さない)。
- 役割合成: autonomousHostのみ心臓+生成器が存在(合成テーブルの差し替え)。trackingHost合成に心臓・生成器が**存在しない**ことのテスト。
- ロード/アンロード/quitでの開始・停止、タイマーリークなし。
- 実行時 `if (role===...)` 分岐ゼロ。

### Escalate 条件

- publish経路がフレーム源の差し替えを想定しない構造で、広い改修が要る場合。

## 9. Domain D: 最終統合 / docs / clean review

Suggested subagent name: `cohost-c2-final-integration`

### Required Behavior

- モノレポ検証(typecheck / 対象テスト / 既知baseline failの明示)。
- Editor・package-format・Runtime Export schema・lockfile無変更確認。`pnpm install` 不実施確認。
- 実装事実に合わせた関連docs更新(c2設計討議、physiological設計、各map。未合意の新方針は勝手に決めない)。
- ユーザー手動ゲート手順を final report に含める(下記)。

### Manual Check Notes(ユーザー手動ゲート)

1. 自律ホストを起動しRuntime Exportを読み込む → 設定なしで瞬きが始まる。
2. **30秒眺めて「死体に見えないか」「機械のループに見えないか」を判定する(C2の美的ゲート本体)**。
3. OBS Browser Sourceでも同じまばたきが見える。
4. トラッキングホストを起動し顔トラッキングで従来どおり動く(まばたき含め退行なし)。
5. 二体並走で自律ホストの瞬きとトラッキングの瞬きが互いに干渉しない。

## 10. Acceptance Criteria

- 自律ホストでロード後、入力ゼロ・設定ゼロでまばたきが動く(Native Stage / Browser Source)。
- 固定シードfixtureがパスする(機械ゲート)。
- 等価性テストによりトラッキング経路の出力が抽出前後で完全一致。
- physiology/ にElectron import・壁時計・非シード乱数が存在しない(純度)。
- trackingHost合成に生成器・心臓が存在しない。実行時role分岐ゼロ。
- 失敗(未写像)は沈黙。エラーUI・ログ洪水なし。
- Editor / package-format / Runtime Export schema / lockfile 無変更。新規依存なし。`pnpm install` なし。
- 対象テスト・typecheckパス、または失敗が証拠つきで分類される。

## 11. Subagent Contract

- `pnpm install` 禁止(回避工作も禁止。必要ならescalate)。
- Editorソース・package-format・Runtime Export schema・lockfileを変更しない。
- 実行時role分岐を書かない(役割差は合成テーブル一点)。
- C1の成果(スロット基盤、役割合成、身元表示、閉扉/ロック挙動)を退行させない。
- Browser Source = primary broadcast path、Wave10 suspension、Wave11 Stage Motion、Wave12 Variant、Wave17 fast path、Wave18/19 diagnostics、Wave20 lifecycle、Wave21 Dynamics Tune、Wave22/23 vowel lip sync を退行させない。
- physiology/ の純度(Electron importゼロ・論理時刻・シード乱数のみ)を守る。
- 無関係変更をrevertしない。挙動が決定論的な箇所にfocusedテストを付ける。
- ドメイン想定外の共有ファイルに触る前に報告する。

## 12. Review Policy

各実装ドメインに**3レーンのReview-Sylph(別subagent、統合禁止)**: ①spec compliance(本計画+c2設計討議突合) ②design/development compliance ③test adequacy。

blocking観点:

- 実行時role分岐の不在。
- physiology/ の純度(package-ready)。
- トラッキング経路の等価性(Domain Aの等価性テストが実効か)。
- sanitization境界の維持(rendererへシード・rawスロット・私的情報を流さない)。
- タイマーのライフサイクル(リーク・quit阻害なし)。

## 13. Orchestration Policy

本waveは Implementation Orchestration skill(`.claude/skills/implementation-orchestration/SKILL.md`)の全規則に従う(C1と同一: ネスト分離 / 在席ポーリング / 閉域 / モデル明示 / ループ上限5 / 早期脱出 / 必須文言)。

- L0(Undine): 計画・裁定・最終判定。実装しない。
- Orch-Sylph: 単一。Domain A→B→C→Dを順次。実装はGnome、レビューは3レーンReview-Sylphへ委譲。成果物は `../waves/c2/` / `../reviews/c2/`。
- 設計に無い判断分岐は実装で埋めずescalate(L0が裁定して本計画/設計討議を改訂)。
- 子が未完・実行中・未解決のままwave gateを通過しない。
