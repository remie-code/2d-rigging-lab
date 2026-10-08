# C5 Domain D 実装報告: 最終統合(モノレポ検証・無変更確認・docs整合・人間ゲート手順)

> Gnome(実装・統合、`cohost-c5-final-integration`)→ Orch-Sylph。ブランチ `feature/2d-rigging-eco-system`、コミットなし。
> 規範: [c5-wave-plan.md](../../orchestration/c5-wave-plan.md) §6 Domain D/§7 Manual Check Notes/§8 Acceptance/§9 Subagent Contract・[c5-composition-and-envelopes.md](../../../architecture/c5-composition-and-envelopes.md) §7・Domain A/A-loop2/B/C 報告。
> 性格: **新しいドメインロジックは実装していない**。統合レベル(検証実行・docs整合・軽微コメント修正1箇所・人間ゲート手順)のみ。clean review は別コンテキストの Review-Sylph が別途行う。

---

## 0. 判定サマリ

- **機械ゲート = 緑**。typecheck pass・runtime-player 全体 855 pass / 2 fail(既知 Wave21 baseline のみ)・boundary check pass・C5 対象114件 pass・golden/physiology/tracking 149件 pass。
- **無変更確認 = 全項目 pass**(git 機械確認)。physiology/golden 全4本・resolver・schema・lockfile・Editor・package-format 無変更。拒否コード6件不変。実行時 role 分岐ゼロ。`apps/soul` は reference-driver.mjs のみ・package.json 不在。
- **Status = 実装完了・機械ゲート緑・人間ゲート待ち**。CLOSURE(Status: Closed)判定は人間ゲート合格後に L0(Undine)が行う。本報告は wave を Closed にしない。
- escalate: **なし**。質問: 1件(§8 の decay dip の是非は人間ゲートでの美的判断待ち。これは escalate ではなく設計裁定の委譲)。

---

## 1. モノレポ検証(D-1・機械・証拠つき)

Windows/PowerShell、`pnpm install` 不使用・既存 node_modules。

| 検証 | コマンド | 結果 |
|---|---|---|
| typecheck | `apps/runtime-player` で `npx tsc --noEmit -p tsconfig.json` | **pass**(exit 0、出力なし)。軽微コメント修正後の再実行も **clean**。 |
| 全体テスト | `apps/runtime-player` で `npx vitest run -c vitest.config.ts` | **855 passed / 2 failed / 857 tests・136 files** |
| 特区境界 | repo root で `node scripts/check-soul-zone-boundary.mjs` | **pass**(1244 files scanned・器→魂/魂→器 の code import なし) |
| check:source | repo root で `node scripts/check-source-organization.mjs` | **1 violation**(既知 C3 baseline・下記) |
| C5 対象テスト | `npx vitest run -c vitest.config.ts control-channel-overlay-store autonomous-frame-heart-channel-overlay channel-protocol-contract channel-intent-validation channel-request-dispatch channel-server reference-driver-sustained-drive stage-presence-drive stage-motion-runtime input-subsystem` | **114 passed / 11 files** |
| golden/physiology/tracking | `npx vitest run -c vitest.config.ts golden physiology tracking runtime-parameter-frame-equivalence full-generator-snapshot` | **149 passed / 15 files** |

### 既知baseline の明示分類

- **全体テストの 2 fail = Wave21 browser-source 系のみ**(overlay/曲線と無関係、`effectiveDynamicsTuning` schema drift):
  - `src/main/broadcast-source/browser-source-server.test.ts:150`
  - `src/stage/browser-source/browser-source-server-message.test.ts:216`
  - 両 fail の diff は `+ "effectiveDynamicsTuning": null`(dynamics-tuning 応答形状の drift)。wave plan §8/委任の「既知baseline=Wave21 browser-source系2件」に一致。当該2ファイルは C5 で一切触れていない(git diff で無変更確認)。
  - **これ以外の fail はゼロ**(855 pass の内訳に C5 対象・golden・physiology・tracking を全て含む)。→ escalate 不要。
