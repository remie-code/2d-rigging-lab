# S5 Domain B レビュー（design レーン）: 視覚発火の結線・共通化・設計の健全性

> レビュア: Review-Sylph（design レーン）。呼び出し元: Orch-Sylph。読み取り専任。
> 対象: S5 Domain B 実装（[../../waves/s5/domain-b.md](../../waves/s5/domain-b.md)）。
> 根拠: wave 計画 [../../orchestration/s5-wave-plan.md](../../orchestration/s5-wave-plan.md) §2・§3 Domain B /
> 棚卸し [../../orchestration/s5-planning-inventory.md](../../orchestration/s5-planning-inventory.md) §2-1〜2-4 /
> Domain A 契約 [../../waves/s5/domain-a.md](../../waves/s5/domain-a.md) / 対象ファイル直接 Read +
> `git diff HEAD` による S4 版との行単位比較。**実 SDK は走らせていない（全 fake・消費ゼロ）**。
> 実施日: 2026-07-13。

## 総合判定: **PASS-with-nonblocking**

design レーンの 6 検証項目すべて PASS。blocking なし。non-blocking 2 件（doc コメントの関数名ズレ・
視覚発火の空窓続行が契約に未明記のまま実装判断で処理されている点、いずれも Gnome 自身が §7 で
申し送り済み）。

---

## node --test 生数字（自分で実行）

```
cd apps/soul/agent && node --test
# tests 392
# pass 392
# fail 0
# cancelled 0
# skipped 0
# todo 0
```

domain-b.md の Claim（392/392/0）と完全一致。1 回で緑（空/中断なし・再試行不要）。

`git status --porcelain -- apps/runtime-player packages pnpm-lock.yaml apps/soul/agent/package.json` は
出力ゼロ（自分で実行・器コード/契約/lockfile/package.json 完全不変を確認）。`git diff HEAD --stat` は
6 ファイルのみ（`cockpit.mjs`/`cockpit.test.mjs`/`fire-orchestrator.mjs`/`fire-orchestrator.test.mjs`/
`llm-session.mjs`/`llm-session.test.mjs`）で domain-b.md §1 の一覧と一致。

---

## 検証項目（PASS/FAIL + 根拠）

### 1. 共通化（processAskedReply）の正しさ — **PASS**

`git diff HEAD -- apps/soul/agent/src/mind/fire-orchestrator.mjs` で S4 版のインライン実装（削除された
`-` 行）と新設 `processAskedReply`（fire-orchestrator.mjs:237-284）を行単位で突き合わせた。

- usage 計器の追加（:239-241、S5 新規）を除き、**パーサ呼び出し→診断発行→hasSpeech/hasEvents 分岐→
  fireEmptyReply→speaking 遷移→expression-only 分岐→speak→soul 記録→onSoulTranscript→戻り値組み立て**の
  順序・条件・emit 呼び出しは S4 版と一字一句同一（コメント文言まで含め完全一致）。
- 唯一の構造差は戻り値マージが `injectedChars, includedCount`（リテラル）から `...extra`（スプレッド）に
  変わった点のみ。通常 Fire の呼び出し側 `processAskedReply(buffer, asked, false, { injectedChars,
  includedCount })`（:401）で `extra = { injectedChars, includedCount }` となり、旧リテラルと完全に同じ
  オブジェクト形になる。よって通常 Fire の戻り値形状は無変更。
- 通常 Fire の既存 21 本のテスト（fire-orchestrator.test.mjs 1-531 行目）は `git diff HEAD` で削除行
  ゼロ（純追加のみ）を確認済み＝**1 文字も変更されていない状態でそのまま緑**。抽出によるコード移動が
  意味変化を起こしていないことをテスト側からも担保できている。

### 2. 視覚発火の分岐設計 — **PASS**

- busy/耳未起動判定の共有: `fire(fireOptions)` 先頭の `disposed`→`state!==idle`→`getBuffer()==null` の
  3 判定（:364-377）は `fireOptions.vision===true` の分岐（:380-382）より**前**に置かれており、通常 Fire
  と視覚発火が完全に同一コードパスを通る。busy 中の視覚発火はキャプチャすら呼ばれないことをテスト
  「fire(vision): busy 中（通常 Fire の thinking 中）は無視される・キャプチャすら呼ばれない」
  （fire-orchestrator.test.mjs:790-827）が `capture.calls.length===0` で固定。
