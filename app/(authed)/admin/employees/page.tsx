"use client";
import { useEffect, useState } from "react";
import { ja } from "@/i18n/ja";

type Employee = {
  empNo: string;
  name: string;
  email: string;
  department: string;
  rankKind: string;
  role: string;
  sectionManagerEmpNo: string | null;
  status: string;
};

export default function AdminEmployeesPage() {
  const [items, setItems] = useState<Employee[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/admin/employees");
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(data.error ?? ja.message.serverError);
          return;
        }
        setItems(data.items ?? []);
      } catch {
        if (!cancelled) setError(ja.message.serverError);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="max-w-4xl mx-auto p-6">
      <h1 className="text-xl font-bold mb-3">社員情報</h1>
      {error ? (
        <p className="text-red-700">{error}</p>
      ) : items.length === 0 ? (
        <p className="text-gray-600">社員情報はありません。</p>
      ) : (
        <table className="w-full text-sm border">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-2">社員番号</th>
              <th className="text-left p-2">氏名</th>
              <th className="text-left p-2">所属</th>
              <th className="text-left p-2">役職区分</th>
              <th className="text-left p-2">職位ロール</th>
              <th className="text-left p-2">所属長</th>
              <th className="text-left p-2">在籍</th>
            </tr>
          </thead>
          <tbody>
            {items.map((e) => (
              <tr key={e.empNo} className="border-t">
                <td className="p-2 font-mono">{e.empNo}</td>
                <td className="p-2">{e.name}</td>
                <td className="p-2">{e.department}</td>
                <td className="p-2">
                  {e.rankKind === "MANAGEMENT"
                    ? ja.label.rankKindManagement
                    : ja.label.rankKindStaff}
                </td>
                <td className="p-2">
                  {ja.role[e.role as keyof typeof ja.role] ?? e.role}
                </td>
                <td className="p-2 font-mono">
                  {e.sectionManagerEmpNo ?? "—"}
                </td>
                <td className="p-2">{e.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
