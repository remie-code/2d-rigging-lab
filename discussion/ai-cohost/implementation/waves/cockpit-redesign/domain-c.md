# 操縦席UI改定 Domain C: 運転バー + 設定引き出し（IA の再配置）

> Status: 実装完了・機械ゲート緑（2026-07-14）。Domain A の土台（vendor・静的配信・view-logic）と
> Domain B の観測+ヘッダ（App 骨組み・SSE 単一経路）の上に、**運転バー（常駐）と設定引き出し
> （⚙ で開閉・普段は畳む）**を preact+htm（no-build）で実装し、Domain B のプレースホルダを実体へ
> 置換した。cockpit.html は 1 バイトも触っていない（エントリ差し替えは Domain D）。
> 担当: Gnome（Orch-Sylph 委任）。対象パッケージ: `apps/soul/agent`（独立 npm・workspace glob 外＝lockfile 不変）。
> 契約の正: [../../orchestration/cockpit-redesign-wave-plan.md](../../orchestration/cockpit-redesign-wave-plan.md) §3 Domain C / §4 /
> [../../orchestration/cockpit-redesign-inventory.md](../../orchestration/cockpit-redesign-inventory.md) §2-2・§2-3（保存オラクル）/
> [../../screens/cockpit-redesign.md](../../screens/cockpit-redesign.md) §2・§3・§4・§7 /
> [domain-a.md](domain-a.md)・[domain-b.md](domain-b.md)（土台・§2 props 契約・§8 申し送り）/
> [../../reviews/cockpit-redesign/domain-b-review-design.md](../../reviews/cockpit-redesign/domain-b-review-design.md) §9（11 点の申し送り——全点消化・§8 参照）。

## 0. このDomainが敷いた線（操作 → POST → 応答 → 状態の一方向流）

```
ControlBar（ui/control-bar.mjs・常駐）            SettingsDrawer（ui/settings-drawer.mjs・⚙ で開閉）
  │ Fire / Fire+視覚 / 自発トグル / 口数(場所のみ) / KILL(枠のみ)   │ 接続（Channel/YouTube）・入出力（マイク/声/視界）
  │                                                                │ + 独立 effect の初期ロード（devices/windows/audio-devices）
  ├─ POST /api/fire・/api/vision-fire ─────────┐                   ├─ GET /api/devices・/api/windows・/api/audio-devices
  │   応答 j = {fired, state, reason}（snapshot でない）           ├─ POST /api/ears/start・stop・/api/channel・
  │   → setSoul(j.state)・setFireNote(view-logic 文言)             │   /api/chat/connect・disconnect・/api/vision-target・
  │   （applySnapshot に**乗らない**・4 点セット直結）             │   /api/audio-device（200 応答 = **snapshot 全体**）
  │                                                                │        │
  ├─ POST /api/self-fire（200 応答 = snapshot 全体）───────────────┴────────┤
  │                                                                         ▼
  │                            applySnapshot（app.mjs の useCallback・applyStateRef.current 共有）
  │                                     │  = applyState :265-284 の単一経路（SSE state と同じ口）
  │                                     ▼
  │        App state（ears/health/discarded/uptime/chatDisplay/settings）→ 再 render
  │                                     │
  └── settings.selfFire → selfFireToggleView → checked ◄──────────────────┘
      （**一方向流**: checked は snapshot 由来のみ・onChange は POST のみ =
        programmatic 反映が change を発火しない controlled 形で selfFireSyncing :323 を構造的に廃止）

導線（cockpit-redesign.md §4）: GET /api/state 成功 → setStateLoaded(true) →
  effect が一度だけ shouldAutoOpenSettings(初回 snapshot) を判定 → 設定空なら setSettingsOpen(true)。
  二回目以降（何か記憶済み）・fetch 失敗時は開かない = 観測直行。
```

- **表示文字列・状態導出はすべて view-logic 経由**（L0 裁定）: 新設 `view-logic/control.mjs`（運転層）と
  `view-logic/settings.mjs`（設定層）に旧ハンドラの全文言を fixture 付きで固定した。コンポーネントは
  「view-logic を呼ぶ + POST を発射する」薄い層（rows.mjs 流儀）。**status.mjs の完成済み 4 関数
  （chatStatusView/chatDisplayState/shouldRestoreChatSource/channelStatusView）は呼ぶだけ**（再実装なし・
  dead 時 Disconnect 無効の裁定込み）。