- no-target は thinking 遷移**前**に判定・即 return（fireVision:293-307）。`setState("thinking")` は
  title 解決成功後（:310）に呼ばれるため、no-target 時は state が idle のまま＝ゴーストとして自然に
  見える設計が実コードで担保されている。
- capture 失敗は thinking 遷移**後**（:310→315-320）。`try { ... } finally { setState("idle"); }`
  （:313-353）が例外・正常どちらの経路でも idle 復帰を保証。no-target の早期 return は try ブロック
  外にあるため finally を経由しないが、そもそも thinking に入っていないので idle 復帰漏れは無い
  （二重 setState を避ける設計として正しい）。
- captureImpl の想定外 throw の握り分け: `try` ブロックは capture 呼び出し・onVisionCaptured emit・
  formatFireInjection・session.ask・processAskedReply の**全体**を囲んでおり、captureImpl が
  `{error}` を返さず直接 throw した場合は catch（:347-350）に落ちて `fireError`（構造化エラーではない
  想定外例外の既存経路）として扱われる。Domain A 契約（domain-a.md §2）は `captureWindow` の失敗は
  同期 throw ではなく `{error:{kind,message}}` を返す契約なので、この throw 経路は「captureImpl 自体が
  契約を破った場合の保険」として機能する。domain-b.md §7 質問 6 で Gnome 自身がこの使い分けの妥当性を
  Orch へ確認事項として明記済み——設計として矛盾はないが、契約遵守を前提にした保険的分岐である点は
  申し送りどおり確認事項として扱うのが妥当（non-blocking）。

### 3. フック設計（onVisionCaptured/onUsage/fireVisionError） — **PASS**

- `onVisionCaptured({title,width,height,jpegBase64,elapsedMs})`（:322-329）は wave 計画 §3 Domain B の
  文言「onVisionCaptured({title,width,height,jpegBase64,elapsedMs}) 通知」と完全一致する形。キャプチャ
  成功時のみ 1 回発火（失敗時は発火しない）ことをテスト（4 kind 分の失敗テスト・:662-701）が
  `visionCaptures` を持たない形で間接的に固定。
- `onUsage({usage, vision})`（:239-241）は通常 Fire・視覚発火の両方から同一の `processAskedReply` 経由
  で発火するため、実装上の分岐漏れが構造的に起きない（テストで両方個別に固定・:535-567 通常 Fire /
  :655-656 視覚発火）。`vision` フラグは契約に明記の無い独自追加（domain-b.md §7 質問 2）だが、累積
  コスト計器という目的（wave 計画 §2 裁定 2）に対し由来の区別が実用上必要という判断は妥当で、既存
  `onExpression`/`onDiagnostic` も型混在の情報を単一フックで通知する設計（例: `onDiagnostic` は
  `fireError`/`fireEmptyReply`/`expression*`/`fireVisionError` を type で判別）と一貫している。
- `fireVisionError({type,kind,message})`（:301-305 no-target / :318 capture 失敗）は既存
  `onDiagnostic` フックにそのまま乗せる形で、S4 の `expressionUnknownTag` 等と同型（type で判別する
  単一フックの流儀を踏襲）。kind は Domain A の 4 種 + `no-target` の計 5 種のみで閉じている
  （window-capture.mjs の kind 集合をそのまま透過）。
- `emit()` ヘルパー（:158-165）は try/catch で全フック呼び出しの throw を握る共通実装で、視覚発火の
  新規フック（onVisionCaptured/onUsage/fireVisionError 経由の onDiagnostic）もすべてこのヘルパーを
  経由（:300-329, :239-241）＝ best-effort 特性が視覚発火経路でも一貫して効いている。

### 4. 注入テキストの合成 — **PASS**

- `VISION_INSTRUCTION_TEXT`（fire-orchestrator.mjs:74）は `content` の text ブロック側にのみ存在し、
  `FIRE_SYSTEM_PROMPT`（:83-89）への追記は「画面（画像）が渡されることがあります。その場合は画面を
  見て、自然に反応してください。」という**存在の告知のみ**（1 文）で、指示本体は system prompt に
  持たせていない。wave 計画 §2「人格の作り込みはしない」の裁定と整合。
