# security-portal

講義ポータル（セキュリティニュース・講義概要・プレゼン資料・ZooPassへのリンク）。
既存の `suetaketakaya.com` とは独立した Firebase プロジェクト `security-portal` にデプロイする。

| 項目 | 値 |
| --- | --- |
| Firebase プロジェクト | `security-portal` |
| Hosting | `security-portal.web.app` |
| 独自ドメイン | `security.suetaketakaya.com` |

## 構成

```
public/
  index.html     トップページ
  404.html
  css/style.css
  slides/        プレゼン資料（PDF等）を配置
firebase.json    Hosting設定（セキュリティヘッダー含む）
.firebaserc      プロジェクトID
```

## 初回セットアップ

1. Node.js (LTS) をインストール
2. `npm install -g firebase-tools`
3. `firebase login`
4. Firebaseコンソールでプロジェクト `security-portal` を作成
   （IDが取られていた場合は `.firebaserc` の `default` を実際のIDに変更）
5. `firebase serve --only hosting` でローカル確認
6. `firebase deploy --only hosting`

## 独自ドメイン

Firebaseコンソール → Hosting → 「カスタムドメインを追加」で `security.suetaketakaya.com` を登録し、
表示された TXT / A レコードを DNS に追加する。既存の `suetaketakaya.com` のレコードは変更しない。
