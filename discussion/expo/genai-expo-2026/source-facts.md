# ポスター用の出典事実(調査結果)

> Status: Recorded(2026-07-25)。Sylph 二体(Editor/Player 側・model-authoring 側)の読み取り専任調査を L0 が統合。
> 種別: **リポジトリ事実**(file:line 付き)と**書けない線**(誇張防止)。設計判断・未決は [poster-design.md](poster-design.md)。
> 目的: ポスターに書く一行の裏を取れる状態を保つこと。将来ポスターを書く者は**ここで裏が取れない主張を書かない**。

## 1. 【重要な訂正】AI は Editor を触っていない

議論の初期に L0 が「AI が Editor を操作している」と誤解していた。事実は逆:

- **Editor は人間用 GUI**。`discussion/editor-electron-migration/00-agreement.md:19`「GUI の位置づけ | 人間が LLM の作業結果を閲覧・微調整するインターフェース」、同 `:18`「LLM の editor GUI 駆動 | **構想なし(確実)**」。
- **AI の経路は `apps/authoring-host`**(GUI を持たないワンショット CLI)。JSON コマンドを stdin か `--command-file` で渡し、JSON レスポンスが stdout に返って終了。**終了コード 0=成功 / 2=却下 / 1=エラー**(`apps/authoring-host/src/cli.ts:25-59`)。
- 当初は「Web 製なら Playwright で AI が叩ける」という読みで Web を選んだが、実経路はヘッドレス CLI に結実し **Editor の Web 性は AI に対して用をなさなかった**——と文書自身が記録(同 `:9-10`)。

## 2. なぜ自作したのか(原文が実在する)

`discussion/editor-electron-migration/00-agreement.md:8`(要旨): 本プロジェクトの目的は LLM に 2D リギングそのものを実施させること。Cubism はバイナリ保存で LLM フレンドリーな API が無いため、LLM が扱える土台を一から構築した。それが apps/editor。

- 注意: この一行は **2026-07-08 の Electron 移行合意という後発文書**に背景説明として書かれたもの。初期文書(`discussion/concept/modified_concept.md`・`acceptance-criteria/00_RootQuestion.md`)が語る「Cubism を使わない理由」は**権利・誤認リスクとスコープ分離**であり、AI 操作性ではない。
- 保存形式は素の JSON ディレクトリ。`discussion/editor-electron-migration/01-decomposition.md:59`「ディレクトリワークスペースは既に LLM-Readable な JSON 群」。同 `00-agreement.md:21`「保存形式 | **温存**。応急処置から『LLM-Readable であること』に価値が昇格済み」。

## 3. 「生成AIが操作できる」の実態

### 3-1. オーサリング側(モデルを作る経路)

- **AI コマンド 13 個**(`packages/ai-interface/src/ai-command-name.ts:3-17`): `getEditorState` / `inspectModel` / `inspectTarget` / `inspectEvaluatedGeometry` / `validatePackage` / `dryRunOperation` / `commitOperation` / `getOperationLog` / `renderView` / PSD import 系 4 個。
- **決定論的 operation 52 種**(`packages/operation-core/src/operation-type.ts:3-56`)。ID は入力から決定論的に導出(`operation-ids.ts:41-54`)= AI が ID を推測せずに済む。
- **dry-run → 承認 → commit の 2 段が強制**。ヘッドレスでは「blocking 診断が無ければ機械承認」のダイヤル(`packages/ai-interface/src/ai-auto-approval-policy.ts:12-25`)。
- **1 committed operation = 1 git commit**(`discussion/model-authoring/craft/_map.md:41`)。**reject は無傷**(何も変わらない)。
- **自動コミットは型で禁止**: `packages/contracts/src/codex-proposal-operation-catalog.ts:57-61` の `requiresUserApproval: z.literal(true)` / `allowAutomaticCommit: z.literal(false)`。禁止境界 12 種が列挙型として実在。
- 憲法にあたる設計文書: `discussion/design/codex-friendly-automation-policy.md`(Accepted 2026-06-06)。要旨=**リポジトリは決定論の器に徹し、提案生成・意味推論・スマート自動リギングを Editor に埋め込まない。解釈・計画・提案・修復推論は外部の LLM が持つ**。

