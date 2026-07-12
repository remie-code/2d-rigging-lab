# S1 Domain A レビュー: 特区パッケージ骨格 + モーラ写像 / WAV パーサ純関数

> Reviewer: Review-Sylph（3レーン: spec / design / test）。2026-07-12。
> 対象実装: `apps/soul/agent/`（package.json + src/{mora-timeline,wav-duration,fixtures}.mjs + 2 テスト）。
> Gnome 実装報告: [../../waves/s1/domain-a.md](../../waves/s1/domain-a.md)。
> 判定基準: wave 計画 [../../orchestration/s1-wave-plan.md](../../orchestration/s1-wave-plan.md) §3/§4 ・ 事実台帳 [../../orchestration/s1-planning-inventory.md](../../orchestration/s1-planning-inventory.md) §1/§3/§6 ・ 契約スキーマ `channel-intent-speech-payload-schema.json` / `channel-exchange-examples.json` speechPath ・ 参照ドライバ `reference-driver.mjs`。

## 総合判定: **PASS**

3 レーンすべて PASS。blocking 指摘ゼロ。non-blocking（テスト網羅の補強候補・設計注記）が数点。install はユーザー作業（choke point）で本レビュー範囲外。

| レーン | 判定 |
| --- | --- |
| spec（契約整合） | **PASS** |
| design（設計・境界） | **PASS** |
| test（fixture 十分性） | **PASS-with-notes** |

---

## 検証（自分で実行した生出力）

### `cd apps/soul/agent && node --test`（node_modules 不在のまま = 依存ゼロ実証）

```
1..32
# tests 32
# suites 0
# pass 32
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 99.6141
```

32/32 緑。install していない状態（`apps/soul/agent/node_modules` 不在・`package-lock.json` 不在を `ls` で確認）で通ることを自分の実行で確認 = 依存ゼロ・node 組み込みのみで動く。

### `node scripts/check-soul-zone-boundary.mjs`

```
Soul zone boundary guard passed: 1254 source files scanned; no 器→魂 imports and no 魂→器 code imports.
soul-zone exit=0
```

### `node scripts/check-dependencies.mjs`

```
Dependency guard passed.
deps exit=0
```

### `node scripts/check-source-organization.mjs`

```
Source organization violations found:
- apps/runtime-player/src/main/physiology/index.ts: index.ts must remain a barrel-only entrypoint
source exit=1
```

→ 唯一の赤は `apps/runtime-player/src/main/physiology/index.ts`（既知・S1 着手前からの既存問題・別タスク化済み、Domain A と無関係）。**`apps/soul/agent/` 由来の新規赤はゼロ**。Domain A の blocking 判定には含めない（wave 計画 §4-2 の「無退行」= Domain A が新たな赤を作っていないこと、を満たす）。

### git status / lockfile・契約 diff

```
?? apps/soul/agent/
?? discussion/ai-cohost/implementation/waves/s1/
（git diff --stat pnpm-lock.yaml contract/ = 空出力 = 変更なし）
```

`pnpm-lock.yaml`・器コード・C4 契約 fixture に変更ゼロ。作業は `apps/soul/agent/` 新規 6 ファイル（+ 実装記録 doc）に閉じている。wave 計画 §4-1 合格。

---

## spec レーン（契約整合）: PASS

契約スキーマ（`timeline` 1..512・`timeMs` 非負/厳密単調/整数化後も破綻せず・`vowel` 5 値・`s` 0..1 域外 throw）と実装 `buildSpeechTimeline` を全経路で突合。