- **check:source の 1 violation = C3 既知 baseline**: `apps/runtime-player/src/main/physiology/index.ts: index.ts must remain a barrel-only entrypoint`。vitest 対象外の別スクリプト。physiology/ は C5 で無変更(git diff で確認済み)なので本 violation は C5 由来ではない。既知として触っていない。

### C5 対象テストの緑(内訳)

`control-channel-overlay-store`(15)・`channel-intent-validation`(25)・`channel-request-dispatch`(10)・`channel-protocol-contract`(12)・`stage-motion-runtime`(7)・`autonomous-frame-heart-channel-overlay`(10、Stage follow + 連続性性質テスト含む)・`channel-server-events`(2)・`channel-server`(9、envelope e2e 含む)・`input-subsystem`(16)・`stage-presence-drive`(7)・`reference-driver-sustained-drive`(1、外部プロセス参照ドライバ 11 accepted・RTT p95<100ms)。契約・validation・dispatch・channel-server・reference-driver-sustained-drive・stage 系すべて緑。

---

## 2. 無変更確認(D-2・git 機械確認・受け入れ基準§8)

`git diff --name-only HEAD` + 個別 status で実証。

### 変更集合(全 21 = 修正19 + 新規2、全て Domain A/B/C スコープ内)

**変更(source/test、Domain A/B/C)**: `control-channel-overlay-store.ts`/`.test.ts`・`channel-intent-validation.ts`/`.test.ts`・`channel-request-dispatch.ts`/`.test.ts`・`channel-server.ts`/`.test.ts`・`channel-server-events.test.ts`・`contract/channel-envelope-schema.json`・`contract/channel-exchange-examples.json`・`contract/channel-protocol-contract.ts`/`.test.ts`・`reference-driver-sustained-drive.test.ts`・`autonomous-frame-heart.ts`・`autonomous-frame-heart-channel-overlay.test.ts`・`input-subsystem.ts`/`.test.ts`・`apps/soul/reference-driver/reference-driver.mjs`。
**新規**: `contract/channel-intent-envelope-payload-schema.json`(Domain B)・`slot-curve-state.ts`(Domain A)。
**Domain D 分の変更**: `autonomous-frame-heart.ts` の**軽微コメント1箇所のみ**(下記§4。挙動無影響)+ discussion docs。

### 無変更の証拠(§8 項目別)

| 対象 | 確認方法 | 結果 |
|---|---|---|
| physiology 純度・golden 全4種 | `git diff --name-only HEAD \| grep -iE physiology\|golden` | **NONE**(無変更)。golden: `blink-default`/`blink-alt-config`/`full-generator-snapshot`/`runtime-parameter-frame-equivalence`.golden.json 全4本無変更。golden 消費テスト緑(§1)。 |
| リゾルバ | `headless-slot-resolver.ts` の git status | status 行なし(**無変更**)。tracking 系テスト緑(無退行)。 |
| Editor / package-format / Runtime Export schema | diff name grep | **NONE**(無変更) |
| lockfile | `git diff --quiet HEAD -- pnpm-lock.yaml` | **UNCHANGED**(`pnpm install` 未実行・回避工作なし) |
| apps/soul | `git status apps/soul` | `reference-driver.mjs` の **1ファイルのみ**。`apps/soul/package.json` = **ABSENT**(追加せず) |
| 実行時 role 分岐 | C5 diff の追加行を `if (role\|role ===\|"cohost"\|"tracking"` で grep | **NONE**(新規 role 分岐ゼロ) |
| 拒否コード列挙 | `channel-protocol-contract.ts:53-60` | **6コードのまま**(`unknownKind`/`invalidPayload`/`unknownSlot`/`slotValueOutOfRange`/`slotNotWritable`/`channelClosed`)。enum 配列本体に +/- 行なし(diff の2hit は既存コードを参照する新規 JSDoc コメント行=裁定4の明文化のみ)。 |

---

## 3. 受け入れ基準§8 チェックリスト(項目別 pass/根拠)

