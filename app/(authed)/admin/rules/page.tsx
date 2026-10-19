"use client";
import { useEffect, useState } from "react";
import { ja } from "@/i18n/ja";

type RuleValue = {
  ruleKey: string;
  effectiveFrom: string;
  value: string;
  changedByEmpNo: string;
  changeReason: string;
  createdAt: string;
};

export default function AdminRulesPage() {
  const [items, setItems] = useState<RuleValue[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [ruleKey, setRuleKey] = useState("PER_DIEM_STAFF_LODGING");
  const [value, setValue] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState("2027-04-01");
  const [changeReason, setChangeReason] = useState("");

  const load = async () => {
    const res = await fetch("/api/admin/rules");
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
        const res = await fetch("/api/admin/rules");
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
    const res = await fetch("/api/admin/rules", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ruleKey,
        value,
        effectiveFrom,
        changeReason,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? ja.message.serverError);
      return;
    }
    setInfo(`${ruleKey}（${effectiveFrom}）を保存しました。`);
    setValue("");
    setChangeReason("");
    await load();
  };

  return (
    <main className="max-w-4xl mx-auto p-6">
      <h1 className="text-xl font-bold mb-3">規程値</h1>
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

      <section className="border rounded p-3 mb-6 text-sm">
        <h2 className="font-bold mb-2">新しい改定値を追加</h2>
        <div className="grid grid-cols-2 gap-2">
          <label>
            <span>規程値のキー</span>
            <select
              value={ruleKey}
              onChange={(e) => setRuleKey(e.target.value)}
              className="mt-1 block w-full border rounded p-2"
            >
              <option value="PER_DIEM_STAFF_LODGING">日当（一般・宿泊）</option>
              <option value="PER_DIEM_MANAGEMENT_LODGING">
                日当（管理職・宿泊）
              </option>
              <option value="PER_DIEM_DAY_TRIP">日当（日帰り）</option>
              <option value="LODGING_CAP_STANDARD">宿泊費上限（標準）</option>
              <option value="LODGING_CAP_METRO">
                宿泊費上限（23区・大阪市）
              </option>
              <option value="RECEIPT_REQUIRED_THRESHOLD">
                領収書必要金額
              </option>
              <option value="DEADLINE_DAYS">申請期限日数</option>
              <option value="DIRECTOR_APPROVAL_THRESHOLD">
                部長承認必要金額
              </option>
            </select>
          </label>
          <label>
            <span>値</span>
            <input
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="mt-1 block w-full border rounded p-2"
            />
          </label>
          <label>
            <span>有効開始日</span>
            <input
              type="date"
              value={effectiveFrom}
              onChange={(e) => setEffectiveFrom(e.target.value)}
              className="mt-1 block w-full border rounded p-2"
            />
          </label>
          <label>
            <span>改定理由</span>
            <input
              type="text"
              value={changeReason}
              onChange={(e) => setChangeReason(e.target.value)}
              className="mt-1 block w-full border rounded p-2"
            />
          </label>
        </div>
        <div className="mt-3">
          <button
            type="button"
            onClick={create}
            className="px-3 py-2 bg-blue-600 text-white rounded"
          >
            保存する
          </button>
        </div>
      </section>

      <h2 className="font-bold mb-2 text-sm">改定履歴</h2>
      {items.length === 0 ? (
        <p className="text-gray-600 text-sm">規程値は登録されていません。</p>
      ) : (
        <ul className="divide-y border rounded">
          {items.map((r) => (
            <li
              key={`${r.ruleKey}-${r.effectiveFrom}`}
              className="p-3 text-sm"
            >
              <div className="flex justify-between">
                <span className="font-mono">{r.ruleKey}</span>
                <span className="text-xs text-gray-500">
                  {r.effectiveFrom} 〜
                </span>
              </div>
              <div>値: {r.value}</div>
              <div className="text-xs text-gray-600">
                改定理由: {r.changeReason}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
