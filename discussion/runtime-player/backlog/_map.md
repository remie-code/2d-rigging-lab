# Runtime Player Backlog Map

> Runtime Playerで後から実行すべきタスク、延期されたリスク、将来wave候補の入口地図。

## 1. Scope

この階層は、Runtime Player文脈で「今は実装しないが、後で必ず検討または実行する必要があること」を管理する。

ここには詳細な設計判断そのものではなく、後続planning-gateへ渡すためのタスク入口を置く。判断の根拠や設計詳細は `architecture/`、実装結果は `implementation/`、外部仕様調査は `research/` に置く。

## 2. Files

| Path | Status | Content |
|---|---|---|
| [runtime-player-backlog.md](runtime-player-backlog.md) | Active | Runtime Playerの延期タスク、技術的負債、将来wave候補の一覧 |

## 3. Backlog Categories

- Architecture debt: 今は短期対応で進めるが、長期的には構造を変えるべきもの。
- Runtime verification: 実物Runtime Exportや実環境で確認すべきもの。
- Future UX / feature: 次以降のRuntime Player UXとして検討するもの。
- Platform risk: OS、Electron、OBS capture、透明windowなど環境差分があるもの。

## 4. How To Use

1. `runtime-player-backlog.md` で該当項目を探す。
2. 各項目の `Source` を読んで、なぜそのタスクが残っているか確認する。
3. `Trigger` に該当する状況なら、planning-gateで次wave候補にする。
4. 実装waveに移したら、項目のstatusを `Planned` / `In progress` / `Done` / `Superseded` のいずれかへ更新する。

