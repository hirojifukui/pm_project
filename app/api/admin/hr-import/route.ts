import { NextRequest } from "next/server";
import { withAuthenticated } from "@/server/http/handler";
import { authorize } from "@/server/auth/authorize";
import { BusinessRuleError } from "@/server/errors/to-user-message";
import { runHrImport } from "@/server/csv/hr-import";

// POST /api/admin/hr-import
// contracts/admin.md § 3.1、FR-032
export async function POST(req: NextRequest) {
  return withAuthenticated(async (user) => {
    authorize({ operation: "MANAGE_EMPLOYEE_OR_RULE", user });
    const form = await req.formData();
    const file = form.get("file");
    const fileName =
      file instanceof File ? file.name : "unknown.csv";
    if (!(file instanceof File)) {
      // ファイル未着として記録。runHrImport が FILE_MISSING を返す。
      const result = await runHrImport({
        importedByEmpNo: user.empNo,
        sourceFileName: fileName,
        fileContent: null,
      });
      return result;
    }
    const text = await file.text();
    if (text.length === 0) {
      throw new BusinessRuleError([
        { path: "file", message: "空の CSV ファイルは取り込めません。" },
      ]);
    }
    const result = await runHrImport({
      importedByEmpNo: user.empNo,
      sourceFileName: fileName,
      fileContent: text,
    });
    return result;
  });
}
