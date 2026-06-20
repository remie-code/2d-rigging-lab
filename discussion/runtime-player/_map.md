# Runtime Player Map

> Editor外のRuntime Player / Capture Host appに関する外部記憶の入口地図。

## 1. Scope

Runtime Playerは、Editorが生成したRuntime Export directoryを読み込み、tracking inputを受け取り、モデルをライブ表示する別アプリである。

Editor本体のauthoring UX、Workspace Save、Portable JSON、Texture Atlas authoring、Runtime Export生成はこのトピックの責務ではない。

## 2. Directories

| Path | Role | Status |
|---|---|---|
| [research/](research/) | 外部入力ソース、通信仕様、成立性調査 | Created |
| [screens/](screens/) | Runtime Playerの画面責務、初期画面、Live/Setup UX | Created |
| [architecture/](architecture/) | Runtime Playerの技術スタック、process/window/package境界、runtime data flow | Created |

## 3. Key Files

| Path | Status | Content |
|---|---|---|
| [research/ifacialmocap-input-adapter-research.md](research/ifacialmocap-input-adapter-research.md) | Draft / initial research captured | iFacialMocapをRuntime Playerのtracking input adapterとして使うための公式仕様・実現性・設計含意 |
| [screens/initial-runtime-player-screen.md](screens/initial-runtime-player-screen.md) | Draft / initial UX captured | Runtime Player起動時にユーザーが最初に見る画面、モデルロード後のLive/Setup画面、通常表示に載せない情報 |
| [architecture/technology-stack-decision.md](architecture/technology-stack-decision.md) | Accepted baseline | Electron固定後のRuntime Player技術スタック、採用理由、app構成、非採用技術、未決事項 |
| [architecture/runtime-player-development-policy.md](architecture/runtime-player-development-policy.md) | Accepted baseline | Runtime Player固有のprocess boundary、ディレクトリ粒度、ファイル分割、IPC、runtime loop、state ownership、test方針 |

## 4. Current Decisions

- Runtime PlayerはEditor外の追加アプリとして扱う。
- Runtime Playerはface tracking engineではなく、tracking input consumerとして設計する。
- 入力ソースは将来切り替え可能なadapter境界を持つ。
- v0候補の入力ソースはiFacialMocapであり、自前face trackingは当面作らない。
- Browser-only appではなく、UDP/TCP受信可能なdesktop host appを前提に検討する。
- App shellはElectronに固定する。
- 技術スタックはTypeScript-first、electron-vite、React/Vite、既存runtime-core/render-webgl2再利用をbaselineにする。
- Runtime Player開発では、process boundary、runtime hot path、IPC contract、state ownership、file splitを明示的なreview対象にする。
- Runtime PlayerはControl Windowとtransparent Stage Windowを分ける。
- Startup時は前回Runtime Exportを自動復元する。recent export listはfuture扱い。
- iFacialMocap接続はユーザーにhandshakeを意識させず、Connect操作に受信開始・可能ならhandshake送信・接続状態判定を集約する。

## 5. Next Questions

1. Runtime Export directoryの読み込み、raw RGBA texture upload、materialized graph renderingをどのpackage/app境界で実装するか。
2. iFacialMocapのnormalized tracking signalsを、Runtime Export内のparameterへどうmapping/calibrationするか。
3. Stage Windowのposition / size / always-on-top / click-throughをv0でどこまで扱うか。
4. Transparent Window実装のOS差分をどう扱うか。
5. iFacialMocap handshake送信に必要なiPhone IP入力を必須にするか、passive listen中心にするか。

## 6. Out of Scope For Current Research

- 自前face tracking modelの実装。
- iFacialMocap以外のadapter実装。
- OBS pluginやvirtual camera実装。
- Runtime Playerの実装計画。
