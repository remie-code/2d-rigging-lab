# C4 Domain D レビュー(Lane1: spec突合) — 特区 apps/soul + 参照ドライバ + 持続駆動 + RTT + 方向ルール検査

> Review-Sylph(Lane1=spec突合)→ Orch-Sylph。task=`cohost-c4-soul-zone-reference-driver`。
> 判定基準: c4-control-channel-v0(§1/§7/§8)+ mvp-boundary-amendment §6(特区憲章6条+訂正)+ c4-wave-plan(裁定4/5/6/7/§8 AC)。
> 読み取り専任。他2レーン(design/test)とは独立。**自分で対象ファイルを読み・境界検査を実行し・持続駆動テストを走らせて実証確認済み**。

## 判定: **合格**

全 blocking spec 観点が満たされ、機械ゲート(境界検査・持続駆動テスト)を自分の手で走らせて緑を確認した。lockfile 無変更・`apps/soul` に package.json 無しも実確認。blocking 差分なし。

---

## spec 観点ごとの評価

### 1. 参照ドライバのシナリオ(設計§7・blocking) — 適合
`apps/soul/reference-driver/reference-driver.mjs` を通読。
- **注視→傾げ→沈黙→再開→意図的切断→再接続** をタイムテーブルで流す: `gazePhase`(gaze-horizontal/vertical)→ `tiltPhase`(head-tilt/head-horizontal)→ `delay(SILENCE_MS)` 沈黙 → `resumePhase` → `first.close()` 意図的切断 → `reconnectPhase`(head-tilt/eye-blink-left)。計8インテント・2接続。設計§7の6動作すべてを網羅。
- **hello 受信→capabilities 確認**: `connect()` が `server.hello` を待ち、`helloPayload.supportedKinds` が契約の `expectedKinds`(`intent.set`)を満たすか照合。欠落なら throw。
- **意味スロット語彙・正規化域内**: 全 slotId(head-horizontal 等)は契約 enum に収まり(実測: schema enum に全て存在)、値は centered -1..1 / weight 0..1 の域内。送信前に `vocabularyViolations` で契約語彙自己照合。
- **TTL 明示/省略の混在**: 明示(400/300/600/300/200)と省略(gaze-vertical・resume gaze-horizontal)を意図的に混ぜる。設計§4の (b)明示 /(c)ストリーミング両様式を体現。
- **未知イベント黙殺(寛容規則§3.5)**: 非JSON(`JSON.parse` 失敗)・相関先の無い `replyTo`・その他未知 kind を `unknownEventCount` に計上して無視。クライアント側の寛容義務を履行。

### 2. RTT ゲート(裁定7・blocking) — 適合
- `sendIntent` が `performance.now()` で送信時刻 `t0` を記録し、`replyTo` 相関の応答受信時刻との差を RTT サンプル化。全8インテント計測。
- p95 は nearest-rank で算出、レポート `gate.p95BudgetMs:100 / p95WithinBudget` を出力。判定は器側 vitest(`expect(report.rttMs.p95).toBeLessThan(100)` + `gate.p95WithinBudget === true`)。
- **実測(自分で `vitest run` 実行)**: 持続駆動テスト **PASS**(958ms)。p95 < 100ms を満たす。裁定7「p95 < 100ms(loopback、緩め)」を機械ゲート化。
- 非blocking: n=8 のため nearest-rank で p95=max に一致(上位サンプル一致)。裁定7が「loopback 緩め・後で締める余地」と明記しており、この粒度は設計意図の範囲内。報告§5も認識済み。

### 3. 持続駆動の縦貫通(設計§1・wave-plan§8・blocking) — 適合
`reference-driver-sustained-drive.test.ts` を通読・実行。
- **外部プロセス→WS→token→契約検証→overlay→heart** の縦貫通: `child_process.spawn` で `.mjs` を外部プロセス起動 → 実 `RuntimePlayerControlChannelServer`(token 認証・契約検証)→ 実 `RuntimePlayerControlChannelOverlayStore` → 実 `createAutonomousFrameHeart`。生成器 baseline を head-horizontal=0 に固定した決定論スタブで、published frame の非0値を overlay 由来と一意帰属。
- **fixture の face.angle.x 相当が動く**: head-horizontal=0.5 → centered 写像で `ParamAngleX ≈ 15`。`value ≥ 5` のフレームを filter して `> 0` を検証(縦貫通の証人)。
- **フレーム停滞なし**: `finalSequence - baselineSequence > 20` + 全フレーム厳密単調増加。
- **切断/再接続成立**: `report.reconnected === true`、再接続後2インテント含む全8 accepted。
- **切断→基底復帰**: ドライバ切断後の最終フレーム `ParamAngleX === 0`。
- 実測: 自分で `vitest run` → **1 test PASS**。

