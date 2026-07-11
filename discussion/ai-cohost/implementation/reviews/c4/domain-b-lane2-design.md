# C4 Domain B レビュー (Lane2: design/development 品質)

> Review-Sylph → Orch-Sylph。対象=粗いオーバーレイprovider(心臓tick統合・store共有配線・境界test修正)。
> 観点=seam分離・純度保護機構・store共有配線・共有ファイル修正の妥当性・保守性。仕様適合はLane1、テスト網羅はLane3が担当。
> 判定: **合格**。

## 判定サマリ

全 blocking design 観点(5件)+ 無関係変更の不在が適合。共有ファイル(boundary test)修正も可と判断。C3の `getPhysiologyConfig` / `getStageMotionDrive` seam 前例と流儀一致を確認。非blocking の微小観察1件のみ。

---

## design観点ごとの評価

### 1. seam分離 (blocking) — 適合

- `getChannelOverlay?` は `CreateAutonomousFrameHeartInput` に **`getPhysiologyConfig` と並列の独立第二provider** として宣言(`autonomous-frame-heart.ts:128-130`)。別フィールド・別default・別変数・別挿入点で、config seam と混ざっていない。
- **config seam との concern差が機構的に分離**:
  - config(`:190-194`): 参照比較 `config !== heartbeat.config` で **generator を再構築**。
  - overlay(`:222-224`): 再構築を伴わず、sample出力への **resolver手前マージのみ**。値+TTLのruntime状態でありconfigではない。
- default `getChannelOverlay = deps.getChannelOverlay ?? (() => null)`(`:158`)。`overlay === null` 分岐で `activations` を **そのまま**(spreadせず)resolver に渡す(`:223-224`)→ 既存挙動が完全保存。既存 heart テスト(default provider経由=null分岐)は無変更で緑を維持。
- 結論: config seam(参照変化で再構築)と混ざらず、独立第二providerとして正しく設計。

### 2. 純度保護の機構 (blocking) — 適合

- マージ `overlay === null ? activations : { ...activations, ...overlay }`(`:223-224`)は **新しい Record を生成** し、`generator.sample()` の戻り値を mutate しない。overlay store の `snapshot()` も新 Record を返す(`control-channel-overlay-store.ts:50-60`)ため両者とも非破壊。
- Stage Presence snapshot(`:205-209`)は **マージの手前で pure `activations` を読む**。オーバーレイは Stage transform を摂動しない=C3 Domain D concern が境界の外に正しく分離。
- default null 分岐では `activations` がコピーされず**そのまま**渡るため C2/C3 バイト等価。生成器の pure sample・golden(physiology/配下)は無変更(§6/git status で確認)。
- 純度テスト「never mutates the generator sample() output」(overlay.test.ts:283-313)が sample戻り値オブジェクト不変を固定、「byte-identical to no channel」(:315-339)が公開出力の等価性を固定。機構と検証が一致。

### 3. store インスタンス共有配線 (blocking) — 適合

- 自律composer(`composeStaticInputSubsystem`)が `new RuntimePlayerControlChannelOverlayStore()` を **1個だけ生成**(`input-subsystem.ts:233-234`)。
- **read側**: heart に `getChannelOverlay: (nowMs) => controlChannelOverlayStore.snapshot(nowMs)`(`:244`)。
- **write側**: `getControlChannelOverlayStore: () => controlChannelOverlayStore`(`:276`)で **同一インスタンス** を Domain C 取得seam として露出。
- tracking composer は `getControlChannelOverlayStore: () => null`(`:190`)。実行時 `if(role)` 分岐なし。
- 既存 subsystem seam の流儀(`providesPhysiology`(boolean data)・`getStageMotionDrive`(null/drive data)・`getStageMotionDrive`のnull早期return)に **完全一致**。availability を data として表現し role分岐をcomposerテーブル1点に閉じる思想を踏襲。
- 統合テスト「exposes ONE overlay store shared with the heart's overlay provider」(input-subsystem.test.ts:397-419)が同一インスタンスを固定(露出store.setOverlay → heart provider が反映 + 壁時計TTL境界)。

### 4. 共有ファイル修正 (boundary test) の妥当性 (blocking・報告§7) — 可

- 修正実体(`git diff` で確認): `/\bfrom\s+["']\.\.\/control/` → `/\bfrom\s+["']\.\.\/control[/"']/`。
- 意味論分析:
  - `from "../control/foo"`(レンダラdir) → 直後 `/` → **依然マッチ**(ガード有効)。
  - `from "../control"`(レンダラdir bare import) → 直後 `"` → **依然マッチ**。
  - `from "../control-channel/foo"`(main兄弟モジュール) → 直後 `-` → **非マッチ**(誤検知除去)。
