# 「朗読と合いの手」wave — Domain B(配線+操縦席+docs)実装報告

> 実装者: Gnome(サブエージェント委任・Orch-Sylph より)。
> 対象: `apps/soul/agent` 配下の server/settings-store/scripts/UI/view-logic + それぞれのテスト、
> `apps/soul/README.md`、`discussion/ai-cohost/implementation/waves/reading-interjection/followup.md`。
> **`apps/soul/agent/src/mind/` 配下(barge-in.mjs / fire-scheduler.mjs / それぞれの .test.mjs /
> fire-orchestrator.test.mjs)は Domain A の完成品であり一切変更していない**(読み取り専用 import のみ)。
> 根拠文書: [reading-interjection-wave-plan.md](../../../orchestration/reading-interjection-wave-plan.md)・
> [reading-interjection-inventory.md](../../../orchestration/reading-interjection-inventory.md)・
> [domain-a.md](domain-a.md)。

## 1. 変更ファイル一覧

### source

- `apps/soul/agent/src/cockpit/cockpit-server.mjs`(修正・B-1)
- `apps/soul/agent/src/cockpit/cockpit-settings-store.mjs`(修正・B-2)
- `apps/soul/agent/scripts/cockpit.mjs`(修正・B-3)
- `apps/soul/agent/src/cockpit/ui/control-bar.mjs`(修正・B-4)
- `apps/soul/agent/src/cockpit/view-logic/control.mjs`(修正・B-4)
- `apps/soul/agent/src/cockpit/ui/app.mjs`(修正・裁量追加。下記 §7 参照)
- `apps/soul/agent/src/cockpit/ui/styles.mjs`(修正・裁量追加。下記 §7 参照)

### test

- `apps/soul/agent/src/cockpit/cockpit-server.test.mjs`(修正)
- `apps/soul/agent/src/cockpit/cockpit-settings-store.test.mjs`(修正)
- `apps/soul/agent/src/cockpit/view-logic/control.test.mjs`(修正)
- `apps/soul/agent/src/cockpit/cockpit-ui.test.mjs`(修正)
- `apps/soul/agent/scripts/cockpit.test.mjs`(修正)

### docs

- `apps/soul/README.md`(修正・B-5)
- `discussion/ai-cohost/implementation/waves/reading-interjection/followup.md`(新規・B-5)
- `discussion/ai-cohost/implementation/waves/reading-interjection/domain-b.md`(本ファイル・新規)

`apps/soul/agent/src/mind/` 配下(barge-in.mjs / barge-in.test.mjs / fire-orchestrator.test.mjs /
fire-scheduler.mjs / fire-scheduler.test.mjs)は Domain A の成果物のまま**無変更**(cockpit-server.mjs /
cockpit-server.test.mjs から `BARGE_IN_MIN_SPEECH_MS` / `BARGE_IN_GRACE_MS` / `createBargeInGate` /
`createFireScheduler` を **import して読むだけ**)。

## 2. 各配線の実装要点

### 2.1 POST /api/barge-in(cockpit-server.mjs)

POST /api/self-fire(既存)の写経。`body.enabled === true` で真偽値を強制検証し、`bargeInGate` 未生成
(=`fireOrchestrator.interrupt` が関数でない)なら 503。`bargeInGate.setEnabled(enabled)` →
`onSetBargeInEnabled`(未注入なら no-op・失敗寛容)→ `broadcastState()` → `snapshot()` を 200 で返す。

### 2.2 snapshot の bargeIn キー

`selfFire` の直後に `bargeIn: bargeInGate ? { enabled: bargeInGate.isEnabled() } : null` を追加(additive・
既存キーは 1 つも変えていない)。

### 2.3 born-disabled 伝播(§4 基準 2・最重要)

経路: `scripts/cockpit.mjs` の `bargeInHooks.resolveInitialEnabled()`(settings 由来・既定 true)
→ `createCockpitServer({ bargeInInitialEnabled })` → cockpit-server.mjs 内 `bargeInInitialEnabled`
(`options.bargeInInitialEnabled !== false`・既定 true)→ **gate 構築時点**で
`createBargeInGate({ enabled: bargeInInitialEnabled, onConfirm })` に直接渡す。

構築後に `setEnabled` で後追いする実装は**していない**——起動直後に届く VAD イベントが割り込み窓を
作る隙が構造的に無い(gate は生まれた瞬間から enabled/disabled が確定している)。

### 2.4 settings キー(cockpit-settings-store.mjs)

`bargeInEnabled`(boolean)キーを `getSelfFireEnabled`/`setSelfFireEnabled` の直後に追加。get は
non-boolean を null に畳む(bool の有無を区別・selfFireEnabled と完全同型)。read-modify-write の
既存マージ規律に自然に同居する(既存キーを消さない)。

