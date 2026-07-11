# C5 Domain A 実装報告: スロット曲線状態機械 + 実効値フィードバック + release一般化

> Gnome (実装) → Orch-Sylph。ブランチ `feature/2d-rigging-eco-system`、未コミット（作業ツリーに残置）。
> 規範: [c5-wave-plan.md](../../orchestration/c5-wave-plan.md) §3/§4/§6 Domain A/§8/§9・[c5-composition-and-envelopes.md](../../../architecture/c5-composition-and-envelopes.md) §3/§7・[c5-planning-inventory.md](../../orchestration/c5-planning-inventory.md) §2.1-2.3/§2.7。

## 1. 作成 / 変更ファイル

**新規**
- `apps/runtime-player/src/main/control-channel/slot-curve-state.ts` — 曲線状態の型 `SlotCurveState` と純評価 `sampleSlotCurve`（curve系命名, §7）。smoothstep 3行は blink-behavior.ts:207-209 の**写経**（import禁止・境界規律）。定数 `RUNTIME_PLAYER_SLOT_CURVE_DEFAULT_RELEASE_MS=400`、`RUNTIME_PLAYER_SMOOTHSTEP_MAX_SLOPE=1.5`（連続性bound導出用）。

**変更（source）**
- `.../control-channel/control-channel-overlay-store.ts` — store を曲線状態機械へ。`setOverlay`（外面不変）/ `setEnvelope`（Domain B配線点）/ `clearAll`（hard, model unload用）/ `releaseAll(nowMs)`（新, disconnect用）/ `snapshot(nowMs, baseValues?, prevResolved?)` / `activeOverlays(nowMs)`（診断, C4互換）。
- `.../role-composition/autonomous-frame-heart.ts` — `getChannelOverlay` provider を `(nowMs, baseValues, prevResolved)` に拡張。前tickの `resolvedActivations` を `lastResolvedActivations` として1本 retain し供給（案B）。**マージseam :222-224 の評価位置は不変**（`{ ...activations, ...overlay }` のまま）。Stage snapshot :205-209 は**未変更**（Domain C対象）。
- `.../role-composition/input-subsystem.ts` — provider 配線を `store.snapshot(nowMs, baseValues, prevResolved)` に整合。
- `.../control-channel/channel-server.ts` — `close()`（:195相当）と `#handleClientClose`（:313相当）の `clearAll()` を `releaseAll(this.#nowMs())` に置換。`setOverlay` 呼び出し（Domain B の setEnvelope追加点）は外面のみ維持で未変更。

**変更（test）**
- `.../control-channel/control-channel-overlay-store.test.ts` — 決定論fixture・相境界・re-attack・release-to-living-base・continuity性質テストへ全面刷新。
- `.../role-composition/autonomous-frame-heart-channel-overlay.test.ts` — C4スナップ固定4件を release挙動へ意図的置換 + 心臓層 continuity性質テスト追加（§4参照）。
- `.../control-channel/channel-server.test.ts` — 失効/切断の即時スナップ assertion を release へ置換（§4）。
- `.../role-composition/input-subsystem.test.ts` — provider の失効 assertion を release境界へ更新。
- `.../control-channel/reference-driver-sustained-drive.test.ts` — 切断後の settle delay を 120ms→600ms（release 400ms 待ち, §4）。

## 2. 実装した曲線状態機械の要点

- **単一機械（裁定3）**: 各スロットは1本の `SlotCurveState`。相 attack→sustain→decay→release を `startAtMs` からの経過で写像。`intent.set` は退化曲線（`attackMs=0`・`sustainMs = expiresAtMs - startAtMs`・`decayMs=0`・universal release）として同一機械に畳む。set/envelope を二重状態で持たない。契約は外面2 kindのまま（`setOverlay` シグネチャ不変）。
- **曲線数学（写経, §4/§2.7）**: `smoothstep(x)=t²(3-2t)` を blink-behavior から写経。attack=`lerp(startValue, peak, smoothstep(e/attackMs))`、sustain=`peak`、decay=`peak·(1-smoothstep)`（peak→0）。
- **startValue経路=案B（裁定1/§2.2）**: 心臓が前tick `resolvedActivations` を retain→ store が `snapshot` で `prevResolved` として受領・キャッシュ。新intent受理時 `startValue = prevResolved[slot] ?? livingBase[slot] ?? 0`（= 合成後の真の実効値。稼働中曲線があってもマージ後値がそれを含むため同一経路で正しい）。最大1tick陳腐化許容。
- **release blend式（裁定2/§2.3）**: `effective = lerp(livingBase(nowMs), releaseFrom, w)`、`w = 1 - smoothstep(rel/releaseMs)`（1→0）。**livingBase は毎tick供給される pure 生成器基底値**（`baseValues`）で凍結しない。`releaseFrom` は release進入時の値（envelope=decayが 0 まで落とした値, set=peak）。w=0 で `livingBase` に一致→エントリ削除→終端スナップ無し。
- **START/TARGET の厳密分離（§4）**: re-attack の**START = resolved 実効値**（`prevResolved`, 案B）、release の**TARGET = pure 基底**（`baseValues`, livingBase）。resolved を release対象に使わない（循環回避）ため、store は毎tick両信号を別々に受領。
- **releaseAll（§2.3）**: 全 live エントリを現在実効値からの forced release へ一斉遷移（`forcedReleaseAtMs`/`forcedReleaseFromValue`）。即時消去せず、release完了(w=0)で削除。切断→全スロット同時 release。

