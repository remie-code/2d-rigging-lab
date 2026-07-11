# C4 Domain B 実装報告: 粗いオーバーレイprovider(心臓tick統合・TTL・切断失効・基底復帰)

> Gnome(実装担当)→ Orch-Sylph。task=`cohost-c4-overlay-provider`。
> 前提=Domain A 完了(overlay store・チャネルサーバ・拒否列挙・port/token採番)。
> スコープ=心臓tickへの第二provider seam + 自律composerへの overlay store 配線 + TTL/マージ/基底復帰/純度/自律専有のテスト。physiology/ とサーバ本体(Domain A)は無変更。

## 1. 作成/変更ファイル一覧

### 変更した既存ファイル(3)
- `apps/runtime-player/src/main/role-composition/autonomous-frame-heart.ts`
  - `CreateAutonomousFrameHeartInput` に第二provider `getChannelOverlay?` を追加(`:128-130`、型宣言+doc)。
  - default provider `const getChannelOverlay = deps.getChannelOverlay ?? (() => null)`(`:158`)。
  - tick内の**Stage Presence snapshot(pure、C3 Domain D)の直後・resolver の直前**にオーバーレイマージを挿入(`:222-224`)。マージ後 Record を resolver に渡す(`:225-228`)。
- `apps/runtime-player/src/main/role-composition/input-subsystem.ts`
  - `RuntimePlayerControlChannelOverlayStore` を import。
  - `RuntimePlayerInputSubsystem` に `getControlChannelOverlayStore: () => store | null` seam を追加(Domain C 取得点)。
  - 自律composer: overlay store を `new` で1個生成し、heart に `getChannelOverlay: (nowMs) => store.snapshot(nowMs)` を渡し、`getControlChannelOverlayStore` で同一インスタンスを露出。
  - tracking composer: `getControlChannelOverlayStore: () => null`(チャネル=自律専有、実行時role分岐なし)。
- `apps/runtime-player/src/main/role-composition/input-subsystem.test.ts`
  - heart構築call shape を assert する既存2テストに `getChannelOverlay: expect.any(Function)` を追加(オーバーレイ配線を反映)。
  - C4 Domain B seam テスト3件を追加(tracking=null / autonomous=同一store共有+TTL境界 / 空store=基底)。

### 新規追加ファイル(1)
- `apps/runtime-player/src/main/role-composition/autonomous-frame-heart-channel-overlay.test.ts`
  — heart × overlay store 統合テスト(8件)。実 `RuntimePlayerControlChannelOverlayStore` を使い、heart tick 経由で観測。

### 共有ファイルの必須修正(1・下記§7で詳述)
- `apps/runtime-player/src/runtime-player-boundary.test.ts`
  — 境界ガードの正規表現 `../control` → `../control[/"']` に厳格化(`control-channel` の誤検知回避)。**私の import が引き起こした新規fail の唯一の原因**であり、ガードの意図(main が `control/` レンダラを import しない)を保ったままの最小修正。

## 2. heart seam の形(シグネチャ・挿入点)

```ts
// CreateAutonomousFrameHeartInput (autonomous-frame-heart.ts:128)
readonly getChannelOverlay?: (nowMs: number) => Record<string, number> | null;
// default (:158)
const getChannelOverlay = deps.getChannelOverlay ?? (() => null);
```

tick内の挿入点(`:222-228`、Stage Presence snapshot の後・resolver の前):

```ts
const overlay = getChannelOverlay(wallNowMs);                       // 第二seam
const resolvedActivations =
  overlay === null ? activations : { ...activations, ...overlay };  // slotId単位の上書き
const parameterValues = resolveSemanticSlotParameterValues({
  slots: heartbeat.slots,
  activations: resolvedActivations
});
```

- **config seam(`getPhysiologyConfig`)とは別concern**: config は参照変化で generator 再構築(`:169-173`)。オーバーレイは値+TTLで**再構築を伴わず**、sample出力へのマージのみ。両者を混ぜていない(別provider・別変数・別挿入点)。
- default が `() => null` なので、tracking composer / 既存テスト全ては `overlay === null` 分岐で `activations` を**そのまま**(コピーせず)resolver に渡す = C2/C3 とバイト等価。既存 heart テスト15件・golden は無変更で緑。
- **Stage Presence signal(C3 Domain D)は pure `activations` を読む位置のまま**(マージの手前)。チャネルオーバーレイは Stage transform を摂動しない(C3挙動不変、範囲外concern)。裁量判断として§8に記載。

## 3. overlay store インスタンス共有の配線方式(Domain C の結線)

