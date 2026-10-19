// 既定の社員と規程値を SQLite に投入するシード（T016）。
// quickstart.md § 5 に対応する初期データ。

import { PrismaClient } from "@prisma/client";
import { DEFAULT_HOLIDAYS_2026 } from "../../domain/holidays";

const prisma = new PrismaClient();

const ADMIN_EMP_NO = "E9000";
const FROM_DATE = new Date("2026-01-01T00:00:00.000Z");

const EMPLOYEES = [
  {
    empNo: "E0001",
    name: "山田 太郎",
    email: "yamada.taro@example.invalid",
    department: "営業部",
    rankKind: "STAFF",
    role: "APPLICANT",
    sectionManagerEmpNo: "E0010",
  },
  {
    empNo: "E0010",
    name: "鈴木 花子",
    email: "suzuki.hanako@example.invalid",
    department: "営業部",
    rankKind: "MANAGEMENT",
    role: "SECTION_MANAGER",
    sectionManagerEmpNo: "E0020",
  },
  {
    empNo: "E0020",
    name: "佐藤 次郎",
    email: "sato.jiro@example.invalid",
    department: "営業部",
    rankKind: "MANAGEMENT",
    role: "DIRECTOR",
    sectionManagerEmpNo: null,
  },
  {
    empNo: "E0030",
    name: "高橋 三郎",
    email: "takahashi.saburo@example.invalid",
    department: "経理部",
    rankKind: "STAFF",
    role: "ACCOUNTANT",
    sectionManagerEmpNo: "E0040",
  },
  {
    empNo: "E0040",
    name: "田中 四郎",
    email: "tanaka.shiro@example.invalid",
    department: "経理部",
    rankKind: "MANAGEMENT",
    role: "ACCOUNTING_DIRECTOR",
    sectionManagerEmpNo: "E0050",
  },
  {
    empNo: "E0050",
    name: "伊藤 五郎",
    email: "ito.goro@example.invalid",
    department: "経営企画部",
    rankKind: "MANAGEMENT",
    role: "ACCOUNTING_DIRECTOR_SUPERIOR",
    sectionManagerEmpNo: null,
  },
  {
    empNo: "E9000",
    name: "管理者",
    email: "admin@example.invalid",
    department: "経理部",
    rankKind: "MANAGEMENT",
    role: "SYSTEM_ADMIN",
    sectionManagerEmpNo: null,
  },
];

const RULE_VALUES: Array<{ key: string; value: string; reason: string }> = [
  { key: "PER_DIEM_STAFF_LODGING", value: "2000", reason: "初期シード" },
  { key: "PER_DIEM_MANAGEMENT_LODGING", value: "2500", reason: "初期シード" },
  { key: "PER_DIEM_DAY_TRIP", value: "1000", reason: "初期シード" },
  { key: "LODGING_CAP_STANDARD", value: "10000", reason: "初期シード" },
  { key: "LODGING_CAP_METRO", value: "12000", reason: "初期シード" },
  {
    key: "METRO_PREFECTURE_CODES",
    value: JSON.stringify(["13", "27"]),
    reason: "東京都（13）・大阪府（27）を既定",
  },
  { key: "RECEIPT_REQUIRED_THRESHOLD", value: "3000", reason: "初期シード" },
  { key: "DEADLINE_DAYS", value: "30", reason: "初期シード" },
  {
    key: "DIRECTOR_APPROVAL_THRESHOLD",
    value: "100000",
    reason: "初期シード",
  },
  {
    key: "TRAIN_LIMITED_EXPRESS_RECEIPT_WAIVED",
    value: "true",
    reason: "初期シード（R-06 の既定を踏襲）",
  },
  {
    key: "ECONOMICAL_LIMITED_EXPRESS_MIN_KM",
    value: "100",
    reason: "初期シード",
  },
];

async function main() {
  // 1) 社員（管理者 → 上位者 → 部長 → 経理部長 → 所属長 → 経理担当 → 一般社員の順で upsert）
  const order = [
    "E9000",
    "E0050",
    "E0020",
    "E0040",
    "E0010",
    "E0030",
    "E0001",
  ];
  for (const empNo of order) {
    const row = EMPLOYEES.find((e) => e.empNo === empNo);
    if (!row) continue;
    await prisma.employee.upsert({
      where: { empNo: row.empNo },
      create: {
        empNo: row.empNo,
        name: row.name,
        email: row.email,
        department: row.department,
        rankKind: row.rankKind,
        role: row.role,
        sectionManagerEmpNo: row.sectionManagerEmpNo,
        status: "ACTIVE",
        effectiveFrom: FROM_DATE,
      },
      update: {
        name: row.name,
        email: row.email,
        department: row.department,
        rankKind: row.rankKind,
        role: row.role,
        sectionManagerEmpNo: row.sectionManagerEmpNo,
        status: "ACTIVE",
      },
    });
  }

  // 2) 規程値
  for (const rv of RULE_VALUES) {
    await prisma.ruleValue.upsert({
      where: {
        ruleKey_effectiveFrom: {
          ruleKey: rv.key,
          effectiveFrom: FROM_DATE,
        },
      },
      create: {
        ruleKey: rv.key,
        effectiveFrom: FROM_DATE,
        value: rv.value,
        changedByEmpNo: ADMIN_EMP_NO,
        changeReason: rv.reason,
      },
      update: {
        value: rv.value,
        changedByEmpNo: ADMIN_EMP_NO,
        changeReason: rv.reason,
      },
    });
  }

  // 3) 祝日（2026 年）
  for (const h of DEFAULT_HOLIDAYS_2026) {
    const date = new Date(`${h.date}T00:00:00.000Z`);
    await prisma.holiday.upsert({
      where: { date },
      create: {
        date,
        name: h.name,
        addedByEmpNo: ADMIN_EMP_NO,
      },
      update: { name: h.name },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.warn("[seed] 完了: 社員 7 名、規程値、2026 年祝日を投入しました。");
  })
  .catch(async (err) => {
    await prisma.$disconnect();
    console.error("[seed] 失敗:", err);
    process.exitCode = 1;
  });