| §8 基準 | 判定 | 根拠 |
|---|---|---|
| `intent.envelope` の縦貫通(送信→曲線→減衰→基底) | **pass(機械)** | `channel-server.test.ts` envelope e2e(accepted→store に mid-attack 中間値+sustain peak)・`reference-driver-sustained-drive` の envelope 観測(peak 到達・中間値・600ms後 base 復帰)。目視の縦貫通は人間ゲート§5-2/4。 |
| 連続性: 全遷移点で導出 bound 内 | **pass(機械)** | store 層・心臓層の continuity property テスト(attack開始・re-attack・失効・切断・releaseAll を bound-walk)。bound は `\|amplitude\|/durationMs × RUNTIME_PLAYER_SMOOTHSTEP_MAX_SLOPE(1.5) × frameIntervalMs`(マジックナンバー不在)。loop2 で re-attack/releaseAll を点検査→bound-walk 化。目視のスナップ不在は人間ゲート。 |
| release: 動く基底へ収束・400ms・set 失効も同機構 | **pass** | release blend `lerp(livingBase(t), releaseFrom, w)`・`w=1→0`・`RUNTIME_PLAYER_SLOT_CURVE_DEFAULT_RELEASE_MS=400`。set は退化曲線として同一機械。基底凍結せず(終端スナップ無し)。切断→全スロット同時 releaseAll。 |
| set/envelope が単一曲線状態機械(内部)・契約は2 kind(外面) | **pass** | `slot-curve-state.ts` 単一機械。`setOverlay` シグネチャ外面不変。`supportedKinds=["intent.set","intent.envelope"]`。 |
| C4 後方互換(fixture・旧シナリオ・既存テスト無変更通過、スナップ固定の意図的置換を除く) | **pass** | set の payload schema/型/rejections 無変更。参照ドライバ旧4相(set)無変更で全 accepted。C4 スナップ固定テストは release 挙動へ意図的置換(Domain A 報告§4に一覧)。 |
| Stage Presence が実効 body 信号に追従・C3 無退行 | **pass** | Stage snapshot を `resolvedActivations` へ差し替え。追従テスト(body-x 0.9 に追従・body-z 無退行)。C3 Stage テスト2件アサーション無変更 pass。二重適用手当て(strength 凸ゲイン)無変更。 |
| physiology 純度・golden 全種・リゾルバ・トラッキング無退行・role 分岐ゼロ | **pass** | §2 の無変更確認。golden/physiology/tracking 149 件緑。role 分岐 grep NONE。 |
| 命名規律(内部 curve 系)・拒否列挙不増殖 | **pass** | `slot-curve-state`/`SlotCurveState` 等 curve 系。拒否コード 6 件のまま(§2)。 |
| Editor/package-format/Runtime Export schema/lockfile 無変更・新規依存なし・`pnpm install` なし | **pass** | §2。lockfile UNCHANGED・soul package.json 不在。 |
| 対象テスト・typecheck pass、または失敗を証拠つき分類(既知=Wave21 browser-source) | **pass** | §1。2 fail は既知 baseline のみ、他 fail ゼロ。 |

---

## 4. 作成/変更ファイル一覧(Domain D 分・絶対パス)

