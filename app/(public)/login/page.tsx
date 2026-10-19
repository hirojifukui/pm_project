"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ja } from "@/i18n/ja";

type SwitchableUser = {
  empNo: string;
  name: string;
  department: string;
  role: string;
};

export default function LoginPage() {
  const router = useRouter();
  const [users, setUsers] = useState<SwitchableUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/auth/switchable-users");
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? ja.message.serverError);
        } else {
          setUsers(data.items ?? []);
        }
      } catch {
        setError(ja.message.serverError);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const onLogin = async (empNo: string) => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ empNo }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? ja.message.serverError);
        return;
      }
      router.push("/applications/drafts");
      router.refresh();
    } catch {
      setError(ja.message.serverError);
    }
  };

  return (
    <main className="max-w-2xl mx-auto p-6">
      <h1 className="text-xl font-bold mb-2">{ja.nav.login}</h1>
      <p className="text-sm text-gray-600 mb-6">
        本機能のローカル実装では、利用者を切り替える簡易ログインを使っています。
        本番展開では社内 SSO に差し替わります。
      </p>
      {loading ? (
        <p>読み込み中…</p>
      ) : error ? (
        <p className="text-red-700">{error}</p>
      ) : (
        <ul className="divide-y border rounded">
          {users.map((u) => (
            <li
              key={u.empNo}
              className="flex items-center justify-between p-3 gap-3"
            >
              <div>
                <div className="font-medium">
                  {u.name}（{u.department}）
                </div>
                <div className="text-xs text-gray-600">
                  社員番号 {u.empNo} / {ja.role[u.role as keyof typeof ja.role] ?? u.role}
                </div>
              </div>
              <button
                type="button"
                className="px-3 py-1 rounded bg-blue-600 text-white"
                onClick={() => onLogin(u.empNo)}
              >
                {ja.button.login}
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
