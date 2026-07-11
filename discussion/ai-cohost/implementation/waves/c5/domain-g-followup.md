# C5 追撃 Domain G 実装報告 — set の ease-in + 知覚シナリオ

担当: Gnome（Orch-Sylph からのサブエージェント委任） / 日付: 2026-07-11
ブランチ: `feature/2d-rigging-eco-system`
対象: wave plan §12 Domain G / 設計討議 §7 裁定3 改定 / choppiness 診断の修正方針（選択肢1+2）

---

## 変更ファイル一覧

| ファイル | 種別 | 概要 |
|---|---|---|
| `apps/runtime-player/src/main/control-channel/slot-curve-state.ts` | 器ソース | 定数 `RUNTIME_PLAYER_SLOT_CURVE_DEFAULT_SET_ATTACK_MS = 100` 追加。attack≈0 前提の docstring を ease-in 既定へ改訂。 |
| `apps/runtime-player/src/main/control-channel/control-channel-overlay-store.ts` | 器ソース | `setOverlay` を attack≈0 → 既定100ms ease-in（sustain 詰めで drive-end=TTL 不変）へ。docstring 改訂。 |
| `apps/runtime-player/src/main/control-channel/control-channel-overlay-store.test.ts` | テスト | set=即時適用の意図を ease-in へ意図的置換。ease-in ramp / TTL不変 / 短窓クランプ / set連続性 property を追加。 |
| `apps/runtime-player/src/main/role-composition/autonomous-frame-heart-channel-overlay.test.ts` | テスト | set immediacy を attack 窓内でサンプルしていた2件を意図的置換（sustain 深部へ移動、意図不変）。 |
| `apps/soul/reference-driver/reference-driver.mjs` | 魂（特区） | CLI 追加（`--scenario`/`--print-timeline`）。知覚シナリオ追加。圧縮シナリオの実行経路・出力・exit code は不変。 |
| `apps/runtime-player/src/main/control-channel/reference-driver-perceptual-timeline.test.ts` | テスト（新規） | ドライバ単体タイムライン検証（spawn + `--print-timeline`、WS/実時間なし）。 |

---

## 項目別 実装内容と設計判断

### 項目1: set の既定 attack≈100ms（ease-in）

- `slot-curve-state.ts` に `RUNTIME_PLAYER_SLOT_CURVE_DEFAULT_SET_ATTACK_MS = 100`（export、`RUNTIME_PLAYER_SLOT_CURVE_DEFAULT_RELEASE_MS` に倣う curve 系命名）を追加。
- `setOverlay(slotId, value, expiresAtMs)` を次のとおり改訂（**TTL(drive-end)不変が絶対条件**）:
  - `windowMs = max(0, expiresAtMs - startAtMs)`
  - `attackMs = min(RUNTIME_PLAYER_SLOT_CURVE_DEFAULT_SET_ATTACK_MS, windowMs)`（短窓クランプ。sustain が負にならない）
  - `sustainMs = windowMs - attackMs`（**attack ぶんを sustain から詰める**）
  - `decayMs = 0`, `releaseMs = this.#releaseMs`（不変）
  - `startValue = this.#effectiveStart(slotId)`（案B: 現在実効値。連続性原則 §3.1）
- これにより `slotCurveDriveEndMs = startAtMs + attack + sustain + decay = startAtMs + windowMs = expiresAtMs`。`activeOverlays` の `remainingTtlMs`（= driveEnd − nowMs）と TTL 失効時刻、release 挙動（400ms・動く基底へのblend）は完全に不変。
- **設計判断（TTL不変の実現）**: attack を「前置」ではなく「sustain から差し引く」ことで、駆動終端 = expiresAtMs を数式的に保証。短窓（window < 100ms）では attack = window / sustain = 0 にクランプされ、窓全体が ease-in になる（それでも drive-end は expiresAtMs のまま）。
- docstring は `slot-curve-state.ts`（トップ・`sampleSlotCurve`）と `control-channel-overlay-store.ts`（トップ・`setOverlay`）の attack≈0 前提記述を、ease-in 既定100ms・TTL(drive-end)不変・「C4で守るのは契約の形であって動きの粗さではない（§7改定）」旨に改訂。

