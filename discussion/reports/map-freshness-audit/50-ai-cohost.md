# AI Cohost map freshness audit

基準点: Git HEAD `3c3669eefcc375c62d1ec6b4d77a000d7cbbb61c` / 2026-08-08 (Asia/Tokyo)。
担当範囲は `discussion/ai-cohost/**/_map.md` 全体。既存 map、source、test、設定は変更していない。

## 1. 担当範囲と実確認 map 一覧

確認した map は次の9件である。Markdown 相対リンクは機械検査し、9/9 map、合計145リンクで missing なし。

- `discussion/ai-cohost/_map.md`
- `discussion/ai-cohost/architecture/_map.md`
- `discussion/ai-cohost/concept/_map.md`
- `discussion/ai-cohost/implementation/_map.md`
- `discussion/ai-cohost/implementation/orchestration/_map.md`
- `discussion/ai-cohost/implementation/screens/_map.md`
- `discussion/ai-cohost/premises/_map.md`
- `discussion/ai-cohost/research/_map.md`
- `discussion/ai-cohost/soul/_map.md`

リンク検証 command: PowerShell の `[regex]::Matches(..., '\\[[^\\]]+\\]\\(([^)]+)\\)')` と `Test-Path`。

## 2. 判定一覧

| Map | 種類 | 判定 | 要点 |
|---|---|---|---|
| `ai-cohost/_map.md` | `living-current-state` + `living-index` | **Stale** | C1〜C7の器の要約は生きているが、アクセス経路を未決と再掲し、S1着手を次 action に残し、S7実ゲート・S8・多頭化・合いの手・配信間記憶を現在入口として反映していない。 |
| `architecture/_map.md` | `living-index` + design current state | **Current** | D1/D4/D6/D7、C2〜C6設計の status とリンクは本文・現行sourceと一致。S系列の詳細を責務外として持たない構成も妥当。 |
| `concept/_map.md` | `living-index` | **Partially stale** | 目標像/behavior model は有効。ただし境界改定の説明が「リポジトリ内LLM/知覚は禁止」とだけ書き、`apps/soul` 特区で許可された改定二号を欠く。 |
| `implementation/_map.md` | `living-current-state` + `living-index` | **Partially stale** | 詳細な時系列の最後は S8 実装・多頭化・合いの手まで到達しているが、上部のC4/C5待ち status とS7保留記述が古く、新waveの直接索引が不足。 |
| `implementation/orchestration/_map.md` | `living-index` | **Stale** | S7 wave を「発進待ち」とし、S8/brain-swap/reading-interjection/stream-memory のwaveを索引していない。 |
| `implementation/screens/_map.md` | `living-index` | **Stale** | C4 context-check を次 action に残し、実在する `soul-cockpit.md` と `cockpit-redesign.md` をFiles表から落としている。 |
| `premises/_map.md` | `living-index` (accepted premises) | **Current** | `accepted-premises.md` への唯一の入口として正しい。Opus品質要件は主頭の要件であり、後発のCodex頭追加とは矛盾しない。 |
| `research/_map.md` | `historical-evidence-index` | **Current** | 2026-07-10/11の外部・repo調査スナップショットを日付付きで索引し、料金/ASR/TTSの再確認警告も保持している。 |
| `soul/_map.md` | `living-current-state` + `living-index` | **Stale** | 「前提討議の入口」「次はS1」のままで、S1〜S8の実装、S7実ゲート、4頭、合いの手、配信間記憶を反映せず、`brain-swap.md`/`stream-memory.md`も索引していない。 |

**Verdict counts:** Current 3 / Partially stale 2 / Stale 4 / Intentionally historical 0 / Unverifiable 0。

## 3. 現在の判断・境界（ユーザー決定とrepo事実を分離）

### 3.1 Accepted user decisions

