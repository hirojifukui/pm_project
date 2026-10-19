"use client";
import { useEffect, useRef } from "react";
import { ja } from "@/i18n/ja";

export type ConfirmationDialogProps = {
  open: boolean;
  title: string;
  body: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  summary?: React.ReactNode;
};

/**
 * 不可逆操作（提出・取下げ・承認・差戻し・経理確定・CSV 出力）で使う確認ダイアログ（憲法 II）。
 * 件数・内容の要約は `summary` で受け取り、操作対象を明示する。
 */
export function ConfirmationDialog(props: ConfirmationDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (props.open) {
      if (!el.open) el.showModal();
    } else {
      if (el.open) el.close();
    }
  }, [props.open]);

  return (
    <dialog
      ref={dialogRef}
      className="rounded-lg p-0 w-full max-w-md backdrop:bg-black/40"
      aria-labelledby="confirmation-title"
      onCancel={(e) => {
        e.preventDefault();
        props.onCancel();
      }}
    >
      <div className="p-6 bg-white">
        <h2 id="confirmation-title" className="text-lg font-bold mb-3">
          {props.title}
        </h2>
        <p className="text-sm text-gray-700 mb-4 whitespace-pre-wrap">
          {props.body}
        </p>
        {props.summary ? (
          <div className="text-sm bg-gray-50 border rounded p-3 mb-4">
            {props.summary}
          </div>
        ) : null}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="px-4 py-2 border rounded"
            onClick={props.onCancel}
          >
            {props.cancelLabel ?? ja.button.cancel}
          </button>
          <button
            type="button"
            className="px-4 py-2 rounded bg-blue-600 text-white"
            onClick={props.onConfirm}
          >
            {props.confirmLabel ?? ja.button.confirm}
          </button>
        </div>
      </div>
    </dialog>
  );
}