### 項目2: 既存テストの意図的置換 + ease-in のピン留め

`control-channel-overlay-store.test.ts`（set describe + 連続性 describe）:
- **意図的置換**: 「holds the set value through its TTL」の `attack≈0 → 即時適用 / byte-identical to C4's static overlay` コメントを削除し、「ease-in 既定100ms → その後 sustain で peak 保持」へ改訂。サンプル点（500 / 999）は sustain 平坦部のため値は不変。
- **新規（ease-in ramp ピン留め）**: 「eases in over the default ~100ms attack (smoothstep), NOT an instant step」— attack [0,100) が startValue(0)→peak の smoothstep であること、t=0近傍（1ms）が peak の半分未満であること、attack 終端で peak 到達を固定。
- **新規（TTL不変ピン留め）**: 「preserves the TTL: drive-end stays at expiresAtMs」— `activeOverlays` の remainingTtlMs が 900 / 300、expiresAtMs で drive 終了（release tail のみ→omit）を固定。
- **新規（短窓クランプ）**: window 40ms < 既定 attack 100ms で attack=40/sustain=0、drive-end=40（=expiresAtMs）を固定。
- **新規（set 連続性 property）**: set の ease-in→sustain→(失効)→release の全生涯を 60Hz で walk し、隣接 tick 差が **attack=100ms / release=400ms / peak / frame interval / 露出 max-slope 定数から導出した bound** 内であることを固定（マジックナンバー無し）。

### 項目3: 参照ドライバの知覚シナリオ + CLI

`reference-driver.mjs`:
- **CLI（依存ゼロ・package.json 禁止をドライバ内 CLI で維持）**:
  - URL は従来どおり位置引数（`argv` の非フラグ先頭 = 従来 `argv[2]` 相当）。
  - `--scenario=perceptual` で知覚シナリオを選択。既定（引数なし／`--scenario=compressed`）は現状の圧縮シナリオのまま。値不正は compressed に倒す。
  - `--print-timeline`: WS 接続せず、選択シナリオのタイムライン（`kind:"reference-driver-timeline"` + `scenario` + 各節 `kind/slotId/attackMs/sustainMs` …）を 1 行 JSON で stdout に出力し exit 0。**URL 不要**。
- **知覚シナリオ（envelope 主体・現実的な間合い）の実値**（`perceptualSections()`、四つの節）:

  | 節 | kind | slot | peak | attackMs | sustainMs | decayMs | 節後の間合い |
  |---|---|---|---|---|---|---|---|
  | ① 表情ピーク | intent.envelope | head-vertical | 0.6 | 300 | 600 | 400 | 900ms |
  | ② 重ねがけ（同一スロット符号反転 re-attack） | intent.envelope | head-vertical | −0.4 | 300 | 500 | 400 | 1200ms |
  | ③ body 持続駆動 | intent.envelope | body-x | 0.5 | 400 | 1500 | 400 | 900ms |
  | ④ 意図的 kill（body-x sustain 中に切断→release 観測） | disconnect | — | — | — | — | — | — |

  - attack は全て [200,400] に収まる知覚向けの尺。間合いは 900〜1200ms の秒オーダー（圧縮の 30ms 間隔ではない）。`phaseScale` は掛けない（実時間で観測する人間ゲート専用で flaky 無関係のため固定尺）。
  - ③ の sustain 1500ms は、④ の意図的切断時点でも body-x envelope が生存している（mid-kill → release 観測）ことを保証する尺。
