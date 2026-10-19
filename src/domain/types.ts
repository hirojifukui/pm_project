import { z } from "zod";

// 社員の職位ロール（権限表の列と一対一対応）
export const EmployeeRole = z.enum([
  "APPLICANT",
  "SECTION_MANAGER",
  "DIRECTOR",
  "ACCOUNTANT",
  "ACCOUNTING_DIRECTOR",
  "ACCOUNTING_DIRECTOR_SUPERIOR",
  "SYSTEM_ADMIN",
]);
export type EmployeeRole = z.infer<typeof EmployeeRole>;

export const RankKind = z.enum(["STAFF", "MANAGEMENT"]);
export type RankKind = z.infer<typeof RankKind>;

export const EmployeeStatus = z.enum(["ACTIVE", "SUSPENDED", "RETIRED"]);
export type EmployeeStatus = z.infer<typeof EmployeeStatus>;

// 旅費精算申請の状態遷移（data-model.md § 3）
export const ApplicationStatus = z.enum([
  "DRAFT",
  "SECTION_MANAGER_APPROVAL",
  "DIRECTOR_APPROVAL",
  "ACCOUNTING_DIRECTOR_APPROVAL",
  "ACCOUNTING_DIRECTOR_SUPERIOR_APPROVAL",
  "ACCOUNTING_REVIEW",
  "ACCOUNTING_FINALIZED",
  "REMANDED",
  "WITHDRAWN",
  "PAID",
]);
export type ApplicationStatus = z.infer<typeof ApplicationStatus>;

export const ExpenseCategory = z.enum([
  "TRANSPORT",
  "LODGING",
  "PER_DIEM",
  "OTHER",
]);
export type ExpenseCategory = z.infer<typeof ExpenseCategory>;

export const TransportMode = z.enum([
  "TRAIN",
  "SHINKANSEN",
  "BUS",
  "TAXI",
  "FLIGHT",
  "OTHER",
]);
export type TransportMode = z.infer<typeof TransportMode>;

export const TaxiReason = z.enum([
  "AFTER_22",
  "HEAVY_LUGGAGE",
  "CUSTOMER_RIDE",
]);
export type TaxiReason = z.infer<typeof TaxiReason>;

export const ApprovalOperation = z.enum([
  "SUBMIT",
  "APPROVE",
  "REMAND",
  "ACCOUNTING_FINALIZE",
  "ACCOUNTING_REMAND",
  "ACCOUNTING_UNDO",
  "WITHDRAW",
  "CSV_EXPORT",
]);
export type ApprovalOperation = z.infer<typeof ApprovalOperation>;

export const ActedAs = z.enum(["SELF", "PROXY"]);
export type ActedAs = z.infer<typeof ActedAs>;

export const NotificationChannel = z.enum(["EMAIL", "IN_APP"]);
export type NotificationChannel = z.infer<typeof NotificationChannel>;

export const NotificationDeliveryStatus = z.enum([
  "PENDING",
  "SENT",
  "FAILED",
]);
export type NotificationDeliveryStatus = z.infer<
  typeof NotificationDeliveryStatus
>;

export const NotificationTemplateId = z.enum([
  "SUBMITTED_TO_APPROVER",
  "SUBMITTED_SELF_CONFIRM",
  "APPROVED_TO_APPLICANT",
  "APPROVED_TO_NEXT_APPROVER",
  "REMANDED_TO_APPLICANT",
  "ACCOUNTING_FINALIZED_TO_APPLICANT",
  "ACCOUNTING_REMAND_TO_APPLICANT",
  "CSV_EXPORTED_TO_ACCOUNTING",
  "HR_IMPORT_FAILED_TO_ADMIN",
  "HR_IMPORT_FAILED_TO_ACCOUNTING",
  "PROXY_ASSIGNED",
  "WITHDRAWN_SELF_CONFIRM",
]);
export type NotificationTemplateId = z.infer<typeof NotificationTemplateId>;

export const HrImportStatus = z.enum(["SUCCESS", "PARTIAL", "FAILED"]);
export type HrImportStatus = z.infer<typeof HrImportStatus>;