**軽微コメント修正(source・挙動無影響。レビュー lane2 非blocking nit の解消)**:
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\runtime-player\src\main\role-composition\autonomous-frame-heart.ts`(:186-190 付近)— `latestStageMotionSignal` 宣言コメントの "Updated each tick from the sampled body-x/body-z" を実態(合成後 effective/resolved 値。C5 Domain C で pure→実効に差し替え済み)に合わせて修正。型 doc/getter doc は Domain C が更新済みだが宣言サイト1行だけ旧 "sampled" が残っていた doc drift。挙動・型は不変(typecheck 再実行 clean)。

**docs 整合(discussion)**:
- `C:\...\discussion\ai-cohost\implementation\_map.md` — waves/c5・reviews/c5 の行を追加。「次の行動」§5 を C5「実装完了・機械ゲート緑・人間ゲート待ち」に更新(**Closed にはしていない**。CLOSURE は L0 が人間ゲート後)。

**新規(follow-up + 本報告)**:
- `C:\...\discussion\ai-cohost\implementation\waves\c5\c5-followup.md` — 持ち越し/裁定待ち 4項目(+ C4 followup #6 解消の記録)。
- `C:\...\discussion\ai-cohost\implementation\waves\c5\domain-d-report.md` — 本報告。

**既存 docs**: wave plan/architecture/inventory は事実確定済みで大改訂不要のため未変更(§6 Domain D「大改訂しない」)。`ai-cohost/_map.md`(トップ)は C5 進捗欄を持たず implementation/_map.md が進捗の家のため、後者のみ更新。

---

## 5. 人間ゲート手順(D-4・§7・完全な実行可能手順)

> **前提**: 機械ゲートが緑であること(本報告§1)。判定は**参照ドライバの実駆動プロファイル**で行う(振り付け fixture 一発は不可・改定済みゲート §7)。美的/感覚判定は本手順の目視部分に含む。

### 5.0 起動

1. **自律ホスト(runtime-player)を起動**:
   ```
   cd apps/runtime-player
   pnpm run dev
   ```
   (`electron-vite dev --watch`。自律ホストとして起動。トラッキングホストではなく自律側で Channel サブシステムが在る構成。)
2. **Channel を Open にする**: アプリの **Channel ページ**を開き、`Open Channel` ボタンを押す(**起動時は必ず Closed**)。状態が `Open — no client connected` になる。
3. **Channel WS URL を取得**: Channel ページの Endpoint 行の下に出る **`Copy Channel URL`** ボタンを押す。これで `ws://127.0.0.1:<port>/channel?token=<token>` の完全な URL がクリップボードに入る。
   - **port は起動ごとに動的に bind される**(固定ではない。`channel-bridge-handlers.ts:180`「listening port is only known once the server binds」)。**必ず Copy Channel URL の実値を使う**(下の例の 17310 は説明用の仮値)。
   - token は URL の構成要素としてのみ露出する(それ以外の秘匿は renderer に流れない)。
4. **拡張参照ドライバを起動**(依存ゼロ `.mjs`、素の Node 22 で直実行。repo root から):
   ```
   node apps/soul/reference-driver/reference-driver.mjs "ws://127.0.0.1:17310/channel?token=<token>"
   ```
   引数は **Copy Channel URL でコピーした実 URL** をそのまま貼る(port/token を含む)。接続すると Channel ページの状態が `Connected (protocol 1)` になる。
   - ドライバは決定論シナリオ(注視→傾げ→沈黙→再開 の set 4相 → **envelope 相3本** → 意図的切断 → 再接続)を流し、完遂で exit 0・標準出力に1行 JSON レポート。

### 5.1 観察6項目(§7・拡張シナリオに紐づけ)

参照ドライバの `envelopePhase`(接続1の切断直前)= ① `head-vertical` peak 0.6(表情ピーク)→ ② `head-vertical` peak **-0.3**(重ねがけ・符号反転)→ ③ `body-x` peak 0.5・長 sustain(400ms・持続駆動、切断時にまだ生存)。

1. **起動→Channel Open→参照ドライバ起動**(5.0)。Connected(protocol 1)になり、外部駆動が始まる。

2. **表情ピーク(§7-2、envelope①)**: `head-vertical` の envelope が **滑らかに立ち上がり(attack)→保持(sustain)→減衰(decay)**するのを見る。頭が上下方向にすっと上がって留まり、ゆっくり戻る。「跳ねる」(C4 の即時上書き)ではなく「**演じる**」に見えるか。**見どころ**: 立ち上がりの角が丸いか(smoothstep)、保持中に微動があっても envelope が土台を作っているか。

3. **重ねがけ(§7-3、envelope②が①へ連続)**: 同一 `head-vertical` へ ①(peak 0.6)の直後に ②(peak -0.3、下向き)が来る。**現在の実効値からの re-attack** なので、上向きから下向きへ**途切れ・スナップ無しに繋がる**か。**見どころ**: ①→② の継ぎ目で値が瞬間ジャンプせず、今いる位置から新しいピークへ滑らかに向かうか(連続性原則 3.1 の目視)。

