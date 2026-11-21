# security-portal

講義ポータル（セキュリティニュース・講義概要・プレゼン資料・テスト演習環境 Virtual Automotive Test Lab へのリンク）。
既存の `suetaketakaya.com` とは独立した Firebase プロジェクト `security-portal-c3fd4`（表示名 `security-portal`）にデプロイする。
同じプロジェクトの別サイト `vatl-lab` には、`zoopass/` の VATL-100 エミュレーターを置いている。

| 項目 | 値 |
| --- | --- |
| Firebase プロジェクト | `security-portal-c3fd4` |
| Hosting | https://security-portal-c3fd4.web.app（デフォルトサイト） |
| 独自ドメイン | `security.suetaketakaya.com`（未設定） |

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
4. `firebase serve --only hosting` でローカル確認
5. `firebase deploy --only hosting --project security-portal-c3fd4`

プロジェクトは作成済み（`.firebaserc` の `default` は `security-portal-c3fd4`）。
`--project` を付けているのは、CLI 側で別のプロジェクトが選ばれていても誤ってデプロイしないため。

## 独自ドメイン

Firebaseコンソール → Hosting → 「カスタムドメインを追加」で `security.suetaketakaya.com` を登録し、
表示された TXT / A レコードを DNS に追加する。既存の `suetaketakaya.com` のレコードは変更しない。
