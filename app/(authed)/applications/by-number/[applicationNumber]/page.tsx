"use client";
import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ja } from "@/i18n/ja";
import { ConfirmationDialog } from "@/components/ConfirmationDialog";

type ExpenseCategory = "TRANSPORT" | "LODGING" | "PER_DIEM" | "OTHER";
type TransportMode =
  | "TRAIN"
  | "SHINKANSEN"
  | "BUS"
  | "TAXI"
  | "FLIGHT"
  | "OTHER";
type TaxiReason = "AFTER_22" | "HEAVY_LUGGAGE" | "CUSTOMER_RIDE";

type LineInput = {
  id?: string;
  date: string;
  category: ExpenseCategory;
  fromPlace?: string;
  toPlace?: string;
  transportMode?: TransportMode;
  amountYen: number;
  taxiReasons?: TaxiReason[];
  exceedsLodgingCapReason?: string;
  remarks?: string;
};

type ApplicationDetail = {
  applicationNumber: string;
  applicant: { empNo: string; name: string; department: string };
  tripStartDate: string;
  tripEndDate: string;
  destination: string;
  purpose: string;
  totalAmountYen: number;
  status: keyof typeof ja.status;
  nextApprover: { empNo: string; name: string } | null;
  lines: Array<
    LineInput & {
      isSystemGenerated: boolean;
      receipts: Array<{
        id: string;
        mimeType: string;
        sizeBytes: number;
        isSupportingDocument: boolean;
      }>;
    }
  >;
  histories: Array<{
    id: string;
    operator: { empNo: string; name: string };
    actedAs: "SELF" | "PROXY";
    operation: string;
    comment: string | null;
    occurredAt: string;
  }>;
};

type Violation = { path?: string; message: string; ruleId?: string };

const EDITABLE = new Set(["DRAFT", "REMANDED"]);

