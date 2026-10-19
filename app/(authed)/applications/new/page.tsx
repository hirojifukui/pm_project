"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ja } from "@/i18n/ja";

export default function NewApplicationPage() {
  const router = useRouter();
  const [tripStartDate, setStart] = useState("");
  const [tripEndDate, setEnd] = useState("");
  const [destination, setDestination] = useState("");
  const [purpose, setPurpose] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onCreate = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/applications/drafts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tripStartDate,
          tripEndDate,
          destination,
          purpose,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? ja.message.serverError);
        return;
      }
      router.push(`/applications/by-number/${data.applicationNumber}`);
    } catch {
      setError(ja.message.serverError);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="max-w-xl mx-auto p-6">
      <h1 className="text-xl font-bold mb-2">新規の旅費精算申請</h1>
      <p className="text-xs text-gray-600 mb-4">
        {ja.message.receiptRetentionNotice}
      </p>
      {error ? (
        <div className="text-sm text-red-700 border border-red-200 bg-red-50 p-3 mb-3 rounded">
          {error}
        </div>
      ) : null}
      <div className="space-y-3">
        <label className="block">
          <span className="text-sm">{ja.label.tripStartDate}</span>
          <input
            type="date"
            value={tripStartDate}
            onChange={(e) => setStart(e.target.value)}
            className="mt-1 block w-full border rounded p-2"
          />
        </label>
        <label className="block">
          <span className="text-sm">{ja.label.tripEndDate}</span>
          <input
            type="date"
            value={tripEndDate}
            onChange={(e) => setEnd(e.target.value)}
            className="mt-1 block w-full border rounded p-2"
          />
        </label>
        <label className="block">
          <span className="text-sm">{ja.label.destination}</span>
          <input
            type="text"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            className="mt-1 block w-full border rounded p-2"
          />
        </label>
        <label className="block">
          <span className="text-sm">{ja.label.purpose}</span>
          <textarea
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            rows={3}
            className="mt-1 block w-full border rounded p-2"
          />
        </label>
        <div className="flex justify-end">
          <button
            type="button"
            disabled={submitting}
            onClick={onCreate}
            className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
          >
            {ja.button.createDraft}
          </button>
        </div>
      </div>
    </main>
  );
}
