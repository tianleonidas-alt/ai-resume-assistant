"use client";

export function CreditConfirmDialog({
  open,
  balance,
  note,
  busy,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  balance: number;
  note?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="auth-backdrop" role="presentation" onMouseDown={onCancel}>
      <section
        className="auth-dialog credit-confirm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="credit-confirm-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="section-no">USAGE CONFIRM</div>
        <h2 id="credit-confirm-title">确认消耗 1 点？</h2>
        <p>{note || `本次操作将消耗 1 点（免费额度优先）。当前可用 ${balance} 点。`}</p>
        <div className="credit-confirm-actions">
          <button className="credit-confirm-cancel" type="button" onClick={onCancel}>取消</button>
          <button className="credit-confirm-ok" type="button" disabled={busy} onClick={onConfirm}>
            {busy ? "处理中…" : "确认并继续"}
          </button>
        </div>
      </section>
    </div>
  );
}