### 2.5 hooks(scripts/cockpit.mjs)

`createBargeInHooks(settings, defaultEnabled = true)` を `createSelfFireHooks` の直後に追加。
`main()` 内で `const bargeInHooks = createBargeInHooks(settings, true);` を構築し、
`createCockpitServer({ ..., bargeInInitialEnabled: bargeInHooks.resolveInitialEnabled(),
onSetBargeInEnabled: bargeInHooks.onSetBargeInEnabled })` を渡す。

### 2.6 Pill(control-bar.mjs)+ view-logic(control.mjs)

`BargeInPill`(`SelfFirePill` の写経・ラベル「かぶり」)を自発トグル(`SelfFirePill`)の隣に配置。
`onToggleBargeIn` ハンドラ(`onToggleSelfFire` の写経)が `POST /api/barge-in` を叩き、成功応答
(snapshot 全体)を `applySnapshot` で反映する。view-logic 側は `bargeInToggleView` /
`bargeInPostErrorText` / `bargeInRequestErrorText` を `selfFireToggleView` 系の写経で追加。

### 2.7 onFireRequest interjection → vision:"preferred"(コード無改修)

cockpit-server.mjs の `onFireRequest` 内の分岐は `req.kind === "silence" ? fire({vision:true}) :
fire({vision:"preferred"})` のみで、"call"/"turn-end"/"comment"/"comment-call"/"interjection" は
すべて同じ else 枝を通る。**この分岐コードは 1 行も変更していない**——コメントのみ追記(§3 参照)。

## 3. 既定 ON の非対称をどう実装したか

self-fire は `options.selfFireInitialEnabled === true`(既定 false・`createSelfFireHooks(settings,
false)`)。barge-in はこれを機械的に写経せず、**逆側**にした:

- cockpit-server.mjs: `const bargeInInitialEnabled = options.bargeInInitialEnabled !== false;`
  (`=== true` ではなく `!== false`。未指定/true は ON、明示 false のときだけ OFF)
- barge-in.mjs(Domain A 既存実装・無変更): `let enabled = options.enabled !== false;`(同型の非対称
  が既に Domain A で実装済み)
- scripts/cockpit.mjs: `createBargeInHooks(settings, true)`(`createSelfFireHooks(settings, false)` の
  `false` を `true` に)

いずれも「self-fire の writing を字面コピーしたら既定 OFF になる」落とし穴を避け、`!== false` /
`defaultEnabled = true` という**別の書き方**を意図的に選んだ箇所。

## 4. onFireRequest interjection → vision:"preferred" の担保

コード分岐は無改修(§2.7)。テストで担保するため、`cockpit-server.mjs` に **`fireSchedulerFactory`
というテスト注入オプションを追加**した(裁量判断・§7 参照)。理由: interjection はタイマー駆動のみで
即時発火経路が無く(呼びかけ/comment-call のように転写 1 件で即発火できない)、実際にタイマーを
待つと最短でも数十秒かかり現実的でない。`fireOrchestratorFactory`/`pipelineFactory` と同型の
factory 差し替えパターンとして追加し、本番(`scripts/cockpit.mjs`)は未指定のまま(挙動不変)。

これにより `cockpit-server.test.mjs` の 2 テストで、cockpit-server 内部の `onFireRequest`
コールバックを直接捕捉し、`{kind:"interjection"}` を渡して:
- `fire({vision:"preferred"})` が呼ばれること
- selfFire SSE に `kind:"interjection"` がそのまま載ること

を固定した。

## 5. server ワイヤ契約 additive の自己確認

- **POST +1**: `/api/barge-in` のみ追加。既存 POST/GET は 1 つも削除・改名していない。
- **snapshot キー +1**: `bargeIn` のみ追加。既存キー(`selfFire`/`verbosity`/`killed`/`brain` 等)は
  1 つも変えていない。
- **SSE 種別は増やしていない**: interjection は既存 `selfFire` SSE イベントに `kind` 文字列として
  素通しで載るだけ(§2.7・§4 のテストで固定)。新規 SSE イベント名は追加していない。
- エンドポイント数コメント(`既存 19 エンドポイント×13 SSE`)を 2 箇所とも `20 エンドポイント×13 SSE`
  へ更新(SSE 数は不変のまま)。

## 6. 追加/更新したテスト一覧

### cockpit-server.test.mjs

- `makeFakeOrchestrator` に `interrupt()` 呼び出し記録(`interruptCount`)を追加(既存テストに無影響
  な追加のみ)。
