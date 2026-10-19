"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ja } from "@/i18n/ja";

type Item = {
  id: string;
  applicationNumber: string | null;
  templateId: string;
  operation: string;
  sentAt: string | null;
  readAt: string | null;
  linkPath: string | null;
};

export default function NotificationsPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const res = await fetch("/api/notifications/inbox");
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
        const res = await fetch("/api/notifications/inbox");
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

  const markRead = async (id: string) => {
    const res = await fetch(`/api/notifications/${id}/read`, {
      method: "POST",
    });
    if (!res.ok) return;
    await load();
  };

  return (
    <main className="max-w-3xl mx-auto p-6">
      <h1 className="text-xl font-bold mb-4">{ja.nav.inbox}</h1>
      {error ? (
        <p className="text-red-700">{error}</p>
      ) : items.length === 0 ? (
        <p className="text-gray-600">お知らせはありません。</p>
      ) : (
        <ul className="divide-y border rounded">
          {items.map((n) => (
            <li
              key={n.id}
              className={`p-3 flex justify-between items-center text-sm ${
                n.readAt ? "opacity-60" : ""
              }`}
            >
              <div>
                <div>
                  {ja.operation[n.operation as keyof typeof ja.operation] ??
                    n.operation}
                  {n.applicationNumber ? ` ／ ${n.applicationNumber}` : ""}
                </div>
                <div className="text-xs text-gray-500">
                  {n.sentAt
                    ? new Date(n.sentAt).toLocaleString("ja-JP")
                    : ""}
                </div>
              </div>
              <div className="flex gap-2">
                {n.linkPath ? (
                  <Link
                    className="text-blue-700 underline text-xs"
                    href={n.linkPath}
                  >
                    開く
                  </Link>
                ) : null}
                {!n.readAt ? (
                  <button
                    type="button"
                    onClick={() => markRead(n.id)}
                    className="text-xs text-gray-600 underline"
                  >
                    既読
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
