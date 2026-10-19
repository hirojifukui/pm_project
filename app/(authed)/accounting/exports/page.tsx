"use client";
import { useEffect, useState } from "react";
import { ja } from "@/i18n/ja";
import { ConfirmationDialog } from "@/components/ConfirmationDialog";

type ExportItem = {
  id: string;
  cutoffDate: string;
  paymentDate: string;
  rowCount: number;
  totalAmountYen: number;
  layoutVersion: string;
  exportedBy: string;
  exportedAt: string;
  fileRelativePath: string;
};

function defaultCutoff(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}-25`;
}

export default function ExportsPage() {
  const [items, setItems] = useState<ExportItem[]>([]);
  const [cutoff, setCutoff] = useState(defaultCutoff());
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [forcing, setForcing] = useState(false);

  const load = async () => {
    const res = await fetch("/api/accounting/exports");
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
        const res = await fetch("/api/accounting/exports");
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

  const doExport = async () => {
    setError(null);
    setInfo(null);
    const res = await fetch("/api/accounting/exports", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        cutoffDate: cutoff,
        force: forcing,
      }),
    });
    const data = await res.json();
    setConfirmOpen(false);
    setForcing(false);
    if (!res.ok) {
      if (data.code === "CSV_SNAPSHOT_EXISTS") {
        setError(
          `${data.error}（既存の出力 ID: ${data.extra?.exportId ?? ""}）`,
        );
      } else {
        setError(data.error ?? ja.message.serverError);
      }
      return;
    }
    setInfo(
      `${ja.message.csvExported}（出力件数: ${data.rowCount}、支払予定日: ${data.paymentDate}）`,
    );
    await load();
  };

  return (
    <main className="max-w-3xl mx-auto p-6">
      <h1 className="text-xl font-bold mb-3">支払用 CSV の出力</h1>

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
        <label className="block mb-2 text-sm">
          <span>{ja.label.cutoffDate}（既定: 当月 25 日）</span>
          <input
            type="date"
            value={cutoff}
            onChange={(e) => setCutoff(e.target.value)}
            className="mt-1 block border rounded p-2"
          />
        </label>
        <label className="block text-sm mb-3">
          <input
            type="checkbox"
            checked={forcing}
            onChange={(e) => setForcing(e.target.checked)}
          />
          <span className="ml-2">同じ締め日の既存出力があっても上書きする</span>
        </label>
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded"
        >
          {ja.button.exportCsv}
        </button>
      </section>

      <h2 className="font-bold mb-2 text-sm">出力履歴</h2>
      {items.length === 0 ? (
        <p className="text-gray-600 text-sm">出力履歴はありません。</p>
      ) : (
        <ul className="divide-y border rounded">
          {items.map((e) => (
            <li key={e.id} className="p-3 text-sm">
              <div className="flex justify-between">
                <span className="font-mono text-xs">{e.id}</span>
                <span className="text-xs text-gray-500">
                  {e.layoutVersion}
                </span>
              </div>
              <div>
                締め日 {e.cutoffDate}／支払予定日 {e.paymentDate}／
                {e.rowCount} 件／合計 {e.totalAmountYen.toLocaleString()} 円
              </div>
              <div className="text-xs text-gray-500">
                出力: {e.exportedBy}
                （{new Date(e.exportedAt).toLocaleString("ja-JP")}）
                ／ファイル: {e.fileRelativePath}
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConfirmationDialog
        open={confirmOpen}
        title={ja.confirmation.exportCsvTitle}
        body={ja.confirmation.exportCsvBody}
        onConfirm={doExport}
        onCancel={() => setConfirmOpen(false)}
        summary={<div>締め日: {cutoff}（force={String(forcing)}）</div>}
      />
    </main>
  );
}
