"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ja } from "@/i18n/ja";

type ApplicationItem = {
  applicationNumber: string;
  tripStartDate: string;
  tripEndDate: string;
  totalAmountYen: number;
  status: keyof typeof ja.status;
  submittedAt: string | null;
  nextApprover: { empNo: string; name: string } | null;
};

export default function MyApplicationsPage() {
  const [items, setItems] = useState<ApplicationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/applications/mine");
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? ja.message.serverError);
          return;
        }
        setItems(data.items ?? []);
      } catch {
        setError(ja.message.serverError);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <main className="max-w-3xl mx-auto p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">自分の旅費精算申請</h1>
        <Link
          href="/applications/new"
          className="px-3 py-1 bg-blue-600 text-white rounded"
        >
          新規の申請を作る
        </Link>
      </div>
      {loading ? (
        <p>読み込み中…</p>
      ) : error ? (
        <p className="text-red-700">{error}</p>
      ) : items.length === 0 ? (
        <p className="text-gray-600">申請はまだありません。</p>
      ) : (
        <ul className="divide-y border rounded">
          {items.map((a) => (
            <li key={a.applicationNumber} className="p-3">
              <Link
                href={`/applications/by-number/${a.applicationNumber}`}
                className="block hover:bg-gray-50"
              >
                <div className="flex justify-between">
                  <span className="font-mono text-sm">
                    {a.applicationNumber}
                  </span>
                  <span className="text-sm text-gray-600">
                    {ja.status[a.status] ?? a.status}
                  </span>
                </div>
                <div className="text-sm">
                  {a.tripStartDate} 〜 {a.tripEndDate}（合計 {a.totalAmountYen.toLocaleString()} 円）
                </div>
                {a.nextApprover ? (
                  <div className="text-xs text-gray-600">
                    {ja.label.nextApprover}: {a.nextApprover.name}
                  </div>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