- POST /api/barge-in 6 種:
  - gate 未生成なら 503
  - enabled 切替・`state.bargeIn` 反映(既定 ON の確認込み)
  - 非 boolean(文字列/数値/欠落)は `enabled:false` 強制(`body.enabled === true` 判定の確認)
  - `onSetBargeInEnabled` 永続化フックへ橋渡し
  - `broadcastState` が SSE state へ `bargeIn` を乗せる
- **born-disabled 伝播(blocking)** 2 種:
  - `bargeInInitialEnabled:false` → `server.bargeInStatus()` が即座に `{enabled:false}`(同期証拠)+
    VAD(speechStart)を送り第一段+第二段のフル猶予(`BARGE_IN_MIN_SPEECH_MS + BARGE_IN_GRACE_MS`)
    待っても `interruptCount` が 0 のまま
  - 未指定(既定 ON)→ `server.bargeInStatus()` が `{enabled:true}` + 同じ VAD シナリオで
    フル猶予後に `interruptCount` が 1 になる(第一段通過直後はまだ 0 であることも確認)
- **onFireRequest interjection** 2 種(§4 参照): vision:"preferred" 呼び出し固定 / selfFire SSE
  への素通し固定。

### cockpit-settings-store.test.mjs

`bargeInEnabled` 4 種(selfFireEnabled テストの写経): 既定 null(未記憶)→ set/get roundtrip・他キーとの
同居・corrupt/非 bool JSON は null・unwritable path は握って続行。

### view-logic/control.test.mjs

`bargeInToggleView`(null は disable+not available・enabled の on/off 導出)・`bargeInPostErrorText`
(503/エラー/成功 null)・`bargeInRequestErrorText`(catch 文言)の 4 テスト(selfFireToggleView 系の写経)。

### cockpit-ui.test.mjs

- `settingsFromSnapshot` の既存テストに `bargeIn`(null 許容・selfFire と同型)を追加して更新。
- `BargeInPill` vnode テスト(null/enabled の disable・checked 導出)。
- Domain C import スモークに `BargeInPill` を追加。
- COCKPIT_CSS テストに `.barge-in-pill` の存在確認を追加。

### scripts/cockpit.test.mjs

`createBargeInHooks` 5 テスト(createSelfFireHooks テストの写経): **既定 true**へのフォールバック
(selfFire の既定 false との非対称を明示確認)・defaultEnabled 明示指定・記憶済み bool 優先・
onSetBargeInEnabled 橋渡し・throw 握り。

## 7. 裁量判断・不確実点・レビューへの申し送り

1. **`fireSchedulerFactory` オプションの追加**(cockpit-server.mjs): タスク指示の B-1 項目には
   明記されていない追加。interjection がタイマー駆動のみで即時発火経路が無く、`onFireRequest
   interjection テスト`(B-6 で明示指定)を現実的なテスト時間で実装するために必要と判断した。
   `fireOrchestratorFactory`/`pipelineFactory` と同型の既存設計パターンに沿っており、本番
   (`scripts/cockpit.mjs`)は未指定のまま(挙動不変)・HTTP ワイヤ契約には一切影響しない。
   レビューで「スコープ超過」と判断されれば、このオプションと関連 2 テストのみ切り離せる
   (born-disabled 等の他のテストには依存しない独立した追加)。
2. **`app.mjs` への配線追加**: タスク指示は B-4 で control-bar.mjs / view-logic/control.mjs のみを
   明記していたが、`ControlBar` が `bargeIn` prop を受け取れるようにしても、呼び出し元
   (`app.mjs` の `settingsFromSnapshot` と `<${ControlBar}>` 呼び出し)が実際に snapshot の
   `bargeIn` を橋渡ししない限り `BargeInPill` は永久に「not available」のまま描画され機能しない。
   selfFire/verbosity/killed と同型の配線(2 行 diff)として実施した。
3. **`styles.mjs` への CSS 追加**: `.barge-in-pill`/`.barge-in-toggle`/`.barge-in-status` を
   `.self-fire-pill` 系の写経で追加した。指示に明記は無いが、Pill として視覚的に機能させるための
   最小限の追加と判断した(`.pill-label` は既存共通クラスを再利用・新規クラスは 3 つのみ)。
