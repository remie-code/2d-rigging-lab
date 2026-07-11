# レビュー: C5 追撃 Domain G — レーン2 (test adequacy)

担当: Review-Sylph (Orch-Sylph からのサブエージェント委任) / 日付: 2026-07-11
ブランチ: `feature/2d-rigging-eco-system`
判定: **合格**

判定基準: wave plan §12 / architecture §7 / Gnome報告 `waves/c5/domain-g-followup.md`(裏取り対象)。
検証方針: 差分・被テスト側を自分で読み、対象テスト・全体スイート・境界チェック・ドライバ dry-run を**自分で実行**して確認した。Gnome の説明には依存していない。

> 実行環境の注記: `apps/soul/reference-driver/reference-driver.mjs` は Read / `git diff` の表示が化けて読めなかった(表示アーティファクト)。`node --check` で構文健全性を確認し、`node ... --print-timeline` の**実行結果**を接地事実として採用した(下記観点4)。他ファイル(.ts)は正常に読めた。

---

## 観点別の確認結果

### 1. 連続性boundが導出であること (blocking) — 適合

`control-channel-overlay-store.test.ts` の連続性 describe (L265-463) を精読。set の ease-in property テスト(L266-303)は per-tick bound を

```
attackStep  = (|peak-0| / DEFAULT_SET_ATTACK_MS) * SMOOTHSTEP_MAX_SLOPE * frameIntervalMs
releaseStep = (|peak-base| / DEFAULT_RELEASE_MS) * SMOOTHSTEP_MAX_SLOPE * frameIntervalMs
bound = max(attackStep, releaseStep)
```

と、`slot-curve-state.ts` から import した定数(`RUNTIME_PLAYER_SLOT_CURVE_DEFAULT_SET_ATTACK_MS`=100 / `..._RELEASE_MS`=400 / `RUNTIME_PLAYER_SMOOTHSTEP_MAX_SLOPE`=1.5)+ peak + frame interval から**導出**している。マジックナンバー固定なし。

- teeth の実証: peak=0.8 で bound≈0.192。即ステップ(1 tick で 0.8 跳躍)は 0.192 を遥かに超えるため、この bound は snap を確実に落とす(緩すぎない=導出理論最大傾きそのもの)。
- walk 範囲: `now=0 → expiresAtMs+releaseMs (=1400)` を 16ms 刻み。ease-in[0,100]→sustain[100,1000]→(失効)→release[1000,1400] の**全生涯を跨ぐ**(要件どおり)。
- 加えて re-attack seam を跨ぐ walk(L341-397, 両カーブのパラメータから導出)と、非ゼロ動く基底での decay 特性テスト(L399-462, 基底移動項も slope×interval で導出)があり、連続性の被覆は要件以上。

### 2. ease-in ramp のピン留め — 適合

`"eases in over the default ~100ms attack (smoothstep), NOT an instant step"`(L40-63):
- `snapshot(0)≈0`(startValue=0 起点、即peakでない)、
- `snapshot(1) < peak*0.5`(t=0近傍が即peakでないことの明示実証)、
- 0.25/0.5/0.75 点が `peak*smoothstep(・)` に一致、
- `snapshot(attack)≈peak`(attack終端でpeak到達)。
即ステップ(旧 attack≈0)なら L49/L60/L62 で落ちる = テストに teeth あり。

### 3. TTL不変のピン留め — 適合

- `"preserves the TTL: drive-end stays at expiresAtMs"`(L65-77): `remainingTtlMs` 900/300、`activeOverlays(1000)=[]`。
- 短窓クランプ `"clamps the ease-in to a short TTL window"`(L79-91): window40<100 で attack=40 / sustain=0(`snapshot(40)≈peak`)/ `remainingTtlMs=40`(drive-end=expiresAtMs)。
被テスト側 `setOverlay`(overlay-store.ts L95-111)が attack を sustain から差し引く実装で drive-end=expiresAtMs を数式保証しているのと整合。要件の3点すべて固定済み。

### 4. ドライバ単体タイムライン検証 (blocking: 境界クリーン & 非flaky) — 適合

