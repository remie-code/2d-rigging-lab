# C2 wave 最終 clean review — レーン① AC/spec/contract compliance(全体突合)

> レビュー: Review-Sylph(opus)。委任元: Orch-Sylph。日付: 2026-07-11。読み取り専任。
> 対象: Domain A→B→C→D 統合後の**最終状態のコード全体**。per-domain レビューは各ドメイン着地前の部分状態を見たため、本レビューは組み上がった最終状態で §10 Acceptance Criteria と §11 Subagent Contract が統合レベルで成立しているかを検証する。

## 判定

**合格(統合レベルで AC/contract 成立)**

blocking ゼロ。ドメイン間契約の食い違い・最終状態でのみ現れる AC 違反・あるドメインが別ドメインの成果を無効化する事象は検出されなかった。Out of Scope への逸脱なし。Subagent Contract 違反なし。手動美的ゲート(§9)はユーザー実施待ちで、これは本レーンの機械検証対象外(想定どおり)。

---

## §10 Acceptance Criteria 各項目の最終状態での成否

### AC1: 自律ホストでロード後、入力ゼロ・設定ゼロでまばたきが動く(Native Stage / Browser Source) — ✅ 成立

コード経路を最終状態で追跡:
- `input-subsystem.ts` `composeStaticInputSubsystem`(autonomousHost)が `createAutonomousFrameHeart({ liveParameters })` を構築。
- `setRuntimeExportPayload(payload)`(= Runtime Export ロード)で `heart.start({ payload, slots: createAutoMappingSlots(payload), seed: deriveAutonomousSessionSeed(payload) })`。**設定・UI・シード露出なし**でスロットとシードは payload から自動導出。
- `autonomous-frame-heart.ts` `tick()` が 60Hz で `generator.sample(logicalTimeMs)` → `resolveSemanticSlotParameterValues({ slots, activations })` → `liveParameters.publishFrame(frame)`。
- `publishFrame` は既存の Stage IPC / Browser Source WS 双方を給電する共通シーム。自律経路はこれを差し替えなしで再利用するため、**Native Stage と Browser Source の両方に同じフレームが届く**(コード経路で追える範囲で成立)。

### AC2: 固定シード fixture がパスする(機械ゲート) — ✅ 成立

`physiology/blink-behavior-fixture.test.ts` + `blink-default.golden.json` / `blink-alt-config.golden.json`(両ファイル存在確認済み)。固定シード `0x5eed1234`、固定タイムステップ 16ms、900 フレームで golden と `toEqual` 突合。同種同列・異種異列・設定変更で異列を機械的に固定。非自明性ガード(max>0.95, min===0)あり。真の機械ゲート。

### AC3: 等価性テストでトラッキング経路の出力が抽出前後で完全一致 — ✅ 成立

`live-mapping/runtime-parameter-frame-equivalence.test.ts` + `.golden.json`。抽出前実装から `UPDATE_RESOLVER_GOLDEN=1` で捕捉した golden に対し、22 シナリオ(blink 部分/全閉、head/gaze centered、mouth-open/smile、vowel blend 有効/無効、body-x/z、NaN/Infinity 沈黙、disabled slot、clamp)の `parameterValues` を `toEqual` で**バイト等価**突合。resolver 抽出が挙動を変えていないことの実効ゲート。

### AC4: physiology/ に Electron import・壁時計・非シード乱数が存在しない — ✅ 成立(自分で grep 確認)

`physiology/` 配下を `electron|Date\.now|performance\.now|new Date|Math\.random|require\(|process\.|setInterval|setTimeout|crypto` で grep。ヒットは**すべてコメント(純度契約の記述)か test ファイル(purity 断言/golden 更新の `process.env` チェック)のみ**。source 実体(`blink-behavior.ts` / `physiology-generator.ts` / `behavior-class.ts` / `deterministic-hash.ts` / `index.ts`)に Electron import・壁時計・`Math.random`・crypto は**皆無**。全変動は `hashUnit`(seed+integer coord の純関数、mesh-outline 先例準拠)から決定論的に導出。時刻は `logicalTimeMs` 引数でのみ流入。`blink-behavior.test.ts:223` が source モジュールの静的 grep で禁止 API 不在を自動検証している(自己防衛ガード付き)。