- **timeMs 非負・厳密単調・整数**: `Math.max(Math.round(raw), previousTimeMs + 1)`、`previousTimeMs` 初期値 -1（mora-timeline.mjs:169,178-182）。第一要素は `max(round, 0) ≥ 0`、以降は各要素 ≥ 前値+1。整数化は `Math.round`。schema minimum 0 / strictly increasing を構築で保証。**契約合致**。
- **vowel 5 値**: `normalizeVowel` が小文字化 → `a/i/u/e/o` 以外は `null` → push しない（mora-timeline.mjs:70-76,173-177）。出力に残る vowel は必ず enum 内。**合致**。
- **s 0..1**: `resolveSByVowel` が解決後の全母音 s を有限・0..1 で検証、域外は `RangeError`（mora-timeline.mjs:103-110）。既定マップ `{a:0.85,i:0.5,u:0.55,e:0.7,o:0.65}` は全て域内。schema「域外は slotValueOutOfRange・クランプなし」を魂側で先んじて throw。**合致**。
- **enum 外脱落 + 時間ギャップ保持**: pau/N/cl/長音/大文字無声化 → 脱落だが `index` はスロット消費（`prePhonemeSec + index*slotSec`）。planning-inventory §1「ん/pau は enum 外 → エントリを落とし時間ギャップで表す」・裁定 2 に整合。golden で N(index1)/pau(index5) 跨ぎ間隔が隣接間隔より広いことを検証済み。**合致**。
- **均等割り（裁定 2）**: `slotSec = bodyDurationSec / moras.length`（脱落込み全要素数で割る）、`start = pre + index*slotSec`（mora-timeline.mjs:165,178）。wave 計画 §3 Domain A・裁定 2 の定式通り。**合致**。
- **pre 無音オフセット（WAV 実時間軸採用）**: `timeMs` は WAV 先頭 t=0 軸、先頭発声モーラを `prePhonemeSec` 分オフセット。wave 計画 §3 Domain B の同期方針（accepted 受領→即再生・先頭無音 0.1s が口の attack と相殺）と**矛盾しない**（むしろ整合させた設計選択）。皮膚感の最終判定は一聴ゲート（Domain B/C）に委譲、純関数の契約変更不要。**整合**。
- **512 上限を脱落後の出力要素数で判定**: 判定は `timeline.length`（出力）に対して行う（mora-timeline.mjs:190）。schema `maxItems:512` は `timeline` 配列に掛かるため、脱落込みの生要素数ではなく出力要素数で判定するのが正。**合致**。切詰め禁止（throw）も schema「never clamped」に一致。
- **WAV RIFF 解釈**: マジック "RIFF"@0 / "WAVE"@8 検査（BE 読み）、offset 12 からサブチャンク走査、`advance = chunkSize + chunkSize%2` で奇数パディング跨ぎ、チャンク順不同許容（fmt/data 前後を仮定しない）、`byteRate` 優先→0/欠落なら `sampleRate*blockAlign` 代替、data 欠落/マジック不一致/byteRate=0/12byte 未満/fmt 切詰め throw（wav-duration.mjs:50-113）。RIFF/WAVE PCM 仕様に忠実。**合致**。
- **golden 手検算**: `buildSpeechTimeline(GOLDEN_MORAS, 1.5468, 0.1, 0.1)` を独立に手計算し、テストの GOLDEN_TIMELINE 全 9 要素（timeMs 100/345/467/590/835/957/1079/1202/1324、s も母音別既定と一致）を再現。fixture の 1.5468s（= data チャンク実秒・先頭/末尾無音込み）→ body=1.3468s の意味論が planning-inventory §3（「data 1.5468s・pre/post 各 0.1s → 発話実体≈1.347s」）と一致し、`wavDurationSec`（data 全長を返す）と `buildSpeechTimeline`（body=wav-pre-post）の合成が正しいことを確認。s 値は参照ドライバ speechTimelineMoras（手書き 0.5〜0.9）の流儀を母音別に固定した前例踏襲。**合致**。

---

## design レーン（設計・境界）: PASS

- **純関数性**: 副作用なし・I/O なし・決定論。`buildSpeechTimeline`/`wavDurationSec` は入力→出力のみ。テスト「決定論: 同じ入力は同じ出力」で裏取り。**PASS**。
- **依存ゼロ**: import は自 zone 内相対 `.mjs` と `node:test`/`node:assert/strict` のみ。node_modules 不在で `node --test` 32/32 緑を自分で実行確認 = 組み込みのみで動く。**PASS**。
- **特区規律**: soul-zone boundary 緑（器→魂・魂→器 code import ゼロ）、`pnpm-lock.yaml` diff 空、`apps/soul/agent/package.json` はサブディレクトリ = pnpm workspace glob（`apps/*` 1 階層）対象外。package-lock.json 不在も確認。裁定 1（独立 npm パッケージ・lockfile 不変）を満たす。**PASS**。
- **package.json 宣言**: `@anthropic-ai/claude-agent-sdk` 0.3.207 を deps に宣言・install していない（node_modules 不在で実証）。`private`/`type:module`/`version 0.0.0`/`scripts.test="node --test"`/devDeps ゼロ。wave 計画 §2 の狙い通り。**PASS**。
- **エッジケース決定の妥当性と文書化**: 1ms 押し出し・512 を脱落後要素数で判定・throw 条件群（空 moras / body 非正 / 母音ゼロ / 数値不正 / 非配列）が mora-timeline.mjs 冒頭コメント（1-35 行）と実装記録 §2 に文書化。`toDataView` が Uint8Array/Buffer(byteOffset 尊重)/ArrayBuffer を正規化。妥当。**PASS**。

---

## test レーン（fixture 十分性）: PASS-with-notes