## 3. テスト結果

コマンド（Windows/PowerShell, `pnpm install` 不使用・既存 node_modules）:
- `npx vitest run -c vitest.config.ts control-channel-overlay-store autonomous-frame-heart-channel-overlay` → **20 passed**（store 13 / heart-overlay 7）。
- `npx vitest run -c vitest.config.ts channel-server input-subsystem channel-bridge-handlers` → **31 passed**。
- `pnpm run typecheck`（tsc --noEmit）→ **pass**。
- 全パッケージ `npx vitest run -c vitest.config.ts` → **828 passed / 2 failed / 136 files**。sustained-drive 統合テスト含め Domain A 関連は全 green。

**既知baseline fail（Domain A の責任外・分離明記）**: 2件とも `browser-source` 系で `effectiveDynamicsTuning` フィールドの schema drift ——
- `src/stage/broadcast-source/browser-source-server.test.ts:150`
- `src/stage/browser-source/browser-source-server-message.test.ts:216`

overlay/曲線とは無関係（dynamics-tuning 応答形状）。wave plan §8/委任の「既知baseline=Wave21 browser-source系2件」に一致。当該ファイルは一切触れていない（git diff で確認済み）。physiology golden・リゾルバ・トラッキング経路は全 green（無退行）。

## 4. 意図的に置換した C4 テスト一覧と理由（§2.3）

C4 は失効・切断で**即時スナップ**を固定していた。C5 の release一般化で「中間値を経て基底へ」に置換した（退行でなく設計意図）。

| ファイル:テスト | C4 が固定していた挙動 | C5 での置換 |
|---|---|---|
| `autonomous-frame-heart-channel-overlay.test.ts` "falls back when overlay expires" | 失効の次tickで即基底 (`ParamEyeLOpen=0`) | 失効=release開始→中間値(0<x<1)→400ms後に基底。 |
| 同 "expires an explicit-ttlMs overlay" | ttl境界で即 `=0` | wall-clock境界で release開始（wall vs logical の証明は維持）。 |
| 同 "expires a default-window overlay" | 既定窓境界で即 `=0` | 上記と同機構に統合（release後に基底）。 |
| 同 "judges TTL against WALL clock" | wall境界で即 `=0` | wall境界で release中(x<1)を確認し wall-clock判定を保持。 |
| 同 "clears all overlays on disconnect" | `clearAll()` → 次tick即基底 | `releaseAll()` → 全スロット同時 release → 中間値 → 400ms後基底。 |
| `channel-server.test.ts` "accepts a valid intent…writes overlay" | `snapshot(exp+…)` が即 `{}` | 失効で release進入（値保持）、release窓後に `{}`。 |
| `channel-server.test.ts` "…on client disconnect" | disconnect→`snapshot`即 `{}` | `releaseAll` 経由で easing→release窓後に `{}`。 |
| `input-subsystem.test.ts` "…shared with the heart's overlay provider" | 失効境界で provider が `{}` | 失効=release進入、release窓後に `{}`。 |
| `reference-driver-sustained-drive.test.ts` "…falls back after disconnect" | `delay(120)` で基底観測 | `delay(600)`（release 400ms 待ち）で基底観測。 |
| `control-channel-overlay-store.test.ts` "omits at/after expiry"（旧） | `snapshot(1000)==={}` | store層で release進入→release窓後に `{}`（新 fixture 群へ刷新）。 |

## 5. 連続性テストの導出bound（マジックナンバー不在の証拠）

per-tick 上限は曲線パラメータのみから導出（レビュー blocking観点）。smoothstep 導関数 `6x(1-x)` の最大は x=0.5 の **1.5**（`RUNTIME_PLAYER_SMOOTHSTEP_MAX_SLOPE`, 定数として公開・テストが参照）。平均値の定理より隣接tick差 = f'(c)·Δt ≤ maxSlope·Δt。

