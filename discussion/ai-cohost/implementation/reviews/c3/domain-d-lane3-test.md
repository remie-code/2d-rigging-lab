# C3 Domain D レビュー — レーン3: test adequacy

> レビュー: Review-Sylph、2026-07-11。委任元: Orch-Sylph。対象: `apps/runtime-player`(C3 Domain D `cohost-c3-stage-presence`)。
> basis: [c3-wave-plan.md](../../orchestration/c3-wave-plan.md) §4.4/§6 Domain D/裁定6、[c3-gaze-head-posture.md](../../../architecture/c3-gaze-head-posture.md) §5、Gnome報告 [domain-d-stage-presence.md](../../waves/c3/domain-d-stage-presence.md) §4。
> 手段: 対象テスト全読+自分でテスト実行(full suite + Domain D 個別)+git 差分検証。ソース修正なし。

## 判定: **合格**

§6 Domain D の必須3項目(供給on/off・既存settings非接触・Browser Source parity)およびレーン3観点1〜9は、すべて**不正実装を落とせる形で**固定され、実際にパスする。要修正なし。将来退行を許す軽微なカバレッジの隙を N1〜N3 に記録(いずれも今日の必須挙動を偽陽性で通すものではなく、非ブロッキング)。

## 実行確認

- **全体**: `pnpm --filter @private-2d-rigging-lab/runtime-player exec vitest run` → **728 passed / 2 failed**(報告値を再現)。
- **2 failed = 既知 baseline(Domain D 対象外)**:
  - `src/stage/browser-source/browser-source-server-message.test.ts:216`(`accepts the not-loaded response shape`)
  - `src/main/broadcast-source/browser-source-server.test.ts:150`
  - いずれも差分は `+ "effectiveDynamicsTuning": null` の1キーのみ(Wave21 shape)。両ファイルとも **git 無変更**(Domain D の diff に含まれない)。browser-source系で、physiology/stage-presence とは無関係。
- **Domain D 個別**(presence + stage-motion-runtime + autonomous-frame-heart + input-subsystem + boundary)→ **46 passed / 46**、決定論的にパス。physiology/stage-presence 系は一度も落ちない(flaky は browser-source 側のみ)。
- **typecheck**: 報告どおりパス(再実行省略、diff は型安全な追加のみ)。

## 観点別評価

| # | 観点 | 判定 | 根拠(落とせる形か) |
|---|---|---|---|
| 1 | 供給 on/off | ✓ | `stage-motion-runtime.test.ts`: drive(strength1,入力1)→ `{zoomScale:1.05, pan.x:70}`、disabled→ base一致 + `nativeDisplayTransform` null。off で native override を消さない実装を落とす。 |
| 2 | 既存 settings 非接触 | ✓ | 「drive settings が window-state に勝つ」テスト: window側 1000px を与えても drive の 0.5×60=30px が出る。加えて `stage-presence-drive.ts` は window-state を import せず、`window-state-stage-motion-settings.ts` は **git 無変更**。tracking経路がwindow-stateを誤用する実装を落とす。 |
| 3 | Browser Source parity | ✓ | drive path の `browserSourceTransform` のキーが `coordinateSpace/pan/zoomScale` のみ(sortして厳密一致)、`nativeDisplayTransform===browserSourceTransform`。transport `stage-motion-transport.ts` は **git 無変更**。raw信号/seed の流出を落とす。 |
| 4 | autonomousHost のみ供給 | ✓ | `input-subsystem.test.ts`: trackingHost→`getStageMotionDrive()===null`、autonomousHost→drive(入力・timestamp・settings が heart+derive由来)、off→disabled drive、provider無し→null。既存 tracking stage-motion テスト2本は **git diff上 追加のみ(既存アサーション不変)**。 |
| 5 | strength スケール妥当性 | ✓ | `stage-presence-drive.test.ts`: strength 0→0、0.3→60×0.3/0.05×0.3(=18px/0.015)、1→60/0.05、単調増加(0/.25/.5/.75/1)、limit==max かつ≥strength(非clip)。**camera-follow 既定より小**は実定数(`runtimePlayerDefaultStageMotionSettings` = 80px/0.06)への live 比較で固定 → 定数が動けば追随。 |
| 6 | 姿勢信号 getter | ✓ | `autonomous-frame-heart.test.ts`: 空slotsでも body-x 0.4/body-z -0.2 を返す(=resolver前・raw activation を捕捉、centered信号)、blink-only→horizontal/depth null(timestampは進む)、start前 null、stop で null クリア。slots経由に依存する実装を落とす。 |
| 7 | timestamp smoothing | ✓ | frame1(ts=0)→60、frame2(ts=16,target0)→ 0<pan.x<60。`drive.timestampMs` 経由の elapsed を用いる。固定elapsed/即時target/前値保持のいずれも落とす(フレームレート非依存を固定)。 |
| 8 | 退行ゲート | ✓ | `blink-default.golden.json`/`blink-alt-config.golden.json` 共に **git 無変更**。純計算器 `stage-motion-transform.ts`・transport・window-state settings も **git 無変更**(Domain D は再利用のみ)。 |
| 9 | 実行確認 | ✓ | 上記「実行確認」。728/2 再現、2 fail の内訳が既知 baseline(browser-source, effectiveDynamicsTuning shape)であることを diff で確認。 |

## カバレッジの隙(非ブロッキング / 将来退行の予防メモ)

- **N1: `deadZone`(0.02)/`reaction`(6)の定数がテストで固定されていない。** derive テストは strength スケールのみ検証し、`deadZone`/`reaction` を assert しない。これらを誤って変更(例: deadZone を大きくする)すると、既定 strength 0.3 の**控えめな微動(小振幅の姿勢信号)が無音化**し得る——設計§5「遅い drift は残す/micro-jitter のみ切る」意図に反するが、失敗するテストが無い。derive の返り値スナップショット(deadZone/reaction/invert 含む)を1つ足すと将来退行を塞げる。
- **N2: 「enabled な drive + 姿勢入力 null(blink-only autonomous)→ base」の統合アサーションが無い。** getter の null(heart側)と純計算器の null→0(pure calc側)は各々テスト済みだが、その合成(subsystem が null入力の drive を組み、runtime が base に落とす)を runtime レベルで直接固定していない。stage-motion-runtime の drive テストは全て非null入力。振る舞いは各層で担保されるが、経路そのものは未pin。
- **N3: getter の「毎tick更新」が未固定。** 単一tickのみ検証で、初回tickだけスナップショットして以後更新しない実装でも通る。低リスク(生成器は毎tick sample、getterは最新参照)。

いずれも今日の必須挙動を偽陽性で通すものではなく、判定は合格。N1 が最も価値が高い(1アサーションで塞げる)ため、Domain E か軽微修正で拾えると望ましい、程度の推奨。

## 質問

- なし。basis と実装・テストの対応は追跡可能で、escalate/blocked も無い。