- **圧縮シナリオの実行経路・出力・exit code は不変**: 圧縮の phase 定義を `buildCompressedScenario()` に純抽出し、実行（`runCompressedScenario`）と印字（`compressedSections`）が同じ定義を共有するのみ。report（`reference-driver-report`、intentCount/accepted/RTT 等）は無改変。

### 項目4: ドライバ単体タイムライン検証テスト

`reference-driver-perceptual-timeline.test.ts`（新規、runtime-player vitest）:
- **特区方向ルール厳守**: 既存 `reference-driver-sustained-drive.test.ts` と同じ `child_process.spawn(process.execPath, [DRIVER_PATH, "--scenario=perceptual", "--print-timeline"])` 前例に倣う。魂への相対 import は一切なし（`import(変数)` 等の回避工作もなし）。`check:soul-zone` で機械確認済み（下記）。
- **非 flaky**: WS 接続なし・実時間待ちなし（dry-run 印字を parse）。
- 検証: `kind`/`scenario` マーカー、envelope 主体（intent.set が無い・envelope ≥3）、各 envelope の attackMs ∈ [200,400]、四つの節の順序（expression-peak→layering-reattack→body-sustain→intentional-kill）、② が ① と同一 slotId かつ符号反転、③ が最長 sustain、④ が disconnect。

### 項目5: ゲート手順の文言

本報告に人間ゲート再実施の起動コマンドを記載（下記「人間ゲート再実施」）。wave plan §7 本文・`_map.md` は不変（スコープ最小）。

---

## 意図的置換したテストの一覧と各々の置換理由

§7 / wave plan §12 の指示に従い、置換理由をテストコメントではなく本報告に記録する（該当テストにも簡潔な §7 改定注記は残した）。

1. **`control-channel-overlay-store.test.ts` — "holds the set value through its TTL"（旧: "…(C4 外面互換: TTL中の値は同一)"）**
   - 置換理由: 旧テストは `attack≈0 → the value is present immediately … byte-identical to C4's static overlay` と **set=即時適用** をコメント/意図で固定していた。§7 裁定3 改定で set は既定 ease-in になったため、この意図が虚偽になる。サンプル点（500/999）は sustain 平坦部で値自体は不変（0.4）だが、コメントを「ease-in 後に sustain で peak を保持」へ改め、ramp 自体は新規の専用テストで固定した。

2. **`autonomous-frame-heart-channel-overlay.test.ts` — "overrides the generator activation for a slotId while the curve drives"**
   - 置換理由: `setOverlay` 後 `setNow(32)`（startAtMs=16 → e=16ms）で set が既に peak（活性化 0 = 開眼）に達している前提で `ParamEyeLOpen: 1` を固定していた。ease-in（100ms）では e=16ms は ramp 途中（≈0.93）で `ParamEyeLOpen≈0.07` になり失敗。テストの**本来の意図（スロット単位の override が「駆動中」に効く）は不変**なので、サンプルを ease-in を越えた sustain 深部（`setNow(200)`）へ移動して意図を保った。

3. **`autonomous-frame-heart-channel-overlay.test.ts` — "Stage Presence follows the合成後 effective body signal …"**
   - 置換理由: 同様に `setNow(32)`（e=16ms）で set が 0.9 に達している前提で `horizontal: 0.9` を固定していた（`attack≈0` コメントつき）。ease-in では e=16ms は `lerp(0.4 generator-start, 0.9, smoothstep(0.16))=0.434304` になり失敗。**Stage が合成後実効 body 値に追従する（Domain C 裁定1）という本来の意図は不変**なので、サンプルを sustain 深部（`setNow(200)`、期待 `timestampMs` も 200 へ）へ移動した。

補足: `control-channel-overlay-store.test.ts` の他の set 系（失効→release、activeOverlays 等）と heart-overlay の残り set 系（wall clock、clearAll snap、releaseAll bound）は attack 窓（100ms）を越えた点をサンプルするため、**意味を変えず無退行で通過**した（置換不要）。envelope/release 系も全て無退行。

