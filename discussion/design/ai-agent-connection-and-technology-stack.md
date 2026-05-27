# AI Agent Connection and Technology Stack Policy

> 状態: Draft / user-aligned direction  
> 目的: Private 2D Rigging Lab / Prototype の技術スタックと AI Agent 接続方式に関する議論結果を、後続の `/goal` 設計指示で参照できる形に保存する。

## 1. 位置付け

この文書は、GUI Editor 必須の Authoring-to-Runtime MVP を前提に、AI Agent が Private 2D Rigging Lab / Prototype とどのレイヤーで接続するべきか、またそのためにどの技術スタックが自然かを整理する。

ここでの結論は、特定UI実装を細部まで固定するものではない。設計時の方針、評価軸、非目標、未決事項を明確にするための記録である。

## 2. 設計判断

### 2.1 技術スタック方針

MVPの第一候補は **Web-first TypeScript stack** とする。

理由は、Private 2D Rigging Lab / Prototype が以下を同じ意味論でつなぐ必要があるためである。

- GUI Editor
- Editor preview
- private runtime core
- Viewer
- Validator
- AI Agent Interface
- project-defined model package
- E2E / scenario verification

Web-first TypeScript は、GUI、Canvas / WebGL 表示、Runtime / Viewer共有、PlaywrightによるGUI操作、JSON系Model Format、構造化operation、Web SDK展開を同じ技術圏で扱いやすい。

### 2.2 Desktop shell の扱い

Web-first は「最終成果物がブラウザだけでなければならない」という意味ではない。

ローカルファイル、package workspace、desktop配布、OS連携が必要になった場合は、Web frontend を維持したまま desktop shell を検討する。

| Option | 方針 |
|--------|------|
| Browser-only Web app | MVP初期検証やCI / Playwright検証に向く。ローカルファイル操作は制約に注意する |
| Electron | Chromium + Node.js により、AI自動操作、ローカルファイル、MCP / Node tooling と相性が良い。AI連携優先のdesktop候補 |
| Tauri | Web frontend + Rust backend により軽量配布に向く。AI連携も可能だが、外部ブラウザ自動操作やbridge設計は注意が必要 |

現時点では、core / editor / viewer / validator / operation を Web-first TypeScript で設計し、desktop shell は後続判断にする。

## 3. AI連携の3層

AI Agent 接続は、単一の入口ではなく、次の3層として設計する。

### 3.1 File-level AI connection

project-defined model package がテキスト中心で、schema、stable ID、operation log、provenance、validation report を持つなら、CodexなどのAI Agentはワークスペース上のファイルを直接読んで編集できる。

これは技術スタック非依存の最下層AI連携である。

設計上の要求:

- project-defined model package はAIが読める構造を持つ。
- stable ID により、drawable、mesh、parameter、keyform、rig control、mask、asset を特定できる。
- operation log と provenance により、変更理由と編集経路を追える。
- Validator がファイル編集後の破綻を検出できる。

### 3.2 GUI-level AI connection

Web-first GUI であれば、Playwright などによりAI AgentがアプリをGUI操作できる。

ただし、Canvas内部の図形そのものはDOMとして直接見えにくい。したがって、GUI-level AI connection を成立させるには、座標クリックだけに依存しない観測面が必要である。

設計上の要求:

- role / label / test id など、安定したGUI操作対象を持つ。
- Parts tree、Drawable list、Parameter panel、Inspector、Diagnostics panel などを構造化DOMとして提供する。
- Canvas上の選択対象やruntime stateを、inspector / snapshot / overlay metadata として取得できる。
- Playwright操作と人間操作が同じ GUI operation に到達する。

### 3.3 Structured API-level AI connection

AI用の効率的な編集窓口として、REST、WebSocket、MCP、または in-process command bus による構造化operationを提供する。

これはAI Agent Interfaceの本命であり、GUI自動操作よりも高精度・低コストな編集、検証、dry-run、diff取得を可能にする。

設計上の要求:

