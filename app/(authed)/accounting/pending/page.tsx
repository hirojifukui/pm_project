"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ja } from "@/i18n/ja";
import { ConfirmationDialog } from "@/components/ConfirmationDialog";

type Item = {
  applicationNumber: string;
  applicantName: string;
  department: string;
  totalAmountYen: number;
  tripStartDate: string;
  tripEndDate: string;
  hasAllReceipts: boolean;
  isSelfOfApplicant: boolean;
  requiredBy: string;
};

export default function AccountingPendingPage() {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<Item | null>(null);
  const [remandTarget, setRemandTarget] = useState<Item | null>(null);
  const [comment, setComment] = useState("");
  const [commentError, setCommentError] = useState<string | null>(null);

  const load = async () => {
    const res = await fetch("/api/accounting/pending");
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
        const res = await fetch("/api/accounting/pending");
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

  const finalize = async () => {
    if (!confirmTarget) return;
    setError(null);
    const res = await fetch(
      `/api/accounting/${confirmTarget.applicationNumber}/finalize`,
      { method: "POST" },
    );
    const data = await res.json();
    setConfirmTarget(null);
    if (!res.ok) {
      setError(data.error ?? ja.message.serverError);
      return;
    }
    await load();
  };

  const remand = async () => {
    if (!remandTarget) return;
    setCommentError(null);
    if (!comment.trim()) {
      setCommentError(ja.message.commentRequired);
      return;
    }
    const res = await fetch(
      `/api/accounting/${remandTarget.applicationNumber}/remand`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ comment }),
      },
    );
    const data = await res.json();
    setRemandTarget(null);
    setComment("");
    if (!res.ok) {
      setError(data.error ?? ja.message.serverError);
      return;
    }
    await load();
  };

  return (
    <main className="max-w-3xl mx-auto p-6">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-xl font-bold">経理確定待ち</h1>
        <Link
          href="/accounting/exports"
          className="text-sm underline"
        >
          支払用 CSV
        </Link>
      </div>

      {error ? (
        <div className="text-sm text-red-700 border border-red-200 bg-red-50 p-3 mb-3 rounded">
          {error}
        </div>
      ) : null}

      {items.length === 0 ? (
        <p className="text-gray-600 text-sm">経理確定待ちの申請はありません。</p>
      ) : (
        <ul className="divide-y border rounded">
          {items.map((it) => (
            <li key={it.applicationNumber} className="p-3">
              <div className="flex justify-between">
                <div>
                  <Link
                    href={`/applications/by-number/${it.applicationNumber}`}
                    className="font-mono text-sm text-blue-700 underline"
                  >
                    {it.applicationNumber}
                  </Link>
                  <div className="text-sm">
                    {it.applicantName}（{it.department}）／{it.tripStartDate}〜{it.tripEndDate}／合計 {it.totalAmountYen.toLocaleString()} 円
                  </div>
                  <div className="text-xs text-gray-600">
                    {it.hasAllReceipts ? "領収書: 揃っている" : "領収書: 一部未添付"}
                    ／担当: {it.requiredBy}
                  </div>
                </div>
                <div className="flex gap-2 items-start">
                  <button
                    type="button"
                    className="text-xs px-2 py-1 bg-blue-600 text-white rounded"
                    onClick={() => setConfirmTarget(it)}
                  >
                    {ja.button.finalize}
                  </button>
                  <button
                    type="button"
                    className="text-xs px-2 py-1 border rounded"
                    onClick={() => {
                      setRemandTarget(it);
                      setComment("");
                      setCommentError(null);
                    }}
                  >
                    {ja.button.remand}
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {confirmTarget ? (
        <ConfirmationDialog
          open={!!confirmTarget}
          title={ja.confirmation.finalizeTitle}
          body={ja.confirmation.finalizeBody}
          summary={
            <>
              <div>申請番号: {confirmTarget.applicationNumber}</div>
              <div>合計: {confirmTarget.totalAmountYen.toLocaleString()} 円</div>
            </>
          }
          onConfirm={finalize}
          onCancel={() => setConfirmTarget(null)}
        />
      ) : null}

      {remandTarget ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
        >
          <div className="bg-white rounded p-6 max-w-md w-full">
            <h2 className="text-lg font-bold mb-2">{ja.confirmation.remandTitle}</h2>
            <p className="text-sm text-gray-700 mb-2">
              {ja.confirmation.remandBody}
            </p>
            <label className="block mb-2 text-sm">
              <span>{ja.label.comment}</span>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                className="mt-1 block w-full border rounded p-2"
              />
            </label>
            {commentError ? (
              <div className="text-sm text-red-700 mb-2">{commentError}</div>
            ) : null}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="px-4 py-2 border rounded"
                onClick={() => setRemandTarget(null)}
              >
                {ja.button.cancel}
              </button>
              <button
                type="button"
                className="px-4 py-2 bg-blue-600 text-white rounded"
                onClick={remand}
              >
                {ja.button.remand}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
