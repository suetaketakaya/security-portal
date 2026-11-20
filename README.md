# security-portal

職場懇談会向け「Virtual Automotive Test Lab」（車載器テスト設計ワークショップ）。
既存の演習アプリ ZooPass を土台に、仮想車載器シミュレーターへ改変する（作業中）。

| フォルダ | 内容 | 公開 |
| --- | --- | --- |
| [`portal/`](portal/README.md) | ワークショップの案内ポータル | Firebase Hosting（`security-portal-c3fd4`） |
| [`zoopass/`](zoopass/README.md) | 改変元の Web アプリ（ZooPass） | Firebase Hosting / Auth / Firestore |
| `docs/` | 設計書（作成予定） | — |

各フォルダは独立した Firebase 設定を持つ。デプロイはそれぞれのフォルダで実行する。
