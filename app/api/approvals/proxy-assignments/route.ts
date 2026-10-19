import { NextRequest } from "next/server";
import { prisma } from "@/server/db/client";
import { withAuthenticated, respondCreated } from "@/server/http/handler";
import {
  BusinessRuleError,
  ForbiddenError,
  NotFoundError,
} from "@/server/errors/to-user-message";
import { ProxyAssignmentInput } from "@/domain/types";
import { newUlid } from "@/domain/id";
import { validateProxyAssignmentPeriod } from "@/domain/rules/BR-012.proxy-approver";
import { enqueueNotification } from "@/server/notifications/inbox";

// POST /api/approvals/proxy-assignments
// contracts/approvals.md § 4
export async function POST(req: NextRequest) {
  return withAuthenticated(async (user) => {
    if (user.role !== "SECTION_MANAGER") {
      // 代理指名を登録できるのは所属長本人のみ
      throw new ForbiddenError();
    }
    const body = ProxyAssignmentInput.parse(await req.json());
    const startsAt = new Date(body.startsAt);
    const endsAt = new Date(body.endsAt);
    if (
      Number.isNaN(startsAt.getTime()) ||
      Number.isNaN(endsAt.getTime())
    ) {
      throw new BusinessRuleError([
        {
          path: "startsAt",
          message: "開始日時・終了日時を正しく指定してください。",
        },
      ]);
    }

    const proxy = await prisma.employee.findUnique({
      where: { empNo: body.proxyEmpNo },
    });
    if (!proxy) throw new NotFoundError();
    if (proxy.empNo === user.empNo) {
      throw new BusinessRuleError([
        {
          path: "proxyEmpNo",
          message: "自分自身を代理承認者に指名することはできません。",
        },
      ]);
    }
    if (proxy.role !== "DIRECTOR") {
      throw new BusinessRuleError([
        {
          path: "proxyEmpNo",
          message:
            "代理承認者は部長のみ指名できます（BR-012）。",
          ruleId: "BR-012",
        },
      ]);
    }

    // 既存の指名を取得して重複判定
    const existing = await prisma.proxyApproverAssignment.findMany({
      where: { principalEmpNo: user.empNo },
      select: { startsAt: true, endsAt: true },
    });

    // 祝日カレンダー
    const holidays = await prisma.holiday.findMany({
      select: { date: true },
    });
    const calendar = new Set(
      holidays.map((h) => h.date.toISOString().slice(0, 10)),
    );

    const validation = validateProxyAssignmentPeriod({
      startsAt,
      endsAt,
      existing,
      calendar,
    });
    if (!validation.ok) {
      throw new BusinessRuleError([
        {
          path: "startsAt",
          message: validation.reason ?? "代理指名の期間が無効です。",
          ruleId: "BR-012",
        },
      ]);
    }

    const row = await prisma.proxyApproverAssignment.create({
      data: {
        id: newUlid(),
        principalEmpNo: user.empNo,
        proxyEmpNo: proxy.empNo,
        startsAt,
        endsAt,
        createdByEmpNo: user.empNo,
      },
      select: { id: true },
    });

    await enqueueNotification({
      recipientEmpNo: proxy.empNo,
      templateId: "PROXY_ASSIGNED",
      operation: "PROXY_ASSIGNED",
    });
    return respondCreated(row);
  });
}

export async function GET() {
  return withAuthenticated(async (user) => {
    const rows = await prisma.proxyApproverAssignment.findMany({
      where: { principalEmpNo: user.empNo },
      orderBy: { startsAt: "asc" },
      include: {
        proxy: { select: { empNo: true, name: true } },
      },
    });
    return {
      items: rows.map((r) => ({
        id: r.id,
        proxy: r.proxy,
        startsAt: r.startsAt.toISOString(),
        endsAt: r.endsAt.toISOString(),
      })),
    };
  });
}
