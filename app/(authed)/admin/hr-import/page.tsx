"use client";
import { useEffect, useState } from "react";
import { ja } from "@/i18n/ja";

type HistoryItem = {
  id: string;
  importedBy: string;
  sourceFileName: string;
  status: string;
  errorKind: string;
  rowCount: number;
  errorRows: Array<{ lineNumber: number; empNo?: string; reason: string }>;
  startedAt: string;
  finishedAt: string | null;
};

export default function AdminHrImportPage() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const load = async () => {
    const res = await fetch("/api/admin/hr-import/history");
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? ja.message.serverError);
      return;
    }
    setItems(data.items ?? []);
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/admin/hr-import/history");
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

  const upload = async (file: File) => {
    setError(null);
    setInfo(null);
    setUploading(true);
    try {
      const form = new FormData();
      form.set("file", file);
      const res = await fetch("/api/admin/hr-import", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? ja.message.serverError);
        return;
      }
      setInfo(
        `取込結果: ${data.status}（${data.rowCount} 件適用、エラー ${data.errorRows?.length ?? 0} 件）`,
      );
      await load();
    } finally {
      setUploading(false);
    }
  };

  return (
    <main className="max-w-3xl mx-auto p-6">
      <h1 className="text-xl font-bold mb-3">人事情報の取込</h1>
      <p className="text-xs text-gray-600 mb-4">
        期待列: empNo, name, email, department, rankKind, role, sectionManagerEmpNo, status, effectiveFrom
      </p>
      {error ? (
        <div className="text-sm text-red-700 border border-red-200 bg-red-50 p-3 mb-3 rounded">
          {error}
        </div>
      ) : null}
      {info ? (
        <div className="text-sm text-green-700 border border-green-200 bg-green-50 p-3 mb-3 rounded">
          {info}
        </div>
      ) : null}
      <section className="border rounded p-3 mb-6">
        <input
          type="file"
          accept=".csv,text/csv"
          disabled={uploading}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload(f);
          }}
        />
      </section>

      <h2 className="font-bold mb-2 text-sm">取込履歴</h2>
      {items.length === 0 ? (
        <p className="text-gray-600 text-sm">取込履歴はありません。</p>
      ) : (
        <ul className="divide-y border rounded">
          {items.map((h) => (
            <li key={h.id} className="p-3 text-sm">
              <div className="flex justify-between">
                <span className="font-mono text-xs">{h.id}</span>
                <span
                  className={`text-xs ${
                    h.status === "SUCCESS"
                      ? "text-green-700"
                      : h.status === "PARTIAL"
                        ? "text-amber-700"
                        : "text-red-700"
                  }`}
                >
                  {h.status}
                </span>
              </div>
              <div>
                {h.sourceFileName}（{h.rowCount} 件適用、分類: {h.errorKind}）
              </div>
              <div className="text-xs text-gray-500">
                取込者: {h.importedBy}（{new Date(h.startedAt).toLocaleString("ja-JP")}）
              </div>
              {h.errorRows.length > 0 ? (
                <details className="mt-1">
                  <summary className="text-xs text-red-700 cursor-pointer">
                    エラー行 {h.errorRows.length} 件
                  </summary>
                  <ul className="text-xs ml-4 list-disc">
                    {h.errorRows.map((e, i) => (
                      <li key={i}>
                        {e.lineNumber} 行目
                        {e.empNo ? `（${e.empNo}）` : ""}: {e.reason}
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