4. **魂殺し(§7-4・ゲートの目玉、envelope③ 生存中に kill)**: ③ `body-x`(長 sustain・切断時まだ生存)を流している最中に**参照ドライバのプロセスを Ctrl-C で kill**(またはシナリオの意図的切断を待つ)。切断で全スロットが**同時に既定 release(400ms)で生きた基底へ解ける** → 表情がすっと抜けて、**呼吸・瞬き・視線だけが残る**。**見どころ**(どの瞬間に何を見るか): kill した瞬間、body が peak からスナップして 0 に落ちるのではなく、**約0.4秒かけて滑らかに基底(呼吸で微動する現在値)へ収束**する。収束後もキャラは瞬きと視線と呼吸で**息をしている**。どこにもスナップが無いか。← これが C5 の合否の本体。

5. **Stage Presence 追従(§7-5、C4 非結合の解消)**: **Stage Presence を On** にして、参照ドライバが body(③ `body-x`)を駆動している間に**画面上のキャラ位置が追従して動く**か。C4 では生成器の body にしか追従しなかった(チャネル駆動は Stage を摂動しなかった)。C5 は合成後の実効 body に追従する。**見どころ**: body envelope のピークで画面位置がオフセットし、release で位置も基底へ戻るか(体は一つ)。

6. **トラッキングホスト無退行(§7-6)**: トラッキングホスト構成で従来どおり動くことを一目(Channel/Input/Mapping が品位ある空状態、トラッキング駆動が退行していない)。C5 は autonomous 側の合成のみを触っており、トラッキング経路は無変更(機械: tracking 系テスト緑)。

### 5.2 decay dip の観察注記(§8 open 論点・美的判断待ち)

- envelope③ `body-x` の**減衰(decay)時**、現行実装は decay ターゲットが **base 非依存に peak→0** のため、非零・動く base を持つ body スロットでは値が**一瞬 livingBase の下へ dip(潜り)**、その後 release が 0→livingBase へ戻す。連続性は保たれ機械的には正(スナップ無し)だが、**見え方の是非は美的/設計判断**。
- **見どころ**: `body-x` の envelope が sustain を終えて減衰に入るとき、体が基底位置を**一瞬通り越して逆側へわずかに振れてから**基底へ戻るように見えるか。これが**望ましい表現(自然なオーバーシュート的な抜け)か、それとも不自然な dip か**をユーザーが判断する。
- 望ましくなければ decay を **peak→livingBase(base 直帰・dip 無し)**にする設計裁定(Undine)→ Domain A が `slot-curve-state.ts` の decay ターゲットを差し替え(characterization テスト更新込み)。現行挙動は `control-channel-overlay-store.test.ts` の `sawDipBelowBase` テストで固定済み(c5-followup §1)。

### 5.3 Channel ページ表示注記(既知ギャップ・混乱防止)

- Channel ページの **Recent Events** は、`intent.envelope` の accepted も画面上「**✓ intent.set**」と表示する(`channel-page.tsx:187` が固定文字列、accepted イベントに kind を載せていないため)。**これは退行ではなく既知の表示ギャップ**(envelope は C5 新規・C4 に無かった。§3.2 スコープ外)。
- **リグの実挙動(曲線描画・release)が判定本体**であり、表示文字列は副次。envelope を送っているのに「intent.set」と出ても**混乱しないこと**。表示の kind 非依存化は C5 後の follow-up(c5-followup §3)。

---

## 6. c5-followup.md の要約(持ち越し4項目)

新規 [c5-followup.md](c5-followup.md) に記録(体裁は c4-followup に倣う):