自分で `node --test` 32/32 緑を実行確認。テストコードを読み、ゴールデン（実機 audio_query 接地の 11 モーラ・N/pau 脱落）と性質テスト（単調性・enum・s 境界・ギャップ・512 境界・整数化衝突・WAV 順不同/パディング/代替 byteRate/不正ヘッダ/部分ビュー/ArrayBuffer）の網羅を確認。以下は網羅の**補強候補（non-blocking）**。

---

## 指摘一覧

### blocking

なし。

### non-blocking（notes）

1. **[test] 押し出しの 512 連鎖が未検証**（mora-timeline.test.mjs:162-171 は 5 要素、:173-191 は body=600s で押し出しなし）。「512 要素 + 極小 body」で 1ms 押し出しが 512 番目まで連鎖する複合ケースが直接テストされていない。不変条件（厳密単調）は要素数に依らず構築で保証されるため論理的には健全だが、境界の複合ケースを 1 ケース足すと安心。根拠: mora-timeline.mjs:180。
2. **[test] 先頭モーラが脱落する場合の第一出力要素が未検証**。既存テストは index0 が常に発声モーラ（golden / 脱落テストとも index0=voiced）。index0 が enum 外で脱落し、最初の出力要素が index>0 になるケース（`previousTimeMs` が -1 のまま非ゼロ raw を受ける）は論理上正しく動くが未固定。根拠: mora-timeline.mjs:169-182。
3. **[test] 2 純関数の合成（`wavDurationSec` 出力を `buildSpeechTimeline` に流す）が未テスト**。各関数は独立に緑だが、data 全長→body 減算の意味論整合（本レビューで手検算確認済み）を 1 本の合成テストで固定しておくと Domain B 着手時の回帰網になる。ただし合成は Domain B の職掌なので S1 Domain A スコープ外でも可。
4. **[design] s 値の母音別固定は articulation の揺らぎを持たない**（実装記録 §5-3 の通り意図的）。参照ドライバは同母音でも s を 0.6/0.65/0.7 と揺らしていたが、器側の普遍係数 0.8 + 再調音ディップ（契約 §speechPath 注）が揺らぎを担うため魂側固定は妥当。血液的でない改善余地であり本 wave では不要。sConfig にモーラ index ベースの揺らぎ関数を後付けできる設計余地あり。
5. **[design] `resolveSByVowel` は出現しない母音の sConfig 域外値でも throw する**（全 5 母音を無条件検証。mora-timeline.mjs:103-110）。実際に使われない母音の設定ミスでも早期に落ちる = より厳格で安全側。契約違反ではなく、むしろ望ましい。注記のみ。

---

## Orch-Sylph への質問

1. **note 3（合成テスト）の帰属**: 2 純関数の合成テスト（`wavDurationSec`→`buildSpeechTimeline`）を Domain A の網羅に含めるか、Domain B（TTS→写像の実配線）側の疎通テストに委ねるか。本レビューは「Domain B 職掌でも可」と判断し blocking にしていない。方針確認を求める。
2. **install 後の再チェック（Gnome 報告 §5-1 の choke point）は Domain A レビュー範囲外**として扱った。install（ユーザー作業）後に `check:soul-zone / check:deps / check:source` が引き続き緑か（planning-inventory §5 は非該当と予測）の再確認は、Domain B 着手時の前提条件として Orch 側で管理する理解でよいか。

---

## 質問への裁定（Orch-Sylph 記録・Undine 裁定 2026-07-12）

1. **note 3（合成テスト）**: `wavDurationSec`→`buildSpeechTimeline` の合成テストは **Domain B の疎通テストに委ねる**（Domain A スコープ外で確定）。
2. **install 後の再チェック**: install（ユーザー作業）後の `check:soul-zone / check:deps / check:source` 再確認は **Domain B 着手時の前提条件として Orch-Sylph が管理する**（Domain B 実行の最初の機械検証に含める）。

## 結論

Domain A（特区パッケージ骨格 + モーラ写像 / WAV パーサ純関数）は wave 計画 §3 Domain A・§4 blocking 基準・裁定 2/4・契約スキーマを満たす。blocking 指摘ゼロ。新規赤なし・lockfile/契約不変・純関数/依存ゼロ/特区規律すべて実証。**次ドメイン（B）へ進める**（install choke point をユーザーが通した後）。non-blocking note は Domain B 以降で回収可能。

> **Domain A 閉鎖（Orch-Sylph 2026-07-12）**: 実装（Gnome）・レビュー 3 レーン PASS・成果物・機械検証（Orch 自身の再実行: node --test 32/32 / soul-zone 緑 1254 files / deps 緑 / 保護パス diff 空）をすべて裏取り済み。choke point（`apps/soul/agent` での `npm install`）待ちで wave を一時停止。check:source の既存赤（physiology/index.ts barrel 違反・S1 無関係・HEAD 同一）は別タスク化済み。