- C系列の器 C1〜C7 は完全閉鎖。C7はwaveなしのOBS二体並走検証で、人間ゲートを含めて閉じた（`discussion/ai-cohost/_map.md:42-48`、`implementation/_map.md:32`）。
- MVP境界改定二号は `apps/soul` 特区を許可するもの。特区内でLLM/知覚を許可し、器→魂 import と魂→器コード import を禁止する憲章である（`discussion/ai-cohost/concept/mvp-boundary-amendment.md:3,38-52`）。特区の説明を「repo全体で禁止」と短縮するのは不正確。
- D4=YouTube、D6=キー操作から実機ゲートを経て名前呼び/自動化、D7=Variant切替は当面対象外（`architecture/_map.md:21-24`、`ai-cohost/_map.md:63-65`）。D4/D6/D7そのものの決定は stale ではない。
- AIの身体/リグの制作者は本トピックの設計事項ではなく、persona確定後に model-authoring 手順へ渡す（`ai-cohost/_map.md:66`、`implementation/s-series-decomposition.md:31,49`）。この境界も現行判断と一致する。
- 魂の知性の主経路は Max 20x + Agent SDK に裁定済み（`soul/_map.md:15,35`、`soul/llm-access-path.md:71-81`）。root map の「未決」は child map と直接矛盾する（`ai-cohost/_map.md:68`）。
- persona は大課題から降格し、自己名「コーディ」の一行だけ実装済み。声はS9相槌が必要になった時点で個別確定、身体はmodel-authoringへ残す（`implementation/s-series-decomposition.md:29-31,49`）。

### 3.2 Current repository facts

- `apps/soul/README.md:1-14` は特区憲章を記載し、`apps/soul/agent/` を独立npmパッケージとして説明する（`README.md:18-28,48-69`）。実際のmanifestは `apps/soul/agent/package.json:1-15` で、Claude Agent SDK、Codex SDK、ONNX Runtimeを持ち、root workspace lockfileとは分離されている。
- `apps/soul` の現行器官は ears/voice/mind/channel/cockpit/cli/test-support に加え、eyes/chat を持つ（README `:56-59,81-99,206-220,299-333`）。YouTubeはinnertube依存ゼロの実装で、watch/`/live/<id>`/`/channel/<id>/live`/`/@handle/live`を受ける（`apps/soul/agent/src/chat/innertube.mjs:14-16,46-117`）。
- D6の段階的自動化は実装済み。手動Fire/AHKを残したうえで名前呼び・turn-end・silence・comment/comment-call・interjectionを純ロジックの発火要求として持つ（`apps/soul/agent/src/mind/fire-scheduler.mjs:31-37,298-319`）。D7のVariant制御はコードに追加されておらず、設計文書でも当面対象外のまま（`discussion/ai-cohost/architecture/runtime-player-control-channel.md:57`）。
- 現行 `BRAINS` registry は Claude + Codex Terra + GPT-5.5 + GPT-5.6 Sol の4頭（`apps/soul/agent/src/mind/brains.mjs:41-84`）。したがってREADMEの「フラット2択」記述（`apps/soul/README.md:400-402`）は追加2頭を反映しておらず、repo内の別の明確な stale 記述である。
- READMEは操縦席三層IAを記録し（`apps/soul/README.md:335-365`）、S8安全弁（kill/NG/開示）と人間ゲート2点を記録する（`README.md:367-392`）。合いの手/朗読は`README.md:439-467`、配信間記憶は`README.md:469-501`に存在する。root/soul/orchestration mapにはこの後半が入口として現れない。

## 4. C/S系列、ゲート、Git履歴、tests/experiments

### 4.1 Git基準点での実装到達

`git log -- apps/soul` と各wave記録を照合した。主要な最新到達は次のとおり。

- S1 `3eaf605`、S2 `4d797ce`、S2.5 `214c0e5`/`95027d8`、S3 `19dc033`/`54ab800`、S4 `e4cb0f5`/`adbba5c`/`626d5d1`、S5 `eca6b0e`、S6 `882fc4f`/`7702b99`。
- S7の器は `1699855`、実配信URL修正は `dcf84cc`、自己名は `bbd78c7`。実配信30分ノーブレイク（コメント読み上げ・視聴者名認識）でS7実ゲートを実質合格した記録がある（`implementation/_map.md` の#23記録）。従って orchestration map の「発進待ち」は stale。
- 操縦席改定 `691eb10`、口数/コーディ語彙 `bd5d184`、S8安全弁 `f9c5f34`、多頭化 `1889372`/`99bc41d`、朗読と合いの手 `307a923`/`5f883b7`、配信間記憶 `a5e2d07` がHEADの祖先である。