- **鉄の設計規律の維持**: ui/*.mjs はトップレベル副作用ゼロ（fetch は props 注入 or 関数実行時の
  `globalThis.fetch` 参照）。Node import スモークが新 2 ファイルにも通る（構造テストは readdir 走査で
  自動的に検査対象へ）。
- **サーバ・cockpit.html・page test・scripts/cockpit.mjs・.gitignore・vendor・Domain A の view-logic 6
  モジュールは 1 バイトも触っていない**（§6 で git 証明）。

## 1. 実装/変更ファイル一覧（+ sha256）

| ファイル | 種別 | 役割 | sha256 |
|---|---|---|---|
| `src/cockpit/view-logic/control.mjs` | 新規（C-1） | 運転層の表示導出: `soulStatusView`（:434-441 busy disable+文言）・`fireNoteFromSseFire`（:860-864・**Domain B app.mjs:128 暫定移植の統合先**）・`fireNoteFromFireResponse`（:561-563 :580-582 の 503/reason）・`fireRequestErrorNote`（:566-567 :585-586）・`selfFireToggleView`（:324-340 null=not available）・`selfFirePostErrorText`（:645-648）・`selfFireRequestErrorText`（:649-650） | `c38e6d2555234cc077cc8d248e670747d93fcf95c310bba1fe633023593f6024` |
| `src/cockpit/view-logic/control.test.mjs` | 新規 | 上記 fixture **8 本**（現 cockpit.html の表示文字列と機能同値） | `9637119dcaacd5ced9d4315978952e588b252d47ed7bd2ecc32b9e12adafd9c4` |
| `src/cockpit/view-logic/settings.mjs` | 新規（C-1） | 設定層の表示導出: `visionTargetLabel`（:317-322）・`micDeviceListView`（:704-726）・`windowListView`（:592-613）・`audioDeviceListView`（:656-677）・`initialDeviceSelection`（:698-703 :721 lastDevice 初期選択）・`visionTargetPostErrorText`/`audioDevicePostErrorText`/`channelPostErrorText`（各 503/set failed）・`chatConnectErrorText`（:787-791）・`CHAT_EMPTY_SOURCE_ERROR`（:779）・`earsStartFailureText`（:740-742）・`requestErrorText`（catch 文言 10 種の表）・**`shouldAutoOpenSettings`（導線 §4 の判定式・§5）** | `08871065921210bbe7cc3c4d61837ce10dcc4e03b3740aaea6eb34148fd0cb62` |
| `src/cockpit/view-logic/settings.test.mjs` | 新規 | 上記 fixture **11 本** | `48e941dfd74850c58b24e41e4eddc1a1dfd0822f509dfed2612a74d8cf541c63` |
| `src/cockpit/view-logic/status.mjs` | **変更（追加のみ）** | `chatDisplayFromSseStatus` を追加（SSE 側 `d.status \|\| "connecting"`（:884）の正規化を app.mjs から**片寄せ**・design レビュー申し送り 5）。既存 4 関数は無改変 | `c1c230d1b44d05aa02bba9737b80bc8baffbb8abffbcd96b5fb7a8d9bf8d3051` |
| `src/cockpit/view-logic/status.test.mjs` | **変更（+1 本）** | `chatDisplayFromSseStatus` fixture 追加（7→**8 本**・既存 7 本は無改変） | `8c593f3bc854b04aeee8659566bfdfaa9429b8b1d01ed74aeefb770aee3b0acd` |
| `src/cockpit/ui/control-bar.mjs` | 新規（C-2） | 運転バー（常駐）: Fire / Fire+視覚（ローカル busy 連打防止 + soulStatusView disable）・soul 表示・fire-note・自発トグル pill（**controlled**）・口数プルダウン（場所のみ・no-op）・KILL（枠のみ・disabled・S8 予約）。hooks 非使用の葉部品 `FireButtons`/`SelfFirePill`/`KillSwitch` を export（vnode 走査対象） | `f237692222f8218047ad3f02011c3c7a95a4a38a3651968e4d17cd7a2f06c35d` |
| `src/cockpit/ui/settings-drawer.mjs` | 新規（C-3） | 設定引き出し: 接続（Channel/YouTube chat）・入出力（マイク+Start/Stop・声の出力先・視界）+ 各エラー欄 + 初期ロード独立 effect + source 記憶復元。hooks 非使用の葉部品 `SettingsSelect`/`DrawerStatus` を export | `e7798294d158613c4a44420a75aa12c08a8ed8036f193b9dcc461eff36cc5b89` |
| `src/cockpit/ui/app.mjs` | **変更（C-4・最小結線）** | プレースホルダ 2 スロットを実コンポーネントへ置換・`stateLoaded`+`initialSnapshotRef`+自動展開 effect（§5）・`applySnapshot` useCallback・SSE fire 分岐を `fireNoteFromSseFire` へ・SSE chatStatus 正規化を `chatDisplayFromSseStatus` へ片寄せ（**挙動同値**・旧リテラルの置換のみ）・コメント整合 | `60f091d6cf8255badc95161d8a72937cc0467e9ddf6a8c686909cf89ccbd18c0` |
| `src/cockpit/ui/styles.mjs` | **変更（C-5・追記+スロット CSS 置換）** | 運転バー/設定引き出しの §7 意匠を COCKPIT_CSS へ追記（§5 の表）。実体化に伴い旧スロット 2 行（`.control-bar-slot`/`.settings-drawer-slot`）を削除（死コードゼロ）。既存トークン・既存セレクタは無改変 | `2a7d7c8b4a19e8f2d41437bdf84c4cf78c9bed5fc9cbd5b11d39339ed9b470fd` |
| `src/cockpit/cockpit-ui.test.mjs` | **変更（+7 本）** | Domain C 追加: import スモーク（VERBOSITY_OPTIONS 3 択固定込み）・`FireButtons`/`SelfFirePill`/`KillSwitch`/`SettingsSelect`/`DrawerStatus` の vnode 走査（`collectElements` ヘルパ追加）・CSS 意匠検査（KILL 赤枠・畳み・chevron・pill・色ドット・.err）。既存 23 本は無改変（23→**30 本**） | `936cb28dcd29fedc6ca3f9c390b052b9d8459c81328e77b9cf837da442737181` |
| `src/cockpit/cockpit-static-assets.test.mjs` | **変更（列挙拡張・本数不変）** | 「ui/*.mjs は置くだけで配信される」テストの対象列挙に `control-bar.mjs`/`settings-drawer.mjs` を追加（1 ケース内のループ拡張・**10 本のまま**） | `4a5c4e95acdd4e670aedddf70fa0fa038a11df2e74f4ca7cc479ad98dfdd8b69` |

**触っていないもの**: cockpit.html（913 行・移植元）・cockpit-page.test.mjs・cockpit-server.mjs（Domain A の
80 insertions のまま・§6）・scripts/cockpit.mjs・.gitignore・vendor（凍結）・Domain A の view-logic 6 モジュール
（status.mjs の追加を除き）とテスト・**Domain B の header.mjs / feed.mjs / rows.mjs（1 バイトも触っていない**・
header.mjs のデッドフォールバック削除も見送り = §8-6）・器コード・契約 JSON・lockfile・package.json
（新規 npm 依存ゼロ・devDep ゼロ維持・ビルド段ゼロ）。

## 2. コンポーネント構成と props 契約（Domain D が呼ぶ最終形の口）

**Domain D から見た入口は Domain B のまま不変**: `mount(rootElement, { eventSourceImpl?, fetchImpl?, nowImpl? })`
（ui/app.mjs）だけを呼べば運転バー・設定引き出し込みの App 全体が立ち上がる。`fetchImpl` は App から
ControlBar/SettingsDrawer へそのまま流れる（テスト/linkedom 梯子の駆動口）。

### `ControlBar(props)` — ui/control-bar.mjs（App が結線済み）

| prop | 型 | 意味 |
|---|---|---|
| `soul` | string | SSE soul / Fire 応答の生 state（busy disable は `soulStatusView` 導出）。 |
| `setSoul` | (s) => void | Fire/vision-fire 応答の state 反映（:564 :583。応答 j = {fired, state, reason} は snapshot でない = applySnapshot に乗らない。**design レビュー申し送り 2 の 4 点セット**）。 |
| `fireNote` / `setFireNote` | string / (t) => void | fire-note（SSE 非受理 / 応答 503 / fetch 失敗。押下時 "" クリア :557 :575 込み）。 |
| `selfFire` | { enabled } \| null | snapshot の selfFire（null = not available・`settings.selfFire` を App が渡す）。 |
| `applySnapshot` | (s) => void | POST /api/self-fire の 200 応答（snapshot 全体）の適用（applyStateRef.current 共有）。 |
| `fetchImpl` | 任意 | fetch 注入（既定は関数実行時の globalThis.fetch）。 |

内部 state: `localBusy`（Fire 連打防止・応答/失敗で復帰）・`controlError`（自発トグルのエラー欄 = 旧
conversation-error の自発系・§3）・`verbosity`（口数・ローカル保持のみ・**どこにも送らない no-op**・
実配線は s6-followup §12 の将来課題 = コード内コメント + 本 docs に注記）。

### `SettingsDrawer(props)` — ui/settings-drawer.mjs（App が結線済み）

| prop | 型 | 意味 |
|---|---|---|
| `open` | boolean | 開閉（CSS `.open`）。**コンポーネントは常時 mount** = 初期ロード 1 回・入力欄状態が開閉で消えない。 |
| `onClose` | () => void | ✕ ボタン（App は `setSettingsOpen(false)`）。 |
| `settings` | settingsFromSnapshot 値 | channel/visionTarget/selfFire/audioDevice/chat の生現況。 |
| `chatDisplay` | string \| null | chatStatusView への入力（renderChatStatus :294-306 の単一経路）。 |
| `applySnapshot` | (s) => void | 各 POST の snapshot 応答適用（applyStateRef.current 共有）。 |
| `fetchImpl` | 任意 | fetch 注入。 |

内部 state: マイク（options/selected/busy/error）・Channel（url/error）・chat（source/edited ref/error/
connectBusy）・視界（options/selected/error）・声（options/selected/error）。

### hooks 非使用の葉部品（vnode 走査テスト対象・機械描画のみ）

`FireButtons({soulView, localBusy, onFire, onVisionFire})`・`SelfFirePill({view, onChange})`・`KillSwitch()`・
`SettingsSelect({className?, options, value, onChange, disabled?})`・`DrawerStatus({view})`。view はすべて
view-logic の導出済み構造体（部品内に導出なし）。

## 3. 保存オラクル対応表（inventory §2-2 運転層 + §2-3 設定層）

| 項目 | 旧（cockpit.html） | 新実装の場所 | 機械固定 |
|---|---|---|---|
| Fire（busy 中 disable・503/reason 表示） | :217-223 :555-570 + applySoulState :434-441 | control-bar `fireWith("/api/fire","fire")` + `FireButtons`（disable = `soulStatusView.fireDisabled \|\| localBusy`）+ `fireNoteFromFireResponse`/`fireRequestErrorNote` | control.test 4 本 + FireButtons vnode |
| Fire 視覚（同上） | :573-589 | 同上 `fireWith("/api/vision-fire","vision")`（503 文言は両ボタン共通 = 原実装同値・catch は "vision fire error:"） | 同上 |
| soul 状態表示（idle/thinking/speaking） | :220 :434-441 | control-bar `.soul-note`（`soulStatusView.text/className`・Domain B が保持した `soul` state を描画） | control.test + CSS 検査 |
| fire-note（非受理 reason・SSE/応答/catch の三系統） | :221 :442-444 :562-563 :863 | app.mjs SSE fire → `fireNoteFromSseFire`（**B の暫定移植 :128 を統合**）・応答/失敗は control-bar → `setFireNote` | control.test 3 本 |
| 自発 ON/OFF トグル（null 時 not available・syncing 無限ループ防止） | :204-206 :323-340 :635-652 | control-bar `SelfFirePill` + `selfFireToggleView`。**controlled 化**（checked=snapshot 由来・onChange=POST のみ・POST 応答/SSE state からの一方向流）で `selfFireSyncing` を構造的に廃止（§0 図） | control.test 2 本 + SelfFirePill vnode（disabled/checked/on） |
| 口数モード（**未実装**・場所だけ・実配線は s6-followup §12） | — | control-bar `.verbosity`（控えめ/ふつう/おしゃべり・ローカル保持のみ・no-op・コード内コメント + 本 §2/§8-1 に将来課題注記） | VERBOSITY_OPTIONS deepEqual |
| KILL（**S8 予約**・枠のみ） | — | control-bar `KillSwitch`（disabled・赤枠 = §7 意匠・title に「S8 で実装」） | KillSwitch vnode（disabled）+ CSS 赤枠検査 |
| マイク選択 + Start/Stop（lastDevice 初期選択・setBusy） | :163-169 :697-750 :804-811 | drawer マイク行: `micDeviceListView` + `initialDeviceSelection`（lastDevice :721）+ `onStart`（失敗 = `earsStartFailureText` + `applySnapshot(res.j.state)` :742・成功 = クリア + snapshot :744-745）+ `onStop`（クリア無し = 原実装踏襲）+ `micBusy`（:729 setBusy 相当・両ボタン disable） | settings.test 3 本 + SettingsSelect vnode |
| Channel URL（**token 秘匿 = Set 成功後に入力欄クリア**・redact 表示・connected/error/connecting 色） | :172-178 :753-770 + applyChannel :347-359 | drawer Channel 行: `onChannelSet`（成功 → `applySnapshot(res.j)` + `setChannelUrl("")` :765-766）・表示は **status.mjs `channelStatusView`（完成済み・呼ぶだけ）** + `DrawerStatus`（色ドット） | status.test（A 固定）+ settings.test（channelPostErrorText）+ DrawerStatus vnode |
| YouTube Connect/Disconnect（**Disconnect 有効無効は state 駆動・dead 無効**・source 記憶復元・chatSourceEdited 制御） | :182-189 :288-315 :775-803 | drawer chat 行: `onChatConnect`（空 source = `CHAT_EMPTY_SOURCE_ERROR`・成功 → edited 解除 :791 + snapshot）・`onChatDisconnect`・disabled は **status.mjs `chatStatusView(chatDisplay).disconnectDisabled`（完成済み・呼ぶだけ）**・復元は **`shouldRestoreChatSource`（完成済み）** + `chatEditedRef`（入力中は復元しない・snapshot 到着ごとの effect = applyChat :309-311 同値） | status.test（A 固定）+ settings.test（chatConnectErrorText/空 source）+ DrawerStatus vnode（dead） |
| 視界（ゲーム窓）選択（一覧更新・Set・status） | :192-199 :317-322 :591-631 | drawer 視界行: `loadWindows`/`windowListView`（"title (processName)" :605）+ Refresh + `onVisionSet` + `visionTargetLabel` | settings.test 3 本 |
| 声の出力先（一覧更新・Set・**その場再起動はサーバ側挙動**・status） | :207-212 :342-345 :654-695 | drawer 声行: `loadAudioDevices`/`audioDeviceListView` + Refresh + `onAudioSet` + **health.mjs `voiceOutputLabel`（B 済み・共有）** | settings.test 2 本 |
| **各種エラー欄**（§2-3「各種エラー欄」・design レビュー申し送り 10 の置き場） | devices-error :168 / channel-error :177 / chat-error :188 / vision-error :198 / conversation-error :212 | devices-error → マイク行下の `.drawer-note .err` / channel-error → Channel 行下 / chat-error → chat 行下 / vision-error → 視界行下 / **conversation-error は IA 再配置で分割**: 音声出力系 → 声の出力先行下（`audioError`）・自発トグル系 → 運転バー `.control-error`（§8-2） | 文言は control/settings.test で全固定 |
| 初期ロード（loadDevices/loadWindows/loadAudioDevices） | init :899-909（直列） | drawer の**独立 effect**（並行・domain-b.md §8-8 裁定どおり app.mjs の init effect 不変・サーバ側に順序依存なし） | —（フローは人間ゲート・§8-5） |

## 4. 全エンドポイント結線の対応表（16 のうち Domain C 結線分 = 13）

| # | エンドポイント | 旧ハンドラ（cockpit.html） | 新実装 | 担当 |
|---|---|---|---|---|
| 1 | GET / | （ブラウザの初期ロード） | serveIndex 不変・エントリ差し替えは Domain D | A/D |
| 2 | GET /api/state | init :901-904 | app.mjs init effect（履歴復元 + applyState + **stateLoaded/自動展開判定 §5 を追加**） | B（+C） |
| 3 | GET /api/events | subscribe :814-897 | app.mjs SSE（13 イベント・不変） | B |
| 4 | GET /api/devices | loadDevices :704-726 | drawer `loadDevices`（`micDeviceListView` + lastDevice 初期選択） | **C** |
| 5 | POST /api/ears/start | :730-750 | drawer `onStart`（失敗 = 文言 + `applySnapshot(res.j.state)`・成功 = snapshot・micBusy） | **C** |
| 6 | POST /api/ears/stop | :804-811 | drawer `onStop`（snapshot 適用・catch のみエラー = 原実装踏襲） | **C** |
| 7 | POST /api/fire | :555-570 | control-bar `fireWith`（応答 {fired,state,reason} → setSoul/setFireNote・**snapshot でないため applySnapshot 不使用**） | **C** |
| 8 | POST /api/vision-fire | :573-589 | 同上（kind="vision"） | **C** |
| 9 | GET /api/windows | loadWindows :592-613 | drawer `loadWindows`（`windowListView`）+ Refresh windows ボタン | **C** |
| 10 | POST /api/vision-target | :615-631 | drawer `onVisionSet`（200 = snapshot 全体 → applySnapshot。原実装の部分適用 applyVisionTarget(res.j.visionTarget) と**同源**・サーバは snapshot() を返す = cockpit-server.mjs:818） | **C** |
| 11 | GET /api/audio-devices | loadAudioDevices :656-677 | drawer `loadAudioDevices`（`audioDeviceListView`）+ Refresh devices ボタン | **C** |
| 12 | POST /api/audio-device | :679-695 | drawer `onAudioSet`（200 = snapshot → applySnapshot・:858 同源） | **C** |
| 13 | POST /api/self-fire | :635-652 | control-bar `onToggleSelfFire`（200 = snapshot → applySnapshot・:879 同源・503/!ok は control-error） | **C** |
| 14 | POST /api/channel | :753-770 | drawer `onChannelSet`（200 = snapshot → applySnapshot + **入力欄クリア** :766） | **C** |
| 15 | POST /api/chat/connect | :776-796 | drawer `onChatConnect`（503/400/!ok 文言・成功 = edited 解除 + snapshot :791-792・connectBusy :780/:795） | **C** |
| 16 | POST /api/chat/disconnect | :797-803 | drawer `onChatDisconnect`（snapshot 適用・disabled は chatStatusView 経由） | **C** |

**snapshot 応答の単一経路化**（タスク C-4 指示）: #10 #12 #13 #14 #15 #16 と #5 #6 は
`applySnapshot`（= `applyStateRef.current`）へ合流。原実装は #10 #12 #13 で部分適用
（applyVisionTarget/applyAudioDevice/applySelfFire）だったが、**サーバ応答は snapshot() 全体**
（cockpit-server.mjs :818 :858 :879）であり、かつ各 POST は `broadcastState()` も同時に発火する（SSE state で
どのみち全適用される）ため、全適用への統一は挙動同値（差は「SSE より一瞬早く他フィールドも最新化される」のみ）。

## 5. 導線（初回自動展開）の判定式と視覚仕様 §7 の実装

### 5-1. 判定式（view-logic/settings.mjs `shouldAutoOpenSettings`・fixture 2 本で固定)

```
入力: GET /api/state の成功応答 snapshot s
s が falsy                        → false（誤展開防止・観測直行が既定）
s.channel.configured が truthy    → false（器 Channel 記憶済み）
s.visionTarget.title が truthy    → false（視界記憶済み）
s.audioDevice.name が truthy      → false（声の出力先記憶済み）
s.chat.source が truthy           → false（YouTube source 記憶済み）
s.device が truthy                → false（耳が現デバイスで稼働中 = タブ開き直し）
それ以外                          → true（初回 = 設定空 → 自動展開）
```

- **stateLoaded ガード（design レビュー申し送り 1・必須の実装形)**: app.mjs は init effect の
  **成功 then でのみ** `initialSnapshotRef.current = s; setStateLoaded(true)` を実行し、独立 effect が
  「`stateLoaded` が立った時に一度だけ（`autoOpenedRef`）」判定する。fetch 完了前は判定不能
  （stateLoaded=false）・fetch 失敗時（catch）は stateLoaded が立たない = **開かない**（裁定: 失敗時に
  開くべきかは未定義だった → 観測直行を既定に。根拠: 誤展開防止が申し送りの本旨・設定が本当に空なら
  次回起動で開く）。
- **判定材料の裁定**: 6 設定キーのうち snapshot に「未設定」と区別可能な形で載る 4 つ + 稼働状態
  （device）。**lastDevice（マイク記憶）は snapshot に載らない**（GET /api/devices 応答のみ）ため判定外
  （帰結は §8-4）。**selfFireEnabled は snapshot の selfFire が {enabled}|null（scheduler 有無）で
  「未記憶」と「明示 false」を区別できない**ため判定外（settings store 上は区別が存在するがワイヤに
  載らない）。

### 5-2. 視覚仕様 §7 の実装（styles.mjs 追記・**新トークンゼロ**）

design レビュー申し送り 11 のとおり**既存トークンの再利用のみ**で §7 意匠を実装した（`:root` への追加なし）:

| 意匠（§7） | 実装 | 使用トークン（出自） |
|---|---|---|
| 運転バー常駐（左 Fire 群・右 pill/口数/KILL） | `.control-bar`（flex・左右分割 `margin-left:auto`） | --panel/--border/--radius（B 既存） |
| Fire = 黄 / Fire+視覚 = 淡青 | `.control-bar .btn-fire`/`.btn-vision-fire` | --marker-fire/--marker-vision（**現 cockpit.html:86/:96 の意味論を B 既存トークンで継承**） |
| 自発トグル pill | `.self-fire-pill`（radius 999px）・on=緑 | --panel-raised/--up（現 :100-101 継承）・accent-color: --teal |
| KILL 赤枠（S8 まで場所のみ） | `.control-bar .kill-switch`（border-color: var(--down)・disabled で減光） | --down（B 既存） |
| 引き出し普段は畳む/⚙ で開く | `.settings-drawer { display:none }` + `.open`（角丸 14px パネル・max-height 46vh） | --panel/--radius |
| 区画見出し（接続/入出力） | `.drawer-section h3`（teal 小見出し）・区画間 border | --teal/--border |
| ラベル幅揃え | `.drawer-row label { flex: 0 0 9em }` + `.drawer-note` の同幅インデント | — |
| select は chevron 付き | `.drawer-select, .verbosity-select { appearance:none; background-image: url("data:image/svg+xml,…") }` | chevron 色は **--muted の値 #8b93a1 の複写**（CSS の url() 内で var() が使えないため・データ URI = 自己完結・外部アセットなし） |
| 状態は色ドット + 文言 | `.drawer-status::before`（currentColor の 8px 丸）+ 現 CSS の色クラス（channel-status.connected 等 :56-67 継承） | --up/--down/--speaking |
| ボタン共通・エラー欄 | `.control-bar button, .settings-drawer button`（現 :75-80 継承）・`.err`（現 :83 継承） | --panel-raised/--teal/--down |

旧スロット CSS 2 行（`.control-bar-slot`/`.settings-drawer-slot`）は実体化に伴い削除（死コードゼロ・
Domain B の他セレクタ・トークンは無改変）。CSS 検査テスト（cockpit-ui.test）に意匠 8 点の存在検査を追加。

## 6. 器不変・依存ゼロ・3チェック無退行（このセッション実行・生出力）

```
git diff --stat -- apps/runtime-player                              → 出力なし（器コード不変）
git diff --stat -- pnpm-lock.yaml apps/soul/agent/package.json      → 出力なし（lockfile・依存不変＝新規 npm 依存ゼロ・devDep ゼロ維持）
git diff --stat -- apps/soul/agent/src/cockpit/cockpit-server.mjs   → 80 insertions(+)（**Domain A 時点から不変**・本 Domain は 1 バイトも触っていない）
git diff --stat -- …cockpit.html …cockpit-page.test.mjs …scripts/cockpit.mjs → 出力なし（不可侵 3 ファイル無改変）
git diff --stat -- packages                                         → 出力なし
git status --porcelain -- apps/soul/agent
   M apps/soul/agent/.gitignore                        ← Domain A の変更のまま（本 Domain 不触）
   M apps/soul/agent/src/cockpit/cockpit-server.mjs    ← Domain A の変更のまま（本 Domain 不触）
  ?? apps/soul/agent/src/cockpit/cockpit-static-assets.test.mjs  ← A/B 新規に列挙拡張（本数不変）
  ?? apps/soul/agent/src/cockpit/cockpit-ui.test.mjs   ← B 新規に +7 本
  ?? apps/soul/agent/src/cockpit/ui/                   ← B 5 + 本 Domain 2（control-bar/settings-drawer）
  ?? apps/soul/agent/src/cockpit/vendor/               ← Domain A のまま（凍結・無改変）
  ?? apps/soul/agent/src/cockpit/view-logic/           ← A 12 + B 2 + 本 Domain 4（control/settings + 各 test）
```

- **注記（別セッション変更の現況）**: 委任時の注意にあった `packages/authoring-core` の別セッション
  （facex 系）未コミット変更は、本セッション実行時点で `git diff --stat -- packages` に**出力なし**
  （別セッション側でコミット済みとみられる）。`.tmp/facex-*` は untracked のまま存在するが**一切触って
  いない・読んでいない**（`screens/cockpit-ia-redesign.md` も同様に不干渉）。器不変の判定はクリーン。
- **構造チェック 3 種**（`node scripts/check-*.mjs`・repo ルート・実装後に再実行）:
  - `check-dependencies.mjs`: **passed**。
  - `check-soul-zone-boundary.mjs`: **passed**（**1377 files** scanned＝実装前ベースライン 1371 + 本 Domain
    新設 6〔view-logic 4 + ui 2〕・器↔魂 越境 import なし）。
  - `check-source-organization.mjs`: 違反は**器側既存赤 1 件のみ**（`apps/runtime-player/src/main/physiology/index.ts`・
    ブランチ既存ベースライン）。soul/agent スコープは違反ゼロ（新設は全て `.mjs`）。無退行。

## 7. 機械ゲート生数字（実行済み・タイムアウト付き）

`cd apps/soul/agent && node --test`（全テスト・タイムアウト 300s）:

```
# tests 702
# pass  702
# fail  0
```

- **実行前ベースライン 675（このセッションで再実行し一致確認）→ 実行後 702（+27）**。内訳:
  `view-logic/control.test.mjs` **8 本** + `view-logic/settings.test.mjs` **11 本** +
  `view-logic/status.test.mjs` **+1 本**（7→8）+ `cockpit-ui.test.mjs` **+7 本**（23→30）= **+27**。
  既存 675 本は全通過（無退行）。
- **背骨 `cockpit-server.test.mjs` は 74/74 全緑のまま**（個別実行 `# tests 74 / # pass 74 / # fail 0`）＝
  ワイヤ契約 16+13+6 の無退行の一次証明。
- **`cockpit-page.test.mjs` は無改変で 30/30 緑**（個別実行）＝ cockpit.html を 1 バイトも触っていない証明。
- 新規/変更テスト個別実行: `view-logic/control.test.mjs` **8/8**・`view-logic/settings.test.mjs` **11/11**・
  `view-logic/status.test.mjs` **8/8**・`cockpit-ui.test.mjs` **30/30**・`cockpit-static-assets.test.mjs` **10/10**。
- **SDK 実消費ゼロ・実ネットワーク不出**（本 Domain は外部アクセス 0 回・実マイク/実 YouTube/実ブラウザ不使用）。

## 8. §質問（Domain D・人間ゲートへの申し送り・迷った裁定点）

1. **口数モードは「選択可能・効果ゼロ」で実装した（解釈の裁定・確認求む）**: タスクの「値は固定・no-op」
   について、(a) select を disabled にする（KILL と同じ見た目になり S8 予約との区別が消える）、
   (b) controlled で常に「ふつう」へ戻す（触れるのに戻る = 不可解な UX）、(c) **選択はローカル state に
   保持するがどこにも送らない**（リロードで「ふつう」へ戻る・挙動への影響ゼロ）の三択から (c) を採った。
   モック §7 のプルダウン意匠を保ちつつ no-op が保証される。**人間ゲート手順書（Domain D）に「口数は
   触っても挙動が変わらない（実配線は s6-followup §12）」を明記されたい**。裁定が (a)/(b) 寄りなら
   select の属性 1 つ/onChange 1 行の修正で済む。
2. **conversation-error 欄（旧 :212）は IA 再配置で分割した**: 旧実装は自発トグルと声の出力先が同一
   セクションでエラー欄を共用していた。三層 IA では自発トグルが運転バー・声の出力先が引き出しに分かれる
   ため、**自発系（self-fire control not available / set failed / self-fire error）→ 運転バーの
   `.control-error`・音声系（一覧/set/catch）→ 引き出しの声の出力先行下**に分けた（design レビュー
   申し送り 10 の「置き場の明記」）。旧 UI で起き得た「自発エラーが音声エラーを上書きする」相互汚染が
   構造的に消える（挙動同値以上と判断）。
3. **自発トグル失敗時の checked 挙動が原実装と微差**: 原実装は 503/エラー時にチェックボックスが
   ユーザー操作のまま残る（表示とサーバ状態が不整合のまま）。新実装は controlled のため、エラー文言
   set による再 render で checked が**サーバ状態（snapshot 由来）へ戻る**。「UI 表示 = サーバ状態」の
   一貫性としては改善方向の差分だが、厳密同値ではないので記す（人間ゲートの確認点: 未結線起動で
   トグルが disabled/not available であること・結線済みで ON/OFF が snapshot に追従すること）。
4. **自動展開判定に lastDevice（マイク記憶）を使えない**: snapshot に載らない（GET /api/devices 応答
   のみ・§5-1）。帰結: 「マイクだけ設定して他が全部空」のユーザーは開き直しでも自動展開される。
   マイクだけ設定して耳も起動していない状態は実運用上ほぼ無い（起動すれば s.device で観測直行）ため
   受容した。気になるなら snapshot への lastDevice 追加が要る＝ワイヤ契約変更なので本 wave では不可。
5. **ControlBar/SettingsDrawer 本体（hooks）は Node 未実行（正直な限界・domain-b.md §8-1 と同型)**:
   検証済みは view-logic fixture 全数 + hooks 非使用葉部品の vnode 走査 + import スモーク（トップレベル
   副作用ゼロ）+ 構造テスト（import 閉域の自動走査）。**本体の htm テンプレート評価・fetch フロー・
   controlled 挙動の実描画は機械では見ていない**（devDep ゼロ規律・linkedom は台帳の梯子のまま）。
   人間ゲート手順書（Domain D）に最低限: Fire 押下 → busy → 復帰 / 503 文言（--channel なし起動）/
   自発トグル ON/OFF / Channel Set 後の**入力欄クリア** / chat source 復元と入力中非復元 /
   Disconnect の dead 無効 / マイク lastDevice 初期選択 / 一覧 Refresh / **初回自動展開と二回目直行**
   （§5-1 の判定材料で再現手順を組める）を含めること。
6. **header.mjs のデッドフォールバック（design レビュー non-blocking 1）は削除しなかった**: 「Domain C/D の
   ついでに削除可」とされたが、タスクの「Domain B の header.mjs は原則不変（結線に必要な最小変更のみ）」を
   優先した（本 Domain の結線は header.mjs に触れる必要ゼロ）。Domain D の統合時に旧 CSS 撤去と併せて
   処理するのが自然。
7. **SettingsDrawer は「常時 mount・CSS で畳む」を採った（設計裁定）**: open 時のみレンダする形だと
   開閉のたびに初期ロード effect が再走し、入力欄のローカル状態も消える。常時 mount + `.open` クラスなら
   初期ロードは 1 回（原実装 init と同値）・Channel 入力途中で閉じても値が残る。畳んでいる間も snapshot
   由来の表示（chatStatusView 等）は最新に保たれる。
8. **snapshot 全適用への統一（§4 注記）の確認**: 原実装が部分適用だった 3 エンドポイント
   （vision-target/audio-device/self-fire）を applySnapshot（全適用）へ統一した。応答はサーバの
   snapshot() 全体であり、POST 時に broadcastState() も発火するため実質同値（根拠は cockpit-server.mjs
   :818 :858 :879 の実装）。レビューで異論があれば部分適用へ戻すのは容易（ただし単一経路は崩れる）。
9. **Domain D への引き継ぎ最終形**: mount 契約は Domain B から不変（§2）。cockpit.html の書き換えは
   `<div id="app">` + inline module 2 行のまま。旧 `<style>`（:7-146）と旧 IIFE（:235-911）の完全撤去・
   `<title>` 裁量・人間ゲート手順書（§8-1 §8-3 §8-5 の確認点を含む）を Domain D で。