4. **born-disabled のフル待機テストが実時間 ~2.4 秒かかる**: `BARGE_IN_MIN_SPEECH_MS`(200ms)/
   `BARGE_IN_GRACE_MS`(2000ms)をテストからタイマー注入できる経路が cockpit-server.mjs に無い
   (`createBargeInGate` 呼び出しに `setTimeoutImpl` 等を渡していない・Domain A 側の設計のまま)ため、
   実時間で待つ以外の手段がなかった。既定 ON 側のテストに `{ timeout: 10000 }` を明示指定した。
   全体テスト実行時間は Domain A 時点の約 1.8 秒から約 6.4 秒に伸びている(主因はこの 2 テスト)。
   気になるようであれば、cockpit-server.mjs に `barge-in` 用のタイマー注入経路を別途追加する改善
   candidateとして followup 送りにできる(未実施)。
5. **followup.md に記録した Domain A レビュー由来の 3 件 + Domain B 実装時の 1 件**: 詳細は
   `discussion/ai-cohost/implementation/waves/reading-interjection/followup.md` 参照
   (VAD minSpeechMs 独立性の疑義・再武装コメントの nit・lastFireAtMs 共有の nit・Domain B の裁量事項)。
6. **質問**: `fireSchedulerFactory` オプションの追加(上記 1)がレビューで許容されない場合、
   「onFireRequest interjection テスト」をどう固定すべきか代替方針の指示を仰ぎたい(例: fire-scheduler
   の完全なタイマーサイクルを長時間実行で許容する / このテストを断念しコードレビューでの担保に留める、
   等)。

## 8. node --test(全体)の生サマリ

`apps/soul/agent` で `node --test`:

```
# tests 886
# suites 0
# pass 886
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 6414.5812
```

実装前(Domain A 完了時点のベースライン・domain-a.md §10 記載): `tests 863 / pass 863 / fail 0 /
cancelled 0`。実装後(上記): `tests 886 / pass 886`。差分 +23 テスト
(barge-in: 9・settings-store: 4・view-logic/control: 4・cockpit-ui: 2(BargeInPill vnode 1 +
settingsFromSnapshot 更新は既存テストの拡張であり新規カウントなし)・scripts/cockpit: 5。
実数は個別ファイルの grep 結果(下記)で裏取り可能)。

個別実行(barge-in/interjection 関連テストのみを grep で抽出・全 pass):

```
$ node --test src/cockpit/cockpit-server.test.mjs src/cockpit/cockpit-settings-store.test.mjs \
    src/cockpit/view-logic/control.test.mjs src/cockpit/cockpit-ui.test.mjs scripts/cockpit.test.mjs \
    2>&1 | grep -E "^(ok|not ok)" | grep -iE "barge|interjection"
```
→ 27 件、すべて `ok`(gate 未生成 503・enabled 切替・非 boolean 強制・永続フック・broadcastState・
born-disabled 2 種・onFireRequest interjection 2 種・settings-store 4 種・view-logic 4 種・
BargeInPill vnode・COCKPIT_CSS・createBargeInHooks 5 種、他)。

この個別実行の合計サマリ(該当 5 ファイルのみ):
```
# tests 247
# pass 247
# fail 0
# cancelled 0
```

## 9. git diff --stat(全体)の生出力

```
$ git diff --stat
 .tmp/editor-dev.err.log                            |  13 -
 .tmp/editor-dev.out.log                            |   5 -
 .../src/perception/render-scene-adapter.ts         | 125 +++++++++-
 apps/soul/README.md                                |  38 ++-
 apps/soul/agent/scripts/cockpit.mjs                |  39 +++
 apps/soul/agent/scripts/cockpit.test.mjs           |  53 ++++
 apps/soul/agent/src/cockpit/cockpit-server.mjs     |  68 +++++-
 .../soul/agent/src/cockpit/cockpit-server.test.mjs | 236 +++++++++++++++++-
 .../agent/src/cockpit/cockpit-settings-store.mjs   |  14 ++
 .../src/cockpit/cockpit-settings-store.test.mjs    |  70 ++++++
 apps/soul/agent/src/cockpit/cockpit-ui.test.mjs    |  25 +-
 apps/soul/agent/src/cockpit/ui/app.mjs             |   4 +
 apps/soul/agent/src/cockpit/ui/control-bar.mjs     |  61 ++++-
 apps/soul/agent/src/cockpit/ui/styles.mjs          |  13 +
 apps/soul/agent/src/cockpit/view-logic/control.mjs |  50 ++++
 .../agent/src/cockpit/view-logic/control.test.mjs  |  50 +++-
 apps/soul/agent/src/mind/barge-in.mjs              | 150 ++++++++++--
 apps/soul/agent/src/mind/barge-in.test.mjs         | 271 ++++++++++++++++++++-
 .../soul/agent/src/mind/fire-orchestrator.test.mjs |  10 +-
 apps/soul/agent/src/mind/fire-scheduler.mjs        | 187 ++++++++++++--
 apps/soul/agent/src/mind/fire-scheduler.test.mjs   | 246 +++++++++++++++++++
 .../boundary-transparent-margin-design.md          |   2 +-
 discussion/mesh-generation/implementation/_map.md  |   3 +-
 .../model-authoring/craft/06-face-angle-x.md       |  22 ++
 .../model-authoring/craft/09-mouth-lipsync.md      |  89 ++++++-
 discussion/model-authoring/craft/10-variants.md    |  38 ++-
 discussion/model-authoring/craft/_conductor.md     |   4 +-
 discussion/model-authoring/craft/_map.md           |   7 +-
 .../ref-render-gate/ref-eyes-viewport.png          | Bin 98001 -> 607009 bytes
 .../experiments/ref-render-gate/ref-face-focus.png | Bin 255368 -> 1186111 bytes
 .../experiments/ref-render-gate/ref-rest-full.png  | Bin 327957 -> 337346 bytes
 31 files changed, 1789 insertions(+), 104 deletions(-)
```