### 3-2. ランタイム側(モデルを着る経路)

- loopback WebSocket + token(`apps/runtime-player/src/main/control-channel/channel-server.ts:27-45`)。契約の正本は JSON Schema。
- 受理する intent 3 種(`intent.set` / `intent.envelope` / `intent.speech`)、操作できる**意味スロット 16 個**(`apps/runtime-player/src/preload/model-mapping-bridge-contract.ts:1-17`)。生の parameterId ではなく意味語彙で受ける。
- 範囲外の値はクランプせず**拒否**(拒否コード 6 種)。
- **LLM 本体は特区 `apps/soul/` にしか住めない**(`discussion/ai-cohost/concept/mvp-boundary-amendment.md:48-55`)。境界は `scripts/check-soul-zone-boundary.mjs` で機械検証。

## 4. AI の「目」——この作業場の中心思想

### 4-1. 出発点の診断

`discussion/model-authoring/premises/authoring-solvability-analysis.md:14-15`(要旨): 最小構成の AI は**盲目の彫刻家**になる。数千自由度の連続空間に対しフィードバックは 1 ラウンド数ビットの人間知覚評価のみ。これは**ユーザーが勾配になる**構図であり、そのとき実質の作者はユーザーで、AI はノイズの乗ったアクチュエータに過ぎない。

欠けているのは ①内側の知覚ループ ②内在化された価値基準と手筋(同 `:19-20`)。**①を実装し、②を craft/ として言語化した**——これがプロジェクトの本体。

### 4-2. 実装された「目」と「巻尺」

- `renderView` — **依存ゼロの純 TypeScript ソフトウェアラスタライザ**(`packages/render-software`)でオフスクリーン PNG。ネイティブ GL は意図的に不採用(ヘッドレス・決定論のため)。
- フレーミング 3 モード: `modelBounds`(全身)/ `stageViewport`(明示矩形)/ **`drawableFocus`**(特定パーツに寄る=AI が目元にズームできる)。
- **`sweep: {parameterId, steps(2〜64)}`** でパラメータを振ったコマ列を**1枚のグリッド画像(コンタクトシート)に自動合成**(`apps/authoring-host/src/perception/contact-sheet.ts`)。レイアウトは決定論的。
- **サイドカー JSON** で画像座標 ⇄ ステージ座標の変換表を併置(`render-view-sidecar.ts`)。
- `inspectEvaluatedGeometry` — 評価済み bbox・頂点・格子制御点を**数値で**返す「巻尺」。設計意図がコメントに明記(`packages/ai-interface/src/ai-measurement-command.ts:26-30`): 視覚判定に必要な数値を画像目測で代替させない。
- 不変量(`discussion/model-authoring/craft/_map.md:42`): **「数値は巻尺から取る。画像の目測を数値に使わない」**。
- 設計語彙(`discussion/model-authoring/_map.md:41-42`): **三位一体(目・測量・変換器)+ 手(authoring-host)+ 健診(validatePackage)**。

### 4-3. 判定の梯子 5 段

`discussion/model-authoring/premises/operating-policies.md:15-25`。安い層で落とせる失敗は安い層で落とす:

1. スキーマ整合(ツール) 2. 構造 lint / Validate(ツール) 3. **静止画レンダの自己判定(AI)** 4. **コマ列による幾何判定(AI)** 5. **動きの質感 gate(ユーザー)**

- AI の自己申告(同 `:27-31`): 静止画は読めるが**動画は読めない**。アニメ GIF は実質先頭フレームのみ。よって動き知覚の上限はコマ列グリッド。**時間の質感は原理的に判定不能**であり、段5の人間 gate は妥協でなく**構造的必然**。
- gate の定型文(`craft/_conductor.md:93`): 「**違和感があれば言語化してくれ。物理に翻訳する**」。一級規則7(同 `:23`): **ユーザーの知覚は実測に先行する精密センサー**(翻訳実例: 「伸びて見える」=等長違反)。

## 5. 実績と数字(出典付き・**テストは未実行、記録からの引用**)

### 5-1. モデル制作