export default function ApplicationDetailPage({
  params,
}: {
  params: Promise<{ applicationNumber: string }>;
}) {
  const { applicationNumber } = use(params);
  const router = useRouter();
  const [app, setApp] = useState<ApplicationDetail | null>(null);
  const [lines, setLines] = useState<LineInput[]>([]);
  const [violations, setViolations] = useState<Violation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);
  const [lateReason, setLateReason] = useState("");

  const reload = async () => {
    const res = await fetch(
      `/api/applications/by-number/${applicationNumber}`,
    );
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? ja.message.serverError);
      return;
    }
    setApp(data);
    setLines(data.lines);
    setViolations([]);
  };
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
        setLines(data.lines);
      } catch {
        if (!cancelled) setError(ja.message.serverError);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applicationNumber]);

  if (error && !app) {
    return <main className="max-w-3xl mx-auto p-6 text-red-700">{error}</main>;
  }
  if (!app) {
    return <main className="max-w-3xl mx-auto p-6">読み込み中…</main>;
  }

  const editable = EDITABLE.has(app.status);

  const addLine = () => {
    setLines([
      ...lines,
      {
        date: app.tripStartDate,
        category: "TRANSPORT",
        amountYen: 0,
      },
    ]);
  };

  const removeLine = (idx: number) => {
    const next = lines.slice();
    next.splice(idx, 1);
    setLines(next);
  };

  const updateLine = (idx: number, patch: Partial<LineInput>) => {
    const next = lines.slice();
    const current = next[idx];
    if (!current) return;
    next[idx] = { ...current, ...patch };
    setLines(next);
  };

  const toggleTaxiReason = (idx: number, r: TaxiReason) => {
    const next = lines.slice();
    const current = next[idx];
    if (!current) return;
    const existing = current.taxiReasons ?? [];
    const picked = existing.includes(r)
      ? existing.filter((x) => x !== r)
      : [...existing, r];
    next[idx] = { ...current, taxiReasons: picked };
    setLines(next);
  };

  const saveLines = async () => {
    setViolations([]);
    setError(null);
    const res = await fetch(
      `/api/applications/${applicationNumber}/lines`,
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ lines }),
      },
    );
    const data = await res.json();
    if (!res.ok) {
      if (data.violations) {
        setViolations(data.violations);
      } else {
        setError(data.error ?? ja.message.serverError);
      }
      return;
    }
    await reload();
  };

  const uploadReceipt = async (expenseLineId: string, file: File) => {
    setError(null);
    const form = new FormData();
    form.set("expenseLineId", expenseLineId);
    form.set("file", file);
    const res = await fetch(
      `/api/applications/${applicationNumber}/receipts`,
      { method: "POST", body: form },
    );
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? ja.message.serverError);
      return;
    }
    await reload();
  };

  const submit = async () => {
    setViolations([]);
    setError(null);
    const res = await fetch(
      `/api/applications/${applicationNumber}/submit`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ lateReason: lateReason || undefined }),
      },
    );
    const data = await res.json();
    setConfirmSubmit(false);
    if (!res.ok) {
      if (data.violations) {
        setViolations(data.violations);
      } else if (data.code === "OVERLAPPING_TRIP") {
        setError(
          `${ja.message.overlappingTrip}（重複: ${data.extra?.conflictingApplicationNumber ?? ""}）`,
        );
      } else {
        setError(data.error ?? ja.message.serverError);
      }
      return;
    }
    await reload();
  };

  const withdraw = async () => {
    setError(null);
    const res = await fetch(
      `/api/applications/${applicationNumber}/withdraw`,
      { method: "POST" },
    );
    const data = await res.json();
    setConfirmWithdraw(false);
    if (!res.ok) {
      setError(data.error ?? ja.message.serverError);
      return;
    }
    router.push("/applications/drafts");
  };

  return (
    <main className="max-w-4xl mx-auto p-6">
      <div className="flex justify-between items-start mb-3">
        <div>
          <h1 className="text-xl font-bold font-mono">
            {app.applicationNumber}
          </h1>
          <div className="text-sm text-gray-600">
            {ja.label.status}: {ja.status[app.status] ?? app.status}
          </div>
        </div>
      </div>

      <p className="text-xs text-gray-600 mb-3">
        {ja.message.receiptRetentionNotice}
      </p>

      {error ? (
        <div className="text-sm text-red-700 border border-red-200 bg-red-50 p-3 mb-3 rounded">
          {error}
        </div>
      ) : null}
      {app.status === "ACCOUNTING_DIRECTOR_SUPERIOR_APPROVAL" &&
      !app.nextApprover ? (
        <div className="text-sm text-amber-800 border border-amber-200 bg-amber-50 p-3 mb-3 rounded">
          {ja.message.accountingDirectorSuperiorMissing}
        </div>
      ) : null}
      {violations.length > 0 ? (
        <div className="text-sm text-red-700 border border-red-200 bg-red-50 p-3 mb-3 rounded">
          <div className="font-bold mb-1">{ja.message.submitBlocked}</div>
          <ul className="list-disc list-inside">
            {violations.map((v, i) => (
              <li key={i}>
                {v.ruleId ? `[${v.ruleId}] ` : ""}
                {v.message}
                {v.path ? `（場所: ${v.path}）` : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <section className="border rounded p-3 mb-4 bg-gray-50">
        <div className="text-sm">
          {app.tripStartDate} 〜 {app.tripEndDate}
        </div>
        <div className="text-sm">
          {ja.label.destination}: {app.destination}
        </div>
        <div className="text-sm">
          {ja.label.purpose}: {app.purpose}
        </div>
        <div className="text-sm">
          {ja.label.totalAmount}: {app.totalAmountYen.toLocaleString()} 円
        </div>
      </section>

      <section className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-bold">明細</h2>
          {editable ? (
            <button
              type="button"
              onClick={addLine}
              className="text-sm px-3 py-1 border rounded"
            >
              {ja.button.addLine}
            </button>
          ) : null}
        </div>
        {lines.length === 0 ? (
          <p className="text-sm text-gray-600">明細はまだありません。</p>
        ) : (
          <div className="space-y-3">
            {lines.map((l, idx) => (
              <LineEditor
                key={l.id ?? `new-${idx}`}
                idx={idx}
                line={l}
                editable={editable}
                existingReceipts={app.lines[idx]?.receipts ?? []}
                onChange={(p) => updateLine(idx, p)}
                onRemove={() => removeLine(idx)}
                onToggleTaxiReason={(r) => toggleTaxiReason(idx, r)}
                onUploadReceipt={(file) => uploadReceipt(l.id ?? "", file)}
              />
            ))}
          </div>
        )}
        {editable ? (
          <div className="mt-3">
            <button
              type="button"
              onClick={saveLines}
              className="px-4 py-2 bg-gray-800 text-white rounded"
            >
              {ja.button.save}
            </button>
          </div>
        ) : null}
      </section>

      {editable ? (
        <section className="mb-6">
          <label className="block mb-2">
            <span className="text-sm">
              {ja.label.lateReason}（期限超過時のみ記入）
            </span>
            <input
              type="text"
              value={lateReason}
              onChange={(e) => setLateReason(e.target.value)}
              className="mt-1 block w-full border rounded p-2"
            />
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setConfirmSubmit(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded"
            >
              {ja.button.submit}
            </button>
          </div>
        </section>
      ) : null}

      {app.status === "SECTION_MANAGER_APPROVAL" ? (
        <section className="mb-6">
          <button
            type="button"
            onClick={() => setConfirmWithdraw(true)}
            className="px-4 py-2 border rounded"
          >
            {ja.button.withdraw}
          </button>
        </section>
      ) : null}

      <section className="mb-6">
        <h2 className="font-bold mb-2">履歴</h2>
        {app.histories.length === 0 ? (
          <p className="text-sm text-gray-600">履歴はまだありません。</p>
        ) : (
          <ul className="text-sm space-y-1">
            {app.histories.map((h) => (
              <li key={h.id}>
                {new Date(h.occurredAt).toLocaleString("ja-JP")} ／ {h.operator.name}（{h.actedAs === "PROXY" ? "代理" : "本人"}）／
                {ja.operation[h.operation as keyof typeof ja.operation] ?? h.operation}
                {h.comment ? ` ／ コメント: ${h.comment}` : ""}
              </li>
            ))}
          </ul>
        )}
      </section>

      <ConfirmationDialog
        open={confirmSubmit}
        title={ja.confirmation.submitTitle}
        body={ja.confirmation.submitBody}
        onConfirm={submit}
        onCancel={() => setConfirmSubmit(false)}
        summary={
          <>
            <div>申請番号: {app.applicationNumber}</div>
            <div>合計: {app.totalAmountYen.toLocaleString()} 円</div>
            <div>明細 {lines.length} 件</div>
          </>
        }
      />
      <ConfirmationDialog
        open={confirmWithdraw}
        title={ja.confirmation.withdrawTitle}
        body={ja.confirmation.withdrawBody}
        onConfirm={withdraw}
        onCancel={() => setConfirmWithdraw(false)}
      />
    </main>
  );
}

function LineEditor(props: {
  idx: number;
  line: LineInput;
  editable: boolean;
  existingReceipts: Array<{
    id: string;
    isSupportingDocument: boolean;
  }>;
  onChange: (patch: Partial<LineInput>) => void;
  onRemove: () => void;
  onToggleTaxiReason: (r: TaxiReason) => void;
  onUploadReceipt: (file: File) => void;
}) {
  const { line, editable } = props;
  return (
    <div className="border rounded p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-bold">明細 {props.idx + 1}</div>
        {editable ? (
          <button
            type="button"
            className="text-xs text-red-600"
            onClick={props.onRemove}
          >
            {ja.button.removeLine}
          </button>
        ) : null}
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <label>
          <span>{ja.label.date}</span>
          <input
            type="date"
            value={line.date}
            disabled={!editable}
            onChange={(e) => props.onChange({ date: e.target.value })}
            className="mt-1 block w-full border rounded p-1"
          />
        </label>
        <label>
          <span>{ja.label.category}</span>
          <select
            value={line.category}
            disabled={!editable}
            onChange={(e) =>
              props.onChange({
                category: e.target.value as ExpenseCategory,
              })
            }
            className="mt-1 block w-full border rounded p-1"
          >
            <option value="TRANSPORT">{ja.category.TRANSPORT}</option>
            <option value="LODGING">{ja.category.LODGING}</option>
            <option value="PER_DIEM">{ja.category.PER_DIEM}</option>
            <option value="OTHER">{ja.category.OTHER}</option>
          </select>
        </label>
        {line.category === "TRANSPORT" ? (
          <>
            <label>
              <span>{ja.label.fromPlace}</span>
              <input
                type="text"
                value={line.fromPlace ?? ""}
                disabled={!editable}
                onChange={(e) => props.onChange({ fromPlace: e.target.value })}
                className="mt-1 block w-full border rounded p-1"
              />
            </label>
            <label>
              <span>{ja.label.toPlace}</span>
              <input
                type="text"
                value={line.toPlace ?? ""}
                disabled={!editable}
                onChange={(e) => props.onChange({ toPlace: e.target.value })}
                className="mt-1 block w-full border rounded p-1"
              />
            </label>
            <label>
              <span>{ja.label.transportMode}</span>
              <select
                value={line.transportMode ?? ""}
                disabled={!editable}
                onChange={(e) =>
                  props.onChange({
                    transportMode: e.target.value as TransportMode,
                  })
                }
                className="mt-1 block w-full border rounded p-1"
              >
                <option value="">（選択）</option>
                <option value="TRAIN">{ja.transportMode.TRAIN}</option>
                <option value="SHINKANSEN">{ja.transportMode.SHINKANSEN}</option>
                <option value="BUS">{ja.transportMode.BUS}</option>
                <option value="TAXI">{ja.transportMode.TAXI}</option>
                <option value="FLIGHT">{ja.transportMode.FLIGHT}</option>
                <option value="OTHER">{ja.transportMode.OTHER}</option>
              </select>
            </label>
          </>
        ) : null}
        <label>
          <span>{ja.label.amountYen}</span>
          <input
            type="number"
            min={0}
            step={1}
            value={line.amountYen}
            disabled={!editable || line.category === "PER_DIEM"}
            onChange={(e) =>
              props.onChange({ amountYen: Number(e.target.value) })
            }
            className="mt-1 block w-full border rounded p-1"
          />
        </label>
        <label className="col-span-2">
          <span>{ja.label.remarks}</span>
          <input
            type="text"
            value={line.remarks ?? ""}
            disabled={!editable}
            onChange={(e) => props.onChange({ remarks: e.target.value })}
            className="mt-1 block w-full border rounded p-1"
          />
        </label>
      </div>

      {line.transportMode === "TAXI" ? (
        <div className="mt-2 text-sm">
          <div className="mb-1">{ja.label.taxiReasons}</div>
          {(["AFTER_22", "HEAVY_LUGGAGE", "CUSTOMER_RIDE"] as const).map(
            (r) => (
              <label key={r} className="mr-3">
                <input
                  type="checkbox"
                  checked={(line.taxiReasons ?? []).includes(r)}
                  disabled={!editable}
                  onChange={() => props.onToggleTaxiReason(r)}
                />{" "}
                {ja.taxiReason[r]}
              </label>
            ),
          )}
        </div>
      ) : null}

      {line.category === "LODGING" ? (
        <label className="block mt-2 text-sm">
          <span>{ja.label.exceedsLodgingCapReason}</span>
          <input
            type="text"
            value={line.exceedsLodgingCapReason ?? ""}
            disabled={!editable}
            onChange={(e) =>
              props.onChange({ exceedsLodgingCapReason: e.target.value })
            }
            className="mt-1 block w-full border rounded p-1"
          />
        </label>
      ) : null}

      {line.id ? (
        <div className="mt-2 text-sm">
          <div className="mb-1">
            領収書（{props.existingReceipts.length} 枚）
            {props.existingReceipts.some((r) => r.isSupportingDocument) ? (
              <span className="ml-2 text-xs text-amber-700">
                （支払証明書を含む）
              </span>
            ) : null}
          </div>
          {editable ? (
            <input
              type="file"
              accept="image/jpeg,image/png"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) props.onUploadReceipt(f);
              }}
            />
          ) : null}
        </div>
      ) : (
        <div className="text-xs text-gray-500 mt-2">
          領収書を添付するには、先に保存して明細 ID を確定してください。
        </div>
      )}
    </div>
  );
}