- **生成点**: 自律composer(`composeStaticInputSubsystem`)が `new RuntimePlayerControlChannelOverlayStore()` を1個だけ生成。
- **read側(Domain B、配線済み)**: heart に `getChannelOverlay: (nowMs) => store.snapshot(nowMs)` を渡す。tick ごとに未失効分を読む。
- **write側(Domain C が結線)**: `subsystem.getControlChannelOverlayStore()` が**同一インスタンス**を返す。Domain C の合成根はこれを Domain A の `RuntimePlayerControlChannelServer` の option `overlayStore` に渡す。サーバは intent受理で `setOverlay`、切断で `clearAll` を呼ぶ(Domain A 実装済み)。
- tracking composer は `null` を返す → 合成根はチャネルサーバを配線しない(自律専有、data seam、実行時 `if(role)` なし)。`providesPhysiology` / `getStageMotionDrive` と同じ流儀。
- テストで「露出store と heart provider が同一インスタンス」を固定(store.setOverlay → heart provider が反映)。

## 4. TTL評価が wall-clock と logicalTime を混同していないことの説明

- heart は tick で2つの時刻を持つ:
  - `logicalTimeMs = max(0, wallNowMs - epochMs)`(`:191付近`)= **epoch相対の決定論時間**。`generator.sample(logicalTimeMs)` にのみ渡す。fixtureが固定する対象。
  - `wallNowMs = now()`(default `Date.now`)= **絶対壁時計**。オーバーレイ照会 `getChannelOverlay(wallNowMs)` に渡す。
- overlay store の `expiresAtMs` は Domain A のサーバが受理時に `receivedAtMs + (ttlMs ?? defaultWindowMs)` で確定した**絶対壁時計**。`snapshot(nowMs)` は `expiresAtMs > nowMs` で未失効判定。
- 従って TTL失効は **wallNowMs** に対して評価され、logicalTimeMs は一切関与しない。両者を取り違えると epoch分ずれる。専用テスト「judges TTL against the WALL clock, not logical time」で固定(epoch=1000, expiresAtMs=1200, wall=1300→logical=300: 壁時計なら失効、logicalなら誤って生存 → 失効をassertして誤配線を排除)。
- 本番では heart の `now` 既定と store の書き手(サーバ)の `nowMs` 既定が共に `Date.now` = 同一壁時計空間で整合。

## 5. physiology golden/fixture が無変更であることの証拠

- 変更ファイルは `role-composition/` の3ファイル + 新テスト + boundaryテストのみ。**`physiology/` 配下・`headless-slot-resolver.ts`・生成器の pure sample・golden JSON(`blink-default.golden.json`・`blink-alt-config.golden.json`・`full-generator-snapshot.golden.json`)は1バイトも触っていない**(`git status --short` に physiology/ の変更なし)。
- physiology golden/fixture テスト全種を実行し緑(§6):`blink-behavior-fixture`(4)・`physiology-generator`(8、full-generator-snapshot golden含む)・`blink-behavior`(15)・`gaze/head/posture-behavior`・`deterministic-noise`・`physiology-config`・`physiology-coupling`。**golden diff ゼロ**(スナップショット再生成なし、`vitest run` は既存goldenと照合してpass)。
- 純度不変の機構的根拠: オーバーレイは `sample()` の**出力に対する resolver手前のマージ**で、`{ ...activations, ...overlay }` は**新しい Record** を作り sample出力を mutate しない。heart レベル純度テスト「never mutates the generator sample() output」で、overlayが異なるslotIdを足しても sample戻り値オブジェクトが不変であることを固定。

## 6. テスト結果(コマンド・パス/全体件数・既知baselineとの区別)

- **focused(role-composition + physiology + control-channel)**:
  `pnpm -C apps/runtime-player exec vitest run -c vitest.config.ts src/main/role-composition src/main/physiology src/main/control-channel`
  → **26 files / 214 tests 全passed**。
  - うち新規 `autonomous-frame-heart-channel-overlay.test.ts` = 8 passed、`input-subsystem.test.ts` = 16 passed(既存13 + 新規3)、`autonomous-frame-heart.test.ts` = 15 passed(無変更、default null で C2/C3挙動)。
- **boundary(単独・修正後)**: `... src/runtime-player-boundary.test.ts` → **5 tests passed**。
- **runtime-player全体**: `pnpm -C apps/runtime-player exec vitest run -c vitest.config.ts`
  → **792 passed / 2 failed(130 files: 128 passed / 2 failed)**。
  - **2件の fail は既知baseline(Wave21 browser-source系、`effectiveDynamicsTuning` フィールド不一致)**で本実装と無関係:
    1. `src/main/broadcast-source/browser-source-server.test.ts > serves current Runtime Export payload…`
    2. `src/stage/browser-source/browser-source-server-message.test.ts > accepts the not-loaded response shape`
  - Domain A報告(781 passed / 2 failed)+ 本Domain新規11テスト = 792 passed で整合。私は browser-source を1バイトも触っていない。
  - **注記(フレーク)**: 並列フルラン時に `browser-source-server.test.ts > closes connected WebSocket clients that send oversized input` が1度だけ落ちたが、**単独実行では緑**(port競合/WSタイミングのフレーク、既知baselineでも本実装でもない)。再ランでは再現せず。