**このうち私(Domain B Gnome)が変更したのは §1 に列挙した 12 ファイル(source 7 + test 5)のみ**。
`apps/soul/agent/src/mind/*` の 5 ファイルは Domain A の成果物で私は一切触っていない(Domain A 完了
時点で既に存在した diff)。`.tmp/*`・`apps/authoring-host/*`・`discussion/mesh-generation/*`・
`discussion/model-authoring/*` は本セッション開始前から git status 上 modified だった他エージェント
由来の変更で、私は一切触れていない(`git status` の初期スナップショットに記載済み)。

`git diff --stat` は untracked ファイル(新規作成した `followup.md`・`domain-b.md`・レビュー記録)を
含まないため、それらは別途 `git status --porcelain` で確認した(§10)。

## 10. git diff --stat -- apps/runtime-player "packages/" "pnpm-lock.yaml"(空)の生出力

```
$ git diff --stat -- apps/runtime-player "packages/" "pnpm-lock.yaml"
(no output)
```

器(apps/runtime-player)・packages/・root pnpm-lock.yaml は無接触(出力なし = 完全一致)。

参考: `git status --porcelain -- apps/soul discussion/ai-cohost` の出力(untracked 含む):

```
 M apps/soul/README.md
 M apps/soul/agent/scripts/cockpit.mjs
 M apps/soul/agent/scripts/cockpit.test.mjs
 M apps/soul/agent/src/cockpit/cockpit-server.mjs
 M apps/soul/agent/src/cockpit/cockpit-server.test.mjs
 M apps/soul/agent/src/cockpit/cockpit-settings-store.mjs
 M apps/soul/agent/src/cockpit/cockpit-settings-store.test.mjs
 M apps/soul/agent/src/cockpit/cockpit-ui.test.mjs
 M apps/soul/agent/src/cockpit/ui/app.mjs
 M apps/soul/agent/src/cockpit/ui/control-bar.mjs
 M apps/soul/agent/src/cockpit/ui/styles.mjs
 M apps/soul/agent/src/cockpit/view-logic/control.mjs
 M apps/soul/agent/src/cockpit/view-logic/control.test.mjs
 M apps/soul/agent/src/mind/barge-in.mjs            (Domain A・無変更)
 M apps/soul/agent/src/mind/barge-in.test.mjs       (Domain A・無変更)
 M apps/soul/agent/src/mind/fire-orchestrator.test.mjs (Domain A・無変更)
 M apps/soul/agent/src/mind/fire-scheduler.mjs      (Domain A・無変更)
 M apps/soul/agent/src/mind/fire-scheduler.test.mjs (Domain A・無変更)
?? discussion/ai-cohost/implementation/reviews/reading-interjection/  (Domain A レビュー記録・無変更)
?? discussion/ai-cohost/implementation/waves/reading-interjection/    (domain-a*.md 既存 + followup.md/domain-b.md 新規)
```

## 11. followup.md 作成

`discussion/ai-cohost/implementation/waves/reading-interjection/followup.md` を新規作成し、以下を
記録した:

1. VAD `minSpeechMs`(250ms・speech-segmenter.mjs)と barge-in `minSpeechMs`(200ms)の独立性の疑義
   (非 blocking・pre-existing・人間ゲート確認材料として明記)。
2. 合いの手の再武装コメントが「base=refractory×2」という具体的数値関係に依存した書き方になっている
   nit(実際の十分条件は base≥refractory)。
3. `lastFireAtMs` が全語彙共有の不応期基点であるための nit(裁定 6 どおりの仕様・記録のみ)。
4. Domain B 実装時の裁量事項(app.mjs 配線・fireSchedulerFactory 追加等)の記録。
