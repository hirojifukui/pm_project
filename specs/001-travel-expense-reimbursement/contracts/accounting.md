# 契約: 経理確定と支払用 CSV（Accounting）

経理担当・経理部長・経理部長の上位者が使う。認可は権限表に従う。

---

## 1. `GET /api/accounting/pending`

経理確定待ちの一覧。

**出力 (200)**:

```ts
{
  items: Array<{
    applicationNumber: string;
    applicantName: string;
    department: string;
    totalAmountYen: number;
    tripStartDate: string;
    tripEndDate: string;
    hasAllReceipts: boolean;
    isSelfOfApplicant: boolean;   // 本人申請フラグ
    requiredBy: "ACCOUNTANT" | "ACCOUNTING_DIRECTOR" |
                "ACCOUNTING_DIRECTOR_SUPERIOR";
  }>;
}
```

**制約**: 本人申請は本人の対象から除外し、経理部長の対象として現れる
（BR-009／FR-014）。

---

## 2. `POST /api/accounting/{applicationNumber}/finalize`

経理確定する。

**処理**:

- 認可: 権限表に従う。本人申請の除外を再確認。
- 業務ルール（BR-001〜BR-010）の最終確認を実行し、不備があれば 409 として対象を
  返す。
- 状態を `ACCOUNTING_FINALIZED` に遷移。
- 通知を申請者宛てに発行。

**出力 (200)**: `{ status: "ACCOUNTING_FINALIZED"; accountingFinalizedAt: string }`

---

## 3. `POST /api/accounting/{applicationNumber}/remand`

経理担当（経理部長・上位者）が差戻し。

**入力**: `{ comment: string }`（必須）

**出力 (200)**: `{ status: "REMANDED" }`

---

## 4. `POST /api/accounting/{applicationNumber}/undo`

経理確定を取り消して差戻しに戻す（FR-023）。経理担当のみ。

**入力**: `{ comment: string }`（必須）

**出力 (200)**: `{ status: "REMANDED" }`

---

## 5. `POST /api/accounting/exports`

支払用 CSV を出力する。

**入力**:

```ts
{
  cutoffDate: string;      // YYYY-MM-DD、省略時は当月25日
}
```

**処理**:

- `cutoffPaymentDate(cutoffDate, holidays)` で実効締め日・支払予定日（翌月10日）を算出
  （BR-011）。
- その締め日 23:59 までに `ACCOUNTING_FINALIZED` となった、かつ未 CSV の申請を集める
  （スナップショット）。
- 採用した会計システムのレイアウト（`PaymentCsvExport.layoutVersion` を参照）に
  従って列を組み、`./data/exports/<cutoffDate>-<layoutVersion>.csv` に書き出す。
- `ApprovalHistory` に `CSV_EXPORT` を 1 行追加（申請番号ごとではなく、代表として
  `applicationNumber=null` の仮想行として扱わない — 代わりに `PaymentCsvExport` 側に
  集約し、`ApprovalHistory` には対象申請ごとに `CSV_EXPORT` を記録する）。

**出力 (200)**:

```ts
{
  exportId: string;
  cutoffDate: string;
  paymentDate: string;
  rowCount: number;
  totalAmountYen: number;
  fileRelativePath: string;    // "./data/exports/..."
  layoutVersion: string;
}
```

**エラー**:

- 404: その締め日に対象申請なし。
- 409: 同じ締め日の未出力スナップショットが既に存在する（上書き確認が必要なら、
  クエリで `?force=true` を明示したときのみ 200）。

---

## 6. `GET /api/accounting/exports/{exportId}`

出力結果のスナップショットを取得（画面での履歴表示用）。

**出力 (200)**: `PaymentCsvExport` の属性と、含めた申請番号・金額の内訳。

---

## 7. CSV レイアウトの既定（最小列）

`layoutVersion = "default-v1"` の既定レイアウトは以下。経理担当・会計システム担当
からの受領後に `layoutVersion` を上げて差し替える。

| 列順 | 列名（ヘッダ、日本語） | 値 |
|------|------------------------|-----|
| 1 | 社員番号 | `Application.applicant.empNo` |
| 2 | 氏名 | `Application.applicant.name` |
| 3 | 申請番号 | `Application.applicationNumber` |
| 4 | 支払金額 | `Application.totalAmountYen` |
| 5 | 支払予定日 | `PaymentCsvExport.paymentDate`（YYYY-MM-DD） |

- 文字コード: UTF-8、改行: CRLF、BOM 無し。
- 金額に 3 桁区切りは入れない（整数のみ）。
- 1 行 = 1 申請。1 申請を複数行に分割するレイアウトを受領した場合は `layoutVersion`
  を切り替えて別定義として追加する。