- **閉問題 01〜19 を全通過**(2026-07-03〜07-06、`discussion/model-authoring/closed-problems/_map.md`)。追従5軸(Face X/Y/Z・Body X/Z)+眼球X/Y+目の開閉+髪揺れ4系統+口パク(母音)+別衣装+差分管理。
- **委任 32 代で operation reject 累計ゼロ**(`research/delegation-calibration-log.md:195`)。
- git revision rev 5 → **610**(`closed-problems/19-variant-ware/results.md:7-9`)。
- 委任1回の実測: 120〜180k tokens / 15〜30分 / 40〜100 tool uses。最大は 319k tokens・43分・15×15格子・**一発通過**。
- **Fable 枠の実消費**: 「その日の全 rigging でレート制限の 7%」(ユーザー実測、`:56`)。
- ユーザー判定の実文言: 「100点満点で評価するなら文句なしの100点」/「これに文句を言うやつはこの世にいないだろう」/「笑っちゃうくらい完璧だな」。
- **盲目再構成実験**(`closed-problems/03-face-angle-x/`): 答え(完成モデル)への全経路を遮断し、**craft だけ**を持たせた新規コンテキストの AI に顔の横回転を組ませた → **満点通過**、内部比率は完成参照と**誤差2割以内**。

### 5-2. 双子の体(ユーザー確認済み・2026-07-25)

- `C:\workspace\remie\rigging\claude-chan` = **Claude Code が自分でモデリングした Claude Code 用の体**(=こーでぃーの身体)。
- `C:\workspace\remie\rigging\chatgpt-chan` = **Codex がモデリングした Codex 用の体**。
- **両方ゲート通過**。3周目(claude-chan)は実機 export → Runtime Player 動作確認済み(commit `899cb2e`)。
- これは同時に **craft(手順書)が別の AI でも通用した証明**になる。

### 5-3. craft(制作定石)

- `discussion/model-authoring/craft/` に**レシピ 12 枚**(00〜10 + 06-0)+ 周回指揮書 + **共有不変量 20 種超**、総量約 **160KB**(最大 `06-face-angle-x.md` = 53KB)。**6 工程**構成。
- 中身は本物の技術発見。例: 回転射影則 **dx(点) = u·(cosΔ−1) + z(点)·sinΔ**(見えない z だけが唯一の設計対象)/「最大情報素材を正とする」(変形は情報を潰せるが発明できない)/「場は素材ではなく空間に属する」(人間補正場も衣装を跨いで再利用)/「reject を失敗と数えるな、craft の発見源や」。

### 5-4. 規模

- ワークスペース 14(packages 10 + apps 4)。ソース **846 ファイル / 約 234,000 行**(テスト除く)。テストファイル 514。
- テスト数(**別日・別実行**): packages **1492/1492**(2026-07-12 記録)/ apps/runtime-player **925/925**(同)/ apps/soul **957/957**(2026-07-19、commit `a5e2d07`)。
- wave 計画: Editor **105 本** / Player **23 本**。閉問題: model-authoring 19 + ai-cohost C系列 7 + S系列 10 = **36**。
- 討議ドキュメント **2,705 本**(`discussion/**/*.md`)。
- 開発期間: 初コミット **2026-05-25** → **2026-07-19** で **56 日 / 332 コミット**。

### 5-5. AITuber(apps/soul)側の到達点

S1〜S9 の閉問題系列で、耳(常時 ASR + 転写バッファ正本)・目(発火時スナップショット)・声(TTS+口形)・表情・barge-in・自発発火(呼びかけ/区切り/沈黙/合いの手)・視聴者コメント合流・操縦席(ローカル Web UI)・安全弁(キルスイッチ/NG検査)・多頭化(配信前に頭を選ぶ 4 種)・配信間記憶を実装。**実配信 1 時間 40 分を破綻なく完走**(2026-07-19 ユーザー実射)。詳細は `discussion/ai-cohost/implementation/_map.md`。

## 6. 画像素材の在り処(リポジトリ内・**すべて実在**)

`discussion/model-authoring/` 配下に **767 枚の PNG(約 400MB)**。各 PNG に同名の `*.render-view.json`(カメラ・フレーミング情報)が併置されており、「どの視点で撮ったか」をキャプションにできる。