### 4. 特区憲章適合(§6・blocking) — 適合
- **package.json/依存なし(裁定4)**: `ls apps/soul/package.json` → 不在を実確認。`git diff --stat pnpm-lock.yaml pnpm-workspace.yaml` → 空(0行、lockfile 無変更を実確認)。
- **`.mjs`・依存ゼロ・Node22ネイティブ WebSocket(裁定5)**: import は `node:fs`/`node:perf_hooks`/`node:url`/`node:path`(組込)+ グローバル `WebSocket` のみ。npm 依存・トランスパイラ無し。素の `node ...mjs <url>` で直実行を実確認(引数なし=exit2、接続不能=exit1)。
- **魂が import するのは契約(型・fixture=JSON)だけ(§6.2)**: ドライバは契約 JSON を `readFileSync` で読むのみ(import 文ではない)。器コードの import はゼロ。`contractSource: "contract-json"` を持続駆動テストが検証(fallback でない=実契約を読んでいる)。
- **器側が魂を import しない(§6.3)**: 実リポジトリ境界検査 → 1243 files scan・違反ゼロ(緑)を自分で実行確認。

### 5. 方向ルール検査2ルール(裁定6・憲章§6訂正・blocking) — 適合
`scripts/check-soul-zone-boundary.mjs` を通読。
- **2ルールのみ**: `findSoulZoneBoundaryViolations` は ①器→魂 import ②魂→器コード import(`.json` は許容)の2判定だけ。汎用DAG検証・循環検出・bare npm 制約は無し。相対 import specifier のみ解決対象(裁定6「魂↔器の path 越え依存に限る」に一致)。
- **検証パイプライン組み込み**: `package.json` diff は3行のみ = `check:soul-zone`(ガード)+ `check:soul-zone:fixtures`(自己テスト)+ composite `check` へ `check:soul-zone` 連結。`check:testids` 先例(ガードは標準 check・`:fixtures` は分離)に整合。
- **違反fixtureで赤くなることの実証**: `node scripts/check-soul-zone-boundary-fixtures.mjs` を自分で実行 → 3 cases PASS(valid=exit0緑 / invalid-vessel-imports-soul=exit1赤「器→魂」 / invalid-soul-imports-vessel=exit1赤「魂→器」)。fixture 中身も確認: valid は `.json` を **import 文で**参照しても緑(ルール2の.json許容の実証)、invalid2種は器コード `.ts`/`.mjs` の越境を実装。
- **現状で緑**: 実リポジトリガード実行 → 緑(実確認)。

### 6. fixture 引き渡しの形(設計§8) — 適合
- 契約は言語中立(JSON over WS)、参照ドライバ本体は `.mjs`、契約の正は `apps/runtime-player/src/main/control-channel/contract/*.json` 側。ドライバは JSON を primary(`contract-json`)、フォールバック語彙を secondary とし、契約=正を尊重。README も憲章6条+住人=参照ドライバを記述、依存を持たない .md。

### 7. スコープ遵守 — 適合(下記の限界つき)
- ドライバは実生成器でなく `createGenerator` seam の決定論スタブを注入し、`physiology/` を無変更(縦貫通の帰属明確化のため)。設計§6の生成器純度規律に整合。
- `apps/soul` 新設 + `scripts/` 3ファイル + `package.json` 3行のみが Domain D の追加。
- **限界**: 作業ツリーに C4 全ドメイン(A/B/C/D)が未コミットで同居するため、Domain D の diff を A/B/C から git 単独では機械分離できない(質問1)。ただし lockfile 無変更・physiology 無変更・境界検査緑・持続駆動テスト緑は確認済みで、Domain D 起因の A/B/C 退行の兆候は無い。

---

## 差分

### blocking
- なし。

### non-blocking(観測。修正必須ではない)
1. **RTT サンプル n=8 で p95=max**: 裁定7 が「loopback 緩め・後で締める余地」と明記しており設計意図内。実物の魂/長時間駆動でサンプル数が増えれば自然に解消。C5 で締める際の留意点としてのみ記録。
2. **境界検査は相対 import のみを対象**: tsconfig alias / bare specifier 経由の越境は path 解決不能で対象外(報告§7が明記)。ただし `apps/soul` は package.json 無しゆえ workspace パッケージ参照も alias も実質不能で、現実的な抜け道は塞がれている。裁定6「2ルールのみ・path 越え依存に限る」の範囲内で spec 違反ではない。将来 alias 経路が生じ得るなら follow-up 検討。

---

## 質問(Orch/後続判断が要る点)
1. **Domain D diff の分離検証**: C4 全ドメインが未コミット同居のため、Lane1 では「Domain D が A/B/C を再変更していない」を git diff で単独実証できなかった(lockfile 無変更・physiology 無変更・境界検査緑は確認)。Domain E の clean review で全体 diff を A/B/C の各報告と突合する運用でよいか(本 Lane の spec 観点としては合格判定に影響なし)。