---

## テスト / typecheck / check の実行結果

### runtime-player vitest（`pnpm --filter @private-2d-rigging-lab/runtime-player exec vitest run -c vitest.config.ts`）
- 全体: **860 passed / 2 failed（137 files: 135 passed / 2 failed）**。
- **2 failed は既知 baseline（Wave21 browser-source系2件）**:
  - `src/main/broadcast-source/browser-source-server.test.ts > … serves current Runtime Export payload …`
  - `src/stage/browser-source/browser-source-server-message.test.ts > readBrowserSourceRuntimeExportResponse > accepts the not-loaded response shape`
  - いずれも `effectiveDynamicsTuning` / Runtime Export payload 系で、本タスクの touch 範囲外。
- **本タスクの対象テストは全て緑**: control-channel（12 files / 92 tests）+ heart-overlay を隔離実行で **102 passed / 0 failed**。内訳:
  - 新規 `reference-driver-perceptual-timeline.test.ts` = pass。
  - **無退行**: `reference-driver-sustained-drive.test.ts`（既定=引数なし spawn）= pass（intentCount 11 / accepted 11 / rejected 0 / RTT p95 < 100 / フレーム前進 > 20 / 縦貫通・切断→基底復帰、すべて不変）。
  - 意図的置換した heart-overlay 2件 = pass。
- 注記（flake）: 全体実行の一度で `channel-server.test.ts > supports the full manual lifecycle: open → close → reopen` が `Control Channel WebSocket open failed.` で落ちたが、再実行で緑・隔離実行でも緑。WS サーバ束縛（ephemeral port）の環境依存 flake であり、本タスクは WS サーバコード（`channel-server.ts` 等）を一切変更していないため本変更起因ではない。

### typecheck（`pnpm --filter @private-2d-rigging-lab/runtime-player run typecheck`）
- **pass**（エラー無し）。新規テストの `noUncheckedIndexedAccess` は `requireSection` narrowing helper で解消。

### check:soul-zone（器→魂 / 魂→器 方向ルール、`pnpm run check:soul-zone`）
- **pass**: `1245 source files scanned; no 器→魂 imports and no 魂→器 code imports.`（新規テストは spawn 前例のため魂 import 無し）。

### check:source（`pnpm run check:source`）
- **既知 C3 baseline 1件のみ**: `apps/runtime-player/src/main/physiology/index.ts: index.ts must remain a barrel-only entrypoint`。新規違反なし（本タスクは physiology/ を触っていない）。
  - 補足: 委任文の「特区方向ルール = check:source」は実際には `check:soul-zone`（`check-soul-zone-boundary.mjs`）が器→魂 import を強制する。両方を実行し、器→魂 import を持ち込んでいないことを `check:soul-zone` の pass で機械確認した。`check:source` は別スクリプト（source-organization）で、C3 既存1件のみ。

---

## 無変更確認（git 証拠）

HEAD = `aab63c6 [add]ai-cohost C5実装…と診断・裁定改定(setにease-in)`（セッション中に先行 C5 wave がコミットされ、HEAD に取り込まれた）。本タスクの working-tree 差分は Domain G の 6 ファイルに限定:

```
 M apps/runtime-player/src/main/control-channel/control-channel-overlay-store.test.ts
 M apps/runtime-player/src/main/control-channel/control-channel-overlay-store.ts
 M apps/runtime-player/src/main/control-channel/slot-curve-state.ts
 M apps/runtime-player/src/main/role-composition/autonomous-frame-heart-channel-overlay.test.ts
 M apps/soul/reference-driver/reference-driver.mjs
?? apps/runtime-player/src/main/control-channel/reference-driver-perceptual-timeline.test.ts
```