1. **⚠ decay 意味論の open 論点(美的/設計裁定・人間ゲートで観察可能)**: envelope の decay が base 非依存に peak→0 へ落ち、非零・動く base(body 系)で dip-below-base が発生(連続性は導出 bound 内で機械的に正)。peak→0 か peak→livingBase かは美的/設計裁定。現状挙動は `sawDipBelowBase` characterization テストで固定。人間ゲート§5.2 で目視判断可能。
2. **peak 符号の裁定記録(確定・コード対応不要)**: peak の符号は域概念(centered slot -1..1)で `slotValueOutOfRange` 担当。負 peak を invalidPayload にしない(intent.set の value と同型・双方向表現力)。Domain B 実装・3レーン追認。委任文の一時的矛盾を解消した確定事項。
3. **Channel ページ表示ギャップ(既知・§3.2 スコープ外)**: accepted イベントが kind 非搭載で envelope の accepted も「intent.set」と表示。退行ではない。候補: accepted に kind を additive 追加し表示を kind 非依存化。C5 では直さない。
4. **非blocking coverage 穴・将来の任意強化(lane3 由来)**: Stage の body-z 駆動・両 body 同時・release 中 body 中間値の Stage 追従・coupling の end-to-end 実演 の追補。C5 機械ゲートは緑で合否無影響。C6 で曲線機構再利用時に併せて強化が自然。

(+ 参考記録: c4-followup #6「Stage Presence×チャネル結合の Undine 方向確認」は C5 設計裁定1 + Domain C 実装で解消済み。)

---

## 7. 裁量判断 / 質問 / escalate

- **裁量1(コメント修正の範囲)**: 委任 D-3 の「他にレビューが指摘した明白な doc drift があれば挙動を変えない範囲で修正(無理に探さない)」に従い、レビューが明示的に挙げた nit(`autonomous-frame-heart.ts:186-188`)**1箇所のみ**修正。Domain A loop2 が既に input-subsystem.ts のコメント drift 2箇所を修正済みで、他に明白な drift は探索の結果見当たらなかったため追加修正なし。
- **裁量2(_map.md の更新粒度)**: implementation/_map.md にのみ C5 行を追加。トップの `ai-cohost/_map.md` は C5 進捗欄を持たない構造(implementation/_map.md が進捗の家)のため未変更。wave plan/architecture の Status は L0 の CLOSURE 判定に属するため触らず(「実装完了・人間ゲート待ち」の事実は implementation/_map.md と本報告に集約)。
- **質問1(decay dip の是非=人間ゲート委譲)**: c5-followup §1 の decay 意味論(peak→0 の現行 dip か peak→livingBase か)は**美的/設計裁定**で、人間ゲート§5.2 でユーザーが目視判断する。これは Domain D が埋める論点ではなく(連続性は機械的に担保済み)、**人間ゲート後に Undine が裁定**する事項として申し送る。escalate ではない(現状実装は正しく動き、機械ゲートは緑)。
- **escalate: なし**。全体テストの fail は既知 Wave21 baseline 2件のみ(他 fail ゼロ)。無変更確認は全項目 pass。Subagent Contract(§9)違反なし(`pnpm install` 未実行・lockfile 無変更・soul package.json 不在・ドメインロジック無改変・role 分岐不追加・拒否列挙不増殖・Channel ページ表示は直さず followup 記録のみ・無関係変更の revert なし)。

---

## 8. Subagent Contract(§9)遵守の明示

- `pnpm install` 禁止 → **未実行**(既存 node_modules で全検証)。回避工作なし。lockfile **無変更**。`apps/soul` に package.json・依存 **追加せず**(不在確認)。
- ドメインロジック(Domain A store曲線・B契約/validation/dispatch・C Stage snapshot 位置)**再実装・改変せず**。Domain D の source 変更は `autonomous-frame-heart.ts` の**コメント1行のみ**(挙動無影響)。physiology/・resolver・schema・Editor・package-format **無変更**。
- 実行時 role 分岐 **足さず**(grep NONE)。拒否コード列挙に新コード **足さず**(6件のまま)。無関係変更 **revert せず**。
- Channel ページ表示 **直さず**(§3.2 スコープ外・followup 記録のみ)。
