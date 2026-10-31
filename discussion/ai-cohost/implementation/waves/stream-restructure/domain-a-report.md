# Domain A — ロールと引っ越し(設定の分)完了報告

> Orch-Sylph → Undine(2026-10-31)。計画: [../../orchestration/stream-restructure-wave-plan.md](../../orchestration/stream-restructure-wave-plan.md) §1 Domain A。
> 判定: **pass**(ループ 1 回。止めた指摘 0 件)。コミットはしていない(ブランチ `ai-cohost/stream-restructure`、直前のコミット 719c6edb)。
> 実装: Gnome(opus)→ [domain-a-gnome.md](domain-a-gnome.md)。レビュー: Review-Sylph(sonnet)→ [../../reviews/stream-restructure/domain-a.md](../../reviews/stream-restructure/domain-a.md)。
> 実データ(`cockpit-settings.local.json`・`.bak*`・`memories/`)と鍵(`.env*.local`)には誰も触れていない。操縦席は起動していない。手元に `apps/soul/agent/roles/` と写しのフォルダは無い(レビューで確認)。

## 1. 機械ゲート

| ゲート | 結果 |
|---|---|
| `apps/soul/agent` で `node --test` | **1732 pass / 0 fail**(基準 1713 → +19)。Gnome とレビューの両方で実行 |
| 根で `pnpm run check:soul-zone` | pass(1558 files) |
| 依存・lockfile | 変更なし |
| 本物の LLM・外部 API | 呼ばない |

## 2. 変えたファイル(`apps/soul/agent/` 起点)

- 新規: `src/roles/role-store.mjs`(ロールの読み書き)、`src/roles/role-migration.mjs`(起動時の引っ越し `migrateSettingsToRoles({ rolesDir, settingsPath, backupDir })`)、各 `.test.mjs`(10 件ずつ)。
- 変更: `.gitignore`(`/roles/`・`/roles.migrating-*/`)、`scripts/cockpit.mjs`(`createRoleHooks`・`voiceKey` で声の作り直し・`main()` から引っ越しを呼ぶ)、`scripts/cockpit.test.mjs`、`src/cockpit/cockpit-server.mjs`(`POST /api/brain` → `POST /api/role`、snapshot に `role`・`notices`、会話指示 API の鍵をロールの id に)、`cockpit-server.test.mjs`、`cockpit-settings-store.mjs`(`roleChoice`)・test、`cockpit-ui.test.mjs`、`ui/app.mjs`・`ui/conversation-instruction-editor.mjs`・`ui/header.mjs`(`IDENTITY_PAIRS` 廃止)・`ui/settings-drawer.mjs`(頭脳タブにロールの select)・`ui/styles.mjs`、`view-logic/conversation-instruction.mjs`・test、`view-logic/settings.mjs`・test、`src/mind/brains.mjs`(`identity`・`resolveBrainIdentity` を外す)・test、`src/mind/fire-orchestrator.mjs`、`src/mind/model-identity.mjs`(`normalizeModelIdentity`・`isRoleId`)・test。
- 計 22 ファイル変更(+1308 / −820)+ 新規 4 ファイル。
- 写しの置き場: `apps/soul/agent/tmp/restructure-backups/restructure-<日時>/`(根の `.gitignore` の `tmp/` で無視。`git check-ignore` で確認)。
- 期待値を変えた既存テスト(すべて仕様変更に伴うもの。一覧は domain-a-gnome.md §2、レビューで差分と一致を確認): `createBrainHooks` 8 件と `POST /api/brain` 8 件を削除、`buildBrainSessionSystemPrompt` 3 件・identity 2 件を置き換え、会話指示 API の応答 `brainId` → `roleId`、`currentBrainIdentity` → `currentRoleIdentity` の改名、UI / view-logic のテストをロールに合わせて書き換え。

## 3. 裁量(Gnome が決め、レビューが筋が通ると認めたもの。全 16 項目は domain-a-gnome.md §5)