無変更を git で機械確認済み（`git status --porcelain -- <path>` が空 = 無変更）:
- **契約（schema JSON・examples・contract TS）**: `contract/` 空 = 無変更。C4 契約 fixture（`channel-protocol-contract.test.ts` 等）は control-channel 隔離実行で緑。kind・フィールド・validation・supportedKinds 不変。
- **physiology 純度 / golden**: `apps/runtime-player/src/main/physiology/` 空 = 無変更（写経した smoothstep は既存のまま、import なし）。
- **headless-slot-resolver**: `role-composition/headless-slot-resolver.ts` 空 = 無変更。
- **lockfile**: `pnpm-lock.yaml` 空 = 無変更。`pnpm install` 未実行・依存追加なし。
- **`apps/soul` package.json 不在**: `find apps/soul -name package.json` = 0 件（特区に package.json を置いていない）。
- TTL/release 不変・実行時 role 分岐ゼロ・renderer への token 以外の秘匿流出なし（既存経路を一切変えていない）。

---

## 人間ゲート再実施（起動コマンド — 実装した実引数）

自律ホスト起動 → Channel Open で得た WS URL に対し、**知覚シナリオ**でドライバを起動:

```
node apps/soul/reference-driver/reference-driver.mjs "ws://127.0.0.1:<port>/channel?token=<token>" --scenario=perceptual
```

観察（§7 の6項目、特に）:
- ① 表情ピーク（head-vertical 0.6, attack 300ms）が「ぬるっ」と滑らかに立ち上がり・保持・減衰するか（跳ねるでなく演じる）。
- ② 重ねがけ（同一 head-vertical へ −0.4 の符号反転 re-attack）で途切れ・スナップが出ないか。
- ③④ body-x（peak 0.5, sustain 1500ms）駆動中に **ドライバは意図的に切断** し、body がすっと解けて（既定 release 400ms）呼吸だけが残るか（魂殺しの目玉）。dip の再観察も。

参考: シナリオ構成の確認（WS 不要の dry-run）:
```
node apps/soul/reference-driver/reference-driver.mjs --scenario=perceptual --print-timeline
```
既定（機械テスト）の圧縮シナリオは従来どおり引数なしで起動（無退行）:
```
node apps/soul/reference-driver/reference-driver.mjs "ws://127.0.0.1:<port>/channel?token=<token>"
```

---

## 判断に迷った点・質問（Orch-Sylph へ）

1. **意図的置換のスコープ拡張（要確認）**: wave plan §12 / 項目2 は意図的置換の対象として `control-channel-overlay-store.test.ts` のみを明示していたが、**`autonomous-frame-heart-channel-overlay.test.ts` の2件**も set=即時適用を attack 窓内サンプルで固定しており、ease-in 化で必然的に失敗した。これらは「set-immediacy を固定する既存テスト」という同一クラスであり、テストの**本来の意図（override 追従 / Stage 追従）を保ったままサンプル点のみを sustain 深部へ移動**する意図的置換で対処した（§7 改定の趣旨に整合、新規 fail を残さない選択）。この2件を Domain G の意図的置換に含める判断でよいか、レビューで最終確認されたい。実装・レビュー分離の観点から、私（Gnome）はレビューを書いていない。

2. **知覚シナリオの WS 実駆動は機械テスト対象外（設計どおり）**: 項目3/4 の指示に従い、perceptual の WS 実駆動は人間ゲート専用とし、機械テストはタイムライン dry-run（項目4）と圧縮シナリオの持続駆動（無退行）でカバーした。perceptual の WS 経路は connect()/sendEnvelope()/close()（圧縮パスと同一プリミティブ）を再利用しており、初回人間ゲートで実挙動を確認いただきたい。

3. **`check:source` vs `check:soul-zone` の呼称**: 委任文は特区方向ルールを `check:source` と呼んでいたが、実体は `check:soul-zone`（器→魂 import 強制）。両方実行し、方向ルールは `check:soul-zone` の pass で確認、`check:source` は C3 既存1件のみを確認した（上記）。
