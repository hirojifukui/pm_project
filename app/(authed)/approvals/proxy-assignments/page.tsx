"use client";
import { useEffect, useState } from "react";
import { ja } from "@/i18n/ja";

type Assignment = {
  id: string;
  proxy: { empNo: string; name: string };
  startsAt: string;
  endsAt: string;
};

export default function ProxyAssignmentsPage() {
  const [items, setItems] = useState<Assignment[]>([]);
  const [proxyEmpNo, setProxyEmpNo] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const load = async () => {
    const res = await fetch("/api/approvals/proxy-assignments");
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
        const res = await fetch("/api/approvals/proxy-assignments");
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

  const create = async () => {
    setError(null);
    setInfo(null);
    const res = await fetch("/api/approvals/proxy-assignments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        proxyEmpNo,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(
        data.error ??
          data.violations?.[0]?.message ??
          ja.message.serverError,
      );
      return;
    }
    setInfo(ja.message.proxyAssigned);
    setProxyEmpNo("");
    setStartsAt("");
    setEndsAt("");
    await load();
  };

  const remove = async (id: string) => {
    setError(null);
    setInfo(null);
    const res = await fetch(`/api/approvals/proxy-assignments/${id}`, {
      method: "DELETE",
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? ja.message.serverError);
      return;
    }
    setInfo(
      `${ja.message.proxyRemoved}（進行中の割当: ${data.reassignedApplications}）`,
    );
    await load();
  };

  return (
    <main className="max-w-2xl mx-auto p-6">
      <h1 className="text-xl font-bold mb-2">代理承認の指名</h1>
      <p className="text-xs text-gray-600 mb-4">
        3 営業日以上の不在に対して、部長を代理承認者として指名できます（BR-012）。
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

      <section className="border rounded p-3 mb-4">
        <h2 className="font-bold mb-2 text-sm">新規指名</h2>
        <label className="block mb-2 text-sm">
          <span>代理承認者（社員番号 / 部長）</span>
          <input
            type="text"
            value={proxyEmpNo}
            onChange={(e) => setProxyEmpNo(e.target.value)}
            className="mt-1 block w-full border rounded p-2"
            placeholder="E0020"
          />
        </label>
        <label className="block mb-2 text-sm">
          <span>開始日時</span>
          <input
            type="datetime-local"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            className="mt-1 block w-full border rounded p-2"
          />
        </label>
        <label className="block mb-3 text-sm">
          <span>終了日時</span>
          <input
            type="datetime-local"
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
            className="mt-1 block w-full border rounded p-2"
          />
        </label>
        <button
          type="button"
          onClick={create}
          className="px-3 py-2 bg-blue-600 text-white rounded"
        >
          指名する
        </button>
      </section>

      <section>
        <h2 className="font-bold mb-2 text-sm">現在の指名</h2>
        {items.length === 0 ? (
          <p className="text-sm text-gray-600">現在の指名はありません。</p>
        ) : (
          <ul className="divide-y border rounded">
            {items.map((a) => (
              <li
                key={a.id}
                className="flex justify-between items-center p-3 text-sm"
              >
                <div>
                  <div>
                    {a.proxy.name}（{a.proxy.empNo}）
                  </div>
                  <div className="text-xs text-gray-600">
                    {new Date(a.startsAt).toLocaleString("ja-JP")}
                    〜 {new Date(a.endsAt).toLocaleString("ja-JP")}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => remove(a.id)}
                  className="text-red-600 text-xs"
                >
                  取消
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
