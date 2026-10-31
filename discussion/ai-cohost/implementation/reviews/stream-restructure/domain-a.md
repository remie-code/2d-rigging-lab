# 配信の組み直し Domain A レビュー(ロールと引っ越し・設定の分)

Review-Sylph → Orch-Sylph(2026-10-31)。ループ 1。対象: 未コミットの作業ツリー(直前のコミット 719c6edb)。コードは変更していない。

## 判定

**合格**(止めた指摘は 0 件)。計画 §4 の 4 つの止める基準(設計とのずれ・今の配信が壊れる・約束のテスト不足・守りの決まり違反)のどれにも、根拠を出せる指摘は見つからなかった。以下の「持ち越し」は止めない。

## テスト

- `apps/soul/agent` で `node --test`: **1732 pass / 0 fail / 0 cancelled / 0 skipped**(作業前の基準 1713 → +19)。Gnome の報告と一致。
- リポジトリの根で `pnpm run check:soul-zone`: **pass**(1558 files scanned、器→魂 / 魂→器の違反なし)。
- 依存・lockfile: `git status` / `git diff --stat` に `package.json`・`pnpm-lock.yaml` の変更なし(変更 22 ファイルはすべて `apps/soul/agent/` 配下のコードとテスト、新規は `src/roles/` 4 ファイルと Gnome の報告フォルダ)。
- `git check-ignore -v`:
  - `apps/soul/agent/roles/chappy/role.json` → `apps/soul/agent/.gitignore:66:/roles/`(無視される)
  - `apps/soul/agent/roles.migrating-123/` → `.gitignore:67:/roles.migrating-*/`(無視される)
  - `apps/soul/agent/tmp/restructure-backups/restructure-…/cockpit-settings.local.json` → リポジトリ根 `.gitignore:19:tmp/`(無視される = 写しの置き場は git に入らない)
  - `apps/soul/agent/src/roles/role-store.mjs`・`role-migration.mjs` → 無視されない(exit 1)。先頭 `/` のアンカーが効いている。
- テストは本物の LLM・外部 API を呼ばない(引っ越し・ロールのテストは OS temp のみ。ElevenLabs の鍵は fake)。

## 止めた指摘

なし。

### 確かめた事項(根拠つき)