- **typecheck**: `pnpm -C apps/runtime-player run typecheck`(tsc --noEmit)→ **passed**。
- **check:deps**: `node scripts/check-dependencies.mjs` → **Dependency guard passed**(新規依存なし)。
- **check:source**: 唯一の違反は `apps/runtime-player/src/main/physiology/index.ts`(C3既存committed、**私は未接触**)。私の追加/変更ファイルは違反ゼロ。Domain A報告と同一baseline。
- **lockfile/workspace**: `pnpm-lock.yaml`・`pnpm-workspace.yaml` 無変更(`git status` 確認)。**`pnpm install` 未実行**。回避工作なし。

## 7. 共有ファイル修正の詳細(boundary test・報告義務)

`runtime-player-boundary.test.ts` の「keeps the main process away from React UI modules」が、私の `input-subsystem.ts` の `import ... from "../control-channel/control-channel-overlay-store"` で赤くなった。原因は**命名衝突による誤検知**:

- ガード正規表現 `/\bfrom\s+["']\.\.\/control/` は main が**レンダラ `control/` ディレクトリ**を import しないことを守るためのもの。
- しかし `../control` は `../control-channel`(Domain A が新設した**main-processの兄弟モジュール**)の接頭辞なので、正当な main→main import を誤検知する。
- **本Domainの task は「自律composer が `new RuntimePlayerControlChannelOverlayStore()` を生成」を明示要求**しており、この import は不可避。かつ Domain C も main から control-channel を import するため、この誤検知は C4 全体で再発する。
- **最小修正**: `../control` → `../control[/"']`(末尾に `/` か引用符を要求)。`../control/…`・`../control"`(レンダラ)は依然検出、`../control-channel/…` は非検出。`../stage` も同様に厳格化。ガードの意図(main→レンダラ禁止)は不変で、緩めていない。

これは無関係な revert ではなく、C4 の `control-channel/` main モジュール導入(Domain A)に伴うガードの正当な追随修正。**共有ファイルを触ったため明示報告する**。もしこの修正方針が不可なら escalate(代替は import path のリネームだが、Domain A の `control-channel/` ディレクトリ名を変えることになり波及大)。

## 8. 裁量判断・質問

裁量判断:
1. **Stage Presence signal は pure `activations` のまま**(オーバーレイマージの手前で snapshot)。理由: (a) task の挿入点記述は「resolver に渡す Record」のみ言及、(b) Stage Presence は C3 Domain D concern でスコープ外、(c) C3 Stage Presence テストの無退行。→ チャネルで body-x を上書きしても Stage transform は生成器 body-x に従う(粗いオーバーレイの範囲では許容、精緻化はC5)。
2. **default provider は `() => null`**(オーバーレイ無し)。自律composer は空storeでも `snapshot()` が `{}` を返すため、`overlay===null` 分岐は tracking/既存テスト側、自律は常に spread 分岐だが**空 `{}` のマージは resolver出力バイト等価**。純度不変。
3. **TTLの「既定窓 vs 明示ttlMs」は expiresAtMs の値の差**としてテスト(heart+store統合)。expiresAtMs の**計算**(`ttlMs ?? defaultWindowMs`)は Domain A の dispatch が所有・既テスト。Domain B は「heart が expiresAtMs(壁時計)で基底復帰する」ことを両スタイルで固定。既定窓値は `runtimePlayerControlChannelDefaultWindowMs`(Domain A)を import して式に使用。
4. **境界正規表現の厳格化**(§7)。共有testファイルの最小修正、報告義務履行。

質問(Orch/Undine判断が要る点):
1. **§8-1 の Stage Presence 非結合**で確定か。「チャネルが body-x を上書きしたら Stage も動くべき」なら別concern(heart で `resolvedActivations` から Stage snapshot を取る)だが、C3挙動が変わり範囲外なので**現状は非結合**とした。C5 の精緻化対象と解釈。方向確認したい。
2. **§7 の boundary test 厳格化**が受容可か。C4 全体(Domain C も)で必要な修正で、ガード意図は不変。不可なら escalate。

blocking な質問はなし(全機械ゲート緑)。
