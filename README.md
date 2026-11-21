# security-portal

セキュリティ講義・ワークショップ用の Web 一式。講義ポータルと、車載器テスト設計ワークショップ「**Virtual Automotive Test Lab**」のエミュレーターを1つのリポジトリで管理する。

## 構成

| フォルダ | 内容 | 公開先 |
| --- | --- | --- |
| [`portal/`](portal/README.md) | 講義ポータル（ニュース・講義概要・資料へのリンク） | Firebase Hosting（プロジェクト `security-portal-c3fd4`） |
| [`zoopass/`](zoopass/README.md) | 車載インフォテインメント VATL-100（架空）のエミュレーターと仕様書。旧 ZooPass（入園予約アプリ）を書き換えたもの | Firebase Hosting（プロジェクト `security-portal-c3fd4` のサイト `vatl-lab`） |

```
security-portal/
├── portal/              講義ポータル（静的サイト、ビルド不要）
│   ├── public/          index.html / 404.html / css
│   ├── firebase.json    Hosting 設定（セキュリティヘッダー含む）
│   └── .firebaserc
└── zoopass/             VATL-100 エミュレーター（静的サイト、ビルド不要）
    ├── frontend/public/ エミュレーター（/）と仕様書（/spec）
    ├── tests/           動作モデルのテスト（node --test）
    ├── firebase.json
    └── .firebaserc
```

2つのフォルダは同じ Firebase プロジェクト `security-portal-c3fd4` を使い、Hosting のサイトを分けている（portal はデフォルトサイト、zoopass はサイト `vatl-lab`）。コマンドはそれぞれのフォルダに移動してから実行する。

## 必要なもの

- Node.js（LTS）
- Firebase CLI：`npm install -g firebase-tools` → `firebase login`
- Firebase は無料の **Spark プラン** のままで動く

## クイックスタート

### portal

```powershell
cd portal
firebase serve --only hosting      # ローカル確認
firebase deploy --only hosting     # デプロイ
```

### zoopass（VATL-100 エミュレーター）

```powershell
cd zoopass
firebase emulators:start --only hosting    # ローカル実行（http://localhost:5000）
cd tests; npm test; cd ..                  # テスト
firebase deploy --only hosting             # デプロイ
```

ワークショップの進め方と機能の一覧は [`zoopass/README.md`](zoopass/README.md) を参照。

## セキュリティ方針

- 両サイトとも `firebase.json` で CSP・HSTS・`X-Frame-Options` などのセキュリティヘッダーを設定
- 画面への出力は `textContent` だけを使い、`innerHTML` は使わない
- `.env` や Firebase のエクスポートデータ、講師用の解答（`zoopass/instructor/`）は `.gitignore` でコミット対象外

## 公開URL

| サイト | URL |
| --- | --- |
| portal | https://security-portal-c3fd4.web.app（独自ドメイン `security.suetaketakaya.com` は設定予定） |
| zoopass（VATL-100） | https://vatl-lab.web.app |