- **引っ越しの安全(守り)**: `role-migration.mjs` の `migrateSettingsToRoles` は、(1)`roles/` があれば `skipped`(写しも取らない)、(2)設定ファイルがあれば、ロールを書く**前**に `copyFileSync(..., COPYFILE_EXCL)` で写しを取り、失敗したらロールを作らず `failed` で返す、(3)ロールは `roles.migrating-<pid>/` に書き、全部書けてから `renameSync` で `roles/` に(途中で失敗しても半端な `roles/` を残さない)、(4)設定ファイルは `createFileSettingsStore` で読むだけで書かない。テスト `引っ越し: 移す前に設定ファイルの写しを取り、古いキーは消さず…`・`roles/ があれば 2 回目は何もしない`・`写しが取れなければロールを作らずに失敗で返す`・`壊れた設定ファイルは写してから…` が付いている。設計 §2.4 / scope §20 に合う。
- **指示とモデルの選び方(設計 §2.4)**: チャッピー = GPT-6.1 Sol の上書き → ほかの GPT 系 → 既定、モデルは `brainChoice` が GPT 系ならそれ・そうでなければ GPT-6.1 Sol。こーでぃー = Opus 5.5 → Opus 4.8 → 既定、モデルは Opus 5.5。声・口数・話し始め・hotwords は両方へ写し、体は両方 true。コード・テスト(`指示の優先順`・`モデルの決め方`)とも設計どおり。
- **結果の表示**: `main()` は `migrateSettingsToRoles` を呼んで `formatRoleMigrationReport` の行をターミナルへ 1 回出し(失敗は stderr の WARN)、同じ行を `notices` として server に渡してログのタブに出す。指示の本文・設定の中身は出さない(どの頭の上書きを使ったか・モデル・写しの置き場だけ)。
- **名前の切り離し**: `brains.mjs` から `identity` と `resolveBrainIdentity` を外した。`buildFireSystemPrompt` は `normalizeModelIdentity` でロールの名前をそのまま使う(cody / chappy は旧と同一の文字列。テストで確認)。`cockpit-server.mjs` は `currentRoleIdentity` から whisper の手がかり・呼びかけの照合・snapshot・判定の名前を引く。`ui/header.mjs` の `IDENTITY_PAIRS` は形の確かめに替えた。cody / chappy の 2 値固定で残るのは、ひな形の表・既定(`DEFAULT_MODEL_IDENTITY`)・`fire-scheduler.mjs` の静的な呼びかけの揺れ(provider が無いときの予備)・`createRoleHooks` の「系統で選ぶ」だけで、設計の許す範囲。
- **声**: `resolveRoleVoice`(`--speaker` がロールの話者を上書き)・`createVoiceEngineManager` の `voiceKey`(種類が同じでも話者・声 id が替われば engine を作り直す。`prepare` と `ensure` の両方)・ElevenLabs の `voiceId` は engine の deps の既存の名前(`voice-engine.mjs:49`)に合っている。テストあり。鍵は読まず・出さず・環境変数にも入れていない(差分に `process.env` の追加なし)。
- **手を付けてはいけない所**: `src/memory/`(種のファイル `conventions-seed.md` を含む)・書き出し役/思い出し役の指示・判定(speak-now / comment-react)の文面は差分に入っていない(`git status` に該当ファイルなし)。`fire-orchestrator.mjs` の変更は名前の一文(括弧の組み立て)とコメントのみ。
- **既存テストの期待値変更**: `brains.test.mjs`・`cockpit.test.mjs`・`cockpit-server.test.mjs`・`cockpit-ui.test.mjs`・`conversation-instruction.test.mjs`・`settings.test.mjs`・`model-identity.test.mjs` の差分を見た。削除・置き換えは「頭の選択 → ロールの選択」「名前と会話指示がロールへ」「`/api/brain` → `/api/role`」「`brainId` → `roleId`」に伴うものだけで、挙動(次の Fire の境目で作り直す・player を作り直さない・教え(skills)が指示の上書きでも残る・revision が書けなければ進まない・snapshot に指示の本文が載らない)は新しい形で残っている。黙って消えた確かめは見つからなかった。Gnome の報告 §2 の一覧は差分と一致。
- **実データに触れていない**: `cockpit-settings.local.json`(最終更新 10/29)・`.bak-20261027`・`memories/`(最終更新 10/28)は更新日時が作業前のまま(私は中身を開いていない)。`apps/soul/agent/roles/` は存在しない。`apps/soul/agent/tmp/` には既存の `discord-receive` だけで `restructure-backups/` は無い。操縦席は起動していない(`scripts/cockpit.mjs` は構文確認と import のみ。`main()` は走らない)。

## 持ち越し

1. **作業用フォルダの掃除がコメントと違う**: `role-migration.mjs` の catch 内コメントは「作業用のフォルダは次の引っ越しの前にも消す」とあるが、作業用は `roles.migrating-<pid>` で pid が毎回違うため、プロセスが途中で落ちた残りは次の起動では消えない(`rmSync(staging)` は同じ pid の分だけ)。害は無い(git 無視・`roles/` が無いので引っ越しは再実行される)。残りのフォルダを glob で掃除するか、コメントを直す。
2. **ロール id が Windows の予約名を通す**: `ROLE_ID_PATTERN` は `con`・`nul`・`aux`・`com1` などを通す。手で作るか Domain E の「新しいロール」で作るとフォルダが作れない。Domain E のロール作成で弾くか、`isRoleId` に足す。
3. **`ui/header.mjs` の `ROLE_ID_SHAPE` は `model-identity.mjs` の `ROLE_ID_PATTERN` の写し**(ui は mind を import しない決まり)。ずれたら黙って中立表示になる。写しだと分かるテスト(同じ入力の組を両方に通す)があるとよい。
4. **`apps/soul/README.md` の `POST /api/brain` の記述**(:424、:457)が古い。Gnome の質問 4。ドメインの範囲外なので、Domain E か最後の突き合わせで直す。
5. **使われなくなった残り**: `settingsModalEventRoute` の `"brain"` の種類、CSS の `.conversation-instruction-selection`。Domain E で消す。
6. **引っ越しが失敗したとき・`roles/` が空のとき**: 手元だけの既定のロール(こーでぃーの名前)で動くが、会話指示の API は `knownIds` が空なので 400 になり、編集画面はエラーを出す。Gnome の裁量 3 に書かれた既知の制約。画面に出る理由が分かりやすいかは Domain E で。
7. **`notices` は起動中ずっと snapshot に載る**: 「1 回だけ出す」を「起動 1 回につき 1 まとまり」と読めば合う。ログのタブの上に出たままになる。気になるなら閉じられるようにする(Domain E)。
8. **Domain B への申し送り(次ドメインの範囲)**: (a) 写しのフォルダは `main()` でその場で `migrationBackupDir(..., Date.now())` を作っている。記憶の分も同じフォルダへ写すなら定数に上げて両方へ渡す。(b) Domain A の引っ越しは `roles/` の有無で動くが、記憶の引っ越しは `memories/` の直下の記録と `memories/chappy/` の有無で動く(計画 §1 Domain B)。Domain A のあとの起動で `roles/` が既にあっても記憶の分が走るように、2 つの条件を混ぜないこと。(c) まっさらな起動で Domain A が `seeded` を作った場合も、記憶の分は独立に判定すること。

