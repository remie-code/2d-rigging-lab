# apps/soul — 魂の特区 (Soul Zone)

> 憲章: [`discussion/ai-cohost/concept/mvp-boundary-amendment.md`](../../discussion/ai-cohost/concept/mvp-boundary-amendment.md) §6（改定二号: 魂の特区。Accepted 2026-07-11）。

このディレクトリは「魂（AI 共演者のオーケストレータ: LLM 呼び出し・知覚・ペルソナ・TTS 等）」が住む**特区**である。憲法「リポジトリ側は決定論の器、知性は外部」の「外部」の定義が、C4 で「リポジトリの外」から「境界の外」へ改まった帰結として、魂は本リポジトリ内のこのディレクトリに住むことを許される。

## この特区の 6 条（憲章 §6 の要約）

1. LLM プロバイダ統合・知覚（画面キャプチャ / 視覚モデル）は **`apps/soul` 配下でのみ**許される。特区外では従来どおり禁止。
2. 魂が import してよいのは**操縦チャネルの契約（型・fixture=JSON）だけ**。器のコードを直接 import しない。器と魂の会話は実行時の WebSocket 越しのみ。
3. **器側の何ものも魂を import しない**。依存の向きは一方向（魂 → 契約のみ）。
4. 決定論・provenance の規律は特区内には適用されない。逆に特区は器の決定論に一切触れられない（2・3 の帰結）。
5. **秘密（API キー等）はコミットしない**。特区の設定は環境変数 / ローカル設定で扱う。
6. 特区内のツールチェーンは特区の自由。

## 物理コストの回避（裁定 4）

**このディレクトリには `package.json` を置かない。** `apps/*` は `pnpm-workspace.yaml` の workspace glob 内なので、`package.json` を置くと `pnpm-lock.yaml` の `importers:` が増え `pnpm install` が要る。それを避けるため、特区は依存ゼロの standalone として実装する（正式 workspace app 化は、実物の魂が依存を持つ日まで繰延）。

## 住人

### `reference-driver/` — 参照ドライバ（特区の最初の住人。C4 Domain D）

LLM・知覚を持たない**疑似魂**。決定論的なシナリオ（注視 → 傾げ → 沈黙 → 再開 → 意図的切断 → 再接続）を操縦チャネルへ流す常駐プロセス。

- **依存ゼロ**: 素の Node 22 のグローバル `WebSocket`（undici 由来のクライアント）のみを使う。npm 依存なし、tsx 等のトランスパイラなし。
- **直実行**: `node apps/soul/reference-driver/reference-driver.mjs <url>`。
- 役割: ①C4 の持続駆動機械テストの駆動源 ②契約エルゴノミクスの検証（書く行為そのもの） ③C5 人間ゲートの証人 ④魂側開発への実行可能な手本。

起動例:

```
node apps/soul/reference-driver/reference-driver.mjs "ws://127.0.0.1:17310/channel?token=<token>"
```

（`<url>` は自律ホストの Channel ページで `Open Channel` した後に表示される Endpoint URL。）
