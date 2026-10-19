"use client";
import { useEffect, useState } from "react";
import { ja } from "@/i18n/ja";

type LogItem = {
  id: string;
  accessor: { empNo: string; name: string };
  target: { empNo: string; name: string } | null;
  applicationNumber: string | null;
  reasonCode: string;
  freeNote: string | null;
  occurredAt: string;
};

export default function AdminPiiAccessLogPage() {
  const [items, setItems] = useState<LogItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/admin/pii-access-log");
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
      <h1 className="text-xl font-bold mb-3">PII アクセスログ</h1>
      <p className="text-xs text-gray-600 mb-3">
        個人情報を直接表示する画面・API ハンドラの先頭で記録されたログを表示します。本画面を開くこと自体も監査対象です。
      </p>
      {error ? (
        <p className="text-red-700">{error}</p>
      ) : items.length === 0 ? (
        <p className="text-gray-600 text-sm">ログはありません。</p>
      ) : (
        <table className="w-full text-sm border">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-2">日時</th>
              <th className="text-left p-2">参照者</th>
              <th className="text-left p-2">対象</th>
              <th className="text-left p-2">申請番号</th>
              <th className="text-left p-2">理由区分</th>
              <th className="text-left p-2">備考</th>
            </tr>
          </thead>
          <tbody>
            {items.map((l) => (
              <tr key={l.id} className="border-t">
                <td className="p-2">
                  {new Date(l.occurredAt).toLocaleString("ja-JP")}
                </td>
                <td className="p-2">
                  {l.accessor.name}（{l.accessor.empNo}）
                </td>
                <td className="p-2">
                  {l.target
                    ? `${l.target.name}（${l.target.empNo}）`
                    : "—"}
                </td>
                <td className="p-2 font-mono text-xs">
                  {l.applicationNumber ?? "—"}
                </td>
                <td className="p-2">{l.reasonCode}</td>
                <td className="p-2 text-xs">{l.freeNote ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