各相の per-tick step（Δt = frameIntervalMs）:
```
attackStep  = |peak - startValue| / attackMs  × 1.5 × frameIntervalMs
decayStep   = |peak - 0|          / decayMs   × 1.5 × frameIntervalMs
releaseStep = |releaseFrom - livingBase| / releaseMs × 1.5 × frameIntervalMs
bound       = max(attackStep, decayStep, releaseStep)
```
相境界（attack→sustain→decay→release→removed）は値連続（各境界で隣接相の端点が一致）なので追加スパイク無し。store層（`control-channel-overlay-store.test.ts`）と心臓統合層（`autonomous-frame-heart-channel-overlay.test.ts`, harness :74-120 使用）の両方で「全隣接tick差 ≤ bound」を性質テスト化。マジックナンバー（固定閾値）は不使用。連続性の対象遷移点: attack開始（envelope, base起点で滑らか）・re-attack（prevResolved起点）・失効（decay/release）・切断（releaseAll）。

## 6. 命名規律の遵守（§7）

- 器内部の曲線側モジュール/型は **curve系**: `slot-curve-state.ts` / `SlotCurveState` / `SlotCurvePhase` / `SlotCurveSample` / `sampleSlotCurve` / `slotCurveDriveEndMs`。
- 「envelope」の語は封筒側（C4 `channel-envelope-schema.json`）と契約kind `intent.envelope`（Domain B）に譲り、Domain A の曲線モジュールでは一切使わない（コメントも「curve」で統一）。store の envelope仕様入力型のみ `RuntimePlayerControlChannelEnvelopeSpec`（Domain B が `intent.envelope` payload を配線する境界の型で、契約kind名に対応）。

## 7. 裁量判断（設計未定義を合理的に実装した箇所）

1. **decay と release の関係**: §4「TTL失効・decay終端・切断のいずれも release時間で基底へ」を、decay=`peak→0`（envelope rest, decayMs）→ release=`0→livingBase`（400ms）の順次相として実装。set は decayMs=0 なので sustain後 release が peak から直接 livingBase へ blend（set の即時スナップ回避）。envelope の decay終端(値0)→release開始(w=1で値0)は連続。→ 各相境界の値連続を保ちつつ、終端は必ず生きた基底を追う。
2. **案B の供給形**: 「心臓が resolvedActivations を retain・供給」を literal に実装（heart が `lastResolvedActivations` を保持し `getChannelOverlay(nowMs, baseValues, prevResolved)` の第3引数で渡す）。overlay store は唯一のマージ源なので store 自己計算でも等価だが、設計文書の mental model（心臓が供給）に忠実な配線を選択。
3. **set の startAtMs**: `setOverlay` は外面シグネチャ維持のため受理時刻を引数に取れない。store が `snapshot` で観測した直近 `nowMs`（`#lastNowMs`）を startAtMs に採用。`sustainMs = expiresAtMs - startAtMs` とするため **drive終端 = expiresAtMs は startAtMs に依存せず不変**（sustain中は attack=0 で常に peak）→ C4 の「TTL中の値は同一」外面互換を厳密に維持。
4. **activeOverlays の remainingTtlMs**: 「driven」= release進入前（attack+sustain+decay）と定義し、`remainingTtlMs = driveEnd - nowMs`。set では `driveEnd = expiresAtMs` となり C4 の `expiresAtMs - nowMs` と一致（既存 activeOverlays テスト・channel-bridge-handlers テストが無変更で通過）。release尾部は「driven でない」として診断から除外。→ Domain C read model への signature 影響ゼロ（`activeOverlays(nowMs)` 不変）。
5. **`snapshot` の後方互換**: `baseValues`/`prevResolved` を任意引数（既定 `{}`）にし、`snapshot(nowMs)` 単独呼び出しの既存 provider 配線を型・実行時とも維持（release対象は base欠如時 0）。
6. **`clearAll` の存置**: model unload / runtime-export teardown（runtime-player-main.ts:560/602）は「動く基底が無い」ので hard clear（スナップ）が正。`clearAll` を残し、disconnect のみ `releaseAll` に置換。

## 8. 質問 / escalate

なし（実効値フィードバックは心臓構造に素直に乗った。設計裁定4件で分岐は解消済み）。留意点として、`snapshot` が release完了エントリを lazy prune（mutation）する前提で「心臓が単調増加の壁時計で駆動する」契約に依存する。非単調 nowMs での照会は fixture が単調列を守ることで回避（現行テスト・実配線とも単調）。

## 9. 触っていないことの確認

- `physiology/` 配下: 無変更（golden 全 green・git diff 空）。smoothstep は import せず写経。
- `headless-slot-resolver.ts`: 無変更（評価点 :222-224 の位置も不変）。
- Runtime Export schema / package-format / Editor ソース / 契約 JSON（`contract/`）: 無変更。
- `pnpm-lock.yaml`: 無変更（`pnpm install` 未実行・回避工作なし）。
- `apps/soul`: 無変更（package.json 追加なし）。
- 拒否コード列挙: 無変更（Domain A は拒否に触れない）。
- 心臓 Stage snapshot（:205-209）: 無変更（Domain C 対象）。
- 実行時 `if (role===…)` 分岐: 新設なし。renderer へ token 以外は流していない。