### AC5: trackingHost 合成に生成器・心臓が存在しない。実行時 role 分岐ゼロ — ✅ 成立(自分で grep 確認)

- **生成器・心臓の不在**: `composeTrackingHostInputSubsystem` は heart/generator/physiology を一切参照しない(input/input-profile/model-mapping の 3 registrar のみ)。`createAutonomousFrameHeart` の import は module-level だが使用は `composeStaticInputSubsystem`(autonomousHost)限定。統合テスト `input-subsystem.test.ts:144` "Tracking Host has no frame heart / generator" が `createAutonomousFrameHeart` 未呼び出し・`heart.start` 未呼び出しを断言。
- **実行時 role 分岐ゼロ**: `main` 全域を `if (role===` / `switch(role)` / host リテラル比較で grep。ヒットは(a)コメント、(b)`role-selection-stub.ts:43` `if (role === null)`(role 選択有無の null ガードであり host 種別の挙動分岐ではない)、(c)`slot-lock.ts` `record.role`/`options.role`(profile slot 所有権の別概念 role、host role 非該当・C1 既存)、(d)`window-title.ts:76` `input.role === null`(null ガード)のみ。**host role の挙動を実行時に再判定する `if (role === 'trackingHost')` 相当は皆無**。role 差は `runtimePlayerInputSubsystemComposers` テーブル一点(data lookup)に集約。

### AC6: 失敗(未写像)は沈黙。エラーUI・ログ洪水なし — ✅ 成立

`resolveSemanticSlotParameterValues` は disabled/target=null/null・非有限 activation のスロットを**黙って書かず落とす**(`parameterId` を書かない=既存「沈黙」契約)。`physiology/` と `autonomous-frame-heart.ts` を `console.`/`dialog.`/`showMessageBox`/`showErrorBox`/`logger.` で grep → **ヒットゼロ**。エラーダイアログ・ログ洪水なし。

### AC7: Editor / package-format / Runtime Export schema / lockfile 無変更。新規依存なし。pnpm install なし — ✅ 成立

`git status` / `git diff --stat` で確認。変更フットプリントは runtime-player の source(`runtime-parameter-frame.ts`、`input-subsystem.ts`(+`.test`)の M と、`headless-slot-resolver.*` / `physiology/` / `autonomous-frame-heart.*` の新規)+ `discussion/ai-cohost/` の docs のみ。**`apps/editor/`・`packages/`(package-format 含む)・schema ファイル・`pnpm-lock.yaml`・`pnpm-workspace.yaml`・`package.json` はいずれも status に非登場=無変更**。新規依存・`pnpm install` の痕跡なし(Domain D 報告の証拠と一致)。

### AC8: 対象テスト・typecheck パス、または失敗が証拠つきで分類 — ✅ 成立

Domain D 報告: runtime-player typecheck exit0 / アプリ回帰 606 pass・2 fail(3 連続ラン一致・フレークなし)/ root typecheck exit0 / packages 1492 pass。2 fail は Wave21 Dynamics Tune 由来 `effectiveDynamicsTuning: null` フィクスチャドリフト(browser-source テスト 2 件、C2 変更範囲=live-mapping/physiology/role-composition と無接触)で証拠つき分類済み。C2 の新規テスト群は 606 pass 内に含まれ全 pass。

---

## §12 blocking 観点 総合判定(最終状態)

