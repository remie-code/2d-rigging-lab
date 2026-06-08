# React Editor Foundation Oracle

> Wave57以降のEditor GUI再構築で参照する、技術スタック、source構成、validation境界、非ゴールに関する合意済みオラクル。

## 1. 位置付け

この文書は、`apps/editor` をUX駆動で再構築するための継続的な判断基準である。

Wave57の作業計画ではなく、Wave57以降も参照されるオラクルとして扱う。Wave57 planはこの文書をbasisにして実行手順を定義する。

## 2. 前提

- Wave56は破棄する。
- ただし、Wave56 Domain B/Cで確認されたheadless baseline / package分離は後続の事実として引き継ぐ。
- `apps/editor` は安全に削除できる前提で扱う。
- 既存 `apps/editor` は再利用対象ではなく削除対象である。
- `apps/editor` は削除したうえで、同じpathにReactベースで新規作成してよい。
- 旧 `apps/editor` source、git history、旧GUI改善wave文書、旧e2e、旧testid guardを再利用根拠にしない。

## 3. 採用技術スタック

Wave57のEditor GUI基盤では次を採用する。

| 種別 | 採用 |
|---|---|
| UI framework | React |
| Language | TypeScript |
| Build tool | Vite |
| Styling | Tailwind CSS |
| UI primitives | Radix UI |
| Icons | lucide-react |
| Resizable layout | react-resizable-panels |
| UI state | zustand |
| Class composition | clsx |

具体的な初期依存:

- `react`
- `react-dom`
- `@vitejs/plugin-react`
- `tailwindcss`
- `@tailwindcss/vite`
- `lucide-react`
- `@radix-ui/react-dialog`
- `@radix-ui/react-tooltip`
- `@radix-ui/react-tabs`
- `@radix-ui/react-popover`
- `react-resizable-panels`
- `zustand`
- `clsx`

## 4. 採用しないもの

初期基盤では次を採用しない。

- `shadcn/ui`
- MUI / Mantine などの大型component kit
- PixiJS / canvas renderer
- browser e2e / visual regression framework
- external HTTP / WebSocket / MCP transport
- LLM/provider integration

理由:

- `shadcn/ui` は便利だが、生成コードが増え、初期段階では新たな汚染源になり得る。
- 大型component kitは、Editor固有の密なlayout、toolbox、inspector、canvas周辺と衝突しやすい。
- renderer / canvas engineはCanvas実装waveで改めて判断する。

## 5. Source構成

`apps/editor/src/` はフラットにしてはならない。

初期の上位構成:

```text
src/
  app/
  workspace/
  features/
  components/
  ui/
  state/
  styles/
  lib/
```

役割:

| Path | Role |
|---|---|
| `app/` | application root、provider、top-level composition |
| `workspace/` | Authoring Workspace全体、workspace layout、panels |
| `features/` | PSD Import、Mesh、Rig、Atlas、Parameter、Viewerなど将来機能の入口 |
| `components/` | domain-neutralだがapp固有の再利用component |
| `ui/` | Button、Dialog、Tooltipなど低レベルUI primitive wrapper |
| `state/` | UI state store。初期はzustandによるUI state限定 |
| `styles/` | Tailwind entry、tokens、global styles |
| `lib/` | 小さな汎用helper |

各サブディレクトリ配下も、状況に応じてさらにディレクトリを掘る。

禁止:

- `src/` 直下に大量の実装ファイルを平置きすること。
- `components/` 配下に大量のcomponentファイルをフラットに並べること。
- `index.ts` を巨大な実装ファイルにすること。`index.ts` はbarrel-onlyを基本にする。
- 旧 `apps/editor` のファイル名・module構成を復元すること。

## 6. State境界

`zustand` は初期段階ではUI state限定で使う。

許可される例:

- active tool
- open task
- selected panel
- current view
- layout state
- placeholder selection

接続しないもの:

- domain model
- operation API
- PSD import実処理
- mesh / rig / atlas / parameter / variant / dynamics / viewerの実機能

これらは後続waveで個別に接続する。

## 7. 初期UX目標

最初に作るGUIは、ユーザーが起動直後に目にするAuthoring Workspace相当のplaceholderである。

必須領域:

- App Bar
- Toolbox
- Parts / Structure Tree
- Canvas / Preview
- Inspector
- Parameter Bar
- Task / View entry points

各機能は未実装placeholderでよい。重要なのは、今後のEditor機能がどこに現れるか、人間が視覚的に理解できることである。

## 8. Validation境界

Wave57のvalidationは意図的に小さく保つ。

必須:

- `pnpm run typecheck`
- `pnpm run test:unit`
- `pnpm run check`
- `pnpm --filter @private-2d-rigging-lab/editor typecheck`
- `pnpm --filter @private-2d-rigging-lab/editor build`

このwaveでは原則として行わない:

- dev serverを起動しての確認
- browser e2e
- visual regression
- screenshot validation
- long-running server processを伴う検証

理由:

- dev server起動確認はプロセスが残り、subagentが帰ってこない事故を引き起こしやすい。
- Wave57の目的はReact基盤と起動直後placeholderであり、runtime visual fidelityの証明ではない。

UI確認は、必要ならcomponent/static testで主要領域の存在確認までに留める。

## 9. 非ゴール

Wave57初期基盤では次を行わない。

- PSD import実処理
- Mesh生成
- Rig調整
- Texture Atlas
- Parameter Manager
- Variant / Expression Manager
- Dynamics
- Viewer / Runtime View
- Codex-facing UI
- Diagnostics / Evidence View
- semantic recognition
- proposal generation
- auto-rigging
- auto-fix
- Cubism互換

## 10. 後続判断

Wave57完了後、次wave前に改めてUI確認・validation拡張・browser確認の扱いを議論する。

現時点では、Wave57のvalidationを肥大化させないことを優先する。