- **方向ルール厳守**: `reference-driver-perceptual-timeline.test.ts` は `child_process.spawn(process.execPath, [DRIVER_PATH, ...])`(既存 sustained-drive と同一前例)。`DRIVER_PATH` は `path.resolve(...,"../../../../soul/.../reference-driver.mjs")` の**文字列パス**であり import ではない。器→魂の相対 import・`import(変数)` 等の回避工作なし(grep で確認: node:/vitest/path 以外の import 無し)。`pnpm run check:soul-zone` = pass(1245 files, 器→魂 import 0)。
- **非flaky**: WS 接続なし・実時間待ちなし(`--print-timeline` dry-run の stdout 1行 JSON を parse)。**3回連続実行して全 pass**(RUN1/2/3 EXIT=0)。
- **検証内容の十分性**: 実ドライバ実行結果(`node ... --scenario=perceptual --print-timeline`)を接地事実として突合。envelope主体(≥3・`intent.set`不在)/ 各 attack∈[200,400](実値 300,300,400)/ 四節順序(expression-peak→layering-reattack→body-sustain→intentional-kill)/ ②が①と同一slot(head-vertical)かつ符号反転(0.6→−0.4)/ ③最長sustain(1500>600,>500)/ ④disconnect。テスト assertion と実出力が完全一致。

### 5. 持続駆動テスト無退行 (絶対条件) — 適合

`reference-driver-sustained-drive.test.ts` を既定(引数なし spawn)で**3回連続実行 → 全 pass**(EXIT=0)。
- intentCount 11 / accepted 11 / rejected 0 / RTT p95<100 / フレーム前進>20 / 縦貫通・切断→基底復帰 を通過。
- 実 compressed シナリオ(`--print-timeline` で確認)は head-horizontal set 0.5/ttl600 を保持 → +15。ease-in 100ms(≈6フレーム)後 sustain 500ms が peak を保持するため witness `head-horizontal>=5` は破綻せず成立。set の ease-in 化で証人は壊れていない。

### 6. 意図的置換が意図を保つか (虚偽緑化でないか) — 適合

- overlay-store set describe: 旧「set=即時適用」テストを `"eases in ... then holds the value flat through its TTL"` へ改名。サンプル点 500/999 は sustain 平坦部で値不変(0.4)。**即時適用の被覆は消えたのではなく**、専用の ease-in ramp テスト(観点2)へ置換されている(被覆は純増)。骨抜きでない。
- heart-overlay 2件(diff 確認): `setNow(32)→setNow(200)` へサンプル移動のみ。assertion(per-slot override で `ParamEyeLOpen` / Stage が合成後実効 body 0.9 に追従)は不変、value 期待も不変(timestampMs だけ 32→200 で整合)。ease-in 窓を避けているが、ease-in 自体は overlay-store 側で固定済みのため、ここで検証すべき本来の意図(override 追従 / Stage 追従)を骨抜きにしていない。

### 7. テスト実行の裏取り — 適合

自分で実行(すべて当環境):
- 対象3ファイル(overlay-store 19 / perceptual-timeline 1 / heart-overlay 10)= **30 passed / 0 failed**。
- sustained-drive = 3回 pass。perceptual-timeline = 3回 pass。
- 全体スイート = **860 passed / 2 failed(137 files: 135/2)**。2 fail は `browser-source-server.test.ts` と `browser-source-server-message.test.ts` の `effectiveDynamicsTuning: null` 形状差(Runtime Export payload 系)= Wave21 baseline。Domain G が触らない `broadcast-source`/`stage/browser-source` 配下で、本変更と無関係。分類は正しい。
- `check:soul-zone` = pass。`check:source` = 既知 C3 baseline 1件のみ(`physiology/index.ts` barrel、Domain G 未 touch)。
- **channel-server flake の追検証**: 全体実行1回で `channel-server.test.ts` は **9/9 pass**(flake 再現せず)。Domain G の6ファイルは `channel-server.ts` を touch していないため、Gnome の「WS ephemeral port の環境依存 flake・本変更起因でない」の主張は妥当(本変更起因の証拠なし)。

---

## 差分・懸念

- blocking 懸念: **なし**。
- 非 blocking 所見: なし(被覆は要件を満たし、むしろ re-attack seam / 非ゼロ動く基底の walk で要件以上)。

## 質問(Orch-Sylph へ)

1. Gnome 報告の質問1(heart-overlay 2件を Domain G の意図的置換に含める判断)について、レーン2観点では「set-immediacy を attack 窓内サンプルで固定していた同一クラスのテストであり、意図を保った sustain 深部への移動」で妥当と判断した(虚偽緑化でない)。最終的な scope 承認は Orch-Sylph / L0 の裁定事項として残す。
2. `reference-driver.mjs` の Read/diff 表示が当セッションで化けたため、同ファイルは**実行結果**で接地した(構文 OK・timeline 出力が test assertion と一致・sustained-drive 3回 pass)。レーン1(spec)側でソース逐語の確認が別途取れているなら二重に担保される。

## 判定

**合格**。test adequacy の全観点(blocking 5項目含む)を、被テスト側の精読と自分の実行結果で確認した。要修正なし。