export const HrImportErrorKind = z.enum([
  "NONE",
  "FILE_MISSING",
  "FORMAT_INVALID",
  "COLUMN_MISSING",
  "ROW_ERRORS",
]);
export type HrImportErrorKind = z.infer<typeof HrImportErrorKind>;

export const PiiAccessReason = z.enum([
  "APPROVAL",
  "ACCOUNTING",
  "AUDIT",
  "ADMIN_LOOKUP",
]);
export type PiiAccessReason = z.infer<typeof PiiAccessReason>;

// 権限表の操作キー（spec.md § 業務要件 > 権限 と対応）
export const AuthorizedOperation = z.enum([
  "CREATE_OWN_APPLICATION",
  "SUBMIT_OWN_APPLICATION",
  "WITHDRAW_OWN_APPLICATION",
  "VIEW_SUBORDINATE_APPLICATION",
  "VIEW_OTHER_DEPARTMENT_APPLICATION",
  "APPROVE_OR_REMAND",
  "ACCOUNTING_FINALIZE_OR_REMAND",
  "EXPORT_PAYMENT_CSV",
  "MANAGE_EMPLOYEE_OR_RULE",
]);
export type AuthorizedOperation = z.infer<typeof AuthorizedOperation>;

// 業務上の規程値キー
export const RuleKey = z.enum([
  "PER_DIEM_STAFF_LODGING",
  "PER_DIEM_MANAGEMENT_LODGING",
  "PER_DIEM_DAY_TRIP",
  "LODGING_CAP_STANDARD",
  "LODGING_CAP_METRO",
  "METRO_PREFECTURE_CODES",
  "RECEIPT_REQUIRED_THRESHOLD",
  "DEADLINE_DAYS",
  "DIRECTOR_APPROVAL_THRESHOLD",
  "TRAIN_LIMITED_EXPRESS_RECEIPT_WAIVED",
  "ECONOMICAL_LIMITED_EXPRESS_MIN_KM",
]);
export type RuleKey = z.infer<typeof RuleKey>;

// 画面入力の基本 Zod スキーマ
export const DraftInput = z.object({
  tripStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  tripEndDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  destination: z.string().min(1),
  purpose: z.string().min(1),
});
export type DraftInput = z.infer<typeof DraftInput>;

export const ExpenseLineInput = z
  .object({
    id: z.string().optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    category: ExpenseCategory,
    fromPlace: z.string().optional(),
    toPlace: z.string().optional(),
    transportMode: TransportMode.optional(),
    amountYen: z.number().int().nonnegative(),
    taxiReasons: z.array(TaxiReason).optional(),
    exceedsLodgingCapReason: z.string().optional(),
    remarks: z.string().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.category === "TRANSPORT") {
      if (!val.fromPlace || !val.toPlace || !val.transportMode) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "交通費の明細では出発地・到着地・交通手段を入力してください",
        });
      }
    }
    if (val.transportMode === "TAXI") {
      if (!val.taxiReasons || val.taxiReasons.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["taxiReasons"],
          message:
            "タクシーの明細では例外事由（22:00 以降／荷物 15kg 以上／顧客と同乗）を 1 件以上選んでください",
        });
      }
    }
  });
export type ExpenseLineInput = z.infer<typeof ExpenseLineInput>;

export const SubmitInput = z.object({
  lateReason: z.string().optional(),
});
export type SubmitInput = z.infer<typeof SubmitInput>;

export const CommentInput = z.object({
  comment: z.string().min(1, "コメントを入力してください"),
});
export type CommentInput = z.infer<typeof CommentInput>;

export const ProxyAssignmentInput = z.object({
  proxyEmpNo: z.string().min(1),
  startsAt: z.string(),
  endsAt: z.string(),
});
export type ProxyAssignmentInput = z.infer<typeof ProxyAssignmentInput>;

export const CsvExportInput = z.object({
  cutoffDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  force: z.boolean().optional(),
});
export type CsvExportInput = z.infer<typeof CsvExportInput>;