- 会話窓合成は `formatFireInjection`（S3 Domain A の純関数）をそのまま再利用（:333、import 元も
  fire-injection.mjs のまま・新規実装なし）。`instructionText = injectedText.length > 0 ?
  \`${injectedText}\n${VISION_INSTRUCTION_TEXT}\` : VISION_INSTRUCTION_TEXT`（:337-338）は自然な合成
  （改行区切り・空窓時は単独文）。
- 空窓時の続行設計（§7 質問 1）: 通常 Fire は `injection.includedCount === 0` で ask を無駄撃ちせず
  `empty-window` として中止する（:387-390）が、`fireVision` にはこの判定が無く常に ask を撃つ。
  wave 計画 §3 Domain B の記述「成功なら注入: 会話窓を整形し…」を字面通り読めば実装は契約に反しては
  いないが、「視覚発火は画像だけでも成立してよい」という解釈は契約に明記された裁定ではない。
  Gnome 自身が domain-b.md §7 質問 1 で確認事項として明記済み・実装は 1 判定追加で対応可能な設計に
  なっている（構造的な作り直しは不要）。**設計上のシーム破壊ではないため non-blocking**——Orch/人間
  ゲートでの確認事項として残すのが妥当。

### 5. sessionProxy 抽出 — **PASS**

- `git diff HEAD -- apps/soul/agent/scripts/cockpit.mjs` で確認: 旧インライン `sessionProxy` オブジェクト
  （URL null チェック→`ensureFireResources()`→`session.ask(text)`）が `createSessionProxy({getUrl,
  ensureFireResources, getSession})`（cockpit.mjs:195-207）へそのまま切り出され、呼び出し順序
  （URL チェックが先・ensureFireResources が後）は完全不変。本番呼び出し側（:281-285）は
  `getUrl: () => lazyChannel.getUrl()` / `getSession: () => session` を渡すだけで、実質的にコードの
  移動のみ（ロジック変更なし）。
- `ask(input)` は string/content 配列を分岐せず素通し（:198-205、コメントにも「分岐しない＝透過」と
  明記）。型ガードは呼び出し先（llm-session.mjs の `ask`）に委譲する設計で、テスト可能化のための
  構造変更として最小（新規 export 1 個・呼び出し側の書き換えは 15 行→9 行の置き換えのみ）。
- テスト 3 本（cockpit.test.mjs 末尾、URL 未設定時に ensureFireResources を呼ばない/文字列透過/
  content 配列透過）が抽出後の契約を個別に固定。既存 10 本は `git diff HEAD` で削除行なし（import 行の
  1 語追加のみ）＝無変更。

### 6. 既存器官との一貫性 — **PASS**

- `// @ts-check` は 3 ファイルすべての先頭に維持。JSDoc は新規オプション（captureImpl/getVisionTarget/
  onVisionCaptured/onUsage）すべてに型・意味・既定値を記載（fire-orchestrator.mjs:112-124）。
- 日本語コメント密度は既存箇所と同水準（S3/S4 の「── 見出し ──」形式のヘッダコメントを踏襲し、
  「S5「目が開く」の視覚発火」節をファイル先頭 doc comment に追加・:39-54）。
- `FIRE_SYSTEM_PROMPT` 追記は既存 6 語教示の末尾に 1 文足しただけ（:88-89）で最小性を保っている。

---

## non-blocking 所見

1. **doc コメントの関数名ズレ**: ファイル先頭の doc comment（fire-orchestrator.mjs:47）に
   「従来経路と完全共通（`processReply` に抽出）」とあるが、実際に抽出された関数名は
   `processAskedReply`（:237）。コメント中の関数名表記が古い草稿名のまま残っている可能性が高い。
   挙動には影響しないドキュメントの誤記だが、次に触る Domain（C 以降）が `processReply` で検索して
   見つからず混乱する可能性がある。1 語の修正で足りる。
2. **視覚発火の空窓続行が契約未明記のまま実装判断で処理されている**（§4 参照・domain-b.md §7 質問 1）。
   実装自体は一貫していて壊れていないが、「見て、と言われたら会話が無くても画像だけで反応する」という
   UX 判断は wave 計画に明記された裁定ではない。人間ゲート（画面に言及した返事が返るかの確認）で
   実際にこの経路（空窓+視覚発火）を踏むケースがあれば、意図した挙動かどうか併せて確認するとよい。

---

## blocking

なし。