| 観点 | 判定 | 根拠 |
|---|---|---|
| 実行時 role 分岐の不在 | ✅ | grep 全域確認。composer テーブル一点集約。 |
| physiology/ の純度(package-ready) | ✅ | grep でコメント/テスト以外に Electron・壁時計・非シード乱数なし。時刻は引数、乱数は seed 由来。 |
| トラッキング経路の等価性 | ✅ | 22 シナリオの byte 等価 golden battery が実効。 |
| sanitization 境界の維持 | ✅ | 公開フレームは `RuntimePlayerLiveParameterFrame`(schemaVersion/identity/sequence/producedAtIso/sourceFrameTimestampMs/parameterValues)のみ。**seed・raw activation はフレームに書かれず process 外へ出ない**(`deriveAutonomousSessionSeed` の値は frame オブジェクトに不在、`live-parameter-bridge-handlers` に seed 概念なし)。既存 publish 境界を差し替えなしで再利用。 |
| タイマーのライフサイクル | ✅ | `start` が事前 `stop`(load→load で timer 二重化なし)、`clearRuntimeExport`(unload)・`disconnect`(quit)で `stop`→timer dispose。初回フレームは初回 tick のみ(同期発火なし)で load handler の `clearLiveParameterFrame()` 後に着地。統合テスト `input-subsystem.test.ts` が load/unload/quit/restart のライフサイクルを断言。リーク・quit 阻害なし。 |

---

## §3.2 Out of Scope 逸脱の有無 — 逸脱なし

- 呼吸・視線・頭・姿勢の**実装**なし。`physiology/` は blink behavior のみ。`behavior-class.ts` は将来行動の**拡張点(interface)**のみで実装を伴わない(§4.2 レパートリー拡張点の構造)。
- ツマミ UI・生理プロファイル画面なし(renderer 変更ゼロ)。
- パッケージのエンベロープ宣言なし(package-format 無変更)。
- 新 package 作成なし(physiology は `apps/runtime-player/src/main/` 配下、`packages/` 非該当)。
- トラッキングへの生成器導入なし(tracking composer は生成器・心臓を参照しない。resolver 抽出は非破壊・等価性で保証)。

---

## 自分で実行した確認結果(要約)

1. `git status` / `git diff --stat`: 変更は runtime-player source + `discussion/ai-cohost/` docs のみ。保護対象(Editor/packages/schema/lockfile/workspace/package.json)全て無変更。
2. `physiology/` 純度 grep(Electron/壁時計/乱数/timer/process): source 実体ヒットゼロ、コメント・test のみ。
3. `main` 全域 role 分岐 grep: host role の実行時挙動分岐ゼロ(null ガードと別概念 role のみ)。
4. `physiology/` + `autonomous-frame-heart.ts` の console/dialog grep: ヒットゼロ(沈黙成立)。
5. 等価性 test(22 シナリオ)・fixture golden(2 config)を精読し実効ゲートであることを確認。
6. `composeTrackingHostInputSubsystem` を精読し heart/generator 非参照を確認。統合テスト `input-subsystem.test.ts` で trackingHost の心臓不在・autonomousHost ライフサイクルを確認。

---

## 裁量注記(非 blocking)

- `autonomous-frame-heart.ts` は `sourceFrameTimestampMs: wallNowMs` に壁時計を用いるが、これは心臓が決定論境界の外に立つ設計(裁定3/§4.3)どおりで正当。既存 dynamics 前進(`sourceFrameTimestampMs` 差分)にそのまま乗る。純度制約は physiology/ に限定され、心臓には及ばない旨がモジュールコメントで明示されており設計と整合。
- physiology 側の blink slot id(`eye-blink-left`/`eye-blink-right`)は live-mapping の意味スロット語彙と decouple のため定数複製されているが、`behavior-class`/`blink-behavior` のコメントどおり sync test で同期が担保されている(ドメイン間契約の食い違いリスクはテストで塞がれている)。

## 質問(いずれも C2 の合否を止めない)

1. AC1 の Native Stage / Browser Source 実挙動確認は §9 手動美的ゲート(ユーザー実施待ち)に委ねられている。本レーンはコード経路で「同一 publish シームに乗る」ことまで確認済みだが、実レンダラでの視認は手動ゲート項目3(OBS Browser Source)の完了をもって最終確認となる。手動ゲート結果を C2 完全閉鎖の最終条件とする理解で相違ないか。