| 用途 | パス(代表) |
|---|---|
| 参照モデル全身/顔/目 | `experiments/ref-render-gate/ref-{rest-full,face-focus,eyes-viewport}.png` |
| **AI が見ているコマ列**(最有力) | `closed-problems/04-facex-expansion/experiment/renders/final-sweep7.png`(顔角度Xを7段振った 3×3 グリッド・3072×3039px)。同種が Face Y/Z・Body X/Z にも多数 |
| 髪揺れ 5 コマ | `closed-problems/16-hair-sway/experiment/renders/*-strip5.png`(12枚) |
| 口パク・マトリクス | `closed-problems/17-mouth-lipsync/experiment/renders/sweep-open{0,05,1}-{a,i,u,e,o}.png`(開口度3段×母音5=15枚) |
| Before/After | `closed-problems/13-facez-gravity/experiment/renders/before-*` ↔ `fix3-*` ほか |
| 衣装3種 | `closed-problems/19-variant-ware/experiment/renders/switch-*.png` |

- ⚠ **`discussion/mesh-generation/` 配下に画像は 1 枚も無い**。**メッシュのワイヤーフレーム図はリポジトリ内に存在しない**——「メッシュを張る」を絵で見せたいなら Editor から新規に撮る必要がある。

## 7. 【書けない線】誇張防止リスト

ポスターに**書いてはいけない**、あるいは書き方に注意が要るもの:

1. **「AI がメッシュを張っている」は誇張**。メッシュ生成は決定論アルゴリズム(輪郭追跡→簡略化→制約付きドロネー→緩和)で、LLM は判断していない(該当ファイル群を `llm|prompt|openai|anthropic` で grep して一致ゼロ)。AI がやっているのは**どのパーツにどのプリセットで呼ぶかの選択**。正確に言うなら「AI が craft レシピに沿ってメッシュ生成を呼び、reject ゼロで通した」。
2. **メッシュ自動生成(auto-outline)は現在 v6/v7 併存で保留中**(`discussion/mesh-generation/evaluation-log.md`「一長一短」)。「自動メッシュ生成ができる」と言い切るのは危うい。
3. **原画は AI が描いたが、人間が描いたわけでもない**——素材は **GPT-Image 2.0 生成**(ユーザー確認済み 2026-07-25)。人間がやったのは PSD にまとめること。文書側の記述(`premises/operating-policies.md:35-36`「原画制作はスコープ外」)は**リグ担当 AI から見たスコープ外**の意味であり、「人間が描いた」を意味しない。
4. **既存の自動リギングツールとの定量比較は存在しない**。「既存より優れている」は書けない。書けるのは構成の差(GUI 前提の既存ツールに対し、ヘッドレス API 越しに AI が操作している)のみ。**ユーザーも優越の主張をする意思はない**。
5. **時間の質感は AI には原理的に判定不能**と自ら記録している。最終審は人間。
6. **人間仕上げが残っている領域がある**(帽子際・襟の非対称など。cp10 の一部キーは「機械再生成禁忌」とマーク)。
7. **AI が診断を外した実例も記録されている**(3周目、大型パーツが 339 頂点しかなく fix 3ラウンド分を誤診断 → ユーザーの根本診断で解決)。
8. **モデル実名の対応表がリポジトリに無い**。`fable`/`opus`/`sonnet`/`haiku` は委任時の抽象名。**`Sol`/`Terra`/`Luna` は AITuber の頭脳(`apps/soul`)の話であり、モデル制作の担当ではない**——混同すると誤りになる。申込概要の「2Dモデリングは Sol および Fable」の出所は要確認(poster-design.md §8-6)。
9. **`discussion/model-authoring/_map.md` は古い**(「次の行動=閉問題02の定義」で停止)。正は `closed-problems/_map.md` と `craft/_map.md` と git log。
10. **Editor 実装は Wave102 で「一旦完成」**(`discussion/_map.md:62`、ユーザー決定 2026-07-02)。現在の主戦場は model-authoring と ai-cohost。「現在進行形で開発中の Editor」とは書かない。