- 今のロールの保存先は設定キー `roleChoice`。無ければ `brainChoice` の系統(GPT 系 → chappy、それ以外 → cody)。
- 設定ファイルも無いまっさらな起動では、既定の値で 2 ロールを作る(`seeded`)。
- `roles/` があってロールが 1 つも読めないときは、置き場に書かない手元の既定ロールで動く。
- 引っ越しは `roles.migrating-<pid>/` に書いてから `roles/` へ rename。写しが取れなければロールを作らない。
- チャッピーの指示の順は 61 Sol → 今の頭(GPT 系なら)→ ほかの GPT 系。
- 話者・声の id は引っ越しで `null`(コードの既定)。`--speaker` は焼き込まず上書きに使う。hotwords は設定の値か今の既定を両方へ。
- 耳が動いている間の `POST /api/role` は 409(旧 `/api/brain` は配信中も替えられた。挙動が変わる)。
- 運転タブの口数・話し始め、Start の声の方式は今のロールの `role.json` に書く。
- 引っ越しの結果は snapshot の `notices` でログのタブの上に出す(起動中は出たまま)。指示の本文は出さない。

## 4. 持ち越し(止めない指摘。レビュー §持ち越し)

1. `roles.migrating-<pid>` の残りが次の起動で消えない(pid が毎回違う)。コメントとずれ。害なし。
2. `ROLE_ID_PATTERN` が Windows の予約名(`con`・`nul`・`com1` など)を通す → **Domain E** のロール作成で弾く。
3. `ui/header.mjs` の `ROLE_ID_SHAPE` が `model-identity.mjs` の `ROLE_ID_PATTERN` の写し(ずれても気づけない)。
4. `apps/soul/README.md:424`・`:457` に `POST /api/brain` の古い記述。
5. 使われない残り: `settingsModalEventRoute` の `"brain"` 種別、CSS `.conversation-instruction-selection` → **Domain E** で消す。
6. 引っ越し失敗時・`roles/` が空のとき、会話指示 API が 400(裁量 3 の既知の制約)。
7. `notices` が起動中ずっとログのタブに出たまま。
8. **Domain B へ**: 写しのフォルダを定数に上げて記憶の写しと共有する。記憶の引っ越しの条件(`memories/` 直下の記録と `memories/chappy/` の有無)は `roles/` の有無と混ぜず独立に判定する(`seeded` の起動でも)。記憶の 4 か所はまだ `DEFAULT_MEMORY_DIR` のまま。
9. **Domain C へ**: 体は `roleHooks.current().body` で読めるが、挙動にはつないでいない。
10. **Domain D へ**: `POST /api/role` の 409 は `earsState` で判定している → 「場が開いているか」に差し替える。
11. **Domain E へ**: 画面はロールの select だけ。ロールの書き込み API(名前・モデル・声・体などの編集、新しいロールの作成)はまだ無い。

## 5. 質問(Undine へ。どれもループを止める分岐ではないが、設計に無い判断の追認がほしい)

1. 耳が動いている間の `POST /api/role` を 409 で断るのを、Domain D までのつなぎとしてよいか(設計 §2.1「場の途中でロールを替えない」に沿う読み。旧 `/api/brain` は配信中も替えられた)。
2. 設定ファイルも無いまっさらな起動で、既定の 2 ロールを作る(`seeded`)形でよいか。設計 §2.4 の文面は「古い設定か記録があるときだけ動く」。ロールが 1 つも無いと選べないため、Gnome はこう決めた。
3. 引っ越しで話者を `null`(コードの既定)にし、`--speaker` を起動引数の上書きのまま残す形でよいか(Orch-Sylph の読み: 設計 §2.4「今の設定の値を写す」の「設定」に起動引数は入らないので、これでよい)。
4. README の古い `/api/brain` の記述をどのドメインで直すか(Orch-Sylph の案: Domain E か全体の突き合わせの後の仕上げ)。