### 4.2 Machine tests / experiments（人間ゲートとは別）

次のテストファイルを、テストランナーのworker spawnを避けるため `node --input-type=module -e "import('./…')"` で個別実行した。

| Test | 結果 |
|---|---:|
| `src/mind/brains.test.mjs` | 12/12 pass |
| `src/mind/memory.test.mjs` | 27 pass |
| `src/mind/fire-orchestrator.test.mjs` | 66 pass |
| `src/mind/fire-scheduler.test.mjs` | 58 pass |
| `src/cockpit/cockpit-server.test.mjs` | 118 pass |
| `src/chat/live-chat-client.test.mjs` | 20 pass |
| `src/chat/innertube.test.mjs` | 29 pass |

通常の `npm.cmd test` はテスト内容に入る前に全53ファイルが `spawn EPERM`（sandboxのworker起動制限）で落ちた。これはsource assertionの失敗ではなく、full-suiteの実行環境制限として扱う。S1〜S8各waveの機械ゲート数字（例: S8 827/827、memory 957/957）は各commit/wave記録に残るが、ここで再度全suiteを完走したものではない。

### 4.3 Human gates

- C1〜C7、S1〜S6、S7実配信、操縦席改定、口数/コーディ語彙、朗読と合いの手は、wave記録上ユーザーの実機/美的ゲート合格。朗読ゲートは1時間40分実配信で4点すべて問題なし（`implementation/orchestration/reading-interjection-wave-plan.md:47-50`）。
- S8 safety waveは機械実装済みだが、kill実射（発話中即切断→全発火拒否→復帰）と通常発話無退行の人間ゲートが未実施（`implementation/orchestration/s8-wave-plan.md:12,62-65`、`apps/soul/README.md:390-392`）。
- brain-swap wave plan と stream-memory wave plan はStatusが「発進後に記録」のまま（各 `:3,60` / `:3,53`）。実装・初回体感は存在するが、rollout掃除を含む最終3点ゲートと記憶4点ゲートの完了記録は確認できない。

## 5. Stale / 疑わしい map 記述と replacement truth

### 5.1 Parent mapとchild mapの矛盾

- `discussion/ai-cohost/_map.md:21` はS7を「実装完了/YouTube実ゲート後日」、次をS8としているが、child implementation #23は30分実配信ゲート合格、#24はS8実装・多頭化・合いの手・記憶まで記録する。replacement truthは「S7実ゲート済み、S8 kill human gateとmemory/brain final gateが残る」である。
- `discussion/ai-cohost/_map.md:52` は次をS1議論とするが、S1〜S7 waveは既に実装済み。`discussion/ai-cohost/_map.md:68` はアクセス経路を未決とするが、`discussion/ai-cohost/soul/_map.md:15,35` と `soul/llm-access-path.md:71-81` はMax 20x+Agent SDKの裁定済みを明記する。
- `discussion/ai-cohost/soul/_map.md:3,28` はS1前の前提討議として次をS1に戻す一方、同ディレクトリには`brain-swap.md`と`stream-memory.md`があり、実装側はS8後の運用・記憶へ移っている。soul mapは現在入口として stale。

### 5.2 C/S mapの個別 drift

