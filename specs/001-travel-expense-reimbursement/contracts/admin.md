# 契約: 社員・規程値・人事取込・認証（Admin / Auth）

システム管理者が使う運用機能、および全ロールが使う認証エンドポイント。

---

## 1. 認証

本機能のローカル実装は「利用者切替の簡易ログイン」。本番 SSO 連携時は、同じ関数
境界（`getCurrentUser()`）で実装を差し替える。

### 1.1 `GET /api/auth/switchable-users`

簡易ログイン画面に表示する、切替可能な利用者の一覧。

**出力 (200)**:

```ts
{
  items: Array<{
    empNo: string;
    name: string;
    department: string;
    role: EmployeeRole;
  }>;
}
```

**注意**: 本エンドポイントは **ローカル実装でのみ** 有効。本番展開時には SSO の
戻り値から得た識別子を使うため、本エンドポイントは無効化する（`sso-login.ts` へ
差し替える）。

### 1.2 `POST /api/auth/login`

**入力**: `{ empNo: string }`

**処理**: 社員情報を取り出し、`iron-session` に `empNo` を保存。クッキーは
`HttpOnly`, `SameSite=Lax`, `Secure` は `NODE_ENV=production` のときのみ付与。

**出力 (200)**: `{ empNo: string; name: string; role: EmployeeRole }`

**エラー**: 404（社員情報なし）、403（`status != ACTIVE`）。

### 1.3 `POST /api/auth/logout`

**出力 (200)**: `{ ok: true }`

### 1.4 `GET /api/auth/me`

現在のログイン利用者を返す。未ログイン時は 401。

**出力 (200)**:

```ts
{
  empNo: string;
  name: string;
  role: EmployeeRole;
  department: string;
}
```

---

## 2. 社員・規程値の管理（システム管理者のみ）

### 2.1 `GET /api/admin/employees`

**出力 (200)**: `Employee` の一覧（PII を含むため、画面表示用途のみ）。

### 2.2 `POST /api/admin/employees`

社員情報の追加（通常は人事 CSV 取込で入るが、個別追加・経理部長の上位者の登録用）。

**入力**: `Employee` の属性（`createdAt`／`updatedAt` を除く）。

**出力 (201)**: `{ empNo: string }`

### 2.3 `PUT /api/admin/employees/{empNo}`

職位ロールや所属長の変更。

**入力**: `role`、`sectionManagerEmpNo`、`status`、`effectiveFrom` の更新対象。

**出力 (200)**: 更新後の `Employee`。

### 2.4 `GET /api/admin/rules`

**出力 (200)**: `RuleValue` の一覧（キーごとに最新順）。

### 2.5 `POST /api/admin/rules`

**入力**:

```ts
{
  ruleKey: string;
  value: string;
  effectiveFrom: string;    // YYYY-MM-DD
  changeReason: string;
}
```

**出力 (201)**: `{ ruleKey: string; effectiveFrom: string }`

---

## 3. 人事 CSV 取込

### 3.1 `POST /api/admin/hr-import`

`multipart/form-data` で CSV を受け取り、FR-032 の順序で処理する。

**入力フィールド**: `file`（UTF-8 BOM 可、CRLF／LF 可）、`forceRecover: boolean`
（任意、取込失敗後の再実行時に使う）。

**処理**:

1. `errorKind` の判定（`FILE_MISSING`／`FORMAT_INVALID`／`COLUMN_MISSING`／
   `ROW_ERRORS`）。
2. 必須列が揃い、行単位エラーがなければ `SUCCESS`。社員情報を upsert し、関連する
   `nextApproverEmpNo` を再計算する（所属長の変更が反映されるように）。
3. 行単位エラーがある場合は `PARTIAL` として、正常行だけ適用し、エラー行を
   `HrImportResult.errorRows` に記録する。
4. ファイル未着・形式不備は `FAILED` として記録し、既存データは一切変更しない。
5. 失敗・部分失敗時は、システム管理者と経理担当に通知（Notifications 契約の
   `HR_IMPORT_FAILED_TO_*`）。

**出力 (200)**:

```ts
{
  id: string;
  status: "SUCCESS" | "PARTIAL" | "FAILED";
  errorKind: "FILE_MISSING" | "FORMAT_INVALID" | "COLUMN_MISSING" |
             "ROW_ERRORS" | "NONE";
  rowCount: number;
  errorRows: Array<{
    lineNumber: number;
    empNo?: string;
    reason: string;        // 日本語
  }>;
}
```

### 3.2 `GET /api/admin/hr-import/history`

直近の取込結果の履歴。

### 3.3 `POST /api/admin/hr-import/retry/{id}`

失敗した取込を同じファイルで再実行する（システム管理者のみ）。

---

## 4. PII アクセスログの参照（監査）

### 4.1 `GET /api/admin/pii-access-log`

**出力 (200)**: `PiiAccessLog` の一覧。システム管理者のみ閲覧可。本エンドポイント
自体の呼び出しも `PiiAccessLog` に `reasonCode = AUDIT` として記録する。