## 裁量

Gnome の報告 §5 の 16 項目を確かめた。いずれも設計と矛盾せず、筋が通る。所見だけ書く。

- **1(`roleChoice` の保存先と、無いときは `brainChoice` の系統で選ぶ)**: 設計 §2.2「ロールの外に残る設定」に今日のロールの置き場の指定は無く、設定ファイルに置くのは妥当。引っ越し直後の連続性(今の頭の系統の配信がそのまま出る)も良い。
- **2(まっさらな起動で既定の 2 ロールを作る = `seeded`)**: 設計 §2.4 の「古い設定か記録があるときだけ動く」とは文面上ずれるが、ロールが 0 だと動けないための補い。設計に書いていない分岐なので、Undine が追認するとよい(下の質問)。止める根拠は無い(古い設定が無いなら写すものも無く、実データへの影響が無い)。
- **3・4(失敗時は `roles/` を作らず次の起動で再試行、いったん隣に書いて rename)**: 設計 §2.4「1 回だけ」を、失敗を「1 回」に数えない形で守っていて妥当。
- **5(チャッピーの「ほかの GPT 系」の順 = 今の `brainChoice` を先)**: 設計は順を指定していない。今のユーザーの頭を拾うのは自然。
- **6(AivisSpeech の話者・ElevenLabs の声 id は `null` = コードの既定、`--speaker` は焼き込まない)**: 設計 §2.4 は「声は今の設定の値を写す」だが、設定にこれらのキーは無い(棚卸し §2.3)。聞こえ方は今と同じで妥当。Gnome の質問 3 は、ユーザーが常に `--speaker` 付きなら Domain E の編集画面で値が空に見える点。人間ゲートで確認すればよい。
- **7(hotwords: 設定に無ければ既定を両方へ写す)**: 今と同じ聞こえ方になる。妥当。
- **8(耳が動いている間は `/api/role` を 409)**: 設計 §2.1「場の途中でロールは替えない」を、場(Domain D)ができるまで「耳が動いている」で代用するつなぎ。旧 `/api/brain` は配信中も替えられたので挙動は変わるが、設計の意図どおりで、テストも付いている。Domain D で場の判定に差し替える。
- **9・10(指示は既定なら書かない、「既定へ戻す」は空ファイル)**: 設計 §2.1「無い・空なら今の既定」と合う。
- **11(口数・話し始め・声の方式の書き込み先をロールの `role.json` に)**: 設計 §2.1 / §5(値の出どころ = ロール)に合う。運転タブから外すのは Domain E。
- **12〜16(会話指示の API は `/api/conversation-instructions/<role-id>`・応答 `roleId`、`currentRoleIdentity`、`notices`、見出しの形確かめ、`createBrainHooks`/`resolveBrainIdentity` の撤去)**: 名前と頭の結び目が戻らないようにする撤去で妥当。

## 質問

**Undine に上げるべき分岐: なし**(止める分岐は見つからなかった)。次の 2 点は止めないが、設計に書いていない判断なので Undine / ユーザーの追認があるとよい。

1. 耳が動いている間のロール選択を 409 で断るつなぎ(Gnome の質問 1)でよいか。Domain D で場の判定に差し替える前提なら問題ない。
2. まっさらな起動(設定ファイルも無い)で既定のロール 2 つを作る(Gnome の質問 2)でよいか。設計 §2.4 の文面は「古い設定か記録があるときだけ」。作らないなら「ロールが 0 のときの動き」を設計に足す必要がある。

(Gnome の質問 3 は上の裁量 6、質問 4 は持ち越し 4 に回答済み。)
