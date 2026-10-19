"use client";
import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ja } from "@/i18n/ja";
import { ConfirmationDialog } from "@/components/ConfirmationDialog";

type ApplicationDetail = {
  applicationNumber: string;
  applicant: { empNo: string; name: string; department: string };
  tripStartDate: string;
  tripEndDate: string;
  destination: string;
  purpose: string;
  totalAmountYen: number;
  status: keyof typeof ja.status;
  lines: Array<{
    id: string;
    date: string;
    category: keyof typeof ja.category;
    amountYen: number;
    transportMode: string | null;
    fromPlace: string | null;
    toPlace: string | null;
    remarks: string | null;
    receipts: Array<{ id: string; mimeType: string; sizeBytes: number }>;
  }>;
  histories: Array<{
    id: string;
    operator: { name: string };
    actedAs: "SELF" | "PROXY";
    operation: string;
    comment: string | null;
    occurredAt: string;
  }>;
};

export default function ApprovalDetailPage({
  params,
}: {
  params: Promise<{ applicationNumber: string }>;
}) {
  const { applicationNumber } = use(params);
  const router = useRouter();
  const [app, setApp] = useState<ApplicationDetail | null>(null);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [confirmApprove, setConfirmApprove] = useState(false);
  const [confirmRemand, setConfirmRemand] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(
          `/api/applications/by-number/${applicationNumber}`,
        );
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(data.error ?? ja.message.serverError);
          return;
        }
        setApp(data);
      } catch {
        if (!cancelled) setError(ja.message.serverError);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applicationNumber]);

  if (error && !app) {
    return (
      <main className="max-w-3xl mx-auto p-6 text-red-700">{error}</main>
    );
  }
  if (!app) {
    return <main className="max-w-3xl mx-auto p-6">読み込み中…</main>;
  }

  const approve = async () => {
    setError(null);
    const res = await fetch(
      `/api/approvals/${applicationNumber}/approve`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ comment: comment || undefined }),
      },
    );
    const data = await res.json();
    setConfirmApprove(false);
    if (!res.ok) {
      setError(data.error ?? ja.message.serverError);
      return;
    }
    router.push("/approvals");
  };

  const remand = async () => {
    setCommentError(null);
    if (!comment.trim()) {
      setConfirmRemand(false);
      setCommentError(ja.message.commentRequired);
      return;
    }
    const res = await fetch(
      `/api/approvals/${applicationNumber}/remand`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ comment }),
      },
    );
    const data = await res.json();
    setConfirmRemand(false);
    if (!res.ok) {
      setError(data.error ?? ja.message.serverError);
      return;
    }
    router.push("/approvals");
  };

  return (
    <main className="max-w-4xl mx-auto p-6">
      <h1 className="text-xl font-bold font-mono mb-1">
        {app.applicationNumber}
      </h1>
      <div className="text-sm text-gray-600 mb-3">
        {ja.label.status}: {ja.status[app.status] ?? app.status}
      </div>

      {error ? (
        <div className="text-sm text-red-700 border border-red-200 bg-red-50 p-3 mb-3 rounded">
          {error}
        </div>
      ) : null}

      <section className="border rounded p-3 mb-4 bg-gray-50 text-sm">
        <div>
          {ja.label.applicant}: {app.applicant.name}（{app.applicant.department}）
        </div>
        <div>
          {app.tripStartDate} 〜 {app.tripEndDate}
        </div>
        <div>
          {ja.label.destination}: {app.destination}
        </div>
        <div>
          {ja.label.purpose}: {app.purpose}
        </div>
        <div>
          {ja.label.totalAmount}: {app.totalAmountYen.toLocaleString()} 円
        </div>
      </section>

      <section className="mb-4">
        <h2 className="font-bold mb-2">明細</h2>
        <ul className="text-sm space-y-2">
          {app.lines.map((l, i) => (
            <li key={l.id} className="border rounded p-2">
              <div className="flex justify-between">
                <span>明細 {i + 1}</span>
                <span className="font-mono">
                  {l.amountYen.toLocaleString()} 円
                </span>
              </div>
              <div className="text-xs text-gray-600">
                {l.date}／{ja.category[l.category]}
                {l.transportMode
                  ? `／${
                      ja.transportMode[
                        l.transportMode as keyof typeof ja.transportMode
                      ] ?? l.transportMode
                    }`
                  : ""}
                {l.fromPlace ? `（${l.fromPlace}→${l.toPlace ?? ""}）` : ""}
                ／領収書 {l.receipts.length} 枚
              </div>
              {l.remarks ? (
                <div className="text-xs text-gray-500 mt-1">備考: {l.remarks}</div>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <section className="mb-4">
        <h2 className="font-bold mb-2">履歴</h2>
        {app.histories.length === 0 ? (
          <p className="text-sm text-gray-600">まだ履歴はありません。</p>
        ) : (
          <ul className="text-sm space-y-1">
            {app.histories.map((h) => (
              <li key={h.id}>
                {new Date(h.occurredAt).toLocaleString("ja-JP")}／
                {h.operator.name}（{h.actedAs === "PROXY" ? "代理" : "本人"}）／
                {ja.operation[h.operation as keyof typeof ja.operation] ?? h.operation}
                {h.comment ? `／コメント: ${h.comment}` : ""}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mb-4">
        <label className="block mb-2">
          <span className="text-sm">{ja.label.comment}</span>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={2}
            className="mt-1 block w-full border rounded p-2"
          />
        </label>
        {commentError ? (
          <div className="text-sm text-red-700">{commentError}</div>
        ) : null}
        <div className="flex gap-2 mt-2">
          <button
            type="button"
            onClick={() => setConfirmApprove(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded"
          >
            {ja.button.approve}
          </button>
          <button
            type="button"
            onClick={() => setConfirmRemand(true)}
            className="px-4 py-2 border rounded"
          >
            {ja.button.remand}
          </button>
        </div>
      </section>

      <ConfirmationDialog
        open={confirmApprove}
        title={ja.confirmation.approveTitle}
        body={ja.confirmation.approveBody}
        onConfirm={approve}
        onCancel={() => setConfirmApprove(false)}
      />
      <ConfirmationDialog
        open={confirmRemand}
        title={ja.confirmation.remandTitle}
        body={ja.confirmation.remandBody}
        onConfirm={remand}
        onCancel={() => setConfirmRemand(false)}
        summary={<div>コメント: {comment || "(未入力)"}</div>}
      />
    </main>
  );
}
