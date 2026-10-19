"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ja } from "@/i18n/ja";

type PendingItem = {
  applicationNumber: string;
  applicantName: string;
  department: string;
  tripStartDate: string;
  tripEndDate: string;
  totalAmountYen: number;
  submittedAt: string;
  isLate: boolean;
  requiredBy: string;
  actedAs: "SELF" | "PROXY";
};

export default function ApprovalsPage() {
  const [items, setItems] = useState<PendingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/approvals/pending");
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(data.error ?? ja.message.serverError);
          return;
        }
        setItems(data.items ?? []);
      } catch {
        if (!cancelled) setError(ja.message.serverError);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="max-w-3xl mx-auto p-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold">{ja.nav.approvals}</h1>
        <Link
          href="/approvals/proxy-assignments"
          className="text-sm underline"
        >
          代理承認の指名
        </Link>
      </div>
      {loading ? (
        <p>読み込み中…</p>
      ) : error ? (
        <p className="text-red-700">{error}</p>
      ) : items.length === 0 ? (
        <p className="text-gray-600">承認待ちの申請はありません。</p>
      ) : (
        <ul className="divide-y border rounded">
          {items.map((it) => (
            <li key={it.applicationNumber} className="p-3">
              <Link
                className="block hover:bg-gray-50"
                href={`/approvals/${it.applicationNumber}`}
              >
                <div className="flex justify-between">
                  <span className="font-mono text-sm">
                    {it.applicationNumber}
                  </span>
                  <span className="text-xs text-gray-500">
                    {it.requiredBy}
                    {it.actedAs === "PROXY" ? "（代理）" : ""}
                    {it.isLate ? "・遅延" : ""}
                  </span>
                </div>
                <div className="text-sm">
                  {it.applicantName}（{it.department}） ／ {it.tripStartDate}〜{it.tripEndDate} ／ 合計 {it.totalAmountYen.toLocaleString()} 円
                </div>
                <div className="text-xs text-gray-600">
                  提出: {new Date(it.submittedAt).toLocaleString("ja-JP")}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