- `createParameter`、`setKeyform`、`moveMeshVertex`、`createRigControl`、`runValidation` などのoperationを構造化する。
- dry-run と apply を区別する。
- model diff、runtime diff、validation diff を取得できる。
- operation結果はGUI、Validator、AI Agentで同じstable IDを参照する。
- 将来MCP toolsとして公開可能な粒度にする。

## 4. 中核設計原則

AI連携のために最も重要なのは、編集処理の正をGUIイベントハンドラに閉じ込めないことである。

推奨する流れ:

```text
Human GUI operation
Playwright GUI operation
Structured API / MCP operation
File-level package edit

        ↓

Shared Operation Core
        ↓
project-defined model package / Runtime Evaluation / Validator / Diff
```

GUI、Playwright、REST / WebSocket / MCP、Codexによるファイル編集は、できるだけ同じ operation core、model core、validator core に接続する。

これにより、AI Agent はGUIの代替ではなく、人間の制作を補助・検証・修復提案する並行インターフェースとして成立する。

## 5. 非目標

- GUI操作だけでAI連携を完了したことにしない。
- 手書きJSONやscript生成だけでMVP達成にしない。
- AI Agent専用APIを、GUIやValidatorと別の編集意味論にしない。
- Native GUI を初手にして、AI操作・E2E検証・Web SDK展開を後から苦しくしない。
- 第三者形式対応や既存 `.moc3` / `.cmo3` 処理を、AI連携の前提にしない。

## 6. 技術候補の比較

| Candidate | AI connection | MVP speed | Rendering / distribution | Assessment |
|-----------|---------------|-----------|--------------------------|------------|
| Web-first TypeScript | File / GUI / structured API の3層を作りやすい | 高い | WebGL / Canvasで十分開始可能 | 第一候補 |
| Electron + TypeScript | Web-firstを保ったままdesktop/Node連携が強い | 高い | 重いが実用的 | AI連携優先のdesktop候補 |
| Tauri + TypeScript/Rust | Web frontendを保ちつつ軽量配布しやすい | 中 | Rust backendを活かせる | 配布品質重視のdesktop候補 |
| Rust/C++ native GUI | 構造化APIは作れるがGUI自動操作が重い | 低から中 | 描画・配布は強い | 初手には重い |
| Unity / Unreal | 描画やruntimeは強いがEditor/AI/format設計が重くなる | 中 | ゲームエンジン寄り | MVPの中心には過剰 |
| Python desktop | prototypeは速い場合がある | 中 | 配布・描画・長期保守に弱い | 本筋ではない |

## 7. 設計で決めるべきこと

後続の設計 `/goal` では、少なくとも次を決める必要がある。

- frontend / shared core / package IO / runtime / validator / AI bridge のモジュール境界。
- Browser-only、Electron、Tauriのうち、MVP時点でどこまで採用するか。
- project-defined model package のファイル編集を、operation log と validator でどう安全に扱うか。
- GUI操作、Playwright操作、Structured API操作を同じ operation core に接続する方法。
- REST / WebSocket / MCP / in-process command bus のどれをMVPで採用し、どれを将来候補にするか。
- AI Agent が package に対して外部処理する場合と、起動中Editorへ接続する場合の責務分担。
- operation dry-run、apply、undo / redo、diff、validation report の共通schema。

## 8. 未決事項

| 項目 | 状態 |
|------|------|
| MVP時点で desktop shell を採用するか | 未決。Web-first coreを前提に後続判断 |
| Electron と Tauri のどちらをdesktop候補にするか | 未決。AI連携優先ならElectron、軽量配布優先ならTauriが候補 |
| Structured API をREST / WebSocket / MCP / in-process command bus のどれで始めるか | 未決。operation coreを先に定義する |
| AI Agent が起動中Editorへ接続する方式 | 未決。GUI操作、structured API、MCP bridgeの組み合わせで検討 |
| File-level直接編集の安全性 | Validator、operation log、schema migrationで担保する設計が必要 |