- ガードの意図(main が レンダラ `control/` を import しない)を **緩めていない**。レンダラdirは常に `../control/…` か `../control"` で参照されるため、`control-<接尾>` を除外しても本来の防御に穴は開かない。
- 修正が **不可避** な根拠を確認: 本Domain task が「自律composer が `new RuntimePlayerControlChannelOverlayStore()` を生成」を明示要求し、`input-subsystem.ts:9` で `../control-channel/control-channel-overlay-store` を import。Domain A が `control-channel/`(main兄弟)を新設した構造上、この誤検知は避けられない。修正が無ければ boundary test「keeps the main process away from React UI modules」が誤って赤くなる。
- `../stage` の同様厳格化: 本Domainの厳密な最小範囲を **わずかに超える**(この修正が無くても Domain B は緑)が、(a)同一ガードブロック内の対称修正、(b)`../stage-motion` 等 main兄弟の潜在誤検知を予防、(c)ガード意図不変で副作用なし、のため **許容**。scope creep として blocking にはしない。
- 副作用確認: boundary test の他4テスト(electron/node:/ipcRenderer/BrowserWindow・Stage系)には無影響。regex変更は当該2行のみ。→ **可**。

### 5. TTL wall-clock/logicalTime 取り違え防止 — 適合

- heart は2時刻を明確に使い分け:
  - `logicalTimeMs = Math.max(0, wallNowMs - epochMs)`(`:199`)→ `generator.sample(logicalTimeMs)`(`:200`)**のみ**。fixture固定対象。
  - `wallNowMs = now()`(`:196`)→ `getChannelOverlay(wallNowMs)`(`:222`)。
- store の `expiresAtMs` は Domain A サーバが受理時に確定する **絶対壁時計**(`overlay-store.ts:19-22`)。`snapshot` は `expiresAtMs > nowMs` で判定(`:54`)。
- 従って TTL失効は wallNowMs に対して評価され logicalTimeMs は不関与。取り違えは無い。テスト「judges TTL against the WALL clock, not logical time」(overlay.test.ts:230-250、epoch=1000/expires=1200/wall=1300→logical=300で失効をassert)が誤配線を排除。

### 6. 無関係変更の不在 — 適合

- `git status --short`: tracked変更は4ファイル(autonomous-frame-heart.ts / input-subsystem.ts / input-subsystem.test.ts / runtime-player-boundary.test.ts)+ 新規 overlay.test.ts + untracked `control-channel/`(Domain A)+ docs のみ。
- `physiology/` 配下・`headless-slot-resolver.ts` は **無変更**(status に出現せず)。
- 2本体ファイルの `git diff` は overlay配線の **純加算のみ**(型宣言/default/tick挿入/store生成/seam露出)。revert・無関係改変なし。

---

## 差分

### blocking
なし。

### non-blocking
- **微小観察(性能・任意)**: 自律composer の provider は空store時に `snapshot()` が `{}` を返すため、heart は毎tick `{ ...activations, ...{} }` で **~16キーの新Recordを60Hzで確保**する(overlay無しでも spread分岐を通る)。公開出力はバイト等価で機能上の問題なし(§8-2の裁量判断どおり)。GC負荷は無視できる規模だが、将来 `snapshot` が空時に null を返す等で null fast-path に載せる最適化余地がある。**今回の修正は不要**。

---

## 共有ファイル修正(boundary test)の可否

**可**。正規表現厳格化はガード意図を緩めず、Domain A が導入した `control-channel/` main兄弟モジュールの誤検知のみを外す最小修正。C4全体(Domain C も main から control-channel を import)で必要となる正当な追随。`../stage` の対称修正も無害で許容。

---

## 判定

**合格**。design/development 観点(seam分離・純度保護機構・store共有配線・共有ファイル修正・保守性)すべて適合。C3 seam前例との流儀一致を確認。要修正なし。

---

## 質問(Orch/Undine判断が要る点)

1. **§8-1 Stage Presence 非結合の方向確認は Lane1(仕様適合)領域**。design観点からは「Stage Presence snapshot が pure activations を読み、オーバーレイがマージ前段に分離される」構造は C3 concern を isolate する **クリーンな seam境界** であり、保守性上は妥当。ただし「チャネルが body-x を上書きしたら Stage も動くべきか」は仕様方針(C5精緻化 vs 現状非結合)の判断であり、Lane1/Undine の裁定に委ねる。
2. boundary test 厳格化(§7)の受容可否は本Lane2で **可** と判定済み(上記)。もしプロジェクト方針として共有testの改変自体を避けたい場合のみ、代替(Domain A の `control-channel/` dir リネーム=波及大)を要検討。現状は追随修正を推奨。