- `discussion/ai-cohost/implementation/_map.md:10` はC4を「手動確認待ち」、`:19` はC5を「人間ゲート待ち」とするが、同mapの次 action #4/#5とGit commits `140fb63`/`6770760` はそれぞれゲート合格を記録する。履歴部分は証拠として残せるが、上部statusは更新対象。
- `discussion/ai-cohost/implementation/orchestration/_map.md:33` のS7「発進待ち」は `1699855`/`dcf84cc` と実配信記録に反する。`:36-38` も、コメント値/口数やcockpit改定の持ち越しを完了後も残しており、S8/brain/reading/memoryの子waveを欠く。
- `discussion/ai-cohost/implementation/screens/_map.md:3,13,17` はC4前の3画面だけを列挙し、`:9-11`に存在する3ファイル以外の `soul-cockpit.md` と `cockpit-redesign.md` を索引しない。現在のsourceはpreact+htm三層IA（`apps/soul/README.md:335-365`）である。
- `discussion/ai-cohost/concept/_map.md:9` の「リポジトリ内LLM統合・知覚は引き続き禁止」は、特区改定二号の「`apps/<魂>`配下のみ許可」（`mvp-boundary-amendment.md:46-52`）を落としている。正しくは「特区外では禁止」。

### 5.3 D4/D6/D7/body-authorの判定

これらのAccepted決定自体は architecture/root map と現行sourceで整合しており、誤った再裁定は不要。

- D4=YouTubeは現行innertube実装と実配信ゲートでrepo事実が追加された。mapは「後日」とする時系列だけ更新する。
- D6=キー操作を初手とする梯子は維持され、名前呼び/turn/commentの自動化が追加された。mapは初手決定を消さず、現在の実装段階を追記する。
- D7=Variant切替は当面対象外。S4の演出語彙はVariantではなく既存slotのenvelopeであり、Variantを「実装済み」と誤って昇格させてはいけない。
- 身体authorは本topic外。personaの声・人格・身体の順序とmodel-authoringへの受け渡しをcurrent unresolvedとして残す。

## 6. 親mapへ反映すべき短い結論

1. `ai-cohost/_map.md` は「器C1〜C7完成」だけでなく、S7実ゲート済み、S8 safety実装済み/kill human gate待ち、brain-swapとstream-memoryは実装済み/最終human gate記録待ち、合いの手は実配信合格、と更新する。
2. 「知性のアクセス経路未決」「次はS1」は削除し、Max 20x+Agent SDK裁定済み・次は残る人間ゲート/ユーザー判断、とする。D4/D6/D7/body-authorの決定文は維持する。
3. 子mapでは orchestration の新wave、screensの新UI、soulのbrain/memoryを先に索引し、その後親mapを更新する（監査契約の子→親順）。
4. 特区境界は「repo全体禁止」ではなく「特区外禁止」と明記し、`apps/soul/README.md` と `mvp-boundary-amendment.md` を正とする。

## 7. 未解決事項とユーザー判断点

- S8 kill human gate 2点（即時停止/復帰、通常発話無退行）をいつ実施して閉鎖するか。
- brain-swapのrollout掃除を含む最終人間ゲートを実施済みか、また常用Opus/Sol控えの運用を確定するか。速度動機はTerra実測で否定寄り、長回し対策はSDK圧縮候補Bが本命だが未着手（`soul/brain-swap.md:49-55,91-100`）。
- stream-memoryの4点実射（保存/秘匿、次回自動搭載、OFF、手動/定期更新）を実施して閉鎖するか。開示文言更新もユーザー作業（`soul/stream-memory.md:31-36`）。
- persona/S9相槌の声をいつ確定するか。身体/リグの制作責務はmodel-authoring側に残る。
- Max/Agent SDK制度変更と費用枠の常設監視は継続（`soul/llm-access-path.md:15-28,81`）。

## 8. 調査できなかった範囲 / 注意

- 人間ゲートは実施せず、既存のwave記録・Gitメッセージ・ユーザー観測記録をrepo事実として照合した。YouTube/SDKへの新規実ネット接続も行っていない。
- `npm.cmd test` full-suiteはsandboxの `spawn EPERM` で実行不能だったため、選定した主要テストをworkerなしimport方式で再実行した。全53ファイルの再完走を示す報告ではない。
- Anthropic/OpenAI/YouTubeの規約・料金の現在値を外部再検証していない。research mapのスナップショット（2026-07-10〜17）と、ユーザー裁定・実験記録を混同しない。
- 監査対象はai-cohostの9 mapのみ。既存の他topic map、基準点前から存在するworktree変更、他Sylphの出力には触れていない。
