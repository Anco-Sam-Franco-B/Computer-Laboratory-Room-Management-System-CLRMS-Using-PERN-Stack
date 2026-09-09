import { useState } from 'react';
import Modal from './ui/Modal';
import Spinner from './ui/Spinner';

export default function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', onConfirm, onClose, danger = true }) {
  const [busy, setBusy] = useState(false);

  const handleConfirm = async () => {
    setBusy(true);
    try {
      await onConfirm?.();
    } finally {
      setBusy(false);
      onClose();
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title || 'Are you sure?'}
      size="sm"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose} disabled={busy}>Cancel</button>
          <button className={danger ? 'btn-danger' : 'btn-primary'} onClick={handleConfirm} disabled={busy}>
            {busy ? <Spinner size={14} /> : confirmLabel}
          </button>
        </>
      }
    >
      <p className="text-sm text-slate-600 dark:text-slate-300">{message || 'This action cannot be undone.'}</p>
    </Modal>
  );
}